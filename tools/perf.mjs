#!/usr/bin/env node
// Performance probe. Loads walk mode like a visitor on a laptop screen, then at a few spots (4 headings each)
// times frames one by one (render + GPU sync) and counts draw calls, triangles, lights, shader programs.
//   node tools/perf.mjs                      -> JSON summary + shots/perf.json
//   node tools/perf.mjs --w=1512 --h=945 --dpr=2 --frames=24 --q=quality=low --label=before
// Shares tools/shot.mjs' render queue and runs at utility QoS so it never stacks Chromes on the Mac.
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
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let slot = null;
while (!slot) {
  for (let i = 0; i < 3 && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp' };
let bytes = 0, files = 0; const byExt = {};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const sz = fs.statSync(f).size; bytes += sz; files++; const ext = path.extname(f) || 'none'; byExt[ext] = (byExt[ext] || 0) + sz;
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const W = +(opt.w || 1512), H = +(opt.h || 945), DPR = +(opt.dpr || 2);
const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-' + path.basename(slot)), { channel: 'chrome', headless: true, viewport: { width: W, height: H }, deviceScaleFactor: DPR, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?room=perf-${process.pid}${opt.q ? '&' + opt.q : ''}`);
await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000 }).catch(() => errs.push('timeout ready'));
const readyMs = Date.now() - t0;
await page.waitForFunction(() => !!window.__probes, null, { timeout: 180000 }).catch(() => errs.push('timeout probes'));
const probesMs = Date.now() - t0; const loadBytes = bytes;
const timing = await page.evaluate(() => window.__timing || null);
// fixed graphics for comparable numbers (the auto controller would otherwise move resolution mid-measurement)
await page.evaluate(([tier, scale]) => { const q = window.__quality; if (!q) return; q.set(tier); q.setScale(scale); }, [opt.tier || 'high', +(opt.scale || 0.75)]);

// spots: [x, z, level, label]; four headings each
const SPOTS = [[9.7, 9.0, 0, 'foyer'], [5.5, 17.0, 0, 'family'], [18.4, 16.0, 0, 'kitchen'], [12.0, 14.2, 1, 'primary'], [18.0, 24.0, 0, 'pool deck']];
const FR = +(opt.frames || 24);
const out = await page.evaluate(async ({ SPOTS, FR }) => {
  const d = window.__dbg, R = d.renderer, gl = R.getContext(), px = new Uint8Array(4); const P = await import('/src/plan.js');
  const sync = () => { R.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const time = (fn, n) => { sync(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); sync(); return (performance.now() - t) / n; };
  const res = [];
  for (const [x, z, lv, label] of SPOTS) {
    d.paused = false; window.__player.teleport(x, P.LEVELS[lv].floor + 0.05, z, 0);
    for (let i = 0; i < 40; i++) await raf(); // let doors/physics/updates settle and shaders compile
    d.paused = true;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      d.camera.rotation.set(0, yaw, 0, 'YXZ'); d.camera.updateMatrixWorld();
      for (let i = 0; i < 3; i++) d.render(); // warm (compile anything new)
      const full = time(() => d.render(), FR);
      R.info.autoReset = false; R.info.reset(); d.render(); const calls = R.info.render.calls, tris = R.info.render.triangles;
      R.info.reset(); const au = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false; R.render(d.scene, d.camera); const sceneCalls = R.info.render.calls; R.info.autoReset = true;
      const sceneOnly = time(() => R.render(d.scene, d.camera), FR); // main pass only: no shadows, no post
      R.shadowMap.autoUpdate = au; R.shadowMap.needsUpdate = true;
      const withShadow = time(() => { R.shadowMap.needsUpdate = true; R.render(d.scene, d.camera); }, FR);
      res.push({ label, yaw: Math.round(yaw * 57.3), full: +full.toFixed(2), sceneOnly: +sceneOnly.toFixed(2), shadow: +(withShadow - sceneOnly).toFixed(2), post: +(full - withShadow).toFixed(2), calls, sceneCalls, tris });
    }
  }
  d.paused = false;
  const lights = {}; let meshes = 0, visMeshes = 0, casters = 0; d.scene.traverse(o => { if (o.isLight) lights[o.type] = (lights[o.type] || 0) + (o.visible ? 1 : 0); if (o.isMesh) { meshes++; if (o.visible) visMeshes++; if (o.castShadow) casters++; } });
  const m = R.info.memory;
  return { res, lights, meshes, visMeshes, casters, programs: R.info.programs.length, textures: m.textures, geometries: m.geometries, pixelRatio: R.getPixelRatio(), canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight], probes: window.__probes };
}, { SPOTS, FR });
const avg = (k) => +(out.res.reduce((a, r) => a + r[k], 0) / out.res.length).toFixed(2);
const worst = out.res.reduce((a, r) => (r.full > a.full ? r : a), out.res[0]);
const summary = { label: opt.label || '', readyMs, probesMs, timing, tier: opt.tier || 'high', loadMB: +(loadBytes / 1e6).toFixed(1), files, byExtMB: Object.fromEntries(Object.entries(byExt).map(([k, v]) => [k, +(v / 1e6).toFixed(1)])),
  avgFrameMs: avg('full'), worstFrameMs: worst.full, worstAt: worst.label + '@' + worst.yaw, avgSceneMs: avg('sceneOnly'), avgShadowMs: avg('shadow'), avgPostMs: avg('post'), avgCalls: Math.round(avg('calls')), avgSceneCalls: Math.round(avg('sceneCalls')), avgTris: Math.round(avg('tris')),
  ...Object.fromEntries(Object.entries(out).filter(([k]) => k !== 'res')), errors: [...new Set(errs)].slice(0, 8) };
fs.writeFileSync(path.join(ROOT, 'shots', `perf${opt.label ? '_' + opt.label : ''}.json`), JSON.stringify({ summary, spots: out.res }, null, 1));
console.log(JSON.stringify(summary));
if (opt.verbose) for (const r of out.res) console.log(JSON.stringify(r));
await page.screenshot({ path: path.join(ROOT, 'shots', `perf${opt.label ? '_' + opt.label : ''}.png`) });
await ctx.close(); server.close(); process.exit(0);
