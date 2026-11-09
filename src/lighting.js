// Room light probes: real-time approximation of global illumination for interiors.
// Each room (long rooms get 2–3) renders a cube map of what is actually around it — its windows with
// the sky and canyon behind them, sun patches on the floor, the walls, the furniture — and every surface
// in that room uses its probe for image-based lighting + reflections. A second pass re-captures with the
// first-pass probes applied, so light bounces once more (sun patch -> floor -> ceiling -> walls).
// Exterior materials (kit.outdoor) keep the real sky; everything else that can't be placed keeps the
// neutral room environment as a fallback.
import * as THREE from 'three';
import * as P from './plan.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SKIP = (o) => o.userData.noProbe || o.userData.dynamic || o.isSprite || o.isPoints || o.isLine;
const standard = (m) => m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && !m.transparent;

function probePoints() {
  const pts = [];
  for (const [id, r] of Object.entries(P.ROOMS)) {
    if (r.outdoor) continue;
    const [x0, z0, x1, z1] = r.rect; const y = P.LEVELS[r.level].floor + 1.45;
    const w = x1 - x0, d = z1 - z0; const n = Math.max(1, Math.min(3, Math.round(Math.max(w, d) / 5.5)));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = w >= d ? x0 + w * f : (x0 + x1) / 2, z = w >= d ? (z0 + z1) / 2 : z0 + d * f;
      pts.push({ id: id + (n > 1 ? '#' + i : ''), room: id, level: r.level, rect: r.rect, pos: new THREE.Vector3(x, y, z) });
    }
  }
  return pts;
}

function roomAt(probes, x, y, z) {
  const tryLevel = (lv) => {
    let best = null, bestArea = Infinity;
    for (const [id, r] of Object.entries(P.ROOMS)) {
      if (r.outdoor || r.level !== lv) continue; const [x0, z0, x1, z1] = r.rect; const m = 0.12;
      if (x >= x0 - m && x <= x1 + m && z >= z0 - m && z <= z1 + m) { const a = (x1 - x0) * (z1 - z0); if (a < bestArea) { bestArea = a; best = id; } }
    }
    return best;
  };
  const lv = y < 3.2 ? 0 : 1; const room = tryLevel(lv) ?? tryLevel(1 - lv); if (!room) return null;
  let best = null, bd = Infinity;
  for (const p of probes) if (p.room === room) { const d = (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

// centroid + mean normal of a geometry (or one of its groups), in world space
const _a = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
function anchor(mesh, group) {
  const g = mesh.geometry; const pos = g.attributes.position, nor = g.attributes.normal; if (!pos) return null;
  const idx = g.index; let start = 0, count = idx ? idx.count : pos.count;
  if (group) { start = group.start; count = Math.min(group.count, (idx ? idx.count : pos.count) - start); }
  const c = new THREE.Vector3(), nn = new THREE.Vector3(); let k = 0;
  const step = Math.max(1, Math.floor(count / 600));
  for (let i = start; i < start + count; i += step) { const vi = idx ? idx.getX(i) : i; c.add(_a.fromBufferAttribute(pos, vi)); if (nor) nn.add(_n.fromBufferAttribute(nor, vi)); k++; }
  if (!k) return null; c.divideScalar(k).applyMatrix4(mesh.matrixWorld);
  _m3.getNormalMatrix(mesh.matrixWorld); nn.applyMatrix3(_m3); if (nn.lengthSq() > 1e-6) nn.normalize();
  return c.addScaledVector(nn, 0.25);
}

// Box-projected (parallax-corrected) reflections: a probe's cube map is treated as the inside of the
// room's box, so reflections on floors, stone, glass and metal line up with the real walls instead of
// looking infinitely far away. Diffuse lighting is unchanged.
const BP_FUNC = `
uniform vec3 bpMin; uniform vec3 bpMax; uniform vec3 bpPos; varying vec3 vBPWorld;
vec3 bpParallax( vec3 v ) {
  vec3 p = clamp( vBPWorld, bpMin + 0.01, bpMax - 0.01 );
  vec3 tMax = ( bpMax - p ) / v, tMin = ( bpMin - p ) / v;
  vec3 t = max( tMax, tMin );
  float d = min( min( t.x, t.y ), t.z );
  return d > 0.0 ? normalize( p + v * d - bpPos ) : v;
}
`;
// dual (src/sky): every probe material also gets a second probe set baked at night with the lights on; the
// IBL fetch becomes day * envDayK + night * envNightK (two shared uniforms the sky module drives).
// envFlash (sky lightning) x envExpo (per room: how much sky its glass sees, roomExposure below) brightens the day
// probe during a flash, so a windowless closet stays dark and a glass-walled room gets a soft cold flash.
const DUAL_FUNC = `
uniform samplerCube envNight; uniform float envDayK; uniform float envNightK; uniform float envFlash; uniform float envExpo;
vec4 envDual( vec3 d, float lod ) { return textureLod( envMap, d, lod ) * ( envDayK + envFlash * envExpo ) + textureLod( envNight, d, lod ) * envNightK; }
`;
const ZERO = { value: 0 };
// Sky exposure per indoor room (contain pass): exterior glass area (windows, sliders, glass doors) whose `at` sits on
// that room's wall and whose far side is not another indoor room, relative to the floor area. 0 = no window.
export const exposureK = (glass, floor) => Math.min(1, 1.2 * Math.sqrt(Math.max(0, glass) / Math.max(1, floor)));
export function roomExposure() {
  const out = new Map(); const GLASS = new Set(['window', 'slider', 'french']);
  const inside = (x, z, lv, skip) => Object.entries(P.ROOMS).some(([id, r]) => id !== skip && !r.outdoor && r.level === lv && x > r.rect[0] && x < r.rect[2] && z > r.rect[1] && z < r.rect[3]);
  for (const [id, r] of Object.entries(P.ROOMS)) {
    if (r.outdoor) continue; const [x0, z0, x1, z1] = r.rect; let glass = 0;
    for (const o of P.OPENINGS) {
      if (o.level !== r.level || !GLASS.has(o.type)) continue; const [x, z] = o.at; const m = 0.45;
      if (x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) continue;
      // nearest wall of this room -> outward probe point
      const d = [[x - x0, -1, 0], [x1 - x, 1, 0], [z - z0, 0, -1], [z1 - z, 0, 1]].sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]))[0];
      if (inside(x + d[1] * 0.6, z + d[2] * 0.6, r.level, id)) continue; // interior glass door: no sky behind it
      glass += o.w * (o.head - o.sill);
    }
    const floor = (x1 - x0) * (z1 - z0);
    out.set(id, { value: exposureK(glass, floor), glass, floor });
  }
  return out;
}
function boxProject(THREEmod, mat, box, probePos, dual) {
  const chunk = THREEmod.ShaderChunk.envmap_physical_pars_fragment;
  const key = 'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );';
  if (!chunk.includes(key)) return; // three changed its chunk: keep plain probes
  let patched = chunk.replace(key, key + '\n\t\t\treflectVec = bpParallax( reflectVec );');
  const canDual = dual && patched.includes('textureLod( envMap, ');
  if (canDual) patched = patched.split('textureLod( envMap, ').join('envDual( ').replace('#ifdef USE_ENVMAP', '#ifdef USE_ENVMAP\n' + DUAL_FUNC);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bpMin = { value: box.min }; sh.uniforms.bpMax = { value: box.max }; sh.uniforms.bpPos = { value: probePos };
    if (canDual) { sh.uniforms.envNight = mat.userData.envNight; sh.uniforms.envDayK = dual.envDayK; sh.uniforms.envNightK = dual.envNightK; sh.uniforms.envFlash = dual.envFlash || ZERO; sh.uniforms.envExpo = mat.userData.envExpo || ZERO; }
    sh.vertexShader = 'varying vec3 vBPWorld;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tvBPWorld = worldPosition.xyz;');
    sh.fragmentShader = BP_FUNC + sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', patched);
  };
  mat.customProgramCacheKey = () => (canDual ? 'bp2' : 'bp1');
  if (canDual) mat.userData.dualEnv = true;
}
// day/night mix without box projection (note: three's default onBeforeCompile source is longer than 30 chars, so
// the boxProject branch above never runs for plain materials; this keeps that look and only adds the mix)
function dualOnly(THREEmod, mat, dual) {
  const chunk = THREEmod.ShaderChunk.envmap_physical_pars_fragment;
  if (!chunk.includes('textureLod( envMap, ')) return;
  const patched = chunk.split('textureLod( envMap, ').join('envDual( ').replace('#ifdef USE_ENVMAP', '#ifdef USE_ENVMAP\n' + DUAL_FUNC);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.envNight = mat.userData.envNight; sh.uniforms.envDayK = dual.envDayK; sh.uniforms.envNightK = dual.envNightK; sh.uniforms.envFlash = dual.envFlash || ZERO; sh.uniforms.envExpo = mat.userData.envExpo || ZERO;
    sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', patched);
  };
  mat.customProgramCacheKey = () => 'dn1'; mat.userData.dualEnv = true;
}
function roomBox(probe) {
  const r = P.ROOMS[probe.room]; const [x0, z0, x1, z1] = r.rect; const y0 = P.LEVELS[r.level].floor;
  const y1 = r.level === 0 ? P.LEVELS[0].ceil : P.LEVELS[1].plate + 1.2; // vaulted upper rooms rise above the plate
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
}

// Phase 1 (sync, at load): bind every interior mesh (or face group) to its room probe, cloning materials per
// probe, with a same-size placeholder environment so the final shader programs exist from the start and can be
// precompiled behind the loading screen. Phase 2 (bake): capture + swap textures only (no recompiles).
export function bindRoomProbes(ctx, { size = 128, dual = null } = {}) {
  const { renderer, scene } = ctx;
  const probes = probePoints();
  scene.updateMatrixWorld(true);
  const clones = new Map(); const bound = new Set(); const expo = dual ? roomExposure() : new Map();
  const pm = new THREE.PMREMGenerator(renderer);
  const placeholder = pm.fromScene(new RoomEnvironment(), 0.03, 0.1, 100, { size }).texture; pm.dispose();
  const cloneFor = (mat, probe) => { const key = mat.uuid + '|' + probe.id; let c = clones.get(key); if (!c) { c = mat.clone(); c.userData.probe = probe.id; c.envMap = placeholder; c.userData.baseEnvI = c.envMapIntensity ?? 1; if (dual) { c.userData.envNight = { value: placeholder }; c.userData.envExpo = expo.get(probe.room) || ZERO; } if (!mat.onBeforeCompile || mat.onBeforeCompile.toString().length < 30) boxProject(THREE, c, roomBox(probe), probe.pos, dual);
      else if (dual && c.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) dualOnly(THREE, c, dual); clones.set(key, c); } return c; };
  scene.traverse(o => {
    if (!o.isMesh || SKIP(o)) return;
    let p = o; while (p) { if (SKIP(p) || p.name === 'water' || p.name === 'avatar') return; p = p.parent; }
    if (Array.isArray(o.material)) {
      const mats = o.material.slice(); let changed = false;
      for (const grp of o.geometry.groups) {
        const m = mats[grp.materialIndex]; if (!standard(m) || m.envMap) continue;
        const a = anchor(o, grp); if (!a) continue; const probe = roomAt(probes, a.x, a.y, a.z); if (!probe) continue;
        mats[grp.materialIndex] = cloneFor(m, probe); changed = true; bound.add(probe);
      }
      if (changed) o.material = mats;
    } else {
      const m = o.material; if (!standard(m) || m.envMap) return;
      const a = anchor(o); if (!a) return; const probe = roomAt(probes, a.x, a.y, a.z); if (!probe) return;
      o.material = cloneFor(m, probe); bound.add(probe);
    }
  });
  const used = probes.filter(p => bound.has(p));
  const byProbe = new Map(); for (const c of clones.values()) { const k = c.userData.probe; if (!byProbe.has(k)) byProbe.set(k, []); byProbe.get(k).push(c); }
  return { probes: used, materials: clones.size, list: [...clones.values()], expo, bake: (opts) => bakeProbes(ctx, used, byProbe, clones, { size, ...opts }) };
}

// Phase 2. background=true renders one cube face per frame so walking stays smooth while rooms light up.
// beforeCapture(pos, fn) lets the caller set up probe-local state (e.g. the light pool) around each face.
// target 'night' (src/sky): bake into the materials' envNight uniform instead of envMap; beforePass(pass) lets the
// caller change the scene state between the two bounce passes.
async function bakeProbes(ctx, used, byProbe, clones, { size = 128, passes = 2, intensity = 1.0, onStatus, background = false, beforeCapture, target = 'day', beforePass } = {}) {
  const { renderer, scene } = ctx; const t0 = performance.now();
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.05, 400, rt);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let textures = new Map();
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  for (let pass = 0; pass < passes; pass++) {
    onStatus?.(`Lighting rooms… ${pass + 1}/${passes}`); beforePass?.(pass);
    renderer.shadowMap.needsUpdate = true;
    const next = new Map();
    for (const p of used) {
      cam.position.copy(p.pos); cam.updateMatrixWorld(true);
      if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
      for (let f = 0; f < 6; f++) {
        const draw = () => {
          const prevT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel(), prevXr = renderer.xr.enabled;
          renderer.xr.enabled = false; renderer.setRenderTarget(rt, f, 0); renderer.render(scene, cam.children[f]);
          renderer.setRenderTarget(prevT, prevFace, prevMip); renderer.xr.enabled = prevXr;
        };
        if (beforeCapture) beforeCapture(p.pos, draw); else draw();
        if (background) { await frame(); while (window.__probesPaused) await frame(); } // Ultra 120 Hz lever 4 (perf.js)
      }
      rt.texture.needsPMREMUpdate = true;
      next.set(p.id, pmrem.fromCubemap(rt.texture).texture);
      if (!background && performance.now() - t0 > 200) await new Promise(r => setTimeout(r, 0));
    }
    if (target === 'night') { for (const [id, tex] of next) for (const m of byProbe.get(id) || []) if (m.userData.envNight) m.userData.envNight.value = tex; }
    else for (const [id, tex] of next) for (const m of byProbe.get(id) || []) { m.envMap = tex; m.envMapIntensity = m.userData.baseEnvI * intensity; }
    for (const t of textures.values()) t.dispose(); textures = next;
  }
  rt.dispose(); pmrem.dispose();
  const info = { probes: used.length, materials: clones.size, ms: Math.round(performance.now() - t0) };
  if (target === 'night') window.__probesNight = info; else window.__probes = info; return info;
}

// shot mode (photo renders): bind + bake synchronously
export async function buildRoomProbes(ctx, { size = 128, passes = 2, intensity = 1.0, onStatus, background = false } = {}) {
  return bindRoomProbes(ctx, { size }).bake({ passes, intensity, onStatus, background });
}
