#!/usr/bin/env node
// Pool (src/games/pool) test: ONE headless Chrome (utility QoS, shared render-slot locks, SHOT_SLOTS).
//   node tools/pool_test.mjs [--solo] [--det] [--online] [--probes]   (default: all three)
// solo:   table in the garage, aiming view (guide + ghost ball + power), mid-roll top view, foul banner, win screen
// det:    the same 20 seeded shots simulated in two browser contexts end with identical ball positions
// online: A challenges B, B accepts, A breaks, B sees the same result (exact), turns alternate, a late joiner C
//         gets the current rack. Screenshots in shots/pool/. One JSON line; exit 1 on a failed check or errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const ALLM = !opt.solo && !opt.det && !opt.online;
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
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|\/src\/building\/|AudioContext|youtube|\[lobbies\]|pointer ?lock/i;
const DIR = path.join(ROOT, 'shots', 'pool'); fs.mkdirSync(DIR, { recursive: true });
const code = 'pool' + Math.random().toString(36).slice(2, 7);
async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text() + (url ? ' @ ' + url : '')); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message + ' | ' + String(e.stack || '').split('\n').slice(1, 6).join(' < ')));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}${opt.probes ? '' : '&noprobes=1'}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__pool, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { try { window.__sky?.set?.({ tod: '15:30', frozen: true, weather: 'clear', instant: true }); } catch {} });
  return { name, page, logs };
}
const E = (P, fn, arg) => P.page.evaluate(fn, arg);
const shot = async (P, n) => { const f = path.join(DIR, n); await P.page.screenshot({ path: f }); return f; };
const res = { test: 'pool', shots: {} }; const checks = {}; let bad = false; const pages = [];
const waitIdle = (P, ms = 30000) => until(() => E(P, () => !window.__pool.anim), ms, 150);
try {
  // ---------------------------------------------------------------- solo
  if (ALLM || opt.solo) {
    const A = await open('solo', 'menu=0'); pages.push(A); await sleep(2500);
    // table in the garage (paused still from a free camera)
    await E(A, () => { const d = window.__dbg; d.paused = true; const c = d.camera; c.position.set(20.3, 1.72, 6.25); c.lookAt(17.1, 0.75, 3.55); c.updateProjectionMatrix(); window.__player.teleport(14.6, 0.05, 1.6, 2.4); });
    await sleep(300); await E(A, () => window.__dbg.render()); await sleep(200); res.shots.table = await shot(A, 'table.png');
    await E(A, () => { window.__dbg.paused = false; });
    await E(A, () => window.__pool.startMatch('bot'));
    await until(() => E(A, () => window.__pool.myTurn()), 8000);
    await E(A, () => { window.__pool.setPower(0.62); }); await sleep(1600);
    checks.aimGuide = await E(A, () => window.__pool.table.guide.visible && window.__pool.table.ghost.visible && window.__pool.at);
    res.shots.aim = await shot(A, 'aim.png');
    // break
    await E(A, () => { const s = window.__pool.state; const c = s.g.balls[0]; const dx = 1.677 - c[0], dy = 0.559 - c[1] + 0.004; const n = Math.hypot(dx, dy); window.__pool.setPower(0); return window.__pool.shoot({ cue: [c[0], c[1]], dir: [dx / n, dy / n], v: 7.6, spin: [0, 0.1] }); });
    await sleep(650); checks.topView = await E(A, () => window.__pool.view === 'top' && window.__pool.anim);
    res.shots.roll = await shot(A, 'rolling.png');
    await waitIdle(A); await sleep(400);
    res.afterBreak = await E(A, () => { const s = window.__pool.state; return { shotNo: s.g.shotNo, turn: s.g.turn, pocketed: s.g.last?.pocketed, foul: s.g.foul }; });
    // let the bot play until it is our turn, then foul on purpose (aim away from every ball, soft): NO CONTACT or wrong ball
    await until(async () => { const v = await E(A, () => window.__pool.myTurn() || window.__pool.state.g.phase === 'over'); return v; }, 60000, 300);
    const foul = await E(A, () => { const P = window.__pool; const s = P.state; const c = P.local.cue || [s.g.balls[0][0], s.g.balls[0][1]]; if (s.g.inHand) P.place(0.3, 0.2); const cue = P.local.cue; const dirs = []; for (let a = 0; a < 64; a++) { const d = [Math.cos(a / 64 * Math.PI * 2), Math.sin(a / 64 * Math.PI * 2)]; let ok = true; for (let i = 1; i < 16; i++) { const b = s.g.balls[i]; if (!b[2]) continue; const ox = b[0] - cue[0], oy = b[1] - cue[1]; const t = ox * d[0] + oy * d[1]; if (t > 0 && ox * ox + oy * oy - t * t < 0.0036 * 1.2) ok = false; } if (ok) dirs.push(d); } void c; return P.shoot({ cue, dir: dirs[0] || [1, 0], v: 0.35, spin: [0, 0] }); });
    await sleep(300); await waitIdle(A);
    const fs1 = await until(() => E(A, () => document.getElementById('pp-foul').classList.contains('on') && window.__pool.state.g.foul), 4000, 100);
    res.foul = fs1; checks.foulBanner = !!fs1; await sleep(250); res.shots.foul = await shot(A, 'foul.png');
    // win screen: practice rack with only the 8 left, 8 next to a corner pocket
    await E(A, () => window.__pool.leave()); await sleep(600);
    await E(A, () => window.__pool.startMatch('practice')); await sleep(700);
    await E(A, () => { const P = window.__pool; const s = P.state; const g = s.g; g.balls = g.balls.map((b, i) => (i === 0 ? [0.62, 0.62, 1] : i === 8 ? [0.25, 0.25, 1] : [b[0], b[1], 0])); g.groups = ['solid', 'stripe']; g.broken = true; g.inHand = null; g.turn = 0; window.__poolDebug = s; });
    await E(A, () => { const P = window.__pool; P.debugSet(window.__poolDebug); });
    await sleep(500);
    await E(A, () => { const P = window.__pool; const d = [-Math.SQRT1_2, -Math.SQRT1_2]; return P.shoot({ cue: [0.62, 0.62], dir: d, v: 2.0, spin: [0, -0.7] }); });
    await waitIdle(A); await sleep(1300);
    res.win = await E(A, () => ({ phase: window.__pool.state.g.phase, winner: window.__pool.state.g.winner, shown: document.getElementById('pp-win').classList.contains('on'), h: document.getElementById('pp-w-h')?.textContent }));
    checks.winScreen = res.win.phase === 'over' && res.win.winner === 0 && res.win.shown;
    res.shots.win = await shot(A, 'win.png');
    await E(A, () => window.__pool.leave());
    res.errors = { solo: A.logs.slice() };
    await A.page.close();
  }
  // ---------------------------------------------------------------- determinism (two contexts)
  if (ALLM || opt.det) {
    const ctxs = []; const outs = [];
    for (let k = 0; k < 2; k++) {
      const c = await browser.newContext({ viewport: { width: 640, height: 400 } }); ctxs.push(c);
      const page = await c.newPage();
      await page.goto(`http://127.0.0.1:${port}/index.html?menu=0&noprobes=1&only=service`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__pool, null, { timeout: 180000, polling: 250 });
      outs.push(await page.evaluate(() => window.__pool.selfTest(20, 4242)));
    }
    let maxd = 0; for (let i = 0; i < 16; i++) { const a = outs[0].balls[i], b = outs[1].balls[i]; maxd = Math.max(maxd, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), a[2] === b[2] ? 0 : 1); }
    res.det = { maxDiff: maxd, bitExact: JSON.stringify(outs[0]) === JSON.stringify(outs[1]), steps: outs[0].steps.reduce((a, b) => a + b, 0), balls: outs[0].balls.map(b => b.map(v => +(+v).toFixed(4))) };
    checks.deterministic = res.det.bitExact && maxd < 1e-9;
    for (const c of ctxs) await c.close();
  }
  // ---------------------------------------------------------------- online
  if (ALLM || opt.online) {
    const A = await open('A', `room=${code}`), B = await open('B', `room=${code}`); pages.push(A, B);
    res.connected = !!(await until(async () => (await Promise.all([A, B].map(P => E(P, () => window.__mp.members.size)))).every(n => n >= 1), 120000, 1000));
    if (!res.connected) throw new Error('pages did not connect');
    await sleep(2500);
    const idA = await E(A, () => window.__mp.selfId), idB = await E(B, () => window.__mp.selfId);
    await E(B, () => window.__player.teleport(18.2, 0.05, 5.6, 0.4));
    await E(A, (id) => window.__pool.challenge(id), idB);
    const card = await until(() => E(B, () => document.getElementById('pp-chal').classList.contains('on')), 8000);
    checks.challengeCard = !!card; res.shots.challenge = await shot(B, 'challenge.png');
    await E(B, () => window.__pool.accept());
    const both = await until(async () => { const [a, b] = await Promise.all([A, B].map(P => E(P, () => window.__pool.state))); return a && b && a.mid === b.mid && a.mode === '1v1' ? [a, b] : null; }, 10000);
    checks.matchCreated = !!both && both[0].players[0] === idA && both[0].players[1] === idB;
    await until(() => E(A, () => window.__pool.myTurn()), 6000);
    // A breaks
    await E(A, () => { const P = window.__pool; const s = P.state; const c = s.g.balls[0]; const dx = 1.677 - c[0], dy = 0.559 - c[1] - 0.003; const n = Math.hypot(dx, dy); return P.shoot({ cue: [c[0], c[1]], dir: [dx / n, dy / n], v: 7.4, spin: [0.1, 0] }); });
    await sleep(900); res.shots.onlineRoll = await shot(B, 'online_B_rolling.png');
    await Promise.all([waitIdle(A), waitIdle(B)]); await sleep(1500);
    const [sa, sb] = await Promise.all([A, B].map(P => E(P, () => ({ s: window.__pool.state, drift: window.__pool.lastDrift }))));
    res.break = { shotNo: [sa.s.g.shotNo, sb.s.g.shotNo], drift: sb.drift, turn: [sa.s.g.turn, sb.s.g.turn], pocketed: sa.s.g.last?.pocketed };
    checks.breakSame = JSON.stringify(sa.s.g.balls) === JSON.stringify(sb.s.g.balls) && sa.s.g.shotNo === 1 && (sb.drift === 0 || sb.drift === null);
    // play until both seats have shot: whoever's turn shoots a bot shot
    const turns = [sa.s.g.turn]; const shooters = [];
    for (let k = 0; k < 8; k++) {
      const s = await E(A, () => window.__pool.state); if (s.g.phase === 'over') break;
      const P = s.g.turn === 0 ? A : B; shooters.push(P.name);
      await until(() => E(P, () => window.__pool.myTurn()), 6000);
      await E(P, () => { const PL = window.__pool; const s = PL.state; const sh = PL.sim.botShot(s.g, Math.random, 1); if (s.g.inHand) PL.place(sh.cue[0], sh.cue[1]); return PL.shoot(sh); });
      await sleep(300); await Promise.all([waitIdle(A), waitIdle(B)]); await sleep(1200);
      const [x, y] = await Promise.all([A, B].map(P2 => E(P2, () => window.__pool.state)));
      if (JSON.stringify(x.g.balls) !== JSON.stringify(y.g.balls) || x.g.turn !== y.g.turn) { res.mismatchAt = k; break; }
      turns.push(x.g.turn); if (new Set(shooters).size === 2 && k >= 2) break;
    }
    res.turns = turns; res.shooters = shooters;
    checks.turnsAlternate = new Set(shooters).size === 2 && res.mismatchAt === undefined;
    res.shots.onlineA = await shot(A, 'online_A.png');
    // late joiner
    const C = await open('C', `room=${code}`); pages.push(C);
    const late = await until(async () => { const [a, c] = await Promise.all([A, C].map(P => E(P, () => window.__pool.state))); return c && a && c.mid === a.mid && JSON.stringify(c.g.balls) === JSON.stringify(a.g.balls) ? c : null; }, 60000, 1000);
    checks.lateJoiner = !!late; res.late = late ? { shotNo: late.g.shotNo, mode: late.mode } : null;
    await E(C, () => { const d = window.__dbg; d.paused = true; d.camera.position.set(19.6, 1.9, 5.9); d.camera.lookAt(17.1, 0.8, 3.6); d.render(); });
    res.shots.late = await shot(C, 'late_joiner.png');
    res.errors = { ...(res.errors || {}), A: A.logs, B: B.logs, C: C.logs };
  }
  const allErr = pages.flatMap(P => P.logs); checks.noErrors = !allErr.length;
} catch (e) { res.error = e.stack || e.message; bad = true; res.errors = Object.fromEntries(pages.map(P => [P.name, P.logs])); }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
