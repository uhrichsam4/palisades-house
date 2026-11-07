// Polygon helpers + geometry for water bodies (all in world XZ).
import * as THREE from 'three';

export function pointInPoly(outline, x, z) {
  let c = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i], [xj, zj] = outline[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function signedArea(outline) {
  let a = 0; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) a += outline[j][0] * outline[i][1] - outline[i][0] * outline[j][1];
  return a / 2;
}
export function bounds(outline) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of outline) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x0, z0, x1, z1 };
}

// Sutherland–Hodgman: clip polygon against axis-aligned rect
function clipRect(poly, x0, z0, x1, z1) {
  const edges = [[0, x0, 1], [0, x1, -1], [1, z0, 1], [1, z1, -1]];
  let out = poly;
  for (const [ax, v, s] of edges) {
    const inp = out; out = []; if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ia = (a[ax] - v) * s >= 0, ib = (b[ax] - v) * s >= 0;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}

// Triangulated grid exactly covering the outline (cells clipped at the edges). Returns flat [x,z, x,z, x,z ...] triangles.
export function clippedGrid(outline, cell) {
  const b = bounds(outline); const tris = [];
  const nx = Math.ceil((b.x1 - b.x0) / cell), nz = Math.ceil((b.z1 - b.z0) / cell);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x0 = b.x0 + i * cell, z0 = b.z0 + j * cell, x1 = Math.min(b.x1, x0 + cell), z1 = Math.min(b.z1, z0 + cell);
    const p = clipRect(outline, x0, z0, x1, z1);
    if (p.length < 3) continue;
    const area = Math.abs(signedArea(p)); if (area < 1e-7) continue;
    if (p.length === 4 && Math.abs(area - (x1 - x0) * (z1 - z0)) < 1e-6) {
      tris.push(x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0);
      continue;
    }
    const contour = p.map(([x, z]) => new THREE.Vector2(x, z));
    const idx = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const t of idx) for (const k of t) tris.push(p[k][0], p[k][1]);
  }
  // wind every triangle so its normal faces +y once mapped to (x, y, z)
  for (let i = 0; i < tris.length; i += 6) {
    const ax = tris[i], az = tris[i + 1], bx = tris[i + 2], bz = tris[i + 3], cx = tris[i + 4], cz = tris[i + 5];
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az); // y of (b-a)x(c-a)
    if (ny < 0) { tris[i + 2] = cx; tris[i + 3] = cz; tris[i + 4] = bx; tris[i + 5] = bz; }
  }
  return tris;
}

// grid tris -> BufferGeometry at height fn(x,z)
export function gridGeometry(tris, yFn) {
  const n = tris.length / 2; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const x = tris[2 * i], z = tris[2 * i + 1]; pos[3 * i] = x; pos[3 * i + 1] = yFn(x, z); pos[3 * i + 2] = z; nor[3 * i + 1] = 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

// Vertical strips just inside each outline edge, from floor to just under the surface (caustics/fog on the pool walls).
export function wallGeometry(outline, surfaceY, floorFn, inset = 0.012, step = 0.25) {
  const ccw = signedArea(outline) > 0; // in (x,z) math orientation
  const pos = [], nor = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 1e-4) continue;
    // inward normal: left of the edge for a CCW polygon in (x,z)
    let nx = -dz / L, nz = dx / L; if (!ccw) { nx = -nx; nz = -nz; }
    const segs = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const p0 = [a[0] + dx * t0 + nx * inset, a[1] + dz * t0 + nz * inset], p1 = [a[0] + dx * t1 + nx * inset, a[1] + dz * t1 + nz * inset];
      const f0 = floorFn(p0[0] + nx * 0.06, p0[1] + nz * 0.06), f1 = floorFn(p1[0] + nx * 0.06, p1[1] + nz * 0.06);
      const top = surfaceY - 0.004;
      const q = [[p0[0], f0, p0[1]], [p1[0], f1, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]]];
      // quad facing inward
      const order = [0, 1, 2, 0, 2, 3];
      const tri = order.map(k => q[k]);
      // make sure the winding faces the inward normal
      const e1 = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]], e2 = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
      const flip = cx * nx + cz * nz < 0;
      const ord = flip ? [0, 2, 1, 0, 3, 2] : order;
      for (const k of ord) { pos.push(...q[k]); nor.push(nx, 0, nz); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
