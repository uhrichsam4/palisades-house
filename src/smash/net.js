// Prop sync (src/smash) on mp.channel('prop'). Breaks + hp travel on the damage model's own channel ('dmg').
//   thr  {id,p,q,v,w}   a throw at release: every client replays the same flight (claimed {kind:'thrown', by})
//   imp  {id,i,at}      a punch impulse on a prop
//   hold {id} / drop {id,p,q,v}   a peer picked a prop up / let go: receivers carry it in that avatar's hands
//   rest {id,p,q}       a moved prop went to sleep on the client that last moved it: everyone snaps to that pose
//   shove {to,d}        a punch hit a player: the victim's client applies the knock-back
//   poses {list}        late joiner: the host sends every moved prop's pose; holders re-send their 'hold'
// Who owns a moving prop's outcome: whoever last touched it (held/threw/punched/pushed it, or threw the thing that
// knocked it), else the host (lowest peer id).
import * as THREE from 'three';

const r3 = (x) => Math.round(x * 1000) / 1000;
const arr = (o, n) => Array.isArray(o) && o.length === n && o.every(Number.isFinite);

export function createNet(S) {
  const { ctx, mp, phys, player, items, byId } = S; const R = phys.RAPIER;
  const ch = mp?.channel ? mp.channel('prop') : null;
  const dyn = () => items.filter(i => i.mode === 'dynamic');
  const remoteHeld = new Map(); // id -> { it, peer }
  const self = () => S.selfId();
  const send = (m, to) => { try { ch?.send(m, to); } catch {} };
  const poseOf = (d) => { const t = d.body.translation(), r = d.body.rotation(); return { p: [r3(t.x), r3(t.y), r3(t.z)], q: [r3(r.x), r3(r.y), r3(r.z), r3(r.w)] }; };
  for (const it of items) if (it.mode === 'dynamic') { it.syncP = it.p0.slice(); it.syncQ = it.q0.slice(); }

  // write a sleeping body's pose straight into its object + batched instance (physics.js skips sleeping props)
  const _bm = new THREE.Matrix4(), _pi = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  function writePose(it) {
    const d = it.d; if (!d) return; const t = d.body.translation(), r = d.body.rotation();
    _bm.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s.set(1, 1, 1)).multiply(d.offset);
    const par = d.obj.parent; if (par) { par.updateWorldMatrix(true, false); _pi.copy(par.matrixWorld).invert(); _bm.premultiply(_pi); }
    _bm.decompose(d.obj.position, d.obj.quaternion, d.obj.scale); d.obj.updateWorldMatrix(true, true);
    for (const tr of it.tracked || []) tr.b.setMatrixAt(tr.id, tr.o.matrixWorld);
  }
  function setPose(it, p, q, sleep = true) {
    const d = it.d; if (!d) return;
    d.body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true); d.body.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true);
    d.body.setLinvel({ x: 0, y: 0, z: 0 }, true); d.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (sleep) d.body.sleep(); writePose(it);
    it.syncP = p.slice(); it.syncQ = q.slice(); it.awake = false;
  }

  // ---------------------------------------------------------------- outgoing
  const api = {
    sendThrow(it) { const d = it.d; if (!d) return; const { p, q } = poseOf(d); const v = d.body.linvel(), w = d.body.angvel(); send({ k: 'thr', id: it.id, p, q, v: [r3(v.x), r3(v.y), r3(v.z)], w: [r3(w.x), r3(w.y), r3(w.z)] }); },
    sendImpulse(it, i, at) { send({ k: 'imp', id: it.id, i: [r3(i.x), r3(i.y), r3(i.z)], at: [r3(at.x), r3(at.y), r3(at.z)] }); },
    sendHold(it) { send({ k: 'hold', id: it.id }); },
    sendDrop(it) { const d = it.d; if (!d) return; const { p, q } = poseOf(d); const v = d.body.linvel(); send({ k: 'drop', id: it.id, p, q, v: [r3(v.x), r3(v.y), r3(v.z)] }); },
    sendShove(to, dir) { send({ k: 'shove', to, d: [r3(dir.x), r3(dir.y), r3(dir.z)] }); },
    clearHeld(it) { const h = remoteHeld.get(it.id); if (h) { remoteHeld.delete(it.id); setHoldAnim(h.peer, false); } it.heldBy = null; },
    remoteHeld, writePose, setPose,
    stats: { sent: 0, recv: 0, rests: 0 },
  };

  // ---------------------------------------------------------------- remote hands
  const setHoldAnim = (peer, on) => { const r = mp?.peers?.get(peer); const a = r?.creature?.animator; if (a) a.hold = on; };
  function toDynamic(it) { const d = it.d; if (!d) return; d.body.setBodyType(R.RigidBodyType.Dynamic, true); d.collider.setCollisionGroups(S.prep.PROP_GROUPS); }
  function remoteHold(it, peer) {
    if (!it.d || it.d.dead || it.broken) return; if (S.hands.heldItem === it) S.hands.release(true);
    it.heldBy = peer; remoteHeld.set(it.id, { it, peer }); const d = it.d; d.sleepSkip = false;
    d.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true); d.collider.setCollisionGroups(phys.groups(phys.GROUPS.ALL, phys.GROUPS.ALL & ~(phys.GROUPS.RAMP | phys.GROUPS.PLAYER)));
    setHoldAnim(peer, true);
  }
  function remoteLetGo(it) { const h = remoteHeld.get(it.id); remoteHeld.delete(it.id); if (h) setHoldAnim(h.peer, false); it.heldBy = null; toDynamic(it); }

  // ---------------------------------------------------------------- incoming
  if (ch) ch.onMessage = (m, from) => {
    if (!m || typeof m.k !== 'string') return; api.stats.recv++;
    if (m.k === 'shove') { if (m.to === self() && arr(m.d, 3)) { player.state.push.set(m.d[0] * 4.2, 2.2, m.d[2] * 4.2); } return; }
    if (m.k === 'poses' && Array.isArray(m.list)) { for (const e of m.list.slice(0, 2000)) { const it = byId.get(e?.[0]); if (it?.d && !it.heldBy && arr(e[1], 3) && arr(e[2], 4)) setPose(it, e[1], e[2]); } return; }
    const it = byId.get(m.id); if (!it || it.mode !== 'dynamic' || !it.d || it.d.dead || it.broken) return;
    if (m.k === 'hold') { remoteHold(it, from); return; }
    if (m.k === 'drop') { remoteLetGo(it); if (arr(m.p, 3) && arr(m.q, 4)) { setPose(it, m.p, m.q, false); if (arr(m.v, 3)) it.d.body.setLinvel({ x: m.v[0], y: m.v[1], z: m.v[2] }, true); it.d.body.wakeUp(); } it.lastMover = from; return; }
    if (m.k === 'thr') {
      if (!arr(m.p, 3) || !arr(m.q, 4) || !arr(m.v, 3)) return;
      if (S.hands.heldItem === it) S.hands.release(true);
      remoteLetGo(it); const d = it.d; d.sleepSkip = false;
      d.body.setTranslation({ x: m.p[0], y: m.p[1], z: m.p[2] }, true); d.body.setRotation({ x: m.q[0], y: m.q[1], z: m.q[2], w: m.q[3] }, true);
      d.body.setLinvel({ x: m.v[0], y: m.v[1], z: m.v[2] }, true); if (arr(m.w, 3)) d.body.setAngvel({ x: m.w[0], y: m.w[1], z: m.w[2] }, true);
      d.body.setGravityScale(1, true); d.body.setLinearDamping(0.12); d.body.setAngularDamping(0.35); d.body.enableCcd(true); d.body.wakeUp();
      phys.claim(d.collider, { kind: 'thrown', id: it.id, by: from }); it.lastMover = from; it.flying = performance.now();
      S.lastRemoteThrow = { id: it.id, from, t: performance.now() };
      return;
    }
    if (m.k === 'imp' && arr(m.i, 3) && arr(m.at, 3)) { it.d.body.applyImpulseAtPoint({ x: m.i[0], y: m.i[1], z: m.i[2] }, { x: m.at[0], y: m.at[1], z: m.at[2] }, true); it.lastMover = from; phys.claim(it.d.collider, { kind: 'punch', id: it.id, by: from }); return; }
    if (m.k === 'rest' && arr(m.p, 3) && arr(m.q, 4)) { if (it.heldBy) return; setPose(it, m.p, m.q); it.lastMover = null; phys.unclaim(it.d.collider); api.stats.rests++; return; }
  };
  mp?.onPeerJoin?.((id) => {
    if (S.hands.heldItem) send({ k: 'hold', id: S.hands.heldItem.id }, id);
    if (!S.isHost()) return;
    const list = [];
    for (const it of dyn()) { if (!it.d || it.d.dead || it.broken || it.heldBy) continue; const t = it.d.body.translation(); if (Math.hypot(t.x - it.p0[0], t.y - it.p0[1], t.z - it.p0[2]) > 0.02 || movedRot(it)) { const { p, q } = poseOf(it.d); list.push([it.id, p, q]); } }
    for (let i = 0; i < list.length; i += 150) send({ k: 'poses', list: list.slice(i, i + 150) }, id);
  });
  mp?.onPeerLeave?.((id) => { for (const [, h] of [...remoteHeld]) if (h.peer === id) remoteLetGo(h.it); });
  function movedRot(it) { const r = it.d.body.rotation(); return Math.abs(r.x * it.q0[0] + r.y * it.q0[1] + r.z * it.q0[2] + r.w * it.q0[3]) < 0.9995; }

  // ---------------------------------------------------------------- per frame
  const _f = new THREE.Vector3(); let sweep = 0; const SWEEP_N = 40;
  function nearestMover(p) {
    const me = player.state.pos; let best = Math.hypot(me.x - p.x, me.z - p.z) < 1.7 && Math.abs(me.y + 0.9 - p.y) < 1.8 ? self() : null; let bd = best ? Math.hypot(me.x - p.x, me.z - p.z) : 1.7;
    for (const [id, r] of mp?.peers || []) { if (!r.pos) continue; const dd = Math.hypot(r.pos.x - p.x, r.pos.z - p.z); if (dd < bd && Math.abs(r.pos.y + 0.9 - p.y) < 1.8) { bd = dd; best = id; } }
    return best;
  }
  function update(dt) {
    // carry props in remote players' hands
    for (const [, h] of remoteHeld) {
      const r = mp?.peers?.get(h.peer); const d = h.it.d; if (!r || !d) continue;
      const rad = THREE.MathUtils.clamp(Math.max(h.it.size[0], h.it.size[2]) * 0.5, 0.12, 0.55);
      _f.set(r.pos.x - Math.sin(r.yaw) * (0.42 + rad), r.pos.y + 1.08 + h.it.size[1] * 0.1, r.pos.z - Math.cos(r.yaw) * (0.42 + rad));
      d.body.setNextKinematicTranslation({ x: _f.x, y: _f.y, z: _f.z });
    }
    // wake / sleep sweep (40 props a frame): who moved it, and the rest pose when it settles
    const list = items; const n = list.length; if (!n) return;
    for (let k = 0; k < SWEEP_N; k++) {
      sweep = (sweep + 1) % n; const it = list[sweep]; if (it.mode !== 'dynamic' || !it.d || it.d.dead || it.broken || it.heldBy) continue;
      const sl = it.d.body.isSleeping();
      if (!sl && !it.awake) { it.awake = true; it.d.sleepSkip = true; if (!it.lastMover) { const t = it.d.body.translation(); it.lastMover = nearestMover(t); if (it.lastMover) phys.claim(it.d.collider, { kind: 'pushed', id: it.id, by: it.lastMover }); } }
      else if (sl && it.awake) {
        it.awake = false; const owner = it.lastMover || (S.isHost() ? self() : null);
        it.lastMover = null; it.flying = 0; phys.unclaim(it.d.collider); try { it.d.body.enableCcd(false); } catch {}
        const t = it.d.body.translation(); const moved = Math.hypot(t.x - it.syncP[0], t.y - it.syncP[1], t.z - it.syncP[2]) > 0.01;
        if (owner === self() && moved && ch) { const { p, q } = poseOf(it.d); it.syncP = p; it.syncQ = q; send({ k: 'rest', id: it.id, p, q }); api.stats.sent++; }
      }
    }
  }
  api.update = update;
  return api;
}
