#!/usr/bin/env node
// Speaker two/three-player sync test over the REAL lobby (Trystero relays, mp.channel), one headless Chrome.
//   node tools/speaker_sync_test.mjs [--vid=aqz-KE-bpKQ]
// Pages are separate browser contexts (own identity, no BroadcastChannel crossover), no autoplay flag:
// each page gets one click first, like a real player who clicked to walk.
// A plays a YouTube video -> B (15 m away behind walls) plays within 1 s of A, unmuted, volume > 0 in HOUSE
// range and ~0 in ROOM range at the same spot. C joins >= 10 s into the song and plays within 1 s of A.
// A pauses -> B, C pause. A stops -> all stop. A plays again and leaves the lobby -> A stops, B keeps going.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const VID = opt.vid || 'aqz-KE-bpKQ'; // Big Buck Bunny (embeddable)
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed|youtube|googlevideo|doubleclick|ytimg|postMessage|\[lobbies\]/i;
const code = 'spks' + Math.random().toString(36).slice(2, 6);
async function open(name) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}&only=kitchen,family&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__speaker, null, { timeout: 180000, polling: 250 });
  await page.mouse.click(550, 350); await sleep(200); // the user gesture every real player has made
  return { name, page, logs };
}
const yt = (P) => P.page.evaluate(() => { const s = window.__speaker; return { yt: s.yt, music: (({ vid, playing, range, by, blocked, error, expected }) => ({ vid, playing, range, by, blocked, error, expected: +expected.toFixed(2) }))(s.music), mini: document.getElementById('spk-drawer').classList.contains('on'), open: document.getElementById('spk-drawer').classList.contains('open'), room: window.__mp.room }; });
const r3 = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);
async function pair(X, Y) { const [x, y] = await Promise.all([yt(X), yt(Y)]); return { [X.name]: x, [Y.name]: y, dt: x.yt && y.yt ? r3(Math.abs(x.yt.time - y.yt.time)) : null }; }
const res = { test: 'speaker_sync', room: code, vid: VID }; const checks = {}; let bad = false;
try {
  const A = await open('A'), B = await open('B');
  const conn = await until(async () => { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.members.size), B.page.evaluate(() => window.__mp.members.size)]); return a >= 1 && b >= 1; }, 90000, 1000);
  res.connected = !!conn; if (!conn) throw new Error('A and B did not connect over the relays within 90 s');
  res.channel = await A.page.evaluate(() => !window.__speaker.shim);
  // A beside the speaker, B in the garage ~14 m away behind two walls (the living room is only one wall away: ROOM gives ~11%)
  await A.page.evaluate(() => { const s = window.__speaker.pos; window.__player.teleport(s[0] + 1.0, 0, s[2], Math.PI / 2); });
  await B.page.evaluate(() => window.__player.teleport(17.0, 0, 3.4, 0));
  // A plays
  await A.page.evaluate((v) => window.__speaker.playUrl('https://www.youtube.com/watch?v=' + v), VID);
  const aPlay = await until(async () => (await yt(A)).yt?.state === 1, 40000);
  const bPlay = await until(async () => (await yt(B)).yt?.state === 1, 40000);
  res.playing = { A: !!aPlay, B: !!bPlay };
  await sleep(3500); // first drift check + volume smoothing
  const p1 = await pair(A, B); res.ab = p1;
  res.bGain = await B.page.evaluate(() => { const v = window.__speaker.volume; return { gain: r(v.gain), dist: r(v.dist), walls: v.walls, range: v.range, cur: r(v.cur) }; function r(x) { return +(+x).toFixed(3); } });
  checks.bPlaysInSync = p1.B.yt?.state === 1 && p1.dt !== null && p1.dt <= 1.0;
  checks.bUnmuted = p1.B.yt?.muted === false;
  checks.bHouseAudible = (p1.B.yt?.volume ?? 0) > 0 && p1.B.music.range === 'house';
  // drawer collapsed on B for 20 s: playback must keep going (iframe translated offscreen, not hidden)
  const samples = [];
  for (let i = 0; i < 10; i++) { const x = await yt(B); samples.push({ s: x.yt?.state, t: r3(x.yt?.time), open: x.open }); await sleep(2000); }
  res.bCollapsed20s = samples;
  checks.collapsedKeepsPlaying = samples.every(x => x.s === 1 && !x.open) && samples[samples.length - 1].t - samples[0].t > 15;
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'speaker_drawer_closed.png') });
  await B.page.evaluate(() => document.exitPointerLock?.()); await sleep(300); // a real player presses Esc to get the mouse back
  await B.page.hover('#spk-tab'); await sleep(500);
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'speaker_drawer_hover.png') });
  await B.page.click('#spk-tab'); await sleep(900);
  const ov = await B.page.evaluate(() => { const r = (el) => el && el.getBoundingClientRect(); const d = r(document.getElementById('spk-panel')), m = r(document.getElementById('mp')); const hit = (a, b) => !!(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top); const iframe = r(document.querySelector('#spk-drawer iframe')); return { drawer: d && [d.left, d.top, d.right, d.bottom].map(Math.round), mp: m && [m.left, m.top, m.right, m.bottom].map(Math.round), overlapsMp: hit(d, m), iframe: iframe && [iframe.width, iframe.height], open: document.getElementById('spk-drawer').classList.contains('open') }; });
  res.drawerOpen = ov; checks.drawerClearsHud = ov.open && !ov.overlapsMp && ov.iframe?.[0] >= 200;
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'speaker_drawer_open.png') });
  await B.page.keyboard.press('Escape'); await sleep(700);
  res.drawerAfterEsc = await B.page.evaluate(() => document.getElementById('spk-drawer').classList.contains('open'));
  checks.escCloses = res.drawerAfterEsc === false;
  // ROOM range at the same spot
  await A.page.evaluate(() => window.__speaker.setRange('room'));
  await sleep(2500);
  const p2 = await yt(B); res.bRoom = { volume: p2.yt?.volume, range: p2.music.range };
  checks.bRoomNearSilent = p2.music.range === 'room' && (p2.yt?.volume ?? 99) <= 5;
  await A.page.evaluate(() => window.__speaker.setRange('house'));
  await sleep(1500);
  res.bHouseAgain = (await yt(B)).yt?.volume;
  // C joins >= 10 s into the song
  await until(async () => ((await yt(A)).yt?.time || 0) >= 10, 30000);
  const C = await open('C');
  await C.page.evaluate(() => window.__player.teleport(20.0, 0, 13.0, 0));
  const cConn = await until(() => C.page.evaluate(() => window.__mp.members.size >= 2), 90000, 1000);
  const cPlay = await until(async () => (await yt(C)).yt?.state === 1, 45000);
  await sleep(3000);
  const p3 = await pair(A, C); res.ac = { joinedAtA: r3(p3.A.yt?.time), ...p3, connected: !!cConn, played: !!cPlay };
  checks.cJoinsInSync = p3.C.yt?.state === 1 && p3.dt !== null && p3.dt <= 1.0 && p3.C.yt?.muted === false && (p3.A.yt?.time || 0) >= 10;
  // pause
  await A.page.evaluate(() => window.__speaker.togglePlay()); await sleep(3500);
  const [pa, pb, pc] = await Promise.all([yt(A), yt(B), yt(C)]);
  res.paused = { A: pa.yt?.state, B: pb.yt?.state, C: pc.yt?.state, tA: r3(pa.yt?.time), tB: r3(pb.yt?.time), tC: r3(pc.yt?.time) };
  checks.pause = [pa, pb, pc].every(x => x.yt?.state === 2 && x.music.playing === false);
  // resume, then stop
  await A.page.evaluate(() => window.__speaker.togglePlay()); await sleep(3000);
  res.resumed = (await Promise.all([yt(A), yt(B), yt(C)])).map(x => x.yt?.state);
  await A.page.evaluate(() => window.__speaker.stop()); await sleep(3000);
  const st = await Promise.all([yt(A), yt(B), yt(C)]);
  res.stopped = st.map(x => ({ state: x.yt?.state, vid: x.music.vid, mini: x.mini }));
  checks.stop = st.every(x => x.music.vid === null && x.yt?.state !== 1 && !x.mini);
  // play again, then A leaves the lobby
  await A.page.evaluate((v) => window.__speaker.playUrl('https://youtu.be/' + v), VID);
  await until(async () => (await yt(B)).yt?.state === 1 && (await yt(A)).yt?.state === 1, 30000);
  await C.page.close();
  await A.page.evaluate(() => (window.__menu?.leave ? window.__menu.leave() : window.__mp.leave()));
  await sleep(4000);
  const [la, lb] = await Promise.all([yt(A), yt(B)]);
  res.afterLeave = { A: { room: la.room, state: la.yt?.state, vid: la.music.vid, mini: la.mini }, B: { state: lb.yt?.state, vid: lb.music.vid, t: r3(lb.yt?.time) } };
  checks.leave = !la.room && la.music.vid === null && la.yt?.state !== 1 && !la.mini && lb.yt?.state === 1;
  await B.page.screenshot({ path: path.join(ROOT, 'shots', 'speaker_sync.png') }); res.png = 'shots/speaker_sync.png';
  res.errors = { A: A.logs, B: B.logs, C: C.logs };
  checks.noErrors = !A.logs.length && !B.logs.length && !C.logs.length;
} catch (e) { res.error = e.stack || e.message; bad = true; }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
