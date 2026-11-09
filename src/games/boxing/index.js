// Boxing in the raised ring at the canyon end of the sports court (src/games/court.js). "E::BOX" at the ring steps:
// join card (vs bot / wait / challenge). In the ring: WASD moves (you always face the opponent), left click = jab,
// right click = hook, hold Shift = block (80% less damage, slow stamina drain), double-tap A / D = slip (punches miss
// for 0.35 s). Health + stamina bars; damage scales with stamina. 3 rounds x 60 s; 0 health = knockdown + 10-count:
// mash Space / click to get your health back above 30 before 10, else KO; after 3 rounds a points decision (damage
// dealt + knockdowns). Bells, punch thuds, crowd cheer (procedural WebAudio).
// Sync (mp.channel('boxing')): the attacker's client tests its fist (short-range sphere vs the opponent's chest during
// the punch window, using the opponent's last pose {k:'pose'} at 15 Hz) and sends {k:'hit'}; the host (players[0],
// who also runs the bot) applies hits / clock / knockdowns to the match state M and broadcasts it ({k:'state', M}).
// Idle: nothing per frame unless a match exists; bot avatar built lazily.
import * as THREE from 'three';
import { RING, venue, botAvatar } from '../court.js';
import { chip, esc } from '../ui.js';
import { sfx } from '../sfx.js';
import { aimArm } from '../arms.js';
import { nextEmote } from '../../avatars/anim.js';

const ICON = '<path d="M5 9V6.5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3V11a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M5 9h4M8 15v2.5h5V15"/>';
const IN = RING.rope - 0.35, FY = RING.y, SEP = 0.7; /* SEP: min fighter centre distance (bodies never interpenetrate) */
const AREA = { pos: [RING.cx - RING.half - 2.4, RING.y - RING.h, RING.cz + 1.2], yaw: -Math.PI / 2 };
const PUNCH = { jab: { dmg: 6, cost: 10, reach: 0.95, at: 150, cd: 330 }, hook: { dmg: 12, cost: 20, reach: 0.8, at: 230, cd: 620 } };

let ac = null; // own tiny audio: bell + crowd
function audio() { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); } if (ac.state !== 'running') ac.resume().catch(() => {}); return ac.state === 'running' ? ac : null; }
function bell(n = 1) { const a = audio(); if (!a) return; for (let k = 0; k < n; k++) { const t = a.currentTime + k * 0.32; for (const [f, g] of [[1180, 0.25], [2650, 0.1], [3700, 0.05]]) { const o = a.createOscillator(), v = a.createGain(); o.frequency.value = f; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); o.connect(v).connect(a.destination); o.start(t); o.stop(t + 1.5); } } }
function cheer(k = 1) { const a = audio(); if (!a) return; const len = a.sampleRate * 2; const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 900));
  const s = a.createBufferSource(); s.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6; const g = a.createGain(); const t = a.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * k, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2); s.connect(f).connect(g).connect(a.destination); s.start(t); }

export function createBoxing(ctx, mp, hub) {
  const { camera, player } = ctx; const st = player.state;
  const V = venue(ctx, mp, hub, { chan: 'boxing', title: 'Boxing', place: 'SPORTS COURT · RING' });
  const { send, me, peers, nameOf, ui } = V;
  let M = null; let endAt = 0, countAt = 0;
  const opts = { auto: false, roundMs: 60000, breakMs: 6000, rounds: 3, botAggro: 1 };
  const F = [0, 1].map((s) => ({ x: RING.cx + (s ? 1.4 : -1.4), z: RING.cz, st: 100, blk: false, slip: 0, punch: null, punchAt: 0, lastTap: {}, vx: 0, vz: 0, em: 0 }));
  const stats = { sent: 0, landed: 0, log: [] };
  const local = { at: false, side: -1, iFroze: false, camP: new THREE.Vector3(), camQ: new THREE.Quaternion(), camInit: false, prevThird: true, lastPose: 0, botCr: null, botNext: 0, down: false };
  const isPlayer = () => !!M && M.players.includes(me());
  const ctrl = (side) => { if (!M) return null; const p = M.players[side]; return p === 'bot' ? M.players[0] : p; };
  const iControl = (side) => ctrl(side) === me();
  const isHost = () => !!M && M.players[0] === me();
  const botSide = (side) => !!M && (M.players[side] === 'bot' || (opts.auto && M.players[side] === me()));
  const snap = () => JSON.parse(JSON.stringify(M));
  const near = () => Math.hypot(st.pos.x - RING.cx, st.pos.z - RING.cz) < 9;
  const bars = V.el('<div class="cv-score pg-stage" style="top:132px;gap:0"></div>', true); // polish: sits clear below the score card (was overlapping the round timer)

  // ---------------------------------------------------------------- state
  function publish(n) { n.rev = (M?.rev || 0) + 1; n.left = n.phase === 'down' ? Math.max(0, endAt - performance.now()) : Math.max(0, endAt - performance.now()); send({ k: 'state', M: n }); setState(n, true); }
  function setState(n, mine) {
    const prev = M; M = n;
    if (!M) { exitRing(); V.hideHud(); ui.show(bars, false); if (local.botCr) local.botCr.root.visible = false; return; }
    if (!mine && typeof M.left === 'number') endAt = performance.now() + M.left;
    if (M.players.includes('bot')) { if (!local.botCr) botAvatar(ctx, 0.0, 'Bot').then(c => { local.botCr = c; }); else local.botCr.root.visible = true; }
    if (!prev || prev.mid !== M.mid) { stats.log.length = 0; for (const s of [0, 1]) Object.assign(F[s], { x: RING.cx + (s ? 1.6 : -1.6), z: RING.cz, st: 100, blk: false, slip: 0, punch: null }); }
    if (isPlayer() && M.phase !== 'over' && M.mode !== 'wait' && !local.at) enterRing();
    if (prev && prev.phase !== M.phase) { if (M.phase === 'fight') bell(1); if (M.phase === 'break' || M.phase === 'over') { bell(3); cheer(M.phase === 'over' ? 1.4 : 0.6); } if (M.phase === 'down') { cheer(1); countAt = performance.now(); } }
    if (!prev && M.phase === 'fight') bell(1);
    if (M.phase === 'down' && (!prev || prev.phase !== 'down')) countAt = performance.now();
    // knockdown pose (local fighter)
    const mySide = M.players.indexOf(me());
    if (mySide >= 0 && local.at) { const dn = M.phase === 'down' && M.down === mySide || (M.phase === 'over' && M.reason === 'KO' && M.winner !== mySide);
      if (dn && !local.down) { local.down = true; try { player.setSeat({ pos: [F[mySide].x, FY - 0.03, F[mySide].z], yaw: st.facing, pose: 'lie' }); } catch {} }
      else if (!dn && local.down) { local.down = false; try { player.setSeat(null); } catch {} } }
    if (M.phase === 'over' && (!prev || prev.phase !== 'over')) showWin();
    render();
  }
  function startMatch(mode, opp, side = 0) {
    const players = mode === 'bot' ? [me(), 'bot'] : mode === 'wait' ? [me(), null] : [me(), opp];
    endAt = performance.now() + opts.roundMs;
    const n = { mid: Date.now() + '-' + me(), mode, players, names: Object.fromEntries(players.filter(Boolean).map(id => [id, nameOf(id)])), round: 1, phase: mode === 'wait' ? 'wait' : 'fight', hp: [100, 100], dealt: [0, 0], kd: [0, 0], down: -1, nh: 0, winner: -1, reason: '', rev: 0 };
    void side; M = null; publish(n); V.closeJoin();
    if (mode === 'wait') ui.toast('Waiting for a challenger — anyone pressing E at the ring fights you', 3500);
  }
  function leave() {
    if (M && isPlayer()) { if (M.mode === '1v1' && M.phase !== 'over') { const n = snap(); n.phase = 'over'; n.winner = 1 - M.players.indexOf(me()); n.reason = 'forfeit'; n.rev++; send({ k: 'state', M: n }); } else send({ k: 'state', M: { ...snap(), reset: 1, rev: M.rev + 1 } }); setState(null); }
    exitRing(); ui.show(V.WIN, false);
  }

  // ---------------------------------------------------------------- host: apply hits, clock, knockdowns
  function applyHit(by, dmg, kind) {
    if (!M || M.phase !== 'fight' || !isHost()) return; const v = 1 - by; const n = snap();
    n.hp[v] = Math.max(0, n.hp[v] - dmg); n.dealt[by] += dmg; n.nh++; n.last = { by, kind, dmg };
    if (n.hp[v] <= 0) { n.phase = 'down'; n.down = v; n.kd[by]++; n.paused = Math.max(0, endAt - performance.now()); endAt = performance.now() + 10000; }
    publish(n);
  }
  function hostTick(now) {
    if (!M || !isHost() || M.mode === 'wait' || M.phase === 'over') return;
    if (M.phase === 'down') {
      const v = M.down; if (M.players[v] === 'bot' || botSide(v)) { if (Math.random() < 0.05 * opts.botAggro) mash(v); }
      if (M.hp[v] >= 30) { const n = snap(); n.phase = 'fight'; n.down = -1; endAt = now + (M.paused || 10000); publish(n); return; }
      if (now >= endAt) { const n = snap(); n.phase = 'over'; n.winner = 1 - v; n.reason = 'KO'; publish(n); }
      return;
    }
    if (now < endAt) return; const n = snap();
    if (M.phase === 'fight') { if (M.round >= opts.rounds) { n.phase = 'over'; const a = M.dealt[0] + M.kd[0] * 15, b = M.dealt[1] + M.kd[1] * 15; n.winner = a >= b ? 0 : 1; n.reason = 'decision'; } else { n.phase = 'break'; endAt = now + opts.breakMs; } }
    else if (M.phase === 'break') { n.phase = 'fight'; n.round++; endAt = now + opts.roundMs; n.hp = n.hp.map(h => Math.min(100, h + 15)); }
    publish(n);
  }
  function mash(v) { if (!M || M.phase !== 'down' || M.down !== v) return; if (isHost()) { const n = snap(); n.hp[v] = Math.min(100, n.hp[v] + 2.2); publish(n); } else send({ k: 'mash', side: v }); }

  // ---------------------------------------------------------------- punches (attacker decides)
  function punch(side, kind) {
    if (!M || M.phase !== 'fight' || !iControl(side)) return false; const f = F[side]; const P = PUNCH[kind]; const now = performance.now();
    if (f.punch && now - f.punchAt < PUNCH[f.punch].cd) return false; if (f.st < P.cost * 0.5) return false;
    f.punch = kind; f.punchAt = now; f.hitDone = false; const k = 0.4 + 0.6 * f.st / 100; f.dmgK = k; f.st = Math.max(0, f.st - P.cost); stats.sent++;
    if (M.players[side] === 'bot') f.em = nextEmote(f.em, 4); else st.emote = nextEmote(st.emote, 4);
    return true;
  }
  function fistTest(side, now) { // during the punch window: sphere at the fist vs the opponent's chest
    const f = F[side]; if (!f.punch || f.hitDone) return; const P = PUNCH[f.punch]; if (now - f.punchAt < P.at) return; f.hitDone = true;
    const o = F[1 - side]; const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz);
    if (d > P.reach + 0.4 || (o.slip && now < o.slip)) { sfx('cushion', 0.15); return; }
    const dmg = +(P.dmg * f.dmgK * (o.blk ? 0.2 : 1)).toFixed(2); stats.landed++; stats.log.push({ side, kind: f.punch, dmg });
    sfx(o.blk ? 'cushion' : 'pocket', o.blk ? 0.6 : 1); if (!o.blk && f.punch === 'hook') cheer(0.35);
    if (isHost()) applyHit(side, dmg, f.punch); else send({ k: 'hit', mid: M.mid, by: side, dmg, kind: f.punch });
  }

  // ---------------------------------------------------------------- network
  V.ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'chal' && m.to === me()) { V.showChallenge(from); return; }
    if (m.k === 'hello') { if (M && isHost()) send({ k: 'state', M: { ...snap(), left: Math.max(0, endAt - performance.now()) } }, from); return; }
    if (m.k === 'state' && m.M && Array.isArray(m.M.players)) {
      if (m.M.reset) { if (M && M.mid === m.M.mid) setState(null); return; }
      if (M && M.mid === m.M.mid && m.M.rev <= M.rev) return;
      if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over' && M.mid !== m.M.mid && !m.M.players.includes(me())) return;
      if (m.M.mode === 'wait' && m.M.players[0] !== me()) { waiting = m.M; return; }
      setState(m.M); return;
    }
    if (!M) return;
    if (m.k === 'hit' && m.mid === M.mid && from === ctrl(m.by) && isHost()) { applyHit(m.by, Math.min(15, +m.dmg || 0), m.kind); return; }
    if (m.k === 'mash' && isHost() && from === ctrl(m.side)) { mash(m.side); return; }
    if (m.k === 'pose' && m.mid === M.mid && from === ctrl(m.side) && !iControl(m.side)) { const f = F[m.side]; f.tx = m.x; f.tz = m.z; f.blk = !!m.b; f.slip = m.s ? performance.now() + m.s : 0; if (m.p && m.p !== f.lastP) { f.lastP = m.p; f.punch = m.pk; f.punchAt = performance.now(); f.hitDone = true; } }
  };
  let waiting = null;
  mp?.onPeerLeave?.((id) => { if (!M || !M.players.includes(id)) return; if (M.phase !== 'over') { const n = snap(); n.phase = 'over'; n.winner = M.players.indexOf(id) === 0 ? 1 : 0; n.reason = 'forfeit'; n.rev++; setState(n); } });
  setTimeout(() => send({ k: 'hello' }), 2400);
  /* late joiners: the host sends the match (with the round clock) to anyone who arrives */
  mp?.onPeerJoin?.((id) => { if (M && isHost()) setTimeout(() => send({ k: 'state', M: { ...snap(), left: Math.max(0, endAt - performance.now()) } }, id), 700); });

  // ---------------------------------------------------------------- input
  const locked = () => !!document.pointerLockElement;
  document.addEventListener('mousedown', (e) => { if (!local.at || !locked() || !M) return; e.stopImmediatePropagation(); e.preventDefault();
    if (M.phase === 'down' && M.down === local.side) return mash(local.side); if (e.button === 0) punch(local.side, 'jab'); else if (e.button === 2) punch(local.side, 'hook'); }, true);
  addEventListener('contextmenu', (e) => { if (local.at) e.preventDefault(); });
  addEventListener('keydown', (e) => { if (!local.at || !M) return; const f = F[local.side];
    if (e.code === 'Space') { e.preventDefault(); if (M.phase === 'down' && M.down === local.side && !e.repeat) mash(local.side); }
    if ((e.code === 'KeyA' || e.code === 'KeyD') && !e.repeat) { const now = performance.now(); if (now - (f.lastTap[e.code] || 0) < 260) { f.slip = now + 350; f.slipDir = e.code === 'KeyA' ? -1 : 1; } f.lastTap[e.code] = now; } }, true);

  function enterRing() {
    if (local.at || !M) return; local.side = M.players.indexOf(me()); if (local.side < 0) return;
    local.at = true; local.camInit = false; local.prevThird = st.thirdPerson; V.closeJoin();
    if (!st.frozen) { st.frozen = true; local.iFroze = true; }
    try { if (st.seat) player.setSeat(null); } catch {}
    ui.veil(true); setTimeout(() => ui.veil(false), 320);
    if (ctx.interact) ctx.interact.modal = { boxing: true, label: () => '', use: () => { leave(); return true; } };
    document.body.classList.add('pg-venue'); // polish: no centre-strip hint toast; the key chips at the bottom already show the controls
  }
  function exitRing() {
    if (!local.at) return; local.at = false; local.side = -1;
    if (local.down) { local.down = false; try { player.setSeat(null); } catch {} }
    if (local.iFroze) { st.frozen = false; local.iFroze = false; }
    if (ctx.interact?.modal?.boxing) ctx.interact.modal = null;
    document.body.classList.remove('pg-venue'); st.thirdPerson = local.prevThird; V.hideHud(); ui.show(bars, false); player.teleport(AREA.pos[0], AREA.pos[1], AREA.pos[2], AREA.yaw);
  }

  // ---------------------------------------------------------------- per frame
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), tgtP = new THREE.Vector3(), tgtQ = new THREE.Quaternion();
  ctx.onUpdate((dt) => {
    if (!M || M.mode === 'wait' && !isPlayer()) return;
    const now = performance.now(); dt = Math.min(dt, 0.05);
    hostTick(now);
    for (const side of [0, 1]) {
      const f = F[side]; const o = F[1 - side]; if (!M.players[side]) continue;
      if (iControl(side)) {
        let mx = 0, mz = 0; // in the fighter's frame: forward = toward the opponent
        const fx = o.x - f.x, fz = o.z - f.z, fl = Math.hypot(fx, fz) || 1; const ux = fx / fl, uz = fz / fl;
        if (botSide(side)) { const r = botDrive(side, now, fl); mx = r[0]; mz = r[1]; }
        else if (side === local.side && M.phase !== 'down') { const k = st.keys; if (k.has('KeyW')) mz++; if (k.has('KeyS')) mz--; if (k.has('KeyD')) mx++; if (k.has('KeyA')) mx--; f.blk = k.has('ShiftLeft') || k.has('ShiftRight'); }
        if (M.phase === 'down' && M.down === side || M.phase === 'over') { mx = mz = 0; f.blk = false; }
        const sp = (f.blk ? 1.2 : 2.4) * dt; let nx = f.x + (ux * mz - uz * mx) * sp, nz = f.z + (uz * mz + ux * mx) * sp;
        if (f.slip && now < f.slip) { nx += -uz * (f.slipDir || 1) * dt * 1.5; nz += ux * (f.slipDir || 1) * dt * 1.5; }
        if (Math.hypot(nx - o.x, nz - o.z) < SEP) { nx = f.x; nz = f.z; }
        f.x = Math.max(RING.cx - IN, Math.min(RING.cx + IN, nx)); f.z = Math.max(RING.cz - IN, Math.min(RING.cz + IN, nz));
        f.st = Math.min(100, f.st + (f.blk ? 4 : 16) * dt);
        fistTest(side, now);
        if (now - (f.lastPose || 0) > 66) { f.lastPose = now; send({ k: 'pose', mid: M.mid, side, x: +f.x.toFixed(3), z: +f.z.toFixed(3), b: f.blk ? 1 : 0, s: f.slip > now ? Math.round(f.slip - now) : 0, p: f.punch ? f.punchAt | 0 : 0, pk: f.punch }); }
      } else if (f.tx !== undefined) { const k = 1 - Math.exp(-dt * 14); f.x += (f.tx - f.x) * k; f.z += (f.tz - f.z) * k; }
      // avatars: face the opponent; guard / block / jab arm poses
      const yaw = Math.atan2(-(o.x - f.x), -(o.z - f.z)); const id = M.players[side]; let cr = null;
      if (id === me() && local.at) { cr = player.creature; if (!local.down) { V.place(f.x, FY, f.z); st.facing = yaw; } }
      else if (id === 'bot') { cr = local.botCr; const dn = (M.phase === 'down' && M.down === side) || (M.phase === 'over' && M.reason === 'KO' && M.winner !== side); if (cr) cr.update(dt, { pos: _a.set(f.x, FY, f.z), vel: _b.set(f.vx || 0, 0, f.vz || 0), yaw, grounded: true, swimming: false, pose: dn ? 'lie' : 'stand', emote: f.em }); }
      else cr = peers().get(id)?.creature;
      if (cr && !(M.phase === 'down' && M.down === side)) { const fwx = -Math.sin(yaw), fwz = -Math.cos(yaw); const head = FY + 1.45;
        const pj = f.punch && now - f.punchAt < PUNCH[f.punch].cd ? f.punch : null;
        _a.set(f.x + fwx * (pj === 'jab' ? 0.9 : 0.35) + fwz * 0.12, head - 0.05, f.z + fwz * (pj === 'jab' ? 0.9 : 0.35) - fwx * 0.12); aimArm(cr, 'L', _a, f.blk ? 1 : 0.85);
        if (pj !== 'hook') { _a.set(f.x + fwx * 0.35 - fwz * 0.12, head - (f.blk ? 0 : 0.12), f.z + fwz * 0.35 + fwx * 0.12); aimArm(cr, 'R', _a, 0.85); } }
    }
    /* polish5: keep the two bodies apart (remote lerp / slips / round resets could overlap them); only move the sides this client drives */
    if (M.players[0] && M.players[1]) { const a = F[0], b = F[1]; let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < SEP) { if (d < 1e-4) { dx = 1; dz = 0; d = 1; } const push = SEP - d, c0 = iControl(0), c1 = iControl(1), w = c0 && c1 ? 0.5 : 1; const ux = dx / d, uz = dz / d;
        if (c0) { a.x -= ux * push * w; a.z -= uz * push * w; } if (c1) { b.x += ux * push * w; b.z += uz * push * w; }
        for (const f of [a, b]) { f.x = Math.max(RING.cx - IN, Math.min(RING.cx + IN, f.x)); f.z = Math.max(RING.cz - IN, Math.min(RING.cz + IN, f.z)); } } }
    if (local.at && local.side >= 0) {
      const f = F[local.side], o = F[1 - local.side]; const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz) || 1;
      if (!st.thirdPerson) st.thirdPerson = true;
      /* polish5: higher (FY+2.6) and 1.1 m to the side so your back doesn't hide the opponent; clamped inside the ropes so they
         never cross the view; aimed at the midpoint between the fighters */
      const CL = RING.rope - 0.25; tgtP.set(f.x - dx / d * 1.9 + dz / d * 1.1, FY + 2.6, f.z - dz / d * 1.9 - dx / d * 1.1);
      tgtP.x = Math.max(RING.cx - CL, Math.min(RING.cx + CL, tgtP.x)); tgtP.z = Math.max(RING.cz - CL, Math.min(RING.cz + CL, tgtP.z));
      _b.set((f.x + o.x) / 2, FY + 1.0, (f.z + o.z) / 2); _m.lookAt(tgtP, _b, _up); tgtQ.setFromRotationMatrix(_m);
      if (!local.camInit) { local.camP.copy(tgtP); local.camQ.copy(tgtQ); local.camInit = true; }
      const k = 1 - Math.exp(-dt * 7); local.camP.lerp(tgtP, k); local.camQ.slerp(tgtQ, k); camera.position.copy(local.camP); camera.quaternion.copy(local.camQ);
    }
    if (now - (local.lastBars || 0) > 100) { local.lastBars = now; renderBars(now); }
  });
  function botDrive(side, now, dist) {
    const f = F[side], o = F[1 - side]; let mx = 0, mz = 0; if (M.phase !== 'fight') return [0, 0];
    mz = dist > 0.85 ? 1 : dist < 0.65 ? -0.6 : 0; mx = Math.sin(now / 900 + side * 2) * 0.6;
    const opPunching = o.punch && now - o.punchAt < 200; f.blk = opPunching && Math.random() < 0.35 ? true : f.blk && Math.random() < 0.97;
    if (now > (f.next || 0) && dist < 1.25 && f.st > 25) { punch(side, Math.random() < 0.65 ? 'jab' : 'hook'); f.next = now + (500 + Math.random() * 700) / opts.botAggro; f.blk = false; }
    f.vx = mz * 2; f.vz = 0; return [mx, mz];
  }

  // ---------------------------------------------------------------- UI
  function renderBars(now) {
    const on = !!M && M.mode !== 'wait' && (local.at || near()); ui.show(V.SCORE, on); ui.show(bars, on); ui.show(V.KEYS, local.at); if (!on) return;
    const left = Math.max(0, endAt - now); const clk = M.phase === 'down' ? String(Math.min(10, 1 + Math.floor((now - countAt) / 1000))) : Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
    const hb = (s) => `<span style="display:flex;flex-direction:column;gap:4px"><span class="cv-bar hp"><i style="width:${M.hp[s].toFixed(0)}%"></i></span><span class="cv-bar st"><i style="width:${F[s].st.toFixed(0)}%"></i></span></span>`;
    V.score(V.side(nameOf(M.players[0]) + (M.players[0] === me() ? ' (you)' : ''), Math.ceil(M.hp[0]), hb(0), false), chip('ROUND', M.round + '/' + opts.rounds, 'alt') + chip(M.phase === 'down' ? 'COUNT' : M.phase === 'break' ? 'BREAK' : 'TIME', clk, 'role'),
      V.side(nameOf(M.players[1]) + (M.players[1] === me() ? ' (you)' : ''), Math.ceil(M.hp[1]), hb(1), false));
    ui.setHtml(bars, M.phase === 'down' && M.down === local.side ? `<div class="cv-side">${chip('DOWN', 'MASH SPACE / CLICK TO GET UP', 'role')}</div>` : `<div class="cv-side mono"><span class="k">KD::</span><span class="v">${M.kd[0]}–${M.kd[1]}</span> <span class="k">LANDED::</span><span class="v">${esc(String(stats.landed))}</span></div>`);
    V.keys([['WASD', 'MOVE'], ['CLICK', 'JAB'], ['R-CLICK', 'HOOK'], ['SHIFT', 'BLOCK'], ['A/D ×2', 'SLIP'], ['E', 'LEAVE']]);
  }
  function render() { renderBars(performance.now()); }
  function showWin() {
    if (!M) return; const w = M.winner; if (!isPlayer() && !near()) { ui.toast(`${nameOf(M.players[w])} won the fight (${M.reason})`, 3000); return; }
    V.showWin(`${nameOf(M.players[w])} wins`, chip('BOXING', String(M.reason || '').toUpperCase()) + ' ' + chip('ROUND', String(M.round), 'role'),
      [0, 1].map(i => [nameOf(M.players[i]), `${Math.round(M.dealt[i])} DMG · ${M.kd[i]} KD`, i === w]), isPlayer() ? () => startMatch(M.mode, M.players.find(p => p !== me())) : null, () => { if (isPlayer()) leave(); });
  }
  const openJoin = () => {
    if (M && isPlayer() && M.mode !== 'wait' && M.phase !== 'over') { enterRing(); return; }
    const busy = M && M.mode !== 'wait' && M.phase !== 'over' && !isPlayer(); const w = waiting && waiting.players[0] !== me() ? waiting.players[0] : null;
    V.openJoin([w && { a: 'join', label: 'Fight ' + nameOf(w), sub: 'They are waiting in the ring.', pri: true }, { a: 'bot', label: 'Fight the bot', sub: '3 rounds × 60 s. KO or decision.', pri: !w, disabled: busy },
      !w && { a: 'wait', label: 'Wait for a challenger', sub: 'Anyone pressing E at the ring fights you.', disabled: busy }].filter(Boolean), 'click jab · right-click hook · shift block');
  };
  V.onJoin = (a) => { if (a === 'bot') startMatch('bot'); else if (a === 'wait') startMatch('wait'); else if (a === 'join' && waiting) { const h = waiting.players[0]; waiting = null; startMatch('1v1', h); } };
  V.onAccept = (f) => startMatch('1v1', f);
  ctx.interact?.add({ id: 'boxing:steps', pos: new THREE.Vector3(RING.cx - RING.half - 1.0, RING.y - RING.h + 0.5, RING.cz), radius: 1.0, range: 2.6,
    label: () => (M && isPlayer() && M.phase !== 'over' && M.mode !== 'wait' ? 'BACK IN THE RING' : waiting && waiting.players[0] !== me() ? 'FIGHT ' + nameOf(waiting.players[0]).toUpperCase() : 'BOX'),
    use: () => openJoin() });

  const api = {
    get state() { return M ? snap() : null; }, get at() { return local.at; }, get side() { return local.side; }, F, stats, opts,
    startMatch, leave, openJoin, accept: V.accept, challenge: (id) => V.challenge(id), punch: (k = 'jab') => punch(local.side, k), mash: () => mash(local.side),
    set auto(v) { opts.auto = !!v; }, get auto() { return opts.auto; }, get timeLeft() { return Math.max(0, endAt - performance.now()); },
  };
  window.__boxing = api;
  return { id: 'boxing', title: 'Boxing', kind: 'place', icon: ICON, minPlayers: 1, maxPlayers: 2, area: AREA, areaName: 'SPORTS COURT · RING',
    blurb: 'A raised ring at the canyon end. 3 rounds, KO or decision. Fight a friend or the bot.', start() { openJoin(); },
    status() { return { players: M && M.mode !== 'wait' ? M.players.filter(p => p && p !== 'bot').length : M ? 1 : 0, live: !!M && M.mode !== 'wait' && M.phase !== 'over' }; } };
}
