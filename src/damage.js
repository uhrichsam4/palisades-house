// Shared damage model (lead, 2026-11-08). Every breakable thing — props, window glass, doors, walls, floors, roofs,
// cars — registers its collider(s) here with a MATERIAL. Damage comes from:
//   - physics impacts (phys.onImpact: thrown rocks, cars, falling debris) — impulse = contact force × timestep
//   - direct hits: damage.hit(id, impulseNs, info)  (punches, tools, game logic)
//   - blasts: damage.blast(center, radius, power, info)  (meteors, explosions, lightning)
// Each material has `min` (impulse in N·s below which nothing happens: a pebble never hurts concrete) and `hp`
// per square metre of face (bigger panels take more). Damage = impulse − min, accumulated; at 0 hp the thing breaks.
// Rough impulses: thrown 1 kg rock at 12 m/s ≈ 12 N·s · punch ≈ 25 · body slam ≈ 60 · car at 10 m/s ≈ 15 000 · meteor ≥ 50 000.
//
//   const e = ctx.damage.add({ id: 'wall:g12:3', colliders: [c1, c2], material: 'drywall', area: 2.4,
//                              onDamage: (e, dmg, info) => {...cracks...}, onBreak: (e, info) => {...hole, debris...} });
//   ctx.damage.remove(e.id)  ·  ctx.damage.get(id) → { id, material, hp, maxHp, broken }  ·  ctx.damage.onBreak(fn)
//   ctx.damage.repair(id) / repairAll()  (restores hp; owners get onRepair(e))
//
// Network (multiplayer.js calls damage.attachNet(api)): breaks and hp changes are sent on channel 'dmg' by the client
// that CAUSED them (info.by === selfId; unowned impacts — debris, falling props — are resolved by the host, the lowest
// peer id). Receivers apply them as-is (no threshold), so every screen shows the same holes. Late joiners get the full
// damaged-state table; ids that register later (lazy modules) pick their state up on add().
import * as THREE from 'three';

export const MATERIALS = {
  // name        min (N·s)  hp per m²   notes
  glass:     { min: 4,    hp: 6,     label: 'glass' },        // windows, glass doors, mirrors, shower glass
  ceramic:   { min: 2,    hp: 3,     label: 'ceramic' },      // plates, mugs, vases, toilets/sinks use 'porcelain'
  porcelain: { min: 30,   hp: 120,   label: 'porcelain' },
  plastic:   { min: 15,   hp: 60,    label: 'plastic' },
  fabric:    { min: 60,   hp: 400,   label: 'fabric' },       // sofas, beds (soak up hits)
  drywall:   { min: 20,   hp: 150,   label: 'drywall' },      // interior partitions, ceilings
  wood:      { min: 35,   hp: 420,   label: 'wood' },         // doors, cabinets, furniture, decks, fences
  siding:    { min: 120,  hp: 1400,  label: 'siding' },       // exterior board-and-batten / stucco walls
  stone:     { min: 400,  hp: 4000,  label: 'stone' },        // ledgestone, fireplace, counters (quartz)
  brick:     { min: 350,  hp: 3500,  label: 'brick' },
  metal:     { min: 600,  hp: 6000,  label: 'metal' },        // appliances, railings, car bodies, garage doors
  concrete:  { min: 1500, hp: 12000, label: 'concrete' },     // foundation, slabs, retaining walls, pool shell, driveway
  rubber:    { min: 200,  hp: 2000,  label: 'rubber' },
};

export function createDamage(ctx) {
  const { phys } = ctx;
  const R = phys.RAPIER; const world = phys.world;
  const byId = new Map();          // id -> entry
  const byHandle = new Map();      // collider handle -> entry
  const pending = new Map();       // id -> net state received before the entity registered
  const breakFns = []; let net = null;

  const entry = (idOrHandle) => typeof idOrHandle === 'string' ? byId.get(idOrHandle) : byHandle.get(idOrHandle);

  function add(def) {
    const m = MATERIALS[def.material] || MATERIALS.wood;
    const maxHp = def.hp ?? m.hp * Math.max(0.05, def.area ?? 1);
    const e = { id: def.id, material: def.material || 'wood', min: def.min ?? m.min, maxHp, hp: maxHp, broken: false, colliders: [], def };
    if (!e.id) throw new Error('damage.add needs an id');
    byId.set(e.id, e);
    for (const c of def.colliders || []) attach(e, c);
    const p = pending.get(e.id); if (p) { pending.delete(e.id); applyState(e, p, { remote: true }); }
    return e;
  }
  function attach(e, c) {
    if (!c) return; e.colliders.push(c); byHandle.set(c.handle, e);
    // contact force events: threshold = the force that would deliver `min` N·s within one physics step
    phys.watchImpacts?.(c, Math.max(1, e.min / world.timestep));
  }
  function remove(id) { const e = byId.get(id); if (!e) return; byId.delete(id); for (const c of e.colliders) byHandle.delete(c.handle); }

  function hit(idOrHandle, impulse, info = {}) {
    const e = entry(idOrHandle); if (!e || e.broken) return null;
    const dmg = impulse - e.min; if (!(dmg > 0)) return e;
    if (net && !mayResolve(info)) return e; // a peer caused it: wait for their message
    e.hp = Math.max(0, e.hp - dmg);
    try { e.def.onDamage?.(e, dmg, info); } catch (err) { console.warn('[damage] onDamage', e.id, err); }
    if (e.hp <= 0) doBreak(e, info);
    if (net) send(e, info);
    return e;
  }
  function doBreak(e, info) {
    if (e.broken) return; e.broken = true;
    try { e.def.onBreak?.(e, info); } catch (err) { console.warn('[damage] onBreak', e.id, err); }
    for (const f of breakFns) { try { f(e, info); } catch (err) { console.warn('[damage]', err); } }
  }
  function repair(id) {
    const e = byId.get(id); if (!e) return; const was = e.broken; e.hp = e.maxHp; e.broken = false;
    try { e.def.onRepair?.(e); } catch (err) { console.warn('[damage] onRepair', e.id, err); }
    if (net && was !== undefined) net.ch.send({ k: 'fix', id });
  }
  function repairAll() { for (const id of byId.keys()) if (byId.get(id).hp < byId.get(id).maxHp) repair(id); }

  // blast: every registered collider whose shape is within `radius` takes power·(1−d/r)² N·s; dynamic bodies get pushed
  const _c = new THREE.Vector3();
  function blast(center, radius, power, info = {}) {
    const shape = new R.Ball(radius); const hitEntries = new Map(); const pushes = [];
    world.intersectionsWithShape({ x: center.x, y: center.y, z: center.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (col) => {
      const t = col.translation(); _c.set(t.x, t.y, t.z); const d = _c.distanceTo(center); const k = Math.max(0, 1 - d / radius) ** 2;
      const e = byHandle.get(col.handle); if (e && !hitEntries.has(e)) hitEntries.set(e, k);
      const b = col.parent(); if (b && b.isDynamic()) pushes.push([b, _c.clone(), k]);
      return true;
    });
    for (const [b, p, k] of pushes) { const dir = p.sub(center).normalize(); const imp = power * k * 0.02; try { b.applyImpulse({ x: dir.x * imp, y: dir.y * imp + imp * 0.3, z: dir.z * imp }, true); } catch {} }
    for (const [e, k] of hitEntries) hit(e.id, power * k, { ...info, point: center, blast: true });
  }

  // physics impacts -> damage. Two guards against false breaks (a load-time burst broke props all over the house):
  //  - warm-up: nothing breaks from contacts in the first WARMUP_MS (props settle, colliders resolve overlaps)
  //  - closing speed: resting/settling/penetration contacts have big forces but almost no relative speed — a real
  //    impact needs the two bodies to be moving into each other at >= MIN_SPEED m/s
  // Impacts are queued and applied once per frame, outside the physics step (breaks remove/add bodies).
  const WARMUP_MS = 25000, MIN_SPEED = 1.2; const t0 = performance.now(); const queue = [];
  const velOf = (h) => { const c = world.getCollider(h); const b = c && c.parent(); if (!b || !b.isValid?.() && b.isValid) return null; try { const v = b.linvel(); return v; } catch { return null; } };
  phys.onImpact?.((ev) => {
    const ea = byHandle.get(ev.a), eb = byHandle.get(ev.b); if (!ea && !eb) return;
    if (performance.now() - t0 < WARMUP_MS) return;
    const va = velOf(ev.a), vb = velOf(ev.b);
    const dx = (va?.x || 0) - (vb?.x || 0), dy = (va?.y || 0) - (vb?.y || 0), dz = (va?.z || 0) - (vb?.z || 0);
    if (dx * dx + dy * dy + dz * dz < MIN_SPEED * MIN_SPEED) return;
    if (queue.length < 256) queue.push({ ea, eb, impulse: ev.force * world.timestep, dir: ev.dir, ownerA: ev.ownerA, ownerB: ev.ownerB });
  });
  const flush = () => {
    if (!queue.length) return; const q = queue.splice(0);
    for (const m of q) {
      if (m.ea && byId.get(m.ea.id) === m.ea) hit(m.ea.id, m.impulse, { by: m.ownerB?.by ?? null, source: m.ownerB, dir: m.dir });
      if (m.eb && byId.get(m.eb.id) === m.eb) hit(m.eb.id, m.impulse, { by: m.ownerA?.by ?? null, source: m.ownerA, dir: m.dir });
    }
  };
  if (ctx.onUpdate) { flush.__src = 'damage.js'; ctx.onUpdate(flush); }

  // ---------------------------------------------------------------- network
  function isHost() { if (!net) return true; const me = net.api.selfId; for (const id of net.api.peers.keys()) if (id < me) return false; return true; }
  function mayResolve(info) { if (info.remote) return true; if (info.by) return info.by === net.api.selfId || info.by === 'local'; return isHost(); }
  function send(e, info) { const p = info.point; net.ch.send({ k: 'hp', id: e.id, hp: Math.round(e.hp * 10) / 10, br: e.broken ? 1 : 0, p: p ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : null, d: info.dir ? [+info.dir.x.toFixed(2), +info.dir.y.toFixed(2), +info.dir.z.toFixed(2)] : null, s: info.source?.kind || null }); }
  function applyState(e, m, extra = {}) {
    const before = e.hp; e.hp = Math.min(e.maxHp, m.hp); const info = { remote: true, point: m.p ? new THREE.Vector3(...m.p) : null, dir: m.d ? { x: m.d[0], y: m.d[1], z: m.d[2] } : null, source: m.s ? { kind: m.s } : null, ...extra };
    if (before > e.hp) { try { e.def.onDamage?.(e, before - e.hp, info); } catch (err) { console.warn(err); } }
    if (m.br && !e.broken) doBreak(e, info);
  }
  function attachNet(api) {
    if (!api?.channel) return; const ch = api.channel('dmg'); net = { api, ch };
    ch.onMessage = (m, from) => {
      if (!m || typeof m.id !== 'string') { if (m?.k === 'all' && Array.isArray(m.list)) for (const s of m.list) ch.onMessage({ k: 'hp', ...s }, from); return; }
      if (m.k === 'fix') { const e = byId.get(m.id); if (e) { e.hp = e.maxHp; e.broken = false; try { e.def.onRepair?.(e); } catch {} } return; }
      if (m.k !== 'hp') return; const e = byId.get(m.id); if (!e) { pending.set(m.id, m); return; } applyState(e, m);
    };
    api.onPeerJoin?.((id) => { const list = []; for (const e of byId.values()) if (e.hp < e.maxHp) list.push({ id: e.id, hp: e.hp, br: e.broken ? 1 : 0 }); if (list.length) ch.send({ k: 'all', list }, id); });
  }

  const api = {
    MATERIALS, add, remove, attach: (id, c) => { const e = byId.get(id); if (e) attach(e, c); }, hit, blast, repair, repairAll,
    get: (id) => byId.get(id), ofCollider: (handle) => byHandle.get(handle), entries: byId,
    onBreak(fn) { breakFns.push(fn); return () => { const i = breakFns.indexOf(fn); if (i >= 0) breakFns.splice(i, 1); }; },
    attachNet, isHost,
  };
  window.__damage = api;
  return api;
}
