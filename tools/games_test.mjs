#!/usr/bin/env node
// Games hub + party games test (src/games): ONE headless Chrome, three pages (A, B, C) in the same ?room= over the
// real relays.   node tools/games_test.mjs [--full]   (default ?only=family,kitchen,pool,exterior,site&noprobes=1)
// Durations are shortened through start(game, opts). Round games start with the ready-up lobby: the starter is in
// (WAITING), others see "… started X — press J to join", join + ready (J / __games.join() / ready()); all ready →
// 3-2-1 → teleported. Checks: hub panel (registry cards incl. Pool + Ping-pong), lobby with 3 players (one READY,
// one WAITING) + countdown + teleported start (Tag), Cash Grab (invite card, sit out, contested pickup claimed once, scores and
// winner equal everywhere), Tag (transfer on touch, new It frozen, tag-back immunity), Hide & Seek (seeker
// frozen + blackout, hider name tags hidden, tag converts, last hider wins), Musical Chairs (3 players /
// 2 chairs: two sit, one out, next round 1 chair), host leaves mid-game (game continues). Screenshots in shots/.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
if (!process.env.SHOT_NICE && process.platform === 'darwin') {
  const r = spawnSync('taskpolicy', ['-c', 'utility', process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, SHOT_NICE: '1' } });
  process.exit(r.status ?? 1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const LOCKS = path.join(ROOT, 'shots', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let slot = null; const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
while (!slot) { const d = path.join(LOCKS, 'slot0'); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); slot = d; } catch { let pid = 0; try { pid = +fs.readFileSync(path.join(d, 'pid'), 'utf8'); } catch {} if (pid && !alive(pid)) fs.rmSync(d, { recursive: true, force: true }); else await new Promise(r => setTimeout(r, 1500)); } }
process.on('exit', () => fs.rmSync(slot, { recursive: true, force: true }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4', '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT, u); if (u.endsWith('/')) f = path.join(f, 'index.html'); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const IGNORE = /\/src\/smash\/|\/src\/building\/|THREE\.Clock|GPU stall|WebGL: INVALID|Automatic fallback|relay|wss:|WebSocket|nostr|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|ERR_BLOCKED|net::|AudioContext was not allowed|youtube|\[lobbies\]/i;
const code = 'games' + Math.random().toString(36).slice(2, 7);
const SHOTS = path.join(ROOT, 'shots');
async function open(name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !IGNORE.test(m.text()) && !IGNORE.test(url)) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?room=${code}${opt.full ? '' : '&only=family,kitchen,pool,exterior,site'}&noprobes=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true && window.__player && window.__mp, null, { timeout: 180000, polling: 250 });
  await page.waitForFunction(() => window.__games, null, { timeout: 30000, polling: 250 });
  return { name, page, logs };
}
const G = (P, expr) => P.page.evaluate(new Function('return (' + expr + ')'));
const st = (P) => P.page.evaluate(() => window.__games.state);
const tp = (P, x, y, z, yaw = 0) => P.page.evaluate(([x, y, z, yaw]) => window.__player.teleport(x, y, z, yaw), [x, y, z, yaw]);
const shot = async (P, n) => { await P.page.screenshot({ path: path.join(SHOTS, n) }); return 'shots/' + n; };
const res = { test: 'games', room: code, shots: {} }; const checks = {}; let bad = false;
// ready-up lobby helper: host starts, joiners join, readiers ready (host included if listed)
async function lobby(host, game, opts, joiners, readiers) {
  await host.page.evaluate(([g, o]) => window.__games.start(g, o), [game, opts]);
  for (const P of joiners) { if (P === host) continue; await until(() => G(P, "window.__games.phase === 'lobby'"), 8000, 150); await P.page.evaluate(() => window.__games.join()); }
  await until(async () => (await host.page.evaluate(() => window.__games.state?.players?.length || 0)) >= joiners.length, 8000, 150);
  for (const P of readiers) { await until(() => G(P, 'window.__games.in'), 6000, 100); await P.page.evaluate(() => window.__games.ready(true)); }
}
try {
  const A = await open('A'), B = await open('B'), C = await open('C'); const ALL = [A, B, C];
  res.connected = !!(await until(async () => (await Promise.all(ALL.map(P => P.page.evaluate(() => window.__mp.members.size)))).every(n => n >= 2), 120000, 1000));
  if (!res.connected) throw new Error('pages did not connect over the relays within 120 s');
  const ids = {}; for (const P of ALL) ids[P.name] = await G(P, 'window.__games.me');
  res.ids = ids; await sleep(1500);

  // ---------------------------------------------------------------- panel screenshot
  await A.page.keyboard.press('KeyJ'); await sleep(700);
  await until(() => G(A, "document.querySelectorAll('#pg-grid .pg-card').length >= 6"), 8000, 200);
  checks.panelOpens = await G(A, "window.__games.panelOpen && document.querySelectorAll('#pg-grid .pg-card').length >= 6 && /Pool/.test(document.getElementById('pg-grid').textContent) && /Ping-pong/.test(document.getElementById('pg-grid').textContent)");
  res.cards = await G(A, "[...document.querySelectorAll('#pg-grid .pg-card h3')].map(h => h.textContent)");
  res.shots.panel = await shot(A, 'games_panel.png');
  await A.page.keyboard.press('KeyJ'); await sleep(400);
  checks.hudButton = await G(A, "!!document.querySelector('#tb-btns button[title=Games]')");

  // ---------------------------------------------------------------- READY-UP LOBBY (Tag): 3 players, one READY, one WAITING
  await A.page.evaluate(() => window.__games.start('tag', { dur: 8000, lobby: 30000 }));
  await until(() => G(B, "window.__games.phase === 'lobby'"), 8000, 150);
  for (const P of [B, C]) { await P.page.keyboard.press('KeyJ'); } // J = join
  await until(() => G(A, "window.__games.state.players.length === 3"), 8000, 150);
  await until(() => G(B, "window.__games.in"), 6000, 100);
  await B.page.keyboard.press('KeyJ'); // J again = ready
  await until(() => G(A, "Object.values(window.__games.state.ready).filter(Boolean).length === 1"), 6000, 150);
  await sleep(900);
  const lb = await G(A, "({ on: document.getElementById('pg-lobby').classList.contains('on'), cards: document.querySelectorAll('#pg-lb-cards .pg-lc').length, ready: document.querySelectorAll('#pg-lb-cards .pg-lc.ready').length })");
  res.lobby = lb; checks.lobby3 = lb.on && lb.cards === 3 && lb.ready === 1;
  res.shots.lobby = await shot(A, 'games_lobby.png');
  await until(() => G(C, "window.__games.in"), 6000, 100);
  await A.page.evaluate(() => window.__games.ready(true)); await C.page.evaluate(() => window.__games.ready(true));
  const cnt = await until(() => G(C, "window.__games.phase === 'count' && document.getElementById('pg-count').classList.contains('on')"), 6000, 50);
  await sleep(350); res.shots.countdown = await shot(C, 'games_countdown.png'); checks.countdown = !!cnt;
  await until(() => G(A, "window.__games.phase === 'play'"), 6000, 100); await sleep(900);
  const sp = await G(A, "(() => { const s = window.__games.state; const p = window.__player.state.pos; const q = s.spawn[window.__games.me]; return { d: Math.hypot(p.x - q[0], p.z - q[2]), players: s.players.length }; })()");
  res.teleported = sp; checks.teleported = sp.d < 1.5 && sp.players === 3;
  res.shots.started = await shot(A, 'games_started.png');
  await A.page.evaluate(() => window.__games.stop());
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end' || p === 'idle'), 8000);
  for (const P of ALL) await P.page.evaluate(() => window.__games.dismissEnd());
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'idle'), 20000, 500);

  // ---------------------------------------------------------------- CASH GRAB
  await A.page.evaluate(() => window.__games.start('cash', { dur: 16000 }));
  const inv = await until(() => G(B, "document.getElementById('pg-invite').classList.contains('on') && document.getElementById('pg-inv-title').textContent"), 6000);
  res.cashInvite = inv; checks.inviteShown = !!inv && /CASH GRAB/.test(inv) && /press J to join/.test(inv);
  await sleep(500); res.shots.invite = await shot(B, 'games_invite.png');
  await B.page.evaluate(() => window.__games.join()); // C never joins (sits out)
  await until(() => G(A, "window.__games.state.players.length === 2"), 6000, 150);
  await until(() => G(B, 'window.__games.in'), 6000, 100);
  await A.page.evaluate(() => window.__games.ready(true)); await B.page.evaluate(() => window.__games.ready(true));
  await until(async () => (await G(A, 'window.__games.phase')) === 'play', 12000);
  const s0 = await st(A); res.cashPlayers = s0.players.length; checks.sitOut = !s0.players.includes(ids.C) && s0.players.includes(ids.B);
  // contested pickup: A and B teleport onto the same stack at once
  const it0 = s0.data.items[0];
  await Promise.all([tp(A, it0.x, it0.y, it0.z), tp(B, it0.x, it0.y, it0.z)]);
  await sleep(1500);
  // then each grabs its own stacks
  let items = (await st(A)).data.items;
  for (let k = 0; k < 6 && k < items.length; k++) { const P = k % 2 ? B : A; const it = items[k]; await tp(P, it.x, it.y, it.z); await sleep(700); }
  await sleep(800); res.shots.hud = await shot(A, 'games_hud.png');
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end'), 20000);
  await sleep(600);
  const ends = await Promise.all(ALL.map(st));
  const ev = ends[0].data.ev; const claims0 = ev.filter(e => e.i === it0.i);
  res.cash = { scores: ends.map(s => s.scores), winners: ends.map(s => s.results?.winners), events: ev.length, contested: claims0.map(e => e.by), worth: await G(A, 'window.__games.netWorth') };
  const sumEv = ev.reduce((a, e) => a + e.v, 0), sumSc = Object.values(ends[0].scores).reduce((a, v) => a + v, 0);
  checks.cashClaimedOnce = claims0.length === 1 && new Set(ev.map(e => e.i)).size === ev.length && sumEv === sumSc && ev.length >= 4;
  checks.cashScoresMatch = ends.every(s => JSON.stringify(s.scores) === JSON.stringify(ends[0].scores));
  checks.cashWinnerMatch = ends.every(s => JSON.stringify(s.results?.winners) === JSON.stringify(ends[0].results?.winners)) && (ends[0].results?.winners?.length === 1);
  checks.endScreen = await G(A, "document.getElementById('pg-end').classList.contains('on')");
  await sleep(900); res.shots.end = await shot(A, 'games_end.png');
  for (const P of ALL) await P.page.evaluate(() => window.__games.dismissEnd());

  // ---------------------------------------------------------------- TAG
  await lobby(A, 'tag', { dur: 22000 }, ALL, ALL);
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'play'), 12000);
  await sleep(2300); // initial It freeze
  let ts = await st(A); const byId = Object.fromEntries(ALL.map(P => [ids[P.name], P]));
  const X = byId[ts.data.it]; const Y = ALL.find(P => P !== X); const Z = ALL.find(P => P !== X && P !== Y);
  await tp(Z, 18.5, -0.1, 26.5); await tp(Y, 12.0, -0.1, 20.6); await sleep(900);
  await tp(X, 12.6, -0.1, 20.6);
  const moved = await until(async () => { const s = await st(Y); return s.data.it === ids[Y.name] ? s : null; }, 5000, 100);
  const yFrozen = await G(Y, 'window.__games.frozen');
  res.tag = { it0: X.name, target: Y.name, transferred: !!moved, newItFrozen: yFrozen };
  await sleep(2400); // Y unfrozen (2 s) but X still immune (3 s); they are touching
  const mid = await st(A); res.tag.itDuringImmunity = mid.data.it === ids[Y.name] ? Y.name : 'other'; res.tag.log = mid.data.log; res.tag.names = { X: X.name, Y: Y.name, Z: Z.name };
  await sleep(700); // immunity over: put them together again (the capsules push apart while overlapping)
  { const yp = await Y.page.evaluate(() => window.__player.state.pos.toArray()); await tp(X, yp[0] + 0.6, yp[1], yp[2]); }
  const back = await until(async () => { const s = await st(A); return s.data.it === ids[X.name]; }, 4000, 100);
  res.tag.tagBackAfterImmunity = !!back;
  const lg = (await st(A)).data.log || []; res.tag.log = lg;
  // immunity: no tag-back to the previous It within 3 s (host log: ms = time the tagger had been It)
  const tagBacks = lg.filter((e, i) => i > 0 && e.to === lg[i - 1].from);
  checks.tagTransfer = !!moved && yFrozen; checks.tagImmunity = !!back && tagBacks.length > 0 && tagBacks.every(e => e.ms >= 3000);
  const ringOn = await G(B, 'window.__games.core.ring.group.visible'); res.tag.ringVisible = ringOn;
  res.shots.tag = await shot(Z, 'games_tag.png');
  await A.page.evaluate(() => window.__games.stop());
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end'), 6000);
  const tEnds = await Promise.all(ALL.map(st)); checks.tagWinnerMatch = tEnds.every(s => JSON.stringify(s.results?.winners) === JSON.stringify(tEnds[0].results?.winners));
  for (const P of ALL) await P.page.evaluate(() => window.__games.dismissEnd());

  // ---------------------------------------------------------------- HIDE & SEEK
  await lobby(A, 'hide', { hide: 6000, seek: 40000 }, ALL, ALL);
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'play'), 12000);
  await sleep(1200);
  let hs = await st(A); const SK = byId[hs.data.seekers[0]]; const H = ALL.filter(P => P !== SK);
  const skFrozen = await G(SK, 'window.__games.frozen'); const skDark = await G(SK, "document.getElementById('pg-dark').classList.contains('on')");
  res.shots.seeker = await shot(SK, 'games_seeker.png');
  const tagsHidden = await Promise.all(ALL.map(P => G(P, 'window.__games.hiddenTags()')));
  const hiddenOk = ALL.every((P, i) => H.every(h => h === P || tagsHidden[i][ids[h.name]] === true) && (SK === P || tagsHidden[i][ids[SK.name]] === false));
  res.hide = { seeker: SK.name, frozenDuringHide: skFrozen, blackout: skDark, tagsHidden };
  await until(async () => (await st(A)).data.sub === 'seek', 9000);
  await sleep(300); const skFree = !(await G(SK, 'window.__games.frozen'));
  await tp(H[0], 18.6, -0.1, 24.6); await tp(H[1], 12.0, -0.1, 20.6); await sleep(600);
  await tp(SK, 19.4, -0.1, 24.6); await sleep(1300);
  await SK.page.evaluate(() => window.__games.action());
  const conv = await until(async () => { const s = await st(B); return s.data?.seekers?.includes(ids[H[0].name]) || s.phase === 'end' ? s : null; }, 4000, 100);
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end'), 5000);
  const hEnds = await Promise.all(ALL.map(st));
  res.hide.unfrozenAfter = skFree; res.hide.converted = !!conv; res.hide.winners = hEnds.map(s => s.results?.winners);
  checks.hideFrozen = skFrozen && skDark && skFree; checks.hideTagsHidden = hiddenOk;
  checks.hideConvert = !!conv && hEnds.every(s => s.data.seekers.includes(ids[H[0].name]) && JSON.stringify(s.results?.winners) === JSON.stringify([ids[H[1].name]]));
  for (const P of ALL) await P.page.evaluate(() => window.__games.dismissEnd());

  // ---------------------------------------------------------------- MUSICAL CHAIRS
  await lobby(A, 'chairs', { music: [3500, 4500], grab: 8000 }, ALL, ALL);
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'play'), 12000);
  await sleep(600);
  const musicOn = await Promise.all(ALL.map(P => G(P, 'window.__games.music')));
  const chairs1 = await Promise.all(ALL.map(P => G(P, 'window.__games.local().chairs')));
  await until(async () => (await st(A)).data.sub === 'grab', 8000, 100);
  const musicOff = (await until(async () => { const m = await Promise.all(ALL.map(P => G(P, 'window.__games.music'))); return m.every(x => !x) ? m : null; }, 2500, 100)) || await Promise.all(ALL.map(P => G(P, 'window.__games.music')));
  let cs = await st(A); const d = cs.data;
  const ring = (n, round) => { const r = Math.max(0.95, (n * 0.8) / (2 * Math.PI) + 0.35); return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + round * 0.4; return [d.center[0] + Math.cos(a) * (r + 0.55), d.center[1], d.center[2] + Math.sin(a) * (r + 0.55)]; }); };
  const rp = ring(d.chairs, d.round);
  await tp(A, ...rp[0]); await tp(B, ...rp[1]); await tp(C, ...rp[0]); await sleep(900);
  await A.page.keyboard.press('KeyR'); await sleep(250); await B.page.keyboard.press('KeyR'); await sleep(400); await C.page.keyboard.press('KeyR');
  await until(async () => (await st(A)).data.sub === 'result', 6000, 100);
  await sleep(600);
  cs = await st(A);
  const seated = await Promise.all(ALL.map(P => P.page.evaluate(() => ({ pose: window.__player.state.pose, seat: !!window.__player.state.seat }))));
  res.chairs = { center: d.center, chairs1, musicOn, musicOff, seats: cs.data.seats, alive: cs.data.alive.length, out: cs.data.lastOut, seated };
  res.shots.chairs = await shot(C, 'games_chairs.png');
  await until(async () => (await st(A)).data.round === 2, 6000, 200); await sleep(700);
  const chairs2 = await Promise.all(ALL.map(P => G(P, 'window.__games.local().chairs'))); res.chairs.chairs2 = chairs2;
  checks.chairs = chairs1.every(n => n === 2) && musicOn.every(Boolean) && musicOff.every(m => !m) && Object.keys(cs.data.seats).length === 2 && cs.data.lastOut?.length === 1 && cs.data.lastOut[0] === ids.C
    && seated[0].pose === 'sit' && seated[1].pose === 'sit' && seated[2].pose !== 'sit' && chairs2.every(n => n === 1);
  await A.page.evaluate(() => window.__games.stop());
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end'), 6000);
  for (const P of ALL) await P.page.evaluate(() => window.__games.dismissEnd());

  // ---------------------------------------------------------------- HOST LEAVES MID-GAME (Tag)
  await sleep(500);
  await lobby(A, 'tag', { dur: 40000 }, ALL, ALL);
  await until(async () => (await Promise.all(ALL.map(P => G(P, 'window.__games.phase')))).every(p => p === 'play'), 12000);
  await sleep(1500);
  const errA = A.logs.slice(); await A.page.close();
  const handed = await until(async () => { const [b, c] = await Promise.all([st(B), st(C)]); return b.host !== ids.A && b.host === c.host && !b.players.includes(ids.A) ? [b, c] : null; }, 25000, 500);
  const BC = [B, C];
  let leave = { handed: !!handed };
  if (handed) {
    const [b] = handed; leave.newHost = b.host === ids.B ? 'B' : 'C'; leave.phase = b.phase;
    await sleep(2300); // It freeze (if It changed)
    const s1 = await st(B); const Xi = BC.find(P => ids[P.name] === s1.data.it); const Yi = BC.find(P => P !== Xi);
    await tp(Yi, 12.0, -0.1, 20.6); await sleep(900); await tp(Xi, 12.6, -0.1, 20.6);
    const t2 = await until(async () => { const [b2, c2] = await Promise.all([st(B), st(C)]); return b2.data.it === ids[Yi.name] && c2.data.it === ids[Yi.name]; }, 6000, 150);
    leave.transferAfterHandoff = !!t2;
    const hostP = BC.find(P => ids[P.name] === b.host); await hostP.page.evaluate(() => window.__games.stop());
    await until(async () => (await Promise.all(BC.map(P => G(P, 'window.__games.phase')))).every(p => p === 'end'), 6000);
    const e2 = await Promise.all(BC.map(st)); leave.winners = e2.map(s => s.results?.winners);
    checks.hostLeave = b.phase === 'play' && !!t2 && JSON.stringify(e2[0].results?.winners) === JSON.stringify(e2[1].results?.winners);
  } else checks.hostLeave = false;
  res.hostLeave = leave;
  res.errors = { A: errA, B: B.logs, C: C.logs };
  checks.noErrors = !errA.length && !B.logs.length && !C.logs.length;
} catch (e) { res.error = e.stack || e.message; bad = true; }
res.checks = checks; if (Object.values(checks).some(v => !v)) bad = true;
console.log(JSON.stringify(res));
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
