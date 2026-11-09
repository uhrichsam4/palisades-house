#!/usr/bin/env node
// Frame-time A/B profiler: the smoke_test spots + window.__prof per main-loop section, GPU timer, draw calls.
//   node tools/perf_ab.mjs [root=this repo] [--secs=3] [--spots=pool,family] [--q=extra&query]
// Prints one JSON line: { root, video, spots: { pool: { avgMs, p50, gpuMs, calls, tris, rows: [[section, ms/frame]...] } } }
// ONE headless Chrome (shared render-slot lock under <this repo>/shots/.locks, utility QoS) — run with SHOT_SLOTS=1.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2); const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ROOT = path.resolve(argv.find(a => !a.startsWith('--')) || HERE);
const SECS = +opt('secs', 3); const EXTRA = opt('q', ''); const EVAL = opt('eval', ''); const CPUPROF = argv.includes('--cpuprof'); const PNG = opt('png', ''); const EVAL_SRC = EVAL ? fs.readFileSync(EVAL, 'utf8') : '';
const LOCKS = path.join(HERE, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 1); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const REAL = fs.realpathSync(ROOT);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = { root: REAL, spots: {}, errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/index.html?menu=0${/(^|&)tod=/.test(EXTRA) ? '' : '&tod=11:00'}&weather=clear${EXTRA ? '&' + EXTRA : ''}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 240000, polling: 300 });
  await page.waitForFunction(() => window.__probes, null, { timeout: 180000, polling: 500 }).catch(() => {});
  await sleep(3000);
  const all = { pool: [5.0, 0.3, 21.6, -1.57], family: [4.2, 0.0, 15.0, 0.6], front: [14.5, -0.9, -8.5, 3.14], kitchen: [19.5, 0.0, 14.5, 0.0] };
  const want = opt('spots', Object.keys(all).join(',')).split(',');
  for (const k of want) {
    const [x, y, z, yaw] = all[k];
    await page.evaluate(([x, y, z, yaw]) => { const P = window.__player; P.teleport(x, y, z, yaw); P.state.thirdPerson = true; }, [x, y, z, yaw]);
    await sleep(1500);
    let cdp = null; if (CPUPROF) { cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
    out.spots[k] = await page.evaluate(async (secs) => {
      // every renderer.render() call during the window: CPU ms, draw calls, triangles per (scene, camera) kind
      const rd = window.__dbg.renderer, S = window.__dbg.scene; const passes = new Map(); const orig = rd.render;
      rd.render = function (sc, cam) { const a = performance.now(); const r = orig.call(this, sc, cam); const ms = performance.now() - a;
        const k = (sc === S ? 'MAIN' : (sc.name || sc.type)) + '/' + (cam.type || '') + (cam === window.__dbg.camera ? '*' : '');
        const e = passes.get(k) || { n: 0, ms: 0, calls: 0, tris: 0 }; e.n++; e.ms += ms; e.calls += this.info.render.calls; e.tris += this.info.render.triangles; passes.set(k, e); return r; };
      const L = window.__frameLog, G = window.__gpuTimer, R = window.__prof; const n0 = L.n; const t0 = performance.now();
      R.reset(); R.on = true; const g = []; const iv = setInterval(() => { const v = G?.ms; if (v > 0) g.push(v); }, 50);
      await new Promise(r => setTimeout(r, secs * 1000)); clearInterval(iv); R.on = false; rd.render = orig;
      const F = Math.max(1, R.frames); const pass = [...passes].map(([k, e]) => [k, +(e.n / F).toFixed(2), +(e.ms / F).toFixed(3), Math.round(e.calls / e.n), Math.round(e.tris / e.n)]).sort((a, b) => b[2] - a[2]);
      // frustum-visible draws in the main view, grouped by the scene's top-level child (piece / module)
      const THREE = await import('three'); const cam = window.__dbg.camera; const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const sph = new THREE.Sphere();
      const grp = {}; let objs = 0;
      S.traverseVisible(o => { objs++; if (!o.isMesh && !o.isPoints && !o.isLine) return; let inF = true;
        if (o.frustumCulled) { const bs = o.isInstancedMesh ? (o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)); if (bs) { sph.copy(bs).applyMatrix4(o.matrixWorld); inF = fr.intersectsSphere(sph); } }
        if (!inF) return; let p = o; while (p.parent && p.parent !== S) p = p.parent; const k = (p.name || p.type) + (p.name?.startsWith('piece') ? '' : '');
        const nc = Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1; const g = grp[k] || (grp[k] = [0, 0]); g[0] += nc; g[1]++; });
      const groups = Object.entries(grp).sort((a, b) => b[1][0] - a[1][0]).slice(0, 14).map(([k, v]) => [k, v[0]]);
      const n = L.n - n0; const arr = []; for (let i = 0; i < Math.min(n, 8192); i++) arr.push(L.buf[(L.n - 1 - i) & 8191]); arr.sort((a, b) => a - b);
      g.sort((a, b) => a - b); const info = window.__dbg.renderer.info.render; const rep = R.report();
      return { frames: n, avgMs: +((performance.now() - t0) / Math.max(1, n)).toFixed(2), p50: +(arr[arr.length >> 1] || 0).toFixed(2), gpuMs: +(g[g.length >> 1] || 0).toFixed(2),
        calls: info.calls, tris: info.triangles, video: JSON.stringify(window.__video), pr: +window.__dbg.renderer.getPixelRatio().toFixed(3), rows: rep.rows.slice(0, 14), pass, objs, groups };
    }, SECS);
    if (cdp) { // --cpuprof: self time by function (ms per frame), top 30
      const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
      const dts = profile.timeDeltas; for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const cf = n.callFrame; const key = (cf.functionName || '(anon)') + ' ' + cf.url.replace(/^.*\/(src|vendor)\//, '$1/') + ':' + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + (dts[i] || 0) / 1000); }
      const F = Math.max(1, out.spots[k].frames); out.spots[k].cpu = [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k2, v]) => [k2, +(v / F).toFixed(3)]); await cdp.detach();
    }
    if (PNG) { fs.mkdirSync(PNG, { recursive: true }); await page.locator('#c').screenshot({ path: path.join(PNG, k + '.png') }); } /* --png=dir: gameplay still per spot */
    if (EVAL_SRC) out.spots[k].eval = await page.evaluate(EVAL_SRC); // --eval=file.js: extra in-page probe per spot (expression -> JSON)
  }
  await ctx.close();
} catch (e) { out.errors.push(String(e.stack || e).slice(0, 400)); }
await browser.close(); server.close();
console.log(JSON.stringify(out));
