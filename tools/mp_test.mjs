#!/usr/bin/env node
// Multiplayer + water-creature test harness (headless Chrome, real GPU).
//   node tools/mp_test.mjs                 two pages in the same room: A runs around, B must see 1 peer
//                                          moving -> shots/mp_a.png, shots/mp_b.png (needs internet: Nostr relays)
//   node tools/mp_test.mjs --look          creature look-dev shots (third-person): foyer + test pool
//                                          -> shots/creature_foyer*.png, shots/creature_pool*.png
//   node tools/mp_test.mjs --perf          frame time with 1 local + 3 bot creatures (?bots=3)
//   --only=foyer   pass-through piece filter (faster)   --tag=x  suffix for look shots
// Prints JSON lines; exit code 1 on failure.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const opt = {};
for (const a of args) { const m = a.match(/^--(\w+)(?:=(.*))?$/); if (m) opt[m[1]] = m[2] ?? '1'; }
const outDir = path.resolve(ROOT, 'shots'); fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.exr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = 1280, H = 800;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::/i;

async function open(q) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const logs = [], netlogs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') (IGNORE.test(m.text()) ? netlogs : logs).push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + (logs.some(l => l.includes(e.message)) ? e.message : e.stack)));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}${opt.only ? '&only=' + opt.only : ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000, polling: 250 });
  await sleep(1500);
  return { page, logs, netlogs };
}
const shot = async (page, name) => { const p = path.join(outDir, name); await page.screenshot({ path: p }); return path.relative(ROOT, p); };
async function frameStats(page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const d = []; let last = performance.now(); const end = last + ms; const pl = []; const sim = [];
    await new Promise(res => { const f = () => { const n = performance.now(); d.push(n - last); last = n; pl.push(window.__player.frameMs); sim.push(window.__player.creature.simMs); if (n < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    d.shift(); d.sort((a, b) => a - b); const avg = d.reduce((a, b) => a + b, 0) / d.length;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return { frames: d.length, avgMs: +avg.toFixed(2), p50: +d[Math.floor(d.length / 2)].toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), playerUpdateMs: +mean(pl).toFixed(2), workerSimMs: +mean(sim).toFixed(2), worker: window.__player.creature.usingWorker };
  }, ms);
}
// Place the player and aim the camera at the creature from a given orbit (yaw offset rel. facing).
async function pose(page, { x, y, z, facing, camYaw, pitch = -0.2, dist = 2.6, settle = 1500 }) {
  await page.evaluate(({ x, y, z, facing, camYaw, pitch, dist }) => {
    const P = window.__player; P.teleport(x, y, z, facing); P.state.yaw = camYaw; P.state.pitch = pitch; P.state.camWant = dist; P.state.camDist = dist; P.state.thirdPerson = true;
  }, { x, y, z, facing, camYaw, pitch, dist });
  await sleep(settle);
}
let bad = false;
const report = (o) => { console.log(JSON.stringify(o)); };

if (opt.look || opt.perf) {
  const q = opt.perf ? 'bots=3' : 'room=look-' + Date.now().toString(36);
  const { page, logs } = await open(q + (opt.perf ? '&room=perf-' + Date.now().toString(36) : ''));
  if (opt.perf) {
    await pose(page, { x: 9.8, y: 0, z: 5.6, facing: Math.PI, camYaw: Math.PI, pitch: -0.25, dist: 3.2 });
    await page.evaluate(() => { window.__player.state.yaw = Math.PI + 0.0; });
    const st = await frameStats(page, 4000);
    const png = await shot(page, 'creature_perf.png');
    // baseline: same view with every creature's meshes hidden (sims keep running in their workers)
    await page.evaluate(() => { window.__hideAll = true; const sc = window.__mp.ctx.scene; sc.traverse(o => { if (o.name === 'creature-body' || o.isInstancedMesh) o.layers.set(31); }); });
    const base = await frameStats(page, 4000);
    report({ test: 'perf', creatures: 4, withCreatures: st, creaturesHidden: base, png, errors: logs });
  } else {
    const tag = opt.tag ? '_' + opt.tag : '';
    const out = [];
    // foyer: front 3/4 view (camera in front of the creature looking back at it)
    await pose(page, { x: 9.8, y: 0, z: 6.4, facing: Math.PI * 0.85, camYaw: Math.PI * 0.85 + Math.PI - 0.5, pitch: -0.12, dist: 2.2 });
    out.push(await shot(page, `creature_foyer${tag}.png`));
    // lawn: run + jump seen side-on (droplets shed, stretch, landing squash + splash)
    await page.evaluate(() => { const P = window.__player; P.teleport(7.5, -0.31, 24.5, -Math.PI / 2); P.state.yaw = 0; P.state.pitch = -0.12; P.state.camWant = 3.6; let t = 0; P.state.autopilot = (dt) => { t += dt; return { mx: t < 1.1 ? 1 : 0, mz: 0, run: t < 1.1, jump: t > 0.55 && t < 0.6 }; }; });
    await sleep(500); out.push(await shot(page, `creature_run${tag}.png`));
    await sleep(380); out.push(await shot(page, `creature_jump${tag}.png`));
    await sleep(330); out.push(await shot(page, `creature_land${tag}.png`));
    await sleep(700); out.push(await shot(page, `creature_puddles${tag}.png`));
    await page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); });
    // test pool (the pool piece is a stub right now): a water body over the lawn, 1.3 m deep
    const hasPool = await page.evaluate(async () => {
      const { waterBodies, createWater } = await import('/src/water/index.js');
      if (!waterBodies.length) {
        const ctx = window.__mp.ctx; const root = new ctx.THREE.Group(); ctx.scene.add(root);
        createWater({ ...ctx, root }, { outline: [[6, 27], [15, 27], [15, 32], [6, 32]], surfaceY: 1.0, floorY: -0.31, color: 0x2fb7c9, name: 'testpool' });
        return 'test';
      }
      return waterBodies[0].name;
    });
    const wb = await page.evaluate(async () => { const { waterBodies } = await import('/src/water/index.js'); const w = waterBodies[0]; let cx = 0, cz = 0; for (const [x, z] of w.outline) { cx += x; cz += z; } cx /= w.outline.length; cz /= w.outline.length; return { cx, cz, y: w.heightAt(cx, cz), x0: Math.min(...w.outline.map(p => p[0])), z0: Math.min(...w.outline.map(p => p[1])) }; });
    // standing next to the pool
    const groundY = hasPool === 'test' ? -0.31 : wb.y + 0.1;
    await pose(page, { x: wb.cx, y: groundY + 0.05, z: wb.z0 - 1.0, facing: 0.3, camYaw: 0.3 + Math.PI - 0.6, pitch: -0.15, dist: 2.4, settle: 1800 });
    out.push(await shot(page, `creature_poolside${tag}.png`));
    // swimming: drop into the middle
    await pose(page, { x: wb.cx, y: wb.y + 0.6, z: wb.cz, facing: Math.PI, camYaw: 0.2, pitch: -0.3, dist: 2.6, settle: 3500 });
    const swim = await page.evaluate(() => ({ swimming: window.__player.state.swimming, y: window.__player.state.pos.y }));
    out.push(await shot(page, `creature_swim${tag}.png`));
    // climb out: swim to the edge + Space, then reform
    await page.evaluate(() => { const P = window.__player; P.state.yaw = Math.PI; let t = 0; P.state.autopilot = (dt) => { t += dt; return { mz: 1, jump: t > 0.2 && t < 0.25 }; }; });
    await sleep(1200);
    await page.evaluate(() => { window.__player.state.autopilot = null; });
    const after = await page.evaluate(() => ({ swimming: window.__player.state.swimming, y: window.__player.state.pos.y }));
    out.push(await shot(page, `creature_climbout${tag}.png`));
    const st = await frameStats(page, 2000);
    report({ test: 'look', pool: hasPool, swim, after, shots: out, frame: st, errors: logs });
  }
  if (logs.length) bad = true;
} else {
  // ---------------------------------------------------------------- two-player test
  const code = 'mptest-' + Math.random().toString(36).slice(2, 7);
  const t0 = Date.now();
  const A = await open('room=' + code); const B = await open('room=' + code);
  const online = await A.page.evaluate(() => window.__mp?.online);
  let connected = false;
  for (let i = 0; i < 90; i++) { const n = await B.page.evaluate(() => window.__mp.peers.size); if (n >= 1) { connected = true; break; } await sleep(1000); }
  const res = { test: 'multiplayer', room: code, online, connected, connectMs: Date.now() - t0 };
  if (!connected) {
    res.error = 'no peer connection within 90 s — Nostr relays unreachable or WebRTC blocked'; res.net = [...A.netlogs, ...B.netlogs].slice(0, 8);
    bad = true;
  } else {
    // A: put its creature in front of B's camera and run it around; B must see it move
    await A.page.evaluate(() => { const P = window.__player; P.teleport(9.8, 0, 7.6, 0); });
    await B.page.evaluate(() => { const P = window.__player; P.teleport(9.8, 0, 5.9, Math.PI); P.state.yaw = Math.PI; P.state.pitch = -0.15; });
    await sleep(1500);
    const seen0 = await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; return { n: window.__mp.peers.size, name: r.name, pos: r.pos.toArray() }; });
    await A.page.evaluate(() => { const P = window.__player; P.state.yaw = Math.PI / 2; let t = 0; P.state.autopilot = (dt) => { t += dt; return { mz: 1, run: t > 0.5 }; }; });
    await sleep(900);
    await A.page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); });
    await sleep(600);
    const a1 = await A.page.evaluate(() => window.__player.state.pos.toArray());
    const seen1 = await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; return { n: window.__mp.peers.size, pos: r.pos.toArray() }; });
    const moved = Math.hypot(seen1.pos[0] - seen0.pos[0], seen1.pos[2] - seen0.pos[2]);
    const err = Math.hypot(seen1.pos[0] - a1[0], seen1.pos[2] - a1[2]);
    // chat + door sync
    await A.page.keyboard.press('KeyT'); await A.page.keyboard.type('hello from A'); await A.page.keyboard.press('Enter');
    const door = await A.page.evaluate(() => { const d = window.__mp.ctx.doors?.[0]; if (!d) return null; d.target = d.target > 0.5 ? 0 : 1; return { id: d.o.id, t: d.target }; });
    await sleep(1200);
    const chatB = await B.page.evaluate(() => document.getElementById('mp-log')?.textContent || '');
    const doorB = door ? await B.page.evaluate((id) => window.__mp.ctx.doors.find(d => d.o.id === id)?.target, door.id) : null;
    Object.assign(res, { peersSeenByB: seen1.n, remoteName: seen0.name, remoteMovedM: +moved.toFixed(2), remoteVsTruthM: +err.toFixed(3), chatReceived: chatB.includes('hello from A'), doorSynced: door ? doorB === door.t : 'no doors' });
    // move A next to B's view for the screenshots
    await A.page.evaluate(() => { const P = window.__player; P.teleport(9.5, 0, 8.6, 0.4); P.state.yaw = 0.4 + Math.PI - 0.5; P.state.pitch = -0.1; });
    await B.page.evaluate(() => { const P = window.__player; P.state.yaw = Math.PI - 0.15; });
    await sleep(1500);
    res.pngA = await shot(A.page, 'mp_a.png'); res.pngB = await shot(B.page, 'mp_b.png');
    if (seen1.n !== 1 || moved < 1 || !res.chatReceived) bad = true;
  }
  res.errorsA = A.logs; res.errorsB = B.logs; if (A.logs.length || B.logs.length) bad = true;
  report(res);
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
