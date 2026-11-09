// Room/portal visibility culling for walk mode (lead-owned).
//
// How it works
//  - Room graph from plan.js: nodes = ROOMS + 'OUT'. Edges ("portals") = OPENINGS (windows, glazed french
//    doors and sliders always pass; hinged doors pass only while open; garage doors and uncut skylights never),
//    open-plan boundaries (two rooms whose rects touch along a stretch no INT_WALL covers), the foyer's open
//    ceiling (stair void / gallery / upper hall) and the outdoor balcony's sky. Every portal is an AABB that is
//    deliberately a bit bigger than the hole.
//  - Each frame: start rooms = every room whose rect (+0.45 m) holds the camera (both storeys near the floor
//    line); outside the house footprint we start at OUT. Flood through portals whose box intersects the camera
//    frustum (or is within 0.8 m of the camera). No portal narrowing — conservative, never aggressive.
//    Inside the footprint but in no room (stair, chase, odd gap) => no culling that frame.
//  - Objects: a static mesh is "in" a room only if its whole world AABB lies inside that room's rect (+0.06 m)
//    and that storey's height band. Walls, door leaves, window frames, anything spanning two rooms or outdoors
//    is never room-culled. Hidden = layer 0 off (we never touch .visible, so other code's toggles stay intact).
//  - Small objects (bounding radius < 0.35 m) also get a max draw distance 15–25 m by size (1 m hysteresis).
//  - Safety: objects that move after the scan are dropped from culling (checked while hidden); skinned meshes,
//    batched/instanced-with-no-culling meshes, physics dynamics and anything with userData.noCull are skipped.
//  - Late content: rescan() runs ~3 s and ~10 s after start and 0.6 s after any scene.add (debounced).
//    Unscanned objects are simply never culled. window.__cull = { rescan, enabled, stats, showAll }.
//  - Mirrors: when the camera is in a mirror's room the frustum test is dropped (reflections look backwards).
import * as THREE from 'three';
import * as P from './plan.js';

const LAYER_HIDE = 30;
const HIGH = new Set(['foyer', 'family', 'powder']); // ground rooms open above 3.05 (stair void, vaults)
const FLOOR1 = P.LEVELS[1].floor;
const BANDS = { 0: [-0.25, FLOOR1 + 0.02], 1: [FLOOR1 - 0.15, 9.6] };

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function roomsAt(x, z, lv, m) {
  const out = [];
  for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== lv) continue; const [x0, z0, x1, z1] = r.rect;
    if (x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) out.push(id); }
  return out;
}
function bestRoom(x, z, lv) { // smallest room containing the point (+0.45 m)
  let best = null, ba = Infinity;
  for (const id of roomsAt(x, z, lv, 0.45)) { const [x0, z0, x1, z1] = P.ROOMS[id].rect; const a = (x1 - x0) * (z1 - z0); if (a < ba) { ba = a; best = id; } }
  return best;
}

function buildGraph(doorsById) {
  const portals = []; const adj = new Map(); for (const id of [...Object.keys(P.ROOMS), 'OUT']) adj.set(id, []);
  const link = (a, b, box, test = null, name = '') => { if (!a || !b || a === b) return; const p = { a, b, box, test, name }; portals.push(p); adj.get(a).push(p); adj.get(b).push(p); };
  // openings
  for (const o of P.OPENINGS) {
    if (o.type === 'skylight' || o.type === 'garage') continue;
    const lv = o.level, fy = P.LEVELS[lv].floor, [ax, az] = o.at, d = 0.5;
    const side = (x, z) => bestRoom(x, z, lv) || (pointInPoly(x, z, P.EXT[lv]) ? null : 'OUT');
    // which axis is the wall normal: the one whose two sides land in different spaces
    const zA = side(ax, az - d), zB = side(ax, az + d), xA = side(ax - d, az), xB = side(ax + d, az);
    let a, b, hx, hz;
    if (zA !== zB && zA && zB) { a = zA; b = zB; hx = o.w / 2 + 0.1; hz = 0.35; }
    else if (xA !== xB && xA && xB) { a = xA; b = xB; hx = 0.35; hz = o.w / 2 + 0.1; }
    else { // angled bay / unclear: link every space found around it, with a square box
      const s = [...new Set([zA, zB, xA, xB, side(ax + d, az + d), side(ax - d, az - d), side(ax + d, az - d), side(ax - d, az + d)].filter(Boolean))];
      hx = hz = o.w / 2 + 0.4;
      const box = new THREE.Box3(new THREE.Vector3(ax - hx, fy + (o.sill || 0) - 0.1, az - hz), new THREE.Vector3(ax + hx, fy + o.head + 0.1, az + hz));
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) link(s[i], s[j], box, null, o.id);
      continue;
    }
    const box = new THREE.Box3(new THREE.Vector3(ax - hx, fy + (o.sill || 0) - 0.1, az - hz), new THREE.Vector3(ax + hx, fy + o.head + 0.1, az + hz));
    if (a === 'OUT' || b === 'OUT') { box.min.y = fy - 0.2; box.max.y = lv === 0 ? 6.3 : 9.0; box.expandByVector(new THREE.Vector3(0.4, 0, 0.4)); } // unlisted glass in the same wall
    let test = null;
    if (o.type === 'door') { const door = doorsById.get(o.id); test = door ? () => door.open > 0.01 || door.target > 0.01 : null; }
    link(a, b, box, test, o.id);
  }
  // open-plan boundaries: rects touching along a stretch that no interior wall covers
  const ids = Object.keys(P.ROOMS);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = P.ROOMS[ids[i]], B = P.ROOMS[ids[j]]; if (A.level !== B.level) continue;
    const [ax0, az0, ax1, az1] = A.rect, [bx0, bz0, bx1, bz1] = B.rect; const fy = P.LEVELS[A.level].floor;
    const walls = P.INT_WALLS[A.level] || [];
    const tryLine = (axis, c, lo, hi) => { // axis 'x' = line x=c spanning z [lo,hi]
      if (hi - lo < 0.3) return;
      // uncovered pieces of [lo,hi]
      let segs = [[lo, hi]];
      for (const w of walls) {
        const vert = Math.abs(w.a[0] - w.b[0]) < 1e-3, horiz = Math.abs(w.a[1] - w.b[1]) < 1e-3;
        if (axis === 'x' && vert && Math.abs(w.a[0] - c) < 0.25) { const s0 = Math.min(w.a[1], w.b[1]), s1 = Math.max(w.a[1], w.b[1]); segs = segs.flatMap(([u, v]) => [[u, Math.min(v, s0)], [Math.max(u, s1), v]].filter(([p, q]) => q - p > 0.3)); }
        if (axis === 'z' && horiz && Math.abs(w.a[1] - c) < 0.25) { const s0 = Math.min(w.a[0], w.b[0]), s1 = Math.max(w.a[0], w.b[0]); segs = segs.flatMap(([u, v]) => [[u, Math.min(v, s0)], [Math.max(u, s1), v]].filter(([p, q]) => q - p > 0.3)); }
      }
      for (const [u, v] of segs) {
        const box = axis === 'x' ? new THREE.Box3(new THREE.Vector3(c - 0.4, fy - 0.1, u - 0.1), new THREE.Vector3(c + 0.4, fy + 6, v + 0.1))
          : new THREE.Box3(new THREE.Vector3(u - 0.1, fy - 0.1, c - 0.4), new THREE.Vector3(v + 0.1, fy + 6, c + 0.4));
        link(ids[i], ids[j], box, null, 'open:' + ids[i] + '|' + ids[j]);
      }
    };
    if (Math.abs(ax1 - bx0) < 0.35) tryLine('x', (ax1 + bx0) / 2, Math.max(az0, bz0), Math.min(az1, bz1));
    if (Math.abs(bx1 - ax0) < 0.35) tryLine('x', (bx1 + ax0) / 2, Math.max(az0, bz0), Math.min(az1, bz1));
    if (Math.abs(az1 - bz0) < 0.35) tryLine('z', (az1 + bz0) / 2, Math.max(ax0, bx0), Math.min(ax1, bx1));
    if (Math.abs(bz1 - az0) < 0.35) tryLine('z', (bz1 + az0) / 2, Math.max(ax0, bx0), Math.min(ax1, bx1));
  }
  // vertical: ground rooms without a flat ceiling (foyer's stair void / double height) open to any upper room
  // above them; the outdoor balcony opens to the sky
  for (const lo of ['foyer']) {
    const [x0, z0, x1, z1] = P.ROOMS[lo].rect;
    const box = new THREE.Box3(new THREE.Vector3(x0 - 0.2, P.LEVELS[0].ceil - 0.4, z0 - 0.2), new THREE.Vector3(x1 + 0.2, FLOOR1 + 0.3, z1 + 0.2));
    for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== 1) continue; const [u0, w0, u1, w1] = r.rect;
      if (u0 < x1 && u1 > x0 && w0 < z1 && w1 > z0) link(lo, id, box, null, 'void:' + id); }
  }
  for (const [id, r] of Object.entries(P.ROOMS)) if (r.outdoor) { const [x0, z0, x1, z1] = r.rect; link(id, 'OUT', new THREE.Box3(new THREE.Vector3(x0 - 1, P.LEVELS[r.level].floor - 0.5, z0 - 1), new THREE.Vector3(x1 + 1, 12, z1 + 1)), null, 'sky:' + id); }
  return { portals, adj };
}

// footprint occupancy (both storeys, dilated 0.6 m) on a 0.25 m grid: objects whose xz box touches no cell are OUTSIDE
const FP = (() => { const s = 0.25, x0 = -2, z0 = -2, nx = 112, nz = 104, g = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = x0 + (i + 0.5) * s, z = z0 + (j + 0.5) * s; let hit = false;
    for (let dx = -0.6; dx <= 0.6 && !hit; dx += 0.3) for (let dz = -0.6; dz <= 0.6 && !hit; dz += 0.3) hit = pointInPoly(x + dx, z + dz, P.EXT[0]) || pointInPoly(x + dx, z + dz, P.EXT[1]);
    let all = true; for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) all = all && pointInPoly(x + dx, z + dz, P.EXT[0]);
    let all1 = true; for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) all1 = all1 && pointInPoly(x + dx, z + dz, P.EXT[1]);
    g[i * nz + j] = (hit ? 1 : 0) | (all ? 2 : 0) | (all1 ? 4 : 0); }
  return { touches(b) { const i0 = Math.max(0, Math.floor((b.min.x - x0) / s)), i1 = Math.min(nx - 1, Math.floor((b.max.x - x0) / s)), j0 = Math.max(0, Math.floor((b.min.z - z0) / s)), j1 = Math.min(nz - 1, Math.floor((b.max.z - z0) / s));
    if (i0 > i1 || j0 > j1) return false; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (g[i * nz + j] & 1) return true; return false; },
    // does the box reach air outside the ground-floor walls (anything within ~0.3 m of an outer face, or off the grid)?
    outside(b) { const i0 = Math.floor((b.min.x - x0) / s), i1 = Math.floor((b.max.x - x0) / s), j0 = Math.floor((b.min.z - z0) / s), j1 = Math.floor((b.max.z - z0) / s);
      if (i0 < 0 || j0 < 0 || i1 >= nx || j1 >= nz) return true; const need = b.max.y > FLOOR1 - 0.4 ? 6 : 2; // upper storey is smaller: its outer walls face air above ground roofs
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if ((g[i * nz + j] & need) !== need) return true; return false; } };
})();

export function createCuller({ scene, camera, phys = null, doors = [], mirrorRooms = new Set(), onChange = null }) {
  const doorsById = new Map(doors.map(d => [d.o.id, d]));
  const G = buildGraph(doorsById);
  const byRoom = new Map(); // room -> [entry]
  let small = []; let all = []; let late = [];
  const hiddenRoom = new Set(); let lastVisKey = '';
  let enabled = true;
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _bb = new THREE.Box3(), _c = new THREE.Vector3(), _sph = new THREE.Sphere();
  const hide = (e, why) => { if (e.why & why) return; if (!e.why) { e.o.layers.disable(0); e.o.layers.enable(LAYER_HIDE); } e.why |= why; };
  const show = (e, why) => { if (!(e.why & why)) return; e.why &= ~why; if (!e.why) { e.o.layers.enable(0); e.o.layers.disable(LAYER_HIDE); } };
  function showAll() { if (api?.props) for (const t of api.props) if (t.cv === false) { t.cv = true; t.b.setVisibleAt(t.id, true); } for (const e of all) { if (e.why) { e.why = 1; show(e, 1); } } hiddenRoom.clear(); lastVisKey = ''; }

  function eligible(o) {
    if (!o.isMesh || o.isSkinnedMesh || o.isBatchedMesh || o.isReflector) return false;
    if (o.isInstancedMesh && o.frustumCulled === false) return false;
    if (o.userData.noCull || o.userData.dynamic || o.userData.pool) return false;
    if (o.layers.mask !== 1) return false; // something else manages its layers
    for (let p = o.parent; p && p !== scene; p = p.parent) if (p.userData.dynamic || p.userData.noCull || p.isSkinnedMesh || p.isBone) return false;
    return true;
  }
  function rescan() {
    showAll(); byRoom.clear(); small = []; all = []; late = [];
    scene.updateMatrixWorld(true);
    const dyn = new Set(); (phys?.dynamics || []).forEach(d => d.obj.traverse(x => dyn.add(x)));
    const skinnedRoots = new Set(); scene.traverse(o => { if (o.isSkinnedMesh) { let p = o; while (p.parent && p.parent !== scene) p = p.parent; skinnedRoots.add(p); } });
    scene.traverse(o => {
      if (!eligible(o) || dyn.has(o)) return;
      let r = o; while (r.parent && r.parent !== scene) r = r.parent; if (skinnedRoots.has(r)) return;
      if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); _bb.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
      else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); }
      if (_bb.isEmpty()) return;
      const e = { o, why: 0, room: null, far: 0, pos: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), ctr: _bb.getCenter(new THREE.Vector3()), late: !/^(piece:|shell)/.test(r.name || '') && r !== scene };
      // every space whose air this object's box touches: rooms (rect +0.08 m, storey band +0.1 m) and OUT.
      // Hidden only while none of them is visible. Touching no known space (chases, odd gaps) => never culled.
      const sp = [];
      for (const [id, rm] of Object.entries(P.ROOMS)) { const [x0, z0, x1, z1] = rm.rect, m = 0.08;
        const fy = P.LEVELS[rm.level].floor, top = rm.outdoor || HIGH.has(id) ? 99 : rm.level === 0 ? P.LEVELS[0].ceil : 9.6;
        if (_bb.max.x < x0 - m || _bb.min.x > x1 + m || _bb.max.z < z0 - m || _bb.min.z > z1 + m || _bb.max.y < fy - 0.1 || _bb.min.y > top + 0.1) continue;
        sp.push(id); }
      if (FP.outside(_bb) || _bb.max.y > 9.6) sp.push('OUT');
      e.room = sp.length ? (r.name === 'shell' || /^(roof|soffit|fascia|wall|slab|ext)/i.test(o.name || '') ? 'S' : 'D') + sp.join('|') : null;
      const rad = _bb.getBoundingSphere(_sph).radius;
      if (rad < 0.35 && !o.isInstancedMesh) { e.far = 15 + rad * 30; small.push(e); }
      if (rad < 0.06 && o.castShadow && !e.late) o.castShadow = false; // tiny casters: shadow is sub-texel anyway
      if (!e.room && !e.far) return;
      all.push(e); if (e.late) late.push(e); if (e.room) { if (!byRoom.has(e.room)) byRoom.set(e.room, []); byRoom.get(e.room).push(e); }
    });
    lastVisKey = ''; stats.scanned = all.length; stats.roomObjs = [...byRoom.values()].reduce((a, l) => a + l.length, 0); stats.small = small.length;
  }
  const stats = { scanned: 0, roomObjs: 0, small: 0, visibleRooms: 0, start: '' };

  const visible = new Set(), detail = new Set(); const queue = []; const rects = new Map(); const _v4 = new THREE.Vector4();
  // NDC rect of a box; null if any corner is at/behind the camera plane (then the caller keeps the parent rect)
  function projRect(b) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      _v4.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z, 1).applyMatrix4(_pm);
      if (_v4.w < 0.05) return null;
      const x = _v4.x / _v4.w, y = _v4.y / _v4.w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return [Math.max(-1, x0 - 0.01), Math.min(1, x1 + 0.01), Math.max(-1, y0 - 0.01), Math.min(1, y1 + 0.01)];
  }
  function flood(visible, maxOut = 0) {
    visible.clear(); queue.length = 0;
    const p = camera.getWorldPosition(_c);
    const lvs = Math.abs(p.y - FLOOR1) < 0.6 ? [0, 1] : [p.y < FLOOR1 ? 0 : 1];
    for (const lv of lvs) for (const id of roomsAt(p.x, p.z, lv, 0.45)) if (!visible.has(id)) { visible.add(id); queue.push(id); }
    if (!queue.length) {
      const lv = p.y < FLOOR1 ? 0 : 1;
      if (pointInPoly(p.x, p.z, P.EXT[lv]) || pointInPoly(p.x, p.z, P.EXT[0])) return null; // inside but nowhere known: no culling
      visible.add('OUT'); queue.push('OUT');
    }
    let noFrustum = false; for (const id of visible) if (mirrorRooms.has(id)) noFrustum = true;
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    // portal narrowing: each room carries the screen rect (NDC) through which it can be seen; a portal only
    // passes the part of its projected box that lies inside the room's rect. Rects only grow (re-queue on growth).
    rects.clear(); for (const id of visible) rects.set(id, [-1, 1, -1, 1]);
    let guard = 0;
    while (queue.length && guard++ < 4000) {
      const r = queue.shift(); const R = rects.get(r);
      for (const pt of G.adj.get(r) || []) {
        const nb = pt.a === r ? pt.b : pt.a;
        if (pt.test && !pt.test()) continue;
        if (maxOut && r === 'OUT' && pt.box.distanceToPoint(p) > maxOut) continue; // far window seen from outside: structure only
        let q;
        if (noFrustum || pt.box.distanceToPoint(p) < 0.8) q = R.slice();
        else { if (!_fr.intersectsBox(pt.box)) continue; q = projRect(pt.box); if (!q) q = R.slice(); else { q[0] = Math.max(q[0], R[0]); q[1] = Math.min(q[1], R[1]); q[2] = Math.max(q[2], R[2]); q[3] = Math.min(q[3], R[3]); if (q[0] >= q[1] || q[2] >= q[3]) continue; } }
        const old = rects.get(nb);
        if (!old) { rects.set(nb, q); visible.add(nb); queue.push(nb); }
        else if (q[0] < old[0] - 1e-3 || q[1] > old[1] + 1e-3 || q[2] < old[2] - 1e-3 || q[3] > old[3] + 1e-3) { old[0] = Math.min(old[0], q[0]); old[1] = Math.max(old[1], q[1]); old[2] = Math.min(old[2], q[2]); old[3] = Math.max(old[3], q[3]); queue.push(nb); }
      }
    }
    if (guard >= 4000) return null;
    return visible;
  }
  let frame = 0;
  function update() {
    if (!enabled) return;
    frame++;
    const vis = flood(visible);
    // camera outside: furniture/decor of rooms whose window is > FAR_OUT m away is dropped (walls/floors stay)
    const det = vis && vis.has('OUT') && !roomsAt(_c.x, _c.z, _c.y < FLOOR1 ? 0 : 1, 0.45).length ? flood(detail, api.farOut) : vis;
    // room culling: only touch lists whose state changed
    let changed = false;
    for (const [room, list] of byRoom) {
      const S = room.charCodeAt(0) === 83 ? vis : det; // 'S…' = structural (shell), 'D…' = detail
      const want = vis ? !room.slice(1).split('|').some(r => S.has(r)) : false;
      if (want && !hiddenRoom.has(room)) { hiddenRoom.add(room); for (const e of list) hide(e, 1); changed = true; }
      else if (!want && hiddenRoom.has(room)) { hiddenRoom.delete(room); for (const e of list) show(e, 1); changed = true; }
    }
    // small-object draw distance (hysteresis 1 m), every 4th frame
    if (frame % 4 === 0) { const p = _c;
      const k = api.smallScale || 1; for (const e of small) { const d = e.ctr.distanceTo(p), f = e.far * k; if (d > f + 1) hide(e, 2); else if (d < f) show(e, 2); } }
    // anything hidden that has moved since the scan leaves culling for good
    { let moved = false; const full = frame % 60 === 0 || changed;
      for (const e of full ? all : late) {
        if (!e.why) continue;
        const m = e.o.matrixWorld.elements; if (Math.abs(m[12] - e.pos.x) + Math.abs(m[13] - e.pos.y) + Math.abs(m[14] - e.pos.z) > 0.03 || !e.o.parent) { e.why = 1; show(e, 1); e.room = null; e.far = 0; moved = true; }
      }
      if (moved) prune(); }
    // throwable-prop instances (BatchedMesh, perf.js): per instance, by the room its centre is in right now
    if (api.props && (changed || frame % 6 === 0)) for (const t of api.props) {
      const m = t.o.matrixWorld.elements, x = m[12], y = m[13], z = m[14]; let v = true;
      if (det) { const sp = roomsAt(x, z, y < FLOOR1 - 0.1 ? 0 : 1, 0.4); _bb.min.set(x - 0.2, y - 0.2, z - 0.2); _bb.max.set(x + 0.2, y + 0.2, z + 0.2);
        if (FP.outside(_bb)) sp.push('OUT'); if (y < FLOOR1 + 0.3 && y > P.LEVELS[0].ceil - 0.3) sp.push(...roomsAt(x, z, 1, 0.4), ...roomsAt(x, z, 0, 0.4));
        v = !sp.length || sp.some(r => det.has(r)); }
      if (t.cv !== v) { t.cv = v; t.b.setVisibleAt(t.id, v); }
    }
    stats.visibleRooms = vis ? vis.size : -1;
    if (changed) { const key = vis ? [...vis].sort().join(',') + '/' + [...det].sort().join(',') : 'all'; if (key !== lastVisKey) { lastVisKey = key; onChange?.(); } }
  }
  // drop moved entries from their lists lazily
  const prune = () => { for (const [k, l] of byRoom) byRoom.set(k, l.filter(e => e.room === k)); small = small.filter(e => e.far); all = all.filter(e => e.room || e.far); late = late.filter(e => e.room || e.far); };

  // late content: rescan after start and after scene.add (debounced)
  let timer = 0; const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => { rescan(); }, ms); };
  const add0 = scene.add.bind(scene); scene.add = (...objs) => { const r = add0(...objs); if (api.auto) later(600); return r; };
  setTimeout(() => rescan(), 3000); setTimeout(() => rescan(), 10000);
  const api = {
    auto: true, farOut: 14, update, rescan, showAll, stats, graph: G,
    get enabled() { return enabled; }, set enabled(v) { enabled = !!v; if (!enabled) showAll(); },
    // run fn with nothing culled (probe capture, path tracer)
    without(fn) { const was = enabled; enabled = false; showAll(); try { return fn(); } finally { enabled = was; } },
    visibleRooms: () => [...visible],
  };
  rescan();
  return api;
}
