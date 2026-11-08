// Video spots: the phone videos filmed at this house (data: src/videos/spots.js), each placed where it was shot.
//  - Cards: a small bobbing poster sprite (▶) at every spot's camera position, visible within 12 m on the same
//    level; poster textures load lazily within 25 m. One Sprite per spot, no lights, no shadows.
//  - Watch (C = "cinema" — V is the third-person camera toggle; within 3 m of a card, or the HUD button):
//    player frozen, camera flies (1.2 s) to the matched phone pose (position, look, roll, vertical fov), the clip
//    plays with sound on a 9:16 panel that exactly fills the camera's vertical fov at the subject distance D
//    (so from there it lines up with the 3D house), holds 2.5 s, then dollies back/up (3 s, ray-cast so it never
//    goes through a wall) to reveal the panel in the world. ← lined up · → zoomed out · R re-create · C/Esc back.
//  - Re-create: every spot is also a Re-create scene (src/recreate/scenes.js); while one plays, everyone near
//    it sees the panel MUTED and synced to the scene's start time (the audio comes from src/recreate.js).
// <video> elements + VideoTextures exist only while a panel is shown (disposed afterwards).
// Test hooks: window.__videos.
import * as THREE from 'three';
import { SPOTS } from './videos/spots.js';
import { subjectDistance } from './videos/geom.js';

const DEG = Math.PI / 180;
const NEAR_WATCH = 3, CARD_SHOW = 12, CARD_LOAD = 25, CARD_H = 0.35;
const T_IN = 1.2, T_HOLD = 2.5, T_OUT = 3.0, T_SWITCH = 1.2, T_EXIT = 1.0, T_FADE = 0.5;
const SEEK_LEAD = 0.15; // s: a seek + play() takes ~0.1-0.3 s to show frames; playbackRate nudging trims the rest
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function startVideos(ctx, mp) {
  const { scene, camera, player, phys } = ctx; if (!player || ctx.shot) return null;
  const rc = mp?.recreate || null;
  const levelOf = (y) => (y > 2.5 ? 1 : 0);
  const byId = new Map(SPOTS.map(s => [s.id, s]));

  // video colours: undo the global exposure (1.18) and the white-balance tint of the output pass so the clip
  // looks like the phone footage (neutral tone mapping is ~linear below 0.76)
  const wb = ctx.LIGHT?.whiteBalance || [1, 1, 1], ex = ctx.LIGHT?.exposure || 1;
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const inv = wb.map(v => 1 / v); const n = lum(wb) * lum(inv);
  const VIDEO_TINT = new THREE.Color(inv[0] / n / ex, inv[1] / n / ex, inv[2] / n / ex);

  // ---------------------------------------------------------------- poses
  const dummy = new THREE.PerspectiveCamera();
  function linedPose(spot) {
    const c = spot.cam; dummy.position.set(...c.pos); dummy.up.set(0, 1, 0); dummy.quaternion.identity(); dummy.lookAt(new THREE.Vector3(...c.look));
    if (c.roll) dummy.rotateZ(-c.roll * DEG); // + = phone tilted clockwise (same as main.js setCam)
    return { pos: dummy.position.clone(), quat: dummy.quaternion.clone(), fov: c.fov };
  }
  const R = phys.RAPIER; const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const RAY_FL = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  function freeLen(from, dir, max) {
    ray.origin.x = from.x; ray.origin.y = from.y; ray.origin.z = from.z; ray.dir.x = dir.x; ray.dir.y = dir.y; ray.dir.z = dir.z;
    const hit = phys.world.castRay(ray, max, true, RAY_FL, undefined, player.collider);
    return hit ? Math.max(0, hit.timeOfImpact - 0.3) : max;
  }
  function zoomPose(spot, lined, D) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(lined.quat);
    const centre = lined.pos.clone().addScaledVector(fwd, D);
    const up = new THREE.Vector3(0, 1, 0);
    // preferred: back 4 m + up 1 m; fall back to shorter / steeper moves when a wall is close behind
    const cands = [[4, 1], [3, 0.6], [2.5, 1.4], [0, 1.2]].map(([b, u]) => new THREE.Vector3().addScaledVector(fwd, -b).addScaledVector(up, u));
    let best = null, bestLen = -1;
    for (const off of cands) {
      const L = off.length(), dir = off.clone().normalize(); const free = freeLen(lined.pos, dir, L);
      if (free >= 0.7 * L) { best = lined.pos.clone().addScaledVector(dir, free); break; }
      if (free > bestLen) { bestLen = free; best = lined.pos.clone().addScaledVector(dir, free); }
    }
    dummy.position.copy(best); dummy.up.set(0, 1, 0); dummy.quaternion.identity(); dummy.lookAt(centre);
    return { pos: best, quat: dummy.quaternion.clone(), fov: spot.cam.fov, centre };
  }

  // ---------------------------------------------------------------- cards
  const cards = SPOTS.map((spot, i) => {
    const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0, color: 0xe8e8e8 });
    const s = new THREE.Sprite(mat); s.name = 'video-card:' + spot.id; s.visible = false; s.userData.keep = true;
    s.scale.set(CARD_H * 9 / 16, CARD_H, 1); s.position.set(...spot.cam.pos); s.renderOrder = 5; scene.add(s);
    return { spot, s, mat, phase: i * 1.7, loading: false, ready: false, at: new THREE.Vector3(...spot.cam.pos) };
  });
  // spots filmed from the same place (e.g. two takes): spread their cards sideways so both can be picked
  cards.forEach((c, i) => {
    const k = cards.slice(0, i).filter(o => o.at.distanceTo(new THREE.Vector3(...o.spot.cam.pos)) < 0.01 && new THREE.Vector3(...o.spot.cam.pos).distanceTo(c.at) < 0.3).length;
    if (!k) return; const f = new THREE.Vector3(...c.spot.cam.look).sub(c.at).setY(0).normalize();
    c.at.add(new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(0.28 * k));
  });
  function loadCard(c) {
    c.loading = true; const img = new Image();
    img.onload = () => {
      const W = 180, H = 320, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      rr(0, 0, W, H, 18); g.fillStyle = '#fff'; g.fill();
      g.save(); rr(6, 6, W - 12, H - 12, 13); g.clip(); g.drawImage(img, 6, 6, W - 12, H - 12);
      const gr = g.createLinearGradient(0, H * 0.55, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
      g.beginPath(); g.arc(W / 2, H / 2, 34, 0, Math.PI * 2); g.fillStyle = 'rgba(14,20,28,.62)'; g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
      g.beginPath(); g.moveTo(W / 2 - 11, H / 2 - 17); g.lineTo(W / 2 + 19, H / 2); g.lineTo(W / 2 - 11, H / 2 + 17); g.closePath(); g.fillStyle = '#fff'; g.fill();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      c.mat.map = t; c.mat.needsUpdate = true; c.ready = true; c.tex = t; c.img = img;
    };
    img.onerror = () => { console.warn('[videos] poster', c.spot.poster); };
    img.src = c.spot.poster;
  }

  // ---------------------------------------------------------------- panels (one per spot while shown)
  let frameTex = null;
  function frameTexture() { // soft-edged white frame (alpha falls off outward), drawn once
    if (frameTex) return frameTex;
    const W = 144, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.shadowColor = 'rgba(255,255,255,1)'; g.shadowBlur = 9; g.fillStyle = 'rgba(255,255,255,.95)';
    g.fillRect(9, 9, W - 18, H - 18);
    frameTex = new THREE.CanvasTexture(cv); frameTex.colorSpace = THREE.SRGBColorSpace; return frameTex;
  }
  const panels = new Map(); // spotId -> panel
  function makePanel(spot, mode) {
    const D = subjectDistance(spot), lined = linedPose(spot);
    const h = 2 * D * Math.tan(spot.cam.fov * DEG / 2), w = h * 9 / 16;
    const video = document.createElement('video');
    video.playsInline = true; video.preload = 'auto'; video.loop = mode === 'watch'; video.muted = mode !== 'watch';
    video.setAttribute('playsinline', ''); video.src = spot.src;
    const vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace;
    const card = cards.find(c => c.spot === spot);
    const mat = new THREE.MeshBasicMaterial({ color: VIDEO_TINT, map: card?.tex || null, transparent: true, opacity: 0, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(w, h);
    if (card?.img) { // until the first video frame: the poster (no black flash)
      const pt = new THREE.Texture(card.img); pt.colorSpace = THREE.SRGBColorSpace; pt.needsUpdate = true; mat.map = pt; mat.userData.poster = pt;
    }
    const group = new THREE.Group(); group.name = 'video-panel:' + spot.id; group.userData.keep = true;
    group.position.copy(lined.pos); group.quaternion.copy(lined.quat);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.z = -D; mesh.renderOrder = 6; group.add(mesh);
    const b = h * 0.022; const fgeo = new THREE.PlaneGeometry(w + 2 * b * 1.6, h + 2 * b * 1.6);
    const fmat = new THREE.MeshBasicMaterial({ map: frameTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, color: 0xdddddd });
    const frame = new THREE.Mesh(fgeo, fmat); frame.position.z = -D - Math.max(0.004, D * 0.002); frame.renderOrder = 5; group.add(frame);
    scene.add(group);
    const onFrame = () => { if (mat.map !== vtex) { mat.userData.poster?.dispose(); mat.map = vtex; mat.needsUpdate = true; } };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame); else video.addEventListener('playing', onFrame, { once: true });
    const p = { spot, mode, D, w, h, group, mesh, mat, fmat, video, vtex, opacity: 0, want: 0, dead: false, lined };
    panels.set(spot.id, p); return p;
  }
  function setOpacity(p, o) { p.opacity = o; p.mat.opacity = o; p.fmat.opacity = o * 0.85; p.group.visible = o > 0.003; }
  function disposePanel(p) {
    if (p.dead) return; p.dead = true;
    try { p.video.pause(); p.video.removeAttribute('src'); p.video.load(); } catch {}
    scene.remove(p.group); for (const m of p.group.children) m.geometry.dispose();
    p.mat.userData.poster?.dispose(); p.vtex.dispose(); p.mat.dispose(); p.fmat.dispose();
    if (panels.get(p.spot.id) === p) panels.delete(p.spot.id);
  }

  // ---------------------------------------------------------------- watch flow
  const st = player.state;
  let W = null; // { spot, panel, phase, tw, holdT, saved, lined, zoom, lockedAtStart }
  const live = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 70 };
  const curPose = () => ({ pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov });
  function tween(to, dur, next) { W.tw = { a: curPose(), b: to, dur, t: 0, next }; }
  function enter(id) {
    const spot = byId.get(id); if (!spot || W) return false;
    if (document.body.classList.contains('ui-open')) return false;
    const old = panels.get(id); if (old) disposePanel(old);
    const panel = makePanel(spot, 'watch');
    const lined = linedPose(spot); const zoom = zoomPose(spot, lined, panel.D);
    W = { spot, panel, phase: 'in', target: 'lined', tw: null, holdT: 0, lined, zoom, lockedAtStart: !!document.pointerLockElement,
      saved: { fov: camera.fov, yaw: st.yaw, pitch: st.pitch } };
    st.frozen = true; st.keys.clear();
    // start the clip a little before the matched moment (cam.t) so the lined-up frame shows during the hold
    W.startAt = Math.max(0, Math.min(spot.duration - 0.5, (spot.cam.t || 0) - 1.0));
    try { panel.video.currentTime = W.startAt; } catch {}
    tween(lined, T_IN, () => { W.phase = 'hold'; W.holdT = 0; playWatch(); });
    rc?.focus(id);
    document.body.classList.add('watching'); hud(true);
    return true;
  }
  function playWatch() {
    const v = W.panel.video; v.muted = false;
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => {}); flash('Sound blocked — click to unmute'); });
  }
  function view(which) {
    if (!W || W.phase === 'exit') return;
    if (W.phase === 'in') return;
    if (W.phase === 'hold' && which === 'lined') return;
    const to = which === 'zoomed' ? W.zoom : W.lined; const dur = which === 'zoomed' && W.phase === 'hold' ? T_OUT : T_SWITCH;
    W.phase = 'move'; W.target = which; tween(to, dur, () => { W.phase = which; });
  }
  function exit(then) {
    if (!W || W.phase === 'exit') return;
    W.phase = 'exit'; W.then = then || null;
    W.tw = { a: curPose(), b: null, dur: T_EXIT, t: 0, next: finish }; // b null = live player pose, read every frame
  }
  function finish() {
    const w = W; W = null;
    disposePanel(w.panel);
    camera.fov = w.saved.fov; camera.updateProjectionMatrix();
    st.yaw = w.saved.yaw; st.pitch = w.saved.pitch; st.frozen = false; st.keys.clear();
    document.body.classList.remove('watching'); hud(true);
    if (w.then) try { w.then(); } catch (e) { console.warn('[videos]', e); }
  }
  function recreateFromWatch() {
    if (!W || !rc) return; const id = W.spot.id;
    exit(() => { rc.focus(id); rc.take(id); });
  }

  // ---------------------------------------------------------------- Re-create: muted synced panel
  const rcPlays = new Map(); // spotId -> start (local perf ms)
  rc?.onPlay((sid, start) => { if (!byId.has(sid)) return; if (start === null) rcPlays.delete(sid); else rcPlays.set(sid, start); });
  function rcUpdate(dt, now) {
    for (const [sid, p] of panels) if (p.mode === 'rc' && !rcPlays.has(sid)) { p.want = 0; }
    for (const [sid, start] of rcPlays) {
      if (W && W.spot.id === sid) continue;
      const spot = byId.get(sid); const sc = rc.scenes.find(s => s.id === sid);
      const pp = player.position; const [x0, z0, x1, z1] = sc.area;
      const inArea = levelOf(pp.y) === spot.level && pp.x >= x0 - 3 && pp.x <= x1 + 3 && pp.z >= z0 - 3 && pp.z <= z1 + 3;
      const show = rc.seat?.s === sid || inArea;
      let p = panels.get(sid);
      if (!show) { if (p && p.mode === 'rc') p.want = 0; continue; }
      if (!p || p.dead) p = makePanel(spot, 'rc');
      if (p.mode !== 'rc') continue;
      p.want = 1;
      const t = (now - start) / 1000, v = p.video;
      if (t < 0) { if (!v.paused) v.pause(); if (v.currentTime > 0.05 && v.readyState >= 1) v.currentTime = 0; continue; }
      if (t >= spot.duration) { p.want = 0; continue; }
      // follow the scene clock: seek when far off, otherwise nudge playbackRate (no seek stalls)
      if (v.paused && v.readyState >= 1) { v.currentTime = t + SEEK_LEAD; v.play().catch(() => {}); p.syncT = now; }
      else if (!v.paused && v.readyState >= 2) {
        const err = v.currentTime - t;
        if (Math.abs(err) > 0.2 && now - (p.syncT || 0) > 600) { p.syncT = now; v.currentTime = t + SEEK_LEAD; v.playbackRate = 1; }
        else if (now - (p.rateT || 0) > 250) { // a few discrete rates, changed at most 4x/s (each change resets the pipeline)
          p.rateT = now; const r = Math.abs(err) < 0.03 ? 1 : err < 0 ? (err < -0.1 ? 1.1 : 1.04) : (err > 0.1 ? 0.9 : 0.96);
          if (v.playbackRate !== r) v.playbackRate = r;
        }
      }
    }
  }

  // ---------------------------------------------------------------- HUD (#vs)
  const root = document.getElementById('vs') || Object.assign(document.createElement('div'), { id: 'vs' });
  if (!root.parentNode) document.body.appendChild(root);
  root.innerHTML = `
    <button type="button" id="vs-watch" class="vs-pill"></button>
    <div class="vs-card" id="vs-bar">
      <div class="vs-title" id="vs-title"></div>
      <div class="vs-row">
        <button type="button" id="vs-lined">◀ Line up</button>
        <button type="button" id="vs-zoom">Zoom out ▶</button>
        <button type="button" id="vs-rc">🎬 Re-create <kbd>R</kbd></button>
        <button type="button" id="vs-back" class="ghost">Back <kbd>C</kbd></button>
      </div>
      <div class="vs-help">C/Esc back · R re-create · ←/→ line up / zoom out</div>
      <div class="vs-msg" id="vs-msg"></div>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const els = { watch: $('vs-watch'), bar: $('vs-bar'), title: $('vs-title'), msg: $('vs-msg'), rc: $('vs-rc') };
  const click = (el, fn) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(); el.blur(); });
  click(els.watch, () => near && enter(near.spot.id)); click($('vs-back'), () => exit()); click($('vs-lined'), () => view('lined'));
  click($('vs-zoom'), () => view('zoomed')); click(els.rc, recreateFromWatch);
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  els.bar.addEventListener('click', () => { if (W && W.panel.video.muted) { W.panel.video.muted = false; } });
  let msgT = 0; function flash(t) { els.msg.textContent = t; msgT = performance.now() + 3000; }
  let hudKey = '';
  function hud(force) {
    const k = W ? 'w:' + W.spot.id : near ? 'n:' + near.spot.id : '';
    if (!force && k === hudKey && !(msgT && performance.now() > msgT)) return; hudKey = k;
    if (msgT && performance.now() > msgT) { els.msg.textContent = ''; msgT = 0; }
    root.classList.toggle('near', !W && !!near); root.classList.toggle('on', !!W);
    if (near && !W) els.watch.innerHTML = `▶ Watch: ${esc(near.spot.title)} <kbd>C</kbd>`;
    if (W) { els.title.textContent = W.spot.title; els.rc.hidden = !rc; }
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // keys: capture phase so R / arrows don't also reach Re-create / the player while watching
  addEventListener('keydown', (e) => {
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (document.body.classList.contains('ui-open')) return;
    if (W) {
      const c = e.code; let used = true;
      if (c === 'KeyC' || c === 'Escape') { if (!e.repeat) exit(); }
      else if (c === 'KeyR') { if (!e.repeat) recreateFromWatch(); }
      else if (c === 'ArrowLeft') view('lined');
      else if (c === 'ArrowRight') view('zoomed');
      else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'Space', 'KeyE', 'KeyV', 'KeyX', 'Enter'].includes(c)) { /* swallowed while watching */ }
      else used = false;
      if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (e.code === 'KeyC' && !e.repeat && near && !st.swimming) { e.preventDefault(); e.stopImmediatePropagation(); enter(near.spot.id); }
  }, true);
  document.addEventListener('pointerlockchange', () => { if (W && W.lockedAtStart && !document.pointerLockElement) exit(); });

  // ---------------------------------------------------------------- per frame
  let near = null; const tmpV = new THREE.Vector3(), camFwd = new THREE.Vector3();
  ctx.onUpdate((dt, t) => {
    const now = performance.now();
    // live player camera pose (player.update ran just before us) = where an exit flies back to
    live.pos.copy(camera.position); live.quat.copy(camera.quaternion); live.fov = W ? W.saved.fov : camera.fov;

    // cards
    const pp = player.position, lv = levelOf(pp.y); let best = null, bs = Infinity;
    const hideAt = W ? W.spot.cam.pos : null;
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    for (const c of cards) {
      const sp = c.at; const dx = sp.x - pp.x, dz = sp.z - pp.z; const d = Math.hypot(dx, dz);
      const same = c.spot.level === lv;
      if (!c.loading && same && d < CARD_LOAD) loadCard(c);
      let show = same && d < CARD_SHOW && c.ready;
      if (hideAt && Math.hypot(sp.x - hideAt[0], sp.y - hideAt[1], sp.z - hideAt[2]) < 1.0) show = false;
      if (rcPlays.has(c.spot.id)) show = false;
      if (!show) { if (c.s.visible) c.s.visible = false; continue; }
      c.s.visible = true;
      c.mat.opacity = Math.min(1, (CARD_SHOW - d) / 2);
      c.s.position.set(sp.x, sp.y + Math.sin(t * 1.6 + c.phase) * 0.035, sp.z);
      if (d < NEAR_WATCH && Math.abs(sp.y - (pp.y + 1.3)) < 1.5) { // pick the card you look at (then the nearest)
        tmpV.copy(sp).sub(camera.position).normalize(); const score = d * 0.15 + (1 - tmpV.dot(camFwd));
        if (score < bs) { bs = score; best = c; }
      }
    }
    near = st.seat ? null : best;

    // watch camera
    if (W) {
      st.yaw = W.saved.yaw; st.pitch = W.saved.pitch;
      if (W.tw) {
        const tw = W.tw; tw.t += dt; const k = ease(Math.min(1, tw.t / tw.dur)); const b = tw.b || live;
        camera.position.lerpVectors(tw.a.pos, b.pos, k); camera.quaternion.slerpQuaternions(tw.a.quat, b.quat, k);
        camera.fov = tw.a.fov + (b.fov - tw.a.fov) * k;
        if (tw.t >= tw.dur) { W.tw = null; tw.next?.(); }
      } else if (W.phase === 'hold') {
        camera.position.copy(W.lined.pos); camera.quaternion.copy(W.lined.quat); camera.fov = W.lined.fov;
        W.holdT += dt; if (W.holdT >= T_HOLD) { W.phase = 'move'; W.target = 'zoomed'; tween(W.zoom, T_OUT, () => { W.phase = 'zoomed'; }); }
      } else if (W.phase === 'zoomed' || W.phase === 'lined') {
        const p = W.phase === 'zoomed' ? W.zoom : W.lined; camera.position.copy(p.pos); camera.quaternion.copy(p.quat); camera.fov = p.fov;
      }
      if (W) { camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
      // panel fade: in over the last part of the fly-in, out on exit
      // lined up: the clip covers the frame even where 3D furniture sits between the lens and the panel;
      // from the zoomed-out view (and on exit) the panel is depth-tested like any object in the room
      if (W) { const dt0 = W.phase === 'exit' || W.target === 'zoomed'; W.panel.mat.depthTest = dt0; W.panel.fmat.depthTest = dt0; }
      if (W) { const p = W.panel; p.want = W.phase === 'exit' ? 0 : (W.phase === 'in' ? (W.tw && W.tw.t > T_IN * 0.6 ? 1 : 0) : 1); }
    }

    rcUpdate(dt, now);
    for (const p of [...panels.values()]) {
      const target = p.want, o = p.opacity + Math.sign(target - p.opacity) * Math.min(Math.abs(target - p.opacity), dt / (target ? T_FADE : 0.4));
      if (o !== p.opacity) setOpacity(p, o);
      if (target === 0 && o <= 0.003 && !(W && W.panel === p)) disposePanel(p);
    }
    hud(false);
  });

  // ---------------------------------------------------------------- test / debug hooks
  const api = {
    spots: SPOTS, enter, exit, view,
    get phase() { return W ? W.phase : 'idle'; },
    get spot() { return W ? W.spot.id : null; },
    get near() { return near ? near.spot.id : null; },
    get lined() { return W ? { pos: W.lined.pos.toArray(), quat: W.lined.quat.toArray(), fov: W.lined.fov } : null; },
    get zoom() { return W ? { pos: W.zoom.pos.toArray(), centre: W.zoom.centre.toArray() } : null; },
    get video() { const p = W ? W.panel : [...panels.values()][0]; return p ? { id: p.spot.id, mode: p.mode, t: p.video.currentTime, paused: p.video.paused, muted: p.video.muted, ready: p.video.readyState, opacity: p.opacity, D: p.D, w: p.w, h: p.h, visible: p.group.visible, centre: p.mesh.getWorldPosition(tmpV).toArray() } : null; },
    get panels() { return [...panels.keys()]; },
    linedPose, cards,
  };
  window.__videos = api;
  return api;
}
