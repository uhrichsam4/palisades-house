// Avatar sync: the local player's chosen avatar (store.mine()) + everyone else's, peer to peer.
//   channel 'av'  : descriptor {k:'m', h} (mannequin) | {k:'c', id, f, sz, ht, fl} (custom model, id = sha-256 of the file)
//                   | {k:'b', id, ht, fl} (built-in library character, id in LIBRARY; loaded from the site, no P2P transfer)
//   channel 'avq' : {id} "send me that file" -> owner streams it on 'avd' as {id, i, n, b(base64)} chunks
// Files are cached in IndexedDB by hash, so a model is only ever downloaded once per browser. The receiver
// re-hashes the bytes and rejects anything that doesn't match the id. Until a model arrives (or if it fails,
// or the "show custom avatars" setting is off) the peer is shown as the default mannequin.
import { store, parseAvatar, createCustomAvatar, openAvatarPanel, LIMITS } from './index.js';
import { LIBRARY, libraryEntry, loadLibraryAsset } from './library.js';
import { createAvatar } from '../avatar.js';
import { identity, setHue } from '../net/identity.js';

const CHUNK = 48 * 1024;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const keyOf = (d) => !d ? 'm' : (d.k === 'c' || d.k === 'b') ? `${d.k}:${d.id}:${d.ht}:${d.fl ? 1 : 0}` : 'm';
const isModel = (d) => d?.k === 'c' || d?.k === 'b';
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function cleanDesc(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.k === 'm') return { k: 'm', h: Number.isFinite(d.h) ? ((d.h % 1) + 1) % 1 : undefined };
  if (d.k === 'b') { // library: id must be one of ours; height may go below 1.4 for small characters (fox)
    const ent = typeof d.id === 'string' && LIBRARY.some(x => x.id === d.id) ? libraryEntry(d.id) : null; if (!ent) return null;
    const lo = Math.min(1.4, ent.height), ht = Math.min(2.2, Math.max(lo, Number(d.ht) || ent.height));
    return { k: 'b', id: ent.id, ht, fl: !!d.fl };
  }
  if (d.k !== 'c' || typeof d.id !== 'string' || !/^[0-9a-f]{64}$/.test(d.id) || !['glb', 'vrm', 'fbx'].includes(d.f)) return null;
  const sz = Number(d.sz); if (!(sz > 0 && sz <= LIMITS.maxBytes)) return null;
  const ht = Math.min(2.2, Math.max(1.4, Number(d.ht) || 1.75));
  return { k: 'c', id: d.id, f: d.f, sz, ht, fl: !!d.fl };
}
const showCustom = () => { try { return JSON.parse(localStorage.getItem('ph.settings') || '{}').customAvatars !== false; } catch { return true; } };

export function startAvatarSync(ctx, mp) {
  const { player } = ctx;
  const assets = new Map(); // file id -> Promise<asset>
  function loadAsset(id, fmt) {
    if (!assets.has(id)) {
      const p = (async () => { const rec = await store.get(id); if (!rec) throw new Error('not cached'); return parseAvatar(rec.bytes.slice(0), fmt || rec.meta?.fmt); })();
      p.catch(() => assets.delete(id)); assets.set(id, p);
    }
    return assets.get(id);
  }

  // ---------------------------------------------------------------- local player
  let mine = cleanDesc(store.mine()) || { k: 'm', h: identity().hue };
  let localKey = 'm';
  async function applyLocal(asset) {
    const me = identity(); const d = mine; const k = keyOf(d); localKey = k;
    let av = null;
    if (isModel(d)) {
      try { const a = asset || await (d.k === 'b' ? loadLibraryAsset(d.id) : loadAsset(d.id, d.f)); if (localKey !== k) return; av = createCustomAvatar(ctx, a, { name: me.name, local: true, hue: me.hue, height: d.ht, flip: d.fl }); }
      catch (e) { console.warn('[avatars] local model failed, using default:', e.message); }
    } else if (Number.isFinite(d.h)) { setHue(d.h); }
    if (!av) av = createAvatar(ctx, { hue: identity().hue, name: me.name, local: true, seed: 11 });
    player.setCreature(av);
  }
  if (isModel(mine)) applyLocal();

  // ---------------------------------------------------------------- network
  const chD = mp.channel('av'), chQ = mp.channel('avq'), chF = mp.channel('avd');
  const wire = () => isModel(mine) ? mine : { k: 'm', h: identity().hue };
  const announce = (target) => chD.send(wire(), target);
  mp.onPeerJoin((id) => announce(id));

  const descOf = new Map(); // peerId -> desc
  chD.onMessage = (d, from) => { const c = cleanDesc(d); if (c) descOf.set(from, c); };
  mp.onPeerLeave((id) => descOf.delete(id));

  // owner side: stream the file to whoever asks (one transfer per peer at a time)
  const sending = new Set();
  chQ.onMessage = async (m, from) => {
    if (!m || mine.k !== 'c' || m.id !== mine.id || sending.has(from)) return;
    sending.add(from);
    try {
      const rec = await store.get(mine.id); if (!rec) return;
      const u8 = new Uint8Array(rec.bytes); const n = Math.ceil(u8.length / CHUNK);
      for (let i = 0; i < n; i++) {
        if (!mp.peers.has(from)) break;
        chF.send({ id: mine.id, i, n, b: b64(u8.subarray(i * CHUNK, (i + 1) * CHUNK)) }, from);
        await sleep(i % 4 === 3 ? 12 : 0); // pace so the data channel buffer never overflows
      }
    } catch (e) { console.warn('[avatars] send failed', e); } finally { sending.delete(from); }
  };

  // receiver side
  const incoming = new Map(); // id -> {n, parts, got, resolve, reject, timer}
  function fetchFile(id, from, sz) {
    if (incoming.has(id)) return incoming.get(id).promise;
    const job = { n: 0, parts: [], got: 0, bytes: 0 };
    job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
    const kick = () => { clearTimeout(job.timer); job.timer = setTimeout(() => { incoming.delete(id); job.reject(new Error('transfer timed out')); }, 20000); };
    kick(); job.kick = kick; incoming.set(id, job);
    chQ.send({ id }, from);
    job.promise.catch(() => {}).finally(() => { clearTimeout(job.timer); incoming.delete(id); });
    return job.promise;
  }
  chF.onMessage = async (m, from) => {
    const job = m && incoming.get(m.id); if (!job || typeof m.b !== 'string' || !(m.i >= 0) || !(m.n > 0) || m.n * CHUNK > LIMITS.maxBytes + CHUNK) return;
    job.kick(); job.n = m.n;
    if (!job.parts[m.i]) { const u = unb64(m.b); job.parts[m.i] = u; job.got++; job.bytes += u.length; }
    if (job.got < job.n) return;
    const all = new Uint8Array(job.bytes); let o = 0; for (const p of job.parts) { all.set(p, o); o += p.length; }
    try {
      const d = descOf.get(from);
      const id = await store.putFile(all.buffer, { fmt: d?.f, from: 'peer' });
      if (id !== m.id) throw new Error('file hash mismatch');
      job.resolve(id);
    } catch (e) { job.reject(e); }
  };

  // apply remote descriptors (checked every frame, work only when something changed)
  const loading = new Set();
  async function applyRemote(id, r, d) {
    const k = keyOf(d); r._avKey = k; loading.add(id);
    try {
      let asset;
      if (d.k === 'b') asset = await loadLibraryAsset(d.id);
      else {
        if (!(await store.has(d.id))) { mp.ui?.toast?.(`Loading ${r.name}'s avatar…`); await fetchFile(d.id, id, d.sz); }
        asset = await loadAsset(d.id, d.f);
      }
      const cur = mp.peers.get(id); if (!cur || cur._avKey !== k) return;
      const av = createCustomAvatar(ctx, asset, { name: cur.name, local: false, hue: cur.hue, height: d.ht, flip: d.fl });
      const old = cur.creature; cur.creature = av; av.setPose?.(cur.pose || 'stand'); try { old.dispose(); } catch {}
    } catch (e) { console.warn(`[avatars] ${r.name}'s model not shown:`, e.message); }
    finally { loading.delete(id); }
  }
  function toMannequin(id, r) {
    r._avKey = 'm'; if (!r._custom) return;
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const av = createAvatar(ctx, { hue: r.hue, name: r.name, local: false, seed: (seed % 9973) + 3 });
    const old = r.creature; r.creature = av; r._custom = false; try { old.dispose(); } catch {}
  }
  let acc = 0;
  ctx.onUpdate((dt) => {
    acc += dt; if (acc < 0.25) return; acc = 0;
    const allow = showCustom();
    for (const [id, r] of mp.peers) {
      if (loading.has(id) || !r.creature) continue;
      // library characters are vetted site files, so they show even with "show custom avatars" off
      const d = descOf.get(id); const want = (allow && d?.k === 'c') || d?.k === 'b' ? d : null;
      const k = keyOf(want); if ((r._avKey || 'm') === k) continue;
      if (want) { r._custom = true; applyRemote(id, r, want); } else toMannequin(id, r);
    }
  });

  // ---------------------------------------------------------------- panel (main menu + pause menu "Avatar…")
  async function select(desc, asset) {
    mine = cleanDesc(desc) || { k: 'm', h: identity().hue };
    if (asset && mine.k === 'c') assets.set(mine.id, Promise.resolve(asset));
    await applyLocal(asset || undefined); announce();
  }
  function open() { return openAvatarPanel({ onChange: (desc, asset) => { select(desc, asset); } }); }
  if (window.__menu?.hooks) window.__menu.hooks.openAvatarPanel = open;
  else queueMicrotask(() => { if (window.__menu?.hooks) window.__menu.hooks.openAvatarPanel = open; });
  return { open, select, get mine() { return mine; }, descOf };
}
