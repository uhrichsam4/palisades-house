#!/usr/bin/env node
// Video spots test (headless Chrome, ONE browser): src/videos.js watch flow + Re-create with a video.
//   node tools/videos_test.mjs [--spot=v13] [--skip-rc] [--skip-watch]
// Watch (full house): teleport next to the spot's card looking at it, press C -> after the fly-in the camera
// must equal the spot camera (pos err < 1 cm, same fov) and the clip must play; shots/videos_lined.png;
// after the zoom-out the camera is further back with the panel still in view: shots/videos_zoomed.png;
// C again -> camera back at the player, fov restored, WASD works. rAF interval over 2 s idle vs playing.
// Re-create (two pages, ?only=kitchen): both take seats in the spot's scene, A starts, audio start within
// 150 ms on both, both show the muted synced panel.
// Runs under taskpolicy utility + the shared render-slot locks (shots/.locks, SHOT_SLOTS) like tools/shot.mjs.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const SPOT = opt.spot || 'v13';
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (let waited = 0; !slot; waited++) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) { if (waited === 0) console.error('[videos_test] waiting for a free render slot…'); await new Promise(r => setTimeout(r, 1500)); }
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
// Range support: <video> needs it to seek
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || 'application/octet-stream'; const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-store' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext was not allowed/i;
async function open(q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__videos, null, { timeout: 180000, polling: 250 });
  await sleep(800);
  return { page, logs };
}
const rafMs = (page) => page.evaluate(() => new Promise(r => { const ts = []; const f = (t) => { ts.push(t); if (t - ts[0] < 2000) requestAnimationFrame(f); else { const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]); d.sort((a, b) => a - b); r({ avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), frames: d.length }); } }; requestAnimationFrame(f); }));
// stand 1.4 m behind the card (opposite its view direction, so we face roughly the same way) and look at it
const goNear = (page, id) => page.evaluate((id) => {
  const V = window.__videos, c = V.cards.find(c => c.spot.id === id), s = c.spot, at = c.at;
  let fx = s.cam.look[0] - s.cam.pos[0], fz = s.cam.look[2] - s.cam.pos[2]; const l = Math.hypot(fx, fz); fx /= l; fz /= l;
  const x = at.x - fx * 1.4, z = at.z - fz * 1.4, floor = s.level ? 3.35 : 0;
  const P = window.__player; P.state.thirdPerson = false; P.teleport(x, floor + 0.02, z, Math.atan2(-(at.x - x), -(at.z - z)));
  P.state.pitch = Math.atan2(at.y - (floor + 1.62), 1.4);
  return [x, z];
}, id);
const res = { test: 'videos', spot: SPOT }; let bad = false;

// ------------------------------------------------------------------ watch flow (full house)
if (!opt['skip-watch']) {
  const A = await open(`room=vtest-${process.pid}&fps=1`);
  try {
    await goNear(A.page, SPOT); await sleep(2500);
    await A.page.waitForFunction((id) => window.__videos.near === id, SPOT, { timeout: 15000 }).catch(() => {});
    res.near = await A.page.evaluate(() => window.__videos.near);
    res.frameIdle = await rafMs(A.page);
    const before = await A.page.evaluate(() => ({ fov: window.__dbg.camera.fov, pos: window.__player.state.pos.toArray() }));
    await A.page.keyboard.press('KeyC');
    await A.page.waitForFunction(() => window.__videos.phase === 'hold', null, { timeout: 5000 }).catch(() => {});
    await sleep(400);
    const lined = await A.page.evaluate((id) => {
      const cam = window.__dbg.camera, s = window.__videos.spots.find(s => s.id === id), V = window.__videos;
      const d = Math.hypot(cam.position.x - s.cam.pos[0], cam.position.y - s.cam.pos[1], cam.position.z - s.cam.pos[2]);
      const q = V.lined.quat; const dq = Math.abs(cam.quaternion.x * q[0] + cam.quaternion.y * q[1] + cam.quaternion.z * q[2] + cam.quaternion.w * q[3]);
      return { phase: V.phase, spot: V.spot, posErrM: +d.toFixed(5), fov: cam.fov, spotFov: s.cam.fov, rotErrDeg: +(2 * Math.acos(Math.min(1, dq)) * 180 / Math.PI).toFixed(4), video: V.video };
    }, SPOT);
    await sleep(700);
    const v2 = await A.page.evaluate(() => window.__videos.video);
    lined.videoAdvancing = !!(v2 && !v2.paused && v2.t > lined.video.t + 0.3); lined.t1 = v2?.t;
    await A.page.screenshot({ path: path.join(ROOT, 'shots', 'videos_lined.png') });
    res.lined = lined;
    await A.page.waitForFunction(() => window.__videos.phase === 'zoomed', null, { timeout: 8000 }).catch(() => {});
    await sleep(300);
    const zoomed = await A.page.evaluate((id) => {
      const cam = window.__dbg.camera, s = window.__videos.spots.find(s => s.id === id), V = window.__videos, THREE = cam.position.constructor;
      const back = Math.hypot(cam.position.x - s.cam.pos[0], cam.position.y - s.cam.pos[1], cam.position.z - s.cam.pos[2]);
      const c = new THREE(...V.video.centre).project(cam);
      return { phase: V.phase, camPos: cam.position.toArray().map(v => +v.toFixed(3)), backM: +back.toFixed(3), panelNdc: [c.x, c.y, c.z].map(v => +v.toFixed(3)), panelInView: Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z < 1, video: V.video };
    }, SPOT);
    res.zoomed = zoomed;
    await A.page.screenshot({ path: path.join(ROOT, 'shots', 'videos_zoomed.png') });
    res.framePlaying = await rafMs(A.page);
    await A.page.keyboard.press('KeyC');
    await A.page.waitForFunction(() => window.__videos.phase === 'idle', null, { timeout: 5000 }).catch(() => {});
    await sleep(300);
    const after = await A.page.evaluate(() => { const cam = window.__dbg.camera, p = window.__player.state.pos; return { phase: window.__videos.phase, fov: cam.fov, eyeErrM: +Math.hypot(cam.position.x - p.x, cam.position.y - (p.y + 1.62), cam.position.z - p.z).toFixed(4), panels: window.__videos.panels, frozen: !!window.__player.state.frozen, videos: document.querySelectorAll('video').length, pos: p.toArray() }; });
    await A.page.keyboard.down('KeyS'); await sleep(900); await A.page.keyboard.up('KeyS'); await sleep(300);
    const p2 = await A.page.evaluate(() => window.__player.state.pos.toArray());
    after.walkedM = +Math.hypot(p2[0] - after.pos[0], p2[2] - after.pos[2]).toFixed(2);
    after.fovBefore = before.fov; res.exit = after;
    res.checks = {
      near: res.near === SPOT,
      lined: lined.phase === 'hold' && lined.posErrM < 0.01 && lined.fov === lined.spotFov && lined.rotErrDeg < 0.1,
      playing: lined.videoAdvancing && lined.video && !lined.video.muted,
      zoomed: zoomed.phase === 'zoomed' && zoomed.backM > 1 && zoomed.panelInView,
      exit: after.phase === 'idle' && after.eyeErrM < 0.02 && after.fov === before.fov && !after.panels.length && !after.frozen && after.walkedM > 0.5,
    };
    res.errors = A.logs;
    if (Object.values(res.checks).some(v => !v) || A.logs.length) bad = true;
  } catch (e) { res.watchError = e.message; bad = true; }
  await A.page.close();
}

// ------------------------------------------------------------------ Re-create with the clip (two pages)
if (!opt['skip-rc']) {
  const rc = {}; res.recreate = rc;
  try {
    const code = 'vrc-' + Math.random().toString(36).slice(2, 7);
    const A = await open(`room=${code}&only=kitchen&noprobes=1`), B = await open(`room=${code}&only=kitchen&noprobes=1`);
    let connected = false;
    for (let i = 0; i < 90; i++) { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.peers.size), B.page.evaluate(() => window.__mp.peers.size)]); if (a >= 1 && b >= 1) { connected = true; break; } await sleep(1000); }
    rc.connected = connected; if (!connected) throw new Error('no peer connection within 90 s');
    // A: watch the clip, then R (re-create from the watch HUD). B: walks in, focuses the spot, presses R.
    await goNear(A.page, SPOT); await goNear(B.page, SPOT);
    await A.page.waitForFunction((id) => window.__videos.near === id, SPOT, { timeout: 15000 }).catch(() => {}); rc.nearA = await A.page.evaluate(() => window.__videos.near);
    await A.page.keyboard.press('KeyC'); await sleep(1800);
    await A.page.keyboard.press('KeyR'); await sleep(1600);
    await B.page.evaluate((id) => window.__recreate.focus(id), SPOT); await B.page.keyboard.press('KeyR'); await sleep(2000);
    const seat = (p) => p.evaluate(() => ({ seat: window.__recreate.seat, pose: window.__player.state.pose, pos: window.__player.state.pos.toArray().map(v => +v.toFixed(2)), watch: window.__videos.phase }));
    rc.seats = { A: await seat(A.page), B: await seat(B.page) };
    const seated = rc.seats.A.seat?.s === SPOT && rc.seats.B.seat?.s === SPOT && rc.seats.A.seat.i !== rc.seats.B.seat.i;
    await A.page.keyboard.press('Enter');
    await sleep(4800);
    const probe = (p) => p.evaluate(() => { const r = window.__recreate, v = window.__videos.video, el = document.querySelector('video'); return { rate: el?.playbackRate, dropped: el?.getVideoPlaybackQuality?.().droppedVideoFrames, playing: r.playing, t: +r.currentTime.toFixed(3), now: Date.now(), startWall: r.startWall, audio: r.audioState, panel: v && { mode: v.mode, t: +v.t.toFixed(3), paused: v.paused, muted: v.muted, opacity: +v.opacity.toFixed(2), visible: v.visible } }; });
    const [pa, pb] = await Promise.all([probe(A.page), probe(B.page)]);
    rc.A = pa; rc.B = pb;
    rc.startWallDiffMs = pa.startWall && pb.startWall ? Math.round(Math.abs(pa.startWall - pb.startWall)) : null;
    rc.derivedStartDiffMs = Math.round(Math.abs((pa.now - pa.t * 1000) - (pb.now - pb.t * 1000)));
    rc.videoVsAudioMs = { A: pa.panel ? Math.round((pa.panel.t - pa.t) * 1000) : null, B: pb.panel ? Math.round((pb.panel.t - pb.t) * 1000) : null };
    const synced = pa.playing && pb.playing && rc.startWallDiffMs !== null && rc.startWallDiffMs <= 150 && rc.derivedStartDiffMs <= 150;
    const panelOk = (x) => x.panel && x.panel.mode === 'rc' && !x.panel.paused && x.panel.muted && x.panel.visible && x.panel.opacity > 0.9;
    await sleep(1500); // let the rate nudging settle, then measure video vs audio again
    const [qa, qb] = await Promise.all([probe(A.page), probe(B.page)]);
    rc.videoVsAudioLaterMs = { A: qa.panel ? Math.round((qa.panel.t - qa.t) * 1000) : null, B: qb.panel ? Math.round((qb.panel.t - qb.t) * 1000) : null };
    await B.page.evaluate(() => { const s = window.__player.state; s.thirdPerson = true; s.yaw = s.seat.yaw + Math.PI; s.pitch = -0.12; });
    await sleep(600);
    await B.page.screenshot({ path: path.join(ROOT, 'shots', 'videos_rc.png') }); rc.png = 'shots/videos_rc.png';
    rc.checks = { seated, synced, panelA: !!panelOk(pa), panelB: !!panelOk(pb) };
    rc.errorsA = A.logs; rc.errorsB = B.logs;
    if (Object.values(rc.checks).some(v => !v) || A.logs.length || B.logs.length) bad = true;
  } catch (e) { rc.error = e.message; bad = true; }
}
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
