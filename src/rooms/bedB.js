// Piece: bedB — Bedroom B (front NE corner) + bath B + closet
// Owned rooms: bedB, bathB, closetB | Reference photos: p27, p28, p29
//
// Bedroom B (p27, p28): hipped (tray-vault) ceiling springing from all four walls at ~2.5 m with a white
// 3-blade fan at the peak, cans + speaker grilles + HVAC grilles on the slopes. Grey hand-hatched diamond
// wallpaper on the window wall (x = 22.80) behind a low charcoal channel-tufted bed with a crinkled teal
// throw, black 2-drawer nightstands with glossy teal lamps, black window cornice. White shaker built-in
// wardrobe (4 doors over 3 rows of drawers) on the street wall (z = 0.65) with an "IT'S OK" sign. Long
// rift-oak built-in desk on the hall wall (x = 17.50): drawer pedestal, kneehole, cabinet; black elbow
// chair on a clear mat, wall TV, two white floating shelves, teal bottle vase. Pool-photo art on the bath wall.
// Bath B (p29): Nero Marquina black marble walk-in shower (knee wall + frameless glass), oak vanity with
// thick black marble top, matte black fixtures, large grey porcelain floor, highland-cow print, black towels.
import * as THREE from 'three';

export const piece = { rooms: ["bedB", "bathB", "closetB"], photos: ["p27", "p28", "p29"] };
export const ownCeiling = ['bedB'];
export const views = {
  p27: { pos: [17.64, 4.60, 5.86], look: [22.80, 4.30, 0.70], fov: 74 },
  p28: { pos: [21.30, 4.60, 1.80], look: [17.50, 4.42, 4.20], fov: 72 },
  p29: { pos: [20.14, 4.66, 6.22], look: [21.84, 4.50, 8.40], fov: 80 },
};

const std = (o) => new THREE.MeshStandardMaterial(o);
const physMat = (o) => new THREE.MeshPhysicalMaterial(o);

// ------------------------------------------------------------------ procedural textures (no canvas filters)
function wallpaperTex(kit) { // light-grey linen weave with a fine, low-contrast hatched diamond lattice (~0.22 m diamonds)
  const r = kit.rng(27);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#dedcd7'; g.fillRect(0, 0, w, h);
    // linen ground: fine horizontal + vertical slubs
    for (let i = 0; i < 9000; i++) { const v = 214 + (r() - 0.5) * 26; g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`; if (r() < 0.5) g.fillRect(r() * w, r() * h, 3 + r() * 10, 1); else g.fillRect(r() * w, r() * h, 1, 3 + r() * 10); }
    // diamond lattice: bands of 4 fine parallel hatch lines, only ~8% darker than the ground
    const P = 256; // two diamonds per tile
    for (let k = -2 * w; k <= 2 * w; k += P) for (let j = -2; j <= 1; j++) {
      const v = 150 + r() * 10; g.strokeStyle = `rgba(${v},${v},${v - 4},0.6)`; g.lineWidth = 1.3;
      const o = j * 3.2;
      g.beginPath(); g.moveTo(k + o, 0); g.lineTo(k + o + h, h); g.stroke();
      g.beginPath(); g.moveTo(k + o, h); g.lineTo(k + o + h, 0); g.stroke();
    }
  }, { repeat: [1 / 0.44, 1 / 0.44] });
}
function marbleTex(kit, seed = 3, size = 1024) { // Nero Marquina (honed): warm charcoal, sparse straight thin white veins, few branching ones
  const r = kit.rng(seed);
  return kit.canvasTex(size, size, (g, w, h) => {
    g.fillStyle = '#262625'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const v = 38 + (r() - 0.5) * 14; g.fillStyle = `rgba(${v + 2},${v + 1},${v - 1},0.20)`; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 160, 25 + r() * 90, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 14000; i++) { const v = 28 + r() * 30; g.fillStyle = `rgba(${v},${v},${v - 2},0.16)`; g.fillRect(r() * w, r() * h, 1, 1); }
    const line = (pts, lw, a) => { // draws with wrap-around copies so the tile repeats seamlessly
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.strokeStyle = `rgba(236,235,232,${a})`; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath();
        pts.forEach(([px, py], i) => i ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)); g.stroke();
      }
    };
    // crooked, branching veins: short jittered steps with occasional sharp kinks, side branches that taper
    const vein = (x, y, ang, len, lw, a, depth) => {
      const pts = [[x, y]]; let cx = x, cy = y, ca = ang; const kids = [];
      for (let s = 0; s < len; s += 5) { // long, nearly straight diagonal runs with rare small kinks
        if (r() < 0.03) ca += (r() - 0.5) * 0.7; else ca += (r() - 0.5) * 0.08;
        ca += (ang - ca) * 0.08;
        cx += Math.cos(ca) * 5; cy += Math.sin(ca) * 5; pts.push([cx, cy]);
        if (depth < 2 && r() < 0.008) kids.push([cx, cy, ca + (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.6)]);
      }
      line(pts, lw * 2.5, a * 0.06); line(pts, lw, a);
      for (const [kx, ky, ka] of kids) vein(kx, ky, ka, len * (0.15 + r() * 0.25), Math.max(0.6, lw * 0.75), a * 0.8, depth + 1);
    };
    const s = size / 1024;
    for (let i = 0; i < 3; i++) vein(r() * w, r() * h, -0.75 + (r() - 0.5) * 0.4, (600 + r() * 500) * s, (0.9 + r() * 0.5) * s, 0.75, 0); // main diagonal veins
    for (let i = 0; i < 4; i++) vein(r() * w, r() * h, 0.7 + (r() - 0.5) * 0.5, (150 + r() * 250) * s, 0.7 * s, 0.45, 1); // sparse fine cross veins
  }, { repeat: [1 / 1.6, 1 / 1.6] });
}
function porcelainTex(kit, tw, th, base, seed) { // large-format grey porcelain, one tile per texture
  const r = kit.rng(seed);
  return kit.canvasTex(512, Math.round(512 * th / tw), (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { const v = (r() - 0.5) * 18; g.fillStyle = `rgba(${128 + v},${126 + v},${122 + v},0.10)`; g.beginPath(); g.ellipse(r() * w, r() * h, 15 + r() * 60, 10 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 6000; i++) { const v = 110 + r() * 50; g.fillStyle = `rgba(${v},${v},${v},0.12)`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.fillStyle = 'rgba(70,68,66,0.8)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  }, { repeat: [1 / tw, 1 / th] });
}
function rugTex(kit) { // tweedy charcoal / white heathered weave (whole rug on one texture, no tiling)
  const r = kit.rng(28);
  return kit.canvasTex(1024, 1366, (g, w, h) => {
    g.fillStyle = '#b3aea6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 150000; i++) {
      const t = r(); const v = t < 0.30 ? 45 + r() * 30 : t < 0.45 ? 125 + r() * 40 : 215 + r() * 30;
      g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.62)`;
      if (r() < 0.55) g.fillRect(r() * w, r() * h, 3 + r() * 9, 1.4); else g.fillRect(r() * w, r() * h, 1.4, 3 + r() * 9);
    }
    // loose irregular darker crosshatch streaks (heathered, not a grid)
    for (let i = 0; i < 260; i++) { const v = 30 + r() * 25; g.fillStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.1})`; if (r() < 0.5) g.fillRect(0, r() * h, w, 1 + r() * 3); else g.fillRect(r() * w, 0, 1 + r() * 3, h); }
    for (let i = 0; i < 180; i++) { g.fillStyle = `rgba(235,233,228,${0.05 + r() * 0.08})`; if (r() < 0.5) g.fillRect(0, r() * h, w, 1 + r() * 2); else g.fillRect(r() * w, 0, 1 + r() * 2, h); }
  });
}
function poolArtTex(kit) { // recreated photographic pool print: deep teal sky, tall palms, low mid-century house, turquoise pool, woman on a pale diving board
  const r = kit.rng(281);
  return kit.canvasTex(600, 800, (g, w, h) => {
    const HZ = h * 0.47;
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#1d5f86'); sky.addColorStop(0.6, '#3f8fae'); sky.addColorStop(1, '#86b9c4'); g.fillStyle = sky; g.fillRect(0, 0, w, HZ);
    // distant hills/trees silhouette
    g.fillStyle = '#2f4a3c'; g.beginPath(); g.moveTo(0, HZ - 6); for (let x = 0; x <= w; x += 10) g.lineTo(x, HZ - 14 - Math.sin(x * 0.03) * 6 - r() * 8); g.lineTo(w, HZ); g.lineTo(0, HZ); g.fill();
    // tall palms (curved segmented trunks + fronds of leaflets)
    const palm = (x, top, s, lean) => {
      const bx = x, by = HZ + 4, cx = x + lean, cy = top;
      for (let i = 0; i < 40; i++) { const t = i / 40, t2 = (i + 1) / 40; const px = bx + (cx - bx) * t + Math.sin(t * 3) * lean * 0.2, py = by + (cy - by) * t, qx = bx + (cx - bx) * t2 + Math.sin(t2 * 3) * lean * 0.2, qy = by + (cy - by) * t2;
        const v = 70 + r() * 30; g.strokeStyle = `rgb(${v},${v - 8},${v - 18})`; g.lineWidth = (4.5 - 2 * t) * s; g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); }
      for (let f = 0; f < 15; f++) {
        const a = (f / 15) * Math.PI * 2 + r() * 0.3, L = (34 + r() * 16) * s, droop = (10 + r() * 12) * s;
        const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.45 + droop; const mx = cx + Math.cos(a) * L * 0.5, my = cy + Math.sin(a) * L * 0.25 - 6 * s;
        g.strokeStyle = '#17261d'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
        for (let k = 2; k < 12; k++) { const t = k / 12; const qx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex, qy = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
          for (const sd of [-1, 1]) { g.strokeStyle = `rgba(${20 + r() * 20},${40 + r() * 25},${28 + r() * 15},0.9)`; g.lineWidth = 1; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a + sd * 1.2) * 7 * s * (1 - t * 0.5), qy + 6 * s * (1 - t * 0.4)); g.stroke(); } }
      }
    };
    palm(55, 30, 1.7, 16); palm(140, 85, 1.35, -10); palm(230, 45, 1.6, 12); palm(330, 130, 1.1, -6); palm(400, 70, 1.4, -12); palm(485, 25, 1.75, 14); palm(565, 95, 1.3, -10);
    // low mid-century house: white roof fascia, dark glazing with reflections, posts
    const hy = HZ - 30;
    g.fillStyle = '#e8e5de'; g.fillRect(150, hy, 450, 9); g.fillStyle = '#b9b5ac'; g.fillRect(150, hy + 9, 450, 3);
    g.fillStyle = '#1e2a2e'; g.fillRect(170, hy + 12, 410, 26);
    for (let x = 175; x < 575; x += 8) { g.fillStyle = `rgba(120,170,175,${0.05 + r() * 0.15})`; g.fillRect(x, hy + 12, 4, 26); }
    g.fillStyle = '#efece6'; for (let x = 170; x < 590; x += 58) g.fillRect(x, hy + 12, 3, 26);
    g.fillStyle = '#5d7553'; for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(r() * w, HZ - 2 + r() * 4, 8 + r() * 16, 4 + r() * 5, 0, 0, Math.PI * 2); g.fill(); }
    // deck
    g.fillStyle = '#d6cfc1'; g.fillRect(0, HZ, w, h * 0.035); g.fillStyle = '#bfb6a6'; g.fillRect(0, HZ + h * 0.035, w, 3);
    // water: depth gradient + caustic network
    const W0 = HZ + h * 0.035 + 3;
    const water = g.createLinearGradient(0, W0, 0, h); water.addColorStop(0, '#22a6c0'); water.addColorStop(0.4, '#0b86ab'); water.addColorStop(1, '#055a80'); g.fillStyle = water; g.fillRect(0, W0, w, h - W0);
    for (let i = 0; i < 900; i++) { const y = W0 + Math.pow(r(), 0.8) * (h - W0); const sc = 0.3 + (y - W0) / (h - W0) * 1.6; const x = r() * w;
      g.strokeStyle = `rgba(200,245,255,${0.08 + r() * 0.16})`; g.lineWidth = 0.6 + sc * 0.9; g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x + 6 * sc, y - 4 * sc * r(), x + 12 * sc, y + 4 * sc * r(), x + (14 + r() * 14) * sc, y + (r() - 0.5) * 6 * sc); g.stroke(); }
    // diving board (pale, long, perspective toward the house)
    const bt = h * 0.585, bl0 = 268, br0 = 318, bl1 = 150, br1 = 440;
    const bd = g.createLinearGradient(0, bt, 0, h); bd.addColorStop(0, '#c4d6d6'); bd.addColorStop(1, '#e2ebe8'); g.fillStyle = bd;
    g.beginPath(); g.moveTo(bl0, bt); g.lineTo(br0, bt); g.lineTo(br1, h); g.lineTo(bl1, h); g.closePath(); g.fill();
    g.fillStyle = '#9fb4b6'; g.beginPath(); g.moveTo(bl0, bt); g.lineTo(br0, bt); g.lineTo(br0, bt + 4); g.lineTo(bl0, bt + 4); g.fill();
    for (let i = 0; i < 1500; i++) { const t = r(); const y = bt + t * (h - bt); const xl = bl0 + (bl1 - bl0) * t, xr = br0 + (br1 - br0) * t; g.fillStyle = `rgba(150,170,170,${r() * 0.12})`; g.fillRect(xl + r() * (xr - xl), y, 2, 1); }
    // cheetah sitting at the end of the board, seen from behind (golden coat, black spots, small round head, tail curled on the board)
    const wx = 292, wy = bt + 10;
    g.fillStyle = 'rgba(40,60,60,0.28)'; g.beginPath(); g.ellipse(wx + 4, wy + 50, 34, 7, 0, 0, Math.PI * 2); g.fill();
    const coat = g.createLinearGradient(wx - 26, 0, wx + 26, 0); coat.addColorStop(0, '#9a6a34'); coat.addColorStop(0.45, '#d6a663'); coat.addColorStop(1, '#8c5e2c'); 
    const body = new Path2D();
    body.moveTo(wx - 7, wy - 34); body.quadraticCurveTo(wx - 18, wy - 14, wx - 22, wy + 14); body.quadraticCurveTo(wx - 31, wy + 34, wx - 25, wy + 50);
    body.lineTo(wx + 25, wy + 50); body.quadraticCurveTo(wx + 31, wy + 34, wx + 22, wy + 14); body.quadraticCurveTo(wx + 18, wy - 14, wx + 7, wy - 34); body.closePath();
    body.ellipse(wx, wy - 42, 10.5, 10, 0, 0, Math.PI * 2);
    g.fillStyle = coat; g.fill(body);
    g.save(); g.clip(body);
    for (let i = 0; i < 260; i++) { const sx = wx + (r() - 0.5) * 62, sy = wy - 52 + r() * 104; g.fillStyle = `rgba(25,18,10,${0.75 + r() * 0.2})`; g.beginPath(); g.ellipse(sx, sy, 1.1 + r() * 1.3, 1 + r() * 1.1, r() * 3, 0, Math.PI * 2); g.fill(); }
    const sh = g.createLinearGradient(wx - 30, 0, wx + 30, 0); sh.addColorStop(0, 'rgba(30,20,10,0.35)'); sh.addColorStop(0.5, 'rgba(255,240,210,0.08)'); sh.addColorStop(1, 'rgba(30,20,10,0.3)'); g.fillStyle = sh; g.fillRect(wx - 34, wy - 60, 68, 112);
    g.restore();
    g.fillStyle = '#7a5427'; for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(wx + s2 * 5, wy - 49); g.lineTo(wx + s2 * 10, wy - 56); g.lineTo(wx + s2 * 11, wy - 47); g.fill(); }
    g.strokeStyle = '#b48447'; g.lineCap = 'round'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(wx + 18, wy + 48); g.quadraticCurveTo(wx + 40, wy + 56, wx + 36, wy + 78); g.stroke();
    g.strokeStyle = '#1a140c'; g.lineWidth = 4.6; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(wx + 26, wy + 52); g.quadraticCurveTo(wx + 40, wy + 58, wx + 36, wy + 78); g.stroke(); g.setLineDash([]);
    // photographic finish: light grain then one soft pass (single blur, no per-stroke filters)
    for (let i = 0; i < 20000; i++) { const v = r() * 255; g.fillStyle = `rgba(${v},${v},${v},0.04)`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.filter = 'blur(0.7px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
    const vig = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,20,25,0.25)'); g.fillStyle = vig; g.fillRect(0, 0, w, h);
  });
}
function cowPrintTex(kit) { // recreated sharp B&W highland-cow photo: pale hazy sky, dark field, shaggy cow with long fringe and wide horns
  const r = kit.rng(29);
  return kit.canvasTex(560, 800, (g, w, h) => {
    const HZ = h * 0.66;
    const bg = g.createLinearGradient(0, 0, 0, HZ); bg.addColorStop(0, '#f1f1ef'); bg.addColorStop(1, '#d9d9d6'); g.fillStyle = bg; g.fillRect(0, 0, w, HZ);
    g.fillStyle = '#b9b9b6'; g.beginPath(); g.moveTo(0, HZ); for (let x = 0; x <= w; x += 8) g.lineTo(x, HZ - 8 - Math.sin(x * 0.02) * 5 - r() * 3); g.lineTo(w, HZ); g.fill();
    const fld = g.createLinearGradient(0, HZ, 0, h); fld.addColorStop(0, '#8d8d8b'); fld.addColorStop(1, '#4a4a49'); g.fillStyle = fld; g.fillRect(0, HZ, w, h - HZ);
    for (let i = 0; i < 5000; i++) { const y = HZ + r() * (h - HZ); const v = 40 + r() * 120; g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 0.7; const x = r() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 8 * (y - HZ) / (h - HZ)); g.stroke(); }
    // shaggy coat: many fine strands, darker at the body, lighter at the back edge (rim light)
    const hair = (cx, cy, rx, ry, n, v0, v1, len) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r()); const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
        const v = v0 + r() * (v1 - v0); g.strokeStyle = `rgba(${v},${v},${v},0.7)`; g.lineWidth = 0.6 + r() * 0.9;
        const L = len * (0.6 + r() * 0.8); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y + L * 0.5, x + (r() - 0.5) * 9, y + L); g.stroke();
      }
    };
    hair(330, 470, 150, 105, 9000, 30, 120, 22);   // body
    hair(420, 430, 60, 50, 1800, 120, 210, 18);     // rim-lit rump
    for (const [lx, ly] of [[255, 560], [300, 568], [395, 562], [440, 552]]) { hair(lx + 11, ly + 40, 13, 45, 500, 25, 90, 14); }
    hair(205, 420, 66, 72, 5000, 25, 105, 20);     // head
    hair(205, 382, 62, 34, 2600, 130, 225, 30);    // pale fringe over the eyes
    g.fillStyle = 'rgba(20,20,20,0.85)'; g.beginPath(); g.ellipse(205, 468, 22, 15, 0, 0, Math.PI * 2); g.fill(); // muzzle
    for (const sx of [-8, 8]) { g.fillStyle = '#0d0d0d'; g.beginPath(); g.ellipse(205 + sx, 470, 4, 3, 0, 0, Math.PI * 2); g.fill(); }
    // wide upswept horns: pale with dark tips
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const pts = [[205 + sd * 32, 372], [205 + sd * 95, 360], [205 + sd * 128, 300]];
      for (let k = 0; k < 3; k++) { g.strokeStyle = ['#cfcac2', '#a9a49c', '#2a2a2a'][k]; g.lineWidth = [11, 7, 4][k]; g.beginPath(); g.moveTo(...pts[0]); g.quadraticCurveTo(...pts[1], ...(k === 2 ? pts[2] : [205 + sd * (110 + k * 8), 320 - k * 10])); g.stroke(); }
    }
    for (let i = 0; i < 16000; i++) { const v = r() * 255; g.fillStyle = `rgba(${v},${v},${v},0.04)`; g.fillRect(r() * w, r() * h, 1, 1); }
  });
}
function signTex(kit) { // "IT'S OK" letterboard in a thin white frame
  return kit.canvasTex(320, 144, (g, w, h) => {
    g.fillStyle = '#f2f0eb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#262627'; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#efeeea'; g.font = 'bold 40px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText("IT'S OK", w / 2, h / 2 + 2);
  });
}
function crinkleNormal(kit, size = 512, seed = 9) { // crinkled cotton gauze: dense wavy lengthwise crinkles
  const r = kit.rng(seed); const H = new Float32Array(size * size);
  const ph = Array.from({ length: 8 }, () => r() * 6.283);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 6.283, v = y / size * 6.283;
    const warp = 0.9 * Math.sin(v * 3 + ph[0]) + 0.6 * Math.sin(v * 7 + u * 2 + ph[1]) + 0.35 * Math.sin(v * 13 + ph[2]);
    H[y * size + x] = Math.sin(u * 22 + warp * 3) * (0.6 + 0.4 * Math.sin(v * 5 + u * 3 + ph[3])) + 0.45 * Math.sin(u * 47 + v * 9 + warp * 5 + ph[4]) + 0.25 * Math.sin(v * 31 + u * 4 + ph[5]);
  }
  return kit.canvasTex(size, size, (g) => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H[y * size + (x + 1) % size] - H[y * size + (x - 1 + size) % size]) * 0.9, dy = (H[((y + 1) % size) * size + x] - H[((y - 1 + size) % size) * size + x]) * 0.9;
      const nz = 1 / Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

// ------------------------------------------------------------------ geometry helpers
// Fabric draped over a box top (bed throw / duvet), local bed coords: top spans x∈[-W/2,W/2], z∈[z0,z1]
// at height `top`; hangs `side` over both long edges and `foot` over the z1 edge with rounded corner falls
// (corner drop is capped, so no pointed corners). wr = crinkle amplitude on top, fold = soft vertical folds.
function drape(W, z0, z1, top, side, foot, r = 0.05, wr = 0.006, seed = 1, seg = [64, 80], freq = 1, fold = 0.02, hem = 0) {
  const geo = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]); const p = geo.attributes.position, uv = geo.attributes.uv;
  const foldF = (d) => { if (d <= 0) return [0, 0]; const arc = r * Math.PI / 2; if (d < arc) { const t = d / r; return [r * Math.sin(t), r - r * Math.cos(t)]; } return [r, r + (d - arc)]; };
  const Wt = W + 2 * side, Lt = (z1 - z0) + foot, dCorner = Math.min(side, foot) * 0.92, RC = 0.15;
  for (let i = 0; i < p.count; i++) {
    const s = uv.getX(i), t = 1 - uv.getY(i);
    const u = (s - 0.5) * Wt, v = z0 + t * Lt, sx = Math.sign(u) || 1;
    const du = Math.abs(u) - W / 2, dv = v - z1;
    const n = Math.sin(u * 9 * freq + seed) * Math.sin(v * 5.3 * freq + seed * 2) + 0.5 * Math.sin(u * 23 * freq + v * 3 + seed) + 0.35 * Math.sin(u * 41 * freq - v * 37 * freq + seed);
    let x, y, z;
    if (du <= 0 && dv <= 0) {
      x = u; z = v; y = top + wr * n;
      if (hem > 0 && v - z0 < 0.09) y += hem * (1 - (v - z0) / 0.09) * (0.7 + 0.3 * Math.sin(u * 13 + seed)); // soft turned-back hem
    } else {
      let d, hx, hz, cx, cz, along;
      if (du > 0 && dv > 0) { d = Math.hypot(du, dv); hx = sx * du / d; hz = dv / d; cx = sx * W / 2; cz = z1; d = Math.min(d, dCorner); const th = Math.atan2(dv, du); along = sx > 0 ? z1 + th * RC : z1 + Math.PI * RC + W - th * RC; }
      else if (du > 0) { d = du; hx = sx; hz = 0; cx = sx * W / 2; cz = v; along = sx > 0 ? v : z1 + Math.PI * RC + W + (z1 - v); }
      else { d = dv; hx = 0; hz = 1; cx = u; cz = z1; along = z1 + Math.PI / 2 * RC + (W / 2 - u); }
      const [o, dy] = foldF(d);
      const k = Math.min(1, dy / 0.12);
      const wave = fold * k * (0.5 + 0.5 * Math.sin(along * 10 * freq + seed) * Math.sin(along * 3.1 + seed * 0.7)) + 0.004 + wr * 0.6 * n * k;
      x = cx + hx * (o + wave); z = cz + hz * (o + wave); y = top - dy;
    }
    p.setXYZ(i, x, y, z); uv.setXY(i, u, v);
  }
  geo.computeVertexNormals(); return geo;
}
function quadGeo(A, B, C, D, wantDown = true) { // planar quad, flipped so its normal points down (ceiling) or up
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3)); g.computeVertexNormals();
  if ((g.attributes.normal.getY(0) > 0) === wantDown) { g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...C, ...B, ...A, ...D, ...C], 3)); g.computeVertexNormals(); }
  return g;
}

export async function build(ctx) {
  const { kit, phys, root } = ctx; const M = kit.M;
  const BED = kit.roomInfo('bedB'), BATH = kit.roomInfo('bathB'), CL = kit.roomInfo('closetB');
  const Y = BED.y; // 3.35
  const SPRING = Y + 2.50, SLOPE = 0.45; // hip ceiling springs from every wall at 2.5 m, rises at ~24°
  const dynamicBits = [];

  // ---------------------------------------------------------------- materials
  const wpMap = wallpaperTex(kit);
  const wallpaper = std({ map: wpMap, bumpMap: wpMap, bumpScale: 0.12, roughness: 0.92 });
  const warmWall = M.paintWhite.clone(); warmWall.color = new THREE.Color(0xf4f3f0); warmWall.emissive = new THREE.Color(0xffffff); warmWall.emissiveIntensity = 0.03; // neutral white
  const hes = kit.pbrMaps('hessian_380', '1k', { repeat: [4, 4] });
  const upholstery = std({ color: 0x4a4a4e, roughness: 0.95, normalMap: hes.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  const duvet = std({ color: 0xf5f4f1, roughness: 0.95, side: THREE.DoubleSide, normalMap: kit.noiseNormal(256, 1.4, 12, 21), normalScale: new THREE.Vector2(0.4, 0.4) });
  const crinkle = crinkleNormal(kit); crinkle.repeat.set(3.2, 3.2);
  const tealMap = kit.canvasTex(256, 256, (g, w, h) => { // deep teal gauze: lengthwise crinkle streaks, slightly mottled
    const r = kit.rng(77); g.fillStyle = '#22667a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const d = (r() - 0.5) * 34; g.fillStyle = `rgba(${34 + d},${102 + d},${122 + d},0.35)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 8 + r() * 30); }
  }, { repeat: [3, 3] });
  const teal = std({ map: tealMap, color: 0xffffff, roughness: 1, envMapIntensity: 0.35, side: THREE.DoubleSide, normalMap: crinkle, normalScale: new THREE.Vector2(0.7, 0.7) });
  const pillowWhite = std({ color: 0xf7f6f3, roughness: 0.9, normalMap: kit.noiseNormal(128, 1, 8, 2), normalScale: new THREE.Vector2(0.3, 0.3) });
  const stripeMap = kit.canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#1f2a3d'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d3c8'; for (let x = 0; x < w; x += 22) g.fillRect(x, 0, 5, h); g.fillStyle = '#7a6a52'; for (let x = 11; x < w; x += 44) g.fillRect(x, 0, 2, h); });
  const stripePillow = std({ map: stripeMap, roughness: 0.9 });
  const patMap = kit.canvasTex(256, 256, (g, w, h) => { const r = kit.rng(5); g.fillStyle = '#ebe7df'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e1e1e'; for (let y = 8; y < h; y += 26) for (let x = (y / 26 % 2) * 13; x < w; x += 26) { g.fillRect(x, y, 10 + r() * 6, 4); g.fillRect(x + 3, y + 6, 4, 8); } });
  const patPillow = std({ map: patMap, roughness: 0.9 });
  const oakV = kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] });
  const blackWood = std({ color: 0x1a1a1b, roughness: 0.6, normalMap: oakV.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
  const oak = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.4, 1.4] }), color: 0xffd9a6, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) });
  const deskOak = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.4, 1.4] }), color: 0xffd8a0, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) }); // light rift white oak
  const cabWhite = std({ color: 0xefeeeb, roughness: 0.55 });
  const pull = std({ color: 0x18181a, roughness: 0.35, metalness: 0.7 });
  const tealGloss = physMat({ color: 0x0d5568, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const tealGlass = physMat({ color: 0x0c7a86, roughness: 0.05, clearcoat: 1, metalness: 0.1, transparent: true, opacity: 0.9 });
  const shadeMat = std({ color: 0xf8f6f1, emissive: 0xffeedb, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide });
  const rugMat = std({ map: rugTex(kit), normalMap: kit.noiseNormal(256, 3, 64, 12), normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1 });
  const fanWhite = std({ color: 0xf4f3f0, roughness: 0.5 });
  const screen = physMat({ color: 0x0a0b0d, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const grille = std({ color: 0xe9e8e4, roughness: 0.6 });
  const mBlack = std({ color: 0x151516, roughness: 0.55, metalness: 0.5 }); // matte black fixtures
  const marbleMap = marbleTex(kit, 3);
  const marble = std({ map: marbleMap, roughness: 0.5, envMapIntensity: 0.3 });
  const marbleTop = std({ map: marbleTex(kit, 8, 1024), roughness: 0.42, envMapIntensity: 0.4 }); marbleTop.map.repeat.set(1 / 1.1, 1 / 1.1);
  const nickel = std({ color: 0x8c8983, roughness: 0.25, metalness: 1.0, envMapIntensity: 1.0 }), chrome = M.chrome; // polished nickel shower trim
  const floorTile = std({ map: porcelainTex(kit, 1.2, 0.6, '#6f6c68', 41), roughness: 0.45, normalMap: kit.noiseNormal(256, 0.6, 16, 9), normalScale: new THREE.Vector2(0.1, 0.1) });
  const showerTile = std({ map: porcelainTex(kit, 0.6, 0.6, '#5f5d5a', 43), roughness: 0.5 });
  const tileBase = std({ color: 0x7c7976, roughness: 0.5 });
  const porcelain = std({ color: 0xfbfbfa, roughness: 0.1 });
  const waffle = kit.canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3a3a'; for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) g.fillRect(x + 3, y + 3, 10, 10); }, { srgb: false, repeat: [9, 9] });
  const towelBlack = std({ color: 0x6a6a6c, roughness: 1, bumpMap: waffle, bumpScale: 2.5, map: waffle });
  const glassMat = physMat({ color: 0xeef5f2, roughness: 0.02, transparent: true, opacity: 0.06, metalness: 0, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false });
  const glassEdge = std({ color: 0xbfd8cf, roughness: 0.1, transparent: true, opacity: 0.28 });
  const opal = std({ color: 0xffffff, emissive: 0xfff3e2, emissiveIntensity: 0.9, roughness: 0.5 });

  // ================================================================ BEDROOM B
  const bed = kit.group(root, [0, 0, 0], 0, 'bedB');
  const [X0, Z0, X1, Z1] = BED.rect, XC = BED.cx, ZC = BED.cz;

  // ---- hipped ceiling: four slopes from the walls up to a small flat at the peak
  const INS = Math.min(BED.w, BED.d) / 2 - 0.12, TOP = SPRING + SLOPE * INS, E = 0.04;
  const ceilAt = (x, z) => Math.min(TOP, SPRING + SLOPE * Math.min(x - X0, X1 - x, z - Z0, Z1 - z));
  const ceilN = (x, z) => { // normal (pointing into the room) of the face above (x,z)
    const d = { x0: x - X0, x1: X1 - x, z0: z - Z0, z1: Z1 - z }; const k = Object.keys(d).reduce((a, b) => d[a] < d[b] ? a : b);
    if (ceilAt(x, z) >= TOP - 1e-4) return new THREE.Vector3(0, -1, 0);
    const v = { x0: [SLOPE, -1, 0], x1: [-SLOPE, -1, 0], z0: [0, -1, SLOPE], z1: [0, -1, -SLOPE] }[k];
    return new THREE.Vector3(...v).normalize();
  };
  {
    const lo = SPRING - SLOPE * E, a = [X0 - E, lo, Z0 - E], b = [X1 + E, lo, Z0 - E], c = [X1 + E, lo, Z1 + E], d = [X0 - E, lo, Z1 + E];
    const ta = [X0 + INS, TOP, Z0 + INS], tb = [X1 - INS, TOP, Z0 + INS], tc = [X1 - INS, TOP, Z1 - INS], td = [X0 + INS, TOP, Z1 - INS];
    const cm = M.ceilingWhite.clone(); cm.side = THREE.FrontSide; cm.color = new THREE.Color(0xfaf8f4); cm.emissive = new THREE.Color(0xfff9f0); cm.emissiveIntensity = 0.15;
    for (const [A, B, C, D] of [[a, b, tb, ta], [b, c, tc, tb], [c, d, td, tc], [d, a, ta, td], [ta, tb, tc, td]]) {
      const m = new THREE.Mesh(quadGeo(A, B, C, D, true), cm); m.receiveShadow = true; m.castShadow = true; m.name = 'hipCeiling'; bed.add(m);
    }
  }
  // hide the shell's interim garage-wing roof soffits that could poke under this ceiling (only inside this room)
  {
    const cache = new Map();
    ctx.shell?.root?.traverse(o => {
      if (!o.isMesh || !(o.name.startsWith('soffit:') || o.name.startsWith('roof:'))) return;
      let m = cache.get(o.material); if (!m) {
        m = o.material.clone();
        m.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBbW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBbW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBbW;').replace('void main() {', `void main() {\n if (vBbW.x > ${X0.toFixed(3)} && vBbW.x < ${X1.toFixed(3)} && vBbW.z > ${Z0.toFixed(3)} && vBbW.z < ${Z1.toFixed(3)} && vBbW.y < ${(TOP + 0.02).toFixed(3)} && vBbW.y > ${Y.toFixed(3)}) discard;`);
        };
        m.customProgramCacheKey = () => 'bedB-roof-cut-' + o.material.uuid; cache.set(o.material, m);
      }
      o.material = m;
    });
  }
  // fixtures on the ceiling, oriented to the slope they sit on
  const onCeil = (x, z, parent = bed) => { const n = ceilN(x, z); const g = new THREE.Group(); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n); g.position.set(x, ceilAt(x, z), z).addScaledVector(n, 0.003); parent.add(g); return g; };
  {
    const disc = new THREE.CircleGeometry(0.045, 24).rotateX(Math.PI / 2);
    const ring = new THREE.RingGeometry(0.045, 0.064, 24).rotateX(Math.PI / 2);
    const spk = new THREE.CircleGeometry(0.11, 32).rotateX(Math.PI / 2);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.2 });
    const spkMat = std({ color: 0xdcdbd7, roughness: 0.8 });
    for (const [x, z] of [[18.55, 1.75], [18.55, 4.90], [20.15, 1.45], [20.15, 5.15], [21.85, 1.75], [21.85, 4.90], [19.05, 3.33], [21.3, 3.33]]) { const g = onCeil(x, z); g.add(new THREE.Mesh(disc, lit), new THREE.Mesh(ring, grille)); }
    for (const [x, z] of [[21.55, 2.55], [18.75, 4.1]]) { const g = onCeil(x, z); g.add(new THREE.Mesh(spk, spkMat)); }
    // HVAC grilles (louvred) on the street-side and bath-side slopes
    const gr = (x, z, w, d) => { const g = onCeil(x, z); g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), grille)); for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.01, 0.008), M.matteBlack); s.position.set(0, -0.004, -d / 2 + 0.03 + i * (d - 0.06) / 8); g.add(s); } };
    gr(18.35, 1.50, 0.36, 0.22); gr(19.7, 5.55, 0.36, 0.22); gr(22.1, 1.60, 0.36, 0.22);
  }
  // ceiling fan (white, 3 blades) from the peak
  {
    const fan = kit.group(bed, [XC, TOP, ZC], 0, 'fan');
    kit.add(fan, kit.cyl(0.06, 0.075, 0.07), fanWhite, [0, -0.035, 0]);
    kit.add(fan, kit.cyl(0.012, 0.012, 0.56), fanWhite, [0, -0.32, 0]);
    const rotor = kit.group(fan, [0, -0.64, 0], 0, 'fanRotor'); rotor.userData.keep = true;
    kit.add(rotor, kit.lathe([[0, 0.06], [0.09, 0.055], [0.12, 0.02], [0.115, -0.02], [0.07, -0.05], [0, -0.055]], 40), fanWhite);
    kit.add(rotor, kit.cyl(0.075, 0.075, 0.012, 40), std({ color: 0xd9d9d6, roughness: 0.4 }), [0, -0.058, 0]);
    const blade = kit.extrude([[0.10, -0.04], [0.72, -0.07], [0.77, -0.05], [0.79, 0.0], [0.75, 0.05], [0.10, 0.035]], 0.008, 0.002); blade.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) { const b = kit.add(rotor, blade, fanWhite, [0, -0.005, 0], [0.16, (i * Math.PI * 2) / 3 + 0.9, 0]); b.rotation.order = 'YXZ'; }
    if (!ctx.shot) ctx.onUpdate((dt) => { rotor.rotation.y += dt * 1.6; });
  }
  // ---- accent wallpaper on the window wall (x = 22.80) and white baseboards
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bB-side'); const wa = o.at[1] - o.w / 2, wb = o.at[1] + o.w / 2;
    kit.wallPanel(bed, [X1, Z0], [X1, wa], Y, SPRING, [-1, 0], wallpaper, 0.004);
    kit.wallPanel(bed, [X1, wb], [X1, Z1], Y, SPRING, [-1, 0], wallpaper, 0.004);
    kit.wallPanel(bed, [X1, wa], [X1, wb], Y, Y + o.sill, [-1, 0], wallpaper, 0.004);
    kit.wallPanel(bed, [X1, wa], [X1, wb], Y + o.head, SPRING, [-1, 0], wallpaper, 0.004);
  }
  // warm-white paint overlay on the other three walls (house white reads cool here), skipping the doors
  {
    const dH = ctx.plan.OPENINGS.find(q => q.id === 'bB-d'), dB = ctx.plan.OPENINGS.find(q => q.id === 'bathB-d');
    const ha = dH.at[1] - dH.w / 2, hb = dH.at[1] + dH.w / 2, ba = dB.at[0] - dB.w / 2, bb = dB.at[0] + dB.w / 2;
    kit.wallPanel(bed, [X0, Z0], [X0, ha], Y, SPRING, [1, 0], warmWall, 0.003); kit.wallPanel(bed, [X0, hb], [X0, Z1], Y, SPRING, [1, 0], warmWall, 0.003);
    kit.wallPanel(bed, [X0, ha], [X0, hb], Y + dH.head, SPRING, [1, 0], warmWall, 0.003);
    kit.wallPanel(bed, [X0, Z1], [ba, Z1], Y, SPRING, [0, -1], warmWall, 0.003); kit.wallPanel(bed, [bb, Z1], [X1, Z1], Y, SPRING, [0, -1], warmWall, 0.003);
    kit.wallPanel(bed, [ba, Z1], [bb, Z1], Y + dB.head, SPRING, [0, -1], warmWall, 0.003);
    kit.wallPanel(bed, [X0, Z0], [X1, Z0], Y, SPRING, [0, 1], warmWall, 0.003);
  }
  kit.baseboards(bed, BED.rect, Y, 0.11, 0.014, M.paintWhite, [{ side: 'x0', from: 4.84, to: 5.76 }, { side: 'z1', from: 20.04, to: 20.86 }]);

  // ---- white flat casings around the hall door and the bath door (bedroom side)
  {
    const cas = (cx, cz, w, h, alongX, nSign) => {
      const t = 0.018, cw = 0.075; const off = nSign * 0.009;
      if (alongX) { for (const s of [-1, 1]) kit.add(bed, kit.box(cw, h + cw, t), M.paintWhite, [cx + s * (w / 2 + cw / 2), Y + (h + cw) / 2, cz + off]); kit.add(bed, kit.box(w + 2 * cw, cw, t), M.paintWhite, [cx, Y + h + cw / 2, cz + off]); }
      else { for (const s of [-1, 1]) kit.add(bed, kit.box(t, h + cw, cw), M.paintWhite, [cx + off, Y + (h + cw) / 2, cz + s * (w / 2 + cw / 2)]); kit.add(bed, kit.box(t, cw, w + 2 * cw), M.paintWhite, [cx + off, Y + h + cw / 2, cz]); }
    };
    const d1 = ctx.plan.OPENINGS.find(q => q.id === 'bB-d'), d2 = ctx.plan.OPENINGS.find(q => q.id === 'bathB-d');
    cas(X0, d1.at[1], d1.w, d1.head, false, 1); cas(d2.at[0], Z1, d2.w, d2.head, true, -1);
  }
  // ---- window: black cornice box over the 2-lite window
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bB-side'); const wz = o.at[1], ww = o.w + 0.22;
    kit.add(bed, kit.rbox(0.13, 0.16, ww, 0.008), M.matteBlack, [X1 - 0.065, Y + o.head + 0.11, wz]);
  }
  // hazy blue-grey atmosphere just outside both windows (mutes the bright canyon view, like the photos)
  const haze = new THREE.MeshBasicMaterial({ color: 0xc3ced6, transparent: true, opacity: 0.42, depthWrite: false, fog: false });
  for (const id of ['bB-side', 'bathB-win']) {
    const o = ctx.plan.OPENINGS.find(q => q.id === id);
    const hz = kit.add(root, new THREE.PlaneGeometry(o.w + 0.1, o.head - o.sill + 0.1), haze, [X1 + 0.40, Y + (o.sill + o.head) / 2, o.at[1]], [0, -Math.PI / 2, 0], { shadow: false });
    hz.receiveShadow = false; hz.renderOrder = 1;
  }
  // soft contact shadows (multiplied dark gradient decals) under the bed, nightstands and wardrobe
  const aoTex = kit.canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = Math.max(0, Math.abs(x / w - 0.5) * 2 - 0.55) / 0.45, dy = Math.max(0, Math.abs(y / h - 0.5) * 2 - 0.55) / 0.45; const d = Math.min(1, Math.hypot(dx, dy)); const a = (1 - d) * (1 - d); const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = a * 255; }
    g.putImageData(img, 0, 0);
  });
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const ao = (cx, cz, w, d, op = 0.55, y = Y + 0.0135) => { const m = kit.add(bed, new THREE.PlaneGeometry(w, d), op === 0.55 ? aoMat : Object.assign(aoMat.clone(), { opacity: op }), [cx, y, cz], [-Math.PI / 2, 0, 0], { shadow: false }); m.receiveShadow = false; m.renderOrder = 2; return m; };

  // ---- bed (local +z = foot, headboard against the wallpaper wall)
  const bedZ = 3.12; // centred on the window, close to the wardrobe-wall corner (p27)
  const bedG = kit.group(bed, [X1, Y, bedZ], -Math.PI / 2, 'bed');
  {
    const W = 2.02, Lb = 2.10, RAIL0 = 0.12, RAIL1 = 0.50, MT = 0.74; // MT = mattress top
    // charcoal upholstered frame: tall padded rails on short block legs
    for (const sx of [-1, 1]) for (const sz of [0.16, 0.12 + Lb - 0.06]) kit.add(bedG, kit.rbox(0.07, RAIL0 + 0.01, 0.07, 0.008), blackWood, [sx * (W / 2 - 0.05), (RAIL0 + 0.01) / 2, sz]);
    kit.add(bedG, kit.cushion(W, RAIL1 - RAIL0, Lb, 0.045, 0.006, 5), upholstery, [0, (RAIL0 + RAIL1) / 2, 0.12 + Lb / 2]);
    kit.add(bedG, kit.box(W - 0.02, 0.012, Lb - 0.02), M.matteBlack, [0, RAIL0 + 0.004, 0.12 + Lb / 2]); // dark underside shadow line
    kit.add(bedG, kit.rbox(1.95, 0.25, Lb - 0.12, 0.07), duvet, [0, MT - 0.125, 0.14 + (Lb - 0.12) / 2]); // mattress
    // tall channel-tufted headboard (horizontal channels), ~1.2 m
    const HB_W = 2.14, HB_H = 1.22, nCh = 7;
    kit.add(bedG, kit.rbox(HB_W, HB_H, 0.10, 0.035), upholstery, [0, HB_H / 2, 0.05]);
    const chH = (HB_H - 0.30) / nCh; const ch = kit.cushion(HB_W - 0.02, 0.07, chH - 0.008, 0.03, 0.022, 5); ch.rotateX(Math.PI / 2);
    for (let i = 0; i < nCh; i++) kit.add(bedG, ch, upholstery, [0, 0.30 + chH * (i + 0.5), 0.115]);
    // white duvet over the whole mattress; crinkled teal gauze coverlet over the foot two-thirds,
    // falling ~0.3 m over the sides and foot with rounded corners and soft folds
    kit.add(bedG, drape(1.97, 0.28, Lb + 0.02, MT + 0.012, 0.28, 0.16, 0.05, 0.008, 3, [64, 80], 1, 0.008), duvet);
    kit.add(bedG, drape(2.00, 0.95, Lb + 0.06, MT + 0.045, 0.30, 0.60, 0.07, 0.005, 7, [120, 160], 2.4, 0.035, 0.035), teal);
    phys.boxLocal(bedG, 0, 0.38, 0.12 + Lb / 2, W / 2, 0.38, Lb / 2);
    phys.boxLocal(bedG, 0, HB_H / 2, 0.06, HB_W / 2, HB_H / 2, 0.08);
    // pillows: two white euro shams, two white sleepers, navy-stripe lumbar, black/white patterned lumbar
    const pillow = (w, h, t, mat, x, y, z, lean, yaw, dyn) => {
      const m = kit.add(bedG, kit.cushion(w, t, h, 0.05, t * 0.45, 5), mat, [x, y, z], [Math.PI / 2 - lean, yaw, 0]); m.rotation.order = 'YXZ'; if (dyn) dynamicBits.push(m); return m;
    };
    pillow(0.62, 0.48, 0.16, patPillow, -0.48, MT + 0.22, 0.24, 0.26, 0.04);
    pillow(0.62, 0.48, 0.16, patPillow, 0.48, MT + 0.22, 0.24, 0.24, -0.04);
    pillow(0.88, 0.46, 0.15, pillowWhite, -0.45, MT + 0.19, 0.40, 0.42, 0.06, true);
    pillow(0.88, 0.46, 0.15, pillowWhite, 0.46, MT + 0.19, 0.40, 0.40, -0.05);
    pillow(0.52, 0.34, 0.13, stripePillow, -0.22, MT + 0.17, 0.60, 0.48, 0.1, true);
    pillow(0.52, 0.32, 0.13, stripePillow, 0.26, MT + 0.15, 0.60, 0.50, -0.08, true);
  }
  // ---- black 2-drawer nightstands + glossy teal lamps (local +z faces the room)
  function nightstand(pos, W = 0.70, D = 0.45, H = 0.60) {
    const g = kit.group(bed, pos, -Math.PI / 2, 'nightstand');
    kit.add(g, kit.rbox(W, 0.035, D, 0.008), blackWood, [0, H - 0.0175, D / 2]);
    kit.add(g, kit.box(W - 0.01, H - 0.11, D - 0.03), blackWood, [0, 0.075 + (H - 0.11) / 2, (D - 0.03) / 2]);
    for (const sx of [-1, 1]) kit.add(g, kit.rbox(0.035, 0.08, D - 0.03, 0.005), blackWood, [sx * (W / 2 - 0.03), 0.04, (D - 0.03) / 2]);
    const dh = (H - 0.12) / 2;
    for (let i = 0; i < 2; i++) {
      kit.add(g, kit.shakerFront(W - 0.03, dh - 0.008, 0.03, 0.018, 0.005), blackWood, [-(W - 0.03) / 2, 0.08 + i * dh, D - 0.03]);
      kit.add(g, kit.rbox(0.12, 0.012, 0.015, 0.004), pull, [0, 0.08 + i * dh + dh / 2, D - 0.005]);
    }
    const lamp = kit.group(g, [0.02, H, D * 0.5], 0, 'lamp');
    kit.add(lamp, kit.lathe([[0, 0], [0.06, 0], [0.075, 0.02], [0.13, 0.12], [0.135, 0.17], [0.12, 0.24], [0.07, 0.29], [0.035, 0.31], [0.03, 0.34], [0, 0.345]], 48), tealGloss);
    kit.add(lamp, kit.cyl(0.008, 0.008, 0.12), M.brushedNickel, [0, 0.40, 0]);
    kit.add(lamp, new THREE.CylinderGeometry(0.18, 0.20, 0.28, 64, 1, true), shadeMat, [0, 0.51, 0], [0, 0, 0], { shadow: false });
    kit.add(lamp, new THREE.CircleGeometry(0.18, 48).rotateX(Math.PI / 2), shadeMat, [0, 0.649, 0], [0, 0, 0], { shadow: false });
    for (const [yy, rr] of [[0.371, 0.20], [0.649, 0.18]]) kit.add(lamp, new THREE.TorusGeometry(rr, 0.004, 6, 64).rotateX(Math.PI / 2), shadeMat, [0, yy, 0], [0, 0, 0], { shadow: false });
    phys.solidGroup(g); return g;
  }
  nightstand([X1, Y, 1.62], 0.62); nightstand([X1, Y, 4.62], 0.70);

  // ---- rug under the lower bed
  { const rug = kit.add(bed, kit.rbox(3.25, 0.012, 3.55, 0.005), rugMat, [20.62, Y + 0.006, bedZ + 0.12]); rug.castShadow = false; }
  ao(X1 - 1.20, bedZ, 2.55, 2.45, 0.7); // under the bed (sits on the rug)
  for (const z of [1.62, 4.62]) ao(X1 - 0.24, z, 0.95, 0.75, 0.5);
  // warm low sun through the side window: a soft patch on the floor by the wardrobe (non-shadow spot, 1 of 2 lights)
  {
    const sunSpot = new THREE.SpotLight(0xe6eeff, 90, 12, 0.5, 1.0, 2); sunSpot.castShadow = false; /* cool soft daylight from the window */
    sunSpot.position.set(24.0, Y + 2.4, 3.45); sunSpot.target.position.set(19.5, Y + 0.6, 3.2);
    bed.add(sunSpot, sunSpot.target);
  }

  // ---- built-in wardrobe on the street wall (z = 0.65): 4 shaker doors over 3 rows x 4 drawers
  {
    const WX0 = 19.55, WL = 2.00, D = 0.54, RD = 0.64, H = 2.30, kick = 0.10, g = kit.group(bed, [WX0, Y, Z0], 0, 'wardrobe'); // RD = alcove depth (doors set back 0.10)
    kit.add(g, kit.box(WL - 0.06, kick, D - 0.08), M.matteBlack, [WL / 2, kick / 2, (D - 0.08) / 2]);
    kit.add(g, kit.box(WL, H - kick, D - 0.025), cabWhite, [WL / 2, kick + (H - kick) / 2, (D - 0.025) / 2]);
    for (const sx of [0.012, WL - 0.012]) kit.add(g, kit.box(0.024, H, D), cabWhite, [sx, H / 2, D / 2]); // side panels
    kit.add(g, kit.box(WL, 0.05, D), cabWhite, [WL / 2, H - 0.025, D / 2]); // top
    const colW = (WL - 0.04) / 4, rows = [0.25, 0.25, 0.25], dTop = kick + rows.reduce((a, b) => a + b, 0);
    let y = kick;
    for (const rh of rows) {
      for (let c = 0; c < 4; c++) {
        const x = 0.02 + c * colW;
        kit.add(g, kit.shakerFront(colW - 0.006, rh - 0.006, 0.035, 0.02, 0.005), cabWhite, [x + 0.003, y + 0.003, D - 0.025]);
        kit.add(g, kit.rbox(0.16, 0.012, 0.016, 0.004), pull, [x + colW / 2, y + rh / 2 + 0.02, D + 0.006]);
      }
      y += rh;
    }
    const dH = H - 0.05 - dTop - 0.01, lowH = dH * 0.40;
    for (let c = 0; c < 4; c++) { // each tall door: lower + upper shaker panel (mid rail), black bar pulls at the meeting stiles
      const x = 0.02 + c * colW;
      kit.add(g, kit.shakerFront(colW - 0.006, lowH, 0.075, 0.024, 0.013), cabWhite, [x + 0.003, dTop + 0.005, D - 0.025]);
      kit.add(g, kit.shakerFront(colW - 0.006, dH - lowH, 0.075, 0.024, 0.013), cabWhite, [x + 0.003, dTop + 0.005 + lowH, D - 0.025]);
      if (c === 0 || c === 2) for (const px of [x + colW - 0.04, x + colW + 0.04]) kit.add(g, kit.rbox(0.014, 0.28, 0.016, 0.005), pull, [px, dTop + lowH + 0.05, D + 0.008]);
    }
    phys.solidGroup(g);
    // recess it: furred-out wall flush with the doors on both sides and a header above (built-in look, no side panels)
    const FT = SPRING + SLOPE * RD + 0.01;
    kit.boxAt(bed, warmWall, X0 + 0.60, Y, Z0, WX0 - (X0 + 0.60), FT - Y, RD);
    kit.boxAt(bed, warmWall, WX0 + WL, Y, Z0, X1 - (WX0 + WL), FT - Y, RD);
    kit.boxAt(bed, warmWall, WX0, Y + H, Z0, WL, FT - Y - H, RD);
    phys.boxAABB([X0 + 0.60, Y, Z0], [X1, Y + 2.4, Z0 + RD]);
    kit.baseboards(bed, [X0 + 0.60, Z0 + RD, X1, Z1], Y, 0.11, 0.014, M.paintWhite, [{ side: 'z0', from: WX0, to: WX0 + WL }, { side: 'x0', from: Z0, to: Z1 }, { side: 'x1', from: Z0, to: Z1 }, { side: 'z1', from: X0, to: X1 }]);
    ao(WX0 + WL / 2, Z0 + D + 0.05, WL, 0.25, 0.45);
  }
  // "IT'S OK" letterboard right of the wardrobe
  {
    const s = kit.group(bed, [22.18, Y + 1.70, Z0 + 0.64], 0, 'sign');
    kit.add(s, kit.rbox(0.56, 0.26, 0.03, 0.004), cabWhite, [0, 0, 0.015]);
    kit.add(s, new THREE.PlaneGeometry(0.55, 0.25), std({ map: signTex(kit), roughness: 0.7 }), [0, 0, 0.031]);
  }

  // ---- built-in oak desk on the hall wall (x = 17.50). local x runs from z=4.45 towards -z; local +z = +x
  {
    const L = 3.18, D = 0.60, H = 0.76, T = 0.04, kick = 0.08;
    const g = kit.group(bed, [X0, Y, 4.45], Math.PI / 2, 'desk');
    kit.add(g, kit.rbox(L, T, D, 0.006), deskOak, [L / 2, H - T / 2, D / 2]); // top
    // pedestal (local x 0..0.92): 2 cols x 3 inset drawers
    const ped = (x0, w) => { kit.add(g, kit.box(w, H - T - kick, D - 0.03), deskOak, [x0 + w / 2, kick + (H - T - kick) / 2, (D - 0.03) / 2]); kit.add(g, kit.box(w - 0.04, kick, D - 0.08), deskOak, [x0 + w / 2, kick / 2, (D - 0.08) / 2]); };
    ped(0, 0.92); ped(L - 1.0, 1.0);
    const ch = (H - T - kick - 0.02) / 4;
    for (let c = 0; c < 2; c++) for (let rI = 0; rI < 4; rI++) {
      const x = 0.02 + c * 0.44, y = kick + 0.01 + rI * ch;
      kit.add(g, kit.shakerFront(0.43, ch - 0.01, 0.03, 0.018, 0.005), deskOak, [x, y, D - 0.03]);
      kit.add(g, kit.sphere(0.016, 16, 10), pull, [x + 0.215, y + ch / 2, D + 0.012]); kit.add(g, kit.cyl(0.006, 0.006, 0.02, 8), pull, [x + 0.215, y + ch / 2, D - 0.002], [Math.PI / 2, 0, 0]);
    }
    // kneehole apron drawer
    kit.add(g, kit.box(L - 1.92, 0.12, D - 0.03), deskOak, [0.92 + (L - 1.92) / 2, H - T - 0.06, (D - 0.03) / 2]);
    kit.add(g, kit.shakerFront(L - 1.96, 0.11, 0.025, 0.018, 0.004), deskOak, [0.94, H - T - 0.115, D - 0.03]);
    // cabinet with one door + small black knob
    kit.add(g, kit.shakerFront(0.97, H - T - kick - 0.03, 0.07, 0.024, 0.014), deskOak, [L - 0.985, kick + 0.01, D - 0.03]);
    kit.add(g, kit.sphere(0.017, 16, 10), pull, [L - 0.90, kick + 0.50, D + 0.012]);
    kit.add(g, kit.sphere(0.016, 16, 10), pull, [0.92 + (L - 1.92) / 2, H - T - 0.06, D + 0.012]); // pencil-drawer knob
    phys.solidGroup(g);
    // clear chair mat + black elbow chair (faces the desk, -x)
    const mat = kit.add(bed, kit.box(0.95, 0.004, 1.20), physMat({ color: 0xfffaf2, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.5 }), [18.58, Y + 0.004, 2.90]); mat.castShadow = false;
    const matEdge = std({ color: 0xb8ad9c, roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
    for (const [w2, d2, x2, z2] of [[0.95, 0.006, 18.58, 2.30], [0.95, 0.006, 18.58, 3.50], [0.006, 1.2, 18.105, 2.90], [0.006, 1.2, 19.055, 2.90]]) kit.add(bed, kit.box(w2, 0.006, d2), matEdge, [x2, Y + 0.004, z2], [0, 0, 0], { shadow: false });
    const chair = kit.group(bed, [18.42, Y, 2.90], -Math.PI / 2 + 0.12, 'chair');
    const sy = 0.45;
    // CH20-style elbow chair: slim splayed legs, rear legs rise into a steam-bent back/arm rail, black leather seat
    const leather = std({ color: 0x242424, roughness: 0.45, metalness: 0 });
    kit.add(chair, kit.cushion(0.46, 0.035, 0.42, 0.03, 0.012), leather, [0, sy, 0.01]);
    kit.add(chair, kit.box(0.42, 0.04, 0.38), M.matteBlack, [0, sy - 0.035, 0.01]); // seat frame rail
    for (const sx of [-1, 1]) {
      kit.add(chair, kit.tube([[sx * 0.19, sy - 0.04, 0.17], [sx * 0.205, sy * 0.5, 0.19], [sx * 0.225, 0, 0.215]], 0.013, 8), M.matteBlack); // front legs
      kit.add(chair, kit.tube([[sx * 0.235, 0, -0.215], [sx * 0.215, sy * 0.5, -0.185], [sx * 0.2, sy, -0.17], [sx * 0.205, 0.66, -0.165]], 0.014, 16), M.matteBlack); // rear legs up to the rail
    }
    kit.add(chair, kit.tube([[-0.24, 0.63, 0.10], [-0.245, 0.67, -0.06], [-0.18, 0.71, -0.20], [0, 0.73, -0.25], [0.18, 0.71, -0.20], [0.245, 0.67, -0.06], [0.24, 0.63, 0.10]], 0.02, 48), M.matteBlack); // elbow rail
    kit.add(chair, kit.rbox(0.12, 0.18, 0.02, 0.008), M.matteBlack, [0, sy + 0.17, -0.235], [-0.12, 0, 0]); // centre back splat
    phys.solidGroup(chair);
    // wall TV above the pedestal / kneehole, floating shelves at the street end, outlet plates
    const tv = kit.group(bed, [X0, Y + 1.30, 3.42], Math.PI / 2, 'tv'); // 1.45 x 0.85 screen in a thin wood frame, over the kneehole
    kit.add(tv, kit.rbox(1.57, 0.90, 0.035, 0.004), deskOak, [0, 0.45, 0.035]);
    kit.add(tv, kit.box(1.54, 0.87, 0.01), M.matteBlack, [0, 0.45, 0.050]);
    kit.add(tv, new THREE.PlaneGeometry(1.53, 0.86), screen, [0, 0.45, 0.0555]);
    for (const sy2 of [1.62, 2.02]) kit.add(bed, kit.rbox(0.28, 0.055, 1.23, 0.006), cabWhite, [X0 + 0.14, Y + sy2, 1.885]); // two white floating shelves, end short of the wardrobe wall
    for (const [z, yy] of [[4.27, 1.12], [1.60, 0.95]]) kit.add(bed, kit.rbox(0.008, 0.115, 0.07, 0.002), cabWhite, [X0 + 0.004, Y + yy, z]);
    // teal bottle vase on the cabinet end (dynamic)
    const vase = kit.add(bed, kit.lathe([[0, 0], [0.07, 0.003], [0.105, 0.04], [0.115, 0.09], [0.10, 0.14], [0.055, 0.19], [0.026, 0.23], [0.022, 0.31], [0.034, 0.335], [0.03, 0.34], [0, 0.34]], 40), tealGlass, [17.80, Y + H, 1.52]); void vase;
  }
  // ---- pool-scene art on the bath wall (z = 6.00), black float frame
  {
    const W = 1.12, H = 1.36, a = kit.group(bed, [19.05, Y + 1.72, Z1], Math.PI, 'poolArt');
    kit.add(a, kit.rbox(W + 0.024, H + 0.024, 0.04, 0.003), M.matteBlack, [0, 0, 0.02]);
    kit.add(a, new THREE.PlaneGeometry(W, H), std({ map: poolArtTex(kit), roughness: 0.6 }), [0, 0, 0.041]);
  }

  // ================================================================ BATH B
  const bath = kit.group(root, [0, 0, 0], 0, 'bathB');
  const [BX0, BZ0, BX1, BZ1] = BATH.rect, BY = BATH.y, BTOP = ctx.plan.LEVELS[1].plate;
  const SZ = 7.45, SF = 7.60; // shower: z SZ..BZ1 across the whole width; front line (pony wall / glass) at z SZ..SF
  kit.floorFinish(bath, [BX0, BZ0, BX1, SZ], floorTile, BY);
  { const sf = std({ map: marbleTex(kit, 12, 1024), roughness: 0.45, envMapIntensity: 0.5 }); sf.map.repeat.set(1 / 1.2, 1 / 1.2); kit.floorFinish(bath, [BX0, SZ, BX1, BZ1], sf, BY, 0.006); } // matching dark marble shower floor
  kit.add(bath, kit.box(0.11, 0.004, 0.11), mBlack, [21.35, BY + 0.0105, 8.20], [0, 0, 0], { shadow: false }); // square drain
  // grey tile skirting on the dry walls
  kit.boxAt(bath, tileBase, BX0, BY, BZ0, 0.04, 0.08, 0.012); // stub by the door (rest hidden by door/vanity)
  kit.boxAt(bath, tileBase, BX1 - 0.012, BY, BZ0, 0.012, 0.08, SZ - BZ0);
  kit.boxAt(bath, tileBase, BX0, BY, 6.98, 0.012, 0.08, SZ - 6.98);
  // warm-white paint overlay on the dry walls (window / doors left open)
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bathB-win'), wa = o.at[1] - o.w / 2, wb = o.at[1] + o.w / 2;
    const dd = ctx.plan.OPENINGS.find(q => q.id === 'bathB-d'), da = dd.at[0] - dd.w / 2, db = dd.at[0] + dd.w / 2;
    const cd = ctx.plan.OPENINGS.find(q => q.id === 'clB-d'), ca = cd.at[1] - cd.w / 2, cb = cd.at[1] + cd.w / 2;
    const wp = (a2, b2, y0, y1, n) => kit.wallPanel(bath, a2, b2, BY + y0, BY + y1, n, warmWall, 0.003);
    const HT = BTOP - BY;
    wp([BX1, BZ0], [BX1, wa], 0, HT, [-1, 0]); wp([BX1, wb], [BX1, SZ], 0, HT, [-1, 0]); wp([BX1, wa], [BX1, wb], 0, o.sill, [-1, 0]); wp([BX1, wa], [BX1, wb], o.head, HT, [-1, 0]);
    wp([BX0, BZ0], [da, BZ0], 0, HT, [0, 1]); wp([db, BZ0], [BX1, BZ0], 0, HT, [0, 1]); wp([da, BZ0], [db, BZ0], dd.head, HT, [0, 1]);
    wp([BX0, BZ0], [BX0, ca], 0, HT, [1, 0]); wp([BX0, cb], [BX0, SZ], 0, HT, [1, 0]); wp([BX0, ca], [BX0, cb], cd.head, HT, [1, 0]);
  }
  // ---- Nero Marquina walk-in shower: full-height slab walls, marble pony wall with a stepped end, glass to the ceiling
  {
    const mp = (a2, b2, n) => kit.wallPanel(bath, a2, b2, BY, BTOP, n, marble, 0.004);
    mp([BX1, SZ], [BX1, BZ1], [-1, 0]); mp([BX1, BZ1], [BX0, BZ1], [0, -1]); mp([BX0, BZ1], [BX0, SZ], [1, 0]);
    const PX = 21.95, STEPX = 21.80, PH = 1.00, STH = 0.32, CURB = 0.06, GX = 20.86, GZ = (SZ + SF) / 2, GT = BTOP - 0.012;
    kit.boxAt(bath, marble, PX, BY, SZ, BX1 - PX, PH, SF - SZ);                 // pony wall
    kit.boxAt(bath, marble, STEPX, BY, SZ + 0.02, PX - STEPX, STH, SF - SZ - 0.04); // stepped notch at its end
    kit.boxAt(bath, marble, GX, BY, SZ + 0.035, STEPX - GX, CURB, SF - SZ - 0.07); // curb under the return glass
    phys.boxAABB([PX, BY, SZ], [BX1, BY + PH, SF]);
    // glass: fixed panel over the pony wall to the ceiling + wide return panel facing the vanity (entry left open by the closet wall)
    for (const [x0, x1, y0] of [[PX, BX1, PH], [GX, PX, CURB]]) {
      const gp = kit.add(bath, kit.box(x1 - x0, GT - BY - y0, 0.010), glassMat, [(x0 + x1) / 2, (BY + y0 + GT) / 2, GZ], [0, 0, 0], { shadow: false }); gp.renderOrder = 3;
    }
    kit.add(bath, kit.box(0.010, GT - BY - CURB, 0.012), glassEdge, [GX + 0.005, (BY + CURB + GT) / 2, GZ], [0, 0, 0], { shadow: false });
    kit.add(bath, kit.box(0.012, GT - BY - PH, 0.012), glassEdge, [PX, (BY + PH + GT) / 2, GZ], [0, 0, 0], { shadow: false });
    // black U-channel following the stepped profile
    const chn = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); kit.add(bath, kit.box(Math.max(L, 0.022), 0.022, 0.034), mBlack, [(x0 + x1) / 2, BY + (y0 + y1) / 2, GZ], [0, 0, Math.atan2(y1 - y0, x1 - x0)]); };
    chn(GX, CURB + 0.011, STEPX, CURB + 0.011); chn(STEPX, CURB, STEPX, STH); chn(STEPX, STH + 0.011, PX, STH + 0.011); chn(PX, STH, PX, PH); chn(PX, PH + 0.011, BX1, PH + 0.011);
    phys.boxAABB([GX, BY, GZ - 0.01], [PX, BY + 2.1, GZ + 0.01]);
    // fixtures on the closet-side wall (x = 20.00), polished nickel: rain head on an arm, slide bar + hand shower, two valve trims
    const wx = BX0 + 0.004;
    kit.add(bath, kit.cyl(0.032, 0.032, 0.03, 24), nickel, [wx + 0.015, BY + 2.16, 8.50], [0, 0, Math.PI / 2]);
    kit.add(bath, kit.tube([[wx, BY + 2.16, 8.50], [wx + 0.22, BY + 2.20, 8.50], [wx + 0.38, BY + 2.13, 8.50]], 0.011, 16), nickel);
    kit.add(bath, kit.lathe([[0, 0], [0.03, 0], [0.10, -0.03], [0.105, -0.045], [0, -0.045]], 40), nickel, [wx + 0.40, BY + 2.14, 8.50]);
    const sbz = 8.12;
    kit.add(bath, kit.cyl(0.0095, 0.0095, 0.80, 12), nickel, [wx + 0.04, BY + 1.38, sbz]);
    for (const yy of [0.98, 1.78]) kit.add(bath, kit.box(0.045, 0.024, 0.024), nickel, [wx + 0.02, BY + yy, sbz]);
    kit.add(bath, kit.tube([[wx + 0.05, BY + 1.62, sbz], [wx + 0.09, BY + 1.70, sbz], [wx + 0.12, BY + 1.79, sbz]], 0.017, 12), nickel);
    kit.add(bath, kit.cyl(0.03, 0.022, 0.025, 20), nickel, [wx + 0.13, BY + 1.80, sbz], [0, 0, -0.5]);
    kit.add(bath, kit.tube([[wx + 0.05, BY + 1.58, sbz], [wx + 0.07, BY + 1.0, sbz + 0.02], [wx + 0.06, BY + 0.70, sbz + 0.06], [wx + 0.03, BY + 0.92, sbz + 0.12], [wx + 0.03, BY + 1.10, sbz + 0.14]], 0.006, 40), nickel);
    for (const [yy, rr] of [[1.10, 0.045], [1.36, 0.035]]) { kit.add(bath, kit.cyl(rr, rr, 0.02, 28), nickel, [wx + 0.01, BY + yy, 7.86], [0, 0, Math.PI / 2]); kit.add(bath, kit.cyl(0.011, 0.011, 0.08, 10), nickel, [wx + 0.05, BY + yy, 7.86], [0, 0, Math.PI / 2]); kit.add(bath, kit.box(0.02, 0.012, 0.07), nickel, [wx + 0.09, BY + yy, 7.89]); }
  }
  // ---- vanity on the bedroom wall (z = 6.15), east of the door: rift oak, black marble top, matte black
  {
    const L = 1.40, D = 0.56, H = 0.86, kick = 0.09, T = 0.05, VX = 21.00;
    const v = kit.group(bath, [VX, BY, BZ0], 0, 'vanity');
    kit.add(v, kit.box(L - 0.04, kick, D - 0.08), tileBase, [L / 2, kick / 2, (D - 0.08) / 2]);
    for (const [a0, a1, hh] of [[0, 0.44, H - kick], [L - 0.44, L, H - kick], [0.44, L - 0.44, H - kick - 0.20]]) kit.add(v, kit.box(a1 - a0, hh, D - 0.025), oak, [(a0 + a1) / 2, kick + hh / 2, (D - 0.025) / 2]);
    const fr = (x, y, w, h, hp) => { kit.add(v, kit.shakerFront(w - 0.006, h - 0.006, 0.065, 0.026, 0.012), oak, [x + 0.003, y + 0.003, D - 0.025]); kit.add(v, kit.rbox(hp ? 0.16 : 0.014, hp ? 0.012 : 0.16, 0.014, 0.004), mBlack, hp ? [x + w / 2, y + h - 0.06, D + 0.005] : [x + (x < L / 2 ? w - 0.05 : 0.05), y + h - 0.13, D + 0.005]); };
    const dh = (H - kick) / 3;
    for (let i = 0; i < 3; i++) fr(0, kick + i * dh, 0.42, dh, true);
    for (let i = 0; i < 3; i++) fr(L - 0.42, kick + i * dh, 0.42, dh, true);
    fr(0.42, kick, (L - 0.84) / 2, H - kick, false); fr(L / 2, kick, (L - 0.84) / 2, H - kick, false);
    // thick (6 cm mitred-look) black marble top with an undermount sink, no backsplash
    const sx = L / 2, sw = 0.48, sd = 0.34, sz = 0.30, OD = D + 0.02;
    const slab = (x0, x1, z0, z1) => kit.add(v, kit.rbox(x1 - x0, T, z1 - z0, 0.004), marbleTop, [(x0 + x1) / 2, H + T / 2, (z0 + z1) / 2]);
    slab(-0.01, sx - sw / 2, 0, OD); slab(sx + sw / 2, L + 0.01, 0, OD); slab(sx - sw / 2, sx + sw / 2, 0, sz - sd / 2); slab(sx - sw / 2, sx + sw / 2, sz + sd / 2, OD);
    kit.add(v, kit.box(L + 0.02, 0.02, 0.025), marbleTop, [L / 2, H - 0.01, OD - 0.0125]); // mitred drop edge
    // undermount basin: rounded white bowl hanging under the slab opening (only its inside shows)
    // undermount rectangular white basin (inside faces only) + drain
    kit.add(v, kit.box(sw - 0.01, 0.17, sd - 0.01), std({ color: 0xf7f7f5, roughness: 0.12, side: THREE.BackSide }), [sx, H + T - 0.09, sz], [0, 0, 0], { shadow: false }).receiveShadow = false;
    kit.add(v, kit.cyl(0.02, 0.02, 0.004, 20), mBlack, [sx, H + T - 0.168, sz]);
    // low matte-black wall-mount spout + single lever on the wall above the top
    const fy = H + T + 0.20;
    kit.add(v, kit.cyl(0.035, 0.035, 0.012, 28), mBlack, [sx, fy, 0.006], [Math.PI / 2, 0, 0]);
    kit.add(v, kit.cyl(0.012, 0.012, 0.17, 16), mBlack, [sx, fy, 0.09], [Math.PI / 2, 0, 0]);
    kit.add(v, kit.cyl(0.011, 0.009, 0.03, 16), mBlack, [sx, fy - 0.012, 0.168]);
    kit.add(v, kit.cyl(0.03, 0.03, 0.012, 24), mBlack, [sx + 0.20, fy, 0.006], [Math.PI / 2, 0, 0]);
    kit.add(v, kit.box(0.012, 0.012, 0.09), mBlack, [sx + 0.20, fy + 0.02, 0.05], [0.3, 0, 0]);
    // mirror above (black thin frame)
    phys.solidGroup(v);
    // folded black hand towel (dynamic)
    const t = kit.add(bath, kit.rbox(0.28, 0.07, 0.22, 0.025), towelBlack, [VX + L - 0.22, BY + H + T + 0.035, BZ0 + 0.22]); dynamicBits.push(t);
  }
  // ---- far (window) wall: cow print, towel bar with black towels, TP holder, window light bar, toilet
  {
    const art = kit.group(bath, [BX1, BY + 1.86, 6.45], -Math.PI / 2, 'cowArt'); // 0.56 x 0.80 thin black frame, white mat
    kit.add(art, kit.box(0.56, 0.80, 0.022), M.matteBlack, [0, 0, 0.011]);
    kit.add(art, new THREE.PlaneGeometry(0.535, 0.775), std({ color: 0xf6f5f2, roughness: 0.85 }), [0, 0, 0.0225]);
    kit.add(art, new THREE.PlaneGeometry(0.40, 0.57), std({ map: cowPrintTex(kit), roughness: 0.7 }), [0, 0.01, 0.023]);
    const bx = BX1 - 0.06, by = BY + 1.12;
    kit.add(bath, kit.cyl(0.01, 0.01, 0.62, 12), mBlack, [bx, by, 6.45], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) kit.add(bath, kit.cyl(0.014, 0.014, 0.06, 12), mBlack, [BX1 - 0.03, by, 6.45 + s * 0.31], [0, 0, Math.PI / 2]);
    for (const [z, w] of [[6.31, 0.26], [6.59, 0.26]]) {
      kit.add(bath, kit.cushion(0.035, 0.62, w, 0.015, 0), towelBlack, [bx + 0.022, by - 0.30, z]);
      kit.add(bath, kit.cushion(0.035, 0.52, w, 0.015, 0), towelBlack, [bx - 0.022, by - 0.25, z]);
      kit.add(bath, kit.cushion(0.06, 0.05, w, 0.02, 0), towelBlack, [bx, by + 0.012, z]);
    }
    kit.add(bath, kit.cyl(0.008, 0.008, 0.15, 10), chrome, [BX1 - 0.04, BY + 0.72, 6.82], [Math.PI / 2, 0, 0]);
    kit.add(bath, kit.cyl(0.055, 0.055, 0.11, 24), std({ color: 0xf6f6f4, roughness: 0.9 }), [BX1 - 0.07, BY + 0.69, 6.82], [Math.PI / 2, 0, 0]);
    // black roller-shade cassette over the window
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bathB-win');
    const ly = BY + o.head + 0.08;
    kit.add(bath, kit.cyl(0.04, 0.04, o.w + 0.04, 24), M.matteBlack, [BX1 - 0.05, ly, o.at[1] + 0.03], [Math.PI / 2, 0, 0]); // roller-shade cassette
    for (const s of [-1, 1]) kit.add(bath, kit.rbox(0.10, 0.10, 0.02, 0.006), M.matteBlack, [BX1 - 0.05, ly, o.at[1] + 0.03 + s * (o.w / 2 + 0.03)]);
    // toilet (one-piece, skirted) against the far wall, facing -x
    const tg = kit.group(bath, [BX1, BY, 7.20], -Math.PI / 2, 'toilet');
    // sleek one-piece skirted toilet (~0.70 deep, seat at 0.41): oval skirted bowl, low rounded tank, soft-close lid
    kit.add(tg, kit.lathe([[0, 0], [0.175, 0], [0.18, 0.04], [0.172, 0.22], [0.182, 0.34], [0.188, 0.375], [0, 0.38]], 48), porcelain, [0, 0, 0.46]).scale.set(1, 1, 1.32);
    kit.add(tg, kit.rbox(0.36, 0.38, 0.40, 0.11, 5), porcelain, [0, 0.19, 0.25]);
    kit.add(tg, kit.rbox(0.38, 0.26, 0.22, 0.09, 5), porcelain, [0, 0.50, 0.12]); // low rounded tank
    kit.add(tg, kit.cushion(0.37, 0.03, 0.47, 0.06, 0.012), porcelain, [0, 0.395, 0.46]).scale.set(1, 1, 1);
    phys.solidGroup(tg);
  }
  kit.canLights(bath, [[21.0, 7.0], [21.4, 8.25]], BTOP - 0.001);
  { const fill = new THREE.PointLight(0xfff4e8, 1.1, 4.5, 1.6); fill.position.set(21.3, BTOP - 0.5, 7.1); fill.castShadow = false; bath.add(fill); } // warm high-key fill (2 of 2 lights)
  kit.add(bath, kit.box(0.26, 0.012, 0.26), grille, [21.55, BTOP - 0.007, 7.15]);

  // ================================================================ CLOSET B (reach-in shelving)
  {
    const cl = kit.group(root, [0, 0, 0], 0, 'closetB');
    const [cx0, cz0, cx1, cz1] = CL.rect, CY = CL.y;
    for (const yy of [1.75, 2.10]) kit.add(cl, kit.box(0.40, 0.025, cz1 - cz0 - 0.02), cabWhite, [cx0 + 0.20, CY + yy, (cz0 + cz1) / 2]);
    kit.add(cl, kit.cyl(0.014, 0.014, cz1 - cz0 - 0.04, 12), M.brushedNickel, [cx0 + 0.30, CY + 1.70, (cz0 + cz1) / 2], [Math.PI / 2, 0, 0]);
    for (const yy of [1.75, 2.10]) kit.add(cl, kit.box(cx1 - cx0 - 0.42, 0.025, 0.40), cabWhite, [(cx0 + 0.42 + cx1) / 2, CY + yy, cz1 - 0.20]);
    kit.add(cl, kit.cyl(0.014, 0.014, cx1 - cx0 - 0.46, 12), M.brushedNickel, [(cx0 + 0.42 + cx1) / 2, CY + 1.70, cz1 - 0.30], [0, 0, Math.PI / 2]);
    kit.canLights(cl, [[(cx0 + cx1) / 2, (cz0 + cz1) / 2]], BTOP - 0.001);
  }

  // ---------------------------------------------------------------- finish
  root.updateMatrixWorld(true);
  for (const m of dynamicBits) phys.dynamic(m, { mass: 0.4, shape: 'box', friction: 0.8 });
  kit.mergeStatic(root);
}
