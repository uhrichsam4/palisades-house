// Character animation for every avatar (mannequin + imported models): retargeting of the Quaternius Universal
// Animation Library (CC0, assets/anim/ual.glb, built by tools/extract_anim.mjs) onto any humanoid that is mapped
// to the 17 slots below, plus a locomotion state machine with crossfades.
//
// Retargeting = rest-pose-relative world-space deltas in "character space" (avatar root space: y up, facing −z,
// left at −x). Each rig's rest pose is first aligned to a canonical T-pose: limb bones are swung (shortest arc)
// so upper/lower arms point along ∓x and upper/lower legs straight down; hands/feet follow their forearm/shin;
// hips/spine/neck/head keep their rest. For a clip frame, each source bone gives
//     Δ = W_src(t) · (C_src · W_src_rest)⁻¹          (world rotation relative to the canonical rest)
// which is applied to the target as W_tgt = Δ · C_tgt · W_tgt_rest, then turned into a local rotation with the
// target's (already posed) parent. Non-slot bones in between (clavicles, twist bones, extra spines) keep their
// rest local rotation. Hips translation is the source offset from rest scaled by the leg-length ratio (hip joint
// height), so feet stay on the ground. Clips are sampled once at load (30 fps) into Δ arrays shared by all avatars.
//
//   loadAnimLibrary() -> Promise<lib|null>; animLibrary() -> lib|null (sync)
//   bindRig(root, {slot: Object3D}) -> rig        (root must be at identity, model in its rest pose)
//   createAnimator(rig) -> { update(dt, input, lod), setPose(p), pose, hipsY, emote(name) }
//     input: { vel:{x,y,z}, yaw, grounded, swimming, pose:'stand'|'sit'|'lie'|'lean', crouch, emote:seq }
//     returns { lift, pitch, roll, pivotY } for placeRoot(root, pos, yaw, out)
//   avatarLod(camera, pos) -> 0 full | 1 far (>30 m, ~10 Hz) | 2 off-screen (time only)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const SLOTS = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'lowerArmL', 'handL', 'upperArmR', 'lowerArmR', 'handR',
  'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'];
const N = SLOTS.length; const SI = Object.fromEntries(SLOTS.map((s, i) => [s, i]));
export const UAL_BONES = { hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'Head',
  upperArmL: 'upperarm_l', lowerArmL: 'lowerarm_l', handL: 'hand_l', upperArmR: 'upperarm_r', lowerArmR: 'lowerarm_r', handR: 'hand_r',
  upperLegL: 'thigh_l', lowerLegL: 'calf_l', footL: 'foot_l', upperLegR: 'thigh_r', lowerLegR: 'calf_r', footR: 'foot_r' };

// Static poses as joint vectors (shared with src/avatar.js): [hipsY, hipsRx, then per limb (armL, armR, legL, legR):
// pivot rx, ry, rz, knee rx]. Arms rotate from hanging (slightly out), legs from straight down. hipsY is for a
// 0.92 m hip height and is rescaled per rig.
export const POSES = {
  // seated: pelvis 0.12 above the seat point, torso leaning back a touch, thighs forward, shins down, forearms on the thighs
  sit: [0.12, 0.22, 0.23, 0, 0.15, 0.23, 0.23, 0, -0.15, 0.23, 1.28, 0, -0.05, -1.4, 1.28, 0, 0.05, -1.4],
  // lying on the back: whole body rotated, head points behind (+z local), arms at the sides
  lie: [0.12, 1.57, 0.05, 0, -0.18, -0.1, 0.05, 0, 0.18, -0.1, 0.02, 0, -0.04, 0, 0.02, 0, 0.04, 0],
  // leaning back against something: hips forward, one ankle crossed, arms folded
  lean: [0.92, 0.1, 0.3, -0.9, 0.1, 1.17, 0.3, 0.9, -0.1, 1.17, -0.1, 0, 0.1, 0, 0.12, 0, -0.14, 0.08],
  // fallback standing pose (before the clip library has loaded)
  stand: [0.92, 0, 0, 0, -0.08, 0.25, 0, 0, 0.08, 0.25, 0, 0, 0, 0, 0, 0, 0, 0],
};

// clip speeds (m/s at 1x, measured from the stance foot) and per-state tuning
const SPEED = { walk: 1.25, run: 4.2, sprint: 6.5, crouch: 0.85 };
const FPS = 30;
const CANON = { upperArmL: [-1, 0, 0], lowerArmL: [-1, 0, 0], upperArmR: [1, 0, 0], lowerArmR: [1, 0, 0],
  upperLegL: [0, -1, 0], lowerLegL: [0, -1, 0], upperLegR: [0, -1, 0], lowerLegR: [0, -1, 0] };
const CHILD = { upperArmL: 'lowerArmL', lowerArmL: 'handL', upperArmR: 'lowerArmR', lowerArmR: 'handR', upperLegL: 'lowerLegL', lowerLegL: 'footL', upperLegR: 'lowerLegR', lowerLegR: 'footR' };
const UPPER = { lowerArmL: 'upperArmL', lowerArmR: 'upperArmR', lowerLegL: 'upperLegL', lowerLegR: 'upperLegR' };
const FOLLOW = { handL: 'lowerArmL', handR: 'lowerArmR', footL: 'lowerLegL', footR: 'lowerLegR' };
const RIGHT_ARM = [SI.upperArmR, SI.lowerArmR, SI.handR];

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();

// root-space rest transforms + canonical alignment
function restFrames(root, bones) {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const W = {}, P = {}, Wc = {};
  for (const [slot, b] of Object.entries(bones)) { _m.multiplyMatrices(rootInv, b.matrixWorld).decompose(_p, _q, _s); W[slot] = _q.clone(); P[slot] = _p.clone(); }
  const C = {};
  for (const slot of Object.keys(bones)) {
    C[slot] = new THREE.Quaternion();
    const canon = CANON[slot]; if (!canon) continue;
    let d = null;
    if (P[CHILD[slot]]) d = P[CHILD[slot]].clone().sub(P[slot]);
    else if (UPPER[slot] && P[UPPER[slot]]) d = P[slot].clone().sub(P[UPPER[slot]]);
    if (!d || d.lengthSq() < 1e-10) continue;
    C[slot].setFromUnitVectors(d.normalize(), _v.fromArray(canon));
  }
  for (const [h, l] of Object.entries(FOLLOW)) if (C[h] && C[l]) C[h].copy(C[l]);
  for (const slot of Object.keys(bones)) Wc[slot] = C[slot].clone().multiply(W[slot]);
  const legY = (P.upperLegL && P.upperLegR) ? (P.upperLegL.y + P.upperLegR.y) / 2 : (P.hips ? P.hips.y : 0.92);
  return { W, P, Wc, rootInv, legY };
}

// ------------------------------------------------------------------ clip library
let libP = null, lib = null;
export const animLibrary = () => lib;
export function loadAnimLibrary(url = new URL('../../assets/anim/ual.glb', import.meta.url).href) {
  return (libP ??= new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej))
    .then((g) => (lib = buildLibrary(g)))
    .catch((e) => { console.warn('[anim] clip library failed to load:', e?.message || e); return null; }));
}
function buildLibrary(g) {
  const holder = new THREE.Group(); const sc = g.scene; holder.add(sc);
  const bones = {}; for (const [slot, n] of Object.entries(UAL_BONES)) { const o = sc.getObjectByName(n); if (o) bones[slot] = o; }
  holder.updateMatrixWorld(true);
  if (bones.upperArmL.getWorldPosition(new THREE.Vector3()).x > bones.upperArmR.getWorldPosition(new THREE.Vector3()).x) holder.rotation.y = Math.PI; // face −z
  const rest = restFrames(holder, bones);
  const WcInv = {}; for (const s in rest.Wc) WcInv[s] = rest.Wc[s].clone().invert();
  const mixer = new THREE.AnimationMixer(sc);
  const clips = {};
  for (const clip of g.animations) {
    const n = Math.max(2, Math.round(clip.duration * FPS) + 1);
    const q = new Float32Array(n * N * 4), p = new Float32Array(n * 3);
    const act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play();
    for (let i = 0; i < n; i++) {
      mixer.setTime(Math.min(clip.duration - 1e-4, (i / (n - 1)) * clip.duration)); holder.updateMatrixWorld(true);
      for (let k = 0; k < N; k++) {
        const slot = SLOTS[k], b = bones[slot], o = (i * N + k) * 4;
        if (!b) { q[o + 3] = 1; continue; }
        _m.multiplyMatrices(rest.rootInv, b.matrixWorld).decompose(_p, _q, _s); _q.multiply(WcInv[slot]);
        if (i > 0) { const pr = ((i - 1) * N + k) * 4; if (_q.x * q[pr] + _q.y * q[pr + 1] + _q.z * q[pr + 2] + _q.w * q[pr + 3] < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; } }
        q[o] = _q.x; q[o + 1] = _q.y; q[o + 2] = _q.z; q[o + 3] = _q.w;
      }
      _m.multiplyMatrices(rest.rootInv, bones.hips.matrixWorld).decompose(_p, _q, _s);
      p[i * 3] = (_p.x - rest.P.hips.x) / rest.legY; p[i * 3 + 1] = (_p.y - rest.P.hips.y) / rest.legY; p[i * 3 + 2] = (_p.z - rest.P.hips.z) / rest.legY;
    }
    act.stop(); mixer.uncacheAction(clip);
    clips[clip.name] = { name: clip.name, dur: clip.duration, n, q, p };
  }
  return { clips, legY: rest.legY };
}
loadAnimLibrary(); // start fetching as soon as any avatar module is imported

// sample a clip at time t into (q, p) ; loop wraps, otherwise clamps
function sampleClip(c, t, loop, q, p) {
  let f = (t / c.dur) * (c.n - 1);
  if (loop) { f %= (c.n - 1); if (f < 0) f += c.n - 1; } else f = Math.min(Math.max(f, 0), c.n - 1);
  const i0 = Math.floor(f), i1 = Math.min(i0 + 1, c.n - 1), a = f - i0, b = 1 - a;
  const A = c.q, o0 = i0 * N * 4, o1 = i1 * N * 4;
  for (let k = 0; k < N * 4; k += 4) {
    let x = A[o0 + k] * b + A[o1 + k] * a, y = A[o0 + k + 1] * b + A[o1 + k + 1] * a, z = A[o0 + k + 2] * b + A[o1 + k + 2] * a, w = A[o0 + k + 3] * b + A[o1 + k + 3] * a;
    const l = 1 / (Math.hypot(x, y, z, w) || 1); q[k] = x * l; q[k + 1] = y * l; q[k + 2] = z * l; q[k + 3] = w * l;
  }
  for (let k = 0; k < 3; k++) p[k] = c.p[i0 * 3 + k] * b + c.p[i1 * 3 + k] * a;
}

// ------------------------------------------------------------------ rig binding
export function bindRig(root, bonesIn) {
  const bones = {}; for (const s of SLOTS) if (bonesIn[s]) bones[s] = bonesIn[s];
  if (bones.spine && bones.spine === bones.chest) delete bones.spine;
  const rest = restFrames(root, bones);
  const slotOf = new Map(); for (const [s, b] of Object.entries(bones)) slotOf.set(b, s);
  const depth = (o) => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
  const order = Object.keys(bones).sort((a, b) => depth(bones[a]) - depth(bones[b]));
  const info = {};
  for (const s of order) {
    const b = bones[s]; let anc = null; for (let o = b.parent; o; o = o.parent) if (slotOf.has(o)) { anc = slotOf.get(o); break; }
    _m.multiplyMatrices(rest.rootInv, b.parent.matrixWorld).decompose(_p, _q, _s); const parentW0 = _q.clone();
    info[s] = { b, k: SI[s], anc, rel: anc ? rest.W[anc].clone().invert().multiply(parentW0) : null, parentW0, Wc: rest.Wc[s] };
  }
  const hipsParentInv = bones.hips ? new THREE.Matrix4().multiplyMatrices(rest.rootInv, bones.hips.parent.matrixWorld).invert() : null;
  const world = {}; for (const s of order) world[s] = new THREE.Quaternion();
  const hipsP0 = rest.P.hips ? rest.P.hips.clone() : new THREE.Vector3(0, 0.92, 0);
  const rig = {
    bones, legY: rest.legY, hipsY: hipsP0.y, hipsNowY: hipsP0.y,
    // q: Float32Array(17*4) deltas, p: normalized hips offset
    apply(q, p) {
      for (const s of order) {
        const I = info[s], k = I.k * 4; const W = world[s];
        W.set(q[k], q[k + 1], q[k + 2], q[k + 3]).multiply(I.Wc);
        if (I.anc) _q.copy(world[I.anc]).multiply(I.rel); else _q.copy(I.parentW0);
        I.b.quaternion.copy(_q.invert().multiply(W));
      }
      if (hipsParentInv) {
        _v.set(hipsP0.x + p[0] * rest.legY, hipsP0.y + p[1] * rest.legY, hipsP0.z + p[2] * rest.legY);
        rig.hipsNowY = _v.y; bones.hips.position.copy(_v.applyMatrix4(hipsParentInv));
      }
    },
  };
  return rig;
}

// ------------------------------------------------------------------ procedural joint-vector poses -> deltas
const HANG = 0.1; // arms hang slightly away from the body
const H_L = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-Math.sin(HANG), -Math.cos(HANG), 0));
const H_R = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(Math.sin(HANG), -Math.cos(HANG), 0));
const RH = new THREE.Quaternion(), RA = new THREE.Quaternion(), RK = new THREE.Quaternion(), T1 = new THREE.Quaternion();
const putQ = (q, slot, Q) => { const k = SI[slot] * 4; q[k] = Q.x; q[k + 1] = Q.y; q[k + 2] = Q.z; q[k + 3] = Q.w; };
function poseFromJ(J, rig, q, p) {
  RH.setFromEuler(_e.set(J[1], 0, 0));
  for (const s of ['hips', 'spine', 'chest', 'neck', 'head']) putQ(q, s, RH);
  const limbs = [['upperArmL', 'lowerArmL', 'handL', H_L], ['upperArmR', 'lowerArmR', 'handR', H_R], ['upperLegL', 'lowerLegL', 'footL', null], ['upperLegR', 'lowerLegR', 'footR', null]];
  limbs.forEach(([up, lo, end, H], i) => {
    const o = 2 + i * 4;
    RA.setFromEuler(_e.set(J[o], J[o + 1], J[o + 2], 'XYZ'));
    RK.setFromEuler(_e.set(H ? Math.abs(J[o + 3]) : J[o + 3], 0, 0));
    T1.copy(RH).multiply(RA); if (H) T1.multiply(H); putQ(q, up, T1);
    T1.copy(RH).multiply(RA).multiply(RK); if (H) T1.multiply(H); putQ(q, lo, T1); putQ(q, end, T1);
  });
  // hips height: joint vector is for a 0.92 m hip; map 0.12 <-> 0.92 onto 0.12 <-> this rig's hip height
  const y = 0.12 + (J[0] - 0.12) * (rig.hipsY - 0.12) / 0.8;
  p[0] = 0; p[1] = (y - rig.hipsY) / rig.legY; p[2] = 0;
}

// ------------------------------------------------------------------ blending helpers
function makeBuf() { return { q: new Float32Array(N * 4), p: new Float32Array(3) }; }
function acc(A, S, w) {
  if (w <= 0) return;
  for (let k = 0; k < N * 4; k += 4) {
    const d = A.q[k] * S.q[k] + A.q[k + 1] * S.q[k + 1] + A.q[k + 2] * S.q[k + 2] + A.q[k + 3] * S.q[k + 3];
    const ww = d < 0 ? -w : w;
    A.q[k] += S.q[k] * ww; A.q[k + 1] += S.q[k + 1] * ww; A.q[k + 2] += S.q[k + 2] * ww; A.q[k + 3] += S.q[k + 3] * ww;
  }
  A.p[0] += S.p[0] * w; A.p[1] += S.p[1] * w; A.p[2] += S.p[2] * w; A.w = (A.w || 0) + w;
}
function clear(A) { A.q.fill(0); A.p.fill(0); A.w = 0; }
function finish(A) {
  for (let k = 0; k < N * 4; k += 4) {
    const l = Math.hypot(A.q[k], A.q[k + 1], A.q[k + 2], A.q[k + 3]);
    if (l < 1e-8) { A.q[k] = A.q[k + 1] = A.q[k + 2] = 0; A.q[k + 3] = 1; } else { A.q[k] /= l; A.q[k + 1] /= l; A.q[k + 2] /= l; A.q[k + 3] /= l; }
  }
  if (A.w > 0) { A.p[0] /= A.w; A.p[1] /= A.w; A.p[2] /= A.w; }
}
// out = slerp-ish(out -> S, w) on the given slot indices (or all)
function overlay(out, S, w, idx = null) {
  if (w <= 0) return;
  const ks = idx || SLOTS.map((_, i) => i);
  for (const i of ks) {
    const k = i * 4; _q.fromArray(out.q, k); _q2.fromArray(S.q, k); _q.slerp(_q2, w); _q.toArray(out.q, k);
  }
  if (!idx) for (let j = 0; j < 3; j++) out.p[j] += (S.p[j] - out.p[j]) * w;
}
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// ------------------------------------------------------------------ LOD (distance / frustum)
const _fr = new THREE.Frustum(), _sph = new THREE.Sphere(), _pm = new THREE.Matrix4();
export function avatarLod(camera, pos) {
  if (!camera || !pos) return 0;
  const d = camera.position.distanceTo(pos);
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
  _sph.center.set(pos.x, pos.y + 0.9, pos.z); _sph.radius = 1.3;
  if (!_fr.intersectsSphere(_sph)) return 2;
  return d > 30 ? 1 : 0;
}
export function placeRoot(root, pos, yaw, out) {
  root.rotation.set(out.pitch || 0, yaw, out.roll || 0, 'YXZ');
  // pitch/roll pivot around the hips (not the feet) so a pitched swimmer stays where it is
  const py = out.pivotY || 0;
  _v.set(0, py, 0).applyEuler(root.rotation);
  root.position.set(pos.x - _v.x, pos.y + py - _v.y + (out.lift || 0), pos.z - _v.z);
}

// ------------------------------------------------------------------ animator (state machine + crossfades)
// Base layers (weights crossfade linearly, ~0.2 s, then normalise): loco (idle/walk/run/sprint blended by speed,
// phase-synced), crouch (crouch_idle/crouch_walk), swim (swim_idle/swim), jump (jump_start), air (jump_loop),
// land (one-shot, weight by impact), pose:sit/lie/lean (procedural). Overlays: wave emote (full body when standing,
// right arm only while moving), idle_look every so often when standing still.
export function createAnimator(rig) {
  const W = { loco: 1, crouch: 0, swim: 0, jump: 0, air: 0, land: 0, sit: 0, lie: 0, lean: 0 };
  const T = { ...W }; // targets
  const S = makeBuf(), out = makeBuf(), tmp = makeBuf();
  let phase = 0, idleT = 0, idleLookT = -1, nextLook = 7 + Math.random() * 8, crouchPh = 0, swimPh = 0, swimIdleT = 0;
  let jumpT = 0, airT = 0, landT = 9, landK = 0, wasGrounded = true, fallMax = 0, jumping = false, airborne = false;
  let pose = 'stand', speedS = 0, yawPrev = null, roll = 0, pitch = 0, lift = 0;
  let waveT = -1, waveW = 0, emoteSeq = null, breath = 0, accDt = 0, lodTick = 0;
  const ret = { lift: 0, pitch: 0, roll: 0, pivotY: rig.hipsY };

  const clip = (n) => lib && lib.clips[n];
  function sample(name, t, loop) { const c = clip(name); if (!c) { poseFromJ(POSES.stand, rig, S.q, S.p); return S; } sampleClip(c, t, loop, S.q, S.p); return S; }

  function setPose(p) { pose = POSES[p] && p !== 'stand' ? p : 'stand'; }
  function emote(name = 'wave') { if (name === 'wave') waveT = 0; }

  function update(dt, inp = {}, lod = 0) {
    const vel = inp.vel || { x: 0, y: 0, z: 0 };
    if (inp.pose !== undefined) setPose(inp.pose);
    if (inp.emote !== undefined && inp.emote !== emoteSeq) { if (emoteSeq !== null && inp.emote) emote('wave'); emoteSeq = inp.emote; }
    const hs = Math.hypot(vel.x, vel.z), vy = vel.y || 0;
    const grounded = inp.grounded !== false, swimming = !!inp.swimming, crouch = !!inp.crouch;
    speedS += (hs - speedS) * (1 - Math.exp(-dt * 10));
    // turn rate -> lean into turns
    const yaw = inp.yaw || 0; let yawRate = 0;
    if (yawPrev !== null && dt > 0) { yawRate = Math.atan2(Math.sin(yaw - yawPrev), Math.cos(yaw - yawPrev)) / dt; }
    yawPrev = yaw;

    // ---- state -> target weights
    for (const k in T) T[k] = 0;
    let fade = 0.2;
    if (pose !== 'stand') { T[pose] = 1; fade = 0.3; jumpT = 0; airT = 0; landT = 9; }
    else if (swimming) { T.swim = 1; fade = 0.3; airT = 0; landT = 9; }
    else if (!grounded) {
      if (wasGrounded) { airT = 0; jumpT = 0; jumping = vy > 1.0; airborne = false; fallMax = 0; } // take-off / stepped off
      airT += dt; fallMax = Math.max(fallMax, -vy);
      if (jumping && jumpT < 0.5 && vy > -2) { T.jump = 1; jumpT += dt; fade = 0.08; }
      else if (jumping || airborne || airT > 0.15) { jumping = false; airborne = true; T.air = 1; fade = 0.2; }
      else T[crouch ? 'crouch' : 'loco'] = 1; // tiny step off a ledge: keep running
    } else {
      if (!wasGrounded && (airborne || jumping) && airT > 0.2) {
        landT = 0; landK = Math.min(1, Math.max(0, (fallMax - 2) / 5));
        if (speedS < 0.5) landK = Math.max(landK, 0.5); else if (speedS > 2) landK *= 0.4;
      }
      airT = 0; fallMax = 0; jumpT = 0; jumping = false; airborne = false;
      const base = crouch ? 'crouch' : 'loco';
      if (landT < 0.65 && landK > 0) { T.land = landK * (1 - smooth((landT - 0.35) / 0.3)); T[base] = 1 - T.land; fade = landT < 0.05 ? 0.06 : 0.12; }
      else T[base] = 1;
      landT += dt;
    }
    wasGrounded = grounded || swimming || pose !== 'stand';
    let sum = 0;
    for (const k in W) { const d = T[k] - W[k], st = dt / fade; W[k] += Math.max(-st, Math.min(st, d)); if (W[k] < 1e-4) W[k] = 0; sum += W[k]; }
    if (sum <= 0) { W.loco = 1; sum = 1; }

    // ---- advance clocks (always, also when not drawn)
    const c = lib?.clips;
    let wIdle = 1, wWalk = 0, wRun = 0, wSprint = 0, rate = 0;
    {
      const v = speedS;
      if (v < SPEED.walk) { const s = smooth((v - 0.08) / (SPEED.walk - 0.08)); wIdle = 1 - s; wWalk = s; rate = c ? (1 / c.walk.dur) * Math.max(0.55, v / SPEED.walk) : 0; }
      else if (v < SPEED.run) { const s = (v - SPEED.walk) / (SPEED.run - SPEED.walk); wIdle = 0; wWalk = 1 - s; wRun = s; rate = c ? (((1 - s) / c.walk.dur + s / c.run.dur) * v) / ((1 - s) * SPEED.walk + s * SPEED.run) : 0; }
      else if (v < SPEED.sprint) { const s = (v - SPEED.run) / (SPEED.sprint - SPEED.run); wIdle = 0; wRun = 1 - s; wSprint = s; rate = c ? (((1 - s) / c.run.dur + s / c.sprint.dur) * v) / ((1 - s) * SPEED.run + s * SPEED.sprint) : 0; }
      else { wIdle = 0; wSprint = 1; rate = c ? (1 / c.sprint.dur) * Math.min(1.4, v / SPEED.sprint) : 0; }
      phase = (phase + dt * rate) % 1;
    }
    idleT += dt; breath += dt;
    if (W.loco > 0.5 && speedS < 0.1 && pose === 'stand') { nextLook -= dt; if (nextLook <= 0 && idleLookT < 0 && c?.idle_look) { idleLookT = 0; nextLook = 9 + Math.random() * 10; } }
    else nextLook = Math.max(nextLook, 3);
    if (idleLookT >= 0) { idleLookT += dt; if (!c || idleLookT > c.idle_look.dur || speedS > 0.3) idleLookT = -1; }
    const crouchV = speedS; crouchPh = (crouchPh + dt * (c ? (1 / c.crouch_walk.dur) * Math.max(0.6, crouchV / SPEED.crouch) : 0)) % 1;
    const sv = Math.hypot(hs, vy); swimPh = (swimPh + dt * (c ? (1 / c.swim.dur) * Math.min(1.6, Math.max(0.6, sv / 1.4)) : 0)) % 1; swimIdleT += dt;
    if (waveT >= 0) { waveT += dt; const dur = c?.wave?.dur || 2.6; waveW = Math.min(1, waveT / 0.2, (dur - waveT) / 0.3); if (waveT >= dur) { waveT = -1; waveW = 0; } }

    // lean into turns (third-person feel), pitch when diving/rising in water, lift the crawl to the waterline
    const wantRoll = pose === 'stand' && !swimming ? Math.max(-0.22, Math.min(0.22, yawRate * Math.min(speedS, 7) * 0.03)) : 0;
    roll += (wantRoll - roll) * (1 - Math.exp(-dt * 6));
    const swimMove = swimming ? smooth((sv - 0.15) / 0.6) : 0;
    const wantPitch = swimming ? Math.max(-0.7, Math.min(0.7, Math.atan2(-vy, Math.max(0.3, hs)) * swimMove)) : 0;
    pitch += (wantPitch - pitch) * (1 - Math.exp(-dt * 4));
    const wantLift = W.swim * swimMove * 0.3 * (rig.legY / 0.92);
    lift += (wantLift - lift) * (1 - Math.exp(-dt * 4));
    ret.lift = lift; ret.pitch = pitch; ret.roll = roll; ret.pivotY = rig.hipsY;

    // ---- LOD: off-screen -> clocks only; far -> ~10 Hz pose updates
    if (lod === 2) return ret;
    if (lod === 1) { accDt += dt; if (++lodTick % 6) return ret; accDt = 0; }

    // ---- evaluate + blend
    clear(out);
    if (W.loco) {
      clear(tmp);
      if (wIdle > 0) {
        const lw = idleLookT >= 0 && c ? smooth(Math.min(idleLookT / 0.4, (c.idle_look.dur - idleLookT) / 0.5)) : 0;
        if (lw < 1) acc(tmp, sample('idle', idleT, true), wIdle * (1 - lw));
        if (lw > 0) acc(tmp, sample('idle_look', idleLookT, false), wIdle * lw);
      }
      if (c) {
        if (wWalk > 0) acc(tmp, sample('walk', phase * c.walk.dur, true), wWalk);
        if (wRun > 0) acc(tmp, sample('run', phase * c.run.dur, true), wRun);
        if (wSprint > 0) acc(tmp, sample('sprint', phase * c.sprint.dur, true), wSprint);
      }
      finish(tmp); acc(out, tmp, W.loco);
    }
    if (W.crouch) {
      clear(tmp); const s = smooth((crouchV - 0.08) / 0.5);
      if (s < 1) acc(tmp, sample('crouch_idle', idleT, true), 1 - s);
      if (s > 0 && c) acc(tmp, sample('crouch_walk', crouchPh * c.crouch_walk.dur, true), s);
      finish(tmp); acc(out, tmp, W.crouch);
    }
    if (W.swim) {
      clear(tmp);
      if (swimMove < 1) acc(tmp, sample('swim_idle', swimIdleT, true), 1 - swimMove);
      if (swimMove > 0 && c) acc(tmp, sample('swim', swimPh * c.swim.dur, true), swimMove);
      finish(tmp); acc(out, tmp, W.swim);
    }
    if (W.jump) acc(out, sample('jump_start', 0.1 + jumpT, false), W.jump);
    if (W.air) acc(out, sample('jump_loop', idleT, true), W.air);
    if (W.land) acc(out, sample('land', 0.04 + landT * 1.15, false), W.land);
    for (const p of ['sit', 'lie', 'lean']) if (W[p]) {
      const J = POSES[p].slice(); J[1] += Math.sin(breath * 1.6) * 0.012; // breathing so seated people don't look frozen
      poseFromJ(J, rig, S.q, S.p); acc(out, S, W[p]);
    }
    finish(out);
    if (waveW > 0 && c?.wave) {
      sample('wave', waveT, false);
      const moving = Math.max(W.swim + W.air + W.jump, smooth(speedS / 1.0), W.sit + W.lie + W.lean);
      overlay(out, S, waveW * (1 - moving));
      overlay(out, S, waveW * moving * (W.lie > 0.5 ? 0 : 1), RIGHT_ARM);
    }
    rig.apply(out.q, out.p);
    return ret;
  }
  return { update, setPose, emote, get pose() { return pose; }, get hipsY() { return rig.hipsNowY; }, get weights() { return { ...W }; }, rig };
}
