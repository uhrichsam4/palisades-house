#!/usr/bin/env node
// Party mode test (headless Chrome, ONE browser, taskpolicy utility, shared render-slot lock).
//   node tools/party_test.mjs [--perf] [--out=dir]
// Loads index.html?menu=0&noprobes=1, force-starts src/party/index.js (until multiplayer.js wires it), checks the
// money API (burst / spray / rain / stackMesh), holds L in third person (spray + CASH chip), and takes screenshots:
// pool deck (rain + DJ booth), family room (disco ball + cash), kitchen (champagne tower), front (red carpet / VIP),
// dining (cash mountain), make-it-rain. --perf: draw calls + frame time at perf.mjs' spots before vs after party.
// 0 console errors required (relay / websocket noise ignored).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const OUT = path.resolve(ROOT, opt.out || 'shots'); fs.mkdirSync(OUT, { recursive: true });
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed/i;
const res = { test: 'party' }; let bad = false; const checks = {};
const page = await context.newPage(); const logs = [];
page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); if (opt.verbose && m.type() !== 'debug') console.error('[page]', m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
const SPOTS = [[9.7, 9.0, 0, 'foyer'], [5.5, 17.0, 0, 'family'], [18.4, 16.0, 0, 'kitchen'], [12.0, 14.2, 1, 'primary'], [18.0, 24.0, 0, 'pool deck']];
async function perf(label) {
  return page.evaluate(async ({ SPOTS }) => {
    const d = window.__dbg, R = d.renderer, gl = R.getContext(), px = new Uint8Array(4); const P = await import('/src/plan.js');
    const sync = () => { R.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const raf = () => new Promise(r => requestAnimationFrame(r));
    const time = (fn, n) => { sync(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); sync(); return (performance.now() - t) / n; };
    let calls = 0, ms = 0, n = 0; const per = {};
    for (const [x, z, lv, label] of SPOTS) {
      d.paused = false; window.__player.teleport(x, P.LEVELS[lv].floor + 0.05, z, 0); for (let i = 0; i < 30; i++) await raf(); d.paused = true;
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        d.camera.rotation.set(0, yaw, 0, 'YXZ'); d.camera.updateMatrixWorld(); for (let i = 0; i < 3; i++) d.render();
        const f = time(() => d.render(), 16); R.info.autoReset = false; R.info.reset(); d.render(); const c = R.info.render.calls; R.info.autoReset = true;
        calls += c; ms += f; n++; per[label] = (per[label] || 0) + c / 4;
      }
    }
    d.paused = false; return { calls: Math.round(calls / n), ms: +(ms / n).toFixed(2), per };
  }, { SPOTS });
}
async function view(name, pos, look, fov = 62) {
  await page.evaluate(([pos, look, fov]) => { const d = window.__dbg; d.paused = true; const c = d.camera; c.position.set(...pos); c.lookAt(...look); c.fov = fov; c.updateProjectionMatrix(); for (let i = 0; i < 4; i++) d.render(); }, [pos, look, fov]);
  const png = path.join(OUT, `party_${name}.png`); await page.screenshot({ path: png }); await page.evaluate(() => { window.__dbg.paused = false; });
  return path.relative(ROOT, png);
}
try {
  await page.goto(`http://127.0.0.1:${port}/index.html?menu=0&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => { const q = window.__quality; if (q) { q.set('high'); q.setScale(0.75); } });
  await sleep(1500);
  if (opt.perf) res.perfBefore = await perf('before');
  const t0 = Date.now();
  await page.evaluate(async () => { if (!window.__party) { const m = await import('/src/party/index.js'); m.startParty(window.__mp.ctx, window.__mp); } await window.__party.ready; });
  res.startMs = Date.now() - t0;
  await page.evaluate(() => { const p = window.__player; p.teleport(12.5, 0.0, 20.5, Math.PI); });
  await sleep(2500);
  const api = await page.evaluate(() => { const P = window.__party, m = P.money; const s = m.stackMesh(); const before = m.live();
    m.burst([12.5, 1.2, 21], 60); m.spray([12.5, 1.3, 20.5], [0, 0.3, 1], 0.2); const stop = m.rain([12, 20, 13, 21], 3, 5); stop();
    return { fns: ['burst', 'spray', 'rain', 'stackMesh', 'update'].every(k => typeof m[k] === 'function'), stack: !!s.isMesh, before, decor: P.decor?.counts || null, enabled: P.enabled }; });
  await sleep(1200);
  api.after = await page.evaluate(() => window.__party.money.live());
  res.api = api; checks.api = api.fns && api.stack && api.after.flying + api.after.landed > api.before.flying + api.before.landed && !!api.decor;
  // L: make it rain (third person)
  await page.evaluate(() => { const p = window.__player; p.teleport(11.0, 0.0, 21.2, Math.PI * 0.85); p.state.thirdPerson = true; p.state.pitch = -0.12; });
  await sleep(800);
  await page.keyboard.down('KeyL'); await sleep(1400);
  res.png_rain = path.relative(ROOT, path.join(OUT, 'party_makeitrain.png')); await page.screenshot({ path: path.join(OUT, 'party_makeitrain.png') });
  await page.keyboard.up('KeyL'); await sleep(400);
  const r = await page.evaluate(() => ({ spent: window.__party.rain.spent, chip: document.getElementById('party-cash').textContent, on: document.getElementById('party-cash').classList.contains('on'), live: window.__party.money.live() }));
  res.rain = r; checks.makeItRain = r.spent > 0 && r.on && /CASH::\$/.test(r.chip);
  await sleep(2500);
  // screenshots
  const shots = {};
  shots.pool = await view('pool', [11.2, 1.9, 19.6], [18.0, 0.9, 28.8], 62);
  shots.dj = await view('dj', [17.0, 1.6, 25.3], [19.5, 1.0, 29.6], 60);
  shots.family = await view('family', [8.0, 1.65, 14.0], [4.2, 1.5, 17.8], 66);
  shots.dining = await view('dining', [12.3, 1.6, 13.9], [9.4, 0.5, 15.8], 62);
  shots.kitchen = await view('kitchen', [17.4, 1.55, 13.4], [18.85, 1.0, 15.7], 60);
  shots.front = await view('front', [10.0, 1.4, -0.6], [9.6, 1.4, 4.43], 62);
  res.shots = shots;
  if (opt.perf) { res.perfAfter = await perf('after'); res.perfDelta = { calls: res.perfAfter.calls - res.perfBefore.calls, ms: +(res.perfAfter.ms - res.perfBefore.ms).toFixed(2) }; checks.perfCalls = res.perfDelta.calls <= 80; }
  res.checks = checks; res.errors = logs;
  if (Object.values(checks).some(v => !v) || logs.length) bad = true;
} catch (e) { res.error = e.stack || e.message; res.errors = logs; bad = true; }
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
