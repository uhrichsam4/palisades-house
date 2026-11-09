// Games hub: one registry for every game in the house, the Games panel (J or the controller button in the
// top-right HUD row) and a Fortnite-style ready-up lobby for round games. startGames(ctx, mp) (ctx = the
// multiplayer ctx, mp = window.__mp).
//
// ---------------------------------------------------------------- REGISTRY API (for game builders)
//   window.__games.register({
//     id: 'disasters',                       // unique, [a-z0-9]
//     title: 'Natural Disasters',            // card + lobby title
//     blurb: 'Survive the quake…',           // one line on the card
//     icon: '<path d="…"/>' | '<svg…>',      // inline SVG (20×20 viewBox, stroke = currentColor) or its inner paths
//     kind: 'round' | 'place',
//     minPlayers: 1, maxPlayers: 8,
//     area: { pos: [x, y, z], yaw },         // where players are sent (round: spawn centre; place: the venue)
//     start(session) { … },                  // see below
//     onPlayerLeave(id, session) { … },      // optional
//     status() { return { players, live } }, // optional, place games: drives the card's IN GAME count + LIVE badge
//   }) -> the normalised def
//
// kind 'round' (party games): the card opens a ready-up lobby for everyone in the house (others get a toast
// "Sam started TAG — press J to join"). Lobby: one card per joined player, WAITING → READY; Ready / Unready /
// Leave; the host (whoever started it) has Start now. All joined ready (≥ minPlayers), or Start now, or 30 s with
// ≥ minPlayers ready → 3-2-1 countdown, everyone in is teleported (veil fade) to `area` and frozen → play → end
// scoreboard → free roam. Round games run on the host-authority snapshot protocol below and implement any of the
// hooks: setup(S, core), begin(S, core), hostTick(S, dt, core) -> changed, onClaim(S, from, msg, core) -> changed,
// onLeave(S, id, core), apply(S, prev, core), tick(dt, t, S, core), hud(S, core) -> [[KEY, VALUE, cls]],
// board(S, core), results(S, core) -> {rows, winners, title}, frozen(S, core), dark(S, core), action(S, core),
// key(code, S, core), timeText(S, core), finalize/hostEnd(S, core), cleanup(core); `dur` (ms) is the play time.
// start(session) (optional) runs on EVERY client when play begins: session = { def, S, core, me, isHost, players,
// area, claim(msg), mutate(fn), finish(), toast(text) }.
//   Example: register({ id: 'freeze', title: 'Freeze Tag', blurb: 'Tagged players freeze…', kind: 'round',
//     minPlayers: 2, area: { pos: [11.8, 0, 20.6], yaw: 0 }, dur: 90000, setup(S, c) { S.data = { frozen: [] }; },
//     onClaim(S, from, m) { … return true; }, results(S, c) { return { rows: [], winners: [] }; } });
// kind 'place' (pool, ping-pong, tennis…): the card fades out, teleports you to `area` and calls start(session) on
// your client only; the game opens its own join UI (E:: seats, challenge / accept, vs bot). session = { def, ctx,
// mp, hub, me, area, toast(text), nameOf(id), peers() }. The game owns its own mp.channel(…) and state.
//
// ---------------------------------------------------------------- round-game protocol (mp.channel('game'))
// Authority: whoever starts a game is its host and owns the state S; every change goes out as a full snapshot
// ({k:'snap', S, now}). Times in S live in keys ending in "At" and are in the SENDER's performance.now() clock;
// receivers shift them by net.clock(sender). Late joiners get a snapshot on join (and on {k:'hello'}).
// Claims (lobby join/leave/ready, pickups, tags, chairs) go to the host ({k:'claim', sid, m}); the host applies
// them in arrival order and broadcasts. Host leaves -> the remaining player (else lobby member) with the lowest
// id continues from its last synced S. Two games started at once: the older sid wins.
// Phases: lobby (ready-up) -> count (3 s, teleported + frozen) -> play -> end (scoreboard) -> idle.
// Keys: J = games panel / join lobby / toggle ready / close results. R is captured during Musical Chairs.
// Test hooks: window.__games (start, join, ready, leaveLobby, startNow, goPlace, …).
import * as THREE from 'three';
import { buildUI, createFloats, chip, esc, icon, ICON_PATHS } from './ui.js';
import { createBursts, createRing } from './fx.js';
import { createSpots } from './spots.js';
import { createBeat } from './audio.js';
import { identity } from '../net/identity.js';
import cash from './cash.js';
import tag from './tag.js';
import chairs from './chairs.js';
import hide from './hide.js';

const GAMES = {}; const ORDER = [];
const LOBBY_MS = 30000, LOBBY_MAX_MS = 120000, COUNT_MS = 3000, END_MS = 12000;
const WORTH_KEY = 'ph.games.networth';
export const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
export const clockTxt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const CHECK = '<svg class="chk" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4l2.3 2.2 4.7-5"/></svg>';

function shift(o, off) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) { for (const x of o) shift(x, off); return o; }
  for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'number' && k.endsWith('At') && Number.isFinite(v)) o[k] = v + off; else if (v && typeof v === 'object') shift(v, off); }
  return o;
}
const svgOf = (def) => { const s = String(def.icon || ''); if (/^\s*<svg/i.test(s)) return s; return s ? `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s}</svg>` : icon(def.id); };
function normalize(def) {
  def.kind = def.kind === 'place' ? 'place' : 'round';
  def.minPlayers = def.minPlayers ?? def.min ?? 1; def.min = def.minPlayers; def.maxPlayers = def.maxPlayers ?? 8;
  def.blurb = def.blurb ?? def.rules ?? ''; def.rules = def.rules ?? def.blurb;
  if (!def.area && def.startArea) def.area = { pos: [def.startArea[0], 0, def.startArea[1]], yaw: 0 };
  if (def.area && !def.startArea && def.kind === 'round') def.startArea = [def.area.pos[0], def.area.pos[2]];
  if (!def.icon && ICON_PATHS[def.id]) def.icon = ICON_PATHS[def.id];
  def.timeLabel = def.timeLabel ?? (def.dur ? clockTxt(def.dur) : '');
  return def;
}
const BUILTIN = [
  [cash, { blurb: 'Cash rains on the house. Grab stacks — gold briefcases are $50K. Most cash in 60 s wins.' }],
  [tag, { blurb: 'One player is It. Touch someone to pass it on. Least time as It wins.' }],
  [chairs, { blurb: 'Walk the ring while the music plays. When it stops, press R by a free chair.' }],
  [hide, { blurb: 'The seeker counts in the dark for 30 s. Hide. Tagged hiders seek too.' }],
];
for (const [g, extra] of BUILTIN) { Object.assign(g, extra); g.kind = 'round'; normalize(g); GAMES[g.id] = g; ORDER.push(g.id); }

export function startGames(ctx, mp) {
  if (window.__games) return window.__games;
  if (!ctx || ctx.shot || !ctx.player) return null;
  if (new URLSearchParams(location.search).get('games') === '0') return null; // ?games=0: perf A/B without the hub + venues
  mp = mp || window.__mp || null;
  const { player, scene, camera } = ctx; const st = player.state;
  const ch = mp?.channel ? mp.channel('game') : { send() {}, onMessage: null };
  const me = () => mp?.net?.selfId || 'local';
  const ui = buildUI(); const E = ui.els;
  const floats = createFloats(camera, THREE), bursts = createBursts(scene), ring = createRing(scene);
  const spots = createSpots(ctx); const beat = createBeat();
  let S = null;                 // replicated round-game state
  let dirty = false, hbAcc = 0, lastRoom = mp?.room || null;
  const L = { teleported: null, ended: null, iFroze: false, hidTags: new Set(), started: null, toasted: null }; // local, per client

  const peers = () => mp?.peers || new Map();
  const lobbyIds = () => { const s = new Set([me()]); if (mp?.connected) { for (const id of mp.members || []) s.add(id); } return [...s].filter(id => !String(id).startsWith('bot')); };
  const nameOf = (id) => (id === me() ? (mp?.selfName?.() || identity().name || 'You') : peers().get(id)?.name || S?.names?.[id] || 'Guest');
  const hueOf = (id) => (id === me() ? identity().hue : peers().get(id)?.hue ?? S?.hues?.[id] ?? 0.5);
  const charOf = (id) => { const av = mp?.avatars; const d = id === me() ? av?.mine : av?.descOf?.get?.(id); return d?.k === 'b' ? String(d.id || 'character').replace(/[-_]+/g, ' ').toUpperCase().slice(0, 18) : d?.k === 'c' ? 'CUSTOM' : 'MANNEQUIN'; };
  const posOf = (id) => (id === me() ? st.pos : peers().get(id)?.pos || null);
  const isHost = () => !!S && S.host === me();
  const active = (s = S) => !!s && (s.phase === 'lobby' || s.phase === 'count' || s.phase === 'play');
  const amIn = () => !!S && S.players.includes(me());
  const G = () => (S ? GAMES[S.game] : null);

  // ---------------------------------------------------------------- core api handed to the game modules
  const core = {
    THREE, ctx, scene, camera, player, spots, bursts, floats, ring, beat, ui, money, clockTxt,
    me, nameOf, posOf, isHost, amIn, get S() { return S; }, peers,
    now: () => performance.now(),
    dist(a, b) { return a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity; },
    claim(msg) { if (!S) return; if (isHost()) onClaim(me(), { ...msg, sid: S.sid }); else ch.send({ k: 'claim', sid: S.sid, m: msg }, S.host); },
    mutate(fn) { if (!isHost()) return; fn(S); S.seq++; dirty = true; apply(null); },
    finish() { if (isHost() && S.phase === 'play') toEnd(); },
    toast: (t, ms) => ui.toast(t, ms), rnd: (a) => a[Math.floor(Math.random() * a.length)],
  };

  // ---------------------------------------------------------------- host side
  function start(game, opts = {}) {
    const g = GAMES[game]; if (!g || g.soon) return false;
    if (g.kind === 'place') return goPlace(game);
    if (active()) { if (S.game === game && S.phase === 'lobby') { if (!amIn()) core.claim({ k: 'in' }); openPanel(false); return true; } ui.toast('A game is already running'); return false; }
    const ids = lobbyIds(); if (ids.length < g.min) { ui.toast(`${g.title} needs ${g.min}+ players`); return false; }
    const now = performance.now(); const join = opts.autoJoin ? ids : [me()];
    S = { sid: String(Date.now()).padStart(14, '0') + '-' + me(), game, host: me(), by: me(), phase: 'lobby', startAt: now, endAt: now + (opts.lobby ?? LOBBY_MS), cancelAt: now + (opts.lobbyMax ?? LOBBY_MAX_MS),
      players: join, ready: {}, names: Object.fromEntries(ids.map(id => [id, nameOf(id)])), hues: Object.fromEntries(ids.map(id => [id, hueOf(id)])), scores: {}, data: {}, opts: { ...opts }, results: null, seq: 1 };
    if (opts.autoReady) for (const id of join) S.ready[id] = true;
    dirty = true; apply(null); openPanel(false); return true;
  }
  function toCount() {
    const g = G();
    if (S.players.length < g.min) { S.phase = 'end'; S.results = { cancel: `Not enough players for ${g.title}`, rows: [] }; S.endAt = performance.now() + 4000; return; }
    S.phase = 'count'; S.startAt = performance.now(); S.endAt = S.startAt + COUNT_MS;
    S.scores = Object.fromEntries(S.players.map(id => [id, 0]));
    g.setup?.(S, core);
    if (!S.spawn) { const c = g.startArea || [11.8, 20.6]; const sp = spots.near(c[0], c[1], S.players.length); S.spawn = Object.fromEntries(S.players.map((id, i) => [id, sp[i]])); }
  }
  function toPlay() { const g = G(); S.phase = 'play'; S.startAt = performance.now(); S.endAt = S.startAt + (S.opts.dur ?? g.dur ?? 120000); g.begin?.(S, core); }
  function toEnd() {
    const g = G(); g.finalize?.(S, core);
    S.phase = 'end'; S.startAt = performance.now(); S.endAt = S.startAt + END_MS;
    try { S.results = g.results ? g.results(S, core) : { rows: [], winners: [] }; } catch (e) { console.warn('[games] results', e); S.results = { rows: [], winners: [] }; }
    g.hostEnd?.(S, core);
  }
  function cancelLobby(msg) { S.phase = 'end'; S.results = { cancel: msg, rows: [] }; S.startAt = performance.now(); S.endAt = S.startAt + 3000; }
  function hostTick(dt) {
    const now = performance.now(); let ch2 = false; const g = G();
    if (S.phase === 'lobby') {
      const ready = S.players.filter(id => S.ready[id]);
      if (S.players.length && ready.length === S.players.length && ready.length >= g.min) { toCount(); ch2 = true; }
      else if (now >= S.endAt && ready.length >= g.min) { S.players = ready; toCount(); ch2 = true; }
      else if (now >= S.cancelAt) { cancelLobby(`${g.title} lobby closed — not enough players ready`); ch2 = true; }
      else if (!S.players.length && now - S.startAt > 1500) { cancelLobby(`${g.title} lobby closed`); ch2 = true; }
    }
    else if (S.phase === 'count' && now >= S.endAt) { toPlay(); ch2 = true; }
    else if (S.phase === 'play') { if (g.hostTick?.(S, dt, core)) ch2 = true; if (S.phase === 'play' && now >= S.endAt) { toEnd(); ch2 = true; } }
    else if (S.phase === 'end' && now >= S.endAt) { S.phase = 'idle'; S.seq++; sendSnap(); resetLocal(); return; }
    if (ch2) { S.seq++; dirty = true; apply(null); }
  }
  function removePlayer(id) {
    if (!S || !S.players.includes(id)) return;
    S.players = S.players.filter(x => x !== id); delete S.ready[id];
    if (S.phase === 'play') { const g = G(); g.onLeave?.(S, id, core); try { g.onPlayerLeave?.(id, session()); } catch {} if (S.phase === 'play' && S.players.length < g.min) toEnd(); }
  }
  function onClaim(from, m) {
    if (!isHost() || !S || m.sid !== S.sid) return;
    let changed = false; const lobby = S.phase === 'lobby';
    if (m.k === 'out') { if (active()) { removePlayer(from); changed = true; } }
    else if (m.k === 'in') { if (lobby && !S.players.includes(from) && lobbyIds().includes(from) && S.players.length < (G().maxPlayers || 8)) { S.players.push(from); S.ready[from] = false; S.names[from] = nameOf(from); S.hues[from] = hueOf(from); changed = true; } }
    else if (m.k === 'ready') { if (lobby && S.players.includes(from)) { S.ready[from] = !!m.v; changed = true; } }
    else if (m.k === 'startnow') { if (lobby && from === S.host) { if (S.players.length >= G().min) { toCount(); changed = true; } } }
    else if (m.k === 'cancel') { if (from === S.by && lobby) { S.phase = 'idle'; changed = true; } }
    else if (m.k === 'stop') { if (S.phase === 'play' || S.phase === 'count') { if (S.phase === 'count') toPlay(); toEnd(); changed = true; } }
    else if (S.phase === 'play' && S.players.includes(from)) { try { changed = !!G().onClaim?.(S, from, m, core); } catch (e) { console.warn('[games] claim', e); } }
    if (changed) { S.seq++; dirty = true; apply(null); }
  }
  function sendSnap(target) { if (!S) return; ch.send({ k: 'snap', S: JSON.parse(JSON.stringify(S)), now: performance.now() }, target); }

  // ---------------------------------------------------------------- network
  ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'snap') onSnap(m, from);
    else if (m.k === 'claim' && m.m && typeof m.m === 'object') onClaim(from, { ...m.m, sid: m.sid });
    else if (m.k === 'hello' && isHost() && S && S.phase !== 'idle') sendSnap(from);
  };
  function onSnap(m, from) {
    const n = m.S; if (!n || typeof n !== 'object' || !GAMES[n.game] || n.host !== from || !Array.isArray(n.players)) return;
    if (S && S.sid !== n.sid && active(S) && S.sid < n.sid) { if (isHost()) sendSnap(from); return; } // older game wins
    if (S && S.sid === n.sid && n.host === S.host && n.seq <= S.seq) return;
    if (!S && n.phase === 'idle') return;
    n.ready = n.ready || {}; n.hues = n.hues || {};
    const off = (() => { const c = mp?.net?.clock?.(from); return Number.isFinite(c) ? c : (Number.isFinite(m.now) ? performance.now() - m.now : 0); })();
    shift(n, off);
    const prev = S; S = n; apply(prev);
  }
  mp?.onPeerJoin?.((id) => {
    if (!isHost() || !S || S.phase === 'idle') return;
    if (S.phase === 'lobby') { S.names[id] = nameOf(id); S.hues[id] = hueOf(id); S.seq++; dirty = true; }
    setTimeout(() => sendSnap(id), 600);
  });
  mp?.onPeerLeave?.((id) => {
    if (!S || S.phase === 'idle') return;
    if (S.host === id) {
      const left = S.players.filter(x => x !== id && (x === me() || mp.members?.has?.(x)));
      const cands = (left.length ? left : lobbyIds()).slice().sort();
      S.host = cands[0] || me();
      if (isHost()) { S.names = S.names || {}; removePlayer(id); S.seq++; dirty = true; apply(null); ui.toast('Host left — you are running the game'); }
      return;
    }
    if (isHost()) { removePlayer(id); S.seq++; dirty = true; apply(null); }
  });
  try { mp?.on?.((ev) => { if (ev === 'left') resetLocal(); }); } catch {}
  setTimeout(() => ch.send({ k: 'hello' }), 1500);

  function resetLocal() {
    if (S) { try { G()?.cleanup?.(core); } catch {} }
    S = null; L.teleported = null; L.ended = null; L.started = null; unfreeze(); restoreTags(); ring.set(null); beat.stop();
    for (const el of [E.invite, E.count, E.hud, E.dark, E.end, E.lobby]) ui.show(el, false);
    lobbyCards.clear(); E.lbCards.textContent = '';
  }
  function session() {
    return { def: G(), S, core, me: me(), isHost: isHost(), players: S ? S.players.slice() : [], area: G()?.area || null,
      claim: core.claim, mutate: core.mutate, finish: core.finish, toast: core.toast };
  }

  // ---------------------------------------------------------------- local apply (every snapshot / host change)
  function apply(prev) {
    if (!S) return;
    const g = G();
    if (prev && prev.sid !== S.sid) { try { GAMES[prev.game]?.cleanup?.(core); } catch {} L.teleported = null; L.ended = null; L.started = null; lobbyCards.clear(); E.lbCards.textContent = ''; }
    if (S.phase === 'idle') { resetLocal(); return; }
    if (S.phase === 'lobby' && L.toasted !== S.sid && S.by !== me()) { L.toasted = S.sid; ui.toast(`${nameOf(S.by)} started ${g.title.toUpperCase()} — press J to join`, 4200); }
    if ((S.phase === 'count' || S.phase === 'play') && amIn() && L.teleported !== S.sid && S.spawn?.[me()]) {
      L.teleported = S.sid; const p = S.spawn[me()];
      ui.veil(true); setTimeout(() => ui.veil(false), 320);
      try { if (st.seat) player.setSeat(null); } catch {}
      player.teleport(p[0], p[1] + 0.05, p[2], p[3] ?? st.yaw);
    }
    if (S.phase === 'play' && L.started !== S.sid) { L.started = S.sid; try { g.start?.(session()); } catch (e) { console.warn('[games] start', e); } }
    if (S.phase === 'play' || S.phase === 'count') { try { g.apply?.(S, prev, core); } catch (e) { console.warn('[games] apply', e); } }
    else if (S.phase === 'end' && g.clearOnEnd) { try { g.cleanup?.(core); } catch {} } // polish: Cash Grab props go when the round ends
    if (S.phase === 'end' && L.ended !== S.sid) { L.ended = S.sid; try { g.cleanup?.(core); } catch {} onEnd(); }
    render(true);
  }
  function onEnd() {
    unfreeze(); restoreTags(); ring.set(null); beat.stop();
    const r = S.results || { rows: [] };
    if (r.cancel) { ui.toast(r.cancel, 3000); ui.show(E.end, false); return; }
    // lifetime cash ("net worth")
    let earned = 0; const mine = (r.rows || []).find(x => x.id === me());
    if (mine && S.players.includes(me())) earned = Math.max(0, mine.earn || 0);
    let worth = +(localStorage.getItem(WORTH_KEY) || 0) || 0; worth += earned; try { localStorage.setItem(WORTH_KEY, String(worth)); } catch {}
    E.endGame.innerHTML = chip('GAME', G().title.toUpperCase()) + ' ' + chip('PLAYERS', String((r.rows || []).length), 'alt');
    ui.roll(E.endWin, r.title || 'Game over');
    E.rows.innerHTML = (r.rows || []).map((x, i) => `<div class="pg-row ${(r.winners || []).includes(x.id) ? 'win' : ''}" style="animation-delay:${120 + i * 60}ms"><span class="rk mono">${i + 1}</span><span class="nm">${esc(x.name)}${x.id === me() ? ' <span class="k">(YOU)</span>' : ''}</span><span class="sc mono">${esc(x.text)}</span></div>`).join('');
    E.worth.innerHTML = chip('NET WORTH', money(worth)) + (earned ? ' ' + chip('EARNED', '+' + money(earned), 'role') : '');
    ui.show(E.end, true);
    for (const w of (r.winners || []).slice(0, 3)) { const p = posOf(w); if (p) { const party = window.__party?.money; if (party?.burst) { try { party.burst(p.clone ? p.clone() : p, 150); } catch { bursts.burst(p, 150); } } else { bursts.burst(p, 150); bursts.burst(p, 90, 'confetti'); } } }
  }
  function dismissEnd() { ui.show(E.end, false); }
  E.endX.addEventListener('click', dismissEnd);

  // ---------------------------------------------------------------- freeze / name tags
  function unfreeze() { if (L.iFroze) { st.frozen = false; L.iFroze = false; } }
  function setFrozen(on) { if (on) { if (!st.frozen) { st.frozen = true; L.iFroze = true; } } else unfreeze(); }
  function tagSprites(creature) { const out = []; creature?.root?.traverse?.((o) => { if (o.isSprite) out.push(o); }); return out; }
  function setTagHidden(id, hidden) {
    const r = peers().get(id); if (!r) return;
    for (const s of tagSprites(r.creature)) { if (hidden) { if (s.visible) { s.visible = false; L.hidTags.add(s); } } else if (L.hidTags.has(s)) { s.visible = true; L.hidTags.delete(s); } }
  }
  function restoreTags() { for (const s of L.hidTags) s.visible = true; L.hidTags.clear(); }
  core.setTagHidden = setTagHidden; core.restoreTags = restoreTags;

  // ---------------------------------------------------------------- place games (teleport + the game's own UI)
  let placeBusy = false;
  function goPlace(id, { teleport = true } = {}) {
    const g = GAMES[id]; if (!g || g.kind !== 'place') return false;
    openPanel(false);
    const run = () => { try { g.start?.({ def: g, ctx, mp, hub: api, me: me(), area: g.area, toast: core.toast, nameOf, peers }); } catch (e) { console.warn('[games] place start', id, e); } };
    if (!teleport || !g.area || placeBusy) { run(); return true; }
    placeBusy = true; ui.veil(true);
    setTimeout(() => {
      try { if (st.seat) player.setSeat(null); } catch {}
      const [x, y, z] = g.area.pos; player.teleport(x, y + 0.05, z, g.area.yaw ?? st.yaw);
      setTimeout(() => { ui.veil(false); placeBusy = false; run(); }, 140);
    }, 280);
    return true;
  }

  // ---------------------------------------------------------------- UI: panel
  let panelOpen = false;
  function cardState(id) {
    const g = GAMES[id];
    if (g.kind === 'place') { let s = null; try { s = g.status?.() || null; } catch {} return { n: s?.players || 0, live: !!s?.live }; }
    const mine = S && S.game === id && active();
    return { n: mine ? S.players.length : 0, live: mine && (S.phase === 'play' || S.phase === 'count'), lobby: mine && S.phase === 'lobby' };
  }
  function renderPanel() {
    const n = lobbyIds().length;
    E.sub.innerHTML = chip('PLAYERS', String(n)) + ' ' + chip('LOBBY', mp?.connected ? String(mp.room).toUpperCase() : 'SOLO', 'alt') + ' ' + chip('NET WORTH', money(+(localStorage.getItem(WORTH_KEY) || 0)), 'role');
    E.grid.innerHTML = ORDER.map((id, i) => {
      const g = GAMES[id]; const cs = cardState(id);
      let label = 'Start', dis = false;
      if (g.kind === 'place') label = 'Go';
      else if (g.soon) { label = 'Soon'; dis = true; }
      else if (cs.lobby) label = S.players.includes(me()) ? 'In lobby' : 'Join lobby';
      else if (active()) { label = cs.live ? 'Live' : 'Busy'; dis = true; }
      else if (n < g.min) { label = `Need ${g.min}`; dis = true; }
      const range = g.minPlayers === g.maxPlayers ? String(g.minPlayers) : `${g.minPlayers}–${g.maxPlayers}`;
      return `<div class="pg-card">${cs.live ? '<span class="badge"><i></i>LIVE</span>' : cs.lobby ? '<span class="badge"><i></i>LOBBY</span>' : ''}<div class="t"><span class="pg-ico">${svgOf(g)}</span><div><div class="num mono">No${String(i + 1).padStart(2, '0')} · ${g.kind === 'place' ? 'VENUE' : 'ROUND'}</div><h3>${esc(g.title)}</h3></div></div>
        <p>${esc(g.blurb)}</p><div class="row">${chip('PLAYERS', range, 'alt')}${chip('IN GAME', String(cs.n), cs.n ? 'role' : 'alt')}<button type="button" class="pri" data-g="${id}" ${dis ? 'disabled' : ''}>${label}</button></div></div>`;
    }).join('');
    E.note.innerHTML = active() ? `<span class="k">NOW::</span><span class="v">${esc(G().title)}</span> ${isHost() && S.phase !== 'lobby' ? '<button type="button" id="pg-stop">End game</button>' : amIn() ? '<button type="button" id="pg-leave">Leave game</button>' : ''}` : '<span class="k">TIP::</span><span class="v">round games open a ready-up lobby for everyone · venues teleport you there</span>';
  }
  E.grid.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b && !b.disabled) start(b.dataset.g); });
  E.note.addEventListener('click', (e) => { if (e.target.id === 'pg-stop') { core.claim({ k: 'stop' }); openPanel(false); } else if (e.target.id === 'pg-leave') { core.claim({ k: 'out' }); openPanel(false); } });
  E.x.addEventListener('click', () => openPanel(false));
  function openPanel(v) {
    if (v === panelOpen) return; panelOpen = v;
    if (v) { renderPanel(); document.body.classList.add('ui-open'); st.keys.clear(); try { document.exitPointerLock?.(); } catch {} }
    else document.body.classList.remove('ui-open');
    ui.show(E.panel, v);
  }
  // lobby buttons
  const join = () => { if (S?.phase === 'lobby' && !amIn()) core.claim({ k: 'in' }); };
  const setReady = (v) => { if (S?.phase === 'lobby' && amIn()) core.claim({ k: 'ready', v: v ?? !S.ready[me()] }); };
  const leaveLobby = () => { if (S?.phase === 'lobby' && amIn()) { if (S.by === me() && S.players.length <= 1) core.claim({ k: 'cancel' }); else core.claim({ k: 'out' }); } };
  const startNow = () => { if (S?.phase === 'lobby' && isHost()) core.claim({ k: 'startnow' }); };
  E.lbReady.addEventListener('click', () => setReady()); E.lbLeave.addEventListener('click', leaveLobby); E.lbStart.addEventListener('click', startNow);
  E.invBtn.addEventListener('click', () => inviteAction());
  function inviteAction() { if (!S || S.phase !== 'lobby') return; if (amIn()) setReady(); else join(); }

  // ---------------------------------------------------------------- UI: lobby cards (persistent DOM so the pill slides)
  const lobbyCards = new Map();
  function renderLobby(now) {
    const g = G(); const ready = S.players.filter(id => S.ready[id]); const mine = !!S.ready[me()];
    if (E.lbTitle.dataset.roll !== g.title) ui.roll(E.lbTitle, g.title);
    ui.setHtml(E.lbKicker, `<span class="k">READY UP::</span><span class="acc">${esc(S.by === me() ? 'YOU STARTED IT' : nameOf(S.by).toUpperCase() + ' STARTED IT')}</span>`);
    const left = S.endAt - now; const can = ready.length >= g.min;
    const auto = S.players.length && ready.length === S.players.length && can ? 'EVERYONE READY' : can ? 'STARTS IN ' + clockTxt(left) : `${Math.max(0, g.min - ready.length)} MORE TO READY`;
    ui.setHtml(E.lbChips, chip('READY', `${ready.length}/${S.players.length}`) + chip('MIN', String(g.min), 'alt') + chip('AUTO', auto, can ? 'role' : 'alt'));
    // cards
    const want = new Set(S.players);
    for (const [id, el] of lobbyCards) if (!want.has(id)) { el.remove(); lobbyCards.delete(id); }
    for (const id of S.players) {
      let el = lobbyCards.get(id);
      if (!el) {
        el = document.createElement('div'); el.className = 'pg-lc' + (id === me() ? ' me' : ''); el.dataset.id = id;
        const nm = nameOf(id); el.style.setProperty('--h', Math.round(((S.hues?.[id] ?? hueOf(id)) % 1) * 360));
        el.innerHTML = `<div class="pg-lc-top"><span class="pg-av">${esc(nm.slice(0, 1).toUpperCase())}</span><div class="who"><div class="pg-lc-name">${esc(nm)}${id === me() ? ' <span class="k">(YOU)</span>' : ''}</div><div class="mono"><span class="k">CHAR::</span><span class="v">${esc(charOf(id))}</span>${id === S.host ? ' <span class="k">·</span> <span class="v pg-host">HOST</span>' : ''}</div></div></div>
          <div class="pg-seg"><span class="pg-pill"></span><span class="o w">WAITING</span><span class="o r">READY ${CHECK}</span></div>`;
        E.lbCards.appendChild(el); lobbyCards.set(id, el);
      }
      el.classList.toggle('ready', !!S.ready[id]);
    }
    ui.setHtml(E.lbReady, mine ? 'Unready <kbd>J</kbd>' : 'Ready <kbd>J</kbd>');
    E.lbReady.classList.toggle('pri', !mine);
    E.lbStart.hidden = !isHost(); E.lbStart.disabled = S.players.length < g.min;
    ui.setHtml(E.lbHint, `<span class="k">AREA::</span><span class="v">${esc(g.areaName || 'BACK YARD')}</span> <span class="k">· TIME::</span><span class="v">${esc(g.timeLabel || '—')}</span> <span class="k">· ESC FREES THE MOUSE</span>`);
  }

  // ---------------------------------------------------------------- UI: per-frame render (HUD only rebuilt on change)
  let lastCount = '', tabHeld = false;
  function render() {
    const now = performance.now(); const g = G();
    const ph = S?.phase;
    // lobby (joined) / invite card (not joined)
    const lob = ph === 'lobby'; ui.show(E.lobby, lob && amIn()); ui.show(E.invite, lob && !amIn());
    if (lob && amIn()) renderLobby(now);
    if (lob && !amIn()) {
      const by = S.by === me() ? 'You' : nameOf(S.by);
      ui.setHtml(E.invTitle, `${esc(by)} started <b>${esc(g.title.toUpperCase())}</b> — press J to join`);
      ui.setHtml(E.invSub, chip('IN', `${S.players.length}`, 'alt') + ' ' + chip('READY', String(S.players.filter(id => S.ready[id]).length), 'alt') + ' ' + chip('MIN', String(g.min), 'alt'));
      ui.setHtml(E.invBtn, 'Join <kbd>J</kbd>');
    }
    // countdown
    const cnt = ph === 'count'; ui.show(E.count, cnt || (ph === 'play' && now - S.startAt < 700));
    const ctext = cnt ? String(Math.max(1, Math.ceil((S.endAt - now) / 1000))) : ph === 'play' ? 'GO' : '';
    if (ctext && ctext !== lastCount) { lastCount = ctext; ui.roll(E.countN, ctext); E.countCap.textContent = g ? g.title.toUpperCase() + (amIn() ? '' : ' · SPECTATING') : ''; }
    if (!ctext) lastCount = '';
    // HUD
    const hudOn = ph === 'play' || ph === 'count'; ui.show(E.hud, hudOn);
    if (hudOn) {
      /* calm HUD: ONE compact top-centre strip ("CASH GRAB  0:10 · YOU $8,000 · LEAD …"); the scoreboard only shows
         while Tab is held and in the last 10 s of a round (the end screen has the full results) */
      const time = ph === 'play' ? (g.timeText ? g.timeText(S, core) : clockTxt(S.endAt - now)) : '';
      let extra = []; try { extra = g.hud?.(S, core) || []; } catch {}
      if (!amIn()) extra.push(['YOU', 'SPECTATING', 'alt']);
      const html = `<span class="pg-chip pg-strip"><span class="acc">${esc(g.title.toUpperCase())}</span>` + (time ? `<span class="v pg-time">${esc(time)}</span>` : '')
        + extra.map(([k, v, c]) => `<span class="k pg-sep">·</span><span class="k">${esc(k)}</span><span class="${c === 'role' ? 'acc' : 'v'}">${esc(v)}</span>`).join('') + '</span>';
      ui.setHtml(E.chips, html);
      let b = []; try { b = g.board?.(S, core) || []; } catch {}
      ui.setHtml(E.board, b.slice(0, 5).map((x, i) => `<div class="pg-brow ${x.id === me() ? 'me' : ''}"><span class="r">${i + 1}</span><span class="n">${esc(x.name)}</span><span class="s">${esc(x.text)}</span></div>`).join(''));
      const boardOn = tabHeld || (ph === 'play' && S.endAt - now < 10000);
      if (E.board.classList.contains('show') !== boardOn) E.board.classList.toggle('show', boardOn);
    }
    // seeker blackout etc.
    let dark = null; try { dark = ph === 'play' ? g.dark?.(S, core) : null; } catch {}
    ui.show(E.dark, !!dark); if (dark) { ui.setHtml(E.darkMsg, esc(dark.msg)); E.darkT.textContent = dark.t; }
    if (panelOpen) { const k = [active(), lobbyIds().length, S?.phase, S?.players?.length, ORDER.map(id => { const c = cardState(id); return c.n + (c.live ? 'L' : ''); }).join(',')].join('|'); if (k !== E.panel.__k) { E.panel.__k = k; renderPanel(); } }
  }

  // ---------------------------------------------------------------- per frame (nothing while idle)
  let panelAcc = 0;
  ctx.onUpdate((dt, t) => {
    if (!S && !panelOpen) { lastRoom = mp?.room || null; bursts.update(dt); floats.update(dt); return; } // idle: two empty-list loops
    if (S && isHost() && S.phase !== 'idle') hostTick(dt);
    else if (S && S.phase === 'end' && performance.now() > S.endAt + 2500) resetLocal();
    if (S && isHost()) { hbAcc += dt; if (dirty || (hbAcc > 1.5 && S.phase !== 'idle')) { dirty = false; hbAcc = 0; sendSnap(); } }
    const g = G();
    if (S && (S.phase === 'play' || S.phase === 'count')) {
      setFrozen((S.phase === 'count' && amIn()) || (S.phase === 'play' && amIn() && !!g.frozen?.(S, core)));
      try { g.tick?.(dt, t, S, core); } catch (e) { console.warn('[games] tick', e); }
    } else if (L.iFroze) unfreeze();
    bursts.update(dt); floats.update(dt);
    const rm = mp?.room || null; if (lastRoom !== rm) { if (S) resetLocal(); } lastRoom = rm;
    panelAcc += dt;
    if (S || E.invite.classList.contains('on') || E.hud.classList.contains('on') || (panelOpen && panelAcc > 0.25)) { panelAcc = 0; render(); }
  });

  // ---------------------------------------------------------------- input
  /* Tab (held) shows the scoreboard during a round (tabHeld is declared next to render) */
  addEventListener('keydown', (e) => { if (e.code !== 'Tab' || typing(e) || document.body.classList.contains('photo')) return; if (S && (S.phase === 'play' || S.phase === 'count')) { e.preventDefault(); tabHeld = true; } });
  addEventListener('keyup', (e) => { if (e.code === 'Tab') tabHeld = false; });
  addEventListener('blur', () => { tabHeld = false; });
  const typing = (e) => { const tg = e.target; return tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e) || e.repeat) return;
    if (panelOpen) { if (e.code === 'Escape' || e.code === 'KeyJ') { e.preventDefault(); openPanel(false); } return; }
    const b = document.body.classList; if (b.contains('ui-open') || b.contains('watching') || b.contains('paused') || b.contains('menu-open')) return;
    if (e.code !== 'KeyJ') return; e.preventDefault();
    if (S?.phase === 'lobby') inviteAction();
    else if (E.end.classList.contains('on')) dismissEnd();
    else openPanel(true);
  });
  addEventListener('keyup', (e) => { if (e.key === 'Escape' && panelOpen) openPanel(false); }, true);
  // R during Musical Chairs (and any game key a module wants): captured before Re-create sees it
  addEventListener('keydown', (e) => {
    if (typing(e) || e.repeat || !S || S.phase !== 'play' || !amIn()) return;
    const b = document.body.classList; if (b.contains('ui-open') || b.contains('paused') || b.contains('menu-open')) return;
    if (e.code === 'KeyR') { e.preventDefault(); e.stopImmediatePropagation(); try { G().key?.('KeyR', S, core); } catch (err) { console.warn('[games] key', err); } }
  }, true);
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !document.pointerLockElement || !S || S.phase !== 'play' || !amIn()) return;
    try { G().action?.(S, core); } catch (err) { console.warn('[games] action', err); }
  }, true);

  // ---------------------------------------------------------------- api / test hooks
  function register(def) {
    if (!def || typeof def !== 'object' || !/^[a-z0-9_-]{1,24}$/.test(String(def.id || ''))) throw new Error('games.register: needs an id ([a-z0-9_-])');
    normalize(def); GAMES[def.id] = def; if (!ORDER.includes(def.id)) ORDER.push(def.id);
    if (panelOpen) renderPanel();
    return def;
  }
  const api = {
    games: GAMES, order: ORDER, register, start, goPlace, openPanel, togglePanel: () => openPanel(!panelOpen), inviteAction, dismissEnd,
    join, ready: (v = true) => setReady(v), unready: () => setReady(false), leaveLobby, startNow,
    sitOut: () => core.claim({ k: 'out' }), stop: () => core.claim({ k: 'stop' }),
    action: () => S && G().action?.(S, core), key: (k) => S && G().key?.(k, S, core),
    get state() { return S ? JSON.parse(JSON.stringify(S)) : null; }, get phase() { return S?.phase || 'idle'; }, get host() { return S?.host || null; },
    get me() { return me(); }, get isHost() { return isHost(); }, get in() { return amIn(); }, get panelOpen() { return panelOpen; },
    get netWorth() { return +(localStorage.getItem(WORTH_KEY) || 0); }, get frozen() { return !!st.frozen; }, get music() { return beat.playing; },
    hiddenTags() { const out = {}; for (const [id, r] of peers()) { const s = tagSprites(r.creature); out[id] = s.length ? s.every(x => !x.visible) : null; } return out; },
    local: (k) => G()?.local?.(k, core), spots, core, ui, nameOf, hueOf, peers,
  };
  window.__games = api;
  // venues (built at start; static + merged, no per-frame work until someone plays)
  import('./pool/index.js').then(m => register(m.createPool(ctx, mp, api))).catch(e => console.warn('[games] pool not started:', e));
  import('./pingpong/index.js').then(m => register(m.createPingPong(ctx, mp, api))).catch(e => console.warn('[games] ping-pong not started:', e));
  import('./tennis/index.js').then(m => register(m.createTennis(ctx, mp, api))).catch(e => console.warn('[games] tennis not started:', e));
  import('./basketball/index.js').then(m => register(m.createBasketball(ctx, mp, api))).catch(e => console.warn('[games] basketball not started:', e));
  import('./boxing/index.js').then(m => register(m.createBoxing(ctx, mp, api))).catch(e => console.warn('[games] boxing not started:', e));
  import('./disaster/index.js').then(m => m.registerDisaster(api)).catch(e => console.warn('[games] disasters not started:', e)); // round game, lazy fx
  return api;
}
