// Cash Grab (60 s, 1+ players): cash spawns in waves (15-25 at a time) around the ground floor and the yard,
// $1K / $5K / $10K stacks and a rare $50K gold briefcase. Walk into one to grab it (host validates: first
// claim wins). Highest cash wins; what you grabbed goes into your net worth.
import { cashPickup, animatePickup } from './fx.js';

const VALUES = [[1000, 0.5], [5000, 0.32], [10000, 0.15], [50000, 0.03]];
const pickValue = () => { let r = Math.random(); for (const [v, p] of VALUES) { if ((r -= p) <= 0) return v; } return 1000; };
const meshes = new Map(); const pending = new Map(); let lastEv = 0, sidSeen = null;

function wave(S, c) {
  const d = S.data; const pool = c.spots.pool(); if (!pool.length) return;
  const target = 15 + Math.floor(Math.random() * 11);
  let guard = 0;
  while (d.items.length < target && guard++ < 400) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    if (d.items.some(it => Math.hypot(it.x - p[0], it.z - p[2]) < 1.6)) continue;
    d.items.push({ i: d.next++, x: p[0], y: p[1], z: p[2], v: pickValue() });
  }
  d.waveAt = performance.now() + 12000;
}

export default {
  id: 'cash', title: 'Cash Grab', min: 1, dur: 60000, timeLabel: '1:00',
  rules: 'Cash rains on the house. Walk into stacks to grab them; gold briefcases are $50K. Most cash in 60 s wins.',
  startArea: [11.8, 20.6],
  setup(S) { S.data = { items: [], next: 1, ev: [], evn: 1, waveAt: 0 }; },
  begin(S, c) { wave(S, c); },
  hostTick(S, dt, c) { const d = S.data; if (d.items.length < 8 || performance.now() >= d.waveAt) { wave(S, c); return true; } return false; },
  onClaim(S, from, m) {
    if (m.k !== 'grab') return false;
    const d = S.data; const k = d.items.findIndex(it => it.i === m.i); if (k < 0) return false; // already gone: first claim won
    const it = d.items.splice(k, 1)[0];
    S.scores[from] = (S.scores[from] || 0) + it.v;
    d.ev.push({ e: d.evn++, i: it.i, by: from, v: it.v, x: it.x, y: it.y, z: it.z }); if (d.ev.length > 16) d.ev.shift();
    return true;
  },
  apply(S, prev, c) {
    if (sidSeen !== S.sid) { this.cleanup(c); sidSeen = S.sid; lastEv = 0; }
    const d = S.data; if (!d?.items) return;
    const keep = new Set(d.items.map(it => it.i));
    for (const [i, o] of meshes) if (!keep.has(i)) { o.parent?.remove(o); meshes.delete(i); pending.delete(i); }
    for (const it of d.items) if (!meshes.has(it.i)) { const o = cashPickup(it.v); o.position.set(it.x, it.y, it.z); c.scene.add(o); meshes.set(it.i, o); }
    for (const ev of d.ev) {
      if (ev.e <= lastEv) continue; lastEv = ev.e;
      const p = { x: ev.x, y: ev.y, z: ev.z }; const mine = ev.by === c.me();
      c.bursts.burst(p, ev.v >= 50000 ? 90 : 36);
      c.floats.add(p, (mine ? '+' : c.nameOf(ev.by) + ' +') + c.money(ev.v), mine);
    }
  },
  tick(dt, t, S, c) {
    const now = performance.now(); const p = c.player.state.pos;
    for (const [i, o] of meshes) {
      animatePickup(o, t);
      if (S.phase !== 'play' || !c.amIn()) continue;
      const pd = pending.get(i);
      if (pd) { if (now - pd > 1500) { pending.delete(i); o.visible = true; } continue; }
      if (Math.hypot(o.position.x - p.x, o.position.z - p.z) < 0.85 && Math.abs(o.position.y - p.y) < 1.6) {
        pending.set(i, now); o.visible = false; c.claim({ k: 'grab', i });
      }
    }
  },
  hud(S, c) {
    const b = this.board(S, c); const lead = b[0];
    return [['YOU', c.money(S.scores[c.me()] || 0)], ['LEAD', lead && lead.v > 0 ? lead.name : '—', 'role'], ['CASH', String(S.data?.items?.length || 0), 'alt']];
  },
  board(S, c) { return S.players.map(id => ({ id, name: c.nameOf(id), v: S.scores[id] || 0, text: c.money(S.scores[id] || 0) })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1)); },
  results(S, c) {
    const rows = this.board(S, c).map(r => ({ ...r, earn: r.v }));
    const top = rows[0]; const winners = top && top.v > 0 ? [top.id] : [];
    return { rows, winners, title: winners.length ? `${top.name} wins ${c.money(top.v)}` : 'Nobody grabbed a dime' };
  },
  cleanup() { for (const o of meshes.values()) o.parent?.remove(o); meshes.clear(); pending.clear(); },
  local() { return { meshes: [...meshes.keys()], pending: [...pending.keys()] }; },
};
