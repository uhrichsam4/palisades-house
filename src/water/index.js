// Water API (contract). The pool piece CALLS createWater; the water module (src/water/*) IMPLEMENTS it;
// characters (src/fluid, src/player) QUERY waterBodies to swim/splash. Keep this signature stable.
//
//   const water = createWater(ctx, {
//     outline: [[x,z], ...],   // water surface polygon in world XZ (pool + spa can be separate bodies)
//     surfaceY: -0.08,         // still-water height (world y)
//     floorY: (x, z) => y,     // pool floor height at a point (for depth tint / caustics); or a number
//     color: 0x2fb7c9,         // shallow tint (photos: clear turquoise over white/grey plaster)
//     name: 'pool',
//   });
//   water.group            // THREE.Group already added under ctx.root
//   water.disturb(x, z, radius, strength)   // push the surface (ripples)
//   water.splash(x, y, z, strength)         // droplets + ripple ring
//   water.heightAt(x, z)                    // current surface y
//   water.isInside(x, z)                    // inside outline?
//   water.addFloater(dynamicBodyRecord, { volume, density }) // buoyancy for phys.dynamic(...) results
//
// Units: disturb strength ~0.1 = a hand / slow wake, 1 = a body dropping in (pushes the surface down by ~1.2 cm
// over `radius` m; negative pulls it up). splash strength 0.3 = small splash, 1 = cannonball (droplets scale with it).
// addFloater: volume in m³ (default: from the collider shape), density in kg/m³ (optional: sets the body's mass).
//
// Implementation (see glsl.js):
//  - GPU height-field wave equation (GPUComputationRenderer) on a ≤256² grid (~4 cm cells) masked to the outline,
//    reflective walls, damping; analytic capillary-gravity "wind" ripples on top (mirrored on the CPU for heightAt).
//  - Surface: MeshPhysicalMaterial (sky reflections via kit.outdoor, GGX sun glints, Fresnel) patched with per-pixel
//    normals and a real refraction: the view ray is refracted, intersected with the floor (floorY), and the pool
//    interior is looked up in a shared screen capture of everything inside the water volume; Beer–Lambert absorption
//    along the path + in-scattering give the pale-turquoise shallows / deep blue.
//  - Caustics: refracted sun rays splatted onto the floor (area ratio), applied to the pool floor + walls by a
//    multiplicative overlay that also carries underwater fog.
//  - Droplets (instanced), floaters (Rapier buoyancy + drag + wakes), underwater tint.
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import * as G from './glsl.js';
import { pointInPoly, bounds, clippedGrid, gridGeometry, wallGeometry } from './geom.js';

export const waterBodies = [];

const LAYER = 23;           // capture layer: everything inside a water volume (+ lights)
const RHO = 1000, GRAV = 9.81;
const SDT = 1 / 120;        // simulation step
const C_WAVE = 0.75;        // m/s
const PREWARM = 150;        // shot mode: steps run before the first frame so queued ripples have spread

// ---------------------------------------------------------------- shared ambient waves
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function genWaves(n, lmin, lmax, slope, seed, windAng, spread) {
  const r = mulberry(seed); const A = [], B = [], cpu = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const lam = lmin * Math.pow(lmax / lmin, (i + r() * 0.8) / n);
    const k = 2 * Math.PI / lam; const ang = windAng + (r() - 0.5) * 2 * spread;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const w = Math.sqrt(GRAV * k + 7.28e-5 * k * k * k);
    const amp = slope / k * (0.55 + 0.9 * r()); const ph = r() * Math.PI * 2;
    A.push(new THREE.Vector4(dx, dz, k, amp)); B.push(new THREE.Vector2(w, ph));
    cpu.set([dx, dz, k, amp, w, ph], i * 6);
  }
  return { A, B, cpu };
}
const WIND = 0.5;
const AMB = genWaves(G.NW, 0.17, 1.6, 0.016, 7, WIND, 1.1);
const MICRO = genWaves(G.NM, 0.03, 0.12, 0.028, 11, WIND + 0.3, 1.4);
const U = {
  uTime: { value: 0 }, uAmb: { value: 1 },
  uWA: { value: AMB.A }, uWB: { value: AMB.B }, uMA: { value: MICRO.A }, uMB: { value: MICRO.B },
};
function ambientCPU(x, z, t) {
  const c = AMB.cpu; let h = 0;
  for (let i = 0; i < G.NW; i++) { const o = i * 6; h += c[o + 3] * Math.sin(c[o + 2] * (c[o] * x + c[o + 1] * z) - c[o + 4] * t + c[o + 5]); }
  return h * U.uAmb.value;
}

// ---------------------------------------------------------------- shared per-frame state (capture, tint, clock)
const MOD = {
  lastT: null, frame: 0, time: 0, shot: false,
  rt: null, capCam: new THREE.PerspectiveCamera(), scale: 0.75, uCapture: { value: null }, uCapSize: { value: new THREE.Vector2(1, 1) },
  lastScan: -1e9, tint: null, scene: null, sunDir: new THREE.Vector3(0.42, 0.62, 0.66).normalize(),
  frustum: new THREE.Frustum(), m4: new THREE.Matrix4(), deep: new THREE.Color(0x0a5a6e),
};
const _v = new THREE.Vector3(), _c = new THREE.Color(), _box = new THREE.Box3();

function sunInfo(ctx) {
  const s = ctx.sun;
  if (s) { s.updateMatrixWorld(); s.target.updateMatrixWorld(); _v.setFromMatrixPosition(s.matrixWorld).sub(_v.clone().setFromMatrixPosition(s.target.matrixWorld)); if (_v.lengthSq() > 1e-6) MOD.sunDir.copy(_v.normalize()); }
  else if (ctx.LIGHT?.sunDir) MOD.sunDir.copy(ctx.LIGHT.sunDir).normalize();
  const I = s ? s.intensity : 3.2; const col = s ? s.color : _c.set(0xffffff);
  return { I, lum: I * (0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b) };
}

function frameAll(ctx, dt, t) {
  if (t === MOD.lastT) return; MOD.lastT = t; MOD.frame++;
  dt = Math.min(Math.max(dt, 0), 0.1);
  MOD.time = MOD.shot ? 4.0 + MOD.frame / 60 : MOD.time + dt;
  U.uTime.value = MOD.time;
  const sun = sunInfo(ctx);
  const cam = ctx.camera; cam.updateMatrixWorld();
  const bodies = waterBodies.filter(b => b._ctx && b._ctx.renderer === ctx.renderer);
  let under = null;
  for (const b of bodies) { b._step(dt, sun); if (b._under) under = b; }
  // underwater tint
  if (MOD.tint) { MOD.tint.visible = !!under; if (under) { MOD.tint.material.uniforms.uColor.value.copy(under._fogColor); } }
  // refraction capture (once per frame, shared by all bodies)
  const visible = bodies.filter(b => !b._under && b._visible(cam));
  if (visible.length) capture(ctx, bodies);
}

function scanLayers(scene, bodies) {
  const vols = bodies.map(b => b._volume);
  scene.traverse(o => {
    if (o.isLight) { o.layers.enable(LAYER); return; }
    if (!(o.isMesh || o.isPoints || o.isLine)) return;
    if (o.userData.waterSkip) return;
    if (o.userData.waterCapture) { o.layers.enable(LAYER); return; }
    let bb;
    if (o.isInstancedMesh || o.isSkinnedMesh) { if (!o.boundingBox) o.computeBoundingBox(); bb = o.boundingBox; }
    else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb = o.geometry.boundingBox; }
    if (!bb || bb.isEmpty()) return;
    _box.copy(bb).applyMatrix4(o.matrixWorld);
    if (vols.some(v => v.intersectsBox(_box))) o.layers.enable(LAYER); else o.layers.disable(LAYER);
  });
}

function capture(ctx, bodies) {
  const { renderer, scene, camera } = ctx;
  if (MOD.frame - MOD.lastScan > 60 || MOD.lastScan < 0) { scene.updateMatrixWorld(); scanLayers(scene, bodies); MOD.lastScan = MOD.frame; }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const w = Math.max(16, Math.round(size.x * MOD.scale)), h = Math.max(16, Math.round(size.y * MOD.scale));
  if (!MOD.rt) MOD.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  if (MOD.rt.width !== w || MOD.rt.height !== h) MOD.rt.setSize(w, h);
  MOD.uCapture.value = MOD.rt.texture; MOD.uCapSize.value.set(w, h);
  const cc = MOD.capCam; cc.copy(camera); cc.layers.set(LAYER);
  const prevT = renderer.getRenderTarget(), prevSh = renderer.shadowMap.autoUpdate, prevBg = scene.background, prevXr = renderer.xr.enabled;
  const prevCol = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevAuto = renderer.autoClear;
  renderer.shadowMap.autoUpdate = false; renderer.xr.enabled = false; scene.background = null; renderer.autoClear = true;
  renderer.setRenderTarget(MOD.rt); renderer.setClearColor(MOD.deep, 1);
  renderer.render(scene, cc);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevCol, prevA); renderer.autoClear = prevAuto;
  renderer.shadowMap.autoUpdate = prevSh; scene.background = prevBg; renderer.xr.enabled = prevXr;
}

function ensureTint(scene) {
  if (MOD.tint && MOD.scene === scene) return;
  const mat = new THREE.ShaderMaterial({
    vertexShader: G.tintVert, fragmentShader: G.tintFrag, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x0b4d58) }, uAlpha: { value: 0.22 } },
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false; m.renderOrder = 1e6; m.visible = false; m.name = 'water:underwaterTint';
  m.userData.waterSkip = true; m.userData.keep = true;
  scene.add(m); MOD.tint = m; MOD.scene = scene;
}

// ---------------------------------------------------------------- createWater
export function createWater(ctx, opt) {
  const { root, renderer, kit } = ctx;
  const name = opt.name || 'pool';
  const outline = opt.outline; const surfaceY = opt.surfaceY ?? 0;
  const floorFn = typeof opt.floorY === 'function' ? opt.floorY : (typeof opt.floorY === 'number' ? () => opt.floorY : () => surfaceY - 1.5);
  const color = new THREE.Color(opt.color ?? 0x2fb7c9);
  const inside = (x, z) => pointInPoly(outline, x, z);
  MOD.shot = !!ctx.shot; MOD.scale = ctx.shot ? 1 : (opt.captureScale ?? 0.75);
  if (ctx.scene) ensureTint(ctx.scene);

  // ---- grid
  const bb = bounds(outline);
  const cell = Math.max(opt.cell ?? 0.04, (bb.x1 - bb.x0) / 254, (bb.z1 - bb.z0) / 254);
  const nx = Math.ceil((bb.x1 - bb.x0) / cell) + 2, nz = Math.ceil((bb.z1 - bb.z0) / cell) + 2;
  const ox = bb.x0 - cell, oz = bb.z0 - cell;
  const box = new THREE.Vector4(ox, oz, nx * cell, nz * cell);

  // ---- static texture: mask, depth (dilated outside), floorY
  const N = nx * nz; const mask = new Uint8Array(N), depth = new Float32Array(N), floorA = new Float32Array(N); const have = new Uint8Array(N);
  let minFloor = surfaceY, sumD = 0, cntD = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = ox + (i + 0.5) * cell, z = oz + (j + 0.5) * cell, k = j * nx + i;
    if (inside(x, z)) { const f = floorFn(x, z); mask[k] = 1; have[k] = 1; floorA[k] = f; depth[k] = Math.max(0, surfaceY - f); minFloor = Math.min(minFloor, f); sumD += depth[k]; cntD++; }
  }
  for (let pass = 0; pass < 24; pass++) {
    const add = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (have[k]) continue; let s = 0, c = 0, sf = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b2 = j + dj; if (a < 0 || b2 < 0 || a >= nx || b2 >= nz) continue; const q = b2 * nx + a; if (have[q]) { s += depth[q]; sf += floorA[q]; c++; } }
      if (c) add.push([k, s / c, sf / c]);
    }
    if (!add.length) break; for (const [k, d, f] of add) { depth[k] = d; floorA[k] = f; have[k] = 1; }
  }
  const meanD = cntD ? sumD / cntD : 1.5;
  const sdata = new Uint16Array(N * 4);
  for (let k = 0; k < N; k++) {
    sdata[k * 4] = THREE.DataUtils.toHalfFloat(mask[k]);
    sdata[k * 4 + 1] = THREE.DataUtils.toHalfFloat(have[k] ? depth[k] : meanD);
    sdata[k * 4 + 2] = THREE.DataUtils.toHalfFloat(have[k] ? floorA[k] : surfaceY - meanD);
  }
  const staticTex = new THREE.DataTexture(sdata, nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
  staticTex.minFilter = staticTex.magFilter = THREE.LinearFilter; staticTex.needsUpdate = true;
  const uStatic = { value: staticTex }, uBox = { value: box };

  // ---- GPU simulation
  const gpu = new GPUComputationRenderer(nx, nz, renderer);
  if (!renderer.extensions.has('EXT_color_buffer_float')) gpu.setDataType(THREE.HalfFloatType);
  const hVar = gpu.addVariable('tH', G.simFrag, gpu.createTexture());
  gpu.setVariableDependencies(hVar, [hVar]);
  const drops = Array.from({ length: G.MAX_DROPS }, () => new THREE.Vector4());
  Object.assign(hVar.material.uniforms, {
    uStatic, uBox, uC2: { value: Math.pow(C_WAVE * SDT / cell, 2) }, uDamp: { value: 0.9965 }, uRelax: { value: 0.9996 },
    uDrops: { value: drops }, uNDrops: { value: 0 },
  });
  const gerr = gpu.init(); if (gerr) console.error('[water] gpgpu', gerr);
  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
  const surfRT = new THREE.WebGLRenderTarget(nx, nz, rtOpts);
  const surfMat = gpu.createShaderMaterial(G.surfFrag, { tSim: { value: null }, uStatic, uCell: { value: cell } });
  const tSurf = { value: surfRT.texture };

  // ---- caustics
  const mx = Math.min(nx * 2, 420), mz = Math.min(nz * 2, 420);
  const cw = Math.min(1024, mx * 2), ch = Math.min(1024, mz * 2);
  const causticRT = new THREE.WebGLRenderTarget(cw, ch, rtOpts);
  const tCaustic = { value: causticRT.texture };
  const uSun = { value: MOD.sunDir };
  const cGeo = new THREE.BufferGeometry();
  { const p = new Float32Array((mx + 1) * (mz + 1) * 3); let o = 0; for (let j = 0; j <= mz; j++) for (let i = 0; i <= mx; i++) { p[o++] = i / mx; p[o++] = j / mz; p[o++] = 0; }
    const idx = new Uint32Array(mx * mz * 6); o = 0; for (let j = 0; j < mz; j++) for (let i = 0; i < mx; i++) { const a = j * (mx + 1) + i, b2 = a + 1, c = a + mx + 1, d = c + 1; idx.set([a, b2, d, a, d, c], o); o += 6; }
    cGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); cGeo.setIndex(new THREE.BufferAttribute(idx, 1)); }
  const cMat = new THREE.ShaderMaterial({
    vertexShader: G.causticVert, fragmentShader: G.causticFrag, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    uniforms: { ...U, tSurf, uStatic, uBox, uSun },
  });
  const cMesh = new THREE.Mesh(cGeo, cMat); cMesh.frustumCulled = false;
  const cScene = new THREE.Scene(); cScene.add(cMesh); const cCam = new THREE.Camera();

  // ---- scene objects
  const group = new THREE.Group(); group.name = 'water:' + name; group.userData.keep = true; root.add(group);
  const sunLum = { value: 3.2 };
  const sigma = { value: new THREE.Vector3() }, scatter = { value: new THREE.Vector3() };
  const lin = [color.r, color.g, color.b];
  // Beer–Lambert coefficients from the shallow tint: `color` is what ~5 m of path (opt.tintPath) does to white light
  sigma.value.set(...lin.map(c => -Math.log(Math.min(0.97, Math.max(0.02, c))) / (opt.tintPath ?? 5)));
  const fogColor = new THREE.Color().copy(color).multiplyScalar(0.28);
  const uFog = { value: new THREE.Vector4(fogColor.r, fogColor.g, fogColor.b, 0.16) };
  const uUnder = { value: 0 };

  // surface
  const tris = clippedGrid(outline, opt.meshCell ?? 0.12);
  const sGeo = gridGeometry(tris, () => 0);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, ior: 1.333, specularIntensity: 1, envMapIntensity: opt.reflect ?? 0.85 });
  kit?.outdoor?.(mat);
  const surfU = { ...U, tSurf, uStatic, uBox, tCapture: MOD.uCapture, uSigma: sigma, uScatter: scatter, uSigmaS: { value: 0.8 }, uDownK: { value: 0.7 }, uDeepCol: { value: MOD.deep } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, surfU);
    sh.vertexShader = 'uniform sampler2D tSurf;\nuniform vec4 uBox;\nvarying vec3 vWP;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 wq = modelMatrix * vec4(transformed, 1.0); transformed.y += texture2D(tSurf, (wq.xz - uBox.xy) / uBox.zw).r; }')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `${G.wavesGLSL}\n${G.microGLSL}
uniform sampler2D tSurf; uniform sampler2D uStatic; uniform sampler2D tCapture; uniform vec4 uBox;
uniform vec3 uSigma; uniform vec3 uScatter; uniform float uSigmaS; uniform float uDownK; uniform vec3 uDeepCol;
uniform mat4 projectionMatrix;
varying vec3 vWP;
void main() {`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 wuv = (vWP.xz - uBox.xy) / uBox.zw;
vec4 wS = texture2D(tSurf, wuv);
vec3 wA = ambientWaves(vWP.xz);
float wfw = length(fwidth(vWP.xz));
vec2 wg = wS.yz + wA.yz + microWaves(vWP.xz, wfw);
vec3 nW = normalize(vec3(-wg.x, 1.0, -wg.y));
normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`)
      .replace('#include <opaque_fragment>', `{
  vec3 V = normalize(cameraPosition - vWP);
  vec3 R = refract(-V, nW, 0.7502);
  float ry = max(-R.y, 0.12);
  float d0 = max(texture2D(uStatic, wuv).g + wS.x, 0.0);
  vec2 hit = vWP.xz + R.xz * (d0 / ry);
  float d1 = max(texture2D(uStatic, (hit - uBox.xy) / uBox.zw).g, 0.0);
  hit = vWP.xz + R.xz * (d1 / ry);
  float d2 = max(texture2D(uStatic, (hit - uBox.xy) / uBox.zw).g, 0.0);
  float tPath = d2 / ry;
  vec4 cp = projectionMatrix * viewMatrix * vec4(vWP + R * tPath, 1.0);
  vec2 suv = clamp(cp.xy / cp.w * 0.5 + 0.5, vec2(0.002), vec2(0.998));
  vec3 bed = texture2D(tCapture, suv).rgb;
  vec3 Tr = exp(-uSigma * (tPath + d2 * uDownK));
  vec3 inS = uScatter * (1.0 - exp(-uSigmaS * tPath));
  float NV = clamp(dot(nW, V), 0.0, 1.0);
  float Fr = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
  outgoingLight += (1.0 - Fr) * (bed * Tr + inS);
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'water-surface-v1';
  const mesh = new THREE.Mesh(sGeo, mat); mesh.position.y = surfaceY; mesh.name = 'water:' + name; mesh.receiveShadow = true;
  mesh.userData.keep = true; mesh.userData.waterSkip = true; group.add(mesh);

  // underside (seen from below when diving)
  const uMat = new THREE.ShaderMaterial({
    vertexShader: G.undersideVert, fragmentShader: G.undersideFrag, side: THREE.BackSide,
    uniforms: { ...U, tSurf, uBox, uSun, uFog, uDeep: { value: new THREE.Color().copy(color).multiplyScalar(0.18) }, uSkyZenith: { value: new THREE.Color(0.35, 0.6, 0.9) }, uSkyHorizon: { value: new THREE.Color(0.75, 0.85, 0.92) } },
  });
  const under = new THREE.Mesh(sGeo, uMat); under.position.y = surfaceY; under.name = 'water:' + name + ':under';
  under.userData.keep = true; under.userData.waterSkip = true; group.add(under);

  // caustics + underwater-fog overlay on the pool floor and walls (multiplies what's already there)
  const oGeoF = gridGeometry(clippedGrid(outline, opt.floorCell ?? 0.08), (x, z) => floorFn(x, z) + 0.006);
  const oGeoW = wallGeometry(outline, surfaceY, floorFn);
  const oMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  oMat.blending = THREE.CustomBlending; oMat.blendSrc = THREE.OneFactor; oMat.blendDst = THREE.SrcAlphaFactor; oMat.blendEquation = THREE.AddEquation;
  oMat.blendSrcAlpha = THREE.ZeroFactor; oMat.blendDstAlpha = THREE.OneFactor;
  oMat.depthWrite = false; oMat.polygonOffset = true; oMat.polygonOffsetFactor = -2; oMat.polygonOffsetUnits = -4;
  const oU = { tCaustic, uBox, uSunLum: sunLum, uGain: { value: opt.causticGain ?? 0.9 }, uAmbRel: { value: 0.3 }, uFog, uUnder, uSurfY: { value: surfaceY } };
  oMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, oU);
    sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tCaustic; uniform vec4 uBox; uniform float uSunLum; uniform float uGain; uniform float uAmbRel; uniform vec4 uFog; uniform float uUnder; uniform float uSurfY;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' +
      sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  float sN = clamp(dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) * PI / max(uSunLum, 1e-4), 0.0, 1.5);
  float gSun = sN / (sN + uAmbRel);
  float wall = 1.0 - abs(vWN.y);
  // walls: look the pattern up further into the pool the deeper the point (the light crossed the pool to get there)
  vec2 cxz = vWP.xz + vWN.xz * wall * (0.12 + 0.7 * max(uSurfY - vWP.y, 0.0));
  float cI = texture2D(tCaustic, (cxz - uBox.xy) / uBox.zw).r;
  float mul = max(1.0 + uGain * (1.0 - 0.35 * wall) * gSun * (cI - 1.0), 0.0);
  float fogF = uUnder * (1.0 - exp(-length(vWP - cameraPosition) * uFog.w));
  gl_FragColor = vec4(uFog.rgb * fogF, mul * (1.0 - fogF));
}`);
  };
  oMat.customProgramCacheKey = () => 'water-overlay-v1';
  for (const g of [oGeoF, oGeoW]) {
    const o = new THREE.Mesh(g, oMat); o.renderOrder = 2; o.receiveShadow = true; o.name = 'water:' + name + ':caustics';
    o.userData.keep = true; o.userData.waterCapture = true; o.layers.enable(LAYER); group.add(o);
  }

  // droplets
  const DMAX = 320;
  const dMat = new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.72, depthWrite: false, envMapIntensity: 1.6 });
  kit?.outdoor?.(dMat);
  const dMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), dMat, DMAX);
  dMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dMesh.count = 0; dMesh.frustumCulled = false;
  dMesh.name = 'water:' + name + ':droplets'; dMesh.userData.keep = true; dMesh.userData.waterSkip = true; group.add(dMesh);
  const D = { p: new Float32Array(DMAX * 3), v: new Float32Array(DMAX * 3), r: new Float32Array(DMAX), n: 0 };
  const drng = mulberry(1234 + waterBodies.length);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

  // ---- CPU mirror of the sim (async readback) for heightAt
  let cpuH = null, reading = false, readEvery = 6;
  const readBuf = new Float32Array(N * 4);
  const simAt = (x, z) => {
    if (!cpuH) return 0;
    const fx = (x - ox) / cell - 0.5, fz = (z - oz) / cell - 0.5;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const a = cpuH[(j * nx + i) * 4], b2 = cpuH[(j * nx + i + 1) * 4], c = cpuH[((j + 1) * nx + i) * 4], d = cpuH[((j + 1) * nx + i + 1) * 4];
    return (a * (1 - tx) + b2 * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };

  // ---- drop queue
  const queue = [];
  function pushDrop(x, z, r, dh) {
    r = Math.max(r, cell * 1.6);
    if (queue.length >= G.MAX_DROPS) { // merge into the nearest queued drop
      let best = 0, bd = Infinity; for (let i = 0; i < queue.length; i++) { const q = queue[i]; const d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      queue[best][3] += dh; return;
    }
    queue.push([x, z, r, dh]);
  }

  // ---- per-frame step (called by frameAll)
  const worldBox = new THREE.Box3(new THREE.Vector3(bb.x0, minFloor - 0.1, bb.z0), new THREE.Vector3(bb.x1, surfaceY + 0.1, bb.z1));
  const volume = new THREE.Box3(new THREE.Vector3(bb.x0 - 0.06, minFloor - 0.25, bb.z0 - 0.06), new THREE.Vector3(bb.x1 + 0.06, surfaceY + 0.05, bb.z1 + 0.06));
  let acc = 0, warmed = false;
  function simStep() {
    const u = hVar.material.uniforms; const n = Math.min(queue.length, G.MAX_DROPS);
    for (let i = 0; i < n; i++) drops[i].set(...queue[i]);
    u.uNDrops.value = n; queue.length = 0;
    gpu.compute(); u.uNDrops.value = 0;
  }
  function stepDroplets(dt) {
    let w = 0;
    for (let i = 0; i < D.n; i++) {
      const o = i * 3; D.v[o + 1] -= GRAV * dt; const drag = Math.exp(-0.6 * dt);
      D.v[o] *= drag; D.v[o + 2] *= drag;
      D.p[o] += D.v[o] * dt; D.p[o + 1] += D.v[o + 1] * dt; D.p[o + 2] += D.v[o + 2] * dt;
      const x = D.p[o], y = D.p[o + 1], z = D.p[o + 2];
      const ins = inside(x, z);
      if (D.v[o + 1] < 0 && ((ins && y < surfaceY + ambientCPU(x, z, MOD.time)) || (!ins && y < surfaceY - 0.05))) {
        if (ins) pushDrop(x, z, 0.035 + D.r[i] * 4, -0.0035 * (D.r[i] / 0.008));
        continue;
      }
      if (w !== i) { D.p.copyWithin(w * 3, o, o + 3); D.v.copyWithin(w * 3, o, o + 3); D.r[w] = D.r[i]; }
      w++;
    }
    D.n = w;
    for (let i = 0; i < D.n; i++) {
      const o = i * 3; const sp = Math.hypot(D.v[o], D.v[o + 1], D.v[o + 2]);
      _p.set(D.p[o], D.p[o + 1], D.p[o + 2]);
      _q.setFromUnitVectors(_v.set(0, 1, 0), _s.set(D.v[o], D.v[o + 1], D.v[o + 2]).normalize());
      const r = D.r[i]; _s.set(r, r * (1 + Math.min(sp * 0.35, 1.8)), r); // stretch along velocity
      dMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    dMesh.count = D.n; dMesh.instanceMatrix.needsUpdate = true;
  }

  const api = {
    name, group, mesh, surfaceY, outline, floorY: floorFn,
    _ctx: ctx, _volume: volume, _under: false, _fogColor: fogColor,
    _visible(cam) { MOD.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); MOD.frustum.setFromProjectionMatrix(MOD.m4); return MOD.frustum.intersectsBox(worldBox); },
    _step(dt, sun) {
      uSun.value = MOD.sunDir; sunLum.value = sun.lum;
      // in-scattered light grows with sun + sky
      const illum = (0.06 + 0.07 * sun.I * Math.max(MOD.sunDir.y, 0)) * 1.6;
      scatter.value.set(color.r * illum * 0.25, color.g * illum * 0.8, color.b * illum * 1.35);
      // sim
      let steps = 0;
      if (MOD.shot) { steps = 2; if (!warmed) { steps += PREWARM; warmed = true; } }
      else { acc += dt; while (acc >= SDT && steps < 4) { steps++; acc -= SDT; } if (acc > SDT) acc = 0; }
      for (let i = 0; i < steps; i++) simStep();
      if (MOD.shot && steps > 2) stepDroplets(0.2); // shot: droplets frozen mid-flight
      else if (!MOD.shot) stepDroplets(dt); else stepDroplets(1 / 60);
      surfMat.uniforms.tSim.value = gpu.getCurrentRenderTarget(hVar).texture;
      gpu.doRenderTarget(surfMat, surfRT);
      // caustics
      const prevT = renderer.getRenderTarget(), prevCol = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevSh = renderer.shadowMap.autoUpdate, prevAuto = renderer.autoClear;
      renderer.shadowMap.autoUpdate = false; renderer.autoClear = true;
      renderer.setRenderTarget(causticRT); renderer.setClearColor(0x000000, 0);
      renderer.render(cScene, cCam);
      renderer.setRenderTarget(prevT); renderer.setClearColor(prevCol, prevA); renderer.shadowMap.autoUpdate = prevSh; renderer.autoClear = prevAuto;
      // underwater?
      const cp = ctx.camera.position;
      api._under = inside(cp.x, cp.z) && cp.y < api.heightAt(cp.x, cp.z) && cp.y > minFloor - 0.5;
      uUnder.value = api._under ? 1 : 0;
      // async readback for heightAt (never in shot mode: no stalls)
      if (!MOD.shot && !reading && MOD.frame % readEvery === 0 && renderer.readRenderTargetPixelsAsync) {
        reading = true;
        try {
          renderer.readRenderTargetPixelsAsync(gpu.getCurrentRenderTarget(hVar), 0, 0, nx, nz, readBuf)
            .then(() => { cpuH = readBuf.slice(); reading = false; }).catch(() => { readEvery = 1e9; reading = false; });
        } catch (e) { readEvery = 1e9; reading = false; }
      }
    },
    disturb(x, z, radius = 0.25, strength = 0.3) { if (!inside(x, z)) return; pushDrop(x, z, radius, -0.012 * strength); },
    splash(x, y, z, strength = 0.5) {
      const s = Math.max(0, strength);
      api.disturb(x, z, 0.16 + 0.22 * Math.min(s, 2), 1.1 * s);
      const n = Math.min(DMAX - D.n, Math.round(14 + 70 * Math.min(s, 2.5)));
      for (let i = 0; i < n; i++) {
        const k = D.n++; const a = drng() * Math.PI * 2, rad = drng() * (0.1 + 0.12 * s);
        const hs = (0.25 + drng() * 1.1) * (0.6 + 0.5 * s), vs = (1.2 + drng() * 2.6) * Math.sqrt(0.4 + s);
        D.p.set([x + Math.cos(a) * rad, Math.max(y, surfaceY) + 0.02, z + Math.sin(a) * rad], k * 3);
        D.v.set([Math.cos(a) * hs, vs, Math.sin(a) * hs], k * 3);
        D.r[k] = 0.003 + drng() * drng() * 0.012;
      }
    },
    heightAt(x, z) { if (!inside(x, z)) return surfaceY; return surfaceY + ambientCPU(x, z, MOD.time) + simAt(x, z); },
    isInside: inside,
    addFloater(rec, o = {}) {
      if (!rec || !rec.body) return;
      const col = rec.collider; const sh = col?.shape;
      let kind = 'box', r = 0.1, he = { x: 0.1, y: 0.1, z: 0.1 };
      if (sh && sh.radius !== undefined && sh.halfExtents === undefined) { kind = 'ball'; r = sh.radius; }
      else if (sh && sh.halfExtents) he = { x: sh.halfExtents.x, y: sh.halfExtents.y, z: sh.halfExtents.z };
      else if (rec.obj) { const b3 = new THREE.Box3().setFromObject(rec.obj); const s3 = b3.getSize(new THREE.Vector3()); he = { x: s3.x / 2, y: s3.y / 2, z: s3.z / 2 }; }
      const vol = o.volume ?? (kind === 'ball' ? 4 / 3 * Math.PI * r ** 3 : 8 * he.x * he.y * he.z * (sh?.halfExtents ? 1 : 0.6));
      if (o.density && col?.setMass) { col.setMass(o.density * vol); }
      rec.obj?.traverse?.(c => { c.userData.waterCapture = true; c.layers.enable(LAYER); });
      floaters.push({ rec, kind, r, he, vol, area: kind === 'ball' ? Math.PI * r * r : 4 * he.x * he.z, prev: 0, acc: 0 });
      if (!physHooked && ctx.phys) { physHooked = true; ctx.phys.onStep(floatStep); }
    },
  };

  // ---- buoyancy (runs before each 60 Hz physics step)
  const floaters = []; let physHooked = false;
  function floatStep(dt) {
    for (const f of floaters) {
      const b = f.rec.body; const p = b.translation();
      if (!inside(p.x, p.z)) { f.prev = 0; continue; }
      const wl = api.heightAt(p.x, p.z);
      let hy = f.r;
      if (f.kind !== 'ball') { const q = b.rotation(); const m10 = 2 * (q.x * q.y + q.w * q.z), m11 = 1 - 2 * (q.x * q.x + q.z * q.z), m12 = 2 * (q.y * q.z - q.w * q.x); hy = Math.abs(m10) * f.he.x + Math.abs(m11) * f.he.y + Math.abs(m12) * f.he.z; }
      const frac = Math.min(1, Math.max(0, (wl - (p.y - hy)) / (2 * hy)));
      if (frac <= 0) { f.prev = 0; continue; }
      const m = b.mass(); if (!(m > 0)) continue;
      const v = b.linvel(); const Bmax = RHO * GRAV * f.vol;
      let F, k;
      if (Bmax <= m * GRAV * 1.001) { F = Bmax * frac; k = Bmax / (2 * hy); }
      else {
        const fe = m / (RHO * f.vol); const yEq = wl + hy - 2 * hy * fe;
        k = Math.min(Bmax / (2 * hy), 0.25 * m / (dt * dt));
        F = Math.min(Bmax, Math.max(0, m * GRAV + k * (yEq - p.y)));
      }
      const cV = 2 * Math.sqrt(k * m) * 0.4 * Math.max(frac, 0.25);
      const dvy = -v.y * (1 - 1 / (1 + cV * dt / m));
      const hsp = Math.hypot(v.x, v.z);
      const cH = (1.2 * m + 0.5 * RHO * 0.6 * f.area * hsp) * frac;
      const kH = 1 - 1 / (1 + cH * dt / m);
      b.applyImpulse({ x: -v.x * kH * m, y: F * dt + dvy * m, z: -v.z * kH * m }, true);
      const w = b.angvel(); const ka = 1 / (1 + 2.5 * frac * dt); b.setAngvel({ x: w.x * ka, y: w.y * ka, z: w.z * ka }, true);
      // couple back into the water: wakes / bobbing rings / entry splash
      if (f.prev === 0 && v.y < -1.2) api.splash(p.x, wl, p.z, Math.min(1.5, -v.y * 0.12 * Math.cbrt(f.vol / 0.004)));
      f.acc += dt;
      if (frac < 0.999 && f.acc > 0.05) {
        f.acc = 0; const s = Math.min(0.35, Math.abs(v.y) * 0.3 + hsp * 0.12) * Math.min(1, Math.sqrt(f.area / 0.05));
        if (s > 0.008) api.disturb(p.x, p.z, Math.max(hy, Math.sqrt(f.area / Math.PI)) * 1.2, s);
      }
      f.prev = frac;
    }
  }

  ctx.onUpdate?.((dt, t) => frameAll(ctx, dt, t));
  waterBodies.push(api);
  return api;
}
