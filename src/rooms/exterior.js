// Piece: exterior — Facade, roof, eaves, trims, chimney, garage doors, front steps, driveway, front landscaping
// Owned rooms: (exterior) | Reference photos: p00, p01, p44
//
// p00 (aerial, street side): charcoal architectural-shingle roofs with black fascia; big front gable over the
//   3-car garage wing (board-and-batten upper, two white battens), dark-brown vertical-plank garage doors,
//   black belly band at the floor line wrapping the garage wing + the SW block front, turret with a steep
//   faceted roof whose ridge runs back into the main hip, two skylights on the front slope, tall white
//   stucco chimney at the SW front corner, black box wall lanterns, concrete driveway slabs with
//   artificial-turf joints (diagonal grid), entry walk with steps between white planter walls, terraced
//   front beds (olive / lavender / boxwood), DG gravel yard and a curved lawn.
// p01 (street, pole camera ~4.6 m): same facade face-on; house-number pillar "17609", sidewalk + curb.
// p44 (aerial from the canyon): rear hip roofs, rear-ne gable, family-room gable, chimney stub, lanterns.
//
// Roofs: the shell's interim ROOFS massing is replaced IN PLACE (same 'roof:<id>' / 'soffit:<id>' / 'gable:<id>'
// mesh objects get new geometry) so pieces that patch those meshes (bedB, bedC) keep working. Roof surfaces are
// built as "min of planes" per convex-ish part (straight hip/gable geometry), with a 0.22 m heel so the soffit
// underside meets the wall plate, black fascia skirts on every edge and ridge caps on hips/ridges.
import { STREET_Y, FRONT } from './site/terrain.js';
import { cc0Plants, plantInstances } from './site/flora.js';
export const piece = { rooms: [], photos: ["p00", "p01", "p44"] };
export const ownCeiling = [];
export const views = {
  p00: { pos: [17.3, 16.6, -27.5], look: [17.3, 6.8, 4.0], fov: 50 },
  p01: { pos: [16.6, 4.9, -21.3], look: [16.6, 4.9, 10.0], fov: 55 },
  p44: { pos: [22.0, 10.5, 66.0], look: [21.0, 6.8, 11.0], fov: 52 },
};

// Front grade: the street level lives in site/terrain.js (STREET_Y, ~0.95 m below the floor per videos v01/v08/v09;
// the terrain is cut down to it). Driveway slope, entry steps and the front walls follow it.
const WALK_Y = STREET_Y + 0.15;  // sidewalk top / curb top
const HEEL = 0.22, TH = 0.22;    // roof heel above the plate at the wall line, roof (fascia) depth

export async function build(ctx) {
  const { THREE, kit, phys, root } = ctx; const M = kit.M; const P = ctx.plan;
  const std = (o) => kit.outdoor(new THREE.MeshStandardMaterial(o));
  const r0 = kit.rng(4242);

  // ================================================================ procedural textures (drawn unfiltered)
  function vnoise(seed, n) { // tileable value noise on an n×n lattice, returns f(u,v) in [0,1], u,v in [0,1)
    const r = kit.rng(seed); const g = Array.from({ length: n * n }, () => r());
    const s = (t) => t * t * (3 - 2 * t);
    return (u, v) => { const x = u * n, y = v * n; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const G = (i, j) => g[(((yi + j) % n + n) % n) * n + (((xi + i) % n + n) % n)];
      const a = G(0, 0) + (G(1, 0) - G(0, 0)) * s(xf), b = G(0, 1) + (G(1, 1) - G(0, 1)) * s(xf); return a + (b - a) * s(yf); };
  }
  function normalFromHeight(h, W, H, strength) {
    return kit.canvasTex(W, H, (g) => {
      const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (h[y * W + (x + 1) % W] - h[y * W + (x - 1 + W) % W]) * strength;
        const dy = (h[((y + 1) % H) * W + x] - h[((y - 1 + H) % H) * W + x]) * strength;
        const nz = 1 / Math.hypot(dx, dy, 1); const i = (y * W + x) * 4;
        img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, { srgb: false });
  }
  function pixelTex(W, H, fn, opt = {}) { // fn(x,y) -> [r,g,b]; returns {map, data}
    const map = kit.canvasTex(W, H, (g) => { const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y); const i = (y * W + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0); }, opt);
    return map;
  }

  // ---- charcoal laminated architectural shingles: 1024 px = 2.0 m, 14 courses (0.143 m exposure)
  function shingleTex() {
    const W = 1024, H = 1024, rows = 14, r = kit.rng(77);
    const col = new Float32Array(W * H * 3), hgt = new Float32Array(W * H);
    for (let row = 0; row < rows; row++) {
      const y0 = Math.round(row * H / rows), y1 = Math.round((row + 1) * H / rows), rh = y1 - y0;
      let x = Math.floor(r() * W), done = 0;
      while (done < W) {
        const tw = Math.min(W - done, Math.floor(60 + r() * 180)); const t = (r() - 0.5) * 16; const warm = r() < 0.25 ? 3 : 0;
        const tooth = rh * (0.30 + r() * 0.35); const slit = r() < 0.55;
        for (let k = 0; k < tw; k++) {
          const xx = (x + k) % W;
          for (let y = y0; y < y1; y++) {
            const i = y * W + xx, fy = (y - y0) / rh; // 0 = up-slope .. 1 = butt edge
            let v = 66 + t + (r() - 0.5) * 30;          // granules
            if (y1 - y < tooth) v -= 14;                // laminated dark tooth (lower part of the tab)
            if (y1 - y <= 3) v *= 0.45;                 // shadow under the butt
            if (slit && k < 3 && y1 - y < tooth) v *= 0.55;
            col[i * 3] = v + warm; col[i * 3 + 1] = v + warm * 0.6; col[i * 3 + 2] = v + 2;
            hgt[i] = fy * 0.9 + (y1 - y < tooth ? 0.25 : 0) + (r() - 0.5) * 0.12;
          }
        }
        x += tw; done += tw;
      }
    }
    const map = pixelTex(W, H, (x, y) => { const i = (y * W + x) * 3; return [col[i], col[i + 1], col[i + 2]]; });
    return { map, normalMap: normalFromHeight(hgt, W, H, 2.2) };
  }
  // ---- white board-and-batten siding: 512 px = 2.4 m; 0.30 m boards with 0.05 m battens
  function sidingTex() {
    const W = 512, H = 512, pxm = W / 2.4, n = vnoise(3, 8); const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x / pxm) % 0.30; hgt[y * W + x] = (u < 0.05 ? 1 : 0) + n(x / W, y / H) * 0.05; }
    const map = pixelTex(W, H, (x, y) => { const u = (x / pxm) % 0.30; const v = 246 + (n(x / W, y / H) - 0.5) * 6 - (u > 0.05 && u < 0.058 ? 16 : 0); return [v, v - 3, v - 10]; }); /* warm white ~#efece6 (p01), not blue-grey */
    return { map, normalMap: normalFromHeight(hgt, W, H, 1.6) };
  }
  // ---- vertical-plank garage door: 512 px = 1.2 m, 0.15 m boards
  function doorTex() {
    const W = 512, H = 512, pxm = W / 1.2, r = kit.rng(9), n = vnoise(5, 16); const hgt = new Float32Array(W * H);
    const tones = Array.from({ length: 8 }, () => (r() - 0.5) * 10);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x / pxm) % 0.15; hgt[y * W + x] = u < 0.006 ? 0 : 1; }
    const map = pixelTex(W, H, (x, y) => { const b = Math.floor(x / pxm / 0.15) % 8; const u = (x / pxm) % 0.15;
      const grain = Math.sin((x * 0.9 + n(x / W * 4 % 1, y / H) * 60) * 0.35) * 4 + (n((x / W * 3) % 1, (y / H * 0.5) % 1) - 0.5) * 16;
      let v = 1 + tones[b] / 60 + grain / 70; if (u < 0.006) v *= 0.4; return [47 * v, 37 * v, 31 * v]; }); /* dark espresso-stained wood ~#2f251f (p01: near-black doors, grain just visible) */
    return { map, normalMap: normalFromHeight(hgt, W, H, 3.0) };
  }
  function speckleTex(W, base, spread, seed, opt = {}) { // generic mottled surface (concrete, gravel, soil, turf, asphalt)
    const r = kit.rng(seed), n1 = vnoise(seed + 1, 6), n2 = vnoise(seed + 2, 24);
    const hgt = new Float32Array(W * W);
    const map = pixelTex(W, W, (x, y) => {
      const u = x / W, v = y / W; const m = (n1(u, v) - 0.5) * spread[0] + (n2(u, v) - 0.5) * spread[1] + (r() - 0.5) * spread[2];
      const pebble = opt.pebbles && r() < opt.pebbles ? (r() - 0.5) * opt.pebbleAmp : 0;
      hgt[y * W + x] = m / 40 + pebble / 30 + (opt.blades ? Math.sin(x * 2.1 + n2(u, v) * 9) * 0.6 : 0);
      const c = base.map((b, k) => b + m + pebble + (opt.tint ? opt.tint[k] * (n1(u, v) - 0.5) : 0)); return c; });
    return { map, normalMap: normalFromHeight(hgt, W, W, opt.nStrength ?? 1.2) };
  }

  // ================================================================ materials
  const sh = shingleTex();
  const shingleRep = 0.5;
  for (const m of [M.shingles]) { // also patched below on the actual roof-mesh materials (others may have cloned)
    m.map = sh.map; m.normalMap = sh.normalMap; m.map.repeat.set(shingleRep, shingleRep); m.normalMap.repeat.set(shingleRep, shingleRep);
  }
  // dark charcoal shingles (v05/p41: the roof reads near-black even at grazing angles, so damp the sky reflection)
  const styleShingle = (m) => { m.map = sh.map; m.normalMap = sh.normalMap; m.normalScale = new THREE.Vector2(0.9, 0.9); m.color = new THREE.Color(0xb4b4b4); m.roughness = 0.92; m.metalness = 0; m.envMapIntensity = 0.5; m.needsUpdate = true; };
  styleShingle(M.shingles);
  const styleSoffit = (m) => { m.color = new THREE.Color(0x26221f); m.roughness = 0.75; m.needsUpdate = true; };
  styleSoffit(M.soffit);
  const fasciaMat = std({ color: 0x1b1918, roughness: 0.55, side: THREE.DoubleSide });
  const trimMat = std({ color: 0x2b211c, roughness: 0.5 });           // belly band / frieze (very dark brown, p00)
  const capMat = std({ color: 0x2f2f30, roughness: 0.9 });             // ridge caps
  const sd = sidingTex(); sd.map.repeat.set(1 / 2.4, 1 / 2.4); sd.normalMap.repeat.set(1 / 2.4, 1 / 2.4);
  const sidingMat = std({ map: sd.map, normalMap: sd.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), roughness: 0.85, side: THREE.DoubleSide }); kit.outdoor(sidingMat); sidingMat.envMapIntensity = 1.7; sidingMat.color = new THREE.Color(0xfff6ea); /* p01/p39: real-sky ambient so the shaded north face reads white, not mid-grey */
  const stucco = M.extWhite; kit.outdoor(stucco);
  const stuccoD = M.extWhiteDouble; kit.outdoor(stuccoD);
  /* facade (p01): warm white, a visible fine stucco texture on the lower storey, less blue sky sheen */
  for (const m of [stucco, stuccoD]) { m.color = new THREE.Color(0xfaf5ec); m.envMapIntensity = 1.1; }
  if (stucco.normalMap) stucco.normalScale = new THREE.Vector2(0.4, 0.4);

  const dt = doorTex();
  const concrete = speckleTex(512, [146, 140, 131], [14, 8, 10], 21, { nStrength: 0.8 }); concrete.map.repeat.set(0.4, 0.4); concrete.normalMap.repeat.set(0.4, 0.4);
  const concreteMat = std({ map: concrete.map, normalMap: concrete.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92 });
  const capStone = std({ map: concrete.map, color: 0xf4f1ea, roughness: 0.85 });
  const turf = speckleTex(256, [74, 108, 36], [14, 12, 22], 31, { blades: true, nStrength: 2.5, tint: [10, 14, 0] }); turf.map.repeat.set(1.5, 1.5); turf.normalMap.repeat.set(1.5, 1.5);
  const turfMat = std({ map: turf.map, normalMap: turf.normalMap, roughness: 0.95 });
  const gravel = speckleTex(512, [160, 140, 112], [12, 12, 26], 41, { pebbles: 0.08, pebbleAmp: 60, nStrength: 2.5 }); gravel.map.repeat.set(0.6, 0.6); gravel.normalMap.repeat.set(0.6, 0.6);
  const gravelMat = std({ map: gravel.map, normalMap: gravel.normalMap, roughness: 1 });
  const soil = speckleTex(256, [74, 58, 44], [10, 8, 18], 51, { pebbles: 0.1, pebbleAmp: 30, nStrength: 2 }); soil.map.repeat.set(1, 1); soil.normalMap.repeat.set(1, 1);
  const soilMat = std({ map: soil.map, normalMap: soil.normalMap, roughness: 1 });
  const asphalt = speckleTex(512, [96, 93, 90], [12, 8, 26], 61, { pebbles: 0.05, pebbleAmp: 40, nStrength: 1.5 }); asphalt.map.repeat.set(0.25, 0.25); asphalt.normalMap.repeat.set(0.25, 0.25);
  const asphaltMat = std({ map: asphalt.map, normalMap: asphalt.normalMap, roughness: 0.95 });
  const timberMat = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 0.3] }), color: 0xb07a52, roughness: 0.8 });
  const doorMatFor = (w, h) => { const m = std({ map: dt.map.clone(), normalMap: dt.normalMap.clone(), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.6, metalness: 0 });
    m.map.repeat.set(w / 1.2, h / 1.2); m.normalMap.repeat.set(w / 1.2, h / 1.2); m.map.needsUpdate = m.normalMap.needsUpdate = true; return m; };
  /* garage door inner face: white steel, 4 sections per 2.4 m + shallow stamped rails */
  const steelTex = (() => { const W = 256, hgt = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = (y / W * 4) % 1; hgt[y * W + x] = (v < 0.03 ? 0 : 1) + (Math.abs(v - 0.5) < 0.18 ? 0.25 : 0); }
    return { map: pixelTex(W, W, (x, y) => { const v = (y / W * 4) % 1; const c = v < 0.03 ? 200 : 236; return [c, c, c - 2]; }), normalMap: normalFromHeight(hgt, W, W, 2.0) }; })();
  const steelMat = std({ color: 0xffffff, roughness: 0.45, metalness: 0.2 });
  const lanternMetal = std({ color: 0x151413, roughness: 0.45, metalness: 0.6 });
  const lanternGlass = kit.outdoor(new THREE.MeshPhysicalMaterial({ color: 0xfff1d8, roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false }));
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0.45 });
  const skyGlass = kit.outdoor(new THREE.MeshPhysicalMaterial({ color: 0x1c2428, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.0 })); /* dark tinted glass that reflects the sky (was a glowing cyan) */
  const winGlass = kit.outdoor(new THREE.MeshPhysicalMaterial({ color: 0x5a646c, roughness: 0.04, metalness: 0.3, envMapIntensity: 2.2 }));

  // ================================================================ roof engine
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const PLN = (px, pz, nx, nz, s, plate) => ({ px, pz, nx, nz, s, base: plate + HEEL });
  const edgePlane = (a, b, inside, s, plate) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); let nx = -dz / L, nz = dx / L;
    if ((inside[0] - a[0]) * nx + (inside[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
    return { px: a[0], pz: a[1], nx, nz, s, base: plate + HEEL };
  };
  const hAt = (p, x, z) => p.base + p.s * ((x - p.px) * p.nx + (z - p.pz) * p.nz);
  const clip = (poly, f) => { const out = [];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    return out; };
  const dedupe = (poly) => { const o = []; for (const p of poly) { const q = o[o.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) o.push(p); }
    while (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-5) o.pop(); return o; };
  const area = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = dx * dx + dz * dz; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };

  /* Buried roof geometry: where one roof part runs under another (eaves/soffits/fascia of rear-ne, primary and the
     garage wing overlap above the upstairs primary suite) the hidden part used to hang through the vaulted ceilings
     (p17/p19). Inside the CUT room rects, roof surface / soffit / fascia / ridge pieces that sit below another part's
     roof surface are dropped (never visible from outside: they're under that other roof). */
  const CUT = Object.values(P.ROOMS).filter(r => r.level === 1 && !r.outdoor && r.rect).map(r => r.rect).map(r => [r[0] - 0.16, r[1] - 0.16, r[2] + 0.16, r[3] + 0.16]); /* every indoor upper-floor room (p15/p16/p32: hall, landing, theater) */
  const inCut = (x, z) => CUT.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  let allParts = [];
  const buried = (x, z, y, self) => { if (!inCut(x, z)) return false; for (const q of allParts) if (q !== self && inPoly(x, z, q.foot) && heightOf(q.planes, x, z) > y + 0.04) return true; return false; };
  /* split a roof-plane polygon into the bits outside the CUT rects (whole) and a 0.25 m grid of cells inside them */
  function cutPieces(poly) {
    if (!CUT.length) return [poly];
    let out = [poly];
    for (const r of CUT) {
      const next = [];
      for (const pc of out) {
        next.push(clip(pc, ([x]) => x - r[0]), clip(pc, ([x]) => r[2] - x));
        const mid = clip(clip(pc, ([x]) => r[0] - x), ([x]) => x - r[2]);
        next.push(clip(mid, ([, z]) => z - r[1]), clip(mid, ([, z]) => r[3] - z));
        const ins = clip(clip(mid, ([, z]) => r[1] - z), ([, z]) => z - r[3]);
        if (ins.length >= 3) { const G = 0.25;
          for (let gx = r[0]; gx < r[2]; gx += G) { const cx = clip(clip(ins, ([x]) => gx - x), ([x]) => x - Math.min(r[2], gx + G)); if (cx.length < 3) continue;
            for (let gz = r[1]; gz < r[3]; gz += G) { const c = clip(clip(cx, ([, z]) => gz - z), ([, z]) => z - Math.min(r[3], gz + G)); if (c.length >= 3) next.push(c); } } }
      }
      out = next.map(dedupe).filter(pc => pc.length >= 3 && Math.abs(area(pc)) > 1e-6);
    }
    return out;
  }
  // part = { planes, foot } -> accumulates into buffers
  function roofPart(part, acc) {
    const { planes, foot } = part;
    const onFoot = (p) => { for (let k = 0; k < foot.length; k++) if (segDist(p, foot[k], foot[(k + 1) % foot.length]) < 1e-4) return k; return -1; };
    for (let i = 0; i < planes.length; i++) {
      const A = planes[i]; let poly0 = foot.map(p => [p[0], p[1]]);
      for (let j = 0; j < planes.length && poly0.length >= 3; j++) if (j !== i) { const B = planes[j]; poly0 = clip(poly0, ([x, z]) => hAt(A, x, z) - hAt(B, x, z) - 1e-7); }
      poly0 = dedupe(poly0); if (poly0.length < 3 || Math.abs(area(poly0)) < 1e-4) continue;
      const tx = -A.nz, tz = A.nx, k = Math.sqrt(1 + A.s * A.s);
      const vtx = (p, dy) => [p[0], hAt(A, p[0], p[1]) + dy, p[1]];
      const uvOf = (p) => [p[0] * tx + p[1] * tz, ((p[0] - A.px) * A.nx + (p[1] - A.pz) * A.nz) * k];
      for (const poly of cutPieces(poly0)) {
        let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
        if (buried(cx, cz, hAt(A, cx, cz), part) && poly.every(p => buried(p[0] + (cx - p[0]) * 0.02, p[1] + (cz - p[1]) * 0.02, hAt(A, p[0], p[1]), part))) continue; /* only cells fully under another roof: keeps the outside silhouette whole */
        const tris = THREE.ShapeUtils.triangulateShape(poly.map(p => V2(p[0], p[1])), []);
        for (const [a, b, c] of tris) {
          let P0 = poly[a], P1 = poly[b], P2 = poly[c];
          const cy = (P1[1] - P0[1]) * (P2[0] - P0[0]) - (P1[0] - P0[0]) * (P2[1] - P0[1]);
          if (cy < 0) { const t = P1; P1 = P2; P2 = t; }
          for (const p of [P0, P1, P2]) { acc.top.push(...vtx(p, 0)); acc.uv.push(...uvOf(p)); acc.und.push(...vtx(p, -TH)); }
        }
      }
      const poly = poly0;
      for (let e = 0; e < poly.length; e++) {
        const a = poly[e], b = poly[(e + 1) % poly.length];
        const fa = onFoot(a), fb = onFoot(b); const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (fa >= 0 && fb >= 0 && onFoot(mid) >= 0) { /* eave / rake skirt (fascia), in 0.1 m steps where it crosses a CUT room */
          const FD = TH + 0.09; /* fascia board hangs a little below the soffit (p01: deep black fascia) */
          const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]); const hit = CUT.some(r => Math.max(a[0], b[0]) > r[0] && Math.min(a[0], b[0]) < r[2] && Math.max(a[1], b[1]) > r[1] && Math.min(a[1], b[1]) < r[3]); const n = hit ? Math.max(1, Math.ceil(L0 / 0.1)) : 1;
          for (let q = 0; q < n; q++) {
            const pa = [a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n], pb = [a[0] + (b[0] - a[0]) * (q + 1) / n, a[1] + (b[1] - a[1]) * (q + 1) / n];
            const mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2; if (n > 1 && buried(mx, mz, hAt(A, mx, mz) - FD, part)) continue;
            const ya = hAt(A, pa[0], pa[1]), yb = hAt(A, pb[0], pb[1]); const u0 = L0 * q / n, u1 = L0 * (q + 1) / n;
            acc.skirt.push(pa[0], ya + 0.01, pa[1], pb[0], yb + 0.01, pb[1], pb[0], yb - FD, pb[1], pa[0], ya + 0.01, pa[1], pb[0], yb - FD, pb[1], pa[0], ya - FD, pa[1]);
            acc.skirtUV.push(u0, 1, u1, 1, u1, 0, u0, 1, u1, 0, u0, 0);
          }
        } else if (onFoot(mid) < 0) { // hip / ridge
          if (buried(mid[0], mid[1], hAt(A, mid[0], mid[1]), part)) continue;
          const key = [a, b].map(p => p.map(v => v.toFixed(3)).join(',')).sort().join('|');
          if (!acc.ridgeKeys.has(key)) { acc.ridgeKeys.add(key); acc.ridges.push([[a[0], hAt(A, a[0], a[1]), a[1]], [b[0], hAt(A, b[0], b[1]), b[1]]]); }
        }
      }
    }
  }
  const newAcc = () => ({ top: [], uv: [], und: [], skirt: [], skirtUV: [], ridges: [], ridgeKeys: new Set() });
  const geoFrom = (pos, uv) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const heightOf = (planes, x, z) => Math.min(...planes.map(p => hAt(p, x, z)));
  // gable infill under a roof part along wall line a->b (from plate up to the soffit line), pushed `off` outward
  function gableGeo(a, b, planes, plate, outward, off = 0.0) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ts = new Set([0, 1]);
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
      const f = (t) => { const p = at(t); return hAt(planes[i], p[0], p[1]) - hAt(planes[j], p[0], p[1]); };
      const f0 = f(0), f1 = f(1); if (Math.abs(f1 - f0) > 1e-9) { const t = f0 / (f0 - f1); if (t > 0 && t < 1) ts.add(t); }
    }
    const prof = [...ts].sort((p, q) => p - q).map(t => { const p = at(t); return [t * L, heightOf(planes, p[0], p[1]) - TH]; }).filter(([, y]) => y > plate - 1e-3);
    if (prof.length < 2) return null;
    const shape = [V2(prof[0][0], plate), V2(prof[prof.length - 1][0], plate), ...prof.slice().reverse().map(([u, y]) => V2(u, y))];
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const pos = [], uv = [];
    for (const tri of tris) for (const k of tri) { const s = shape[k]; pos.push(a[0] + ux * s.x + outward[0] * off, s.y, a[1] + uz * s.x + outward[1] * off); uv.push(s.x, s.y); }
    return geoFrom(pos, uv);
  }

  // ---------------------------------------------------------------- roof parts (see notes at top)
  const S = 0.5453, PLATE = P.LEVELS[1].plate, E = 0.5; // sw-block slope kept = shell's so foyer's gallery vault stays under it
  const sG = 0.45, sRN = 0.62, sFam = 0.855, sSWF = 0.9, EG = 0.6; // garage gable ~24° (p01), 0.6 m garage eaves
  const turHull = [[5.01, 4.43], [6.10, 3.53], [7.40, 3.53], [8.30, 4.43], [8.30, 10.2], [5.01, 10.2]];
  const turIn = [6.65, 6.5]; const sT = 1.3, sF = 1.9; // steep witch's-hat facets (p01)
  const PARTS = {
    'sw-block': [
      { // main block: front wall z 7.07 (x<5.01), rear z 13.6, SW hip x 0.35, NE hip x 11.12 (buried in the wing)
        planes: [PLN(0, 7.07, 0, 1, sSWF, PLATE), PLN(0, 13.6, 0, -1, S, PLATE), PLN(0.35, 0, 1, 0, S, PLATE), PLN(11.12, 0, -1, 0, S, PLATE)],
        foot: [[0.35 - E, 7.07 - E], [11.12 + E, 7.07 - E], [11.12 + E, 13.6 + E], [0.35 - E, 13.6 + E]] },
      { // forward wing over the turret block + foyer/gallery: front z 4.43, W hip x 5.01, ridge runs NE into the garage roof
        planes: [PLN(0, 4.43, 0, 1, S, PLATE), PLN(0, 13.6, 0, -1, S, PLATE), PLN(5.01, 0, 1, 0, S, PLATE)],
        foot: [[5.2, 4.43 - E], [10.9, 4.43 - E], [16.8, 9.015], [10.9, 13.6 + E], [5.01 - E, 13.6 + E], [5.01 - E, 6.72], [5.2, 6.72]] },
    ],
    'turret': [{ // steep faceted tower roof over the 3-sided bay, ridge back into the main hip
      planes: [edgePlane(turHull[5], turHull[0], turIn, sT, PLATE), edgePlane(turHull[0], turHull[1], turIn, sF, PLATE), edgePlane(turHull[1], turHull[2], turIn, sF, PLATE),
        edgePlane(turHull[2], turHull[3], turIn, sF, PLATE), edgePlane(turHull[3], turHull[4], turIn, sT, PLATE)],
      foot: offsetPoly(turHull, [0.3, 0.3, 0.3, 0.3, 0.3, 0]) }],
    // front gable (street) over the garage wing; its rear end is a hip so the whole back reads as one hip roof (p44)
    'garage-wing': [{ planes: [PLN(11.12, 0, 1, 0, sG, PLATE), PLN(23.10, 0, -1, 0, sG, PLATE), PLN(0, 14.36, 0, -1, S, PLATE)],
      foot: [[11.12 - EG, 0.35 - EG], [23.10 + EG, 0.35 - EG], [23.10 + EG, 14.36 + E], [11.12 - EG, 14.36 + E]] }],
    // rear gable (p44 right): ridge runs forward into the garage wing's rear hip
    'rear-ne': [{ planes: [PLN(15.39, 0, 1, 0, sRN, PLATE), PLN(21.70, 0, -1, 0, sRN, PLATE)],
      foot: [[15.39 - E, 10.3], [21.70 + E, 10.3], [21.70 + E, 21.65 + E], [15.39 - E, 21.65 + E]] }],
    'primary': [{ planes: [PLN(8.27, 0, 1, 0, S, PLATE), PLN(0, 17.0, 0, -1, S, PLATE), PLN(0, 11.6, 0, 1, S, PLATE)],
      foot: [[8.27 - E, 11.6], [18.6, 11.6], [18.6, 17.0 + E], [8.27 - E, 17.0 + E]] }],
    'family': [{ planes: [PLN(2.35, 0, 1, 0, sFam, 3.30), PLN(8.27, 0, -1, 0, sFam, 3.30)],
      foot: [[2.35 - E, 13.6], [8.27 + E, 13.6], [8.27 + E, 20.32 + 0.30], [2.35 - E, 20.32 + 0.30]] }],
    'powder': [{ planes: [PLN(0, 16.15, 0, -1, 0.353, 3.30)],
      foot: [[0.35 - E, 13.6], [2.35, 13.6], [2.35, 16.15 + E], [0.35 - E, 16.15 + E]] }],
  };
  function offsetPoly(poly, d) { // per-edge outward offset of a convex polygon
    const n = poly.length; const sgn = Math.sign(polyArea(poly)); const lines = [];
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      const ox = sgn * dz / L, oz = -sgn * dx / L; // outward normal
      lines.push({ p: [a[0] + ox * d[i], a[1] + oz * d[i]], d: [dx / L, dz / L] }); }
    const out = [];
    for (let i = 0; i < n; i++) { const l1 = lines[(i - 1 + n) % n], l2 = lines[i];
      const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0]; const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
      out.push([l1.p[0] + l1.d[0] * t, l1.p[1] + l1.d[1] * t]); }
    return out;
  }
  function polyArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

  const shellRoot = ctx.shell?.root; const noRoof = ctx.params?.get?.('noroof') === '1';
  const byName = new Map(); shellRoot?.traverse(o => { if (o.isMesh && o.name) { if (!byName.has(o.name)) byName.set(o.name, []); byName.get(o.name).push(o); } });
  const fasciaPos = [], fasciaUV = [], ridgeList = [];
  if (!noRoof) {
    allParts = Object.values(PARTS).flat();
    for (const [id, parts] of Object.entries(PARTS)) {
      const acc = newAcc(); for (const p of parts) roofPart(p, acc);
      const top = geoFrom(acc.top, acc.uv), und = geoFrom(acc.und, acc.uv);
      const roofs = byName.get('roof:' + id) || [], soffits = byName.get('soffit:' + id) || [];
      if (roofs.length) { for (const m of roofs) { m.geometry = top; styleShingle(m.material); } }
      else { const m = new THREE.Mesh(top, M.shingles); m.name = 'roof:' + id; m.castShadow = true; m.receiveShadow = true; (shellRoot || root).add(m); }
      if (soffits.length) { for (const m of soffits) { m.geometry = und; styleSoffit(m.material); } }
      else { const m = new THREE.Mesh(und, M.soffit); m.name = 'soffit:' + id; m.receiveShadow = true; (shellRoot || root).add(m); }
      fasciaPos.push(...acc.skirt); fasciaUV.push(...acc.skirtUV); ridgeList.push(...acc.ridges);
    }
    // keep bedB/bedC-style patched clones in sync (they clone M.shingles / M.soffit lazily)
    ctx.onUpdate(() => { for (const id of Object.keys(PARTS)) { for (const m of byName.get('roof:' + id) || []) if (m.material.map !== sh.map) styleShingle(m.material); } });
    const fm = new THREE.Mesh(geoFrom(fasciaPos, fasciaUV), fasciaMat); fm.name = 'fascia'; fm.castShadow = true; fm.receiveShadow = true; root.add(fm);
    // ridge / hip caps
    for (const [a, b] of ridgeList) {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); if (L < 0.05) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.26), capMat); m.position.copy(A).add(B).multiplyScalar(0.5); m.position.y += 0.012;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize()); m.castShadow = true; root.add(m);
    }
    // gables: garage front (siding), garage rear, rear-ne (siding), family (stucco)
    const gG = PARTS['garage-wing'][0].planes, gRN = PARTS['rear-ne'][0].planes, gF = PARTS['family'][0].planes;
    const setGable = (id, geo, mat) => { const ms = byName.get('gable:' + id) || []; if (ms.length) for (const m of ms) { m.geometry = geo; m.material = mat; } else { const m = new THREE.Mesh(geo, mat); m.name = 'gable:' + id; m.castShadow = true; m.receiveShadow = true; root.add(m); } };
    setGable('garage-wing', gableGeo([11.12, 0.35], [23.10, 0.35], gG, PLATE, [0, -1], 0.016), sidingMat);
    setGable('rear-ne', gableGeo([15.39, 21.65], [21.70, 21.65], gRN, PLATE, [0, 1], 0.016), sidingMat);
    setGable('family', gableGeo([2.35, 20.32], [8.27, 20.32], gF, 3.30, [0, 1], 0.0), stuccoD);

    // skylights (p00): one on the garage gable's SW slope, two on the wing's street slope over the gallery
    const wingA = PARTS['sw-block'][1].planes[0], garL = PARTS['garage-wing'][0].planes[0];
    for (const [x, z, A] of [[14.6, 5.2, garL], [9.9, 7.7, wingA], [8.4, 7.7, wingA]]) {
      const n = new THREE.Vector3(-A.s * A.nx, 1, -A.s * A.nz).normalize();
      const g = kit.group(root); g.position.set(x, hAt(A, x, z), z); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      kit.add(g, kit.rbox(0.82, 0.16, 1.12, 0.02), lanternMetal, [0, 0.06, 0]);
      const gl = kit.add(g, new THREE.BoxGeometry(0.72, 0.02, 1.02), skyGlass, [0, 0.145, 0]); gl.castShadow = false;
    }
    // turret finial at the apex of the witch's-hat facets
    { const ax = 6.655, az = 3.53 + (hAt(PARTS.turret[0].planes[0], ax, 4.0) - PLATE - HEEL) / sF, ay = PLATE + HEEL + sF * (az - 3.53);
      kit.add(root, kit.lathe([[0.07, 0], [0.05, 0.08], [0.02, 0.12], [0.045, 0.2], [0.012, 0.3], [0.004, 0.62], [0, 0.66]], 12), lanternMetal, [ax, ay - 0.04, az]); }
  }

  // ================================================================ walls: siding, belly band, battens, faux window
  const frontOpenings = P.OPENINGS.filter(o => o.level === 1 && Math.abs(o.at[1] - 0.35) < 0.02 && o.at[0] > 11 && o.type === 'window');
  {
    const Y0 = 3.46, Y1 = PLATE; const shape = new THREE.Shape([V2(11.12, Y0), V2(23.10, Y0), V2(23.10, Y1), V2(11.12, Y1)]);
    for (const o of frontOpenings) { const x0 = o.at[0] - o.w / 2, x1 = o.at[0] + o.w / 2, y0 = 3.35 + o.sill, y1 = 3.35 + o.head;
      shape.holes.push(new THREE.Path([V2(x0, y0), V2(x0, y1), V2(x1, y1), V2(x1, y0)])); }
    const g = new THREE.ShapeGeometry(shape); const m = kit.add(root, g, sidingMat, [0, 0, 0.35 - 0.016]); m.castShadow = false;
    // rear-ne upper siding (p44: board-and-batten on the rear gable wing)
    const sh2 = new THREE.Shape([V2(15.39, Y0), V2(21.70, Y0), V2(21.70, Y1), V2(15.39, Y1)]);
    for (const o of P.OPENINGS.filter(o => o.level === 1 && Math.abs(o.at[1] - 21.65) < 0.02 && o.type === 'window')) {
      const x0 = o.at[0] - o.w / 2, x1 = o.at[0] + o.w / 2; sh2.holes.push(new THREE.Path([V2(x0, 3.35 + o.sill), V2(x0, 3.35 + o.head), V2(x1, 3.35 + o.head), V2(x1, 3.35 + o.sill)])); }
    const m2 = kit.add(root, new THREE.ShapeGeometry(sh2), sidingMat, [0, 0, 21.65 + 0.016]); m2.castShadow = false;
  }
  // belly band (black trim between floors) — segments on exterior faces, outward normal
  const BAND = [
    [[11.12, 0.35], [23.10, 0.35], [0, -1]], [[23.10, 0.35], [23.10, 14.36], [1, 0]], [[11.12, 0.35], [11.12, 4.43], [-1, 0]],
    [[0.35, 7.07], [5.01, 7.07], [0, -1]], [[5.01, 7.07], [5.01, 4.43], [-1, 0]],
    [[15.39, 21.65], [21.70, 21.65], [0, 1]], [[21.70, 14.36], [21.70, 21.65], [1, 0]], [[15.39, 18.40], [15.39, 21.65], [-1, 0]],
    [[0.35, 7.07], [0.35, 13.45], [-1, 0]], [[21.70, 14.36], [23.10, 14.36], [0, 1]],
  ];
  for (const [a, b, n] of BAND) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.12, d = 0.055, h = 0.22;
    const geo = new THREE.BoxGeometry(n[0] ? d : L, h, n[0] ? L : d);
    kit.add(root, geo, trimMat, [(a[0] + b[0]) / 2 + n[0] * d / 2, 3.24 + h / 2, (a[1] + b[1]) / 2 + n[1] * d / 2]);
    kit.add(root, new THREE.BoxGeometry(n[0] ? d + 0.02 : L, 0.03, n[0] ? L : d + 0.02), trimMat, [(a[0] + b[0]) / 2 + n[0] * (d + 0.02) / 2, 3.24 + h, (a[1] + b[1]) / 2 + n[1] * (d + 0.02) / 2]);
  }
  /* soft shade under the eaves (p01: the wall darkens towards the soffit): one alpha-gradient strip per upper exterior
     wall edge that has an eave (roof underside just outside the wall at plate height; gable ends are skipped), one draw */
  if (!noRoof) {
    const grad = kit.canvasTex(4, 64, (g2, w2, h2) => { const gr = g2.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w2, h2); }, { srgb: false });
    const aoMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: grad, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
    const pos = [], uv = []; const ext = P.EXT[1]; const HH = 0.95;
    let sa = 0; for (let i = 0; i < ext.length; i++) { const a = ext[i], b = ext[(i + 1) % ext.length]; sa += a[0] * b[1] - b[0] * a[1]; }
    for (let i = 0; i < ext.length; i++) {
      const a = ext[i], b = ext[(i + 1) % ext.length]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.3) continue;
      const ox = Math.sign(sa) * dz / L, oz = -Math.sign(sa) * dx / L; const mx = (a[0] + b[0]) / 2 + ox * 0.22, mz = (a[1] + b[1]) / 2 + oz * 0.22;
      let hy = Infinity; for (const q of Object.values(PARTS).flat()) if (inPoly(mx, mz, q.foot)) hy = Math.min(hy, heightOf(q.planes, mx, mz));
      if (!(hy < PLATE + HEEL + 0.4)) continue; /* no eave here (gable end or no roof) */
      const top = PLATE, bot = PLATE - HH, o = 0.012; const A0 = [a[0] + ox * o, a[1] + oz * o], B0 = [b[0] + ox * o, b[1] + oz * o];
      pos.push(A0[0], top, A0[1], B0[0], top, B0[1], B0[0], bot, B0[1], A0[0], top, A0[1], B0[0], bot, B0[1], A0[0], bot, A0[1]);
      uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
    }
    if (pos.length) { const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const am = new THREE.Mesh(g2, aoMat); am.name = 'eaveShade'; am.renderOrder = 2; am.castShadow = am.receiveShadow = false; am.side = THREE.DoubleSide; aoMat.side = THREE.DoubleSide; am.userData.noProbe = true; root.add(am); }
  }
  // white battens on the front gable (p01: two full-height battens dividing the upper face in three)
  if (!noRoof) { const gG = PARTS['garage-wing'][0].planes;
    for (const x of [15.0, 18.3]) { const top = heightOf(gG, x, 0.35) - TH; const h = top - 3.46;
      kit.add(root, new THREE.BoxGeometry(0.15, h, 0.06), sidingMat, [x, 3.46 + h / 2, 0.35 - 0.046]); } }
  // faux window where plan has no opening (bB-front is not cut: wardrobe wall inside) — p00/p01 show a 3-lite window
  {
    const o = P.OPENINGS.find(o => o.id === 'bB-front'); if (o) {
      const w = 2.1, x0 = o.at[0] - w / 2, y0 = 3.35 + 0.85, h = 1.45, z = 0.35 - 0.02; const g = kit.group(root, [x0, y0, z]);
      const f = 0.06, bar = (bw, bh, x, y) => kit.add(g, new THREE.BoxGeometry(bw, bh, 0.05), M.blackMetal, [x, y, -0.01]);
      bar(w, f, w / 2, f / 2); bar(w, f, w / 2, h - f / 2); bar(f, h, f / 2, h / 2); bar(f, h, w - f / 2, h / 2);
      bar(0.05, h, w / 2, h / 2); bar(w, 0.04, w / 2, h * 0.5);
      const gl = kit.add(g, new THREE.PlaneGeometry(w - 0.04, h - 0.04), winGlass, [w / 2, h / 2, -0.012], [0, Math.PI, 0]); gl.castShadow = false;
    }
  }

  // ================================================================ chimneys
  {
    const x0 = -0.55, x1 = 0.40, z0 = 7.07, z1 = 8.40, top = 9.55;
    kit.boxAt(root, stucco, x0, -0.30, z0, x1 - x0, top + 0.30, z1 - z0);
    kit.boxAt(root, capStone, x0 - 0.06, top, z0 - 0.06, x1 - x0 + 0.12, 0.07, z1 - z0 + 0.12);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.add(root, new THREE.BoxGeometry(0.62, 0.30, 0.78), lanternMetal, [cx, top + 0.07 + 0.15, cz]);
    const lid = new THREE.ConeGeometry(0.62, 0.16, 4, 1); lid.rotateY(Math.PI / 4); lid.scale(1, 1, 1.2);
    kit.add(root, lid, lanternMetal, [cx, top + 0.07 + 0.30 + 0.08, cz]);
    phys.boxAABB([x0, -0.3, z0], [x1, top, z1]);
    // rear flue stub (p44)
    kit.boxAt(root, stucco, 14.30, 6.9, 14.0, 0.62, 8.80 - 6.9, 0.62);
    kit.boxAt(root, capStone, 14.25, 8.80, 13.95, 0.72, 0.06, 0.72);
    kit.add(root, new THREE.BoxGeometry(0.42, 0.22, 0.42), lanternMetal, [14.61, 8.97, 14.31]);
  }

  // ================================================================ garage doors (OPENINGS g-door-1/2): vertical-plank, dark walnut
  for (const id of ['g-door-1', 'g-door-2']) {
    const o = P.OPENINGS.find(q => q.id === id); if (!o) continue;
    const w = o.w, h = o.head, x0 = o.at[0] - w / 2; const g = kit.group(root, [x0, 0, 0.35 + 0.06], 0, 'garageDoor:' + id);
    kit.add(g, new THREE.BoxGeometry(w, h, 0.05), doorMatFor(w, h), [w / 2, h / 2, 0]);
    const fr = 0.075, fm = doorMatFor(1.2, 1.2);
    for (const [bw, bh, x, y] of [[w, fr, w / 2, h - fr / 2], [w, fr, w / 2, fr / 2], [fr, h, fr / 2, h / 2], [fr, h, w - fr / 2, h / 2]]) kit.add(g, new THREE.BoxGeometry(bw, bh, 0.02), fm, [x, y, -0.03]);
    kit.add(g, new THREE.BoxGeometry(w, 0.02, 0.06), M.matteBlack, [w / 2, 0.01, -0.01]); // rubber seal
    /* inside face (garage side): white steel sectional panels instead of the walnut box face */
    { const pm = steelMat.clone(); pm.map = steelTex.map.clone(); pm.normalMap = steelTex.normalMap.clone(); pm.map.repeat.set(w / 2.4, h / 2.4); pm.normalMap.repeat.set(w / 2.4, h / 2.4); pm.map.needsUpdate = pm.normalMap.needsUpdate = true;
      kit.add(g, new THREE.PlaneGeometry(w - 0.01, h - 0.01), pm, [w / 2, h / 2, 0.0262]); }
  }

  // ================================================================ wall lanterns (black box lanterns)
  function lantern(x, y, z, n) {
    const g = kit.group(root, [x, y, z], Math.atan2(n[0], n[1]), 'lantern'); const s = 1.25;
    const b = (w, h, d, px, py, pz, mat = lanternMetal) => kit.add(g, new THREE.BoxGeometry(w * s, h * s, d * s), mat, [px * s, py * s, pz * s]);
    b(0.12, 0.30, 0.02, 0, 0, 0.01);                // backplate
    b(0.03, 0.03, 0.08, 0, 0.02, 0.06);             // arm
    const cz = 0.17; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b(0.016, 0.36, 0.016, dx * 0.085, 0, cz + dz * 0.085);
    b(0.20, 0.025, 0.20, 0, -0.19, cz); b(0.22, 0.03, 0.22, 0, 0.19, cz);
    const cap = new THREE.ConeGeometry(0.16 * s, 0.09 * s, 4, 1); cap.rotateY(Math.PI / 4); kit.add(g, cap, lanternMetal, [0, 0.25 * s, cz * s]);
    kit.add(g, new THREE.SphereGeometry(0.015 * s, 8, 6), lanternMetal, [0, 0.30 * s, cz * s]);
    const gl = kit.add(g, new THREE.BoxGeometry(0.17 * s, 0.35 * s, 0.17 * s), lanternGlass, [0, 0, cz * s]); gl.castShadow = false; gl.userData.keep = true;
    kit.add(g, new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.09 * s, 10), bulbMat, [0, -0.08 * s, cz * s]);
  }
  for (const [x, y, z, n] of [
    [22.45, 2.15, 0.35, [0, -1]], [11.80, 2.15, 0.35, [0, -1]],               // garage
    [10.88, 2.05, 4.43, [0, -1]], [8.55, 2.05, 4.43, [0, -1]],                 // entry
    [4.70, 2.05, 7.07, [0, -1]],                                               // SW block front
    [4.10, 2.10, 20.32, [0, 1]], [6.05, 2.10, 20.32, [0, 1]],                  // family rear
    [17.70, 2.10, 21.65, [0, 1]], [21.20, 2.10, 21.65, [0, 1]],                // kitchen rear
    [10.25, 5.25, 17.0, [0, 1]], [11.45, 5.25, 17.0, [0, 1]],                  // primary rear (upper)
  ]) lantern(x, y, z, n);

  // ================================================================ street lights (polish pass)
  // Three slim LA-style cobra-head poles along Camino De Yatasto: emissive heads + a soft additive pool decal on the
  // asphalt (radial falloff, no real light). Both are plain emissive materials, so src/sky scales them with darkness
  // (≈ off at noon, full at night). No per-frame work.
  {
    const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [t, a] of [[0, 1], [0.25, 0.7], [0.55, 0.25], [0.8, 0.06], [1, 0]]) gr.addColorStop(t, `rgb(${a * 255 | 0},${a * 255 | 0},${a * 255 | 0})`); // alphaMap reads green: grey levels on black
      g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
    const poleMat = std({ color: 0x5d6064, roughness: 0.55, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffd9a8, emissiveIntensity: 0.7, roughness: 0.4 });
    const poolMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffcf96, emissiveIntensity: 0.05, alphaMap: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const poolGeo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
    for (const [x, z, dir] of [[1.5, FRONT.curbZ + 0.35, -1], [27.5, FRONT.curbZ + 0.35, -1], [-12.5, FRONT.farCurbZ - 0.35, 1]]) {
      const g = kit.group(root, [x, 0, z], 0, 'streetlight'); const y0 = dir < 0 ? WALK_Y : STREET_Y + 0.15;
      kit.add(g, new THREE.CylinderGeometry(0.07, 0.1, 6.4, 10), poleMat, [0, y0 + 3.2, 0]);
      kit.add(g, new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), poleMat, [0, y0 + 0.15, 0]);
      ctx.phys.boxAABB([x - 0.16, y0, z - 0.16], [x + 0.16, y0 + 6.4, z + 0.16]); // solid pole: players and cars can't pass through
      const arm = kit.add(g, new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8), poleMat, [0, y0 + 6.25, dir * 0.9]); arm.rotation.x = Math.PI / 2 - dir * 0.12;
      kit.add(g, kit.rbox(0.36, 0.14, 0.7, 0.05), poleMat, [0, y0 + 6.42, dir * 1.85]);
      const head = kit.add(g, new THREE.BoxGeometry(0.26, 0.03, 0.5), headMat, [0, y0 + 6.34, dir * 1.85]); head.castShadow = false;
      const pool = kit.add(g, poolGeo, poolMat, [0, STREET_Y + 0.012, dir * 2.6]); pool.castShadow = false; pool.receiveShadow = false; pool.renderOrder = 3; pool.userData.noProbe = true;
    }
  }

  // ================================================================ front grade: driveway, entry, planters, street
  // The street is ~0.95 m below the porch (videos v01/v08/v09; terrain.js cuts the ground to match).
  // Entry (v01/v09): a flat landing of 60 cm grey tiles at door level reaching out to the garage-front line,
  // a 0.45 m seat ledge running diagonally out from the turret's NE facet with grasses planted behind it,
  // then two short flights (3 risers each) via a mid landing down to a paved apron at sidewalk level in front
  // of the turret (v08: a truck parks there; no retaining wall at the curb).
  const FRONT_Z = FRONT.walkZ, CURB_Z = FRONT.curbZ, BOT = STREET_Y - 0.15;
  const tileTex = pixelTex(512, 512, (x, y) => { // 512 px = 1.2 m = 2 x 2 tiles of 0.6 m
    const ti = Math.floor(x / 256) + 2 * Math.floor(y / 256), u = x % 256, v = y % 256;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; const sp = ((h >>> 8) & 31) - 16;
    const g = (u < 3 || v < 3) ? 118 : 171 + [0, 6, -5, 3][ti] + sp * 0.35;
    return [g, g, g + 2]; });
  const tileMat = std({ map: tileTex, roughness: 0.72 });
  const flatQuad = (parent, pts, y, mat, uvScale = 1) => { // pts [[x,z]...] CCW-agnostic polygon at height y (or fn)
    const shape = pts.map(p => V2(p[0], p[1])); const tris = THREE.ShapeUtils.triangulateShape(shape, []); const pos = [], uv = [];
    for (const t of tris) { let [a, b, c] = t; const cy = (shape[b].y - shape[a].y) * (shape[c].x - shape[a].x) - (shape[b].x - shape[a].x) * (shape[c].y - shape[a].y); if (cy < 0) [b, c] = [c, b];
      for (const k of [a, b, c]) { const p = shape[k]; pos.push(p.x, typeof y === 'function' ? y(p.x, p.y) : y, p.y); uv.push(p.x * uvScale, -p.y * uvScale); } }
    const m = new THREE.Mesh(geoFrom(pos, uv), mat); m.receiveShadow = true; parent.add(m); return m;
  };
  const surfCollider = (m) => { m.updateMatrixWorld(true); phys.trimesh(m.geometry.clone().applyMatrix4(m.matrixWorld)); };
  // driveway: slabs with turf joints. Left edge flares out towards the street (p00/p01); falls to the sidewalk.
  const dX0 = 11.55, dLeft = (z) => 23.10 + (0.35 - z) * 0.47; const dY = (x, z) => -0.01 + (WALK_Y + 0.01) * (0.35 - z) / (0.35 - FRONT_Z);
  {
    const J = 0.17, rowsZ = [0.35, -3.0, FRONT_Z]; const k = 0.45, cols = [15.45, 19.35]; // joint lines x = c + k*(0.35 - z)
    const colX = (c, z) => c + k * (0.35 - z);
    const g = kit.group(root, [0, 0, 0], 0, 'driveway');
    for (let r = 0; r < rowsZ.length - 1; r++) {
      const za = rowsZ[r] - (r ? J / 2 : 0), zb = rowsZ[r + 1] + (r < rowsZ.length - 2 ? J / 2 : 0); // za > zb
      const bounds = [(z) => dX0, (z) => colX(cols[0], z), (z) => colX(cols[1], z), (z) => dLeft(z)];
      for (let c = 0; c < 3; c++) {
        const L = bounds[c], R = bounds[c + 1]; const lo = c ? J / 2 : 0, hi = c < 2 ? J / 2 : 0;
        flatQuad(g, [[L(za) + lo, za], [R(za) - hi, za], [R(zb) - hi, zb], [L(zb) + lo, zb]], (x, z) => dY(x, z) + 0.012, concreteMat, 1);
      }
    }
    /* p00/p01: muted green artificial-turf strips between the slabs (not black lines): blade normal, rough 1, low sky
       reflection so they don't glow; raised to 5 mm under the slab top so the step doesn't read as a dark AO groove */
    const jt = speckleTex(256, [95, 122, 53], [10, 9, 18], 33, { blades: true, nStrength: 2.5, tint: [6, 8, 0] }); jt.map.repeat.set(3, 3); jt.normalMap.repeat.set(3, 3);
    const jointMat = std({ map: jt.map, normalMap: jt.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 }); jointMat.envMapIntensity = 0.35;
    const tm = flatQuad(g, [[dX0, 0.35], [dLeft(0.35), 0.35], [dLeft(FRONT_Z), FRONT_Z], [dX0, FRONT_Z]], (x, z) => dY(x, z) + 0.007, jointMat, 1);
    surfCollider(tm);
    // side skirt down below the street on the flared (court) side
    for (const [xa, za, xb, zb] of [[dLeft(0.35), 0.35, dLeft(FRONT_Z), FRONT_Z]]) {
      const pos = [xa, dY(xa, za), za, xb, dY(xb, zb), zb, xb, BOT, zb, xa, dY(xa, za), za, xb, BOT, zb, xa, BOT, za];
      const m = new THREE.Mesh(geoFrom(pos, [0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]), new THREE.MeshStandardMaterial({ color: 0xbdb7ad, roughness: 0.95, side: THREE.DoubleSide })); g.add(m);
    }
  }
  // sidewalk + curb + street (in front of the lot only; site.js lays the long street plane under it)
  {
    const g = kit.group(root, [0, 0, 0], 0, 'street');
    const SX0 = -14, SX1 = 40;
    for (let x = SX0; x < SX1; x += 1.5) flatQuad(g, [[x + 0.006, FRONT_Z], [x + 1.494, FRONT_Z], [x + 1.494, CURB_Z + 0.15], [x + 0.006, CURB_Z + 0.15]], WALK_Y, concreteMat, 1);
    flatQuad(g, [[SX0, FRONT_Z], [SX1, FRONT_Z], [SX1, CURB_Z + 0.15], [SX0, CURB_Z + 0.15]], WALK_Y - 0.008, new THREE.MeshStandardMaterial({ color: 0x9a958d, roughness: 1 }));
    kit.boxAt(g, capStone, SX0, STREET_Y, CURB_Z, SX1 - SX0, WALK_Y - STREET_Y, 0.15);
    kit.boxAt(g, concreteMat, SX0, BOT, CURB_Z + 0.15, SX1 - SX0, WALK_Y - BOT - 0.004, -FRONT_Z + CURB_Z - 0.15);
    flatQuad(g, [[SX0 - 30, CURB_Z], [SX1 + 30, CURB_Z], [SX1 + 30, FRONT.farCurbZ], [SX0 - 30, FRONT.farCurbZ]], STREET_Y, asphaltMat, 1);
    // gutter line
    flatQuad(g, [[SX0 - 30, CURB_Z], [SX1 + 30, CURB_Z], [SX1 + 30, CURB_Z - 0.45], [SX0 - 30, CURB_Z - 0.45]], STREET_Y + 0.004, new THREE.MeshStandardMaterial({ color: 0xb4afa6, roughness: 1 }));
    phys.boxAABB([SX0, BOT, CURB_Z], [SX1, WALK_Y, FRONT_Z]);
  }
  // white stucco planter / retaining wall with a light cap (x0,z0)-(x1,z1) footprint, top y
  const planterWalls = kit.group(root, [0, 0, 0], 0, 'planterWalls');
  const wallBox = (x0, z0, x1, z1, top, bot = BOT) => {
    kit.boxAt(planterWalls, stucco, x0, bot, z0, x1 - x0, top - bot, z1 - z0);
    kit.boxAt(planterWalls, capStone, x0 - 0.025, top, z0 - 0.025, x1 - x0 + 0.05, 0.05, z1 - z0 + 0.05);
    phys.boxAABB([x0, bot, z0], [x1, top + 0.05, z1]);
  };
  // entry levels: landing 0 -> 2 treads -> mid landing -> 2 treads -> apron at sidewalk level (6 x 0.133 m risers)
  const RISE = -WALK_Y / 6, TRD = 0.36;
  const LZ = 0.35, LX = 9.45, RX = 10.95, WX = 7.2;          // landing front edge; flight-1 x range; west edge below
  const MZ1 = LZ - 2 * TRD, MZ0 = -2.2, PZ = MZ0 - 2 * TRD;   // mid landing z range; apron starts at PZ
  const LEDGE_S = [7.65, 3.98], LEDGE_B = [LX, 1.70], SEAT = 0.45;
  const entryY = (z) => z >= LZ ? 0 : z >= LZ - TRD ? -RISE : z >= MZ1 ? -2 * RISE : z >= MZ0 ? -3 * RISE : z >= MZ0 - TRD ? -4 * RISE : z >= PZ ? -5 * RISE : WALK_Y;
  {
    const g = kit.group(root, [0, 0, 0], 0, 'entryWalk');
    // landing: tiles + solid body under the part that faces flight 1
    const land = flatQuad(g, [[7.9, 4.43], [11.12, 4.43], [11.12, LZ], [LX, LZ], LEDGE_B, LEDGE_S], 0.003, tileMat, 1 / 1.2); surfCollider(land);
    kit.boxAt(g, concreteMat, LX, BOT, LZ, 11.12 - LX, -BOT, 4.43 - LZ - 0.01);
    phys.boxAABB([LX, BOT, LZ], [11.12, 0, 4.43]);
    kit.boxAt(g, std({ color: 0x5a4a3c, roughness: 1 }), 9.25, 0, 3.55, 1.1, 0.014, 0.65); // coir door mat
    const tread = (x0, x1, z0, z1, y) => {
      kit.boxAt(g, capStone, x0, BOT, z0, x1 - x0, y - BOT, z1 - z0);
      kit.boxAt(g, concreteMat, x0 + 0.01, y - 0.012, z0 - 0.025, x1 - x0 - 0.02, 0.03, 0.04); // nosing shadow line
      phys.boxAABB([x0, BOT, z0], [x1, y, z1]);
    };
    tread(LX, RX, LZ - TRD, LZ, -RISE); tread(LX, RX, MZ1, LZ - TRD, -2 * RISE);
    // mid landing (tiled)
    kit.boxAt(g, concreteMat, WX, BOT, MZ0, RX - WX, -3 * RISE - BOT, MZ1 - MZ0); phys.boxAABB([WX, BOT, MZ0], [RX, -3 * RISE, MZ1]);
    flatQuad(g, [[WX, MZ1], [RX, MZ1], [RX, MZ0], [WX, MZ0]], -3 * RISE + 0.003, tileMat, 1 / 1.2);
    tread(WX, RX, MZ0 - TRD, MZ0, -4 * RISE); tread(WX, RX, PZ, MZ0 - TRD, -5 * RISE);
    // paved apron at sidewalk level in front of the turret and the stairs, out to the sidewalk (v08)
    const apron = (x0, z0, x1, z1) => {
      kit.boxAt(g, concreteMat, x0, BOT, z0, x1 - x0, WALK_Y - BOT, z1 - z0); phys.boxAABB([x0, BOT, z0], [x1, WALK_Y, z1]);
      for (let x = x0 + 1.5; x < x1 - 0.3; x += 1.5) kit.boxAt(g, M.matteBlack, x - 0.006, WALK_Y - 0.004, z0, 0.012, 0.006, z1 - z0); // saw cuts
    };
    apron(3.2, FRONT_Z, WX, -3.3); apron(WX, FRONT_Z, RX, PZ);
    // seat ledge: stucco with a light concrete cap, diagonal from the turret's NE facet (rotated box + trimesh collider)
    const dx = LEDGE_B[0] - LEDGE_S[0], dz = LEDGE_B[1] - LEDGE_S[1], L = Math.hypot(dx, dz) + 0.12, ux = dx / Math.hypot(dx, dz), uz = dz / Math.hypot(dx, dz);
    const nx = -uz, nz = ux; const sgn = (nx * -1 + nz * -1) > 0 ? 1 : -1; // normal towards the planter (-x/-z)
    const W = 0.42, cx = (LEDGE_S[0] + LEDGE_B[0]) / 2 + ux * 0.06 + sgn * nx * W / 2, cz = (LEDGE_S[1] + LEDGE_B[1]) / 2 + uz * 0.06 + sgn * nz * W / 2, ry = Math.atan2(-uz, ux);
    const body = kit.add(g, new THREE.BoxGeometry(L, SEAT - BOT, W), stucco, [cx, (SEAT + BOT) / 2, cz], [0, ry, 0]); surfCollider(body);
    kit.add(g, new THREE.BoxGeometry(L + 0.04, 0.05, W + 0.05), capStone, [cx, SEAT + 0.025, cz], [0, ry, 0]);
  }
  // planter behind the ledge (grasses, rosemary, a small olive) bounded by the turret, the ledge, the flight-1 cheek,
  // a wall facing the mid landing and a low wall to the yard
  const SOIL = 0.38;
  wallBox(9.25, MZ1, LX, LEDGE_B[1], SEAT);                     // cheek beside flight 1
  wallBox(WX, MZ1, 9.25, MZ1 + 0.2, SEAT);                      // faces the mid landing
  wallBox(7.0, MZ1, WX, 2.55, SEAT); wallBox(5.30, 2.35, 7.0, 2.55, SEAT); wallBox(5.30, 2.55, 5.50, 4.43, SEAT);
  flatQuad(root, [[5.5, 4.43], [5.6, 4.43], [6.1, 3.53], [7.4, 3.53], LEDGE_S, LEDGE_B, [9.25, LEDGE_B[1]], [9.25, MZ1 + 0.2], [WX, MZ1 + 0.2], [WX, 2.55], [5.5, 2.55]], SOIL, soilMat);
  phys.boxAABB([WX, BOT, MZ1 + 0.2], [9.25, SOIL, 1.7]); phys.boxAABB([WX, BOT, 1.7], [8.2, SOIL, 3.2]); phys.boxAABB([5.5, -0.4, 2.55], [7.4, SOIL, 3.53]);
  // low walls between the yard and the stairs / apron
  wallBox(7.0, -3.3, WX, MZ1, -0.02); wallBox(3.2, -3.3, 7.0, -3.1, -0.02); wallBox(3.0, FRONT_Z, 3.2, -3.1, -0.02);
  // planter strip between the stairs/apron and the driveway (stepped walls follow whichever side is higher)
  const stripTop = (z) => Math.max(entryY(z), dY(11.4, z)) + 0.42;
  for (let z = FRONT_Z; z < LZ - 0.01; ) {
    const z1 = Math.min(LZ, z + 0.9); const t = Math.max(stripTop(z), stripTop(z1 - 0.01));
    wallBox(RX, z, RX + 0.2, z1, t); wallBox(11.35, z, 11.55, z1, Math.max(dY(11.4, z) + 0.3, t - 0.1));
    flatQuad(root, [[RX + 0.2, z], [11.35, z], [11.35, z1], [RX + 0.2, z1]], t - 0.07, soilMat);
    z = z1;
  }
  wallBox(RX + 0.2, FRONT_Z, 11.35, FRONT_Z + 0.2, stripTop(FRONT_Z));
  // front yard (SW of the stairs): DG gravel at yard level, low white wall along the sidewalk, curved lawn
  const YARD_Y = -0.27;
  wallBox(-6.0, FRONT_Z, 3.0, FRONT_Z + 0.22, -0.02);
  wallBox(-6.2, FRONT_Z, -6.0, 7.07, -0.1);
  flatQuad(root, [[-6, FRONT_Z + 0.22], [3.0, FRONT_Z + 0.22], [3.0, -3.1], [7.0, -3.1], [7.0, 2.35], [5.3, 2.35], [5.3, 4.43], [5.01, 4.43], [5.01, 7.07], [0.35, 7.07], [0.35, 16.0], [-6, 16.0]], YARD_Y, gravelMat, 1);
  { // curved lawn towards the SW
    /* same muted lawn as the pool's (pool/props.js): #6d8a3e + blade specks + 1.5 m mowing stripes, rendered through
       0xb4b4b4 (the bright turf speckle read lime in p01) */
    const rL = kit.rng(5);
    const lawnMap = kit.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6d8a3e'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(40,52,20,0.10)'; g.fillRect(0, 0, w / 2, h);
      g.fillStyle = 'rgba(214,220,170,0.07)'; g.fillRect(w / 2, 0, w / 2, h);
      for (let k = 0; k < 42000; k++) { const v = (rL() - 0.5) * 60; g.fillStyle = `rgba(${96 + v},${122 + v},${62 + v * 0.6},0.45)`; g.fillRect(rL() * w, rL() * h, 1, 2 + rL() * 3); }
      for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(${120 + rL() * 30},${118 + rL() * 20},${70},0.12)`; g.beginPath(); g.arc(rL() * w, rL() * h, 3 + rL() * 9, 0, 7); g.fill(); }
    }, { repeat: [1 / 3, 1 / 3] });
    const lawnMat = std({ map: lawnMap, color: 0xb4b4b4, roughness: 0.95, normalMap: kit.noiseNormal(256, 2.2, 48, 21), normalScale: new THREE.Vector2(0.45, 0.45) });
    const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * 0.5 * i / 24; pts.push([-6 + 5.2 * Math.cos(a) * 1.0, -4.3 + 7.5 * Math.sin(a)]); }
    pts.push([-6, -4.3]);
    flatQuad(root, pts, YARD_Y + 0.02, lawnMat);
  }
  // house-number pillar "17609" at the foot of the steps by the sidewalk (p01)
  {
    const g = kit.group(root, [11.25, 0, FRONT_Z - 0.05], 0, 'numberPillar');
    kit.add(g, new THREE.BoxGeometry(0.62, 1.15, 0.62), stucco, [0, WALK_Y + 0.575, 0.2]);
    kit.add(g, new THREE.BoxGeometry(0.68, 0.05, 0.68), capStone, [0, WALK_Y + 1.175, 0.2]);
    const num = kit.canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#efede8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 44px Helvetica, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('17609', w / 2, h / 2 + 2); });
    const pl = kit.add(g, new THREE.PlaneGeometry(0.42, 0.105), new THREE.MeshStandardMaterial({ map: num, roughness: 0.6 }), [0, WALK_Y + 0.85, 0.2 - 0.312], [0, Math.PI, 0]); pl.castShadow = false;
    phys.solidGroup(g);
  }
  // left of the driveway (p00/p01): white stucco retaining wall along the curb, three tiers of stacked
  // weathered timber sleepers behind it (0.2 m boards), white pillar at the driveway corner.
  // (kept outside the tennis enclosure, which starts at z -3.4: v05/p41 look straight at its street end)
  const SLX1 = dLeft(FRONT_Z) + 6.5, SL_TOP = (i) => WALK_Y + 0.5 + 0.3 * (i + 1);
  {
    const g = kit.group(root, [0, 0, 0], 0, 'sleepers');
    const sleeper = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [2, 0.15] }), color: 0x9a8670, roughness: 0.92 });
    const gapMat = std({ color: 0x2a231d, roughness: 1 });
    wallBox(dLeft(FRONT_Z) + 0.05, FRONT_Z, SLX1, FRONT_Z + 0.25, WALK_Y + 0.5);
    for (let i = 0; i < 3; i++) {
      const z0 = FRONT_Z + 0.25 + i * 0.85, x0 = dLeft(z0) + 0.15 + 0.05, top = SL_TOP(i);
      kit.boxAt(g, gapMat, x0, BOT, z0, SLX1 - x0, top - BOT - 0.01, 0.2);
      for (let y = top - 0.15; y > BOT; y -= 0.15) kit.boxAt(g, sleeper, x0, y + 0.02, z0 - 0.015, SLX1 - x0, 0.13, 0.2);
      const dep = 0.85 - 0.2 + (i === 2 ? 0.5 : 0);
      kit.boxAt(g, gravelMat, x0 + 0.2, BOT, z0 + 0.2, SLX1 - x0 - 0.2, top - BOT - 0.04, dep);
      kit.boxAt(g, gapMat, x0, BOT, z0 + 0.2, 0.2, top - BOT - 0.01, dep); // driveway-side end: stacked sleepers too
      for (let y = top - 0.15; y > BOT; y -= 0.15) kit.boxAt(g, sleeper, x0 - 0.015, y + 0.02, z0 + 0.2, 0.2, 0.13, dep);
      phys.boxAABB([x0, BOT, z0], [SLX1, top, z0 + 0.2 + dep]);
    }
    wallBox(dLeft(FRONT_Z) + 0.05, FRONT_Z - 0.05, dLeft(FRONT_Z) + 0.75, FRONT_Z + 0.55, WALK_Y + 1.0);
  }

  // ================================================================ planting (shared CC0 shrub + grass models, site/flora.js)
  /* p01: loose silvery olive / westringia shrubs and ornamental grasses (was lollipop topiaries + blob clusters).
     Same positions as before; each plant = 1-2 overlapping shrub_02 instances tinted around 0x9aa48a. */
  {
    const r = kit.rng(5150); const sh = [], shS = [], gr = [];
    const yardY = (z) => YARD_Y;
    const TINT = { olive: 0xa3ab92, lav: 0x8e9a7e, box: 0x86926f, hedge: 0x7f8c68, dark: 0x6f7c5c, sage: 0x9aa48a };
    const GRASS = [0xb3aa82, 0xa8a27a, 0x9fa07a, 0xbcb08a];
    const jit = (hex) => new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06).getHex();
    // plant(x, z, yBase, height, width, type)
    /* the sapling-like model reads fuller with overlapping, differently turned instances: 2 for the tall ones, 1 for
       the small (front-view GPU budget: ~5k tris per instance, alpha-tested) */
    const plant = (x, z, y, h, w, type, list = sh) => { const c = jit(TINT[type] ?? TINT.sage), n = list === shS ? 2 : 1;
      for (let j = 0; j < n; j++) { const hh = h * (0.8 + r() * 0.3); list.push({ x: x + (r() - 0.5) * 0.3 * w, y: y - 0.03, z: z + (r() - 0.5) * 0.3 * w, h: hh, w: Math.max(w * 1.5, hh * 1.05), ry: r() * 6.3, color: c, v: j === 1 ? 3 : 1 }); } };
    const tuft = (x, z, y, h, w, type = 'grass') => { if (type !== 'grass') return plant(x, z, y, h * 0.85, w, type);
      gr.push({ x, y: y - 0.02, z, h: h * 0.9, w: w * 1.3, ry: r() * 6.3, color: GRASS[Math.floor(r() * GRASS.length)], v: gr.length % 5 }); };
    const olive = (x, z, y, h) => plant(x, z, y, h, h * 0.62, 'olive', shS);
    // walk / driveway strip planter (soil follows the stepped walls): ornamental grasses along the stairs, a few sage
    for (let z = -6.2; z < 0.2; z += 0.6) { const y = stripTop(z) - 0.07; if (r() < 0.25) plant(11.25, z, y, 0.55, 0.45, 'sage'); else tuft(11.25, z, y, 0.75 + r() * 0.2, 0.42, 'grass'); }
    // turret / ledge planter (v01/v09: ornamental grasses + rosemary behind the seat ledge, a small tree near the cheek)
    olive(6.0, 3.0, SOIL, 1.9); olive(7.7, 0.4, SOIL, 1.5);
    for (let t = 0.08; t < 0.95; t += 0.12) { const x = LEDGE_S[0] + (LEDGE_B[0] - LEDGE_S[0]) * t - 0.55, z = LEDGE_S[1] + (LEDGE_B[1] - LEDGE_S[1]) * t - 0.4;
      tuft(x, z, SOIL, 0.55 + r() * 0.3, 0.5, r() < 0.6 ? 'grass' : 'sage'); }
    for (const [x, z] of [[7.6, 1.6], [8.0, 1.0], [7.5, 0.2], [8.8, 0.1], [7.3, 2.3], [6.5, 2.85]]) plant(x, z, SOIL, 0.65 + r() * 0.2, 0.75, 'sage');
    // SW block front bed + DG yard: sparse, varied (p00: olives, grasses, a few dark shrubs on warm gravel)
    for (let x = 0.9; x < 5.0; x += 1.3) tuft(x, 6.2 + (r() - 0.5) * 0.4, YARD_Y, 0.7, 0.55, r() < 0.5 ? 'grass' : 'sage');
    for (const [x, z, h] of [[1.2, 1.5, 1.5], [4.2, -0.8, 1.3], [6.4, 1.6, 1.6], [2.2, -2.6, 1.2], [-1.6, 2.4, 1.4], [3.6, 4.4, 1.1]]) olive(x, z, yardY(z), h * 1.35);
    for (const [x, z, w] of [[0.0, -1.2, 1.1], [5.6, -2.9, 0.9], [-3.4, 0.4, 1.0], [6.9, 4.6, 0.8]]) plant(x, z, yardY(z), w * 1.1, w * 1.3, 'dark');
    for (const [x, z] of [[2.9, 0.6], [-0.8, 4.0], [5.2, 0.9], [-4.2, -2.6], [7.4, -1.2], [0.8, -3.6], [3.4, -3.8]].map(([x, z]) => x > 6.6 ? [6.4, z] : z < -3.1 && x > 2.8 ? [2.4, z] : [x, z])) tuft(x, z, yardY(z), 1.0 + r() * 0.4, 1.0, r() < 0.6 ? 'grass' : 'sage');
    // terrace bed along the sidewalk: row of upright silver-green shrubs/grasses (p00)
    for (let x = -5.6; x < 2.6; x += 0.85) { const xx = x + (r() - 0.5) * 0.2, zz = -5.8 + (r() - 0.5) * 0.3;
      if (r() < 0.7) plant(xx, zz, YARD_Y, 1.2 + r() * 0.5, 0.75, 'sage'); else tuft(xx, zz, YARD_Y, 1.0 + r() * 0.3, 0.8, 'grass'); }
    // left of the driveway: upright silvery shrubs ~2 m on the sleeper terraces (p01)
    for (let i = 0; i < 6; i++) { const x = dLeft(-4.1) + 1.0 + i * 0.95 + (r() - 0.5) * 0.3, z = -4.1 + (r() - 0.5) * 0.7; plant(x, z, SL_TOP(2), 1.6 + r() * 0.6, 0.9, r() < 0.5 ? 'olive' : 'sage', shS); }
    for (let i = 0; i < 10; i++) { const k = i % 2; const x = dLeft(-5.0) + 0.6 + i * 0.55 + (r() - 0.5) * 0.2, z = -6.2 + k * 0.85 + 0.3;
      if (r() < 0.5) plant(x, z, SL_TOP(k), 0.9 + r() * 0.5, 0.7, 'sage'); else tuft(x, z, SL_TOP(k), 0.8, 0.6, 'grass'); }
    try { const P = await cc0Plants(kit);
      plantInstances(root, P.shrub, shS, { shadow: true }); plantInstances(root, P.shrub, sh, { shadow: false }); plantInstances(root, P.grass, gr, { shadow: false });
      /* foliage core: the sapling-like shrub_02 reads as bare twigs on gravel on its own; a soft, dark, lumpy mass inside
         each shrub (one instanced draw, ~80 tris each) makes the beds read as the full silvery shrubs of p01 */
      /* core = cluster of 7 small lumpy lobes (merged, still one instanced draw) inside the unit sphere, so the mass reads
         as a broken leafy shrub silhouette instead of one faceted boulder; extent stays <= the old single ellipsoid */
      const coreGeo = (() => { const lobes = [], lr = kit.rng(7731);
        const L = [[0, 0.05, 0, 0.62], [0.42, -0.05, 0.12, 0.5], [-0.38, -0.02, 0.22, 0.5], [0.08, 0.0, -0.44, 0.5], [-0.2, 0.38, -0.12, 0.44], [0.25, 0.42, 0.18, 0.4], [0.0, 0.62, 0.0, 0.32]];
        for (const [ox, oy, oz, rr] of L) { const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3(), ph = lr() * 10;
          for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.82 + 0.12 * Math.sin(v.x * 7.1 + ph) * Math.cos(v.y * 6.3 + v.z * 5.7) + 0.08 * Math.sin(v.z * 13.0 + v.y * 11.0 + ph);
            p.setXYZ(i, ox + v.x * rr * k, Math.max(-0.3, oy + v.y * rr * k), oz + v.z * rr * k); g.attributes.normal.setXYZ(i, v.x, v.y, v.z); }
          lobes.push(g); }
        return kit.mergeGeometries(lobes); })();
      const leafN = kit.noiseNormal(256, 2.2, 22, 41); leafN.repeat.set(6, 4);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, normalMap: leafN, normalScale: new THREE.Vector2(2.4, 2.4) });
      const CORE_GREEN = new THREE.Color(0x56704a); const all = [...shS, ...sh]; const core = new THREE.InstancedMesh(coreGeo, coreMat, all.length); const o3 = new THREE.Object3D(), cc = new THREE.Color();
      /* keep cores out of the game-room turret bay (ROOMS.game rect starts at z 4.73 for x 5.31..8.15) */
      const GR = ctx.plan.ROOMS.game.rect, coreZ = (it) => { const rad = it.w * 0.27 * 1.05; return it.x > GR[0] - rad && it.x < GR[2] + rad ? Math.min(it.z, GR[1] - 0.06 - rad) : it.z; };
      all.forEach((it, i) => { o3.position.set(it.x, it.y + it.h * 0.36, coreZ(it)); o3.rotation.set(0, it.ry, 0); o3.scale.set(it.w * 0.27, it.h * 0.3, it.w * 0.27); o3.updateMatrix();
        core.setMatrixAt(i, o3.matrix); core.setColorAt(i, cc.setHex(it.color).lerp(CORE_GREEN, 0.6).offsetHSL(0, 0.06, 0).multiplyScalar(0.28)); });
      core.castShadow = false; core.receiveShadow = true; core.computeBoundingSphere(); core.userData.keep = true; core.name = 'cc0plants-core'; root.add(core);
    } catch (e) { console.error('[front plants]', e); window.__errors?.push('front plants: ' + (e.stack || e.message)); }
  }

  // ================================================================ dynamic props: two planter pots by the door, a ball on the lawn
  {
    const potMat = std({ color: 0x2a2826, roughness: 0.6 });
    for (const [x, z] of [[8.75, 3.95], [10.55, 3.95]]) {
      const pot = new THREE.Mesh(kit.lathe([[0, 0], [0.20, 0], [0.24, 0.05], [0.27, 0.55], [0.29, 0.58], [0.25, 0.58], [0.0, 0.55]], 32), potMat);
      pot.position.set(x, 0.0, z); pot.castShadow = true; pot.receiveShadow = true; root.add(pot);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), std({ color: 0x4d6b36, roughness: 0.85, normalMap: kit.noiseNormal(), normalScale: new THREE.Vector2(2, 2) }));
      top.position.set(0, 0.85, 0); top.scale.set(1, 1.15, 1); top.castShadow = true; pot.add(top);
      phys.dynamic(pot, { mass: 18, shape: 'box' });
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), std({ color: 0xd9d4c4, roughness: 0.5 }));
    ball.position.set(-3.5, YARD_Y + 0.2, -1.0); ball.castShadow = true; root.add(ball); phys.dynamic(ball, { mass: 0.4, shape: 'ball', restitution: 0.5 });
  }

  kit.mergeStatic(root);
}
