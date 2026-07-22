import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

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
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, CAMERA_Z);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xfff2dd, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-6, 10, 12);
scene.add(sun);
const rim = new THREE.DirectionalLight(0xffb36b, 0.7);
rim.position.set(6, -4, 8);
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

let wallMesh, wallHalfW = 1, wallHalfH = 1;
function buildWall() {
  const dist = CAMERA_Z - WALL_Z;
  wallHalfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * 1.05;
  wallHalfW = Math.max(wallHalfH * camera.aspect * 1.05, wallHalfH);
  if (wallMesh) { wallMesh.geometry.dispose(); scene.remove(wallMesh); }
  wallMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wallHalfW * 2, wallHalfH * 2),
    new THREE.MeshBasicMaterial({ map: woodTexture })
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

function resize() {
  const w = innerWidth, h = innerHeight;
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
resize();

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
          sharedMaterial.side = THREE.DoubleSide; // show flesh inside sliced halves
          sharedMaterial.roughness = 0.7;
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
const fruits = [];  // live throwables: { mesh, vel, angVel, radius, def?, isBomb, missed }
const halves = [];  // sliced halves: { mesh, vel, angVel, life }
const droplets = []; // 2D juice particles
const texts = [];    // floating score/combo text
let flash = 0;       // white screen flash alpha
let shake = 0;       // camera shake amount

let state = 'menu'; // menu | playing | over
let score = 0, best = Number(localStorage.getItem('fruitNinjaBest') || 0);
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
const startBtn = document.getElementById('startBtn');
const overOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const newBestEl = document.getElementById('newBest');
const restartBtn = document.getElementById('restartBtn');
bestEl.textContent = 'BEST ' + best;

function setScore(v) {
  score = v;
  scoreEl.textContent = String(v);
}
function updateLivesUI() {
  const lost = MAX_LIVES - lives;
  [...livesEl.children].forEach((el, i) => el.classList.toggle('lost', i >= MAX_LIVES - lost));
}

function clearWorld() {
  for (const f of fruits) scene.remove(f.mesh);
  for (const h of halves) { scene.remove(h.mesh); h.mesh.material.dispose(); }
  fruits.length = halves.length = droplets.length = texts.length = 0;
}

function startGame() {
  audioInit();
  clearWorld();
  paintWood(); // fresh, unstained wall
  setScore(0);
  lives = MAX_LIVES;
  updateLivesUI();
  elapsed = 0;
  spawnTimer = 0.6;
  comboCount = 0;
  state = 'playing';
  startOverlay.classList.add('hidden');
  overOverlay.classList.add('hidden');
  hud.classList.add('visible');
}

function gameOver(byBomb) {
  state = 'over';
  if (byBomb) { flash = 1; shake = 1; playBomb(); }
  if (score > best) {
    best = score;
    localStorage.setItem('fruitNinjaBest', String(best));
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
function launchOne(isBomb) {
  const def = pick(fruitDefs);
  let mesh, radius;
  if (isBomb) {
    mesh = makeBombMesh();
    radius = 0.85 * FRUIT_SCALE;
    mesh.scale.setScalar(radius);
  } else {
    radius = def.radius * FRUIT_SCALE;
    mesh = new THREE.Mesh(def.geometry, sharedMaterial);
    mesh.scale.setScalar(radius);
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
  fruits.push({ mesh, vel, angVel, radius, def: isBomb ? null : def, isBomb, missed: false });
  playThrow();
}

function spawnWave() {
  const difficulty = Math.min(1, elapsed / 75); // ramps over ~75s
  const n = 1 + Math.floor(rand(0, 2.2 + difficulty * 2.6));
  const bombChance = score < 4 ? 0 : 0.10 + difficulty * 0.16;
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
    scene.add(mesh);
    const vel = f.vel.clone().multiplyScalar(0.55).addScaledVector(n, rand(2.6, 4.2));
    vel.y += rand(0.5, 2);
    // Spin only around the cut normal: that rotation leaves the world-space
    // clip plane consistent with the mesh, so the cut face never drifts.
    const spin = rand(2.5, 5.5) * (Math.random() < 0.5 ? -1 : 1);
    halves.push({ mesh, vel, n, plane, spin, life: 2.6 });
  }

  // FX
  const s = toScreen(center);
  spawnDroplets(s.x, s.y, f.def.juice, 16 + f.radius * 8);
  splatWall(center, f.def.juice, f.radius);
  playSplat();

  // Scoring: occasional critical hit.
  const critical = Math.random() < 0.07;
  const points = critical ? 10 : 1;
  setScore(score + points);
  texts.push({
    str: critical ? 'CRITICAL +10' : '+1',
    x: s.x, y: s.y, vy: -0.05,
    life: critical ? 1.4 : 0.8,
    size: critical ? 30 : 20,
    color: critical ? '#7dff6a' : '#ffe9b0',
  });

  // combo bookkeeping
  comboCount++;
  comboTimer = 0.32;
  comboPos = s;
}

function resolveCombo() {
  if (comboCount >= 3) {
    const bonus = comboCount;
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
  elapsed += dt;

  if (state === 'playing') {
    spawnTimer -= dt;
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
    f.vel.y += GRAVITY * dt;
    f.mesh.position.addScaledVector(f.vel, dt);
    f.mesh.rotation.x += f.angVel.x * dt;
    f.mesh.rotation.y += f.angVel.y * dt;
    f.mesh.rotation.z += f.angVel.z * dt;
    if (f.isBomb) {
      const spark = f.mesh.userData.spark;
      if (spark) spark.intensity = 4 + Math.sin(elapsed * 30 + i) * 3;
    }
    if (f.vel.y < 0 && f.mesh.position.y < -halfH - 2) {
      fruits.splice(i, 1);
      scene.remove(f.mesh);
      if (!f.isBomb && state === 'playing') {
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
    h.vel.y += GRAVITY * dt;
    h.mesh.position.addScaledVector(h.vel, dt);
    h.mesh.rotateOnWorldAxis(h.n, h.spin * dt);
    h.plane.constant = -h.n.dot(h.mesh.position); // keep cut anchored to the half
    h.life -= dt;
    if (h.life < 0.5) h.mesh.material.opacity = h.life / 0.5;
    if (h.life <= 0 || h.mesh.position.y < -halfH - 3) {
      scene.remove(h.mesh);
      h.mesh.material.dispose();
      halves.splice(i, 1);
    }
  }
  // enable transparency only when fading (material clone per half)
  for (const h of halves) if (h.life < 0.5 && !h.mesh.material.transparent) h.mesh.material.transparent = true;

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

let paused = false;
document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  if (!paused) clock.getDelta(); // swallow the pause gap
});

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    update(dt);
    renderer.render(scene, camera);
    drawFX(dt);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
startBtn.disabled = true;
loadFruits().then(() => {
  startBtn.disabled = false;
  startBtn.innerHTML = 'START';
  // menu garnish: a slow parade of fruit behind the title
  loop();
  menuParade();
}).catch((err) => {
  document.getElementById('loading').textContent = 'Failed to load fruit models :(';
  console.error(err);
});

let paradeTimer = null;
function menuParade() {
  if (paradeTimer) return;
  paradeTimer = setInterval(() => {
    if (state === 'menu' || state === 'over') {
      if (fruits.length < 4 && fruitDefs.length) launchOne(false);
    }
  }, 1400);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Debug handle for automated tests.
window.__FN = {
  fruits, halves, toScreen, launchOne, trail,
  get segs() { return sliceSegments.length; },
  get state() { return state; }, get score() { return score; }, get lives() { return lives; },
};
