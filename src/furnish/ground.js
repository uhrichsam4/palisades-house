// Ground floor: kitchen, dining + wet bar, family, living, foyer, game room, powder, mudroom, pantry/store,
// kitchen pantry, office, garage. World coordinates (plan.js), floor y = 0.
import * as P from './props.js';
import * as B from './big.js';
const { COL } = P; const PI = Math.PI;

// pantry-style shelf filler: items along local +x from the group origin (front edge), depth toward local -z
export function fillShelf(L, g, len, depth, maxH, seed, kinds) {
  const { G, M, put } = L; const r = L.rng(seed); let x = 0.03;
  while (x < len - 0.05) {
    const k = kinds[(r() * kinds.length) | 0]; let w = 0.1;
    if (k === 'cereal') { const n = ['cereal1', 'cereal2', 'granola', 'crackers', 'pasta'][(r() * 5) | 0]; const s = Math.min(1, (maxH - 0.01) / 0.29); w = 0.2 * s; P.cerealBox(L, g, x + w / 2, 0, -0.06, n, 0, s); }
    else if (k === 'cans') { const lab = ['can1', 'can2', 'sauce'][(r() * 3) | 0]; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) put(g, G.can(0.038, 0.11, lab), M.print, [x + 0.04 + i * 0.08, 0.055 + j * 0.111, -0.05 - (j ? 0.0 : 0.09)]); w = 0.17; }
    else if (k === 'jars') { for (let i = 0; i < 3; i++) { put(g, G.cyl(0.04, 0.04, 0.14, [0xd9a24a, 0x7a3b1a, 0xe8dcc0][i], 12), M.gloss, [x + 0.045 + i * 0.085, 0.07, -0.08]); put(g, G.cyl(0.042, 0.042, 0.02, COL.black, 12), M.satin, [x + 0.045 + i * 0.085, 0.15, -0.08]); } w = 0.26; }
    else if (k === 'bottles') { for (let i = 0; i < 3; i++) P.bottle(L, g, x + 0.045 + i * 0.085, 0, -0.1, { hex: [0x2d4a1e, 0x5a1016, 0xc9a24a][(i + seed) % 3], label: ['wine', 'liquor', 'sauce'][i], h: Math.min(0.31, maxH - 0.02), r: 0.036 }); w = 0.26; }
    else if (k === 'water') { put(g, G.label(0.3, Math.min(0.24, maxH - 0.02), Math.min(0.28, depth), { pz: 'water', py: 'water' }, 0xdff1fb), M.print, [x + 0.15, Math.min(0.24, maxH - 0.02) / 2, -0.15]); w = 0.32; }
    else if (k === 'beer') { const h = Math.min(0.13, maxH - 0.02); put(g, G.label(0.4, h, 0.27, { pz: 'beer', py: 'beer', px: 'beer' }, 0x1b3f73), M.print, [x + 0.2, h / 2, -0.14]); if (maxH > 0.3) put(g, G.label(0.4, h, 0.27, { pz: 'soda1', py: 'soda1' }, 0xc8102e), M.print, [x + 0.2, h * 1.5 + 0.002, -0.14]); w = 0.42; }
    else if (k === 'chips') { const h = Math.min(0.26, maxH - 0.03); for (let i = 0; i < 2; i++) put(g, G.label(0.18, h, 0.07, { pz: i ? 'popcorn' : 'chips' }, 0xf2c230), M.print, [x + 0.1, h / 2, -0.05 - i * 0.09], [0.05, 0, 0]); w = 0.2; }
    else if (k === 'tp') { const h = Math.min(0.3, maxH - 0.02); put(g, G.label(0.32, h, Math.min(0.3, depth), { pz: 'tp', py: 'tp' }, 0xf6f6f4), M.print, [x + 0.16, h / 2, -0.16]); w = 0.34; }
    else if (k === 'baskets') { P.basket(L, g, x + 0.17, 0, -0.17, { r: 0.16, h: Math.min(0.25, maxH - 0.05) }); w = 0.36; }
    else if (k === 'bins') { put(g, G.rbox(0.3, Math.min(0.28, maxH - 0.03), Math.min(0.32, depth), 0.02, [0xf2f2f0, 0x9fb8c8, 0xd8ccb8][(r() * 3) | 0]), M.satin, [x + 0.15, Math.min(0.28, maxH - 0.03) / 2, -0.17]); w = 0.32; }
    else if (k === 'carton') { const h = Math.min(0.35, maxH - 0.03); P.crate(L, g, x + 0.2, 0, -Math.min(0.2, depth / 2), 0.38, h, Math.min(0.38, depth - 0.02)); w = 0.4; }
    else if (k === 'paint') { for (let i = 0; i < 2; i++) { put(g, G.cyl(0.085, 0.085, 0.19, [0xf2f1ec, 0x8c8f93][i], 14), M.metal, [x + 0.09 + i * 0.18, 0.095, -0.12]); put(g, G.cyl(0.08, 0.08, 0.004, [0xf2f1ec, 0x5d6a3e][i], 12), M.satin, [x + 0.09 + i * 0.18, 0.192, -0.12]); } w = 0.37; }
    else if (k === 'books') { w = Math.min(0.5, len - x); P.bookRow(L, g, x, 0, -0.0, w, { seed: seed * 7 + x * 10, hMax: Math.min(0.27, maxH - 0.02), depth: Math.min(0.2, depth) }); }
    else if (k === 'appliance') { const h = Math.min(0.32, maxH - 0.03); const c = [0xe8e8e6, 0x2b2b2b, 0xc8cacc][(r() * 3) | 0]; put(g, G.rbox(0.3, h, 0.26, 0.04, c), c === 0xc8cacc ? M.metal : M.gloss, [x + 0.15, h / 2, -0.15]); put(g, G.cyl(0.04, 0.04, 0.01, 0x111111, 12), M.satin, [x + 0.15, h * 0.6, -0.019], [PI / 2, 0, 0]); w = 0.32; }
    else if (k === 'linen') { const n = Math.max(1, Math.floor((maxH - 0.02) / 0.06)); for (let i = 0; i < Math.min(n, 5); i++) put(g, G.cushion(0.36, 0.055, 0.3, 0.02, 0.006, [COL.white, COL.cream, COL.oat][(i + seed) % 3]), M.towel, [x + 0.19, 0.028 + i * 0.056, -0.16]); w = 0.39; }
    else if (k === 'gap') { w = 0.08 + r() * 0.12; }
    x += w + 0.02;
  }
}

export function buildGround(L) {
  const { G, M, put, prop, solid, dyn, dynFit, vs, levels } = L;
  const at = (room, name, kind, x, z, from, ry = 0, o = {}) => { const y = o.y ?? vs(x, z, from, 0); return prop(room, name, kind, [x, y, z], ry, o); };
  const stack = []; // a few dynamic small items per room are chosen below

  // ================================================================ KITCHEN
  {
    const R = 'kitchen'; const CT = 1.3; // counter tops ~0.93
    { const g = at(R, 'knife block', 'small', 21.18, 14.62, CT, -PI / 2, { mass: 2 }); P.knifeBlock(L, g, 0, 0, 0); }
    { const g = at(R, 'cutting board', 'small', 21.3, 14.12, CT, -PI / 2, { mass: 1 }); P.cuttingBoard(L, g, 0, 0, 0); }
    { const g = at(R, 'utensil crock', 'small', 21.15, 15.3, CT, 0, { mass: 1.5, fragile: true }); P.crock(L, g, 0, 0, 0); }
    { const g = at(R, 'kettle', 'appliance', 21.1, 17.35, CT, 0, { mass: 1.2 }); P.kettle(L, g, 0, 0, 0); dynFit(g, 1.2); }
    { const g = at(R, 'toaster', 'appliance', 21.12, 17.95, CT, -PI / 2, { mass: 2 }); P.toaster(L, g, 0, 0, 0); }
    { const g = at(R, 'stand mixer', 'appliance', 21.1, 18.55, CT, -PI / 2, { mass: 9 }); P.standMixer(L, g, 0, 0, 0); }
    // sink island (champagne tower lands at z 15.55, cash at 17.55)
    { const g = at(R, 'dish soap + sponge', 'small', 19.3, 16.25, CT, 0, { mass: 0.5 }); P.dishSoap(L, g, 0, 0, 0); }
    { const g = at(R, 'paper towels', 'small', 19.32, 16.6, CT, 0, { mass: 0.5 }); P.paperTowel(L, g, 0, 0, 0); dynFit(g, 0.5, 'hull'); }
    { const g = prop(R, 'dish towel on oven handle', 'decor', [20.6, 0.8, 16.05], -PI / 2, { mass: 0.2 }); P.towelOnBar(L, g, 0, 0, 0, 0, { w: 0.32, front: 0.36, back: 0.3, hex: 0xd9d2c4, r: 0.012 }); }
    { const g = at(R, 'coffee mugs', 'small', 18.42, 17.05, CT, 0, { mass: 0.6, fragile: true }); P.mug(L, g, 0, 0, 0, COL.white, 0.4); P.mug(L, g, 0.02, 0, 0.13, 0x2f4a36, 2.2); dynFit(g, 0.6); }
    { const g = at(R, 'fruit bowl', 'decor', 18.62, 16.7, CT, 0, { mass: 2, fragile: true }); P.fruitBowl(L, g, 0, 0, 0); }
    // bar island: party end with pizza, cups and cans (cash block + bucket sit at z 15.6-16.6, bottles at 17.95)
    { const g = at(R, 'pizza boxes', 'small', 16.72, 18.22, CT, 0.1, { mass: 1 }); P.pizzaBoxes(L, g, 0, 0, 0, 2, 0, true); }
    { const cups = [[16.12, 16.95], [17.08, 17.15], [16.15, 17.75], [17.05, 15.4], [16.2, 15.35]]; cups.forEach(([x, z], i) => { const g = at(R, 'party cup', 'small', x, z, CT, 0, { mass: 0.05 }); P.soloCup(L, g, 0, 0, 0, i === 2); if (i < 2) dynFit(g, 0.05, 'hull'); }); }
    { const g = at(R, 'beer cans', 'small', 17.06, 16.6, CT, 0, { mass: 0.4 }); P.drinkCan(L, g, 0, 0, 0, 'beer'); P.drinkCan(L, g, 0.02, 0, 0.09, 'soda2'); P.drinkCan(L, g, -0.04, 0, -0.12, 'beer', true, 0.6); }
    // breakfast table
    { const g = at(R, 'breakfast', 'small', 18.55, 20.1, 1.1, 0, { mass: 1 }); P.cerealBox(L, g, 0, 0, -0.05, 'cereal1', 0.3); P.bowl(L, g, 0.2, 0, 0.12, 0.08); P.mug(L, g, 0.45, 0, -0.1, COL.white, 0.5); }
    { const g = at(R, 'mug + tablet', 'small', 19.45, 20.15, 1.1, 0.3, { mass: 0.6 }); P.mug(L, g, -0.15, 0, 0.0, 0x2f4a36); put(g, G.label(0.18, 0.008, 0.25, { py: 'tablet' }, COL.black), M.screen, [0.1, 0.004, 0.05]); }
    // desk nook + cookbook shelves (shelves at x 21.1-21.4, z 19.65-20.55, faces -x)
    { const lv = levels(21.25, 20.1, 2.5, 0.6); // top-down: 2.13, 1.71, 1.29, 0.76
      lv.forEach((y, i) => { if (y < 1.0) return; const g = prop(R, 'cookbooks', 'decor', [21.22, y, 19.7], -PI / 2, { mass: 4 }); P.bookRow(L, g, 0, 0, 0, 0.8, { seed: 11 + i, hMax: Math.min(0.28, (lv[i - 1] ?? 3) - y - 0.04), depth: 0.2 }); });
      const d = lv.find(y => y < 1.0); if (d) { const g = prop(R, 'mail + charger', 'small', [21.0, d, 20.1], -PI / 2, { mass: 0.3 }); put(g, G.label(0.24, 0.02, 0.12, { py: 'mail' }, 0xf3eee2), M.print, [0.1, 0.01, 0]); P.phone(L, g, -0.2, 0, 0.05, 0.3); P.charger(L, g, -0.25, 0, 0.0, 1.2); } }
  }
  // ================================================================ DINING + WET BAR
  {
    const R = 'dining'; const cx = 12.5, cz = 16.1;
    const chairs = [[11.43, 15.72], [12.13, 17.17], [12.15, 15.37], [12.85, 16.82], [12.87, 15.02], [13.57, 16.48], [10.91, 16.86], [14.08, 15.33]];
    chairs.forEach(([x, z], i) => {
      const dx = cx - x, dz = cz - z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l; let d = 0.2, y = null;
      for (; d < 1.2; d += 0.04) { const yy = vs(x + ux * d, z + uz * d, 1.2, null, 0.6); if (yy !== null && yy > 0.68 && yy < 0.85) { y = yy; break; } }
      if (y === null) return; d += 0.2; const px = x + ux * d, pz = z + uz * d, ry = Math.atan2(-ux, -uz); // local +z points back at the chair
      const g = prop(R, 'place setting', 'small', [px, y, pz], ry, { mass: 0.8, fragile: true });
      P.plate(L, g, 0, 0, 0, 0.15, COL.charcoal); P.plate(L, g, 0, 0.02, 0, 0.12, COL.white); put(g, G.cushion(0.14, 0.012, 0.09, 0.01, 0.004, COL.oat), M.fabric, [0, 0.042, 0.02]);
      put(g, G.box(0.015, 0.004, 0.19, 0xd4a84b), M.brass, [-0.19, 0.002, 0]); put(g, G.box(0.015, 0.004, 0.2, 0xd4a84b), M.brass, [0.19, 0.002, 0]);
      P.wineGlass(L, g, 0.17, 0, -0.17, i % 3 === 0 ? 0x5a0f18 : 0);
      if (i === 1 || i === 4) dynFit(g, 0.8);
    });
    { const g = at(R, 'decanter + glasses', 'decor', 10.45, 14.0, 1.2, 0, { mass: 2, fragile: true }); put(g, G.rbox(0.42, 0.015, 0.26, 0.005, 0xd4a84b), M.brass, [0, 0.0075, 0]); put(g, G.lathe([[0, 0], [0.07, 0], [0.08, 0.06], [0.05, 0.14], [0.025, 0.18], [0.025, 0.24], [0.035, 0.25], [0, 0.25]], 0xffffff, 14), M.glass, [-0.1, 0.015, 0]); put(g, G.cyl(0.075, 0.07, 0.06, 0x5a2a10, 16), M.gloss, [-0.1, 0.045, 0]); for (let i = 0; i < 3; i++) P.tumbler(L, g, 0.06 + (i % 2) * 0.09, 0.015, -0.06 + (i >> 1) * 0.11); }
    { const g = at(R, 'candles', 'decor', 11.3, 14.0, 1.2, 0, { mass: 1 }); P.candle(L, g, 0, 0, 0, 0.04, 0.14); P.candle(L, g, 0.11, 0, 0.03, 0.035, 0.09); P.candle(L, g, 0.2, 0, -0.02, 0.03, 0.06); }
    { const g = at(R, 'book stack', 'decor', 10.95, 14.02, 1.2, 0.2, { mass: 2 }); P.bookStack(L, g, 0, 0, 0, 3, { seed: 3, cover: 'mag2' }); }
    // wet bar: liquor on the glass shelves, glasses + bucket on the counter
    { const lv = levels(12.8, 12.5, 2.9, 0.7);
      lv.forEach((y, i) => { const g = prop('wetbar', 'liquor shelf', 'decor', [12.2, y, 12.52], 0, { mass: 6, fragile: true }); const r = L.rng(5 + i);
        if (y < 1.4) { for (let k = 0; k < 4; k++) P.tumbler(L, g, 0.15 + k * 0.1, 0, 0.18); P.bottle(L, g, 0.75, 0, 0.18, { hex: 0x6a3d16, label: 'liquor', h: 0.3 }); }
        else for (let k = 0; k < 7; k++) P.bottle(L, g, 0.1 + k * 0.17, 0, 0, { hex: [0x6a3d16, 0x2d4a1e, 0xd8d1b0, 0x3a2410, 0x5a1016][(k + i) % 5], label: ['liquor', 'tequila', 'wine'][(k + i) % 3], h: Math.min(0.32, 0.24 + r() * 0.08), r: 0.035 + r() * 0.008 });
      }); }
  }
  // ================================================================ FAMILY
  {
    const R = 'family';
    { const y = vs(2.86, 15.2, 1.3, 0.98); const g = prop(R, 'game console', 'electronics', [2.87, y, 15.25], PI / 2, { mass: 4.5, fragile: true }); P.console5(L, g, 0, 0, 0); P.controller(L, g, 0.05, 0, 0.3, 0.3); }
    { const y = vs(2.86, 18.4, 1.3, 0.98); const g = prop(R, 'speaker + games', 'electronics', [2.86, y, 18.45], PI / 2, { mass: 3 }); P.speaker(L, g, 0, 0, 0); P.boardGame(L, g, 0, 0, 0.45, 0.1, 2, 1); }
    // sectional (back along x 6.81, seat toward -x): remotes, controller, phone, throw over the back
    { const y = vs(6.05, 16.4, 0.9, 0.45); const g = prop(R, 'remotes', 'small', [6.05, y, 16.4], 0, { mass: 0.3 }); P.remote(L, g, 0, 0, 0, 0.4); P.remote(L, g, 0.1, 0, 0.1, -0.2); }
    { const y = vs(6.0, 17.6, 0.9, 0.45); const g = prop(R, 'controller', 'electronics', [6.0, y, 17.6], 0.6, { mass: 0.3 }); P.controller(L, g, 0, 0, 0, 0, COL.black); }
    { const y = vs(6.1, 18.3, 0.9, 0.45); const g = prop(R, 'phone', 'electronics', [6.1, y, 18.3], 0.2, { mass: 0.2, fragile: true }); P.phone(L, g, 0, 0, 0); }
    { const y = vs(6.72, 17.2, 1.2, 0.74); const g = prop(R, 'throw blanket', 'decor', [6.72, y + 0.01, 17.4], PI / 2, { mass: 1.2 }); P.throwOver(L, g, 0, 0, 0, 0, { w: 0.7, top: 0.14, drop: Math.max(0.2, y - 0.15), hex: COL.oat, r: 0.04 }); }
    { const y = vs(4.86, 15.1, 1.0, 0.45); const g = prop(R, 'folded throw', 'decor', [4.86, y, 15.12], 0.3, { mass: 1 }); P.foldedBlanket(L, g, 0, 0, 0, 0, COL.sage); }
    { const g = prop(R, 'dog bed', 'furniture', [3.55, 0, 13.98], 0, { mass: 3 }); B.dogBed(L, g); put(g, G.torus(0.06, 0.025, 0xc0282a, 6, 12), M.satin, [0.12, 0.09, 0.05], [PI / 2, 0, 0]); }
    { const y = vs(6.9, 19.8, 1.2, 0.8); const g = prop(R, 'board games + magazines', 'decor', [6.55, y, 19.8], 0, { mass: 2 }); P.boardGame(L, g, 0, 0, 0, 0.05, 2, 2); P.magazines(L, g, 0.55, 0, 0, 3, 0.2, 2); dynFit(g, 2); }
    { const g = prop(R, 'floor cushion', 'decor', [3.85, 0, 17.4], 0.4, { mass: 2 }); put(g, G.cushion(0.6, 0.14, 0.6, 0.08, 0.04, COL.rust), M.fabric, [0, 0.07, 0]); dyn(g, 2); }
  }
  // ================================================================ LIVING
  {
    const R = 'living';
    { const g = prop(R, 'baby grand piano', 'furniture', [7.3, 0, 9.05], 0, { mass: 300 }); B.piano(L, g); L.shadows(g); solid(g); }
    { const g = prop(R, 'bar cart', 'furniture', [0.95, 0, 12.72], PI / 2, { mass: 25, fragile: true }); B.barCart(L, g); L.shadows(g); solid(g); }
    { const y = vs(2.02, 9.62, 1.0, 0.47); const g = prop(R, 'books + candle', 'decor', [2.0, y, 9.6], 0.3, { mass: 2 }); const t = P.bookStack(L, g, 0, 0, 0, 3, { seed: 9, w: 0.22, d: 0.16 }); P.candle(L, g, 0, t, 0, 0.035, 0.07); dynFit(g, 2); }
    { const y = vs(5.7, 7.88, 1.0, 0.52); const g = prop(R, 'magazines', 'decor', [5.7, y, 7.88], 0.4, { mass: 1 }); P.magazines(L, g, 0, 0, 0, 3, 0, 1); dynFit(g, 1); }
  }
  // ================================================================ FOYER
  {
    const R = 'foyer';
    { const g = prop(R, 'umbrella stand', 'decor', [8.5, 0, 4.98], 0, { mass: 3 }); put(g, G.cyl(0.11, 0.1, 0.5, COL.black, 18), M.satin, [0, 0.25, 0]); put(g, G.cyl(0.02, 0.02, 0.8, 0x2b4c9a, 6), M.satin, [0.03, 0.55, 0.02], [0.1, 0, -0.08]); put(g, G.torus(0.04, 0.012, 0x7a5a3a, 6, 10, PI), M.satin, [0.08, 0.95, 0.02], [0, 0, -0.08]); put(g, G.cyl(0.015, 0.015, 0.75, COL.black, 6), M.satin, [-0.03, 0.5, -0.02], [-0.06, 0, 0.08]); }
    { const g = prop(R, 'sneakers', 'small', [8.62, 0, 6.18], PI / 2 + 0.2, { mass: 0.8 }); P.shoes(L, g, 0, 0, 0, 0, COL.white, COL.white); dyn(g, 0.8); }
    { const y = vs(8.5, 6.7, 1.2, 0.8); const g = prop(R, 'keys + mail', 'small', [8.5, y, 6.72], PI / 2, { mass: 0.5 }); P.bowl(L, g, 0, 0, 0, 0.08, COL.walnut, M.satin); put(g, G.torus(0.015, 0.003, 0xc8c6c2, 4, 10), M.metal, [0.01, 0.03, 0.01], [1.2, 0, 0]); put(g, G.label(0.22, 0.01, 0.11, { py: 'mail' }, 0xf3eee2), M.print, [0, 0.005, 0.17]); }
  }
  // ================================================================ GAME ROOM
  {
    const R = 'game';
    { const g = prop(R, 'arcade cabinet', 'electronics', [7.72, 0, 6.82], -PI / 2, { mass: 120 }); B.arcade(L, g); L.shadows(g); solid(g); }
    { const g = prop(R, 'board games', 'decor', [6.2, 0, 6.85], 0.3, { mass: 2 }); P.boardGame(L, g, 0, 0, 0, 0, 3, 0); dyn(g, 2); }
  }
  // ================================================================ POWDER
  {
    const R = 'powder';
    { const y = vs(1.05, 15.45, 1.3, 0.86); const g = prop(R, 'soap + hand towels', 'small', [1.02, y, 15.45], PI * 0.75, { mass: 0.6 }); P.soapPump(L, g, 0, 0, 0, 0x2b2b2b); P.towelFold(L, g, 0.18, 0, 0.0, 0.1, COL.white, 2, 0.6); P.candle(L, g, -0.14, 0, 0.02, 0.035, 0.08); }
    { const g = prop(R, 'tp basket', 'small', [2.25, 0, 15.6], 0, { mass: 1 }); P.tpBasket(L, g, 0, 0, 0); dyn(g, 1, 'hull'); }
  }
  // ================================================================ MUDROOM / LAUNDRY
  {
    const R = 'mudroom';
    [[14.0, 0x2b2f2e, 0x2b2f2e, 'trash bin'], [14.66, 0x2b2f2e, 0x2a5fa8, 'recycling bin'], [15.32, 0x2b2f2e, 0x3c7a3a, 'compost bin']].forEach(([x, c, l, n]) => { const g = prop(R, n, 'furniture', [x, 0, 7.62], 0, { mass: 12 }); g.scale.setScalar(0.62); P.binRoller(L, g, c, l); solid(g); });
    { const y = vs(14.1, 10.25, 1.0, 0.48); const g = prop(R, 'backpacks', 'small', [14.05, y, 10.3], 0, { mass: 3 }); put(g, G.cushion(0.32, 0.42, 0.18, 0.08, 0.03, COL.navy), M.fabric, [0, 0.21, 0]); put(g, G.cushion(0.3, 0.38, 0.17, 0.08, 0.03, COL.olive), M.fabric, [0.55, 0.19, 0.02], [0, 0.2, 0.1]); }
    { const y = vs(14.95, 10.3, 1.0, 0.48); const g = prop(R, 'detergent', 'small', [14.95, y, 10.3], 0.2, { mass: 2.5 }); put(g, G.label(0.18, 0.28, 0.12, { pz: 'detergent' }, 0xf47b20), M.print, [0, 0.14, 0]); put(g, G.cyl(0.03, 0.03, 0.04, 0xffd400, 10), M.gloss, [0.05, 0.3, 0]); }
    { const g = prop(R, 'laundry basket', 'small', [12.35, 0, 9.5], 0.2, { mass: 2 }); P.basket(L, g, 0, 0, 0, { r: 0.27, h: 0.28, hex: COL.white, mat: M.satin }); P.clothesPile(L, g, 0, 0.18, 0, 3); dyn(g, 2, 'hull'); }
    { const g = prop(R, 'dog bowls', 'small', [11.62, 0, 8.6], PI / 2, { mass: 1.5 }); B.dogBowls(L, g); }
    { const g = prop(R, 'dog food bin', 'small', [11.55, 0, 9.3], PI / 2, { mass: 5 }); put(g, G.label(0.3, 0.5, 0.2, { pz: 'dogfood' }, 0x2d5f3f), M.print, [0, 0.25, 0]); }
  }
  // ================================================================ PANTRY / STORE / KITCHEN PANTRY
  {
    const lv = levels(13.3, 10.95, 2.4, 0.05); // pantry shelf tops (wall z 10.75, faces +z)
    const kinds = [['water', 'beer', 'tp', 'beer', 'carton', 'water'], ['chips', 'bins', 'baskets', 'chips', 'water'], ['cans', 'jars', 'cans', 'bottles', 'jars'], ['cereal', 'cereal', 'cereal', 'gap', 'cereal'], ['bins', 'baskets', 'tp', 'gap', 'bins']];
    const tops = [...lv].sort((a, b) => a - b);
    tops.forEach((y, i) => { const next = tops[i + 1] ?? (y + 0.45); const g = prop('pantry', 'pantry shelf ' + (i + 1), 'decor', [11.72, y, 11.12], 0, { mass: 15 }); fillShelf(L, g, 3.45, 0.36, Math.min(0.42, next - y - 0.03), 20 + i, kinds[Math.min(i, kinds.length - 1)]); });
    const ls = levels(14.45, 12.52, 2.6, 0.05); const ts = [...ls].sort((a, b) => a - b);
    ts.forEach((y, i) => { const next = ts[i + 1] ?? (y + 0.4); const g = prop('store', 'storage shelf ' + (i + 1), 'decor', [15.2, y, 12.36], PI, { mass: 10 }); fillShelf(L, g, 1.5, 0.33, Math.min(0.4, next - y - 0.03), 40 + i, i < 2 ? ['beer', 'water', 'carton'] : ['tp', 'bins', 'carton', 'linen']); });
    const lk = levels(22.6, 12.4, 2.6, 0.05); const tk = [...lk].sort((a, b) => a - b);
    tk.forEach((y, i) => { const next = tk[i + 1] ?? (y + 0.4); const g = prop('kpantry', 'kitchen pantry shelf ' + (i + 1), 'decor', [22.42, y, 11.25], -PI / 2, { mass: 12 }); fillShelf(L, g, 2.75, 0.36, Math.min(0.42, next - y - 0.03), 60 + i, i === 0 ? ['beer', 'water', 'beer'] : i === 1 ? ['appliance', 'appliance', 'gap', 'baskets'] : ['cereal', 'cans', 'jars', 'bottles', 'chips']); });
  }
  // ================================================================ OFFICE
  {
    const R = 'office'; const y = vs(20.0, 8.6, 1.2, 0.77);
    { const g = prop(R, 'dual monitors', 'electronics', [20.0, y, 8.62], PI, { mass: 10, fragile: true }); P.monitor(L, g, -0.34, 0, 0, 0.22, 0.6, 'monitor1'); P.monitor(L, g, 0.34, 0, 0, -0.22, 0.6, 'laptop'); }
    { const g = prop(R, 'keyboard + mouse', 'electronics', [20.0, y, 8.18], PI, { mass: 1 }); P.keyboard(L, g, 0, 0, 0, 0); }
    { const g = prop(R, 'coffee mug', 'small', [20.62, y, 8.25], 0, { mass: 0.3, fragile: true }); P.mug(L, g, 0, 0, 0, COL.charcoal, 1); dynFit(g, 0.3, 'hull'); }
    { const g = prop(R, 'papers + phone', 'small', [19.42, y, 8.35], 0.2, { mass: 0.4 }); put(g, G.label(0.21, 0.012, 0.29, { py: 'paper' }, 0xfbfaf6), M.print, [0, 0.006, 0]); P.phone(L, g, 0.02, 0.012, 0.0, -0.2); }
    { const g = prop(R, 'pc tower', 'electronics', [20.62, 0, 8.6], PI, { mass: 9 }); P.pcTower(L, g, 0, 0, 0); }
    { const g = prop(R, 'waste bin', 'small', [19.32, 0, 8.72], 0, { mass: 1 }); P.basket(L, g, 0, 0, 0, { r: 0.13, h: 0.3, hex: COL.charcoal, mat: M.satin }); dyn(g, 1, 'hull'); }
    { const yc = vs(21.9, 7.9, 1.4, 1.0); const g = prop(R, 'printer', 'electronics', [21.9, yc, 7.95], -PI / 2, { mass: 7 }); put(g, G.rbox(0.42, 0.2, 0.36, 0.02, 0xeeeeec), M.satin, [0, 0.1, 0]); put(g, G.box(0.3, 0.01, 0.2, 0xf8f8f6), M.matte, [0, 0.205, -0.05]); put(g, G.box(0.08, 0.03, 0.002, 0x3a8fd6), M.led, [0.13, 0.15, 0.181]); }
    { const lv = levels(18.8, 10.2, 2.4, 1.1); lv.forEach((yy, i) => { const g = prop(R, 'office books', 'decor', [19.58, yy, 9.98], PI, { mass: 5 }); P.bookRow(L, g, 0, 0, 0, 1.0 + (i % 2) * 0.3, { seed: 70 + i, hMax: 0.27, depth: 0.2 }); }); }
  }
  // ================================================================ GARAGE
  {
    const R = 'garage';
    { const g = prop(R, 'workbench + tools', 'furniture', [17.9, 0, 6.74], PI, { mass: 120 }); B.workbench(L, g, 1.8); solid(g); }
    { const g = prop(R, 'beer fridge', 'appliance', [19.42, 0, 6.72], PI, { mass: 35 }); B.beerFridge(L, g); solid(g); }
    { const g = prop(R, 'golf bag', 'decor', [20.15, 0, 6.82], 0, { mass: 12 }); g.rotation.x = -0.12; B.golfBag(L, g); solid(g); }
    [[11.72, 0x1d1d1d, COL.red, 'road bike'], [12.32, 0x2a5fa8, COL.white, 'kids bike']].forEach(([x, c, a, n], i) => { const g = prop(R, n, 'furniture', [x, 0, 3.2 + i * 0.25], 0, { mass: 9 }); if (i) g.scale.setScalar(0.8); B.bike(L, g, c, a); solid(g); });
    { const g = prop(R, 'surfboards on wall rack', 'decor', [11.62, 0, 3.3], 0, { mass: 8 });
      for (const [y, c, s] of [[1.55, COL.white, 0x2f6f73], [1.85, 0xe9d8b8, COL.rust], [2.15, 0x9fc9d6, COL.white]]) { const b = new L.THREE.Group(); b.position.set(0.05, y, 0); b.rotation.y = PI / 2; g.add(b); B.surfboard(L, b, 2.5, c, s); }
      for (const z of [-0.8, 0.8]) for (const y of [1.5, 1.8, 2.1]) put(g, G.box(0.36, 0.03, 0.04, 0x2b2b2b), M.satin, [0.0, y, z]); }
    // two steel shelf units (Poly Haven steel_frame_shelves_01, CC0) filled with bins + cartons
    L.later.push(async () => {
      const url = 'assets/ph/steel_frame_shelves_01/steel_frame_shelves_01_1k.gltf';
      for (const [x, s] of [[14.62, 1], [15.82, 2]]) {
        const m = await L.kit.loadModel(url); m.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        const w = L.kit.fitTo(m, 2.0, 'y'); const g = prop(R, 'steel shelving', 'furniture', [x, 0, 6.78], PI, { mass: 30 }); g.add(w);
        g.updateMatrixWorld(true); const bb = new L.THREE.Box3().setFromObject(w); const rc = new L.THREE.Raycaster(); const tops = [];
        for (let yy = 2.1; yy > 0.05;) { rc.set(new L.THREE.Vector3(x + 0.3, yy, 6.78), new L.THREE.Vector3(0, -1, 0)); const h = rc.intersectObject(w, true)[0]; if (!h) break; tops.push(h.point.y); yy = h.point.y - 0.05; }
        const sorted = tops.sort((a, b) => a - b);
        sorted.forEach((ty, i) => { const next = sorted[i + 1] ?? ty + 0.4; const fg = prop(R, 'garage shelf ' + (i + 1), 'decor', [x + (bb.max.x - bb.min.x) / 2 - 0.04, ty, 6.78 - (bb.max.z - bb.min.z) / 2 + 0.03], PI, { mass: 10 }); fillShelf(L, fg, bb.max.x - bb.min.x - 0.08, bb.max.z - bb.min.z - 0.06, Math.min(0.4, next - ty - 0.04), 90 + i + s * 7, ['carton', 'bins', 'paint', 'carton', 'baskets']); });
        solid(g);
      }
    });
    { const g = prop(R, 'storage tubs', 'small', [21.6, 0, 6.55], 0, { mass: 6 }); for (let i = 0; i < 2; i++) put(g, G.rbox(0.6, 0.32, 0.42, 0.03, i ? 0x2b2b2b : 0x2a5fa8), M.satin, [0, 0.16 + i * 0.33, 0]); solid(g); }
  }
}
