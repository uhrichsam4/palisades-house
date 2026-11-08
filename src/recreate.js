// Re-create: act out a short video in the house. Scenes (src/recreate/scenes.js) mark an area + up to 4
// people positions + the video's audio. Inside an area a bottom-centre button appears; R / click takes the
// first free seat (avatar sits there), Enter / ▶ starts a 3-2-1 countdown and the audio plays for everyone
// in the scene (seated players at full volume, bystanders positionally from the scene centre), X / Stand up
// leaves. Works offline; with multiplayer (`mp.net`, see multiplayer.js) seats and playback are synced:
//  - seat claims: 'rc' {k:'claim'|'release', s, i} + the seat key in every state message; when two peers
//    hold the same seat the LOWEST peerId keeps it and the other moves to the next free seat (or stands).
//  - playback: {k:'play', s, at, now} with `at` = start time in the sender's performance.now() clock,
//    converted with the peer clock offset (net.clock). Start is scheduled 3 s ahead (countdown) so every
//    client starts on the same instant; late joiners / late gestures start at the right offset.
//  - {k:'stop', s}.  Test hooks: window.__recreate.
// Video spots (src/videos.js) are scenes too (`video`, `snap`); api.onPlay(fn(sceneId, startPerfMs|null)) tells
// it when a scene starts/stops so the clip plays muted in sync, api.focus(id) prefers a scene where areas overlap.
import { SCENES } from './recreate/scenes.js';

const COUNTDOWN_MS = 3000;
const KEY = (s, i) => `${s}:${i}`;

export function startRecreate(ctx, mp) {
  const { player, camera } = ctx; if (!player) return null;
  const net = mp?.net || null;
  const selfId = () => net?.selfId || 'local';
  const byId = new Map(SCENES.map(s => [s.id, s]));
  for (const s of SCENES) if (!s.center) { const n = s.seats.length || 1; s.center = [0, 1, 2].map(k => s.seats.reduce((a, q) => a + q.pos[k], 0) / n + (k === 1 ? 1 : 0)); }

  let mySeat = null;               // { s: sceneId, i }
  const peerSeat = new Map();      // peerId -> 'scene:i'
  const plays = new Map();         // sceneId -> { start (local perf ms), by }
  const levelOf = (y) => (y > 2.5 ? 1 : 0);
  const playFns = []; let focusId = null;
  const notify = (sid, start) => { for (const f of playFns) { try { f(sid, start); } catch (e) { console.warn('[recreate]', e); } } };
  // generated standing seats (video spots): drop them onto whatever is below (terrain, decks, floors) once
  function snapSeats(sc) {
    sc.snap = false; const phys = ctx.phys; if (!phys) return;
    const R = phys.RAPIER, world = phys.world; try { world.updateSceneQueries?.(); } catch {}
    const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const FL = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
    // ray starts 0.5 m above the estimated floor (below table tops) so it lands on the floor/terrain;
    // a seat blocked by furniture slides toward the camera (sc.spot) / sideways to the nearest clear spot
    const cap = new R.Capsule(0.55, 0.28), ROT = { x: 0, y: 0, z: 0, w: 1 };
    const ground = (x, y, z) => { ray.origin.x = x; ray.origin.y = y + 0.5; ray.origin.z = z; const hit = world.castRay(ray, 2.5, true, FL, undefined, player.collider); return hit && hit.timeOfImpact > 0.02 ? ray.origin.y - hit.timeOfImpact + 0.02 : y; };
    const clear = (x, y, z) => { let hit = false; world.intersectionsWithShape({ x, y: y + 0.06 + 0.83, z }, ROT, cap, (c) => { if (c.handle === player.collider.handle) return true; const b = c.parent(); if (b && !b.isFixed()) return true; hit = true; return false; }); return !hit; };
    const cp = sc.spot?.cam.pos; const taken = [];
    for (const s of sc.seats) {
      const [x0, y0, z0] = s.pos; let bx = cp ? cp[0] - x0 : 0, bz = cp ? cp[2] - z0 : 0; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
      let best = null;
      search: for (const d of [0, 0.3, 0.6, 0.9, 1.2, 1.5]) for (const l of [0, 0.35, -0.35, 0.7, -0.7]) {
        const x = x0 + bx * d - bz * l, z = z0 + bz * d + bx * l, y = ground(x, y0, z);
        if (taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.6)) continue;
        if (clear(x, y, z)) { best = [x, y, z]; break search; }
      }
      if (best) { s.pos[0] = best[0]; s.pos[1] = best[1]; s.pos[2] = best[2]; }
      else s.pos[1] = ground(x0, y0, z0);
      taken.push([s.pos[0], s.pos[2]]);
    }
    const n = sc.seats.length; sc.center = [0, 1, 2].map(k => sc.seats.reduce((a, q) => a + q.pos[k], 0) / n + (k === 1 ? 1 : 0));
  }

  // ---------------------------------------------------------------- seats
  const holders = (sid, i) => { const k = KEY(sid, i); const out = []; for (const [id, key] of peerSeat) if (key === k) out.push(id); if (mySeat && mySeat.s === sid && mySeat.i === i) out.push(selfId()); return out; };
  const takenByOthers = (sid, i) => { const k = KEY(sid, i); for (const key of peerSeat.values()) if (key === k) return true; return false; };
  const countIn = (sid) => { const sc = byId.get(sid); let n = 0; for (let i = 0; i < sc.seats.length; i++) if (holders(sid, i).length) n++; return n; };
  function freeSeat(sid, skip = -1) { const sc = byId.get(sid); for (let i = 0; i < sc.seats.length; i++) if (i !== skip && !takenByOthers(sid, i)) return i; return -1; }
  function sit(sid, i) {
    const sc = byId.get(sid); if (sc.snap) snapSeats(sc); const seat = sc.seats[i];
    mySeat = { s: sid, i }; if (net) net.hooks.seatKey = KEY(sid, i);
    player.setSeat({ pos: seat.pos, yaw: seat.yaw, pose: seat.pose || 'sit', bounds: sc.area });
    net?.send({ k: 'claim', s: sid, i }); net?.sendState();
    loadAudio(sc); render();
  }
  function take(sid) {
    sid = sid || areaScene()?.id; if (!sid) return false;
    if (mySeat && mySeat.s === sid) return true;
    const i = freeSeat(sid); if (i < 0) { flash('All seats are taken'); return false; }
    sit(sid, i); return true;
  }
  function stand() { if (mySeat) player.setSeat(null); }
  player.onSeatChange?.((seat) => {
    if (seat || !mySeat) return;
    const old = mySeat; mySeat = null; if (net) net.hooks.seatKey = null;
    net?.send({ k: 'release', s: old.s, i: old.i }); net?.sendState(); render();
  });
  function resolveConflicts() {
    if (!mySeat) return;
    const me = selfId(); const h = holders(mySeat.s, mySeat.i);
    if (!h.some(id => id !== me && id < me)) return; // I keep it
    const i = freeSeat(mySeat.s, mySeat.i);
    if (i >= 0) { flash('Seat taken — moved over'); sit(mySeat.s, i); } else { flash('All seats are taken'); stand(); }
  }

  // ---------------------------------------------------------------- audio (WebAudio; context made on a user gesture)
  let ac = null, master = null; const buffers = new Map(), raw = new Map(), voices = new Map();
  function ensureAC() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      ac.addEventListener('statechange', () => { if (ac.state === 'running') for (const sid of plays.keys()) startVoice(sid); });
      for (const sc of SCENES) if (raw.has(sc.id)) loadAudio(sc);
    }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    return ac;
  }
  const gesture = () => ensureAC();
  addEventListener('pointerdown', gesture, true); addEventListener('keydown', gesture, true); addEventListener('touchstart', gesture, true);
  function loadAudio(sc) {
    if (buffers.has(sc.id)) return buffers.get(sc.id);
    if (!raw.has(sc.id)) raw.set(sc.id, fetch(sc.audio).then(r => { if (!r.ok) throw new Error(sc.audio + ' ' + r.status); return r.arrayBuffer(); }).catch(e => { console.warn('[recreate] audio', e.message); return null; }));
    if (!ac) return null;
    const p = raw.get(sc.id).then(b => (b ? ac.decodeAudioData(b.slice(0)) : null)).catch(e => { console.warn('[recreate] decode', e.message); return null; });
    buffers.set(sc.id, p); return p;
  }
  function stopVoice(sid) { const v = voices.get(sid); if (!v) return; try { v.src.stop(); } catch {} try { v.src.disconnect(); v.out.disconnect(); } catch {} voices.delete(sid); }
  async function startVoice(sid) {
    const pl = plays.get(sid), sc = byId.get(sid); if (!pl || !sc) return;
    if (!ac || ac.state !== 'running') return; // retried on statechange (user gesture)
    const buf = await loadAudio(sc); if (!buf || plays.get(sid) !== pl) return;
    stopVoice(sid);
    const now = performance.now(); const off = (now - pl.start) / 1000;
    if (off >= Math.min(sc.duration, buf.duration)) return;
    const src = ac.createBufferSource(); src.buffer = buf;
    const dry = ac.createGain(), wet = ac.createGain(), out = ac.createGain();
    const pan = ac.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 2.5; pan.rolloffFactor = 1.1; pan.maxDistance = 40;
    const [cx, cy, cz] = sc.center; if (pan.positionX) { pan.positionX.value = cx; pan.positionY.value = cy; pan.positionZ.value = cz; } else pan.setPosition(cx, cy, cz);
    src.connect(dry); src.connect(pan); pan.connect(wet); dry.connect(out); wet.connect(out); out.connect(master);
    const seated = mySeat?.s === sid; dry.gain.value = seated ? 1 : 0; wet.gain.value = seated ? 0 : 1;
    let when, from;
    if (off < 0) { when = ac.currentTime - off; from = 0; } else { when = ac.currentTime + 0.02; from = off + 0.02; }
    src.start(when, from);
    const lat = (ac.outputLatency || ac.baseLatency || 0);
    const v = { src, dry, wet, out, t0: when - from, startWall: Date.now() + (when - from - ac.currentTime + lat) * 1000 };
    src.onended = () => { if (voices.get(sid) === v) voices.delete(sid); };
    voices.set(sid, v);
  }
  function startPlay(sid, start, by) {
    const cur = plays.get(sid); if (cur && Math.abs(cur.start - start) < 30) return; // duplicate (several peers greet a joiner)
    plays.set(sid, { start, by }); ensureAC(); startVoice(sid); render(); notify(sid, start);
  }
  function endPlay(sid) { const had = plays.delete(sid); stopVoice(sid); render(); if (had) notify(sid, null); }
  function startLocal() {
    if (!mySeat) return; const sid = mySeat.s; if (plays.has(sid)) return;
    const start = performance.now() + COUNTDOWN_MS;
    net?.send({ k: 'play', s: sid, at: start, now: performance.now() });
    startPlay(sid, start, selfId());
  }
  function stopLocal(sid) { sid = sid || mySeat?.s; if (!sid || !plays.has(sid)) return; net?.send({ k: 'stop', s: sid }); endPlay(sid); }

  // ---------------------------------------------------------------- network
  if (net) {
    net.hooks.onPeerSeat = (id, key) => { if (key) peerSeat.set(id, key); else peerSeat.delete(id); resolveConflicts(); render(); };
    net.hooks.onPeerLeave = (id) => { peerSeat.delete(id); render(); };
    net.hooks.onPeerJoin = (id) => {
      if (mySeat) net.send({ k: 'claim', s: mySeat.s, i: mySeat.i }, id);
      for (const [sid, pl] of plays) net.send({ k: 'play', s: sid, at: pl.start, now: performance.now() }, id);
    };
    net.hooks.onMessage = (m, id) => {
      const sc = byId.get(m.s); if (!sc) return;
      if (m.k === 'claim' && Number.isInteger(m.i)) { peerSeat.set(id, KEY(m.s, m.i)); resolveConflicts(); render(); }
      else if (m.k === 'release') { if (peerSeat.get(id) === KEY(m.s, m.i)) peerSeat.delete(id); render(); }
      else if (m.k === 'play' && typeof m.at === 'number') {
        const off = net.clock(id) ?? (typeof m.now === 'number' ? performance.now() - m.now : 0);
        startPlay(m.s, m.at + off, id);
      } else if (m.k === 'stop') endPlay(m.s);
    };
  }

  // ---------------------------------------------------------------- UI (#rc, bottom-centre)
  const root = document.getElementById('rc') || Object.assign(document.createElement('div'), { id: 'rc' });
  if (!root.parentNode) document.body.appendChild(root);
  root.innerHTML = `
    <div class="rc-count" id="rc-count"></div>
    <div class="rc-card">
      <div class="rc-prog" id="rc-prog"><div id="rc-bar"></div></div>
      <div class="rc-row">
        <button type="button" id="rc-take"></button>
        <button type="button" id="rc-start">▶ Start <kbd>Enter</kbd></button>
        <button type="button" id="rc-stop">■ Stop <kbd>Enter</kbd></button>
        <button type="button" id="rc-stand" class="ghost">Stand up <kbd>X</kbd></button>
        <span class="rc-in" id="rc-in"></span>
      </div>
      <div class="rc-msg" id="rc-msg"></div>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const els = { take: $('rc-take'), start: $('rc-start'), stop: $('rc-stop'), stand: $('rc-stand'), inn: $('rc-in'), prog: $('rc-prog'), bar: $('rc-bar'), count: $('rc-count'), msg: $('rc-msg') };
  const click = (el, fn) => el.addEventListener('click', (e) => { e.stopPropagation(); ensureAC(); fn(); el.blur(); });
  click(els.take, () => take()); click(els.start, startLocal); click(els.stop, () => stopLocal()); click(els.stand, stand);
  for (const el of [root]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  let msgT = 0; function flash(t) { els.msg.textContent = t; msgT = performance.now() + 2500; }

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (document.body.classList.contains('ui-open')) return;
    if (e.code === 'KeyR' && !mySeat && areaScene()) { e.preventDefault(); take(); }
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && mySeat) { e.preventDefault(); if (plays.has(mySeat.s)) stopLocal(); else startLocal(); }
    else if (e.code === 'KeyX' && mySeat) { e.preventDefault(); stand(); }
  });

  function areaScene() {
    const p = player.position, lv = levelOf(p.y);
    const inA = (sc) => { const [x0, z0, x1, z1] = sc.area; return sc.level === lv && p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1; };
    const f = focusId && byId.get(focusId); if (f && inA(f)) return f;
    for (const sc of SCENES) { const [x0, z0, x1, z1] = sc.area; if (sc.level === lv && p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return sc; }
    return null;
  }
  let lastKey = '';
  function render() {
    const sc = mySeat ? byId.get(mySeat.s) : areaScene();
    const now = performance.now();
    if (!sc) { if (lastKey !== 'none') { root.classList.remove('show'); els.count.textContent = ''; lastKey = 'none'; } return; }
    const pl = plays.get(sc.id); const n = countIn(sc.id), tot = sc.seats.length;
    const counting = pl && now < pl.start; const playing = pl && now >= pl.start;
    const cd = counting ? Math.ceil((pl.start - now) / 1000) : 0;
    const prog = playing ? Math.min(1, (now - pl.start) / 1000 / sc.duration) : 0;
    const key = [sc.id, !!mySeat, n, cd, playing, Math.round(prog * 400), now < msgT].join('|'); if (key === lastKey) return; lastKey = key;
    root.classList.add('show');
    els.take.textContent = n >= tot && !mySeat ? `🎬 ${sc.title} — full` : `🎬 Re-create: ${sc.title} (R)`;
    els.take.disabled = n >= tot && !mySeat;
    els.take.hidden = !!mySeat; els.stand.hidden = !mySeat;
    els.start.hidden = !mySeat || !!pl; els.stop.hidden = !mySeat || !pl;
    els.inn.textContent = `${n}/${tot} in`;
    els.prog.classList.toggle('on', !!playing); els.bar.style.width = (prog * 100).toFixed(2) + '%';
    els.count.textContent = cd ? String(cd) : ''; els.count.classList.toggle('on', !!cd);
    if (now >= msgT) els.msg.textContent = pl ? (counting ? 'Get ready…' : '') : (mySeat ? 'Everyone seated? Press Start.' : '');
  }

  // ---------------------------------------------------------------- per frame
  const fwd = { x: 0, y: 0, z: -1 };
  ctx.onUpdate(() => {
    const now = performance.now();
    const near = areaScene(); if (near) loadAudio(near);
    for (const [sid, pl] of plays) { if (now > pl.start + byId.get(sid).duration * 1000 + 200) endPlay(sid); }
    if (ac && voices.size) {
      const l = ac.listener, p = camera.position;
      const q = camera.quaternion; const x = 2 * (q.x * q.z + q.w * q.y), y = 2 * (q.y * q.z - q.w * q.x), z = 1 - 2 * (q.x * q.x + q.y * q.y);
      fwd.x = -x; fwd.y = -y; fwd.z = -z; // camera looks down its local -z
      if (l.positionX) { l.positionX.setTargetAtTime(p.x, ac.currentTime, 0.03); l.positionY.setTargetAtTime(p.y, ac.currentTime, 0.03); l.positionZ.setTargetAtTime(p.z, ac.currentTime, 0.03); l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
      else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
      for (const [sid, v] of voices) {
        const sc = byId.get(sid); const seated = mySeat?.s === sid;
        const lvl = levelOf(player.position.y) === sc.level ? 1 : 0.25;
        v.dry.gain.setTargetAtTime(seated ? 1 : 0, ac.currentTime, 0.08); v.wet.gain.setTargetAtTime(seated ? 0 : lvl, ac.currentTime, 0.08);
      }
    }
    render();
  });

  // ---------------------------------------------------------------- test / debug hooks
  const api = {
    scenes: SCENES, take, stand, start: startLocal, stop: stopLocal,
    onPlay(fn) { playFns.push(fn); }, focus(sid) { focusId = sid || null; }, playStart(sid) { return plays.get(sid)?.start ?? null; },
    get scene() { return (mySeat ? mySeat.s : areaScene()?.id) || null; },
    get seat() { return mySeat ? { ...mySeat } : null; },
    get playing() { const sid = mySeat?.s || areaScene()?.id; const v = sid && voices.get(sid); return !!(v && ac && ac.state === 'running' && ac.currentTime >= v.t0 && ac.currentTime - v.t0 < byId.get(sid).duration); },
    get currentTime() { const sid = mySeat?.s || areaScene()?.id; const v = sid && voices.get(sid); return v && ac ? Math.max(0, ac.currentTime - v.t0) : 0; },
    get startWall() { const sid = mySeat?.s || areaScene()?.id; return voices.get(sid)?.startWall ?? null; },
    get scheduledWall() { const sid = mySeat?.s || areaScene()?.id; const pl = plays.get(sid); return pl ? Date.now() + (pl.start - performance.now()) : null; },
    get audioState() { return ac ? ac.state : 'none'; },
    get claims() { return { me: selfId(), mine: mySeat && KEY(mySeat.s, mySeat.i), peers: Object.fromEntries(peerSeat) }; },
  };
  window.__recreate = api;
  return api;
}
