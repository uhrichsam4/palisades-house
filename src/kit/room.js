// Room-level helpers: floor finishes, ceilings (flat / vaulted), baseboards, recessed lights,
// wall finish panels (wallpaper, tile, slats) laid flat against a wall face.
import * as THREE from 'three';
import * as P from '../plan.js';
import { M } from './materials.js';

// roomInfo('kitchen') -> { id, rect:[x0,z0,x1,z1], level, y (finished floor), ceil (flat ceiling y), cx, cz, w, d }
export function roomInfo(id) {
  const r = P.ROOMS[id]; if (!r) throw new Error('no room ' + id);
  const [x0, z0, x1, z1] = r.rect; const y = P.LEVELS[r.level].floor;
  const ceil = r.level === 0 ? P.LEVELS[0].ceil : P.LEVELS[1].plate;
  return { id, ...r, x0, z0, x1, z1, y, ceil, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

// Floor finish over the slab (default slab is oak). rect may be a room id or [x0,z0,x1,z1].
// lift: small offset above the slab to avoid z-fighting. Material UVs are in metres (world x,z).
export function floorFinish(parent, rect, mat, y = null, lift = 0.004) {
  const R = typeof rect === 'string' ? roomInfo(rect) : null;
  const [x0, z0, x1, z1] = R ? R.rect : rect; const yy = (y ?? (R ? R.y : 0)) + lift;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + (x0 + x1) / 2, -(p.getZ(i) + (z0 + z1) / 2));
  const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, yy, (z0 + z1) / 2); m.receiveShadow = true; m.name = 'floor';
  parent.add(m); return m;
}

// Flat ceiling (use when the piece listed the room in `ownCeiling`).
export function ceilingFlat(parent, rect, y, mat = M.ceilingWhite) {
  const [x0, z0, x1, z1] = rect; const g = new THREE.PlaneGeometry(x1 - x0 + 0.16, z1 - z0 + 0.16); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; m.name = 'ceiling'; parent.add(m); return m;
}

// Cathedral (vaulted) ceiling over rect: ridge along `axis` ('x' or 'z'), sloping from wallY at the
// two long walls up to ridgeY (optionally a flat strip `flatTop` wide at the top). Closes both gable
// ends with wall triangles (wallMat). Returns the group; group.userData.heightAt(x, z) gives ceiling y.
export function vault(parent, rect, axis, wallY, ridgeY, mat = M.ceilingWhite, wallMat = M.paintWhite, flatTop = 0, ends = true) {
  const [x0, z0, x1, z1] = rect; const g = new THREE.Group(); g.name = 'vault'; parent.add(g); const e = 0.06;
  const quad = (A, B, C, D, m) => { // A,B,C,D CCW seen from below (inside the room)
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3));
    const L1 = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), L2 = Math.hypot(D[0] - A[0], D[1] - A[1], D[2] - A[2]);
    bg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L1, 0, L1, L2, 0, 0, L1, L2, 0, L2], 2));
    bg.computeVertexNormals(); const n = bg.attributes.normal.getY(0);
    if (n > 0) { const p = bg.attributes.position.array; for (let t = 0; t < 2; t++) for (let k = 0; k < 3; k++) { const i = t * 9 + 3 + k, j = t * 9 + 6 + k; const tmp = p[i]; p[i] = p[j]; p[j] = tmp; } bg.computeVertexNormals(); }
    const mesh = new THREE.Mesh(bg, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  if (axis === 'x') {
    const zc = (z0 + z1) / 2, f = flatTop / 2;
    quad([x0 - e, wallY, z0 - e], [x1 + e, wallY, z0 - e], [x1 + e, ridgeY, zc - f], [x0 - e, ridgeY, zc - f], mat);
    quad([x1 + e, wallY, z1 + e], [x0 - e, wallY, z1 + e], [x0 - e, ridgeY, zc + f], [x1 + e, ridgeY, zc + f], mat);
    if (f > 0) quad([x0 - e, ridgeY, zc - f], [x1 + e, ridgeY, zc - f], [x1 + e, ridgeY, zc + f], [x0 - e, ridgeY, zc + f], mat);
  } else {
    const xc = (x0 + x1) / 2, f = flatTop / 2;
    quad([x0 - e, wallY, z1 + e], [x0 - e, wallY, z0 - e], [xc - f, ridgeY, z0 - e], [xc - f, ridgeY, z1 + e], mat);
    quad([x1 + e, wallY, z0 - e], [x1 + e, wallY, z1 + e], [xc + f, ridgeY, z1 + e], [xc + f, ridgeY, z0 - e], mat);
    if (f > 0) quad([xc - f, ridgeY, z0 - e], [xc + f, ridgeY, z0 - e], [xc + f, ridgeY, z1 + e], [xc - f, ridgeY, z1 + e], mat);
  }
  if (ends) {
    const wm = wallMat.clone(); wm.side = THREE.DoubleSide;
    const tri = (pts) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); bg.computeVertexNormals(); const m = new THREE.Mesh(bg, wm); m.receiveShadow = true; m.castShadow = true; g.add(m); };
    const f = flatTop / 2;
    if (axis === 'x') for (const x of [x0, x1]) { const zc = (z0 + z1) / 2; tri([[x, wallY, z0], [x, wallY, z1], [x, ridgeY, zc + f]]); if (f) tri([[x, wallY, z0], [x, ridgeY, zc + f], [x, ridgeY, zc - f]]); }
    else for (const z of [z0, z1]) { const xc = (x0 + x1) / 2; tri([[x0, wallY, z], [x1, wallY, z], [xc + f, ridgeY, z]]); if (f) tri([[x0, wallY, z], [xc + f, ridgeY, z], [xc - f, ridgeY, z]]); }
  }
  const half = axis === 'x' ? (z1 - z0) / 2 : (x1 - x0) / 2; const run = half - flatTop / 2;
  g.userData.heightAt = (x, z) => { const u = axis === 'x' ? Math.abs(z - (z0 + z1) / 2) : Math.abs(x - (x0 + x1) / 2); return ridgeY - (ridgeY - wallY) * Math.max(0, Math.min(1, (u - flatTop / 2) / run)); };
  return g;
}

// Baseboards around a rect (skip spans: [{side:'x0'|'x1'|'z0'|'z1', from, to}] e.g. door gaps).
export function baseboards(parent, rect, y, h = 0.09, t = 0.012, mat = M.paintWhite, skips = []) {
  const [x0, z0, x1, z1] = rect; const g = new THREE.Group(); g.name = 'baseboards'; parent.add(g);
  const run = (side, a, b) => {
    const cuts = skips.filter(s => s.side === side).sort((p, q) => p.from - q.from); let cur = a; const spans = [];
    for (const c of cuts) { if (c.from > cur) spans.push([cur, Math.min(c.from, b)]); cur = Math.max(cur, c.to); } if (cur < b) spans.push([cur, b]);
    for (const [s0, s1] of spans) {
      const len = s1 - s0; if (len < 0.02) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(side[0] === 'z' ? len : t, h, side[0] === 'z' ? t : len), mat);
      if (side === 'z0') m.position.set((s0 + s1) / 2, y + h / 2, z0 + t / 2); if (side === 'z1') m.position.set((s0 + s1) / 2, y + h / 2, z1 - t / 2);
      if (side === 'x0') m.position.set(x0 + t / 2, y + h / 2, (s0 + s1) / 2); if (side === 'x1') m.position.set(x1 - t / 2, y + h / 2, (s0 + s1) / 2);
      m.receiveShadow = true; g.add(m);
    }
  };
  run('z0', x0, x1); run('z1', x0, x1); run('x0', z0, z1); run('x1', z0, z1); return g;
}

// Recessed can lights: small dark rings + glowing discs on a ceiling at height y (no real light cost).
export function canLights(parent, pts, y, r = 0.05) {
  const g = new THREE.Group(); g.name = 'cans'; parent.add(g);
  const disc = new THREE.CircleGeometry(r, 24); disc.rotateX(Math.PI / 2);
  const ring = new THREE.RingGeometry(r, r * 1.35, 24); ring.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.6 });
  const lit = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.2 });
  for (const [x, z] of pts) { const a = new THREE.Mesh(disc, lit); a.position.set(x, y - 0.002, z); g.add(a); const b = new THREE.Mesh(ring, ringMat); b.position.set(x, y - 0.003, z); g.add(b); }
  return g;
}
export function grid(rect, nx, nz, inset = 0.9) {
  const [x0, z0, x1, z1] = rect; const pts = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pts.push([x0 + inset + ((x1 - x0 - 2 * inset) * (nx === 1 ? 0.5 : i / (nx - 1))), z0 + inset + ((z1 - z0 - 2 * inset) * (nz === 1 ? 0.5 : j / (nz - 1)))]);
  return pts;
}

// Finish panel on a wall face: from point a=[x,z] to b=[x,z] along the face, y0..y1, pushed `off`
// metres off the wall toward the room along normal n=[nx,nz]. UVs in metres (u along wall, v up).
export function wallPanel(parent, a, b, y0, y1, n, mat, off = 0.004) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const g = new THREE.PlaneGeometry(L, y1 - y0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, y0 + uv.getY(i) * (y1 - y0));
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.name = 'wallPanel';
  m.position.set((a[0] + b[0]) / 2 + n[0] * off, (y0 + y1) / 2, (a[1] + b[1]) / 2 + n[1] * off);
  m.lookAt(m.position.x + n[0], m.position.y, m.position.z + n[1]);
  parent.add(m); return m;
}
