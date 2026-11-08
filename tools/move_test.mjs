#!/usr/bin/env node
// In-game third-person movement check (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/move_test.mjs
// Pool terrace: idle, walk, run, jump (air), land; pool: swim, tread, climb out at the edge; wave (B).
// Screenshots shots/move/<state>.png; prints the player state + animator weights per step. Exit 1 on errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext/i;
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?menu=0&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000, polling: 250 });
await sleep(1500);
const dir = path.join(ROOT, 'shots', 'move'); fs.mkdirSync(dir, { recursive: true });
const out = { test: 'move', steps: [] };
const snap = async (name) => {
  const st = await page.evaluate(() => { const P = window.__player, s = P.state, w = P.creature.animator?.weights || {}; const top = Object.entries(w).filter(([, v]) => v > 0.05).map(([k, v]) => k + ':' + v.toFixed(2)).join(' ');
    return { pos: s.pos.toArray().map(v => +v.toFixed(2)), speed: +s.speed.toFixed(2), grounded: s.grounded, swimming: s.swimming, third: s.thirdPerson, anim: top }; });
  const f = path.join(dir, name + '.png'); await page.screenshot({ path: f }); out.steps.push({ name, png: path.relative(ROOT, f), ...st });
};
// autopilot helper: (seconds) -> {mx, mz, run, jump}
const drive = (src) => page.evaluate((src) => { const P = window.__player; let t = 0; const fn = new Function('t', 'return (' + src + ')(t)'); P.state.autopilot = (dt) => { t += dt; return fn(t); }; }, src);
// pool terrace (open, flat; the front porch is too narrow for a run-up): walking along +x (camera behind-right)
await page.evaluate(() => { const P = window.__player; P.teleport(5.0, 0.3, 21.6, -Math.PI / 2); P.state.yaw = -Math.PI / 2 + 0.5; P.state.pitch = -0.15; P.state.thirdPerson = true; });
await sleep(1200); await snap('idle');
await drive('(t) => ({ mx: 0, mz: 0.45, run: false })'); await page.evaluate(() => { window.__player.state.yaw = -Math.PI / 2 + 0.35; }); await sleep(900); await snap('walk');
await drive('(t) => ({ mz: 1, run: true })'); await sleep(900); await snap('run');
await drive('(t) => ({ mz: 1, run: true, jump: t < 0.12 })'); await sleep(330); await snap('jump');
await sleep(420); await snap('fall_or_land');
await drive('(t) => ({ mz: 0 })'); await sleep(250); await snap('land'); await sleep(700);
await page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); });
await page.keyboard.press('KeyB'); await sleep(900); await snap('wave');
// pool: deep end, swim along +x, then tread, then swim to the house-side wall (−z) and climb out
await page.evaluate(() => { const P = window.__player; P.teleport(12.5, -1.6, 25.6, -Math.PI / 2); P.state.yaw = -Math.PI / 2 + 0.6; P.state.pitch = -0.25; });
await sleep(1500); await snap('tread');
await drive('(t) => ({ mz: 1, run: false })'); await sleep(1300); await snap('swim');
await page.evaluate(() => { const P = window.__player; P.state.yaw = 0; });
await drive('(t) => ({ mz: 1 })'); 
let climbed = false; for (let i = 0; i < 30 && !climbed; i++) { await sleep(250); climbed = await page.evaluate(() => { const s = window.__player.state; return !s.swimming && !s.inWater && s.pos.y > -0.3; }); if (i === 6) await snap('swim_to_edge'); }
await sleep(400); await snap('climb_out');
await page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); });
out.climbedOut = climbed;
const st = out.steps; const by = Object.fromEntries(st.map(s => [s.name, s]));
out.checks = { walk: /loco/.test(by.walk.anim) && by.walk.speed > 0.8, run: by.run.speed > 3, jump: !by.jump.grounded, swim: by.swim.swimming && /swim/.test(by.swim.anim), climbOut: climbed, thirdPerson: by.idle.third };
out.errors = logs;
for (const s of st) console.log(JSON.stringify(s));
console.log(JSON.stringify({ test: 'move', checks: out.checks, errors: logs }));
await browser.close(); server.close();
process.exit(Object.values(out.checks).some(v => !v) || logs.length ? 1 : 0);
