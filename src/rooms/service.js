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
  p34: { pos: [1.60, 1.18, 13.94], look: [1.116, 1.18, 15.88], fov: 80 },
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
    drum: std({ color: 0x6e7277, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide }),
    drumDark: std({ color: 0x4a4d52, roughness: 0.45, metalness: 0.8 }),
    washerGlass: physMat({ color: 0x14181c, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 0.55, depthWrite: false }),
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
    leaf: std({ color: 0x35582a, roughness: 0.55, side: THREE.DoubleSide }),
    leafDark: std({ color: 0x223d1b, roughness: 0.55, side: THREE.DoubleSide }),
    cane: std({ color: 0x6b5a45, roughness: 0.85 }),
    blackWood: std({ color: 0x151515, roughness: 0.6 }),
    blackLeather: std({ color: 0x141416, roughness: 0.42 }),
    tvBody: std({ color: 0x0c0c0d, roughness: 0.4, metalness: 0.3 }),
    tvScreen: physMat({ color: 0x050506, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.6 }),
    deskGlass: physMat({ color: 0xdaf0e6, roughness: 0.02, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide }),
    deskGlassEdge: physMat({ color: 0x5fae86, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.85 }),
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
  const WP_TILE = 0.95;
  const wallpaperMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    const r = kit.rng(341);
    g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h);
    const n = 3, cells = [];
    for (let layer = 0; layer < 2; layer++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = layer ? 0.5 : 0, oy = layer ? 0.5 : 0;
      cells.push([((i + ox + (j % 2) * 0.25 + (r() - 0.5) * 0.2) / n) * w, ((j + oy + (r() - 0.5) * 0.2) / n) * h, (0.42 + r() * 0.16) * (w / n)]);
    }
    for (let i = cells.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [cells[i], cells[k]] = [cells[k], cells[i]]; }
    const disc = (x, y, R) => {
      g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(x, y, R + 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(226,221,209,0.9)'; g.lineCap = 'round';
      let rad = R * 0.17; const a0 = r() * 6.283;
      while (rad < R - 4) {
        const len = R * 0.062; const cnt = Math.max(8, Math.floor((2 * Math.PI * rad) / (R * 0.062)));
        g.lineWidth = Math.max(1.5, R * 0.019); g.beginPath();
        for (let m = 0; m < cnt; m++) {
          const a = a0 + (m + (rad / R) * 0.5) / cnt * 2 * Math.PI + (r() - 0.5) * 0.04; const c = Math.cos(a), s = Math.sin(a);
          g.moveTo(x + c * rad, y + s * rad); g.lineTo(x + c * (rad + len), y + s * (rad + len));
        }
        g.stroke(); rad += len * 1.95;
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
    g.fillStyle = '#352e29'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      let x = -r() * 100;
      while (x < w) {
        const len = 40 + r() * 260; const v = r();
        g.fillStyle = v < 0.5 ? `rgba(16,11,8,${0.2 + r() * 0.35})` : v < 0.96 ? `rgba(${80 + r() * 28},${68 + r() * 22},${58 + r() * 16},${0.12 + r() * 0.22})` : `rgba(128,108,88,${0.2 + r() * 0.2})`;
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
    add(g, kit.rbox(vertical ? 0.009 : len, vertical ? len : 0.008, 0.008, 0.0035), m, [0, 0, 0.027]);
    for (const s of [-1, 1]) add(g, kit.cyl(0.004, 0.004, 0.026, 10), m, vertical ? [0, s * (len / 2 - 0.015), 0.013] : [s * (len / 2 - 0.015), 0, 0.013], [Math.PI / 2, 0, 0]);
    return g;
  }
  // 5-piece shaker front: full-height stiles + rails as separate bevelled pieces (visible joint seams),
  // centre panel recessed 12 mm. Front face at z + 0.02.
  function shaker(p, x0, y0, z, w, h, m = mat.lacquer, frame = 0.06) {
    const g = kit.group(p, [x0, y0, z]); const f = Math.min(frame, w / 4, h / 4); const D = 0.02, r = 0.0025;
    for (const sx of [f / 2, w - f / 2]) add(g, kit.rbox(f, h, D, r), m, [sx, h / 2, D / 2]);
    for (const sy of [f / 2, h - f / 2]) add(g, kit.rbox(w - 2 * f + 0.002, f, D, r), m, [w / 2, sy, D / 2]);
    add(g, kit.rbox(w - 2 * f + 0.004, h - 2 * f + 0.004, 0.008, 0.0015), m, [w / 2, h / 2, 0.004]);
    return g;
  }
  // dark shadow-line plane behind a bank of doors (shows only through the 3 mm gaps)
  const revealMat = std({ color: 0x6f6e6a, roughness: 0.95 });
  const reveal = (p, x0, y0, z, w, h) => { const m = add(p, new THREE.PlaneGeometry(w, h), revealMat, [x0 + w / 2, y0 + h / 2, z]); m.castShadow = false; return m; };
  // fake contact-shadow / AO gradient card: black, alpha `a0` at the v=1 edge fading to 0 at v=0
  const aoTex = kit.canvasTex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#8a8a8a'); gr.addColorStop(1, '#000000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const aoCard = (p, w, h, pos, rot, a0 = 0.35) => {
    const m = add(p, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: aoTex, transparent: true, opacity: a0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), pos, rot);
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = 1; return m;
  };
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
      g.rotateX(-(0.25 + (1 - up) * 1.35)); g.rotateY(rr() * Math.PI * 2); g.translate(x + (rr() - 0.5) * r, y + rr() * 0.12, z + (rr() - 0.5) * r);
      (i % 3 ? geos1 : geos2).push(g);
    }
    if (geos1.length) add(p, kit.mergeGeometries(geos1), m1, [0, 0, 0]);
    if (geos2.length) add(p, kit.mergeGeometries(geos2), m2, [0, 0, 0]);
  }
  // a garment hanging from a hook by its collar loop: closed, subdivided surface whose cross-section
  // grows from a bunched collar to the full body, with vertical drape folds, optional quilt baffles,
  // a slightly ragged hem and a forward lean. Origin = hook point; hangs down -y, depth along +z.
  function garmentGeo(len, w, d, { quilt = 0, folds = 5, seed = 1, lean = 0.04, topW = 0.035 } = {}) {
    const rr = kit.rng(seed); const ph = rr() * 6.28; const NU = 40, NV = 48; const pos = [], uv = [], idx = [];
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let j = 0; j <= NV; j++) {
      const v = j / NV; const y = -len * v;
      const a = topW + (w / 2 - topW) * sm(0, 0.2, v) + 0.01 * v; const b = 0.02 + (d / 2 - 0.02) * sm(0, 0.28, v);
      const q = quilt ? 1 + 0.09 * (Math.pow(Math.abs(Math.sin(Math.PI * v * quilt)), 0.6) - 0.6) * sm(0.08, 0.2, v) : 1;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, t = u * Math.PI * 2; const c = Math.cos(t), s = Math.sin(t);
        const fold = 1 + 0.07 * Math.sin(t * folds + ph + v * 2.5) * sm(0.12, 0.5, v) + 0.03 * Math.sin(t * 11 + v * 9 + ph);
        const hem = v > 0.97 ? (v - 0.97) * 4 : 0;
        pos.push(a * c * q * fold * (1 - hem), y + 0.012 * Math.sin(t * 3 + ph) * v, b * s * q * fold * (1 - hem) + lean * v * v);
        uv.push(u * 2, v * 2);
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b2 = a + NU + 1; idx.push(a, a + 1, b2, b2, a + 1, b2 + 1); }
    // bottom cap
    const cIdx = pos.length / 3; pos.push(0, -len, lean * 0.95); uv.push(0.5, 2);
    const last = NV * (NU + 1); for (let i = 0; i < NU; i++) idx.push(last + i, last + i + 1, cIdx);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
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
    // nook back panel: recessed centre panel inside a 4 cm applied frame
    const BY = 0.48; // bench seat height (top of the lip)
    RB(bi, mat.lacquer, 0.03, BY - 0.02, 0, 1.49, 1.92 - BY + 0.02, 0.018, 0.002);
    {
      const fx0 = 0.03, fx1 = 1.515, fy0 = BY, fy1 = 1.92, FWd = 0.04, FD = 0.014;
      RB(bi, mat.lacquer, fx0, fy0, 0.018, FWd, fy1 - fy0, FD, 0.002); RB(bi, mat.lacquer, fx1 - FWd, fy0, 0.018, FWd, fy1 - fy0, FD, 0.002);
      RB(bi, mat.lacquer, fx0 + FWd, fy1 - FWd, 0.018, fx1 - fx0 - 2 * FWd, FWd, FD, 0.002); RB(bi, mat.lacquer, fx0 + FWd, fy0, 0.018, fx1 - fx0 - 2 * FWd, FWd, FD, 0.002);
      // soft AO: under the uppers (top of niche), into both side corners, and along the bench/back joint
      aoCard(bi, fx1 - fx0, 0.9, [(fx0 + fx1) / 2, fy1 - 0.45, 0.033], [0, 0, 0], 0.32);
      aoCard(bi, fx1 - fx0, 0.22, [(fx0 + fx1) / 2, fy0 + 0.11, 0.033], [0, 0, Math.PI], 0.28);
      aoCard(bi, fy1 - fy0, 0.36, [fx0 + 0.001, (fy0 + fy1) / 2, 0.2], [0, Math.PI / 2, -Math.PI / 2], 0.3);
      aoCard(bi, fy1 - fy0, 0.36, [fx1 - 0.001, (fy0 + fy1) / 2, 0.2], [0, -Math.PI / 2, Math.PI / 2], 0.3);
      aoCard(bi, fx1 - fx0, 0.3, [(fx0 + fx1) / 2, BY + 0.002, 0.182], [-Math.PI / 2, 0, 0], 0.3);
      aoCard(bi, fx1 - fx0, FZ - 0.02, [(fx0 + fx1) / 2, 1.92 - 0.002, (FZ - 0.02) / 2], [Math.PI / 2, 0, Math.PI], 0.22);
    }
    // hooks (6 black double-prong robe hooks, evenly over ~1.1 m)
    const hookX = Array.from({ length: 6 }, (_, i) => 0.22 + i * 0.226);
    for (const hx of hookX) {
      const hg = kit.group(bi, [hx, 1.77, 0.032]);
      add(hg, kit.rbox(0.022, 0.06, 0.008, 0.003), M.blackMetal, [0, 0.005, 0.004]);
      add(hg, kit.tube([[0, 0.02, 0.006], [0, 0.018, 0.035], [0, 0.03, 0.058], [0, 0.06, 0.066]], 0.0042, 20), M.blackMetal, [0, 0, 0]);
      add(hg, kit.sphere(0.0055, 10, 8), M.blackMetal, [0, 0.061, 0.066]);
      add(hg, kit.tube([[0, -0.012, 0.006], [0, -0.03, 0.04], [0, -0.035, 0.075], [0, -0.015, 0.09]], 0.0048, 20), M.blackMetal, [0, 0, 0]);
      add(hg, kit.sphere(0.006, 10, 8), M.blackMetal, [0, -0.014, 0.09]);
    }
    // coats on hooks 2 and 3: black quilted puffer (baffles) and an olive wool blazer, both draped meshes
    {
      const nylon = physMat({ color: 0x0f1012, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color(0x3a3d44), sheenRoughness: 0.5 });
      const olive = kit.fabric.linen('#5d5026', { scale: 5, normalScale: 0.9 });
      const hookPt = (i) => [hookX[i], 1.835, 0.115];
      const pf = add(bi, garmentGeo(0.56, 0.2, 0.11, { quilt: 7, folds: 4, seed: 3, lean: 0.03 }), nylon, hookPt(1)); pf.rotation.z = 0.03;
      // puffer sleeve bundled at the front
      add(bi, garmentGeo(0.42, 0.075, 0.07, { quilt: 6, folds: 3, seed: 8, lean: 0.02, topW: 0.03 }), nylon, [hookX[1] - 0.04, 1.75, 0.165]).rotation.z = -0.05;
      const bz = add(bi, garmentGeo(0.62, 0.22, 0.1, { folds: 6, seed: 5, lean: 0.035, topW: 0.03 }), olive, hookPt(2)); bz.rotation.z = -0.025;
      // blazer sleeve + lapel edge hanging in front
      add(bi, garmentGeo(0.52, 0.07, 0.055, { folds: 3, seed: 11, lean: 0.015, topW: 0.028 }), olive, [hookX[2] + 0.055, 1.74, 0.16]).rotation.z = 0.04;
      add(bi, garmentGeo(0.45, 0.05, 0.03, { folds: 2, seed: 13, lean: 0.01, topW: 0.02 }), olive, [hookX[2] - 0.05, 1.76, 0.17]).rotation.z = 0.08;
    }
    // bench: carcass, overhanging seat with a front lip, two drawers, recessed toe kick
    RB(bi, mat.lacquer, 0.03, 0.1, 0.02, 1.49, BY - 0.135, FZ - 0.04, 0.003);
    RB(bi, std({ color: 0xd9d8d3, roughness: 0.6 }), 0.05, 0, 0.02, 1.45, 0.1, FZ - 0.095, 0.002);
    RB(bi, mat.lacquer, 0.03, BY - 0.035, 0.0, 1.49, 0.035, FZ + 0.012, 0.004);
    reveal(bi, 0.035, 0.105, FZ - 0.0195, 1.48, BY - 0.145);
    shaker(bi, 0.04, 0.115, FZ - 0.02, 0.733, BY - 0.155, mat.lacquer, 0.055);
    shaker(bi, 0.776, 0.115, FZ - 0.02, 0.733, BY - 0.155, mat.lacquer, 0.055);
    pull(bi, 0.405, 0.115 + (BY - 0.155) / 2, FZ, 0.12, false); pull(bi, 1.143, 0.115 + (BY - 0.155) / 2, FZ, 0.12, false);
    // upper cabinets over the nook (2 rows of 4 doors), carcass full depth
    RB(bi, mat.lacquer, 0.03, 1.92, 0, 1.635, H - 1.92, FZ - 0.02, 0.003);
    reveal(bi, 0.035, 1.94, FZ - 0.0195, 0.743, H - 1.95); reveal(bi, 0.81, 1.94, FZ - 0.0195, 0.743, H - 1.95);
    const updx = [[0.035, 0.37], [0.408, 0.37], [0.81, 0.37], [1.183, 0.37]];
    for (const [x0, w] of updx) { shaker(bi, x0, 1.945, FZ - 0.02, w, 0.265, mat.lacquer, 0.06); shaker(bi, x0, 2.213, FZ - 0.02, w, 0.82, mat.lacquer, 0.06); }
    pull(bi, 0.37, 2.06, FZ, 0.12); pull(bi, 0.43, 2.06, FZ, 0.12); pull(bi, 1.15, 2.06, FZ, 0.12); pull(bi, 1.21, 2.06, FZ, 0.12);
    // partition between nook and laundry column
    RB(bi, mat.lacquer, 1.515, 0, 0, 0.15, 1.92, FZ, 0.004);
    // laundry column: niche for stacked Miele washer + dryer, cabinet above
    RB(bi, mat.lacquer, 1.665, 1.81, 0, 0.67, H - 1.81, FZ - 0.02, 0.003);
    reveal(bi, 1.668, 1.812, FZ - 0.0195, 0.66, H - 1.83);
    shaker(bi, 1.67, 1.815, FZ - 0.02, 0.3265, H - 1.835, mat.lacquer, 0.06); shaker(bi, 1.9995, 1.815, FZ - 0.02, 0.3265, H - 1.835, mat.lacquer, 0.06);
    pull(bi, 1.955, 1.95, FZ, 0.16); pull(bi, 2.04, 1.95, FZ, 0.16);
    RB(bi, mat.lacquerEdge, 1.665, 0, 0, 0.65, 1.81, 0.015, 0.002); // niche back
    aoCard(bi, 0.65, 0.5, [1.99, 1.81 - 0.25, 0.017], [0, 0, 0], 0.3);
    aoCard(bi, 0.65, FZ - 0.02, [1.99, 1.81 - 0.002, (FZ - 0.02) / 2], [Math.PI / 2, 0, Math.PI], 0.25);
    RB(bi, mat.lacquer, 2.315, 0, 0, 0.03, H, FZ, 0.003); // right side panel of the niche
    // tall pantry / broom cabinets to the right (to the foyer wall)
    const tallX = [[2.345, 0.79], [3.135, 0.79]];
    RB(bi, mat.lacquer, 2.345, 0, 0, 1.58, H, FZ - 0.02, 0.003);
    reveal(bi, 2.35, 0.1, FZ - 0.0195, 1.57, H - 0.12);
    RB(bi, std({ color: 0xd9d8d3, roughness: 0.6 }), 2.36, 0, FZ - 0.09, 1.56, 0.1, 0.02, 0.002);
    for (const [x0, w] of tallX) {
      shaker(bi, x0 + 0.0015, 0.1, FZ - 0.02, w - 0.003, 1.66, mat.lacquer, 0.06);
      shaker(bi, x0 + 0.0015, 1.763, FZ - 0.02, w - 0.003, 1.257, mat.lacquer, 0.06);
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
        g.fillStyle = '#e9e9e7'; g.fillRect(20, 612, 472, 104); g.strokeStyle = '#cfcfcd'; g.lineWidth = 2; g.strokeRect(20, 612, 472, 104);
        g.fillStyle = '#c0353a'; g.font = '13px Helvetica, Arial'; g.fillText('Easy to Clean Plinth Filter', 50, 640);
        g.fillStyle = '#909090'; g.font = '10px Helvetica, Arial'; g.fillText('Push here to open', 50, 658);
        g.fillStyle = '#b5b5b3'; for (let i = 0; i < 14; i++) g.fillRect(352 + i * 8, 626, 4, 76);
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
      add(g, kit.rbox(0.158, 0.05, 0.005, 0.002), mat.blackGlass, [-0.0035, 0.805, 0.603]); // display strip
      add(g, kit.torus(0.034, 0.005, 10, 40), M.chrome, [0.205, 0.797, 0.606]);
      // porthole door: white outer ring, ~3 cm chrome bezel, dark tinted glass bowl (0.30 m), drum behind
      const dy = dryer ? 0.495 : 0.486; const R = 0.236;
      const door = kit.group(g, [0.005, dy, 0.6]);
      add(door, kit.lathe([[0.18, 0.0], [R, 0.0], [R + 0.004, 0.02], [R - 0.008, 0.042], [0.184, 0.046], [0.18, 0.04]], 72), mat.applWhite, [0, 0, 0], [Math.PI / 2, 0, 0]);
      add(door, kit.lathe([[0.183, 0.036], [0.187, 0.05], [0.18, 0.062], [0.162, 0.066], [0.152, 0.06], [0.149, 0.044], [0.149, 0.02]], 72), M.chrome, [0, 0, 0], [Math.PI / 2, 0, 0]);
      add(door, kit.torus(R + 0.002, 0.005, 8, 72), M.chrome, [0, 0, 0.022]);
      const Rs = 0.339; const glass = add(door, new THREE.SphereGeometry(Rs, 64, 8, 0, Math.PI * 2, 0, 0.4585), mat.washerGlass, [0, 0, 0.072 - Rs], [Math.PI / 2, 0, 0]);
      glass.castShadow = false; glass.renderOrder = 2;
      add(door, kit.lathe([[0.149, 0.03], [0.152, -0.04], [0.14, -0.26], [0.0, -0.27]], 48), mat.drum, [0, 0, 0], [Math.PI / 2, 0, 0]);
      add(door, kit.torus(0.13, 0.012, 8, 48), mat.drumDark, [0, 0, -0.05]);
      const cl = dryer ? [0x2f3540, 0x5a4c44] : [0x3a3036, 0x23272e];
      add(door, kit.cushion(0.16, 0.06, 0.1, 0.03, 0.03), std({ color: cl[0], roughness: 0.95 }), [0.01, -0.09, -0.13], [0.4, 0.3, 0.25]);
      add(door, kit.cushion(0.12, 0.05, 0.09, 0.025, 0.025), std({ color: cl[1], roughness: 0.95 }), [-0.05, -0.1, -0.17], [0.2, -0.5, -0.3]);
      return g;
    }
    miele(0.0, false); miele(0.852, true);
    // physics: bench, partitions, columns
    const wx = (lx) => 15.195 - lx; const zF = 10.60 - FZ;
    phys.boxAABB([wx(1.515), 0, zF], [wx(0.03), BY, 10.60]);
    phys.boxAABB([wx(1.665), 1.92, zF], [wx(0.03), H, 10.60]);
    phys.boxAABB([wx(0.03), 0, zF], [wx(0), H, 10.60]);
    phys.boxAABB([wx(1.665), 0, zF], [wx(1.515), H, 10.60]);
    phys.boxAABB([wx(2.345), 0, zF - 0.06], [wx(1.665), H, 10.60]);
    phys.boxAABB([wx(3.925), 0, zF], [wx(2.345), H, 10.60]);

    // room finishes: baseboards on the open walls, cans
    kit.baseboards(root, [11.27, 7.20, 16.85, 10.60], 0, 0.11, 0.014, M.paintWhite, [
      { side: 'z1', from: 11.27, to: 15.20 }, { side: 'z1', from: 15.47, to: 16.53 }, { side: 'z0', from: 11.95, to: 12.85 }, { side: 'x1', from: 9.52, to: 10.38 },
    ]);
    // p13 shows a white painted leaf on this door: repaint our own opening's leaf (shell builds it in oak)
    { const dk = (ctx.doors || []).find(d => d.o && d.o.id === 'mud-k'); if (dk) { const wp = std({ color: 0xf3f2ee, roughness: 0.42 }); dk.g.traverse(o => { if (o.isMesh && o.material === M.oakDoor) o.material = wp; }); } }
    // mudroom -> kitchen door (mud-k, x 15.55..16.45, head 2.40): painted white casing on the mudroom face
    // and white jamb liners through the wall (p13 shows a white cased opening, not an oak jamb)
    {
      const cw = 0.07, ct = 0.018, x0 = 15.55, x1 = 16.45, hd = 2.40, zf = 10.60;
      const trim = std({ color: 0xf3f2ee, roughness: 0.45 });
      RB(root, trim, x0 - cw, 0, zf - ct, cw, hd + cw, ct, 0.003); RB(root, trim, x1, 0, zf - ct, cw, hd + cw, ct, 0.003);
      RB(root, trim, x0 - cw, hd, zf - ct, x1 - x0 + 2 * cw, cw, ct, 0.003);
      RB(root, trim, x0, 0, zf - 0.001, 0.012, hd, 0.152, 0.002); RB(root, trim, x1 - 0.012, 0, zf - 0.001, 0.012, hd, 0.152, 0.002);
      RB(root, trim, x0, hd - 0.012, zf - 0.001, x1 - x0, 0.012, 0.152, 0.002);
      // plinth blocks
      for (const x of [x0 - cw - 0.004, x1 - 0.004]) RB(root, trim, x, 0, zf - ct - 0.004, cw + 0.008, 0.12, ct + 0.004, 0.002);
    }
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
    const P1 = [1.55, 15.85], P2 = [0.65, 14.95]; const H = 3.05; const UA = 2.50 - P1[0]; // 45-degree chamfer (p34)
    const L = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    const u = [(P2[0] - P1[0]) / L, (P2[1] - P1[1]) / L]; const n = [-u[1], u[0]]; // (0.878,-0.477) into the room
    if (n[0] < 0) { n[0] *= -1; n[1] *= -1; }
    const prism = kit.extrude([[P1[0], -P1[1]], [P2[0], -P2[1]], [0.60, -P2[1]], [0.60, -15.90], [P1[0], -15.90]], H); prism.rotateX(-Math.PI / 2);
    add(pw, prism, M.paintWhite, [0, 0, 0]); phys.trimesh(prism);
    // wall finishes
    panel(pw, P1, P2, 0, H, n, wallpaper, 0.004, UA);
    panel(pw, [2.50, 15.85], P1, 0, H, [0, -1], wallpaper, 0.004, 0);
    // C wall around the real window pow-win (plan.js: z 14.07..14.87, y 1.00..2.60)
    const W0 = 14.07, W1 = 14.87, WS = 1.00, WH = 2.60;
    panel(pw, P2, [0.65, 13.60], 0, WS, [1, 0], wallpaper, 0.004, UA + L);
    panel(pw, P2, [0.65, 13.60], WH, H, [1, 0], wallpaper, 0.004, UA + L);
    panel(pw, [0.65, W0], [0.65, 13.60], WS, WH, [1, 0], wallpaper, 0.004, UA + L + (P2[1] - W0));
    panel(pw, P2, [0.65, W1], WS, WH, [1, 0], wallpaper, 0.004, UA + L);
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
      const x0 = 1.70, x1 = 2.30, y0 = 1.05, y1 = 2.42, z = 15.85; const fw = 0.05;
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
    const VW = 0.82, VD = 0.45, VT = 0.86, BT = 0.15; const vx = 0;
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
    const MW = 0.65, MH = 0.95, MY = 1.15, MR = 0.08;
    const rr = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    {
      const mg = kit.group(vg, [vx, MY + MH / 2, 0.012]);
      const outer = rr(MW + 0.018, MH + 0.018, MR + 0.009); outer.holes.push(new THREE.Path(rr(MW, MH, MR).getPoints(32).reverse()));
      add(mg, new THREE.ExtrudeGeometry(outer, { depth: 0.025, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 }), mat.brushedBrass, [0, 0, 0]);
      add(mg, new THREE.ShapeGeometry(rr(MW, MH, MR), 16), M.matteBlack, [0, 0, 0.004]);
      const mirror = new Reflector(new THREE.ShapeGeometry(rr(MW - 0.004, MH - 0.004, MR), 16), { textureWidth: 512, textureHeight: 768, color: 0xc8c8c8, clipBias: 0.003 });
      mirror.position.set(0, 0, 0.02); mirror.userData.keep = true; mirror.name = 'powder-mirror'; mg.add(mirror);
      // only render the reflection pass when someone is near the powder room
      const cam = ctx.camera; const near = () => { const p = cam.position; return p.x > -0.5 && p.x < 5.5 && p.z > 11.5 && p.z < 18 && p.y < 3.2; };
      mirror.visible = near(); ctx.onUpdate(() => { mirror.visible = near(); });
    }
    // brass sconces with clear glass cylinders either side of the mirror
    for (const sx of [-0.49, 0.49]) {
      const sg = kit.group(vg, [vx + sx, 1.55, 0.004]);
      add(sg, kit.cyl(0.055, 0.055, 0.012, 32), mat.brushedBrass, [0, 0, 0.006], [Math.PI / 2, 0, 0]);
      add(sg, kit.tube([[0, 0, 0.01], [0, 0, 0.06], [0, 0.03, 0.075], [0, 0.07, 0.075]], 0.008, 16), mat.brushedBrass, [0, 0, 0]);
      add(sg, kit.cyl(0.03, 0.022, 0.035, 24), mat.brushedBrass, [0, 0.085, 0.075]);
      const sh = add(sg, kit.cyl(0.032, 0.032, 0.2, 24, ), mat.clearGlass, [0, 0.2, 0.075]); sh.castShadow = false;
      add(sg, kit.torus(0.032, 0.003, 6, 24), mat.brushedBrass, [0, 0.3, 0.075], [Math.PI / 2, 0, 0]);
      add(sg, kit.cyl(0.004, 0.004, 0.13, 8), mat.filament, [0, 0.18, 0.075], [0, 0, 0], { shadow: false });
    }
    // the warm sconce glow (one small non-shadow light)
    const pl = new THREE.PointLight(0xffecd8, 3.2, 3.4, 2); pl.position.set(mid[0] + n[0] * 0.35, 1.95, mid[1] + n[1] * 0.35); pw.add(pl);
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
    // warm cream paint on the office walls (p35 reads ~#EDE6DA, not cold white)
    {
      const cream = std({ color: 0xf1ece4, roughness: 0.9 });
      panel(of, [17.00, 7.20], [22.80, 7.20], 0, 3.05, [0, 1], cream, 0.003);
      panel(of, [22.80, 10.60], [17.00, 10.60], 0, 3.05, [0, -1], cream, 0.003);
      panel(of, [22.80, 7.20], [22.80, 7.85], 0, 3.05, [-1, 0], cream, 0.003);
      panel(of, [22.80, 9.55], [22.80, 10.60], 0, 3.05, [-1, 0], cream, 0.003);
      panel(of, [22.80, 7.85], [22.80, 9.55], 2.60, 3.05, [-1, 0], cream, 0.003);
      // warm daylight bounce from the French door (non-shadow)
      const wl = new THREE.PointLight(0xffeedd, 3.0, 4.6, 1.8); wl.position.set(22.1, 1.6, 8.7); of.add(wl);
    }
    // large framed sepia surf photograph (elephant on a surfboard) with a white mat, on the left wall
    {
      const art = kit.canvasTex(1024, 700, (g, w, h) => {
        const r = kit.rng(12);
        const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#3e3933'); grd.addColorStop(0.4, '#7a7064'); grd.addColorStop(1, '#b3a897'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
        // swell lines
        for (let i = 0; i < 3200; i++) { const y = Math.pow(r(), 0.85) * h; const x = r() * w; const l = 8 + r() * 50 * (0.3 + y / h); g.strokeStyle = r() < 0.5 ? `rgba(48,42,36,${0.12 + r() * 0.22})` : `rgba(236,228,214,${0.1 + r() * 0.22})`; g.lineWidth = 1 + (y / h) * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2 - r() * 3, x + l, y); g.stroke(); }
        // breaking foam band across the lower third
        for (let i = 0; i < 2200; i++) { const x = r() * w, y = h * (0.66 + r() * 0.2 + 0.05 * Math.sin(x / 120)); g.fillStyle = `rgba(246,240,228,${0.15 + r() * 0.45})`; g.beginPath(); g.ellipse(x, y, 3 + r() * 14, 1.5 + r() * 4, 0, 0, 7); g.fill(); }
        // elephant standing on a surfboard (left third), spray behind
        const ex = 300, ey = 470; g.fillStyle = '#eeeae0'; g.beginPath(); g.ellipse(ex + 20, ey + 22, 150, 13, -0.04, 0, 7); g.fill();
        g.fillStyle = '#1e1a16';
        g.beginPath(); g.ellipse(ex + 25, ey - 70, 78, 48, 0, 0, 7); g.fill();                 // body
        g.beginPath(); g.ellipse(ex - 52, ey - 92, 38, 40, 0, 0, 7); g.fill();                 // head
        g.beginPath(); g.ellipse(ex - 36, ey - 92, 26, 34, 0.35, 0, 7); g.fill();              // ear
        g.lineWidth = 13; g.strokeStyle = '#1e1a16'; g.beginPath(); g.moveTo(ex - 78, ey - 80); g.quadraticCurveTo(ex - 100, ey - 30, ex - 86, ey + 2); g.stroke(); // trunk
        for (const lx of [-30, -8, 48, 72]) g.fillRect(ex + lx, ey - 40, 17, 52);           // legs
        g.lineWidth = 3; g.beginPath(); g.moveTo(ex + 100, ey - 80); g.lineTo(ex + 112, ey - 52); g.stroke(); // tail
        g.fillStyle = 'rgba(244,238,226,0.8)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(ex + 140 + r() * 140, ey + 10 - r() * 40, 2 + r() * 7, 0, 7); g.fill(); }
        // surfer on a second board to the right, small in the foam
        g.fillStyle = '#efeadf'; g.beginPath(); g.ellipse(760, 560, 60, 7, 0.05, 0, 7); g.fill();
        g.fillStyle = '#1e1a16'; g.beginPath(); g.arc(752, 498, 9, 0, 7); g.fill(); g.fillRect(744, 506, 16, 34); g.fillRect(740, 538, 8, 20); g.fillRect(758, 538, 8, 20);
        g.lineWidth = 5; g.beginPath(); g.moveTo(746, 514); g.lineTo(722, 528); g.moveTo(758, 514); g.lineTo(784, 504); g.stroke();
        // print grain + vignette
        const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,30,20,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      });
      const fg = kit.group(of, [20.05, 1.84, 7.20]);
      const FW = 1.25, FH = 0.95, FR = 0.022, MT = 0.085;
      const frameM = std({ color: 0xf4f2ec, roughness: 0.4 });
      RB(fg, frameM, -FW / 2, -FH / 2, 0, FR, FH, 0.035, 0.004); RB(fg, frameM, FW / 2 - FR, -FH / 2, 0, FR, FH, 0.035, 0.004);
      RB(fg, frameM, -FW / 2 + FR, -FH / 2, 0, FW - 2 * FR, FR, 0.035, 0.004); RB(fg, frameM, -FW / 2 + FR, FH / 2 - FR, 0, FW - 2 * FR, FR, 0.035, 0.004);
      add(fg, new THREE.PlaneGeometry(FW - 2 * FR, FH - 2 * FR), std({ color: 0xf7f5ef, roughness: 0.85 }), [0, 0, 0.012]); // mat
      add(fg, new THREE.PlaneGeometry(FW - 2 * FR - 2 * MT, FH - 2 * FR - 2 * MT), std({ map: art, roughness: 0.5 }), [0, 0, 0.0135]);
      add(fg, new THREE.PlaneGeometry(FW - 2 * FR, FH - 2 * FR), physMat({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.02, depthWrite: false }), [0, 0, 0.03]).castShadow = false;
    }
    // 75" thin-bezel TV on an articulating arm (right wall, z 10.60), swung out toward the desk/camera
    {
      const P0 = [18.0, 1.70, 10.60];
      const mount = kit.group(of, P0);
      RB(mount, mat.tvBody, -0.08, -0.14, -0.02, 0.16, 0.28, 0.02, 0.005);
      add(mount, kit.rbox(0.06, 0.05, 0.12, 0.01), mat.tvBody, [0, 0, -0.08]);
      const tv = kit.group(mount, [0, 0, -0.15], 0.30);
      const TW = 1.68, TH = 0.97;
      add(tv, kit.rbox(TW, TH, 0.028, 0.004), mat.tvBody, [TW / 2 + 0.02, 0, 0]);
      add(tv, kit.rbox(0.5, 0.35, 0.05, 0.02), mat.tvBody, [TW / 2, 0, 0.035]);
      add(tv, new THREE.PlaneGeometry(TW - 0.016, TH - 0.016), mat.tvScreen, [TW / 2 + 0.02, 0, -0.0145], [0, Math.PI, 0]);
      phys.solidGroup(tv);
    }
    // rug: cream ground with soft charcoal hatch in diagonal blocks (wool, Carpet016 pile)
    {
      const RW = 3.0, RD = 2.4;
      const rugMap = kit.canvasTex(1000, 800, (g, w, h) => {
        const img = g.createImageData(w, h); const d = img.data; const r = kit.rng(9);
        const per = 0.042, blk = 0.62;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const uu = (i / w) * RW, vv = (j / h) * RD; const p = (uu + vv) * 0.7071, q = (uu - vv) * 0.7071;
          const a = Math.floor(p / blk), b = Math.floor(q / blk); const t = ((a + 2 * b) % 3 + 3) % 3;
          const s = t === 0 ? q : t === 1 ? p : (uu * 0.38 + vv * 0.92);
          const f = (s / per) - Math.floor(s / per) + 0.1 * Math.sin(uu * 90 + vv * 70) + (r() - 0.5) * 0.18;
          const fr = ((f % 1) + 1) % 1; const line = Math.min(1, 1.7 * Math.max(0, 1 - Math.abs(fr - 0.22) / 0.24)); // soft-edged stripe
          const nz = (r() - 0.5) * 26; const k = (j * w + i) * 4;
          const base = [232, 226, 214], ink = [58, 56, 53];
          for (let c = 0; c < 3; c++) d[k + c] = base[c] + (ink[c] - base[c]) * Math.min(1, line * 1.25) + nz;
          d[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      });
      const cRep = [RW / 0.5, RD / 0.5];
      const rugMat = physMat({ map: rugMap, roughness: 1, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xd8d2c6),
        normalMap: kit.tex('assets/acg/Carpet016/Carpet016_NormalGL.jpg', { repeat: cRep }), normalScale: new THREE.Vector2(1.1, 1.1),
        aoMap: kit.tex('assets/acg/Carpet016/Carpet016_AmbientOcclusion.jpg', { repeat: cRep }), aoMapIntensity: 0.8 });
      const rg = kit.group(of, [19.85, 0, 8.90], 0.03);
      const rug = add(rg, kit.rbox(RW, 0.014, RD, 0.006), rugMat, [0, 0.007, 0]); rug.castShadow = false;
    }
    // glass desk on a polished chrome frame
    const desk = kit.group(of, [20.0, 0, 8.42], 0.137, 'desk');
    {
      const DW = 1.5, DD = 0.76, DT = 0.755, b = 0.045;
      const top = add(desk, kit.rbox(DW, 0.012, DD, 0.004), mat.deskGlass, [0, DT + 0.006, 0]); top.castShadow = false;
      for (const sz of [-1, 1]) add(desk, kit.box(DW - 0.004, 0.012, 0.004), mat.deskGlassEdge, [0, DT + 0.006, sz * (DD / 2 - 0.001)]);
      for (const sx of [-1, 1]) add(desk, kit.box(0.004, 0.012, DD - 0.004), mat.deskGlassEdge, [sx * (DW / 2 - 0.001), DT + 0.006, 0]);
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
      const vel = kit.fabric.velvet('#0d0d0f', { scale: 3, sheenColor: '#2c2c31' });
      const c = kit.group(of, [21.9, 0, 7.98], -1.1, 'loungeChair'); c.scale.setScalar(1.18);
      add(c, kit.cyl(0.24, 0.26, 0.03, 40), mat.blackPowder, [0, 0.015, 0]);
      add(c, kit.cyl(0.05, 0.05, 0.14, 20), mat.blackPowder, [0, 0.1, 0]);
      add(c, kit.lathe([[0, 0], [0.3, 0], [0.34, 0.06], [0.35, 0.16], [0.32, 0.2], [0, 0.21]], 48), vel, [0, 0.16, 0]);
      add(c, kit.cushion(0.56, 0.1, 0.5, 0.08, 0.04), vel, [0, 0.42, 0.03]);
      // barrel back: annular sector extruded upward, rounded by the bevel
      const s = new THREE.Shape(); const R0 = 0.38, R1 = 0.25, a0 = -0.3 * Math.PI, a1 = 1.3 * Math.PI;
      s.absarc(0, 0, R0, a0, a1, false); s.absarc(0, 0, R1, a1, a0, true);
      const bg = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.07, bevelSegments: 6, curveSegments: 48 });
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
      const canes = [[0.03, 0.0, 0.62, -0.12, 0.05], [-0.05, 0.04, 0.95, 0.1, -0.12], [0.02, -0.06, 1.15, -0.06, 0.14], [0.05, 0.05, 0.8, 0.16, 0.1], [-0.04, -0.03, 1.25, 0.02, -0.02]];
      canes.forEach(([x, z, hgt, lx, lz], i) => {
        add(p, kit.tube([[x, 0.4, z], [x + lx * 0.4, 0.4 + hgt * 0.5, z + lz * 0.4], [x + lx, 0.4 + hgt, z + lz]], 0.016 - i * 0.0015, 12), mat.cane, [0, 0, 0]);
        leafHead(p, x + lx, 0.4 + hgt - 0.05, z + lz, 70, 0.62, 0.06, 30 + i);
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
