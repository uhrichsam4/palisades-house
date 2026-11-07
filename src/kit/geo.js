// Geometry + placement helpers for room pieces. Everything in metres, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(); const remove = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.keep || o.userData.dynamic || Array.isArray(o.material) || o.material.transparent || o.morphTargetInfluences) return;
    let p = o.parent; while (p && p !== root) { if (p.userData.keep || p.userData.dynamic) return; p = p.parent; }
    const key = o.material.uuid + '|' + o.castShadow + '|' + Object.keys(o.geometry.attributes).sort().join(',') + '|' + (o.geometry.index ? 'i' : 'n');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'uv1', 'color'].includes(k)) g.deleteAttribute(k);
    if (g.groups.length) g.clearGroups();
    buckets.get(key).geos.push(g); remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { mat, cast, geos } of buckets.values()) {
    let merged; try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    if (!merged) { continue; }
    const m = new THREE.Mesh(merged, mat); m.castShadow = cast; m.receiveShadow = true; m.name = 'merged'; root.add(m);
  }
}
