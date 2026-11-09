// K: small Weather card (docs/UI_STYLE.md): dark #262626 card, mono TIME/WEATHER chips, one segmented control
// with the sliding pill. Choosing a weather sets it for the whole lobby (index.js syncs it).
import { slidePill, rollText } from '../net/motion.js';

const CSS = `
#sky-panel{position:fixed;right:16px;top:76px;z-index:21;width:min(720px,calc(100vw - 32px));box-sizing:border-box;padding:14px;display:none;flex-direction:column;gap:10px;
  background:var(--ui-surface,#262626);border:var(--ui-line,1px solid rgba(247,247,247,.06));border-radius:var(--ui-r,6px);box-shadow:var(--ui-shadow,0 2px 6px -2px rgba(0,0,0,.2));
  color:var(--ui-text,#f7f7f7);font:400 14px/1.4 var(--ui-sans,-apple-system,Inter,sans-serif);letter-spacing:-.02em;pointer-events:auto}
#sky-panel.show{display:flex;animation:sky-in .45s var(--ease-out-expo,cubic-bezier(.16,1,.3,1))}
#sky-panel.hide{display:flex;animation:sky-out .2s var(--ease-io,cubic-bezier(.45,0,.55,1)) forwards}
@keyframes sky-in{from{opacity:0;transform:translateY(6%) scale(.96)}to{opacity:1;transform:none}}
@keyframes sky-out{to{opacity:0;transform:translateY(4%) scale(.97)}}
#sky-panel .sky-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
#sky-panel h3{margin:0;font-size:16px;font-weight:500;letter-spacing:-.04em}
#sky-panel .sky-chips{display:flex;gap:4px}
#sky-panel .sky-seg{display:flex;gap:4px;padding:4px;background:var(--ui-bg,#1e1e1e);border:var(--ui-line,1px solid rgba(247,247,247,.06));border-radius:var(--ui-r,6px)}
#sky-panel .sky-seg button{flex:1;font:inherit;font-size:13px;font-weight:500;padding:4px 10px;background:transparent;border:0;border-radius:var(--ui-r-inner,4px);color:var(--ui-text-2,rgba(247,247,247,.66));cursor:pointer;transition:color .25s var(--ease-soft,ease-out),transform .2s var(--ease-soft,ease-out)}
#sky-panel .sky-seg button:hover,#sky-panel .sky-seg button[aria-pressed=true]{color:var(--ui-text,#f7f7f7)}
#sky-panel .sky-seg button:active{transform:scale(.97)}
#sky-panel .sky-sub{font:600 11px/1 var(--ui-mono,ui-monospace,monospace);letter-spacing:-.4px;color:var(--ui-text-3,rgba(247,247,247,.32));text-transform:uppercase}
body.shot #sky-panel,body.menu-open #sky-panel{display:none!important}
@media (prefers-reduced-motion:reduce){#sky-panel.show,#sky-panel.hide{animation:none}}
`;
const MODES = ['auto', 'clear', 'cloudy', 'overcast', 'fog', 'rain', 'storm', 'snow', 'blizzard'];

export function createPanel(sky) {
  let el = null, seg = null, pill = null, chipT = null, chipW = null, chipC = null, sub = null, timer = 0, open = false;
  const blocked = (e) => { const t = e?.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true; const b = document.body.classList; return b.contains('menu-open') || b.contains('paused') || (b.contains('ui-open') && !open) || b.contains('shot'); };
  function build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'sky-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Weather');
    el.innerHTML = `<div class="sky-head"><h3>Weather</h3><div class="sky-chips"><span class="chip"><i>TIME::</i><b></b></span><span class="chip"><i>WEATHER::</i><b></b></span><span class="chip"><i>TEMP::</i><b></b></span></div></div>
      <div class="sky-seg" role="radiogroup" aria-label="Weather for the lobby">${MODES.map(m => `<button type="button" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
      <div class="sky-sub"></div>`;
    document.body.appendChild(el);
    [chipT, chipW, chipC] = el.querySelectorAll('.chip b'); sub = el.querySelector('.sky-sub'); seg = el.querySelector('.sky-seg');
    pill = slidePill(seg, 'button');
    seg.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; sky.requestWeather(b.dataset.mode); b.blur(); refresh(); });
    for (const ev of ['pointerdown', 'click', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('animationend', () => { if (el.classList.contains('hide')) el.classList.remove('hide'); });
  }
  function refresh() {
    if (!el) return;
    rollText(chipT, sky.clock); rollText(chipW, sky.weather.toUpperCase()); rollText(chipC, Math.round(sky.tempC) + '°C');
    const mode = sky.mode; for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    sub.textContent = (mode === 'auto' ? 'AUTO · CHANGES EVERY FEW MINUTES' : 'SET FOR EVERYONE IN THE LOBBY') + ' · K CLOSE';
    pill?.update();
  }
  function setOpen(v) {
    if (v === open) return; if (!el) build(); open = v;
    if (v) { el.classList.remove('hide'); el.classList.add('show'); document.body.classList.add('ui-open'); try { document.exitPointerLock?.(); } catch {} refresh(); timer = setInterval(refresh, 500); }
    else { el.classList.remove('show'); el.classList.add('hide'); document.body.classList.remove('ui-open'); clearInterval(timer); }
  }
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) { setOpen(false); return; }
    if (e.code !== 'KeyK' || e.repeat) return;
    if (open) { setOpen(false); return; }
    if (blocked(e)) return;
    setOpen(true);
  });
  return { setOpen, get open() { return open; }, refresh };
}
