// Piece: bedC — Bedroom C (SW front) + bath C
// Owned rooms: bedC, bathC | Reference photos: p30, p31
//
// Bedroom C (p30): single-pitch vault rising from the wallpapered bed wall (x = 0.65, plate 2.75 m) up
// towards the TV wall (x = 5.16), white 3-blade fan + cans on the slope. Blush paisley wallpaper on the
// bed wall only. Grey tufted wingback king bed, white duvet + pink pintuck comforter, pink / white / faux-fur
// pillows, mirrored black-edged nightstands with white ceramic lamps, pink alarm clock. Mirrored glass-top
// desk on the TV wall under an oak-framed wall TV; small framed shell prints either side of the window,
// light grey flat roman shade. Grey/ivory ornamental rug.
// Bath C (p31): white zellige (vertical stack) on the vanity + tub walls, oak furniture vanity with white
// quartz top, round brass mirror, brass sconces + fixtures, alcove tub with frameless glass (hinged door on
// the tub, fixed panel on a tiled knee wall), skylight shaft above the tub, light grey porcelain floor.
import * as THREE from 'three';

export const piece = { rooms: ["bedC", "bathC"], photos: ["p30", "p31"] };
export const ownCeiling = ['bedC', 'bathC'];
export const views = {
  p30: { pos: [4.25, 4.80, 12.60], look: [2.75, 4.76, 10.00], fov: 79 },
  p31: { pos: [8.06, 4.35, 13.20], look: [5.49, 4.35, 11.655], fov: 60 },
};

const std = (o) => new THREE.MeshStandardMaterial(o);
const physMat = (o) => new THREE.MeshPhysicalMaterial(o);

// ------------------------------------------------------------------ geometry helpers
// planar quad / tri facing nHint, UVs in metres in the plane
function polyGeo(pts, nHint) {
  const v = pts.map(p => new THREE.Vector3(...p));
  let n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
  if (n.dot(new THREE.Vector3(...nHint)) < 0) { v.reverse(); n.negate(); }
  n.normalize(); const U = new THREE.Vector3().subVectors(v[1], v[0]).normalize(); const W = new THREE.Vector3().crossVectors(n, U);
  const pos = [], uv = [];
  const tri = (a, b, c) => { for (const p of [a, b, c]) { pos.push(p.x, p.y, p.z); const d = p.clone().sub(v[0]); uv.push(d.dot(U), d.dot(W)); } };
  for (let i = 1; i < v.length - 1; i++) tri(v[0], v[i], v[i + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
// wall-face panel with world-metre UVs. axis 'x': plane x=c, u along z. axis 'z': plane z=c, u along x.
function facePanel(parent, axis, c, u0, u1, y0, y1, nSign, mat, off = 0.004) {
  const L = u1 - u0, H = y1 - y0; const g = new THREE.PlaneGeometry(L, H);
  if (axis === 'x') { g.rotateY(nSign > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(c + nSign * off, (y0 + y1) / 2, (u0 + u1) / 2); }
  else { if (nSign < 0) g.rotateY(Math.PI); g.translate((u0 + u1) / 2, (y0 + y1) / 2, c + nSign * off); }
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, axis === 'x' ? -nSign * p.getZ(i) : nSign * p.getX(i), p.getY(i));
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; parent.add(m); return m;
}
// wavy hem: push vertices below yCut outward in x/z with a sine ripple (draped bedding)
function drape(g, yCut, amp, freq = 9, seed = 1) {
  const p = g.attributes.position; const v = new THREE.Vector3();
  g.computeBoundingBox(); const bb = g.boundingBox;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); if (v.y > yCut) continue;
    const t = Math.min(1, (yCut - v.y) / Math.max(0.01, yCut - bb.min.y));
    const w = Math.sin((v.x + v.z) * freq + seed) * 0.6 + Math.sin((v.x - v.z) * freq * 1.7 + seed * 2) * 0.4;
    const ox = Math.abs(v.x) > (bb.max.x - 0.08) ? Math.sign(v.x) : 0, oz = v.z > bb.max.z - 0.08 ? 1 : 0;
    v.x += ox * amp * t * (0.6 + 0.4 * w) + (oz ? amp * 0.5 * w * t : 0); v.z += oz * amp * t * (0.6 + 0.4 * w) + (ox ? amp * 0.5 * w * t : 0);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// draped comforter sheet over a bed (local x across, z from head to foot, y=0 at the top surface).
// hw: half top width, z0..z1: top extent, r: edge radius, drop: overhang below the edge. UVs in metres.
function comforter(hw, z0, z1, r, drop, pitch = 0.11) {
  const arc = Math.PI * r / 2, U = hw + arc + drop, Vf = z1 + arc + drop;
  const nu = 240, nv = 170; const g = new THREE.PlaneGeometry(2 * U, Vf - z0, nu, nv); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  const fold = (s) => { if (s <= 0) return [s, 0]; if (s < arc) { const a = s / r; return [r * Math.sin(a), r * (1 - Math.cos(a))]; } return [r + (s - arc) * 0.10, r + (s - arc)]; };
  const puff = (a, b) => { let m = 9; const j0 = Math.round(b / pitch); // distance to nearest pinch of the staggered lattice
    for (let j = j0 - 1; j <= j0 + 1; j++) { const sh = (((j % 2) + 2) % 2) * pitch / 2, k0 = Math.round((a - sh) / pitch); for (let k = k0 - 1; k <= k0 + 1; k++) m = Math.min(m, Math.hypot(a - (k * pitch + sh), b - j * pitch)); }
    /* pintuck, not bubbles: small sharp pinches + raised tuck ridges running diagonally between neighbouring pinches */
    const f1 = (a - b / 2) / pitch, f2 = (a + b / 2) / pitch; const d1 = Math.abs(f1 - Math.round(f1)) * pitch * 0.894, d2 = Math.abs(f2 - Math.round(f2)) * pitch * 0.894;
    const w = 0.14 * pitch, ridge = Math.max(Math.exp(-((d1 / w) ** 2)), Math.exp(-((d2 / w) ** 2)));
    return 0.45 * (1 - Math.exp(-((m / (0.18 * pitch)) ** 2))) + 0.55 * ridge * (1 - Math.exp(-((m / (0.3 * pitch)) ** 2))); };
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = z0 + (p.getZ(i) + (Vf - z0) / 2);
    const sx = Math.abs(u) - hw, sz = v - z1;
    const [ox, dx] = fold(sx), [oz, dz] = fold(sz);
    let x = sx > 0 ? Math.sign(u) * (hw + ox) : u, z = sz > 0 ? z1 + oz : v, y = -Math.max(dx, dz);
    const hang = Math.max(0, -y - r) / drop; // 0 at the edge .. 1 at the hem
    const rip = Math.sin(u * 13 + v * 3) * 0.6 + Math.sin(v * 17 - u * 5) * 0.4;
    if (sx > 0) x += Math.sign(u) * hang * 0.05 * rip; if (sz > 0) z += hang * 0.05 * rip;
    const pf = puff(u, v) * 0.022; // pintuck puffs, pushed out along the local surface normal
    if (sx <= 0 && sz <= 0) y += pf; else if (dx >= dz) x += Math.sign(u) * pf * Math.min(1, dx / r); else z += pf * Math.min(1, dz / r);
    if (sx <= 0 && sz <= 0) y += 0.012 * Math.sin(u * 7 + 1) * Math.sin(v * 6) + 0.02 * Math.min(1, (v - z0) / 0.15); // soft lofted top
    p.setXYZ(i, x, y, z); uv.setXY(i, u, -v);
  }
  g.computeVertexNormals(); return g;
}
// throw pillow: full in the middle, tapering to thin seamed edges; x = width, y = height, z = thickness
function pillowGeo(w, h, th) {
  const g = new THREE.BoxGeometry(w, h, th, 18, 18, 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const u = 2 * x / w, v = 2 * y / h;
    const f = Math.sqrt(Math.max(0.03, (1 - u ** 4) * (1 - v ** 4)));
    z *= f; x *= 1 - 0.07 * v * v; y *= 1 - 0.07 * u * u; // pinched corners
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
// normal map canvas from a height function h(x,y) in [0,1] over size x size (tileable if h wraps)
function heightToNormal(kit, size, H, strength) {
  return kit.canvasTex(size, size, (g) => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H[y * size + (x + 1) % size] - H[y * size + (x - 1 + size) % size]) * strength;
      const dy = (H[((y + 1) % size) * size + x] - H[((y - 1 + size) % size) * size + x]) * strength;
      const nz = 1 / Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

// ------------------------------------------------------------------ procedural textures (unfiltered strokes)
function wallpaperTex(kit) { // dense, faint blush feather-paisley on a warm white ground, 0.50 m repeat
  const r = kit.rng(301);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f6f2ef'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = (r() - 0.5) * 8; g.fillStyle = `rgba(${238 + v},${230 + v},${226 + v},0.25)`; g.fillRect(r() * w, r() * h, 2, 1); }
    const wrap = (fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    const paisley = (x, y, a, s) => wrap(() => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); g.lineCap = 'round';
      g.strokeStyle = 'rgba(224,172,160,0.42)'; g.lineWidth = 1.3;
      const outline = () => { g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(30, -34, 34, 26, 2, 42); g.bezierCurveTo(-28, 40, -26, 2, 6, -8); g.stroke(); };
      outline(); g.save(); g.scale(0.62, 0.62); g.translate(2, 6); outline(); g.restore();
      // feathers all round the outside
      g.lineWidth = 1.0; g.strokeStyle = 'rgba(222,165,152,0.38)';
      for (let k = 0; k < 26; k++) { const t = k / 25, px = 26 * Math.sin(t * 3.0) + 3, py = -44 + t * 84, ang = -0.4 + t * 1.6;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * 11, py + Math.sin(ang) * 11); g.stroke(); }
      for (let k = 0; k < 14; k++) { const t = k / 13, px = -20 * Math.sin(t * 2.6) - 2, py = -2 + t * 42; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 9, py + 3); g.stroke(); }
      g.fillStyle = 'rgba(214,150,138,0.35)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(4, -4 + k * 7, 1.6, 0, 6.283); g.fill(); }
      g.restore();
    });
    // half-drop grid of large overlapping paisleys (≈9 cm) + filler sprigs
    const n = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + 0.5) * w / n + (r() - 0.5) * 18, y = (j + (i % 2) * 0.5) * h / n + (r() - 0.5) * 18;
      paisley(x, y, r() * 6.283, 0.85 + r() * 0.3);
    }
    for (let i = 0; i < 160; i++) { const x = r() * w, y = r() * h, a = r() * 6.283; wrap(() => { g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(222,170,158,0.32)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -6, 3, -14); g.stroke(); g.beginPath(); g.ellipse(4, -8, 3, 1.3, 0.7, 0, 6.283); g.stroke(); g.restore(); }); }
  }, { repeat: [1 / 0.5, 1 / 0.5] });
}
function tuftTex(kit, W, H) { // diamond button tufting on grey-taupe velvet (map + bump share it)
  const px = 200; const cw = Math.round(W * px), ch = Math.round(H * px);
  return kit.canvasTex(cw, ch, (g, w, h) => {
    g.fillStyle = '#7a756e'; g.fillRect(0, 0, w, h);
    const sx = 0.135 * px, sy = 0.11 * px; const pts = [];
    for (let j = 0; j * sy <= h + sy; j++) for (let i = 0; i * sx <= w + sx; i++) pts.push([i * sx + (j % 2) * sx / 2 + 6, j * sy + 10]);
    // puffs: radial light centres between buttons
    for (const [x, y] of pts) { const gr = g.createRadialGradient(x + sx / 2, y + sy / 2, 2, x + sx / 2, y + sy / 2, sx * 0.62); gr.addColorStop(0, 'rgba(170,165,156,0.55)'); gr.addColorStop(1, 'rgba(120,115,108,0)'); g.fillStyle = gr; g.fillRect(x - sx, y - sy, sx * 3, sy * 3); }
    // fold lines between buttons (diagonals)
    g.strokeStyle = 'rgba(40,37,34,0.55)'; g.lineWidth = 3;
    for (const [x, y] of pts) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx / 2, y + sy); g.moveTo(x, y); g.lineTo(x - sx / 2, y + sy); g.stroke(); }
    // buttons
    for (const [x, y] of pts) { const gr = g.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(20,18,16,0.95)'); gr.addColorStop(1, 'rgba(60,56,52,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 9, 0, 6.283); g.fill(); }
  });
}
function pintuckMaps(kit, tile = 0.24) { // blush pintuck: staggered pinch points with radiating folds -> map + normal
  const N = 256, sp = N / 2, H = new Float32Array(N * N);
  const pts = [[0, 0], [sp, 0], [sp / 2, sp], [3 * sp / 2, sp], [0, N], [N, 0], [N, N], [sp, N], [-sp / 2, sp], [N + sp / 2, sp]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d = 1e9, a = 0; for (const [px, py] of pts) { const dd = Math.hypot(x - px, y - py); if (dd < d) { d = dd; a = Math.atan2(y - py, x - px); } }
    const puff = 1 - Math.exp(-((d / (0.42 * sp)) ** 2));
    const folds = Math.exp(-d / (0.30 * sp)) * (0.5 + 0.5 * Math.cos(6 * a + 0.7)) * Math.min(1, d / 6);
    H[y * N + x] = puff - 0.35 * folds;
  }
  const normal = heightToNormal(kit, N, H, 9); normal.repeat.set(1 / tile, 1 / tile);
  const map = kit.canvasTex(N, N, (g) => {
    const img = g.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const k = 0.66 + 0.36 * Math.max(0, Math.min(1, H[i])); img.data[i * 4] = Math.min(255, 242 * k); img.data[i * 4 + 1] = 190 * k; img.data[i * 4 + 2] = 177 * k; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, { repeat: [1 / tile, 1 / tile] });
  return { map, normal };
}
function rugTex(kit) { // grey field, fine ivory scrollwork (4-way symmetric), central medallion, light border band
  const r = kit.rng(91);
  return kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#696b6e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50000; i++) { const v = 105 + r() * 40; g.fillStyle = `rgba(${v},${v},${v + 2},0.25)`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.lineCap = 'round';
    const scroll = (x, y, R, a, dir, col, lw) => { // small curling scroll (C/S curl)
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let t = 0; t <= 1; t += 0.06) { const ang = a + dir * t * 4.2, rr = R * (1 - 0.75 * t); const px = x + Math.cos(ang) * rr + Math.cos(a) * R * (1 - t) * 0.8, py = y + Math.sin(ang) * rr + Math.sin(a) * R * (1 - t) * 0.8; if (t === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    };
    const B = 96; // border band width
    const iv = 'rgba(214,211,203,0.85)';
    const seeds = []; for (let i = 0; i < 1500; i++) seeds.push([B + 14 + r() * (w / 2 - B - 14), B + 14 + r() * (h / 2 - B - 14), 5 + r() * 10, r() * 6.283, r() < 0.5 ? 1 : -1, 1.6 + r() * 1.2]);
    const leaves = []; for (let i = 0; i < 500; i++) leaves.push([B + 14 + r() * (w / 2 - B - 14), B + 14 + r() * (h / 2 - B - 14), r() * 6.283]);
    for (const [mx, my] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      g.save(); g.translate(w / 2, h / 2); g.scale(mx, my); g.translate(-w / 2, -h / 2);
      for (const [x, y, R, a, d, lw] of seeds) scroll(x, y, R, a, d, iv, lw);
      for (const [x, y, a] of leaves) { g.fillStyle = 'rgba(214,211,203,0.7)'; g.beginPath(); g.ellipse(x, y, 4, 1.6, a, 0, 6.283); g.fill(); }
      g.restore();
    }
    // central medallion: ring of scrolls
    for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; scroll(w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 95, 14, a, 1, 'rgba(226,223,215,0.9)', 2.4); }
    g.strokeStyle = 'rgba(222,219,211,0.8)'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, 110, 140, 0, 0, 6.283); g.stroke();
    // border: light grey band with darker scrolls, guard lines
    g.fillStyle = '#b9b9b6'; g.fillRect(20, 20, w - 40, B - 30); g.fillRect(20, h - B + 10, w - 40, B - 30); g.fillRect(20, 20, B - 30, h - 40); g.fillRect(w - B + 10, 20, B - 30, h - 40);
    for (let t = 30; t < w - 30; t += 22) for (const [x, y] of [[t, 20 + (B - 30) / 2], [t, h - B + 10 + (B - 30) / 2], [20 + (B - 30) / 2, t], [w - B + 10 + (B - 30) / 2, t]]) scroll(x, y, 8, r() * 6.283, 1, 'rgba(120,121,124,0.8)', 1.8);
    g.strokeStyle = 'rgba(214,211,203,0.9)'; g.lineWidth = 3; g.strokeRect(B, B, w - 2 * B, h - 2 * B);
    g.fillStyle = '#6b6d70'; g.fillRect(0, 0, w, 20); g.fillRect(0, h - 20, w, 20); g.fillRect(0, 0, 20, h); g.fillRect(w - 20, 0, 20, h);
  });
}
function shadeTex(kit) { // light grey slub linen, horizontal weave
  const r = kit.rng(12);
  return kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c6c0'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { const v = 180 + r() * 40; g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.5)`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 400; i++) { const v = 190 + r() * 50; g.fillStyle = `rgba(${v},${v - 2},${v - 5},0.5)`; g.fillRect(r() * w, r() * h, 6 + r() * 30, 1); }
  }, { repeat: [3, 3] });
}
function printTex(kit, seed) { // white mat + small grey shell / sea-urchin sketch
  const r = kit.rng(seed);
  return kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2f1ee'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,150,150,0.6)'; g.lineWidth = 1; g.strokeRect(46, 46, w - 92, h - 92);
    g.fillStyle = '#eceae6'; g.fillRect(50, 50, w - 100, h - 100);
    const cx = w / 2, cy = h / 2; g.strokeStyle = 'rgba(105,105,108,0.85)'; g.lineWidth = 1.4;
    if (seed % 2) { for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); g.stroke(); } g.beginPath(); g.arc(cx, cy, 42, 0, 6.283); g.stroke(); }
    else { g.beginPath(); for (let t = 0; t < 30; t += 0.2) { const rr = 3 + t * 1.4; g.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.8); } g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,120,120,0.3)'; g.fillRect(cx - 45 + r() * 90, cy - 45 + r() * 90, 1, 1); }
  });
}
function tvTex(kit) { // Frame-TV art mode: pale misty grey abstract
  return kit.canvasTex(512, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2e3031'); gr.addColorStop(0.55, '#4a4c4d'); gr.addColorStop(1, '#5d5f60'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = kit.rng(5); for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 120, 20 + r() * 50, r() * 3, 0, 6.283); g.fill(); }
  });
}
// zellige: glossy handmade cream tiles, vertical stack 0.065 x 0.20 (8 x 4 tiles = 0.52 x 0.80 m per texture)
function zellige(kit) {
  const S = 512, cols = 8, rows = 4, tw = S / cols, th = S / rows, RW = 0.52, RH = 0.80; const r = kit.rng(404);
  const shades = []; for (let i = 0; i < cols * rows; i++) shades.push([(r() - 0.5) * 12, r(), r()]);
  const map = kit.canvasTex(S, S, (g) => {
    g.fillStyle = '#e4ded5'; g.fillRect(0, 0, S, S); // thin light grout
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const [v, t] = shades[j * cols + i]; const base = t < 0.2 ? [224, 214, 200] : t < 0.75 ? [233, 225, 214] : [241, 235, 226];
      const x = i * tw + 1, y = j * th + 1, ww = tw - 2, hh = th - 2;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(x, y, ww, hh);
      for (let k = 0; k < 7; k++) { const cx = x + r() * ww, cy = y + r() * hh, rad = 8 + r() * 30; const gr = g.createRadialGradient(cx, cy, 1, cx, cy, rad); const lt = r() < 0.5;
        gr.addColorStop(0, lt ? `rgba(255,252,246,${0.25 * r()})` : `rgba(200,186,168,${0.18 * r()})`); gr.addColorStop(1, 'rgba(255,255,250,0)'); g.fillStyle = gr; g.fillRect(x, y, ww, hh); }
      g.fillStyle = 'rgba(196,182,164,0.25)'; g.fillRect(x, y, ww, 2); g.fillRect(x, y, 2, hh); g.fillRect(x + ww - 1, y, 1, hh); // glaze pooling
    }
  }, { repeat: [1 / RW, 1 / RH] });
  const rough = kit.canvasTex(S, S, (g) => {
    g.fillStyle = 'rgb(200,200,200)'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const q = Math.round(255 * (0.06 + 0.22 * shades[j * cols + i][2])); g.fillStyle = `rgb(${q},${q},${q})`; g.fillRect(i * tw + 1, j * th + 1, tw - 2, th - 2);
      for (let k = 0; k < 4; k++) { const qq = Math.min(255, q + 30 + r() * 40); g.fillStyle = `rgba(${qq},${qq},${qq},0.5)`; g.beginPath(); g.ellipse(i * tw + r() * tw, j * th + r() * th, 4 + r() * 12, 4 + r() * 20, 0, 0, 6.283); g.fill(); } }
  }, { srgb: false, repeat: [1 / RW, 1 / RH] });
  const N = 256, H = new Float32Array(N * N); const ph = shades.map(() => [r() * 6, r() * 6, 0.6 + r() * 1.4, r() * 6]);
  const ntw = N / cols, nth = N / rows;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / N * cols, fy = y / N * rows; const i = Math.floor(fx), j = Math.floor(fy); const u = fx - i, v = fy - j;
    const e = Math.min(u, 1 - u) * ntw, f = Math.min(v, 1 - v) * nth * (RH / rows) / (RW / cols) * (ntw / nth); // edge distance in tile-width pixels
    const edge = Math.min(1, Math.min(e, f) / 2.5);
    const [a, b, k, c] = ph[(j % rows) * cols + (i % cols)];
    const wav = Math.sin(u * 3.14 * k + a) * Math.sin(v * 6.3 * k + b) * 0.22 + Math.sin(u * 9 + v * 14 + c) * 0.08 + Math.sin(v * 25 + a) * 0.05;
    H[y * N + x] = edge < 0.15 ? 0 : Math.sqrt(edge) * 0.7 + wav * 0.4;
  }
  const normal = heightToNormal(kit, N, H, 2.6); normal.repeat.set(1 / RW, 1 / RH);
  return { map, normal, rough };
}
function porcelainTex(kit, tw, th, base, seed) { // large-format light grey porcelain, one tile per texture
  const r = kit.rng(seed);
  return kit.canvasTex(512, Math.round(512 * th / tw), (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = (r() - 0.5) * 14; g.fillStyle = `rgba(${200 + v},${196 + v},${190 + v},0.12)`; g.beginPath(); g.ellipse(r() * w, r() * h, 15 + r() * 60, 10 + r() * 40, r() * 3, 0, 6.283); g.fill(); }
    for (let i = 0; i < 6000; i++) { const v = 170 + r() * 50; g.fillStyle = `rgba(${v},${v},${v - 3},0.12)`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.fillStyle = 'rgba(160,156,150,0.8)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  }, { repeat: [1 / tw, 1 / th] });
}

// ------------------------------------------------------------------ build
export async function build(ctx) {
  const { kit, phys, root } = ctx; const M = kit.M; const add = kit.add;
  const BED = kit.roomInfo('bedC'), BATH = kit.roomInfo('bathC');
  const Y = BED.y; // 3.35
  const [X0, Z0, X1, Z1] = BED.rect;
  const WALLH = 2.75, K = 0.65; // vault springs from the bed wall at the plate and rises towards the TV wall
  const ceilY = (x) => Y + WALLH + K * (x - X0);
  const dyn = []; // [mesh, opts]

  // ---------------------------------------------------------------- materials
  const wallpaper = std({ map: wallpaperTex(kit), roughness: 0.9, color: 0xf0eae2, envMapIntensity: 0.8 });
  const paint = M.paintWhite;
  const ceilMat = M.ceilingWhite.clone(); ceilMat.side = THREE.FrontSide; ceilMat.color.set(0xf4f4f2).multiply(new THREE.Color(0.92, 0.99, 0.98)); ceilMat.emissive.set(0xffffff); ceilMat.emissiveIntensity = 0.16;
  const wallInfill = M.paintWhite.clone(); wallInfill.side = THREE.FrontSide; wallInfill.color.set(0xf2f1ee).multiply(new THREE.Color(0.93, 0.975, 0.97)); wallInfill.envMapIntensity = 0.72;
  const velvetN = kit.pbrMaps('velour_velvet', '1k', { repeat: [3, 3] });
  const velvet = std({ color: 0x4a4744, roughness: 0.82, normalMap: velvetN.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
  const HBW = 1.84, HBH = 1.30; const tuft = tuftTex(kit, HBW, HBH);
  const tufted = std({ map: tuft, bumpMap: tuft, bumpScale: 3.0, roughness: 0.72, color: 0x99948e });
  const duvet = std({ color: 0xf4f1ea, roughness: 0.92, normalMap: kit.noiseNormal(256, 1.6, 10, 31), normalScale: new THREE.Vector2(0.45, 0.45) });
  const pt = pintuckMaps(kit, 0.22); // 0.11 m pinch pitch, matches comforter() geometry
  const pink = physMat({ map: pt.map, normalMap: pt.normal, normalScale: new THREE.Vector2(1.8, 1.8), roughness: 0.5, color: 0xffffff, sheen: 0.6, sheenColor: new THREE.Color(0xffd8cc), sheenRoughness: 0.45, side: THREE.DoubleSide });
  const ptS = pintuckMaps(kit, 0.16); // shams: same pintuck, read through pillow box UVs (0..1 per face)
  ptS.map.repeat.set(4, 4); ptS.normal.repeat.set(4, 4);
  const pinkSham = physMat({ map: ptS.map, normalMap: ptS.normal, normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.5, color: 0xffffff, sheen: 0.6, sheenColor: new THREE.Color(0xffd8cc), sheenRoughness: 0.45 });
  const greySham = std({ color: 0x8c8986, roughness: 0.75, normalMap: velvetN.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  const pillowWhite = std({ color: 0xf5f4f1, roughness: 0.9, normalMap: kit.noiseNormal(128, 1, 8, 2), normalScale: new THREE.Vector2(0.3, 0.3) });
  const teddy = kit.pbrMaps('curly_teddy_natural', '1k', { repeat: [1.5, 1.5] });
  const fur = std({ ...teddy, color: 0xffffff, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) });
  fur.map = null; // keep the curly normal, white colour
  const mirror = std({ color: 0xa9aeae, roughness: 0.05, metalness: 1.0, envMapIntensity: 1.0 });
  const mirrorDk = std({ color: 0x969a9a, roughness: 0.04, metalness: 1.0, envMapIntensity: 1.0 }); // furniture mirror: reads grey, not white
  const smoke = physMat({ color: 0x1b1c1d, roughness: 0.08, metalness: 0.6, clearcoat: 1 });
  const glassTop = physMat({ color: 0xdfeee9, roughness: 0.03, transparent: true, opacity: 0.35, metalness: 0.1, envMapIntensity: 1.2, depthWrite: false });
  const blackEdge = std({ color: 0x131313, roughness: 0.4, metalness: 0.7 });
  const ceramic = physMat({ color: 0xf7f6f3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const shadeMat = std({ color: 0xf9f7f2, emissive: 0xfff0dc, emissiveIntensity: 0.25, roughness: 0.9, side: THREE.DoubleSide });
  const pinkPlastic = physMat({ color: 0xf0a3a8, roughness: 0.3, clearcoat: 0.6 });
  const rugMat = std({ color: 0xc8c8c8, map: rugTex(kit), normalMap: kit.noiseNormal(256, 3, 64, 12), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1 });
  const linenShade = std({ map: shadeTex(kit), roughness: 0.95, side: THREE.DoubleSide, color: 0xc4c2be });
  const fanWhite = std({ color: 0xf2f1ee, roughness: 0.6, envMapIntensity: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const oakFrame = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.4, 2] }), color: 0xd9a46e, roughness: 0.5 });
  const screenMat = physMat({ map: tvTex(kit), color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const frameSilver = std({ color: 0xb9bab8, roughness: 0.35, metalness: 0.8 });
  const brass = M.brass;
  const gold = std({ color: 0xd6aa52, roughness: 0.2, metalness: 1 });
  const coralWhite = std({ color: 0xf3f1ec, roughness: 0.7 });
  const plateMat = std({ color: 0xf1f0ec, roughness: 0.5 });

  // ================================================================ BEDROOM C
  const bed = kit.group(root, [0, 0, 0], 0, 'bedC');

  // ---- vaulted (single-pitch) ceiling + wall infill above the plate on the three other walls
  {
    const e = 0.06, Yw = Y + WALLH;
    const c = new THREE.Mesh(polyGeo([[X0 - e, ceilY(X0 - e), Z0 - e], [X1 + e, ceilY(X1 + e), Z0 - e], [X1 + e, ceilY(X1 + e), Z1 + e], [X0 - e, ceilY(X0 - e), Z1 + e]], [0, -1, 0]), ceilMat);
    c.name = 'vaultC'; c.receiveShadow = true; c.castShadow = false; bed.add(c);
    /* polish4: the vault's high edge (9.0 m) pokes through the hip roof, so from the street / pool deck its emissive
       underside showed as a glowing white roof quad at night. Draw it only for cameras inside the upper floor around
       this room (player, probe cube cameras); everyone else gets an empty draw range. */
    c.onBeforeRender = (r, sc, cam) => { const p = cam.matrixWorld.elements; const x = p[12], y = p[13], z = p[14];
      const inside = y > Y - 0.4 && y < 9.2 && x > X0 - 0.4 && x < X1 + 7.5 && z > Z0 - 0.4 && z < Z1 + 0.4;
      c.geometry.setDrawRange(0, inside ? Infinity : 0); };
    for (const [z, nz] of [[Z0, 1], [Z1, -1]]) { const m = new THREE.Mesh(polyGeo([[X0, Yw - 0.01, z], [X1 + e, Yw - 0.01, z], [X1 + e, ceilY(X1 + e) + 0.01, z]], [0, 0, nz]), wallInfill); m.receiveShadow = true; m.castShadow = false; bed.add(m); }
    const m = new THREE.Mesh(polyGeo([[X1, Yw - 0.01, Z0 - e], [X1, Yw - 0.01, Z1 + e], [X1, ceilY(X1) + 0.05, Z1 + e], [X1, ceilY(X1) + 0.05, Z0 - e]], [-1, 0, 0]), wallInfill); m.receiveShadow = true; m.castShadow = false; bed.add(m);
  }
  // hide the shell's interim SW-block hip roof (it dips under this vault) — only while the camera is inside
  // bedroom C, so the roof still reads from outside. Re-applied each frame in case another piece swaps materials.
  {
    const f = (v) => v.toFixed(3);
    // bath: also drop the eave/soffit seen through its window (sight line runs out towards -x, +z)
    const cut = [[BED.rect, 0.02, 0.02], [BATH.rect, 2.5, 4.0]].map(([[a0, b0, a1, b1], out, outX]) => `if (cameraPosition.x > ${f(a0)} && cameraPosition.x < ${f(a1)} && cameraPosition.z > ${f(b0)} && cameraPosition.z < ${f(b1)} && cameraPosition.y > ${f(Y)} && cameraPosition.y < ${f(Y + 6)} && vBcW.x > ${f(a0 - outX)} && vBcW.x < ${f(a1 + 0.02)} && vBcW.z > ${f(b0 - 0.02)} && vBcW.z < ${f(b1 + out)} && (vBcW.z > ${f(b1 + 0.03)} || vBcW.x > ${f(a0 - 0.02)})) discard;`).join('\n') +
      // the family-room gable roof (eave at z = 13.25) pokes through the rear wall into both rooms: hide the strip inside
      `\nif (cameraPosition.x > ${f(X0)} && cameraPosition.x < ${f(BATH.rect[2])} && cameraPosition.z > ${f(Z0)} && cameraPosition.z < ${f(Z1)} && cameraPosition.y > ${f(Y)} && cameraPosition.y < ${f(Y + 6)} && vBcW.z < ${f(Z1 + 0.31)} && vBcW.x > ${f(X0 - 0.02)} && vBcW.x < ${f(BATH.rect[2] + 0.02)} && vBcW.y > ${f(Y - 0.05)}) discard;`;
    const patched = new WeakSet(); const cache = new Map();
    // the exterior piece's hip/ridge caps (0.05 x 0.26 boxes, merged by its mergeStatic) + fascia also cross this vault: found once
    const caps = new Set(); let scans = 0;
    const isCap = (o) => o.isMesh && !o.isInstancedMesh && ((o.geometry?.type === 'BoxGeometry' && o.geometry.parameters.height === 0.05 && o.geometry.parameters.depth === 0.26) ||
      (o.name === 'merged' && !Array.isArray(o.material) && ((o.material?.color?.getHex() === 0x2f2f30 && o.material.roughness === 0.9) || (o.material?.color?.getHex() === 0x1b1918 && o.material.roughness === 0.55))) || o.name === 'fascia');
    const apply = () => {
      if (scans < 30) { scans++; ctx.scene.traverse(o => { if (isCap(o)) caps.add(o); }); }
      const targets = [];
      ctx.shell?.root?.traverse(o => { if (o.isMesh && ['roof:sw-block', 'soffit:sw-block', 'roof:family', 'soffit:family', 'roof:turret', 'soffit:turret'].includes(o.name)) targets.push(o); });
      for (const o of caps) targets.push(o);
      targets.forEach(o => {
        if (patched.has(o.material)) return;
        let m = cache.get(o.material);
        if (!m) {
          const prev = o.material; m = prev.clone(); const prevCompile = prev.onBeforeCompile, prevKey = prev.customProgramCacheKey;
          m.onBeforeCompile = function (sh, r) {
            if (prevCompile) prevCompile.call(this, sh, r);
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBcW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBcW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBcW;').replace('void main() {', 'void main() {\n' + cut);
          };
          m.customProgramCacheKey = () => (prevKey ? prevKey.call(prev) : '') + '|bedC-roof-cut';
          cache.set(o.material, m); patched.add(m);
        }
        o.material = m;
      });
    };
    apply(); ctx.onUpdate(apply);
  }

  // ---- wallpaper on the bed wall (x = X0), cut around the SW window
  {
    const wo = ctx.plan.OPENINGS.find(o => o.id === 'bC-sw'); const wz0 = wo.at[1] - wo.w / 2, wz1 = wo.at[1] + wo.w / 2;
    facePanel(bed, 'x', X0, Z0, wz0, Y, Y + WALLH, 1, wallpaper);
    facePanel(bed, 'x', X0, wz1, Z1, Y, Y + WALLH, 1, wallpaper);
    facePanel(bed, 'x', X0, wz0, wz1, Y, Y + wo.sill, 1, wallpaper);
    facePanel(bed, 'x', X0, wz0, wz1, Y + wo.head, Y + WALLH, 1, wallpaper);
  }
  // bright white paint (own material, slightly cool) over the shell walls: window wall, TV wall, camera wall
  {
    const wf = ctx.plan.OPENINGS.find(o => o.id === 'bC-front'), a = wf.at[0] - wf.w / 2, b = wf.at[0] + wf.w / 2;
    facePanel(bed, 'z', Z0, X0, a, Y, Y + WALLH, 1, wallInfill); facePanel(bed, 'z', Z0, b, X1, Y, Y + WALLH, 1, wallInfill);
    facePanel(bed, 'z', Z0, a, b, Y, Y + wf.sill, 1, wallInfill); facePanel(bed, 'z', Z0, a, b, Y + wf.head, Y + WALLH, 1, wallInfill);
    const dd = ctx.plan.OPENINGS.find(o => o.id === 'bC-d'), c = dd.at[1] - dd.w / 2 - 0.06, e2 = dd.at[1] + dd.w / 2 + 0.06;
    facePanel(bed, 'x', X1, Z0, c, Y, Y + WALLH, -1, wallInfill); facePanel(bed, 'x', X1, e2, Z1, Y, Y + WALLH, -1, wallInfill);
    facePanel(bed, 'x', X1, c, e2, Y + dd.head + 0.07, Y + WALLH, -1, wallInfill);
    facePanel(bed, 'z', Z1, X0, X1, Y, Y + WALLH, -1, wallInfill);
    // cool daylight through the front window, raking onto the bed wall (1 of 2 lights, no shadows)
    /* source just inside the glass, past the roman shade (from outside it lit the shade into a glowing blob); same footprint */
    const sun = new THREE.SpotLight(0xeef3ff, 38, 11, 0.71, 1.0, 2); sun.castShadow = false;
    sun.position.set(wf.at[0] + 0.3, Y + 2.35, Z0 + 0.35); sun.target.position.set(1.2, Y + 0.6, 10.6); bed.add(sun, sun.target);
  }
  {
    const d = ctx.plan.OPENINGS.find(o => o.id === 'bC-d');
    kit.baseboards(bed, BED.rect, Y, 0.10, 0.014, paint, [{ side: 'x1', from: d.at[1] - d.w / 2, to: d.at[1] + d.w / 2 }]);
  }

  // ---- recessed cans on the slope + ceiling fan
  {
    const n = new THREE.Vector3(K, -1, 0).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const disc = new THREE.CircleGeometry(0.045, 24), ring = new THREE.RingGeometry(0.045, 0.062, 24);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 0.5, roughness: 0.4 }), trim = std({ color: 0xeeeeea, roughness: 0.5 });
    for (const [x, z] of [[1.45, 8.20], [1.45, 10.05], [1.45, 11.90], [3.55, 8.20], [3.55, 11.90]]) {
      for (const [g, mt, o] of [[disc, lit, 0.006], [ring, trim, 0.005]]) { const m = new THREE.Mesh(g, mt); m.quaternion.copy(q); m.position.set(x, ceilY(x), z).addScaledVector(n, o); m.castShadow = false; bed.add(m); }
    }
    // white 3-blade fan with a small opal light, short downrod off a sloped canopy
    const FX = 2.75, FZ = 9.70, cy = ceilY(FX), ROD = cy - (Y + 3.25);
    const fan = kit.group(bed, [FX, cy, FZ], 0, 'fanC');
    add(fan, kit.cyl(0.055, 0.07, 0.06), fanWhite, [0, -0.04, 0], [0, 0, Math.atan(K)]);
    add(fan, kit.cyl(0.012, 0.012, ROD - 0.10), fanWhite, [0, -0.06 - (ROD - 0.10) / 2, 0]);
    const rotor = kit.group(fan, [0, -ROD, 0], 0, 'fanRotor'); rotor.userData.keep = true;
    add(rotor, kit.lathe([[0.0, -0.05], [0.10, -0.04], [0.12, 0.0], [0.10, 0.05], [0.03, 0.07], [0, 0.07]], 32), fanWhite);
    add(rotor, kit.sphere(0.07, 24, 12), std({ color: 0xffffff, emissive: 0xfff4e4, emissiveIntensity: 0.4, roughness: 0.4 }), [0, -0.07, 0]);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2; const bl = kit.group(rotor, [0, 0, 0], a);
      const blade = new THREE.Shape(); blade.moveTo(0.10, -0.035); blade.bezierCurveTo(0.35, -0.07, 0.62, -0.08, 0.72, -0.02); blade.bezierCurveTo(0.74, 0.04, 0.62, 0.075, 0.35, 0.06); blade.lineTo(0.10, 0.035); blade.closePath();
      const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.008, bevelEnabled: false }); bg.rotateX(Math.PI / 2);
      const m = add(bl, bg, fanWhite, [0, 0.01, 0], [0.08, 0, 0]);
    }
    if (!ctx.shot) ctx.onUpdate((dt) => { rotor.rotation.y += dt * 1.4; });
  }

  // ---- roman shade (flat fold, light grey linen) over the front window + framed prints either side
  {
    const wo = ctx.plan.OPENINGS.find(o => o.id === 'bC-front'); const wx0 = wo.at[0] - wo.w / 2, wx1 = wo.at[0] + wo.w / 2;
    const sw = wo.w + 0.12, top = Y + wo.head + 0.10, bot = Y + 1.86, z = Z0 + 0.05;
    const sh = kit.group(bed, [wo.at[0], 0, z], 0, 'shadeC');
    add(sh, kit.rbox(sw, 0.05, 0.06, 0.008), linenShade, [0, top - 0.025, -0.01]);
    const flat = new THREE.PlaneGeometry(sw, top - bot - 0.12); add(sh, flat, linenShade, [0, (top + bot + 0.12) / 2 - 0.02, 0.005]);
    for (let i = 0; i < 4; i++) { const y = bot + 0.03 + i * 0.065; add(sh, kit.rbox(sw, 0.07, 0.035 + i * 0.008, 0.016), linenShade, [0, y, 0.015 + (3 - i) * 0.006]); }
    for (const [x, y, s] of [[wx0 - 0.30, 2.00, 7], [wx0 - 0.30, 1.66, 8], [wx1 + 0.33, 2.05, 9], [wx1 + 0.33, 1.70, 10]]) {
      const f = kit.group(bed, [x, Y + y, Z0 + 0.012], 0);
      add(f, kit.rbox(0.25, 0.25, 0.022, 0.004), frameSilver, [0, 0, 0]);
      add(f, new THREE.PlaneGeometry(0.21, 0.21), std({ map: printTex(kit, s), roughness: 0.8 }), [0, 0, 0.0115]);
    }
  }

  // ---- bed: tufted charcoal wingback king, local +z = into the room (world +x), local +x = world -z
  const BZ = 10.15, W = 2.05, L = 2.30;
  {
    const g = kit.group(bed, [X0, Y, BZ], Math.PI / 2, 'bedCframe');
    add(g, kit.rbox(HBW + 0.30, 1.62, 0.08, 0.03), velvet, [0, 0.81, 0.04]); // back board
    add(g, kit.rbox(HBW, HBH, 0.12, 0.05), tufted, [0, 0.27 + HBH / 2, 0.12]);   // tufted panel
    add(g, kit.cushion(HBW + 0.06, 0.08, 0.16, 0.035, 0.015), velvet, [0, 1.60, 0.10]); // rolled top edge
    for (const s of [-1, 1]) { // wings flaring forward
      const wg = kit.group(g, [s * (HBW / 2 + 0.06), 0, 0.04], -s * 0.30);
      add(wg, kit.rbox(0.13, 1.62, 0.46, 0.06), velvet, [0, 0.81, 0.20]);
      add(wg, kit.cushion(0.15, 0.06, 0.48, 0.03, 0.01), velvet, [0, 1.62, 0.20]);
    }
    add(g, kit.cushion(W, 0.34, L - 0.12, 0.05, 0.01), velvet, [0, 0.07 + 0.17, 0.12 + (L - 0.12) / 2]); // upholstered base/rails
    for (const sx of [-1, 1]) for (const sz of [0.2, L - 0.08]) add(g, kit.cyl(0.025, 0.02, 0.07, 12), blackEdge, [sx * (W / 2 - 0.08), 0.035, sz]);
    add(g, kit.rbox(1.96, 0.24, 2.0, 0.07), duvet, [0, 0.53, 0.18 + 1.0]);                      // mattress
    add(g, drape(kit.cushion(2.08, 0.26, 2.06, 0.07, 0.02, 6), -0.02, 0.02, 11, 2), duvet, [0, 0.545, 0.17 + 1.03]); // ivory sheet / duvet
    // blush pintuck comforter: draped sheet over the lower two thirds, spilling ~0.28 m over the sides and foot
    const cf = comforter(1.03, 1.0, 2.24, 0.07, 0.30);
    add(g, cf, pink, [0, 0.715, 0]);
    add(g, kit.cushion(2.18, 0.07, 0.16, 0.035, 0.02), pink, [0, 0.735, 1.0]); // turned-down top edge
    // pillows (static): grey euro shams, three blush pintuck shams, white faux-fur lumbar
    const pillow = (w, h, th, mat, x, y, z, tilt, puff = 0.05, roll = 0) => add(g, pillowGeo(w, h, th + puff * 0.6), mat, [x, y, z], [-tilt, roll, 0]);
    pillow(0.68, 0.64, 0.18, greySham, -0.50, 0.95, 0.26, 0.20, 0.09);
    pillow(0.68, 0.64, 0.18, greySham, 0.50, 0.95, 0.26, 0.20, 0.09);
    pillow(0.70, 0.50, 0.17, pinkSham, -0.48, 0.90, 0.44, 0.30, 0.11, 0.06);
    pillow(0.70, 0.50, 0.17, pinkSham, 0.48, 0.90, 0.44, 0.30, 0.11, -0.06);
    pillow(0.62, 0.44, 0.16, pinkSham, 0.02, 0.92, 0.40, 0.26, 0.10);
    pillow(0.50, 0.40, 0.16, fur, -0.04, 0.88, 0.60, 0.30, 0.08, 0.04);
    // colliders: base+mattress, headboard
    phys.boxLocal(g, 0, 0.36, 0.12 + L / 2, W / 2 + 0.06, 0.36, L / 2);
    phys.boxLocal(g, 0, 0.81, 0.12, HBW / 2 + 0.2, 0.81, 0.12);
  }
  // ---- mirrored nightstands (all mirror, black metal frame, glass top) + white gourd lamps
  const nightstand = (z, near) => {
    const nw = 0.60, nd = 0.45, nh = 0.65, e = 0.016;
    const g = kit.group(bed, [X0 + 0.03 + nd / 2, Y, z], Math.PI / 2, 'nightstandC');
    add(g, kit.box(nw - 0.01, nh - 0.02, nd - 0.01), mirrorDk, [0, nh / 2, 0]);
    add(g, kit.box(nw - 2 * e, 0.17, 0.006), mirrorDk, [0, nh - 0.12, nd / 2 + 0.002]);          // drawer front
    add(g, kit.box(nw - 2 * e, nh - 0.27, 0.006), mirrorDk, [0, (nh - 0.22) / 2 + 0.02, nd / 2 + 0.002]); // lower door
    add(g, kit.box(nw - 0.02, 0.008, nd - 0.02), glassTop, [0, nh + 0.004, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, kit.box(e, nh, e), blackEdge, [sx * (nw / 2 - e / 2), nh / 2, sz * (nd / 2 - e / 2)]);
    for (const y of [e / 2, nh - e / 2]) for (const sz of [-1, 1]) add(g, kit.box(nw, e, e), blackEdge, [0, y, sz * (nd / 2 - e / 2)]);
    for (const y of [e / 2, nh - e / 2]) for (const sx of [-1, 1]) add(g, kit.box(e, e, nd), blackEdge, [sx * (nw / 2 - e / 2), y, 0]);
    add(g, kit.box(nw, 0.012, 0.012), blackEdge, [0, nh - 0.215, nd / 2]);
    phys.solidGroup(g);
    // lamp: white glazed gourd (two bulbs), brass neck, white drum shade; ~0.65 m tall
    const lg = kit.group(bed, [X0 + 0.25, Y + nh + 0.008, z + (near ? -0.04 : 0.02)], 0);
    add(lg, kit.lathe([[0.0, 0], [0.06, 0.0], [0.095, 0.04], [0.105, 0.11], [0.085, 0.18], [0.055, 0.21], [0.065, 0.25], [0.068, 0.29], [0.045, 0.33], [0.018, 0.35], [0.0, 0.35]], 40), ceramic);
    add(lg, kit.cyl(0.012, 0.012, 0.09), brass, [0, 0.395, 0]);
    add(lg, new THREE.CylinderGeometry(0.17, 0.18, 0.26, 40, 1, true), shadeMat, [0, 0.52, 0]);
    add(lg, kit.sphere(0.035, 12, 8), std({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 1.0 }), [0, 0.46, 0]);
    return g;
  };
  nightstand(BZ - (W / 2 + 0.43), false);
  nightstand(BZ + (W / 2 + 0.43), true);
  { // pink twin-bell alarm clock on the near nightstand (dynamic)
    const cg = new THREE.Group(); cg.position.set(X0 + 0.30, Y + 0.66 + 0.008, BZ + W / 2 + 0.70); cg.rotation.y = Math.PI / 2 + 0.3; bed.add(cg);
    add(cg, kit.cyl(0.06, 0.06, 0.05, 28), pinkPlastic, [0, 0.065, 0], [Math.PI / 2, 0, 0]);
    add(cg, new THREE.CircleGeometry(0.048, 24), std({ color: 0xf7f3ee, roughness: 0.6 }), [0, 0.065, 0.026]);
    for (const s of [-1, 1]) add(cg, kit.sphere(0.024, 16, 8, ), pinkPlastic, [s * 0.04, 0.125, 0]);
    for (const s of [-1, 1]) add(cg, kit.cyl(0.006, 0.006, 0.02), pinkPlastic, [s * 0.04, 0.008, 0]);
    dyn.push([cg, { mass: 0.3 }]);
  }
  // outlets beside the near nightstand
  for (const [y, z] of [[0.52, BZ + W / 2 + 0.72], [0.40, BZ + W / 2 + 0.72]]) add(bed, kit.box(0.008, 0.11, 0.07), plateMat, [X0 + 0.004, Y + y, z]);

  // ---- rug under the bed
  {
    const rg = new THREE.PlaneGeometry(3.60, 3.90); rg.rotateX(-Math.PI / 2);
    const m = add(bed, rg, rugMat, [2.75, Y + 0.008, 10.40], [0, 0, 0], { shadow: false }); m.rotation.y = 0;
    add(bed, kit.box(3.60, 0.008, 3.90), std({ color: 0x5d5e60, roughness: 1 }), [2.75, Y + 0.003, 10.40], [0, 0, 0], { shadow: false });
  }

  // ---- mirrored glass-top console on the TV wall (1.6 x 0.45 x 0.78) + wall TV
  {
    const DX1 = X1 - 0.02, DD = 0.45, DX0 = DX1 - DD, DZ0 = 8.85, DZ1 = 10.45, DH = 0.78, e = 0.018, cx = (DX0 + DX1) / 2, cz = (DZ0 + DZ1) / 2, LZ = DZ1 - DZ0;
    const g = kit.group(bed, [0, Y, 0], 0, 'consoleC');
    add(g, kit.box(DD - 0.02, DH - 0.06, LZ - 0.02), mirrorDk, [cx, 0.03 + (DH - 0.06) / 2, cz]);       // body
    for (const z of [DZ0 - 0.002, DZ1 + 0.002]) add(g, kit.box(DD - 0.02, DH - 0.04, 0.006), smoke, [cx, DH / 2, z]); // smoked-mirror ends
    // front (faces -x): 3 columns x 4 mirrored drawers, black seams + black knobs
    const cols = 3, rows = 4, cw = (LZ - 2 * e) / cols, rh = (DH - 0.08) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const zc = DZ0 + e + (i + 0.5) * cw, yc = 0.05 + (j + 0.5) * rh;
      add(g, kit.box(0.006, rh - 0.01, cw - 0.01), smoke, [DX0 - 0.003, yc, zc]);
      for (const s of [-1, 1]) add(g, kit.cyl(0.011, 0.011, 0.03, 12), blackEdge, [DX0 - 0.02, yc, zc + s * cw * 0.25], [0, 0, Math.PI / 2]);
    }
    for (let j = 0; j <= rows; j++) add(g, kit.box(0.01, 0.008, LZ), blackEdge, [DX0 - 0.004, 0.05 + j * rh, cz]);
    for (let i = 1; i < cols; i++) add(g, kit.box(0.01, DH - 0.08, 0.008), blackEdge, [DX0 - 0.004, 0.05 + (DH - 0.08) / 2, DZ0 + e + i * cw]);
    // black metal frame: 4 legs + top rails
    for (const z of [DZ0, DZ1]) for (const x of [DX0, DX1]) add(g, kit.box(e, DH, e), blackEdge, [x + (x === DX0 ? -e / 2 : -e / 2), DH / 2, z + (z === DZ0 ? -e / 2 : e / 2)]);
    for (const x of [DX0 - e / 2, DX1 - e / 2]) add(g, kit.box(e, e, LZ + 2 * e), blackEdge, [x, DH - e / 2, cz]);
    for (const z of [DZ0 - e / 2, DZ1 + e / 2]) add(g, kit.box(DD, e, e), blackEdge, [cx, DH - e / 2, z]);
    add(g, kit.box(DD + 0.02, 0.012, LZ + 0.06), glassTop, [cx, DH + 0.006, cz]);
    add(g, kit.box(0.012, 0.014, LZ + 0.06), std({ color: 0x9fc3b8, roughness: 0.1, transparent: true, opacity: 0.7 }), [DX0 - 0.012, DH + 0.006, cz]);
    phys.boxAABB([DX0 - 0.03, Y, DZ0 - 0.03], [DX1, Y + DH + 0.012, DZ1 + 0.03]);
    // decor: gold hand sculpture on a white block, white coral, small white box
    const TOP = Y + DH + 0.012;
    { const hg = new THREE.Group(); hg.position.set(cx - 0.05, TOP, 10.05); bed.add(hg);
      add(hg, kit.rbox(0.10, 0.03, 0.08, 0.006), coralWhite, [0, 0.015, 0]);
      add(hg, kit.rbox(0.07, 0.10, 0.03, 0.012), gold, [0, 0.08, 0], [0, 0, 0.1]);
      for (let i = 0; i < 4; i++) add(hg, kit.cyl(0.008, 0.009, 0.07 - Math.abs(i - 1.5) * 0.008, 10), gold, [-0.027 + i * 0.018, 0.16, 0], [0, 0, 0.1]);
      add(hg, kit.cyl(0.009, 0.01, 0.06, 10), gold, [0.045, 0.09, 0.005], [0, 0, -0.8]);
      dyn.push([hg, { mass: 0.6 }]); }
    { const cg = new THREE.Group(); cg.position.set(cx - 0.08, TOP, 9.10); bed.add(cg); const r = kit.rng(8);
      for (let i = 0; i < 9; i++) add(cg, kit.sphere(0.035 + r() * 0.02, 14, 10), coralWhite, [(r() - 0.5) * 0.08, 0.04 + r() * 0.05, (r() - 0.5) * 0.08]);
      dyn.push([cg, { mass: 0.4 }]); }
    { const b = add(bed, kit.rbox(0.10, 0.04, 0.07, 0.006), coralWhite, [cx - 0.10, TOP + 0.02, 10.30]); dyn.push([b, { mass: 0.2 }]); }
    // TV: thin oak-framed flat panel, ~1.45 m
    const tv = kit.group(bed, [X1 - 0.03, Y + 1.78, 9.60], -Math.PI / 2, 'tvC');
    add(tv, kit.box(1.45, 0.84, 0.035), oakFrame, [0, 0, 0]);
    add(tv, new THREE.PlaneGeometry(1.41, 0.80), screenMat, [0, 0, 0.0185]);
  }

  // ================================================================ BATH C
  const bath = kit.group(root, [0, 0, 0], 0, 'bathC');
  const [BX0, BZ0, BX1, BZ1] = BATH.rect; const BH = Y + 2.75;
  const z = zellige(kit);
  const EI = 0.6; // bath exposure trim: the skylight + window probe blows the room out otherwise
  const tile = physMat({ map: z.map, normalMap: z.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: z.rough, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.15, envMapIntensity: EI });
  const floorTile = std({ map: porcelainTex(kit, 0.6, 1.2, '#d2ccc3', 41), roughness: 0.5, normalMap: kit.noiseNormal(256, 0.6, 16, 9), normalScale: new THREE.Vector2(0.08, 0.08), envMapIntensity: EI });
  const quartz = std({ color: 0xf3f2ef, roughness: 0.16, envMapIntensity: EI });
  const porcelain = physMat({ color: 0xf6f6f4, roughness: 0.08, clearcoat: 1, envMapIntensity: EI });
  const porcelainIn = physMat({ color: 0xf0f0ee, roughness: 0.1, clearcoat: 1, side: THREE.BackSide, envMapIntensity: EI });
  const oakMaps = kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.4, 0.4] });
  const oak = std({ ...oakMaps, color: 0xffd6ae, roughness: 0.55, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 0.8 });
  const bathCeil = ceilMat.clone(); bathCeil.envMapIntensity = EI; bathCeil.emissiveIntensity = 0.04;
  const showerGlass = physMat({ color: 0xeef6f2, roughness: 0.02, transparent: true, opacity: 0.08, metalness: 0, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false });
  const glassEdge = std({ color: 0xb8d6cb, roughness: 0.1, transparent: true, opacity: 0.35 });
  const frosted = std({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 0.9, roughness: 0.4 });
  const skyGlow = std({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.0, roughness: 1 });
  const towel = std({ color: 0xf8f8f6, roughness: 1, normalMap: kit.noiseNormal(256, 3, 64, 17), normalScale: new THREE.Vector2(0.8, 0.8) });
  const greenGlass = physMat({ color: 0x4c6b52, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 });
  const sage = std({ color: 0x7f9c86, roughness: 0.6 });
  const leaf = std({ color: 0x4f6b3e, roughness: 0.7, side: THREE.DoubleSide });
  const matMat = std({ color: 0xd9d7d3, roughness: 1, normalMap: teddy.normalMap, normalScale: new THREE.Vector2(1.5, 1.5) });

  kit.floorFinish(bath, 'bathC', floorTile);
  { // painted rear wall (z = BZ1) around the window, own material so it lights from the bath probe
    const bp = M.paintWhite.clone(); bp.envMapIntensity = EI; const wo = ctx.plan.OPENINGS.find(o => o.id === 'bathC-rear');
    const a = wo.at[0] - wo.w / 2, b = wo.at[0] + wo.w / 2;
    facePanel(bath, 'z', BZ1, BX0, a, Y, BH, -1, bp); facePanel(bath, 'z', BZ1, b, BX1, Y, BH, -1, bp);
    facePanel(bath, 'z', BZ1, a, b, Y, Y + wo.sill, -1, bp); facePanel(bath, 'z', BZ1, a, b, Y + wo.head, BH, -1, bp);
  }
  // ceiling with a skylight well above the tub
  const SK = [5.50, 10.50, 6.85, 11.20], SKH = 0.55;
  {
    const c = (x0, z0, x1, z1) => { if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return; kit.ceilingFlat(bath, [x0 + 0.08, z0 + 0.08, x1 - 0.08, z1 - 0.08], BH, bathCeil); };
    c(BX0, BZ0, SK[0], BZ1); c(SK[2], BZ0, BX1, BZ1); c(SK[0], BZ0, SK[2], SK[1]); c(SK[0], SK[3], SK[2], BZ1);
    // well walls (facing in) + glowing skylight glass
    const wellM = M.paintWhite.clone(); wellM.side = THREE.DoubleSide; wellM.emissive = new THREE.Color(0xffffff); wellM.emissiveIntensity = 0.12;
    for (const [a, b, nn] of [[[SK[0], SK[1]], [SK[2], SK[1]], [0, 0, 1]], [[SK[0], SK[3]], [SK[2], SK[3]], [0, 0, -1]], [[SK[0], SK[1]], [SK[0], SK[3]], [1, 0, 0]], [[SK[2], SK[1]], [SK[2], SK[3]], [-1, 0, 0]]]) {
      const m = new THREE.Mesh(polyGeo([[a[0], BH, a[1]], [b[0], BH, b[1]], [b[0], BH + SKH, b[1]], [a[0], BH + SKH, a[1]]], nn), wellM); m.castShadow = false; m.receiveShadow = true; bath.add(m);
    }
    const sg = new THREE.PlaneGeometry(SK[2] - SK[0], SK[3] - SK[1]); sg.rotateX(Math.PI / 2);
    add(bath, sg, skyGlow, [(SK[0] + SK[2]) / 2, BH + SKH, (SK[1] + SK[3]) / 2], [0, 0, 0], { shadow: false });
    // cans
    const disc = new THREE.CircleGeometry(0.045, 24); disc.rotateX(Math.PI / 2); const ring = new THREE.RingGeometry(0.045, 0.06, 24); ring.rotateX(Math.PI / 2);
    for (const [x, zz] of [[6.95, 12.30], [7.25, 10.90]]) { add(bath, disc, std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 0.6 }), [x, BH - 0.003, zz], [0, 0, 0], { shadow: false }); add(bath, ring, M.paintWhite, [x, BH - 0.004, zz], [0, 0, 0], { shadow: false }); }
  }

  // tub alcove / layout: tub along the z = BZ0 wall, white tiled half-wall closing its near end (faces the door)
  const TZ1 = BZ0 + 0.88, TX1 = BX0 + 1.50, TH = 0.52; // tub z 10.40-11.28, x 5.31-6.81
  const KX0 = TX1, KX1 = TX1 + 0.15, KH = 1.10;       // half-wall x 6.81-6.96, z BZ0..TZ1
  // zellige: whole vanity wall (x = BX0), shower back wall (z = BZ0) to the half-wall, half-wall faces
  facePanel(bath, 'x', BX0, BZ0, BZ1, Y, BH, 1, tile);
  facePanel(bath, 'z', BZ0, BX0, KX1, Y, BH, 1, tile);
  {
    const kg = kit.group(bath, [0, Y, 0], 0, 'kneeWall');
    add(kg, kit.box(KX1 - KX0, KH, TZ1 - BZ0), quartz, [(KX0 + KX1) / 2, KH / 2, (BZ0 + TZ1) / 2]);
    facePanel(kg, 'x', KX1, BZ0, TZ1, 0, KH, 1, tile, 0.003);
    facePanel(kg, 'x', KX0, BZ0, TZ1, TH, KH, -1, tile, 0.003);
    add(kg, kit.rbox(KX1 - KX0 + 0.04, 0.03, TZ1 - BZ0 + 0.02, 0.006), quartz, [(KX0 + KX1) / 2, KH + 0.015, (BZ0 + TZ1) / 2 + 0.01]);
    phys.boxAABB([KX0, Y, BZ0], [KX1, Y + KH, TZ1]);
  }
  // alcove tub: glossy apron + rim slab with an inset basin
  {
    const tg = kit.group(bath, [0, Y, 0], 0, 'tubC');
    const rim = 0.07, iz0 = BZ0 + rim + 0.02, iz1 = TZ1 - rim - 0.03, ix0 = BX0 + rim + 0.04, ix1 = TX1 - rim - 0.03;
    const slab = kit.extrude([[BX0, -BZ0], [TX1, -BZ0], [TX1, -TZ1], [BX0, -TZ1]], 0.05, 0, [[[ix0, -iz0], [ix0, -iz1], [ix1, -iz1], [ix1, -iz0]]]);
    slab.rotateX(-Math.PI / 2); add(tg, slab, porcelain, [0, TH - 0.05, 0]);
    add(tg, kit.rbox(TX1 - BX0, TH - 0.05, 0.05, 0.012), porcelain, [(BX0 + TX1) / 2, (TH - 0.05) / 2, TZ1 - 0.025]);
    const basin = new THREE.BoxGeometry(ix1 - ix0, 0.40, iz1 - iz0); add(tg, basin, porcelainIn, [(ix0 + ix1) / 2, TH - 0.20, (iz0 + iz1) / 2], [0, 0, 0], { shadow: false });
    add(tg, kit.cyl(0.02, 0.02, 0.005, 16), brass, [ix0 + 0.12, TH - 0.398, (iz0 + iz1) / 2]); // drain
    phys.boxAABB([BX0, Y, BZ0], [TX1, Y + TH, TZ1]);
  }
  // brass shower set on the alcove end wall (x = BX0)
  {
    const fz = (BZ0 + TZ1) / 2 + 0.02, wx = BX0 + 0.005;
    const plate = (y, r = 0.045) => add(bath, kit.cyl(r, r, 0.012, 28), brass, [wx + 0.006, Y + y, fz], [0, 0, Math.PI / 2]);
    plate(1.02, 0.055); add(bath, kit.box(0.09, 0.016, 0.016), brass, [wx + 0.055, Y + 1.02, fz + 0.02], [0, 0.3, 0]);
    plate(1.18, 0.04); add(bath, kit.cyl(0.012, 0.012, 0.05), brass, [wx + 0.035, Y + 1.18, fz], [0, 0, Math.PI / 2]);
    for (const y of [1.38, 1.50, 1.62]) plate(y, 0.022); // body jets
    add(bath, kit.tube([[wx, Y + 0.68, fz], [wx + 0.12, Y + 0.68, fz], [wx + 0.16, Y + 0.65, fz]], 0.016, 16), brass); // tub spout
    add(bath, kit.cyl(0.011, 0.011, 0.70), brass, [wx + 0.03, Y + 1.50, fz + 0.18]); // slide bar
    for (const y of [1.15, 1.85]) add(bath, kit.box(0.03, 0.02, 0.02), brass, [wx + 0.015, Y + y, fz + 0.18]);
    add(bath, kit.cyl(0.018, 0.012, 0.22), brass, [wx + 0.06, Y + 1.70, fz + 0.18]); // hand shower
    add(bath, kit.cyl(0.032, 0.022, 0.03), brass, [wx + 0.06, Y + 1.82, fz + 0.18]);
    add(bath, kit.tube([[wx + 0.05, Y + 1.58, fz + 0.18], [wx + 0.10, Y + 1.10, fz + 0.12], [wx + 0.06, Y + 0.95, fz + 0.06], [wx + 0.01, Y + 1.0, fz]], 0.006, 32), brass); // hose
    add(bath, kit.tube([[wx, Y + 2.02, fz], [wx + 0.16, Y + 2.04, fz], [wx + 0.22, Y + 2.0, fz]], 0.011, 12), brass); // arm
    add(bath, kit.cyl(0.075, 0.06, 0.03, 32), brass, [wx + 0.25, Y + 1.98, fz]);
  }
  // frameless glass: fixed panel + hinged door on the tub front, fixed panel on the half-wall, brass clamps
  {
    const gz = TZ1 - 0.045, gTop = Y + 2.28, t = 0.01, gx = (KX0 + KX1) / 2;
    const panelZ = (x0, x1, y0) => { add(bath, kit.box(x1 - x0, gTop - y0, t), showerGlass, [(x0 + x1) / 2, (gTop + y0) / 2, gz], [0, 0, 0], { shadow: false });
      add(bath, kit.box(x1 - x0, 0.006, t + 0.002), glassEdge, [(x0 + x1) / 2, gTop, gz], [0, 0, 0], { shadow: false });
      for (const x of [x0, x1]) add(bath, kit.box(0.004, gTop - y0, t + 0.002), glassEdge, [x, (gTop + y0) / 2, gz], [0, 0, 0], { shadow: false }); };
    const HX = TX1 - 0.72;
    panelZ(BX0 + 0.01, HX - 0.005, Y + TH + 0.01); panelZ(HX + 0.005, gx - 0.006, Y + TH + 0.01);
    // half-wall glass (plane x = gx)
    const z0 = BZ0 + 0.01, z1 = gz - 0.01;
    add(bath, kit.box(t, gTop - (Y + KH + 0.03), z1 - z0), showerGlass, [gx, (gTop + Y + KH + 0.03) / 2, (z0 + z1) / 2], [0, 0, 0], { shadow: false });
    add(bath, kit.box(t + 0.002, 0.006, z1 - z0), glassEdge, [gx, gTop, (z0 + z1) / 2], [0, 0, 0], { shadow: false });
    add(bath, kit.box(t + 0.002, gTop - (Y + KH + 0.03), 0.004), glassEdge, [gx, (gTop + Y + KH + 0.03) / 2, z1], [0, 0, 0], { shadow: false });
    for (const y of [0.80, 2.05]) add(bath, kit.rbox(0.07, 0.09, 0.03, 0.006), brass, [gx - 0.03, Y + y, gz]); // door hinges on the corner
    for (const y of [0.95, 1.75]) add(bath, kit.rbox(0.03, 0.06, 0.035, 0.005), brass, [BX0 + 0.02, Y + y, gz]); // wall clips
    for (const zz of [BZ0 + 0.18, TZ1 - 0.20]) add(bath, kit.rbox(0.035, 0.05, 0.05, 0.005), brass, [gx, Y + KH + 0.055, zz]); // cap clamps
    add(bath, kit.rbox(0.035, 0.06, 0.05, 0.005), brass, [gx, Y + 2.0, BZ0 + 0.02]);
    add(bath, kit.cyl(0.009, 0.009, 0.30), brass, [HX + 0.10, Y + 1.10, gz + 0.04]); // door pull
    phys.boxAABB([BX0, Y + TH, gz - 0.01], [KX1, gTop, gz + 0.01]);
    phys.boxAABB([gx - 0.01, Y + KH, BZ0], [gx + 0.01, gTop, gz]);
  }
  // oak furniture vanity (legs, face frame, 3 drawers | 2 doors | 3 drawers), white quartz top, undermount sink
  const VZ1 = BZ1 - 0.16, VW = 1.50, VZ0 = VZ1 - VW, VD = 0.56, VH = 0.85, VX1 = BX0 + VD, VC = (VZ0 + VZ1) / 2;
  {
    const vg = kit.group(bath, [0, Y, 0], 0, 'vanityC');
    const post = 0.05;
    for (const z of [VZ0 + post / 2, VZ1 - post / 2]) for (const x of [BX0 + post / 2 + 0.01, VX1 - post / 2]) add(vg, kit.box(post, VH - 0.03, post), oak, [x, (VH - 0.03) / 2, z]);
    add(vg, kit.box(VD - 0.06, VH - 0.15, VW - 0.06), oak, [BX0 + VD / 2, 0.12 + (VH - 0.15) / 2, VC]);       // carcass
    add(vg, kit.box(0.02, 0.05, VW - 2 * post), oak, [VX1 - 0.01, 0.10, VC]);                                    // bottom rail
    const front = (z0, w, y0, h, isDoor) => { // shaker front facing +x; z0 = high-z (viewer's left) edge
      const f = new THREE.Mesh(kit.shakerFront(w, h, 0.055, 0.02, 0.006), oak); f.rotation.y = Math.PI / 2; f.position.set(VX1 - 0.002, y0, z0); f.castShadow = true; f.receiveShadow = true; vg.add(f);
      if (isDoor) add(vg, kit.box(0.012, 0.16, 0.012), brass, [VX1 + 0.035, y0 + h - 0.16, z0 - (isDoor === 1 ? w - 0.05 : 0.05)]);
      else { add(vg, kit.box(0.012, 0.012, 0.13), brass, [VX1 + 0.035, y0 + h / 2, z0 - w / 2]); for (const s of [-1, 1]) add(vg, kit.box(0.025, 0.01, 0.01), brass, [VX1 + 0.025, y0 + h / 2, z0 - w / 2 + s * 0.06]); }
    };
    const y0 = 0.125, hT = VH - 0.03 - y0 - 0.02, cw = 0.37, gap = 0.008, mw = VW - 2 * post - 2 * cw - 4 * gap;
    for (const [zL, w] of [[VZ1 - post - gap, cw], [VZ0 + post + gap + cw, cw]]) for (let i = 0; i < 3; i++) { const h = (hT - 2 * gap) / 3; front(zL, w, y0 + i * (h + gap), h, false); }
    const zm = VZ1 - post - gap - cw - gap; front(zm, mw / 2 - gap / 2, y0, hT, 2); front(zm - mw / 2 - gap / 2, mw / 2 - gap / 2, y0, hT, 1);
    // quartz top with sink cut-out + basin
    const sw = 0.50, sd = 0.36, sx = BX0 + 0.30;
    const top = kit.extrude([[BX0, -VZ0 + 0.025], [VX1 + 0.025, -VZ0 + 0.025], [VX1 + 0.025, -VZ1 - 0.025], [BX0, -VZ1 - 0.025]], 0.03, 0, [[[sx - sd / 2, -(VC - sw / 2)], [sx - sd / 2, -(VC + sw / 2)], [sx + sd / 2, -(VC + sw / 2)], [sx + sd / 2, -(VC - sw / 2)]]]);
    top.rotateX(-Math.PI / 2); add(vg, top, quartz, [0, VH - 0.03, 0]);
    add(vg, new THREE.BoxGeometry(sd, 0.17, sw), porcelainIn, [sx, VH - 0.03 - 0.085, VC], [0, 0, 0], { shadow: false });
    // widespread brass faucet
    const fx = BX0 + 0.08;
    add(vg, kit.cyl(0.022, 0.026, 0.05), brass, [fx, VH + 0.025, VC]);
    add(vg, kit.tube([[fx, VH + 0.04, VC], [fx, VH + 0.14, VC], [fx + 0.03, VH + 0.18, VC], [fx + 0.10, VH + 0.17, VC], [fx + 0.12, VH + 0.14, VC]], 0.011, 32), brass);
    for (const s of [-1, 1]) { add(vg, kit.cyl(0.02, 0.024, 0.05), brass, [fx, VH + 0.025, VC + s * 0.17]); add(vg, kit.box(0.06, 0.012, 0.012), brass, [fx + 0.025, VH + 0.06, VC + s * 0.17]); }
    phys.boxAABB([BX0, Y, VZ0], [VX1 + 0.02, Y + VH, VZ1]);
  }
  // round brass mirror + sconces
  {
    const my = Y + 1.50, R = 0.42; const bathMirror = mirror.clone(); bathMirror.envMapIntensity = 1.0; bathMirror.color.set(0xb4b8b7);
    const mg = kit.group(bath, [BX0 + 0.022, my, VC], Math.PI / 2, 'mirrorC');
    add(mg, new THREE.TorusGeometry(R, 0.016, 12, 96), brass, [0, 0, 0]);
    add(mg, new THREE.CircleGeometry(R - 0.004, 64), bathMirror, [0, 0, -0.002]);
    for (const s of [-1, 1]) {
      const sg = kit.group(bath, [BX0, Y + 1.52, VC + s * 0.58], Math.PI / 2);
      add(sg, kit.cyl(0.055, 0.055, 0.015, 28), brass, [0, 0, 0.008], [Math.PI / 2, 0, 0]);
      add(sg, kit.cyl(0.008, 0.008, 0.07), brass, [0, 0, 0.05], [Math.PI / 2, 0, 0]);
      add(sg, new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass, [0, 0.0, 0.10], [0, 0, 0]);
      const sh = add(sg, new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass, [0, 0.0, 0.10], [Math.PI, 0, 0]); sh.material = brass;
      add(sg, kit.sphere(0.035, 16, 10), frosted, [0, -0.045, 0.10]);
    }
    // short brass towel bar on the window wall between the vanity corner and the window
    for (const x of [5.50, 5.84]) { add(bath, kit.cyl(0.018, 0.018, 0.012, 16), brass, [x, Y + 1.42, BZ1 - 0.006], [Math.PI / 2, 0, 0]); add(bath, kit.cyl(0.007, 0.007, 0.06, 10), brass, [x, Y + 1.42, BZ1 - 0.04], [Math.PI / 2, 0, 0]); }
    add(bath, kit.cyl(0.009, 0.009, 0.38, 12), brass, [5.67, Y + 1.42, BZ1 - 0.07], [0, 0, Math.PI / 2]);
  }
  // vanity decor: white flowers in a ribbed white pot, sage candle, green glass soap pump, rolled towel
  {
    const T = Y + VH;
    const pot = kit.group(bath, [BX0 + 0.22, T, VZ1 - 0.22], 0);
    add(pot, kit.lathe([[0, 0], [0.09, 0], [0.11, 0.03], [0.115, 0.09], [0.10, 0.10], [0, 0.10]], 40), ceramic);
    const r = kit.rng(31);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 0.10; add(pot, kit.sphere(0.045 + r() * 0.02, 16, 10), std({ color: 0xfbfaf6, roughness: 0.85 }), [Math.cos(a) * d, 0.15 + r() * 0.06, Math.sin(a) * d]); }
    for (let i = 0; i < 10; i++) { const a = r() * 6.28; const lg = new THREE.PlaneGeometry(0.05, 0.10); add(pot, lg, leaf, [Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15], [0.9, a, 0.2]); }
    const cnd = new THREE.Group(); cnd.position.set(BX0 + 0.12, T, VZ1 - 0.48); bath.add(cnd);
    add(cnd, kit.cyl(0.04, 0.04, 0.09, 24), sage, [0, 0.045, 0]); dyn.push([cnd, { mass: 0.3 }]);
    const sp = new THREE.Group(); sp.position.set(BX0 + 0.10, T, VC - 0.36); bath.add(sp);
    add(sp, kit.cyl(0.035, 0.035, 0.13, 24), greenGlass, [0, 0.065, 0]); add(sp, kit.cyl(0.012, 0.012, 0.05), brass, [0, 0.15, 0]); add(sp, kit.box(0.05, 0.012, 0.015), brass, [0.015, 0.175, 0]);
    dyn.push([sp, { mass: 0.35 }]);
    const tw = add(bath, kit.rbox(0.30, 0.10, 0.12, 0.045), towel, [BX0 + 0.25, T + 0.05, VZ0 + 0.20], [0, 0, 0]); dyn.push([tw, { mass: 0.3 }]);
  }
  // shaggy grey bath mat
  add(bath, kit.cushion(0.58, 0.03, 0.88, 0.012, 0.008), matMat, [VX1 + 0.40, Y + 0.012, VC + 0.12], [0, 0, 0], { shadow: false });
  // toilet out of frame (by the window wall near the door)
  {
    const tg = kit.group(bath, [7.55, Y, BZ0], 0, 'toiletC');
    add(tg, kit.rbox(0.40, 0.36, 0.17, 0.03), porcelain, [0, 0.62, 0.10]);
    add(tg, kit.lathe([[0.0, 0.0], [0.13, 0.0], [0.14, 0.2], [0.18, 0.38], [0.0, 0.38]], 32), porcelain, [0, 0, 0.45]);
    add(tg, kit.rbox(0.38, 0.03, 0.46, 0.02), porcelain, [0, 0.40, 0.40]);
    phys.solidGroup(tg);
  }

  // ---------------------------------------------------------------- physics + merge
  for (const [m, o] of dyn) phys.dynamic(m, { shape: 'box', friction: 0.8, ...o });
  kit.mergeStatic(root);
  const tints = new Map([[pink, new THREE.Color(0.80, 0.93, 0.97)], [pinkSham, new THREE.Color(0.80, 0.93, 0.97)], [wallpaper, new THREE.Color(0.96, 1.0, 1.0)]]);
  root.traverse(o => {
    const t = o.isMesh && tints.get(o.material); if (!t) return; let saved = null;
    o.onBeforeRender = (r, s, c, g, mat) => { if (r.getRenderTarget()?.isWebGLCubeRenderTarget && mat.color) { saved = mat.color.clone(); mat.color.multiply(t); } };
    o.onAfterRender = (r, s, c, g, mat) => { if (saved) { mat.color.copy(saved); saved = null; } };
  });
}
