// Broken wall panel geometry (src/building): the panel face with a jagged hole torn through it, the torn edges in the
// material's core colour (gypsum / insulation), and splintered stud stubs top and bottom. Deterministic per panel id
// (seeded), so every client shows the same hole. Built in the panel's local frame (u along the wall, y up, d into the
// wall from face A) and mapped to world space.
import * as THREE from 'three';

export function hashSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// panel frame matrix: x -> U, y -> up, z -> N (into the wall), origin p0 at y=0. det < 0 means mirrored.
export function panelMatrix(p) {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(p.U.x, 0, p.U.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.N.x, 0, p.N.y));
  m.setPosition(p.p0.x, 0, p.p0.y); return m;
}
function flipIfMirrored(geo, m) {
  if (m.determinant() >= 0) return;
  const pos = geo.attributes.position; const n = pos.count;
  for (const at of Object.values(geo.attributes)) { const a = at.array, s = at.itemSize; for (let t = 0; t < n; t += 3) for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const v = a[i1]; a[i1] = a[i2]; a[i2] = v; } at.needsUpdate = true; }
}

const CORE = {}; const coreMat = (kind) => CORE[kind] || (CORE[kind] = new THREE.MeshStandardMaterial({ color: kind === 'siding' ? 0xe2b79a : kind === 'concrete' ? 0x9c9a94 : kind === 'wood' ? 0xa07a50 : 0xe4e0d6, roughness: 1, name: 'building:core:' + kind }));
const STUD = new THREE.MeshStandardMaterial({ color: 0xc09a68, roughness: 0.9, name: 'building:stud' });

// returns a Group (or null if the panel is too small to keep a frame: then it simply disappears)
export function brokenPanel(p, kind, seed) {
  const L = p.p0.distanceTo(p.p1), y0 = p.y0, y1 = p.y1, H = y1 - y0;
  if (H < 1.2 || L < 0.5) return null;
  const R = rng(seed);
  const mx = Math.min(0.2, L * 0.16), hx0 = mx, hx1 = L - mx, hy0 = y0 + Math.min(0.3, H * 0.1) + (y0 < 0 ? 0.3 : 0), hy1 = y1 - Math.min(0.28, H * 0.09);
  // jagged hole outline: walk the inset rectangle, jitter every ~0.12 m
  const pts = []; const step = 0.12;
  const edge = (ax, ay, bx, by, nx, ny) => { const len = Math.hypot(bx - ax, by - ay); const k = Math.max(2, Math.round(len / step));
    for (let i = 0; i < k; i++) { const t = i / k; const j = (R() - 0.35) * 0.16; pts.push(new THREE.Vector2(ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j)); } };
  edge(hx0, hy0, hx1, hy0, 0, -1); edge(hx1, hy0, hx1, hy1, 1, 0); edge(hx1, hy1, hx0, hy1, 0, 1); edge(hx0, hy1, hx0, hy0, -1, 0);
  for (const q of pts) { q.x = THREE.MathUtils.clamp(q.x, 0.03, L - 0.03); q.y = THREE.MathUtils.clamp(q.y, y0 + 0.03, y1 - 0.03); }
  const shape = new THREE.Shape([new THREE.Vector2(0, y0), new THREE.Vector2(L, y0), new THREE.Vector2(L, y1), new THREE.Vector2(0, y1)]);
  shape.holes.push(new THREE.Path(pts));
  let geo = new THREE.ExtrudeGeometry(shape, { depth: p.depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  // regroup: 0 = face A (z=0), 1 = face B (z=depth), 2 = torn edges
  { const pos = geo.attributes.position, n = pos.count; const buckets = [[], [], []];
    for (let t = 0; t < n; t += 3) { const z0 = pos.getZ(t), z1 = pos.getZ(t + 1), z2 = pos.getZ(t + 2); const g = Math.abs(z0 - z1) < 1e-5 && Math.abs(z1 - z2) < 1e-5 ? (z0 < p.depth / 2 ? 0 : 1) : 2; buckets[g].push(t); }
    const out = new THREE.BufferGeometry(); const order = buckets.flat();
    for (const [name, at] of Object.entries(geo.attributes)) { const s = at.itemSize; const arr = new Float32Array(order.length * 3 * s); order.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let k = 0; k < s; k++) arr[(i * 3 + v) * s + k] = at.array[(t + v) * s + k]; }); out.setAttribute(name, new THREE.BufferAttribute(arr, s)); }
    let st = 0; buckets.forEach((b, g) => { if (b.length) out.addGroup(st, b.length * 3, g); st += b.length * 3; });
    geo.dispose(); geo = out; }
  const m = panelMatrix(p); geo.applyMatrix4(m); flipIfMirrored(geo, m);
  const g = new THREE.Group(); g.name = 'building:hole:' + p.id; g.userData.keep = true;
  const face = new THREE.Mesh(geo, [p.mats[0], p.mats[1], coreMat(kind)]); face.castShadow = true; face.receiveShadow = true; g.add(face);
  // splintered studs (every 0.41 m), insulation-coloured backing strips for exterior walls
  if (H > 1.5) {
    const boxes = [];
    for (let u = hx0 + 0.08 + R() * 0.1; u < hx1 - 0.05; u += 0.41) {
      if (R() < 0.25) continue; const d = p.depth / 2;
      const b1 = 0.15 + R() * 0.6, t1 = 0.1 + R() * 0.5;
      const bg = new THREE.BoxGeometry(0.045, b1, Math.min(0.09, p.depth * 0.6)); bg.translate(u, hy0 - 0.05 + b1 / 2, d); boxes.push(bg);
      const tg = new THREE.BoxGeometry(0.045, t1, Math.min(0.09, p.depth * 0.6)); tg.translate(u, hy1 + 0.05 - t1 / 2, d); boxes.push(tg);
    }
    if (boxes.length) {
      const sg = mergeNonIndexed(boxes); sg.applyMatrix4(m); flipIfMirrored(sg, m);
      const studs = new THREE.Mesh(sg, STUD); studs.castShadow = true; studs.receiveShadow = true; g.add(studs);
    }
  }
  g.traverse(o => { o.userData.noCull = true; });
  return g;
}
function mergeNonIndexed(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g); const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) { const s = parts[0].attributes[name].itemSize; const arr = new Float32Array(parts.reduce((a, g) => a + g.attributes[name].array.length, 0)); let o = 0; for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, s)); }
  return out;
}
// a solid box mesh for a falling wall chunk, centred at the origin, faces in the wall's materials (local x = U, z = N)
export function chunkMesh(p) {
  const L = p.p0.distanceTo(p.p1), H = p.y1 - p.y0;
  const geo = new THREE.BoxGeometry(L, H, p.depth); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * H);
  // BoxGeometry groups: +x, -x, +y, -y, +z (face B side), -z (face A side)
  geo.clearGroups(); for (let f = 0; f < 6; f++) geo.addGroup(f * 6, 6, f === 4 ? 1 : f === 5 ? 0 : 2);
  const mesh = new THREE.Mesh(geo, [p.mats[0], p.mats[1], p.mats[2]]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.keep = true; mesh.userData.noCull = true;
  return mesh;
}
