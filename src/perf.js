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
  const st = { get tier() { return TIERS[tier]; }, get tierIndex() { return tier; }, get scale() { return scale; }, get pixelRatio() { return basePR * scale; }, get hz() { return Math.round(1000 / refreshMs); },
    capMs: 0, get stage() { return stage; }, get targetMs() { return target(); }, get costMs() { return ema; }, fps: 0, auto: !fixed, basePR };
  const commit = () => { apply(TIERS[tier], basePR * scale, stage); lastChange = performance.now(); win.length = 0; goodFor = 0; ema = 0; emaN = 0; okSince = performance.now(); };
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
      if (scale > ULTRA_FLOOR + 1e-3) { const over = cost / T; scale = Math.max(ULTRA_FLOOR, scale * Math.max(0.8, Math.min(0.97, 1 / Math.sqrt(over)))); return true; } // pixels ~ scale^2
      if (stage < 4 && now - lastChange > 500) { stage++; return true; }
      return false;
    }
    if (cost < T * 0.8) {
      if (now - okSince < 2500) return false; okSince = now;
      if (stage > 0) { stage--; return true; }
      if (scale < TIERS[tier].max - 1e-3) { scale = Math.min(TIERS[tier].max, scale + 0.04); return true; }
      return false;
    }
    okSince = now; return false;
  }
  st.frame = (dtMs, workMs = 0, gpuMs = 0) => {
    if (!(dtMs > 0) || dtMs > 250) return; // tab switch / hitch: ignore
    fpsAcc += dtMs; fpsN++; if (fpsAcc > 500) { st.fps = Math.round(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    if (!refreshKnown) return;
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
      if (scale > t.min + 1e-3 && !isUltra()) scale = Math.max(t.min, scale - (avg > refreshMs * 1.8 ? 0.15 : 0.07));
      else if (tier < TIERS.length - 1) { droppedFrom.set(tier, now); tier++; stage = 0; scale = Math.min(TIERS[tier].max, Math.max(TIERS[tier].min, scale)); }
      else return;
      commit();
    } else if (avg < refreshMs * 1.07) { // holding refresh rate: try a little more quality
      goodFor += win.length; win.length = 0;
      if (goodFor < 120) return;
      const t = TIERS[tier];
      if (scale < t.max - 1e-3) scale = Math.min(t.max, scale + 0.05);
      else if (tier > 0 && now - (droppedFrom.get(tier - 1) || -1e9) > 20000) { tier--; scale = TIERS[tier].min; }
      else return;
      commit();
    }
  };
  st.set = (name) => { // 'auto' or a tier name
    if (name === 'auto') { st.auto = true; return; }
    const i = TIERS.findIndex(t => t.name.toLowerCase() === String(name).toLowerCase()); if (i < 0) return;
    st.auto = false; tier = i; stage = 0; scale = TIERS[i].max; commit();
  };
  st.setScale = (v) => { st.auto = false; scale = v; if (isUltra()) stage = 0; commit(); };
  st.cycle = () => { const order = ['auto', ...TIERS.map(t => t.name.toLowerCase())]; const cur = st.auto ? 'auto' : TIERS[tier].name.toLowerCase(); st.set(order[(order.indexOf(cur) + 1) % order.length]); };
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
  return { sources: srcs.length, slots, assign, update: updateTracked, around, snap(pos) { lastPos.copy(pos); assign(pos, true); upd(0, pos); } };
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
        if (!force && t.d.body.isSleeping()) continue;
        t.o.updateWorldMatrix(true, false); t.b.setMatrixAt(t.id, t.o.matrixWorld);
      }
    },
  };
}
