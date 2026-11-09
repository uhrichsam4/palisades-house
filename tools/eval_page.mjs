#!/usr/bin/env node
// Load walk mode headless and evaluate a JS file in the page: node tools/eval_page.mjs file.js [--q=extra]
//   [--shot=out.png] screenshot after the eval · [--vw=1280 --vh=800] viewport · [--mobile] touch phone context
//   [--solo] no ?room (menu=0, solo) · [--peer] a second page joins the same room first (2-player lobby)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process'; import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') { const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } }); process.exit(r.status ?? 1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(3).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let slot = null; while (!slot) { for (let i = 0; i < Number(process.env.SHOT_SLOTS || 2) && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } } if (!slot) await new Promise(r => setTimeout(r, 1500)); }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' })[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-' + path.basename(slot)), { channel: 'chrome', headless: true, viewport: { width: +(opt.vw || 1200), height: +(opt.vh || 800) }, ...(opt.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}), args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const url = `http://127.0.0.1:${server.address().port}/index.html?${opt.solo ? 'menu=0' : `room=ev-${process.pid}`}&quality=low${opt.q ? '&' + opt.q : ''}`;
if (opt.peer && !opt.solo) { const pe = await ctx.newPage(); await pe.goto(url); await pe.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000 }); }
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000 });
if (opt.probes) await page.waitForFunction(() => !!window.__probes, null, { timeout: 180000 });
const code = fs.readFileSync(process.argv[2], 'utf8');
const r = await page.evaluate(code);
if (opt.shot) await page.screenshot({ path: path.resolve(ROOT, opt.shot) });
console.log(JSON.stringify(r, null, 0)); if (errs.length) console.log('ERRORS', JSON.stringify([...new Set(errs)].slice(0, 8)));
await ctx.close(); server.close(); process.exit(0);
