#!/usr/bin/env node
// House interactivity / destruction check (src/building). Headless Chrome, ONE browser, utility QoS, shared slot locks
// (use SHOT_SLOTS=1 on a busy Mac).
//   node tools/building_test.mjs        solo: window opens (inside + outside shots), garage up, a 1 kg stone thrown at a
//                                       window (physics contact) cracks/breaks it, 3 N·s tap vs 12 N·s, metal survives a
//                                       stone, drywall panel breaks after heavy hits + its collider is gone, exterior
//                                       wall hit by a car-sized impulse, two panels out -> the storey above collapses,
//                                       a car dent. Screenshots in shots/building/.
//   node tools/building_test.mjs --mp   A + B: window open sync, panel + glass breaks agree; late joiner C.
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
const dir = path.join(ROOT, 'shots', 'building'); fs.mkdirSync(dir, { recursive: true });
const P = (o) => console.log(JSON.stringify(o));
const checks = {}; const out = { test: ARGS.has('--mp') ? 'building_mp' : 'building', shots: {} };

const HELPERS = `(() => {
  const B = window.__building, Pl = window.__player, D = window.__damage, mp = window.__mp; const V = Pl.position.constructor;
  const ph = mp.ctx.phys, R = ph.RAPIER, W = ph.world;
  const look = (p) => { const e = Pl.position.clone(); e.y += 1.62; const dx = p[0] - e.x, dy = p[1] - e.y, dz = p[2] - e.z; Pl.state.yaw = Math.atan2(-dx, -dz); Pl.state.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Pl.state.facing = Pl.state.yaw; };
  const stand = (x, y, z, at, tp = false) => { Pl.teleport(x, y + 0.02, z); Pl.state.thirdPerson = tp; look(at); };
  // throw a 1 kg stone (r 0.07) from 'from' at 'to' with speed v (m/s)
  const stone = (from, to, v, mass = 1) => { const d = new V(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    const body = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...from).setCcdEnabled(true)); const c = W.createCollider(R.ColliderDesc.ball(0.07).setMass(mass).setRestitution(0.2), body);
    ph.claim(c, { kind: 'prop', by: mp.selfId || 'local' }); ph.watchImpacts(c, 50); body.setLinvel({ x: d.x * v, y: d.y * v, z: d.z * v }, true); return true; };
  const rayHits = (from, dirv, len) => { const h = W.castRay(new R.Ray({ x: from[0], y: from[1], z: from[2] }, { x: dirv[0], y: dirv[1], z: dirv[2] }), len, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, Pl.collider); return h ? +(h.timeOfImpact ?? h.toi).toFixed(3) : null; };
  window.__T = { B, Pl, D, mp, look, stand, stone, rayHits };
  return true; })()`;

async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if ((m.type() === 'error' || /\[building\]/.test(m.text())) && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}&noprobes=1&quality=low`, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForFunction((nb) => window.__ready === true && window.__player && (nb || window.__building), q.includes('building=0'), { timeout: 300000, polling: 250 }); }
  catch (e) { const st = await page.evaluate(() => ({ ready: window.__ready, errors: window.__errors, building: !!window.__building })).catch(() => null); throw new Error(name + ' not ready: ' + JSON.stringify(st) + ' logs: ' + logs.slice(0, 5).join(' | ')); }
  if (!q.includes('building=0')) await page.evaluate(HELPERS); await sleep(1200);
  return { name, page, logs };
}
const shot = async (pg, n) => { const f = path.join(dir, n + '.png'); await pg.page.screenshot({ path: f }); out.shots[n] = f; return f; };
const ev = (pg, fn, arg) => pg.page.evaluate(fn, arg);
const hpOf = (pg, id) => ev(pg, (id) => { const e = window.__damage.get(id); return e ? { hp: +e.hp.toFixed(1), max: +e.maxHp.toFixed(1), broken: e.broken } : null; }, id);

try {
  if (ARGS.has('--diag')) {
    const A = await open('A', 'menu=0&building=0'); await sleep(4000);
    out.drawCallsNoBuilding = await A.page.evaluate(async () => { const Pl = window.__player; Pl.teleport(4.5, 0.02, 11.5); Pl.state.thirdPerson = false; Pl.state.yaw = 0; Pl.state.pitch = -0.02; await new Promise(r => setTimeout(r, 1200)); return window.__dbg.renderer.info.render.calls; });
    P({ phase: 'diag', drawCalls: out.drawCallsNoBuilding, errors: A.logs });
  } else   if (!ARGS.has('--mp')) {
    const A = await open('A', 'menu=0');
    const calls = async (pg) => pg.page.evaluate(async () => { const T = window.__T; T.stand(4.5, 0, 11.5, [4.5, 1.4, 7.5]); await new Promise(r => setTimeout(r, 1200)); return window.__dbg.renderer.info.render.calls; });
    out.drawCalls = await calls(A);
    await sleep(Math.max(0, 26000)); // past the load grace
    P({ phase: 'loaded', drawCalls: out.drawCalls, log: await ev(A, () => window.__building.log.length), ...(await ev(A, () => window.__building.stats())), errors: await ev(A, () => window.__errors) });
    // 1. open a window (living-room front casement): inside + outside views
    const W1 = 'liv-front';
    const rec = await ev(A, (id) => { const r = window.__building.openings.get(id); return { ...r }; }, W1);
    await ev(A, ([id, r]) => { const T = window.__T; T.stand(r.pos[0] + 0.3, 0, r.pos[2] + 1.5, r.pos); }, [W1, rec]); await sleep(600);
    const prompt = await ev(A, () => document.getElementById('ix-prompt')?.textContent || '');
    await A.page.keyboard.press('KeyE'); await sleep(1600);
    const st1 = await ev(A, (id) => ({ open: window.__building.openings.get(id).open, isOpen: window.__building.isOpen(id) }), W1);
    checks.windowOpensWithE = st1.open > 0.95 && /OPEN WINDOW/.test(prompt); P({ phase: 'window-open', prompt, ...st1 });
    await shot(A, '01_window_open_inside');
    await ev(A, (r) => { const T = window.__T; T.stand(r.pos[0] - 1.2, -0.05, r.pos[2] - 3.4, [r.pos[0], r.pos[1], r.pos[2]]); }, rec); await sleep(700);
    await shot(A, '02_window_open_outside');
    await ev(A, (id) => window.__building.setOpen(id, 0), W1); await sleep(1500);
    checks.windowCloses = (await ev(A, (id) => window.__building.openings.get(id).open, W1)) === 0;
    // 2. garage door up
    await ev(A, () => window.__building.setOpen('g-door-2', 1)); await sleep(2600);
    await ev(A, () => { const T = window.__T; T.stand(15.3, -0.05, -7.5, [15.3, 1.6, 2.5]); }); await sleep(600);
    checks.garageUp = (await ev(A, () => window.__building.openings.get('g-door-2').open)) > 0.95; await shot(A, '03_garage_up');
    // 3. glass: 3 N·s tap does nothing, metal shrugs off a stone, a thrown 1 kg stone at 14 m/s breaks a window
    const W2 = 'liv-sw1';
    const tap = await ev(A, (id) => { const D = window.__damage; const e = D.get('glass:' + id); const h0 = e.hp; D.hit('glass:' + id, 3, { by: 'local' }); return { h0, h1: e.hp, broken: e.broken }; }, W2);
    checks.tapNoDamage = tap.h0 === tap.h1 && !tap.broken;
    const metal = await ev(A, () => { const D = window.__damage; const e = D.get('garage:g-door-1'); const h0 = e.hp; D.hit(e.id, 12, { by: 'local' }); return { h0, h1: e.hp, mat: e.material, min: e.min, concreteMin: D.MATERIALS.concrete.min }; });
    checks.metalSurvivesStone = metal.h0 === metal.h1; checks.concreteMinAboveStone = metal.concreteMin > 12;
    const r2 = await ev(A, (id) => ({ ...window.__building.openings.get(id) }), W2);
    await ev(A, (r) => { const T = window.__T; T.stand(r.pos[0] + 3.2, 0, r.pos[2] + 0.6, r.pos); }, r2); await sleep(500);
    // first a softer stone (cracks), then a hard one
    const g0 = await hpOf(A, 'glass:' + W2);
    await ev(A, (r) => window.__T.stone([r.pos[0] + 1.6, r.pos[1] + 0.1, r.pos[2] + 0.2], r.pos, 6.5, 1), r2); await sleep(700);
    const g1 = await hpOf(A, 'glass:' + W2); await shot(A, '04_glass_cracked');
    await ev(A, (r) => window.__T.stone([r.pos[0] + 1.6, r.pos[1] + 0.2, r.pos[2] - 0.2], r.pos, 14, 1), r2);
    const brk = await until(() => hpOf(A, 'glass:' + W2).then(h => h?.broken && h), 2500, 30); await sleep(160);
    await shot(A, '05_glass_shatter'); await sleep(1300); await shot(A, '06_glass_after');
    checks.stoneBreaksGlass = !!brk; P({ phase: 'glass', tap, metal, g0, afterSoft: g1, broke: !!brk, isOpen: await ev(A, (id) => window.__building.isOpen(id), W2) });
    // 4. drywall: heavy hits until it breaks, then the collider is gone (ray passes, player can walk through)
    const pid = await ev(A, () => window.__building.panels.find(p => p.wallKey === 'game-liv' && !p.header && p.y1 - p.y0 > 2.5)?.id);
    const pc = await ev(A, (id) => { const p = window.__building.byId.get(id); return { c: p.center.toArray(), n: [p.N.x, p.N.y], depth: p.depth }; }, pid);
    await ev(A, (pc) => { const T = window.__T; T.stand(pc.c[0] - 0.2, 0, 9.3, [pc.c[0], 1.4, pc.c[2]]); }, pc); await sleep(400);
    const rayBefore = await ev(A, (pc) => window.__T.rayHits([pc.c[0], 1.2, 9.5], [0, 0, -1], 4), pc);
    let hits = 0; for (; hits < 30; hits++) { const h = await ev(A, ([id, pc]) => { const D = window.__damage; D.hit(id, 60, { by: 'local', point: { x: pc.c[0] + (Math.random() - 0.5) * 0.6, y: 1.3 + Math.random() * 0.4, z: pc.c[2] + pc.depth / 2 }, dir: { x: 0, y: 0, z: -1 } }); const e = D.get(id); return e.broken; }, [pid, pc]); if (hits === 2) { await sleep(150); await shot(A, '07_drywall_cracked'); } if (h) break; await sleep(60); }
    await sleep(250); await shot(A, '08_drywall_hole');
    const rayAfter = await ev(A, (pc) => window.__T.rayHits([pc.c[0], 1.2, 9.5], [0, 0, -1], 4), pc);
    // walkable: rays at knee, chest and head height pass through the hole (the panel collider is gone)
    const rays = await ev(A, (pc) => [0.4, 1.2, 1.9].map(y => window.__T.rayHits([pc.c[0], y, pc.c[2] + 0.8], [0, 0, -1], 1.6)), pc);
    const zAfter = rays.every(r => r === null) ? pc.c[2] - 1 : pc.c[2];
    checks.drywallBreaks = hits >= 2 && hits < 30; checks.drywallColliderGone = rayBefore !== null && (rayAfter === null || rayAfter > rayBefore + 0.2); checks.walkThrough = zAfter < pc.c[2] - 0.2;
    P({ phase: 'drywall', rays, pid, hits: hits + 1, rayBefore, rayAfter, zAfter: +zAfter.toFixed(2), wallZ: pc.c[2] });
    // 5. exterior wall: car-sized impulse on two adjacent ground panels -> the panel above collapses
    const ext = await ev(A, () => { const B = window.__building; const S = B.supported();
      const cand = B.panels.filter(p => p.ext && p.level === 0 && !p.header && p.y0 < 0 && p.y1 > 3);
      for (const a of cand) { const b = cand.find(q => q.wallKey === a.wallKey && Math.abs(q.s0 - a.s1) < 0.02); if (!b) continue; const up = B.panels.filter(u => u.below.includes(a) && u.below.includes(b) || (u.below.includes(a) && u.below.every(x => x === a || x === b))); if (up.length) return { a: a.id, b: b.id, up: up.map(u => u.id), c: a.center.toArray(), n: [a.N.x, a.N.y] }; }
      return null; });
    P({ phase: 'ext-pick', ext });
    if (ext) {
      await ev(A, (x) => { const T = window.__T; const c = x.c; T.stand(c[0] - x.n[0] * 9, -0.05, c[2] - x.n[1] * 9, [c[0], 3.2, c[2]], false); }, ext); await sleep(500);
      await ev(A, (x) => { const D = window.__damage; const p = window.__building.byId.get(x.a); D.hit(x.a, 15000, { by: 'local', point: p.center, dir: { x: x.n[0], y: 0, z: x.n[1] }, source: { kind: 'car' } }); }, ext);
      await sleep(250); await shot(A, '09_exterior_hole');
      await ev(A, (x) => { const D = window.__damage; const p = window.__building.byId.get(x.b); D.hit(x.b, 15000, { by: 'local', point: p.center, dir: { x: x.n[0], y: 0, z: x.n[1] }, source: { kind: 'car' } }); }, ext);
      await sleep(620); await shot(A, '10_collapse_falling');
      await sleep(1600); await shot(A, '11_collapse_after');
      const st = await ev(A, () => window.__building.stats()); checks.collapse = st.collapsed > 0; P({ phase: 'collapse', ...st });
    }
    // 6. a car dent
    const dent = await ev(A, async () => { const C = window.__cars; if (!C) return { err: 'no cars' }; await C.loading; const car = C.cars.find(Boolean); if (!car) return { err: 'no car' };
      const s = car.size, c = car.ctr; window.__building.dent(car.def.name, [c.x, c.y + s.y * 0.1, c.z - s.z / 2], [0, 0, 1], 0.22); window.__building.dent(car.def.name, [c.x + s.x * 0.3, c.y + s.y * 0.15, c.z - s.z / 2], [0, 0, 1], 0.15);
      const p = car.pos; return { name: car.def.name, pos: p.toArray(), yaw: Math.atan2(-(new p.constructor(0, 0, -1).applyQuaternion(car.quat)).x, -(new p.constructor(0, 0, -1).applyQuaternion(car.quat)).z), len: s.z }; });
    P({ phase: 'dent', ...dent });
    if (dent && !dent.err) { await ev(A, (d) => { const T = window.__T; const fx = -Math.sin(d.yaw), fz = -Math.cos(d.yaw); const at = [d.pos[0] + fx * d.len / 2, d.pos[1] + 0.7, d.pos[2] + fz * d.len / 2]; T.stand(at[0] + fx * 3 + fz * 1.5, d.pos[1], at[2] + fz * 3 - fx * 1.5, at, false); }, dent); await sleep(700); await shot(A, '12_car_dent'); checks.carDent = (await ev(A, () => window.__building.dents.length)) >= 2; }
    // 7. repair
    await ev(A, () => window.__building.repair()); await sleep(600);
    const after = await ev(A, () => window.__building.stats()); checks.repair = after.broken === 0 && after.glassBroken === 0; P({ phase: 'repair', ...after });
    out.errors = A.logs.slice(0, 10); checks.noErrors = !A.logs.length;
  } else {
    const code = 'bldg-' + process.pid;
    const A = await open('A', 'room=' + code), B = await open('B', 'room=' + code);
    const conn = await until(async () => (await ev(A, () => window.__mp.peers.size)) > 0 && (await ev(B, () => window.__mp.peers.size)) > 0, 90000, 1000);
    out.connected = !!conn; if (!conn) throw new Error('A and B did not connect within 90 s');
    await sleep(2500);
    await ev(A, () => window.__building.setOpen('liv-front', 1));
    const bOpen = await until(() => ev(B, () => window.__building.ops.get('liv-front').target === 1), 4000, 100);
    checks.openSync = !!bOpen;
    const pid = await ev(A, () => window.__building.panels.find(p => p.wallKey === 'game-liv' && !p.header)?.id);
    await ev(A, (id) => window.__building.breakPanel(id), pid);
    await ev(A, () => window.__damage.hit('glass:liv-sw1', 40, { by: window.__mp.selfId, point: null }));
    const bBreak = await until(async () => (await hpOf(B, pid))?.broken && (await hpOf(B, 'glass:liv-sw1'))?.broken, 4000, 100);
    const bColl = await ev(B, (id) => window.__building.byId.get(id).collider === null, pid);
    checks.breaksAgree = !!bBreak && bColl; P({ phase: 'mp', openSync: !!bOpen, bBreak: !!bBreak, bColl });
    const C = await open('C', 'room=' + code);
    await until(async () => (await ev(C, () => window.__mp.peers.size)) >= 2, 90000, 1000); await sleep(5000);
    const c = await ev(C, (id) => ({ open: window.__building.ops.get('liv-front').target, panel: window.__damage.get(id)?.broken, panelCollider: window.__building.byId.get(id).collider === null, glass: window.__damage.get('glass:liv-sw1')?.broken }), pid);
    checks.lateJoiner = c.open === 1 && c.panel && c.panelCollider && c.glass; P({ phase: 'mp-late', ...c });
    out.errors = [...A.logs, ...B.logs, ...C.logs].slice(0, 10); checks.noErrors = !out.errors.length;
  }
} catch (e) { out.fatal = e.stack || e.message; }
out.checks = checks; out.pass = !out.fatal && Object.values(checks).every(Boolean);
P(out);
await browser.close(); server.close(); process.exit(out.pass ? 0 : 1);
