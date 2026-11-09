// Natural Disaster Survival (round game on the games hub, src/games/index.js). Realistic take on the Roblox classic:
// everyone spawns in the house, a disaster is announced (big title + siren), survive it; survivors score 1; most
// survivals after N rounds wins. Disasters: flood, meteor shower, house fire, earthquake, lightning storm, blizzard.
//
// Authority: the hub host owns S. S.data = { rounds, round, type, seed, roundAt, annMs, liveMs, interMs, ev[], fire{},
// hp{}, ko{}, hist[] }. The host schedules every event (meteor impacts, lightning strikes, quake panel hits, fire
// ignition times) when a round starts; every client renders them from S deterministically (times are ms after the
// live start). House damage goes through ctx.damage with info.by = host, so only the host resolves it and damage.js
// syncs hp/breaks — every screen shows the same holes. Each client computes its OWN health (it knows where it
// stands) and sends {k:'hp', v} claims (≤ 2/s, and at KO); the host stores them in S.data.hp / ko.
// KO: frozen + spectator orbit camera (mouse turns it) until the next round (everyone revives at round start).
// Cost: nothing is built until the first round (lazy fx); while idle the hub doesn't call us at all.
//   Test hooks: window.__disaster = { state(), fx, hurt(n), local() }  ·  start opts: { type, rounds, roundMs, annMs, interMs }
import * as THREE from 'three';
import * as P from '../../plan.js';
import { waterBodies } from '../../water/index.js';
import { createDisasterFx } from './fx.js';
import * as A from './audio.js';

export const TYPES = {
  flood:    { title: 'Flood',          sub: 'The canyon is flooding — get upstairs or onto the roof',     color: '#5aa8d8' },
  meteor:   { title: 'Meteor Shower',  sub: 'Rocks from the sky — stay under solid cover, away from glass', color: '#ff8a3d' },
  fire:     { title: 'House Fire',     sub: 'Fire is spreading room to room — get out of the house',       color: '#ff5a2a' },
  quake:    { title: 'Earthquake',     sub: 'Magnitude 7 — get away from walls and tall furniture',        color: '#d8b46a' },
  storm:    { title: 'Lightning Storm', sub: 'Lightning strikes anyone outdoors — get inside',              color: '#b9c8ff' },
  blizzard: { title: 'Blizzard',       sub: 'Extreme cold outdoors — stay inside, away from broken glass', color: '#e6f2ff' },
};
const TYPE_IDS = Object.keys(TYPES);
const HOUSE = [0.3, 0.3, 23.1, 21.7]; // x0 z0 x1 z1 (exterior faces)
const FLOOD_TOP = 2.2;

// ---------------------------------------------------------------- tiny seeded rng
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- rooms: lookup + adjacency (shared walls / stair)
const RIDS = Object.keys(P.ROOMS);
function roomAt(x, y, z) {
  const lv = y > 3.0 ? 1 : 0;
  for (const id of RIDS) { const r = P.ROOMS[id]; if (r.level !== lv || r.outdoor) continue; const [x0, z0, x1, z1] = r.rect; if (x >= x0 - 0.08 && x <= x1 + 0.08 && z >= z0 - 0.08 && z <= z1 + 0.08) return id; }
  return null;
}
let ADJ = null;
function adjacency() {
  if (ADJ) return ADJ; ADJ = {};
  for (const a of RIDS) ADJ[a] = [];
  for (let i = 0; i < RIDS.length; i++) for (let j = i + 1; j < RIDS.length; j++) {
    const A1 = P.ROOMS[RIDS[i]], B1 = P.ROOMS[RIDS[j]]; if (A1.level !== B1.level || A1.outdoor || B1.outdoor) continue;
    const [ax0, az0, ax1, az1] = A1.rect, [bx0, bz0, bx1, bz1] = B1.rect;
    const gx = Math.max(bx0 - ax1, ax0 - bx1), gz = Math.max(bz0 - az1, az0 - bz1);
    const ox = Math.min(ax1, bx1) - Math.max(ax0, bx0), oz = Math.min(az1, bz1) - Math.max(az0, bz0);
    if ((gx < 0.4 && gx > -0.05 && oz > 0.6) || (gz < 0.4 && gz > -0.05 && ox > 0.6)) { ADJ[RIDS[i]].push(RIDS[j]); ADJ[RIDS[j]].push(RIDS[i]); }
  }
  ADJ.foyer.push('gallery'); ADJ.gallery.push('foyer'); // the stair carries smoke + fire up
  return ADJ;
}

// ---------------------------------------------------------------- schedule (host, at round start)
function schedule(d) {
  const rng = mulberry(d.seed); const ms = d.liveMs; const ev = []; d.fire = {};
  const inHouse = () => [HOUSE[0] + rng() * (HOUSE[2] - HOUSE[0]), HOUSE[1] + rng() * (HOUSE[3] - HOUSE[1])];
  const yard = () => [-8 + rng() * 40, -6 + rng() * 36];
  if (d.type === 'meteor') {
    const n = Math.round(10 + ms / 3000);
    for (let i = 0; i < n; i++) { const [x, z] = rng() < 0.55 ? inHouse() : yard(); const big = rng() < 0.25; ev.push({ i, t: Math.round(1200 + (i / n) * (ms - 3000) + rng() * 1800), x: +x.toFixed(2), z: +z.toFixed(2), r: big ? 6 : 4, p: big ? 90000 : 45000, sx: +(rng() - 0.5).toFixed(2), sz: +(rng() - 0.5).toFixed(2) }); }
  } else if (d.type === 'storm') {
    const n = Math.round(6 + ms / 5000);
    for (let i = 0; i < n; i++) { const [x, z] = rng() < 0.35 ? inHouse() : yard(); ev.push({ i, t: Math.round(1500 + (i / n) * (ms - 2500) + rng() * 2000), x: +x.toFixed(2), z: +z.toFixed(2) }); }
  } else if (d.type === 'quake') {
    const panels = window.__building?.panels || [];
    const n = Math.min(26, Math.round(8 + ms / 3500));
    for (let i = 0; i < n && panels.length; i++) { const p = panels[Math.floor(rng() * panels.length)]; ev.push({ i, t: Math.round(2500 + rng() * (ms - 5000)), id: p.id, imp: rng() < 0.4 ? 1e6 : 1600 + rng() * 2400 }); }
    ev.sort((a, b) => a.t - b.t);
  } else if (d.type === 'fire') {
    const adj = adjacency(); const ground = RIDS.filter(id => P.ROOMS[id].level === 0 && id !== 'garage' && id !== 'family'); // never in the spawn room
    const start = ground[Math.floor(rng() * ground.length)]; d.fire[start] = 0; const q = [start];
    while (q.length) { const r = q.shift(); for (const n of adj[r] || []) { const t = d.fire[r] + 4000 + rng() * 7000; if (d.fire[n] === undefined || t < d.fire[n]) { d.fire[n] = Math.round(t); q.push(n); } } }
  }
  d.ev = ev;
}

// ---------------------------------------------------------------- per-client local state
const L = { fx: null, sid: null, round: -1, done: new Set(), hp: 100, ko: false, sentHp: 100, sentAt: 0, indoor: false, indoorAt: 0, shake: 0, flood: null, ann: null, weatherSet: null, lastHurt: 0, ui: null, rng: Math.random, emitAcc: 0, spec: false, live: false, startCam: null };

function css() {
  if (document.getElementById('dz-css')) return;
  const s = document.createElement('style'); s.id = 'dz-css';
  s.textContent = `
  #dz-ann{position:fixed;left:50%;top:22%;transform:translate(-50%,-8px);text-align:center;pointer-events:none;opacity:0;transition:opacity .3s cubic-bezier(.5,1,.89,1),transform .5s cubic-bezier(.16,1,.3,1);z-index:60;font-family:Geist,-apple-system,Inter,sans-serif;color:#f7f7f7}
  #dz-ann.on{opacity:1;transform:translate(-50%,0)}
  #dz-ann .k{font:600 11px/1 "Geist Mono",ui-monospace,"SF Mono",monospace;letter-spacing:-.4px;color:rgba(247,247,247,.66);display:inline-flex;gap:6px;align-items:center;background:#262626;border:1px solid rgba(247,247,247,.06);border-radius:2px;padding:5px 8px}
  #dz-ann .k i{width:7px;height:7px;border-radius:50%;background:#ff4a3a;animation:dzp 1s infinite}
  #dz-ann h1{margin:14px 0 8px;font-size:84px;font-weight:500;letter-spacing:-.05em;line-height:.95;text-shadow:0 2px 24px rgba(0,0,0,.55)}
  #dz-ann p{margin:0;font:600 12px/1.4 "Geist Mono",ui-monospace,monospace;letter-spacing:-.4px;color:rgba(247,247,247,.8);text-shadow:0 1px 8px rgba(0,0,0,.7)}
  @keyframes dzp{50%{opacity:.35}}
  #dz-hp{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);width:300px;background:#262626;border:1px solid rgba(247,247,247,.06);border-radius:6px;padding:8px 10px;box-shadow:0 2px 6px -2px rgba(0,0,0,.2);z-index:55;display:none;font:600 11px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:-.4px}
  #dz-hp.on{display:block} #dz-hp .row{display:flex;justify-content:space-between;margin-bottom:7px} #dz-hp .k{color:rgba(247,247,247,.32)} #dz-hp .v{color:rgba(247,247,247,.66)}
  #dz-hp .bar{height:6px;border-radius:2px;background:#2f2f2f;overflow:hidden} #dz-hp .fill{height:100%;background:#f7f7f7;transition:width .25s cubic-bezier(.16,1,.3,1),background .25s}
  #dz-hp.low .fill{background:#ff4a3a} #dz-hp.ko .v{color:#ff4a3a}
  #dz-vig{position:fixed;inset:0;pointer-events:none;z-index:50;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 30%,rgba(10,6,4,.92) 100%)}
  #dz-hurt{position:fixed;inset:0;pointer-events:none;z-index:51;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(160,10,0,.55) 100%)}`;
  document.head.appendChild(s);
}
function ui() {
  if (L.ui) return L.ui; css();
  const mk = (id, html) => { const e = document.createElement('div'); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const ann = mk('dz-ann', '<span class="k"><i></i><span class="kk">WARNING::</span><span class="kv"></span></span><h1></h1><p></p>');
  const hp = mk('dz-hp', '<div class="row"><span><span class="k">HEALTH::</span><span class="v hv">100</span></span><span><span class="k">STATUS::</span><span class="v sv">ALIVE</span></span></div><div class="bar"><div class="fill"></div></div>');
  const vig = mk('dz-vig', ''); const hurt = mk('dz-hurt', '');
  L.ui = { ann, hp, vig, hurt, hv: hp.querySelector('.hv'), sv: hp.querySelector('.sv'), fill: hp.querySelector('.fill') };
  return L.ui;
}

// ---------------------------------------------------------------- helpers
const now = () => performance.now();
function info(S) { // round phase from the (shifted) clock
  const d = S.data; if (!d || d.roundAt == null) return { ph: 'wait', e: 0 };
  const r = now() - d.roundAt;
  if (r < d.annMs) return { ph: 'ann', e: r - d.annMs, r };
  const e = r - d.annMs;
  if (e < d.liveMs) return { ph: 'live', e, r };
  return { ph: 'inter', e, r };
}
function floodLevel(e, ms = 75000) { const k = Math.min(1, Math.max(0, e / Math.min(38000, ms * 0.55))); return -0.6 + (FLOOD_TOP + 0.6) * (k * k * (3 - 2 * k)); }
let ray = null;
function castDown(phys, x, z, from = 40) {
  try { const R = phys.RAPIER; const F = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
    ray = ray || new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }); ray.origin = { x, y: from, z }; ray.dir = { x: 0, y: -1, z: 0 };
    const h = phys.world.castRay(ray, from + 20, true, F); return h ? from - (h.timeOfImpact ?? h.toi) : 0; } catch { return 0; }
}
function roofAbove(phys, p) {
  try { const R = phys.RAPIER; const F = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
    const r = new R.Ray({ x: p.x, y: p.y + 1.9, z: p.z }, { x: 0, y: 1, z: 0 }); return !!phys.world.castRay(r, 14, true, F); } catch { return false; }
}

// flood water body for the player's swim code (src/player.js reads waterBodies) + rain ripples
function floodBody() {
  const outline = [[-69, -69], [91, -69], [91, 91], [-69, 91]];
  return { name: 'flood', outline, level: -5, isInside: (x, z) => x > -69 && x < 91 && z > -69 && z < 91, heightAt(x, z) { return this.level; }, splash() {}, disturb() {}, addFloater() {}, mesh: null };
}

// ---------------------------------------------------------------- game def
export function createDisaster() {
  const def = {
    id: 'disaster', title: 'Natural Disasters', kind: 'round', minPlayers: 1, maxPlayers: 8,
    blurb: 'Flood, meteors, fire, quake, lightning, blizzard. Survive the disaster; most survivals wins.',
    icon: '<path d="M10 2.5l7.5 13H2.5z"/><path d="M10 8v3.6M10 13.6v.1"/>',
    area: { pos: [5.5, 0, 16.8], yaw: 0 }, startArea: [5.5, 16.8], areaName: 'INSIDE THE HOUSE',
    dur: 3 * 86000, timeLabel: '3 ROUNDS',

    setup(S, c) {
      const o = S.opts || {};
      const rounds = Math.max(1, Math.min(8, o.rounds ?? 3)), annMs = o.annMs ?? 5000, roundMs = o.roundMs ?? 75000, interMs = o.interMs ?? 6000;
      S.data = { rounds, round: -1, type: null, pick: o.type || null, seed: 0, roundAt: null, annMs, roundMs, liveMs: roundMs, interMs, ev: [], fire: {}, hp: {}, ko: {}, hist: [], prevWeather: window.__sky?.mode || 'auto' };
      S.opts.dur = rounds * (annMs + roundMs + interMs) + 60000; // the host calls finish() after the last round
    },
    begin(S, c) { nextRound(S); },
    hostTick(S, dt, c) {
      const d = S.data; const I = info(S); let ch = false;
      // weather for sky disasters (host only: __sky.set goes to the whole lobby)
      const wantW = I.ph !== 'inter' && (d.type === 'storm' || d.type === 'blizzard') ? d.type : null;
      if (wantW !== L.weatherSet) { L.weatherSet = wantW; try { window.__sky?.set({ weather: wantW || d.prevWeather || 'auto' }); } catch {} }
      if (I.ph === 'live') {
        const alive = S.players.filter(id => !d.ko[id]);
        if (!alive.length && I.e > 1500) { d.liveMs = Math.round(I.e); ch = true; } // everyone down: end the round now
      }
      if (I.ph === 'inter' && d.scored !== d.round) { // score survivors
        d.scored = d.round; const surv = S.players.filter(id => !d.ko[id]);
        for (const id of surv) S.scores[id] = (S.scores[id] || 0) + 1;
        d.hist.push({ type: d.type, surv }); ch = true;
      }
      if (I.ph === 'inter' && I.e >= d.liveMs + d.interMs) {
        if (d.round + 1 >= d.rounds) { c.finish(); return true; }
        nextRound(S); ch = true;
      }
      return ch;
    },
    onClaim(S, from, m) {
      if (m.k !== 'hp') return false; const d = S.data; const v = Math.max(0, Math.min(100, +m.v || 0));
      if (m.r !== d.round) return false;
      d.hp[from] = Math.round(v); if (v <= 0) d.ko[from] = true; return true;
    },
    onLeave(S, id) { delete S.data?.hp?.[id]; },
    apply(S, prev, c) {
      if (L.sid !== S.sid) { resetLocal(c); L.sid = S.sid; }
      const d = S.data; if (!d || d.round < 0) return;
      if (L.round !== d.round) { // new round: revive, back into the house, announce
        L.round = d.round; L.done.clear(); L.hp = 100; L.ko = false; L.sentHp = 100; L.spec = false; L.live = false;
        const fx = ensureFx(c); fx.reset(); c.player.state.frozen = false;
        if (d.round > 0 && c.amIn() && S.spawn?.[c.me()]) { const p = S.spawn[c.me()]; try { c.player.teleport(p[0], p[1] + 0.05, p[2], p[3] ?? c.player.state.yaw); } catch {} }
        announce(d);
      }
    },
    frozen(S) { return L.ko; },
    tick(dt, t, S, c) { try { tick(dt, t, S, c); } catch (e) { console.warn('[disaster] tick', e); } },
    timeText(S, c) { const I = info(S); const d = S.data; if (!d) return ''; if (I.ph === 'ann') return 'IN ' + c.clockTxt(-I.e); if (I.ph === 'live') return c.clockTxt(d.liveMs - I.e); return 'NEXT ' + c.clockTxt(d.liveMs + d.interMs - I.e); },
    hud(S, c) {
      const d = S.data; if (!d?.type) return [];
      const alive = S.players.filter(id => !d.ko[id]).length;
      return [['DISASTER', TYPES[d.type].title.toUpperCase(), 'role'], ['ROUND', `${d.round + 1}/${d.rounds}`, 'alt'], ['ALIVE', `${alive}/${S.players.length}`, 'alt']];
    },
    board(S, c) { const d = S.data || {}; return S.players.map(id => ({ id, name: c.nameOf(id), v: S.scores[id] || 0, text: `${S.scores[id] || 0} · ${d.ko?.[id] ? 'KO' : (d.hp?.[id] ?? 100) + 'HP'}` })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1)); },
    results(S, c) {
      const d = S.data || {}; const rows = S.players.map(id => ({ id, name: c.nameOf(id), v: S.scores[id] || 0, text: `${S.scores[id] || 0}/${(d.hist || []).length} SURVIVED`, earn: (S.scores[id] || 0) * 10000 })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
      const top = rows[0]?.v || 0; const winners = top > 0 ? rows.filter(r => r.v === top).map(r => r.id) : [];
      const title = !winners.length ? 'Nobody survived' : winners.length === 1 ? `${rows[0].name} survives it all` : `${winners.length} survivors tie`;
      return { rows, winners, title };
    },
    hostEnd(S) { try { if (L.weatherSet) { window.__sky?.set({ weather: S.data?.prevWeather || 'auto' }); L.weatherSet = null; } } catch {} },
    cleanup(c) { resetLocal(c); },
    local() { return localInfo(); },
  };
  return def;
}

function nextRound(S) {
  const d = S.data; d.round++;
  d.type = d.pick && TYPES[d.pick] ? d.pick : TYPE_IDS[Math.floor(Math.random() * TYPE_IDS.length)];
  d.seed = (Math.random() * 2 ** 31) | 0; d.roundAt = now(); d.liveMs = d.roundMs; d.hp = {}; d.ko = {};
  for (const id of S.players) d.hp[id] = 100;
  schedule(d);
}

function ensureFx(c) { if (!L.fx) { L.fx = createDisasterFx(c.scene); window.__disaster.fx = L.fx; } return L.fx; }
function announce(d) {
  const u = ui(); const T = TYPES[d.type];
  u.ann.querySelector('.kv').textContent = `ROUND ${d.round + 1}/${d.rounds}`;
  u.ann.querySelector('h1').textContent = T.title; u.ann.querySelector('h1').style.color = T.color;
  u.ann.querySelector('p').textContent = T.sub.toUpperCase();
  u.ann.classList.add('on'); clearTimeout(L.ann); L.ann = setTimeout(() => u.ann.classList.remove('on'), Math.max(2500, d.annMs + 1200));
  A.siren(Math.min(4.5, d.annMs / 1000 + 0.5));
}

// polish: while the flood is up (camera at / under the water line) the bloom pass + exterior glow are clamped so the
// string lights don't wash the frame out; restored when it drains / the round resets
const FB = { p: null, s: 0, th: 0, on: false };
function floodBloom(on) {
  if (on === FB.on) return; const c = window.__dbg?.composer;
  const p = FB.p || (FB.p = c?.passes?.find(x => 'strength' in x && 'threshold' in x && 'radius' in x)); if (!p) return;
  FB.on = on; if (on) { FB.s = p.strength; FB.th = p.threshold; p.strength = FB.s * 0.3; p.threshold = Math.max(FB.th, 3); } else { p.strength = FB.s; p.threshold = FB.th; }
  window.__sky?.setGlowCap?.(on ? 2.5 : 0);
}
// polish5: storm / blizzard rounds force their sky on every client (the lobby weather request alone left some screens
// sunny); pool floats blown out by meteors / gusts go back home when a round ends
function forceSky(w) { if (w === L.forced) return; L.forced = w; try { window.__sky?.force?.(w); } catch {} }
function resetFloats() { try { for (const w of waterBodies) w.resetFloaters?.(); } catch (e) { console.warn('[disaster] floats', e); } }
function resetLocal(c) {
  floodBloom(false); forceSky(null); if (L.ph && L.ph !== 'inter') resetFloats(); L.ph = null;
  L.round = -1; L.done.clear(); L.ko = false; L.hp = 100; L.spec = false; L.live = false; L.shake = 0;
  if (c?.player?.state && c.player.state.frozen && L.koFroze) c.player.state.frozen = false; L.koFroze = false;
  L.fx?.reset(); A.stopAll();
  if (L.flood) { const i = waterBodies.indexOf(L.flood); if (i >= 0) waterBodies.splice(i, 1); L.flood = null; }
  if (L.ui) { L.ui.ann.classList.remove('on'); L.ui.hp.classList.remove('on'); L.ui.vig.style.opacity = 0; L.ui.hurt.style.opacity = 0; }
}

function hurt(c, S, amount) {
  if (L.ko || amount <= 0 || !c.amIn()) return;
  L.hp = Math.max(0, L.hp - amount); L.lastHurt = now();
  if (L.hp <= 0) { L.ko = true; L.koFroze = true; c.toast('You were knocked out — spectating until the next round', 3500); }
}

// ---------------------------------------------------------------- per-frame
const _v = new THREE.Vector3(); const WIND = [0, 0];
function tick(dt, t, S, c) {
  const d = S.data; if (!d || d.round < 0 || !d.type) return;
  const fx = ensureFx(c); const I = info(S); const u = ui();
  const p = c.player.state.pos; const phys = c.ctx.phys; const dmg = c.ctx.damage || window.__damage; const tm = now();
  const sky = window.__sky; if (sky) { const w = sky.windDir; WIND[0] = w.x * sky.wind * 4; WIND[1] = w.y * sky.wind * 4; }
  if (tm - L.indoorAt > 250) { L.indoorAt = tm; L.indoor = roofAbove(phys, p); }
  const live = I.ph === 'live'; const by = S.host;
  forceSky((I.ph === 'ann' || live) && (d.type === 'storm' || d.type === 'blizzard') ? d.type : null);
  if (I.ph !== L.ph) { if (I.ph === 'inter' && L.ph) resetFloats(); L.ph = I.ph; }
  const near = (x, y, z) => Math.hypot(p.x - x, p.y + 1 - y, p.z - z);

  // ---------------- disasters
  let bedRumble = 0, bedCrackle = 0, bedWind = 0, bedWater = 0; let vig = 0;
  if (d.type === 'flood') {
    if (!L.flood) { L.flood = floodBody(); waterBodies.push(L.flood); }
    const lv = I.ph === 'ann' ? -0.6 : I.ph === 'live' ? floodLevel(I.e, d.roundMs) : Math.max(-0.6, floodLevel(d.liveMs, d.roundMs) - (I.e - d.liveMs) / 1500);
    L.flood.level = lv; fx.flood.mesh.visible = lv > -0.55; fx.flood.mesh.position.y = lv; fx.flood.U.uTime.value = t; fx.flood.U.uAmp.value = 0.08 + 0.1 * Math.min(1, Math.max(0, I.e / 20000));
    bedWater = fx.flood.mesh.visible ? 0.25 : 0; floodBloom(fx.flood.mesh.visible);
    // buoyancy for light props below the surface
    for (const dd of phys.dynamics) { const b = dd.body; if (!b || !b.isDynamic?.()) continue; const tr = b.translation(); if (tr.y > lv + 0.05 || tr.y < lv - 4) continue; let m = 1; try { m = b.mass(); } catch {} if (m > 40) continue;
      const v = b.linvel(); const sub = Math.min(1, (lv - tr.y + 0.1) / 0.3); try { b.applyImpulse({ x: (WIND[0] * 0.05 - v.x * 0.6) * m * dt + Math.sin(t + tr.z) * 0.02 * m * dt, y: m * 9.81 * 1.5 * sub * dt - v.y * 0.8 * m * dt, z: (WIND[1] * 0.05 - v.z * 0.6) * m * dt }, true); } catch {} }
    // health: swimming / submerged drains
    if (live && c.amIn()) { const depth = lv - p.y; if (depth > 1.5) hurt(c, S, 9 * dt); else if (depth > 0.9) hurt(c, S, 3.2 * dt); else if (depth > 0.4) hurt(c, S, 0.6 * dt); }
  } else if (d.type === 'meteor') {
    for (const ev of d.ev) {
      const k = ev.i % fx.rocks.length; const rock = fx.rocks[k], glow = fx.glows[k]; const lead = 2600; const dtEv = I.e - ev.t;
      if (L.done.has(ev.i)) continue;
      if (!live || dtEv < -lead) { continue; }
      if (dtEv > 2000) { L.done.add(ev.i); continue; } // missed (late join)
      if (dtEv < 0) { // falling: from 140 m up along a slanted path
        if (ev.y == null) ev.y = castDown(phys, ev.x, ev.z);
        const f = 1 + dtEv / lead; const h = 140 * (1 - f); const x = ev.x + ev.sx * h * 0.7, z = ev.z + ev.sz * h * 0.7, y = ev.y + h;
        rock.visible = true; glow.visible = true; rock.position.set(x, y, z); rock.scale.setScalar(ev.r > 5 ? 1.0 : 0.65); rock.rotation.x += dt * 3; rock.rotation.z += dt * 2; glow.position.set(x, y, z); glow.scale.setScalar(ev.r > 5 ? 8 : 5.5);
        for (let j = 0; j < 3; j++) { fx.fire.emit(x + (Math.random() - 0.5) * 0.6, y + Math.random(), z + (Math.random() - 0.5) * 0.6, ev.sx * 4, 6, ev.sz * 4, 0.45, 2.2, 0.6, 1); }
        if (Math.random() < 0.8) fx.smoke.emit(x, y + 0.5, z, 0, 1, 0, 3.5, 1.4, 5.5, 0);
      } else { // impact
        L.done.add(ev.i); rock.visible = false; glow.visible = false;
        const y = ev.y ?? castDown(phys, ev.x, ev.z); _v.set(ev.x, y + 0.3, ev.z);
        try { dmg?.blast(_v, ev.r, ev.p, { by, source: { kind: 'meteor' } }); } catch (e) { console.warn('[disaster] blast', e); }
        fx.crater(ev.x, y, ev.z, ev.r * 0.55);
        for (let j = 0; j < 60; j++) { const a = Math.random() * 6.283, s = 3 + Math.random() * 9; fx.fire.emit(ev.x, y + 0.3, ev.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.6 + Math.random() * 0.6, 1.6, 0.4, 1); }
        for (let j = 0; j < 40; j++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 4; fx.smoke.emit(ev.x, y + 0.4, ev.z, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, 5 + Math.random() * 4, 2, 8, j % 3 === 0 ? 1 : 0); }
        ev.burnUntil = I.e + 9000; const dist = near(ev.x, y, ev.z);
        L.shake = Math.max(L.shake, Math.max(0, 1.2 - dist / 30));
        A.burst({ dur: 2.2, freq: 220, gain: Math.min(0.9, 6 / (dist + 3)) });
        if (dist < ev.r * 1.25) { const covered = L.indoor && y > p.y + 2.5; hurt(c, S, (covered ? 0.35 : 1) * 120 * Math.max(0, 1 - dist / (ev.r * 1.25))); }
      }
    }
    // burning craters
    for (const ev of d.ev) if (ev.burnUntil && I.e < ev.burnUntil && fx.fire.free > 40) { const y = ev.y ?? 0; if (Math.random() < 0.7) fx.fire.emit(ev.x + (Math.random() - 0.5) * 1.6, y + 0.1, ev.z + (Math.random() - 0.5) * 1.6, 0, 1.4, 0, 0.8, 0.9, 0.3, 0); if (Math.random() < 0.3) fx.smoke.emit(ev.x, y + 1, ev.z, 0, 1.2, 0, 6, 1.2, 5, 1); }
    if (L.shake > 0) bedRumble = L.shake * 0.4;
  } else if (d.type === 'fire') {
    const burning = []; for (const [rid, at] of Object.entries(d.fire)) if (live && I.e >= at) burning.push([rid, Math.min(1, (I.e - at) / 6000)]);
    const budget = Math.max(0, fx.fire.free - 20); const per = burning.length ? Math.min(14, budget / burning.length) : 0;
    L.emitAcc += dt * 60;
    if (L.emitAcc >= 1) { L.emitAcc = 0;
      for (const [rid, k] of burning) { const R0 = P.ROOMS[rid]; const [x0, z0, x1, z1] = R0.rect; const fy = P.LEVELS[R0.level].floor; const ceil = R0.level ? 6.0 : 3.0;
        const box = L.roomBox?.[rid] || ((L.roomBox ??= {})[rid] = [x0 + 0.25, fy + 0.05, z0 + 0.25, x1 - 0.25, ceil - 0.15, z1 - 0.25]); // contain: fire + smoke stay in this room
        const rr = mulberry(d.seed ^ rid.length * 977); // fixed flame seats per room
        const nE = Math.max(1, Math.round(per * k));
        for (let j = 0; j < nE; j++) { const s = Math.floor(Math.random() * 5); const r2 = mulberry((d.seed + s * 131 + rid.charCodeAt(0)) | 0); const sx = x0 + 0.3 + r2() * (x1 - x0 - 0.6), sz = z0 + 0.3 + r2() * (z1 - z0 - 0.6);
          /* polish5: flame tongues (smaller, shorter-lived, k 1 for one in six) + an ember now and then */
          fx.fire.emit(sx + (Math.random() - 0.5) * 0.9, fy + 0.05, sz + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.3, 1.0 + Math.random() * 1.4, (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.5 * k, 0.55 + k * 0.45, 0.15, j % 6 === 0 ? 1 : 0, box);
          if (j === 0 && Math.random() < 0.35) fx.fire.emit(sx + (Math.random() - 0.5) * 0.6, fy + 0.4 + Math.random() * 0.6, sz + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.4, 0.05, 0.03, 2, box); }
        if (fx.smoke.free > 30 && Math.random() < 0.6 + k * 0.4) fx.smoke.emit(x0 + Math.random() * (x1 - x0), ceil - 0.6 - Math.random() * 0.5 * k, z0 + Math.random() * (z1 - z0), (Math.random() - 0.5) * 0.6, 0.05, (Math.random() - 0.5) * 0.6, 7 + Math.random() * 4, 2.2, 4.2, 1, box);
        void rr; }
    }
    const here = roomAt(p.x, p.y + 0.5, p.z); const b = burning.find(x => x[0] === here);
    floodBloom(!!b || (!!here && burning.some(x => adjacency()[here]?.includes(x[0])))); /* polish5: bloom + exterior glow clamped while you're at the fire */
    if (b) { vig = 0.45 + 0.5 * b[1]; if (c.amIn()) hurt(c, S, (4 + 10 * b[1]) * dt); }
    else if (here && burning.some(x => adjacency()[here]?.includes(x[0]))) { vig = 0.3; if (c.amIn() && live) hurt(c, S, 1.2 * dt); }
    bedCrackle = burning.length ? Math.min(0.35, 0.08 + burning.length * 0.03) * (b ? 1.5 : 0.6) : 0;
  } else if (d.type === 'quake') {
    const env = live ? Math.min(1, I.e / 2500) * Math.min(1, Math.max(0, (d.liveMs - I.e) / 3000)) * (0.75 + 0.25 * Math.sin(I.e / 1300)) : 0;
    L.shake = Math.max(L.shake, env); bedRumble = env * 0.55;
    if (env > 0.05) {
      if (Math.random() < dt * 10) { for (const dd of phys.dynamics) { const bd = dd.body; if (!bd || !bd.isDynamic?.()) continue; let m = 1; try { m = bd.mass(); } catch {} const s = env * m * (0.8 + Math.random() * 1.6); try { bd.applyImpulse({ x: (Math.random() - 0.5) * s, y: Math.random() * s * 0.5, z: (Math.random() - 0.5) * s }, true); } catch {} } }
      if (Math.random() < dt * 6 && fx.smoke.free > 20) { const x = HOUSE[0] + Math.random() * 23, z = HOUSE[1] + Math.random() * 21; const yy = Math.random() < 0.5 ? 2.9 : 6.0; for (let j = 0; j < 4; j++) fx.smoke.emit(x, yy, z, (Math.random() - 0.5), -0.5, (Math.random() - 0.5), 2.5, 0.5, 2, 2); }
    }
    for (const ev of d.ev) {
      if (L.done.has(ev.i) || !live || I.e < ev.t) continue; L.done.add(ev.i); if (I.e - ev.t > 2000) continue;
      const pn = window.__building?.byId?.get(ev.id); const pt = pn?.center;
      try { dmg?.hit(ev.id, ev.imp, { by, point: pt, source: { kind: 'quake' } }); } catch (e) { console.warn('[disaster] quake hit', e); }
      if (pt) { for (let j = 0; j < 14; j++) fx.smoke.emit(pt.x + (Math.random() - 0.5), pt.y, pt.z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2, 3, 0.8, 3, 0);
        const dist = near(pt.x, pt.y, pt.z); if (dist < 3) hurt(c, S, ev.imp > 1e5 ? 35 * (1 - dist / 3) + 8 : 8); A.burst({ dur: 0.8, freq: 900, gain: Math.min(0.6, 3 / (dist + 2)), delay: 0 }); }
    }
    // tall furniture / ceiling debris: near-wall danger while shaking
    if (env > 0.4 && c.amIn() && L.indoor && Math.random() < dt * 0.6) hurt(c, S, 4 + env * 6);
  } else if (d.type === 'storm') {
    bedWind = live ? 0.12 : 0.05;
    for (const ev of d.ev) {
      if (L.done.has(ev.i) || !live || I.e < ev.t) continue; L.done.add(ev.i); if (I.e - ev.t > 2000) continue;
      const y = castDown(phys, ev.x, ev.z); _v.set(ev.x, y + 0.2, ev.z);
      fx.lightning(ev.x, y, ev.z, mulberry(d.seed + ev.i));
      try { window.__sky?.set({ flash: true }); } catch {}
      try { dmg?.blast(_v, 2.6, 4000, { by, source: { kind: 'lightning' } }); } catch (e) { console.warn('[disaster] bolt', e); }
      for (let j = 0; j < 30; j++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 6; fx.fire.emit(ev.x, y + 0.2, ev.z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, 0.35, 0.8, 0.1, 1); }
      for (let j = 0; j < 10; j++) fx.smoke.emit(ev.x, y + 0.3, ev.z, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 4, 1, 4, 0);
      const dist = near(ev.x, y, ev.z); A.burst({ dur: 3.5, freq: 160, gain: Math.min(0.9, 10 / (dist + 6)), attack: 0.02, delay: Math.min(1.5, dist / 340) });
      L.shake = Math.max(L.shake, Math.max(0, 0.5 - dist / 60));
      if (!L.indoor && dist < 7) hurt(c, S, dist < 2.5 ? 100 : 55 * (1 - dist / 7));
    }
    if (live && !L.indoor && c.amIn()) hurt(c, S, 0.4 * dt); // soaked + hail
  } else if (d.type === 'blizzard') {
    bedWind = live ? 0.3 : 0.12;
    if (live && fx.smoke.free > 40) for (let j = 0; j < 4; j++) { const a = Math.random() * 6.283, r = 3 + Math.random() * 16; fx.smoke.emit(p.x + Math.cos(a) * r, p.y + Math.random() * 4, p.z + Math.sin(a) * r, WIND[0] * 2.5, -0.3, WIND[1] * 2.5, 2.5, 1.2, 3.5, 3); }
    if (live && c.amIn()) { const tC = sky?.feelsC ?? -15; const cold = window.__cold; let drain = 0;
      if (cold && typeof cold.exposure === 'number') drain = cold.exposure * 6; // optional hook from the cold builder (0..1)
      else if (!L.indoor) drain = 3 + Math.max(0, -tC - 10) * 0.15;
      else { const rm = roomAt(p.x, p.y + 0.5, p.z); const hole = (window.__building?.holes || []).some(h => h.room === rm); drain = hole ? 0.8 : 0; }
      vig = Math.max(vig, !L.indoor ? 0.35 : 0); hurt(c, S, drain * dt); }
  }

  // ---------------- audio beds
  A.bed('rumble', bedRumble); A.bed('crackle', bedCrackle); A.bed('wind', bedWind); A.bed('water', bedWater);

  fx.update(dt, WIND);

  // ---------------- camera: shake, spectator
  const cam = c.camera;
  if (L.ko && c.amIn()) { // spectator orbit (mouse turns it: player yaw / pitch still update while frozen)
    c.player.state.frozen = true; L.koFroze = true; const yaw = c.player.state.yaw, pitch = c.player.state.pitch ?? 0; const R = 30;
    cam.position.set(11.5 + Math.sin(yaw) * R, 12 + Math.max(-6, Math.min(14, -pitch * 20)), 11 + Math.cos(yaw) * R); cam.lookAt(11.5, 2.5, 11);
  }
  if (L.shake > 0.01) { const s = L.shake * 0.12; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s; cam.rotateZ((Math.random() - 0.5) * s * 0.15); }
  L.shake = Math.max(0, L.shake - dt * (d.type === 'quake' ? 3 : 1.4));

  // ---------------- HUD + health sync
  const inR = c.amIn();
  u.hp.classList.toggle('on', inR && I.ph !== 'wait'); u.hp.classList.toggle('low', L.hp < 30); u.hp.classList.toggle('ko', L.ko);
  u.hv.textContent = String(Math.ceil(L.hp)); u.sv.textContent = L.ko ? 'KNOCKED OUT · SPECTATING' : I.ph === 'ann' ? 'GET READY' : I.ph === 'inter' ? 'SURVIVED' : 'ALIVE';
  u.fill.style.width = Math.max(0, L.hp) + '%';
  u.vig.style.opacity = String(Math.min(0.7, vig)); // smoke vignette: dark, but you can still see the way out u.hurt.style.opacity = String(Math.max(0, 1 - (tm - L.lastHurt) / 500) * 0.8);
  if (inR && (I.ph === 'live' || I.ph === 'inter')) {
    const v = Math.ceil(L.hp); const changed = v !== L.sentHp;
    if (changed && (v <= 0 || tm - L.sentAt > 500)) { L.sentHp = v; L.sentAt = tm; c.claim({ k: 'hp', v, r: d.round }); }
  }
}

function localInfo() {
  return { hp: Math.round(L.hp * 10) / 10, ko: L.ko, round: L.round, indoor: L.indoor, done: L.done.size, particles: L.fx ? L.fx.live : 0, flood: L.flood?.level ?? null, fx: !!L.fx };
}

export function registerDisaster(api) {
  const def = createDisaster();
  window.__disaster = { def, fx: null, TYPES, local: localInfo, state: () => api.state?.data || null,
    hurt: (n) => { const S = api.core?.S; if (S) hurt(api.core, S, n); return localInfo(); } };
  return api.register(def);
}
