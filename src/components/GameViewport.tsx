import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from '../game/audio';
import {
  ATTACK_SPECS,
  COYOTE_TIME,
  GRAVITY,
  JUMP_BUFFER_TIME,
  PARRY_COOLDOWN,
  PARRY_WINDOW,
  PLAYER_DASH_COOLDOWN,
  PLAYER_DASH_DURATION,
  PLAYER_DASH_SPEED,
  PLAYER_DOUBLE_JUMP_SPEED,
  PLAYER_JUMP_SPEED,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
  countActiveChapterAttackers,
  createEnemyFromSpawn,
  createInitialPlayer,
  evaluateMeleeHitOnEnemy,
  findBestExecutionTarget,
  forwardFromYaw,
  getAttackDuration,
  getAttackPhase,
  getClosedGates,
  isGateOpen,
  lerpAngle,
  resolveActorPlatforms,
  resolveIncomingPlayerHit,
  yawFromDir,
} from '../game/combatMath';
import {
  CHAPTERS,
  ENEMY_SPAWNS,
  FLAME_HAZARDS,
  LORE_SHRINES,
  PLATFORMS,
  RUNE_GATES,
  getChapterForZ,
} from '../game/levelData';
import {
  animateEnemyRig,
  animateHeroRig,
  createBrazierMesh,
  createEnemyRig,
  createHeroRig,
  createLoreShrineMesh,
  createRuneGateMesh,
  type CharacterRig,
} from '../game/models';
import { PooledEffectsSystem } from '../game/particles';
import { loadGameTextures } from '../game/textures';
import type {
  AttackKind,
  ChapterIndex,
  EnemySim,
  GameOutcome,
  GameScreenState,
  HudSnapshot,
  PlayerSim,
  StoryBeat,
} from '../game/types';

export interface GameControllerHandle {
  startCampaign: (chapter?: ChapterIndex) => void;
  resumeGame: () => void;
  pauseGame: () => void;
  restartChapter: () => void;
  returnToTitle: () => void;
  toggleMute: () => void;
  toggleLockOn: () => void;
}

interface GameViewportProps {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  controllerRef: React.MutableRefObject<GameControllerHandle | null>;
  initialAutostart: boolean;
}

interface EmberBolt {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mesh: THREE.Mesh;
}

// Pre-allocated scratch math objects (zero-GC loop)
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export const GameViewport: React.FC<GameViewportProps> = ({
  onHudUpdate,
  controllerRef,
  initialAutostart,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hudCallbackRef = useRef(onHudUpdate);
  hudCallbackRef.current = onHudUpdate;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL probe
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer & Scene
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fogColor = 0x100d14;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.0135);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      56,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.15,
      260,
    );

    // 3. Lighting Rig (Key, Cool Hemisphere Fill, Warm Rim, 4 Brazier Point Lights)
    const hemiLight = new THREE.HemisphereLight(0x526488, 0x221412, 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffcb99, 1.9);
    keyLight.position.set(16, 26, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 80;
    const shadowBound = 24;
    keyLight.shadow.camera.left = -shadowBound;
    keyLight.shadow.camera.right = shadowBound;
    keyLight.shadow.camera.top = shadowBound;
    keyLight.shadow.camera.bottom = -shadowBound;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x9e3228, 0.75);
    rimLight.position.set(-14, 12, -20);
    scene.add(rimLight);

    // 4. Textures & Pooled Particles
    const textures = loadGameTextures(renderer);
    const effects = new PooledEffectsSystem(textures.bloodDecal);
    scene.add(effects.instancedParticles);
    scene.add(effects.decalsGroup);

    // 5. Build World Geometry & Environment Meshes
    const worldCollisionMeshes: THREE.Object3D[] = [];
    const disposables: Array<{ dispose: () => void }> = [];

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x383238,
      metalness: 0.45,
      roughness: 0.55,
      bumpMap: textures.stoneBump,
      bumpScale: 0.03,
    });
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x16141a,
      roughness: 0.92,
      metalness: 0.08,
    });
    disposables.push(trimMat, cliffMat);

    // Platforms with world-scaled UV tiled textures
    for (const p of PLATFORMS) {
      const topMat = new THREE.MeshStandardMaterial({
        color: 0x3b393d,
        bumpMap: textures.stoneBump,
        bumpScale: 0.045,
        roughness: 0.78,
        metalness: 0.12,
      });
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x2a282e,
        bumpMap: textures.stoneBump,
        bumpScale: 0.04,
        roughness: 0.68,
        metalness: 0.22,
      });
      textures.bindTiledBasalt(
        topMat,
        Math.max(1, p.width / 4),
        Math.max(1, p.depth / 4),
        disposables,
      );
      textures.bindTiledObsidian(
        sideMat,
        Math.max(1, p.width / 4),
        Math.max(1, p.height / 4),
        disposables,
      );
      disposables.push(topMat, sideMat);

      const boxGeo = new THREE.BoxGeometry(p.width, p.height, p.depth);
      const mesh = new THREE.Mesh(boxGeo, [
        sideMat,
        sideMat,
        topMat,
        sideMat,
        sideMat,
        sideMat,
      ]);
      mesh.position.set(p.x, p.y - p.height * 0.5, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = !isSoftwareGl;
      scene.add(mesh);
      worldCollisionMeshes.push(mesh);
      disposables.push(boxGeo);

      // Stone border coping curb on arenas & terraces for silhouette depth
      if (p.kind === 'arena' || p.kind === 'terrace') {
        const curbGeo = new THREE.BoxGeometry(p.width + 0.4, 0.24, p.depth + 0.4);
        const curb = new THREE.Mesh(curbGeo, trimMat);
        curb.position.set(p.x, p.y - 0.14, p.z);
        curb.receiveShadow = true;
        scene.add(curb);
        disposables.push(curbGeo);
      }
    }

    // Architectural Gothic Pillars & Ruined Overhead Arches framing vistas
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x2c2a30,
      bumpMap: textures.stoneBump,
      bumpScale: 0.035,
      roughness: 0.66,
      metalness: 0.24,
    });
    textures.bindTiledObsidian(pillarMat, 1, 3, disposables);
    disposables.push(pillarMat);

    const pillarPositions: Array<[number, number, number, number]> = [
      [-5.5, 0, 2, 7.5],
      [5.5, 0, 2, 7.5],
      [-5.5, 0, -21, 8.2],
      [5.5, 0, -21, 8.2],
      [-8.2, 3.0, -60, 9.0],
      [8.2, 3.0, -60, 9.0],
      [-8.2, 3.0, -76, 9.0],
      [8.2, 3.0, -76, 9.0],
      [-11.5, 4.2, -122, 11.5],
      [11.5, 4.2, -122, 11.5],
      [-11.5, 4.2, -142, 12.5],
      [11.5, 4.2, -142, 12.5],
      [0, 4.2, -146.5, 13.0],
    ];
    const pillarGeo = new THREE.BoxGeometry(1.15, 1, 1.15);
    const capGeo = new THREE.BoxGeometry(1.55, 0.45, 1.55);
    disposables.push(pillarGeo, capGeo);

    for (const [px, py, pz, ph] of pillarPositions) {
      const col = new THREE.Mesh(pillarGeo, pillarMat);
      col.scale.y = ph;
      col.position.set(px, py + ph * 0.5, pz);
      col.castShadow = !isSoftwareGl;
      col.receiveShadow = true;
      scene.add(col);
      worldCollisionMeshes.push(col);

      const cap = new THREE.Mesh(capGeo, trimMat);
      cap.position.set(px, py + ph, pz);
      scene.add(cap);
    }

    // Overhead archway cross-beams spanning key portal pairs
    const archPairs: Array<[number, number, number, number]> = [
      [11, 7.5, 2, 1.0],
      [11, 8.2, -21, 1.0],
      [16.4, 12.0, -60, 1.1],
      [23.0, 15.7, -122, 1.2],
    ];
    for (const [spanW, topY, zPos, beamH] of archPairs) {
      const beamGeo = new THREE.BoxGeometry(spanW + 1.4, beamH, 1.25);
      const beam = new THREE.Mesh(beamGeo, pillarMat);
      beam.position.set(0, topY + beamH * 0.5, zPos);
      beam.castShadow = !isSoftwareGl;
      scene.add(beam);
      disposables.push(beamGeo);
    }

    // Distant volcanic crag ring & glowing abyssal magma plane far below (never empty void)
    const abyssGeo = new THREE.PlaneGeometry(420, 420);
    abyssGeo.rotateX(-Math.PI / 2);
    const abyssMat = new THREE.MeshBasicMaterial({
      color: 0x260907,
    });
    const abyssMesh = new THREE.Mesh(abyssGeo, abyssMat);
    abyssMesh.position.set(0, -18, -65);
    scene.add(abyssMesh);
    disposables.push(abyssGeo, abyssMat);

    const cragGeo = new THREE.ConeGeometry(12, 46, 5);
    const cragCount = 26;
    const crags = new THREE.InstancedMesh(cragGeo, cliffMat, cragCount);
    const _m = new THREE.Object3D();
    for (let i = 0; i < cragCount; i++) {
      const angle = (i / cragCount) * Math.PI * 2;
      const dist = 78 + (i % 3) * 18;
      _m.position.set(Math.cos(angle) * dist, -12 + (i % 4) * 3, -65 + Math.sin(angle) * dist * 1.25);
      _m.rotation.set(0, angle * 1.7, (i % 2 === 0 ? 1 : -1) * 0.08);
      _m.scale.set(1 + (i % 3) * 0.45, 0.8 + (i % 4) * 0.35, 1 + (i % 2) * 0.4);
      _m.updateMatrix();
      crags.setMatrixAt(i, _m.matrix);
    }
    crags.computeBoundingSphere();
    scene.add(crags);
    disposables.push(cragGeo);

    // Braziers + 4 pooled scene PointLights
    const brazierCoords: Array<[number, number, number]> = [
      [-4.6, 0, 11],
      [4.6, 0, 11],
      [-4.2, 0, -19],
      [4.2, 0, -19],
      [-7.2, 3.0, -57],
      [7.2, 3.0, -57],
      [-5.0, 4.2, -108],
      [5.0, 4.2, -108],
      [-9.5, 4.2, -135],
      [9.5, 4.2, -135],
    ];
    const brazierFlames: THREE.Object3D[] = [];
    for (const [bx, by, bz] of brazierCoords) {
      const b = createBrazierMesh();
      b.position.set(bx, by, bz);
      scene.add(b);
      const fl = b.getObjectByName('brazierFlame');
      if (fl) brazierFlames.push(fl);
    }

    const activeBrazierLights: THREE.PointLight[] = [
      new THREE.PointLight(0xff6b24, 9, 22, 1.8),
      new THREE.PointLight(0xff5218, 9, 22, 1.8),
      new THREE.PointLight(0xff4a1a, 10, 24, 1.8),
      new THREE.PointLight(0xd92b24, 11, 26, 1.8),
    ];
    activeBrazierLights[0].position.set(0, 3.2, 6);
    activeBrazierLights[1].position.set(0, 3.2, -26);
    activeBrazierLights[2].position.set(0, 6.2, -66);
    activeBrazierLights[3].position.set(0, 7.6, -133);
    activeBrazierLights.forEach((l) => scene.add(l));

    // Lore Shrines
    const shrineMeshes = new Map<string, THREE.Group>();
    const usedShrines = new Set<string>();
    for (const s of LORE_SHRINES) {
      const m = createLoreShrineMesh(textures.metalBump);
      m.position.set(s.x, s.y, s.z);
      scene.add(m);
      shrineMeshes.set(s.id, m);
    }

    // Rune Gates
    const gateMeshes = new Map<string, THREE.Group>();
    const gateOpenedState = new Map<string, boolean>();
    for (const g of RUNE_GATES) {
      const m = createRuneGateMesh(g.width, g.height);
      m.position.set(g.x, g.y, g.z);
      scene.add(m);
      gateMeshes.set(g.id, m);
      gateOpenedState.set(g.id, false);
    }

    // Flame Hazards visual vents
    const hazardMeshes: Array<{
      data: (typeof FLAME_HAZARDS)[number];
      ring: THREE.Mesh;
      pillar: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
    }> = [];
    const hazRingGeo = new THREE.RingGeometry(0.4, 1.0, 24);
    hazRingGeo.rotateX(-Math.PI / 2);
    const hazPillarGeo = new THREE.CylinderGeometry(0.55, 0.85, 4.2, 12, 1, true);
    disposables.push(hazRingGeo, hazPillarGeo);
    for (const h of FLAME_HAZARDS) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff4e16,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(hazRingGeo, ringMat);
      ring.position.set(h.x, h.y + 0.03, h.z);
      ring.scale.setScalar(h.radius);
      scene.add(ring);

      const pilMat = new THREE.MeshBasicMaterial({
        color: 0xff621a,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pillar = new THREE.Mesh(hazPillarGeo, pilMat);
      pillar.position.set(h.x, h.y + 2.1, h.z);
      pillar.scale.set(h.radius * 0.65, 1, h.radius * 0.65);
      pillar.visible = false;
      scene.add(pillar);
      disposables.push(ringMat, pilMat);
      hazardMeshes.push({ data: h, ring, pillar, mat: pilMat });
    }

    // Pooled Ember Bolts (for Cinder Acolytes)
    const emberBolts: EmberBolt[] = [];
    const boltGeo = new THREE.SphereGeometry(0.24, 10, 10);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xff7722 });
    disposables.push(boltGeo, boltMat);
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.visible = false;
      scene.add(mesh);
      emberBolts.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        mesh,
      });
    }

    // 6. Hero & Enemy Rigs
    const heroRig = createHeroRig(
      textures.contactShadow,
      textures.slashArc,
      textures.metalBump,
    );
    scene.add(heroRig.root);

    let enemies: EnemySim[] = [];
    const enemyRigs = new Map<string, CharacterRig>();

    function rebuildEnemiesForWorld() {
      for (const rig of enemyRigs.values()) {
        scene.remove(rig.root);
      }
      enemyRigs.clear();
      enemies = ENEMY_SPAWNS.map(createEnemyFromSpawn);
      for (const e of enemies) {
        const rig = createEnemyRig(e.archetype, textures.contactShadow, textures.metalBump);
        scene.add(rig.root);
        enemyRigs.set(e.id, rig);
      }
    }
    rebuildEnemiesForWorld();

    // 7. Mutable Game Simulation State
    let screen: GameScreenState = initialAutostart ? 'playing' : 'title';
    let outcome: GameOutcome = null;
    let currentChapter: ChapterIndex = 0;
    let highestChapter: ChapterIndex = 0;
    try {
      const saved = Number(localStorage.getItem('ashen_oath_highest_ch') || '0');
      if (saved === 1 || saved === 2) highestChapter = saved;
    } catch {
      // ignore storage errors
    }

    let player: PlayerSim = createInitialPlayer(CHAPTERS[0].spawnPos, CHAPTERS[0].spawnYaw);
    let comboCount = 0;
    let comboTimer = 0;
    let kills = 0;
    let executions = 0;
    let parries = 0;
    let elapsedSeconds = 0;
    let hitstopTimer = 0;
    let trauma = 0;
    let parryFlashTimer = 0;
    let lockedEnemyId: string | null = null;
    let activeStoryBeat: StoryBeat | null = null;
    let chapterBannerText: string | null = null;
    let chapterBannerTimer = 0;
    let deathBeatTimer = 0;

    let camYaw = 0;
    let camPitch = 0.34;
    const camCurrentPos = new THREE.Vector3(0, 4.5, 22);
    const camCurrentLook = new THREE.Vector3(0, 1.5, 10);

    document.body.dataset.state = screen;

    function triggerStoryBeat(title: string, speaker: string, text: string, duration = 6.0) {
      activeStoryBeat = { title, speaker, text, timer: duration };
    }

    function showChapterBanner(chapterIdx: ChapterIndex) {
      const meta = CHAPTERS[chapterIdx];
      chapterBannerText = `Chapter ${meta.numeral} — ${meta.title}`;
      chapterBannerTimer = 3.8;
      triggerStoryBeat(meta.title, meta.subtitle, meta.introLine, 5.5);
    }

    function resetToChapter(chapterIdx: ChapterIndex) {
      currentChapter = chapterIdx;
      const meta = CHAPTERS[chapterIdx];
      player = createInitialPlayer(meta.spawnPos, meta.spawnYaw);
      rebuildEnemiesForWorld();
      // Mark earlier chapter enemies as defeated so earlier gates are open
      for (const e of enemies) {
        if (e.chapter < chapterIdx) {
          e.hp = 0;
          e.state = 'ko';
          const rig = enemyRigs.get(e.id);
          if (rig) rig.root.visible = false;
        }
      }
      for (const g of RUNE_GATES) {
        const opened = isGateOpen(g, enemies);
        gateOpenedState.set(g.id, opened);
        const mesh = gateMeshes.get(g.id);
        const seal = mesh?.getObjectByName('gateSeal');
        if (seal) seal.visible = !opened;
      }
      for (const b of emberBolts) {
        b.active = false;
        b.mesh.visible = false;
      }
      effects.clearDecals();
      usedShrines.clear();
      comboCount = 0;
      comboTimer = 0;
      kills = 0;
      executions = 0;
      parries = 0;
      elapsedSeconds = 0;
      hitstopTimer = 0;
      trauma = 0;
      outcome = null;
      deathBeatTimer = 0;
      lockedEnemyId = null;
      camYaw = meta.spawnYaw;
      camPitch = 0.34;
      camCurrentPos.set(player.x, player.y + 4.0, player.z + 8.5);
      camCurrentLook.set(player.x, player.y + 1.4, player.z - 2.0);
    }

    // 8. Unified Input Hub (Edge triggers + Held keys + Mouse Drag vs Click)
    const keysHeld = new Set<string>();
    const justPressed = new Set<string>();
    const justReleased = new Set<string>();

    function clearAllInputs() {
      keysHeld.clear();
      justPressed.clear();
      justReleased.clear();
    }

    let hudEmitTimer = 0;
    function emitHudSnapshot(force = false) {
      if (!force && hudEmitTimer < 0.085) return;
      hudEmitTimer = 0;

      const locked = lockedEnemyId
        ? enemies.find((e) => e.id === lockedEnemyId && e.state !== 'ko' && e.hp > 0) || null
        : null;
      if (lockedEnemyId && !locked) lockedEnemyId = null;

      const boss = enemies.find((e) => e.archetype === 'boss');
      const bossActive = Boolean(
        boss && boss.state !== 'ko' && boss.hp > 0 && (currentChapter === 2 || player.z < -105),
      );

      const execTarget = findBestExecutionTarget(player, enemies);
      let interactTitle: string | null = null;
      if (!execTarget) {
        for (const s of LORE_SHRINES) {
          if (Math.hypot(player.x - s.x, player.z - s.z) < 3.0 && Math.abs(player.y - s.y) < 2.2) {
            interactTitle = usedShrines.has(s.id) ? `${s.title} (Read)` : `${s.title}`;
            break;
          }
        }
      }

      hudCallbackRef.current({
        screen,
        outcome,
        chapter: currentChapter,
        highestChapter,
        hp: Math.round(player.hp),
        maxHp: player.maxHp,
        stamina: Math.round(player.stamina),
        maxStamina: player.maxStamina,
        vials: player.vials,
        maxVials: player.maxVials,
        comboCount,
        comboTimer,
        kills,
        executions,
        parries,
        elapsedSeconds: Math.round(elapsedSeconds),
        lockedTargetName: locked ? locked.name : null,
        lockedTargetHp: locked ? Math.round(locked.hp) : 0,
        lockedTargetMaxHp: locked ? locked.maxHp : 1,
        lockedTargetPosture: locked ? Math.round(locked.posture) : 0,
        lockedTargetMaxPosture: locked ? locked.maxPosture : 1,
        bossActive,
        bossName: boss ? boss.name : 'Malakor',
        bossHp: boss ? Math.round(boss.hp) : 0,
        bossMaxHp: boss ? boss.maxHp : 1,
        bossPosture: boss ? Math.round(boss.posture) : 0,
        bossMaxPosture: boss ? boss.maxPosture : 1,
        bossPhase: boss ? boss.phase : 1,
        canExecuteName: execTarget ? execTarget.name : null,
        canInteractTitle: interactTitle,
        storyBeat: activeStoryBeat ? { ...activeStoryBeat } : null,
        chapterBanner: chapterBannerTimer > 0 ? chapterBannerText : null,
        muted: audioEngine.muted,
        parryFlash: parryFlashTimer > 0,
      });
    }

    function setScreenState(next: GameScreenState) {
      screen = next;
      document.body.dataset.state = next;
      audioEngine.setAmbientActive(next === 'playing');
      if (next !== 'playing') {
        clearAllInputs();
      }
      emitHudSnapshot(true);
    }

    // Public controller bindings
    controllerRef.current = {
      startCampaign(chapter: ChapterIndex = 0) {
        audioEngine.unlock();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        resetToChapter(chapter);
        setScreenState('playing');
        showChapterBanner(chapter);
      },
      resumeGame() {
        audioEngine.unlock();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setScreenState('playing');
      },
      pauseGame() {
        if (screen === 'playing') {
          setScreenState('paused');
        }
      },
      restartChapter() {
        audioEngine.unlock();
        resetToChapter(currentChapter);
        setScreenState('playing');
        showChapterBanner(currentChapter);
      },
      returnToTitle() {
        resetToChapter(0);
        setScreenState('title');
      },
      toggleMute() {
        audioEngine.unlock();
        audioEngine.setMuted(!audioEngine.muted);
        emitHudSnapshot(true);
      },
      toggleLockOn() {
        toggleLockOnInternal();
      },
    };

    if (initialAutostart) {
      showChapterBanner(0);
    }
    emitHudSnapshot(true);

    function toggleLockOnInternal() {
      if (lockedEnemyId) {
        lockedEnemyId = null;
        emitHudSnapshot(true);
        return;
      }
      let bestId: string | null = null;
      let bestDist = 24;
      for (const e of enemies) {
        if (e.state === 'ko' || e.hp <= 0) continue;
        const d = Math.hypot(e.x - player.x, e.z - player.z);
        if (d < bestDist) {
          bestDist = d;
          bestId = e.id;
        }
      }
      lockedEnemyId = bestId;
      emitHudSnapshot(true);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'Space' || code === 'Tab' || code.startsWith('Arrow')) {
        e.preventDefault();
      }
      if (screen === 'title') {
        if (code === 'Enter' || code === 'Space') {
          controllerRef.current?.startCampaign(0);
        }
        return;
      }
      if (code === 'Escape' || code === 'KeyP') {
        if (screen === 'playing') {
          setScreenState('paused');
        } else if (screen === 'paused') {
          setScreenState('playing');
        }
        return;
      }
      if (code === 'KeyM') {
        audioEngine.unlock();
        audioEngine.setMuted(!audioEngine.muted);
        emitHudSnapshot(true);
        return;
      }
      if (screen !== 'playing') return;

      if (!keysHeld.has(code)) {
        justPressed.add(code);
      }
      keysHeld.add(code);

      if (code === 'Tab') {
        toggleLockOnInternal();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (keysHeld.has(code)) {
        justReleased.add(code);
      }
      keysHeld.delete(code);
    };

    let pointerDownPos: { x: number; y: number; button: number; time: number } | null = null;
    let isDraggingCam = false;

    const onPointerDown = (e: PointerEvent) => {
      if (screen !== 'playing') return;
      audioEngine.unlock();
      pointerDownPos = { x: e.clientX, y: e.clientY, button: e.button, time: performance.now() };
      isDraggingCam = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (screen !== 'playing' || !pointerDownPos) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) {
        isDraggingCam = true;
      }
      if (isDraggingCam) {
        camYaw -= e.movementX * 0.0055;
        camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.004, 0.14, 0.95);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (screen !== 'playing') {
        pointerDownPos = null;
        return;
      }
      if (!isDraggingCam && pointerDownPos) {
        if (e.button === 0) {
          justPressed.add('KeyJ');
        } else if (e.button === 2) {
          justPressed.add('KeyK');
        }
      }
      pointerDownPos = null;
      isDraggingCam = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWindowBlur = () => {
      clearAllInputs();
    };

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    // 9. Gameplay Helper Functions
    function startPlayerAttack(kind: AttackKind) {
      const spec = ATTACK_SPECS[kind];
      if (kind !== 'execute' && player.stamina < spec.staminaCost * 0.4) return;
      player.stamina = Math.max(0, player.stamina - spec.staminaCost);
      player.attackKind = kind;
      player.attackTimer = 0;
      player.attackHitIds.clear();
      player.comboQueue = false;
      audioEngine.playSwing(kind === 'heavy' || kind === 'light3' || kind === 'execute');

      // Soft auto-aim toward closest nearby enemy within 4.5m if not holding direction
      let targetEnemy: EnemySim | null = null;
      if (lockedEnemyId) {
        targetEnemy = enemies.find((e) => e.id === lockedEnemyId && e.state !== 'ko') || null;
      }
      if (!targetEnemy) {
        let minDist = 4.6;
        for (const e of enemies) {
          if (e.state === 'ko' || e.hp <= 0) continue;
          const d = Math.hypot(e.x - player.x, e.z - player.z);
          if (d < minDist) {
            minDist = d;
            targetEnemy = e;
          }
        }
      }
      if (targetEnemy) {
        player.yaw = yawFromDir(targetEnemy.x - player.x, targetEnemy.z - player.z);
      }
    }

    function damagePlayer(rawDamage: number, attackerX: number, attackerZ: number, attacker?: EnemySim) {
      if (attacker) {
        const res = resolveIncomingPlayerHit(player, attacker, rawDamage);
        if (res.outcome === 'invuln') return;
        if (res.outcome === 'parried') {
          parries++;
          parryFlashTimer = 0.25;
          hitstopTimer = 0.075;
          trauma = Math.min(1, trauma + 0.35);
          audioEngine.playParry();
          effects.spawnBurst(player.x, player.y + 1.2, player.z, 18, 'spark');
          attacker.posture = Math.min(
            attacker.maxPosture,
            attacker.posture + res.attackerPostureDamage,
          );
          if (res.attackerStaggered) {
            attacker.state = 'staggered';
            attacker.stateTimer = 2.8;
          } else {
            attacker.state = 'recover';
            attacker.stateTimer = 0.7;
          }
          emitHudSnapshot(true);
          return;
        }
      } else if (player.invulnTimer > 0 || player.dashTimer > 0 || player.executingTargetId) {
        return;
      }

      player.hp = Math.max(0, player.hp - rawDamage);
      player.invulnTimer = 0.55;
      player.hitFlashTimer = 0.14;
      player.attackKind = null;
      hitstopTimer = 0.045;
      trauma = Math.min(1, trauma + 0.55);
      audioEngine.playHurt();

      const dx = player.x - attackerX;
      const dz = player.z - attackerZ;
      const len = Math.hypot(dx, dz) || 1;
      player.vx = (dx / len) * 6.5;
      player.vz = (dz / len) * 6.5;
      effects.spawnBurst(player.x, player.y + 1.1, player.z, 14, 'blood', dx / len, dz / len);

      if (player.hp <= 0 && !outcome) {
        outcome = 'defeat';
        deathBeatTimer = 0.65;
      }
      emitHudSnapshot(true);
    }

    function spawnEmberBolt(from: EnemySim) {
      const bolt = emberBolts.find((b) => !b.active);
      if (!bolt) return;
      const dx = player.x - from.x;
      const dy = player.y + 1.0 - (from.y + 1.3);
      const dz = player.z - from.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = 13.5;
      bolt.active = true;
      bolt.x = from.x;
      bolt.y = from.y + 1.3;
      bolt.z = from.z;
      bolt.vx = (dx / len) * speed;
      bolt.vy = (dy / len) * speed;
      bolt.vz = (dz / len) * speed;
      bolt.life = 2.6;
      bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
      bolt.mesh.visible = true;
    }

    // 10. Pre-warm GPU shaders once (skip on software WebGL)
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Main Simulation + Render Loop
    let frameId = 0;
    let lastTime = performance.now();
    let totalTime = 0;
    let disposed = false;

    function stepSimulation(dt: number) {
      totalTime += dt;
      hudEmitTimer += dt;
      if (parryFlashTimer > 0) parryFlashTimer = Math.max(0, parryFlashTimer - dt);
      if (chapterBannerTimer > 0) chapterBannerTimer = Math.max(0, chapterBannerTimer - dt);
      if (activeStoryBeat) {
        activeStoryBeat.timer -= dt;
        if (activeStoryBeat.timer <= 0) activeStoryBeat = null;
      }

      // Title Mode Live Camera Tour (frames kneeling warrior on right two-thirds, calm negative space on left)
      if (screen === 'title') {
        const sway = Math.sin(totalTime * 0.35);
        camera.position.set(
          3.4 + sway * 1.1,
          2.25 + Math.cos(totalTime * 0.4) * 0.18,
          13.6 + Math.cos(totalTime * 0.3) * 0.6,
        );
        camera.lookAt(-1.4, 1.35, 5.5);
        animateHeroRig(heroRig, player, totalTime, true);
        for (const e of enemies) {
          const rig = enemyRigs.get(e.id);
          if (rig) animateEnemyRig(rig, e, totalTime);
        }
        for (const fl of brazierFlames) {
          fl.scale.y = 0.85 + Math.sin(totalTime * 11 + fl.position.x) * 0.22;
        }
        if (Math.random() < dt * 8) {
          effects.spawnBurst(-4.6, 1.4, 11, 1, 'ember');
          effects.spawnBurst(4.6, 1.4, 11, 1, 'ember');
        }
        effects.update(dt);
        return;
      }

      if (screen !== 'playing') {
        justPressed.clear();
        justReleased.clear();
        return;
      }

      // Defeat beat delay before showing Game Over modal
      if (outcome === 'defeat') {
        deathBeatTimer -= dt;
        effects.update(dt);
        if (deathBeatTimer <= 0) {
          setScreenState('gameover');
        }
        return;
      }

      if (outcome === 'victory') {
        deathBeatTimer -= dt;
        effects.update(dt);
        if (deathBeatTimer <= 0) {
          setScreenState('gameover');
        }
        return;
      }

      elapsedSeconds += dt;

      // Decay trauma, squash/stretch, flashes
      trauma = Math.max(0, trauma - dt * 1.9);
      player.squashX = THREE.MathUtils.damp(player.squashX, 1, 14, dt);
      player.squashY = THREE.MathUtils.damp(player.squashY, 1, 14, dt);
      if (player.hitFlashTimer > 0) player.hitFlashTimer -= dt;
      if (player.healFlashTimer > 0) player.healFlashTimer -= dt;
      if (player.invulnTimer > 0) player.invulnTimer -= dt;
      if (player.dashCooldown > 0) player.dashCooldown -= dt;
      if (player.parryCooldown > 0) player.parryCooldown -= dt;
      if (player.parryTimer > 0) player.parryTimer -= dt;

      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) comboCount = 0;
      }

      // Hitstop freezes combat/physics motion while keeping flashes & shake alive
      if (hitstopTimer > 0) {
        hitstopTimer -= dt;
        effects.update(dt * 0.35);
        justPressed.clear();
        justReleased.clear();
        return;
      }

      // Camera manual yaw orbit keys
      if (keysHeld.has('KeyQ')) camYaw += 2.2 * dt;
      if (keysHeld.has('KeyC')) camYaw -= 2.2 * dt;

      // Regenerate stamina when idle or moving
      if (!player.attackKind && player.dashTimer <= 0) {
        player.stamina = Math.min(player.maxStamina, player.stamina + 28 * dt);
      }

      // Check execution sequence
      if (player.executingTargetId) {
        player.executeTimer -= dt;
        if (player.executeTimer <= 0) {
          const target = enemies.find((e) => e.id === player.executingTargetId);
          player.executingTargetId = null;
          player.attackKind = null;
          if (target) {
            if (target.archetype === 'boss') {
              target.hp = Math.max(0, target.hp - 180);
              target.posture = 0;
              target.state = target.hp <= 0 ? 'ko' : 'recover';
              target.stateTimer = 0.8;
            } else {
              target.hp = 0;
              target.state = 'ko';
            }
            if (target.hp <= 0) {
              kills++;
              target.koTimer = 0;
              if (target.archetype === 'boss') {
                outcome = 'victory';
                deathBeatTimer = 0.75;
              }
            }
            executions++;
            player.hp = Math.min(player.maxHp, player.hp + 18);
            player.healFlashTimer = 0.3;
            hitstopTimer = 0.11;
            trauma = Math.min(1, trauma + 0.8);
            audioEngine.playExecute();
            effects.spawnBurst(target.x, target.y + 1.1, target.z, 26, 'blood');
            effects.spawnBurst(target.x, target.y + 1.1, target.z, 12, 'shard');
            effects.spawnBloodDecal(target.x, target.y, target.z, 1.5);
            emitHudSnapshot(true);
          }
        }
      }

      // Process Player Actions (only if not mid-execution)
      if (!player.executingTargetId) {
        // Movement intent relative to camera yaw
        let moveInX = 0;
        let moveInZ = 0;
        if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) moveInZ -= 1;
        if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) moveInZ += 1;
        if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) moveInX -= 1;
        if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) moveInX += 1;

        const hasMove = moveInX !== 0 || moveInZ !== 0;
        let worldDirX = 0;
        let worldDirZ = 0;
        if (hasMove) {
          const len = Math.hypot(moveInX, moveInZ);
          const nx = moveInX / len;
          const nz = moveInZ / len;
          const c = Math.cos(camYaw);
          const s = Math.sin(camYaw);
          worldDirX = nx * c + nz * s;
          worldDirZ = -nx * s + nz * c;
        }

        // Jump buffer & Coyote time
        if (justPressed.has('Space')) {
          player.jumpBufferTimer = JUMP_BUFFER_TIME;
        } else if (player.jumpBufferTimer > 0) {
          player.jumpBufferTimer -= dt;
        }

        if (player.grounded) {
          player.coyoteTimer = COYOTE_TIME;
          player.jumpsRemaining = 2;
        } else if (player.coyoteTimer > 0) {
          player.coyoteTimer -= dt;
        }

        // Variable jump cut
        if (justReleased.has('Space') && player.vy > 3.0) {
          player.vy *= 0.45;
        }

        // Execute Jump / Double Jump
        if (player.jumpBufferTimer > 0) {
          if (player.coyoteTimer > 0) {
            player.vy = PLAYER_JUMP_SPEED;
            player.grounded = false;
            player.coyoteTimer = 0;
            player.jumpBufferTimer = 0;
            player.jumpsRemaining = 1;
            player.squashX = 0.84;
            player.squashY = 1.2;
            audioEngine.playJump(false);
            effects.spawnBurst(player.x, player.y + 0.1, player.z, 5, 'ash');
          } else if (player.jumpsRemaining > 0) {
            player.vy = PLAYER_DOUBLE_JUMP_SPEED;
            player.jumpBufferTimer = 0;
            player.jumpsRemaining = 0;
            player.squashX = 0.85;
            player.squashY = 1.18;
            audioEngine.playJump(true);
            effects.spawnBurst(player.x, player.y + 0.1, player.z, 6, 'ember');
          }
        }

        // Crimson Vial Heal [R]
        if (justPressed.has('KeyR') && player.vials > 0 && player.hp < player.maxHp) {
          player.vials--;
          player.hp = Math.min(player.maxHp, player.hp + 42);
          player.healFlashTimer = 0.35;
          audioEngine.playShrine();
          effects.spawnBurst(player.x, player.y + 1.0, player.z, 12, 'ember');
          emitHudSnapshot(true);
        }

        // Execute [E] or Shrine Commune [E]
        if (justPressed.has('KeyE')) {
          const execTarget = findBestExecutionTarget(player, enemies);
          if (execTarget) {
            player.executingTargetId = execTarget.id;
            player.executeTimer = 0.28;
            player.attackKind = 'execute';
            player.attackTimer = 0;
            player.invulnTimer = 0.5;
            player.yaw = yawFromDir(execTarget.x - player.x, execTarget.z - player.z);
            audioEngine.playSwing(true);
          } else {
            for (const s of LORE_SHRINES) {
              if (
                Math.hypot(player.x - s.x, player.z - s.z) < 3.0 &&
                Math.abs(player.y - s.y) < 2.2
              ) {
                if (s.grantsVial && !usedShrines.has(s.id)) {
                  usedShrines.add(s.id);
                  player.vials = Math.min(player.maxVials, player.vials + 1);
                  player.hp = Math.min(player.maxHp, player.hp + 30);
                  player.healFlashTimer = 0.35;
                  effects.spawnBurst(s.x, s.y + 1.4, s.z, 14, 'ember');
                }
                audioEngine.playShrine();
                triggerStoryBeat(s.title, s.speaker, s.lines[0], 6.5);
                emitHudSnapshot(true);
                break;
              }
            }
          }
        }

        // Shadow Dash [Shift] (cancels attack recovery too!)
        if (
          (justPressed.has('ShiftLeft') || justPressed.has('ShiftRight')) &&
          player.dashCooldown <= 0 &&
          player.stamina >= 16
        ) {
          player.stamina -= 16;
          player.dashTimer = PLAYER_DASH_DURATION;
          player.dashCooldown = PLAYER_DASH_COOLDOWN;
          player.invulnTimer = PLAYER_DASH_DURATION + 0.08;
          player.attackKind = null;
          if (hasMove) {
            player.dashDirX = worldDirX;
            player.dashDirZ = worldDirZ;
            player.yaw = yawFromDir(worldDirX, worldDirZ);
          } else {
            const fwd = forwardFromYaw(player.yaw);
            player.dashDirX = fwd.x;
            player.dashDirZ = fwd.z;
          }
          audioEngine.playDash();
          effects.spawnBurst(player.x, player.y + 0.5, player.z, 8, 'ash');
        }

        // Timed Parry [F]
        if (justPressed.has('KeyF') && player.parryCooldown <= 0 && player.dashTimer <= 0) {
          player.parryTimer = PARRY_WINDOW;
          player.parryCooldown = PARRY_COOLDOWN;
          player.attackKind = null;
          audioEngine.playSwing(false);
        }

        // Light & Heavy Melee Attacks [J / K]
        if (player.dashTimer <= 0 && player.parryTimer <= 0) {
          if (justPressed.has('KeyJ')) {
            if (!player.attackKind) {
              startPlayerAttack('light1');
            } else if (
              player.attackKind === 'light1' ||
              player.attackKind === 'light2'
            ) {
              player.comboQueue = true;
            }
          } else if (justPressed.has('KeyK')) {
            if (!player.attackKind || getAttackPhase(player.attackKind, player.attackTimer) === 'recovery') {
              startPlayerAttack('heavy');
            }
          }
        }

        // Advance Active Attack
        if (player.attackKind) {
          const spec = ATTACK_SPECS[player.attackKind];
          player.attackTimer += dt;
          const phase = getAttackPhase(player.attackKind, player.attackTimer);

          if (phase === 'active') {
            const fwd = forwardFromYaw(player.yaw);
            player.vx = fwd.x * spec.lungeSpeed;
            player.vz = fwd.z * spec.lungeSpeed;

            // Evaluate melee hits once per enemy per swing
            for (const e of enemies) {
              if (player.attackHitIds.has(e.id)) continue;
              const hit = evaluateMeleeHitOnEnemy(player, e, spec);
              if (!hit.inReach) continue;

              player.attackHitIds.add(e.id);
              if (hit.blockedByShield) {
                audioEngine.playShieldClang();
                effects.spawnBurst(e.x, e.y + 1.2, e.z, 9, 'spark');
                e.hasBlockedRecently = 0.4;
              } else {
                const isHeavy = player.attackKind === 'heavy' || player.attackKind === 'light3';
                audioEngine.playHit(isHeavy);
                effects.spawnBurst(e.x, e.y + 1.15, e.z, isHeavy ? 18 : 11, 'blood', fwd.x, fwd.z);
                effects.spawnBloodDecal(e.x, e.y, e.z, isHeavy ? 1.15 : 0.85);
                if (isHeavy) effects.spawnBurst(e.x, e.y + 1.1, e.z, 6, 'spark');
              }

              e.hp = Math.max(0, e.hp - hit.damageDealt);
              e.posture = Math.min(e.maxPosture, e.posture + hit.postureDealt);
              e.hitFlashTimer = 0.08;
              e.squashX = 1.2;
              e.squashY = 0.82;
              comboCount++;
              comboTimer = 3.2;
              hitstopTimer = hit.blockedByShield ? 0.025 : spec.hitstop;
              trauma = Math.min(1, trauma + (spec.hitstop > 0.05 ? 0.36 : 0.16));

              // Knockback
              const dx = e.x - player.x;
              const dz = e.z - player.z;
              const dist = Math.hypot(dx, dz) || 1;
              const kbScale = e.archetype === 'boss' ? 0.25 : 1.0;
              e.vx = (dx / dist) * spec.knockback * kbScale;
              e.vz = (dz / dist) * spec.knockback * kbScale;

              // Boss Phase 2 transition at 50% HP
              if (e.archetype === 'boss' && e.phase === 1 && e.hp <= e.maxHp * 0.5 && e.hp > 0) {
                e.phase = 2;
                trauma = Math.min(1, trauma + 0.65);
                effects.spawnBurst(e.x, e.y + 1.5, e.z, 26, 'ember');
                triggerStoryBeat(
                  'Molten Awakening',
                  'Malakor, Iron Prelate',
                  'Enough! Let the cinders consume your oath!',
                  4.5,
                );
              }

              if (hit.triggeredKo) {
                e.state = 'ko';
                e.koTimer = 0;
                kills++;
                if (e.archetype === 'boss') {
                  outcome = 'victory';
                  deathBeatTimer = 0.75;
                }
              } else if (hit.triggeredStagger) {
                e.state = 'staggered';
                e.stateTimer = 2.8;
                effects.spawnBurst(e.x, e.y + 1.4, e.z, 12, 'spark');
              }
              emitHudSnapshot(true);
            }
          } else {
            player.vx *= 0.84;
            player.vz *= 0.84;
          }

          if (phase === 'recovery' && player.comboQueue) {
            if (player.attackKind === 'light1') startPlayerAttack('light2');
            else if (player.attackKind === 'light2') startPlayerAttack('light3');
          } else if (player.attackTimer >= getAttackDuration(player.attackKind)) {
            player.attackKind = null;
          }
        }

        // Standard Movement & Dash Velocity
        if (player.dashTimer > 0) {
          player.dashTimer -= dt;
          player.vx = player.dashDirX * PLAYER_DASH_SPEED;
          player.vz = player.dashDirZ * PLAYER_DASH_SPEED;
        } else if (!player.attackKind) {
          const targetVx = hasMove ? worldDirX * PLAYER_MOVE_SPEED : 0;
          const targetVz = hasMove ? worldDirZ * PLAYER_MOVE_SPEED : 0;
          const accel = player.grounded ? 18 : 9;
          player.vx = THREE.MathUtils.damp(player.vx, targetVx, accel, dt);
          player.vz = THREE.MathUtils.damp(player.vz, targetVz, accel, dt);
          if (hasMove) {
            const targetYaw = yawFromDir(worldDirX, worldDirZ);
            player.yaw = lerpAngle(player.yaw, targetYaw, Math.min(1, dt * 14));
          }
        }
      }

      // Gravity & Platform Resolution
      const prevY = player.y;
      const wasGrounded = player.grounded;
      player.vy -= GRAVITY * dt;
      const nextX = player.x + player.vx * dt;
      const nextY = player.y + player.vy * dt;
      const nextZ = player.z + player.vz * dt;

      const closedGates = getClosedGates(RUNE_GATES, enemies);
      const resolved = resolveActorPlatforms(
        nextX,
        nextY,
        nextZ,
        prevY,
        player.vy,
        PLAYER_RADIUS,
        PLATFORMS,
        closedGates,
      );

      player.x = resolved.x;
      player.y = resolved.y;
      player.z = resolved.z;
      player.vy = resolved.vy;
      player.grounded = resolved.grounded;

      if (player.grounded) {
        player.walkDistance += Math.hypot(player.vx, player.vz) * dt;
        if (!wasGrounded) {
          player.squashX = 1.22;
          player.squashY = 0.78;
          effects.spawnBurst(player.x, player.y + 0.08, player.z, 5, 'ash');
        }
        // Record safe platform position away from edges
        if (resolved.landedPlatform) {
          const p = resolved.landedPlatform;
          if (
            Math.abs(player.x - p.x) < p.width * 0.4 &&
            Math.abs(player.z - p.z) < p.depth * 0.4
          ) {
            player.safeX = player.x;
            player.safeY = player.y;
            player.safeZ = player.z;
          }
        }
      }

      // Abyss Fall Recovery
      if (player.y < -12) {
        damagePlayer(20, player.x, player.z);
        if (player.hp > 0) {
          player.x = player.safeX;
          player.y = player.safeY + 1.0;
          player.z = player.safeZ;
          player.vx = 0;
          player.vy = 0;
          player.vz = 0;
        }
      }

      // Check Chapter Transitions & Gate Shatter Events
      const newChap = getChapterForZ(player.z);
      if (newChap !== currentChapter) {
        currentChapter = newChap;
        if (currentChapter > highestChapter) {
          highestChapter = currentChapter;
          try {
            localStorage.setItem('ashen_oath_highest_ch', String(highestChapter));
          } catch {
            // ignore
          }
        }
        showChapterBanner(currentChapter);
      }

      for (const gate of RUNE_GATES) {
        const openNow = isGateOpen(gate, enemies);
        if (openNow && !gateOpenedState.get(gate.id)) {
          gateOpenedState.set(gate.id, true);
          const mesh = gateMeshes.get(gate.id);
          const seal = mesh?.getObjectByName('gateSeal');
          if (seal) seal.visible = false;
          audioEngine.playGateShatter();
          effects.spawnBurst(gate.x, gate.y + 2.5, gate.z, 24, 'ember');
          trauma = Math.min(1, trauma + 0.45);
          triggerStoryBeat(
            'Rune Seal Shattered',
            'Path Unsealed',
            'The obsidian barrier breaks. Advance deeper into the Keep.',
            4.5,
          );
          emitHudSnapshot(true);
        }
      }

      // Flame Hazards Update & Damage
      for (const h of hazardMeshes) {
        const cycle = (totalTime + h.data.phaseOffset) % h.data.period;
        const erupting = cycle > h.data.period * 0.52 && cycle < h.data.period * 0.85;
        const warning = cycle > h.data.period * 0.3 && !erupting;
        h.pillar.visible = erupting;
        h.ring.scale.setScalar(
          h.data.radius * (warning ? 0.95 + Math.sin(totalTime * 22) * 0.08 : 1.0),
        );
        if (erupting) {
          const d = Math.hypot(player.x - h.data.x, player.z - h.data.z);
          if (d < h.data.radius && Math.abs(player.y - h.data.y) < 3.2) {
            damagePlayer(18, h.data.x, h.data.z);
          }
        }
      }

      // Enemy AI Update (3+ Distinct Archetype Policies + Boss + Token Pool)
      for (const e of enemies) {
        const rig = enemyRigs.get(e.id);
        if (!rig) continue;

        if (e.state === 'ko') {
          e.koTimer += dt;
          animateEnemyRig(rig, e, totalTime);
          if (e.koTimer > 1.0) rig.root.visible = false;
          continue;
        }

        e.squashX = THREE.MathUtils.damp(e.squashX, 1, 12, dt);
        e.squashY = THREE.MathUtils.damp(e.squashY, 1, 12, dt);
        if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
        if (e.attackCooldown > 0) e.attackCooldown -= dt;
        if (e.hasBlockedRecently > 0) e.hasBlockedRecently -= dt;

        // Recover posture slowly when not staggered
        if (e.state !== 'staggered' && e.posture > 0) {
          e.posture = Math.max(0, e.posture - 5.5 * dt);
        }

        const dx = player.x - e.x;
        const dz = player.z - e.z;
        const dist = Math.hypot(dx, dz);
        const aggroRange = e.archetype === 'boss' ? 24 : 18;

        if (e.state === 'staggered') {
          e.stateTimer -= dt;
          e.vx *= 0.85;
          e.vz *= 0.85;
          if (e.stateTimer <= 0) {
            e.state = 'pursue';
            e.posture = e.maxPosture * 0.35;
          }
        } else if (e.state === 'windup') {
          e.stateTimer -= dt;
          e.vx *= 0.82;
          e.vz *= 0.82;
          e.yaw = lerpAngle(e.yaw, yawFromDir(dx, dz), Math.min(1, dt * 8));
          if (e.stateTimer <= 0) {
            e.state = 'attack';
            e.stateTimer = e.archetype === 'boss' ? 0.24 : 0.18;
            if (e.archetype === 'acolyte') {
              spawnEmberBolt(e);
              audioEngine.playSwing(false);
            } else {
              // Lunge forward slightly on melee strike
              const fwd = forwardFromYaw(e.yaw);
              const lunge = e.archetype === 'boss' ? 9.5 : 6.0;
              e.vx = fwd.x * lunge;
              e.vz = fwd.z * lunge;
              audioEngine.playSwing(e.archetype !== 'thrall');

              const reach =
                e.archetype === 'boss' ? 3.8 : e.archetype === 'halberdier' ? 2.75 : 2.1;
              if (dist <= reach + PLAYER_RADIUS && Math.abs(player.y - e.y) < 2.2) {
                const dmg =
                  e.archetype === 'boss'
                    ? e.phase === 2
                      ? 30
                      : 24
                    : e.archetype === 'halberdier'
                      ? 22
                      : 14;
                damagePlayer(dmg, e.x, e.z, e);
                if (e.archetype === 'boss') {
                  effects.spawnBurst(e.x + fwd.x * 1.5, e.y + 0.3, e.z + fwd.z * 1.5, 16, 'ember');
                }
              }
            }
          }
        } else if (e.state === 'attack') {
          e.stateTimer -= dt;
          e.vx *= 0.88;
          e.vz *= 0.88;
          if (e.stateTimer <= 0) {
            e.state = 'recover';
            e.stateTimer = e.archetype === 'boss' && e.phase === 2 ? 0.55 : 0.85;
            e.attackCooldown = e.archetype === 'boss' ? (e.phase === 2 ? 0.8 : 1.2) : 1.3;
          }
        } else if (e.state === 'recover') {
          e.stateTimer -= dt;
          e.vx *= 0.86;
          e.vz *= 0.86;
          if (e.stateTimer <= 0) {
            e.state = 'pursue';
          }
        } else if (dist < aggroRange && Math.abs(player.y - e.y) < 5.5) {
          e.state = 'pursue';
          e.yaw = lerpAngle(e.yaw, yawFromDir(dx, dz), Math.min(1, dt * 7));

          if (e.archetype === 'acolyte') {
            // Policy 1: Kiter / Ranged Caster (stays near balcony/home or retreats if close)
            if (dist < 4.5) {
              const dirX = dx / (dist || 1);
              const dirZ = dz / (dist || 1);
              e.vx = THREE.MathUtils.damp(e.vx, -dirX * 3.8, 8, dt);
              e.vz = THREE.MathUtils.damp(e.vz, -dirZ * 3.8, 8, dt);
            } else {
              e.vx *= 0.85;
              e.vz *= 0.85;
            }
            if (e.attackCooldown <= 0 && countActiveChapterAttackers(enemies, e.chapter) < 3) {
              e.state = 'windup';
              e.stateTimer = 0.65;
            }
          } else if (e.archetype === 'halberdier') {
            // Policy 2: Shielded Front Heavy (slow advance, heavy slam)
            const stopDist = 2.15;
            if (dist > stopDist) {
              const dirX = dx / (dist || 1);
              const dirZ = dz / (dist || 1);
              e.vx = THREE.MathUtils.damp(e.vx, dirX * 2.75, 8, dt);
              e.vz = THREE.MathUtils.damp(e.vz, dirZ * 2.75, 8, dt);
            } else {
              e.vx *= 0.8;
              e.vz *= 0.8;
              if (e.attackCooldown <= 0 && countActiveChapterAttackers(enemies, e.chapter) < 2) {
                e.state = 'windup';
                e.stateTimer = 0.62;
              }
            }
          } else if (e.archetype === 'boss') {
            // Policy 3: Boss Prelate (relentless pursuit + phase 2 speed)
            const speed = e.phase === 2 ? 5.2 : 3.9;
            if (dist > 3.1) {
              const dirX = dx / (dist || 1);
              const dirZ = dz / (dist || 1);
              e.vx = THREE.MathUtils.damp(e.vx, dirX * speed, 8, dt);
              e.vz = THREE.MathUtils.damp(e.vz, dirZ * speed, 8, dt);
            } else {
              e.vx *= 0.8;
              e.vz *= 0.8;
              if (e.attackCooldown <= 0) {
                e.state = 'windup';
                e.stateTimer = e.phase === 2 ? 0.48 : 0.64;
              }
            }
          } else {
            // Policy 4: Thrall Swarmer/Flanker (fast sprint + lateral weave)
            const strafeAngle = Math.sin(totalTime * 2.5 + e.homeX) * 0.45;
            const dirX = dx / (dist || 1);
            const dirZ = dz / (dist || 1);
            const moveX = dirX * Math.cos(strafeAngle) - dirZ * Math.sin(strafeAngle);
            const moveZ = dirX * Math.sin(strafeAngle) + dirZ * Math.cos(strafeAngle);
            if (dist > 1.75) {
              e.vx = THREE.MathUtils.damp(e.vx, moveX * 5.2, 10, dt);
              e.vz = THREE.MathUtils.damp(e.vz, moveZ * 5.2, 10, dt);
            } else {
              e.vx *= 0.8;
              e.vz *= 0.8;
              if (e.attackCooldown <= 0 && countActiveChapterAttackers(enemies, e.chapter) < 2) {
                e.state = 'windup';
                e.stateTimer = 0.42;
              }
            }
          }
        } else {
          e.state = 'idle';
          e.vx *= 0.85;
          e.vz *= 0.85;
        }

        // Enemy gravity & platform stay-on-ledge safety
        const ePrevY = e.y;
        e.vy -= GRAVITY * dt;
        const eRes = resolveActorPlatforms(
          e.x + e.vx * dt,
          e.y + e.vy * dt,
          e.z + e.vz * dt,
          ePrevY,
          e.vy,
          e.radius,
          PLATFORMS,
          [],
        );
        if (eRes.grounded) {
          e.x = eRes.x;
          e.y = eRes.y;
          e.z = eRes.z;
          e.vy = 0;
          e.grounded = true;
        } else if (e.y > e.homeY - 2.0 && e.vy < 0) {
          // Keep non-flying enemies from walking blindly off chasms
          e.vx *= -0.5;
          e.vz *= -0.5;
          e.vy = 0;
          e.y = ePrevY;
        } else {
          e.x = eRes.x;
          e.y = eRes.y;
          e.z = eRes.z;
          e.vy = eRes.vy;
        }
        e.walkDistance += Math.hypot(e.vx, e.vz) * dt;

        animateEnemyRig(rig, e, totalTime);
      }

      // Ember Bolts update
      for (const b of emberBolts) {
        if (!b.active) continue;
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.mesh.position.set(b.x, b.y, b.z);
        if (b.life <= 0) {
          b.active = false;
          b.mesh.visible = false;
          continue;
        }
        const dPlayer = Math.hypot(b.x - player.x, b.y - (player.y + 1.0), b.z - player.z);
        if (dPlayer < 0.85) {
          b.active = false;
          b.mesh.visible = false;
          if (player.parryTimer > 0) {
            parries++;
            parryFlashTimer = 0.22;
            audioEngine.playParry();
            effects.spawnBurst(b.x, b.y, b.z, 12, 'spark');
          } else {
            damagePlayer(15, b.x, b.z);
          }
        }
      }

      // Animate Shrines, Braziers, Hero, Particles
      for (const m of shrineMeshes.values()) {
        const core = m.getObjectByName('shrineCore');
        if (core) {
          core.rotation.y = totalTime * 1.4;
          core.position.y = 2.95 + Math.sin(totalTime * 2.4) * 0.12;
        }
      }
      for (const fl of brazierFlames) {
        fl.scale.y = 0.5 + Math.sin(totalTime * 11 + fl.position.x) * 0.14;
      }

      animateHeroRig(heroRig, player, totalTime, false);
      effects.update(dt);

      // Update Key Light frustum around player
      keyLight.position.set(player.x + 16, player.y + 26, player.z + 14);
      keyLight.target.position.set(player.x, player.y, player.z);

      // Third-person Camera Follow + Lock-on + Wall Pull-in + Shake
      const locked = lockedEnemyId
        ? enemies.find((e) => e.id === lockedEnemyId && e.state !== 'ko' && e.hp > 0) || null
        : null;
      if (locked) {
        const targetCamYaw = yawFromDir(locked.x - player.x, locked.z - player.z);
        camYaw = lerpAngle(camYaw, targetCamYaw, Math.min(1, dt * 6));
      }

      const camDist = player.executingTargetId ? 4.4 : 7.6;
      const camHeight = player.executingTargetId ? 2.2 : 3.4;
      const sinY = Math.sin(camYaw);
      const cosY = Math.cos(camYaw);

      _camTarget.set(
        player.x + (locked ? (locked.x - player.x) * 0.25 : 0),
        player.y + 1.55,
        player.z + (locked ? (locked.z - player.z) * 0.25 : 0),
      );
      _camDesired.set(
        player.x + sinY * camDist * Math.cos(camPitch),
        player.y + camHeight + Math.sin(camPitch) * camDist * 0.55,
        player.z + cosY * camDist * Math.cos(camPitch),
      );

      // Wall/pillar pull-in raycast
      _rayOrigin.copy(_camTarget);
      _rayDir.copy(_camDesired).sub(_camTarget);
      const desiredLen = _rayDir.length();
      if (desiredLen > 0.1) {
        _rayDir.divideScalar(desiredLen);
        _raycaster.set(_rayOrigin, _rayDir);
        _raycaster.far = desiredLen;
        const hits = _raycaster.intersectObjects(worldCollisionMeshes, false);
        if (hits.length > 0 && hits[0].distance < desiredLen) {
          _camDesired.copy(_rayOrigin).addScaledVector(_rayDir, Math.max(1.4, hits[0].distance - 0.45));
        }
      }

      const dampFactor = 1 - Math.exp(-10 * dt);
      camCurrentPos.lerp(_camDesired, dampFactor);
      camCurrentLook.lerp(_camTarget, dampFactor);

      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLook);

      // Decaying trauma^2 camera shake + dash/execute FOV kick
      if (trauma > 0.005) {
        const shake = trauma * trauma * 0.24;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        camera.rotation.z += (Math.random() - 0.5) * shake * 0.08;
      }
      const targetFov = player.dashTimer > 0 ? 64 : player.executingTargetId ? 48 : 56;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 12, dt);
        camera.updateProjectionMatrix();
      }

      justPressed.clear();
      justReleased.clear();
      emitHudSnapshot(false);
    }

    // Software WebGL afterDraw helper
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      stepSimulation(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      effects.dispose();
      textures.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [controllerRef, initialAutostart]);

  return (
    <div
      ref={mountRef}
      data-testid="game-canvas-container"
      className="fixed inset-0 w-full h-full bg-[#09080b]"
    />
  );
};
