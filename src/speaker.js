// Portable speaker: a Bluetooth speaker on the kitchen bar island that players can shove, carry (Q) and use to
// play a YouTube link for the whole lobby (Y), heard "in the room": louder near it, quieter far away and
// through walls / floors.
//  - Carry: look at it within 2.5 m, Q picks up (held in front of you), Q drops (throws if running).
//    Holder = authority, broadcasts pose at 10 Hz; after a drop / shove the last mover owns it until it sleeps,
//    then sends a final settled pose. Ownership claims {id, ts}: newer ts wins, then smaller peer id.
//  - Music: YouTube IFrame Player in a visible mini-player card (YouTube terms: never hidden, >= 200x113).
//    Synced state {vid, playing, startAt (sender perf ms), offset s, by}; every client seeks if drift > 1 s
//    (checked every 2 s). Autoplay blocked -> "click to hear the music" button. Embeds disabled -> error text.
//  - Room sound: setVolume() at 10 Hz from src/speaker/acoustics.js (distance falloff x rays through walls)
//    x panel volume x global volume (localStorage 'ph.settings'.vol), smoothed.
// Network: mp.channel('speaker') etc. (see src/speaker/net.js; BroadcastChannel fallback for two local tabs).
// Test hooks: window.__speaker.
import * as THREE from 'three';
import { buildSpeakerModel } from './speaker/model.js';
import { createOcclusion } from './speaker/acoustics.js';
import { parseYouTube, parseStart, loadYT, YT_ERRORS } from './speaker/yt.js';
import { speakerNet, claimWins } from './speaker/net.js';
import { injectSpeakerCSS } from './speaker/css.js';

const SPAWN = [16.71, 1.2, 17.4];      // bar island top, kitchen (src/rooms/kitchen.js BI: x 16.25-17.17, z 15.25-18.45)
const PICK_DIST = 2.5, NEAR_UI = 3.0, NET_HZ = 10, DRIFT = 1.0, SYNC_MS = 2000;

export function startSpeaker(ctx, mp) {
  if (!ctx || ctx.shot || !ctx.player) return null;
  const { scene, camera, player, phys } = ctx; const R = phys.RAPIER;
  const st = player.state;
  const net = speakerNet(mp);
  const ch = net.channel('speaker');
  const me = () => net.selfId;
  injectSpeakerCSS();

  // ---------------------------------------------------------------- object + physics
  const M = buildSpeakerModel();
  const obj = M.group; obj.position.set(...SPAWN); scene.add(obj);
  const dyn = phys.dynamic(obj, { mass: 1.6, shape: 'box', friction: 0.9, restitution: 0.15, linearDamping: 0.3, angularDamping: 0.6, ccd: true });
  const body = dyn.body, col = dyn.collider;
  const T_DYN = R.RigidBodyType.Dynamic, T_KIN = R.RigidBodyType.KinematicPositionBased;
  const setType = (t) => { if (body.bodyType() !== t) body.setBodyType(t, true); };

  let mode = 'free';            // 'free' (local dynamic) | 'held' (I carry it) | 'follow' (a remote owner moves it)
  let own = null;               // { id, ts }
  let sentFinal = true, lastPoseT = 0, holdDist = 0.7;
  const tgtP = new THREE.Vector3(...SPAWN), tgtQ = new THREE.Quaternion();
  const pos = () => { const t = body.translation(); return [t.x, t.y, t.z]; };
  const rot = () => { const r = body.rotation(); return [r.x, r.y, r.z, r.w]; };
  const vel = () => { const v = body.linvel(); return [v.x, v.y, v.z]; };

  function poseMsg(extra) { return { t: 'pose', p: pos(), q: rot(), v: vel(), own, held: mode === 'held', ...extra }; }
  function sendPose(extra, target) { if (own) ch.send(poseMsg(extra), target); }

  const camFwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  function lookingAt() {
    const [x, y, z] = pos(); tmp.set(x, y, z).sub(camera.position); const d = tmp.length();
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return { d, dot: d > 0 ? tmp.dot(camFwd) / d : 1 };
  }
  function canPick() {
    if (mode === 'held') return false;
    if (mode === 'follow' && performance.now() - lastPoseT < 3000 && heldByOther) return false;
    const l = lookingAt(); return l.d < PICK_DIST && (l.dot > 0.85 || l.d < 1.1);
  }
  let heldByOther = false;
  function pickup() {
    if (!canPick() || st.seat || st.swimming) return false;
    own = { id: me(), ts: Date.now() }; mode = 'held'; heldByOther = false;
    setType(T_KIN); col.setEnabled(false); // the carrier's capsule must not collide with what it carries
    sendPose(); return true;
  }
  function drop() {
    if (mode !== 'held') return false;
    mode = 'free'; setType(T_DYN); col.setEnabled(true); sentFinal = false;
    const pv = player.velocity; const running = (st.keys.has('ShiftLeft') || st.keys.has('ShiftRight')) && st.speed > 3;
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const v = running ? camFwd.clone().multiplyScalar(6.5).add(new THREE.Vector3(pv.x, 2.2, pv.z)) : new THREE.Vector3(pv.x * 0.5, 0, pv.z * 0.5);
    body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    if (running) body.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: 0 }, true);
    body.wakeUp(); sendPose(); return true;
  }

  // ---------------------------------------------------------------- messages
  ch.onMessage = (msg, from) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'pose') onPose(msg, from);
    else if (msg.t === 'music') onMusic(msg.s, from);
    else if (msg.t === 'hello') greet(from);
  };
  function onPose(m, from) {
    const o = m.own; if (!o || o.id !== from) return;
    const same = own && own.id === o.id && own.ts === o.ts;
    if (!same && !claimWins(o, own)) { if (own && own.id === me()) sendPose(undefined, from); return; } // they lost: tell them
    if (mode === 'held' && !same) { col.setEnabled(true); } // someone newer took it from my hands
    own = { id: o.id, ts: o.ts }; heldByOther = !!m.held; sentFinal = true;
    if (m.settled) {
      mode = 'free'; setType(T_DYN); col.setEnabled(true);
      body.setTranslation({ x: m.p[0], y: m.p[1], z: m.p[2] }, false); body.setRotation({ x: m.q[0], y: m.q[1], z: m.q[2], w: m.q[3] }, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false); body.setAngvel({ x: 0, y: 0, z: 0 }, false); body.sleep();
      return;
    }
    if (mode !== 'follow') { mode = 'follow'; setType(T_KIN); col.setEnabled(true); }
    tgtP.set(m.p[0], m.p[1], m.p[2]); tgtQ.set(m.q[0], m.q[1], m.q[2], m.q[3]); lastPoseT = performance.now();
    tgtV = m.v || [0, 0, 0];
  }
  let tgtV = [0, 0, 0];
  function greet(id) {
    setTimeout(() => {
      if (own) sendPose({ settled: mode === 'free' && body.isSleeping() }, id);
      if (music.vid) ch.send({ t: 'music', s: musicMsg() }, id);
    }, 400);
  }
  net.onPeerJoin((id) => greet(id));
  net.onPeerLeave((id) => { if (own && own.id === id && mode === 'follow') { mode = 'free'; setType(T_DYN); body.wakeUp(); } });

  // ---------------------------------------------------------------- music state
  const BLANK = { vid: null, playing: false, startLocal: 0, offset: 0, by: '', ts: 0, from: '', range: 'house' };
  let music = { ...BLANK };
  const expected = () => music.offset + (music.playing ? (performance.now() - music.startLocal) / 1000 : 0);
  const musicMsg = () => ({ vid: music.vid, playing: music.playing, startAt: music.startLocal, offset: music.offset, by: music.by, ts: music.ts, range: music.range, pn: performance.now() });
  function setMusic(patch) {
    music = { ...music, ...patch, ts: Math.max(Date.now(), music.ts + 1), from: me() };
    ch.send({ t: 'music', s: musicMsg() }); applyMusic(); ui();
  }
  function onMusic(s, from) {
    if (!s) return;
    if (!claimWins({ id: from, ts: s.ts }, { id: music.from, ts: music.ts })) return;
    const c = net.clock(from);
    const startLocal = c !== null ? s.startAt + c : performance.now() - (s.pn - s.startAt);
    music = { vid: s.vid || null, playing: !!s.playing, startLocal, offset: +s.offset || 0, by: s.by || '', ts: s.ts, from, range: s.range === 'room' ? 'room' : 'house' };
    applyMusic(); ui();
  }
  function playUrl(url) {
    const vid = parseYouTube(url);
    if (!vid) { showErr('That doesn\'t look like a YouTube link.'); return false; }
    showErr(''); setMusic({ vid, playing: true, startLocal: performance.now(), offset: parseStart(url), by: net.name(), range: 'house' });
    return true;
  }
  function togglePlay() {
    if (!music.vid) return;
    if (music.playing) setMusic({ playing: false, offset: expected(), startLocal: performance.now() });
    else setMusic({ playing: true, startLocal: performance.now() });
    unblock();
  }
  function stop() { if (music.vid) setMusic({ vid: null, playing: false, offset: 0 }); }
  function setRange(r) { r = r === 'room' ? 'room' : 'house'; if (r !== music.range) setMusic({ range: r }); }
  // leaving the lobby (or switching to another one): stop and hide the local playback, forget lobby state
  function resetLocal() {
    music = { ...BLANK }; applyMusic(); ui();
    if (mode === 'follow') { mode = 'free'; setType(T_DYN); body.wakeUp(); }
    if (mode !== 'held') own = null; heldByOther = false;
  }
  try { mp?.on?.((ev) => { if (ev === 'left') resetLocal(); }); } catch {}
  let lastRoom = mp?.room || null;

  // ---------------------------------------------------------------- YouTube player
  let quickT = 0; let yt = null, ytReady = false, loadedVid = null, title = '', blockedN = 0, blocked = false, ytErr = '';
  async function applyMusic() {
    if (!music.vid) {
      if (yt && ytReady) { try { yt.stopVideo(); } catch {} }
      loadedVid = null; title = ''; ytErr = ''; blocked = false; els.mini.classList.remove('on'); ui(); return;
    }
    els.mini.classList.add('on');
    let YT; try { YT = await loadYT(); } catch (e) { showErr(e.message); return; }
    if (!yt) {
      loadedVid = music.vid;
      yt = new YT.Player('spk-yt', {
        width: 240, height: 135, videoId: music.vid,
        playerVars: { autoplay: music.playing ? 1 : 0, start: Math.floor(expected()), controls: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: {
          onReady: () => { ytReady = true; vol.cur = -1; tickVolume(true); sync(); },
          onStateChange: (e) => { if (e.data === 1) { blocked = false; blockedN = 0; clearTimeout(quickT); quickT = setTimeout(sync, 600); } readTitle(); ui(); },
          onError: (e) => { ytErr = YT_ERRORS[e.data] || ('YouTube error ' + e.data); blocked = false; blockedN = 0; showErr(ytErr); ui(); },
        },
      });
      return;
    }
    if (!ytReady) return; // onReady syncs
    if (loadedVid !== music.vid) {
      loadedVid = music.vid; title = ''; ytErr = ''; showErr('');
      const o = { videoId: music.vid, startSeconds: expected() };
      if (music.playing) yt.loadVideoById(o); else yt.cueVideoById(o);
    } else sync();
  }
  function readTitle() { try { const d = yt.getVideoData?.(); if (d && d.title) title = d.title; } catch {} }
  function sync() {
    if (!yt || !ytReady || !music.vid || ytErr) return;
    let s, cur; try { s = yt.getPlayerState(); cur = yt.getCurrentTime() || 0; } catch { return; }
    const exp = expected();
    if (music.playing) {
      if (s !== 1 && s !== 3) { try { yt.playVideo(); } catch {} blockedN++; } else blockedN = 0;
      if (Math.abs(cur - exp) > DRIFT) { try { yt.seekTo(exp, true); } catch {} }
      let muted = false; try { muted = s === 1 && yt.isMuted(); } catch {}
      blocked = blockedN >= 2 || muted; // asked to play twice (4 s) and still not playing: autoplay blocked
    } else {
      blocked = false; blockedN = 0;
      if (s === 1 || s === 3) { try { yt.pauseVideo(); } catch {} }
      if (Math.abs(cur - exp) > DRIFT) { try { yt.seekTo(exp, true); } catch {} }
    }
    readTitle(); ui();
  }
  function unblock() { if (!yt || !ytReady) return; try { yt.unMute(); if (music.playing) yt.playVideo(); } catch {} blockedN = 0; blocked = false; ui(); }
  setInterval(sync, SYNC_MS);

  // ---------------------------------------------------------------- room-like volume (10 Hz)
  const occ = createOcclusion(phys);
  const vol = { panel: +(localStorage.getItem('ph.speaker.vol') ?? 0.8), global: 1, globalT: 0, cur: -1, last: { gain: 0 } };
  if (!Number.isFinite(vol.panel)) vol.panel = 0.8;
  function globalVol() {
    const now = performance.now(); if (now - vol.globalT < 1000) return vol.global; vol.globalT = now;
    try { const s = JSON.parse(localStorage.getItem('ph.settings') || '{}'); const v = Number(s.vol); vol.global = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; } catch { vol.global = 1; }
    return vol.global;
  }
  const head = () => [st.pos.x, st.pos.y + 1.6, st.pos.z];
  function tickVolume(force) {
    const r = occ(head(), pos(), music.range); vol.last = r;
    const target = r.gain * vol.panel * globalVol();
    vol.cur = vol.cur < 0 ? target : vol.cur + (target - vol.cur) * 0.35;
    if (yt && ytReady) { const v = Math.round(vol.cur * 100); if (force || v !== vol.sent) { vol.sent = v; try { yt.setVolume(v); } catch {} } }
  }

  // ---------------------------------------------------------------- per frame
  const yawQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const R0 = { x: 0, y: 0, z: 0, w: 1 }; const holdRay = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const RAY_FLAGS = R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  let netAcc = 0, near = false;
  ctx.onUpdate((dt, t) => {
    // carried: in front of the camera, a little low; distance from a 10 Hz ray so it never pokes through walls
    if (mode === 'held') {
      camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const p = tmp.copy(camera.position).addScaledVector(camFwd, holdDist); p.y -= 0.28;
      yawQ.setFromAxisAngle(Y, st.yaw);
      body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z }); body.setNextKinematicRotation({ x: yawQ.x, y: yawQ.y, z: yawQ.z, w: yawQ.w });
    } else if (mode === 'follow') {
      const k = 1 - Math.exp(-dt * 12); const c = body.translation(), r = body.rotation();
      const age = Math.min(0.15, (performance.now() - lastPoseT) / 1000);
      const x = c.x + (tgtP.x + tgtV[0] * age - c.x) * k, y = c.y + (tgtP.y + tgtV[1] * age - c.y) * k, z = c.z + (tgtP.z + tgtV[2] * age - c.z) * k;
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w).slerp(tgtQ, k);
      body.setNextKinematicTranslation({ x, y, z }); body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      if (performance.now() - lastPoseT > 3000) { mode = 'free'; setType(T_DYN); body.wakeUp(); } // owner went quiet
    }

    // ring: fake beat while playing, slow breathe when idle
    if (music.vid && music.playing) {
      const ph = (expected() * 2.0) % 1; const beat = Math.exp(-ph * 6) + 0.35 * Math.exp(-((ph + 0.5) % 1) * 9);
      M.ringM.emissiveIntensity = 0.9 + beat * 3.2; M.ringM.emissive.setHSL((0.55 + t * 0.02) % 1, 0.9, 0.55);
      const s = 1 + beat * 0.025; M.inner.scale.set(1, s, s);
    } else { M.ringM.emissiveIntensity = 0.35 + 0.15 * Math.sin(t * 1.5); M.inner.scale.set(1, 1, 1); M.ringM.emissive.setHex(0x29b6ff); }

    netAcc += dt; if (netAcc < 1 / NET_HZ) return; netAcc = 0;
    // ---- 10 Hz: hold ray, network, volume, UI
    if (mode === 'held') {
      holdRay.origin = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; holdRay.dir = { x: camFwd.x, y: camFwd.y, z: camFwd.z };
      const hit = phys.world.castRay(holdRay, 0.9, true, RAY_FLAGS, undefined, player.collider);
      holdDist = hit ? Math.max(0.3, hit.timeOfImpact ?? hit.toi ?? 0.7) - 0.18 : 0.75;
      sendPose();
    } else if (mode === 'free') {
      const sleeping = body.isSleeping();
      if (own && own.id === me()) {
        if (!sleeping) sendPose();
        else if (!sentFinal) { sentFinal = true; sendPose({ settled: true }); }
      } else if (!sleeping) {
        // I shoved it: claim it until it settles (only if I'm the one next to it)
        const v = body.linvel(); const [x, y, z] = pos();
        if (Math.hypot(v.x, v.y, v.z) > 0.25 && Math.hypot(x - st.pos.x, z - st.pos.z) < 1.6 && Math.abs(y - st.pos.y) < 2) {
          own = { id: me(), ts: Date.now() }; sentFinal = false; sendPose();
        }
      }
    }
    if (music.vid) tickVolume(false); else vol.last = occ(head(), pos(), music.range);
    const rm = mp?.room || null; if (lastRoom && rm !== lastRoom) resetLocal(); lastRoom = rm;
    const l = lookingAt(); near = (l.d < NEAR_UI || mode === 'held') && !st.seat; ui();
  });
  // keep the shared world matrix / probe code away from the speaker
  obj.userData.keep = true;

  // ---------------------------------------------------------------- UI
  const root = document.createElement('div'); root.id = 'spk';
  root.innerHTML = `
    <div id="spk-pill" class="spk-pill"></div>
    <div id="spk-drawer" class="spk-drawer">
      <button type="button" id="spk-tab" class="spk-tab" aria-label="Speaker" aria-expanded="false"><span id="spk-dot" class="spk-dot"></span><span class="spk-note">♪</span><span id="spk-mtitle" class="spk-tabchip"></span></button>
      <div id="spk-panel" class="spk-body" role="dialog" aria-label="Speaker">
        <div class="spk-head"><div><div class="spk-h1">Speaker</div><div class="spk-hud"><span class="k">SYNC::</span><span class="v">LOBBY</span></div></div><button type="button" id="spk-x" class="spk-ghost" title="Close (Esc)" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
        <div class="spk-yt-host"><div id="spk-yt"></div></div>
        <div class="spk-now"><div id="spk-title" class="spk-chip"></div><div id="spk-by" class="spk-chip"></div></div>
        <div class="spk-row"><input id="spk-url" type="text" spellcheck="false" autocomplete="off" placeholder="Paste a YouTube link…"><button type="button" id="spk-go">Play</button></div>
        <div class="spk-row"><button type="button" id="spk-pp">Play</button><button type="button" id="spk-stop">Stop</button><label class="spk-vol"><span class="k">VOL::</span><input id="spk-vol" type="range" min="0" max="1" step="0.01"></label></div>
        <div class="spk-row"><div id="spk-seg" class="spk-seg" data-v="house" role="tablist" aria-label="Who hears it"><span class="spk-seg-pill"></span><button type="button" data-r="house" role="tab"><span class="k">RANGE::</span><span class="v">HOUSE</span></button><button type="button" data-r="room" role="tab"><span class="k">RANGE::</span><span class="v">ROOM</span></button></div></div>
        <div id="spk-seg-help" class="spk-help"></div>
        <div id="spk-err" class="spk-err"></div>
      </div>
    </div>
    <button type="button" id="spk-unblock" class="spk-unblock">Click to hear the music</button>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  const els = { pill: $('spk-pill'), panel: $('spk-panel'), url: $('spk-url'), title: $('spk-title'), by: $('spk-by'), err: $('spk-err'), vol: $('spk-vol'), mini: $('spk-drawer'), mtitle: $('spk-mtitle'), unblock: $('spk-unblock'), pp: $('spk-pp') };
  els.vol.value = String(vol.panel);
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  on('spk-go', () => { if (playUrl(els.url.value)) els.url.value = ''; });
  on('spk-pp', togglePlay); on('spk-stop', stop); on('spk-x', () => openPanel(false));
  for (const b of root.querySelectorAll('#spk-seg button')) b.addEventListener('click', (e) => { e.stopPropagation(); setRange(b.dataset.r); });
  on('spk-unblock', unblock); on('spk-tab', () => openPanel(!panelOpen));
  els.vol.addEventListener('input', () => { vol.panel = +els.vol.value; try { localStorage.setItem('ph.speaker.vol', String(vol.panel)); } catch {} if (music.vid) tickVolume(true); });
  els.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (playUrl(els.url.value)) els.url.value = ''; } });
  // nothing typed or clicked in the speaker UI reaches the game's key / pointer handlers
  for (const el of [els.mini, els.unblock]) {
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); openPanel(false); } e.stopPropagation(); });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => e.stopPropagation());
  }
  let panelOpen = false, errT = 0;
  function openPanel(v) {
    panelOpen = v; els.mini.classList.toggle('open', v); $('spk-tab').setAttribute('aria-expanded', String(v)); document.body.classList.toggle('spk-open', v);
    if (v) { document.body.classList.add('ui-open'); st.keys.clear(); try { document.exitPointerLock?.(); } catch {} setTimeout(() => els.url.focus(), 0); }
    else { document.body.classList.remove('ui-open'); els.url.blur(); }
    ui();
  }
  function showErr(t) { els.err.textContent = t; errT = t ? performance.now() + 8000 : 0; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let uiKey = '', rollText = null, rollHtml = '';
  // per-character slot roll (CSS .spk-roll), rebuilt only when the text changes
  const setHtml = (el, h) => { if (el.__h !== h) { el.__h = h; el.innerHTML = h; } }; // no re-roll unless the text changed
  function roll(t) { if (t !== rollText) { rollText = t; rollHtml = '<span class="spk-roll">' + [...t].slice(0, 80).map((c, i) => '<span style="--i:' + i + '">' + esc(c) + '</span>').join('') + '</span>'; } return rollHtml; }
  function ui() {
    if (errT && performance.now() > errT) showErr('');
    const pill = !panelOpen && (near || mode === 'held');
    const pillHtml = mode === 'held' ? '<span class="k">SPEAKER::</span><span class="v">CARRYING</span> <kbd>Q</kbd> drop · run+<kbd>Q</kbd> throw · <kbd>Y</kbd> music'
      : '<span class="k">SPEAKER::</span><span class="v">NEARBY</span> <kbd>Y</kbd> music · <kbd>Q</kbd> pick up';
    const nowT = music.vid ? (ytErr ? 'Can\'t play this video' : title || 'Loading…') : 'Nothing playing';
    const k = [pill, pillHtml, nowT, music.by, music.playing, blocked, panelOpen, ytErr, music.range].join('|'); if (k === uiKey) return; uiKey = k;
    els.pill.classList.toggle('on', pill); setHtml(els.pill, pillHtml);
    setHtml(els.title, '<span class="k">NOW::</span><span class="v">' + roll(nowT) + (music.vid && !music.playing ? ' (paused)' : '') + '</span>');
    setHtml(els.by, music.vid && music.by ? '<span class="k">BY::</span><span class="name">' + esc(music.by) + '</span>' : ''); els.by.hidden = !(music.vid && music.by);
    setHtml(els.mtitle, '<span class="k">NOW::</span><span class="v">' + esc(nowT) + '</span>'); root.querySelector('#spk-dot').classList.toggle('live', !!(music.playing && !ytErr && !blocked));
    els.unblock.classList.toggle('on', !!(music.vid && blocked));
    const seg = $('spk-seg'); seg.dataset.v = music.range; for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.r === music.range));
    $('spk-seg-help').textContent = music.range === 'house' ? 'Everyone hears it anywhere in the house' : 'Realistic: fades with distance and walls';
    els.pp.textContent = music.playing ? 'Pause' : 'Play';
    root.dataset.state = esc(mode);
  }
  addEventListener('keydown', (e) => {
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (e.repeat) return;
    if (panelOpen) { if (e.code === 'Escape' || e.code === 'KeyY') { e.preventDefault(); openPanel(false); } return; }
    if (document.body.classList.contains('ui-open') || document.body.classList.contains('watching')) return;
    if (e.code === 'KeyQ') { if (mode === 'held') drop(); else pickup(); }
    else if (e.code === 'KeyY' && (near || mode === 'held')) { e.preventDefault(); openPanel(true); }
  });
  // Esc also on keyup: while the pause menu is up it swallows Esc keydown (capture phase), one press closes both
  addEventListener('keyup', (e) => { if (e.key === 'Escape' && panelOpen) openPanel(false); }, true);
  // any click anywhere counts as a user gesture: retry a blocked play
  addEventListener('pointerdown', () => { if (blocked) unblock(); }, true);

  // ---------------------------------------------------------------- api / test hooks
  ch.send({ t: 'hello' });
  const api = {
    obj, body, parseYouTube, pickup, drop, playUrl, togglePlay, stop, openPanel,
    gainAt: (h, s, range) => occ(h, s || pos(), range || music.range), setRange, resetLocal,
    get yt() { if (!yt || !ytReady) return null; try { return { state: yt.getPlayerState(), time: yt.getCurrentTime(), muted: yt.isMuted(), volume: yt.getVolume(), vid: yt.getVideoData?.()?.video_id || null }; } catch { return null; } },
    get held() { return mode === 'held'; }, get mode() { return mode; }, get owner() { return own; },
    get pos() { return pos(); }, get near() { return near; }, get volume() { return { ...vol.last, cur: vol.cur, panel: vol.panel } },
    get music() { return { ...music, expected: expected(), title, blocked, error: ytErr, ready: ytReady }; },
    get shim() { return !!net.shim; }, get selfId() { return me(); },
  };
  window.__speaker = api;
  return api;
}
