// Shared UI motion helpers (docs/UI_STYLE.md "Motion"). CSS transitions only: the one JS piece is the one-shot
// per-character text roll. Styles live in src/menu.css (.roll, .pill-group, .stage, .grain, .spin).
//   rollText(el, text)      slot-machine roll per changed character (titles, counts, codes); textContent-safe
//   slidePill(group, sel)   one highlight pill slides to the active / hovered / focused item of `group`
//   stageSwap(oldEl, newEl) old sinks out, new rises in (hidden attribute toggled after the sink)
//   ensureGrain()           fixed animated film-grain layer (once)
export const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function rollText(el, text) {
  text = String(text ?? '');
  if (!el) return;
  const prev = el.dataset.roll ?? el.textContent;
  if (prev === text && el.dataset.roll !== undefined) return;
  el.dataset.roll = text; el.setAttribute('aria-label', text);
  if (reduced()) { el.textContent = text; return; }
  el.classList.add('roll'); el.textContent = '';
  let k = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; const changed = prev[i] !== ch;
    const slot = document.createElement('span'); slot.className = 'roll-c'; slot.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span'); inner.textContent = ch === ' ' ? ' ' : ch;
    if (changed) { inner.className = 'roll-in'; inner.style.animationDelay = (k++ * 25) + 'ms'; }
    slot.appendChild(inner); el.appendChild(slot);
  }
}

export function slidePill(group, itemSel = 'button', { activeSel = '[aria-pressed=true],.active', follow = true } = {}) {
  if (!group || group.__pill) return group?.__pill;
  group.classList.add('pill-group');
  const pill = document.createElement('span'); pill.className = 'pill'; pill.setAttribute('aria-hidden', 'true'); group.prepend(pill);
  const place = (el) => {
    if (!el || el.hidden || !el.offsetParent) { pill.style.opacity = '0'; return; }
    pill.style.opacity = '1';
    const g = group.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = r.left - g.left - group.clientLeft + group.scrollLeft, y = r.top - g.top - group.clientTop + group.scrollTop;
    pill.style.transform = `translate(${x}px, ${y}px)`; pill.style.width = r.width + 'px'; pill.style.height = r.height + 'px';
  };
  const active = () => group.querySelector(`:scope ${itemSel}${activeSel.split(',').map(s => s.trim()).join(`, :scope ${itemSel}`)}`);
  const rest = () => place(active());
  if (follow) {
    group.addEventListener('pointerover', (e) => { const it = e.target.closest(itemSel); if (it && group.contains(it)) place(it); });
    group.addEventListener('focusin', (e) => { const it = e.target.closest(itemSel); if (it && group.contains(it)) place(it); });
    group.addEventListener('pointerleave', rest); group.addEventListener('focusout', () => setTimeout(() => { if (!group.contains(document.activeElement)) rest(); }, 0));
  }
  const api = { update: rest, place }; group.__pill = api; requestAnimationFrame(rest); return api;
}

export function stageSwap(oldEl, newEl) {
  if (oldEl && oldEl !== newEl && !oldEl.hidden) {
    if (reduced()) oldEl.hidden = true;
    else { oldEl.classList.add('stage-out'); setTimeout(() => { oldEl.classList.remove('stage-out'); if (oldEl.classList.contains('stage-gone')) oldEl.hidden = true; }, 220); oldEl.classList.add('stage-gone'); }
  }
  if (newEl) { newEl.classList.remove('stage-gone', 'stage-out'); newEl.hidden = false; newEl.classList.remove('stage-in'); void newEl.offsetWidth; newEl.classList.add('stage-in'); }
}

export function ensureGrain() {
  if (document.getElementById('ui-grain')) return;
  const g = document.createElement('div'); g.id = 'ui-grain'; g.className = 'grain'; g.setAttribute('aria-hidden', 'true'); document.body.appendChild(g);
}
