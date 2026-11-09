#!/usr/bin/env node
// Drivable cars check (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/cars_test.mjs            solo: shots of the parked cars + close-ups, get in, drive 30 m along the street,
//                                       steer, brake, drift, first person, get out; night headlights; per-frame cost
//   node tools/cars_test.mjs --mp       2 players (+ a late joiner): A drives, B sees it smoothly and sees A seated,
//                                       B rides with A, C joins late and sees the car where A left it
//   --full                              load every piece (default: ?only=exterior,site for speed)
// Screenshots: shots/cars/*.png. Prints one JSON line per phase and a final {test, checks, errors}. Exit 1 on failure.
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
const SLOTS = Number(process.env.SHOT_SLOTS || 2); let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) {
  for (let i = 0; i < SLOTS && !slot; i++) { const d = path.join(LOCKS, 'slot' + i); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); } }
  if (!slot) await new Promise(r => setTimeout(r, 1500));
}
process.on('exit', () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 400) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext|youtube|googlevideo|doubleclick|ytimg|postMessage|\[lobbies\]/i;
const dir = path.join(ROOT, 'shots', 'cars'); fs.mkdirSync(dir, { recursive: true });
const ONLY = ARGS.has('--full') ? '' : '&only=exterior,site';
async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1${ONLY}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__cars, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => window.__cars.loading);
  await page.waitForFunction(() => window.__cars.cars.length && window.__cars.cars.every(c => c && c.ready), null, { timeout: 60000, polling: 250 });
  await sleep(800);
  return { name, page, logs };
}
const out = { test: ARGS.has('--mp') ? 'cars_mp' : 'cars' }; const checks = {};
const P = (o) => console.log(JSON.stringify(o));

// free camera still: pause the loop, place the camera, render, screenshot, resume
async function still(page, name, pos, look, fov = 50) {
  await page.evaluate(([pos, look, fov]) => { const d = window.__dbg; d.paused = true; d.camera.position.set(...pos); d.camera.fov = fov; d.camera.updateProjectionMatrix(); d.camera.lookAt(...look); d.camera.updateMatrixWorld(); d.render(); d.render(); }, [pos, look, fov]);
  await page.screenshot({ path: path.join(dir, name + '.png') });
  await page.evaluate(() => { const d = window.__dbg; d.camera.fov = 70; d.camera.updateProjectionMatrix(); d.paused = false; });
}
const st = (page, c) => page.evaluate((c) => window.__cars.state(c), c);
const STEER = "const V = car.pos.constructor, inv = car.quat.clone().invert(); const steerTo = (x, z) => { const l = new V(x, car.pos.y, z).sub(car.pos).applyQuaternion(inv); const a = Math.atan2(l.x, -l.z); return a < -0.04 ? { left: 1 } : a > 0.04 ? { right: 1 } : {}; };";
const autoF = (page, c, src) => page.evaluate(([c, src]) => { const car = window.__cars.cars.find(x => x.def.name === c); car.auto = new Function('return ' + src)(); }, [c, src]);
const auto = (page, c, src) => page.evaluate(([c, src]) => { const car = window.__cars.cars.find(x => x.def.name === c); car.auto = src ? new Function('h', 'car', 'return (' + src + ')(h, car)') : null; }, [c, src]);
// look at a car door from the side and press E like a player
async function getIn(page, c, seat = 0) {
  const ok = await page.evaluate(([c, seat]) => {
    const cars = window.__cars.cars, car = cars.find(x => x.def.name === c); const T = car.vis.group; const s = car.def.seats[seat]; const side = s[0] < 0 ? -1 : 1;
    const loc = (x, y, z) => { const v = T.position.clone(); const o = T.localToWorld(T.worldToLocal(v.clone()).set(x, y, z)); return o; };
    const stand = loc(side * (car.size.x / 2 + 1.1), 0, s[2]); const door = loc(side * (car.size.x / 2 + 0.02), s[1] + 0.45, s[2]);
    const P = window.__player; P.teleport(stand.x, car.pos.y + 0.05, stand.z, 0); P.state.thirdPerson = false;
    const dx = door.x - stand.x, dz = door.z - stand.z; P.state.yaw = Math.atan2(-dx, -dz); P.state.pitch = -0.35; return true;
  }, [c, seat]);
  await sleep(700);
  const focus = await page.evaluate(() => window.__interact.focused?.id || null);
  await page.keyboard.press('KeyE'); await sleep(500);
  return { focus, seat: await page.evaluate(() => window.__cars.mySeat) };
}

try {
  if (!ARGS.has('--mp')) {
    const A = await open('A', 'menu=0');
    const page = A.page;
    // ---- parked: overview + close-ups (day)
    await page.evaluate(() => window.__sky?.set?.({ tod: 0.45, weather: 'clear', instant: true }));
    await sleep(600);
    await still(page, 'parked_driveway', [8.5, 1.2, -14.5], [17.5, -0.2, -2.5], 50);
    await still(page, 'parked_street', [13.5, 0.8, -15.8], [10, -0.6, -9.6], 62);
    const homes = await page.evaluate(() => window.__cars.cars.map(c => ({ n: c.def.name, p: c.pos.toArray(), yaw: Math.atan2(-new window.__dbg.camera.position.constructor(0, 0, -1).applyQuaternion(c.quat).x, -new window.__dbg.camera.position.constructor(0, 0, -1).applyQuaternion(c.quat).z), tris: c.vis.tris })));
    out.parked = homes; P({ phase: 'parked', homes });
    for (const h of homes) {
      const f = [-Math.sin(h.yaw), -Math.cos(h.yaw)], r = [Math.cos(h.yaw), -Math.sin(h.yaw)];
      const sf = f[1] * 4.6 > 0 ? -1 : 1; // the street side (−z) of the car
      const cam = [h.p[0] + sf * f[0] * 4.6 + r[0] * 3.6, h.p[1] + 1.5, h.p[2] + sf * f[1] * 4.6 + r[1] * 3.6];
      await still(page, 'closeup_' + h.n, cam, [h.p[0], h.p[1] + 0.6, h.p[2]], 45);
    }
    // ---- frame cost while parked (main-loop profiler)
    const prof = async (ms) => page.evaluate(async (ms) => { const p = window.__prof; p.reset(); p.on = true; await new Promise(r => setTimeout(r, ms)); p.on = false; const rep = p.report(); return { frames: rep.frames, wall: rep.wallMsPerFrame, cars: rep.rows.filter(([k]) => /cars\//.test(k)).map(([k, v]) => [k, v]), phys: rep.rows.find(([k]) => k === 'phys.step')?.[1] }; }, ms);
    out.profParked = await prof(3000); P({ phase: 'prof_parked', ...out.profParked });

    // ---- get in the pickup on the street (driver door, E)
    const gi = await getIn(page, 'truck', 0); out.getIn = gi; P({ phase: 'get_in', ...gi });
    checks.focusDrive = gi.focus === 'car:truck:0'; checks.seated = gi.seat?.car === 'truck' && gi.seat?.i === 0;
    await page.evaluate(() => { window.__player.state.thirdPerson = true; });
    const s0 = await st(page, 'truck');
    // autopilot in phases (x along the street): pull into the lane at z=-13, steer left, steer right, straighten, brake
    let minY = 99, trace = [];
    const sample = async (tag) => { const s = await st(page, 'truck'); minY = Math.min(minY, s.pos[1]); trace.push({ tag, ph: await page.evaluate(() => window.__cars.cars.find(c => c.def.name === 'truck').autoPh), ...s }); return s; };
    await autoF(page, 'truck', `(() => { let ph = 0; return (h, car) => { ${STEER}
      const x = car.pos.x; if (ph === 0 && x > 8) ph = 1; if (ph === 1 && x > 14) ph = 2; if (ph === 2 && x > 20) ph = 3; if (ph === 3 && x > 27) ph = 4; car.autoPh = ph;
      if (ph === 0 || ph === 3) return { fwd: 1, ...steerTo(x + 9, -13) }; if (ph === 1) return { fwd: 1, left: 1 }; if (ph === 2) return { fwd: 1, right: 1 };
      return Math.abs(car.speed) > 0.3 ? { back: 1 } : {}; }; })()`);
    let s1 = null, s2 = null, s3 = null, shotT = false, fpT = false, tb = 0, stopT = 0;
    for (let i = 0; i < 80; i++) {
      await sleep(150); const s = await sample('run');
      if (s.pos[0] > 4 && !shotT) { shotT = true; await page.screenshot({ path: path.join(dir, 'drive_third.png') }); }
      if (trace.at(-1).ph === 1 && !s1) s1 = s; if (trace.at(-1).ph === 2 && !s2) s2 = s; if (trace.at(-1).ph === 3 && !s3) { s3 = s; await page.evaluate(() => { window.__player.state.thirdPerson = false; }); }
      if (trace.at(-1).ph === 3 && !fpT && s.pos[0] > 23) { fpT = true; await page.screenshot({ path: path.join(dir, 'drive_first.png') }); await page.evaluate(() => { window.__player.state.thirdPerson = true; }); }
      if (trace.at(-1).ph === 4 && !tb) { tb = Date.now(); out.topSpeed = s.speed; }
      if (tb && Math.abs(s.speed) < 0.4) { stopT = (Date.now() - tb) / 1000; break; }
    }
    await sleep(600); const s4 = await sample('stopped');
    out.profDriving = null;
    const dist = Math.hypot(s4.pos[0] - s0.pos[0], s4.pos[2] - s0.pos[2]);
    out.drive = { start: s0, leftAt: s1, rightAt: s2, straightAt: s3, stopped: s4, dist: +dist.toFixed(2), topSpeed: out.topSpeed, stopT, minY }; P({ phase: 'drive', ...out.drive });
    checks.drove30m = dist >= 30; checks.steered = !!(s1 && s2 && s3) && s2.yaw - s1.yaw > 0.05 && s3.yaw - s2.yaw < -0.05;
    checks.braked = stopT > 0 && stopT < 4; checks.upright = trace.every(s => s.up > 0.8); checks.neverUnderGround = minY > -1.4;
    // driving cost: steady cruise for 2 s
    await autoF(page, 'truck', `(() => (h, car) => { ${STEER} return car.pos.x < 60 ? { fwd: Math.abs(car.speed) < 9 ? 1 : 0, ...steerTo(car.pos.x + 9, -13) } : (Math.abs(car.speed) > 0.3 ? { back: 1 } : {}); })()`);
    await sleep(800); out.profDriving = await prof(2000); P({ phase: 'prof_driving', ...out.profDriving });
    await autoF(page, 'truck', `(() => (h, car) => (Math.abs(car.speed) > 0.3 ? { back: 1 } : {}))()`);
    await until(async () => Math.abs((await st(page, 'truck')).speed) < 0.3, 8000, 200); await sleep(400);
    // ---- get out: standing next to the car, free of geometry
    await page.keyboard.press('KeyE'); await sleep(700);
    const ex = await page.evaluate(() => { const P = window.__player, s = P.state, car = window.__cars.cars.find(c => c.def.name === 'truck'); const R = window.__cars.cars[0].body.constructor; const w = window.__dbg; const p = s.pos;
      const d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z); return { seated: !!s.seat, pos: p.toArray().map(v => +v.toFixed(2)), dist: +d.toFixed(2), grounded: s.grounded, mode: car.mode }; });
    await sleep(1200);
    const ex2 = await page.evaluate(() => { const s = window.__player.state, car = window.__cars.cars.find(c => c.def.name === 'truck'); return { pos: s.pos.toArray().map(v => +v.toFixed(2)), grounded: s.grounded, mode: car.mode, carY: +car.pos.y.toFixed(2) }; });
    out.getOut = { ...ex, after: ex2 }; P({ phase: 'get_out', ...out.getOut });
    checks.gotOut = !ex.seated && ex.dist > 1.0 && ex.dist < 4.0 && ex2.grounded && Math.abs(ex2.pos[1] - ex.pos[1]) < 0.6;
    checks.parkedAfter = ex2.mode === 'parked';
    await page.evaluate(() => { const s = window.__player.state; s.yaw += 0; }); await page.screenshot({ path: path.join(dir, 'got_out.png') });
    // ---- drift in the supercar: reverse out of the driveway into the street, turn to +x, accelerate, handbrake turn
    await getIn(page, 'super', 0); await page.evaluate(() => { window.__player.state.thirdPerson = true; });
    await autoF(page, 'super', `(() => { let ph = 0, t = 0; return (h, car) => { ${STEER} t += h; car.autoPh = ph;
      if (ph === 0) { if (car.pos.z < -12.6) ph = 1; return { back: 1 }; }
      if (ph === 1) { if (Math.abs(car.speed) < 0.3) ph = 2; return { fwd: 1 }; }
      if (ph === 2) { if (car.pos.x > 30) { ph = 3; t = 0; } return { fwd: 1, boost: 1, ...steerTo(car.pos.x + 12, -12.6) }; }
      if (ph === 3) { if (t > 0.9) ph = 4; return { fwd: 1, left: 1, hand: 1 }; }
      return Math.abs(car.speed) > 0.3 ? { back: 1 } : {}; }; })()`);
    let sd1 = null, sd2 = null; const dtr = [];
    for (let i = 0; i < 120; i++) { await sleep(120); const s = await st(page, 'super'); const ph = await page.evaluate(() => window.__cars.cars.find(c => c.def.name === 'super').autoPh); dtr.push([ph, s.pos[0], s.pos[2], s.yaw, s.speed, s.up]);
      if (ph === 3 && !sd1) { await sleep(250); await page.screenshot({ path: path.join(dir, 'drift.png') }); sd1 = await st(page, 'super'); }
      if (ph === 4 && Math.abs(s.speed) < 0.3) { sd2 = s; break; } }
    out.drift = { mid: sd1, end: sd2, trace: dtr.filter((_, i) => i % 4 === 0) }; P({ phase: 'drift', mid: sd1, end: sd2 });
    checks.driftUpright = !!sd1 && dtr.every(r => r[5] > 0.75);
    // ---- night headlights
    const hasSky = await page.evaluate(() => !!window.__sky);
    if (hasSky) {
      await page.evaluate(() => window.__sky.set({ tod: 0.93, weather: 'clear', instant: true })); await sleep(2500);
      await auto(page, 'super', '(h, car) => ({ back: 1 })'); await sleep(900); await auto(page, 'super', '(h, car) => ({})'); await sleep(300);
      const night = await page.evaluate(() => { const c = window.__cars.cars.find(x => x.def.name === 'super'); return { head: c.vis.mats.head.emissiveIntensity, tail: c.vis.mats.tail.emissiveIntensity }; });
      await page.screenshot({ path: path.join(dir, 'night_drive.png') });
      const sp = await st(page, 'super'); const f = [-Math.sin(sp.yaw), -Math.cos(sp.yaw)];
      await still(page, 'night_front', [sp.pos[0] + f[0] * 9 + f[1] * 2.5, sp.pos[1] + 1.4, sp.pos[2] + f[1] * 9 - f[0] * 2.5], [sp.pos[0], sp.pos[1] + 0.6, sp.pos[2]], 50);
      out.night = night; checks.nightLights = night.head > 1;
    }
    await page.keyboard.press('KeyE'); await sleep(500);
    out.errors = A.logs;
  } else {
    // ---------------------------------------------------------------- multiplayer
    const code = 'cars' + Math.random().toString(36).slice(2, 7);
    const A = await open('A', 'room=' + code), B = await open('B', 'room=' + code);
    const conn = await until(async () => { const [a, b] = await Promise.all([A.page.evaluate(() => window.__mp.members.size), B.page.evaluate(() => window.__mp.members.size)]); return a >= 1 && b >= 1; }, 90000, 1000);
    out.connected = !!conn; if (!conn) throw new Error('A and B did not connect within 90 s');
    await sleep(1500);
    // A gets in the pickup; B stands on the sidewalk watching
    const gi = await getIn(A.page, 'truck', 0); out.aIn = gi;
    await B.page.evaluate(() => { const P = window.__player; P.teleport(6, -0.8, -7.4, -Math.PI / 2 - 0.4); P.state.thirdPerson = true; P.state.pitch = -0.2; });
    await sleep(1500);
    const bSeat = await B.page.evaluate(() => window.__cars.state('truck').seats);
    checks.bSeesDriverClaim = !!bSeat[0];
    await Promise.all([A, B].map(X => X.page.evaluate(() => { window.__cars.rec.on = true; window.__cars.rec.car = window.__cars.cars.find(c => c.def.name === 'truck').i; window.__cars.rec.buf.length = 0; })));
    // human-like input: accelerate, a left and a right turn (held keys), then brake (--weave: rapid bang-bang steering)
    if (ARGS.has('--weave')) { await autoF(A.page, 'truck', `(() => (h, car) => { ${STEER} const x = car.pos.x; return x < 55 ? { fwd: Math.abs(car.speed) < 16 ? 1 : 0, ...steerTo(x + 9, -12.6 + 1.6 * Math.sin(x / 7)) } : (Math.abs(car.speed) > 0.3 ? { back: 1 } : {}); })()`); await sleep(4500); }
    else {
      await auto(A.page, 'truck', '(h, car) => ({ fwd: 1 })'); await sleep(2500);
      await auto(A.page, 'truck', '(h, car) => ({ fwd: 1, left: 1 })'); await sleep(1000);
      await auto(A.page, 'truck', '(h, car) => ({ fwd: 1, right: 1 })'); await sleep(1000);
    }
    await B.page.screenshot({ path: path.join(dir, 'mp_b_sees_a.png') });
    const bAvatar = await B.page.evaluate(() => { const car = window.__cars.cars.find(c => c.def.name === 'truck'); const r = [...window.__mp.peers.values()][0]; const cr = r?.creature?.root; if (!cr) return null; const s = car.def.seats[0]; const w = new car.pos.constructor(...s).applyQuaternion(car.quat).add(car.pos); return { pose: r.pose, err: +cr.position.distanceTo(w).toFixed(2), mode: car.mode }; });
    out.bAvatar = bAvatar; checks.bSeesASeated = !!bAvatar && bAvatar.pose === 'sit' && bAvatar.err < 1.0 && bAvatar.mode === 'remote';
    await auto(A.page, 'truck', '(h, car) => ({ back: 1 })'); await sleep(2500); await auto(A.page, 'truck', '(h, car) => ({})'); await sleep(800);
    // position error B vs A on the same wall clock
    const [ra, rb] = await Promise.all([A.page.evaluate(() => window.__cars.rec.buf.slice()), B.page.evaluate(() => window.__cars.rec.buf.slice())]);
    const at = (buf, t) => { let i = buf.findIndex(e => e[0] >= t); if (i <= 0) return null; const a = buf[i - 1], b = buf[i]; const f = (t - a[0]) / Math.max(1, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; };
    const errs = []; for (const e of rb) { if (e[0] < rb[0][0] + 600) continue; const a = at(ra, e[0]); if (a) errs.push(Math.hypot(a[0] - e[1], a[1] - e[2], a[2] - e[3])); }
    const worst = errs.map((e, i) => [e, i]).sort((x, y) => y[0] - x[0]).slice(0, 5); errs.sort((x, y) => x - y); const moved = ra.length ? Math.hypot(ra[ra.length - 1][1] - ra[0][1], ra[ra.length - 1][3] - ra[0][3]) : 0;
    out.sync = { samples: errs.length, moved: +moved.toFixed(1), median: +(errs[errs.length >> 1] || 0).toFixed(3), p95: +(errs[Math.floor(errs.length * 0.95)] || 0).toFixed(3), max: +(errs[errs.length - 1] || 0).toFixed(3), worstAt: worst.map(([e, i]) => [+e.toFixed(2), i]) };
    if (ARGS.has('--dump')) out.traces = { a: ra, b: rb };
    P({ phase: 'sync', ...out.sync }); checks.smoothSync = errs.length > 50 && out.sync.p95 < 0.5 && moved > 15;
    // B rides as passenger (once the pickup has stopped on B's screen)
    await until(async () => Math.abs((await st(B.page, 'truck')).speed) < 0.2, 10000, 250); await sleep(500);
    const bi = await getIn(B.page, 'truck', 1); out.bRide = bi; checks.bRides = bi.seat?.car === 'truck' && bi.seat?.i === 1;
    await sleep(1200);
    const seatsA = await A.page.evaluate(() => window.__cars.state('truck').seats); checks.aSeesPassenger = !!seatsA[1];
    const rideTrace = []; const tr = async (tag) => { const [a, b] = await Promise.all([st(A.page, 'truck'), st(B.page, 'truck')]); rideTrace.push([tag, a.pos, a.mode, b.pos, b.mode]); };
    await auto(A.page, 'truck', '(h, car) => ({ fwd: 1 })'); for (let i = 0; i < 5; i++) { await sleep(400); await tr('fwd'); }
    await auto(A.page, 'truck', '(h, car) => ({ fwd: 1, left: 1 })'); for (let i = 0; i < 3; i++) { await sleep(400); await tr('left'); }
    await auto(A.page, 'truck', '(h, car) => (Math.abs(car.speed) > 0.3 ? { back: 1 } : {})'); for (let i = 0; i < 6; i++) { await sleep(400); await tr('brake'); }
    out.rideTrace = rideTrace;
    const bRideState = await B.page.evaluate(() => { const s = window.__player.state; if (!s.seat) return { seated: false }; const car = window.__cars.cars.find(c => c.def.name === 'truck'); const w = new car.pos.constructor(...car.def.seats[1]).applyQuaternion(car.quat).add(car.pos); return { seated: !!s.seat, err: +w.distanceTo(new car.pos.constructor(...s.seat.pos)).toFixed(3), carMoved: +car.pos.distanceTo(car.homeP).toFixed(1) }; });
    await B.page.screenshot({ path: path.join(dir, 'mp_b_rides.png') });
    out.bRideState = bRideState; checks.bRidesAlong = bRideState.seated && bRideState.err < 0.05 && bRideState.carMoved > 10;
    // both get out; A's client parks the car and sends the rest pose
    await B.page.keyboard.press('KeyE'); await sleep(400); await A.page.keyboard.press('KeyE'); await sleep(2500);
    const restA = await st(A.page, 'truck'), restB = await st(B.page, 'truck');
    out.rest = { A: restA, B: restB }; checks.restAgrees = restA.mode === 'parked' && restB.mode === 'parked' && Math.hypot(restA.pos[0] - restB.pos[0], restA.pos[2] - restB.pos[2]) < 0.1;
    // late joiner
    const C = await open('C', 'room=' + code);
    await until(async () => (await C.page.evaluate(() => window.__mp.members.size)) >= 2, 90000, 1000);
    await sleep(3500);
    const restC = await st(C.page, 'truck'); out.lateJoiner = restC;
    checks.lateJoinerSeesCar = Math.hypot(restC.pos[0] - restA.pos[0], restC.pos[2] - restA.pos[2]) < 0.15 && Math.abs(restC.yaw - restA.yaw) < 0.02 && Math.hypot(restA.pos[0] + 1.6, restA.pos[2] + 9.65) > 3;
    out.errors = [...A.logs.map(x => 'A: ' + x), ...B.logs.map(x => 'B: ' + x), ...C.logs.map(x => 'C: ' + x)];
  }
} catch (e) { out.errors = [...(out.errors || []), 'test: ' + e.message]; }
out.checks = checks;
P({ test: out.test, checks, errors: out.errors || [] });
fs.writeFileSync(path.join(dir, out.test + '.json'), JSON.stringify(out, null, 1));
await browser.close(); server.close();
process.exit(Object.values(checks).some(v => !v) || (out.errors || []).length || !Object.keys(checks).length ? 1 : 0);
