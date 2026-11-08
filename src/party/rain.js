// "Make it rain": hold L to spray $100 notes from your right hand (avatar hand bone when the avatar is visible,
// else chest height + 0.4 m forward), in the camera's look direction. While held, {t:'rain', p, d} goes out at
// 5 Hz on mp.channel('party'); peers play the same spray at that player's avatar hand. A small CASH::$<n> chip
// under the top bar (left) rolls up the amount you've thrown ("spent").
import * as THREE from 'three';

const HZ = 5, BILLS_PER_S = 45, DENOM = 100;
const HAND_RE = /(right.?hand|hand[._ ]?r(?![a-z])|(?:^|[^a-z])r[._ ]?hand)/i;

function findHand(root) {
  if (!root) return null; let best = null;
  root.traverse(o => { if (!(o.isBone || o.type === 'Bone')) return; const n = o.name || ''; if (!HAND_RE.test(n)) return; if (!best || n.length < best.name.length) best = o; });
  return best;
}
const handCache = new WeakMap();
function handOf(creature) {
  if (!creature?.root) return null;
  if (!handCache.has(creature)) handCache.set(creature, findHand(creature.root));
  return handCache.get(creature);
}

function injectCSS() {
  if (document.getElementById('party-css')) return;
  const s = document.createElement('style'); s.id = 'party-css';
  s.textContent = `#party-cash{position:fixed;top:54px;left:16px;z-index:8;pointer-events:none;opacity:0;transform:translateY(-4px);transition:opacity .25s var(--ease-soft,ease-out),transform .4s var(--ease-out-expo,ease-out)}
#party-cash.on{opacity:1;transform:none}
#party-cash .chip{background:var(--ui-surface,#262626);border:var(--ui-line,1px solid rgba(247,247,247,.06));box-shadow:var(--ui-shadow,0 2px 6px -2px rgba(0,0,0,.2))}
#party-cash .chip b{color:var(--ui-accent,#f2c84b);font-variant-numeric:tabular-nums}
#party-cash.hot .chip{box-shadow:0 0 0 1px rgba(242,200,75,.25),var(--ui-shadow,0 2px 6px -2px rgba(0,0,0,.2))}
body.shot #party-cash,body.menu-open #party-cash{display:none!important}
@media (prefers-reduced-motion: reduce){#party-cash{transition:opacity .2s}}`;
  document.head.appendChild(s);
}

export function startMakeItRain(ctx, mp, money) {
  const { camera, player } = ctx; if (!player) return null;
  const ch = mp?.channel ? mp.channel('party') : null;
  injectCSS();
  const el = document.createElement('div'); el.id = 'party-cash';
  el.innerHTML = '<span class="chip"><i>CASH::</i><b>$0</b></span>'; document.body.appendChild(el);
  const val = el.querySelector('b');

  let held = false, acc = 1 / HZ, spent = 0, shown = 0, lastText = '';
  const blocked = (e) => { const t = e?.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true; const b = document.body.classList; return b.contains('ui-open') || b.contains('menu-open'); };
  addEventListener('keydown', (e) => { if (e.code !== 'KeyL' || blocked(e)) return; held = true; });
  addEventListener('keyup', (e) => { if (e.code === 'KeyL') held = false; });
  addEventListener('blur', () => { held = false; });

  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
  // where my notes leave from + where they go
  function myOrigin() {
    const cr = player.creature; const hand = handOf(cr);
    camera.getWorldDirection(_d); _f.set(_d.x, 0, _d.z); if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize();
    if (hand && cr.root.visible) { hand.getWorldPosition(_o); _o.addScaledVector(_f, 0.08); }
    else { const p = player.state.pos; _r.set(-_f.z, 0, _f.x); _o.set(p.x, p.y + 1.3, p.z).addScaledVector(_f, 0.4).addScaledVector(_r, 0.18); }
    // throw: look direction, lifted a bit so the notes arc up and float down
    _d.y = Math.max(-0.3, _d.y) + 0.35; _d.normalize();
    return { o: _o, d: _d };
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function throwOnce(seconds) {
    const { o, d } = myOrigin();
    money.spray(o, d, seconds);
    spent += Math.round(BILLS_PER_S * seconds) * DENOM;
    if (ch) ch.send({ t: 'rain', p: [r3(o.x), r3(o.y), r3(o.z)], d: [r3(d.x), r3(d.y), r3(d.z)] });
  }
  // peers
  if (ch) ch.onMessage = (m, id) => {
    if (!m || m.t !== 'rain' || !Array.isArray(m.p) || !Array.isArray(m.d) || m.p.length !== 3 || m.d.length !== 3 || ![...m.p, ...m.d].every(Number.isFinite)) return;
    const peer = mp.peers?.get(id); const o = new THREE.Vector3(...m.p);
    const hand = peer && handOf(peer.creature);
    if (hand && peer.creature.root.visible) { hand.getWorldPosition(o); }
    else if (peer?.pos) { const dx = m.p[0] - peer.pos.x, dz = m.p[2] - peer.pos.z; if (dx * dx + dz * dz > 4) o.set(peer.pos.x, peer.pos.y + 1.3, peer.pos.z); }
    const d = new THREE.Vector3(...m.d); if (d.lengthSq() < 1e-6) d.set(0, 0.3, -1);
    money.spray(o, d.normalize(), 1 / HZ);
  };

  ctx.onUpdate((dt) => {
    if (held && document.body.classList.contains('ui-open')) held = false;
    if (held) { acc += dt; if (acc >= 1 / HZ) { acc = 0; throwOnce(1 / HZ); } } else acc = 1 / HZ;
    if (shown !== spent) {
      shown = shown + Math.max(DENOM, Math.ceil((spent - shown) * Math.min(1, dt * 8) / DENOM) * DENOM); if (shown > spent) shown = spent;
      const t = '$' + shown.toLocaleString('en-US'); if (t !== lastText) { val.textContent = t; lastText = t; }
    }
    el.classList.toggle('on', spent > 0); el.classList.toggle('hot', held);
  });
  return { get held() { return held; }, get spent() { return spent; }, el, setHeld(v) { held = !!v; }, origin: () => { const { o, d } = myOrigin(); return { o: o.toArray(), d: d.toArray() }; }, handOf };
}
