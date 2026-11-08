#!/usr/bin/env node
// Which meshes cost the most triangles from a viewpoint (frustum-aware). node tools/perf_top.mjs x,y,z,yawDeg [...]
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
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?room=top-${process.pid}&noprobes=1&quality=low`);
await page.waitForFunction(() => window.__ready === true && window.__player, null, { timeout: 180000 });
const views = process.argv.slice(2).map(a => a.split(',').map(Number));
const out = await page.evaluate(async (views) => {
  const d = window.__dbg; const THREE = await import('three'); const res = [];
  const fr = new THREE.Frustum(), m = new THREE.Matrix4(), sph = new THREE.Sphere();
  for (const [x, y, z, yaw] of views) {
    d.paused = true; d.camera.position.set(x, y, z); d.camera.rotation.set(0, yaw * Math.PI / 180, 0, 'YXZ'); d.camera.updateMatrixWorld(); d.scene.updateMatrixWorld();
    m.multiplyMatrices(d.camera.projectionMatrix, d.camera.matrixWorldInverse); fr.setFromProjectionMatrix(m);
    const list = []; let tot = 0, calls = 0; const agg = {};
    d.scene.traverseVisible(o => { if (!o.isMesh) return; let inF = true;
      if (o.frustumCulled) { if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); } else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); } inF = fr.intersectsSphere(sph); }
      if (!inF) return; const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      let p = o, pc = ''; while (p) { if ((p.name || '').startsWith('piece:') || p.name === 'shell') { pc = p.name; break; } p = p.parent; }
      const nc = Array.isArray(o.material) ? Math.max(1, g.groups.length) : 1; const key = pc + (o.name === 'merged' ? ' [merged]' : o.isInstancedMesh ? ' [inst]' : Array.isArray(o.material) ? ' [multi]' : ' [single]'); agg[key] = (agg[key] || 0) + nc;
      tot += n; calls += nc; list.push([Math.round(n), pc, o.name || o.material?.name || '', o.isInstancedMesh ? 'inst x' + o.count : '', o.frustumCulled ? '' : 'NOCULL', Math.round(sph.radius)]); });
    list.sort((a, b) => b[0] - a[0]); res.push({ view: [x, y, z, yaw], tris: Math.round(tot), calls, agg: Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 22), top: list.slice(0, 6) });
  }
  return res;
}, views);
for (const r of out) { console.log(JSON.stringify({ view: r.view, tris: r.tris, calls: r.calls })); console.log('  agg', JSON.stringify(r.agg)); for (const t of r.top) console.log('   ', JSON.stringify(t)); }
await ctx.close(); server.close(); process.exit(0);
