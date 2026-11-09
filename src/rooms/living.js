// Piece: living — Formal living room, fireplace on the SW wall (x=0.65)
// Owned rooms: living | Reference photos: p03
// Room rect x 0.65..8.15, z 7.37..13.30. The photo looks from the foyer end (x≈8) toward the fireplace (−x);
// +z (family-room wall) is on the left of frame, −z (street wall) on the right.

import { vintageRug } from './living/vintageRug.js';
export const piece = { rooms: ["living"], photos: ["p03"] };
export const ownCeiling = [];
// The foyer wall (x=8.15) stops the camera backing up further, so the seating group sits ~0.7 m nearer
// the fireplace instead (same framing as a camera 1.2 m further back).
// Photo geometry (far-wall floor/ceiling ratio, sofa tops at the horizon) puts the lens ~1.0 m high, ~6.9 m from the
// fireplace, centred on the room axis, looking very slightly up, wide (≈63° vertical).
// Far-wall floor/ceiling lines in the photo sit ~27 px above ours: the lens is pitched ~3° down.
export const views = { p03: { pos: [7.95, 1.12, 10.52], look: [0, 0.70, 10.56], fov: 66 } };

const ZC = 10.58; // fireplace / room axis (the photo is centred on it)

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx; const { M } = kit;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const R = kit.roomInfo('living');

  // ------------------------------------------------------------------ materials
  // crushed olive-brown velvet (sheen-based fabric). Extrude UVs are metres -> scale 3 = 33 cm tiles;
  // kit.cushion UVs run 0..1 per face, so the seat cushions use a finer repeat.
  const VEL = '#4a4630';
  const velvet = kit.fabric.velvet(VEL, { scale: 2.6, normalScale: 1.0, sheenRoughness: 0.35, sheenColor: '#b2ab84' });
  const velvetC = kit.fabric.velvet(VEL, { scale: 5, normalScale: 1.0, sheenRoughness: 0.35, sheenColor: '#b2ab84' });
  // soft low-frequency crush: a roughness/brightness mottle so the sheen breaks up like the photo's velvet
  velvet.roughnessMap = kit.canvasTex(512, 512, (g, w, h) => {
    const r = kit.rng(66); g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); g.filter = 'blur(10px)';
    for (let i = 0; i < 260; i++) { const v = 150 + r() * 100; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.beginPath(); g.ellipse(0, 0, 14 + r() * 50, 4 + r() * 12, 0, 0, 6.28); g.fill(); g.restore(); }
  }, { repeat: [0.7, 0.7] });
  velvet.roughnessMap.colorSpace = THREE.NoColorSpace; velvetC.roughnessMap = velvet.roughnessMap;
  // crushed pile: high-contrast low-frequency sheen-colour mottle (bright streaks where the nap lies flat)
  const crush = kit.canvasTex(512, 512, (g, w, h) => {
    const r = kit.rng(67); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h); g.filter = 'blur(14px)';
    for (let i = 0; i < 220; i++) { const v = r() < 0.5 ? 40 + r() * 60 : 190 + r() * 65; g.fillStyle = `rgba(${v},${v},${v},0.45)`; g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.beginPath(); g.ellipse(0, 0, 20 + r() * 70, 6 + r() * 18, 0, 0, 6.28); g.fill(); g.restore(); }
  }, { repeat: [0.8, 0.8] });
  for (const m of [velvet, velvetC]) { m.sheenColorMap = crush; m.sheenColor.set('#d6cfa6'); m.needsUpdate = true; }
  // bouclé: kit.fabric.boucle sheen setup, but on Poly Haven curly_teddy_natural maps (the kit's wool_boucle
  // colour map is a glen plaid, which read as a check pattern on the chairs)
  const teddy = (rep) => {
    const m = kit.fabric.boucle('#ffffff', { scale: rep });
    const T = (n, srgb) => kit.tex(`assets/ph/curly_teddy_natural/curly_teddy_natural_${n}_1k.jpg`, { srgb, repeat: [rep, rep] });
    m.map = T('diff', true); m.normalMap = T('nor_gl', false); m.roughnessMap = T('rough', false); m.aoMap = T('ao', false);
    m.map = null; m.color.set(0xece6db); m.aoMapIntensity = 0.5; m.normalScale.set(1.9, 1.9); return m;
  };
  const boucle = teddy(4);   // extrude UVs (metres): 25 cm tiles
  const boucleS = teddy(3);  // drum base (UVs ~metres around) / cushions (0..1 per face)
  const beadWood = std({ color: 0xffffff, roughness: 0.75 });
  const black = M.matteBlack, blackMetal = M.blackMetal;

  // procedural stone: honed greige limestone with horizontal cross-cut striations (photo surround)
  const stoneTex = kit.canvasTex(1024, 512, (g, w, h) => {
    const r = kit.rng(31);
    g.fillStyle = '#bba893'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h, th = 1 + r() * 6, v = r();
      const c = v < 0.45 ? `rgba(${128 + r() * 20},${108 + r() * 16},${90 + r() * 14},${0.35 + r() * 0.4})` : `rgba(${205 + r() * 25},${194 + r() * 22},${178 + r() * 20},${0.2 + r() * 0.35})`;
      g.fillStyle = c; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 3 + (r() - 0.5) * 2);
      g.lineTo(w, y + th); g.lineTo(0, y + th); g.fill();
    }
    for (let i = 0; i < 9000; i++) { const v = 140 + r() * 70; g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.25)`; g.fillRect(r() * w, r() * h, 2, 1); }
  });
  void stoneTex;
  // vein-cut travertine (ambientCG Travertine009, CC0), greyed toward the photo's pale greige; each slab
  // gets its own UV offset so the legs/beam/hearth don't repeat the same veins
  const trav = (off, rep = [1, 1]) => std({
    map: kit.tex('assets/acg/Travertine009/Travertine009_Color.jpg', { srgb: true, repeat: rep, offset: off }),
    normalMap: kit.tex('assets/acg/Travertine009/Travertine009_NormalGL.jpg', { repeat: rep, offset: off }),
    roughnessMap: kit.tex('assets/acg/Travertine009/Travertine009_Roughness.jpg', { repeat: rep, offset: off }),
    color: 0xc9c2ba, roughness: 0.9, normalScale: new THREE.Vector2(0.6, 0.6) });
  const stone = trav([0, 0]), stoneLegL = trav([0.31, 0.12], [0.5, 0.9]), stoneLegR = trav([0.67, 0.55], [0.5, 0.9]);
  const stoneBeam = trav([0.1, 0.4], [1.4, 0.35]), stoneLedge = trav([0.5, 0.7], [1.6, 0.4]);
  const stoneDark = std({ map: stoneTex, color: 0x8f857a, roughness: 0.85 });

  // rounded-rect side profile (u across, v up from 0..h) extruded `t` thick with a soft bevel — upholstery pills
  function roundedShape(w, h, rt, rb) {
    const s = new THREE.Shape(), x0 = -w / 2, x1 = w / 2;
    s.moveTo(x0 + rb, 0); s.lineTo(x1 - rb, 0); s.quadraticCurveTo(x1, 0, x1, rb);
    s.lineTo(x1, h - rt); s.absarc(x1 - rt, h - rt, rt, 0, Math.PI / 2, false);
    s.lineTo(x0 + rt, h); s.absarc(x0 + rt, h - rt, rt, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, rb); s.quadraticCurveTo(x0, 0, x0 + rb, 0); return s;
  }
  function pillX(w, h, t, rt, rb, bev) { // profile in local z-y, thickness along local x, centred
    const b = Math.min(bev, t / 2 - 0.005);
    const g = new THREE.ExtrudeGeometry(roundedShape(w - 2 * b, h - 2 * b, rt, rb), { depth: t - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 6, curveSegments: 20 });
    g.translate(0, b, -(t - 2 * b) / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals(); return g;
  }

  // ------------------------------------------------------------------ architecture details
  // tall painted baseboard (photo ≈ 0.18 m), skipping the foyer opening and the hearth
  kit.baseboards(root, R.rect, 0, 0.18, 0.016, M.paintWhite, [
    { side: 'x1', from: 10.80, to: 12.60 }, { side: 'x0', from: 9.24, to: 11.92 }]);
  // recessed cans + two in-ceiling speakers
  kit.canLights(root, [[1.7, 8.25], [1.7, 12.45], [4.4, 8.25], [4.4, 12.45], [6.9, 8.25], [6.9, 12.45], [3.2, 10.58]], 3.04, 0.045);
  // bright warm-white ceiling skin 1 cm under the slab (the photo ceiling reads near-white, ours read grey)
  kit.add(root, (() => { const [x0, z0, x1, z1] = R.rect; const pg = new THREE.PlaneGeometry(x1 - x0, z1 - z0); pg.rotateX(Math.PI / 2); return pg; })(),
    std({ color: 0xfbf8f2, roughness: 0.95, emissive: 0xfff8ee, emissiveIntensity: 0.12 }), [(R.rect[0] + R.rect[2]) / 2, 3.04, (R.rect[1] + R.rect[3]) / 2], [0, 0, 0], { shadow: false });
  {
    const spk = std({ color: 0xeeece8, roughness: 0.7 });
    const grille = std({ color: 0xdedbd5, roughness: 0.8, normalMap: kit.noiseNormal(64, 3, 32, 3) });
    for (const [x, z] of [[2.3, 9.15], [2.3, 12.0]]) {
      kit.add(root, kit.cyl(0.125, 0.125, 0.006, 40), spk, [x, 3.037, z], [0, 0, 0], { shadow: false });
      kit.add(root, kit.cyl(0.112, 0.112, 0.004, 40), grille, [x, 3.033, z], [0, 0, 0], { shadow: false });
    }
  }
  // closed white-oak door on the far end of the family-room wall (z=13.30) — powder-room door in the photo
  {
    const g = kit.group(root, [1.25, 0, 13.30], Math.PI); // faces −z (into the room)
    const W = 0.86, H = 2.40;
    kit.add(g, kit.box(W, H, 0.04), M.oakDoor, [0, H / 2, 0.02]);
    const cas = M.paintWhite;
    kit.add(g, kit.rbox(0.07, H + 0.07, 0.02, 0.004), cas, [-W / 2 - 0.035, (H + 0.07) / 2, 0.01]);
    kit.add(g, kit.rbox(0.07, H + 0.07, 0.02, 0.004), cas, [W / 2 + 0.035, (H + 0.07) / 2, 0.01]);
    kit.add(g, kit.rbox(W + 0.14, 0.07, 0.02, 0.004), cas, [0, H + 0.035, 0.01]);
    kit.add(g, kit.cyl(0.026, 0.026, 0.01, 20), blackMetal, [W / 2 - 0.07, 1.0, 0.045], [Math.PI / 2, 0, 0]);
    kit.add(g, kit.rbox(0.13, 0.018, 0.018, 0.006), blackMetal, [W / 2 - 0.12, 1.0, 0.06]);
  }
  // duplex outlet low on the left wall (photo: next to the sofa)
  {
    const g = kit.group(root, [6.15, 0.32, 13.30], Math.PI);
    kit.add(g, kit.rbox(0.07, 0.115, 0.008, 0.002), M.paintWhite, [0, 0, 0.004], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ fireplace (x = 0.65 wall)
  {
    const g = kit.group(root, [0.65, 0, ZC], Math.PI / 2); // local +z = into the room (+x world), local +x = −z world
    // hearth plinth (shadowed recess) + floating limestone ledge
    kit.add(g, kit.rbox(2.50, 0.33, 0.42, 0.01), stoneDark, [0, 0.165, 0.21]);
    kit.add(g, kit.rbox(2.64, 0.12, 0.52, 0.014), stoneLedge, [0, 0.37, 0.26]);
    // surround: two legs + chunky mantel beam
    const FW = 2.04, legW = 0.45, legD = 0.32;
    kit.add(g, kit.rbox(legW, 0.84, legD, 0.008), stoneLegL, [-(FW / 2 - legW / 2), 0.43 + 0.42, legD / 2]);
    kit.add(g, kit.rbox(legW, 0.84, legD, 0.008), stoneLegR, [(FW / 2 - legW / 2), 0.43 + 0.42, legD / 2]);
    kit.add(g, kit.rbox(FW + 0.06, 0.32, 0.46, 0.014), stoneBeam, [0, 1.27 + 0.16, 0.23]);
    // firebox: black steel liner set back into the surround
    const fbW = FW - 2 * legW, fbH = 0.84;
    const soot = std({ color: 0x0c0b0b, roughness: 0.95 });
    kit.add(g, kit.box(fbW, fbH, 0.02), soot, [0, 0.43 + fbH / 2, 0.01]);
    kit.add(g, kit.box(0.02, fbH, legD - 0.02), soot, [-fbW / 2 + 0.01, 0.43 + fbH / 2, legD / 2]);
    kit.add(g, kit.box(0.02, fbH, legD - 0.02), soot, [fbW / 2 - 0.01, 0.43 + fbH / 2, legD / 2]);
    kit.add(g, kit.box(fbW, 0.02, legD - 0.02), soot, [0, 0.43 + fbH - 0.01, legD / 2]);
    // stacked birch logs, cut ends facing the room
    const bark = std({ color: 0x5f5247, roughness: 0.95, normalMap: kit.noiseNormal(128, 3, 16, 4) });
    const endTex = kit.canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#c9a77f'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 9; k++) { c.strokeStyle = `rgba(150,110,70,${0.25 + 0.05 * k})`; c.lineWidth = 2; c.beginPath(); c.arc(w / 2 + 3, h / 2 - 2, 6 + k * 6.5, 0, Math.PI * 2); c.stroke(); }
      c.strokeStyle = 'rgba(90,70,55,0.9)'; c.lineWidth = 7; c.beginPath(); c.arc(w / 2, h / 2, 60, 0, Math.PI * 2); c.stroke();
    });
    const endMat = std({ map: endTex, roughness: 0.9 });
    const logGeo = kit.cyl(1, 1, 1, 20); logGeo.rotateX(Math.PI / 2);
    const logs = []; const r = kit.rng(5);
    const rows = [[6, 0.072], [5, 0.07], [4, 0.068], [2, 0.064]];
    let y = 0.43 + 0.075;
    for (const [n, rad] of rows) {
      for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * (rad * 2.02); logs.push([x + (r() - 0.5) * 0.01, y, rad * (0.92 + r() * 0.12)]); }
      y += rad * 1.75;
    }
    const im = new THREE.InstancedMesh(logGeo, [bark, endMat, endMat], logs.length);
    const m4 = new THREE.Matrix4();
    logs.forEach(([x, yy, rr], i) => { m4.compose(V3(x, yy, 0.12), new THREE.Quaternion(), V3(rr, rr, 0.20)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; g.add(im);
    phys.boxLocal(g, 0, 0.29, 0.26, 1.32, 0.29, 0.26);
    phys.boxLocal(g, 0, 1.0, 0.12, FW / 2, 0.57, 0.12);

    // mantel decor: trailing pothos (left, +z world = local −x) and a small dark sculpture (right)
    const potM = std({ color: 0xe9e5dd, roughness: 0.5 });
    kit.add(g, kit.lathe([[0, 0], [0.065, 0], [0.08, 0.06], [0.085, 0.13], [0.078, 0.135], [0, 0.12]], 32), potM, [-0.70, 1.59, 0.26]);
    pothos(g, V3(-0.70, 1.72, 0.26));
    const sculpt = std({ color: 0x2a221d, roughness: 0.5 });
    const sg = kit.group(g, [0.64, 1.59, 0.19], 0.4);
    kit.add(sg, kit.sphere(0.06, 20, 12), sculpt, [0, 0.045, 0]).scale.set(1.6, 0.75, 1);
    kit.add(sg, kit.cyl(0.006, 0.012, 0.09, 8), sculpt, [0.09, 0.08, 0], [0, 0, -0.9]);
    kit.add(sg, kit.sphere(0.05, 16, 10), M.linenWhite, [-0.11, 0.035, 0.02]).scale.set(1.2, 0.7, 1);

    // round mirror with a thin black frame — a real planar reflection
    // cheap env-mapped mirror (a live Reflector re-rendered the whole house every frame)
    kit.add(g, new THREE.CircleGeometry(0.565, 64), std({ color: 0xd9dcda, metalness: 0.55, roughness: 0.12, emissive: 0xb8bcbc, emissiveIntensity: 0.35 }), [0, 2.26, 0.031], [0, 0, 0], { shadow: false });
    kit.add(g, kit.torus(0.572, 0.011, 10, 96), blackMetal, [0, 2.26, 0.03]);
    kit.add(g, kit.cyl(0.57, 0.57, 0.02, 48), black, [0, 2.26, 0.012], [Math.PI / 2, 0, 0]);
  }

  // trailing pothos: heart leaves along a few drooping vines
  function pothos(parent, at) {
    const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.03, 0.02, 0.035, 0.06, 0, 0.085); leafShape.bezierCurveTo(-0.035, 0.06, -0.03, 0.02, 0, 0);
    const lg = new THREE.ShapeGeometry(leafShape, 6);
    const leafM = std({ color: 0x4f8a2c, roughness: 0.5, side: THREE.DoubleSide });
    const vines = [];
    const r = kit.rng(77);
    const dirs = [[-0.6, 0.6], [0.4, 0.9], [-0.1, 1.0], [-0.8, 0.2], [0.7, 0.4], [0.0, 0.3]];
    for (const [dx, dz] of dirs) {
      const L = 0.40 + r() * 0.55; const pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(V3(at.x + dx * 0.14 * Math.min(1, t * 3), at.y + 0.05 - Math.max(0, t - 0.25) * L * 1.2 + (t < 0.25 ? t * 0.2 : 0.05), at.z + dz * (0.08 + t * 0.12))); }
      vines.push(pts);
    }
    const leaves = [];
    for (const pts of vines) {
      parent.add(Object.assign(new THREE.Mesh(kit.tube(pts.map(p => [p.x, p.y, p.z]), 0.003, 24), leafM)));
      const curve = new THREE.CatmullRomCurve3(pts);
      for (let k = 0; k < 11; k++) leaves.push({ p: curve.getPoint(k / 11 + 0.04), a: r() * 6.28, s: 1.1 + r() * 0.7 });
    }
    for (let k = 0; k < 34; k++) leaves.push({ p: V3(at.x + (r() - 0.5) * 0.32, at.y + 0.02 + r() * 0.16, at.z + (r() - 0.5) * 0.30), a: r() * 6.28, s: 1.3 + r() * 0.6 });
    const im = new THREE.InstancedMesh(lg, leafM, leaves.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    leaves.forEach((L, i) => { e.set(-0.6 - r() * 1.2, L.a, (r() - 0.5) * 0.8); q.setFromEuler(e); m4.compose(L.p, q, V3(L.s, L.s, L.s)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color().setHSL(0.27 + r() * 0.04, 0.5, 0.3 + r() * 0.12)); });
    im.castShadow = true; parent.add(im);
  }

  // ------------------------------------------------------------------ drapes + rods
  const drapeTex = kit.canvasTex(256, 384, (g, w, h) => {
    const r = kit.rng(12);
    g.fillStyle = '#d2c5b1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const v = 200 + r() * 40; g.fillStyle = `rgba(${v},${v - 10},${v - 24},0.18)`; g.fillRect(r() * w, r() * h, 1, 3); }
    // ikat medallion lattice (blurred taupe diamonds with a dotted core)
    const motif = (cx, cy) => {
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(104,86,70,${0.85 - k * 0.15})`; g.lineWidth = 6 - k;
        g.beginPath(); g.moveTo(cx, cy - 80 + k * 8); g.lineTo(cx + 56 - k * 6, cy); g.lineTo(cx, cy + 80 - k * 8); g.lineTo(cx - 56 + k * 6, cy); g.closePath(); g.stroke();
      }
      g.fillStyle = 'rgba(96,78,62,0.8)';
      for (let d = 0; d < 5; d++) { g.beginPath(); g.ellipse(cx, cy - 36 + d * 18, 9 - Math.abs(d - 2) * 2, 5, 0, 0, 6.28); g.fill(); }
      for (let j = 0; j < 40; j++) { g.fillStyle = 'rgba(221,210,194,0.5)'; g.fillRect(cx - 60 + r() * 120, cy - 84 + r() * 168, 6 + r() * 6, 1); }
    };
    motif(w / 2, h / 2); motif(0, 0); motif(w, 0); motif(0, h); motif(w, h);
  });
  const drapeMat = kit.fabric.linen('#ffffff', { scale: 1.5, side: THREE.DoubleSide });
  drapeMat.map = drapeTex; drapeMat.aoMap = null;
  // gathered panel: local x = width (folded), y = height from floor, z = pleat depth toward the room
  function drape(width, height, folds) {
    const nx = folds * 10, ny = 24; const flat = width * 1.9;
    const g = new THREE.PlaneGeometry(width, height, nx, ny); const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + width / 2) / width, v = (p.getY(i) + height / 2) / height;
      const amp = 0.045 * (1 + 0.5 * (1 - v));
      p.setXYZ(i, p.getX(i) * (1 + 0.08 * (1 - v)), p.getY(i) + height / 2, Math.sin(u * folds * Math.PI * 2) * amp + amp);
      uv.setXY(i, u * flat / 0.26, v * height / 0.39);
    }
    g.computeVertexNormals(); return g;
  }
  function rod(parent, a, b, y) { // a,b = [x,z] ends; projects 0.13 off the wall
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = kit.group(parent, [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    kit.add(g, kit.cyl(0.013, 0.013, L, 16), blackMetal, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) {
      kit.add(g, kit.sphere(0.025, 16, 10), blackMetal, [s * (L / 2 + 0.02), 0, 0]);
      kit.add(g, kit.cyl(0.008, 0.008, 0.13, 8), blackMetal, [s * (L / 2 - 0.08), 0, -0.065 * 0], [Math.PI / 2, 0, 0]);
    }
    return g;
  }
  const dropY = 2.93;
  // back (x=0.65) wall: one panel on the outer side of each window
  for (const [zc, side] of [[12.10, 1], [9.05, -1]]) {
    const zIn = zc - side * 0.30, zOut = zc + side * 0.86;
    rod(root, [0.78, Math.min(zIn, zOut)], [0.78, Math.max(zIn, zOut)], dropY);
    const pz = zc + side * 0.42;
    kit.add(root, drape(0.56, dropY - 0.015, 4), drapeMat, [0.70, 0.01, pz], [0, Math.PI / 2, 0]);
  }
  // street (z=7.37) wall window at x=1.50: panels both sides
  rod(root, [0.80, 7.50], [2.40, 7.50], dropY);
  kit.add(root, drape(0.52, dropY - 0.015, 4), drapeMat, [1.05, 0.01, 7.42], [0, 0, 0]);
  kit.add(root, drape(0.56, dropY - 0.015, 4), drapeMat, [2.05, 0.01, 7.42], [0, 0, 0]);

  // ------------------------------------------------------------------ beaded chandelier + fan
  {
    const g = kit.group(root, [3.45, 3.05, ZC], 0, 'chandelier');
    const gS = new THREE.Group(); gS.scale.set(1.22, 1.08, 1.22); gS.position.y = 0.02; // photo: ~0.8 m wide basket
    kit.add(g, kit.cyl(0.075, 0.08, 0.05, 32), blackMetal, [0, -0.025, 0]);
    // short slim downrod + flat low-profile motor: the fan hugs the ceiling, the chandelier hangs below it
    kit.add(g, kit.cyl(0.009, 0.009, 0.10, 12), blackMetal, [0, -0.07, 0]);
    kit.add(g, kit.lathe([[0, 0], [0.045, 0.004], [0.055, 0.02], [0.045, 0.04], [0, 0.044]], 32), blackMetal, [0, -0.165, 0]);
    const blades = kit.group(g, [0, -0.15, 0], 0); blades.userData.keep = true;
    for (let i = 0; i < 2; i++) { // two slim blades (seen edge-on as one thin line in the photo)
      const b = kit.group(blades, [0, 0, 0], Math.PI / 2 + i * Math.PI);
      kit.add(b, kit.rbox(0.78, 0.004, 0.045, 0.0015), black, [0.46, 0, 0], [0.05, 0, 0]);
      kit.add(b, kit.box(0.08, 0.006, 0.016), blackMetal, [0.07, 0, 0]);
    }
    if (!ctx.shot) ctx.onUpdate((dt) => { blades.rotation.y += dt * 1.6; });
    kit.add(g, kit.cyl(0.006, 0.006, 0.10, 8), blackMetal, [0, -0.23, 0]);
    // tiered empire bead strands (r, y below ceiling): ~0.7 m diameter, ~1.0 m tall
    const prof = [[0.07, -0.30], [0.11, -0.37], [0.165, -0.47], [0.22, -0.59], [0.265, -0.71], [0.28, -0.80], [0.25, -0.88], [0.18, -0.96], [0.10, -1.02], [0.03, -1.07]];
    const curve2 = new THREE.SplineCurve(prof.map(([a, b]) => new THREE.Vector2(a, b)));
    const pts2 = curve2.getSpacedPoints(46);
    const beads = []; const cols = 46; const r = kit.rng(9);
    for (let c = 0; c < cols; c++) {
      const a = (c / cols) * Math.PI * 2;
      for (const p of pts2) beads.push([Math.cos(a) * p.x, p.y, Math.sin(a) * p.x, 0.0115]);
    }
    // swags between strands on four tiers
    for (const [ti, sag] of [[5, 0.025], [12, 0.035], [19, 0.04], [26, 0.045], [33, 0.04], [39, 0.03]]) {
      const p = pts2[ti];
      for (let c = 0; c < cols; c += 2) {
        const a0 = (c / cols) * Math.PI * 2, a1 = ((c + 2) / cols) * Math.PI * 2;
        for (let k = 1; k < 7; k++) { const t = k / 7; const a = a0 + (a1 - a0) * t; const rr = p.x + 0.025 + Math.sin(t * Math.PI) * 0.02; beads.push([Math.cos(a) * rr, p.y - Math.sin(t * Math.PI) * sag, Math.sin(a) * rr, 0.012]); }
      }
    }
    // crown ring + bottom tassel
    for (let c = 0; c < 34; c++) { const a = (c / 34) * Math.PI * 2; beads.push([Math.cos(a) * 0.075, -0.295, Math.sin(a) * 0.075, 0.014]); }
    for (let k = 0; k < 7; k++) beads.push([0, -1.09 - k * 0.026, 0, 0.012 + (k === 6 ? 0.014 : 0)]);
    const bg = kit.sphere(1, 8, 6);
    const im = new THREE.InstancedMesh(bg, beadWood, beads.length); g.add(gS); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
    beads.forEach(([x, y, z, s], i) => { const ss = s * (0.85 + r() * 0.3); m4.compose(V3(x, y, z), q, V3(ss, ss, ss)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0xa38f78).multiplyScalar(0.8 + r() * 0.35)); });
    im.castShadow = true; gS.add(im);
    // dim inner glow (bulbs inside the basket)
    kit.add(g, kit.sphere(0.06, 16, 10), std({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 1.2 }), [0, -0.76, 0], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ rug (faded vintage Oushak, under the seating)
  {
    /* p03: faded vintage Oushak, warm greige field with rose/rust + slate motifs, heavily abraded, knotted fringe */
    const RW = 3.9, RL = 5.5, RX = 4.85;
    vintageRug(ctx, root, { L: RL, W: RW, pos: [RX, 0, ZC], ry: 0, seed: 44, pal: {
      field: [150, 128, 114], fieldDark: [100, 84, 76], border: [128, 108, 98], borderDark: [88, 74, 68],
      motifA: [152, 104, 92], motifB: [108, 110, 116], motifC: [186, 172, 156], warp: [194, 182, 168], fringe: [222, 212, 196] } });
  }

  // ------------------------------------------------------------------ curved olive velvet sofas
  const ikatTex = kit.canvasTex(256, 256, (g, w, h) => {
    const r = kit.rng(3);
    g.fillStyle = '#ece6dc'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      const cx = col * 56 + (row % 2) * 28, cy = row * 40;
      g.fillStyle = 'rgba(25,22,20,0.9)';
      g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx - 8 + r() * 4, cy - 14); g.lineTo(cx + 8, cy); g.lineTo(cx + 26 - r() * 4, cy - 14); g.lineTo(cx + 24, cy + 4); g.lineTo(cx + 8, cy + 14); g.lineTo(cx - 8, cy + 2); g.lineTo(cx - 26, cy + 14); g.fill();
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(236,230,220,0.6)' : 'rgba(25,22,20,0.35)'; g.fillRect(r() * w, r() * h, 3 + r() * 6, 1); }
  });
  const pillowTan = kit.fabric.velvet('#8c7862', { scale: 2 });
  const pillowIkat = kit.fabric.linen('#ffffff', { scale: 2 }); pillowIkat.map = ikatTex; pillowIkat.aoMap = null;
  const pillowCream = teddy(2); pillowCream.color.set(0xdcd2c2);
  const pillowChar = kit.fabric.velvet('#2e2e30', { scale: 2 });
  const dynamicItems = [];
  function pillow(parent, w, h, mat, pos, rot) {
    const m = kit.add(parent, kit.cushion(w, h, 0.13, 0.06, 0.055, 6), mat, pos, rot);
    dynamicItems.push({ m, mass: 0.6 }); return m;
  }
  // plan-view annular sector with round end caps (centre of curvature in FRONT of the sofa, at local z=+Rc),
  // extruded up to height h with a soft bevel: one continuous crescent of upholstery.
  function crescent(Rc, ri, ro, a, h, bev) {
    ri += bev; ro -= bev; const cr = (ro - ri) / 2, rm = (ri + ro) / 2;
    const cx = 0, cy = -Rc, p1 = Math.PI / 2 - a, p2 = Math.PI / 2 + a; // shape y = −local z
    const s = new THREE.Shape();
    s.moveTo(cx + ro * Math.cos(p2), cy + ro * Math.sin(p2));
    s.absarc(cx, cy, ro, p2, p1, true);
    s.absarc(cx + rm * Math.cos(p1), cy + rm * Math.sin(p1), cr, p1, p1 - Math.PI, true);
    s.absarc(cx, cy, ri, p1, p2, false);
    s.absarc(cx + rm * Math.cos(p2), cy + rm * Math.sin(p2), cr, p2 + Math.PI, p2, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 6, curveSegments: 40 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.computeVertexNormals(); return g;
  }
  // tub sofa (photo: 2.3 m long, 0.95 m deep, 0.80 m tall): a tall continuous barrel back that wraps
  // into two full-depth rounded arms (horseshoe), a thick separate seat cushion, gently curved in plan.
  // crushed-pile brightness variation + darkening toward the floor (baked contact AO), as vertex colours
  for (const m of [velvet, velvetC]) m.vertexColors = true;
  function crushed(geo, seed) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + seed, y = p.getY(i), z = p.getZ(i);
      const n = Math.sin(x * 6.1 + Math.sin(z * 4.7 + y * 3.1) * 1.7) * Math.sin(z * 5.3 - x * 2.2 + y * 6.0) + 0.5 * Math.sin(x * 13.7 + z * 11.3 - y * 4.0);
      const ao = 0.62 + 0.38 * Math.min(1, Math.max(0, (y - 0.02) / 0.32));
      const v = (0.9 + 0.2 * n) * ao; c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
  }
  function sofa(pos, ry) {
    const L = 2.65, D = 0.92, H = 0.74, T = 0.27, Rc = 5.6;
    const rB = Rc + D / 2;                           // back face radius (local z = −D/2 on the axis)
    const aArm = (L / 2 - T / 2) / Rc;               // arm centre angle
    const g = kit.group(root, pos, ry, 'sofa');
    // recessed black plinth
    kit.add(g, crescent(Rc, rB - D + 0.22, rB - 0.22, aArm * 0.8, 0.03, 0.01), black, [0, 0, 0]);
    // deck under the seat cushion (its round ends hide inside the arms)
    kit.add(g, crushed(crescent(Rc, rB - D, rB - 0.10, (L / 2 - 0.45) / Rc, 0.33, 0.12), 1), velvet, [0, 0.03, 0]);
    // barrel back: thick, very rounded top
    kit.add(g, crushed(crescent(Rc, rB - T, rB, aArm, H - 0.03, 0.125), 2), velvet, [0, 0.03, 0]);
    // arms: full-depth tub ends with a big rounded top profile
    const armG = crushed(pillX(D, H - 0.05, T, 0.30, 0.09, 0.12), 3);
    for (const s of [-1, 1]) kit.add(g, armG, velvet, [s * Rc * Math.sin(aArm), 0.03, Rc - Rc * Math.cos(aArm)], [0, -s * aArm, 0]);
    // thick seat cushion between the arms (top ≈ 0.49 m), slightly crowned
    // seat: two loose cushions (a seam down the middle), puffed, front edge rolled
    const cw = (L - 2 * T + 0.04) / 2;
    for (const s of [-1, 1]) kit.add(g, crushed(kit.cushion(cw - 0.006, 0.15, D - T - 0.02, 0.07, 0.035, 8), 4 + s), velvetC, [s * (cw / 2), 0.405, (T - 0.02) / 2 + 0.01], [0, s * 0.02, 0]);
    // colliders: base+seat, back, arms
    phys.boxLocal(g, 0, 0.25, 0.05, L / 2, 0.25, D / 2);
    phys.boxLocal(g, 0, 0.65, -D / 2 + T / 2, L / 2, 0.15, T / 2);
    return g;
  }
  // left sofa (z≈12.0) faces −z; right sofa (z≈9.15) faces +z. Pillows sit at the fireplace end.
  // long, gently curved, parallel to the room axis (photo: 2.4 m, near ends ~2.6 m from the lens)
  const SX = 4.02;
  const TOE = 0.12; // ~7° toe-in: far ends angle in toward the fireplace (photo)
  const sL = sofa([SX, 0, 12.06], Math.PI - TOE);
  const sR = sofa([SX, 0, 9.10], TOE);
  // pillows clustered at the fireplace end (sofa local: +x is −world-x for the rotated left sofa)
  // per sofa: tan square in the far corner, black/white ikat, cream lumbar
  for (const [sf, k] of [[sL, 1], [sR, -1]]) {
    pillow(sf, 0.48, 0.46, pillowTan, [k * 0.66, 0.70, -0.06], [-0.30, k * 0.25, k * 0.10]);
    pillow(sf, 0.44, 0.40, pillowIkat, [k * 0.30, 0.68, -0.04], [-0.28, k * 0.10, k * 0.06]);
    pillow(sf, 0.56, 0.30, pillowCream, [-k * 0.18, 0.63, -0.04], [-0.26, -k * 0.06, -k * 0.03]);
  }

  // ------------------------------------------------------------------ cream boucle barrel chairs
  function chair(pos, ry, s = 1) {
    const g = kit.group(root, pos, ry, 'chair'); g.scale.setScalar(s);
    // curved-back lounge chair (photo, seen from behind: ~0.82 m wide, ~0.78 m tall). Base: a soft drum split
    // by deep vertical creases at the back and front centre into two plump scalloped lobes that tuck under at
    // the floor; on it a tall horseshoe back whose top arches down over rounded shoulders into lower arms.
    const base = (() => {
      const na = 128, nh = 26, H0 = 0.32, pos = [], uvs = [], idx = [];
      const wr = (d) => Math.atan2(Math.sin(d), Math.cos(d));
      for (let j = 0; j <= nh; j++) {
        const t = j / nh; const y = t * H0;
        const bulge = 0.345 + 0.03 * Math.sin(Math.PI * Math.min(1, t * 0.9));
        // rounded toe: the lobes curl under over the bottom 9 cm (like big knees)
        const toe = y < 0.09 ? Math.sqrt(Math.max(0, 1 - ((0.09 - y) / 0.09) ** 2)) * 0.32 + 0.68 : 1;
        const top = t > 0.80 ? 1 - ((t - 0.80) / 0.20) ** 1.5 * 0.16 : 1; // tuck where the back shell sits on it
        const cd = 0.10 + 0.16 * (1 - t);                 // creases deepen toward the floor (V notch between lobes)
        for (let i = 0; i <= na; i++) {
          const a = (i / na) * Math.PI * 2;
          const crease = 1 - cd * (Math.exp(-(wr(a) ** 2) / 0.02) + Math.exp(-(wr(a - Math.PI) ** 2) / 0.02))
            - 0.035 * (Math.exp(-(wr(a - Math.PI / 2) ** 2) / 0.03) + Math.exp(-(wr(a + Math.PI / 2) ** 2) / 0.03));
          const rr = bulge * crease * toe * top;
          pos.push(Math.sin(a) * rr * 1.10, y, Math.cos(a) * rr); uvs.push(i / na * 2.4, y * 1.1);
        }
      }
      for (let j = 0; j < nh; j++) for (let i = 0; i < na; i++) { const A = j * (na + 1) + i, B = A + na + 1; idx.push(A, A + 1, B, A + 1, B + 1, B); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    })();
    kit.add(g, base, boucleS, [0, 0.0, 0]);
    kit.add(g, kit.cushion(0.52, 0.12, 0.50, 0.055, 0.04, 8), boucleS, [0, 0.36, 0.09]);
    const U = new THREE.Shape(); const ro = 0.33, ri = 0.18, zf = 0.30, zb = 0.0; // shape (x, −z)
    U.moveTo(ro, -zf); U.lineTo(ro, -zb); U.absarc(0, -zb, ro, 0, Math.PI, false); U.lineTo(-ro, -zf);
    U.absarc(-(ro + ri) / 2, -zf, (ro - ri) / 2, Math.PI, 0, true);
    U.lineTo(-ri, -zb); U.absarc(0, -zb, ri, Math.PI, 0, true); U.lineTo(ri, -zf);
    U.absarc((ro + ri) / 2, -zf, (ro - ri) / 2, Math.PI, 0, true);
    const ug = new THREE.ExtrudeGeometry(U, { depth: 0.34, bevelEnabled: true, bevelSize: 0.085, bevelThickness: 0.10, bevelSegments: 10, curveSegments: 56, steps: 8 });
    ug.rotateX(-Math.PI / 2);
    { // arch the top: shoulders roll down toward the sides, arms step down toward the front
      const p = ug.attributes.position; const y0 = -0.10, y1 = 0.44;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = ((y - y0) / (y1 - y0)) ** 2;
        p.setY(i, y - k * (0.13 * (x / 0.42) ** 2 + 0.14 * Math.min(1, Math.max(0, z / 0.36)) ** 1.5));
      }
      ug.computeVertexNormals();
    }
    ug.scale(1.07, 1, 1); kit.add(g, ug, boucle, [0, 0.34, -0.04]);
    phys.boxLocal(g, 0, 0.245, 0, 0.43, 0.245, 0.41);
    phys.boxLocal(g, 0, 0.6, -0.30, 0.43, 0.14, 0.13);
    return g;
  }
  chair([6.08, 0, ZC], -Math.PI / 2, 1.0);        // foreground, back to camera, facing the fireplace
  const cBack = chair([1.78, 0, ZC + 0.03], Math.PI / 2, 0.98); // by the hearth, facing the room
  pillow(cBack, 0.46, 0.30, pillowChar, [0, 0.63, -0.12], [-0.25, 0, 0]);

  // ------------------------------------------------------------------ oval dark-wood coffee table + decor
  {
    // low oval live-edge slab (1.3 x 0.84 m, 0.40 m tall), mid-brown, on a recessed dark oval plinth
    const TX = 4.45;
    const g = kit.group(root, [TX, 0, ZC], 0, 'coffeeTable');
    const midWood = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0x4c4038, roughness: 0.38 });
    const sh = new THREE.Shape(); const er = kit.rng(23); const n = 72;
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const k = 1 + 0.025 * Math.sin(t * 7 + 1) + 0.015 * Math.sin(t * 13) + (er() - 0.5) * 0.012;
      const x = Math.cos(t) * 0.80 * k, y = Math.sin(t) * 0.40 * k; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
    sh.closePath();
    const top = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 });
    top.rotateX(-Math.PI / 2);
    { const p = top.attributes.position, uv = top.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.7, p.getZ(i) * 1.4 + p.getY(i) * 2); }
    kit.add(g, top, midWood, [0, 0.338, 0]);
    const ped = kit.cyl(0.16, 0.19, 0.33, 40); ped.scale(2.6, 1, 1);
    kit.add(g, ped, std({ color: 0x3a2f27, roughness: 0.7 }), [0, 0.165, 0]);
    phys.solidGroup(g);
    // decor: wooden bowl with succulents, stacked books, small brass dish
    const bowlScene = await kit.loadModel('assets/ph/wooden_bowl_01/wooden_bowl_01_1k.gltf');
    const bowl = kit.fitTo(bowlScene, 0.34, 'max'); bowl.position.set(TX + 0.05, 0.40, ZC + 0.08); root.add(bowl);
    const succM = std({ color: 0x6e8a74, roughness: 0.6 });
    const r = kit.rng(8);
    for (let k = 0; k < 7; k++) {
      const s = kit.group(bowl, [(r() - 0.5) * 0.16, 0.06, (r() - 0.5) * 0.16], r() * 6);
      for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2; kit.add(s, kit.sphere(0.022, 8, 6), succM, [Math.cos(a) * 0.022, 0.012, Math.sin(a) * 0.022]).scale.set(1.4, 0.5, 0.7); }
    }
    dynamicItems.push({ m: bowl, mass: 0.8, shape: 'hull' });
    const books = kit.group(root, [TX + 0.30, 0.40, ZC - 0.10], 1.5);
    const cover1 = std({ color: 0xe8e2d6, roughness: 0.8 }), cover2 = std({ color: 0x2b2a28, roughness: 0.7 });
    kit.add(books, kit.rbox(0.26, 0.035, 0.32, 0.004), cover1, [0, 0.0175, 0]);
    kit.add(books, kit.rbox(0.23, 0.03, 0.29, 0.004), cover2, [0.01, 0.05, 0]);
    dynamicItems.push({ m: books, mass: 1.2 });
    kit.add(root, kit.lathe([[0, 0], [0.06, 0], [0.075, 0.018], [0.07, 0.02], [0, 0.008]], 32), M.brass, [TX - 0.30, 0.40, ZC - 0.18]);
  }

  // ------------------------------------------------------------------ whitewashed tree-stump side table
  {
    const g = kit.group(root, [2.02, 0, 9.62], 0.3, 'stump');
    const barkTex = kit.canvasTex(256, 256, (c, w, h) => {
      const r = kit.rng(19); c.fillStyle = '#e4ddd2'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { const x = r() * w; c.fillStyle = `rgba(${150 + r() * 50},${140 + r() * 45},${125 + r() * 40},0.45)`; c.fillRect(x, 0, 1 + r() * 3, h); }
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(110,95,80,0.4)'; c.fillRect(r() * w, r() * h, 2, 8 + r() * 40); }
    });
    const ringTex = kit.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#e6dccb'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 22; k++) { c.strokeStyle = `rgba(170,140,110,${0.2 + (k % 3) * 0.08})`; c.lineWidth = 1.5; c.beginPath(); c.arc(w / 2 + 6, h / 2, 5 + k * 5.5, 0, 6.28); c.stroke(); }
      c.strokeStyle = 'rgba(140,110,85,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w * 0.9, h * 0.3); c.stroke();
    });
    const geo = kit.cyl(0.20, 0.215, 0.46, 28);
    { const p = geo.attributes.position; const r = kit.rng(2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.035 * Math.sin(a * 5 + 1) + 0.02 * Math.sin(a * 11); if (Math.hypot(x, z) > 0.01) p.setXYZ(i, x * k, p.getY(i), z * k); } geo.computeVertexNormals(); }
    const im = new THREE.Mesh(geo, [std({ map: barkTex, roughness: 0.9, normalMap: kit.noiseNormal(128, 4, 24, 6) }), std({ map: ringTex, roughness: 0.8 }), std({ map: ringTex, roughness: 0.8 })]);
    im.position.y = 0.23; im.castShadow = true; im.receiveShadow = true; g.add(im);
    // dark bark collar around the cut top + a few bark plates down the side
    const barkDark = std({ color: 0x4a3c30, roughness: 0.95, normalMap: kit.noiseNormal(128, 4, 24, 7) });
    kit.add(g, kit.torus(0.205, 0.016, 8, 40), barkDark, [0, 0.452, 0], [Math.PI / 2, 0, 0]);
    { const r2 = kit.rng(21); for (let k = 0; k < 9; k++) { const a = r2() * 6.28, hh = 0.08 + r2() * 0.2;
      kit.add(g, kit.rbox(0.05 + r2() * 0.05, hh, 0.02, 0.006), barkDark, [Math.cos(a) * 0.212, 0.06 + r2() * (0.38 - hh) + hh / 2, Math.sin(a) * 0.212], [0, -a + Math.PI / 2, 0]); } }
    phys.solidGroup(g);
  }

  // ------------------------------------------------------------------ art: B&W seascape (left wall) + blue diptych (right wall)
  {
    const sea = kit.canvasTex(1536, 1080, (g, w, h) => {
      const r = kit.rng(101); const hz = h * 0.40;
      const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#9c9c9c'); sky.addColorStop(0.55, '#c4c4c4'); sky.addColorStop(1, '#dedede');
      g.fillStyle = sky; g.fillRect(0, 0, w, hz);
      g.filter = 'blur(28px)'; for (let i = 0; i < 70; i++) { { const v = r() < 0.5 ? 90 + r() * 50 : 210 + r() * 40; g.fillStyle = `rgba(${v},${v},${v},0.16)`; } g.beginPath(); g.ellipse(r() * w, r() * hz * 0.9, 60 + r() * 260, 20 + r() * 60, 0, 0, 6.28); g.fill(); }
      g.filter = 'none'; const seaG = g.createLinearGradient(0, hz, 0, h); seaG.addColorStop(0, '#4a4a4a'); seaG.addColorStop(0.3, '#262626'); seaG.addColorStop(1, '#0c0c0c');
      g.fillStyle = seaG; g.fillRect(0, hz, w, h - hz);
      // wave chop: many small bright crests and dark troughs, scaled with distance
      for (let i = 0; i < 42000; i++) {
        const t = Math.pow(r(), 1.4); const y = hz + t * (h - hz); const s = 0.8 + t * 8;
        const v = r() < 0.38 ? 170 + r() * 85 : 6 + r() * 26;
        g.fillStyle = `rgba(${v},${v},${v},${0.45 + r() * 0.45})`;
        g.beginPath(); g.ellipse(r() * w, y, s * (2 + r() * 3), s * (0.4 + r() * 0.5), (r() - 0.5) * 0.4, 0, 6.28); g.fill();
      }
      g.fillStyle = 'rgba(235,235,235,0.6)'; g.fillRect(0, hz - 1, w, 2);
    });
    const art = kit.group(root, [3.75, 0, 13.30], Math.PI); // faces −z
    const AW = 2.90, AH = 2.05, y0 = 0.74;
    kit.add(art, kit.box(AW, AH, 0.05), black, [0, y0 + AH / 2, 0.025]);
    kit.add(art, kit.box(AW - 0.07, AH - 0.07, 0.004), std({ color: 0xf4f3ef, roughness: 0.9 }), [0, y0 + AH / 2, 0.052], [0, 0, 0], { shadow: false });
    sea.anisotropy = 16;
    const glassy = std({ map: sea, roughness: 0.4 });
    kit.add(art, new THREE.PlaneGeometry(AW - 0.30, AH - 0.30), glassy, [0, y0 + AH / 2, 0.055], [0, 0, 0], { shadow: false });

    const blueTex = (seed) => kit.canvasTex(512, 900, (g, w, h) => {
      const r = kit.rng(seed);
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1d4a6e'); bg.addColorStop(0.5, '#2a6585'); bg.addColorStop(1, '#173b5c');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const c = [[44, 110, 150], [14, 36, 66], [110, 170, 190], [60, 140, 140], [215, 228, 232], [30, 80, 120]][Math.floor(r() * 6)];
        g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.10 + r() * 0.25})`; g.filter = 'blur(3px)';
        g.save(); g.translate(r() * w, r() * h); g.rotate((r() - 0.5) * 0.8); g.fillRect(-60 - r() * 120, -6 - r() * 18, 120 + r() * 240, 12 + r() * 36); g.restore();
      }
      g.filter = 'none';
    });
    const dip = kit.group(root, [0, 0, 7.37], 0); // faces +z
    const frameM = std({ color: 0xd9cdb8, roughness: 0.6 });
    [[2.95, 61], [4.15, 62]].forEach(([x, seed]) => {
      kit.add(dip, kit.rbox(1.15, 1.85, 0.04, 0.004), std({ map: blueTex(seed), roughness: 0.7 }), [x, 0.95 + 0.925, 0.025]);
      // thin pale floater frame around each canvas
      for (const [fw, fh, fx, fy] of [[1.21, 0.02, 0, 0.935], [1.21, 0.02, 0, -0.935], [0.02, 1.89, 0.595, 0], [0.02, 1.89, -0.595, 0]])
        kit.add(dip, kit.box(fw, fh, 0.055), frameM, [x + fx, 0.95 + 0.925 + fy, 0.0275]);
    });
  }

  // ------------------------------------------------------------------ kentia palm (right foreground)
  {
    // potted kentia, ~2.6 m tall, 16 long arching fronds; pot sits just off-frame right of the right sofa's near end
    const P0 = V3(5.70, 0, 7.88);
    const potM = std({ color: 0xd9d3c8, roughness: 0.8, normalMap: kit.noiseNormal(128, 2, 16, 13) });
    const pg = kit.group(root, [P0.x, 0, P0.z], 0, 'palmPot');
    kit.add(pg, kit.lathe([[0, 0], [0.22, 0], [0.27, 0.12], [0.29, 0.50], [0.27, 0.52], [0, 0.48]], 40), potM, [0, 0, 0]);
    phys.boxLocal(pg, 0, 0.26, 0, 0.29, 0.26, 0.29);
    /* camera-only soft volume over the frond crown (the pot is the only solid part) */
    phys.camSoftAdd?.([P0.x, 1.85, P0.z + 0.25], [1.15, 0.75, 1.0]);
    const stemM = std({ color: 0x46552a, roughness: 0.6 });
    const leafM = std({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    // leaflet: long narrow blade folded along its midrib, local +x = length, +y = up face
    const lg = (() => {
      const n = 10, pos = [], idx = [];
      for (let i = 0; i <= n; i++) { const t = i / n; const wv = 0.010 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)); const sag = -0.06 * t * t;
        pos.push(t, sag, -wv, t, sag + 0.007, 0, t, sag, wv); }
      for (let i = 0; i < n; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    })();
    const r = kit.rng(55); const leaflets = []; const UP = V3(0, 1, 0);
    const NF = 22;
    for (let i = 0; i < NF; i++) {
      const az = (i / NF) * Math.PI * 2 + (r() - 0.5) * 0.35;
      const hb = 0.80 + r() * 0.95;            // petiole height above the soil
      const L = 1.0 + r() * 0.35;               // arching rachis length
      const out = V3(Math.cos(az), 0, Math.sin(az));
      if (out.z < 0) out.z = Math.max(out.z, -0.30 / (L + 0.3)); // street wall at z=7.37
      out.normalize();
      const a = V3(P0.x + out.x * 0.05, 0.48, P0.z + out.z * 0.05);
      const top = a.clone().addScaledVector(UP, hb).addScaledVector(out, 0.12 + hb * 0.12);
      const pts = [a, a.clone().addScaledVector(UP, hb * 0.55).addScaledVector(out, 0.05), top,
        top.clone().addScaledVector(out, L * 0.40).addScaledVector(UP, L * 0.28),
        top.clone().addScaledVector(out, L * 0.78).addScaledVector(UP, L * 0.16),
        top.clone().addScaledVector(out, L * 1.0).addScaledVector(UP, -L * 0.18)];
      const curve = new THREE.CatmullRomCurve3(pts);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.010, 5), stemM));
      const N = 34, t0 = 0.42;
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1); const t = t0 + u * (0.995 - t0); const p = curve.getPointAt(t); const T = curve.getTangentAt(t).normalize();
        const S = new THREE.Vector3().crossVectors(T, UP).normalize();
        const len = 0.40 * Math.sin(Math.PI * (0.12 + 0.82 * u)) + 0.09;
        for (const side of [-1, 1]) {
          const Ld = S.clone().multiplyScalar(side * 0.7).addScaledVector(T, 0.6).addScaledVector(UP, -0.45 - r() * 0.3).normalize();
          const Y = UP.clone().addScaledVector(Ld, -UP.dot(Ld)).normalize(); const Z = new THREE.Vector3().crossVectors(Ld, Y);
          const m4 = new THREE.Matrix4().makeBasis(Ld, Y, Z).scale(V3(len, 1, 1 + r() * 0.3)); m4.setPosition(p);
          leaflets.push(m4);
        }
      }
    }
    const im = new THREE.InstancedMesh(lg, leafM, leaflets.length);
    leaflets.forEach((m4, i) => { im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color().setHSL(0.27 + r() * 0.05, 0.38 + r() * 0.15, 0.04 + r() * r() * 0.10)); });
    im.castShadow = true; im.receiveShadow = true; root.add(im);
  }

  // ------------------------------------------------------------------ soft contact shadows under the furniture
  {
    const blob = kit.canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const shM = new THREE.MeshBasicMaterial({ map: blob, color: 0x2a2018, transparent: true, opacity: 0.6, depthWrite: false });
    const blobAt = (x, z, w, d, op = 0.6, ry = 0) => {
      const pg = new THREE.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2);
      const m = kit.add(root, pg, op === 0.6 ? shM : Object.assign(shM.clone(), { opacity: op }), [x, 0.013, z], [0, ry, 0], { shadow: false });
      m.renderOrder = 1;
    };
    blobAt(SX, 12.06, 2.95, 1.2, 0.6, -TOE); blobAt(SX, 9.10, 2.95, 1.2, 0.6, TOE);
    blobAt(6.08, ZC, 1.05, 1.0, 0.75); blobAt(1.78, ZC + 0.03, 1.05, 1.05, 0.7);
    blobAt(4.45, ZC, 1.9, 1.0, 0.5); blobAt(2.02, 9.62, 0.6, 0.6, 0.5);
  }

  // ------------------------------------------------------------------ window key light (2 non-shadow spots)
  // warm daylight raking in from the street-wall window (right of frame) and the two SW windows: gives the
  // velvet a directional sheen and the bouclé chair a lit side / shaded side instead of flat ambient.
  for (const [pos, tgt, I, ang] of [[[2.0, 2.55, 7.62], [4.6, 0.25, 11.9], 30, 0.85], [[0.95, 2.45, 10.6], [6.2, 0.35, 10.2], 10, 0.7]]) {
    const sp = new THREE.SpotLight(0xffe4c4, I, 10, ang, 1.0, 2); sp.castShadow = false;
    sp.position.set(...pos); sp.target.position.set(...tgt); sp.userData.keep = true; sp.target.userData.keep = true;
    root.add(sp, sp.target);
  }

  // ------------------------------------------------------------------ physics for small props, then merge
  root.updateMatrixWorld(true);
  for (const d of dynamicItems) phys.dynamic(d.m, { mass: d.mass, shape: d.shape || 'box' });
  kit.mergeStatic(root);
}
