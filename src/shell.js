// Builds the architectural shell from plan.js: exterior + interior walls with real openings,
// floor slabs (with stair void), default flat ceilings, windows, doors, sliders, garage doors, roofs.
// Room modules add finishes/furniture on top of this. Physics colliders are registered for walls,
// slabs, closed doors and glazing.
import * as THREE from 'three';
import * as P from './plan.js';
import { M } from './kit/materials.js';

const V2 = (x, z) => new THREE.Vector2(x, z);

// ---------- geometry helpers -------------------------------------------------------------
// Box lying along segment p0->p1 (in XZ), from the face line going `depth` along unit normal n,
// spanning y0..y1. Faces get UVs in metres. Groups: 0 = face on the line side (A), 1 = far face (B),
// 2 = top/bottom/ends.
function segBox(p0, p1, n, depth, y0, y1) {
  const dx = p1.x - p0.x, dz = p1.y - p0.y; const L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const A0 = [p0.x, p0.y], A1 = [p1.x, p1.y];
  const B0 = [p0.x + n.x * depth, p0.y + n.y * depth], B1 = [p1.x + n.x * depth, p1.y + n.y * depth];
  const pos = [], uv = [], nor = [], idx = [], groups = [];
  let vi = 0;
  function quad(a, b, c, d, nrm, uvs, g) { // a,b,c,d CCW seen from outside
    const start = idx.length;
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [d, uvs[3]]]) { pos.push(...p); nor.push(...nrm); uv.push(...t); }
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
    groups.push([start, 6, g]);
  }
  const h = y1 - y0;
  // which way is "outward" for face A: -n.
  // Face A (on line), normal -n
  const nA = [-n.x, 0, -n.y], nB = [n.x, 0, n.y];
  // order so that winding is CCW from outside: for face A, viewer at -n side.
  // Build both orientations then pick by checking cross product.
  function face(P0, P1, nrm, g, uOff) {
    const a = [P0[0], y0, P0[1]], b = [P1[0], y0, P1[1]], c = [P1[0], y1, P1[1]], d = [P0[0], y1, P0[1]];
    // cross((b-a),(d-a)) should point along nrm
    const e1 = [b[0] - a[0], 0, b[2] - a[2]], e2 = [0, h, 0];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const ok = cx * nrm[0] + cz * nrm[2] > 0;
    const u0 = uOff, u1 = uOff + L;
    if (ok) quad(a, b, c, d, nrm, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], g);
    else quad(b, a, d, c, nrm, [[u1, y0], [u0, y0], [u0, y1], [u1, y1]], g);
  }
  const uOff = (p0.x * ux + p0.y * uz); // continuous texture along long walls
  face(A0, A1, nA, 0, uOff);
  face(B0, B1, nB, 1, uOff);
  // top
  const top = [[A0[0], y1, A0[1]], [A1[0], y1, A1[1]], [B1[0], y1, B1[1]], [B0[0], y1, B0[1]]];
  const bot = [[A0[0], y0, A0[1]], [B0[0], y0, B0[1]], [B1[0], y0, B1[1]], [A1[0], y0, A1[1]]];
  const fix = (q, nrm) => { // ensure CCW about nrm
    const e1 = q[1].map((v, i) => v - q[0][i]), e2 = q[3].map((v, i) => v - q[0][i]);
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    return (c[0] * nrm[0] + c[1] * nrm[1] + c[2] * nrm[2]) > 0 ? q : [q[1], q[0], q[3], q[2]];
  };
  const tq = fix(top, [0, 1, 0]); quad(...tq, [0, 1, 0], tq.map(p => [p[0], p[2]]), 2);
  const bq = fix(bot, [0, -1, 0]); quad(...bq, [0, -1, 0], bq.map(p => [p[0], p[2]]), 2);
  // ends
  const end0 = fix([[A0[0], y0, A0[1]], [B0[0], y0, B0[1]], [B0[0], y1, B0[1]], [A0[0], y1, A0[1]]], [-ux, 0, -uz]);
  quad(...end0, [-ux, 0, -uz], [[0, y0], [depth, y0], [depth, y1], [0, y1]], 2);
  const end1 = fix([[A1[0], y0, A1[1]], [A1[0], y1, A1[1]], [B1[0], y1, B1[1]], [B1[0], y0, B1[1]]], [ux, 0, uz]);
  quad(...end1, [ux, 0, uz], [[0, y0], [0, y1], [depth, y1], [depth, y0]], 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // merge consecutive groups of same material
  groups.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
  const newIdx = []; const merged = [];
  for (const gi of [0, 1, 2]) { const st = newIdx.length; for (const [s, c, m] of groups) if (m === gi) for (let k = 0; k < c; k++) newIdx.push(idx[s + k]); merged.push([st, newIdx.length - st, gi]); }
  g.setIndex(newIdx); for (const [s, c, m] of merged) if (c) g.addGroup(s, c, m);
  return g;
}

function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return a / 2; }

// ---------- openings -------------------------------------------------------------------
function openingsOnSegment(level, a, b, tol) {
  const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); const ux = dx / L, uz = dz / L;
  const out = [];
  for (const o of P.OPENINGS) {
    if (o.level !== level || o.type === 'skylight') continue;
    const rx = o.at[0] - a[0], rz = o.at[1] - a[1];
    const s = rx * ux + rz * uz; const perp = Math.abs(rx * -uz + rz * ux);
    if (perp > tol || s < -0.01 || s > L + 0.01) continue;
    out.push({ o, s0: Math.max(0, s - o.w / 2), s1: Math.min(L, s + o.w / 2), s });
  }
  return out.sort((p, q) => p.s0 - q.s0);
}

// ---------- the builder ------------------------------------------------------------------
export function buildShell(ctx) {
  for (const m of [M.extWhite, M.extWhiteDouble, M.shingles, M.soffit, M.garageDoor]) ctx.kit.outdoor(m);
  const root = new THREE.Group(); root.name = 'shell'; ctx.scene.add(root);
  const wallMatsExt = [M.paintWhite, M.extWhite, M.paintWhite]; // A(face on outer line) = exterior siding
  const wallMatsInt = [M.paintWhite, M.paintWhite, M.paintWhite];
  const doors = [];
  const add = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; root.add(m); return m; };

  function wallRun(level, a, b, n, depth, y0, y1, mats, tagFaceLineIsCentre) {
    // a,b on reference line; n unit (inward/normal); if centre line, shift back by depth/2
    let A = V2(a[0], a[1]), B = V2(b[0], b[1]); const N = V2(n[0], n[1]);
    if (tagFaceLineIsCentre) { A = A.clone().addScaledVector(N, -depth / 2); B = B.clone().addScaledVector(N, -depth / 2); }
    const L = A.distanceTo(B); const U = B.clone().sub(A).divideScalar(L);
    const ops = openingsOnSegment(level, a, b, tagFaceLineIsCentre ? depth / 2 + 0.12 : 0.30);
    const pieces = []; let cur = 0;
    const lf = P.LEVELS[level].floor;
    for (const { o, s0, s1 } of ops) {
      if (s0 > cur + 0.001) pieces.push([cur, s0, y0, y1]);
      const sillY = lf + o.sill, headY = lf + o.head;
      if (sillY > y0 + 0.001) pieces.push([s0, s1, y0, sillY]);
      if (headY < y1 - 0.001) pieces.push([s0, s1, headY, y1]);
      cur = Math.max(cur, s1);
      buildOpeningFill(o, A.clone().addScaledVector(U, s0), A.clone().addScaledVector(U, s1), N, depth, sillY, headY, tagFaceLineIsCentre);
    }
    if (cur < L - 0.001) pieces.push([cur, L, y0, y1]);
    for (const [s0, s1, py0, py1] of pieces) {
      const p0 = A.clone().addScaledVector(U, s0), p1 = A.clone().addScaledVector(U, s1);
      const g = segBox(p0, p1, N, depth, py0, py1);
      const m = add(g, mats, 'wall');
      ctx.phys.boxFromSeg(p0, p1, N, depth, py0, py1);
    }
  }

  // ---- opening fills: windows, doors, sliders, garage doors
  function buildOpeningFill(o, p0, p1, N, depth, y0, y1, interior) {
    const w = p0.distanceTo(p1); const h = y1 - y0; const U = p1.clone().sub(p0).normalize();
    const g = new THREE.Group(); g.name = 'opening:' + o.id;
    // local frame: x along wall (p0->p1), y up, z along N (into wall depth)
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(U.x, 0, U.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(N.x, 0, N.y));
    g.quaternion.setFromRotationMatrix(basis); g.position.set(p0.x, y0, p0.y);
    root.add(g);
    const fr = 0.045, fd = 0.07; // frame bar width & depth
    const zSet = interior ? depth / 2 : 0.10; // glazing plane depth from reference line
    const box = (bw, bh, bd, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
    function glazedPanel(pw, ph, cols, rows, mat = M.blackMetal) { // centred at origin bottom-left
      const pg = new THREE.Group();
      pg.add(box(pw, fr, fd, pw / 2, fr / 2, 0, mat), box(pw, fr, fd, pw / 2, ph - fr / 2, 0, mat));
      pg.add(box(fr, ph, fd, fr / 2, ph / 2, 0, mat), box(fr, ph, fd, pw - fr / 2, ph / 2, 0, mat));
      for (let c = 1; c < cols; c++) pg.add(box(fr * 0.6, ph, fd * 0.8, (pw * c) / cols, ph / 2, 0, mat));
      for (let r = 1; r < rows; r++) pg.add(box(pw, fr * 0.6, fd * 0.8, pw / 2, (ph * r) / rows, 0, mat));
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(pw - fr, ph - fr), M.glass); gl.position.set(pw / 2, ph / 2, 0); gl.castShadow = false; gl.renderOrder = 2; gl.name = 'glass';
      pg.add(gl); return pg;
    }
    const [cols, rows] = o.panes || [1, 1];
    if (o.type === 'window') {
      const p = glazedPanel(w, h, cols, rows); p.position.z = zSet; g.add(p);
      ctx.phys.boxLocal(g, w / 2, h / 2, zSet, w / 2, h / 2, 0.04);
    } else if (o.type === 'slider') {
      const n = Math.max(2, cols); const pw = w / n;
      const open = o.open ?? 0;
      for (let i = 0; i < n; i++) {
        const p = glazedPanel(pw + fr, h, 1, 1);
        const stackX = (w - pw - 0.02) - i * 0.02; // pocket stack at far end
        p.position.set(THREE.MathUtils.lerp(i * pw, stackX, open), 0, zSet + (i % 2) * 0.06);
        g.add(p);
      }
      if (open < 0.5) ctx.phys.boxLocal(g, w / 2, h / 2, zSet, w / 2, h / 2, 0.06);
    } else if (o.type === 'french' || o.type === 'door') {
      const leaves = o.type === 'french' && w > 1.2 ? 2 : 1;
      const lw = w / leaves;
      const leafs = [];
      for (let i = 0; i < leaves; i++) {
        const hinge = new THREE.Group(); hinge.position.set(i === 0 ? 0 : w, 0, interior ? depth / 2 : zSet);
        let leaf;
        if (o.type === 'french') { leaf = glazedPanel(lw, h, 1, rows || 1); leaf.position.x = i === 0 ? 0 : -lw; }
        else { // flat white-oak slab door + black lever
          leaf = new THREE.Group();
          const slab = box(lw - 0.01, h - 0.01, 0.045, (lw) / 2, h / 2, 0, M.oakDoor); leaf.add(slab);
          const lever = box(0.13, 0.018, 0.018, lw - 0.13, 1.0, 0.045, M.blackMetal); leaf.add(lever);
          const lever2 = lever.clone(); lever2.position.z = -0.045; leaf.add(lever2);
        }
        hinge.add(leaf); g.add(hinge);
        leafs.push({ hinge, sign: i === 0 ? 1 : -1 });
      }
      const door = { o, g, leafs, w, h, open: o.open ?? (o.type === 'door' ? 1 : 0), target: 0, colliders: [] };
      door.target = door.open; doors.push(door);
      const setPose = () => { for (const L of door.leafs) L.hinge.rotation.y = -L.sign * door.open * Math.PI * 0.5; };
      door.setPose = setPose; setPose();
      door.world = new THREE.Vector3(); g.updateMatrixWorld(); g.localToWorld(door.world.set(w / 2, 1, 0));
      door.closedCollider = () => ctx.phys.boxLocal(g, w / 2, h / 2, interior ? depth / 2 : zSet, w / 2, h / 2, 0.03, true);
      if (door.open < 0.5) door.collider = door.closedCollider();
    } else if (o.type === 'doorway') {
      // cased opening: nothing to fill
    } else if (o.type === 'garage') {
      const pg = new THREE.Group();
      const panel = box(w, h, 0.05, w / 2, h / 2, zSet + 0.05, M.garageDoor); pg.add(panel);
      const nGroove = 5; for (let i = 1; i < nGroove; i++) pg.add(box(w, 0.012, 0.012, w / 2, (h * i) / nGroove, zSet + 0.02, M.blackMetal));
      g.add(pg); ctx.phys.boxLocal(g, w / 2, h / 2, zSet, w / 2, h / 2, 0.05);
    }
  }

  // ---- exterior walls
  for (const level of [0, 1]) {
    const poly = P.EXT[level]; const cw = polyArea(poly) < 0; // y-down screen sense
    const lf = P.LEVELS[level].floor;
    const y0 = level === 0 ? -0.30 : P.LEVELS[0].ceil + 0.30; // ground walls start below slab
    const y1 = level === 0 ? P.LEVELS[1].floor : P.LEVELS[1].plate;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz);
      // inward normal: polygon orientation decides
      let n = [-dz / L, dx / L]; if (polyArea(poly) > 0) n = [dz / L, -dx / L];
      // verify with a probe point
      const mid = [(a[0] + b[0]) / 2 + n[0] * 0.5, (a[1] + b[1]) / 2 + n[1] * 0.5];
      if (!pointInPoly(mid, poly)) n = [-n[0], -n[1]];
      let mats = wallMatsExt;
      if (P.EXT_INNER_EXPOSED.some(e => e.level === level && near(e.a, a) && near(e.b, b))) mats = [M.paintWhite, M.paintWhite, M.paintWhite];
      // one-storey family wing & powder: ground walls only up to plate 3.30
      const oneStorey = level === 0 && !edgeOnPoly(a, b, P.EXT[1]);
      const top = oneStorey ? 3.30 : y1;
      // NOTE face A (on the outer line) must be exterior: segBox's group 0 is face A; swap materials.
      wallRun(level, a, b, n, P.EXT_T, level === 0 ? y0 : P.LEVELS[1].floor, top, [mats[1], mats[0], mats[2]], false);
    }
  }
  // ---- interior walls
  for (const level of [0, 1]) {
    const lf = P.LEVELS[level].floor;
    const top = level === 0 ? P.LEVELS[0].ceil : P.LEVELS[1].plate;
    for (const wdef of P.INT_WALLS[level]) {
      const t = wdef.t || P.INT_T; const a = wdef.a, b = wdef.b;
      const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz);
      wallRun(level, a, b, [-dz / L, dx / L], t, lf, top, wallMatsInt, true);
    }
  }

  // ---- slabs
  function slab(poly, holes, yTop, thick, topMat, botMat, name) {
    const shapeTop = new THREE.Shape(poly.map(([x, z]) => V2(x, -z)));
    const shapeBot = new THREE.Shape(poly.map(([x, z]) => V2(x, z)));
    for (const h of holes) {
      const [x0, z0, x1, z1] = h;
      shapeTop.holes.push(new THREE.Path([V2(x0, -z0), V2(x1, -z0), V2(x1, -z1), V2(x0, -z1)]));
      shapeBot.holes.push(new THREE.Path([V2(x0, z0), V2(x0, z1), V2(x1, z1), V2(x1, z0)]));
    }
    const gt = new THREE.ShapeGeometry(shapeTop); gt.rotateX(-Math.PI / 2); gt.translate(0, yTop, 0);
    const mt = add(gt, topMat, name + ':top'); mt.castShadow = false;
    if (botMat) { const gb = new THREE.ShapeGeometry(shapeBot); gb.rotateX(Math.PI / 2); gb.translate(0, yTop - thick, 0); const mb = add(gb, botMat, name + ':bottom'); mb.castShadow = false; }
    // edges (void edges visible from the stair) + collider
    const ex = new THREE.ExtrudeGeometry(shapeBot, { depth: thick, bevelEnabled: false });
    ex.rotateX(Math.PI / 2); ex.translate(0, yTop, 0); // extrudes from yTop down to yTop-thick
    ex.clearGroups(); ex.addGroup(0, ex.index ? ex.index.count : ex.attributes.position.count, 0);
    const me = new THREE.Mesh(ex, M.paintWhite); me.name = name + ':edge'; me.receiveShadow = true; me.castShadow = true; me.renderOrder = -1;
    // hide caps by pushing them inside: caps coincide with top/bottom meshes; use polygonOffset to lose the fight
    me.material = M.paintWhiteBack; root.add(me);
    ctx.phys.trimesh(ex);
  }
  slab(P.EXT[0], [], 0.0, 0.30, M.oakFloor, null, 'slab0');
  slab(P.EXT[1], P.VOIDS[1] || [], P.LEVELS[1].floor, 0.30, M.oakFloor, M.ceilingWhite, 'slab1');
  // balcony slab
  { const r = P.ROOMS.balcony.rect; slab([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], [], P.LEVELS[1].floor, 0.30, M.paintWhite, M.ceilingWhite, 'balcony'); }

  // ---- default flat ceilings for upper rooms (rooms that build their own are skipped)
  const skip = new Set(ctx.ownCeilings || []);
  for (const [id, r] of Object.entries(P.ROOMS)) {
    if (r.level !== 1 || r.outdoor || skip.has(id)) continue;
    const [x0, z0, x1, z1] = r.rect; const e = 0.08;
    const g = new THREE.PlaneGeometry(x1 - x0 + 2 * e, z1 - z0 + 2 * e); g.rotateX(Math.PI / 2);
    const m = add(g, M.ceilingWhite, 'ceil:' + id); m.position.set((x0 + x1) / 2, P.LEVELS[1].plate, (z0 + z1) / 2); m.castShadow = true;
  }
  if (!skip.has('family')) { // family room has no slab above it: temporary flat lid until the piece vaults it
    const [x0, z0, x1, z1] = P.ROOMS.family.rect; const g = new THREE.PlaneGeometry(x1 - x0 + 0.3, z1 - z0 + 0.3); g.rotateX(Math.PI / 2);
    const m = add(g, M.ceilingWhite, 'ceil:family'); m.position.set((x0 + x1) / 2, 3.30, (z0 + z1) / 2);
  }
  if (!skip.has('powder')) { const [x0, z0, x1, z1] = P.ROOMS.powder.rect; const g = new THREE.PlaneGeometry(x1 - x0 + 0.3, z1 - z0 + 0.3); g.rotateX(Math.PI / 2); const m = add(g, M.ceilingWhite, 'ceil:powder'); m.position.set((x0 + x1) / 2, 3.05, (z0 + z1) / 2); }

  // ---- roofs
  if (!ctx.skipRoofs) for (const r of P.ROOFS) buildRoof(r, root, ctx);

  return { root, doors };
}

function near(p, q) { return Math.abs(p[0] - q[0]) < 0.02 && Math.abs(p[1] - q[1]) < 0.02; }
function edgeOnPoly(a, b, poly) {
  // is segment a-b covered by some edge of poly (collinear & overlapping)?
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], d = poly[(i + 1) % poly.length];
    const dx = d[0] - c[0], dz = d[1] - c[1]; const L = Math.hypot(dx, dz);
    const dist = p => Math.abs(((p[0] - c[0]) * dz - (p[1] - c[1]) * dx) / L);
    if (dist(a) < 0.02 && dist(b) < 0.02) {
      const s = p => ((p[0] - c[0]) * dx + (p[1] - c[1]) * dz) / L;
      const sa = s(a), sb = s(b); if (Math.min(sa, sb) > -0.02 && Math.max(sa, sb) < L + 0.02) return true;
    }
  }
  return false;
}
export function pointInPoly([x, z], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// ---------- roofs ----------------------------------------------------------------------
function buildRoof(r, root, ctx) {
  const e = P.EAVE; const [x0, z0, x1, z1] = r.rect;
  const verts = []; const tris = []; const gables = [];
  const V = (x, y, z) => { verts.push([x, y, z]); return verts.length - 1; };
  const T = (a, b, c) => tris.push([a, b, c]);
  const Q = (a, b, c, d) => { T(a, b, c); T(a, c, d); };
  if (r.kind === 'gable' || r.kind === 'hip') {
    const alongX = r.axis === 'x';
    const W = alongX ? z1 - z0 : x1 - x0; const half = W / 2; const rise = r.ridge - r.plate; const slope = rise / half;
    const ye = r.plate - slope * e;
    const X0 = x0 - e, X1 = x1 + e, Z0 = z0 - e, Z1 = z1 + e;
    if (alongX) {
      const zc = (z0 + z1) / 2;
      let rx0 = X0, rx1 = X1;
      if (r.kind === 'hip') { rx0 = Math.min(x0 + half, (x0 + x1) / 2); rx1 = Math.max(x1 - half, (x0 + x1) / 2); }
      const a = V(X0, ye, Z0), b = V(X1, ye, Z0), c = V(X1, ye, Z1), d = V(X0, ye, Z1), r0 = V(rx0, r.ridge, zc), r1 = V(rx1, r.ridge, zc);
      Q(a, r0, r1, b); Q(c, r1, r0, d);
      if (r.kind === 'hip') { T(b, r1, c); T(d, r0, a); } else gables.push([[x0, z0, x0, z1], 'x0'], [[x1, z0, x1, z1], 'x1']);
    } else {
      const xc = (x0 + x1) / 2;
      let rz0 = Z0, rz1 = Z1;
      if (r.kind === 'hip') { rz0 = Math.min(z0 + half, (z0 + z1) / 2); rz1 = Math.max(z1 - half, (z0 + z1) / 2); }
      const a = V(X0, ye, Z0), b = V(X1, ye, Z0), c = V(X1, ye, Z1), d = V(X0, ye, Z1), r0 = V(xc, r.ridge, rz0), r1 = V(xc, r.ridge, rz1);
      Q(d, r1, r0, a); Q(b, r0, r1, c);
      if (r.kind === 'hip') { T(a, r0, b); T(c, r1, d); } else gables.push([[x0, z0, x1, z0], 'z0'], [[x0, z1, x1, z1], 'z1']);
    }
    // gable-end wall infill triangles (only at listed ends; others are tucked into neighbouring roofs)
    for (const [[gx0, gz0, gx1, gz1], tag] of gables) {
      if (!(r.gableEnds || []).includes(tag)) continue;
      const tri = new THREE.BufferGeometry();
      const mx = (gx0 + gx1) / 2, mz = (gz0 + gz1) / 2;
      const p = [gx0, r.plate, gz0, gx1, r.plate, gz1, mx, r.ridge, mz];
      tri.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); tri.computeVertexNormals();
      const m = new THREE.Mesh(tri, M.extWhiteDouble); m.castShadow = true; m.receiveShadow = true; m.name = 'gable:' + r.id; root.add(m);
    }
  } else if (r.kind === 'shed') {
    const X0 = x0 - e, X1 = x1 + e, Z0 = z0, Z1 = z1 + e;
    const lowY = r.plate, highY = r.high;
    const a = V(X0, highY, Z0), b = V(X1, highY, Z0), c = V(X1, lowY, Z1), d = V(X0, lowY, Z1);
    Q(d, c, b, a);
  } else if (r.kind === 'pyramid') {
    const X0 = x0 - e * 0.6, X1 = x1 + e * 0.6, Z0 = z0 - e * 0.6, Z1 = z1;
    const ap = V((x0 + x1) / 2, r.ridge, (z0 + z1) / 2 + 0.2);
    const a = V(X0, r.plate - 0.1, Z0), b = V(X1, r.plate - 0.1, Z0), c = V(X1, r.plate - 0.1, Z1), d = V(X0, r.plate - 0.1, Z1);
    T(a, ap, b); T(b, ap, c); T(d, ap, a);
  }
  if (!tris.length) return;
  // shingle surface (top) and soffit (underside) as two meshes
  const pos = [], uv = [];
  for (const [i, j, k] of tris) for (const vi of [i, j, k]) { const v = verts[vi]; pos.push(...v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // make every triangle face up, then planar UVs along the slope (u along eave, v up-slope, metres)
  g.computeVertexNormals();
  { const p = g.attributes.position.array.slice(); const p2 = [];
    for (let t = 0; t < p.length / 9; t++) { const a = Array.from(p.slice(t * 9, t * 9 + 9));
      const v1 = new THREE.Vector3(a[3] - a[0], a[4] - a[1], a[5] - a[2]), v2 = new THREE.Vector3(a[6] - a[0], a[7] - a[1], a[8] - a[2]);
      if (v1.cross(v2).y < 0) p2.push(...a.slice(0, 3), ...a.slice(6, 9), ...a.slice(3, 6)); else p2.push(...a); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); g.computeVertexNormals(); }
  { const pp = g.attributes.position, n = g.attributes.normal; const uvs = [];
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), nx = n.getX(i), nz = n.getZ(i);
      const horiz = Math.max(0.2, Math.hypot(nx, nz));
      if (Math.abs(nx) > Math.abs(nz)) uvs.push(z, y / horiz); else uvs.push(x, y / horiz); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); }
  const roof = new THREE.Mesh(g, M.shingles); roof.castShadow = true; roof.receiveShadow = true; roof.name = 'roof:' + r.id; root.add(roof);
  const soffit = new THREE.Mesh(g, M.soffit); soffit.name = 'soffit:' + r.id; soffit.receiveShadow = true; root.add(soffit);
  ctx.phys.trimesh(g);
}
