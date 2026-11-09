#!/usr/bin/env node
// Ping-pong (src/games/pingpong) test: ONE headless Chrome (utility QoS, shared render-slot locks, SHOT_SLOTS).
//   node tools/pingpong_test.mjs [--solo] [--online] [--speed=3]   (default: both)
// solo:   vs bot with the auto-player driving your paddle: a full game to 11 (win by 2) at --speed (sim time scale);
//         screenshots of a rally and the score UI / win card.
// online: A challenges B, B accepts, both auto-play at real speed; a rally of >= 5 hits must be logged identically
//         on both clients (same point, same hit count, same winner) and the scores must agree.
// Screenshots in shots/pingpong/. One JSON line; exit 1 on a failed check or page errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const ALLM = !opt.solo && !opt.online;
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.exr': 'application/octet-stream' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|\/src\/building\/|AudioContext|youtube|\[lobbies\]|pointer ?lock|\/src\/smash\//i;
const DIR = path.join(ROOT, 'shots', 'pingpong'); fs.mkdirSync(DIR, { recursive: true });
const code = 'pong' + Math.random().toString(36).slice(2, 7);
async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text() + (url ? ' @ ' + url : '')); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message + ' | ' + String(e.stack || '').split('\n').slice(1, 6).join(' < ')));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__pingpong, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { try { window.__sky?.set?.({ tod: '15:30', frozen: true, weather: 'clear', instant: true }); } catch {} });
  return { name, page, logs };
}
const E = (P, fn, arg) => P.page.evaluate(fn, arg);
const shot = async (P, n) => { const f = path.join(DIR, n); await P.page.screenshot({ path: f }); return f; };
const res = { test: 'pingpong', shots: {} }; const checks = {}; let bad = false; const pages = [];
try {
  if (ALLM || opt.solo) {
    const A = await open('solo', 'menu=0'); pages.push(A); await sleep(2000);
    const speed = +(opt.speed || 3);
    await E(A, (sp) => { const P = window.__pingpong; P.speed = sp; P.auto = true; P.startMatch('bot'); }, speed);
    // rally screenshot (real speed for the picture): wait for a live ball mid-rally
    await E(A, () => { window.__pingpong.speed = 1; });
    await until(() => E(A, () => window.__pingpong.live && window.__pingpong.state.phase === 'rally' && Math.abs(window.__pingpong.ball.p[0] - 19.6) < 0.5), 20000, 30);
    res.shots.rally = await shot(A, 'rally.png');
    await E(A, (sp) => { window.__pingpong.speed = sp; }, speed);
    await until(() => E(A, () => { const s = window.__pingpong.state; return s && (s.score[0] + s.score[1] >= 6); }), 240000, 1000);
    res.shots.score = await shot(A, 'score.png');
    const fin = await until(() => E(A, () => window.__pingpong.state?.phase === 'over' ? window.__pingpong.state : null), 600000, 1000);
    await sleep(1200); res.shots.win = await shot(A, 'win.png');
    const s = fin || await E(A, () => window.__pingpong.state);
    const rallies = await E(A, () => window.__pingpong.stats.rallies);
    res.solo = { score: s?.score, winner: s?.winner, points: rallies.length, longest: Math.max(0, ...rallies.map(r => r.hits)), avgHits: +(rallies.reduce((a, r) => a + r.hits, 0) / Math.max(1, rallies.length)).toFixed(2), reasons: rallies.reduce((o, r) => (o[r.reason] = (o[r.reason] || 0) + 1, o), {}) };
    const [a, b] = s?.score || [0, 0];
    checks.fullGame = !!fin && Math.max(a, b) >= 11 && Math.abs(a - b) >= 2 && rallies.length === a + b;
    checks.botMisses = rallies.some(r => r.winner === 0 && /missed|two/.test(r.reason));
    await E(A, () => window.__pingpong.leave());
    await A.page.close();
  }
  if (ALLM || opt.online) {
    const A = await open('A', `room=${code}`), B = await open('B', `room=${code}`); pages.push(A, B);
    res.connected = !!(await until(async () => (await Promise.all([A, B].map(P => E(P, () => window.__mp.members.size)))).every(n => n >= 1), 120000, 1000));
    if (!res.connected) throw new Error('pages did not connect');
    await sleep(2500);
    const idB = await E(B, () => window.__mp.selfId);
    await E(A, (id) => window.__pingpong.challenge(id), idB);
    await until(() => E(B, () => document.getElementById('pq-chal').classList.contains('on')), 8000);
    await E(B, () => window.__pingpong.accept());
    const ok = await until(async () => { const [a, b] = await Promise.all([A, B].map(P => E(P, () => window.__pingpong.state))); return a && b && a.mid === b.mid && a.mode === '1v1'; }, 10000);
    checks.matchCreated = !!ok;
    await Promise.all([A, B].map(P => E(P, () => { window.__pingpong.auto = true; window.__pingpong.opts.botMiss = 0.04; })));
    let long = null; let shotRally = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      await sleep(1500);
      const [la, lb] = await Promise.all([A, B].map(P => E(P, () => window.__pingpong.log.slice())));
      const hit = la.find(r => r.hits >= 5 && lb.some(x => x.point === r.point));
      if (!shotRally) { const live = await E(B, () => window.__pingpong.live && window.__pingpong.stats.hits > 2); if (live) { res.shots.onlineRally = await shot(B, 'online_rally_B.png'); shotRally = true; } }
      if (hit) { long = { a: hit, b: lb.find(x => x.point === hit.point) }; break; }
    }
    await sleep(1500);
    const [sa, sb] = await Promise.all([A, B].map(P => E(P, () => window.__pingpong.state)));
    res.online = { rally: long, scoreA: sa?.score, scoreB: sb?.score, logA: (await E(A, () => window.__pingpong.log)).slice(-8), logB: (await E(B, () => window.__pingpong.log)).slice(-8) };
    checks.onlineRally5 = !!long && long.a.hits >= 5 && long.a.hits === long.b.hits && long.a.winner === long.b.winner;
    checks.scoresAgree = JSON.stringify(sa?.score) === JSON.stringify(sb?.score);
    res.shots.onlineA = await shot(A, 'online_A.png');
  }
  checks.noErrors = !pages.flatMap(P => P.logs).length;
  res.errors = Object.fromEntries(pages.map(P => [P.name, P.logs.slice(0, 6)]));
} catch (e) { res.error = e.stack || e.message; bad = true; res.errors = Object.fromEntries(pages.map(P => [P.name, P.logs.slice(0, 6)])); }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
