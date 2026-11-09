// Geometry + placement helpers for room pieces. Everything in metres, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOMS, LEVELS } from '../plan.js';

export { RoundedBoxGeometry, mergeGeometries, mergeVertices };

// add(parent, geometry, material, [x,y,z], [rx,ry,rz]?, {shadow=true, name}) -> Mesh
export function add(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], opt = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = opt.shadow !== false; m.receiveShadow = true; if (opt.name) m.name = opt.name;
  parent.add(m); return m;
}
// group(parent, [x,y,z], ry) -> Group (handy for building furniture in local coordinates)
export function group(parent, pos = [0, 0, 0], ry = 0, name) {
  const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); g.rotation.y = ry; if (name) g.name = name; parent.add(g); return g;
}
// Axis-aligned box whose MIN corner is at [x0,y0,z0] (easy for cabinets laid out from a plan).
export function boxAt(parent, mat, x0, y0, z0, w, h, d, opt) {
  return add(parent, new THREE.BoxGeometry(w, h, d), mat, [x0 + w / 2, y0 + h / 2, z0 + d / 2], [0, 0, 0], opt);
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sphere = (r, ws = 32, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
export const torus = (r, tube, rs = 16, ts = 48, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, rs, ts, arc);
// lathe([[r,y],...], segments)
export const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// tube along points [[x,y,z],...]
export const tube = (pts, radius = 0.01, seg = 64, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed), seg, radius, 8, closed);
// extrude a 2D outline [[x,y],...] by depth (along +z), optional bevel
export function extrude(outline, depth, bevel = 0, holes = []) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
}

// Upholstery cushion: a rounded box whose top bulges (puff) — sofas, ottomans, headboards, beds.
export function cushion(w, h, d, r = 0.05, puff = 0.02, seg = 5) {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const fx = 1 - Math.pow(Math.abs(v.x) / (w / 2), 2), fz = 1 - Math.pow(Math.abs(v.z) / (d / 2), 2);
    const f = Math.max(0, fx) * Math.max(0, fz);
    if (v.y > 0) v.y += puff * f; else v.y -= puff * 0.3 * f;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

// Shaker / slab cabinet front with a recessed centre panel, facing +z, origin at bottom-left-back.
export function shakerFront(w, h, frame = 0.06, depth = 0.02, inset = 0.006) {
  const geos = [];
  const b = (bw, bh, bd, x, y, z) => { const g = new THREE.BoxGeometry(bw, bh, bd); g.translate(x, y, z); geos.push(g); };
  b(w, frame, depth, w / 2, frame / 2, depth / 2); b(w, frame, depth, w / 2, h - frame / 2, depth / 2);
  b(frame, h - 2 * frame, depth, frame / 2, h / 2, depth / 2); b(frame, h - 2 * frame, depth, w - frame / 2, h / 2, depth / 2);
  b(w - 2 * frame, h - 2 * frame, depth - inset, w / 2, h / 2, (depth - inset) / 2);
  return mergeGeometries(geos);
}

// Merge every static mesh under `root` that shares a material into one mesh per material.
// Call at the END of a piece's build for big draw-call savings. Keeps meshes with userData.keep.
// Merge static meshes that share a material into one draw — per room (or per 12 m cell outside), so merged
// meshes stay small enough for frustum culling and each lands in the right room's light probe.
const _bb = new THREE.Box3(), _bc = new THREE.Vector3();
function cellOf(o) {
  _bb.setFromObject(o); if (_bb.isEmpty()) return 'x'; _bb.getCenter(_bc);
  const lv = _bc.y < LEVELS[1].floor - 0.2 ? 0 : 1; let best = null, ba = Infinity;
  for (const [id, r] of Object.entries(ROOMS)) { if (r.level !== lv) continue; const [x0, z0, x1, z1] = r.rect, m = 0.2;
    if (_bc.x > x0 - m && _bc.x < x1 + m && _bc.z > z0 - m && _bc.z < z1 + m) { const a = (x1 - x0) * (z1 - z0); if (a < ba) { ba = a; best = id; } } }
  return best || ('c' + Math.floor(_bc.x / 12) + ',' + Math.floor(_bc.z / 12) + ',' + lv);
}
// Identical-looking materials made separately (std({...}) inline per object) can share one instance so their
// meshes merge. Conservative: no emissive (often animated), no custom shaders, no per-object textures differ.
const DEFAULT_OBC = THREE.Material.prototype.onBeforeCompile.toString();
const hasCustomShader = (m) => (m.onBeforeCompile && m.onBeforeCompile.toString() !== DEFAULT_OBC) || m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey;
const SIG_SKIP = new Set(['uuid', 'name', 'id', 'version', 'userData', '_listeners', 'needsUpdate', '_cacheKey']);
function matSig(m) {
  const parts = [m.type];
  for (const k of Object.keys(m).sort()) {
    if (SIG_SKIP.has(k) || k.startsWith('_') && k !== '_sheen' && k !== '_clearcoat' && k !== '_transmission' && k !== '_iridescence' && k !== '_anisotropy' && k !== '_dispersion') continue;
    const v = m[k];
    if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') parts.push(k + '=' + v);
    else if (v.isColor) parts.push(k + '=' + v.getHexString());
    else if (v.isVector2 || v.isVector3 || v.isEuler) parts.push(k + '=' + v.toArray().join(','));
    else if (v.isTexture) parts.push(k + '=' + v.uuid);
    else if (typeof v === 'function') continue;
    else if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) parts.push(k + '=[' + v.join(',') + ']');
    else if (v.constructor === Object) { try { parts.push(k + '=' + JSON.stringify(v)); } catch { return null; } }
    else return null; // something we can't compare safely
  }
  return parts.join('|');
}
export function canonicalMaterials() {
  const bySig = new Map();
  return (m) => {
    if (!m || hasCustomShader(m) || (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) || m.userData.noDedupe) return m;
    const sig = matSig(m); if (!sig) return m;
    const c = bySig.get(sig); if (c) return c; bySig.set(sig, m); return m;
  };
}
// split a multi-material mesh's geometry into one compact geometry per group
function splitGroups(geo) {
  const out = []; const idx = geo.index; const total = idx ? idx.count : geo.attributes.position.count;
  for (const grp of geo.groups) {
    const start = grp.start, count = Math.min(grp.count, total - start); if (count <= 0) continue;
    const sub = new THREE.BufferGeometry();
    if (idx) {
      const map = new Map(); const ni = new Array(count);
      for (let i = 0; i < count; i++) { const v = idx.getX(start + i); let n = map.get(v); if (n === undefined) { n = map.size; map.set(v, n); } ni[i] = n; }
      for (const [name, at] of Object.entries(geo.attributes)) { const arr = new at.array.constructor(map.size * at.itemSize); for (const [v, n] of map) for (let k = 0; k < at.itemSize; k++) arr[n * at.itemSize + k] = at.array[v * at.itemSize + k]; sub.setAttribute(name, new THREE.BufferAttribute(arr, at.itemSize, at.normalized)); }
      sub.setIndex(ni);
    } else for (const [name, at] of Object.entries(geo.attributes)) sub.setAttribute(name, new THREE.BufferAttribute(at.array.slice(start * at.itemSize, (start + count) * at.itemSize), at.itemSize, at.normalized));
    out.push({ mi: grp.materialIndex, geo: sub });
  }
  return out;
}
const KEEP_ATTRS = ['position', 'normal', 'uv', 'uv1', 'color'];
// thin, faint glass merges fine without per-object sorting; anything heavier stays separate
const mergeableTransparent = (m) => m.transparent && (m.depthWrite === false || m.opacity <= 0.35) && !m.transmission;
export function mergeStatic(root, { dedupe = null, skip = null } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(); const _m = new THREE.Matrix4();
  const put = (o, mat, geo, cell) => {
    if (dedupe) mat = dedupe(mat);
    const key = mat.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + Object.keys(geo.attributes).sort().join(',') + '|' + (geo.index ? 'i' : 'n') + '|' + cell + '|' + (mat.transparent ? o.renderOrder : 0);
    if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, ro: mat.transparent ? o.renderOrder : 0, entries: [] });
    buckets.get(key).entries.push({ o, geo });
  };
  const candidates = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.userData.keep || o.userData.dynamic || o.morphTargetInfluences || o.isReflector || !o.visible) return;
    if (skip && skip(o)) return;
    let p = o.parent; while (p && p !== root) { if (p.userData.keep || p.userData.dynamic || !p.visible) return; p = p.parent; }
    const g = o.geometry; if (!g?.attributes?.position || Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute)) return;
    const mats = [].concat(o.material);
    if (mats.some(m => !m || (m.transparent && !mergeableTransparent(m)) || (hasCustomShader(m) && !m.userData.probe && !m.userData.mergeSafe))) return; /* mergeSafe: the material's own shader hook only reads view-space / lighting terms (no per-object data), so baking transforms into one mesh draws the same */
    if (o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || o.onAfterRender !== THREE.Object3D.prototype.onAfterRender) return;
    candidates.push(o);
  });
  for (const o of candidates) {
    const cell = cellOf(o);
    _m.multiplyMatrices(inv, o.matrixWorld);
    if (Array.isArray(o.material)) {
      if (!o.geometry.groups.length) continue;
      for (const { mi, geo } of splitGroups(o.geometry)) { const mat = o.material[mi]; if (!mat) continue; geo.applyMatrix4(_m); for (const k of Object.keys(geo.attributes)) if (!KEEP_ATTRS.includes(k)) geo.deleteAttribute(k); put(o, mat, geo, cell); }
    } else {
      const g = o.geometry.clone(); g.applyMatrix4(_m);
      for (const k of Object.keys(g.attributes)) if (!KEEP_ATTRS.includes(k)) g.deleteAttribute(k);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      if (g.groups.length) g.clearGroups();
      put(o, o.material, g, cell);
    }
  }
  // an object leaves (replaced by merged meshes) if it is multi-material or shares a bucket with another part
  const stay = new Set();
  for (const b of buckets.values()) if (b.entries.length < 2) for (const { o } of b.entries) if (!Array.isArray(o.material)) stay.add(o);
  const multiBucket = new Set(); for (const b of buckets.values()) if (b.entries.length >= 2) for (const { o } of b.entries) multiBucket.add(o);
  for (const o of stay) if (multiBucket.has(o)) stay.delete(o);
  let made = [];
  for (let iter = 0; iter < 4; iter++) {
    made.forEach(m => m.geometry.dispose()); made = []; let failed = false;
    for (const b of buckets.values()) {
      const geos = b.entries.filter(e => !stay.has(e.o)).map(e => e.geo); if (!geos.length) continue;
      let merged = null; try { merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false); } catch (e) { merged = null; }
      if (!merged) { for (const e of b.entries) stay.add(e.o); failed = true; break; }
      const m = new THREE.Mesh(merged, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.ro; m.name = 'merged'; made.push(m);
    }
    if (!failed) break;
  }
  for (const m of made) root.add(m);
  for (const o of candidates) if (!stay.has(o) && o.parent) o.parent.remove(o);
  return { merged: made.length, removed: candidates.filter(o => !stay.has(o)).length };
}
