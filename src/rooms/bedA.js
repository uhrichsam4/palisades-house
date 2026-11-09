// Piece: bedA — Bedroom A (front, over garage) + hall bath A
// Owned rooms: bedA, bathA | Reference photos: p24, p25, p26
//
// Bedroom A (p24): front-gable vault (ridge runs front-to-back, along z, at the room centre line),
// charcoal woven wallpaper on the NE wall (x = 15.60) behind a tall channel-tufted oatmeal bed on a
// tall upholstered base, fluted white-oak nightstands with black glossy lamps, wide 3-lite window on
// the street wall (z = 0.65) under a relaxed linen roman shade, walnut sling chair with a chunky knit
// throw, framed horse etching, oatmeal tonal rug, white 3-blade fan. Warm window key + contact shadows.
// Bath A (p25, p26): rift-oak vanity with a mitred white quartz top along the SW wall, big oak-framed
// mirror (real planar reflection, room-culled) with a nickel picture light, grey concrete-look tile,
// vein-cut travertine shower open to the door passage behind a fixed glass panel.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const piece = { rooms: ["bedA", "bathA"], photos: ["p24", "p25", "p26"] };
export const ownCeiling = ['bedA'];
export const views = {
  // level cameras (real-estate photos keep verticals straight)
  p24: { pos: [11.89, 4.40, 5.39], look: [13.78, 4.243, 3.06], fov: 65 }, // 0.3 m closer, ~3 deg down
  p25: { pos: [17.05, 4.66, 2.55], look: [15.70, 4.58, 1.10], fov: 72 },  /* stepped into the room: from z 3.12 the stub-end waffle towel filled the top-left */
  p26: { pos: [17.28, 4.50, 3.68], look: [15.51, 4.64, 3.50], fov: 72 },  // 0.3 m back, slight tilt up
};

const std = (o) => new THREE.MeshStandardMaterial(o);
const physMat = (o) => new THREE.MeshPhysicalMaterial(o);
// kit.fabric colour maps average ~0.78 (sRGB) — lift the tint so the woven fabric lands on the photo's colour
const lift = (hex, k = 1.5) => new THREE.Color(hex).multiplyScalar(k);

// ------------------------------------------------------------------ procedural textures
function wallpaperTex(kit) { // charcoal woven / chevron grasscloth-like paper, 0.6 m repeat
  const r = kit.rng(24);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#56514b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 80 + (r() - 0.5) * 22; g.fillStyle = `rgba(${v},${v - 2},${v - 5},0.5)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    const cell = 64; // chevron rows of short diagonal strokes
    for (let y = 0; y < h; y += cell / 2) for (let x = 0; x < w; x += cell) {
      const dir = ((y / (cell / 2)) % 2) ? 1 : -1; const v = 104 + r() * 18;
      g.strokeStyle = `rgba(${v},${v - 3},${v - 7},0.5)`; g.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) { const o = k * 4; g.beginPath(); g.moveTo(x + o, y + (dir > 0 ? 0 : cell / 2)); g.lineTo(x + o + cell / 2, y + (dir > 0 ? cell / 2 : 0)); g.stroke(); }
      const v2 = 66 + r() * 10; g.strokeStyle = `rgba(${v2},${v2 - 2},${v2 - 4},0.6)`;
      for (let k = 0; k < 8; k++) { const o = k * 4; g.beginPath(); g.moveTo(x + cell / 2 + o, y + (dir > 0 ? cell / 2 : 0)); g.lineTo(x + cell + o, y + (dir > 0 ? 0 : cell / 2)); g.stroke(); }
    }
  }, { repeat: [1 / 0.6, 1 / 0.6] });
}
function quartzTex(kit) { // white quartz with faint soft grey veining, 1 m square
  const r = kit.rng(61);
  return kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const v = 236 + (r() - 0.5) * 10; g.fillStyle = `rgba(${v},${v - 1},${v - 3},0.25)`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 90, 10 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.filter = 'blur(1.5px)';
    for (let i = 0; i < 14; i++) {
      let x = r() * w, y = r() * h, a = r() * Math.PI * 2; const n = 30 + r() * 60; const lw = 0.6 + r() * 2.2, al = 0.10 + r() * 0.22;
      g.strokeStyle = `rgba(150,150,152,${al})`; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); } g.stroke();
    }
    g.filter = 'none';
    for (let i = 0; i < 6000; i++) { const v = 200 + r() * 50; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(r() * w, r() * h, 1, 1); }
  });
}
function concreteTileTex(kit) { // grey concrete-look porcelain, 0.6 x 1.2 m tiles; texture = 1.2 m square
  const r = kit.rng(9);
  return kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6e6b66'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) { const v = 110 + (r() - 0.5) * 26; g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.14)`; g.beginPath(); g.ellipse(r() * w, r() * h, 12 + r() * 70, 8 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 16000; i++) { const v = 110 + (r() - 0.5) * 60; g.fillStyle = `rgba(${v},${v},${v - 3},0.22)`; g.fillRect(r() * w, r() * h, 1 + r(), 1 + r()); }
    for (let t = 0; t < 2; t++) { const v = 106 + (r() - 0.5) * 10; g.fillStyle = `rgba(${v},${v - 1},${v - 4},0.18)`; g.fillRect(t * w / 2, 0, w / 2, h); }
    g.fillStyle = '#4c4a47'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2 - 1, 0, 2, h);
  }, { repeat: [1 / 1.2, 1 / 1.2] });
}
function rugTex(kit) { // hand-knotted ivory rug with taupe / grey tonal dashes in staggered rows (p24); 3.4 x 4.0 m
  const r = kit.rng(31);
  return kit.canvasTex(1020, 1200, (g, w, h) => {
    g.fillStyle = '#e2dccf'; g.fillRect(0, 0, w, h);
    const cols = ['rgba(176,162,142,0.55)', 'rgba(150,148,142,0.45)', 'rgba(196,184,166,0.55)', 'rgba(232,228,218,0.7)', 'rgba(162,146,124,0.45)'];
    g.filter = 'blur(1.2px)';
    for (let y = 24; y < h - 24; y += 16 + r() * 14) { // rows of short dashes along u
      let x = 20 + r() * 60;
      while (x < w - 30) { const len = 30 + r() * 110, bh = 7 + r() * 10; if (r() < 0.55) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, y, Math.min(len, w - 20 - x), bh); } x += len + 8 + r() * 70; }
    }
    g.filter = 'none';
    for (let i = 0; i < 90000; i++) { const v = 214 + (r() - 0.5) * 50; g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.28)`; g.fillRect(r() * w, r() * h, 2, 1 + r()); }
    g.strokeStyle = 'rgba(190,180,164,0.8)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); // bound edge
  });
}
function fringeTex(kit) { // alpha fringe strands
  const r = kit.rng(5);
  return kit.canvasTex(512, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2.2 + r() * 1.2) { const v = 220 + r() * 25; g.strokeStyle = `rgb(${v},${v - 4},${v - 12})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 3, h * (0.75 + r() * 0.25)); g.stroke(); }
  });
}
function travertineTex(kit, seed = 13) { /* warm beige vein-cut travertine (p26): soft tonal bands, fine vertical grain, sparse pores; 1.2 m x 2.8 m slab */
  const r = kit.rng(seed);
  const draw = (bump) => (g, w, h) => {
    const rr = kit.rng(seed); /* same layout for colour + bump */
    g.fillStyle = bump ? '#808080' : '#d9c3a5'; g.fillRect(0, 0, w, h);
    /* soft horizontal banding (sediment layers): wide, low-contrast, blurred */
    g.filter = 'blur(10px)';
    for (let i = 0; i < 22; i++) { const y = rr() * h, bh = 10 + rr() * 70, lt = rr() < 0.5; g.fillStyle = bump ? 'rgba(128,128,128,0)' : (lt ? `rgba(236,220,196,${0.18 + rr() * 0.2})` : `rgba(184,156,122,${0.12 + rr() * 0.18})`); g.fillRect(0, y, w, bh); }
    /* broad vertical cloudy streaks */
    for (let i = 0; i < 12; i++) { const x = rr() * w, bw = 14 + rr() * 60; g.fillStyle = bump ? 'rgba(128,128,128,0)' : (rr() < 0.5 ? 'rgba(232,214,188,0.22)' : 'rgba(176,148,114,0.16)'); g.fillRect(x, 0, bw, h); }
    g.filter = 'none';
    for (let i = 0; i < 900; i++) { /* fine vertical grain, low contrast */
      const x = rr() * w, y = rr() * h, len = 60 + rr() * 600, lw = 0.4 + rr() * 1.1, dk = rr() < 0.55, a = 0.04 + rr() * 0.10;
      g.strokeStyle = bump ? (dk ? `rgba(100,100,100,${a})` : `rgba(150,150,150,${a})`) : (dk ? `rgba(${168 + rr() * 20},${138 + rr() * 16},${104 + rr() * 14},${a})` : `rgba(242,230,212,${a})`);
      g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 2, y + len); g.stroke();
      if (y + len > h) { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + (rr() - 0.5) * 2, y - h + len); g.stroke(); }
    }
    for (let i = 0; i < 220; i++) { /* sparse small pores, slightly elongated */
      const x = rr() * w, y = rr() * h, rl = 0.8 + rr() * 2.6, rw = 0.5 + rr() * 1.0;
      g.fillStyle = bump ? `rgba(40,40,40,${0.35 + rr() * 0.4})` : `rgba(${150 + rr() * 20},${122 + rr() * 16},${92 + rr() * 14},${0.25 + rr() * 0.35})`;
      g.beginPath(); g.ellipse(x, y, rw, rl, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = bump ? '#4a4a4a' : 'rgba(170,146,116,0.6)'; g.fillRect(0, 0, 1.5, h); /* slab joint at u = 0 */
  };
  void r;
  const map = kit.canvasTex(600, 1400, draw(false));
  const bump = kit.canvasTex(600, 1400, draw(true), { srgb: false });
  return { map, bump };
}
function waffleBumpTex(kit) { // deep waffle cells (~2.2 cm) for the bath towel: one tile = 8 x 8 cells
  return kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h); const c = w / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const gr = g.createRadialGradient(i * c + c / 2, j * c + c / 2, 1, i * c + c / 2, j * c + c / 2, c * 0.5); gr.addColorStop(0, '#202020'); gr.addColorStop(0.75, '#5a5a5a'); gr.addColorStop(1, '#d0d0d0'); g.fillStyle = gr; g.fillRect(i * c + 3, j * c + 3, c - 6, c - 6); }
  }, { srgb: false });
}
function etchingTex(kit) { // framed horse etching: sepia/grey engraved lines on a dark parchment ground (recreated)
  const r = kit.rng(77);
  return kit.canvasTex(1024, 744, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#4a4136'); gr.addColorStop(1, '#2b2620'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) { const v = 60 + r() * 50; g.fillStyle = `rgba(${v},${v - 6},${v - 14},${r() * 0.18})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    // engraved double border with a meander band
    g.strokeStyle = 'rgba(196,178,146,0.55)'; g.lineWidth = 2; g.strokeRect(40, 40, w - 80, h - 80); g.strokeRect(62, 62, w - 124, h - 124);
    g.lineWidth = 1.4; for (let x = 70; x < w - 80; x += 22) { g.beginPath(); g.moveTo(x, 58); g.lineTo(x, 46); g.lineTo(x + 14, 46); g.lineTo(x + 14, 54); g.stroke(); g.beginPath(); g.moveTo(x, h - 58); g.lineTo(x, h - 46); g.lineTo(x + 14, h - 46); g.lineTo(x + 14, h - 54); g.stroke(); }
    // scattered stars / dots in the field
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(206,188,150,${0.25 + r() * 0.4})`; g.beginPath(); g.arc(80 + r() * (w - 160), 80 + r() * (h - 160), 1 + r() * 2.2, 0, Math.PI * 2); g.fill(); }
    // galloping horse: silhouette path, filled with fine engraved hatching (clip) + contour lines
    g.save(); g.translate(w * 0.47, h * 0.56); g.scale(1.7, 1.7);
    const horse = new Path2D('M-150,-10 C-160,-40 -120,-62 -70,-58 C-20,-54 40,-60 80,-70 C100,-95 118,-120 140,-130 C150,-140 168,-142 176,-132 L200,-112 C206,-104 198,-98 188,-102 L168,-108 C160,-90 150,-70 130,-40 C122,-20 110,-6 96,0 L118,40 L150,62 L146,70 L110,52 L84,14 C40,22 -20,22 -70,14 L-110,48 L-150,64 L-154,56 L-120,36 L-112,6 C-130,0 -146,-2 -150,-10 Z M-150,-20 C-190,-30 -210,-10 -230,20 L-222,24 C-206,2 -186,-14 -150,-10 Z');
    g.clip(horse);
    g.fillStyle = 'rgba(150,132,104,0.35)'; g.fillRect(-260, -160, 520, 260);
    g.strokeStyle = 'rgba(214,196,160,0.75)'; g.lineWidth = 1.1;
    for (let k = -420; k < 420; k += 5) { g.beginPath(); g.moveTo(k, -170); g.lineTo(k + 140, 110); g.stroke(); }
    g.strokeStyle = 'rgba(40,34,28,0.55)'; for (let k = -420; k < 420; k += 9) { g.beginPath(); g.moveTo(k, 110); g.lineTo(k + 60, -170); g.stroke(); }
    g.restore();
    g.save(); g.translate(w * 0.47, h * 0.56); g.scale(1.7, 1.7);
    g.strokeStyle = 'rgba(222,204,168,0.85)'; g.lineWidth = 2; g.stroke(horse);
    g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(132 - i * 6, -118 + i * 9); g.quadraticCurveTo(110 - i * 7, -112 + i * 8, 100 - i * 8, -96 + i * 9); g.stroke(); } // mane
    g.restore();
    g.fillStyle = 'rgba(196,178,146,0.5)'; g.font = '16px serif'; g.textAlign = 'center'; g.fillText('EQVVS  ·  MDCCLX', w / 2, h - 84);
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(20,16,12,${r() * 0.3})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  });
}
function vaultGlowTex(kit) { // soft gradient: bright at the wall plate, dimmer toward the ridge (uv v = metres up the slope)
  return kit.canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#b8b4ae'); gr.addColorStop(1, '#8d8984');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1 / 2.6] });
}
// Contact-shadow quad: footprint w (x) by d (z) centred at the origin, dark inside (alpha a0), smooth falloff
// over a band `s` outside the footprint. Vertex alpha (no texture) so the shadow edge stays soft at any size.
function aoGeo(w, d, s, a0 = 1, n = 7) {
  const ax = (half) => { const v = []; for (let k = n; k >= 1; k--) v.push(-half - s * k / n); v.push(-half, -half * 0.5, 0, half * 0.5, half); for (let k = 1; k <= n; k++) v.push(half + s * k / n); return v; };
  const xs = ax(w / 2), zs = ax(d / 2); const pos = [], col = [], idx = [];
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
    const ox = Math.max(0, Math.abs(xs[i]) - w / 2), oz = Math.max(0, Math.abs(zs[j]) - d / 2); const t = Math.min(1, Math.hypot(ox, oz) / s);
    pos.push(xs[i], 0, zs[j]); col.push(0, 0, 0, a0 * Math.pow(1 - t, 2.2));
  }
  const NX = xs.length; for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i; idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
}
// Vertical gradient quad (overhang shadow on cabinet faces): w x h in the XY plane, alpha aTop at the top -> 0 at the bottom
function shadeGeo(w, h, aTop, n = 8) {
  const pos = [], col = [], idx = [];
  for (let j = 0; j <= n; j++) { const t = j / n; for (const x of [-w / 2, w / 2]) { pos.push(x, h / 2 - t * h, 0); col.push(0, 0, 0, aTop * Math.pow(1 - t, 1.8)); } }
  for (let j = 0; j < n; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
}
// Neutral paint overlay on a wall, with holes for every level-1 opening on that wall line.
// axis 'x': wall runs along x at z = c; 'z': wall runs along z at x = c. n = +-1 into the room. UVs in metres (u, y).
function paintOverlay(plan, axis, c, u0, u1, y0, y1, n, off = 0.003) {
  const holes = plan.OPENINGS.filter(o => o.level === 1 && Math.abs((axis === 'x' ? o.at[1] : o.at[0]) - c) < 0.42)
    .map(o => { const u = axis === 'x' ? o.at[0] : o.at[1]; return [u - o.w / 2, u + o.w / 2, y0 + o.sill, y0 + o.head]; })
    .filter(hh => hh[1] > u0 && hh[0] < u1);
  const cuts = [u0, u1]; for (const hh of holes) cuts.push(Math.max(u0, hh[0]), Math.min(u1, hh[1]));
  const us = [...new Set(cuts)].sort((p, q) => p - q); const pos = [], uv = [];
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1]; if (b - a < 1e-4) continue; const m = (a + b) / 2;
    let spans = [[y0, y1]];
    for (const hh of holes) if (hh[0] <= m && hh[1] >= m) spans = spans.flatMap(([p, q]) => [[p, Math.min(q, hh[2])], [Math.max(p, hh[3]), q]]).filter(([p, q]) => q - p > 1e-4);
    for (const [p, q] of spans) for (const [U, V] of [[a, p], [b, p], [b, q], [a, p], [b, q], [a, q]]) {
      if (axis === 'x') pos.push(U, V, c + n * off); else pos.push(c + n * off, V, U); uv.push(U, V);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); const want = axis === 'x' ? [0, 0, n] : [n, 0, 0]; const nr = g.attributes.normal;
  if (nr.count && nr.getX(0) * want[0] + nr.getZ(0) * want[2] < 0) { // flip winding so the front face looks into the room
    const P = g.attributes.position.array, T = g.attributes.uv.array;
    for (let t = 0; t < P.length / 9; t++) { for (let k = 0; k < 3; k++) { const i = t * 9 + 3 + k, j = t * 9 + 6 + k; [P[i], P[j]] = [P[j], P[i]]; } for (let k = 0; k < 2; k++) { const i = t * 6 + 2 + k, j = t * 6 + 4 + k; [T[i], T[j]] = [T[j], T[i]]; } }
    g.computeVertexNormals();
  }
  return g;
}

// ------------------------------------------------------------------ geometry helpers
// Fabric draped over a box top (bed throw / duvet), in local bed coords: top spans x∈[-W/2,W/2],
// z∈[z0,z1] at height `top`; hangs `side` over both long edges and `foot` over the z1 edge.
// crk = crinkle amplitude (crinkled linen / gauze), UVs in metres.
function drape(W, z0, z1, top, side, foot, r = 0.035, wr = 0.006, seed = 1, seg = [48, 64], crk = 0) {
  const geo = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]); const p = geo.attributes.position, uv = geo.attributes.uv;
  const fold = (d) => { if (d <= 0) return [d, 0]; const arc = r * Math.PI / 2; if (d < arc) { const t = d / r; return [r * Math.sin(t), r - r * Math.cos(t)]; } return [r, r + (d - arc)]; };
  const Wt = W + 2 * side, Lt = (z1 - z0) + foot;
  for (let i = 0; i < p.count; i++) {
    const s = uv.getX(i), t = 1 - uv.getY(i);
    const u = (s - 0.5) * Wt, v = z0 + t * Lt;
    const [ox, dx] = fold(Math.abs(u) - W / 2); const [oz, dz] = fold(v - z1);
    let x = Math.abs(u) > W / 2 ? Math.sign(u) * (W / 2 + ox) : u; let z = v > z1 ? z1 + oz : v; let y = top - dx - dz;
    let n = Math.sin(u * 9 + seed) * Math.sin(v * 5.3 + seed * 2) + 0.5 * Math.sin(u * 23 + v * 3 + seed);
    const c = crk * (Math.sin(u * 61 + v * 13 + seed) * Math.sin(v * 47 - u * 7) + 0.6 * Math.sin(u * 37 - v * 53 + seed * 3) + 0.4 * Math.sin(u * 113 + v * 97));
    if (dx === 0 && dz === 0) y += wr * n + c; else { const k = (wr * 1.8 * n + c * 1.5) * Math.min(1, (dx + dz) / 0.1); if (dx > 0) x += Math.sign(u) * k; if (dz > 0) z += k; }
    if (dx > 0 && dz > 0) y += Math.min(dx, dz) * 0.7; // corner: don't double the drop (no dangling strand)
    // corner sag: where both edges hang, the cloth drops lower and swings out
    p.setXYZ(i, x, y, z); uv.setXY(i, u, v);
  }
  geo.computeVertexNormals(); return geo;
}
// reeded (fluted) panel: vertical half-round reeds across width w, height h, facing +z, origin bottom-left
function reeds(w, h, pitch = 0.016) {
  const n = Math.floor(w / pitch); const geos = []; const rr = pitch * 0.5;
  for (let i = 0; i < n; i++) { const c = new THREE.CylinderGeometry(rr, rr, h, 8, 1, true, -Math.PI / 2, Math.PI); c.scale(1, 1, 0.55); c.translate((i + 0.5) * (w / n), h / 2, 0); geos.push(c); }
  return geos;
}
// Plump pillow: subdivided box, thickness falls off toward the edges, corners pulled in (w along x, h along y, t thickness z)
function pillowGeo(w, h, t, seed = 1) {
  const g = new THREE.BoxGeometry(w, h, t, 24, 24, 3); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = x / (w / 2), v = y / (h / 2);
    const f = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), 0.55);
    z = z * (0.08 + 0.92 * f) + 0.004 * Math.sin(u * 7 + seed) * Math.sin(v * 5 + seed) * f;
    x *= 1 - 0.05 * (1 - v * v); y *= 1 - 0.05 * (1 - u * u); // edges cave in between the corners
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
// Towel folded over a round bar/hook along local x: back panel lenB, front panel lenF (toward +z),
// soft flare + bottom curl, thickness t. Origin = bar centre. UVs in metres.
function towelGeo(width, lenF, lenB, rBar = 0.012, t = 0.008, seed = 1) {
  const R = rBar + t / 2; const mid = [];
  for (let k = 0; k <= 10; k++) { const y = -lenB + (lenB * k) / 10; mid.push([-R - 0.012 * Math.pow(1 - k / 10, 2), y]); }
  for (let k = 1; k < 12; k++) { const a = Math.PI - (Math.PI * k) / 12; mid.push([R * Math.cos(a), R * Math.sin(a)]); }
  for (let k = 0; k <= 14; k++) { const y = -(lenF * k) / 14; mid.push([R + 0.022 * Math.pow(k / 14, 2), y]); }
  const end = mid[mid.length - 1]; // bottom curl outward
  for (let k = 1; k <= 5; k++) { const a = (Math.PI / 2) * (k / 5); mid.push([end[0] + 0.018 * Math.sin(a), end[1] - 0.012 * (1 - Math.cos(a)) + 0.008 * Math.sin(a)]); }
  const outer = [], inner = [];
  for (let i = 0; i < mid.length; i++) {
    const a = mid[Math.max(0, i - 1)], b = mid[Math.min(mid.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L; outer.push(new THREE.Vector2(mid[i][0] + nx * t / 2, mid[i][1] + ny * t / 2)); inner.push(new THREE.Vector2(mid[i][0] - nx * t / 2, mid[i][1] - ny * t / 2));
  }
  const shape = new THREE.Shape([...outer, ...inner.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, steps: 24, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.max(0, -y); const k = Math.min(1, d / 0.25);
    p.setZ(i, p.getZ(i) + k * (0.007 * Math.sin((x / width) * Math.PI * 3 + seed) + 0.004 * Math.sin(x * 41 + seed * 2)));
    p.setX(i, x * (1 + 0.03 * k)); }
  g.computeVertexNormals(); return g;
}
// Relaxed roman shade: soft folds bulging toward +z, bottom fold smiling in the middle. Origin bottom-centre.
function romanShadeGeo(W, H, folds = 5) {
  const g = new THREE.PlaneGeometry(W, H, 60, 140); const p = g.attributes.position, uv = g.attributes.uv; const fh = H / folds;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); let y = p.getY(i) + H / 2; const u = x / (W / 2);
    const k = Math.floor(y / fh), f = (y - k * fh) / fh; const lower = 1 - k / folds;
    const bulge = (0.016 + 0.008 * lower) * Math.pow(Math.sin(Math.PI * f), 0.8) * (0.75 + 0.25 * (1 - u * u));
    const smile = 0.035 * (1 - u * u) * Math.max(0, 1 - y / (fh * 1.2));
    y -= smile * (1 - f * 0.3);
    p.setXYZ(i, x, y, bulge + 0.004 * Math.sin(x * 23 + k));
    uv.setXY(i, x, y);
  }
  g.computeVertexNormals(); return g;
}

export async function build(ctx) {
  const { kit, phys, root } = ctx; const M = kit.M; const F = kit.fabric;
  const BED = kit.roomInfo('bedA'), BATH = kit.roomInfo('bathA');
  const Y = BED.y; // 3.35
  const PLATE = ctx.plan.LEVELS[1].plate; // 6.10
  const RIDGE_Y = 7.06; // stays under the garage-wing roof plane (≈7.21 at the room centre line)

  // ---------------------------------------------------------------- materials
  const hbFab = F.linen(lift('#ddd1bc', 1.35), { scale: 3 });           // oatmeal linen headboard + base
  const baseFab = F.linen(lift('#e2d8c6', 1.45), { scale: 4 });
  const wpMap = wallpaperTex(kit);
  const wallpaper = std({ map: wpMap, bumpMap: wpMap, bumpScale: 1.2, roughness: 0.9 });
  const rugMat = physMat({ map: rugTex(kit), normalMap: kit.tex('assets/acg/Carpet016/Carpet016_NormalGL.jpg', { repeat: [11, 13] }), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 1, sheen: 0.3, sheenColor: new THREE.Color(0xd8d0c4), sheenRoughness: 0.85 });
  const duvet = F.linen(lift('#f6f4f0', 1.6), { scale: 3, side: THREE.DoubleSide });
  const throwMat = F.linen(lift('#bcab92', 1.35), { scale: 7, side: THREE.DoubleSide, normalScale: 1.6 });   // crinkled gauze linen
  const frayMat = F.linen(lift('#e4dccd', 1.4), { scale: 30, side: THREE.DoubleSide, normalScale: 2 });      // pale frayed hem
  const shamMat = F.cotton(lift('#d8ccb6', 1.25), { scale: 4, normalScale: 1.7 });                            // waffle shams
  const pillowWhite = F.cotton(lift('#f7f6f2', 1.6), { scale: 2, normalScale: 0.3 });
  const oakNight = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.2, 1.2] }), color: new THREE.Color(1.32, 0.98, 0.6), roughness: 0.48, normalScale: new THREE.Vector2(0.3, 0.3) }); // honey rift oak
  const oakLight = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: new THREE.Color(1.75, 1.5, 1.22), roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) });
  const oakFrame = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: new THREE.Color(2.3, 1.95, 1.55), roughness: 0.6, normalScale: new THREE.Vector2(0.3, 0.3) });
  const walnut = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [2, 2] }), color: 0x8a5f3e, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) });
  const darkWood = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [2, 2] }), color: 0x4a3626, roughness: 0.45, normalScale: new THREE.Vector2(0.3, 0.3) });
  const chairCushion = F.linen(lift('#9d9b95', 1.3), { scale: 3 });
  const knit = F.knit(lift('#f4f2ed', 1.5), { scale: 6 });
  const blackGloss = physMat({ color: 0x07080b, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }); // glossy black ceramic
  const shadeMat = std({ color: 0xf8f6f1, emissive: 0xffeedb, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide });
  const linenShade = F.linen(lift('#d8ccb8', 1.45), { scale: 5, side: THREE.DoubleSide });
  const fanWhite = std({ color: 0xf4f3f0, roughness: 0.5 });
  const quartzMap = quartzTex(kit);
  const quartz = std({ map: quartzMap, roughness: 0.28, envMapIntensity: 0.55, emissive: 0xffffff, emissiveMap: quartzMap, emissiveIntensity: 0.32 });
  const nickel = physMat({ color: 0xc8c6c2, metalness: 1, roughness: 0.35 });
  const polNickel = physMat({ color: 0xd9dadb, metalness: 1, roughness: 0.15 });
  const champagne = physMat({ color: 0xd2c4aa, metalness: 1, roughness: 0.38, envMapIntensity: 0.55 }); // (no anisotropy: lathe/tube tangents spike into bloom) // warm brushed nickel (shower trim)
  const opal = std({ color: 0xffffff, emissive: 0xfff4e4, emissiveIntensity: 1.7, roughness: 0.4 });
  // contact shadows (soft vertex-alpha quads): footprint w x d, falloff band s, peak darkness op
  const aoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  const ao = (parent, cx, cz, w, d, op, y, ry = 0, s = 0.22) => { const m = kit.add(parent, aoGeo(w, d, s, op), aoMat, [cx, y, cz], [0, ry, 0], { shadow: false }); m.receiveShadow = false; m.renderOrder = 2; return m; };
  // neutral warm-white paint (#EEEBE6-ish on screen): counters the warm cast the global grade puts on paintWhite
  const paintN = M.paintWhite.clone(); paintN.color = new THREE.Color(0xf4ebdf); /* warm cream (p24/p25): neutral 0xefeeea still rendered blue-grey in the bath */

  // ================================================================ BEDROOM A
  const bed = kit.group(root, [0, 0, 0], 0, 'bedA');
  // ---- vaulted ceiling (front-gable vault, ridge along z at the room centre): soft gradient, darker toward the ridge
  const vaultMat = M.ceilingWhite.clone(); vaultMat.color = new THREE.Color(0xf1f0ec); vaultMat.emissive = new THREE.Color(0xffffff); vaultMat.emissiveIntensity = 0.2; vaultMat.emissiveMap = vaultGlowTex(kit);
  const vault = kit.vault(bed, BED.rect, 'z', PLATE, RIDGE_Y, vaultMat, paintN, 0, true);
  // neutral paint over the three painted walls; the SW wall brightens toward the street window (daylight falloff)
  {
    const [x0, z0, x1, z1] = BED.rect;
    kit.add(bed, paintOverlay(ctx.plan, 'x', z0, x0, x1, Y, PLATE, 1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
    kit.add(bed, paintOverlay(ctx.plan, 'x', z1, x0, x1, Y, PLATE, -1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
    const sw = paintN.clone(); sw.emissive = new THREE.Color(0xffffff); sw.emissiveIntensity = 0.22;
    sw.emissiveMap = kit.canvasTex(256, 4, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#6a6a6a'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    sw.emissiveMap.wrapS = sw.emissiveMap.wrapT = THREE.ClampToEdgeWrapping; sw.emissiveMap.repeat.set(1 / (z1 - z0), 1); sw.emissiveMap.offset.set(-z0 / (z1 - z0), 0);
    kit.add(bed, paintOverlay(ctx.plan, 'z', x0, z0, z1, Y, PLATE, 1), sw, [0, 0, 0], [0, 0, 0], { shadow: false });
  }
  const ceilAt = vault.userData.heightAt;
  const xc = BED.cx; const slope = (RIDGE_Y - PLATE) / (BED.w / 2);
  // can lights on the slopes, oriented to the ceiling plane
  {
    const disc = new THREE.CircleGeometry(0.045, 24); disc.rotateX(Math.PI / 2);
    const ring = new THREE.RingGeometry(0.045, 0.062, 24); ring.rotateX(Math.PI / 2);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.4 });
    const trim = std({ color: 0xeceae5, roughness: 0.6 });
    for (const x of [12.45, 14.57]) for (const z of [1.55, 3.3, 5.05]) {
      const n = new THREE.Vector3(x < xc ? slope : -slope, -1, 0).normalize();
      const g = new THREE.Group(); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n);
      g.position.set(x, ceilAt(x, z), z).addScaledVector(n, 0.004); bed.add(g);
      g.add(new THREE.Mesh(disc, lit), new THREE.Mesh(ring, trim));
    }
  }
  // ---- ceiling fan (white, 3 blades) hung from the ridge
  {
    const fz = 2.65, top = RIDGE_Y; const fan = kit.group(bed, [xc, top, fz], 0, 'fan');
    kit.add(fan, kit.cyl(0.055, 0.07, 0.06), fanWhite, [0, -0.03, 0]); // canopy
    kit.add(fan, kit.cyl(0.012, 0.012, 0.92), fanWhite, [0, -0.50, 0]); // long downrod (vaulted ceiling)
    const rotor = kit.group(fan, [0, -0.98, 0], 0, 'fanRotor'); rotor.userData.keep = true;
    kit.add(rotor, kit.lathe([[0, 0.06], [0.09, 0.055], [0.115, 0.02], [0.11, -0.02], [0.07, -0.05], [0, -0.055]], 40), fanWhite, [0, 0, 0]);
    kit.add(rotor, kit.cyl(0.075, 0.075, 0.012, 40), std({ color: 0xffffff, emissive: 0xfff8ee, emissiveIntensity: 0.5 }), [0, -0.058, 0]);
    const blade = kit.extrude([[0.10, -0.035], [0.60, -0.058], [0.64, -0.044], [0.65, 0.0], [0.62, 0.048], [0.10, 0.03]], 0.008, 0.002);
    blade.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) { const b = kit.add(rotor, blade, fanWhite, [0, -0.005, 0], [0.18, (i * Math.PI * 2) / 3 + 0.4, 0]); b.rotation.order = 'YXZ'; }
    ctx.onUpdate((dt) => { rotor.rotation.y += dt * 1.8; });
  }
  // ---- accent wallpaper on the NE wall (x = 15.60)
  kit.wallPanel(bed, [BED.x1, BED.z0], [BED.x1, BED.z1], Y, PLATE, [-1, 0], wallpaper, 0.004);
  // ---- baseboards (skip the hall door on the SW wall)
  kit.baseboards(bed, BED.rect, Y, 0.10, 0.014, M.paintWhite, [{ side: 'x0', from: 4.76, to: 5.64 }]);

  // ---- bed: local frame faces +z (foot), headboard at z=0 against the wallpaper wall
  const bedZ = 3.22;
  const bedG = kit.group(bed, [BED.x1, Y, bedZ], -Math.PI / 2, 'bed');
  const W = 1.98, Lb = 2.16, B0 = 0.20, LEG = 0.035, BASE_TOP = 0.47, MT = 0.69; // MT = mattress top
  {
    // hidden feet set well in + tall upholstered box base sitting ~4 cm off the floor
    for (const sx of [-1, 1]) for (const z of [B0 + 0.30, B0 + Lb - 0.30]) kit.add(bedG, kit.cyl(0.03, 0.03, LEG + 0.01, 12), darkWood, [sx * (W / 2 - 0.30), (LEG + 0.01) / 2, z]);
    kit.add(bedG, kit.cushion(W, BASE_TOP - LEG, Lb, 0.055, 0.004, 6), baseFab, [0, LEG + (BASE_TOP - LEG) / 2, B0 + Lb / 2]);
    kit.add(bedG, kit.rbox(1.93, MT - BASE_TOP, Lb - 0.06, 0.07, 4), duvet, [0, (BASE_TOP + MT) / 2, B0 + 0.03 + (Lb - 0.06) / 2]); // mattress
    // headboard: 10 deep, plump vertical channels over a backing panel
    const HB_W = 2.04, HB_H = 1.52, CH0 = 0.40, nCh = 10, chW = HB_W / nCh;
    kit.add(bedG, kit.rbox(HB_W, HB_H, 0.08, 0.03), hbFab, [0, HB_H / 2, 0.04]);
    kit.add(bedG, kit.box(HB_W - 0.04, HB_H - CH0 - 0.02, 0.01), std({ color: 0x8d8475, roughness: 1 }), [0, CH0 + (HB_H - CH0) / 2, 0.085]); // dark seams between channels
    const ch = kit.cushion(chW - 0.005, 0.11, HB_H - CH0, 0.05, 0.035, 6); ch.rotateX(Math.PI / 2);
    for (let i = 0; i < nCh; i++) kit.add(bedG, ch, hbFab, [-HB_W / 2 + chW * (i + 0.5), CH0 + (HB_H - CH0) / 2, 0.135]);
    // white duvet + crinkled taupe linen throw folded over the foot (~0.8 m), draping over the sides
    kit.add(bedG, drape(1.95, 0.42, B0 + Lb + 0.01, MT + 0.012, 0.26, 0.22, 0.055, 0.008, 3, [64, 80]), duvet);
    const TZ0 = B0 + Lb - 1.15;
    const thr = drape(2.00, TZ0, B0 + Lb + 0.03, MT + 0.04, 0.27, 0.27, 0.07, 0.006, 7, [170, 150], 0.0042);
    kit.add(bedG, thr, throwMat);
    { // frayed hem: a soft pale cord along the hanging edges + short loose threads
      const p = thr.attributes.position, nx = 170, ny = 150, at = (ix, iy) => { const i = iy * (nx + 1) + ix; return new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); };
      const pts = []; for (let iy = 0; iy <= ny; iy += 2) pts.push(at(0, iy)); for (let ix = 2; ix <= nx; ix += 2) pts.push(at(ix, ny)); for (let iy = ny - 2; iy >= 0; iy -= 2) pts.push(at(nx, iy));
      kit.add(bedG, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.0045, 5, false), frayMat, [0, 0, 0], [0, 0, 0], { shadow: false });
      const fr = kit.rng(8); const thr2 = [];
      for (let k = 0; k < pts.length; k += 1) { const q = pts[k]; if (q.y > MT - 0.05) continue; const L = 0.008 + fr() * 0.018; const c = new THREE.CylinderGeometry(0.0012, 0.0012, L, 3); c.translate(q.x + (fr() - 0.5) * 0.004, q.y - L / 2, q.z + (fr() - 0.5) * 0.004); thr2.push(c); }
      if (thr2.length) kit.add(bedG, kit.mergeGeometries(thr2), frayMat, [0, 0, 0], [0, 0, 0], { shadow: false });
    }
    kit.add(bedG, kit.cushion(2.04, 0.04, 0.11, 0.02, 0.012), throwMat, [0, MT + 0.055, TZ0 + 0.03]); // folded top edge of the throw
    kit.add(bedG, kit.cushion(1.90, 0.05, 0.24, 0.025, 0.015), duvet, [0, MT + 0.035, 0.56]); // turned-down duvet edge
    phys.boxLocal(bedG, 0, 0.36, B0 + Lb / 2, W / 2, 0.36, Lb / 2);
    phys.boxLocal(bedG, 0, HB_H / 2, 0.08, HB_W / 2, HB_H / 2, 0.10);
  }
  // pillows (dynamic): two white sleepers leaning on the headboard, two waffle shams in front
  const dynamicBits = [];
  {
    const pillow = (w, h, t, mat, x, y, z, lean, yaw, seed) => {
      const m = kit.add(bedG, pillowGeo(w, h, t, seed), mat, [x, y, z], [-lean, yaw, 0]); m.rotation.order = 'YXZ'; dynamicBits.push(m); return m;
    };
    pillow(0.88, 0.50, 0.20, pillowWhite, -0.50, MT + 0.26, 0.32, 0.30, 0.04, 1);
    pillow(0.88, 0.50, 0.20, pillowWhite, 0.50, MT + 0.26, 0.32, 0.28, -0.05, 2);
    pillow(0.56, 0.56, 0.19, shamMat, -0.31, MT + 0.29, 0.55, 0.24, 0.10, 3);  // 55 cm waffle squares
    pillow(0.56, 0.56, 0.19, shamMat, 0.30, MT + 0.29, 0.57, 0.22, -0.08, 4);
  }

  // ---- fluted honey rift-oak 2-drawer chest + glossy black ceramic column lamp (local: faces +z, back at z=0)
  function nightstand(parent, pos, ry, W = 0.80, D = 0.46, H = 0.62) {
    const g = kit.group(parent, pos, ry, 'nightstand'); const P0 = 0.035; // recessed plinth height (hidden feet)
    kit.add(g, kit.rbox(W, H - P0, D, 0.045, 5), oakNight, [0, P0 + (H - P0) / 2, D / 2]); // body: rounded vertical corners
    kit.add(g, kit.box(W - 0.12, P0, D - 0.10), std({ color: 0x241b13, roughness: 0.9 }), [0, P0 / 2, D / 2 - 0.02]);
    const fx0 = -W / 2 + 0.045, fx1 = W / 2 - 0.045, fy0 = P0 + 0.03, fy1 = H - 0.04, fw = fx1 - fx0, gap = 0.005;
    kit.add(g, kit.box(fw, fy1 - fy0, 0.004), std({ color: 0x1e1610, roughness: 1 }), [0, (fy0 + fy1) / 2, D + 0.002]); // dark reveal
    const dh = (fy1 - fy0 - gap) / 2; const fronts = [];
    for (let k = 0; k < 2; k++) {
      const y0 = fy0 + k * (dh + gap);
      const back = new THREE.BoxGeometry(fw - 0.004, dh, 0.014); back.translate(0, y0 + dh / 2, D + 0.011); fronts.push(back);
      for (const r of reeds(fw - 0.004, dh, 0.013)) { r.translate(-fw / 2 + 0.002, y0, D + 0.018); fronts.push(r); }
    }
    kit.add(g, kit.mergeGeometries(fronts.map(f => f.index ? f.toNonIndexed() : f)), oakNight, [0, 0, 0]);
    // lamp: ~35 cm glossy black column with a waisted ring, brass neck, 40 x 28 cm white drum shade
    const lamp = kit.group(g, [0.06, H, D * 0.48], 0, 'lamp');
    kit.add(lamp, kit.lathe([[0, 0], [0.068, 0], [0.072, 0.008], [0.07, 0.03], [0.058, 0.06], [0.05, 0.13], [0.052, 0.15], [0.07, 0.158], [0.074, 0.17], [0.07, 0.182], [0.052, 0.19], [0.05, 0.2], [0.058, 0.27], [0.066, 0.32], [0.064, 0.335], [0.03, 0.345], [0.016, 0.35], [0, 0.351]], 48), blackGloss, [0, 0, 0]);
    kit.add(lamp, kit.cyl(0.011, 0.016, 0.03), M.brass, [0, 0.365, 0]);
    kit.add(lamp, kit.cyl(0.007, 0.007, 0.08), M.brass, [0, 0.41, 0]);
    kit.add(lamp, new THREE.CylinderGeometry(0.20, 0.20, 0.28, 48, 1, true), shadeMat, [0, 0.56, 0], [0, 0, 0], { shadow: false });
    kit.add(lamp, new THREE.CircleGeometry(0.195, 32).rotateX(Math.PI / 2), shadeMat, [0, 0.43, 0], [0, 0, 0], { shadow: false });
    phys.solidGroup(g);
    return g;
  }
  nightstand(bed, [BED.x1, Y, bedZ + 1.58], -Math.PI / 2, 0.90, 0.48, 0.60);
  nightstand(bed, [BED.x1, Y, bedZ - 1.44], -Math.PI / 2, 0.62, 0.42, 0.60);

  // ---- rug (~3.4 x 4.0 m) under the lower two-thirds of the bed and the lounge chair, fringed short ends
  const RUG = { cx: 13.27, cz: 3.05, w: 3.40, d: 4.00 };
  {
    const rug = kit.add(bed, kit.rbox(RUG.w, 0.012, RUG.d, 0.005), rugMat, [RUG.cx, Y + 0.006, RUG.cz]);
    rug.castShadow = false;
    const fm = std({ map: fringeTex(kit), alphaTest: 0.4, roughness: 1, side: THREE.DoubleSide, color: 0xf2eee6 });
    for (const s of [-1, 1]) { const f = kit.add(bed, new THREE.PlaneGeometry(RUG.w - 0.04, 0.06), fm, [RUG.cx, Y + 0.004, RUG.cz + s * (RUG.d / 2 + 0.028)], [-Math.PI / 2, 0, s > 0 ? 0 : Math.PI], { shadow: false }); f.receiveShadow = true; }
  }
  // ---- contact shadows: bed (on the rug), nightstands, chair, rug edge, wall crease
  ao(bed, BED.x1 - 1.18, bedZ, 2.36, 2.00, 0.8, Y + 0.0135, 0, 0.32);
  ao(bed, BED.x1 - 0.24, bedZ + 1.58, 0.48, 0.90, 0.7, Y + 0.002, 0, 0.16);
  ao(bed, BED.x1 - 0.21, bedZ - 1.44, 0.42, 0.62, 0.7, Y + 0.002, 0, 0.16);
  ao(bed, RUG.cx, RUG.cz, RUG.w, RUG.d, 0.35, Y + 0.0015, 0, 0.05);
  ao(bed, BED.x1 - 0.01, BED.cz, 0.02, BED.d, 0.25, Y + 0.0145, 0, 0.14);
  // ---- window: relaxed linen roman shade (outside mount) on the wide 3-lite street window
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bA-front'); const wx = o.at[0], ww = o.w + 0.14;
    const top = Y + o.head + 0.22, bottom = Y + 1.86; const zf = BED.z0 + 0.05;
    const shade = kit.group(bed, [wx, 0, zf], 0, 'romanShade');
    kit.add(shade, kit.rbox(ww + 0.02, 0.06, 0.07, 0.012), linenShade, [0, top - 0.03, 0.005]); // head rail
    const sm = kit.add(shade, romanShadeGeo(ww, top - 0.06 - bottom, 6), linenShade, [0, bottom, 0.0]);
    sm.castShadow = true;
    // bottom hem roll (follows the centre smile a little)
    const hem = kit.tube([[-ww / 2, bottom + 0.012, 0.025], [0, bottom - 0.02, 0.04], [ww / 2, bottom + 0.012, 0.025]], 0.014, 40);
    kit.add(shade, hem, linenShade);
  }
  // ---- over-exposed daylight seen through the street window (photo: near white, faint pink / green)
  // photo shots only: in walk mode it hid the real street view and glowed from outside day and night
  if (ctx.shot) {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bA-front'); const r = kit.rng(4);
    const hz = kit.canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f6f5f2'; g.fillRect(0, 0, w, h); g.filter = 'blur(8px)'; for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.6 ? 'rgba(160,190,150,0.22)' : 'rgba(220,170,170,0.2)'; g.beginPath(); g.ellipse(r() * w, h * (0.35 + r() * 0.65), 8 + r() * 30, 6 + r() * 20, 0, 0, Math.PI * 2); g.fill(); } });
    const m = kit.add(bed, new THREE.PlaneGeometry(o.w - 0.04, o.head - o.sill - 0.04), std({ color: 0xffffff, map: hz, emissive: 0xffffff, emissiveMap: hz, emissiveIntensity: 1.25, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }), [o.at[0], Y + (o.sill + o.head) / 2, BED.z0 - 0.25], [0, 0, 0], { shadow: false });
    m.renderOrder = 1;
    /* only for this room's own photo views: from the street shots (p00/p01) it read as a glowing blob in the window */
    const v = ctx.params?.get?.('view'); if (v && !piece.photos.includes(v)) m.visible = false;
  }
  // ---- framed horse etching on the street wall, left of the window
  {
    const art = kit.group(bed, [11.94, Y + 1.66, BED.z0], 0, 'art');
    const AW = 0.82, AH = 0.60, fw = 0.035;
    for (const [w, h, x, y] of [[AW, fw, 0, AH / 2 - fw / 2], [AW, fw, 0, -AH / 2 + fw / 2], [fw, AH - 2 * fw, -AW / 2 + fw / 2, 0], [fw, AH - 2 * fw, AW / 2 - fw / 2, 0]]) kit.add(art, kit.rbox(w, h, 0.035, 0.006), darkWood, [x, y, 0.0175]);
    kit.add(art, new THREE.PlaneGeometry(AW - 2 * fw, AH - 2 * fw), std({ map: etchingTex(kit), roughness: 0.9, envMapIntensity: 0.3 }), [0, 0, 0.008]);
  }
  // ---- walnut sling chair (light grey cushions) with a chunky white knit throw over the wall-side arm + seat
  {
    const ch = kit.group(bed, [11.88, Y, 1.30], 0.42, 'loungeChair');
    const CW = 0.70, D = 0.74;
    for (const sx of [-1, 1]) {
      const x = sx * (CW / 2 - 0.03);
      kit.add(ch, kit.tube([[x, 0, 0.30], [x, 0.30, 0.34], [x, 0.58, 0.36]], 0.019, 12), walnut); // front leg -> arm post
      kit.add(ch, kit.tube([[x, 0, -0.33], [x, 0.30, -0.30], [x, 0.80, -0.42]], 0.019, 12), walnut); // back leg -> back post
      kit.add(ch, kit.rbox(0.06, 0.032, D - 0.04, 0.013), walnut, [x, 0.59, 0.02], [-0.04, 0, 0]); // flat arm
      kit.add(ch, kit.rbox(0.03, 0.035, D - 0.1, 0.01), walnut, [x, 0.16, 0.0]); // side stretcher
    }
    kit.add(ch, kit.rbox(CW - 0.04, 0.035, 0.035, 0.01), walnut, [0, 0.30, 0.31]);
    kit.add(ch, kit.rbox(CW - 0.04, 0.035, 0.035, 0.01), walnut, [0, 0.30, -0.28]);
    kit.add(ch, kit.cushion(CW - 0.10, 0.11, D - 0.14, 0.045, 0.025, 6), chairCushion, [0, 0.34, 0.02], [-0.10, 0, 0]);
    kit.add(ch, kit.cushion(CW - 0.10, 0.09, 0.50, 0.04, 0.025, 6), chairCushion, [0, 0.60, -0.33], [-1.05, 0, 0]);
    // chunky knit: rows of twisted double strands following the drape over the seat and the -x arm
    const strands = [];
    for (let row = 0; row < 10; row++) {
      const z = -0.22 + row * 0.052; const zl = z + 0.01 * Math.sin(row * 1.7);
      const path = [[0.12, 0.43, zl], [-0.12, 0.445, zl], [-0.26, 0.47, zl], [-0.32, 0.625, zl], [-0.37, 0.63, zl], [-0.405, 0.52, zl], [-0.42, 0.34 + 0.03 * Math.sin(row), zl + 0.01]];
      const curve = new THREE.CatmullRomCurve3(path.map(q => new THREE.Vector3(...q)));
      for (const ph of [0, Math.PI]) {
        const pts = []; const N = 70;
        for (let k = 0; k <= N; k++) { const t = k / N; const q = curve.getPoint(t); const a = t * Math.PI * 2 * 9 + ph; pts.push(new THREE.Vector3(q.x, q.y + 0.011 * Math.sin(a) + 0.012, q.z + 0.014 * Math.cos(a))); }
        strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.019, 7, false));
      }
    }
    kit.add(ch, kit.mergeGeometries(strands), knit);
    phys.solidGroup(ch);
    ao(bed, 11.88, 1.30, 0.66, 0.70, 0.45, Y + 0.0135, 0.42, 0.2);
  }
  // ---- warm daylight key through the street window (non-shadow spot, 1 of 2 lights)
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bA-front');
    /* source just inside the glass, past the roman shade: from outside it blasted the shade into a glowing blob seen from
       the street; intensity/cone rescaled (inverse square, same footprint) so the room is lit as before */
    const key = new THREE.SpotLight(0xfff3e8, 43, 11, 0.78, 0.9, 2); key.castShadow = false;
    key.position.set(o.at[0] - 0.3, Y + o.head + 0.1, BED.z0 + 0.35); key.target.position.set(o.at[0] + 0.9, Y + 0.4, BED.z0 + 3.4);
    bed.add(key, key.target);
  }

  // ================================================================ BATH A
  const bath = kit.group(root, [0, 0, 0], 0, 'bathA');
  const BY = BATH.y;
  const tileMat = std({ map: concreteTileTex(kit), normalMap: kit.noiseNormal(256, 1.2, 24, 4), normalScale: new THREE.Vector2(0.2, 0.2), roughness: 0.6 });
  const tileBase = std({ color: 0x6e6b66, roughness: 0.6, normalMap: kit.noiseNormal(128, 1, 16, 5), normalScale: new THREE.Vector2(0.2, 0.2) });
  // vein-cut travertine (procedural): pale greige, fine straight vertical striations, small dark pores; 1.2 m wide slabs floor to ceiling
  const TRV = travertineTex(kit, 13);
  const trvMat = (ox, oy) => {
    const map = TRV.map.clone(); map.repeat.set(1 / 1.2, 1 / 2.8); map.offset.set(ox, oy); map.needsUpdate = true;
    const bump = TRV.bump.clone(); bump.repeat.set(1 / 1.2, 1 / 2.8); bump.offset.set(ox, oy); bump.needsUpdate = true;
    return physMat({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.35, color: 0xfff6ea });
  };
  const trvA = trvMat(0.0, 0.1), trvB = trvMat(0.37, 0.55), trvC = trvMat(0.71, 0.22); // offsets keep slab joints off the corners' twins
  const towelTaupe = F.cotton(lift('#9c9284', 1.7), { scale: 9, side: THREE.DoubleSide });
  const towelStack = F.cotton(lift('#b4a898', 1.7), { scale: 4 });
  const towelLight = physMat({ color: new THREE.Color(0xc3b6a3), bumpMap: waffleBumpTex(kit), bumpScale: 6, roughness: 0.95, sheen: 0.4, sheenColor: new THREE.Color(0xd8cfc2), sheenRoughness: 0.8, side: THREE.DoubleSide }); // deep-waffle oatmeal
  towelLight.bumpMap.repeat.set(1 / 0.18, 1 / 0.18);
  kit.floorFinish(bath, 'bathA', tileMat);
  { // neutral paint overlays (painted walls only; the shower is stone)
    const [x0, z0, x1, z1] = BATH.rect;
    kit.add(bath, paintOverlay(ctx.plan, 'x', z0, x0, x1, BY, PLATE, 1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
    kit.add(bath, paintOverlay(ctx.plan, 'z', x1, z0, z1, BY, PLATE, -1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
    kit.add(bath, paintOverlay(ctx.plan, 'z', x0, z0, 2.65, BY, PLATE, 1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
    kit.add(bath, paintOverlay(ctx.plan, 'x', z1, 16.55, x1, BY, PLATE, -1), paintN, [0, 0, 0], [0, 0, 0], { shadow: false });
  }
  { // grey tile base on the painted walls (not inside the shower)
    const t = 0.012, h = 0.08, [x0, z0, x1, z1] = BATH.rect;
    kit.boxAt(bath, tileBase, x0 + 0.56, BY, z0, x1 - x0 - 0.56, h, t); // street wall (right of vanity)
    kit.boxAt(bath, tileBase, x1 - t, BY, z0, t, h, z1 - z0); // hall-side wall
    kit.boxAt(bath, tileBase, x0, BY, 2.25, t, h, 0.40); // SW wall between vanity and shower stub
    kit.boxAt(bath, tileBase, x0, BY, 2.65 - t, 0.50, h, t); // stub wall, vanity side
  }
  // ---- vanity (local: faces +z = world +x, local +x = world -z), centred at z = 1.45, 1.60 long
  const VZ = 1.45;
  const van = kit.group(bath, [BATH.x0, BY, VZ], Math.PI / 2, 'vanity');
  {
    const L = 1.60, D = 0.55, H = 0.86, kick = 0.10, kIn = 0.07;
    kit.add(van, kit.box(L - 0.02, kick, D - kIn), std({ color: 0x3b3128, roughness: 0.8 }), [0, kick / 2, (D - kIn) / 2]); // toe kick
    // carcass (full height at both ends, lowered under the sink) + dark reveal plane behind the fronts
    kit.add(van, kit.box(0.52, H - kick, D - 0.02), oakLight, [-0.54, kick + (H - kick) / 2, (D - 0.02) / 2]);
    kit.add(van, kit.box(0.50, H - kick, D - 0.02), oakLight, [0.55, kick + (H - kick) / 2, (D - 0.02) / 2]);
    kit.add(van, kit.box(0.58, H - kick - 0.20, D - 0.02), oakLight, [0.01, kick + (H - kick - 0.20) / 2, (D - 0.02) / 2]);
    kit.add(van, kit.box(L - 0.01, H - kick - 0.02, 0.004), std({ color: 0x2c2219, roughness: 1 }), [0, kick + (H - kick - 0.02) / 2, D - 0.021]);
    const front = (x0, w, y0, h, pull) => {
      const f = kit.add(van, kit.shakerFront(w - 0.006, h - 0.006, 0.055, 0.02, 0.007), oakLight, [x0 + 0.003, y0 + 0.003, D - 0.02]);
      if (pull === 'h') { const py = y0 + h / 2 + (h > 0.2 ? h * 0.25 : 0); kit.add(van, kit.cyl(0.006, 0.006, 0.16, 12), nickel, [x0 + w / 2, py, D + 0.025], [0, 0, Math.PI / 2]); for (const s of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.03, 8), nickel, [x0 + w / 2 + s * 0.07, py, D + 0.01], [Math.PI / 2, 0, 0]); }
      if (pull === 'vL' || pull === 'vR') { const px = pull === 'vL' ? x0 + w - 0.05 : x0 + 0.05; kit.add(van, kit.cyl(0.006, 0.006, 0.16, 12), nickel, [px, y0 + h - 0.16, D + 0.025]); for (const s of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.03, 8), nickel, [px, y0 + h - 0.16 + s * 0.07, D + 0.01], [Math.PI / 2, 0, 0]); }
      return f;
    };
    const ftop = H - 0.025, dh = (ftop - kick) / 3;
    for (const [xs, w] of [[-0.80, 0.52], [0.30, 0.50]]) for (let i = 0; i < 3; i++) front(xs, w, kick + i * dh, dh, 'h');
    front(-0.28, 0.29, kick, ftop - kick - 0.16, 'vL'); front(0.01, 0.29, kick, ftop - kick - 0.16, 'vR');
    front(-0.28, 0.58, ftop - 0.16, 0.16, 'h'); // false front under the sink
    // white quartz: 2 cm top, 4 cm mitred front + end edge, undermount sink hole
    const T = 0.02, ty = H, sx = 0.01, sw = 0.50, sd = 0.36, sz = 0.30, OD = D + 0.025;
    const slab = (x0, x1, z0, z1) => kit.add(van, kit.rbox(x1 - x0, T, z1 - z0, 0.003), quartz, [(x0 + x1) / 2, ty + T / 2, (z0 + z1) / 2]);
    slab(-L / 2 - 0.02, sx - sw / 2, 0, OD); slab(sx + sw / 2, L / 2 + 0.005, 0, OD);
    slab(sx - sw / 2, sx + sw / 2, 0, sz - sd / 2); slab(sx - sw / 2, sx + sw / 2, sz + sd / 2, OD);
    kit.add(van, kit.rbox(L + 0.025, 0.05, 0.02, 0.004), quartz, [-0.0075, ty + T - 0.025, OD - 0.01]); // 5 cm mitred front apron
    kit.add(van, kit.rbox(0.02, 0.05, OD, 0.004), quartz, [-L / 2 - 0.01, ty + T - 0.025, OD / 2]); // exposed near end apron
    // overhang shadow on the drawer / door faces + end panel just under the slab
    const shd = kit.add(van, shadeGeo(L, 0.16, 0.42), aoMat, [0, ty - 0.03 - 0.08, D + 0.03], [0, 0, 0], { shadow: false }); shd.renderOrder = 2;
    const shd2 = kit.add(van, shadeGeo(D, 0.14, 0.35), aoMat, [-L / 2 - 0.003, ty - 0.03 - 0.07, D / 2], [0, -Math.PI / 2, 0], { shadow: false }); shd2.renderOrder = 2;
    kit.add(van, kit.box(sw - 0.01, 0.16, sd - 0.01), std({ color: 0xf6f6f4, roughness: 0.1, side: THREE.BackSide }), [sx, ty + T - 0.08, sz]); // basin interior
    const lip = std({ color: 0x8e8c88, roughness: 0.4 }); // undermount shadow line just under the cut edge
    kit.add(van, kit.box(sw, 0.006, 0.004), lip, [sx, ty + 0.004, sz - sd / 2 + 0.002]); kit.add(van, kit.box(sw, 0.006, 0.004), lip, [sx, ty + 0.004, sz + sd / 2 - 0.002]);
    kit.add(van, kit.box(0.004, 0.006, sd), lip, [sx - sw / 2 + 0.002, ty + 0.004, sz]); kit.add(van, kit.box(0.004, 0.006, sd), lip, [sx + sw / 2 - 0.002, ty + 0.004, sz]);
    kit.add(van, kit.cyl(0.018, 0.018, 0.004, 20), nickel, [sx, ty + T - 0.158, sz]); // drain
    // 13 cm quartz backsplash + short return on the street wall
    const SPH = 0.13;
    kit.add(van, kit.rbox(L + 0.025, SPH, 0.015, 0.003), quartz, [-0.0075, ty + T + SPH / 2, 0.0075]);
    kit.add(van, kit.rbox(0.015, SPH, OD, 0.003), quartz, [L / 2 + 0.0125, ty + T + SPH / 2, OD / 2]);
    // 3-gang white rocker plate on the near end of the splash
    const plateM = std({ color: 0xf7f7f5, roughness: 0.35 });
    kit.add(van, kit.rbox(0.19, 0.115, 0.008, 0.003), plateM, [-0.64, ty + T + 0.068, 0.019]);
    for (let k = -1; k <= 1; k++) kit.add(van, kit.rbox(0.035, 0.07, 0.008, 0.003), plateM, [-0.64 + k * 0.055, ty + T + 0.068, 0.025]);
    // widespread faucet: gooseneck + two levers
    const fz = 0.09, fy = ty + T;
    kit.add(van, kit.cyl(0.022, 0.026, 0.05, 24), polNickel, [sx, fy + 0.025, fz]);
    kit.add(van, kit.tube([[sx, fy + 0.04, fz], [sx, fy + 0.20, fz], [sx, fy + 0.27, fz + 0.06], [sx, fy + 0.22, fz + 0.15], [sx, fy + 0.15, fz + 0.16]], 0.011, 32), polNickel);
    for (const s of [-1, 1]) { // widespread valves with 4-spoke cross handles
      const vx = sx + s * 0.18;
      kit.add(van, kit.cyl(0.019, 0.024, 0.055, 20), polNickel, [vx, fy + 0.0275, fz]);
      kit.add(van, kit.cyl(0.008, 0.008, 0.03, 12), polNickel, [vx, fy + 0.07, fz]);
      for (let k = 0; k < 2; k++) kit.add(van, kit.cyl(0.0045, 0.0045, 0.075, 8), polNickel, [vx, fy + 0.082, fz], [Math.PI / 2, 0, k * Math.PI / 2 + Math.PI / 4]);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; kit.add(van, kit.sphere(0.007, 10, 8), polNickel, [vx + Math.cos(a) * 0.0375, fy + 0.082, fz + Math.sin(a) * 0.0375]); }
      kit.add(van, kit.sphere(0.009, 12, 8), polNickel, [vx, fy + 0.088, fz]);
    }
    // folded taupe towel stack at the far end of the counter
    for (let k = 0; k < 2; k++) { const tm = kit.add(van, kit.cushion(0.30 - k * 0.02, 0.055, 0.22, 0.026, 0.008, 5), towelStack, [0.55 + k * 0.01, fy + 0.0275 + k * 0.055, 0.17]); if (k === 1) dynamicBits.push(tm); }
    // mirror: 9 cm light rift-oak frame + real planar reflection (room-culled)
    const MW = 1.55, MH = 1.22, my = ty + T + SPH + 0.02 + MH / 2, mz = 0.02, fw = 0.09;
    for (const [w, h, x, y] of [[MW, fw, 0, MH / 2 - fw / 2], [MW, fw, 0, -MH / 2 + fw / 2], [fw, MH - 2 * fw, -MW / 2 + fw / 2, 0], [fw, MH - 2 * fw, MW / 2 - fw / 2, 0]])
      kit.add(van, kit.rbox(w, h, 0.045, 0.006), oakFrame, [x, my + y, mz + 0.0225]);
    const mirror = new Reflector(new THREE.PlaneGeometry(MW - 2 * fw + 0.01, MH - 2 * fw + 0.01), { textureWidth: 768, textureHeight: 600, color: 0xe4e4e0, clipBias: 0.003, multisample: 2 });
    mirror.position.set(0, my, mz + 0.012); mirror.userData.keep = true; mirror.name = 'mirror'; van.add(mirror);
    { const [x0, z0, x1, z1] = BATH.rect; ctx.onUpdate(() => { const p = ctx.camera.position; mirror.visible = p.x > x0 - 0.05 && p.x < x1 + 0.3 && p.z > z0 && p.z < z1 + 0.4 && p.y > BY && p.y < PLATE; }); }
    // polished-nickel picture light on the mirror head: backplate, arm, bar, clear glass tubes with frosted rods
    const ly = my + MH / 2 - 0.075; // backplate on the top frame rail
    kit.add(van, kit.rbox(0.07, 0.10, 0.012, 0.004), polNickel, [0, ly - 0.02, mz + 0.026]);
    kit.add(van, kit.cyl(0.008, 0.008, 0.12, 10), polNickel, [0, ly, mz + 0.09], [Math.PI / 2, 0, 0]);
    kit.add(van, kit.cyl(0.011, 0.011, 0.70, 16), polNickel, [0, ly + 0.012, mz + 0.15], [0, 0, Math.PI / 2]);
    const tubeGlass = physMat({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, specularIntensity: 1, ior: 1.5 });
    for (const s of [-1, 1]) {
      kit.add(van, kit.cyl(0.026, 0.026, 0.28, 24), tubeGlass, [s * 0.17, ly - 0.03, mz + 0.15], [0, 0, Math.PI / 2], { shadow: false }).renderOrder = 4;
      kit.add(van, kit.cyl(0.011, 0.011, 0.26, 16), opal, [s * 0.17, ly - 0.03, mz + 0.15], [0, 0, Math.PI / 2], { shadow: false });
      for (const e of [-1, 1]) kit.add(van, kit.cyl(0.028, 0.028, 0.012, 24), polNickel, [s * 0.17 + e * 0.146, ly - 0.03, mz + 0.15], [0, 0, Math.PI / 2]);
    }
    phys.solidGroup(van);
  }
  // frosted privacy film on the bath window (milky, not blown out)
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bathA-front');
    const film = kit.add(bath, new THREE.PlaneGeometry(o.w - 0.08, o.head - o.sill - 0.08), std({ color: 0xf4f2ee, emissive: 0xfaf8f4, emissiveIntensity: 0.95, roughness: 0.6, transparent: true, opacity: 0.95 }), [o.at[0], BY + (o.sill + o.head) / 2, BATH.z0 - 0.19], [0, 0, 0], { shadow: false });
    film.renderOrder = 3;
  }
  // round brushed-nickel towel bar + folded taupe waffle hand towel on the street wall right of the mirror
  {
    const tx = 16.10, ty = BY + 1.62, tz = BATH.z0 + 0.065;
    kit.add(bath, kit.cyl(0.009, 0.009, 0.30, 16), nickel, [tx, ty, tz], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) { kit.add(bath, kit.cyl(0.008, 0.008, 0.065, 10), nickel, [tx + s * 0.15, ty, tz - 0.0325], [Math.PI / 2, 0, 0]); kit.add(bath, kit.cyl(0.022, 0.022, 0.012, 20), nickel, [tx + s * 0.15, ty, BATH.z0 + 0.006], [Math.PI / 2, 0, 0]); }
    kit.add(bath, towelGeo(0.26, 0.40, 0.36, 0.009, 0.010, 2), towelTaupe, [tx, ty, tz]);
  }
  // ---- shower: x 15.75..16.55, z 3.05..4.45 (hall end), open to the door passage; fixed glass panel on the hall half
  {
    const sx0 = BATH.x0, sx1 = 16.55, sz0 = 3.05, sz1 = BATH.z1, top = PLATE, SX = 16.25, SZ0 = 2.65; // SX: stub end
    kit.boxAt(bath, paintN, sx0, BY, SZ0, SX - sx0, top - BY, sz0 - SZ0); // stub wall between vanity and shower
    phys.boxAABB([sx0, BY, SZ0], [SX, top, sz0]);
    const trv = (a, b, n, mat, y0 = BY, y1 = top) => kit.wallPanel(bath, a, b, y0, y1, n, mat, 0.004);
    trv([sx0, sz0], [sx0, sz1], [1, 0], trvA);            // fixture wall (SW)
    trv([sx0, sz1], [sx1, sz1], [0, -1], trvB);           // back wall (hall)
    trv([SX, sz0], [sx0, sz0], [0, 1], trvC);             // stub inside face (stone return)
    kit.floorFinish(bath, [sx0, sz0, sx1, sz1], trvB, BY, 0.012);
    kit.add(bath, kit.rbox(0.10, 0.07, sz1 - sz0, 0.008), trvC, [sx1 - 0.05, BY + 0.035, (sz0 + sz1) / 2]); // curb
    // stepped bench along the hall wall + upper ledge
    kit.add(bath, kit.rbox(sx1 - sx0 - 0.02, 0.45, 0.40, 0.006), trvC, [(sx0 + sx1) / 2 - 0.01, BY + 0.225, sz1 - 0.20]);
    kit.add(bath, kit.rbox(sx1 - sx0 - 0.06, 0.40, 0.20, 0.004), trvA, [(sx0 + sx1) / 2 - 0.03, BY + 0.45 + 0.20, sz1 - 0.10]); // upper step
    phys.boxAABB([sx0, BY, sz1 - 0.40], [sx1, BY + 0.45, sz1]);
    // fixed 10 mm glass panel on the curb (hall half) + brushed-nickel wall clamps; open entry z 3.05..3.82
    const glass = physMat({ color: 0xe2f2ea, roughness: 0.02, transparent: true, opacity: 0.13, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.0, side: THREE.FrontSide, depthWrite: false });
    const gz0 = 3.82, gy0 = BY + 0.07, gy1 = BY + 2.05, gx = sx1 - 0.05;
    const gp = kit.add(bath, kit.box(0.01, gy1 - gy0, sz1 - gz0), glass, [gx, (gy0 + gy1) / 2, (gz0 + sz1) / 2], [0, 0, 0], { shadow: false }); gp.renderOrder = 3;
    const edge = physMat({ color: 0xf4fbf8, roughness: 0.02, transparent: true, opacity: 0.32, depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0.12 }); // thin bright polished edge line
    kit.add(bath, kit.box(0.0035, gy1 - gy0, 0.0035), edge, [gx, (gy0 + gy1) / 2, gz0], [0, 0, 0], { shadow: false }).renderOrder = 4;
    kit.add(bath, kit.box(0.0035, 0.0035, sz1 - gz0), edge, [gx, gy1, (gz0 + sz1) / 2], [0, 0, 0], { shadow: false }).renderOrder = 4;
    for (const y of [BY + 1.2, BY + 1.98]) { kit.add(bath, kit.rbox(0.036, 0.06, 0.045, 0.005), polNickel, [gx, y, sz1 - 0.0225]); kit.add(bath, kit.rbox(0.05, 0.075, 0.006, 0.002), polNickel, [gx, y, sz1 - 0.003]); }
    /* p26: square satin clamps holding the panel's foot to the curb + a green-tinted polished edge on the open side */
    for (const z of [gz0 + 0.12, sz1 - 0.14]) kit.add(bath, kit.rbox(0.034, 0.045, 0.05, 0.004), champagne, [gx, gy0 + 0.0225, z]);
    kit.add(bath, kit.box(0.011, gy1 - gy0, 0.004), physMat({ color: 0x9cc8b4, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }), [gx, (gy0 + gy1) / 2, gz0 + 0.002], [0, 0, 0], { shadow: false }).renderOrder = 4;
    phys.boxAABB([gx - 0.01, BY, gz0], [gx + 0.01, gy1, sz1]);
    // fixtures on the SW wall near the stub (satin nickel): fixed head on an angled wall arm, 0.6 m slide bar with a
    // handheld spray, two small round trim valves + a larger round trim/diverter below, hose looping down to ~1 m
    const wx = sx0 + 0.004, fzc = 3.20; const sn = champagne;
    const flange = (y, r, d = 0.012) => kit.add(bath, kit.lathe([[0, 0], [r, 0], [r, d * 0.5], [r * 0.75, d], [0, d]], 32), sn, [wx, BY + y, fzc], [0, 0, -Math.PI / 2]);
    flange(2.06, 0.03, 0.016);
    kit.add(bath, kit.tube([[wx + 0.01, BY + 2.06, fzc], [wx + 0.10, BY + 2.075, fzc], [wx + 0.19, BY + 2.03, fzc]], 0.0095, 16), sn); // arm
    kit.add(bath, kit.lathe([[0, 0], [0.012, 0], [0.016, 0.02], [0.034, 0.048], [0.042, 0.058], [0.042, 0.064], [0, 0.064]], 32), sn, [wx + 0.19, BY + 2.03, fzc], [0, 0, -2.3]); // head, face down + out
    kit.add(bath, kit.cyl(0.036, 0.036, 0.003, 24), std({ color: 0x5a5652, roughness: 0.6 }), [wx + 0.19 + Math.sin(2.3) * 0.065, BY + 2.03 + Math.cos(2.3) * 0.065, fzc], [0, 0, -2.3]); // spray face
    const bx = wx + 0.04; // slide bar 1.15 .. 1.75
    kit.add(bath, kit.cyl(0.0085, 0.0085, 0.60, 16), sn, [bx, BY + 1.45, fzc]);
    for (const y of [1.15, 1.75]) { flange(y, 0.02, 0.01); kit.add(bath, kit.cyl(0.008, 0.008, 0.04, 12), sn, [wx + 0.02, BY + y, fzc], [0, 0, Math.PI / 2]); kit.add(bath, kit.sphere(0.011, 14, 10), sn, [bx, BY + y, fzc]); }
    kit.add(bath, kit.rbox(0.028, 0.045, 0.03, 0.008), sn, [bx + 0.012, BY + 1.70, fzc]); // slider holder
    const hh = kit.group(bath, [bx + 0.03, BY + 1.70, fzc], 0); hh.rotation.z = -0.45; // handheld, tipped toward the room
    kit.add(hh, kit.cyl(0.011, 0.014, 0.17, 16), sn, [0, 0.06, 0]);
    kit.add(hh, kit.lathe([[0, 0], [0.016, 0], [0.026, 0.02], [0.028, 0.035], [0, 0.035]], 24), sn, [0, 0.145, 0]);
    flange(1.45, 0.028); kit.add(bath, kit.cyl(0.01, 0.012, 0.035, 14), sn, [wx + 0.03, BY + 1.45, fzc], [0, 0, Math.PI / 2]); kit.add(bath, kit.rbox(0.012, 0.045, 0.012, 0.004), sn, [wx + 0.05, BY + 1.43, fzc]); // small valve 1
    flange(1.30, 0.028); kit.add(bath, kit.cyl(0.01, 0.012, 0.035, 14), sn, [wx + 0.03, BY + 1.30, fzc], [0, 0, Math.PI / 2]); kit.add(bath, kit.rbox(0.012, 0.045, 0.012, 0.004), sn, [wx + 0.05, BY + 1.28, fzc]); // small valve 2
    flange(1.10, 0.055, 0.016); kit.add(bath, kit.cyl(0.016, 0.02, 0.05, 16), sn, [wx + 0.04, BY + 1.10, fzc], [0, 0, Math.PI / 2]); kit.add(bath, kit.rbox(0.014, 0.10, 0.014, 0.005), sn, [wx + 0.065, BY + 1.06, fzc]); // large trim + lever
    kit.add(bath, kit.cyl(0.011, 0.011, 0.035, 12), sn, [wx + 0.018, BY + 1.02, fzc - 0.03], [0, 0, Math.PI / 2]); // hose outlet
    kit.add(bath, kit.tube([[bx + 0.03, BY + 1.62, fzc], [bx + 0.04, BY + 1.30, fzc + 0.015], [bx + 0.05, BY + 0.98, fzc + 0.02], [bx + 0.045, BY + 0.80, fzc + 0.01], [bx + 0.03, BY + 0.76, fzc - 0.02], [wx + 0.04, BY + 0.85, fzc - 0.035], [wx + 0.03, BY + 0.97, fzc - 0.032], [wx + 0.022, BY + 1.02, fzc - 0.03]], 0.005, 80), polNickel); // metal hose
    // soft waffle bath towel hanging from a hook on the stub end (p26 right edge)
    const hy = BY + 1.80, hz = 2.85;
    kit.add(bath, kit.tube([[SX, hy, hz], [SX + 0.04, hy - 0.005, hz], [SX + 0.05, hy + 0.02, hz]], 0.006, 12), champagne);
    const tw = kit.add(bath, towelGeo(0.40, 0.50, 0.42, 0.03, 0.012, 5), towelLight, [SX + 0.035, hy - 0.02, hz], [0, Math.PI / 2, 0]);
    tw.castShadow = true;
  }
  // ceiling: two cans + exhaust grille (flat shell ceiling)
  kit.canLights(bath, [[16.55, 1.40], [16.15, 3.75]], PLATE - 0.001);
  kit.add(bath, kit.box(0.25, 0.01, 0.25), std({ color: 0xe8e8e6, roughness: 0.6 }), [16.95, PLATE - 0.006, 2.4]);
  // contact shadows: vanity toe kick, shower bench
  ao(bath, BATH.x0 + 0.27, VZ, 0.62, 1.75, 0.45, BY + 0.006);

  // ---------------------------------------------------------------- finish
  root.updateMatrixWorld(true);
  for (const m of dynamicBits) phys.dynamic(m, { mass: 0.4, shape: 'box', friction: 0.8 });
  kit.mergeStatic(root);
}
