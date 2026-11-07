#!/usr/bin/env node
// Render photo-matched views of the house in headless Chrome (real GPU) and build comparison images.
//   node tools/shot.mjs p04 p05            -> shots/p04.png, shots/p04_vs.jpg (photo | ours)
//   node tools/shot.mjs p04 --only=family,kitchen   (faster: only those pieces + shell)
//   node tools/shot.mjs --cam=x,y,z,lx,ly,lz,fov --name=test
//   node tools/shot.mjs --top=0            (plan cutaway of level 0)
//   node tools/shot.mjs p04 --blind=7      (also shots/p04_AB.jpg with seeded random A/B order; key in shots/p04_AB.json)
// Prints a JSON line per shot: {id, png, vs, errors}. Exit code 1 if any page reported errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

// Be gentle with the user's Mac: run at 'utility' QoS (inherited by Chrome; 'background' starves the GPU
// process until Chrome's watchdog drops the WebGL context and renders come out broken) ...
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ... and through a machine-wide queue: at most SHOT_SLOTS (default 1) headless Chromes render at once,
// however many agents call this tool.
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 1); let mySlot = null;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (let waited = 0; mySlot === null; waited++) {
  for (let i = 0; i < SLOTS && mySlot === null; i++) {
    const d = path.join(LOCKS, 'slot' + i);
    try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); mySlot = d; }
    catch { let pid = 0; try { pid = Number(fs.readFileSync(path.join(d, 'pid'), 'utf8')); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); }
  }
  if (mySlot === null) { if (waited === 0) console.error('[shot] waiting for a free render slot…'); await new Promise(r => setTimeout(r, 1500)); }
}
const release = () => { try { fs.rmSync(mySlot, { recursive: true, force: true }); } catch {} };
process.on('exit', release); process.on('SIGINT', () => process.exit(130)); process.on('SIGTERM', () => process.exit(143));
const PHOTOS = path.resolve(ROOT, '../house_reference_photos/1_Palisades_mansion_listing_photos');
const args = process.argv.slice(2); const opt = {}; const ids = [];
for (const a of args) { const m = a.match(/^--(\w+)(?:=(.*))?$/); if (m) opt[m[1]] = m[2] ?? '1'; else ids.push(a); }
const outDir = path.resolve(ROOT, opt.out || 'shots'); fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp', '.exr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;

// Persistent profile per slot: Chrome keeps its compiled-shader cache between runs (far less Metal compiling).
const browser = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-' + path.basename(mySlot)), { channel: 'chrome', headless: true, viewport: { width: 1080, height: 720 }, deviceScaleFactor: 1, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const jobs = [];
for (const id of ids) jobs.push({ id, q: `view=${id}` });
if (opt.cam) jobs.push({ id: opt.name || 'cam', q: `cam=${opt.cam}` });
if (opt.top !== undefined) jobs.push({ id: `top${opt.top}`, q: `top=${opt.top}` });
let bad = false;
for (const job of jobs) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  let q = job.q; if (opt.only) q += `&only=${opt.only}`; if (opt.noroof) q += '&noroof=1'; if (opt.nopost) q += '&nopost=1'; if (opt.pt) q += `&pt=${opt.pt}`;
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: Number(opt.timeout || 120000), polling: 250 }); }
  catch { logs.push('timeout waiting for __ready'); }
  const errs = await page.evaluate(() => window.__errors || []).catch(() => ['evaluate failed']);
  const png = path.join(outDir, `${job.id}.png`);
  await page.locator('#c').screenshot({ path: png });
  await page.close();
  const rec = { id: job.id, png: path.relative(ROOT, png), ms: Date.now() - t0, errors: [...errs, ...logs.filter(l => !/GPU stall|WebGL: INVALID|Automatic fallback/.test(l))].slice(0, 20) };
  const photo = path.join(PHOTOS, `${job.id}.jpg`);
  if (fs.existsSync(photo)) {
    const vs = path.join(outDir, `${job.id}_vs.jpg`);
    execFileSync('python3', ['-I', path.join(ROOT, 'tools/compose.py'), 'vs', photo, png, vs]);
    rec.vs = path.relative(ROOT, vs);
    if (opt.blind) {
      const ab = path.join(outDir, `${job.id}_AB.jpg`);
      const out = execFileSync('python3', ['-I', path.join(ROOT, 'tools/compose.py'), 'ab', photo, png, ab, String(opt.blind)]).toString().trim();
      fs.writeFileSync(path.join(outDir, `${job.id}_AB.json`), out); rec.ab = path.relative(ROOT, ab);
    }
  }
  if (rec.errors.length) bad = true;
  console.log(JSON.stringify(rec));
}
await browser.close(); server.close();
// keep the slot a few seconds so back-to-back renders from several agents can't peg the GPU
await new Promise(r => setTimeout(r, Number(process.env.SHOT_COOLDOWN_MS || 4000)));
process.exit(bad ? 1 : 0);
