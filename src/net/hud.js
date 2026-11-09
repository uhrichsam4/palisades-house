// In-game HUD (docs/UI_STYLE.md): one status chip top-left (time · weather; FPS / LISTENING only when on), a room-name
// toast, square icon buttons top-right (games, chat, people + online badge / lobby popover, settings, menu) that fade
// while walking (body.hud-calm), a collapsible bottom key-hint row, a mono
// status line (path tracing) and rolling Re-create countdown digits. Chips refresh 4×/s from a timer: nothing
// per frame. F toggles FPS, G cycles graphics quality.
import { settings } from './settings.js';
import { rollText, slidePill } from './motion.js';

const ICON = {
  games: '<path d="M6.2 6.5h7.6a3.4 3.4 0 0 1 3.3 2.7l.8 4.1a2 2 0 0 1-3.4 1.7l-1.9-2h-5.2l-1.9 2a2 2 0 0 1-3.4-1.7l.8-4.1a3.4 3.4 0 0 1 3.3-2.7z"/><path d="M6.5 9v2.4M5.3 10.2h2.4"/><circle cx="13.2" cy="9.6" r=".5"/><circle cx="14.6" cy="11" r=".5"/>',
  chat: '<path d="M3.5 4.5h13v8.5h-7l-3.5 3v-3h-2.5z"/>',
  avatar: '<circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6"/>',
  people: '<circle cx="8" cy="7.2" r="2.8"/><path d="M2.8 16.2c.8-2.7 2.8-4.1 5.2-4.1s4.4 1.4 5.2 4.1"/><path d="M12.6 4.7a2.6 2.6 0 0 1 0 5M14.4 12.4c1.3.6 2.2 1.9 2.8 3.8"/>',
  settings: '<path d="M3.5 6h8M14.5 6h2M3.5 14h2M8.5 14h8"/><circle cx="13" cy="6" r="1.6"/><circle cx="7" cy="14" r="1.6"/>',
  menu: '<path d="M4 6h12M4 10h12M4 14h12"/>',
  sun: '<circle cx="10" cy="10" r="3"/><path d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5 5l1.1 1.1M13.9 13.9L15 15M5 15l1.1-1.1M13.9 6.1L15 5"/>',
  moon: '<path d="M15.5 12.3A6 6 0 0 1 7.7 4.5a6 6 0 1 0 7.8 7.8z"/>',
};
const svg = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const HINTS = [['CLICK', 'WALK'], ['WASD', 'MOVE'], ['SHIFT', 'RUN'], ['SPACE', 'JUMP'], ['E', 'USE'], ['V', 'CAMERA'], ['T', 'CHAT'], ['Q', 'SPEAKER'], ['Y', 'MUSIC'], ['L', 'MAKE IT RAIN'], ['J', 'GAMES'], ['B', 'WAVE'], ['H', 'SLICK BACK'], ['K', 'WEATHER'], ['R', 'RE-CREATE'], ['C', 'WATCH'], ['P', 'PHOTO'], ['F', 'FPS'], ['G', 'GRAPHICS'], ['M', 'MENU']];

export function themeToggle(cls = '') {
  const seg = document.createElement('div'); seg.className = 'theme-seg ' + cls; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Theme');
  seg.innerHTML = `<button type="button" data-theme="light" title="Light" aria-label="Light theme">${svg('sun', 16)}</button><button type="button" data-theme="dark" title="Dark" aria-label="Dark theme">${svg('moon', 16)}</button>`;
  const pill = slidePill(seg, 'button');
  const sync = () => { const t = settings.get().theme; for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.theme === t)); pill?.update(); };
  seg.addEventListener('click', (e) => { const b = e.target.closest('[data-theme]'); if (b) { settings.set({ theme: b.dataset.theme }); b.blur(); } });
  seg.addEventListener('pointerdown', (e) => e.stopPropagation());
  settings.onChange(sync); sync();
  return seg;
}
export function applyTheme() { document.documentElement.classList.toggle('theme-light', settings.get().theme === 'light'); }
settings.onChange(applyTheme); applyTheme();

export function createHud({ quality, mp, menu, params }) {
  const bar = document.createElement('div'); bar.id = 'topbar';
  bar.innerHTML = `<div class="tb-chips" id="tb-chips"></div><div class="tb-btns" id="tb-btns"></div>`;
  document.body.appendChild(bar);
  bar.addEventListener('pointerdown', (e) => e.stopPropagation()); bar.addEventListener('click', (e) => e.stopPropagation());
  const chips = bar.querySelector('#tb-chips'), btns = bar.querySelector('#tb-btns');
  const mk = (key) => { const c = document.createElement('span'); c.className = 'chip'; c.dataset.k = key; const k = document.createElement('i'); k.textContent = key + '::'; const v = document.createElement('b'); c.append(k, v); chips.appendChild(c); return { el: c, v }; };
  /* calm HUD: ONE status chip (time · weather); FPS / LISTENING only appear when on. Online count = badge on the
     People button; SOLO / LOBBY code live in the People popover (#mp-card); the room name is a short toast. */
  const stat = document.createElement('span'); stat.className = 'chip tb-status'; stat.dataset.k = 'TIME';
  stat.innerHTML = '<b class="t"></b><i class="sep">\u00a0\u00b7\u00a0</i><b class="w"></b>'; chips.appendChild(stat);
  const C = { time: { el: stat, v: stat.querySelector('.t') }, weather: { el: stat, v: stat.querySelector('.w'), sep: stat.querySelector('.sep') }, fps: mk('FPS'), listen: mk('LISTENING') };
  C.listen.el.classList.add('accent'); C.listen.v.classList.add('tb-marquee');
  const add = (k, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = svg(k); b.addEventListener('click', () => { fn(); b.blur(); }); btns.appendChild(b); return b; };
  add('games', 'Games', () => window.__games?.togglePanel?.()).dataset.k = 'games'; /* src/games: hub panel (also J) */
  add('chat', 'Chat (T)', () => mp?.ui?.openChat?.());
  /* People: toggles the lobby popover (#mp-card: SOLO / lobby name + code, players, invite link, avatar, leave) */
  const card = () => document.getElementById('mp-card');
  const people = add('people', 'People', () => setPeople(!card()?.classList.contains('open'))); people.dataset.k = 'people'; people.setAttribute('aria-expanded', 'false');
  const badge = document.createElement('span'); badge.className = 'tb-badge'; badge.hidden = true; people.appendChild(badge);
  function setPeople(on) { const c = card(); if (!c) return; on = !!on; if (c.classList.contains('open') === on) return; c.classList.toggle('open', on); people.setAttribute('aria-expanded', String(on)); people.classList.toggle('on', on); wakeHud(); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && card()?.classList.contains('open')) { setPeople(false); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  addEventListener('pointerdown', (e) => { const c = card(); if (c?.classList.contains('open') && !c.contains(e.target) && !people.contains(e.target)) setPeople(false); }, true);
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) setPeople(false); });
  add('settings', 'Settings', () => menu?.openSettings?.());
  add('menu', 'Menu (M)', () => menu?.showPause?.(true));
  /* the theme toggle lives in Settings (menu.js gs-theme), not in the bar */

  /* auto-fade: walking (pointer locked) with nothing open -> after 3 s the bar + status chip drop to ~20% (CSS
     body.hud-calm). Wakes on unlock / Esc / any toast or notification / hover. Never touches prompts, crosshair,
     chat or game info. */
  const B0 = document.body; let wakeAt = performance.now();
  function wakeHud() { wakeAt = performance.now(); if (B0.classList.contains('hud-calm')) B0.classList.remove('hud-calm'); }
  function calmTick() {
    const b = B0.classList;
    const open = b.contains('ui-open') || b.contains('paused') || b.contains('menu-open') || b.contains('photo') || !!document.querySelector('#mp-card.open, #pg-panel.on, #pg-end.on, #pg-lobby.on, #mp-chat.open');
    const want = b.contains('locked') && !open && performance.now() - wakeAt > 3000;
    if (b.contains('hud-calm') !== want) b.toggle('hud-calm', want);
  }
  document.addEventListener('pointerlockchange', wakeHud);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') wakeHud(); });
  const toastMo = new MutationObserver(wakeHud); const toastWatched = new WeakSet();
  const watchToasts = () => {
    for (const [id, o] of [['mp-toasts', { childList: true }], ['presence', { attributes: true, attributeFilter: ['class'] }], ['pg-toast', { attributes: true, attributeFilter: ['class'] }], ['mp-log', { childList: true }]]) {
      const el = document.getElementById(id); if (el && !toastWatched.has(el)) { toastWatched.add(el); toastMo.observe(el, o); }
    }
  };

  /* room toast: the room name slides in under the status chip when you settle in a new room (0.6 s debounce,
     holds ~1.8 s); doorway flicker never toasts */
  const rt = document.createElement('div'); rt.id = 'room-toast'; rt.className = 'chip'; rt.setAttribute('role', 'status');
  rt.innerHTML = '<i>ROOM::</i><b></b>'; document.body.appendChild(rt);
  let rtSeen = '', rtSince = 0, rtShown = '', rtT = 0;
  function roomTick(room) {
    const now = performance.now();
    if (room !== rtSeen) { rtSeen = room; rtSince = now; return; }
    if (!room || room === rtShown || now - rtSince < 600) return;
    rtShown = room; rt.lastChild.textContent = room; rt.classList.add('on'); clearTimeout(rtT); rtT = setTimeout(() => rt.classList.remove('on'), 1800 + 250);
  }

  // bottom key hints (replaces the #help sentence)
  const help = document.getElementById('help');
  /* calm HUD: the 5 core chips show until ~8 s after you first enter walk mode (pointer lock, or first touch), then the
     row collapses to one "/::KEYS" chip; `/` (or a click on it) toggles the full list */
  if (help) {
    help.textContent = ''; help.classList.add('keys', 'intro');
    const chip = (k, v, cls) => { const c = document.createElement('span'); c.className = 'chip' + (cls ? ' ' + cls : ''); const a = document.createElement('i'); a.textContent = k + '::'; const b = document.createElement('b'); b.textContent = v; c.append(a, b); help.appendChild(c); return c; };
    const CORE = new Set(['CLICK', 'WASD', 'E', 'J', 'K']);
    for (const [k, v] of HINTS) chip(k, v, CORE.has(k) ? 'core' : 'more');
    const more = chip('/', 'KEYS', 'keys-toggle'); more.title = 'All keys (/)';
    const toggle = () => { const on = help.classList.toggle('all'); more.lastChild.textContent = on ? 'LESS' : 'KEYS'; if (on) help.classList.remove('intro'); wakeHud(); };
    more.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); toggle(); });
    addEventListener('keydown', (e) => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; if (e.code === 'Slash' && !e.repeat) toggle(); });
    let introT = 0; const endIntro = () => { if (!introT) introT = setTimeout(() => help.classList.remove('intro'), 8000); };
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) endIntro(); });
    addEventListener('touchstart', endIntro, { passive: true, once: true });
  }

  // FPS: F toggles the chip, G cycles quality (chip briefly shows GFX::<tier>)
  let fpsOn = !!params.get('fps') || settings.get().fps; let gfxUntil = 0;
  settings.onChange((s) => { fpsOn = !!s.fps || !!params.get('fps'); tick(); });
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyF' && !e.repeat) { settings.set({ fps: !fpsOn }); }
    if (e.code === 'KeyG' && !e.repeat) { quality.cycle(); gfxUntil = performance.now() + 1500; tick(); }
  });

  // Re-create countdown digits roll like a counter (recreate.js writes textContent; we re-render it)
  const cd = document.getElementById('rc-count');
  if (cd) new MutationObserver(() => { const t = cd.textContent; if (t !== (cd.dataset.roll ?? '')) rollText(cd, t); }).observe(cd, { childList: true, characterData: true, subtree: false });

  const where = document.getElementById('where');
  const show = (c, on) => { if (c.el.hidden === on) c.el.hidden = !on; };
  function tick() {
    // in-game time + weather from the day/night system (src/sky); real clock when it is off (?sky=0)
    const sky = window.__sky;
    /* polish5: the clock changes every few seconds of game time — a digit roll was caught half-way in most frames ("23:0₈"); plain text */
    { const ts = sky ? String(sky.clock) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase(); if (C.time.v.textContent !== ts) { C.time.v.classList.remove('roll'); C.time.v.textContent = ts; } }
    C.weather.v.hidden = C.weather.sep.hidden = !sky; if (sky) { const w = String(sky.weather).toUpperCase(); if (C.weather.v.textContent !== w) C.weather.v.textContent = w; }
    show(C.fps, fpsOn || performance.now() < gfxUntil);
    if (performance.now() < gfxUntil) { C.fps.el.firstChild.textContent = 'GFX::'; rollText(C.fps.v, (quality.auto ? 'AUTO ' : '') + String(quality.name || quality.tier.name).toUpperCase()); }
    else if (fpsOn) { C.fps.el.firstChild.textContent = 'FPS::'; rollText(C.fps.v, quality.fps + ' RES::' + Math.round(100 * quality.pixelRatio / (devicePixelRatio || 1)) + '%'); }
    const on = !!mp?.connected; const n = on ? String(mp.members.size + 1) : '';
    if (badge.hidden === on) badge.hidden = !on; if (on && badge.textContent !== n) badge.textContent = n;
    { const tt = on ? `People (${n} online)` : 'People (solo)'; if (people.title !== tt) { people.title = tt; people.setAttribute('aria-label', tt); } }
    roomTick((where?.textContent || '').toUpperCase());
    watchToasts(); calmTick();
    const sp = window.__speaker || window.__mp?.speaker; const m = sp?.music;
    const t = m && m.vid && m.playing && !m.error ? (m.title || 'LOADING…') : '';
    show(C.listen, !!t); if (t) { const s = t.length > 48 ? t.slice(0, 47) + '…' : t; if (C.listen.v.textContent !== s) C.listen.v.textContent = s; }
  }
  setInterval(tick, 250); tick();

  // polish pass — ONE prompt slot: the E interact chip (#ix-prompt), Watch (#vs.near), the Re-create take button (#rc,
  // not seated) and the speaker NEARBY pill (#spk-pill) never stack: interact > watch > re-create > speaker. Watch and
  // Re-create also hide while in a game, driving, holding a prop / the speaker, or in photo mode. Body classes only;
  // driven by MutationObservers on those elements + the 4 Hz tick (no per-frame work).
  const B = document.body; const watched = new WeakSet();
  const $id = (id) => document.getElementById(id);
  const arbitrate = () => {
    const ix = $id('ix-prompt'), vs = $id('vs'), rc = $id('rc'), take = $id('rc-take'), sp = $id('spk-pill');
    for (const el of [ix, vs, rc, take, sp]) if (el && !watched.has(el)) { watched.add(el); mo.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] }); }
    const g = window.__games, held = !!window.__smash?.hands?.heldItem || $id('spk')?.dataset.state === 'held';
    const busy = B.classList.contains('driving') || B.classList.contains('photo') || held || !!(g && g.in && g.phase !== 'idle');
    const ixOn = !!ix?.classList.contains('on'), vsNear = !!vs?.classList.contains('near') && !vs.classList.contains('on');
    const rcTake = !!rc?.classList.contains('show') && !!take && !take.hidden, spOn = !!sp?.classList.contains('on');
    const hideVs = vsNear && (ixOn || busy), showVs = vsNear && !hideVs;
    const hideRc = rcTake && (ixOn || showVs || busy), showRc = rcTake && !hideRc;
    const hideSp = spOn && (ixOn || showVs || showRc);
    if (B.classList.contains('pr-hide-vs') !== hideVs) B.classList.toggle('pr-hide-vs', hideVs);
    if (B.classList.contains('pr-hide-rc') !== hideRc) B.classList.toggle('pr-hide-rc', hideRc);
    if (B.classList.contains('pr-hide-sp') !== hideSp) B.classList.toggle('pr-hide-sp', hideSp);
  };
  const mo = new MutationObserver(arbitrate);
  setInterval(arbitrate, 250); arbitrate();

  // mono status line (path-trace progress etc.): main.js status() writes here once loading is done
  const st = document.createElement('div'); st.id = 'hud-status'; st.className = 'chip'; st.hidden = true; document.body.appendChild(st);
  let lastSt = null;
  return { setStatus(text) { if (text === lastSt) return; lastSt = text; st.hidden = !text; st.textContent = ''; if (text) { const i = document.createElement('i'); i.textContent = 'STATUS::'; const b = document.createElement('b'); b.textContent = String(text).toUpperCase(); st.append(i, b); } }, get fpsOn() { return fpsOn; } };
}
