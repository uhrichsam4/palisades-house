// Party decor: cash everywhere (instanced banded stacks on tables / counters / beds, open briefcases, a cash
// mountain by the dining room, cash pallets in the garage, gold bars, loose notes on the floors), the never-ending
// money rain over the pool deck, gold + black balloons, string lights over the deck, LED uplights, a rotating
// disco ball with moving sparkles (family room), a DJ booth on the lawn, champagne tower (kitchen sink island),
// red carpet + ropes + VIP neon at the front door, gold pool floats, confetti.
// No lights: emissive + bloom only. Repeats are InstancedMesh; the rest is merged (kit.mergeStatic on our root).
import * as THREE from 'three';
import { waterBodies } from '../water/index.js';
import { makeStackGeometry, makeStackMaterial, makeBillGeometry, looseBillMaterial, STACK } from './money.js';
import { dotTexture, washTexture } from './tex.js';

const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const R = (a, b) => a + (b - a) * rnd();

export async function buildDecor(ctx, money) {
  const { scene, phys, kit } = ctx; const RAP = phys.RAPIER;
  const root = new THREE.Group(); root.name = 'party:decor'; scene.add(root);
  const anim = new THREE.Group(); anim.name = 'party:anim'; anim.userData.keep = true; root.add(anim);
  const updates = [];

  // ---------------------------------------------------------------- surfaces (Rapier ray down, fixed only)
  const ray = new RAP.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FL = RAP.QueryFilterFlags.EXCLUDE_KINEMATIC | RAP.QueryFilterFlags.EXCLUDE_DYNAMIC | RAP.QueryFilterFlags.EXCLUDE_SENSORS;
  const surf = (x, z, from = 2.4, dflt = 0) => { ray.origin.x = x; ray.origin.y = from; ray.origin.z = z; ray.dir.y = -1; const h = phys.world.castRay(ray, 6, true, FL); return h ? from - h.timeOfImpact : dflt; };
  const up = (x, y, z, dflt = 3) => { ray.origin.x = x; ray.origin.y = y; ray.origin.z = z; ray.dir.y = 1; const h = phys.world.castRay(ray, 8, true, FL); ray.dir.y = -1; return h ? y + h.timeOfImpact : dflt; };

  // ---------------------------------------------------------------- materials
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const gold = std({ color: 0xf0c45a, metalness: 1, roughness: 0.2 });
  const goldOut = kit.outdoor(std({ color: 0xf0c45a, metalness: 1, roughness: 0.22 }));
  const black = std({ color: 0x111111, metalness: 0.4, roughness: 0.18 });
  const blackMatte = std({ color: 0x141414, roughness: 0.6, metalness: 0.2 });
  const alu = std({ color: 0xc9ccd0, metalness: 1, roughness: 0.3 });
  const chrome = std({ color: 0xe6e8ea, metalness: 1, roughness: 0.08 });
  const lining = std({ color: 0x1b1b1d, roughness: 0.95 });
  const glow = (c, i) => { const m = std({ color: 0x000000, emissive: c, emissiveIntensity: i, roughness: 0.4 }); m.userData.noDedupe = true; return m; };

  // ---------------------------------------------------------------- cash stacks (one InstancedMesh for the house)
  const stackXf = []; // Matrix4s
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const addStack = (x, y, z, ry = 0, rx = 0, rz = 0, sc = 1) => { _e.set(rx, ry, rz); _q.setFromEuler(_e); stackXf.push(new THREE.Matrix4().compose(_p.set(x, y + STACK.h / 2 * sc, z), _q, _s.set(sc, sc, sc))); };
  // neat block of stacks centred at (x,z) on surface y, rotated ry: nx along length, nz across, ny layers
  const block = (x, y, z, ry, nx, nz, ny, mess = 0.02) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (k === ny - 1 && rnd() < 0.25) continue;
      const lx = (i - (nx - 1) / 2) * (STACK.l + 0.004), lz = (j - (nz - 1) / 2) * (STACK.w + 0.004);
      addStack(x + lx * c + lz * s + R(-mess, mess), y + k * STACK.h, z - lx * s + lz * c + R(-mess, mess), ry + R(-0.06, 0.06));
    }
  };
  const fan = (x, y, z, n, r = 0.18) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * r; addStack(x + Math.cos(a) * d, y + (rnd() < 0.3 ? STACK.h : 0), z + Math.sin(a) * d, rnd() * 6.28); } };

  // loose notes (flat, scattered)
  const looseXf = [];
  const addLoose = (x, y, z, tilt = 0.04) => { _e.set(R(-tilt, tilt), rnd() * 6.28, R(-tilt, tilt)); _q.setFromEuler(_e); looseXf.push(new THREE.Matrix4().compose(_p.set(x, y + 0.003, z), _q, _s.set(1, 1, 1))); };
  const scatterFloor = (rect, n, fy) => { const [x0, z0, x1, z1] = rect; let placed = 0; for (let t = 0; t < n * 3 && placed < n; t++) { const x = R(x0 + 0.2, x1 - 0.2), z = R(z0 + 0.2, z1 - 0.2); const y = surf(x, z, fy + 0.25, null); if (y === null || y > fy + 0.06) continue; addLoose(x, y, z); placed++; } };

  // ---------------------------------------------------------------- 1. tables / counters / beds
  const P = ctx.plan; const L1 = P.LEVELS[1].floor;
  // family coffee table (4.80, 17.15), long axis along z
  { const y = surf(4.80, 17.15, 1.2); block(4.80, y, 16.85, Math.PI / 2, 3, 2, 3); fan(4.75, y, 17.55, 6, 0.12); }
  { const y = surf(6.58, 15.39, 1.2); block(6.58, y, 15.39, 0.4, 2, 2, 2); }
  // living coffee table (4.45, 10.58): open briefcase + stacks
  const yLiv = surf(4.45, 10.58, 1.2);
  // dining table (12.5, 16.1) ry .45: stacks down the centre
  const yDin = surf(12.5, 16.1, 1.5);
  { const ry = 0.45, c = Math.cos(ry), s = Math.sin(ry); for (const d of [-0.95, 0.95]) block(12.5 + d * c, yDin, 16.1 - d * s, ry, 2, 3, 2); }
  // kitchen islands: bar island x 16.25-17.17 z 15.25-18.45 (speaker at z 17.4), sink island x 18.25-19.45 z 14.9-18
  { const y = surf(16.71, 16.1, 1.6); block(16.71, y, 16.15, Math.PI / 2, 2, 3, 3); }
  const ySink = surf(18.85, 15.5, 1.6);
  { block(18.85, ySink, 17.55, 0.2, 2, 2, 2); }
  // beds (upstairs): primary (head at x 15.39, z 14.72), bed A (15.60, 3.22), bed B (22.80, 3.12)
  for (const [x, z] of [[14.1, 14.72], [14.4, 3.22], [21.6, 3.12]]) { const y = surf(x, z, L1 + 1.4, L1 + 0.6); if (y > L1 + 0.3 && y < L1 + 1.0) { fan(x, y, z, 14, 0.4); block(x - 0.25, y, z + 0.3, 0.6, 2, 2, 1); } }
  // pool lounge coffee table (9.75, 25.8)
  { const y = surf(9.75, 25.8, 1.0, 0.2); block(9.75, y, 25.8, 0.1, 3, 2, 2); }

  // ---------------------------------------------------------------- 2. briefcases (open, full of cash)
  const caseG = new THREE.Group(); caseG.name = 'party:cases'; root.add(caseG);
  function briefcase(x, y, z, ry) {
    const g = kit.group(caseG, [x, y, z], ry); const W = 0.48, D = 0.34, H = 0.1, T = 0.008;
    kit.add(g, kit.rbox(W, 0.012, D, 0.004), alu, [0, 0.006, 0]);
    kit.add(g, kit.box(W, H, T), alu, [0, H / 2, D / 2 - T / 2]); kit.add(g, kit.box(W, H, T), alu, [0, H / 2, -D / 2 + T / 2]);
    kit.add(g, kit.box(T, H, D), alu, [W / 2 - T / 2, H / 2, 0]); kit.add(g, kit.box(T, H, D), alu, [-W / 2 + T / 2, H / 2, 0]);
    kit.add(g, kit.rbox(0.12, 0.022, 0.02, 0.008), blackMatte, [0, H * 0.6, D / 2 + 0.012]);
    const lid = kit.group(g, [0, H, -D / 2]); lid.rotation.x = -1.85; // hinged open at the back
    kit.add(lid, kit.rbox(W, 0.05, D, 0.008), alu, [0, 0.025, D / 2]); kit.add(lid, kit.box(W - 0.02, 0.004, D - 0.02), lining, [0, -0.002, D / 2]);
    for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      const lx = (i - 1) * (STACK.l + 0.002), lz = (j - 1.5) * (STACK.w + 0.006); const c = Math.cos(ry), s = Math.sin(ry);
      addStack(x + lx * c + lz * s, y + 0.012 + k * STACK.h, z - lx * s + lz * c, ry);
    }
    return g;
  }
  briefcase(4.45, yLiv, 10.58, Math.PI / 2 + 0.15);
  block(4.45, yLiv, 10.05, 0.3, 2, 2, 2);
  briefcase(12.5 - 0.1, yDin, 16.1 + 0.05, 0.45 + Math.PI);
  { const y = surf(14.1, 14.72, L1 + 1.4, L1 + 0.6); if (y > L1 + 0.3 && y < L1 + 1.0) briefcase(13.8, y, 15.25, -0.6); }

  // ---------------------------------------------------------------- 3. cash mountain (dining / family corner) + garage pallets
  const MT = { x: 9.35, z: 15.6, r: 0.72, h: 0.85 };
  { const fy = surf(MT.x, MT.z, 1.0);
    for (let k = 0; k < 26; k++) {
      const hy = k * STACK.h * 0.85, rr = MT.r * (1 - hy / MT.h); if (rr < 0.04) break;
      const n = Math.max(1, Math.round((Math.PI * rr * rr) / (STACK.l * STACK.w) * (k === 0 ? 0.9 : 0.55)));
      for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rr; addStack(MT.x + Math.cos(a) * d, fy + hy, MT.z + Math.sin(a) * d, rnd() * 6.28, R(-0.12, 0.12), R(-0.12, 0.12)); }
    }
    for (let i = 0; i < 60; i++) { const a = rnd() * 6.28, d = MT.r + R(0, 0.6); addLoose(MT.x + Math.cos(a) * d, fy, MT.z + Math.sin(a) * d); }
    phys.boxAABB([MT.x - MT.r * 0.75, fy, MT.z - MT.r * 0.75], [MT.x + MT.r * 0.75, fy + MT.h * 0.7, MT.z + MT.r * 0.75]);
  }
  // garage: two shrink-wrapped cash pallets (stacks on a wood pallet)
  { const pal = std({ color: 0x9c7a52, roughness: 0.9 }); const gy = surf(15.0, 3.0, 2.0);
    for (const [x, z] of [[14.3, 4.6], [15.8, 4.6]]) {
      kit.add(root, kit.box(1.2, 0.14, 1.0), pal, [x, gy + 0.07, z]);
      for (let k = 0; k < 9; k++) for (let i = 0; i < 7; i++) for (let j = 0; j < 14; j++) {
        const outer = i === 0 || i === 6 || j === 0 || j === 13 || k === 8; if (!outer) continue; // hidden core skipped
        addStack(x + (i - 3) * 0.158, gy + 0.14 + k * STACK.h, z + (j - 6.5) * 0.068, 0);
      }
      phys.boxAABB([x - 0.6, gy, z - 0.5], [x + 0.6, gy + 0.14 + 9 * STACK.h, z + 0.5]);
    }
  }

  // ---------------------------------------------------------------- 4. gold bars (pyramids)
  const barXf = [];
  const barGeo = (() => { const g = new THREE.BoxGeometry(0.17, 0.045, 0.075); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.82); p.setZ(i, p.getZ(i) * 0.72); } g.computeVertexNormals(); return g; })();
  const barPyramid = (x, y, z, ry, n = 4) => { const c = Math.cos(ry), s = Math.sin(ry); for (let k = 0; k < n; k++) for (let i = 0; i < n - k; i++) { const lz = (i - (n - k - 1) / 2) * 0.08; _e.set(0, ry, 0); _q.setFromEuler(_e); barXf.push(new THREE.Matrix4().compose(_p.set(x + lz * s, y + 0.0225 + k * 0.046, z + lz * c), _q, _s.set(1, 1, 1))); } };
  { const y = surf(4.80, 17.15, 1.2); barPyramid(4.85, y, 17.6, 0, 3); }
  barPyramid(4.1, yLiv, 10.95, 0.2, 3);
  barPyramid(12.5, yDin, 16.1, 0.45, 4);
  barPyramid(MT.x + 0.1, surf(MT.x, MT.z, 1.0) + MT.h * 0.78, MT.z, 0.3, 2);

  // ---------------------------------------------------------------- 5. loose notes on floors + confetti
  const fam = P.ROOMS.family.rect, liv = P.ROOMS.living.rect, din = P.ROOMS.dining.rect, kit0 = P.ROOMS.kitchen.rect, foy = P.ROOMS.foyer.rect;
  scatterFloor(fam, 70, 0); scatterFloor(liv, 45, 0); scatterFloor(din, 55, 0); scatterFloor([15.6, 13.5, 21.2, 21.2], 40, 0); scatterFloor(foy, 25, 0);
  const confXf = [], confCol = [];
  const CONF = [0xf2c84b, 0xd4a83a, 0x151515, 0xf5f5f5, 0xc0c4c8];
  const confetti = (rect, n, fy) => { const [x0, z0, x1, z1] = rect; for (let t = 0; t < n; t++) { const x = R(x0 + 0.1, x1 - 0.1), z = R(z0 + 0.1, z1 - 0.1); _e.set(R(-0.2, 0.2), rnd() * 6.28, R(-0.2, 0.2)); _q.setFromEuler(_e); confXf.push(new THREE.Matrix4().compose(_p.set(x, fy + 0.004, z), _q, _s.set(1, 1, 1))); confCol.push(CONF[(rnd() * CONF.length) | 0]); } };
  const fyAt = (r) => surf((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, 0.3, 0);
  confetti(fam, 500, 0.0); confetti(liv, 350, 0.0); confetti(din, 350, 0.0); confetti(foy, 200, 0.0);

  // ---------------------------------------------------------------- 6. balloons (gold + black clusters, a few helium ones)
  const balXf = [[], []];
  const balGeo = (() => { const s = new THREE.SphereGeometry(0.15, 18, 12); s.scale(1, 1.18, 1); const k = new THREE.ConeGeometry(0.018, 0.035, 8); k.rotateX(Math.PI); k.translate(0, -0.19, 0); return kit.mergeGeometries([s.toNonIndexed(), k.toNonIndexed()]); })();
  const cluster = (x, y, z, n, spread = 0.28, h = 0.3) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * spread; const sc = R(0.75, 1.15); _e.set(R(-0.3, 0.3), rnd() * 6.28, R(-0.3, 0.3)); _q.setFromEuler(_e); balXf[i % 3 === 0 ? 1 : 0].push(new THREE.Matrix4().compose(_p.set(x + Math.cos(a) * d, y + 0.17 * sc + rnd() * h, z + Math.sin(a) * d), _q, _s.set(sc, sc, sc))); } };
  const column = (x, y, z, hgt) => { for (let k = 0; k < hgt / 0.24; k++) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + k * 0.6; const sc = 0.85; _e.set(0, a, 0); _q.setFromEuler(_e); balXf[(k + i) % 2].push(new THREE.Matrix4().compose(_p.set(x + Math.cos(a) * 0.15, y + 0.15 + k * 0.24, z + Math.sin(a) * 0.15), _q, _s.set(sc, sc, sc))); } };
  cluster(2.95, 0, 19.75, 14); cluster(8.0, 0, 13.9, 10); cluster(7.85, 0, 7.65, 12); cluster(0.95, 0, 13.0, 10);
  cluster(15.1, 0, 13.85, 10); cluster(21.1, 0, 21.0, 9); cluster(MT.x - 0.85, 0, MT.z - 0.7, 8);
  // front door balloon columns (entry door x 9.0-10.6 on z 4.43)
  column(8.75, 0, 4.15, 2.6); column(10.9, 0, 4.15, 2.6);
  // helium balloons drifting under the family-room vault, strings hanging
  const heli = []; const famTop = up(5.0, 1.6, 17.0, 3.2);
  for (let i = 0; i < 9; i++) heli.push({ x: R(3.4, 7.6), z: R(14.3, 19.4), y: Math.min(famTop - 0.35, R(2.5, 3.3)), ph: rnd() * 6.28, c: i % 3 === 0 ? 1 : 0 });
  for (let i = 0; i < 5; i++) heli.push({ x: R(9.5, 15), z: R(19.2, 22.2), y: R(2.4, 3.2), ph: rnd() * 6.28, c: i % 2 }); // deck
  const heliMesh = [gold, black].map((m) => { const im = new THREE.InstancedMesh(balGeo, m, heli.length); im.count = 0; im.frustumCulled = false; im.userData.keep = true; anim.add(im); return im; });
  const strPos = new Float32Array(heli.length * 6); const strGeo = new THREE.BufferGeometry(); strGeo.setAttribute('position', new THREE.BufferAttribute(strPos, 3));
  const strings = new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: 0xd9c38a, transparent: true, opacity: 0.7 })); strings.frustumCulled = false; anim.add(strings);
  const heliIdx = heli.map(h => { const im = heliMesh[h.c]; return im.count++; });
  updates.push((dt, t) => {
    heli.forEach((h, k) => {
      const y = h.y + Math.sin(t * 0.7 + h.ph) * 0.05, x = h.x + Math.sin(t * 0.31 + h.ph) * 0.06, z = h.z + Math.cos(t * 0.27 + h.ph) * 0.06;
      _e.set(Math.sin(t * 0.5 + h.ph) * 0.12, h.ph, 0); _q.setFromEuler(_e); heliMesh[h.c].setMatrixAt(heliIdx[k], new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)));
      strPos.set([x, y - 0.21, z, x + Math.sin(t * 0.9 + h.ph) * 0.05, y - 1.3, z], k * 6);
    });
    heliMesh[0].instanceMatrix.needsUpdate = heliMesh[1].instanceMatrix.needsUpdate = true; strGeo.attributes.position.needsUpdate = true;
  });

  // ---------------------------------------------------------------- 7. string lights over the pool deck (catenaries)
  const DECK = -0.10;
  const wires = [];
  const poles = [[2.2, 28.7], [17.3, 28.7], [22.8, 28.7]];
  const anchors = { a: [[5.0, 20.35], [11.0, 18.45], [8.6, 18.45]], b: [[9.4, 18.45], [14.6, 18.45], [19.0, 21.7]], c: [[16.6, 21.7], [21.0, 21.7]] };
  [['a', 0], ['b', 1], ['c', 2]].forEach(([k, pi]) => { for (const an of anchors[k]) wires.push([[poles[pi][0], 3.25, poles[pi][1]], [an[0], 2.85, an[1]]]); });
  wires.push([[2.2, 3.25, 28.7], [17.3, 3.25, 28.7]]);
  const bulbXf = [], wireGeos = [];
  for (const [a, b] of wires) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), sag = 0.05 * L; const N = Math.max(4, Math.round(L / 0.5)); const pts = [];
    for (let i = 0; i <= N; i++) { const f = i / N; const p = new THREE.Vector3(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 4 * sag * f * (1 - f), a[2] + (b[2] - a[2]) * f); pts.push(p); if (i > 0 && i < N) bulbXf.push(new THREE.Matrix4().makeTranslation(p.x, p.y - 0.06, p.z)); }
    wireGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, 0.006, 4, false));
  }
  kit.add(root, kit.mergeGeometries(wireGeos), blackMatte, [0, 0, 0], [0, 0, 0], { shadow: false });
  for (const [x, z] of poles) kit.add(root, kit.cyl(0.035, 0.045, 3.35 - DECK, 10), blackMatte, [x, (3.35 + DECK) / 2, z]);
  const bulbGeo = (() => { const b = new THREE.SphereGeometry(0.035, 10, 8); b.scale(1, 1.3, 1); return b; })();
  const bulbMat = glow(0xffc98a, 9);

  // ---------------------------------------------------------------- 8. DJ booth (lawn, facing the pool) + stacked speakers
  const LAWN = surf(19.5, 29.9, 1.0, -0.12);
  const dj = kit.group(root, [19.5, LAWN, 29.45], Math.PI, 'party:dj'); // local +z faces world -z (toward the pool)
  const djGlow = glow(0xb04cff, 4); djGlow.userData.keep = true;
  { const W = 1.9, H = 1.05, D = 0.7;
    kit.add(dj, kit.rbox(W, H, D, 0.03), blackMatte, [0, H / 2, 0]);
    kit.add(dj, kit.rbox(W + 0.08, 0.05, D + 0.08, 0.015), black, [0, H + 0.025, 0]);
    const front = kit.add(dj, new THREE.PlaneGeometry(W - 0.12, 0.08), djGlow, [0, H - 0.12, D / 2 + 0.002]); front.userData.keep = true;
    const front2 = kit.add(dj, new THREE.PlaneGeometry(W - 0.12, 0.03), djGlow, [0, 0.1, D / 2 + 0.002]); front2.userData.keep = true;
    // gold "$" emblem panel
    kit.add(dj, kit.rbox(0.5, 0.5, 0.02, 0.01), gold, [0, 0.52, D / 2 + 0.01]);
    // decks: two turntables + mixer + laptop
    for (const sx of [-0.55, 0.55]) { kit.add(dj, kit.rbox(0.42, 0.06, 0.34, 0.01), black, [sx, H + 0.08, 0]); const plat = kit.add(dj, kit.cyl(0.14, 0.14, 0.012, 32), djGlow, [sx, H + 0.117, 0]); plat.userData.keep = true; }
    kit.add(dj, kit.rbox(0.3, 0.07, 0.3, 0.01), black, [0, H + 0.085, 0]);
    const lap = kit.group(dj, [0, H + 0.12, -0.2]); kit.add(lap, kit.box(0.32, 0.012, 0.22), alu, [0, 0, 0]); const scr = kit.add(lap, kit.box(0.32, 0.21, 0.01), glow(0x8ad1ff, 2.2), [0, 0.1, -0.11]); scr.rotation.x = -0.25;
    for (const sx of [-1.45, 1.45]) {
      const sp = kit.group(dj, [sx, 0, -0.05]);
      for (const [h, y, w] of [[0.75, 0.375, 0.7], [0.6, 1.08, 0.6], [0.45, 1.61, 0.5]]) {
        kit.add(sp, kit.rbox(w, h - 0.01, 0.55, 0.02), blackMatte, [0, y, 0]);
        kit.add(sp, kit.torus(w * 0.3, 0.018, 8, 32), chrome, [0, y, 0.276]);
        kit.add(sp, kit.cyl(w * 0.28, w * 0.18, 0.04, 24).rotateX(Math.PI / 2), black, [0, y, 0.26]);
      }
      phys.solidGroup(sp);
    }
    phys.boxAABB([19.5 - W / 2, LAWN, 29.45 - D / 2], [19.5 + W / 2, LAWN + H, 29.45 + D / 2]);
  }
  updates.push((dt, t) => { djGlow.emissive.setHSL((0.78 + 0.12 * Math.sin(t * 0.8)) % 1, 1, 0.55); djGlow.emissiveIntensity = 3.5 + 1.5 * Math.max(0, Math.sin(t * 8.4)); });

  // ---------------------------------------------------------------- 9. disco ball (family room) + sparkles
  const BALL = new THREE.Vector3(5.0, Math.min(famTop - 0.6, 3.1), 17.0);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 3), std({ color: 0xffffff, metalness: 1, roughness: 0.05, flatShading: true }));
  ball.position.copy(BALL); ball.userData.keep = true; anim.add(ball);
  kit.add(root, kit.cyl(0.004, 0.004, famTop - BALL.y, 4), chrome, [BALL.x, (famTop + BALL.y) / 2, BALL.z], [0, 0, 0], { shadow: false });
  const NS = 90; const sparkDirs = []; for (let i = 0; i < NS; i++) { const y = -R(0.05, 0.95), a = rnd() * 6.28, r = Math.sqrt(1 - y * y); sparkDirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const sparkMat = new THREE.MeshBasicMaterial({ map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.5, 1.7), polygonOffset: true, polygonOffsetFactor: -2 });
  const sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), sparkMat, NS); sparks.frustumCulled = false; sparks.userData.keep = true; sparks.renderOrder = 5; anim.add(sparks);
  const famBox = { x0: fam[0], x1: fam[2], z0: fam[1], z1: fam[3], y0: 0.005 };
  const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _up = new THREE.Vector3(0, 0, 1);
  updates.push((dt, t) => {
    const ang = t * 0.35; ball.rotation.y = ang; const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = 0; i < NS; i++) {
      const s = sparkDirs[i]; _d.set(s.x * ca + s.z * sa, s.y, -s.x * sa + s.z * ca);
      let tb = Infinity; _n.set(0, 1, 0);
      if (_d.y < 0) { const tt = (famBox.y0 - BALL.y) / _d.y; if (tt < tb) { tb = tt; _n.set(0, 1, 0); } }
      if (_d.x > 0) { const tt = (famBox.x1 - 0.01 - BALL.x) / _d.x; if (tt < tb) { tb = tt; _n.set(-1, 0, 0); } } else if (_d.x < 0) { const tt = (famBox.x0 + 0.01 - BALL.x) / _d.x; if (tt < tb) { tb = tt; _n.set(1, 0, 0); } }
      if (_d.z > 0) { const tt = (famBox.z1 - 0.01 - BALL.z) / _d.z; if (tt < tb) { tb = tt; _n.set(0, 0, -1); } } else if (_d.z < 0) { const tt = (famBox.z0 + 0.01 - BALL.z) / _d.z; if (tt < tb) { tb = tt; _n.set(0, 0, 1); } }
      _p.copy(BALL).addScaledVector(_d, tb); _q.setFromUnitVectors(_up, _n);
      const tw = 0.7 + 0.5 * Math.sin(t * 6 + i * 1.7); _s.set(tw, tw, tw);
      _m4.compose(_p, _q, _s); sparks.setMatrixAt(i, _m4);
    }
    sparks.instanceMatrix.needsUpdate = true;
  });

  // ---------------------------------------------------------------- 10. LED uplights (puck + additive wall wash)
  const washGeos = [], puckXf = [];
  const UPC = [new THREE.Color(0.75, 0.25, 1.0), new THREE.Color(0.95, 0.65, 0.2), new THREE.Color(0.3, 0.45, 1.0)];
  const uplight = (x, z, nx, nz, ci, h = 2.4) => {
    const g = new THREE.PlaneGeometry(1.1, h); g.translate(0, h / 2, 0); g.rotateY(Math.atan2(nx, nz)); g.translate(x - nx * 0.0 + nx * 0.012, 0.0, z + nz * 0.012);
    const c = UPC[ci % UPC.length]; const col = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    washGeos.push(g); puckXf.push([x + nx * 0.09, z + nz * 0.09, ci]);
  };
  // family: TV-wall flanks + rear wall corners; living: fireplace-wall corners + art wall; dining partition; foyer
  uplight(fam[0], 14.6, 1, 0, 0); uplight(fam[0], 19.2, 1, 0, 0); uplight(4.2, fam[3], 0, -1, 2); uplight(liv[0], 8.2, 1, 0, 0); uplight(liv[0], 12.8, 1, 0, 0);
  uplight(2.6, liv[3], 0, -1, 2); uplight(6.4, liv[3], 0, -1, 2); uplight(10.0, din[1], 0, 1, 1); uplight(13.9, din[1], 0, 1, 1); uplight(foy[0], 9.0, 1, 0, 0);
  const washMat = new THREE.MeshBasicMaterial({ map: washTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
  const wash = new THREE.Mesh(kit.mergeGeometries(washGeos), washMat); wash.userData.keep = true; wash.renderOrder = 4; root.add(wash);
  const puckMats = UPC.map(c => glow(c, 6));
  for (const [x, z, ci] of puckXf) { const p = kit.add(root, kit.cyl(0.06, 0.07, 0.05, 16), blackMatte, [x, 0.025, z], [0, 0, 0], { shadow: false }); const l = kit.add(root, kit.cyl(0.045, 0.045, 0.004, 16), puckMats[ci], [x, 0.052, z], [0, 0, 0], { shadow: false }); }

  // ---------------------------------------------------------------- 11. champagne tower (kitchen sink island) + ice buckets
  const coupeGeo = kit.lathe([[0.0, 0], [0.032, 0.0], [0.034, 0.004], [0.006, 0.01], [0.004, 0.07], [0.012, 0.078], [0.05, 0.09], [0.056, 0.108], [0.053, 0.108], [0.046, 0.094], [0.01, 0.082], [0, 0.081]], 20);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.28, ior: 1.5, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide });
  const fizzMat = std({ color: 0xf3d27a, emissive: 0x8a6418, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.85 });
  const coupeXf = [], fizzXf = [];
  const tower = (x, y, z, n) => { const pitch = 0.108; for (let k = 0; k < n; k++) { const m = n - k; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { const px = x + (i - (m - 1) / 2) * pitch, pz = z + (j - (m - 1) / 2) * pitch, py = y + 0.012 + k * 0.108; coupeXf.push(new THREE.Matrix4().makeTranslation(px, py, pz)); fizzXf.push(new THREE.Matrix4().makeTranslation(px, py + 0.1, pz)); } } };
  kit.add(root, kit.cyl(0.33, 0.33, 0.012, 40), chrome, [18.85, ySink + 0.006, 15.55]);
  tower(18.85, ySink, 15.55, 4);
  const bottleGeo = (() => { const g = kit.lathe([[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.2], [0.03, 0.25], [0.015, 0.29], [0.014, 0.33], [0.016, 0.335], [0, 0.336]], 16); const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i); const foil = y > 0.255, label = y > 0.08 && y < 0.15; const col = foil ? [0.95, 0.75, 0.3] : label ? [0.92, 0.88, 0.78] : [0.04, 0.12, 0.06]; c.set(col, i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; })();
  const bottleMat = std({ vertexColors: true, roughness: 0.15, metalness: 0.3 });
  const bucketGeo = kit.lathe([[0, 0], [0.09, 0], [0.11, 0.02], [0.12, 0.2], [0.125, 0.205], [0.115, 0.205], [0.105, 0.03], [0, 0.03]], 24);
  const bottleXf = [], bucketXf = [];
  const bucket = (x, y, z) => { bucketXf.push(new THREE.Matrix4().makeTranslation(x, y, z)); for (let i = 0; i < 2; i++) { _e.set(0.25 * (i ? 1 : -1), 0, 0.15); _q.setFromEuler(_e); bottleXf.push(new THREE.Matrix4().compose(_p.set(x + (i ? 0.03 : -0.03), y + 0.03, z), _q, _s.set(1, 1, 1))); } };
  bucket(16.71, surf(16.71, 15.6, 1.6), 15.6); bucket(12.5 + 0.55 * Math.cos(0.45), yDin, 16.1 - 0.55 * Math.sin(0.45)); bucket(19.15, LAWN + 1.1, 29.45); bucket(10.45, surf(10.45, 25.8, 1, 0.2), 25.75);
  { const y = surf(16.71, 15.6, 1.6); for (let i = 0; i < 3; i++) bottleXf.push(new THREE.Matrix4().makeTranslation(16.45 + i * 0.09, y, 17.95)); }

  // ---------------------------------------------------------------- 12. red carpet, velvet ropes, VIP neon (front door)
  const carpetMat = std({ color: 0x8e0f17, roughness: 0.95 });
  kit.add(root, kit.box(1.15, 0.012, 4.05), carpetMat, [10.0, 0.006, 4.42 - 2.025], [0, 0, 0], { shadow: false });
  const stanch = (x, z) => { const g = kit.group(root, [x, 0, z]); kit.add(g, kit.cyl(0.13, 0.15, 0.03, 20), gold, [0, 0.015, 0]); kit.add(g, kit.cyl(0.022, 0.022, 0.95, 12), gold, [0, 0.49, 0]); kit.add(g, kit.sphere(0.04, 12, 8), gold, [0, 0.98, 0]); };
  const ropeMat = std({ color: 0x7a0a12, roughness: 0.7 });
  for (const x of [9.42, 10.58]) { const zs = [4.2, 3.4]; zs.forEach(z => stanch(x, z)); kit.add(root, kit.tube([[x, 0.92, zs[0]], [x, 0.78, (zs[0] + zs[1]) / 2], [x, 0.92, zs[1]]], 0.018, 16), ropeMat); }
  { // neon "VIP" (pink), left of the door, plus "$" in gold
    const neonMat = glow(0xff3fa6, 10); const g = kit.group(root, [9.8, 3.45, 4.43 - 0.03], Math.PI);
    kit.add(g, kit.rbox(0.92, 0.42, 0.015, 0.01), std({ color: 0x0c0c0c, roughness: 0.3, transparent: true, opacity: 0.55 }), [0, 0, -0.005]);
    const seg = (pts) => kit.add(g, kit.tube(pts.map(([a, b]) => [a, b, 0.02]), 0.012, 24), neonMat, [0, 0, 0], [0, 0, 0], { shadow: false });
    seg([[-0.36, 0.13], [-0.27, -0.13], [-0.18, 0.13]]);
    seg([[-0.05, 0.13], [-0.05, -0.13]]);
    seg([[0.1, -0.13], [0.1, 0.13], [0.2, 0.12], [0.25, 0.06], [0.25, 0.01], [0.2, -0.01], [0.1, -0.01]]);
  }

  // ---------------------------------------------------------------- 13. gold pool floats (dynamic, buoyant)
  const pool = waterBodies.find(w => w.name === 'pool'); let dyn = 0;
  if (pool) for (const [x, z, kind] of [[5.6, 23.9, 'ring'], [13.8, 24.0, 'ring'], [12.4, 25.1, 'swim']]) {
    let m;
    if (kind === 'ring') m = kit.add(root, new THREE.TorusGeometry(0.42, 0.15, 16, 40).rotateX(Math.PI / 2), goldOut, [x, (pool.surfaceY ?? -0.3) + 0.06, z]);
    else m = kit.add(root, kit.rbox(1.6, 0.16, 0.7, 0.07), goldOut, [x, (pool.surfaceY ?? -0.3) + 0.05, z], [0, 0.6, 0]);
    try { pool.addFloater(phys.dynamic(m, kind === 'ring' ? { mass: 0.6, shape: 'hull', linearDamping: 0.4, angularDamping: 0.6 } : { mass: 1.0, shape: 'box', linearDamping: 0.4, angularDamping: 0.6 }), { density: kind === 'ring' ? 60 : 70, ...(kind === 'ring' ? { volume: 0.19 } : {}) }); dyn++; } catch (e) { console.warn('[party] float', e.message); }
  }
  // a few loose, pushable cash bricks (pickups)
  for (const [x, z, from] of [[4.65, 17.0, 1.2], [6.5, 15.3, 1.2], [12.0, 16.4, 1.5]]) {
    const y = surf(x, z, from); const m = money.stackMesh(); m.scale.set(1, 3, 1); m.position.set(x, y + 0.07, z); m.rotation.y = rnd() * 6; root.add(m);
    try { phys.dynamic(m, { mass: 0.6, shape: 'box', friction: 0.8 }); dyn++; } catch {}
  }

  // ---------------------------------------------------------------- instanced meshes
  const inst = (geo, mat, xfs, { shadow = false, cols = null, name } = {}) => {
    if (!xfs.length) return null; const im = new THREE.InstancedMesh(geo, mat, xfs.length); im.name = name || 'party:inst';
    xfs.forEach((m, i) => im.setMatrixAt(i, m)); if (cols) cols.forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
    im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); return im;
  };
  inst(makeStackGeometry(), makeStackMaterial(), stackXf, { shadow: true, name: 'party:stacks' });
  inst(makeBillGeometry(), looseBillMaterial(), looseXf, { name: 'party:loose' });
  inst(barGeo, gold, barXf, { shadow: true, name: 'party:gold' });
  inst(new THREE.PlaneGeometry(0.014, 0.022).rotateX(-Math.PI / 2), std({ color: 0xffffff, roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide }), confXf, { cols: confCol, name: 'party:confetti' });
  inst(balGeo, gold, balXf[0], { name: 'party:balloons-gold' }); inst(balGeo, black, balXf[1], { name: 'party:balloons-black' });
  inst(bulbGeo, bulbMat, bulbXf, { name: 'party:bulbs' });
  inst(coupeGeo, glassMat, coupeXf, { name: 'party:coupes' }).renderOrder = 3;
  inst(new THREE.CircleGeometry(0.047, 16).rotateX(-Math.PI / 2), fizzMat, fizzXf, { name: 'party:fizz' }).renderOrder = 2;
  inst(bottleGeo, bottleMat, bottleXf, { shadow: true, name: 'party:bottles' }); inst(bucketGeo, chrome, bucketXf, { name: 'party:buckets' });

  // ---------------------------------------------------------------- money rain over the pool deck (never stops)
  const stopRain = money.rain([3.0, 19.0, 17.5, 29.0], 7.5, 11, { prewarm: 22 });

  kit.mergeStatic(root);
  ctx.onUpdate((dt, t) => { for (const u of updates) u(dt, t); });
  const counts = { stacks: stackXf.length, loose: looseXf.length, bars: barXf.length, confetti: confXf.length, balloons: balXf[0].length + balXf[1].length + heli.length, bulbs: bulbXf.length, coupes: coupeXf.length, dynamic: dyn };
  return { root, counts, stopRain, ball, famTop, ySink, yDin };
}
