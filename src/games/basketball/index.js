// Basketball on the sports court (hoops on the long fences, lines painted across the tennis court; src/games/court.js).
// "E::PICK UP A BALL" at the rack (or Games panel -> Basketball): mode card — Free shoot / HORSE (2+) / 1v1 to 11
// (vs a friend or the bot: alternating shots, 2 or 3 points from behind the arc). Walk with the ball (it dribbles),
// hold the left mouse button to charge (meter: the green zone is the right power for your distance), release to
// shoot at the nearest hoop; look further up for a higher arc. Ball = Rapier dynamic sphere (CCD) vs a rim made of
// 16 small sphere colliders, a backboard box and the floor; a cheap animated net swishes. Sounds: swish / rim / board.
// Sync (mp.channel('hoops')): each ball's owner is its authority and broadcasts {k:'b', id, p, v, h} at 15 Hz; others
// extrapolate + smooth. The shooter's client decides make / miss ({k:'res'}) and, in HORSE / 1v1, publishes the new
// match state M ({k:'state', M}; turn-based, so the current shooter owns the state). Idle: no per-frame work.
import * as THREE from 'three';
import { C2, BB, venue, botAvatar } from '../court.js';
import { chip } from '../ui.js';
import { sfx } from '../sfx.js';
import { aimArm } from '../arms.js';
import { nextEmote } from '../../avatars/anim.js';

const ICON = '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3v14M5 5c3 3 3 7 0 10M15 5c-3 3-3 7 0 10"/>';
const AREA = { pos: [BB.rack[0] + 1.6, C2.y - 0.035, BB.rack[1] - 0.6], yaw: Math.PI / 2 };
const FL = C2.y, VIS = 0.035, GRAV = 9.81, R = BB.ballR, LET = 'HORSE';
// bot / auto shooting spots around the west hoop (dx toward court, dz)
const SPOTS = [[1.5, 0], [3.2, -1.6], [3.2, 1.6], [4.6, 0], [2, -3.5], [2, 3.5], [6.6, 0], [5.2, -3.6], [5.2, 3.6], [1.0, -5.0]];

export function createBasketball(ctx, mp, hub) {
  const { scene, camera, player, phys } = ctx; const st = player.state; const RA = phys.RAPIER, world = phys.world;
  const V = venue(ctx, mp, hub, { chan: 'hoops', title: 'Basketball', place: 'SPORTS COURT' });
  const { send, me, peers, nameOf, ui } = V;
  let M = null; let built = false; const balls = new Map(); // id -> { mesh, body?, held, tp, tv, tAt, shot }
  const opts = { auto: false, botAcc: 0.012 };
  const stats = { shots: 0, makes: 0, swishes: 0, log: [] };
  const local = { on: false, charging: false, chargeAt: 0, power: 0, lastSend: 0, botCr: null, botEm: 0, botAt: 0, nets: [], aimLock: false };
  const meter = V.el('<div class="cv-meter pg-stage"><div class="mono" id="bk-m-t"></div><div class="cv-bar"><span class="zone"></span><i style="width:0"></i></div></div>', true);
  const isPlayer = () => !!M && M.players.includes(me());
  const turnId = () => (M && M.mode !== 'free' ? M.players[M.turn] : null);
  const myTurn = () => !M || M.mode === 'free' || turnId() === me() || (turnId() === 'bot' && M.players[0] === me());
  const snap = () => JSON.parse(JSON.stringify(M));

  // ---------------------------------------------------------------- lazy build: rim colliders, nets
  function build() {
    if (built) return; built = true;
    for (let i = 0; i < 2; i++) {
      const [rx, rz, d] = BB.rims[i]; const ry = BB.rimY - VIS;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; world.createCollider(RA.ColliderDesc.ball(0.012).setTranslation(rx + Math.cos(a) * BB.rimR, ry, rz + Math.sin(a) * BB.rimR).setRestitution(0.55)); }
      world.createCollider(RA.ColliderDesc.cuboid(0.025, 0.53, 0.9).setTranslation(BB.boards[i], BB.rimY + 0.75 - VIS, rz).setRestitution(0.6));
      // net: open tapered tube, vertices sway on a swish
      const g = new THREE.CylinderGeometry(BB.rimR, BB.rimR * 0.62, 0.42, 14, 4, true); g.translate(0, -0.21, 0);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, wireframe: true, transparent: true, opacity: 0.85 });
      const net = new THREE.Mesh(g, mat); net.position.set(rx, BB.rimY, rz); net.userData.keep = true; scene.add(net);
      local.nets.push({ net, base: Float32Array.from(g.attributes.position.array), amp: 0, t: 0 });
    }
  }
  function ballOf(id) {
    let b = balls.get(id); if (b) return b; build();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshStandardMaterial({ color: 0xc8611f, roughness: 0.7 }));
    const seams = new THREE.Mesh(new THREE.TorusGeometry(R * 1.002, 0.004, 4, 24), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); mesh.add(seams, seams.clone().rotateY(Math.PI / 2));
    scene.add(mesh); b = { id, mesh, body: null, held: true, tp: new THREE.Vector3(BB.rack[0], FL + 1, BB.rack[1]), tv: new THREE.Vector3(), tAt: performance.now(), shot: null, idleAt: 0 };
    mesh.position.copy(b.tp); balls.set(id, b); return b;
  }
  function bodyOf(b) {
    if (b.body) return b.body;
    b.body = world.createRigidBody(RA.RigidBodyDesc.dynamic().setTranslation(b.mesh.position.x, b.mesh.position.y - VIS, b.mesh.position.z).setCcdEnabled(true).setLinearDamping(0.0).setAngularDamping(0.3));
    world.createCollider(RA.ColliderDesc.ball(R).setRestitution(0.78).setFriction(0.6).setDensity(0.6 / (4 / 3 * Math.PI * R ** 3)), b.body); return b.body;
  }
  function dropBall(id) { const b = balls.get(id); if (!b) return; if (b.body) { try { world.removeRigidBody(b.body); } catch {} } scene.remove(b.mesh); balls.delete(id); }
  const owns = (id) => id === me() || (id === 'bot' && M?.players[0] === me());

  // ---------------------------------------------------------------- modes
  function startMatch(mode, opp) {
    const players = mode === 'free' ? [me()] : [me(), opp || 'bot'];
    const n = { mid: Date.now() + '-' + me(), mode, players, names: Object.fromEntries(players.map(id => [id, nameOf(id)])), turn: 0, score: players.map(() => 0), letters: players.map(() => 0), spot: null, setter: -1, phase: 'play', winner: -1, rev: 1, n: 0 };
    stats.log.length = 0; setState(n); send({ k: 'state', M: snap() }); V.closeJoin();
  }
  function setState(n) {
    const prev = M; M = n;
    if (!M) { local.on = false; document.body.classList.remove('pg-venue'); for (const id of [...balls.keys()]) dropBall(id); ui.show(meter, false); V.hideHud(); if (local.botCr) local.botCr.root.visible = false; return; }
    build(); local.on = isPlayer(); document.body.classList.toggle('pg-venue', local.on);
    if (M.players.includes('bot')) { if (!local.botCr) botAvatar(ctx, 0.6, 'Bot').then(c => { local.botCr = c; }); else local.botCr.root.visible = true; }
    for (const id of M.players) if (owns(id)) { const b = ballOf(id); if (!prev || prev.turn !== M.turn || prev.mid !== M.mid) { if (b.body) b.body.setEnabled(false); b.held = true; b.shot = null; } }
    if (owns(turnId()) && M.mode === 'horse' && M.spot && turnId() === me() && (!prev || prev.turn !== M.turn)) player.teleport(M.spot[0], FL - VIS, M.spot[1]);
    if (turnId() === 'bot' && (!prev || prev.turn !== M.turn || prev.mid !== M.mid)) local.botAt = performance.now() + 1600;
    if (M.phase === 'over' && (!prev || prev.phase !== 'over')) showWin();
    render();
  }
  function leave() { if (M) { if (M.mode !== 'free' && M.phase !== 'over' && isPlayer()) send({ k: 'state', M: { ...snap(), phase: 'over', winner: M.players.findIndex(p => p !== me()), reason: 'forfeit', rev: M.rev + 1 } }); else send({ k: 'drop', id: me() }); setState(null); } }

  // ---------------------------------------------------------------- shooting
  const rimFor = (x) => (Math.abs(x - BB.rims[0][0]) < Math.abs(x - BB.rims[1][0]) ? BB.rims[0] : BB.rims[1]);
  function idealSpeed(p0, rim, theta) { const d = Math.hypot(rim[0] - p0.x, rim[1] - p0.z), h = BB.rimY - p0.y; const c = Math.cos(theta); const den = 2 * c * c * (d * Math.tan(theta) - h); return den > 0 ? Math.sqrt(GRAV * d * d / den) : 12; }
  function release(id, from, yawLook, pitch, power, noise = 0) {
    const b = ballOf(id); const rim = rimFor(from.x); const p0 = new THREE.Vector3(from.x, FL + 2.15, from.z);
    const toRim = Math.atan2(rim[0] - p0.x, rim[1] - p0.z); let dy = Math.atan2(Math.sin(yawLook - toRim), Math.cos(yawLook - toRim)); dy = Math.abs(dy) > 0.8 ? dy : dy * 0.25; // assist near the rim line
    const theta = THREE.MathUtils.clamp(0.88 + pitch * 0.5, 0.7, 1.15); const v = idealSpeed(p0, rim, theta) * (0.75 + 0.5 * power) * (1 + noise);
    const yaw = toRim + dy + (noise ? noise * 0.6 : 0); const vh = v * Math.cos(theta);
    const vel = { x: Math.sin(yaw) * vh, y: v * Math.sin(theta), z: Math.cos(yaw) * vh };
    const dist = Math.hypot(rim[0] - from.x, rim[1] - from.z); const pts = dist > BB.three ? 3 : 2;
    const body = bodyOf(b); body.setEnabled(true); body.setTranslation({ x: p0.x, y: p0.y - VIS, z: p0.z }, true); body.setLinvel(vel, true); body.setAngvel({ x: -vel.z * 2, y: 0, z: vel.x * 2 }, true);
    b.held = false; b.shot = { rim, pts, rimHit: false, boardHit: false, made: false, done: false, at: performance.now(), prevY: p0.y, from: [from.x, from.z] }; b.idleAt = 0;
    stats.shots++; send({ k: 'b', id, p: [p0.x, p0.y, p0.z], v: [vel.x, vel.y, vel.z], h: 0, t: performance.now() });
    if (id === me()) st.emote = nextEmote(st.emote, 5); else local.botEm = nextEmote(local.botEm, 5);
  }
  function resolve(id, b, made) {
    const s = b.shot; if (!s || s.done) return; s.done = true; s.made = made; if (made) { stats.makes++; if (!s.rimHit && !s.boardHit) stats.swishes++; }
    const swish = made && !s.rimHit && !s.boardHit; const entry = { n: stats.log.length, shooter: id, made, pts: made ? s.pts : 0, swish };
    stats.log.push(entry); send({ k: 'res', id, made, pts: s.pts, swish, mid: M?.mid, n: M?.n });
    resultFx(id, made, s.pts, swish);
    if (!M || M.mode === 'free') return;
    const n = snap(); const i = n.players.indexOf(id); n.n++; n.rev++;
    if (n.mode === 'duel') { if (made) n.score[i] += s.pts; if (n.score[i] >= 11) { n.phase = 'over'; n.winner = i; } else n.turn = (n.turn + 1) % n.players.length; }
    else { // HORSE
      if (n.setter < 0) { if (made) { n.setter = i; n.spot = s.from; } n.turn = (n.turn + 1) % n.players.length; }
      else { if (!made) n.letters[i]++; const alive = n.players.map((_, k) => n.letters[k] < 5);
        if (alive.filter(Boolean).length <= 1) { n.phase = 'over'; n.winner = alive.indexOf(true); }
        else { let t = (n.turn + 1) % n.players.length; while (!alive[t]) t = (t + 1) % n.players.length; if (t === n.setter) { n.setter = -1; n.spot = null; } n.turn = t; } }
    }
    setTimeout(() => { if (M && M.mid === n.mid) { send({ k: 'state', M: n }); setState(n); } }, 1200);
  }
  function resultFx(id, made, pts, swish) { if (made) { V.banner(swish ? 'Swish' : '+' + pts, chip(nameOf(id).toUpperCase().slice(0, 12), pts + ' PT', 'role'), 1100); if (swish) sfx('net', 1); } }

  // ---------------------------------------------------------------- network
  V.ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'chal' && m.to === me()) { V.showChallenge(from); return; }
    if (m.k === 'hello') { if (M && isPlayer() && M.mode !== 'free') send({ k: 'state', M: snap() }, from); return; }
    if (m.k === 'state' && m.M && Array.isArray(m.M.players)) {
      if (M && M.mid === m.M.mid && m.M.rev <= M.rev) return;
      if (!m.M.players.includes(me()) && M && isPlayer() && M.mode !== 'free' && M.phase !== 'over') return;
      if (!m.M.players.includes(me())) { if (m.M.mode !== 'free') spectate = m.M; return; }
      setState(m.M); return;
    }
    if (m.k === 'drop') { dropBall(m.id); return; }
    if (m.k === 'b' && typeof m.id === 'string' && (from === m.id || (m.id === 'bot'))) {
      if (owns(m.id)) return; const b = ballOf(m.id); const off = mp?.net?.clock?.(from);
      b.tp.fromArray(m.p); b.tv.fromArray(m.v); b.held = !!m.h; b.tAt = Number.isFinite(off) ? m.t + off : performance.now() - 40; if (!m.h && !b.shot) b.shot = null; return;
    }
    if (m.k === 'res') { stats.log.push({ n: stats.log.length, shooter: m.id, made: m.made, pts: m.made ? m.pts : 0, swish: m.swish, remote: true }); if (m.made) { stats.makes++; netSwish(m.id); } resultFx(m.id, m.made, m.pts, m.swish); }
  };
  let spectate = null;
  mp?.onPeerLeave?.((id) => { dropBall(id); if (M && M.mode !== 'free' && M.players.includes(id) && M.phase !== 'over') setState({ ...snap(), phase: 'over', winner: M.players.findIndex(p => p !== id), reason: 'forfeit', rev: M.rev + 1 }); });
  function netSwish(id) { const b = balls.get(id); const x = b ? b.mesh.position.x : 0; local.nets[Math.abs(x - BB.rims[0][0]) < Math.abs(x - BB.rims[1][0]) ? 0 : 1] && (local.nets[Math.abs(x - BB.rims[0][0]) < Math.abs(x - BB.rims[1][0]) ? 0 : 1].amp = 1); }

  // ---------------------------------------------------------------- input: hold to charge, release to shoot
  const locked = () => !!document.pointerLockElement;
  const canShoot = () => local.on && M.phase !== 'over' && myTurn() && turnId() !== 'bot' && balls.get(me())?.held;
  document.addEventListener('mousedown', (e) => { if (e.button !== 0 || !locked() || !canShoot()) return; e.stopImmediatePropagation(); local.charging = true; local.chargeAt = performance.now(); }, true);
  document.addEventListener('mouseup', (e) => { if (e.button !== 0 || !local.charging) return; local.charging = false; if (canShoot()) shootNow(local.power); }, true);
  function shootNow(power) { const f = st.pos; release(me(), new THREE.Vector3(f.x - Math.sin(st.yaw) * 0.3, 0, f.z - Math.cos(st.yaw) * 0.3), st.yaw + Math.PI, st.pitch, power); }
  const idealPower = () => 0.5; // speed is scaled from the ideal speed for the distance: 50% = on target

  // ---------------------------------------------------------------- per frame
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  ctx.onUpdate((dt, t) => {
    if (!M && !balls.size) return;
    const now = performance.now();
    if (local.charging) { local.power = Math.min(1, (now - local.chargeAt) / 1200); }
    for (const [id, b] of balls) {
      if (owns(id)) {
        if (b.held) { // in hand: dribble while walking, chest when still
          const isBot = id === 'bot'; const pos = isBot ? botPos : st.pos; const yaw = isBot ? botYaw : st.facing;
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw); const moving = !isBot && st.speed > 0.6;
          const y = local.charging && !isBot ? FL + 2.0 : moving ? FL + R + Math.abs(Math.sin(t * 8.5)) * 0.85 : FL + 1.05;
          if (moving && Math.abs(Math.sin(t * 8.5)) < 0.12 && now - (b.dribAt || 0) > 200) { b.dribAt = now; sfx('cushion', 0.35); }
          b.mesh.position.set(pos.x + fx * 0.42 + fz * 0.18, y, pos.z + fz * 0.42 - fx * 0.18);
        } else if (b.body) {
          const p = b.body.translation(), r = b.body.rotation(); b.mesh.position.set(p.x, p.y + VIS, p.z); b.mesh.quaternion.set(r.x, r.y, r.z, r.w);
          const s = b.shot; if (s && !s.done) shotTrack(id, b, s, now);
          const lv = b.body.linvel(); const slow = Math.hypot(lv.x, lv.y, lv.z) < 0.4;
          if (!b.idleAt && (s?.done || slow)) b.idleAt = now;
          if (b.idleAt && now - b.idleAt > (M?.mode === 'free' ? 2500 : 1800)) { if (s && !s.done) resolve(id, b, false); b.body.setEnabled(false); b.held = true; b.shot = null; b.idleAt = 0; }
          if (s && !s.done && now - s.at > 6000) resolve(id, b, false);
        }
        if (now - (b.lastSend || 0) > 66) { b.lastSend = now; const p = b.mesh.position; const lv = b.body && !b.held ? b.body.linvel() : { x: 0, y: 0, z: 0 }; send({ k: 'b', id, p: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)], v: [lv.x, lv.y, lv.z], h: b.held ? 1 : 0, t: now }); }
      } else { // remote: extrapolate + smooth
        const age = Math.min(0.25, Math.max(0, (now - b.tAt) / 1000));
        _v.copy(b.tp).addScaledVector(b.tv, age); if (!b.held) _v.y -= 0.5 * GRAV * age * age; if (_v.y < FL + R) _v.y = FL + R;
        b.mesh.position.lerp(_v, 1 - Math.exp(-dt * 18));
      }
    }
    // bot turn
    if (M && turnId() === 'bot' && owns('bot') && M.phase !== 'over' && balls.get('bot')?.held && now > local.botAt) {
      const sp = M.mode === 'horse' && M.spot ? [M.spot[0] - BB.rims[0][0], M.spot[1] - BB.rims[0][1]] : SPOTS[(Math.random() * SPOTS.length) | 0];
      botPos.set(BB.rims[0][0] + sp[0], FL - VIS, BB.rims[0][1] + sp[1]); botYaw = Math.atan2(-(BB.rims[0][0] - botPos.x), -(BB.rims[0][1] - botPos.z));
      local.botAt = now + 99999; setTimeout(() => { if (M && turnId() === 'bot') release('bot', botPos.clone(), botYaw + Math.PI, 0, 0.5, (Math.random() - 0.5) * 2 * opts.botAcc); }, 700);
    }
    // auto (tests): my turn -> shoot from a spot
    if (M && opts.auto && local.on && myTurn() && turnId() !== 'bot' && M.phase !== 'over' && balls.get(me())?.held && !local.autoWait) {
      local.autoWait = true; setTimeout(() => { local.autoWait = false; if (!M || !myTurn() || !balls.get(me())?.held) return; const sp = M.mode === 'horse' && M.spot ? [M.spot[0] - BB.rims[0][0], M.spot[1] - BB.rims[0][1]] : SPOTS[(Math.random() * SPOTS.length) | 0];
        const x = BB.rims[0][0] + sp[0], z = BB.rims[0][1] + sp[1]; player.teleport(x, FL - VIS, z, Math.atan2(-(BB.rims[0][0] - x), -(BB.rims[0][1] - z)));
        release(me(), new THREE.Vector3(x, 0, z), st.yaw + Math.PI, 0, 0.5, (Math.random() - 0.5) * 2 * opts.botAcc); }, 900);
    }
    if (local.botCr && M?.players.includes('bot')) { local.botCr.root.visible = true; local.botCr.update(dt, { pos: botPos, vel: _w.set(0, 0, 0), yaw: botYaw, grounded: true, swimming: false, pose: 'stand', emote: local.botEm }); }
    // my avatar holds the ball
    const mb = balls.get(me()); if (mb?.held && player.creature) { _v.copy(mb.mesh.position); aimArm(player.creature, 'R', _v, 0.8); }
    // nets
    for (const N of local.nets) { if (N.amp < 0.01) continue; N.t += dt; N.amp *= Math.exp(-dt * 2.5); const pa = N.net.geometry.attributes.position; const a = pa.array;
      for (let i = 0; i < pa.count; i++) { const y = N.base[i * 3 + 1]; const k = -y / 0.42; a[i * 3] = N.base[i * 3] * (1 - 0.25 * k * N.amp * Math.sin(N.t * 18)); a[i * 3 + 2] = N.base[i * 3 + 2] * (1 - 0.25 * k * N.amp * Math.sin(N.t * 18)); a[i * 3 + 1] = y * (1 + 0.25 * N.amp * Math.sin(N.t * 12)); }
      pa.needsUpdate = true; if (N.amp < 0.01) { a.set(N.base); pa.needsUpdate = true; } }
    // meter
    ui.show(meter, local.charging); if (local.charging) { const el = meter.querySelector('i'); el.style.width = (local.power * 100).toFixed(0) + '%'; const z = meter.querySelector('.zone'); const ip = idealPower(); z.style.left = ((ip - 0.07) * 100) + '%'; z.style.width = '14%';
      const f = st.pos; const rim = rimFor(f.x); ui.setHtml(meter.querySelector('#bk-m-t'), chip('POWER', (local.power * 100).toFixed(0)) + ' ' + chip('SHOT', Math.hypot(rim[0] - f.x, rim[1] - f.z) > BB.three ? '3 PT' : '2 PT', 'role')); }
  });
  const botPos = new THREE.Vector3(BB.rims[0][0] + 3, FL - VIS, BB.rims[0][1]); let botYaw = 0;
  function shotTrack(id, b, s, now) {
    const p = b.mesh.position; const rim = s.rim;
    const dr = Math.hypot(p.x - rim[0], p.z - rim[1]);
    if (Math.abs(Math.hypot(dr - BB.rimR, p.y - BB.rimY)) < R + 0.025 && now - (s.rimAt || 0) > 150) { s.rimHit = true; s.rimAt = now; sfx('cue', 0.9); }
    const bx = BB.boards[BB.rims.indexOf(rim)]; if (Math.abs(p.x - bx) < R + 0.04 && Math.abs(p.z - rim[1]) < 0.92 && p.y > BB.rimY - 0.2 && now - (s.boardAt || 0) > 150) { s.boardHit = true; s.boardAt = now; sfx('cushion', 1); }
    if (s.prevY >= BB.rimY && p.y < BB.rimY && dr < BB.rimR - R * 0.35) { resolve(id, b, true); const k = BB.rims.indexOf(rim); if (local.nets[k]) local.nets[k].amp = 1; }
    s.prevY = p.y; if (p.y < FL + 0.5 && !s.done) resolve(id, b, false);
  }

  // ---------------------------------------------------------------- UI
  function render() {
    const on = !!M && (local.on || Math.abs(st.pos.x - BB.mid) < 13 && Math.abs(st.pos.z - BB.z) < 10); ui.show(V.SCORE, on && M.mode !== 'free'); ui.show(V.KEYS, local.on);
    if (!M) return;
    if (M.mode !== 'free') { const val = (i) => (M.mode === 'duel' ? M.score[i] : LET.slice(0, M.letters[i]) || '–');
      V.score(V.side(nameOf(M.players[0]) + (M.players[0] === me() ? ' (you)' : ''), val(0), '', M.turn === 0), chip(M.mode === 'duel' ? 'TO' : 'GAME', M.mode === 'duel' ? '11' : 'HORSE', 'alt') + chip('SHOOTS', nameOf(turnId()).toUpperCase().slice(0, 10), 'role'), V.side(nameOf(M.players[1]) + (M.players[1] === me() ? ' (you)' : ''), val(1), '', M.turn === 1)); }
    V.keys([['WASD', 'DRIBBLE'], ['HOLD CLICK', 'CHARGE'], ['RELEASE', 'SHOOT'], ['LOOK UP', 'ARC'], ['E', 'LEAVE']]);
  }
  setInterval(() => { if (M) render(); }, 300);
  function showWin() {
    if (!M || !isPlayer()) return; const w = M.winner;
    V.showWin(`${nameOf(M.players[w])} wins`, chip('BASKETBALL', M.mode === 'duel' ? '1V1 TO 11' : 'HORSE') + (M.reason === 'forfeit' ? ' ' + chip('RESULT', 'FORFEIT', 'alt') : ''),
      M.players.map((p, i) => [nameOf(p), M.mode === 'duel' ? M.score[i] : LET.slice(0, M.letters[i]) || '–', i === w]), () => startMatch(M.mode, M.players.find(p => p !== me())), () => leave());
  }
  const openJoin = () => {
    V.openJoin([{ a: 'free', label: 'Free shoot', sub: 'Your own ball. Shoot around.', pri: true }, { a: 'duel', label: '1v1 vs bot', sub: 'Alternate shots, 2 / 3 pts, to 11.' }, { a: 'horse', label: 'HORSE vs bot', sub: 'Match the made shot or take a letter.' }],
      'hold click to charge · release in the green · challenge = 1v1');
  };
  V.onJoin = (a) => { if (a === 'free') startMatch('free'); else startMatch(a, 'bot'); };
  V.onAccept = (f) => startMatch('duel', f);
  if (ctx.interact) {
    ctx.interact.add({ id: 'hoops:rack', pos: new THREE.Vector3(BB.rack[0], FL + 0.7, BB.rack[1]), radius: 0.8, range: 2.6, label: () => (local.on ? 'PUT THE BALL BACK' : 'PICK UP A BALL'), use: () => { if (local.on) leave(); else openJoin(); } });
  }

  const api = {
    get state() { return M ? snap() : null; }, stats, opts, startMatch, leave, openJoin, accept: V.accept, challenge: (id) => V.challenge(id),
    shoot: (power = 0.5) => { if (canShoot()) { shootNow(power); return true; } return false; },
    ball: (id = me()) => { const b = balls.get(id); return b ? { p: b.mesh.position.toArray(), held: b.held } : null; }, balls: () => [...balls.keys()],
    set auto(v) { opts.auto = !!v; }, get auto() { return opts.auto; }, get spectate() { return spectate; },
  };
  window.__basketball = api;
  return { id: 'basketball', title: 'Basketball', kind: 'place', icon: ICON, minPlayers: 1, maxPlayers: 4, area: AREA, areaName: 'SPORTS COURT',
    blurb: 'Two hoops across the tennis court. Free shoot, HORSE or 1v1 to 11.', start() { openJoin(); },
    status() { return { players: M ? M.players.filter(p => p !== 'bot').length : 0, live: !!M && M.mode !== 'free' && M.phase !== 'over' }; } };
}
