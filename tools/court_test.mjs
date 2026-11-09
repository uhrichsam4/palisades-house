#!/usr/bin/env node
// Sports court (tennis, basketball, boxing) test: ONE headless Chrome (utility QoS, shared render-slot locks, SHOT_SLOTS).
//   SHOT_SLOTS=1 node tools/court_test.mjs [--solo] [--online]   (default: both)
// solo:   each game is started from the hub (window.__games.start), then plays vs the bot with the auto-player
//         (tennis: one game; basketball: 1v1 shots; boxing: 3 short rounds). Screenshots: overview, rally, shot, fight.
// online: two pages in one room; per game A challenges B, B accepts, both auto-play; logs / scores / health must agree.
// Screenshots in shots/court/. One JSON line; exit 1 on a failed check or page errors.
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
const DIR = path.join(ROOT, 'shots', 'court'); fs.mkdirSync(DIR, { recursive: true });
const code = 'crt' + Math.random().toString(36).slice(2, 7);
async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text() + (url ? ' @ ' + url : '')); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message + ' | ' + String(e.stack || '').split('\n').slice(1, 6).join(' < ')));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__tennis && window.__basketball && window.__boxing, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { try { window.__sky?.set?.({ tod: '15:30', frozen: true, weather: 'clear', instant: true }); } catch {} });
  return { name, page, logs };
}
const E = (P, fn, arg) => P.page.evaluate(fn, arg);
const shot = async (P, n) => { const f = path.join(DIR, n); await P.page.screenshot({ path: f }); return f; };
const res = { test: 'court', shots: {} }; const checks = {}; let bad = false; const pages = [];
const hubStart = (P, id) => E(P, (id) => { window.__games.start(id); return new Promise(r => setTimeout(() => r(!!document.querySelector('.pp-card.on')), 1200)); }, id);
const closeCards = (P) => E(P, () => { document.querySelectorAll('.pp-card.on').forEach(n => n.classList.remove('on')); document.body.classList.remove('ui-open'); });
try {
  if (ALLM || opt.solo) {
    const A = await open('solo', 'menu=0'); pages.push(A); await sleep(2000);
    // ---- tennis
    checks.tennisHub = await hubStart(A, 'tennis'); await closeCards(A);
    await E(A, () => { const T = window.__tennis; T.opts.games = 1; T.auto = true; T.speed = 1; T.startMatch('bot'); });
    await until(() => E(A, () => { const T = window.__tennis; return T.live && T.stats.hits >= 3 && Math.abs(T.ball.p[2] - 14.5) < 3; }), 60000, 50);
    res.shots.tennisRally = await shot(A, 'tennis_rally.png');
    await E(A, () => { window.__tennis.speed = 3; });
    const tfin = await until(() => E(A, () => window.__tennis.state?.phase === 'over' ? window.__tennis.state : null), 300000, 1000);
    const tr = await E(A, () => window.__tennis.stats.rallies);
    res.tennis = { games: tfin?.games, winner: tfin?.winner, points: tr.length, longest: Math.max(0, ...tr.map(r => r.hits)), reasons: tr.reduce((o, r) => (o[r.reason] = (o[r.reason] || 0) + 1, o), {}) };
    checks.tennisMatch = !!tfin && Math.max(...tfin.games) >= 1 && tr.length >= 4 && tr.some(r => r.hits >= 2);
    await E(A, () => window.__tennis.leave()); await closeCards(A);
    // ---- basketball
    checks.basketballHub = await hubStart(A, 'basketball'); await closeCards(A);
    await E(A, () => { const B = window.__basketball; B.auto = true; B.startMatch('duel', 'bot'); });
    const air = await until(() => E(A, () => { const B = window.__basketball; return B.balls().some(id => { const b = B.ball(id); return b && !b.held && b.p[1] > 3.0; }); }), 30000, 40);
    res.shots.basketballShot = await shot(A, 'basketball_shot.png'); checks.ballInAir = !!air;
    await until(() => E(A, () => window.__basketball.stats.log.length >= 8 || window.__basketball.state?.phase === 'over'), 120000, 1000);
    await sleep(1500);
    const bs = await E(A, () => ({ M: window.__basketball.state, log: window.__basketball.stats.log }));
    const sumPts = (id) => bs.log.filter(l => l.shooter === id).reduce((a, l) => a + l.pts, 0);
    res.basketball = { shots: bs.log.length, makes: bs.log.filter(l => l.made).length, swishes: bs.log.filter(l => l.swish).length, score: bs.M?.score, shooters: [...new Set(bs.log.map(l => l.shooter))] };
    checks.basketballMatch = bs.log.length >= 6 && res.basketball.shooters.length === 2 && bs.M.score[1] === sumPts('bot');
    await E(A, () => window.__basketball.leave()); await closeCards(A);
    // ---- boxing
    checks.boxingHub = await hubStart(A, 'boxing'); await closeCards(A);
    await E(A, () => { const X = window.__boxing; X.opts.roundMs = 9000; X.opts.breakMs = 1500; X.auto = true; X.startMatch('bot'); });
    await sleep(3500); res.shots.boxing = await shot(A, 'boxing_fight.png');
    const xfin = await until(() => E(A, () => window.__boxing.state?.phase === 'over' ? window.__boxing.state : null), 90000, 1000);
    res.boxing = { winner: xfin?.winner, reason: xfin?.reason, hp: xfin?.hp, dealt: xfin?.dealt, kd: xfin?.kd, rounds: xfin?.round, landed: await E(A, () => window.__boxing.stats.landed) };
    checks.boxingMatch = !!xfin && xfin.winner >= 0 && (xfin.dealt[0] + xfin.dealt[1]) > 0;
    await sleep(800); res.shots.boxingEnd = await shot(A, 'boxing_end.png');
    await E(A, () => window.__boxing.leave()); await closeCards(A);
    await A.page.close();
  }
  if (ALLM || opt.online) {
    const A = await open('A', `room=${code}`), B = await open('B', `room=${code}`); pages.push(A, B);
    res.connected = !!(await until(async () => (await Promise.all([A, B].map(P => E(P, () => window.__mp.members.size)))).every(n => n >= 1), 120000, 1000));
    if (!res.connected) throw new Error('pages did not connect');
    await sleep(2500);
    const idB = await E(B, () => window.__mp.selfId);
    const challenge = async (g) => { await E(A, ([g, id]) => window[g].challenge(id), [g, idB]); await sleep(1500); return E(B, (g) => window[g].accept(), g); };
    // tennis
    await challenge('__tennis'); await Promise.all([A, B].map(P => E(P, () => { window.__tennis.auto = true; window.__tennis.opts.botMiss = 0.05; window.__tennis.opts.games = 1; })));
    let tOk = null; const t0 = Date.now();
    while (Date.now() - t0 < 120000) { await sleep(1500); const [la, lb] = await Promise.all([A, B].map(P => E(P, () => window.__tennis.log.slice())));
      const h = la.find(r => r.hits >= 2 && lb.some(x => x.point === r.point)); if (la.length >= 3 && h) { tOk = { a: h, b: lb.find(x => x.point === h.point), na: la.length, nb: lb.length }; break; } }
    await sleep(1200); const [ta, tb] = await Promise.all([A, B].map(P => E(P, () => window.__tennis.state)));
    res.onlineTennis = { rally: tOk, a: ta && [ta.pts, ta.games], b: tb && [tb.pts, tb.games] };
    checks.onlineTennis = !!tOk && tOk.a.hits === tOk.b.hits && tOk.a.winner === tOk.b.winner && JSON.stringify([ta?.pts, ta?.games]) === JSON.stringify([tb?.pts, tb?.games]);
    res.shots.onlineTennis = await shot(B, 'online_tennis_B.png');
    await E(A, () => window.__tennis.leave()); await sleep(1000); await Promise.all([A, B].map(P => closeCards(P)));
    // basketball (1v1: B starts the duel vs A)
    await challenge('__basketball'); await Promise.all([A, B].map(P => E(P, () => { window.__basketball.auto = true; })));
    await until(async () => (await Promise.all([A, B].map(P => E(P, () => window.__basketball.stats.log.length)))).every(n => n >= 6), 120000, 1500);
    await sleep(2000);
    const [ba, bb] = await Promise.all([A, B].map(P => E(P, () => ({ M: window.__basketball.state, log: window.__basketball.stats.log.map(l => [l.shooter, l.made, l.pts]) }))));
    const n = Math.min(ba.log.length, bb.log.length);
    res.onlineBasketball = { na: ba.log.length, nb: bb.log.length, scoreA: ba.M?.score, scoreB: bb.M?.score };
    checks.onlineBasketball = n >= 6 && JSON.stringify(ba.log.slice(0, n)) === JSON.stringify(bb.log.slice(0, n)) && JSON.stringify(ba.M?.score) === JSON.stringify(bb.M?.score);
    await E(A, () => window.__basketball.leave()); await E(B, () => window.__basketball.leave()); await sleep(1000); await Promise.all([A, B].map(P => closeCards(P)));
    // boxing
    await Promise.all([A, B].map(P => E(P, () => { const X = window.__boxing; X.opts.roundMs = 20000; X.auto = true; })));
    await challenge('__boxing'); await sleep(9000);
    res.shots.onlineBoxing = await shot(A, 'online_boxing_A.png');
    const [xa, xb] = await Promise.all([A, B].map(P => E(P, () => ({ M: window.__boxing.state, landed: window.__boxing.stats.landed }))));
    res.onlineBoxing = { hpA: xa.M?.hp, hpB: xb.M?.hp, nhA: xa.M?.nh, nhB: xb.M?.nh, landedA: xa.landed, landedB: xb.landed };
    checks.onlineBoxing = !!xa.M && xa.M.nh > 0 && xa.M.nh === xb.M?.nh && JSON.stringify(xa.M.hp) === JSON.stringify(xb.M?.hp) && xa.M.nh === xa.landed + xb.landed;
    await E(A, () => window.__boxing.leave());
  }
  checks.noErrors = !pages.flatMap(P => P.logs).length;
  res.errors = Object.fromEntries(pages.map(P => [P.name, P.logs.slice(0, 6)]));
} catch (e) { res.error = e.stack || e.message; bad = true; res.errors = Object.fromEntries(pages.map(P => [P.name, P.logs.slice(0, 6)])); }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
