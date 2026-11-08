// Party games UI (docs/UI_STYLE.md): dark #1e1e1e / #262626 surfaces, 6px radius, mono KEY::VALUE chips,
// yellow #f2c84b accent, ease-out-expo rise/sink, per-character rolling numbers (rollText from src/net/motion.js).
// Pieces: hub panel (J), invite card (bottom), 3-2-1 countdown, top-centre HUD chip row + leaderboard,
// seeker blackout overlay, end-screen scoreboard, small toast, floating "+$5,000" texts.
import { rollText } from '../net/motion.js';

const CSS = `
#pg { --eo: cubic-bezier(0.16,1,0.3,1); --es: cubic-bezier(0.5,1,0.89,1); --bg: #1e1e1e; --surf: #262626; --chip: #2f2f2f;
  --tx: #f7f7f7; --tx2: rgba(247,247,247,.66); --tx3: rgba(247,247,247,.32); --hair: 1px solid rgba(247,247,247,.06); --acc: #f2c84b;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  font: 400 13px/1.4 "Geist", -apple-system, Inter, system-ui, sans-serif; letter-spacing: -0.02em; color: var(--tx); }
#pg .k, #pg .v, #pg .acc, #pg kbd, #pg .mono { font: 600 11px/1.3 var(--mono); letter-spacing: -0.4px; text-transform: uppercase; }
#pg .k { color: var(--tx3); } #pg .v { color: var(--tx2); } #pg .acc { color: var(--acc); }
#pg kbd { display: inline-block; padding: 1px 5px; border-radius: 2px; background: var(--chip); border: var(--hair); color: var(--tx); }
#pg button { font: 500 16px/1.3 inherit; font-family: inherit; letter-spacing: -0.02em; color: var(--tx); background: var(--surf); border: var(--hair);
  border-radius: 6px; padding: 4px 10px; cursor: pointer; transition: background .25s var(--es), transform .2s var(--es), opacity .2s var(--es); }
#pg button:hover { background: #2f2f2f; } #pg button:active { transform: scale(.97); }
#pg button:disabled { opacity: .35; cursor: default; } #pg button:disabled:hover { background: var(--surf); }
#pg button.pri { background: var(--tx); color: #1e1e1e; } #pg button.pri:hover { background: #e9e9e9; }
#pg button.pri:disabled:hover { background: var(--tx); }
#pg .ghost { background: transparent; border-color: transparent; padding: 6px; line-height: 0; color: var(--tx2); }
.pg-chip { display: inline-flex; align-items: center; gap: 0; padding: 4px 6px; border-radius: 2px; background: var(--surf); border: var(--hair);
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); white-space: nowrap; }
.pg-chip.alt { background: var(--chip); box-shadow: none; }
.pg-chip.role .v { color: var(--acc); }
/* stage rise / sink */
.pg-stage { opacity: 0; transform: translateY(6%) scale(.96); pointer-events: none; visibility: hidden;
  transition: opacity .3s var(--es), transform .5s var(--eo), visibility 0s linear .5s; }
.pg-stage.on { opacity: 1; transform: none; pointer-events: auto; visibility: visible; transition: opacity .3s var(--es), transform .5s var(--eo), visibility 0s; }
.pg-stage.out { opacity: 0; transform: translateY(4%) scale(.97); }
/* hub panel */
#pg-panel { position: fixed; left: 50%; top: 50%; width: min(760px, calc(100vw - 32px)); margin-left: calc(min(760px, calc(100vw - 32px)) / -2);
  translate: 0 -50%; z-index: 60; background: var(--bg); border: var(--hair); border-radius: 6px; padding: 18px;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 30px 80px rgba(0,0,0,.45); box-sizing: border-box; overflow: hidden; }
#pg-panel::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .06; background-image: var(--pg-grain); }
.pg-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.pg-h1 { font-size: 34px; font-weight: 500; letter-spacing: -0.055em; line-height: 1; }
.pg-sub { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
.pg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pg-card { position: relative; background: var(--surf); border: var(--hair); border-radius: 6px; padding: 14px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2);
  display: flex; flex-direction: column; gap: 8px; transition: background .25s var(--es), transform .4s var(--eo); }
.pg-card:hover { background: #2a2a2a; transform: translateY(-2px); }
.pg-card .t { display: flex; align-items: center; gap: 10px; }
.pg-card .num { color: var(--tx3); }
.pg-card h3 { margin: 0; font-size: 21px; font-weight: 500; letter-spacing: -0.045em; line-height: 1.1; }
.pg-card p { margin: 0; color: var(--tx2); font-size: 13px; min-height: 36px; }
.pg-card .row { display: flex; align-items: center; gap: 6px; margin-top: auto; }
.pg-card .row button { margin-left: auto; }
.pg-ico { width: 34px; height: 34px; border-radius: 6px; background: var(--chip); border: var(--hair); display: grid; place-items: center; color: var(--acc); flex: none; }
.pg-foot { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--tx3); }
/* invite card (bottom presence card) */
#pg-invite { position: fixed; left: 50%; bottom: 74px; width: min(520px, calc(100vw - 32px)); margin-left: calc(min(520px, calc(100vw - 32px)) / -2); z-index: 55;
  background: var(--surf); border: var(--hair); border-radius: 6px; padding: 12px 14px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 18px 40px rgba(0,0,0,.35);
  display: flex; align-items: center; gap: 12px; box-sizing: border-box; }
#pg-invite.pg-stage { transform: translateY(18px); } #pg-invite.pg-stage.on { transform: none; }
.pg-dot { width: 8px; height: 8px; border-radius: 50%; background: #3ddc84; flex: none; animation: pg-pulse 2s infinite; }
@keyframes pg-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
.pg-inv-main { flex: 1; min-width: 0; }
.pg-inv-title { font-weight: 500; font-size: 15px; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-inv-title b { font-weight: 600; }
/* countdown */
#pg-count { position: fixed; left: 0; right: 0; top: 34%; text-align: center; z-index: 56; pointer-events: none; font: 500 132px/1 "Geist", -apple-system, Inter, sans-serif;
  letter-spacing: -0.06em; color: var(--tx); text-shadow: 0 4px 40px rgba(0,0,0,.45); }
#pg-count .roll-c { line-height: 1; }
#pg-count .cap { display: block; margin-top: 10px; font: 600 11px/1 var(--mono); letter-spacing: -0.4px; color: var(--tx2); text-transform: uppercase; text-shadow: none; }
/* HUD chips (below the top bar) */
#pg-hud { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
#pg-hud.pg-stage { transform: translate(-50%, -6px); } #pg-hud.pg-stage.on { transform: translate(-50%, 0); }
.pg-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pg-chips .pg-chip { animation: pg-badge .4s var(--eo) both; }
@keyframes pg-badge { from { opacity: 0; transform: translate(-8px, 12px) } to { opacity: 1; transform: none } }
.pg-board { display: flex; flex-direction: column; gap: 2px; min-width: 210px; background: rgba(30,30,30,.82); border: var(--hair); border-radius: 6px; padding: 6px 8px; }
.pg-board:empty { display: none; }
.pg-brow { display: flex; gap: 8px; align-items: baseline; }
.pg-brow .r { width: 14px; color: var(--tx3); } .pg-brow .n { flex: 1; color: var(--tx2); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-brow.me .n { color: var(--acc); } .pg-brow .s { color: var(--tx); text-align: right; }
/* blackout (seeker while hiders hide) */
#pg-dark { position: fixed; inset: 0; z-index: 50; background: rgba(8,8,8,.985); display: grid; place-items: center; text-align: center; pointer-events: none; }
#pg-dark.pg-stage { transform: none; }
#pg-dark .big { font-size: 46px; font-weight: 500; letter-spacing: -0.055em; line-height: 1.05; }
#pg-dark .t { font: 500 88px/1 "Geist", -apple-system, sans-serif; letter-spacing: -0.06em; margin-top: 14px; }
/* end screen */
#pg-end { position: fixed; left: 50%; top: 50%; width: min(460px, calc(100vw - 32px)); margin-left: calc(min(460px, calc(100vw - 32px)) / -2); translate: 0 -50%;
  z-index: 58; background: var(--bg); border: var(--hair); border-radius: 6px; padding: 18px; box-sizing: border-box;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 30px 80px rgba(0,0,0,.45); }
.pg-end-win { font-size: 38px; font-weight: 500; letter-spacing: -0.06em; line-height: 1.05; margin: 8px 0 14px; }
.pg-end-win .roll-c { line-height: 1.05; }
.pg-rows { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow: auto; }
.pg-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; background: var(--surf); border: var(--hair); border-radius: 6px; animation: pg-badge .45s var(--eo) both; }
.pg-row .rk { width: 18px; color: var(--tx3); } .pg-row .nm { flex: 1; font-size: 15px; letter-spacing: -0.03em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-row.win { border-color: rgba(242,200,75,.35); } .pg-row.win .nm { color: var(--acc); }
.pg-row .sc { color: var(--tx); }
.pg-end-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
/* toast */
#pg-toast { position: fixed; left: 50%; bottom: 150px; transform: translate(-50%, 10px); z-index: 57; pointer-events: none; opacity: 0;
  padding: 7px 12px; border-radius: 6px; background: var(--surf); border: var(--hair); box-shadow: 0 2px 6px -2px rgba(0,0,0,.2);
  transition: opacity .2s var(--es), transform .4s var(--eo); white-space: nowrap; }
#pg-toast.on { opacity: 1; transform: translate(-50%, 0); }
/* floating "+$5,000" */
.pg-float { position: fixed; left: 0; top: 0; z-index: 40; pointer-events: none; font: 600 15px/1 var(--mono); letter-spacing: -0.4px; color: #f7f7f7;
  text-shadow: 0 2px 10px rgba(0,0,0,.55); white-space: nowrap; will-change: transform, opacity; }
.pg-float.me { color: var(--acc); font-size: 20px; }
body.watching #pg-hud { display: none; }
@media (prefers-reduced-motion: reduce) { .pg-stage, .pg-stage.on { transform: none !important; } .pg-chips .pg-chip, .pg-row { animation: none; } .pg-dot { animation: none; } }
`;

function grainURL() {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); const d = g.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return `url(${c.toDataURL()})`;
}

const ICONS = {
  cash: '<rect x="2.5" y="5.5" width="15" height="9" rx="1"/><circle cx="10" cy="10" r="2.2"/><path d="M5 8v4M15 8v4"/>',
  hide: '<path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2"/><path d="M3.5 16.5l13-13"/>',
  tag: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.5"/>',
  chairs: '<path d="M6 3.5v13M14 3.5v13M6 9.5h8M6 12.5h8M6 3.5h8"/>',
};
export const icon = (k) => `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const chip = (k, v, cls = '') => `<span class="pg-chip ${cls}"><span class="k">${esc(k)}::</span><span class="v">${esc(v)}</span></span>`;

export function buildUI() {
  if (!document.getElementById('pg-css')) { const s = document.createElement('style'); s.id = 'pg-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.id = 'pg';
  root.style.setProperty('--pg-grain', grainURL());
  root.innerHTML = `
    <div id="pg-panel" class="pg-stage" role="dialog" aria-label="Party games">
      <div class="pg-head"><div><div class="pg-h1" id="pg-h1">Party games</div><div class="pg-sub" id="pg-sub"></div></div>
        <button type="button" class="ghost" id="pg-x" title="Close (J / Esc)" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
      <div class="pg-grid" id="pg-grid"></div>
      <div class="pg-foot"><span id="pg-note" class="mono"></span><span class="mono"><kbd>J</kbd> <span class="k">CLOSE</span></span></div>
    </div>
    <div id="pg-invite" class="pg-stage" role="status"><span class="pg-dot"></span><div class="pg-inv-main"><div class="pg-inv-title" id="pg-inv-title"></div><div class="mono" id="pg-inv-sub"></div></div><button type="button" id="pg-inv-btn"></button></div>
    <div id="pg-count" class="pg-stage"><span id="pg-count-n"></span><span class="cap" id="pg-count-cap"></span></div>
    <div id="pg-hud" class="pg-stage"><div class="pg-chips" id="pg-chips"></div><div class="pg-board mono" id="pg-board"></div></div>
    <div id="pg-dark" class="pg-stage"><div><div class="mono"><span class="k">ROLE::</span><span class="acc">SEEKER</span></div><div class="big" id="pg-dark-msg"></div><div class="t" id="pg-dark-t"></div></div></div>
    <div id="pg-end" class="pg-stage" role="dialog" aria-label="Results">
      <div class="mono" id="pg-end-game"></div>
      <div class="pg-end-win" id="pg-end-win"></div>
      <div class="pg-rows" id="pg-rows"></div>
      <div class="pg-end-foot"><span id="pg-end-worth"></span><button type="button" id="pg-end-x">Close <kbd>J</kbd></button></div>
    </div>
    <div id="pg-toast" class="mono"></div>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  // nothing clicked or typed in the games UI reaches the game's own key / pointer handlers
  for (const id of ['pg-panel', 'pg-invite', 'pg-end']) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => e.stopPropagation());
  }
  const els = {
    root, panel: $('pg-panel'), grid: $('pg-grid'), sub: $('pg-sub'), note: $('pg-note'), x: $('pg-x'),
    invite: $('pg-invite'), invTitle: $('pg-inv-title'), invSub: $('pg-inv-sub'), invBtn: $('pg-inv-btn'),
    count: $('pg-count'), countN: $('pg-count-n'), countCap: $('pg-count-cap'),
    hud: $('pg-hud'), chips: $('pg-chips'), board: $('pg-board'),
    dark: $('pg-dark'), darkMsg: $('pg-dark-msg'), darkT: $('pg-dark-t'),
    end: $('pg-end'), endGame: $('pg-end-game'), endWin: $('pg-end-win'), rows: $('pg-rows'), worth: $('pg-end-worth'), endX: $('pg-end-x'),
    toast: $('pg-toast'),
  };
  const show = (el, on) => { if (el.classList.contains('on') === !!on) return; el.classList.toggle('on', !!on); };
  const setHtml = (el, h) => { if (el.__h !== h) { el.__h = h; el.innerHTML = h; } };
  let toastT = 0;
  function toast(text, ms = 2200) { els.toast.textContent = text; show(els.toast, true); clearTimeout(toastT); toastT = setTimeout(() => show(els.toast, false), ms); }
  return { els, show, setHtml, toast, roll: rollText };
}

// floating world-space texts (DOM, projected each frame)
export function createFloats(camera, THREE) {
  const list = []; const v = new THREE.Vector3();
  function add(pos, text, me) {
    const el = document.createElement('div'); el.className = 'pg-float' + (me ? ' me' : ''); el.textContent = text; document.body.appendChild(el);
    list.push({ el, p: new THREE.Vector3(pos.x, pos.y + 0.9, pos.z), t: 0 });
  }
  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]; f.t += dt; const k = f.t / 1.4;
      if (k >= 1) { f.el.remove(); list.splice(i, 1); continue; }
      v.copy(f.p); v.y += k * 0.9; v.project(camera);
      if (v.z > 1) { f.el.style.opacity = '0'; continue; }
      const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
      const e = 1 - Math.pow(1 - Math.min(1, f.t / 0.35), 3);
      f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.7 + 0.3 * e).toFixed(3)})`;
      f.el.style.opacity = String(Math.min(1, (1 - k) * 2.2));
    }
  }
  function clear() { for (const f of list) f.el.remove(); list.length = 0; }
  return { add, update, clear };
}
