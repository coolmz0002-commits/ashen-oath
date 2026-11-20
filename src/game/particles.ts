import * as THREE from 'three';

const PARTICLE_COUNT = 260;
const DECAL_COUNT = 28;

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

interface BloodDecalSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  active: boolean;
}

const _dummyObj = new THREE.Object3D();
const _color = new THREE.Color();

export class PooledEffectsSystem {
  public readonly instancedParticles: THREE.InstancedMesh;
  public readonly decalsGroup = new THREE.Group();
  private particles: ParticleSlot[] = [];
  private cursor = 0;
  private decals: BloodDecalSlot[] = [];
  private decalCursor = 0;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.MeshBasicMaterial;
  private decalGeo: THREE.BufferGeometry;

  constructor(bloodDecalTexture: THREE.Texture) {
    this.particleGeo = new THREE.DodecahedronGeometry(0.11, 0);
    this.particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.instancedParticles = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      PARTICLE_COUNT,
    );
    this.instancedParticles.frustumCulled = false;
    this.instancedParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 1,
        size: 0,
        gravity: 15,
        r: 1,
        g: 1,
        b: 1,
      });
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      this.instancedParticles.setMatrixAt(i, _dummyObj.matrix);
      _color.setRGB(1, 1, 1);
      this.instancedParticles.setColorAt(i, _color);
    }
    this.instancedParticles.instanceMatrix.needsUpdate = true;
    if (this.instancedParticles.instanceColor) {
      this.instancedParticles.instanceColor.needsUpdate = true;
    }

    // Pooled blood splatter floor decals
    this.decalGeo = new THREE.PlaneGeometry(1.4, 1.4);
    this.decalGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < DECAL_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: bloodDecalTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(this.decalGeo, mat);
      mesh.visible = false;
      this.decalsGroup.add(mesh);
      this.decals.push({ mesh, mat, age: 0, active: false });
    }
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    kind: 'blood' | 'spark' | 'ember' | 'ash' | 'shard',
    dirX = 0,
    dirZ = 0,
  ) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % PARTICLE_COUNT;

      slot.active = true;
      slot.age = 0;
      slot.x = x + (Math.random() - 0.5) * 0.35;
      slot.y = y + (Math.random() - 0.5) * 0.35;
      slot.z = z + (Math.random() - 0.5) * 0.35;

      const angle = Math.random() * Math.PI * 2;
      const spread =
        kind === 'spark' ? 4.5 + Math.random() * 6.0 : 2.2 + Math.random() * 5.2;

      slot.vx = Math.cos(angle) * spread + dirX * 3.2;
      slot.vz = Math.sin(angle) * spread + dirZ * 3.2;

      if (kind === 'blood') {
        slot.vy = 2.5 + Math.random() * 5.2;
        slot.gravity = 22.0;
        slot.life = 0.45 + Math.random() * 0.35;
        slot.size = 0.65 + Math.random() * 0.85;
        slot.r = 0.58 + Math.random() * 0.32;
        slot.g = 0.02;
        slot.b = 0.04;
      } else if (kind === 'spark') {
        slot.vy = 2.0 + Math.random() * 5.0;
        slot.gravity = 14.0;
        slot.life = 0.24 + Math.random() * 0.22;
        slot.size = 0.45 + Math.random() * 0.45;
        slot.r = 1.0;
        slot.g = 0.72 + Math.random() * 0.25;
        slot.b = 0.22;
      } else if (kind === 'ember') {
        slot.vy = 1.4 + Math.random() * 2.8;
        slot.gravity = -1.8;
        slot.life = 0.65 + Math.random() * 0.7;
        slot.size = 0.4 + Math.random() * 0.5;
        slot.r = 1.0;
        slot.g = 0.32 + Math.random() * 0.3;
        slot.b = 0.06;
      } else if (kind === 'shard') {
        slot.vy = 3.2 + Math.random() * 5.5;
        slot.gravity = 24.0;
        slot.life = 0.55 + Math.random() * 0.35;
        slot.size = 0.7 + Math.random() * 0.7;
        slot.r = 0.35;
        slot.g = 0.33;
        slot.b = 0.38;
      } else {
        // ash / dust
        slot.vy = 0.6 + Math.random() * 1.6;
        slot.gravity = 2.5;
        slot.life = 0.35 + Math.random() * 0.3;
        slot.size = 0.6 + Math.random() * 0.5;
        slot.r = 0.5;
        slot.g = 0.46;
        slot.b = 0.43;
      }
    }
  }

  public spawnBloodDecal(x: number, y: number, z: number, scale = 1.0) {
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % DECAL_COUNT;
    d.active = true;
    d.age = 0;
    d.mesh.visible = true;
    d.mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.018, z + (Math.random() - 0.5) * 0.5);
    d.mesh.rotation.y = Math.random() * Math.PI * 2;
    const s = scale * (0.75 + Math.random() * 0.55);
    d.mesh.scale.set(s, 1, s);
    d.mat.opacity = 0.85;
  }

  public update(dt: number) {
    let dirty = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dummyObj.position.set(0, -100, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        this.instancedParticles.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = 1 - p.age / p.life;
      _dummyObj.position.set(p.x, p.y, p.z);
      _dummyObj.rotation.set(p.age * 7, p.age * 5, 0);
      _dummyObj.scale.setScalar(p.size * t);
      _dummyObj.updateMatrix();
      this.instancedParticles.setMatrixAt(i, _dummyObj.matrix);

      _color.setRGB(p.r, p.g, p.b);
      this.instancedParticles.setColorAt(i, _color);
    }

    if (dirty) {
      this.instancedParticles.instanceMatrix.needsUpdate = true;
      if (this.instancedParticles.instanceColor) {
        this.instancedParticles.instanceColor.needsUpdate = true;
      }
    }

    for (const d of this.decals) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age > 16) {
        const fade = Math.max(0, 1 - (d.age - 16) / 4);
        d.mat.opacity = fade * 0.85;
        if (fade <= 0) {
          d.active = false;
          d.mesh.visible = false;
        }
      }
    }
  }

  public clearDecals() {
    for (const d of this.decals) {
      d.active = false;
      d.mesh.visible = false;
    }
  }

  public dispose() {
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.decalGeo.dispose();
    for (const d of this.decals) {
      d.mat.dispose();
    }
  }
}
