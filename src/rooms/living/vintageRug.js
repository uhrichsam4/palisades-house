// Faded / abraded vintage rug (Oushak / distressed Persian look) shared by the living room (p03) and the
// primary bedroom (p17). Canvas-drawn pattern in the photo palette + heavy wear, Carpet016 pile normal/AO,
// a thin pile slab with a slight corner curl, overcast selvedges and knotted fringe (InstancedMesh) on the
// short ends. Long axis = local x. Returns the group (sitting on y = 0 of `parent`).
//   vintageRug(ctx, parent, { L, W, pos, ry, seed, pal })
//   pal: { field, fieldDark, border, borderDark, motifA, motifB, motifC, warp, fringe }  ([r,g,b] 0..255)

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function valueGrid(r, nx, ny) {
  const g = new Float32Array(nx * ny); for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    x = Math.max(0, Math.min(nx - 1.001, x)); y = Math.max(0, Math.min(ny - 1.001, y));
    const xi = x | 0, yi = y | 0, xf = x - xi, yf = y - yi; const s = t => t * t * (3 - 2 * t);
    const a = g[yi * nx + xi], b = g[yi * nx + xi + 1], c = g[(yi + 1) * nx + xi], d = g[(yi + 1) * nx + xi + 1];
    const u = s(xf), v = s(yf); return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
}

function drawRug(kit, L, W, seed, pal) {
  const CW = 2048, CH = Math.round(CW * W / L);
  return kit.canvasTex(CW, CH, (g, w, h) => {
    const r = kit.rng(seed);
    const px = w / L;                             /* pixels per metre */
    g.fillStyle = css(pal.field); g.fillRect(0, 0, w, h);
    const B0 = 0.07 * px, B1 = 0.30 * px;        /* outer guard .. inner edge of the main border */
    /* main border band (darker), guard stripes */
    g.fillStyle = css(pal.border); g.fillRect(B0, B0, w - 2 * B0, h - 2 * B0);
    g.fillStyle = css(pal.field); g.fillRect(B1, B1, w - 2 * B1, h - 2 * B1);
    const stripe = (ins, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.strokeRect(ins, ins, w - 2 * ins, h - 2 * ins); };
    stripe(B0 * 0.45, 0.018 * px, css(pal.borderDark, 0.85));
    stripe(B0 + 0.012 * px, 0.010 * px, css(pal.motifC, 0.7));
    stripe(B1 - 0.012 * px, 0.010 * px, css(pal.motifC, 0.7));
    stripe(B1 + 0.02 * px, 0.022 * px, css(pal.borderDark, 0.55));
    /* border meander: running vine + cartouche rosettes along the band */
    const mid = (B0 + B1) / 2, bw = (B1 - B0);
    const runs = [[mid, mid, w - mid, mid], [mid, h - mid, w - mid, h - mid], [mid, mid, mid, h - mid], [w - mid, mid, w - mid, h - mid]];
    for (const [x0, y0, x1, y1] of runs) {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / (bw * 1.1)); const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      g.strokeStyle = css(pal.borderDark, 0.6); g.lineWidth = 0.008 * px; g.beginPath();
      for (let i = 0; i <= n * 8; i++) { const t = i / (n * 8) * len, s = Math.sin(i / 8 * Math.PI) * bw * 0.22; g.lineTo(x0 + ux * t - uy * s, y0 + uy * t + ux * s); } g.stroke();
      for (let i = 0; i <= n; i++) {
        const cx = x0 + ux * len * i / n, cy = y0 + uy * len * i / n; const col = i % 2 ? pal.motifA : pal.motifB;
        g.fillStyle = css(col, 0.5); g.beginPath();
        for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283; const rr = bw * (k % 2 ? 0.16 : 0.30); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill();
        g.fillStyle = css(pal.field, 0.7); g.beginPath(); g.arc(cx, cy, bw * 0.07, 0, 6.283); g.fill();
      }
    }
    /* field: Oushak-scale ogival lattice of vines with palmettes at the nodes + small floral fill */
    g.save(); g.beginPath(); g.rect(B1 + 0.04 * px, B1 + 0.04 * px, w - 2 * B1 - 0.08 * px, h - 2 * B1 - 0.08 * px); g.clip();
    const cx = w / 2, cy = h / 2, SX = 0.40 * px, SY = 0.28 * px;
    g.lineWidth = 0.007 * px; g.strokeStyle = css(pal.borderDark, 0.45);
    for (let k = -12; k <= 12; k++) for (const sgn of [-1, 1]) {
      g.beginPath();
      for (let i = -60; i <= 60; i++) { const t = i / 60 * 9; const x = cx + t * SX, y = cy + (k + 0.5 * Math.sin(t * Math.PI) * sgn) * SY; g.lineTo(x, y); }
      g.stroke();
    }
    const palmette = (x, y, s, col, col2) => {
      g.fillStyle = css(col, 0.5); g.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283; const k = 1 + 0.35 * Math.abs(Math.sin(a * 3)); g.lineTo(x + Math.cos(a) * s * k, y + Math.sin(a) * s * 0.75 * k); } g.fill();
      g.fillStyle = css(col2, 0.45); g.beginPath(); g.ellipse(x, y, s * 0.42, s * 0.3, 0, 0, 6.283); g.fill();
      g.strokeStyle = css(pal.fieldDark, 0.3); g.lineWidth = 0.004 * px; g.beginPath(); g.ellipse(x, y, s * 0.9, s * 0.65, 0, 0, 6.283); g.stroke();
    };
    for (let j = -12; j <= 12; j++) for (let i = -9; i <= 9; i++) {
      const x = cx + i * SX * 0.5 * 2, y = cy + j * SY; const odd = (i + j) & 1;
      palmette(x + (j & 1) * SX * 0.5, y, (odd ? 0.045 : 0.07) * px, odd ? pal.motifB : pal.motifA, odd ? pal.motifC : pal.motifB);
    }
    for (let i = 0; i < 4200; i++) {
      const x = r() * w, y = r() * h, s = (0.006 + r() * 0.012) * px; const c = [pal.motifA, pal.motifB, pal.motifC, pal.fieldDark, pal.fieldDark, pal.borderDark][(r() * 6) | 0];
      g.fillStyle = css(c, 0.4 + r() * 0.35); g.beginPath();
      for (let k = 0; k <= 10; k++) { const a = k / 10 * 6.283; const rr = s * (k % 2 ? 0.45 : 1); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
    }
    /* faint central medallion */
    g.translate(cx, cy);
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = css(k % 2 ? pal.motifA : pal.fieldDark, 0.22); g.lineWidth = 0.02 * px; g.beginPath();
      for (let a = 0; a <= 6.3; a += 0.03) { const rr = (0.55 - k * 0.15) * px * (1 + 0.12 * Math.sin(a * 8)); g.lineTo(Math.cos(a) * rr * 1.35, Math.sin(a) * rr); }
      g.closePath(); g.stroke();
    }
    g.restore();

    /* per-pixel: abrash bands across the width, overdye mottle, abrasion to the pale warp, knot speckle, fade */
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const big = valueGrid(r, 10, 8), mot = valueGrid(r, 28, 20), streak = valueGrid(r, 160, 14), fine = valueGrid(r, 420, 60);
    const ab = new Float32Array(w); for (let x = 0, v = 0; x < w; x++) { if (x % 6 === 0) v = (r() - 0.5); ab[x] = ab[x - 1] !== undefined ? ab[x - 1] * 0.92 + v * 0.08 : v; }
    const wp = pal.warp;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const u = x / w, v = y / h;
      let R = d[i], G = d[i + 1], Bl = d[i + 2];
      const m = big(u * 9, v * 7) - 0.5, mm = mot(u * 27, v * 19) - 0.5;
      const fz = fine(u * 419 + 7.7, v * 59) - 0.5;
      const k = 1 + ab[x] * 0.12 + m * 0.12 + mm * 0.08 + fz * 0.22;
      R *= k; G *= k * (1 - m * 0.03); Bl *= k * (1 + m * 0.04);
      /* abrasion: pile worn down to the pale warp/weft in streaky patches, heaviest in the traffic area */
      const traffic = 1 - 0.6 * Math.hypot(u - 0.5, (v - 0.5) * 0.7);
      const wn = big(u * 9 + 3.1, v * 7) * 0.45 + streak(u * 159, v * 13) * 0.35 + fine(u * 419, v * 59) * 0.2;
      const wear = smooth(0.52, 0.80, wn * (0.75 + 0.35 * traffic)) * 0.5;
      R += (wp[0] - R) * wear; G += (wp[1] - G) * wear; Bl += (wp[2] - Bl) * wear;
      /* fade + slight desaturation */
      const L0 = (R + G + Bl) / 3; R = R + (L0 - R) * 0.28; G = G + (L0 - G) * 0.28; Bl = Bl + (L0 - Bl) * 0.28;
      const n = (r() - 0.5) * 18; d[i] = R + n; d[i + 1] = G + n; d[i + 2] = Bl + n * 0.95;
    }
    g.putImageData(img, 0, 0);
  });
}

export function vintageRug(ctx, parent, opt) {
  const { THREE, kit } = ctx;
  const { L, W, pos = [0, 0, 0], ry = 0, seed = 7, pal } = opt;
  const H = opt.H ?? 0.009;
  const grp = kit.group(parent, pos, ry, 'vintageRug');
  const map = drawRug(kit, L, W, seed, pal); map.anisotropy = 16;
  const rep = [L / 0.45, W / 0.45];
  const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 1,
    normalMap: kit.tex('assets/acg/Carpet016/Carpet016_NormalGL.jpg', { repeat: rep }), normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: kit.tex('assets/acg/Carpet016/Carpet016_AmbientOcclusion.jpg', { repeat: rep }), aoMapIntensity: 0.8,
    sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color().setRGB(pal.warp[0] / 255, pal.warp[1] / 255, pal.warp[2] / 255) });
  /* corner curl: two diagonal corners lift a little (a rug that has been rolled), the long edges roll slightly */
  const lifts = opt.lifts ?? [[1, -1, 0.012], [-1, 1, 0.007]];
  const curl = (x, z) => {
    let y = 0; for (const [sx, sz, a] of lifts) { const dx = x - sx * L / 2, dz = z - sz * W / 2; const t = Math.max(0, 1 - Math.hypot(dx, dz) / 0.45); y += a * t * t; }
    const e = Math.min(W / 2 - Math.abs(z), L / 2 - Math.abs(x)); return y - 0.0025 * Math.max(0, 1 - e / 0.02);
  };
  const NX = 56, NZ = Math.max(16, Math.round(NX * W / L));
  const top = new THREE.PlaneGeometry(L, W, NX, NZ); top.rotateX(-Math.PI / 2);
  { const p = top.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, H + curl(p.getX(i), p.getZ(i))); top.computeVertexNormals(); }
  /* plane UVs after rotateX: u along +x, v runs from +z (v=0) to -z; canvas row 0 is v=1 -> fine either way */
  kit.add(grp, top, mat, [0, 0, 0], [0, 0, 0], { shadow: false });
  /* side skirt + overcast selvedge on the long edges */
  {
    const pts = []; const per = [];
    for (let i = 0; i <= NX; i++) per.push([-L / 2 + L * i / NX, W / 2]);
    for (let i = 1; i <= NZ; i++) per.push([L / 2, W / 2 - W * i / NZ]);
    for (let i = 1; i <= NX; i++) per.push([L / 2 - L * i / NX, -W / 2]);
    for (let i = 1; i < NZ; i++) per.push([-L / 2, -W / 2 + W * i / NZ]);
    for (const [x, z] of per) { const y = H + curl(x, z); pts.push(x, y, z, x, y - H, z); }
    const n = per.length; const idx = [];
    for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const sk = new THREE.BufferGeometry(); sk.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); sk.setIndex(idx); sk.computeVertexNormals();
    const skM = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(pal.borderDark[0] / 255, pal.borderDark[1] / 255, pal.borderDark[2] / 255).convertSRGBToLinear().multiplyScalar(0.8), roughness: 1, side: THREE.DoubleSide });
    kit.add(grp, sk, skM, [0, 0, 0], [0, 0, 0], { shadow: false });
    for (const s of [-1, 1]) {
      const path = []; for (let i = 0; i <= 24; i++) { const x = -L / 2 + L * i / 24; path.push([x, H + curl(x, s * W / 2) - 0.002, s * (W / 2 - 0.001)]); }
      kit.add(grp, kit.tube(path, 0.0045, 96), skM, [0, 0, 0], [0, 0, 0], { shadow: false });
    }
  }
  /* knotted fringe: one InstancedMesh (knot + tapered strand bundle per tassel) on both short ends */
  {
    const knot = new THREE.SphereGeometry(0.0055, 6, 4); knot.scale(1.4, 0.8, 1); knot.translate(0.006, 0.0045, 0);
    const strand = new THREE.CylinderGeometry(0.0022, 0.0042, 0.06, 5, 1); strand.rotateZ(Math.PI / 2); strand.translate(0.04, 0.0028, 0);
    const tg = kit.mergeGeometries([knot.toNonIndexed(), strand.toNonIndexed()]);
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const step = 0.026, per = Math.floor((W - 0.02) / step); const count = per * 2;
    const im = new THREE.InstancedMesh(tg, fringeMat, count); im.castShadow = false; im.receiveShadow = true;
    const r = kit.rng(seed + 99); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(); const c = new THREE.Color();
    let k = 0;
    for (const sx of [-1, 1]) for (let i = 0; i < per; i++) {
      const z = -W / 2 + 0.01 + (i + 0.5) * step + (r() - 0.5) * 0.004; const x = sx * L / 2;
      const lift = Math.max(0, curl(x, z));
      e.set((r() - 0.5) * 0.6, (sx > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.35, -lift * 8); q.setFromEuler(e);
      const ls = 0.8 + r() * 0.4; s3.set(ls, 1, 1); p3.set(x - sx * 0.004, lift * 0.6, z);
      m4.compose(p3, q, s3); im.setMatrixAt(k, m4);
      c.setRGB(pal.fringe[0] / 255, pal.fringe[1] / 255, pal.fringe[2] / 255).convertSRGBToLinear().multiplyScalar(0.88 + r() * 0.18); im.setColorAt(k, c); k++;
    }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.userData.noCollide = true; grp.add(im);
  }
  return grp;
}
