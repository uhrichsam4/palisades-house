#!/usr/bin/env node
// Custom-avatar test (headless Chrome, real GPU). Run low priority:
//   taskpolicy -c utility node tools/avatar_test.mjs [--files=a.glb,b.fbx] [--panel]
// Opens avatar-lab.html (models from shots/avatar_models/), prints the rig mapping per model + errors,
// screenshots shots/avatar_lab.png (and shots/avatar_panel.png with --panel). Exit 1 on any error.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = {}; for (const a of process.argv.slice(2)) { const m = a.match(/^--(\w+)(?:=(.*))?$/); if (m) opt[m[1]] = m[2] ?? '1'; }
const outDir = path.resolve(ROOT, 'shots'); fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.fbx': 'application/octet-stream', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const IGNORE = /GPU stall|Automatic fallback|THREE\.Clock/i;
let bad = false;
async function run(q, png) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.stack));
  page.on('requestfailed', r => logs.push('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) logs.push(`${r.status()}: ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/avatar-lab.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__lab?.ready === true, null, { timeout: 120000, polling: 250 });
  await new Promise(r => setTimeout(r, opt.panel && q.includes('panel') ? 3000 : 800));
  const lab = await page.evaluate(() => window.__lab);
  await page.screenshot({ path: path.join(outDir, png) });
  await page.close();
  return { lab, logs, png: 'shots/' + png };
}
const r = await run(opt.files ? 'files=' + encodeURIComponent(opt.files) : '', 'avatar_lab.png');
for (const m of r.lab.models) console.log(JSON.stringify(m));
const errors = [...r.lab.errors, ...r.logs];
const notHumanoid = r.lab.models.filter(m => !m.humanoid).map(m => m.file);
console.log(JSON.stringify({ test: 'avatar_lab', png: r.png, check: r.lab.check, notHumanoid, errors }));
if (errors.length || notHumanoid.length) bad = true;
if (opt.panel) {
  const p = await run('panel=1', 'avatar_panel.png');
  console.log(JSON.stringify({ test: 'avatar_panel', png: p.png, errors: p.logs }));
  if (p.logs.length) bad = true;
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
