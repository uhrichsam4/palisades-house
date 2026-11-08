// Musical Chairs (2+ players): a ring of gold chiavari chairs (N-1 for N players) on the east pool deck. The
// built-in 120 BPM synth plays for a random 8-20 s; when it stops press R near a free chair to sit (host
// validates, first claim wins). The player left standing is out; one chair less each round; last seated wins.
// The lobby speaker (window.__speaker) is paused for the game and resumed after.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CENTERS = [[19.7, 25.1], [0.0, 26.4], [11.8, 20.6], [-0.4, 19.4]];
const SEAT_Y = 0.47, REACH = 1.6, SLACK = 1.2;
let built = null, sidSeen = null, sitting = null;

let geo = null;
function chairGeo() {
  if (geo) return geo;
  const gold = [], cush = [];
  const cyl = (r, h, x, y, z, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r, r, h, 10); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); gold.push(g); };
  const W = 0.2, Dz = 0.19;
  for (const sx of [-1, 1]) {
    cyl(0.013, 0.45, sx * W, 0.225, -Dz);                 // front legs
    cyl(0.013, 0.95, sx * W, 0.475, Dz + 0.01, -0.06);    // back legs run up into the back
    cyl(0.008, 0.38, sx * W, 0.16, 0, Math.PI / 2);       // side stretchers
    const ring = new THREE.TorusGeometry(0.025, 0.006, 6, 16); ring.translate(sx * W, 0.16, -0.08); gold.push(ring);
  }
  cyl(0.008, 2 * W, 0, 0.16, -Dz, 0, Math.PI / 2);         // front stretcher
  cyl(0.012, 2 * W + 0.02, 0, 0.43, -Dz, 0, Math.PI / 2);   // seat frame
  cyl(0.012, 2 * W + 0.02, 0, 0.43, Dz, 0, Math.PI / 2);
  for (const y of [0.62, 0.78, 0.93]) cyl(0.011, 2 * W, 0, y, Dz + 0.035 + (y - 0.45) * 0.06, 0, Math.PI / 2); // back rails
  for (const x of [-0.1, -0.035, 0.035, 0.1]) cyl(0.007, 0.16, x, 0.70, Dz + 0.05, -0.06); // spindles
  for (const x of [-0.1, -0.035, 0.035, 0.1]) cyl(0.007, 0.15, x, 0.855, Dz + 0.06, -0.06);
  const c = new THREE.BoxGeometry(0.44, 0.045, 0.42, 4, 1, 4); const p = c.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); if (y > 0) p.setY(i, y + 0.012 * (1 - (x / 0.22) ** 2) * (1 - (z / 0.21) ** 2)); }
  c.computeVertexNormals(); c.translate(0, 0.455, 0); cush.push(c);
  geo = { gold: mergeGeometries(gold.map(g => g.index ? g.toNonIndexed() : g)), cush: mergeGeometries(cush.map(g => g.index ? g.toNonIndexed() : g)) };
  return geo;
}
const goldM = new THREE.MeshStandardMaterial({ color: 0xd6b05a, metalness: 1, roughness: 0.28 });
const cushM = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.92 });

export function ringPos(d, n) {
  const [cx, cy, cz] = d.center; const r = Math.max(0.95, (n * 0.8) / (2 * Math.PI) + 0.35);
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + d.round * 0.4; const dx = Math.cos(a), dz = Math.sin(a); out.push({ x: cx + dx * r, y: cy, z: cz + dz * r, yaw: Math.atan2(-dx, -dz) }); }
  return out; // chairs face outward (classic back-to-back ring)
}

function build(c, d) {
  clear(c);
  const g = new THREE.Group(); g.userData.keep = true; const G = chairGeo();
  for (const p of ringPos(d, d.chairs)) {
    const ch = new THREE.Group(); ch.position.set(p.x, p.y, p.z); ch.rotation.y = p.yaw;
    const a = new THREE.Mesh(G.gold, goldM); a.castShadow = true; ch.add(a); const b = new THREE.Mesh(G.cush, cushM); b.castShadow = true; ch.add(b);
    g.add(ch);
  }
  c.scene.add(g); built = { g, key: d.round + ':' + d.chairs };
}
function clear() { if (built) { built.g.parent?.remove(built.g); built = null; } }
function standUp(c) { if (sitting !== null) { sitting = null; if (c.player.state.seat) c.player.setSeat(null); } }

export default {
  id: 'chairs', title: 'Musical Chairs', min: 2, dur: 600000, timeLabel: 'ROUNDS',
  rules: 'Walk the ring while the music plays. When it stops, press R by a free chair. No chair, you\'re out.',
  setup(S, c) {
    let center = null;
    for (const [x, z] of CENTERS) { const n = S.players.length; const ps = ringPos({ center: [x, 0, z], round: 0 }, Math.max(2, n - 1)); const ys = ps.map(p => c.spots.ok(p.x, p.z)); if (ys.every(y => y !== null)) { center = [x, ys[0], z]; break; } }
    if (!center) center = [CENTERS[0][0], -0.1, CENTERS[0][1]];
    const mm = S.opts.music || [8000, 20000];
    S.data = { center, round: 1, alive: S.players.slice(), chairs: S.players.length - 1, sub: 'wait', seats: {}, out: [], music: mm, grabMs: S.opts.grab ?? 12000, spk: 0 };
    const r = Math.max(0.95, ((S.players.length - 1) * 0.8) / (2 * Math.PI) + 0.35) + 1.1;
    S.spawn = Object.fromEntries(S.players.map((id, i) => { const a = (i / S.players.length) * Math.PI * 2 + 0.3; const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r; return [id, [x, c.spots.ok(x, z) ?? center[1], z, Math.atan2(-Math.sin(a), Math.cos(a))]]; }));
    const sp = window.__speaker; if (sp?.music?.playing) { try { sp.togglePlay(); S.data.spk = 1; } catch {} }
  },
  begin(S) { const d = S.data; d.sub = 'music'; d.stopAt = performance.now() + d.music[0] + Math.random() * (d.music[1] - d.music[0]); },
  hostTick(S, dt, c) {
    const d = S.data; const now = performance.now();
    if (d.sub === 'music' && now >= d.stopAt) { d.sub = 'grab'; d.grabEndAt = now + d.grabMs; return true; }
    if (d.sub === 'grab') {
      const seated = Object.values(d.seats);
      if (seated.length >= d.chairs || now >= d.grabEndAt) {
        if (!seated.length) { d.sub = 'music'; d.stopAt = now + d.music[0] + Math.random() * (d.music[1] - d.music[0]); return true; } // nobody sat: replay
        const outNow = d.alive.filter(id => !seated.includes(id));
        d.out.push(...outNow.map(id => ({ id, round: d.round }))); d.lastOut = outNow; d.alive = d.alive.filter(id => seated.includes(id));
        d.sub = 'result'; d.resultEndAt = now + 3500; return true;
      }
    }
    if (d.sub === 'result' && now >= d.resultEndAt) {
      if (d.alive.length <= 1) { c.finish(); return true; }
      d.round++; d.chairs = d.alive.length - 1; d.seats = {}; d.lastOut = []; d.sub = 'music'; d.stopAt = now + d.music[0] + Math.random() * (d.music[1] - d.music[0]);
      return true;
    }
    return false;
  },
  onClaim(S, from, m, c) {
    const d = S.data; if (m.k !== 'sit' || d.sub !== 'grab' || !d.alive.includes(from)) return false;
    if (Object.values(d.seats).includes(from)) return false;
    const i = m.c | 0; if (i < 0 || i >= d.chairs || d.seats[i]) return false;
    const p = ringPos(d, d.chairs)[i]; if (c.dist(c.posOf(from), p) > REACH + SLACK) return false;
    d.seats[i] = from; return true;
  },
  onLeave(S, id) { const d = S.data; d.alive = d.alive.filter(x => x !== id); for (const k of Object.keys(d.seats)) if (d.seats[k] === id) delete d.seats[k]; if (d.alive.length <= 1 && d.sub !== 'result') { d.sub = 'result'; d.resultEndAt = performance.now(); } else if (d.chairs >= d.alive.length && d.sub === 'music') d.chairs = Math.max(1, d.alive.length - 1); },
  hostEnd(S) { if (S.data?.spk) { const sp = window.__speaker; if (sp && sp.music?.vid && !sp.music.playing) { try { sp.togglePlay(); } catch {} } } },
  apply(S, prev, c) {
    const d = S.data; if (!d?.center) return;
    if (sidSeen !== S.sid) { sidSeen = S.sid; sitting = null; }
    if (!built || built.key !== d.round + ':' + d.chairs) { standUp(c); build(c, d); }
    const myChair = Object.keys(d.seats).find(k => d.seats[k] === c.me());
    if (myChair !== undefined && (d.sub === 'grab' || d.sub === 'result')) {
      if (sitting !== +myChair) { const p = ringPos(d, d.chairs)[+myChair]; sitting = +myChair; c.player.setSeat({ pos: [p.x, p.y + SEAT_Y, p.z], yaw: p.yaw, pose: 'sit' }); }
    } else standUp(c);
    const pv = prev?.data;
    if (d.sub === 'grab' && pv?.sub === 'music') c.toast('Music stopped — press R by a free chair!', 2200);
    if (d.sub === 'result' && pv?.sub !== 'result') c.toast(d.lastOut?.includes(c.me()) ? "No chair — you're out" : `${(d.lastOut || []).map(c.nameOf).join(', ') || 'Nobody'} is out`, 3000);
  },
  tick(dt, t, S, c) { const d = S.data; if (d?.sub === 'music' && S.phase === 'play') c.beat.start(); else c.beat.stop(); },
  key(k, S, c) {
    const d = S.data; if (k !== 'KeyR' || !d) return;
    if (!d.alive.includes(c.me())) return;
    if (d.sub === 'music') { c.toast('Wait for the music to stop!'); return; }
    if (d.sub !== 'grab' || Object.values(d.seats).includes(c.me())) return;
    const p = c.player.state.pos; let best = -1, bd = REACH;
    ringPos(d, d.chairs).forEach((q, i) => { if (d.seats[i]) return; const dd = Math.hypot(q.x - p.x, q.z - p.z); if (dd < bd) { bd = dd; best = i; } });
    if (best < 0) { c.toast('No free chair in reach'); return; }
    c.claim({ k: 'sit', c: best });
  },
  hud(S, c) {
    const d = S.data; const alive = d.alive.includes(c.me());
    return [['ROUND', String(d.round)], ['CHAIRS', String(d.chairs)], ['MUSIC', d.sub === 'music' ? 'PLAYING' : 'STOPPED', 'role'], ['ROLE', alive ? 'IN' : 'OUT · SPECTATING', alive ? '' : 'alt']];
  },
  timeText(S) { const d = S.data; return d.sub === 'grab' ? 'GRAB!' : d.sub === 'result' ? 'RESULT' : '♪'; },
  board(S, c) { const d = S.data; return [...d.alive.map(id => ({ id, name: c.nameOf(id), text: 'IN' })), ...d.out.slice().reverse().map(o => ({ id: o.id, name: c.nameOf(o.id), text: 'OUT R' + o.round }))]; },
  results(S, c) {
    const d = S.data; const rows = [...d.alive.map(id => ({ id, name: c.nameOf(id), text: 'LAST SEAT' })), ...d.out.slice().reverse().map(o => ({ id: o.id, name: c.nameOf(o.id), text: 'OUT ROUND ' + o.round }))];
    const winners = d.alive.length === 1 ? [d.alive[0]] : [];
    rows.forEach(r => { r.earn = winners.includes(r.id) ? 100000 : 5000; });
    return { rows, winners, title: winners.length ? `${c.nameOf(winners[0])} wins` : 'No winner' };
  },
  cleanup(c) { standUp(c); clear(); c.beat.stop(); sidSeen = null; },
  local() { return { chairs: built ? built.g.children.length : 0, sitting }; },
};
