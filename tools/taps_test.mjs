#!/usr/bin/env node
// Running-water taps check (headless Chrome, ONE browser, utility QoS, shared render-slot locks).
//   node tools/taps_test.mjs [--only=id,id] [--noshots] [--nosync] [--probes]
// 1. probe: raycast straight down from every fixture tip (src/taps/fixtures.js) -> the surface it hits vs `land`.
// 2. shots: per tap, first-person close-up with the prompt chip (before) then E pressed + running (after);
//    third-person for the kitchen sink and the Bath B shower. -> shots/taps/<id>_{before,on,tp}.jpg
// 3. sync: A + B in one room: A turns the kitchen tap on -> B sees it + has an active audio voice within 1 s;
//    a late C joins and sees it on; A turns it off -> off everywhere.
// Prints one JSON line per step and a final {test:'taps', checks, errors}. Exit 1 on failed checks / errors.
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 100) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed|youtube|googlevideo|doubleclick|ytimg|postMessage|\[lobbies\]/i;
const dir = path.join(ROOT, 'shots', 'taps'); fs.mkdirSync(dir, { recursive: true });
const checks = {}; const errors = {}; const only = opt.only ? opt.only.split(',') : null;
async function open(name, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = []; errors[name] = logs;
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__taps, null, { timeout: 180000, polling: 250 });
  await page.mouse.click(640, 400); await sleep(300); // the user gesture every real player has made
  return { name, page, logs };
}

try {
  // ------------------------------------------------------------------ 1 + 2: solo, probes on (real look)
  if (!opt.noshots || opt.probe) {
    const S = await open('solo', 'menu=0' + (opt.probes ? '' : '&noprobes=1'));
    const P = S.page;
    if (opt.probes) await P.waitForFunction(() => !!window.__probes, null, { timeout: 180000 }).catch(() => {});
    await sleep(1500);
    const probe = await P.evaluate(async () => {
      const THREE = await import('three'); const d = window.__dbg; const rc = new THREE.Raycaster(); rc.camera = d.camera; const meshes = []; d.scene.traverse(o => { if (o.isMesh && !o.isSprite) meshes.push(o); }); const out = [];
      const skip = (o) => { for (let p = o; p; p = p.parent) if (p.name === 'avatar' || p.name.startsWith('tap:')) return true; return false; };
      for (const f of window.__taps.fixtures) {
        const t = new THREE.Vector3().fromArray(f.tip);
        // stream: follow the arc's landing x/z (straight down from the tip for showers)
        let lx = t.x, lz = t.z;
        if (f.kind === 'sink' || f.kind === 'filler') { const vy = f.dir[1] * f.v, H = f.tip[1] - f.land, tf = (vy + Math.sqrt(vy * vy + 2 * 9.81 * H)) / 9.81; lx += f.dir[0] * f.v * tf; lz += f.dir[2] * f.v * tf; }
        rc.set(new THREE.Vector3(lx, t.y - 0.03, lz), new THREE.Vector3(0, -1, 0)); rc.far = 3;
        const hit = rc.intersectObjects(meshes, false).find(h => h.object.visible && !skip(h.object));
        // anything right above the tip (the spout itself should be within ~3 cm)
        rc.set(new THREE.Vector3(t.x, t.y + 0.25, t.z), new THREE.Vector3(0, -1, 0)); rc.far = 0.6;
        const top = rc.intersectObjects(meshes, false).find(h => h.object.visible && !skip(h.object));
        out.push({ id: f.id, land: f.land, hitY: hit ? +hit.point.y.toFixed(3) : null, dLand: hit ? +(hit.point.y - f.land).toFixed(3) : null, spoutAbove: top ? +(top.point.y - f.tip[1]).toFixed(3) : null, hitObj: hit?.object.name || '' });
      }
      return out;
    });
    for (const p of probe) console.log(JSON.stringify({ step: 'probe', ...p }));
    // these basins are inside-out (BackSide) boxes the raycast passes through: checked on the close-up shots instead
    const BACKSIDE = new Set(['bathA-sink', 'bathB-sink', 'guest-sink']);
    // hand showers spray sideways: straight down from the head is not where their water lands
    checks.landingsMatch = probe.every(p => (p.dLand !== null && Math.abs(p.dLand) < 0.04) || (BACKSIDE.has(p.id) && p.dLand < 0) || /-hand$/.test(p.id));
    if (!opt.noshots) {
      const R = await P.evaluate(async () => (await import('/src/plan.js')).ROOMS);
      const fx = (await P.evaluate(() => window.__taps.fixtures)).filter(f => !only || only.includes(f.id));
      const aim = (f, tgt, dist, third) => P.evaluate(({ f, tgt, dist, third, rect }) => {
        const Pl = window.__player, s = Pl.state; const fl = f.tip[1] > 3 ? 3.35 : 0;
        const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2; let dx = cx - f.tip[0], dz = cz - f.tip[2];
        if (f.kind !== 'sink' && f.kind !== 'filler') { dx = f.dir[0] || dx * 0.2; dz = f.dir[2] || dz * 0.2; } // showers: stand where the spray points
        const l = Math.hypot(dx, dz) || 1; const px = f.tip[0] + dx / l * dist, pz = f.tip[2] + dz / l * dist;
        Pl.teleport(px, fl + 0.02, pz); s.thirdPerson = !!third; s.camWant = 2.2;
        const ex = tgt[0] - px, ez = tgt[2] - pz, ey = tgt[1] - (fl + 1.62);
        s.yaw = Math.atan2(-ex, -ez) + (third ? 0.35 : 0); s.pitch = Math.atan2(ey, Math.hypot(ex, ez)) - (third ? 0.12 : 0); s.facing = s.yaw;
        return [px, pz];
      }, { f, tgt, dist, third, rect: R[f.room].rect });
      // hand-placed close-up cameras where the automatic placement can't see the water (tight showers, inside-out basins)
      const VIEW = {
        'bathA-sink': [[16.55, 4.7, 1.75], [16.0, 4.2, 1.44]], 'bathA-shower': [[16.48, 4.75, 4.38], [15.98, 4.55, 3.25]], 'bathA-hand': [[16.48, 4.75, 4.38], [15.98, 4.55, 3.25]],
        'guest-sink': [[7.6, 4.65, 6.55], [7.425, 4.2, 7.0]], 'guest-hand': [[6.4, 4.7, 6.35], [5.6, 4.85, 6.95]], 'primary-tub': [[19.4, 4.5, 16.6], [18.6, 3.75, 17.16]],
        'primary-shower': [[18.25, 4.8, 18.4], [17.2, 4.4, 17.17]], 'primary-hand': [[18.25, 4.8, 18.4], [17.2, 4.4, 17.17]],
      };
      const shots = [];
      for (const f of fx) {
        const sink = f.kind === 'sink' || f.kind === 'filler';
        const dist = sink ? 0.75 : 1.25;
        const look = f.heads ? f.heads[0] : f.tip; // the prompt lives on the head(s) / spout
        await aim({ ...f, tip: look }, look, dist, false); await sleep(900);
        const chip = await P.evaluate(() => { const e = document.getElementById('ix-prompt'); return e.classList.contains('on') ? e.textContent : ''; });
        const b = path.join(dir, f.id + '_before.jpg'); await P.screenshot({ path: b, type: 'jpeg', quality: 82 });
        await P.keyboard.press('KeyE'); await sleep(300);
        const mid = sink ? [f.tip[0], (f.tip[1] + f.land) / 2 + 0.05, f.tip[2]] : [f.tip[0] + f.dir[0] * 0.5, (f.tip[1] + f.land) / 2 + 0.2, f.tip[2] + f.dir[2] * 0.5];
        await aim(f, mid, dist, false); await sleep(1300);
        const st = await P.evaluate((id) => window.__taps.info(id), f.id);
        const a = path.join(dir, f.id + '_on.jpg'); await P.screenshot({ path: a, type: 'jpeg', quality: 85 });
        // free camera (loop paused for one frame): close-up of the whole fall, placed clear of walls
        const v = path.join(dir, f.id + '_view.jpg');
        await P.evaluate(async ({ f, rect, view }) => {
          const THREE = await import('three'); const d = window.__dbg;
          const sink = f.kind === 'sink' || f.kind === 'filler';
          const mid = new THREE.Vector3(f.tip[0] + f.dir[0] * (sink ? 0.05 : 0.35), (f.tip[1] + f.land) / 2 + (sink ? 0.0 : 0.1), f.tip[2] + f.dir[2] * (sink ? 0.05 : 0.35));
          const meshes = window.__tapMeshes ??= (() => { const a = []; d.scene.traverse(o => { if (o.isMesh && !o.isSprite && !o.name.startsWith('tap')) a.push(o); }); return a; })();
          const rc = new THREE.Raycaster(); rc.camera = d.camera; let best = null;
          const cx = (rect[0] + rect[2]) / 2 - f.tip[0], cz = (rect[1] + rect[3]) / 2 - f.tip[2];
          for (let k = 0; k < 16; k++) {
            const an = Math.atan2(cz, cx) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8; const dir = new THREE.Vector3(Math.cos(an), 0.18, Math.sin(an)).normalize();
            rc.set(mid, dir); rc.far = 2.2; const h = rc.intersectObjects(meshes, false).find(x => x.object.visible && !(x.object.material?.transparent));
            const free = h ? h.distance - 0.12 : 2.2; const want = sink ? 0.55 : 1.6;
            const score = Math.min(free, want) - k * 0.01; if (!best || score > best.score) best = { score, dir, dist: Math.min(free, want) };
          }
          d.paused = true; d.camera.position.copy(mid).addScaledVector(best.dir, best.dist); d.camera.lookAt(mid);
          if (view) { d.camera.position.fromArray(view[0]); d.camera.lookAt(view[1][0], view[1][1], view[1][2]); } d.camera.updateMatrixWorld(); d.render();
        }, { f, rect: R[f.room].rect, view: VIEW[f.id] || null });
        await P.screenshot({ path: v, type: 'jpeg', quality: 85 }); await P.evaluate(() => { window.__dbg.paused = false; });
        let tp = null;
        if (f.id === 'kitchen' || f.id === 'bathB-rain') { await aim(f, mid, sink ? 1.0 : 1.4, true); await sleep(1500); tp = path.join(dir, f.id + '_tp.jpg'); await P.screenshot({ path: tp, type: 'jpeg', quality: 85 }); }
        await P.evaluate((id) => window.__taps.set(id, false), f.id); await sleep(200);
        const r = { step: 'shot', id: f.id, chip, on: st.on, audio: st.audio, before: path.relative(ROOT, b), after: path.relative(ROOT, a), view: path.relative(ROOT, v), tp: tp && path.relative(ROOT, tp) };
        shots.push(r); console.log(JSON.stringify(r));
      }
      checks.chipShown = shots.every(s => /TURN ON (WATER|SHOWER)/.test(s.chip));
      checks.eTurnsOn = shots.every(s => s.on);
      // perf of the per-frame hook with kitchen + Bath B shower running
      await P.evaluate(() => { window.__taps.set('kitchen', true); window.__taps.set('bathB-rain', true); }); await sleep(1500);
      const ms = await P.evaluate(async () => { let a = 0, n = 0; for (let i = 0; i < 60; i++) { await new Promise(r => requestAnimationFrame(r)); a += window.__taps.frameMs; n++; } return a / n; });
      await P.evaluate(() => { window.__taps.set('kitchen', false); window.__taps.set('bathB-rain', false); }); await sleep(4000);
      const idle = await P.evaluate(() => window.__taps.running().length);
      console.log(JSON.stringify({ step: 'cpu', hookMsTwoRunning: +ms.toFixed(4), runningAfterOff: idle }));
      checks.cpuBudget = ms < 0.4; checks.idleAfterOff = idle === 0;
    }
    await P.close();
  }
  // ------------------------------------------------------------------ 3: sync
  if (!opt.nosync) {
    const code = 'taps' + Math.random().toString(36).slice(2, 7);
    const q = `room=${code}&only=kitchen,family&noprobes=1`;
    const A = await open('A', q), B = await open('B', q);
    const conn = await until(async () => (await A.page.evaluate(() => window.__mp.peers.size)) >= 1 && (await B.page.evaluate(() => window.__mp.peers.size)) >= 1, 90000, 1000);
    checks.connected = !!conn; if (!conn) throw new Error('A and B did not connect');
    await B.page.evaluate(() => { const P = window.__player; P.teleport(18.0, 0.02, 14.6); P.state.thirdPerson = false; P.state.yaw = Math.atan2(-(18.895 - 18.0), -(16.6 - 14.6)); P.state.pitch = -0.35; });
    await A.page.evaluate(() => window.__player.teleport(19.9, 0.02, 16.6, Math.PI / 2));
    await sleep(800);
    const t0 = Date.now(); await A.page.evaluate(() => window.__taps.set('kitchen', true));
    const seen = await until(() => B.page.evaluate(() => { const i = window.__taps.info('kitchen'); return i.on && i.visible && i.audio?.active ? i : null; }), 5000, 50);
    const lat = Date.now() - t0;
    console.log(JSON.stringify({ step: 'sync-on', latencyMs: lat, B: seen }));
    checks.bSeesAndHears = !!seen && lat <= 1000;
    await sleep(1200); await B.page.screenshot({ path: path.join(dir, 'sync_B.jpg'), type: 'jpeg', quality: 85 });
    const bAudio = await B.page.evaluate(() => window.__taps.info('kitchen').audio); console.log(JSON.stringify({ step: 'sync-audio-B', ...bAudio }));
    checks.bAudible = bAudio?.active && bAudio.gain > 0.05;
    const C = await open('C', q);
    const cConn = await until(() => C.page.evaluate(() => window.__mp.peers.size >= 2), 90000, 1000);
    const cOn = await until(() => C.page.evaluate(() => window.__taps.info('kitchen').on), 8000, 100);
    console.log(JSON.stringify({ step: 'late-join', connected: !!cConn, on: !!cOn, C: await C.page.evaluate(() => window.__taps.info('kitchen')) }));
    checks.lateJoinerSeesOn = !!cOn;
    // the newcomer's all-off state must not have switched anything off
    checks.joinKeepsOn = await A.page.evaluate(() => window.__taps.info('kitchen').on) && await B.page.evaluate(() => window.__taps.info('kitchen').on);
    await A.page.evaluate(() => window.__taps.set('kitchen', false));
    const offAll = await until(async () => { const r = await Promise.all([A, B, C].map(X => X.page.evaluate(() => window.__taps.info('kitchen').on))); return r.every(v => !v); }, 3000, 100);
    checks.offForAll = !!offAll;
    await sleep(3000);
    const after = await Promise.all([A, B, C].map(X => X.page.evaluate(() => ({ running: window.__taps.running(), audio: window.__taps.info('kitchen').audio }))));
    console.log(JSON.stringify({ step: 'sync-off', after }));
    checks.cleanAfterOff = after.every(x => !x.running.length && !x.audio?.nodes);
    for (const X of [A, B, C]) await X.page.close();
  }
} catch (e) { checks.threw = false; console.log(JSON.stringify({ error: e.stack || e.message })); }
const errs = Object.fromEntries(Object.entries(errors).filter(([, v]) => v.length));
checks.noErrors = !Object.keys(errs).length;
console.log(JSON.stringify({ test: 'taps', checks, errors: errs }));
await browser.close(); server.close();
process.exit(Object.values(checks).some(v => !v) ? 1 : 0);
