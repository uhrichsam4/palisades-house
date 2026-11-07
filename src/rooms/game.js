// Piece: game — Game room in the front turret (3-window bay)
// Owned rooms: game | Reference photos: p33
// p33: neon script sign "This must be the place" on the SW wall (x=5.31), vintage black/brass popcorn
// cart, black console with candy jars + striped popcorn boxes, black velour beanbag, black/cream
// checkered wool rug, three black roller shades in the turret bay.
export const piece = { rooms: ["game"], photos: ["p33"] };
export const ownCeiling = [];
export const views = {
  p33: { pos: [7.70, 1.22, 7.10], look: [5.85, 1.12, 4.90], fov: 70 },
};

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M, add, group, rbox, cyl, sphere, lathe, tube, canvasTex, rng, tex, pbrMaps } = kit;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const physm = (o) => new THREE.MeshPhysicalMaterial(o);
  const R = kit.roomInfo('game');
  const X0 = R.x0, X1 = R.x1, Z1 = R.z1, ZF = R.z0; // ZF = front (street) wall face 4.73
  const Y = R.y, CEIL = R.ceil;

  // ---------------------------------------------------------------- bay geometry (interior faces)
  // Outer faces from plan.EXT[0]; interior faces are 0.30 inward. Corners computed by intersection.
  const T = ctx.plan.EXT_T;
  const outer = [[5.01, 4.43], [5.60, 4.43], [6.10, 3.53], [7.40, 3.53], [7.90, 4.43], [11.12, 4.43]];
  const lines = []; // interior lines: point + dir + inward normal
  for (let i = 0; i < outer.length - 1; i++) {
    const [ax, az] = outer[i], [bx, bz] = outer[i + 1]; const L = Math.hypot(bx - ax, bz - az);
    const u = [(bx - ax) / L, (bz - az) / L]; let n = [-u[1], u[0]]; if (n[1] < 0) n = [-n[0], -n[1]]; // inward = +z side
    lines.push({ p: [ax + n[0] * T, az + n[1] * T], u, n, outerMid: [(ax + bx) / 2, (az + bz) / 2] });
  }
  const isect = (A, B) => { const d = A.u[0] * B.u[1] - A.u[1] * B.u[0]; const dx = B.p[0] - A.p[0], dz = B.p[1] - A.p[1]; const t = (dx * B.u[1] - dz * B.u[0]) / d; return [A.p[0] + A.u[0] * t, A.p[1] + A.u[1] * t]; };
  const C = [[X0, ZF]]; for (let i = 0; i < lines.length - 1; i++) C.push(isect(lines[i], lines[i + 1])); C.push([X1, ZF]);
  // C = [(5.31,4.73), C1, C2, C3, C4, (8.15,4.73)] ; facets 1..3 are lines[1..3] between C[1..4]

  // ---------------------------------------------------------------- baseboards (tall, painted)
  const bbH = 0.125, bbT = 0.014;
  const baseSeg = (a, b, n) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.02) return;
    const m = add(root, new THREE.BoxGeometry(L + 0.004, bbH, bbT), M.paintWhite, [(a[0] + b[0]) / 2 + n[0] * bbT / 2, Y + bbH / 2, (a[1] + b[1]) / 2 + n[1] * bbT / 2], [0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]);
    m.castShadow = false;
    const cap = add(root, new THREE.BoxGeometry(L + 0.004, 0.012, bbT + 0.006), M.paintWhite, [(a[0] + b[0]) / 2 + n[0] * (bbT + 0.006) / 2, Y + bbH - 0.006, (a[1] + b[1]) / 2 + n[1] * (bbT + 0.006) / 2], [0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]);
    cap.castShadow = false;
  };
  for (let i = 0; i < C.length - 1; i++) baseSeg(C[i], C[i + 1], i === 0 || i === C.length - 2 ? [0, 1] : lines[i].n);
  baseSeg([X0, ZF], [X0, Z1], [1, 0]);
  baseSeg([X0, Z1], [X1, Z1], [0, -1]);
  const door = ctx.plan.OPENINGS.find(o => o.id === 'game-d');
  const dz0 = door.at[1] - door.w / 2 - 0.06, dz1 = door.at[1] + door.w / 2 + 0.06;
  baseSeg([X1, ZF], [X1, dz0], [-1, 0]); baseSeg([X1, dz1], [X1, Z1], [-1, 0]);

  // recessed cans (warm), one over the bay, two along the room
  const cream = M.paintWhite.clone(); cream.color.set(0xdedad5); // light warm grey-white
  // warm ceiling skin over room + bay (the slab underside reads cool grey here)
  {
    const sh = new THREE.Shape(); const poly = [...C, [X1, Z1], [X0, Z1]];
    poly.forEach(([x, z], i) => i ? sh.lineTo(x, z) : sh.moveTo(x, z));
    const cg = new THREE.ShapeGeometry(sh); cg.rotateX(Math.PI / 2);
    const ceilMat = M.paintWhite.clone(); ceilMat.color.set(0xeeebe8); ceilMat.side = THREE.DoubleSide; ceilMat.emissive = new THREE.Color(0xeeeae6); ceilMat.emissiveIntensity = 0.08;
    add(root, cg, ceilMat, [0, CEIL - 0.006, 0], [0, 0, 0], { shadow: false, name: 'gameCeil' });
  }
  kit.canLights(root, [[6.75, 4.30], [6.20, 6.20], [7.40, 6.20]], CEIL - 0.006);

  // ---------------------------------------------------------------- warm cream/greige paint (p33 walls ≈ #e9e1d9)
  // flat walls: SW (console) wall, back wall, NE wall around the door
  kit.wallPanel(root, [X0, Z1], [X0, ZF], Y, CEIL, [1, 0], cream);
  kit.wallPanel(root, [X1, Z1], [X0, Z1], Y, CEIL, [0, -1], cream);
  kit.wallPanel(root, [X1, ZF], [X1, dz0], Y, CEIL, [-1, 0], cream.clone().setValues({ color: new THREE.Color(0xd4cfca) }));
  kit.wallPanel(root, [X1, dz1], [X1, Z1], Y, CEIL, [-1, 0], cream);
  kit.wallPanel(root, [X1, dz0], [X1, dz1], Y + door.head + 0.07, CEIL, [-1, 0], cream);
  // short front-wall returns either side of the bay (bay-side faces catch more light: deeper paint)
  const bayPaint = cream.clone(); bayPaint.color.set(0xcbc6c0);
  kit.wallPanel(root, C[0], C[1], Y, CEIL, [0, 1], bayPaint);
  kit.wallPanel(root, C[4], C[5], Y, CEIL, [0, 1], bayPaint);

  // ---------------------------------------------------------------- bay faces: paint around each window,
  // white-trimmed openings, inside-mount matte black roller shades, boxed black cassette valances
  const shadeFab = std({ color: 0x0b0b0c, roughness: 1.0, envMapIntensity: 0.15, normalMap: tex('assets/ph/hessian_380/hessian_380_nor_gl_1k.jpg', { repeat: [5, 7] }), normalScale: new THREE.Vector2(0.18, 0.18) });
  const cassetteMat = std({ color: 0x1a1918, roughness: 0.95, metalness: 0.0, normalMap: shadeFab.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }); // fabric-wrapped valance
  const hemMat = std({ color: 0x0e0e0e, roughness: 0.5, metalness: 0.3 });
    for (const [id, li] of [['game-b1', 1], ['game-b2', 2], ['game-b3', 3]]) {
    const o = ctx.plan.OPENINGS.find(q => q.id === id); const Ln = lines[li];
    const cx = o.at[0] + Ln.n[0] * T, cz = o.at[1] + Ln.n[1] * T; // opening centre on interior face
    const ry = -Math.atan2(Ln.u[1], Ln.u[0]);
    const g = group(root, [cx, Y, cz], ry, 'bay:' + id); // local x along wall, local +z = into room
    const ax = (C[li][0] - cx) * Ln.u[0] + (C[li][1] - cz) * Ln.u[1];
    const bx = (C[li + 1][0] - cx) * Ln.u[0] + (C[li + 1][1] - cz) * Ln.u[1];
    const hw = o.w / 2, sill = o.sill, head = o.head;
    // paint: below sill, above head, both side strips
    const pnl = (x0, x1, y0, y1) => { if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return; add(g, new THREE.PlaneGeometry(x1 - x0, y1 - y0), bayPaint, [(x0 + x1) / 2, (y0 + y1) / 2, 0.004], [0, 0, 0], { shadow: false }); };
    pnl(ax, bx, 0, sill); pnl(ax, bx, head, CEIL - Y); pnl(ax, -hw, sill, head); pnl(hw, bx, sill, head);
    // reveal liners (painted white, 0.24 deep) so the opening reads as a clean white box
    // drywall returns (painted like the wall, square corners, no casing) so each opening is its own recess
    const dep = 0.24;
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.012, head - sill, dep), cream, [s * (hw - 0.006), (sill + head) / 2, -dep / 2], [0, 0, 0], { shadow: false });
    add(g, new THREE.BoxGeometry(o.w, 0.012, dep), cream, [0, head - 0.006, -dep / 2], [0, 0, 0], { shadow: false });
    add(g, new THREE.BoxGeometry(o.w, 0.02, dep), cream, [0, sill - 0.01, -dep / 2], [0, 0, 0], { shadow: false });
    // inside-mount shade from the valance down to ~1.05 m above the floor
    const sTop = head - 0.15, sBot = sill + 0.035;
    add(g, new THREE.PlaneGeometry(o.w - 0.02, sTop - sBot), shadeFab, [0, (sTop + sBot) / 2, -0.06], [0, 0, 0], { shadow: false });
    add(g, rbox(o.w - 0.02, 0.022, 0.016, 0.005), hemMat, [0, sBot + 0.011, -0.055]);
    // per-window boxed black valance (0.15 tall) filling the top of the recess, slightly proud of the wall
    add(g, rbox(o.w + 0.03, 0.15, 0.12, 0.006), cassetteMat, [0, head - 0.075, -0.03]);
  }

  // ---------------------------------------------------------------- neon sign on the SW wall
  // One tight script composition ~1.5 x 0.8 m centred over the console: "This" top-left, "must" to
  // its right, "be the place" below. 12 mm pink-lavender tubes (#f0a8ff) on a clear acrylic backer.
  const CON_Z = 5.48; // console centre (world z)
  {
    const W = 1.75, H = 0.95, PX = 900; // px per metre
    const cw = Math.round(W * PX), ch = Math.round(H * PX);
    const fonts = `'Bradley Hand', 'Snell Roundhand', 'Segoe Script', cursive`; // near-monoline hand script
    const words = [
      { t: 'This', x: 0.05, y: 0.33, s: 0.34 },
      { t: 'must', x: 0.70, y: 0.42, s: 0.22 },
      { t: 'be the place', x: 0.36, y: 0.76, s: 0.235 },
    ];
    const setFont = (g, w) => { g.font = `700 ${Math.round(w.s * W / 1.5 * PX)}px ${fonts}`; g.textBaseline = 'alphabetic'; };
    const neonMap = canvasTex(cw, ch, (g) => {
      g.clearRect(0, 0, cw, ch);
      // clear acrylic backer: faint fill + a thin bright edge hugging the words
      const off = document.createElement('canvas'); off.width = cw; off.height = ch; const o = off.getContext('2d');
      o.lineJoin = 'round'; o.lineCap = 'round';
      for (const w of words) { setFont(o, w); const X = w.x * W / 1.5 * PX, Yp = w.y * H / 0.85 * PX; o.strokeStyle = '#fff'; o.lineWidth = 50; o.strokeText(w.t, X, Yp); o.fillStyle = '#fff'; o.fillText(w.t, X, Yp); }
      const ring = document.createElement('canvas'); ring.width = cw; ring.height = ch; const r = ring.getContext('2d');
      r.drawImage(off, 0, 0); r.globalCompositeOperation = 'destination-out'; r.drawImage(off, 3, 3); r.drawImage(off, -3, -3); r.drawImage(off, 3, -3); r.drawImage(off, -3, 3);
      g.globalAlpha = 0.06; g.drawImage(off, 0, 0); g.globalAlpha = 0.45; g.drawImage(ring, 0, 0); g.globalAlpha = 1;
      g.lineJoin = 'round'; g.lineCap = 'round';
      // glow halo around thin glyphs (fills, so each stroke reads as one tube, not an outline)
      for (const [blur, a] of [[34, 0.55], [12, 0.85]]) {
        g.shadowColor = `rgba(226,110,255,${a})`; g.shadowBlur = blur;
        for (const w of words) { setFont(g, w); g.fillStyle = `rgba(236,150,255,${a})`; g.fillText(w.t, w.x * W / 1.5 * PX, w.y * H / 0.85 * PX); }
      }
      g.shadowBlur = 0;
      for (const w of words) {
        setFont(g, w);
        g.fillStyle = '#f7c8ff'; g.fillText(w.t, w.x * W / 1.5 * PX, w.y * H / 0.85 * PX);
      }
    });
    neonMap.wrapS = neonMap.wrapT = THREE.ClampToEdgeWrapping;
    const neonMat = new THREE.MeshBasicMaterial({ map: neonMap, transparent: true, depthWrite: false, toneMapped: false });
    neonMat.color.setScalar(1.7); // > 1 so post bloom picks it up
    const zc = CON_Z + 0.22, yc = 2.02; // sign centre on the wall
    const sign = add(root, new THREE.PlaneGeometry(W, H), neonMat, [X0 + 0.03, yc, zc], [0, Math.PI / 2, 0], { shadow: false, name: 'neon' });
    sign.renderOrder = 3;
    // soft pink wash on the wall around the sign
    const wash = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(225,130,255,0.16)'); gr.addColorStop(0.5, 'rgba(225,130,255,0.06)'); gr.addColorStop(1, 'rgba(225,130,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
    const washMat = new THREE.MeshBasicMaterial({ map: wash, transparent: true, depthWrite: false });
    add(root, new THREE.PlaneGeometry(2.4, 1.6), washMat, [X0 + 0.012, yc, zc], [0, Math.PI / 2, 0], { shadow: false, name: 'neonWash' }).renderOrder = 2;
    // thin silver power cords dropping from the words to the console top
    const cordMat = std({ color: 0xcfd0d4, roughness: 0.35, metalness: 0.7 });
    const wx = (u) => zc + W / 2 - u * W / 1.5; // canvas x (m, authored at 1.5 m) -> world z
    const wy = (v) => yc + H / 2 - v * H / 0.85;
    const cords = [
      [[0.20, 0.36], [0.24, 0.62], [0.36, 0.95], [0.44, 1.30]],
      [[0.82, 0.44], [0.74, 0.70], [0.62, 1.05], [0.58, 1.30]],
      [[0.55, 0.80], [0.60, 1.05], [0.66, 1.30]],
      [[1.25, 0.80], [1.05, 1.02], [0.80, 1.30]],
    ];
    for (const c of cords) {
      const pts = c.map(([u, v]) => [X0 + 0.014, wy(v), wx(u)]);
      pts.push([X0 + 0.02, Y + 0.86, pts[pts.length - 1][2]]);
      const m = add(root, tube(pts, 0.0022, 40), cordMat, [0, 0, 0]); m.castShadow = false;
    }
  }

  // ---------------------------------------------------------------- console table + candy bar
  const blackWood = std({ color: 0x151414, roughness: 0.42, metalness: 0.0, ...pbrMaps('white_oak_veneer', '1k', { repeat: [2, 2] }), map: null, normalScale: new THREE.Vector2(0.15, 0.15) });
  blackWood.map = null;
  const chromeBar = M.brushedNickel;
  const glassMat = physm({ color: 0xffffff, roughness: 0.03, transmission: 0.0, transparent: true, opacity: 0.22, metalness: 0, ior: 1.5, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const consoleL = 1.32, consoleD = 0.40, consoleH = 0.85;
  const cons = group(root, [X0 + consoleD / 2 + 0.01, Y, CON_Z], Math.PI / 2, 'console'); // local +z -> world +x (front)
  {
    add(cons, rbox(consoleL, 0.035, consoleD, 0.008), blackWood, [0, consoleH - 0.0175, 0]);
    const legW = 0.045;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cons, rbox(legW, consoleH - 0.035, legW, 0.006), blackWood, [sx * (consoleL / 2 - 0.04), (consoleH - 0.035) / 2, sz * (consoleD / 2 - 0.035)]);
    // drawer case + three drawers
    add(cons, new THREE.BoxGeometry(consoleL - 0.08, 0.15, consoleD - 0.06), blackWood, [0, consoleH - 0.035 - 0.075, -0.005]);
    const dw = (consoleL - 0.08 - 0.02) / 3;
    for (let i = 0; i < 3; i++) {
      const x = -consoleL / 2 + 0.04 + 0.01 + dw * (i + 0.5);
      add(cons, rbox(dw - 0.01, 0.125, 0.02, 0.004), blackWood, [x, consoleH - 0.035 - 0.075, consoleD / 2 - 0.03]);
      add(cons, rbox(0.11, 0.011, 0.012, 0.004), chromeBar, [x, consoleH - 0.035 - 0.075, consoleD / 2 - 0.012]);
      for (const s of [-1, 1]) add(cons, new THREE.BoxGeometry(0.01, 0.01, 0.018), chromeBar, [x + s * 0.05, consoleH - 0.035 - 0.075, consoleD / 2 - 0.02]);
    }
    // bottom shelf
    add(cons, rbox(consoleL - 0.03, 0.03, consoleD - 0.03, 0.006), blackWood, [0, 0.13, 0]);
    // power strip on the bottom shelf, cords
    add(cons, rbox(0.25, 0.03, 0.05, 0.008), std({ color: 0x222222, roughness: 0.5 }), [-0.45, 0.16, -0.12]);
  }
  phys.solidGroup(cons);

  // popcorn boxes: red/white vertical stripes, tapered
  const stripeTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#fbf7f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d81e2a'; for (let i = 0; i < 16; i++) if (i % 2 === 0) g.fillRect(i * w / 16, h * 0.16, w / 16, h * 0.84);
    g.fillStyle = '#d81e2a'; g.fillRect(0, h * 0.06, w, h * 0.04);
  });
  const boxMat = std({ map: stripeTex, roughness: 0.65, side: THREE.DoubleSide });
  const boxGeo = new THREE.CylinderGeometry(0.068, 0.048, 0.15, 4, 1, true); boxGeo.rotateY(Math.PI / 4);
  const boxBase = new THREE.CircleGeometry(0.048, 4); boxBase.rotateX(Math.PI / 2); boxBase.rotateY(Math.PI / 4); boxBase.translate(0, -0.075, 0);
  const popTex = canvasTex(64, 64, (g) => { const r = rng(5); g.fillStyle = '#f2e3b6'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 120; i++) { g.fillStyle = r() < 0.5 ? '#fff6dc' : '#e7c97c'; g.beginPath(); g.arc(r() * 64, r() * 64, 2 + r() * 4, 0, 7); g.fill(); } });
  const popMat = std({ map: popTex, roughness: 0.9 });
  const popTop = new THREE.SphereGeometry(0.062, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); popTop.scale(1, 0.5, 1); popTop.rotateY(Math.PI / 4);
  for (let i = 0; i < 7; i++) {
    const z = CON_Z + 0.50 - i * 0.165; const x = X0 + 0.21 + ((i % 2) ? 0.025 : -0.01);
    const b = group(root, [x, Y + 0.145 + 0.075, z], 0.1 * Math.sin(i * 2.1), 'popbox');
    add(b, boxGeo, boxMat); add(b, boxBase, boxMat);
    if (i % 3 !== 1) add(b, popTop, popMat, [0, 0.07, 0]);
    if (i === 0 || i === 3 || i === 6) phys.dynamic(b, { mass: 0.08, shape: 'box' });
  }

  // apothecary candy jars on top
  const jarProfile = (r, h) => lathe([[0.001, 0], [r * 0.82, 0], [r, 0.012], [r, h - 0.03], [r * 0.82, h - 0.012], [r * 0.6, h - 0.005], [r * 0.6, h]], 40);
  const lidMat = physm({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 });
  const candyTex = (seed, cols) => canvasTex(128, 128, (g) => { const r = rng(seed); g.fillStyle = cols[0]; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 260; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.arc(r() * 128, r() * 128, 3 + r() * 6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(r() * 128, r() * 128, 1.5, 0, 7); g.fill(); } });
  const jars = [
    { z: CON_Z + 0.52, r: 0.052, h: 0.14, fill: 0.55, cols: ['#c4182a', '#f2f2f2', '#e8405a'] },
    { z: CON_Z + 0.36, r: 0.065, h: 0.22, fill: 0.45, cols: ['#b8101f', '#e0283a', '#f4efe6'] },
    { z: CON_Z + 0.20, r: 0.05, h: 0.12, fill: 0.6, cols: ['#d01a2c', '#c62b3b', '#f0f0f0'] },
    { z: CON_Z + 0.04, r: 0.075, h: 0.25, fill: 0.62, cols: ['#d0102a', '#b80c22', '#ff4a5a'] },
    { z: CON_Z - 0.14, r: 0.058, h: 0.18, fill: 0.5, cols: ['#c8162a', '#f1e7d4', '#9a0f1d'] },
  ];
  jars.forEach((j, i) => {
    const g = group(root, [X0 + 0.16 + (i % 2) * 0.05, Y + consoleH, j.z], 0, 'jar');
    add(g, jarProfile(j.r, j.h), glassMat, [0, 0, 0], [0, 0, 0], { shadow: false }).renderOrder = 4;
    const fillM = std({ map: candyTex(30 + i, j.cols), roughness: 0.35 });
    add(g, cyl(j.r * 0.93, j.r * 0.93, j.h * j.fill, 28), fillM, [0, 0.006 + j.h * j.fill / 2, 0]);
    // glass lid with knob
    add(g, cyl(j.r * 0.68, j.r * 0.68, 0.012, 28), lidMat, [0, j.h + 0.006, 0], [0, 0, 0], { shadow: false });
    add(g, sphere(0.014, 16, 10), lidMat, [0, j.h + 0.02, 0], [0, 0, 0], { shadow: false });
    if (i === 1 || i === 3) phys.dynamic(g, { mass: 0.6, shape: 'box' });
  });
  // gumballs mounded in the big red jar
  {
    const j = jars[3]; const n = 70; const r = rng(77);
    const im = new THREE.InstancedMesh(sphere(0.012, 10, 8), std({ color: 0xd3132b, roughness: 0.25 }), n);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * j.r * 0.8; mtx.makeTranslation(X0 + 0.16 + 0.05 + Math.cos(a) * rr, Y + consoleH + 0.006 + j.h * j.fill + r() * 0.02 * (1 - rr / j.r), j.z + Math.sin(a) * rr); im.setMatrixAt(i, mtx); }
    im.castShadow = false; im.userData.keep = true; root.add(im);
  }

  // ---------------------------------------------------------------- vintage popcorn cart
  {
    const cart = group(root, [X0 + 0.27, Y, 6.62], Math.PI / 2 - 0.06, 'popcornCart'); // local +z = front
    cart.scale.setScalar(0.88); // ~1.55 m tall, kettle box ~0.4 m
    const cBlack = std({ color: 0x141313, roughness: 0.35, metalness: 0.2 });
    const cBrass = std({ color: 0xc89a48, roughness: 0.3, metalness: 1 });
    const steel = std({ color: 0xd9d9d9, roughness: 0.18, metalness: 1 });
    const cw = 0.46, cd = 0.34;
    // legs (square black tube) + lower stretchers
    const legH = 0.62;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cart, new THREE.BoxGeometry(0.03, legH, 0.03), cBlack, [sx * (cw / 2 - 0.03), legH / 2, sz * (cd / 2 - 0.03)]);
    for (const sz of [-1, 1]) add(cart, new THREE.BoxGeometry(cw - 0.06, 0.025, 0.025), cBlack, [0, 0.16, sz * (cd / 2 - 0.03)]);
    for (const sx of [-1, 1]) add(cart, new THREE.BoxGeometry(0.025, 0.025, cd - 0.06), cBlack, [sx * (cw / 2 - 0.03), 0.16, 0]);
    // big spoked wheels at the -x end (planes parallel to the front)
    const wheelR = 0.21;
    for (const sz of [-1, 1]) {
      const wg = group(cart, [-cw / 2 + 0.03, wheelR, sz * (cd / 2 + 0.03)], 0, 'wheel');
      add(wg, new THREE.TorusGeometry(wheelR - 0.012, 0.012, 10, 48), cBrass);
      add(wg, new THREE.TorusGeometry(wheelR - 0.004, 0.008, 8, 48), cBlack);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; add(wg, cyl(0.0035, 0.0035, wheelR - 0.02, 6), cBrass, [Math.cos(a) * (wheelR - 0.02) / 2, Math.sin(a) * (wheelR - 0.02) / 2, 0], [0, 0, a - Math.PI / 2]); }
      add(wg, cyl(0.025, 0.025, 0.04, 16), cBrass, [0, 0, 0], [Math.PI / 2, 0, 0]);
    }
    add(cart, cyl(0.01, 0.01, cd + 0.06, 8), cBlack, [-cw / 2 + 0.03, wheelR, 0], [Math.PI / 2, 0, 0]);
    // base cabinet with door + decal
    const baseY0 = legH, baseH = 0.36;
    add(cart, rbox(cw, baseH, cd, 0.01), cBlack, [0, baseY0 + baseH / 2, 0]);
    const decal = canvasTex(512, 384, (g, w, h) => {
      g.fillStyle = '#121111'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9a050'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56);
      g.fillStyle = '#d8b25e'; g.textAlign = 'center';
      g.font = `italic 700 92px 'Snell Roundhand', 'Brush Script MT', cursive`; g.fillText('Popcorn', w / 2, h / 2 + 24);
      g.font = '600 30px Georgia, serif'; g.fillText('FRESH  HOT', w / 2, h / 2 - 66);
      g.fillStyle = '#b8282c'; g.beginPath(); g.ellipse(w / 2, h / 2 - 76, 120, 26, 0, 0, 7); g.globalAlpha = 0.0; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = '#d8b25e'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 150, h / 2 + 62); g.bezierCurveTo(w / 2 - 50, h / 2 + 100, w / 2 + 50, h / 2 + 30, w / 2 + 150, h / 2 + 62); g.stroke();
    });
    const doorMat = std({ map: decal, roughness: 0.35, metalness: 0.15 });
    add(cart, new THREE.PlaneGeometry(cw - 0.06, baseH - 0.06), doorMat, [0, baseY0 + baseH / 2, cd / 2 + 0.002]);
    add(cart, rbox(0.012, 0.05, 0.012, 0.004), cBrass, [-cw / 2 + 0.06, baseY0 + baseH / 2, cd / 2 + 0.01]);
    // side brand panel
    const side = canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#121111'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfa75a'; g.font = '600 24px Georgia, serif'; g.textAlign = 'center'; g.fillText('NOSTALGIA', w / 2, h / 2 + 8); });
    add(cart, new THREE.PlaneGeometry(cd - 0.06, baseH - 0.08), std({ map: side, roughness: 0.4 }), [-cw / 2 - 0.002, baseY0 + baseH / 2, 0], [0, -Math.PI / 2, 0]);
    // brass handle / tray bracket on the +x side
    add(cart, tube([[cw / 2, baseY0 + 0.30, -0.12], [cw / 2 + 0.11, baseY0 + 0.30, -0.10], [cw / 2 + 0.13, baseY0 + 0.30, 0.0], [cw / 2 + 0.11, baseY0 + 0.30, 0.10], [cw / 2, baseY0 + 0.30, 0.12]], 0.008, 32), cBrass);
    add(cart, tube([[cw / 2 + 0.12, baseY0 + 0.30, 0.0], [cw / 2 + 0.06, baseY0 + 0.20, 0.0], [cw / 2, baseY0 + 0.12, 0.0]], 0.006, 16), cBrass);
    // glass cabinet: brass corner posts, black rails, glass, kettle
    const gy0 = baseY0 + baseH, gh = 0.58;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cart, cyl(0.013, 0.013, gh, 12), cBrass, [sx * (cw / 2 - 0.013), gy0 + gh / 2, sz * (cd / 2 - 0.013)]);
    add(cart, rbox(cw + 0.01, 0.03, cd + 0.01, 0.006), cBlack, [0, gy0 + 0.015, 0]);
    add(cart, rbox(cw + 0.01, 0.03, cd + 0.01, 0.006), cBlack, [0, gy0 + gh - 0.015, 0]);
    // warming deck + popcorn pile inside
    add(cart, new THREE.BoxGeometry(cw - 0.04, 0.012, cd - 0.04), steel, [0, gy0 + 0.04, 0]);
    add(cart, new THREE.BoxGeometry(cw - 0.04, 0.11, 0.01), cBlack, [0, gy0 + 0.09, cd / 2 - 0.02]);
    add(cart, new THREE.BoxGeometry(cw - 0.04, gh - 0.06, 0.01), std({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.4 }), [0, gy0 + gh / 2, -cd / 2 + 0.02]);
    const pile = sphere(0.18, 24, 12); pile.scale(1.2, 0.25, 0.8);
    add(cart, pile, popMat, [0, gy0 + 0.05, 0]);
    // kettle hanging from the top: pot, lid, motor housing, stir rod
    const kettle = lathe([[0.001, 0], [0.07, 0], [0.085, 0.02], [0.088, 0.07], [0.082, 0.085]], 32);
    add(cart, kettle, steel, [0.02, gy0 + gh - 0.20, 0]);
    add(cart, cyl(0.075, 0.085, 0.015, 32), steel, [0.02, gy0 + gh - 0.112, 0]);
    add(cart, cyl(0.03, 0.035, 0.07, 20), steel, [0.02, gy0 + gh - 0.07, 0]);
    add(cart, cyl(0.006, 0.006, 0.1, 8), steel, [-0.09, gy0 + gh - 0.08, 0], [0, 0, 0.5]);
    add(cart, tube([[0.10, gy0 + gh - 0.10, 0], [0.15, gy0 + gh - 0.06, 0.05], [0.18, gy0 + gh - 0.18, 0.1]], 0.004, 16), cBlack);
    // glass panes
    for (const sz of [-1, 1]) add(cart, new THREE.PlaneGeometry(cw - 0.03, gh - 0.06), glassMat, [0, gy0 + gh / 2, sz * (cd / 2 - 0.006)], [0, 0, 0], { shadow: false }).renderOrder = 4;
    for (const sx of [-1, 1]) add(cart, new THREE.PlaneGeometry(cd - 0.03, gh - 0.06), glassMat, [sx * (cw / 2 - 0.006), gy0 + gh / 2, 0], [0, Math.PI / 2, 0], { shadow: false }).renderOrder = 4;
    // flared black canopy with brass scroll trim + red marquee lights
    const ry0 = gy0 + gh;
    const hood = new THREE.CylinderGeometry(0.5, 0.5, 0.13, 4, 1); hood.rotateY(Math.PI / 4);
    const hp = hood.attributes.position; for (let i = 0; i < hp.count; i++) { const top = hp.getY(i) > 0; const sxx = top ? 0.56 : 0.66, szz = top ? 0.40 : 0.52; hp.setXYZ(i, Math.sign(hp.getX(i)) * (cw * sxx), hp.getY(i), Math.sign(hp.getZ(i)) * (cd * szz)); }
    hood.computeVertexNormals();
    add(cart, hood, cBlack, [0, ry0 + 0.03 + 0.065, 0]);
    add(cart, rbox(cw * 1.36, 0.03, cd * 1.08, 0.006), cBlack, [0, ry0 + 0.018, 0]);
    add(cart, rbox(cw * 1.14, 0.02, cd * 0.82, 0.006), cBlack, [0, ry0 + 0.17, 0]);
    const trim = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#131212'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d0a552'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin(x / 22) * 12; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.fillStyle = '#ff3b2f'; for (const x of [w * 0.32, w * 0.4, w * 0.6, w * 0.68]) { g.beginPath(); g.arc(x, h / 2, 6, 0, 7); g.fill(); } });
    add(cart, new THREE.PlaneGeometry(cw * 1.3, 0.11), std({ map: trim, roughness: 0.4, emissive: 0x220000, emissiveIntensity: 0.4 }), [0, ry0 + 0.095, cd * 0.52 + 0.013], [-0.82, 0, 0]);
    phys.solidGroup(cart);
  }

  // ---------------------------------------------------------------- round black velvet lounger (~0.98 m dia x 0.55 m)
  {
    const n = rng(9);
    const geo = new THREE.SphereGeometry(1, 64, 40); const p = geo.attributes.position; const v = new THREE.Vector3();
    const Rr = 0.45, Hh = 0.52;
    const waves = Array.from({ length: 8 }, () => ({ k: 2 + Math.floor(n() * 5), l: 1 + Math.floor(n() * 3), ph: n() * 6.28, a: 0.003 + n() * 0.006 }));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const phi = Math.asin(Math.max(-1, Math.min(1, v.y))), th = Math.atan2(v.z, v.x);
      const c = Math.cos(phi), s = Math.sin(phi);
      // squat drum: soft domed crown, near-vertical puffy sides, flat base
      const ne = s > 0 ? 2.6 : 3.4; const kk = 1 / Math.pow(Math.pow(Math.abs(c), ne) + Math.pow(Math.abs(s), ne), 1 / ne);
      let rad = Rr * Math.abs(c) * kk;
      let y = (Hh / 2) * s * kk;
      if (y < -Hh * 0.42) { y = -Hh * 0.42 - (-Hh * 0.42 - y) * 0.08; }
      if (s > 0) y -= 0.025 * Math.exp(-Math.pow(c / 0.5, 2)) * s; // slight sit dip
      let wr = 0; for (const w of waves) wr += w.a * Math.sin(th * w.k + phi * w.l * 2 + w.ph);
      rad += wr * Math.exp(-Math.pow((s - 0.1) / 0.5, 2));
      if (s > 0.3) y += wr * 2.2 * (s - 0.3) * Math.min(1, c * 3); // crumpled crown (fades at the pole)
      p.setXYZ(i, Math.cos(th) * rad, y + Hh / 2, Math.sin(th) * rad);
    }
    geo.computeVertexNormals();
    // soft wrinkle normals (big, low-frequency folds) drawn on a canvas
    const wrinkle = canvasTex(256, 128, (g, w, h) => {
      const r = rng(21); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h); g.filter = 'blur(6px)';
      for (let i = 0; i < 40; i++) {
        const x = r() * w, y = r() * h, L = 30 + r() * 70, a = (r() - 0.5) * 1.2 + Math.PI / 2;
        g.lineWidth = 3 + r() * 6; g.lineCap = 'round';
        g.strokeStyle = 'rgb(165,150,255)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
        g.strokeStyle = 'rgb(92,108,255)'; g.beginPath(); g.moveTo(x + 5, y); g.lineTo(x + 5 + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
    });
    wrinkle.colorSpace = THREE.NoColorSpace; wrinkle.wrapS = wrinkle.wrapT = THREE.RepeatWrapping;
    const velvet = physm({ color: 0x0f0e10, roughness: 0.8, envMapIntensity: 0.3, normalMap: wrinkle, normalScale: new THREE.Vector2(1.0, 1.0), sheen: 1.0, sheenColor: new THREE.Color(0x34323a), sheenRoughness: 0.35 });
    const BX = 7.33, BZ = 4.90;
    const bg = group(root, [BX, Y, BZ], 0.4, 'beanbag');
    const mesh = add(bg, geo, velvet);
    geo.computeBoundingBox(); mesh.position.y = -geo.boundingBox.min.y + 0.016;
    phys.solidGroup(bg);
    const cs = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const sh = add(root, new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshBasicMaterial({ map: cs, transparent: true, depthWrite: false }), [BX, Y + 0.016, BZ], [-Math.PI / 2, 0, 0], { shadow: false });
    sh.renderOrder = 1;
  }

  // ---------------------------------------------------------------- charcoal / oatmeal diamond-check jute rug
  {
    const rw = 1.95, rd = 2.45; const cell = 0.35; // 0.35 m checks, square to the room
    const nx = Math.round(rw / cell * 2), nz = Math.round(rd / cell * 2);
    const map = canvasTex(640, Math.round(640 * rd / rw), (g, w, h) => {
      const r = rng(4); const s = w / rw; // px per metre
      g.fillStyle = '#cbb994'; g.fillRect(0, 0, w, h); g.filter = 'blur(2.5px)';
      // harlequin checks set on the diagonal
      const c = cell * s; const N = Math.ceil(Math.hypot(w, h) / c / 2) + 2;
      g.save(); g.translate(w / 2, h / 2); g.fillStyle = '#38363b';
      for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) if (((i + j) % 2 + 2) % 2 === 0) g.fillRect(i * c - c / 2, j * c - c / 2, c + 0.5, c + 0.5);
      g.restore(); g.filter = 'none';
      // wool loop texture: speckles + row ridges
      const id = g.getImageData(0, 0, w, h); const d = id.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; const ridge = ((x + (y >> 1)) % 4 < 2 ? 1.04 : 0.9) * ((y % 4) < 1 ? 0.92 : 1) * (0.84 + r() * 0.26); d[k] *= ridge; d[k + 1] *= ridge; d[k + 2] *= ridge; }
      g.putImageData(id, 0, 0);
      // binding
      g.globalAlpha = 0.5; g.strokeStyle = '#2a2826'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); g.globalAlpha = 1;
    });
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const rugMat = std({ map, roughness: 0.97, normalMap: tex('assets/ph/hessian_380/hessian_380_nor_gl_1k.jpg', { repeat: [rw / 0.27 * 1.2, rd / 0.27 * 1.2] }), normalScale: new THREE.Vector2(1.2, 1.2) });
    const rug = add(root, rbox(rw, 0.014, rd, 0.006, 2), rugMat, [6.82, Y + 0.007, 5.72], [0, 0.0, 0], { name: 'rug' });
    rug.castShadow = false;
    void nx; void nz;
  }

  kit.mergeStatic(root);
}
