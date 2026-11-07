// Standalone water test scene (water-test.html): a 10x5 m plaster pool with entry steps, a deep end, a sunken
// sun-shelf and a lounge platform notch (concave outline), a raised spa, pale limestone deck, floating balls.
// Same renderer / tone mapping / sky / sun / post as src/main.js so the look carries over.
//   ?cam=x,y,z,lx,ly,lz,fov   ?shot=1 (1080x720, deterministic, sets window.__ready)   ?nopost=1   ?perf=1
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { N8AOPass } from 'n8ao';
import { createPhysics } from '../physics.js';
import { createWater, waterBodies } from './index.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') === '1';
const PERF = params.get('perf') === '1';
window.__ready = false; window.__errors = [];
addEventListener('error', e => window.__errors.push(String(e.error?.stack || e.message)));
if (SHOT) document.body.classList.add('shot');

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT || PERF });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = () => (SHOT || PERF ? 1080 : innerWidth), H = () => (SHOT || PERF ? 720 : innerHeight);
renderer.setPixelRatio(SHOT || PERF ? 1 : Math.min(devicePixelRatio, 1.5)); renderer.setSize(W(), H(), !(SHOT || PERF));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.03, 4000);

const LIGHT = { sunDir: new THREE.Vector3(0.42, 0.62, 0.66).normalize(), sunIntensity: 3.2, sunColor: 0xfff1df, hemi: 0.35 };
const C = new THREE.Vector3(6, 0, 2.5);
const sun = new THREE.DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
sun.position.copy(C).addScaledVector(LIGHT.sunDir, 40); sun.target.position.copy(C); scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xeef3fa, 0xe8dccb, LIGHT.hemi));

const ENV = { outdoor: null, rotY: 0, pending: [] };
const outdoor = (m) => { if (ENV.outdoor) { m.envMap = ENV.outdoor; m.envMapRotation = new THREE.Euler(0, ENV.rotY, 0); m.needsUpdate = true; } else ENV.pending.push(m); return m; };
async function loadEnv() {
  const hdr = await new HDRLoader().loadAsync('assets/ph/golden_gate_hills/golden_gate_hills_2k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const { data, width, height } = hdr.image; let best = -1, bi = 0; const stride = data.length / (width * height);
  const f = data.constructor.name === 'Uint16Array' ? THREE.DataUtils.fromHalfFloat : (v) => v;
  for (let i = 0; i < width * height; i += 3) { const l = f(data[i * stride]) + f(data[i * stride + 1]) + f(data[i * stride + 2]); if (l > best) { best = l; bi = i; } }
  const u = (bi % width) / width; const rotY = Math.atan2(LIGHT.sunDir.z, LIGHT.sunDir.x) - (u - 0.5) * 2 * Math.PI;
  const pmrem = new THREE.PMREMGenerator(renderer);
  ENV.outdoor = pmrem.fromEquirectangular(hdr).texture; ENV.rotY = rotY;
  scene.environment = ENV.outdoor; scene.environmentRotation.set(0, rotY, 0);
  scene.background = hdr; scene.backgroundRotation.set(0, rotY, 0);
  for (const m of ENV.pending) outdoor(m); ENV.pending.length = 0;
}

let composer = null;
if (!params.get('nopost')) {
  const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt); composer.setSize(W(), H());
  composer.addPass(new RenderPass(scene, camera));
  const n8 = new N8AOPass(scene, camera, W(), H());
  Object.assign(n8.configuration, { aoRadius: 0.9, distanceFalloff: 0.35, intensity: 2.6, gammaCorrection: false, halfRes: false, denoiseRadius: 10 }); // halfRes:true throws in n8ao + three r187 (setupRenderTarget)
  n8.setQualityMode(SHOT ? 'Ultra' : 'Medium');
  composer.addPass(n8); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass(W(), H()));
}
const render = () => (composer ? composer.render() : renderer.render(scene, camera));

// ---------------------------------------------------------------- materials (procedural textures)
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function rng(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
const R = rng(5);
// white/grey pebble plaster
const plasterMap = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#e4e9e8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { const v = 200 + R() * 55 | 0; g.fillStyle = `rgba(${v - 8},${v},${v + 2},0.55)`; const r = 0.6 + R() * 1.6; g.beginPath(); g.arc(R() * w, R() * h, r, 0, 7); g.fill(); }
  for (let i = 0; i < 1800; i++) { const v = 120 + R() * 60 | 0; g.fillStyle = `rgba(${v},${v + 6},${v + 10},0.5)`; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
}, [6, 6]);
const plaster = new THREE.MeshStandardMaterial({ map: plasterMap, roughness: 0.9, color: 0xffffff });
// limestone pavers 60x120 cm
const paverMap = canvasTex(1024, 1024, (g, w, h) => {
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const v = 214 + R() * 14 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(i * 256, j * 256 + (i % 2) * 128, 256, 256); g.fillRect(i * 256, j * 256 + (i % 2) * 128 - 1024, 256, 256);
  }
  for (let i = 0; i < 12000; i++) { const v = 190 + R() * 50 | 0; g.fillStyle = `rgba(${v},${v - 8},${v - 20},0.25)`; g.fillRect(R() * w, R() * h, 2, 2); }
  g.strokeStyle = 'rgba(150,140,125,0.7)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke(); }
  for (let i = 0; i < 4; i++) for (let j = 0; j <= 8; j++) { const y = j * 256 + (i % 2) * 128; g.beginPath(); g.moveTo(i * 256, y % 1024); g.lineTo(i * 256 + 256, y % 1024); g.stroke(); }
}, [1, 1]);
const paverMat = new THREE.MeshStandardMaterial({ map: paverMap, roughness: 0.85 });
outdoor(paverMat);
const coping = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.8 }); outdoor(coping);
const tileMap = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5d6e73'; g.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = 90 + R() * 50 | 0; g.fillStyle = `rgb(${v - 10},${v + 10},${v + 18})`; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } }, [1, 1]);
const tile = new THREE.MeshStandardMaterial({ map: tileMap, roughness: 0.35 });

// ---------------------------------------------------------------- scene
const root = new THREE.Group(); scene.add(root);
const updates = [];
const phys = await createPhysics();
const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
const boxAt = (mat, x0, y0, z0, x1, y1, z1, collide = true) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  // world-space UVs (so tiling is consistent)
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const X = p.getX(i) + (x0 + x1) / 2, Y = p.getY(i) + (y0 + y1) / 2, Z = p.getZ(i) + (z0 + z1) / 2; const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); uv.setXY(i, ay > 0.5 ? X / 2.4 : ax > 0.5 ? Z / 2.4 : X / 2.4, ay > 0.5 ? Z / 2.4 : Y / 2.4); }
  const m = add(g, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (collide) phys.boxAABB([x0, y0, z0], [x1, y1, z1]);
  return m;
};

// pool: x 0..10, z 0..5; lounge platform notch x 4.2..6.8, z 3.4..5 ; sun shelf x>7.4
const POOL = { x0: 0, x1: 10, z0: 0, z1: 5 }; const LOUNGE = { x0: 4.2, x1: 6.8, z0: 3.4, z1: 5 };
const surfaceY = -0.08;
const floorY = (x, z) => {
  if (x >= 7.4) return -0.42;
  if (x < 0.45) return -0.48;
  if (x < 0.9) return -0.9;
  if (x < 6.5) return -1.1 - 0.8 * (x - 0.9) / 5.6;
  return -1.9 + 0.7 * (x - 6.5) / 0.9;
};
const outline = [[0, 0], [10, 0], [10, 5], [LOUNGE.x1, 5], [LOUNGE.x1, LOUNGE.z0], [LOUNGE.x0, LOUNGE.z0], [LOUNGE.x0, 5], [0, 5]];
{ // floor heightfield
  const g = new THREE.PlaneGeometry(10, 5, 400, 200); g.rotateX(-Math.PI / 2); g.translate(5, 0, 2.5);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { p.setY(i, floorY(p.getX(i), p.getZ(i))); uv.setXY(i, p.getX(i) / 2.4, p.getZ(i) / 2.4); }
  g.computeVertexNormals();
  const m = add(g, plaster, 0, 0, 0, false); phys.trimesh(g);
}
// pool shell walls (plaster inside faces) + deck slabs
const T = 0.3, DECK = -0.0;
boxAt(plaster, -T, -2.2, -T, 0, DECK - 0.04, 5 + T); boxAt(plaster, 10, -2.2, -T, 10 + T, DECK - 0.04, 5 + T);
boxAt(plaster, 0, -2.2, -T, 10, DECK - 0.04, 0); boxAt(plaster, 0, -2.2, 5, 10, DECK - 0.04, 5 + T);
boxAt(plaster, LOUNGE.x0, -2.2, LOUNGE.z0, LOUNGE.x1, DECK - 0.04, LOUNGE.z1 + 0.01);
// coping (overhangs the water by 3 cm)
const cop = (x0, z0, x1, z1) => boxAt(coping, x0, DECK - 0.05, z0, x1, DECK + 0.02, z1);
cop(-0.33, -0.33, 10.33, 0.03); cop(-0.33, 4.97, LOUNGE.x0 + 0.03, 5.33); cop(LOUNGE.x1 - 0.03, 4.97, 10.33, 5.33);
cop(-0.33, 0.03, 0.03, 4.97); cop(9.97, 0.03, 10.33, 4.97);
cop(LOUNGE.x0 - 0.03, LOUNGE.z0 - 0.03, LOUNGE.x1 + 0.03, 5.33);
// deck
const deck = (x0, z0, x1, z1) => boxAt(paverMat, x0, DECK - 0.3, z0, x1, DECK, z1);
deck(-9, -9, 22, -0.33); deck(-9, 5.33, 22, 14); deck(-9, -0.33, -0.33, 5.33); deck(10.33, -0.33, 10.8, 5.33);
deck(13.0, -0.33, 22, 5.33); deck(10.8, 2.5, 13.0, 5.33);
// spa: raised, x 10.8..13.0 / z -0.33..2.5 (inner 11.0..12.8, 0..2.3)
const SPA = { x0: 11.0, x1: 12.8, z0: 0.0, z1: 2.3 }; const spaY = 0.12;
boxAt(tile, 10.8, -0.8, -0.33, SPA.x0, 0.18, 2.5); boxAt(tile, SPA.x1, -0.8, -0.33, 13.0, 0.18, 2.5);
boxAt(tile, SPA.x0, -0.8, -0.33, SPA.x1, 0.18, SPA.z0); boxAt(tile, SPA.x0, -0.8, SPA.z1, SPA.x1, 0.18, 2.5);
boxAt(tile, SPA.x0, -0.8, SPA.z0, SPA.x1, -0.6, SPA.z1);
boxAt(tile, SPA.x0, -0.6, SPA.z0, SPA.x1, -0.18, SPA.z0 + 0.4); // bench
for (const [a, b, c, d] of [[10.78, -0.35, 13.02, SPA.z0 + 0.02], [10.78, SPA.z1 - 0.02, 13.02, 2.52], [10.78, SPA.z0, SPA.x0 + 0.02, SPA.z1], [SPA.x1 - 0.02, SPA.z0, 13.02, SPA.z1]]) boxAt(coping, a, 0.18, b, c, 0.24, d, false);
// a lounge sofa block + house wall for context
boxAt(new THREE.MeshStandardMaterial({ color: 0x7a6e5f, roughness: 0.9 }), 4.5, 0.02, 4.0, 6.5, 0.7, 4.9);
boxAt(new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: 0.85 }), -9, 0, -9, -3, 6, -6);

// ---------------------------------------------------------------- water
const ctx = { THREE, root, renderer, scene, camera, shot: SHOT, phys, sun, LIGHT, onUpdate: (fn) => updates.push(fn), kit: { outdoor } };
const pool = createWater(ctx, { outline, surfaceY, floorY, color: 0x2fb7c9, name: 'pool' });
const spa = createWater(ctx, { outline: [[SPA.x0, SPA.z0], [SPA.x1, SPA.z0], [SPA.x1, SPA.z1], [SPA.x0, SPA.z1]], surfaceY: spaY, floorY: (x, z) => (z < SPA.z0 + 0.4 ? -0.18 : -0.6), color: 0x2fb7c9, name: 'spa' });
window.__water = { pool, spa, waterBodies };

// floaters
const ballTex = canvasTex(256, 128, (g, w, h) => { const cols = ['#e63b2e', '#ffffff', '#f5c518', '#ffffff', '#2a6fdb', '#ffffff']; cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
const balls = [];
function makeBall(x, y, z, r = 0.17) {
  const m = add(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 }), x, y, z);
  m.rotation.set(R() * 3, R() * 3, R() * 3);
  const rec = phys.dynamic(m, { mass: 0.12, shape: 'ball', restitution: 0.5 });
  for (const w of waterBodies) w.addFloater(rec, {});
  balls.push(rec); return rec;
}
makeBall(2.2, -0.02, 1.4); makeBall(5.4, -0.02, 2.2); makeBall(8.6, 0.0, 1.0); makeBall(3.6, -0.02, 3.9, 0.12);
{ // foam float board
  const m = add(new THREE.BoxGeometry(0.9, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0xf4a640, roughness: 0.6 }), 7.0, 0.0, 3.0);
  m.rotation.y = 0.5; const rec = phys.dynamic(m, { mass: 0.9, shape: 'box' }); pool.addFloater(rec, {});
}

await loadEnv();

// ---------------------------------------------------------------- camera
const camParam = params.get('cam');
if (camParam) { const a = camParam.split(',').map(Number); camera.position.set(a[0], a[1], a[2]); camera.fov = a[6] || 60; camera.updateProjectionMatrix(); camera.lookAt(a[3], a[4], a[5]); }
else { camera.position.set(-2.6, 1.6, -2.4); camera.lookAt(6, -0.6, 3.2); }
let controls = null;
if (!SHOT && !PERF) {
  controls = new OrbitControls(camera, canvas); const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  controls.target.copy(camera.position).addScaledVector(dir, 6); controls.update();
}

// interaction
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => { canvas._down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!canvas._down || Math.hypot(e.clientX - canvas._down[0], e.clientY - canvas._down[1]) > 4) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  for (const w of waterBodies) { const hit = ray.intersectObject(w.mesh)[0]; if (hit) { w.splash(hit.point.x, hit.point.y, hit.point.z, 0.8); break; } }
});
addEventListener('keydown', (e) => {
  if (e.key === 'b') { const d = new THREE.Vector3(); camera.getWorldDirection(d); const rec = makeBall(camera.position.x + d.x, camera.position.y + d.y, camera.position.z + d.z); rec.body.setLinvel({ x: d.x * 7, y: d.y * 7 + 2, z: d.z * 7 }, true); }
  if (e.key === 'u') { camera.position.set(1.5, -0.9, 0.8); controls.target.set(6, -1.0, 3); controls.update(); }
});

// ---------------------------------------------------------------- run
if (SHOT || PERF) {
  // deterministic: settle floaters, queue a few ripples + one splash, then render 6 frames
  for (let i = 0; i < 180; i++) phys.step(1 / 60);
  pool.disturb(3.0, 2.2, 0.35, 1.2); pool.disturb(6.0, 1.2, 0.25, 0.8); pool.disturb(8.8, 3.0, 0.3, 0.6);
  pool.splash(2.6, surfaceY, 3.4, 0.7);
  await renderer.compileAsync(scene, camera);
  for (let i = 0; i < 6; i++) { for (const u of updates) u(1 / 60, i / 60); render(); await new Promise(r => requestAnimationFrame(r)); }
  if (PERF) {
    const gl = renderer.getContext(); const px = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const time = async (fn, n = 90) => { sync(); const t0 = performance.now(); for (let i = 0; i < n; i++) { fn(i); sync(); } return (performance.now() - t0) / n; };
    let t = 1;
    const withW = await time(() => { t += 1 / 60; for (const u of updates) u(1 / 60, t); render(); });
    for (const w of waterBodies) w.group.visible = false;
    const without = await time(() => { render(); });
    for (const w of waterBodies) w.group.visible = true;
    const simOnly = await time(() => { t += 1 / 60; for (const u of updates) u(1 / 60, t); });
    window.__perf = { frameWithWaterMs: +withW.toFixed(2), frameWithoutWaterMs: +without.toFixed(2), waterUpdateOnlyMs: +simOnly.toFixed(2) };
    console.log('PERF ' + JSON.stringify(window.__perf));
  }
  window.__ready = true;
} else {
  const clock = new THREE.Clock(); let t = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); t += dt;
    controls?.update(); phys.step(dt);
    for (const u of updates) u(dt, t);
    render();
  });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); });
  window.__ready = true;
}
