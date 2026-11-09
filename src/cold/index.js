// Body temperature, room air temperature, weather blowing in through open/broken openings, pool ice (2026-11-08).
// Started from multiplayer.js (`api.cold = startCold(ctx, api)`); works solo. ?cold=0 turns it off.
//
// Room model (3 Hz): each plan.js room's air drifts toward 21 °C (heating) and toward the outdoor __sky.feelsC by an
// exposure E = Σ over EXTERIOR openings of that room that let air through (open windows/doors, broken glass,
// broken wall panels) of area · openness · (0.25 + facing) · (0.3 + wind) · (0.4 + severity), where
// facing = max(0, windDir · −normal) (blizzards count every opening as ≥ 0.6 facing).
// Body warmth (local player, 0..100) drifts down when the air where you are (outdoors feelsC, room temp, or water)
// is below 18 °C — faster when wet / windy / in cold water — and recovers when warm, near the family-room fire or
// in the hot spa. Levels: OK, COLD (<60), FREEZING (<30, slower), FROZEN (0, heavy slowdown + white-out until > 15).
// Effects: TEMP/BODY chips, frost vignette, breath puffs (< 5 °C, everyone), shiver jitter (level synced to peers),
// teeth chatter. Weather blowing in, floor patches and wind whistle: fx.js. Pool / spa ice: ice.js.
// Network: api.channel('cold') — {k:'s', l} shiver level, {k:'h', b, c, x, z} ice holes, {k:'all'} for late joiners.
//
// window.__cold: roomTemp(id), bodyTemp (0..100), level, airTemp, wet, exposure(id), emitters, ice (info),
//   set({ body, wet, room: {id: °C}, ice: cm | {pool, spa} }), breakIce(name, x, z), stats()
import * as THREE from 'three';
import * as P from '../plan.js';
import { createIce, THICK } from './ice.js';
import { createOverlay, createBreath, createBlowIn, createPatches, createAudio } from './fx.js';

const HEAT = 21, COMFORT = 18, FIRE = [2.95, 0.7, 16.8];
const LEVELS = ['ok', 'cold', 'freezing', 'frozen'];

export function startCold(ctx, api) {
  if (ctx.shot || new URLSearchParams(location.search).get('cold') === '0') return null;
  const { player, scene, camera } = ctx; const st = player.state;
  const ch = api?.channel ? api.channel('cold') : { send() {} };
  const rooms = Object.entries(P.ROOMS).filter(([, r]) => !r.outdoor);
  const roomT = new Map(rooms.map(([id]) => [id, HEAT])), expo = new Map();
  function roomAt(x, y, z) { const level = y > 2.6 ? 1 : 0; let best = null, ba = Infinity; for (const [id, r] of Object.entries(P.ROOMS)) { if (r.level !== level) continue; const [x0, z0, x1, z1] = r.rect; if (x > x0 - 0.05 && x < x1 + 0.05 && z > z0 - 0.05 && z < z1 + 0.05) { const a = (x1 - x0) * (z1 - z0); if (a < ba) { ba = a; best = id; } } } return best && !P.ROOMS[best].outdoor ? best : null; }
  const extCache = new Map();
  function isExterior(rec) { // the point just outside the opening is not inside any (indoor) room
    if (!rec.room || !rec.normal || !P.ROOMS[rec.room] || P.ROOMS[rec.room].outdoor) return false;
    let v = extCache.get(rec.id); if (v !== undefined) return v; const lv = P.ROOMS[rec.room].level; const y = P.LEVELS[lv].floor + 1;
    v = !roomAt(rec.pos[0] + rec.normal[0] * 0.7, y, rec.pos[2] + rec.normal[2] * 0.7); extCache.set(rec.id, v); return v;
  }
  const sky = () => window.__sky || { tempC: 18, feelsC: 18, severity: 0, precip: 'none', precipAmount: 0, wind: 0, windDir: new THREE.Vector2(1, 0), weather: 'clear' };
  const outsideT = () => sky().feelsC;

  // ---------------------------------------------------------------- fx
  const overlay = createOverlay(), breath = createBreath(scene), blow = createBlowIn(scene), patches = createPatches(scene), audio = createAudio(camera);
  const ice = createIce(ctx, { send: (m) => ch.send(m), sound: (k, p) => audio.play(k, p), onFall: () => { body = Math.max(0, body - 12); wet = 1; } });

  // ---------------------------------------------------------------- room model + emitters (3 Hz)
  let emitters = [], slowAcc = 0.34, propAcc = 0;
  const _wd = new THREE.Vector2();
  function slow(dt) {
    const S = sky(), B = window.__building; const wind = S.wind || 0, sev = S.severity || 0, blizzard = S.weather === 'blizzard';
    _wd.copy(S.windDir || _wd.set(1, 0)); const out = outsideT();
    for (const [id] of rooms) expo.set(id, 0);
    const em = [];
    const precipK = S.precip === 'none' ? 0 : S.precipAmount || 0;
    const consider = (rec, open) => {
      if (open <= 0.05 || !isExterior(rec)) return;
      const facing = Math.max(blizzard ? 0.6 : 0, _wd.x * -rec.normal[0] + _wd.y * -rec.normal[2]);
      const E = rec.area * open * (0.25 + facing) * (0.3 + wind) * (0.4 + sev); expo.set(rec.room, (expo.get(rec.room) || 0) + E);
      if ((precipK > 0.1 || wind * sev > 0.3) && facing > 0.05) {
        const lv = P.ROOMS[rec.room].level; const w = Math.min(2.6, Math.sqrt(rec.area) * 1.15), h = Math.max(0.6, rec.area / w);
        const d = camera.position.distanceTo(_v.set(rec.pos[0], rec.pos[1], rec.pos[2])); if (d > 30) return;
        em.push({ id: rec.id, pos: rec.pos, nx: rec.normal[0], nz: rec.normal[2], w, h: Math.min(h, 2.2) * 0.9, snow: S.precip === 'snow', floorY: P.LEVELS[lv].floor, room: rec.room,
          wx: _wd.x * (1 + 6 * wind), wz: _wd.y * (1 + 6 * wind), speed: 1.2 + 5 * wind * facing, reach: 1.2 + 3.2 * wind * facing, rate: Math.min(220, (20 + 160 * Math.max(precipK, 0.3)) * open * facing * Math.min(2, rec.area / 2)), strength: open * facing * (0.3 + wind) * Math.min(1.5, rec.area / 2), d, precip: precipK > 0.1 });
      }
    };
    if (B) { for (const rec of B.openings.values()) { if (rec.type === 'doorway') continue; consider(rec, rec.broken ? 1 : rec.open); } for (const h of B.holes) consider(h, 1); }
    em.sort((a, b) => a.d - b.d); emitters = em.slice(0, 6);
    for (const [id] of rooms) { const E = expo.get(id) || 0, T = roomT.get(id); const kH = 0.012, kO = 0.025 * E; const Teq = (kH * HEAT + kO * out) / (kH + kO); roomT.set(id, T + (Teq - T) * Math.min(1, (kH + kO) * dt)); }
    // floor patches grow where precip lands inside
    for (const e of emitters) { if (!e.precip) continue; const hits = blow.hits.get(e.id) || 0; blow.hits.set(e.id, 0); patches.touch(e, e.snow ? 'snow' : 'wet', Math.min(0.05, hits * 0.0012 + e.strength * 0.004)); }
    ice.step(S.tempC, dt);
  }
  const _v = new THREE.Vector3();
  // small wind gusts on light dynamic props just inside windward openings
  function gusts() {
    const S = sky(); if ((S.wind || 0) * (S.severity || 0) < 0.4) return; const R = ctx.phys.RAPIER, world = ctx.phys.world;
    for (const e of emitters) { const c = { x: e.pos[0] - e.nx * 1.5, y: e.floorY + 0.8, z: e.pos[2] - e.nz * 1.5 };
      world.intersectionsWithShape(c, { x: 0, y: 0, z: 0, w: 1 }, new R.Ball(1.6), (col) => { const b = col.parent(); if (b && b.isDynamic() && b.mass() < 4 && b !== player.body) { const m = b.mass(), k = m * (0.3 + Math.random() * 0.6) * S.wind * e.strength; try { b.applyImpulse({ x: -e.nx * k + e.wx * 0.04 * m, y: k * 0.25, z: -e.nz * k + e.wz * 0.04 * m }, true); } catch {} } return true; }); }
  }

  // ---------------------------------------------------------------- body
  let body = 100, wet = 0, level = 0, frozenLatch = false, air = 18, where = null, breathT = 0, sendT = 0, sentLevel = -1, chatT = 0;
  function waterTemp(w) { const S = sky(); const iced = ice.sheets.find(s => s.w === w)?.shown; if (w?.name === 'spa' && !iced) return 38; if (iced || S.tempC < 4) return Math.max(0.5, S.tempC * 0.25 + 2); return Math.max(20, S.tempC + 4); }
  function bodyStep(dt) {
    const S = sky(), p = st.pos; where = roomAt(p.x, p.y, p.z); const outdoor = !where;
    air = outdoor ? S.feelsC : roomT.get(where);
    let A = air, mult = 1;
    if (st.inWater && st.water) { A = waterTemp(st.water); mult = A < COMFORT ? 3 : 1; wet = 1; }
    if (outdoor && S.precip === 'rain') wet = Math.min(1, wet + (S.precipAmount || 0) * dt * 0.15);
    if (outdoor && S.precip === 'snow') wet = Math.min(1, wet + (S.precipAmount || 0) * dt * 0.04);
    if (!st.inWater) wet = Math.max(0, wet - dt / (A > 15 ? 45 : 150));
    let d = 0;
    if (A < COMFORT) d -= 0.035 * (COMFORT - A) * (1 + 1.5 * wet + (outdoor ? (S.wind || 0) * 1.2 : 0)) * mult;
    else d += 1.2 + Math.min(4, (A - COMFORT) * 0.15);
    if (!outdoor && Math.hypot(p.x - FIRE[0], p.z - FIRE[2]) < 3.5 && p.y < 2) d = Math.max(d, 0) + 5;
    if (st.inWater && st.water?.name === 'spa' && A > 30) d = Math.max(d, 0) + 6;
    body = THREE.MathUtils.clamp(body + d * dt, 0, 100);
    if (body <= 0) frozenLatch = true; else if (body > 15) frozenLatch = false;
    level = frozenLatch ? 3 : body < 30 ? 2 : body < 60 ? 1 : 0;
    st.speedMul = level === 3 ? 0.25 : level === 2 ? 0.7 : 1;
    // thick ice: glide (low friction)
    const oi = ice.onIce; if (oi && oi.h >= THICK && st.grounded && st.push && Math.hypot(st.vel.x, st.vel.z) > 0.9) { st.push.x += st.vel.x * dt * 3; st.push.z += st.vel.z * dt * 3; const pl = Math.hypot(st.push.x, st.push.z); if (pl > 3) { st.push.x *= 3 / pl; st.push.z *= 3 / pl; } }
    // breath puffs (everyone: local here, remotes below)
    breathT -= dt; if (breathT <= 0) { breathT = 2.4 + Math.random() * 0.8; if (air < 5 && !st.swimming) mouthPuff(p, st.facing ?? st.yaw, Math.min(1, (5 - air) / 10 + 0.4));
      if (api?.peers) for (const r of api.peers.values()) { const ra = airAt(r.pos); if (ra < 5 && !r.swimming) mouthPuff(r.pos, r.yaw, Math.min(1, (5 - ra) / 10 + 0.4)); } }
    // chatter
    if (level >= 1) { chatT -= dt; if (chatT <= 0) { chatT = level === 1 ? 4 + Math.random() * 3 : 1.6 + Math.random(); audio.chatter(level === 1 ? 0.4 : 0.9); } }
    // HUD
    const showT = air < 12 || body < 99.5;
    overlay.set({ frost: THREE.MathUtils.clamp((75 - body) / 75, 0, 1), white: level === 3 ? 0.8 : body < 8 ? (8 - body) / 8 * 0.4 : 0, temp: showT ? Math.round(st.inWater && st.water ? waterTemp(st.water) : air) : null, body: level ? LEVELS[level].toUpperCase() : (body < 99.5 ? 'OK' : ''), level: LEVELS[level] });
    // sync shiver level
    sendT -= dt; if (level !== sentLevel || sendT <= 0) { sentLevel = level; sendT = 5; ch.send({ k: 's', l: level }); }
  }
  function airAt(pos) { const r = roomAt(pos.x, pos.y, pos.z); return r ? roomT.get(r) : outsideT(); }
  function mouthPuff(pos, yaw, k) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); breath.puff(pos.x + fx * 0.14, pos.y + 1.7, pos.z + fz * 0.14, fx, fz, k); }

  // ---------------------------------------------------------------- shiver
  const peerLevel = new Map();
  const AMP = [0, 0.006, 0.013, 0.022];
  function shiver(root, lv, t, seed) { if (!lv || !root?.visible) return; const a = AMP[lv]; root.position.x += Math.sin(t * 61 + seed) * a; root.position.z += Math.cos(t * 53 + seed * 2) * a; root.position.y += Math.sin(t * 47 + seed) * a * 0.4; root.rotation.y += Math.sin(t * 39 + seed) * a * 2; }

  // ---------------------------------------------------------------- network
  ch.onMessage = (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (m.k === 's' && Number.isInteger(m.l)) peerLevel.set(from, Math.max(0, Math.min(3, m.l)));
    else if (m.k === 'h') ice.applyNet(m);
    else if (m.k === 'all') { ice.applySnapshot(m.h); if (Number.isInteger(m.l)) peerLevel.set(from, m.l); }
  };
  api?.onPeerJoin?.((id) => { ch.send({ k: 'all', h: ice.snapshot(), l: level }, id); });
  api?.onPeerLeave?.((id) => peerLevel.delete(id));

  // ---------------------------------------------------------------- per frame
  let T = 0, whistleAcc = 0;
  const update = (dt) => {
    dt = Math.min(dt, 0.1); T += dt;
    slowAcc += dt; if (slowAcc >= 0.33) { slow(slowAcc); slowAcc = 0; }
    propAcc += dt; if (propAcc >= 0.5) { propAcc = 0; if (emitters.length) gusts(); }
    bodyStep(dt);
    ice.update(dt);
    if (emitters.length || blow.live) blow.update(dt, emitters);
    breath.update(dt);
    if (patches.map.size) patches.update(dt);
    whistleAcc += dt; if (whistleAcc > 0.25) { whistleAcc = 0; let lvl = 0; for (const e of emitters) lvl += e.strength / (1 + e.d * e.d * 0.12); audio.whistle(Math.min(1, lvl), sky().wind || 0); }
    shiver(player.creature?.root, level, T, 1.3);
    if (api?.peers) for (const [id, r] of api.peers) shiver(r.creature?.root, peerLevel.get(id) | 0, T, id.length * 1.7);
  };
  update.__src = 'cold'; ctx.onUpdate(update);

  const C = window.__cold = {
    roomTemp: (id) => (roomT.has(id) ? +roomT.get(id).toFixed(2) : null),
    get bodyTemp() { return +body.toFixed(2); }, get level() { return LEVELS[level]; }, get airTemp() { return +air.toFixed(2); }, get wet() { return +wet.toFixed(2); }, get where() { return where; },
    exposure: (id) => +(expo.get(id) || 0).toFixed(3), get emitters() { return emitters.map(e => ({ id: e.id, room: e.room, rate: +e.rate.toFixed(1), snow: e.snow })); },
    get ice() { return ice.info(); }, iceHoles: () => ice.holeIds(), breakIce: (name, x, z) => ice.breakAt(name, x, z),
    get peerLevels() { return Object.fromEntries(peerLevel); },
    patches: () => [...patches.map].map(([id, p]) => ({ id, kind: p.kind, amt: +p.amt.toFixed(2) })),
    set(o = {}) { if (typeof o.body === 'number') body = THREE.MathUtils.clamp(o.body, 0, 100); if (typeof o.wet === 'number') wet = o.wet; if (o.room) for (const [id, v] of Object.entries(o.room)) if (roomT.has(id)) roomT.set(id, +v); if (o.ice !== undefined) ice.set(o.ice); return true; },
    stats: () => ({ body: C.bodyTemp, level: C.level, air: C.airTemp, where, emitters: emitters.length, particles: blow.live, patches: patches.map.size, ice: ice.info() }),
  };
  return C;
}
