// Piece: service — Mudroom/laundry, office (door to tennis court on NE wall), powder room, garage
// Owned rooms: mudroom, office, powder, garage | Reference photos: p13, p34, p35
import { Reflector } from 'three/addons/objects/Reflector.js';

export const piece = { rooms: ["mudroom", "office", "powder", "garage"], photos: ["p13", "p34", "p35"] };
export const ownCeiling = [];
// p35 was shot with a shifted lens (perspective-corrected crop): the +x vanishing point sits at
// photo pixel (795, 370), not the frame centre. `shift` = principal point in the 1080x720 frame;
// build() applies it with camera.setViewOffset, and `fov` is then the vertical fov of the full
// (uncropped) frame of height 2*shift[1].
export const views = {
  p13: { pos: [14.30, 1.21, 7.54], look: [14.30, 1.21, 10.60], fov: 46 },
  p34: { pos: [1.30, 1.38, 13.66], look: [0.93, 1.38, 15.63], fov: 80 },
  p35: { pos: [16.93, 1.36, 10.23], look: [22.80, 1.36, 10.23], fov: 71.8, shift: [795, 370] },
};

export async function build(ctx) {
  const { THREE, kit, phys, root } = ctx; const M = kit.M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const physMat = (o) => new THREE.MeshPhysicalMaterial(o);

  // lens shift for photo views that need it (only in shot mode, only for our own views)
  const vid = ctx.params && ctx.params.get('view');
  if (ctx.shot && vid && views[vid] && views[vid].shift) {
    const [px, py] = views[vid].shift; const W = 1080, H = 720;
    const FW = 2 * Math.max(px, W - px), FH = 2 * Math.max(py, H - py);
    ctx.camera.aspect = FW / FH; ctx.camera.setViewOffset(FW, FH, FW / 2 - px, FH / 2 - py, W, H);
  }

  // ------------------------------------------------------------------ materials
  const mat = {
    lacquer: std({ color: 0xf2f1ed, roughness: 0.42 }),
    lacquerEdge: std({ color: 0xe9e8e3, roughness: 0.5 }),
    applWhite: physMat({ color: 0xf7f7f5, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    applGrey: std({ color: 0xdcdcda, roughness: 0.35 }),
    smoke: physMat({ color: 0x1b1f25, roughness: 0.05, metalness: 0.0, clearcoat: 1, envMapIntensity: 1.6 }),
    drum: std({ color: 0x6b6f75, roughness: 0.3, metalness: 0.8 }),
    ceramic: physMat({ color: 0xf6f5f2, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    blackPowder: std({ color: 0x121212, roughness: 0.55, metalness: 0.35 }),
    blackGlass: physMat({ color: 0x0d0d0f, roughness: 0.08, clearcoat: 1 }),
    brushedBrass: std({ color: 0xc49a55, roughness: 0.32, metalness: 1.0 }),
    frosted: std({ color: 0xf4f6f8, emissive: 0xf2f4f7, emissiveIntensity: 1.05, roughness: 0.6 }),
    clearGlass: physMat({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.5 }),
    filament: std({ color: 0xffe2b0, emissive: 0xffc77a, emissiveIntensity: 6, roughness: 1 }),
    nylonBlack: std({ color: 0x141518, roughness: 0.38, metalness: 0.05 }),
    oliveWool: std({ color: 0x6e5c2f, roughness: 0.92 }),
    puffNormal: null,
    pot: std({ color: 0x1e1e20, roughness: 0.55 }),
    leaf: std({ color: 0x3d6a2c, roughness: 0.6, side: THREE.DoubleSide }),
    leafDark: std({ color: 0x2c5222, roughness: 0.6, side: THREE.DoubleSide }),
    cane: std({ color: 0x6b5a45, roughness: 0.85 }),
    blackWood: std({ color: 0x151515, roughness: 0.6 }),
    blackLeather: std({ color: 0x141416, roughness: 0.42 }),
    tvBody: std({ color: 0x0c0c0d, roughness: 0.4, metalness: 0.3 }),
    tvScreen: physMat({ color: 0x050506, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 }),
    deskGlass: physMat({ color: 0xdaf0e6, roughness: 0.02, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide }),
    deskGlassEdge: std({ color: 0x9ac7b0, roughness: 0.1, transparent: true, opacity: 0.55 }),
    shadeFabric: std({ color: 0x18181a, roughness: 0.9 }),
    linen: std({ color: 0xf1ede6, roughness: 0.95, side: THREE.DoubleSide }),
    plate: std({ color: 0xf5f4f0, roughness: 0.45 }),
    grille: std({ color: 0xe8e7e3, roughness: 0.5 }),
    speaker: std({ color: 0xeeede9, roughness: 0.8 }),
    cardboard: std({ color: 0xb48c5c, roughness: 0.9 }),
    orange: std({ color: 0xe8611a, roughness: 0.55 }),
    galv: std({ color: 0xa9adb1, roughness: 0.45, metalness: 0.8 }),
    rubber: std({ color: 0x1a1a1a, roughness: 0.9 }),
    amber: physMat({ color: 0x3b2310, roughness: 0.1, clearcoat: 1 }),
    wax: std({ color: 0xf1ece2, roughness: 0.7 }),
  };

  // procedural textures ---------------------------------------------------------------
  // powder-room wallpaper: overlapping "mosaic sunburst" medallions, white on black (p34)
  const WP_TILE = 0.66;
  const wallpaperMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    const r = kit.rng(341);
    g.fillStyle = '#121214'; g.fillRect(0, 0, w, h);
    const n = 3, cells = [];
    for (let layer = 0; layer < 2; layer++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = layer ? 0.5 : 0, oy = layer ? 0.5 : 0;
      cells.push([((i + ox + (j % 2) * 0.25 + (r() - 0.5) * 0.2) / n) * w, ((j + oy + (r() - 0.5) * 0.2) / n) * h, (0.42 + r() * 0.16) * (w / n)]);
    }
    for (let i = cells.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [cells[i], cells[k]] = [cells[k], cells[i]]; }
    const disc = (x, y, R) => {
      g.fillStyle = '#121214'; g.beginPath(); g.arc(x, y, R + 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(232,228,218,0.95)'; g.lineCap = 'round';
      let rad = R * 0.2; const a0 = r() * 6.283;
      while (rad < R - 4) {
        const len = R * 0.085; const cnt = Math.max(8, Math.floor((2 * Math.PI * rad) / (R * 0.075)));
        g.lineWidth = Math.max(2, R * 0.032); g.beginPath();
        for (let m = 0; m < cnt; m++) {
          const a = a0 + (m + (rad / R) * 0.5) / cnt * 2 * Math.PI + (r() - 0.5) * 0.04; const c = Math.cos(a), s = Math.sin(a);
          g.moveTo(x + c * rad, y + s * rad); g.lineTo(x + c * (rad + len), y + s * (rad + len));
        }
        g.stroke(); rad += len * 1.42;
      }
    };
    for (const [cx, cy, R] of cells) for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const x = cx + ox, y = cy + oy; if (x + R < 0 || x - R > w || y + R < 0 || y - R > h) continue; disc(x, y, R);
    }
  }, { repeat: [1 / WP_TILE, 1 / WP_TILE] });
  const wallpaper = std({ map: wallpaperMap, roughness: 0.62, normalMap: kit.noiseNormal(256, 1.2, 32, 9), normalScale: new THREE.Vector2(0.25, 0.25) });
  mat.wallpaper = wallpaper;

  // dark brown grasscloth with horizontal fibres and panel seams (p34 left wall)
  const GC_TILE = 0.91;
  const grassMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    const r = kit.rng(77);
    g.fillStyle = '#3f3127'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      let x = -r() * 100;
      while (x < w) {
        const len = 25 + r() * 220; const v = r();
        g.fillStyle = v < 0.45 ? `rgba(18,12,8,${0.2 + r() * 0.4})` : v < 0.9 ? `rgba(${105 + r() * 50},${80 + r() * 35},${58 + r() * 22},${0.14 + r() * 0.3})` : `rgba(170,140,100,${0.25 + r() * 0.3})`;
        g.fillRect(x, y, len, r() < 0.35 ? 2 : 1); x += len * (0.5 + r() * 0.7);
      }
    }
    g.fillStyle = 'rgba(16,10,6,0.65)'; g.fillRect(0, 0, 3, h);
  }, { repeat: [1 / GC_TILE, 1 / GC_TILE] });
  const grasscloth = std({ map: grassMap, roughness: 0.88, normalMap: kit.noiseNormal(256, 2.0, 64, 4), normalScale: new THREE.Vector2(0.3, 0.3) });

  // ------------------------------------------------------------------ helpers
  const add = (p, geo, m, pos, rot, opt) => kit.add(p, geo, m, pos, rot, opt);
  // rounded box by min corner (local)
  const RB = (p, m, x0, y0, z0, w, h, d, r = 0.004) => add(p, kit.rbox(w, h, d, r), m, [x0 + w / 2, y0 + h / 2, z0 + d / 2]);
  // wall finish panel with UVs continuous along the wall (uStart = distance of `a` from a fixed origin)
  function panel(p, a, b, y0, y1, n, m, off = 0.004, uStart = 0) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.005 || y1 - y0 < 0.005) return null;
    const g = new THREE.PlaneGeometry(L, y1 - y0); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uStart + uv.getX(i) * L, y0 + uv.getY(i) * (y1 - y0));
    const mm = new THREE.Mesh(g, m); mm.receiveShadow = true; mm.castShadow = false;
    mm.position.set((a[0] + b[0]) / 2 + n[0] * off, (y0 + y1) / 2, (a[1] + b[1]) / 2 + n[1] * off);
    mm.lookAt(mm.position.x + n[0], mm.position.y, mm.position.z + n[1]);
    // make +u run from a to b regardless of the lookAt basis
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mm.quaternion); if (right.x * (b[0] - a[0]) + right.z * (b[1] - a[1]) < 0) { for (let i = 0; i < uv.count; i++) uv.setX(i, 2 * uStart + L - uv.getX(i)); }
    p.add(mm); return mm;
  }
  // bar pull: vertical (len along y) or horizontal (len along x), local frame, z = front face
  function pull(p, x, y, z, len, vertical = true, m = M.blackMetal) {
    const g = kit.group(p, [x, y, z]);
    add(g, kit.rbox(vertical ? 0.011 : len, vertical ? len : 0.011, 0.011, 0.004), m, [0, 0, 0.03]);
    for (const s of [-1, 1]) add(g, kit.cyl(0.0045, 0.0045, 0.03, 10), m, vertical ? [0, s * (len / 2 - 0.02), 0.015] : [s * (len / 2 - 0.02), 0, 0.015], [Math.PI / 2, 0, 0]);
    return g;
  }
  const shaker = (p, x0, y0, z, w, h, m = mat.lacquer, frame = 0.055) => add(p, kit.shakerFront(w, h, Math.min(frame, w / 4, h / 4), 0.02, 0.006), m, [x0, y0, z]);
  function leafGeo(len, wid, droop, twist = 0) { // strap leaf along +y then drooping toward +z
    const seg = 7, pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; const ww = wid * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.6);
      const y = len * t * (1 - droop * t * 0.5), z = droop * len * t * t; const tw = twist * t;
      pos.push(-ww / 2 * Math.cos(tw), y, z - ww / 2 * Math.sin(tw), ww / 2 * Math.cos(tw), y, z + ww / 2 * Math.sin(tw)); uv.push(0, t, 1, t);
      if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // a dracaena / yucca head: rosette of strap leaves
  function leafHead(p, x, y, z, n, len, r, seed, m1 = mat.leaf, m2 = mat.leafDark) {
    const rr = kit.rng(seed); const geos1 = [], geos2 = [];
    for (let i = 0; i < n; i++) {
      const up = rr(); const g = leafGeo(len * (0.6 + rr() * 0.5), 0.028 + rr() * 0.012, 0.25 + (1 - up) * 1.1, (rr() - 0.5) * 1.2);
      g.rotateX(-(0.15 + (1 - up) * 1.0)); g.rotateY(rr() * Math.PI * 2); g.translate(x + (rr() - 0.5) * r, y + rr() * 0.12, z + (rr() - 0.5) * r);
      (i % 3 ? geos1 : geos2).push(g);
    }
    if (geos1.length) add(p, kit.mergeGeometries(geos1), m1, [0, 0, 0]);
    if (geos2.length) add(p, kit.mergeGeometries(geos2), m2, [0, 0, 0]);
  }

  // =====================================================================================
  // MUDROOM & LAUNDRY  (rect x 11.27..16.85, z 7.20..10.60). Built-in along the kitchen-side wall
  // (z = 10.60, facing -z). Local frame `bi`: origin (15.195, 0, 10.60), local +x = world -x
  // (= left->right in p13), local +z = into the room. Front plane at local z 0.65.
  // =====================================================================================
  {
    const FZ = 0.65; const H = 3.05;
    const bi = kit.group(root, [15.195, 0, 10.60], Math.PI, 'mud-builtin');
    // left full-height end panel (switch on its inner face)
    RB(bi, mat.lacquer, 0, 0, 0, 0.03, H, FZ, 0.003);
    add(bi, kit.rbox(0.004, 0.11, 0.07, 0.003), mat.plate, [0.032, 1.17, 0.42]);
    add(bi, kit.rbox(0.006, 0.05, 0.022, 0.002), mat.plate, [0.034, 1.17, 0.42]);
    // nook back panel
    RB(bi, mat.lacquer, 0.03, 0.5, 0, 1.49, 1.43, 0.018, 0.002);
    // hooks (6 black double robe hooks)
    const hookX = [0.225, 0.445, 0.675, 0.915, 1.135, 1.355];
    for (const hx of hookX) {
      const hg = kit.group(bi, [hx, 1.77, 0.018]);
      add(hg, kit.rbox(0.03, 0.05, 0.008, 0.003), M.blackMetal, [0, 0, 0.004]);
      add(hg, kit.tube([[0, 0.0, 0.006], [0, -0.005, 0.03], [0, 0.005, 0.055], [0, 0.035, 0.062]], 0.0045, 16), M.blackMetal, [0, 0, 0]);
      add(hg, kit.tube([[0, -0.01, 0.006], [0, -0.025, 0.035], [0, -0.03, 0.06], [0, -0.012, 0.072]], 0.0045, 16), M.blackMetal, [0, 0, 0]);
    }
    // coats: black quilted puffer on hook 2, olive jacket on hook 3
    {
      const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const base = 0.03 + 0.1 * Math.min(1, t * 4) - 0.012 * t; const quilt = (t > 0.18) ? 0.01 * Math.abs(Math.sin(t * 34)) : 0; prof.push([base + quilt, -t * 0.62]); }
      const puff = add(bi, kit.lathe(prof, 28), mat.nylonBlack, [0.452, 1.79, 0.075]); puff.scale.set(1, 1, 0.42); puff.rotation.z = 0.04;
      add(bi, kit.cushion(0.2, 0.06, 0.08, 0.03, 0.01), mat.nylonBlack, [0.452, 1.80, 0.07]); // folded collar/hood
      const jp = []; for (let i = 0; i <= 20; i++) { const t = i / 20; jp.push([0.025 + 0.105 * Math.min(1, t * 3.5) + 0.01 * Math.sin(t * 9), -t * 0.76]); }
      const jk = add(bi, kit.lathe(jp, 28), mat.oliveWool, [0.682, 1.80, 0.07]); jk.scale.set(1, 1, 0.38); jk.rotation.z = -0.03;
      add(bi, kit.rbox(0.05, 0.3, 0.012, 0.004), mat.oliveWool, [0.64, 1.58, 0.11], [0, 0, 0.25]); // lapel fold
      add(bi, kit.rbox(0.06, 0.012, 0.03, 0.004), mat.oliveWool, [0.682, 1.78, 0.03]); // hanger loop
    }
    // bench: carcass, top, two drawers, toe kick
    RB(bi, mat.lacquer, 0.03, 0.1, 0.02, 1.49, 0.40, FZ - 0.04, 0.003);
    RB(bi, mat.lacquerEdge, 0.05, 0, 0.02, 1.45, 0.1, FZ - 0.1, 0.002);
    RB(bi, mat.lacquer, 0.03, 0.50, 0.0, 1.49, 0.036, FZ + 0.01, 0.004);
    shaker(bi, 0.04, 0.235, FZ - 0.02, 0.73, 0.255, mat.lacquer, 0.05);
    shaker(bi, 0.785, 0.235, FZ - 0.02, 0.73, 0.255, mat.lacquer, 0.05);
    pull(bi, 0.405, 0.37, FZ, 0.13, false); pull(bi, 1.15, 0.37, FZ, 0.13, false);
    // upper cabinets over the nook (2 rows of 4 doors), carcass full depth
    RB(bi, mat.lacquer, 0.03, 1.92, 0, 1.635, H - 1.92, FZ - 0.02, 0.003);
    const updx = [[0.035, 0.37], [0.408, 0.37], [0.81, 0.37], [1.183, 0.37]];
    for (const [x0, w] of updx) { shaker(bi, x0, 1.945, FZ - 0.02, w, 0.265, mat.lacquer, 0.05); shaker(bi, x0, 2.235, FZ - 0.02, w, 0.80, mat.lacquer, 0.06); }
    pull(bi, 0.37, 2.06, FZ, 0.12); pull(bi, 0.43, 2.06, FZ, 0.12); pull(bi, 1.15, 2.06, FZ, 0.12); pull(bi, 1.21, 2.06, FZ, 0.12);
    // partition between nook and laundry column
    RB(bi, mat.lacquer, 1.515, 0, 0, 0.15, 1.92, FZ, 0.004);
    // laundry column: niche for stacked Miele washer + dryer, cabinet above
    RB(bi, mat.lacquer, 1.665, 1.81, 0, 0.67, H - 1.81, FZ - 0.02, 0.003);
    shaker(bi, 1.67, 1.815, FZ - 0.02, 0.325, H - 1.835, mat.lacquer, 0.06); shaker(bi, 2.0, 1.815, FZ - 0.02, 0.325, H - 1.835, mat.lacquer, 0.06);
    pull(bi, 1.955, 1.95, FZ, 0.16); pull(bi, 2.04, 1.95, FZ, 0.16);
    RB(bi, mat.lacquerEdge, 1.665, 0, 0, 0.65, 1.81, 0.015, 0.002); // niche back
    RB(bi, mat.lacquer, 2.315, 0, 0, 0.03, H, FZ, 0.003); // right side panel of the niche
    // tall pantry / broom cabinets to the right (to the foyer wall)
    const tallX = [[2.345, 0.79], [3.135, 0.79]];
    RB(bi, mat.lacquer, 2.345, 0, 0, 1.58, H, FZ - 0.02, 0.003);
    for (const [x0, w] of tallX) {
      shaker(bi, x0 + 0.005, 0.1, FZ - 0.02, w - 0.01, 1.66, mat.lacquer, 0.06);
      shaker(bi, x0 + 0.005, 1.79, FZ - 0.02, w - 0.01, 1.23, mat.lacquer, 0.06);
    }
    pull(bi, 2.345 + 0.73, 0.95, FZ, 0.2); pull(bi, 3.135 + 0.06, 0.95, FZ, 0.2);
    // ---- Miele compact washer (bottom) + heat-pump dryer (top)
    const panelMap = (dryer) => kit.canvasTex(512, 732, (g, w, h) => {
      g.fillStyle = '#f6f6f4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#dcdcda'; g.fillRect(0, 76, w, 2); // control-panel seam
      g.fillStyle = '#9a9a9a'; g.font = 'bold 22px Helvetica, Arial'; g.fillText('Miele', 26, 34);
      g.font = '9px Helvetica, Arial'; g.fillStyle = '#b0b0b0'; g.fillText(dryer ? 'T1  heat-pump dryer' : 'W1  TwinDos', 26, 50);
      g.fillStyle = '#0c0c0e'; g.fillRect(186, 14, 136, 44); g.fillStyle = '#26303a'; g.fillRect(192, 20, 124, 32);
      g.fillStyle = '#e8e8e8'; for (let i = 0; i < 6; i++) g.fillRect(340 + i * 14, 34, 6, 2);
      if (dryer) { // plinth filter flap (p13 "Easy to Clean Plinth Filter")
        g.fillStyle = '#e9e9e7'; g.fillRect(20, 568, 472, 150); g.strokeStyle = '#cfcfcd'; g.lineWidth = 2; g.strokeRect(20, 568, 472, 150);
        g.fillStyle = '#c0353a'; g.font = '13px Helvetica, Arial'; g.fillText('Easy to Clean Plinth Filter', 50, 600);
        g.fillStyle = '#909090'; g.font = '10px Helvetica, Arial'; g.fillText('Push here to open', 50, 618);
        g.fillStyle = '#b5b5b3'; for (let i = 0; i < 14; i++) g.fillRect(352 + i * 8, 588, 4, 100);
      }
    });
    function miele(y0, dryer) {
      const g = kit.group(bi, [1.99, y0, 0.02]);
      add(g, kit.rbox(0.596, 0.848, 0.6, 0.01), mat.applWhite, [0, 0.424, 0.3]);
      const front = add(g, new THREE.PlaneGeometry(0.594, 0.846), std({ map: panelMap(dryer), roughness: 0.25 }), [0, 0.424, 0.601]);
      front.castShadow = false;
      // rotary selector + door-release pill
      add(g, kit.cyl(0.028, 0.03, 0.022, 32), mat.applWhite, [0.205, 0.797, 0.612], [Math.PI / 2, 0, 0]);
      add(g, kit.torus(0.028, 0.004, 8, 32), M.chrome, [0.205, 0.797, 0.612]);
      add(g, kit.rbox(0.07, 0.022, 0.012, 0.01), M.chrome, [-0.205, 0.735, 0.606]);
      // porthole door: white outer ring, chrome bezel, smoked glass dome, drum behind
      const dy = dryer ? 0.495 : 0.486; const R = 0.236;
      const door = kit.group(g, [0.005, dy, 0.6]);
      add(door, kit.lathe([[0.0, 0.0], [R, 0.0], [R + 0.004, 0.02], [R - 0.01, 0.045], [0.19, 0.05], [0.185, 0.045]], 64), mat.applWhite, [0, 0, 0], [Math.PI / 2, 0, 0]);
      add(door, kit.torus(0.192, 0.011, 12, 64), M.chrome, [0, 0, 0.05]);
      add(door, kit.torus(R + 0.002, 0.006, 8, 64), M.chrome, [0, 0, 0.022]);
      const dome = add(door, new THREE.SphereGeometry(0.19, 48, 16, 0, Math.PI * 2, 0, 0.55), mat.smoke, [0, 0, -0.09], [Math.PI / 2, 0, 0]);
      dome.castShadow = false;
      add(door, kit.cyl(0.17, 0.17, 0.02, 40), mat.drum, [0, 0, -0.02], [Math.PI / 2, 0, 0]);
      add(door, kit.cushion(0.2, 0.08, 0.12, 0.04, 0.03), dryer ? std({ color: 0x5b6f86, roughness: 0.9 }) : std({ color: 0x8a6a8f, roughness: 0.9 }), [0.02, -0.08, -0.02], [0.3, 0.2, 0.3]);
      return g;
    }
    miele(0.0, false); miele(0.852, true);
    // physics: bench, partitions, columns
    const wx = (lx) => 15.195 - lx; const zF = 10.60 - FZ;
    phys.boxAABB([wx(1.515), 0, zF], [wx(0.03), 0.536, 10.60]);
    phys.boxAABB([wx(1.665), 1.92, zF], [wx(0.03), H, 10.60]);
    phys.boxAABB([wx(0.03), 0, zF], [wx(0), H, 10.60]);
    phys.boxAABB([wx(1.665), 0, zF], [wx(1.515), H, 10.60]);
    phys.boxAABB([wx(2.345), 0, zF - 0.06], [wx(1.665), H, 10.60]);
    phys.boxAABB([wx(3.925), 0, zF], [wx(2.345), H, 10.60]);

    // room finishes: baseboards on the open walls, cans
    kit.baseboards(root, [11.27, 7.20, 16.85, 10.60], 0, 0.11, 0.014, M.paintWhite, [
      { side: 'z1', from: 11.27, to: 15.20 }, { side: 'z1', from: 15.55, to: 16.45 }, { side: 'z0', from: 11.95, to: 12.85 }, { side: 'x1', from: 9.52, to: 10.38 },
    ]);
    kit.canLights(root, [[12.6, 8.4], [14.3, 8.4], [15.9, 8.4]], 3.05);
    // dynamic clutter out of the photo's frame: sneakers by the garage door, laundry basket, detergent
    const shoe = (x, z, ry) => {
      const g = kit.group(root, [x, 0, z], ry);
      add(g, kit.rbox(0.105, 0.03, 0.29, 0.012), std({ color: 0xf0efe9, roughness: 0.8 }), [0, 0.015, 0]);
      add(g, kit.cushion(0.095, 0.07, 0.25, 0.04, 0.015), std({ color: 0x2c2f36, roughness: 0.85 }), [0, 0.06, -0.01]);
      phys.dynamic(g, { mass: 0.4 });
    };
    shoe(13.0, 7.45, 0.1); shoe(13.15, 7.47, -0.12);
    {
      const bk = kit.group(root, [16.45, 0, 7.55]);
      add(bk, kit.lathe([[0.0, 0], [0.2, 0], [0.24, 0.32], [0.235, 0.33], [0.195, 0.01], [0, 0.01]], 32), std({ color: 0xc9b48e, roughness: 0.95, normalMap: kit.noiseNormal(128, 3, 32, 2), normalScale: new THREE.Vector2(0.8, 0.8) }), [0, 0, 0]);
      add(bk, kit.cushion(0.34, 0.08, 0.3, 0.05, 0.04), M.linenWhite, [0, 0.29, 0]);
      phys.dynamic(bk, { mass: 1.5, shape: 'hull' });
      const jug = kit.group(root, [16.6, 0, 8.1]);
      add(jug, kit.rbox(0.16, 0.26, 0.11, 0.03), std({ color: 0x2a7fd0, roughness: 0.35 }), [0, 0.13, 0]);
      add(jug, kit.cyl(0.025, 0.025, 0.035, 16), M.paintWhite, [0.04, 0.275, 0]);
      phys.dynamic(jug, { mass: 1.2 });
    }
  }

  // =====================================================================================
  // POWDER ROOM (rect x 0.65..2.50, z 13.60..15.85). The vanity sits on a chamfered wall across the
  // SW/rear corner (p34): A = rear wall (z 15.85) with a small frosted window, B = chamfer (vanity,
  // arched mirror, brass sconces), C = SW wall (x 0.65) with the real window pow-win.
  // Patterned paper on A/B/C, dark grasscloth on the door wall (x 2.50) and the living-room wall.
  // =====================================================================================
  {
    const pw = kit.group(root, [0, 0, 0], 0, 'powder');
    const P1 = [1.40, 15.85], P2 = [0.65, 14.47]; const H = 3.05;
    const L = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    const u = [(P2[0] - P1[0]) / L, (P2[1] - P1[1]) / L]; const n = [-u[1], u[0]]; // (0.878,-0.477) into the room
    if (n[0] < 0) { n[0] *= -1; n[1] *= -1; }
    const prism = kit.extrude([[P1[0], -P1[1]], [P2[0], -P2[1]], [0.60, -P2[1]], [0.60, -15.90], [P1[0], -15.90]], H); prism.rotateX(-Math.PI / 2);
    add(pw, prism, M.paintWhite, [0, 0, 0]); phys.trimesh(prism);
    // wall finishes
    panel(pw, P1, P2, 0, H, n, wallpaper, 0.004, 1.10);
    panel(pw, [2.50, 15.85], P1, 0, H, [0, -1], wallpaper, 0.004, 0);
    // C wall around the real window (z 13.85..14.45, y 1.25..2.65)
    const W0 = 13.85, W1 = 14.45, WS = 1.25, WH = 2.65;
    panel(pw, P2, [0.65, 13.60], 0, WS, [1, 0], wallpaper, 0.004, 1.10 + L);
    panel(pw, P2, [0.65, 13.60], WH, H, [1, 0], wallpaper, 0.004, 1.10 + L);
    panel(pw, [0.65, W0], [0.65, 13.60], WS, WH, [1, 0], wallpaper, 0.004, 1.10 + L + (P2[1] - W0));
    panel(pw, P2, [0.65, W1], WS, WH, [1, 0], wallpaper, 0.004, 1.10 + L);
    // window reveal lined with paper, frosted glass behind the shell's black frame
    const rv = (a, b, y0, y1, nn) => panel(pw, a, b, y0, y1, nn, wallpaper, 0.002);
    rv([0.46, W1], [0.46, W0], WS, WH, [1, 0]); // (hidden behind pane; keeps the gap dark if any)
    { const g = new THREE.PlaneGeometry(0.2, W1 - W0); g.rotateX(-Math.PI / 2); add(pw, g, wallpaper, [0.555, WS + 0.002, (W0 + W1) / 2]); }
    { const g = new THREE.PlaneGeometry(0.2, W1 - W0); g.rotateX(Math.PI / 2); add(pw, g, wallpaper, [0.555, WH - 0.002, (W0 + W1) / 2]); }
    { const g = new THREE.PlaneGeometry(0.2, WH - WS); add(pw, g, wallpaper, [0.555, (WS + WH) / 2, W0 + 0.002]); }
    { const g = new THREE.PlaneGeometry(0.2, WH - WS); g.rotateY(Math.PI); add(pw, g, wallpaper, [0.555, (WS + WH) / 2, W1 - 0.002]); }
    { const g = new THREE.PlaneGeometry(W1 - W0, WH - WS); g.rotateY(Math.PI / 2); const m = add(pw, g, mat.frosted, [0.452, (WS + WH) / 2, (W0 + W1) / 2]); m.castShadow = false; }
    // grasscloth: door wall (x 2.50, door z 13.605..14.355) and living-room wall (z 13.60)
    panel(pw, [2.50, 15.85], [2.50, 14.36], 0, H, [-1, 0], grasscloth, 0.004, 0);
    panel(pw, [2.50, 14.36], [2.50, 13.60], 2.40, H, [-1, 0], grasscloth, 0.004, 1.49);
    panel(pw, [2.50, 13.60], [0.65, 13.60], 0, H, [0, 1], grasscloth, 0.004, 0);
    kit.baseboards(pw, [0.65, 13.60, 2.50, 15.85], 0, 0.1, 0.014, M.paintWhite, [{ side: 'x1', from: 13.60, to: 14.36 }, { side: 'z1', from: 0.6, to: 2.6 }, { side: 'x0', from: 13.5, to: 16 }]);
    // fake frosted window on the rear wall A (no opening in the shell there)
    {
      const x0 = 1.67, x1 = 2.29, y0 = 1.23, y1 = 2.63, z = 15.85; const fw = 0.05;
      const wg = kit.group(pw, [0, 0, 0]);
      const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); g.rotateY(Math.PI); const pane = add(wg, g, mat.frosted, [(x0 + x1) / 2, (y0 + y1) / 2, z - 0.006]); pane.castShadow = false;
      RB(wg, M.blackMetal, x0, y0, z - 0.05, x1 - x0, fw, 0.05, 0.004); RB(wg, M.blackMetal, x0, y1 - fw, z - 0.05, x1 - x0, fw, 0.05, 0.004);
      RB(wg, M.blackMetal, x0, y0, z - 0.05, fw, y1 - y0, 0.05, 0.004); RB(wg, M.blackMetal, x1 - fw, y0, z - 0.05, fw, y1 - y0, 0.05, 0.004);
      RB(wg, M.blackMetal, x0, y0 + (y1 - y0) * 0.47, z - 0.045, x1 - x0, 0.03, 0.04, 0.004);
      RB(wg, M.blackMetal, x0 - 0.02, y0 - 0.03, z - 0.06, x1 - x0 + 0.04, 0.03, 0.06, 0.004); // sill
    }
    // vanity on the chamfer
    const ry = Math.atan2(n[0], n[1]);
    const mid = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
    const vg = kit.group(pw, [mid[0] + n[0] * 0.004, 0, mid[1] + n[1] * 0.004], ry, 'vanity');
    const VW = 0.92, VD = 0.47, VT = 0.86, BT = 0.17; const vx = -0.04;
    const basin = kit.group(vg, [vx, 0, 0]);
    // hollow trough basin: deck, front/sides rims, bowl floor
    RB(basin, mat.ceramic, -VW / 2, VT - BT, 0.01, VW, 0.035, VD, 0.012);
    RB(basin, mat.ceramic, -VW / 2, VT - BT, 0.01, VW, BT, 0.12, 0.012);
    RB(basin, mat.ceramic, -VW / 2, VT - BT, VD - 0.035, VW, BT, 0.045, 0.014);
    RB(basin, mat.ceramic, -VW / 2, VT - BT, 0.01, 0.04, BT, VD, 0.012);
    RB(basin, mat.ceramic, VW / 2 - 0.04, VT - BT, 0.01, 0.04, BT, VD, 0.012);
    add(basin, kit.cyl(0.018, 0.018, 0.004, 20), M.brushedNickel, [0, VT - BT + 0.037, 0.29]);
    // black steel console frame with glass shelf and towel bar
    const fr = kit.group(vg, [vx, 0, 0]); const legX = VW / 2 - 0.03;
    for (const sx of [-1, 1]) {
      RB(fr, mat.blackPowder, sx * legX - 0.009, 0, 0.03, 0.018, VT - BT, 0.018, 0.003);
      RB(fr, mat.blackPowder, sx * legX - 0.009, 0, VD - 0.04, 0.018, VT - BT, 0.018, 0.003);
      RB(fr, mat.blackPowder, sx * legX - 0.009, 0, 0.03, 0.018, 0.018, VD - 0.05, 0.003);
      RB(fr, mat.blackPowder, sx * legX - 0.009, VT - BT - 0.03, 0.03, 0.018, 0.03, VD - 0.05, 0.003);
      add(fr, kit.tube([[sx * legX, VT - BT - 0.015, VD - 0.03], [sx * (legX + 0.06), VT - BT - 0.015, VD - 0.02], [sx * (legX + 0.06), VT - BT - 0.015, VD - 0.2]], 0.007, 16), mat.blackPowder, [0, 0, 0]);
    }
    RB(fr, mat.blackPowder, -legX, VT - BT - 0.03, VD - 0.04, 2 * legX, 0.03, 0.018, 0.003);
    RB(fr, mat.blackGlass, -legX, 0.24, 0.04, 2 * legX, 0.012, VD - 0.06, 0.003);
    RB(fr, mat.blackPowder, -legX, 0.225, VD - 0.045, 2 * legX, 0.015, 0.015, 0.003);
    add(fr, kit.tube([[0, VT - BT, 0.27], [0, 0.5, 0.27], [0, 0.42, 0.2], [0, 0.42, 0.02]], 0.02, 24), mat.blackPowder, [0, 0, 0]); // trap
    // brass widespread faucet with cross handles
    {
      const fg = kit.group(vg, [vx, VT, 0.06]);
      add(fg, kit.cyl(0.022, 0.026, 0.06, 24), mat.brushedBrass, [0, 0.03, 0]);
      add(fg, kit.tube([[0, 0.05, 0], [0, 0.2, 0.0], [0, 0.27, 0.04], [0, 0.25, 0.13], [0, 0.18, 0.15]], 0.011, 40), mat.brushedBrass, [0, 0, 0]);
      for (const sx of [-0.13, 0.13]) {
        add(fg, kit.cyl(0.02, 0.024, 0.05, 20), mat.brushedBrass, [sx, 0.025, 0]);
        add(fg, kit.rbox(0.08, 0.012, 0.012, 0.005), mat.brushedBrass, [sx, 0.062, 0]); add(fg, kit.rbox(0.012, 0.012, 0.08, 0.005), mat.brushedBrass, [sx, 0.062, 0]);
        add(fg, kit.sphere(0.009, 12, 8), mat.brushedBrass, [sx, 0.07, 0]);
      }
    }
    // physics: basin + frame as one box (accessories rest on the deck)
    { const c = kit.group(vg, [vx, 0, 0]); RB(c, mat.ceramic, -VW / 2, 0, 0.01, VW, VT, VD).visible = false; phys.solidGroup(c); vg.remove(c); }
    // accessories (dynamic): folded hand towel on a tray, amber soap pump, white candle
    {
      const towel = kit.group(vg, [vx - 0.3, VT, 0.12]);
      add(towel, kit.cushion(0.2, 0.03, 0.11, 0.012, 0.008), M.linenWhite, [0, 0.015, 0]);
      phys.dynamic(towel, { mass: 0.15 });
      const soap = kit.group(vg, [vx + 0.24, VT, 0.08]);
      add(soap, kit.rbox(0.07, 0.15, 0.05, 0.012), mat.amber, [0, 0.075, 0]);
      add(soap, kit.rbox(0.05, 0.06, 0.004, 0.001), std({ color: 0xece6da, roughness: 0.8 }), [0, 0.07, 0.026]);
      add(soap, kit.cyl(0.012, 0.012, 0.04, 12), M.matteBlack, [0, 0.17, 0]); add(soap, kit.rbox(0.012, 0.012, 0.045, 0.004), M.matteBlack, [0, 0.19, 0.018]);
      phys.dynamic(soap, { mass: 0.35 });
      const cand = kit.group(vg, [vx + 0.37, VT, 0.12]);
      add(cand, kit.lathe([[0, 0], [0.04, 0], [0.042, 0.09], [0.036, 0.09], [0.036, 0.075], [0, 0.075]], 24), mat.wax, [0, 0, 0]);
      phys.dynamic(cand, { mass: 0.3, shape: 'hull' });
    }
    // arched mirror (rounded rectangle, thin brass frame) with a live reflection
    const MW = 0.64, MH = 1.02, MY = 1.33, MR = 0.09;
    const rr = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    {
      const mg = kit.group(vg, [vx + 0.02, MY + MH / 2, 0.012]);
      const outer = rr(MW + 0.024, MH + 0.024, MR + 0.012); outer.holes.push(new THREE.Path(rr(MW, MH, MR).getPoints(32).reverse()));
      add(mg, new THREE.ExtrudeGeometry(outer, { depth: 0.025, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 }), mat.brushedBrass, [0, 0, 0]);
      add(mg, new THREE.ShapeGeometry(rr(MW, MH, MR), 16), M.matteBlack, [0, 0, 0.004]);
      const mirror = new Reflector(new THREE.ShapeGeometry(rr(MW - 0.004, MH - 0.004, MR), 16), { textureWidth: 512, textureHeight: 768, color: 0xc8c8c8, clipBias: 0.003 });
      mirror.position.set(0, 0, 0.02); mirror.userData.keep = true; mirror.name = 'powder-mirror'; mg.add(mirror);
      // only render the reflection pass when someone is near the powder room
      const cam = ctx.camera; const near = () => { const p = cam.position; return p.x > -0.5 && p.x < 5.5 && p.z > 11.5 && p.z < 18 && p.y < 3.2; };
      mirror.visible = near(); ctx.onUpdate(() => { mirror.visible = near(); });
    }
    // brass sconces with clear glass cylinders either side of the mirror
    for (const sx of [-0.5, 0.52]) {
      const sg = kit.group(vg, [vx + sx, 1.76, 0.004]);
      add(sg, kit.cyl(0.055, 0.055, 0.012, 32), mat.brushedBrass, [0, 0, 0.006], [Math.PI / 2, 0, 0]);
      add(sg, kit.tube([[0, 0, 0.01], [0, 0, 0.06], [0, 0.03, 0.075], [0, 0.07, 0.075]], 0.008, 16), mat.brushedBrass, [0, 0, 0]);
      add(sg, kit.cyl(0.03, 0.022, 0.035, 24), mat.brushedBrass, [0, 0.085, 0.075]);
      const sh = add(sg, kit.cyl(0.032, 0.032, 0.2, 24, ), mat.clearGlass, [0, 0.2, 0.075]); sh.castShadow = false;
      add(sg, kit.torus(0.032, 0.003, 6, 24), mat.brushedBrass, [0, 0.3, 0.075], [Math.PI / 2, 0, 0]);
      add(sg, kit.cyl(0.004, 0.004, 0.13, 8), mat.filament, [0, 0.18, 0.075], [0, 0, 0], { shadow: false });
    }
    // the warm sconce glow (one small non-shadow light)
    const pl = new THREE.PointLight(0xffd6a0, 2.2, 3.2, 2); pl.position.set(mid[0] + n[0] * 0.35, 1.95, mid[1] + n[1] * 0.35); pw.add(pl);
    // ceiling: can, exhaust grille, speaker
    kit.canLights(pw, [[1.75, 14.55]], 3.05);
    add(pw, kit.rbox(0.25, 0.012, 0.25, 0.003), mat.grille, [1.45, 3.045, 15.05]);
    add(pw, kit.cyl(0.11, 0.11, 0.01, 32), mat.speaker, [2.05, 3.045, 15.2]);
    // small framed B&W winter print on the living-room wall (seen in the mirror)
    {
      const art = kit.canvasTex(256, 320, (g, w, h) => {
        const r = kit.rng(5); g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e8eaec'; g.fillRect(28, 28, w - 56, h - 56);
        for (let i = 0; i < 26; i++) { const x = 30 + r() * (w - 60); g.strokeStyle = `rgba(30,32,36,${0.4 + r() * 0.5})`; g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(x, h - 30); g.lineTo(x + (r() - 0.5) * 10, 30 + r() * 80); g.stroke(); }
        g.fillStyle = 'rgba(120,140,160,0.25)'; g.fillRect(28, h - 90, w - 56, 60);
      });
      const fg = kit.group(pw, [1.15, 1.55, 13.60]);
      RB(fg, std({ color: 0xf2f1ed, roughness: 0.5 }), -0.21, -0.26, 0, 0.42, 0.52, 0.03, 0.004);
      add(fg, new THREE.PlaneGeometry(0.38, 0.48), std({ map: art, roughness: 0.4 }), [0, 0, 0.031]);
    }
  }

  // =====================================================================================
  // OFFICE (rect x 17.00..22.80, z 7.20..10.60). Entered from the mudroom (door in the x 16.925 wall);
  // French door to the tennis court centred on the NE wall (x 22.80). p35 looks +x from that doorway.
  // =====================================================================================
  {
    const of = kit.group(root, [0, 0, 0], 0, 'office');
    kit.baseboards(of, [17.00, 7.20, 22.80, 10.60], 0, 0.12, 0.014, M.paintWhite, [{ side: 'x0', from: 9.52, to: 10.38 }, { side: 'x1', from: 7.85, to: 9.55 }]);
    // ceiling: cans, two in-ceiling speakers, return-air grille over the door
    kit.canLights(of, [[18.45, 8.0], [18.45, 9.7], [20.0, 8.0], [20.0, 9.7], [21.45, 8.0], [21.45, 9.6]], 3.05, 0.045);
    for (const [x, z] of [[19.3, 8.85], [21.3, 8.82]]) { add(of, kit.cyl(0.11, 0.11, 0.008, 40), mat.speaker, [x, 3.046, z]); add(of, kit.torus(0.11, 0.006, 6, 40), mat.grille, [x, 3.044, z], [Math.PI / 2, 0, 0]); }
    { const gg = kit.group(of, [22.1, 3.045, 8.75]); add(gg, kit.rbox(0.14, 0.01, 0.42, 0.003), mat.grille, [0, 0, 0]); for (let i = 0; i < 9; i++) add(gg, kit.box(0.11, 0.004, 0.006), M.matteBlack, [0, -0.006, -0.18 + i * 0.045]); }
    // black roller shade (cassette above the door head, fabric part-way down)
    RB(of, mat.shadeFabric, 22.67, 2.60, 7.76, 0.13, 0.22, 1.88, 0.01);
    { const g = new THREE.PlaneGeometry(1.80, 0.2); g.rotateY(-Math.PI / 2); add(of, g, mat.shadeFabric, [22.70, 2.50, 8.70]); RB(of, M.blackMetal, 22.685, 2.38, 7.80, 0.03, 0.025, 1.80, 0.008); }
    // switches / outlets
    const plateAt = (x, y, z, ry) => { const g = kit.group(of, [x, y, z], ry); add(g, kit.rbox(0.075, 0.12, 0.008, 0.003), mat.plate, [0, 0, 0.004]); add(g, kit.rbox(0.035, 0.065, 0.006, 0.002), mat.plate, [0, 0, 0.01]); };
    plateAt(19.68, 1.12, 7.20, 0); plateAt(22.80, 1.15, 9.85, -Math.PI / 2);
    for (const x of [19.2, 19.45]) { const g = kit.group(of, [x, 0.3, 7.20]); add(g, kit.rbox(0.075, 0.12, 0.008, 0.003), mat.plate, [0, 0, 0.004]); for (const y of [-0.025, 0.025]) add(g, kit.rbox(0.035, 0.03, 0.006, 0.004), mat.plate, [0, y, 0.01]); }
    // large framed B&W surf photograph on the left (garage-side) wall
    {
      const art = kit.canvasTex(1024, 840, (g, w, h) => {
        const r = kit.rng(12);
        const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#5c5c5c'); grd.addColorStop(0.55, '#8f8f8f'); grd.addColorStop(1, '#b8b8b8'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) { const y = Math.pow(r(), 0.8) * h; const x = r() * w; const l = 10 + r() * 60 * (0.3 + y / h); g.strokeStyle = r() < 0.5 ? `rgba(30,30,30,${0.15 + r() * 0.25})` : `rgba(230,230,230,${0.12 + r() * 0.25})`; g.lineWidth = 1 + (y / h) * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3 - r() * 3, x + l, y); g.stroke(); }
        // foam / wake band
        for (let i = 0; i < 1400; i++) { const x = r() * w, y = h * (0.6 + r() * 0.22 + 0.06 * Math.sin(x / 140)); g.fillStyle = `rgba(250,250,250,${0.2 + r() * 0.5})`; g.beginPath(); g.ellipse(x, y, 4 + r() * 18, 2 + r() * 5, 0, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(20,20,20,0.85)'; g.fillRect(0, 0, w, 26);
        // elephant on a surfboard (silhouette)
        g.fillStyle = '#efefef'; g.beginPath(); g.ellipse(250, 568, 120, 14, -0.05, 0, 7); g.fill();
        g.fillStyle = '#141414'; g.beginPath(); g.ellipse(222, 470, 62, 42, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(160, 452, 32, 34, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(178, 450, 22, 30, 0.3, 0, 7); g.fill();
        g.lineWidth = 11; g.strokeStyle = '#141414'; g.beginPath(); g.moveTo(138, 470); g.quadraticCurveTo(122, 520, 132, 548); g.stroke();
        for (const lx of [178, 200, 238, 262]) g.fillRect(lx, 490, 15, 70);
        g.fillStyle = '#e8e8e8'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(320 + r() * 120, 560 + r() * 20, 2 + r() * 6, 0, 7); g.fill(); }
        g.fillStyle = '#1a1a1a'; for (const [x, y] of [[880, 620], [910, 650], [850, 660]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillRect(x - 2, y, 4, 14); }
      });
      const fg = kit.group(of, [20.18, 1.875, 7.20]);
      const FW = 1.22, FH = 1.0;
      RB(fg, std({ color: 0xf5f4f0, roughness: 0.45 }), -FW / 2, -FH / 2, 0, FW, FH, 0.045, 0.006);
      add(fg, new THREE.PlaneGeometry(FW - 0.07, FH - 0.07), std({ map: art, roughness: 0.35 }), [0, 0, 0.0465]);
    }
    // wall-mounted TV on an articulating arm (right wall, z 10.60), swung toward the room
    {
      const arm = kit.group(of, [19.1, 1.72, 10.60]);
      RB(arm, mat.tvBody, -0.12, -0.2, -0.02, 0.24, 0.4, 0.02, 0.005);
      add(arm, kit.rbox(0.05, 0.05, 0.22, 0.01), mat.tvBody, [0.05, 0, -0.12]);
      const tv = kit.group(arm, [0.08, 0, -0.24], 0.42); tv.rotation.x = -0.08;
      add(tv, kit.rbox(1.45, 0.835, 0.03, 0.006), mat.tvBody, [-0.55, 0, 0]);
      add(tv, new THREE.PlaneGeometry(1.43, 0.815), mat.tvScreen, [-0.55, 0, -0.0155], [0, Math.PI, 0]);
      phys.solidGroup(tv);
    }
    // rug: ivory with charcoal hatch in diagonal blocks
    {
      const RW = 3.0, RD = 2.7;
      const rugMap = kit.canvasTex(900, 810, (g, w, h) => {
        const img = g.createImageData(w, h); const d = img.data; const r = kit.rng(9);
        const per = 0.042, blk = 0.62;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const uu = (i / w) * RW, vv = (j / h) * RD; const p = (uu + vv) * 0.7071, q = (uu - vv) * 0.7071;
          const a = Math.floor(p / blk), b = Math.floor(q / blk); const t = ((a + 2 * b) % 3 + 3) % 3;
          const s = t === 0 ? q : t === 1 ? p : (uu * 0.38 + vv * 0.92);
          const f = (s / per) - Math.floor(s / per) + 0.08 * Math.sin(uu * 90 + vv * 70);
          const line = (f % 1) < 0.36; const nz = (r() - 0.5) * 40;
          const k = (j * w + i) * 4; const base = line ? 52 : 226;
          d[k] = base + nz + (line ? 0 : 4); d[k + 1] = base + nz; d[k + 2] = base + nz - (line ? 0 : 10); d[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      });
      const rugMat = std({ map: rugMap, roughness: 0.97, normalMap: kit.noiseNormal(256, 3, 96, 6), normalScale: new THREE.Vector2(0.9, 0.9) });
      rugMat.normalMap.repeat.set(4, 4);
      const rg = kit.group(of, [19.85, 0, 8.90], 0.03);
      add(rg, kit.rbox(RW, 0.014, RD, 0.006), rugMat, [0, 0.007, 0]).castShadow = false;
    }
    // glass desk on a polished chrome frame
    const desk = kit.group(of, [20.0, 0, 8.42], 0.137, 'desk');
    {
      const DW = 1.5, DD = 0.76, DT = 0.755, b = 0.045;
      const top = add(desk, kit.rbox(DW, 0.012, DD, 0.004), mat.deskGlass, [0, DT + 0.006, 0]); top.castShadow = false;
      add(desk, kit.box(DW, 0.012, 0.004), mat.deskGlassEdge, [0, DT + 0.006, DD / 2]);
      const ch = M.chrome;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) RB(desk, ch, sx * (DW / 2 - 0.03) - b / 2, 0, sz * (DD / 2 - 0.03) - 0.0125, b, DT, 0.025, 0.006);
      for (const sz of [-1, 1]) RB(desk, ch, -DW / 2 + 0.01, DT - 0.04, sz * (DD / 2 - 0.03) - 0.0125, DW - 0.02, 0.04, 0.025, 0.006);
      for (const sx of [-1, 1]) RB(desk, ch, sx * (DW / 2 - 0.03) - b / 2, DT - 0.04, -DD / 2 + 0.02, b, 0.04, DD - 0.04, 0.006);
      for (const sx of [-1, 1]) RB(desk, ch, sx * (DW / 2 - 0.03) - b / 2, 0, -DD / 2 + 0.02, b, 0.02, DD - 0.04, 0.006);
      const diag = add(desk, kit.rbox(Math.hypot(DW - 0.06, DD - 0.06), 0.02, b, 0.006), ch, [0, 0.01, 0]); diag.rotation.y = Math.atan2(DD - 0.06, DW - 0.06);
      phys.solidGroup(desk);
      // remotes + small succulent (dynamic)
      const rem = (x, z, ry) => { const g = kit.group(desk, [x, DT + 0.012, z], ry); add(g, kit.rbox(0.045, 0.018, 0.2, 0.008), M.matteBlack, [0, 0.009, 0]); phys.dynamic(g, { mass: 0.15 }); };
      rem(-0.5, -0.12, 0.25); rem(-0.38, -0.05, 0.05);
      const pot = kit.group(desk, [0.6, DT + 0.012, 0.12]);
      add(pot, kit.lathe([[0, 0], [0.05, 0], [0.06, 0.08], [0.055, 0.08], [0.05, 0.065], [0, 0.065]], 24), M.paintWhite, [0, 0, 0]);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(pot, kit.sphere(0.022, 10, 8), mat.leaf, [Math.cos(a) * 0.025, 0.09 + (i % 3) * 0.01, Math.sin(a) * 0.025]).scale.set(0.7, 1.3, 0.7); }
      phys.dynamic(pot, { mass: 0.4, shape: 'hull' });
    }
    // black wooden side chair with a leather seat, pulled up to the desk's garage-side edge
    {
      const c = kit.group(of, [19.82, 0, 7.83], 0.1, 'deskChair');
      const SH = 0.46;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(c, kit.cyl(0.016, 0.012, SH, 12), mat.blackWood, [sx * 0.2, SH / 2, sz * 0.19], [sz * 0.06, 0, -sx * 0.04]);
      add(c, kit.cushion(0.46, 0.055, 0.44, 0.02, 0.012), mat.blackLeather, [0, SH + 0.02, 0]);
      for (const sx of [-1, 1]) add(c, kit.cyl(0.014, 0.016, 0.34, 12), mat.blackWood, [sx * 0.2, SH + 0.17, -0.2], [-0.08, 0, 0]);
      const back = []; for (let i = 0; i <= 12; i++) { const a = -0.9 + (i / 12) * 1.8; back.push([Math.sin(a) * 0.25, SH + 0.33, -Math.cos(a) * 0.25 + 0.05]); }
      add(c, kit.tube(back, 0.022, 32), mat.blackWood, [0, 0, 0]);
      for (const sx of [-1, 1]) add(c, kit.cyl(0.008, 0.008, 0.38, 8), mat.blackWood, [0, 0.18, sx * 0.19], [0, 0, Math.PI / 2]);
      phys.solidGroup(c);
    }
    // black velvet swivel barrel chair with a patterned throw pillow, by the French door
    {
      const vel = std({ color: 0x141416, roughness: 0.75, ...(() => { const p = kit.pbrMaps('velour_velvet', '1k', { repeat: [3, 3] }); return { normalMap: p.normalMap }; })(), normalScale: new THREE.Vector2(0.5, 0.5) });
      const c = kit.group(of, [21.95, 0, 7.92], -1.1, 'loungeChair');
      add(c, kit.cyl(0.24, 0.26, 0.03, 40), mat.blackPowder, [0, 0.015, 0]);
      add(c, kit.cyl(0.05, 0.05, 0.14, 20), mat.blackPowder, [0, 0.1, 0]);
      add(c, kit.lathe([[0, 0], [0.3, 0], [0.34, 0.06], [0.35, 0.16], [0.32, 0.2], [0, 0.21]], 48), vel, [0, 0.16, 0]);
      add(c, kit.cushion(0.56, 0.1, 0.5, 0.08, 0.04), vel, [0, 0.42, 0.03]);
      // barrel back: annular sector extruded upward, rounded by the bevel
      const s = new THREE.Shape(); const R0 = 0.38, R1 = 0.27, a0 = -0.35 * Math.PI, a1 = 1.35 * Math.PI;
      s.absarc(0, 0, R0, a0, a1, false); s.absarc(0, 0, R1, a1, a0, true);
      const bg = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 40 });
      bg.rotateX(Math.PI / 2); bg.translate(0, 0.78, 0); add(c, bg, vel, [0, 0, 0], [0, Math.PI, 0]);
      phys.solidGroup(c);
      const pil = kit.canvasTex(256, 256, (g, w, h) => {
        const r = kit.rng(3); g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1b19';
        for (let y = 20; y < h; y += 36) for (let x = 14 + (y % 72 ? 18 : 0); x < w; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 14); g.lineTo(x - 10, y + 14); g.fill(); g.fillRect(x - 12, y + 20, 24, 3 + r() * 2); }
      });
      add(c, kit.cushion(0.42, 0.13, 0.36, 0.06, 0.05), std({ map: pil, roughness: 0.9 }), [0, 0.68, -0.16], [Math.PI / 2 - 0.25, 0, 0]);
    }
    // tall dracaena in a charcoal planter, in the corner left of the door
    {
      const p = kit.group(of, [22.42, 0, 7.62], 0, 'plant');
      add(p, kit.lathe([[0, 0], [0.16, 0], [0.2, 0.08], [0.21, 0.42], [0.2, 0.44], [0.18, 0.43], [0, 0.4]], 40), mat.pot, [0, 0, 0]);
      add(p, kit.cyl(0.18, 0.18, 0.01, 24), std({ color: 0x2e241b, roughness: 1 }), [0, 0.415, 0]);
      const canes = [[0.03, 0.0, 1.05, -0.05, 0.02], [-0.05, 0.04, 1.45, 0.04, -0.05], [0.02, -0.06, 1.8, -0.03, 0.06]];
      canes.forEach(([x, z, hgt, lx, lz], i) => {
        add(p, kit.tube([[x, 0.4, z], [x + lx * 0.5, 0.4 + hgt * 0.5, z + lz * 0.5], [x + lx, 0.4 + hgt, z + lz]], 0.018 - i * 0.002, 12), mat.cane, [0, 0, 0]);
        leafHead(p, x + lx, 0.4 + hgt - 0.05, z + lz, 46, 0.5, 0.05, 30 + i);
      });
      phys.solidGroup(p);
    }
    // black saddle-seat counter stool, right of the door
    {
      const st = kit.group(of, [22.33, 0, 10.18], 0.12, 'stool'); const SH = 0.64;
      const seat = add(st, kit.cushion(0.4, 0.04, 0.26, 0.015, -0.015), mat.blackWood, [0, SH, 0]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(st, kit.cyl(0.018, 0.016, SH, 10), mat.blackWood, [sx * 0.15, SH / 2, sz * 0.09], [sz * -0.06, 0, sx * 0.08]);
      for (const sz of [-1, 1]) add(st, kit.cyl(0.011, 0.011, 0.38, 8), mat.blackWood, [0, 0.22, sz * 0.105], [0, 0, Math.PI / 2]);
      for (const sx of [-1, 1]) add(st, kit.cyl(0.011, 0.011, 0.24, 8), mat.blackWood, [sx * 0.175, 0.2, 0], [Math.PI / 2, 0, 0]);
      phys.solidGroup(st);
      const book = kit.group(st, [0, SH + 0.025, 0], 0.3);
      add(book, kit.rbox(0.17, 0.025, 0.23, 0.003), std({ color: 0x2a3b4a, roughness: 0.8 }), [0, 0.0125, 0]);
      phys.dynamic(book, { mass: 0.5 });
    }
    // linen drape in the far-right corner
    {
      const g = new THREE.PlaneGeometry(0.28, 2.75, 12, 1); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, 0.025 * Math.sin(p.getX(i) * 60));
      g.computeVertexNormals(); g.rotateY(-Math.PI / 2);
      const d = add(of, g, mat.linen, [22.74, 1.4, 10.42]); d.castShadow = false;
      RB(of, M.blackMetal, 22.72, 2.8, 9.7, 0.02, 0.02, 0.88, 0.006);
    }
  }

  // =====================================================================================
  // GARAGE (rect x 11.42..22.80, z 0.65..7.05) — plain 3-car garage: sealed concrete, white walls,
  // LED shop lights, door openers + tracks, white storage cabinets, a few loose things.
  // =====================================================================================
  {
    const ga = kit.group(root, [0, 0, 0], 0, 'garage');
    const conc = std({ ...kit.pbrMaps('concrete_floor_worn_001', '1k', { repeat: [1 / 3, 1 / 3] }), color: 0xd9d7d2, roughness: 0.7 });
    conc.normalScale = new THREE.Vector2(0.6, 0.6);
    kit.floorFinish(ga, 'garage', conc);
    // expansion joints in the slab
    for (const x of [15.2, 19.0]) add(ga, kit.box(0.008, 0.002, 6.4), M.matteBlack, [x, 0.006, 3.85]);
    add(ga, kit.box(11.38, 0.002, 0.008), M.matteBlack, [17.11, 0.006, 3.85]);
    // LED shop lights
    const ledM = std({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 2.4, roughness: 1 });
    for (const x of [13.6, 17.1, 20.6]) for (const z of [2.6, 5.2]) { RB(ga, mat.grille, x - 0.62, 2.99, z - 0.06, 1.24, 0.05, 0.12, 0.01); add(ga, kit.box(1.18, 0.004, 0.08), ledM, [x, 2.988, z], [0, 0, 0], { shadow: false }); }
    // openers: motor head + rail per door, door tracks
    const doors = [[20.45, 2.75], [15.25, 5.50]];
    for (const [dx, dw] of doors) {
      RB(ga, mat.galv, dx - 0.025, 2.56, 0.7, 0.05, 0.05, 3.2, 0.005);
      const mh = kit.group(ga, [dx, 2.6, 4.05]);
      RB(mh, std({ color: 0x6d7276, roughness: 0.5, metalness: 0.2 }), -0.2, -0.1, -0.2, 0.4, 0.2, 0.4, 0.03);
      add(mh, kit.box(0.18, 0.012, 0.12), std({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }), [0, -0.105, 0]);
      for (const sx of [-1, 1]) RB(ga, mat.galv, dx + sx * 0.15 - 0.015, 2.7, 4.04, 0.03, 0.35, 0.03, 0.003);
      for (const sx of [-1, 1]) {
        const x = dx + sx * (dw / 2 + 0.04);
        RB(ga, mat.galv, x - 0.03, 0, 0.66, 0.06, 2.5, 0.06, 0.004);
        RB(ga, mat.galv, x - 0.03, 2.5, 0.66, 0.06, 0.06, 2.9, 0.004);
      }
      RB(ga, std({ color: 0x8c8f92, roughness: 0.4, metalness: 0.6 }), dx - dw / 2, 2.47, 0.67, dw, 0.08, 0.08, 0.03); // torsion spring tube
    }
    // white storage: upper + base cabinets and a tall unit along the NE wall (x 22.80)
    {
      const cab = kit.group(ga, [22.80, 0, 1.5], -Math.PI / 2, 'garageCabinets'); // local +x along +z world, +z into the garage
      RB(cab, mat.lacquer, 0, 0.1, 0, 4.2, 0.8, 0.6, 0.004);
      RB(cab, M.matteBlack, 0.05, 0, 0.05, 4.1, 0.1, 0.5, 0.002);
      RB(cab, std({ color: 0x5c5b58, roughness: 0.6 }), -0.01, 0.9, -0.01, 4.22, 0.03, 0.64, 0.004);
      RB(cab, mat.lacquer, 0, 1.6, 0, 4.2, 0.9, 0.38, 0.004);
      for (let i = 0; i < 6; i++) { const x0 = i * 0.7 + 0.005; shaker(cab, x0, 0.12, 0.6, 0.69, 0.76, mat.lacquer, 0.06); shaker(cab, x0, 1.61, 0.38, 0.69, 0.88, mat.lacquer, 0.06); pull(cab, x0 + (i % 2 ? 0.06 : 0.63), 0.8, 0.62, 0.14); pull(cab, x0 + (i % 2 ? 0.06 : 0.63), 1.7, 0.4, 0.14); }
      phys.boxAABB([22.20, 0, 1.5], [22.80, 0.93, 5.7]); phys.boxAABB([22.42, 1.6, 1.5], [22.80, 2.5, 5.7]);
    }
    // EV charger + electrical panel on the back wall
    { const ev = kit.group(ga, [21.6, 1.25, 7.05]); RB(ev, std({ color: 0xf0f0f0, roughness: 0.3 }), -0.13, -0.18, -0.09, 0.26, 0.36, 0.09, 0.03); add(ev, kit.box(0.08, 0.02, 0.005), std({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 }), [0, 0.1, 0.002]); add(ev, kit.torus(0.12, 0.012, 8, 32, Math.PI * 1.6), M.matteBlack, [0.22, -0.1, -0.03], [0, 0, 0]); }
    RB(ga, std({ color: 0xb9bcbe, roughness: 0.5, metalness: 0.5 }), 13.4, 1.1, 6.95, 0.42, 0.75, 0.1, 0.01);
    // step/landing at the mudroom door
    RB(ga, conc, 11.95, 0, 6.65, 0.9, 0.06, 0.4, 0.01);
    kit.canLights(ga, [[12.4, 6.4]], 3.05);
    // loose items (dynamic): basketball, two cartons, a cone, a bucket
    { const b = add(ga, kit.sphere(0.12, 32, 16), std({ color: 0xc8611d, roughness: 0.7, normalMap: kit.noiseNormal(128, 4, 48, 8), normalScale: new THREE.Vector2(0.6, 0.6) }), [21.6, 0.12, 6.3]); phys.dynamic(b, { mass: 0.6, shape: 'ball', restitution: 0.75 }); }
    for (const [x, z, s, ry] of [[12.3, 1.2, 0.45, 0.1], [12.35, 1.75, 0.38, -0.2]]) { const bx = kit.group(ga, [x, 0, z], ry); add(bx, kit.rbox(s, s * 0.8, s * 0.9, 0.006), mat.cardboard, [0, s * 0.4, 0]); add(bx, kit.box(s * 1.001, 0.003, 0.05), std({ color: 0xc9b998, roughness: 0.4 }), [0, s * 0.8, 0]); phys.dynamic(bx, { mass: 2 }); }
    { const c = kit.group(ga, [21.9, 0, 0.95]); add(c, kit.rbox(0.36, 0.03, 0.36, 0.01), mat.orange, [0, 0.015, 0]); add(c, kit.lathe([[0.13, 0.03], [0.02, 0.7], [0, 0.7]], 24), mat.orange, [0, 0, 0]); phys.dynamic(c, { mass: 0.8, shape: 'hull' }); }
    { const bu = kit.group(ga, [12.1, 0, 4.9]); add(bu, kit.lathe([[0, 0], [0.13, 0], [0.15, 0.36], [0.14, 0.36], [0.12, 0.012], [0, 0.012]], 28), std({ color: 0xf2f2f0, roughness: 0.5 }), [0, 0, 0]); phys.dynamic(bu, { mass: 0.8, shape: 'hull' }); }
  }

  kit.mergeStatic(root);
}
