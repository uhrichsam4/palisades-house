// Party games UI (docs/UI_STYLE.md): dark #1e1e1e / #262626 surfaces, 6px radius, mono KEY::VALUE chips,
// yellow #f2c84b accent, ease-out-expo rise/sink, per-character rolling numbers (rollText from src/net/motion.js).
// Pieces: hub panel (J / HUD controller button), ready-up lobby (full-width bottom panel), invite card (bottom), teleport veil, 3-2-1 countdown, top-centre HUD chip row + leaderboard,
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
/* polish5: the games panel covers the lobby card (its Leave button) and the bottom-left key hints at 1280x800: fade them while it is open */
#mp-card, #help.keys { transition: opacity .25s var(--es, ease-out); }
body:has(#pg-panel.on) #mp-card, body:has(#pg-panel.on) #help.keys { opacity: 0 !important; pointer-events: none !important; }
/* stage rise / sink */
.pg-stage { opacity: 0; transform: translateY(6%) scale(.96); pointer-events: none; visibility: hidden;
  transition: opacity .3s var(--es), transform .5s var(--eo), visibility 0s linear .5s; }
.pg-stage.on { opacity: 1; transform: none; pointer-events: auto; visibility: visible; transition: opacity .3s var(--es), transform .5s var(--eo), visibility 0s; }
.pg-stage.out { opacity: 0; transform: translateY(4%) scale(.97); }
/* hub panel */
#pg-panel { position: fixed; left: 50%; top: 50%; width: min(760px, calc(100vw - 32px)); margin-left: calc(min(760px, calc(100vw - 32px)) / -2);
  translate: 0 -50%; z-index: 60; background: var(--bg); border: var(--hair); border-radius: 6px; padding: 18px;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 30px 80px rgba(0,0,0,.45); box-sizing: border-box; max-height: calc(100vh - 32px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; } /* 10+ games: scroll instead of clipping */
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
#pg-hud { position: fixed; left: 50%; top: 22px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
#pg-hud.pg-stage { transform: translate(-50%, -6px); } #pg-hud.pg-stage.on { transform: translate(-50%, 0); }
.pg-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pg-chips .pg-chip { animation: pg-badge .4s var(--eo) both; }
@keyframes pg-badge { from { opacity: 0; transform: translate(-8px, 12px) } to { opacity: 1; transform: none } }
.pg-board { display: flex; flex-direction: column; gap: 2px; min-width: 210px; background: rgba(30,30,30,.82); border: var(--hair); border-radius: 6px; padding: 6px 8px; }
.pg-board:empty, .pg-board:not(.show) { display: none; }
/* calm HUD: one strip (title · time · game keys); scoreboard only on Tab / last 10 s (src/games/index.js render) */
.pg-strip { gap: 6px; padding: 5px 9px; } .pg-chips .pg-strip { animation: none; } /* text updates every second: don't replay the pop-in */
.pg-strip .pg-time { color: var(--tx); font-variant-numeric: tabular-nums; margin-left: 4px; }
.pg-strip .pg-sep { margin: 0 2px; }
#pg-hud .pg-board.show { animation: pg-badge .35s var(--eo) both; }
@media (max-width: 600px) { #pg-hud { top: 60px; max-width: calc(100vw - 20px); } .pg-strip { white-space: normal; flex-wrap: wrap; justify-content: center; } }
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
/* ---- games hub: registry cards (3 columns), LIVE badge */
#pg-panel { width: min(940px, calc(100vw - 32px)); margin-left: calc(min(940px, calc(100vw - 32px)) / -2); }
.pg-grid { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 860px) { .pg-grid { grid-template-columns: 1fr 1fr; } }
/* polish: title + close stay pinned while the card grid scrolls (panel padding is 18px, so the sticky bar covers it) */
#pg-panel > .pg-head { position: sticky; top: -18px; z-index: 3; margin: -18px -18px 14px; padding: 18px 18px 12px; background: var(--bg);
  border-bottom: var(--hair); border-radius: 6px 6px 0 0; }
.pg-card .badge { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 2px; background: var(--chip); border: var(--hair);
  font: 600 10px/1 var(--mono); letter-spacing: -0.4px; color: var(--tx); animation: pg-badge .4s var(--eo) both; }
.pg-card .badge i { width: 6px; height: 6px; border-radius: 50%; background: #3ddc84; animation: pg-pulse 2s infinite; }
.pg-card .row { flex-wrap: wrap; }
.pg-ico svg { width: 18px; height: 18px; }
/* ---- ready-up lobby (full-width bottom panel, non-modal: you can keep walking) */
#pg-lobby { position: fixed; left: 16px; right: 16px; bottom: 64px; z-index: 55; background: var(--bg); border: var(--hair); border-radius: 6px; padding: 14px 16px;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 24px 60px rgba(0,0,0,.45); box-sizing: border-box; overflow: hidden; }
#pg-lobby::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .06; background-image: var(--pg-grain); }
.pg-lb-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.pg-lb-title { font-size: 26px; font-weight: 500; letter-spacing: -0.055em; line-height: 1; }
.pg-lb-title .roll-c { line-height: 1; }
.pg-lb-chips { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.pg-lb-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; } /* polish5: wider cards, HOST moved under the name: full names fit */
.pg-lc .pg-host { color: var(--acc); }
.pg-lc { background: var(--surf); border: var(--hair); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 9px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2);
  animation: pg-lc-in .5s var(--eo) both; transition: border-color .25s var(--es); }
@keyframes pg-lc-in { from { opacity: 0; transform: translateY(6%) scale(.96) } to { opacity: 1; transform: none } }
.pg-lc.ready { border-color: rgba(61,220,132,.28); }
.pg-lc.me .pg-lc-name { color: var(--acc); }
.pg-lc-top { display: flex; align-items: center; gap: 9px; min-width: 0; }
.pg-av { width: 30px; height: 30px; border-radius: 50%; flex: none; background: hsl(var(--h) 62% 58%); box-shadow: inset 0 -6px 10px rgba(0,0,0,.25), 0 0 0 1px rgba(247,247,247,.08);
  display: grid; place-items: center; font: 600 12px/1 var(--mono); color: #1e1e1e; }
.pg-lc-name { font-size: 15px; font-weight: 500; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-lc-top .who { min-width: 0; flex: 1; }
.pg-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 2px; border-radius: 6px; background: var(--chip); border: var(--hair); }
.pg-seg .pg-pill { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc(50% - 2px); border-radius: 4px; background: rgba(247,247,247,.08); box-shadow: 0 0 0 1px rgba(247,247,247,.04);
  transition: transform .4s var(--eo), background .25s var(--es); }
.pg-lc.ready .pg-seg .pg-pill { transform: translateX(100%); background: rgba(61,220,132,.16); }
.pg-seg span.o { position: relative; text-align: center; padding: 4px 0; font: 600 10px/1.2 var(--mono); letter-spacing: -0.4px; color: var(--tx3); transition: color .25s var(--es);
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.pg-lc:not(.ready) .pg-seg span.o.w { color: var(--tx); }
.pg-lc.ready .pg-seg span.o.r { color: #3ddc84; }
.pg-seg .chk { width: 11px; height: 11px; transform: scale(0); opacity: 0; transition: transform .45s cubic-bezier(.34,1.8,.5,1), opacity .2s var(--es); }
.pg-lc.ready .pg-seg .chk { transform: scale(1); opacity: 1; }
.pg-lb-foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.pg-lb-btns { margin-left: auto; display: flex; gap: 6px; }
#pg-lobby button.go { background: #3ddc84; color: #10241a; } #pg-lobby button.go:hover { background: #52e394; }
/* veil (teleport fade) */
#pg-veil { position: fixed; inset: 0; z-index: 70; background: #0b0b0b; opacity: 0; pointer-events: none; transition: opacity .26s var(--es), backdrop-filter .26s var(--es); }
#pg-veil.on { opacity: 1; }
body.watching #pg-lobby { display: none; }
@media (prefers-reduced-motion: reduce) { .pg-lc { animation: none; } .pg-seg .pg-pill, .pg-seg .chk { transition: none; } }
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
  pool: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.6"/><path d="M8.9 8.9h1.6l-1 2.4"/>',
  pingpong: '<circle cx="8" cy="8" r="5"/><path d="M11.5 11.5l4.5 4.5"/><circle cx="15.5" cy="5" r="1.4"/>',
  games: '<path d="M6.2 6.5h7.6a3.4 3.4 0 0 1 3.3 2.7l.8 4.1a2 2 0 0 1-3.4 1.7l-1.9-2h-5.2l-1.9 2a2 2 0 0 1-3.4-1.7l.8-4.1a3.4 3.4 0 0 1 3.3-2.7z"/><path d="M6.5 9v2.4M5.3 10.2h2.4"/><circle cx="13.2" cy="9.6" r=".5"/><circle cx="14.6" cy="11" r=".5"/>',
};
export const ICON_PATHS = ICONS;
export const icon = (k) => `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.games}</svg>`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const chip = (k, v, cls = '') => `<span class="pg-chip ${cls}"><span class="k">${esc(k)}::</span><span class="v">${esc(v)}</span></span>`;

export function buildUI() {
  if (!document.getElementById('pg-css')) { const s = document.createElement('style'); s.id = 'pg-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.id = 'pg';
  root.style.setProperty('--pg-grain', grainURL());
  root.innerHTML = `
    <div id="pg-panel" class="pg-stage" role="dialog" aria-label="Games">
      <div class="pg-head"><div><div class="pg-h1" id="pg-h1">Games</div><div class="pg-sub" id="pg-sub"></div></div>
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
    <div id="pg-lobby" class="pg-stage" role="dialog" aria-label="Ready up">
      <div class="pg-lb-head"><span class="pg-dot"></span><div><div class="mono" id="pg-lb-kicker"></div><div class="pg-lb-title" id="pg-lb-title"></div></div><div class="pg-lb-chips" id="pg-lb-chips"></div></div>
      <div class="pg-lb-cards" id="pg-lb-cards"></div>
      <div class="pg-lb-foot"><span class="mono" id="pg-lb-hint"></span><div class="pg-lb-btns"><button type="button" class="pri" id="pg-lb-ready">Ready <kbd>J</kbd></button><button type="button" id="pg-lb-leave">Leave</button><button type="button" id="pg-lb-start" class="go">Start now</button></div></div>
    </div>
    <div id="pg-veil"></div>
    <div id="pg-toast" class="mono"></div>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  // nothing clicked or typed in the games UI reaches the game's own key / pointer handlers
  for (const id of ['pg-panel', 'pg-invite', 'pg-end', 'pg-lobby']) {
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
    lobby: $('pg-lobby'), lbKicker: $('pg-lb-kicker'), lbTitle: $('pg-lb-title'), lbChips: $('pg-lb-chips'), lbCards: $('pg-lb-cards'), lbHint: $('pg-lb-hint'),
    lbReady: $('pg-lb-ready'), lbLeave: $('pg-lb-leave'), lbStart: $('pg-lb-start'), veil: $('pg-veil'),
  };
  const show = (el, on) => { if (el.classList.contains('on') === !!on) return; el.classList.toggle('on', !!on); };
  const setHtml = (el, h) => { if (el.__h !== h) { el.__h = h; el.innerHTML = h; } };
  let toastT = 0;
  function toast(text, ms = 2200) { els.toast.textContent = text; show(els.toast, true); clearTimeout(toastT); toastT = setTimeout(() => show(els.toast, false), ms); }
  // veil(on): full-screen fade used around teleports (0.26 s)
  const veil = (on) => els.veil.classList.toggle('on', !!on);
  return { els, show, setHtml, toast, roll: rollText, veil };
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
