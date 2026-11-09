#!/usr/bin/env node
// "Nothing goes through what it shouldn't" (contain pass). ONE headless Chrome (SHOT_SLOTS lock, utility QoS).
//   node tools/contain_test.mjs   -> JSON lines + shots in shots/contain/, exit 1 on a failed check
// (a) night storm: a windowless room (pantry) doesn't brighten in a lightning flash (< +5 %), a big-glass room (dining)
//     brightens moderately; (b) rain: the static roof map covers every indoor room; breaking an upper exterior wall
//     panel / opening a window opens a gap in the rain map just inside it and nowhere else; (c) a max-power stone at a
//     drywall partition, an exterior wall and a window never ends up on the far side of an intact wall; a held prop
//     can't be pushed through a wall; (d) the car headlight's range stops at the garage door in front of it;
//     (e) shower spray is clipped to its enclosure (inside the bathroom).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = new Set(process.argv.slice(2));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
const SLOTS = Number(process.env.SHOT_SLOTS || 1); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 100) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext|youtube|googlevideo|doubleclick|ytimg|postMessage|\[lobbies\]|404 \(Not Found\)/i;
const dir = path.join(ROOT, 'shots', 'contain'); fs.mkdirSync(dir, { recursive: true });
const P = (o) => console.log(JSON.stringify(o));
const checks = {}; const out = { test: 'contain', shots: {} };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(5, 14).join(' | ')));
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { const f = path.join(dir, n + '.png'); await page.screenshot({ path: f }); out.shots[n] = path.relative(ROOT, f); return f; };
try {
  await page.goto(`http://127.0.0.1:${port}/index.html?menu=0`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__sky && window.__building && window.__probes && window.__sky.nightReady, null, { timeout: 420000, polling: 500 });
  await sleep(1500);
  await ev(() => {
    const Pl = window.__player;
    window.__look = (p, tp) => { const e = Pl.position.clone(); e.y += 1.62; const dx = p[0] - e.x, dy = p[1] - e.y, dz = p[2] - e.z; Pl.state.yaw = Math.atan2(-dx, -dz); Pl.state.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Pl.state.facing = Pl.state.yaw; Pl.state.thirdPerson = !!tp; };
    window.__stand = (x, y, z, at, tp) => { Pl.teleport(x, y + 0.02, z); window.__look(at, tp); };
    window.__lum = () => new Promise(res => requestAnimationFrame(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const o = window.__lc ||= Object.assign(document.createElement('canvas'), { width: 160, height: 100 }); const g = o.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0, 160, 100);
      const d = g.getImageData(0, 0, 160, 100).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; res(s / (d.length / 4)); }));
    window.__med = async (n) => { const v = []; for (let i = 0; i < n; i++) { v.push(await window.__lum()); await new Promise(r => setTimeout(r, 90)); } v.sort((a, b) => a - b); return v[n >> 1]; };
    return true;
  });

  // ---------------------------------------------------------------- (a) lightning
  await ev(() => window.__sky.set({ weather: 'storm', tod: '00:30', frozen: true, instant: true }));
  await sleep(2500);
  const flash = async (name, at, look, tp = false) => {
    await ev(([a, l, tp]) => { window.__stand(a[0], a[1], a[2], l, tp); window.__sky.set({ flash: false }); }, [at, look, tp]); await sleep(1800);
    const off = await ev(() => window.__med(5)); await shot(name + '_off');
    await ev(() => window.__sky.set({ flash: 'hold' })); await sleep(500);
    const on = await ev(() => window.__med(3)); await shot(name + '_flash');
    await ev(() => window.__sky.set({ flash: false })); await sleep(300);
    const r = { off: +off.toFixed(2), on: +on.toFixed(2), rise: +((on - off) / Math.max(1, off) * 100).toFixed(1) }; P({ phase: 'flash', name, ...r }); return r;
  };
  const fPantry = await flash('pantry', [12.2, 0, 11.47], [15.24, 1.3, 11.47]);
  const fCloset = await flash('closetB', [18.2, 3.35, 7.5], [19.85, 4.6, 7.5]);
  const fDining = await flash('dining', [11.8, 0, 15.2], [9.0, 1.4, 13.6]);
  const fOut = await flash('outdoor', [11.8, 0, 26], [11.8, 2.5, 16], true);
  checks.flashWindowless = fPantry.rise < 5 && fCloset.rise < 5;
  checks.flashGlassRoom = fDining.rise > 3 && fDining.rise < fOut.rise;
  P({ phase: 'flash-summary', pantry: fPantry.rise, closetB: fCloset.rise, dining: fDining.rise, outdoor: fOut.rise });

  // ---------------------------------------------------------------- (b) rain / snow occlusion
  await ev(() => window.__sky.set({ weather: 'rain', tod: '12:00', frozen: true, instant: true }));
  const rb = await ev(async () => {
    const S = window.__sky, B = window.__building, PL = await import('/src/plan.js'); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const indoor = Object.entries(PL.ROOMS).filter(([, r]) => !r.outdoor);
    const inRoom = (x, z, lv) => indoor.find(([, r]) => r.level === lv && x > r.rect[0] && x < r.rect[2] && z > r.rect[1] && z < r.rect[3])?.[0] || null;
    // static map: something above every indoor point (ceiling height of its storey)
    let pts = 0, open = 0; const leaks = [];
    for (const [id, r] of indoor) { const [x0, z0, x1, z1] = r.rect; const need = r.level ? PL.LEVELS[1].floor + 2.3 : PL.LEVELS[0].ceil - 0.1;
      for (let x = x0 + 0.1; x < x1; x += 0.25) for (let z = z0 + 0.1; z < z1; z += 0.25) { pts++; if (S.roofAt(x, z) < need) { open++; if (leaks.length < 6) leaks.push([id, +x.toFixed(2), +z.toFixed(2), +S.roofAt(x, z).toFixed(2)]); } } }
    const gapsBefore = S.gaps;
    // an upper exterior wall panel, bottom row, with a bedroom behind it
    const cand = B.panels.filter(p => p.ext && p.level === 1 && !p.broken && p.L > 0.9 && Math.abs(p.y0 - PL.LEVELS[1].floor) < 0.4).map(p => { const o = p.depth / 2 + 0.6; const a = inRoom(p.center.x + p.N.x * o, p.center.z + p.N.y * o, 1), b = inRoom(p.center.x - p.N.x * o, p.center.z - p.N.y * o, 1); return { p, room: a || b, s: a ? 1 : -1, ok: !a !== !b }; }).filter(c => c.ok && /^bed/.test(c.room));
    const c = cand[0]; if (!c) return { err: 'no panel' }; const p = c.p; const nx = p.N.x * c.s, nz = p.N.y * c.s;
    const at = (d) => [p.center.x + nx * d, p.center.z + nz * d];
    const before = S.gapAt(...at(0.5));
    B.breakPanel(p.id); await sleep(1600);
    const inside = S.gapAt(...at(0.5)), deep = S.gapAt(...at(2.2));
    // gaps anywhere else indoors? (> 1.5 m from every hole)
    const holes = B.holes.map(h => [h.pos[0], h.pos[2], 2.2]); for (const o of B.openings.values()) if (o.type !== 'doorway' && (o.broken || o.open > 0.05)) holes.push([o.pos[0], o.pos[2], (PL.OPENINGS.find(q => q.id === o.id)?.w || 1) / 2 + 1.2]); let stray = 0, gapPts = 0;
    for (const [, r] of indoor) { const [x0, z0, x1, z1] = r.rect; for (let x = x0 + 0.1; x < x1; x += 0.25) for (let z = z0 + 0.1; z < z1; z += 0.25) { if (!S.gapAt(x, z)) continue; gapPts++; if (holes.every(h => Math.hypot(h[0] - x, h[1] - z) > h[2])) stray++; } }
    // a window opened: a gap appears just inside it
    const win = [...B.openings.values()].find(o => o.type === 'window' && o.room && /^bed|living|office/.test(o.room) && !o.broken);
    let winGap = null; if (win) { B.setOpen(win.id, 1); await sleep(2200); winGap = S.gapAt(win.pos[0] - win.normal[0] * 0.5, win.pos[2] - win.normal[2] * 0.5); }
    return { pts, open, leaks, gapsBefore, panel: p.id, room: c.room, before, inside, deep, gapPts, stray, win: win?.id, winGap, stand: at(2.6), look: [p.center.x, p.center.y, p.center.z], gaps: S.gaps };
  });
  P({ phase: 'rain', ...rb });
  if (!rb.err) {
    await ev(([s, l]) => window.__stand(s[0], 3.35, s[1], l, false), [rb.stand, rb.look]); await sleep(1500); await shot('rain_hole_inside');
  }
  checks.rainRoofs = rb.open === 0;
  checks.rainHole = !rb.err && !rb.before && !!rb.inside && !rb.deep && rb.stray === 0;
  checks.rainWindow = !!rb.winGap;
  await ev(() => { window.__building.repair(); for (const o of window.__building.ops.values()) window.__building.setOpen(o.id, 0); return true; }); await sleep(1500);

  // ---------------------------------------------------------------- (c) thrown stone vs walls, held prop vs wall
  await ev(() => window.__sky.set({ weather: 'clear', tod: '12:00', frozen: true, instant: true }));
  const rc = await ev(async () => {
    const B = window.__building, Sm = window.__smash, PL = await import('/src/plan.js'), Pl = window.__player; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const indoor = Object.entries(PL.ROOMS).filter(([, r]) => !r.outdoor);
    const inRoom = (x, z, lv) => indoor.find(([, r]) => r.level === lv && x > r.rect[0] + 0.3 && x < r.rect[2] - 0.3 && z > r.rect[1] + 0.3 && z < r.rect[3] - 0.3)?.[0] || null;
    const stones = Sm.items.filter(i => i.mode === 'dynamic' && i.d && /stone|rock/i.test(i.label || '')).sort((a, b) => b.mass - a.mass);
    const res = [];
    async function throwAt(it, from, aim, plane) { // plane: { c: [x,z], n: [nx,nz] } -> which side the stone ends on
      window.__stand(from[0], from[1], from[2], aim, false); await sleep(400);
      it.d.body.setTranslation({ x: from[0], y: from[1] + 1.2, z: from[2] }, true); it.d.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      Sm.hands.pickUp(it); await sleep(500);
      const thr = Sm.hands.throwHeld(1, { x: aim[0], y: aim[1], z: aim[2] }); await sleep(2500);
      const t = it.d.body.translation(); const side = (x, z) => Math.sign((x - plane.c[0]) * plane.n[0] + (z - plane.c[1]) * plane.n[1]);
      return { speed: thr?.speed, mass: +it.mass.toFixed(1), thrower: side(from[0], from[2]), end: side(t.x, t.z), pos: [t.x, t.y, t.z].map(v => +v.toFixed(2)) };
    }
    if (!stones.length) return { err: 'no stone' };
    const it = stones[0];
    // interior drywall partition on the ground floor with rooms on both sides
    const dw = B.panels.find(p => !p.ext && p.level === 0 && p.L > 1 && p.y0 < 0.3 && inRoom(p.center.x + p.N.x * 1.8, p.center.z + p.N.y * 1.8, 0) && inRoom(p.center.x - p.N.x * 1.8, p.center.z - p.N.y * 1.8, 0));
    if (dw) { const from = [dw.center.x + dw.N.x * 1.8, 0, dw.center.z + dw.N.y * 1.8]; const r = await throwAt(it, from, [dw.center.x, 1.2, dw.center.z], { c: [dw.center.x, dw.center.z], n: [dw.N.x, dw.N.y] }); r.wall = dw.id; r.broke = !!dw.broken; res.push(r); }
    // the lightest throwable (fastest: up to 22 m/s) at the same partition
    const ball = Sm.items.filter(i => i.mode === 'dynamic' && i.d && /ball/i.test(i.label || '')).sort((a, b) => a.mass - b.mass)[0];
    if (dw && ball) { const from = [dw.center.x + dw.N.x * 1.8, 0, dw.center.z + dw.N.y * 1.8]; const r = await throwAt(ball, from, [dw.center.x, 1.2, dw.center.z], { c: [dw.center.x, dw.center.z], n: [dw.N.x, dw.N.y] }); r.wall = dw.id + ' (' + ball.label + ')'; r.broke = !!dw.broken; res.push(r); }
    // exterior siding wall (no opening) from inside
    const ex = B.panels.find(p => p.ext && p.level === 0 && p.L > 1 && p.y0 < 0.3 && p.y1 > 2 && (inRoom(p.center.x + p.N.x * 1.8, p.center.z + p.N.y * 1.8, 0)));
    if (ex) { const from = [ex.center.x + ex.N.x * 1.8, 0, ex.center.z + ex.N.y * 1.8]; const r = await throwAt(it, from, [ex.center.x, 1.2, ex.center.z], { c: [ex.center.x, ex.center.z], n: [ex.N.x, ex.N.y] }); r.wall = ex.id; r.broke = !!ex.broken; res.push(r); }
    // a window from inside: it may break (then the stone may leave), never pass intact glass
    const w = [...B.openings.values()].find(o => o.type === 'window' && o.room && PL.ROOMS[o.room]?.level === 0 && !o.broken && inRoom(o.pos[0] - o.normal[0] * 1.8, o.pos[2] - o.normal[2] * 1.8, 0));
    if (w) { const from = [w.pos[0] - w.normal[0] * 1.8, 0, w.pos[2] - w.normal[2] * 1.8]; const r = await throwAt(it, from, [w.pos[0], w.pos[1], w.pos[2]], { c: [w.pos[0], w.pos[2]], n: [-w.normal[0], -w.normal[2]] }); r.wall = w.id; r.broke = !!B.openings.get(w.id).broken; res.push(r); }
    // held prop pressed into a wall: stand 0.45 m from a partition, facing it
    let held = null;
    if (dw) { const from = [dw.center.x + dw.N.x * 0.6, 0, dw.center.z + dw.N.y * 0.6]; window.__stand(from[0], 0, from[2], [dw.center.x - dw.N.x * 2, 1.2, dw.center.z - dw.N.y * 2], true);
      it.d.body.setTranslation({ x: from[0], y: 1.2, z: from[2] }, true); await sleep(300); Sm.hands.pickUp(it); await sleep(1500);
      const t = it.d.body.translation(); held = { thrower: 1, end: Math.sign((t.x - dw.center.x) * dw.N.x + (t.z - dw.center.z) * dw.N.y), broke: !!dw.broken }; Sm.hands.release(); }
    return { stone: it.label, res, held };
  });
  P({ phase: 'throw', ...rc });
  checks.noTunnel = !rc.err && rc.res.length >= 2 && rc.res.every(r => r.broke || r.end === r.thrower) && (!rc.held || rc.held.broke || rc.held.end === 1);

  // ---------------------------------------------------------------- (d) headlight vs garage door
  await ev(() => window.__sky.set({ weather: 'clear', tod: '00:30', frozen: true, instant: true }));
  const rd = await ev(async () => {
    const C = window.__cars; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); if (!C) return { err: 'no cars' };
    for (let i = 0; i < 40 && !C.cars.length; i++) await sleep(250);
    const car = C.cars[0]; if (!car) return { err: 'no car' };
    window.__stand(car.pos.x + 1.5, car.pos.y, car.pos.z, [car.pos.x, 1, car.pos.z]); await sleep(300);
    if (!C.enter(0, 0)) return { err: 'enter failed' }; await sleep(800);
    const gy = C.groundAt(15.3, -3.8, 6, car.body) ?? 0;
    car.body.setTranslation({ x: 15.3, y: gy + 0.7, z: -3.8 }, true); car.body.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true); car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    await sleep(1500);
    const h = C.headlight; const front = car.pos.z + car.size.z / 2; // door outer face z ≈ 0.35 + 0.3
    const r = { headlight: h, carFrontZ: +front.toFixed(2), toDoor: +(0.35 - front).toFixed(2) };
    return r;
  });
  await sleep(300); await shot('headlight_garage');
  P({ phase: 'headlight', ...rd });
  checks.headlight = !rd.err && !!rd.headlight && rd.headlight.intensity > 0 && rd.headlight.distance < rd.toDoor + 1.2;
  await ev(() => { window.__cars?.exit(); return true; }); await sleep(800);

  // ---------------------------------------------------------------- (e) shower spray in its enclosure
  await ev(() => window.__sky.set({ weather: 'clear', tod: '12:00', frozen: true, instant: true }));
  const re = await ev(async () => {
    const T = window.__taps, PL = await import('/src/plan.js'); const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const out = {};
    for (const id of ['bathA-hand', 'bathB-hand', 'bathC-hand', 'guest-hand', 'primary-hand', 'bathA-shower']) {
      const f = T.fixtures.find(x => x.id === id); T.set(id, true); await sleep(150); const inf = T.info(id); T.set(id, false);
      const r = PL.ROOMS[f.room].rect; const b = inf.box; const inside = !!b && b[0][0] >= r[0] - 0.05 && b[1][0] <= r[2] + 0.05 && b[0][2] >= r[1] - 0.05 && b[1][2] <= r[3] + 0.05;
      // old reach of the spray along its direction (no box): horizontal speed x time to the floor
      const vy = f.dir[1] * f.v, th = (vy + Math.sqrt(vy * vy + 2 * 9.81 * (f.tip[1] - f.land))) / 9.81; const reach = Math.hypot(f.dir[0], f.dir[2]) * f.v * th;
      out[id] = { box: b && b.map(v => v.map(x => +x.toFixed(2))), inRoom: inside, oldReach: +reach.toFixed(2) };
    }
    window.__stand(16.6, 3.35, 3.9, [15.9, 4.4, 3.2], false); T.set('bathA-hand', true); await sleep(1200);
    return out;
  });
  await shot('shower_bathA');
  await ev(() => { window.__taps.set('bathA-hand', false); return true; });
  P({ phase: 'shower', ...re });
  checks.shower = Object.values(re).every(r => r.box && r.inRoom);

  // ---------------------------------------------------------------- cost of the per-frame bits (storm, outdoors + indoors)
  const perf = await ev(async () => { const Pr = window.__prof; window.__sky.set({ weather: 'storm', tod: '00:30', frozen: true, instant: true }); window.__stand(11.8, 0, 15.2, [9, 1.4, 13.6]); await new Promise(r => setTimeout(r, 800));
    Pr.on = true; Pr.reset(); await new Promise(r => setTimeout(r, 3000)); const rep = Pr.report(); Pr.on = false; return { wall: rep.wallMsPerFrame, frames: rep.frames, rows: rep.rows.filter(([k]) => /sky|cars|taps|party|smash|cold|building/.test(k)).slice(0, 8) }; });
  P({ phase: 'perf', ...perf });
} catch (e) { logs.push('test: ' + (e.stack || e.message)); }
out.checks = checks; out.errors = logs.slice(0, 8); out.pass = Object.values(checks).length > 0 && Object.values(checks).every(Boolean) && !logs.length;
P(out);
await browser.close(); server.close(); process.exit(out.pass ? 0 : 1);
