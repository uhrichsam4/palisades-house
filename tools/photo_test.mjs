#!/usr/bin/env node
// Photo mode + Settings > VIDEO check (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/photo_test.mjs [--size=1280x800]
// 1. VIDEO settings: screenshot of the section; every control changed in turn -> logs window.__video (pixel ratio,
//    AO mode, shadow map, bloom, AA, lights) + draw calls; reload -> the values persist.
// 2. Photo mode (P): same view in normal Ultra vs photo mode (accumulated), panel open, 9:16 frame, depth of field,
//    Take photo (Enter) -> the 2x PNG download is saved to shots/photo/; P again -> quality, player control, HUD and
//    sky state are restored. Prints JSON lines; exit 1 on errors or failed checks.
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
const [W, H] = (opt.size || '1280x800').split('x').map(Number);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext/i;
const OUT = path.join(ROOT, 'shots', 'photo'); fs.mkdirSync(OUT, { recursive: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage();
const errors = []; page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); }); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const URL0 = `http://127.0.0.1:${port}/index.html?menu=0&noprobes=1&tod=10:30`;
const boot = async () => { await page.goto(URL0, { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 240000, polling: 250 }); await sleep(2500); };
const shot = async (name) => { const f = path.join(OUT, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 90 }); return f; };
const log = (o) => console.log(JSON.stringify(o));
const checks = {};
const calls = () => page.evaluate(() => { const D = window.__dbg, R = D.renderer; D.paused = true; R.info.autoReset = false; R.info.reset(); D.render(); const c = R.info.render.calls, t = R.info.render.triangles; R.info.autoReset = true; D.paused = false; return { calls: c, tris: t }; });

await boot();
// ------------------------------------------------------------ 1. VIDEO settings
await page.evaluate(() => { localStorage.removeItem('ph.settings'); });
await page.evaluate(() => window.__menu.openSettings()); await sleep(900);
log({ step: 'settings-open', file: await shot('settings_video'), video: await page.evaluate(() => window.__video) });
const set = async (patch, label) => { await page.evaluate((p) => { const S = JSON.parse(localStorage.getItem('ph.settings') || '{}'); window.__settingsSet ? window.__settingsSet(p) : null; }, patch);
  // click through the real UI where a control exists
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'quality') await page.click(`#gs-preset button[data-v="${v}"]`);
    else if (k === 'res') { if (v === 'auto') await page.click('#gs-resmode button[data-v="auto"]'); else { await page.click('#gs-resmode button[data-v="fixed"]'); await page.$eval('#gs-res', (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); }, v); } }
    else if (k === 'fov') await page.$eval('#gs-fov', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, v);
    else await page.click(`.gs-ctl[data-k="${k}"] button[data-v="${v}"]`);
  }
  await sleep(700);
  const r = await page.evaluate(() => ({ video: window.__video, settings: JSON.parse(localStorage.getItem('ph.settings') || '{}'), trees: window.__trees ? [window.__trees.detail, window.__trees.far] : null, fov: window.__dbg.camera.fov, shadowRadius: window.__dbg.sun.shadow.radius, castShadow: window.__dbg.sun.castShadow }));
  const c = await calls();
  log({ step: 'set', label, patch, ...c, video: r.video, quality: r.settings.quality, base: r.settings.base, trees: r.trees, fov: r.fov, castShadow: r.castShadow }); return { ...r, ...c };
};
await page.evaluate(() => { window.__player.teleport(18.0, 0.3, 24.0, Math.PI); });
const runs = {};
runs.ultra = await set({ quality: 'ultra' }, 'preset ultra');
runs.low = await set({ quality: 'low' }, 'preset low');
runs.res = await set({ res: 150 }, 'res 150%');
runs.shadowsOff = await set({ shadows: 'off' }, 'shadows off');
runs.shadowsUltra = await set({ shadows: 'ultra' }, 'shadows ultra');
runs.aoFull = await set({ ao: 'full' }, 'ao full');
runs.bloomOn = await set({ bloom: 'on' }, 'bloom on');
runs.aaSmaa = await set({ aa: 'smaa' }, 'aa smaa');
runs.trees = await set({ treeDetail: 'high' }, 'trees high');
runs.view = await set({ viewDist: 'far' }, 'view far');
runs.weather = await set({ weatherDetail: 'high' }, 'weather high');
runs.fov = await set({ fov: 90 }, 'fov 90');
runs.max = await set({ quality: 'max' }, 'preset MAX');
await shot('settings_video_max');
runs.custom = await set({ ao: 'half' }, 'MAX -> custom ao half');
checks.customSwitch = runs.custom.settings.quality === 'custom';
checks.resFixed = Math.abs(runs.res.video.pixelRatio - 1.5) < 0.01;
checks.shadowsOff = runs.shadowsOff.castShadow === false && runs.shadowsOff.video.shadowMap === 0;
checks.shadowsUltra = runs.shadowsUltra.video.shadowMap === 4096 && runs.shadowsUltra.shadowRadius === 5;
checks.aoFull = /^full/.test(runs.aoFull.video.ao) && /^off/.test(runs.low.video.ao);
checks.max = runs.max.video.tier === 'MAX' && /^full:64/.test(runs.max.video.ao) && runs.max.video.lights?.[0] >= 4;
checks.fov = Math.abs(runs.fov.fov - 90) < 0.01;
// persistence across reload
const before = await page.evaluate(() => localStorage.getItem('ph.settings'));
await boot();
const after = await page.evaluate(() => ({ s: localStorage.getItem('ph.settings'), video: window.__video, fov: window.__dbg.camera.fov }));
checks.persist = before === after.s && after.video?.tier === 'Custom' && /^half/.test(after.video?.ao);
log({ step: 'reload', persisted: checks.persist, video: after.video, fov: after.fov });
// back to Ultra for the photo comparison
await page.evaluate(() => window.__menu.openSettings()); await sleep(500); await page.click('#gs-preset button[data-v="ultra"]'); await page.$eval('#gs-fov', (el) => { el.value = 70; el.dispatchEvent(new Event('input')); });
await page.keyboard.press('Escape'); await sleep(300);
await page.evaluate(() => { const b = document.querySelector('[data-act="close"]'); if (window.__menu.mode === 'game' && document.getElementById('gm-panel') && !document.getElementById('gm-panel').hidden) b?.click(); });

// ------------------------------------------------------------ 2. photo mode
await page.evaluate(() => { const P = window.__player; P.teleport(9.0, 0.3, 21.2, 0); P.state.thirdPerson = true; P.state.yaw = Math.PI * 0.92; P.state.pitch = -0.12; });
await sleep(2500);
const st0 = await page.evaluate(() => ({ q: window.__quality.name, frozen: !!window.__player.state.frozen, body: document.body.className, sky: window.__sky ? { weather: window.__sky.weather, clock: window.__sky.clock } : null, video: window.__video }));
log({ step: 'normal', file: await shot('normal_ultra'), ...st0 });
await page.keyboard.press('KeyP'); await page.waitForFunction(() => window.__photo?.active, null, { timeout: 30000 });
await page.keyboard.press('Tab'); // panel away for the clean comparison
await page.waitForFunction(() => window.__photo.samples > 40, null, { timeout: 60000, polling: 200 });
log({ step: 'photo-accumulated', file: await shot('photo_accumulated'), samples: await page.evaluate(() => window.__photo.samples), video: await page.evaluate(() => window.__video), body: await page.evaluate(() => document.body.className) });
await page.keyboard.press('Tab'); await sleep(700);
log({ step: 'photo-panel', file: await shot('photo_panel') });
await page.evaluate(() => window.__photo.set({ guide: '9:16' })); await sleep(400);
log({ step: 'photo-916', file: await shot('photo_9x16') });
// depth of field: fly a little closer to a chair on the deck, focus on what is under the centre, wide aperture
await page.evaluate(() => { window.__photo.set({ guide: 'free', dof: 'manual', focus: 2.2, aperture: 0.06, filter: 'film' }); });
await page.keyboard.press('Tab');
await page.waitForFunction(() => window.__photo.samples > 60, null, { timeout: 60000, polling: 200 });
log({ step: 'photo-dof', file: await shot('photo_dof'), state: await page.evaluate(() => ({ focus: window.__photo.state.focus, aperture: window.__photo.state.aperture })) });
// time + weather from the panel
const skyOk = await page.evaluate(() => !!window.__sky);
if (skyOk) { await page.evaluate(() => { window.__photo.set({ dof: 'off', filter: 'none' }); window.__photo.setTod(19.3); window.__photo.setWeather('cloudy'); });
  await page.waitForFunction(() => window.__photo.samples > 30, null, { timeout: 60000, polling: 200 });
  log({ step: 'photo-sunset', file: await shot('photo_sunset'), sky: await page.evaluate(() => ({ weather: window.__sky.weather, clock: window.__sky.clock })) }); }
// take photo (Enter) -> download
const dl = page.waitForEvent('download', { timeout: 120000 });
await page.keyboard.press('Enter');
const d = await dl; const name = d.suggestedFilename(); const dst = path.join(OUT, name); await d.saveAs(dst);
const info = await page.evaluate(() => window.__photoLast);
const sz = fs.statSync(dst).size;
checks.download = /^palisades-\d{4}-\d{2}-\d{2}-\d{6}\.png$/.test(name) && sz > 100000 && info && info.width >= W * 1.5;
log({ step: 'photo-save', file: dst, bytes: sz, ...info });
// exit
await page.keyboard.press('KeyP'); await sleep(1500);
const st1 = await page.evaluate(() => ({ q: window.__quality.name, frozen: !!window.__player.state.frozen, body: document.body.className, sky: window.__sky ? { weather: window.__sky.weather, clock: window.__sky.clock } : null, video: window.__video, active: window.__photo.active, hold: window.__quality.hold }));
log({ step: 'exit', file: await shot('after_exit'), ...st1 });
checks.restore = !st1.active && !st1.frozen && !st1.hold && st1.q === st0.q && !/\bphoto\b/.test(st1.body) && !/ui-open/.test(st1.body) && (!st0.sky || st1.sky.weather === st0.sky.weather) && st1.video.tier === st0.video.tier && JSON.stringify(st1.video.lights) === JSON.stringify(st0.video.lights);
const ok = Object.values(checks).every(Boolean);
log({ test: 'photo', checks, errors: [...new Set(errors)].slice(0, 8), windowErrors: await page.evaluate(() => window.__errors) });
await browser.close(); server.close();
process.exit(!ok || errors.length ? 1 : 0);
