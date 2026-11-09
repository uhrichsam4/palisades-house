#!/usr/bin/env node
// Map sweep: screenshot EVERY room of plan.js (two diagonal corner-to-corner views each) plus the outdoor areas, in
// walk mode (real lighting, first person, HUD hidden), from ONE headless Chrome; then 4x3 contact sheets to judge.
//   SHOT_SLOTS=1 node tools/sweep.mjs [--tod=13:00] [--weather=clear] [--only=kitchen,pool_deck] [--out=shots/sweep]
// -> shots/sweep/NN_<name>.jpg + shots/sweep/sheet_K.jpg; one JSON line {shots, sheets, errors}. Shared render-slot lock.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process'; import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') { const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } }); process.exit(r.status ?? 1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const OUT = path.resolve(ROOT, opt.out || 'shots/sweep'); fs.mkdirSync(OUT, { recursive: true });
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let slot = null; while (!slot) { for (let i = 0; i < Number(process.env.SHOT_SLOTS || 1) && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } } if (!slot) await new Promise(r => setTimeout(r, 1500)); }
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });

// plan.js is an ES module without "type": "module" around it: load a temp .mjs copy
const tmp = path.join(OUT, '.plan.mjs'); fs.copyFileSync(path.join(ROOT, 'src/plan.js'), tmp);
const P = await import(pathToFileURL(tmp).href); fs.rmSync(tmp, { force: true });
const LVY = (lv) => (lv === 1 ? 3.35 : 0);
const views = [];
for (const [id, r] of Object.entries(P.ROOMS)) {
  const [x0, z0, x1, z1] = r.rect, y = LVY(r.level) + 0.05, m = Math.min(0.55, (x1 - x0) / 4, (z1 - z0) / 4);
  views.push({ name: `${id}_a`, pos: [x0 + m, y, z0 + m], look: [x1, z1] });
  views.push({ name: `${id}_b`, pos: [x1 - m, y, z1 - m], look: [x0, z0] });
}
// outdoor areas (+z = pool/canyon side, street at -z, +x = garage/court end); y is dropped onto the ground
const OUT_V = [
  ['street_front', [14.5, 1, -14], [14.5, 3]], ['street_west', [2, 1, -12], [8, 2]], ['driveway', [16, 1, -5], [16, 4]],
  ['front_yard', [3, 1.5, -4], [3, 6]], ['front_walk', [11, 1.5, -6], [10, 2]], ['side_yard_sw', [-3, 1.5, 4], [-3, 18]],
  ['back_lawn', [0, 1.5, 26], [12, 18]], ['pool_from_house', [6, 1.5, 17.5], [8, 30]], ['pool_to_house', [10, 1.5, 30], [10, 12]],
  ['canyon_view', [8, 1.5, 31], [8, 60]], ['pingpong_deck', [20, 1.5, 24], [14, 24]], ['court_tennis', [34.1, 2, 0], [34.1, 20]],
  ['court_ring', [36, 2, 30], [40.4, 34.6]], ['garage_side', [24.5, 2, 3], [24.5, -6]], ['balcony_view', [5, 4.5, 14], [6, 30]],
];
for (const [name, pos, look] of OUT_V) views.push({ name, pos, look, outdoor: true });
const only = opt.only ? opt.only.split(',') : null;
const list = only ? views.filter(v => only.some(o => v.name.startsWith(o))) : views;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext|youtube|ytimg|googlevideo|favicon/i;
const errors = []; const shots = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text().slice(0, 240)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 240)));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?menu=0&quality=high&tod=${opt.tod || '13:00'}&weather=${opt.weather || 'clear'}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 240000, polling: 300 });
  await page.waitForFunction(() => window.__probes, null, { timeout: 180000, polling: 500 }).catch(() => {});
  await page.addStyleTag({ content: 'body > *:not(#c){visibility:hidden !important}' });
  await page.evaluate(() => { const s = window.__player.state; s.thirdPerson = false; });
  await new Promise(r => setTimeout(r, 2500));
  let i = 0;
  for (const v of list) {
    const yaw = Math.atan2(-(v.look[0] - v.pos[0]), -(v.look[1] - v.pos[2]));
    await page.evaluate(([x, y, z, yaw]) => { const P = window.__player; P.teleport(x, y, z, yaw); P.state.thirdPerson = false; P.state.yaw = yaw; P.state.pitch = -0.1; }, [...v.pos, yaw]);
    await new Promise(r => setTimeout(r, v.outdoor ? 1600 : 1100));
    const f = path.join(OUT, `${String(i).padStart(2, '0')}_${v.name}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 82 });
    const st = await page.evaluate(() => { const s = window.__player.state; return s.pos.toArray().map(n => +n.toFixed(2)); });
    shots.push({ name: v.name, file: path.relative(ROOT, f), at: st }); i++;
  }
  // contact sheets: 4 x 3 per sheet, labelled
  const sheets = []; const sp = await browser.newPage({ viewport: { width: 1920, height: 920 }, deviceScaleFactor: 1 });
  for (let k = 0; k * 12 < shots.length; k++) {
    const part = shots.slice(k * 12, k * 12 + 12);
    const cells = part.map(s => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(ROOT, s.file)).toString('base64')}"><figcaption>${s.name}</figcaption></figure>`).join('');
    await sp.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(4,480px);gap:0}figure{margin:0;position:relative}img{width:480px;height:300px;display:block}figcaption{position:absolute;left:4px;top:4px;background:#000c;color:#ff0;font:bold 15px monospace;padding:1px 5px}</style>${cells}`);
    const f = path.join(OUT, `sheet_${k}.jpg`); await sp.screenshot({ path: f, type: 'jpeg', quality: 80, fullPage: true }); sheets.push(path.relative(ROOT, f));
  }
  console.log(JSON.stringify({ test: 'sweep', n: shots.length, sheets, shots: shots.map(s => s.name + '@' + s.at.join(',')), errors: [...new Set(errors)].slice(0, 10) }));
} catch (e) { errors.push(String(e.stack || e).slice(0, 400)); console.log(JSON.stringify({ test: 'sweep', errors })); }
await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
