#!/usr/bin/env node
// Title menu + lobby directory test (headless Chrome, one browser, several pages; needs internet: Nostr relays).
//   node tools/lobby_test.mjs            menu shot (full house) + public lobby create/browse/join/leave
//   --skip=menu                          skip the full-house menu screenshot
//   --only=foyer (default)               piece filter for the lobby pages
// Prints one JSON line; exit code 1 on failure.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

if (!process.env.TASKPOLICY_DONE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, TASKPOLICY_DONE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = {}; for (const a of process.argv.slice(2)) { const m = a.match(/^--(\w+)(?:=(.*))?$/); if (m) opt[m[1]] = m[2] ?? '1'; }
const only = opt.only || 'foyer';
const outDir = path.resolve(ROOT, 'shots'); fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.exr': 'application/octet-stream', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|\[lobbies\]/i;
async function open(q, w = 1280, h = 800) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.stack));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__menu, null, { timeout: 180000, polling: 250 });
  return { page, logs };
}
async function until(fn, ms, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const res = { test: 'lobby' }; let bad = false; const fail = (k, v) => { res[k] = v; bad = true; };

try {
  if (opt.skip !== 'menu') {
    const M = await open('', 1600, 900);
    await sleep(4000);
    const st = await M.page.evaluate(() => ({ mode: window.__menu.mode, menuShown: document.getElementById('menu').classList.contains('show'), cam: window.__dbg.camera.position.toArray().map(v => +v.toFixed(2)) }));
    await sleep(1000);
    const cam2 = await M.page.evaluate(() => window.__dbg.camera.position.toArray().map(v => +v.toFixed(2)));
    await M.page.screenshot({ path: path.join(outDir, 'menu.png') });
    res.menu = { ...st, cameraMoves: Math.hypot(cam2[0] - st.cam[0], cam2[2] - st.cam[2]) > 0.05, png: 'shots/menu.png', errors: M.logs };
    if (st.mode !== 'menu' || !st.menuShown || !res.menu.cameraMoves || M.logs.length) bad = true;
    await M.page.close();
  }
  const q = `only=${only}&noprobes=1`;
  const A = await open(q), B = await open(q);
  const lobbyName = 'Test ' + Math.random().toString(36).slice(2, 6);
  await A.page.evaluate((n) => window.__menu.create({ name: n, pub: true, max: 8 }), lobbyName);
  const code = await A.page.evaluate(() => window.__mp.room);
  res.code = code;
  // B: Browse list shows it
  await B.page.evaluate(() => document.querySelector('#menu [data-act="browse"]').click());
  const t0 = Date.now();
  const row = await until(() => B.page.evaluate((c) => { const b = document.querySelector(`#gm-list button[data-code="${c}"]`); if (!b) return null; const r = b.closest('.gm-row'); return { text: r.textContent, disabled: b.disabled }; }, code), 30000);
  res.listedInMs = row ? Date.now() - t0 : null; res.listedRow = row;
  if (!row || !row.text.includes(lobbyName) || !row.text.includes('1/8')) fail('listErr', 'lobby not listed with name and 1/8');
  // B joins via the row's Join button
  if (row) {
    await B.page.evaluate((c) => document.querySelector(`#gm-list button[data-code="${c}"]`).click(), code);
    const both = await until(async () => { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.members.size), B.page.evaluate(() => window.__mp.members.size)]); return a >= 1 && b >= 1 ? [a, b] : null; }, 90000, 1000);
    res.joined = both; if (!both) fail('joinErr', 'no peer connection within 90 s');
    res.bState = await B.page.evaluate(() => ({ mode: window.__menu.mode, room: window.__mp.room, lobby: window.__mp.lobby?.name, players: window.__mp.ui.players() }));
    // third page sees 2/8
    const C = await open(q);
    const two = await until(() => C.page.evaluate((c) => window.__menu.listings().find(e => e.code === c)?.n === 2, code), 25000);
    res.cSees2of8 = !!two; if (!two) bad = true;
    // B leaves -> back at menu, A gets "left", listing drops to 1
    await B.page.evaluate(() => window.__menu.leave());
    await sleep(300);
    res.bAfterLeave = await B.page.evaluate(() => ({ mode: window.__menu.mode, room: window.__mp.room, url: location.search, menuShown: document.getElementById('menu').classList.contains('show') }));
    const leftToast = await until(() => A.page.evaluate(() => [...document.querySelectorAll('.mp-toast')].some(t => t.textContent.includes('left')) || (window.__mp.members.size === 0 ? 'members0' : null)), 20000);
    res.aLeftToast = leftToast; if (leftToast !== true) bad = true;
    const one = await until(() => C.page.evaluate((c) => window.__menu.listings().find(e => e.code === c)?.n === 1, code), 25000);
    res.cSees1after = !!one; if (!one) bad = true;
    if (res.bAfterLeave.mode !== 'menu' || res.bAfterLeave.room) bad = true;
    res.errorsC = C.logs; if (C.logs.length) bad = true;
    await C.page.close();
    // --shots: in-game HUD (A in its lobby, B rejoins; speaker playing if YouTube is reachable). Errors after
    // this point are not counted (third-party YouTube iframe noise).
    if (opt.shots) {
      res.errorsA0 = [...A.logs]; res.errorsB0 = [...B.logs];
      await B.page.evaluate((c) => window.__menu.join(c), code);
      await until(() => A.page.evaluate(() => window.__mp.members.size >= 1), 60000, 1000);
      await A.page.evaluate(() => { const P = window.__player; P.teleport(9.4, 0.05, 8.6, Math.PI); P.state.pitch = -0.05; });
      await B.page.evaluate(() => { const P = window.__player; P.teleport(9.3, 0.05, 6.4, 0); });
      const sp = await A.page.evaluate(async () => { const s = window.__speaker; if (!s) return 'no speaker'; try { s.pickup?.(); await s.playUrl?.('https://www.youtube.com/watch?v=aqz-KE-bpKQ'); } catch (e) { return 'err ' + e.message; } return 'ok'; });
      await A.page.keyboard.press('KeyF');
      const sp2 = await until(() => A.page.evaluate(() => { const m = window.__speaker?.music; return m && m.playing && m.title ? m.title : null; }), 15000, 1000);
      res.speaker = { call: sp, title: sp2 };
      await sleep(1500);
      await A.page.screenshot({ path: path.join(outDir, 'hud.png') }); res.hudPng = 'shots/hud.png';
      await A.page.evaluate(() => window.__menu.leave()); await sleep(2500);
      await A.page.evaluate(async () => { const { settings } = await import('/src/net/settings.js'); settings.set({ theme: 'light' }); });
      await sleep(800); await A.page.screenshot({ path: path.join(outDir, 'menu_light.png') });
      await A.page.evaluate(async () => { const { settings } = await import('/src/net/settings.js'); settings.set({ theme: 'dark' }); });
      // loading screen: a fresh page, captured mid-load
      const L = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await L.goto(`http://127.0.0.1:${port}/index.html?only=foyer&noprobes=1`, { waitUntil: 'load' });
      await L.waitForFunction(() => /[1-9]/.test(document.getElementById('loadpct')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
      await sleep(300); await L.screenshot({ path: path.join(outDir, 'loading.png') }); await L.close();
      A.logs.length = 0; B.logs.length = 0; A.logs.push(...res.errorsA0); B.logs.push(...res.errorsB0); delete res.errorsA0; delete res.errorsB0;
    }
  }
  res.errorsA = A.logs; res.errorsB = B.logs; if (A.logs.length || B.logs.length) bad = true;
} catch (e) { fail('exception', String(e.stack || e)); }
console.log(JSON.stringify(res));
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
