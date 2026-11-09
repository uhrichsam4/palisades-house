// Look-at interactions. Modules register things you can use (taps, cars, …); the one you are looking at
// (screen-centre ray, generous radius) and standing near gets a mono prompt chip under the crosshair,
// "E::TURN ON WATER", and E (or tapping the chip on touch screens) calls its use().
//
//   const off = ctx.interact.add({
//     id: 'tap:kitchen',                 // unique
//     pos: () => vec3 | vec3,            // world point the prompt belongs to (spout, door handle, …)
//     radius: 0.35,                      // how far off-centre the crosshair may be (metres at that point)
//     range: 2.2,                        // max distance from the player's chest
//     label: () => 'TURN ON WATER',      // UPPERCASE, short; may change with state
//     use: () => {},                     // E pressed while focused
//     enabled: () => true,               // optional
//   });
//   ctx.interact.modal = { label: () => 'EXIT CAR', use: () => true }  // e.g. while driving: E goes here first
//
// E is routed: interact.use() first (modal, then the focused target), doors only if nothing took it.
import * as THREE from 'three';

export function createInteract(ctx) {
  const { camera, player } = ctx;
  const targets = new Map();
  let focused = null, modal = null, acc = 0, shownKey = '';

  const el = document.createElement('div'); el.id = 'ix-prompt'; el.setAttribute('role', 'button');
  el.innerHTML = '<span class="ix-k">E</span><span class="ix-sep">::</span><span class="ix-v"></span>';
  document.body.appendChild(el);
  const vEl = el.querySelector('.ix-v');
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); api.use(); });
  const css = document.createElement('style');
  css.textContent = `
#ix-prompt{position:fixed;left:50%;top:calc(50% + 34px);transform:translate(-50%,6px) scale(.96);opacity:0;pointer-events:none;z-index:40;
  display:flex;align-items:center;gap:0;padding:5px 8px;border-radius:2px;background:var(--ui-surface,#262626);border:1px solid rgba(247,247,247,.06);
  box-shadow:0 2px 6px -2px rgba(0,0,0,.2);font-family:var(--ui-mono,ui-monospace,'SF Mono',monospace);font-size:11px;font-weight:600;letter-spacing:-.4px;white-space:nowrap;
  transition:opacity .2s var(--ease-soft,ease-out),transform .35s var(--ease-out-expo,ease-out)}
#ix-prompt.on{opacity:1;transform:translate(-50%,0) scale(1);pointer-events:auto;cursor:pointer}
#ix-prompt .ix-k{color:#1e1e1e;background:#f2c84b;border-radius:2px;padding:1px 5px;margin-right:2px}
#ix-prompt .ix-sep{color:rgba(247,247,247,.32)}
#ix-prompt .ix-v{color:rgba(247,247,247,.86)}
body.menu-open #ix-prompt,body.paused #ix-prompt,body.ui-open #ix-prompt,body.photo #ix-prompt,body.shot #ix-prompt{display:none!important}
@media (prefers-reduced-motion:reduce){#ix-prompt{transition:opacity .15s linear}}`;
  document.head.appendChild(css);

  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
  const posOf = (t) => (typeof t.pos === 'function' ? t.pos(_t) : t.pos);

  function pick() {
    if (modal) return null;
    const st = player?.state; if (!st) return null;
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    _c.copy(st.pos); _c.y += 1.2; // chest
    let best = null, bestScore = Infinity;
    for (const t of targets.values()) {
      if (t.enabled && !t.enabled()) continue;
      const p = posOf(t); if (!p) continue;
      const near = _c.distanceTo(p); if (near > (t.range ?? 2.2)) continue;
      // distance from the target to the camera ray, measured at the target
      _p.copy(p).sub(_o); const along = _p.dot(_d); if (along < 0.05) continue;
      const off = Math.sqrt(Math.max(0, _p.lengthSq() - along * along));
      const r = (t.radius ?? 0.35) + along * 0.06; // ~3.4° extra slack so far targets are not fiddly
      if (off > r) continue;
      /* several qualify (the dining table in front of the sliding doors): the one closest along the camera ray wins;
         how centred it is only breaks near-ties (0.5 m along the ray ~ fully off-centre) */
      const score = along + 0.5 * (off / r);
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  function show(label) {
    const key = label || '';
    if (key === shownKey) return; shownKey = key;
    if (!key) { el.classList.remove('on'); return; }
    vEl.textContent = key; el.classList.add('on');
  }

  const api = {
    add(t) { if (!t?.id) throw new Error('interact.add needs an id'); targets.set(t.id, t); return () => { targets.delete(t.id); if (focused === t) focused = null; }; },
    remove(id) { const t = targets.get(id); targets.delete(id); if (focused === t) focused = null; },
    get modal() { return modal; },
    set modal(m) { modal = m || null; acc = 1; },
    get focused() { return focused; },
    targets,
    // returns true if something took the key press
    use() {
      if (modal) { try { return modal.use() !== false; } catch (e) { console.warn('[interact]', e); return true; } }
      const t = focused || pick(); if (!t) return false;
      try { t.use(); } catch (e) { console.warn('[interact]', t.id, e); }
      acc = 1; return true;
    },
    update(dt) {
      acc += dt; if (acc < 1 / 15) return; acc = 0;
      focused = pick();
      const lab = modal ? modal.label?.() : focused ? focused.label?.() : '';
      show(lab ? String(lab).toUpperCase() : '');
    },
  };
  window.__interact = api;
  return api;
}
