// Piece: living — Formal living room, fireplace on the SW wall (x=0.65)
// Owned rooms: living | Reference photos: p03
// Room rect x 0.65..8.15, z 7.37..13.30. The photo looks from the foyer end (x≈8) toward the fireplace (−x);
// +z (family-room wall) is on the left of frame, −z (street wall) on the right.

export const piece = { rooms: ["living"], photos: ["p03"] };
export const ownCeiling = [];
// The foyer wall (x=8.15) stops the camera backing up further, so the seating group sits ~0.7 m nearer
// the fireplace instead (same framing as a camera 1.2 m further back).
// Photo geometry (far-wall floor/ceiling ratio, sofa tops at the horizon) puts the lens ~1.0 m high, ~6.9 m from the
// fireplace, centred on the room axis, looking very slightly up, wide (≈63° vertical).
export const views = { p03: { pos: [7.95, 1.12, 10.52], look: [0, 1.02, 10.56], fov: 60 } };

const ZC = 10.58; // fireplace / room axis (the photo is centred on it)

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx; const { M } = kit;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const physm = (o) => new THREE.MeshPhysicalMaterial(o);
  const R = kit.roomInfo('living');

  // ------------------------------------------------------------------ materials
  const velvetN = kit.tex('assets/ph/velour_velvet/velour_velvet_nor_gl_1k.jpg', { repeat: [3, 3] });
  const velvetR = kit.tex('assets/ph/velour_velvet/velour_velvet_rough_1k.jpg', { repeat: [3, 3] });
  // mottled crushed velvet: low-frequency olive/brown blotches + streaks (UVs are metres, repeat 1/1.6 m)
  const velvetMap = kit.canvasTex(512, 512, (g, w, h) => {
    const r = kit.rng(66); g.fillStyle = '#4b4836'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const v = r(); g.fillStyle = v < 0.5 ? `rgba(62,58,44,${0.15 + r() * 0.25})` : `rgba(${100 + r() * 20},${94 + r() * 16},${68 + r() * 10},${0.10 + r() * 0.2})`;
      g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.beginPath(); g.ellipse(0, 0, 10 + r() * 50, 4 + r() * 14, 0, 0, 6.28); g.fill(); g.restore();
    }
  }, { repeat: [0.6, 0.6] });
  const velvet = physm({ color: 0xe6dccb, map: velvetMap, roughness: 0.85, roughnessMap: velvetR, normalMap: velvetN, normalScale: new THREE.Vector2(0.5, 0.5),
    sheen: 0.85, sheenColor: new THREE.Color(0x9a9472), sheenRoughness: 0.4 });
  velvetN.repeat.set(2, 2); velvetR.repeat.set(2, 2);
  const boucleN = kit.tex('assets/ph/wool_boucle/wool_boucle_nor_gl_1k.jpg', { repeat: [7, 7] });
  const boucle = physm({ color: 0xd8cebd, roughness: 0.97, normalMap: boucleN, normalScale: new THREE.Vector2(1.1, 1.1),
    sheen: 0.3, sheenColor: new THREE.Color(0xeee4d4), sheenRoughness: 0.8 });
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
  const stone = std({ map: stoneTex, roughness: 0.82, normalMap: kit.noiseNormal(256, 1.2, 24, 9), normalScale: new THREE.Vector2(0.25, 0.25) });
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
    std({ color: 0xfbf8f2, roughness: 0.95, emissive: 0xfff8ee, emissiveIntensity: 0.22 }), [(R.rect[0] + R.rect[2]) / 2, 3.04, (R.rect[1] + R.rect[3]) / 2], [0, 0, 0], { shadow: false });
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
    kit.add(g, kit.rbox(2.64, 0.12, 0.52, 0.014), stone, [0, 0.37, 0.26]);
    // surround: two legs + chunky mantel beam
    const FW = 2.04, legW = 0.45, legD = 0.32;
    kit.add(g, kit.rbox(legW, 0.84, legD, 0.008), stone, [-(FW / 2 - legW / 2), 0.43 + 0.42, legD / 2]);
    kit.add(g, kit.rbox(legW, 0.84, legD, 0.008), stone, [(FW / 2 - legW / 2), 0.43 + 0.42, legD / 2]);
    kit.add(g, kit.rbox(FW + 0.06, 0.32, 0.46, 0.014), stone, [0, 1.27 + 0.16, 0.23]);
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
        g.strokeStyle = `rgba(126,108,90,${0.55 - k * 0.12})`; g.lineWidth = 5 - k;
        g.beginPath(); g.moveTo(cx, cy - 80 + k * 8); g.lineTo(cx + 56 - k * 6, cy); g.lineTo(cx, cy + 80 - k * 8); g.lineTo(cx - 56 + k * 6, cy); g.closePath(); g.stroke();
      }
      g.fillStyle = 'rgba(120,100,82,0.55)';
      for (let d = 0; d < 5; d++) { g.beginPath(); g.ellipse(cx, cy - 36 + d * 18, 9 - Math.abs(d - 2) * 2, 5, 0, 0, 6.28); g.fill(); }
      for (let j = 0; j < 40; j++) { g.fillStyle = 'rgba(221,210,194,0.5)'; g.fillRect(cx - 60 + r() * 120, cy - 84 + r() * 168, 6 + r() * 6, 1); }
    };
    motif(w / 2, h / 2); motif(0, 0); motif(w, 0); motif(0, h); motif(w, h);
  });
  const drapeMat = std({ map: drapeTex, roughness: 0.95, side: THREE.DoubleSide, normalMap: kit.noiseNormal(128, 1.5, 32, 21), normalScale: new THREE.Vector2(0.4, 0.4) });
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
    kit.add(g, kit.cyl(0.075, 0.08, 0.05, 32), blackMetal, [0, -0.025, 0]);
    // short slim downrod + flat low-profile motor: the fan hugs the ceiling, the chandelier hangs below it
    kit.add(g, kit.cyl(0.009, 0.009, 0.10, 12), blackMetal, [0, -0.07, 0]);
    kit.add(g, kit.lathe([[0, 0], [0.045, 0.004], [0.055, 0.02], [0.045, 0.04], [0, 0.044]], 32), blackMetal, [0, -0.165, 0]);
    const blades = kit.group(g, [0, -0.15, 0], 0); blades.userData.keep = true;
    for (let i = 0; i < 2; i++) { // two slim blades (seen edge-on as one thin line in the photo)
      const b = kit.group(blades, [0, 0, 0], Math.PI / 2 + i * Math.PI);
      kit.add(b, kit.rbox(0.62, 0.004, 0.04, 0.0015), black, [0.38, 0, 0], [0.05, 0, 0]);
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
    const im = new THREE.InstancedMesh(bg, beadWood, beads.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
    beads.forEach(([x, y, z, s], i) => { const ss = s * (0.85 + r() * 0.3); m4.compose(V3(x, y, z), q, V3(ss, ss, ss)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0xa38f78).multiplyScalar(0.8 + r() * 0.35)); });
    im.castShadow = true; g.add(im);
    // dim inner glow (bulbs inside the basket)
    kit.add(g, kit.sphere(0.06, 16, 10), std({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 1.2 }), [0, -0.76, 0], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ rug (faded vintage, under the seating)
  {
    // faded vintage oushak: muted taupe / grey with a hint of rose, low-contrast distressed pattern, soft fringe
    const RW = 4.2, RL = 5.9, RX = 4.70; // canvas long axis = world x
    const rugTex = kit.canvasTex(1024, 1768, (g, w, h) => {
      const r = kit.rng(44);
      g.fillStyle = '#8c7a68'; g.fillRect(0, 0, w, h);
      g.filter = 'blur(5px)';
      const band = (inset, wid, col) => { g.strokeStyle = col; g.lineWidth = wid; g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset); };
      band(18, 26, '#8f7766'); band(56, 50, '#a08f7c'); band(92, 14, '#93644d'); band(112, 24, '#ad9b86');
      for (let k = 0; k < 16; k++) {
        const along = 90 + k * (h - 180) / 15; g.fillStyle = 'rgba(150,96,72,0.28)';
        for (const x of [56, w - 56]) { g.beginPath(); g.ellipse(x, along, 14, 30, 0, 0, 6.28); g.fill(); }
        const ax = 90 + k * (w - 180) / 15; for (const y of [56, h - 56]) { g.beginPath(); g.ellipse(ax, y, 30, 14, 0, 0, 6.28); g.fill(); }
      }
      for (let y = 180; y < h - 160; y += 96) for (let x = 180 + ((y / 96) % 2) * 48; x < w - 160; x += 96) {
        g.fillStyle = (x + y) % 3 ? 'rgba(122,96,78,0.30)' : 'rgba(150,92,66,0.32)'; g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 15, y); g.lineTo(x, y + 24); g.lineTo(x - 15, y); g.fill();
      }
      g.save(); g.translate(w / 2, h / 2);
      const lob = (rx, ry, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.283; const k = 1 + 0.12 * Math.cos(a * 8); g.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k); } g.fill(); };
      lob(250, 380, 'rgba(168,150,130,0.45)'); lob(180, 280, 'rgba(150,96,70,0.38)'); lob(100, 160, 'rgba(170,155,136,0.45)'); lob(40, 64, 'rgba(110,80,64,0.45)');
      g.restore();
      g.filter = 'none';
      // wear: big pale abrash patches, horizontal worn streaks, then grey pile speckle
      for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(${178 + r() * 30},${168 + r() * 26},${156 + r() * 24},${0.06 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 180, 20 + r() * 80, r() * 3, 0, 6.28); g.fill(); }
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${185 + r() * 30},${178 + r() * 28},${168 + r() * 25},${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 6 + r() * 60, 1 + r() * 2); }
      for (let i = 0; i < 14000; i++) { const v = 120 + r() * 80; g.fillStyle = `rgba(${v + 10},${v},${v - 12},0.12)`; g.fillRect(r() * w, r() * h, 2, 1); }
    });
    const rugMat = std({ map: rugTex, roughness: 1, normalMap: kit.noiseNormal(256, 1.2, 64, 8), normalScale: new THREE.Vector2(0.45, 0.45) });
    const rg = new THREE.PlaneGeometry(RL, RW); rg.rotateX(-Math.PI / 2);
    const uv = rg.attributes.uv, p = rg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getZ(i) / RW) + 0.5, (p.getX(i) / RL) + 0.5);
    kit.add(root, rg, rugMat, [RX, 0.009, ZC], [0, 0, 0], { shadow: false });
    // soft cream fringe on the two short ends
    const fr = kit.canvasTex(512, 32, (g, w, h) => {
      const r = kit.rng(4); g.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x += 3) { g.strokeStyle = `rgba(${205 + r() * 30},${198 + r() * 28},${186 + r() * 25},${0.7 + r() * 0.3})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, h * (0.6 + r() * 0.4)); g.stroke(); }
    });
    const frM = std({ map: fr, transparent: true, alphaTest: 0.3, roughness: 1, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const fg = new THREE.PlaneGeometry(RW, 0.07); fg.rotateX(-Math.PI / 2); fg.rotateY(s * Math.PI / 2);
      kit.add(root, fg, frM, [RX + s * (RL / 2 + 0.035), 0.008, ZC], [0, 0, 0], { shadow: false });
    }
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
  const pillowTan = physm({ color: 0xd8cebe, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0xe0d2bd), normalMap: velvetN, normalScale: new THREE.Vector2(0.3, 0.3) });
  const pillowIkat = std({ map: ikatTex, roughness: 0.92 });
  const pillowCream = physm({ color: 0xe6ded0, roughness: 0.92, sheen: 0.3, sheenColor: new THREE.Color(0xf0e8da), normalMap: boucleN, normalScale: new THREE.Vector2(0.5, 0.5) });
  const pillowChar = physm({ color: 0x3a3a3c, roughness: 0.9, sheen: 0.4, sheenColor: new THREE.Color(0x8a8a90) });
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
  function sofa(pos, ry) {
    const L = 2.30, D = 0.95, H = 0.80, T = 0.30, Rc = 5.0;
    const rB = Rc + D / 2;                           // back face radius (local z = −D/2 on the axis)
    const aArm = (L / 2 - T / 2) / Rc;               // arm centre angle
    const g = kit.group(root, pos, ry, 'sofa');
    // recessed black plinth
    kit.add(g, crescent(Rc, rB - D + 0.22, rB - 0.22, aArm * 0.8, 0.03, 0.01), black, [0, 0, 0]);
    // deck under the seat cushion (its round ends hide inside the arms)
    kit.add(g, crescent(Rc, rB - D, rB - 0.10, (L / 2 - 0.45) / Rc, 0.33, 0.12), velvet, [0, 0.03, 0]);
    // barrel back: thick, very rounded top
    kit.add(g, crescent(Rc, rB - T, rB, aArm, H - 0.03, 0.14), velvet, [0, 0.03, 0]);
    // arms: full-depth tub ends with a big rounded top profile
    const armG = pillX(D, H - 0.03, T, 0.30, 0.09, 0.13);
    for (const s of [-1, 1]) kit.add(g, armG, velvet, [s * Rc * Math.sin(aArm), 0.03, Rc - Rc * Math.cos(aArm)], [0, -s * aArm, 0]);
    // thick seat cushion between the arms (top ≈ 0.49 m), slightly crowned
    kit.add(g, kit.cushion(L - 2 * T + 0.04, 0.15, D - T - 0.02, 0.07, 0.03, 6), velvet, [0, 0.415, (T - 0.02) / 2 + 0.01]);
    // colliders: base+seat, back, arms
    phys.boxLocal(g, 0, 0.25, 0.05, L / 2, 0.25, D / 2);
    phys.boxLocal(g, 0, 0.65, -D / 2 + T / 2, L / 2, 0.15, T / 2);
    return g;
  }
  // left sofa (z≈12.0) faces −z; right sofa (z≈9.15) faces +z. Pillows sit at the fireplace end.
  // long, gently curved, parallel to the room axis (photo: 2.4 m, near ends ~2.6 m from the lens)
  const SX = 3.95;
  const sL = sofa([SX, 0, 12.22], Math.PI);
  const sR = sofa([SX, 0, 8.92], 0);
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
    // puffy two-lobed base, seat cushion, and a U-shaped tub back/arms with soft rounded top edges
    kit.add(g, kit.cyl(0.34, 0.35, 0.28, 40), boucle, [0, 0.16, 0.0]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; kit.add(g, kit.sphere(0.27, 28, 16), boucle, [Math.cos(a) * 0.15, 0.175, Math.sin(a) * 0.15]).scale.set(1, 0.65, 1); }
    kit.add(g, kit.cushion(0.54, 0.12, 0.54, 0.06, 0.035, 6), boucle, [0, 0.36, 0.09]);
    const U = new THREE.Shape(); const ro = 0.42, ri = 0.24, zf = 0.40, zb = 0.0; // shape (x, −z)
    U.moveTo(ro, -zf); U.lineTo(ro, -zb); U.absarc(0, -zb, ro, 0, Math.PI, false); U.lineTo(-ro, -zf);
    U.lineTo(-ri, -zf); U.lineTo(-ri, -zb); U.absarc(0, -zb, ri, Math.PI, 0, true); U.lineTo(ri, -zf); U.lineTo(ro, -zf);
    const ug = new THREE.ExtrudeGeometry(U, { depth: 0.22, bevelEnabled: true, bevelSize: 0.075, bevelThickness: 0.085, bevelSegments: 6, curveSegments: 32 });
    ug.rotateX(-Math.PI / 2); ug.scale(1, 1, 0.92);
    kit.add(g, ug, boucle, [0, 0.33, -0.02]);
    phys.boxLocal(g, 0, 0.245, 0, 0.43, 0.245, 0.41);
    phys.boxLocal(g, 0, 0.6, -0.30, 0.43, 0.14, 0.13);
    return g;
  }
  chair([5.50, 0, ZC], -Math.PI / 2, 0.98);       // foreground, back to camera, facing the fireplace
  const cBack = chair([1.78, 0, ZC + 0.03], Math.PI / 2, 0.98); // by the hearth, facing the room
  pillow(cBack, 0.46, 0.30, pillowChar, [0, 0.63, -0.12], [-0.25, 0, 0]);

  // ------------------------------------------------------------------ oval dark-wood coffee table + decor
  {
    // low oval live-edge slab (1.3 x 0.84 m, 0.40 m tall), mid-brown, on a recessed dark oval plinth
    const TX = 4.25;
    const g = kit.group(root, [TX, 0, ZC], 0, 'coffeeTable');
    const midWood = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0x3b2d23, roughness: 0.5 });
    const sh = new THREE.Shape(); const er = kit.rng(23); const n = 72;
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const k = 1 + 0.025 * Math.sin(t * 7 + 1) + 0.015 * Math.sin(t * 13) + (er() - 0.5) * 0.012;
      const x = Math.cos(t) * 0.70 * k, y = Math.sin(t) * 0.36 * k; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
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
    phys.solidGroup(g);
  }

  // ------------------------------------------------------------------ art: B&W seascape (left wall) + blue diptych (right wall)
  {
    const sea = kit.canvasTex(1536, 1080, (g, w, h) => {
      const r = kit.rng(101); const hz = h * 0.60;
      const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#cfcfcf'); sky.addColorStop(0.6, '#e2e2e2'); sky.addColorStop(1, '#f2f2f2');
      g.fillStyle = sky; g.fillRect(0, 0, w, hz);
      for (let i = 0; i < 70; i++) { { const v = 170 + r() * 80; g.fillStyle = `rgba(${v},${v},${v},0.14)`; } g.beginPath(); g.ellipse(r() * w, r() * hz * 0.9, 60 + r() * 260, 20 + r() * 60, 0, 0, 6.28); g.fill(); }
      const seaG = g.createLinearGradient(0, hz, 0, h); seaG.addColorStop(0, '#6a6a6a'); seaG.addColorStop(0.3, '#3a3a3a'); seaG.addColorStop(1, '#141414');
      g.fillStyle = seaG; g.fillRect(0, hz, w, h - hz);
      // wave chop: many small bright crests and dark troughs, scaled with distance
      for (let i = 0; i < 42000; i++) {
        const t = Math.pow(r(), 1.4); const y = hz + t * (h - hz); const s = 0.8 + t * 8;
        const v = r() < 0.55 ? 200 + r() * 55 : 10 + r() * 30;
        g.fillStyle = `rgba(${v},${v},${v},${0.45 + r() * 0.45})`;
        g.beginPath(); g.ellipse(r() * w, y, s * (2 + r() * 3), s * (0.4 + r() * 0.5), (r() - 0.5) * 0.4, 0, 6.28); g.fill();
      }
      g.fillStyle = 'rgba(235,235,235,0.6)'; g.fillRect(0, hz - 1, w, 2);
    });
    const art = kit.group(root, [3.35, 0, 13.30], Math.PI); // faces −z
    const AW = 2.70, AH = 1.90, y0 = 0.80;
    kit.add(art, kit.box(AW, AH, 0.05), black, [0, y0 + AH / 2, 0.025]);
    kit.add(art, kit.box(AW - 0.07, AH - 0.07, 0.004), std({ color: 0xf4f3ef, roughness: 0.9 }), [0, y0 + AH / 2, 0.052], [0, 0, 0], { shadow: false });
    sea.anisotropy = 16;
    const glassy = std({ map: sea, roughness: 0.4 });
    kit.add(art, new THREE.PlaneGeometry(AW - 0.30, AH - 0.30), glassy, [0, y0 + AH / 2, 0.055], [0, 0, 0], { shadow: false });

    const blueTex = (seed) => kit.canvasTex(512, 900, (g, w, h) => {
      const r = kit.rng(seed);
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#13283d'); bg.addColorStop(0.55, '#1c3d55'); bg.addColorStop(1, '#0d2033');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const c = [[44, 92, 128], [16, 40, 70], [90, 140, 165], [60, 120, 120], [210, 222, 228], [32, 70, 100]][Math.floor(r() * 6)];
        g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.06 + r() * 0.18})`; g.filter = 'blur(6px)';
        g.save(); g.translate(r() * w, r() * h); g.rotate((r() - 0.5) * 0.8); g.fillRect(-60 - r() * 120, -6 - r() * 18, 120 + r() * 240, 12 + r() * 36); g.restore();
      }
      g.filter = 'none';
    });
    const dip = kit.group(root, [0, 0, 7.37], 0); // faces +z
    [[2.95, 61], [4.15, 62]].forEach(([x, seed]) => kit.add(dip, kit.rbox(1.15, 1.85, 0.04, 0.004), std({ map: blueTex(seed), roughness: 0.75 }), [x, 0.95 + 0.925, 0.02]));
  }

  // ------------------------------------------------------------------ kentia palm (right foreground)
  {
    // potted kentia, ~2.6 m tall, 16 long arching fronds; pot sits just off-frame right of the right sofa's near end
    const P0 = V3(5.85, 0, 8.02);
    const potM = std({ color: 0xd9d3c8, roughness: 0.8, normalMap: kit.noiseNormal(128, 2, 16, 13) });
    const pg = kit.group(root, [P0.x, 0, P0.z], 0, 'palmPot');
    kit.add(pg, kit.lathe([[0, 0], [0.22, 0], [0.27, 0.12], [0.29, 0.50], [0.27, 0.52], [0, 0.48]], 40), potM, [0, 0, 0]);
    phys.boxLocal(pg, 0, 0.26, 0, 0.29, 0.26, 0.29);
    const stemM = std({ color: 0x46552a, roughness: 0.6 });
    const leafM = std({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    // leaflet: long narrow blade folded along its midrib, local +x = length, +y = up face
    const lg = (() => {
      const n = 10, pos = [], idx = [];
      for (let i = 0; i <= n; i++) { const t = i / n; const wv = 0.016 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)); const sag = -0.06 * t * t;
        pos.push(t, sag, -wv, t, sag + 0.007, 0, t, sag, wv); }
      for (let i = 0; i < n; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    })();
    const r = kit.rng(55); const leaflets = []; const UP = V3(0, 1, 0);
    const NF = 16;
    for (let i = 0; i < NF; i++) {
      const az = (i / NF) * Math.PI * 2 + (r() - 0.5) * 0.35;
      const hb = 0.75 + r() * 1.05;            // petiole height above the soil
      const L = 1.2 + r() * 0.4;               // arching rachis length
      const out = V3(Math.cos(az), 0, Math.sin(az));
      if (out.z < 0) out.z = Math.max(out.z, -0.42 / (L + 0.3)); // street wall at z=7.37
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
        const len = 0.50 * Math.sin(Math.PI * (0.12 + 0.82 * u)) + 0.12;
        for (const side of [-1, 1]) {
          const Ld = S.clone().multiplyScalar(side * 0.7).addScaledVector(T, 0.6).addScaledVector(UP, -0.45 - r() * 0.3).normalize();
          const Y = UP.clone().addScaledVector(Ld, -UP.dot(Ld)).normalize(); const Z = new THREE.Vector3().crossVectors(Ld, Y);
          const m4 = new THREE.Matrix4().makeBasis(Ld, Y, Z).scale(V3(len, 1, 1 + r() * 0.3)); m4.setPosition(p);
          leaflets.push(m4);
        }
      }
    }
    const im = new THREE.InstancedMesh(lg, leafM, leaflets.length);
    leaflets.forEach((m4, i) => { im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color().setHSL(0.28 + r() * 0.03, 0.42, 0.065 + r() * 0.06)); });
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
    const blobAt = (x, z, w, d, op = 0.6) => {
      const pg = new THREE.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2);
      const m = kit.add(root, pg, op === 0.6 ? shM : Object.assign(shM.clone(), { opacity: op }), [x, 0.013, z], [0, 0, 0], { shadow: false });
      m.renderOrder = 1;
    };
    blobAt(SX, 12.22, 2.6, 1.25); blobAt(SX, 8.92, 2.6, 1.25);
    blobAt(5.50, ZC, 1.1, 1.1, 0.7); blobAt(1.78, ZC + 0.03, 1.05, 1.05, 0.7);
    blobAt(4.25, ZC, 1.7, 0.95, 0.5); blobAt(2.02, 9.62, 0.6, 0.6, 0.5);
  }

  // ------------------------------------------------------------------ physics for small props, then merge
  root.updateMatrixWorld(true);
  for (const d of dynamicItems) phys.dynamic(d.m, { mass: d.mass, shape: d.shape || 'box' });
  kit.mergeStatic(root);
}
