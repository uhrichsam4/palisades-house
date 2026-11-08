// Network for the speaker. Uses mp.channel / onPeerJoin / onPeerLeave / net.clock when the lobby provides them;
// otherwise a BroadcastChannel loopback (two tabs on one machine, same ?room=) with the same shape.

export function speakerNet(mp) {
  if (mp && typeof mp.channel === 'function') {
    return {
      shim: false,
      channel: (n) => mp.channel(n),
      onPeerJoin: (f) => mp.onPeerJoin?.(f), onPeerLeave: (f) => mp.onPeerLeave?.(f),
      get selfId() { return mp.net?.selfId || mp.selfId || 'me'; },
      clock: (id) => { try { const c = mp.net?.clock?.(id); return Number.isFinite(c) ? c : null; } catch { return null; } },
      name: () => { try { return mp.selfName?.() || 'Someone'; } catch { return 'Someone'; } },
    };
  }
  return shim(mp);
}

function shim(mp) {
  const room = new URLSearchParams(location.search).get('room') || 'local';
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ph-speaker:' + room) : null;
  const selfId = 'tab-' + Math.random().toString(36).slice(2, 8);
  const origin = performance.timeOrigin;
  const peers = new Map(), joinFns = [], leaveFns = [], chans = new Map();
  const post = (m) => { try { bc?.postMessage({ ...m, from: selfId, origin }); } catch (e) { console.warn('[speaker] bc', e); } };
  if (bc) bc.onmessage = (e) => {
    const m = e.data; if (!m || m.from === selfId || (m.to && m.to !== selfId)) return;
    if (m.k === 'bye') { if (peers.delete(m.from)) leaveFns.forEach(f => f(m.from)); return; }
    const known = peers.has(m.from); peers.set(m.from, { origin: m.origin });
    if (m.k === 'hello') post({ k: 'hi', to: m.from });
    if (!known) joinFns.forEach(f => { try { f(m.from); } catch (err) { console.warn('[speaker]', err); } });
    if (m.k === 'msg') { const c = chans.get(m.ch); try { c?.onMessage?.(m.msg, m.from); } catch (err) { console.warn('[speaker]', err); } }
  };
  setTimeout(() => post({ k: 'hello' }), 0);
  addEventListener('pagehide', () => post({ k: 'bye' }));
  return {
    shim: true, peers,
    channel(name) { const c = { send(msg, target) { post({ k: 'msg', ch: name, msg, to: target }); }, onMessage: null }; chans.set(name, c); return c; },
    onPeerJoin: (f) => joinFns.push(f), onPeerLeave: (f) => leaveFns.push(f),
    selfId, clock: (id) => { const p = peers.get(id); return p ? p.origin - origin : null; },
    name: () => { try { return mp?.selfName?.() || 'Someone'; } catch { return 'Someone'; } },
  };
}

// ownership claims {id, ts}: newer timestamp wins, then the smaller peer id
export function claimWins(a, b) {
  if (!b) return true; if (!a) return false;
  if (a.ts !== b.ts) return a.ts > b.ts;
  return String(a.id) < String(b.id);
}
