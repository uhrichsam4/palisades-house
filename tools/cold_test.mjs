#!/usr/bin/env node
// Cold / weather-blowing-in / pool-ice check (src/cold). Headless Chrome, utility QoS, slot locks (SHOT_SLOTS=1).
//   node tools/cold_test.mjs       solo: idle perf (cold on vs off), sealed room stays warm in a blizzard, windward
//                                  window open chills it + snow blows in + drift/wet patch, body falls outside and
//                                  recovers inside, thin ice breaks under the player, thick ice holds. Shots in shots/cold/.
//   node tools/cold_test.mjs --mp  A + B agree on ice holes, shiver level synced, late joiner C gets the holes.
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
const dir = path.join(ROOT, 'shots', 'cold'); fs.mkdirSync(dir, { recursive: true });
const P = (o) => console.log(JSON.stringify(o));
const checks = {}; const out = { test: ARGS.has('--mp') ? 'cold_mp' : 'cold', shots: {} };

async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if ((m.type() === 'error' || /\[cold\]/.test(m.text())) && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1&quality=low`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction((off) => window.__ready === true && window.__player && window.__sky && (off || window.__cold), q.includes('cold=0'), { timeout: 300000, polling: 250 });
  await sleep(1500);
  return { name, page, logs };
}
const shot = async (pg, n) => { const f = path.join(dir, n + '.png'); await pg.page.screenshot({ path: f }); out.shots[n] = f; return f; };
const ev = (pg, fn, arg) => pg.page.evaluate(fn, arg);
const LOOK = `window.__look = (p, tp) => { const Pl = window.__player; const e = Pl.position.clone(); e.y += 1.62; const dx = p[0] - e.x, dy = p[1] - e.y, dz = p[2] - e.z; Pl.state.yaw = Math.atan2(-dx, -dz); Pl.state.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Pl.state.facing = Pl.state.yaw; Pl.state.thirdPerson = !!tp; }; window.__stand = (x, y, z, at, tp) => { window.__player.teleport(x, y + 0.02, z); window.__look(at, tp); }; true`;
const weather = (pg, w) => ev(pg, (w) => window.__sky.set({ weather: w, tod: '12:00', frozen: true, instant: true }), w);
async function perf(pg) { return ev(pg, async () => { const Pr = window.__prof; window.__stand(9.8, 0, 9.0, [9.8, 1.5, 6]); await new Promise(r => setTimeout(r, 800)); Pr.on = true; Pr.reset(); await new Promise(r => setTimeout(r, 3000)); const rep = Pr.report(); Pr.on = false; const cold = rep.rows.filter(([k]) => /cold\//.test(k)).reduce((a, [, v]) => a + v, 0); return { wall: rep.wallMsPerFrame, coldMs: +cold.toFixed(3), frames: rep.frames }; }); }

try {
  if (!ARGS.has('--mp')) {
    // perf idle: calm weather, everything closed, cold module on vs off
    const Z = await open('Z', 'menu=0&cold=0'); await ev(Z, LOOK); await weather(Z, 'clear'); const pOff = await perf(Z); await Z.page.close();
    const A = await open('A', 'menu=0'); await ev(A, LOOK); await weather(A, 'clear'); const pOn = await perf(A);
    checks.perfIdle = pOn.coldMs <= 0.3; P({ phase: 'perf-idle', off: pOff, on: pOn });
    await sleep(20000); // past load grace
    // 1. blizzard, sealed room stays warm
    await weather(A, 'blizzard'); await sleep(1500);
    const pick = await ev(A, () => { const S = window.__sky, B = window.__building; const wd = S.windDir; let best = null;
      for (const [id, op] of B.ops) { const r = B.openings.get(id); if (!r?.room || !r.normal || op.kind === 'garage' || window.__cold.roomTemp(r.room) === null) continue; if (/garage/.test(r.room)) continue; if (['kpantry', 'powder', 'store', 'pantry', 'wetbar'].includes(r.room) || r.area < 1.5) continue;  const f = wd.x * -r.normal[0] + wd.y * -r.normal[2]; if (r.pos[1] > 3) continue; if (!best || f > best.f) best = { id, room: r.room, f, pos: r.pos, normal: r.normal }; }
      return { best, wind: S.wind, windDir: [wd.x, wd.y], tempC: S.tempC, feelsC: S.feelsC, sev: S.severity, precip: S.precip }; });
    P({ phase: 'blizzard', ...pick }); const W = pick.best;
    await ev(A, (W) => { window.__cold.set({ room: { [W.room]: 21 }, body: 100 }); const inside = [W.pos[0] - W.normal[0] * 3.6, 0, W.pos[2] - W.normal[2] * 3.6]; window.__stand(inside[0], 0, inside[2], [W.pos[0], 1.3, W.pos[2]]); }, W);
    await sleep(10000);
    const sealed = await ev(A, (W) => ({ t: window.__cold.roomTemp(W.room), e: window.__cold.exposure(W.room), where: window.__cold.where, body: window.__cold.bodyTemp }), W);
    checks.sealedStaysWarm = sealed.t >= 20; P({ phase: 'sealed', ...sealed });
    // 2. open the windward window -> room drops; snow blows in, drift grows
    await ev(A, (W) => window.__building.setOpen(W.id, 1), W.id ? W : W); await sleep(15000);
    const opened = await ev(A, (W) => ({ t: window.__cold.roomTemp(W.room), e: window.__cold.exposure(W.room), emitters: window.__cold.emitters, patches: window.__cold.patches(), st: window.__cold.stats() }), W);
    checks.windwardOpenChills = opened.t < sealed.t - 3; checks.snowBlowsIn = opened.emitters.some(e => e.id === W.id) && opened.st.particles > 0; P({ phase: 'opened', ...opened });
    await shot(A, '03_snow_blowing_in');
    await ev(A, (W) => { window.__look([W.pos[0] - W.normal[0] * 1.1, 0, W.pos[2] - W.normal[2] * 1.1], false); }, W); await sleep(400); await shot(A, '04_snow_drift_floor');
    // rain + wet patch
    await weather(A, 'storm'); await sleep(14000); const wetP = await ev(A, () => window.__cold.patches()); checks.wetPatch = wetP.some(p => p.kind === 'wet' && p.amt > 0); P({ phase: 'storm', patches: wetP, em: await ev(A, () => window.__cold.emitters) });
    await ev(A, (W) => { window.__look([W.pos[0] - W.normal[0] * 1.1, 0, W.pos[2] - W.normal[2] * 1.1], false); }, W); await sleep(300); await shot(A, '05_wet_floor_patch');
    await ev(A, (W) => window.__building.setOpen(W.id, 0), W);
    // 3. body outside in a blizzard: falls; frost + chips + breath (third person)
    await weather(A, 'blizzard');
    await ev(A, () => { window.__cold.set({ body: 100, wet: 0 }); window.__stand(9.5, -0.1, 21.2, [9.5, 1.2, 25], true); }); await sleep(9000);
    const outB = await ev(A, () => window.__cold.stats()); P({ phase: 'outside', ...outB });
    await ev(A, () => window.__cold.set({ body: 22 })); await sleep(1200);
    await ev(A, () => { const Pl = window.__player; Pl.state.yaw = Pl.state.facing + Math.PI * 0.55; Pl.state.pitch = -0.15; }); await sleep(2600); await shot(A, '01_frost_chips_breath');
    const chips = await ev(A, () => [document.querySelector('#cold-temp')?.textContent, document.querySelector('#cold-body')?.textContent, getComputedStyle(document.querySelector('#cold-frost')).opacity]);
    checks.bodyFallsOutside = outB.body < 95; checks.chips = /TEMP::-?\d+°C/.test(chips[0] || '') && /FREEZING|COLD/.test(chips[1] || ''); P({ phase: 'chips', chips });
    // 4. recovers inside a sealed warm room
    await ev(A, () => { window.__cold.set({ body: 40, room: { office: 21 } }); window.__stand(19.9, 0, 8.9, [22, 1.4, 8.9]); }); await sleep(6000);
    const inB = await ev(A, () => window.__cold.stats()); checks.recoversInside = inB.body > 45; P({ phase: 'inside', ...inB });
    // 5. thin ice breaks (snow ≈ −3 °C, ice 3 cm)
    await weather(A, 'snow'); await ev(A, () => window.__cold.set({ ice: 3, body: 90 })); await sleep(1200);
    const ice0 = await ev(A, () => window.__cold.ice); P({ phase: 'ice-thin', ice: ice0 });
    await ev(A, () => { window.__stand(10.5, -0.6, 21.6, [12.5, -0.3, 24.5], false); }); await sleep(800); await shot(A, '06_thin_ice_pool');
    await ev(A, (top) => { window.__stand(12.6, top + 0.03, 24.2, [12.6, -0.3, 27], true); window.__player.state.pitch = -0.45; }, ice0.pool.top);
    await sleep(320); await shot(A, '07_ice_cracking');
    await sleep(1600); const brk = await ev(A, () => ({ ice: window.__cold.ice.pool, inWater: window.__player.state.inWater, swim: window.__player.state.swimming, y: window.__player.state.pos.y, body: window.__cold.bodyTemp }));
    await shot(A, '08_ice_hole_player_in_water');
    checks.thinIceBreaks = brk.ice.holes > 0 && brk.inWater; P({ phase: 'ice-break', ...brk });
    // 6. thick ice holds
    await weather(A, 'blizzard'); await ev(A, () => { window.__cold.set({ ice: 0 }); }); await sleep(500); await ev(A, () => window.__cold.set({ ice: 20 })); await sleep(800);
    const ice1 = await ev(A, () => window.__cold.ice.pool);
    await ev(A, (top) => { window.__stand(9.0, top + 0.03, 24.0, [12, -0.3, 24], true); }, ice1.top); await sleep(1200);
    const th = await ev(A, () => ({ ice: window.__cold.ice.pool, inWater: window.__player.state.inWater, y: window.__player.state.pos.y }));
    checks.thickIceHolds = th.ice.holes === 0 && !th.inWater && th.y > ice1.top - 0.15; P({ phase: 'ice-thick', ...th });
    await shot(A, '09_thick_ice');
    out.errors = A.logs.slice(0, 10); checks.noErrors = !A.logs.length;
  } else {
    const code = 'cold-' + process.pid;
    const A = await open('A', 'room=' + code), B = await open('B', 'room=' + code);
    const conn = await until(async () => (await ev(A, () => window.__mp.peers.size)) > 0 && (await ev(B, () => window.__mp.peers.size)) > 0, 90000, 1000);
    out.connected = !!conn; if (!conn) throw new Error('A and B did not connect within 90 s');
    await sleep(2500);
    await weather(A, 'snow'); await sleep(2500);
    for (const pg of [A, B]) await ev(pg, () => window.__cold.set({ ice: 3 }));
    await sleep(800);
    await ev(A, () => window.__cold.breakIce('pool', 12.0, 24.5)); await ev(A, () => window.__cold.breakIce('spa', 5.0, 26.3));
    const agree = await until(async () => { const a = await ev(A, () => window.__cold.iceHoles()), b = await ev(B, () => window.__cold.iceHoles()); return JSON.stringify(a) === JSON.stringify(b) && a.pool.length ? { a, b } : null; }, 5000, 150);
    checks.iceHolesAgree = !!agree; P({ phase: 'mp-ice', agree: !!agree, a: await ev(A, () => window.__cold.iceHoles()), b: await ev(B, () => window.__cold.iceHoles()) });
    await ev(A, () => window.__cold.set({ body: 8 })); await sleep(2500);
    const lv = await ev(B, () => window.__cold.peerLevels); checks.shiverSynced = Object.values(lv).some(v => v >= 2); P({ phase: 'mp-shiver', lv });
    const C = await open('C', 'room=' + code); await until(async () => (await ev(C, () => window.__mp.peers.size)) >= 2, 90000, 1000); await sleep(5000);
    await ev(C, () => window.__cold.set({ ice: 3 })); await sleep(500);
    const c = await ev(C, () => window.__cold.iceHoles()), a = await ev(A, () => window.__cold.iceHoles());
    checks.lateJoinerHoles = JSON.stringify(c) === JSON.stringify(a); P({ phase: 'mp-late', a, c });
    out.errors = [...A.logs, ...B.logs, ...C.logs].slice(0, 10); checks.noErrors = !out.errors.length;
  }
} catch (e) { out.fatal = e.stack || e.message; }
out.checks = checks; out.pass = !out.fatal && Object.values(checks).every(Boolean);
P(out);
await browser.close(); server.close(); process.exit(out.pass ? 0 : 1);
