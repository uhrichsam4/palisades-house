// Piece: foyer — Entry hall, stair (x 10.0-11.12, rising +z from z 5.70 to 10.20), upper landing/bridge, upper halls
// Owned rooms: foyer, gallery, hallEW, hallNS, hallC | Reference photos: p02, p14, p15, p16
//
// What is here (from the listing photos):
//  p02  entry looking down the hall to the pool: oak console + gold swirl vase with white flowers, stair with
//       white closed skirt, oak treads, black square balusters, oak handrail + newel, dracaena in a black pot,
//       double-height void with the upper railing, tall mirror at the hall end, oak art panels, tall baseboards.
//  p14  console + organic brass mirror, stair, framed sepia zebra print, octopus triptych on the upper wall.
//  p15  upper landing: oak top-rail railing around the void, sloped ceiling with oak beams and a skylight,
//       blue seascape photo, "LA MER" print, white-oak slab doors.
//  p16  upper walkway beside the void, octopus panels across the void, oak door near the camera.

export const piece = { rooms: ["foyer", "gallery", "hallEW", "hallNS", "hallC"], photos: ["p02", "p14", "p15", "p16"] };
export const ownCeiling = ['gallery'];
export const views = {
  p02: { pos: [9.35, 1.40, 4.62], look: [9.95, 2.25, 14], fov: 60 },
  p14: { pos: [9.55, 1.30, 4.85], look: [9.0, 1.55, 9.5], fov: 58 },
  p15: { pos: [10.85, 4.80, 10.90], look: [8.3, 4.50, 8.2], fov: 62 },
  p16: { pos: [8.50, 4.80, 6.60], look: [10.0, 4.75, 10.4], fov: 58 },
};

// ---- stair + void constants (mirrors plan.STAIR / plan.VOIDS)
const ST = { x0: 10.0, x1: 11.12, z0: 5.70, z1: 10.20, n: 17 };
const UP = 3.35, GC = 3.05, PLATE = 6.10;
const VOID = [9.25, 5.70, 11.12, 10.20];

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx; const { M } = kit;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const H = UP / ST.n;
  // two flights with a mid landing (p14: ~7 risers up to a landing, newel at each end of it)
  const NL = 7, LAND = 0.90, R = (ST.z1 - ST.z0 - LAND) / (ST.n - 2);
  const zL0 = ST.z0 + (NL - 1) * R, zL1 = zL0 + LAND;
  const zr = (k) => k <= NL ? ST.z0 + (k - 1) * R : zL1 + (k - NL - 1) * R;   // front face of riser k (1..17)

  // ---------------------------------------------------------------- materials
  const oak = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xffe4c4, roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) });
  const oakRail = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.2, 2] }), color: 0xffe0bc, roughness: 0.5, normalScale: new THREE.Vector2(0.25, 0.25) });
  const ironBlack = std({ color: 0x151515, roughness: 0.55, metalness: 0.35 });
  const wallWhite = M.paintWhite;
  const wallDouble = M.paintWhite.clone(); wallDouble.side = THREE.DoubleSide;
  const frameWhite = std({ color: 0xf4f3ef, roughness: 0.6 });
  const mirrorMat = std({ color: 0xffffff, metalness: 1.0, roughness: 0.03 });

  // ---------------------------------------------------------------- STAIR
  const stair = kit.group(root, [0, 0, 0], 0, 'stair');
  {
    // closed white body (skirt + risers): side profile extruded across the stair width
    const prof = [[ST.z0, 0]];
    for (let k = 1; k < ST.n; k++) prof.push([zr(k), k * H], [zr(k + 1), k * H]);
    prof.push([ST.z1, 0]);
    const body = kit.extrude(prof, ST.x1 - ST.x0); body.rotateY(-Math.PI / 2); body.translate(ST.x1, 0, 0);
    kit.add(stair, body, wallWhite, [0, 0, 0]);
    // oak treads with a nosing (tread NL is the landing)
    for (let k = 1; k < ST.n; k++) {
      const z = zr(k) - 0.015, d = zr(k + 1) - zr(k) + 0.015, y = k * H;
      kit.add(stair, kit.rbox(ST.x1 - ST.x0 + 0.02, 0.034, d, 0.008), oak, [(ST.x0 + ST.x1) / 2 - 0.01, y + 0.012, z + d / 2]);
    }
    // skirt baseboard on the open (west) side + floor-level baseboard
    kit.boxAt(stair, wallWhite, ST.x0 - 0.012, 0, ST.z0, 0.012, 0.13, ST.z1 - ST.z0 - 0.01);
    // physics: ramp - flat landing - ramp (top surface strips, smooth to walk up)
    const yL = NL * H; const pz = [[ST.z0 - 0.15, 0], [zL0, yL], [zL1, yL], [ST.z1, UP]]; const tri = [];
    for (let k = 0; k < pz.length - 1; k++) {
      const [za, ya] = pz[k], [zb, yb] = pz[k + 1];
      const a = [ST.x0, ya, za], b = [ST.x1, ya, za], c = [ST.x0, yb, zb], d = [ST.x1, yb, zb];
      tri.push(...a, ...b, ...d, ...a, ...d, ...c);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    phys.trimesh(pg);
  }

  // ---------------------------------------------------------------- RAILINGS
  const balusters = []; // [x, y0, z, h]
  const railX = ST.x0 + 0.045;                      // stair handrail line (on the tread ends)
  // nosing line height: flight 1 below the landing, flight 2 above it
  const nose = (z) => z <= zL0 + 0.001 ? H + (z - ST.z0) * H / R : (NL + 1) * H + (z - zL1) * H / R;
  const RAIL_STAIR = 0.88, RAIL_UP = 1.07;
  const yL = NL * H, RAIL_LAND = 0.95;
  // newels (oak, chamfered cap): foot of the stair + both ends of the landing
  const newel = (z, y0, top) => {
    kit.add(stair, kit.rbox(0.075, top - y0, 0.075, 0.006), oakRail, [railX, (y0 + top) / 2, z]);
    kit.add(stair, kit.rbox(0.085, 0.022, 0.085, 0.006), oakRail, [railX, top + 0.011, z]);
  };
  const newelZ = ST.z0 + 0.06, nLA = zL0 + 0.06, nLB = zL1 - 0.06;
  newel(newelZ, 0, 1.12);
  newel(nLA, yL, yL + RAIL_LAND + 0.10);
  newel(nLB, yL, yL + RAIL_LAND + 0.10);
  // sloped handrail between two z's (on flight), with balusters under it
  const sloped = (zA, zB) => {
    const yA = nose(zA) + RAIL_STAIR, yB = nose(zB) + RAIL_STAIR;
    const L = Math.hypot(zB - zA, yB - yA), ang = Math.atan2(yB - yA, zB - zA);
    const rail = kit.add(stair, kit.rbox(0.055, 0.068, L, 0.012), oakRail, [railX, (yA + yB) / 2, (zA + zB) / 2], [-ang, 0, 0]);
    const helper = new THREE.Object3D(); helper.position.copy(rail.position); helper.rotation.copy(rail.rotation); root.add(helper);
    phys.boxLocal(helper, 0, -0.45, 0, 0.03, 0.5, L / 2);
  };
  sloped(newelZ + 0.05, nLA - 0.05);
  sloped(nLB + 0.05, ST.z1 - 0.02);
  // level rail across the landing
  kit.add(stair, kit.rbox(0.055, 0.068, nLB - nLA, 0.012), oakRail, [railX, yL + RAIL_LAND, (nLA + nLB) / 2]);
  phys.boxAABB([railX - 0.03, yL, nLA], [railX + 0.03, yL + RAIL_LAND, nLB]);
  for (let k = 1; k < ST.n; k++) {
    const za = zr(k), zb = zr(k + 1);
    if (k === NL) { // landing: evenly spaced
      const n = Math.round((nLB - nLA) / 0.112);
      for (let j = 1; j < n; j++) { const z = nLA + (nLB - nLA) * j / n; balusters.push([railX, yL + 0.03, z, RAIL_LAND - 0.06]); }
      continue;
    }
    for (const f of [0.17, 0.50, 0.83]) {   // 3 slim balusters per tread (p02/p14)
      const z = za + f * (zb - za); if (z < newelZ + 0.08) continue;
      const y0 = k * H + 0.03; const y1 = nose(z) + RAIL_STAIR - 0.03;
      balusters.push([railX, y0, z, y1 - y0]);
    }
  }
  // upper railings around the void (walk side), oak posts + top rail, black square balusters
  const posts = [];
  function railRun(a, b, opt = {}) {
    const [ax, az] = a, [bx, bz] = b; const L = Math.hypot(bx - ax, bz - az); const ux = (bx - ax) / L, uz = (bz - az) / L;
    const yTop = UP + RAIL_UP;
    const ry = Math.atan2(ux, uz);
    kit.add(root, kit.rbox(0.085, 0.06, L, 0.014), oakRail, [(ax + bx) / 2, yTop - 0.03, (az + bz) / 2], [0, ry, 0]);
    const n = Math.max(1, Math.round(L / 0.10));
    for (let k = 1; k < n; k++) { const t = k / n; balusters.push([ax + ux * L * t, UP, az + uz * L * t, RAIL_UP - 0.07]); }
    phys.boxAABB([Math.min(ax, bx) - 0.03, UP, Math.min(az, bz) - 0.03], [Math.max(ax, bx) + 0.03, UP + RAIL_UP, Math.max(az, bz) + 0.03]);
  }
  const wX = VOID[0] - 0.045, fZ = VOID[1] - 0.045, bZ = VOID[3] + 0.045;
  railRun([wX, fZ], [wX, bZ]);
  railRun([wX, fZ], [ST.x1 - 0.01, fZ]);
  railRun([wX, bZ], [ST.x0 - 0.02, bZ]);
  for (const [x, z] of [[wX, fZ], [wX, bZ], [ST.x0 - 0.02, bZ]]) {
    kit.add(root, kit.rbox(0.09, RAIL_UP + 0.04, 0.09, 0.008), oakRail, [x, UP + (RAIL_UP + 0.04) / 2, z]);
    posts.push([x, z]);
  }
  // oak nosing strip on the void slab edges (as in p02: thin oak edge under the balusters)
  kit.boxAt(root, oak, VOID[0] - 0.02, UP - 0.03, VOID[1], 0.035, 0.035, VOID[3] - VOID[1]);
  kit.boxAt(root, oak, VOID[0] - 0.02, UP - 0.03, VOID[1] - 0.015, VOID[2] - VOID[0] + 0.02, 0.035, 0.035);
  kit.boxAt(root, oak, VOID[0] - 0.02, UP - 0.03, VOID[3] - 0.02, ST.x0 - VOID[0] + 0.02, 0.035, 0.035);
  // balusters: one instanced mesh
  {
    const g = new THREE.BoxGeometry(0.015, 1, 0.015); g.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(g, ironBlack, balusters.length); const m4 = new THREE.Matrix4();
    balusters.forEach(([x, y, z, h], i) => im.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1))));
    im.castShadow = true; im.receiveShadow = true; im.name = 'balusters'; root.add(im);
  }

  // ---------------------------------------------------------------- GALLERY CEILING (follows the hip roof)
  const roofY = (x, z) => Math.min(5.909 + 0.5453 * (11.47 - x), 5.909 + 0.5453 * (z - 4.08), 5.909 + 0.5453 * (13.95 - z));
  const ceilY = (x, z) => Math.max(PLATE, roofY(x, z) - 0.20);
  const GAL = [8.30, 4.73, 11.12, 10.30];
  {
    const e = 0.07; const X0 = GAL[0] - e, X1 = GAL[2] + e, Z0 = GAL[1] - e, Z1 = GAL[3] + e;
    const nx = 24, nz = 46; const pos = [];
    const P = (i, j) => { const x = X0 + (X1 - X0) * i / nx, z = Z0 + (Z1 - Z0) * j / nz; return [x, ceilY(Math.max(GAL[0], Math.min(GAL[2], x)), Math.max(GAL[1], Math.min(GAL[3], z))), z]; };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = kit.add(root, g, M.ceilingWhite, [0, 0, 0]); m.name = 'ceiling'; m.castShadow = true;
    // infill walls above the 6.10 plate where the sloped ceiling rises (west wall + header to the upper hall)
    const strip = (pts) => { const p = []; for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1]; const y0 = ceilY(x0, z0) + 0.02, y1 = ceilY(x1, z1) + 0.02; p.push(x0, PLATE - 0.01, z0, x1, PLATE - 0.01, z1, x1, y1, z1, x0, PLATE - 0.01, z0, x1, y1, z1, x0, y0, z0); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); sg.computeVertexNormals(); kit.add(root, sg, wallDouble, [0, 0, 0]); };
    const west = [], back = [];
    for (let k = 0; k <= 60; k++) west.push([GAL[0], GAL[1] + (GAL[3] - GAL[1]) * k / 60]);
    for (let k = 0; k <= 40; k++) back.push([GAL[0] + (GAL[2] - GAL[0]) * k / 40, GAL[3]]);
    strip(west); strip(back);
    // oak beams running up the slope (p15)
    for (const zb of [7.30, 9.15]) {
      const N = 50, w = 0.075, dep = 0.22; const p = [], uv = [];
      const XB = 10.74; const S = []; for (let k = 0; k <= N; k++) { const x = XB - (XB - GAL[0]) * k / N; const yc = Math.max(ceilY(x, zb - w), ceilY(x, zb + w)); S.push([x, yc + 0.03, yc - dep]); }
      const quad = (a, b, c, d, ua, ub) => { p.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(ua, 0, ub, 0, ub, 1, ua, 0, ub, 1, ua, 1); };
      let u = 0;
      for (let k = 0; k < N; k++) {
        const [xa, ta, ba] = S[k], [xb, tb, bb] = S[k + 1]; const du = Math.hypot(xb - xa, bb - ba);
        quad([xa, ba, zb - w], [xb, bb, zb - w], [xb, bb, zb + w], [xa, ba, zb + w], u, u + du);          // bottom
        quad([xa, ta, zb - w], [xb, tb, zb - w], [xb, bb, zb - w], [xa, ba, zb - w], u, u + du);          // side -z
        quad([xa, ba, zb + w], [xb, bb, zb + w], [xb, tb, zb + w], [xa, ta, zb + w], u, u + du);          // side +z
        u += du;
      }
      for (const [xe, te, be] of [S[0], S[N]]) quad([xe, be, zb - w], [xe, be, zb + w], [xe, te, zb + w], [xe, te, zb - w], 0, 0.15);   // end caps
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bg.computeVertexNormals();
      const bm = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [0.6, 0.25] }), color: 0xf0c48e, roughness: 0.6, side: THREE.DoubleSide });
      kit.add(root, bg, bm, [0, 0, 0]);
    }
    // skylight between the middle and back beams (glowing recessed panel + white light well lip)
    const sx0 = 8.75, sx1 = 9.85, sz0 = 7.72, sz1 = 8.73; const sp = [];
    const nS = 10; for (let k = 0; k < nS; k++) { const xa = sx0 + (sx1 - sx0) * k / nS, xb = sx0 + (sx1 - sx0) * (k + 1) / nS;
      const ya = ceilY(xa, (sz0 + sz1) / 2) - 0.004, yb = ceilY(xb, (sz0 + sz1) / 2) - 0.004;
      sp.push(xa, ya, sz0, xa, ya, sz1, xb, yb, sz1, xa, ya, sz0, xb, yb, sz1, xb, yb, sz0); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.computeVertexNormals();
    const sky = new THREE.Mesh(sg, std({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.2, side: THREE.DoubleSide })); sky.name = 'skylight'; root.add(sky);
    // lip frame
    for (const [a, b] of [[[sx0, sz0], [sx1, sz0]], [[sx0, sz1], [sx1, sz1]]]) {
      const L = Math.abs(b[0] - a[0]); const ya = ceilY(a[0], a[1]), yb = ceilY(b[0], b[1]);
      kit.add(root, kit.box(Math.hypot(L, ya - yb), 0.035, 0.03), frameWhite, [(a[0] + b[0]) / 2, (ya + yb) / 2 - 0.02, a[1]], [0, 0, Math.atan2(ya - yb, a[0] - b[0]) + Math.PI]);
    }
  }
  // bulkheads hiding roof eaves that dip below the 6.10 plate inside the house (garage-wing eave at x 10.77,
  // primary-wing eave at z 11.25) — see notes for lead
  kit.boxAt(root, M.ceilingWhite, 10.74, 5.90, GAL[1], 11.12 - 10.74, PLATE - 5.90 + 0.01, 11.60 - GAL[1]);
  kit.boxAt(root, M.ceilingWhite, 8.30, 5.80, 11.22, 15.60 - 8.30, PLATE - 5.80 + 0.01, 11.60 - 11.22);
  // cans: ground hall soffits, upper halls
  kit.canLights(root, [[9.70, 11.0], [9.70, 12.7], [8.78, 6.6], [8.78, 8.6], [9.70, 5.2]], GC);
  kit.canLights(root, [[10.0, 10.95], [12.6, 10.95], [14.7, 10.95], [16.55, 9.6], [16.55, 7.3], [16.55, 5.4], [6.7, 8.8]], PLATE);
  // ceiling speaker grille in the hall (p02)
  kit.add(root, kit.cyl(0.11, 0.11, 0.006, 32), std({ color: 0xeeeeea, roughness: 0.8 }), [9.70, GC - 0.003, 11.85]);

  // ---------------------------------------------------------------- BASEBOARDS (tall, white, as in p02)
  const BB = 0.135;
  kit.baseboards(root, [8.30, 4.73, 11.12, 13.60], 0, BB, 0.014, wallWhite, [
    { side: 'x0', from: 5.43, to: 6.37 }, { side: 'x0', from: 10.78, to: 12.62 },
    { side: 'x1', from: 5.60, to: 10.30 }, { side: 'z0', from: 8.98, to: 10.62 }, { side: 'z1', from: 0, to: 99 }]);
  kit.baseboards(root, [8.30, 4.73, 11.12, 10.30], UP, BB, 0.014, wallWhite, [
    { side: 'x0', from: 5.68, to: 6.52 }, { side: 'x0', from: 8.08, to: 9.52 },
    { side: 'x1', from: 4.75, to: 99 }, { side: 'z1', from: 0, to: 99 }]);
  kit.baseboards(root, [8.30, 10.30, 15.60, 11.60], UP, BB, 0.014, wallWhite, [
    { side: 'z0', from: 0, to: 11.42 }, { side: 'z0', from: 11.93, to: 12.87 }, { side: 'z1', from: 12.10, to: 13.10 },
    { side: 'x0', from: 0, to: 99 }, { side: 'x1', from: 0, to: 99 }]);
  kit.baseboards(root, [15.75, 4.60, 17.35, 11.60], UP, BB, 0.014, wallWhite, [
    { side: 'x0', from: 10.25, to: 99 }, { side: 'z0', from: 16.13, to: 16.97 }, { side: 'x1', from: 4.85, to: 5.75 },
    { side: 'z1', from: 16.0, to: 16.9 }]);
  kit.baseboards(root, [5.31, 7.37, 8.15, 10.25], UP, BB, 0.014, wallWhite, [
    { side: 'x0', from: 8.15, to: 9.05 }, { side: 'x1', from: 8.08, to: 9.52 }, { side: 'z1', from: 6.28, to: 7.12 }]);

  // ---------------------------------------------------------------- ART helpers
  // framed(parent, w, h, art material, frame material, pos, ry, opt) — frame depth, frame width, white mat
  function framed(parent, w, h, artMat, fMat, pos, ry, { fw = 0.035, fd = 0.04, mat = 0 } = {}) {
    const g = kit.group(parent, pos, ry);
    for (const [bw, bh, x, y] of [[w, fw, 0, h / 2 - fw / 2], [w, fw, 0, -h / 2 + fw / 2], [fw, h, -w / 2 + fw / 2, 0], [fw, h, w / 2 - fw / 2, 0]])
      kit.add(g, kit.rbox(bw, bh, fd, 0.004), fMat, [x, y, fd / 2]);
    if (mat > 0) kit.add(g, new THREE.PlaneGeometry(w - fw, h - fw), std({ color: 0xf7f6f2, roughness: 0.9 }), [0, 0, 0.012]);
    kit.add(g, new THREE.PlaneGeometry(w - 2 * fw - 2 * mat, h - 2 * fw - 2 * mat), artMat, [0, 0, 0.014]);
    return g;
  }
  const artMat = (tex) => std({ map: tex, roughness: 0.85 });
  const R_E = -Math.PI / 2, R_W = Math.PI / 2, R_S = Math.PI; // facing -x (east wall), +x (west wall), -z

  // octopus triptych (navy, cream stippled octopus) — upper east wall above the stair (p14, p16, p02 top-left)
  for (let k = 0; k < 3; k++) {
    const t = kit.canvasTex(400, 880, (g, w, h) => drawOcto(g, w, h, kit.rng(31 + k * 7), k));
    framed(root, 0.52, 1.30, artMat(t), frameWhite, [ST.x1 - 0.005, UP + 1.55, 8.65 + k * 0.62], R_E, { fw: 0.03 });
  }
  // blue seascape photo (p15) — upper hall wall facing the landing
  framed(root, 1.42, 1.25, artMat(kit.canvasTex(800, 700, drawSea)), frameWhite, [8.30 + 0.005, UP + 1.55, 10.30], R_W, { fw: 0.035, mat: 0.08 });
  // thermostat + black keypad on the gallery wall between the doors (p15)
  kit.add(root, kit.rbox(0.012, 0.12, 0.085, 0.004), frameWhite, [8.30 + 0.006, UP + 1.45, 7.85]);
  kit.add(root, kit.rbox(0.012, 0.11, 0.13, 0.004), std({ color: 0x0b0b0c, roughness: 0.2 }), [8.30 + 0.006, UP + 1.40, 6.85]);
  // "LA MER" print (p15) — west wall of the landing between the guest-bath door and the hall-C opening
  framed(root, 0.42, 0.62, artMat(kit.canvasTex(300, 440, drawLaMer)), frameWhite, [8.30 + 0.005, UP + 1.55, 7.30], R_W, { fw: 0.025, fd: 0.03 });
  // sepia zebra interior print (p14) — west hall wall
  framed(root, 1.30, 1.00, artMat(kit.canvasTex(900, 700, drawZebra)), oak, [8.30 + 0.005, 1.60, 9.05], R_W, { fw: 0.04, fd: 0.045, mat: 0.06 });
  // oak framed linen panels by the living-room opening (p02, right wall)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++)
    framed(root, 0.30, 0.42, std({ color: 0xe9dcc6, roughness: 0.95, map: kit.canvasTex(64, 96, (g, w, h) => { const q = kit.rng(r * 3 + c); g.fillStyle = '#e8dcc6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${150 + q() * 60},${130 + q() * 50},${100 + q() * 40},0.18)`; g.fillRect(q() * w, q() * h, 1, 1 + q() * 4); } }) }), oak,
      [8.30 + 0.005, 1.20 + r * 0.46, 10.08 + c * 0.34], R_W, { fw: 0.03, fd: 0.03 });
  // tall mirror at the hall end, east wall (p02)
  {
    const g = kit.group(root, [11.12 - 0.02, 0, 11.65], R_E);
    for (const [bw, bh, x, y] of [[0.92, 0.03, 0, 2.35], [0.92, 0.03, 0, 0.75], [0.03, 1.63, -0.445, 1.55], [0.03, 1.63, 0.445, 1.55]]) kit.add(g, kit.box(bw, bh, 0.03), oak, [x, y, 0.015]);
    kit.add(g, new THREE.PlaneGeometry(0.86, 1.57), mirrorMat, [0, 1.55, 0.012]);
  }

  // ---------------------------------------------------------------- CONSOLE (oak, 3 drawers + shelf) on the west hall wall, under the mirror
  const CX = 8.30 + 0.20, CZ = 7.35, CT = 0.80;
  const consoleG = kit.group(root, [CX, 0, CZ], R_W, 'console');
  {
    const L = 1.80, D = 0.38, Ht = CT, lg = 0.045;
    kit.add(consoleG, kit.rbox(L, 0.034, D, 0.006), oak, [0, Ht - 0.017, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(consoleG, kit.rbox(lg, Ht - 0.034, lg, 0.004), oak, [sx * (L / 2 - lg / 2 - 0.01), (Ht - 0.034) / 2, sz * (D / 2 - lg / 2 - 0.01)]);
    kit.add(consoleG, kit.box(L - 0.05, 0.13, 0.02), oak, [0, Ht - 0.034 - 0.065, -D / 2 + 0.03]);              // back apron
    for (const sx of [-1, 1]) kit.add(consoleG, kit.box(0.02, 0.13, D - 0.06), oak, [sx * (L / 2 - 0.03), Ht - 0.099, 0]);
    const nd = 3, dw = (L - 0.09) / nd;
    for (let k = 0; k < nd; k++) {
      const x = -L / 2 + 0.045 + dw * (k + 0.5);
      kit.add(consoleG, kit.rbox(dw - 0.008, 0.115, 0.02, 0.003), oak, [x, Ht - 0.1, D / 2 - 0.02]);
      kit.add(consoleG, kit.rbox(0.13, 0.01, 0.012, 0.004), M.brushedNickel, [x, Ht - 0.1, D / 2 - 0.002]);
    }
    kit.add(consoleG, kit.box(L - 0.06, 0.02, 0.02), oak, [0, 0.13, D / 2 - 0.035]);
    kit.add(consoleG, kit.rbox(L - 0.06, 0.025, D - 0.05, 0.004), oak, [0, 0.13, 0]);  // lower shelf
  }
  phys.solidGroup(consoleG);
  // smart-home panel beside the mirror (p14)
  kit.add(root, kit.rbox(0.012, 0.13, 0.17, 0.004), std({ color: 0x0b0b0c, roughness: 0.15, metalness: 0.2 }), [8.30 + 0.006, 1.40, CZ + 0.66]);
  // organic brass-framed mirror above the console: wide asymmetric blob ~0.95 x 0.85, bottom ~0.25 above the top (p14)
  {
    const g = kit.group(root, [8.30 + 0.01, CT + 0.24 + 0.55, CZ - 0.12], R_W, 'blobMirror');
    const pts = (s) => { const a = []; for (let i = 0; i < 72; i++) { const t = i / 72 * Math.PI * 2; const r = 1 + 0.07 * Math.sin(2 * t + 0.9) + 0.05 * Math.sin(3 * t + 2.3) + 0.025 * Math.cos(5 * t + 0.4); a.push([Math.cos(t) * 0.45 * r * s + 0.03 * Math.sin(t), Math.sin(t) * 0.55 * r * s - 0.05 * Math.cos(2 * t) * s]); } return a; };
    const outer = pts(1.0), inner = pts(0.982);
    const fr = kit.extrude(outer, 0.018, 0.004, [inner.slice().reverse()]); kit.add(g, fr, M.brass, [0, 0, 0]);
    const shape = new THREE.Shape(inner.map(([x, y]) => new THREE.Vector2(x, y)));
    // static env-reflecting mirror (a live Reflector re-rendered the whole house every frame: too heavy)
    kit.add(g, new THREE.ShapeGeometry(shape, 24), mirrorMat, [0, 0, 0.012]);
  }
  // decor on the console: gold swirl vase with white kalanchoe, linen lamp, stone, mother-of-pearl boxes on the shelf
  const decor = [];
  {
    // small white ceramic gourd lamp at the far end of the console (p14), not in front of the mirror
    const lamp = kit.group(root, [CX + 0.02, CT, CZ - 0.76], 0, 'lamp');
    kit.add(lamp, kit.lathe([[0.001, 0], [0.06, 0.004], [0.10, 0.04], [0.115, 0.10], [0.10, 0.16], [0.06, 0.19], [0.03, 0.205], [0.015, 0.215], [0.001, 0.215]], 40), std({ color: 0xe3d9c8, roughness: 0.75 }), [0, 0, 0]);
    kit.add(lamp, kit.cyl(0.006, 0.006, 0.09, 8), M.brushedNickel, [0, 0.265, 0]);
    const shadeM = std({ color: 0xf3eee4, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffe9c8, emissiveIntensity: 0.25 });
    kit.add(lamp, new THREE.CylinderGeometry(0.15, 0.165, 0.22, 40, 1, true), shadeM, [0, 0.39, 0]);
    decor.push([lamp, { mass: 1.5, shape: 'box' }]);
    // silver faceted vase with yellow flowers (p14)
    if (false) {
      const sv = kit.group(root, [CX + 0.02, CT, CZ + 0.22], 0, 'silverVase');
      kit.add(sv, kit.lathe([[0.001, 0], [0.045, 0.002], [0.07, 0.07], [0.068, 0.14], [0.045, 0.2], [0.032, 0.22], [0.03, 0.215]], 8), std({ color: 0xd8d4cc, metalness: 0.95, roughness: 0.18, flatShading: true }), [0, 0, 0]);
      const yq = kit.rng(21); const ys = [];
      for (let i = 0; i < 40; i++) { const a = yq() * 6.28, r = yq() * 0.11; ys.push([Math.cos(a) * r, 0.32 + yq() * 0.1 - r * 0.4, Math.sin(a) * r]); }
      const ym = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.012, 1), std({ color: 0xf2d24a, roughness: 0.7 }), ys.length);
      const m4y = new THREE.Matrix4(); ys.forEach((p, i) => ym.setMatrixAt(i, m4y.makeTranslation(...p))); sv.add(ym);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; kit.add(sv, kit.tube([[0, 0.18, 0], [Math.cos(a) * 0.05, 0.3, Math.sin(a) * 0.05]], 0.003, 4), std({ color: 0x4f7a3a, roughness: 0.7 }), [0, 0, 0]); }
      decor.push([sv, { mass: 1.0, shape: 'box' }]);
    }
    const vg = kit.group(root, [CX + 0.02, CT, CZ + 0.42], 0, 'vase');
    const swirl = kit.canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#b99350'; g.fillRect(0, 0, w, h); const q = kit.rng(5);
      for (let i = 0; i < 26; i++) { const x = i * w / 22; g.strokeStyle = i % 2 ? 'rgba(250,236,200,0.75)' : 'rgba(120,88,40,0.5)'; g.lineWidth = 6 + q() * 10; g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x + 40, h * 0.6, x + 120, h * 0.4, x + 160 + q() * 30, 0); g.stroke(); }
    });
    const vase = kit.add(vg, kit.lathe([[0.001, 0], [0.07, 0.004], [0.115, 0.05], [0.128, 0.11], [0.118, 0.17], [0.085, 0.215], [0.05, 0.235], [0.045, 0.245], [0.04, 0.24]], 9),
      std({ map: swirl, color: 0xffffff, metalness: 0.85, roughness: 0.25, flatShading: true }), [0, 0, 0]);
    // flowers
    const stemMat = std({ color: 0x4f7a3a, roughness: 0.7 }); const q = kit.rng(9);
    const blooms = [], leaves = [];
    for (let s = 0; s < 7; s++) {
      const a = s / 7 * Math.PI * 2 + q() * 0.4, rr = 0.05 + q() * 0.12, top = 0.38 + q() * 0.16;
      const tip = [Math.cos(a) * rr, top, Math.sin(a) * rr];
      kit.add(vg, kit.tube([[0, 0.2, 0], [tip[0] * 0.5, 0.3, tip[2] * 0.5], tip], 0.004, 8), stemMat, [0, 0, 0]);
      for (let b = 0; b < 14; b++) blooms.push([tip[0] + (q() - 0.5) * 0.07, tip[1] + (q() - 0.3) * 0.05, tip[2] + (q() - 0.5) * 0.07]);
      for (let l = 0; l < 4; l++) leaves.push([tip[0] * (0.4 + q() * 0.5), 0.26 + q() * 0.14, tip[2] * (0.4 + q() * 0.5), q() * 6.28, 0.5 + q() * 0.8]);
    }
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.011, 1), std({ color: 0xfbf8ef, roughness: 0.7, emissive: 0x111111 }), blooms.length);
    const lm = new THREE.InstancedMesh((() => { const c = new THREE.CircleGeometry(0.03, 10); c.scale(0.55, 1, 1); c.translate(0, 0.03, 0); return c; })(), std({ color: 0x3e6b34, roughness: 0.55, side: THREE.DoubleSide }), leaves.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    blooms.forEach((p, i) => bm.setMatrixAt(i, m4.compose(new THREE.Vector3(...p), qq.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + q() * 0.5))));
    leaves.forEach(([x, y, z, ry, tilt], i) => lm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), qq.setFromEuler(e.set(tilt, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))));
    bm.castShadow = lm.castShadow = true; vg.add(bm, lm);
    decor.push([vg, { mass: 2.5, shape: 'box' }]);
    // agate stone
    const stone = kit.add(root, (() => { const s = kit.sphere(0.055, 20, 14); s.scale(1, 0.75, 0.85); return s; })(), std({ color: 0x8f8c88, roughness: 0.35, metalness: 0.1 }), [CX + 0.06, CT + 0.04, CZ - 0.05]);
    decor.push([stone, { mass: 0.8, shape: 'ball' }]);
    // pearl boxes on the lower shelf
    const pearl = std({ map: kit.canvasTex(256, 256, (g, w, h) => { const r = kit.rng(4); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = 225 + r() * 28; g.fillStyle = `rgb(${v},${v - 3 + r() * 6},${v - 10 + r() * 10})`; g.fillRect(x, y, 15, 15); } g.fillStyle = 'rgba(180,170,150,0.6)'; for (let i = 0; i <= w; i += 16) { g.fillRect(i - 1, 0, 1, h); g.fillRect(0, i - 1, w, 1); } }), roughness: 0.35, metalness: 0.05 });
    const b1 = kit.add(root, kit.rbox(0.24, 0.10, 0.32, 0.01), pearl, [CX, 0.143 + 0.05, CZ + 0.35]);
    const b2 = kit.add(root, kit.rbox(0.20, 0.08, 0.26, 0.01), pearl, [CX, 0.143 + 0.10 + 0.04, CZ + 0.35], [0, 0.12, 0]);
    decor.push([b1, { mass: 1.2 }], [b2, { mass: 0.9 }]);
    // pink quartz geode bookend
    const geo = kit.add(root, (() => { const s = new THREE.DodecahedronGeometry(0.06, 0); s.scale(1.1, 0.9, 0.8); return s; })(), std({ color: 0xe8c9c2, roughness: 0.45, flatShading: true }), [CX, 0.143 + 0.05, CZ - 0.55]);
    decor.push([geo, { mass: 0.6, shape: 'hull' }]);
  }

  // ---------------------------------------------------------------- DRACAENA in a black pot by the stair (p02, p14)
  const PX = 9.76, PZ = 7.45;
  const plant = kit.group(root, [PX, 0, PZ], 0.4, 'plant');
  {
    kit.add(plant, kit.lathe([[0.001, 0], [0.135, 0], [0.15, 0.03], [0.168, 0.30], [0.172, 0.34], [0.158, 0.34], [0.155, 0.32], [0.001, 0.32]], 40), std({ color: 0x3a3b3d, roughness: 0.6, metalness: 0.05 }), [0, 0, 0]);
    kit.add(plant, kit.cyl(0.152, 0.152, 0.01, 24), std({ color: 0x8e8a63, roughness: 1 }), [0, 0.325, 0]); // moss
    const cane = std({ color: 0x8a7457, roughness: 0.9 });
    const leafG = (() => { const g = new THREE.PlaneGeometry(0.062, 1, 1, 8); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (y < 0.15 ? 0.45 + y * 3.6 : 1 - 0.9 * Math.pow((y - 0.15) / 0.85, 2))); p.setZ(i, 0.38 * y * y); } g.computeVertexNormals(); return g; })();
    const L = []; const q = kit.rng(77);
    for (const [hx, hz, top] of [[0.03, 0.02, 1.62], [-0.05, 0.03, 1.22], [0.02, -0.06, 0.92]]) {
      const tip = [hx * 2.2, top, hz * 2.2];
      kit.add(plant, kit.tube([[hx, 0.3, hz], [hx * 1.5, top * 0.6, hz * 1.5], tip], 0.016, 12), cane, [0, 0, 0]);
      for (const [yy, n, len] of [[top, 34, 0.30], [top - 0.12, 22, 0.28]]) {
        const fr = (yy - 0.3) / (top - 0.3); const c = [hx + (tip[0] - hx) * fr, yy, hz + (tip[2] - hz) * fr];
        if (yy < top) kit.add(plant, kit.tube([[c[0], yy - 0.08, c[2]], [c[0] + 0.02, yy, c[2]]], 0.008, 4), cane, [0, 0, 0]);
        for (let k = 0; k < n; k++) L.push([c[0], yy - 0.02 + q() * 0.06, c[2], q() * 6.283, 0.25 + q() * 1.1, len * (0.7 + q() * 0.5)]);
      }
    }
    const lm = new THREE.InstancedMesh(leafG, std({ color: 0x24501f, roughness: 0.38, side: THREE.DoubleSide }), L.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    L.forEach(([x, y, z, ry, tilt, len], i) => lm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), qq.setFromEuler(e.set(tilt, ry, 0, 'YXZ')), new THREE.Vector3(1, len, len))));
    lm.castShadow = true; plant.add(lm);
  }
  phys.boxAABB([PX - 0.17, 0, PZ - 0.17], [PX + 0.17, 0.34, PZ + 0.17]);

  // ---------------------------------------------------------------- upper hall: slim oak bench + bowl/books (dynamic props)
  {
    const bench = kit.group(root, [17.35 - 0.22, UP, 7.6], -Math.PI / 2, 'bench');
    kit.add(bench, kit.rbox(1.10, 0.05, 0.36, 0.01), oak, [0, 0.43, 0]);
    for (const sx of [-1, 1]) { kit.add(bench, kit.rbox(0.05, 0.405, 0.34, 0.006), oak, [sx * 0.5, 0.2025, 0]); }
    kit.add(bench, kit.box(0.95, 0.03, 0.28), oak, [0, 0.12, 0]);
    phys.solidGroup(bench);
    const b1 = kit.add(root, kit.rbox(0.24, 0.035, 0.17, 0.004), std({ color: 0x2b3a4e, roughness: 0.8 }), [17.13, UP + 0.475, 7.35]);
    const b2 = kit.add(root, kit.rbox(0.21, 0.03, 0.15, 0.004), std({ color: 0xd9d2c4, roughness: 0.8 }), [17.13, UP + 0.508, 7.36], [0, 0.2, 0]);
    const bowl = kit.add(root, kit.lathe([[0.001, 0], [0.05, 0.002], [0.09, 0.03], [0.11, 0.07], [0.104, 0.072], [0.084, 0.035], [0.045, 0.012], [0.001, 0.012]], 32), std({ color: 0xcbc3b4, roughness: 0.6 }), [17.13, UP + 0.455, 7.95]);
    decor.push([b1, { mass: 0.6 }], [b2, { mass: 0.5 }], [bowl, { mass: 0.7, shape: 'hull' }]);
    // art in the north hall
    framed(root, 0.9, 1.1, artMat(kit.canvasTex(500, 600, drawSea)), frameWhite, [15.75 + 0.005, UP + 1.5, 7.6], R_W, { fw: 0.03, mat: 0.06 });
  }

  // ---------------------------------------------------------------- p16: cased doorway at the west end of the upper hall into an oak built-in
  // (shallow fur-out wall at z 11.10 in front of the hall's back wall; oak shaker cabinets, open shelves, dark backsplash, black counter)
  {
    const ZW = 11.10, T = 0.10, X0 = 8.30, X1 = 10.0, DX0 = 8.55, DX1 = 9.45, DH = 2.20, ZB = 11.60;
    const wall = wallWhite;
    kit.boxAt(root, wall, X0, UP, ZW, DX0 - X0, PLATE - UP, T);                 // left of opening (camera right)
    kit.boxAt(root, wall, DX1, UP, ZW, X1 - DX1, PLATE - UP, T);                // right part
    kit.boxAt(root, wall, DX0, UP + DH, ZW, DX1 - DX0, PLATE - UP - DH, T);     // header
    kit.boxAt(root, wall, X1 - 0.08, UP, ZW, 0.08, PLATE - UP, ZB - ZW);        // end return
    // casing (white trim) + baseboard on the hall face
    for (const [x, w] of [[DX0 - 0.07, 0.07], [DX1, 0.07]]) kit.boxAt(root, frameWhite, x, UP, ZW - 0.018, w, DH + 0.07, 0.018);
    kit.boxAt(root, frameWhite, DX0 - 0.07, UP + DH, ZW - 0.018, DX1 - DX0 + 0.14, 0.07, 0.018);
    kit.boxAt(root, wall, X0, UP, ZW - 0.014, DX0 - 0.07 - X0, BB, 0.014);
    kit.boxAt(root, wall, DX1 + 0.07, UP, ZW - 0.014, X1 - DX1 - 0.07, BB, 0.014);
    // light switch beside the doorway
    kit.add(root, kit.rbox(0.075, 0.12, 0.012, 0.004), frameWhite, [DX1 + 0.18, UP + 1.22, ZW - 0.006]);
    // nook interior: ceiling with a can, floor oak
    kit.boxAt(root, M.ceilingWhite, X0, UP + 2.45, ZW + T, X1 - 0.08 - X0, 0.02, ZB - ZW - T);
    kit.boxAt(root, M.oakFloor || oak, X0, UP, ZW + T - 0.02, X1 - X0, 0.004, ZB - ZW - T + 0.02);
    kit.add(root, kit.cyl(0.05, 0.05, 0.004, 20), std({ color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 2.0 }), [9.0, UP + 2.448, 11.40]);
    // base cabinets: shaker drawers, black counter
    const oakC = M.oakCabinet || oak, blk = std({ color: 0x141414, roughness: 0.35 });
    const cz = ZB - 0.36, cw = X1 - 0.08 - X0;
    kit.boxAt(root, oakC, X0, UP, cz, cw, 0.86, 0.36);
    const nd = 3, dw = cw / nd;
    for (let k = 0; k < nd; k++) for (let r = 0; r < 3; r++) {
      const fx = X0 + k * dw + 0.004, fy = UP + 0.1 + r * 0.25;
      const f = kit.add(root, kit.shakerFront(dw - 0.008, 0.24, 0.045, 0.02), oakC, [fx, fy, cz - 0.02]);
      kit.add(root, kit.sphere(0.012, 10, 8), blk, [fx + dw / 2, fy + 0.18, cz - 0.03]);
    }
    kit.boxAt(root, blk, X0, UP + 0.86, cz - 0.03, cw, 0.035, 0.39);                                 // black counter
    const splash = std({ color: 0x8a7c70, roughness: 0.45, map: kit.canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#3a3330'; g.fillRect(0, 0, w, h); const q = kit.rng(12); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${60 + q() * 30},${50 + q() * 25},${42 + q() * 20},0.5)`; g.fillRect(0, q() * h, w, 1 + q() * 2); } }) });
    kit.boxAt(root, splash, X0, UP + 0.895, ZB - 0.02, cw, 0.55, 0.02);
    // upper: shaker door at the left (camera view), open oak shelves with coral + brass decor
    kit.boxAt(root, oakC, X0, UP + 1.45, ZB - 0.32, cw, 0.02, 0.32);
    kit.boxAt(root, oakC, X0, UP + 2.43, ZB - 0.32, cw, 0.02, 0.32);
    kit.boxAt(root, oakC, X0, UP + 1.45, ZB - 0.02, cw, 1.0, 0.02);                                  // back
    kit.boxAt(root, oakC, 9.10, UP + 1.45, ZB - 0.32, 0.02, 1.0, 0.32);                              // divider
    kit.add(root, kit.shakerFront(0.58, 0.96, 0.05, 0.02), oakC, [9.12, UP + 1.47, ZB - 0.34]);
    kit.add(root, kit.sphere(0.012, 10, 8), blk, [9.17, UP + 1.6, ZB - 0.35]);
    for (const y of [UP + 1.78, UP + 2.10]) kit.boxAt(root, oakC, X0, y, ZB - 0.30, 9.10 - X0, 0.025, 0.28);
    const coral = std({ color: 0xf1ebe0, roughness: 0.8, flatShading: true });
    const cq = kit.rng(44);
    for (const [x, y] of [[8.75, UP + 2.125], [8.55, UP + 0.895], [8.85, UP + 1.805]]) {
      for (let i = 0; i < 7; i++) { const a = cq() * 6.28; kit.add(root, kit.tube([[x, y, 11.45], [x + Math.cos(a) * 0.05, y + 0.07 + cq() * 0.05, 11.45 + Math.sin(a) * 0.04]], 0.008, 6), coral, [0, 0, 0]); }
    }
    kit.boxAt(root, M.brass, 8.98, UP + 1.805, 11.40, 0.08, 0.06, 0.08);
    kit.boxAt(root, std({ color: 0xe6dccb, roughness: 0.9 }), 8.45, UP + 1.47, 11.36, 0.22, 0.06, 0.16);
    // open oak door leaf swung in against the left jamb (black hinges)
    kit.boxAt(root, M.oakDoor || oak, DX1 - 0.045, UP, ZW + T, 0.04, 2.16, 0.40);
    for (const y of [0.25, 1.05, 1.9]) kit.boxAt(root, blk, DX1 - 0.05, UP + y, ZW + T - 0.005, 0.05, 0.1, 0.012);
    phys.boxAABB([X0, UP, ZW], [X1, PLATE, ZB]);
  }

  // ---------------------------------------------------------------- finish: merge static, then dynamics
  kit.mergeStatic(root);
  for (const [o, opt] of decor) { o.userData.keep = true; try { phys.dynamic(o, opt); } catch (e) { console.warn('[foyer] dynamic', e); } }
}

// ======================================================================================= canvas art
function drawOcto(g, w, h, q, k) {
  // grey-blue distressed ground (p16): muted slate, not saturated navy
  const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#6f8299'); grad.addColorStop(0.5, '#5d7189'); grad.addColorStop(1, '#4c5f77');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const lt = q() < 0.5; g.fillStyle = lt ? `rgba(${170 + q() * 50},${180 + q() * 45},${195 + q() * 40},${0.05 + q() * 0.12})` : `rgba(30,40,58,${0.05 + q() * 0.14})`; g.beginPath(); g.arc(q() * w, q() * h, 4 + q() * 36, 0, 7); g.fill(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(200,210,230,${0.03 + q() * 0.05})`; g.fillRect(q() * w, q() * h, 20 + q() * 140, 1 + q() * 2); }
  const cream = (a) => `rgba(238,232,214,${a})`;
  if (k === 2) { // abstract panel with a single curling tentacle
    tentacle(g, q, w * 0.25, h * 0.02, w * 0.6, h * 0.7, 13, cream); tentacle(g, q, w * 0.8, h * 0.25, w * 0.35, h * 0.95, 10, cream); return;
  }
  const cx = w * (0.5 + (q() - 0.5) * 0.04), hy = h * 0.17, rx = w * 0.13, ry = h * 0.105;
  // stippled mantle (tall bulb) + eye bulge row
  const inBulb = (x, y) => { const dx = (x - cx) / rx, dy = (y - hy) / ry; return dx * dx + dy * dy < 1; };
  for (let i = 0; i < 4200; i++) { const x = cx + (q() - 0.5) * 2 * rx, y = hy + (q() - 0.5) * 2 * ry; if (!inBulb(x, y)) continue; const edge = Math.hypot((x - cx) / rx, (y - hy) / ry); g.fillStyle = cream(0.25 + edge * 0.7 * q()); g.fillRect(x, y, 1.8, 1.8); }
  g.strokeStyle = cream(0.9); g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, hy, rx, ry, 0, 0, 7); g.stroke();
  g.beginPath(); g.ellipse(cx, hy + ry * 1.05, rx * 0.8, ry * 0.32, 0, 0, 7); g.stroke();
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * rx * 0.45, hy + ry * 1.0, 6, 0, 7); g.stroke(); g.fillStyle = cream(0.9); g.beginPath(); g.arc(cx + sx * rx * 0.45, hy + ry * 1.0, 2.5, 0, 7); g.fill(); }
  for (let t = 0; t < 8; t++) {
    const th = Math.PI / 2 + (t - 3.5) * 0.36 + (q() - 0.5) * 0.12, len = h * (0.42 + q() * 0.28);
    const sx = cx + (t - 3.5) * rx * 0.2, sy = hy + ry * 1.25;
    tentacle(g, q, sx, sy, sx + Math.cos(th) * len * 0.85, sy + Math.sin(th) * len, 11, cream);
  }
}
function tentacle(g, q, sx, sy, ex, ey, wid, cream) {
  const pts = []; const N = 60; const ph = q() * 6.28, amp = 20 + q() * 30;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([sx + (ex - sx) * t + Math.sin(t * 5 + ph) * amp * t, sy + (ey - sy) * t]); }
  // curl at the end
  const [lx, ly] = pts[N]; const dir = q() < 0.5 ? 1 : -1;
  for (let i = 1; i <= 30; i++) { const a = i / 30 * 5.5; const r = 26 * (1 - i / 34); pts.push([lx + dir * (Math.cos(a) * r - r), ly + Math.sin(a) * r]); }
  for (let i = 1; i < pts.length; i++) {
    const t = i / pts.length; g.strokeStyle = cream(0.85); g.lineWidth = Math.max(1, wid * (1 - t)); g.lineCap = 'round';
    g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke();
    if (i % 3 === 0) { g.fillStyle = cream(0.6); g.beginPath(); g.arc(pts[i][0] + wid * (1 - t) * 0.9, pts[i][1], Math.max(0.8, wid * 0.28 * (1 - t)), 0, 7); g.fill(); }
  }
}
function drawSea(g, w, h) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#dfe5e7'); grad.addColorStop(0.36, '#b4c7d0'); grad.addColorStop(0.44, '#5e88a6'); grad.addColorStop(0.5, '#7aa1bb');
  grad.addColorStop(0.58, '#3f6680'); grad.addColorStop(0.8, '#1f3446'); grad.addColorStop(1, '#0c141c');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.filter = 'blur(3px)'; let s = 3;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 160; i++) { const y = h * (0.38 + r() * 0.6); g.fillStyle = r() < 0.5 ? `rgba(120,180,220,${0.15 + r() * 0.2})` : `rgba(10,30,60,${0.15 + r() * 0.25})`; g.fillRect(0, y, w, 1 + r() * 5); }
  g.filter = 'none';
  g.fillStyle = 'rgba(20,25,30,0.55)'; g.fillRect(0, h * 0.86, w, 3); for (let x = 0; x < w; x += 22) g.fillRect(x, h * 0.86, 2, h * 0.05);
}
function drawLaMer(g, w, h) {
  g.fillStyle = '#eeebe3'; g.fillRect(0, 0, w, h); let s = 8;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(120,110,95,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 1, 1); }
  g.fillStyle = '#1d1c1b'; g.textAlign = 'center'; g.font = 'bold 120px Impact, "Arial Black", sans-serif';
  g.fillText('LA', w / 2, h * 0.42); g.fillText('MER', w / 2, h * 0.72);
  g.fillStyle = '#eeebe3'; for (let i = 0; i < 900; i++) g.fillRect(r() * w, h * 0.15 + r() * h * 0.6, 1 + r() * 3, 1 + r() * 2);
  g.fillStyle = 'rgba(30,30,30,0.7)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * w, r() * h, r() * 2.2, 0, 7); g.fill(); }
}
function drawZebra(g, w, h) {
  const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#d8c6aa'); grad.addColorStop(1, '#efe4d2'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // arched french window
  g.fillStyle = '#f5ede1'; g.beginPath(); g.moveTo(w * 0.28, h * 0.75); g.lineTo(w * 0.28, h * 0.25); g.arc(w * 0.42, h * 0.25, w * 0.14, Math.PI, 0); g.lineTo(w * 0.56, h * 0.75); g.fill();
  g.strokeStyle = 'rgba(150,130,105,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.42, h * 0.12); g.lineTo(w * 0.42, h * 0.75); for (let y = 0.3; y < 0.75; y += 0.11) { g.moveTo(w * 0.28, h * y); g.lineTo(w * 0.56, h * y); } g.stroke();
  // checker floor
  for (let j = 0; j < 6; j++) for (let i = -2; i < 16; i++) { g.fillStyle = (i + j) % 2 ? '#d2bf9f' : '#efe5d4'; const y0 = h * 0.75 + j * h * 0.045; g.beginPath(); g.moveTo(i * w / 12 + j * 12, y0); g.lineTo((i + 1) * w / 12 + j * 12, y0); g.lineTo((i + 1) * w / 12 + (j + 1) * 12, y0 + h * 0.045); g.lineTo(i * w / 12 + (j + 1) * 12, y0 + h * 0.045); g.fill(); }
  // zebra
  const zx = w * 0.70, zy = h * 0.52; g.save();
  g.beginPath(); g.ellipse(zx, zy, w * 0.11, h * 0.085, 0, 0, 7);           // body
  g.moveTo(zx - w * 0.09, zy - h * 0.03); g.lineTo(zx - w * 0.14, zy - h * 0.2); g.lineTo(zx - w * 0.11, zy - h * 0.22); g.lineTo(zx - w * 0.05, zy - h * 0.05); // neck
  g.ellipse(zx - w * 0.145, zy - h * 0.2, w * 0.035, h * 0.022, -0.6, 0, 7);  // head
  for (const lx of [-0.08, -0.05, 0.06, 0.09]) g.rect(zx + w * lx - 6, zy + h * 0.05, 12, h * 0.2);
  g.fillStyle = '#efe6d6'; g.fill(); g.clip();
  g.strokeStyle = '#3b342c'; g.lineWidth = 7; for (let i = -12; i < 20; i++) { g.beginPath(); g.moveTo(zx - w * 0.2 + i * 14, zy - h * 0.3); g.bezierCurveTo(zx - w * 0.15 + i * 14, zy - h * 0.1, zx - w * 0.22 + i * 14, zy + h * 0.1, zx - w * 0.18 + i * 14, zy + h * 0.32); g.stroke(); }
  g.restore();
  g.fillStyle = 'rgba(90,110,70,0.55)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(w * 0.92 + Math.sin(i) * 30, h * 0.2 + i * 9, 26, 8, i, 0, 7); g.fill(); }
}
