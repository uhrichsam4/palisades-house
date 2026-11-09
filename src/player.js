// Local player: Rapier kinematic character controller (capsule) with a person avatar (src/avatar.js).
// Third-person over-the-shoulder by default (character turns to face its travel); V toggles first-person. B waves (smooth follow, sphere-cast wall
// collision, mouse wheel zoom). WASD move, Shift run, Space jump, E use door.
// Swimming: inside a water body below its surface the creature floats (buoyancy), swims slowly in 3D
// (look direction + Space up / C down), dissolves into the pool and re-forms when it climbs out.
// Walking into dynamic props shoves them (KCC applies impulses).
// Seats (Re-create scenes, src/recreate.js): setSeat({pos, yaw, pose}) / setSeat(null); state.pose / state.seat.
// setSeat({..., vehicle}) = driving/riding: WASD no longer stands you up; the vehicle module updates state.seat.pos/yaw every frame and calls setSeat(null) to get out.
// state.frozen = true stops walking/jumping (video spots, src/videos.js, then drive the camera after update()).
import * as THREE from 'three';
import { createAvatar } from './avatar.js';
import { waterBodies } from './water/index.js';
import { identity } from './net/identity.js';

export function createPlayer(ctx, { spawn = [9.8, 0.05, 5.4], yaw = Math.PI } = {}) {
  const { phys, camera, dom } = ctx; const R = phys.RAPIER; const world = phys.world;
  const radius = 0.28, halfH = 0.55;
  const EYE_FP = 1.62;            // first-person eye height (adult)
  const PIVOT = 1.55;             // third-person orbit pivot height
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn[0], spawn[1] + halfH + radius, spawn[2]));
  const collider = world.createCollider(R.ColliderDesc.capsule(halfH, radius).setFriction(0.0), body);
  // collision groups (physics.js GROUPS, src/smash): the capsule is PLAYER; the controller walks on player-only RAMPs over
  // stairs and ignores PROPONLY colliders (real treads under a ramp, decor boxes) and anything whose filter drops PLAYER
  // (a held prop, debris). Dynamic props are pushed, never climbed (no autostep onto a chair = no snagging/hops).
  const GR = phys.GROUPS || { PLAYER: 0x2000, PROPONLY: 0x4000, RAMP: 0x8000, ALL: 0xFFFF };
  const grp = (m, f) => ((m & 0xFFFF) << 16 | (f & 0xFFFF)) >>> 0;
  collider.setCollisionGroups(grp(GR.PLAYER, GR.ALL));
  const KCC_GROUPS = grp(GR.PLAYER, GR.ALL & ~GR.PROPONLY);
  const CAM_GROUPS = grp(GR.ALL, GR.ALL & ~(GR.RAMP | GR.PROPONLY));
  const kccSkip = new Set(); // collider handles the controller must not collide with (state.ignore: e.g. the prop in your hands)
  const kccPred = (c) => !kccSkip.has(c.handle);
  const cc = world.createCharacterController(0.025);
  cc.enableAutostep(0.36, 0.15, false); cc.enableSnapToGround(0.42); cc.setSlideEnabled?.(true); cc.setMaxSlopeClimbAngle((50 * Math.PI) / 180); // step-up 0.36: stairs 0.197, theater riser 0.30, pool steps
  cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(70);

  const state = {
    yaw, pitch: -0.05, facing: yaw, vy: 0, grounded: false, thirdPerson: true, emote: 0, keys: new Set(), locked: false, speed: 0,
    pos: new THREE.Vector3(spawn[0], spawn[1], spawn[2]), vel: new THREE.Vector3(), swimming: false, inWater: false, water: null, waterY: 0,
    camDist: 3.0, camWant: 3.0, jumpQueued: false, autopilot: null,
    push: new THREE.Vector3(), aim: false, holding: false, ignore: kccSkip, // src/smash: knock-back velocity (decays), face the look direction, arms out, controller ignores
    pose: 'stand', seat: null, // seat = { pos:[x,y,z], yaw, pose } while sitting (see setSeat); pose goes out over the network
  };
  const me = identity();
  let creature = createAvatar(ctx, { hue: me.hue, name: me.name, local: true, seed: 11 }); // person avatar (seen in third-person / by others)
  const splashFns = [];
  const emitSplash = (x, y, z, s) => { for (const f of splashFns) { try { f(x, y, z, s); } catch (e) { console.warn(e); } } };

  // ---------------------------------------------------------------- input
  const onKey = (e, down) => {
    const k = e.code;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (!down) state.keys.delete(k); return; } if (down) state.keys.add(k); else state.keys.delete(k);
    if (down && e.repeat) return;
    if (down && k === 'KeyV') state.thirdPerson = !state.thirdPerson;
    if (down && k === 'KeyE') ctx.useNearest?.(state.pos);
    if (down && k === 'KeyB' && !state.frozen) state.emote = ((((state.emote / 4) | 0) + 1) % 250) * 4 + 1; // wave: counter seq*4 + kind 1 (H slick back = kind 2, src/emotes.js; synced: src/multiplayer.js field e)
    if (down && k === 'Space') state.jumpQueued = true;
    if (down && state.seat && !state.seat.vehicle && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) standUpReq = true;
  };
  let standUpReq = false;
  addEventListener('keydown', e => onKey(e, true)); addEventListener('keyup', e => onKey(e, false));
  addEventListener('blur', () => state.keys.clear());
  dom.addEventListener('click', () => { if (!state.locked && !ctx.uiBlocking?.()) dom.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === dom; ctx.onLockChange?.(state.locked); });
  addEventListener('mousemove', e => { if (!state.locked) return; const k = 0.0022 * (state.sens || 1); state.yaw -= e.movementX * k; state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * k, -1.45, 1.45); }); // state.sens: mouse sensitivity (settings)
  dom.addEventListener('wheel', e => { state.camWant = THREE.MathUtils.clamp(state.camWant * (1 + Math.sign(e.deltaY) * 0.12), 1.4, 6); }, { passive: true });
  // touch: left half = move stick, right half = look
  let touchMove = null, touchLook = null; const tm = new THREE.Vector2();
  dom.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && !touchMove) touchMove = { id: t.identifier, x: t.clientX, y: t.clientY }; else if (!touchLook) touchLook = { id: t.identifier, x: t.clientX, y: t.clientY }; } }, { passive: true });
  dom.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (touchMove && t.identifier === touchMove.id) tm.set((t.clientX - touchMove.x) / 60, (t.clientY - touchMove.y) / 60).clampScalar(-1, 1); if (touchLook && t.identifier === touchLook.id) { state.yaw -= (t.clientX - touchLook.x) * 0.005; state.pitch = THREE.MathUtils.clamp(state.pitch - (t.clientY - touchLook.y) * 0.005, -1.4, 1.4); touchLook.x = t.clientX; touchLook.y = t.clientY; } } }, { passive: true });
  dom.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (touchMove && t.identifier === touchMove.id) { touchMove = null; tm.set(0, 0); } if (touchLook && t.identifier === touchLook.id) touchLook = null; } });

  // ---------------------------------------------------------------- helpers
  function waterAt(x, y, z) {
    for (const w of waterBodies) { try { if (w.isInside(x, z)) { const s = w.heightAt(x, z); if (y < s + 0.05) return { w, y: s }; } } catch {} }
    return null;
  }
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3(), hv = new THREE.Vector3();
  const pivot = new THREE.Vector3(spawn[0], spawn[1] + PIVOT, spawn[2]); let pivotInit = false;
  const camShape = new R.Ball(0.16); const ROT0 = { x: 0, y: 0, z: 0, w: 1 };
  const CAM_FLAGS = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  // polish: the camera arm also stops on DYNAMIC furniture (coffee tables, ottomans, side tables made pushable by
  // furnish/smash) so the lens never ends up inside one; it still ignores the prop in your hands (kccSkip) and small
  // dynamic props (< 8 kg: pillows, books, balls) so those don't make the camera jitter. The predicate only runs
  // for colliders the broad phase already found along the arm (a handful), so no measurable per-frame cost.
  const NEAR0 = camera.near; let nearSet = NEAR0;
  /* only touches camera.near if player.js set it last (cars / photo views may own it otherwise) */
  const setNear = (n) => { if (camera.near === n || (camera.near !== nearSet && camera.near !== NEAR0)) return; nearSet = n; camera.near = n; camera.updateProjectionMatrix(); };
  const CAM_ARM_FLAGS =R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const camPred = (c) => {
    if (kccSkip.has(c.handle)) return false;
    const b = c.parent(); if (!b || !b.isDynamic()) return true;
    return b.mass() >= 8;
  };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ'); const back = new THREE.Vector3();
  let disturbT = 0, frameMs = 0, lastSwimBlocked = 0, climbOut = 0; const climbDir = new THREE.Vector3();

  function update(dt) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.05); if (dt <= 0) return;
    if (standUpReq) { standUpReq = false; if (state.seat) setSeat(null); }
    if (state.seat) { seatedUpdate(dt); frameMs = performance.now() - t0; return; }
    const k = state.keys; let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz += 1; if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (ctx.uiBlocking?.()) { mx = 0; mz = 0; k.clear(); }
    mx += tm.x; mz -= tm.y;
    if (state.autopilot) { const a = state.autopilot(dt, state); if (a) { mx = a.mx ?? mx; mz = a.mz ?? mz; if (a.run !== undefined) k[a.run ? 'add' : 'delete']('ShiftLeft'); if (a.jump) state.jumpQueued = true; } }
    if (state.frozen) { mx = 0; mz = 0; state.jumpQueued = false; } // video spots (src/videos.js) own the camera
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)); right.set(-fwd.z, 0, fwd.x);
    wish.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx); if (wish.lengthSq() > 1) wish.normalize();

    // ---- water state (hysteresis on feet depth)
    const p = state.pos; const wt = waterAt(p.x, p.y, p.z); const depth = wt ? wt.y - p.y : -1;
    const wasIn = state.inWater, wasSwim = state.swimming;
    state.inWater = !!wt && depth > 0.02; state.water = wt?.w || null; state.waterY = wt?.y ?? 0;
    if (!state.swimming && wt && depth > 1.0 && climbOut <= 0 && !(state.vy > 2)) state.swimming = true;
    else if (state.swimming && (!wt || depth < 0.7)) state.swimming = false;
    if (state.inWater && !wasIn && state.vy < -1.2) { const s = Math.min(3, -state.vy * 0.55); try { wt.w.splash(p.x, wt.y, p.z, s); wt.w.disturb(p.x, p.z, 0.8, s); } catch {} emitSplash(p.x, wt.y, p.z, s); }
    if (wasSwim && !state.swimming && wt) { try { wt.w.splash(p.x, wt.y, p.z, 0.7); } catch {} }

    let mvx, mvy, mvz;
    const wishLen = Math.hypot(mx, mz);
    if (state.swimming) {
      // slow 3D swimming along the look direction, buoyancy holds the head at the surface
      const sp = (run ? 2.1 : 1.3) * (state.speedMul ?? 1); const cp = Math.cos(state.pitch), spch = Math.sin(state.pitch);
      const wx = (-Math.sin(state.yaw) * cp) * mz + right.x * mx, wz = (-Math.cos(state.yaw) * cp) * mz + right.z * mx;
      let wy = state.thirdPerson ? 0 : spch * mz; // third-person: stay at the surface unless C/Ctrl dives (Space rises) if (k.has('Space')) wy += 1; if (k.has('KeyC') || k.has('ControlLeft')) wy -= 1;
      const a = 1 - Math.exp(-dt * 2.2);
      state.vel.x += (wx * sp - state.vel.x) * a; state.vel.z += (wz * sp - state.vel.z) * a;
      const target = wt.y - 1.42 + Math.sin(performance.now() * 0.0021) * 0.035; // head just above the surface, gentle bob
      if (Math.abs(wy) > 0.1) state.vy += (wy * sp - state.vy) * a + (wy < 0 ? 0 : 0);
      else state.vy += ((target - p.y) * 7 - state.vy * 3.2) * dt;
      // climb out: Space at the surface kicks up and out
      if (state.jumpQueued && p.y > target - 0.25) { state.vy = 5.1; state.swimming = false; try { wt.w.splash(p.x, wt.y, p.z, 1.2); } catch {} }
      // pool edge: swimming into the wall at the surface with the deck just above -> climb out
      if (state.swimming && wishLen > 0.3 && p.y > target - 0.3 && lastSwimBlocked > 0.15) {
        const dx = state.vel.x, dz = state.vel.z, l = Math.hypot(dx, dz) || 1; const ax = p.x + dx / l * 0.75, az = p.z + dz / l * 0.75;
        const hit = world.castRay(new R.Ray({ x: ax, y: wt.y + 1.2, z: az }, { x: 0, y: -1, z: 0 }), 1.6, true, CAM_FLAGS, undefined, collider);
        const deckY = hit ? wt.y + 1.2 - hit.timeOfImpact : null;
        if (deckY !== null && deckY > wt.y - 0.1 && deckY < wt.y + 0.8) {
          state.vy = Math.sqrt(2 * 9.81 * (deckY - p.y + 0.35)); state.swimming = false; climbOut = 0.6; climbDir.set(dx / l, 0, dz / l);
          try { wt.w.splash(p.x, wt.y, p.z, 1.0); } catch {}
        }
        lastSwimBlocked = 0;
      }
      state.vy = THREE.MathUtils.clamp(state.vy, -2.5, 8);
      mvx = state.vel.x * dt; mvy = state.vy * dt; mvz = state.vel.z * dt;
    } else {
      const sp = (run ? 5.2 : 2.6) * (state.inWater ? 0.6 : 1) * (state.speedMul ?? 1); // state.speedMul: src/cold (freezing slows you)
      const accel = state.grounded ? 12 : 2.5; const a = 1 - Math.exp(-dt * accel);
      state.vel.x += (wish.x * sp - state.vel.x) * a; state.vel.z += (wish.z * sp - state.vel.z) * a;
      if (climbOut > 0) { climbOut -= dt; state.vel.x = climbDir.x * 1.6; state.vel.z = climbDir.z * 1.6; }
      if (state.grounded && state.jumpQueued) state.vy = 4.8;
      state.vy -= 9.81 * dt * (state.inWater ? 0.55 : 1); if (state.grounded && state.vy < 0) state.vy = -0.5;
      mvx = state.vel.x * dt; mvy = state.vy * dt; mvz = state.vel.z * dt;
    }
    state.jumpQueued = false;
    // knock-back (a shove from another player, src/smash): added on top, decays in ~0.3 s
    if (state.push.lengthSq() > 1e-4) { mvx += state.push.x * dt; mvz += state.push.z * dt; if (state.push.y > 0 && state.grounded) { state.vy = Math.max(state.vy, state.push.y); state.push.y = 0; } state.push.multiplyScalar(Math.exp(-dt * 6)); }

    cc.computeColliderMovement(collider, { x: mvx, y: mvy, z: mvz }, R.QueryFilterFlags.EXCLUDE_SENSORS, KCC_GROUPS, kccSkip.size ? kccPred : undefined);
    const m = cc.computedMovement(); const t = body.translation();
    let nx = t.x + m.x, ny = t.y + m.y, nz = t.z + m.z;
    if (ny < -30) { nx = spawn[0]; ny = spawn[1] + 1; nz = spawn[2]; state.vy = 0; }
    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    const groundedNow = cc.computedGrounded();
    if (groundedNow && !state.grounded && state.vy < -6) { /* hard landing: the fluid sim squashes + splashes */ }
    state.grounded = groundedNow && !state.swimming;
    // real velocity from the resolved movement (what the fluid and the network see)
    const iv = 1 / dt; const rvx = m.x * iv, rvy = m.y * iv, rvz = m.z * iv;
    if (state.swimming) { const want = Math.hypot(mvx, mvz), got = Math.hypot(m.x, m.z); lastSwimBlocked = want > 0.004 && got < want * 0.35 ? lastSwimBlocked + dt : 0; }
    if (!state.swimming) { state.vel.x = rvx; state.vel.z = rvz; if (state.grounded) state.vy = Math.min(state.vy, Math.max(-0.5, rvy)); else if (rvy > state.vy + 0.5 || (state.vy > 0 && m.y < mvy * 0.5)) state.vy = rvy; }
    state.speed = Math.hypot(rvx, rvz);
    state.pos.set(nx, ny - halfH - radius, nz);
    state.velOut = state.velOut || new THREE.Vector3(); state.velOut.set(rvx, state.swimming ? rvy : (state.grounded ? 0 : state.vy), rvz);

    // swimming ripples
    if (state.inWater && wt) { disturbT -= dt; if (disturbT <= 0 && state.speed > 0.25) { disturbT = 0.09; try { wt.w.disturb(p.x, p.z, 0.45, Math.min(1, state.speed * 0.35)); } catch {} } }

    // ---- facing: third-person turns toward travel, first-person = look yaw
    if (state.thirdPerson && state.aim) { let d = state.yaw - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); state.facing += d * (1 - Math.exp(-dt * 14)); } // holding / punching: face where you look
    else if (state.thirdPerson) {
      if (state.speed > 0.3) { const want = Math.atan2(-rvx, -rvz); let d = want - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); state.facing += d * (1 - Math.exp(-dt * 9)); }
    } else state.facing = state.yaw;

    // ---- creature
    creature.setVisible(state.thirdPerson && state.camDist > 0.8);
    creature.update(dt, { pos: state.pos, vel: state.velOut, yaw: state.facing, grounded: state.grounded, swimming: state.swimming, pose: 'stand', emote: state.emote, hold: state.holding });

    // ---- camera
    euler.set(state.pitch, state.yaw, 0, 'YXZ');
    if (state.thirdPerson) {
      const tgt = _v.set(state.pos.x, state.pos.y + PIVOT, state.pos.z);
      if (!pivotInit) { pivot.copy(tgt); pivotInit = true; }
      const ah = 1 - Math.exp(-dt * 14), av = 1 - Math.exp(-dt * 7);
      pivot.x += (tgt.x - pivot.x) * ah; pivot.z += (tgt.z - pivot.z) * ah; pivot.y += (tgt.y - pivot.y) * av;
      back.set(0, 0, 1).applyEuler(euler);
      // over the shoulder: 0.38 m to the camera's right (ray-checked so it never pokes through a wall)
      { const rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw); let so = 0.38;
        const sh = world.castShape({ x: pivot.x, y: pivot.y, z: pivot.z }, ROT0, { x: rx, y: 0, z: rz }, camShape, 0.0, so, true, CAM_ARM_FLAGS, CAM_GROUPS, collider, undefined, camPred);
        if (sh) so = Math.max(0, sh.time_of_impact - 0.04); shoulder += (so - shoulder) * (1 - Math.exp(-dt * 8));
        pivot2.set(pivot.x + rx * shoulder, pivot.y, pivot.z + rz * shoulder); }
      let d = state.camWant;
      const hit = world.castShape({ x: pivot2.x, y: pivot2.y, z: pivot2.z }, ROT0, { x: back.x, y: back.y, z: back.z }, camShape, 0.0, state.camWant, true, CAM_ARM_FLAGS, CAM_GROUPS, collider, undefined, camPred);
      if (hit) d = Math.max(0.25, hit.time_of_impact - 0.04);
      state.camDist = d < state.camDist ? d : state.camDist + (d - state.camDist) * (1 - Math.exp(-dt * 3));
      // boxed in (back to a wall): fall back to an eye-level view instead of jamming the lens into the wall
      const close = THREE.MathUtils.clamp((state.camDist - 0.55) / 0.35, 0, 1);
      camera.position.copy(pivot2).addScaledVector(back, state.camDist * close);
      if (close < 1) camera.position.y += (state.pos.y + EYE_FP - camera.position.y) * (1 - close);
      camera.quaternion.setFromEuler(euler);
      // polish: near fade — when the arm is pulled in by something, push the near plane to 0.1 m (the 0.16 m cast
      // ball keeps hit surfaces further than that) so slivers of furniture beside the lens are clipped instead of
      // filling the frame. Projection only rebuilt when the value flips.
      setNear(state.camDist < state.camWant - 0.2 ? 0.1 : NEAR0);
    } else {
      setNear(NEAR0);
      pivotInit = false;
      camera.position.set(state.pos.x, state.pos.y + EYE_FP, state.pos.z);
      camera.quaternion.setFromEuler(euler);
    }
    frameMs = performance.now() - t0;
  }
  const _v = new THREE.Vector3(), pivot2 = new THREE.Vector3(); let shoulder = 0;

  // ---------------------------------------------------------------- seats (Re-create scenes)
  // setSeat({ pos, yaw, pose, bounds? }) freezes physics movement at the seat (collider off, so the sofa's
  // box doesn't fight the capsule), camera at seated eye height looking along yaw (mouse-look still works).
  // setSeat(null) stands up: teleports to a free, collider-clear spot in front of the seat (or back where
  // the player was). WASD/Space while seated stand up too. onSeatChange(fn(seat|null)) is notified.
  const SEAT_EYE = { sit: 1.0, lie: 0.3, lean: 1.58, stand: EYE_FP };
  const seatFns = []; let preSeat = null;
  const capQ = new R.Capsule(halfH, radius);
  function spotFree(x, floorY, z) {
    let hit = false;
    world.intersectionsWithShape({ x, y: floorY + 0.06 + radius + halfH, z }, ROT0, capQ, (c) => {
      if (c.handle === collider.handle) return true;
      const b = c.parent(); if (b && !b.isFixed()) return true; // ignore props, other players
      hit = true; return false;
    });
    return !hit;
  }
  function freeSpotNear(seat) {
    const [sx, sy, sz] = seat.pos; const fx = -Math.sin(seat.yaw), fz = -Math.cos(seat.yaw);
    const floorY = preSeat ? preSeat.y : (seat.pose === 'stand' || seat.pose === 'lean' ? sy : Math.max(0, sy - 0.45));
    const b = seat.bounds; const inB = (x, z) => !b || (x >= b[0] + 0.3 && x <= b[2] - 0.3 && z >= b[1] + 0.3 && z <= b[3] - 0.3);
    try { world.updateSceneQueries?.(); } catch {}
    // candidates in front of the seat, nearest first; a spot must be clear AND have a clear neighbour 0.4 m
    // further out (front or sideways) so the player isn't left wedged in a pocket between furniture
    const cands = [];
    for (const d of [0.55, 0.75, 0.95, 1.2, 1.5, 1.9]) for (const l of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) cands.push([d, l, d + Math.abs(l) * 0.7]);
    cands.sort((a, b) => a[2] - b[2]);
    const at = (d, l) => [sx + fx * d + fz * l, sz + fz * d - fx * l]; // l: sideways (right-hand perpendicular)
    const ok = (d, l) => { const [x, z] = at(d, l); return inB(x, z) && spotFree(x, floorY, z); };
    for (const [d, l] of cands) {
      if (!ok(d, l)) continue;
      if (ok(d + 0.4, l) || ok(d, l + 0.4) || ok(d, l - 0.4)) { const [x, z] = at(d, l); return [x, floorY, z]; }
    }
    if (preSeat && spotFree(preSeat.x, preSeat.y, preSeat.z)) return [preSeat.x, preSeat.y, preSeat.z];
    return preSeat ? [preSeat.x, preSeat.y, preSeat.z] : [sx + fx, floorY, sz + fz];
  }
  function setSeat(seat) {
    if (seat) {
      if (!state.seat) preSeat = state.pos.clone();
      state.seat = { pos: [...seat.pos], yaw: seat.yaw, pose: seat.pose || 'sit', bounds: seat.bounds, vehicle: seat.vehicle || null }; // vehicle: WASD drives (src/cars/) instead of standing up; the car moves seat.pos / seat.yaw
      state.pose = state.seat.pose; collider.setEnabled(false);
      state.pos.set(...seat.pos); state.vel.set(0, 0, 0); state.vy = 0; state.yaw = seat.yaw; state.facing = seat.yaw; state.pitch = -0.08;
      state.swimming = false; state.inWater = false; state.grounded = true; pivotInit = false;
      body.setTranslation({ x: seat.pos[0], y: seat.pos[1] + halfH + radius, z: seat.pos[2] }, true);
    } else if (state.seat) {
      const old = state.seat; state.seat = null; state.pose = 'stand'; collider.setEnabled(true);
      const [x, y, z] = freeSpotNear(old); preSeat = null;
      teleport(x, y, z);
    } else return;
    for (const f of seatFns) { try { f(state.seat); } catch (e) { console.warn(e); } }
  }
  function seatedUpdate(dt) {
    const s = state.seat; state.pos.set(...s.pos); state.vel.set(0, 0, 0); state.speed = 0; state.facing = s.yaw;
    state.velOut = state.velOut || new THREE.Vector3(); state.velOut.set(0, 0, 0);
    body.setNextKinematicTranslation({ x: s.pos[0], y: s.pos[1] + halfH + radius, z: s.pos[2] });
    creature.setVisible(state.thirdPerson && state.camDist > 0.8);
    creature.update(dt, { pos: state.pos, vel: state.velOut, yaw: s.yaw, grounded: true, swimming: false, pose: s.pose, emote: state.emote });
    const eye = SEAT_EYE[s.pose] ?? EYE_FP;
    euler.set(state.pitch, state.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(euler);
    camera.position.set(s.pos[0], s.pos[1] + eye, s.pos[2]);
    if (state.thirdPerson) {
      back.set(0, 0, 1).applyEuler(euler); const piv = _v.copy(camera.position);
      let d = state.camWant; const hit = world.castShape({ x: piv.x, y: piv.y, z: piv.z }, ROT0, { x: back.x, y: back.y, z: back.z }, camShape, 0.0, state.camWant, true, CAM_ARM_FLAGS, CAM_GROUPS, collider, undefined, camPred);
      if (hit) d = Math.max(0.25, hit.time_of_impact - 0.04); state.camDist = d;
      camera.position.addScaledVector(back, d);
    }
  }
  function teleport(x, y, z, yaw2) {
    if (state.seat) { state.seat = null; state.pose = 'stand'; preSeat = null; collider.setEnabled(true); for (const f of seatFns) { try { f(null); } catch {} } }
    body.setTranslation({ x, y: y + halfH + radius, z }, true); body.setNextKinematicTranslation({ x, y: y + halfH + radius, z });
    state.pos.set(x, y, z); state.vel.set(0, 0, 0); state.vy = 0; pivotInit = false;
    if (yaw2 !== undefined) { state.yaw = yaw2; state.facing = yaw2; }
  }
  return {
    update, state, body, collider, teleport, setSeat,
    get creature() { return creature; },
    // swap the avatar (custom models, src/avatars/sync.js); the old one is disposed
    setCreature(av) { if (!av || av === creature) return; const old = creature; creature = av; av.setPose?.(state.pose || 'stand'); try { old.dispose(); } catch {} },
    onSeatChange(fn) { seatFns.push(fn); },
    onSplash(fn) { splashFns.push(fn); },
    get position() { return state.pos; }, get velocity() { return state.velOut || state.vel; },
    get frameMs() { return frameMs; },
  };
}
