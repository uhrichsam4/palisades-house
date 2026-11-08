#!/usr/bin/env node
// Re-create feature test (headless Chrome, one browser, two pages in the same ?room=).
//   node tools/recreate_test.mjs [--full]   (default builds only the family room: ?only=family)
// A and B walk into the family-room demo area, both press R at once (must get different seats), A presses
// Enter, both must play the audio with start times within 150 ms; B must see A's avatar sitting at A's seat.
// B then stands up (X) and must land on a free, walkable spot. Screenshot -> shots/recreate_test.png.
// Runs under taskpolicy utility + the shared render-slot lock (shots/.locks) like walk_check.mjs.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext was not allowed/i;
const code = 'rctest-' + Math.random().toString(36).slice(2, 7);
async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}${opt.full ? '' : '&only=family'}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__recreate, null, { timeout: 180000, polling: 250 });
  await sleep(800);
  return { page, logs };
}
const res = { test: 'recreate', room: code }; let bad = false;
try {
  const A = await open(), B = await open();
  let connected = false;
  for (let i = 0; i < 90; i++) { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.peers.size), B.page.evaluate(() => window.__mp.peers.size)]); if (a >= 1 && b >= 1) { connected = true; break; } await sleep(1000); }
  res.connected = connected; if (!connected) throw new Error('no peer connection within 90 s');
  await A.page.evaluate(() => window.__player.teleport(4.0, 0, 14.4, Math.PI));
  await B.page.evaluate(() => window.__player.teleport(4.0, 0, 19.3, 0));
  await sleep(1000);
  res.inArea = [await A.page.evaluate(() => window.__recreate.scene), await B.page.evaluate(() => window.__recreate.scene)];
  res.buttonVisible = await A.page.evaluate(() => document.getElementById('rc').classList.contains('show') && document.getElementById('rc-take').textContent);
  // both press R at (nearly) the same time -> seat conflict, resolved deterministically
  await Promise.all([A.page.keyboard.press('KeyR'), B.page.keyboard.press('KeyR')]);
  await sleep(2500);
  const sa = await A.page.evaluate(() => ({ seat: window.__recreate.seat, claims: window.__recreate.claims, pose: window.__player.state.pose, pos: window.__player.state.pos.toArray(), seatPos: window.__player.state.seat?.pos }));
  const sb = await B.page.evaluate(() => ({ seat: window.__recreate.seat, claims: window.__recreate.claims, pose: window.__player.state.pose }));
  res.seats = { A: sa.seat, B: sb.seat, ids: [sa.claims.me, sb.claims.me] };
  res.seatCountText = await A.page.evaluate(() => document.getElementById('rc-in').textContent);
  const differentSeats = !!(sa.seat && sb.seat && sa.seat.i !== sb.seat.i);
  res.differentSeats = differentSeats;
  // A starts -> countdown 3 s -> both play
  await A.page.keyboard.press('Enter');
  await sleep(4500);
  const probe = (p) => p.evaluate(() => { const r = window.__recreate; return { playing: r.playing, t: +r.currentTime.toFixed(3), now: Date.now(), startWall: r.startWall, scheduledWall: r.scheduledWall, audio: r.audioState }; });
  const [pa, pb] = await Promise.all([probe(A.page), probe(B.page)]);
  const derivedA = pa.now - pa.t * 1000, derivedB = pb.now - pb.t * 1000;
  res.audio = { A: pa, B: pb, startWallDiffMs: pa.startWall && pb.startWall ? Math.round(Math.abs(pa.startWall - pb.startWall)) : null, scheduledDiffMs: Math.round(Math.abs(pa.scheduledWall - pb.scheduledWall)), derivedStartDiffMs: Math.round(Math.abs(derivedA - derivedB)) };
  const synced = pa.playing && pb.playing && res.audio.startWallDiffMs !== null && res.audio.startWallDiffMs <= 150 && res.audio.derivedStartDiffMs <= 150;
  // --late: page C joins while the scene is playing and must start at the right offset
  if (opt.late) {
    const C = await open();
    for (let i = 0; i < 12 && !(await C.page.evaluate(() => window.__mp.peers.size >= 2)); i++) await sleep(500);
    await C.page.evaluate(() => window.__player.teleport(3.6, 0, 18.8, -Math.PI / 2));
    await C.page.keyboard.press('KeyQ'); // any user gesture unlocks audio
    await sleep(1200);
    const [qa, qc] = await Promise.all([probe(A.page), probe(C.page)]);
    res.late = { C: qc, derivedStartDiffMs: qc.playing ? Math.round(Math.abs((qa.now - qa.t * 1000) - (qc.now - qc.t * 1000))) : null, errors: C.logs };
    if (!qc.playing || res.late.derivedStartDiffMs > 150 || C.logs.length) bad = true;
    await C.page.close();
  }
  // B's view of A: sit pose at A's seat
  const view = await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; return { pose: r.pose, pos: r.pos.toArray(), yaw: r.yaw, avatarPose: r.creature.pose }; });
  const posErr = Math.hypot(view.pos[0] - sa.seatPos[0], view.pos[1] - sa.seatPos[1], view.pos[2] - sa.seatPos[2]);
  res.bSeesA = { ...view, posErrM: +posErr.toFixed(3) };
  const seenSitting = view.pose === 'sit' && view.avatarPose === 'sit' && posErr < 0.05;
  // B stands up (X): must land on a free spot and be able to walk
  await B.page.keyboard.press('KeyX'); await sleep(700);
  const st = await B.page.evaluate(() => { const P = window.__player; const ph = window.__mp.ctx.phys, R = ph.RAPIER; const p = P.state.pos;
    let hits = 0; ph.world.intersectionsWithShape({ x: p.x, y: p.y + 0.06 + 0.83, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new R.Capsule(0.55, 0.28), (c) => { if (c.handle !== P.collider.handle && (!c.parent() || c.parent().isFixed())) hits++; return true; });
    return { pos: p.toArray().map(v => +v.toFixed(2)), pose: P.state.pose, seat: window.__recreate.seat, overlaps: hits }; });
  // not stuck: walking 0.8 s must cover > 0.5 m in at least one of 4 directions (back to the spot between tries)
  let walked = 0, after = null;
  for (const yaw of [Math.PI / 2, Math.PI, 0, -Math.PI / 2]) {
    await B.page.evaluate(([p, yaw]) => { const P = window.__player; P.teleport(p[0], p[1], p[2]); P.state.yaw = yaw; let t = 0; P.state.autopilot = (dt) => { t += dt; return { mz: t < 0.8 ? 1 : 0 }; }; }, [st.pos, yaw]);
    await sleep(1100);
    await B.page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); });
    const p1 = await B.page.evaluate(() => window.__player.state.pos.toArray().map(v => +v.toFixed(2)));
    const m = Math.hypot(p1[0] - st.pos[0], p1[2] - st.pos[2]); if (m > walked) { walked = m; after = p1; }
    if (m > 0.5) break;
  }
  res.standUp = { ...st, walkedM: +walked.toFixed(2), after };
  const standOk = st.pose === 'stand' && !st.seat && st.overlaps === 0 && res.standUp.walkedM > 0.5;
  res.countAfterStand = await A.page.evaluate(() => document.getElementById('rc-in').textContent);
  // screenshot: B looks at seated A (first person, a few metres in front of the sofa)
  await B.page.evaluate((s) => { const P = window.__player; P.teleport(3.9, 0, s[2] + 0.4); const dx = s[0] - 3.9, dz = s[2] - (s[2] + 0.4); P.state.yaw = Math.atan2(-dx, -dz); P.state.pitch = -0.2; }, sa.seatPos);
  await sleep(1500);
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'recreate_test.png') }); res.png = 'shots/recreate_test.png';
  res.checks = { differentSeats, synced, seenSitting, standOk };
  res.errorsA = A.logs; res.errorsB = B.logs;
  if (!differentSeats || !synced || !seenSitting || !standOk || A.logs.length || B.logs.length) bad = true;
} catch (e) { res.error = e.message; bad = true; }
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
