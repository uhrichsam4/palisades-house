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
  p06: { pos: [7.00, 1.25, 14.45], look: [12.60, 1.18, 17.25], fov: 60 },
  p07: { pos: [12.05, 1.35, 18.60], look: [12.85, 1.00, 13.60], fov: 60 },
  p12: { pos: [12.90, 1.00, 15.00], look: [12.86, 1.02, 12.35], fov: 54 },
};

// ---------------------------------------------------------------- layout constants
const PART_Z = 13.75;               // partition face (sideboard wall)
const PART_X0 = 10.20, PART_X1 = 12.10;
const NICHE = { x0: 12.10, x1: 13.50, z0: 12.35, z1: 13.60 };
const CEIL = 3.05;
const TABLE = { x: 13.35, z: 15.60, len: 2.75, wid: 0.98, h: 0.76, ry: 0.45 };
const SB = { x0: 10.30, x1: 12.05, z0: PART_Z, d: 0.48, h: 0.85 };

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M } = kit;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ================================================================ materials
  // dark smoked oak (sideboard, table): Poly Haven smoke_speckled_veneer, grain turned vertical
  const darkOak = (rep, tint) => std({ ...kit.pbrMaps('smoke_speckled_veneer', '1k', { repeat: rep, rotation: Math.PI / 2 }), color: tint, roughness: 0.62, normalScale: new THREE.Vector2(0.5, 0.5) });
  const sideboardMat = darkOak([1.6, 1.6], 0x6a6662); // rough-sawn charcoal oak: greyer + darker
  const tableMat = darkOak([1.5, 1.5], 0x5a4536); // dark walnut
  const pedestalMat = darkOak([2, 1], 0x433b36);
  const oakVert = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xffd9b0, roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) });
  const blackMatte = M.matteBlack;
  const boucleN = kit.tex('assets/ph/wool_boucle/wool_boucle_nor_gl_1k.jpg', { repeat: [5, 5] });
  const upholstery = std({ color: 0xc2b4a2, roughness: 0.97, normalMap: boucleN, normalScale: new THREE.Vector2(0.35, 0.35) }); // greige linen

  // grasscloth: chocolate-brown ground with irregular, slightly diagonal horizontal straw fibres
  const r1 = kit.rng(42);
  const grassMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const y = r1() * h, x = r1() * w, L = 60 + r1() * 480, t = r1(), sl = -0.06 - r1() * 0.08;
      const c = t < 0.5 ? [42 + r1() * 18, 30 + r1() * 12, 21 + r1() * 8] : t < 0.85 ? [80 + r1() * 27, 56 + r1() * 18, 36 + r1() * 12] : [150 + r1() * 40, 112 + r1() * 30, 66 + r1() * 20];
      g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${0.35 + r1() * 0.5})`; g.lineWidth = 0.6 + r1() * 1.8;
      for (const ox of [0, -w]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + L, y + L * sl); g.stroke(); }
    }
  }, { repeat: [1 / 0.9, 1 / 0.9] });
  const r2 = kit.rng(43);
  const grassNor = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = r2() * h, x = r2() * w, L = 40 + r2() * 300; const up = r2() < 0.5;
      g.strokeStyle = up ? 'rgba(128,175,235,0.7)' : 'rgba(128,85,235,0.7)'; g.lineWidth = 1;
      for (const ox of [0, -w]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + L, y - L * 0.09); g.stroke(); }
    }
  }, { srgb: false, repeat: [1 / 0.9, 1 / 0.9] });
  const grasscloth = std({ map: grassMap, normalMap: grassNor, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.8, color: 0xffffff });

  // black stone with white veins (Nero Marquina-like)
  const r3 = kit.rng(7);
  const stoneMap = kit.canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(40,40,44,${r3() * 0.25})`; g.beginPath(); g.arc(r3() * w, r3() * h, 10 + r3() * 60, 0, 6.28); g.fill(); }
    const vein = (bold) => {
      let x = r3() * w, y = r3() * h; const a = r3() * 6.28; let dx = Math.cos(a), dy = Math.sin(a) * 0.5;
      g.strokeStyle = bold ? 'rgba(235,235,232,0.85)' : 'rgba(200,200,200,0.35)'; g.lineWidth = bold ? 1.6 + r3() * 1.6 : 0.6;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 60; s++) { dx += (r3() - 0.5) * 0.5; dy += (r3() - 0.5) * 0.5; const n = Math.hypot(dx, dy); x += dx / n * 9; y += dy / n * 9; g.lineTo(x, y); }
      g.stroke();
    };
    for (let i = 0; i < 4; i++) vein(true); for (let i = 0; i < 22; i++) vein(false);
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

  // rug: pale grey-cream distressed vintage
  const r4 = kit.rng(99);
  const rugMap = kit.canvasTex(1024, 768, (g, w, h) => {
    g.fillStyle = '#aaa194'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = 140 + r4() * 55; g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.18 + r4() * 0.2})`; g.fillRect(r4() * w, r4() * h, 1 + r4() * 5, 1 + r4() * 2); }
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(150,140,135,${0.04 + r4() * 0.06})`; g.lineWidth = 2 + r4() * 6; g.beginPath(); const cx = 120 + r4() * (w - 240), cy = 120 + r4() * (h - 240); g.ellipse(cx, cy, 20 + r4() * 90, 10 + r4() * 50, r4() * 3, 0, 6.28); g.stroke(); }
  });
  const rugMat = std({ map: rugMap, roughness: 1.0, normalMap: kit.noiseNormal(256, 2.0, 64, 5), normalScale: new THREE.Vector2(0.4, 0.4) });

  // sepia sailboat print (recreated)
  // grainy black-and-white photograph of a gaff-rigged yacht (portrait), on a white mat
  const art = kit.canvasTex(560, 720, (g, w, h) => {
    const rr = kit.rng(3);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.72); sky.addColorStop(0, '#9a9a98'); sky.addColorStop(1, '#c9c9c6');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // distant hills (soft, layered)
    for (const [base, amp, col] of [[0.66, 40, 'rgba(120,120,118,0.75)'], [0.70, 26, 'rgba(92,92,90,0.85)']]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * base - amp * (0.6 + 0.4 * Math.sin(x / 61 + base * 9)) * Math.exp(-(((x - w * 0.25) / (w * 0.5)) ** 2)) - 6 * Math.sin(x / 13));
      g.lineTo(w, h); g.fill();
    }
    const sea = g.createLinearGradient(0, h * 0.72, 0, h); sea.addColorStop(0, '#6d6d6b'); sea.addColorStop(1, '#3c3c3b'); g.fillStyle = sea; g.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(215,215,212,${rr() * 0.3})`; g.fillRect(rr() * w, h * 0.73 + rr() * h * 0.27, 4 + rr() * 18, 1); }
    // hull (dark) with white bow wave
    g.fillStyle = '#1f1f1f'; g.beginPath(); g.moveTo(w * 0.22, h * 0.845); g.quadraticCurveTo(w * 0.5, h * 0.87, w * 0.84, h * 0.835); g.lineTo(w * 0.76, h * 0.872); g.lineTo(w * 0.30, h * 0.872); g.closePath(); g.fill();
    g.fillStyle = 'rgba(235,235,232,0.8)'; g.fillRect(w * 0.70, h * 0.865, w * 0.16, 3);
    // mast + gaff + boom
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.52, h * 0.84); g.lineTo(w * 0.52, h * 0.05); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.52, h * 0.30); g.lineTo(w * 0.24, h * 0.13); g.stroke();
    g.beginPath(); g.moveTo(w * 0.52, h * 0.80); g.lineTo(w * 0.18, h * 0.815); g.stroke();
    // gaff mainsail + topsail (towering, pale)
    g.fillStyle = '#ecebe7'; g.beginPath(); g.moveTo(w * 0.51, h * 0.31); g.lineTo(w * 0.25, h * 0.145); g.quadraticCurveTo(w * 0.17, h * 0.5, w * 0.19, h * 0.81); g.lineTo(w * 0.51, h * 0.795); g.closePath(); g.fill();
    g.fillStyle = '#f4f3ef'; g.beginPath(); g.moveTo(w * 0.51, h * 0.06); g.lineTo(w * 0.51, h * 0.29); g.lineTo(w * 0.27, h * 0.15); g.closePath(); g.fill();
    // jibs
    g.fillStyle = '#dedcd7'; g.beginPath(); g.moveTo(w * 0.535, h * 0.12); g.lineTo(w * 0.93, h * 0.80); g.lineTo(w * 0.56, h * 0.80); g.closePath(); g.fill();
    g.fillStyle = '#d2d0cb'; g.beginPath(); g.moveTo(w * 0.535, h * 0.36); g.lineTo(w * 0.76, h * 0.81); g.lineTo(w * 0.54, h * 0.81); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(90,90,88,0.45)'; g.lineWidth = 1; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(w * 0.51, h * (0.32 + i * 0.048)); g.lineTo(w * (0.25 - i * 0.006), h * (0.18 + i * 0.07)); g.stroke(); }
    // film grain + vignette
    const img = g.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const px = (i / 4) % w, py = (i / 4 / w) | 0; const vx = px / w - 0.5, vy = py / h - 0.5;
      const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * (1 - 0.45 * (vx * vx + vy * vy)) + (rr() - 0.5) * 34; d[i] = Math.min(255, v * 1.07 + 6); d[i + 1] = v * 0.97 + 2; d[i + 2] = v * 0.80; }
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
  // niche jamb return (left), from partition face back to the opening plane
  // baseboards (white, 10 cm) on the partition and the store wall
  for (const [x0, z0, w, d] of [[PART_X0, PART_Z, PART_X1 - PART_X0, 0.012], [PART_X0 - 0.012, 13.45, 0.012, PART_Z - 13.45],
    [13.50, 13.60, 0.53, 0.012], [14.87, 13.60, 15.39 - 14.87, 0.012]]) { const bb = kit.boxAt(root, M.paintWhite, x0, 0, z0, w, 0.10, d); bb.castShadow = false; }

  // ================================================================ rug
  // table set (rug, table, chairs) sits on a diagonal, long axis pointing toward the pool
  const dset = kit.group(root, [TABLE.x, 0, TABLE.z], TABLE.ry, 'dining-set');
  const rug = add(dset, kit.rbox(3.55, 0.012, 2.50, 0.005, 2), rugMat, [0.05, 0.006, 0]);
  rug.castShadow = false;

  // ================================================================ oval pedestal table
  const tbl = kit.group(dset, [0, 0, 0], 0, 'dining-table');
  // thin 4 cm racetrack top with a slim eased edge; a recessed apron keeps the edge reading thin
  add(tbl, stadium(TABLE.len - 0.008, TABLE.wid - 0.008, 0.032, 0.004), tableMat, [0, TABLE.h - 0.036, 0]);
  add(tbl, stadium(TABLE.len - 0.40, TABLE.wid - 0.30, 0.02, 0.002), tableMat, [0, TABLE.h - 0.058, 0]);
  add(tbl, fluted(0.27, TABLE.h - 0.09, 30, 0.014), pedestalMat, [0, (TABLE.h - 0.09) / 2 + 0.012, 0]);
  add(tbl, kit.cyl(0.255, 0.255, 0.02, 64), pedestalMat, [0, TABLE.h - 0.085, 0]);
  add(tbl, kit.cyl(0.272, 0.275, 0.014, 64), pedestalMat, [0, 0.007, 0]);
  phys.solidGroup(tbl);

  // ================================================================ curved barrel-back dining chairs
  const shellGeo = (() => {
    // fully upholstered barrel back: ~5 cm thick padded wall, well-rounded edges, ~0.6 m wide overall
    const Ro = 0.268, Ri = 0.240, A = THREE.MathUtils.degToRad(114), N = 40, pts = [];
    for (let i = 0; i <= N; i++) { const a = -A + (2 * A * i) / N; pts.push([Ro * Math.sin(a), Ro * Math.cos(a)]); }
    for (let i = N; i >= 0; i--) { const a = -A + (2 * A * i) / N; pts.push([Ri * Math.sin(a), Ri * Math.cos(a)]); }
    const H = 0.37; const g = kit.extrude(pts, H, 0.013); g.rotateX(-Math.PI / 2); // shape y -> -z: back at -z
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.abs(Math.atan2(x, -z)) / A;
      const s = THREE.MathUtils.smoothstep(a, 0.20, 1.0); const f = 1 - 0.50 * s;
      p.setY(i, y <= 0.001 ? y : y * f);
      // shell tapers inward toward the top (tub silhouette); arms flare slightly at the front
      const tq = 1 - 0.07 * Math.max(0, p.getY(i)) / H;
      p.setX(i, x * tq * (a > 0.6 ? 1 + 0.05 * (a - 0.6) : 1)); p.setZ(i, z * tq);
    }
    g.deleteAttribute('normal'); const uv = g.attributes.uv; g.deleteAttribute('uv');
    const m = kit.mergeVertices(g, 1e-4); m.computeVertexNormals();
    // box-project uvs (metres) for the boucle normal map
    const mp = m.attributes.position, muv = new Float32Array(mp.count * 2);
    for (let i = 0; i < mp.count; i++) { muv[i * 2] = mp.getX(i) + mp.getZ(i); muv[i * 2 + 1] = mp.getY(i); }
    m.setAttribute('uv', new THREE.BufferAttribute(muv, 2)); return m;
  })();
  const tub = (w, h, d, r, puff) => { const g = kit.cushion(w, h, d, r, puff); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setX(i, x * (z > 0 ? 1 - 0.10 * (z / (d / 2)) ** 2 : 1 - 0.40 * (z / (d / 2)) ** 2)); }
    g.computeVertexNormals(); return g; };
  const seatBase = tub(0.50, 0.07, 0.48, 0.03, 0.0);   // upholstered tub apron the shell sits on
  const seatGeo = tub(0.46, 0.07, 0.46, 0.03, 0.02);  // thick puffy seat cushion
  const legGeo = kit.cyl(0.010, 0.016, 0.44, 12);       // thin tapered light-wood legs
  const legWrap = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.1, 1] }), color: 0xe8d4b8, roughness: 0.6 });
  function chair(x, z, ry) {
    const c = kit.group(dset, [x, 0, z], ry, 'chair');
    for (const [lx, lz] of [[-0.17, -0.16], [0.17, -0.16], [-0.18, 0.17], [0.18, 0.17]]) {
      const leg = add(c, legGeo, legWrap, [lx, 0.22, lz]); leg.rotation.set(lz > 0 ? 0.12 : -0.16, 0, lx > 0 ? 0.10 : -0.10);
    }
    add(c, seatBase, upholstery, [0, 0.43, 0.01]);
    add(c, seatGeo, upholstery, [0, 0.48, 0.03]);
    add(c, shellGeo, upholstery, [0, 0.40, 0.0]);
    phys.solidGroup(c);
    return c;
  }
  // 4 per long side at 0.65 m centres, none at the ends; seat faces the table (+z local)
  for (const dx of [-0.975, -0.325, 0.325, 0.975]) {
    chair(dx, -TABLE.wid / 2 - 0.26, 0);
    chair(dx, TABLE.wid / 2 + 0.26, Math.PI);
  }

  // ================================================================ linear brass chandelier
  // slim: one stem, a 1.3 m brass spine with flat white bar shades at staggered angles, bottom ~2.2 m
  const ch = kit.group(root, [TABLE.x, 0, TABLE.z], TABLE.ry, 'chandelier');
  const glow = std({ color: 0xf7f4ee, emissive: 0xfff2dc, emissiveIntensity: 0.55, roughness: 0.55 });
  add(ch, kit.cyl(0.06, 0.06, 0.025, 32), M.brass, [0, CEIL - 0.013, 0]);
  // wide linear fixture: ~1.8 m horizontal brass spine, two tiers of horizontal arms carrying 4 white bars,
  // lowest bars ~0.9 m above the tabletop
  add(ch, kit.cyl(0.009, 0.009, CEIL - 2.12, 10), M.brass, [0, (CEIL + 2.12) / 2, 0]);
  const tiers = [{ y: 2.12, len: 1.80, a: 0.0 }, { y: 1.95, len: 1.10, a: 0.35 }];
  for (const t of tiers) {
    const arm = kit.group(ch, [0, t.y, 0], t.a);
    add(arm, kit.cyl(0.009, 0.009, t.len, 10), M.brass, [0, 0, 0], [0, 0, Math.PI / 2]);
    add(arm, kit.cyl(0.018, 0.018, 0.04, 14), M.brass, [0, 0, 0]);
    for (const s of [-1, 1]) {
      const ex = s * (t.len / 2 - 0.03);
      add(arm, kit.cyl(0.006, 0.006, 0.05, 8), M.brass, [ex, -0.025, 0]);
      const bar = kit.group(arm, [ex, -0.06, 0], 0);
      add(bar, kit.rbox(0.50, 0.026, 0.06, 0.008), glow, [0, 0, 0]);
      add(bar, kit.box(0.51, 0.008, 0.064), M.brass, [0, 0.016, 0]);
    }
  }
  if (tiers.length) { const y0 = tiers[1].y; add(ch, kit.cyl(0.0055, 0.0055, tiers[0].y - y0, 8), M.brass, [0, (tiers[0].y + y0) / 2, 0]); }

  // ================================================================ black sideboard
  const sb = kit.group(root, [(SB.x0 + SB.x1) / 2, 0, SB.z0 + SB.d / 2], 0, 'sideboard');
  const sbw = SB.x1 - SB.x0;
  add(sb, kit.box(sbw - 0.12, 0.06, SB.d - 0.10), blackMatte, [0, 0.03, -0.02]);
  add(sb, kit.rbox(sbw, SB.h - 0.09, SB.d, 0.045, 4), sideboardMat, [0, 0.06 + (SB.h - 0.09) / 2, 0]);
  add(sb, kit.rbox(sbw + 0.012, 0.035, SB.d + 0.008, 0.015, 3), sideboardMat, [0, SB.h - 0.0175, 0]);
  const grooveMat = std({ color: 0x0a0908, roughness: 0.9 });
  for (const gx of [-sbw / 4, 0, sbw / 4]) add(sb, kit.box(0.004, SB.h - 0.15, 0.004), grooveMat, [gx, 0.06 + (SB.h - 0.09) / 2, SB.d / 2 + 0.001]);
  for (const px of [-sbw / 4 - 0.035, -sbw / 4 + 0.035, sbw / 4 - 0.035, sbw / 4 + 0.035]) add(sb, kit.rbox(0.016, 0.26, 0.012, 0.007), grooveMat, [px, 0.50, SB.d / 2 + 0.004]);
  phys.solidGroup(sb);

  // art above
  const artG = kit.group(root, [10.90, 1.66, PART_Z + 0.02], 0, 'sailboat-print');
  const AW = 1.05, AH = 1.35;
  add(artG, kit.box(AW, AH, 0.035), M.blackMetal, [0, 0, 0.0175]);
  add(artG, new THREE.PlaneGeometry(AW - 0.04, AH - 0.04), std({ color: 0xf3f1ec, roughness: 0.9 }), [0, 0, 0.0355]);
  add(artG, new THREE.PlaneGeometry(AW - 0.20, AH - 0.24), std({ map: art, roughness: 0.5 }), [0, 0.01, 0.036]);
  // smart thermostat / home-control panel right of the print (p07)
  add(root, kit.rbox(0.13, 0.10, 0.012, 0.005), std({ color: 0x111111, roughness: 0.2 }), [11.80, 1.42, PART_Z + 0.006]);
  add(root, new THREE.PlaneGeometry(0.10, 0.07), std({ color: 0x1c2228, emissive: 0x2a3440, emissiveIntensity: 0.4, roughness: 0.1 }), [11.80, 1.42, PART_Z + 0.0125]);

  // ---- sideboard decor (dynamic: players can knock them over)
  const top = SB.h + 0.002, zc = SB.z0 + SB.d / 2;
  // white orchid in a faceted gold pot
  const orch = kit.group(root, [SB.x0 + 0.30, top, zc - 0.02], 0.3, 'orchid');
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
  const succ = kit.group(root, [SB.x0 + 1.18, top, zc], 0, 'succulent');
  add(succ, latheY([[0, 0], [0.05, 0], [0.085, 0.04], [0.095, 0.09], [0.088, 0.13], [0.0, 0.13]], 32), std({ color: 0x151515, roughness: 0.45 }), [0, 0, 0]);
  const succMat = std({ color: 0x51703f, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) { const l = add(succ, leafGeo(0.09 + (i % 3) * 0.02, 0.035, -0.2), succMat, [0, 0.125, 0]); l.rotation.set(0.4 + (i % 4) * 0.25, i * 2.4, 0); }
  phys.dynamic(succ, { mass: 1.2 });
  // tall glass apothecary jar with sand + shells
  const jar = kit.group(root, [SB.x0 + 1.55, top, zc - 0.03], 0, 'apothecary');
  const jarGlass = M.glass.clone(); jarGlass.opacity = 0.32; jarGlass.color.set(0xe8eef0);
  add(jar, latheY([[0, 0], [0.07, 0], [0.072, 0.01], [0.072, 0.31], [0.058, 0.34], [0.062, 0.355], [0.0, 0.36]], 32), jarGlass, [0, 0, 0]);
  add(jar, latheY([[0, 0], [0.064, 0], [0.068, 0.02], [0.03, 0.06], [0.012, 0.075], [0.024, 0.10], [0.012, 0.115], [0, 0.115]], 24), jarGlass, [0, 0.355, 0]);
  add(jar, kit.cyl(0.066, 0.066, 0.11, 24), std({ color: 0xd8ccb4, roughness: 1 }), [0, 0.065, 0]);
  phys.dynamic(jar, { mass: 1.0 });

  // ================================================================ corner plant by the slider (dracaena)
  const plant = kit.group(root, [8.75, 0, 17.80], 0, 'dracaena');
  add(plant, latheY([[0, 0], [0.15, 0], [0.17, 0.03], [0.18, 0.44], [0.175, 0.46], [0, 0.46]], 40), std({ color: 0x1a1a1a, roughness: 0.5 }), [0, 0, 0]);
  add(plant, kit.cyl(0.165, 0.165, 0.01, 24), std({ color: 0x3a2e24, roughness: 1 }), [0, 0.44, 0]);
  {
    const geos = []; const rr = kit.rng(5); const stemGeos = [];
    // full multi-cane dracaena, ~2 m: dense leaf heads from 1.0 m up
    const stems = [[0.02, 0.01, 2.00], [-0.04, 0.03, 1.70], [0.04, -0.04, 1.40]];
    for (const [sx, sz, h] of stems) {
      const lean = [sx * 1.5 + (rr() - 0.5) * 0.08, sz * 1.5 + (rr() - 0.5) * 0.08];
      const tg = kit.tube([[sx, 0.45, sz], [sx + lean[0] * 0.5, 0.45 + (h - 0.45) * 0.5, sz + lean[1] * 0.5], [sx + lean[0], h, sz + lean[1]]], 0.016, 16); stemGeos.push(tg);
      for (let k = 0; k < 44; k++) {
        const t = 0.50 + 0.50 * (k / 44); const lx = sx + lean[0] * t, ly = 0.45 + (h - 0.45) * t, lz = sz + lean[1] * t;
        const g = leafGeo(0.26 + rr() * 0.16, 0.045, 0.5 + rr() * 0.6, 0.03);
        g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.25 + rr() * 0.9)).applyMatrix4(new THREE.Matrix4().makeRotationY(rr() * 6.28)).translate(lx, ly, lz);
        geos.push(g);
      }
    }
    add(plant, kit.mergeGeometries(geos), std({ color: 0x3d6a2a, roughness: 0.6, side: THREE.DoubleSide }));
    add(plant, kit.mergeGeometries(stemGeos), std({ color: 0x6a5a40, roughness: 0.9 }));
  }
  phys.boxAABB([8.57, 0, 17.62], [8.93, 0.46, 17.98]);

  // ================================================================ sun patch through the open slider (soft additive wash)
  {
    const sunTex = kit.canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.04, h); g.lineTo(w * 0.96, h); g.lineTo(w * 0.80, 0); g.lineTo(w * 0.0, 0); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.75)'; // mullion shadow
      g.beginPath(); g.moveTo(w * 0.62, h); g.lineTo(w * 0.635, h); g.lineTo(w * 0.53, 0); g.lineTo(w * 0.515, 0); g.closePath(); g.fill();
    });
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffd9a8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true });
    const sp = add(root, new THREE.PlaneGeometry(5.6, 2.6), sunMat, [11.6, 0.016, 16.80], [-Math.PI / 2, 0, 0]);
    sp.castShadow = false; sp.receiveShadow = false; sp.renderOrder = 1; sp.userData.keep = true;
  }

  // ================================================================ ceiling: cans, speakers, linear supply slots
  kit.canLights(root, [[9.3, 14.6], [9.3, 17.2], [11.0, 14.5], [13.0, 14.5], [11.0, 17.3], [13.0, 17.3], [14.7, 15.9], [9.2, 15.9]], CEIL, 0.045);
  const spk = std({ color: 0xe8e6e1, roughness: 0.9 });
  for (const [x, z] of [[10.2, 15.9], [13.9, 15.9]]) { const s = add(root, new THREE.CircleGeometry(0.12, 32), spk, [x, CEIL - 0.003, z], [Math.PI / 2, 0, 0]); s.castShadow = false; }
  for (const [x0, x1, z] of [[10.4, 13.4, 17.70]]) { const s = add(root, kit.box(x1 - x0, 0.004, 0.022), std({ color: 0x1b1b1b, roughness: 0.8 }), [(x0 + x1) / 2, CEIL - 0.002, z]); s.castShadow = false; }

  // slider panels parked at the kitchen-side jamb (photo p06). The shell stacks open sliders at the
  // far end of the wall run (the family-room side here), so re-park the shell's panels in place.
  {
    const og = ctx.scene.getObjectByName('opening:din-slider');
    if (og) {
      const panels = og.children.filter(c => c.isGroup);
      const z0 = panels.length ? Math.min(...panels.map(p => p.position.z)) : 0;
      const ow = (ctx.plan.OPENINGS || []).find(o => o.id === 'din-slider')?.w || 7.0, pw = ow / Math.max(1, panels.length);
      panels.forEach((p, i) => {
        if (i === panels.length - 1 && panels.length > 2) { p.position.x = ow - pw; p.position.z = z0 + 0.065; }
        else { p.position.x = 0.01 + i * 0.035; p.position.z = z0 + i * 0.065; }
      });
      if (panels.length > 2) { og.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(panels[panels.length - 1]); phys.boxAABB(b.min.toArray(), b.max.toArray()); }
    }
  }

  // ================================================================ WET BAR niche
  const N = NICHE; const nw = N.x1 - N.x0;
  // grasscloth on both side walls (full height) and the left partition face
  kit.wallPanel(root, [N.x0, PART_Z], [N.x0, N.z0], 0, CEIL, [1, 0], grasscloth, 0.003);
  kit.wallPanel(root, [N.x1, N.z0], [N.x1, N.z1], 0, CEIL, [-1, 0], grasscloth, 0.003);
  // rift oak back panel: pale, satin, straight vertical grain
  const r6 = kit.rng(21);
  const riftMap = kit.canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#e6c9a0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = r6() * w, t = r6(); g.strokeStyle = t < 0.5 ? `rgba(170,128,84,${0.10 + r6() * 0.18})` : `rgba(236,206,166,${0.10 + r6() * 0.2})`;
      g.lineWidth = 0.6 + r6() * 2.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r6() - 0.5) * 6, h); g.stroke(); }
  }, { repeat: [1, 1] });
  const backOak = std({ map: riftMap, color: 0xfff0dc, roughness: 0.42 });
  kit.wallPanel(root, [N.x0, N.z0], [N.x1, N.z0], 0.0, CEIL, [0, 1], backOak, 0.006);
  // reeded (fluted) door slab geometry: ribs at 12 mm pitch, front face at local +z, origin at bottom centre
  const reeded = (w, h, d = 0.02, pitch = 0.015) => {
    const n = Math.max(2, Math.round(w / pitch)), p = w / n, pts = [[w / 2, 0]];
    for (let i = n; i >= 0; i--) { const x = -w / 2 + i * p; pts.push([x, -d]); if (i > 0) { pts.push([x - p * 0.2, -d - 0.0035]); pts.push([x - p * 0.5, -d - 0.005]); pts.push([x - p * 0.8, -d - 0.0035]); } }
    pts.push([-w / 2, 0]);
    const g = kit.extrude(pts, h, 0); g.rotateX(-Math.PI / 2); return g; // shape y=-d -> z=+d, extrusion -> +y
  };
  const doorOak = std({ map: riftMap, color: 0xffe2bc, roughness: 0.5 });
  // back run: wine fridge (left, oak panel door ajar) + 3 reeded doors + black stone top + black sink
  const cabH = 0.88, cabD = 0.60, cTop = cabH + 0.04;
  const rx0 = N.x1 - 0.32, rz0 = N.z0 + cabD + 0.02, rz1 = N.z1;
  const bar = kit.group(root, [0, 0, 0], 0, 'wetbar-back');
  kit.boxAt(bar, blackMatte, N.x0 + 0.02, 0, N.z0 + 0.02, nw - 0.04, 0.10, cabD - 0.08);
  kit.boxAt(bar, oakVert, N.x0, 0.10, N.z0, nw, cabH - 0.10, cabD - 0.03);
  const fzF = N.z0 + cabD - 0.03, wfx1 = N.x0 + 0.43;
  // wine fridge: black-framed glass door set flush in the run
  { const fw = wfx1 - N.x0 - 0.02, fh = cabH - 0.13, fx = (N.x0 + wfx1) / 2, fy = 0.11 + fh / 2;
    add(bar, kit.box(fw, fh, 0.012), std({ color: 0x3a3029, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2 }), [fx, fy, fzF + 0.006]);
    for (const [bw, bh, x, y] of [[fw, 0.10, fx, 0.11 + 0.05], [fw, 0.10, fx, 0.11 + fh - 0.05], [0.09, fh, N.x0 + 0.055, fy], [0.09, fh, wfx1 - 0.055, fy]]) add(bar, kit.rbox(bw, bh, 0.024, 0.004), doorOak, [x, y, fzF + 0.012]);
    for (let k = 0; k < 4; k++) add(bar, kit.box(fw - 0.06, 0.006, 0.01), std({ color: 0x3a2a1c, roughness: 0.6 }), [fx, 0.22 + k * 0.17, fzF - 0.02]);
    // vertical black bar handle on the oak frame (door closed)
    add(bar, kit.cyl(0.006, 0.006, 0.36, 10), M.blackMetal, [wfx1 - 0.05, 0.50, fzF + 0.05]);
    for (const hy of [0.34, 0.66]) add(bar, kit.cyl(0.005, 0.005, 0.03, 8), M.blackMetal, [wfx1 - 0.05, hy, fzF + 0.035], [Math.PI / 2, 0, 0]); }
  // three reeded doors over the sink base: narrow single + double
  { const x0 = wfx1 + 0.004, run = N.x1 - 0.004 - x0, dw = run / 3;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + dw * (i + 0.5); add(bar, reeded(dw - 0.006, cabH - 0.115), doorOak, [cx, 0.105, fzF]);
      const kx = i === 0 ? x0 + dw - 0.045 : i === 1 ? x0 + 2 * dw - 0.035 : x0 + 2 * dw + 0.035;
      add(bar, kit.sphere(0.014, 12, 8), M.blackMetal, [kx, cabH - 0.12, fzF + 0.03]);
    } }
  add(bar, kit.box(nw, 0.04, cabD + 0.02), blackStone, [N.x0 + nw / 2, cabH + 0.02, N.z0 + (cabD + 0.02) / 2]);
  // backsplash lip in stone
  add(bar, kit.box(nw, 0.10, 0.02), blackStone, [N.x0 + nw / 2, cTop + 0.05, N.z0 + 0.01]);
  const sinkX = (wfx1 + rx0) / 2 + 0.02, sinkZ = N.z0 + 0.33;
  add(bar, kit.box(0.40, 0.004, 0.32), std({ color: 0x050505, roughness: 0.35 }), [sinkX, cTop + 0.001, sinkZ]);
  add(bar, kit.cyl(0.02, 0.02, 0.004, 16), M.blackMetal, [sinkX, cTop + 0.004, sinkZ]);
  // black gooseneck faucet
  add(bar, kit.cyl(0.022, 0.025, 0.05, 16), M.blackMetal, [sinkX, cTop + 0.025, N.z0 + 0.07]);
  add(bar, kit.tube([[sinkX, cTop + 0.04, N.z0 + 0.07], [sinkX, cTop + 0.33, N.z0 + 0.07], [sinkX, cTop + 0.40, N.z0 + 0.13], [sinkX, cTop + 0.33, N.z0 + 0.22], [sinkX, cTop + 0.28, N.z0 + 0.22]], 0.011, 32), M.blackMetal);
  add(bar, kit.box(0.012, 0.012, 0.06), M.blackMetal, [sinkX + 0.05, cTop + 0.10, N.z0 + 0.09]);
  phys.solidGroup(bar);
  // floating oak shelves
  for (const y of [1.55, 1.98, 2.40]) {
    add(root, kit.rbox(rx0 - N.x0 - 0.004, 0.04, 0.28, 0.003), doorOak, [(N.x0 + rx0) / 2, y, N.z0 + 0.14]);
    phys.boxAABB([N.x0, y - 0.025, N.z0], [rx0, y + 0.025, N.z0 + 0.28]);
  }
  // right-hand built-in: oak cabinet + stone ledge + open glass shelves
  const rb = kit.group(root, [0, 0, 0], 0, 'wetbar-right');
  kit.boxAt(rb, blackMatte, rx0 + 0.04, 0, rz0, 0.30, 0.10, rz1 - rz0);
  kit.boxAt(rb, oakVert, rx0, 0.10, rz0, 0.32, cabH - 0.10, rz1 - rz0);
  { const dw = (rz1 - rz0 - 0.01) / 2;
    for (let i = 0; i < 2; i++) { add(rb, reeded(dw - 0.006, cabH - 0.115), doorOak, [rx0 - 0.0, 0.105, rz0 + 0.005 + dw * (i + 0.5)], [0, -Math.PI / 2, 0]);
      add(rb, kit.sphere(0.014, 12, 8), M.blackMetal, [rx0 - 0.03, cabH - 0.12, rz0 + dw + (i ? 0.035 : -0.035)]); } }
  add(rb, kit.box(0.34, 0.04, rz1 - rz0 + 0.01), blackStone, [rx0 + 0.16, cabH + 0.02, (rz0 + rz1) / 2]);
  // oak-lined open case for the glass shelves, recessed flush into the right grasscloth wall
  kit.boxAt(rb, oakVert, rx0, cTop, rz0 - 0.02, 0.32, CEIL - cTop, 0.02);
  kit.boxAt(rb, oakVert, rx0, cTop, rz1 - 0.02, 0.32, CEIL - cTop, 0.02);
  kit.boxAt(rb, oakVert, N.x1 - 0.015, cTop, rz0, 0.012, CEIL - cTop, rz1 - rz0);
  const rShelves = [1.24, 1.53, 1.82, 2.11, 2.40, 2.69];
  for (const y of rShelves) kit.boxAt(rb, oakVert, rx0, y, rz0, 0.32, 0.025, rz1 - rz0);
  // the right wall plane is flush with the case front: grasscloth furring above the back counter and a
  // short return pier at the niche mouth (painted on the dining side)
  kit.boxAt(rb, M.paintWhite, rx0, cTop + 0.10, N.z0, N.x1 - rx0, CEIL - cTop - 0.10, rz0 - 0.02 - N.z0);
  kit.wallPanel(root, [rx0, N.z0], [rx0, rz0 - 0.02], cTop + 0.10, CEIL, [-1, 0], grasscloth, 0.003);
  kit.boxAt(rb, M.paintWhite, rx0, 0, N.z1, N.x1 + 0.15 - rx0, CEIL, PART_Z - N.z1);
  kit.wallPanel(root, [rx0, N.z1], [rx0, PART_Z], 0, CEIL, [-1, 0], grasscloth, 0.003);
  // grasscloth carries on past the niche mouth (p12 right edge): pier front + its return + a strip of the store wall
  kit.wallPanel(root, [rx0, PART_Z], [N.x1 + 0.15, PART_Z], 0, CEIL, [0, 1], grasscloth, 0.003);
  kit.wallPanel(root, [N.x1 + 0.15, PART_Z], [N.x1 + 0.15, 13.60], 0, CEIL, [1, 0], grasscloth, 0.003);
  kit.wallPanel(root, [N.x1 + 0.15, 13.60], [14.05, 13.60], 0, CEIL, [0, 1], grasscloth, 0.003);
  phys.solidGroup(rb);
  // niche downlights + one warm spot washing the oak back panel
  kit.canLights(root, [[N.x0 + nw / 2, N.z0 + 0.35], [N.x0 + nw / 2, N.z1 - 0.15]], CEIL, 0.04);
  const spot = new THREE.SpotLight(0xffe3c0, 6, 3.4, 0.55, 0.7, 2); spot.position.set(N.x0 + nw / 2, CEIL - 0.03, N.z0 + 0.25); spot.castShadow = false;
  spot.target.position.set(N.x0 + nw / 2, 1.0, N.z0 + 0.02); root.add(spot, spot.target);

  // ---- bar-ware
  const glassWare = [];
  const pushLathe = (pts, x, y, z, seg = 20) => { const g = latheY(pts, seg); g.translate(x, y, z); glassWare.push(g); };
  const martini = [[0, 0], [0.038, 0], [0.04, 0.004], [0.006, 0.012], [0.004, 0.115], [0.058, 0.185], [0.056, 0.187], [0.003, 0.125]];
  const flute = [[0, 0], [0.033, 0], [0.034, 0.004], [0.005, 0.012], [0.004, 0.10], [0.026, 0.15], [0.03, 0.25], [0.028, 0.25], [0.004, 0.11]];
  const rcx = rx0 + 0.16;
  // rows of martini glasses on the counter and the upper shelves, tall flutes/highballs on the middle shelf
  const nRow = (sp) => Math.max(1, Math.floor((rz1 - rz0 - 0.08) / sp));
  for (let i = 0; i < nRow(0.11); i++) pushLathe(martini, rcx + (i % 2 ? 0.055 : -0.055), cTop, rz0 + 0.08 + i * 0.11);
  for (const sh of [3, 4, 5]) for (let i = 0; i < nRow(0.12); i++) pushLathe(martini, rcx + (i % 2 ? 0.05 : -0.05), rShelves[sh] + 0.025, rz0 + 0.08 + i * 0.12);
  for (let i = 0; i < nRow(0.065); i++) pushLathe(flute, rcx + (i % 2 ? 0.05 : -0.05), rShelves[2] + 0.025, rz0 + 0.07 + i * 0.065);
  for (let i = 0; i < nRow(0.07); i++) pushLathe([[0, 0], [0.028, 0], [0.03, 0.24], [0.027, 0.24], [0.025, 0.008], [0, 0.008]], rcx + (i % 2 ? 0.05 : -0.05), rShelves[1] + 0.025, rz0 + 0.07 + i * 0.07);
  { const gm = M.glass.clone(); gm.opacity = 0.18; gm.roughness = 0.0; gm.color.set(0xf4f8fa); const gw = add(root, kit.mergeGeometries(glassWare), gm); gw.castShadow = false; gw.renderOrder = 3; }

  // bottles on the lowest shelf (green Irish whiskey, amber bourbon, clear tequila)
  const sY = 1.55 + 0.025;
  const bottle = (x, z, r, h, mat, neck = 0.3) => add(root, latheY([[0, 0], [r, 0], [r, h * 0.62], [r * neck * 1.3, h * 0.78], [r * neck, h * 0.92], [r * neck * 1.1, h], [0, h]], 24), mat, [x, sY, z]);
  const greenGlass = std({ color: 0x2a6a30, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8, envMapIntensity: 1.6 });
  const amber = std({ color: 0xb0621a, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, envMapIntensity: 1.6 });
  const clear = M.glass;
  bottle(N.x0 + 0.13, N.z0 + 0.12, 0.038, 0.30, greenGlass);
  bottle(N.x0 + 0.23, N.z0 + 0.14, 0.035, 0.28, amber);
  bottle(N.x0 + 0.32, N.z0 + 0.12, 0.036, 0.32, amber, 0.35);
  { const lab = std({ color: 0xe8dcc0, roughness: 0.8 }), labDark = std({ color: 0x1a1612, roughness: 0.7 });
    add(root, kit.box(0.05, 0.07, 0.004), lab, [N.x0 + 0.13, sY + 0.11, N.z0 + 0.12 + 0.04]);
    add(root, kit.box(0.045, 0.06, 0.004), labDark, [N.x0 + 0.23, sY + 0.10, N.z0 + 0.14 + 0.037]);
    add(root, kit.box(0.05, 0.075, 0.004), lab, [N.x0 + 0.32, sY + 0.11, N.z0 + 0.12 + 0.038]);
    add(root, kit.box(0.055, 0.05, 0.004), labDark, [N.x0 + 0.66, sY + 0.08, N.z0 + 0.13 + 0.044]); }
  bottle(N.x0 + 0.66, N.z0 + 0.13, 0.042, 0.24, amber, 0.4);
  // copper ice bucket
  const bucket = kit.group(root, [N.x0 + 0.90, sY, N.z0 + 0.14], 0, 'ice-bucket');
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
  const cd = kit.group(root, [rx0 - 0.07, cTop, N.z0 + 0.16], 0, 'crystal-decanter');
  add(cd, latheY([[0, 0], [0.045, 0], [0.05, 0.1], [0.035, 0.16], [0.016, 0.19], [0.016, 0.22], [0, 0.22]], 10), M.glass);
  add(cd, kit.sphere(0.025, 10, 8), M.glass, [0, 0.245, 0]);
  phys.dynamic(cd, { mass: 0.9 });

  kit.mergeStatic(root);
}
