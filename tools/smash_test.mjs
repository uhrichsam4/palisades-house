#!/usr/bin/env node
// Movable / breakable world check (src/smash). Headless Chrome, ONE browser, utility QoS, shared render-slot locks.
//   node tools/smash_test.mjs          solo: pick up a garden stone, charge, throw it through a glass table and a
//                                      decanter (break), at the kitchen island + a concrete planter (no damage), into the
//                                      dining chairs (knocked over), punch a plate (shatters) and a chair (shoved), a heavy
//                                      hit splinters a wooden chair, debris fades. Screenshots in shots/smash/.
//   node tools/smash_test.mjs --mp     A + B in one lobby: A throws, B sees the same flight + the same break within
//                                      0.5 s, B agrees on rest poses (< 5 cm); late joiner C sees broken items gone and
//                                      moved props where they are.
// One JSON line per phase, then {test, checks, pass}. Exit 1 on failure.
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
const dir = path.join(ROOT, 'shots', 'smash'); fs.mkdirSync(dir, { recursive: true });
const P = (o) => console.log(JSON.stringify(o));
const checks = {}; const out = { test: ARGS.has('--mp') ? 'smash_mp' : 'smash' };

// page-side helpers (installed after load)
const HELPERS = `(() => {
  const S = window.__smash, Pl = window.__player, D = window.__damage, mp = window.__mp; const V = Pl.position.constructor;
  const ph = mp.ctx.phys, R = ph.RAPIER, W = ph.world;
  const items = () => S.items;
  const pos = (it) => { if (it.d) { const t = it.d.body.translation(); return new V(t.x, t.y, t.z); } return new V(...it.center); };
  const find = (re, f = () => true) => items().filter(i => re.test(i.label) && !i.broken && f(i));
  const floorAt = (x, z, y) => { const h = W.castRay(new R.Ray({ x, y: y + 1.6, z }, { x: 0, y: -1, z: 0 }), 4, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC, ph.groups(0xFFFF, 0xFFFF & ~0x4000), Pl.collider); return h ? y + 1.6 - (h.timeOfImpact ?? h.toi) : y; };
  // stand d metres from p (direction from p: angle a), first person, looking at p
  const standAt = (p, d, a, fp = true) => { const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; const y = floorAt(x, z, p.y); Pl.teleport(x, y + 0.02, z); Pl.state.thirdPerson = !fp; look(p); return [x, y, z]; };
  const look = (p) => { const e = Pl.position.clone(); e.y += 1.62; const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z; Pl.state.yaw = Math.atan2(-dx, -dz); Pl.state.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Pl.state.facing = Pl.state.yaw; };
  // put a prop in your hands (teleports it in front of you first)
  const grab = (it) => { const y = Pl.state.yaw; const t = { x: Pl.position.x - Math.sin(y) * 0.6, y: Pl.position.y + 1.1, z: Pl.position.z - Math.cos(y) * 0.6 }; it.d.body.setTranslation(t, true); it.d.body.setLinvel({ x: 0, y: 0, z: 0 }, true); return S.hands.pickUp(it); };
  const breaks = window.__breakT = window.__breakT || {}; if (!window.__breakHook) { window.__breakHook = D.onBreak((e) => { breaks[e.id] = Date.now(); }); }
  // the approach direction with the most free room around a target (rays from just above it, fixed colliders only)
  const freeAngle = (p, d) => { let best = 0, bl = -1; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; const h = W.castRay(new R.Ray({ x: p.x, y: p.y + 0.25, z: p.z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }), d + 1, true, R.QueryFilterFlags.EXCLUDE_SENSORS, ph.groups(0xFFFF, 0xFFFF & ~0x8000), undefined, undefined, (c) => { const it = S.S.byHandle.get(c.handle); return !(it && it.mode === 'dynamic' && it.d && it.d.body.translation && Math.hypot(it.d.body.translation().x - p.x, it.d.body.translation().z - p.z) < 0.05); }); const L = h ? (h.timeOfImpact ?? h.toi) : d + 1; if (L > bl) { bl = L; best = a; } } return best; };
  window.__T = { S, Pl, D, mp, items, pos, find, floorAt, standAt, look, grab, breaks, V, freeAngle };
  return true; })()`;

async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1&quality=low`, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForFunction(() => window.__ready === true && window.__player && window.__smash, null, { timeout: 300000, polling: 250 }); }
  catch (e) { const st = await page.evaluate(() => ({ ready: window.__ready, timing: window.__timing, errors: window.__errors, smash: !!window.__smash, status: document.getElementById('status')?.textContent })).catch(() => null); throw new Error(name + ' not ready: ' + JSON.stringify(st) + ' logs: ' + logs.slice(0, 5).join(' | ')); }
  await page.evaluate(HELPERS); await sleep(1500);
  return { name, page, logs };
}
const shot = (pg, n) => pg.page.screenshot({ path: path.join(dir, n + '.png') }).then(() => path.join(dir, n + '.png'));
const ev = (pg, fn, arg) => pg.page.evaluate(fn, arg);

// throw the held prop at a point (page side); returns { thrown, broke:[ids], dt }
async function throwAt(pg, stoneId, targetId, standD = 3.2, ang = null, aimDy = 0) {
  return ev(pg, async ([sid, tid, d, ang, aimDy]) => {
    const T = window.__T; const st = T.S.byId.get(sid), tg = T.S.byId.get(tid); if (!st || !tg) return { err: 'missing' };
    const p = T.pos(tg); p.y += aimDy; const a = ang ?? T.freeAngle(p, d);
    if (T.S.hands.heldItem) T.S.hands.release(true);
    T.standAt(p, d, a); await new Promise(r => setTimeout(r, 250)); T.look(p); T.grab(st); await new Promise(r => setTimeout(r, 450)); T.look(p);
    const hp0 = T.D.get(tid)?.hp; const t0 = Date.now(); const r = T.S.hands.throwHeld(1, p);
    return { thrown: r, hp0, t0, target: tg.label, mat: tg.material };
  }, [stoneId, targetId, standD, ang, aimDy]);
}
const hpOf = (pg, id) => ev(pg, (id) => { const e = window.__damage.get(id); return e ? { hp: +e.hp.toFixed(1), max: +e.maxHp.toFixed(1), broken: e.broken } : null; }, id);

try {
  if (!ARGS.has('--mp')) {
    const A = await open('A', 'menu=0');
    const inv = await ev(A, () => window.__smash.stats()); P({ phase: 'loaded', ...inv }); checks.registered = inv.items > 300;
    const ids = await ev(A, () => { const T = window.__T; const f = (re, g) => T.find(re, g).map(i => i.id);
      return { stones: T.find(/garden stone/).sort((a, b) => b.mass - a.mass).map(i => [i.id, i.mass]), glassTable: f(/glass table/)[0], decanter: T.find(/./, i => i.material === 'glass' && i.mode === 'dynamic' && i.mass >= 0.4).sort((a, b) => T.freeAngle && 0)[0]?.id,
        island: f(/kitchen island/, i => i.piece === 'kitchen')[0], planter: f(/concrete planter/)[0], chairs: f(/dining chair/).slice(0, 8), plate: f(/place setting|table settings|plate/)[0], vase: f(/^decor$|vase/, i => i.material === 'ceramic' && i.mode === 'dynamic')[0] }; });
    P({ phase: 'ids', ...ids });
    const stone = ids.stones.find(s => s[1] > 3 && s[1] < 6)?.[0] || ids.stones[0][0]; const big = ids.stones[0][0];

    // 1. pick up a garden stone like a player: look at it, E
    const pk = await ev(A, async (sid) => { const T = window.__T; const it = T.S.byId.get(sid); const p = T.pos(it); T.standAt(p, 1.1, 0.6); await new Promise(r => setTimeout(r, 300)); T.look(p); await new Promise(r => setTimeout(r, 500)); return { cand: T.S.hands.candidate, prompt: document.getElementById('ix-prompt')?.textContent }; }, stone);
    await A.page.keyboard.press('KeyE'); await sleep(600);
    const held = await ev(A, () => window.__smash.hands.heldItem?.id || null);
    checks.pickup = held === stone; P({ phase: 'pickup', ...pk, held });
    await ev(A, () => { const T = window.__T; const P = T.Pl.position.clone(); P.y += 1.2; const a = T.freeAngle(P, 3.5); T.Pl.state.thirdPerson = true; T.Pl.state.camWant = 2.4; T.Pl.state.yaw = Math.atan2(Math.cos(a), Math.sin(a)); T.Pl.state.pitch = -0.18; }); await sleep(1200);
    out.shots = { pickup: await shot(A, '01_pickup_stone') };
    await ev(A, () => window.__smash.hands.chargeRing(0.72)); await sleep(150);
    out.shots.charge = await shot(A, '02_charge_throw');
    await ev(A, () => { window.__smash.hands.chargeRing(null); window.__smash.hands.release(true); });

    // 2. stone through the glass coffee table (pool deck)
    if (ids.glassTable) {
      const r = await throwAt(A, stone, ids.glassTable, 3.0); P({ phase: 'throw-glass-table', ...r });
      const b = await until(() => hpOf(A, ids.glassTable).then(h => h?.broken && h), 2500, 40); await sleep(220);
      out.shots.glassTable = await shot(A, '03_glass_table_shatter'); checks.glassBreaks = !!b; P({ phase: 'glass-table', broken: !!b, hp: await hpOf(A, ids.glassTable) });
      await sleep(1200); out.shots.glassTable2 = await shot(A, '04_glass_table_after');
    }
    // 3. stone at a decanter (dynamic glass)
    if (ids.decanter) {
      const r = await throwAt(A, stone, ids.decanter, 2.6); const b = await until(() => hpOf(A, ids.decanter).then(h => h?.broken && h), 2500, 40); await sleep(200);
      out.shots.decanter = await shot(A, '05_decanter_shatter'); checks.decanterBreaks = !!b; P({ phase: 'decanter', target: r.target, broken: !!b });
    }
    // 4. the same stone at the kitchen island and a concrete planter: no damage
    for (const [k, id] of [['island', ids.island], ['planter', ids.planter]]) {
      if (!id) { checks[k + 'Unhurt'] = false; continue; }
      const r = await throwAt(A, stone, id, 2.6); await sleep(1600); const h = await hpOf(A, id);
      checks[k + 'Unhurt'] = !!h && h.hp === h.max && !h.broken; P({ phase: k, target: r.target, mat: r.mat, speed: r.thrown?.speed, ...h });
    }
    // 5. the big stone into the dining chairs: knocked over
    const chairIds = ids.chairs.slice(); /* the dining chairs themselves (ids.chairs grows with nearby props below) */
    if (ids.chairs.length) {
      const near = await ev(A, (id) => { const T = window.__T; const c = T.pos(T.S.byId.get(id)); return T.S.items.filter(i => i.mode === 'dynamic' && i.d && !/stone/.test(i.label) && T.pos(i).distanceTo(c) < 3).map(i => i.id); }, ids.chairs[0]); ids.chairs = [...new Set([...ids.chairs, ...near])];
      const before = await ev(A, (ids) => ids.map(id => window.__smash.pose(id)), ids.chairs);
      const r = await throwAt(A, stone, ids.chairs[0], 2.4, null, 0.2); await sleep(350); out.shots.chairs = await shot(A, '06_stone_hits_chairs'); await sleep(2500);
      const after = await ev(A, (ids) => ids.map(id => window.__smash.pose(id)), ids.chairs);
      const moved = before.map((b, i) => b && after[i] ? Math.hypot(b.p[0] - after[i].p[0], b.p[1] - after[i].p[1], b.p[2] - after[i].p[2]) : 0);
      checks.chairsKnocked = moved.some(m => m > 0.1); P({ phase: 'chairs', speed: r.thrown?.speed, moved: moved.map(m => +m.toFixed(2)) });
      out.shots.chairs2 = await shot(A, '07_chairs_after');
    }
    // 6. punch a plate / ceramic decor: shatters
    const cer = ids.plate || ids.vase;
    if (cer) {
      await ev(A, (id) => { window.__smash.hands.release(true); const T = window.__T; const it = T.S.byId.get(id); const p = T.pos(it); T.standAt(p, 0.75, 1.2); T.look(p); }, cer); await sleep(400);
      await ev(A, (id) => { const T = window.__T; T.look(T.pos(T.S.byId.get(id))); return T.S.hands.punch(); }, cer);
      const b = await until(() => hpOf(A, cer).then(h => h?.broken && h), 1500, 30); await sleep(150);
      out.shots.plate = await shot(A, '08_punch_ceramic_shatter'); checks.ceramicPunchBreaks = !!b; P({ phase: 'punch-ceramic', id: cer, broken: !!b, punch: await ev(A, () => window.__smash.S.lastPunch) });
    }
    // 7. punch shoves a chair
    /* punch a real dining chair (the last one: furthest from the stone's target), not a nearby napkin / vase */
    const ch = chairIds[chairIds.length - 1];
    if (ch) {
      const b0 = await ev(A, (id) => { const T = window.__T; const it = T.S.byId.get(id); const p = T.pos(it); p.y += 0.15; T.standAt(p, 0.95, T.freeAngle(p, 1.2)); T.look(p); return window.__smash.pose(id); }, ch); await sleep(500);
      out.shots.punchBefore = await shot(A, '09_punch_chair_before');
      await ev(A, (id) => { const T = window.__T; const p = T.pos(T.S.byId.get(id)); p.y += 0.15; T.look(p); T.S.hands.punch(); }, ch); await sleep(450);
      out.shots.punch = await shot(A, '10_punch_chair_shove'); await sleep(1500);
      const b1 = await ev(A, (id) => window.__smash.pose(id), ch);
      const d = Math.hypot(b0.p[0] - b1.p[0], b0.p[2] - b1.p[2]); checks.punchShoves = d > 0.05; P({ phase: 'punch-chair', moved: +d.toFixed(2), punch: await ev(A, () => window.__smash.S.lastPunch) });
    }
    // 8. a heavy hit (~180 N·s, a body slam / car) splinters a wooden chair
    const wc = ids.chairs[1];
    if (wc) {
      await ev(A, (id) => { const T = window.__T; const it = T.S.byId.get(id); const p = T.pos(it); T.standAt(p, 2.2, 2.0); T.look(p); }, wc); await sleep(400);
      const r = await ev(A, (id) => { const T = window.__T; const p = T.pos(T.S.byId.get(id)); return T.D.hit(id, 35, { by: T.mp.selfId, point: p })?.hp; }, wc);
      const light = await hpOf(A, wc);
      await ev(A, (id) => { const T = window.__T; const p = T.pos(T.S.byId.get(id)); p.y += 0.3; T.D.hit(id, 180, { by: T.mp.selfId, point: p, dir: { x: 0, y: -0.3, z: 1 } }); }, wc); await sleep(260);
      out.shots.splinter = await shot(A, '11_wood_chair_splinters'); const h = await hpOf(A, wc);
      checks.lightHitNoBreak = !light.broken; checks.heavyHitSplinters = h.broken; P({ phase: 'wood-chair', light, heavy: h, lastBreak: (await ev(A, () => window.__smash.stats())).lastBreak });
    }
    // 9. debris fades (8–20 s) and the pool empties
    const live0 = (await ev(A, () => window.__smash.stats())).fragments;
    await sleep(9000); out.shots.fading = await shot(A, '12_debris_fading'); const live1 = (await ev(A, () => window.__smash.stats())).fragments;
    await sleep(13000); const live2 = (await ev(A, () => window.__smash.stats())).fragments;
    checks.debrisFades = live0 > 0 && live2 === 0; P({ phase: 'debris', live0, live9s: live1, live22s: live2 });
    out.errors = A.logs.slice(0, 10); checks.noErrors = !A.logs.length;
  } else {
    const code = 'smash-' + process.pid;
    const A = await open('A', 'room=' + code), B = await open('B', 'room=' + code);
    const conn = await until(async () => (await ev(A, () => window.__mp.peers.size)) > 0 && (await ev(B, () => window.__mp.peers.size)) > 0, 90000, 1000);
    out.connected = !!conn; if (!conn) throw new Error('A and B did not connect within 90 s');
    await sleep(2000);
    const ids = await ev(A, () => { const T = window.__T; return { stone: T.find(/garden stone/).sort((a, b) => a.mass - b.mass).find(i => i.mass > 3).id, glass: T.find(/glass table/)[0]?.id, chair: T.find(/dining chair/)[0]?.id }; });
    // A throws the stone through the glass table; B replays it
    const r = await throwAt(A, ids.stone, ids.glass, 3.0);
    const flight = [];
    for (let i = 0; i < 6; i++) { await sleep(70); const [a, b] = await Promise.all([ev(A, (id) => window.__smash.pose(id), ids.stone), ev(B, (id) => window.__smash.pose(id), ids.stone)]); if (a && b) flight.push(+Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]).toFixed(2)); }
    await until(async () => (await hpOf(B, ids.glass))?.broken, 4000, 50);
    const [ta, tb] = await Promise.all([ev(A, (id) => window.__breakT[id] || null, ids.glass), ev(B, (id) => window.__breakT[id] || null, ids.glass)]);
    checks.bSeesBreak = !!ta && !!tb; checks.breakWithin500ms = !!ta && !!tb && Math.abs(tb - ta) <= 500;
    checks.sameFlight = flight.length > 0 && Math.max(...flight) < 0.6;
    P({ phase: 'mp-throw', thrown: r.thrown?.speed, flightErr: flight, breakA: ta, breakB: tb, dt: ta && tb ? tb - ta : null, remoteThrow: await ev(B, () => window.__smash.S.lastRemoteThrow || null) });
    // A punches a chair (moves it); wait for rest + rest message
    await ev(A, (id) => { const T = window.__T; const p = T.pos(T.S.byId.get(id)); p.y += 0.15; T.standAt(p, 0.95, 2.4); T.look(p); }, ids.chair); await sleep(500);
    await ev(A, (id) => { const T = window.__T; const p = T.pos(T.S.byId.get(id)); p.y += 0.15; T.look(p); T.S.hands.punch(); }, ids.chair);
    await sleep(6000);
    const poseErr = async (X, Y, id) => { const [a, b] = await Promise.all([ev(X, (id) => window.__smash.pose(id), id), ev(Y, (id) => window.__smash.pose(id), id)]); return a && b ? +Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]).toFixed(3) : null; };
    const eStone = await poseErr(A, B, ids.stone), eChair = await poseErr(A, B, ids.chair);
    checks.restAgree = eStone !== null && eStone < 0.05 && eChair !== null && eChair < 0.05;
    P({ phase: 'mp-rest', stoneErr: eStone, chairErr: eChair, netA: await ev(A, () => window.__smash.net.stats), netB: await ev(B, () => window.__smash.net.stats) });
    await shot(B, 'mp_B_view');
    // late joiner
    const C = await open('C', 'room=' + code);
    await until(async () => (await ev(C, () => window.__mp.peers.size)) >= 2, 90000, 1000); await sleep(5000);
    const cGlass = await hpOf(C, ids.glass); const cStone = await poseErr(A, C, ids.stone), cChair = await poseErr(A, C, ids.chair);
    checks.lateBroken = !!cGlass?.broken; checks.lateMoved = cStone !== null && cStone < 0.05 && cChair !== null && cChair < 0.05;
    P({ phase: 'mp-late', glass: cGlass, stoneErr: cStone, chairErr: cChair });
    out.errors = [...A.logs, ...B.logs, ...C.logs].slice(0, 10); checks.noErrors = !out.errors.length;
  }
} catch (e) { out.fatal = e.message; }
out.checks = checks; out.pass = !out.fatal && Object.values(checks).every(Boolean);
P(out);
await browser.close(); server.close(); process.exit(out.pass ? 0 : 1);
