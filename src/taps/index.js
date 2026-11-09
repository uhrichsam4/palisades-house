// Running water: every sink, shower, hand shower and tub filler in the house (table: ./fixtures.js).
// Look at a tap within ~2 m -> prompt chip "E::TURN ON WATER" / "E::TURN ON SHOWER" (src/interact.js); E toggles.
// Visuals (./water.js) are GPU-driven and built lazily the first time a tap runs; sound (./audio.js) is procedural
// and only exists while a tap runs. Idle cost is zero: the per-frame hook returns at once when nothing runs.
// Sync: channel 'tap' carries {t:'x', id, on, s, b} toggles and {t:'all', l:[[id,on,s,b]…]} full state for
// newcomers; each tap keeps a Lamport stamp (s) + toggler id (b) so late/duplicate messages resolve the same way
// on every client (a newcomer's all-off state has stamp 0 and never overrides anyone).
// Debug/tests: window.__taps = { fixtures, set(id,on), toggle(id), state(), info(id) }; URL ?taps=id1,id2|all turns taps on at load.
import * as THREE from 'three';
import { FIXTURES } from './fixtures.js';
import { createTapFx } from './water.js';
import { createVoice, setListener, audioContext } from './audio.js';
import { createOcclusion } from '../speaker/acoustics.js';

export function startTaps(ctx, mp) {
  if (ctx.shot) return null;
  const { camera, scene } = ctx;
  const T0 = performance.now(); const now = () => (performance.now() - T0) / 1000;
  const uTime = { value: 0 };
  const taps = new Map(); const running = new Set();
  let clock = 0, occl = null, donors = null, audioAcc = 0;
  const selfId = () => mp?.selfId || 'local';

  for (const f of FIXTURES) {
    const d = new THREE.Vector3().fromArray(f.dir).normalize(); f.dir = d.toArray();
    const t = { f, on: false, s: 0, b: '', fx: null, voice: null, pos: new THREE.Vector3().fromArray(f.tip), heard: false };
    taps.set(f.id, t);
    const shower = f.kind === 'shower' || f.kind === 'hand';
    const label = () => (t.on ? 'TURN OFF ' : 'TURN ON ') + (shower ? 'SHOWER' : 'WATER');
    const use = () => toggle(f.id);
    const pts = [f.heads ? f.heads : [f.tip], f.ui || []].flat();
    if (ctx.interact) pts.forEach((p, i) => ctx.interact.add({ id: 'tap:' + f.id + (i ? ':' + i : ''), pos: new THREE.Vector3().fromArray(p), radius: shower ? (i < (f.heads?.length || 1) ? 0.3 : 0.16) : 0.2, range: 2.3, label, use }));
  }

  // room light probe for the stream's reflections (materials bound by src/lighting.js carry userData.probe)
  function donorFor(room) {
    if (!donors) {
      donors = new Map();
      scene.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { const p = m?.userData?.probe; if (!p) continue; const r = p.split('#')[0]; if (!donors.has(r)) donors.set(r, m); } });
    }
    return donors.get(room) || null;
  }

  // contain pass: the shower enclosure as a world box (glass / walls / tub sides around the spray), from fixed-collider
  // rays across the stall at two heights; the spray particles stop at it (water.js uBoxMin/uBoxMax). Once per fixture.
  function enclosure(f) {
    const ph = ctx.phys; if (!ph?.world) return null; const R = ph.RAPIER;
    const FL = R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
    const hx = f.dir[0], hz = f.dir[2], hl = Math.hypot(hx, hz) || 1; const o = { x: f.tip[0] + (hx / hl) * 0.12, z: f.tip[2] + (hz / hl) * 0.12 };
    const lim = { '-x': 2.5, '+x': 2.5, '-z': 2.5, '+z': 2.5 }; const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    for (const y of [f.tip[1] - 0.35, f.land + 1.2]) for (const [k, dx, dz] of [['-x', -1, 0], ['+x', 1, 0], ['-z', 0, -1], ['+z', 0, 1]]) {
      ray.origin.x = o.x; ray.origin.y = y; ray.origin.z = o.z; ray.dir.x = dx; ray.dir.y = 0; ray.dir.z = dz;
      let h = null; try { h = ph.world.castRay(ray, 2.5, true, FL); } catch {} const d = h ? (h.timeOfImpact ?? h.toi) : 2.5;
      if (d > 0.05) lim[k] = Math.min(lim[k], d); // starting inside the wall the fixture hangs on: ignore that side
    }
    return [[o.x - lim['-x'], f.land - 0.02, o.z - lim['-z']], [o.x + lim['+x'], f.tip[1] + 0.6, o.z + lim['+z']]];
  }
  function apply(id, on, s, b) {
    const t = taps.get(id); if (!t) return false;
    clock = Math.max(clock, s);
    if (s < t.s || (s === t.s && b <= t.b)) return false;
    t.s = s; t.b = b;
    if (t.on === !!on) return true;
    t.on = !!on; const tm = now();
    if (t.on) {
      if (!t.fx) { if ((t.f.kind === 'shower' || t.f.kind === 'hand') && !t.f.box) t.f.box = enclosure(t.f); t.fx = createTapFx(t.f, { uTime }); t.donor = donorFor(t.f.room); scene.add(t.fx.group); }
      t.fx.group.visible = true; uTime.value = tm; t.fx.setOn(true, tm);
      t.voice ??= createVoice(t.f.kind, t.f.tip);
      t.voice.start(); audioAcc = 1; // first loudness update right away
      running.add(t);
    } else if (t.fx) { t.fx.setOn(false, tm); t.voice?.stop(0.35); }
    return true;
  }
  function toggle(id, want) {
    const t = taps.get(id); if (!t) return;
    const on = want === undefined ? !t.on : !!want; if (on === t.on) return;
    clock = Math.max(clock, t.s) + 1;
    apply(id, on, clock, selfId());
    ch?.send({ t: 'x', id, on: on ? 1 : 0, s: clock, b: selfId() });
  }

  // ---- network
  const ch = mp?.channel ? mp.channel('tap') : null;
  const full = () => [...taps.values()].filter(t => t.s > 0).map(t => [t.f.id, t.on ? 1 : 0, t.s, t.b]);
  if (ch) {
    ch.onMessage = (d) => {
      if (!d || typeof d !== 'object') return;
      const ok = (id, s, b) => typeof id === 'string' && taps.has(id) && Number.isInteger(s) && s > 0 && s < 1e9 && typeof b === 'string';
      if (d.t === 'x' && ok(d.id, d.s, d.b)) apply(d.id, d.on, d.s, d.b.slice(0, 40));
      else if (d.t === 'all' && Array.isArray(d.l)) for (const x of d.l.slice(0, 200)) if (Array.isArray(x) && ok(x[0], x[2], x[3])) apply(x[0], x[1], x[2], x[3].slice(0, 40));
    };
    mp.onPeerJoin?.((id) => { const l = full(); if (l.length) ch.send({ t: 'all', l }, id); });
  }

  // ---- per frame (nothing when no tap runs or fades out)
  const camPos = new THREE.Vector3(), head = [0, 0, 0], spk = [0, 0, 0];
  let frameMs = 0;
  ctx.onUpdate((dt) => {
    if (!running.size) return;
    const t0 = performance.now();
    const tm = now(); uTime.value = tm;
    camera.getWorldPosition(camPos);
    audioAcc += dt; const doAudio = audioAcc >= 0.25; if (doAudio) audioAcc = 0;
    let audible = false;
    for (const t of running) {
      const fx = t.fx;
      if (!t.on && !fx.alive(tm)) { fx.group.visible = false; running.delete(t); continue; }
      const d = camPos.distanceTo(t.pos);
      fx.group.visible = d < 45;
      if (t.donor && fx.group.visible) fx.setEnv(t.donor.envMap, t.donor.envMapIntensity * 1.3);
      if (!t.on || !t.voice) continue;
      if (doAudio) {
        if (d > 32) { if (t.voice.nodes) t.voice.stop(0.2); continue; }
        if (!t.voice.nodes) t.voice.start();
        occl ??= ctx.phys ? createOcclusion(ctx.phys) : null;
        head[0] = camPos.x; head[1] = camPos.y; head[2] = camPos.z; spk[0] = t.pos.x; spk[1] = t.pos.y; spk[2] = t.pos.z;
        let g = 1, walls = 0;
        if (occl) { try { const r = occl(head, spk); g = r.gain; walls = r.walls + (r.storeyDiff ? 1 : 0); } catch {} }
        t.voice.walls = walls;
        t.voice.set(g, walls ? 650 : 11000);
      }
      if (t.voice.nodes) audible = true;
    }
    if (audible) setListener(camera);
    frameMs = performance.now() - t0;
  });

  // ---- debug / tests
  const api = {
    fixtures: FIXTURES,
    set: (id, on) => toggle(id, on), toggle: (id) => toggle(id),
    state: () => Object.fromEntries([...taps.values()].map(t => [t.f.id, t.on])),
    running: () => [...running].map(t => t.f.id),
    get frameMs() { return frameMs; },
    info(id) { const t = taps.get(id); if (!t) return null; const ac = audioContext(); return { box: t.f.box || null, on: t.on, s: t.s, b: t.b, visible: !!t.fx?.group.visible, alive: !!t.fx && t.fx.alive(now()), audio: t.voice ? { nodes: t.voice.nodes, active: t.voice.active, gain: +t.voice.gain.toFixed(3), target: +t.voice.target.toFixed(3), walls: t.voice.walls, ctx: ac?.state } : null }; },
  };
  window.__taps = api;
  const q = ctx.params?.get?.('taps') ?? new URLSearchParams(location.search).get('taps');
  if (q) { const ids = q === 'all' ? FIXTURES.map(f => f.id) : q.split(','); for (const id of ids) toggle(id.trim(), true); }
  return api;
}
