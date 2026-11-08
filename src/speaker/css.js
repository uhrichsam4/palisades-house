// Speaker UI styles (docs/UI_STYLE.md: dark #1e1e1e/#262626, 6px radius, mono KEY::VALUE HUD, ease-out-expo), injected once.
const CSS = `
#spk { --ease-out-expo: cubic-bezier(0.16,1,0.3,1); --ease-soft: cubic-bezier(0.5,1,0.89,1);
  --bg: #1e1e1e; --surf: #262626; --chip: #2f2f2f; --tx: #f7f7f7; --tx2: rgba(247,247,247,.66); --tx3: rgba(247,247,247,.32);
  --hair: 1px solid rgba(247,247,247,.06); --acc: #f2c84b;
  font: 400 13px/1.4 "Geist", -apple-system, Inter, system-ui, sans-serif; letter-spacing: -0.02em; color: var(--tx); }
#spk .k, #spk .v, #spk .name, #spk kbd, .spk-hud { font: 600 11px/1.3 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: -0.4px; }
#spk .k { color: var(--tx3); } #spk .v { color: var(--tx2); } #spk .name { color: var(--acc); }
#spk kbd { display: inline-block; padding: 1px 5px; border-radius: 2px; background: var(--chip); border: var(--hair); color: var(--tx); }
#spk button { font: 500 16px/1.3 inherit; font-family: inherit; letter-spacing: -0.02em; color: var(--tx); background: var(--surf); border: var(--hair); border-radius: 6px; padding: 4px 10px; cursor: pointer;
  transition: background .25s var(--ease-soft), transform .2s var(--ease-soft); }
#spk button:hover { background: #2f2f2f; } #spk button:active { transform: scale(.97); }
#spk .spk-ghost { background: transparent; border-color: transparent; padding: 6px; line-height: 0; color: var(--tx2); }
.spk-pill { position: fixed; left: 50%; bottom: 96px; padding: 7px 12px; border-radius: 6px; background: var(--surf); border: var(--hair);
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); pointer-events: none; white-space: nowrap; z-index: 30; color: var(--tx2);
  opacity: 0; transform: translate(calc(-50% - 8px), 12px); transition: opacity .2s var(--ease-soft), transform .4s var(--ease-out-expo); }
.spk-pill.on { opacity: 1; transform: translate(-50%, 0); }
.spk-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.spk-h1 { font-size: 22px; font-weight: 500; letter-spacing: -0.05em; line-height: 1.1; }
.spk-hud { margin-top: 3px; }
.spk-row { display: flex; gap: 6px; align-items: center; margin: 10px 0; flex-wrap: wrap; }
#spk-url { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 6px; border: var(--hair); background: var(--surf); color: var(--tx); font: inherit; outline: none; transition: border-color .25s var(--ease-soft); }
#spk-url::placeholder { color: var(--tx3); } #spk-url:focus { border-color: rgba(247,247,247,.22); }
#spk #spk-go { background: var(--tx); color: #1e1e1e; }
#spk #spk-go:hover { background: #e9e9e9; }
.spk-vol { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.spk-vol input { width: 104px; accent-color: #f7f7f7; }
.spk-now { display: flex; flex-wrap: wrap; gap: 6px; }
.spk-chip { max-width: 100%; padding: 3px 7px; border-radius: 2px; background: var(--chip); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spk-seg { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 2px; border-radius: 6px; background: var(--surf); border: var(--hair); }
#spk .spk-seg button { position: relative; z-index: 1; background: transparent; border: 0; border-radius: 4px; padding: 4px 10px; }
#spk .spk-seg button:hover { background: transparent; }
#spk .spk-seg button[aria-selected="true"] .v { color: var(--tx); }
.spk-seg-pill { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc(50% - 2px); border-radius: 4px; background: rgba(247,247,247,.08); box-shadow: 0 0 0 1px rgba(247,247,247,.04);
  transition: transform .4s var(--ease-out-expo), opacity .25s var(--ease-soft); }
.spk-seg[data-v="room"] .spk-seg-pill { transform: translateX(100%); }
.spk-err { color: #ff8a7a; min-height: 1em; font-size: 12px; }
.spk-help { color: var(--tx3); font-size: 11.5px; margin-top: 2px; }
/* side drawer, right edge: collapsed = only the 28px tab shows; the body (and the YouTube iframe, real size)
   is translated offscreen, never display:none, so playback is not paused or throttled */
.spk-drawer { --top: max(340px, calc(50vh - 170px)); position: fixed; right: 0; top: var(--top); display: flex; align-items: flex-start; z-index: 45;
  transform: translateX(calc(100% - 28px)); transition: transform .45s var(--ease-out-expo), opacity .25s var(--ease-soft); opacity: 0; pointer-events: none; }
.spk-drawer.on, .spk-drawer.open { opacity: 1; pointer-events: auto; }
.spk-drawer.open { transform: translateX(0); }
#spk .spk-tab { position: relative; width: 28px; height: 76px; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: var(--surf); border: var(--hair); border-right: 0; border-radius: 6px 0 0 6px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2); color: var(--tx2); font-size: 13px; }
#spk .spk-tab:active { transform: none; }
.spk-note { line-height: 1; }
.spk-tabchip { position: absolute; right: calc(100% + 6px); top: 50%; padding: 3px 7px; border-radius: 2px; background: var(--chip); border: var(--hair); white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis;
  opacity: 0; transform: translate(6px, -50%); pointer-events: none; transition: opacity .2s var(--ease-soft), transform .4s var(--ease-out-expo); }
.spk-tab:hover .spk-tabchip { opacity: 1; transform: translate(0, -50%); }
.spk-drawer.open .spk-tabchip { display: none; }
.spk-body { padding: 12px; background: var(--bg); border: var(--hair); border-right: 0; border-radius: 0 0 0 6px; box-shadow: 0 2px 6px -2px rgba(0,0,0,.2), 0 24px 60px rgba(0,0,0,.35);
  box-sizing: border-box; width: 264px; max-height: calc(100vh - var(--top) - 12px); min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.spk-body .spk-head { margin-bottom: 8px; } .spk-body .spk-h1 { font-size: 18px; }
.spk-yt-host, .spk-yt-host iframe { display: block; width: 240px; height: 135px; border: 0; border-radius: 2px; background: #000; }
.spk-body .spk-now { margin-top: 8px; }
.spk-body .spk-row { margin: 8px 0; }
.spk-body #spk-url { padding: 5px 8px; font-size: 12.5px; }
.spk-body .spk-vol input { width: 80px; }
#spk .spk-body button { font-size: 14px; }
.spk-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tx3); flex: none; }
.spk-dot.live { background: #3ddc84; animation: hud-pulse 2s infinite; }
@keyframes hud-pulse { 50% { opacity: .35; } }
#spk .spk-unblock { position: fixed; left: 50%; bottom: 140px; z-index: 46; background: var(--tx); color: #1e1e1e; font-size: 16px; opacity: 0; pointer-events: none;
  transform: translate(calc(-50% - 8px), 12px); transition: opacity .2s var(--ease-soft), transform .4s var(--ease-out-expo); }
#spk .spk-unblock.on { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
#spk .spk-unblock:hover { background: #e9e9e9; }
.spk-roll { display: inline-block; overflow: hidden; vertical-align: bottom; }
.spk-roll > span { display: inline-block; white-space: pre; animation: spk-roll .5s var(--ease-out-expo) both; animation-delay: calc(var(--i) * 25ms); }
@keyframes spk-roll { from { transform: translateY(110%); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  #spk *, #spk { animation: none !important; transition: opacity .2s linear !important; }
}
`;
export function injectSpeakerCSS() {
  if (document.getElementById('spk-css')) return;
  const s = document.createElement('style'); s.id = 'spk-css'; s.textContent = CSS; document.head.appendChild(s);
}
