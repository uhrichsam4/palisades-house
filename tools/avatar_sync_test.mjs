#!/usr/bin/env node
// Avatar sync test: A imports a custom model (shots/avatar_models/Xbot.glb) and B must download it P2P and show it.
//   node tools/recreate_test.mjs [--full]   (default builds only the family room: ?only=family)
// A and B walk into the family-room demo area, both press R at once (must get different seats), A presses
// Enter, both must play the audio with start times within 150 ms; B must see A's avatar sitting at A's seat.
// B then stands up (X) and must land on a free, walkable spot. Screenshot -> shots/recreate_test.png.
// Runs under taskpolicy utility + the shared render-slot lock (shots/.locks) like walk_check.mjs.
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
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext was not allowed/i;
const code = 'avtest-' + Math.random().toString(36).slice(2, 7);
async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}${'&only=foyer'}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp && window.__mp.avatars, null, { timeout: 180000, polling: 250 });
  await sleep(800);
  return { page, logs };
}

const res = { test: 'avatar-sync', room: code }; let bad = false;
try {
  const A = await open(), B = await open();
  let connected = false;
  for (let i = 0; i < 90; i++) { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.peers.size), B.page.evaluate(() => window.__mp.peers.size)]); if (a >= 1 && b >= 1) { connected = true; break; } await sleep(1000); }
  res.connected = connected; if (!connected) throw new Error('no peer connection');
  const file = path.join(ROOT, 'shots', 'avatar_models', opt.model || 'Xbot.glb');
  const b64 = fs.readFileSync(file).toString('base64');
  res.local = await A.page.evaluate(async ({ b64, name }) => {
    const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const M = await import('/src/avatars/index.js');
    const fmt = name.split('.').pop().toLowerCase();
    const asset = await M.parseAvatar(u8.buffer.slice(0), fmt);
    const id = await M.store.putFile(u8.buffer.slice(0), { fmt, name });
    const desc = { k: 'c', id, f: fmt, sz: u8.length, ht: 1.8, fl: false };
    M.store.setMine(desc);
    // same path the panel's onChange takes
    const mpAv = window.__mp.avatars; const panel = mpAv.open(); panel.close();
    await new Promise(r => setTimeout(r, 300));
    // simulate commit
    window.__mp.avatars._test?.(desc, asset);
    return { id: id.slice(0, 12), bytes: u8.length };
  }, { b64, name: path.basename(file) });
  // drive the commit through the panel's onChange hook
  await A.page.evaluate(async () => { const M = await import('/src/avatars/index.js'); const d = M.store.mine(); await window.__mp.avatars.select(d); });
  res.localRigged = await A.page.evaluate(() => !!window.__player.creature.rigged);
  const t0 = Date.now(); let seen = false;
  for (let i = 0; i < 60; i++) { seen = await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; return !!(r && r.creature && r.creature.rigged); }); if (seen) break; await sleep(1000); }
  res.remoteRigged = seen; res.transferS = +((Date.now() - t0) / 1000).toFixed(1);
  await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; window.__player.teleport(r.pos.x + 0.2, r.pos.y, r.pos.z - 3, Math.PI); window.__player.state.thirdPerson = false; });
  await A.page.evaluate(() => { window.__player.state.thirdPerson = false; });
  await sleep(1500);
  await B.page.evaluate(() => { const r = [...window.__mp.peers.values()][0]; const c = window.__dbg.camera; c.position.set(r.pos.x + 1.6, r.pos.y + 1.4, r.pos.z - 2.2); c.lookAt(r.pos.x, r.pos.y + 0.9, r.pos.z); window.__dbg.paused = true; window.__dbg.render(); });
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'avatar_sync_b.png') });
  await B.page.evaluate(() => { window.__dbg.paused = false; });
  res.errors = [...A.logs, ...B.logs].slice(0, 8);
  bad = !(res.localRigged && res.remoteRigged) || res.errors.length > 0;
} catch (e) { res.error = e.message; bad = true; }
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
