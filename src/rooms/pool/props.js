// Pool piece: materials + outdoor furniture / fence / planters (p38, p39, p40).
// Every builder works in a local group: +z is the "front" of a seat (where you sit facing).
import * as THREE from 'three';

export function makeMaterials(kit) {
  const { canvasTex, rng, noiseNormal, outdoor } = kit;
  const std = (o) => outdoor(new THREE.MeshStandardMaterial(o));
  // large-format pale pavers, 0.6 x 1.2 m running bond. 1 texture tile = 2.4 m.
  const r = rng(38);
  const paverMap = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#7c7366'; g.fillRect(0, 0, w, h);
    const ph = h / 4, pw = w / 2;
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * pw / 2;
      for (let c = -1; c < 3; c++) {
        const x = c * pw + off, y = row * ph; const v = (r() - 0.5) * 10;
        g.fillStyle = `rgb(${164 + v},${153 + v},${136 + v})`; g.fillRect(x + 3, y + 3, pw - 6, ph - 6);
        for (let k = 0; k < 900; k++) {
          const s = (r() - 0.5) * 34; g.fillStyle = `rgba(${148 + s},${139 + s},${122 + s},0.35)`;
          g.fillRect(x + 3 + r() * (pw - 6), y + 3 + r() * (ph - 6), 2, 2);
        }
      }
    }
  }, { repeat: [1 / 2.4, 1 / 2.4] });
  const stoneN = noiseNormal(256, 1.2, 24, 9);
  const speck = (base, seed) => { const rr = rng(seed); return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 3000; k++) { const s = (rr() - 0.5) * 30; g.fillStyle = `rgba(${150 + s},${142 + s},${126 + s},0.25)`; g.fillRect(rr() * w, rr() * h, 2, 2); }
  }, { repeat: [3, 3] }); };
  const weave = (base, seed) => { const rr = rng(seed); return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const v = (rr() - 0.5) * 40; const hor = ((x + y) / 8) % 2 === 0;
      g.fillStyle = `rgba(${150 + v},${135 + v},${115 + v},0.55)`;
      if (hor) g.fillRect(x, y + 1, 8, 5); else g.fillRect(x + 1, y, 5, 8);
      g.fillStyle = 'rgba(30,25,20,0.35)'; g.fillRect(x, y, 1, 1);
    }
  }, { repeat: [5, 5] }); };
  const grassMap = (() => { const rr = rng(5); return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#41662a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9000; k++) { const v = (rr() - 0.5) * 50; g.fillStyle = `rgba(${70 + v},${105 + v},${45 + v * 0.5},0.5)`; g.fillRect(rr() * w, rr() * h, 1, 3); }
  }, { repeat: [12, 1] }); })();
  const plaster = std({ color: 0xe4e9e8, roughness: 0.82, normalMap: noiseNormal(256, 0.8, 20, 4), normalScale: new THREE.Vector2(0.25, 0.25), side: THREE.DoubleSide });
  const M = {
    pavers: std({ map: paverMap, roughness: 0.8, normalMap: stoneN, normalScale: new THREE.Vector2(0.25, 0.25) }),
    coping: std({ map: speck('#ab9f89', 3), color: 0xffffff, roughness: 0.72, normalMap: stoneN, normalScale: new THREE.Vector2(0.3, 0.3) }),
    plaster,
    wicker: std({ map: weave('#7a6a58', 2), color: 0xffffff, roughness: 0.85 }),
    cushion: std({ color: 0x5f5e5a, roughness: 0.95 }),
    cushionLight: std({ color: 0x8a8984, roughness: 0.95 }),
    teak: std({ color: 0xb4ab9c, roughness: 0.85, map: canvasTex(512, 64, (g, w, h) => {
      const rr = rng(7); g.fillStyle = '#b8ae9f'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 160; k++) { const y = rr() * h, v = (rr() - 0.5) * 50; g.strokeStyle = `rgba(${140 + v},${130 + v},${115 + v},0.5)`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + rr() * 4, 2 * w / 3, y - rr() * 4, w, y); g.stroke(); }
    }) }),
    teakLeg: std({ color: 0xa48a68, roughness: 0.75 }),
    concrete: std({ map: speck('#8e8b86', 5), color: 0xffffff, roughness: 0.9, normalMap: stoneN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    tableWhite: std({ color: 0xe9e4da, roughness: 0.7 }),
    fireGlass: std({ color: 0x3a1f17, roughness: 0.35, metalness: 0.3 }),
    glass: kit.M.glass,
    metal: std({ color: 0x151515, roughness: 0.5, metalness: 0.5 }),
    grass: std({ map: grassMap, roughness: 1 }),
    leaf: std({ color: 0x55703a, roughness: 0.9 }),
    leafLight: std({ color: 0x7d9a4a, roughness: 0.9 }),
    planter: std({ color: 0x3c3b39, roughness: 0.8 }),
    spill: new THREE.MeshStandardMaterial({ color: 0xcff3f5, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, alphaMap: spillStreaks(kit) }),
  };
  // stacked-stone (ledgestone) veneer for the raised spa; 1 texture tile = 0.6 x 0.6 m
  const ls = ledgestone(kit);
  M.ledgestone = std({ map: ls.map, normalMap: ls.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.9 });
  // spa interior plaster with an emissive underwater-light glow (colour animated by the pool piece; no real lights)
  M.spaGlow = std({ color: 0xe4e9e8, roughness: 0.82, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), emissive: 0x6a3cff, emissiveIntensity: 0, side: THREE.DoubleSide });
  M.spaLens = new THREE.MeshBasicMaterial({ color: 0xb9a6ff });
  return M;
}

// Vertical streaks (alpha) for the spill-over sheet; scrolled in v by the pool piece.
function spillStreaks(kit) {
  const r = kit.rng(17);
  const t = kit.canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) {
      const x = r() * w, y = r() * h, len = 30 + r() * 120, v = 120 + r() * 135;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1 + r() * 2, len); g.fillRect(x, y - h, 1 + r() * 2, len);
    }
  }, { srgb: false, repeat: [3, 1] });
  return t;
}

// Procedural tileable ledgestone: thin horizontal courses of split-face stone, dark recessed joints.
// Returns { map, normalMap } (512 px = 0.6 m).
export function ledgestone(kit) {
  const S = 512, r = kit.rng(4242);
  const rows = []; let y = 0;
  while (y < S) { let h = Math.round(20 + r() * 40); if (S - (y + h) < 20) h = S - y; rows.push({ y0: y, h }); y += h; }
  const pal = [[132, 124, 112], [120, 114, 106], [142, 132, 116], [108, 102, 96], [128, 118, 104], [148, 138, 122], [98, 94, 90]];
  for (const row of rows) {
    row.pieces = []; let x = Math.floor(r() * S); const x0 = x;
    while (x < x0 + S) {
      const len = Math.round(80 + r() * 260); const c = pal[Math.floor(r() * pal.length)]; const v = (r() - 0.5) * 18;
      row.pieces.push({ x, len: Math.min(len, x0 + S - x), col: [c[0] + v, c[1] + v, c[2] + v], tilt: (r() - 0.5) * 0.5, bulge: 0.4 + r() * 0.6, ph: r() * 6.28, fq: 0.25 + r() * 0.5 });
      x += len;
    }
  }
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) >>> 0; n = ((n ^ (n >>> 13)) * 1274126177) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const H = new Float32Array(S * S), C = new Float32Array(S * S * 3);
  for (const row of rows) for (let yy = row.y0; yy < row.y0 + row.h; yy++) for (let xx = 0; xx < S; xx++) {
    const k = yy * S + xx;
    let p = null, dx = 0;
    for (const pc of row.pieces) { const d = ((xx - pc.x) % S + S) % S; if (d < pc.len) { p = pc; dx = d; break; } }
    const dy = yy - row.y0; const jw = 2.5;
    const edge = Math.min(dy, row.h - 1 - dy, dx, p ? p.len - 1 - dx : 0);
    const n = hash(xx, yy) - 0.5;
    if (!p || edge < jw) { H[k] = 0.05 * hash(xx + 7, yy); C[k * 3] = 46 + n * 10; C[k * 3 + 1] = 43 + n * 10; C[k * 3 + 2] = 40 + n * 10; continue; }
    const fall = Math.min(1, (edge - jw) / 7);
    const strat = 0.12 * Math.sin(dy * p.fq + p.ph + dx * 0.02) + 0.08 * Math.sin(dy * 1.7 + p.ph * 3);
    const h = fall * (0.55 + 0.35 * p.bulge + p.tilt * (dy / row.h - 0.5) + strat) + n * 0.06;
    H[k] = h;
    const shade = 0.82 + 0.28 * Math.min(1, h) + n * 0.12 + strat * 0.4;
    C[k * 3] = p.col[0] * shade; C[k * 3 + 1] = p.col[1] * shade; C[k * 3 + 2] = p.col[2] * shade;
  }
  const map = kit.canvasTex(S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let k = 0; k < S * S; k++) { img.data[k * 4] = C[k * 3]; img.data[k * 4 + 1] = C[k * 3 + 1]; img.data[k * 4 + 2] = C[k * 3 + 2]; img.data[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  });
  const normalMap = kit.canvasTex(S, S, (g) => {
    const img = g.createImageData(S, S); const st = 3.0;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
      const dx = (H[yy * S + (xx + 1) % S] - H[yy * S + (xx - 1 + S) % S]) * st;
      const dy = (H[((yy + 1) % S) * S + xx] - H[((yy - 1 + S) % S) * S + xx]) * st;
      const nz = 1 / Math.hypot(dx, dy, 1); const i = (yy * S + xx) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  return { map, normalMap };
}

// Wicker lounge module: seat w (x) by d (z), optional arms/back. Front faces +z.
export function wickerSeat(kit, parent, M, pos, ry, { w = 0.9, d = 0.9, back = true, armL = false, armR = false, seatH = 0.40, backH = 0.72, cushions = true } = {}) {
  const g = kit.group(parent, pos, ry);
  const base = seatH - 0.10;
  kit.add(g, kit.rbox(w, base, d, 0.03), M.wicker, [0, base / 2, 0]);
  if (back) kit.add(g, kit.rbox(w, backH, 0.16, 0.04), M.wicker, [0, backH / 2, -d / 2 + 0.08]);
  if (armL) kit.add(g, kit.rbox(0.16, backH - 0.08, d, 0.04), M.wicker, [-w / 2 + 0.08, (backH - 0.08) / 2, 0]);
  if (armR) kit.add(g, kit.rbox(0.16, backH - 0.08, d, 0.04), M.wicker, [w / 2 - 0.08, (backH - 0.08) / 2, 0]);
  if (cushions) {
    const iw = w - (armL ? 0.16 : 0) - (armR ? 0.16 : 0) - 0.02, ix = ((armL ? 0.08 : 0) - (armR ? 0.08 : 0));
    const id = d - (back ? 0.16 : 0) - 0.02, iz = back ? 0.08 : 0;
    kit.add(g, kit.cushion(iw, 0.12, id, 0.04, 0.015), M.cushion, [ix, base + 0.06, iz]);
    if (back) {
      const bc = kit.add(g, kit.cushion(iw, 0.40, 0.14, 0.05, 0.02), M.cushion, [ix, base + 0.12 + 0.20, -d / 2 + 0.16 + 0.07]);
      bc.rotation.x = -0.14;
    }
  }
  return g;
}

export function sectional(kit, parent, M) {
  // On the in-pool lounge platform (p38/p40): back run along the canyon edge facing the house,
  // a return on the NE end and a chaise/ottoman on the SW end; white coffee table with flowers.
  const g = kit.group(parent, [0, 0, 0]);
  const y = -0.20, zb = 27.05;
  for (let i = 0; i < 4; i++) wickerSeat(kit, g, M, [8.25 + i * 0.82, y, zb], 0, { w: 0.82, d: 0.88, armL: i === 0 });
  wickerSeat(kit, g, M, [11.12, y, zb], 0, { w: 0.88, d: 0.88, armR: true });             // corner
  wickerSeat(kit, g, M, [11.12, y, 26.17], -Math.PI / 2, { w: 0.86, d: 0.88, armL: true }); // return facing -x
  wickerSeat(kit, g, M, [8.25, y, 26.05], 0, { w: 0.82, d: 0.90, back: false });            // ottoman / chaise
  // coffee table
  const t = kit.group(g, [9.75, y, 25.80]);
  kit.add(t, kit.rbox(1.20, 0.06, 0.70, 0.015), M.tableWhite, [0, 0.38, 0]);
  kit.add(t, kit.rbox(1.12, 0.03, 0.62, 0.01), M.tableWhite, [0, 0.12, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.add(t, kit.box(0.06, 0.38, 0.06), M.tableWhite, [sx * 0.56, 0.19, sz * 0.31]);
  kit.add(t, kit.rbox(0.36, 0.10, 0.20, 0.01), M.tableWhite, [0, 0.46, 0]);
  for (let i = 0; i < 9; i++) kit.add(t, kit.sphere(0.04, 10, 8), i % 3 ? M.leafLight : M.cushionLight, [-0.12 + (i % 5) * 0.06, 0.53 + (i % 2) * 0.02, -0.04 + Math.floor(i / 5) * 0.08]);
  return g;
}

export function firePit(kit, parent, M, pos, ry = 0) {
  const g = kit.group(parent, pos, ry);
  kit.add(g, kit.rbox(1.50, 0.40, 0.95, 0.02), M.concrete, [0, 0.20, 0]);
  kit.add(g, kit.box(1.36, 0.06, 0.81), M.concrete, [0, 0.43, 0]);
  kit.add(g, kit.box(0.80, 0.02, 0.36), M.fireGlass, [0, 0.465, 0]);
  const gl = (w, d, x, z) => { const m = kit.add(g, kit.box(w, 0.18, d), M.glass, [x, 0.55, z], [0, 0, 0], { shadow: false }); m.userData.keep = true; };
  gl(0.90, 0.008, 0, -0.22); gl(0.90, 0.008, 0, 0.22); gl(0.008, 0.44, -0.45, 0); gl(0.008, 0.44, 0.45, 0);
  return g;
}

export function clubChair(kit, parent, M, pos, ry) {
  return wickerSeat(kit, parent, M, pos, ry, { w: 0.92, d: 0.90, armL: true, armR: true, backH: 0.80 });
}

export function teakBench(kit, parent, M, pos, ry, L = 2.0) {
  const g = kit.group(parent, pos, ry);
  for (let i = 0; i < 4; i++) kit.add(g, kit.rbox(L, 0.045, 0.105, 0.01), M.teak, [0, 0.44, -0.165 + i * 0.11]);
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - 0.22);
    kit.add(g, kit.rbox(0.07, 0.42, 0.07, 0.01), M.teakLeg, [x, 0.21, -0.1], [0.18, 0, 0]);
    kit.add(g, kit.rbox(0.07, 0.42, 0.07, 0.01), M.teakLeg, [x, 0.21, 0.1], [-0.18, 0, 0]);
    kit.add(g, kit.rbox(0.07, 0.06, 0.44, 0.01), M.teakLeg, [x, 0.39, 0]);
  }
  kit.add(g, kit.rbox(L - 0.44, 0.05, 0.05, 0.01), M.teakLeg, [0, 0.16, 0]);
  return g;
}

export function pingPong(kit, parent, M, pos, ry) {
  // polish: regulation look — dark blue satin top (playing surface at 0.76, matches games/pingpong/sim.js TY),
  // white 2 cm edge lines + 3 mm centre line, steel apron, folding-leg undercarriage on castors, mesh net with
  // white tape on two clamp posts. All static (merged by the pool piece).
  const g = kit.group(parent, pos, ry);
  if (!M.ppTop) {
    M.ppTop = kit.outdoor(new THREE.MeshStandardMaterial({ color: 0x082460, roughness: 0.78, metalness: 0.0 })); M.ppTop.envMapIntensity = 0.2; /* satin, not a sky mirror */
    M.ppLine = kit.outdoor(new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.45 }));
    M.ppSteel = kit.outdoor(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 }));
    M.ppFrame = kit.outdoor(new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.5, metalness: 0.6 }));
    const netMap = kit.canvasTex(256, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(20,22,26,1)'; c.lineWidth = 1.6;
      for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    netMap.repeat.set(9, 1);
    M.ppNet = kit.outdoor(new THREE.MeshStandardMaterial({ map: netMap, color: 0x2a2d33, roughness: 0.9, alphaTest: 0.35, transparent: false, side: THREE.DoubleSide }));
  }
  const TOP = 0.76, L = 2.74, W = 1.525;
  kit.add(g, kit.rbox(L, 0.025, W, 0.004), M.ppTop, [0, TOP - 0.0125, 0]);
  kit.add(g, kit.box(L - 0.02, 0.05, W - 0.02), M.ppFrame, [0, TOP - 0.05, 0]);   // steel apron under the top edge
  const ly = TOP + 0.0006, line = M.ppLine;
  kit.add(g, kit.box(L, 0.001, 0.02), line, [0, ly, W / 2 - 0.01]); kit.add(g, kit.box(L, 0.001, 0.02), line, [0, ly, -W / 2 + 0.01]);
  kit.add(g, kit.box(0.02, 0.001, W), line, [L / 2 - 0.01, ly, 0]); kit.add(g, kit.box(0.02, 0.001, W), line, [-L / 2 + 0.01, ly, 0]);
  kit.add(g, kit.box(L - 0.04, 0.001, 0.006), line, [0, ly, 0]); /* 3 mm aliases into dashes at play distance */
  // edge band: thin white lip on the long sides so the edge reads from low angles
  for (const sz of [-1, 1]) kit.add(g, kit.box(L, 0.022, 0.004), line, [0, TOP - 0.011, sz * (W / 2 + 0.002)]);
  for (const sx of [-1, 1]) kit.add(g, kit.box(0.004, 0.022, W), line, [sx * (L / 2 + 0.002), TOP - 0.011, 0]);
  // net: 1.83 m long, 15.25 cm high, mesh + white tape, black clamp posts outside the table edge
  const NH = 0.1525, NL = 1.83;
  kit.add(g, new THREE.PlaneGeometry(NL, NH - 0.012).rotateY(Math.PI / 2), M.ppNet, [0, TOP + (NH - 0.012) / 2, 0]);
  kit.add(g, kit.box(0.006, 0.014, NL), line, [0, TOP + NH - 0.007, 0]);
  kit.add(g, kit.box(0.004, 0.006, NL), line, [0, TOP + 0.003, 0]);
  for (const sz of [-1, 1]) {
    kit.add(g, kit.cyl(0.009, 0.009, NH + 0.01, 12), M.ppSteel, [0, TOP + NH / 2, sz * NL / 2]);
    kit.add(g, kit.box(0.04, 0.03, 0.09), M.ppFrame, [0, TOP - 0.01, sz * (W / 2 + 0.03)]);              // clamp on the table edge
    kit.add(g, kit.box(0.02, 0.012, 0.16), M.ppSteel, [0, TOP + 0.006, sz * (W / 2 + 0.07)]);             // post arm out to the post
  }
  // legs: two folding A-frames (square steel tube) with cross braces and castor feet
  for (const sx of [-1, 1]) {
    const x = sx * 0.95;
    for (const sz of [-1, 1]) {
      kit.add(g, kit.box(0.035, TOP - 0.1, 0.035), M.ppFrame, [x, (TOP - 0.1) / 2 + 0.06, sz * 0.62]);
      kit.add(g, kit.cyl(0.03, 0.03, 0.03, 14), M.ppSteel, [x, 0.035, sz * 0.62]);                       // castor housing
      kit.add(g, kit.cyl(0.028, 0.028, 0.022, 14).rotateX(Math.PI / 2), M.matteBlack || M.ppFrame, [x, 0.028, sz * 0.62]); // wheel
    }
    kit.add(g, kit.box(0.03, 0.03, 1.24), M.ppFrame, [x, 0.16, 0]);
    kit.add(g, kit.box(0.03, 0.03, 1.24), M.ppFrame, [x, TOP - 0.12, 0]);
    kit.add(g, kit.box(0.6, 0.025, 0.025), M.ppSteel, [x * 0.68, TOP - 0.25, 0]);                       // diagonal fold strut (flat)
  }
  kit.add(g, kit.box(1.9, 0.03, 0.03), M.ppFrame, [0, 0.16, 0]);                                       // centre spine between the frames
  return g;
}

export function planter(kit, parent, M, pos, s = 1, seed = 1) {
  const g = kit.group(parent, pos);
  kit.add(g, kit.cyl(0.32 * s, 0.26 * s, 0.62 * s, 24), M.planter, [0, 0.31 * s, 0]);
  const r = kit.rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, rr = r() * 0.28 * s;
    kit.add(g, new THREE.IcosahedronGeometry((0.20 + r() * 0.14) * s, 1), i % 2 ? M.leaf : M.leafLight, [Math.cos(a) * rr, (0.75 + r() * 0.55) * s, Math.sin(a) * rr]);
  }
  return g;
}

// Black metal picket fence along a straight run a->b (x,z) at base height y0. Instanced pickets.
export function fence(kit, parent, M, a, b, y0, H = 1.22) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  const g = kit.group(parent, [a[0], y0, a[1]], ry);
  const n = Math.floor(L / 0.11);
  const pick = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, H - 0.06, 0.018), M.metal, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation((i + 0.5) * L / n, 0.05 + (H - 0.06) / 2, 0); pick.setMatrixAt(i, m4); }
  pick.castShadow = true; pick.receiveShadow = true; pick.userData.keep = true; g.add(pick);
  for (const y of [0.10, H - 0.08]) kit.add(g, kit.box(L, 0.03, 0.025), M.metal, [L / 2, y, 0]);
  const posts = Math.ceil(L / 2.4);
  for (let i = 0; i <= posts; i++) kit.add(g, kit.box(0.05, H + 0.04, 0.05), M.metal, [i * L / posts, (H + 0.04) / 2, 0]);
  return g;
}
