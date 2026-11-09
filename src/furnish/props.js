// Prop factories. Each builds geometry into a group `g` in local coordinates (y up from the surface it
// stands on, +z = front). L = the toolkit from lib.js. Colours are baked into vertices so the palette
// materials (L.M.*) are shared by everything.
import * as THREE from 'three';
import { SPINES } from './atlas.js';

const PI = Math.PI;
export const COL = {
  white: 0xf4f2ee, cream: 0xe9e1d2, oat: 0xd8ccb8, sand: 0xc9b79c, taupe: 0x9c8f80, greige: 0xb8b0a4, charcoal: 0x34363a, black: 0x151515,
  navy: 0x23324f, sage: 0x8a9a7f, olive: 0x5d6a3e, rust: 0xa5532f, blush: 0xe3b7ab, teal: 0x2f6f73, terracotta: 0xb86a48, walnut: 0x5b3f2a,
  oak: 0xc89f6d, steel: 0xc8cacc, red: 0xc0282a, gold: 0xd4a84b, denim: 0x3b5579, grey: 0x8c8f93, green: 0x3f6b3a, pink: 0xf08bb2,
};

// ---------------------------------------------------------------- tableware / kitchen
export function mug(L, g, x, y, z, hex = COL.white, ry = 0) {
  const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.04, 0], [0.042, 0.004], [0.042, 0.095], [0.038, 0.095], [0.037, 0.008], [0, 0.008]], hex, 14), M.gloss, [x, y, z]);
  put(g, G.torus(0.024, 0.006, hex, 6, 12, PI), M.gloss, [x + Math.cos(ry) * 0.042, y + 0.05, z - Math.sin(ry) * 0.042], [0, ry, -PI / 2]);
}
export function plate(L, g, x, y, z, r = 0.135, hex = COL.white) { L.put(g, L.G.lathe([[0, 0], [r * 0.6, 0], [r * 0.65, 0.008], [r, 0.02], [r * 0.98, 0.022], [r * 0.6, 0.012], [0, 0.012]], hex, 14), L.M.gloss, [x, y, z]); }
export function bowl(L, g, x, y, z, r = 0.09, hex = COL.white, mat) { L.put(g, L.G.lathe([[0, 0], [r * 0.45, 0], [r * 0.85, r * 0.35], [r, r * 0.62], [r * 0.95, r * 0.62], [r * 0.8, r * 0.35], [0, r * 0.08]], hex, 14), mat || L.M.gloss, [x, y, z]); }
export function wineGlass(L, g, x, y, z, fill = 0) {
  const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.035, 0], [0.004, 0.006], [0.004, 0.1], [0.03, 0.13], [0.04, 0.18], [0.038, 0.2], [0.001, 0.2]], 0xffffff, 14), M.glass, [x, y, z]);
  if (fill) put(g, G.cyl(0.03, 0.022, 0.03, fill, 12), M.gloss, [x, y + 0.135, z]);
}
export function tumbler(L, g, x, y, z) { L.put(g, L.G.cyl(0.036, 0.032, 0.1, 0xffffff, 14), L.M.glass, [x, y + 0.05, z]); }
export function soloCup(L, g, x, y, z, tip = false) {
  const { G, M, put } = L; const geo = G.lathe([[0, 0], [0.03, 0], [0.047, 0.12], [0.044, 0.12], [0.028, 0.006], [0, 0.006]], COL.red, 14);
  const c = geo.attributes.color, p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); const inner = Math.hypot(p.getX(i), p.getZ(i)) < 0.0285 + yy * 0.13; if (inner || yy > 0.112) c.setXYZ(i, 0.9, 0.9, 0.88); }
  put(g, geo, M.gloss, tip ? [x, y + 0.04, z] : [x, y, z], tip ? [PI / 2, 0, 0.4] : [0, 0, 0]);
}
export function bottle(L, g, x, y, z, { hex = 0x1d3b1f, label = 'wine', h = 0.31, r = 0.037, cap = COL.black, tilt = null } = {}) {
  const { G, M, put } = L; const k = h / 0.31;
  const geo = G.lathe([[0, 0], [r, 0], [r, 0.2 * k], [r * 0.8, 0.235 * k], [r * 0.38, 0.255 * k], [r * 0.36, 0.3 * k], [r * 0.4, h], [0, h]], hex, 14);
  const lab = G.can(r * 1.012, 0.09 * k, label); L.xf(lab, 0, 0.1 * k, 0);
  const capG = G.cyl(r * 0.42, r * 0.42, 0.03 * k, cap, 10); L.xf(capG, 0, h - 0.012, 0);
  const rot = tilt || [0, 0, 0]; const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.set(...rot); g.add(grp);
  put(grp, geo, M.gloss); put(grp, lab, M.print); put(grp, capG, M.satin); return grp;
}
export function drinkCan(L, g, x, y, z, label = 'soda1', lying = false, ry = 0) { const m = L.put(g, L.G.can(0.033, 0.122, label), L.M.print, [x, y + (lying ? 0.033 : 0.061), z], lying ? [PI / 2, 0, ry] : [0, ry, 0]); m.material = L.M.print; return m; }
export function pizzaBoxes(L, g, x, y, z, n = 2, ry = 0, open = false) {
  const { G, M, put } = L; const s = 0.4;
  for (let i = 0; i < n; i++) put(g, G.label(s, 0.045, s, { py: 'pizza' }, COL.sand, { faceHex: 0xffffff }), M.print, [x, y + 0.0225 + i * 0.046, z], [0, ry + (i % 2) * 0.12, 0]);
  if (open) { // top box open: pizza with a few slices gone
    const yy = y + n * 0.046; put(g, G.box(s, 0.006, s, COL.sand), M.matte, [x, yy + 0.003, z + 0.6 * 0], [0, ry, 0]);
    const pz = G.cyl(0.17, 0.17, 0.012, 0xd9a24a, 20); const c = pz.attributes.color, p = pz.attributes.position; for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) < 0.15 && p.getY(i) > 0) c.setXYZ(i, 0.75, 0.25, 0.12);
    put(g, pz, M.matte, [x, yy + 0.012, z], [0, ry, 0]);
    for (let k = 0; k < 6; k++) { const a = k * 1.1; put(g, G.cyl(0.018, 0.018, 0.004, 0x7a1d14, 8), M.satin, [x + Math.cos(a) * 0.09, yy + 0.02, z + Math.sin(a) * 0.09]); }
  }
}
export function fruitBowl(L, g, x, y, z, r = 0.16) {
  const { G, M, put } = L; bowl(L, g, x, y, z, r, COL.walnut, M.satin);
  const fr = [[0xe0a32a, 0.038], [0xe0a32a, 0.038], [0x9fb43a, 0.034], [0xc0352a, 0.036], [0xe8c23a, 0.04], [0xc0352a, 0.036], [0x9fb43a, 0.034]];
  fr.forEach(([c, rr], i) => { const a = i * 0.9, d = i === 0 ? 0 : r * 0.45; put(g, G.sph(rr, c, 10, 8), M.gloss, [x + Math.cos(a) * d, y + r * 0.42 + (i === 0 ? 0.05 : 0) + (i > 4 ? 0.04 : 0), z + Math.sin(a) * d]); });
  // bananas
  for (let k = 0; k < 3; k++) put(g, G.tube([[-0.09, 0, 0], [-0.03, -0.02, 0.01], [0.04, -0.015, 0.0], [0.09, 0.02, 0]], 0.017, 0xe9c94a, 8, 6), M.satin, [x + 0.02, y + r * 0.65 + k * 0.012, z + 0.03 + k * 0.025], [0, 0.3 + k * 0.15, 0.2]);
}
export function toaster(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.28, 0.19, 0.17, 0.04, 0xd9dbdc), M.metal, [0, 0.095, 0]); for (const dx of [-0.05, 0.05]) put(t, G.box(0.18, 0.004, 0.028, COL.black), M.matte, [0, 0.19, dx]); put(t, G.box(0.02, 0.02, 0.03, COL.black), M.satin, [0.15, 0.15, 0]); put(t, G.box(0.26, 0.012, 0.15, COL.black), M.satin, [0, 0.006, 0]); }
export function kettle(L, g, x, y, z) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.085, 0], [0.09, 0.03], [0.085, 0.16], [0.06, 0.2], [0.02, 0.21], [0, 0.21]], COL.white, 14), M.gloss, [x, y + 0.02, z]); put(g, G.cyl(0.1, 0.1, 0.02, COL.black, 20), M.satin, [x, y + 0.01, z]); put(g, G.torus(0.07, 0.012, COL.black, 6, 14, PI), M.satin, [x - 0.06, y + 0.15, z], [0, 0, PI / 2 + 0.3]); put(g, G.cyl(0.012, 0.02, 0.08, COL.white, 8), M.gloss, [x + 0.09, y + 0.15, z], [0, 0, -0.9]); }
export function knifeBlock(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.12, 0.22, 0.16, 0.01, COL.walnut), M.satin, [0, 0.11, 0], [-0.35, 0, 0]); for (let i = 0; i < 5; i++) put(t, G.rbox(0.018, 0.1, 0.025, 0.006, COL.black), M.satin, [-0.04 + i * 0.02, 0.25 - (i % 2) * 0.02, -0.06 + (i % 2) * 0.03], [-0.35, 0, 0]); }
export function cuttingBoard(L, g, x, y, z, lean = true) { const { G, M, put } = L; if (lean) put(g, G.rbox(0.42, 0.3, 0.025, 0.02, 0xb98a5a), M.satin, [x, y + 0.15, z], [0.18, 0, 0]); else put(g, G.rbox(0.42, 0.025, 0.3, 0.02, 0xb98a5a), M.satin, [x, y + 0.0125, z]); }
export function crock(L, g, x, y, z) { const { G, M, put } = L; put(g, G.cyl(0.065, 0.06, 0.16, COL.cream, 16), M.gloss, [x, y + 0.08, z]); const hx = [[0.01, 0.02, 0.2], [-0.02, 0.01, 0.25], [0.015, -0.02, -0.25], [-0.01, -0.015, 0.1]]; hx.forEach(([dx, dz, t], i) => { put(g, G.cyl(0.008, 0.01, 0.3, i % 2 ? COL.black : 0xb98a5a, 6), M.satin, [x + dx, y + 0.24, z + dz], [t, 0, t * 0.6]); put(g, G.rbox(0.05, 0.07, 0.012, 0.01, i % 2 ? COL.black : 0xb98a5a), M.satin, [x + dx + Math.sin(t * 0.6) * -0.15, y + 0.39, z + dz + Math.sin(t) * 0.15], [t, 0, t * 0.6]); }); }
export function paperTowel(L, g, x, y, z) { const { G, M, put } = L; put(g, G.cyl(0.06, 0.06, 0.012, COL.black, 16), M.satin, [x, y + 0.006, z]); put(g, G.cyl(0.006, 0.006, 0.3, COL.black, 6), M.satin, [x, y + 0.16, z]); put(g, G.cyl(0.058, 0.058, 0.27, 0xfbfbf8, 18), M.fabric, [x, y + 0.15, z]); }
export function dishSoap(L, g, x, y, z) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.032, 0], [0.034, 0.12], [0.022, 0.16], [0.012, 0.165], [0, 0.165]], 0x8fae6a, 12), M.gloss, [x, y, z]); put(g, G.cyl(0.008, 0.012, 0.04, COL.black, 8), M.satin, [x, y + 0.18, z]); put(g, G.rbox(0.09, 0.025, 0.06, 0.008, 0xe7d36a), M.matte, [x + 0.09, y + 0.0125, z]); }
export function standMixer(L, g, x, y, z, ry = 0, hex = 0x9fb8c8) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.2, 0.05, 0.32, 0.03, hex), M.gloss, [0, 0.025, 0]); put(t, G.rbox(0.12, 0.28, 0.12, 0.05, hex), M.gloss, [0, 0.17, -0.1]); put(t, G.rbox(0.13, 0.12, 0.3, 0.05, hex), M.gloss, [0, 0.33, 0.02]); put(t, G.lathe([[0, 0], [0.05, 0], [0.1, 0.1], [0.11, 0.16], [0.105, 0.16], [0.095, 0.1], [0, 0.01]], 0xd8dadb, 14), M.metal, [0, 0.05, 0.06]); }
export function espresso(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.3, 0.36, 0.3, 0.02, 0xc8cacc), M.metal, [0, 0.18, 0]); put(t, G.box(0.28, 0.06, 0.12, COL.black), M.satin, [0, 0.28, 0.1]); put(t, G.cyl(0.035, 0.035, 0.05, COL.black, 12), M.satin, [0, 0.22, 0.16]); put(t, G.rbox(0.22, 0.015, 0.1, 0.005, 0x777777), M.metal, [0, 0.06, 0.15]); mug(L, t, 0.0, 0.07, 0.16, COL.white); }
export function cerealBox(L, g, x, y, z, name, ry = 0, s = 1) { L.put(g, L.G.label(0.2 * s, 0.29 * s, 0.07 * s, { pz: name, nz: name }, 0xe8e2d4), L.M.print, [x, y + 0.145 * s, z], [0, ry, 0]); }
// ---------------------------------------------------------------- books
// bookRow: books standing along local +x from (x,y,z), spines facing +z (toward the room). Returns length used.
export function bookRow(L, g, x, y, z, len, { seed = 1, hMax = 0.27, depth = 0.17, lean = true, gaps = true } = {}) {
  const { G, M, put } = L; const r = L.rng(seed); let at = 0;
  while (at < len - 0.03) {
    if (gaps && r() < 0.06) { at += 0.06 + r() * 0.1; continue; }
    const t = 0.018 + r() * 0.03, h = hMax * (0.72 + r() * 0.28), d = depth * (0.85 + r() * 0.15); if (at + t > len) break;
    const sp = 'spine' + ((r() * SPINES) | 0);
    const page = G.label(t, h, d, { pz: sp }, 0xeee6d2);
    put(g, page, M.print, [x + at + t / 2, y + h / 2, z - d / 2]); at += t + 0.001;
  }
  if (lean && at < len - 0.2) { const h = hMax * 0.85, t = 0.025; put(g, G.label(t, h, depth, { pz: 'spine' + ((r() * SPINES) | 0) }, 0xeee6d2), M.print, [x + at + 0.06, y + h / 2 * Math.cos(0.35) + 0.01, z - depth / 2], [0, 0, 0.35]); }
  return at;
}
export function bookStack(L, g, x, y, z, n = 3, { seed = 2, w = 0.24, d = 0.17, ry = 0, cover = null } = {}) {
  const { G, M, put } = L; const r = L.rng(seed); let yy = y;
  for (let i = 0; i < n; i++) { const t = 0.02 + r() * 0.025, ww = w * (0.85 + r() * 0.2), dd = d * (0.85 + r() * 0.2);
    const faces = { px: 'spine' + ((r() * SPINES) | 0) }; if (cover && i === n - 1) faces.py = cover;
    // spine runs along local x-face: rotate so the spine shows to the side
    const geo = G.label(t, dd, ww, faces, 0xeee6d2); L.xf(geo, 0, 0, 0, 0, 0, PI / 2);
    put(g, geo, M.print, [x, yy + t / 2, z], [0, ry + (r() - 0.5) * 0.25, 0]); yy += t; }
  return yy;
}
export function magazines(L, g, x, y, z, n = 3, ry = 0, seed = 3) { const { G, M, put } = L; const r = L.rng(seed); for (let i = 0; i < n; i++) put(g, G.label(0.21, 0.006, 0.28, { py: 'mag' + ((i + seed) % 4) }, 0xf2f0ea), M.print, [x + (r() - 0.5) * 0.04, y + 0.003 + i * 0.0065, z + (r() - 0.5) * 0.04], [0, ry + (r() - 0.5) * 0.4, 0]); }
// ---------------------------------------------------------------- electronics
export function laptop(L, g, x, y, z, ry = 0, open = 1.9, hex = 0xb9bcbf) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.31, 0.012, 0.215, 0.005, hex), M.metal, [0, 0.006, 0]); put(t, G.box(0.27, 0.001, 0.1, 0x222222), M.satin, [0, 0.0125, -0.02]); const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.105); lid.rotation.x = -(PI - open); t.add(lid); put(lid, G.rbox(0.31, 0.006, 0.215, 0.004, hex), M.metal, [0, -0.003, 0.1075]); const s = G.sheet(0.29, 0.19, 'laptop'); L.xf(s, 0, 0.0005, 0.108, -PI / 2, 0, 0); put(lid, s, M.screen); return t; }
export function monitor(L, g, x, y, z, ry = 0, w = 0.62, scr = 'monitor1') { const { G, M, put } = L; const h = w * 0.58; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.24, 0.012, 0.18, 0.004, COL.black), M.satin, [0, 0.006, 0]); put(t, G.box(0.04, 0.3, 0.025, COL.black), M.satin, [0, 0.16, -0.05]); put(t, G.rbox(w, h, 0.03, 0.006, COL.black), M.satin, [0, 0.18 + h / 2, -0.03]); put(t, G.sheet(w - 0.016, h - 0.016, scr), M.screen, [0, 0.18 + h / 2, -0.014]); return t; }
export function keyboard(L, g, x, y, z, ry = 0, rgb = false) { const { G, M, put } = L; put(g, rgb ? G.label(0.44, 0.022, 0.14, { py: 'keyboard' }, COL.black) : G.rbox(0.42, 0.018, 0.13, 0.005, 0xe6e6e6), rgb ? M.screen : M.satin, [x, y + 0.011, z], [0, ry, 0]); put(g, G.rbox(0.065, 0.025, 0.11, 0.025, rgb ? COL.black : 0xe6e6e6), M.satin, [x + Math.cos(ry) * 0.3, y + 0.012, z - Math.sin(ry) * 0.3], [0, ry, 0]); }
export function phone(L, g, x, y, z, ry = 0, up = true) { const { G, M, put } = L; put(g, G.rbox(0.072, 0.008, 0.15, 0.006, COL.black), M.gloss, [x, y + 0.004, z], [0, ry, 0]); if (up) put(g, G.sheet(0.066, 0.143, 'phone'), M.screen, [x, y + 0.0085, z], [-PI / 2, 0, ry]); }
export function remote(L, g, x, y, z, ry = 0) { const { G, M, put } = L; put(g, G.rbox(0.045, 0.018, 0.19, 0.008, COL.black), M.satin, [x, y + 0.009, z], [0, ry, 0]); }
export function controller(L, g, x, y, z, ry = 0, hex = COL.white) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.13, 0.035, 0.065, 0.016, hex), M.satin, [0, 0.025, 0]); for (const s of [-1, 1]) put(t, G.cyl(0.024, 0.02, 0.07, hex, 10), M.satin, [s * 0.055, 0.022, 0.03], [PI / 2 - 0.2, 0, s * 0.3]); put(t, G.box(0.05, 0.004, 0.03, COL.black), M.gloss, [0, 0.043, -0.005]); }
export function console5(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.1, 0.39, 0.26, 0.03, COL.white), M.satin, [0, 0.2, 0]); put(t, G.box(0.06, 0.37, 0.25, COL.black), M.gloss, [0, 0.2, 0]); put(t, G.box(0.002, 0.25, 0.004, 0x5aa0ff), M.led, [0.052, 0.22, 0.128]); }
export function speaker(L, g, x, y, z, hex = COL.black) { const { G, M, put } = L; put(g, G.rbox(0.12, 0.2, 0.12, 0.03, hex), M.matte, [x, y + 0.1, z]); put(g, G.cyl(0.03, 0.03, 0.003, 0x444444, 10), M.satin, [x, y + 0.201, z]); }
export function headset(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.torus(0.09, 0.012, COL.black, 6, 16, PI), M.satin, [0, 0.09, 0]); for (const s of [-1, 1]) put(t, G.cyl(0.045, 0.045, 0.04, 0x222222, 14), M.satin, [s * 0.09, 0.03, 0], [0, 0, PI / 2]); }
export function pcTower(L, g, x, y, z, ry = 0) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.22, 0.48, 0.46, 0.01, COL.black), M.satin, [0, 0.24, 0]); put(t, G.box(0.002, 0.42, 0.4, 0x6a3dff), M.led, [0.111, 0.25, 0]); for (let i = 0; i < 3; i++) put(t, G.torus(0.05, 0.004, [0xff3d7f, 0x3dd5ff, 0x6a3dff][i], 4, 16), M.led, [0, 0.36 - i * 0.12, 0.231]); }
export function clock(L, g, x, y, z, ry = 0, hex = COL.black) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); put(t, G.rbox(0.13, 0.07, 0.06, 0.02, hex), M.satin, [0, 0.035, 0]); put(t, G.box(0.1, 0.035, 0.001, 0xff5a3d), M.led, [0, 0.04, 0.0305]); }
export function charger(L, g, x, y, z, ry = 0) { const { G, put, M } = L; put(g, G.tube([[0, 0.002, 0], [0.06, 0.003, 0.05], [0.1, 0.003, -0.02], [0.18, 0.003, 0.03], [0.24, 0.003, 0]], 0.002, COL.white, 16, 4), M.satin, [x, y, z], [0, ry, 0]); }
// ---------------------------------------------------------------- textiles
// throw folded over a sofa/chair arm or back: top length a, drop b down the outside, thickness via 2 layers
export function throwOver(L, g, x, y, z, ry, { w = 0.55, top = 0.3, drop = 0.42, hex = COL.oat, knit = true, r = 0.06 } = {}) {
  const pts = []; for (let i = 0; i <= 6; i++) pts.push([0.002, -top / 2 + top * i / 6]);
  for (let i = 1; i <= 6; i++) { const a = i / 6 * PI / 2; pts.push([-r + Math.cos(a) * r + 0.002, top / 2 + Math.sin(a) * r]); }
  for (let i = 1; i <= 6; i++) pts.push([-r - drop * i / 6, top / 2 + r + 0.01 * Math.sin(i)]);
  const geo = L.G.cloth(w, pts, hex, { wrinkle: 0.01, seed: x * 3 + z }); L.put(g, geo, knit ? L.M.knit : L.M.fabric, [x, y, z], [0, ry, 0]);
}
export function foldedBlanket(L, g, x, y, z, ry = 0, hex = COL.oat, n = 1) { for (let i = 0; i < n; i++) L.put(g, L.G.cushion(0.45, 0.07, 0.32, 0.03, 0.01, i % 2 ? COL.cream : hex), L.M.knit, [x, y + 0.035 + i * 0.07, z], [0, ry + i * 0.05, 0]); }
export function pillow(L, g, x, y, z, ry = 0, hex = COL.cream, w = 0.48, rx = -0.35, mat) { L.put(g, L.G.cushion(w, 0.12, w * 0.95, 0.05, 0.04, hex), mat || L.M.fabric, [x, y, z], [rx, ry, 0]); }
export function towelFold(L, g, x, y, z, ry = 0, hex = COL.white, n = 1, s = 1) { for (let i = 0; i < n; i++) L.put(g, L.G.cushion(0.32 * s, 0.05 * s, 0.24 * s, 0.022, 0.006, hex), L.M.towel, [x, y + 0.025 * s + i * 0.05 * s, z], [0, ry + (i % 2) * 0.04, 0]); }
// towel hanging over a bar at (x,y,z) running along local x; frontDrop/backDrop lengths
export function towelOnBar(L, g, x, y, z, ry = 0, { w = 0.5, front = 0.55, back = 0.45, hex = COL.white, r = 0.016 } = {}) {
  const pts = []; for (let i = 0; i <= 8; i++) pts.push([-back + back * i / 8, -r - 0.003]);
  for (let i = 1; i < 8; i++) { const a = PI + i / 8 * PI; pts.push([Math.sin(a - PI) * (r + 0.004) * -1 + 0.0, Math.cos(a) * (r + 0.004)]); }
  pts.length = 0; // simpler explicit path: up the back, over the bar, down the front
  for (let i = 0; i <= 8; i++) pts.push([-back + back * i / 8, -r - 0.004 - 0.01 * (1 - i / 8)]);
  for (let i = 1; i <= 7; i++) { const a = PI - i / 8 * PI; pts.push([Math.sin(a) * (r + 0.006), -Math.cos(a) * (r + 0.006)]); }
  for (let i = 0; i <= 10; i++) pts.push([-front * i / 10, r + 0.006 + 0.006 * i / 10]);
  const geo = L.G.cloth(w, pts, hex, { wrinkle: 0.006, seed: x + z, segW: 8 }); L.put(g, geo, L.M.towel, [x, y, z], [0, ry, 0]);
}
export function bathMat(L, g, x, y, z, ry = 0, hex = COL.white, w = 0.8, d = 0.5) { L.put(g, L.G.cushion(w, 0.012, d, 0.01, 0.004, hex), L.M.towel, [x, y + 0.006, z], [0, ry, 0]); }
// clothes on a chair seat/back: a shirt draped (cloth) + jeans folded
export function clothesDrape(L, g, x, y, z, ry, { hex = COL.denim, hex2 = COL.white, seat = 0.45, back = 0.4 } = {}) {
  const pts = []; for (let i = 0; i <= 6; i++) pts.push([-0.003, -seat / 2 + i / 6 * seat]); for (let i = 1; i <= 6; i++) pts.push([-0.003 - 0.02 * i, seat / 2 + 0.005]); for (let i = 1; i <= 6; i++) pts.push([-0.12 - i / 6 * 0.25, seat / 2 + 0.01]);
  L.put(g, L.G.cloth(0.42, pts, hex2, { wrinkle: 0.012, seed: 5 }), L.M.fabric, [x, y, z], [0, ry + PI, 0]);
  L.put(g, L.G.cushion(0.38, 0.04, 0.26, 0.015, 0.008, hex), L.M.fabric, [x + 0.02, y + 0.02, z + 0.03], [0, ry + 0.2, 0]);
}
export function clothesPile(L, g, x, y, z, seed = 1, cols = [COL.denim, COL.white, COL.charcoal, COL.sage, COL.blush]) { const r = L.rng(seed); for (let i = 0; i < 5; i++) L.put(g, L.G.cushion(0.3 + r() * 0.15, 0.04, 0.22 + r() * 0.1, 0.02, 0.015, cols[(i + seed) % cols.length]), L.M.fabric, [x + (r() - 0.5) * 0.2, y + 0.02 + i * 0.03, z + (r() - 0.5) * 0.2], [(r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.2]); }
// a garment on a hanger: shirt/dress silhouette hanging below a rod point (origin = rod, hangs -y), faces +z
export function garment(L, g, x, y, z, hex, kind = 0, ry = 0) {
  const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t);
  put(t, G.torus(0.012, 0.002, COL.black, 4, 8, PI * 1.5), M.metal, [0, -0.012, 0], [0, PI / 2, 0]);
  const L2 = kind === 1 ? 1.05 : kind === 2 ? 0.95 : 0.72, w = kind === 2 ? 0.42 : 0.46;
  const body = G.cushion(w, L2, 0.05, 0.02, 0.0, hex, 1); const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / L2 + 0.5; const k = kind === 1 ? 0.7 + 0.5 * (1 - yy) : 1 - 0.12 * (1 - yy); p.setX(i, p.getX(i) * (yy > 0.88 ? 1 - (yy - 0.88) * 2.5 : k)); }
  body.computeVertexNormals(); put(t, body, M.fabric, [0, -0.04 - L2 / 2, 0]);
  if (kind !== 1) for (const s of [-1, 1]) put(t, G.cyl(0.035, 0.04, L2 * 0.85, hex, 5), M.fabric, [s * (w / 2 + 0.01), -0.06 - L2 * 0.42, 0], [0, 0, s * 0.08]);
}
export function shoes(L, g, x, y, z, ry = 0, hex = COL.white, sole = COL.white, spread = 0.12) { const { G, M, put } = L; for (const s of [-1, 1]) { put(g, G.rbox(0.1, 0.028, 0.28, 0.012, sole), M.satin, [x + Math.cos(ry) * s * spread / 2, y + 0.014, z - Math.sin(ry) * s * spread / 2], [0, ry + s * 0.08, 0]); put(g, G.cushion(0.092, 0.065, 0.24, 0.035, 0.012, hex), M.fabric, [x + Math.cos(ry) * s * spread / 2, y + 0.06, z - Math.sin(ry) * s * spread / 2 - 0.01], [0, ry + s * 0.08, 0]); } }
export function slippers(L, g, x, y, z, ry = 0, hex = COL.oat) { const { G, M, put } = L; for (const s of [-1, 1]) put(g, G.cushion(0.1, 0.035, 0.27, 0.03, 0.012, hex), M.knit, [x + Math.cos(ry) * s * 0.07, y + 0.018, z - Math.sin(ry) * s * 0.07], [0, ry + s * 0.1, 0]); }
// ---------------------------------------------------------------- bath
export function soapPump(L, g, x, y, z, hex = 0xe9e4da, mat) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.035, 0], [0.037, 0.13], [0.02, 0.145], [0, 0.145]], hex, 14), mat || M.gloss, [x, y, z]); put(g, G.cyl(0.008, 0.008, 0.04, COL.black, 6), M.satin, [x, y + 0.16, z]); put(g, G.box(0.05, 0.012, 0.014, COL.black), M.satin, [x + 0.02, y + 0.18, z]); }
export function toothCup(L, g, x, y, z, hex = COL.white) { const { G, M, put } = L; put(g, G.cyl(0.035, 0.03, 0.1, hex, 14), M.gloss, [x, y + 0.05, z]); [[0x3aa0e0, 0.25], [0xf08bb2, -0.2]].forEach(([c, t], i) => { put(g, G.cyl(0.005, 0.005, 0.17, c, 6), M.satin, [x + (i ? -0.01 : 0.01), y + 0.13, z], [0, 0, t]); }); }
export function tpRoll(L, g, x, y, z, upright = true) { L.put(g, L.G.cyl(0.055, 0.055, 0.1, 0xfbfbf8, 16), L.M.fabric, [x, y + (upright ? 0.05 : 0.055), z], upright ? [0, 0, 0] : [0, 0, PI / 2]); }
export function tpBasket(L, g, x, y, z) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.16, 0], [0.18, 0.22], [0.17, 0.22], [0.15, 0.01], [0, 0.01]], 0xc9b48e, 14), M.matte, [x, y, z]); for (let i = 0; i < 3; i++) tpRoll(L, g, x + [-0.07, 0.07, 0][i], y + (i === 2 ? 0.1 : 0.01), z + [0.03, 0.03, -0.04][i]); }
export function bottlesBath(L, g, x, y, z, seed = 1) { const { G, M, put } = L; const r = L.rng(seed); const cols = [0xf2efe8, 0x2b2b2b, 0xd8c3a5, 0xb7c9c2, 0x9a6b4a]; for (let i = 0; i < 3; i++) { const h = 0.12 + r() * 0.1, rr = 0.025 + r() * 0.012; put(g, G.lathe([[0, 0], [rr, 0], [rr, h], [rr * 0.5, h + 0.015], [0, h + 0.015]], cols[(i + seed) % 5], 12), M.gloss, [x + i * 0.07, y, z + (r() - 0.5) * 0.03]); put(g, G.cyl(0.01, 0.012, 0.025, COL.black, 8), M.satin, [x + i * 0.07, y + h + 0.025, z]); } }
export function candle(L, g, x, y, z, r = 0.045, h = 0.09, hex = COL.cream, lit = true) { const { G, M, put } = L; put(g, G.cyl(r * 1.15, r * 1.15, h, 0x2b2b2b, 16), M.gloss, [x, y + h / 2, z]); put(g, G.cyl(r, r, 0.004, hex, 14), M.matte, [x, y + h - 0.006, z]); if (lit) put(g, G.sph(0.006, 0xffb24a, 6, 4), M.led, [x, y + h + 0.004, z], [0, 0, 0]); }
export function duck(L, g, x, y, z, ry = 0) { const { G, M, put } = L; put(g, G.sph(0.04, 0xf5d020, 10, 8), M.gloss, [x, y + 0.035, z]); put(g, G.sph(0.025, 0xf5d020, 10, 8), M.gloss, [x + Math.cos(ry) * 0.03, y + 0.075, z - Math.sin(ry) * 0.03]); put(g, G.box(0.02, 0.008, 0.015, 0xf07a1a), M.gloss, [x + Math.cos(ry) * 0.055, y + 0.072, z - Math.sin(ry) * 0.055], [0, ry, 0]); }
export function hamper(L, g, x, y, z, hex = 0xc9b48e, lid = true) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.2, 0], [0.22, 0.55], [0.21, 0.55], [0.19, 0.02], [0, 0.02]], hex, 14), M.matte, [x, y, z]); if (lid) put(g, G.cyl(0.225, 0.225, 0.03, hex, 20), M.matte, [x, y + 0.565, z]); else clothesPile(L, g, x, y + 0.45, z, 4); }
export function scale(L, g, x, y, z, ry = 0) { const { G, M, put } = L; put(g, G.rbox(0.3, 0.025, 0.3, 0.02, 0x222222), M.gloss, [x, y + 0.0125, z], [0, ry, 0]); }
// ---------------------------------------------------------------- decor
export function pot(L, g, x, y, z, r, h, hex, mat) { L.put(g, L.G.lathe([[0, 0], [r * 0.78, 0], [r, h * 0.8], [r * 0.98, h], [r * 0.92, h], [r * 0.9, h * 0.85], [0, h * 0.85]], hex, 14), mat || L.M.satin, [x, y, z]); L.put(g, L.G.cyl(r * 0.9, r * 0.9, 0.01, 0x3a2a1e, 18), L.M.matte, [x, y + h * 0.84, z]); }
// leafy plant: n leaves on short stems from the soil, broad (monstera-ish) or strap (snake plant) or bush
export function plant(L, g, x, y, z, { r = 0.15, h = 0.3, hex = COL.white, kind = 'leafy', size = 0.6, seed = 1, n = 18, potMat } = {}) {
  const { G, M, put } = L; pot(L, g, x, y, z, r, h, hex, potMat); const rr = L.rng(seed); const sy = y + h * 0.84;
  for (let i = 0; i < n; i++) {
    const a = rr() * PI * 2, tilt = 0.15 + rr() * 0.6; const col = [0x3f6b2f, 0x4f7d36, 0x2f5a27, 0x5d8a3e][i % 4];
    if (kind === 'strap') { put(g, G.leaf(size * (0.6 + rr() * 0.5), 0.07, i % 3 ? 0x3d5f2c : 0x7a8f3a, 0.05, 4), M.leaf, [x + Math.cos(a) * r * 0.3, sy, z + Math.sin(a) * r * 0.3], [tilt * 0.3, a, 0]); continue; }
    if (kind === 'tree') { // trunk + crown of small leaves
      if (i === 0) put(g, G.cyl(0.018, 0.028, size, 0x6b5a48, 8), M.matte, [x, sy + size / 2, z]);
      for (let k = 0; k < 6; k++) { const aa = rr() * 6.28, d = rr() * size * 0.35, hy = size * (0.75 + rr() * 0.5); put(g, G.leaf(0.08, 0.025, k % 2 ? 0x7f8f6a : 0x5f7352, 0.2, 2), M.leaf, [x + Math.cos(aa) * d, sy + hy, z + Math.sin(aa) * d], [rr() * 1.5 - 0.3, rr() * 6.28, rr() - 0.5]); }
      continue;
    }
    const len = size * (0.5 + rr() * 0.5), stem = len * 0.55; const sx = x + Math.cos(a) * stem * Math.sin(tilt), sz = z + Math.sin(a) * stem * Math.sin(tilt);
    put(g, G.cyl(0.004, 0.005, stem, 0x4d6b35, 4), M.leaf, [(x + sx) / 2, sy + stem * Math.cos(tilt) / 2, (z + sz) / 2], [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt]);
    put(g, G.leaf(len * 0.55, len * (kind === 'bush' ? 0.18 : 0.36), col, 0.35, 4), M.leaf, [sx, sy + stem * Math.cos(tilt), sz], [0.5 + tilt, -a + PI / 2, 0]);
  }
}
export function vaseFlowers(L, g, x, y, z, { hex = COL.white, flower = 0xf6f2ea, n = 9, h = 0.25, seed = 4 } = {}) {
  const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.05, 0], [0.065, h * 0.5], [0.04, h * 0.9], [0.045, h], [0, h]], hex, 14), M.gloss, [x, y, z]); const r = L.rng(seed);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 0.04 + r() * 0.08, top = [x + Math.cos(a) * d, y + h + 0.12 + r() * 0.12, z + Math.sin(a) * d]; put(g, G.tube([[x, y + h * 0.6, z], [x + Math.cos(a) * d * 0.5, y + h + 0.05, z + Math.sin(a) * d * 0.5], top], 0.003, 0x4d6b35, 6, 4), M.leaf); put(g, G.sph(0.028, flower, 8, 6), M.matte, top); }
}
export function frame(L, g, x, y, z, ry, w, h, name, hex = COL.black, stand = true) { const { G, M, put } = L; const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = ry; g.add(t); if (stand) t.rotation.x = 0; put(t, G.rbox(w, h, 0.018, 0.003, hex), M.satin, [0, h / 2, 0], [stand ? -0.2 : 0, 0, 0]); const s = G.sheet(w * 0.8, h * 0.8, name); L.xf(s, 0, h / 2, 0.0095, stand ? -0.2 : 0, 0, 0); put(t, s, M.print); return t; }
export function boardGame(L, g, x, y, z, ry = 0, n = 2, seed = 0) { for (let i = 0; i < n; i++) L.put(g, L.G.label(0.3, 0.07, 0.3, { py: 'game' + ((i + seed) % 4) }, [0xc7352c, 0x1d6e3a, 0x2b4c9a, 0xf0c23a][(i + seed) % 4]), L.M.print, [x, y + 0.035 + i * 0.071, z], [0, ry + i * 0.15, 0]); }
// ---------------------------------------------------------------- furniture
export function sideTable(L, g, x, y, z, { r = 0.24, h = 0.55, top = COL.walnut, legs = COL.black } = {}) { const { G, M, put } = L; put(g, G.cyl(r, r, 0.03, top, 28), M.satin, [x, y + h - 0.015, z]); put(g, G.cyl(0.025, 0.025, h - 0.03, legs, 10), M.metal, [x, y + (h - 0.03) / 2, z]); put(g, G.cyl(r * 0.7, r * 0.75, 0.02, legs, 24), M.metal, [x, y + 0.01, z]); }
export function loungeChair(L, g, { hex = COL.oat, frame = COL.walnut } = {}) {
  const { G, M, put } = L; // local: seat centre at origin, faces +z, ~0.78 w x 0.8 d
  put(g, G.cushion(0.66, 0.14, 0.62, 0.06, 0.03, hex), M.fabric, [0, 0.4, 0.04]);
  put(g, G.cushion(0.66, 0.5, 0.14, 0.06, 0.02, hex), M.fabric, [0, 0.68, -0.27], [-0.18, 0, 0]);
  for (const s of [-1, 1]) { put(g, G.rbox(0.07, 0.25, 0.74, 0.03, frame), M.satin, [s * 0.37, 0.55, 0]); for (const zz of [-0.32, 0.32]) put(g, G.rbox(0.045, 0.34, 0.045, 0.012, frame), M.satin, [s * 0.36, 0.17, zz]); }
  put(g, G.rbox(0.7, 0.06, 0.66, 0.02, frame), M.satin, [0, 0.31, 0]);
}
export function floorLamp(L, g, x, y, z, { h = 1.55, shade = COL.cream } = {}) { const { G, M, put } = L; put(g, G.cyl(0.14, 0.15, 0.025, COL.black, 20), M.metal, [x, y + 0.0125, z]); put(g, G.cyl(0.011, 0.011, h, COL.black, 8), M.metal, [x, y + h / 2, z]); put(g, G.cyl(0.17, 0.2, 0.28, shade, 24), M.fabric, [x, y + h + 0.05, z]); put(g, G.cyl(0.15, 0.15, 0.005, 0xfff1d6, 16), M.led, [x, y + h - 0.085, z]); }
export function tableLamp(L, g, x, y, z, { base = COL.white, shade = COL.cream, h = 0.42 } = {}) { const { G, M, put } = L; put(g, G.lathe([[0, 0], [0.07, 0], [0.09, h * 0.35], [0.06, h * 0.55], [0.015, h * 0.6], [0, h * 0.6]], base, 14), M.gloss, [x, y, z]); put(g, G.cyl(0.11, 0.14, h * 0.45, shade, 22), M.fabric, [x, y + h * 0.78, z]); }
export function stool(L, g, x, y, z, hex = COL.oak) { const { G, M, put } = L; put(g, G.cyl(0.17, 0.17, 0.04, hex, 20), M.satin, [x, y + 0.45, z]); for (let i = 0; i < 3; i++) { const a = i * 2.09; put(g, G.cyl(0.015, 0.018, 0.45, hex, 6), M.satin, [x + Math.cos(a) * 0.11, y + 0.22, z + Math.sin(a) * 0.11], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]); } }
export function basket(L, g, x, y, z, { r = 0.2, h = 0.3, hex = 0xc9b48e, mat } = {}) { L.put(g, L.G.lathe([[0, 0], [r * 0.9, 0], [r, h], [r * 0.95, h], [r * 0.86, 0.015], [0, 0.015]], hex, 14), mat || L.M.matte, [x, y, z]); }
export function crate(L, g, x, y, z, w, h, d, ry = 0, name = 'carton') { L.put(g, L.G.label(w, h, d, { pz: name, px: name, nx: name, nz: name }, 0xb48a5a, { faceHex: 0xffffff }), L.M.print, [x, y + h / 2, z], [0, ry, 0]); L.put(g, L.G.box(w * 1.002, 0.002, 0.05, 0xc9b998), L.M.gloss, [x, y + h + 0.001, z], [0, ry, 0]); }
export function binRoller(L, g, hex = 0x2b2f2e, lidHex) { const { G, M, put } = L; put(g, G.rbox(0.58, 0.95, 0.72, 0.03, hex), M.satin, [0, 0.5, 0]); put(g, G.rbox(0.62, 0.05, 0.78, 0.02, lidHex ?? hex), M.satin, [0, 1.0, 0.02]); for (const s of [-1, 1]) put(g, G.cyl(0.1, 0.1, 0.06, 0x111111, 14), M.matte, [s * 0.27, 0.1, -0.34], [0, 0, PI / 2]); put(g, G.cyl(0.02, 0.02, 0.6, 0x111111, 6), M.satin, [0, 0.98, -0.4], [0, 0, PI / 2]); }
