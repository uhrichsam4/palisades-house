// Movable + breakable world (src/smash). multiplayer.js calls startSmash(ctx, mp) once (solo too).
// How it works:
//   1. prep.js (main.js pre-merge hook) already turned light furniture / decor / furnish props into rigid bodies and
//      remembered the heavy built-ins; every item has a stable id + material (classify.js).
//   2. Here every item is registered with the shared damage model (src/damage.js): physics impacts (thrown rocks,
//      falls), punches and blasts all go through it, and it syncs hp/breaks on channel 'dmg'.
//   3. onBreak (every client): dynamic items lose their body + batched instance, static ones get their triangles
//      collapsed inside the merged meshes (zero extra draws); then a Voronoi fracture of the item's own hull becomes
//      pooled debris (fx.js) + shard sparks + a spatial procedural sound (sound.js). Metal dents instead (it skews).
//   4. hands.js: look at a light dynamic thing -> E::PICK UP, hold (soft, collides), LMB charge + release = throw,
//      RMB / E = drop, LMB with empty hands = punch (impulse + damage.hit 25 N·s, shoves players).
//   5. net.js: channel 'prop' replays throws / punches / holds, sends rest poses, catches up late joiners.
//   6. walk.js: player-only ramps over stairs + prop-only treads.
// Test hooks: window.__smash.
import * as THREE from 'three';
import { faceArea } from './classify.js';
import { createFx, mapTint } from './fx.js';
import { createSound } from './sound.js';
import { createHands } from './hands.js';
import { createNet } from './net.js';
import { buildWalk } from './walk.js';

const SND = { glass: 'glass', ceramic: 'ceramic', porcelain: 'ceramic', wood: 'wood', metal: 'metal', plastic: 'plastic', stone: 'stone', concrete: 'stone', fabric: 'thud', rubber: 'thud' };
const FX = { // fragments, burst power (m/s), sparks, splinter stretch, life [s]
  glass: { n: 18, pw: 2.4, sp: 46, spc: 0xdfeff2, glass: true, life: [8, 14] },
  ceramic: { n: 16, pw: 1.8, sp: 30, life: [10, 18] }, porcelain: { n: 16, pw: 1.6, sp: 28, life: [10, 18] }, // polish: smaller, more pieces
  stone: { n: 8, pw: 1.2, sp: 16, life: [12, 20] }, concrete: { n: 8, pw: 1.0, sp: 18, life: [12, 20] },
  wood: { n: 6, pw: 1.3, sp: 12, stretch: 4.5, life: [10, 20] }, metal: { n: 4, pw: 0.8, sp: 6, life: [10, 20] },
  plastic: { n: 6, pw: 1.4, sp: 10, life: [8, 16] }, fabric: { n: 4, pw: 0.7, sp: 8, spc: 0xf4f0ea, life: [8, 14] }, rubber: { n: 4, pw: 1, sp: 4, life: [8, 12] },
};
const DENSITY = { glass: 2500, ceramic: 2000, porcelain: 2300, stone: 2600, concrete: 2400, wood: 600, metal: 7800, plastic: 950, fabric: 300, rubber: 1100 };

export function startSmash(ctx, mp) {
  const prep = ctx.smashPrep; const { phys, damage, player, scene, camera } = ctx;
  if (!prep || !damage || !player || ctx.shot) return null;
  const R = phys.RAPIER, world = phys.world;
  const fx = createFx(ctx); const sound = createSound(camera);
  const items = prep.items; const byId = new Map(); const byHandle = new Map();
  const S = { ctx, mp, phys, damage, player, fx, sound, items, byId, byHandle, prep, selfId: () => mp?.selfId || 'local', isHost: () => damage.isHost() };
  let walk = null; try { walk = buildWalk(ctx); } catch (e) { console.warn('[smash] walk', e); }

  // ---------------------------------------------------------------- registry -> damage model
  for (const it of items) {
    byId.set(it.id, it);
    const cols = it.mode === 'dynamic' ? [it.d.collider] : it.cols;
    for (const c of cols) byHandle.set(c.handle, it);
    it.dmg = damage.add({ id: it.id, colliders: cols, material: it.material, area: faceArea(it.size, it.hpScale),
      onDamage: (e, dmg, info) => onDamage(it, dmg, info), onBreak: (e, info) => breakItem(it, info), onRepair: () => repairItem(it) });
    if (it.mode === 'dynamic') phys.watchImpacts(it.d.collider, Math.max(70, it.mass * 9.81 * 2.6));
    it.lastMover = null; it.heldBy = null; it.broken = false;
  }

  // settle grace: props find their rest in the first seconds (tiny drops, overlaps): those contacts must not break anything
  for (const it of items) { it.min0 = it.dmg.min; it.dmg.min = 1e9; }
  setTimeout(() => { for (const it of items) if (it.dmg && it.min0 !== undefined) it.dmg.min = it.min0; S.armed = true; }, 6000);

  // ---------------------------------------------------------------- damage visuals
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _b = new THREE.Box3(), _bw = new THREE.Box3();
  function posOf(it) { if (it.mode === 'dynamic' && it.d?.body) { const t = it.d.body.translation(); return _v.set(t.x, t.y, t.z); } return _v.fromArray(it.center); }
  function onDamage(it, dmg, info) {
    const p = info?.point || posOf(it).clone();
    if (it.material === 'metal' && it.mode === 'dynamic' && it.d && !it.broken) { // dent: squash a little along the hit
      const k = Math.min(0.06, dmg / 4000); const dir = info?.dir || { x: 0, y: 1, z: 0 };
      const s = new THREE.Vector3(1 - k * Math.abs(dir.x), 1 - k * Math.abs(dir.y), 1 - k * Math.abs(dir.z)); s.addScalar(k * 0.3);
      it.d.offset.premultiply(_m.makeScale(s.x, s.y, s.z)); it.d.body.wakeUp();
    }
    if (it.material === 'glass' && !it.broken && it.dmg) { const k = 1 - it.dmg.hp / it.dmg.maxHp; const d = info?.dir; const cp = camera.position; const n = d ? { x: -d.x, y: -d.y, z: -d.z } : { x: cp.x - p.x, y: cp.y - p.y, z: cp.z - p.z };
      fx.crack(it.id, p, n, THREE.MathUtils.clamp(Math.max(...it.size) * 0.35, 0.06, 0.5), k); sound.play('ceramic', p, 0.25 + k * 0.4, 1.8); }
    if (dmg > 3) sound.play(SND[it.material] === 'glass' ? 'ceramic' : (SND[it.material] || 'thud'), p, Math.min(0.8, dmg / 60));
  }
  // collapse every triangle of the merged meshes that lies inside the item's box (static items)
  function hideStatic(it) {
    const inv = new THREE.Matrix4().copy(it.mw).invert(); const wb = _bw.copy(it.box).applyMatrix4(it.mw); const saved = [];
    for (const m of prep.merged || []) {
      if (!m.parent) continue; const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!_b.copy(g.boundingBox).applyMatrix4(m.matrixWorld).intersectsBox(wb)) continue;
      const toL = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld); const pos = g.attributes.position; const n = pos.count;
      const inside = new Uint8Array(n); const mw = m.matrixWorld; const ident = mw.equals(new THREE.Matrix4());
      for (let i = 0; i < n; i++) { _v.fromBufferAttribute(pos, i); if (!ident) _v.applyMatrix4(mw); if (!wb.containsPoint(_v)) continue; _v.fromBufferAttribute(pos, i).applyMatrix4(toL); if (it.box.containsPoint(_v)) inside[i] = 1; }
      const idx = g.index; let lo = Infinity, hi = -1; const keep = [];
      if (idx) {
        const a = idx.array;
        for (let t = 0; t < a.length; t += 3) if (inside[a[t]] && inside[a[t + 1]] && inside[a[t + 2]] && !(a[t] === a[t + 1] && a[t] === a[t + 2])) { keep.push(t, a[t + 1], a[t + 2]); a[t + 1] = a[t]; a[t + 2] = a[t]; lo = Math.min(lo, t); hi = Math.max(hi, t + 3); }
        if (hi > 0) { idx.addUpdateRange(lo, hi - lo); idx.needsUpdate = true; saved.push({ g, keep, idx: true }); }
      } else {
        const a = pos.array;
        for (let t = 0; t < n; t += 3) if (inside[t] && inside[t + 1] && inside[t + 2]) { keep.push(t, ...Array.from(a.slice(t * 3, t * 3 + 9))); for (let k = 1; k < 3; k++) { a[(t + k) * 3] = a[t * 3]; a[(t + k) * 3 + 1] = a[t * 3 + 1]; a[(t + k) * 3 + 2] = a[t * 3 + 2]; } lo = Math.min(lo, t * 3); hi = Math.max(hi, t * 3 + 9); }
        if (hi > 0) { pos.addUpdateRange(lo, hi - lo); pos.needsUpdate = true; saved.push({ g, keep, idx: false }); }
      }
    }
    for (const o of it.meshes) if (o.parent && o.visible) { o.visible = false; saved.push({ mesh: o }); } // never merged (glass, custom shaders)
    it.hidden = saved;
    for (const c of it.cols) { try { phys.remove(c); } catch {} } it.cols = [];
    ctx.shadows?.poke?.();
  }
  function dynCloud(it) {
    const pts = []; it.obj.updateWorldMatrix(true, true); const ms = []; it.obj.traverse(o => { if (o.isMesh) ms.push(o); });
    let total = 0; for (const o of ms) total += o.geometry.attributes.position.count; const step = Math.max(1, Math.floor(total / 300));
    for (const o of ms) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += step) { _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push(_v.x, _v.y, _v.z); } }
    return new Float32Array(pts);
  }
  function colorOfDyn(it) {
    if (it.color) return it.color; let best = null, bv = -1;
    it.obj.traverse(o => { if (!o.isMesh) return; const m = [].concat(o.material)[0]; if (!m?.color) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const v = o.geometry.boundingSphere.radius; if (v > bv) { bv = v; best = o; } });
    const c = new THREE.Color(0xc9c2b6); if (best) { const m = [].concat(best.material)[0]; c.copy(m.color); const tn = mapTint(m); if (tn) c.multiply(tn); /* polish: textured items */ const col = best.geometry.attributes.color; if (m.vertexColors && col) { let r = 0, g = 0, b = 0; const n = Math.min(64, col.count); for (let i = 0; i < n; i++) { const k = Math.floor(i * col.count / n); r += col.getX(k); g += col.getY(k); b += col.getZ(k); } c.r *= r / n; c.g *= g / n; c.b *= b / n; } }
    return (it.color = c);
  }
  // polish: static items' prep colour ignores texture maps (wood chairs came out pale); tint lazily on first break
  function staticColor(it) {
    if (it.tinted || !it.color) return it.color; it.tinted = true; let best = null, bv = -1;
    for (const o of it.meshes || []) { const m = [].concat(o.material)[0]; if (!m?.color) continue; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const v = o.geometry.boundingSphere.radius; if (v > bv) { bv = v; best = m; } }
    const tn = mapTint(best); if (tn) it.color = it.color.clone().multiply(tn); return it.color;
  }
  // polish: size-weighted colours of the item's parts (fragments pick from these), built once per item on break
  function paletteOf(it, base) {
    if (it.palette !== undefined) return it.palette; const ms = it.meshes ? [...it.meshes] : []; it.obj?.traverse?.(o => { if (o.isMesh && !ms.includes(o)) ms.push(o); });
    const P = []; let sum = 0;
    for (const o of ms) { const m = [].concat(o.material)[0]; if (!m?.color || m.transparent) continue; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis(); const w = r * r; const c = m.color.clone(); const tn = mapTint(m); if (tn) c.multiply(tn);
      const same = P.find(p => Math.abs(p.c.r - c.r) + Math.abs(p.c.g - c.g) + Math.abs(p.c.b - c.b) < 0.08); if (same) same.w += w; else P.push({ c, w }); sum += w; }
    if (P.length < 2) return (it.palette = null);
    P.sort((a, b) => b.w - a.w); P.length = Math.min(P.length, 4); P.sum = P.reduce((s, p) => s + p.w, 0); return (it.palette = P);
  }
  function hideDynamic(it) {
    const d = it.d; if (!d) return null;
    const lv = d.body.linvel(); const vel = { x: lv.x, y: lv.y, z: lv.z };
    for (const t of it.tracked || []) { t.b.setVisibleAt(t.id, false); const arr = prep.propBatch?.tracked; const i = arr ? arr.indexOf(t) : -1; if (i >= 0) arr.splice(i, 1); }
    it.obj.visible = false;
    const i = phys.dynamics.indexOf(d); if (i >= 0) phys.dynamics.splice(i, 1);
    byHandle.delete(d.collider.handle); d.dead = true; try { world.removeRigidBody(d.body); } catch {} // dead: spliced above, so physics.js can't flag it; any stale holder must skip it
    it.d = null; it.deadD = d;
    return vel;
  }
  function breakItem(it, info = {}) {
    if (it.broken) return; if (S.hands?.heldItem === it) S.hands.release(true);
    if (it.heldBy) S.net?.clearHeld(it);
    const quiet = info.remote && !info.point; // late-joiner state sync: just gone
    const cloud = it.mode === 'dynamic' ? dynCloud(it) : it.hull;
    const color = it.mode === 'dynamic' ? colorOfDyn(it) : staticColor(it);
    const bb = new THREE.Box3(); for (let i = 0; i < cloud.length; i += 3) bb.expandByPoint(_v.set(cloud[i], cloud[i + 1], cloud[i + 2]));
    const size = bb.getSize(new THREE.Vector3()); const ctr = bb.getCenter(new THREE.Vector3());
    let vel = null; if (it.mode === 'dynamic') vel = hideDynamic(it); else hideStatic(it);
    it.broken = true;
    if (quiet) return;
    const F = FX[it.material] || FX.plastic; const mx = Math.max(size.x, size.y, size.z);
    const count = Math.max(3, Math.min(18, Math.round(F.n * THREE.MathUtils.clamp(mx / 0.45, 0.6, 1.5))));
    const impact = info.point ? new THREE.Vector3(info.point.x, info.point.y, info.point.z) : ctr.clone();
    const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
    const t0 = performance.now();
    const cells = fx.fracture(cloud, { count, impact, stretchAxis: F.stretch ? axis : null, stretch: F.stretch || 1 });
    const mass = it.mass || Math.min(400, size.x * size.y * size.z * (DENSITY[it.material] || 800) * 0.2);
    fx.spawn(cells, { color, palette: paletteOf(it, color), glass: !!F.glass, mass, vel, impact, dir: info.dir, power: F.pw, life: F.life });
    fx.clearCracks(it.id);
    if (F.glass) fx.glitter(impact, 90, { speed: F.pw * 1.2, floorY: floorBelow(ctr, bb.min.y) });
    fx.sparks(impact, F.sp, { color: F.spc ?? color.getHex(), speed: F.pw * 1.6, floorY: floorBelow(ctr, bb.min.y), size: F.glass ? 0.7 : 1 });
    sound.play(SND[it.material] || 'thud', ctr, THREE.MathUtils.clamp(0.5 + mx * 0.5, 0.5, 1.4), mx > 1 ? 0.8 : 1);
    S.lastBreak = { id: it.id, ms: +(performance.now() - t0).toFixed(1), cells: cells.length, t: performance.now() };
  }
  const _ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  function floorBelow(p, y) { _ray.origin.x = p.x; _ray.origin.y = y + 0.05; _ray.origin.z = p.z; const h = world.castRay(_ray, 4, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC); return h ? y + 0.05 - (h.timeOfImpact ?? h.toi) : y - 0.5; }
  function repairItem(it) {
    if (!it.broken) return; it.broken = false;
    if (it.mode === 'dynamic' && it.deadD) {
      const d0 = it.deadD; const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...it.p0).setRotation({ x: it.q0[0], y: it.q0[1], z: it.q0[2], w: it.q0[3] }).setLinearDamping(0.12).setAngularDamping(0.35));
      const desc = (() => { const s = d0.collider.shape; try { if (s.vertices) return R.ColliderDesc.convexHull(s.vertices); if (s.halfExtents) return R.ColliderDesc.cuboid(s.halfExtents.x, s.halfExtents.y, s.halfExtents.z); if (s.radius) return R.ColliderDesc.ball(s.radius); } catch {} return R.ColliderDesc.cuboid(it.size[0] / 2, it.size[1] / 2, it.size[2] / 2); })();
      desc.setMass(it.mass).setFriction(0.65).setCollisionGroups(prep.PROP_GROUPS);
      const col = world.createCollider(desc, body);
      const d = { body, collider: col, obj: it.obj, offset: d0.offset, parent: d0.parent, sleepSkip: false, smash: it };
      phys.dynamics.push(d); it.d = d; it.deadD = null; byHandle.set(col.handle, it); damage.attach(it.id, col); phys.watchImpacts(col, Math.max(70, it.mass * 9.81 * 2.6));
      it.obj.visible = true; for (const t of it.tracked || []) { t.b.setVisibleAt(t.id, true); prep.propBatch?.tracked?.push(t); }
      setTimeout(() => { if (it.d === d) d.sleepSkip = true; }, 3000);
    } else if (it.mode === 'static') {
      for (const s of it.hidden || []) {
        if (s.mesh) { s.mesh.visible = true; continue; }
        if (s.idx) { const a = s.g.index.array; for (let k = 0; k < s.keep.length; k += 3) { a[s.keep[k] + 1] = s.keep[k + 1]; a[s.keep[k] + 2] = s.keep[k + 2]; } s.g.index.needsUpdate = true; }
        else { const a = s.g.attributes.position.array; for (let k = 0; k < s.keep.length; k += 10) a.set(s.keep.slice(k + 1, k + 10), s.keep[k] * 3); s.g.attributes.position.needsUpdate = true; }
      }
      it.hidden = null;
      for (const cd of it.colDescs || []) { const c = world.createCollider(R.ColliderDesc.cuboid(...cd.he).setTranslation(...cd.t).setRotation({ x: cd.r[0], y: cd.r[1], z: cd.r[2], w: cd.r[3] })); if (cd.g !== undefined) c.setCollisionGroups(cd.g); it.cols.push(c); byHandle.set(c.handle, it); damage.attach(it.id, c); }
      ctx.shadows?.poke?.();
    }
  }

  // ---------------------------------------------------------------- impacts: sounds + who moved what
  const sndT = new Map();
  phys.onImpact((ev) => {
    const ia = byHandle.get(ev.a), ib = byHandle.get(ev.b);
    for (const [it, other] of [[ia, ev.ownerB], [ib, ev.ownerA]]) {
      if (!it || it.broken || it.mode !== 'dynamic' || !it.d) continue;
      // knocked by something a player threw / drove: that player owns the outcome (damage + rest pose)
      if (other?.by && it.heldBy == null && other.kind !== 'knocked' && it.lastMover !== other.by) { it.lastMover = other.by; phys.claim(it.d.collider, { kind: 'knocked', id: it.id, by: other.by }); }
      const imp = ev.force * world.timestep; const now = performance.now();
      if (imp > 0.5 && now - (sndT.get(it) || 0) > 140) { sndT.set(it, now); const t = it.d.body.translation(); const k = it.material === 'fabric' ? 'thud' : (SND[it.material] || 'thud');
        sound.play(imp > 6 || ['glass', 'ceramic'].includes(k) ? k : 'thud', t, Math.min(1, imp / (it.mass * 2.5 + 1.5)) * (k === 'glass' ? 0.35 : 0.8), k === 'glass' || k === 'ceramic' ? 1.6 : 1); }
    }
  });

  const net = createNet(S); S.net = net;
  const hands = createHands(S); S.hands = hands;

  // ---------------------------------------------------------------- per frame
  ctx.onUpdate((dt) => { fx.update(dt); hands.update(dt); net.update(dt); });

  const api = {
    items, byId, fx, sound, hands, net, walk, S,
    stats: () => ({ items: items.length, dynamic: items.filter(i => i.mode === 'dynamic').length, static: items.filter(i => i.mode === 'static').length, broken: items.filter(i => i.broken).length, fragments: fx.live, sparks: fx.sparksAlive, lastBreak: S.lastBreak || null }),
    list: (f) => items.filter(i => !f || f(i)).map(i => ({ id: i.id, label: i.label, material: i.material, mode: i.mode, mass: +(i.mass || 0).toFixed(1), broken: i.broken, pos: posOf(i).toArray().map(v => +v.toFixed(2)) })),
    pose(id) { const it = byId.get(id); if (!it?.d || it.d.dead) return null; const t = it.d.body.translation(), r = it.d.body.rotation(); return { p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], sleeping: it.d.body.isSleeping() }; },
    breakItem: (id, info) => { const it = byId.get(id); if (it) damage.hit(id, 1e9, { by: S.selfId(), ...info }); },
  };
  window.__smash = api;
  return api;
}
