// Piece: kitchen — Kitchen, islands, range wall, breakfast nook in the rear corner
// Owned rooms: kitchen, kpantry, pantry, store | Reference photos: p08, p09, p10, p11
//
// Layout (world metres, see plan.js): kitchen interior x 15.39–21.40, z 10.75–21.35.
//  - Range wall on the NE wall (x = 21.40, cabinets face −x): Miele oven tower, white shaker
//    uppers/lowers, 60" pro range under a quartz-clad hood, Miele coffee column, open oak shelves
//    over a desk, tall pantry cabinet (p08, p09, p10).
//  - Oak fridge / wine / freezer column on the street-side wall (z = 10.75, faces +z) (p11).
//  - Sink island (x 18.25–19.45) and bar island (x 15.95–17.20), white quartz waterfall tops,
//    rift white-oak bases, brass faucets, two glass teardrop pendants, teak counter stools.
//  - Breakfast nook in the rear (canyon) corner: L banquette, whitewashed trestle table, two
//    teak + rope chairs, white coral "sputnik" chandelier, black roller-shade cassettes.
export const piece = { rooms: ["kitchen", "kpantry", "pantry", "store"], photos: ["p08", "p09", "p10", "p11"] };
export const ownCeiling = [];
export const views = {
  // r2: solved by least-squares fit of model corners (island tops, hood, windows, coffee column) to photo pixels
  p08: { pos: [10.09, 1.24, 15.21], look: [14.97, 1.35, 16.30], fov: 30.5 },
  p09: { pos: [20.03, 1.38, 13.75], look: [19.67, 0.98, 18.70], fov: 63 },
  p10: { pos: [18.05, 1.40, 18.00], look: [20.92, 1.30, 22.10], fov: 71 },
  // r3 p11: re-solved on the island corners + pendants only (fridge column moved to sit behind the sink island)
  p11: { pos: [20.33, 1.46, 19.56], look: [16.55, 1.17, 16.31], fov: 72 },
};

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx; const { M } = kit;
  const PI = Math.PI;
  const shelvingLater = [];

  // ------------------------------------------------------------------ helpers
  // Box-mapped UVs in metres (u along the dominant in-plane axis, v up) so wood grain runs
  // vertically on doors and stone veining is continuous at real scale.
  function boxUV(geo, off = [0, 0, 0]) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv; if (!uv || !n) return geo;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2];
      if (ax >= ay && ax >= az) uv.setXY(i, z, y); else if (ay >= az) uv.setXY(i, x, z); else uv.setXY(i, x, y);
    }
    uv.needsUpdate = true; return geo;
  }
  const mesh = (parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], uvOff = true) => {
    if (uvOff) boxUV(geo, pos);
    return kit.add(parent, geo, mat, pos, rot);
  };
  // box by min corner, uv-mapped
  const bx = (parent, mat, x0, y0, z0, w, h, d, r = 0) => {
    const g = r > 0 ? kit.rbox(w, h, d, r, 2) : new THREE.BoxGeometry(w, h, d);
    return mesh(parent, g, mat, [x0 + w / 2, y0 + h / 2, z0 + d / 2]);
  };
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ------------------------------------------------------------------ materials
  const R = kit.rng(808);
  // Calacatta-style white quartz: warm white with sparse soft grey veins (p08 backsplash/hood, islands).
  const quartzMap = kit.canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const v = 236 + R() * 14; g.fillStyle = `rgba(${v},${v - 1},${v - 3},0.25)`; g.fillRect(R() * w, R() * h, 3 + R() * 18, 3 + R() * 18); }
    // Veins are stroked WITHOUT a canvas filter onto two layers, then each layer is blurred ONCE.
    // (A blur filter on every stroke of a 2048² canvas ran hundreds of GPU blur passes, hung Chrome's
    // GPU process and lost the WebGL context for the whole house.)
    const layer = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const halo = layer(), core = layer(); const gh = halo.getContext('2d'), gc = core.getContext('2d');
    const vein = (cx, x, y, ang, len, width, alpha) => {
      cx.strokeStyle = `rgba(118,116,112,${alpha})`; cx.lineWidth = width; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(x, y); let a = ang;
      for (let s = 0; s < len; s += 14) { a += (R() - 0.5) * 0.35; x += Math.cos(a) * 14; y += Math.sin(a) * 14; cx.lineTo(x, y);
        if (R() < 0.02) { const bx2 = x, by2 = y; cx.stroke(); vein(cx, bx2, by2, a + (R() - 0.5) * 1.6, len * 0.25, width * 0.6, alpha * 0.8); cx.beginPath(); cx.moveTo(x, y); } }
      cx.stroke();
    };
    // soft grey veins (p09): wide blurred halo + a thin, light core; no wiry dark lines
    for (let i = 0; i < 6; i++) { const x = R() * w, y = R() * h, a = -0.7 + (R() - 0.5) * 0.6; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { vein(gh, x + dx, y + dy, a, 1600, 14, 0.13); vein(gc, x + dx, y + dy, a, 1600, 2.6, 0.62); } }
    for (let i = 0; i < 14; i++) { const x = R() * w, y = R() * h, a = -0.6 + (R() - 0.5) * 1.2; vein(gc, x, y, a, 600, 1.5, 0.34); }
    g.save(); g.filter = 'blur(12px)'; g.drawImage(halo, 0, 0); g.filter = 'blur(1.1px)'; g.drawImage(core, 0, 0); g.restore();
  }, { repeat: [1 / 2.2, 1 / 2.2] });
  // r3: polished Calacatta quartz: clearcoat for crisp probe reflections (p09 counters read glossy)
  const quartz = new THREE.MeshPhysicalMaterial({ map: quartzMap, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.06, color: 0xffffff });
  // satin white lacquer (shaker uppers, range-wall lowers, banquette)
  const lacquer = std({ color: 0xf0ede6, roughness: 0.42, normalMap: kit.noiseNormal(128, 0.3, 8, 4), normalScale: new THREE.Vector2(0.05, 0.05) });
  // rift-sawn white oak: warm honey (p08/p11 island bases, fridge column). r2: the grey-taupe veneer scan is
  // re-graded on a canvas (half-blended toward honey) so the grain keeps its fine straight lines but loses
  // the dark cathedral bands that read as stripes/seams; the rotated copy (oakH) is drawn rotated, not UV-rotated.
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const oakImg = await loadImg('assets/ph/white_oak_veneer/white_oak_veneer_diff_1k.jpg');
  const oakCanvas = (rot) => kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b8936c'; g.fillRect(0, 0, w, h);
    if (oakImg) { g.save(); if (rot) { g.translate(w / 2, h / 2); g.rotate(PI / 2); g.translate(-w / 2, -h / 2); } g.globalAlpha = 0.85; g.drawImage(oakImg, 0, 0, w, h); g.restore(); }
    g.globalCompositeOperation = 'overlay'; g.fillStyle = 'rgba(214,168,118,0.42)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  }, { repeat: [1 / 1.3, 1 / 1.3] });
  const oakColor = new THREE.Color(1.30, 1.16, 1.0);
  const oakN = (rot) => { const o = kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1 / 1.3, 1 / 1.3] }); if (rot) { o.normalMap.rotation = o.roughnessMap.rotation = PI / 2; } return o; };
  const oak = std({ ...oakN(false), map: oakCanvas(false), roughness: 0.5, normalScale: new THREE.Vector2(0.10, 0.10) }); oak.color.copy(oakColor);
  const oakH = std({ ...oakN(true), map: oakCanvas(true), roughness: 0.5, normalScale: new THREE.Vector2(0.10, 0.10) }); oakH.color.copy(oakColor);
  // darker weathered walnut-oak for the counter stools (p08)
  const teak = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1 / 0.6, 1 / 0.6] }), roughness: 0.7 }); teak.color.setRGB(0.92, 0.76, 0.60);
  // shadowed reveal behind every door/drawer front so the divisions read at a distance
  const reveal = std({ color: 0x4a4540, roughness: 0.9 });
  // r3: recessed plinths are painted white/oak in shadow, never black (p10)
  const toeMat = std({ color: 0xb9b4ab, roughness: 0.85 });
  const chairWood = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1 / 0.5, 1 / 0.5] }), roughness: 0.5 }); chairWood.color.setRGB(1.18, 0.86, 0.58);
  // unlacquered brushed brass (LOOKDEV recipe)
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd4a84b, roughness: 0.3, metalness: 1.0, anisotropy: 0.4 });
  // brushed stainless: fine horizontal streaks in colour + roughness (p09 range)
  const brushed = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, w, h); const r = kit.rng(4242);
    for (let i = 0; i < 1400; i++) { const v = 150 + r() * 90; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(r() * w - 60, r() * h, 80 + r() * 300, 1); }
  }, { repeat: [1 / 0.5, 1 / 0.5] });
  // brushed stainless (LOOKDEV recipe): anisotropic streaks run along u (horizontal on the boxUV fronts)
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xbfc3c7, roughness: 0.34, roughnessMap: brushed, metalness: 1.0, anisotropy: 0.4, envMapIntensity: 1.1 });
  const darkSteel = std({ color: 0x2c2c2c, roughness: 0.38, metalness: 0.85 });
  const castIron = std({ color: 0x151515, roughness: 0.6, metalness: 0.4 });
  const blackGlass = std({ color: 0x08090a, roughness: 0.06, metalness: 0.3 });
  const wall = M.paintWhite;
  // weathered grey-white reclaimed planks (p10 trestle table): silver-grey oak scan + distressed relief
  const ashImg = await loadImg('assets/ph/silver_oak_veneer_01/silver_oak_veneer_01_diff_1k.jpg');
  const ashMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    if (ashImg) g.drawImage(ashImg, 0, 0, w, h); else { g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, w, h); }
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.85)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; const r = kit.rng(99);
    // weathered grey streaks along the grain + lime-wash patches
    for (let i = 0; i < 220; i++) { const v = 120 + r() * 60; g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.10 + r() * 0.18})`; g.fillRect(r() * w - 100, r() * h, 120 + r() * 500, 1 + r() * 3); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(200,192,178,${0.06 + r() * 0.12})`; g.fillRect(r() * w - 60, r() * h, 80 + r() * 300, 6 + r() * 30); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(92,74,56,${0.10 + r() * 0.2})`; g.fillRect(r() * w - 60, r() * h, 60 + r() * 260, 1 + r() * 2); }
  }, { repeat: [1 / 0.9, 1 / 0.9] });
  const whitewash = std({ map: ashMap, normalMap: kit.tex('assets/ph/distressed_painted_planks/distressed_painted_planks_nor_gl_1k.jpg', { repeat: [1 / 1.2, 1 / 1.2] }), normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: kit.tex('assets/ph/distressed_painted_planks/distressed_painted_planks_rough_1k.jpg', { repeat: [1 / 1.2, 1 / 1.2] }), roughness: 0.95 }); whitewash.color.setRGB(0.86, 0.76, 0.64);
  const glassClear = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f1, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false, ior: 1.5, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02 });
  // pendant globes: a touch more body so the clear shell reads against the white wall (p08/p11)
  const globeGlass = glassClear.clone(); globeGlass.opacity = 0.2; globeGlass.color.set(0xe9eeec);
  const opal = std({ color: 0xffffff, emissive: 0xfff0d6, emissiveIntensity: 2.6, roughness: 0.45 });
  const coralMat = std({ color: 0xf6f3ec, roughness: 0.55 });
  const rope = (() => {
    const t = kit.canvasTex(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.lineCap = 'round';
      for (const [dir, col] of [[1, '#d9c7a6'], [-1, '#cdb894']]) {
        g.strokeStyle = col; g.lineWidth = 10;
        for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + dir * 256, 256); g.stroke(); }
      }
      g.strokeStyle = 'rgba(120,95,60,0.6)'; g.lineWidth = 1.5;
      for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * 32 + 4, 0); g.lineTo(i * 32 + 4 + 256, 256); g.stroke(); }
    }, { repeat: [3, 3] });
    return std({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  })();

  // brass bar pull (length L along local x, posts toward −z = into the door)
  const pullCache = new Map();
  function pullGeo(L, r = 0.0065, standoff = 0.032) {
    const k = L + ':' + r; if (pullCache.has(k)) return pullCache.get(k);
    const bar = new THREE.CylinderGeometry(r, r, L, 12); bar.rotateZ(PI / 2); bar.translate(0, 0, standoff);
    const parts = [bar];
    for (const s of [-1, 1]) { const p = new THREE.CylinderGeometry(r * 0.8, r * 0.9, standoff, 10); p.rotateX(PI / 2); p.translate(s * (L / 2 - 0.02), 0, standoff / 2); parts.push(p); }
    const g = kit.mergeGeometries(parts); pullCache.set(k, g); return g;
  }
  // a pull at (x,y,z) in a face group (fronts face +z); vertical if v
  const pull = (g, x, y, z, L, v = false, mat = brass, r) => kit.add(g, pullGeo(L, r), mat, [x, y, z], [0, 0, v ? PI / 2 : 0]);
  const knob = (g, x, y, z) => { const k = kit.lathe([[0.001, 0], [0.008, 0], [0.006, 0.012], [0.013, 0.022], [0.014, 0.03], [0.001, 0.034]], 16); k.rotateX(PI / 2); return kit.add(g, k, brass, [x, y, z]); };

  // shaker or slab front (bottom-left at x,y; back face at z; faces +z)
  function front(g, x, y, w, h, z, mat, slab = false, gap = 0.0042) {
    const fw = w - gap * 2, fh = h - gap * 2;
    // dark reveal plate (hidden behind the front except in the gaps) so divisions read as shadow lines;
    // set 1 mm behind the door back so it never z-fights with the carcass face (r1 dotted seam artifacts)
    kit.add(g, new THREE.BoxGeometry(w, h, 0.003), reveal, [x + w / 2, y + h / 2, z + 0.0005]).castShadow = false;
    // shaker: 70 mm stiles/rails, 11 mm deep recessed centre panel so the frame shadow reads at a distance
    if (slab) return mesh(g, kit.rbox(fw, fh, 0.02, 0.002, 1).translate(fw / 2, fh / 2, 0.01), mat, [x + gap, y + gap, z], [0, 0, 0], true);
    // r2 shaker: frame + recessed panel on a slightly darker twin material + a thin shadow line inside the
    // top and side rails (baked contact shadow), so the relief reads under soft photo lighting
    const fr = Math.min(0.07, fw * 0.17), dep = 0.022, rec = 0.011, X = x + gap, Y = y + gap;
    const frame = kit.mergeGeometries([
      new THREE.BoxGeometry(fw, fr, dep).translate(fw / 2, fr / 2, dep / 2), new THREE.BoxGeometry(fw, fr, dep).translate(fw / 2, fh - fr / 2, dep / 2),
      new THREE.BoxGeometry(fr, fh - 2 * fr, dep).translate(fr / 2, fh / 2, dep / 2), new THREE.BoxGeometry(fr, fh - 2 * fr, dep).translate(fw - fr / 2, fh / 2, dep / 2)]);
    const m = mesh(g, frame, mat, [X, Y, z], [0, 0, 0], true);
    const pw = fw - 2 * fr, ph = fh - 2 * fr;
    mesh(g, new THREE.BoxGeometry(pw, ph, dep - rec).translate(pw / 2, ph / 2, (dep - rec) / 2), panelOf(mat), [X + fr, Y + fr, z], [0, 0, 0], true);
    const sh = shadowOf(mat), zz = z + dep - rec + 0.0006;
    kit.add(g, new THREE.PlaneGeometry(pw, 0.012), sh, [X + fr + pw / 2, Y + fr + ph - 0.006, zz]).castShadow = false;
    kit.add(g, new THREE.PlaneGeometry(0.008, ph - 0.012), sh, [X + fr + 0.004, Y + fr + (ph - 0.012) / 2, zz]).castShadow = false;
    kit.add(g, new THREE.PlaneGeometry(0.008, ph - 0.012), sh, [X + fr + pw - 0.004, Y + fr + (ph - 0.012) / 2, zz]).castShadow = false;
    return m;
  }
  const panelCache = new Map(), shadowCache = new Map();
  function panelOf(mat) { if (!panelCache.has(mat)) { const p = mat.clone(); p.color = mat.color.clone().multiplyScalar(0.94); panelCache.set(mat, p); } return panelCache.get(mat); }
  function shadowOf(mat) { if (!shadowCache.has(mat)) { const p = mat.clone(); p.color = mat.color.clone().multiplyScalar(0.80); p.normalMap = null; shadowCache.set(mat, p); } return shadowCache.get(mat); }
  // A cabinet carcass + toe kick (local frame: wall at z=0, fronts at z=d, x along the run)
  function carcass(g, x0, w, y0, y1, d, mat, toe = 0.10) {
    if (toe > 0 && y0 < 0.01) { bx(g, toeMat, x0, 0, 0, w, toe, d - 0.07); y0 = toe; }
    bx(g, mat, x0, y0, 0, w, y1 - y0, d - 0.022);
  }
  // Drawer stack with horizontal brass bar pulls (heights listed bottom→top)
  function drawers(g, x0, w, y0, hs, d, mat, slab = false, pullL) {
    let y = y0; for (const h of hs) { front(g, x0, y, w, h, d - 0.022, mat, slab); pull(g, x0 + w / 2, y + h - Math.min(0.07, h * 0.3), d, pullL ?? Math.min(0.30, w * 0.45)); y += h; }
    return y;
  }
  // Glass-door wine case (local frame: back at z=0, front plane at z=d, faces +z): oak frame,
  // warm-lit interior, bottles lying neck-out on racks, tinted glass in an oak stile door.
  const wineInner = std({ color: 0x0e0c0a, emissive: 0x2a1a0c, emissiveIntensity: 0.35, roughness: 0.8 });
  const wineLed = std({ color: 0xfff0d8, emissive: 0xffe2b8, emissiveIntensity: 1.1 });
  const wineGlass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c0d, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.8, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  const bottleMats = [std({ color: 0x121611, roughness: 0.2, metalness: 0.2 }), std({ color: 0x1c0f0f, roughness: 0.2, metalness: 0.2 })];
  const bottleGeo = kit.lathe([[0.001, 0], [0.036, 0], [0.037, 0.2], [0.03, 0.24], [0.013, 0.27], [0.012, 0.31], [0.001, 0.31]], 12).rotateX(PI / 2);
  function wineCase(g, x0, y0, w, h, d, rows) {
    const t = 0.022;
    bx(g, oak, x0, y0, 0, t, h, d - 0.02); bx(g, oak, x0 + w - t, y0, 0, t, h, d - 0.02);
    bx(g, oak, x0, y0, 0, w, t, d - 0.02); bx(g, oak, x0, y0 + h - t, 0, w, t, d - 0.02);
    bx(g, wineInner, x0 + t, y0 + t, 0, w - 2 * t, h - 2 * t, 0.02);
    for (const s of [0, 1]) bx(g, wineLed, x0 + t + s * (w - 2 * t - 0.006), y0 + t + 0.02, d - 0.10, 0.006, h - 2 * t - 0.04, 0.012);
    const rh = (h - 2 * t) / rows, per = Math.max(1, Math.floor((w - 2 * t) / 0.085)), sp = (w - 2 * t) / per;
    const ims = bottleMats.map(m => new THREE.InstancedMesh(bottleGeo, m, rows * per)); const cnt = [0, 0]; const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) {
      const ry = y0 + t + r * rh;
      bx(g, darkSteel, x0 + t, ry, 0.04, w - 2 * t, 0.008, d - 0.10);
      for (let c = 0; c < per; c++) { const k = (r * 3 + c) % 4 === 0 ? 1 : 0; m4.makeTranslation(x0 + t + sp * (c + 0.5), ry + 0.045, d - 0.40); ims[k].setMatrixAt(cnt[k]++, m4); }
    }
    ims.forEach((im, k) => { im.count = cnt[k]; g.add(im); });
    const sw = 0.05, dz = d - t;
    bx(g, oak, x0, y0, dz, sw, h, t); bx(g, oak, x0 + w - sw, y0, dz, sw, h, t);
    bx(g, oak, x0, y0, dz, w, sw, t); bx(g, oak, x0, y0 + h - sw, dz, w, sw, t);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * sw, h - 2 * sw), wineGlass); gl.position.set(x0 + w / 2, y0 + h / 2, dz + t / 2); gl.castShadow = false; g.add(gl);
  }

  // ================================================================== RANGE WALL (x = 21.40, faces −x)
  // local frame: x = world z, z = distance from the wall (21.40 − world x)
  const rw = kit.group(root, [21.40, 0, 0], -PI / 2, 'rangeWall');
  const D = 0.64, CT = 0.93, UP0 = 1.45, TOP = 2.88, CEIL = 3.05, CY = CEIL - 0.008; // CY: just under the shell's ceiling patch (CEIL - 0.005)
  const counter = (x0, x1, d = D + 0.02) => bx(rw, quartz, x0, CT - 0.03, 0, x1 - x0, 0.03, d);
  const crown = (x0, x1, d) => bx(rw, oakH, x0, TOP, 0, x1 - x0, CEIL - TOP - 0.002, d);
  // A: Miele oven tower 14.20–14.96
  {
    const x0 = 13.68, w = 0.76; carcass(rw, x0, w, 0, TOP, D, lacquer);
    drawers(rw, x0, w, 0.10, [0.36], D, lacquer);
    // warming drawer (steel + black glass)
    bx(rw, steel, x0 + 0.03, 0.47, D - 0.022, w - 0.06, 0.29, 0.02); bx(rw, blackGlass, x0 + 0.06, 0.50, D - 0.001, w - 0.12, 0.17, 0.004);
    pull(rw, x0 + w / 2, 0.71, D, 0.5, false, steel, 0.008);
    // speed oven + main oven
    for (const [y, h] of [[0.78, 0.46], [1.25, 0.60]]) {
      bx(rw, steel, x0 + 0.02, y, D - 0.022, w - 0.04, h - 0.01, 0.022);
      bx(rw, blackGlass, x0 + 0.05, y + 0.04, D, w - 0.10, h - 0.16, 0.006);
      bx(rw, darkSteel, x0 + 0.06, y + h - 0.09, D, w - 0.12, 0.05, 0.006);
      pull(rw, x0 + w / 2, y + h - 0.13, D + 0.004, w - 0.14, false, steel, 0.008);
    }
    front(rw, x0, 1.86, w, TOP - 1.86, D - 0.022, lacquer);
    pull(rw, x0 + w / 2, 1.93, D, 0.22);
    crown(x0, x0 + w, D);
  }
  // B + D: base cabinets with uppers either side of the range
  const baseRun = (x0, w, cols) => {
    carcass(rw, x0, w, 0, CT - 0.03, D, lacquer);
    const cw = w / cols; for (let c = 0; c < cols; c++) drawers(rw, x0 + c * cw, cw, 0.10, [0.25, 0.25, 0.30], D, lacquer);
    counter(x0, x0 + w);
  };
  const uppers = (x0, w, n, d = 0.36) => {
    bx(rw, lacquer, x0, UP0, 0, w, TOP - UP0, d - 0.022);
    const dw = w / n; for (let i = 0; i < n; i++) { front(rw, x0 + i * dw, UP0, dw, TOP - UP0, d - 0.022, lacquer); const right = i % 2 === 0; pull(rw, x0 + i * dw + (right ? dw - 0.05 : 0.05), UP0 + 0.17, d, 0.16, true); }
    crown(x0, x0 + w, d);
  };
  baseRun(14.44, 0.95, 1); uppers(14.44, 0.95, 2);
  baseRun(17.19, 1.70, 2); uppers(17.19, 1.70, 4);
  // quartz backsplash slab (full height behind the range up to the hood)
  bx(rw, quartz, 14.44, CT, 0, 4.45, UP0 - CT, 0.015);
  bx(rw, quartz, 15.39, UP0, 0, 1.80, 2.05 - UP0, 0.015);
  // C: 60" pro range 15.80–17.32
  {
    const x0 = 15.53, w = 1.52, g = rw;
    bx(g, castIron, x0 + 0.02, 0, 0.05, w - 0.04, 0.10, D - 0.10);
    bx(g, steel, x0, 0.10, 0.02, w, 0.80, D + 0.04, 0.006);
    const fz = D + 0.06;
    // oven doors: large left, small right; each a steel slab with a tube handle
    for (const [ox, ow] of [[0.02, 0.88], [0.92, 0.58]]) {
      bx(g, steel, x0 + ox, 0.18, fz - 0.005, ow - 0.02, 0.52, 0.03, 0.006);
      bx(g, darkSteel, x0 + ox + 0.04, 0.22, fz + 0.022, ow - 0.10, 0.008, 0.004);
      const h = new THREE.CylinderGeometry(0.012, 0.012, ow - 0.12, 14); h.rotateZ(PI / 2); kit.add(g, h, steel, [x0 + ox + (ow - 0.02) / 2, 0.66, fz + 0.07]);
      for (const s of [-1, 1]) { const p = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8); p.rotateX(PI / 2); kit.add(g, p, steel, [x0 + ox + (ow - 0.02) / 2 + s * (ow / 2 - 0.08), 0.66, fz + 0.045]); }
    }
    // control rail: black knob panel in a stainless surround (p09), brushed knobs
    bx(g, steel, x0, 0.72, fz - 0.02, w, 0.16, 0.05);
    bx(g, castIron, x0 + 0.05, 0.74, fz + 0.031, w - 0.10, 0.12, 0.004);
    const knobG = kit.lathe([[0.001, 0], [0.024, 0], [0.025, 0.018], [0.021, 0.034], [0.001, 0.036]], 20); knobG.rotateX(PI / 2);
    for (let i = 0; i < 9; i++) kit.add(g, knobG, i === 4 ? castIron : steel, [x0 + 0.12 + i * 0.16, 0.80, fz + 0.033]);
    // cooktop deck: dark enamel spill tray under 4 burners + grates (left), french top + griddle (right)
    bx(g, steel, x0, 0.90, 0.02, w, 0.03, D + 0.02);
    bx(g, castIron, x0 + 0.03, 0.9305, 0.05, w - 0.06, 0.002, D - 0.04);
    const gr = new THREE.Group(); g.add(gr);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const cx = x0 + 0.20 + i * 0.32, cz = 0.18 + j * 0.30;
      bx(gr, castIron, cx - 0.15, 0.935, cz - 0.14, 0.30, 0.009, 0.009); bx(gr, castIron, cx - 0.15, 0.935, cz + 0.13, 0.30, 0.009, 0.009);
      bx(gr, castIron, cx - 0.15, 0.935, cz - 0.14, 0.009, 0.009, 0.28); bx(gr, castIron, cx + 0.141, 0.935, cz - 0.14, 0.009, 0.009, 0.28);
      bx(gr, castIron, cx - 0.15, 0.944, cz - 0.005, 0.30, 0.012, 0.009); bx(gr, castIron, cx - 0.005, 0.944, cz - 0.14, 0.009, 0.012, 0.28);
      kit.add(gr, kit.cyl(0.045, 0.05, 0.02, 20), castIron, [cx, 0.935, cz]);
    }
    // french top (concentric rings) + plancha
    const ft = kit.cyl(0.26, 0.26, 0.012, 48); kit.add(g, ft, castIron, [x0 + 0.98, 0.935, 0.33]);
    for (const r of [0.06, 0.13, 0.20]) kit.add(g, kit.torus(r, 0.004, 6, 48), steel, [x0 + 0.98, 0.942, 0.33], [PI / 2, 0, 0]);
    bx(g, castIron, x0 + 1.27, 0.93, 0.08, 0.23, 0.012, 0.50);
    // perforated backguard / riser
    bx(g, steel, x0, 0.93, 0.0, w, 0.16, 0.05);
    bx(g, steel, x0, 1.07, 0.0, w, 0.012, 0.075); // rolled top lip
    for (let i = 0; i < 24; i++) kit.add(g, kit.cyl(0.0125, 0.0125, 0.01, 14), castIron, [x0 + 0.07 + i * 0.0597, 1.02, 0.051], [PI / 2, 0, 0]);
  }
  // hood: quartz-clad box with stainless liner and baffle filters underneath
  {
    const x0 = 15.39, w = 1.80, hd = 0.62;
    // r3: quartz-clad shell with a 9 cm skirt all round, so from the dining (p08) it reads as one
    // clean stone box; the brushed liner + dark baffle filters sit recessed inside, seen from below (p09)
    bx(rw, quartz, x0, 2.08, 0, w, TOP + 0.17 - 2.08, hd);
    bx(rw, quartz, x0, 1.99, hd - 0.035, w, 0.09, 0.035); bx(rw, quartz, x0, 1.99, 0, 0.035, 0.09, hd); bx(rw, quartz, x0 + w - 0.035, 1.99, 0, 0.035, 0.09, hd);
    bx(rw, steel, x0 + 0.035, 2.06, 0.0, w - 0.07, 0.02, hd - 0.035);
    bx(rw, castIron, x0 + 0.07, 2.052, 0.07, w - 0.14, 0.004, hd - 0.16);
    for (let i = 0; i < 14; i++) bx(rw, steel, x0 + 0.08 + i * 0.118, 2.04, 0.08, 0.104, 0.012, hd - 0.18);
  }
  // E: Miele coffee column 18.76–19.51
  {
    const x0 = 18.89, w = 0.76; carcass(rw, x0, w, 0, TOP, D, lacquer);
    let y = drawers(rw, x0, w, 0.10, [0.30, 0.30, 0.30, 0.17], D, lacquer);
    // built-in coffee machine
    // Miele built-in coffee machine: stainless fascia, dark brew recess with steel spouts, slim display strip
    bx(rw, steel, x0 + 0.04, y + 0.02, D - 0.022, w - 0.08, 0.46, 0.028);
    bx(rw, castIron, x0 + 0.24, y + 0.07, D + 0.004, w - 0.48, 0.22, 0.004);
    bx(rw, steel, x0 + 0.33, y + 0.26, D + 0.006, w - 0.66, 0.05, 0.03);
    for (const s of [-1, 1]) kit.add(rw, kit.cyl(0.008, 0.006, 0.03, 10), steel, [x0 + w / 2 + s * 0.02, y + 0.245, D + 0.02]);
    bx(rw, steel, x0 + 0.21, y + 0.075, D + 0.006, w - 0.42, 0.012, 0.06); // drip tray grille
    bx(rw, blackGlass, x0 + 0.09, y + 0.38, D + 0.005, w - 0.18, 0.045, 0.004);
    front(rw, x0, y + 0.50, w, TOP - y - 0.50, D - 0.022, lacquer);
    pull(rw, x0 + 0.06, y + 0.66, D, 0.18, true);
    crown(x0, x0 + w, D);
  }
  // F: desk + open oak shelves 19.51–20.41 (recessed alcove, white back)
  {
    const x0 = 19.65, w = 0.90, dd = 0.56;
    carcass(rw, x0, w, 0, 0.73, dd, lacquer);
    drawers(rw, x0, w, 0.58, [0.15], dd, lacquer, false, 0.3); bx(rw, lacquer, x0, 0.10, dd - 0.10, w, 0.48, 0.02);
    // two shallow drawers + kneehole look: two fronts side by side
    bx(rw, quartz, x0, 0.73, 0, w, 0.03, dd + 0.02);
    for (const sy of [1.24, 1.66, 2.08]) bx(rw, oakH, x0 + 0.005, sy + 0.005, 0, w - 0.01, 0.05, 0.32, 0.003); // r3: 5 cm rift-oak slabs
    crown(x0, x0 + w, 0.30);
  }
  // G: tall pantry cabinet 20.41–21.11
  {
    const x0 = 20.55, w = 0.80; carcass(rw, x0, w, 0, TOP, D, lacquer);
    drawers(rw, x0, w, 0.10, [0.26, 0.26], D, lacquer);
    front(rw, x0, 0.62, w, TOP - 0.62, D - 0.022, lacquer);
    pull(rw, x0 + 0.06, 1.15, D, 0.20, true);
    crown(x0, x0 + w, D);
  }

  // ================================================================== FRIDGE WALL (z = 10.75, faces +z)
  // r3 (p11): the oak column sits centred behind the sink island (x 16.57–19.42, clear of the mudroom
  // door at x 15.55–16.45): paneled fridge | narrow dark-glass wine column | wide fridge/freezer, a row of
  // oak uppers over all of it. To its right a white wall jogs forward to z 12.55 with a flat rift-oak door
  // (the kitchen pantry: the pocket behind it reaches the kp-d door into kpantry).
  const fw = kit.group(root, [0, 0, 10.75], 0, 'fridgeWall');
  const FX0 = 16.57, FX1 = 19.42, FD = 0.66, TOPF = 2.88;
  {
    const d = FD, mods = [[FX0, 0.80], [FX0 + 0.80, 0.45], [FX0 + 1.25, 0.80], [FX0 + 2.05, 0.80]];
    for (const [x, w] of mods) if (w !== 0.45) carcass(fw, x, w, 0, TOPF, d, oak);
    const [wx, ww] = mods[1];
    carcass(fw, wx, ww, 2.30, TOPF, d, oak, 0); bx(fw, toeMat, wx, 0, 0, ww, 0.10, d - 0.07);
    const panel = (x, w, y0, y1) => front(fw, x, y0, w, y1 - y0, d - 0.022, oak, false);
    panel(mods[0][0], 0.80, 0.10, 2.30); pull(fw, mods[0][0] + 0.73, 1.20, d, 0.75, true, brass, 0.009);
    wineCase(fw, wx, 0.10, ww, 2.20, d, 9);
    pull(fw, wx + 0.05, 1.20, d, 0.6, true, brass, 0.009);
    panel(mods[2][0], 0.80, 0.10, 2.30); panel(mods[3][0], 0.80, 0.10, 2.30);
    pull(fw, mods[2][0] + 0.73, 1.20, d, 0.75, true, brass, 0.009); pull(fw, mods[3][0] + 0.07, 1.20, d, 0.75, true, brass, 0.009);
    for (const [x, w] of mods) front(fw, x, 2.30, w, TOPF - 2.30, d - 0.022, oak);
    bx(fw, oakH, FX0, TOPF, 0, FX1 - FX0, CEIL - TOPF - 0.002, d);
    // finished oak end panels
    bx(fw, oak, FX0 - 0.02, 0, 0, 0.02, CEIL - 0.002, d); bx(fw, oak, FX1, 0, 0, 0.02, CEIL - 0.002, d);
  }
  // pantry jog wall + flat oak door (p11 right)
  {
    const pw = kit.group(root, [0, 0, 0], 0, 'pantryWall');
    const WZ = 12.55, T = 0.12, rx = FX1 + 0.02, dx0 = 19.66, dx1 = 20.56, dh = 2.45;
    const seg = (x0, z0, x1, z1, y0 = 0, y1 = CEIL) => { bx(pw, wall, x0, y0, z0, x1 - x0, y1 - y0, z1 - z0); phys.boxAABB([x0, y0, z0], [x1, y1, z1]); };
    seg(rx, 10.75, rx + T, WZ);                        // return beside the fridge column
    seg(rx, WZ - T, dx0, WZ); seg(dx1, WZ - T, 21.40, WZ); seg(dx0, WZ - T, dx1, WZ, dh, CEIL);
    // white casing
    const cs = 0.07; bx(pw, lacquer, dx0 - cs, 0, WZ, cs, dh + cs, 0.018); bx(pw, lacquer, dx1, 0, WZ, cs, dh + cs, 0.018); bx(pw, lacquer, dx0 - cs, dh, WZ, dx1 - dx0 + 2 * cs, cs, 0.018);
    // rift-oak slab leaf (vertical grain), 3 mm reveal, matte-black lever; visual only so players can pass
    const leaf = kit.group(pw, [dx0 + 0.003, 0.008, WZ - 0.085], 0, 'pantryDoor');
    mesh(leaf, kit.rbox(dx1 - dx0 - 0.006, dh - 0.011, 0.044, 0.003, 1).translate((dx1 - dx0 - 0.006) / 2, (dh - 0.011) / 2, 0.022), oak, [0, 0, 0], [0, 0, 0], true);
    const blk = new THREE.MeshPhysicalMaterial({ color: 0x151515, metalness: 0.8, roughness: 0.45 });
    const lx = dx1 - dx0 - 0.075;
    kit.add(leaf, kit.cyl(0.026, 0.026, 0.01, 20).rotateX(PI / 2), blk, [lx, 1.0, 0.05]);
    kit.add(leaf, kit.cyl(0.009, 0.009, 0.05, 10).rotateX(PI / 2), blk, [lx, 1.0, 0.07]);
    kit.add(leaf, kit.cyl(0.009, 0.009, 0.13, 10).rotateZ(PI / 2), blk, [lx - 0.06, 1.0, 0.094]);
    // pocket pantry shelving behind the door
    shelvingLater.push(() => shelving(rx + T, 10.75, 21.40, 12.40, 'z+', 6, 0.40));
    // white plinth + baseboard on the new wall faces
    bx(pw, wall, rx + T, 0, WZ, dx0 - cs - rx - T, 0.11, 0.014); bx(pw, wall, dx1 + cs, 0, WZ, 21.40 - dx1 - cs, 0.11, 0.014);
  }

  // ================================================================== ISLANDS
  const islands = kit.group(root, [0, 0, 0], 0, 'islands');
  // island(xA, xB = base faces; z0, z1 = waterfall ends; topOver = [−x overhang, +x overhang])
  function island(name, xa, xb, z0, z1, overNeg, overPos, cabsPos, cabsNeg, hole, cut) {
    const g = kit.group(islands, [0, 0, 0], 0, name);
    const T = 0.07, H = 0.93, tx0 = xa - overNeg, tx1 = xb + overPos;
    // quartz top (with an optional undermount sink cut-out) and full-height waterfall ends
    if (hole) {
      const [hx0, hz0, hx1, hz1] = hole;
      bx(g, quartz, tx0, H - T, z0, tx1 - tx0, T, hz0 - z0); bx(g, quartz, tx0, H - T, hz1, tx1 - tx0, T, z1 - hz1);
      bx(g, quartz, tx0, H - T, hz0, hx0 - tx0, T, hz1 - hz0); bx(g, quartz, hx1, H - T, hz0, tx1 - hx1, T, hz1 - hz0);
    } else bx(g, quartz, tx0, H - T, z0, tx1 - tx0, T, z1 - z0);
    bx(g, quartz, tx0, 0, z0, tx1 - tx0, H - T, T);
    bx(g, quartz, tx0, 0, z1 - T, tx1 - tx0, H - T, T);
    // oak base core
    bx(g, toeMat, xa + 0.06, 0, z0 + T, xb - xa - 0.12, 0.10, z1 - z0 - 2 * T);
    // core is solid except: under the sink basin (lowered so the white basin isn't swallowed by oak) and
    // behind the bar island's glass wine fridge (cut out so the lit case reads through the glass)
    {
      const cy0 = 0.10, cy1 = H - T, ix0 = xa + 0.02, ix1 = xb - 0.02, iz0 = z0 + T, iz1 = z1 - T;
      const zs = [iz0, iz1]; if (hole) zs.splice(1, 0, hole[1] - 0.04, hole[3] + 0.04); if (cut) zs.splice(zs.length - 1, 0, cut[0]);
      for (let i = 0; i < zs.length - 1; i++) {
        const za = zs[i], zb = zs[i + 1], mid = (za + zb) / 2;
        if (hole && mid > hole[1] && mid < hole[3]) { bx(g, oak, ix0, cy0, za, ix1 - ix0, 0.62 - cy0, zb - za); continue; }
        if (cut && mid > cut[0]) { bx(g, oak, ix0, cy0, za, cut[1] - ix0, cy1 - cy0, zb - za); continue; }
        bx(g, oak, ix0, cy0, za, ix1 - ix0, cy1 - cy0, zb - za);
      }
    }
    // fronts: +x face (local frame: x runs from z1 toward z0, z out of the face)
    const fp = kit.group(g, [xb, 0, z1 - T], PI / 2); cabsPos(fp, z1 - z0 - 2 * T);
    const fn = kit.group(g, [xa, 0, z0 + T], -PI / 2); cabsNeg(fn, z1 - z0 - 2 * T);
    return g;
  }
  const oakDrawerBank = (g, x0, w, slab = false) => drawers(g, x0, w, 0.10, [0.20, 0.27, 0.28], 0.02, oak, slab);
  const oakDoorPair = (g, x0, w) => { front(g, x0, 0.10, w / 2, 0.55, 0, oak); front(g, x0 + w / 2, 0.10, w / 2, 0.55, 0, oak); front(g, x0, 0.65, w, 0.23, 0, oak); pull(g, x0 + w / 2 - 0.04, 0.55, 0.022, 0.20, true); pull(g, x0 + w / 2 + 0.04, 0.55, 0.022, 0.20, true); pull(g, x0 + w / 2, 0.80, 0.022, 0.26); };
  // sink island
  const SI = { xa: 18.25, xb: 19.45, z0: 14.90, z1: 18.00 };
  island('sinkIsland', SI.xa, SI.xb, SI.z0, SI.z1, 0.03, 0.03, (g, L) => {
    // L = 3.9: drawers | sink doors | drawers | dishwasher panel | drawers
    const cols = [0.90, 0.90, 0.60, 0.60]; let x = 0;
    for (let i = 0; i < cols.length; i++) { const w = cols[i]; if (i === 1) oakDoorPair(g, x, w); else if (i === 2) { front(g, x, 0.10, w, 0.78, 0, oak); pull(g, x + w / 2, 0.80, 0.022, 0.30); } else oakDrawerBank(g, x, w); x += w; }
    if (x < L) front(g, x, 0.10, L - x, 0.78, 0, oak);
  }, (g, L) => { const n = 5, w = L / n; for (let i = 0; i < n; i++) front(g, i * w, 0.10, w, 0.78, 0, oak); }, [18.80, 16.20, 19.24, 17.00]);
  // undermount sink, faucets (main gooseneck + filter tap, and a prep faucet at the street end)
  {
    const sz = 16.60, sx = 19.02; // sink centre (r3: near the range-side edge) (sink face of island at +x so user faces −x)
    const sinkMat = std({ color: 0xf2f0ec, roughness: 0.25 });
    bx(islands, sinkMat, sx - 0.24, 0.66, sz - 0.42, 0.48, 0.02, 0.84);
    // dark recess where the basin is (top cut-out illusion) + basin walls
    bx(islands, sinkMat, sx - 0.24, 0.66, sz - 0.42, 0.01, 0.23, 0.84); bx(islands, sinkMat, sx + 0.23, 0.66, sz - 0.42, 0.01, 0.23, 0.84);
    bx(islands, sinkMat, sx - 0.24, 0.66, sz - 0.42, 0.48, 0.23, 0.01); bx(islands, sinkMat, sx - 0.24, 0.66, sz + 0.41, 0.48, 0.23, 0.01);
    kit.add(islands, kit.cyl(0.03, 0.03, 0.004, 16), steel, [sx, 0.682, sz + 0.2]);
    // faucet: gooseneck pull-down (r3: 0.77x, the r2 set read ~1.3x too big)
    const fx = sx - 0.31, FS = 0.77;
    const fz = sz;
    const F = (dx, y, dz = 0) => [fx + dx * FS, 0.93 + (y - 0.93) * FS, fz + dz];
    kit.add(islands, kit.cyl(0.024, 0.026, 0.026, 20), brass, [fx, 0.943, fz]);
    kit.add(islands, kit.tube([F(0, 0.93), F(0, 1.20), F(0.02, 1.36), F(0.12, 1.42), F(0.22, 1.36), F(0.24, 1.22)], 0.013, 48), brass);
    kit.add(islands, kit.cyl(0.016, 0.014, 0.10, 16), brass, F(0.24, 1.17));
    kit.add(islands, kit.tube([F(0, 1.08), F(0.07, 1.08)], 0.005, 4), brass);
    // filter tap
    kit.add(islands, kit.tube([F(0, 0.93, 0.26), F(0, 1.14, 0.26), F(0.05, 1.20, 0.26), F(0.12, 1.15, 0.26)], 0.0075, 24), brass);
    kit.add(islands, kit.cyl(0.017, 0.017, 0.08, 14), brass, [fx + 0.02, 0.97, fz - 0.30]); // soap / air switch
    // prep faucet near the street end of the island
    const pz = 15.40;
    // prep sink: white fireclay undermount look (basin face + soft grey inner rim + drain), not a black plate
    bx(islands, std({ color: 0xc9c6c0, roughness: 0.4 }), sx - 0.17, 0.9305, pz - 0.19, 0.34, 0.001, 0.38);
    bx(islands, std({ color: 0xf3f1ed, roughness: 0.22 }), sx - 0.15, 0.9312, pz - 0.17, 0.30, 0.001, 0.34);
    kit.add(islands, kit.cyl(0.022, 0.022, 0.002, 16), steel, [sx, 0.932, pz + 0.08]);
    kit.add(islands, kit.tube([F(0, 0.93, pz - fz), F(0, 1.18, pz - fz), F(0.03, 1.27, pz - fz), F(0.12, 1.30, pz - fz), F(0.18, 1.22, pz - fz)], 0.0095, 32), brass);
  }
  // bar island (stools on the −x / dining side)
  const BI = { xa: 16.25, xb: 17.17, z0: 15.25, z1: 18.45 };
  island('barIsland', BI.xa, BI.xb, BI.z0, BI.z1, 0.30, 0.03, (g, L) => {
    // +x face: glass-door undercounter wine fridge (oak frame, lit racks) at the +z end, then drawers and doors
    const wx = 0, ww = 0.64;
    wineCase(kit.group(g, [0, 0, -0.56], 0), wx, 0.10, ww, 0.78, 0.56, 4);
    pull(g, wx + ww - 0.06, 0.50, 0.0, 0.40, true, brass, 0.008);
    let x = wx + ww; const cols = [0.60, 0.80, 0.60]; for (let i = 0; i < cols.length; i++) { if (i % 2) oakDoorPair(g, x, cols[i]); else oakDrawerBank(g, x, cols[i]); x += cols[i]; }
    if (x < L) oakDrawerBank(g, x, L - x);
  }, (g, L) => { const n = 5, w = L / n; for (let i = 0; i < n; i++) front(g, i * w, 0.10, w, 0.78, 0, oak); }, null, [BI.z1 - 0.07 - 0.66, BI.xb - 0.58]);

  // teak slatted backless counter stools (p08)
  function stool(x, z) {
    const g = kit.group(islands, [x, 0, z], 0, 'stool');
    const H = 0.64, S = 0.40;
    for (let i = 0; i < 6; i++) bx(g, teak, -S / 2 + i * (S / 6) + 0.004, H - 0.025, -S / 2, S / 6 - 0.008, 0.025, S, 0.004);
    bx(g, teak, -S / 2, H - 0.07, -S / 2, S, 0.045, 0.03); bx(g, teak, -S / 2, H - 0.07, S / 2 - 0.03, S, 0.045, 0.03);
    bx(g, teak, -S / 2, H - 0.07, -S / 2, 0.03, 0.045, S); bx(g, teak, S / 2 - 0.03, H - 0.07, -S / 2, 0.03, 0.045, S);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = kit.rbox(0.038, H - 0.025, 0.038, 0.004, 1); const m = mesh(g, leg, teak, [sx * (S / 2 - 0.02 + 0.015), (H - 0.025) / 2, sz * (S / 2 - 0.02 + 0.015)]); m.rotation.set(sz * 0.035, 0, -sx * 0.035);
    }
    for (const [y, a] of [[0.20, 'x'], [0.24, 'z']]) for (const s of [-1, 1]) {
      if (a === 'x') bx(g, teak, -S / 2 - 0.01, y, s * (S / 2 - 0.005) - 0.012, S + 0.02, 0.025, 0.025);
      else bx(g, teak, s * (S / 2 - 0.005) - 0.012, y, -S / 2 - 0.01, 0.025, 0.025, S + 0.02);
    }
    return g;
  }
  const stools = [16.05, 16.90, 17.75].map(z => stool(15.68, z));

  // pendants over the sink island (p08, p09, p11), r3: ~30 cm clear blown-glass teardrop, thin and nearly
  // invisible except for its reflections, with a small frosted opal bulb inside; brass collar, cap and rod
  function pendant(x, z, yBottom) {
    const g = kit.group(root, [x, 0, z], 0, 'pendant');
    const prof = [[0.001, 0], [0.05, 0.006], [0.10, 0.032], [0.138, 0.08], [0.15, 0.13], [0.142, 0.185], [0.118, 0.245], [0.082, 0.305], [0.048, 0.348], [0.03, 0.372]];
    const shell = kit.lathe(prof, 48); const sm = kit.add(g, shell, globeGlass, [0, yBottom, 0]); sm.castShadow = false; sm.renderOrder = 2;
    // frosted inner bulb: opal capsule hanging in the upper-middle of the globe
    const inner = kit.lathe([[0.001, 0], [0.03, 0.006], [0.046, 0.035], [0.05, 0.10], [0.045, 0.15], [0.026, 0.175], [0.018, 0.19]], 24);
    kit.add(g, inner, opal, [0, yBottom + 0.12, 0]).castShadow = false;
    kit.add(g, kit.cyl(0.02, 0.02, 0.03, 16), brass, [0, yBottom + 0.325, 0]);
    kit.add(g, kit.cyl(0.036, 0.034, 0.055, 24), brass, [0, yBottom + 0.40, 0]);
    kit.add(g, kit.cyl(0.006, 0.006, CEIL - yBottom - 0.43, 8), brass, [0, (CEIL + yBottom + 0.43) / 2, 0]);
    kit.add(g, kit.cyl(0.05, 0.055, 0.025, 24), brass, [0, CEIL - 0.0125, 0]);
    return g;
  }
  pendant(18.85, 15.60, 1.90); pendant(18.85, 17.40, 1.90);

  // ================================================================== BREAKFAST NOOK
  const nook = kit.group(root, [0, 0, 0], 0, 'nook');
  // ---- Breakfast bay (WORKAROUND, see notes for lead). The photos (p09 glass door at right, p10 side
  // window, p11 pier) show the nook as a ~3.5 m bay between x≈17.85 and the NE wall, with the rear
  // facade continuing along z = 18.40 (glass slider to the pool terrace) for x < 17.85. Until the
  // shell's EXT outline is changed, build the bay side wall + slider here; the leftover pocket
  // (x 15.39–17.70, z 18.47–21.35) is paved like the covered terrace it really is.
  const BAYX = 17.85; // bay side wall inner face (nook side)
  // r2: slider line / bay-wall end moved from z 18.40 to 19.30 — p08 (pier right of the island end with the
  // nook visible between), p11 (wall end only at the far-left edge) and p10 (open floor before the nook)
  // all show ~1 m more room between the island ends and the bay wall than r1 had.
  // r3: 19.30 -> 19.69 so the bay wall's end is the thin pier at the left edge of p11, not a third of the frame
  const ZS = 19.69;
  {
    const bw = kit.group(root, [0, 0, 0], 0, 'bayWalls');
    const T = 0.15, wx0 = BAYX - T, z0 = ZS, z1 = 21.35, wz0 = 19.95, wz1 = 20.55, sill = 0.95, head = 2.55;
    const seg = (za, zb, ya, yb) => { bx(bw, wall, wx0, ya, za, T, yb - ya, zb - za); phys.boxAABB([wx0, ya, za], [BAYX, yb, zb]); };
    seg(z0, wz0, 0, CEIL); seg(wz1, z1, 0, CEIL); seg(wz0, wz1, 0, sill); seg(wz0, wz1, head, CEIL);
    // black steel casement in the side wall (2 lites)
    const fr = 0.045; const fm = M.blackMetal;
    const win = kit.group(bw, [wx0 + T / 2, sill, wz0], 0);
    bx(win, fm, -0.035, 0, 0, 0.07, fr, wz1 - wz0); bx(win, fm, -0.035, head - sill - fr, 0, 0.07, fr, wz1 - wz0);
    bx(win, fm, -0.035, 0, 0, 0.07, head - sill, fr); bx(win, fm, -0.035, 0, wz1 - wz0 - fr, 0.07, head - sill, fr);
    for (const k of [1, 2]) bx(win, fm, -0.03, (head - sill) * k / 3, 0, 0.06, fr * 0.6, wz1 - wz0);
    const gl = new THREE.PlaneGeometry(wz1 - wz0, head - sill); gl.rotateY(PI / 2); const gm = kit.add(win, gl, M.glass, [0, (head - sill) / 2, (wz1 - wz0) / 2]); gm.castShadow = false;
    // white sill + returns
    bx(bw, lacquer, wx0 - 0.01, sill - 0.03, wz0 - 0.02, T + 0.02, 0.03, wz1 - wz0 + 0.04);
    // glass slider along z = 18.40 from the dining corner to the bay wall (black frames)
    const sliderGlass = new THREE.MeshPhysicalMaterial({ color: 0xdde8e4, transparent: true, opacity: 0.16, roughness: 0.02, ior: 1.5, specularIntensity: 1, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide });
    const sx0 = 15.39, sx1 = wx0, sh = 2.75; const sg = kit.group(bw, [0, 0, ZS], 0, 'slider');
    bx(sg, M.matteBlack, sx0, 0, -0.06, sx1 - sx0, 0.015, 0.12); // threshold track
    try { const pl = kit.fitTo(await kit.loadModel('assets/ph/potted_plant_01/potted_plant_01_1k.gltf'), 1.25, 'y'); pl.position.set(17.3, 0.006, 20.95); bw.add(pl); /* corner by the bay wall: clear of the k-sw terrace door */ } catch (e) { console.warn('[kitchen] terrace plant', e.message); }
    bx(sg, wall, sx0, sh, -0.10, sx1 - sx0, CEIL - sh, 0.20);
    const n = 2, pw = (sx1 - sx0) / n;
    for (let i = 0; i < n; i++) {
      const x = sx0 + i * pw, zz = (i % 2) * 0.05 - 0.03;
      bx(sg, fm, x, 0, zz, pw, 0.06, 0.05); bx(sg, fm, x, sh - 0.06, zz, pw, 0.06, 0.05);
      bx(sg, fm, x, 0, zz, 0.06, sh, 0.05); bx(sg, fm, x + pw - 0.06, 0, zz, 0.06, sh, 0.05);
      const p = new THREE.PlaneGeometry(pw - 0.1, sh - 0.1); const pm = kit.add(sg, p, sliderGlass, [x + pw / 2, sh / 2, zz + 0.025]); pm.castShadow = false; pm.renderOrder = 1;
      bx(sg, fm, x + (i ? 0.08 : pw - 0.1), 0.95, zz + 0.05, 0.02, 0.30, 0.02);
    }
    phys.boxAABB([sx0, 0, ZS - 0.07], [sx1, sh, ZS + 0.07]);
    // terrace pavers in the pocket behind the slider
    const paver = kit.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, w, h); const r = kit.rng(77);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 205 + r() * 20; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(i * w / 2 + 3, j * h / 2 + 3, w / 2 - 6, h / 2 - 6);
        for (let k = 0; k < 400; k++) { const q = v + (r() - 0.5) * 30; g.fillStyle = `rgba(${q},${q - 5},${q - 14},0.5)`; g.fillRect(i * w / 2 + r() * w / 2, j * h / 2 + r() * h / 2, 2, 2); } }
    }, { repeat: [1 / 1.2, 1 / 1.2] });
    kit.floorFinish(bw, [15.39, ZS + 0.07, wx0, 21.35], std({ map: paver, roughness: 0.85 }), null, 0.006);
  }
  {
    // L banquette: along the rear wall (z 20.83–21.35) x BAYX–20.40, return along the bay side wall (z 19.85–20.83)
    const seatH = 0.46, dep = 0.52;
    const bench = (x0, z0, w, d, axis) => {
      const g = kit.group(nook, [0, 0, 0], 0, 'banquette');
      bx(g, lacquer, x0, 0, z0, w, 0.08, d); // plinth
      bx(g, lacquer, x0, 0.08, z0, w, seatH - 0.11, d);
      bx(g, lacquer, x0 - (axis === 'x' ? 0 : 0), seatH - 0.03, z0 - (axis === 'x' ? 0.02 : 0), w + (axis === 'z' ? 0.02 : 0), 0.035, d + 0.02, 0.006);
      // drawer fronts with brass bar pulls
      if (axis === 'x') { const n = Math.max(1, Math.round(w / 0.75)), dw = w / n; const fg = kit.group(g, [x0, 0, z0], 0); for (let i = 0; i < n; i++) { front(fg, i * dw, 0.10, dw, 0.32, -0.002, lacquer); pull(fg, i * dw + dw / 2, 0.36, 0.02, 0.22); } }
      else { const n = Math.max(1, Math.round(d / 0.75)), dw = d / n; const fg = kit.group(g, [x0 + w, 0, z0 + d], PI / 2); for (let i = 0; i < n; i++) { front(fg, i * dw, 0.10, dw, 0.32, -0.002, lacquer); pull(fg, i * dw + dw / 2, 0.36, 0.02, 0.22); } }
      return g;
    };
    const BX0 = BAYX, BX1 = 20.40; // v13/v04: the rear bench runs past the narrow window to x ≈ 20.4
    const b1 = bench(BX0, 21.35 - dep, BX1 - BX0, dep, 'x');
    // the rear bench's front faces −z, so build its fronts on a rotated frame instead
    b1.children.filter(c => c.isGroup).forEach(c => b1.remove(c));
    { const n = 3, w = (BX1 - BX0) / n; const fg = kit.group(b1, [BX1, 0, 21.35 - dep], PI); for (let i = 0; i < n; i++) { front(fg, i * w, 0.10, w, 0.32, -0.002, lacquer); pull(fg, i * w + w / 2, 0.36, 0.02, 0.22); } }
    // painted back ledge under the windows
    bx(nook, lacquer, BX0, seatH, 21.30, BX1 - BX0, 0.95 - seatH, 0.05);
    phys.boxAABB([BX0, 0, 21.35 - dep], [BX1, seatH, 21.35]);
    // return along the bay side wall
    { const g = kit.group(nook, [0, 0, 0], 0, 'banquetteReturn'); const z0 = 19.85, z1 = 21.35 - dep;
      bx(g, lacquer, BAYX, 0, z0, dep, seatH - 0.03, z1 - z0); bx(g, lacquer, BAYX, seatH - 0.03, z0 - 0.02, dep + 0.02, 0.035, z1 - z0 + 0.02, 0.006);
      const fg = kit.group(g, [BAYX + dep, 0, z1], PI / 2); front(fg, 0, 0.10, z1 - z0, 0.32, -0.002, lacquer); pull(fg, (z1 - z0) / 2, 0.36, 0.02, 0.22);
      bx(g, lacquer, BAYX, seatH, z0, 0.05, 0.95 - seatH, z1 - z0 + dep);
      phys.boxAABB([BAYX, 0, z0], [BAYX + dep, seatH, z1]); }

    // whitewashed trestle table (p10)
    const tx = 19.0, tz = 20.12, L = 1.80, W = 0.90, TH = 0.76;
    const tg = kit.group(nook, [tx, 0, tz], 0, 'table');
    // plank top (4 planks with gaps)
    for (let i = 0; i < 4; i++) bx(tg, whitewash, -L / 2, TH - 0.045, -W / 2 + i * (W / 4) + 0.002, L, 0.045, W / 4 - 0.004, 0.006);
    bx(tg, whitewash, -L / 2 + 0.12, TH - 0.10, -W / 2 + 0.06, 0.07, 0.055, W - 0.12); bx(tg, whitewash, L / 2 - 0.19, TH - 0.10, -W / 2 + 0.06, 0.07, 0.055, W - 0.12);
    // r3: X-trestle ends (two crossed legs + foot + top cleat) and a low stretcher (p10)
    for (const s of [-1, 1]) {
      const lx = s * (L / 2 - 0.28), legL = Math.hypot(0.56, TH - 0.17);
      for (const k of [-1, 1]) { const leg = kit.rbox(0.065, legL, 0.06, 0.008, 1); const m = mesh(tg, leg, whitewash, [lx, (TH - 0.10) / 2 + 0.02, 0]); m.rotation.x = k * Math.atan2(0.56, TH - 0.17); }
      bx(tg, whitewash, lx - 0.04, 0, -0.36, 0.08, 0.07, 0.72, 0.01);
      bx(tg, whitewash, lx - 0.04, TH - 0.12, -0.36, 0.08, 0.07, 0.72, 0.008);
    }
    bx(tg, whitewash, -L / 2 + 0.28, 0.30, -0.035, L - 0.56, 0.07, 0.07, 0.006);
    phys.solidGroup(tg);

    // teak + woven rope armchairs (p10), facing the banquette (+z)
    function chair(x, z, ry) {
      const g = kit.group(nook, [x, 0, z], ry, 'chair');
      const SH = 0.44, SW = 0.50, SD = 0.46;
      for (const sx of [-1, 1]) {
        kit.add(g, kit.tube([[sx * 0.23, 0, 0.20], [sx * 0.235, SH, 0.20]], 0.017, 6), chairWood);
        kit.add(g, kit.tube([[sx * 0.22, 0, -0.22], [sx * 0.225, SH, -0.20], [sx * 0.23, 0.70, -0.24]], 0.018, 12), chairWood);
      }
      // seat rails + woven seat
      bx(g, chairWood, -SW / 2, SH - 0.05, SD / 2 - 0.035, SW, 0.05, 0.035); bx(g, chairWood, -SW / 2, SH - 0.05, -SD / 2, SW, 0.05, 0.035);
      bx(g, chairWood, -SW / 2, SH - 0.05, -SD / 2, 0.035, 0.05, SD); bx(g, chairWood, SW / 2 - 0.035, SH - 0.05, -SD / 2, 0.035, 0.05, SD);
      const seat = new THREE.PlaneGeometry(SW - 0.06, SD - 0.06); seat.rotateX(-PI / 2); kit.add(g, seat, rope, [0, SH - 0.025, 0]);
      // curved top rail that runs into the arms
      const rail = []; for (let i = 0; i <= 16; i++) { const a = PI * (i / 16); rail.push([Math.cos(a) * 0.26, 0.70 - Math.sin(a) * 0.0 - (Math.abs(Math.cos(a)) > 0.9 ? 0.04 : 0), -0.02 - Math.sin(a) * 0.24]); }
      kit.add(g, kit.tube(rail, 0.02, 48), chairWood);
      for (const sx of [-1, 1]) kit.add(g, kit.tube([[sx * 0.26, 0.66, -0.02], [sx * 0.25, 0.62, 0.12], [sx * 0.235, SH, 0.20]], 0.014, 12), chairWood);
      // woven back panel (cylinder segment)
      const back = new THREE.CylinderGeometry(0.235, 0.235, 0.20, 24, 1, true, PI * 0.62, PI * 0.76); back.rotateY(PI / 2);
      const bm = kit.add(g, back, rope, [0, 0.58, -0.02]); bm.castShadow = false;
      phys.solidGroup(g); return g;
    }
    chair(19.78, 19.45, 0.06); chair(20.30, 20.10, -PI / 2 + 0.05); // near side + head of the table, both clear of the p11 frame

    // white coral "sputnik" chandelier (p09, p10)
    {
      const SY = 1.92; const cg = kit.group(nook, [tx + 0.40, SY, tz], 0, 'coralChandelier'); // v13: hangs ~0.4 m further +x than the table centre
      const parts = []; const rr = kit.rng(31); const N = 52;
      for (let i = 0; i < N; i++) {
        const yy = 1 - 2 * (i + 0.5) / N, rad = Math.sqrt(1 - yy * yy), th = i * 2.399963;
        const dir = new THREE.Vector3(Math.cos(th) * rad, yy * 0.85, Math.sin(th) * rad).normalize();
        const len = 0.22 + rr() * 0.12;
        const add = (o, d, l, r0) => {
          const c = new THREE.CylinderGeometry(r0 * 0.45, r0, l, 6); c.translate(0, l / 2, 0);
          c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); c.translate(o.x, o.y, o.z); parts.push(c);
          const tip = new THREE.SphereGeometry(r0 * 0.6, 6, 4); tip.translate(o.x + d.x * l, o.y + d.y * l, o.z + d.z * l); parts.push(tip);
        };
        add(new THREE.Vector3(), dir, len, 0.013);
        for (let b = 0; b < 2; b++) {
          const o = dir.clone().multiplyScalar(len * (0.45 + rr() * 0.3));
          const d2 = dir.clone().add(new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(1.4)).normalize();
          add(o, d2, len * (0.3 + rr() * 0.25), 0.009);
        }
      }
      const coral = kit.mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
      coral.computeVertexNormals(); kit.add(cg, coral, coralMat);
      // brass core: ball hub with a collar, short brass rod to a canopy (p10)
      kit.add(cg, kit.sphere(0.065, 24, 16), brass, [0, 0, 0]);
      kit.add(cg, kit.cyl(0.03, 0.045, 0.06, 20), brass, [0, 0.08, 0]);
      kit.add(cg, kit.cyl(0.008, 0.008, CEIL - SY - 0.1, 8), brass, [0, 0.1 + (CEIL - SY - 0.1) / 2, 0]);
      kit.add(cg, kit.cyl(0.06, 0.065, 0.03, 24), brass, [0, CEIL - SY - 0.015, 0]);
    }

    // black roller-shade cassettes over the nook windows (p10)
    const cassette = (x0, z0, w, d) => bx(nook, M.matteBlack, x0, 2.55, z0, w, 0.12, d, 0.004);
    cassette(18.16, 21.20, 1.78, 0.15); cassette(20.07, 21.20, 0.66, 0.15); cassette(BAYX, 19.91, 0.15, 0.68);
  }

  // ================================================================== DECOR
  const decor = kit.group(root, [0, 0, 0], 0, 'decor');
  const dyn = [];
  // open shelves (range-wall local → world: x = 21.40 − localZ, z = localX)
  const W = (lx, y, lz) => [21.40 - lz, y, lx];
  {
    // books on the middle shelf
    const bookCols = [0x2f5f73, 0xd9d2c3, 0x7a8f86, 0xb9a27c, 0x324a3c, 0xe8e3d8];
    const books = kit.group(decor, W(19.85, 1.72, 0.16), -PI / 2, 'books');
    let x = 0; for (let i = 0; i < 6; i++) { const h = 0.03 + (i % 3) * 0.008, w = 0.24 - i * 0.01; bx(books, std({ color: bookCols[i], roughness: 0.8 }), -w / 2, x, -0.08, w, h, 0.17, 0.003); x += h; }
    dyn.push(books);
    const books2 = kit.group(decor, W(20.25, 1.72, 0.16), -PI / 2, 'books2');
    x = 0; for (let i = 0; i < 4; i++) { const h = 0.028 + (i % 2) * 0.01, w = 0.22 - i * 0.012; bx(books2, std({ color: bookCols[(i + 2) % 6], roughness: 0.8 }), -w / 2, x, -0.08, w, h, 0.16, 0.003); x += h; }
    dyn.push(books2);
    // books on the lowest shelf + brass geometric terrarium
    const books3 = kit.group(decor, W(19.87, 1.30, 0.15), -PI / 2, 'books3'); x = 0;
    for (let i = 0; i < 3; i++) { const h = 0.035, w = 0.22 - i * 0.015; bx(books3, std({ color: bookCols[(i + 4) % 6], roughness: 0.8 }), -w / 2, x, -0.08, w, h, 0.16, 0.003); x += h; }
    const terr = kit.group(decor, W(20.25, 1.30, 0.15), 0, 'terrarium');
    const tg = new THREE.IcosahedronGeometry(0.075, 0); const edges = new THREE.EdgesGeometry(tg);
    const pos = edges.attributes.position; const bars = [];
    for (let i = 0; i < pos.count; i += 2) { const a = new THREE.Vector3().fromBufferAttribute(pos, i), b = new THREE.Vector3().fromBufferAttribute(pos, i + 1); const L = a.distanceTo(b); const c = new THREE.CylinderGeometry(0.0025, 0.0025, L, 4); c.translate(0, L / 2, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); c.translate(a.x, a.y, a.z); bars.push(c); }
    kit.add(terr, kit.mergeGeometries(bars), brass, [0, 0.075, 0]);
    kit.add(terr, new THREE.IcosahedronGeometry(0.073, 0), glassClear, [0, 0.075, 0]).castShadow = false;
    dyn.push(terr);
    // coral on the top shelf
    const cor = kit.group(decor, W(19.95, 2.14, 0.15), 0, 'shelfCoral');
    { const parts = []; const rr = kit.rng(5); for (let i = 0; i < 26; i++) { const a = (rr() - 0.5) * 2.4, l = 0.06 + rr() * 0.08; const c = new THREE.CylinderGeometry(0.004, 0.009, l, 5); c.translate(0, l / 2, 0); c.rotateZ(a * 0.8); c.rotateY(rr() * PI); c.translate((rr() - 0.5) * 0.16, 0, (rr() - 0.5) * 0.06); parts.push(c); } kit.add(cor, kit.mergeGeometries(parts), coralMat); }
    dyn.push(cor);
    // r3: upright book rows so the shelves read full (p08, p10)
    const spineCols = [0x2f5f73, 0xd9d2c3, 0x7a8f86, 0xb9a27c, 0x324a3c, 0xe8e3d8, 0x8c6f56, 0xc9c1b0, 0x5d6e78, 0xa8b3a0];
    const bookRow = (lx0, lx1, top, seed) => {
      const r = kit.rng(seed); const g = kit.group(decor, W(lx0, top, 0.02), -PI / 2, 'bookRow'); let x = 0, i = 0;
      while (x < lx1 - lx0 - 0.02) { const t = 0.018 + r() * 0.022, h = 0.17 + r() * 0.08, d = 0.14 + r() * 0.06; const lean = x + t > lx1 - lx0 - 0.05 && i > 3 ? -0.18 : 0;
        const m = bx(g, std({ color: spineCols[Math.floor(r() * spineCols.length)], roughness: 0.75 }), x, 0, 0.02, t, h, d, 0.002); if (lean) m.rotation.z = lean; x += t + 0.002; i++; }
      return g;
    };
    bookRow(20.22, 20.50, 2.135, 11); bookRow(19.68, 19.80, 1.715, 12); bookRow(20.40, 20.52, 1.295, 13);
    // small white ceramic vase + brass candlestick on the top shelf
    { const v = kit.group(decor, W(19.72, 2.135, 0.16), 0, 'shelfVase'); kit.add(v, kit.lathe([[0.001, 0], [0.04, 0], [0.055, 0.06], [0.045, 0.13], [0.022, 0.17], [0.026, 0.19], [0.001, 0.19]], 24), std({ color: 0xf1eee8, roughness: 0.35 })); dyn.push(v); }
    // orchid in a small celadon pot on the desk counter
    const orch = kit.group(decor, W(20.32, 0.76, 0.30), 0, 'orchid');
    kit.add(orch, kit.lathe([[0.001, 0], [0.05, 0], [0.06, 0.03], [0.06, 0.11], [0.055, 0.12], [0.001, 0.12]], 24), std({ color: 0x9fb8a3, roughness: 0.35 }));
    for (let i = 0; i < 4; i++) { const lf = kit.rbox(0.18, 0.004, 0.05, 0.002, 1); const m = kit.add(orch, lf, std({ color: 0x3d6b35, roughness: 0.6 }), [Math.cos(i * 1.6) * 0.07, 0.13, Math.sin(i * 1.6) * 0.07], [0, -i * 1.6, 0.25]); }
    kit.add(orch, kit.tube([[0, 0.12, 0], [0.01, 0.30, 0.0], [0.03, 0.40, 0.02], [0.07, 0.44, 0.03]], 0.003, 16), std({ color: 0x4f6b3a }));
    for (let i = 0; i < 6; i++) kit.add(orch, kit.sphere(0.022, 10, 6), std({ color: 0xfbfaf6, roughness: 0.6 }), [0.02 + i * 0.012, 0.36 + (i % 2) * 0.03 + i * 0.01, 0.015 + (i % 3) * 0.01], [0, 0, 0]).scale.set(1, 0.5, 1);
    dyn.push(orch);
    // apothecary jar on the counter left of the coffee column
    const jar = kit.group(decor, W(18.62, CT, 0.28), 0, 'apothecary');
    kit.add(jar, kit.lathe([[0.001, 0], [0.05, 0], [0.04, 0.03], [0.07, 0.10], [0.075, 0.20], [0.05, 0.25], [0.06, 0.27], [0.012, 0.29], [0.02, 0.32], [0.001, 0.33]], 28), glassClear).castShadow = false;
    for (let i = 0; i < 12; i++) kit.add(jar, kit.sphere(0.02, 8, 6), std({ color: [0xe8dcc8, 0xc8a27a, 0xf2ece2][i % 3], roughness: 0.7 }), [Math.cos(i) * 0.035, 0.08 + (i % 4) * 0.02, Math.sin(i * 1.7) * 0.035]);
    dyn.push(jar);
    // open cookbook on the sink island (p09, p11)
    const book = kit.group(decor, [19.08, 0.93, 15.95], 0.2, 'cookbook');
    for (const s of [-1, 1]) { const p = kit.rbox(0.20, 0.016, 0.27, 0.003, 1); kit.add(book, p, std({ color: 0xf5f2ea, roughness: 0.9 }), [s * 0.101, 0.01 + 0.004, 0], [0, 0, -s * 0.05]); }
    bx(book, std({ color: 0x5a6b70, roughness: 0.8 }), -0.21, 0, -0.14, 0.42, 0.006, 0.28);
    dyn.push(book);
    // wooden bowl with an aloe on the nook table (Poly Haven wooden_bowl_01)
    try {
      const bowlM = await kit.loadModel('assets/ph/wooden_bowl_01/wooden_bowl_01_1k.gltf');
      const bowl = kit.fitTo(bowlM, 0.34, 'x'); bowl.position.set(18.95, 0.76, 20.12); decor.add(bowl);
      const aloe = kit.group(bowl, [0, 0.05, 0], 0);
      const lm = std({ color: 0x6b8a5a, roughness: 0.6 }); for (let i = 0; i < 12; i++) { const c = new THREE.ConeGeometry(0.012, 0.14, 5); c.translate(0, 0.07, 0); kit.add(aloe, c, lm, [0, 0, 0], [Math.cos(i * 2.4) * 0.5, 0, Math.sin(i * 2.4) * 0.5]); }
      dyn.push(bowl);
    } catch (e) { console.warn('[kitchen] bowl', e); }
    // (r2: the white vase with sticks on the sink island is not in the photos; removed)
    // round tray with canisters next to the range
    const can = kit.group(decor, W(14.75, CT, 0.25), 0, 'crock');
    kit.add(can, kit.lathe([[0.001, 0], [0.065, 0], [0.07, 0.02], [0.07, 0.16], [0.065, 0.17], [0.001, 0.17]], 24), std({ color: 0xf1ede6, roughness: 0.4 }));
    for (let i = 0; i < 5; i++) kit.add(can, kit.cyl(0.006, 0.008, 0.28, 6), chairWood, [Math.cos(i * 1.3) * 0.025, 0.2, Math.sin(i * 1.3) * 0.025], [Math.cos(i) * 0.12, 0, Math.sin(i) * 0.12]);
  }

  // ================================================================== CEILING: cans, speakers, slot diffusers
  {
    const pts = [];
    for (const z of [11.9, 13.4, 14.9, 16.4, 17.9]) for (const x of [16.0, 17.6, 19.9]) pts.push([x, z]);
    pts.push([16.3, 19.3], [18.6, 19.3], [20.4, 19.6], [19.9, 21.0], [16.2, 21.0]);
    // r3: own cans: brushed-nickel trim ring, dark baffle, small blooming lamp (r2 white-on-white cans vanished)
    {
      const trim = std({ color: 0x8a8884, roughness: 0.35, metalness: 0.6 }), baffle = std({ color: 0x2a2928, roughness: 0.7 });
      const lamp = std({ color: 0xffffff, emissive: 0xfff1dc, emissiveIntensity: 7 });
      const ringG = new THREE.RingGeometry(0.052, 0.072, 32).rotateX(PI / 2), bafG = new THREE.CircleGeometry(0.052, 32).rotateX(PI / 2), lampG = new THREE.CircleGeometry(0.022, 20).rotateX(PI / 2);
      for (const [x, z] of pts) { kit.add(root, ringG, trim, [x, CY - 0.002, z]).castShadow = false; kit.add(root, bafG, baffle, [x, CY - 0.001, z]).castShadow = false; kit.add(root, lampG, lamp, [x, CY - 0.003, z]).castShadow = false; }
    }
    const spk = std({ color: 0xeeedea, roughness: 0.8 });
    for (const [x, z] of [[18.85, 12.6], [17.4, 18.9]]) { const d = new THREE.CircleGeometry(0.12, 32); d.rotateX(PI / 2); kit.add(root, d, spk, [x, CY - 0.001, z]); const r = new THREE.RingGeometry(0.12, 0.13, 32); r.rotateX(PI / 2); kit.add(root, r, std({ color: 0xcfcdc8 }), [x, CY - 0.0015, z]); }
    for (const [x, z, L, along] of [[17.9, 12.0, 1.4, 'x'], [16.1, 16.2, 1.6, 'z'], [20.15, 17.6, 1.3, 'z'], [20.1, 13.4, 1.5, 'z'], [18.9, 18.75, 1.1, 'x']]) {
      const g = along === 'x' ? new THREE.BoxGeometry(L, 0.004, 0.03) : new THREE.BoxGeometry(0.03, 0.004, L); kit.add(root, g, M.matteBlack, [x, CY - 0.001, z]).castShadow = false;
    }
  }
  // baseboards in the nook / visible wall runs (skipping the open side to dining and door gaps)
  kit.baseboards(root, [15.39, 10.75, 21.40, 21.35], 0, 0.11, 0.014, M.paintWhite, [
    { side: 'x0', from: 12.40, to: 13.40 }, { side: 'x0', from: 13.55, to: 18.45 },
    { side: 'z0', from: 15.50, to: 16.50 }, { side: 'z0', from: 17.45, to: 18.45 },
    { side: 'x1', from: 11.55, to: 12.45 },
  ]);

  // ================================================================== PANTRIES / STORAGE (simple white shelving)
  function shelving(x0, z0, x1, z1, faceDir, n = 5, depth = 0.38) {
    const g = kit.group(root, [0, 0, 0], 0, 'shelving');
    const along = faceDir[0] === 'z' ? 'x' : 'z';
    const L = along === 'x' ? x1 - x0 : z1 - z0;
    const box = (y, t) => {
      if (faceDir === 'z+') bx(g, lacquer, x0, y, z0, L, t, depth); else if (faceDir === 'z-') bx(g, lacquer, x0, y, z1 - depth, L, t, depth);
      else if (faceDir === 'x+') bx(g, lacquer, x0, y, z0, depth, t, L); else bx(g, lacquer, x1 - depth, y, z0, depth, t, L);
    };
    for (let i = 0; i < n; i++) box(0.10 + i * 0.42, i === 0 ? 0.04 : 0.025);
    // jars / boxes
    const cm = [std({ color: 0xf2efe8, roughness: 0.5 }), std({ color: 0xc8a77d, roughness: 0.8 }), glassClear, std({ color: 0x8a9a8a, roughness: 0.6 })];
    const rr = kit.rng(Math.floor(x0 * 100));
    for (let i = 1; i < n; i++) for (let k = 0; k < Math.floor(L / 0.22); k++) {
      if (rr() < 0.35) continue; const s = 0.07 + rr() * 0.05, h = 0.10 + rr() * 0.15; const t = 0.10 + i * 0.42 + 0.025;
      const u = (along === 'x' ? x0 : z0) + 0.12 + k * 0.22; const dd = depth / 2;
      const p = faceDir === 'z+' ? [u, t + h / 2, z0 + dd] : faceDir === 'z-' ? [u, t + h / 2, z1 - dd] : faceDir === 'x+' ? [x0 + dd, t + h / 2, u] : [x1 - dd, t + h / 2, u];
      const m = kit.add(g, rr() < 0.5 ? kit.cyl(s / 2, s / 2, h, 16) : kit.rbox(s, h, s, 0.01, 1), cm[Math.floor(rr() * cm.length)], p); m.castShadow = false;
    }
    phys.solidGroup(g); return g;
  }
  // pantry (x 11.27–15.24, z 10.75–12.20): shelves on the street wall and both ends
  shelving(11.27, 10.75, 15.24, 12.20, 'z+');
  shelving(11.27, 11.15, 12.20, 12.20, 'x+');
  // storage (x 13.65–15.24, z 12.35–13.45)
  shelving(13.65, 12.35, 15.24, 13.45, 'z+', 6, 0.35);
  // kitchen pantry (x 21.55–22.80, z 10.75–14.06): shelves on the far wall and the street wall
  shelving(21.55, 10.75, 22.80, 14.06, 'x-', 6, 0.40);
  shelving(21.55, 10.75, 22.40, 14.06, 'z+', 6, 0.40);
  for (const f of shelvingLater) f();

  // ================================================================== SUN PATCHES + CONTACT SHADOWS (r3)
  // The listing photos are lit by a warm low sun (~4500 K) streaming in from the canyon/dining side: hard
  // window-shaped patches on the floor (p08 stools, p09 aisle, p10 coffee column, p11 lower left), on the
  // island face and the coffee-column drawers, and dappled light on the nook ceiling. The global sun does
  // not reach these floors, so the patches are projected here geometrically (each window pane swept along
  // one fixed sun ray) and painted into additive decals; the furniture's shadows are cut out of them along
  // the same ray, and soft contact-AO decals sit under cabinets, islands, stools, table and chairs.
  {
    const sunG = kit.group(root, [0, 0, 0], 0, 'sunPatches'); sunG.userData.keep = true; sunG.visible = false;
    ctx.onUpdate(() => { if (!sunG.visible && (window.__probes || ctx.params?.get?.('noprobes'))) sunG.visible = true; });
    const TX = 0.62, TZ = -0.78, K = 0.70;               // sun travel (horizontal unit) + rise per metre
    const X0 = 15.39, X1 = 21.40, Z0 = 10.75, Z1 = 21.35, S = 120; // floor canvas: metres -> px
    const cw = Math.round((X1 - X0) * S), ch = Math.round((Z1 - Z0) * S);
    const fp = (x, z) => [(x - X0) * S, (z - Z0) * S];
    const off = (h) => [TX * h / K, TZ * h / K];
    // light sources: panes as [kind, plane, a0, a1, y0, y1] (kind 'z': plane z, a = x; kind 'x': plane x, a = z)
    const panes = [];
    const grid = (kind, plane, a0, a1, y0, y1, cols, rows, bar = 0.045) => {
      const cwid = (a1 - a0) / cols, rh = (y1 - y0) / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) panes.push([kind, plane, a0 + i * cwid + bar / 2, a0 + (i + 1) * cwid - bar / 2, y0 + j * rh + bar / 2, y0 + (j + 1) * rh - bar / 2]);
    };
    grid('z', 18.40, 13.58, 15.33, 0.06, 2.84, 1, 1, 0.12);   // last dining slider panel (p08 stools)
    grid('z', ZS, 15.45, 17.65, 0.06, 2.69, 4, 2, 0.09);       // our rear slider + its frames (p11 lower-left stripes)
    grid('z', 21.35, 18.215, 19.885, 0.95, 2.55, 2, 2);          // nook rear window (p09 aisle, p10 floor)
    grid('z', 21.35, 20.13, 20.68, 0.95, 2.55, 1, 3);
    grid('x', BAYX, 19.95, 20.55, 0.95, 2.55, 1, 3);           // bay side window
    const panePts = (p) => { const [kind, pl, a0, a1, y0, y1] = p; return [[a0, y0], [a1, y0], [a1, y1], [a0, y1]].map(([a, y]) => kind === 'z' ? [a, pl, y] : [pl, a, y]); };
    const poly = (g, pts) => { g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(u, v) : g.moveTo(u, v)); g.closePath(); g.fill(); };
    const hull = (pts) => { const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
      for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1)); };
    // occluders: boxes [x0, z0, x1, z1, yTop] cast a swept shadow; thin "slabs" (table/stool seats) only their top
    const boxes = [[BI.xa, BI.z0, BI.xb, BI.z1, 0.93], [BI.xa - 0.30, BI.z0, BI.xb, BI.z1, 0.93], [SI.xa - 0.03, SI.z0, SI.xb + 0.03, SI.z1, 0.93]];
    const shadowOfBox = (g, [x0, z0, x1, z1, y]) => { const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; const o = off(y); poly(g, hull([...c, ...c.map(([x, z]) => [x + o[0], z + o[1]])]).map(([x, z]) => fp(x, z))); };
    const legLine = (g, x, z, h, w) => { const o = off(h); g.lineWidth = w * S; g.beginPath(); g.moveTo(...fp(x, z)); g.lineTo(...fp(x + o[0], z + o[1])); g.stroke(); };
    const slab = (g, x0, z0, x1, z1, y) => { const o = off(y); poly(g, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => fp(x + o[0], z + o[1]))); };
    const stoolPts = stools.map(st => [st.position.x, st.position.z]);
    const chairPts = [[19.78, 19.45], [20.30, 20.10]];
    const floorTex = kit.canvasTex(cw, ch, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = '#fff';
      g.filter = 'blur(2px)';
      for (const p of panes) { const pts = panePts(p).map(([x, z, y]) => [x + off(y)[0], z + off(y)[1]]); poly(g, pts.map(([x, z]) => fp(x, z))); }
      // cut the furniture shadows out of the light (hard, slightly soft at the far end)
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round';
      for (const b of boxes) shadowOfBox(g, b);
      for (const [x, z] of stoolPts) { slab(g, x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.64); for (const sx of [-1, 1]) for (const sz of [-1, 1]) legLine(g, x + sx * 0.19, z + sz * 0.19, 0.62, 0.035); for (const y of [0.21, 0.25]) slab(g, x - 0.21, z - 0.012, x + 0.21, z + 0.012, y); }
      { const tx = 19.0, tz = 20.12; slab(g, tx - 0.9, tz - 0.45, tx + 0.9, tz + 0.45, 0.76); for (const s of [-1, 1]) for (const k of [-1, 1]) legLine(g, tx + s * 0.62, tz + k * 0.3, 0.7, 0.06); }
      for (const [x, z] of chairPts) { slab(g, x - 0.25, z - 0.23, x + 0.25, z + 0.23, 0.44); for (const sx of [-1, 1]) { legLine(g, x + sx * 0.23, z + 0.2, 0.44, 0.03); legLine(g, x + sx * 0.22, z - 0.22, 0.70, 0.03); } }
      g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    }, {});
    floorTex.wrapS = floorTex.wrapT = THREE.ClampToEdgeWrapping;
    const sunCol = new THREE.Color(1.0, 0.83, 0.62);
    const sunMat = (tex, k) => new THREE.MeshBasicMaterial({ map: tex, color: sunCol.clone().multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const decal = (tex, mat, w, h, pos, rot, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); m.rotation.set(...rot); m.renderOrder = order; m.castShadow = false; m.receiveShadow = false; sunG.add(m); return m; };
    decal(floorTex, sunMat(floorTex, 1.15), X1 - X0, Z1 - Z0, [(X0 + X1) / 2, 0.012, (Z0 + Z1) / 2], [-PI / 2, 0, 0], 3);
    // vertical faces hit by the same rays: coffee column / desk / pantry fronts (p10) and the bar island's stool face (p08)
    const wallDecal = (Xp, za, zb, ya, yb, k, srcFilter, clip) => {
      const W2 = zb - za, H2 = yb - ya, SS = 160;
      const tex = kit.canvasTex(Math.round(W2 * SS), Math.round(H2 * SS), (g, w, h) => {
        g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.filter = 'blur(2px)';
        for (const p of panes.filter(srcFilter)) {
          const pts = panePts(p).map(([x, z, y]) => { const sd = (Xp - x) / TX; return [z + TZ * sd, y - K * sd]; });
          if (pts.every(([, y]) => y < ya)) continue;
          poly(g, pts.map(([z, y]) => [(z - za) * SS, (yb - y) * SS]));
        }
        g.filter = 'none'; if (clip) clip(g, SS, za, yb);
      }, {});
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return decal(tex, sunMat(tex, k), W2, H2, [Xp, (ya + yb) / 2, (za + zb) / 2], [0, -PI / 2, 0], 3);
    };
    const nookSrc = p => p[1] === 21.35;
    wallDecal(21.40 - D - 0.003, 18.0, 19.65, 0.10, 2.4, 0.8, nookSrc);        // coffee column drawers
    wallDecal(21.40 - 0.56 - 0.003, 19.65, 20.55, 0.10, 0.73, 0.8, nookSrc);  // desk drawers
    wallDecal(21.40 - D - 0.003, 20.55, 21.33, 0.10, 2.8, 0.8, nookSrc);      // tall pantry door
    wallDecal(BI.xa - 0.026, BI.z0 + 0.07, BI.z1 - 0.07, 0.10, 0.86, 0.85, p => p[1] === 18.40, (g, SS, za, yb) => {
      // the 30 cm overhang shades everything above ~0.55 m; the stools cut their silhouettes in
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(0, 0, g.canvas.width, (yb - 0.55) * SS);
      for (const [x, z] of stoolPts) { const sd = (BI.xa - 0.026 - x) / TX; const zc = z + TZ * sd; for (const dz of [-0.19, 0.19]) g.fillRect((zc + dz - 0.02 - za) * SS, 0, 0.04 * SS, g.canvas.height); g.fillRect((zc - 0.2 - za) * SS, (yb - (0.64 - K * sd)) * SS, 0.4 * SS, 0.05 * SS); }
      g.globalCompositeOperation = 'source-over';
    });
    // dappled light on the nook ceiling (p10): soft leafy blobs, faint
    {
      const r = kit.rng(4501);
      const dap = kit.canvasTex(512, 512, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.filter = 'blur(6px)';
        for (let i = 0; i < 260; i++) { const x = w * (0.1 + 0.8 * r()), y = h * (0.1 + 0.8 * r()); const rad = 6 + r() * 22; g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`; g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * PI, 0, PI * 2); g.fill(); }
        g.filter = 'none'; g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.5); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
      }, {});
      decal(dap, sunMat(dap, 0.32), 2.4, 2.0, [19.3, CY - 0.004, 20.0], [PI / 2, 0, 0], 3);
    }
    // contact AO: soft dark pools where things meet the floor
    const ao = kit.canvasTex(cw, ch, (g, w, h) => {
      g.clearRect(0, 0, w, h); const rect = (x0, z0, x1, z1, a, blur) => { g.filter = `blur(${blur}px)`; g.fillStyle = `rgba(0,0,0,${a})`; const [u0, v0] = fp(x0, z0), [u1, v1] = fp(x1, z1); g.fillRect(u0, v0, u1 - u0, v1 - v0); };
      rect(BI.xa - 0.04, BI.z0 - 0.02, BI.xb + 0.05, BI.z1 + 0.02, 0.55, 5); rect(BI.xa - 0.30, BI.z0 + 0.05, BI.xa, BI.z1 - 0.05, 0.22, 14);
      rect(SI.xa - 0.05, SI.z0 - 0.02, SI.xb + 0.05, SI.z1 + 0.02, 0.55, 5);
      rect(21.40 - D - 0.03, 13.68, 21.40, 21.35, 0.45, 6);               // range wall plinth line
      rect(FX0 - 0.03, 10.75, FX1 + 0.03, 10.75 + FD + 0.03, 0.45, 6);     // fridge column
      rect(BAYX, 21.35 - 0.56, 20.43, 21.35, 0.4, 7); rect(BAYX, 19.83, BAYX + 0.56, 21.35, 0.4, 7); // banquette
      g.filter = 'blur(4px)'; g.fillStyle = 'rgba(0,0,0,0.42)';
      for (const [x, z] of stoolPts) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [u, v] = fp(x + sx * 0.19, z + sz * 0.19); g.beginPath(); g.arc(u, v, 0.035 * S, 0, PI * 2); g.fill(); }
      for (const [x, z] of chairPts) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [u, v] = fp(x + sx * 0.23, z + sz * 0.21); g.beginPath(); g.arc(u, v, 0.03 * S, 0, PI * 2); g.fill(); }
      for (const s of [-1, 1]) rect(19.0 + s * 0.62 - 0.06, 20.12 - 0.40, 19.0 + s * 0.62 + 0.06, 20.12 + 0.40, 0.45, 4);
      rect(18.0, 19.6, 20.0, 20.65, 0.16, 18);                               // under the table top
      g.filter = 'none';
    }, {});
    ao.wrapS = ao.wrapT = THREE.ClampToEdgeWrapping;
    decal(ao, new THREE.MeshBasicMaterial({ map: ao, color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), X1 - X0, Z1 - Z0, [(X0 + X1) / 2, 0.011, (Z0 + Z1) / 2], [-PI / 2, 0, 0], 2);
  }

  // ================================================================== PHYSICS
  // range wall: several boxes so the open shelves/desk stay usable for the dynamic decor
  {
    const A = (z0, z1, d, y0, y1) => phys.boxAABB([21.40 - d, y0, z0], [21.40, y1, z1]);
    A(13.68, 19.65, 0.66, 0, CT); A(15.53, 17.05, 0.70, 0, 0.93);
    A(13.68, 14.44, D, CT, CEIL); A(18.89, 19.65, D, CT, CEIL); A(20.55, 21.35, D, 0, CEIL);
    A(14.44, 15.39, 0.36, UP0, CEIL); A(17.19, 18.89, 0.36, UP0, CEIL); A(15.39, 17.19, 0.62, 1.96, CEIL);
    A(19.65, 20.55, 0.58, 0, 0.76); for (const sy of [1.24, 1.66, 2.08]) A(19.65, 20.55, 0.30, sy, sy + 0.05);
  }
  phys.solidGroup(fw);
  for (const g of islands.children) if (g.name !== 'stool') phys.solidGroup(g);
  // stools are light: players can shove them around
  for (const s of stools) phys.dynamic(s, { mass: 6, shape: 'box', friction: 0.7 });
  for (const d of dyn) phys.dynamic(d, { mass: 0.6, shape: 'box', friction: 0.6 });

  kit.mergeStatic(root);
}
