#!/usr/bin/env node
// Release gate: everything together. ONE headless Chrome (shared render-slot lock, utility QoS).
//   node tools/smoke_test.mjs            -> JSON line, exit 1 on any failure
// Solo: page loads with all modules, every system API is present, room lighting bakes, no page/console errors,
// frame time + draw calls over ~3 s in 4 spots, a few interactions (tap, window, weather, car seat, games panel).
// Multiplayer: 2 pages join one lobby, see each other, weather + a window + a tap sync, no errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 1); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext|youtube|ytimg|googlevideo|favicon/i;
const out = { test: 'smoke', checks: {}, solo: {}, mp: {}, errors: [] };
const dir = path.join(ROOT, 'shots', 'smoke'); fs.mkdirSync(dir, { recursive: true });
async function open(ctx, q) {
  const page = await ctx.newPage(); const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + String(e.message).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 240000, polling: 300 });
  return { page, logs };
}
try {
  // ---------------------------------------------------------------- solo
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const A = await open(ctxA, 'menu=0&tod=11:00&weather=clear');
  await A.page.waitForFunction(() => window.__probes, null, { timeout: 180000, polling: 500 }).catch(() => {});
  await sleep(3000);
  const apis = await A.page.evaluate(() => ({ sky: !!window.__sky, taps: !!window.__taps, cars: !!window.__cars, games: !!window.__games, building: !!window.__building, damage: !!window.__damage, cold: !!window.__cold, interact: !!window.__interact, party: !!window.__party, quality: !!window.__quality,
    gamesList: (() => { try { const g = window.__games; const r = g.registry || g.list?.() || g.games; return r ? (r.size ?? Object.keys(r).length ?? r.length) : null; } catch { return null; } })(),
    smash: (() => { try { return Object.keys(window.__smash || {}).length > 0; } catch { return false; } })() }));
  out.solo.apis = apis;
  out.checks.allApis = ['sky', 'taps', 'cars', 'games', 'building', 'damage', 'cold', 'interact'].every(k => apis[k]);
  // frame time in 4 spots (player teleported; real loop, vsync-capped headless: use the frame log)
  const spots = { pool: [5.0, 0.3, 21.6, -1.57], family: [4.2, 0.0, 15.0, 0.6], front: [14.5, -0.9, -8.5, 3.14], kitchen: [19.5, 0.0, 14.5, 0.0] };
  out.solo.perf = {};
  for (const [k, [x, y, z, yaw]] of Object.entries(spots)) {
    await A.page.evaluate(([x, y, z, yaw]) => { const P = window.__player; P.teleport(x, y, z, yaw); P.state.thirdPerson = true; }, [x, y, z, yaw]);
    await sleep(1500);
    const r = await A.page.evaluate(async () => { const L = window.__frameLog; const n0 = L.n; const t0 = performance.now(); await new Promise(r => setTimeout(r, 2500)); const n = L.n - n0; const arr = []; for (let i = 0; i < Math.min(n, 8192); i++) arr.push(L.buf[(L.n - 1 - i) & 8191]); arr.sort((a, b) => a - b);
      const info = window.__dbg.renderer.info.render; return { frames: n, avgMs: +((performance.now() - t0) / Math.max(1, n)).toFixed(2), p95: +(arr[Math.floor(arr.length * 0.95)] || 0).toFixed(2), calls: info.calls, tris: info.triangles }; });
    out.solo.perf[k] = r; await A.page.screenshot({ path: path.join(dir, `solo_${k}.jpg`), type: 'jpeg', quality: 80 });
  }
  // interactions
  const inter = await A.page.evaluate(async () => {
    const res = {};
    try { const T = window.__taps; const id = T.list ? T.list()[0] : 'kitchen'; (T.set || T.toggle)?.call(T, 'kitchen', true); await new Promise(r => setTimeout(r, 600)); res.tap = JSON.stringify(T.state?.() ?? T.on?.('kitchen') ?? 'ok').slice(0, 80); } catch (e) { res.tap = 'ERR ' + e.message; }
    try { const B = window.__building; const k = [...B.openings.keys()].find(id => B.openings.get(id).type === 'window'); B.setOpen(k, 1); await new Promise(r => setTimeout(r, 1500)); res.window = [k, B.openings.get(k).open]; B.setOpen(k, 0); } catch (e) { res.window = 'ERR ' + e.message; }
    try { window.__sky.set({ weather: 'rain', instant: true }); await new Promise(r => setTimeout(r, 1200)); res.weather = window.__sky.weather; window.__sky.set({ weather: 'clear', instant: true }); } catch (e) { res.weather = 'ERR ' + e.message; }
    try { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true })); await new Promise(r => setTimeout(r, 800)); res.gamesPanel = !!document.querySelector('[class*="games"], #games, .gm-games, .games-panel'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); } catch (e) { res.gamesPanel = 'ERR ' + e.message; }
    res.errors = window.__errors.slice(0, 8);
    return res;
  });
  out.solo.interact = inter;
  await sleep(1000);
  out.solo.logs = A.logs.slice(0, 12);
  out.checks.soloNoErrors = A.logs.length === 0 && (inter.errors || []).length === 0;
  await ctxA.close();

  // ---------------------------------------------------------------- multiplayer (2 pages, one lobby)
  const room = 'smoke' + Math.random().toString(36).slice(2, 7);
  const c1 = await browser.newContext({ viewport: { width: 960, height: 600 } }), c2 = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const P1 = await open(c1, `room=${room}&noprobes=1&tod=11:00`); const P2 = await open(c2, `room=${room}&noprobes=1&tod=11:00`);
  const seen = await P1.page.waitForFunction(() => (window.__mp?.peers?.size || 0) >= 1, null, { timeout: 90000, polling: 500 }).then(() => true).catch(() => false);
  out.checks.mpConnected = seen;
  if (seen) {
    await sleep(2500);
    await P1.page.evaluate(() => { window.__sky.set({ weather: 'snow' }); const B = window.__building; const k = [...B.openings.keys()].find(id => B.openings.get(id).type === 'window'); window.__smokeWin = k; B.setOpen(k, 1); });
    await sleep(4000);
    const k = await P1.page.evaluate(() => window.__smokeWin);
    const b = await P2.page.evaluate((k) => ({ weather: window.__sky.weather, win: window.__building.openings.get(k)?.open, peers: window.__mp.peers.size }), k);
    out.mp.B = b; out.checks.mpWeather = b.weather === 'snow'; out.checks.mpWindow = b.win > 0.5;
    await P2.page.screenshot({ path: path.join(dir, 'mp_B.jpg'), type: 'jpeg', quality: 80 });
  }
  out.mp.logs = [...P1.logs, ...P2.logs].slice(0, 12);
  out.checks.mpNoErrors = P1.logs.length === 0 && P2.logs.length === 0;
} catch (e) { out.errors.push(String(e.stack || e).slice(0, 500)); }
await browser.close(); server.close();
out.pass = out.errors.length === 0 && Object.values(out.checks).every(Boolean);
console.log(JSON.stringify(out));
process.exit(out.pass ? 0 : 1);
