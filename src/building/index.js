// The house itself, interactive and destructible (src/building, 2026-11-08). Started from multiplayer.js
// (`api.building = startBuilding(ctx, api)`; ?building=0 turns it off for perf A/B).
//
// What it does
//  - Windows open/close: every window / slider in plan.js OPENINGS is operable (look at it, "E::OPEN WINDOW").
//    Narrow windows (w <= 0.95) swing out as casements, mid-size ones slide (one sash over the other), wide ones tilt
//    out as awnings; sliders stack their panels; garage doors swing up-and-over ("E::OPEN GARAGE"). Doors (interior,
//    french) get "E::OPEN DOOR"/"E::CLOSE DOOR" prompts on top of main.js's auto-open (closing with E sets
//    door.noAuto until you walk 2.5 m away). While a window is CLOSED it costs nothing: it is the merged shell
//    geometry. Opening it degenerates its triangles in the merged meshes (carve.js; shell.js tags them with a uv1 code)
//    and shows a small model of its own (1 frame + 2 per sash draw calls) until it is closed again.
//  - Glass: every window, slider and french door is a 'glass' entity in ctx.damage (area = one pane). Partial damage
//    draws crack webs, a break hides the glass, removes its collider (the opening is passable / open to the weather),
//    and throws Voronoi shards + glitter + a glass sound (src/smash fx/sound when present).
//  - Walls: shell.js splits every wall into ~1.2 m panels (own collider each). Interior panels are 'drywall', exterior
//    'siding' (hp area capped at 1.5 m² for drywall: "a few heavy hits"). A break hides the panel in the merged walls,
//    adds a jagged-hole mesh with gypsum/insulation edges and splintered studs, spawns debris, removes the collider.
//    Support: a panel that had wall below it falls when nothing below holds it any more (full panels can bridge a
//    one-panel hole if both neighbours stand; headers hang from either neighbour). Falling chunks topple + drop
//    (scripted, max 8 at once), then shatter into pooled debris. Collapses are derived on every client from the
//    synced breaks (damage.js syncs hp/breaks), so no extra traffic.
//  - Garage doors are 'metal' entities (a car can smash them). Concrete is never registered here (only huge forces).
//  - Car crumple: big car impacts (phys.onImpact, owner {kind:'car'}) dent that car's body meshes locally (per-car
//    geometry copies, vertices near the impact pushed inward, clamped); dents are sent on 'bldg' by the driver (host if
//    nobody drives) and replayed to late joiners.
//  - Repair: window.__building.repair() (host -> damage.repairAll(), synced), and auto-repair 10 min after the last break.
//  Network: channel 'bldg' — {k:'op', id, t} open targets, {k:'dent', ...}, late joiners get {k:'all', ops, dents}.
//
// window.__building (for the "cold + weather blowing in" builder and tests):
//   openings: Map(id -> { id, type, open 0..1 (live), broken (glass gone), area m², room (plan.js room id or null),
//             normal [x,0,z] (pointing OUT of the room / house), pos [x,y,z] (centre of the opening) })
//   isOpen(id) -> true when air can pass (open > 0.05 or glass broken; doorways always)
//   holes: [{ id, room, pos [x,y,z], area m², normal }] wall panels currently broken/collapsed (also air paths)
//   setOpen(id, 0|1), toggle(id), repair(), panels, ops, stats()
import * as THREE from 'three';
import * as P from '../plan.js';
import { M } from '../kit/materials.js';
import { createCarver } from './carve.js';
import { brokenPanel, chunkMesh, panelMatrix, hashSeed } from './broken.js';

const COLOR = { glass: 0xdff2f7, drywall: 0xe8e4da, siding: 0xeeeeea, metal: 0x8c8f92, wood: 0xa98257 };
const SND = { glass: 'glass', drywall: 'drywall', siding: 'siding', metal: 'metal', wood: 'wood' };
const MAX_FALLING = 8, AUTO_REPAIR_MS = 10 * 60 * 1000;

export function startBuilding(ctx, api) {
  const { phys, scene, damage, interact, shell } = ctx; if (!shell?.panels || !damage) return null;
  const R = phys.RAPIER, world = phys.world;
  const ch = api?.channel ? api.channel('bldg') : { send() {}, onMessage: null };
  const selfId = () => api?.net?.selfId || api?.selfId || 'local';
  const carver = createCarver(shell.root);
  const root = new THREE.Group(); root.name = 'building'; root.userData.keep = true; scene.add(root);
  const fx = () => window.__smash?.fx || null, snd = () => window.__smash?.sound || null;
  const poke = () => { try { ctx.shadows?.poke?.(); } catch {} };
  const now = () => performance.now();
  let lastBreak = 0;
  const queue = []; const later = (fn) => (...a) => { queue.push(() => fn(...a)); }; // never touch Rapier inside its event drain
  const log = []; damage.onBreak((e, info) => { if (log.length < 100) log.push({ id: e.id, t: Math.round(now()), src: info.source?.kind || null, by: info.by || null, remote: !!info.remote, point: !!info.point }); });
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const Y = new THREE.Vector3(0, 1, 0);

  function roomAt(x, z, level) { let best = null, ba = Infinity; for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== level) continue; const [x0, z0, x1, z1] = r.rect; if (x > x0 - 0.05 && x < x1 + 0.05 && z > z0 - 0.05 && z < z1 + 0.05) { const a = (x1 - x0) * (z1 - z0); if (a < ba) { ba = a; best = id; } } } return best; }
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  function groundBelow(x, z, fromY) { ray.origin.x = x; ray.origin.y = fromY; ray.origin.z = z; const h = world.castRay(ray, 20, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC); return h ? fromY - (h.timeOfImpact ?? h.toi) : fromY - 3; }

  // ------------------------------------------------------------------ debris helpers
  function boxCloud(corners) { const a = new Float32Array(corners.length * 3); corners.forEach((c, i) => { a[i * 3] = c.x; a[i * 3 + 1] = c.y; a[i * 3 + 2] = c.z; }); return a; }
  function shatter(cloud, kind, impact, dir, { count = 10, power = 1.5, mass = 20 } = {}) {
    const F = fx(); if (!F) return 0; let cells = [];
    try { cells = F.fracture(cloud, { count, impact, stretchAxis: kind === 'wood' ? 0 : null, stretch: kind === 'wood' ? 3 : 1 }); } catch (e) { console.warn('[building] fracture', e); }
    const color = new THREE.Color(COLOR[kind] || 0xcccccc);
    let made = 0; try { made = cells.length ? F.spawn(cells, { color, glass: kind === 'glass', mass, impact, dir, power, life: kind === 'glass' ? [6, 12] : [10, 20] }) : 0; } catch (e) { console.warn('[building] debris spawn failed (' + kind + ')', e.message); }
    const floorY = groundBelow(impact.x, impact.z, impact.y + 0.2);
    if (kind === 'glass') F.glitter(impact, 110, { speed: power * 1.2, floorY });
    F.sparks(impact, kind === 'glass' ? 50 : 70, { color: kind === 'glass' ? 0xffffff : COLOR[kind] || 0xdddddd, speed: power * 1.5, floorY, size: kind === 'glass' ? 0.7 : 1.3 });
    return made;
  }
  function sound(kind, p, vol = 1, rate = 1) { try { snd()?.play(SND[kind] || 'thud', p, vol, rate); } catch {} }

  // ------------------------------------------------------------------ openings
  const ops = new Map();        // operable windows / sliders / garage doors
  const openings = new Map();   // public records (window.__building.openings)
  const glassOf = new Map();    // opening id -> glass state
  const fr = 0.045, fd = 0.07;
  const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  function mergeBoxes(list) { const parts = list.map(g => g.toNonIndexed()); const out = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'uv']) { const s = parts[0].attributes[n].itemSize; const arr = new Float32Array(parts.reduce((a, g) => a + g.attributes[n].array.length, 0)); let o = 0; for (const g of parts) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; } out.setAttribute(n, new THREE.BufferAttribute(arr, s)); } return out; }
  function sash(pw, ph, cols, rows) { // origin bottom-left, glazing at z=0
    const bars = [boxG(pw, fr, fd, pw / 2, fr / 2, 0), boxG(pw, fr, fd, pw / 2, ph - fr / 2, 0), boxG(fr, ph, fd, fr / 2, ph / 2, 0), boxG(fr, ph, fd, pw - fr / 2, ph / 2, 0)];
    for (let c = 1; c < cols; c++) bars.push(boxG(fr * 0.6, ph, fd * 0.8, (pw * c) / cols, ph / 2, 0));
    for (let r = 1; r < rows; r++) bars.push(boxG(pw, fr * 0.6, fd * 0.8, pw / 2, (ph * r) / rows, 0));
    const g = new THREE.Group(); const b = new THREE.Mesh(mergeBoxes(bars), M.blackMetal); b.castShadow = true; b.receiveShadow = true; g.add(b);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(pw - fr, ph - fr).translate(pw / 2, ph / 2, 0), M.glass); gl.renderOrder = 2; gl.name = 'glass'; g.add(gl); g.userData.glass = gl;
    return g;
  }
  function worldOf(meta, x, y, z, out = new THREE.Vector3()) { meta.g.updateWorldMatrix(true, false); return out.set(x, y, z).applyMatrix4(meta.g.matrixWorld); }

  function buildModel(op) {
    const { meta } = op; const o = meta.o; const w = meta.p0.distanceTo(meta.p1), h = meta.y1 - meta.y0, z = meta.zSet ?? 0.1; const [cols, rows] = o.panes || [1, 1];
    const g = new THREE.Group(); g.name = 'building:win:' + o.id; g.userData.keep = true; meta.g.add(g);
    op.sashes = [];
    if (op.kind === 'slider') {
      const n = Math.max(2, cols), pw = w / n;
      for (let i = 0; i < n; i++) { const s = sash(pw + fr, h, 1, 1); s.position.set(i * pw, 0, z + (i % 2) * 0.06); g.add(s); op.sashes.push({ s, i, pw, n }); }
    } else {
      const frame = new THREE.Mesh(mergeBoxes([boxG(w, fr, fd, w / 2, fr / 2, z), boxG(w, fr, fd, w / 2, h - fr / 2, z), boxG(fr, h, fd, fr / 2, h / 2, z), boxG(fr, h, fd, w - fr / 2, h / 2, z)]), M.blackMetal); frame.castShadow = true; g.add(frame);
      const iw = w - 2 * fr, ih = h - 2 * fr;
      if (op.kind === 'casement') { const hinge = new THREE.Group(); hinge.position.set(fr, fr, z); const s = sash(iw, ih, cols, rows); hinge.add(s); g.add(hinge); op.sashes.push({ s: hinge }); }
      else if (op.kind === 'awning') { const hinge = new THREE.Group(); hinge.position.set(fr, h - fr, z); const s = sash(iw, ih, cols, rows); s.position.y = -ih; hinge.add(s); g.add(hinge); op.sashes.push({ s: hinge }); }
      else { const half = iw / 2 + fr / 2; const a = sash(half, ih, Math.max(1, Math.round(cols / 2)), rows); a.position.set(fr, fr, z + 0.012); const b = sash(half, ih, Math.max(1, Math.round(cols / 2)), rows); b.position.set(fr + iw - half, fr, z - 0.04); g.add(a, b); op.sashes.push({ s: b, x0: fr + iw - half, x1: fr + 0.03 }); }
    }
    g.traverse(m => { m.userData.noCull = true; });
    op.model = g; setPose(op);
  }
  function setPose(op) {
    if (op.kind === 'garage') { // up-and-over: pivot at the head, top edge runs in along the ceiling
      const pg = op.meta.panel; if (!pg) return; const h = op.meta.y1 - op.meta.y0, z = (op.meta.zSet ?? 0.1) + 0.05; const a = op.open * Math.PI / 2;
      pg.rotation.x = -a; const c = Math.cos(-a), s = Math.sin(-a); // p' = pivot + Rx(p - pivot), with pivot (0,h,z)
      pg.position.set(0, h - (h * c - z * s) + 0.0, z - (h * s + z * c) + op.open * h * 0.5); pg.position.y += 0; return;
    }
    if (!op.model) return; const t = op.open;
    if (op.kind === 'slider') { for (const { s, i, pw, n } of op.sashes) { const w = pw * n; const stackX = (w - pw - 0.02) - i * 0.02; s.position.x = THREE.MathUtils.lerp(i * pw, stackX, t); } return; }
    const S = op.sashes[0];
    if (op.kind === 'casement') S.s.rotation.y = t * 1.25;
    else if (op.kind === 'awning') S.s.rotation.x = t * 0.6;
    else S.s.position.x = THREE.MathUtils.lerp(S.x0, S.x1, t);
  }
  function showModel(op, on) {
    if (op.kind === 'garage') return;
    if (on) { if (!op.carved) { carver.hide(op.meta.code); carver.hide(op.meta.code + 1); op.carved = true; poke(); } if (!op.model) buildModel(op); op.model.visible = true; }
    else { if (op.carved) { carver.show(op.meta.code); if (!glassOf.get(op.id)?.broken) carver.show(op.meta.code + 1); op.carved = false; poke(); } if (op.model) op.model.visible = false; }
    if (op.model) for (const sh of op.sashes) sh.s.traverse(m => { if (m.name === 'glass') m.visible = !glassOf.get(op.id)?.broken; });
  }
  function dropCollider(op) { for (const c of op.meta.colliders) phys.remove(c); op.meta.colliders.length = 0; }
  function restoreCollider(op) {
    if (op.meta.colliders.length || !op.meta.makeCollider) return; if (op.kind !== 'garage' && glassOf.get(op.id)?.broken) return; if (op.broken) return;
    const c = op.meta.makeCollider(); if (!c) return; op.meta.colliders.push(c);
    const gs = glassOf.get(op.id); if (gs && !gs.broken) damage.attach(gs.eid, c); if (op.eid) damage.attach(op.eid, c);
  }
  function setTarget(op, t, send = true) {
    t = t > 0.5 ? 1 : 0; if (op.target === t) return; op.target = t;
    if (t > 0.5) { dropCollider(op); if (op.kind !== 'garage') showModel(op, true); }
    if (send) ch.send({ k: 'op', id: op.id, t });
  }

  for (const meta of shell.openings || []) {
    const o = meta.o; const w = meta.p0.distanceTo(meta.p1), h = meta.y1 - meta.y0;
    const mid = new THREE.Vector3(); worldOf(meta, w / 2, h / 2, meta.interior ? meta.depth / 2 : 0.15, mid);
    const Nw = new THREE.Vector3(meta.N.x, 0, meta.N.y);
    // outward normal: exterior openings -> -N; interior ones: towards the side that is not this room (best effort)
    const inside = mid.clone().addScaledVector(Nw, 0.6); const room = roomAt(inside.x, inside.z, o.level) || roomAt(mid.x - Nw.x * 0.6, mid.z - Nw.z * 0.6, o.level);
    const normal = [-Nw.x, 0, -Nw.z].map(v => +v.toFixed(3));
    const [cols, rows] = o.panes || [1, 1];
    const rec = { id: o.id, type: o.type, open: 0, broken: false, area: +(w * h).toFixed(2), room, normal, pos: mid.toArray().map(v => +v.toFixed(2)) };
    openings.set(o.id, rec);
    let op = null;
    if (o.type === 'window' || o.type === 'slider' || o.type === 'garage') {
      const kind = o.type === 'slider' ? 'slider' : o.type === 'garage' ? 'garage' : w <= 0.95 ? 'casement' : w <= 1.7 ? 'slide' : 'awning';
      const init = o.type === 'slider' ? (o.open ?? 0) : 0;
      op = { id: o.id, meta, kind, open: init, target: init, model: null, carved: false, sashes: [] };
      ops.set(o.id, op);
      if (init > 0) showModel(op, true);
      Object.defineProperty(rec, 'open', { get: () => +op.open.toFixed(3), enumerable: true });
      const label = kind === 'garage' ? 'GARAGE' : kind === 'slider' ? 'SLIDING DOOR' : 'WINDOW';
      // wide sliding doors (the 7 m dining wall): look anywhere along them, from either end
      const big = kind === 'slider';
      interact?.add({ id: 'bldg:' + o.id, pos: mid, radius: big ? Math.min(3.2, w * 0.46) : Math.min(0.75, Math.max(0.35, w * 0.4)), range: kind === 'garage' ? 3.6 : big ? w / 2 + 2.2 : 2.6,
        label: () => (op.target > 0.5 ? 'CLOSE ' : 'OPEN ') + label, use: () => setTarget(op, op.target > 0.5 ? 0 : 1) });
      if (kind === 'garage') { // metal door: a car at speed can tear it out
        const eid = 'garage:' + o.id; op.eid = eid;
        damage.add({ id: eid, colliders: meta.colliders.slice(), material: 'metal', area: w * h * 0.25,
          onBreak: later((e, info) => { op.broken = true; dropCollider(op); if (meta.panel) meta.panel.visible = false; rec.broken = true; lastBreak = now(); poke();
            if (!(info.remote && !info.point)) { const c = []; for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) for (const zz of [0.1, 0.18]) c.push(worldOf(meta, x, y, zz)); shatter(boxCloud(c), 'metal', info.point || mid, info.dir, { count: 8, power: 2, mass: 120 }); sound('metal', mid, 1.3, 0.8); } }),
          onRepair: () => { op.broken = false; rec.broken = false; if (meta.panel) meta.panel.visible = true; if (op.target < 0.5) restoreCollider(op); poke(); } });
      }
    }
    // glass entity (windows, sliders, french doors)
    if (o.type === 'window' || o.type === 'slider' || o.type === 'french') {
      const eid = 'glass:' + o.id; const gs = { eid, broken: false }; glassOf.set(o.id, gs);
      Object.defineProperty(rec, 'broken', { get: () => gs.broken, enumerable: true });
      const paneArea = Math.max(0.25, (w * h) / Math.max(1, cols * rows));
      const cols0 = o.type === 'french' ? (meta.door?.collider ? [meta.door.collider] : []) : meta.colliders.slice();
      gs.attached = cols0[0] || null;
      const corners = () => { const c = []; for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) for (const zz of [-0.016, 0.016]) c.push(worldOf(meta, x, y, (meta.zSet ?? meta.depth / 2) + zz)); return c; };
      damage.add({ id: eid, colliders: cols0, material: 'glass', area: paneArea,
        onDamage: (e, dmg, info) => { if (e.hp <= 0) return; const p = info.point || mid; fx()?.crack(eid, p, Nw, Math.min(0.5, Math.min(w, h) * 0.45), 1 - e.hp / e.maxHp); sound('glass', p, 0.25, 1.6); },
        onBreak: later((e, info) => {
          gs.broken = true; lastBreak = now(); fx()?.clearCracks(eid);
          if (op) { carver.hide(meta.code + 1); showModel(op, op.carved); dropCollider(op); }
          if (meta.door) { const d = meta.door; d.g.traverse(m => { if (m.name === 'glass') m.visible = false; }); gs.closedCollider = d.closedCollider; d.closedCollider = () => null; if (d.collider) { phys.remove(d.collider); d.collider = null; } }
          if (o.type === 'slider') carver.hide(meta.code + 1);
          poke();
          if (info.remote && !info.point) return; // late-join state: just gone
          const imp = info.point ? new THREE.Vector3(info.point.x, info.point.y, info.point.z) : mid.clone();
          shatter(boxCloud(corners()), 'glass', imp, info.dir, { count: Math.min(18, 8 + Math.round(w * h * 3)), power: 1.6, mass: w * h * 10 });
          sound('glass', imp, 1.3, 1);
        }),
        onRepair: () => {
          gs.broken = false; fx()?.clearCracks(eid);
          if (op) { if (!op.carved) carver.show(meta.code + 1); showModel(op, op.carved); if (op.target < 0.5 && op.open < 0.02) restoreCollider(op); }
          else carver.show(meta.code + 1);
          if (meta.door) { const d = meta.door; d.g.traverse(m => { if (m.name === 'glass') m.visible = true; }); if (gs.closedCollider) d.closedCollider = gs.closedCollider; if (d.open < 0.5 && !d.collider) d.collider = d.closedCollider(); }
          poke();
        } });
      gs.e = damage.get(eid);
    }
    // door prompts (doors are animated + synced by main.js / multiplayer.js)
    if (meta.door) {
      const d = meta.door; Object.defineProperty(rec, 'open', { get: () => +d.open.toFixed(3), enumerable: true });
      interact?.add({ id: 'bldg:door:' + o.id, pos: d.world, radius: 0.45, range: 2.4, label: () => (d.target > 0.5 ? 'CLOSE DOOR' : 'OPEN DOOR'),
        use: () => { if (d.target > 0.5) { d.target = 0; d.pendingClose = true; d.noAuto = true; } else { d.target = 1; d.noAuto = false; if (d.collider) { phys.remove(d.collider); d.collider = null; } d.pendingClose = false; } } });
    }
  }
  // doorways: always open (for the weather builder)
  for (const o of P.OPENINGS) if (o.type === 'doorway' && !openings.has(o.id)) openings.set(o.id, { id: o.id, type: 'doorway', open: 1, broken: false, area: +(o.w * (o.head - o.sill)).toFixed(2), room: null, normal: null, pos: [o.at[0], P.LEVELS[o.level].floor + (o.head) / 2, o.at[1]] });

  // ------------------------------------------------------------------ wall panels
  const panels = shell.panels; const byId = new Map(panels.map(p => [p.id, p]));
  const holes = [];
  for (const p of panels) {
    p.L = p.p0.distanceTo(p.p1); p.kind = p.ext ? 'siding' : 'drywall'; p.broken = false;
    const c = p.p0.clone().addScaledVector(p.U, p.L / 2).addScaledVector(p.N, p.depth / 2); p.center = new THREE.Vector3(c.x, (p.y0 + p.y1) / 2, c.y);
  }
  // support graph
  for (const p of panels) {
    p.below = []; p.sides = [];
    for (const q of panels) {
      if (q === p) continue;
      // same wall line? (q's centre line within 0.25 m of p's, overlapping along p.U)
      const dx = q.center.x - p.center.x, dz = q.center.z - p.center.z; const perp = Math.abs(dx * p.N.x + dz * p.N.y); if (perp > 0.25) continue;
      const qa = (q.center.x - p.p0.x) * p.U.x + (q.center.z - p.p0.y) * p.U.y; const half = q.L / 2;
      const ov = Math.min(p.s1 - p.s0 + 0, (qa + half)) - Math.max(0, qa - half); // overlap along p (p spans 0..L in its own coords)
      const ovp = Math.min(p.L, qa + half) - Math.max(0, qa - half);
      if (Math.abs(q.y1 - p.y0) < 0.36 && ovp > 0.08 && Math.abs(p.U.x * q.U.x + p.U.y * q.U.y) > 0.9) p.below.push(q);
      else if (q.wallKey === p.wallKey && q.level === p.level && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 0.2 && (Math.abs(q.s1 - p.s0) < 0.02 || Math.abs(q.s0 - p.s1) < 0.02)) p.sides.push(q);
      void ov;
    }
    p.grounded = !p.header && p.below.length === 0;
  }
  const sorted = panels.slice().sort((a, b) => a.y0 - b.y0);
  function supported() {
    const S = new Set();
    for (let it = 0; it < 3; it++) for (const p of sorted) {
      if (p.broken || S.has(p)) continue;
      if (p.grounded || p.below.some(q => S.has(q))) { S.add(p); continue; }
      const sides = p.sides.filter(q => S.has(q));
      if (p.header ? sides.length >= 1 : sides.length >= 2 && sides.every(q => q.grounded || q.below.some(b => S.has(b)))) S.add(p);
    }
    return S;
  }
  let checkAt = 0;
  const falling = [];
  function panelCorners(p) { const out = []; for (const u of [0, p.L]) for (const d of [0, p.depth]) for (const y of [p.y0, p.y1]) { const q = p.p0.clone().addScaledVector(p.U, u).addScaledVector(p.N, d); out.push(new THREE.Vector3(q.x, y, q.y)); } return out; }
  function hideAndHole(p, withFrame) {
    carver.hide(p.code); if (p.collider) { phys.remove(p.collider); p.collider = null; }
    if (withFrame && !p.hole) { const g = brokenPanel(p, p.kind, hashSeed(p.id)); if (g) { root.add(g); p.hole = g; } }
    holes.push({ id: p.id, room: roomAt(p.center.x + p.N.x * (p.depth / 2 + 0.3), p.center.z + p.N.y * (p.depth / 2 + 0.3), p.level), pos: p.center.toArray().map(v => +v.toFixed(2)), area: +(p.L * (p.y1 - p.y0)).toFixed(2), normal: [-p.N.x, 0, -p.N.y] });
    poke();
  }
  function breakPanel(p, info = {}) {
    if (p.broken) return; p.broken = true; lastBreak = now();
    hideAndHole(p, true); fx()?.clearCracks(p.id);
    if (!(info.remote && !info.point)) {
      const imp = info.point ? new THREE.Vector3(info.point.x, info.point.y, info.point.z) : p.center.clone();
      // debris only from the torn-out part (inset box)
      const c = panelCorners(p); const ctr = p.center; for (const v of c) v.lerp(ctr, 0.18);
      shatter(boxCloud(c), p.kind, imp, info.dir, { count: Math.min(16, 8 + Math.round(p.L * 3)), power: info.source?.kind === 'car' ? 4 : 2.2, mass: p.L * (p.y1 - p.y0) * (p.kind === 'drywall' ? 25 : 60) });
      sound(p.kind, imp, 1.4, 0.8);
    }
    checkAt = now() + 250;
  }
  function collapse(p) {
    const e = damage.get(p.id); if (e) { e.hp = 0; e.broken = true; }
    p.broken = true; p.collapsed = true; hideAndHole(p, false); fx()?.clearCracks(p.id);
    if (falling.length >= MAX_FALLING) { shatter(boxCloud(panelCorners(p)), p.kind, p.center, null, { count: 8, power: 1.2, mass: 80 }); return; }
    const mesh = chunkMesh(p); const U3 = new THREE.Vector3(p.U.x, 0, p.U.y), N3 = new THREE.Vector3(p.N.x, 0, p.N.y);
    const Z = new THREE.Vector3().crossVectors(U3, Y); if (Z.dot(N3) < 0) { const mm = mesh.material; mesh.material = [mm[1], mm[0], mm[2]]; }
    _m.makeBasis(U3, Y, Z); mesh.quaternion.setFromRotationMatrix(_m); mesh.position.copy(p.center); root.add(mesh);
    // topple outward for exterior walls, else away from whichever side is lower (seeded)
    const side = p.ext ? -1 : ((hashSeed(p.id) & 1) ? 1 : -1); const dir = N3.clone().multiplyScalar(side);
    const H = p.y1 - p.y0; const pivot = p.center.clone().addScaledVector(Y, -H / 2).addScaledVector(dir, p.depth / 2);
    const ground = groundBelow(p.center.x + dir.x * H * 0.6, p.center.z + dir.z * H * 0.6, p.y0 - 0.45);
    falling.push({ p, mesh, dir, axis: new THREE.Vector3().crossVectors(Y, dir).normalize(), pivot, q0: mesh.quaternion.clone(), off: p.center.clone().sub(pivot), theta: 0.02, w: 0.3, drop: 0, vy: 0, ground, t: 0, H });
    sound(p.kind, p.center, 1.2, 0.6);
  }
  function updateFalling(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i]; f.t += dt;
      f.w += (3 * 9.81 / (2 * f.H)) * Math.sin(f.theta) * dt; f.theta = Math.min(Math.PI / 2, f.theta + f.w * dt);
      const pivY = f.pivot.y - f.drop; if (pivY > f.ground + 0.01) { f.vy += 9.81 * dt; f.drop = Math.min(f.pivot.y - f.ground, f.drop + f.vy * dt); }
      _q.setFromAxisAngle(f.axis, f.theta); _v.copy(f.off).applyQuaternion(_q);
      f.mesh.position.copy(f.pivot).add(_v); f.mesh.position.y -= f.drop; f.mesh.quaternion.copy(_q).multiply(f.q0);
      // landed: lowest corner at the ground
      f.mesh.updateMatrixWorld(); const bb = new THREE.Box3().setFromObject(f.mesh);
      if (bb.min.y <= f.ground + 0.02 && (f.theta > 1.2 || f.t > 0.4) || f.t > 4) {
        const geo = f.mesh.geometry; const pos = geo.attributes.position; const pts = []; for (let k = 0; k < pos.count; k++) pts.push(_w.fromBufferAttribute(pos, k).applyMatrix4(f.mesh.matrixWorld).clone());
        const ctr = bb.getCenter(new THREE.Vector3()); const imp = new THREE.Vector3(ctr.x, bb.min.y + 0.1, ctr.z);
        shatter(boxCloud(pts), f.p.kind, imp, { x: 0, y: -1, z: 0 }, { count: 14, power: 1.6, mass: f.p.L * f.H * 60 });
        sound(f.p.kind, imp, 1.5, 0.55);
        root.remove(f.mesh); geo.dispose(); falling.splice(i, 1); poke();
      }
    }
  }
  function checkSupport() {
    const S = supported(); const out = [];
    for (const p of panels) if (!p.broken && !S.has(p)) out.push(p);
    for (const p of out) collapse(p);
    if (out.length) checkAt = now() + 300; // cascade upwards
  }
  function repairPanel(p) {
    if (!p.broken) return; p.broken = false; p.collapsed = false; carver.show(p.code); fx()?.clearCracks(p.id);
    if (p.hole) { root.remove(p.hole); p.hole.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); p.hole = null; }
    if (!p.collider) { p.collider = p.makeCollider(); if (p.collider) damage.attach(p.id, p.collider); }
    const i = holes.findIndex(h => h.id === p.id); if (i >= 0) holes.splice(i, 1); poke();
  }
  for (const p of panels) {
    const area = p.L * (p.y1 - p.y0); const m = damage.MATERIALS[p.kind];
    damage.add({ id: p.id, colliders: p.collider ? [p.collider] : [], material: p.kind, area, hp: p.kind === 'drywall' ? m.hp * Math.min(area, 1.5) : undefined,
      onDamage: (e, dmg, info) => { if (e.hp <= 0 || !info.point) return; const pt = info.point; const side = ((pt.x - p.center.x) * p.N.x + (pt.z - p.center.z) * p.N.y) < 0 ? -1 : 1;
        const fp = new THREE.Vector3(pt.x, pt.y, pt.z); const n = new THREE.Vector3(p.N.x * side, 0, p.N.y * side);
        // put the web on the wall face the hit came from
        const d = (fp.x - p.center.x) * p.N.x + (fp.z - p.center.z) * p.N.y; fp.x += p.N.x * (side * p.depth / 2 - d); fp.z += p.N.y * (side * p.depth / 2 - d);
        fx()?.crack(p.id, fp, n, 0.25 + 0.4 * (1 - e.hp / e.maxHp), 1 - e.hp / e.maxHp); fx()?.sparks(fp, 14, { color: COLOR[p.kind], speed: 1.2, floorY: p.y0 + 0.01 }); sound(p.kind, fp, 0.5, 1.2); },
      onBreak: later((e, info) => breakPanel(p, info)),
      onRepair: () => repairPanel(p) });
  }

  // load grace: props/debris settle with big unowned contact forces in the first seconds (seen ~10-13 s after load,
  // walls and props both broke). Mute contact-force events on the house colliders for 25 s, then restore.
  { const muted = []; for (const e of damage.entries.values()) if (/^(wall|glass|garage):/.test(e.id)) { muted.push([e, e.min]); e.min = Infinity; }
    setTimeout(() => { for (const [e, m] of muted) e.min = m; }, 25000); }

  // ------------------------------------------------------------------ car crumple
  const dents = []; const lastDent = new Map();
  function carById(id) { return window.__cars?.cars?.find(c => c && c.def.name === id) || null; }
  function applyDent(carId, lp, ld, amount) {
    const car = carById(carId); if (!car) return false; const G = car.vis.group; G.updateMatrixWorld(true);
    const ginv = new THREE.Matrix4().copy(G.matrixWorld).invert(); const P0 = new THREE.Vector3(...lp), D = new THREE.Vector3(...ld).normalize(); const r = 0.55 + amount * 1.5;
    const wheelMeshes = new Set(); for (const wh of car.vis.wheels || []) (wh.obj || wh.mesh || wh.group)?.traverse?.(m => wheelMeshes.add(m));
    G.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || wheelMeshes.has(m) || m.material?.transparent && m.material.opacity < 0.2) return;
      const pos = m.geometry?.attributes?.position; if (!pos || pos.count > 200000) return;
      const toG = new THREE.Matrix4().multiplyMatrices(ginv, m.matrixWorld), toM = new THREE.Matrix4().copy(toG).invert();
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox.clone().applyMatrix4(toG); if (bb.distanceToPoint(P0) > r) return;
      if (!m.userData.dentOwn) { m.geometry = m.geometry.clone(); m.userData.dentOwn = true; }
      const pa = m.geometry.attributes.position; let moved = 0;
      for (let i = 0; i < pa.count; i++) { _v.fromBufferAttribute(pa, i).applyMatrix4(toG); const d = _v.distanceTo(P0); if (d > r) continue; const k = (1 - d / r) ** 2 * amount; _v.addScaledVector(D, k); _v.y += (Math.random() - 0.5) * k * 0.15; _v.applyMatrix4(toM); pa.setXYZ(i, _v.x, _v.y, _v.z); moved++; }
      if (moved) { pa.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
    });
    dents.push({ car: carId, p: lp, d: ld, a: amount }); if (dents.length > 200) dents.shift(); return true;
  }
  function dentFromImpact(car, impulse, info) {
    const t = lastDent.get(car.def.name) || 0; if (now() - t < 350) return; lastDent.set(car.def.name, now());
    const G = car.vis.group; G.updateMatrixWorld(true); const ginv = new THREE.Matrix4().copy(G.matrixWorld).invert();
    // impact direction in car space: the way the car was moving (else the contact force direction)
    const lv = car.body.linvel(); const vel = new THREE.Vector3(lv.x, 0, lv.z); let dirW = vel.lengthSq() > 1 ? vel.normalize() : new THREE.Vector3(info.dir?.x || 0, 0, info.dir?.z || 1).normalize();
    const rot = new THREE.Matrix3().setFromMatrix4(ginv); const dl = dirW.clone().applyMatrix3(rot).normalize();
    const size = car.size, ctr = car.ctr; const sx = size.x / 2 / Math.max(1e-3, Math.abs(dl.x)), sz = size.z / 2 / Math.max(1e-3, Math.abs(dl.z)); const s = Math.min(sx, sz) * 0.98;
    const lp = [ctr.x + dl.x * s, ctr.y + size.y * 0.05, ctr.z + dl.z * s].map(v => +v.toFixed(3)); const ld = [-dl.x, 0, -dl.z].map(v => +v.toFixed(3));
    const amount = +THREE.MathUtils.clamp(impulse / 30000, 0.03, 0.22).toFixed(3);
    if (applyDent(car.def.name, lp, ld, amount)) ch.send({ k: 'dent', car: car.def.name, p: lp, d: ld, a: amount });
  }
  phys.onImpact?.((ev) => {
    const imp = ev.force * world.timestep; if (imp < 400) return;
    for (const [own, other] of [[ev.ownerA, ev.b], [ev.ownerB, ev.a]]) {
      if (own?.kind !== 'car') continue; const car = carById(own.id); if (!car) continue;
      const otherCol = world.getCollider?.(other); const ob = otherCol?.parent(); if (ob && ob.isDynamic() && ob.mass() < 200) continue; // props don't dent a car
      const mine = own.driver ? own.driver === selfId() || own.driver === 'local' : damage.isHost(); if (!mine) continue;
      dentFromImpact(car, imp, { dir: ev.dir });
    }
  });

  // ------------------------------------------------------------------ network
  ch.onMessage = (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'op') { const op = ops.get(m.id); if (op && typeof m.t === 'number') setTarget(op, m.t, false); }
    else if (m.k === 'dent' && typeof m.car === 'string' && Array.isArray(m.p) && Array.isArray(m.d)) applyDent(m.car, m.p, m.d, THREE.MathUtils.clamp(+m.a || 0, 0, 0.25));
    else if (m.k === 'all') {
      if (Array.isArray(m.ops)) for (const x of m.ops.slice(0, 200)) { const op = Array.isArray(x) && ops.get(x[0]); if (op) setTarget(op, x[1], false); }
      if (Array.isArray(m.dents) && !dents.length) { const tryApply = (n = 0) => { if (!window.__cars?.cars?.length && n < 20) return setTimeout(() => tryApply(n + 1), 1000); for (const d of m.dents.slice(0, 200)) applyDent(d.car, d.p, d.d, THREE.MathUtils.clamp(+d.a || 0, 0, 0.25)); }; tryApply(); }
    }
  };
  api?.onPeerJoin?.((id) => {
    const list = []; for (const op of ops.values()) { const def = op.kind === 'slider' ? (op.meta.o.open ?? 0) : 0; if (op.target !== def) list.push([op.id, op.target]); }
    ch.send({ k: 'all', ops: list, dents: dents.slice(-80) }, id);
  });

  // ------------------------------------------------------------------ per frame
  let acc = 0;
  const update = (dt) => {
    if (queue.length) { const q = queue.splice(0); for (const f of q) { try { f(); } catch (err) { console.warn('[building]', err); } } }
    for (const op of ops.values()) {
      if (Math.abs(op.open - op.target) < 1e-3) continue;
      const sp = op.kind === 'garage' ? 0.45 : op.kind === 'slider' ? 0.6 : 1.4;
      op.open += Math.sign(op.target - op.open) * Math.min(Math.abs(op.target - op.open), dt * sp); setPose(op);
      if (op.target < 0.5 && op.open <= 1e-3) { op.open = 0; setPose(op); if (op.kind !== 'garage') showModel(op, false); restoreCollider(op); }
      poke();
    }
    if (falling.length) updateFalling(dt);
    if (checkAt && now() >= checkAt) { checkAt = 0; checkSupport(); }
    acc += dt; if (acc < 0.5) return; acc = 0;
    // french-door glass follows the door's re-created collider; doors closed with E auto-open again once you leave
    for (const [id, gs] of glassOf) { const meta = ops.get(id)?.meta || null; void meta; }
    const pp = ctx.player?.position;
    for (const meta of shell.openings) { const d = meta.door; if (!d) continue;
      const gs = glassOf.get(meta.o.id); if (gs && !gs.broken && d.collider && d.collider !== gs.attached) { gs.attached = d.collider; damage.attach(gs.eid, d.collider); }
      if (d.noAuto && pp && Math.hypot(d.world.x - pp.x, d.world.z - pp.z) > 2.5) d.noAuto = false; }
    if (lastBreak && now() - lastBreak > AUTO_REPAIR_MS && damage.isHost()) { lastBreak = 0; damage.repairAll(); }
  };
  update.__src = 'building'; ctx.onUpdate?.(update);

  const B = window.__building = {
    openings, holes, ops, panels, byId, carver, falling, dents, log,
    isOpen: (id) => { const r = openings.get(id); if (!r) return false; return r.type === 'doorway' || r.broken || r.open > 0.05; },
    setOpen: (id, t) => { const op = ops.get(id); if (op) { setTarget(op, t); return true; } const d = shell.openings.find(m => m.o.id === id)?.door; if (d) { d.target = t > 0.5 ? 1 : 0; if (d.target && d.collider) { phys.remove(d.collider); d.collider = null; } if (!d.target) { d.pendingClose = true; d.noAuto = true; } return true; } return false; },
    toggle: (id) => { const r = openings.get(id); return r ? B.setOpen(id, r.open > 0.5 ? 0 : 1) : false; },
    repair: () => { damage.repairAll(); return true; },
    breakPanel: (id, info) => { const p = byId.get(id); return p ? damage.hit(id, 1e9, { by: 'local', point: p.center, ...info }) : null; },
    dent: (carId, lp, ld, a) => { if (applyDent(carId, lp, ld, a)) ch.send({ k: 'dent', car: carId, p: lp, d: ld, a }); },
    supported, panelMatrix,
    stats: () => ({ panels: panels.length, broken: panels.filter(p => p.broken).length, collapsed: panels.filter(p => p.collapsed).length, falling: falling.length, ops: ops.size, open: [...ops.values()].filter(o => o.open > 0.01).length, glass: glassOf.size, glassBroken: [...glassOf.values()].filter(g => g.broken).length, dents: dents.length }),
  };
  return B;
}
