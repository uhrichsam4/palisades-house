// Public lobby directory over Nostr relays (no server). Every client opens WebSockets to the same
// deterministic set of relays (from Trystero's defaultRelayUrls) and subscribes to one topic. A public
// lobby is announced by ONE elected member (multiplayer.js decides who) every ~6 s and shortly after a
// {q:1} query; browsers send a query when a relay opens and drop entries not refreshed in ~20 s.
// Everything received here is untrusted: validated, length-capped, control characters stripped.
// Private lobbies are never announced.
export const TOPIC = 'palisades-house-17609/lobbies/v1';
const N_RELAYS = 8, ANNOUNCE_MS = 6000, EXPIRE_MS = 20000;

const clean = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max) : '');
export function validEntry(o) {
  if (!o || typeof o !== 'object' || o.pv !== 1) return null;
  const code = typeof o.code === 'string' && /^[a-z0-9-]{3,24}$/.test(o.code) ? o.code : null; if (!code) return null;
  const max = Number.isInteger(o.max) ? Math.min(8, Math.max(2, o.max)) : null; if (!max) return null;
  const n = Number.isInteger(o.n) ? Math.min(max, Math.max(1, o.n)) : null; if (!n) return null;
  const name = clean(o.name, 40) || 'Lobby ' + code; const host = clean(o.host, 24);
  return { code, name, n, max, host };
}

export function createDirectory() {
  let tr = null, started = false; const socks = []; const seenIds = new Set();
  const list = new Map(); // code -> { entry, seen }
  const fns = new Set(); let announcing = null, annT = 0, qT = 0, subId = 'lb' + Math.random().toString(36).slice(2, 10);
  const emit = () => { for (const f of fns) { try { f(); } catch (e) { console.warn('[lobbies]', e); } } };

  async function ensure() {
    if (started) return; started = true;
    try { tr = await import('trystero'); } catch (e) { console.warn('[lobbies] no trystero', e.message); return; }
    const all = tr.defaultRelayUrls || [];
    let h = 0; for (const ch of TOPIC) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pick = []; for (let i = 0; i < Math.min(N_RELAYS, all.length); i++) pick.push(all[(h + i * 3) % all.length]);
    for (const url of [...new Set(pick)]) socks.push(openRelay(url));
    setInterval(tick, 1000);
  }
  function openRelay(url) {
    const s = { url, ws: null, open: false, backoff: 5000, dead: false };
    const connect = () => {
      let ws; try { ws = new WebSocket(url); } catch { return retry(); }
      s.ws = ws;
      ws.onopen = () => { s.open = true; s.backoff = 5000; try { ws.send(tr.subscribe(subId, TOPIC)); } catch {} query(ws); if (announcing) announceNow(); };
      ws.onmessage = (ev) => onRelayMsg(ev.data);
      ws.onclose = () => { const was = s.open; s.open = false; s.ws = null; if (!was) s.backoff = Math.min(s.backoff * 2, 120000); retry(); };
      ws.onerror = () => {};
    };
    const retry = () => setTimeout(connect, s.backoff * (0.8 + Math.random() * 0.4));
    connect(); return s;
  }
  function onRelayMsg(data) {
    if (typeof data !== 'string' || data.length > 8000) return;
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!Array.isArray(m) || m[0] !== 'EVENT' || !m[2] || typeof m[2] !== 'object') return;
    const ev = m[2]; if (typeof ev.id === 'string') { if (seenIds.has(ev.id)) return; seenIds.add(ev.id); if (seenIds.size > 2000) seenIds.clear(); }
    if (!Array.isArray(ev.tags) || !ev.tags.some(t => Array.isArray(t) && t[0] === 'x' && t[1] === TOPIC)) return;
    if (typeof ev.content !== 'string' || ev.content.length > 1000) return;
    let c; try { c = JSON.parse(ev.content); } catch { return; }
    if (c && c.q === 1) { if (announcing) { clearTimeout(qT); qT = setTimeout(announceNow, 200 + Math.random() * 600); } return; }
    if (c && c.gone === 1 && typeof c.code === 'string') { if (list.delete(c.code)) emit(); return; }
    const e = validEntry(c); if (!e) return;
    list.set(e.code, { entry: e, seen: performance.now() }); emit();
  }
  async function publish(obj) {
    if (!tr) return; let msg; try { msg = await tr.createEvent(TOPIC, JSON.stringify(obj)); } catch (e) { console.warn('[lobbies] event', e.message); return; }
    for (const s of socks) if (s.open) { try { s.ws.send(msg); } catch {} }
  }
  async function query(ws) { if (!tr) return; try { const msg = await tr.createEvent(TOPIC, JSON.stringify({ q: 1 })); (ws ? [ws] : socks.filter(s => s.open).map(s => s.ws)).forEach(w => { try { w.send(msg); } catch {} }); } catch {} }
  function announceNow() { if (!announcing) return; annT = performance.now(); const e = announcing(); if (e) { publish({ pv: 1, ...e, t: Date.now() }); list.set(e.code, { entry: validEntry({ pv: 1, ...e }) || e, seen: performance.now() }); emit(); } }
  function tick() {
    const now = performance.now(); let ch = false;
    for (const [k, v] of list) if (now - v.seen > EXPIRE_MS) { list.delete(k); ch = true; }
    if (ch) emit();
    if (announcing && now - annT > ANNOUNCE_MS) announceNow();
  }
  return {
    ensure,
    get relays() { return socks.map(s => ({ url: s.url, open: s.open })); },
    get openCount() { return socks.filter(s => s.open).length; },
    list: () => [...list.values()].map(v => v.entry).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    refresh() { ensure(); query(); },
    onChange(fn) { fns.add(fn); return () => fns.delete(fn); },
    // fn() -> {code, name, n, max, host} | null ; pass null to stop announcing
    // gone: true = the lobby is now empty (last member left): tell browsers to drop it right away
    setAnnouncer(fn, { gone = false } = {}) {
      const prev = announcing; if (fn === prev) return; announcing = fn || null;
      if (announcing) { ensure().then(announceNow); }
      else if (prev && gone) { const e = prev(); if (e) { publish({ gone: 1, code: e.code }); list.delete(e.code); emit(); } }
    },
    isAnnouncing: () => !!announcing,
  };
}
export const directory = createDirectory();
