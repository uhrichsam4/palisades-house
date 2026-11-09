#!/usr/bin/env node
// Slick-back emote (H) check: headless Chrome, ONE browser, utility QoS, shared render-slot locks.
//   node tools/emote_test.mjs [--chars=mannequin,suit,meshy2] [--noremote]
// Two players in one room (A performs, B watches). For each character on A: press H, screenshot A's third-person
// view at 3 points (brow, crown, back of head), record the IK reach error (palm on the scalp = 0) and the scalp
// scan; then B's view of A mid-emote (remote). Also checks H again / moving cancels.
// -> shots/emote/<char>_{1,2,3}.jpg, <char>_sheet.jpg, remote_<char>.jpg. Exit 1 on failed checks / errors.
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext|youtube|googlevideo|doubleclick|ytimg|postMessage|\[lobbies\]/i;
const dir = path.join(ROOT, 'shots', 'emote'); fs.mkdirSync(dir, { recursive: true });
const CHARS = (opt.chars || 'mannequin,ped1,meshy2').split(',');
const code = 'emot' + Math.random().toString(36).slice(2, 7);
const checks = {}; const errors = {};
async function open(name) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  const logs = []; errors[name] = logs;
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}&only=living,foyer&noprobes=1&tod=12:30&weather=clear`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__emotes, null, { timeout: 180000, polling: 250 });
  await page.mouse.click(550, 380); await sleep(300);
  return { name, page, logs };
}
// living room, facing +x (toward the foyer); camera in front-right three-quarter
const SPOT = [4.4, 0.02, 10.3], FACE = -Math.PI / 2;
const place = (P) => P.evaluate(({ SPOT, FACE }) => { const Pl = window.__player, s = Pl.state; Pl.teleport(SPOT[0], SPOT[1], SPOT[2], FACE); s.facing = FACE; s.thirdPerson = true; s.camWant = 1.5; s.yaw = FACE + Math.PI / 2 + 0.45; s.pitch = 0.02; s.keys.clear(); }, { SPOT, FACE });
const anim = (P) => P.evaluate(() => { const a = window.__player.creature.animator; const er = a?.rig?.er; return { slickT: a ? +a.slickT.toFixed(2) : null, playing: !!a?.slick, reachErr: er?.reachErr !== undefined ? +er.reachErr.toFixed(4) : null, scan: er?.geom ? { head: er.geom.headPts, hand: er.geom.handPts, ms: er.geom.ms, palm: er.geom.palm.toArray().map(v => +v.toFixed(3)) } : null }; });
const res = { test: 'emote', room: code, chars: [] };
try {
  const A = await open('A'); const B = opt.noremote ? null : await open('B');
  if (B) { const conn = await until(async () => (await A.page.evaluate(() => window.__mp.peers.size)) >= 1 && (await B.page.evaluate(() => window.__mp.peers.size)) >= 1, 90000, 1000); checks.connected = !!conn; }
  for (const ch of CHARS) {
    if (ch !== 'mannequin') {
      await A.page.evaluate(async (id) => {
        const L = await import('/src/avatars/library.js'); const M = await import('/src/avatars/index.js');
        const ent = L.libraryEntry(id); const desc = { k: 'b', id, ht: ent.height, fl: false };
        M.store.setMine(desc); await window.__mp.avatars.select(desc);
      }, ch);
      await until(() => A.page.evaluate(() => !!window.__player.creature.rigged), 30000);
      if (B) await until(() => B.page.evaluate((id) => { const r = [...window.__mp.peers.values()][0]; return r?._avKey?.startsWith('b:' + id) && r._custom; }, ch), 40000, 500);
    }
    await place(A.page); await sleep(1500);
    if (B) { await B.page.evaluate(({ SPOT }) => { const Pl = window.__player, s = Pl.state; const x = SPOT[0] - 2.2, z = SPOT[2] - 1.1; Pl.teleport(x, SPOT[1], z); s.thirdPerson = false; s.yaw = Math.atan2(-(SPOT[0] - x), -(SPOT[2] - z)); s.pitch = 0.0; }, { SPOT }); }
    await sleep(800);
    await A.page.keyboard.press('KeyH');
    const r = { char: ch, frames: [] }; const pngs = [];
    for (const [i, at] of [[1, 1.15], [2, 1.9], [3, 2.75]].map((x) => x)) {
      // pause both walk loops at the moment (the canvas keeps the last frame), screenshot, resume
      await A.page.evaluate((at) => new Promise(res => { const tick = () => { if (window.__player.creature.animator.slickT >= at) { window.__dbg.paused = true; res(); } else requestAnimationFrame(tick); }; tick(); }), at);
      if (B) await B.page.evaluate(() => { window.__dbg.paused = true; });
      // free camera on the character's right, slightly in front, framed on the head (like the reference clip)
      const f = path.join(dir, `${ch}_${i}.jpg`);
      await A.page.evaluate(async () => {
        const THREE = await import('three'); const d = window.__dbg, c = window.__player.creature; const er = c.animator.rig.er;
        c.root.updateMatrixWorld(true); const h = er.bones.head.getWorldPosition(new THREE.Vector3());
        const m = c.root.matrixWorld.elements; const right = new THREE.Vector3(m[0], m[1], m[2]).normalize(), fwd = new THREE.Vector3(-m[8], -m[9], -m[10]).normalize();
        d.camera.position.copy(h).addScaledVector(right, 0.95).addScaledVector(fwd, 0.75).add(new THREE.Vector3(0, 0.38, 0));
        d.camera.lookAt(h.x, h.y - 0.05, h.z); d.camera.updateMatrixWorld(); d.render();
      });
      await A.page.screenshot({ path: f, type: 'jpeg', quality: 85 }); pngs.push(f);
      r.frames.push({ at, ...(await anim(A.page)), png: path.relative(ROOT, f) });
      if (B && i === 2) { const fb = path.join(dir, `remote_${ch}.jpg`); await B.page.screenshot({ path: fb, type: 'jpeg', quality: 85 }); r.remote = { png: path.relative(ROOT, fb), ...(await B.page.evaluate(() => { const rr = [...window.__mp.peers.values()][0]; const a = rr?.creature?.animator; return { slickT: a ? +a.slickT.toFixed(2) : null, playing: !!a?.slick, reachErr: a?.rig?.er?.reachErr }; })) }; }
      await A.page.evaluate(() => { window.__dbg.paused = false; }); if (B) await B.page.evaluate(() => { window.__dbg.paused = false; });
    }
    await sleep(1600); r.after = await anim(A.page);
    // H again cancels; walking cancels
    await A.page.keyboard.press('KeyH'); await sleep(900); await A.page.keyboard.press('KeyH'); await sleep(200);
    const c1 = await anim(A.page); r.cancelH = !c1.playing;
    await A.page.keyboard.press('KeyH'); await sleep(700);
    await A.page.evaluate(() => { window.__player.state.autopilot = () => ({ mz: 1 }); }); await sleep(600);
    r.cancelMove = !(await anim(A.page)).playing;
    await A.page.evaluate(() => { window.__player.state.autopilot = null; window.__player.state.keys.clear(); }); await sleep(600);
    res.chars.push(r); console.log(JSON.stringify(r));
    // contact sheet (crop around the character)
    try { const { execFileSync } = await import('node:child_process'); execFileSync('python3', ['-c', `
from PIL import Image
import sys
ims=[Image.open(f) for f in sys.argv[2:]]
w,h=ims[0].size; W=Image.new('RGB',(3*440,520))
for i,im in enumerate(ims): W.paste(im.crop((w//2-220,h//2-300,w//2+220,h//2+220)),(i*440,0))
W.save(sys.argv[1],quality=85)`, path.join(dir, `${ch}_sheet.jpg`), ...pngs]); } catch {}
  }
  const ok = (r) => r.frames.every(f => f.playing) && r.frames.filter(f => f.at > 1.1 && f.at < 3).every(f => f.reachErr !== null && f.reachErr < 0.01) && r.cancelH && r.cancelMove && !r.after.playing;
  for (const r of res.chars) checks['plays_' + r.char] = ok(r);
  if (B) checks.remoteSees = res.chars.every(r => r.remote?.playing);
} catch (e) { checks.threw = false; res.error = e.stack || e.message; }
const errs = Object.fromEntries(Object.entries(errors).filter(([, v]) => v.length)); checks.noErrors = !Object.keys(errs).length;
console.log(JSON.stringify({ test: 'emote', checks, errors: errs, error: res.error }));
await browser.close(); server.close();
process.exit(Object.values(checks).some(v => !v) ? 1 : 0);
