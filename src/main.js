// Palisades house walkthrough — boot.
// URL params:
//   ?view=p04        photo camera from a piece's `views` (shot mode: 1080x720, no UI, sets window.__ready)
//   ?cam=x,y,z,lx,ly,lz,fov   arbitrary shot camera (same shot mode)
//   ?only=kitchen,dining      build only these pieces (+ shell) — faster iteration
//   ?top=0|1          orthographic top-down cutaway of that level (plan check)
//   ?noroof=1  ?nopost=1  ?debug=1
//   ?room=<code>      multiplayer room (see game.js)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { N8AOPass } from 'n8ao';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { buildRoomProbes } from './lighting.js';
import * as P from './plan.js';
import { PIECES } from './rooms/index.js';
import { createPhysics } from './physics.js';
import { buildShell } from './shell.js';
import { createPlayer } from './player.js';
import { M } from './kit/materials.js';
import * as T from './kit/textures.js';
import * as G from './kit/geo.js';
import * as RM from './kit/room.js';
import { loadModel, fitTo } from './kit/models.js';

const params = new URLSearchParams(location.search);
const viewId = params.get('view'); const camParam = params.get('cam'); const topLevel = params.get('top');
const SHOT = !!(viewId || camParam || topLevel !== null);
const only = params.get('only') ? params.get('only').split(',') : null;
window.__ready = false; window.__errors = [];
const status = (msg) => { const el = document.getElementById('status'); if (el) el.textContent = msg; };
if (SHOT) document.body.classList.add('shot');

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.18; // LIGHT.exposure
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
T.setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
const W = () => (SHOT ? 1080 : innerWidth), H = () => (SHOT ? 720 : innerHeight);
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(W(), H(), !SHOT);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, W() / H(), 0.03, 4000);

// ---------------------------------------------------------------- lighting
// Sun: comes from the canyon side (+z, south-east) and a little from the north-east, like the
// morning light in the listing photos (p05, p09 show sun patches through the rear glass).
export const LIGHT = {
  sunDir: new THREE.Vector3(0.42, 0.62, 0.66).normalize(),
  sunIntensity: 4.2, sunColor: 0xfff1df,
  envIntensity: 1.0, bgIntensity: 1.0, hemi: 0.35, exposure: 1.18,
  probeIntensity: 1.12, bloom: { strength: 0.12, radius: 0.4, threshold: 1.6 },
  whiteBalance: [0.93, 0.99, 1.09], // camera-style WB: cancels the warm cast of light bounced off oak floors
};
const HOUSE_C = new THREE.Vector3(11.7, 0, 11.0);
const sun = new THREE.DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera; sc.left = -19; sc.right = 19; sc.top = 19; sc.bottom = -19; sc.near = 1; sc.far = 80;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
sun.position.copy(HOUSE_C).addScaledVector(LIGHT.sunDir, 40); sun.target.position.copy(HOUSE_C);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xeef3fa, 0xe8dccb, LIGHT.hemi); scene.add(hemi);

// Exterior materials call kit.outdoor(mat) to use the real sky for reflections / ambient.
const ENV = { outdoor: null, room: null, rotY: 0, pending: [] };
function applyOutdoor(mat) { mat.envMap = ENV.outdoor; mat.envMapRotation = new THREE.Euler(0, ENV.rotY, 0); mat.needsUpdate = true; }
export function outdoor(mat) { if (ENV.outdoor) applyOutdoor(mat); else ENV.pending.push(mat); return mat; }
async function loadEnvironment() {
  const hdr = await new HDRLoader().loadAsync('assets/ph/golden_gate_hills/golden_gate_hills_2k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  // find the sun in the HDRI (brightest texel) and rotate the sky so it agrees with our sun light
  const { data, width, height } = hdr.image; let best = -1, bi = 0;
  const stride = data.length / (width * height);
  const half = typeof data[0] === 'number' && data.constructor.name === 'Uint16Array';
  const f = half ? THREE.DataUtils.fromHalfFloat : (v) => v;
  for (let i = 0; i < width * height; i += 3) { const l = f(data[i * stride]) + f(data[i * stride + 1]) + f(data[i * stride + 2]); if (l > best) { best = l; bi = i; } }
  // three's equirect lookup: u = atan2(dir.z, dir.x)/2π + 0.5  ->  sun azimuth φ = (u-0.5)·2π
  const u = (bi % width) / width; const hdrAz = (u - 0.5) * 2 * Math.PI;
  const rotY = Math.atan2(LIGHT.sunDir.z, LIGHT.sunDir.x) - hdrAz; // verified visually with ?cam looking at the sun
  // Two environments (archviz trick): interiors are lit by a neutral bright room environment (stand-in
  // for the bounce light a raster renderer can't compute); exterior materials opt into the real
  // canyon sky via ctx.kit.outdoor(material) so facades, pool and terrain reflect the actual HDRI.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const outdoor = pmrem.fromEquirectangular(hdr).texture;
  const room = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = room; scene.background = hdr;
  scene.environmentRotation.set(0, 0, 0); scene.backgroundRotation.set(0, rotY, 0);
  scene.environmentIntensity = LIGHT.envIntensity; scene.backgroundIntensity = LIGHT.bgIntensity;
  ENV.outdoor = outdoor; ENV.room = room; ENV.rotY = rotY; ENV.hdr = hdr;
  for (const m of ENV.pending) applyOutdoor(m); ENV.pending.length = 0;
  window.__env = { rotY, hdrAz, u };
}

// ---------------------------------------------------------------- post
let composer = null, n8 = null;
function setupPost() {
  if (params.get('nopost')) return;
  const rt = new THREE.WebGLRenderTarget(W() * renderer.getPixelRatio(), H() * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 0 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W(), H());
  composer.addPass(new RenderPass(scene, camera));
  n8 = new N8AOPass(scene, camera, W(), H());
  n8.setQualityMode(SHOT ? 'Ultra' : 'Medium'); // presets may toggle halfRes, which breaks on three r187 -> force it off after
  Object.assign(n8.configuration, { aoRadius: 0.9, distanceFalloff: 0.35, intensity: 2.6, gammaCorrection: false, halfRes: false, denoiseRadius: 10 });
  composer.addPass(n8); window.__n8 = n8;
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, wb: { value: new THREE.Vector3(...LIGHT.whiteBalance) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 wb; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); vec3 b = c.rgb * wb; float l2 = dot(b, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(b * (l / max(l2, 1e-5)), c.a); }' }));
  const b = LIGHT.bloom; composer.addPass(new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), b.strength, b.radius, b.threshold)); // bright windows bloom a little, like a camera
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(W() * renderer.getPixelRatio(), H() * renderer.getPixelRatio()));
}

// ---------------------------------------------------------------- boot
const updates = [];
const ctxBase = {
  THREE, scene, renderer, camera, params, shot: SHOT, plan: P, LIGHT, sun, hemi,
  kit: { M, ...T, ...G, ...RM, loadModel, fitTo, outdoor },
  ENV,
  onUpdate: (fn) => updates.push(fn),
};

async function main() {
  status('Loading physics…');
  const phys = await createPhysics(); ctxBase.phys = phys;
  status('Loading sky…');
  const envP = loadEnvironment();
  // import piece modules first so the shell knows which ceilings are custom
  const mods = {};
  await Promise.all(PIECES.filter(p => !only || only.includes(p)).map(async (p) => {
    try { mods[p] = await import(`./rooms/${p}.js`); } catch (e) { console.error('[piece import]', p, e); window.__errors.push(p + ': ' + e.message); }
  }));
  const ownCeilings = Object.values(mods).flatMap(m => m.ownCeiling || []);
  status('Building shell…');
  const shell = buildShell({ ...ctxBase, ownCeilings, skipRoofs: params.get('noroof') === '1' });
  ctxBase.shell = shell; ctxBase.doors = shell.doors;
  status('Furnishing rooms…');
  await Promise.all(Object.entries(mods).map(async ([p, mod]) => {
    if (!mod.build) return;
    const root = new THREE.Group(); root.name = 'piece:' + p; scene.add(root);
    try { await mod.build({ ...ctxBase, root, piece: p }); }
    catch (e) { console.error('[piece build]', p, e); window.__errors.push(p + ': ' + (e.stack || e.message)); }
  }));
  await envP;
  if (!params.get('noprobes')) { // per-room light probes with one bounce (see lighting.js)
    try { await buildRoomProbes(ctxBase, { intensity: LIGHT.probeIntensity, onStatus: status }); }
    catch (e) { console.error('[probes]', e); window.__errors.push('probes: ' + e.message); }
  }
  setupPost();

  // views registry
  const views = {}; for (const m of Object.values(mods)) Object.assign(views, m.views || {});
  window.__views = Object.keys(views);
  const setCam = (v) => { camera.fov = v.fov ?? 60; camera.position.set(...v.pos); camera.lookAt(new THREE.Vector3(...v.look)); camera.updateProjectionMatrix(); };

  if (SHOT) {
    if (viewId) { if (!views[viewId]) { window.__errors.push('no view ' + viewId); } else setCam(views[viewId]); }
    else if (camParam) { const a = camParam.split(',').map(Number); setCam({ pos: a.slice(0, 3), look: a.slice(3, 6), fov: a[6] || 60 }); }
    else if (topLevel !== null) setupTop(Number(topLevel));
    await waitForLoads();
    await renderer.compileAsync(scene, camera);
    for (let i = 0; i < 6; i++) { for (const u of updates) u(1 / 60, i / 60); render(); await new Promise(r => requestAnimationFrame(r)); }
    const ptSamples = Number(params.get('pt') || 0);
    if (ptSamples > 0) { // path-traced still: ?view=p04&pt=256
      const { createPhotoMode } = await import('./pathtrace.js');
      const photo = createPhotoMode(ctxBase); await photo.enter({ bounces: Number(params.get('bounces') || 6), exposure: Number(params.get('exposure') || 2.6) });
      while (photo.samples < ptSamples) { photo.render(); await new Promise(r => requestAnimationFrame(r)); }
      window.__ptSamples = photo.samples;
    }
    if (params.get('stats')) { // ?stats=1 : what is heavy in this scene (per piece, biggest meshes, textures)
      const per = {}, big = [], texs = new Map();
      scene.traverse(o => { if (!o.isMesh) return; let p = o; while (p && !(p.name || '').startsWith('piece:') && p.name !== 'shell') p = p.parent; const k = p ? p.name : 'other';
        const v = (o.geometry.attributes.position?.count || 0) * (o.isInstancedMesh ? o.count : 1); per[k] = per[k] || { meshes: 0, verts: 0 }; per[k].meshes++; per[k].verts += v; big.push([v, k, o.name || o.material?.name || o.material?.type]);
        for (const m of [].concat(o.material)) for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'metalnessMap']) { const t = m?.[key]; const img = t?.image; if (img && img.width) texs.set(t.source?.uuid || t.uuid, [img.width, img.height, k]); } });
      big.sort((a, b) => b[0] - a[0]);
      const tx = [...texs.values()]; window.__stats = { per, top: big.slice(0, 8), programs: renderer.info.programs?.length, textures: tx.length, texMB: Math.round(tx.reduce((a, [w, h]) => a + w * h * 4 * 1.33, 0) / 1e6), bigTex: tx.filter(([w, h]) => w * h >= 2048 * 2048) };
    }
    window.__ready = true; status(''); return;
  }

  // ---- walk mode
  const player = createPlayer({ ...ctxBase, dom: canvas, useNearest: (pos) => useNearestDoor(pos), onLockChange: (l) => document.body.classList.toggle('locked', l), uiBlocking: () => document.body.classList.contains('ui-open') }, { spawn: [9.8, 0.05, 6.6], yaw: Math.PI });
  ctxBase.player = player;
  try { const game = await import('./multiplayer.js'); await game.start({ ...ctxBase, player }); } catch (e) { console.warn('[game] not loaded:', e.message); }
  document.getElementById('loading')?.classList.add('done');
  status('');
  // P = path-traced photo mode (freezes the camera, accumulates samples until P again)
  let photo = null;
  addEventListener('keydown', async (e) => {
    if (e.code !== 'KeyP' || (e.target && e.target.tagName === 'INPUT')) return;
    if (!photo) { const { createPhotoMode } = await import('./pathtrace.js'); photo = createPhotoMode(ctxBase); }
    if (photo.active) { photo.exit(); status(''); } else { status('Path tracing: building scene…'); await photo.enter({ onProgress: (v) => status('Path tracing: building scene ' + Math.round(v * 100) + '%') }); }
  });
  let last = performance.now(), t = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.1); last = now; t += dt;
    if (photo && photo.active) { photo.render(); if (photo.ready) status('Photo mode (path traced) · ' + photo.samples + ' samples · P to exit'); return; }
    animateDoors(dt);
    player.update(dt);
    phys.step(dt);
    for (const u of updates) u(dt, t);
    render();
    hud(player);
  });
  window.__ready = true;
}

function render() { if (composer) composer.render(); else renderer.render(scene, camera); }

// Doors: E toggles the nearest door within 1.6 m.
function useNearestDoor(pos) {
  let best = null, bd = 1.6;
  for (const d of ctxBase.doors || []) { const dist = Math.hypot(d.world.x - pos.x, d.world.z - pos.z) + Math.abs(d.world.y - (pos.y + 1)) * 0.5; if (dist < bd) { bd = dist; best = d; } }
  if (!best) return; best.target = best.target > 0.5 ? 0 : 1;
  if (best.target > 0.5 && best.collider) { ctxBase.phys.remove(best.collider); best.collider = null; }
  if (best.target < 0.5) best.pendingClose = true;
}
function animateDoors(dt) {
  for (const d of ctxBase.doors || []) {
    if (Math.abs(d.open - d.target) < 1e-3) { if (d.pendingClose && d.target < 0.5) { d.pendingClose = false; d.collider = d.closedCollider(); } continue; }
    d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 1.8); d.setPose();
  }
}

// Top-down orthographic cutaway (plan check): hide everything above the level's ceiling.
function setupTop(level) {
  const cut = level === 0 ? 3.0 : 6.0;
  scene.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox?.(); const bb = new THREE.Box3().setFromObject(o); if (bb.min.y > cut - 0.05 || o.name.startsWith('roof') || o.name.startsWith('soffit') || o.name.startsWith('ceil') || o.name.includes(':bottom')) o.visible = false; } });
  const cam = new THREE.OrthographicCamera(-1, 25, 1, -23, 0.1, 100); cam.position.set(0, 30, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  // fit plan (x 0..23.5, z 0..22) into 3:2 frame
  const cx = 11.75, cz = 11, hw = 17, hh = hw / 1.5; cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.position.set(cx, 30, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, 0, cz); cam.updateProjectionMatrix();
  window.__topCam = cam;
  render = () => renderer.render(scene, cam);
}

async function waitForLoads() {
  const mgr = THREE.DefaultLoadingManager; let quiet = 0;
  let pending = 0; const prevStart = mgr.onStart, prevLoad = mgr.onLoad;
  for (let i = 0; i < 600; i++) { // up to ~60 s
    const busy = mgr.isLoading ?? false;
    await new Promise(r => setTimeout(r, 100));
    if (!busy && (mgr.itemsLoaded === undefined || true)) quiet++; else quiet = 0;
    if (quiet > 5) break;
  }
}
// THREE.LoadingManager doesn't expose isLoading; track it.
{
  const mgr = THREE.DefaultLoadingManager; let total = 0, done = 0;
  mgr.onStart = () => { mgr.isLoading = true; }; mgr.onProgress = (u, l, t) => { done = l; total = t; mgr.isLoading = l < t; const el = document.getElementById('bar'); if (el) el.style.width = (100 * l / Math.max(1, t)) + '%'; };
  mgr.onLoad = () => { mgr.isLoading = false; }; mgr.onError = (u) => { console.warn('load error', u); window.__errors.push('load ' + u); };
}

function hud(player) {
  const el = document.getElementById('where'); if (!el) return;
  const p = player.position; const level = p.y > 2.5 ? 1 : 0;
  let name = 'Outside';
  for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== level) continue; const [x0, z0, x1, z1] = r.rect; if (p.x >= x0 - 0.35 && p.x <= x1 + 0.35 && p.z >= z0 - 0.35 && p.z <= z1 + 0.35) { name = r.name; break; } }
  if (el.textContent !== name) el.textContent = name;
}

addEventListener('resize', () => { if (SHOT) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); n8?.setSize?.(innerWidth, innerHeight); });

main().catch(e => { console.error(e); window.__errors.push('main: ' + (e.stack || e.message)); status('Error: ' + e.message); window.__ready = true; });
