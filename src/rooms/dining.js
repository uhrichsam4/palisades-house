// Piece: dining — Dining area with pocket sliders to the pool, wet bar niche
// Owned rooms: dining, wetbar | Reference photos: p06, p07, p12
//
// Layout notes (plan.js has no wall where the photos show the sideboard wall, and the wet-bar rect is
// ~2.2 m wide while the photo niche is ~1.4 m): this piece adds a short partition along the dining's
// z0 side (x 10.20–12.10, face z 13.75) that carries the sideboard + sailboat print, and fills the
// left part of the wet-bar rect so the niche itself is x 12.10–13.50 (as in p12).
export const piece = { rooms: ["dining", "wetbar"], photos: ["p06", "p07", "p12"] };
export const ownCeiling = [];
export const views = {
  p06: { pos: [7.30, 1.30, 16.45], look: [12.30, 0.98, 16.55], fov: 63 },
  p07: { pos: [10.00, 1.76, 17.95], look: [13.30, 1.00, 14.00], fov: 66 },
  p12: { pos: [12.80, 1.40, 14.45], look: [12.78, 1.36, 12.35], fov: 70 },
};

// ---------------------------------------------------------------- layout constants
const PART_Z = 13.75;               // partition face (sideboard wall)
const PART_X0 = 9.95, PART_X1 = 12.10;
const MOUTH = 14.00;                // niche jambs protrude from the sideboard wall to here (p07 white return, p12 deep niche)
const NICHE = { x0: 12.10, x1: 13.50, z0: 12.35, z1: 13.60 };
const CEIL = 3.05;
const TABLE = { x: 12.50, z: 16.10, len: 3.00, wid: 1.10, h: 0.76, ry: 0.45 };
const SB = { x0: 10.00, x1: 11.92, z0: PART_Z, d: 0.50, h: 0.80 };

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M } = kit;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ================================================================ materials
  // dark smoked oak (sideboard, table): Poly Haven smoke_speckled_veneer, grain turned vertical
  const phys_ = (o) => new THREE.MeshPhysicalMaterial(o);
  // black-stained open-grain oak: near-black ground with lighter grey cathedral/straight grain in the open
  // pores (painted), on the white-oak veneer normal + roughness for the pore relief
  const rk = kit.rng(77);
  const blackOakMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#1d1a18'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // grain lines (vertical, slightly wavy, some cathedral arches)
      const x0 = rk() * w, amp = 2 + rk() * 10, f = 0.004 + rk() * 0.01, ph = rk() * 6; const v = 48 + rk() * 34;
      g.strokeStyle = `rgba(${v | 0},${v - 4 | 0},${v - 7 | 0},${0.25 + rk() * 0.4})`; g.lineWidth = 0.6 + rk() * 2.2;
      g.beginPath(); for (let y = 0; y <= h; y += 8) g.lineTo(x0 + amp * Math.sin(y * f + ph), y); g.stroke();
    }
    for (let i = 0; i < 26; i++) { const cx = rk() * w, cy = rk() * h, R = 30 + rk() * 90; g.strokeStyle = `rgba(70,66,62,${0.15 + rk() * 0.2})`; g.lineWidth = 1 + rk() * 1.5;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy + k * 14, R * 0.35 + k * 7, R + k * 14, 0, Math.PI, 2 * Math.PI); g.stroke(); } }
    for (let i = 0; i < 40000; i++) { const v = 40 + rk() * 40; g.fillStyle = `rgba(${v | 0},${v | 0},${v - 3 | 0},0.25)`; g.fillRect(rk() * w, rk() * h, 1, 2 + rk() * 5); } // open pores
  });
  const blackOak = (rep, tint, rough = 0.6) => { const pb = kit.pbrMaps('white_oak_veneer', '1k', { repeat: rep });
    const m = std({ map: blackOakMap.clone(), normalMap: pb.normalMap, roughnessMap: pb.roughnessMap, color: tint, roughness: rough, normalScale: new THREE.Vector2(0.8, 0.8) });
    m.map.repeat.set(rep[0], rep[1]); m.map.needsUpdate = true; return m; };
  const sideboardMat = blackOak([1.2, 1.2], 0xffffff, 0.62);
  const tableMat = blackOak([1.0, 1.0], 0xe8e2dc, 0.5); // brown-black oak with visible grain
  const pedestalMat = blackOak([2, 1], 0xd8d0c8, 0.6);
  const oakVert = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xffd9b0, roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) });
  const blackMatte = M.matteBlack;
  // chairs: matte cream linen (sheen fabric). Shell UVs are in metres; cushion UVs are 0..1 per face
  // chairs: cream boucle (sheen fabric). Shell UVs are in metres; cushion UVs are 0..1 per face
  const linenShell = kit.fabric.boucle('#ddd3c5', { scale: 9 });
  const linenSeat = kit.fabric.boucle('#ddd3c5', { scale: 4.5 });
  const linenPipe = kit.fabric.boucle('#e2d8ca', { scale: 1.2 });
  for (const m of [linenShell, linenSeat, linenPipe]) { m.map = null; m.needsUpdate = true; }
  // brushed / unlacquered brass (LOOKDEV recipe)
  const brass = phys_({ color: 0xd4a84b, metalness: 1, roughness: 0.3, anisotropy: 0.4 });

  // grasscloth: dark chocolate ground (#3a2a20), dense fine straight horizontal straw fibres with lighter
  // tan strands, fine vertical warp threads, and a faint panel seam at the 0.9 m repeat (world-metre UVs)
  const r1 = kit.rng(42);
  const grassMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#2a1f18'; g.fillRect(0, 0, w, h);
    // horizontal strand bands (each straw is ~1-3 px tall and runs most of the width, slight tone drift)
    for (let y = 0; y < h; y += 1 + r1() * 1.6) {
      const t = r1(); const c = t < 0.66 ? [40 + r1() * 12, 30 + r1() * 8, 23 + r1() * 6] : t < 0.93 ? [66 + r1() * 16, 53 + r1() * 12, 42 + r1() * 9] : [112 + r1() * 30, 98 + r1() * 24, 80 + r1() * 18];
      let x = -r1() * w; while (x < w) { const L = 60 + r1() * 420;
        g.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${0.35 + r1() * 0.5})`; const hh = 0.6 + r1() * 1.4; const dy = (r1() - 0.5) * 0.8;
        for (const ox of [-w, 0, w]) g.fillRect(x + ox, y + dy, L, hh); x += L + r1() * 30; }
    }
    // knots / slubs: short bright dashes
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${130 + r1() * 40 | 0},${114 + r1() * 30 | 0},${92 + r1() * 20 | 0},${0.25 + r1() * 0.35})`; g.fillRect(r1() * w, r1() * h, 6 + r1() * 26, 1.2); }
    // vertical warp threads every ~5 mm
    for (let x = 0; x < w; x += 5.5 + r1() * 1.5) { g.fillStyle = `rgba(20,14,10,${0.10 + r1() * 0.08})`; g.fillRect(x, 0, 0.8, h); }
    // panel seam
    g.fillStyle = 'rgba(14,10,8,0.55)'; g.fillRect(0, 0, 2, h);
  }, { repeat: [1 / 0.9, 1 / 0.9] });
  const r2 = kit.rng(43);
  const grassNor = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 1.2 + r2() * 1.2) { const up = r2() < 0.5; g.fillStyle = up ? 'rgba(128,170,235,0.55)' : 'rgba(128,88,235,0.55)'; g.fillRect(0, y, w, 0.8); }
    for (let x = 0; x < w; x += 2.75 + r2()) { g.fillStyle = 'rgba(100,128,240,0.25)'; g.fillRect(x, 0, 0.6, h); }
  }, { srgb: false, repeat: [1 / 0.9, 1 / 0.9] });
  const grasscloth = phys_({ map: grassMap, normalMap: grassNor, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.78, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x4a3e34), color: 0xffffff });

  // black stone with white veins (Nero Marquina-like)
  const r3 = kit.rng(7);
  const stoneMap = kit.canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1c1c1d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(40,40,44,${r3() * 0.25})`; g.beginPath(); g.arc(r3() * w, r3() * h, 10 + r3() * 60, 0, 6.28); g.fill(); }
    const vein = (bold) => {
      let x = r3() * w, y = r3() * h; const a = r3() * 6.28; let dx = Math.cos(a), dy = Math.sin(a) * 0.5;
      g.strokeStyle = bold ? 'rgba(235,235,232,0.85)' : 'rgba(200,200,200,0.35)'; g.lineWidth = bold ? 1.6 + r3() * 1.6 : 0.6;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 60; s++) { dx += (r3() - 0.5) * 0.5; dy += (r3() - 0.5) * 0.5; const n = Math.hypot(dx, dy); x += dx / n * 9; y += dy / n * 9; g.lineTo(x, y); }
      g.stroke();
    };
    for (let i = 0; i < 7; i++) vein(true); for (let i = 0; i < 26; i++) vein(false);
  });
  const blackStone = std({ map: stoneMap, roughness: 0.22, metalness: 0.0, envMapIntensity: 1.0 });

  // fluted (reeded) oak fronts: vertical rib normal map
  const ribNor = kit.canvasTex(64, 8, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let x = 0; x < w; x++) { const nx = Math.sin((x / w) * Math.PI * 2) * 0.75; const v = Math.round((nx * 0.5 + 0.5) * 255);
      for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = v; img.data[i + 1] = 128; img.data[i + 2] = 230; img.data[i + 3] = 255; } }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  const flutedMat = (w, h) => { const n = ribNor.clone(); n.needsUpdate = true; n.repeat.set(Math.round(w / 0.022), 1);
    return std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [w, h] }), normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9), color: 0xffd6a8, roughness: 0.55 }); };

  // rug: light grey-ivory low-pile vintage wash — soft cloudy abrash, faint ghost medallion, worn pile
  const r4 = kit.rng(99);
  const rugMap = kit.canvasTex(1024, 768, (g, w, h) => {
    g.fillStyle = '#b3aea6'; g.fillRect(0, 0, w, h);
    // low-frequency cloudy abrash (grey + warm ivory)
    for (let i = 0; i < 520; i++) { const x = r4() * w, y = r4() * h, R = 12 + r4() * 110; const dark = r4() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, R); const c = dark ? `${150 + r4() * 25 | 0},${148 + r4() * 25 | 0},${146 + r4() * 25 | 0}` : `${222 + r4() * 18 | 0},${216 + r4() * 16 | 0},${204 + r4() * 14 | 0}`;
      gr.addColorStop(0, `rgba(${c},${0.16 + r4() * 0.2})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
    // ghost of a faded vintage field pattern + border
    g.strokeStyle = 'rgba(128,124,122,0.10)'; g.lineWidth = 10; g.strokeRect(46, 46, w - 92, h - 92);
    g.lineWidth = 3; g.strokeRect(70, 70, w - 140, h - 140);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(135,130,128,${0.03 + r4() * 0.05})`; g.lineWidth = 2 + r4() * 5; g.beginPath();
      const cx = 140 + r4() * (w - 280), cy = 120 + r4() * (h - 240); g.ellipse(cx, cy, 14 + r4() * 70, 8 + r4() * 40, r4() * 3, 0, 6.28); g.stroke(); }
    // horizontal abrash streaks along the weft
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r4() < 0.5 ? '120,118,116' : '238,234,226'},${0.03 + r4() * 0.05})`; g.fillRect(0, r4() * h, w, 1 + r4() * 6); }
    // fine pile speckle
    for (let i = 0; i < 60000; i++) { const v = 150 + r4() * 90; g.fillStyle = `rgba(${v},${v - 3},${v - 8},${0.10 + r4() * 0.14})`; g.fillRect(r4() * w, r4() * h, 1 + r4() * 2, 1); }
  });
  const carpetN = kit.tex('assets/acg/Carpet016/Carpet016_NormalGL.jpg', { repeat: [11, 8] });
  const rugMat = phys_({ map: rugMap, color: 0xd6d2cc, roughness: 1.0, normalMap: carpetN, normalScale: new THREE.Vector2(0.6, 0.6), sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xbdb8b0) });

  // sepia sailboat print (recreated): grainy vintage photo of a big racing sloop under towering white sails,
  // hazy hills behind, a crowd of spectator launches and people in the foreground water
  const art = kit.canvasTex(800, 1000, (g, w, h) => {
    const rr = kit.rng(3);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7); sky.addColorStop(0, '#8a8986'); sky.addColorStop(1, '#c4c3be');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (const [base, amp, col] of [[0.64, 46, 'rgba(140,139,135,0.8)'], [0.68, 30, 'rgba(110,109,106,0.9)']]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, h * base - amp * (0.5 + 0.5 * Math.sin(x / 70 + base * 11)) - 5 * Math.sin(x / 11));
      g.lineTo(w, h); g.fill();
    }
    const sea = g.createLinearGradient(0, h * 0.70, 0, h); sea.addColorStop(0, '#8e8d89'); sea.addColorStop(1, '#4a4947'); g.fillStyle = sea; g.fillRect(0, h * 0.70, w, h * 0.30);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(225,224,220,${rr() * 0.28})`; g.fillRect(rr() * w, h * 0.71 + rr() * h * 0.29, 3 + rr() * 16, 1); }
    // racing sloop: dark hull heeled slightly, tall Bermuda main + overlapping genoa
    g.fillStyle = '#1b1b1a'; g.beginPath(); g.moveTo(w * 0.16, h * 0.775); g.quadraticCurveTo(w * 0.5, h * 0.80, w * 0.86, h * 0.765); g.lineTo(w * 0.78, h * 0.805); g.lineTo(w * 0.26, h * 0.81); g.closePath(); g.fill();
    g.fillStyle = 'rgba(240,240,236,0.85)'; g.fillRect(w * 0.70, h * 0.80, w * 0.2, 4);
    g.strokeStyle = '#2a2a29'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.47, h * 0.775); g.lineTo(w * 0.50, h * 0.04); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.47, h * 0.74); g.lineTo(w * 0.17, h * 0.755); g.stroke();
    const mainG = g.createLinearGradient(w * 0.18, 0, w * 0.48, 0); mainG.addColorStop(0, '#d9d8d3'); mainG.addColorStop(1, '#f6f5f1');
    g.fillStyle = mainG; g.beginPath(); g.moveTo(w * 0.495, h * 0.05); g.quadraticCurveTo(w * 0.27, h * 0.40, w * 0.18, h * 0.745); g.lineTo(w * 0.47, h * 0.735); g.closePath(); g.fill();
    const jibG = g.createLinearGradient(w * 0.5, 0, w * 0.9, 0); jibG.addColorStop(0, '#efeee9'); jibG.addColorStop(1, '#cfcec9');
    g.fillStyle = jibG; g.beginPath(); g.moveTo(w * 0.505, h * 0.10); g.quadraticCurveTo(w * 0.70, h * 0.45, w * 0.86, h * 0.755); g.lineTo(w * 0.50, h * 0.76); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,110,106,0.35)'; g.lineWidth = 1; for (let i = 1; i < 12; i++) { const t = i / 12; g.beginPath(); g.moveTo(w * (0.495 - 0.025 * t), h * (0.05 + 0.69 * t)); g.lineTo(w * (0.495 - 0.31 * t * 0.98), h * (0.05 + 0.70 * t)); g.stroke(); }
    // spectator boats and people in the foreground
    for (let i = 0; i < 26; i++) { const x = rr() * w, y = h * (0.83 + rr() * 0.14), L = 30 + rr() * 70, H = 6 + rr() * 8;
      g.fillStyle = `rgba(${30 + rr() * 40 | 0},${30 + rr() * 40 | 0},${28 + rr() * 38 | 0},0.9)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y - 2); g.lineTo(x + L * 0.85, y + H); g.lineTo(x + L * 0.1, y + H); g.closePath(); g.fill();
      const np = 1 + (rr() * 5 | 0); for (let k = 0; k < np; k++) { const px = x + L * (0.15 + 0.7 * rr()); g.fillStyle = rr() < 0.4 ? '#e4e3de' : '#2a2a28'; g.fillRect(px, y - 12, 4, 11); g.beginPath(); g.arc(px + 2, y - 15, 3, 0, 6.28); g.fill(); } }
    for (let i = 0; i < 5; i++) { const x = w * (0.05 + rr() * 0.9), y = h * (0.66 + rr() * 0.05); g.fillStyle = 'rgba(225,224,219,0.85)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 40 - rr() * 30); g.lineTo(x + 18, y); g.fill(); }
    // film grain + vignette + sepia
    const img = g.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const px = (i / 4) % w, py = (i / 4 / w) | 0; const vx = px / w - 0.5, vy = py / h - 0.5;
      const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * (1 - 0.5 * (vx * vx + vy * vy)) + (rr() - 0.5) * 30; const vc = Math.max(0, (v - 120) * 1.3 + 118); d[i] = Math.min(255, vc * 1.05 + 6); d[i + 1] = Math.min(255, vc * 0.97 + 2); d[i + 2] = vc * 0.82; }
    g.putImageData(img, 0, 0);
  });

  // ================================================================ helpers
  const add = (parent, geo, mat, pos, rot, opt) => kit.add(parent, geo, mat, pos, rot, opt);
  const latheY = (pts, seg = 40) => kit.lathe(pts, seg);
  const stadium = (L, W, depth, bevel = 0.006) => {
    const r = W / 2, s = (L - W) / 2, pts = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; pts.push([s + r * Math.cos(a), r * Math.sin(a)]); }
    for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 + (i / 24) * Math.PI; pts.push([-s + r * Math.cos(a), r * Math.sin(a)]); }
    const g = kit.extrude(pts, depth, bevel); g.rotateX(-Math.PI / 2); return g;
  };
  const fluted = (r, h, ribs = 26, d = 0.012) => {
    const seg = ribs * 8; const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true);
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x); const k = r - d * (1 - Math.pow(Math.abs(Math.sin(a * ribs / 2)), 0.45)); const l = Math.hypot(v.x, v.z) || 1; p.setXYZ(i, v.x / l * k, v.y, v.z / l * k); }
    g.computeVertexNormals(); return g;
  };
  const leafGeo = (len, wid, droop, curl = 0) => {
    const g = new THREE.PlaneGeometry(wid, len, 2, 8); g.translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const t = y / len;
      const taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.7);
      p.setXYZ(i, x * taper, y - droop * t * t * len * 0.35, droop * t * t * len + Math.abs(x) * curl); }
    g.computeVertexNormals(); return g;
  };

  // ================================================================ partition (sideboard wall) + wet-bar infill
  const walls = kit.group(root, [0, 0, 0], 0, 'dining-partition');
  kit.boxAt(walls, M.paintWhite, PART_X0, 0, 13.60, 11.30 - PART_X0, CEIL, PART_Z - 13.60);
  kit.boxAt(walls, M.paintWhite, 11.27, 0, NICHE.z0, PART_X1 - 11.27, CEIL, PART_Z - NICHE.z0);
  phys.boxAABB([PART_X0, 0, 13.60], [11.30, CEIL, PART_Z]);
  phys.boxAABB([11.27, 0, NICHE.z0], [PART_X1, CEIL, PART_Z]);
  // left niche jamb return (white on the dining side, grasscloth inside)
  kit.boxAt(walls, M.paintWhite, 11.96, 0, PART_Z - 0.01, PART_X1 - 11.96, CEIL, MOUTH - PART_Z + 0.01);
  phys.boxAABB([11.96, 0, PART_Z], [PART_X1, CEIL, MOUTH]);
  // niche jamb return (left), from partition face back to the opening plane
  // baseboards (white, 10 cm) on the partition and the store wall
  for (const [x0, z0, w, d] of [[PART_X0, PART_Z, 11.96 - PART_X0, 0.012], [PART_X0 - 0.012, 13.45, 0.012, PART_Z - 13.45],
    [13.50, 13.60, 0.53, 0.012], [14.87, 13.60, 15.39 - 14.87, 0.012]]) { const bb = kit.boxAt(root, M.paintWhite, x0, 0, z0, w, 0.10, d); bb.castShadow = false; }

  // ================================================================ rug
  // table set (rug, table, chairs) sits on a diagonal, long axis pointing toward the pool
  const dset = kit.group(root, [TABLE.x, 0, TABLE.z], TABLE.ry, 'dining-set');
  const rug = add(dset, kit.rbox(4.30, 0.012, 3.00, 0.005, 2), rugMat, [0.05, 0.006, 0]);
  rug.castShadow = false;

  // ================================================================ oval pedestal table
  const tbl = kit.group(dset, [0, 0, 0], 0, 'dining-table');
  // thin racetrack top with a soft, fully rounded eased edge (bevel ~ half the thickness)
  const tb = 0.009;
  add(tbl, stadium(TABLE.len - 2 * tb, TABLE.wid - 2 * tb, 0.018, tb), tableMat, [0, TABLE.h - 0.018 - tb, 0]);
  add(tbl, stadium(TABLE.len - 0.50, TABLE.wid - 0.34, 0.02, 0.002), pedestalMat, [0, TABLE.h - 0.058, 0]);
  add(tbl, fluted(0.27, TABLE.h - 0.09, 30, 0.014), pedestalMat, [0, (TABLE.h - 0.09) / 2 + 0.012, 0]);
  add(tbl, kit.cyl(0.255, 0.255, 0.02, 64), pedestalMat, [0, TABLE.h - 0.085, 0]);
  add(tbl, kit.cyl(0.272, 0.275, 0.014, 64), pedestalMat, [0, 0.007, 0]);
  phys.solidGroup(tbl);

  // ================================================================ curved barrel-back dining chairs
  const SH = { Ro: 0.290, Ri: 0.258, A: THREE.MathUtils.degToRad(112), H: 0.37, bev: 0.015 };
  const shellF = (a) => 1 - 0.50 * THREE.MathUtils.smoothstep(a, 0.20, 1.0); // height falloff toward the arms
  const shellGeo = (() => {
    // fully upholstered barrel back: ~5 cm thick padded wall, well-rounded edges, ~0.6 m wide overall
    const { Ro, Ri, A, H } = SH, N = 48, pts = [];
    for (let i = 0; i <= N; i++) { const a = -A + (2 * A * i) / N; pts.push([Ro * Math.sin(a), Ro * Math.cos(a)]); }
    for (let i = N; i >= 0; i--) { const a = -A + (2 * A * i) / N; pts.push([Ri * Math.sin(a), Ri * Math.cos(a)]); }
    const g = kit.extrude(pts, H, SH.bev); g.rotateX(-Math.PI / 2); // shape y -> -z: back at -z
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.abs(Math.atan2(x, -z)) / A;
      p.setY(i, y <= 0.001 ? y : y * shellF(a));
      // shell tapers inward toward the top (tub silhouette); arms flare slightly at the front
      const tq = 1 - 0.07 * Math.max(0, p.getY(i)) / H;
      // soft padded bulge on the outer back (upholstery over foam), strongest mid-height
      const r = Math.hypot(x, z), outer = r > (Ro + Ri) / 2 ? 1 : 0;
      const bulge = 1 + outer * 0.018 * Math.sin(Math.PI * THREE.MathUtils.clamp(p.getY(i) / H, 0, 1)) * (1 - a * 0.6);
      p.setX(i, x * tq * bulge * (a > 0.6 ? 1 + 0.05 * (a - 0.6) : 1)); p.setZ(i, z * tq * bulge);
    }
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const m = kit.mergeVertices(g, 1e-4); m.computeVertexNormals();
    // box-project uvs (metres) for the linen weave
    const mp = m.attributes.position, muv = new Float32Array(mp.count * 2);
    for (let i = 0; i < mp.count; i++) { muv[i * 2] = mp.getX(i) + mp.getZ(i); muv[i * 2 + 1] = mp.getY(i); }
    m.setAttribute('uv', new THREE.BufferAttribute(muv, 2)); return m;
  })();
  // self-welt piping along the top outer edge of the shell, running down over the arm fronts
  const shellPipe = (() => {
    const { Ro, A, H } = SH, pts = [];
    const rim = (a, y) => { const tq = 1 - 0.07 * y / H; const r = (Ro + 0.006) * tq * (Math.abs(a) / A > 0.6 ? 1 + 0.05 * (Math.abs(a) / A - 0.6) : 1); return [r * Math.sin(a), y, -r * Math.cos(a)]; };
    pts.push(rim(-A, 0.02), rim(-A, (H + 0.004) * shellF(1) * 0.6));
    for (let i = 0; i <= 40; i++) { const a = -A + (2 * A * i) / 40; pts.push(rim(a, (H + 0.004) * shellF(Math.abs(a) / A))); }
    pts.push(rim(A, (H + 0.004) * shellF(1) * 0.6), rim(A, 0.02));
    return kit.tube(pts, 0.0065, 120);
  })();
  const tub = (w, h, d, r, puff) => { const g = kit.cushion(w, h, d, r, puff, 6); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setX(i, x * (z > 0 ? 1 - 0.10 * (z / (d / 2)) ** 2 : 1 - 0.40 * (z / (d / 2)) ** 2)); }
    g.computeVertexNormals(); return g; };
  const tubX = (x, z, d) => x * (z > 0 ? 1 - 0.10 * (z / (d / 2)) ** 2 : 1 - 0.40 * (z / (d / 2)) ** 2);
  const seatBase = tub(0.54, 0.07, 0.50, 0.03, 0.0);   // upholstered tub apron the shell sits on
  const seatGeo = tub(0.50, 0.075, 0.48, 0.032, 0.022);  // thick puffy seat cushion
  // piping round the seat cushion's top edge (front half; the back half disappears into the shell)
  const seatPipe = (() => {
    const pts = [], hw = 0.50 / 2 - 0.012, hd = 0.48 / 2 - 0.012, rc = 0.05;
    for (let i = 0; i <= 48; i++) { const t = i / 48; // left side front-to-back is hidden; run left-back -> front -> right-back
      let x, z; const L = [hd - rc, Math.PI * rc / 2, 2 * hw - 2 * rc, Math.PI * rc / 2, hd - rc]; const tot = L.reduce((a, b) => a + b); let u = t * tot;
      if ((u -= L[0]) < 0) { x = -hw; z = hd - rc + u; } else if ((u -= L[1]) < 0) { const q = (u + L[1]) / rc; x = -hw + rc - rc * Math.cos(q); z = hd - rc + rc * Math.sin(q); }
      else if ((u -= L[2]) < 0) { x = -hw + rc + (u + L[2]); z = hd; } else if ((u -= L[3]) < 0) { const q = (u + L[3]) / rc; x = hw - rc + rc * Math.sin(q); z = hd - rc + rc * Math.cos(q); }
      else { x = hw; z = hd - rc - (u + L[4]); }
      pts.push([tubX(x, z, 0.48), 0.032, z]); }
    return kit.tube(pts, 0.006, 96);
  })();
  const legGeo = kit.cyl(0.017, 0.010, 0.40, 14);       // tapered light-oak legs, thicker at the top
  const legWrap = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.1, 1] }), color: 0xf0e0c8, roughness: 0.55 });
  function chair(x, z, ry) {
    const c = kit.group(dset, [x, 0, z], ry, 'chair');
    for (const [lx, lz] of [[-0.18, -0.17], [0.18, -0.17], [-0.19, 0.18], [0.19, 0.18]]) {
      const leg = add(c, legGeo, legWrap, [lx, 0.20, lz]); leg.rotation.set(lz > 0 ? 0.12 : -0.16, 0, lx > 0 ? 0.10 : -0.10);
    }
    // seat top ~0.47 m, back top ~0.78 m
    add(c, seatBase, linenSeat, [0, 0.39, 0.01]);
    add(c, seatGeo, linenSeat, [0, 0.43, 0.03]);
    add(c, seatPipe, linenPipe, [0, 0.43, 0.03]);
    add(c, shellGeo, linenShell, [0, 0.39, 0.0]);
    add(c, shellPipe, linenPipe, [0, 0.39, 0.0]);
    phys.solidGroup(c);
    return c;
  }
  // 3 per long side at 0.80 m centres + 1 at each end; seat faces the table (+z local)
  for (const dx of [-0.80, 0, 0.80]) {
    chair(dx, -TABLE.wid / 2 - 0.24, 0);
    chair(dx, TABLE.wid / 2 + 0.24, Math.PI);
  }
  chair(-TABLE.len / 2 - 0.24, 0, Math.PI / 2);
  chair(TABLE.len / 2 + 0.24, 0, -Math.PI / 2);

  // ================================================================ linear brass chandelier
  // canopy + short 0.6 m stem to a 1.4 m horizontal brass spine along the table axis; five white linear
  // light bars hang at two offset levels on slim brass drops (upper pair, lower trio).
  const ch = kit.group(root, [TABLE.x, 0, TABLE.z], TABLE.ry, 'chandelier');
  const glow = std({ color: 0xfbf8f2, emissive: 0xfff1da, emissiveIntensity: 2.6, roughness: 0.5 });
  const spineY = CEIL - 0.72;
  add(ch, kit.cyl(0.06, 0.065, 0.025, 32), brass, [0, CEIL - 0.0125, 0]);
  add(ch, kit.cyl(0.008, 0.008, CEIL - spineY, 12), brass, [0, (CEIL + spineY) / 2, 0]);
  add(ch, kit.cyl(0.018, 0.014, 0.05, 16), brass, [0, spineY + 0.02, 0]);
  add(ch, kit.cyl(0.009, 0.009, 1.40, 12), brass, [0, spineY, 0], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) add(ch, kit.sphere(0.013, 12, 8), brass, [s * 0.70, spineY, 0]);
  // [centre x along spine, drop below spine, bar length]
  const bars = [[-0.38, 0.20, 0.62], [0.44, 0.20, 0.52], [-0.52, 0.44, 0.56], [0.06, 0.44, 0.66], [0.58, 0.44, 0.50]];
  for (const [bx, drop, bl] of bars) {
    const y = spineY - drop;
    for (const e of [-1, 1]) { // two drops per bar, to the spine
      const dx = bx + e * (bl / 2 - 0.05);
      add(ch, kit.cyl(0.0035, 0.0035, drop - 0.02, 8), brass, [dx, spineY - (drop - 0.02) / 2, 0]);
    }
    add(ch, kit.rbox(bl, 0.016, 0.034, 0.006), brass, [bx, y + 0.016, 0]);   // brass channel
    add(ch, kit.rbox(bl - 0.01, 0.022, 0.03, 0.009), glow, [bx, y - 0.002, 0]); // opal diffuser
  }

  // ================================================================ black sideboard
  // case with rounded vertical corners, four doors on 3 mm gaps with dark reveals, recessed slot pulls,
  // slab top, black recessed plinth
  const sb = kit.group(root, [(SB.x0 + SB.x1) / 2, 0, SB.z0 + SB.d / 2], 0, 'sideboard');
  const sbw = SB.x1 - SB.x0, plinth = 0.06, topT = 0.035, caseH = SB.h - plinth - topT;
  const grooveMat = std({ color: 0x0a0908, roughness: 0.9 });
  add(sb, kit.box(sbw - 0.12, plinth, SB.d - 0.12), blackMatte, [0, plinth / 2, -0.02]);
  add(sb, kit.rbox(sbw, caseH, SB.d - 0.022, 0.045, 5), sideboardMat, [0, plinth + caseH / 2, -0.011]);
  add(sb, kit.rbox(sbw + 0.004, topT, SB.d + 0.004, 0.008, 4), sideboardMat, [0, SB.h - topT / 2, 0.002]);
  const stile = 0.035, dw = (sbw - 2 * stile) / 4, doorH = caseH - 0.012;
  add(sb, kit.box(sbw - 2 * stile, doorH, 0.004), grooveMat, [0, plinth + caseH / 2, SB.d / 2 - 0.024]); // reveal shadow
  for (let i = 0; i < 4; i++) {
    const dx = -sbw / 2 + stile + dw * (i + 0.5);
    add(sb, kit.rbox(dw - 0.003, doorH, 0.02, 0.0025, 2), sideboardMat, [dx, plinth + caseH / 2, SB.d / 2 - 0.012]);
  }
  for (const px of [-sbw / 4 + 0.045, sbw / 4 + 0.045]) { add(sb, kit.rbox(0.016, 0.30, 0.012, 0.007), grooveMat, [px, plinth + caseH * 0.55, SB.d / 2 - 0.003]); }
  phys.solidGroup(sb);

  // art above: black-framed sepia photo print, image runs to a thin dark border (no white mat)
  const AW = 1.00, AH = 1.25;
  const artG = kit.group(root, [10.80, SB.h + 0.15 + AH / 2, PART_Z + 0.02], 0, 'sailboat-print');
  add(artG, kit.rbox(AW, AH, 0.03, 0.003), M.matteBlack, [0, 0, 0.015]);
  add(artG, new THREE.PlaneGeometry(AW - 0.03, AH - 0.03), std({ map: art, roughness: 0.45 }), [0, 0, 0.0355]);
  // smart thermostat / home-control panel right of the print (p07)
  add(root, kit.rbox(0.13, 0.10, 0.012, 0.005), std({ color: 0x111111, roughness: 0.2 }), [11.62, 1.42, PART_Z + 0.006]);
  add(root, new THREE.PlaneGeometry(0.10, 0.07), std({ color: 0x1c2228, emissive: 0x2a3440, emissiveIntensity: 0.4, roughness: 0.1 }), [11.62, 1.42, PART_Z + 0.0125]);

  // ---- sideboard decor (dynamic: players can knock them over)
  const top = SB.h + 0.002, zc = SB.z0 + SB.d / 2;
  // white orchid in a faceted gold pot
  const orch = kit.group(root, [SB.x0 + 0.52, top, zc - 0.02], 0.3, 'orchid');
  // faceted gold pot: diamond facets from a low-poly lathe with offset rings
  const goldFacet = std({ color: 0xd9b26a, metalness: 1.0, roughness: 0.28, flatShading: true });
  { const g = new THREE.CylinderGeometry(0.085, 0.068, 0.16, 10, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ring = Math.round((y + 0.08) / 0.04); const a = Math.atan2(z, x) + (ring % 2) * Math.PI / 10;
      const r = Math.hypot(x, z) * (ring % 2 ? 1.06 : 0.98); p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r); }
    g.computeVertexNormals(); add(orch, g, goldFacet, [0, 0.08, 0]); }
  add(orch, kit.cyl(0.072, 0.072, 0.01, 16), std({ color: 0x5b4a33, roughness: 1 }), [0, 0.148, 0]);
  const leafMat = std({ color: 0x3f6b2c, roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) { const l = add(orch, leafGeo(0.24, 0.07, 0.5, 0.02), leafMat, [0, 0.15, 0]); l.rotation.set(1.0, i * 1.3, 0); }
  const flowerMat = std({ color: 0xfbfaf6, roughness: 0.6, side: THREE.DoubleSide });
  const stemMat = std({ color: 0x5d6a3a, roughness: 0.7 });
  for (const [sx, sz, h, bend] of [[0.01, 0.0, 0.52, 0.16], [-0.02, 0.02, 0.45, -0.12]]) {
    const pts = [[sx, 0.15, sz], [sx, 0.15 + h * 0.6, sz], [sx + bend * 0.6, 0.15 + h * 0.92, sz + 0.02], [sx + bend, 0.15 + h * 0.85, sz + 0.03]];
    add(orch, kit.tube(pts, 0.003, 24), stemMat);
    for (let k = 0; k < 6; k++) { const t = 0.55 + k * 0.08; const fx = sx + bend * (t - 0.4) * 1.4, fy = 0.15 + h * (0.72 + 0.2 * Math.sin(t * 3)), fz = sz + 0.03 + (k % 2) * 0.02;
      const f = add(orch, kit.sphere(0.034, 10, 6), flowerMat, [fx, fy, fz]); f.scale.set(1, 1, 0.3); f.rotation.y = 0.4; }
  }
  phys.dynamic(orch, { mass: 1.5 });
  // black round planter with succulent
  const succ = kit.group(root, [SB.x0 + 1.34, top, zc], 0, 'succulent');
  add(succ, latheY([[0, 0], [0.05, 0], [0.085, 0.04], [0.095, 0.09], [0.088, 0.13], [0.0, 0.13]], 32), std({ color: 0x151515, roughness: 0.45 }), [0, 0, 0]);
  const succMat = std({ color: 0x51703f, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) { const l = add(succ, leafGeo(0.09 + (i % 3) * 0.02, 0.035, -0.2), succMat, [0, 0.125, 0]); l.rotation.set(0.4 + (i % 4) * 0.25, i * 2.4, 0); }
  phys.dynamic(succ, { mass: 1.2 });
  // tall glass apothecary jar with sand + shells
  const jar = kit.group(root, [SB.x0 + 1.56, top, zc - 0.03], 0, 'apothecary');
  const jarGlass = M.glass.clone(); jarGlass.opacity = 0.32; jarGlass.color.set(0xe8eef0);
  add(jar, latheY([[0, 0], [0.07, 0], [0.072, 0.01], [0.072, 0.31], [0.058, 0.34], [0.062, 0.355], [0.0, 0.36]], 32), jarGlass, [0, 0, 0]);
  add(jar, latheY([[0, 0], [0.064, 0], [0.068, 0.02], [0.03, 0.06], [0.012, 0.075], [0.024, 0.10], [0.012, 0.115], [0, 0.115]], 24), jarGlass, [0, 0.355, 0]);
  add(jar, kit.cyl(0.066, 0.066, 0.11, 24), std({ color: 0xd8ccb4, roughness: 1 }), [0, 0.065, 0]);
  phys.dynamic(jar, { mass: 1.0 });

  // ================================================================ corner plant by the slider (dracaena)
  const plant = kit.group(root, [8.75, 0, 17.75], 0, 'dracaena');
  add(plant, latheY([[0, 0], [0.23, 0], [0.245, 0.02], [0.25, 0.44], [0.243, 0.46], [0, 0.46]], 48), std({ color: 0x161616, roughness: 0.55 }), [0, 0, 0]);
  add(plant, kit.cyl(0.235, 0.235, 0.01, 32), std({ color: 0x3a2e24, roughness: 1 }), [0, 0.44, 0]);
  {
    const geos = []; const rr = kit.rng(5); const stemGeos = [];
    // full multi-cane dracaena, ~2 m: dense leaf heads from 1.0 m up
    const stems = [[0.02, 0.01, 2.05], [-0.07, 0.04, 1.80], [0.07, -0.05, 1.55], [-0.04, -0.08, 1.30], [0.08, 0.08, 1.10]];
    for (const [sx, sz, h] of stems) {
      const lean = [sx * 1.5 + (rr() - 0.5) * 0.08, sz * 1.5 + (rr() - 0.5) * 0.08];
      const tg = kit.tube([[sx, 0.45, sz], [sx + lean[0] * 0.5, 0.45 + (h - 0.45) * 0.5, sz + lean[1] * 0.5], [sx + lean[0], h, sz + lean[1]]], 0.016, 16); stemGeos.push(tg);
      for (let k = 0; k < 56; k++) {
        const t = 0.62 + 0.38 * (k / 56); const lx = sx + lean[0] * t, ly = 0.45 + (h - 0.45) * t, lz = sz + lean[1] * t;
        const g = leafGeo(0.30 + rr() * 0.20, 0.055, 0.5 + rr() * 0.7, 0.03);
        g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.25 + rr() * 0.9)).applyMatrix4(new THREE.Matrix4().makeRotationY(rr() * 6.28)).translate(lx, ly, lz);
        geos.push(g);
      }
    }
    add(plant, kit.mergeGeometries(geos), std({ color: 0x3d6a2a, roughness: 0.6, side: THREE.DoubleSide }));
    add(plant, kit.mergeGeometries(stemGeos), std({ color: 0x6a5a40, roughness: 0.9 }));
  }
  phys.boxAABB([8.50, 0, 17.50], [9.00, 0.46, 18.00]);

  // ================================================================ sun patch through the open slider (soft additive wash)
  {
    const sunTex = kit.canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.04, h); g.lineTo(w * 0.96, h); g.lineTo(w * 0.80, 0); g.lineTo(w * 0.0, 0); g.closePath(); g.fill();
    });
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffd9a8, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true });
    const sp = add(root, new THREE.PlaneGeometry(5.6, 2.0), sunMat, [11.6, 0.016, 17.10], [-Math.PI / 2, 0, 0]);
    sp.castShadow = false; sp.receiveShadow = false; sp.renderOrder = 1; sp.userData.keep = true; sp.userData.fakeSun = true; /* polish4: sky/index.js scales it with the real sun */
  }

  // light 2 of 2: soft daylight bounce off the sunlit terrace/floor through the open sliders, aimed up and in so
  // the white ceiling and the chair fronts read high-key (photo p06/p07)
  { const sky = new THREE.SpotLight(0xfff3e2, 45, 12, 0.85, 1.0, 1.8); sky.position.set(11.8, 0.05, 20.2); sky.castShadow = false; sky.userData.fakeSun = true;
    sky.target.position.set(11.6, 3.05, 15.2); root.add(sky, sky.target); }

  // ================================================================ ceiling: cans, speakers, linear supply slots
  kit.canLights(root, [[9.3, 14.6], [9.3, 17.2], [11.0, 14.5], [13.0, 14.5], [11.0, 17.3], [13.0, 17.3], [14.7, 15.9], [9.2, 15.9], [14.7, 14.5], [14.7, 17.3]], CEIL, 0.06);
  const spk = std({ color: 0xe8e6e1, roughness: 0.9 });
  for (const [x, z] of [[10.2, 15.9], [13.9, 15.9]]) { const s = add(root, new THREE.CircleGeometry(0.12, 32), spk, [x, CEIL - 0.003, z], [Math.PI / 2, 0, 0]); s.castShadow = false; }
  for (const [x0, x1, z] of [[10.4, 13.4, 17.70], [10.4, 13.4, 17.55]]) { const s = add(root, kit.box(x1 - x0, 0.004, 0.022), std({ color: 0x1b1b1b, roughness: 0.8 }), [(x0 + x1) / 2, CEIL - 0.002, z]); s.castShadow = false; }

  // slider: all four panels stack tight at the family-room (camera) end of the opening, reading as one
  // black-framed fixed pane (p06 right edge); the remaining ~5.2 m stays fully open to the pool deck.
  {
    const og = ctx.scene.getObjectByName('opening:din-slider');
    if (og) {
      const panels = og.children.filter(c => c.isGroup);
      const z0 = panels.length ? Math.min(...panels.map(p => p.position.z)) : 0;
      const ow = (ctx.plan.OPENINGS || []).find(o => o.id === 'din-slider')?.w || 7.0, pw = ow / Math.max(1, panels.length);
      // one fixed panel at the family-room (west) end; the other three pocket-stack at the kitchen (east) end,
      // leaving ~3.5 m clear in the middle (p06)
      panels.forEach((p, i) => { if (i === 0) { p.position.x = ow - pw - 0.03; p.position.z = z0; } else { p.position.x = 0.03 + (i - 1) * 0.012; p.position.z = z0 + i * 0.058; } });
      if (panels.length) { og.updateMatrixWorld(true); for (const set of [panels.slice(0, 1), panels.slice(1)]) { if (!set.length) continue; const bb = new THREE.Box3(); for (const p of set) bb.expandByObject(p); phys.boxAABB(bb.min.toArray(), bb.max.toArray()); } }
    }
  }

  // ================================================================ WET BAR niche
  const N = NICHE; const nw = N.x1 - N.x0;
  // grasscloth on both side walls (full height) and the left partition face
  kit.wallPanel(root, [N.x0, MOUTH], [N.x0, N.z0], 0, CEIL, [1, 0], grasscloth, 0.003);
  kit.wallPanel(root, [N.x1, N.z0], [N.x1, N.z1], 0, CEIL, [-1, 0], grasscloth, 0.003);
  // rift oak back panel: pale, satin, straight vertical grain
  const r6 = kit.rng(21);
  const riftMap = kit.canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#e6c9a0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = r6() * w, t = r6(); g.strokeStyle = t < 0.5 ? `rgba(170,128,84,${0.10 + r6() * 0.18})` : `rgba(236,206,166,${0.10 + r6() * 0.2})`;
      g.lineWidth = 0.6 + r6() * 2.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r6() - 0.5) * 6, h); g.stroke(); }
  }, { repeat: [1, 1] });
  const oakPbr = kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.8, 0.8] });
  const backOak = std({ map: riftMap, normalMap: oakPbr.normalMap, roughnessMap: oakPbr.roughnessMap, color: 0xfff4e4, roughness: 0.45, normalScale: new THREE.Vector2(0.4, 0.4) });
  kit.wallPanel(root, [N.x0, N.z0], [N.x1, N.z0], 0.0, CEIL, [0, 1], backOak, 0.006);
  // reeded (fluted) door slab geometry: tight ~10 mm reeds, front face at local +z, origin at bottom centre
  const reeded = (w, h, d = 0.02, pitch = 0.010) => {
    const n = Math.max(2, Math.round(w / pitch)), p = w / n, pts = [[w / 2, 0]];
    for (let i = n; i >= 0; i--) { const x = -w / 2 + i * p; pts.push([x, -d]); if (i > 0) { pts.push([x - p * 0.2, -d - 0.0025]); pts.push([x - p * 0.5, -d - 0.0035]); pts.push([x - p * 0.8, -d - 0.0025]); } }
    pts.push([-w / 2, 0]);
    const g = kit.extrude(pts, h, 0); g.rotateX(-Math.PI / 2); return g; // shape y=-d -> z=+d, extrusion -> +y
  };
  const doorOak = std({ map: riftMap, color: 0xffe2bc, roughness: 0.5 });
  const kickMat = std({ color: 0x1c1712, roughness: 0.85 });
  const knobGeo = (() => { const g = kit.lathe([[0, 0], [0.006, 0], [0.006, 0.008], [0.015, 0.014], [0.016, 0.02], [0.012, 0.026], [0, 0.027]], 20); g.rotateX(Math.PI / 2); return g; })(); // 3 cm round knob, +z
  // back run: wine fridge (left, oak panel door ajar) + 3 reeded doors + black stone top + black sink.
  // The back run spans the full niche width; the glass tower stands in front of it on the right.
  const cabH = 0.88, cabD = 0.60, cTop = cabH + 0.03, kick = 0.06;
  const rx0 = N.x1 - 0.32, rz0 = N.z0 + cabD + 0.02, rz1 = N.z1;
  const bar = kit.group(root, [0, 0, 0], 0, 'wetbar-back');
  kit.boxAt(bar, kickMat, N.x0 + 0.02, 0, N.z0 + 0.02, nw - 0.04, kick, cabD - 0.11);
  kit.boxAt(bar, oakVert, N.x0, kick, N.z0, nw, cabH - kick, cabD - 0.03);
  const fzF = N.z0 + cabD - 0.03, wfx1 = N.x0 + 0.43;
  // wine fridge: its own black-framed dark glass door set back, behind an oak panel door left ajar
  { const fw = wfx1 - N.x0 - 0.02, fh = cabH - kick - 0.03, fx = (N.x0 + wfx1) / 2, fy = kick + 0.01 + fh / 2;
    add(bar, kit.box(fw, fh, 0.01), M.matteBlack, [fx, fy, fzF - 0.01]);
    add(bar, kit.box(fw - 0.07, fh - 0.12, 0.004), std({ color: 0x1c1612, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.2 }), [fx, fy + 0.02, fzF - 0.004]);
    add(bar, kit.box(0.012, 0.30, 0.012), M.blackMetal, [N.x0 + 0.05, fy, fzF + 0.008]);
    // oak panel door: frame + small dark glass insert, hinged on the left jamb, open ~25°
    const dr = kit.group(bar, [N.x0 + 0.012, 0, fzF + 0.025], -0.42, 'wine-door');
    const dW = fw, st = 0.075;
    for (const [bw, bh, x, y] of [[dW, st, dW / 2, kick + 0.01 + st / 2], [dW, st, dW / 2, kick + 0.01 + fh - st / 2], [st, fh, st / 2, fy], [st, fh, dW - st / 2, fy]]) add(dr, kit.rbox(bw, bh, 0.022, 0.003), doorOak, [x, y, 0]);
    add(dr, kit.box(dW - 2 * st + 0.01, fh - 2 * st + 0.01, 0.01), doorOak, [dW / 2, fy, -0.006]);
    add(dr, kit.box(dW - 2 * st - 0.06, 0.34, 0.006), std({ color: 0x15110e, roughness: 0.08, metalness: 0.3 }), [dW / 2, fy - 0.08, 0.0]);
    add(dr, kit.cyl(0.006, 0.006, 0.30, 10), M.blackMetal, [dW - 0.04, fy, 0.035]);
    for (const hy of [fy - 0.13, fy + 0.13]) add(dr, kit.cyl(0.005, 0.005, 0.024, 8), M.blackMetal, [dW - 0.04, hy, 0.022], [Math.PI / 2, 0, 0]); }
  // three reeded doors over the sink base: single + double, black 3 cm knobs at the top inner corners
  { const x0 = wfx1 + 0.004, run = N.x1 - 0.004 - x0, dw = run / 3;
    add(bar, kit.box(run, cabH - kick - 0.012, 0.004), kickMat, [x0 + run / 2, kick + (cabH - kick) / 2, fzF - 0.001]); // reveal shadow in the gaps
    for (let i = 0; i < 3; i++) {
      const cx = x0 + dw * (i + 0.5); add(bar, reeded(dw - 0.004, cabH - kick - 0.012), doorOak, [cx, kick + 0.004, fzF]);
      const kx = i === 0 ? x0 + dw - 0.04 : i === 1 ? x0 + 2 * dw - 0.035 : x0 + 2 * dw + 0.035;
      add(bar, knobGeo, M.matteBlack, [kx, cabH - 0.075, fzF + 0.02]);
    } }
  add(bar, kit.rbox(nw, 0.03, cabD + 0.02, 0.004), blackStone, [N.x0 + nw / 2, cabH + 0.015, N.z0 + (cabD + 0.02) / 2]);
  // backsplash lip in stone
  add(bar, kit.box(nw, 0.10, 0.02), blackStone, [N.x0 + nw / 2, cTop + 0.05, N.z0 + 0.01]);
  const sinkX = N.x0 + 0.86, sinkZ = N.z0 + 0.33;
  add(bar, kit.box(0.40, 0.004, 0.32), std({ color: 0x050505, roughness: 0.35 }), [sinkX, cTop + 0.001, sinkZ]);
  add(bar, kit.cyl(0.02, 0.02, 0.004, 16), M.blackMetal, [sinkX, cTop + 0.004, sinkZ]);
  // black gooseneck faucet
  add(bar, kit.cyl(0.022, 0.025, 0.05, 16), M.blackMetal, [sinkX, cTop + 0.025, N.z0 + 0.07]);
  add(bar, kit.tube([[sinkX, cTop + 0.04, N.z0 + 0.07], [sinkX, cTop + 0.33, N.z0 + 0.07], [sinkX, cTop + 0.40, N.z0 + 0.13], [sinkX, cTop + 0.33, N.z0 + 0.22], [sinkX, cTop + 0.28, N.z0 + 0.22]], 0.011, 32), M.blackMetal);
  add(bar, kit.box(0.012, 0.012, 0.06), M.blackMetal, [sinkX + 0.05, cTop + 0.10, N.z0 + 0.09]);
  phys.solidGroup(bar);
  // three floating oak shelves, full niche width
  const shelfY = [1.55, 2.05, 2.55];
  for (const y of shelfY) {
    add(root, kit.rbox(nw - 0.004, 0.05, 0.30, 0.003), doorOak, [N.x0 + nw / 2, y, N.z0 + 0.15]);
    phys.boxAABB([N.x0, y - 0.025, N.z0], [N.x1, y + 0.025, N.z0 + 0.30]);
  }
  // right-hand built-in tower (in front of the back run): ribbed oak cabinet + stone ledge + open glass shelves
  const rb = kit.group(root, [0, 0, 0], 0, 'wetbar-right');
  kit.boxAt(rb, kickMat, rx0 + 0.06, 0, rz0, 0.26, kick, rz1 - rz0);
  kit.boxAt(rb, oakVert, rx0 + 0.02, kick, rz0, 0.30, cabH - kick, rz1 - rz0);
  { const dw = (rz1 - rz0 - 0.01) / 2;
    for (let i = 0; i < 2; i++) { add(rb, reeded(dw - 0.004, cabH - kick - 0.012), doorOak, [rx0 + 0.02, kick + 0.004, rz0 + 0.005 + dw * (i + 0.5)], [0, -Math.PI / 2, 0]);
      add(rb, knobGeo, M.matteBlack, [rx0 - 0.0, cabH - 0.075, rz0 + dw + (i ? 0.035 : -0.035)], [0, -Math.PI / 2, 0]); } }
  add(rb, kit.rbox(0.34, 0.03, rz1 - rz0 + 0.01, 0.004), blackStone, [rx0 + 0.16, cabH + 0.015, (rz0 + rz1) / 2]);
  // oak-lined open case for the glass shelves
  kit.boxAt(rb, oakVert, rx0, cTop, rz0 - 0.02, 0.32, CEIL - cTop, 0.02);
  kit.boxAt(rb, oakVert, rx0, cTop, rz1 - 0.02, 0.32, CEIL - cTop, 0.02);
  kit.boxAt(rb, oakVert, N.x1 - 0.015, cTop, rz0, 0.012, CEIL - cTop, rz1 - rz0);
  const rShelves = [1.24, 1.54, 1.84, 2.14, 2.44, 2.74];
  for (const y of rShelves) kit.boxAt(rb, oakVert, rx0, y, rz0, 0.32, 0.03, rz1 - rz0);
  // short return pier at the niche mouth (painted on the dining side), grasscloth on its niche face
  kit.boxAt(rb, M.paintWhite, rx0, 0, N.z1, N.x1 + 0.15 - rx0, CEIL, MOUTH - N.z1);
  kit.wallPanel(root, [rx0, N.z1], [rx0, MOUTH], 0, CEIL, [-1, 0], grasscloth, 0.003);
  // the pier's dining-side faces stay painted white (p07 shows plain white wall beside the sideboard)
  // grasscloth wraps the tower's back side (seen beside the back shelves)
  kit.wallPanel(root, [rx0 + 0.32, rz0 - 0.02], [rx0, rz0 - 0.02], cTop, CEIL, [0, -1], grasscloth, 0.003);
  phys.solidGroup(rb);
  // niche downlights + one warm spot washing the oak back panel
  kit.canLights(root, [[N.x0 + nw / 2, N.z0 + 0.35], [N.x0 + nw / 2, N.z1 - 0.15]], CEIL, 0.04);
  // light 1 of 2: one wide warm spot from the niche mouth ceiling washing the oak back panel + counter
  const spot = new THREE.SpotLight(0xffe2bc, 16, 4.5, 0.85, 0.85, 1.6); spot.position.set(N.x0 + nw / 2, CEIL - 0.04, N.z1 + 0.05); spot.castShadow = false;
  spot.target.position.set(N.x0 + nw / 2, 1.3, N.z0); root.add(spot, spot.target);
  // can scallop hotspot on the back panel above the top shelf (additive radial wash)
  { const wash = kit.canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h * 0.12, 0, w / 2, h * 0.3, w * 0.5);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const wm = new THREE.MeshBasicMaterial({ map: wash, color: 0xffc98c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const q = add(root, new THREE.PlaneGeometry(1.1, 1.0), wm, [N.x0 + nw / 2, CEIL - 0.48, N.z0 + 0.012]); q.castShadow = false; q.receiveShadow = false; q.userData.keep = true; q.renderOrder = 2; }

  // ---- bar-ware
  const glassWare = [];
  const pushLathe = (pts, x, y, z, seg = 20) => { const g = latheY(pts, seg); g.translate(x, y, z); glassWare.push(g); };
  const martini = [[0, 0], [0.038, 0], [0.04, 0.004], [0.006, 0.012], [0.004, 0.115], [0.058, 0.185], [0.056, 0.187], [0.003, 0.125]];
  const flute = [[0, 0], [0.033, 0], [0.034, 0.004], [0.005, 0.012], [0.004, 0.10], [0.026, 0.15], [0.03, 0.25], [0.028, 0.25], [0.004, 0.11]];
  const rcx = rx0 + 0.16;
  // rows of martini glasses on the counter and the upper shelves, tall flutes/highballs on the middle shelf
  const nRow = (sp) => Math.max(1, Math.floor((rz1 - rz0 - 0.08) / sp));
  const coupe = [[0, 0], [0.036, 0], [0.038, 0.004], [0.005, 0.012], [0.004, 0.10], [0.03, 0.115], [0.055, 0.135], [0.053, 0.137], [0.003, 0.108]];
  const highball = [[0, 0], [0.03, 0], [0.032, 0.15], [0.029, 0.15], [0.027, 0.008], [0, 0.008]];
  // two staggered rows per shelf, front row offset half a pitch
  const row = (prof, y, sp) => { for (let i = 0; i < nRow(sp); i++) for (const k of [0, 1]) pushLathe(prof, rcx + (k ? 0.06 : -0.06), y, rz0 + 0.06 + i * sp + (k ? sp / 2 : 0)); };
  row(martini, cTop, 0.13);
  row(highball, rShelves[0] + 0.03, 0.075); row(highball, rShelves[1] + 0.03, 0.075);
  row(flute, rShelves[2] + 0.03, 0.07);
  row(martini, rShelves[3] + 0.03, 0.12); row(coupe, rShelves[4] + 0.03, 0.12); row(martini, rShelves[5] + 0.03, 0.12);
  { const gm = new THREE.MeshPhysicalMaterial({ color: 0x15181b, transparent: true, opacity: 0.22, roughness: 0.03, ior: 1.5, specularIntensity: 0.8, envMapIntensity: 1.0, depthWrite: false, side: THREE.FrontSide }); const gw = add(root, kit.mergeGeometries(glassWare), gm); gw.castShadow = false; gw.renderOrder = 3; }

  // bottles on the lowest shelf (green Irish whiskey, amber bourbon, clear tequila)
  const sY = 1.55 + 0.025;
  const bottle = (x, z, r, h, mat, neck = 0.3) => add(root, latheY([[0, 0], [r, 0], [r, h * 0.62], [r * neck * 1.3, h * 0.78], [r * neck, h * 0.92], [r * neck * 1.1, h], [0, h]], 24), mat, [x, sY, z]);
  const greenGlass = std({ color: 0x1d4a22, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8, envMapIntensity: 1.6 });
  const amber = std({ color: 0x7a3c10, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9, envMapIntensity: 1.6 });
  const clear = M.glass;
  bottle(N.x0 + 0.13, N.z0 + 0.12, 0.038, 0.30, greenGlass);
  bottle(N.x0 + 0.23, N.z0 + 0.14, 0.035, 0.28, amber);
  bottle(N.x0 + 0.32, N.z0 + 0.12, 0.036, 0.32, amber, 0.35);
  { const lab = std({ color: 0xe8dcc0, roughness: 0.8 }), labDark = std({ color: 0x1a1612, roughness: 0.7 });
    add(root, kit.box(0.05, 0.07, 0.004), lab, [N.x0 + 0.13, sY + 0.11, N.z0 + 0.12 + 0.04]);
    add(root, kit.box(0.045, 0.06, 0.004), labDark, [N.x0 + 0.23, sY + 0.10, N.z0 + 0.14 + 0.037]);
    add(root, kit.box(0.05, 0.075, 0.004), lab, [N.x0 + 0.32, sY + 0.11, N.z0 + 0.12 + 0.038]); }
  { const dg = kit.group(root, [N.x0 + 0.66, sY, N.z0 + 0.13], 0, 'shelf-decanter'); // glass decanter, amber spirit, round stopper
    add(dg, latheY([[0, 0], [0.045, 0], [0.05, 0.03], [0.05, 0.12], [0.03, 0.17], [0.014, 0.20], [0.016, 0.215], [0, 0.215]], 24), M.glass);
    add(dg, latheY([[0, 0], [0.043, 0], [0.047, 0.03], [0.047, 0.09], [0, 0.09]], 20), std({ color: 0x8a4a14, roughness: 0.1, transparent: true, opacity: 0.85 }));
    add(dg, kit.sphere(0.022, 12, 8), M.glass, [0, 0.235, 0]); phys.dynamic(dg, { mass: 0.8 }); }
  // copper ice bucket
  const bucket = kit.group(root, [N.x0 + 0.92, sY, N.z0 + 0.15], 0, 'ice-bucket');
  const copper = std({ color: 0xe0915e, roughness: 0.22, metalness: 1, emissive: 0x2a1006, envMapIntensity: 1.4 });
  add(bucket, latheY([[0, 0], [0.09, 0], [0.095, 0.17], [0.098, 0.18], [0.09, 0.18], [0.0, 0.17]], 32), copper);
  for (const s of [-1, 1]) add(bucket, kit.torus(0.022, 0.004, 8, 16), copper, [s * 0.1, 0.13, 0], [0, Math.PI / 2, 0]);
  phys.dynamic(bucket, { mass: 1.2 });
  // two hand-painted ceramic decanters on the counter (white with dark scrollwork)
  const r5 = kit.rng(12);
  const decTex = kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1d2230'; g.lineWidth = 5;
    for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * (0.35 + i * 0.12) + 14 * Math.sin(x / 16 + i)); g.stroke(); }
    g.fillStyle = '#1d2230'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r5() * w, h * 0.2 + r5() * h * 0.6, 3 + r5() * 3, 0, 6.28); g.fill(); }
  });
  const decMat = std({ map: decTex, roughness: 0.1, envMapIntensity: 1.3 });
  for (const dx of [0.10, 0.24]) {
    const d = kit.group(root, [N.x0 + dx, cTop, N.z0 + 0.30], 0, 'decanter');
    add(d, latheY([[0, 0], [0.036, 0], [0.045, 0.06], [0.044, 0.20], [0.03, 0.25], [0.014, 0.27], [0.014, 0.29], [0, 0.29]], 24), decMat);
    add(d, latheY([[0, 0], [0.02, 0], [0.024, 0.02], [0.012, 0.05], [0, 0.06]], 16), std({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.6 }), [0, 0.29, 0]);
    phys.dynamic(d, { mass: 0.8 });
  }
  // crystal decanter
  const cd = kit.group(root, [N.x1 - 0.13, cTop, N.z0 + 0.20], 0, 'crystal-decanter');
  add(cd, latheY([[0, 0], [0.045, 0], [0.05, 0.1], [0.035, 0.16], [0.016, 0.19], [0.016, 0.22], [0, 0.22]], 10), M.glass);
  add(cd, kit.sphere(0.025, 10, 8), M.glass, [0, 0.245, 0]);
  phys.dynamic(cd, { mass: 0.9 });

  kit.mergeStatic(root);
}
