// Site terrain: analytic height field (flat house pad, canyon dropping away to +z, the ridge rising
// behind the street to -z, far canyon hills) sampled on a non-uniform grid (1.5 m near the house,
// growing geometrically out to ~3 km). Pure functions + mesh builder; no Esri imagery.
import * as THREE from 'three';

export const G = -0.31;                      // finished grade around the house (walls start at -0.30)
export const CENTER = [18, 12];              // middle of the developed lot (house + court)
// Flat pad = union of rects [x0, z0, x1, z1]: house + yards + pool, tennis court + NE lawn, turf strip.
export const PADS = [
  [-11, -34, 23.6, 31.4],
  [23.6, -34, 47.0, 40.8],
  [19.8, 31.0, 24.0, 50.9],
];
// Terrain hole: the pool deck (pool.js) covers this whole rect; its hole over the pool + spa
// (x 3.3..16.3, z 22.7..27.9) lies inside it, so swimmers fall into the basin, not onto grass.
export const CUT = [-3.4, 21.65, 23.1, 28.6];

// ---------------------------------------------------------------- noise
const hash = (i, j, s) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
};
export function vnoise(x, z, s = 1) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}
export function fbm(x, z, oct = 5, s = 1) {
  let v = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, z * f, s + o); a *= 0.5; f *= 2.03; } return v;
}
export function ridged(x, z, oct = 5, s = 9) {
  let v = 0, a = 0.5, f = 1, w = 1;
  for (let o = 0; o < oct; o++) { let n = 1 - Math.abs(vnoise(x * f, z * f, s + o)); n *= n * w; w = Math.min(1, n * 1.6); v += a * n; a *= 0.5; f *= 2.1; }
  return v;
}
export const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function gully(x, z) { const v = Math.abs(Math.sin(x / 42 + 0.8 * Math.sin(z / 70) + 0.4 * vnoise(x / 90, z / 90, 71))); return Math.pow(1 - v, 3); }
// distance (m) from (x,z) to the flat pad; 0 inside
export function padDist(x, z) {
  let d = Infinity;
  for (const [x0, z0, x1, z1] of PADS) {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    d = Math.min(d, Math.hypot(dx, dz));
  }
  return d;
}

// Landscape without the pad.
export function macro(x, z) {
  const r = Math.hypot(x - CENTER[0], z - CENTER[1]);
  let h = G;
  // canyon side (+z): steep chaparral bank, then the canyon floor ~130 m below the pad
  const zc = z - 31.5 - 30 * Math.sin((x - 18) / 210);
  if (zc > 0) h -= 0.55 * Math.min(zc, 45) + 120 * ss(25, 560, zc);
  // far side of the canyon rises again (the Palisades Highlands ridge with its houses)
  // (low, rolling: its crest sits only a couple of degrees above the pad's horizon in p41-p43)
  h += 215 * ss(700, 2300, z + 220 * Math.sin(x / 650 + 1.2)) + 30 * ss(1200, 2600, z) * fbm(x / 700, z / 500, 3, 91);
  // Santa Monica Mountains spur behind the street (-z): the big ridge in the aerial (p45)
  const zb = -z - 48 - 25 * Math.sin((x - 18) / 160);
  if (zb > 0) h += (600 * Math.pow(ss(0, 750, zb), 0.65) + 300 * ss(0, 350, zb) * (ridged(x / 110, z / 150, 5, 23) - 0.3)) * (0.85 + 0.15 * Math.sin(x / 400));
  // drainage gullies running down the mountain face (p45: spurs + deep ravines)
  if (zb > 0) h -= 85 * ss(20, 260, zb) * gully(x, z) + 22 * ss(10, 120, zb) * Math.pow(1 - Math.abs(Math.sin(x / 17 + 0.6 * vnoise(x / 40, z / 40, 77))), 4);
  // lots fall away to the south-west
  const xs = -x - 16; if (xs > 0) h -= 14 * ss(0, 170, xs) * ss(-40, 60, z);
  const amp = Math.min(45, 0.8 + 0.05 * r) * (z > 300 ? 1 - 0.55 * ss(300, 1500, z) : 1);
  h += amp * (0.8 * fbm(x / 150, z / 150, 5, 3) + 0.9 * (ridged(x / 460, z / 460, 5, 11) - 0.35));
  return h;
}
export function height(x, z) {
  const d = padDist(x, z); if (d <= 0) return G;
  const m = macro(x, z);
  // where the land falls away, the pad ends in a real bank (not a slow smoothstep)
  return G + (m - G) * (m < G ? Math.max(ss(0, 30, d), Math.min(1, d / 10)) : ss(0, 30, d));
}

// ---------------------------------------------------------------- grid
function axis(c, keys) {
  const pts = []; for (let s = -84; s <= 84 + 1e-6; s += 1.5) pts.push(c + s);
  let step = 1.5, s = 84; while (s < 3200) { step *= 1.065; s += step; pts.push(c + s); pts.push(c - s); }
  const out = pts.filter(p => keys.every(k => Math.abs(p - k) > 0.45)).concat(keys);
  return out.sort((a, b) => a - b);
}

export function buildTerrain(kit, colorAt) {
  const xs = axis(CENTER[0], [CUT[0], CUT[2]]), zs = axis(CENTER[1], [CUT[1], CUT[3]]);
  const nx = xs.length, nz = zs.length, N = nx * nz;
  const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), hgt = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], y = height(x, z);
    hgt[k] = y; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
  }
  const idx = [], colIdx = []; const NEAR = 170;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const xm = (xs[i] + xs[i + 1]) / 2, zm = (zs[j] + zs[j + 1]) / 2;
    if (xm > CUT[0] && xm < CUT[2] && zm > CUT[1] && zm < CUT[3]) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
    if (Math.abs(xm - CENTER[0]) < NEAR && Math.abs(zm - CENTER[1]) < NEAR) colIdx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, col = new Float32Array(N * 3), c = new THREE.Color();
  for (let k = 0; k < N; k++) { colorAt(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], nrm.getY(k), c, nrm.getX(k), nrm.getZ(k)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
  { // far hills: bend normals towards up so slopes facing away from our (morning) sun don't go flat
    // blue-grey; the listing photos have the canyon walls evenly lit.
    const n = geo.attributes.normal;
    for (let k = 0; k < N; k++) { const r = Math.hypot(pos[k * 3] - CENTER[0], pos[k * 3 + 2] - CENTER[1]); const t = 0.5 * ss(400, 1500, r); if (t <= 0) continue;
      const x = n.getX(k) * (1 - t), y = n.getY(k) * (1 - t) + t, z = n.getZ(k) * (1 - t), l = Math.hypot(x, y, z); n.setXYZ(k, x / l, y / l, z / l); }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  { const wild = new Float32Array(N); for (let k = 0; k < N; k++) wild[k] = ss(1, 6, padDist(pos[k * 3], pos[k * 3 + 2])); geo.setAttribute('wild', new THREE.BufferAttribute(wild, 1)); }
  geo.computeBoundingSphere();
  // collider: the near part only (same vertices)
  const cgeo = new THREE.BufferGeometry();
  cgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cgeo.setIndex(new THREE.BufferAttribute(new Uint32Array(colIdx), 1));
  // mesh height lookup (matches the rendered triangles, so far houses/trees sit on the surface)
  const find = (arr, v) => { let lo = 0, hi = arr.length - 2; if (v <= arr[0]) return 0; if (v >= arr[hi + 1]) return hi; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
  const heightAt = (x, z) => {
    const i = find(xs, x), j = find(zs, z);
    const u = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))), v = Math.max(0, Math.min(1, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const A = hgt[j * nx + i], B = hgt[j * nx + i + 1], C = hgt[(j + 1) * nx + i], D = hgt[(j + 1) * nx + i + 1];
    // triangles (a,c,b) and (b,c,d): split along the b-c diagonal (u + v = 1)
    return u + v <= 1 ? A + (B - A) * u + (C - A) * v : D + (C - D) * (1 - u) + (B - D) * (1 - v);
  };
  return { geo, cgeo, heightAt };
}
