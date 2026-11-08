#!/usr/bin/env node
// Custom-avatar test (headless Chrome, real GPU). Run low priority:
//   taskpolicy -c utility node tools/avatar_test.mjs [--files=a.glb,b.fbx] [--panel]
// Opens avatar-lab.html (models from shots/avatar_models/), prints the rig mapping per model + errors,
// screenshots every row: shots/avatar_lab/<row>_states.png (idle/walk/run/jump/fall/swim/tread/sit/crouch/wave)
// and shots/avatar_lab/<row>_walk.png (8-frame walk cycle, side view), plus shots/avatar_panel.png with --panel.
// Ground check: lowest skinned vertex of idle/walk/run/crouch/wave/strip cells must be within ±6 cm of the floor.
// Exit 1 on any error.
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
  const page = await browser.newPage({ viewport: q.includes('panel') ? { width: 1600, height: 1100 } : { width: 2400, height: 640 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.stack));
  page.on('requestfailed', r => logs.push('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) logs.push(`${r.status()}: ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/avatar-lab.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__lab?.ready === true, null, { timeout: 120000, polling: 250 });
  await new Promise(r => setTimeout(r, opt.panel && q.includes('panel') ? 3000 : 800));
  const lab = await page.evaluate(() => { const { view, ...rest } = window.__lab; return JSON.parse(JSON.stringify(rest)); });
  const pngs = [];
  if (lab.rows) {
    const dir = path.join(outDir, 'avatar_lab'); fs.mkdirSync(dir, { recursive: true });
    const names = ['mannequin', ...lab.models.filter(m => !m.error).map(m => m.file.replace(/\.\w+$/, ''))];
    for (let r = 0; r < lab.rows; r++) for (const mode of ['states', 'strip']) {
      await page.evaluate(([r, mode]) => window.__lab.view(r, mode), [r, mode]); await new Promise(res => setTimeout(res, 150));
      const f = path.join(dir, `${names[r].replace(/[^\w-]+/g, '_')}_${mode === 'strip' ? 'walk' : 'states'}.png`); await page.screenshot({ path: f }); pngs.push(path.relative(ROOT, f));
    }
  } else { await page.screenshot({ path: path.join(outDir, png) }); pngs.push('shots/' + png); }
  await page.close();
  return { lab, logs, png: pngs };
}
const r = await run(opt.files ? 'files=' + encodeURIComponent(opt.files) : '', 'avatar_lab.png');
for (const m of r.lab.models) console.log(JSON.stringify(m));
const errors = [...r.lab.errors, ...r.logs];
const notHumanoid = r.lab.models.filter(m => !m.humanoid).map(m => m.file);
const offGround = (r.lab.check || []).filter(c => c.state !== 'sit' && Math.abs(c.minY) > 0.06);
console.log(JSON.stringify({ test: 'avatar_lab', png: r.png, offGround, notHumanoid, errors }));
if (errors.length || notHumanoid.length || offGround.length) bad = true;
if (opt.panel) {
  const p = await run('panel=1', 'avatar_panel.png');
  console.log(JSON.stringify({ test: 'avatar_panel', png: p.png, errors: p.logs }));
  if (p.logs.length) bad = true;
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
