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
    spaTile: std({ map: canvasTex(256, 64, (g, w, h) => {
      const rr = rng(9); g.fillStyle = '#6f6c66'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 32) { const v = (rr() - 0.5) * 36; g.fillStyle = `rgb(${150 + v},${146 + v},${138 + v})`; g.fillRect(x + 1, y + 1, 30, 14); }
    }, { repeat: [6, 1] }), roughness: 0.35 }),
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
    spill: new THREE.MeshStandardMaterial({ color: 0xcff3f5, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }),
  };
  return M;
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
  const g = kit.group(parent, pos, ry);
  kit.add(g, kit.rbox(2.74, 0.06, 1.525, 0.01), M.concrete, [0, 0.73, 0]);
  const line = M.tableWhite;
  kit.add(g, kit.box(2.74, 0.004, 0.02), line, [0, 0.762, 0.752]); kit.add(g, kit.box(2.74, 0.004, 0.02), line, [0, 0.762, -0.752]);
  kit.add(g, kit.box(0.02, 0.004, 1.525), line, [1.36, 0.762, 0]); kit.add(g, kit.box(0.02, 0.004, 1.525), line, [-1.36, 0.762, 0]);
  kit.add(g, kit.box(2.74, 0.004, 0.006), line, [0, 0.762, 0]);
  kit.add(g, kit.box(0.02, 0.15, 1.6), M.metal, [0, 0.835, 0]);
  for (const sx of [-1, 1]) kit.add(g, kit.rbox(0.28, 0.70, 1.0, 0.03), M.concrete, [sx * 0.85, 0.35, 0]);
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
