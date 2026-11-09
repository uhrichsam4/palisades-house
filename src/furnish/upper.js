// Upper floor (y = 3.35): bedrooms A/B/C, primary suite (bed, closet, bath, coffee bar), baths, theater,
// closet B, halls, balcony.
import * as P from './props.js';
import * as B from './big.js';
const { COL } = P; const PI = Math.PI; const F = 3.35;

export function buildUpper(L) {
  const { G, M, put, prop, solid, dyn, dynFit, vs, levels } = L;
  const at = (room, name, kind, x, z, from, ry = 0, o = {}) => { const y = o.y ?? vs(x, z, F + from, F); return prop(room, name, kind, [x, y, z], ry, o); };
  const fl = (room, name, kind, x, z, ry = 0, o = {}) => prop(room, name, kind, [x, F, z], ry, o);

  // ================================================================ BEDROOM A (guest / older son)
  {
    const R = 'bedA';
    { const g = fl(R, 'dresser', 'furniture', 11.68, 3.3, PI / 2, { mass: 70 }); B.dresser(L, g, 1.4, 0.8, 0.48, COL.walnut); L.shadows(g); solid(g);
      const tv = prop(R, 'tv on dresser', 'electronics', [11.7, F + 0.8, 3.3], PI / 2, { mass: 15, fragile: true }); put(tv, G.rbox(0.3, 0.015, 0.2, 0.004, COL.black), M.satin, [0, 0.0075, 0]); put(tv, G.box(0.05, 0.08, 0.03, COL.black), M.satin, [0, 0.05, -0.02]); put(tv, G.rbox(1.12, 0.65, 0.035, 0.005, COL.black), M.satin, [0, 0.42, -0.02]); put(tv, G.sheet(1.1, 0.62, 'tv'), M.screen, [0, 0.42, -0.0015]);
      const ph = prop(R, 'framed photo', 'decor', [11.68, F + 0.8, 2.75], PI / 2 + 0.3, { mass: 0.5, fragile: true }); P.frame(L, ph, 0, 0, 0, 0, 0.16, 0.2, 'photo1'); dyn(ph, 0.5); }
    { const y = vs(11.8, 1.27, F + 0.9, F + 0.4); const g = prop(R, 'clothes on chair', 'small', [11.8, y, 1.27], PI * 0.75, { mass: 1 }); P.clothesDrape(L, g, 0, 0, 0, 0, { hex: COL.denim, hex2: COL.charcoal, seat: 0.4 }); }
    { const y = vs(13.55, 2.75, F + 1.2, F + 0.6); const g = prop(R, 'laptop on bed', 'electronics', [13.6, y, 2.75], PI / 2 + 0.3, { mass: 1.5, fragile: true }); P.laptop(L, g, 0, 0, 0, 0, 1.9); }
    { const g = fl(R, 'sneakers', 'small', 12.9, 1.95, 0.9, { mass: 0.8 }); P.shoes(L, g, 0, 0, 0, 0, COL.black, COL.white); dyn(g, 0.8); }
    { const g = fl(R, 'duffel bag', 'small', 12.85, 4.6, 0.25, { mass: 4 }); put(g, G.cushion(0.6, 0.28, 0.3, 0.12, 0.04, COL.olive), M.fabric, [0, 0.14, 0]); put(g, G.torus(0.12, 0.012, COL.black, 4, 12, PI), M.satin, [0, 0.28, 0]); dyn(g, 4); }
    { const y = vs(15.38, 1.78, F + 1.0, F + 0.6); const g = prop(R, 'nightstand things', 'small', [15.38, y, 1.75], -PI / 2, { mass: 0.6 }); P.clock(L, g, -0.1, 0, 0, 0.3); P.phone(L, g, 0.12, 0, 0.05, 0.2); P.tumbler(L, g, 0.0, 0, 0.13); }
  }
  // ================================================================ BEDROOM B (gamer kid)
  {
    const R = 'bedB'; const dy = vs(17.8, 2.9, F + 1.1, F + 0.76);
    { const g = prop(R, 'gaming monitors', 'electronics', [17.72, dy, 2.88], PI / 2, { mass: 10, fragile: true }); P.monitor(L, g, -0.32, 0, 0, 0.25, 0.58, 'monitor2'); P.monitor(L, g, 0.32, 0, 0, -0.25, 0.58, 'arcade'); }
    { const g = prop(R, 'rgb keyboard', 'electronics', [17.98, dy, 2.88], PI / 2, { mass: 1 }); P.keyboard(L, g, 0, 0, 0, 0, true); }
    { const g = prop(R, 'gaming pc', 'electronics', [17.78, dy, 4.15], PI / 2, { mass: 10 }); P.pcTower(L, g, 0, 0, 0); }
    { const g = prop(R, 'headset + cans', 'small', [17.8, dy, 1.62], PI / 2, { mass: 0.6 }); P.headset(L, g, 0, 0, 0); P.drinkCan(L, g, 0.12, 0, 0.18, 'energy'); P.drinkCan(L, g, -0.08, 0, 0.22, 'energy', true, 1); }
    { const g = fl(R, 'bean bag', 'furniture', 19.4, 4.55, -PI * 0.7, { mass: 6 }); B.beanbag(L, g, COL.charcoal, 0.45); solid(g);
      const c = prop(R, 'controller', 'electronics', [19.35, F + 0.42, 4.6], 0.4, { mass: 0.3 }); P.controller(L, c, 0, 0, 0, 0, COL.black); }
    { const g = fl(R, 'clothes pile', 'small', 19.7, 1.7, 0.3, { mass: 2 }); P.clothesPile(L, g, 0, 0, 0, 2, [COL.charcoal, COL.white, COL.red, COL.denim, COL.black]); }
    { const g = prop(R, 'basketball', 'small', [18.7, F + 0.12, 5.65], 0, { mass: 0.6 }); put(g, G.sph(0.12, 0xc8611d, 16, 12), M.satin); dyn(g, 0.6, 'ball', { restitution: 0.75 }); }
    { const g = fl(R, 'hamper', 'furniture', 22.35, 5.55, 0, { mass: 3 }); P.hamper(L, g, 0, 0, 0, COL.charcoal, false); }
    { const g = fl(R, 'sneakers', 'small', 20.3, 4.75, -0.5, { mass: 0.8 }); P.shoes(L, g, 0, 0, 0, 0, COL.red, COL.white); dyn(g, 0.8); }
    { const y = vs(22.55, 4.6, F + 1.1, F + 0.6); const g = prop(R, 'nightstand things', 'small', [22.55, y, 4.65], -PI / 2, { mass: 0.5 }); P.phone(L, g, 0, 0, 0, 0.3); P.charger(L, g, 0.05, 0, -0.05, 2); }
  }
  // ================================================================ BEDROOM C (teen daughter)
  {
    const R = 'bedC'; const dy = vs(4.9, 9.7, F + 1.1, F + 0.79);
    { const g = prop(R, 'laptop', 'electronics', [4.88, dy, 9.65], -PI / 2, { mass: 1.5, fragile: true }); P.laptop(L, g, 0, 0, 0, 0, 1.9, 0xe9c9c0); }
    { const g = prop(R, 'books + candle', 'decor', [4.9, dy, 9.05], -PI / 2, { mass: 2 }); const t = P.bookStack(L, g, 0, 0, 0, 3, { seed: 15, w: 0.22, d: 0.16 }); P.candle(L, g, 0.0, t, 0, 0.035, 0.08, COL.blush); }
    { const g = prop(R, 'makeup + mirror', 'small', [4.9, dy, 10.2], -PI / 2, { mass: 0.5 }); P.bottlesBath(L, g, -0.1, 0, 0, 4); put(g, G.torus(0.1, 0.008, 0xd4a84b, 6, 20), M.metal, [0.0, 0.14, -0.08]); put(g, G.cyl(0.1, 0.1, 0.004, 0xd8e0e0, 20), M.chrome, [0, 0.14, -0.082], [PI / 2, 0, 0]); }
    { const g = fl(R, 'desk chair', 'furniture', 4.3, 9.65, PI / 2, { mass: 4 }); B.acrylicChair(L, g); dyn(g, 4); }
    { const y = vs(1.6, 10.5, F + 1.3, F + 0.6); const g = prop(R, 'teddy bear', 'decor', [1.45, y, 10.55], PI / 2 + 0.3, { mass: 0.4 }); put(g, G.sph(0.11, 0xc9a27a, 12, 10), M.knit, [0, 0.1, 0]); put(g, G.sph(0.075, 0xc9a27a, 12, 10), M.knit, [0, 0.25, 0.02]); for (const s of [-1, 1]) { put(g, G.sph(0.03, 0xc9a27a, 8, 6), M.knit, [s * 0.05, 0.32, 0.0]); put(g, G.sph(0.035, 0xc9a27a, 8, 6), M.knit, [s * 0.1, 0.04, 0.08]); } put(g, G.sph(0.012, 0x111111, 6, 4), M.gloss, [0, 0.25, 0.09]); }
    { const g = fl(R, 'slippers', 'small', 2.65, 8.8, PI / 2, { mass: 0.4 }); P.slippers(L, g, 0, 0, 0, 0, COL.blush); dyn(g, 0.4); }
    { const g = fl(R, 'bean bag', 'furniture', 3.95, 12.7, PI * 0.8, { mass: 5 }); B.beanbag(L, g, COL.blush, 0.42); solid(g); }
    { const g = fl(R, 'hamper', 'furniture', 4.85, 12.95, 0, { mass: 3 }); P.hamper(L, g, 0, 0, 0, COL.white); }
    { const g = fl(R, 'shopping bags', 'small', 4.35, 11.2, 0.4, { mass: 1 }); put(g, G.box(0.36, 0.42, 0.14, 0xf08bb2), M.satin, [0, 0.21, 0]); put(g, G.box(0.3, 0.36, 0.12, COL.white), M.satin, [0.25, 0.18, 0.1], [0, 0.4, 0]); for (const [x, z, h] of [[0, 0, 0.42], [0.25, 0.1, 0.36]]) put(g, G.torus(0.06, 0.005, COL.black, 4, 10, PI), M.satin, [x, h, z]); dyn(g, 1); }
    { const y = vs(0.9, 11.6, F + 1.0, F + 0.6); const g = prop(R, 'nightstand things', 'small', [0.92, y, 11.62], PI / 2, { mass: 0.5 }); P.phone(L, g, 0, 0, 0.0, 0.2); P.tumbler(L, g, -0.1, 0, -0.1); P.bookStack(L, g, 0.1, 0, -0.1, 2, { seed: 31, w: 0.18, d: 0.13 }); }
  }
  // ================================================================ PRIMARY BEDROOM
  {
    const R = 'primaryBed';
    for (const [z, n] of [[12.85, 1], [15.25, 2]]) { const g = fl(R, 'lounge chair', 'furniture', 10.7, z, -PI / 2, { mass: 25 }); P.loungeChair(L, g, { hex: COL.oat, frame: COL.walnut }); L.shadows(g); solid(g); }
    { const g = fl(R, 'side table', 'furniture', 10.75, 14.05, 0, { mass: 6 }); P.sideTable(L, g, 0, 0, 0, { r: 0.24, h: 0.52 }); solid(g); const t = prop(R, 'books + glasses', 'decor', [10.75, F + 0.52, 14.05], 0.4, { mass: 1 }); const yy = P.bookStack(L, t, 0, 0, 0, 2, { seed: 40, w: 0.24, d: 0.17 }); put(t, G.torus(0.025, 0.003, COL.black, 4, 12), M.satin, [0.02, yy + 0.004, 0.02], [PI / 2, 0, 0]); put(t, G.torus(0.025, 0.003, COL.black, 4, 12), M.satin, [0.08, yy + 0.004, 0.02], [PI / 2, 0, 0]); }
    { const g = fl(R, 'floor lamp', 'decor', 10.95, 12.2, 0, { mass: 5 }); P.floorLamp(L, g, 0, 0, 0, { h: 1.5 }); }
    { const y = vs(10.55, 12.85, F + 0.9, F + 0.4); const g = prop(R, 'throw on chair', 'decor', [10.6, y, 12.85], -PI / 2, { mass: 1 }); P.foldedBlanket(L, g, 0, 0, 0, 0.2, COL.cream); }
    { const y = vs(12.73, 14.7, F + 0.9, F + 0.45); const g = prop(R, 'robe on bench', 'small', [12.73, y, 14.4], PI / 2, { mass: 1.2 }); P.clothesDrape(L, g, 0, 0, 0, 0, { hex: COL.white, hex2: COL.white, seat: 0.5 }); }
    { const y = vs(15.12, 13.3, F + 1.0, F + 0.6); const g = prop(R, 'his nightstand', 'small', [15.12, y, 13.3], -PI / 2, { mass: 1 }); P.bookStack(L, g, 0.08, 0, 0, 2, { seed: 44 }); P.phone(L, g, -0.12, 0, 0.05, 0.4); P.tumbler(L, g, -0.12, 0, -0.12); }
    { const y = vs(15.12, 16.1, F + 1.0, F + 0.6); const g = prop(R, 'her nightstand', 'small', [15.12, y, 16.1], -PI / 2, { mass: 1 }); P.vaseFlowers(L, g, 0.08, 0, 0.0, { h: 0.16, n: 6, flower: COL.blush }); P.phone(L, g, -0.12, 0, -0.02, -0.2); P.charger(L, g, -0.1, 0, 0.05, 1); }
    { const g = fl(R, 'slippers', 'small', 14.55, 13.35, 0.3, { mass: 0.4 }); P.slippers(L, g, 0, 0, 0, 0, COL.oat); dyn(g, 0.4); }
    { const y = vs(10.6, 16.45, F + 1.1, F + 0.84); const g = prop(R, 'dresser top', 'decor', [10.6, y, 16.45], PI, { mass: 1 }); P.frame(L, g, -0.35, 0, 0, 0.2, 0.2, 0.25, 'photo0', 0xd4a84b); P.candle(L, g, 0.3, 0, 0, 0.05, 0.1); put(g, G.rbox(0.18, 0.08, 0.12, 0.01, COL.black), M.gloss, [0.05, 0.04, 0.0]); }
  }
  // ================================================================ PRIMARY CLOSET
  {
    const R = 'primaryCloset';
    { const y = vs(20.1, 11.5, F + 1.3, F + 0.9); const g = prop(R, 'island top', 'decor', [20.15, y, 11.5], 0, { mass: 2 });
      put(g, G.rbox(0.38, 0.26, 0.16, 0.03, 0xd8c3a5), M.satin, [-0.4, 0.13, 0.1]); put(g, G.torus(0.1, 0.01, 0xd8c3a5, 6, 14, PI), M.satin, [-0.4, 0.26, 0.1]); // handbag
      put(g, G.rbox(0.26, 0.09, 0.18, 0.01, COL.black), M.gloss, [0.25, 0.045, -0.1]); for (let i = 0; i < 3; i++) put(g, G.lathe([[0, 0], [0.03, 0], [0.03, 0.08], [0.012, 0.09], [0.012, 0.11], [0, 0.11]], [0xf3d9b0, 0xe6b8c8, 0xd8e0e0][i], 10), M.glass, [0.5 + i * 0.07, 0, 0.12]);
      put(g, G.torus(0.04, 0.008, 0xd4a84b, 6, 14), M.metal, [0.1, 0.008, 0.15], [PI / 2, 0, 0]); }
    { const g = fl(R, 'suitcase', 'small', 21.8, 13.6, 0.2, { mass: 6 }); put(g, G.rbox(0.42, 0.65, 0.26, 0.04, 0xcfc6b6), M.satin, [0, 0.36, 0]); for (const s of [-1, 1]) put(g, G.cyl(0.025, 0.025, 0.03, 0x111111, 8), M.satin, [s * 0.15, 0.025, 0.1], [0, 0, PI / 2]); put(g, G.box(0.18, 0.02, 0.02, 0x111111), M.satin, [0, 0.7, 0]); dyn(g, 6); }
    { const g = fl(R, 'hamper', 'furniture', 18.5, 13.65, 0, { mass: 3 }); P.hamper(L, g, 0, 0, 0, COL.oat); }
  }
  // ================================================================ PRIMARY BATH
  {
    const R = 'primaryBath'; const vy = (z) => vs(21.15, z, F + 1.2, F + 0.86);
    for (const [z, n] of [[16.75, 'his'], [17.95, 'hers']]) { const g = prop(R, n + ' sink things', 'small', [21.2, vy(z), z], -PI / 2, { mass: 0.6 }); P.soapPump(L, g, 0, 0, 0, 0xe9e4da); P.toothCup(L, g, 0.12, 0, 0.02); if (n === 'hers') P.bottlesBath(L, g, -0.28, 0, -0.02, 2); else { put(g, G.rbox(0.07, 0.15, 0.04, 0.015, 0x2b2b2b), M.gloss, [-0.18, 0.075, 0]); } }
    { const g = prop(R, 'folded towels + plant', 'decor', [21.15, vy(17.35), 17.35], -PI / 2, { mass: 2 }); P.towelFold(L, g, 0, 0, 0, 0, COL.white, 3); P.plant(L, g, 0, 0, -0.32, { r: 0.07, h: 0.1, hex: COL.white, size: 0.25, n: 10, seed: 3 }); }
    { const g = prop(R, 'tray + perfume', 'decor', [21.15, vy(19.25), 19.25], -PI / 2, { mass: 1, fragile: true }); put(g, G.rbox(0.3, 0.015, 0.2, 0.005, 0xd4a84b), M.brass, [0, 0.0075, 0]); for (let i = 0; i < 3; i++) put(g, G.lathe([[0, 0], [0.03, 0], [0.03, 0.09], [0.012, 0.1], [0.012, 0.12], [0, 0.12]], [0xf3d9b0, 0xd8e0e0, 0xe6b8c8][i], 10), M.glass, [-0.09 + i * 0.09, 0.015, 0]); }
    for (const [z, n] of [[16.25, 1], [18.45, 2]]) { const g = fl(R, 'bath mat', 'decor', 20.45, z, PI / 2, { mass: 0.5 }); P.bathMat(L, g, 0, 0, 0, 0, COL.white, 0.75, 0.5); }
    { const g = fl(R, 'hamper', 'furniture', 20.4, 14.82, 0, { mass: 3 }); P.hamper(L, g, 0, 0, 0, 0xc9b48e); }
    { const g = fl(R, 'scale', 'small', 19.8, 14.75, 0.1, { mass: 2 }); P.scale(L, g, 0, 0, 0); dyn(g, 2); }
  }
  // ================================================================ COFFEE BAR (vestibule)
  {
    const R = 'vestibule'; const y = vs(17.1, 12.5, F + 1.2, F + 0.9);
    { const g = prop(R, 'mugs + beans', 'small', [17.1, y, 12.3], -PI / 2, { mass: 1 }); P.mug(L, g, 0, 0, 0, COL.white, 0.5); P.mug(L, g, 0.12, 0, 0.04, COL.charcoal, 2); put(g, G.label(0.12, 0.2, 0.08, { pz: 'cook2' }, 0x20201f), M.print, [-0.2, 0.1, -0.02]); }
    { const g = prop(R, 'water bottles', 'small', [17.1, y, 13.0], -PI / 2, { mass: 1 }); for (let i = 0; i < 3; i++) P.bottle(L, g, i * 0.08, 0, 0, { hex: 0xdff1fb, label: 'water', h: 0.24, r: 0.033, cap: 0x1e7fc2 }); }
  }
  // ================================================================ THEATER
  {
    const R = 'theater';
    { const g = prop(R, 'popcorn bucket', 'small', [12.72, vs(12.72, 7.2, F + 0.9, F + 0.5), 7.2], 0.2, { mass: 0.3 }); put(g, G.label(0.14, 0.2, 0.14, { pz: 'popcorn', nz: 'popcorn', px: 'popcorn', nx: 'popcorn' }, 0xffffff), M.print, [0, 0.1, 0]); put(g, G.cushion(0.15, 0.06, 0.15, 0.05, 0.03, 0xfff1c9), M.matte, [0, 0.2, 0]); }
    { const y = vs(13.55, 9.05, F + 1.4, F + 0.8); const g = prop(R, 'blanket on recliner', 'decor', [13.55, y, 9.05], 0, { mass: 1.2 }); P.foldedBlanket(L, g, 0, 0, 0, 0.3, COL.charcoal); }
    { const y = vs(11.87, 7.15, F + 0.9, F + 0.5); const g = prop(R, 'throw on recliner', 'decor', [11.87, y, 7.15], 0, { mass: 1.2 }); P.foldedBlanket(L, g, 0, 0, 0, -0.2, 0x7a1d1a); }
    { const y = vs(14.4, 7.15, F + 0.9, F + 0.5); const g = prop(R, 'candy + soda', 'small', [14.4, y, 7.15], 0, { mass: 0.5 }); put(g, G.label(0.16, 0.03, 0.1, { py: 'menu' }, 0x111111), M.print, [0, 0.015, 0]); P.drinkCan(L, g, 0.12, 0, 0.05, 'soda1'); }
  }
  // ================================================================ BATHS A / B / C, GUEST BATH
  {
    const vanity = (R, x, z, ry, from = 1.3, mat = 0x2b2b2b) => { const y = vs(x, z, F + from, F + 0.8); const g = prop(R, 'toiletries', 'small', [x, y, z], ry, { mass: 0.6 }); P.soapPump(L, g, 0, 0, 0, mat); P.toothCup(L, g, 0.13, 0, 0.0); P.bottlesBath(L, g, -0.32, 0, 0, R.length); return g; };
    vanity('bathA', 16.1, 1.95, PI / 2); { const y = vs(16.1, 0.95, F + 1.3, F + 0.8); const g = prop('bathA', 'folded towels', 'decor', [16.1, y, 0.95], PI / 2, { mass: 1 }); P.towelFold(L, g, 0, 0, 0, 0, 0xd8d4cc, 2, 0.8); }
    { const g = fl('bathA', 'bath mat', 'decor', 16.75, 2.85, 0, { mass: 0.4 }); P.bathMat(L, g, 0, 0, 0, 0, 0xd8d4cc, 0.7, 0.45); }
    vanity('bathB', 21.85, 6.42, 0, 1.4, 0xe9e4da); { const g = fl('bathB', 'bath mat', 'decor', 21.4, 7.6, 0, { mass: 0.4 }); P.bathMat(L, g, 0, 0, 0, 0, COL.charcoal, 0.7, 0.45); }
    vanity('bathC', 5.6, 12.75, PI / 2, 1.3, 0xd4c8b4); { const y = vs(6.0, 10.5, F + 1.0, F + 0.4); const g = prop('bathC', 'rubber duck + bath stuff', 'small', [6.3, vs(6.3, 10.48, F + 1.0, F + 0.5), 10.48], PI / 2, { mass: 0.2 }); P.duck(L, g, 0, 0, 0, 0.5); P.bottlesBath(L, g, -0.45, 0, 0, 7); }
    { const g = fl('bathC', 'bath mat', 'decor', 7.3, 11.0, PI / 2, { mass: 0.4 }); P.bathMat(L, g, 0, 0, 0, 0, COL.white, 0.7, 0.45); }
    { const g = fl('bathC', 'tp basket', 'small', 7.85, 12.95, 0, { mass: 1 }); P.tpBasket(L, g, 0, 0, 0); }
    vanity('guestBath', 7.45, 6.95, PI, 1.4, 0x2b2b2b); { const y = vs(7.95, 6.95, F + 1.4, F + 0.9); const g = prop('guestBath', 'hand towels + fern', 'decor', [7.95, y, 6.95], PI, { mass: 1 }); P.towelFold(L, g, 0, 0, 0, 0, COL.white, 2, 0.6); }
    { const g = fl('guestBath', 'bath mat', 'decor', 6.0, 5.75, 0, { mass: 0.4 }); P.bathMat(L, g, 0, 0, 0, 0, COL.oat, 0.65, 0.42); }
  }
  // ================================================================ CLOSET B (clothes rods + shoes) + halls
  {
    const R = 'closetB';
    { const g = fl(R, 'clothes rod (wall)', 'furniture', 17.72, 7.5, PI / 2, { mass: 30 }); B.closetRun(L, g, 2.3, 5); solid(g); }
    { const g = fl(R, 'clothes rod (back)', 'furniture', 18.95, 8.68, PI, { mass: 25 }); B.closetRun(L, g, 1.6, 9); solid(g); }
    { const g = fl(R, 'laundry basket', 'small', 19.3, 7.3, 0.4, { mass: 2 }); P.basket(L, g, 0, 0, 0, { r: 0.25, h: 0.3, hex: COL.white, mat: M.satin }); P.clothesPile(L, g, 0, 0.18, 0, 6); dyn(g, 2, 'hull'); }
    { const g = fl('hallNS', 'robot vacuum', 'electronics', 17.12, 9.4, -PI / 2, { mass: 3.5 }); B.robotVac(L, g); dyn(g, 3.5); }
  }
  // ================================================================ BALCONY
  {
    const R = 'balcony'; const O = L.outdoor;
    for (const [x, n] of [[10.25, 1], [11.35, 2]]) { const g = fl(R, 'balcony chair', 'furniture', x, 18.35, 0.1 * (n === 1 ? 1 : -1), { mass: 12 }); B.patioChair(O, g, 0x2b2b2b, COL.cream); L.shadows(g); solid(g); }
    { const g = fl(R, 'balcony side table', 'furniture', 10.8, 18.55, 0, { mass: 5 }); P.sideTable(O, g, 0, 0, 0, { r: 0.2, h: 0.45, top: 0x2b2b2b }); solid(g); const t = prop(R, 'wine for two', 'small', [10.8, F + 0.45, 18.55], 0, { mass: 1, fragile: true }); P.bottle(O, t, -0.05, 0, 0, { hex: 0x4a0f12, label: 'wine' }); P.wineGlass(O, t, 0.08, 0, 0.06, 0x5a0f18); P.wineGlass(O, t, 0.06, 0, -0.09, 0x5a0f18); }
    { const g = fl(R, 'potted olive', 'decor', 8.72, 18.62, 0, { mass: 40 }); P.plant(O, g, 0, 0, 0, { r: 0.24, h: 0.45, hex: COL.charcoal, kind: 'tree', size: 1.1, n: 40, seed: 8 }); solid(g); }
  }
}
