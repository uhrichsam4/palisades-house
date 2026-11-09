// Frame-rate machinery for walk mode (lead-owned).
//  - quality tiers + dynamic resolution: watches real frame intervals against the display's refresh rate
//    (120 Hz ProMotion -> 8.3 ms) and trades render resolution / effects to hold it, then climbs back up
//  - on-demand sun shadows: the sun never moves, so the shadow map is only re-rendered when something
//    that casts a shadow moves (doors, pushed props, other players)
//  - mirror guard: planar Reflectors re-render the whole house; only let them do it when the viewer is in
//    the mirror's room, and never inside another mirror's render
//  - light pool: every extra PointLight/SpotLight costs a loop iteration in EVERY pixel's shader; keep a
//    small fixed pool of real lights and hand them to the sources nearest the viewer (no shader recompiles)
import * as THREE from 'three';
import * as P from './plan.js';

// ---------------------------------------------------------------- quality tiers
// scale = fraction of the device pixel ratio we render at (dynamic resolution moves it within [min,max])
export const TIERS = [
  { name: 'Ultra', ao: 'High', aa: 'smaa', bloom: true, min: 0.85, max: 1.0 }, // full-res AO
  { name: 'High', ao: 'Medium', aa: 'smaa', bloom: true, min: 0.7, max: 1.0 },
  { name: 'Medium', ao: 'Low', aa: 'fxaa', bloom: true, min: 0.6, max: 0.9 },
  { name: 'Low', ao: null, aa: 'fxaa', bloom: false, min: 0.5, max: 0.8 },
];

// Video settings (src/net/settings.js keys; Settings > VIDEO). A preset sets every control; changing one control
// makes it 'custom'. Tier presets ('auto' + TIERS) apply exactly the tier look + its levers (no overrides), so they
// render as before; 'custom' = the base tier plus user overrides that the dynamic levers respect; 'max' = MAX tier.
//   res: 'auto' (dynamic) | 50..200 (% of the device pixel ratio, fixed)   shadows: off|low|high|ultra
//   ao: off|half|full   bloom: on|off   aa: off|fxaa|smaa   weatherDetail: low|high   treeDetail: low|medium|high
//   viewDist: near|far   fov: 60..100
export const VIDEO_KEYS = ['res', 'shadows', 'ao', 'bloom', 'aa', 'weatherDetail', 'treeDetail', 'viewDist', 'shafts', 'grass', 'film'];
// src/look (read straight from settings by src/look/index.js; the live tier also gates them): shafts off|on, grass off|low|high, film neutral|agx
export const PRESETS = {
  auto: { res: 'auto', shadows: 'high', ao: 'half', bloom: 'on', aa: 'smaa', weatherDetail: 'high', treeDetail: 'medium', viewDist: 'far', shafts: 'off', grass: 'high', film: 'neutral' },
  low: { res: 'auto', shadows: 'high', ao: 'off', bloom: 'off', aa: 'fxaa', weatherDetail: 'low', treeDetail: 'low', viewDist: 'near', shafts: 'off', grass: 'off', film: 'neutral' },
  medium: { res: 'auto', shadows: 'high', ao: 'half', bloom: 'on', aa: 'fxaa', weatherDetail: 'high', treeDetail: 'medium', viewDist: 'far', shafts: 'off', grass: 'low', film: 'neutral' },
  high: { res: 'auto', shadows: 'high', ao: 'half', bloom: 'on', aa: 'smaa', weatherDetail: 'high', treeDetail: 'medium', viewDist: 'far', shafts: 'off', grass: 'high', film: 'neutral' },
  ultra: { res: 'auto', shadows: 'high', ao: 'full', bloom: 'on', aa: 'smaa', weatherDetail: 'high', treeDetail: 'medium', viewDist: 'far', shafts: 'off', grass: 'high', film: 'neutral' },
  max: { res: 100, shadows: 'ultra', ao: 'full', bloom: 'on', aa: 'smaa', weatherDetail: 'high', treeDetail: 'high', viewDist: 'far', shafts: 'off', grass: 'high', film: 'neutral' },
};
// overrides for a 'custom' config (null = the tier decides). Base tier = the closest built-in look.
export function videoOverrides(v) {
  return { res: v.res === 'auto' ? null : Math.min(200, Math.max(50, +v.res || 100)), shadows: v.shadows || null, ao: v.ao || null,
    bloom: v.bloom ? v.bloom === 'on' : null, aa: v.aa || null };
}

// Controller input per frame: frame(intervalMs, workMs?, gpuMs?) — rAF interval, CPU work of the frame, GPU time
// (EXT_disjoint_timer_query_webgl2, may lag a few frames). The frame "cost" it regulates is the larger of CPU and
// GPU work (and the interval itself once frames are clearly missed), so it reacts to GPU-bound frames under vsync.
//
// Ultra (picked by the user or reached by Auto) holds 120 fps (8.33 ms) on >=100 Hz displays, the display rate
// below that, WITHOUT leaving Ultra: levers, cheapest-to-notice first —
//   render scale (down to 0.6, fast) -> stage 1 AO half-res + quarter-res bloom -> stage 2 2k shadow map, slower
//   door-shadow refresh -> stage 3 small-object cull distance x0.6 -> stage 4 probe bake paused.
// Drops react within ~0.25-0.5 s; recovery needs ~2.5 s of headroom per step. Other tiers: Auto steps tiers as before.
export function createQuality({ renderer, apply, initial = 'auto', basePR = Math.min(devicePixelRatio || 1, 2) }) {
  const fixed = initial !== 'auto';
  let tier = fixed ? Math.max(0, TIERS.findIndex(t => t.name.toLowerCase() === initial)) : 1;
  let scale = fixed ? TIERS[tier].max : 0.8, stage = 0;
  let refreshMs = 1000 / 60, refreshKnown = false; const probe = [];
  const win = []; let goodFor = 0, lastChange = 0, droppedFrom = new Map();
  let ema = 0, emaN = 0, lastCheck = 0, okSince = 0;
  const ULTRA_FLOOR = 0.6;
  const isUltra = () => tier === 0;
  // frame-time target: the display interval (Ultra: 120 fps on >=100 Hz displays); a 60/120 cap (st.capMs) can only
  // relax it. Uncapped (capMs 0) keeps full quality unless frames exceed the display interval.
  const target = () => Math.max(isUltra() && refreshMs < 10 ? 1000 / 120 : refreshMs, st.capMs || 0);
  // max: MAX tier (no dynamic lowering, pixel ratio = min(dpr, 2)); over: custom overrides (null = none); hold: photo
  // mode freezes the controller (nothing drops while a photo accumulates)
  let max = false, over = null, hold = false;
  const prOf = () => max ? basePR : over?.res ? Math.min(4, (devicePixelRatio || 1) * over.res / 100) : basePR * scale;
  const st = { get tier() { return TIERS[tier]; }, get tierIndex() { return tier; }, get scale() { return scale; }, get pixelRatio() { return prOf(); }, get hz() { return Math.round(1000 / refreshMs); },
    capMs: 0, get stage() { return stage; }, get targetMs() { return target(); }, get costMs() { return ema; }, fps: 0, auto: !fixed, basePR,
    get max() { return max; }, get overrides() { return over; }, get hold() { return hold; }, set hold(v) { hold = !!v; }, get name() { return max ? 'MAX' : over ? 'Custom' : TIERS[tier].name; } };
  const commit = () => { apply(TIERS[tier], prOf(), stage, { max, over }); lastChange = performance.now(); win.length = 0; goodFor = 0; ema = 0; emaN = 0; okSince = performance.now(); };
  commit();
  // display refresh = typical shortest rAF interval over 90 steady frames, on its own rAF chain (the render loop may
  // be capped or uncapped, so its intervals say nothing about the screen)
  { let skip = 0, lastT = 0; const tick = (t) => { if (lastT) { const d = t - lastT; if (++skip > 30 && d < 40) probe.push(d); } lastT = t;
      if (probe.length >= 90) { probe.sort((a, b) => a - b); const p = probe[Math.floor(probe.length * 0.1)]; refreshMs = p < 7 ? 1000 / 144 : p < 10 ? 1000 / 120 : p < 13 ? 1000 / 90 : 1000 / 60; refreshKnown = true; return; }
      requestAnimationFrame(tick); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick); else refreshKnown = true; }
  let fpsAcc = 0, fpsN = 0;
  function ultraStep(cost, now) { // the Ultra lever controller; true = changed
    const T = target();
    if (now - lastCheck < 250 || emaN < 8) return false; lastCheck = now;
    if (cost > T * 1.06) { okSince = now;
      if (!over?.res && scale > ULTRA_FLOOR + 1e-3) { const over = cost / T; scale = Math.max(ULTRA_FLOOR, scale * Math.max(0.8, Math.min(0.97, 1 / Math.sqrt(over)))); return true; } // pixels ~ scale^2
      if (stage < 4 && now - lastChange > 500) { stage++; return true; }
      return false;
    }
    if (cost < T * 0.8) {
      if (now - okSince < 2500) return false; okSince = now;
      if (stage > 0) { stage--; return true; }
      if (!over?.res && scale < TIERS[tier].max - 1e-3) { scale = Math.min(TIERS[tier].max, scale + 0.04); return true; }
      return false;
    }
    okSince = now; return false;
  }
  st.frame = (dtMs, workMs = 0, gpuMs = 0) => {
    if (!(dtMs > 0) || dtMs > 250) return; // tab switch / hitch: ignore
    fpsAcc += dtMs; fpsN++; if (fpsAcc > 500) { st.fps = Math.round(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    if (!refreshKnown || max || hold) return;
    const now = performance.now();
    const cost = Math.max(workMs || 0, gpuMs || 0, (workMs || gpuMs) ? (dtMs > target() * 1.4 ? dtMs * 0.85 : 0) : dtMs);
    ema = emaN === 0 ? cost : ema * 0.85 + cost * 0.15; emaN++;
    if (isUltra()) { if (ultraStep(ema, now)) { const keep = ema, n = emaN; commit(); ema = keep * 0.9; emaN = n >> 1; }
      if (!st.auto) return;
      // Auto on Ultra with every lever pulled and still slow for 3 s: step down a tier like before
      if (!(stage >= 4 && scale <= ULTRA_FLOOR + 1e-3 && ema > target() * 1.2)) { win.length = 0; return; }
    }
    if (!st.auto) return;
    win.push(dtMs); if (win.length > 40) win.shift();
    if (win.length < 40 || now - lastChange < 1200) return;
    const avg = win.reduce((a, b) => a + b, 0) / win.length;
    if (avg > refreshMs * 1.2) { // missing frames: lower resolution first, then effects
      const t = TIERS[tier];
      if (!over?.res && scale > t.min + 1e-3 && !isUltra()) scale = Math.max(t.min, scale - (avg > refreshMs * 1.8 ? 0.15 : 0.07));
      else if (tier < TIERS.length - 1) { droppedFrom.set(tier, now); tier++; stage = 0; scale = Math.min(TIERS[tier].max, Math.max(TIERS[tier].min, scale)); }
      else return;
      commit();
    } else if (avg < refreshMs * 1.07) { // holding refresh rate: try a little more quality
      goodFor += win.length; win.length = 0;
      if (goodFor < 120) return;
      const t = TIERS[tier];
      if (!over?.res && scale < t.max - 1e-3) scale = Math.min(t.max, scale + 0.05);
      else if (tier > 0 && now - (droppedFrom.get(tier - 1) || -1e9) > 20000) { tier--; scale = TIERS[tier].min; }
      else return;
      commit();
    }
  };
  st.set = (name, overrides = null) => { // 'auto', a tier name, 'max'; overrides (videoOverrides) = 'custom' on that base
    name = String(name).toLowerCase();
    if (name === 'max') { st.auto = false; max = true; over = null; tier = 0; stage = 0; scale = 1; commit(); return; }
    const wasMax = max; max = false; const prevOver = over; over = overrides;
    if (name === 'auto') { st.auto = true; if (wasMax || prevOver || overrides) { stage = 0; commit(); } return; }
    const i = TIERS.findIndex(t => t.name.toLowerCase() === name); if (i < 0) return;
    st.auto = false; tier = i; stage = 0; scale = TIERS[i].max; commit();
  };
  st.setScale = (v) => { if (max) return; st.auto = false; scale = v; if (isUltra()) stage = 0; commit(); };
  st.reapply = () => commit();
  st.cycle = () => { const order = ['auto', ...TIERS.map(t => t.name.toLowerCase()), 'max']; const cur = max ? 'max' : st.auto ? 'auto' : TIERS[tier].name.toLowerCase(); st.set(order[(order.indexOf(cur) + 1) % order.length]); };
  return st;
}

// GPU time of a frame (EXT_disjoint_timer_query_webgl2): begin()/end() around the frame's GL work; .ms is the
// latest completed measurement (results arrive a few frames late; null when the extension is missing).
export function createGpuTimer(gl) {
  const ext = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) return { ms: 0, begin() {}, end() {}, ok: false };
  const pending = []; let cur = null, frame = 0, fresh = -1e9; let ms = 0;
  const t = { ok: true, get ms() { return frame - fresh < 30 ? ms : 0; }, // stale (no result for 30 frames) = unknown
    begin() { frame++; if (cur) return; if (pending.length > 6) { gl.deleteQuery(pending.shift()); } cur = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, cur); },
    end() { if (!cur) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(cur); cur = null;
      while (pending.length) { const q = pending[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; pending.shift();
        const v = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q);
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && v > 0 && v < 100) { ms = v; fresh = frame; } } } };
  return t;
}

// ---------------------------------------------------------------- static sun shadows
// The sun never moves and the shadow map holds only STATIC casters: it is re-rendered on demand (doors swinging,
// at most 8 Hz plus once when they stop; a thrown prop settling; late loads; culling changes; 8 s safety).
// Moving things (avatars, game pieces, money) never cast into it — they get blob shadows (createBlobShadows).
export function createShadowScheduler(renderer, { safetyMs = 8000, movingHz = 8 } = {}) {
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  let last = performance.now(), want = false, lastMove = 0, wasMoving = false;
  return {
    set movingHz(v) { movingHz = v; }, get movingHz() { return movingHz; },
    poke() { want = true; },
    tick(moving) {
      const now = performance.now();
      if (moving) { wasMoving = true; if (now - lastMove > 1000 / movingHz) { renderer.shadowMap.needsUpdate = true; lastMove = now; last = now; } return; }
      if (wasMoving) { wasMoving = false; want = true; } // final pose
      if (want || now - last > safetyMs) { renderer.shadowMap.needsUpdate = true; want = false; last = now; }
    },
  };
}

// ---------------------------------------------------------------- blob shadows for moving things
// One InstancedMesh (1 draw) of soft dark discs, each dropped onto the floor below an avatar by a Rapier ray
// (static colliders only) and faded/grown with height. Also: anything outside the static house (avatars,
// party/game content) that turns out to MOVE stops casting into the static sun shadow map.
export function createBlobShadows({ scene, phys, max = 24 }) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  // multiply-blended grey disc (white = no change): normal alpha blending of a dark decal barely darkens through the
  // N8AO/post chain here, multiply always does
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgb(100,100,100)'); gr.addColorStop(0.5, 'rgb(170,170,170)'); gr.addColorStop(1, 'rgb(255,255,255)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, mat, max); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
  im.name = 'blob-shadows'; im.renderOrder = 1; im.userData.keep = true; im.userData.noCull = true; im.userData.noProbe = true; im.userData.noPathTrace = true;
  scene.add(im);
  const R = phys.RAPIER, world = phys.world; const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FL = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  let avatars = []; const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  const watched = new Map(); // late, shadow-casting meshes -> last world position
  let scanAcc = 1e9, checkAcc = 0;
  function scan(onMoved) {
    avatars = scene.children.filter(o => o.name === 'avatar');
    for (const a of avatars) a.traverse(o => { if (o.isMesh && o.castShadow) { o.castShadow = false; onMoved?.(); } });
    for (const root of scene.children) {
      if (/^(piece:|shell)/.test(root.name || '') || root.name === 'avatar' || root.isLight) continue;
      root.traverse(o => { if (o.isMesh && o.castShadow && !watched.has(o)) watched.set(o, new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)); });
    }
  }
  function update(dt, onMoved) {
    scanAcc += dt; if (scanAcc > 1.5) { scanAcc = 0; scan(onMoved); }
    checkAcc += dt; if (checkAcc > 0.25) { checkAcc = 0;
      for (const [o, p] of watched) { _p.setFromMatrixPosition(o.matrixWorld); if (_p.distanceToSquared(p) > 1e-4 || !o.parent) { watched.delete(o); if (o.castShadow) { o.castShadow = false; onMoved?.(); } } } }
    let n = 0;
    for (const a of avatars) {
      if (n >= max) break; let vis = a.visible; for (let p = a.parent; p && vis; p = p.parent) vis = p.visible; if (!vis) continue;
      a.getWorldPosition(_p);
      ray.origin.x = _p.x; ray.origin.y = _p.y + 0.6; ray.origin.z = _p.z;
      let y = _p.y; let h = 0;
      try { const hit = world.castRay(ray, 3, true, FL); if (hit) { y = ray.origin.y - hit.timeOfImpact; h = Math.max(0, _p.y - y); } } catch {}
      if (h > 2.4) continue;
      const k = 1 - h / 2.4; const sz = (0.75 + h * 0.25) * (a.userData.pose === 'lie' ? 1.9 : 1);
      const fy = h < 0.2 ? Math.max(y, _p.y) : y; // collider tops can sit a few cm under the visible floor: never bury the blob
      _m.compose(_s.set(_p.x, fy + 0.025, _p.z), _q.identity(), _p.set(sz * (0.6 + 0.4 * k), 1, sz * (0.6 + 0.4 * k)));
      im.setMatrixAt(n, _m); n++;
    }
    im.count = n; if (n) im.instanceMatrix.needsUpdate = true;
  }
  return { mesh: im, update, get avatars() { return avatars.length; }, get watched() { return watched.size; } };
}

// ---------------------------------------------------------------- mirrors
function roomOf(x, y, z) {
  const lv = y < P.LEVELS[1].floor - 0.2 ? 0 : 1; let best = null, ba = Infinity;
  for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== lv) continue; const [x0, z0, x1, z1] = r.rect, m = 0.35;
    if (x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) { const a = (x1 - x0) * (z1 - z0); if (a < ba) { ba = a; best = id; } } }
  return best;
}
export function guardMirrors(scene, { maxDist = 7 } = {}) {
  const list = []; scene.updateMatrixWorld(true);
  let depth = 0; const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isReflector && !(o.onBeforeRender && o.getRenderTarget)) return;
    o.getWorldPosition(_p); const room = roomOf(_p.x, _p.y, _p.z); const r = room && P.ROOMS[room]; const pos = _p.clone();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
    const orb = o.onBeforeRender;
    o.onBeforeRender = function (rend, sc, cam, ...rest) {
      if (depth > 0) return; // no mirrors inside mirrors (each one is a full extra render of the house)
      cam.getWorldPosition(_c);
      if (_c.distanceTo(pos) > maxDist) return;
      if (_n.subVectors(_c, pos).dot(normal) < 0) return; // behind the mirror
      if (r) { const [x0, z0, x1, z1] = r.rect, m = 0.6; const lv = _c.y < P.LEVELS[1].floor - 0.2 ? 0 : 1;
        if (lv !== r.level || _c.x < x0 - m || _c.x > x1 + m || _c.z < z0 - m || _c.z > z1 + m) return; }
      depth++; try { orb.call(this, rend, sc, cam, ...rest); } finally { depth--; }
    };
    list.push({ obj: o, room });
  });
  return list;
}

// ---------------------------------------------------------------- light pool
export function createLightPool(scene, { points = 3, spots = 2 } = {}) {
  scene.updateMatrixWorld(true);
  const srcs = [];
  scene.traverse(o => { if ((o.isPointLight || o.isSpotLight) && !o.userData.pool && !o.userData.keepLight && !o.castShadow) srcs.push(o); });
  for (const s of srcs) {
    const wp = s.getWorldPosition(new THREE.Vector3());
    s.userData.pool = { level: wp.y < P.LEVELS[1].floor - 0.2 ? 0 : 1, room: roomOf(wp.x, wp.y, wp.z), wp, gate: s.visible };
    s.visible = false; // the source stays in the scene (its owner may animate it) but never renders itself
  }
  const mk = (type, n) => Array.from({ length: Math.min(n, srcs.filter(s => type === 'point' ? s.isPointLight : s.isSpotLight).length) }, () => {
    const l = type === 'point' ? new THREE.PointLight(0xffffff, 0, 1, 2) : new THREE.SpotLight(0xffffff, 0, 1, 0.5, 0.5, 2);
    l.castShadow = false; l.userData.pool = { slot: true }; l.userData.keepLight = true; scene.add(l); if (l.isSpotLight) scene.add(l.target);
    return { light: l, src: null, fade: 0 };
  });
  const slots = { point: mk('point', points), spot: mk('spot', spots) };
  // MAX / photo mode: a bigger pool (changing the light count recompiles every lit shader once — a one-off hitch)
  function resize(np, ns) {
    for (const [type, n] of [['point', np], ['spot', ns]]) {
      const list = slots[type], want = Math.min(n, srcs.filter(s => type === 'point' ? s.isPointLight : s.isSpotLight).length);
      while (list.length > want) { const sl = list.pop(); scene.remove(sl.light); if (sl.light.isSpotLight) scene.remove(sl.light.target); sl.light.dispose?.(); }
      if (list.length < want) list.push(...mk(type, want - list.length));
    }
    acc = 1;
  }
  const _c = new THREE.Vector3(), _t = new THREE.Vector3();
  const score = (s, pos, lv, room) => {
    const d = s.userData.pool.wp.distanceTo(pos), reach = s.distance > 0 ? s.distance : 12;
    let sc = Math.max(0, d - reach * 0.6) + d * 0.15;
    if (s.userData.pool.level !== lv) sc += 8; if (room && s.userData.pool.room === room) sc -= 3;
    return sc;
  };
  function assign(pos, instant = false) {
    const lv = pos.y < P.LEVELS[1].floor - 0.2 ? 0 : 1; const room = roomOf(pos.x, pos.y, pos.z);
    for (const [type, list] of Object.entries(slots)) {
      if (!list.length) continue;
      const cands = srcs.filter(s => (type === 'point' ? s.isPointLight : s.isSpotLight) && s.parent).map(s => [score(s, pos, lv, room), s]).sort((a, b) => a[0] - b[0]);
      const want = cands.slice(0, list.length).filter(([sc]) => sc < 14).map(([, s]) => s);
      const keep = new Set(list.filter(sl => sl.src && want.includes(sl.src)).map(sl => sl.src));
      const add = want.filter(s => !keep.has(s));
      for (const sl of list) { if (sl.src && !want.includes(sl.src)) { sl.src = add.shift() || null; sl.fade = instant ? 1 : 0; } else if (!sl.src && add.length) { sl.src = add.shift(); sl.fade = instant ? 1 : 0; } }
    }
  }
  let acc = 1;
  function update(dt, camPos, noAssign) {
    if (!noAssign) { acc += dt; if (acc > 0.25) { acc = 0; assign(camPos); } }
    for (const list of Object.values(slots)) for (const sl of list) {
      const l = sl.light, s = sl.src;
      if (!s) { l.intensity = 0; continue; }
      sl.fade = Math.min(1, sl.fade + dt / 0.35);
      s.updateWorldMatrix(true, false); l.position.setFromMatrixPosition(s.matrixWorld); s.userData.pool.wp.copy(l.position);
      l.color.copy(s.color); l.distance = s.distance; l.decay = s.decay;
      l.intensity = s.intensity * sl.fade * (s.userData.pool.gate === false ? 0 : 1);
      if (l.isSpotLight) { l.angle = s.angle; l.penumbra = s.penumbra; s.target.updateWorldMatrix(true, false); l.target.position.setFromMatrixPosition(s.target.matrixWorld); l.target.updateMatrixWorld(); }
    }
  }
  let lastPos = new THREE.Vector3();
  // run fn with the pool lit for another position (probe capture), then put the viewer's lights back untouched
  function around(pos, fn) {
    const saved = []; for (const list of Object.values(slots)) for (const sl of list) saved.push([sl, sl.src, sl.fade]);
    assign(pos, true); update(0, pos, true);
    try { fn(); } finally { for (const [sl, src, fade] of saved) { sl.src = src; sl.fade = fade; } update(0, lastPos, true); }
  }
  const upd = update;
  function updateTracked(dt, camPos, internal) { if (!internal) lastPos.copy(camPos); upd(dt, camPos); }
  return { sources: srcs.length, slots, assign, update: updateTracked, around, resize, get size() { return [slots.point.length, slots.spot.length]; }, snap(pos) { lastPos.copy(pos); assign(pos, true); upd(0, pos); } };
}

// ---------------------------------------------------------------- flat faint glass: one pass instead of two
// three.js draws a transparent DoubleSide material in TWO passes (back faces, then front faces) and flips
// material.side + needsUpdate between them, so every such draw re-derives the shader program key (getParameters +
// getProgram) twice, in every scene render (N8AO renders the scene 3x per frame): ~1 ms CPU/frame at the pool.
// For a FLAT pane (every mesh using the material is a single plane: geometry thinner than 1 mm) each pixel only ever
// sees one face, so one pass draws exactly the same image. Glass with depth (boxes, bottles, merged panes) keeps the
// two-pass sort. Faint (opacity <= 0.4), depth-write-off only. Idempotent; main.js runs it after load and late loads.
export function singlePassFaintGlass(scene, maxOpacity = 0.4) {
  const ok = new Map(); const _s = new THREE.Vector3();
  scene.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) {
    if (!m || m.forceSinglePass || !m.transparent || m.side !== THREE.DoubleSide || m.depthWrite !== false || m.opacity > maxOpacity || m.isShaderMaterial) continue;
    let flat = false; const g = o.geometry;
    if (o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && g?.attributes?.position) { if (!g.boundingBox) g.computeBoundingBox(); g.boundingBox.getSize(_s); flat = Math.min(_s.x, _s.y, _s.z) < 0.001; }
    ok.set(m, (ok.get(m) ?? true) && flat);
  } });
  let n = 0; for (const [m, flat] of ok) if (flat) { m.forceSinglePass = true; n++; }
  // shared glass (e.g. kit M.glass on window panes AND on decanters/jars): the flat panes get a one-pass twin of the
  // material, so only the solid pieces keep the two-pass flip (each flip re-derives the program key: ~5 us a draw).
  // The twin shares the hooks/userData and copies the base's mutable values before each draw (onBeforeRender).
  scene.traverse(o => {
    const m = o.material; if (!o.isMesh || !m || Array.isArray(m) || !ok.has(m) || ok.get(m) || o.userData.glassTwin) return;
    if (o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); g.boundingBox.getSize(_s); if (Math.min(_s.x, _s.y, _s.z) >= 0.001) return;
    let v = TWINS.get(m); if (!v) { v = m.clone(); v.onBeforeCompile = m.onBeforeCompile; v.customProgramCacheKey = m.customProgramCacheKey; v.userData = m.userData; v.forceSinglePass = true; TWINS.set(m, v); }
    o.material = v; o.userData.glassTwin = m; o.onBeforeRender = twinSync; n++;
  });
  return n;
}
const TWINS = new WeakMap();
const TWIN_KEYS = ['envMap', 'envMapIntensity', 'opacity', 'roughness', 'metalness', 'specularIntensity', 'ior', 'transmission', 'thickness', 'emissiveIntensity', 'depthWrite', 'depthTest', 'transparent', 'toneMapped', 'visible', 'map', 'alphaMap', 'normalMap', 'roughnessMap'];
function twinSync() { // this = the mesh; keep the twin equal to its base material (base may be retuned at runtime: sky, probes)
  const b = this.userData.glassTwin, v = this.material; if (!b || v === b) return;
  for (let i = 0; i < TWIN_KEYS.length; i++) { const k = TWIN_KEYS[i]; if (v[k] !== b[k] && b[k] !== undefined) { const st = k === 'map' || k === 'alphaMap' || k === 'normalMap' || k === 'roughnessMap' || k === 'transparent'; v[k] = b[k]; if (st) v.needsUpdate = true; } }
  if (!v.color.equals(b.color)) v.color.copy(b.color); if (b.emissive && !v.emissive.equals(b.emissive)) v.emissive.copy(b.emissive);
  if (b.specularColor && !v.specularColor.equals(b.specularColor)) v.specularColor.copy(b.specularColor);
}

// ---------------------------------------------------------------- N8AO transparency passes without full-scene walks
// N8AO (transparencyAware) re-renders the scene twice per frame (depth-write-off and depth-write-on transparents).
// Its stock renderTransparency does 4 scene.traverse() calls + a Map over all ~5k objects, and each of the two
// renders walks every object again (projectObject) just to skip the hidden opaque ones. This keeps the exact same
// selection rules and visibility (own flag, ancestors, culler layers) but renders only the selected objects plus the
// lights: the scene's children are swapped for that short list for the two renders (same Scene object, so the
// renderer's per-scene light state is shared and no program keys change). The candidate list (objects with a
// transparent material or cannotReceiveAO, every light) is refreshed every 30 frames; the tests run per frame.
// Must run with scene.matrixWorldAutoUpdate off (matrices are already current); it enforces that around its renders.
export function fastN8Transparency(n8) {
  if (!n8 || typeof n8.renderTransparency !== 'function') return false;
  // cand: objects that may pass a transparency test (transparent single material, or cannotReceiveAO); lights: all.
  // Refreshed every 30 frames; the tests themselves run per frame, so a material turning opaque drops out at once.
  let cand = [], lights = [], age = 1e9; const sel = [], selSet = new Set(), hidden = [], black = new THREE.Color(0, 0, 0), _c = new THREE.Color();
  const maybe = (i) => !!(i.material.transparent || i.userData.cannotReceiveAO);
  // stock rule: an object renders if it and every ancestor is visible, where each material-bearing ancestor also has
  // to pass the pass's test (stock hides every material object that fails it, which hides its subtree)
  const chainOk = (o, root, test) => { if (!o.visible) return false; for (let p = o.parent; p && p !== root; p = p.parent) if (!p.visible || (p.material && !test(p))) return false; return true; };
  const notUnderSel = (o, root) => { for (let p = o.parent; p && p !== root; p = p.parent) if (selSet.has(p)) return false; return true; };
  n8.renderTransparency = function (e) {
    const S = this.scene;
    if (++age > 30) { age = 0; cand = []; lights = []; S.traverse(i => { if (i.isLight) lights.push(i); else if (i.material && maybe(i)) cand.push(i); }); }
    const bg = S.background, cc = e.getClearColor(_c).clone(), ca = e.getClearAlpha(), acd = e.autoClearDepth, kids = S.children, mwa = S.matrixWorldAutoUpdate;
    const lightsNow = lights.filter(l => l.parent && chainOk(l, S, () => true));
    const pass = (test) => {
      sel.length = 0; selSet.clear();
      for (let k = 0; k < cand.length; k++) { const i = cand[k]; if (i.parent && test(i) && chainOk(i, S, test)) { sel.push(i); selSet.add(i); } }
      const list = sel.filter(i => notUnderSel(i, S));
      // descendants of picked objects that fail the test: hidden like stock does (rare: e.g. a lamp inside a glass shade)
      for (const o of list) if (o.children.length) o.traverse(c => { if (c !== o && c.material && c.visible && !test(c)) { c.visible = false; hidden.push(c); } });
      S.children = lightsNow.concat(list);
      try { e.clear(true, true, true); this.depthCopyPass.render(e); e.render(S, this.camera); }
      finally { S.children = kids; for (const c of hidden) c.visible = true; hidden.length = 0; }
    };
    try {
      S.background = null; S.matrixWorldAutoUpdate = false; e.autoClearDepth = false; e.setClearColor(black, 0);
      this.depthCopyPass.material.uniforms.depthTexture.value = this.beautyRenderTarget ? this.beautyRenderTarget.depthTexture : this.depthTexture; // N8AOPass vs N8AOPostPass
      this.depthCopyPass.material.uniforms.reverseDepthBuffer.value = this.configuration.depthBufferType === 3; // n8ao enum {Default:1, Log:2, Reverse:3}
      e.setRenderTarget(this.transparencyRenderTargetDWFalse);
      pass(i => !!(i.material.transparent && !i.material.depthWrite && !i.userData.treatAsOpaque || i.userData.cannotReceiveAO));
      e.setRenderTarget(this.transparencyRenderTargetDWTrue);
      pass(i => !!(i.material.transparent && i.material.depthWrite && !i.userData.treatAsOpaque));
    } finally {
      S.children = kids; e.setClearColor(cc, ca); S.background = bg; e.autoClearDepth = acd; S.matrixWorldAutoUpdate = mwa;
    }
  };
  return true;
}

// ---------------------------------------------------------------- dynamic props -> BatchedMesh
// Throwable props (pillows, books, vases, balls…) can't be merged because physics moves them, so each was its
// own draw call (~450 in the house). Here every prop mesh becomes an instance in a per-material BatchedMesh
// (one multi-draw per material); the original mesh stays in the scene, invisible, as the physics proxy, and
// its world matrix is copied to the batch while its body is awake.
export function batchDynamics(scene, phys) {
  scene.updateMatrixWorld(true);
  const groups = new Map(); const tracked = [];
  for (const d of phys.dynamics) {
    d.obj.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh || o.morphTargetInfluences || !o.visible || Array.isArray(o.material)) return;
      let p = o; while (p && p !== d.obj) { if (!p.visible) return; p = p.parent; }
      const m = o.material; if (!m || m.transparent || m.isShaderMaterial) return;
      const g = o.geometry; if (!g?.attributes?.position || Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute)) return;
      const attrs = Object.keys(g.attributes).sort().join(','); const key = m.uuid + '|' + attrs + '|' + (g.index ? 'i' : 'n');
      if (!groups.has(key)) groups.set(key, { mat: m, items: [], geos: new Map(), cast: false });
      const G = groups.get(key); G.items.push({ o, d }); G.cast ||= o.castShadow;
      if (!G.geos.has(g.uuid)) G.geos.set(g.uuid, g);
    });
  }
  const batches = [];
  for (const G of groups.values()) {
    if (G.items.length < 2) continue;
    let nv = 0, ni = 0; for (const g of G.geos.values()) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
    const b = new THREE.BatchedMesh(G.items.length, nv, Math.max(ni, 1), G.mat);
    b.name = 'props:batch'; b.castShadow = G.cast; b.receiveShadow = true; b.frustumCulled = false; b.perObjectFrustumCulled = true;
    b.userData.noProbe = true; b.userData.keep = true;
    const gid = new Map(); for (const [u, g] of G.geos) gid.set(u, b.addGeometry(g));
    for (const it of G.items) { const id = b.addInstance(gid.get(it.o.geometry.uuid)); b.setMatrixAt(id, it.o.matrixWorld); it.o.visible = false; tracked.push({ b, id, o: it.o, d: it.d }); }
    scene.add(b); batches.push(b);
  }
  // the hidden proxies must still be skipped by probes/merging (they are under dynamic objects already)
  return {
    batches: batches.length, instances: tracked.length, tracked, // tracked: cull.js hides instances in unseen rooms
    // photo mode (path tracer) wants plain meshes: show the proxies, hide the batches (and back)
    plain(on) { for (const b of batches) b.visible = !on; for (const t of tracked) t.o.visible = !!on; },
    sync(force = false) {
      for (const t of tracked) {
        if (t.d.dead) continue;
        if (!force && t.d.body.isSleeping()) continue;
        t.o.updateWorldMatrix(true, false); t.b.setMatrixAt(t.id, t.o.matrixWorld);
      }
    },
  };
}
