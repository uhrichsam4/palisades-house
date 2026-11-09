// Piece: pool — Pool + spa + sunken lounge, deck, fire pit, outdoor furniture, rear lawn/fence; interactive water
// Owned rooms: (exterior) | Reference photos: p38, p39, p40
// NOTES FROM THE WATER-SIMULATION BUILDER (read before building; src/water/index.js has the full API):
//  - Call createWater(ctx, {...}) once per body (pool, spa). Outline = ONE polygon per body; the sunken
//    lounge platform can be a notch in it. Pass color: 0x2fb7c9. Optional: tintPath (lower = deeper colour),
//    reflect (0.85), causticGain (0.9), captureScale (0.75).
//  - Pass floorY as a FUNCTION (x, z) => y that matches your real floor exactly (steps, sun shelf, deep end):
//    depth colour, refraction and caustics depend on it; the caustic overlay sits 6 mm above it.
//  - Pool interior: pale white/grey plaster ≈ #e4e9e8 with receiveShadow; walls + coping castShadow.
//  - Coping overhangs the water edge by 2–3 cm.
//  - Floating props: water.addFloater(ctx.phys.dynamic(mesh, {...}), {}) (add the mesh to ctx.root first).
//
// LAYOUT (from p38 straight-on + p45 aerial): pool runs parallel to the rear facade behind the family wing and
// dining. SW end: raised spa in the canyon-side corner, entry steps on the house side. Then a 1.2 m water gap,
// the in-pool lounge platform (canyon side, 10 cm below the deck, seat ledge in front), then open water / deep
// end to the NE. Pale pavers from the house to z 29, lawn strip, black picket fence at z 30.6.
import * as THREE from 'three';
import { createWater } from '../water/index.js';
import { makeMaterials, sectional, firePit, clubChair, teakBench, pingPong, planter, fence } from './pool/props.js';
import { cc0Plants, plantInstances } from './site/flora.js';

export const piece = { rooms: [], photos: ["p38", "p39", "p40"] };
export const ownCeiling = [];
export const views = {
  p38: { pos: [9.50, 1.15, 19.00], look: [9.50, 2.91, 30.0], fov: 60 },
  p39: { pos: [-0.90, 1.85, 27.30], look: [8.95, -0.40, 29.04], fov: 64 },
  p40: { pos: [4.10, 1.45, 20.62], look: [13.60, 1.10, 25.90], fov: 62 },
};

// ---- geometry constants (world metres)
// Spa (v07 night video): raised 0.25 m above the deck, ledgestone outer face, flat coping, spillway to the pool.
const SPA_TOP = 0.15, SPA_WATER = 0.02;   // coping top (DECK + 0.25) / spa water surface
const DECK = -0.10, WATER = -0.30, PLAT_TOP = -0.20, GROUND = -0.31;
const P = { x0: 3.6, x1: 16.0, z0: 23.0, z1: 27.6 };          // pool water rect (before notches)
const SPA = { x0: 3.6, x1: 6.4, z0: 25.0, z1: 27.6, t: 0.25 }; // raised spa block (canyon/SW corner)
const PLAT = { x0: 7.6, x1: 11.6, z0: 25.0, z1: 27.6 };        // in-pool lounge platform
const STEP_X = [3.6, 4.05, 4.5, 4.95], STEP_Y = [-0.55, -0.80, -1.05];  // entry steps, house side SW end (z0..SPA.z0)
const LEDGE = { z0: 24.55, y: -0.75 };                          // seat ledge in front of the platform
const OV = 0.025, COPE = 0.30;                                  // coping overhang / width
const HOLE = [P.x0 - COPE, P.z0 - COPE, P.x1 + COPE, P.z1 + COPE];  // hole in deck + site ground
const DECK_Z1 = 28.6, FENCE_Z = 30.9, LOUNGE_X = 7.0, DECK_X0 = -3.4, DECK_X1 = 23.1;
const SHALLOW = -1.35, DEEP = -2.20;

function profile(x) { if (x <= 8.3) return SHALLOW; if (x >= 10.8) return DEEP; return SHALLOW + (DEEP - SHALLOW) * (x - 8.3) / 2.5; }
export function poolFloorY(x, z) {
  let y = profile(x);
  if (x < STEP_X[3] && z < SPA.z0) y = x < STEP_X[1] ? STEP_Y[0] : x < STEP_X[2] ? STEP_Y[1] : STEP_Y[2];
  if (x >= PLAT.x0 && x <= PLAT.x1 && z >= LEDGE.z0) y = Math.max(y, LEDGE.y);
  return y;
}
const SPA_IN = { x0: SPA.x0 + SPA.t, x1: SPA.x1 - SPA.t, z0: SPA.z0 + SPA.t, z1: SPA.z1 - SPA.t };
const SPA_FLOOR = -0.90, SPA_BENCH = -0.42, BENCH_W = 0.40;
const SPILL = { x0: 4.40, x1: 5.60, y: SPA_WATER - 0.012 };     // spillway lip in the house-facing spa wall
export function spaFloorY(x, z) { return (z >= SPA_IN.z1 - BENCH_W || x <= SPA_IN.x0 + BENCH_W) ? SPA_BENCH : SPA_FLOOR; }

export const POOL_OUTLINE = [
  [P.x0, P.z0], [P.x1, P.z0], [P.x1, P.z1], [PLAT.x1, P.z1], [PLAT.x1, PLAT.z0], [PLAT.x0, PLAT.z0],
  [PLAT.x0, P.z1], [SPA.x1, P.z1], [SPA.x1, SPA.z0], [P.x0, SPA.z0],
];
export const SPA_OUTLINE = [[SPA_IN.x0, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z1], [SPA_IN.x0, SPA_IN.z1]];

export async function build(ctx) {
  const { root, kit, phys } = ctx;
  const M = makeMaterials(kit);
  const colGeos = [];   // world-space basin geometry for the trimesh collider
  const AABB = (x0, y0, z0, x1, y1, z1) => phys.boxAABB([x0, y0, z0], [x1, y1, z1]);
  // box by min/max corners (visual + optional collider)
  const slab = (mat, x0, y0, z0, x1, y1, z1, { r = 0, col = true, shadow = true } = {}) => {
    const geo = r ? kit.rbox(x1 - x0, y1 - y0, z1 - z0, r) : kit.box(x1 - x0, y1 - y0, z1 - z0);
    const m = kit.add(root, geo, mat, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [0, 0, 0], { shadow });
    if (col) AABB(x0, y0, z0, x1, y1, z1);
    return m;
  };
  // vertical plaster wall quad facing normal n ([nx,nz]) on line from a to b
  const wallQuad = (a, b, y0, y1, n) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.PlaneGeometry(L, y1 - y0);
    g.rotateY(Math.atan2(n[0], n[1]));
    g.translate((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2);
    kit.add(root, g, M.plaster, [0, 0, 0], [0, 0, 0], { shadow: true });
    colGeos.push(g);
  };

  // ================= BASIN
  // floor: three strips following the profile (shallow / ramp / deep), full pool width
  const floorStrip = (xa, xb) => {
    const ya = profile(xa + 1e-4), yb = profile(xb - 1e-4);
    const g = new THREE.BufferGeometry();
    const v = [xa, ya, P.z0, xb, yb, P.z0, xb, yb, P.z1, xa, ya, P.z1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, (xb - xa) / 2, 0, (xb - xa) / 2, (P.z1 - P.z0) / 2, 0, (P.z1 - P.z0) / 2], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    kit.add(root, g, M.plaster, [0, 0, 0], [0, 0, 0], { shadow: false });
    colGeos.push(g);
  };
  floorStrip(P.x0, 8.3); floorStrip(8.3, 10.8); floorStrip(10.8, P.x1);
  const WTOP = DECK - 0.05, WBOT = DEEP - 0.05;
  wallQuad([P.x0, P.z0], [P.x0, SPA.z0], WBOT, WTOP, [1, 0]);           // SW end (house side)
  wallQuad([P.x0, P.z0], [P.x1, P.z0], WBOT, WTOP, [0, 1]);             // house side
  wallQuad([P.x1, P.z0], [P.x1, P.z1], WBOT, WTOP, [-1, 0]);            // NE end
  wallQuad([SPA.x1, P.z1], [PLAT.x0, P.z1], WBOT, WTOP, [0, -1]);       // canyon side, spa..platform gap
  wallQuad([PLAT.x1, P.z1], [P.x1, P.z1], WBOT, WTOP, [0, -1]);         // canyon side, NE of platform
  // entry steps (solid blocks: treads + risers)
  for (let i = 0; i < 3; i++) slab(M.plaster, STEP_X[i], SHALLOW - 0.02, P.z0, STEP_X[i + 1], STEP_Y[i], SPA.z0);
  // seat ledge in front of the platform
  slab(M.plaster, PLAT.x0, WBOT, LEDGE.z0, PLAT.x1, LEDGE.y, PLAT.z0 + 0.01);
  // lounge platform block + paver top (coping slab overhangs 2.5 cm) + riser to the back deck
  slab(M.plaster, PLAT.x0, WBOT, PLAT.z0, PLAT.x1, PLAT_TOP - 0.05, P.z1, { col: false });
  AABB(PLAT.x0, WBOT, PLAT.z0, PLAT.x1, PLAT_TOP, P.z1);
  slab(M.coping, PLAT.x0 - OV, PLAT_TOP - 0.05, PLAT.z0 - OV, PLAT.x1 + OV, PLAT_TOP, P.z1 - OV, { r: 0.012, col: false });
  slab(M.coping, PLAT.x0, GROUND, P.z1 - OV, PLAT.x1, DECK - 0.05, P.z1 + 0.01, { col: false });
  // raised spa (0.25 m above the deck): four plaster walls, ledgestone veneer on every outer face above the
  // pool waterline / deck, glowing plaster interior (floor, L bench, inner walls), ledgestone band at the
  // waterline, flat coping overhanging inside and out, and a spillway lip over the pool on the house side.
  const SB = SHALLOW - 0.05, CT = SPA_TOP - 0.05, E = 0.03;   // wall bottom, coping underside, coping outer overhang
  slab(M.plaster, SPA.x0, SB, SPA.z0, SPA.x1, SPILL.y - 0.05, SPA.z0 + SPA.t, { col: false });   // house side, up to the lip
  slab(M.plaster, SPA.x0, SPILL.y - 0.05, SPA.z0, SPILL.x0, CT, SPA.z0 + SPA.t, { col: false });
  slab(M.plaster, SPILL.x1, SPILL.y - 0.05, SPA.z0, SPA.x1, CT, SPA.z0 + SPA.t, { col: false });
  slab(M.plaster, SPA.x0, SB, SPA.z1 - SPA.t, SPA.x1, CT, SPA.z1, { col: false });
  slab(M.plaster, SPA.x0, SB, SPA.z0 + SPA.t, SPA.x0 + SPA.t, CT, SPA.z1 - SPA.t, { col: false });
  slab(M.plaster, SPA.x1 - SPA.t, SB, SPA.z0 + SPA.t, SPA.x1, CT, SPA.z1 - SPA.t, { col: false });
  AABB(SPA.x0, SB, SPA.z0, SPA.x1, SPA_TOP, SPA.z0 + SPA.t);
  AABB(SPA.x0, SB, SPA.z1 - SPA.t, SPA.x1, SPA_TOP, SPA.z1);
  AABB(SPA.x0, SB, SPA.z0, SPA.x0 + SPA.t, SPA_TOP, SPA.z1); AABB(SPA.x1 - SPA.t, SB, SPA.z0, SPA.x1, SPA_TOP, SPA.z1);
  // face quad on line a->b facing n, world-scaled UVs (ledgestone tile = 0.6 m)
  const face = (mat, a, b, y0, y1, n, off = 0.004, tile = 0.6) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.PlaneGeometry(L, y1 - y0);
    const uv = g.attributes.uv; const u0 = (a[0] + a[1]) / tile;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * L / tile, (y0 + uv.getY(i) * (y1 - y0)) / tile);
    g.rotateY(Math.atan2(n[0], n[1]));
    g.translate((a[0] + b[0]) / 2 + n[0] * off, (y0 + y1) / 2, (a[1] + b[1]) / 2 + n[1] * off);
    return kit.add(root, g, mat, [0, 0, 0], [0, 0, 0], { shadow: false });
  };
  const VB = WATER - 0.08;   // veneer bottom on the pool-facing sides (just under the pool waterline)
  face(M.ledgestone, [SPA.x0, SPA.z0], [SPILL.x0, SPA.z0], VB, CT, [0, -1]);           // house side (pool)
  face(M.ledgestone, [SPILL.x0, SPA.z0], [SPILL.x1, SPA.z0], VB, SPILL.y - 0.05, [0, -1]);
  face(M.ledgestone, [SPILL.x1, SPA.z0], [SPA.x1, SPA.z0], VB, CT, [0, -1]);
  face(M.ledgestone, [SPA.x1, SPA.z0], [SPA.x1, SPA.z1], VB, CT, [1, 0]);              // NE side (pool / gap)
  face(M.ledgestone, [SPA.x0, SPA.z1], [SPA.x1, SPA.z1], DECK, CT, [0, 1]);            // canyon side (deck)
  face(M.ledgestone, [SPA.x0, SPA.z0], [SPA.x0, SPA.z1], DECK, CT, [-1, 0]);           // SW end (deck)
  // interior: glowing plaster below the waterline band, ledgestone band from just under the water to the coping
  const BAND = SPA_WATER - 0.07;
  face(M.spaGlow, [SPA_IN.x0, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z0], SPA_FLOOR, BAND, [0, 1]);
  face(M.spaGlow, [SPA_IN.x0, SPA_IN.z1], [SPA_IN.x1, SPA_IN.z1], SPA_FLOOR, BAND, [0, -1]);
  face(M.spaGlow, [SPA_IN.x0, SPA_IN.z0], [SPA_IN.x0, SPA_IN.z1], SPA_FLOOR, BAND, [1, 0]);
  face(M.spaGlow, [SPA_IN.x1, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z1], SPA_FLOOR, BAND, [-1, 0]);
  face(M.ledgestone, [SPA_IN.x0, SPA_IN.z0], [SPILL.x0, SPA_IN.z0], BAND, CT, [0, 1]);
  face(M.ledgestone, [SPILL.x0, SPA_IN.z0], [SPILL.x1, SPA_IN.z0], BAND, SPILL.y - 0.05, [0, 1]);
  face(M.ledgestone, [SPILL.x1, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z0], BAND, CT, [0, 1]);
  face(M.ledgestone, [SPA_IN.x0, SPA_IN.z1], [SPA_IN.x1, SPA_IN.z1], BAND, CT, [0, -1]);
  face(M.ledgestone, [SPA_IN.x0, SPA_IN.z0], [SPA_IN.x0, SPA_IN.z1], BAND, CT, [1, 0]);
  face(M.ledgestone, [SPA_IN.x1, SPA_IN.z0], [SPA_IN.x1, SPA_IN.z1], BAND, CT, [-1, 0]);
  slab(M.spaGlow, SPA_IN.x0, SB, SPA_IN.z0, SPA_IN.x1, SPA_FLOOR, SPA_IN.z1, { shadow: false });
  slab(M.spaGlow, SPA_IN.x0, SPA_FLOOR - 0.01, SPA_IN.z1 - BENCH_W, SPA_IN.x1, SPA_BENCH, SPA_IN.z1, { shadow: false });
  slab(M.spaGlow, SPA_IN.x0, SPA_FLOOR - 0.01, SPA_IN.z0, SPA_IN.x0 + BENCH_W, SPA_BENCH, SPA_IN.z1 - BENCH_W, { shadow: false });
  // underwater light lens on the NE inner wall (emissive only)
  kit.add(root, new THREE.CircleGeometry(0.075, 24).rotateY(-Math.PI / 2), M.spaLens, [SPA_IN.x1 - 0.008, SPA_WATER - 0.42, (SPA_IN.z0 + SPA_IN.z1) / 2 - 0.25], [0, 0, 0], { shadow: false });
  // coping: flat slabs overhanging the water (OV) and the stone veneer (E); lowered over the spillway
  const cp = (x0, z0, x1, z1, y1 = SPA_TOP) => slab(M.coping, x0, y1 - 0.05, z0, x1, y1, z1, { r: 0.012, col: false });
  cp(SPA.x0 - E, SPA.z0 - E, SPILL.x0, SPA_IN.z0 + OV);
  cp(SPILL.x0, SPA.z0 - E, SPILL.x1, SPA_IN.z0 + OV, SPILL.y);
  cp(SPILL.x1, SPA.z0 - E, SPA.x1 + E, SPA_IN.z0 + OV);
  cp(SPA.x0 - E, SPA_IN.z1 - OV, SPA.x1 + E, SPA.z1 + E);
  cp(SPA.x0 - E, SPA_IN.z0 + OV, SPA_IN.x0 + OV, SPA_IN.z1 - OV);
  cp(SPA_IN.x1 - OV, SPA_IN.z0 + OV, SPA.x1 + E, SPA_IN.z1 - OV);
  // spill-over: a thin film across the lowered lip, then a sheet down the stone face into the pool
  const SW = SPILL.x1 - SPILL.x0 - 0.02, SX = (SPILL.x0 + SPILL.x1) / 2;
  const film = kit.add(root, new THREE.PlaneGeometry(SW, SPA_IN.z0 + OV - (SPA.z0 - E)).rotateX(-Math.PI / 2), M.spill, [SX, SPILL.y + 0.004, (SPA_IN.z0 + OV + SPA.z0 - E) / 2], [0, 0, 0], { shadow: false });
  const sheet = kit.add(root, new THREE.PlaneGeometry(SW, SPILL.y - WATER), M.spill, [SX, (SPILL.y + WATER) / 2, SPA.z0 - E - 0.006], [0, Math.PI, 0], { shadow: false });
  film.userData.keep = sheet.userData.keep = true;
  // spa lights: slow colour cycle purple -> blue -> cyan -> back on the interior plaster + lens (off for the
  // daytime listing-photo views, where the lights are off)
  const view = new URLSearchParams(globalThis.location?.search || '').get('view');
  const lightsOn = !piece.photos.includes(view);
  const HUES = [0.47, 0.51, 0.54], spaCol = new THREE.Color();   /* aqua drift, not a neon purple/blue cycle */
  const setSpa = (t) => {
    const p = (t / 7) % HUES.length, i = Math.floor(p), f = p - i, s = f * f * (3 - 2 * f);
    const h = HUES[i] + (HUES[(i + 1) % HUES.length] - HUES[i]) * s;
    spaCol.setHSL(h, 0.55, 0.5);
    M.spaGlow.emissive.copy(spaCol); M.spaLens.color.copy(spaCol).lerp(new THREE.Color(1, 1, 1), 0.45).multiplyScalar(2.2);
  };
  M.spaGlow.emissiveIntensity = lightsOn ? 0.85 : 0;
  if (!lightsOn) M.spaLens.color.set(0xd8dcdc);
  else { setSpa(0); ctx.onUpdate((dt, t) => setSpa(t)); }
  ctx.onUpdate((dt, t) => { M.spill.alphaMap.offset.y = (t * 0.9) % 1; });

  // pool perimeter coping (limestone, 30 cm, overhangs the water 2.5 cm)
  const cy0 = DECK - 0.05;
  const cope = (x0, z0, x1, z1) => slab(M.coping, x0, cy0, z0, x1, DECK, z1, { r: 0.012, col: false });
  cope(HOLE[0], HOLE[1], HOLE[2], P.z0 + OV);
  cope(HOLE[0], P.z1 - OV, HOLE[2], HOLE[3]);
  cope(HOLE[0], P.z0 + OV, P.x0 + OV, P.z1 - OV);
  cope(P.x1 - OV, P.z0 + OV, HOLE[2], P.z1 - OV);
  // perimeter colliders (coping band + bond beam under it)
  AABB(HOLE[0], GROUND - 0.6, HOLE[1], HOLE[2], DECK, P.z0);
  AABB(HOLE[0], GROUND - 0.6, P.z1, HOLE[2], DECK, HOLE[3]);
  AABB(HOLE[0], GROUND - 0.6, P.z0, P.x0, DECK, P.z1);
  AABB(P.x1, GROUND - 0.6, P.z0, HOLE[2], DECK, P.z1);
  // basin trimesh: floor ramps + walls
  phys.trimesh(kit.mergeGeometries(colGeos.map(g => { const c = g.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); return c; })));
  // safety catch below the whole basin
  AABB(P.x0, DEEP - 0.6, P.z0, P.x1, DEEP - 0.04, P.z1);

  // ================= WATER
  // darker, less saturated teal-green (p38: the water mirrors the hills; not swimming-pool cyan)
  const pool = createWater(ctx, { outline: POOL_OUTLINE, surfaceY: WATER, floorY: poolFloorY, color: 0x3e8a85, reflect: 1.1, name: 'pool' });
  createWater(ctx, { outline: SPA_OUTLINE, surfaceY: SPA_WATER, floorY: spaFloorY, color: 0x3e8a85, reflect: 1.1, name: 'spa' });

  // ================= DECK (pavers house -> lawn, hole over pool + spa)
  const deckOutline = [
    [DECK_X0, 16.15], [2.35, 16.15], [2.35, 20.32], [8.27, 20.32], [8.27, 18.40], [15.39, 18.40], [15.39, 21.65],
    [21.70, 21.65], [DECK_X1, 21.65], [DECK_X1, DECK_Z1], [LOUNGE_X, DECK_Z1], [LOUNGE_X, FENCE_Z], [DECK_X0, FENCE_Z],
  ];
  const toS = (pts) => pts.map(([x, z]) => [x, -z]);
  const holePts = [[HOLE[0], HOLE[1]], [HOLE[2], HOLE[1]], [HOLE[2], HOLE[3]], [HOLE[0], HOLE[3]]];
  const deckGeo = kit.extrude(toS(deckOutline), DECK - GROUND, 0, [toS(holePts)]);
  deckGeo.rotateX(-Math.PI / 2); deckGeo.translate(0, GROUND, 0);
  const deck = kit.add(root, deckGeo, M.pavers, [0, 0, 0], [0, 0, 0], { shadow: false }); deck.receiveShadow = true;
  const dy0 = GROUND - 0.5;
  AABB(DECK_X0, dy0, 16.15, DECK_X1, DECK, HOLE[1]);
  AABB(DECK_X0, dy0, HOLE[3], DECK_X1, DECK, DECK_Z1);
  AABB(DECK_X0, dy0, DECK_Z1, LOUNGE_X, DECK, FENCE_Z);
  AABB(DECK_X0, dy0, HOLE[1], HOLE[0], DECK, HOLE[3]);
  AABB(HOLE[2], dy0, HOLE[1], DECK_X1, DECK, HOLE[3]);

  // lawn strip + fence at the slope edge
  const LAWN_Y = DECK - 0.02;
  const lawn = kit.add(root, new THREE.PlaneGeometry(DECK_X1 - LOUNGE_X + 0.3, FENCE_Z - DECK_Z1 + 0.3).rotateX(-Math.PI / 2), M.grass, [(LOUNGE_X + DECK_X1 + 0.3) / 2, LAWN_Y, (DECK_Z1 + FENCE_Z) / 2 + 0.15], [0, 0, 0], { shadow: false });
  lawn.receiveShadow = true;
  slab(M.coping, LOUNGE_X, GROUND, DECK_Z1, DECK_X1, LAWN_Y - 0.005, FENCE_Z + 0.3, { col: true, shadow: false });
  fence(kit, root, M, [DECK_X0, FENCE_Z], [DECK_X1 + 0.3, FENCE_Z], LAWN_Y);
  fence(kit, root, M, [DECK_X0 - 0.05, 18.0], [DECK_X0 - 0.05, FENCE_Z], LAWN_Y);
  AABB(DECK_X0, LAWN_Y, FENCE_Z - 0.04, DECK_X1 + 0.3, LAWN_Y + 1.22, FENCE_Z + 0.04);
  AABB(DECK_X0 - 0.09, LAWN_Y, 18.0, DECK_X0 - 0.01, LAWN_Y + 1.22, FENCE_Z);

  // ================= FURNITURE
  const solids = [];
  solids.push(sectional(kit, root, M));
  // fire lounge on the canyon side of the spa (p39): fire table, three wicker club chairs, teak bench
  solids.push(firePit(kit, root, M, [3.55, DECK, 29.35], -0.25));
  solids.push(clubChair(kit, root, M, [5.25, DECK, 28.95], -Math.PI / 2 - 0.15));
  solids.push(clubChair(kit, root, M, [4.75, DECK, 30.25], -Math.PI / 2 - 0.85));
  solids.push(clubChair(kit, root, M, [1.80, DECK, 30.10], Math.PI / 2 + 0.6));
  solids.push(teakBench(kit, root, M, [2.95, DECK, 28.35], -0.25));
  solids.push(pingPong(kit, root, M, [19.6, DECK, 24.9], 0));
  // planters: CC0 silvery shrubs (olive / westringia look) instanced in one draw per variant
  let plants = null, plantLib = null;
  try { plantLib = await cc0Plants(kit); plants = []; } catch (e) { console.error('[pool plants]', e); window.__errors?.push('pool plants: ' + (e.stack || e.message)); }
  solids.push(planter(kit, root, M, [-2.7, DECK, 16.9], 1.2, 3, plants));
  solids.push(planter(kit, root, M, [-2.7, DECK, 30.2], 1.1, 4, plants));
  solids.push(planter(kit, root, M, [22.6, DECK, 22.2], 1.2, 5, plants));
  solids.push(planter(kit, root, M, [16.9, DECK, 28.4], 1.0, 6, plants));
  if (plants) plantInstances(root, plantLib.shrub, plants);
  for (const s of solids) {
    // one box per seat module, not one for the whole sectional (it is U-shaped)
    if (s.children.every(c => c.isGroup)) for (const c of s.children) phys.solidGroup(c); else phys.solidGroup(s);
  }

  // ================= FLOATIES (dynamic, buoyant) — for play only; the listing photos have none
  if (!ctx.shot) {
  const ballTex = kit.canvasTex(256, 128, (g, w, h) => {
    const cols = ['#e8322b', '#ffffff', '#f6c21c', '#ffffff', '#2d6fd6', '#ffffff'];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6 + 1, h); });
  });
  const ball = kit.add(root, kit.sphere(0.2, 24, 16), kit.outdoor(new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 })), [13.4, WATER + 0.16, 24.2]);
  pool.addFloater(phys.dynamic(ball, { mass: 0.15, shape: 'ball', restitution: 0.6, linearDamping: 0.3 }), { density: 40 });
  const ring = kit.add(root, new THREE.TorusGeometry(0.42, 0.15, 16, 40).rotateX(Math.PI / 2), kit.outdoor(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3 })), [14.6, WATER + 0.06, 26.4]);
  pool.addFloater(phys.dynamic(ring, { mass: 0.6, shape: 'hull', linearDamping: 0.4, angularDamping: 0.6 }), { density: 60, volume: 0.19 });
  const mat = kit.add(root, kit.rbox(1.7, 0.14, 0.72, 0.06), kit.outdoor(new THREE.MeshStandardMaterial({ color: 0x9fd3e6, roughness: 0.4 })), [13.0, WATER + 0.04, 26.6], [0, 0.35, 0]);
  pool.addFloater(phys.dynamic(mat, { mass: 1.0, shape: 'box', linearDamping: 0.4, angularDamping: 0.6 }), { density: 70 });
  }

  kit.mergeStatic(root);
}
