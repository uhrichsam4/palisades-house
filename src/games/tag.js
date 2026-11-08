// Tag (2+ players, 2 min): "It" has a glowing yellow ring at their feet. It touches someone within 1.1 m ->
// they're It (frozen 2 s; the old It has 3 s tag-back immunity). Least total time as It wins.
// The It client detects touches and claims; the host checks distance (with latency slack), freeze and immunity.
const REACH = 1.1, SLACK = 1.0, FREEZE = 2000, IMMUNE = 3000;
let lastClaim = 0, lastIt = null;

const liveTotal = (S, id) => (S.data.totals[id] || 0) + (S.data.it === id && S.phase === 'play' ? Math.max(0, performance.now() - S.data.itSinceAt) : 0);
const secs = (ms) => (ms / 1000).toFixed(1) + 's';

export default {
  id: 'tag', title: 'Tag', min: 2, dur: 120000, timeLabel: '2:00',
  rules: 'One player is It. Touch someone to pass it on. Whoever spends the least time as It wins.',
  startArea: [11.8, 20.6],
  setup(S, c) { const it = c.rnd(S.players); S.data = { it, itSinceAt: performance.now(), frozenUntilAt: 0, immune: null, totals: {}, tags: 0 }; },
  begin(S) { const d = S.data; const now = performance.now(); d.itSinceAt = now; d.frozenUntilAt = now + FREEZE; },
  onClaim(S, from, m, c) {
    if (m.k !== 'tag') return false;
    const d = S.data; const now = performance.now(); const t = m.target;
    if (from !== d.it || t === from || !S.players.includes(t) || now < d.frozenUntilAt) return false;
    if (d.immune && d.immune.id === t && now < d.immune.untilAt) return false;
    if (c.dist(c.posOf(from), c.posOf(t)) > REACH + SLACK) return false;
    d.totals[from] = (d.totals[from] || 0) + (now - d.itSinceAt);
    (d.log ||= []).push({ from, to: t, ms: Math.round(now - d.itSinceAt) }); if (d.log.length > 20) d.log.shift();
    d.it = t; d.itSinceAt = now; d.frozenUntilAt = now + FREEZE; d.immune = { id: from, untilAt: now + IMMUNE }; d.tags++;
    return true;
  },
  onLeave(S, id, c) { const d = S.data; if (d.it === id && S.players.length) { const now = performance.now(); d.totals[id] = (d.totals[id] || 0) + (now - d.itSinceAt); d.it = c.rnd(S.players); d.itSinceAt = now; d.frozenUntilAt = now + FREEZE; d.immune = null; } },
  finalize(S) { const d = S.data; if (d.it) { d.totals[d.it] = (d.totals[d.it] || 0) + Math.max(0, performance.now() - d.itSinceAt); d.itSinceAt = performance.now(); } },
  frozen(S, c) { return S.data.it === c.me() && performance.now() < S.data.frozenUntilAt; },
  apply(S, prev, c) {
    const d = S.data; if (!d) return;
    if (S.phase === 'play' && d.it !== lastIt) {
      if (d.it === c.me()) c.toast(lastIt ? "Tagged — you're IT! (frozen 2 s)" : "You're IT — go tag someone!", 2400);
      else if (lastIt === c.me()) c.toast(`You tagged ${c.nameOf(d.it)} — run!`, 2000);
      lastIt = d.it;
    }
  },
  tick(dt, t, S, c) {
    const d = S.data; if (!d) return;
    c.ring.set(c.posOf(d.it), t);
    if (S.phase !== 'play' || d.it !== c.me() || performance.now() < d.frozenUntilAt) return;
    const now = performance.now(); if (now - lastClaim < 250) return;
    const p = c.player.state.pos;
    for (const id of S.players) {
      if (id === c.me()) continue;
      if (d.immune && d.immune.id === id && now < d.immune.untilAt) continue;
      const q = c.posOf(id); if (!q) continue;
      if (Math.hypot(q.x - p.x, q.z - p.z) <= REACH && Math.abs(q.y - p.y) < 1.5) { lastClaim = now; c.claim({ k: 'tag', target: id }); break; }
    }
  },
  hud(S, c) {
    const d = S.data; const mine = d.it === c.me(); const now = performance.now();
    const out = [['ROLE', mine ? 'IT' : 'RUNNER', 'role'], ['IT', c.nameOf(d.it)], ['YOU', secs(liveTotal(S, c.me()))]];
    if (mine && now < d.frozenUntilAt) out.push(['FROZEN', secs(d.frozenUntilAt - now), 'alt']);
    if (d.immune?.id === c.me() && now < d.immune.untilAt) out.push(['SAFE', secs(d.immune.untilAt - now), 'alt']);
    return out;
  },
  board(S, c) { return S.players.map(id => ({ id, name: c.nameOf(id), v: liveTotal(S, id), text: secs(liveTotal(S, id)) + (S.data.it === id ? ' · IT' : '') })).sort((a, b) => a.v - b.v || (a.id < b.id ? -1 : 1)); },
  results(S, c) {
    const rows = S.players.map(id => ({ id, name: c.nameOf(id), v: S.data.totals[id] || 0, text: 'IT ' + secs(S.data.totals[id] || 0) })).sort((a, b) => a.v - b.v || (a.id < b.id ? -1 : 1));
    const winners = rows.length ? [rows[0].id] : [];
    rows.forEach(r => { r.earn = winners.includes(r.id) ? 100000 : 5000; });
    return { rows, winners, title: rows.length ? `${rows[0].name} wins` : 'Game over' };
  },
  cleanup(c) { c.ring.set(null); lastIt = null; },
};
