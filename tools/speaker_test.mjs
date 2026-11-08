#!/usr/bin/env node
// Speaker feature test (headless Chrome, ONE browser).
//   node tools/speaker_test.mjs [--sync]
// Checks: the speaker exists and settles on the kitchen bar island; Q picks it up (held follows the player),
// Q drops it; room-volume ordering near > far > behind a wall (> other storey); the YouTube URL parser accepts
// every format; the Y panel opens and typing in it doesn't move the player; a play request doesn't crash
// (headless may not actually play YouTube). --sync opens a second page in the same browser context and checks
// it sees the dropped speaker's position (BroadcastChannel fallback or the real lobby channel).
// Screenshot -> shots/speaker.png. 0 console errors (relay / websocket / YouTube-iframe noise ignored).
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
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed|youtube|googlevideo|doubleclick|ytimg|postMessage/i;
const code = 'spk-' + Math.random().toString(36).slice(2, 7);
async function open() {
  const page = await context.newPage();
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}&only=family,kitchen&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp, null, { timeout: 180000, polling: 250 });
  // until the lead wires startSpeaker into multiplayer.js, start it here
  await page.evaluate(async () => { if (!window.__speaker) { const m = await import('/src/speaker.js'); m.startSpeaker(window.__mp.ctx, window.__mp); } });
  await sleep(2500); // let it fall onto the island and sleep
  return { page, logs };
}
const res = { test: 'speaker', room: code }; let bad = false; const checks = {};
try {
  const A = await open(); const P = A.page;
  // 1. exists
  const s0 = await P.evaluate(() => { const s = window.__speaker; let meshes = 0; s.obj.traverse(o => { if (o.isMesh) meshes++; }); return { pos: s.pos.map(v => +v.toFixed(3)), mode: s.mode, meshes, inScene: !!s.obj.parent, shim: s.shim, sleeping: s.body.isSleeping() }; });
  res.spawn = s0; checks.exists = s0.inScene && s0.meshes > 5 && s0.pos[1] > 0.85 && s0.pos[1] < 1.2;
  // 2. pickup with Q: stand between the islands looking at it
  await P.evaluate(([x, , z]) => { const p = window.__player; p.teleport(x + 1.0, 0, z, Math.PI / 2); p.state.pitch = -0.5; }, s0.pos);
  await sleep(600);
  await P.keyboard.press('KeyQ'); await sleep(500);
  const h1 = await P.evaluate(() => ({ held: window.__speaker.held, owner: window.__speaker.owner, pill: document.getElementById('spk-pill').textContent }));
  // carry it: move the player, the speaker must follow (in front, ~0.7 m)
  await P.evaluate(() => window.__player.teleport(17.7, 0, 13.4, Math.PI));
  await sleep(800);
  const h2 = await P.evaluate(() => { const s = window.__speaker, p = window.__player.state.pos; return { held: s.held, pos: s.pos.map(v => +v.toFixed(2)), d: Math.hypot(s.pos[0] - p.x, s.pos[2] - p.z) }; });
  checks.pickup = h1.held && h2.held && h2.d < 1.2; res.pickup = { h1, h2 };
  await P.keyboard.press('KeyQ'); await sleep(3000);
  const d1 = await P.evaluate(() => { const s = window.__speaker; return { held: s.held, mode: s.mode, pos: s.pos.map(v => +v.toFixed(2)), sleeping: s.body.isSleeping() }; });
  checks.drop = !d1.held && d1.mode === 'free' && d1.pos[1] > -0.05 && d1.pos[1] < 0.5 && Math.hypot(d1.pos[0] - 17.7, d1.pos[2] - 14.1) < 1.0; res.drop = d1;
  // 3. room volume ordering (speaker position fixed at the island spawn for the comparison)
  const g = await P.evaluate((sp) => { const s = window.__speaker; const f = (h) => { const r = s.gainAt(h, sp, 'room'); return { gain: +r.gain.toFixed(4), dist: +r.dist.toFixed(2), walls: r.walls, furn: r.furniture, storey: r.storeyDiff }; };
    return { near: f([sp[0] + 1.0, 1.6, sp[2]]), far: f([20.6, 1.6, 12.0]), wall: f([19.5, 1.6, 9.0]), wallNear: f([sp[0], 1.6, 9.0]), upstairs: f([17.5, 4.95, 16.0]) }; }, [16.71, 1.0, 17.4]);
  res.gain = g; checks.volumeOrder = g.near.gain > g.far.gain && g.far.gain > g.wall.gain && g.wall.walls >= 1 && g.near.gain > 0.9 && g.upstairs.gain < g.far.gain;
  // 4. URL parser
  const urls = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s', 'youtu.be/dQw4w9WgXcQ?si=abc', 'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'];
  const badUrls = ['https://vimeo.com/123', 'hello', 'https://youtube.com/watch?v=short'];
  const parsed = await P.evaluate(([u, b]) => ({ ok: u.map(x => window.__speaker.parseYouTube(x)), bad: b.map(x => window.__speaker.parseYouTube(x)) }), [urls, badUrls]);
  checks.parser = parsed.ok.every(v => v === 'dQw4w9WgXcQ') && parsed.bad.every(v => v === null); res.parser = parsed;
  // 5. Y panel: opens near the speaker; typing WASD into it doesn't move the player
  await P.evaluate(() => { const s = window.__speaker.pos; window.__player.teleport(s[0] + 0.9, 0, s[2] + 0.9, Math.PI * 0.75); window.__player.state.pitch = -0.4; });
  await sleep(500);
  await P.keyboard.press('KeyY'); await sleep(300);
  const before = await P.evaluate(() => window.__player.state.pos.toArray());
  const panelOn = await P.evaluate(() => document.getElementById('spk-drawer').classList.contains('open') && document.activeElement?.id === 'spk-url');
  await P.keyboard.type('wwwwwwwwwwssssdddd', { delay: 25 }); await sleep(300);
  const after = await P.evaluate(() => window.__player.state.pos.toArray());
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
  await P.evaluate(() => { document.getElementById('spk-url').value = ''; });
  // 6. play request (headless may or may not play; must not throw)
  await P.fill('#spk-url', 'https://youtu.be/dQw4w9WgXcQ'); await P.keyboard.press('Enter'); await sleep(6000);
  const m = await P.evaluate(() => { const s = window.__speaker; return { music: s.music, vol: s.volume, err: document.getElementById('spk-err').textContent, mini: document.getElementById('spk-drawer').classList.contains('on'), iframe: !!document.querySelector('#spk-drawer iframe') }; });
  await P.screenshot({ path: path.join(ROOT, 'shots', 'speaker_panel.png') });
  checks.panel = panelOn && moved < 0.05 && m.music.vid === 'dQw4w9WgXcQ' && m.mini; res.panel = { panelOn, moved: +moved.toFixed(3), ...m };
  // 7. optional second page: sees the speaker where A put it
  if (opt.sync) {
    await P.keyboard.press('Escape');
    const B = await open();
    await sleep(2000);
    const [pa, pb] = await Promise.all([P.evaluate(() => window.__speaker.pos), B.page.evaluate(() => ({ pos: window.__speaker.pos, music: window.__speaker.music.vid, owner: window.__speaker.owner }))]);
    const err = Math.hypot(pa[0] - pb.pos[0], pa[1] - pb.pos[1], pa[2] - pb.pos[2]);
    res.sync = { A: pa.map(v => +v.toFixed(2)), B: pb, errM: +err.toFixed(3), errorsB: B.logs };
    checks.sync = err < 0.3 && pb.music === 'dQw4w9WgXcQ' && !B.logs.length;
    await B.page.close();
  }
  // screenshot: panel closed, look at the speaker (pill + mini-player visible)
  await P.evaluate(() => { window.__speaker.openPanel(false); const s = window.__speaker.pos; const p = window.__player; p.teleport(s[0] + 0.2, 0, s[2] - 1.3, 0); p.state.yaw = Math.atan2(-(s[0] - (s[0] + 0.2)), -(s[2] - (s[2] - 1.3))); p.state.pitch = -0.75; });
  await sleep(1500);
  await P.screenshot({ path: path.join(ROOT, 'shots', 'speaker.png') }); res.png = 'shots/speaker.png';
  res.checks = checks; res.errors = A.logs;
  if (Object.values(checks).some(v => !v) || A.logs.length) bad = true;
} catch (e) { res.error = e.stack || e.message; bad = true; }
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
