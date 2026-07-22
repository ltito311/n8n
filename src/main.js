import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { UI } from './ui-assets.js';

// ---------------------------------------------------------------------------
// Fruit Ninja — a 3D browser clone built on three.js.
// Fruit models: "Free Pack - Fruits" by PolyOne Studio (Sketchfab), CC-BY-4.0.
// ---------------------------------------------------------------------------

const GRAVITY = -14;
const MAX_LIVES = 3;
const FRUIT_Z_NEAR = 1.0;
const FRUIT_Z_FAR = -1.0;
const CAMERA_Z = 16;
const WALL_Z = -8;

// Flesh/juice color per fruit type, used for splats and droplets.
const JUICE = {
  Watermelon: '#ff4444',
  Apple: '#d8e86a',
  Orange: '#ffa826',
  Banana: '#ffe9a0',
  Coconut: '#f5f0e6',
  Dragonfruit: '#e64ca0',
  Grape: '#a44ce6',
  Cherries: '#c81f3c',
  Avocado: '#a8c847',
  Mangostan: '#b03a8c',
  Pineapple: '#ffd94a',
};
// Display radius multiplier per type (all meshes are normalized to radius 1).
const SIZE = {
  Watermelon: 1.45, Pineapple: 1.35, Coconut: 1.1, Banana: 1.15,
  Apple: 1.0, Orange: 1.0, Avocado: 1.0, Dragonfruit: 1.1,
  Grape: 1.05, Cherries: 0.95, Mangostan: 0.9,
};
// Flesh-cap radius per type, as a fraction of the fruit's unit radius —
// smaller for slender/cluster fruit so the disc doesn't poke out.
const CAP = {
  Watermelon: 0.92, Pineapple: 0.78, Coconut: 0.8, Banana: 0.42,
  Apple: 0.85, Orange: 0.85, Avocado: 0.85, Dragonfruit: 0.85,
  Grape: 0.62, Cherries: 0.5, Mangostan: 0.78,
};

const FRUIT_SCALE = 1.35; // global size multiplier so fruit reads big on screen

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, CAMERA_Z);
camera.lookAt(0, 0, 0);

// Studio-style rig: one hot key from the upper left so fruit gets a bright
// specular hot spot, a cool rim from the right for shape, low ambient fill.
scene.add(new THREE.AmbientLight(0xfff2dd, 0.5));
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x3a2410, 0.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 3.4);
sun.position.set(-7, 12, 14);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x9fc8ff, 1.1);
rim.position.set(9, -3, 7);
scene.add(rim);

// World-space half extents of the frustum at the fruit plane (z = 0).
let halfH = 1, halfW = 1;
function updateFrustum() {
  halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
  halfW = halfH * camera.aspect;
}

// ---------------------------------------------------------------------------
// Dojo wall: procedural wood planks on a canvas. Juice splats are painted
// straight into this canvas so the wall stays stained during a run.
// ---------------------------------------------------------------------------
const WOOD_W = 1024, WOOD_H = 1024;
const woodCanvas = document.createElement('canvas');   // composited: base + splats
woodCanvas.width = WOOD_W; woodCanvas.height = WOOD_H;
const woodCtx = woodCanvas.getContext('2d');
const baseCanvas = document.createElement('canvas');   // pristine planks
baseCanvas.width = WOOD_W; baseCanvas.height = WOOD_H;
const splatCanvas = document.createElement('canvas');  // juice layer, fades out
splatCanvas.width = WOOD_W; splatCanvas.height = WOOD_H;
const splatCtx = splatCanvas.getContext('2d');
const woodTexture = new THREE.CanvasTexture(woodCanvas);
woodTexture.colorSpace = THREE.SRGBColorSpace;
let splatDirty = false, splatActiveUntil = 0, splatFadeAcc = 0;

function paintWood() {
  const ctx = baseCanvas.getContext('2d');
  const plank = WOOD_H / 8;
  for (let p = 0; p < 8; p++) {
    const y0 = p * plank;
    const base = 30 + rand(-6, 6);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + plank);
    g.addColorStop(0, `hsl(${base}, 42%, ${30 + rand(-3, 3)}%)`);
    g.addColorStop(0.5, `hsl(${base}, 46%, ${36 + rand(-3, 3)}%)`);
    g.addColorStop(1, `hsl(${base}, 40%, ${27 + rand(-3, 3)}%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, WOOD_W, plank);
    // grain streaks
    for (let i = 0; i < 46; i++) {
      ctx.strokeStyle = `hsla(${base + rand(-8, 8)}, 45%, ${rand(18, 42)}%, ${rand(0.05, 0.16)})`;
      ctx.lineWidth = rand(1, 3);
      const y = y0 + rand(4, plank - 4);
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.bezierCurveTo(WOOD_W * 0.33, y + rand(-9, 9), WOOD_W * 0.66, y + rand(-9, 9), WOOD_W + 20, y + rand(-6, 6));
      ctx.stroke();
    }
    // the odd knot
    if (Math.random() < 0.6) {
      const kx = rand(60, WOOD_W - 60), ky = y0 + rand(14, plank - 14);
      for (let r = rand(7, 13); r > 1; r -= 2.4) {
        ctx.strokeStyle = `hsla(${base - 6}, 45%, ${rand(15, 25)}%, .32)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 1.5, r, rand(-0.2, 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // plank seams
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(0, y0 + plank - 3, WOOD_W, 3);
    ctx.fillStyle = 'rgba(255,235,200,.07)';
    ctx.fillRect(0, y0, WOOD_W, 2);
  }
  // vignette
  const v = ctx.createRadialGradient(WOOD_W / 2, WOOD_H / 2, WOOD_H * 0.28, WOOD_W / 2, WOOD_H / 2, WOOD_H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WOOD_W, WOOD_H);
  splatCtx.clearRect(0, 0, WOOD_W, WOOD_H);
  woodCtx.drawImage(baseCanvas, 0, 0);
  woodTexture.needsUpdate = true;
}
paintWood();

// Menu backdrop: sakura sky with misty mountain layers, painted once.
const menuCanvas = document.createElement('canvas');
menuCanvas.width = WOOD_W; menuCanvas.height = WOOD_H;
const menuTexture = new THREE.CanvasTexture(menuCanvas);
menuTexture.colorSpace = THREE.SRGBColorSpace;
function paintSakuraScene() {
  const ctx = menuCanvas.getContext('2d');
  const W = WOOD_W, H = WOOD_H;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8fd4f2');
  sky.addColorStop(0.45, '#c8e9f4');
  sky.addColorStop(0.75, '#f4dde6');
  sky.addColorStop(1, '#eec3d2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // soft sun
  const sun = ctx.createRadialGradient(W * 0.72, H * 0.24, 10, W * 0.72, H * 0.24, 190);
  sun.addColorStop(0, 'rgba(255,246,214,.9)');
  sun.addColorStop(1, 'rgba(255,246,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  // mountain silhouettes, back to front
  const layers = [
    { base: H * 0.52, amp: 90, col: 'rgba(110,162,205,.55)' },
    { base: H * 0.62, amp: 120, col: 'rgba(72,124,178,.7)' },
    { base: H * 0.74, amp: 150, col: 'rgba(40,86,142,.85)' },
  ];
  for (const L of layers) {
    ctx.fillStyle = L.col;
    ctx.beginPath();
    ctx.moveTo(0, H);
    let y = L.base;
    for (let x = 0; x <= W; x += 24) {
      y = L.base - Math.abs(Math.sin(x * 0.011 + L.amp)) * L.amp - rand(0, 22);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
  // mist bands
  for (let i = 0; i < 3; i++) {
    const my = H * (0.5 + i * 0.13);
    const mist = ctx.createLinearGradient(0, my - 40, 0, my + 40);
    mist.addColorStop(0, 'rgba(240,246,250,0)');
    mist.addColorStop(0.5, 'rgba(240,246,250,.5)');
    mist.addColorStop(1, 'rgba(240,246,250,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, my - 40, W, 80);
  }
  // soft sakura canopies in the top corners
  for (const [cx, cy, n] of [[W * 0.02, H * 0.05, 60], [W * 0.99, H * 0.09, 52]]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0, 170);
      const r = rand(9, 26);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      const hue = rand(335, 350);
      g.addColorStop(0, `hsla(${hue}, 72%, 86%, ${rand(0.35, 0.6)})`);
      g.addColorStop(1, `hsla(${hue}, 72%, 86%, 0)`);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * d * 1.5, cy + Math.sin(a) * d * 0.7);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // ground vignette so the parade fruit reads against it
  const gv = ctx.createLinearGradient(0, H * 0.72, 0, H);
  gv.addColorStop(0, 'rgba(46,26,36,0)');
  gv.addColorStop(1, 'rgba(46,26,36,.55)');
  ctx.fillStyle = gv;
  ctx.fillRect(0, 0, W, H);
  menuTexture.needsUpdate = true;
}
paintSakuraScene();

function setWallScene(mode) {
  wallScene = mode;
  if (wallMesh) {
    wallMesh.material.map = mode === 'menu' ? menuTexture : woodTexture;
    wallMesh.material.needsUpdate = true;
  }
}

// Fade the juice layer and re-composite while any splats are alive.
function updateWall(dt) {
  const now = performance.now();
  if (!splatDirty && now > splatActiveUntil) return;
  splatFadeAcc += dt;
  if (splatFadeAcc > 0.12 || splatDirty) {
    splatCtx.save();
    splatCtx.globalCompositeOperation = 'destination-out';
    splatCtx.globalAlpha = Math.min(0.08, splatFadeAcc * 0.35);
    splatCtx.fillStyle = '#fff';
    splatCtx.fillRect(0, 0, WOOD_W, WOOD_H);
    splatCtx.restore();
    splatFadeAcc = 0;
    splatDirty = false;
    woodCtx.clearRect(0, 0, WOOD_W, WOOD_H);
    woodCtx.drawImage(baseCanvas, 0, 0);
    woodCtx.drawImage(splatCanvas, 0, 0);
    woodTexture.needsUpdate = true;
  }
}

let wallMesh, wallHalfW = 1, wallHalfH = 1, wallScene = 'menu';
function buildWall() {
  const dist = CAMERA_Z - WALL_Z;
  wallHalfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * 1.05;
  wallHalfW = Math.max(wallHalfH * camera.aspect * 1.05, wallHalfH);
  if (wallMesh) { wallMesh.geometry.dispose(); scene.remove(wallMesh); }
  wallMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wallHalfW * 2, wallHalfH * 2),
    // toneMapped: false keeps the hand-painted wall colors exact while the
    // fruit gets the filmic treatment
    new THREE.MeshBasicMaterial({ map: wallScene === 'menu' ? menuTexture : woodTexture, toneMapped: false })
  );
  wallMesh.position.z = WALL_Z;
  scene.add(wallMesh);
}

// Paint a juice splat onto the wood canvas at a world position.
function splatWall(worldPos, cssColor, size) {
  // Project the fruit position onto the wall plane (towards the camera ray).
  const t = (WALL_Z - CAMERA_Z) / (worldPos.z - CAMERA_Z);
  const wx = (worldPos.x - 0) * t, wy = (worldPos.y - 0) * t;
  const u = (wx + wallHalfW) / (wallHalfW * 2) * WOOD_W;
  const v = (1 - (wy + wallHalfH) / (wallHalfH * 2)) * WOOD_H;
  const ctx = splatCtx;
  const px = size * WOOD_W * 0.026;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = cssColor;
  // main blob
  ctx.beginPath();
  ctx.ellipse(u, v, px * rand(0.8, 1.15), px * rand(0.7, 1.05), rand(0, Math.PI), 0, Math.PI * 2);
  ctx.fill();
  // satellite drips
  for (let i = 0; i < 7; i++) {
    const a = rand(0, Math.PI * 2), d = px * rand(0.7, 1.9), r = px * rand(0.08, 0.28);
    ctx.beginPath();
    ctx.ellipse(u + Math.cos(a) * d, v + Math.sin(a) * d, r, r * rand(1, 2.2), a, 0, Math.PI * 2);
    ctx.fill();
  }
  // a couple of gravity drips
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 3; i++) {
    const dx = rand(-px * 0.5, px * 0.5);
    ctx.fillRect(u + dx, v, Math.max(1.2, px * 0.07), px * rand(0.9, 2.2));
  }
  ctx.restore();
  splatDirty = true;
  splatActiveUntil = performance.now() + 9000;
}

// ---------------------------------------------------------------------------
// 2D FX canvas: blade trail, droplets, floating text, flashes.
// ---------------------------------------------------------------------------
const fx = document.getElementById('fx');
const fxCtx = fx.getContext('2d');
let DPR = 1;

let lastW = 0, lastH = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return; // iframe not laid out yet — try again next frame
  lastW = w; lastH = h;
  DPR = Math.min(devicePixelRatio, 2);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fx.width = w * DPR; fx.height = h * DPR;
  fx.style.width = w + 'px'; fx.style.height = h + 'px';
  fxCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  updateFrustum();
  buildWall();
}
addEventListener('resize', resize);
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();

// Surface fatal errors on screen — embedded viewers have no console.
function showFatal(msg) {
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:rgba(120,10,0,.92);color:#ffe9b0;font:12px monospace;padding:8px 10px;border-radius:8px;word-break:break-all;';
    document.body.appendChild(el);
  }
  el.textContent = 'Error: ' + msg;
}
addEventListener('error', (e) => showFatal(e.message || String(e.error || e)));
addEventListener('unhandledrejection', (e) => showFatal(String(e.reason)));

// ---------------------------------------------------------------------------
// Audio: tiny procedural synth, created on first user gesture.
// ---------------------------------------------------------------------------
let AC = null;
function audioInit() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
}
function noiseBuffer(dur) {
  const n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function playSwoosh() {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuffer(0.22);
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
  f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.connect(f).connect(g).connect(AC.destination); src.start(t);
}
function playSplat() {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuffer(0.14);
  const f = AC.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + 0.13);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(f).connect(g).connect(AC.destination); src.start(t);
  const o = AC.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(rand(190, 240), t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
  const og = AC.createGain();
  og.gain.setValueAtTime(0.14, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(og).connect(AC.destination); o.start(t); o.stop(t + 0.12);
}
function playThrow() {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(rand(280, 340), t);
  o.frequency.exponentialRampToValueAtTime(rand(700, 900), t + 0.16);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.2);
}
function playBomb() {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuffer(0.9);
  const f = AC.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.8);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  src.connect(f).connect(g).connect(AC.destination); src.start(t);
  const o = AC.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.7);
  const og = AC.createGain();
  og.gain.setValueAtTime(0.45, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  o.connect(og).connect(AC.destination); o.start(t); o.stop(t + 0.8);
}
function playMiss() {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = 'square';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.3);
}

// ---------------------------------------------------------------------------
// Fruit model loading
// ---------------------------------------------------------------------------
const fruitDefs = []; // { type, geometry, radius(display), juice }
let sharedMaterial = null;

function loadFruits() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/fruits/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        const m = /SM_Fruits_([A-Za-z]+)/.exec(obj.name);
        const type = m ? m[1] : 'Apple';
        // Bake the node transform into the geometry, then center + normalize
        // so every fruit is radius 1 around its own origin.
        const geo = obj.geometry.clone();
        geo.applyMatrix4(obj.matrixWorld);
        geo.computeBoundingSphere();
        const c = geo.boundingSphere.center, r = geo.boundingSphere.radius;
        geo.translate(-c.x, -c.y, -c.z);
        geo.scale(1 / r, 1 / r, 1 / r);
        geo.computeBoundingSphere();
        if (!sharedMaterial) {
          sharedMaterial = obj.material;
          sharedMaterial.side = THREE.DoubleSide; // no see-through gaps on halves
          sharedMaterial.roughness = 0.35;       // glossy skin catches the key light
          sharedMaterial.metalness = 0.0;
        }
        fruitDefs.push({
          type,
          geometry: geo,
          radius: SIZE[type] ?? 1.0,
          juice: JUICE[type] ?? '#ffce54',
        });
      });
      fruitDefs.length ? resolve() : reject(new Error('no fruit meshes found'));
    }, undefined, reject);
  });
}

// ---------------------------------------------------------------------------
// Flesh caps: procedural cross-section textures shown on sliced halves.
// ---------------------------------------------------------------------------
const capGeo = new THREE.CircleGeometry(1, 28);
const fleshMats = {}; // type -> material (cloned per half so fades work)

function fleshCanvas(type) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2, r = S / 2;
  const ring = (r0, r1, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cx, r * r1, 0, Math.PI * 2);
    ctx.arc(cx, cx, r * r0, 0, Math.PI * 2, true);
    ctx.fill();
  };
  const disc = (rr, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cx, r * rr, 0, Math.PI * 2);
    ctx.fill();
  };
  const seeds = (n, rr, size, color, jitter = 0.06) => {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const d = r * (rr + rand(-jitter, jitter));
      ctx.save();
      ctx.translate(cx + Math.cos(a) * d, cx + Math.sin(a) * d);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.55, size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  const radialLines = (n, r0, r1, color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * r0, cx + Math.sin(a) * r * r0);
      ctx.lineTo(cx + Math.cos(a) * r * r1, cx + Math.sin(a) * r * r1);
      ctx.stroke();
    }
  };
  switch (type) {
    case 'Watermelon': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#ff6a5e'); g.addColorStop(0.75, '#f4413a'); g.addColorStop(1, '#e83a34');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      seeds(11, 0.52, 8, '#2a1a12'); seeds(7, 0.28, 7, '#3a241a');
      ring(0.86, 0.94, '#f7f2df'); ring(0.94, 1, '#3d8a3d');
      break;
    }
    case 'Apple': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#fbf3d0'); g.addColorStop(1, '#f2e2ac');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#5a3418';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r * 0.14, cx + Math.sin(a) * r * 0.14);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ring(0.95, 1, '#d8433a');
      break;
    }
    case 'Orange': {
      disc(1, '#ff9c2e');
      radialLines(10, 0.12, 0.86, 'rgba(255,232,180,.85)', 7);
      disc(0.1, '#ffd9a0');
      ring(0.86, 0.94, '#ffe9c4'); ring(0.94, 1, '#f28313');
      break;
    }
    case 'Banana': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#faf0cc'); g.addColorStop(1, '#f0e0a8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#6a4a24';
      for (const [dx, dy] of [[-14, -8], [16, -4], [0, 16]]) {
        ctx.beginPath(); ctx.arc(cx + dx, cx + dy, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ring(0.93, 1, '#f2d84a');
      break;
    }
    case 'Coconut': {
      disc(1, '#6a4a2e'); ring(0, 0.9, '#f7f2e8');
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r * 0.5);
      g.addColorStop(0, 'rgba(220,228,232,.9)'); g.addColorStop(1, 'rgba(247,242,232,0)');
      ctx.fillStyle = g; disc(0.5, ctx.fillStyle);
      break;
    }
    case 'Dragonfruit': {
      disc(1, '#f4f0ea');
      ctx.fillStyle = '#241a18';
      for (let i = 0; i < 90; i++) {
        const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * r * 0.82;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 2.4, 3.6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ring(0.86, 0.93, '#f0d9e4'); ring(0.93, 1, '#e0407e');
      break;
    }
    case 'Grape': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#efe2f4'); g.addColorStop(0.8, '#d9c2e8'); g.addColorStop(1, '#b08ac8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ring(0.9, 1, '#7a4ba0');
      break;
    }
    case 'Cherries': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#e84a52'); g.addColorStop(1, '#b01f30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      disc(0.22, '#f0d8b8'); ring(0.94, 1, '#8a1524');
      break;
    }
    case 'Avocado': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#f2e8b0'); g.addColorStop(0.7, '#c8d470'); g.addColorStop(1, '#7ea23e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      const pit = ctx.createRadialGradient(cx - 8, cx - 8, 4, cx, cx, r * 0.4);
      pit.addColorStop(0, '#a06a3c'); pit.addColorStop(1, '#6a4222');
      ctx.fillStyle = pit; disc(0.4, ctx.fillStyle);
      ring(0.95, 1, '#3d5a1e');
      break;
    }
    case 'Mangostan': {
      disc(1, '#f7f0e6');
      ctx.strokeStyle = 'rgba(190,160,150,.5)'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cx);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.3) * r * 0.5, cx + Math.sin(a + 0.3) * r * 0.5,
          cx + Math.cos(a) * r * 0.8, cx + Math.sin(a) * r * 0.8);
        ctx.stroke();
      }
      ring(0.8, 0.9, '#e8c8d8'); ring(0.9, 1, '#7a2a5a');
      break;
    }
    case 'Pineapple': {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
      g.addColorStop(0, '#ffe9a0'); g.addColorStop(1, '#f7c73e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      radialLines(26, 0.15, 0.9, 'rgba(255,244,200,.55)', 3);
      disc(0.13, '#f7e9b8'); ring(0.92, 1, '#8a5a24');
      break;
    }
    default:
      disc(1, JUICE[type] || '#ffce54');
  }
  return c;
}

function fleshMaterial(type) {
  if (!fleshMats[type]) {
    const tex = new THREE.CanvasTexture(fleshCanvas(type));
    tex.colorSpace = THREE.SRGBColorSpace;
    fleshMats[type] = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.5, metalness: 0, side: THREE.DoubleSide,
    });
  }
  return fleshMats[type].clone(); // cloned so each half can fade independently
}

// Bomb model: black sphere + neck + fuse, built from primitives.
function makeBombMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.35, metalness: 0.55 })
  );
  g.add(body);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.5, metalness: 0.4 })
  );
  neck.position.y = 1.05;
  g.add(neck);
  const fuse = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.055, 6, 12, Math.PI * 1.4),
    new THREE.MeshStandardMaterial({ color: 0xc8a25a, roughness: 0.9 })
  );
  fuse.position.set(0.06, 1.3, 0);
  fuse.rotation.z = -0.5;
  g.add(fuse);
  const spark = new THREE.PointLight(0xffa030, 6, 5);
  spark.position.set(0.28, 1.5, 0);
  g.add(spark);
  g.userData.spark = spark;
  return g;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const fruits = [];  // live throwables: { mesh, vel, angVel, radius, def?, isBomb, power, missed }
const halves = [];  // sliced halves: { mesh, vel, angVel, life }
const droplets = []; // 2D juice particles
const texts = [];    // floating score/combo text
const petals = [];   // sakura petals on the fx canvas (menu only)
let flash = 0;       // white screen flash alpha
let shake = 0;       // camera shake amount

// Power-up bananas (sliced to activate)
const POWERS = {
  freeze: { tint: 0x7fdcff, dur: 6, label: 'SLOW MOTION!', icon: UI.bananaFreeze },
  frenzy: { tint: 0xd97fff, dur: 0, label: 'FRENZY!', icon: UI.bananaFrenzy },
  double: { tint: 0xffd24a, dur: 8, label: 'DOUBLE POINTS!', icon: UI.bananaDouble },
};
let freezeT = 0, doubleT = 0;      // remaining effect time
let activePower = null, activePowerT = 0, activePowerDur = 1;
let frenzyQueue = 0, frenzyTimer = 0;
let menuMelon = null;

// localStorage throws in some sandboxed embeds — degrade to in-memory best.
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* session-only */ } },
};

let state = 'menu'; // menu | playing | over
let score = 0, best = Number(storage.get('fruitNinjaBest') || 0);
let lives = MAX_LIVES;
let spawnTimer = 1.2;
let elapsed = 0;

// combo tracking
let comboCount = 0, comboTimer = 0, comboPos = { x: 0, y: 0 };

const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('hudBest');
const livesEl = document.getElementById('lives');
const startOverlay = document.getElementById('startOverlay');
const startRing = document.getElementById('startRing');
const loadingEl = document.getElementById('loading');
const overOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const newBestEl = document.getElementById('newBest');
const restartBtn = document.getElementById('restartBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');
const powerChip = document.getElementById('powerChip');
const powerIcon = powerChip.querySelector('img');
const powerBar = powerChip.querySelector('.bar i');
bestEl.textContent = 'BEST ' + best;
let assetsReady = false;

// sprite-based UI chrome
pauseBtn.innerHTML = `<img src="${UI.pause}" alt="" />`;
pauseBtn.style.display = 'none';
for (let i = 0; i < MAX_LIVES; i++) {
  const img = document.createElement('img');
  img.src = UI.xRed;
  img.alt = 'life';
  livesEl.appendChild(img);
}

function setScore(v) {
  score = v;
  scoreEl.textContent = String(v);
}
function updateLivesUI() {
  const lost = MAX_LIVES - lives;
  [...livesEl.children].forEach((el, i) => {
    const isLost = i >= MAX_LIVES - lost;
    el.classList.toggle('lost', isLost);
    el.src = isLost ? UI.xGrey : UI.xRed;
  });
}

function clearWorld() {
  for (const f of fruits) scene.remove(f.mesh);
  for (const h of halves) { scene.remove(h.mesh); h.mesh.material.dispose(); }
  fruits.length = halves.length = droplets.length = texts.length = 0;
}

function spawnMenuMelon() {
  const def = fruitDefs.find((d) => d.type === 'Watermelon') || fruitDefs[0];
  if (!def || menuMelon) return;
  menuMelon = new THREE.Mesh(def.geometry, sharedMaterial);
  menuMelon.scale.setScalar(1.9);
  menuMelon.position.set(0, 0, 2);
  menuMelon.rotation.set(0.35, 0, -0.1);
  scene.add(menuMelon);
}
function removeMenuMelon() {
  if (menuMelon) { scene.remove(menuMelon); menuMelon = null; }
}

function resetPowers() {
  freezeT = doubleT = 0;
  frenzyQueue = 0;
  activePower = null;
  powerChip.classList.remove('on');
}

function startGame() {
  if (!assetsReady) return;
  audioInit();
  clearWorld();
  removeMenuMelon();
  petals.length = 0;
  resetPowers();
  paintWood(); // fresh, unstained wall
  setWallScene('wood');
  setScore(0);
  lives = MAX_LIVES;
  updateLivesUI();
  elapsed = 0;
  spawnTimer = 0.6;
  comboCount = 0;
  state = 'playing';
  startOverlay.classList.add('hidden');
  overOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  hud.classList.add('visible');
  pauseBtn.style.display = 'block';
}

function pauseGame() {
  if (state !== 'playing' || userPaused) return;
  userPaused = true;
  pauseOverlay.classList.remove('hidden');
  pauseBtn.style.display = 'none';
}
function resumeGame() {
  if (!userPaused) return;
  userPaused = false;
  clock.getDelta(); // swallow the pause gap
  pauseOverlay.classList.add('hidden');
  pauseBtn.style.display = 'block';
}
function quitToMenu() {
  userPaused = false;
  state = 'menu';
  clearWorld();
  resetPowers();
  setWallScene('menu');
  spawnMenuMelon();
  pauseOverlay.classList.add('hidden');
  overOverlay.classList.add('hidden');
  hud.classList.remove('visible');
  pauseBtn.style.display = 'none';
  startOverlay.classList.remove('hidden');
}

function gameOver(byBomb) {
  state = 'over';
  resetPowers();
  pauseBtn.style.display = 'none';
  if (byBomb) { flash = 1; shake = 1; playBomb(); }
  if (score > best) {
    best = score;
    storage.set('fruitNinjaBest', String(best));
    newBestEl.classList.remove('hidden');
  } else {
    newBestEl.classList.add('hidden');
  }
  bestEl.textContent = 'BEST ' + best;
  finalScoreEl.textContent = 'Score: ' + score;
  setTimeout(() => {
    hud.classList.remove('visible');
    overOverlay.classList.remove('hidden');
  }, byBomb ? 900 : 350);
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
function launchOne(isBomb, power = null) {
  let def = pick(fruitDefs);
  if (power) def = fruitDefs.find((d) => d.type === 'Banana') || def;
  let mesh, radius;
  if (isBomb) {
    mesh = makeBombMesh();
    radius = 0.85 * FRUIT_SCALE;
    mesh.scale.setScalar(radius);
  } else {
    radius = def.radius * FRUIT_SCALE;
    mesh = new THREE.Mesh(def.geometry, sharedMaterial);
    mesh.scale.setScalar(radius);
    if (power) {
      // additive glow shell so the power banana reads as special
      const glow = new THREE.Mesh(def.geometry, new THREE.MeshBasicMaterial({
        color: POWERS[power].tint, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.setScalar(1.22);
      mesh.add(glow);
    }
  }
  const x = rand(-halfW * 0.7, halfW * 0.7);
  const z = rand(FRUIT_Z_FAR, FRUIT_Z_NEAR);
  mesh.position.set(x, -halfH - 1.6, z);
  mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
  const apex = halfH * rand(1.18, 1.75); // height above launch point
  const vy = Math.sqrt(2 * -GRAVITY * apex);
  const vel = new THREE.Vector3(-x * rand(0.06, 0.16) + rand(-1.2, 1.2), vy, 0);
  const angVel = new THREE.Vector3(rand(-2.5, 2.5), rand(-2.5, 2.5), rand(-2.5, 2.5));
  scene.add(mesh);
  fruits.push({ mesh, vel, angVel, radius, def: isBomb ? null : def, isBomb, power, missed: false });
  playThrow();
}

function spawnWave() {
  const difficulty = Math.min(1, elapsed / 75); // ramps over ~75s
  const n = 1 + Math.floor(rand(0, 2.2 + difficulty * 2.6));
  const bombChance = score < 4 ? 0 : 0.10 + difficulty * 0.16;
  // rare power-up banana, once things are rolling and no effect is active
  if (score >= 8 && !activePower && Math.random() < 0.09) {
    const type = pick(Object.keys(POWERS));
    setTimeout(() => { if (state === 'playing') launchOne(false, type); }, rand(60, 400));
  }
  for (let i = 0; i < n; i++) {
    const isBomb = Math.random() < bombChance;
    setTimeout(() => { if (state === 'playing') launchOne(isBomb); }, i * rand(90, 260));
  }
  spawnTimer = rand(1.5, 2.3) - difficulty * 0.8;
}

// ---------------------------------------------------------------------------
// Input: pointer swipes
// ---------------------------------------------------------------------------
const trail = [];       // {x, y, t}
let pointerDown = false;
let sliceSegments = []; // segments accumulated since last frame

function addPoint(x, y) {
  const t = performance.now();
  const last = trail[trail.length - 1];
  trail.push({ x, y, t });
  if (last) {
    const dt = Math.max(1, t - last.t);
    const speed = Math.hypot(x - last.x, y - last.y) / dt; // px per ms
    if (speed > 0.25) sliceSegments.push({ x1: last.x, y1: last.y, x2: x, y2: y });
  }
  if (trail.length > 40) trail.shift();
}
addEventListener('pointerdown', (e) => {
  pointerDown = true;
  trail.length = 0;
  addPoint(e.clientX, e.clientY);
  if (AC) playSwoosh();
});
addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  if (coalesced.length) for (const ce of coalesced) addPoint(ce.clientX, ce.clientY);
  else addPoint(e.clientX, e.clientY);
});
addEventListener('pointerup', () => { pointerDown = false; });
addEventListener('pointercancel', () => { pointerDown = false; });

// Project world position to CSS pixels.
const _proj = new THREE.Vector3();
function toScreen(pos) {
  _proj.copy(pos).project(camera);
  return { x: (_proj.x + 1) / 2 * innerWidth, y: (1 - _proj.y) / 2 * innerHeight };
}
function segPointDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

// ---------------------------------------------------------------------------
// Slicing
// ---------------------------------------------------------------------------
const _camRight = new THREE.Vector3(1, 0, 0);
const _camUp = new THREE.Vector3(0, 1, 0);

function sliceFruit(f, seg) {
  const idx = fruits.indexOf(f);
  if (idx < 0) return;
  fruits.splice(idx, 1);
  scene.remove(f.mesh);

  if (f.isBomb) {
    bombExplosion(f.mesh.position);
    gameOver(true);
    return;
  }

  // World-space slice plane: swipe direction on screen -> plane normal
  // perpendicular to it (camera is axis-aligned, so screen right/up map to
  // world +x/+y).
  const dx = seg.x2 - seg.x1, dy = -(seg.y2 - seg.y1);
  const len = Math.hypot(dx, dy) || 1;
  const normal = new THREE.Vector3()
    .addScaledVector(_camRight, -dy / len)
    .addScaledVector(_camUp, dx / len);

  const center = f.mesh.position.clone();
  for (const sideSign of [1, -1]) {
    // This half keeps geometry on the n side of the cut and flies along n.
    const n = normal.clone().multiplyScalar(sideSign);
    const plane = new THREE.Plane(n.clone(), -n.dot(center));
    const mat = sharedMaterial.clone();
    mat.clippingPlanes = [plane];
    const mesh = new THREE.Mesh(f.def.geometry, mat);
    mesh.position.copy(center);
    mesh.quaternion.copy(f.mesh.quaternion);
    mesh.scale.copy(f.mesh.scale);
    // Flesh cap: a textured disc in the cut plane. The half only ever spins
    // around the cut normal, so the disc stays exactly on the cut forever.
    const capMat = fleshMaterial(f.def.type);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.scale.setScalar(CAP[f.def.type] ?? 0.8);
    const nLocal = n.clone().applyQuaternion(mesh.quaternion.clone().invert()).normalize();
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nLocal);
    mesh.add(cap);
    scene.add(mesh);
    const vel = f.vel.clone().multiplyScalar(0.55).addScaledVector(n, rand(2.6, 4.2));
    vel.y += rand(0.5, 2);
    // Spin only around the cut normal: that rotation leaves the world-space
    // clip plane consistent with the mesh, so the cut face never drifts.
    const spin = rand(2.5, 5.5) * (Math.random() < 0.5 ? -1 : 1);
    halves.push({ mesh, vel, n, plane, spin, capMat, life: 2.6 });
  }

  // FX
  const s = toScreen(center);
  spawnDroplets(s.x, s.y, f.def.juice, 16 + f.radius * 8);
  splatWall(center, f.def.juice, f.radius);
  playSplat();

  if (f.power) activatePower(f.power, s);

  // Scoring: occasional critical hit, doubled while the gold banana is live.
  const critical = Math.random() < 0.07;
  const mult = doubleT > 0 ? 2 : 1;
  const points = (critical ? 10 : 1) * mult;
  setScore(score + points);
  texts.push({
    str: critical ? `CRITICAL +${points}` : `+${points}`,
    x: s.x, y: s.y, vy: -0.05,
    life: critical ? 1.4 : 0.8,
    size: critical ? 30 : 20,
    color: critical ? '#7dff6a' : mult > 1 ? '#ffd23f' : '#ffe9b0',
  });

  // combo bookkeeping
  comboCount++;
  comboTimer = 0.32;
  comboPos = s;
}

function activatePower(type, s) {
  const P = POWERS[type];
  texts.push({ str: P.label, x: s.x, y: s.y - 20, vy: -0.04, life: 1.6, size: 34, color: '#' + P.tint.toString(16).padStart(6, '0') });
  playSwoosh();
  if (type === 'freeze') freezeT = P.dur;
  if (type === 'double') doubleT = P.dur;
  if (type === 'frenzy') { frenzyQueue = 9; frenzyTimer = 0.1; }
  if (P.dur > 0) {
    activePower = type; activePowerT = P.dur; activePowerDur = P.dur;
    powerIcon.src = P.icon;
    powerChip.classList.add('on');
  }
}

function resolveCombo() {
  if (comboCount >= 3) {
    const bonus = comboCount * (doubleT > 0 ? 2 : 1);
    setScore(score + bonus);
    texts.push({
      str: `${comboCount} FRUIT COMBO! +${bonus}`,
      x: comboPos.x, y: comboPos.y - 30, vy: -0.04,
      life: 1.6, size: 32, color: '#ffd23f',
    });
    playSwoosh();
  }
  comboCount = 0;
}

function bombExplosion(pos) {
  const s = toScreen(pos);
  spawnDroplets(s.x, s.y, '#ffb347', 40);
  spawnDroplets(s.x, s.y, '#555555', 30);
}

function spawnDroplets(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(2, 11);
    droplets.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
      r: rand(2, 6.5), color, life: rand(0.5, 0.95), maxLife: 0.95,
    });
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function update(dt) {
  // Freeze banana: slow the simulation, not the blade or UI.
  const simDt = dt * (freezeT > 0 ? 0.45 : 1);
  elapsed += simDt;

  if (freezeT > 0) freezeT = Math.max(0, freezeT - dt);
  if (doubleT > 0) doubleT = Math.max(0, doubleT - dt);
  if (activePower) {
    activePowerT -= dt;
    powerBar.style.width = Math.max(0, (activePowerT / activePowerDur) * 100) + '%';
    if (activePowerT <= 0) { activePower = null; powerChip.classList.remove('on'); }
  }
  if (frenzyQueue > 0 && state === 'playing') {
    frenzyTimer -= dt;
    if (frenzyTimer <= 0) { launchOne(false); frenzyQueue--; frenzyTimer = rand(0.12, 0.3); }
  }
  if (menuMelon) {
    menuMelon.rotation.y += dt * 0.9;
    // pin the melon to the center of the start ring, whatever the layout
    const r = startRing.getBoundingClientRect();
    if (r.width) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = CAMERA_Z - menuMelon.position.z;
      const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
      menuMelon.position.x = ((cx / innerWidth) * 2 - 1) * th * camera.aspect;
      menuMelon.position.y = (1 - (cy / innerHeight) * 2) * th;
      // size the melon to the ring's inner hole
      const px = r.width * 0.5 * 0.55; // hole radius in css px
      const world = (px / (innerHeight / 2)) * th;
      menuMelon.scale.setScalar(Math.max(0.8, world));
    }
  }

  if (state === 'playing') {
    spawnTimer -= simDt;
    if (spawnTimer <= 0) spawnWave();

    if (comboCount > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) resolveCombo();
    }

    // slice detection
    if (sliceSegments.length) {
      for (const f of [...fruits]) {
        const s = toScreen(f.mesh.position);
        const dist = CAMERA_Z - f.mesh.position.z;
        const rPx = (f.radius * 1.12) * (innerHeight / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist);
        for (const seg of sliceSegments) {
          if (segPointDist(seg.x1, seg.y1, seg.x2, seg.y2, s.x, s.y) < rPx) {
            sliceFruit(f, seg);
            break;
          }
        }
      }
    }
  }
  sliceSegments = [];

  // physics: whole fruit
  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    f.vel.y += GRAVITY * simDt;
    f.mesh.position.addScaledVector(f.vel, simDt);
    f.mesh.rotation.x += f.angVel.x * simDt;
    f.mesh.rotation.y += f.angVel.y * simDt;
    f.mesh.rotation.z += f.angVel.z * simDt;
    if (f.isBomb) {
      const spark = f.mesh.userData.spark;
      if (spark) spark.intensity = 4 + Math.sin(elapsed * 30 + i) * 3;
    }
    if (f.vel.y < 0 && f.mesh.position.y < -halfH - 2) {
      fruits.splice(i, 1);
      scene.remove(f.mesh);
      if (!f.isBomb && !f.power && state === 'playing') {
        lives--;
        updateLivesUI();
        playMiss();
        if (lives <= 0) gameOver(false);
      }
    }
  }

  // physics: halves
  for (let i = halves.length - 1; i >= 0; i--) {
    const h = halves[i];
    h.vel.y += GRAVITY * simDt;
    h.mesh.position.addScaledVector(h.vel, simDt);
    h.mesh.rotateOnWorldAxis(h.n, h.spin * simDt);
    h.plane.constant = -h.n.dot(h.mesh.position); // keep cut anchored to the half
    h.life -= simDt;
    if (h.life < 0.5) {
      h.mesh.material.opacity = h.life / 0.5;
      h.capMat.opacity = h.life / 0.5;
    }
    if (h.life <= 0 || h.mesh.position.y < -halfH - 3) {
      scene.remove(h.mesh);
      h.mesh.material.dispose();
      h.capMat.dispose();
      halves.splice(i, 1);
    }
  }
  // enable transparency only when fading (materials are cloned per half)
  for (const h of halves) {
    if (h.life < 0.5 && !h.mesh.material.transparent) {
      h.mesh.material.transparent = true;
      h.capMat.transparent = true;
    }
  }

  updateWall(dt);

  // camera shake
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.2);
    camera.position.x = rand(-1, 1) * shake * 0.5;
    camera.position.y = rand(-1, 1) * shake * 0.5;
  } else {
    camera.position.x = 0; camera.position.y = 0;
  }
}

function drawFX(dt) {
  const ctx = fxCtx;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  // sakura petals drifting over the menu
  if (state !== 'playing') {
    while (petals.length < 26) {
      petals.push({
        x: rand(-40, innerWidth), y: rand(-innerHeight, -10),
        vx: rand(8, 30), vy: rand(24, 60),
        r: rand(3.5, 7), rot: rand(0, 6.28), vrot: rand(-1.5, 1.5),
        sway: rand(0.5, 1.6), phase: rand(0, 6.28),
        hue: rand(332, 350),
      });
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.phase += dt * p.sway;
      p.x += (p.vx + Math.sin(p.phase * 2) * 22) * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.y > innerHeight + 12 || p.x > innerWidth + 40) { petals.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + Math.sin(p.phase) * 0.6);
      ctx.fillStyle = `hsla(${p.hue}, 78%, 84%, .9)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (petals.length) {
    petals.length = 0;
  }

  // blade trail: tapered ribbon through recent points
  const now = performance.now();
  while (trail.length && now - trail[0].t > 130) trail.shift();
  if (pointerDown && trail.length > 2) {
    const pts = trail;
    ctx.save();
    ctx.lineJoin = ctx.lineCap = 'round';
    // outer glow
    ctx.globalCompositeOperation = 'lighter';
    for (const [width, color, blur] of [
      [16, 'rgba(120,190,255,0.28)', 18],
      [9, 'rgba(255,255,255,0.55)', 8],
    ]) {
      ctx.shadowColor = color; ctx.shadowBlur = blur;
      ctx.strokeStyle = color;
      for (let i = 1; i < pts.length; i++) {
        const age = (now - pts[i].t) / 130;
        ctx.lineWidth = Math.max(0.5, width * (1 - age));
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    // white core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    for (let i = 1; i < pts.length; i++) {
      const age = (now - pts[i].t) / 130;
      ctx.lineWidth = Math.max(0.4, 4.5 * (1 - age));
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // droplets
  for (let i = droplets.length - 1; i >= 0; i--) {
    const d = droplets[i];
    d.life -= dt;
    if (d.life <= 0) { droplets.splice(i, 1); continue; }
    d.vy += 22 * dt;
    d.x += d.vx; d.y += d.vy;
    ctx.globalAlpha = Math.min(1, d.life / d.maxLife + 0.15);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * (0.5 + d.life / d.maxLife * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // floating texts
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) { texts.splice(i, 1); continue; }
    t.y += t.vy * dt * 1000;
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.font = `900 ${t.size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(40,16,0,.85)';
    ctx.strokeText(t.str, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // white flash (bomb)
  if (flash > 0) {
    flash = Math.max(0, flash - dt * 1.4);
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
}

let paused = false, userPaused = false;
document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  if (!paused) clock.getDelta(); // swallow the pause gap
  else if (state === 'playing') pauseGame(); // don't lose a run in a hidden tab
});

function loop() {
  requestAnimationFrame(loop);
  // Self-heal: mobile embeds can lay out after load without firing resize.
  if (innerWidth !== lastW || innerHeight !== lastH) resize();
  if (!lastW || !lastH) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused && !userPaused) {
    update(dt);
    renderer.render(scene, camera);
    drawFX(dt);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
loadFruits().then(() => {
  assetsReady = true;
  loadingEl.textContent = "Tap the melon to start · Swipe to slice · Don't hit the bombs!";
  spawnMenuMelon();
  loop();
  menuParade();
}).catch((err) => {
  loadingEl.textContent = 'Failed to load fruit models :(';
  console.error(err);
});

let paradeTimer = null;
function menuParade() {
  if (paradeTimer) return;
  paradeTimer = setInterval(() => {
    if (state === 'menu' || state === 'over') {
      if (fruits.length < 3 && fruitDefs.length) launchOne(false);
    }
  }, 1700);
}

startRing.addEventListener('click', startGame);
startRing.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
});
restartBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
resumeBtn.addEventListener('click', resumeGame);
quitBtn.addEventListener('click', quitToMenu);

// Debug handle for automated tests.
window.__FN = {
  fruits, halves, toScreen, launchOne, trail, start: startGame,
  get segs() { return sliceSegments.length; },
  get ready() { return assetsReady; },
  get state() { return state; }, get score() { return score; }, get lives() { return lives; },
  get power() { return { freezeT, doubleT, activePower, frenzyQueue }; },
};
