// Party games: Cash Grab, Tag, Musical Chairs, Hide & Seek. startGames(ctx, mp) (ctx = the speaker's ctx, mp = window.__mp).
// Authority: whoever starts a game is its host and owns the state S; every change goes out as a full snapshot on
// mp.channel('game') ({k:'snap', S, now}). Times in S live in keys ending in "At" and are in the SENDER's
// performance.now() clock; receivers shift them by net.clock(sender). Late joiners get a snapshot on join.
// Claims (pickups, tags, chairs) go to the host ({k:'claim', sid, ...}); the host applies them in arrival order
// (first claim by the host's clock wins) and broadcasts. Host leaves -> the remaining player (else lobby member)
// with the lowest id continues from its last synced S. Two games started at once: the older sid wins.
// Phases: invite (5 s, everyone in unless they sit out) -> count (3 s, teleported + frozen) -> play -> end (scoreboard) -> idle.
// Keys: J = games panel / sit out (invite) / close results. R is captured during Musical Chairs (Re-create has no hook).
// Test hooks: window.__games.
import * as THREE from 'three';
import { buildUI, createFloats, chip, esc, icon } from './ui.js';
import { createBursts, createRing } from './fx.js';
import { createSpots } from './spots.js';
import { createBeat } from './audio.js';
import cash from './cash.js';
import tag from './tag.js';
import chairs from './chairs.js';
import hide from './hide.js';

const GAMES = { cash, tag, chairs, hide };
const ORDER = ['cash', 'tag', 'chairs', 'hide'];
const INVITE_MS = 5000, COUNT_MS = 3000, END_MS = 12000;
const WORTH_KEY = 'ph.games.networth';
export const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
export const clockTxt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function shift(o, off) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) { for (const x of o) shift(x, off); return o; }
  for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'number' && k.endsWith('At') && Number.isFinite(v)) o[k] = v + off; else if (v && typeof v === 'object') shift(v, off); }
  return o;
}

export function startGames(ctx, mp) {
  if (window.__games) return window.__games;
  if (!ctx || ctx.shot || !ctx.player) return null;
  mp = mp || window.__mp || null;
  const { player, scene, camera } = ctx; const st = player.state;
  const ch = mp?.channel ? mp.channel('game') : { send() {}, onMessage: null };
  const me = () => mp?.net?.selfId || 'local';
  const ui = buildUI(); const E = ui.els;
  const floats = createFloats(camera, THREE), bursts = createBursts(scene), ring = createRing(scene);
  const spots = createSpots(ctx); const beat = createBeat();
  let S = null;                 // replicated game state
  let dirty = false, hbAcc = 0, lastRoom = mp?.room || null;
  const L = { teleported: null, ended: null, iFroze: false, hidTags: new Set(), cancelled: null }; // local, per client

  const peers = () => mp?.peers || new Map();
  const lobbyIds = () => { const s = new Set([me()]); if (mp?.connected) { for (const id of mp.members || []) s.add(id); } return [...s].filter(id => !String(id).startsWith('bot')); };
  const nameOf = (id) => (id === me() ? (mp?.selfName?.() || 'You') : peers().get(id)?.name || S?.names?.[id] || 'Guest');
  const posOf = (id) => (id === me() ? st.pos : peers().get(id)?.pos || null);
  const isHost = () => !!S && S.host === me();
  const active = (s = S) => !!s && (s.phase === 'invite' || s.phase === 'count' || s.phase === 'play');
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
    if (active()) { ui.toast('A game is already running'); return false; }
    const ids = lobbyIds(); if (ids.length < g.min) { ui.toast(`${g.title} needs ${g.min}+ players`); return false; }
    const now = performance.now();
    S = { sid: String(Date.now()).padStart(14, '0') + '-' + me(), game, host: me(), by: me(), phase: 'invite', startAt: now, endAt: now + (opts.invite ?? INVITE_MS),
      players: ids, names: Object.fromEntries(ids.map(id => [id, nameOf(id)])), scores: {}, data: {}, opts: { ...opts }, results: null, seq: 1 };
    dirty = true; apply(null); openPanel(false); return true;
  }
  function toCount() {
    const g = G();
    if (S.players.length < g.min) { S.phase = 'end'; S.results = { cancel: `Not enough players for ${g.title}`, rows: [] }; S.endAt = performance.now() + 4000; return; }
    S.phase = 'count'; S.startAt = performance.now(); S.endAt = S.startAt + COUNT_MS;
    S.scores = Object.fromEntries(S.players.map(id => [id, 0]));
    g.setup(S, core);
    if (!S.spawn) { const c = g.startArea || [11.8, 20.6]; const sp = spots.near(c[0], c[1], S.players.length); S.spawn = Object.fromEntries(S.players.map((id, i) => [id, sp[i]])); }
  }
  function toPlay() { const g = G(); S.phase = 'play'; S.startAt = performance.now(); S.endAt = S.startAt + (S.opts.dur ?? g.dur); g.begin?.(S, core); }
  function toEnd() {
    const g = G(); g.finalize?.(S, core);
    S.phase = 'end'; S.startAt = performance.now(); S.endAt = S.startAt + END_MS;
    try { S.results = g.results(S, core); } catch (e) { console.warn('[games] results', e); S.results = { rows: [], winners: [] }; }
    g.hostEnd?.(S, core);
  }
  function hostTick(dt) {
    const now = performance.now(); let ch2 = false;
    if (S.phase === 'invite' && now >= S.endAt) { toCount(); ch2 = true; }
    else if (S.phase === 'count' && now >= S.endAt) { toPlay(); ch2 = true; }
    else if (S.phase === 'play') { if (G().hostTick?.(S, dt, core)) ch2 = true; if (S.phase === 'play' && now >= S.endAt) { toEnd(); ch2 = true; } }
    else if (S.phase === 'end' && now >= S.endAt) { S.phase = 'idle'; S.seq++; sendSnap(); resetLocal(); return; }
    if (ch2) { S.seq++; dirty = true; apply(null); }
  }
  function removePlayer(id) {
    if (!S || !S.players.includes(id)) return;
    S.players = S.players.filter(x => x !== id);
    if (S.phase === 'play') { G().onLeave?.(S, id, core); if (S.phase === 'play' && S.players.length < G().min) toEnd(); }
  }
  function onClaim(from, m) {
    if (!isHost() || !S || m.sid !== S.sid) return;
    let changed = false;
    if (m.k === 'out') { if (S.phase === 'invite' || S.phase === 'count' || S.phase === 'play') { removePlayer(from); changed = true; } }
    else if (m.k === 'in') { if (S.phase === 'invite' && !S.players.includes(from) && lobbyIds().includes(from)) { S.players.push(from); S.names[from] = nameOf(from); changed = true; } }
    else if (m.k === 'cancel') { if (from === S.by && S.phase === 'invite') { S.phase = 'idle'; changed = true; } }
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
    const off = (() => { const c = mp?.net?.clock?.(from); return Number.isFinite(c) ? c : (Number.isFinite(m.now) ? performance.now() - m.now : 0); })();
    shift(n, off);
    const prev = S; S = n; apply(prev);
  }
  mp?.onPeerJoin?.((id) => {
    if (!isHost() || !S || S.phase === 'idle') return;
    if (S.phase === 'invite' && !S.players.includes(id)) { S.players.push(id); S.names[id] = nameOf(id); S.seq++; dirty = true; }
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
    S = null; L.teleported = null; L.ended = null; unfreeze(); restoreTags(); ring.set(null); beat.stop();
    for (const el of [E.invite, E.count, E.hud, E.dark, E.end]) ui.show(el, false);
  }

  // ---------------------------------------------------------------- local apply (every snapshot / host change)
  function apply(prev) {
    if (!S) return;
    const g = G();
    if (prev && prev.sid !== S.sid) { try { GAMES[prev.game]?.cleanup?.(core); } catch {} L.teleported = null; L.ended = null; }
    if (S.phase === 'idle') { resetLocal(); return; }
    if ((S.phase === 'count' || S.phase === 'play') && amIn() && L.teleported !== S.sid && S.spawn?.[me()]) {
      L.teleported = S.sid; const p = S.spawn[me()];
      try { if (st.seat) player.setSeat(null); } catch {}
      player.teleport(p[0], p[1] + 0.05, p[2], p[3] ?? st.yaw);
    }
    if (S.phase === 'play' || S.phase === 'count') { try { g.apply?.(S, prev, core); } catch (e) { console.warn('[games] apply', e); } }
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

  // ---------------------------------------------------------------- UI: panel
  let panelOpen = false;
  function renderPanel() {
    const n = lobbyIds().length;
    E.sub.innerHTML = chip('PLAYERS', String(n)) + ' ' + chip('LOBBY', mp?.connected ? String(mp.room).toUpperCase() : 'SOLO', 'alt') + ' ' + chip('NET WORTH', money(+(localStorage.getItem(WORTH_KEY) || 0)), 'role');
    E.grid.innerHTML = ORDER.map((id, i) => {
      const g = GAMES[id]; const short = n < g.min; const dis = g.soon || short || active();
      const why = g.soon ? 'SOON' : short ? `NEEDS ${g.min}+` : active() ? 'IN PROGRESS' : 'START';
      return `<div class="pg-card"><div class="t"><span class="pg-ico">${icon(id)}</span><div><div class="num mono">No0${i + 1}</div><h3>${esc(g.title)}</h3></div></div>
        <p>${esc(g.rules)}</p><div class="row">${chip('MIN', g.min + (g.min > 1 ? '+' : ''), 'alt')}${chip('TIME', g.timeLabel, 'alt')}<button type="button" class="pri" data-g="${id}" ${dis ? 'disabled' : ''}>${dis && !g.soon && !short ? 'Busy' : g.soon ? 'Soon' : short ? `Need ${g.min}` : 'Start'}</button></div></div>`;
      void why;
    }).join('');
    E.note.innerHTML = active() ? `<span class="k">NOW::</span><span class="v">${esc(G().title)}</span> ${isHost() ? '<button type="button" id="pg-stop">End game</button>' : amIn() ? '<button type="button" id="pg-leave">Leave game</button>' : ''}` : '<span class="k">TIP::</span><span class="v">everyone in the lobby gets an invite</span>';
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
  E.invBtn.addEventListener('click', () => inviteAction());
  function inviteAction() {
    if (!S || S.phase !== 'invite') return;
    if (S.by === me()) core.claim({ k: 'cancel' }); else core.claim({ k: amIn() ? 'out' : 'in' });
  }

  // ---------------------------------------------------------------- UI: per-frame render (HUD only rebuilt on change)
  let lastCount = '';
  function render() {
    const now = performance.now(); const g = G();
    const ph = S?.phase;
    // invite
    const inv = ph === 'invite'; ui.show(E.invite, inv);
    if (inv) {
      const left = Math.max(0, Math.ceil((S.endAt - now) / 1000));
      const by = S.by === me() ? 'You' : nameOf(S.by);
      ui.setHtml(E.invTitle, `${esc(by)} started <b>${esc(g.title.toUpperCase())}</b> — ${amIn() ? 'joining' : 'starting'} in ${left}…`);
      ui.setHtml(E.invSub, chip('IN', `${S.players.length}`, 'alt') + ' ' + chip('MIN', String(g.min), 'alt') + (amIn() ? '' : ' ' + chip('YOU', 'SITTING OUT', 'alt')));
      ui.setHtml(E.invBtn, S.by === me() ? 'Cancel <kbd>J</kbd>' : amIn() ? 'Sit out <kbd>J</kbd>' : 'Join <kbd>J</kbd>');
    }
    // countdown
    const cnt = ph === 'count'; ui.show(E.count, cnt || (ph === 'play' && now - S.startAt < 700));
    const ctext = cnt ? String(Math.max(1, Math.ceil((S.endAt - now) / 1000))) : ph === 'play' ? 'GO' : '';
    if (ctext && ctext !== lastCount) { lastCount = ctext; ui.roll(E.countN, ctext); E.countCap.textContent = g ? g.title.toUpperCase() + (amIn() ? '' : ' · SPECTATING') : ''; }
    if (!ctext) lastCount = '';
    // HUD
    const hudOn = ph === 'play' || ph === 'count'; ui.show(E.hud, hudOn);
    if (hudOn) {
      const rows = [['GAME', g.title.toUpperCase()]];
      if (ph === 'play') rows.push(['TIME', g.timeText ? g.timeText(S, core) : clockTxt(S.endAt - now)]);
      let extra = []; try { extra = g.hud?.(S, core) || []; } catch {}
      if (!amIn()) extra.push(['YOU', 'SPECTATING', 'alt']);
      const html = [...rows, ...extra].map(([k, v, c]) => chip(k, v, c || '')).join('');
      ui.setHtml(E.chips, html);
      let b = []; try { b = g.board?.(S, core) || []; } catch {}
      ui.setHtml(E.board, b.slice(0, 5).map((x, i) => `<div class="pg-brow ${x.id === me() ? 'me' : ''}"><span class="r">${i + 1}</span><span class="n">${esc(x.name)}</span><span class="s">${esc(x.text)}</span></div>`).join(''));
    }
    // seeker blackout etc.
    let dark = null; try { dark = ph === 'play' ? g.dark?.(S, core) : null; } catch {}
    ui.show(E.dark, !!dark); if (dark) { ui.setHtml(E.darkMsg, esc(dark.msg)); E.darkT.textContent = dark.t; }
    if (panelOpen) { const k = [active(), lobbyIds().length, S?.phase].join('|'); if (k !== E.panel.__k) { E.panel.__k = k; renderPanel(); } }
  }

  // ---------------------------------------------------------------- per frame
  ctx.onUpdate((dt, t) => {
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
    if (S || E.invite.classList.contains('on') || E.hud.classList.contains('on') || panelOpen) render();
  });

  // ---------------------------------------------------------------- input
  const typing = (e) => { const tg = e.target; return tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e) || e.repeat) return;
    if (panelOpen) { if (e.code === 'Escape' || e.code === 'KeyJ') { e.preventDefault(); openPanel(false); } return; }
    const b = document.body.classList; if (b.contains('ui-open') || b.contains('watching') || b.contains('paused') || b.contains('menu-open')) return;
    if (e.code !== 'KeyJ') return; e.preventDefault();
    if (S?.phase === 'invite') inviteAction();
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
  const api = {
    games: GAMES, start, openPanel, inviteAction, dismissEnd, sitOut: () => core.claim({ k: 'out' }), join: () => core.claim({ k: 'in' }), stop: () => core.claim({ k: 'stop' }),
    action: () => S && G().action?.(S, core), key: (k) => S && G().key?.(k, S, core),
    get state() { return S ? JSON.parse(JSON.stringify(S)) : null; }, get phase() { return S?.phase || 'idle'; }, get host() { return S?.host || null; },
    get me() { return me(); }, get isHost() { return isHost(); }, get in() { return amIn(); }, get panelOpen() { return panelOpen; },
    get netWorth() { return +(localStorage.getItem(WORTH_KEY) || 0); }, get frozen() { return !!st.frozen; }, get music() { return beat.playing; },
    hiddenTags() { const out = {}; for (const [id, r] of peers()) { const s = tagSprites(r.creature); out[id] = s.length ? s.every(x => !x.visible) : null; } return out; },
    local: (k) => G()?.local?.(k, core), spots, core,
  };
  window.__games = api;
  return api;
}
