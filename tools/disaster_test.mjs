#!/usr/bin/env node
// Natural Disasters test (src/games/disaster): ONE headless Chrome, two pages (A = host, B) in the same ?room= over
// the real relays. For each disaster: a 1-round game (short round) runs start -> end; checks: no page errors, both
// clients in the round, health synced to the host's S (B's hp claim visible on A), a forced KO on B (meteor) shows
// on A, house damage (damage.js entries below max hp / broken) happens for meteor / quake / storm and the damaged
// set is IDENTICAL on both clients; fx are not built before the first round (idle cost zero).
//   SHOT_SLOTS=1 node tools/disaster_test.mjs [--types=meteor,flood] [--round=14000] [--full]
// Screenshots: shots/disaster/<type>_ann.png, <type>_mid.png, results.png
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
const SLOTS = Number(process.env.SHOT_SLOTS || 1);
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } } if (!slot) await new Promise(r => setTimeout(r, 1500)); }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /\/src\/smash\/|\/src\/building\/|THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed|youtube|\[lobbies\]/i;
const code = 'dz' + Math.random().toString(36).slice(2, 8);
const SHOTS = path.join(ROOT, 'shots', 'disaster'); fs.mkdirSync(SHOTS, { recursive: true });
async function open(name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = []; const warns = []; const raw = [];
  page.on('console', m => { const url = m.location()?.url || ''; const t = m.text(); if (/\[disaster\]|disasters not started/.test(t)) warns.push(t); if (m.type() === 'error' && raw.length < 30) raw.push(t.slice(0, 300) + ' @' + url.split('/').slice(-2).join('/')); if (m.type() === 'error' && !IGNORE.test(t) && !IGNORE.test(url)) logs.push(t); });
  page.on('pageerror', e => { logs.push('pageerror: ' + e.message); raw.push('pageerror: ' + (e.stack || e.message).slice(0, 600)); });
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}${opt.full ? '' : '&only=family,kitchen,dining,pool,exterior,site'}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp, null, { timeout: 180000, polling: 250 });
  await page.waitForFunction(() => window.__games && window.__disaster, null, { timeout: 30000, polling: 250 });
  return { name, page, logs, warns, raw };
}
const G = (P, expr) => P.page.evaluate(new Function('return (' + expr + ')'));
const tp = (P, x, y, z, yaw = 0) => P.page.evaluate(([x, y, z, yaw]) => window.__player.teleport(x, y, z, yaw), [x, y, z, yaw]);
const shot = async (P, n) => { await P.page.screenshot({ path: path.join(SHOTS, n) }); return 'shots/disaster/' + n; };
const damaged = (P) => P.page.evaluate(() => { const out = []; for (const e of window.__damage?.entries?.values?.() || []) if (e.hp < e.maxHp - 0.01 || e.broken) out.push(e.id + (e.broken ? '!' : '')); return out.sort(); });
const yardSpot = (P, x, z) => P.page.evaluate(([x, z]) => window.__games.spots.near(x, z, 1)[0], [x, z]);

const PAGES = []; const res = { test: 'disaster', room: code, shots: {}, rounds: {} }; const checks = {}; let bad = false;
const ROUND = +(opt.round || 14000), ANN = 2500;
const LIST = (opt.types || 'meteor,flood,fire,quake,storm,blizzard').split(',');
try {
  const A = await open('A'), B = await open('B'); const ALL = [A, B]; PAGES.push(A, B);
  checks.idleNoFx = await G(A, 'window.__disaster.fx === null') && await G(B, 'window.__disaster.fx === null');
  res.connected = !!(await until(async () => (await Promise.all(ALL.map(P => P.page.evaluate(() => window.__mp.members.size)))).every(n => n >= 1), 120000, 1000));
  if (!res.connected) throw new Error('pages did not connect over the relays within 120 s');
  for (const P of ALL) await P.page.evaluate(() => { try { window.__sky?.set?.({ tod: '15:30', frozen: true, weather: 'clear', instant: true }); } catch {} });
  const ids = { A: await G(A, 'window.__games.me'), B: await G(B, 'window.__games.me') }; res.ids = ids; await sleep(1500);
  checks.registered = await G(A, "!!window.__games.games.disaster && window.__games.order.includes('disaster')");

  // --game3: one full 3-round game (host picks the disasters) end to end, then the results board on both clients
  if (opt.game3) {
    const step = (m) => process.stderr.write(`[disaster] ${m}\n`);
    for (const P of ALL) await P.page.evaluate(() => { try { window.__sky?.set?.({ tod: '15:30', frozen: true, weather: 'clear', instant: true }); } catch {} });
    const RMS = +(opt.round || 12000);
    await A.page.evaluate((ms) => window.__games.start('disaster', { rounds: 3, roundMs: ms, annMs: 2500, interMs: 2500, autoJoin: true, autoReady: true, lobby: 4000 }), RMS);
    const F = res.full = { rounds: [] };
    F.play = !!(await until(async () => (await Promise.all(ALL.map(P => G(P, "window.__games.phase")))).every(p => p === 'play'), 25000, 200));
    F.bothIn = (await G(A, 'window.__games.state?.players?.length')) === 2; step('play=' + F.play + ' bothIn=' + F.bothIn);
    const yard = await yardSpot(A, 11.5, 26.5);
    let seen = -1;
    const t0 = Date.now();
    while (Date.now() - t0 < 3 * (RMS + 12000) + 30000) {
      const ph = await G(A, "window.__games.phase"); if (ph === 'end' || ph === 'idle') break;
      const sA = await G(A, 'window.__disaster.state() && { round: window.__disaster.state().round, type: window.__disaster.state().type, roundAt: window.__disaster.state().roundAt }');
      if (sA && sA.round > seen && sA.type) {
        seen = sA.round; step('round ' + sA.round + ' ' + sA.type);
        await sleep(3500);
        const sB = await G(B, 'window.__disaster.state() && { round: window.__disaster.state().round, type: window.__disaster.state().type }');
        // A watches from the yard (not inside a burning room), B stays put
        await tp(A, yard[0], yard[1] + 0.05, yard[2], 0.35); await sleep(2500);
        await shot(A, `game3_r${sA.round}_${sA.type}.png`);
        F.rounds.push({ round: sA.round, type: sA.type, bAgrees: !!sB && sB.round === sA.round && sB.type === sA.type, localA: await G(A, 'window.__disaster.local()'), localB: await G(B, 'window.__disaster.local()') });
      }
      await sleep(500);
    }
    F.ended = !!(await until(() => G(A, "window.__games.phase === 'end'"), 20000, 300)); step('ended=' + F.ended);
    await sleep(1500);
    const resOf = (P) => G(P, 'window.__games.state?.results && { title: window.__games.state.results.title, rows: window.__games.state.results.rows.map(r => r.name + ":" + r.text) }');
    F.resultsA = await resOf(A); F.resultsB = await resOf(B);
    F.boardVisible = await A.page.evaluate(() => { const n = [...document.querySelectorAll('.pp-card.on, [class*=result].on, [class*=res].on')]; return n.map(x => (x.innerText || '').slice(0, 160)); });
    res.shots.game3_results = await shot(A, 'game3_results.png'); await shot(B, 'game3_results_B.png');
    F.hist = await G(A, 'window.__games.state?.data?.hist?.map(h => h.type) || null');
    F.idle = !!(await until(async () => (await Promise.all(ALL.map(P => G(P, "window.__games.phase")))).every(p => p === 'idle'), 30000, 300));
    checks.game3 = F.play && F.bothIn && F.rounds.length === 3 && F.rounds.every(r => r.bAgrees) && F.ended && !!F.resultsA && JSON.stringify(F.resultsA) === JSON.stringify(F.resultsB) && /3 SURVIVED|\/3 SURVIVED/.test(JSON.stringify(F.resultsA));
    LIST.length = 0;
  }
  for (const type of LIST) {
    const R = res.rounds[type] = {};
    if (opt.repair) { try { await A.page.evaluate(() => window.__building?.repair?.()); } catch {} } // --repair: building.repair() between rounds (crashes rapier: see report)
    await sleep(800);
    await A.page.evaluate(([t, ms, ann]) => window.__games.start('disaster', { type: t, rounds: 1, roundMs: ms, annMs: ann, interMs: 1500, autoJoin: true, autoReady: true, lobby: 4000 }), [type, ROUND, ANN]);
    R.play = !!(await until(async () => (await Promise.all(ALL.map(P => G(P, "window.__games.phase")))).every(p => p === 'play'), 20000, 200));
    R.bothIn = (await G(A, 'window.__games.state?.players?.length')) === 2;
    // announcement
    await sleep(700);
    R.annOn = await G(A, "document.getElementById('dz-ann')?.classList.contains('on')");
    if (type === LIST[0] || opt.allann) res.shots[type + '_ann'] = await shot(A, `${type}_ann.png`);
    // positions: B somewhere it gets hurt; A where the camera shows the disaster
    const yard = await yardSpot(A, 11.5, 26.5); const yardB = await yardSpot(B, 6, -4);
    if (type === 'meteor' || type === 'storm' || type === 'blizzard') { await tp(A, yard[0], yard[1] + 0.05, yard[2], 0.35); await tp(B, yardB[0], yardB[1] + 0.05, yardB[2], Math.PI); }
    if (type === 'flood') { await tp(A, yard[0], yard[1] + 0.05, yard[2], 0.35); }
    await until(() => G(A, "window.__disaster.state()?.roundAt != null && performance.now() - window.__disaster.state().roundAt > " + ANN), 8000, 150);
    if (type === 'fire') { // stand A in the first burning room after it caught, looking along it
      const room = await G(A, "Object.entries(window.__disaster.state().fire).sort((a,b)=>a[1]-b[1])[0][0]");
      R.fireStart = room; await sleep(4500);
      const c = await A.page.evaluate((r) => { const t = window.__disaster.state(); return null; }, room);
      const rect = await A.page.evaluate(async (r) => { const P = await import('/src/plan.js'); return P.ROOMS[r].rect; }, room);
      await tp(A, rect[0] + 0.6, 0.05, (rect[1] + rect[3]) / 2, -Math.PI / 2); void c;
      /* shoot the fire before the smoke knocks A out (a KO swaps to the spectator orbit) */
      await sleep(1500); res.shots.fire_mid = await shot(A, 'fire_mid.png'); R.fireShotKO = (await G(A, 'window.__disaster.local()'))?.ko;
    }
    await sleep(Math.min(7000, ROUND * 0.5));
    if (type === 'quake' || type === 'fire') await sleep(1500);
    if (type !== 'fire') res.shots[type + '_mid'] = await shot(A, `${type}_mid.png`);
    R.localA = await G(A, 'window.__disaster.local()'); R.localB = await G(B, 'window.__disaster.local()');
    if (type === 'meteor') { await B.page.evaluate(() => window.__disaster.hurt(500)); R.koSync = !!(await until(() => G(A, `window.__disaster.state()?.ko?.['${ids.B}'] === true`), 5000, 150)); }
    if (type === 'fire' || type === 'flood') { await B.page.evaluate(() => window.__disaster.hurt(7)); }
    R.hpSync = !!(await until(async () => { const hB = (await G(B, 'window.__disaster.local()')).hp; const s = await G(A, 'window.__disaster.state()'); return s && s.hp && Math.abs((s.hp[ids.B] ?? 100) - Math.ceil(hB)) <= 1 && (s.hp[ids.B] ?? 100) < 100; }, 6000, 200));
    R.hpA = await G(A, 'window.__disaster.state()?.hp');
    // end
    R.ended = !!(await until(() => G(A, "window.__games.phase === 'end'"), ROUND + 15000, 300));
    await sleep(1200);
    R.results = await G(A, 'window.__games.state?.results && { title: window.__games.state.results.title, rows: window.__games.state.results.rows.map(r => r.text) }');
    if (type === LIST[LIST.length - 1] || type === 'meteor') res.shots[type + '_results'] = await shot(A, type === 'meteor' ? 'results_meteor.png' : 'results.png');
    await sleep(2500);
    const [dA, dB] = await Promise.all([damaged(A), damaged(B)]); R.damagedA = dA.length; R.damagedB = dB.length;
    R.damageAgrees = JSON.stringify(dA) === JSON.stringify(dB);
    if (!R.damageAgrees) R.damageDiff = { onlyA: dA.filter(x => !dB.includes(x)).slice(0, 8), onlyB: dB.filter(x => !dA.includes(x)).slice(0, 8) };
    R.idle = !!(await until(async () => (await Promise.all(ALL.map(P => G(P, "window.__games.phase")))).every(p => p === 'idle'), 20000, 300));
    R.ok = R.play && R.bothIn && R.ended && R.idle && R.hpSync && R.damageAgrees && (type !== 'meteor' || R.koSync) && (!['meteor', 'quake'].includes(type) || R.damagedA > 0);
    checks[type] = R.ok;
    await tp(A, 5.5, 0.05, 16.8); await tp(B, 6.5, 0.05, 16.8);
  }
  res.errors = { A: A.logs, B: B.logs }; res.warns = { A: A.warns.slice(0, 6), B: B.warns.slice(0, 6) };
  checks.noErrors = !A.logs.length && !B.logs.length;
} catch (e) { res.error = (e.stack || e.message).slice(0, 900); res.raw = Object.fromEntries(PAGES.map(P => [P.name, P.raw])); bad = true; }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
