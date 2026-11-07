// Local player: Rapier kinematic character controller (capsule), first/third-person camera,
// WASD + mouse look (pointer lock), Shift run, Space jump, E use door, V toggle camera.
// The visible avatar (water creature) is provided by ctx.avatar if present (see src/fluid/).
import * as THREE from 'three';

export function createPlayer(ctx, { spawn = [9.8, 0.05, 5.4], yaw = Math.PI } = {}) {
  const { phys, camera, dom } = ctx; const R = phys.RAPIER; const world = phys.world;
  const radius = 0.28, halfH = 0.55, eye = 1.62;
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn[0], spawn[1] + halfH + radius, spawn[2]));
  const collider = world.createCollider(R.ColliderDesc.capsule(halfH, radius).setFriction(0.0), body);
  const cc = world.createCharacterController(0.02);
  cc.enableAutostep(0.26, 0.18, true); cc.enableSnapToGround(0.3); cc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(70);
  const state = { yaw, pitch: 0, vy: 0, grounded: false, thirdPerson: false, keys: new Set(), locked: false, speed: 0, pos: new THREE.Vector3() };

  const onKey = (e, down) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.code; if (down) state.keys.add(k); else state.keys.delete(k);
    if (down && k === 'KeyV') state.thirdPerson = !state.thirdPerson;
    if (down && k === 'KeyE') ctx.useNearest?.(state.pos);
  };
  addEventListener('keydown', e => onKey(e, true)); addEventListener('keyup', e => onKey(e, false));
  dom.addEventListener('click', () => { if (!state.locked && !ctx.uiBlocking?.()) dom.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === dom; ctx.onLockChange?.(state.locked); });
  addEventListener('mousemove', e => { if (!state.locked) return; state.yaw -= e.movementX * 0.0022; state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * 0.0022, -1.45, 1.45); });
  // touch: left half = move stick, right half = look
  let touchMove = null, touchLook = null; const tm = new THREE.Vector2();
  dom.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && !touchMove) touchMove = { id: t.identifier, x: t.clientX, y: t.clientY }; else if (!touchLook) touchLook = { id: t.identifier, x: t.clientX, y: t.clientY }; } }, { passive: true });
  dom.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (touchMove && t.identifier === touchMove.id) tm.set((t.clientX - touchMove.x) / 60, (t.clientY - touchMove.y) / 60).clampScalar(-1, 1); if (touchLook && t.identifier === touchLook.id) { state.yaw -= (t.clientX - touchLook.x) * 0.005; state.pitch = THREE.MathUtils.clamp(state.pitch - (t.clientY - touchLook.y) * 0.005, -1.4, 1.4); touchLook.x = t.clientX; touchLook.y = t.clientY; } } }, { passive: true });
  dom.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (touchMove && t.identifier === touchMove.id) { touchMove = null; tm.set(0, 0); } if (touchLook && t.identifier === touchLook.id) touchLook = null; } });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
  function update(dt) {
    dt = Math.min(dt, 0.05);
    const k = state.keys; let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz += 1; if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    mx += tm.x; mz -= tm.y;
    const run = k.has('ShiftLeft') || k.has('ShiftRight'); const speed = run ? 5.2 : 2.6;
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)); right.set(-fwd.z, 0, fwd.x);
    move.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx); if (move.lengthSq() > 1) move.normalize(); move.multiplyScalar(speed * dt);
    if (state.grounded && k.has('Space')) state.vy = 4.6;
    state.vy -= 9.81 * dt; if (state.grounded && state.vy < 0) state.vy = -0.5;
    move.y = state.vy * dt;
    cc.computeColliderMovement(collider, { x: move.x, y: move.y, z: move.z });
    const m = cc.computedMovement(); const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    state.grounded = cc.computedGrounded();
    state.speed = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
    if (t.y < -30) body.setNextKinematicTranslation({ x: spawn[0], y: spawn[1] + 1, z: spawn[2] });
    state.pos.set(t.x + m.x, t.y + m.y - halfH - radius, t.z + m.z);
    // camera
    const eyeP = new THREE.Vector3(state.pos.x, state.pos.y + eye, state.pos.z);
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    if (state.thirdPerson) {
      const back = new THREE.Vector3(0, 0, 1).applyEuler(camera.rotation).multiplyScalar(2.6);
      const ray = new phys.RAPIER.Ray({ x: eyeP.x, y: eyeP.y, z: eyeP.z }, { x: back.x / 2.6, y: back.y / 2.6, z: back.z / 2.6 });
      const hit = world.castRay(ray, 2.6, true, undefined, undefined, collider);
      const d = hit ? Math.max(0.3, hit.timeOfImpact - 0.2) : 2.6;
      camera.position.copy(eyeP).addScaledVector(back.normalize(), d);
    } else camera.position.copy(eyeP);
  }
  return { update, state, body, collider, get position() { return state.pos; } };
}
