#!/usr/bin/env node
// Day/night + weather check (src/sky). Headless Chrome, ONE browser, utility QoS, shared render-slot locks.
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
const dir = path.join(ROOT, 'shots', 'sky'); fs.mkdirSync(dir, { recursive: true });
let bad = false; const out = { test: 'sky' };

async function open(q, vp = { width: 1600, height: 900 }) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 }); const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__sky, null, { timeout: 180000, polling: 250 });
  return { page, logs };
}

// ---------------------------------------------------------------- screenshots
const VIEWS = {
  front: { player: [9.0, 0, -9.0], pos: [6.5, 1.7, -15.5], look: [11.5, 3.2, 4.0], fov: 62 },
  pool: { player: [14.0, 0, 30.0], pos: [16.0, 1.7, 34.5], look: [12.5, 3.0, 12.0], fov: 62 },
  family: { piece: 'family' }, kitchen: { piece: 'kitchen' },
};
async function shoot(P, name, { view, tod, weather, flash = false, frames = 30 }) {
  const page = P.page;
  const res = await page.evaluate(async ({ view, VIEWS, tod, weather, flash, frames }) => {
    const d = window.__dbg, sky = window.__sky, raf = () => new Promise(r => requestAnimationFrame(r));
    let v = VIEWS[view];
    if (v.piece) { const m = await import('/src/rooms/' + v.piece + '.js'); const k = Object.keys(m.views)[0]; const pv = m.views[k]; v = { player: [pv.pos[0], pv.pos[1] > 3 ? 3.35 : 0, pv.pos[2]], pos: pv.pos, look: pv.look, fov: pv.fov || 60, photo: k }; }
    sky.set({ tod, weather, instant: true });
    d.paused = false; window.__player.teleport(v.player[0], v.player[1] + 0.05, v.player[2], 0); window.__player.state.thirdPerson = false;
    for (let i = 0; i < frames; i++) await raf(); // light pool / culling / ripples / exposure settle at the new spot
    d.paused = true;
    d.camera.fov = v.fov; d.camera.position.set(...v.pos); d.camera.lookAt(...v.look); d.camera.updateProjectionMatrix(); d.camera.updateMatrixWorld();
    sky.set({ instant: true }); // re-evaluate indoor/fog for the final camera
    if (flash) { sky.set({ flash: 'hold' }); d.paused = false; await raf(); d.paused = true; d.camera.position.set(...v.pos); d.camera.lookAt(...v.look); d.camera.updateMatrixWorld(); }
    d.renderer.shadowMap.needsUpdate = true; d.render(); d.render();
    if (flash) sky.set({ flash: false });
    return { photo: v.photo || null, clock: sky.clock, weather: sky.weather, tempC: +sky.tempC.toFixed(1), feelsC: +sky.feelsC.toFixed(1), severity: +sky.severity.toFixed(2), precip: sky.precip, snowCover: +sky.snowCover.toFixed(2), indoor: sky.indoor, sun: sky.sun, exposure: +d.renderer.toneMappingExposure.toFixed(3), fog: +(d.scene.fog?.density || 0).toFixed(4), wet: +sky.wet.toFixed(2), nightReady: sky.nightReady };
  }, { view, VIEWS, tod, weather, flash, frames });
  const f = path.join(dir, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 86 });
  await page.evaluate(() => { window.__dbg.paused = false; });
  const line = { shot: name, file: f, ...res }; console.log(JSON.stringify(line)); return line;
}

async function screens() {
  const P = await open('menu=0&tod=13:00&weather=clear&quality=high');
  await page_wait(P);
  await P.page.evaluate(() => { document.getElementById('help')?.style.setProperty('display', 'none'); });
  const shots = [];
  const only = opt.only || 'all';
  if (only === 'rain') { shots.push(await shoot(P, 'rain_pool', { view: 'pool', tod: '11:00', weather: 'rain' })); shots.push(await shoot(P, 'storm_flash', { view: 'pool', tod: '16:00', weather: 'storm', flash: true })); shots.push(await shoot(P, 'fog_front', { view: 'front', tod: '09:30', weather: 'fog' })); shots.push(await shoot(P, 'sunset_pool', { view: 'pool', tod: '19:15', weather: 'clear' })); shots.push(await shoot(P, 'night_kitchen', { view: 'kitchen', tod: '23:00', weather: 'clear' })); }
  if (only === 'snow') { shots.push(await shoot(P, 'snow_front', { view: 'front', tod: '12:00', weather: 'snow' })); shots.push(await shoot(P, 'blizzard_pool', { view: 'pool', tod: '15:00', weather: 'blizzard' })); shots.push(await shoot(P, 'snow_night_pool', { view: 'pool', tod: '21:30', weather: 'snow' })); }
  if (only === 'panel') { await P.page.evaluate(() => window.__sky.set({ tod: '18:40', weather: 'cloudy', instant: true })); await P.page.keyboard.press('KeyK'); await sleep(900);
    await P.page.click('#sky-panel [data-mode="rain"]'); await sleep(900); const f = path.join(dir, 'panel.jpg'); await P.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
    const st = await P.page.evaluate(() => ({ weather: window.__sky.weather, mode: window.__sky.mode, uiOpen: document.body.classList.contains('ui-open') })); shots.push({ shot: 'panel', file: f, ...st }); console.log(JSON.stringify(shots.at(-1)));
    await P.page.keyboard.press('KeyK'); await sleep(400); out.panelClosed = await P.page.evaluate(() => !document.body.classList.contains('ui-open')); }
  if (only === 'quick') for (const [tod, tag] of [['13:00', 'noon'], ['19:15', 'sunset'], ['23:00', 'night']]) for (const view of ['front', 'family']) shots.push(await shoot(P, `${tag}_${view}`, { view, tod, weather: 'clear' }));
  if (only === 'all' || only === 'times') {
    for (const [tod, tag] of [['07:00', 'sunrise'], ['13:00', 'noon'], ['19:15', 'sunset'], ['23:00', 'night']])
      for (const view of ['front', 'pool', 'family', 'kitchen']) shots.push(await shoot(P, `${tag}_${view}`, { view, tod, weather: 'clear' }));
  }
  if (only === 'all' || only === 'weather') {
    shots.push(await shoot(P, 'rain_pool', { view: 'pool', tod: '11:00', weather: 'rain' }));
    shots.push(await shoot(P, 'rain_front', { view: 'front', tod: '11:00', weather: 'rain' }));
    shots.push(await shoot(P, 'rain_inside_family', { view: 'family', tod: '11:00', weather: 'rain' }));
    shots.push(await shoot(P, 'storm_flash', { view: 'pool', tod: '16:00', weather: 'storm', flash: true }));
    shots.push(await shoot(P, 'storm', { view: 'front', tod: '16:00', weather: 'storm' }));
    shots.push(await shoot(P, 'fog_front', { view: 'front', tod: '09:30', weather: 'fog' }));
    shots.push(await shoot(P, 'cloudy_sunset_pool', { view: 'pool', tod: '19:05', weather: 'cloudy' }));
    shots.push(await shoot(P, 'overcast_front', { view: 'front', tod: '14:00', weather: 'overcast' }));
    shots.push(await shoot(P, 'rain_night_front', { view: 'front', tod: '22:00', weather: 'rain' }));
    shots.push(await shoot(P, 'snow_front', { view: 'front', tod: '12:00', weather: 'snow' }));
    shots.push(await shoot(P, 'blizzard_pool', { view: 'pool', tod: '15:00', weather: 'blizzard' }));
  }
  // rain must never be drawn indoors: count drops whose position is under the height map (CPU replica of the shader)
  const indoorRain = await P.page.evaluate(() => { const r = window.__dbg.scene.getObjectByName('sky:rain'); return r ? { instances: r.geometry.instanceCount } : null; });
  const errors = await P.page.evaluate(() => window.__errors.slice());
  out.shots = shots.length; out.indoorRain = indoorRain; out.errors = [...errors, ...P.logs];
  out.info = await P.page.evaluate(() => ({ skyInfo: window.__skyInfo, probes: window.__probes, probesNight: window.__probesNight }));
  if (out.errors.length) bad = true;
}
async function page_wait(P) {
  await P.page.waitForFunction(() => window.__probes && window.__sky.nightReady, null, { timeout: 240000, polling: 500 }).catch(() => { out.timeout = 'probes'; bad = true; });
  await sleep(500);
}

// ---------------------------------------------------------------- per-frame cost of the sky update
async function prof() {
  const P = await open('menu=0&tod=13:00&weather=clear'); await page_wait(P);
  out.prof = {};
  for (const w of ['clear', 'cloudy', 'fog', 'rain', 'storm']) {
    const r = await P.page.evaluate(async (w) => {
      const raf = () => new Promise(r => requestAnimationFrame(r)); window.__sky.set({ weather: w, tod: '18:40', frozen: false, instant: true });
      window.__player.teleport(16, 0.05, 30, 0); for (let i = 0; i < 30; i++) await raf();
      const p = window.__prof; p.on = true; p.reset(); let worst = 0, last = performance.now();
      for (let i = 0; i < 240; i++) { await raf(); const n = performance.now(); worst = Math.max(worst, n - last); last = n; }
      p.on = false; const rep = p.report(); const row = (k) => (rep.rows.find(r => r[0] === k) || [k, 0])[1];
      return { weather: w, skyMsPerFrame: row('sky'), shadowRefreshesPerFrame: row('shadow refreshes/frame'), wallMsPerFrame: rep.wallMsPerFrame, worstFrameMs: +worst.toFixed(1) };
    }, w);
    out.prof[w] = r; console.log(JSON.stringify(r));
  }
  out.errors = [...(await P.page.evaluate(() => window.__errors.slice())), ...P.logs]; if (out.errors.length) bad = true;
}

// ---------------------------------------------------------------- 2-player sync + late joiner
async function sync() {
  const code = 'sky' + Math.random().toString(36).slice(2, 7);
  const q = `room=${code}&only=kitchen&noprobes=1&quality=low`;
  const A = await open(q, { width: 900, height: 560 }), B = await open(q, { width: 900, height: 560 });
  const conn = await until(async () => (await A.page.evaluate(() => window.__mp.members.size)) >= 1 && (await B.page.evaluate(() => window.__mp.members.size)) >= 1, 90000, 1000);
  out.connected = !!conn; if (!conn) { bad = true; return; }
  await sleep(1500);
  const clocks = async (...Ps) => Promise.all(Ps.map(P => P.page.evaluate(() => ({ clock: window.__sky.clock, tod: window.__sky.tod, weather: window.__sky.weather, mode: window.__sky.mode, skew: Math.round(window.__sky.skew) }))));
  const minDiff = (a, b) => { const d = Math.abs(a - b) * 1440; return Math.min(d, 1440 - d); };
  const [a0, b0] = await clocks(A, B); out.clocks = { A: a0, B: b0, diffGameMin: +minDiff(a0.tod, b0.tod).toFixed(2) };
  const t0 = Date.now(); await A.page.evaluate(() => window.__sky.set({ weather: 'rain' }));
  const got = await until(async () => (await B.page.evaluate(() => window.__sky.weather)) === 'rain', 5000, 100);
  out.rainOnB = { ok: !!got, ms: got ? Date.now() - t0 : null };
  await B.page.close();
  const C = await open(q, { width: 900, height: 560 });
  const t1 = Date.now(); const lateOk = await until(async () => (await C.page.evaluate(() => window.__sky.weather)) === 'rain', 30000, 250);
  out.lateJoiner = { ok: !!lateOk, msAfterReady: lateOk ? Date.now() - t1 : null };
  const [a1, c1] = await clocks(A, C); out.clocksLate = { A: a1, C: c1, diffGameMin: +minDiff(a1.tod, c1.tod).toFixed(2) };
  out.checks = { sameClock: out.clocks.diffGameMin <= 1, rainWithin2s: out.rainOnB.ok && out.rainOnB.ms <= 2000, lateJoinerRain: out.lateJoiner.ok, lateSameClock: out.clocksLate.diffGameMin <= 1 };
  out.errors = [...A.logs, ...B.logs, ...C.logs, ...(await A.page.evaluate(() => window.__errors.slice())), ...(await C.page.evaluate(() => window.__errors.slice()))];
  if (Object.values(out.checks).some(v => !v) || out.errors.length) bad = true;
}

try {
  if (opt.sync) { out.mode = 'sync'; await sync(); }
  else if (opt.prof) { out.mode = 'prof'; await prof(); }
  else { out.mode = 'screens'; await screens(); }
} catch (e) { out.fatal = String(e.stack || e); bad = true; }
console.log(JSON.stringify(out));
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
