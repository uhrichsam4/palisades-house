// Pick up, hold, throw, punch (src/smash).
//   Look at a dynamic prop <= 25 kg within reach -> E::PICK UP (ctx.interact). Holding: the prop floats in front of
//   you (velocity-steered, gravity off, still collides with the house; it ignores your own capsule), your avatar faces
//   the look direction and reaches out with both arms. Hold LMB to charge (ring round the crosshair), release to
//   throw: impulse 8–70 N·s scaled by charge, speed = impulse / mass (a 4 kg rock flies ~17 m/s, an 8 kg chair ~9),
//   aimed at what the crosshair points at with a ballistic lift. RMB or E drops.
//   LMB with empty hands = punch: jab animation, 0.15 s later a short sweep (~1.3 m) from the chest: props get a push,
//   anything registered with the damage model takes damage.hit(25 N·s), other players get shoved (their client applies it).
//   Not while in a game, a car, photo mode, a menu or a seat.
import * as THREE from 'three';
import { nextEmote } from '../avatars/anim.js';
import { PICKUP_MAX_KG } from './classify.js';

const PUNCH_NS = 25, REACH = 2.4;

export function createHands(S) {
  const { ctx, phys, player, damage, sound, byHandle } = S; const R = phys.RAPIER, world = phys.world, G = phys.GROUPS;
  const camera = ctx.camera; const st = player.state;
  const HELD_GROUPS = phys.groups(G.ALL, G.ALL & ~(G.RAMP | G.PLAYER));
  const QUERY_GROUPS = phys.groups(G.ALL, G.ALL & ~G.RAMP);
  let held = null, charging = null, cand = null, candPos = new THREE.Vector3(), scanAcc = 0, punchAt = -1, punchCool = 0, aimT = 0;
  const target = new THREE.Vector3(); let farT = 0;

  // ---------------------------------------------------------------- ui: charge ring
  const ring = document.createElement('div'); ring.id = 'smash-ring';
  ring.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg"/></svg>';
  document.body.appendChild(ring); const fg = ring.querySelector('.fg'); const CIRC = 2 * Math.PI * 18;
  const css = document.createElement('style'); css.textContent = `
#smash-ring{position:fixed;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;z-index:39;opacity:0;transform:scale(.9);transition:opacity .15s var(--ease-soft,ease-out),transform .3s var(--ease-out-expo,ease-out)}
#smash-ring.on{opacity:1;transform:scale(1)}
#smash-ring svg{transform:rotate(-90deg)}
#smash-ring circle{fill:none;stroke-width:2.5}
#smash-ring .bg{stroke:rgba(247,247,247,.16)}
#smash-ring .fg{stroke:#f2c84b;stroke-linecap:round;stroke-dasharray:${CIRC};stroke-dashoffset:${CIRC}}
#smash-ring.full .fg{stroke:#f7f7f7}
body.shot #smash-ring,body.menu-open #smash-ring,body.paused #smash-ring,body.photo #smash-ring{display:none!important}`;
  document.head.appendChild(css);
  let ringShown = -1;
  function showRing(k) { // k: null hide, else 0..1
    const v = k === null ? -1 : Math.round(k * 50) / 50; if (v === ringShown) return; ringShown = v;
    ring.classList.toggle('on', k !== null); ring.classList.toggle('full', k !== null && k >= 0.99);
    if (k !== null) fg.style.strokeDashoffset = String(CIRC * (1 - k));
  }

  // ---------------------------------------------------------------- may I act?
  function inGame() { const g = window.__games; if (!g) return false; try { if (typeof g.active === 'function') return !!g.active(); return g.phase === 'play' && !!g.in; } catch { return false; } }
  function allowed() {
    const b = document.body.classList;
    if (b.contains('menu-open') || b.contains('paused') || b.contains('ui-open') || b.contains('photo') || b.contains('driving') || b.contains('watching') || b.contains('shot')) return false;
    if (st.seat || st.frozen || st.swimming) return false;
    if (inGame()) return false;
    return true;
  }

  // ---------------------------------------------------------------- look-at target (15 Hz)
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _v = new THREE.Vector3();
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  function scan() {
    cand = null; if (held || !allowed()) return;
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    ray.origin.x = _o.x; ray.origin.y = _o.y; ray.origin.z = _o.z; ray.dir.x = _d.x; ray.dir.y = _d.y; ray.dir.z = _d.z;
    const max = (st.thirdPerson ? st.camDist : 0) + 3.2;
    const h = world.castRay(ray, max, true, R.QueryFilterFlags.EXCLUDE_SENSORS, QUERY_GROUPS, player.collider); if (!h) return;
    const toi = h.timeOfImpact ?? h.toi; const col = h.collider; const it = byHandle.get(col.handle);
    if (!it || it.mode !== 'dynamic' || it.broken || !it.d || it.heldBy || it.mass > PICKUP_MAX_KG) return;
    candPos.set(_o.x + _d.x * toi, _o.y + _d.y * toi, _o.z + _d.z * toi);
    _c.copy(st.pos); _c.y += 1.0; if (_c.distanceTo(candPos) > REACH) return;
    cand = it;
  }
  const offIx = ctx.interact?.add({ id: 'smash:pick', pos: () => (cand ? candPos : null), radius: 0.6, range: REACH + 0.3, label: () => (cand ? 'PICK UP' : ''), use: () => { if (cand) pickUp(cand); }, enabled: () => !!cand && !held });

  // ---------------------------------------------------------------- hold
  const modal = { label: () => 'DROP', use: () => { release(); return true; } };
  function pickUp(it, { remoteEcho = true } = {}) {
    if (!it || it.broken || !it.d || it.heldBy || held || it.mass > PICKUP_MAX_KG) return false;
    const d = it.d; d.body.wakeUp(); d.body.setGravityScale(0, true); d.collider.setCollisionGroups(HELD_GROUPS);
    d.sleepSkip = false; d.body.setLinearDamping(2); d.body.setAngularDamping(6);
    st.ignore?.add(d.collider.handle); st.holding = true; st.aim = true; try { d.body.enableCcd(true); } catch {} // contain: no tunnelling while carried
    held = { it, d, t: 0 }; it.heldBy = S.selfId(); it.lastMover = S.selfId(); farT = 0;
    phys.claim(d.collider, { kind: 'held', id: it.id, by: S.selfId() });
    if (ctx.interact) ctx.interact.modal = modal;
    sound.play('thud', d.body.translation(), 0.25, 1.4);
    if (remoteEcho) S.net?.sendHold(it);
    return true;
  }
  function release(silent = false, vel = null) {
    if (!held) return null; const { it, d } = held; held = null; charging = null; showRing(null);
    st.holding = false; st.aim = aimT > 0; st.ignore?.delete(d.collider.handle);
    if (ctx.interact?.modal === modal) ctx.interact.modal = null;
    it.heldBy = null;
    if (!it.broken && it.d === d) {
      d.body.setGravityScale(1, true); d.body.setLinearDamping(0.12); d.body.setAngularDamping(0.35); d.collider.setCollisionGroups(S.prep.PROP_GROUPS);
      if (vel) d.body.setLinvel(vel, true);
      if (!silent) S.net?.sendDrop(it);
    }
    return it;
  }
  // target in front of the hands (third person: in front of the chest along the look yaw; first person: lower right of view)
  const holdRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), HOLD_FLAGS = R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  function holdTarget(it) {
    const r = THREE.MathUtils.clamp(Math.max(it.size[0], it.size[2]) * 0.5, 0.12, 0.55);
    if (st.thirdPerson) { const y = st.yaw; target.set(st.pos.x - Math.sin(y) * (0.42 + r), st.pos.y + 1.08 + Math.sin(st.pitch) * 0.35 + it.size[1] * 0.1, st.pos.z - Math.cos(y) * (0.42 + r)); }
    else { camera.getWorldDirection(_d); camera.getWorldPosition(_o); const rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw); target.copy(_o).addScaledVector(_d, 0.5 + r).add(_v.set(rx * 0.16, -0.24, rz * 0.16)); }
    // contain pass: never hold a prop on the far side of a wall: ray from the chest to the hold point (fixed colliders),
    // pull the point back to just in front of the hit
    const ox = st.pos.x, oy = st.pos.y + 1.08, oz = st.pos.z; let dx = target.x - ox, dy = target.y - oy, dz = target.z - oz; const L = Math.hypot(dx, dy, dz);
    if (L > 1e-3) { dx /= L; dy /= L; dz /= L; holdRay.origin.x = ox; holdRay.origin.y = oy; holdRay.origin.z = oz; holdRay.dir.x = dx; holdRay.dir.y = dy; holdRay.dir.z = dz;
      let h = null; try { h = world.castRay(holdRay, L + r, true, HOLD_FLAGS, undefined, player.collider); } catch {}
      if (h) { const d = Math.max(0.05, (h.timeOfImpact ?? h.toi) - r - 0.03); if (d < L) target.set(ox + dx * d, oy + dy * d, oz + dz * d); } }
    return target;
  }
  phys.onStep(() => {
    if (!held) return; const { it, d } = held; if (it.broken || it.d !== d) { release(true); return; }
    const t = d.body.translation(); const k = 14 * THREE.MathUtils.clamp(5 / it.mass, 0.35, 1); const vmax = 9;
    let vx = (target.x - t.x) * k, vy = (target.y - t.y) * k, vz = (target.z - t.z) * k; const L = Math.hypot(vx, vy, vz); if (L > vmax) { vx *= vmax / L; vy *= vmax / L; vz *= vmax / L; }
    d.body.setLinvel({ x: vx + player.velocity.x * 0.9, y: vy, z: vz + player.velocity.z * 0.9 }, true);
    const w = d.body.angvel(); d.body.setAngvel({ x: w.x * 0.7, y: w.y * 0.7, z: w.z * 0.7 }, true);
  });

  // ---------------------------------------------------------------- throw
  function aimPoint() {
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    ray.origin.x = _o.x; ray.origin.y = _o.y; ray.origin.z = _o.z; ray.dir.x = _d.x; ray.dir.y = _d.y; ray.dir.z = _d.z;
    const ex = held?.d.collider; const h = world.castRay(ray, 60, true, R.QueryFilterFlags.EXCLUDE_SENSORS, QUERY_GROUPS, player.collider, undefined, ex ? (c) => c.handle !== ex.handle : undefined);
    const toi = h ? Math.max(1.2, h.timeOfImpact ?? h.toi) : 40; return new THREE.Vector3(_o.x + _d.x * toi, _o.y + _d.y * toi, _o.z + _d.z * toi);
  }
  function throwHeld(charge = 1, aim = null) {
    if (!held) return null; const { it, d } = held;
    const J = 8 + 62 * Math.pow(THREE.MathUtils.clamp(charge, 0, 1), 1.2); const speed = THREE.MathUtils.clamp(J / it.mass, 2, 22);
    const p = d.body.translation(); const P = aim || aimPoint(); const dir = _v.set(P.x - p.x, P.y - p.y, P.z - p.z); const dist = dir.length(); dir.normalize();
    const lift = Math.min(0.5 * 9.81 * dist / speed, speed * 0.6); // ballistic: arrive at the crosshair point
    const vel = { x: dir.x * speed + player.velocity.x * 0.5, y: dir.y * speed + lift, z: dir.z * speed + player.velocity.z * 0.5 };
    release(true, vel);
    d.body.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 6 }, true);
    d.body.enableCcd(true); // contain: every thrown prop (was < 6 kg only); net.js turns it off when it settles
    phys.claim(d.collider, { kind: 'thrown', id: it.id, by: S.selfId() }); it.lastMover = S.selfId(); it.flying = performance.now();
    st.emote = nextEmote(st.emote, 5); aimT = 0.5; st.aim = true;
    sound.play('whoosh', p, 0.3 + charge * 0.5, 1.4 - Math.min(0.6, it.mass / 40));
    S.net?.sendThrow(it);
    return { id: it.id, speed: +speed.toFixed(2), vel };
  }

  // ---------------------------------------------------------------- punch
  const _ball = new R.Ball(0.16); const ROT0 = { x: 0, y: 0, z: 0, w: 1 };
  function punch() {
    if (held || punchCool > 0 || !allowed()) return false;
    st.emote = nextEmote(st.emote, 4); punchAt = 0.15; punchCool = 0.5; aimT = 0.6; st.aim = true; return true;
  }
  function punchHit() {
    camera.getWorldDirection(_d); if (st.thirdPerson) { _d.y = Math.max(-0.5, Math.min(0.5, _d.y)); _d.normalize(); }
    const o = { x: st.pos.x, y: st.pos.y + 1.3, z: st.pos.z };
    const hit = world.castShape(o, ROT0, { x: _d.x, y: _d.y, z: _d.z }, _ball, 0.0, 1.15, true, R.QueryFilterFlags.EXCLUDE_SENSORS, QUERY_GROUPS, player.collider);
    const res = { hit: null };
    if (!hit) { sound.play('whoosh', o, 0.18, 1.8); S.lastPunch = res; return res; }
    const col = hit.collider; const toi = hit.time_of_impact ?? hit.timeOfImpact ?? 0;
    const pt = new THREE.Vector3(o.x + _d.x * (toi + 0.16), o.y + _d.y * (toi + 0.16), o.z + _d.z * (toi + 0.16));
    const dir = { x: _d.x, y: _d.y, z: _d.z };
    // another player?
    for (const [id, r] of S.mp?.peers || []) if (r.collider?.handle === col.handle) { S.net?.sendShove(id, dir); sound.play('punch', pt, 0.9); res.hit = 'player:' + id; S.lastPunch = res; return res; }
    const it = byHandle.get(col.handle);
    if (it && it.mode === 'dynamic' && it.d && !it.broken) {
      const J = Math.min(PUNCH_NS, it.mass * 4.5); const imp = { x: dir.x * J, y: dir.y * J + J * 0.25, z: dir.z * J };
      it.d.body.applyImpulseAtPoint(imp, { x: pt.x, y: pt.y, z: pt.z }, true); it.lastMover = S.selfId(); phys.claim(it.d.collider, { kind: 'punch', id: it.id, by: S.selfId() });
      S.net?.sendImpulse(it, imp, pt);
    }
    sound.play('punch', pt, 0.8);
    damage.hit(col.handle, PUNCH_NS, { by: S.selfId(), point: pt, dir, source: { kind: 'punch' } });
    res.hit = it ? it.id : (damage.ofCollider(col.handle)?.id || 'world'); S.lastPunch = res;
    return res;
  }

  // ---------------------------------------------------------------- input
  addEventListener('mousedown', (e) => {
    if (!st.locked || !allowed()) return;
    if (e.button === 0) { if (held) charging = { t: 0 }; else punch(); }
    else if (e.button === 2 && held) release();
  });
  addEventListener('mouseup', (e) => { if (e.button !== 0 || !charging || !held) return; const k = Math.min(1, charging.t / 1.0); charging = null; showRing(null); throwHeld(k); });
  addEventListener('contextmenu', (e) => { if (st.locked) e.preventDefault(); });

  function update(dt) {
    scanAcc += dt; if (scanAcc > 1 / 15) { scanAcc = 0; scan(); }
    if (punchCool > 0) punchCool -= dt;
    if (punchAt >= 0) { punchAt -= dt; if (punchAt < 0) { punchAt = -1; punchHit(); } }
    if (aimT > 0) { aimT -= dt; if (aimT <= 0 && !held) st.aim = false; }
    if (held) {
      if (!allowed() && !document.body.classList.contains('ui-open')) { release(); return; }
      holdTarget(held.it);
      const t = held.d.body.translation(); const far = Math.hypot(t.x - target.x, t.y - target.y, t.z - target.z) > 1.4; farT = far ? farT + dt : 0; if (farT > 0.35) release();
      if (charging) { charging.t += dt; showRing(Math.min(1, charging.t / 1.0)); }
    }
  }

  return {
    update, pickUp: (idOrIt) => pickUp(typeof idOrIt === 'string' ? S.byId.get(idOrIt) : idOrIt), release, throwHeld, punch, punchHit, allowed,
    get heldItem() { return held?.it || null; }, get candidate() { return cand?.id || null; }, chargeRing: showRing, dispose: () => offIx?.(),
  };
}
