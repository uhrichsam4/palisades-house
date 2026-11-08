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

export function createQuality({ renderer, apply, initial = 'auto', basePR = Math.min(devicePixelRatio || 1, 2) }) {
  const fixed = initial !== 'auto';
  let tier = fixed ? Math.max(0, TIERS.findIndex(t => t.name.toLowerCase() === initial)) : 1;
  let scale = fixed ? TIERS[tier].max : 0.8;
  let refreshMs = 1000 / 60, refreshKnown = false; const probe = [];
  const win = []; let goodFor = 0, lastChange = 0, droppedFrom = new Map();
  const st = { get tier() { return TIERS[tier]; }, get tierIndex() { return tier; }, get scale() { return scale; }, get pixelRatio() { return basePR * scale; }, get hz() { return Math.round(1000 / refreshMs); }, fps: 0, auto: !fixed, basePR };
  const commit = () => { apply(TIERS[tier], basePR * scale); lastChange = performance.now(); win.length = 0; goodFor = 0; };
  commit();
  let fpsAcc = 0, fpsN = 0;
  st.frame = (dtMs) => {
    if (!(dtMs > 0) || dtMs > 250) return; // tab switch / hitch: ignore
    fpsAcc += dtMs; fpsN++; if (fpsAcc > 500) { st.fps = Math.round(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    if (!refreshKnown) { // display refresh = the typical shortest interval over the first frames
      probe.push(dtMs); if (probe.length >= 90) { probe.sort((a, b) => a - b); const p = probe[Math.floor(probe.length * 0.1)]; refreshMs = p < 7 ? 1000 / 144 : p < 10 ? 1000 / 120 : p < 13 ? 1000 / 90 : 1000 / 60; refreshKnown = true; }
      return;
    }
    if (!st.auto) return;
    win.push(dtMs); if (win.length > 40) win.shift();
    const now = performance.now(); if (win.length < 40 || now - lastChange < 1200) return;
    const avg = win.reduce((a, b) => a + b, 0) / win.length;
    if (avg > refreshMs * 1.2) { // missing frames: lower resolution first, then effects
      const t = TIERS[tier];
      if (scale > t.min + 1e-3) scale = Math.max(t.min, scale - (avg > refreshMs * 1.8 ? 0.15 : 0.07));
      else if (tier < TIERS.length - 1) { droppedFrom.set(tier, now); tier++; scale = Math.min(TIERS[tier].max, Math.max(TIERS[tier].min, scale)); }
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
    st.auto = false; tier = i; scale = TIERS[i].max; commit();
  };
  st.setScale = (v) => { st.auto = false; scale = v; commit(); };
  st.cycle = () => { const order = ['auto', ...TIERS.map(t => t.name.toLowerCase())]; const cur = st.auto ? 'auto' : TIERS[tier].name.toLowerCase(); st.set(order[(order.indexOf(cur) + 1) % order.length]); };
  return st;
}

// ---------------------------------------------------------------- on-demand shadows
export function createShadowScheduler(renderer, { safetyMs = 3000 } = {}) {
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  let last = performance.now(), want = false, lastMove = 0;
  return {
    poke() { want = true; },
    tick(moving) {
      const now = performance.now();
      if (moving) { // moving casters: refresh at most ~40 Hz (each refresh redraws every caster)
        if (now - lastMove > 24) { renderer.shadowMap.needsUpdate = true; lastMove = now; last = now; }
        return;
      }
      if (want || now - last > safetyMs) { renderer.shadowMap.needsUpdate = true; want = false; last = now; } // late model loads etc.
    },
  };
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
    batches: batches.length, instances: tracked.length,
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
