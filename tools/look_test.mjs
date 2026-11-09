#!/usr/bin/env node
// RTX-look check (src/look + rain): same-camera A/B screenshots per feature -> shots/look/*.jpg. Headless Chrome, ONE browser, utility QoS, shared render-slot locks.
//   SHOT_SLOTS=2 node tools/sky_test.mjs            -> times × views + weather screenshots in shots/sky/*.jpg
//   SHOT_SLOTS=2 node tools/sky_test.mjs --only=times|weather   (one group)
//   SHOT_SLOTS=2 node tools/sky_test.mjs --sync     -> 2 players in one lobby (+ a late joiner): same clock, rain set by A
//   SHOT_SLOTS=2 node tools/sky_test.mjs --prof     -> per-frame cost of the sky update (window.__prof) per weather
// Prints one JSON line per shot/check and a summary line; exit 1 on errors or failed checks.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext|\[lobbies\]|youtube|ytimg/i;
const dir = path.join(ROOT, 'shots', 'look'); fs.mkdirSync(dir, { recursive: true });
let bad = false; const out = { test: 'look' };

async function open(q, vp = { width: 1600, height: 900 }) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 }); const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__sky, null, { timeout: 180000, polling: 250 });
  return { page, logs };
}


const VIEWS = {
  pool: { player: [14.0, 0, 30.0], pos: [10.5, 1.2, 22.4], look: [10.5, -0.4, 26.2], fov: 62 },
  lawn: { player: [14.0, 0, 27.0], pos: [12.0, 0.55, 28.3], look: [15.5, -0.05, 30.4], fov: 60 },
  rain: { player: [9.0, 0, -9.0], pos: [6.5, 1.6, -12.5], look: [11.5, 2.4, 4.0], fov: 62 },
  family: { piece: 'family' }, dining: { player: [11.8, 0, 14.5], pos: [11.8, 1.5, 13.2], look: [11.0, 0.6, 19.0], fov: 66 },
};
async function shoot(P, name, { view, tod, weather, before = null, after = null, frames = 40 }) {
  const page = P.page;
  const res = await page.evaluate(async ({ view, VIEWS, tod, weather, frames }) => {
    const d = window.__dbg, sky = window.__sky, raf = () => new Promise(r => requestAnimationFrame(r));
    let v = VIEWS[view];
    if (v.piece) { const m = await import('/src/rooms/' + v.piece + '.js'); const k = Object.keys(m.views)[0]; const pv = m.views[k]; v = { player: [pv.pos[0], pv.pos[1] > 3 ? 3.35 : 0, pv.pos[2]], pos: pv.pos, look: pv.look, fov: pv.fov || 60 }; }
    sky.set({ tod, weather, instant: true });
    d.paused = false; window.__player.teleport(v.player[0], v.player[1] + 0.05, v.player[2], 0); window.__player.state.thirdPerson = false;
    for (let i = 0; i < frames; i++) await raf();
    d.paused = true;
    d.camera.fov = v.fov; d.camera.position.set(...v.pos); d.camera.lookAt(...v.look); d.camera.updateProjectionMatrix(); d.camera.updateMatrixWorld();
    sky.set({ instant: true }); window.__lookStep = () => { const t = performance.now() / 1000; window.__look?.beams?.update(0.016, t, d.camera, sky); window.__look?.grass?.update(0.016, t, d.camera, sky, [window.__player.position]); };
    window.__lookStep(); d.renderer.shadowMap.needsUpdate = true; d.render(); d.render();
    return { clock: sky.clock, weather: sky.weather, sun: sky.sun, look: window.__look?.state() };
  }, { view, VIEWS, tod, weather, frames });
  const shots = [];
  for (const [tag, fn] of [['before', before], ['after', after]]) {
    if (!fn) continue;
    await page.evaluate(`(${fn})(); window.__lookStep(); window.__dbg.render(); window.__dbg.render();`);
    const f = path.join(dir, `${name}_${tag}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); shots.push(f);
  }
  if (!before && !after) { const f = path.join(dir, `${name}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); shots.push(f); }
  await page.evaluate(() => { window.__dbg.paused = false; window.__look?.apply(); });
  const line = { shot: name, files: shots, ...res }; console.log(JSON.stringify(line)); return line;
}
const OFF = { beams: "() => { window.__look.beams.enabled = false; }", beamsOn: "() => { window.__look.beams.enabled = true; }",
  grassOff: "() => { window.__look.grass.mode = 'off'; }", grassOn: "() => { window.__look.grass.mode = 'high'; }",
  neutral: "() => { window.__look.film.set(window.__dbg.renderer, 'neutral'); }", agx: "() => { window.__look.film.set(window.__dbg.renderer, 'agx'); }" };
const P = await open('menu=0&tod=13:00&weather=clear&quality=high');
await P.page.waitForFunction(() => window.__probes && window.__sky.nightReady, null, { timeout: 240000, polling: 500 }).catch(() => { out.timeout = 'probes'; });
await P.page.evaluate(() => { document.getElementById('help')?.style.setProperty('display', 'none'); });
const only = (opt.only || 'all').split(',');
const want = (k) => only.includes('all') || only.includes(k);
const shots = [];
if (want('beams')) for (const [tod, v] of [['08:00', 'family'], ['17:30', 'family'], ['08:00', 'dining'], ['17:30', 'dining']]) shots.push(await shoot(P, `beams_${v}_${tod.replace(':', '')}`, { view: v, tod, weather: 'clear', before: OFF.beams, after: OFF.beamsOn }));
if (want('film')) shots.push(await shoot(P, 'film_family', { view: 'family', tod: '11:00', weather: 'clear', before: OFF.neutral, after: OFF.agx }));
if (want('film')) shots.push(await shoot(P, 'film_pool', { view: 'pool', tod: '11:00', weather: 'clear', before: OFF.neutral, after: OFF.agx }));
if (want('caustics')) shots.push(await shoot(P, 'caustics_pool', { view: 'pool', tod: '12:30', weather: 'clear' }));
if (want('grass')) { shots.push(await shoot(P, 'grass_lawn', { view: 'lawn', tod: '16:30', weather: 'clear', before: OFF.grassOff, after: OFF.grassOn })); shots.push(await shoot(P, 'grass_snow', { view: 'lawn', tod: '12:00', weather: 'snow' })); }
if (want('rain')) { shots.push(await shoot(P, 'rain_front', { view: 'rain', tod: '11:00', weather: 'rain' })); shots.push(await shoot(P, 'rain_pool', { view: 'pool', tod: '11:00', weather: 'storm' })); }
if (want('menu')) {
  await P.page.evaluate(() => { const b = document.querySelector('[data-act="settings"]'); b?.click(); });
  await sleep(800); const f = path.join(dir, 'video_settings.jpg');
  const panel = await P.page.$('section[data-panel="settings"]'); if (panel) await panel.screenshot({ path: f, type: 'jpeg', quality: 88 }).catch(() => P.page.screenshot({ path: f, type: 'jpeg', quality: 88 })); else await P.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
  shots.push({ shot: 'menu', files: [f] }); console.log(JSON.stringify(shots.at(-1)));
}
const errors = await P.page.evaluate(() => window.__errors.slice());
out.shots = shots.length; out.errors = [...errors, ...P.logs]; out.state = await P.page.evaluate(() => window.__look?.state());
if (out.errors.length) bad = true;
console.log(JSON.stringify(out));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
