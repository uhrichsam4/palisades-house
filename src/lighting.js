// Room light probes: real-time approximation of global illumination for interiors.
// Each room (long rooms get 2–3) renders a cube map of what is actually around it — its windows with
// the sky and canyon behind them, sun patches on the floor, the walls, the furniture — and every surface
// in that room uses its probe for image-based lighting + reflections. A second pass re-captures with the
// first-pass probes applied, so light bounces once more (sun patch -> floor -> ceiling -> walls).
// Exterior materials (kit.outdoor) keep the real sky; everything else that can't be placed keeps the
// neutral room environment as a fallback.
import * as THREE from 'three';
import * as P from './plan.js';

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
function boxProject(THREEmod, mat, box, probePos) {
  const chunk = THREEmod.ShaderChunk.envmap_physical_pars_fragment;
  const key = 'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );';
  if (!chunk.includes(key)) return; // three changed its chunk: keep plain probes
  const patched = chunk.replace(key, key + '\n\t\t\treflectVec = bpParallax( reflectVec );');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bpMin = { value: box.min }; sh.uniforms.bpMax = { value: box.max }; sh.uniforms.bpPos = { value: probePos };
    sh.vertexShader = 'varying vec3 vBPWorld;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tvBPWorld = worldPosition.xyz;');
    sh.fragmentShader = BP_FUNC + sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', patched);
  };
  mat.customProgramCacheKey = () => 'bp1';
}
function roomBox(probe) {
  const r = P.ROOMS[probe.room]; const [x0, z0, x1, z1] = r.rect; const y0 = P.LEVELS[r.level].floor;
  const y1 = r.level === 0 ? P.LEVELS[0].ceil : P.LEVELS[1].plate + 1.2; // vaulted upper rooms rise above the plate
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
}

export async function buildRoomProbes(ctx, { size = 128, passes = 2, intensity = 1.0, onStatus } = {}) {
  const { renderer, scene } = ctx; const t0 = performance.now();
  const probes = probePoints();
  scene.updateMatrixWorld(true);
  // 1. bind every interior mesh (or mesh face group) to its probe, cloning materials per probe
  const clones = new Map(); const bound = []; // {mesh, slot, probe}
  const cloneFor = (mat, probe) => { const key = mat.uuid + '|' + probe.id; let c = clones.get(key); if (!c) { c = mat.clone(); c.userData.probe = probe.id; if (!mat.onBeforeCompile || mat.onBeforeCompile.toString().length < 30) boxProject(THREE, c, roomBox(probe), probe.pos); clones.set(key, c); } return c; };
  scene.traverse(o => {
    if (!o.isMesh || SKIP(o)) return;
    let p = o; while (p) { if (SKIP(p) || p.name === 'water' || p.name === 'avatar') return; p = p.parent; }
    if (Array.isArray(o.material)) {
      const mats = o.material.slice(); let changed = false;
      for (const grp of o.geometry.groups) {
        const m = mats[grp.materialIndex]; if (!standard(m) || m.envMap) continue;
        const a = anchor(o, grp); if (!a) continue; const probe = roomAt(probes, a.x, a.y, a.z); if (!probe) continue;
        mats[grp.materialIndex] = cloneFor(m, probe); changed = true; bound.push(probe);
      }
      if (changed) o.material = mats;
    } else {
      const m = o.material; if (!standard(m) || m.envMap) return;
      const a = anchor(o); if (!a) return; const probe = roomAt(probes, a.x, a.y, a.z); if (!probe) return;
      o.material = cloneFor(m, probe); bound.push(probe);
    }
  });
  const used = probes.filter(p => bound.includes(p));
  // 2. capture: cube camera at each probe, PMREM-filtered, assigned to that probe's material clones
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.05, 400, rt);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const byProbe = new Map(); for (const c of clones.values()) { const k = c.userData.probe; if (!byProbe.has(k)) byProbe.set(k, []); byProbe.get(k).push(c); }
  const prevAuto = renderer.shadowMap.autoUpdate;
  let textures = new Map();
  for (let pass = 0; pass < passes; pass++) {
    onStatus?.(`Lighting rooms… ${pass + 1}/${passes}`);
    renderer.shadowMap.autoUpdate = true; renderer.render(scene, ctx.camera); renderer.shadowMap.autoUpdate = false; // shadows once per pass
    const next = new Map();
    for (const p of used) {
      cam.position.copy(p.pos); cam.update(renderer, scene);
      next.set(p.id, pmrem.fromCubemap(rt.texture).texture);
      if (performance.now() - t0 > 200) await new Promise(r => setTimeout(r, 0)); // keep the page responsive
    }
    for (const [id, tex] of next) for (const m of byProbe.get(id) || []) { m.envMap = tex; m.envMapIntensity = (m.envMapIntensity ?? 1) * (pass === 0 ? intensity : 1); m.needsUpdate = true; }
    for (const t of textures.values()) t.dispose(); textures = next;
  }
  renderer.shadowMap.autoUpdate = prevAuto; rt.dispose(); pmrem.dispose();
  const info = { probes: used.length, materials: clones.size, ms: Math.round(performance.now() - t0) };
  window.__probes = info; return info;
}
