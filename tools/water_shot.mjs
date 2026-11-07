#!/usr/bin/env node
// Screenshot the standalone water test page (water-test.html) in headless Chrome (real GPU).
//   node tools/water_shot.mjs --cam=x,y,z,lx,ly,lz,fov --name=deck      -> shots/water/deck.png
//   node tools/water_shot.mjs --cam=... --name=a --cam2=... --name2=b   (several shots in one run)
//   node tools/water_shot.mjs --perf                                    (prints frame timings with/without water)
//   flags: --nopost
// Prints a JSON line per shot: {id, png, ms, errors[, perf]}. Exit code 1 if any page reported errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = {}; for (const a of process.argv.slice(2)) { const m = a.match(/^--(\w+)(?:=(.*))?$/); if (m) opt[m[1]] = m[2] ?? '1'; }
const outDir = path.resolve(ROOT, opt.out || 'shots/water'); fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const jobs = [];
for (const k of Object.keys(opt).filter(k => /^cam\d*$/.test(k))) { const n = k.slice(3); jobs.push({ id: opt['name' + n] || 'cam' + n, q: `shot=1&cam=${opt[k]}` }); }
if (opt.perf) jobs.push({ id: 'perf', q: 'perf=1' + (opt.cam ? `&cam=${opt.cam}` : ''), perf: true });
if (!jobs.length) jobs.push({ id: 'default', q: 'shot=1' });
let bad = false;
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 720 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  let q = job.q; if (opt.nopost) q += '&nopost=1';
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/water-test.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: Number(opt.timeout || 120000), polling: 250 }); }
  catch { logs.push('timeout waiting for __ready'); }
  const errs = await page.evaluate(() => window.__errors || []).catch(() => ['evaluate failed']);
  const rec = { id: job.id, ms: Date.now() - t0 };
  if (job.perf) rec.perf = await page.evaluate(() => window.__perf).catch(() => null);
  else { const png = path.join(outDir, `${job.id}.png`); await page.locator('#c').screenshot({ path: png }); rec.png = path.relative(ROOT, png); }
  await page.close();
  rec.errors = [...errs, ...logs.filter(l => !/GPU stall|WebGL: INVALID|Automatic fallback/.test(l))].slice(0, 20);
  if (rec.errors.length) bad = true;
  console.log(JSON.stringify(rec));
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
