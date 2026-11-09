// Larger furniture / equipment, built in local coordinates (origin on the floor, +z = front).
import * as THREE from 'three';
import { COL, garment, bookRow, bottle, tumbler } from './props.js';
const PI = Math.PI;

export function piano(L, g) { // baby grand: keyboard along local x at +z, curved case toward -z
  const { G, M, put, THREE: T } = L;
  const outline = []; for (let i = 0; i <= 16; i++) { const t = i / 16; outline.push([-0.72 + t * 0.2, -0.0 - t * 0.0]); }
  const s = new THREE.Shape(); s.moveTo(-0.74, 0); s.lineTo(0.74, 0); s.lineTo(0.74, -0.55); s.bezierCurveTo(0.74, -1.0, 0.2, -0.95, 0.05, -1.25); s.bezierCurveTo(-0.15, -1.65, -0.45, -1.62, -0.6, -1.55); s.bezierCurveTo(-0.74, -1.48, -0.74, -1.2, -0.74, -1.0); s.lineTo(-0.74, 0);
  const caseG = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 10 }); caseG.rotateX(PI / 2); L.tint(caseG, 0x0a0a0a);
  put(g, caseG, M.gloss, [0, 1.0, 0], [0, 0, 0], true);
  const lid = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 10 }); lid.rotateX(PI / 2); L.tint(lid, 0x0a0a0a);
  const lg = new THREE.Group(); lg.position.set(0.74, 1.0, 0); lg.rotation.z = 0.55; g.add(lg); put(lg, lid, M.gloss, [-0.74, 0.012, 0]);
  put(g, G.cyl(0.008, 0.008, 0.75, 0x111111, 6), M.metal, [0.35, 1.3, -0.7], [0, 0, 0.55]);
  put(g, G.box(1.5, 0.09, 0.32, 0x0a0a0a), M.gloss, [0, 0.72, 0.14], [0, 0, 0], true);
  put(g, G.box(1.36, 0.02, 0.15, 0xf6f4ee), M.gloss, [0, 0.78, 0.2]);
  for (let i = 0; i < 36; i++) { const x = -0.66 + i * 0.0378; if ([1, 2, 4, 5, 6].includes(i % 7)) put(g, G.box(0.012, 0.016, 0.09, 0x080808), M.gloss, [x, 0.795, 0.17]); }
  put(g, G.box(0.6, 0.18, 0.012, 0x0a0a0a), M.gloss, [0, 0.95, 0.04], [-0.25, 0, 0]);
  for (const [x, z] of [[-0.62, 0.1], [0.62, 0.1], [-0.2, -1.3]]) put(g, G.cyl(0.05, 0.04, 0.68, 0x0a0a0a, 10), M.gloss, [x, 0.34, z], [0, 0, 0], true);
  put(g, G.box(0.25, 0.3, 0.06, 0x0a0a0a), M.gloss, [0, 0.2, 0.05]);
  for (const dx of [-0.06, 0, 0.06]) put(g, G.box(0.025, 0.012, 0.06, COL.gold), M.metal, [dx, 0.08, 0.1]);
  // bench
  put(g, G.cushion(0.8, 0.06, 0.36, 0.02, 0.01, 0x111111), M.satin, [0, 0.5, 0.62], [0, 0, 0], true);
  for (const s2 of [-1, 1]) for (const z of [0.5, 0.74]) put(g, G.cyl(0.02, 0.018, 0.47, 0x0a0a0a, 8), M.gloss, [s2 * 0.35, 0.235, z]);
  // sheet music
  put(g, G.label(0.42, 0.28, 0.004, { pz: 'paper' }, 0xf5f2ea), M.print, [0, 1.04, 0.05], [-0.25, 0, 0]);
}

export function arcade(L, g) { const { G, M, put } = L; // 0.68 w x 0.8 d x 1.8 h, faces +z
  // side profile (z, y): base, control-panel ledge, recessed screen, overhanging marquee
  const prof = [[-0.4, 0], [0.34, 0], [0.34, 0.9], [0.36, 0.98], [0.12, 1.06], [0.04, 1.52], [0.16, 1.6], [0.16, 1.82], [-0.4, 1.82]];
  const side = new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y))), { depth: 0.025, bevelEnabled: false }); side.rotateY(-PI / 2); L.tint(side, 0x18122a);
  for (const s of [-1, 1]) { const m = put(g, side.clone(), M.satin, [s * 0.34 + (s > 0 ? 0.025 : 0), 0, 0], [0, 0, 0], true); }
  const trim = L.G.tube(prof.concat([prof[0]]).map(([z, y]) => [0, y, z]), 0.008, 0xff2e88, 40, 4); for (const s of [-1, 1]) put(g, trim.clone(), M.satin, [s * 0.355, 0, 0]);
  put(g, G.box(0.66, 0.9, 0.7, 0x101018), M.satin, [0, 0.45, -0.05], [0, 0, 0], true);
  put(g, G.box(0.66, 0.8, 0.44, 0x101018), M.satin, [0, 1.42, -0.18]);
  put(g, G.box(0.66, 0.05, 0.3, 0x101018), M.satin, [0, 0.98, 0.22], [0.3, 0, 0]);
  put(g, G.sheet(0.5, 0.4, 'arcade'), M.screen, [0, 1.3, 0.085], [-0.17, 0, 0]);
  put(g, G.sheet(0.62, 0.2, 'marquee'), M.screen, [0, 1.71, 0.161]);
  put(g, G.cyl(0.012, 0.012, 0.06, 0x111111, 6), M.satin, [-0.15, 1.05, 0.22]); put(g, G.sph(0.025, 0xe02424, 8, 6), M.satin, [-0.15, 1.09, 0.22]);
  for (let i = 0; i < 4; i++) put(g, G.cyl(0.02, 0.02, 0.012, [0xe02424, 0x2a7de1, 0xf2c230, 0x2ab04a][i], 10), M.satin, [0.02 + (i % 2) * 0.07, 1.03, 0.19 + (i >> 1) * 0.05], [0.3, 0, 0]);
  put(g, G.box(0.3, 0.12, 0.01, 0x222222), M.satin, [0, 0.6, 0.302]); put(g, G.box(0.06, 0.04, 0.012, 0xffc400), M.led, [0, 0.6, 0.31]);
}

export function barCart(L, g) { const { G, M, put } = L; // 0.8 x 0.45, h 0.85, brass frame + glass shelves
  for (const sx of [-0.38, 0.38]) for (const sz of [-0.2, 0.2]) put(g, G.cyl(0.01, 0.01, 0.82, 0xffffff, 6), M.brass, [sx, 0.43, sz]);
  for (const y of [0.18, 0.78]) { put(g, G.box(0.76, 0.012, 0.4, 0x111111), M.gloss, [0, y, 0]); put(g, G.torus(0.01, 0.003, 0xffffff, 4, 8), M.brass, [0.42, y, 0.2]); }
  for (const sx of [-0.38, 0.38]) put(g, G.cyl(0.07, 0.07, 0.02, COL.black, 14), M.matte, [sx, 0.07, 0.2], [0, 0, PI / 2]);
  put(g, G.tube([[0.38, 0.82, -0.22], [0.48, 0.82, -0.18], [0.48, 0.82, 0.18], [0.38, 0.82, 0.22]], 0.01, 0xffffff, 8, 6), M.brass);
  [['liquor', 0x3a2410, 0.3], ['tequila', 0xe6e2d8, 0.28], ['wine', 0x4a0f12, 0.3], ['liquor', 0x6a3d16, 0.26]].forEach(([lab, c, h], i) => bottle(L, g, -0.28 + i * 0.12, 0.786, -0.06, { hex: c, label: lab, h, r: 0.04 }));
  for (let i = 0; i < 4; i++) tumbler(L, g, -0.2 + i * 0.09, 0.786, 0.12);
  put(g, G.cyl(0.08, 0.07, 0.15, 0xd8d8d8, 16), M.metal, [0.25, 0.86, 0.1]);
  for (let i = 0; i < 3; i++) bottle(L, g, -0.25 + i * 0.15, 0.186, 0, { hex: [0x1d3b1f, 0x5a1016, 0xd8d1b0][i], label: 'wine', h: 0.31 });
}

export function bike(L, g, hex = 0x1d1d1d, accent = COL.red) { const { G, M, put } = L; // along local z, wheels at z ±0.52
  for (const z of [-0.52, 0.52]) { put(g, G.torus(0.33, 0.022, 0x111111, 6, 32), M.matte, [0, 0.35, z], [0, PI / 2, 0]); put(g, G.torus(0.3, 0.006, 0xbfbfbf, 4, 24), M.metal, [0, 0.35, z], [0, PI / 2, 0]); put(g, G.cyl(0.02, 0.02, 0.06, 0x999999, 8), M.metal, [0, 0.35, z], [0, 0, PI / 2]); }
  const tube = (a, b, c = hex) => put(g, G.tube([a, b], 0.017, c, 2, 6), M.gloss);
  const bb = [0, 0.33, -0.05], seat = [0, 0.82, -0.15], head = [0, 0.86, 0.38];
  tube(bb, seat, accent); tube(bb, head); tube(seat, head); tube(bb, [0, 0.35, -0.52]); tube(seat, [0, 0.35, -0.52]); tube(head, [0, 0.35, 0.52]);
  put(g, G.rbox(0.12, 0.04, 0.25, 0.02, 0x111111), M.satin, [0, 0.87, -0.17]); put(g, G.cyl(0.012, 0.012, 0.44, 0x111111, 6), M.satin, [0, 0.95, 0.4], [0, 0, PI / 2]);
  put(g, G.cyl(0.06, 0.06, 0.02, 0x777777, 14), M.metal, [0.03, 0.33, -0.05], [0, 0, PI / 2]);
}
export function surfboard(L, g, len = 2.4, hex = COL.white, stripe = 0x2f6f73) { const { G, M, put } = L; // lying along local x, deck up
  const geo = G.sph(0.5, hex, 24, 8); const p = geo.attributes.position, c = geo.attributes.color; const col = new THREE.Color(stripe);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) * 2, z = p.getZ(i) * 2, y = p.getY(i) * 2; const t = x; const w = 0.27 * Math.pow(Math.max(0, 1 - Math.abs(t) ** 2.4), 0.5) * (t > 0 ? 1 - t * 0.35 : 1); p.setXYZ(i, t * len / 2, y * 0.035, z * w); if (Math.abs(x + 0.2) < 0.06) c.setXYZ(i, col.r, col.g, col.b); }
  geo.computeVertexNormals(); put(g, geo, M.gloss);
}
export function golfBag(L, g) { const { G, M, put } = L; put(g, G.cyl(0.13, 0.12, 0.85, 0x1f3d2b, 16), M.satin, [0, 0.43, 0]); put(g, G.can(0.132, 0.2, 'golf', 0x1f3d2b), M.print, [0, 0.55, 0]); put(g, G.torus(0.13, 0.015, 0x111111, 6, 20), M.satin, [0, 0.86, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 0.06 * ((i % 3) / 2); const x = Math.cos(a) * d, z = Math.sin(a) * d; put(g, G.cyl(0.006, 0.006, 0.35, 0xb0b0b0, 5), M.metal, [x, 1.0, z]); i % 3 ? put(g, G.rbox(0.09, 0.03, 0.03, 0.01, 0xcfcfcf), M.metal, [x + 0.03, 1.18, z]) : put(g, G.cyl(0.04, 0.045, 0.12, [0x111111, 0xc0282a, 0x223355][i % 3], 10), M.fabric, [x, 1.2, z]); }
}
export function beerFridge(L, g) { const { G, M, put } = L; // 0.6 w x 0.62 d x 0.86 h glass-door fridge, faces +z
  put(g, G.rbox(0.6, 0.86, 0.62, 0.01, 0x1a1a1a), M.satin, [0, 0.43, 0], [0, 0, 0], true);
  put(g, G.box(0.52, 0.7, 0.01, 0xffffff), M.glass, [0, 0.45, 0.315]); put(g, G.box(0.52, 0.7, 0.005, 0x2a2f36), M.matte, [0, 0.45, -0.25]);
  put(g, G.box(0.5, 0.02, 0.005, 0xdff0ff), M.led, [0, 0.79, 0.29]);
  for (const y of [0.13, 0.36, 0.59]) { put(g, G.box(0.52, 0.006, 0.5, 0x777777), M.metal, [0, y, 0]); for (let i = 0; i < 7; i++) put(g, G.can(0.033, 0.122, i % 3 ? 'beer' : 'soda1'), M.print, [-0.21 + i * 0.07, y + 0.064, 0.2]); }
  put(g, G.box(0.02, 0.5, 0.03, 0x999999), M.metal, [0.26, 0.45, 0.33]);
}
export function workbench(L, g, w = 1.8) { const { G, M, put } = L; // depth 0.6, top 0.9
  put(g, G.rbox(w, 0.05, 0.6, 0.008, 0xb98a5a), M.satin, [0, 0.885, 0], [0, 0, 0], true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, G.box(0.05, 0.86, 0.05, 0x3a3d40), M.metal, [sx * (w / 2 - 0.05), 0.43, sz * 0.25]);
  put(g, G.box(w - 0.1, 0.03, 0.5, 0x6a6d70), M.metal, [0, 0.18, 0]);
  put(g, G.box(w, 1.0, 0.02, 0x8a8d90), M.matte, [0, 1.45, -0.29]); // pegboard
  const r = L.rng(5); for (let i = 0; i < 11; i++) { const x = -w / 2 + 0.15 + i * (w - 0.3) / 10, y = 1.15 + (i % 3) * 0.28; put(g, G.rbox(0.03, 0.18 + r() * 0.1, 0.02, 0.008, [0xc0282a, 0x222222, 0xe6b422, 0x2a5fa8][i % 4]), M.satin, [x, y, -0.26]); put(g, G.box(0.06, 0.05, 0.02, 0x999999), M.metal, [x, y + 0.12, -0.26]); }
  // tool chest on the bench + rolling chest under it
  put(g, G.rbox(0.6, 0.3, 0.35, 0.01, 0xc0282a), M.gloss, [w / 2 - 0.4, 1.06, -0.05]);
  for (let i = 0; i < 3; i++) put(g, G.box(0.56, 0.005, 0.01, 0x999999), M.metal, [w / 2 - 0.4, 0.96 + i * 0.09, 0.126]);
  put(g, G.rbox(0.68, 0.7, 0.45, 0.01, 0xc0282a), M.gloss, [-w / 2 + 0.45, 0.4, 0.0], [0, 0, 0], true);
  for (let i = 0; i < 5; i++) put(g, G.box(0.6, 0.008, 0.012, 0xb0b0b0), M.metal, [-w / 2 + 0.45, 0.2 + i * 0.12, 0.23]);
  put(g, G.rbox(0.3, 0.14, 0.12, 0.02, 0xe6b422), M.satin, [0.1, 0.98, 0.05]); // drill case
}
export function grill(L, g, mat) { const { G, M, put } = L; // stainless gas grill 1.5 w x 0.65 d, faces +z
  const st = mat || M.metal;
  put(g, G.rbox(1.0, 0.8, 0.6, 0.01, 0xc8cacc), st, [0, 0.4, 0], [0, 0, 0], true);
  for (const s of [-1, 1]) put(g, G.box(0.25, 0.03, 0.55, 0xc8cacc), st, [s * 0.63, 0.88, 0]);
  put(g, G.box(1.0, 0.1, 0.6, 0x2a2a2a), M.satin, [0, 0.86, 0]);
  const hood = G.cyl(0.3, 0.3, 1.0, 0xc8cacc, 16, ); L.xf(hood, 0, 0, 0, 0, 0, PI / 2); const p = hood.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0); hood.computeVertexNormals();
  put(g, hood, st, [0, 0.91, -0.02], [0, 0, 0], true);
  put(g, G.cyl(0.015, 0.015, 0.8, 0xc8cacc, 8), st, [0, 1.12, 0.33], [0, 0, PI / 2]);
  for (let i = 0; i < 4; i++) put(g, G.cyl(0.025, 0.025, 0.03, 0x111111, 10), M.satin, [-0.36 + i * 0.24, 0.72, 0.31], [PI / 2, 0, 0]);
  for (const s of [-1, 1]) put(g, G.box(0.46, 0.66, 0.01, 0xb8babc), st, [s * 0.24, 0.33, 0.302]);
  put(g, G.cyl(0.15, 0.15, 0.45, 0xe8e8e8, 12), M.satin, [0.6, 0.23, -0.05]); // propane
}
export function lounger(L, g, hex = COL.white, cushion = COL.cream) { const { G, M, put } = L; // 0.7 w x 2.0 l along z (head at -z)
  put(g, G.rbox(0.7, 0.06, 1.95, 0.02, hex), M.satin, [0, 0.3, 0], [0, 0, 0], true);
  for (const sx of [-0.3, 0.3]) for (const z of [-0.85, 0.85]) put(g, G.box(0.05, 0.3, 0.05, hex), M.satin, [sx, 0.15, z]);
  put(g, G.cushion(0.66, 0.08, 1.25, 0.03, 0.02, cushion), M.fabric, [0, 0.37, 0.3]);
  put(g, G.cushion(0.66, 0.08, 0.68, 0.03, 0.02, cushion), M.fabric, [0, 0.55, -0.62], [0.65, 0, 0]);
}
export function umbrella(L, g, hex = COL.cream, r = 1.4) { const { G, M, put } = L;
  put(g, G.cyl(0.25, 0.28, 0.08, 0x2b2b2b, 16), M.satin, [0, 0.04, 0], [0, 0, 0], true); put(g, G.cyl(0.022, 0.022, 2.4, 0x2b2b2b, 8), M.satin, [0, 1.2, 0]);
  const can = G.cyl(0.03, r, 0.38, hex, 8, ); const p = can.attributes.position; for (let i = 0; i < p.count; i++) { const rr = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) - rr * rr * 0.03); } can.computeVertexNormals();
  put(g, can, M.fabric, [0, 2.3, 0], [0, 0, 0], true); put(g, G.sph(0.04, 0x2b2b2b, 8, 6), M.satin, [0, 2.52, 0]);
}
export function outdoorTable(L, g, n = 6, top = COL.oak, frame = 0x2b2b2b) { const { G, M, put } = L; const w = 1.9, d = 0.95;
  put(g, G.rbox(w, 0.04, d, 0.015, top), M.satin, [0, 0.74, 0], [0, 0, 0], true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, G.box(0.05, 0.72, 0.05, frame), M.satin, [sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08)]);
  const seats = []; for (let i = 0; i < n; i++) { const side = i < n / 2 ? -1 : 1, k = i % (n / 2); seats.push([(k - (n / 2 - 1) / 2) * 0.62, side * (d / 2 + 0.28), side]); }
  return seats;
}
export function patioChair(L, g, frame = 0x2b2b2b, cushion = COL.cream) { const { G, M, put } = L; // faces +z
  put(g, G.rbox(0.5, 0.03, 0.48, 0.01, frame), M.satin, [0, 0.43, 0]); for (const sx of [-0.22, 0.22]) for (const z of [-0.2, 0.2]) put(g, G.box(0.03, 0.43, 0.03, frame), M.satin, [sx, 0.215, z]);
  put(g, G.rbox(0.5, 0.45, 0.03, 0.01, frame), M.satin, [0, 0.68, -0.23], [-0.12, 0, 0]); put(g, G.cushion(0.46, 0.05, 0.44, 0.02, 0.01, cushion), M.fabric, [0, 0.47, 0.01]);
}
export function mailbox(L, g) { const { G, M, put } = L; put(g, G.box(0.09, 1.05, 0.09, 0x1d1d1d), M.satin, [0, 0.525, 0], [0, 0, 0], true);
  const b = G.cyl(0.11, 0.11, 0.48, 0x1d1d1d, 16); L.xf(b, 0, 0, 0, PI / 2, 0, 0); const p = b.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, -0.11); b.computeVertexNormals();
  put(g, b, M.satin, [0, 1.16, 0.05]); put(g, G.box(0.015, 0.15, 0.04, 0xc0282a), M.gloss, [0.12, 1.24, -0.05]); put(g, G.box(0.16, 0.05, 0.002, 0xd4a84b), M.metal, [0, 1.1, 0.291]); }
export function hoseReel(L, g) { const { G, M, put } = L; put(g, G.box(0.5, 0.06, 0.3, 0x2f4a36), M.satin, [0, 0.03, 0]); for (const s of [-1, 1]) put(g, G.box(0.03, 0.5, 0.25, 0x2f4a36), M.satin, [s * 0.22, 0.3, 0]); put(g, G.cyl(0.18, 0.18, 0.38, 0x3c7a3a, 18), M.satin, [0, 0.33, 0], [0, 0, PI / 2]); for (let i = 0; i < 6; i++) put(g, G.torus(0.19, 0.012, 0x3c7a3a, 5, 20), M.satin, [-0.15 + i * 0.06, 0.33, 0], [0, PI / 2, 0]); put(g, G.tube([[0.1, 0.15, 0.18], [0.3, 0.02, 0.5], [0.8, 0.02, 0.6], [1.0, 0.02, 0.3]], 0.012, 0x3c7a3a, 16, 5), M.satin); }
export function beanbag(L, g, hex = COL.charcoal, r = 0.45) { const geo = L.G.sph(r, hex, 16, 12); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i); const x = p.getX(i), z = p.getZ(i); y = y < 0 ? y * 0.45 : y * 0.62 - Math.max(0, z) * 0.35 * (y / r); p.setXYZ(i, x * 1.05, y + r * 0.45, z); } geo.computeVertexNormals(); L.put(g, geo, L.M.fabric, [0, 0, 0], [0, 0, 0], true); }
export function gamingChair(L, g, hex = COL.black, acc = COL.red) { const { G, M, put } = L; // faces +z
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; put(g, G.box(0.04, 0.03, 0.32, 0x111111), M.satin, [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], [0, a, 0]); put(g, G.sph(0.03, 0x111111, 6, 4), M.satin, [Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3]); }
  put(g, G.cyl(0.03, 0.03, 0.35, 0x777777, 8), M.metal, [0, 0.25, 0]);
  put(g, G.cushion(0.52, 0.1, 0.5, 0.04, 0.02, hex), M.fabric, [0, 0.48, 0], [0, 0, 0], true);
  const back = G.cushion(0.5, 0.82, 0.1, 0.05, 0.02, hex); const p = back.attributes.position, c = back.attributes.color; const ac = new THREE.Color(acc); for (let i = 0; i < p.count; i++) if (Math.abs(Math.abs(p.getX(i)) - 0.17) < 0.03) c.setXYZ(i, ac.r, ac.g, ac.b);
  put(g, back, M.fabric, [0, 0.95, -0.24], [-0.12, 0, 0], true);
  for (const s of [-1, 1]) { put(g, G.rbox(0.06, 0.04, 0.26, 0.015, 0x111111), M.satin, [s * 0.29, 0.7, 0.02]); put(g, G.box(0.03, 0.18, 0.03, 0x111111), M.satin, [s * 0.29, 0.6, -0.02]); }
}
export function dresser(L, g, w = 1.4, h = 0.8, d = 0.5, hex = COL.walnut) { const { G, M, put } = L; put(g, G.rbox(w, h - 0.08, d, 0.01, hex), M.satin, [0, 0.08 + (h - 0.08) / 2, 0], [0, 0, 0], true); put(g, G.rbox(w + 0.02, 0.025, d + 0.02, 0.008, hex), M.satin, [0, h - 0.012, 0]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const y = 0.12 + r * (h - 0.16) / 3 + (h - 0.16) / 6; put(g, G.box(w / 2 - 0.015, (h - 0.16) / 3 - 0.01, 0.006, hex), M.satin, [(c - 0.5) * w / 2, y, d / 2 + 0.003]); put(g, G.box(0.12, 0.012, 0.015, 0xd4a84b), M.brass, [(c - 0.5) * w / 2, y, d / 2 + 0.012]); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, G.box(0.03, 0.08, 0.03, COL.black), M.metal, [sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05)]);
}
export function desk(L, g, w = 1.3, d = 0.6, hex = COL.white, legs = COL.oak) { const { G, M, put } = L; put(g, G.rbox(w, 0.03, d, 0.008, hex), M.satin, [0, 0.745, 0], [0, 0, 0], true); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, G.cyl(0.02, 0.016, 0.73, legs, 8), M.satin, [sx * (w / 2 - 0.06), 0.365, sz * (d / 2 - 0.06)], [sz * 0.04, 0, -sx * 0.04]); }
export function acrylicChair(L, g) { const { G, M, put } = L; put(g, G.rbox(0.44, 0.02, 0.42, 0.01, 0xffffff), M.glass, [0, 0.46, 0]); put(g, G.rbox(0.44, 0.38, 0.02, 0.01, 0xffffff), M.glass, [0, 0.66, -0.2], [-0.12, 0, 0]); for (const sx of [-0.19, 0.19]) for (const z of [-0.18, 0.18]) put(g, G.box(0.02, 0.46, 0.02, 0xffffff), M.glass, [sx, 0.23, z]); put(g, G.cushion(0.38, 0.04, 0.36, 0.015, 0.01, COL.blush), M.fabric, [0, 0.49, 0.01]); }
// closet run: rod + shelf along local x of length len, garments hanging, shoes on the floor below; faces +z
export function closetRun(L, g, len, seed = 1, cols = [COL.white, COL.navy, COL.denim, COL.charcoal, COL.oat, COL.blush, COL.sage, COL.black, COL.rust]) { const { G, M, put } = L; const r = L.rng(seed);
  put(g, G.rbox(len, 0.025, 0.4, 0.004, COL.white), M.satin, [0, 1.85, 0], [0, 0, 0], true); put(g, G.cyl(0.013, 0.013, len, 0xc8c6c2, 8), M.metal, [0, 1.78, 0.02], [0, 0, PI / 2]);
  let x = -len / 2 + 0.06; while (x < len / 2 - 0.06) { garment(L, g, x, 1.78, 0.02, cols[(r() * cols.length) | 0], r() < 0.25 ? 1 : r() < 0.4 ? 2 : 0, PI / 2 + (r() - 0.5) * 0.2); x += 0.055 + r() * 0.03; }
  for (let i = 0; i < Math.floor(len / 0.4); i++) { const bx = -len / 2 + 0.2 + i * 0.4; put(g, G.cushion(0.3, 0.12, 0.28, 0.02, 0.01, cols[(i + seed) % cols.length]), M.fabric, [bx, 1.925, 0]); }
  for (let i = 0; i < Math.floor(len / 0.32); i++) { const bx = -len / 2 + 0.16 + i * 0.32; const c = [COL.black, COL.white, 0x7a5a3a, COL.blush][(i + seed) % 4]; for (const s of [-1, 1]) put(g, G.cushion(0.085, 0.07, 0.25, 0.03, 0.01, c), M.satin, [bx + s * 0.05, 0.035, 0.05], [0, 0, 0]); }
}
export function dogBed(L, g, hex = COL.oat) { const { G, M, put } = L; put(g, G.torus(0.3, 0.09, hex, 8, 20), M.fabric, [0, 0.09, 0], [PI / 2, 0, 0]); put(g, G.cyl(0.3, 0.3, 0.06, hex, 20), M.fabric, [0, 0.04, 0]); }
export function dogBowls(L, g) { const { G, M, put } = L; put(g, G.rbox(0.45, 0.04, 0.22, 0.02, COL.walnut), M.satin, [0, 0.02, 0]); for (const s of [-1, 1]) { put(g, G.lathe([[0, 0], [0.08, 0], [0.1, 0.06], [0.095, 0.06], [0.075, 0.01], [0, 0.01]], 0xd8dadb, 14), M.metal, [s * 0.11, 0.04, 0]); } put(g, G.cyl(0.075, 0.075, 0.01, 0x8a5a2a, 12), M.matte, [-0.11, 0.06, 0]); }
export function robotVac(L, g) { const { G, M, put } = L; put(g, G.cyl(0.17, 0.17, 0.09, 0x1b1b1b, 24), M.gloss, [0, 0.045, 0]); put(g, G.cyl(0.04, 0.04, 0.012, 0x333333, 12), M.satin, [0, 0.095, -0.06]); put(g, G.box(0.03, 0.004, 0.01, 0x3dff7a), M.led, [0, 0.092, 0.08]); }
export function shelfUnit(L, g, w, h, d, n, hex = COL.white) { const { G, M, put } = L; for (const s of [-1, 1]) put(g, G.box(0.025, h, d, hex), M.satin, [s * (w / 2 - 0.0125), h / 2, 0], [0, 0, 0], true); for (let i = 0; i <= n; i++) put(g, G.box(w, 0.025, d, hex), M.satin, [0, 0.05 + i * (h - 0.08) / n, 0]); put(g, G.box(w, h, 0.01, hex), M.satin, [0, h / 2, -d / 2 + 0.005]); }
export function speakerWall(L, g) { const { G, M, put } = L; put(g, G.rbox(0.18, 0.28, 0.16, 0.02, 0x1a1a1a), M.satin, [0, 0, 0]); put(g, G.cyl(0.06, 0.06, 0.005, 0x333333, 14), M.matte, [0, -0.04, 0.081], [PI / 2, 0, 0]); put(g, G.box(0.04, 0.04, 0.12, 0x1a1a1a), M.satin, [0, 0, -0.12]); }
export function popcornMachine(L, g) { const { G, M, put } = L; put(g, G.box(0.45, 0.12, 0.35, 0xc0282a), M.gloss, [0, 0.06, 0]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, G.box(0.02, 0.5, 0.02, 0xc0282a), M.gloss, [sx * 0.215, 0.37, sz * 0.165]); put(g, G.box(0.41, 0.48, 0.31, 0xffffff), M.glass, [0, 0.36, 0]); put(g, G.box(0.47, 0.1, 0.37, 0xc0282a), M.gloss, [0, 0.67, 0]); put(g, G.rbox(0.39, 0.12, 0.29, 0.05, 0xfff1c9), M.matte, [0, 0.18, 0]); put(g, G.cyl(0.07, 0.06, 0.07, 0xb0b0b0, 12), M.metal, [0, 0.52, 0]); put(g, G.box(0.3, 0.04, 0.01, 0xfff1c9), M.led, [0, 0.67, 0.186]); }
