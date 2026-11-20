import * as THREE from 'three';
import { getAttackPhase, ATTACK_SPECS } from './combatMath';
import type { EnemyArchetype, EnemySim, PlayerSim } from './types';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  cape?: THREE.Mesh;
  weaponPivot?: THREE.Group;
  slashMesh?: THREE.Mesh;
  slashMat?: THREE.MeshBasicMaterial;
  telegraphRing?: THREE.Mesh;
  telegraphMat?: THREE.MeshBasicMaterial;
  staggerHalo?: THREE.Mesh;
  phase2GlowMat?: THREE.MeshStandardMaterial;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  contactShadow: THREE.Mesh;
}

function makeShadowMesh(contactTexture: THREE.Texture, radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: contactTexture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  return mesh;
}

function buildExtrudedGreatsword(
  length: number,
  width: number,
  bladeMat: THREE.Material,
  guardMat: THREE.Material,
  fullerMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  // Pommel & grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.36, 8), guardMat);
  grip.position.y = 0.1;
  g.add(grip);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), guardMat);
  pommel.position.y = -0.1;
  g.add(pommel);

  // Crossguard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(width * 2.6, 0.06, 0.09), guardMat);
  guard.position.y = 0.28;
  g.add(guard);

  // Beveled blade using ExtrudeGeometry
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.lineTo(width * 0.5, 0);
  shape.lineTo(width * 0.36, length * 0.85);
  shape.lineTo(0, length);
  shape.lineTo(-width * 0.36, length * 0.85);
  shape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  bladeGeo.center();
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = 0.3 + length * 0.5;
  blade.castShadow = true;
  g.add(blade);

  // Glowing crimson/ember fuller strip
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.22, length * 0.65, 0.062),
    fullerMat,
  );
  fuller.position.y = 0.3 + length * 0.42;
  g.add(fuller);

  return g;
}

function trackFlashMat(
  rig: CharacterRig,
  mat: THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  rig.hitFlashMaterials.push(mat);
  rig.baseEmissives.push(mat.emissive.clone());
  return mat;
}

export function createHeroRig(
  contactTexture: THREE.Texture,
  slashTexture: THREE.Texture,
  metalBump: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.9;
  root.add(body);

  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];
  const baseEmissives: THREE.Color[] = [];

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x262932,
    metalness: 0.84,
    roughness: 0.28,
    bumpMap: metalBump,
    bumpScale: 0.015,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x1a1618,
    metalness: 0.12,
    roughness: 0.82,
  });
  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0x6e1218,
    metalness: 0.1,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xa67c48,
    metalness: 0.88,
    roughness: 0.24,
  });
  const visorGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44,
    emissive: 0xff7722,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x8b95a5,
    metalness: 0.94,
    roughness: 0.18,
  });
  const fullerMat = new THREE.MeshStandardMaterial({
    color: 0xc8242c,
    emissive: 0x991218,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  const rig: CharacterRig = {
    root,
    body,
    head: new THREE.Group(),
    leftArm: new THREE.Group(),
    rightArm: new THREE.Group(),
    leftLeg: new THREE.Group(),
    rightLeg: new THREE.Group(),
    hitFlashMaterials,
    baseEmissives,
    contactShadow: makeShadowMesh(contactTexture, 0.72),
  };

  trackFlashMat(rig, armorMat);
  trackFlashMat(rig, leatherMat);
  trackFlashMat(rig, crimsonMat);

  // 1. Torso cuirass
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.38), armorMat);
  chest.position.y = 0.25;
  chest.castShadow = true;
  body.add(chest);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.36), bronzeMat);
  belt.position.y = -0.1;
  body.add(belt);

  // 2. Tattered Crimson Cape (facing +Z behind character)
  const capeGeo = new THREE.PlaneGeometry(0.62, 1.08, 2, 4);
  const cape = new THREE.Mesh(capeGeo, crimsonMat);
  cape.position.set(0, 0.02, 0.28);
  cape.rotation.x = 0.18;
  cape.castShadow = true;
  body.add(cape);
  rig.cape = cape;

  // 3. Head + Horned Cowl + Glowing Eyes (-Z is forward)
  rig.head.position.set(0, 0.74, 0);
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.32, 8), armorMat);
  helm.castShadow = true;
  rig.head.add(helm);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), bronzeMat);
  crest.position.set(0, 0.17, 0.02);
  rig.head.add(crest);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.06), visorGlowMat);
  visor.position.set(0, 0.02, -0.18);
  rig.head.add(visor);
  body.add(rig.head);

  // 4. Left Arm + Pauldron
  rig.leftArm.position.set(-0.42, 0.48, 0);
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), armorMat);
  lPauldron.scale.set(1.1, 0.85, 1.1);
  rig.leftArm.add(lPauldron);
  const lVambrace = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.56, 8), leatherMat);
  lVambrace.position.y = -0.28;
  lVambrace.castShadow = true;
  rig.leftArm.add(lVambrace);
  body.add(rig.leftArm);

  // 5. Right Arm + Pauldron + Obsidian Greatsword
  rig.rightArm.position.set(0.42, 0.48, 0);
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), armorMat);
  rPauldron.scale.set(1.1, 0.85, 1.1);
  rig.rightArm.add(rPauldron);
  const rVambrace = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.56, 8), leatherMat);
  rVambrace.position.y = -0.28;
  rVambrace.castShadow = true;
  rig.rightArm.add(rVambrace);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0, -0.54, -0.1);
  // Point blade outward/forward along hand grip without folding back into the cape
  weaponPivot.rotation.set(Math.PI * 0.56, 0, 0);
  const sword = buildExtrudedGreatsword(1.42, 0.14, bladeMat, bronzeMat, fullerMat);
  weaponPivot.add(sword);
  rig.rightArm.add(weaponPivot);
  rig.weaponPivot = weaponPivot;
  body.add(rig.rightArm);

  // 6. Legs
  rig.leftLeg.position.set(-0.18, -0.14, 0);
  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.72, 8), leatherMat);
  lThigh.position.y = -0.36;
  lThigh.castShadow = true;
  rig.leftLeg.add(lThigh);
  const lGreave = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.22), armorMat);
  lGreave.position.set(0, -0.56, -0.02);
  rig.leftLeg.add(lGreave);
  body.add(rig.leftLeg);

  rig.rightLeg.position.set(0.18, -0.14, 0);
  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.72, 8), leatherMat);
  rThigh.position.y = -0.36;
  rThigh.castShadow = true;
  rig.rightLeg.add(rThigh);
  const rGreave = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.22), armorMat);
  rGreave.position.set(0, -0.56, -0.02);
  rig.rightLeg.add(rGreave);
  body.add(rig.rightLeg);

  // 7. Dynamic Slash Crescent Arc Mesh
  const slashGeo = new THREE.PlaneGeometry(3.8, 3.8);
  slashGeo.rotateX(-Math.PI / 2);
  const slashMat = new THREE.MeshBasicMaterial({
    map: slashTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const slashMesh = new THREE.Mesh(slashGeo, slashMat);
  slashMesh.position.set(0, 1.1, -0.5);
  slashMesh.visible = false;
  root.add(slashMesh);
  rig.slashMesh = slashMesh;
  rig.slashMat = slashMat;

  root.add(rig.contactShadow);
  return rig;
}

export function createEnemyRig(
  archetype: EnemyArchetype,
  contactTexture: THREE.Texture,
  metalBump: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const scale = archetype === 'boss' ? 1.72 : archetype === 'halberdier' ? 1.15 : 1.0;
  body.scale.setScalar(scale);
  body.position.y = 0.88 * scale;
  root.add(body);

  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];
  const baseEmissives: THREE.Color[] = [];

  const rig: CharacterRig = {
    root,
    body,
    head: new THREE.Group(),
    leftArm: new THREE.Group(),
    rightArm: new THREE.Group(),
    leftLeg: new THREE.Group(),
    rightLeg: new THREE.Group(),
    hitFlashMaterials,
    baseEmissives,
    contactShadow: makeShadowMesh(contactTexture, archetype === 'boss' ? 1.35 : 0.72),
  };

  const darkMetal = trackFlashMat(
    rig,
    new THREE.MeshStandardMaterial({
      color: archetype === 'boss' ? 0x1d1920 : 0x2c2b30,
      metalness: 0.82,
      roughness: 0.34,
      bumpMap: metalBump,
      bumpScale: 0.015,
    }),
  );
  const clothMat = trackFlashMat(
    rig,
    new THREE.MeshStandardMaterial({
      color:
        archetype === 'acolyte'
          ? 0x3b1822
          : archetype === 'boss'
            ? 0x4e0d12
            : 0x2a2422,
      metalness: 0.08,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  const boneTrim = trackFlashMat(
    rig,
    new THREE.MeshStandardMaterial({
      color: archetype === 'halberdier' ? 0x8f7a58 : 0x70675c,
      metalness: 0.45,
      roughness: 0.52,
    }),
  );
  const eyeGlow = new THREE.MeshStandardMaterial({
    color: archetype === 'acolyte' ? 0xff7722 : 0xff2b2b,
    emissive: archetype === 'acolyte' ? 0xff5500 : 0xd91818,
    emissiveIntensity: 2.2,
  });

  // Torso
  const torso = new THREE.Mesh(
    archetype === 'halberdier' || archetype === 'boss'
      ? new THREE.BoxGeometry(0.68, 0.72, 0.44)
      : new THREE.CylinderGeometry(0.24, 0.18, 0.68, 8),
    archetype === 'acolyte' ? clothMat : darkMetal,
  );
  torso.position.y = 0.22;
  torso.castShadow = true;
  body.add(torso);

  // Rib/Armor detail
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.42), boneTrim);
  rib.position.y = 0.32;
  body.add(rib);

  // Head
  rig.head.position.set(0, 0.72, archetype === 'thrall' ? -0.08 : 0);
  const headMesh = new THREE.Mesh(
    archetype === 'boss'
      ? new THREE.CylinderGeometry(0.2, 0.24, 0.36, 8)
      : new THREE.DodecahedronGeometry(0.2, 0),
    darkMetal,
  );
  headMesh.castShadow = true;
  rig.head.add(headMesh);

  if (archetype === 'boss' || archetype === 'halberdier') {
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), boneTrim);
    hornL.position.set(-0.18, 0.2, 0);
    hornL.rotation.z = 0.45;
    rig.head.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = 0.18;
    hornR.rotation.z = -0.45;
    rig.head.add(hornR);
  }

  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), eyeGlow);
  eyes.position.set(0, 0.02, -0.18);
  rig.head.add(eyes);
  body.add(rig.head);

  // Arms & Archetype Weapons
  rig.leftArm.position.set(-0.44, 0.46, 0);
  rig.rightArm.position.set(0.44, 0.46, 0);

  const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.56, 7);
  const lArmMesh = new THREE.Mesh(armGeo, clothMat);
  lArmMesh.position.y = -0.26;
  rig.leftArm.add(lArmMesh);
  const rArmMesh = new THREE.Mesh(armGeo, clothMat);
  rArmMesh.position.y = -0.26;
  rig.rightArm.add(rArmMesh);

  if (archetype === 'thrall') {
    // Twin curved daggers
    const daggerL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.08), boneTrim);
    daggerL.position.set(0, -0.52, -0.16);
    daggerL.rotation.x = -Math.PI * 0.4;
    rig.leftArm.add(daggerL);

    const daggerR = daggerL.clone();
    rig.rightArm.add(daggerR);
  } else if (archetype === 'halberdier') {
    // Tall Tower Shield on left arm
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-0.32, -0.58);
    shieldShape.lineTo(0.32, -0.58);
    shieldShape.lineTo(0.38, 0.42);
    shieldShape.lineTo(0, 0.62);
    shieldShape.lineTo(-0.38, 0.42);
    shieldShape.closePath();
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    shieldGeo.center();
    const shield = new THREE.Mesh(shieldGeo, darkMetal);
    shield.position.set(-0.1, -0.16, -0.26);
    shield.castShadow = true;
    rig.leftArm.add(shield);

    // Long Halberd on right arm
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), boneTrim);
    pole.position.set(0, -0.2, -0.45);
    pole.rotation.x = -Math.PI * 0.42;
    rig.rightArm.add(pole);

    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.34), boneTrim);
    axeHead.position.set(0, 0.14, -1.25);
    rig.rightArm.add(axeHead);
  } else if (archetype === 'acolyte') {
    // Floating Ember Core & Rune Ring
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), eyeGlow);
    core.position.set(0, 0.25, -0.28);
    body.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 24), boneTrim);
    halo.position.set(0, 0.4, 0.22);
    body.add(halo);
  } else if (archetype === 'boss') {
    // Boss giant tattered cape + molten greatsword
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35, 2, 3), clothMat);
    cape.position.set(0, 0.02, 0.28);
    cape.rotation.x = 0.16;
    body.add(cape);
    rig.cape = cape;

    const lPauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), darkMetal);
    rig.leftArm.add(lPauldron);
    const rPauldron = lPauldron.clone();
    rig.rightArm.add(rPauldron);

    const phase2GlowMat = new THREE.MeshStandardMaterial({
      color: 0xcc2218,
      emissive: 0xaa1a10,
      emissiveIntensity: 1.0,
      roughness: 0.3,
    });
    rig.phase2GlowMat = phase2GlowMat;
    const swordPivot = new THREE.Group();
    swordPivot.position.set(0, -0.5, -0.1);
    swordPivot.rotation.x = -Math.PI * 0.4;
    const bossSword = buildExtrudedGreatsword(1.85, 0.22, darkMetal, boneTrim, phase2GlowMat);
    swordPivot.add(bossSword);
    rig.rightArm.add(swordPivot);
    rig.weaponPivot = swordPivot;
  }

  body.add(rig.leftArm);
  body.add(rig.rightArm);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.72, 7);
  rig.leftLeg.position.set(-0.18, -0.14, 0);
  const lLeg = new THREE.Mesh(legGeo, darkMetal);
  lLeg.position.y = -0.36;
  rig.leftLeg.add(lLeg);
  body.add(rig.leftLeg);

  rig.rightLeg.position.set(0.18, -0.14, 0);
  const rLeg = new THREE.Mesh(legGeo, darkMetal);
  rLeg.position.y = -0.36;
  rig.rightLeg.add(rLeg);
  body.add(rig.rightLeg);

  // Ground telegraph warning ring (hidden until windup)
  const teleGeo = new THREE.RingGeometry(0.75, 1.0, 32);
  teleGeo.rotateX(-Math.PI / 2);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xff2b22,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const teleRing = new THREE.Mesh(teleGeo, teleMat);
  teleRing.position.y = 0.03;
  teleRing.visible = false;
  root.add(teleRing);
  rig.telegraphRing = teleRing;
  rig.telegraphMat = teleMat;

  // Staggered Execution Crown Halo
  const stagGeo = new THREE.TorusGeometry(0.45 * scale, 0.04, 8, 24);
  stagGeo.rotateX(Math.PI / 2);
  const stagMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.9,
  });
  const stagHalo = new THREE.Mesh(stagGeo, stagMat);
  stagHalo.position.y = (archetype === 'boss' ? 3.5 : 2.15) * 1.0;
  stagHalo.visible = false;
  root.add(stagHalo);
  rig.staggerHalo = stagHalo;

  root.add(rig.contactShadow);
  return rig;
}

export function animateHeroRig(
  rig: CharacterRig,
  player: PlayerSim,
  elapsedTime: number,
  isTitleMode: boolean,
) {
  rig.root.position.set(player.x, player.y, player.z);
  rig.root.rotation.y = player.yaw;

  // Squash & stretch
  rig.body.scale.set(player.squashX, player.squashY, player.squashX);

  if (isTitleMode) {
    // Diegetic kneeling oath pose before the shrine
    rig.body.position.y = 0.65 + Math.sin(elapsedTime * 1.8) * 0.02;
    rig.body.rotation.set(0.22, 0, 0);
    rig.head.rotation.set(0.18, 0, 0);
    rig.rightArm.rotation.set(-0.6, 0, -0.1);
    rig.leftArm.rotation.set(-0.5, 0, 0.15);
    rig.leftLeg.rotation.x = 0.85;
    rig.rightLeg.rotation.x = -0.65;
    if (rig.slashMesh) rig.slashMesh.visible = false;
    return;
  }

  rig.body.position.y = 0.9;
  rig.body.rotation.set(0, 0, 0);

  // Hit flash
  for (let i = 0; i < rig.hitFlashMaterials.length; i++) {
    const m = rig.hitFlashMaterials[i];
    if (player.hitFlashTimer > 0) {
      m.emissive.setHex(0x991111);
      m.emissiveIntensity = 1.4;
    } else if (player.healFlashTimer > 0) {
      m.emissive.setHex(0xc83a2b);
      m.emissiveIntensity = 0.8;
    } else {
      m.emissive.copy(rig.baseEmissives[i]);
      m.emissiveIntensity = 1.0;
    }
  }

  // Gait synced to actual distance traveled
  const speed = Math.hypot(player.vx, player.vz);
  const gaitAmp = Math.min(1, speed / 7.5);
  const swing = Math.sin(player.walkDistance * 2.4) * 0.68 * gaitAmp;

  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  if (rig.cape) {
    rig.cape.rotation.x = 0.14 + gaitAmp * 0.35 + Math.sin(elapsedTime * 4.5) * 0.06;
  }

  if (!player.grounded) {
    rig.leftLeg.rotation.x = 0.45;
    rig.rightLeg.rotation.x = -0.35;
  }

  if (player.dashTimer > 0) {
    rig.body.rotation.x = 0.45;
  }

  // Attack / Parry poses
  if (rig.slashMesh) rig.slashMesh.visible = false;

  if (player.parryTimer > 0) {
    rig.rightArm.rotation.set(1.25, -0.45, 0.4);
    rig.leftArm.rotation.set(1.1, 0.4, -0.3);
    rig.body.rotation.y = -0.3;
  } else if (player.attackKind) {
    const phase = getAttackPhase(player.attackKind, player.attackTimer);
    const spec = ATTACK_SPECS[player.attackKind];
    const t = player.attackTimer;

    if (player.attackKind === 'light1') {
      if (phase === 'windup') {
        rig.rightArm.rotation.set(1.4, -0.9, -0.4);
        rig.body.rotation.y = -0.45;
      } else if (phase === 'active') {
        const p = (t - spec.windup) / spec.active;
        rig.rightArm.rotation.set(1.25, -0.9 + p * 2.1, 0.5);
        rig.body.rotation.y = -0.45 + p * 1.05;
        if (rig.slashMesh && rig.slashMat) {
          rig.slashMesh.visible = true;
          rig.slashMesh.rotation.set(0, -0.7 + p * 1.6, 0.12);
          rig.slashMat.opacity = Math.sin(p * Math.PI) * 0.9;
        }
      } else {
        rig.rightArm.rotation.set(0.8, 0.9, 0.3);
      }
    } else if (player.attackKind === 'light2') {
      if (phase === 'windup') {
        rig.rightArm.rotation.set(1.1, 1.0, 0.5);
        rig.body.rotation.y = 0.45;
      } else if (phase === 'active') {
        const p = (t - spec.windup) / spec.active;
        rig.rightArm.rotation.set(1.25, 1.0 - p * 2.1, -0.4);
        rig.body.rotation.y = 0.45 - p * 1.05;
        if (rig.slashMesh && rig.slashMat) {
          rig.slashMesh.visible = true;
          rig.slashMesh.rotation.set(0, 0.8 - p * 1.7, -0.15);
          rig.slashMat.opacity = Math.sin(p * Math.PI) * 0.92;
        }
      } else {
        rig.rightArm.rotation.set(0.75, -0.7, -0.3);
      }
    } else if (player.attackKind === 'light3') {
      if (phase === 'windup') {
        rig.rightArm.rotation.set(2.1, -0.3, 0.2);
      } else if (phase === 'active') {
        const p = (t - spec.windup) / spec.active;
        rig.body.rotation.y = p * Math.PI * 2;
        rig.rightArm.rotation.set(1.35, 0, 1.1);
        if (rig.slashMesh && rig.slashMat) {
          rig.slashMesh.visible = true;
          rig.slashMesh.scale.setScalar(1.25);
          rig.slashMesh.rotation.set(0, p * Math.PI * 2, 0);
          rig.slashMat.opacity = Math.sin(p * Math.PI);
        }
      } else {
        rig.rightArm.rotation.set(0.55, 0.2, 0.1);
      }
    } else if (player.attackKind === 'heavy' || player.attackKind === 'execute') {
      if (phase === 'windup') {
        rig.rightArm.rotation.set(2.5, 0, 0);
        rig.leftArm.rotation.set(2.1, 0, 0);
        rig.body.rotation.x = -0.18;
      } else if (phase === 'active') {
        const p = (t - spec.windup) / spec.active;
        rig.rightArm.rotation.set(2.5 - p * 2.2, 0, 0);
        rig.leftArm.rotation.set(2.1 - p * 1.8, 0, 0);
        rig.body.rotation.x = 0.28;
        if (rig.slashMesh && rig.slashMat) {
          rig.slashMesh.visible = true;
          rig.slashMesh.scale.setScalar(1.25);
          rig.slashMesh.position.set(0, 1.38, -0.65);
          rig.slashMesh.rotation.set(0.45, -0.25, Math.PI * 0.34);
          rig.slashMat.opacity = Math.sin(p * Math.PI);
        }
      } else {
        rig.rightArm.rotation.set(0.35, 0, 0);
        rig.body.rotation.x = 0.15;
      }
    }
  } else {
    rig.leftArm.rotation.set(-swing * 0.7 + 0.15, 0, 0.12);
    rig.rightArm.rotation.set(swing * 0.5 + 0.35, -0.1, -0.18);
    if (rig.slashMesh) rig.slashMesh.scale.setScalar(1.0);
  }
}

export function animateEnemyRig(
  rig: CharacterRig,
  enemy: EnemySim,
  elapsedTime: number,
) {
  rig.root.position.set(enemy.x, enemy.y, enemy.z);
  rig.root.rotation.y = enemy.yaw;

  // KO topple transition
  if (enemy.state === 'ko') {
    const p = Math.min(1, enemy.koTimer / 0.45);
    rig.body.rotation.x = -p * (Math.PI * 0.48);
    rig.body.position.y = (enemy.archetype === 'boss' ? 1.45 : 0.88) * (1 - p * 0.7);
    rig.root.scale.setScalar(Math.max(0.01, 1 - Math.max(0, enemy.koTimer - 0.55) / 0.45));
    if (rig.telegraphRing) rig.telegraphRing.visible = false;
    if (rig.staggerHalo) rig.staggerHalo.visible = false;
    return;
  }

  rig.root.scale.setScalar(1);
  const baseBodyY = enemy.archetype === 'boss' ? 1.5 : 0.88;
  rig.body.position.y =
    enemy.archetype === 'acolyte'
      ? baseBodyY + 0.45 + Math.sin(elapsedTime * 3.2) * 0.15
      : baseBodyY;
  rig.body.scale.set(enemy.squashX, enemy.squashY, enemy.squashX);
  rig.body.rotation.set(0, 0, 0);

  // Hit flash & Boss phase 2 molten sword
  for (let i = 0; i < rig.hitFlashMaterials.length; i++) {
    const m = rig.hitFlashMaterials[i];
    if (enemy.hitFlashTimer > 0) {
      m.emissive.setHex(0xffffff);
      m.emissiveIntensity = 1.1;
    } else if (enemy.state === 'windup') {
      m.emissive.setHex(0x8a1812);
      m.emissiveIntensity = 0.6;
    } else {
      m.emissive.copy(rig.baseEmissives[i]);
      m.emissiveIntensity = 1.0;
    }
  }

  if (rig.phase2GlowMat) {
    rig.phase2GlowMat.emissiveIntensity = enemy.phase === 2 ? 3.2 : 1.0;
  }

  // Telegraph ring
  if (rig.telegraphRing && rig.telegraphMat) {
    if (enemy.state === 'windup') {
      rig.telegraphRing.visible = true;
      const pulse = 1.0 + Math.sin(elapsedTime * 18) * 0.12;
      const reachScale =
        enemy.archetype === 'boss' ? 3.8 : enemy.archetype === 'halberdier' ? 2.6 : 1.7;
      rig.telegraphRing.scale.setScalar(reachScale * pulse);
      rig.telegraphMat.opacity = 0.72;
    } else {
      rig.telegraphRing.visible = false;
    }
  }

  // Stagger halo
  if (rig.staggerHalo) {
    rig.staggerHalo.visible = enemy.state === 'staggered';
    rig.staggerHalo.rotation.z = elapsedTime * 3.5;
  }

  // Gait + Pose
  const speed = Math.hypot(enemy.vx, enemy.vz);
  const amp = Math.min(1, speed / 5.5);
  const swing = Math.sin(enemy.walkDistance * 2.4) * 0.65 * amp;
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;

  if (enemy.state === 'staggered') {
    rig.body.rotation.x = -0.25;
    rig.head.rotation.x = 0.4;
    rig.leftArm.rotation.set(-0.3, 0, 0.55);
    rig.rightArm.rotation.set(-0.3, 0, -0.55);
  } else if (enemy.state === 'windup') {
    rig.rightArm.rotation.set(-2.35, -0.35, 0);
    rig.leftArm.rotation.set(-0.8, 0.25, 0.2);
    rig.body.rotation.x = -0.18;
  } else if (enemy.state === 'attack') {
    rig.rightArm.rotation.set(0.35, 0.45, -0.3);
    rig.body.rotation.x = 0.26;
  } else {
    rig.leftArm.rotation.set(-swing * 0.6 - (enemy.archetype === 'halberdier' ? 0.55 : 0.2), 0, 0.1);
    rig.rightArm.rotation.set(swing * 0.6 - 0.35, 0, -0.1);
  }
}

export function createLoreShrineMesh(metalBump: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x26262c,
    roughness: 0.78,
    metalness: 0.18,
    bumpMap: metalBump,
    bumpScale: 0.02,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xe28743,
    emissive: 0xc84b18,
    emissiveIntensity: 1.8,
    roughness: 0.25,
  });

  // Base plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 1.5), stoneMat);
  base.position.y = 0.18;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Obelisk monolith
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 2.2, 6), stoneMat);
  obelisk.position.y = 1.46;
  obelisk.castShadow = true;
  g.add(obelisk);

  // Floating crystal core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), runeMat);
  core.position.y = 2.95;
  core.name = 'shrineCore';
  g.add(core);

  return g;
}

export function createBrazierMesh(): THREE.Group {
  const g = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x232024,
    metalness: 0.85,
    roughness: 0.38,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff4500,
    emissiveIntensity: 2.6,
    roughness: 0.4,
  });

  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.85, 8), ironMat);
  ped.position.y = 0.425;
  ped.castShadow = true;
  g.add(ped);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.28, 0.36, 8), ironMat);
  bowl.position.y = 1.02;
  bowl.castShadow = true;
  g.add(bowl);

  const coals = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), emberMat);
  coals.scale.set(1.15, 0.45, 1.15);
  coals.position.y = 1.18;
  g.add(coals);

  const flameGroup = new THREE.Group();
  flameGroup.position.y = 1.24;
  flameGroup.name = 'brazierFlame';
  const mainTongue = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.75, 6),
    new THREE.MeshBasicMaterial({ color: 0xff7b29, transparent: true, opacity: 0.9 }),
  );
  mainTongue.position.y = 0.32;
  flameGroup.add(mainTongue);

  const innerTongue = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.52, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd275, transparent: true, opacity: 0.95 }),
  );
  innerTongue.position.set(0.06, 0.24, 0.04);
  flameGroup.add(innerTongue);

  g.add(flameGroup);

  return g;
}

export function createRuneGateMesh(width: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x222028,
    metalness: 0.4,
    roughness: 0.65,
  });
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xb81d18,
    emissive: 0x99120e,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, height + 0.8, 1.2), pillarMat);
  leftPillar.position.set(-width * 0.5 - 0.55, (height + 0.8) * 0.5, 0);
  leftPillar.castShadow = true;
  g.add(leftPillar);

  const rightPillar = leftPillar.clone();
  rightPillar.position.x = width * 0.5 + 0.55;
  g.add(rightPillar);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 2.4, 1.0, 1.4), pillarMat);
  lintel.position.set(0, height + 0.4, 0);
  lintel.castShadow = true;
  g.add(lintel);

  const seal = new THREE.Mesh(new THREE.PlaneGeometry(width, height), barrierMat);
  seal.position.set(0, height * 0.5, 0);
  seal.name = 'gateSeal';
  g.add(seal);

  return g;
}
