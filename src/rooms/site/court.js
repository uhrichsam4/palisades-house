// Tennis court on the NE side of the house (p41, p42, p45): green/blue acrylic, ITF lines, net,
// black chain-link with dark windscreen on the street + NE sides, LED light poles.
import * as THREE from 'three';
import { G } from './terrain.js';

export const COURT = { cx: 34.1, cz: 14.5, hw: 10.97 / 2, hl: 23.77 / 2, ex0: 23.6, ex1: 43.6, ez0: -3.4, ez1: 36.0 };

export function courtMaterials(kit) {
  const o = (m) => kit.outdoor(m);
  const r = kit.rng(41);
  // acrylic: light base (tinted by material colour) with fine sand grain + faint roller marks / wear
  const acrylic = (seed) => { const rr = kit.rng(seed); return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(226,226,226)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { const y0 = rr() * h, v = (rr() - 0.5) * 18; g.fillStyle = `rgba(${200 + v},${200 + v},${200 + v},0.18)`; g.fillRect(0, y0, w, 6 + rr() * 30); }
    for (let k = 0; k < 60; k++) { const v = (rr() - 0.5) * 30; g.fillStyle = `rgba(${210 + v},${210 + v},${210 + v},0.12)`; g.beginPath(); g.ellipse(rr() * w, rr() * h, 20 + rr() * 70, 10 + rr() * 40, rr() * 3, 0, 7); g.fill(); }
    for (let k = 0; k < 60000; k++) { const v = 150 + rr() * 105; g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.fillRect(rr() * w, rr() * h, 1, 1); }
  }, { repeat: [1, 1] }); };
  const chain = kit.canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(18,18,18,1)'; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke();
  });
  const net = kit.canvasTex(32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,8,8,1)'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h); });
  // windscreen: dark grey knitted polyester, stretched between posts -> horizontal tension wrinkles.
  // Height field drawn per pixel (no canvas filters), used for both the albedo shading and a normal map.
  const SW = 512, SH = 256, hf = new Float32Array(SW * SH);
  const rw = kit.rng(77); const folds = [];
  for (let k = 0; k < 44; k++) folds.push({ y: rw() * SH, a: 0.25 + rw() * 0.6, w: 1.5 + rw() * 5, ph: rw() * 6.3, k: 1 + Math.floor(rw() * 2), x0: rw() * SW, len: 80 + rw() * 300 });
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    let v = 0;
    for (const f of folds) { let dx = Math.abs(x - f.x0); dx = Math.min(dx, SW - dx); const env = Math.max(0, 1 - dx / f.len);
      const yy = f.y + 1.5 * Math.sin(x / SW * Math.PI * 2 * f.k + f.ph); let dy = Math.abs(y - yy); dy = Math.min(dy, SH - dy); v += f.a * env * Math.exp(-(dy * dy) / (f.w * f.w)); }
    hf[y * SW + x] = v;
  }
  const screen = kit.canvasTex(SW, SH, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = 92 + 12 * Math.tanh(hf[y * w + x] - 0.4) + ((x * 7 + y * 13) % 5) * 1.5;
      const hem = (y < 7 || y > h - 7) ? -30 : 0; img.data[i] = img.data[i + 1] = v + hem; img.data[i + 2] = v + 3 + hem; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(210,210,210,0.6)'; for (let x = 16; x < w; x += 42) { g.beginPath(); g.arc(x, 4, 2, 0, 7); g.fill(); }
  });
  const screenN = kit.canvasTex(SW, SH, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (hf[y * w + (x + 1) % w] - hf[y * w + (x - 1 + w) % w]) * 1.5, dy = (hf[((y + 1) % h) * w + x] - hf[((y - 1 + h) % h) * w + x]) * 1.5;
      const nz = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  return {
    green: o(new THREE.MeshStandardMaterial({ map: acrylic(1), color: 0x2f3c0f, roughness: 0.9, normalMap: kit.noiseNormal(256, 1.2, 64, 21), normalScale: new THREE.Vector2(0.08, 0.08) })),
    blue: o(new THREE.MeshStandardMaterial({ map: acrylic(2), color: 0x2d353c, roughness: 0.82, normalMap: kit.noiseNormal(256, 1.2, 64, 22), normalScale: new THREE.Vector2(0.08, 0.08) })),
    line: o(new THREE.MeshStandardMaterial({ color: 0xd6d6d2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    post: o(new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.5, metalness: 0.4 })),
    chain: o(new THREE.MeshStandardMaterial({ map: chain, color: 0xffffff, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2, depthWrite: false })),
    screen: o(new THREE.MeshStandardMaterial({ map: screen, normalMap: screenN, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xd0d2d4, roughness: 0.36, metalness: 0.1, side: THREE.DoubleSide })),
    net: o(new THREE.MeshStandardMaterial({ map: net, color: 0x202020, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false })),
    tape: o(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7, side: THREE.DoubleSide })),
    lamp: new THREE.MeshStandardMaterial({ color: 0xdfe6ea, emissive: 0xe8f0ff, emissiveIntensity: 0.25, roughness: 0.3 }),
  };
}

// straight fence a->b ([x,z]) of height h; kind 'chain' | 'screen' | 'low'
export function fenceLine(kit, root, phys, M, a, b, h, kind = 'chain', { spacing = 3.0, midRail = true, base = G } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = Math.max(1, Math.round(L / spacing)); const ry = Math.atan2(-dir[1], dir[0]);
  const pr = h > 2 ? 0.038 : 0.025;
  for (let i = 0; i <= n; i++) {
    const t = i / n; kit.add(root, kit.cyl(pr, pr, h + 0.06, 10), M.post, [a[0] + (b[0] - a[0]) * t, base + (h + 0.06) / 2, a[1] + (b[1] - a[1]) * t]);
    kit.add(root, kit.sphere(pr * 1.15, 10, 6), M.post, [a[0] + (b[0] - a[0]) * t, base + h + 0.06, a[1] + (b[1] - a[1]) * t]);
  }
  const rail = (y, rr) => kit.add(root, kit.cyl(rr, rr, L, 8).rotateZ(Math.PI / 2), M.post, [(a[0] + b[0]) / 2, base + y, (a[1] + b[1]) / 2], [0, ry, 0]);
  rail(h, pr * 0.8); if (midRail && h > 2) rail(h * 0.52, pr * 0.7); rail(0.08, pr * 0.6);
  const mesh = (mat, y0, y1, off, tile) => {
    const g = new THREE.PlaneGeometry(L, y1 - y0); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / tile[0], uv.getY(i) * (y1 - y0) / tile[1]);
    const m = kit.add(root, g, mat, [(a[0] + b[0]) / 2 - dir[1] * off, base + (y0 + y1) / 2, (a[1] + b[1]) / 2 + dir[0] * off], [0, ry, 0], { shadow: true });
    return m;
  };
  mesh(M.chain, 0.02, h, 0, [0.11, 0.11]);
  if (kind === 'screen') mesh(M.screen, 0.06, h - 0.18, 0.04, [L / Math.max(1, Math.round(L / 3)), h - 0.24]);
  // collider: thin box along the line (fences here are axis-aligned)
  const t = 0.06;
  phys.boxAABB([Math.min(a[0], b[0]) - t, base, Math.min(a[1], b[1]) - t], [Math.max(a[0], b[0]) + t, base + h, Math.max(a[1], b[1]) + t]);
}

export function buildCourt(kit, root, phys, M, ctx) {
  const C = COURT, y = G;
  const { cx, cz, hw, hl } = C;
  // surfaces: green surround over the whole enclosure, blue playing court inside the lines
  const plane = (mat, x0, z0, x1, z1, yy) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4);
    const m = kit.add(root, g, mat, [(x0 + x1) / 2, yy, (z0 + z1) / 2], [0, 0, 0], { shadow: false }); m.receiveShadow = true; return m; };
  plane(M.green, C.ex0, C.ez0, C.ex1, C.ez1, y + 0.03);
  plane(M.blue, cx - hw, cz - hl, cx + hw, cz + hl, y + 0.034);
  // ITF lines (5 cm, baselines 10 cm), drawn inside the court dimensions
  const lines = []; const L = (x0, z0, x1, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y + 0.037, (z0 + z1) / 2); lines.push(g); };
  const sw = 8.23 / 2, svc = 6.40, lw = 0.05;
  L(cx - hw, cz - hl, cx + hw, cz - hl + 0.10); L(cx - hw, cz + hl - 0.10, cx + hw, cz + hl);   // baselines
  L(cx - hw, cz - hl, cx - hw + lw, cz + hl); L(cx + hw - lw, cz - hl, cx + hw, cz + hl);       // doubles sidelines
  L(cx - sw, cz - hl, cx - sw + lw, cz + hl); L(cx + sw - lw, cz - hl, cx + sw, cz + hl);       // singles sidelines
  L(cx - sw, cz - svc - lw / 2, cx + sw, cz - svc + lw / 2); L(cx - sw, cz + svc - lw / 2, cx + sw, cz + svc + lw / 2); // service lines
  L(cx - lw / 2, cz - svc, cx + lw / 2, cz + svc);                                               // centre service line
  L(cx - lw / 2, cz - hl, cx + lw / 2, cz - hl + 0.2); L(cx - lw / 2, cz + hl - 0.2, cx + lw / 2, cz + hl); // centre marks
  const lm = kit.add(root, kit.mergeGeometries(lines), M.line, [0, 0, 0], [0, 0, 0], { shadow: false }); lm.receiveShadow = true;

  // net: posts 0.914 m outside the doubles sidelines, 1.07 m at the posts, 0.914 m at the centre strap
  const px = hw + 0.914, NY0 = y + 0.035;
  for (const s of [-1, 1]) {
    kit.add(root, kit.cyl(0.04, 0.04, 1.10, 14), M.post, [cx + s * px, NY0 + 0.55, cz]);
    kit.add(root, kit.cyl(0.05, 0.05, 0.03, 14), M.post, [cx + s * px, NY0 + 1.11, cz]);
    phys.boxAABB([cx + s * px - 0.05, NY0, cz - 0.05], [cx + s * px + 0.05, NY0 + 1.1, cz + 0.05]);
  }
  const N = 40, sag = (t) => 1.07 - (1.07 - 0.914) * (1 - Math.pow(2 * t - 1, 2));
  const netG = new THREE.BufferGeometry(), tapeG = new THREE.BufferGeometry(); const np = [], nu = [], tp = [], ix = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = cx - px + 2 * px * t, top = NY0 + sag(t);
    np.push(x, NY0 + 0.04, cz, x, top, cz); nu.push(x / 0.045, 0.04 / 0.045, x / 0.045, (top - NY0) / 0.045);
    tp.push(x, top - 0.065, cz, x, top + 0.01, cz);
    if (i < N) { const b = i * 2; ix.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  netG.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); netG.setAttribute('uv', new THREE.Float32BufferAttribute(nu, 2)); netG.setIndex(ix); netG.computeVertexNormals();
  tapeG.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tapeG.setIndex(ix.slice()); tapeG.computeVertexNormals();
  kit.add(root, netG, M.net, [0, 0, 0], [0, 0, 0], { shadow: false });
  kit.add(root, tapeG, M.tape);
  kit.add(root, kit.box(0.05, 0.9, 0.012), M.tape, [cx, NY0 + 0.46, cz]);
  kit.add(root, kit.tube([[cx - px, NY0 + 1.07, cz], [cx, NY0 + 0.92, cz], [cx + px, NY0 + 1.07, cz]], 0.005, 24), M.post);
  phys.boxAABB([cx - px, NY0, cz - 0.03], [cx + px, NY0 + 0.95, cz + 0.03]);

  // fencing: windscreen on the street end and the NE side, open chain-link on the canyon end,
  // tall chain-link along the house side past the rear wall, low black fence next to the house.
  const FH = 3.1, SH = 3.6;
  fenceLine(kit, root, phys, M, [C.ex0, C.ez0], [C.ex1, C.ez0], SH, 'screen');
  fenceLine(kit, root, phys, M, [C.ex1, C.ez0], [C.ex1, C.ez1], SH, 'screen');
  fenceLine(kit, root, phys, M, [C.ex0, C.ez1], [cx - 0.6, C.ez1], FH, 'chain');
  fenceLine(kit, root, phys, M, [cx + 0.6, C.ez1], [C.ex1, C.ez1], FH, 'chain');
  fenceLine(kit, root, phys, M, [C.ex0, 21.8], [C.ex0, C.ez1], FH, 'chain');
  fenceLine(kit, root, phys, M, [C.ex0, C.ez0], [C.ex0, 21.8], 2.6, 'chain', { spacing: 2.4 });
  // gate in the canyon end (frame + mesh, closed)
  const gx0 = cx - 0.6, gx1 = cx + 0.6;
  for (const gx of [gx0 + 0.04, gx1 - 0.04]) kit.add(root, kit.cyl(0.025, 0.025, 2.2, 8), M.post, [gx, y + 1.1, C.ez1]);
  for (const gy of [0.08, 1.1, 2.18]) kit.add(root, kit.cyl(0.02, 0.02, gx1 - gx0, 8).rotateZ(Math.PI / 2), M.post, [cx, y + gy, C.ez1]);
  kit.add(root, new THREE.PlaneGeometry(gx1 - gx0, 2.1), M.chain, [cx, y + 1.13, C.ez1], [0, 0, 0], { shadow: false });
  kit.add(root, kit.cyl(0.02, 0.02, FH - 2.2, 8), M.post, [gx0, y + 2.2 + (FH - 2.2) / 2, C.ez1]);
  kit.add(root, kit.cyl(0.02, 0.02, FH - 2.2, 8), M.post, [gx1, y + 2.2 + (FH - 2.2) / 2, C.ez1]);
  kit.add(root, kit.cyl(0.03, 0.03, gx1 - gx0, 8).rotateZ(Math.PI / 2), M.post, [cx, y + FH, C.ez1]);
  phys.boxAABB([gx0, y, C.ez1 - 0.05], [gx1, y + FH, C.ez1 + 0.05]);

  // LED light poles (p41: ~6 m black poles, short arm, flat rectangular head aimed at the court)
  const poles = [];
  for (const z of [3.5, 10.5, 17.5, 24.5]) { poles.push([C.ex1 + 0.35, z, -1]); poles.push([C.ex0 + 0.35, z, 1]); }
  poles.push([C.ex0 + 0.35, 31.0, 1]);
  for (const [x, z, s] of poles) {
    const PH = 6.0;
    kit.add(root, kit.cyl(0.055, 0.075, PH, 12), M.post, [x, y + PH / 2, z]);
    kit.add(root, kit.cyl(0.13, 0.15, 0.25, 12), M.post, [x, y + 0.125, z]);
    kit.add(root, kit.box(0.75, 0.06, 0.06), M.post, [x + s * 0.37, y + PH - 0.05, z]);
    const head = kit.group(root, [x + s * 0.85, y + PH - 0.08, z], 0);
    head.rotation.z = s * 0.12;
    kit.add(head, kit.rbox(0.62, 0.07, 0.36, 0.015), M.post, [0, 0, 0]);
    kit.add(head, kit.box(0.54, 0.01, 0.30), M.lamp, [0, -0.037, 0], [0, 0, 0], { shadow: false });
    phys.boxAABB([x - 0.08, y, z - 0.08], [x + 0.08, y + PH, z + 0.08]);
  }

  // dynamic play items (not in photo shots): a few balls near the net
  if (!ctx.shot) {
    const felt = kit.outdoor(new THREE.MeshStandardMaterial({ color: 0xd8f03a, roughness: 0.95 }));
    [[cx - 2.2, cz - 1.0], [cx + 1.4, cz - 2.6], [cx + 3.1, cz + 4.0], [cx - 4.6, cz + 7.5]].forEach(([bx, bz]) => {
      const b = kit.add(root, kit.sphere(0.034, 16, 10), felt, [bx, y + 0.08, bz]);
      phys.dynamic(b, { mass: 0.058, shape: 'ball', restitution: 0.75, linearDamping: 0.2 });
    });
  }
}
