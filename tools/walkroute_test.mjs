#!/usr/bin/env node
// Scripted walk through the whole house (src/smash walkability check). Headless Chrome, ONE browser, utility QoS.
//   node tools/walkroute_test.mjs [--fp] [--legs=N]
// Front walk -> foyer -> stairs up -> every upstairs room -> back down -> kitchen -> pool deck -> garage.
// The page builds a 2.5-D walk graph from the physics world (0.25 m cells, floor heights by ray casts, a player-sized
// capsule must fit; all doors opened first), A* between the stops, and the player's own autopilot follows the path with
// real keyboard-style input (W + yaw), at walking pace on stairs and a jog elsewhere.
// Recorded: stuck time (input held but < 0.15 m/s for > 0.4 s, summed), stair hops (airborne > 60 ms while on a
// stair run), stair up/down times, camera jumps (third person), unreachable stops.
// Prints one JSON line per leg and a final summary; pass = total stuck <= 0.5 s, no stair hops, no unreachable stops.
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
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?menu=0&noprobes=1&quality=low&nopost=1`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp, null, { timeout: 240000, polling: 250 });
await sleep(1500);

// stops: [name, x, y(level floor), z, pace] ; rooms by plan rect centre unless a point is given
const STOPS = [
  ['front-walk', 9.0, -0.8, -4.6], ['entry', 9.8, 0, 3.6], ['foyer', 9.4, 0, 6.2],
  ['stair-up', 9.8, 3.35, 8.6, 'stairs'], ['gallery', 9.6, 3.35, 7.0],
  ['hallEW', 12.0, 3.35, 10.95], ['bedA', 0, 3.35, 0, 'room'], ['bathA', 0, 3.35, 0, 'room'], ['bedB', 0, 3.35, 0, 'room'], ['closetB', 0, 3.35, 0, 'room'], ['bathB', 0, 3.35, 0, 'room'],
  ['theater', 0, 3.35, 0, 'room'], ['hallNS', 0, 3.35, 0, 'room'], ['primaryCloset', 0, 3.35, 0, 'room'], ['vestibule', 0, 3.35, 0, 'room'], ['primaryBath', 0, 3.35, 0, 'room'],
  ['primaryBed', 0, 3.35, 0, 'room'], ['balcony', 0, 3.35, 0, 'room'], ['hallC', 0, 3.35, 0, 'room'], ['guestBath', 0, 3.35, 0, 'room'], ['bedC', 0, 3.35, 0, 'room'], ['bathC', 0, 3.35, 0, 'room'],
  ['gallery2', 9.6, 3.35, 7.0], ['stair-down', 9.6, 0, 6.0, 'stairs'], ['kitchen', 0, 0, 0, 'room'], ['pool-deck', 12.0, -0.1, 24.2], ['garage', 0, 0, 0, 'room'],
];
const legs = opt.legs ? STOPS.slice(0, +opt.legs) : STOPS;

const prep = await page.evaluate(async ({ stops, fp }) => {
  const mp = window.__mp, ctx = mp.ctx, ph = ctx.phys, R = ph.RAPIER, W = ph.world, Pl = window.__player, plan = ctx.plan;
  for (const d of ctx.doors || []) { d.target = 1; if (d.collider) { ph.remove(d.collider); d.collider = null; } }
  await new Promise(r => setTimeout(r, 2500)); W.updateSceneQueries?.(); W.step();
  const G = ph.GROUPS || { PLAYER: 0x2000, PROPONLY: 0x4000, RAMP: 0x8000, ALL: 0xFFFF };
  const QG = ph.groups ? ph.groups(G.PLAYER, G.ALL & ~G.PROPONLY) : undefined;
  const fixedOnly = (c) => { const b = c.parent(); return !b || b.isFixed(); };
  const X0 = -1.5, X1 = 24.5, Z0 = -6.5, Z1 = 30, CS = 0.25; const NX = Math.ceil((X1 - X0) / CS), NZ = Math.ceil((Z1 - Z0) / CS);
  const cap = new R.Capsule(0.5, 0.26), ROT = { x: 0, y: 0, z: 0, w: 1 };
  const nodes = []; const at = new Map(); // key i,j -> [node idx]
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x = X0 + (i + 0.5) * CS, z = Z0 + (j + 0.5) * CS; const ys = [];
    for (const y0 of [5.9, 2.9]) { // under the upper ceiling (6.10) and under the ground ceiling (3.05)
      ray.origin.x = x; ray.origin.y = y0; ray.origin.z = z;
      const h = W.castRay(ray, y0 + 3, true, R.QueryFilterFlags.EXCLUDE_SENSORS, QG, Pl.collider, undefined, fixedOnly); if (!h) continue;
      const fy = y0 - (h.timeOfImpact ?? h.toi); if (fy < -2 || ys.some(y => Math.abs(y - fy) < 0.3)) continue;
      // standing room: capsule (feet 0.12 above floor) must be clear of fixed colliders
      let blocked = false;
      W.intersectionsWithShape({ x, y: fy + 0.14 + 0.26 + 0.5, z }, ROT, cap, (c) => { const b = c.parent(); if (b && !b.isFixed()) return true; { const tg = ph.tags.get(c.handle) || ''; if (tg.includes('proponly') || tg.startsWith('smash:tread') || tg.startsWith('smash:ramp')) return true; } blocked = true; return false; }, R.QueryFilterFlags.EXCLUDE_SENSORS, QG);
      if (blocked) continue; ys.push(fy);
    }
    for (const y of ys) { const k = i + ',' + j; const id = nodes.length; nodes.push({ i, j, x: X0 + (i + 0.5) * CS, y, z: Z0 + (j + 0.5) * CS }); (at.get(k) || at.set(k, []).get(k)).push(id); }
  }
  const nb = (n) => { const out = []; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const l = at.get((n.i + di) + ',' + (n.j + dj)); if (!l) continue; for (const m of l) { const o = nodes[m]; if (Math.abs(o.y - n.y) < 0.22) { if (di && dj) { const a = at.get((n.i + di) + ',' + n.j), b = at.get(n.i + ',' + (n.j + dj)); if (!a || !b) continue; } out.push(m); } } } return out; };
  // clearance: distance (cells) to the nearest missing neighbour, so paths keep off walls
  const clear = new Float32Array(nodes.length);
  for (let k = 0; k < nodes.length; k++) { const n = nodes[k]; let c = 3; for (let r = 1; r <= 3 && c === 3; r++) for (let di = -r; di <= r && c === 3; di++) for (let dj = -r; dj <= r; dj++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const l = at.get((n.i + di) + ',' + (n.j + dj)); if (!l || !l.some(m => Math.abs(nodes[m].y - n.y) < 0.4)) { c = r - 1; break; } } clear[k] = c; }
  const nearest = (x, y, z) => { let best = -1, bd = 1e9; const ci = Math.floor((x - X0) / CS), cj = Math.floor((z - Z0) / CS); for (let di = -10; di <= 10; di++) for (let dj = -10; dj <= 10; dj++) { const l = at.get((ci + di) + ',' + (cj + dj)); if (!l) continue; for (const m of l) { const n = nodes[m]; const d = Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 3 - clear[m] * 0.08; if (d < bd) { bd = d; best = m; } } } return best; };
  function astar(a, b) {
    const g = new Map([[a, 0]]), came = new Map(), open = [[0, a]]; const B = nodes[b]; const h = (k) => Math.hypot(nodes[k].x - B.x, nodes[k].z - B.z, nodes[k].y - B.y);
    let it = 0; while (open.length && it++ < 400000) {
      let bi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q; const [, cur] = open.splice(bi, 1)[0];
      if (cur === b) { const p = [cur]; let c = cur; while (came.has(c)) { c = came.get(c); p.push(c); } return p.reverse(); }
      for (const m of nb(nodes[cur])) { const step = Math.hypot(nodes[m].x - nodes[cur].x, nodes[m].z - nodes[cur].z) * (1 + (3 - clear[m]) * 0.6); const ng = g.get(cur) + step; if (ng < (g.get(m) ?? 1e9)) { g.set(m, ng); came.set(m, cur); open.push([ng + h(m), m]); } }
    }
    return null;
  }
  const goals = stops.map(([name, x, y, z, kind]) => { if (kind === 'room') { const r = plan.ROOMS[name].rect; x = (r[0] + r[2]) / 2; z = (r[1] + r[3]) / 2; } return { name, x, y, z, kind: kind || '', node: nearest(x, y, z) }; });
  window.__walk = { nodes, goals, astar, nearest };
  // start: at the first stop
  const s0 = nodes[goals[0].node]; Pl.teleport(s0.x, s0.y + 0.05, s0.z, 0); Pl.state.thirdPerson = !fp;
  return { nodes: nodes.length, goals: goals.map(g => [g.name, g.node >= 0 ? +nodes[g.node].x.toFixed(2) : null, g.node >= 0 ? +nodes[g.node].y.toFixed(2) : null, g.node >= 0 ? +nodes[g.node].z.toFixed(2) : null]) };
}, { stops: legs, fp: !!opt.fp });
console.log(JSON.stringify({ phase: 'graph', ...prep }));

// walk each leg with the player's autopilot
const total = { stuck: 0, hops: 0, unreachable: [], camJumps: 0, legs: [] };
for (let k = 1; k < legs.length; k++) {
  const r = await page.evaluate(async ({ k }) => {
    const { nodes, goals, astar } = window.__walk; const Pl = window.__player, st = Pl.state; const cam = window.__dbg.camera;
    const a0 = window.__walk.nearest(st.pos.x, st.pos.y, st.pos.z); const g = goals[k];
    const path = g.node >= 0 && a0 >= 0 ? astar(a0, g.node) : null; if (!path) return { leg: g.name, unreachable: true };
    const pts = path.map(i => nodes[i]);
    const onStair = (p) => p.x > 9.95 && p.x < 11.17 && p.z > 5.5 && p.z < 10.3;
    const R = { leg: g.name, n: pts.length, t: 0, stuck: 0, hops: 0, maxAir: 0, stairT: 0, camJumps: 0, teleports: 0, len: 0 };
    let idx = 0, still = 0, air = 0, prevCam = cam.position.clone(), prevCamV = null, last = st.pos.clone(), noProg = 0;
    const walkPace = g.kind === 'stairs';
    await new Promise((resolve) => {
      const t0 = performance.now(); let lt = t0;
      st.autopilot = (dt) => {
        const now = performance.now(); R.t = (now - t0) / 1000;
        while (idx < pts.length - 1 && Math.hypot(pts[idx].x - st.pos.x, pts[idx].z - st.pos.z) < 0.5) idx++;
        let la = idx; while (la < pts.length - 1 && Math.hypot(pts[la].x - st.pos.x, pts[la].z - st.pos.z) < 0.9) la++;
        const tg = pts[la]; const dx = tg.x - st.pos.x, dz = tg.z - st.pos.z; const dist = Math.hypot(dx, dz);
        if (idx >= pts.length - 1 && dist < 0.35) { st.autopilot = null; st.keys.clear(); resolve(); return { mx: 0, mz: 0 }; }
        const want = Math.atan2(-dx, -dz); let d = want - st.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); st.yaw += d * Math.min(1, dt * 10);
        // metrics
        const sp = st.speed; if (sp < 0.15) still += dt; else { if (still > 0.4) R.stuck += still; still = 0; }
        const stair = onStair(st.pos); if (stair) R.stairT += dt;
        if (!st.grounded && !st.swimming) air += dt; else { if (air > 0.06 && stair) R.hops++; R.maxAir = Math.max(R.maxAir, air); air = 0; }
        const cv = cam.position.clone().sub(prevCam); const pv = st.pos.clone().sub(last); if (prevCamV && cv.sub(pv).length() > 0.25) R.camJumps++; prevCamV = true; prevCam.copy(cam.position);
        R.len += st.pos.distanceTo(last); last.copy(st.pos);
        R.prog = R.prog || { d: 1e9, t: 0 }; const dg = Math.hypot(pts[pts.length - 1].x - st.pos.x, pts[pts.length - 1].z - st.pos.z, pts[pts.length - 1].y - st.pos.y);
        if (dg < R.prog.d - 0.5) { R.prog.d = dg; R.prog.t = 0; } else { R.prog.t += dt; if (R.prog.t > 5) { R.noProgress = (R.noProgress || 0) + 1; R.stuck += R.prog.t; R.prog.t = 0; const n = pts[Math.min(pts.length - 1, idx + 6)]; Pl.teleport(n.x, n.y + 0.05, n.z); } }
        if (still > 3) { // hopelessly stuck: note it and move on
          R.teleports++; const n = pts[Math.min(pts.length - 1, idx + 4)]; Pl.teleport(n.x, n.y + 0.05, n.z); R.stuck += still; still = 0;
        }
        if (R.t > 90) { st.autopilot = null; resolve(); return { mx: 0, mz: 0 }; }
        return { mx: 0, mz: 1, run: !walkPace && !stair };
      };
    });
    if (still > 0.4) R.stuck += still;
    R.t = +R.t.toFixed(2); R.stuck = +R.stuck.toFixed(2); R.stairT = +R.stairT.toFixed(2); R.len = +R.len.toFixed(1); R.maxAir = +R.maxAir.toFixed(2);
    R.end = [st.pos.x, st.pos.y, st.pos.z].map(v => +v.toFixed(2)); return R;
  }, { k });
  console.log(JSON.stringify(r));
  if (r.unreachable) total.unreachable.push(r.leg); else { total.stuck += r.stuck; total.hops += r.hops; total.camJumps += r.camJumps; total.legs.push([r.leg, r.t, r.stuck, r.hops]); }
  if (r.leg === 'stair-up') total.stairUp = r.stairT; if (r.leg === 'stair-down') total.stairDown = r.stairT;
}
total.stuck = +total.stuck.toFixed(2);
const pass = total.stuck <= 0.5 && total.hops === 0 && !total.unreachable.length && !errs.length;
console.log(JSON.stringify({ test: 'walkroute', stuckTotal: total.stuck, stairHops: total.hops, stairUpS: total.stairUp, stairDownS: total.stairDown, camJumps: total.camJumps, unreachable: total.unreachable, errors: errs.slice(0, 5), pass }));
await browser.close(); server.close(); process.exit(pass ? 0 : 1);
