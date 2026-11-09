// Title screen + pause menu + settings (walk mode). main.js owns the camera (menu orbit, fly-in) and calls
// createMenu() once; the menu drives multiplayer through the stable api from multiplayer.js
// (connect / leave / directory). Avatar: both "Avatar…" buttons call hooks.openAvatarPanel() (no-op by default;
// assign window.__menu.hooks.openAvatarPanel = fn to wire the avatar panel in).
// Peer-supplied text (lobby names, hosts) is only ever written with textContent.
import { identity, setName as saveName } from './identity.js';
import { settings } from './settings.js';
import { directory } from './lobbies.js';
import { randomCode, cleanCode } from '../multiplayer.js';
import { rollText, slidePill, stageSwap, ensureGrain } from './motion.js';
import { themeToggle } from './hud.js';

const chip = (k, v) => { const c = document.createElement('span'); c.className = 'chip'; const kk = document.createElement('i'); kk.textContent = k + '::'; const vv = document.createElement('b'); vv.textContent = v; c.append(kk, vv); return c; };
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function createMenu({ mp, quality, perfHud, enterGame, toMenu }) {
  const me = identity();
  const hooks = { openAvatarPanel() {} };
  const root = h('div'); root.id = 'menu'; root.className = 'gm';
  root.innerHTML = `
    <div class="gm-side">
      <div class="gm-title"><div class="gm-kicker">No01 / PALISADES · 2026</div><h1>17609 Camino De Yatasto</h1><p>Pacific Palisades · to-scale walk-through</p></div>
      <label class="gm-name"><span>Your name</span><input id="gm-name" maxlength="24" spellcheck="false" autocomplete="off"></label>
      <nav class="gm-nav">
        <button type="button" class="gm-primary" data-act="quick">Quick play</button>
        <button type="button" data-act="create">Create lobby</button>
        <button type="button" data-act="browse">Browse lobbies</button>
        <button type="button" data-act="code">Join with code</button>
        <button type="button" data-act="solo">Play solo</button>
        <div class="gm-split"><button type="button" data-act="avatar">Avatar…</button><button type="button" data-act="settings">Settings</button></div>
      </nav>
      <div class="gm-stats" id="gm-stats"></div>
      <div class="gm-msg" id="gm-msg" role="status"></div>
    </div>
    <div class="gm-panel" id="gm-panel" hidden>
      <section data-panel="create">
        <h2>Create lobby</h2>
        <label class="gm-field"><span>Lobby name</span><input id="gm-cname" maxlength="40" spellcheck="false" autocomplete="off"></label>
        <div class="gm-field"><span>Visibility</span><div class="gm-seg" role="radiogroup"><button type="button" data-vis="pub" aria-pressed="true">Public</button><button type="button" data-vis="priv" aria-pressed="false">Private</button></div></div>
        <label class="gm-field"><span>Max players <b id="gm-maxv">8</b></span><input id="gm-max" type="range" min="2" max="8" step="1" value="8"></label>
        <div class="gm-actions"><button type="button" class="gm-primary" id="gm-cgo">Create</button><button type="button" class="ghost" data-act="close">Back</button></div>
      </section>
      <section data-panel="browse">
        <div class="gm-head"><h2>Public lobbies</h2><button type="button" class="ghost" id="gm-refresh">Refresh</button></div>
        <div class="gm-list" id="gm-list"></div>
        <div class="gm-actions"><button type="button" class="ghost" data-act="close">Back</button></div>
      </section>
      <section data-panel="code">
        <h2>Join with code</h2>
        <label class="gm-field"><span>Lobby code</span><input id="gm-code" maxlength="24" spellcheck="false" autocomplete="off" placeholder="e.g. k7m2qa"></label>
        <div class="gm-actions"><button type="button" class="gm-primary" id="gm-jgo">Join</button><button type="button" class="ghost" data-act="close">Back</button></div>
      </section>
      <section data-panel="settings">
        <h2>Settings</h2>
        <label class="gm-field"><span>Graphics quality</span><select id="gs-quality"><option value="auto">Auto</option><option value="ultra">Ultra</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <div class="gm-field"><span>Frame rate</span><div class="gm-seg" id="gs-cap" role="radiogroup"><button type="button" data-cap="60" aria-pressed="false">60</button><button type="button" data-cap="120" aria-pressed="false">120</button><button type="button" data-cap="uncapped" aria-pressed="true">Uncapped</button></div></div>
        <p class="gm-hint" id="gs-cap-hint" style="margin:-6px 0 4px;font-size:12px;opacity:.65">Renders as fast as your computer can. Your screen still shows up to its refresh rate. Uses more battery.</p>
        <div class="gm-field"><span>Theme</span><div id="gs-theme"></div></div>
        <label class="gm-check"><input type="checkbox" id="gs-fps"> Show FPS</label>
        <label class="gm-field"><span>Mouse sensitivity <b id="gs-sensv"></b></span><input id="gs-sens" type="range" min="0.2" max="3" step="0.05"></label>
        <label class="gm-field"><span>Volume <b id="gs-volv"></b></span><input id="gs-vol" type="range" min="0" max="1" step="0.05"></label>
        <div class="gm-actions"><button type="button" class="ghost" data-act="close">Done</button></div>
      </section>
    </div>`;
  const pause = h('div'); pause.id = 'pause'; pause.className = 'gm gm-pause';
  pause.innerHTML = `
    <div class="gm-pcard">
      <h2>Paused</h2>
      <div class="gm-plobby" id="gp-lobby"></div>
      <div class="gm-players" id="gp-players"></div>
      <nav class="gm-nav">
        <button type="button" class="gm-primary" data-pact="resume">Resume</button>
        <button type="button" data-pact="invite">Copy invite link</button>
        <div class="gm-split"><button type="button" data-pact="avatar">Avatar…</button><button type="button" data-pact="settings">Settings</button></div>
        <button type="button" class="ghost" data-pact="leave">Leave lobby</button>
      </nav>
    </div>`;
  document.body.append(root, pause);
  const $ = (id) => document.getElementById(id);
  ensureGrain();
  const navPill = slidePill(root.querySelector('.gm-nav'), 'button'); slidePill(root.querySelector('.gm-seg'), 'button'); slidePill(pause.querySelector('.gm-nav'), 'button');
  { const t = root.querySelector('.gm-title h1'); const txt = t.textContent; t.textContent = ''; setTimeout(() => rollText(t, txt), 120); }
  const panel = $('gm-panel'); let open = null; let mode = 'boot'; // boot | menu | joining | game
  let busy = false;

  // ---------------------------------------------------------------- generic
  for (const el of [root, pause]) { el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => e.stopPropagation()); }
  const msg = (t, bad) => { const el = $('gm-msg'); el.textContent = t || ''; el.classList.toggle('bad', !!bad); };
  function showPanel(name) {
    const was = open; open = name;
    if (!name) { panel.hidden = true; } else {
      const wasHidden = panel.hidden; panel.hidden = false;
      const oldS = was && panel.querySelector(`section[data-panel="${was}"]`), newS = panel.querySelector(`section[data-panel="${name}"]`);
      for (const s of panel.querySelectorAll('section')) if (s !== newS && s !== oldS) s.hidden = true;
      if (oldS && oldS !== newS) oldS.hidden = true;
      stageSwap(null, wasHidden ? panel : newS); if (wasHidden) newS.hidden = false;
      const h2 = newS.querySelector('h2'); if (h2) { delete h2.dataset.roll; rollText(h2, h2.dataset.title || (h2.dataset.title = h2.textContent)); }
      for (const g of newS.querySelectorAll('.pill-group')) { g.__pill?.update(); setTimeout(() => g.__pill?.update(), 560); }
    }
    for (const b of root.querySelectorAll('.gm-nav [data-act]')) b.classList.toggle('active', b.dataset.act === name);
    navPill.update();
    if (name === 'browse') { directory.refresh(); renderList(); }
    if (name === 'create') { $('gm-cname').value = $('gm-cname').value || `${me.name}'s house`; }
    if (name === 'settings') syncSettings();
    const first = name && panel.querySelector(`section[data-panel="${name}"] input, section[data-panel="${name}"] button`); first?.focus();
    // settings opened from pause: the panel floats over the pause card
    root.classList.toggle('gm-overlay', mode === 'game' && !!name);
    if (mode === 'game') root.classList.toggle('show', !!name);
  }

  // ---------------------------------------------------------------- name
  const nameEl = $('gm-name'); nameEl.value = me.name;
  nameEl.addEventListener('change', () => { nameEl.value = mp ? mp.setName(nameEl.value) : saveName(nameEl.value); });
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameEl.blur(); });

  // ---------------------------------------------------------------- create
  let pub = true;
  for (const b of root.querySelectorAll('[data-vis]')) b.addEventListener('click', () => { pub = b.dataset.vis === 'pub'; for (const x of root.querySelectorAll('[data-vis]')) x.setAttribute('aria-pressed', String((x.dataset.vis === 'pub') === pub)); root.querySelector('.gm-seg').__pill?.update(); });
  $('gm-max').addEventListener('input', () => { $('gm-maxv').textContent = $('gm-max').value; });
  $('gm-cgo').addEventListener('click', () => create({ name: $('gm-cname').value, pub, max: +$('gm-max').value }));
  $('gm-cname').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('gm-cgo').click(); });

  // ---------------------------------------------------------------- browse
  function renderList() {
    const list = directory.list(); const el = $('gm-list'); el.textContent = '';
    if (!list.length) { el.appendChild(h('div', 'gm-empty', directory.openCount ? 'No public lobbies right now. Create one!' : 'Connecting to the lobby directory…')); }
    for (const e of list) {
      const row = h('div', 'gm-row'); const info = h('div', 'gm-rinfo');
      info.append(h('b', '', e.name), h('span', '', e.host ? `hosted by ${e.host}` : e.code));
      const cnt = chip('PLAYERS', `${e.n}/${e.max}`); cnt.classList.add('gm-count');
      const btn = h('button', '', e.n >= e.max ? 'Full' : 'Join'); btn.type = 'button'; btn.disabled = e.n >= e.max; btn.dataset.code = e.code;
      btn.addEventListener('click', () => join(e.code, e.name));
      row.append(info, cnt, btn); el.appendChild(row);
    }
  }
  function renderStats() {
    const list = directory.list(); const n = list.reduce((a, e) => a + e.n, 0);
    const el = $('gm-stats'); el.textContent = '';
    if (!directory.openCount) { el.append(chip('NET', 'CONNECTING')); return; }
    el.append(chip('LOBBIES', String(list.length)), chip('PLAYERS', String(n)), chip('RELAYS', String(directory.openCount)));
    el.title = `${list.length} ${list.length === 1 ? 'lobby' : 'lobbies'} online · ${n} ${n === 1 ? 'player' : 'players'}`;
  }
  directory.onChange(() => { renderStats(); if (open === 'browse') renderList(); });
  setInterval(() => { if (mode === 'menu' || mode === 'joining') renderStats(); }, 1500);
  $('gm-refresh').addEventListener('click', () => { directory.refresh(); renderList(); });

  // ---------------------------------------------------------------- code
  $('gm-jgo').addEventListener('click', () => { const c = cleanCode($('gm-code').value); if (c.length < 3) { msg('Enter a lobby code', true); return; } join(c); });
  $('gm-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('gm-jgo').click(); });

  // ---------------------------------------------------------------- settings
  function syncSettings() {
    const s = settings.get();
    for (const b of root.querySelectorAll('[data-cap]')) b.setAttribute('aria-pressed', String(b.dataset.cap === s.fpsCap)); $('gs-cap-hint').hidden = s.fpsCap !== 'uncapped'; $('gs-cap').__pill?.update();
    $('gs-quality').value = s.quality; $('gs-fps').checked = !!s.fps; $('gs-sens').value = s.sens; $('gs-vol').value = s.vol;
    $('gs-sensv').textContent = (+s.sens).toFixed(2) + '×'; $('gs-volv').textContent = Math.round(s.vol * 100) + '%';
  }
  $('gs-theme').replaceWith(themeToggle('gm-theme'));
  $('gs-quality').addEventListener('change', () => settings.set({ quality: $('gs-quality').value }));
  slidePill($('gs-cap'), 'button'); for (const b of root.querySelectorAll('[data-cap]')) b.addEventListener('click', () => settings.set({ fpsCap: b.dataset.cap }));
  $('gs-fps').addEventListener('change', () => settings.set({ fps: $('gs-fps').checked }));
  $('gs-sens').addEventListener('input', () => settings.set({ sens: +$('gs-sens').value }));
  $('gs-vol').addEventListener('input', () => settings.set({ vol: +$('gs-vol').value }));
  settings.onChange(syncSettings);

  // ---------------------------------------------------------------- actions
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'close') showPanel(null);
    else if (a === 'quick') quickPlay();
    else if (a === 'solo') solo();
    else if (a === 'avatar') hooks.openAvatarPanel();
    else showPanel(open === a ? null : a);
  });
  function setBusy(on, text) { busy = on; root.classList.toggle('busy', on); msg(text || ''); if (on && text) { const sp = document.createElement('span'); sp.className = 'spin'; $('gm-msg').prepend(sp); } }
  function waitAdmit(ms) {
    return new Promise((res) => {
      if (!mp) return res('solo');
      let off = null; const t = setTimeout(() => { off?.(); res('timeout'); }, ms);
      off = mp.on((ev) => { if (ev === 'admitted' || ev === 'full') { clearTimeout(t); off(); res(ev); } });
    });
  }
  async function create({ name, pub: p = true, max = 8 } = {}) {
    if (busy) return; setBusy(true, 'Creating lobby…');
    const nm = String(name || '').trim() || `${me.name}'s house`;
    if (mp) await mp.connect(randomCode(), { name: nm, pub: p, max: Math.min(8, Math.max(2, max | 0 || 8)) });
    setBusy(false); go();
  }
  async function join(code, hint) {
    if (busy || !mp) return; setBusy(true, `Joining ${hint || code}…`); mode = 'joining';
    const wait = waitAdmit(12000);
    await mp.connect(code);
    const r = await wait;
    setBusy(false);
    if (r === 'full') { mp.leave({ quiet: true }); mode = 'menu'; msg('Lobby is full', true); return 'full'; }
    go(); return r;
  }
  async function quickPlay() {
    if (busy) return; setBusy(true, 'Finding a lobby…'); directory.refresh();
    const t0 = performance.now(); let pick = null;
    while (performance.now() - t0 < 4500) {
      pick = directory.list().filter(e => e.n < e.max).sort((a, b) => b.n - a.n)[0];
      if (pick && performance.now() - t0 > 1500) break;
      await new Promise(r => setTimeout(r, 300));
    }
    setBusy(false);
    if (pick) return join(pick.code, pick.name);
    return create({ name: `${me.name}'s house`, pub: true, max: 8 });
  }
  function solo() { if (mp?.connected) mp.leave({ quiet: true }); go(); }
  function go() { showPanel(null); mode = 'game'; root.classList.remove('show'); document.body.classList.remove('menu-open'); enterGame(); }

  // ---------------------------------------------------------------- main menu show/hide
  function showMain(text, bad) {
    mode = 'menu'; showPause(false); root.classList.add('show'); root.classList.remove('gm-overlay'); document.body.classList.add('menu-open');
    if (document.pointerLockElement) document.exitPointerLock();
    showPanel(null); msg(text || '', bad); directory.ensure(); renderStats();
    setTimeout(() => nameEl.focus({ preventScroll: true }), 50);
  }
  function leaveToMenu(text, bad) { if (mp?.connected) mp.leave(); toMenu(); showMain(text, bad); }
  mp?.on((ev) => {
    if (ev === 'leave-request') leaveToMenu();
    else if (ev === 'full' && mode === 'game') leaveToMenu('Lobby is full', true);
    else if (ev === 'peers' && pause.classList.contains('show')) renderPause();
  });

  // ---------------------------------------------------------------- pause menu
  function renderPause() {
    const l = mp?.lobby; $('gp-lobby').textContent = l ? `${l.name || 'Lobby'} · ${l.code}` : 'Playing solo';
    const pl = $('gp-players'); pl.textContent = '';
    if (mp?.connected) for (const t of mp.ui.players()) pl.appendChild(h('div', 'gm-pl', t));
    pause.querySelector('[data-pact="invite"]').hidden = !mp?.connected;
    pause.querySelector('[data-pact="leave"]').textContent = mp?.connected ? 'Leave lobby' : 'Main menu';
  }
  function showPause(on) {
    if (on && mode !== 'game') return;
    pause.classList.toggle('show', !!on); document.body.classList.toggle('paused', !!on);
    if (on) { renderPause(); if (document.pointerLockElement) document.exitPointerLock(); pause.querySelector('[data-pact="resume"]').focus(); }
    else if (open === 'settings' && mode === 'game') showPanel(null);
  }
  pause.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pact]'); if (!b) return; const a = b.dataset.pact;
    if (a === 'resume') { showPause(false); try { await document.getElementById('c').requestPointerLock?.(); } catch {} }
    else if (a === 'invite') { const url = mp.inviteUrl(); try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied!'; } catch { b.textContent = url; } setTimeout(() => (b.textContent = 'Copy invite link'), 1800); }
    else if (a === 'avatar') hooks.openAvatarPanel();
    else if (a === 'settings') showPanel('settings');
    else if (a === 'leave') leaveToMenu();
  });
  // pointer lock lost while playing -> pause, unless chat / a video watch / the Re-create card has the mouse
  let wasLocked = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    if (wasLocked && !locked && mode === 'game') {
      setTimeout(() => {
        const b = document.body.classList;
        if (document.pointerLockElement || b.contains('ui-open') || b.contains('watching') || document.getElementById('rc')?.classList.contains('show')) return;
        showPause(true);
      }, 60);
    }
    wasLocked = locked; if (locked) showPause(false);
  });
  // keys: while a menu is up nothing reaches the game (capture phase, registered before the game's own handlers)
  addEventListener('keydown', (e) => {
    const inMenu = root.classList.contains('show'), paused = pause.classList.contains('show');
    if (inMenu || paused) {
      if (e.key === 'Escape') { if (open) showPanel(null); else if (paused) showPause(false); }
      else if (e.code === 'KeyM' && paused && !(e.target && e.target.tagName === 'INPUT')) showPause(false);
      // text fields keep their own Enter handlers (every game handler ignores keys typed into an INPUT)
      if (e.target && e.target.tagName === 'INPUT' && (root.contains(e.target) || pause.contains(e.target))) return;
      e.stopImmediatePropagation(); return;
    }
    if (mode !== 'game') { e.stopImmediatePropagation(); return; }
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyM' && !e.repeat && !document.body.classList.contains('ui-open') && !document.body.classList.contains('watching')) { e.preventDefault(); e.stopImmediatePropagation(); showPause(true); }
  }, true);

  const api = {
    hooks, showMain, showPause, create, openSettings: () => { if (mode === 'game') { if (document.pointerLockElement) document.exitPointerLock(); showPanel('settings'); } else showPanel('settings'); }, join, quickPlay, solo, leave: () => leaveToMenu(),
    get mode() { return mode; }, get paused() { return pause.classList.contains('show'); },
    listings: () => directory.list(), directory,
    get message() { return $('gm-msg').textContent; },
    setGame() { mode = 'game'; root.classList.remove('show'); document.body.classList.remove('menu-open'); },
  };
  window.__menu = api;
  return api;
}
