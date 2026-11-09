// Drivable cars: two parked in the driveway (supercar, luxury SUV), two on the street (angular electric pickup,
// grand-touring sedan). Look at a door: E::DRIVE / E::RIDE; E again = GET OUT.
//
// How it works
//  - Visuals (models.js): each car is ≤7 merged draw calls while parked (hi / _lod1 by distance) and switches to a
//    "live" rig (body + 4 steer/spin wheel pivots) while it moves. Materials go through kit.outdoor (sky, wet, snow).
//  - Physics, one rigid body per car, three modes:
//      parked = FIXED body (zero simulation cost; players and other cars collide with it)
//      local  = DYNAMIC body + Rapier ray-cast vehicle controller (only the car this client drives / just left)
//      remote = KINEMATIC body posed from the driver's stream (others collide with it on this screen)
//    The local chassis ignores kinematic bodies (player capsules, remote cars) in the solver: players are shoved out
//    of the way by a cheap box test on their own client instead of stopping the car dead; remote cars are pushed
//    apart by a two-circle test. Wheel rays ignore kinematic bodies too.
//  - Arcade handling: low centre of mass, high roll inertia, upright torque, speed-scaled steering, downforce,
//    handbrake drops rear grip (drift), Shift boost to 25 m/s, R / auto-right after 3 s upside down.
//  - Multiplayer (api.channel('car')): the driver is the authority and sends pose + velocity + angular velocity at
//    15 Hz; others dead-reckon from it (sender clock offset + rtt/2) with a decaying error offset (no lag). Seats:
//    claims + 1 Hz heartbeats carrying the claim age; the earlier claim wins, ties (<250 ms) go to the lowest peer
//    id. When the last driver leaves, their client lets the car roll to rest and sends the rest pose. The host
//    (lowest id) gives late joiners every moved car and returns cars abandoned >8 m from home for 2 min.
//  - Seats move player.state.seat.pos / yaw every frame (camera + avatar are re-aligned the same frame); a
//    gentle chase camera re-centres behind the car when the mouse is idle; V = driver's-eye first person.
import * as THREE from 'three';
import { buildCarVisual } from './models.js';
import { createVoice, audioReady } from './sound.js';

const DEFS = [
  { name: 'super', label: 'SUPERCAR', kind: 'glb', url: 'assets/cars/sports_car.glb', lod: 'assets/cars/sports_car_lod1.glb', paint: { color: 0xc3150e, metalness: 0.45, rough: 0.26 }, plate: 0,
    home: [14.3, -2.75, Math.PI], mass: 1350, accel: 7.0, top: 25, seats: [[-0.37, 0.2, 0.22], [0.37, 0.2, 0.22]], eye: 0.72, cam: [5.2, 0.5] },
  { name: 'suv', label: 'SUV', kind: 'glb', url: 'assets/cars/suv.glb', lod: 'assets/cars/suv_lod1.glb', paint: { color: 0x0b0c0e, metalness: 0.55, rough: 0.22 }, plate: 1,
    home: [19.9, -3.05, Math.PI], mass: 2300, accel: 5.4, top: 23, seats: [[-0.42, 0.62, 0.02], [0.42, 0.62, 0.02], [-0.42, 0.66, 0.95], [0.42, 0.66, 0.95]], eye: 0.78, cam: [6.6, 0.8] },
  { name: 'truck', label: 'PICKUP', kind: 'truck', paint: { color: 0xcfd3d6, metal: true, rough: 0.3 }, plate: 2,
    home: [-1.6, -9.65, -Math.PI / 2], mass: 2700, accel: 6.4, top: 25, seats: [[-0.45, 0.70, -0.45], [0.45, 0.70, -0.45], [-0.45, 0.74, 0.5], [0.45, 0.74, 0.5]], eye: 0.86, cam: [7.2, 0.7] },
  { name: 'sedan', label: 'SEDAN', kind: 'glb', url: 'assets/cars/sedan.glb', lod: 'assets/cars/sedan_lod1.glb', paint: { color: 0xd8d2c4, metalness: 0.6, rough: 0.28 }, plate: 3,
    home: [31.5, -9.65, -Math.PI / 2], mass: 1750, accel: 5.8, top: 24, seats: [[-0.39, 0.42, 0.02], [0.39, 0.42, 0.02], [-0.39, 0.45, 0.88], [0.39, 0.45, 0.88]], eye: 0.76, cam: [6.0, 0.6] },
];
const ME = '@me';
const SEND_HZ = 15, REST = 0.3, K_SUSP = 32;
const LOD_DIST = 45;

export function startCars(ctx, api) {
  const { phys, scene, camera, player } = ctx; if (!phys || !player) return null;
  if (new URLSearchParams(location.search).get('cars') === '0') return null; // ?cars=0: off (A/B perf checks)
  const R = phys.RAPIER, world = phys.world;
  const ch = api?.channel ? api.channel('car') : { send() {}, onMessage: null };
  const selfId = () => api?.selfId || 'local';
  const root = new THREE.Group(); root.name = 'cars'; root.userData.keep = true; root.userData.noCull = true; scene.add(root);
  const cars = []; const pend = new Map();
  const RAY_FLAGS = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const GROUND_FLAGS = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const TYPES_LOCAL = R.ActiveCollisionTypes.DYNAMIC_DYNAMIC | R.ActiveCollisionTypes.DYNAMIC_FIXED;
  const TYPES_CAPSULE = R.ActiveCollisionTypes.DYNAMIC_DYNAMIC | R.ActiveCollisionTypes.DYNAMIC_FIXED | R.ActiveCollisionTypes.KINEMATIC_FIXED;
  const TYPES_DEFAULT = R.ActiveCollisionTypes.DEFAULT ?? (R.ActiveCollisionTypes.DYNAMIC_DYNAMIC | R.ActiveCollisionTypes.DYNAMIC_FIXED | R.ActiveCollisionTypes.DYNAMIC_KINEMATIC);
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
  const UP = new THREE.Vector3(0, 1, 0);
  const now = () => performance.now();
  const yawOf = (q) => { _v.set(0, 0, -1).applyQuaternion(q); return Math.atan2(-_v.x, -_v.z); };

  // ---------------------------------------------------------------- blob shadow under a moving car
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgb(70,70,70)'); gr.addColorStop(0.6, 'rgb(140,140,140)'); gr.addColorStop(1, 'rgb(255,255,255)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });

  // ---------------------------------------------------------------- ground + placement
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  function groundAt(x, z, fromY = 6, exclude) {
    ray.origin.x = x; ray.origin.y = fromY; ray.origin.z = z;
    const hit = world.castRay(ray, fromY + 40, true, GROUND_FLAGS, undefined, undefined, exclude);
    return hit ? fromY - hit.timeOfImpact : null;
  }
  // pose resting on the ground at (x, z, yaw): 4 wheel contacts -> height, pitch, roll
  function restPose(car, x, z, yaw, fromY = 6, strict = false) {
    const W = car.wb; const c = Math.cos(yaw), s = Math.sin(yaw); let miss = false;
    const at = (lx, lz) => { const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; const g = groundAt(wx, wz, fromY, car.body) ?? groundAt(x, z, fromY, car.body); if (g === null) miss = true; return g ?? -0.95; };
    const fl = at(-W.hx, -W.hz), fr = at(W.hx, -W.hz), rl = at(-W.hx, W.hz), rr = at(W.hx, W.hz);
    if (strict && miss) return null;
    const y = (fl + fr + rl + rr) / 4; const pitch = Math.atan2(((fl + fr) - (rl + rr)) / 2, W.hz * 2), roll = Math.atan2(((rl + fl) - (rr + fr)) / 2, W.hx * 2);
    const q = new THREE.Quaternion().setFromEuler(_e.set(pitch, yaw, -roll, 'YXZ'));
    return { p: new THREE.Vector3(x, y + 0.01, z), q };
  }

  // ---------------------------------------------------------------- create
  async function makeCar(def, i) {
    const vis = await buildCarVisual(ctx, def);
    root.add(vis.group);
    const bb = vis.bbox, wheels = vis.wheels;
    const hx = Math.max(...wheels.map(w => Math.abs(w.hub.x))), hz = Math.max(...wheels.map(w => Math.abs(w.hub.z)));
    const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(def.home[0], -0.5, def.home[1]).setCanSleep(true).setLinearDamping(0.05).setAngularDamping(0.4).setCcdEnabled(true));
    const r0 = wheels[0].radius, H = size.y;
    const yLo = r0 * 0.75, yBelt = Math.min(H * 0.6, 1.25);
    const colliders = [];
    const mkCol = (hxx, y0, y1, hzz, cz) => { const c = world.createCollider(R.ColliderDesc.cuboid(hxx, (y1 - y0) / 2, hzz).setTranslation(ctr.x, (y0 + y1) / 2, cz).setDensity(0).setFriction(0.35).setRestitution(0.05), body); colliders.push(c); return c; };
    mkCol(size.x / 2 * 0.96, yLo, yBelt, size.z / 2 * 0.97, ctr.z);
    const cabZ = def.seats.reduce((a, s) => a + s[2], 0) / def.seats.length;
    mkCol(size.x / 2 * 0.82, yBelt, H * 0.96, Math.min(size.z * 0.3, 1.5), cabZ);
    const m = def.mass, L = size.z, Wd = size.x;
    body.setAdditionalMassProperties(m, { x: 0, y: Math.max(0.28, r0 * 0.9), z: 0 }, { x: m / 12 * (H * H + L * L) * 1.3, y: m / 12 * (Wd * Wd + L * L), z: m / 12 * (Wd * Wd + H * H) * 2.2 }, { x: 0, y: 0, z: 0, w: 1 }, false);
    for (const c of colliders) { phys.claim?.(c, { kind: 'car', id: def.name, driver: null }); phys.watchImpacts?.(c, 4000); }
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.25, size.z * 1.12).rotateX(-Math.PI / 2), blobMat); blob.position.set(ctr.x, 0.04, ctr.z); blob.renderOrder = 1; blob.userData.noCull = true; blob.userData.keep = true; vis.live.add(blob);
    const car = {
      i, def, vis, body, colliders, wb: { hx, hz }, size, ctr, r0, vc: null, mode: 'parked', ready: false, placed: false,
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), prevP: new THREE.Vector3(), prevQ: new THREE.Quaternion(), curP: new THREE.Vector3(), curQ: new THREE.Quaternion(),
      seats: def.seats.map(() => null), steer: 0, speed: 0, rpm: 0, thr: 0, brake: false, boost: false, slip: 0, hand: false, spin: 0,
      net: { snap: null, from: null, off: null, errP: new THREE.Vector3(), dispQ: new THREE.Quaternion(), last: 0 },
      lastSend: 0, restT: 0, coastT: 0, flipT: 0, abandonT: 0, lod: 0, voice: null, hornOn: false, hornRemote: false,
    };
    car.home = (strict) => restPose(car, def.home[0], def.home[1], def.home[2], 6, strict);
    cars[i] = car;
    return car;
  }
  let list = null; // loaded cars
  const loading = Promise.all(DEFS.map((d, i) => makeCar(d, i).catch(e => { console.warn('[cars] load', d.name, e); return null; }))).then(() => { list = cars.filter(Boolean); return list.length; });

  // ---------------------------------------------------------------- pose helpers
  function setGroup(car, p, q) { car.pos.copy(p); car.quat.copy(q); car.vis.group.position.copy(p); car.vis.group.quaternion.copy(q); }
  function bodyPose(car, P, Q) { const t = car.body.translation(), r = car.body.rotation(); P.set(t.x, t.y, t.z); Q.set(r.x, r.y, r.z, r.w); }
  function showLive(car, on) {
    car.vis.live.visible = on; car.vis.parkedHi.visible = !on && car.lod === 0; car.vis.parkedLo.visible = !on && car.lod === 1 && car.vis.hasLod;
    if (!car.vis.hasLod && !on) car.vis.parkedHi.visible = true;
    ctx.shadows?.poke?.();
  }
  function makeParked(car, p, q, send) {
    if (car.vc) { try { world.removeVehicleController(car.vc); } catch {} car.vc = null; }
    car.body.setBodyType(R.RigidBodyType.Fixed, false);
    car.body.setTranslation({ x: p.x, y: p.y, z: p.z }, false); car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
    for (const c of car.colliders) c.setActiveCollisionTypes(TYPES_DEFAULT);
    car.mode = 'parked'; setGroup(car, p, q); car.curP.copy(p); car.curQ.copy(q); car.prevP.copy(p); car.prevQ.copy(q);
    car.speed = 0; car.rpm = 0; car.steer = 0; car.brake = false; car.slip = 0; car.net.snap = null; car.abandonT = 0;
    showLive(car, false);
    if (send) ch.send({ t: 'r', c: car.i, p: p.toArray().map(r3), q: q.toArray().map(r4) });
  }
  function makeLocal(car) {
    if (car.mode === 'local') return;
    car.body.setBodyType(R.RigidBodyType.Dynamic, true);
    car.body.setTranslation({ x: car.pos.x, y: car.pos.y + 0.03, z: car.pos.z }, true); car.body.setRotation({ x: car.quat.x, y: car.quat.y, z: car.quat.z, w: car.quat.w }, true);
    const v = car.net.snap?.v; car.body.setLinvel(v && car.mode === 'remote' ? { x: v[0], y: v[1], z: v[2] } : { x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (const c of car.colliders) c.setActiveCollisionTypes(TYPES_LOCAL);
    const vc = world.createVehicleController(car.body);
    vc.indexUpAxis = 1; vc.setIndexForwardAxis = 2;
    for (const w of car.vis.wheels) {
      const sag = 9.81 / (4 * K_SUSP);
      vc.addWheel({ x: w.hub.x, y: w.hub.y + REST - sag, z: w.hub.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, w.radius);
    }
    for (let k = 0; k < car.vis.wheels.length; k++) {
      vc.setWheelSuspensionStiffness(k, K_SUSP); vc.setWheelSuspensionCompression(k, 4.2); vc.setWheelSuspensionRelaxation(k, 5.0);
      vc.setWheelMaxSuspensionForce(k, car.def.mass * 40); vc.setWheelMaxSuspensionTravel(k, 0.22);
      vc.setWheelFrictionSlip(k, 3.2); vc.setWheelSideFrictionStiffness(k, 1.0);
    }
    car.vc = vc; car.mode = 'local'; car.coastT = 0; car.restT = 0;
    car.curP.copy(car.pos); car.curQ.copy(car.quat); car.prevP.copy(car.pos); car.prevQ.copy(car.quat);
    showLive(car, true);
  }
  function makeRemote(car) {
    if (car.vc) { try { world.removeVehicleController(car.vc); } catch {} car.vc = null; }
    car.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
    for (const c of car.colliders) c.setActiveCollisionTypes(TYPES_DEFAULT);
    car.mode = 'remote'; car.net.errP.set(0, 0, 0); car.net.dispQ.copy(car.quat); car.net.snap = null; car.net.off = null;
    showLive(car, true);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 10000) / 10000;

  // ---------------------------------------------------------------- seats
  const isMe = (id) => id === ME;
  const realId = (id) => (id === ME ? selfId() : id);
  let mySeat = null; // { car, i }
  function seatTaken(car, i) { const s = car.seats[i]; return !!s && !isMe(s.id) && now() - s.beat < 3500; }
  function clearId(id, except) { for (const c of (list || [])) if (c) if (c) for (let k = 0; k < c.seats.length; k++) { const s = c.seats[k]; if (s && s.id === id && !(except && except[0] === c && except[1] === k)) c.seats[k] = null; } }
  function sendSeat(car, i, on) { const s = car.seats[i]; ch.send({ t: 's', c: car.i, i, on: on ? 1 : 0, a: on && s ? Math.round(now() - s.start) : 0 }); }
  function onSeatMsg(car, m, id) {
    const i = m.i | 0; if (i < 0 || i >= car.seats.length) return;
    if (!m.on) { if (car.seats[i]?.id === id) { car.seats[i] = null; driverChanged(car); } return; }
    const rtt = api?.peers?.get?.(id)?.rtt || 0; const start = now() - (+m.a || 0) - rtt / 2;
    const cur = car.seats[i];
    if (!cur || cur.id === id || (!isMe(cur.id) && now() - cur.beat > 3500)) {
      clearId(id, [car, i]); car.seats[i] = { id, start: cur?.id === id ? cur.start : start, beat: now() }; driverChanged(car); return;
    }
    const inWins = Math.abs(start - cur.start) > 250 ? start < cur.start : realId(id) < realId(cur.id);
    if (!inWins) { if (isMe(cur.id)) sendSeat(car, i, true); return; }
    const wasMe = isMe(cur.id);
    clearId(id, [car, i]); car.seats[i] = { id, start, beat: now() };
    if (wasMe) { mySeat = null; getOut(car, true); toast('SEAT TAKEN'); }
    driverChanged(car);
  }
  function driverChanged(car) {
    const d = car.seats[0]; for (const c of car.colliders) phys.claim?.(c, { kind: 'car', id: car.def.name, driver: d ? realId(d.id) : null });
  }

  // ---------------------------------------------------------------- enter / exit
  const seatLocal = (car, i) => _v2.set(...car.def.seats[i]);
  function seatWorld(car, i, out) { return out.set(...car.def.seats[i]).applyQuaternion(car.quat).add(car.pos); }
  let savedCam = null, mouseT = 0, chaseD = 5;
  function enter(car, i) {
    if (player.state.seat || !car.ready || seatTaken(car, i)) return;
    clearId(ME); car.seats[i] = { id: ME, start: now(), beat: now() }; mySeat = { car, i }; driverChanged(car);
    sendSeat(car, i, true);
    if (i === 0) makeLocal(car);
    const p = seatWorld(car, i, new THREE.Vector3());
    player.setSeat({ pos: [p.x, p.y, p.z], yaw: yawOf(car.quat), pose: 'sit', vehicle: car.def.name });
    savedCam = player.state.camWant; player.state.camWant = 3; chaseD = car.def.cam[0]; player.state.pitch = -0.16;
    /* polish4: no mid-screen GET OUT prompt while moving (the HUD's E chip says it) — only when nearly stopped */
    if (ctx.interact) ctx.interact.modal = { label: () => (Math.abs(car.speed || 0) < 1 ? 'GET OUT' : ''), use: () => { exitCar(); return true; } };
    hud.show(true, i === 0); ensureVoice(car);
  }
  // free standing spot next to the seat's door (or around the car), on the ground, clear of everything solid
  const capShape = new R.Capsule(0.55, 0.28);
  function exitSpot(car, i) {
    const side = car.def.seats[i][0] < 0 ? -1 : 1; const hw = car.size.x / 2 + 0.7; /* polish4: +0.5 -> +0.7, room for the over-shoulder camera */
    const cands = [];
    for (const [sx, dz] of [[side, 0], [side, -0.8], [side, 0.8], [side, -1.6], [side, 1.6], [-side, 0], [-side, 0.8], [-side, -0.8]]) cands.push([sx * hw, car.def.seats[i][2] + dz]);
    cands.push([0, -(car.size.z / 2 + 0.7)], [0, car.size.z / 2 + 0.7], [side * (hw + 0.8), car.def.seats[i][2]]);
    for (const [lx, lz] of cands) {
      const w = _v.set(lx, 0, lz).applyQuaternion(car.quat).add(car.pos);
      const gy = groundAt(w.x, w.z, car.pos.y + 2.2, car.body); if (gy === null || gy > car.pos.y + 1.2) continue;
      let hit = false;
      world.intersectionsWithShape({ x: w.x, y: gy + 0.08 + 0.83, z: w.z }, { x: 0, y: 0, z: 0, w: 1 }, capShape, (c) => { const b = c.parent(); if (b && b.isKinematic()) return true; if (c.isSensor()) return true; hit = true; return false; });
      if (!hit) return [w.x, gy + 0.02, w.z];
    }
    const w = _v.set(side * (hw + 1.5), 0, 0).applyQuaternion(car.quat).add(car.pos); return [w.x, (groundAt(w.x, w.z, car.pos.y + 3) ?? car.pos.y) + 0.05, w.z];
  }
  function getOut(car, silent) {
    const i = car.seats.findIndex(s => s && isMe(s.id)); const si = i >= 0 ? i : (mySeat?.i ?? 0);
    if (i >= 0) { car.seats[i] = null; if (!silent) sendSeat(car, i, false); }
    mySeat = null; driverChanged(car);
    if (ctx.interact) ctx.interact.modal = null;
    hud.show(false);
    if (player.state.seat?.vehicle) { const [x, y, z] = exitSpot(car, si); player.teleport(x, y, z, yawOf(car.quat)); }
    if (savedCam) { player.state.camWant = savedCam; savedCam = null; }
    if (car.hornOn) horn(car, false);
    if (si === 0 && car.mode === 'local') car.coastT = 0.001; // roll to rest, then park + send the rest pose
  }
  function exitCar() { if (mySeat) getOut(mySeat.car, false); }

  // ---------------------------------------------------------------- driving (fixed step)
  const keys = player.state.keys;
  let steps = 0;
  phys.onStep((h) => {
    steps++;
    for (const car of cars) if (car?.vc && car.mode === 'local') stepCar(car, h);
  });
  const _f = new THREE.Vector3(), _up = new THREE.Vector3(), _lv = new THREE.Vector3(), _av = new THREE.Vector3();
  function stepCar(car, h) {
    const b = car.body, vc = car.vc, def = car.def; const W = car.vis.wheels;
    bodyPose(car, car.prevP, car.prevQ);
    const r = b.rotation(); _q.set(r.x, r.y, r.z, r.w);
    _f.set(0, 0, -1).applyQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    const lv = b.linvel(); _lv.set(lv.x, lv.y, lv.z);
    const vf = _lv.dot(_f); car.speed = vf;
    const driving = mySeat && mySeat.car === car && mySeat.i === 0 && !ctx.uiBlocking?.();
    let fwd = 0, back = 0, left = 0, rightK = 0, hand = false, boost = false;
    if (driving) {
      fwd = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0; back = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
      left = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0; rightK = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
      hand = keys.has('Space'); boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (car.auto) { const a = car.auto(h, car); fwd = a.fwd || 0; back = a.back || 0; left = a.left || 0; rightK = a.right || 0; hand = !!a.hand; boost = !!a.boost; }
    }
    const top = boost ? def.top : def.top * 0.78, spd = Math.abs(vf);
    let engine = 0, brake = 0;
    if (fwd && !back) { if (vf < -0.6) brake = 1; else if (vf < top) engine = def.accel * (boost ? 1.45 : 1) * (1 - 0.35 * spd / top); }
    else if (back && !fwd) { if (vf > 0.8) brake = 1; else if (vf > -8) engine = -def.accel * 0.6; }
    else if (!driving && car.coastT > 0) brake = 1;
    else brake = spd < 0.4 ? 0.6 : 0.12; // engine braking / hold on slopes
    car.inSig = fwd | (back << 1) | (left << 2) | (rightK << 3) | (hand ? 16 : 0) | (boost ? 32 : 0);
    car.brake = brake >= 0.5 && spd > 0.3; car.thr = engine !== 0 ? 1 : 0; car.boost = boost && engine > 0; car.hand = hand;
    const st = (left - rightK) * THREE.MathUtils.lerp(0.58, 0.17, Math.min(1, spd / 25));
    car.steer += (st - car.steer) * (1 - Math.exp(-h * (st === 0 ? 7 : 5)));
    const perWheel = engine * def.mass / W.length;
    const brakeF = brake * def.mass * 0.03;
    for (let k = 0; k < W.length; k++) {
      const w = W[k];
      vc.setWheelSteering(k, w.front ? car.steer : 0);
      vc.setWheelEngineForce(k, -perWheel);
      vc.setWheelBrake(k, w.front ? brakeF : (hand ? def.mass * 0.02 : brakeF));
      vc.setWheelFrictionSlip(k, hand && !w.front ? 1.15 : (w.front ? 3.4 : 3.1));
      vc.setWheelSideFrictionStiffness(k, hand && !w.front ? 0.45 : 1.0);
    }
    vc.updateVehicle(h, RAY_FLAGS);
    // arcade stabilisers
    let contact = 0; for (let k = 0; k < W.length; k++) if (vc.wheelIsInContact(k)) contact++;
    const m = def.mass;
    if (contact >= 2) b.applyImpulse({ x: -_up.x * m * 0.006 * vf * vf * h, y: -_up.y * m * 0.006 * vf * vf * h, z: -_up.z * m * 0.006 * vf * vf * h }, true);
    _v.crossVectors(_up, UP); const tilt = _v.length();
    const av = b.angvel(); _av.set(av.x, av.y, av.z);
    if (tilt > 0.02) { const k = m * (contact >= 2 ? 6 : 14) * h; b.applyTorqueImpulse({ x: _v.x * k, y: _v.y * k, z: _v.z * k }, true); }
    // damp roll/pitch rates (keep yaw)
    const yawRate = _av.dot(_up); _av.addScaledVector(_up, -yawRate).multiplyScalar(contact >= 2 ? 0.92 : 0.98).addScaledVector(_up, yawRate);
    // handbrake drift assist: a little extra yaw from steering
    if (hand && spd > 5 && contact >= 2) _av.addScaledVector(_up, car.steer * 1.6 * h * 6);
    b.setAngvel({ x: _av.x, y: _av.y, z: _av.z }, true);
    // slip (skid sound / smoke)
    let side = 0; for (let k = 0; k < W.length; k++) side = Math.max(side, Math.abs(vc.wheelSideImpulse(k) || 0));
    const latV = Math.abs(_lv.dot(_v.set(1, 0, 0).applyQuaternion(_q)));
    car.slip = contact >= 2 ? Math.min(1, Math.max(0, (latV - 2.2) / 5) + (car.brake && spd > 8 ? 0.4 : 0)) : 0;
    car.rpm = Math.min(1, spd / def.top) * 0.85 + (engine ? 0.15 : 0);
    car.contact = contact;
  }

  // ---------------------------------------------------------------- remote prediction
  function predict(car, t, P, Q) {
    const s = car.net.snap; const lat = (api?.peers?.get?.(car.net.from)?.rtt || 0) / 2;
    const age = THREE.MathUtils.clamp(((t - car.net.off) - s.ts + lat) / 1000, 0, 0.7); // keep dead-reckoning through short network stalls
    // constant-turn dead reckoning: the horizontal velocity turns with the yaw rate
    const wy = s.w[1]; let dx, dz;
    if (Math.abs(wy) > 0.03) { const a = wy * age, sn = Math.sin(a) / wy, cs = (1 - Math.cos(a)) / wy; dx = sn * s.v[0] + cs * s.v[2]; dz = -cs * s.v[0] + sn * s.v[2]; }
    else { dx = s.v[0] * age; dz = s.v[2] * age; }
    P.set(s.p[0] + dx, s.p[1] + s.v[1] * age, s.p[2] + dz);
    Q.set(s.q[0], s.q[1], s.q[2], s.q[3]);
    const wl = Math.hypot(s.w[0], s.w[1], s.w[2]); if (wl > 1e-4) { _q2.setFromAxisAngle(_v.set(s.w[0] / wl, s.w[1] / wl, s.w[2] / wl), wl * age); Q.premultiply(_q2); }
    return age;
  }
  function onPose(car, m, id) {
    if (!Array.isArray(m.p) || !Array.isArray(m.q) || !m.p.every(Number.isFinite)) return;
    const iDrive = car.seats[0] && isMe(car.seats[0].id);
    if (iDrive) return; // seat resolution decides; my own stream wins locally
    const t = now();
    if (car.mode !== 'remote') makeRemote(car);
    const off = t - m.ts;
    if (car.net.from !== id || car.net.off === null) { car.net.from = id; car.net.off = off; }
    else car.net.off = off < car.net.off ? off : car.net.off + (off - car.net.off) * 0.02;
    const had = !!car.net.snap; const P0 = new THREE.Vector3();
    if (had) P0.copy(car.pos);
    car.net.snap = { ts: m.ts, p: m.p, q: m.q, v: m.v || [0, 0, 0], w: m.w || [0, 0, 0], st: +m.st || 0, f: m.f | 0, r: +m.r || 0 };
    predict(car, t, _v2, _q);
    if (had) { car.net.errP.copy(P0).sub(_v2); if (car.net.errP.length() > 5) car.net.errP.set(0, 0, 0); }
    else { car.net.errP.set(0, 0, 0); car.net.dispQ.copy(_q); }
    car.net.last = t;
    if ((m.f & 8) && (!car.seats[0] || car.seats[0].id !== id)) { if (!car.seats[0] || now() - car.seats[0].beat > 3500) { clearId(id, [car, 0]); car.seats[0] = { id, start: t, beat: t }; driverChanged(car); } }
  }

  // ---------------------------------------------------------------- network
  ch.onMessage = (m, id) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'all' && Array.isArray(m.cars)) { for (const e of m.cars) { const car = cars[e.c]; if (!car?.ready) { pend.set('all' + e.c, [e, id]); continue; } applyRest(car, e); } return; }
    const car = cars[m.c | 0]; if (!car) return;
    if (!car.ready) { pend.set(m.t + (m.c | 0) + (m.i ?? ''), [m, id]); return; }
    handle(car, m, id);
  };
  function handle(car, m, id) {
    if (m.t === 'p') onPose(car, m, id);
    else if (m.t === 'r') { if (!(car.seats[0] && isMe(car.seats[0].id))) applyRest(car, m); }
    else if (m.t === 's') onSeatMsg(car, m, id);
    else if (m.t === 'h') { car.hornRemote = !!m.on; ensureVoice(car)?.horn(!!m.on); }
  }
  function applyRest(car, e) {
    if (!Array.isArray(e.p) || !Array.isArray(e.q)) return;
    if (car.mode === 'local' && car.seats[0] && isMe(car.seats[0].id)) return;
    makeParked(car, new THREE.Vector3(...e.p), new THREE.Quaternion(...e.q), false);
  }
  api?.onPeerJoin?.((id) => {
    // everyone re-announces their own seats; the host sends every moved car's pose
    const greet = () => {
      for (const car of cars) if (car) for (let i = 0; i < car.seats.length; i++) if (car.seats[i] && isMe(car.seats[i].id)) sendSeat(car, i, true);
      if (!isHost(id)) return; // lowest id among the members already here (not the newcomer)
      const list = [];
      for (const car of cars) if (car?.ready && car.mode === 'parked' && car.pos.distanceTo(car.homeP) > 0.3) list.push({ c: car.i, p: car.pos.toArray().map(r3), q: car.quat.toArray().map(r4) });
      if (list.length) ch.send({ t: 'all', cars: list }, id);
    };
    setTimeout(greet, 400); setTimeout(greet, 3000); // again once the newcomer has surely bound the channel
  });
  api?.onPeerLeave?.((id) => { for (const car of cars) if (car) for (let i = 0; i < car.seats.length; i++) if (car.seats[i]?.id === id) { car.seats[i] = null; driverChanged(car); } });
  function isHost(except) { const me = selfId(); for (const id of api?.peers?.keys?.() || []) if (id !== except && !String(id).startsWith('bot') && id < me) return false; return true; }

  // ---------------------------------------------------------------- horn / reset keys
  function horn(car, on) { if (car.hornOn === on) return; car.hornOn = on; ensureVoice(car)?.horn(on); ch.send({ t: 'h', c: car.i, on: on ? 1 : 0 }); }
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (!mySeat || typing(e)) return;
    if (e.code === 'KeyN' && !e.repeat) horn(mySeat.car, true);
    if (e.code === 'KeyR' && !e.repeat && mySeat.i === 0) { e.preventDefault(); e.stopImmediatePropagation(); resetCar(mySeat.car); }
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'KeyN' && mySeat) horn(mySeat.car, false); });
  addEventListener('mousemove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) mouseT = now(); });
  function resetCar(car) {
    if (car.mode !== 'local') return;
    const p = car.pos; const rp = restPose(car, p.x, p.z, yawOf(car.quat), p.y + 3);
    car.body.setTranslation({ x: rp.p.x, y: rp.p.y + 0.4, z: rp.p.z }, true); car.body.setRotation({ x: rp.q.x, y: rp.q.y, z: rp.q.z, w: rp.q.w }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.flipT = 0;
    bodyPose(car, car.curP, car.curQ); car.prevP.copy(car.curP); car.prevQ.copy(car.curQ);
  }

  // ---------------------------------------------------------------- audio
  function ensureVoice(car) { if (!car.voice) { try { car.voice = createVoice(car.def.name); } catch { car.voice = null; } } return car.voice; }

  // ---------------------------------------------------------------- lights
  const wallRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }); const WALL_FLAGS = R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  function wallsBetween(a, b) {
    const dx = b.x - a.x, dy = b.y + 0.6 - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); if (L < 1) return 0; let n = 0;
    wallRay.origin = { x: a.x, y: a.y, z: a.z }; wallRay.dir = { x: dx / L, y: dy / L, z: dz / L };
    try { world.intersectionsWithRay(wallRay, L - 0.5, true, (hit) => { const tag = phys.tags?.get(hit.collider.handle) || ''; if (tag === 'shell' || tag === 'core') n++; return n < 4; }, WALL_FLAGS); } catch {}
    return n;
  }
  let spot = null;
  // contain pass: the headlight has no shadow map (a per-frame spot shadow pass of the house is far too expensive), so it
  // would light rooms behind the wall it faces. Instead its range stops just past the farthest solid thing the beam
  // reaches: a fan of 5 x 2 level rays across the cone (fixed colliders only, the car itself excluded), re-cast at
  // ~10 Hz; the range eases out, snaps in. Nothing in front = the full 45 m.
  const headRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }); let headAcc = 1, headWant = 45, headCur = 45;
  const HEAD_FLAGS = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  function headRange(car, dt) {
    headAcc += dt;
    if (headAcc >= 0.1) {
      headAcc = 0; let far = 0;
      for (const h of [0.75, 1.3]) for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) {
        _v.set(0, h, -car.size.z / 2 + 0.05).applyQuaternion(car.quat).add(car.pos); _v2.set(Math.sin(a), 0, -Math.cos(a)).applyQuaternion(car.quat); _v2.y = 0; _v2.normalize();
        headRay.origin.x = _v.x; headRay.origin.y = _v.y; headRay.origin.z = _v.z; headRay.dir.x = _v2.x; headRay.dir.y = 0; headRay.dir.z = _v2.z;
        let hit = null; try { hit = world.castRay(headRay, 45, true, HEAD_FLAGS, undefined, undefined, car.body); } catch {}
        far = Math.max(far, hit ? (hit.timeOfImpact ?? hit.toi) : 45); if (far >= 45) break;
      }
      headWant = Math.min(30, far + 0.35);
    }
    headCur = headWant < headCur ? headWant : headCur + (headWant - headCur) * Math.min(1, dt * 4);
    return headCur;
  }
  const isNight = () => { const s = window.__sky; if (!s) return false; const t = s.tod; let w = ''; try { w = s.weather || ''; } catch {} return t < 0.285 || t > 0.775 || /rain|storm|fog|snow|blizzard/.test(w); };
  function lights(car, night) {
    const active = car.mode !== 'parked' && !!car.seats[0];
    const head = active && night ? 2.6 : 0, tail = car.brake && car.mode !== 'parked' ? 3.2 : (active && night ? 0.9 : 0.06);
    if (car.vis.mats.head.emissiveIntensity !== head) car.vis.mats.head.emissiveIntensity = head;
    if (car.vis.mats.tail.emissiveIntensity !== tail) car.vis.mats.tail.emissiveIntensity = tail;
  }

  // ---------------------------------------------------------------- HUD
  const hud = (() => {
    const el = document.createElement('div'); el.id = 'car-hud';
    const chips = [['W/S', 'GAS'], ['A/D', 'STEER'], ['SPACE', 'DRIFT'], ['SHIFT', 'BOOST'], ['N', 'HORN'], ['R', 'RESET'], ['E', 'GET OUT']];
    /* polish4: 4 chips by default (KMH, W/S, A/D, E); the rest behind `/` (same key as the walk hints) */
    const CORE = new Set(['W/S', 'A/D', 'E']);
    el.innerHTML = '<span class="ch kmh"><b>KMH</b><i>::</i><em>0</em></span>' + chips.map(([k, v]) => `<span class="ch drv${CORE.has(k) ? '' : ' xtra'}${k === 'E' ? ' eout' : ''}"><b>${k}</b><i>::</i><em>${v}</em></span>`).join('') + '<span class="ch drv xtog"><b>/</b><i>::</i><em>MORE</em></span>';
    addEventListener('keydown', (e) => { if (e.code !== 'Slash' || e.repeat || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return; el.classList.toggle('more'); });
    document.body.appendChild(el);
    const css = document.createElement('style');
    css.textContent = `#car-hud{position:fixed;left:50%;bottom:72px;transform:translate(-50%,6px);opacity:0;pointer-events:none;z-index:35;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;
  font-family:var(--ui-mono,'Geist Mono',ui-monospace,'SF Mono',monospace);font-size:11px;font-weight:600;letter-spacing:-.4px;transition:opacity .2s var(--ease-soft,ease-out),transform .35s var(--ease-out-expo,ease-out)}
#car-hud.on{opacity:1;transform:translate(-50%,0)}
#car-hud .ch{background:#2f2f2f;border:1px solid rgba(247,247,247,.06);border-radius:2px;padding:4px 7px;box-shadow:0 2px 6px -2px rgba(0,0,0,.2);white-space:nowrap}
#car-hud b{color:rgba(247,247,247,.32);font-weight:600}#car-hud i{font-style:normal;color:rgba(247,247,247,.32)}#car-hud em{font-style:normal;color:rgba(247,247,247,.66)}
#car-hud .kmh em{color:#f2c84b;display:inline-block;min-width:3ch;text-align:right}
#car-hud .xtra{display:none}#car-hud.more .xtra{display:inline-block}#car-hud.more .xtog{display:none}
#car-hud.pass .drv{display:none!important}#car-hud.pass .drv.eout{display:inline-block!important}
body.menu-open #car-hud,body.paused #car-hud,body.photo #car-hud,body.shot #car-hud{display:none!important}
@media (prefers-reduced-motion:reduce){#car-hud{transition:opacity .15s linear}}`;
    document.head.appendChild(css);
    const kmh = el.querySelector('.kmh em'); let shown = -1;
    return {
      show(on, driver) { el.classList.toggle('on', !!on); el.classList.toggle('pass', !driver); document.body.classList.toggle('driving', !!on); },
      speed(v) { const k = Math.round(Math.abs(v) * 3.6); if (k !== shown) { shown = k; kmh.textContent = k; } },
    };
  })();
  function toast(msg) { try { api?.ui?.toast?.(msg); } catch {} }

  // ---------------------------------------------------------------- interactions
  function registerInteract(car) {
    if (!ctx.interact) return;
    car.def.seats.forEach((s, i) => {
      const side = s[0] < 0 ? -1 : 1; const local = new THREE.Vector3(side * (car.size.x / 2 + 0.02), s[1] + 0.45, s[2]); const w = new THREE.Vector3();
      ctx.interact.add({
        id: `car:${car.def.name}:${i}`, radius: 0.6, range: 2.9,
        pos: () => w.copy(local).applyQuaternion(car.quat).add(car.pos),
        label: () => (i === 0 ? 'DRIVE' : 'RIDE'),
        enabled: () => car.ready && !player.state.seat && !seatTaken(car, i) && !player.state.swimming,
        use: () => enter(car, i),
      });
    });
  }

  // ---------------------------------------------------------------- per frame
  let placeT = 0, acc = 0, lastSteps = 0, lodAcc = 1, beatAcc = 0, hostAcc = 0, nightAcc = 1, night = false;
  const seatP = new THREE.Vector3(), oldSeat = new THREE.Vector3(), pl = new THREE.Vector3();
  const rec = { on: false, buf: [] };
  ctx.onUpdate((dt) => {
    if (!list) return; const cars = list;
    const t = now();
    // first frame after the world has stepped: place every car on the ground at home
    placeT += dt;
    for (const car of cars) if (car && !car.placed) { const hp = car.home(placeT < 8); if (!hp) continue; car.placed = true; car.homeP = hp.p.clone(); if (car.mode === 'parked') makeParked(car, hp.p, hp.q, false); car.ready = true; registerInteract(car); }
    for (const [k, [m, id]] of pend) { const c = list.find(x => x.i === (m.c | 0)); if (!c?.ready) continue; pend.delete(k); if (m.t) handle(c, m, id); else applyRest(c, m); }
    // physics interpolation (mirror of physics.js' accumulator)
    const stepped = steps - lastSteps; lastSteps = steps;
    acc = THREE.MathUtils.clamp(acc + Math.min(dt, 0.1) - stepped / 60, 0, 1 / 60); const alpha = acc * 60;
    nightAcc += dt; if (nightAcc > 1) { nightAcc = 0; night = isNight(); }
    lodAcc += dt; const doLod = lodAcc > 0.25; if (doLod) lodAcc = 0;
    for (const car of cars) {
      if (!car) continue;
      if (car.mode === 'local') {
        bodyPose(car, car.curP, car.curQ);
        if (!stepped) { /* keep previous interpolation pair */ }
        _v.copy(car.prevP).lerp(car.curP, alpha); _q.copy(car.prevQ).slerp(car.curQ, alpha);
        setGroup(car, _v, _q);
        // flipped / fell out of the world
        _up.set(0, 1, 0).applyQuaternion(car.curQ);
        if (_up.y < 0.35) { car.flipT += dt; if (car.flipT > 3) resetCar(car); } else car.flipT = 0;
        if (car.curP.y < -30) { const hp = car.home(); car.body.setTranslation({ x: hp.p.x, y: hp.p.y + 0.5, z: hp.p.z }, true); car.body.setRotation(hp.q, true); car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
        // stream
        const lv = car.body.linvel(), av = car.body.angvel();
        const moving = Math.hypot(lv.x, lv.y, lv.z) > 0.05 || Math.hypot(av.x, av.y, av.z) > 0.05;
        // 15 Hz, plus an early packet when the driver's input changes (that is when dead reckoning goes wrong)
        if (t - car.lastSend > (moving ? 1000 / SEND_HZ : 1000) || (car.inSig !== car.sentSig && t - car.lastSend > 33)) {
          car.lastSend = t; car.sentSig = car.inSig;
          ch.send({ t: 'p', c: car.i, ts: Math.round(t + (1 - alpha) * 1000 / 60), p: [r3(car.curP.x), r3(car.curP.y), r3(car.curP.z)], q: car.curQ.toArray().map(r4), v: [r3(lv.x), r3(lv.y), r3(lv.z)], w: [r3(av.x), r3(av.y), r3(av.z)], st: r3(car.steer), f: (car.brake ? 1 : 0) | (car.boost ? 2 : 0) | (car.slip > 0.3 ? 4 : 0) | (car.seats[0] && isMe(car.seats[0].id) ? 8 : 0), r: r3(car.rpm) });
        }
        // left the car: roll to rest, then park and send the rest pose
        if (car.coastT > 0 && !(car.seats[0])) {
          car.coastT += dt; const still = Math.hypot(lv.x, lv.z) < 0.25 && Math.abs(av.y) < 0.1;
          car.restT = still ? car.restT + dt : 0;
          if (car.restT > 0.5 || car.coastT > 6) { const p = car.curP.clone(), q = car.curQ.clone(); makeParked(car, p, q, true); }
        }
      } else if (car.mode === 'remote') {
        const s = car.net.snap;
        if (s) {
          predict(car, t, _v2, _q);
          car.net.errP.multiplyScalar(Math.exp(-dt * 8));
          _v2.add(car.net.errP); car.net.dispQ.slerp(_q, 1 - Math.exp(-dt * 14));
          setGroup(car, _v2, car.net.dispQ);
          car.body.setNextKinematicTranslation({ x: _v2.x, y: _v2.y, z: _v2.z }); car.body.setNextKinematicRotation(car.net.dispQ);
          _v.set(0, 0, -1).applyQuaternion(car.quat); car.speed = s.v[0] * _v.x + s.v[1] * _v.y + s.v[2] * _v.z; car.steer += (s.st - car.steer) * Math.min(1, dt * 10);
          car.brake = !!(s.f & 1); car.slip = s.f & 4 ? 0.8 : 0; car.rpm = s.r; car.thr = car.rpm > 0.2 ? 1 : 0.3;
        }
        // driver vanished without a rest pose: park where it is
        if (t - car.net.last > 3000 && !car.seats[0]) makeParked(car, car.pos.clone(), car.quat.clone(), false);
      } else if (doLod) {
        const lod = camera.position.distanceToSquared(car.pos) > LOD_DIST * LOD_DIST ? 1 : 0;
        if (lod !== car.lod) { car.lod = lod; if (car.vis.hasLod) { car.vis.parkedHi.visible = lod === 0; car.vis.parkedLo.visible = lod === 1; } }
      }
      if (car.mode !== 'parked') {
        // wheels: spin from forward speed, steer the fronts
        car.spin += car.speed * dt;
        for (const w of car.vis.wheels) { w.pivot.rotation.y = w.front ? car.steer : 0; w.spin.rotation.x = -car.spin / w.radius; }
      }
      lights(car, night);
      if (rec.on && car.i === rec.car) { rec.buf.push([Date.now(), +car.pos.x.toFixed(3), +car.pos.y.toFixed(3), +car.pos.z.toFixed(3)]); if (rec.buf.length > 4000) rec.buf.shift(); }
      // sound
      if (car.voice) {
        const d = camera.position.distanceTo(car.pos); _v.set(1, 0, 0).applyQuaternion(camera.quaternion); _v2.copy(car.pos).sub(camera.position).normalize();
        const audible = car.mode !== 'parked' && !!car.seats[0] && d < 60;
        // contain pass: muffled through walls (house shell colliders between the camera and the car, one ray at 4 Hz;
        // each wall adds ~12 m of roll-off). Skipped for the car you sit in.
        car.wallT = (car.wallT || 0) - dt; if (car.wallT <= 0) { car.wallT = 0.25; car.walls = mySeat?.car === car || !audible ? 0 : wallsBetween(camera.position, car.pos); }
        car.voice.set(car.rpm, car.thr, car.slip, d + (car.walls || 0) * 12, _v.dot(_v2), audible || car.hornOn || car.hornRemote);
      } else if (car.mode !== 'parked' && car.seats[0] && camera.position.distanceTo(car.pos) < 40 && audioReady()) ensureVoice(car);
    }

    // ---- my seat follows the car (camera + avatar realigned this frame: player.update ran before physics)
    if (mySeat && player.state.seat?.vehicle) {
      const car = mySeat.car; const s = player.state.seat;
      oldSeat.set(s.pos[0], s.pos[1], s.pos[2]); seatWorld(car, mySeat.i, seatP);
      s.pos[0] = seatP.x; s.pos[1] = seatP.y; s.pos[2] = seatP.z; const cy = yawOf(car.quat); s.yaw = cy;
      _v.copy(seatP).sub(oldSeat);
      if (player.state.thirdPerson) {
        // chase camera: orbit a pivot above the car's middle; re-centre behind the car when the mouse is idle
        if (t - mouseT > 1100 && Math.abs(car.speed) > 1.5) {
          const want = car.speed < -1 ? cy + Math.PI : cy; let d = want - player.state.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          const k = 1 - Math.exp(-dt * 2.2); player.state.yaw += d * k; player.state.pitch += (-0.16 - player.state.pitch) * k;
        }
        const [cd, lift] = car.def.cam; const want = cd * THREE.MathUtils.clamp(player.state.camWant / 3, 0.5, 1.9);
        const piv = _v2.set(0, car.size.y * 0.7, car.ctr.z * 0.5).applyQuaternion(car.quat).add(car.pos); piv.y += lift;
        _e.set(player.state.pitch, player.state.yaw, 0, 'YXZ'); const back = _v.set(0, 0, 1).applyEuler(_e);
        ray.origin.x = piv.x; ray.origin.y = piv.y; ray.origin.z = piv.z; ray.dir.x = back.x; ray.dir.y = back.y; ray.dir.z = back.z;
        const hit = world.castRay(ray, want, true, GROUND_FLAGS, undefined, undefined, car.body);
        const d = hit ? Math.max(1.2, hit.timeOfImpact - 0.25) : want;
        chaseD = d < chaseD ? d : chaseD + (d - chaseD) * (1 - Math.exp(-dt * 2.5));
        camera.position.copy(piv).addScaledVector(back, chaseD); camera.quaternion.setFromEuler(_e);
        ray.dir.x = 0; ray.dir.y = -1; ray.dir.z = 0;
      } else {
        /* driver's head: back from the wheel (+z = rearward) and a little higher, but always under the roof
           (bbox top - 0.13) so the lens never pokes out of the cabin */
        const seat = car.def.seats[mySeat.i]; const roof = car.ctr.y + car.size.y / 2 - 0.13;
        const ey = Math.min(seat[1] + car.def.eye + 0.12, roof) - seat[1];
        camera.position.copy(_v.set(0, ey, 0.28).applyQuaternion(car.quat).add(seatP));
      }
      const cr = player.creature?.root; if (cr) { cr.position.x += seatP.x - oldSeat.x; cr.position.y += seatP.y - oldSeat.y; cr.position.z += seatP.z - oldSeat.z; cr.rotation.y = cy; }
      if (mySeat) hud.speed(car.speed);
      if (mySeat?.i === 0 && car.mode === 'local' && Math.abs(car.speed) > 0.5) car.abandonT = 0;
    } else if (mySeat && !player.state.seat) { const c = mySeat.car; getOut(c, false); } // stood up some other way (teleport, menu)

    // ---- remote player capsules (kinematic, multiplayer.js) must not touch a driven chassis in the solver: Rapier
    // processes a pair if EITHER collider allows it, so their capsules opt out of dynamic contacts too (props keep
    // colliding with them: the props' own default types still allow it)
    if (api?.peers) for (const r of api.peers.values()) { const c = r.collider; if (c && !r.__carSafe) { try { c.setActiveCollisionTypes(TYPES_CAPSULE); r.__carSafe = true; } catch {} } }

    // ---- remote players sitting in cars: snap their avatars to the seat (their own stream is 18 Hz)
    for (const car of cars) for (let i = 0; i < car.seats.length; i++) {
      const s = car.seats[i]; if (!s || isMe(s.id)) continue; const r = api?.peers?.get?.(s.id); const cr = r?.creature?.root; if (!cr || r.pose !== 'sit') continue;
      seatWorld(car, i, seatP); cr.position.x += seatP.x - r.pos.x; cr.position.y += seatP.y - r.pos.y; cr.position.z += seatP.z - r.pos.z; cr.rotation.y = yawOf(car.quat);
    }

    // ---- shove the local walking player out of moving cars (their capsule is kinematic: the car would stop dead)
    if (!player.state.seat) {
      pl.copy(player.state.pos);
      for (const car of cars) {
        if (car.mode === 'parked') continue;
        _q.copy(car.quat).invert(); _v.copy(pl).sub(car.pos).applyQuaternion(_q);
        const hx = car.size.x / 2 + 0.3, hz = car.size.z / 2 + 0.3;
        if (Math.abs(_v.x) > hx || Math.abs(_v.z - car.ctr.z) > hz || _v.y < -0.6 || _v.y > car.size.y + 0.2) continue;
        const dx = hx - Math.abs(_v.x), dz = hz - Math.abs(_v.z - car.ctr.z);
        if (dx < dz) _v.x = Math.sign(_v.x || 1) * (hx + 0.05); else _v.z = car.ctr.z + Math.sign((_v.z - car.ctr.z) || 1) * (hz + 0.05);
        _v.applyQuaternion(car.quat).add(car.pos);
        const ny = Math.max(pl.y, groundAt(_v.x, _v.z, pl.y + 1.0) ?? pl.y);
        player.body.setTranslation({ x: _v.x, y: ny + 0.83, z: _v.z }, true); player.state.pos.set(_v.x, ny, _v.z);
        _v2.copy(_v).sub(pl).setY(0).normalize(); const kick = 2 + Math.abs(car.speed) * 0.5;
        player.state.vel.x = _v2.x * kick; player.state.vel.z = _v2.z * kick; player.state.vy = Math.min(4, 1.5 + Math.abs(car.speed) * 0.15);
      }
    }

    // ---- push my driven car away from remote-driven (kinematic) cars: two circles each
    for (const a of cars) {
      if (a.mode !== 'local') continue;
      for (const b of cars) {
        if (b === a || b.mode !== 'remote') continue;
        for (const za of [-0.25, 0.25]) for (const zb of [-0.25, 0.25]) {
          const pa = _v.set(0, 0, za * a.size.z).applyQuaternion(a.quat).add(a.pos), pb = _v2.set(0, 0, zb * b.size.z).applyQuaternion(b.quat).add(b.pos);
          const ra = Math.max(a.size.x, a.size.z * 0.5) / 2, rb = Math.max(b.size.x, b.size.z * 0.5) / 2;
          const d = pa.distanceTo(pb); if (d > ra + rb || d < 1e-3) continue;
          const n = pa.sub(pb).setY(0).normalize(); const pen = ra + rb - d; const lv = a.body.linvel(); const vn = lv.x * n.x + lv.z * n.z;
          const j = a.def.mass * (Math.max(0, -vn) * 1.2 + pen * 4);
          a.body.applyImpulse({ x: n.x * j, y: 0, z: n.z * j }, true);
        }
      }
    }

    // ---- seat heartbeats (1 Hz) + host: return abandoned cars after 2 min
    beatAcc += dt; if (beatAcc > 1) { beatAcc = 0; for (const car of cars) for (let i = 0; i < car.seats.length; i++) { const s = car.seats[i]; if (!s) continue; if (isMe(s.id)) { s.beat = t; sendSeat(car, i, true); } else if (t - s.beat > 3500) { car.seats[i] = null; driverChanged(car); } } }
    hostAcc += dt; if (hostAcc > 5) {
      for (const car of cars) {
        const empty = car.seats.every(s => !s);
        if (car.mode === 'parked' && empty && car.homeP && car.pos.distanceTo(car.homeP) > 8) /* polish: homeP is unset until the car is placed (threw every 5 s, killing the frame) */ car.abandonT += hostAcc; else car.abandonT = 0;
        if (car.abandonT >= 120 && isHost()) { const hp = car.home(); makeParked(car, hp.p, hp.q, true); }
      }
      hostAcc = 0;
    }

    // ---- headlight spot (only the local player's car, only at night; created on first need)
    const mine = mySeat && mySeat.i === 0 ? mySeat.car : null;
    /* polish4: brighter, warm-white, flatter falloff (decay 1.6 -> 1.3, 900 -> 2000 cd), ~6 deg down, reach capped at 30 m by headRange —
       at 900 cd the road (lit at a grazing angle) stayed black past the bumper */
    if (mine && night && !spot) { spot = new THREE.SpotLight(0xffe9cc, 0, 30, 0.5, 0.6, 1.3); spot.castShadow = false; spot.userData.keep = true; scene.add(spot, spot.target); }
    if (spot) {
      if (mine && night) { _v.set(0, 0.75, -mine.size.z / 2).applyQuaternion(mine.quat).add(mine.pos); spot.position.copy(_v); spot.target.position.copy(_v2.set(0, -0.75, -mine.size.z / 2 - 14).applyQuaternion(mine.quat).add(mine.pos)); spot.target.updateMatrixWorld(); spot.intensity = 2000;
        spot.distance = headRange(mine, dt); }
      else spot.intensity = 0;
    }
  });

  // ---------------------------------------------------------------- debug / tests
  const dbg = window.__cars = {
    get cars() { return cars; }, get mySeat() { return mySeat ? { car: mySeat.car.def.name, i: mySeat.i } : null; },
    loading, rec, phys, groundAt,
    enter: (c, i = 0) => { const car = typeof c === 'number' ? cars[c] : cars.find(x => x.def.name === c); if (car) enter(car, i); return !!mySeat; },
    exit: () => exitCar(),
    reset: () => mySeat && resetCar(mySeat.car),
    state: (c) => { const car = typeof c === 'number' ? cars[c] : cars.find(x => x.def.name === c); if (!car) return null; return { name: car.def.name, mode: car.mode, pos: car.pos.toArray().map(r3), yaw: +yawOf(car.quat).toFixed(3), speed: +car.speed.toFixed(2), steer: +car.steer.toFixed(3), contact: car.contact, seats: car.seats.map(s => (s ? realId(s.id) : null)), up: +(_v.set(0, 1, 0).applyQuaternion(car.quat).y).toFixed(3) }; },
    tris: () => cars.map(c => c?.vis.tris),
    get headlight() { return spot ? { intensity: spot.intensity, distance: +spot.distance.toFixed(2), pos: spot.position.toArray().map(r3) } : null; }, // contain test
  };
  return dbg;
}
