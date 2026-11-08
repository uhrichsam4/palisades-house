// Hide & Seek (2+ players): a random seeker is frozen under a blackout for 30 s while the hiders hide (name
// tags of hiders are hidden for everyone). Then 3 min to find them: within 1.6 m, left click (pointer locked)
// tags. Tagged hiders become seekers. Last hider standing wins; if time runs out, the remaining hiders win.
const REACH = 1.6, SLACK = 1.2;
let wasSeeker = false;
const hiders = (S) => S.players.filter(id => !S.data.seekers.includes(id));

export default {
  id: 'hide', title: 'Hide & Seek', min: 2, dur: 210000, timeLabel: '3:30',
  rules: 'One seeker counts in the dark for 30 s. Then find the hiders: get close and click to tag. Tagged hiders seek too.',
  startArea: [11.8, 20.6],
  setup(S, c) {
    const hideMs = S.opts.hide ?? 30000, seekMs = S.opts.seek ?? 180000; S.opts.dur = hideMs + seekMs;
    S.data = { seekers: [c.rnd(S.players)], sub: 'hide', hideMs, tags: {}, tagged: [], startHiders: S.players.length - 1 };
  },
  begin(S) { S.data.sub = 'hide'; S.data.subEndAt = performance.now() + S.data.hideMs; },
  hostTick(S) { const d = S.data; if (d.sub === 'hide' && performance.now() >= d.subEndAt) { d.sub = 'seek'; return true; } return false; },
  onClaim(S, from, m, c) {
    const d = S.data; if (m.k !== 'tag' || d.sub !== 'seek' || !d.seekers.includes(from)) return false;
    const t = m.target; if (!S.players.includes(t) || d.seekers.includes(t)) return false;
    if (c.dist(c.posOf(from), c.posOf(t)) > REACH + SLACK) return false;
    d.seekers.push(t); d.tags[from] = (d.tags[from] || 0) + 1; d.tagged.push({ id: t, by: from });
    const left = hiders(S).length;
    if (left === 0 || (left === 1 && d.startHiders >= 2)) c.finish();
    return true;
  },
  onLeave(S, id, c) {
    const d = S.data; d.seekers = d.seekers.filter(x => x !== id);
    if (!d.seekers.length && S.players.length >= 2) d.seekers.push(c.rnd(S.players));
    if (S.players.length >= 2 && hiders(S).length === 0) c.finish();
  },
  frozen(S, c) { return S.data.sub === 'hide' && S.data.seekers.includes(c.me()); },
  dark(S, c) { const d = S.data; if (d.sub !== 'hide' || !d.seekers.includes(c.me())) return null; return { msg: 'Count to 30 — the hiders are hiding', t: String(Math.max(0, Math.ceil((d.subEndAt - performance.now()) / 1000))) }; },
  timeText(S, c) { const d = S.data; return d.sub === 'hide' ? 'HIDE ' + c.clockTxt(d.subEndAt - performance.now()) : c.clockTxt(S.endAt - performance.now()); },
  apply(S, prev, c) {
    const d = S.data; if (!d) return; const seek = d.seekers.includes(c.me());
    if (seek && !wasSeeker && prev && S.phase === 'play' && d.tagged.some(x => x.id === c.me())) c.toast("Found! You're a seeker now", 2400);
    if (d.sub === 'seek' && prev?.data?.sub === 'hide') c.toast(seek ? 'Go find them! Click to tag' : 'The seeker is coming…', 2400);
    wasSeeker = seek;
  },
  tick(dt, t, S, c) { const d = S.data; if (!d) return; for (const id of S.players) if (id !== c.me()) c.setTagHidden(id, !d.seekers.includes(id)); },
  action(S, c) {
    const d = S.data; if (d.sub !== 'seek' || !d.seekers.includes(c.me())) return;
    const p = c.player.state.pos; let best = null, bd = REACH;
    for (const id of hiders(S)) { const q = c.posOf(id); if (!q) continue; const dd = Math.hypot(q.x - p.x, q.z - p.z); if (dd <= bd && Math.abs(q.y - p.y) < 1.8) { bd = dd; best = id; } }
    if (best) c.claim({ k: 'tag', target: best }); else c.toast('Nobody in reach');
  },
  hud(S, c) { const d = S.data; const seek = d.seekers.includes(c.me()); return [['ROLE', seek ? 'SEEKER' : 'HIDER', 'role'], ['HIDERS', hiders(S).length + ' LEFT'], ['PHASE', d.sub.toUpperCase(), 'alt']]; },
  board(S, c) { const d = S.data; return [...hiders(S).map(id => ({ id, name: c.nameOf(id), text: 'HIDING' })), ...d.seekers.map(id => ({ id, name: c.nameOf(id), text: 'SEEKER' + (d.tags[id] ? ' · ' + d.tags[id] : '') }))]; },
  results(S, c) {
    const d = S.data; const h = hiders(S);
    const winners = h.length ? h : (d.seekers.slice().sort((a, b) => (d.tags[b] || 0) - (d.tags[a] || 0))).slice(0, 1);
    const rows = [...h.map(id => ({ id, name: c.nameOf(id), text: 'NEVER FOUND' })), ...d.tagged.slice().reverse().map(x => ({ id: x.id, name: c.nameOf(x.id), text: 'FOUND BY ' + c.nameOf(x.by).toUpperCase() })), ...d.seekers.filter(id => !d.tagged.some(x => x.id === id)).map(id => ({ id, name: c.nameOf(id), text: 'SEEKER · ' + (d.tags[id] || 0) + ' TAGS' }))];
    rows.forEach(r => { r.earn = winners.includes(r.id) ? 100000 : 5000; });
    return { rows, winners, title: h.length === 1 ? `${c.nameOf(h[0])} wins` : h.length ? 'Hiders win' : `${c.nameOf(winners[0])} wins` };
  },
  cleanup(c) { c.restoreTags(); wasSeeker = false; },
};
