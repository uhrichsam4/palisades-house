#!/usr/bin/env node
// Before/after capture of the walk-through (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/capture.mjs --root=<site dir> --out=<dir> [--set=before|after] [--only=a,b] [--size=1920x1080] [--fps=30]
//        [--stills-only] [--videos-only] [--no-sheet]
//   node tools/capture.mjs --compose --before=<dir> --after=<dir> --out=<dir>
// Shots come from tools/capture_shots.json (same cameras for every version). Walk mode (?menu=0&quality=ultra):
// the main loop runs between shots so the light pool / culling / doors / probe bake follow the camera (the
// player is teleported to the camera, first person = avatar hidden); for the frame itself the loop is paused
// (window.__dbg.paused), the camera is set exactly and __dbg.render() draws it; the canvas is read with
// toDataURL in the same task, so no HTML HUD ends up in the image. Videos: per frame the loop runs ~2 frames
// (water, props, doors advance), then pauses and renders the eased Catmull-Rom camera. Frames are JPEG and are
// deleted right after ffmpeg (H.264 yuv420p crf 18 +faststart).
// --set=before skips after_only shots. Shots with `params` reload the page with those extra query params.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : '1']; }));
const expand = (p) => path.resolve(String(p).replace(/^~(?=\/|$)/, process.env.HOME));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.error('[capture]', ...a);

// ---------------------------------------------------------------- render slot (shots/.locks, SHOT_SLOTS)
const LOCKS = path.join(REPO, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (let waited = 0; !slot; waited++) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) { if (waited === 0) log('waiting for a free render slot…'); await sleep(1500); }
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });

// ---------------------------------------------------------------- static server (any root)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
async function serve(root) {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(root, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
    if (u === '/.blank') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>sheet</title>'); }
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream'; const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-store' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::|AudioContext|Failed to load resource/i;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] });
const done = async (code) => { try { await browser.close(); } catch {} process.exit(code); };
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' ')); };
const SHOTS = JSON.parse(fs.readFileSync(path.join(HERE, 'capture_shots.json'), 'utf8'));
const only = opt.only ? opt.only.split(',') : null;

// ---------------------------------------------------------------- camera paths
const crom = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return p1.map((_, i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); };
const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; // easeInOutCubic
function pathAt(v, u) { // u in [0,1] -> {pos, look, fov}
  const k = v.keys, n = k.length - 1, s = Math.min(n - 1e-9, Math.max(0, ease(u) * n)), i = Math.floor(s), t = s - i;
  const g = (j, key) => k[Math.max(0, Math.min(n, j))][key];
  const fov = (g(i, 'fov') ?? v.fov ?? 60) + ((g(i + 1, 'fov') ?? v.fov ?? 60) - (g(i, 'fov') ?? v.fov ?? 60)) * t;
  return { pos: crom(g(i - 1, 'pos'), g(i, 'pos'), g(i + 1, 'pos'), g(i + 2, 'pos'), t), look: crom(g(i - 1, 'look'), g(i, 'look'), g(i + 1, 'look'), g(i + 2, 'look'), t), fov };
}

// ---------------------------------------------------------------- in-page helpers
// installed once per page load: window.__cap = { place(pose), frame(pose, q) -> dataURL, step(n) }
const PAGE_HELPERS = () => {
  const D = window.__dbg, P = window.__player, cam = D.camera, canvas = D.renderer.domElement;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const ultra = () => { const q = window.__quality; if (q && (q.auto || q.tierIndex !== 0 || q.scale < q.tier.max - 1e-3 || q.stage > 0)) q.set('ultra'); };
  const setCam = (p) => { cam.fov = p.fov ?? 60; cam.aspect = innerWidth / innerHeight; cam.position.set(...p.pos); cam.lookAt(p.look[0], p.look[1], p.look[2]); if (p.roll) cam.rotateZ(-p.roll * Math.PI / 180); cam.updateProjectionMatrix(); };
  // first-person (avatar hidden) player standing under the camera, facing the look target
  const place = (p) => { if (!P) return; P.state.thirdPerson = false; P.state.keys?.clear(); P.state.autopilot = null;
    const yaw = Math.atan2(-(p.look[0] - p.pos[0]), -(p.look[2] - p.pos[2])); P.teleport(p.pos[0], p.pos[1] - 1.62, p.pos[2], yaw);
    P.state.pitch = Math.atan2(p.look[1] - p.pos[1], Math.hypot(p.look[0] - p.pos[0], p.look[2] - p.pos[2])); P.creature?.setVisible?.(false); };
  window.__cap = {
    place,
    async run(ms) { D.paused = false; await new Promise(r => setTimeout(r, ms)); },
    async step(p, n = 2) { place(p); D.paused = false; for (let i = 0; i < n; i++) await raf(); D.paused = true; },
    grab(p, q = 0.92) { D.paused = true; ultra(); if (p) setCam(p); D.render(); D.render(); return canvas.toDataURL('image/jpeg', q); },
    async thirdPerson(pl) { D.paused = false; P.state.thirdPerson = true; cam.fov = pl.fov ?? 70; cam.updateProjectionMatrix(); P.teleport(pl.pos[0], pl.pos[1], pl.pos[2], pl.yaw); P.state.facing = pl.yaw + (pl.facing ?? 0); P.state.pitch = pl.pitch ?? -0.1; },
    info() { return { w: canvas.width, h: canvas.height, quality: window.__quality && { tier: window.__quality.tier.name, scale: window.__quality.scale, stage: window.__quality.stage }, probes: !!window.__probes, errors: window.__errors || [] }; },
  };
};
const writeDataURL = (f, d) => fs.writeFileSync(f, Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'));

async function openSite(base, params, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  // fair comparisons: the new version's live clock/auto-weather would otherwise pick night or rain at random.
  // Default to midday + clear; a shot's own params (tod=…, weather=…) override. Old versions ignore both.
  const base0 = 'tod=13:00&weather=clear'; const merged = new URLSearchParams(base0); for (const [k, v] of new URLSearchParams(params || '')) merged.set(k, v);
  const q = `menu=0&quality=ultra&fpscap=60&${merged.toString()}`;
  log('loading', q);
  await page.goto(`${base}/index.html?${q}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__dbg, null, { timeout: 300000, polling: 500 });
  // room light probes bake in the background in walk mode: wait for them (window.__probes is set when done)
  // The slow headless GPU makes Ultra pull its levers (stage 4 = probe bake paused), so: Ultra stage 0, walk loop
  // paused (quality.frame never runs), probes bake on their own rAF.
  await page.evaluate(() => { window.__quality?.set('ultra'); window.__dbg.paused = true; window.__probesPaused = false; });
  const t0 = Date.now(); await page.waitForFunction(() => { window.__probesPaused = false; return !!window.__probes; }, null, { timeout: 240000, polling: 1000 }).catch(() => log('probes not done after 240 s, continuing'));
  log('probes', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await page.evaluate(PAGE_HELPERS);
  return { page, logs };
}

// ---------------------------------------------------------------- render a set
async function renderSet() {
  const root = expand(opt.root || REPO), out = expand(opt.out || path.join(REPO, 'shots', 'capture'));
  const set = opt.set || 'after'; const [W, H] = (opt.size || '1920x1080').split('x').map(Number); const FPS = Number(opt.fps || 30);
  fs.mkdirSync(out, { recursive: true });
  const pick = (s) => (!only || only.includes(s.name)) && !(set === 'before' && s.after_only);
  const stills = opt['videos-only'] ? [] : SHOTS.stills.filter(pick);
  const videos = opt['stills-only'] ? [] : SHOTS.videos.filter(pick);
  const { server, url } = await serve(root);
  const report = { set, root, out, size: [W, H], stills: [], videos: [], errors: [] };
  const groups = new Map(); for (const s of stills) { const k = s.params || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  if (videos.length && !groups.has('')) groups.set('', []);
  for (const [params, list] of groups) {
    const { page, logs } = await openSite(url, params, W, H);
    report.page = await page.evaluate(() => window.__cap.info());
    let first = true;
    for (const s of list) {
      const f = path.join(out, s.name + '.jpg'); const t0 = Date.now();
      if (s.player) { await page.evaluate((pl) => window.__cap.thirdPerson(pl), s.player); await sleep(s.wait || 3000); }
      else { await page.evaluate((p) => window.__cap.place(p), s); await page.evaluate((ms) => window.__cap.run(ms), first ? 2500 : (s.wait || 1600)); }
      writeDataURL(f, await page.evaluate((p) => window.__cap.grab(p), s.player ? null : s));
      first = false; report.stills.push(f); log('still', s.name, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
    if (params === '') for (const v of videos) {
      const n = Math.round(v.duration * FPS), dir = path.join(out, '.frames_' + v.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      await page.evaluate((p) => window.__cap.place(p), pathAt(v, 0)); await page.evaluate(() => window.__cap.run(2500)); // pre-roll: doors, light pool, culling settle
      for (let i = 0; i < n; i++) {
        const p = pathAt(v, n > 1 ? i / (n - 1) : 0);
        await page.evaluate((p) => window.__cap.step(p, 2), p);
        writeDataURL(path.join(dir, String(i).padStart(5, '0') + '.jpg'), await page.evaluate((p) => window.__cap.grab(p, 0.95), p));
        if (i === Math.floor(n / 2)) fs.copyFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), path.join(out, v.name + '.mid.jpg'));
      }
      const mp4 = path.join(out, v.name + '.mp4');
      ffmpeg(['-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
      fs.rmSync(dir, { recursive: true, force: true });
      report.videos.push(mp4); log('video', v.name, n + ' frames', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
    await page.evaluate(() => { window.__dbg.paused = false; });
    report.errors.push(...logs.map(l => (params ? `[${params}] ` : '') + l));
    await page.close();
  }
  server.close();
  if (!opt['no-sheet']) report.sheet = await contactSheet(out, [...report.stills, ...report.videos.map(m => m.replace(/\.mp4$/, '.mid.jpg'))], `${set.toUpperCase()} · ${path.basename(root)}`);
  console.log(JSON.stringify(report));
  return report.errors.length ? 1 : 0;
}

// ---------------------------------------------------------------- contact sheet (canvas in the browser, no drawtext needed)
async function contactSheet(dir, files, title) {
  files = files.filter(f => fs.existsSync(f)); if (!files.length) return null;
  const { server, url } = await serve(path.dirname(files[0]));
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(url + '/.blank', { waitUntil: 'load' }); // same origin as the images, so the canvas stays exportable
  const rel = files.map(f => path.relative(path.dirname(files[0]), f));
  const data = await page.evaluate(async ({ url, rel, title }) => {
    const imgs = await Promise.all(rel.map(r => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url + '/' + r.split('/').map(encodeURIComponent).join('/'); })));
    const cols = 4, tw = 640, th = Math.round(tw * (imgs[0]?.height || 1080) / (imgs[0]?.width || 1920)), pad = 12, lab = 30, top = 56;
    const rows = Math.ceil(imgs.length / cols), c = document.createElement('canvas'); c.width = cols * (tw + pad) + pad; c.height = top + rows * (th + lab + pad) + pad;
    const g = c.getContext('2d'); g.fillStyle = '#121212'; g.fillRect(0, 0, c.width, c.height);
    g.font = '600 22px ui-monospace, Menlo, monospace'; g.fillStyle = 'rgba(247,247,247,.85)'; g.fillText(title, pad, 36);
    imgs.forEach((im, k) => { const x = pad + (k % cols) * (tw + pad), y = top + Math.floor(k / cols) * (th + lab + pad); if (im) g.drawImage(im, x, y, tw, th);
      g.font = '15px ui-monospace, Menlo, monospace'; g.fillStyle = 'rgba(247,247,247,.66)'; g.fillText(rel[k].split('/').pop().replace(/\.mid\.jpg$/, ' (video, mid frame)').replace(/\.jpg$/, ''), x, y + th + 21); });
    return c.toDataURL('image/jpeg', 0.86);
  }, { url, rel, title });
  const f = path.join(dir, 'contact_sheet.jpg'); writeDataURL(f, data); await page.close(); server.close(); return f;
}

// ---------------------------------------------------------------- compose before | after
async function chipPNG(text, f) { // small mono chip: #262626, rgba(247,247,247,.66) text
  const page = await browser.newPage({ viewport: { width: 400, height: 100 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent"><span id=c style="display:inline-block;padding:7px 12px;border-radius:6px;background:#262626;color:rgba(247,247,247,.66);font:600 20px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em">${text}</span></body></html>`);
  await page.locator('#c').screenshot({ path: f, omitBackground: true }); await page.close(); return f;
}
async function compose() {
  const B = expand(opt.before), A = expand(opt.after), out = expand(opt.out); fs.mkdirSync(out, { recursive: true });
  const tmp = path.join(out, '.chips'); fs.mkdirSync(tmp, { recursive: true });
  const cb = await chipPNG('BEFORE', path.join(tmp, 'before.png')), ca = await chipPNG('AFTER', path.join(tmp, 'after.png'));
  const made = [], sheetFiles = [];
  const HALF = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2';
  for (const s of SHOTS.stills) {
    if (only && !only.includes(s.name)) continue;
    const b = path.join(B, s.name + '.jpg'), a = path.join(A, s.name + '.jpg'), f = path.join(out, s.name + '_vs.jpg');
    if (fs.existsSync(a) && fs.existsSync(b)) ffmpeg(['-i', b, '-i', a, '-i', cb, '-i', ca, '-filter_complex', `[0]${HALF}[l];[1]${HALF}[r];[l][r]hstack[s];[s][2]overlay=18:18[t];[t][3]overlay=1280+18:18`, '-frames:v', '1', '-q:v', '3', f]);
    else if (fs.existsSync(a)) ffmpeg(['-i', a, '-i', ca, '-filter_complex', `[0]${HALF}[l];[l][1]overlay=18:18`, '-frames:v', '1', '-q:v', '3', f]);
    else { log('skip still (missing)', s.name); continue; }
    made.push(f); sheetFiles.push(f);
  }
  for (const v of SHOTS.videos) {
    if (only && !only.includes(v.name)) continue;
    const b = path.join(B, v.name + '.mp4'), a = path.join(A, v.name + '.mp4');
    if (!fs.existsSync(a) || !fs.existsSync(b)) { log('skip video (missing)', v.name); continue; }
    const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
    const sbs = path.join(out, v.name + '_sbs.mp4');
    ffmpeg(['-i', b, '-i', a, '-i', cb, '-i', ca, '-filter_complex', `[0]${HALF},setsar=1[l];[1]${HALF},setsar=1[r];[l][r]hstack=shortest=1[s];[s][2]overlay=18:18[t];[t][3]overlay=1280+18:18`, ...enc, sbs]);
    // wipe: the clip plays once as BEFORE, then once more with AFTER wiping in from the left across its first 1.5 s
    const wipe = path.join(out, v.name + '_wipe.mp4');
    const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', b], { encoding: 'utf8' }).stdout.trim()) || v.duration;
    ffmpeg(['-i', b, '-i', a, '-i', cb, '-i', ca, '-filter_complex',
      `[0]scale=1920:1080,setsar=1,fps=30[b0];[b0][2]overlay=24:24[bl];[1]scale=1920:1080,setsar=1,fps=30[a0];[a0][3]overlay=24:24[al];[bl][al]xfade=transition=wiperight:duration=1.2:offset=${Math.max(0.1, dur - 1.2).toFixed(2)}`, ...enc, wipe]);
    made.push(sbs, wipe);
    const mid = path.join(tmp, v.name + '_sbs.mid.jpg'); ffmpeg(['-ss', String(dur / 2), '-i', sbs, '-frames:v', '1', '-q:v', '3', mid]); sheetFiles.push(mid);
  }
  const sheet = await contactSheet(out, sheetFiles.map(f => f), 'BEFORE | AFTER');
  for (const f of fs.readdirSync(tmp)) if (f.endsWith('.mid.jpg')) fs.rmSync(path.join(tmp, f));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(JSON.stringify({ compose: out, made, sheet }));
  return 0;
}

async function sheetOnly() { // --sheet --out=<dir> [--set=before|after]: rebuild the contact sheet from what is there
  const out = expand(opt.out), set = opt.set || 'after';
  const files = [...SHOTS.stills.map(s => path.join(out, s.name + '.jpg')), ...SHOTS.videos.map(v => path.join(out, v.name + '.mid.jpg'))];
  console.log(JSON.stringify({ sheet: await contactSheet(out, files, `${set.toUpperCase()} · ${path.basename(expand(opt.root || out))}`) })); return 0;
}
try { await done(opt.compose ? await compose() : opt.sheet ? await sheetOnly() : await renderSet()); }
catch (e) { console.error(e); await done(1); }
