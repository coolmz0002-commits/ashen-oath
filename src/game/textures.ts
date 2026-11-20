import * as THREE from 'three';

export interface GameTextureSet {
  basaltColor: THREE.Texture;
  obsidianColor: THREE.Texture;
  stoneBump: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  bloodDecal: THREE.CanvasTexture;
  slashArc: THREE.CanvasTexture;
  dispose: () => void;
}

function createStoneBumpCanvas(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Micro-relief stone speckles and fractures
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 90 + Math.floor(Math.random() * 85);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  ctx.strokeStyle = 'rgba(28,28,28,0.65)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    let cx = Math.random() * size;
    let cy = Math.random() * size;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 32;
      cy += (Math.random() - 0.5) * 32;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createMetalBumpCanvas(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    const v = 110 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createRadialShadowCanvas(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBloodDecalCanvas(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
  grad.addColorStop(0, 'rgba(115, 8, 12, 0.92)');
  grad.addColorStop(0.6, 'rgba(72, 4, 8, 0.78)');
  grad.addColorStop(1, 'rgba(40, 2, 4, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const r = 18 + Math.random() * 34;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r;
    ctx.fillStyle = 'rgba(88, 6, 10, 0.8)';
    ctx.beginPath();
    ctx.arc(bx, by, 2 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSlashArcCanvas(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2, size / 2);
  const grad = ctx.createRadialGradient(0, 0, 56, 0, 0, 122);
  grad.addColorStop(0, 'rgba(255, 60, 30, 0)');
  grad.addColorStop(0.65, 'rgba(220, 45, 35, 0.45)');
  grad.addColorStop(0.88, 'rgba(255, 195, 130, 0.95)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 122, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.arc(0, 0, 54, Math.PI * 0.65, -Math.PI * 0.65, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface GameTextureSet {
  basaltColor: THREE.Texture;
  obsidianColor: THREE.Texture;
  bindTiledBasalt: (mat: THREE.MeshStandardMaterial, rx: number, ry: number, disposables: Array<{ dispose: () => void }>) => void;
  bindTiledObsidian: (mat: THREE.MeshStandardMaterial, rx: number, ry: number, disposables: Array<{ dispose: () => void }>) => void;
  stoneBump: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  bloodDecal: THREE.CanvasTexture;
  slashArc: THREE.CanvasTexture;
  dispose: () => void;
}

export function loadGameTextures(renderer: THREE.WebGLRenderer): GameTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();

  const basaltWaiters: Array<() => void> = [];
  const obsidianWaiters: Array<() => void> = [];
  let basaltLoaded = false;
  let obsidianLoaded = false;

  const basaltColor = loader.load(
    '/src/assets/images/tex_basalt_stone_1795159659366.jpg',
    () => {
      basaltLoaded = true;
      basaltWaiters.forEach((fn) => fn());
      basaltWaiters.length = 0;
    },
  );
  basaltColor.colorSpace = THREE.SRGBColorSpace;
  basaltColor.wrapS = THREE.RepeatWrapping;
  basaltColor.wrapT = THREE.RepeatWrapping;
  basaltColor.anisotropy = maxAniso;

  const obsidianColor = loader.load(
    '/src/assets/images/tex_obsidian_masonry_1795159660381.jpg',
    () => {
      obsidianLoaded = true;
      obsidianWaiters.forEach((fn) => fn());
      obsidianWaiters.length = 0;
    },
  );
  obsidianColor.colorSpace = THREE.SRGBColorSpace;
  obsidianColor.wrapS = THREE.RepeatWrapping;
  obsidianColor.wrapT = THREE.RepeatWrapping;
  obsidianColor.anisotropy = maxAniso;

  const bindTiledBasalt = (
    mat: THREE.MeshStandardMaterial,
    rx: number,
    ry: number,
    disposables: Array<{ dispose: () => void }>,
  ) => {
    const apply = () => {
      const tex = basaltColor.clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      disposables.push(tex);
    };
    if (basaltLoaded) apply();
    else basaltWaiters.push(apply);
  };

  const bindTiledObsidian = (
    mat: THREE.MeshStandardMaterial,
    rx: number,
    ry: number,
    disposables: Array<{ dispose: () => void }>,
  ) => {
    const apply = () => {
      const tex = obsidianColor.clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      disposables.push(tex);
    };
    if (obsidianLoaded) apply();
    else obsidianWaiters.push(apply);
  };

  const stoneBump = createStoneBumpCanvas();
  stoneBump.anisotropy = maxAniso;

  const metalBump = createMetalBumpCanvas();
  const contactShadow = createRadialShadowCanvas();
  const bloodDecal = createBloodDecalCanvas();
  const slashArc = createSlashArcCanvas();

  return {
    basaltColor,
    obsidianColor,
    bindTiledBasalt,
    bindTiledObsidian,
    stoneBump,
    metalBump,
    contactShadow,
    bloodDecal,
    slashArc,
    dispose() {
      basaltColor.dispose();
      obsidianColor.dispose();
      stoneBump.dispose();
      metalBump.dispose();
      contactShadow.dispose();
      bloodDecal.dispose();
      slashArc.dispose();
    },
  };
}
