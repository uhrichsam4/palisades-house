// Ping-pong on the east pool deck — a 'place' game for the hub (src/games/index.js). Table: src/rooms/pool.js.
// "E::PLAY PING-PONG" at either end (or Games panel → Ping-pong): join panel (PLAY VS BOT / WAIT FOR A CHALLENGER /
// CHALLENGE <player>). Your paddle follows the mouse on a vertical plane 0.3 m behind your end line (reach-limited);
// swing speed (mouse velocity) sets pace and depth, vertical swing adds top/backspin, sideways swing + where the
// ball meets the blade aim it left/right. A ball reaching your plane after a legal bounce on your half is hit if
// the blade is within ~13 cm. Serve: click (or swing) — simplified, no own-half bounce. First to 11, win by 2,
// serve changes every 2 points (every point from 10-10). Procedural click sounds (src/games/sfx.js).
//
// Sync (mp.channel('pong')): match state M = { mid, mode: 'wait'|'1v1'|'bot', players:[west, east], score, server,
// first, phase: 'serve'|'rally'|'over', winner, point, rev }. Every hit is broadcast with the ball state and the
// hitter's timestamp {k:'hit', mid, point, n, side, p, v, top, spin, t}; the receiver adopts it, fast-forwarded by
// the measured latency, and simulates. The client of the side that must return the ball decides the point
// ({k:'point'}): it is the side where the rally ended. Paddle positions go out at 15 Hz ({k:'pad'}) for the
// opponent's paddle + avatar arm. Late joiners: {k:'hello'} -> a player answers with the state.
// Idle: no per-frame work unless a match exists.
import * as THREE from 'three';
import { TX, TZ, TY, HL, HW, BR, planeX, sgn, makeBall, copyBall, step, aimShot, predictCross } from './sim.js';
import { chip, esc } from '../ui.js';
import { sfx } from '../sfx.js';
import { aimArm } from '../arms.js';

const ICON = '<circle cx="8" cy="8" r="5"/><path d="M11.5 11.5l4.5 4.5"/><circle cx="15.5" cy="5" r="1.4"/>';
const AREA = { pos: [TX - HL - 1.15, -0.1, TZ + 0.9], yaw: -Math.PI / 2 - 0.35 };
const REACH = 0.13, Y_MIN = TY + 0.02, Y_MAX = TY + 0.95, Z_REACH = 1.05;
const CSS = `
#pq-score { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 9; display: flex; align-items: stretch; gap: 0; pointer-events: none;
  background: var(--surf); border: var(--hair); border-radius: 6px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); overflow: hidden; }
#pq-score.pg-stage { transform: translate(-50%, -6px); } #pq-score.pg-stage.on { transform: translate(-50%, 0); }
.pq-side { display: flex; align-items: center; gap: 10px; padding: 8px 14px; min-width: 170px; }
.pq-side.r { flex-direction: row-reverse; text-align: right; }
.pq-side .nm { font-size: 15px; font-weight: 500; letter-spacing: -0.03em; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.pq-side .sc { font: 500 34px/1 "Geist", -apple-system, Inter, sans-serif; letter-spacing: -0.06em; min-width: 40px; text-align: center; }
.pq-side .sc .roll-c { line-height: 1; }
.pq-srv { width: 9px; height: 9px; border-radius: 50%; background: transparent; border: 1px solid rgba(247,247,247,.15); flex: none; transition: background .25s var(--es); }
.pq-srv.on { background: #f2c84b; border-color: #f2c84b; box-shadow: 0 0 8px rgba(242,200,75,.55); }
.pq-mid { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 6px 10px; background: var(--bg); border-left: var(--hair); border-right: var(--hair); }
#pq-ban { position: fixed; left: 50%; top: 28%; translate: -50% 0; z-index: 56; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 24px 12px;
  background: rgba(30,30,30,.86); border: var(--hair); border-radius: 6px; box-shadow: 0 24px 60px rgba(0,0,0,.4); }
#pq-ban .big { font: 500 54px/1 "Geist", -apple-system, Inter, sans-serif; letter-spacing: -0.06em; }
#pq-ban .big .roll-c { line-height: 1; }
#pq-keys { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 9; display: flex; gap: 6px; pointer-events: none; }
`;

export function createPingPong(ctx, mp, hub) {
  const { scene, camera, player } = ctx; const st = player.state; const ui = hub.ui;
  const ch = mp?.channel ? mp.channel('pong') : { send() {}, onMessage: null };
  const me = () => mp?.net?.selfId || 'local';
  const peers = () => mp?.peers || new Map();
  const nameOf = (id) => (id === 'bot' ? 'Bot' : id === me() ? (mp?.selfName?.() || 'You') : peers().get(id)?.name || M?.names?.[id] || 'Guest');

  let M = null;                  // replicated match
  const ball = makeBall(); let live = false;  // local ball simulation
  // rally bookkeeping (local): last hitter, bounces since that hit, hit counter, responsible side
  const R = { hitter: -1, bounces: [], n: 0, point: -1, decided: false, served: false, serveAt: 0, log: [] };
  const pad = [{ y: TY + 0.3, z: TZ, vy: 0, vz: 0, ty: TY + 0.3, tz: TZ, py: 0, pz: 0 }, { y: TY + 0.3, z: TZ, vy: 0, vz: 0, ty: TY + 0.3, tz: TZ, py: 0, pz: 0 }];
  const bot = [{ target: null, err: [0, 0], swing: 4, hitN: -1 }, { target: null, err: [0, 0], swing: 4, hitN: -1 }];
  const opts = { speed: 1, auto: false, botMiss: 0.1 };
  let local = { at: false, side: -1, iFroze: false, lastPad: 0, padSig: '', camP: new THREE.Vector3(), camQ: new THREE.Quaternion(), camInit: false, stand: '', prevThird: true };
  const stats = { hits: 0, points: 0, rallies: [] };

  // ---------------------------------------------------------------- meshes (built once, hidden until a match)
  const g = new THREE.Group(); g.name = 'pingpong'; g.visible = false; scene.add(g);
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BR, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff6ea, roughness: 0.35, emissive: 0x332a20, emissiveIntensity: 0.4 }));
  ballMesh.castShadow = false; g.add(ballMesh);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.2, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); g.add(ballShadow);
  const mkPaddle = (rubber) => {
    const p = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.012, 28).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: rubber, roughness: 0.75 }));
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.0765, 0.0765, 0.004, 28).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })); back.position.x = -0.006;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.028), new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.6 })); handle.position.set(-0.002, -0.115, 0);
    p.add(blade, back, handle); p.traverse(o => { if (o.isMesh) o.castShadow = true; }); return p;
  };
  const paddles = [mkPaddle(0xc4262e), mkPaddle(0x1f4fb5)]; for (const p of paddles) g.add(p);

  // ---------------------------------------------------------------- DOM
  if (!document.getElementById('pq-css')) { const s = document.createElement('style'); s.id = 'pq-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.getElementById('pg');
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstChild; root.appendChild(n); n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('click', e => e.stopPropagation()); return n; };
  const SCORE = el('<div id="pq-score" class="pg-stage"><div class="pq-side" id="pq-s0"></div><div class="pq-mid" id="pq-mid"></div><div class="pq-side r" id="pq-s1"></div></div>');
  const BAN = el('<div id="pq-ban" class="pg-stage"><div class="big" id="pq-ban-big"></div><div id="pq-ban-sub"></div></div>');
  const KEYS = el('<div id="pq-keys" class="pg-stage"></div>');
  const JOIN = el('<div id="pq-join" class="pp-card pg-stage" role="dialog" aria-label="Ping-pong"></div>');
  const WIN = el('<div id="pq-win" class="pp-card pg-stage" role="dialog" aria-label="Ping-pong result"></div>');
  const CHAL = el('<div id="pq-chal" class="pp-card pg-stage" role="status" style="top:auto;bottom:74px;translate:-50% 0;display:flex;align-items:center;gap:12px;padding:12px 14px"><span class="pg-dot"></span><div style="flex:1;min-width:0"><div class="pg-inv-title" id="pq-chal-t"></div></div><button type="button" class="pri" id="pq-chal-y">Accept</button><button type="button" id="pq-chal-n">Decline</button></div>');
  for (const n of [SCORE, BAN, KEYS]) n.style.pointerEvents = 'none';
  const $ = (id) => document.getElementById(id);
  let banT = 0; const banner = (big, sub, ms = 1500) => { ui.roll($('pq-ban-big'), big); ui.setHtml($('pq-ban-sub'), sub || ''); ui.show(BAN, true); clearTimeout(banT); banT = setTimeout(() => ui.show(BAN, false), ms); };

  // ---------------------------------------------------------------- helpers
  const controller = (side) => { if (!M) return null; const p = M.players[side]; return p === 'bot' ? M.players[1 - side] : p; };
  const iControl = (side) => controller(side) === me();
  const isPlayer = () => !!M && M.players.includes(me());
  const botSide = (side) => !!M && (M.players[side] === 'bot' || (opts.auto && M.players[side] === me()));
  const send = (m, to) => { try { ch.send(m, to); } catch {} };
  const snap = () => JSON.parse(JSON.stringify(M));
  const broadcast = () => { if (M) send({ k: 'state', M: snap() }); };
  const nearTable = () => Math.hypot(st.pos.x - TX, st.pos.z - TZ) < 4.5;
  const serverOf = (sc, first) => { const t = sc[0] + sc[1]; if (sc[0] >= 10 && sc[1] >= 10) return (first + t) % 2; return (first + Math.floor(t / 2)) % 2; };

  // ---------------------------------------------------------------- match lifecycle
  function setState(n) {
    const prev = M; M = n;
    if (!M) { live = false; g.visible = false; exitTable(); hide(); return; }
    g.visible = true;
    if (!prev || prev.mid !== M.mid || prev.point !== M.point) newPoint();
    if (isPlayer() && M.mode !== 'wait' && M.phase !== 'over' && !local.at) enterTable();
    if (M.phase === 'over' && (!prev || prev.phase !== 'over')) showWin();
    renderScore();
  }
  function newPoint() { live = false; R.missed = -1; R.hitter = -1; R.bounces = []; R.n = 0; R.decided = false; R.served = false; R.serveAt = performance.now() + 900 / opts.speed; R.point = M.point; bot[0].target = bot[1].target = null; }
  function startMatch(mode, opp, side = 0) {
    const players = mode === 'bot' ? (side === 0 ? [me(), 'bot'] : ['bot', me()]) : mode === 'wait' ? [me(), null] : [opp, me()];
    const n = { mid: String(Date.now()) + '-' + me(), mode, players, names: Object.fromEntries(players.filter(Boolean).map(id => [id, nameOf(id)])), score: [0, 0], first: Math.random() < 0.5 ? 0 : 1, server: 0, phase: 'serve', winner: -1, point: 0, rev: 1 };
    n.server = n.first; stats.rallies.length = 0; R.log.length = 0;
    setState(n); broadcast(); closeJoin();
    if (mode === 'wait') ui.toast('Waiting for a challenger — anyone pressing E at the table plays you', 3500);
    return true;
  }
  function awardPoint(winner, reason) {
    if (!M || M.phase === 'over' || R.decided) return; R.decided = true;
    const sc = M.score.slice(); sc[winner]++;
    const over = (sc[0] >= 11 || sc[1] >= 11) && Math.abs(sc[0] - sc[1]) >= 2;
    stats.points++; stats.rallies.push({ point: M.point, hits: R.n, winner, reason }); R.log.push({ point: M.point, hits: R.n, winner });
    const n = { ...snap(), score: sc, point: M.point + 1, server: serverOf(sc, M.first), phase: over ? 'over' : 'serve', winner: over ? winner : -1, rev: M.rev + 1, reason };
    send({ k: 'point', M: n, winner, why: reason, hits: R.n }); pointFx(winner, reason); setState(n);
  }
  function pointFx(winner, reason) { sfx('net', 0.4); banner(nameOf(M.players[winner]), chip('POINT', String(reason || '').toUpperCase(), 'role'), 1300); }
  function leave() {
    if (M && isPlayer()) {
      if (M.mode === '1v1' && M.phase !== 'over') { const n = { ...snap(), phase: 'over', winner: 1 - M.players.indexOf(me()), reason: 'forfeit', rev: M.rev + 1 }; send({ k: 'state', M: n }); }
      else send({ k: 'state', M: { ...snap(), reset: 1 } });
      setState(null);
    }
    exitTable(); ui.show(WIN, false);
  }

  // ---------------------------------------------------------------- hits
  function doHit(side, shotOpts) {
    const p = [planeX(side), ball.p[1], ball.p[2]];
    if (!live) { p[1] = pad[side].y + 0.02; p[2] = pad[side].z; } // serve from the blade
    const sh = aimShot(p, side, shotOpts);
    ball.p = p; ball.v = sh.v; ball.top = sh.top; ball.side = sh.side; live = true;
    R.hitter = side; R.bounces = []; R.n++; R.served = true; R.missed = -1; stats.hits++;
    if (M.phase === 'serve') M.phase = 'rally';
    sfx('paddle', 0.9);
    send({ k: 'hit', mid: M.mid, point: M.point, n: R.n, side, p: ball.p, v: ball.v, top: ball.top, spin: ball.side, t: performance.now() });
  }
  function humanShot(side) { // from the paddle's motion and where the ball met the blade
    const P = pad[side]; const sw = Math.min(9, Math.hypot(P.vy, P.vz) + 1.2);
    const off = live ? (ball.p[2] - P.z) : 0; const s = sgn(side);
    return { depth: Math.max(0.15, Math.min(1.45, 0.3 + sw * 0.11)), wide: Math.max(-0.95, Math.min(0.95, off * 3.2 * s * s + P.vz * 0.12)), speed: 3.6 + sw * 0.55, top: Math.max(-1, Math.min(1, P.vy * 0.35)), side: Math.max(-0.6, Math.min(0.6, -P.vz * 0.08 * s)) };
  }
  function botShotOpts() {
    const miss = Math.random() < opts.botMiss * 0.4;
    return { depth: miss ? 1.2 + Math.random() * 0.3 : 0.35 + Math.random() * 0.55, wide: (Math.random() - 0.5) * 1.1, speed: 3.8 + Math.random() * 2.6, top: (Math.random() - 0.3) * 0.9, side: (Math.random() - 0.5) * 0.4 };
  }

  // ---------------------------------------------------------------- network
  ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'chal' && m.to === me()) { showChallenge(from); return; }
    if (m.k === 'hello') { if (M && isPlayer()) send({ k: 'state', M: snap() }, from); return; }
    if (m.k === 'state' && m.M && Array.isArray(m.M.players)) {
      if (m.M.reset) { if (M && M.mid === m.M.mid) setState(null); return; }
      if (M && M.mid === m.M.mid && m.M.rev < M.rev) return;
      if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over' && M.mid !== m.M.mid && !m.M.players.includes(me())) return;
      setState(m.M); return;
    }
    if (!M) return;
    if (m.k === 'point' && m.M?.mid === M.mid && m.M.rev > M.rev) { R.log.push({ point: M.point, hits: m.hits, winner: m.winner }); stats.rallies.push({ point: M.point, hits: m.hits, winner: m.winner, reason: m.why, remote: true }); pointFx(m.winner, m.why); setState(m.M); return; }
    if (m.k === 'hit' && m.mid === M.mid && m.point === M.point && from === controller(m.side)) {
      ball.p = m.p.slice(); ball.v = m.v.slice(); ball.top = m.top; ball.side = m.spin || 0; live = true;
      R.hitter = m.side; R.bounces = []; R.n = m.n; R.served = true; R.missed = -1; if (M.phase === 'serve') M.phase = 'rally';
      sfx('paddle', 0.7);
      // fast-forward by the latency (sender clock -> ours)
      const off = mp?.net?.clock?.(from); const sentLocal = Number.isFinite(off) ? m.t + off : performance.now() - 40;
      let lag = Math.max(0, Math.min(0.3, (performance.now() - sentLocal) / 1000)) * opts.speed;
      while (lag > 0) { const d = Math.min(1 / 240, lag); onEvent(step(ball, d)); lag -= d; }
      return;
    }
    if (m.k === 'pad' && m.mid === M.mid && from === controller(m.side) && !iControl(m.side)) { const P = pad[m.side]; P.ty = m.y; P.tz = m.z; return; }
  };
  mp?.onPeerJoin?.((id) => { if (M && isPlayer()) setTimeout(() => send({ k: 'state', M: snap() }, id), 700); });
  mp?.onPeerLeave?.((id) => { if (!M || !M.players.includes(id)) return; if (M.mode !== '1v1') { setState(null); return; } if (M.phase !== 'over') setState({ ...snap(), phase: 'over', winner: M.players.indexOf(id) === 0 ? 1 : 0, reason: 'forfeit', rev: M.rev + 1 }); });
  setTimeout(() => send({ k: 'hello' }), 2200);

  // ---------------------------------------------------------------- rules on the responsible client
  // r = the side that must return the ball (= the side where a rally ends); only its controller decides
  function onEvent(ev) {
    if (!ev || !M || R.hitter < 0) return;
    const h = R.hitter, r = 1 - h; const mine = iControl(r);
    if (ev === 'table0' || ev === 'table1') { sfx('table', 0.8); R.bounces.push(ev === 'table0' ? 0 : 1); }
    else if (ev === 'net') sfx('net', 0.6);
    if (!mine || R.decided) return;
    const b = R.bounces;
    if (ev === 'table0' || ev === 'table1') {
      if (b.length === 1 && b[0] === h) return awardPoint(r, 'fault');            // landed on the hitter's own half
      if (b.length >= 2 && b[0] === r) return awardPoint(h, 'two bounces');      // receiver let it bounce twice
    }
    if (ev === 'floor') { if (!b.length || b[0] !== r) return awardPoint(r, b.length ? 'fault' : 'out'); return awardPoint(h, 'missed'); }
  }
  function crossing(side, ox) { // the ball crossed side's paddle plane this substep
    const X = planeX(side); if ((ox - X) * (ball.p[0] - X) > 0 || ox === ball.p[0]) return;
    if (R.hitter !== 1 - side || !iControl(side) || R.decided) return;
    const legal = R.bounces.length >= 1 && R.bounces[0] === side;
    if (!legal) return awardPoint(side, R.bounces.length ? 'fault' : 'out');
    const P = pad[side]; const d = Math.hypot(P.y - ball.p[1], P.z - ball.p[2]);
    if (d <= REACH) { doHit(side, botSide(side) ? botShotOpts() : humanShot(side)); return; }
    // missed: the hitter wins once it is clearly past (floor / far behind) — decided in tick
    R.missed = side;
  }

  // ---------------------------------------------------------------- input (paddle on its plane)
  const locked = () => !!document.pointerLockElement;
  addEventListener('mousemove', (e) => {
    if (!local.at || !locked() || !M || local.side < 0 || botSide(local.side)) return;
    const s = sgn(local.side); const P = pad[local.side];
    P.tz = Math.max(TZ - Z_REACH, Math.min(TZ + Z_REACH, P.tz + e.movementX * 0.0022 * s));
    P.ty = Math.max(Y_MIN, Math.min(Y_MAX, P.ty - e.movementY * 0.0022));
  });
  document.addEventListener('mousedown', (e) => { if (!local.at || e.button !== 0 || !locked() || !M) return; tryServe(local.side); }, true);
  function tryServe(side) { if (!M || M.phase !== 'serve' || M.server !== side || !iControl(side) || live || R.decided) return false; if (performance.now() < R.serveAt) return false; doHit(side, botSide(side) ? botShotOpts() : { ...humanShot(side), depth: Math.min(1, humanShot(side).depth) }); return true; }

  // ---------------------------------------------------------------- at the table
  function enterTable() {
    if (local.at || !M) return; local.side = M.players.indexOf(me()); if (local.side < 0) return;
    local.at = true; local.camInit = false; local.prevThird = st.thirdPerson; closeJoin();
    if (!st.frozen) { st.frozen = true; local.iFroze = true; }
    try { if (st.seat) player.setSeat(null); } catch {}
    if (!nearTable()) { ui.veil(true); setTimeout(() => ui.veil(false), 320); }
    if (ctx.interact) ctx.interact.modal = { pong: true, label: () => '', use: () => { leave(); return true; } };
    document.body.classList.add('pg-venue'); local.stand = '';
    ui.toast('Click to take the mouse · move = paddle · swing to hit · click serves · E leaves', 3000);
  }
  function exitTable() {
    if (!local.at) return; local.at = false; local.side = -1;
    if (local.iFroze) { st.frozen = false; local.iFroze = false; }
    if (ctx.interact?.modal?.pong) ctx.interact.modal = null;
    document.body.classList.remove('pg-venue'); st.thirdPerson = local.prevThird; hide();
    player.teleport(AREA.pos[0], -0.05, AREA.pos[2], AREA.yaw);
  }
  function hide() { for (const n of [SCORE, KEYS]) ui.show(n, false); }

  // ---------------------------------------------------------------- per frame
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), tgtP = new THREE.Vector3(), tgtQ = new THREE.Quaternion();
  ctx.onUpdate((dt) => {
    if (!M) return;                                     // idle: nothing
    const now = performance.now(); const sdt = Math.min(dt, 0.05) * opts.speed;
    // paddles: local (human: mouse target; bot / auto: AI) and remote (smoothed)
    for (const side of [0, 1]) {
      const P = pad[side]; if (!M.players[side]) continue;
      if (iControl(side) && botSide(side)) botDrive(side, sdt);
      const k = iControl(side) ? 1 - Math.exp(-sdt * 40) : 1 - Math.exp(-dt * 14);
      const ny = P.y + (P.ty - P.y) * k, nz = P.z + (P.tz - P.z) * k;
      const vy = (ny - P.y) / Math.max(1e-4, sdt), vz = (nz - P.z) / Math.max(1e-4, sdt);
      P.vy += (vy - P.vy) * Math.min(1, sdt * 18); P.vz += (vz - P.vz) * Math.min(1, sdt * 18); P.y = ny; P.z = nz;
      const s = sgn(side); paddles[side].position.set(planeX(side) + s * 0.02, P.y, P.z);
      paddles[side].rotation.set(0, side === 0 ? 0 : Math.PI, Math.max(-0.6, Math.min(0.6, -P.vy * 0.06)) * s);
    }
    // serve (bot / auto after a short pause)
    if (M.phase === 'serve' && !live && !R.decided) {
      const sv = M.server; if (iControl(sv) && botSide(sv) && now > R.serveAt + 300 / opts.speed) tryServe(sv);
      if (!live) { const P = pad[sv]; ball.p = [planeX(sv) + sgn(sv) * 0.06, P.y + 0.05 + Math.abs(Math.sin(now / 260)) * 0.12, P.z]; }
    }
    // ball
    if (live && M.phase !== 'over') {
      let left = sdt;
      while (left > 0) {
        const d = Math.min(1 / 240, left); left -= d; const ox = ball.p[0];
        onEvent(step(ball, d)); if (!live || R.decided) break;
        crossing(0, ox); crossing(1, ox); if (R.decided) break;
      }
      // a missed ball flies on: decide once it is well past the plane or slow on the deck
      if (R.missed !== undefined && R.missed >= 0 && !R.decided && iControl(R.missed)) { const s = sgn(R.missed); if ((ball.p[0] - planeX(R.missed)) * -s > 0.8 || ball.p[1] < 0) { const m = R.missed; R.missed = -1; awardPoint(1 - m, 'missed'); } }
      if (Math.abs(ball.p[0] - TX) > 8 || Math.abs(ball.p[2] - TZ) > 8) { if (iControl(1 - R.hitter) && !R.decided) awardPoint(R.bounces[0] === 1 - R.hitter ? R.hitter : 1 - R.hitter, 'out'); }
    }
    ballMesh.position.set(ball.p[0], ball.p[1], ball.p[2]); ballMesh.visible = M.phase !== 'over';
    const overTable = Math.abs(ball.p[0] - TX) <= HL && Math.abs(ball.p[2] - TZ) <= HW && ball.p[1] > TY - 0.02;
    ballShadow.position.set(ball.p[0], (overTable ? TY : -0.098) + 0.002, ball.p[2]); ballShadow.visible = ballMesh.visible;
    // share my paddle (15 Hz)
    if (local.at && local.side >= 0 && now - local.lastPad > 66) { const P = pad[local.side]; const sig = P.ty.toFixed(3) + P.tz.toFixed(3); if (sig !== local.padSig) { local.padSig = sig; local.lastPad = now; send({ k: 'pad', mid: M.mid, side: local.side, y: P.ty, z: P.tz }); } }
    // avatars hold their paddles (arm points at the blade)
    for (const side of [0, 1]) { const id = M.players[side]; if (!id || id === 'bot') continue; const cr = id === me() ? player.creature : peers().get(id)?.creature; if (cr) { _a.copy(paddles[side].position); _a.y -= 0.06; aimArm(cr, 'R', _a); } }
    if (local.at && local.side >= 0) {
      const s = sgn(local.side); const P = pad[local.side];
      // stand behind the paddle
      const sx = planeX(local.side) - s * 0.5, sz = Math.max(TZ - 1.2, Math.min(TZ + 1.2, P.z - s * 0.32)); const key = sx.toFixed(1) + ',' + sz.toFixed(1);
      if (key !== local.stand) { local.stand = key; player.teleport(sx, -0.05, sz, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
      st.facing = s > 0 ? -Math.PI / 2 : Math.PI / 2; if (!st.thirdPerson) st.thirdPerson = true;
      tgtP.set(planeX(local.side) - s * 0.8, TY + 0.9, TZ + (P.z - TZ) * 0.3); _b.set(TX + s * 0.55, TY - 0.05, TZ); _m.lookAt(tgtP, _b, _up); tgtQ.setFromRotationMatrix(_m);
      if (!local.camInit) { local.camP.copy(tgtP); local.camQ.copy(tgtQ); local.camInit = true; }
      const k = 1 - Math.exp(-dt * 6); local.camP.lerp(tgtP, k); local.camQ.slerp(tgtQ, k); camera.position.copy(local.camP); camera.quaternion.copy(local.camQ);
      player.creature.setVisible(false); // others see you holding the paddle; locally the view is over your shoulder-less eye line
    }
  });
  function botDrive(side, dt) {
    const P = pad[side]; const B = bot[side]; const incoming = live && R.hitter === 1 - side && !R.decided;
    if (incoming && B.hitN !== R.n) { B.hitN = R.n; const c = predictCross(ball, side); const big = Math.random() < opts.botMiss; B.err = [(Math.random() - 0.5) * 0.09 + (big ? (Math.random() < 0.5 ? -1 : 1) * 0.2 : 0), (Math.random() - 0.5) * 0.09]; B.target = c; }
    let ty = TY + 0.3, tz = TZ;
    if (incoming && B.target) { ty = B.target.y + B.err[0]; tz = B.target.z + B.err[1]; }
    else if (M.phase === 'serve' && M.server === side) { ty = TY + 0.22; tz = TZ + (side ? -0.15 : 0.15); }
    const mv = 3.2 * dt; P.ty += Math.max(-mv, Math.min(mv, Math.max(Y_MIN, Math.min(Y_MAX, ty)) - P.ty)); P.tz += Math.max(-mv, Math.min(mv, tz - P.tz));
  }

  // ---------------------------------------------------------------- UI: score / join / win / challenge
  function renderScore() {
    const on = !!M && M.mode !== 'wait' && (local.at || nearTable()); ui.show(SCORE, on); ui.show(KEYS, local.at);
    if (!M || !on) return;
    for (const side of [0, 1]) {
      const box = $('pq-s' + side); const sc = String(M.score[side]);
      if (!box.firstChild) box.innerHTML = '<span class="pq-srv"></span><span class="nm"></span><span class="sc"></span>';
      box.children[0].classList.toggle('on', M.server === side && M.phase !== 'over');
      box.children[1].textContent = nameOf(M.players[side]) + (M.players[side] === me() ? ' (you)' : '');
      if (box.children[2].dataset.roll !== sc) ui.roll(box.children[2], sc);
    }
    ui.setHtml($('pq-mid'), chip('TO', '11', 'alt') + chip('SERVE', nameOf(M.players[M.server]).toUpperCase().slice(0, 12), 'role'));
    ui.setHtml(KEYS, (locked() ? '' : chip('CLICK', 'TAKE THE MOUSE', 'role')) + [['MOUSE', 'PADDLE'], ['SWING', 'HIT'], ['CLICK', 'SERVE'], ['E', 'LEAVE']].map(([a, b]) => chip(a, b, 'alt')).join(''));
  }
  setInterval(() => { if (M) renderScore(); else if (SCORE.classList.contains('on')) ui.show(SCORE, false); }, 300);
  let joinOpen = false, joinSide = 0;
  function openJoin(side = 0) {
    if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over') { enterTable(); return; }
    joinSide = side; joinOpen = true; renderJoin(); ui.show(JOIN, true); document.body.classList.add('ui-open'); st.keys.clear(); try { document.exitPointerLock?.(); } catch {}
  }
  function closeJoin() { if (!joinOpen) return; joinOpen = false; ui.show(JOIN, false); document.body.classList.remove('ui-open'); }
  function renderJoin() {
    const busy = M && M.mode !== 'wait' && M.phase !== 'over'; const waiting = M && M.mode === 'wait' && M.players[0] !== me() ? M.players[0] : null;
    const others = [...(mp?.members || [])].filter(id => peers().get(id));
    JOIN.innerHTML = `<div class="mono">${chip('VENUE', 'EAST POOL DECK')} ${chip('TABLE', busy ? (nameOf(M.players[0]) + ' vs ' + nameOf(M.players[1])).toUpperCase() : waiting ? nameOf(waiting).toUpperCase() + ' WAITING' : 'FREE', busy ? 'role' : 'alt')}</div><h2 id="pq-j-h"></h2>
      <div class="pp-opts">
        ${waiting ? `<button type="button" class="pp-opt pri" data-a="join">Play ${esc(nameOf(waiting))}<span>They're waiting at the far end.</span></button>` : ''}
        <button type="button" class="pp-opt ${waiting ? '' : 'pri'}" data-a="bot" ${busy ? 'disabled' : ''}>Play vs bot<span>First to 11, win by 2. The bot misses sometimes.</span></button>
        ${waiting ? '' : `<button type="button" class="pp-opt" data-a="wait" ${busy ? 'disabled' : ''}>Wait for a challenger<span>Anyone pressing E at the table plays you.</span></button>`}
      </div>
      <div class="pp-list">${others.length ? others.map(id => `<div class="pp-row"><span class="n">${esc(nameOf(id))}</span><button type="button" data-c="${esc(id)}" ${busy ? 'disabled' : ''}>Challenge</button></div>`).join('') : '<div class="pp-row"><span class="n mono k">NOBODY ELSE ONLINE</span></div>'}</div>
      <div class="pp-foot"><span class="mono"><span class="k">HOW::</span><span class="v">mouse moves the paddle · swing through the ball</span></span><button type="button" data-a="close">Close <kbd>Esc</kbd></button></div>`;
    ui.roll($('pq-j-h'), 'Ping-pong');
  }
  JOIN.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return; const a = b.dataset.a, c = b.dataset.c;
    if (a === 'close') closeJoin(); else if (a === 'bot') startMatch('bot', null, joinSide); else if (a === 'wait') startMatch('wait');
    else if (a === 'join' && M?.mode === 'wait') startMatch('1v1', M.players[0]); else if (c) { send({ k: 'chal', to: c }, c); ui.toast(`Challenge sent to ${nameOf(c)}`); closeJoin(); }
  });
  addEventListener('keydown', (e) => { if (joinOpen && e.code === 'Escape') { e.preventDefault(); closeJoin(); } });
  let chalFrom = null, chalT = 0;
  function showChallenge(from) { chalFrom = from; ui.setHtml($('pq-chal-t'), `<b>${esc(nameOf(from))}</b> challenged you to <b>PING-PONG</b>`); ui.show(CHAL, true); clearTimeout(chalT); chalT = setTimeout(() => ui.show(CHAL, false), 20000); }
  function accept() { if (!chalFrom) return false; const f = chalFrom; chalFrom = null; ui.show(CHAL, false); startMatch('1v1', f); return true; }
  $('pq-chal-y').addEventListener('click', accept); $('pq-chal-n').addEventListener('click', () => { chalFrom = null; ui.show(CHAL, false); });
  function showWin() {
    if (!M) return; const w = M.winner; const mine = isPlayer();
    if (!mine && !nearTable()) { ui.toast(`${nameOf(M.players[w])} won ping-pong ${M.score[w]}–${M.score[1 - w]}`, 3000); return; }
    WIN.innerHTML = `<div class="mono">${chip('PING-PONG', 'TO 11')} ${chip('SCORE', M.score.join('–'), 'role')} ${M.reason === 'forfeit' ? chip('RESULT', 'FORFEIT', 'alt') : ''}</div><h2 id="pq-w-h"></h2>
      <div class="pp-list">${[0, 1].map(i => `<div class="pp-row"><span class="n" style="${i === w ? 'color:var(--acc)' : ''}">${esc(nameOf(M.players[i]))}</span><span class="mono v">${M.score[i]}</span></div>`).join('')}</div>
      <div class="pp-foot"><span class="mono"><span class="k">RALLIES::</span><span class="v">${stats.rallies.filter(r => r.point >= 0).length} · LONGEST ${Math.max(0, ...stats.rallies.map(r => r.hits || 0))} HITS</span></span><span>${mine ? '<button type="button" class="pri" data-a="re">Rematch</button> ' : ''}<button type="button" data-a="x">${mine ? 'Leave table' : 'Close'}</button></span></div>`;
    ui.show(WIN, true); ui.roll($('pq-w-h'), `${nameOf(M.players[w])} wins`); try { if (local.at) document.exitPointerLock?.(); } catch {}
  }
  WIN.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; ui.show(WIN, false); if (b.dataset.a === 're' && M) startMatch(M.mode, M.mode === '1v1' ? M.players.find(p => p !== me()) : null, M.players.indexOf(me())); else if (isPlayer()) leave(); });

  // ---------------------------------------------------------------- E at either end
  for (const side of [0, 1]) ctx.interact?.add({ id: 'pingpong:' + side, pos: new THREE.Vector3(TX + (side ? 1 : -1) * (HL - 0.1), TY + 0.1, TZ), radius: 0.8, range: 2.3,
    label: () => (M && isPlayer() && M.phase !== 'over' && M.mode !== 'wait' ? 'BACK TO THE TABLE' : M && M.mode === 'wait' && M.players[0] !== me() ? 'PLAY ' + nameOf(M.players[0]).toUpperCase() : 'PLAY PING-PONG'),
    use: () => { if (M && M.mode === 'wait' && M.players[0] !== me() && !isPlayer()) startMatch('1v1', M.players[0]); else openJoin(side); } });

  // ---------------------------------------------------------------- api
  const api = {
    get state() { return M ? snap() : null; }, get ball() { return copyBall(ball); }, get live() { return live; }, get at() { return local.at; },
    get side() { return local.side; }, stats, log: R.log, opts, pad,
    startMatch, accept, leave, openJoin, closeJoin, challenge: (id) => { send({ k: 'chal', to: id }, id); },
    set auto(v) { opts.auto = !!v; }, get auto() { return opts.auto; }, set speed(v) { opts.speed = Math.max(0.25, Math.min(4, +v || 1)); }, get speed() { return opts.speed; },
    serve: () => tryServe(local.side), movePaddle(y, z) { if (local.side >= 0) { pad[local.side].ty = y; pad[local.side].tz = z; } },
  };
  window.__pingpong = api;
  return {
    id: 'pingpong', title: 'Ping-pong', kind: 'place', icon: ICON, minPlayers: 1, maxPlayers: 2, area: AREA, areaName: 'EAST POOL DECK',
    blurb: 'Table tennis on the east deck. First to 11, win by 2. Play a friend or the bot.',
    start() { openJoin(0); },
    status() { return { players: M && M.mode !== 'wait' ? M.players.filter(p => p && p !== 'bot').length : M ? 1 : 0, live: !!M && M.mode !== 'wait' && M.phase !== 'over' }; },
  };
}
