// Sports court (NE end of the lot): the tennis court in a bigger enclosure with a basketball court painted across
// it (2 hoops on the long fences) and a raised boxing ring at the canyon end; a gate + paver path from the turf strip
// (pool lawn side). Built once by src/rooms/site.js (static meshes, merged by kit.mergeStatic) — replaces the old
// site/court.js buildCourt (its materials + fenceLine are reused). Also a small shared "venue" UI kit for the three
// place games (src/games/tennis, basketball, boxing): join card, challenge / accept, banner, score bar, key chips.
import * as THREE from 'three';
import { G } from '../rooms/site/terrain.js';
import { fenceLine } from '../rooms/site/court.js';
import { chip, esc } from './ui.js';

// enclosure: x 23.6..46.0 (pad ends at 47), z -3.4 (street end) .. 40.3 (canyon end). Tennis court unchanged.
export const C2 = { cx: 34.1, cz: 14.5, hw: 10.97 / 2, hl: 23.77 / 2, sw: 8.23 / 2, ex0: 23.6, ex1: 46.0, ez0: -3.4, ez1: 40.3, y: G + 0.035 };
// basketball across the court: baselines on the long fences, hoops at z = BB.z
export const BB = { z: 6.5, x0: 24.0, x1: 45.6, rimY: G + 0.035 + 3.05, rimR: 0.2286, ballR: 0.12 };
BB.rims = [[BB.x0 + 1.2 + 0.15 + 0.375, BB.z, 1], [BB.x1 - 1.2 - 0.15 - 0.375, BB.z, -1]];   // [x, z, dir toward court]
BB.boards = [BB.x0 + 1.35, BB.x1 - 1.35];
BB.mid = (BB.x0 + BB.x1) / 2; BB.three = 6.0; BB.rack = [25.3, 13.0];
// boxing ring at the canyon end: platform 7 x 7, ropes square 6 x 6, floor height
export const RING = { cx: 40.4, cz: 34.6, half: 3.5, rope: 3.0, h: 0.95 }; RING.y = G + RING.h;
export const GATE = { x: C2.ex0, z0: 31.9, z1: 33.5 };

export function buildSportsCourt(kit, root, phys, M, ctx) {
  const C = C2, y = G; const { cx, cz, hw, hl, sw } = C;
  const O = (m) => kit.outdoor(m);
  const plane = (mat, x0, z0, x1, z1, yy) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4);
    const m = kit.add(root, g, mat, [(x0 + x1) / 2, yy, (z0 + z1) / 2], [0, 0, 0], { shadow: false }); m.receiveShadow = true; return m; };
  plane(M.green, C.ex0, C.ez0, C.ex1, C.ez1, y + 0.03);
  plane(M.blue, cx - hw, cz - hl, cx + hw, cz + hl, y + 0.034);
  // ---- tennis lines (ITF)
  const lines = []; const L = (x0, z0, x1, z1, yy = y + 0.037, arr = lines) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, yy, (z0 + z1) / 2); arr.push(g); };
  const svc = 6.40, lw = 0.05;
  L(cx - hw, cz - hl, cx + hw, cz - hl + 0.10); L(cx - hw, cz + hl - 0.10, cx + hw, cz + hl);
  L(cx - hw, cz - hl, cx - hw + lw, cz + hl); L(cx + hw - lw, cz - hl, cx + hw, cz + hl);
  L(cx - sw, cz - hl, cx - sw + lw, cz + hl); L(cx + sw - lw, cz - hl, cx + sw, cz + hl);
  L(cx - sw, cz - svc - lw / 2, cx + sw, cz - svc + lw / 2); L(cx - sw, cz + svc - lw / 2, cx + sw, cz + svc + lw / 2);
  L(cx - lw / 2, cz - svc, cx + lw / 2, cz + svc);
  L(cx - lw / 2, cz - hl, cx + lw / 2, cz - hl + 0.2); L(cx - lw / 2, cz + hl - 0.2, cx + lw / 2, cz + hl);
  const lm = kit.add(root, kit.mergeGeometries(lines), M.line, [0, 0, 0], [0, 0, 0], { shadow: false }); lm.receiveShadow = true;
  // ---- basketball lines (amber), keys tinted, 3-pt arcs, centre circle
  const bl = [], BY = y + 0.0385; const bz = BB.z, BW = 7.0;   // court half-width (z 0.5 .. 13.5 clipped to 12.5)
  const z0 = bz - 6.0, z1 = bz + 6.0;
  L(BB.x0 + 0.15, z0, BB.x1 - 0.15, z0 + lw, BY, bl); L(BB.x0 + 0.15, z1 - lw, BB.x1 - 0.15, z1, BY, bl);
  L(BB.x0 + 0.15, z0, BB.x0 + 0.15 + lw, z1, BY, bl); L(BB.x1 - 0.15 - lw, z0, BB.x1 - 0.15, z1, BY, bl);
  L(BB.mid - lw / 2, z0, BB.mid + lw / 2, z1, BY, bl);
  const arc = (x, z, r, a0, a1, arr = bl) => { const g = new THREE.RingGeometry(r - lw / 2, r + lw / 2, 48, 1, a0, a1 - a0).rotateX(-Math.PI / 2); g.translate(x, BY, z); arr.push(g); };
  arc(BB.mid, bz, 1.8, 0, Math.PI * 2);
  const keyFill = [];
  for (const [rx, rz, d] of BB.rims) {
    const bx = d > 0 ? BB.x0 + 0.15 : BB.x1 - 0.15; const ftx = bx + d * 5.8;
    L(Math.min(bx, ftx), rz - 2.45, Math.max(bx, ftx), rz - 2.45 + lw, BY, bl); L(Math.min(bx, ftx), rz + 2.45 - lw, Math.max(bx, ftx), rz + 2.45, BY, bl);
    L(ftx - lw / 2, rz - 2.45, ftx + lw / 2, rz + 2.45, BY, bl);
    { const g = new THREE.PlaneGeometry(5.8, 4.9).rotateX(-Math.PI / 2); g.translate((bx + ftx) / 2, BY - 0.0005, rz); keyFill.push(g); }
    arc(ftx, rz, 1.8, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5);
    // 3-pt: arc of BB.three around the rim (RingGeometry angle 0 = +x, rotated flat: +y -> -z)
    const ca = Math.acos(Math.min(1, 5.6 / BB.three)); const a0 = d > 0 ? -ca : Math.PI - ca; arc(rx, rz, BB.three, a0, a0 + 2 * ca);
    const ex = rx + d * Math.sqrt(BB.three * BB.three - 5.6 * 5.6);
    L(Math.min(bx, ex), rz - 5.6 - lw / 2, Math.max(bx, ex), rz - 5.6 + lw / 2, BY, bl); L(Math.min(bx, ex), rz + 5.6 - lw / 2, Math.max(bx, ex), rz + 5.6 + lw / 2, BY, bl);
  }
  const amber = O(new THREE.MeshStandardMaterial({ color: 0xe0a33a, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const keyM = O(new THREE.MeshStandardMaterial({ color: 0x5a2f26, roughness: 0.88, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  kit.add(root, kit.mergeGeometries(bl), amber, [0, 0, 0], [0, 0, 0], { shadow: false }).receiveShadow = true;
  kit.add(root, kit.mergeGeometries(keyFill), keyM, [0, 0, 0], [0, 0, 0], { shadow: false }).receiveShadow = true;

  // ---- tennis net (same as before)
  const px = hw + 0.914, NY0 = y + 0.035;
  for (const s of [-1, 1]) {
    kit.add(root, kit.cyl(0.04, 0.04, 1.10, 14), M.post, [cx + s * px, NY0 + 0.55, cz]);
    kit.add(root, kit.cyl(0.05, 0.05, 0.03, 14), M.post, [cx + s * px, NY0 + 1.11, cz]);
    phys.boxAABB([cx + s * px - 0.05, NY0, cz - 0.05], [cx + s * px + 0.05, NY0 + 1.1, cz + 0.05]);
  }
  const N = 40, sag = (t) => 1.07 - (1.07 - 0.914) * (1 - Math.pow(2 * t - 1, 2));
  const netG = new THREE.BufferGeometry(), tapeG = new THREE.BufferGeometry(); const np = [], nu = [], tp = [], ix = [];
  for (let i = 0; i <= N; i++) { const t = i / N, x = cx - px + 2 * px * t, top = NY0 + sag(t);
    np.push(x, NY0 + 0.04, cz, x, top, cz); nu.push(x / 0.045, 0.04 / 0.045, x / 0.045, (top - NY0) / 0.045); tp.push(x, top - 0.065, cz, x, top + 0.01, cz);
    if (i < N) { const b = i * 2; ix.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
  netG.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); netG.setAttribute('uv', new THREE.Float32BufferAttribute(nu, 2)); netG.setIndex(ix); netG.computeVertexNormals();
  tapeG.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tapeG.setIndex(ix.slice()); tapeG.computeVertexNormals();
  kit.add(root, netG, M.net, [0, 0, 0], [0, 0, 0], { shadow: false }); kit.add(root, tapeG, M.tape);
  kit.add(root, kit.box(0.05, 0.9, 0.012), M.tape, [cx, NY0 + 0.46, cz]);
  phys.boxAABB([cx - px, NY0, cz - 0.03], [cx + px, NY0 + 0.95, cz + 0.03]);

  // ---- fences: windscreen street end + NE side, chain-link canyon end + house side; gate (open) from the turf strip
  const FH = 3.1, SH = 3.6;
  fenceLine(kit, root, phys, M, [C.ex0, C.ez0], [C.ex1, C.ez0], SH, 'screen');
  fenceLine(kit, root, phys, M, [C.ex1, C.ez0], [C.ex1, C.ez1], SH, 'screen');
  fenceLine(kit, root, phys, M, [C.ex0, C.ez1], [C.ex1, C.ez1], FH, 'chain');
  fenceLine(kit, root, phys, M, [C.ex0, C.ez0], [C.ex0, 21.8], 2.6, 'chain', { spacing: 2.4 });
  fenceLine(kit, root, phys, M, [C.ex0, 21.8], [C.ex0, GATE.z0], FH, 'chain');
  fenceLine(kit, root, phys, M, [C.ex0, GATE.z1], [C.ex0, C.ez1], FH, 'chain');
  { // gate frame + an open leaf swung into the court (hinged at z1)
    for (const gz of [GATE.z0, GATE.z1]) kit.add(root, kit.cyl(0.045, 0.045, FH + 0.1, 10), M.post, [GATE.x, y + (FH + 0.1) / 2, gz]);
    kit.add(root, kit.cyl(0.03, 0.03, GATE.z1 - GATE.z0, 8).rotateX(Math.PI / 2), M.post, [GATE.x, y + 2.3, (GATE.z0 + GATE.z1) / 2]);
    const leaf = kit.group(root, [GATE.x + 0.05, y, GATE.z1], 0); leaf.rotation.y = -1.35; const LW = GATE.z1 - GATE.z0 - 0.08;
    for (const gy of [0.1, 1.05, 2.0]) kit.add(leaf, kit.cyl(0.02, 0.02, LW, 8).rotateX(Math.PI / 2), M.post, [0, gy, -LW / 2]);
    for (const gzz of [-0.02, -LW]) kit.add(leaf, kit.cyl(0.022, 0.022, 1.95, 8), M.post, [0, 1.05, gzz]);
    kit.add(leaf, new THREE.PlaneGeometry(LW, 1.9).rotateY(Math.PI / 2), M.chain, [0, 1.05, -LW / 2], [0, 0, 0], { shadow: false });
    // paver path: pool lawn -> along the strip -> through the gate onto the court surround
    const paver = O(new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.92 })); const pv = [];
    const stone = (x, z, w, d) => { const g = kit.rbox(w, 0.05, d, 0.02, 2); g.translate(x, y + 0.03, z); pv.push(g); };
    for (let z = 28.9; z < 32.4; z += 0.72) stone(22.0, z, 0.9, 0.55);
    for (let x = 22.0; x < 24.6; x += 0.72) stone(x, (GATE.z0 + GATE.z1) / 2, 0.55, 0.9);
    kit.add(root, kit.mergeGeometries(pv), paver, [0, 0, 0], [0, 0, 0], { shadow: false }).receiveShadow = true;
  }

  // ---- LED light poles (inside the west fence, outside the east fence)
  for (const z of [3.5, 10.5, 17.5, 24.5, 31.0]) for (const [x, s] of [[C.ex1 + 0.35, -1], [C.ex0 + 0.35, 1]]) {
    if (z === 31.0 && s < 0) continue;
    const PH = 6.0;
    kit.add(root, kit.cyl(0.055, 0.075, PH, 12), M.post, [x, y + PH / 2, z]);
    kit.add(root, kit.cyl(0.13, 0.15, 0.25, 12), M.post, [x, y + 0.125, z]);
    kit.add(root, kit.box(0.75, 0.06, 0.06), M.post, [x + s * 0.37, y + PH - 0.05, z]);
    const head = kit.group(root, [x + s * 0.85, y + PH - 0.08, z], 0); head.rotation.z = s * 0.12;
    kit.add(head, kit.rbox(0.62, 0.07, 0.36, 0.015), M.post, [0, 0, 0]);
    kit.add(head, kit.box(0.54, 0.01, 0.30), M.lamp, [0, -0.037, 0], [0, 0, 0], { shadow: false });
    phys.boxAABB([x - 0.08, y, z - 0.08], [x + 0.08, y + PH, z + 0.08]);
  }

  // ---- basketball hoops: stanchion, arm, glass board, orange rim (net mesh lives in the game, animated)
  const steel = O(new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.45, metalness: 0.6 }));
  const glass = O(new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
  const white = O(new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }));
  const orange = O(new THREE.MeshStandardMaterial({ color: 0xe0561c, roughness: 0.45, metalness: 0.4 }));
  const pad = O(new THREE.MeshStandardMaterial({ color: 0x1b3a7a, roughness: 0.8 }));
  for (let i = 0; i < 2; i++) {
    const [rx, rz, d] = BB.rims[i]; const bx = BB.boards[i]; const sx = bx - d * 1.15;
    kit.add(root, kit.box(0.18, 3.3, 0.18), steel, [sx, y + 1.65, rz]);
    kit.add(root, kit.box(0.5, 1.6, 0.5), pad, [sx, y + 0.8, rz]);
    kit.add(root, kit.box(1.15, 0.12, 0.12), steel, [sx + d * 0.55, y + 3.2, rz]);
    kit.add(root, kit.box(0.05, 1.05, 1.8), glass, [bx, BB.rimY + 0.75, rz], [0, 0, 0], { shadow: false });
    for (const [h, w, oy] of [[0.05, 1.8, 0.5], [0.05, 1.8, -0.5]]) kit.add(root, kit.box(0.06, h, w), white, [bx + d * 0.005, BB.rimY + 0.75 + oy, rz]);
    for (const oz of [-0.9, 0.9]) kit.add(root, kit.box(0.06, 1.05, 0.05), white, [bx + d * 0.005, BB.rimY + 0.75, rz + oz]);
    for (const [h, w, oy] of [[0.04, 0.59, 0.45], [0.04, 0.59, 0.0]]) kit.add(root, kit.box(0.06, h, w), white, [bx + d * 0.01, BB.rimY + oy + 0.05, rz]);
    for (const oz of [-0.285, 0.285]) kit.add(root, kit.box(0.06, 0.45, 0.04), white, [bx + d * 0.01, BB.rimY + 0.275, rz + oz]);
    kit.add(root, new THREE.TorusGeometry(BB.rimR, 0.009, 8, 32).rotateX(Math.PI / 2), orange, [rx, BB.rimY, rz]);
    kit.add(root, kit.box(0.16, 0.02, 0.12), orange, [bx + d * 0.09, BB.rimY - 0.01, rz]);
    phys.boxAABB([sx - 0.25, y, rz - 0.25], [sx + 0.25, y + 3.3, rz + 0.25]);
  }
  // ball rack (E: pick up a ball)
  { const [kx, kz] = BB.rack; const lb = O(new THREE.MeshStandardMaterial({ color: 0xc8611f, roughness: 0.75 }));
    for (const s of [-1, 1]) kit.add(root, kit.box(0.05, 0.9, 0.05), steel, [kx, y + 0.45, kz + s * 0.55]);
    for (const hh of [0.45, 0.85]) kit.add(root, kit.box(0.35, 0.03, 1.15), steel, [kx, y + hh, kz]);
    for (const [k, hh] of [[-0.3, 0.6], [0, 0.6], [0.3, 0.6], [-0.15, 1.0], [0.15, 1.0]]) kit.add(root, kit.sphere(BB.ballR, 16, 12), lb, [kx, y + hh, kz + k]);
    phys.boxAABB([kx - 0.2, y, kz - 0.6], [kx + 0.2, y + 1.0, kz + 0.6]); }

  // ---- boxing ring: skirted platform, canvas, padded corner posts (red / blue / white), 3 ropes, steps, stools
  { const R = RING; const top = R.y; const h = R.half, rh = R.rope;
    const skirt = O(new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.8 }));
    const canvas = O(new THREE.MeshStandardMaterial({ color: 0x2a4f8f, roughness: 0.92, map: M.blue.map || null }));
    const apron = O(new THREE.MeshStandardMaterial({ color: 0x6d717a, roughness: 0.9 }));
    kit.add(root, kit.box(2 * h, R.h - 0.06, 2 * h), skirt, [R.cx, G + (R.h - 0.06) / 2, R.cz]);
    kit.add(root, kit.box(2 * h, 0.06, 2 * h), apron, [R.cx, top - 0.03, R.cz]);
    kit.add(root, kit.box(2 * rh, 0.012, 2 * rh), canvas, [R.cx, top + 0.006, R.cz], [0, 0, 0], { shadow: false }).receiveShadow = true;
    phys.boxAABB([R.cx - h, G, R.cz - h], [R.cx + h, top, R.cz + h]);
    const padM = [0xb3201f, 0xf2f2ee, 0x1d4fb5, 0xf2f2ee].map(c => O(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })));
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    corners.forEach(([sx, sz], i) => { const x = R.cx + sx * rh, z = R.cz + sz * rh;
      kit.add(root, kit.cyl(0.06, 0.06, 1.55, 12), steel, [x, top + 0.75, z]);
      kit.add(root, kit.rbox(0.24, 1.15, 0.24, 0.06, 3), padM[i], [x, top + 0.82, z]);
      phys.boxAABB([x - 0.14, top, z - 0.14], [x + 0.14, top + 1.5, z + 0.14]); });
    const ropeM = [0xc0262b, 0xf0f0ec, 0x1f52b8].map(c => O(new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })));
    [0.45, 0.8, 1.15].forEach((ry, k) => { for (let i = 0; i < 4; i++) { const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      kit.add(root, kit.tube([[R.cx + ax * rh, top + ry, R.cz + az * rh], [R.cx + (ax + bx) / 2 * rh, top + ry - 0.04, R.cz + (az + bz) / 2 * rh], [R.cx + bx * rh, top + ry, R.cz + bz * rh]], 0.022, 16), ropeM[k]); } });
    // rope colliders (keep fighters + walkers inside / outside)
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[-1, 1], [1, 1]]]) phys.boxAABB([R.cx + Math.min(a[0], b[0]) * rh - 0.04, top, R.cz + Math.min(a[1], b[1]) * rh - 0.04], [R.cx + Math.max(a[0], b[0]) * rh + 0.04, top + 1.2, R.cz + Math.max(a[1], b[1]) * rh + 0.04]);
    // steps on the west side (toward the court), turnbuckle gap: west ropes have no collider so you can climb in
    const wood = O(new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6, metalness: 0.3 }));
    const nS = 4, sh = R.h / nS;
    for (let k = 0; k < nS; k++) { const hgt = sh * (k + 1), w = 0.36; const x = R.cx - h - (nS - k) * w + w / 2;
      kit.add(root, kit.box(w, hgt, 1.2), wood, [x, G + hgt / 2, R.cz]); phys.boxAABB([x - w / 2, G, R.cz - 0.6], [x + w / 2, G + hgt, R.cz + 0.6]); }
    // stools in the red + blue corners (on the apron)
    const stoolM = O(new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.5, metalness: 0.4 }));
    for (const [sx, sz] of [[-1, -1], [1, 1]]) { const x = R.cx + sx * (rh - 0.45), z = R.cz + sz * (rh - 0.45);
      kit.add(root, kit.cyl(0.19, 0.19, 0.06, 16), sx < 0 ? padM[0] : padM[2], [x, top + 0.6, z]);
      for (const a of [0, 2.1, 4.2]) kit.add(root, kit.cyl(0.015, 0.02, 0.6, 6), stoolM, [x + Math.cos(a) * 0.13, top + 0.3, z + Math.sin(a) * 0.13]); }
    // bell table + judges' bench beside the ring
    kit.add(root, kit.box(1.6, 0.75, 0.6), skirt, [R.cx, G + 0.375, R.cz - h - 0.9]);
    kit.add(root, kit.cyl(0.12, 0.14, 0.08, 16).rotateX(Math.PI / 2), O(new THREE.MeshStandardMaterial({ color: 0xc9a34a, roughness: 0.3, metalness: 0.9 })), [R.cx + 0.4, G + 0.82, R.cz - h - 0.9]);
    phys.boxAABB([R.cx - 0.8, G, R.cz - h - 1.2], [R.cx + 0.8, G + 0.75, R.cz - h - 0.6]);
  }
}

// ---------------------------------------------------------------- shared venue UI (join card / challenge / banner / score bar / keys)
const VCSS = `
.cv-score { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 9; display: flex; align-items: stretch; pointer-events: none;
  background: var(--surf); border: var(--hair); border-radius: 6px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); overflow: hidden; }
.cv-score.pg-stage { transform: translate(-50%, -6px); } .cv-score.pg-stage.on { transform: translate(-50%, 0); }
.cv-side { display: flex; align-items: center; gap: 10px; padding: 8px 14px; min-width: 170px; }
.cv-side.r { flex-direction: row-reverse; text-align: right; }
.cv-side .nm { font-size: 15px; font-weight: 500; letter-spacing: -0.03em; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.cv-side .sc { font: 500 30px/1 "Geist", -apple-system, Inter, sans-serif; letter-spacing: -0.06em; min-width: 40px; text-align: center; }
.cv-side .sub { font: 600 11px/1.3 var(--mono); color: var(--tx2); }
.cv-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid rgba(247,247,247,.15); flex: none; }
.cv-dot.on { background: #f2c84b; border-color: #f2c84b; box-shadow: 0 0 8px rgba(242,200,75,.55); }
.cv-mid { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 6px 10px; background: var(--bg); border-left: var(--hair); border-right: var(--hair); }
.cv-ban { position: fixed; left: 50%; top: 28%; translate: -50% 0; z-index: 56; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 24px 12px;
  background: rgba(30,30,30,.86); border: var(--hair); border-radius: 6px; box-shadow: 0 24px 60px rgba(0,0,0,.4); }
.cv-ban .big { font: 500 54px/1 "Geist", -apple-system, Inter, sans-serif; letter-spacing: -0.06em; }
.cv-keys { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 9; display: flex; gap: 6px; pointer-events: none; flex-wrap: wrap; justify-content: center; }
.cv-bar { width: 150px; height: 8px; border-radius: 2px; background: #1a1a1a; border: var(--hair); overflow: hidden; } .cv-bar i { display: block; height: 100%; background: #f2c84b; transition: width .12s linear; }
.cv-bar.hp i { background: #e4573d; } .cv-bar.st i { background: #5aa0e8; }
.cv-meter { position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%); z-index: 9; width: 260px; display: flex; flex-direction: column; gap: 5px; align-items: center; pointer-events: none; }
.cv-meter .cv-bar { width: 260px; height: 12px; position: relative; } .cv-meter .zone { position: absolute; top: 0; bottom: 0; background: rgba(120,220,120,.35); }
`;
export function venue(ctx, mp, hub, { chan, title, place }) {
  const ui = hub.ui; const ch = mp?.channel ? mp.channel(chan) : { send() {}, onMessage: null };
  const me = () => mp?.net?.selfId || 'local'; const peers = () => mp?.peers || new Map();
  const names = {}; const nameOf = (id) => (id === 'bot' ? 'Bot' : id === me() ? (mp?.selfName?.() || 'You') : peers().get(id)?.name || names[id] || 'Guest');
  const send = (m, to) => { try { ch.send(m, to); } catch {} };
  if (!document.getElementById('cv-css')) { const s = document.createElement('style'); s.id = 'cv-css'; s.textContent = VCSS; document.head.appendChild(s); }
  const root = document.getElementById('pg');
  const el = (html, inert) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstChild; root.appendChild(n); if (inert) n.style.pointerEvents = 'none'; else { n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('click', e => e.stopPropagation()); } return n; };
  const SCORE = el('<div class="cv-score pg-stage"><div class="cv-side"></div><div class="cv-mid"></div><div class="cv-side r"></div></div>', true);
  const BAN = el('<div class="cv-ban pg-stage"><div class="big"></div><div class="sub"></div></div>', true);
  const KEYS = el('<div class="cv-keys pg-stage"></div>', true);
  const JOIN = el(`<div class="pp-card pg-stage" role="dialog" aria-label="${esc(title)}"></div>`);
  const WIN = el(`<div class="pp-card pg-stage" role="dialog" aria-label="${esc(title)} result"></div>`);
  const CHAL = el('<div class="pp-card pg-stage" role="status" style="top:auto;bottom:74px;translate:-50% 0;display:flex;align-items:center;gap:12px;padding:12px 14px"><span class="pg-dot"></span><div style="flex:1;min-width:0"><div class="pg-inv-title"></div></div><button type="button" class="pri" data-y="1">Accept</button><button type="button" data-n="1">Decline</button></div>');
  let banT = 0; const banner = (big, sub, ms = 1500) => { ui.roll(BAN.children[0], String(big)); ui.setHtml(BAN.children[1], sub || ''); ui.show(BAN, true); clearTimeout(banT); banT = setTimeout(() => ui.show(BAN, false), ms); };
  const V = { ch, send, me, peers, nameOf, names, ui, el, SCORE, BAN, KEYS, JOIN, WIN, banner, joinOpen: false, onAccept: null, onJoin: null, chalFrom: null };
  V.score = (left, mid, right) => { ui.setHtml(SCORE.children[0], left); ui.setHtml(SCORE.children[1], mid); ui.setHtml(SCORE.children[2], right); };
  V.side = (name, sc, sub = '', dot = false) => `<span class="cv-dot${dot ? ' on' : ''}"></span><span style="display:flex;flex-direction:column;gap:3px"><span class="nm">${esc(name)}</span>${sub}</span><span class="sc">${esc(String(sc))}</span>`;
  V.keys = (list, locked = !!document.pointerLockElement) => ui.setHtml(KEYS, (locked ? '' : chip('CLICK', 'TAKE THE MOUSE', 'role')) + list.map(([a, b]) => chip(a, b, 'alt')).join(''));
  // join card: opts = [{ a, label, sub, pri, disabled }]; challenge list of online players
  V.openJoin = (opts, how) => {
    const others = [...(mp?.members || [])].filter(id => peers().get(id));
    JOIN.innerHTML = `<div class="mono">${chip('VENUE', place)} ${chip('COURT', 'OPEN', 'alt')}</div><h2></h2>
      <div class="pp-opts">${opts.map(o => `<button type="button" class="pp-opt ${o.pri ? 'pri' : ''}" data-a="${o.a}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}<span>${esc(o.sub || '')}</span></button>`).join('')}</div>
      <div class="pp-list">${others.length ? others.map(id => `<div class="pp-row"><span class="n">${esc(nameOf(id))}</span><button type="button" data-c="${esc(id)}">Challenge</button></div>`).join('') : '<div class="pp-row"><span class="n mono k">NOBODY ELSE ONLINE</span></div>'}</div>
      <div class="pp-foot"><span class="mono"><span class="k">HOW::</span><span class="v">${esc(how)}</span></span><button type="button" data-a="close">Close <kbd>Esc</kbd></button></div>`;
    ui.roll(JOIN.querySelector('h2'), title); ui.show(JOIN, true); V.joinOpen = true; document.body.classList.add('ui-open');
    ctx.player.state.keys.clear(); try { document.exitPointerLock?.(); } catch {}
  };
  V.closeJoin = () => { if (!V.joinOpen) return; V.joinOpen = false; ui.show(JOIN, false); document.body.classList.remove('ui-open'); };
  V.challenge = (id) => { send({ k: 'chal', to: id }, id); ui.toast(`Challenge sent to ${nameOf(id)}`); V.closeJoin(); };
  JOIN.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.dataset.a === 'close') return V.closeJoin(); if (b.dataset.c) return V.challenge(b.dataset.c); V.closeJoin(); V.onJoin?.(b.dataset.a); });
  addEventListener('keydown', (e) => { if (V.joinOpen && e.code === 'Escape') { e.preventDefault(); V.closeJoin(); } });
  let chalT = 0;
  V.showChallenge = (from) => { V.chalFrom = from; ui.setHtml(CHAL.querySelector('.pg-inv-title'), `<b>${esc(nameOf(from))}</b> challenged you to <b>${esc(title.toUpperCase())}</b>`); ui.show(CHAL, true); clearTimeout(chalT); chalT = setTimeout(() => ui.show(CHAL, false), 20000); };
  V.accept = () => { if (!V.chalFrom) return false; const f = V.chalFrom; V.chalFrom = null; ui.show(CHAL, false); V.onAccept?.(f); return true; };
  CHAL.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.y) V.accept(); else { V.chalFrom = null; ui.show(CHAL, false); } });
  V.showWin = (head, chips, rows, onRe, onX) => {
    WIN.innerHTML = `<div class="mono">${chips}</div><h2></h2><div class="pp-list">${rows.map(([n, v, w]) => `<div class="pp-row"><span class="n" style="${w ? 'color:var(--acc)' : ''}">${esc(n)}</span><span class="mono v">${esc(String(v))}</span></div>`).join('')}</div>
      <div class="pp-foot"><span></span><span>${onRe ? '<button type="button" class="pri" data-a="re">Rematch</button> ' : ''}<button type="button" data-a="x">Close</button></span></div>`;
    ui.show(WIN, true); ui.roll(WIN.querySelector('h2'), head); WIN.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ui.show(WIN, false); if (b.dataset.a === 're') onRe?.(); else onX?.(); };
    try { document.exitPointerLock?.(); } catch {}
  };
  V.hideHud = () => { ui.show(SCORE, false); ui.show(KEYS, false); };
  // place the local player without resetting anything else (frozen controller; the game drives position)
  V.place = (x, y, z, yaw) => { const p = ctx.player; const st = p.state; const b = p.body; const t = b.translation(); const dy = t.y - st.pos.y;
    b.setTranslation({ x, y: y + dy, z }, true); b.setNextKinematicTranslation?.({ x, y: y + dy, z }); st.pos.set(x, y, z); st.vel?.set(0, 0, 0); if (yaw !== undefined) { st.yaw = yaw; st.facing = yaw; } };
  return V;
}

// lazily-built stand-in avatar for bots (one per game, created on first use)
export async function botAvatar(ctx, hue, name) { const { createAvatar } = await import('../avatar.js'); const cr = createAvatar(ctx, { hue, name, local: false, seed: 7 }); return cr; }
