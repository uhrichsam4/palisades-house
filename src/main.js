// Palisades house walkthrough — boot.
// URL params:
//   ?view=p04        photo camera from a piece's `views` (shot mode: 1080x720, no UI, sets window.__ready)
//   ?cam=x,y,z,lx,ly,lz,fov   arbitrary shot camera (same shot mode)
//   ?only=kitchen,dining      build only these pieces (+ shell) — faster iteration
//   ?top=0|1          orthographic top-down cutaway of that level (plan check)
//   ?noroof=1  ?nopost=1  ?debug=1
//   ?room=<code>      join that lobby directly (invite links, every test tool) — skips the title menu
//   ?menu=0           skip the title menu, play solo (tools)
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
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { buildRoomProbes, bindRoomProbes } from './lighting.js';
import { createQuality, createShadowScheduler, guardMirrors, createLightPool, batchDynamics, createBlobShadows, createGpuTimer, VIDEO_KEYS, videoOverrides, singlePassFaintGlass, fastN8Transparency } from './perf.js';
import { createCuller } from './cull.js';
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
import { fabric } from './kit/fabrics.js';
import { settings } from './net/settings.js';
import { rollText } from './net/motion.js';
import { applyTheme } from './net/hud.js';
import { createSky, skyWanted } from './sky/index.js';
import { patchOutputPass } from './look/film.js';

const params = new URLSearchParams(location.search);
const viewId = params.get('view'); const camParam = params.get('cam'); const topLevel = params.get('top');
const SHOT = !!(viewId || camParam || topLevel !== null);
const only = params.get('only') ? params.get('only').split(',') : null;
window.__ready = false; window.__errors = [];
let hudStatus = null; // set once the in-game HUD exists (path-trace progress shows there)
const status = (msg) => { if (hudStatus) return hudStatus(msg); const el = document.getElementById('status'); if (el) el.textContent = msg; };
if (!SHOT) { applyTheme(); const t = document.querySelector('#loading h1'); if (t) rollText(t, t.textContent); }
if (SHOT) document.body.classList.add('shot');

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.18; // LIGHT.exposure
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
T.setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
const SW = Number(params.get('sw')) || 1080, SH = Number(params.get('sh')) || 720; // shot size (?sw=576&sh=1024 for phone-video matching)
const W = () => (SHOT ? SW : innerWidth), H = () => (SHOT ? SH : innerHeight);
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 2) * 0.75);
renderer.setSize(W(), H(), !SHOT);
if (SHOT) { canvas.style.width = SW + 'px'; canvas.style.height = SH + 'px'; }

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
// day/night + weather (src/sky): walk mode only. It owns the sky (a dome instead of scene.background), ENV.outdoor
// (a PMREM of that dome, re-captured as the sky changes: already world-aligned, so no envMapRotation), fog, sun,
// hemi, exposure and the probe day/night mix. Photo shots and ?sky=0 keep the fixed morning look below.
let SKY = null;
function applyOutdoor(mat) { mat.envMap = ENV.outdoor; mat.envMapRotation = new THREE.Euler(0, SKY ? 0 : ENV.rotY, 0); SKY?.outdoorPatch(mat); mat.needsUpdate = true; }
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
  const outdoor = SKY ? SKY.attachEnv(hdr, rotY) : pmrem.fromEquirectangular(hdr).texture;
  const room = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = room; scene.background = SKY ? null : hdr;
  if (SKY) SKY.envReady();
  scene.environmentRotation.set(0, 0, 0); scene.backgroundRotation.set(0, rotY, 0);
  scene.environmentIntensity = LIGHT.envIntensity; scene.backgroundIntensity = LIGHT.bgIntensity;
  ENV.outdoor = outdoor; ENV.room = room; ENV.rotY = rotY; ENV.hdr = hdr;
  for (const m of ENV.pending) applyOutdoor(m); ENV.pending.length = 0;
  window.__env = { rotY, hdrAz, u };
}

// ---------------------------------------------------------------- post
// N8AOPass renders the scene itself (beauty + depth) and adds AO, so there is no separate RenderPass while AO
// is on (that was drawing the whole house twice a frame). White balance lives inside the output pass.
let composer = null, n8 = null; const passes = {};
function setupPost() {
  if (params.get('nopost')) return;
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(W() * pr, H() * pr, { type: THREE.HalfFloatType, samples: 0 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(W(), H());
  passes.render = new RenderPass(scene, camera); passes.render.enabled = false; composer.addPass(passes.render);
  n8 = new N8AOPass(scene, camera, W() * pr, H() * pr); passes.ao = n8;
  if (!params.get('n8stock')) fastN8Transparency(n8); // perf.js: same transparency passes, no full-scene walks (?n8stock=1 = stock)
  setAO(SHOT ? 'Ultra' : 'Medium');
  composer.addPass(n8); window.__n8 = n8;
  const b = LIGHT.bloom; passes.bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), b.strength, b.radius, b.threshold); composer.addPass(passes.bloom); // bright windows bloom a little, like a camera
  { const bs = passes.bloom.setSize.bind(passes.bloom); passes.bloom.setSize = (w, h) => { const k = passes.bloom.shift ?? 1; bs(Math.max(1, w >> k), Math.max(1, h >> k)); }; } // half-res bloom chain (quarter at Ultra lever stage 1+): a soft glow, no visible loss
  passes.out = new OutputPass(); // + camera-style white balance (luminance-preserving), before tone mapping
  passes.out.uniforms.wb = { value: new THREE.Vector3(...LIGHT.whiteBalance) };
  passes.out.material.fragmentShader = passes.out.material.fragmentShader
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse; uniform vec3 wb;')
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', 'gl_FragColor = texture2D( tDiffuse, vUv ); { float l0 = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); vec3 b = gl_FragColor.rgb * wb; gl_FragColor.rgb = b * ( l0 / max( dot( b, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-5 ) ); }');
  passes.out.material.needsUpdate = true;
  passes.film = patchOutputPass(passes.out); passes.film.set(renderer, params.get('film') || 'neutral'); // src/look/film.js: AgX + LUT grade (walk mode follows Settings > VIDEO)
  composer.addPass(passes.out);
  passes.smaa = new SMAAPass(W() * pr, H() * pr); composer.addPass(passes.smaa);
  passes.fxaa = new FXAAPass(); passes.fxaa.enabled = false; composer.addPass(passes.fxaa);
}
function setAO(mode, { full = null, samples = 0 } = {}) {
  if (!n8) return;
  if (!mode) { n8.enabled = false; passes.render.enabled = true; return; }
  n8.enabled = true; passes.render.enabled = false;
  n8.setQualityMode(mode); // (vendor/n8ao.js is patched so half-res AO works on three r187)
  const half = full !== null ? !full : !SHOT && ((mode !== 'High' && mode !== 'Ultra') || qStage >= 1);
  Object.assign(n8.configuration, { aoRadius: 0.9, distanceFalloff: 0.35, intensity: 2.6, gammaCorrection: false, halfRes: half, depthAwareUpsampling: true, denoiseRadius: 10 });
  if (samples) Object.assign(n8.configuration, { aoSamples: samples, denoiseSamples: 16, denoiseRadius: 8 });
}
// quality tier + render resolution (walk mode; see perf.js)
// stage = Ultra 120 Hz lever (perf.js createQuality): 1 AO half-res + quarter bloom, 2 2k shadow map + slower door
// shadow refresh, 3 small-object cull distance x0.6, 4 probe bake paused. The tier's look (every effect) stays.
// opts.over = Settings > VIDEO 'custom' overrides (perf.js videoOverrides): an override always beats the lever.
// opts.max = MAX tier (also photo mode): full-res AO with 64 samples, 4096 soft shadows, full-res bloom, SMAA at any
// density, 6+4 pool lights, anisotropy 16 everywhere, far small-object cull distance.
let qStage = 0; const VQ = { max: false, over: null, aniso: null };
const SHADOW = { off: [0, 0], low: [2048, 2], high: [4096, 3], ultra: [4096, 5] };
function setAniso(on) { // MAX: every texture at the GPU's max anisotropy (re-uploads them once); off: back as it was
  const maxA = renderer.capabilities.getMaxAnisotropy();
  if (on && !VQ.aniso) { VQ.aniso = new Map(); scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const k in m) { const t = m[k]; if (t?.isTexture && !t.isRenderTargetTexture && !t.isCubeTexture && t.image && (t.anisotropy || 1) < maxA && !VQ.aniso.has(t)) { VQ.aniso.set(t, t.anisotropy || 1); t.anisotropy = maxA; t.needsUpdate = true; } } }); }
  else if (!on && VQ.aniso) { for (const [t, a] of VQ.aniso) { t.anisotropy = a; t.needsUpdate = true; } VQ.aniso = null; }
}
function applyQuality(tier, pr, stage = 0, opts = {}) {
  qStage = stage; const o = opts.over || null, MX = !!opts.max; VQ.max = MX; VQ.over = o;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  const sh = MX ? SHADOW.ultra : o?.shadows ? SHADOW[o.shadows] : [stage >= 2 ? 2048 : 4096, 3];
  const on = sh[0] > 0; if (sun.castShadow !== on) { sun.castShadow = on; renderer.shadowMap.needsUpdate = true; }
  if (on && sun.shadow.mapSize.x !== sh[0]) { sun.shadow.mapSize.set(sh[0], sh[0]); sun.shadow.map?.dispose(); sun.shadow.map = null; renderer.shadowMap.needsUpdate = true; }
  if (sun.shadow.radius !== sh[1] && on) { sun.shadow.radius = sh[1]; renderer.shadowMap.needsUpdate = true; }
  if (shadows) shadows.movingHz = stage >= 2 && !o?.shadows && !MX ? 4 : 8;
  if (cull) cull.smallScale = MX ? 1.6 : stage >= 3 ? 0.6 : 1;
  window.__probesPaused = stage >= 4 && !MX;
  const lp = ctxBase.lightPool; if (lp?.resize) { const want = MX ? [6, 4] : [3, 2]; if (lp.size[0] !== want[0] || lp.size[1] !== want[1]) lp.resize(...want); }
  setAniso(MX);
  if (!composer) return;
  if (MX) setAO('Ultra', { full: true, samples: 64 });
  else if (o?.ao) setAO(o.ao === 'off' ? null : o.ao === 'full' ? 'High' : 'Medium', { full: o.ao === 'full' });
  else setAO(tier.ao);
  passes.bloom.enabled = MX ? true : o && o.bloom !== null ? o.bloom : tier.bloom;
  passes.bloom.shift = MX ? 0 : stage >= 1 && !o ? 2 : 1;
  const aa = MX ? 'smaa' : o?.aa || tier.aa;
  passes.smaa.enabled = aa === 'smaa' && (pr < 1.5 || MX || !!o?.aa); passes.fxaa.enabled = aa === 'fxaa'; // dense pixels: SMAA buys little (tier presets)
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
  window.__video = { tier: MX ? 'MAX' : o ? 'Custom' : tier.name, pixelRatio: +pr.toFixed(3), ao: n8?.enabled ? (n8.configuration.halfRes ? 'half' : 'full') + ':' + n8.configuration.aoSamples : 'off', shadowMap: on ? sun.shadow.mapSize.x : 0, shadowRadius: sun.shadow.radius, bloom: passes.bloom.enabled ? (passes.bloom.shift === 0 ? 'full' : passes.bloom.shift === 1 ? 'half' : 'quarter') : 'off', aa: passes.smaa.enabled ? 'smaa' : passes.fxaa.enabled ? 'fxaa' : 'off', lights: lp?.size, stage };
}

// ---------------------------------------------------------------- boot
const updates = [];
// main-loop profiler: window.__prof.on = true, then window.__prof.report() -> ms/frame per section and per onUpdate source
function srcLabel(fn) { try { const l = (new Error().stack || '').split('\n').slice(2).find(x => /\/src\//.test(x) && !/main\.js/.test(x)) || ''; const m = l.match(/src\/([^?:)]+)[^:]*:(\d+)/); return (m ? m[1] + ':' + m[2] : 'main') + (fn.name ? ' ' + fn.name : ''); } catch { return '?'; } }
const PROF = window.__prof = { on: false, frames: 0, acc: new Map(), t0: 0,
  add(k, ms) { this.acc.set(k, (this.acc.get(k) || 0) + ms); },
  reset() { this.frames = 0; this.acc.clear(); this.t0 = performance.now(); },
  report() { const n = Math.max(1, this.frames); return { frames: this.frames, wallMsPerFrame: +((performance.now() - this.t0) / n).toFixed(2), rows: [...this.acc].map(([k, v]) => [k, +(v / n).toFixed(3)]).sort((a, b) => b[1] - a[1]) }; } };
let shadows = null, cull = null, mirrorRooms = new Set();
const preQ = []; preQ.on = false; // ctxBase.preRender queue (drained in the walk loop's frameFn)
const T0 = performance.now(); window.__timing = {};
const mark = (k) => { window.__timing[k] = Math.round(performance.now() - T0); };
const ctxBase = {
  THREE, scene, renderer, camera, params, shot: SHOT, plan: P, LIGHT, sun, hemi,
  kit: { M, ...T, ...G, ...RM, loadModel, fitTo, outdoor, fabric },
  ENV,
  onUpdate: (fn) => { updates.push(fn); fn.__src = srcLabel(fn); },
  // preRender(fn): run fn this frame AFTER all updates, right after the frame's one matrix walk and before the scene
  // renders (no extra matrix walk). Returns false outside the walk loop: the caller should then just run fn itself.
  preRender: (fn) => { if (!preQ.on) return false; preQ.push(fn); return true; },
};

async function main() {
  status('Loading physics…');
  const phys = await createPhysics(); ctxBase.phys = phys; mark('physics');
  // src/smash (movable / breakable world): watches piece builds so furniture can become physics objects BEFORE any merge
  let smashPrep = null; if ((!SHOT || params.get('smash') === '1') && params.get('smash') !== '0') { /* ?smash=0: off (perf A/B) */ try { smashPrep = (await import('./smash/prep.js')).installPrep(ctxBase); ctxBase.smashPrep = smashPrep; } catch (e) { console.error('[smash prep]', e); window.__errors.push('smash prep: ' + e.message); } }
  status('Loading sky…');
  if (skyWanted(params, SHOT)) { try { SKY = createSky(ctxBase); ctxBase.sky = SKY; } catch (e) { console.error('[sky]', e); window.__errors.push('sky: ' + e.message); SKY = null; } }
  const envP = loadEnvironment();
  // import piece modules first so the shell knows which ceilings are custom
  const mods = {};
  await Promise.all(PIECES.filter(p => !only || only.includes(p)).map(async (p) => {
    try { mods[p] = await import(`./rooms/${p}.js`); } catch (e) { console.error('[piece import]', p, e); window.__errors.push(p + ': ' + e.message); }
  }));
  const ownCeilings = Object.values(mods).flatMap(m => m.ownCeiling || []);
  status('Building shell…');
  const shell = buildShell({ ...ctxBase, phys: phys.tagged('shell'), ownCeilings, skipRoofs: params.get('noroof') === '1' });
  ctxBase.shell = shell; ctxBase.doors = shell.doors; mark('shell');
  status('Furnishing rooms…');
  await Promise.all(Object.entries(mods).map(async ([p, mod]) => {
    if (!mod.build) return;
    const root = new THREE.Group(); root.name = 'piece:' + p; scene.add(root);
    const tb = performance.now();
    try { await mod.build({ ...ctxBase, phys: phys.tagged('piece:' + p), root, piece: p }); window.__timing['build:' + p] = Math.round(performance.now() - tb); }
    catch (e) { console.error('[piece build]', p, e); window.__errors.push(p + ': ' + (e.stack || e.message)); }
  }));
  mark('pieces');
  SKY?.preMerge(); // lantern positions etc. (before the merge flattens groups)
  // lived-in extras (src/furnish/): walk mode only, so photo shots still compare against the staged listing photos
  if (!SHOT || params.get('furnish') === '1') {
    const root = new THREE.Group(); root.name = 'piece:furnish'; scene.add(root); const tb = performance.now();
    try { const f = await import('./furnish/index.js'); await f.build?.({ ...ctxBase, phys: phys.tagged('piece:furnish'), root, piece: 'furnish' }); window.__timing['build:furnish'] = Math.round(performance.now() - tb); }
    catch (e) { console.error('[furnish]', e); window.__errors.push('furnish: ' + (e.stack || e.message)); }
  }
  try { smashPrep?.afterPieces(scene); } catch (e) { console.error('[smash prep]', e); window.__errors.push('smash prep: ' + (e.stack || e.message)); }
  // global merge pass: the shell (never merged before: ~900 draws) + every piece again, now with identical
  // materials shared across objects (builders made many std({...}) twins), multi-material walls split by
  // material, faint glass merged per room. Roofs/soffits/fascia stay: pieces patch them by name later.
  {
    const dedupe = G.canonicalMaterials();
    const skip = (o) => /^(roof:|soffit:|fascia|water|mirror)/.test(o.name || '');
    const roots = [shell.root, ...scene.children.filter(c => (c.name || '').startsWith('piece:'))];
    let made = 0, removed = 0; for (const r of roots) { const res = G.mergeStatic(r, { dedupe, skip }); made += res.merged; removed += res.removed; }
    // perf: merged static meshes never move (identity transform under their piece root): skip their per-frame
    // matrix compose in the frame's matrix walk (their world matrix still follows the parent)
    let frozen = 0; for (const r of roots) r.traverse(o => { if (o.isMesh && o.name === 'merged' && o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; frozen++; } });
    window.__merge = { made, removed, frozen }; mark('merge');
  }
  // throwable props: one multi-draw per material instead of one draw per prop
  const propBatch = batchDynamics(scene, phys); ctxBase.propBatch = propBatch; window.__propBatch = { batches: propBatch.batches, instances: propBatch.instances };
  { const f = () => propBatch.sync(); f.__src = 'perf.js propBatch.sync'; updates.push(f); }
  try { smashPrep?.afterMerge(scene, propBatch); } catch (e) { console.error('[smash prep]', e); window.__errors.push('smash prep: ' + (e.stack || e.message)); }
  await envP; mark('env');
  // per-room light probes with one bounce (see lighting.js). Photo shots wait for them; visitors start
  // walking right away while the probes bake in the background (rooms brighten up once they're done).
  // per-room light probes: bound now (final shader programs exist from the start), baked later
  let bound = null;
  if (!params.get('noprobes')) { try { bound = bindRoomProbes(ctxBase, SKY ? { dual: SKY.dual } : undefined); } catch (e) { console.error('[probes]', e); window.__errors.push('probes: ' + e.message); } }
  // walk mode: a small pool of real lights handed to the fixtures nearest the viewer (see perf.js)
  const pool = SHOT ? null : createLightPool(scene, { points: 3, spots: 2 });
  ctxBase.lightPool = pool;
  if (!SHOT) for (const m of guardMirrors(scene)) if (m.room) mirrorRooms.add(m.room);
  const probeCapture = pool ? (pos, draw) => (cull ? cull.without(() => pool.around(pos, draw)) : pool.around(pos, draw)) : null;
  const probesJob = () => !bound ? Promise.resolve() : (SKY ? SKY.bakeProbes(bound, probeCapture, LIGHT.probeIntensity) : bound.bake({ intensity: LIGHT.probeIntensity, onStatus: SHOT ? status : null, background: !SHOT,
    beforeCapture: probeCapture }))
    .then(() => { shadows?.poke(); }).catch(e => { console.error('[probes]', e); window.__errors.push('probes: ' + e.message); });
  if (bound && SHOT) await probesJob();
  setupPost();
  mark('post');

  // views registry
  const views = {}; for (const m of Object.values(mods)) Object.assign(views, m.views || {});
  window.__views = Object.keys(views);
  const setCam = (v) => { camera.fov = v.fov ?? 60; camera.position.set(...v.pos); camera.lookAt(new THREE.Vector3(...v.look)); if (v.roll) camera.rotateZ(-v.roll * Math.PI / 180); camera.updateProjectionMatrix(); }; // roll: degrees, + = phone tilted clockwise

  if (SHOT) {
    if (viewId) { if (!views[viewId]) { window.__errors.push('no view ' + viewId); } else setCam(views[viewId]); }
    else if (camParam) { const a = camParam.split(',').map(Number); setCam({ pos: a.slice(0, 3), look: a.slice(3, 6), fov: a[6] || 60, roll: a[7] || 0 }); }
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
  const qParam = (params.get('quality') || 'auto').toLowerCase();
  const quality = createQuality({ renderer, apply: applyQuality, initial: qParam === 'max' ? 'ultra' : qParam });
  if (qParam === 'max') quality.set('max');
  ctxBase.quality = quality; window.__quality = quality;
  shadows = createShadowScheduler(renderer); ctxBase.shadows = shadows;
  if (SKY) { try { await SKY.setup({ bound, lightPool: pool, shadowSched: shadows, quality }); } catch (e) { console.error('[sky setup]', e); window.__errors.push('sky setup: ' + (e.stack || e.message)); } }
  // src/look: light shafts + dust, lawn grass, film look toggle (?look=0: off, for perf A/B)
  if (params.get('look') !== '0') { try { const { createLook } = await import('./look/index.js'); ctxBase.look = createLook({ ...ctxBase, quality }, { film: params.get('film') ? null : passes.film }); } catch (e) { console.error('[look]', e); window.__errors.push('look: ' + (e.stack || e.message)); } }
  // room/portal culling (src/cull.js): walk mode only; photo shots never cull
  // the static sun shadow map is drawn with EVERY caster, culled or not: three builds the main-pass lists before
  // the shadow pass, so the camera may see layer 30 (= culled) just for the shadow pass. Culling therefore never
  // changes shadows and never forces a refresh.
  { const sm = renderer.shadowMap, r0 = sm.render.bind(sm); sm.render = (lights, sc, cam) => { const had = cam.layers.isEnabled(30); if (cull?.enabled && !had) cam.layers.enable(30); try { r0(lights, sc, cam); } finally { if (!had) cam.layers.disable(30); } }; }
  if (!params.get('nocull')) { cull = createCuller({ scene, camera, phys, doors: ctxBase.doors || [], mirrorRooms }); cull.props = ctxBase.propBatch?.tracked || null; window.__cull = cull; }
  THREE.DefaultLoadingManager.onLoad = ((prev) => () => { prev?.(); shadows.poke(); singlePassFaintGlass(scene); })(THREE.DefaultLoadingManager.onLoad); // late model loads cast shadows too
  window.__singlePassGlass = singlePassFaintGlass(scene); setTimeout(() => singlePassFaintGlass(scene), 15000); // perf.js: faint glass draws in one pass
  // E: look-at interactions first (src/interact.js: taps, cars, …), then the nearest door
  const player = createPlayer({ ...ctxBase, dom: canvas, useNearest: (pos) => { if (ctxBase.interact?.use()) return; useNearestDoor(pos); }, onLockChange: (l) => document.body.classList.toggle('locked', l), uiBlocking: () => { const b = document.body.classList; return b.contains('ui-open') || b.contains('menu-open') || b.contains('paused'); } }, { spawn: SPAWN, yaw: Math.PI });
  ctxBase.player = player;
  { const { createDamage } = await import('./damage.js'); ctxBase.damage = createDamage(ctxBase); } // shared material damage model (src/damage.js)
  { const { createInteract } = await import('./interact.js'); const ix = createInteract({ ...ctxBase, player }); ctxBase.interact = ix; const f = (dt) => ix.update(dt); f.__src = 'interact.js'; updates.push(f); }
  const S0 = settings.get(); player.state.sens = S0.sens; camera.fov = S0.fov || 70; camera.updateProjectionMatrix();
  let photoMode = null; // P (src/photo), loaded on first use
  // Settings > VIDEO (perf.js PRESETS): preset -> quality tier / MAX, 'custom' -> base tier + overrides; tree detail,
  // view distance, field of view. Photo mode holds its own (MAX) config and re-applies these on exit.
  const videoKey = (st) => JSON.stringify([st.quality, st.base, ...VIDEO_KEYS.map(k => st[k])]);
  const applyVideo = (st, withQuality = !params.get('quality')) => {
    if (photoMode?.active) return;
    if (withQuality) { if (st.quality === 'custom') quality.set(st.base || 'high', videoOverrides(st)); else quality.set(st.quality); }
    window.__trees?.setDetail(st.treeDetail, st.viewDist);
  };
  ctxBase.applyVideo = () => applyVideo(settings.get());
  applyVideo(S0);
  let mp = null;
  try { const game = await import('./multiplayer.js'); mp = await game.start({ ...ctxBase, player }); } catch (e) { console.warn('[game] not loaded:', e.message); }
  // title menu over the live house (src/net/menu.js); ?room= joins directly, ?menu=0 plays solo
  const { createMenu } = await import('./net/menu.js');
  const roomParam = params.get('room'); const skipMenu = !!roomParam || params.get('menu') === '0';
  const menu = createMenu({ mp, quality, enterGame: () => flyToSpawn(), toMenu: () => flyToMenu() });
  ctxBase.menu = menu;
  if (mp?.avatars) menu.hooks.openAvatarPanel = () => mp.avatars.open(); // src/avatars/sync.js
  if (skipMenu) { menu.setGame(); camView = 'play'; if (roomParam && mp) await mp.connect(roomParam); }
  else { camView = 'menu'; menuCam(0); document.body.classList.add('menu-open'); }
  function flyToSpawn() {
    const s = spawnFor(mp?.connected ? mp.selfId : 'local');
    player.teleport(s[0], s[1], s[2], Math.PI); player.state.pitch = -0.05; player.state.keys.clear(); player.state.thirdPerson = true; // Fortnite-style third person by default (V = first person)
    const to = { pos: new THREE.Vector3(s[0], s[1] + 2.0, s[2] - 3.0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, Math.PI, 0, 'YXZ')), fov: settings.get().fov || 70 };
    camTween = { a: camPose(), b: () => to, t: 0, dur: 2.2, then: () => { camView = 'play'; } }; camView = 'fly';
  }
  function flyToMenu() { player.state.keys.clear(); menuT0 = camT; camTween = { a: camPose(), b: () => orbitPose(camT), t: 0, dur: 2.0, then: () => { camView = 'menu'; } }; camView = 'fly'; }
  // compile every shader behind the loading screen (parallel where the browser supports it): no hitches when
  // turning to face a new room for the first time
  status('Preparing shaders…'); pool?.snap(player.position);
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('[compile]', e.message); }
  mark('compiled');
  document.getElementById('loading')?.classList.add('done');
  setTimeout(probesJob, 300); // bake room lighting while the visitor walks (or sits on the title menu)
  const { createHud } = await import('./net/hud.js');
  const hudUI = createHud({ quality, mp, menu, params }); hudStatus = (m) => hudUI.setStatus(m);
  const applySettings = (st) => { player.state.sens = st.sens; };
  let lastV = videoKey(S0), lastFov = S0.fov;
  settings.onChange((st) => { applySettings(st); const k = videoKey(st); if (k !== lastV) { lastV = k; applyVideo(st, true); }
    if (st.fov !== lastFov) { lastFov = st.fov; if (camView === 'play' && !photoMode?.active) { camera.fov = st.fov; camera.updateProjectionMatrix(); } } });
  if (camView === 'menu') menu.showMain();
  hudUI.setStatus('');
  // P = photo mode (src/photo): max graphics, free camera, accumulated AA / depth of field, filters, 2x PNG save.
  // (The path tracer, src/pathtrace.js, is only used by shot mode's ?pt=.)
  addEventListener('keydown', async (e) => {
    if (e.code !== 'KeyP' || e.repeat || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range')) return;
    const b = document.body.classList; if (menu.mode !== 'game' || b.contains('paused') || b.contains('menu-open') || (b.contains('ui-open') && !b.contains('photo')) || camView !== 'play') return;
    if (!photoMode) { const { createPhotoMode } = await import('./photo/index.js');
      photoMode = createPhotoMode({ ...ctxBase, player, quality, sky: SKY, getComposer: () => composer, renderScene: () => render(), applyVideo: ctxBase.applyVideo }); }
    if (photoMode.active) photoMode.exit(); else photoMode.enter();
  });
  let last = performance.now(), t = 0, awakePrev = 0, lastWork = 0; const gpuT = createGpuTimer(renderer.getContext()); window.__gpuTimer = gpuT;
  let blobs = null; try { blobs = createBlobShadows({ scene, phys }); window.__blobs = blobs; } catch (e) { console.warn('[blobs]', e); }
  const FLOG = window.__frameLog = { buf: new Float32Array(8192), n: 0 }; // loop frame intervals (ms), for tools/fps120.mjs
  const frameFn = () => {
    if (window.__dbg.paused) { last = performance.now(); return; }
    const now = performance.now(); FLOG.buf[FLOG.n++ & 8191] = now - last; const dt = Math.min((now - last) / 1000, 0.1); last = now; t += dt;
    gpuT.begin();
    const pf = PROF.on; let tq = pf ? performance.now() : 0; const lap = (k) => { if (!pf) return; const n = performance.now(); PROF.add(k, n - tq); tq = n; };
    if (pf) PROF.frames++;
    quality.frame(dt * 1000, lastWork, gpuT.ms); lap('quality.frame');
    const doorsMoving = animateDoors(dt);
    camT += dt;
    if (camView === 'play') { autoOpenDoors(player.position); player.update(dt); if (photoMode?.active) photoMode.drive(dt); }
    else if (camView === 'menu') menuCam(dt);
    else if (camView === 'fly') flyCam(dt);
    lap('player.update+doors');
    phys.step(dt); lap('phys.step');
    if (pf) for (const u of updates) { u(dt, t); lap('upd ' + (u.__src || 'main')); }
    else for (const u of updates) u(dt, t);
    pool?.update(dt, camera.position); lap('lightPool.update');
    if (SKY) { SKY.afterPool(); SKY.step(dt); lap('sky'); }
    // static sun shadows (perf.js): doors re-render it while swinging; a prop going back to sleep pokes it once;
    // avatars and other movers have blob shadows instead
    let awake = 0; for (const d of phys.dynamics) if (!d.body.isSleeping()) awake++;
    if (awake < awakePrev) shadows.poke(); awakePrev = awake;
    blobs?.update(dt, () => shadows.poke());
    shadows.tick(doorsMoving); lap('shadows.tick+blobs');
    const drainPre = () => { for (let i = 0; i < preQ.length; i++) { try { preQ[i](); } catch (e) { console.warn('[preRender]', e); } } preQ.length = 0; };
    if (photoMode?.active) { drainPre(); photoMode.render(() => render()); }
    else {
      // perf: ONE scene matrix walk per frame. Every renderer.render() re-walks all ~5k objects' matrices, and the
      // composer renders the scene 3x (N8AO beauty + its two transparency passes) plus the water refraction capture
      // (deferred here via ctx.preRender); nothing moves between them.
      scene.updateMatrixWorld(); scene.matrixWorldAutoUpdate = false;
      try {
        if (pf) lap('matrixWorld');
        drainPre(); if (pf) lap('preRender (water capture)');
        if (pf) { const sh = renderer.shadowMap.needsUpdate; cull?.update(); lap('cull.update'); render(true); lap(sh ? 'render (incl. shadow refresh)' : 'render (no shadow)'); PROF.add('shadow refreshes/frame', sh ? 1 : 0); }
        else render();
      } finally { scene.matrixWorldAutoUpdate = true; }
    }
    hud(player); lap('hud');
    gpuT.end(); lastWork = performance.now() - now;
  };
  // ---- frame-rate setting (settings.fpsCap): '60' / '120' = rAF loop that skips frames to hold the cap;
  // 'uncapped' = MessageChannel loop (a macrotask per frame, so input / network / chat events interleave between
  // frames; no busy-waiting), paused while the tab is hidden. Physics is fixed-step and net sends are 18 Hz, so
  // nothing speeds up with the frame rate.
  const mc = new MessageChannel(); let loopMode = null, capMs = 0, lastShown = 0;
  const pump = () => { if (loopMode !== 'uncapped' || document.hidden) return; if (window.__dbg.paused) { frameFn(); setTimeout(pump, 50); return; } frameFn(); mc.port2.postMessage(0); };
  mc.port1.onmessage = pump;
  const capped = () => { const n = performance.now(); if (n - lastShown < capMs - 1.5) return; lastShown = n; frameFn(); };
  function setLoop(cap) {
    cap = String(cap || 'uncapped'); if (cap === loopMode) return; loopMode = cap;
    if (cap === 'uncapped') { capMs = 0; quality.capMs = 0; renderer.setAnimationLoop(null); mc.port2.postMessage(0); }
    else { capMs = 1000 / +cap; quality.capMs = capMs; renderer.setAnimationLoop(capped); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && loopMode === 'uncapped') { last = performance.now(); mc.port2.postMessage(0); } });
  setLoop(params.get('fpscap') || settings.get().fpsCap); settings.onChange((st) => setLoop(params.get('fpscap') || st.fpsCap));
  window.__loop = { get mode() { return loopMode; }, set: setLoop };
  preQ.on = true;
  window.__ready = true;
}

// Walkability audit: sweep a player-sized capsule over every room's floor and every interior opening;
// report blocked floor area per room and which colliders (by piece) block it. tools/walk_audit.mjs calls it.
window.__audit = () => {
  const phys = ctxBase.phys, R = phys.RAPIER, world = phys.world; world.step(); // build the query BVH
  const cap = new R.Capsule(0.55, 0.28), rot = { x: 0, y: 0, z: 0, w: 1 };
  const hitAt = (x, y, z) => { const hits = []; world.intersectionsWithShape({ x, y, z }, rot, cap, (c) => { if (!c.parent() || c.parent().isFixed()) hits.push(c); return true; }); return hits; };
  const desc = (c) => { const t = c.translation(); const sh = c.shape; const he = sh.halfExtents ? [sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z].map(v => +(2 * v).toFixed(2)) : (sh.radius ? ['r', +sh.radius.toFixed(2)] : 'mesh');
    return { tag: phys.tags.get(c.handle) || '?', at: [t.x, t.y, t.z].map(v => +v.toFixed(2)), size: he }; };
  const rooms = {};
  for (const [id, r] of Object.entries(P.ROOMS)) {
    const [x0, z0, x1, z1] = r.rect; const fy = P.LEVELS[r.level].floor; const yc = fy + 0.06 + 0.28 + 0.55;
    let n = 0, blocked = 0; const by = new Map();
    for (let x = x0 + 0.32; x <= x1 - 0.32; x += 0.3) for (let z = z0 + 0.32; z <= z1 - 0.32; z += 0.3) {
      n++; const h = hitAt(x, yc, z); if (!h.length) continue; blocked++;
      for (const c of h) { const k = c.handle; const e = by.get(k) || { c, cells: 0 }; e.cells++; by.set(k, e); }
    }
    const top = [...by.values()].sort((a, b) => b.cells - a.cells).slice(0, 6).map(e => ({ ...desc(e.c), m2: +(e.cells * 0.09).toFixed(2) }));
    rooms[id] = { blockedPct: n ? Math.round(100 * blocked / n) : 0, cells: n, top };
  }
  const openings = [];
  for (const o of P.OPENINGS) {
    if (!['door', 'doorway', 'french', 'slider'].includes(o.type)) continue;
    const fy = P.LEVELS[o.level].floor; const h = hitAt(o.at[0], fy + 0.89, o.at[1]).filter(c => !(phys.tags.get(c.handle) || '').startsWith('shell') || true);
    if (h.length) openings.push({ id: o.id, type: o.type, blockers: h.map(desc) });
  }
  const sanity = { insideWall: hitAt(0.5, 1.2, 10.0).map(desc), insideStairBase: hitAt(10.56, 0.95, 7.5).map(desc), colliders: world.colliders.len() };
  return { rooms, openings, sanity };
};

// ---------------------------------------------------------------- title-menu camera
// Slow orbit of the exterior (bounds from plan.js EXT); 'fly' eases between any two poses (menu <-> spawn).
const SPAWN = [9.8, 0.05, 6.6];
// spawn slots on the foyer floor beside the stair (STAIR x 10.0–11.12), one per player id
const SPAWN_SLOTS = [[9.8, 6.6], [9.15, 6.6], [8.7, 6.6], [9.15, 5.5], [8.7, 5.5], [9.15, 7.7], [8.7, 7.7], [9.15, 8.7]];
function spawnFor(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const [x, z] = id === 'local' ? SPAWN_SLOTS[0] : SPAWN_SLOTS[h % SPAWN_SLOTS.length]; return [x, SPAWN[1], z]; }
const HOUSE_BOUNDS = (() => { const pts = [...P.EXT[0], ...P.EXT[1]]; const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; })();
let camView = 'play', camTween = null, camT = 0, menuT0 = 0;
function orbitPose(t) {
  const b = HOUSE_BOUNDS, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) * 0.95;
  const a = -2.2 + (t - menuT0) * 0.045; // start on the street side, drift round slowly
  const pos = new THREE.Vector3(cx + Math.cos(a) * r, 9.5 + Math.sin((t - menuT0) * 0.07) * 1.5, cz + Math.sin(a) * r);
  const m = new THREE.Matrix4().lookAt(pos, new THREE.Vector3(cx, 3.2, cz), new THREE.Vector3(0, 1, 0));
  return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(m), fov: 50 };
}
function camPose() { return { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov }; }
function setPose(p) { camera.position.copy(p.pos); camera.quaternion.copy(p.quat); if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); } }
function menuCam() { setPose(orbitPose(camT)); }
function flyCam(dt) {
  const tw = camTween; if (!tw) { camView = 'play'; return; }
  tw.t += dt; const k0 = Math.min(1, tw.t / tw.dur); const k = k0 * k0 * (3 - 2 * k0); const b = tw.b();
  setPose({ pos: tw.a.pos.clone().lerp(b.pos, k), quat: tw.a.quat.clone().slerp(b.quat, k), fov: tw.a.fov + (b.fov - tw.a.fov) * k });
  if (k0 >= 1) { camTween = null; tw.then?.(); }
}

function render(culled = false) {
  if (!culled) cull?.update();
  if (composer) composer.render(); else renderer.render(scene, camera); }
// handles for tools/perf.mjs (frame-cost measurement); paused stops the walk loop so frames can be timed one by one
window.__dbg = { renderer, scene, camera, sun, LIGHT, render: () => render(), get composer() { return composer; }, get n8() { return n8; }, paused: false };

// Doors: E toggles the nearest door within 1.6 m.
function useNearestDoor(pos) {
  let best = null, bd = 1.6;
  for (const d of ctxBase.doors || []) { const dist = Math.hypot(d.world.x - pos.x, d.world.z - pos.z) + Math.abs(d.world.y - (pos.y + 1)) * 0.5; if (dist < bd) { bd = dist; best = d; } }
  if (!best) return; best.target = best.target > 0.5 ? 0 : 1;
  if (best.target > 0.5 && best.collider) { ctxBase.phys.remove(best.collider); best.collider = null; }
  if (best.target < 0.5) best.pendingClose = true;
}
// Doors swing open on their own when someone walks up (E still toggles). Closed doors match the photos,
// but nobody should get stuck behind one.
function autoOpenDoors(pos) {
  for (const d of ctxBase.doors || []) {
    if (d.target > 0.5 || d.noAuto) continue; // noAuto: closed on purpose with E (src/building clears it when you walk away)
    const near = Math.hypot(d.world.x - pos.x, d.world.z - pos.z) < 1.25 && Math.abs(d.world.y - (pos.y + 1)) < 1.2;
    if (near) { d.target = 1; if (d.collider) { ctxBase.phys.remove(d.collider); d.collider = null; } d.pendingClose = false; }
  }
}
function animateDoors(dt) {
  let moved = false;
  for (const d of ctxBase.doors || []) {
    if (Math.abs(d.open - d.target) < 1e-3) { if (d.pendingClose && d.target < 0.5) { d.pendingClose = false; d.collider = d.closedCollider(); } continue; }
    d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 1.8); d.setPose(); moved = true;
  }
  return moved;
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
  mgr.onStart = () => { mgr.isLoading = true; }; mgr.onProgress = (u, l, t) => { done = l; total = t; mgr.isLoading = l < t; const el = document.getElementById('bar'); const pc = Math.round(100 * l / Math.max(1, t)); if (el) el.style.width = pc + '%'; const pe = document.getElementById('loadpct'); if (pe && pe.textContent !== pc + '%') pe.textContent = pc + '%'; };
  mgr.onLoad = () => { mgr.isLoading = false; }; mgr.onError = (u) => { console.warn('load error', u); window.__errors.push('load ' + u); };
}

function hud(player) {
  const el = document.getElementById('where'); if (!el) return;
  const p = player.position; const level = p.y > 2.5 ? 1 : 0;
  let name = 'Outside';
  for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== level) continue; const [x0, z0, x1, z1] = r.rect; if (p.x >= x0 - 0.35 && p.x <= x1 + 0.35 && p.z >= z0 - 0.35 && p.z <= z1 + 0.35) { name = r.name; break; } }
  if (el.textContent !== name) el.textContent = name;
}

addEventListener('resize', () => { if (SHOT) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); });

main().catch(e => { console.error(e); window.__errors.push('main: ' + (e.stack || e.message)); status('Error: ' + e.message); window.__ready = true; });
