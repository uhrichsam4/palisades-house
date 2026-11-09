// Photo mode (P): the live game at maximum graphics + a free camera, accumulated anti-aliasing, lens and film controls,
// and a supersampled PNG save. Replaces the old path-traced photo mode (that one is kept only for shot mode's ?pt=).
//  - enter(): MAX quality (perf.js) with the dynamic controller held, trees at high detail / far, a soft 4096 sun shadow
//    re-rendered once; HUD hidden (body.photo + body.ui-open: interact prompts, emotes, video/re-create spots and the
//    sky panel stay quiet); the local player is frozen (state.frozen) but the world keeps running (water, avatars,
//    weather); the camera starts from the current view.
//  - Free camera: click the view to grab the mouse, WASD fly, Shift fast, Space / Ctrl (or E / Q) up / down, wheel = speed.
//  - Accumulation: the composer renders into its own buffer (renderToScreen off); while the camera is still every frame
//    is rendered with a sub-pixel (Halton) jitter — and, with depth of field on, a lens-disc offset sheared so the focus
//    plane stays put — and averaged (running mean, then an exponential window of 48 frames so animated water / people
//    stay alive). Any camera change restarts it. Display pass = exposure, filter, grain, vignette, frame guide.
//  - Take photo (button / Enter): re-renders 2x the canvas resolution (capped at ~12 MP) with 24 jittered samples,
//    applies the same display pass, crops to the frame guide and downloads palisades-<date>-<time>.png.
//  - exit(): everything restored (quality + video settings, player control, HUD, sky time/weather, camera, avatars).
import * as THREE from 'three';
import { slidePill } from '../net/motion.js';

const CSS = `
body.photo>*:not(#c):not(#photo-ui):not(#menu):not(#pause):not(.grain):not(script):not(style){visibility:hidden!important}
#photo-ui{position:fixed;inset:0;pointer-events:none;z-index:40;font-family:var(--ui-sans);color:var(--ui-text)}
#photo-ui .ph-panel{pointer-events:auto;position:absolute;inset:16px 16px 16px auto;z-index:auto;width:300px;overflow:auto;box-sizing:border-box;padding:16px;display:flex;flex-direction:column;gap:14px;
  background:var(--ui-surface);border:var(--ui-line);border-radius:var(--ui-r);box-shadow:var(--ui-shadow);
  transition:transform .5s var(--ease-out-expo),opacity .25s var(--ease-soft)}
#photo-ui.collapsed .ph-panel{transform:translateX(calc(100% + 24px));opacity:0}
#photo-ui .ph-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
#photo-ui h2{margin:0;font-size:20px;font-weight:500;letter-spacing:-.04em}
#photo-ui .ph-sec{font:600 10px/1 var(--ui-mono);letter-spacing:-.4px;color:var(--ui-text-3);text-transform:uppercase;padding-top:4px;border-top:var(--ui-line)}
#photo-ui .gm-field{gap:6px}
#photo-ui .gm-seg{flex-wrap:wrap}
#photo-ui .gm-seg button{font-size:12px;padding:4px 6px;flex:1 0 auto}
#photo-ui .ph-keys{font:600 10px/1.6 var(--ui-mono);letter-spacing:-.4px;color:var(--ui-text-3);text-transform:uppercase}
#photo-ui .ph-take{text-align:center}
#photo-ui .ph-chips{position:absolute;left:16px;bottom:16px;display:flex;gap:6px;pointer-events:none}
#photo-ui .ph-chips .chip{background:var(--ui-surface);border:var(--ui-line)}
#photo-ui .chip[hidden],#photo-ui[hidden]{display:none}
#photo-ui .ph-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .3s var(--ease-soft)}
@media (prefers-reduced-motion:reduce){#photo-ui .ph-panel{transition:opacity .2s}}`;

const WEATHERS = ['clear', 'cloudy', 'overcast', 'fog', 'rain', 'storm', 'snow', 'blizzard'];
const FILTERS = ['none', 'film', 'bw', 'warm', 'cool'];
const GUIDES = { free: 0, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 };
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

const ACC_FS = `uniform sampler2D tNew; uniform sampler2D tAcc; uniform float uA; varying vec2 vUv;
void main() { vec4 n = texture2D( tNew, vUv ); gl_FragColor = uA >= 1.0 ? n : mix( texture2D( tAcc, vUv ), n, uA ); }`;
const SHOW_FS = `uniform sampler2D tAcc; uniform int uFilter; uniform float uGrain; uniform float uVig; uniform float uGuide; uniform float uAspect; uniform float uSeed; uniform float uEv; varying vec2 vUv;
float h( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) + uSeed ) * 43758.5453 ); }
vec3 toLin( vec3 c ) { return pow( max( c, 0.0 ), vec3( 2.2 ) ); } vec3 toSrgb( vec3 c ) { return pow( max( c, 0.0 ), vec3( 1.0 / 2.2 ) ); }
void main() {
  vec3 c = texture2D( tAcc, vUv ).rgb;
  if ( uEv != 0.0 ) c = toSrgb( toLin( c ) * exp2( uEv ) );
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  if ( uFilter == 1 ) { c = mix( vec3( l ), c, 0.82 ); c = c * c * ( 3.0 - 2.0 * c ) * 0.55 + c * 0.45; c = c * vec3( 1.03, 1.0, 0.94 ) * 0.94 + vec3( 0.035, 0.03, 0.04 ); }
  else if ( uFilter == 2 ) { float g = dot( c, vec3( 0.3, 0.59, 0.11 ) ); g = g * g * ( 3.0 - 2.0 * g ) * 0.4 + g * 0.6; c = vec3( g ); }
  else if ( uFilter == 3 ) { c = c * vec3( 1.08, 1.0, 0.86 ); }
  else if ( uFilter == 4 ) { c = c * vec3( 0.9, 0.98, 1.1 ); }
  vec2 q = vUv - 0.5; q.x *= uAspect;
  if ( uVig > 0.0 ) c *= 1.0 - uVig * smoothstep( 0.25, 0.95, length( q ) * 1.1 );
  if ( uGrain > 0.0 ) c += ( h( floor( gl_FragCoord.xy ) ) - 0.5 ) * uGrain * 0.16 * ( 1.0 - 0.5 * l );
  if ( uGuide > 0.0 ) { vec2 hs = uGuide > uAspect ? vec2( 0.5, 0.5 * uAspect / uGuide ) : vec2( 0.5 * uGuide / uAspect, 0.5 );
    vec2 d = abs( vUv - 0.5 ); if ( d.x > hs.x || d.y > hs.y ) c *= 0.28; }
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`;

export function createPhotoMode(ctx) {
  const { renderer, scene, camera, player, quality } = ctx;
  const st = { active: false, n: 0, fov: 60, ev: 0, dof: 'off', focus: 8, aperture: 0.03, filter: 'none', grain: 0.25, vig: 0.35, guide: 'free', showMe: true, others: true, speed: 4, tod: null, weather: null, panel: true, saving: false };
  const saved = {}; const keys = new Set(); let yaw = 0, pitch = 0; const vel = new THREE.Vector3();
  const pos = new THREE.Vector3(), lastPos = new THREE.Vector3(), lastQ = new THREE.Quaternion(); let lastFov = 0, moved = true;
  // ---- GPU bits
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const quadGeo = new THREE.PlaneGeometry(2, 2);
  const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
  const accMat = new THREE.ShaderMaterial({ uniforms: { tNew: { value: null }, tAcc: { value: null }, uA: { value: 1 } }, vertexShader: vs, fragmentShader: ACC_FS, depthTest: false, depthWrite: false });
  const showMat = new THREE.ShaderMaterial({ uniforms: { tAcc: { value: null }, uFilter: { value: 0 }, uGrain: { value: 0 }, uVig: { value: 0 }, uGuide: { value: 0 }, uAspect: { value: 1 }, uSeed: { value: 0 }, uEv: { value: 0 } }, vertexShader: vs, fragmentShader: SHOW_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(quadGeo, accMat); quad.frustumCulled = false; const qScene = new THREE.Scene(); qScene.add(quad);
  let acc = [null, null], cur = 0;
  const mkRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
  const size = new THREE.Vector2();
  function ensure(w, h) { if (acc[0] && acc[0].width === w && acc[0].height === h) return; for (const r of acc) r?.dispose(); acc = [mkRT(w, h), mkRT(w, h)]; st.n = 0; }

  // ---- UI
  let ui = null, nEl = null;
  function buildUI() {
    if (!document.getElementById('photo-css')) { const s = document.createElement('style'); s.id = 'photo-css'; s.textContent = CSS; document.head.appendChild(s); }
    ui = document.createElement('div'); ui.id = 'photo-ui';
    const seg = (id, opts) => `<div class="gm-seg" id="${id}" role="radiogroup">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div>`;
    ui.innerHTML = `<div class="ph-flash"></div>
      <div class="ph-chips"><span class="chip"><i>PHOTO::</i><b>MAX</b></span><span class="chip"><i>SAMPLES::</i><b id="ph-n">0</b></span><span class="chip" id="ph-st" hidden><i>SAVE::</i><b>…</b></span></div>
      <aside class="ph-panel gm">
        <div class="ph-head"><h2>Photo mode</h2><span class="chip"><i>TAB::</i><b>HIDE</b></span></div>
        <div class="ph-sec">Camera</div>
        <label class="gm-field"><span>Field of view <b id="ph-fovv"></b></span><input id="ph-fov" type="range" min="15" max="110" step="1"></label>
        <label class="gm-field"><span>Exposure <b id="ph-evv"></b></span><input id="ph-ev" type="range" min="-2" max="2" step="0.1"></label>
        <div class="gm-field"><span>Depth of field</span>${seg('ph-dof', [['off', 'Off'], ['auto', 'Auto focus'], ['manual', 'Manual']])}</div>
        <label class="gm-field"><span>Focus distance <b id="ph-focv"></b></span><input id="ph-foc" type="range" min="0" max="1" step="0.001"></label>
        <label class="gm-field"><span>Aperture <b id="ph-apv"></b></span><input id="ph-ap" type="range" min="0.004" max="0.12" step="0.002"></label>
        <div class="ph-sec">Scene</div>
        <label class="gm-field"><span>Time of day <b id="ph-todv"></b></span><input id="ph-tod" type="range" min="0" max="24" step="0.05"></label>
        <div class="gm-field"><span>Weather</span>${seg('ph-wx', WEATHERS.map(w => [w, w[0].toUpperCase() + w.slice(1)]))}</div>
        <div class="gm-field"><span>My character</span>${seg('ph-me', [['1', 'Show'], ['0', 'Hide']])}</div>
        <div class="gm-field"><span>Other players</span>${seg('ph-oth', [['1', 'Show'], ['0', 'Hide']])}</div>
        <div class="ph-sec">Look</div>
        <div class="gm-field"><span>Filter</span>${seg('ph-flt', [['none', 'None'], ['film', 'Film'], ['bw', 'B&amp;W'], ['warm', 'Warm'], ['cool', 'Cool']])}</div>
        <label class="gm-field"><span>Grain <b id="ph-grv"></b></span><input id="ph-gr" type="range" min="0" max="1" step="0.01"></label>
        <label class="gm-field"><span>Vignette <b id="ph-viv"></b></span><input id="ph-vi" type="range" min="0" max="1" step="0.01"></label>
        <div class="gm-field"><span>Frame</span>${seg('ph-gd', [['free', 'Free'], ['16:9', '16:9'], ['9:16', '9:16 TikTok'], ['1:1', '1:1']])}</div>
        <button type="button" class="gm-primary ph-take" id="ph-take">Take photo</button>
        <div class="ph-keys">Click view = look · WASD fly · Shift fast<br>Space / Ctrl up / down · Wheel speed<br>Tab panel · Enter save · P exit</div>
      </aside>`;
    document.body.appendChild(ui);
    const $ = (id) => ui.querySelector('#' + id);
    nEl = $('ph-n');
    ui.querySelector('.ph-panel').addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const g of ui.querySelectorAll('.gm-seg')) slidePill(g, 'button');
    const bindSeg = (id, fn) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; fn(b.dataset.v); sync(); });
    bindSeg('ph-dof', (v) => { st.dof = v; if (v === 'auto') autoFocus(); reset(); });
    bindSeg('ph-wx', (v) => setWeather(v));
    bindSeg('ph-me', (v) => { st.showMe = v === '1'; reset(); });
    bindSeg('ph-oth', (v) => { st.others = v === '1'; setOthers(); reset(); });
    bindSeg('ph-flt', (v) => { st.filter = v; });
    bindSeg('ph-gd', (v) => { st.guide = v; });
    const rng = (id, fn) => $(id).addEventListener('input', (e) => { fn(+e.target.value); sync(); });
    rng('ph-fov', (v) => { st.fov = v; });
    rng('ph-ev', (v) => { st.ev = v; });
    rng('ph-foc', (v) => { st.focus = 0.3 * Math.pow(400, v); if (st.dof !== 'manual') st.dof = 'manual'; reset(); });
    rng('ph-ap', (v) => { st.aperture = v; reset(); });
    rng('ph-tod', (v) => setTod(v));
    rng('ph-gr', (v) => { st.grain = v; });
    rng('ph-vi', (v) => { st.vig = v; });
    $('ph-take').addEventListener('click', () => take());
  }
  function sync() {
    if (!ui) return; const $ = (id) => ui.querySelector('#' + id);
    const segv = (id, v) => { for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); $(id).__pill?.update(); };
    segv('ph-dof', st.dof); segv('ph-wx', st.weather ?? ''); segv('ph-me', st.showMe ? '1' : '0'); segv('ph-oth', st.others ? '1' : '0'); segv('ph-flt', st.filter); segv('ph-gd', st.guide);
    $('ph-fov').value = st.fov; $('ph-fovv').textContent = Math.round(st.fov) + '°';
    $('ph-ev').value = st.ev; $('ph-evv').textContent = (st.ev > 0 ? '+' : '') + st.ev.toFixed(1) + ' EV';
    $('ph-foc').value = Math.log(st.focus / 0.3) / Math.log(400); $('ph-focv').textContent = st.focus < 10 ? st.focus.toFixed(2) + ' m' : Math.round(st.focus) + ' m';
    $('ph-ap').value = st.aperture; $('ph-apv').textContent = (st.aperture * 100).toFixed(1) + ' cm';
    const sky = window.__sky; $('ph-tod').disabled = !sky; ui.querySelector('#ph-wx').classList.toggle('off', !sky);
    if (sky) { const t = (st.tod ?? sky.tod) * 24; $('ph-tod').value = t; $('ph-todv').textContent = sky.clock || (Math.floor(t) + ':' + String(Math.floor((t % 1) * 60)).padStart(2, '0')); } else $('ph-todv').textContent = 'n/a';
    $('ph-gr').value = st.grain; $('ph-grv').textContent = Math.round(st.grain * 100) + '%';
    $('ph-vi').value = st.vig; $('ph-viv').textContent = Math.round(st.vig * 100) + '%';
  }

  // ---- sky (local only while in photo mode; restored on exit)
  const SKY = ctx.sky;
  function setTod(h) { const sky = window.__sky; if (!sky) return; st.tod = ((h / 24) % 1 + 1) % 1; sky.set({ tod: st.tod, frozen: true }); reset(); }
  function setWeather(w) { const sky = window.__sky; if (!sky || !WEATHERS.includes(w)) return; st.weather = w;
    if (SKY?.net) SKY.net.mode = w; else sky.set({ weather: w }); // local: no lobby request
    sky.set({ instant: true }); reset(); }
  function setOthers() { const me = player.creature?.root; for (const o of scene.children) if (o.name === 'avatar' && o !== me) { if (!st.others) { if (o.userData.photoVis === undefined) o.userData.photoVis = o.visible; o.visible = false; } else if (o.userData.photoVis !== undefined) { o.visible = o.userData.photoVis; delete o.userData.photoVis; } } }

  // ---- focus: Rapier ray from the view centre (static + dynamic colliders), else 30 m
  const fwd = new THREE.Vector3();
  function autoFocus() {
    camera.getWorldDirection(fwd); let d = 30;
    try { const R = ctx.phys.RAPIER, ray = new R.Ray({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, { x: fwd.x, y: fwd.y, z: fwd.z }); const hit = ctx.phys.world.castRay(ray, 300, true); if (hit) d = Math.max(0.3, hit.timeOfImpact); } catch {}
    st.focus = d; sync();
  }
  function reset() { st.n = 0; moved = true; }

  // ---- input (capture phase while active: nothing reaches the player / interactions)
  const PASS = new Set(['Escape', 'KeyM', 'F5', 'F11', 'F12']);
  function onKey(e) {
    if (!st.active || PASS.has(e.code)) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' && t.type !== 'range' || t.tagName === 'TEXTAREA')) return;
    const b = document.body.classList; if (b.contains('paused') || b.contains('menu-open')) return;
    const down = e.type === 'keydown';
    if (down && e.code === 'Tab') { e.preventDefault(); st.panel = !st.panel; ui.classList.toggle('collapsed', !st.panel); }
    else if (down && (e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { e.preventDefault(); take(); }
    else if (e.code === 'KeyP') { return; } // main.js toggles
    else if (e.code === 'KeyF' && down) autoFocus();
    if (down) keys.add(e.code); else keys.delete(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    e.stopImmediatePropagation();
  }
  const onMove = (e) => { if (!st.active || document.pointerLockElement !== renderer.domElement) return; const k = 0.0022 * (player.state.sens || 1) * Math.min(1, st.fov / 70); yaw -= e.movementX * k; pitch = THREE.MathUtils.clamp(pitch - e.movementY * k, -1.55, 1.55); };
  const onWheel = (e) => { if (!st.active) return; st.speed = THREE.MathUtils.clamp(st.speed * (e.deltaY > 0 ? 0.85 : 1.18), 0.25, 60); };
  const onClick = () => { if (st.active && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.(); };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); addEventListener('mousemove', onMove); renderer.domElement.addEventListener('wheel', onWheel, { passive: true }); renderer.domElement.addEventListener('click', onClick);

  // ---- enter / exit
  function enter() {
    if (st.active) return;
    if (!ui) buildUI();
    const ps = player.state; const sky = window.__sky;
    Object.assign(saved, { fov: camera.fov, frozen: ps.frozen, yaw: ps.yaw, pitch: ps.pitch, camWant: ps.camWant, tier: quality.tier.name, auto: quality.auto, scale: quality.scale,
      exposure: renderer.toneMappingExposure, trees: window.__trees ? [window.__trees.detail, window.__trees.far] : null,
      sky: SKY ? { mode: SKY.net?.mode, clk: { ...SKY.clk } } : null, panel: document.body.classList.contains('ui-open') });
    st.active = true; st.n = 0; st.fov = camera.fov; st.tod = null; st.weather = sky ? sky.weather : null; st.showMe = true; st.others = true;
    pos.copy(camera.position); const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x; vel.set(0, 0, 0);
    ps.frozen = true; ps.keys?.clear(); keys.clear();
    quality.set('max'); quality.hold = true; window.__trees?.setDetail('high', true);
    renderer.shadowMap.needsUpdate = true; // fresh 4096 soft sun shadow for the photo
    document.body.classList.add('photo', 'ui-open'); ui.hidden = false; ui.classList.toggle('collapsed', !st.panel);
    sync(); reset();
  }
  function exit() {
    if (!st.active) return; st.active = false;
    const ps = player.state; ps.frozen = saved.frozen || false; ps.yaw = saved.yaw; ps.pitch = saved.pitch; ps.camWant = saved.camWant; ps.keys?.clear(); keys.clear();
    player.creature?.setVisible?.(true); st.others = true; setOthers();
    camera.fov = saved.fov; camera.clearViewOffset(); camera.updateProjectionMatrix();
    if (SKY && saved.sky) { if (SKY.net) SKY.net.mode = saved.sky.mode; Object.assign(SKY.clk, saved.sky.clk); window.__sky?.set({ instant: true }); }
    const c = ctx.getComposer?.(); if (c) c.renderToScreen = true;
    renderer.toneMappingExposure = saved.exposure;
    quality.hold = false; ctx.applyVideo?.();
    if (saved.auto) { quality.set(saved.tier.toLowerCase()); quality.auto = true; }
    if (saved.trees && !ctx.applyVideo) window.__trees?.setDetail(...saved.trees);
    document.body.classList.remove('photo'); if (!saved.panel) document.body.classList.remove('ui-open');
    if (ui) ui.hidden = true;
    renderer.shadowMap.needsUpdate = true;
  }

  // ---- per frame: called by main.js after player.update (camera driving) and instead of render()
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
  function drive(dt) {
    const ps = player.state; ps.yaw = saved.yaw; ps.pitch = saved.pitch; ps.camWant = saved.camWant; // the frozen player ignores our mouse/wheel
    player.creature?.setVisible?.(st.showMe);
    if (!st.others) setOthers();
    _e.set(pitch, yaw, 0); _q.setFromEuler(_e);
    _f.set(0, 0, -1).applyQuaternion(_q); _r.set(1, 0, 0).applyQuaternion(_q);
    const k = (c) => keys.has(c) ? 1 : 0;
    _w.set(0, 0, 0).addScaledVector(_f, k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown')).addScaledVector(_r, k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'));
    _w.y += k('Space') + k('KeyE') - k('ControlLeft') - k('ControlRight') - k('KeyQ') - k('KeyC');
    if (_w.lengthSq() > 0) _w.normalize().multiplyScalar(st.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1));
    vel.lerp(_w, 1 - Math.exp(-dt * 10)); if (vel.lengthSq() < 1e-6) vel.set(0, 0, 0);
    pos.addScaledVector(vel, dt);
    camera.position.copy(pos); camera.quaternion.copy(_q);
    if (camera.fov !== st.fov) { camera.fov = st.fov; }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const still = camera.position.distanceToSquared(lastPos) < 1e-10 && Math.abs(camera.quaternion.dot(lastQ)) > 1 - 1e-10 && camera.fov === lastFov;
    if (!still) { if (!moved && st.dof === 'auto') autoFocus(); reset(); } else if (moved) { moved = false; if (st.dof === 'auto') autoFocus(); }
    lastPos.copy(camera.position); lastQ.copy(camera.quaternion); lastFov = camera.fov;
  }
  // jittered (and lens-offset) projection for sample i at w x h pixels; returns a restore fn
  const _p = new THREE.Vector3();
  function jitter(i, w, h, on) {
    if (!on) return () => {};
    const jx = halton(i + 1, 2) - 0.5, jy = halton(i + 1, 3) - 0.5; const e = camera.projectionMatrix.elements;
    const P0 = e[0], P5 = e[5]; _p.copy(camera.position);
    let lx = 0, ly = 0;
    if (st.dof !== 'off' && st.aperture > 0) { const a = halton(i + 1, 5) * Math.PI * 2, r = Math.sqrt(halton(i + 1, 7)) * st.aperture; lx = Math.cos(a) * r; ly = Math.sin(a) * r;
      camera.position.add(_r.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(lx)).add(_w.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(ly)); camera.updateMatrixWorld(); }
    e[8] += -2 * jx / w - P0 * lx / st.focus; e[9] += -2 * jy / h - P5 * ly / st.focus; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return () => { camera.position.copy(_p); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
  }
  function show(target, seed) {
    const so = showMat.uniforms; so.tAcc.value = acc[cur].texture; so.uFilter.value = FILTERS.indexOf(st.filter); so.uGrain.value = st.grain; so.uVig.value = st.vig; so.uGuide.value = GUIDES[st.guide] || 0;
    so.uAspect.value = camera.aspect; so.uSeed.value = seed; so.uEv.value = st.ev;
    quad.material = showMat; renderer.setRenderTarget(target); renderer.render(qScene, quadCam);
  }
  function sample(composer, renderScene, w, h, alpha, i, doJitter) {
    const restore = jitter(i, w, h, doJitter);
    try { renderScene(); } finally { restore(); }
    accMat.uniforms.tNew.value = composer.readBuffer.texture; accMat.uniforms.tAcc.value = acc[cur].texture; accMat.uniforms.uA.value = alpha;
    quad.material = accMat; cur ^= 1; renderer.setRenderTarget(acc[cur]); renderer.render(qScene, quadCam);
  }
  function render(renderScene) {
    const composer = ctx.getComposer?.(); if (!composer) { renderScene(); return; }
    renderer.getDrawingBufferSize(size); ensure(size.x, size.y);
    composer.renderToScreen = false;
    const exp = renderer.toneMappingExposure; // (sky owns exposure every frame; the EV slider is a post control)
    const i = st.n; const alpha = i === 0 ? 1 : Math.max(1 / (i + 1), 1 / 48);
    sample(composer, renderScene, size.x, size.y, alpha, i, i > 0 || st.dof !== 'off');
    st.n++;
    renderer.toneMappingExposure = exp;
    show(null, (performance.now() % 1000) * 0.001);
    if (nEl && (st.n < 64 || st.n % 15 === 0)) nEl.textContent = st.n > 999 ? '999+' : String(st.n);
  }

  // ---- save: 2x supersampled PNG, cropped to the frame guide
  async function take() {
    if (!st.active || st.saving) return; st.saving = true;
    const chip = ui.querySelector('#ph-st'); chip.hidden = false; chip.querySelector('b').textContent = 'RENDERING';
    await new Promise(r => requestAnimationFrame(r));
    const composer = ctx.getComposer?.(); const pr0 = renderer.getPixelRatio(); const W = innerWidth, H = innerHeight;
    let out = null, file = '';
    try {
      const maxTex = renderer.capabilities.maxTextureSize || 8192;
      let pr = pr0 * 2; const cap = Math.sqrt(12e6 / (W * H)); pr = Math.min(pr, cap, maxTex / W, maxTex / H);
      renderer.setPixelRatio(pr); renderer.setSize(W, H, false); composer?.setPixelRatio(pr); composer?.setSize(W, H);
      renderer.getDrawingBufferSize(size); const w = size.x, h = size.y; ensure(w, h);
      const N = 24; ctx.beforeSave?.();
      for (let i = 0; i < N; i++) { if (composer) { composer.renderToScreen = false; sample(composer, ctx.renderScene, w, h, 1 / (i + 1), i, true); } }
      const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
      show(rt, 0.37);
      const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px); rt.dispose();
      // crop to the guide
      const g = GUIDES[st.guide] || 0, a = w / h; let cw = w, ch = h; if (g) { if (g > a) ch = Math.round(w / g); else cw = Math.round(h * g); }
      const x0 = Math.floor((w - cw) / 2), y0 = Math.floor((h - ch) / 2);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const c2 = cv.getContext('2d'); const img = c2.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) { const src = ((h - 1 - (y + y0)) * w + x0) * 4; img.data.set(px.subarray(src, src + cw * 4), y * cw * 4); } // GL rows are bottom-up
      c2.putImageData(img, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
      file = `palisades-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      out = { file, width: cw, height: ch, pixelRatio: +pr.toFixed(3), samples: N, bytes: blob.size };
      window.__photoLast = out;
    } catch (e) { console.error('[photo save]', e); window.__errors?.push('photo save: ' + e.message); }
    finally {
      renderer.setPixelRatio(pr0); renderer.setSize(W, H, false); composer?.setPixelRatio(pr0); composer?.setSize(W, H); reset();
      chip.querySelector('b').textContent = out ? 'SAVED' : 'FAILED'; setTimeout(() => { chip.hidden = true; }, 1600);
      const fl = ui.querySelector('.ph-flash'); fl.style.opacity = '0.5'; setTimeout(() => { fl.style.opacity = '0'; }, 90);
      st.saving = false;
    }
    return out;
  }

  const api = { get active() { return st.active; }, get samples() { return st.n; }, state: st, enter, exit, drive, render, take, autoFocus, setTod, setWeather, sync,
    toggle() { st.active ? exit() : enter(); }, set(o) { Object.assign(st, o); if (o.others !== undefined) setOthers(); sync(); reset(); } };
  window.__photo = api;
  return api;
}
