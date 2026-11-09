// Pool (8-ball) in the garage — a 'place' game for the hub (src/games/index.js).
// Walk up, "E::PLAY POOL" (or Games panel → Pool): join panel with PLAY VS BOT / PRACTICE / WAIT FOR A CHALLENGER /
// CHALLENGE <player>; a challenged player gets an accept card. Players are frozen at the table; the camera goes to
// an over-the-cue view orbiting the cue ball (mouse X aims, mouse Y tilts), with a guide line, ghost ball and
// first-contact prediction (object-ball path + cue-ball tangent). Hold the mouse button and pull back for power
// (or hold Space), WASD / arrows move the spin dot, release to shoot. Balls roll in a top-down view (V toggles).
// Ball in hand: the cue ball follows the mouse in the top view, click to place.
//
// Sync (mp.channel('pool')): table state T = { mid, mode: 'wait'|'1v1'|'bot'|'practice', players:[id0,id1], names,
// g (sim.js rules state), rev, turnAt, created }. The shooter sends {k:'shot', mid, n, shot:{cue, dir, v, spin}};
// EVERY client runs the same deterministic simulation (sim.js) and the same rules, plays it back, then the shooter
// sends the post-shot state {k:'state'} which replaces the local one (drift correction; drift is measured and
// exposed as __pool.lastDrift). Aim previews {k:'aim'} at 10 Hz let others see the cue. Late joiners send
// {k:'hello'} and a seated player answers with the state. Bot shots are computed and sent by the bot's human
// opponent. Players leaving = forfeit. Turn timer 45 s (a timeout is a foul: ball in hand).
// Idle cost: the table is static merged meshes + one instanced ball mesh; no per-frame work unless a shot is
// playing back or you are at the table.
import * as THREE from 'three';
import { L, W, R, simulate, freshState, rackOrder, applyShot, timeoutFoul, legalPlacement, firstContact, botShot, placeFor, groupOf, remaining, HEAD_X } from './sim.js';
import { buildTable, TABLE, X0, Z0, RAIL, BALL_COLORS, makeCue } from './table.js';
import { chip, esc } from '../ui.js';
import { sfx } from '../sfx.js';
import { lean, aimArm, handPos } from '../arms.js';

const TURN_MS = 45000;
const AREA = { pos: [17.1, 0, 5.35], yaw: 0 };
const ICON = '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.6"/><path d="M8.9 8.9h1.6l-1 2.4"/>';

const CSS = `
#pp-hud { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 9; display: flex; gap: 8px; align-items: stretch; pointer-events: none; }
#pp-hud.pg-stage { transform: translate(-50%, -6px); } #pp-hud.pg-stage.on { transform: translate(-50%, 0); }
.pp-pl { background: var(--surf); border: var(--hair); border-radius: 6px; padding: 7px 10px; min-width: 170px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); transition: border-color .25s var(--es), background .25s var(--es); }
.pp-pl.turn { border-color: rgba(242,200,75,.45); background: #2b2a24; }
.pp-pl .nm { font-size: 15px; font-weight: 500; letter-spacing: -0.03em; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.pp-pl .nm i { width: 7px; height: 7px; border-radius: 50%; background: transparent; flex: none; }
.pp-pl.turn .nm i { background: var(--acc); animation: pg-pulse 2s infinite; }
.pp-dots { display: flex; gap: 3px; margin-top: 5px; min-height: 10px; }
.pp-dots b { width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 -2px 3px rgba(0,0,0,.35); position: relative; overflow: hidden; }
.pp-dots b.st::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2.5px; background: #f4f1e6; box-shadow: 0 7.5px 0 #f4f1e6; }
.pp-mid { display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; }
#pp-foul { position: fixed; left: 50%; top: 26%; z-index: 56; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 26px 14px; translate: -50% 0;
  background: rgba(30,30,30,.86); border: var(--hair); border-radius: 6px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 24px 60px rgba(0,0,0,.4); }
#pp-foul .big { font: 500 72px/1 "Geist", -apple-system, Inter, sans-serif; letter-spacing: -0.06em; color: #f7f7f7; text-shadow: 0 4px 40px rgba(0,0,0,.5); }
#pp-foul .big .roll-c { line-height: 1; }
#pp-foul .sub { display: block; }
#pp-power { position: fixed; right: 26px; top: 50%; translate: 0 -50%; z-index: 9; width: 14px; height: 220px; background: var(--surf); border: var(--hair); border-radius: 6px; padding: 3px; box-sizing: border-box; pointer-events: none; }
#pp-power i { position: absolute; left: 3px; right: 3px; bottom: 3px; height: 0; border-radius: 3px; background: linear-gradient(to top, #3ddc84, #f2c84b 60%, #ef5a3c); transition: height .05s linear; }
#pp-power b { position: absolute; right: 22px; bottom: 0; font: 600 10px/1 var(--mono); color: var(--tx2); white-space: nowrap; }
#pp-spin { position: fixed; right: 18px; bottom: 74px; z-index: 9; width: 64px; height: 64px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fbfaf4, #d9d5c8); border: var(--hair); box-shadow: 0 2px 6px -2px rgba(0,0,0,.4); pointer-events: none; }
#pp-spin i { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #d42a22; box-shadow: 0 0 0 2px rgba(212,42,34,.25); transition: transform .15s var(--eo); }
#pp-spin b { position: absolute; left: 50%; top: -16px; translate: -50% 0; font: 600 10px/1 var(--mono); color: var(--tx2); white-space: nowrap; }
body.pg-venue #help { display: none !important; }
#pp-keys { position: fixed; left: 0; right: 0; margin: 0 auto; width: fit-content; max-width: min(92vw, 820px); bottom: 18px; z-index: 9; display: flex; gap: 6px; pointer-events: none; flex-wrap: wrap; justify-content: center; }
.pp-card { position: fixed; left: 50%; top: 50%; translate: -50% -50%; z-index: 60; width: min(560px, calc(100vw - 32px)); background: var(--bg); border: var(--hair); border-radius: 6px; padding: 18px; box-sizing: border-box;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 30px 80px rgba(0,0,0,.45); }
.pp-card h2 { margin: 6px 0 12px; font-size: 34px; font-weight: 500; letter-spacing: -0.055em; line-height: 1; }
.pp-card h2 .roll-c { line-height: 1; }
.pp-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pp-opt { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px !important; }
.pp-opt span { font-size: 12px; color: var(--tx2); letter-spacing: -0.01em; }
.pp-list { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; max-height: 200px; overflow: auto; }
.pp-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--surf); border: var(--hair); border-radius: 6px; }
.pp-row .n { flex: 1; font-size: 14px; }
.pp-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 8px; flex-wrap: wrap; }
#pp-chal { top: auto; bottom: 74px; translate: -50% 0; width: min(520px, calc(100vw - 32px)); display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
#pp-chal.pg-stage { transform: translateY(18px); } #pp-chal.pg-stage.on { transform: none; }
body.watching #pp-hud, body.watching #pp-keys, body.watching #pp-spin, body.watching #pp-power { display: none; }
`;

export function createPool(ctx, mp, hub) {
  const { scene, camera, player } = ctx; const st = player.state;
  const tbl = buildTable(ctx);
  const ch = mp?.channel ? mp.channel('pool') : { send() {}, onMessage: null };
  const me = () => mp?.net?.selfId || 'local';
  const peers = () => mp?.peers || new Map();
  const nameOf = (id) => (id === 'bot' ? 'Bot' : id === me() ? (mp?.selfName?.() || 'You') : peers().get(id)?.name || T?.names?.[id] || 'Guest');
  const ui = hub.ui;

  // ---------------------------------------------------------------- state
  let T = null;                   // replicated table state
  let anim = null;                // shot playback { res, t0, post, shooterId, n, pending }
  let local = { at: false, view: 'cue', userView: null, aim: 0, pitch: 0.32, dist: 0.95, power: 0, charging: false, chargeMode: null, spin: [0, 0], cue: null, placing: false,
    stanceKey: '', lastAimSend: 0, aimSent: '', botAt: 0, holdUntil: 0, botShot: null, camP: new THREE.Vector3(), camQ: new THREE.Quaternion(), camInit: false, iFroze: false, chargeT: 0, prevThird: true };
  const remoteAim = new Map(); // shooterId -> { dir, cue, p, s, at }
  let lastDrift = null, shotsPlayed = 0, idleSetBalls = true;
  const fast = { on: false }; // tests: skip the playback

  // ---------------------------------------------------------------- DOM
  if (!document.getElementById('pp-css')) { const s = document.createElement('style'); s.id = 'pp-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.getElementById('pg');
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstChild; root.appendChild(n); n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('click', e => e.stopPropagation()); return n; };
  const HUD = el('<div id="pp-hud" class="pg-stage"><div class="pp-pl" id="pp-p0"></div><div class="pp-mid" id="pp-mid"></div><div class="pp-pl" id="pp-p1"></div></div>');
  const FOUL = el('<div id="pp-foul" class="pg-stage"><div class="big" id="pp-foul-big"></div><div class="sub" id="pp-foul-sub"></div></div>');
  const POWER = el('<div id="pp-power" class="pg-stage"><i></i><b>POWER</b></div>');
  const SPIN = el('<div id="pp-spin" class="pg-stage"><i></i><b>SPIN::WASD</b></div>');
  const KEYS = el('<div id="pp-keys" class="pg-stage"></div>');
  const JOIN = el('<div id="pp-join" class="pp-card pg-stage" role="dialog" aria-label="Pool"></div>');
  const WIN = el('<div id="pp-win" class="pp-card pg-stage" role="dialog" aria-label="Pool result"></div>');
  const CHAL = el('<div id="pp-chal" class="pp-card pg-stage" role="status"><span class="pg-dot"></span><div style="flex:1;min-width:0"><div class="pg-inv-title" id="pp-chal-t"></div><div class="mono" id="pp-chal-s"></div></div><button type="button" class="pri" id="pp-chal-y">Accept</button><button type="button" id="pp-chal-n">Decline</button></div>');
  for (const n of [HUD, POWER, SPIN, KEYS]) n.style.pointerEvents = 'none';
  const $ = (id) => document.getElementById(id);
  let foulT = 0;
  function banner(big, sub, ms = 2600, hold = false) { if (hold) { local.holdUntil = performance.now() + ms + 300; local.botAt = Math.max(local.botAt, local.holdUntil); } ui.roll($('pp-foul-big'), big); ui.setHtml($('pp-foul-sub'), sub); ui.show(FOUL, true); clearTimeout(foulT); foulT = setTimeout(() => ui.show(FOUL, false), ms); }

  // ---------------------------------------------------------------- helpers
  const tw = (x, y, out = new THREE.Vector3()) => out.set(X0 + x, TABLE.y + R, Z0 + y);
  const seatOf = (id) => (T ? T.players.indexOf(id) : -1);
  const isPlayer = (id = me()) => !!T && T.mode !== 'wait' ? T.players.includes(id) : !!T && T.players[0] === id;
  const controller = (seat) => { if (!T) return null; const p = T.players[seat]; return p === 'bot' ? T.players[1 - seat] : p; };
  const myTurn = () => !!T && T.mode !== 'wait' && T.g.phase === 'aim' && !anim && controller(T.g.turn) === me() && T.players[T.g.turn] !== 'bot';
  const turnName = () => (T ? (T.mode === 'practice' ? nameOf(T.players[0]) : nameOf(T.players[T.g.turn])) : '');
  const flat = (balls) => { const f = new Float64Array(32); balls.forEach((b, i) => { f[i * 2] = b[2] ? b[0] : -9; f[i * 2 + 1] = b[2] ? b[1] : -9; }); return f; };
  const fresh = (mode, players) => {
    const now = performance.now(); const order = rackOrder(Math.random);
    return { mid: String(Date.now()) + '-' + me(), mode, players, names: Object.fromEntries(players.filter(Boolean).map(id => [id, nameOf(id)])), g: freshState(order), rev: 1, turnAt: now, created: Date.now(), by: me() };
  };
  function send(msg, to) { try { ch.send(msg, to); } catch {} }
  function broadcast() { if (!T) return; T.by = me(); send({ k: 'state', T: JSON.parse(JSON.stringify(T)), now: performance.now() }); }
  const cueStart = () => { const b = T.g.balls[0]; return b[2] && !T.g.inHand ? [b[0], b[1]] : placeFor(T.g); };

  // ---------------------------------------------------------------- state changes
  function setState(n, { fromNet = false } = {}) {
    const prev = T; T = n; idleSetBalls = true;
    if (!T) { exitTable(); lamp(false); hideAll(); return; }
    if (!prev || prev.mid !== T.mid) { anim = null; local.cue = null; local.placing = false; remoteAim.clear(); }
    lamp(T.mode !== 'wait');
    if (!anim) tbl.setBalls(flat(T.g.balls), false);
    // you were added as a player (accepted challenge / someone joined your table): go to the table
    if (isPlayer() && T.mode !== 'wait' && T.g.phase !== 'over' && !local.at && (!prev || prev.mid !== T.mid)) enterTable(true);
    if (T.g.phase === 'over' && (!prev || prev.g.phase !== 'over' || prev.mid !== T.mid)) showWin();
    if (prev && prev.mid === T.mid && T.g.shotNo !== prev.g.shotNo && fromNet && !anim) afterShotUI(prev.g, T.g);
    resetTurn();
    renderHud();
  }
  function resetTurn() {
    local.charging = false; local.power = 0; local.botShot = null; local.botAt = Math.max(performance.now() + 1100, local.holdUntil || 0); /* polish5: never shoot under a FOUL / TIME banner */
    if (T && myTurn()) {
      local.cue = cueStart(); local.placing = T.g.inHand === 'any';
      if (!local.placing || local.aim === null) { const b = T.g.balls; const tgt = T.g.broken ? null : [L * 0.75, W / 2]; if (tgt) local.aim = Math.atan2(tgt[1] - local.cue[1], tgt[0] - local.cue[0]); }
      local.view = local.placing ? 'top' : 'cue';
    } else if (T) local.view = 'top';
  }
  function afterShotUI(g0, g1) {
    if (g1.phase === 'over') return;
    if (g1.foul) banner('FOUL', chip(g1.foul, 'BALL IN HAND · ' + turnName().toUpperCase(), 'role'), 2600, true);
    else if (g1.turn !== g0.turn) banner(T.mode === 'practice' ? 'MISS' : turnName() + "'s turn", chip('TURN', turnName().toUpperCase(), 'alt'), 1600);
    else if (g1.groups[g1.turn] && !g0.groups[g0.turn]) banner(g1.groups[g1.turn] === 'solid' ? 'SOLIDS' : 'STRIPES', chip(turnName().toUpperCase(), 'SHOOTS ' + (g1.groups[g1.turn] === 'solid' ? 'SOLIDS 1-7' : 'STRIPES 9-15'), 'role'), 1800);
  }

  // ---------------------------------------------------------------- shots
  function shoot(shot) {
    if (!T || !(myTurn() || (T.players[T.g.turn] === 'bot' && controller(T.g.turn) === me())) || anim) return false;
    if (T.g.inHand && !legalPlacement(T.g, shot.cue[0], shot.cue[1])) return false;
    const n = T.g.shotNo; const clean = { cue: [+shot.cue[0], +shot.cue[1]], dir: [+shot.dir[0], +shot.dir[1]], v: Math.max(0.2, Math.min(8, +shot.v)), spin: [+(shot.spin?.[0] || 0), +(shot.spin?.[1] || 0)] };
    send({ k: 'shot', mid: T.mid, n, shot: clean, by: me() });
    play(clean, me(), n);
    return true;
  }
  function play(shot, by, n) {
    const res = simulate(T.g.balls, shot); shotsPlayed++;
    const post = applyShot(T.g, res);
    anim = { res, shot, t0: performance.now(), by, n, post, pending: null, ev: 0, g0: T.g };
    sfx('cue', Math.min(1, shot.v / 6));
    local.charging = false; local.power = 0; local.placing = false;
    if (local.at) local.view = local.userView === 'cue' ? 'follow' : 'top';
    if (fast.on) finishAnim();
  }
  function finishAnim() {
    const a = anim; if (!a) return; anim = null;
    const g0 = T.g; T.g = a.post; T.rev++; T.turnAt = performance.now();
    if (a.by === me()) broadcast();                     // shooter's post-state corrects any drift elsewhere
    if (a.pending) { const p = a.pending; lastDrift = drift(T.g.balls, p.g.balls); T = p; }
    tbl.setBalls(flat(T.g.balls), false);
    afterShotUI(g0, T.g); if (T.g.phase === 'over') showWin();
    resetTurn(); renderHud();
  }
  const drift = (a, b) => { let m = 0; for (let i = 0; i < 16; i++) { if (a[i][2] !== b[i][2]) return Infinity; if (a[i][2]) m = Math.max(m, Math.abs(a[i][0] - b[i][0]), Math.abs(a[i][1] - b[i][1])); } return m; };

  // ---------------------------------------------------------------- network
  ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'chal' && m.to === me()) { showChallenge(from, m); return; }
    if (m.k === 'decline' && m.to === me()) { ui.toast(`${nameOf(from)} declined`); return; }
    if (m.k === 'hello') { if (T && (T.players.includes(me()) || (T.by === me()))) send({ k: 'state', T: JSON.parse(JSON.stringify(T)), now: performance.now() }, from); return; }
    if (m.k === 'state' && m.T && typeof m.T === 'object' && Array.isArray(m.T.players) && m.T.g) {
      const n = m.T; const off = mp?.net?.clock?.(from); n.turnAt = (n.turnAt || 0) + (Number.isFinite(off) ? off : Number.isFinite(m.now) ? performance.now() - m.now : 0);
      if (n.reset) { if (T && T.mid === n.mid) setState(null); return; }
      if (T && T.mid === n.mid) {
        if (anim) { anim.pending = n; return; }        // apply after our own playback ends
        if (n.rev < T.rev) return;
        lastDrift = drift(T.g.balls, n.g.balls);
      } else if (T && isPlayer() && T.mode !== 'wait' && T.g.phase !== 'over' && !n.players.includes(me())) return; // busy playing: ignore other matches
      setState(n, { fromNet: true }); return;
    }
    if (!T) return;
    if (m.k === 'shot' && m.mid === T.mid && m.shot && m.n === T.g.shotNo && !anim) { if (from === controller(T.g.turn)) play(m.shot, from, m.n); return; }
    if (m.k === 'aim' && m.mid === T.mid) { remoteAim.set(from, { dir: m.d, cue: m.c, p: m.p || 0, s: m.s || [0, 0], at: performance.now() }); return; }
  };
  mp?.onPeerJoin?.((id) => { if (T && T.players.includes(me())) setTimeout(() => send({ k: 'state', T: JSON.parse(JSON.stringify(T)), now: performance.now() }, id), 700); });
  mp?.onPeerLeave?.((id) => {
    if (!T) return; remoteAim.delete(id);
    if (!T.players.includes(id)) return;
    if (T.mode === 'wait' || T.mode === 'practice' || T.mode === 'bot') { setState(null); return; }
    const other = T.players.find(p => p !== id);
    if (T.g.phase !== 'over') { const g = JSON.parse(JSON.stringify(T.g)); g.phase = 'over'; g.winner = T.players.indexOf(other); g.reason = 'FORFEIT'; anim = null; setState({ ...T, g, rev: T.rev + 1 }); }
  });
  setTimeout(() => send({ k: 'hello' }), 2000);

  // ---------------------------------------------------------------- matches
  function startMatch(mode, opp) {
    const players = mode === 'bot' ? [me(), 'bot'] : mode === 'practice' ? [me(), me()] : mode === 'wait' ? [me(), null] : [opp, me()];
    const n = fresh(mode, players); n.names[me()] = nameOf(me()); if (opp && opp !== 'bot') n.names[opp] = nameOf(opp);
    anim = null; setState(n); broadcast(); closeJoin();
    if (mode !== 'wait') enterTable(); else ui.toast('Waiting for a challenger — anyone can press E at the table to play you', 3500);
    return true;
  }
  function rematch() {
    if (!T || !isPlayer()) return;
    const loserFirst = T.g.winner >= 0 ? [T.players[1 - T.g.winner], T.players[T.g.winner]] : T.players.slice();
    const n = fresh(T.mode, T.mode === '1v1' ? loserFirst : T.players); n.names = { ...T.names }; anim = null; ui.show(WIN, false); setState(n); broadcast(); enterTable();
  }
  function leave() {
    if (!T) { exitTable(); return; }
    if (isPlayer()) {
      if (T.mode === '1v1' && T.g.phase !== 'over') { const g = JSON.parse(JSON.stringify(T.g)); g.phase = 'over'; g.winner = 1 - seatOf(me()); g.reason = 'FORFEIT'; T = { ...T, g, rev: T.rev + 1 }; broadcast(); }
      else send({ k: 'state', T: { ...JSON.parse(JSON.stringify(T)), reset: 1 }, now: performance.now() });
      setState(null);
    }
    exitTable(); ui.show(WIN, false);
  }
  function challenge(id) { if (!id || id === me()) return; send({ k: 'chal', to: id, game: 'pool' }, id); ui.toast(`Challenge sent to ${nameOf(id)}`); closeJoin(); }
  let chalFrom = null, chalT = 0;
  function showChallenge(from) {
    chalFrom = from; ui.setHtml($('pp-chal-t'), `<b>${esc(nameOf(from))}</b> challenged you to <b>POOL</b>`); ui.setHtml($('pp-chal-s'), chip('GAME', '8-BALL', 'alt') + ' ' + chip('WHERE', 'GARAGE', 'alt'));
    ui.show(CHAL, true); clearTimeout(chalT); chalT = setTimeout(() => ui.show(CHAL, false), 20000);
  }
  function accept() {
    if (!chalFrom) return false; const from = chalFrom; chalFrom = null; ui.show(CHAL, false);
    closeJoin(); startMatch('1v1', from); return true;
  }
  $('pp-chal-y').addEventListener('click', accept);
  $('pp-chal-n').addEventListener('click', () => { if (chalFrom) send({ k: 'decline', to: chalFrom }, chalFrom); chalFrom = null; ui.show(CHAL, false); });
  const nearTable = () => Math.hypot(st.pos.x - TABLE.cx, st.pos.z - TABLE.cz) < 3.5;

  // ---------------------------------------------------------------- join panel
  let joinOpen = false;
  function openJoin() {
    if (T && isPlayer() && T.mode !== 'wait' && T.g.phase !== 'over') { enterTable(); return; }
    joinOpen = true; renderJoin(); ui.show(JOIN, true); document.body.classList.add('ui-open'); st.keys.clear(); try { document.exitPointerLock?.(); } catch {}
  }
  function closeJoin() { if (!joinOpen) return; joinOpen = false; ui.show(JOIN, false); document.body.classList.remove('ui-open'); }
  function renderJoin() {
    const busy = T && T.mode !== 'wait' && T.g.phase !== 'over';
    const waiting = T && T.mode === 'wait' && T.players[0] !== me() ? T.players[0] : null;
    const others = [...(mp?.members || [])].filter(id => peers().get(id));
    const st0 = busy ? `${nameOf(T.players[0])} vs ${nameOf(T.players[1])}` : waiting ? `${nameOf(waiting)} is waiting` : 'FREE';
    JOIN.innerHTML = `<div class="mono">${chip('VENUE', 'GARAGE')} ${chip('TABLE', st0.toUpperCase(), busy ? 'role' : 'alt')}</div><h2 id="pp-j-h">Pool — 8-ball</h2>
      <div class="pp-opts">
        ${waiting ? `<button type="button" class="pp-opt pri" data-a="join">Play ${esc(nameOf(waiting))}<span>They're waiting at the table — you break second.</span></button>` : ''}
        <button type="button" class="pp-opt ${waiting ? '' : 'pri'}" data-a="bot" ${busy ? 'disabled' : ''}>Play vs bot<span>Solo 8-ball against an aiming bot that misses sometimes.</span></button>
        <button type="button" class="pp-opt" data-a="practice" ${busy ? 'disabled' : ''}>Practice<span>Every shot is yours. Fouls still give ball in hand.</span></button>
        ${waiting ? '' : `<button type="button" class="pp-opt" data-a="wait" ${busy ? 'disabled' : ''}>Wait for a challenger<span>Anyone pressing E at the table plays you.</span></button>`}
      </div>
      <div class="pp-list">${others.length ? others.map(id => `<div class="pp-row"><span class="n">${esc(nameOf(id))}</span><span class="mono k">${T && T.players.includes(id) ? 'AT THE TABLE' : 'IN THE HOUSE'}</span><button type="button" data-c="${esc(id)}" ${busy ? 'disabled' : ''}>Challenge</button></div>`).join('') : '<div class="pp-row"><span class="n mono k">NOBODY ELSE ONLINE — INVITE FRIENDS FROM THE MENU</span></div>'}</div>
      <div class="pp-foot"><span class="mono"><span class="k">${busy ? 'SPECTATE::' : 'TIP::'}</span><span class="v">${busy ? 'balls move live for everyone in the house' : 'walk up and press E at the table any time'}</span></span><button type="button" data-a="close">Close <kbd>Esc</kbd></button></div>`;
    ui.roll($('pp-j-h'), 'Pool — 8-ball');
  }
  JOIN.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const a = b.dataset.a, c = b.dataset.c;
    if (a === 'close') closeJoin(); else if (a === 'bot') startMatch('bot'); else if (a === 'practice') startMatch('practice'); else if (a === 'wait') startMatch('wait');
    else if (a === 'join' && T?.mode === 'wait') startMatch('1v1', T.players[0]);
    else if (c) challenge(c);
  });
  addEventListener('keydown', (e) => { if (joinOpen && e.code === 'Escape') { e.preventDefault(); closeJoin(); } });

  // ---------------------------------------------------------------- win screen
  function showWin() {
    if (!T) return; const g = T.g; const w = g.winner; const name = w >= 0 ? nameOf(T.players[w]) : '—';
    const mine = isPlayer(); const iWon = mine && T.players[w] === me() && T.mode !== 'practice';
    if (!mine && Math.hypot(st.pos.x - TABLE.cx, st.pos.z - TABLE.cz) > 8) { ui.toast(`${name} won at pool (${g.reason || '8-BALL'})`, 3000); return; }
    WIN.innerHTML = `<div class="mono">${chip('POOL', '8-BALL')} ${chip('RESULT', (g.reason || 'EIGHT').toUpperCase(), 'alt')} ${chip('SHOTS', String(g.shotNo), 'alt')}</div><h2 id="pp-w-h"></h2>
      <div class="pp-list">${[0, 1].filter(i => T.mode !== 'practice' || i === 0).map(i => `<div class="pp-row ${i === w ? 'win' : ''}"><span class="n" style="${i === w ? 'color:var(--acc)' : ''}">${esc(nameOf(T.players[i]))}</span><span class="mono v">${(g.groups[i] || 'open').toUpperCase()} · ${g.groups[i] ? remaining({ balls: g.balls }, g.groups[i]) + ' LEFT' : ''}</span></div>`).join('')}</div>
      <div class="pp-foot"><span class="mono"><span class="k">${iWon ? 'YOU::' : 'WINNER::'}</span><span class="acc">${esc(iWon ? 'WIN' : name.toUpperCase())}</span></span><span>${mine ? '<button type="button" class="pri" data-a="re">Rematch</button> ' : ''}<button type="button" data-a="x">${mine ? 'Leave table' : 'Close'}</button></span></div>`;
    ui.show(WIN, true); ui.roll($('pp-w-h'), T.mode === 'practice' ? (w === 0 ? 'Rack cleared' : 'Eight too early') : `${name} wins`);
    if (local.at) { try { document.exitPointerLock?.(); } catch {} }
  }
  WIN.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 're') rematch(); else { ui.show(WIN, false); if (isPlayer()) leave(); } });

  // ---------------------------------------------------------------- at-table mode (frozen player, game camera)
  function enterTable(auto) {
    if (local.at) return; closeJoin();
    if (!nearTable()) { ui.veil(true); setTimeout(() => ui.veil(false), 320); player.teleport(AREA.pos[0], 0.05, AREA.pos[2], AREA.yaw); }
    local.at = true; local.camInit = false; local.prevThird = st.thirdPerson; local.userView = null;
    if (!st.frozen) { st.frozen = true; local.iFroze = true; }
    try { if (st.seat) player.setSeat(null); } catch {}
    ctx.interact && (ctx.interact.modal = { pool: true, label: () => '', use: () => { leave(); return true; } }); // E leaves (hint lives in the key row)
    document.body.classList.add('pg-venue');
    resetTurn(); renderHud();
    if (!auto) ui.toast('Click to aim · hold + pull back for power · E leaves', 2600);
  }
  function exitTable() {
    if (!local.at) return; local.at = false;
    if (local.iFroze) { st.frozen = false; local.iFroze = false; }
    if (ctx.interact?.modal?.pool) ctx.interact.modal = null;
    document.body.classList.remove('pg-venue');
    tbl.cue.visible = false; tbl.guide.visible = false; tbl.ghost.visible = false; heldCue.visible = false; tbl.lamp.visible = true;
    st.thirdPerson = local.prevThird; hideAll(); renderHud();
    // step back from the table
    const p = st.pos; if (Math.abs(p.x - TABLE.cx) < L / 2 + 0.9 && Math.abs(p.z - TABLE.cz) < W / 2 + 0.9) player.teleport(AREA.pos[0], 0.05, AREA.pos[2], 0);
  }
  function hideAll() { for (const n of [HUD, POWER, SPIN, KEYS]) ui.show(n, false); if (!T) ui.show(FOUL, false); }

  // ---------------------------------------------------------------- input (only while at the table)
  const locked = () => !!document.pointerLockElement;
  addEventListener('mousemove', (e) => {
    if (!local.at || !locked() || !T) return;
    if (local.placing && myTurn()) { // ball in hand: move the cue ball in the top view (screen x = table x, screen y = table z)
      const k = 0.0016; const nx = local.cue[0] + e.movementX * k, ny = local.cue[1] + e.movementY * k;
      const maxX = T.g.inHand === 'kitchen' ? HEAD_X : L - R; local.cue = [Math.max(R, Math.min(maxX, nx)), Math.max(R, Math.min(W - R, ny))]; return;
    }
    if (local.charging && local.chargeMode === 'mouse') { local.power = Math.max(0, Math.min(1, local.power + e.movementY * 0.004)); return; }
    const fine = st.keys.has('ShiftLeft') || st.keys.has('ShiftRight') ? 0.2 : 1;
    if (local.view === 'top') local.aim += e.movementX * 0.0022 * fine;
    else { local.aim += e.movementX * 0.0018 * fine; local.pitch = Math.max(0.08, Math.min(1.25, local.pitch + e.movementY * 0.002)); }
  });
  document.addEventListener('mousedown', (e) => {
    if (!local.at || e.button !== 0 || !locked() || !myTurn()) return;
    if (local.placing) { if (legalPlacement(T.g, local.cue[0], local.cue[1])) { local.placing = false; local.view = 'cue'; sfx('ball', 0.3); } else ui.toast('Cue ball overlaps a ball' + (T.g.inHand === 'kitchen' ? ' or is past the head string' : '')); return; }
    local.charging = true; local.chargeMode = 'mouse'; local.power = 0;
  }, true);
  addEventListener('mouseup', (e) => { if (e.button !== 0 || !local.charging || local.chargeMode !== 'mouse') return; release(); }, true);
  addEventListener('keydown', (e) => {
    if (!local.at || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.code === 'KeyX' && myTurn() && T.g.inHand) { local.placing = !local.placing; if (!local.placing && !legalPlacement(T.g, local.cue[0], local.cue[1])) { local.placing = true; ui.toast('Cue ball overlaps a ball'); } return; }
    if (e.code === 'KeyV') { local.userView = local.view === 'top' ? 'cue' : 'top'; local.view = anim ? (local.userView === 'cue' ? 'follow' : 'top') : local.userView; return; }
    if (!myTurn()) return;
    const sp = { KeyW: [0, 0.2], ArrowUp: [0, 0.2], KeyS: [0, -0.2], ArrowDown: [0, -0.2], KeyA: [-0.2, 0], ArrowLeft: [-0.2, 0], KeyD: [0.2, 0], ArrowRight: [0.2, 0] }[e.code];
    if (sp) { let [a, b] = [local.spin[0] + sp[0], local.spin[1] + sp[1]]; const r = Math.hypot(a, b); if (r > 1) { a /= r; b /= r; } local.spin = [Math.round(a * 10) / 10, Math.round(b * 10) / 10]; return; }
    if (e.code === 'Space' && !local.placing) { e.preventDefault(); local.charging = true; local.chargeMode = 'space'; local.chargeT = 0; local.power = 0; }
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'Space' && local.charging && local.chargeMode === 'space') release(); }, true);
  function release() {
    local.charging = false; const p = local.power; local.power = 0;
    if (p < 0.03 || !myTurn()) return;
    shoot({ cue: local.cue, dir: [Math.cos(local.aim), Math.sin(local.aim)], v: 0.4 + p * 7.4, spin: local.spin });
  }

  // ---------------------------------------------------------------- per-frame
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
  const heldCue = makeCue(); heldCue.visible = false; scene.add(heldCue);
  const topQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const interp = new Float64Array(32);
  function stance(cue, dx, dy) { // where the shooter stands: the line behind the cue ball leaves the table + 0.45 m
    const M = RAIL + 0.45; let t = Infinity; const bx = -dx, by = -dy;
    if (bx > 1e-6) t = Math.min(t, (L + M - cue[0]) / bx); if (bx < -1e-6) t = Math.min(t, (-M - cue[0]) / bx);
    if (by > 1e-6) t = Math.min(t, (W + M - cue[1]) / by); if (by < -1e-6) t = Math.min(t, (-M - cue[1]) / by);
    return [cue[0] + bx * t, cue[1] + by * t];
  }
  function poseCue(mesh, cue, dx, dy, pull) { // tip just behind the cue ball, butt raised ~6°
    tw(cue[0] - dx * (R + 0.012 + pull), cue[1] - dy * (R + 0.012 + pull), _a); _a.y += 0.004;
    mesh.position.copy(_a); _b.set(_a.x - dx, _a.y + 0.11, _a.z - dy); mesh.lookAt(_b); mesh.visible = true;
  }
  function poseShooter(cr, cue, dx, dy, pull) { // lean in, right hand on the butt, left hand bridging on the felt
    if (!cr) return; lean(cr, 0.55);
    tw(cue[0] - dx * (1.05 + pull), cue[1] - dy * (1.05 + pull), _c); _c.y += 0.12; aimArm(cr, 'R', _c);
    tw(cue[0] - dx * 0.22, cue[1] - dy * 0.22, _d); _d.y = TABLE.y + 0.03; aimArm(cr, 'L', _d);
  }
  function guide(cue, dx, dy) {
    const fc = firstContact(T.g.balls, cue[0], cue[1], dx, dy);
    const P = tbl.guideG.attributes.position; const y = TABLE.y + R * 0.3;
    const set = (i, x, z) => P.setXYZ(i, X0 + x, y, Z0 + z);
    set(0, cue[0], cue[1]); set(1, fc.gx, fc.gy);
    if (fc.ball >= 0) {
      const b = T.g.balls[fc.ball]; let nx = b[0] - fc.gx, ny = b[1] - fc.gy; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      set(2, b[0], b[1]); set(3, b[0] + nx * 0.35, b[1] + ny * 0.35);                       // object ball path
      const dot = dx * nx + dy * ny; let tx = dx - nx * dot, ty = dy - ny * dot; const tl = Math.hypot(tx, ty) || 1; // cue ball tangent
      set(4, fc.gx, fc.gy); set(5, fc.gx + tx / tl * 0.22 * Math.min(1, tl * 2), fc.gy + ty / tl * 0.22 * Math.min(1, tl * 2));
      const ok = wrongBall(fc.ball); tbl.guide.material.color.set(ok ? 0xff6a55 : 0xffffff); tbl.ghost.material.color.set(ok ? 0xff6a55 : 0xffffff);
    } else { for (let i = 2; i < 6; i++) set(i, fc.gx, fc.gy); tbl.guide.material.color.set(0xffffff); tbl.ghost.material.color.set(0xffffff); }
    P.needsUpdate = true; tbl.guide.visible = true;
    tbl.ghost.position.set(X0 + fc.gx, TABLE.y + 0.002, Z0 + fc.gy); tbl.ghost.visible = true;
    return fc;
  }
  function wrongBall(b) { const g = T.g; if (!g.broken) return false; const mine = g.groups[g.turn]; if (!mine) return b === 8; const cleared = remaining(g, mine) === 0; return cleared ? b !== 8 : groupOf(b) !== mine; }
  function camTo(pos, quat, dt, snap) {
    if (!local.camInit || snap) { local.camP.copy(pos); local.camQ.copy(quat); local.camInit = true; }
    const k = 1 - Math.exp(-dt * 7); local.camP.lerp(pos, k); local.camQ.slerp(quat, k);
    camera.position.copy(local.camP); camera.quaternion.copy(local.camQ);
  }
  const tgtP = new THREE.Vector3(), tgtQ = new THREE.Quaternion();
  function topPose() { tgtP.set(TABLE.cx, TABLE.y + 2.55 * (camera.aspect < 1.3 ? 1.5 : 1), TABLE.cz + 0.001); tgtQ.copy(topQ); }

  ctx.onUpdate((dt, t) => {
    if (!T && !local.at && !anim) return;          // idle: nothing
    const now = performance.now();
    // ---- shot playback
    if (anim) {
      const el = (now - anim.t0) / 1000 * 60; const nF = anim.res.nFrames; const fr = anim.res.frames;
      if (el >= nF - 1) finishAnim();
      else {
        const i = Math.floor(el), f = el - i; const a0 = i * 32, a1 = Math.min(nF - 1, i + 1) * 32;
        for (let k = 0; k < 32; k++) { const p0 = fr[a0 + k], p1 = fr[a1 + k]; interp[k] = p0 < -1 || p1 < -1 ? (p1 < -1 && f > 0.5 ? -9 : p0 < -1 ? -9 : p0) : p0 + (p1 - p0) * f; }
        tbl.setBalls(interp, true);
        const evs = anim.res.events; while (anim.ev < evs.length && evs[anim.ev].f <= el) { const e = evs[anim.ev++]; if (e.k === 'hit' && e.s > 0.05) sfx('ball', e.s / 3); else if (e.k === 'rail' && e.s > 0.1) sfx('cushion', e.s / 3); else if (e.k === 'pocket') sfx('pocket', 0.8); }
        if (now - anim.t0 > 250) tbl.cue.visible = false;
      }
    }
    if (!T) { if (local.at) exitTable(); return; }
    // ---- turn timer + bot
    const g = T.g;
    if (!anim && g.phase === 'aim' && T.mode !== 'wait' && T.mode !== 'practice') {
      const ctl = controller(g.turn);
      if (now - T.turnAt > TURN_MS && (ctl === me() || (now - T.turnAt > TURN_MS + 5000 && isPlayer()))) { const n = { ...T, g: timeoutFoul(g), rev: T.rev + 1, turnAt: now }; setState(n); broadcast(); banner('TIME', chip('FOUL', 'BALL IN HAND', 'role'), 2600, true); }
      else if (T.players[g.turn] === 'bot' && ctl === me() && now > local.botAt) {
        if (!local.botShot) { local.botShot = botShot(g, Math.random, 1); local.botAt = now + 650; }
        else { const s = local.botShot; local.botShot = null; shoot(s); }
      }
    }
    // ---- at the table: camera, cue, guide, stance
    const turnIsMine = myTurn();
    if (local.at) {
      if (!st.thirdPerson) st.thirdPerson = true; // keeps the local avatar animated (we drive the camera ourselves)
      if (turnIsMine && !local.cue) local.cue = cueStart();
      const dx = Math.cos(local.aim), dy = Math.sin(local.aim);
      if (local.charging && local.chargeMode === 'space') { local.chargeT += dt; const ph = (local.chargeT / 1.6) % 2; local.power = ph < 1 ? ph : 2 - ph; }
      if (turnIsMine && !anim) {
        if (local.placing) { tbl.setBalls(flat(T.g.balls.map((b, i) => (i === 0 ? [local.cue[0], local.cue[1], 1] : b))), false); tbl.cue.visible = false; tbl.guide.visible = false; tbl.ghost.visible = false; }
        else { tbl.setBalls(flat(T.g.balls.map((b, i) => (i === 0 ? [local.cue[0], local.cue[1], 1] : b))), false); guide(local.cue, dx, dy); poseCue(tbl.cue, local.cue, dx, dy, local.power * 0.25); }
        // stand behind the shot (teleport only when it moved), face the shot
        const sp = stance(local.cue, dx, dy); const key = sp.map(v => v.toFixed(1)).join(',');
        if (key !== local.stanceKey) { local.stanceKey = key; player.teleport(X0 + sp[0], 0.05, Z0 + sp[1], Math.atan2(-dx, -dy)); }
        st.facing = Math.atan2(-dx, -dy);
        if (!local.placing) poseShooter(player.creature, local.cue, dx, dy, local.power * 0.25);
        heldCue.visible = false;
        // share the aim (10 Hz)
        const sig = [local.aim.toFixed(3), local.cue[0].toFixed(3), local.cue[1].toFixed(3), local.power.toFixed(2)].join();
        if (now - local.lastAimSend > 100 && sig !== local.aimSent) { local.lastAimSend = now; local.aimSent = sig; send({ k: 'aim', mid: T.mid, d: [dx, dy], c: local.cue, p: local.power, s: local.spin }); }
      } else if (!anim) {
        tbl.guide.visible = false; tbl.ghost.visible = false;
        // waiting player: stand at the side rail, cue in hand
        const side = T.g.turn === 0 ? -1 : 1; const wx = TABLE.cx + side * 0.75, wz = TABLE.cz - W / 2 - RAIL - 0.55; const key = 'w' + side;
        if (local.stanceKey !== key) { local.stanceKey = key; player.teleport(wx, 0.05, wz, 0); }
        heldCue.visible = false;
      } else { tbl.guide.visible = false; tbl.ghost.visible = false; heldCue.visible = false; }
      // camera
      const view = anim ? (local.view === 'follow' ? 'follow' : 'top') : (turnIsMine && !local.placing ? (local.userView || 'cue') : 'top');
      if (view === 'cue' && local.cue) {
        tw(local.cue[0], local.cue[1], _a); const cp = Math.cos(local.pitch), sp2 = Math.sin(local.pitch);
        tgtP.set(_a.x - dx * local.dist * cp, _a.y + local.dist * sp2 + 0.05, _a.z - dy * local.dist * cp);
        _b.set(_a.x + dx * 0.55, _a.y, _a.z + dy * 0.55); _m.lookAt(tgtP, _b, _up); tgtQ.setFromRotationMatrix(_m);
      } else if (view === 'follow' && anim) {
        const k = Math.floor((now - anim.t0) / 1000 * 60); const fr = anim.res.frames; const i = Math.min(anim.res.nFrames - 1, k) * 32;
        const cx = fr[i] > -1 ? fr[i] : TABLE.cx - X0, cz = fr[i + 1] > -1 ? fr[i + 1] : TABLE.cz - Z0; tw(cx, cz, _a);
        tgtP.set(_a.x - dx * 1.3, _a.y + 0.75, _a.z - dy * 1.3); _m.lookAt(tgtP, _a, _up); tgtQ.setFromRotationMatrix(_m);
      } else topPose();
      camTo(tgtP, tgtQ, dt, false);
      player.creature.setVisible(false);                     // others see you at the table; locally the camera is yours
      tbl.lamp.visible = view !== 'top' && view !== 'follow'; // the lamp hangs between the top camera and the felt
      renderLive();
    } else if (!anim) { tbl.guide.visible = false; tbl.ghost.visible = false; }
    // ---- remote shooters: their cue + arms (spectators and the opponent)
    if (!anim && T.mode !== 'wait' && !turnIsMine) {
      const ctl = controller(T.g.turn); const ra = remoteAim.get(ctl);
      if (T.players[T.g.turn] === 'bot' && local.botShot) { poseCue(tbl.cue, local.botShot.cue, local.botShot.dir[0], local.botShot.dir[1], 0.12 * Math.min(1, (now - (local.botAt - 650)) / 650)); }
      else if (ra && now - ra.at < 4000 && ctl !== me()) { poseCue(tbl.cue, ra.cue, ra.dir[0], ra.dir[1], ra.p * 0.25); poseShooter(peers().get(ctl)?.creature, ra.cue, ra.dir[0], ra.dir[1], ra.p * 0.25); }
      else if (!local.at || !turnIsMine) tbl.cue.visible = false;
    }
    // the waiting human (if remote) holds a cue upright beside the table
    if (T.mode === '1v1' && T.g.phase !== 'over') { const w = T.players[1 - T.g.turn]; if (w && w !== me()) holdCue(peers().get(w)?.creature); else if (!local.at) heldCue.visible = false; }
    else if (!local.at) heldCue.visible = false;
    if (idleSetBalls && !anim && !local.at) { idleSetBalls = false; tbl.setBalls(flat(T.g.balls), false); }
  });
  function holdCue(cr) {
    if (!cr || !handPos(cr, 'R', _a)) { heldCue.visible = false; return; }
    heldCue.position.set(_a.x, _a.y + 0.55, _a.z); _b.set(_a.x, _a.y - 1, _a.z + 0.03); heldCue.lookAt(_b); heldCue.visible = true; // tip up, butt by the foot
  }

  // ---------------------------------------------------------------- lamp
  let lampOn = false;
  function lamp(on) { if (on === lampOn) return; lampOn = on; tbl.pool.visible = on; tbl.pool.material.opacity = on ? 0.5 : 0; tbl.felt.emissiveIntensity = on ? 0.12 : 0; tbl.glowM.emissiveIntensity = on ? 2.4 : 1.3; }

  // ---------------------------------------------------------------- HUD
  function dots(seat) {
    const g = T.g; const grp = g.groups[seat]; if (!grp) return '<span class="mono k">OPEN TABLE</span>';
    const ids = grp === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    const left = ids.filter(i => g.balls[i][2]);
    return left.map(i => `<b class="${i > 8 ? 'st' : ''}" style="background:${BALL_COLORS[i]}"></b>`).join('') + (left.length ? '' : '<b style="background:#141414"></b><span class="mono acc">&nbsp;ON THE 8</span>');
  }
  function renderHud() {
    const on = !!T && T.mode !== 'wait' && (local.at || nearTable());
    ui.show(HUD, on); ui.show(KEYS, local.at); ui.show(POWER, local.at && myTurn() && !local.placing); ui.show(SPIN, local.at && myTurn() && !local.placing);
    if (!on) return;
    const g = T.g;
    for (const seat of [0, 1]) {
      const box = $('pp-p' + seat); if (T.mode === 'practice' && seat === 1) { box.style.display = 'none'; continue; } box.style.display = '';
      box.classList.toggle('turn', g.turn === seat && g.phase === 'aim');
      ui.setHtml(box, `<div class="nm"><i></i>${esc(nameOf(T.players[seat]))}${T.players[seat] === me() ? ' <span class="k mono">(YOU)</span>' : ''}</div><div class="mono"><span class="k">GROUP::</span><span class="v">${(g.groups[seat] ? g.groups[seat] + 's' : 'open').toUpperCase()}</span></div><div class="pp-dots">${dots(seat)}</div>`);
    }
    renderLive();
  }
  function renderLive() {
    if (!T || !HUD.classList.contains('on')) return;
    const g = T.g; const left = Math.max(0, TURN_MS - (performance.now() - T.turnAt));
    ui.setHtml($('pp-mid'), chip('TURN', g.phase === 'over' ? 'GAME OVER' : anim ? 'ROLLING' : turnName().toUpperCase(), 'role') + (T.mode === 'practice' ? chip('MODE', 'PRACTICE', 'alt') : chip('TIME', anim ? '—' : hub.core.clockTxt(left), left < 10000 ? 'role' : 'alt')) + (g.inHand && !anim ? chip('BALL IN HAND', g.inHand === 'kitchen' ? 'KITCHEN' : 'ANYWHERE', 'alt') : ''));
    if (local.at) {
      POWER.firstChild.style.height = `calc(${(local.power * 100).toFixed(1)}% - ${local.power * 6}px)`;
      SPIN.firstChild.style.transform = `translate(${(local.spin[0] * 22).toFixed(1)}px, ${(-local.spin[1] * 22).toFixed(1)}px)`;
      ui.show(POWER, myTurn() && !local.placing); ui.show(SPIN, myTurn() && !local.placing);
      const k = myTurn() ? (local.placing ? [['MOUSE', 'MOVE CUE BALL'], ['CLICK', 'PLACE'], ['E', 'LEAVE']] : [...(T.g.inHand ? [['X', 'MOVE CUE BALL']] : []), ['MOUSE', 'AIM'], ['HOLD+PULL', 'POWER'], ['SPACE', 'POWER'], ['SHIFT', 'FINE'], ['WASD', 'SPIN'], ['V', 'VIEW'], ['E', 'LEAVE']]) : [['V', 'VIEW'], ['E', 'LEAVE']];
      ui.setHtml(KEYS, (locked() ? '' : chip('CLICK', 'TAKE THE MOUSE', 'role')) + k.map(([a, b]) => chip(a, b, 'alt')).join(''));
    }
  }
  setInterval(() => { if (T && (local.at || nearTable())) { if (!HUD.classList.contains('on')) renderHud(); else renderLive(); } else if (HUD.classList.contains('on')) ui.show(HUD, false); }, 250);

  // ---------------------------------------------------------------- E at the table (three points along it)
  for (const [i, f] of [[0, 0.15], [1, 0.5], [2, 0.85]]) ctx.interact?.add({ id: 'pool:' + i, pos: new THREE.Vector3(X0 + L * f, TABLE.y + 0.1, TABLE.cz), radius: 0.9, range: 2.4,
    label: () => (T && isPlayer() && T.mode !== 'wait' && T.g.phase !== 'over' ? 'BACK TO THE TABLE' : T && T.mode === 'wait' && T.players[0] !== me() ? 'PLAY ' + nameOf(T.players[0]).toUpperCase() : 'PLAY POOL'),
    use: () => { if (T && T.mode === 'wait' && T.players[0] !== me() && !isPlayer()) startMatch('1v1', T.players[0]); else openJoin(); } });

  // ---------------------------------------------------------------- probe lighting for the late-built table
  // (room probes bind materials at load; borrow the garage probe's env map once it is baked)
  { let src = null, tries = 0; const mats = new Set(); tbl.root.traverse(o => { if (o.isMesh && o.material?.isMeshStandardMaterial) mats.add(o.material); }); mats.add(tbl.balls.material);
    const iv = setInterval(() => {
      if (++tries > 60) { clearInterval(iv); return; }
      if (!src) scene.traverse(o => { if (!src && o.isMesh && !Array.isArray(o.material) && String(o.material?.userData?.probe || '').startsWith('garage')) src = o.material; });
      if (src?.envMap) for (const m of mats) { if (m.envMap !== src.envMap) { m.envMap = src.envMap; m.envMapIntensity = src.envMapIntensity ?? 1; m.needsUpdate = true; } }
    }, 3000); }

  // ---------------------------------------------------------------- hub def + test hooks
  const api = {
    get state() { return T ? JSON.parse(JSON.stringify(T)) : null; }, get anim() { return !!anim; }, get at() { return local.at; }, get view() { return local.view; },
    get lastDrift() { return lastDrift; }, get shots() { return shotsPlayed; }, fast, local,
    startMatch, accept, challenge, leave, openJoin, closeJoin, rematch, enterTable, exitTable,
    shoot: (s) => shoot({ cue: s.cue || local.cue || cueStart(), dir: s.dir, v: s.v, spin: s.spin || [0, 0] }),
    aimAt(ball) { if (!T) return; const c = local.cue || cueStart(); const b = T.g.balls[ball]; local.aim = Math.atan2(b[1] - c[1], b[0] - c[0]); },
    place(x, y) { if (!T || !myTurn()) return false; if (!legalPlacement(T.g, x, y)) return false; local.cue = [x, y]; local.placing = false; local.view = 'cue'; return true; },
    setView(v) { local.userView = v; local.view = v; },
    debugSet(n) { anim = null; setState({ ...n, rev: (T?.rev || 0) + 1 }); }, setPower(p) { local.power = p; },
    myTurn, sim: { simulate, freshState, rackOrder, applyShot, botShot },
    // determinism: n shots from a seeded rack + seeded bot inputs -> final positions (exact doubles)
    selfTest(n = 20, seed = 12345) {
      let s = seed >>> 0; const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
      let g = freshState(rackOrder(rand)); const log = [];
      for (let i = 0; i < n; i++) { if (g.phase === 'over') g = freshState(rackOrder(rand)); const shot = botShot(g, rand, 1); const r = simulate(g.balls, shot); g = applyShot(g, r); log.push(r.steps); }
      return { balls: g.balls, steps: log };
    },
    table: tbl,
  };
  window.__pool = api;
  return {
    id: 'pool', title: 'Pool', kind: 'place', icon: ICON, minPlayers: 1, maxPlayers: 2, area: AREA, areaName: 'GARAGE',
    blurb: '8-ball in the garage. Challenge a friend, play the bot or practice.',
    start() { if (T && isPlayer() && T.mode !== 'wait' && T.g.phase !== 'over') enterTable(); else openJoin(); },
    status() { return { players: T && T.mode !== 'wait' ? new Set(T.players.filter(p => p && p !== 'bot')).size : T ? 1 : 0, live: !!T && T.mode !== 'wait' && T.g.phase !== 'over' }; },
    onPlayerLeave() {},
  };
}
