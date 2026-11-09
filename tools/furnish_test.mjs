#!/usr/bin/env node
// Furnish before/after: loads the house twice in shot mode (furnish off, then ?furnish=1), renders the same
// cameras in both, writes shots/furnish/<view>_off.png / _on.png, side-by-side pairs <view>_pair.jpg and a
// contact sheet. Prints per-view draw calls (shot mode = no room culling) + page errors + inventory.
//   node tools/furnish_test.mjs [--views=kitchen,dining] [--only-on] [--keep-png]
// Shares tools/shot.mjs' render-slot locks and runs at utility QoS.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') { const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } }); process.exit(r.status ?? 1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const OUT = path.join(ROOT, 'shots', 'furnish'); fs.mkdirSync(OUT, { recursive: true });
const U = 3.35;
export const VIEWS = {
  kitchen: [17.8, 1.6, 13.0, 20.5, 1.0, 17.5, 66], kitchen_islands: [20.2, 1.7, 13.0, 17.0, 0.9, 17.5, 66], kitchen_nook: [17.0, 1.6, 17.5, 20.5, 0.9, 20.3, 66],
  dining: [9.0, 1.7, 14.0, 12.8, 0.7, 16.2, 64], wetbar: [12.8, 1.5, 15.2, 12.8, 1.5, 12.5, 64],
  family: [7.6, 1.7, 19.5, 3.5, 0.8, 15.5, 66], family2: [3.3, 1.6, 19.2, 6.5, 0.6, 15.5, 66],
  living: [7.9, 1.6, 12.8, 2.0, 0.8, 9.0, 66], living_piano: [3.6, 1.6, 11.2, 7.6, 0.8, 8.2, 66],
  foyer: [9.6, 1.6, 9.5, 8.6, 0.8, 5.0, 66], game: [5.7, 1.6, 5.0, 7.8, 0.8, 6.8, 70], powder: [2.3, 1.6, 13.75, 1.1, 0.8, 15.4, 72],
  mudroom: [16.4, 1.6, 8.0, 12.0, 0.6, 9.5, 66], mudroom2: [12.3, 1.6, 8.6, 15.5, 0.5, 7.5, 66],
  pantry: [13.3, 1.5, 12.1, 13.3, 1.0, 10.8, 74], store: [14.45, 1.5, 13.4, 14.45, 1.0, 12.4, 74], kpantry: [21.7, 1.5, 13.8, 22.6, 1.0, 11.5, 72],
  office: [17.6, 1.6, 8.0, 21.0, 0.8, 8.8, 66], garage: [13.0, 1.8, 1.2, 17.5, 0.8, 6.5, 66], garage2: [19.0, 1.8, 1.5, 12.0, 1.0, 4.0, 66],
  bedA: [14.8, U + 1.6, 5.5, 11.8, U + 0.55, 2.0, 66], bedA2: [12.0, U + 1.55, 5.2, 14.5, U + 0.55, 2.5, 66],
  bedB: [19.0, U + 1.6, 5.6, 18.0, U + 0.55, 2.0, 66], bedB2: [18.3, U + 1.55, 1.6, 21.5, U + 0.45, 4.5, 66],
  bedC: [4.5, U + 1.6, 12.8, 1.5, U + 0.55, 9.5, 66], bedC2: [1.8, U + 1.55, 12.6, 4.9, U + 0.55, 9.5, 66],
  primary: [9.3, U + 1.6, 12.2, 14.0, U + 0.55, 15.0, 66], primary2: [14.2, U + 1.55, 12.2, 9.8, U + 0.55, 15.0, 66],
  primaryCloset: [18.3, U + 1.6, 13.6, 20.5, U + 0.55, 9.6, 70], primaryBath: [18.5, U + 1.6, 15.0, 21.0, U + 0.55, 18.5, 70], vestibule: [16.0, U + 1.55, 11.9, 17.2, U + 0.75, 13.2, 74],
  theater: [15.3, U + 1.85, 9.9, 12.0, U + 0.55, 6.8, 66], bathA: [16.9, U + 1.55, 4.3, 16.0, U + 0.65, 1.5, 74], bathB: [20.5, U + 1.55, 8.6, 21.8, U + 0.75, 6.4, 74],
  bathC: [7.8, U + 1.55, 11.0, 5.5, U + 0.65, 12.5, 74], guestBath: [5.75, U + 1.55, 5.15, 7.6, U + 0.75, 7.0, 74], closetB: [19.6, U + 1.55, 6.5, 17.6, U + 0.65, 8.0, 74],
  hallNS: [16.5, U + 1.55, 6.0, 16.8, U + 0.15, 10.0, 66], balcony: [8.7, U + 1.55, 17.5, 12.0, U + 0.25, 18.6, 66],
  deckWest: [3.5, 1.6, 23.5, -0.5, 0.4, 18.0, 62], deckEast: [16.8, 1.7, 22.5, 21.0, 0.3, 27.5, 62], pool: [10.5, 2.5, 20.5, 10.0, -0.3, 25.5, 62],
  front: [0.5, 1.0, -12.0, 0.6, -0.4, -7.5, 60], sideyard: [-2.5, 1.4, 7.0, 0.0, 0.0, 10.5, 62],
};
const names = opt.views ? opt.views.split(',') : Object.keys(VIEWS);

const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } } if (!slot) await new Promise(r => setTimeout(r, 1500)); }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ctx = await chromium.launchPersistentContext(path.join(ROOT, 'shots', '.chrome-' + path.basename(slot)), { channel: 'chrome', headless: true, viewport: { width: 1080, height: 720 }, deviceScaleFactor: 1, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = { views: {} };
for (const mode of opt['only-on'] ? ['on'] : ['off', 'on']) {
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const first = VIEWS[names[0]];
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?cam=${first.join(',')}${mode === 'on' ? '&furnish=1' : ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 500 }).catch(() => errs.push('timeout'));
  const info = await page.evaluate(() => { const root = window.__dbg.scene.getObjectByName('piece:furnish'); const st = { meshes: 0, merged: 0, casters: 0, tris: 0, mats: new Set(), loose: {} };
    root?.traverse(o => { if (!o.isMesh) return; st.meshes++; if (o.name === 'merged') st.merged++; else { let p = o; while (p && !p.userData.furnish) p = p.parent; const k = (p?.userData.furnish?.name || o.name || '?') + (p?.userData.dynamic ? ' (dyn)' : ''); st.loose[k] = (st.loose[k] || 0) + 1; } if (o.castShadow) st.casters++; st.mats.add(o.material.uuid); (st.mn = st.mn || {})[o.material.name || o.material.type] = ((st.mn || {})[o.material.name || o.material.type] || 0) + 1; st.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    st.mats = st.mats.size; st.tris = Math.round(st.tris); st.loose = Object.entries(st.loose).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { errors: window.__errors || [], furnish: window.__furnish || null, timing: window.__timing?.['build:furnish'], meshStats: st }; });
  report[mode] = { errors: [...new Set([...info.errors, ...errs.filter(e => !/GPU stall|WebGL: INVALID|Automatic fallback/.test(e))])].slice(0, 12), timing: info.timing, furnish: info.furnish ? { props: info.furnish.props, dynamic: info.furnish.dynamic, solid: info.furnish.solid, ms: info.furnish.ms, tris: info.furnish.tris, topTris: info.furnish.topTris } : null, meshStats: info.meshStats };
  if (mode === 'on' && info.furnish) report.inventory = info.furnish.inventory;
  for (const n of names) {
    const v = VIEWS[n];
    const calls = await page.evaluate(async (v) => { const d = window.__dbg, c = d.camera; c.fov = v[6]; c.position.set(v[0], v[1], v[2]); c.lookAt(v[3], v[4], v[5]); c.updateProjectionMatrix(); c.updateMatrixWorld();
      d.renderer.info.autoReset = false; d.renderer.info.reset(); d.renderer.render(d.scene, c); const calls = d.renderer.info.render.calls; d.renderer.info.autoReset = true;
      for (let i = 0; i < 3; i++) { d.render(); await new Promise(r => requestAnimationFrame(r)); } return calls; }, v);
    await page.locator('#c').screenshot({ path: path.join(OUT, `${n}_${mode}.png`) });
    (report.views[n] = report.views[n] || {})[mode + 'Calls'] = calls;
  }
  await page.close();
}
await ctx.close(); server.close();
// pairs + contact sheet
const py = `
import sys, os
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; names = sys.argv[2].split(',')
def font(s):
  for f in ['/System/Library/Fonts/Helvetica.ttc']:
    try: return ImageFont.truetype(f, s)
    except Exception: pass
  return ImageFont.load_default()
F = font(28); thumbs = []
for n in names:
  on = os.path.join(out, n + '_on.png'); off = os.path.join(out, n + '_off.png')
  if not os.path.exists(on): continue
  A = Image.open(on).convert('RGB'); B = Image.open(off).convert('RGB') if os.path.exists(off) else A
  s = Image.new('RGB', (2160, 720)); s.paste(B, (0, 0)); s.paste(A, (1080, 0)); d = ImageDraw.Draw(s)
  for x, t in [(0, n + '  BEFORE'), (1080, n + '  AFTER')]: d.rectangle([x, 0, x + 18 + 16 * len(t), 40], fill=(0, 0, 0)); d.text((x + 10, 4), t, fill=(255, 230, 0), font=F)
  s.save(os.path.join(out, n + '_pair.jpg'), quality=85); thumbs.append((n, s.resize((720, 240), Image.LANCZOS)))
cols = 3; rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 720, rows * 240), (20, 20, 20))
for i, (n, t) in enumerate(thumbs): sheet.paste(t, ((i % cols) * 720, (i // cols) * 240))
sheet.save(os.path.join(out, 'contact_sheet.jpg'), quality=82)
`;
execFileSync('python3', ['-I', '-c', py, OUT, names.join(',')]);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const brief = { off: report.off, on: report.on, views: report.views };
console.log(JSON.stringify(brief));
process.exit((report.on?.errors?.length || 0) ? 1 : 0);
