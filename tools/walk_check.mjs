#!/usr/bin/env node
// Walk-mode smoke test: loads index.html like a visitor (all pieces), walks forward a few seconds,
// reports page errors + where the player ended up, saves shots/walk_check.png.
//   node tools/walk_check.mjs [--secs=4] [--room=test-xyz]
// Shares tools/shot.mjs' render queue + low priority so it never stacks Chromes on the user's Mac.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-slot0'), { channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 }, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?room=${opt.room || 'walkcheck-' + process.pid}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => errs.push('timeout'));
await page.waitForTimeout(1500);
const secs = Number(opt.secs || 4);
if (opt.goto) { const [x, y, z, yaw] = opt.goto.split(',').map(Number); await page.evaluate(([x, y, z, yaw]) => window.__player?.teleport(x, y, z, yaw), [x, y, z, yaw]); await page.waitForTimeout(500); }
await page.keyboard.down('KeyW'); await page.waitForTimeout(secs * 1000); await page.keyboard.up('KeyW'); await page.waitForTimeout(800);
const where = await page.evaluate(() => document.getElementById('where')?.textContent);
const player = await page.evaluate(() => { const s = window.__player?.state; return s ? { pos: s.pos.toArray().map(v => +v.toFixed(2)), inWater: s.inWater, swimming: s.swimming, grounded: s.grounded } : null; });
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
await page.screenshot({ path: path.join(ROOT, 'shots', 'walk_check.png') });
const uniq = [...new Set(errs)].slice(0, 12);
console.log(JSON.stringify({ where, fps, player, errors: uniq }));
await ctx.close(); server.close(); process.exit(uniq.length ? 1 : 0);
