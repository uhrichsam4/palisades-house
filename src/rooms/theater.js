// Piece: theater — Theater over the garage + guest bath in the upper turret
// Owned rooms: theater, guestBath | Reference photos: p32, p36, p37
//
// Theater (p32): front-gable vault (ridge along z at the room centre line) with one warm oak beam on
// the ridge, vertical white-oak slat walls on black felt, charcoal slat screen wall (z = 6.15) with a
// black-framed projection screen showing a noir film still (original canvas art), two rows of four
// espresso leather power recliners (back row on a carpeted riser), black tray tables on the aisle
// arms, dark charcoal carpet, recessed cans on both slopes, wicker basket with a green throw.
// Guest bath (p36, p37): rift-oak vanity with white quartz top against a full-height geometric
// wood-look tile panel (north wall), black-framed mirror (real reflection), beach-print art on the
// east wall, tiled shower alcove in the NW corner behind frameless glass with black hinges,
// brushed-nickel rain head + slide bar, dark porcelain floor.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const piece = { rooms: ["theater", "guestBath"], photos: ["p32", "p36", "p37"] };
export const ownCeiling = ['theater'];
export const views = {
  p32: { pos: [15.10, 4.80, 10.06], look: [13.25, 4.80, 7.70], fov: 80 },
  p36: { pos: [7.30, 4.62, 5.22], look: [7.30, 4.58, 7.22], fov: 68 },
  p37: { pos: [5.78, 4.62, 5.28], look: [5.74, 4.50, 7.22], fov: 66 }, /* tilted down a touch: charcoal shower floor in frame (photo) */
};

const std = (o) => new THREE.MeshStandardMaterial(o);

// ------------------------------------------------------------------ procedural textures
function grainTex(kit, base, seed) { // vertical oak grain (streaks run along v), 256 x 1024
  const r = kit.rng(seed);
  return kit.canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x0 = r() * w, lw = 0.6 + r() * 2.4, a = 0.05 + r() * 0.16; const dark = r() < 0.7;
      g.strokeStyle = dark ? `rgba(110,70,35,${a})` : `rgba(255,236,205,${a})`; g.lineWidth = lw;
      g.beginPath(); let x = x0; g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 32) { x += (r() - 0.5) * 2.2; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,55,25,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 6); }
  });
}
function carpetTex(kit, base = '#3a3a3c', lift = 0) { /* neutral charcoal cut-and-loop pile, 0.5 m repeat (p32: cool charcoal, not brown) */
  const r = kit.rng(41);
  return kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) { const v = 58 + lift + (r() - 0.5) * 34; g.fillStyle = `rgba(${v},${v},${v + 2},0.45)`; g.fillRect(r() * w, r() * h, 1, 1 + (r() < 0.3)); }
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(22,22,24,${0.10 + r() * 0.08})`; g.fillRect(0, y, w, 1); } /* fine loop rows */
  }, { repeat: [2, 2] });
}
// Soft starburst glow for a downlight (additive sprite): radial bloom + 6 thin rays.
function flareTex(kit) {
  return kit.canvasTex(128, 128, (g, w, h) => {
    const c = w / 2; const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,246,228,1)'); gr.addColorStop(0.08, 'rgba(255,236,205,0.85)'); gr.addColorStop(0.3, 'rgba(255,220,180,0.18)'); gr.addColorStop(1, 'rgba(255,210,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.translate(c, c);
    for (let i = 0; i < 6; i++) { g.rotate(i ? Math.PI / 3 : 0.26); const lg = g.createLinearGradient(-c, 0, c, 0); lg.addColorStop(0, 'rgba(255,235,210,0)'); lg.addColorStop(0.5, 'rgba(255,240,220,0.55)'); lg.addColorStop(1, 'rgba(255,235,210,0)'); g.fillStyle = lg; g.fillRect(-c, -0.7, w, 1.4); }
  }, { repeat: [1, 1] });
}
function porcelainTex(kit) { // dark grey porcelain, 0.6 m square tiles, texture = 1.2 m
  const r = kit.rng(13);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#4b4d4e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { const v = 72 + (r() - 0.5) * 16; g.fillStyle = `rgba(${v},${v + 1},${v + 2},0.16)`; g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 40, 6 + r() * 26, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 9000; i++) { const v = 80 + (r() - 0.5) * 40; g.fillStyle = `rgba(${v},${v},${v},0.22)`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.fillStyle = '#323333'; g.fillRect(0, 0, w, 2); g.fillRect(0, h / 2 - 1, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2 - 1, 0, 2, h);
  }, { repeat: [1 / 1.2, 1 / 1.2] });
}
// Geometric wood-look porcelain (p36/p37): square tiles split into triangles / quadrants, each field
// filled with fine parallel linear grooves in its own direction; per-tile tone variation. Returns the
// colour map and a matching groove normal map (same layout). Texture = 4 x 4 tiles = 1.2 m.
function geoTileTex(kit) {
  const r = kit.rng(77); const n = 4, S = 1024, t = S / n;
  const tiles = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const tone = (r() - 0.5) * 22; const kr = r(); const k = kr < 0.36 ? 0 : kr < 0.72 ? 1 : kr < 0.9 ? 3 : 2; const lines = [];
    for (let f = 0; f < 4; f++) { const L = []; for (let o = -t * 1.2; o < t * 1.2; o += 2.2 + r() * 3.4) L.push([o, r(), 0.6 + r() * 1.6, (r() - 0.5) * 2, r()]); lines.push(L); }
    tiles.push({ x: i * t, y: j * t, tone, k, lines });
  }
  const fieldsOf = (T) => {
    const { x, y } = T; const A = [x, y], B = [x + t, y], C = [x + t, y + t], D = [x, y + t], O = [x + t / 2, y + t / 2]; const q = Math.PI / 4;
    if (T.k === 0) return [[[A, B, C], q], [[A, C, D], -q]];
    if (T.k === 1) return [[[B, C, D], -q], [[A, B, D], q]];
    if (T.k === 2) return [[[A, B, O], 0], [[B, C, O], Math.PI / 2], [[C, D, O], 0], [[D, A, O], Math.PI / 2]];
    return [[[A, B, O], q], [[B, C, O], -q], [[C, D, O], q], [[D, A, O], -q]];
  };
  const paint = (normal) => (g, w, h) => {
    g.fillStyle = normal ? 'rgb(128,128,255)' : '#a8968a'; g.fillRect(0, 0, w, h);
    for (const T of tiles) {
      fieldsOf(T).forEach(([poly, ang], fi) => {
        g.save(); g.beginPath(); g.moveTo(poly[0][0], poly[0][1]); for (const p of poly.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.clip();
        if (!normal) { const v = 196 + T.tone + (fi % 2 ? 5 : -3); g.fillStyle = `rgb(${v},${v - 17 | 0},${v - 36 | 0})`; g.fillRect(T.x, T.y, t, t); }
        const cx = poly.reduce((s2, p) => s2 + p[0], 0) / poly.length, cy = poly.reduce((s2, p) => s2 + p[1], 0) / poly.length;
        g.translate(cx, cy); g.rotate(ang);
        const nx = -Math.sin(ang), ny = Math.cos(ang); // groove-perpendicular in canvas space
        for (const [o, d, lw, wob, a] of T.lines[fi]) {
          if (normal) { // each groove: one wall tilted +perp, one -perp
            for (const sgn of [1, -1]) { g.strokeStyle = `rgb(${128 + sgn * nx * 90 | 0},${128 - sgn * ny * 90 | 0},225)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-t * 1.2, o + sgn * 0.8); g.lineTo(t * 1.2, o + sgn * 0.8 + wob); g.stroke(); }
          } else {
            g.strokeStyle = d < 0.6 ? `rgba(78,58,44,${0.22 + a * 0.36})` : `rgba(238,222,204,${0.14 + a * 0.24})`;
            g.lineWidth = lw; g.beginPath(); g.moveTo(-t * 1.2, o); g.lineTo(t * 1.2, o + wob); g.stroke();
          }
        }
        g.restore();
      });
      if (!normal) { g.fillStyle = 'rgba(120,100,84,0.95)'; g.fillRect(T.x, T.y, t, 2); g.fillRect(T.x, T.y, 2, t); }
      else { g.fillStyle = 'rgb(128,60,230)'; g.fillRect(T.x, T.y, t, 1.5); g.fillStyle = 'rgb(60,128,230)'; g.fillRect(T.x, T.y, 1.5, t); }
    }
  };
  const rep = [1 / 1.2, 1 / 1.2];
  return { map: kit.canvasTex(S, S, paint(false), { repeat: rep }), normal: kit.canvasTex(S, S, paint(true), { repeat: rep, srgb: false }) };
}
// Low-key noir "film still" (original art): a rain-wet night street. A lone figure in a trench coat and fedora
// stands in silhouette under a street lamp; the lamp's pool spills over wet cobbles, a brick wall with one lit
// window, a parked car's chrome edge, rain streaks. Mostly near-black (like a real night frame), soft optics:
// one blur pass, then halation on the highlights, film grain and a vignette.
function filmStillTex(kit) {
  const r = kit.rng(5);
  return kit.canvasTex(1024, 576, (g, w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d');
    const RG = (x, y, r1, stops) => { const gr = q.createRadialGradient(x * w, y * h, 0, x * w, y * h, r1 * w); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; };
    const LG = (x0, y0, x1, y1, stops) => { const gr = q.createLinearGradient(x0 * w, y0 * h, x1 * w, y1 * h); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; };
    const poly = (pts, fill) => { q.fillStyle = fill; q.beginPath(); pts.forEach(([x, y], i) => i ? q.lineTo(x * w, y * h) : q.moveTo(x * w, y * h)); q.closePath(); q.fill(); };
    const HZ = 0.66; /* street / wall line */
    q.fillStyle = '#060606'; q.fillRect(0, 0, w, h);
    /* brick wall on the right half, receding left: faint courses only where the lamp reaches */
    poly([[0.30, 0], [1, 0], [1, 0.80], [0.30, HZ + 0.02]], '#0d0d0d');
    q.save(); q.beginPath(); q.moveTo(0.30 * w, 0); q.lineTo(w, 0); q.lineTo(w, 0.80 * h); q.lineTo(0.30 * w, (HZ + 0.02) * h); q.closePath(); q.clip();
    for (let row = 0; row < 60; row++) { const y = row * 0.014; for (let k = 0; k < 40; k++) { const x = 0.30 + k * 0.026 + (row % 2) * 0.013; const v = 18 + r() * 14; q.fillStyle = `rgb(${v},${v},${v})`; q.fillRect(x * w, y * h, 0.024 * w, 0.011 * h); } }
    q.globalCompositeOperation = 'multiply'; q.fillStyle = RG(0.47, 0.20, 0.55, [[0, '#ffffff'], [0.35, '#6a6a6a'], [1, '#101010']]); q.fillRect(0, 0, w, h); q.globalCompositeOperation = 'source-over';
    q.restore();
    /* one lit window (blind slats) far right */
    q.fillStyle = '#7a7a76'; q.fillRect(0.80 * w, 0.18 * h, 0.09 * w, 0.20 * h);
    for (let i = 0; i < 9; i++) { q.fillStyle = 'rgba(10,10,10,0.75)'; q.fillRect(0.80 * w, (0.19 + i * 0.022) * h, 0.09 * w, 0.008 * h); }
    q.fillStyle = '#050505'; q.fillRect(0.795 * w, 0.17 * h, 0.10 * w, 0.012 * h); q.fillRect(0.795 * w, 0.38 * h, 0.10 * w, 0.014 * h);
    /* deep alley on the left: distant hazy light */
    q.fillStyle = RG(0.12, 0.48, 0.20, [[0, 'rgba(70,70,70,0.6)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, w, h);
    /* wet street: dark with the lamp pool and long vertical reflections */
    poly([[0, HZ], [1, 0.80], [1, 1], [0, 1]], '#080808');
    q.fillStyle = RG(0.47, 0.80, 0.36, [[0, 'rgba(120,120,118,0.55)'], [0.5, 'rgba(50,50,50,0.25)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, HZ * h, w, h);
    for (const [x, a, wd] of [[0.465, 0.55, 0.020], [0.12, 0.30, 0.016], [0.845, 0.35, 0.03]]) { q.fillStyle = LG(0, HZ + 0.02, 0, 1, [[0, `rgba(200,200,196,${a})`], [1, 'rgba(0,0,0,0)']]); q.fillRect((x - wd / 2) * w, (HZ + 0.03) * h, wd * w, (1 - HZ) * h); }
    for (let i = 0; i < 900; i++) { const x = r(), y = HZ + 0.02 + r() * (1 - HZ); const v = 40 + r() * 60; q.fillStyle = `rgba(${v},${v},${v},${0.25 * (1 - Math.abs(x - 0.47) * 1.6)})`; q.fillRect(x * w, y * h, 2 + r() * 6, 1); }
    /* street lamp: iron post + lantern head with a hot core */
    q.fillStyle = '#030303'; q.fillRect(0.462 * w, 0.14 * h, 0.010 * w, 0.62 * h); q.fillRect(0.455 * w, 0.73 * h, 0.024 * w, 0.03 * h);
    poly([[0.446, 0.10], [0.488, 0.10], [0.482, 0.155], [0.452, 0.155]], '#bdbdb8');
    poly([[0.440, 0.10], [0.494, 0.10], [0.467, 0.075]], '#050505');
    q.fillStyle = RG(0.467, 0.13, 0.22, [[0, 'rgba(255,255,250,0.9)'], [0.08, 'rgba(200,200,196,0.45)'], [0.35, 'rgba(90,90,90,0.12)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, w, h);
    /* lamp light cone through the rain */
    q.fillStyle = LG(0, 0.15, 0, 0.78, [[0, 'rgba(160,160,156,0.22)'], [1, 'rgba(160,160,156,0.03)']]); poly([[0.452, 0.155], [0.482, 0.155], [0.62, 0.78], [0.31, 0.78]], q.fillStyle);
    /* parked car at the left edge: dark mass with a chrome highlight line */
    poly([[0, 0.60], [0.16, 0.58], [0.25, 0.66], [0.27, 0.80], [0, 0.82]], '#030303');
    q.strokeStyle = 'rgba(190,190,186,0.7)'; q.lineWidth = 2; q.beginPath(); q.moveTo(0, 0.665 * h); q.quadraticCurveTo(0.18 * w, 0.655 * h, 0.255 * w, 0.70 * h); q.stroke();
    q.fillStyle = RG(0.235, 0.72, 0.012, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, w, h);
    /* figure in trench coat + fedora, back-lit silhouette with a thin rim on the shoulder and hat brim */
    const fx = 0.56, fy = 0.80; const s = 0.42;
    const P = (pts) => pts.map(([x, y]) => [fx + x * s * 0.5625, fy - y * s]);
    poly(P([[-0.10, 0], [-0.085, 0.38], [-0.13, 0.42], [-0.15, 0.70], [-0.12, 0.84], [-0.05, 0.88], [0.05, 0.88], [0.12, 0.84], [0.15, 0.70], [0.13, 0.42], [0.085, 0.38], [0.10, 0]]), '#020202');
    poly(P([[-0.055, 0.86], [-0.06, 0.95], [-0.045, 0.99], [0.045, 0.99], [0.06, 0.95], [0.055, 0.86]]), '#020202');
    poly(P([[-0.13, 0.985], [0.13, 0.985], [0.10, 1.005], [-0.10, 1.005]]), '#020202');
    poly(P([[-0.06, 1.0], [-0.055, 1.07], [0.055, 1.07], [0.06, 1.0]]), '#020202');
    q.strokeStyle = 'rgba(210,210,206,0.65)'; q.lineWidth = 2.2; q.beginPath();
    const rim = P([[-0.05, 0.88], [-0.12, 0.84], [-0.15, 0.70]]); rim.forEach(([x, y], i) => i ? q.lineTo(x * w, y * h) : q.moveTo(x * w, y * h)); q.stroke();
    q.beginPath(); const rb = P([[-0.13, 0.985], [-0.04, 0.99]]); q.moveTo(rb[0][0] * w, rb[0][1] * h); q.lineTo(rb[1][0] * w, rb[1][1] * h); q.stroke();
    q.fillStyle = 'rgba(150,150,146,0.35)'; const sh = P([[0.10, 0.0]]); q.beginPath(); q.ellipse(sh[0][0] * w, (fy + 0.01) * h, 0.06 * w, 0.008 * h, 0, 0, 7); q.fill();
    /* rain streaks, brighter inside the lamp cone */
    for (let i = 0; i < 700; i++) { const x = r(), y = r() * 0.95, L = 0.02 + r() * 0.05; const near = Math.max(0, 1 - Math.abs(x - 0.47) * 3) * (y < 0.8 ? 1 : 0.3); const a = 0.04 + near * 0.22; q.strokeStyle = `rgba(220,220,216,${a})`; q.lineWidth = 1; q.beginPath(); q.moveTo(x * w, y * h); q.lineTo((x - 0.004) * w, (y + L) * h); q.stroke(); }
    /* composite: soft lens, halation, grain, vignette */
    g.filter = 'blur(1.6px)'; g.drawImage(c, 0, 0); g.filter = 'blur(22px)'; g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35; g.drawImage(c, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    const img = g.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; const v = Math.max(0, Math.min(255, (d[i] + d[i + 1] + d[i + 2]) / 3 + n)); d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(img, 0, 0);
    const gr = g.createRadialGradient(w / 2, h / 2, h * 0.30, w / 2, h / 2, w * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
}
// Beach print (original): ochre dune falling to a blue sea corner, a bather in a red cap and a brown
// patterned suit seated from behind, smaller white-suited bathers with coloured caps further off.
function beachArtTex(kit) {
  const r = kit.rng(19);
  return kit.canvasTex(512, 640, (g, w, h) => {
    let gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9a873'); gr.addColorStop(0.5, '#d88a55'); gr.addColorStop(1, '#c97643');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a77b5'; g.beginPath(); g.moveTo(w * 0.55, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.32); g.quadraticCurveTo(w * 0.80, h * 0.16, w * 0.55, 0); g.fill();
    g.fillStyle = '#1f4f8a'; g.beginPath(); g.moveTo(w * 0.78, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.14); g.fill();
    for (let i = 0; i < 3000; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(255,220,180,${r() * 0.15})` : `rgba(150,80,40,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 1); }
    const bather = (x, y, s, cap, suit) => {
      g.fillStyle = 'rgba(120,60,30,0.35)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 1.25, s * 0.9, s * 0.18, 0, 0, 7); g.fill(); // shadow
      g.fillStyle = '#d29a77'; g.beginPath(); g.ellipse(x, y + s * 0.55, s * 0.30, s * 0.55, 0, 0, 7); g.fill(); // back
      g.fillStyle = suit; g.beginPath(); g.ellipse(x, y + s * 0.85, s * 0.33, s * 0.35, 0, 0, 7); g.fill(); // suit
      g.fillStyle = '#c98e6b'; g.beginPath(); g.ellipse(x + s * 0.25, y + s * 1.12, s * 0.45, s * 0.12, 0, 0, 7); g.fill(); // legs
      g.fillStyle = cap; g.beginPath(); g.arc(x, y, s * 0.2, 0, 7); g.fill(); // cap
    };
    bather(w * 0.82, h * 0.30, 22, '#f2f2ef', '#f3f3f0');
    bather(w * 0.66, h * 0.33, 34, '#2d6fb0', '#f4f4f1');
    bather(w * 0.73, h * 0.46, 30, '#e9e4dc', '#f2f2ee');
    bather(w * 0.30, h * 0.60, 95, '#b8231f', '#b3302a');
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(110,25,15,${0.3 + r() * 0.4})`; const a = r() * 7, d = r() * 28; g.fillRect(w * 0.30 + Math.cos(a) * d, h * 0.60 + 95 * 0.85 + Math.sin(a) * d, 2, 2); } // suit pattern
  });
}

// Slat wall as a texture (mipmapped, so no moire at a distance): 1024 px = 1.44 m, 32 slats per tile
// (45 mm pitch, 34 mm slats, 11 mm dark felt reveal). Each slat has its own tone + vertical grain.
function slatTex(kit, base, gap, seed, normal = false) {
  const r = kit.rng(seed); const N = 32, P = 1024 / N, SW = Math.round(P * 34 / 45);
  return kit.canvasTex(1024, 1024, (g, w, h) => {
    if (normal) { g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = gap; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < N; i++) {
      const x0 = i * P + (P - SW) / 2;
      if (normal) { // rounded slat edges + a recess look at the reveal
        g.fillStyle = 'rgb(60,128,220)'; g.fillRect(x0, 0, 2, h); g.fillStyle = 'rgb(196,128,220)'; g.fillRect(x0 + SW - 2, 0, 2, h);
        g.fillStyle = 'rgb(100,128,245)'; g.fillRect(x0 + 2, 0, 2, h); g.fillStyle = 'rgb(156,128,245)'; g.fillRect(x0 + SW - 4, 0, 2, h);
        continue;
      }
      const k = 0.88 + r() * 0.2; const ch = (sh) => Math.min(255, ((base >> sh) & 255) * k) | 0; // sRGB channels
      g.fillStyle = `rgb(${ch(16)},${ch(8)},${ch(0)})`; g.fillRect(x0, 0, SW, h);
      for (let j = 0; j < 7; j++) { // grain streaks (unfiltered)
        const xs = x0 + 1 + r() * (SW - 2); const a = 0.05 + r() * 0.12;
        g.strokeStyle = r() < 0.65 ? `rgba(90,55,25,${a})` : `rgba(255,240,215,${a})`; g.lineWidth = 0.7 + r() * 1.6;
        g.beginPath(); let x = xs; g.moveTo(x, 0); for (let y = 0; y <= h; y += 64) { x = Math.max(x0 + 1, Math.min(x0 + SW - 1, x + (r() - 0.5) * 1.6)); g.lineTo(x, y); } g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0, 0, 1.5, h); g.fillRect(x0 + SW - 1.5, 0, 1.5, h); // shaded edges
    }
  }, { repeat: [1 / 1.44, 1 / 1.44], srgb: !normal });
}
// Pentagonal gable-end wall face (rect wall + triangle to the ridge) in a z-plane, optional door notch.
// UVs in metres (u = x, v = y). nz = +1 faces +z, -1 faces -z.
function gableFace(parent, x0, x1, y0, plate, xc, ridge, z, nz, mat, notch) {
  const pts = [[x0, y0]];
  if (notch) pts.push([notch[0], y0], [notch[0], notch[2]], [notch[1], notch[2]], [notch[1], y0]);
  pts.push([x1, y0], [x1, plate], [xc, ridge], [x0, plate]);
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(sh);
  if (nz < 0) { geo.setIndex(Array.from(geo.index.array).reverse()); geo.computeVertexNormals(); }
  const m = new THREE.Mesh(geo, mat); m.position.z = z; m.receiveShadow = true; parent.add(m); return m;
}

// ------------------------------------------------------------------ helpers
// A flat polygon floor (points [x,z]) at height y, UVs in metres.
function polyFloor(parent, pts, y, mat) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; parent.add(m); return m;
}

// ------------------------------------------------------------------ build
export async function build(ctx) {
  const { kit, phys, root } = ctx; const M = kit.M;
  const T = kit.roomInfo('theater'); const Y = T.y; const PLATE = 6.10, RIDGE_Y = 7.00;
  const XC = (T.x0 + T.x1) / 2; const slope = (RIDGE_Y - PLATE) / (T.w / 2);
  const ceilAt = (x) => RIDGE_Y - slope * Math.min(T.w / 2, Math.abs(x - XC));
  const dynamicBits = [];

  // ================================================================= THEATER
  const th = kit.group(root, [0, 0, 0], 0, 'theater');
  // ---- materials
  const slatN = slatTex(kit, 0, 0, 1, true);
  const oakSlat = std({ map: slatTex(kit, 0xf2d0a6, '#3a2716', 3), normalMap: slatN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.62 });
  const darkSlat = std({ map: slatTex(kit, 0x3d3936, '#0b0a0a', 4), normalMap: slatN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.7 });
  const felt = std({ color: 0x0c0c0c, roughness: 1 }); const feltWarm = std({ color: 0x3a2716, roughness: 1 }); // behind the oak slats
  const beamMat = std({ map: grainTex(kit, '#c98a4e', 8), color: 0xffffff, roughness: 0.6 });
  const carpet = std({ map: carpetTex(kit), roughness: 1, normalMap: kit.noiseNormal(256, 2.2, 64, 9), normalScale: new THREE.Vector2(0.7, 0.7) });
  const lr = (rep) => ({ normalMap: kit.tex('assets/ph/leather_red_02/leather_red_02_nor_gl_1k.jpg', { repeat: [rep, rep] }), roughnessMap: kit.tex('assets/ph/leather_red_02/leather_red_02_rough_1k.jpg', { repeat: [rep, rep] }) });
  // dark chocolate leather, low-gloss satin with fine wrinkle normals
  /* espresso leather with a soft satin sheen (clearcoat) so cushions, rolls and seams catch highlights instead of
     merging into one dark mass (p32) */
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x24170f, roughness: 0.58, ...lr(6), normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 0.6, clearcoat: 0.04, clearcoatRoughness: 0.6, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x3a2a20) });
  const leatherDark = new THREE.MeshPhysicalMaterial({ color: 0x1c120c, roughness: 0.62, ...lr(6), normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.5 });
  const seamMat = std({ color: 0x120c08, roughness: 0.9 });
  const ceilCream = std({ color: 0xe8d8c0, roughness: 0.95 });
  const trayMat = std({ color: 0x141414, roughness: 0.35, metalness: 0.2 });
  const screenMat = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: filmStillTex(kit), emissiveIntensity: 1.35, roughness: 0.9 });

  // ---- floor: carpet everywhere
  kit.floorFinish(th, 'theater', carpet, Y, 0.006);
  // ---- vaulted ceiling (gable ends filled below with felt + slats)
  kit.vault(th, T.rect, 'z', PLATE, RIDGE_Y, ceilCream, M.paintWhite, 0, false);
  // light-tight shell: invisible shadow casters just outside the room (no sun leaks onto the slats)
  {
    const occ = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const o = 0.03, t = 0.10;
    const cast = (x0, y0, z0, w, h, d) => { const m = kit.boxAt(th, occ, x0, y0, z0, w, h, d); m.castShadow = true; m.receiveShadow = false; m.userData.keep = true; };
    cast(T.x0 - o - t, Y, T.z0 - 0.4, t, RIDGE_Y + 0.5 - Y, T.d + 0.8);
    cast(T.x1 + o, Y, T.z0 - 0.4, t, RIDGE_Y + 0.5 - Y, T.d + 0.8);
    cast(T.x0 - 0.4, Y, T.z0 - o - t, T.w + 0.8, RIDGE_Y + 0.5 - Y, t);
    cast(T.x0 - 0.4, Y, T.z1 + o, T.w + 0.8, RIDGE_Y + 0.5 - Y, t);
    cast(T.x0 - 0.4, RIDGE_Y + 0.06, T.z0 - 0.4, T.w + 0.8, t, T.d + 0.8);
  }
  for (const [z, nz] of [[T.z0, 1], [T.z1, -1]]) { // gable triangles (felt backing)
    const bg = new THREE.BufferGeometry(); const zz = z + nz * 0.002;
    bg.setAttribute('position', new THREE.Float32BufferAttribute([T.x0, PLATE - 0.01, zz, T.x1, PLATE - 0.01, zz, XC, RIDGE_Y, zz], 3)); bg.computeVertexNormals();
    const mm = felt.clone(); mm.side = THREE.DoubleSide; th.add(new THREE.Mesh(bg, mm));
  }
  // ---- wall backing (black felt) + slats
  const BASE = 0.07; // black recessed base reveal under the slats
  kit.wallPanel(th, [T.x0, T.z1], [T.x0, T.z0], Y, PLATE, [1, 0], feltWarm);
  kit.wallPanel(th, [T.x1, T.z0], [T.x1, T.z1], Y, PLATE, [-1, 0], feltWarm);
  kit.wallPanel(th, [T.x0, T.z0], [T.x1, T.z0], Y, PLATE, [0, 1], felt);
  kit.wallPanel(th, [T.x1, T.z1], [T.x0, T.z1], Y, PLATE, [0, -1], felt);
  const door = { c: 12.40, w: 0.90 }; // th-d on the back wall (slats stop at its casing)
  const SO = 0.022; // slat face stands off the felt
  // left wall slats stand 0.08 m off the felt: hides the neighbouring hip-roof eave that pokes ~5 cm through the wall top
  kit.wallPanel(th, [T.x0, T.z1], [T.x0, T.z0], Y + BASE, PLATE + 0.04, [1, 0], oakSlat, 0.08);
  kit.wallPanel(th, [T.x1, T.z0], [T.x1, T.z1], Y + BASE, PLATE, [-1, 0], oakSlat, SO);
  gableFace(th, T.x0, T.x1, Y + BASE, PLATE, XC, RIDGE_Y, T.z1 - SO, -1, oakSlat, [door.c - door.w / 2 - 0.10, door.c + door.w / 2 + 0.10, Y + 2.42]);
  gableFace(th, T.x0, T.x1, Y + BASE, PLATE, XC, RIDGE_Y, T.z0 + SO, 1, darkSlat);

  // ---- ridge beam
  { const bg = new THREE.BoxGeometry(0.26, T.d + 0.02, 0.32); bg.rotateX(Math.PI / 2); kit.add(th, bg, beamMat, [XC, RIDGE_Y - 0.16 + 0.04, T.cz]); }

  // ---- recessed cans (two rows of 5, bright with a soft starburst) + ceiling speaker on the slopes
  {
    const a = Math.atan(slope);
    const disc = new THREE.CircleGeometry(0.05, 24); disc.rotateX(Math.PI / 2);
    const ring = new THREE.RingGeometry(0.05, 0.068, 24); ring.rotateX(Math.PI / 2);
    const ringMat = std({ color: 0xece4d6, roughness: 0.6 }); const lit = std({ color: 0xffffff, emissive: 0xfff0d6, emissiveIntensity: 9, roughness: 1 });
    const spk = new THREE.CircleGeometry(0.11, 32); spk.rotateX(Math.PI / 2);
    const spkMat = std({ color: 0xe6ddcf, roughness: 0.85 });
    const flare = new THREE.SpriteMaterial({ map: flareTex(kit), color: 0xfff2dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
    const place = (geo, mat, x, z, off) => { const s = x < XC ? 1 : -1; const m = kit.add(th, geo, mat, [x, ceilAt(x) - off, z], [0, 0, s * a], { shadow: false }); m.rotation.order = 'ZYX'; return m; };
    for (const z of [6.60, 7.40, 8.20, 9.00, 9.80]) for (const x of [12.40, 14.62]) {
      place(disc, lit, x, z, 0.004); place(ring, ringMat, x, z, 0.005);
      const sp = new THREE.Sprite(flare); sp.scale.set(0.42, 0.42, 1); sp.position.set(x, ceilAt(x) - 0.03, z); sp.userData.keep = true; th.add(sp);
    }
    place(spk, spkMat, 12.20, 8.60, 0.004);
  }

  // ---- screen wall: black-framed screen, film still, two linear slot vents above
  {
    const SW = 3.20, SH = 1.80, sy = Y + 1.00 + SH / 2, sz = T.z0 + 0.045;
    kit.add(th, kit.rbox(SW, SH, 0.05, 0.01), M.matteBlack, [XC, sy, sz]);
    const scr = kit.add(th, new THREE.PlaneGeometry(SW - 0.06, SH - 0.06), screenMat, [XC, sy, sz + 0.027], [0, 0, 0], { shadow: false });
    scr.userData.keep = true;
    for (const [x, len] of [[XC - 0.50, 0.80], [XC + 0.70, 0.95]]) kit.add(th, kit.box(len, 0.035, 0.03), M.matteBlack, [x, Y + 3.02 + (x > XC ? 0.05 : 0), T.z0 + 0.035]);
  }

  // ---- carpeted riser for the back row (0.30 m step with a visible lighter nosing edge)
  const RISER = { x0: T.x0, x1: 14.92, z0: 8.20, z1: T.z1, h: 0.30 };
  kit.boxAt(th, carpet, RISER.x0, Y, RISER.z0, RISER.x1 - RISER.x0, RISER.h, RISER.z1 - RISER.z0);
  { /* p32: the riser faces read as a lighter grey carpet band under a rounded bullnose nosing, dark toe shadow at the floor */
    const riserCarpet = std({ map: carpetTex(kit, '#5c5c5e', 30), roughness: 1, normalMap: carpet.normalMap, normalScale: new THREE.Vector2(0.7, 0.7) });
    riserCarpet.map.repeat.set(2, 2);
    const nose = std({ color: 0x6a6a6c, roughness: 0.95, normalMap: carpet.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
    const toe = std({ color: 0x1c1c1d, roughness: 1 });
    const L = RISER.x1 - RISER.x0, D = RISER.z1 - RISER.z0;
    kit.boxAt(th, riserCarpet, RISER.x0, Y + 0.02, RISER.z0 - 0.006, L, RISER.h - 0.055, 0.006);
    kit.boxAt(th, riserCarpet, RISER.x1, Y + 0.02, RISER.z0, 0.006, RISER.h - 0.055, D);
    kit.boxAt(th, toe, RISER.x0, Y, RISER.z0 - 0.004, L, 0.02, 0.004);
    kit.boxAt(th, toe, RISER.x1, Y, RISER.z0, 0.004, 0.02, D);
    const bn = new THREE.CapsuleGeometry(0.022, L - 0.044, 4, 12).rotateZ(Math.PI / 2);
    kit.add(th, bn, nose, [RISER.x0 + L / 2, Y + RISER.h - 0.022, RISER.z0 + 0.006]);
    const bs = new THREE.CapsuleGeometry(0.022, D - 0.044, 4, 12).rotateX(Math.PI / 2);
    kit.add(th, bs, nose, [RISER.x1 - 0.006, Y + RISER.h - 0.022, RISER.z0 + D / 2]);
  }
  phys.boxAABB([RISER.x0, Y, RISER.z0], [RISER.x1, Y + RISER.h, RISER.z1]);

  // ---- recliner rows (4 seats each, shared rounded padded arms, aisle tray tables)
  // Each seat: soft leather recliner ~0.6 m between arms (0.85 m with arms), back ~1.05 m tall made of
  // 3 stacked rounded pillow bolsters (2 lumbar + headrest roll) over a padded rear shell.
  const S = 0.60, A = 0.17, AE = 0.20;
  const tilt = 0.18;
  const pillow = (w, h, t, r, puff) => kit.cushion(w, t, h, r, puff, 6); // width x, height y, thickness (puffs toward -z after rotation)
  const recliners = (x0, y0, zc, withTrayRight) => {
    const g = kit.group(th, [x0, y0, zc], 0, 'reclinerRow');
    let x = 0; const arms = []; const seats = [];
    for (let i = 0; i < 4; i++) { const aw = i === 0 ? AE : A; arms.push([x, aw]); x += aw; seats.push(x + S / 2); x += S; }
    arms.push([x, AE]);
    const pipe = (len, axis) => { const c = new THREE.CapsuleGeometry(0.007, len, 3, 8); if (axis === 'x') c.rotateZ(Math.PI / 2); if (axis === 'z') c.rotateX(Math.PI / 2); return c; };
    for (const [ax, aw] of arms) {
      /* tailored square arm box: tight radius, flat padded top panel with piping round its edge, inset front panel */
      const acx = ax + aw / 2;
      kit.add(g, kit.rbox(aw, 0.60, 0.88, 0.025, 3), leather, [acx, 0.30, -0.02]);
      kit.add(g, kit.cushion(aw - 0.01, 0.05, 0.86, 0.02, 0.008, 4), leather, [acx, 0.625, -0.02]);
      for (const sx of [-1, 1]) kit.add(g, pipe(0.84, 'z'), leatherDark, [acx + sx * (aw / 2 - 0.003), 0.602, -0.02]);
      for (const sz of [-1, 1]) kit.add(g, pipe(aw - 0.02, 'x'), leatherDark, [acx, 0.602, -0.02 + sz * 0.437]);
      kit.add(g, kit.box(aw - 0.05, 0.42, 0.006), seamMat, [acx, 0.32, -0.462]);
      kit.add(g, kit.rbox(aw - 0.06, 0.40, 0.012, 0.004), leather, [acx, 0.32, -0.466]);
      kit.add(g, kit.box(aw - 0.03, 0.03, 0.80), M.matteBlack, [acx, 0.015, -0.02]);
    }
    for (const cx of seats) {
      kit.add(g, kit.rbox(S + 0.01, 0.32, 0.80, 0.02, 3), leatherDark, [cx, 0.20, 0.0]);
      /* legrest: flat panel with a seam line */
      kit.add(g, kit.cushion(S - 0.03, 0.06, 0.30, 0.02, 0.006, 4), leather, [cx, 0.22, -0.42], [-Math.PI / 2, 0, 0]);
      kit.add(g, kit.box(S - 0.08, 0.006, 0.004), seamMat, [cx, 0.24, -0.453]);
      /* flat tailored seat cushion with piping along the front edge */
      kit.add(g, kit.cushion(S - 0.01, 0.12, 0.60, 0.03, 0.012, 4), leather, [cx, 0.42, -0.12]);
      kit.add(g, pipe(S - 0.05, 'x'), leatherDark, [cx, 0.478, -0.418]);
      kit.add(g, pipe(S - 0.05, 'x'), leatherDark, [cx, 0.362, -0.418]);
      const bk = kit.group(g, [cx, 0.43, 0.22]); bk.rotation.x = tilt;
      /* back: padded shell + three flat channel panels (lumbar, mid, headrest) divided by deep seams */
      kit.add(bk, kit.rbox(S + 0.02, 0.70, 0.16, 0.03, 3), leatherDark, [0, 0.33, 0.06]);
      kit.add(bk, kit.cushion(S - 0.05, 0.23, 0.07, 0.03, 0.012, 4), leather, [0, 0.12, -0.04], [-Math.PI / 2, 0, 0]);
      kit.add(bk, kit.cushion(S - 0.05, 0.20, 0.07, 0.03, 0.012, 4), leather, [0, 0.345, -0.04], [-Math.PI / 2, 0, 0]);
      kit.add(bk, kit.cushion(S - 0.03, 0.20, 0.09, 0.035, 0.016, 4), leather, [0, 0.56, -0.04], [-Math.PI / 2, 0, 0]);
      for (const sy of [0.235, 0.455]) kit.add(bk, kit.box(S - 0.07, 0.012, 0.05), seamMat, [0, sy, -0.04]);
      for (const sx of [-1, 1]) kit.add(bk, pipe(0.66, 'y'), leatherDark, [sx * (S / 2 + 0.008), 0.33, -0.02]);
      kit.add(bk, pipe(S, 'x'), leatherDark, [0, 0.681, -0.02]);
    }
    if (withTrayRight) { // swivel tray table on the aisle arm
      const ax = arms[4][0] + AE / 2;
      kit.add(g, kit.cyl(0.015, 0.015, 0.10, 12), trayMat, [ax, 0.71, -0.30]);
      kit.add(g, kit.rbox(0.34, 0.022, 0.38, 0.01), trayMat, [ax - 0.02, 0.77, -0.30]);
      kit.add(g, kit.box(0.30, 0.004, 0.34), std({ color: 0x0a0a0a, roughness: 0.25 }), [ax - 0.02, 0.782, -0.30]);
    }
    phys.solidGroup(g); return { g, seats, trayX: arms[4][0] + AE / 2 };
  };
  const RX0 = T.x0 + 0.04;
  const front = recliners(RX0, Y, 7.18, true);
  const backRow = recliners(RX0, Y + RISER.h, 9.06, true);

  // remotes on the trays (dynamic)
  for (const [row, y0] of [[front, Y], [backRow, Y + RISER.h]]) {
    const rem = kit.add(th, kit.rbox(0.045, 0.018, 0.17, 0.008), std({ color: 0x1a1a1a, roughness: 0.4 }), [RX0 + row.trayX - 0.05, y0 + 0.795, row === front ? 6.88 : 8.76], [0, 0.3, 0]);
    dynamicBits.push(rem);
  }

  // ---- wicker basket + dark green throw (front-right corner)
  { // procedural woven basket (rectangular, rolled rim, loop handles) + dark green throw spilling over its left side
    const wr = kit.rng(31);
    const weave = std({ roughness: 0.85, map: kit.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#3a2412'; g.fillRect(0, 0, w, h);
      const n = 20, c = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = 128 + (wr() - 0.5) * 44; g.fillStyle = `rgb(${v},${v * 0.66 | 0},${v * 0.38 | 0})`; /* natural tan wicker (p32) */
        if ((i + j) % 2) g.fillRect(i * c + 1, j * c, c - 2, c); else g.fillRect(i * c, j * c + 1, c, c - 2);
        g.fillStyle = 'rgba(20,10,3,0.55)'; g.fillRect(i * c, j * c, 1.5, c); g.fillRect(i * c, j * c, c, 1);
      }
    }, { repeat: [3, 2] }) });
    const BW = 0.52, BH = 0.48, BD = 0.36, t = 0.018;
    const bsk = kit.group(th, [T.x1 - 0.36, Y + 0.008, T.z0 + 0.34], 0.10, 'basket');
    kit.add(bsk, kit.rbox(BW, 0.02, BD, 0.008), weave, [0, 0.01, 0]);
    for (const s of [-1, 1]) {
      kit.add(bsk, kit.rbox(BW, BH, t, 0.008), weave, [0, BH / 2, s * (BD / 2 - t / 2)]);
      kit.add(bsk, kit.rbox(t, BH, BD, 0.008), weave, [s * (BW / 2 - t / 2), BH / 2, 0]);
      kit.add(bsk, kit.torus(0.05, 0.009, 8, 20, Math.PI), weave, [s * (BW / 2 + 0.002), BH - 0.005, 0], [0, Math.PI / 2, 0]); // handle loop
    }
    const rim = kit.tube([[-BW / 2, BH, -BD / 2], [BW / 2, BH, -BD / 2], [BW / 2, BH, BD / 2], [-BW / 2, BH, BD / 2]], 0.012, 48, true);
    kit.add(bsk, rim, std({ color: 0x6e4826, roughness: 0.8 }));
    /* dark olive fleece throw: one draped sheet (heaped inside, rolling over the front rim, hanging in vertical
       folds down the front-left of the basket, pooling on the carpet) + a soft heap filling the basket */
    const throwMat = std({ color: 0x23270f, roughness: 0.96, side: THREE.DoubleSide, normalMap: kit.noiseNormal(256, 2.5, 48, 21), normalScale: new THREE.Vector2(0.8, 0.8) });
    kit.add(bsk, kit.cushion(BW - 0.07, 0.11, BD - 0.05, 0.05, 0.06), throwMat, [0.02, BH - 0.015, -0.01]);
    {
      const prof = new THREE.CatmullRomCurve3([[-0.06, BH + 0.075], [BD / 2 - 0.03, BH + 0.05], [BD / 2 + 0.012, BH + 0.008], [BD / 2 + 0.028, BH - 0.10], [BD / 2 + 0.034, 0.16], [BD / 2 + 0.05, 0.02], [BD / 2 + 0.10, 0.011], [BD / 2 + 0.17, 0.010]].map(([z, y]) => new THREE.Vector3(0, y, z)));
      const XA = -BW / 2 - 0.035, XB = -BW / 2 + 0.33, NU = 28, NV = 56;
      const geo = new THREE.PlaneGeometry(1, 1, NU, NV); const pos = geo.attributes.position; const fr = kit.rng(77);
      const ph = [fr() * 6.28, fr() * 6.28, fr() * 6.28];
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) + 0.5, v = 0.5 - pos.getY(i); /* u across, v down the drape */
        const x = XA + (XB - XA) * u;
        const vEnd = 1 - 0.30 * Math.pow(u, 1.6); /* hem rises toward the right: diagonal drape */
        const t = Math.min(0.999, v * vEnd);
        const p = prof.getPointAt(t), tan = prof.getTangentAt(t);
        const hang = Math.max(0, Math.min(1, (t - 0.25) / 0.35));
        const fold = hang * (0.020 * Math.sin(x / 0.11 * 6.28 + ph[0]) + 0.008 * Math.sin(x / 0.045 * 6.28 + ph[1])) + (1 - hang) * 0.010 * Math.sin(x / 0.09 * 6.28 + ph[2]);
        const onFloor = p.y < 0.03 ? 0 : 1;
        const nz = -tan.y, ny = tan.z; /* outward normal in the (z, y) profile plane */
        const edgeCurl = 0.012 * Math.pow(Math.abs(u - 0.5) * 2, 4);
        pos.setXYZ(i, x + (1 - hang) * 0.01 * Math.sin(v * 9), Math.max(0.006, p.y + (ny * fold + edgeCurl) * onFloor), p.z + nz * fold + (onFloor ? 0 : fold * 0.8));
      }
      geo.computeVertexNormals();
      kit.add(bsk, geo, throwMat);
      /* rolled selvedge along the visible hanging edge */
      const ePts = []; for (let k = 0; k <= 20; k++) { const t = 0.12 + 0.86 * k / 20; const p = prof.getPointAt(t); ePts.push([XA - 0.004, Math.max(0.012, p.y), p.z]); }
      kit.add(bsk, kit.tube(ePts, 0.008, 40), throwMat);
    }
    phys.dynamic(bsk, { mass: 1.2, shape: 'box', friction: 0.8 });
  }

  // ---- one soft fill light (warm, non-shadow) for the theater
  { const fill = new THREE.PointLight(0xfff4e6, 3.2, 8, 1.3); fill.position.set(XC + 0.4, Y + 1.95, 8.2); fill.castShadow = false; th.add(fill); }

  // ================================================================= GUEST BATH
  const B = kit.roomInfo('guestBath'); const BY = B.y; const BC = PLATE;
  const gb = kit.group(root, [0, 0, 0], 0, 'guestBath');
  const GT = geoTileTex(kit);
  const tileMat = std({ map: GT.map, roughness: 0.58, normalMap: GT.normal, normalScale: new THREE.Vector2(0.55, 0.55) });
  const floorMat = std({ map: porcelainTex(kit), roughness: 0.45 });
  const nickel = M.brushedNickel; const bronze = new THREE.MeshPhysicalMaterial({ color: 0xa49e94, roughness: 0.42, metalness: 1, envMapIntensity: 0.75 }); /* brushed nickel (warm, satin; was reading as chrome in p37) */ const ceramic = std({ color: 0xf6f5f2, roughness: 0.12 });
  const pw = M.paintWhite;
  const frosted = std({ color: 0xffffff, emissive: 0xd8dcde, emissiveIntensity: 0.9, roughness: 0.9, map: kit.canvasTex(128, 256, (g, w, h) => { const fr = kit.rng(61); g.fillStyle = '#e2e4e4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { const v = 200 + fr() * 50; g.fillStyle = `rgba(${v},${v},${v + 3},0.35)`; g.fillRect(fr() * w, fr() * h, 2, 2); } const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(150,150,150,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });
  const PART = { x0: 6.55, x1: 6.70, z0: 6.25, z1: B.z1 }; // shower partition (white outside, tile inside)
  const SH = { x0: B.x0, x1: PART.x0, z0: PART.z0, z1: B.z1 };
  const DW = { z0: 6.10, z1: 6.25, x0: 5.45, x1: PART.x0, head: BY + 2.30 }; // shower-room door wall + opening

  // ---- floor (room + turret bay), dark stone in the shower
  polyFloor(gb, [[B.x0, B.z1], [B.x1, B.z1], [B.x1, B.z0], [7.66, B.z0], [7.24, 3.83], [6.26, 3.83], [5.84, B.z0], [B.x0, B.z0]], BY + 0.006, floorMat);
  {
    const sr = kit.rng(23);
    const stone = std({ roughness: 0.6, normalMap: kit.noiseNormal(256, 1.6, 32, 12), normalScale: new THREE.Vector2(0.4, 0.4), map: kit.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#353331'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { const v = 52 + (sr() - 0.5) * 22; g.fillStyle = `rgba(${v},${v},${v + 1},0.25)`; g.beginPath(); g.ellipse(sr() * w, sr() * h, 6 + sr() * 30, 5 + sr() * 20, sr() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 12000; i++) { const v = 60 + (sr() - 0.5) * 50; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(sr() * w, sr() * h, 1, 1); }
      g.fillStyle = '#58595a'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(0, h / 2 - 1, w, 3); g.fillRect(w / 2 - 1, 0, 3, h);
    }, { repeat: [1 / 1.2, 1 / 1.2] }) });
    polyFloor(gb, [[SH.x0, SH.z0], [SH.x1, SH.z0], [SH.x1, SH.z1], [SH.x0, SH.z1]], BY + 0.010, stone);
    kit.boxAt(gb, stone, DW.x0, BY, DW.z0 - 0.01, DW.x1 - DW.x0, 0.03, DW.z1 - DW.z0 + 0.02); // threshold
  }

  // ---- shower partition (x 6.55-6.70) with a tall frosted window (borrowed light) and a recessed niche
  {
    const W1 = { z0: 6.34, z1: 6.80, y0: BY + 0.30, y1: BY + 2.36, dep: 0.07 }; // frosted window recess
    const N1 = { z0: 6.88, z1: 7.12, y0: BY + 1.02, y1: BY + 1.66, dep: 0.10 }; // niche
    const T = PART.x1 - PART.x0;
    const solid = (z0, z1) => kit.boxAt(gb, pw, PART.x0, BY, z0, T, BC - BY, z1 - z0);
    solid(DW.z0, W1.z0); solid(W1.z1, N1.z0); solid(N1.z1, PART.z1);
    const shTile = tileMat.clone(); shTile.color = new THREE.Color(0xd0b8a0);
    const pz = (a, b, y0, y1) => kit.wallPanel(gb, [PART.x0, a], [PART.x0, b], y0, y1, [-1, 0], shTile);
    pz(SH.z0, W1.z0, BY, BC); pz(W1.z1, N1.z0, BY, BC); pz(N1.z1, SH.z1, BY, BC);
    const nicheMat = std({ color: 0xbcab9c, roughness: 0.5 });
    for (const [O, side, back] of [[W1, pw, frosted], [N1, nicheMat, shTile]]) {
      kit.boxAt(gb, pw, PART.x0, BY, O.z0, T, O.y0 - BY, O.z1 - O.z0); kit.boxAt(gb, pw, PART.x0, O.y1, O.z0, T, BC - O.y1, O.z1 - O.z0);
      kit.boxAt(gb, pw, PART.x0 + O.dep, O.y0, O.z0, T - O.dep, O.y1 - O.y0, O.z1 - O.z0);
      pz(O.z0, O.z1, BY, O.y0); pz(O.z0, O.z1, O.y1, BC);
      const d = O.dep, e = 0.004;
      kit.boxAt(gb, side, PART.x0 - e, O.y0, O.z0, d + e, e, O.z1 - O.z0); kit.boxAt(gb, side, PART.x0 - e, O.y1 - e, O.z0, d + e, e, O.z1 - O.z0); // sill / head
      kit.boxAt(gb, side, PART.x0 - e, O.y0, O.z0, d + e, O.y1 - O.y0, e); kit.boxAt(gb, side, PART.x0 - e, O.y0, O.z1 - e, d + e, O.y1 - O.y0, e); // returns
      kit.wallPanel(gb, [PART.x0 + d, O.z1], [PART.x0 + d, O.z0], O.y0, O.y1, [-1, 0], back, -0.001);
    }
    // white surround (casing) around the window inside the shower
    for (const [z0, y0, dz, dy] of [[W1.z0 - 0.03, W1.y0 - 0.03, 0.03, W1.y1 - W1.y0 + 0.06], [W1.z1, W1.y0 - 0.03, 0.03, W1.y1 - W1.y0 + 0.06], [W1.z0, W1.y1, W1.z1 - W1.z0, 0.03], [W1.z0, W1.y0 - 0.03, W1.z1 - W1.z0, 0.03]])
      kit.boxAt(gb, pw, PART.x0 - 0.012, y0, z0, 0.012, dy, dz);
    phys.boxAABB([PART.x0, BY, DW.z0], [PART.x1, BC, PART.z1]);
    // tile on the shower back + west walls
    kit.wallPanel(gb, [SH.x0, SH.z1], [SH.x0, SH.z0], BY, BC, [1, 0], shTile);
    kit.wallPanel(gb, [SH.x1, SH.z1], [SH.x0, SH.z1], BY, BC, [0, -1], shTile);
    // window light: soft daylight from the frosted pane, falling off down the back wall
    { const wl = new THREE.PointLight(0xf4f6ff, 1.6, 3.2, 1.6); wl.position.set(PART.x0 - 0.25, BY + 1.9, 6.55); wl.castShadow = false; gb.add(wl); }
  }

  // ---- shower-room door wall (z 5.80-5.95): white stub, header, cased opening, open oak door with black hinges
  {
    kit.boxAt(gb, pw, SH.x0, BY, DW.z0, DW.x0 - SH.x0, BC - BY, DW.z1 - DW.z0);
    kit.boxAt(gb, pw, SH.x0, DW.head, DW.z0, PART.x1 - SH.x0, BC - DW.head, DW.z1 - DW.z0);
    phys.boxAABB([SH.x0, BY, DW.z0], [DW.x0, BC, DW.z1]);
    const cas = std({ color: 0xf6f5f1, roughness: 0.6 }); const cw = 0.07, ct = 0.016;
    kit.boxAt(gb, cas, DW.x0 - cw, BY, DW.z0 - ct, cw, DW.head - BY + cw, ct); kit.boxAt(gb, cas, DW.x1, BY, DW.z0 - ct, cw, DW.head - BY + cw, ct);
    kit.boxAt(gb, cas, DW.x0 - cw, DW.head, DW.z0 - ct, DW.x1 - DW.x0 + 2 * cw, cw, ct);
    // door slab hinged on the partition-end jamb, swung open 90 deg into the bath (against nothing)
    const DWd = 0.95, DT = 0.044;
    const door = kit.group(gb, [DW.x1 - DT / 2 - 0.004, BY + 0.012, DW.z0 - 0.01], 0, 'gbDoor');
    kit.add(door, kit.box(DT, DW.head - BY - 0.02, DWd), M.oakDoor, [0, (DW.head - BY - 0.02) / 2, -DWd / 2]);
    kit.add(door, kit.box(0.013, DW.head - BY - 0.02, 0.005), cas, [0, (DW.head - BY - 0.02) / 2, -DWd + 0.0025]); // painted edge
    for (const hy of [0.25, 1.05, 1.95]) { kit.add(door, kit.rbox(0.012, 0.10, 0.035, 0.003), M.blackMetal, [DT / 2 + 0.003, hy, 0.012]); kit.add(door, kit.cyl(0.009, 0.009, 0.11, 12), M.blackMetal, [DT / 2 - 0.004, hy, 0.006]); }
    kit.add(door, kit.rbox(0.13, 0.018, 0.018, 0.006), M.blackMetal, [-DT / 2 - 0.03, 1.0, -DWd + 0.07]);
    kit.add(door, kit.rbox(0.13, 0.018, 0.018, 0.006), M.blackMetal, [DT / 2 + 0.03, 1.0, -DWd + 0.07]);
    phys.solidGroup(door);
  }

  // ---- shower glass: fixed panel + hinged door on black hinges (slight green edge), fixtures
  {
    const GZ = SH.z0 + 0.07, gh = 2.05;
    const sg = new THREE.MeshPhysicalMaterial({ color: 0xe6f2ec, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1 });
    const edge = std({ color: 0x8fb8a8, roughness: 0.1, transparent: true, opacity: 0.75 });
    for (const [gx0, gw] of [[SH.x0 + 0.01, 0.24], [SH.x0 + 0.265, PART.x0 - SH.x0 - 0.275]]) {
      const gp = kit.add(gb, new THREE.PlaneGeometry(gw, gh), sg, [gx0 + gw / 2, BY + 0.03 + gh / 2, GZ], [0, 0, 0], { shadow: false }); gp.userData.keep = true;
      for (const ex of [gx0, gx0 + gw - 0.01]) kit.boxAt(gb, edge, ex, BY + 0.03, GZ - 0.005, 0.01, gh, 0.01).userData.keep = true;
      kit.boxAt(gb, edge, gx0, BY + 0.03 + gh - 0.01, GZ - 0.005, gw, 0.01, 0.01).userData.keep = true;
    }
    kit.boxAt(gb, M.matteBlack, SH.x0, BY + 0.03, GZ - 0.012, 0.012, gh, 0.024); // wall channel
    for (const hy of [0.30, 1.72]) kit.boxAt(gb, M.blackMetal, PART.x0 - 0.035, BY + hy, GZ - 0.018, 0.035, 0.10, 0.036);
    kit.add(gb, kit.cyl(0.01, 0.01, 0.22, 12), M.blackMetal, [PART.x0 - 0.16, BY + 1.05, GZ - 0.04]); // door pull
    phys.boxAABB([SH.x0, BY, GZ - 0.01], [SH.x0 + 0.26, BY + gh, GZ + 0.01]);
    // square brushed-nickel rain head on a wall arm from the back wall
    const hx = 5.93, hz = 6.78, hy = BY + 2.15;
    kit.add(gb, kit.rbox(0.025, 0.025, SH.z1 - hz, 0.006), bronze, [hx, hy + 0.06, (SH.z1 + hz) / 2]);
    kit.add(gb, kit.rbox(0.07, 0.07, 0.012, 0.003), bronze, [hx, hy + 0.06, SH.z1 - 0.006]);
    kit.add(gb, kit.box(0.022, 0.06, 0.022), bronze, [hx, hy + 0.03, hz]);
    kit.add(gb, kit.rbox(0.28, 0.014, 0.28, 0.004), bronze, [hx, hy, hz]);
    // slide bar + handshower + hose on the west wall near the back corner, square valve trims below
    const bz = 7.02, bx = SH.x0 + 0.045;
    kit.add(gb, kit.cyl(0.011, 0.011, 0.95, 16), bronze, [bx, BY + 1.42, bz]);
    for (const yy of [0.95, 1.89]) { kit.add(gb, kit.rbox(0.05, 0.04, 0.035, 0.008), bronze, [SH.x0 + 0.025, BY + yy, bz]); }
    kit.add(gb, kit.rbox(0.04, 0.05, 0.04, 0.008), bronze, [bx, BY + 1.70, bz]); // slider
    const hs = kit.group(gb, [bx + 0.02, BY + 1.80, bz - 0.02], 0); hs.rotation.z = -0.55;
    kit.add(hs, kit.rbox(0.024, 0.20, 0.024, 0.006), bronze, [0, 0, 0]);
    kit.add(hs, kit.rbox(0.07, 0.03, 0.07, 0.006), bronze, [0.0, 0.11, 0]);
    kit.add(gb, kit.tube([[bx + 0.01, BY + 1.70, bz - 0.01], [bx + 0.04, BY + 1.2, bz - 0.04], [bx + 0.07, BY + 0.80, bz - 0.06], [SH.x0 + 0.03, BY + 0.82, 6.80]], 0.007, 40), bronze);
    for (const [vy, vz, s2] of [[1.12, 6.80, 0.15], [1.12, 6.60, 0.11]]) {
      kit.add(gb, kit.rbox(0.012, s2, s2, 0.004), bronze, [SH.x0 + 0.006, BY + vy, vz]);
      /* p37: square trim, short square hub, flat paddle lever running parallel to the wall and angled down */
      kit.add(gb, kit.rbox(0.03, 0.034, 0.034, 0.004), bronze, [SH.x0 + 0.03, BY + vy, vz]);
      kit.add(gb, kit.rbox(0.014, 0.022, 0.11, 0.005), bronze, [SH.x0 + 0.05, BY + vy - 0.015, vz - 0.045], [-0.35, 0, 0]);
    }
    kit.add(gb, new THREE.CircleGeometry(0.05, 20).rotateX(-Math.PI / 2), bronze, [5.93, BY + 0.013, 6.70]); // drain
  }

  // ---- frosted (obscured) glass inside the three turret windows
  for (const [mx, mz, dx, dz, w] of [[6.11, 4.13, 0.486, -0.874, 0.75], [6.75, 3.83, 1, 0, 1.05], [7.39, 4.13, 0.486, 0.874, 0.75]]) {
    const nrm = mz === 3.83 ? [0, 1] : (mx < 6.75 ? [0.874, 0.486] : [-0.874, 0.486]);
    kit.wallPanel(gb, [mx - dx * w / 2, mz - dz * w / 2], [mx + dx * w / 2, mz + dz * w / 2], BY + 0.80, BY + 2.30, nrm, frosted, 0.02);
  }

  // ---- vanity wall: geometric tile panel, shaker white-oak vanity, quartz top, sink, faucet, black mirror
  const V = { x0: PART.x1, x1: B.x1, d: 0.56 };
  kit.wallPanel(gb, [V.x1, B.z1], [V.x0, B.z1], BY, BC, [0, -1], tileMat);
  {
    const W = V.x1 - V.x0; const van = kit.group(gb, [(V.x0 + V.x1) / 2, BY, B.z1], Math.PI, 'vanity'); // local +z faces the room (-z world)
    const oak = M.oakCabinet.clone(); oak.color = new THREE.Color(0xffe6c4).multiplyScalar(1.3);
    const oakPanel = oak.clone(); oakPanel.color = new THREE.Color(0xffe6c4).multiplyScalar(1.12);
    const reveal = std({ color: 0x4a3420, roughness: 0.8 });
    const H = 0.86, KICK = 0.09, D = V.d; const FZ = D - 0.01; // face-frame front plane
    kit.boxAt(van, reveal, -W / 2, KICK, 0, W, H - 0.17 - KICK, FZ - 0.02); // carcass (dark: reads as reveal lines)
    kit.boxAt(van, M.matteBlack, -W / 2 + 0.03, 0, 0, W - 0.06, KICK, FZ - 0.06);
    for (const sx of [-W / 2, W / 2 - 0.02]) kit.boxAt(van, oak, sx, KICK, 0, 0.02, H - KICK, FZ); // finished ends
    kit.boxAt(van, reveal, -W / 2, H - 0.17, FZ - 0.03, W, 0.17, 0.01); // dark backer behind the top fronts
    // face frame: stiles + rails
    const ST = 0.06, MS = 0.035, COL = (W - 2 * ST - 2 * MS) * 0.3, CEN = W - 2 * ST - 2 * MS - 2 * COL;
    const xs = [-W / 2, -W / 2 + ST, -W / 2 + ST + COL, -W / 2 + ST + COL + MS, -W / 2 + ST + COL + MS + CEN, -W / 2 + ST + COL + 2 * MS + CEN, W / 2 - ST];
    const ff = (x, y, w, h) => kit.boxAt(van, oak, x, y, FZ - 0.02, w, h, 0.02);
    ff(xs[0], KICK, ST, H - KICK); ff(xs[6], KICK, ST, H - KICK); ff(xs[2], KICK, MS, H - KICK); ff(xs[4], KICK, MS, H - KICK);
    const yB = KICK + 0.04, yT = H - 0.035; ff(-W / 2, KICK, W, 0.04); ff(-W / 2, yT, W, 0.035);
    const D1 = 0.15, R = 0.03, D2 = (yT - yB - D1 - 2 * R) / 2;
    for (const x of [xs[1], xs[5]]) { ff(x, yT - D1 - R, COL, R); ff(x, yB + D2, COL, R); }
    // shaker fronts (inset, 4 mm reveal): frame + recessed darker panel + shadow line at the panel's top/left
    const gap = 0.004;
    const front = (x, y, w, h, fw) => {
      x += gap; y += gap; w -= 2 * gap; h -= 2 * gap; const z = FZ - 0.02;
      kit.boxAt(van, oak, x, y, z, w, fw, 0.02); kit.boxAt(van, oak, x, y + h - fw, z, w, fw, 0.02);
      kit.boxAt(van, oak, x, y + fw, z, fw, h - 2 * fw, 0.02); kit.boxAt(van, oak, x + w - fw, y + fw, z, fw, h - 2 * fw, 0.02);
      kit.boxAt(van, oakPanel, x + fw, y + fw, z, w - 2 * fw, h - 2 * fw, 0.011);
      kit.boxAt(van, reveal, x + fw, y + h - fw - 0.004, z + 0.011, w - 2 * fw, 0.004, 0.002);
      kit.boxAt(van, reveal, x + w - fw - 0.003, y + fw, z + 0.011, 0.003, h - 2 * fw, 0.002);
    };
    const hPull = (cx, cy, L) => {
      kit.add(van, kit.cyl(0.0065, 0.0065, L, 14), nickel, [cx, cy, FZ + 0.032], [0, 0, Math.PI / 2]);
      for (const s2 of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.032, 10), nickel, [cx + s2 * (L / 2 - 0.02), cy, FZ + 0.016], [Math.PI / 2, 0, 0]);
    };
    const vPull = (cx, cy, L) => {
      kit.add(van, kit.cyl(0.0065, 0.0065, L, 14), nickel, [cx, cy, FZ + 0.032]);
      for (const s2 of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.032, 10), nickel, [cx, cy + s2 * (L / 2 - 0.02), FZ + 0.016], [Math.PI / 2, 0, 0]);
    };
    for (const x of [xs[1], xs[5]]) {
      front(x, yT - D1, COL, D1, 0.035); hPull(x + COL / 2, yT - D1 / 2, 0.16);
      front(x, yB + D2 + R, COL, D2, 0.05); hPull(x + COL / 2, yB + D2 + R + D2 / 2 + 0.02, 0.16);
      front(x, yB, COL, D2, 0.05); hPull(x + COL / 2, yB + D2 / 2 + 0.02, 0.16);
    }
    const dw = CEN / 2;
    front(xs[3], yB, dw, yT - yB, 0.06); front(xs[3] + dw, yB, dw, yT - yB, 0.06);
    vPull(xs[3] + dw - 0.035, yT - 0.20, 0.16); vPull(xs[3] + dw + 0.035, yT - 0.20, 0.16);
    // quartz top: 3 cm slab with an eased edge and an undermount sink opening (one extruded piece)
    const TT = 0.03, ty = H, TD = D + 0.02, sz = 0.29, SWd = 0.46, SDp = 0.32;
    const rr = (cx, cy, w, h, r0) => { const pts = []; for (const [qx, qy, a0] of [[w / 2 - r0, h / 2 - r0, 0], [-w / 2 + r0, h / 2 - r0, Math.PI / 2], [-w / 2 + r0, -h / 2 + r0, Math.PI], [w / 2 - r0, -h / 2 + r0, 1.5 * Math.PI]]) for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * Math.PI / 2; pts.push([cx + qx + r0 * Math.cos(a), cy + qy + r0 * Math.sin(a)]); } return pts; };
    const bev = 0.005;
    const topGeo = kit.extrude([[-W / 2 - 0.005 + bev, bev], [W / 2 + 0.005 - bev, bev], [W / 2 + 0.005 - bev, TD - bev], [-W / 2 - 0.005 + bev, TD - bev]], TT - 2 * bev, bev, [rr(0, sz, SWd, SDp, 0.04).reverse()]);
    topGeo.rotateX(Math.PI / 2);
    kit.add(van, topGeo, M.whiteQuartz, [0, ty + TT - bev, 0]);
    const bowl = new THREE.Mesh(new THREE.BoxGeometry(SWd - 0.01, 0.15, SDp - 0.01), std({ color: 0xf7f6f3, roughness: 0.15, side: THREE.BackSide }));
    bowl.position.set(0, ty - 0.075 + 0.001, sz); van.add(bowl);
    kit.add(van, new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2), nickel, [0, ty - 0.147, sz + 0.03]);
    // widespread 3-piece faucet: short square-ish spout, two small lever handles
    const fz = 0.07, fy = ty + TT;
    kit.add(van, kit.cyl(0.024, 0.026, 0.012, 20), nickel, [0, fy + 0.006, fz]);
    kit.add(van, kit.cyl(0.015, 0.016, 0.10, 16), nickel, [0, fy + 0.06, fz]);
    kit.add(van, kit.rbox(0.03, 0.026, 0.12, 0.007), nickel, [0, fy + 0.10, fz + 0.055]);
    kit.add(van, kit.cyl(0.009, 0.009, 0.012, 12), nickel, [0, fy + 0.083, fz + 0.105]);
    for (const s2 of [-1, 1]) {
      kit.add(van, kit.cyl(0.02, 0.022, 0.012, 16), nickel, [s2 * 0.17, fy + 0.006, fz]);
      kit.add(van, kit.cyl(0.013, 0.014, 0.045, 16), nickel, [s2 * 0.17, fy + 0.03, fz]);
      kit.add(van, kit.rbox(0.014, 0.012, 0.06, 0.004), nickel, [s2 * 0.17, fy + 0.058, fz + 0.025], [0.25, 0, 0]);
    }
    phys.solidGroup(van); // cabinet + top only (mirror / decor added after)
    // mirror: thin black metal frame + real reflection
    const MW = 0.66, MH = 1.05, my = H + 0.19 + MH / 2, mz = 0.012, fw = 0.018;
    kit.add(van, kit.box(MW, fw, 0.02), M.blackMetal, [0, my + MH / 2 - fw / 2, mz]); kit.add(van, kit.box(MW, fw, 0.02), M.blackMetal, [0, my - MH / 2 + fw / 2, mz]);
    kit.add(van, kit.box(fw, MH, 0.02), M.blackMetal, [-MW / 2 + fw / 2, my, mz]); kit.add(van, kit.box(fw, MH, 0.02), M.blackMetal, [MW / 2 - fw / 2, my, mz]);
    const mirror = new Reflector(new THREE.PlaneGeometry(MW - 2 * fw + 0.004, MH - 2 * fw + 0.004), { textureWidth: 768, textureHeight: 1024, color: 0xd8dada, clipBias: 0.003 });
    mirror.position.set(0, my, mz + 0.002); mirror.userData.keep = true; mirror.name = 'mirror'; van.add(mirror);
    // counter decor (dynamic): white ceramic bird vase, tissue box
    const vase = kit.group(van, [0.55, ty + TT, 0.22], -0.4);
    kit.add(vase, kit.sphere(0.07, 24, 16), ceramic, [0, 0.06, 0]).scale.set(1.25, 0.85, 0.9);
    kit.add(vase, kit.tube([[0.07, 0.07, 0], [0.11, 0.12, 0], [0.12, 0.17, 0]], 0.018, 16), ceramic);
    kit.add(vase, kit.cyl(0.03, 0.04, 0.03, 16), ceramic, [-0.07, 0.10, 0], [0, 0, 0.6]);
    dynamicBits.push(vase);
    const tb = kit.add(van, kit.rbox(0.13, 0.05, 0.11, 0.006), ceramic, [-0.55, ty + TT + 0.025, 0.32], [0, 0.2, 0]); dynamicBits.push(tb);
  }

  // ---- east wall: beach print in a thick white mat + white frame, nickel towel bar, outlet
  {
    const ax = B.x1, az = 6.78, ay = BY + 1.86, AW = 0.66, AH = 0.84;
    const art = kit.group(gb, [ax, ay, az], -Math.PI / 2, 'art');
    kit.add(art, kit.rbox(AW, AH, 0.04, 0.004), std({ color: 0xf4f3ef, roughness: 0.6 }), [0, 0, 0.02]);
    kit.add(art, new THREE.PlaneGeometry(AW - 0.06, AH - 0.06), std({ color: 0xfbfbf9, roughness: 0.85 }), [0, 0, 0.0405]);
    kit.add(art, new THREE.PlaneGeometry(AW - 0.20, AH - 0.22), std({ map: beachArtTex(kit), roughness: 0.6 }), [0, 0.01, 0.042]);
    const tbz0 = 6.62, tbz1 = 7.08, ty2 = BY + 1.32;
    kit.add(gb, kit.cyl(0.009, 0.009, tbz1 - tbz0, 12), nickel, [ax - 0.07, ty2, (tbz0 + tbz1) / 2], [Math.PI / 2, 0, 0]);
    for (const z of [tbz0, tbz1]) { kit.add(gb, kit.cyl(0.006, 0.006, 0.07, 10), nickel, [ax - 0.035, ty2, z], [0, 0, Math.PI / 2]); kit.add(gb, kit.cyl(0.022, 0.022, 0.012, 16), nickel, [ax - 0.006, ty2, z], [0, 0, Math.PI / 2]); }
    kit.add(gb, kit.box(0.008, 0.115, 0.07), std({ color: 0xf6f6f4, roughness: 0.5 }), [ax - 0.004, BY + 1.07, 7.12]);
  }

  // ---- ceiling: can lights, speaker, return-air grille
  /* the turret bay lies outside the room rect, so the shell's ceiling stopped at z=B.z0 and you looked up into the dark
     underside of the turret roof: close it with a flat ceiling over the bay polygon (faces down) */
  { const bay = new THREE.Shape([[B.x1 - 0.49, B.z0 + 0.02], [7.24, 3.83], [6.26, 3.83], [5.84, B.z0 + 0.02]].map(([x, z]) => new THREE.Vector2(x, z)));
    const cg = new THREE.ShapeGeometry(bay); cg.rotateX(Math.PI / 2);
    const cm = M.ceilingWhite.clone(); cm.side = THREE.DoubleSide;
    kit.add(gb, cg, cm, [0, BC - 0.18, 0], [0, 0, 0], { shadow: false }); /* 18 cm bay header: the shell's sw-block eave soffit runs through the bay at ~y 5.97-6.08 */ }
  kit.canLights(gb, [[7.42, 6.30], [5.93, 6.55], [6.75, 4.70]], BC, 0.045);
  kit.add(gb, new THREE.CircleGeometry(0.10, 28).rotateX(Math.PI / 2), std({ color: 0xe8e6e1, roughness: 0.85 }), [7.42, BC - 0.004, 5.55], [0, 0, 0], { shadow: false });
  kit.add(gb, kit.box(0.30, 0.01, 0.22), std({ color: 0xdedcd7, roughness: 0.7 }), [7.75, BC - 0.005, 6.75]);

  // ---- dynamics + merge
  for (const m of dynamicBits) phys.dynamic(m, { mass: 0.4, shape: 'box', friction: 0.8 });
  kit.mergeStatic(root);
}
