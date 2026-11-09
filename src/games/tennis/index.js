// Tennis on the sports court (src/games/court.js) — a 'place' game for the hub. "E::PLAY TENNIS" at either baseline:
// join card (vs bot / wait / challenge). WASD moves you on your half (court axes; you auto-face the ball), click or
// Space swings: if the ball is within reach during the ~0.3 s swing window it is hit — mouse X/Y aims (yellow ring on
// the far court: side + depth) and timing (early/late) pulls the shot. Ball: gravity, drag, topspin dip, bounces,
// net. Simplified serve (click: toss + hit into the diagonal service box, 2 tries). Tennis scoring 0/15/30/40/deuce/
// AD, first to opts.games (4) games; serve alternates per game.
// Sync (mp.channel('tennis')): match state M replicated as full snapshots ({k:'state'|'point', M}); every hit is
// broadcast {k:'hit', mid, point, n, side, p, v, spin, t} with the hitter's clock; the receiver fast-forwards by the
// latency. The client of the side that must return the ball decides the point (pingpong pattern).
// Idle: nothing per frame unless a match exists; meshes + bot avatar are built lazily.
import * as THREE from 'three';
import { C2, venue, botAvatar } from '../court.js';
import { chip } from '../ui.js';
import { sfx } from '../sfx.js';
import { aimArm, handPos } from '../arms.js';
import { nextEmote } from '../../avatars/anim.js';

const { cx: CX, cz: CZ, hl: HL, sw: SW } = C2; const Y0 = C2.y, BR = 0.034, NET = 0.95, GRAV = 9.81, KD = 0.006, KT = 0.05;
const sgn = (side) => (side === 0 ? 1 : -1);
const AREA = { pos: [CX + 1.2, C2.y - 0.035, CZ - HL - 1.6], yaw: Math.PI };
const ICON = '<circle cx="7" cy="7" r="4.6"/><path d="M10.3 10.3l5.7 5.7"/><circle cx="15.5" cy="4.5" r="1.6"/>';
const PTS = ['0', '15', '30', '40'];

export function step(b, dt) { // -> 'bounce' | 'net' | null
  const [vx, vy, vz] = b.v; const sp = Math.hypot(vx, vy, vz), vh = Math.hypot(vx, vz);
  b.v[0] -= KD * sp * vx * dt; b.v[2] -= KD * sp * vz * dt; b.v[1] += (-GRAV - KD * sp * vy - KT * b.spin * vh) * dt;
  const oz = b.p[2]; b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
  if ((oz - CZ) * (b.p[2] - CZ) <= 0 && oz !== b.p[2] && b.p[1] < Y0 + NET + BR && Math.abs(b.p[0] - CX) < C2.hw + 0.95) { b.p[2] = CZ - Math.sign(b.v[2]) * (BR + 0.01); b.v[2] *= -0.15; b.v[0] *= 0.3; b.v[1] *= 0.2; return 'net'; }
  if (b.v[1] < 0 && b.p[1] < Y0 + BR) { b.p[1] = Y0 + BR; b.v[1] = -b.v[1] * 0.7; const k = 0.78 + 0.05 * b.spin; b.v[0] *= k; b.v[2] *= k; b.spin *= 0.5; return Math.abs(b.v[1]) > 0.4 ? 'bounce' : 'roll'; }
  return null;
}
const sim = (b, T, dt = 1 / 120) => { const c = { p: b.p.slice(), v: b.v.slice(), spin: b.spin }; const out = { land: null, netY: null }; let t = 0;
  while (t < T) { const oz = c.p[2]; const e = step(c, dt); t += dt; if ((oz - CZ) * (c.p[2] - CZ) <= 0 && out.netY === null) out.netY = c.p[1]; if (e === 'net') { out.netY = -1; } if (e === 'bounce' || e === 'roll') { out.land = [c.p[0], c.p[2], t]; break; } } return out; };
// velocity from p that lands near (tx, tz) with horizontal speed ~spd and clears the net
export function aimShot(p, tx, tz, spd, spin) {
  let T = Math.hypot(tx - p[0], tz - p[2]) / spd; let v = [0, 0, 0]; let ax = tx, az = tz;
  for (let it = 0; it < 6; it++) {
    const dx = ax - p[0], dz = az - p[2]; v = [dx / T, ((Y0 + BR - p[1]) + 0.5 * GRAV * T * T) / T, dz / T];
    const r = sim({ p, v, spin }, 4); if (!r.land) break;
    if (r.netY !== null && r.netY < Y0 + NET + 0.12) { T *= 1.12; continue; }
    ax += (tx - r.land[0]) * 0.9; az += (tz - r.land[1]) * 0.9; if (Math.hypot(tx - r.land[0], tz - r.land[1]) < 0.15) break;
  }
  return v;
}

export function createTennis(ctx, mp, hub) {
  const { scene, camera, player } = ctx; const st = player.state;
  const V = venue(ctx, mp, hub, { chan: 'tennis', title: 'Tennis', place: 'SPORTS COURT' });
  const { send, me, peers, nameOf, ui } = V;
  let M = null; const ball = { p: [CX, Y0 + 1, CZ], v: [0, 0, 0], spin: 0 }; let live = false;
  const R = { hitter: -1, bounces: [], n: 0, decided: false, serveAt: 0, log: [], sw: [-9, -9], lastHitAt: -9 };
  const P = [{ x: CX, z: CZ - HL - 1 }, { x: CX, z: CZ + HL + 1 }];
  const bot = [{ tx: CX, tz: 0, n: -1, err: 0, swung: -1 }, { tx: CX, tz: 0, n: -1, err: 0, swung: -1 }];
  const opts = { auto: false, speed: 1, botMiss: 0.12, games: 4 };
  const local = { at: false, side: -1, iFroze: false, aimX: 0, aimD: 0.6, camP: new THREE.Vector3(), camQ: new THREE.Quaternion(), camInit: false, prevThird: true };
  const stats = { hits: 0, points: 0, rallies: [] };
  let G = null, botCr = null, botEm = 0;
  const controller = (side) => { if (!M) return null; const p = M.players[side]; return p === 'bot' ? M.players[1 - side] : p; };
  const iControl = (side) => controller(side) === me();
  const isPlayer = () => !!M && M.players.includes(me());
  const botSide = (side) => !!M && (M.players[side] === 'bot' || (opts.auto && M.players[side] === me()));
  const snap = () => JSON.parse(JSON.stringify(M));
  const near = () => Math.abs(st.pos.x - CX) < 13 && Math.abs(st.pos.z - CZ) < 20;

  function build() { // lazy meshes
    if (G) return; G = new THREE.Group(); G.name = 'tennis'; scene.add(G);
    G.ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8f03a, roughness: 0.9, emissive: 0x303a08, emissiveIntensity: 0.5 }));
    G.shadow = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    G.aim = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0.8, depthWrite: false }));
    const mk = (c) => { const r = new THREE.Group(); const fm = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 });
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20), fm); fr.scale.set(0.8, 1, 1); fr.position.y = 0.42;
      const st2 = new THREE.Mesh(new THREE.CircleGeometry(0.125, 16), new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); st2.scale.set(0.8, 1, 1); st2.position.y = 0.42;
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x222222 })); h.position.y = 0.14; r.add(fr, st2, h); return r; };
    G.rk = [mk(0xc4262e), mk(0x1f4fb5)]; G.add(G.ball, G.shadow, G.aim, ...G.rk);
  }

  // ---------------------------------------------------------------- match lifecycle
  function setState(n) {
    const prev = M; M = n;
    if (!M) { live = false; if (G) G.visible = false; exitCourt(); V.hideHud(); return; }
    build(); G.visible = true;
    if (M.players.includes('bot') && !botCr) botAvatar(ctx, 0.02, 'Bot').then(c => { botCr = c; c.root.visible = !!M && M.players.includes('bot'); });
    if (botCr) botCr.root.visible = M.players.includes('bot');
    if (!prev || prev.mid !== M.mid || prev.point !== M.point || prev.faults !== M.faults) newPoint();
    if (isPlayer() && M.mode !== 'wait' && M.phase !== 'over' && !local.at) enterCourt();
    if (M.phase === 'over' && (!prev || prev.phase !== 'over')) showWin();
    render();
  }
  const serveSx = () => { const t = M.pts[0] + M.pts[1]; return (t % 2 === 0 ? 1 : -1) * -sgn(M.server); }; // server's x side (right-hand court first)
  function newPoint() {
    live = false; R.hitter = -1; R.bounces = []; R.n = 0; R.decided = false; R.serveAt = performance.now() + 1100 / opts.speed; R.sw = [-9, -9];
    const sx = serveSx();
    for (const side of [0, 1]) { const s = sgn(side); P[side].x = side === M.server ? CX + sx * 1.0 : CX - sx * 2.6; P[side].z = CZ - s * (HL + (side === M.server ? 0.3 : 0.9)); bot[side].n = -1; }
  }
  function startMatch(mode, opp, side = 0) {
    const players = mode === 'bot' ? (side === 0 ? [me(), 'bot'] : ['bot', me()]) : mode === 'wait' ? [me(), null] : [opp, me()];
    const n = { mid: Date.now() + '-' + me(), mode, players, names: Object.fromEntries(players.filter(Boolean).map(id => [id, nameOf(id)])), pts: [0, 0], games: [0, 0], server: Math.random() < 0.5 ? 0 : 1, point: 0, faults: 0, phase: 'serve', winner: -1, rev: 1, to: opts.games };
    stats.rallies.length = 0; R.log.length = 0; setState(n); send({ k: 'state', M: snap() }); V.closeJoin();
    if (mode === 'wait') ui.toast('Waiting for a challenger — anyone pressing E at the court plays you', 3500);
  }
  function scoreText(side) { if (!M) return ''; const a = M.pts[side], b = M.pts[1 - side]; if (a >= 3 && b >= 3) return a === b ? '40' : a > b ? 'AD' : '40'; return PTS[Math.min(3, a)]; }
  function awardPoint(w, reason) {
    if (!M || M.phase === 'over' || R.decided) return; R.decided = true;
    const n = snap(); n.pts[w]++; n.faults = 0; let game = false;
    if (n.pts[w] >= 4 && n.pts[w] - n.pts[1 - w] >= 2) { n.games[w]++; n.pts = [0, 0]; n.server = 1 - n.server; game = true; }
    if (n.games[w] >= (n.to || 4)) { n.phase = 'over'; n.winner = w; } else n.phase = 'serve';
    n.point++; n.rev++; n.reason = reason;
    stats.points++; stats.rallies.push({ point: M.point, hits: R.n, winner: w, reason }); R.log.push({ point: M.point, hits: R.n, winner: w });
    send({ k: 'point', M: n, winner: w, why: reason, hits: R.n, game }); pointFx(w, reason, game); setState(n);
  }
  function fault() { // serve fault: second serve or double fault
    if (!M || R.decided) return; if (M.faults >= 1) return awardPoint(1 - M.server, 'double fault');
    R.decided = true; const n = { ...snap(), faults: 1, rev: M.rev + 1 }; send({ k: 'state', M: n }); V.banner('Fault', chip('SERVE', 'SECOND', 'role'), 1000); sfx('net', 0.4); setState(n);
  }
  function pointFx(w, reason, game) { sfx('net', 0.4); V.banner(game ? 'Game ' + nameOf(M.players[w]) : nameOf(M.players[w]), chip('POINT', String(reason || '').toUpperCase(), 'role'), 1300); }
  function leave() {
    if (M && isPlayer()) { if (M.mode === '1v1' && M.phase !== 'over') send({ k: 'state', M: { ...snap(), phase: 'over', winner: 1 - M.players.indexOf(me()), reason: 'forfeit', rev: M.rev + 1 } }); else send({ k: 'state', M: { ...snap(), reset: 1 } }); setState(null); }
    exitCourt(); ui.show(V.WIN, false);
  }

  // ---------------------------------------------------------------- hits
  function doHit(side, quality, ax, ad, serve) {
    const s = sgn(side); const p = serve ? [P[side].x, Y0 + 2.55, P[side].z + s * 0.2] : ball.p.slice(); if (p[1] < Y0 + 0.15) p[1] = Y0 + 0.15;
    let tx, tz, spd, spin;
    if (serve) { const sx = serveSx(); tx = CX - sx * (1.2 + Math.abs(ax) * 2.2); tz = CZ + s * (4.0 + ad * 1.8); spd = 19 + quality * 4; spin = 0.4; }
    else { tx = CX + Math.max(-1, Math.min(1, ax)) * SW * 0.8; tz = CZ + s * (3 + ad * 7.6); spd = 13 + quality * 9 + ad * 3; spin = 0.5 + quality; }
    const v = aimShot(p, tx, tz, spd, spin);
    ball.p = p; ball.v = v; ball.spin = spin; live = true;
    R.hitter = side; R.bounces = []; R.n++; R.decided = false; stats.hits++; R.lastHitAt = performance.now(); R.serve = !!serve;
    if (M.phase === 'serve') M.phase = 'rally';
    sfx('paddle', 1); swingFx(side);
    send({ k: 'hit', mid: M.mid, point: M.point, f: M.faults, n: R.n, side, p: ball.p, v: ball.v, spin, serve: !!serve, t: performance.now() });
  }
  function swingFx(side) { if (M.players[side] === 'bot') botEm = nextEmote(botEm, 4); else if (M.players[side] === me()) st.emote = nextEmote(st.emote, 4); }
  function trySwing(side) { // human swing press (or bot / auto)
    if (!M || M.phase === 'over' || !iControl(side)) return false;
    if (M.phase === 'serve' && !live) { if (M.server !== side || performance.now() < R.serveAt || R.decided) return false; doHit(side, 0.7, local.aimX, local.aimD, true); return true; }
    R.sw[side] = performance.now(); if (side === local.side && !botSide(side)) swingFx(side); return true;
  }
  function reachable(side) {
    if (!live || R.hitter !== 1 - side || R.decided) return false; const d = (ball.p[2] - CZ) * sgn(side); if (d > 0.2) return false;
    if (R.bounces.length > 1) return false; return Math.hypot(ball.p[0] - P[side].x, ball.p[2] - P[side].z) < 1.45 && ball.p[1] < Y0 + 2.7;
  }

  // ---------------------------------------------------------------- rules on the receiver's client
  function onEvent(ev) {
    if (!ev || !M || R.hitter < 0) return; const h = R.hitter, r = 1 - h;
    if (ev === 'net') sfx('net', 0.6);
    if (ev !== 'bounce' && ev !== 'roll') return; if (ev === 'bounce') sfx('table', 0.5);
    if (!iControl(r) || R.decided) return;
    const half = ball.p[2] < CZ ? 0 : 1; R.bounces.push(half);
    if (R.bounces.length === 1) {
      const ok = half === r && inHalfOf(r, ball.p[0], ball.p[2], R.serve);
      if (!ok) return R.serve ? fault() : awardPoint(r, half === h ? 'net' : 'out');
      return;
    }
    if (R.bounces.length >= 2) return awardPoint(h, R.bounces[0] === r ? 'winner' : 'out');
  }
  function inHalfOf(side, x, z, serve) { if (Math.abs(x - CX) > SW + BR) return false; const d = (z - CZ) * -sgn(side); // >0 inside side's half
    if (d < 0) return false; if (serve) { const sx = serveSx(); return d <= 6.4 + BR && (x - CX) * sx <= BR; } return d <= HL + BR; }

  // ---------------------------------------------------------------- network
  V.ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'chal' && m.to === me()) { V.showChallenge(from); return; }
    if (m.k === 'hello') { if (M && isPlayer()) send({ k: 'state', M: snap() }, from); return; }
    if (m.k === 'state' && m.M && Array.isArray(m.M.players)) {
      if (m.M.reset) { if (M && M.mid === m.M.mid) setState(null); return; }
      if (M && M.mid === m.M.mid && m.M.rev < M.rev) return;
      if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over' && M.mid !== m.M.mid && !m.M.players.includes(me())) return;
      setState(m.M); return;
    }
    if (!M) return;
    if (m.k === 'point' && m.M?.mid === M.mid && m.M.rev > M.rev) { R.log.push({ point: M.point, hits: m.hits, winner: m.winner }); stats.rallies.push({ point: M.point, hits: m.hits, winner: m.winner, reason: m.why, remote: true }); pointFx(m.winner, m.why, m.game); setState(m.M); return; }
    if (m.k === 'hit' && m.mid === M.mid && m.point === M.point && from === controller(m.side)) {
      ball.p = m.p.slice(); ball.v = m.v.slice(); ball.spin = m.spin; live = true; R.hitter = m.side; R.bounces = []; R.n = m.n; R.decided = false; R.serve = !!m.serve; R.lastHitAt = performance.now();
      if (M.phase === 'serve') M.phase = 'rally'; sfx('paddle', 0.8);
      const off = mp?.net?.clock?.(from); const sent = Number.isFinite(off) ? m.t + off : performance.now() - 40;
      let lag = Math.max(0, Math.min(0.3, (performance.now() - sent) / 1000)) * opts.speed; while (lag > 0) { const d = Math.min(1 / 240, lag); onEvent(step(ball, d)); lag -= d; }
    }
  };
  mp?.onPeerJoin?.((id) => { if (M && isPlayer()) setTimeout(() => send({ k: 'state', M: snap() }, id), 700); });
  mp?.onPeerLeave?.((id) => { if (!M || !M.players.includes(id)) return; if (M.mode !== '1v1') { setState(null); return; } if (M.phase !== 'over') setState({ ...snap(), phase: 'over', winner: M.players.indexOf(id) === 0 ? 1 : 0, reason: 'forfeit', rev: M.rev + 1 }); });
  setTimeout(() => send({ k: 'hello' }), 2300);

  // ---------------------------------------------------------------- input
  const locked = () => !!document.pointerLockElement;
  addEventListener('mousemove', (e) => { if (!local.at || !locked()) return; local.aimX = Math.max(-1, Math.min(1, local.aimX + e.movementX * 0.003)); local.aimD = Math.max(0, Math.min(1, local.aimD - e.movementY * 0.003)); });
  document.addEventListener('mousedown', (e) => { if (!local.at || e.button !== 0 || !locked() || !M) return; e.stopImmediatePropagation(); trySwing(local.side); }, true);
  addEventListener('keydown', (e) => { if (!local.at || e.code !== 'Space' || e.repeat) return; e.preventDefault(); trySwing(local.side); }, true);

  function enterCourt() {
    if (local.at || !M) return; local.side = M.players.indexOf(me()); if (local.side < 0) return;
    local.at = true; local.camInit = false; local.prevThird = st.thirdPerson; V.closeJoin();
    if (!st.frozen) { st.frozen = true; local.iFroze = true; }
    try { if (st.seat) player.setSeat(null); } catch {}
    ui.veil(true); setTimeout(() => ui.veil(false), 320);
    if (ctx.interact) ctx.interact.modal = { tennis: true, label: () => '', use: () => { leave(); return true; } };
    document.body.classList.add('pg-venue'); ui.toast('WASD move · mouse aims (ring) · click / Space swings · E leaves', 3200);
  }
  function exitCourt() {
    if (!local.at) return; local.at = false; local.side = -1;
    if (local.iFroze) { st.frozen = false; local.iFroze = false; }
    if (ctx.interact?.modal?.tennis) ctx.interact.modal = null;
    document.body.classList.remove('pg-venue'); st.thirdPerson = local.prevThird; V.hideHud(); player.teleport(AREA.pos[0], AREA.pos[1], AREA.pos[2], AREA.yaw);
  }

  // ---------------------------------------------------------------- per frame
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), tgtP = new THREE.Vector3(), tgtQ = new THREE.Quaternion();
  ctx.onUpdate((dt) => {
    if (!M) return;
    const now = performance.now(); const sdt = Math.min(dt, 0.05) * opts.speed;
    // movement: humans (WASD, court axes) / bots
    for (const side of [0, 1]) {
      if (!M.players[side] || !iControl(side)) continue; const s = sgn(side); const Q = P[side];
      if (botSide(side)) botDrive(side, sdt);
      else if (side === local.side) { const k = st.keys; let f = 0, r = 0; if (k.has('KeyW') || k.has('ArrowUp')) f++; if (k.has('KeyS') || k.has('ArrowDown')) f--; if (k.has('KeyD') || k.has('ArrowRight')) r++; if (k.has('KeyA') || k.has('ArrowLeft')) r--;
        const sp = (k.has('ShiftLeft') ? 7 : 5.2) * sdt; Q.z += f * s * sp; Q.x += -r * s * sp; }
      Q.x = Math.max(C2.ex0 + 0.6, Math.min(C2.ex1 - 0.6, Q.x)); const zmin = side === 0 ? C2.ez0 + 0.6 : CZ + 0.5, zmax = side === 0 ? CZ - 0.5 : C2.ez1 - 6.5; Q.z = Math.max(zmin, Math.min(zmax, Q.z));
      // swing window: hit when the ball is in reach
      if (now - R.sw[side] < 320 && reachable(side) && now - R.lastHitAt > 250) {
        const tq = (now - R.sw[side]) / 320; const early = tq - 0.35; const quality = Math.max(0, 1 - Math.abs(early) * 1.6);
        if (botSide(side)) doHit(side, 0.55 + Math.random() * 0.4, bot[side].ax, bot[side].ad, false);
        else doHit(side, quality, local.aimX + early * 0.9 * -s, local.aimD, false);
      }
    }
    // serve (bots / auto)
    if (M.phase === 'serve' && !live && iControl(M.server) && botSide(M.server) && now > R.serveAt + 500 / opts.speed) { bot[M.server].ax = Math.random(); bot[M.server].ad = Math.random(); doHit(M.server, 0.5, Math.random(), Math.random() * 0.8, true); }
    if (!live && M.phase === 'serve') { const Q = P[M.server]; ball.p = [Q.x - 0.25 * sgn(M.server), Y0 + 1.0 + Math.abs(Math.sin(now / 300)) * 0.5, Q.z + 0.3 * sgn(M.server)]; }
    // ball
    if (live && M.phase !== 'over') {
      let left = sdt; while (left > 0) { const d = Math.min(1 / 240, left); left -= d; onEvent(step(ball, d)); if (R.decided) break; }
      if ((Math.abs(ball.p[2] - CZ) > 24 || Math.abs(ball.p[0] - CX) > 13 || (Math.hypot(...ball.v) < 0.3 && ball.p[1] < Y0 + 0.1)) && !R.decided) { const r = 1 - R.hitter; if (iControl(r)) { if (R.bounces.length) awardPoint(R.bounces[0] === r ? R.hitter : r, 'winner'); else awardPoint(r, 'out'); } }
      if (R.decided && M.faults === 1) live = false;
    }
    G.ball.position.set(ball.p[0], ball.p[1], ball.p[2]); G.ball.visible = M.phase !== 'over';
    G.shadow.position.set(ball.p[0], Y0 + 0.003, ball.p[2]); G.shadow.visible = G.ball.visible;
    // players / avatars / rackets
    for (const side of [0, 1]) {
      const id = M.players[side]; if (!id) { G.rk[side].visible = false; continue; } const s = sgn(side); const Q = P[side];
      let cr = null; const face = Math.atan2(-(ball.p[0] - Q.x), -(ball.p[2] - Q.z) || -s);
      if (id === me()) { cr = player.creature; if (local.at) { V.place(Q.x, C2.y - 0.035, Q.z, undefined); st.facing = face; } }
      else if (id === 'bot') { cr = botCr; if (cr) { cr.root.visible = true; cr.update(dt, { pos: _a.set(Q.x, C2.y - 0.035, Q.z), vel: _b.set(Q.vx || 0, 0, Q.vz || 0), yaw: face, grounded: true, swimming: false, pose: 'stand', emote: botEm }); } }
      else { const r = peers().get(id); cr = r?.creature; if (r) { Q.x = r.pos.x; Q.z = r.pos.z; } }
      G.rk[side].visible = !!cr;
      if (cr) { if (now - R.sw[side] > 400) { _a.set(Q.x - Math.cos(face) * 0.55, Y0 + 0.9, Q.z + Math.sin(face) * 0.55); aimArm(cr, 'R', _a, 0.6); }
        if (handPos(cr, 'R', _b)) { G.rk[side].position.copy(_b); G.rk[side].rotation.set(0, face, -0.5); } }
    }
    if (local.at && local.side >= 0) {
      const s = sgn(local.side); const Q = P[local.side];
      // aim ring on the far court
      G.aim.visible = M.phase !== 'over'; G.aim.position.set(CX + local.aimX * SW * 0.8, Y0 + 0.004, CZ + s * (3 + local.aimD * 7.6));
      if (!st.thirdPerson) st.thirdPerson = true;
      tgtP.set(Q.x * 0.7 + CX * 0.3, Y0 + 3.6, Math.max(C2.ez0 + 0.6, Math.min(C2.ez1 - 0.6, Q.z - s * 4.2))); _b.set(CX, Y0 + 0.4, CZ + s * 5); _m.lookAt(tgtP, _b, _up); tgtQ.setFromRotationMatrix(_m);
      if (!local.camInit) { local.camP.copy(tgtP); local.camQ.copy(tgtQ); local.camInit = true; }
      const k = 1 - Math.exp(-dt * 6); local.camP.lerp(tgtP, k); local.camQ.slerp(tgtQ, k); camera.position.copy(local.camP); camera.quaternion.copy(local.camQ);
    } else if (G) G.aim.visible = false;
  });
  function botDrive(side, dt) {
    const Q = P[side]; const B = bot[side]; const s = sgn(side); const incoming = live && R.hitter === 1 - side && !R.decided; const now = performance.now();
    if (incoming && B.n !== R.n) { // predict a comfortable hitting point after the bounce
      B.n = R.n; const c = { p: ball.p.slice(), v: ball.v.slice(), spin: ball.spin }; let bounced = false, t = 0, pt = null;
      while (t < 4) { const e = step(c, 1 / 120); t += 1 / 120; if (e === 'bounce') bounced = true; if (bounced && c.v[1] < 0 && c.p[1] < Y0 + 1.1) { pt = c.p.slice(); break; } if ((c.p[2] - CZ) * -s > HL + 4) { pt = c.p.slice(); break; } }
      if (!pt) pt = c.p.slice(); const miss = Math.random() < opts.botMiss; B.err = miss ? (Math.random() < 0.5 ? -1 : 1) * (1.7 + Math.random()) : (Math.random() - 0.5) * 0.5;
      B.tx = pt[0] + 0.5 * -s + B.err; B.tz = pt[2] - s * 0.35; B.ax = (Math.random() - 0.5) * 1.6; B.ad = 0.3 + Math.random() * 0.7;
    }
    let tx = CX, tz = CZ - s * (HL + 0.6);
    if (incoming) { tx = B.tx; tz = B.tz; } else if (M.phase === 'serve') { tx = Q.x; tz = Q.z; }
    const dx = tx - Q.x, dz = tz - Q.z, d = Math.hypot(dx, dz), sp = Math.min(d, 6.2 * dt); if (d > 1e-3) { Q.x += dx / d * sp; Q.z += dz / d * sp; }
    Q.vx = d > 0.05 ? dx / d * 5 : 0; Q.vz = d > 0.05 ? dz / d * 5 : 0;
    if (incoming && reachable(side) && now - R.sw[side] > 400 && Math.hypot(ball.p[0] - Q.x, ball.p[2] - Q.z) < 1.1) { R.sw[side] = now - 110; if (M.players[side] === 'bot') botEm = nextEmote(botEm, 4); else st.emote = nextEmote(st.emote, 4); }
  }

  // ---------------------------------------------------------------- UI
  function render() {
    const on = !!M && M.mode !== 'wait' && (local.at || near()); ui.show(V.SCORE, on); ui.show(V.KEYS, local.at);
    if (!M || !on) return;
    const sub = (side) => `<span class="sub">GAMES ${M.games[side]}</span>`;
    const deuce = M.pts[0] >= 3 && M.pts[1] >= 3 && M.pts[0] === M.pts[1];
    V.score(V.side(nameOf(M.players[0]) + (M.players[0] === me() ? ' (you)' : ''), scoreText(0), sub(0), M.server === 0), chip('FIRST TO', String(M.to || 4), 'alt') + (deuce ? chip('SCORE', 'DEUCE', 'role') : chip('SERVE', M.faults ? '2ND' : '1ST', 'role')),
      V.side(nameOf(M.players[1]) + (M.players[1] === me() ? ' (you)' : ''), scoreText(1), sub(1), M.server === 1));
    V.keys([['WASD', 'MOVE'], ['MOUSE', 'AIM'], ['CLICK', 'SWING / SERVE'], ['E', 'LEAVE']]);
  }
  setInterval(() => { if (M) render(); }, 300);
  function showWin() {
    if (!M) return; const w = M.winner; const mine = isPlayer();
    if (!mine && !near()) { ui.toast(`${nameOf(M.players[w])} won tennis ${M.games[w]}–${M.games[1 - w]}`, 3000); return; }
    V.showWin(`${nameOf(M.players[w])} wins`, chip('TENNIS', 'FIRST TO ' + (M.to || 4)) + ' ' + chip('GAMES', M.games.join('–'), 'role') + (M.reason === 'forfeit' ? ' ' + chip('RESULT', 'FORFEIT', 'alt') : ''),
      [0, 1].map(i => [nameOf(M.players[i]), M.games[i], i === w]), mine ? () => startMatch(M.mode, M.mode === '1v1' ? M.players.find(p => p !== me()) : null, M.players.indexOf(me())) : null, () => { if (isPlayer()) leave(); });
  }
  const openJoin = () => {
    if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over') { enterCourt(); return; }
    const busy = M && M.mode !== 'wait' && M.phase !== 'over'; const waiting = M && M.mode === 'wait' && M.players[0] !== me() ? M.players[0] : null;
    V.openJoin([waiting && { a: 'join', label: 'Play ' + nameOf(waiting), sub: 'They are waiting on court.', pri: true }, { a: 'bot', label: 'Play vs bot', sub: `First to ${opts.games} games. Tennis scoring.`, pri: !waiting, disabled: busy },
      !waiting && { a: 'wait', label: 'Wait for a challenger', sub: 'Anyone pressing E at the court plays you.', disabled: busy }].filter(Boolean), 'WASD move · mouse aims · click swings');
  };
  V.onJoin = (a) => { if (a === 'bot') startMatch('bot', null, 0); else if (a === 'wait') startMatch('wait'); else if (a === 'join' && M?.mode === 'wait') startMatch('1v1', M.players[0]); };
  V.onAccept = (f) => startMatch('1v1', f);
  for (const side of [0, 1]) ctx.interact?.add({ id: 'tennis:' + side, pos: new THREE.Vector3(CX + 1.2, Y0 + 0.5, CZ - sgn(side) * (HL + 1.2)), radius: 1.2, range: 2.8,
    label: () => (M && isPlayer() && M.phase !== 'over' && M.mode !== 'wait' ? 'BACK TO THE COURT' : M && M.mode === 'wait' && M.players[0] !== me() ? 'PLAY ' + nameOf(M.players[0]).toUpperCase() : 'PLAY TENNIS'),
    use: () => { if (M && M.mode === 'wait' && M.players[0] !== me() && !isPlayer()) startMatch('1v1', M.players[0]); else openJoin(); } });

  const api = {
    get state() { return M ? snap() : null; }, get ball() { return { p: ball.p.slice(), v: ball.v.slice() }; }, get live() { return live; }, get at() { return local.at; }, get side() { return local.side; },
    stats, log: R.log, opts, P, startMatch, leave, openJoin, accept: V.accept, challenge: (id) => V.challenge(id), swing: () => trySwing(local.side),
    set auto(v) { opts.auto = !!v; }, get auto() { return opts.auto; }, set speed(v) { opts.speed = Math.max(0.25, Math.min(4, +v || 1)); }, get speed() { return opts.speed; },
  };
  window.__tennis = api;
  return { id: 'tennis', title: 'Tennis', kind: 'place', icon: ICON, minPlayers: 1, maxPlayers: 2, area: AREA, areaName: 'SPORTS COURT',
    blurb: 'Singles on the NE court. Tennis scoring, first to 4 games. Play a friend or the bot.',
    start() { openJoin(); },
    status() { return { players: M && M.mode !== 'wait' ? M.players.filter(p => p && p !== 'bot').length : M ? 1 : 0, live: !!M && M.mode !== 'wait' && M.phase !== 'over' }; } };
}
