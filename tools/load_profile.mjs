#!/usr/bin/env node
// CPU profile of the page load (walk mode) -> top self-time functions + per-URL totals.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process'; import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') { const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } }); process.exit(r.status ?? 1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let slot = null; while (!slot) { for (let i = 0; i < 3 && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } } if (!slot) await new Promise(r => setTimeout(r, 1500)); }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' })[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-' + path.basename(slot)), { channel: 'chrome', headless: true, viewport: { width: 1200, height: 800 }, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?room=prof-${process.pid}&noprobes=1`);
await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000 });
const { profile } = await cdp.send('Profiler.stop');
const timing = await page.evaluate(() => window.__timing);
const byId = new Map(profile.nodes.map(n => [n.id, n])); const self = new Map();
const dt = profile.timeDeltas; const counts = new Map(); profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
const fn = new Map(), url = new Map();
for (const [id, us] of counts) { const n = byId.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${path.basename(cf.url || '')}:${cf.lineNumber + 1}`; fn.set(k, (fn.get(k) || 0) + us); const u = path.basename(cf.url || cf.functionName); url.set(u, (url.get(u) || 0) + us); }
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`);
console.log('timing', JSON.stringify(timing)); console.log('--- by file'); console.log(top(url, 18).join('\n')); console.log('--- by function'); console.log(top(fn, 30).join('\n'));
await ctx.close(); server.close(); process.exit(0);
