#!/usr/bin/env node
// Branching-tree check (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/trees_test.mjs [--root=<site dir>] [--out=shots/trees] [--q=extra=params] [--size=1280x720]
// Walk mode (?menu=0&noprobes=1, Ultra). Renders fixed cameras (canyon close-up, side yard, pool -> canyon, street,
// p43 view) with the loop paused, then a storm frame (wind sway) and a snow frame if window.__sky exists.
// Prints one JSON line per shot (tree LOD counts, rebin ms, draw calls, triangles) and a summary; exit 1 on errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const ROOT = path.resolve(opt.root || HERE);
const LOCKS = path.join(HERE, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const [W, H] = (opt.size || '1280x720').split('x').map(Number);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext/i;
const OUT = path.resolve(HERE, opt.out || 'shots/trees'); fs.mkdirSync(OUT, { recursive: true });
const CAMS = [
  ['canyon_trees', [8.0, 1.2, 31.0], [4.0, -3.5, 42.0], 50],
  ['side_yard', [-4.5, 1.3, 2.0], [1.0, 1.0, 16.0], 60],
  ['pool_canyon', [9.0, 1.45, 20.9], [11.0, 0.1, 45.0], 60],
  ['street_neighbour', [11.0, 0.75, -7.4], [15.0, 0.4, -24.6], 58],
  ['front_street', [15.0, 0.75, -17.2], [12.8, 2.7, 4.0], 52],
  ['yard_trees', [-2.0, 1.5, 12.0], [-9.0, 4.0, 22.0], 60],
];
const errors = []; const lines = [];
async function session(extra, shots, tag = '') {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?menu=0&noprobes=1&quality=ultra&tod=${opt.tod || "11:00"}${extra}${opt.q ? '&' + opt.q : ''}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 240000, polling: 250 });
  await sleep(2500);
  for (const [name, pos, look, fov] of shots) {
    await page.evaluate(([pos, look]) => { const P = window.__player; const yaw = Math.atan2(-(look[0] - pos[0]), -(look[2] - pos[2])); P.teleport(pos[0], pos[1] - 1.62, pos[2], yaw); P.state.thirdPerson = false; window.__dbg.paused = false; }, [pos, look]);
    await sleep(1200);
    const r = await page.evaluate(([pos, look, fov]) => {
      const D = window.__dbg, cam = D.camera, R = D.renderer; D.paused = true;
      cam.position.set(...pos); cam.lookAt(...look); cam.fov = fov; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      D.render(); R.info.autoReset = false; R.info.reset(); D.render(); const calls = R.info.render.calls, tris = R.info.render.triangles; R.info.autoReset = true;
      const T = window.__trees; return { img: R.domElement.toDataURL('image/jpeg', 0.9), calls, tris, trees: T ? { counts: T.stats.counts, rebinMs: T.stats.lastMs, rebins: T.stats.rebins, kinds: T.kinds, detail: T.detail } : null, sky: window.__sky ? { weather: window.__sky.weather, wind: +window.__sky.wind.toFixed(2), snow: +(window.__sky.snowCover || 0).toFixed(2) } : null };
    }, [pos, look, fov]);
    const f = path.join(OUT, name + tag + '.jpg'); fs.writeFileSync(f, Buffer.from(r.img.split(',')[1], 'base64')); delete r.img;
    const line = { test: 'trees', shot: name + tag, file: f, ...r }; lines.push(line); console.log(JSON.stringify(line));
    await page.evaluate(() => { window.__dbg.paused = false; });
  }
  await page.close();
}
await session('&weather=clear', CAMS);
if (!opt.noweather) {
  await session('&weather=storm', [CAMS[1], CAMS[5]], '_storm');
  await session('&weather=snow', [CAMS[1], CAMS[0]], '_snow');
}
const ok = lines.every(l => l.trees && Object.values(l.trees.counts || {}).length);
console.log(JSON.stringify({ test: 'trees', shots: lines.length, treesPresent: ok, errors: [...new Set(errors)].slice(0, 8) }));
await browser.close(); server.close();
process.exit(errors.length || !ok ? 1 : 0);
