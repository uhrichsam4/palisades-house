// Outdoors: BBQ + dining under an umbrella on the west deck, loungers with beach towels on the east deck,
// pool noodles + an inflatable flamingo, planters by the dining sliders, outdoor speakers on the rear walls,
// hose reel in the side yard, bins + mailbox out on the sidewalk (driveway and street stay clear).
import * as P from './props.js';
import * as B from './big.js';
import { waterBodies } from '../water/index.js';
const { COL } = P; const PI = Math.PI;

export function buildOutdoor(L) {
  const O = L.outdoor; const { G, M, put } = O; const { prop, solid, dyn, surf, xf } = L;
  const on = (room, name, kind, x, z, ry = 0, o = {}) => { const y = surf(x, z, 1.5, -0.1); return prop(room, name, kind, [x, y, z], ry, o); };
  const DECK = 'deck';
  // ---- BBQ (west deck, back against the powder/family wall at z 16.15)
  { const g = on(DECK, 'gas grill', 'appliance', 1.35, 16.72, 0, { mass: 80 }); B.grill(O, g); solid(g);
    const t = prop(DECK, 'grill tools', 'small', [1.98, g.position.y + 0.9, 16.72], 0, { mass: 1, parent: g.parent }); put(t, G.cyl(0.006, 0.006, 0.4, COL.steel, 6), M.metal, [0, 0.01, 0], [PI / 2, 0, 0.05]); put(t, G.box(0.08, 0.004, 0.1, COL.steel), M.metal, [0, 0.01, 0.24]); put(t, G.label(0.12, 0.2, 0.06, { pz: 'sauce' }, 0x7a2b16), M.print, [0, 0.1, -0.15]); }
  // ---- outdoor dining + umbrella
  { const g = on(DECK, 'outdoor dining table', 'furniture', -0.6, 19.5, PI / 2, { mass: 60 }); const seats = B.outdoorTable(O, g, 6); L.shadows(g); solid(g);
    // chairs as their own props (solid each); table local (lx, lz) -> world (-0.6 + lz, 19.5 - lx)
    for (const [lx, lz, side] of seats) { const ch = on(DECK, 'outdoor chair', 'furniture', -0.6 + lz, 19.5 - lx, side > 0 ? -PI / 2 : PI / 2, { mass: 8 }); B.patioChair(O, ch, 0x2b2b2b, COL.cream); solid(ch); }
    const u = on(DECK, 'patio umbrella', 'furniture', -0.6, 19.5, 0, { mass: 20 }); B.umbrella(O, u, COL.cream, 1.5); L.shadows(u);
    const ty = g.position.y + 0.76; const s = prop(DECK, 'table settings', 'small', [-0.6, ty, 19.5], 0, { mass: 2 });
    for (const dz of [-0.6, 0, 0.6]) for (const sx of [-1, 1]) { P.plate(O, s, sx * 0.3, 0, dz, 0.13, COL.white); }
    P.bowl(O, s, 0, 0, 0.3, 0.14, COL.white); for (let i = 0; i < 4; i++) P.drinkCan(O, s, 0.08 * (i % 2 ? 1 : -1), 0, -0.3 - (i >> 1) * 0.12, i % 2 ? 'beer' : 'soda2');
  }
  // ---- loungers on the east deck (canyon end), towels, an umbrella between the pairs
  { const cols = [0x2f6f73, COL.white, 0xe8a33a, COL.navy];
    [18.0, 18.9, 21.2, 22.1].forEach((x, i) => { const g = on(DECK, 'chaise lounger', 'furniture', x, 27.3, 0, { mass: 18 }); B.lounger(O, g, COL.white, COL.cream); L.shadows(g); solid(g);
      const t = prop(DECK, 'beach towel', 'small', [x, g.position.y + 0.42, 27.5], 0, { mass: 0.6 }); put(t, G.cushion(0.62, 0.012, 1.2, 0.01, 0.003, cols[i]), M.towel, [0, 0, 0], [0, 0.04 * (i - 1.5), 0]); });
    const u = on(DECK, 'patio umbrella', 'furniture', 20.05, 27.0, 0, { mass: 20 }); B.umbrella(O, u, 0xe9e1d2, 1.4); L.shadows(u);
    const st = on(DECK, 'side table + drinks', 'furniture', 20.05, 27.9, 0, { mass: 4 }); P.sideTable(O, st, 0, 0, 0, { r: 0.22, h: 0.45, top: COL.white, legs: COL.white }); solid(st);
    const d = prop(DECK, 'drinks', 'small', [20.05, st.position.y + 0.45, 27.9], 0, { mass: 0.6 }); P.drinkCan(O, d, -0.06, 0, 0, 'beer'); P.soloCup(O, d, 0.07, 0, 0.05); put(d, G.rbox(0.16, 0.03, 0.08, 0.01, COL.black), M.gloss, [0.0, 0.015, -0.1]);
    const sp = prop(DECK, 'portable speaker', 'electronics', [19.0, surf(19.0, 26.05, 1.5, -0.1), 26.05], 0.4, { mass: 1 }); put(sp, G.cyl(0.05, 0.05, 0.2, 0x2b2b2b, 14), M.matte, [0, 0.05, 0], [0, 0, PI / 2]); dyn(sp, 1);
  }
  // ---- pool toys: noodles + flamingo (buoyant)
  { const pool = waterBodies.find(w => w.name === 'pool');
    if (pool) { const wy = pool.surfaceY ?? -0.3;
      [[9.5, 23.8, 0.7, 0xff5fa2], [14.9, 25.2, -0.4, 0x38c8e6]].forEach(([x, z, ry, c]) => { const g = prop('pool', 'pool noodle', 'small', [x, wy + 0.04, z], ry, { mass: 0.2 }); put(g, G.cyl(0.04, 0.04, 1.5, c, 10), M.satin, [0, 0, 0], [0, 0, PI / 2]); try { pool.addFloater(dyn(g, 0.2, 'box', { linearDamping: 0.4, angularDamping: 0.6 }), { density: 30 }); } catch (e) { console.warn('[furnish] noodle', e.message); } });
      { const g = prop('pool', 'inflatable flamingo', 'small', [7.0, wy + 0.08, 24.3], 0.5, { mass: 1 }); put(g, G.torus(0.45, 0.17, 0xff6fae, 10, 24), M.gloss, [0, 0, 0], [PI / 2, 0, 0]); put(g, G.tube([[0.35, 0.1, 0], [0.5, 0.45, 0], [0.48, 0.85, 0], [0.6, 0.9, 0]], 0.07, 0xff6fae, 12, 8), M.gloss); put(g, G.sph(0.1, 0xff6fae, 10, 8), M.gloss, [0.58, 0.9, 0]); put(g, G.cyl(0.03, 0.015, 0.12, 0x222222, 8), M.gloss, [0.7, 0.88, 0], [0, 0, -1.2]);
        try { pool.addFloater(dyn(g, 1.0, 'hull', { linearDamping: 0.4, angularDamping: 0.6 }), { density: 40, volume: 0.3 }); } catch (e) { console.warn('[furnish] flamingo', e.message); } }
    } }
  // ---- planters by the dining sliders + by the kitchen door
  for (const [x, z, s] of [[8.62, 19.0, 1], [15.05, 19.0, 2], [14.72, 22.1, 3]]) { const g = on(DECK, 'potted plant', 'decor', x, z, s, { mass: 40 }); P.plant(O, g, 0, 0, 0, { r: 0.28, h: 0.55, hex: s === 3 ? COL.terracotta : COL.charcoal, kind: s === 2 ? 'strap' : 'leafy', size: 0.9, n: 22, seed: s }); L.shadows(g); solid(g); }
  // ---- outdoor speakers under the eaves (rear walls)
  for (const [x, z] of [[8.75, 18.4], [15.0, 18.4], [2.75, 20.32], [7.95, 20.32]]) { const g = prop(DECK, 'outdoor speaker', 'electronics', [x, 2.55, z + 0.14], 0, { mass: 4 }); B.speakerWall(O, g); }
  // ---- side yard: garden hose reel by the living-room wall
  { const g = on('yard', 'hose reel', 'decor', -0.05, 10.0, PI / 2, { mass: 6 }); B.hoseReel(O, g); }
  // ---- throwables (tagged kind 'throwable'): garden stones, a football on the pool lawn, a basketball by the court
  { const rr = L.rng(77);
    const rock = (x, z, r, hex) => { const geo = new L.THREE.IcosahedronGeometry(r, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.75 + rr() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } geo.computeVertexNormals(); L.tint(geo, hex);
      const g = on('yard', 'garden stone', 'throwable', x, z, rr() * 6, { mass: +(r * r * r * 2600 * 2.2).toFixed(1) }); put(g, geo, M.matte, [0, r * 0.6, 0], [0, 0, 0], true); dyn(g, g.userData.furnish.mass, 'hull', { friction: 0.8, restitution: 0.1 }); };
    [[-1.6, 2.2, 0.11, 0x8a857c], [-0.9, 3.1, 0.08, 0x9d968a], [-2.3, 4.0, 0.13, 0x777168], [-0.4, 5.6, 0.07, 0xa8a196], [-1.2, 11.5, 0.1, 0x8f897f], [-0.7, 14.2, 0.09, 0x7d776e]].forEach(([x, z, r, c]) => rock(x, z, r, c));
    { const g = on('yard', 'football', 'throwable', 12.4, 29.7, 0.6, { mass: 0.42 }); const geo = G.sph(0.11, 0x6b3a1f, 16, 10); xf(geo, 0, 0, 0, 0, 0, 0, [1.55, 1, 1]); put(g, geo, M.satin, [0, 0.11, 0], [0, 0, 0.1], true); put(g, G.box(0.08, 0.004, 0.012, COL.white), M.satin, [0, 0.219, 0]); dyn(g, 0.42, 'ball', { restitution: 0.5 }); }
    { const g = on('yard', 'basketball', 'throwable', 22.6, 29.9, 0, { mass: 0.62 }); const geo = G.sph(0.12, 0xc8611d, 16, 12); const c = geo.attributes.color, p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.006 || Math.abs(p.getY(i)) < 0.006) c.setXYZ(i, 0.05, 0.05, 0.05); put(g, geo, M.satin, [0, 0.12, 0], [0, 0, 0], true); dyn(g, 0.62, 'ball', { restitution: 0.78 }); }
  }
  // ---- sidewalk: trash day bins + mailbox (west of the entry apron, clear of the driveway and street)
  [[-1.3, 0x2b2f2e, 0x2b2f2e, 'trash bin'], [-0.55, 0x2b2f2e, 0x2a5fa8, 'recycling bin'], [0.2, 0x2b2f2e, 0x3c7a3a, 'green waste bin']].forEach(([x, c, l, n]) => { const g = on('street', n, 'furniture', x, -7.75, PI, { mass: 15 }); P.binRoller(O, g, c, l); L.shadows(g); solid(g); });
  { const g = on('street', 'mailbox', 'decor', 2.4, -7.55, PI, { mass: 10 }); B.mailbox(O, g); L.shadows(g); solid(g); }
}
