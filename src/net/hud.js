// In-game HUD (docs/UI_STYLE.md): top mono chip row (TIME / FPS / ONLINE / LOBBY / ROOM / LISTENING), square
// icon buttons top-right (games, chat, avatar, settings, menu) + the sun/moon theme toggle, bottom key-hint row, a mono
// status line (path tracing) and rolling Re-create countdown digits. Chips refresh 4×/s from a timer: nothing
// per frame. F toggles FPS, G cycles graphics quality.
import { settings } from './settings.js';
import { rollText, slidePill } from './motion.js';

const ICON = {
  games: '<path d="M6.2 6.5h7.6a3.4 3.4 0 0 1 3.3 2.7l.8 4.1a2 2 0 0 1-3.4 1.7l-1.9-2h-5.2l-1.9 2a2 2 0 0 1-3.4-1.7l.8-4.1a3.4 3.4 0 0 1 3.3-2.7z"/><path d="M6.5 9v2.4M5.3 10.2h2.4"/><circle cx="13.2" cy="9.6" r=".5"/><circle cx="14.6" cy="11" r=".5"/>',
  chat: '<path d="M3.5 4.5h13v8.5h-7l-3.5 3v-3h-2.5z"/>',
  avatar: '<circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6"/>',
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
  const C = { time: mk('TIME'), weather: mk('WEATHER'), fps: mk('FPS'), online: mk('ONLINE'), lobby: mk('LOBBY'), room: mk('ROOM'), listen: mk('LISTENING') };
  C.listen.el.classList.add('accent'); C.listen.v.classList.add('tb-marquee');
  const add = (k, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = svg(k); b.addEventListener('click', () => { fn(); b.blur(); }); btns.appendChild(b); return b; };
  add('games', 'Games', () => window.__games?.togglePanel?.()).dataset.k = 'games'; // src/games: hub panel (also J)
  add('chat', 'Chat (T)', () => mp?.ui?.openChat?.());
  add('avatar', 'Avatar', () => menu?.hooks?.openAvatarPanel?.());
  add('settings', 'Settings', () => menu?.openSettings?.());
  add('menu', 'Menu (M)', () => menu?.showPause?.(true));
  btns.prepend(themeToggle('tb-theme'));

  // bottom key hints (replaces the #help sentence)
  const help = document.getElementById('help');
  if (help) { help.textContent = ''; help.classList.add('keys'); for (const [k, v] of HINTS) { const c = document.createElement('span'); c.className = 'chip'; const a = document.createElement('i'); a.textContent = k + '::'; const b = document.createElement('b'); b.textContent = v; c.append(a, b); help.appendChild(c); } }

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
    if (sky) rollText(C.time.v, sky.clock); else { const d = new Date(); rollText(C.time.v, d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()); }
    show(C.weather, !!sky); if (sky) rollText(C.weather.v, String(sky.weather).toUpperCase());
    show(C.fps, fpsOn || performance.now() < gfxUntil);
    if (performance.now() < gfxUntil) { C.fps.el.firstChild.textContent = 'GFX::'; rollText(C.fps.v, (quality.auto ? 'AUTO ' : '') + String(quality.name || quality.tier.name).toUpperCase()); }
    else if (fpsOn) { C.fps.el.firstChild.textContent = 'FPS::'; rollText(C.fps.v, quality.fps + ' RES::' + Math.round(100 * quality.pixelRatio / (devicePixelRatio || 1)) + '%'); }
    const on = !!mp?.connected;
    rollText(C.online.v, String(on ? mp.members.size + 1 : 1));
    C.lobby.el.firstChild.textContent = on ? 'LOBBY::' : ''; rollText(C.lobby.v, on ? String(mp.room).toUpperCase() : 'SOLO');
    const room = (where?.textContent || '').toUpperCase(); show(C.room, !!room); if (room) rollText(C.room.v, room);
    const sp = window.__speaker || window.__mp?.speaker; const m = sp?.music;
    const t = m && m.vid && m.playing && !m.error ? (m.title || 'LOADING…') : '';
    show(C.listen, !!t); if (t) { const s = t.length > 48 ? t.slice(0, 47) + '…' : t; if (C.listen.v.textContent !== s) C.listen.v.textContent = s; }
  }
  setInterval(tick, 250); tick();

  // mono status line (path-trace progress etc.): main.js status() writes here once loading is done
  const st = document.createElement('div'); st.id = 'hud-status'; st.className = 'chip'; st.hidden = true; document.body.appendChild(st);
  let lastSt = null;
  return { setStatus(text) { if (text === lastSt) return; lastSt = text; st.hidden = !text; st.textContent = ''; if (text) { const i = document.createElement('i'); i.textContent = 'STATUS::'; const b = document.createElement('b'); b.textContent = String(text).toUpperCase(); st.append(i, b); } }, get fpsOn() { return fpsOn; } };
}
