// Multiplayer (walk mode only; main.js never imports this in photo-shot mode).
// Trystero (Nostr signalling -> WebRTC data channels). start(ctx) does the one-time setup (door sync,
// per-frame loop, Re-create / video hooks, window.__mp) and connects to nothing; the menu (src/net/menu.js)
// then calls api.connect(code, lobbyMeta?) / api.leave() any number of times without a reload.
// Local state goes out at ~18 Hz; remote players are interpolated ~100 ms in the past.
// Doors (wrapped `target`) and big splashes are synced; chat + join/leave toasts in #mp.
// Lobbies: meta {name, max, pub, created, host} travels on the 'lobby' action (sent to every newcomer);
// members that are over `max` get {full:1} back and leave. Public lobbies are announced on the Nostr
// directory (src/net/lobbies.js) by ONE member: the smallest peer id among members that know the meta.
// Any networking failure leaves single-player untouched.
// Re-create scenes (src/recreate.js): state messages carry an optional pose `q` (1 sit, 2 lie, 3 lean;
// missing = standing), seat key `c` ('sceneId:i') and wave-emote counter `e` (B; a change plays the wave); seated peers are snapped. The 'rc' action carries
// seat claims / releases / play / stop; startRecreate() runs last, then startVideos() (src/videos.js).
// Avatars: remote avatars are made in addRemote() below (createAvatar from ./avatar.js).
import * as THREE from 'three';
import { createAvatar } from './avatar.js';
import { waterBodies } from './water/index.js';
import { identity, setName as saveName } from './net/identity.js';
import { createUI } from './net/ui.js';
import { directory } from './net/lobbies.js';
import { startRecreate } from './recreate.js';
import { startVideos } from './videos.js';
import { startSpeaker } from './speaker.js';
import { startAvatarSync } from './avatars/sync.js';

const POSE_CODE = { sit: 1, lie: 2, lean: 3 }, POSE_NAME = ['stand', 'sit', 'lie', 'lean'];

const APP_ID = 'palisades-house-17609';
const SEND_HZ = 18, INTERP_MS = 100;
const clean = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max) : '');

export function cleanCode(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24); }
export function randomCode() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let code = '';
  const r = crypto.getRandomValues(new Uint8Array(6)); for (const b of r) code += A[b % A.length];
  return code;
}
function setUrlRoom(code) {
  try { const u = new URL(location.href); if (code) u.searchParams.set('room', code); else u.searchParams.delete('room'); history.replaceState(history.state, '', u); } catch {}
}
function validMeta(m) {
  if (!m || typeof m !== 'object') return null;
  const max = Number.isInteger(m.max) ? Math.min(8, Math.max(2, m.max)) : 8;
  return { name: clean(m.name, 40) || 'Lobby', max, pub: !!m.pub, created: Number.isFinite(m.created) ? m.created : Date.now(), host: clean(m.host, 24) };
}

export async function start(ctx) {
  if (ctx.shot) return null;
  const { player, phys, params } = ctx; const R = phys.RAPIER;
  const me = identity();
  const peers = new Map();   // peerId -> remote (avatar), created on the first state message
  const members = new Set(); // peerIds connected in the current room
  const knowers = new Set(); // members that told us they know the lobby meta
  let room = null, actions = null, selfId = 'local', code = null, meta = null, tr = null;
  let creator = false, joinedAt = 0, settledAt = Infinity;
  let session = 0;           // bumps on every connect/leave: stale callbacks check it
  const listeners = new Set(); const emit = (ev, data) => { for (const f of listeners) { try { f(ev, data); } catch (e) { console.warn('[mp]', e); } } };
  const rcHooks = {}; // filled by startRecreate: onPeerSeat(id, key), onMessage(msg, id), onPeerJoin(id), onPeerLeave(id), seatKey
  const ui = createUI({
    onChat: (text) => { ui.addChat(me.name, text, me.hue, true); actions?.chat.send({ t: text.slice(0, 200), n: me.name, h: me.hue }); },
    onLeave: () => emit('leave-request'),
  });
  ui.setRoom(null);
  const refreshUI = () => { ui.setRoom(code ? { code, name: meta?.name || 'Lobby ' + code, pub: !!meta?.pub, max: meta?.max || 8 } : null); ui.setPlayers([{ name: me.name, hue: me.hue, me: true }, ...[...members].map(id => { const r = peers.get(id); return { name: r?.name || 'Joining…', hue: r?.hue }; })]); };

  // ---------------------------------------------------------------- extension channels (stable across connects)
  // api.channel(name) -> { send(msg, targetPeerId?), onMessage }: re-bound to room.makeAction(name) on every
  // connect; no-op while solo. Trystero action names are limited to 12 bytes.
  const channels = new Map(); const joinFns = new Set(), leaveFns = new Set();
  function bindChannel(ch) {
    ch._act = null; if (!room) return;
    try { ch._act = room.makeAction(ch.name); const my = session; ch._act.onMessage = (d, mm) => { if (my !== session) return; try { ch.onMessage?.(d, mm?.peerId ?? mm); } catch (e) { console.warn('[channel ' + ch.name + ']', e); } }; } catch (e) { console.warn('[channel]', ch.name, e.message); }
  }
  function channel(name) {
    name = String(name).slice(0, 12); if (channels.has(name)) return channels.get(name);
    const ch = { name, onMessage: null, _act: null, send(msg, target) { if (!ch._act) return; try { ch._act.send(msg, target ? { target } : undefined); } catch (e) { console.warn('[channel]', name, e); } } };
    channels.set(name, ch); bindChannel(ch); return ch;
  }
  const callAll = (set, id) => { for (const f of set) { try { f(id); } catch (e) { console.warn('[mp hook]', e); } } };

  // ---------------------------------------------------------------- remote players
  function addRemote(id, msg) {
    const body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(msg.p[0], msg.p[1] + 0.83, msg.p[2]));
    const collider = phys.world.createCollider(R.ColliderDesc.capsule(0.55, 0.28).setFriction(0), body);
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const name = clean(msg.n, 24) || 'Guest';
    const creature = createAvatar(ctx, { hue: msg.h ?? 0.5, name, local: false, seed: (seed % 9973) + 3 });
    const r = { id, body, collider, creature, buf: [], off: null, name, hue: msg.h ?? 0.5, pos: new THREE.Vector3(...msg.p), vel: new THREE.Vector3(), yaw: msg.y || 0, grounded: true, swimming: false, pose: 'stand', seat: null, rtt: 0, last: performance.now() };
    peers.set(id, r); ui.toast(`${r.name} joined`); ui.setPeers(peers.size); refreshUI();
    return r;
  }
  function removeRemote(id, silent) {
    const r = peers.get(id); if (!r) return;
    r.creature.dispose(); try { phys.world.removeRigidBody(r.body); } catch {}
    peers.delete(id); if (!silent) ui.toast(`${r.name} left`); ui.setPeers(peers.size); refreshUI();
  }
  function onState(msg, id) {
    if (!msg || !Array.isArray(msg.p) || msg.p.length !== 3 || !msg.p.every(Number.isFinite)) return;
    if (!members.has(id) && room) members.add(id);
    let r = peers.get(id) || addRemote(id, msg);
    const now = performance.now();
    const n = clean(msg.n, 24); if (n && n !== r.name) { r.name = n; r.creature.setName(n); refreshUI(); }
    if (typeof msg.h === 'number' && Math.abs(msg.h - r.hue) > 1e-3) { r.hue = msg.h; r.creature.setHue(msg.h); }
    const off = now - msg.t; r.off = r.off === null || off < r.off ? off : r.off + (off - r.off) * 0.02;
    r.buf.push({ t: msg.t, p: msg.p, v: Array.isArray(msg.v) ? msg.v : [0, 0, 0], y: +msg.y || 0, g: msg.g, s: msg.s, q: msg.q | 0 }); if (r.buf.length > 40) r.buf.shift();
    if (Number.isInteger(msg.e)) r.emote = msg.e; // wave emote counter (B); older clients never send it
    const seat = typeof msg.c === 'string' ? msg.c.slice(0, 64) : null; if (seat !== r.seat) { r.seat = seat; rcHooks.onPeerSeat?.(id, seat); }
    r.last = now;
  }
  const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  function sampleRemote(r, now) {
    const b = r.buf; if (!b.length) return;
    const last = b[b.length - 1];
    if (last.q) { r.pos.set(last.p[0], last.p[1], last.p[2]); r.vel.set(0, 0, 0); r.yaw = last.y; r.grounded = true; r.swimming = false; r.pose = POSE_NAME[last.q] || 'stand'; return; }
    r.pose = 'stand';
    const rt = now - r.off - INTERP_MS;
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const s1 = b[i], s0 = b[Math.max(0, i - 1)];
    if (rt >= b[b.length - 1].t) {
      const s = b[b.length - 1]; const e = Math.min(0.25, (rt - s.t) / 1000);
      r.pos.set(s.p[0] + s.v[0] * e, s.p[1] + (s.g ? 0 : s.v[1] * e), s.p[2] + s.v[2] * e); r.vel.set(...s.v); r.yaw = lerpAng(r.yaw, s.y, 0.3); r.grounded = s.g; r.swimming = s.s; return;
    }
    const span = Math.max(1, s1.t - s0.t); let f = THREE.MathUtils.clamp((rt - s0.t) / span, 0, 1);
    if (s0.q !== s1.q) f = 1;
    r.pos.set(s0.p[0] + (s1.p[0] - s0.p[0]) * f, s0.p[1] + (s1.p[1] - s0.p[1]) * f, s0.p[2] + (s1.p[2] - s0.p[2]) * f);
    r.vel.set(s0.v[0] + (s1.v[0] - s0.v[0]) * f, s0.v[1] + (s1.v[1] - s0.v[1]) * f, s0.v[2] + (s1.v[2] - s0.v[2]) * f);
    r.yaw = lerpAng(s0.y, s1.y, f); r.grounded = f < 0.5 ? s0.g : s1.g; r.swimming = f < 0.5 ? s0.s : s1.s;
  }

  // ---------------------------------------------------------------- doors (one-time wrap)
  let applyingRemote = false;
  const doorById = new Map();
  for (const d of ctx.doors || []) {
    const id = d.o?.id; if (!id || doorById.has(id)) continue; doorById.set(id, d);
    let v = d.target;
    Object.defineProperty(d, 'target', {
      configurable: true, enumerable: true, get: () => v,
      set: (nv) => { const ch = nv !== v; v = nv; if (ch && !applyingRemote) { try { actions?.door.send({ id, t: nv }); } catch {} } },
    });
  }
  function applyDoor(id, t) {
    const d = doorById.get(id); if (!d || typeof t !== 'number' || d.target === t) return;
    applyingRemote = true;
    try {
      d.target = t;
      if (t > 0.5 && d.collider) { phys.remove(d.collider); d.collider = null; }
      if (t < 0.5) d.pendingClose = true;
    } finally { applyingRemote = false; }
  }

  // ---------------------------------------------------------------- splashes
  player.onSplash((x, y, z, s) => { if (s >= 1.2) { try { actions?.splash.send({ x, y, z, s }); } catch {} } });
  function onSplash(m) {
    if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.z) || !Number.isFinite(m.s)) return;
    for (const w of waterBodies) { try { if (w.isInside(m.x, m.z)) { w.splash(m.x, m.y, m.z, Math.min(3, m.s)); w.disturb(m.x, m.z, 0.8, Math.min(3, m.s)); break; } } catch {} }
  }

  // ---------------------------------------------------------------- local state
  let sendAcc = 0;
  function stateMsg() {
    const s = player.state, p = s.pos, v = player.velocity;
    const r3 = (x) => Math.round(x * 1000) / 1000;
    const m = { t: performance.now(), p: [r3(p.x), r3(p.y), r3(p.z)], v: [r3(v.x), r3(v.y), r3(v.z)], y: r3(s.facing), g: !!s.grounded, s: !!s.swimming, n: me.name, h: me.hue };
    const q = POSE_CODE[s.pose]; if (q) m.q = q;
    if (rcHooks.seatKey) m.c = rcHooks.seatKey;
    if (s.emote) m.e = s.emote;
    return m;
  }
  function sendState(force) { if (actions && (force || peers.size || room)) { try { actions.state.send(stateMsg()); } catch {} } }

  // ---------------------------------------------------------------- lobby meta + directory
  const isElected = () => { if (!meta) return false; for (const id of knowers) if (members.has(id) && id < selfId) return false; return true; };
  const announcer = () => (meta && code ? { code, name: meta.name, n: Math.min(meta.max, members.size + 1), max: meta.max, host: meta.host } : null);
  function updateAnnounce() { if (meta?.pub && room && isElected()) directory.setAnnouncer(announcer); else directory.setAnnouncer(null); }
  function adoptMeta(m, from) {
    const v = validMeta(m); if (!v) return;
    const had = !!meta;
    if (!meta || v.created < meta.created) meta = v;
    if (from) knowers.add(from);
    if (!had) { settledAt = performance.now(); try { actions?.lobby.send({ ...meta }); } catch {} emit('admitted', meta); }
    refreshUI(); updateAnnounce();
  }

  // ---------------------------------------------------------------- connect / leave
  async function connect(newCode, lobbyMeta) {
    if (room) leave({ quiet: true });
    code = cleanCode(newCode) || randomCode(); const my = ++session;
    creator = !!lobbyMeta; joinedAt = performance.now(); settledAt = lobbyMeta ? 0 : Infinity;
    meta = lobbyMeta ? validMeta({ ...lobbyMeta, created: Date.now(), host: lobbyMeta.host || me.name }) : null;
    setUrlRoom(code); refreshUI(); ui.setStatus('Connecting…');
    try {
      if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC unavailable');
      tr = tr || await import('trystero'); if (tr.selfId) selfId = tr.selfId;
      if (my !== session) return code;
      room = tr.joinRoom({ appId: APP_ID }, code);
      actions = {
        state: room.makeAction('st'), chat: room.makeAction('chat'), door: room.makeAction('door'),
        doors: room.makeAction('doors'), splash: room.makeAction('splash'), rc: room.makeAction('rc'), lobby: room.makeAction('lobby'),
      };
      const pid = (meta2) => meta2?.peerId ?? meta2;
      actions.rc.onMessage = (d, mm) => { if (d && typeof d === 'object') { try { rcHooks.onMessage?.(d, pid(mm)); } catch (e) { console.warn('[recreate]', e); } } };
      actions.state.onMessage = (d, mm) => onState(d, pid(mm));
      actions.chat.onMessage = (d, mm) => { const r = peers.get(pid(mm)); if (d && typeof d.t === 'string') ui.addChat(clean(d.n, 24) || r?.name || 'Guest', clean(d.t, 200), typeof d.h === 'number' ? d.h : r?.hue); };
      actions.door.onMessage = (d) => { if (d) applyDoor(d.id, d.t); };
      actions.doors.onMessage = (d) => { if (Array.isArray(d)) for (const x of d.slice(0, 200)) if (Array.isArray(x)) applyDoor(x[0], x[1]); };
      actions.splash.onMessage = (d) => onSplash(d);
      for (const ch of channels.values()) bindChannel(ch);
      actions.lobby.onMessage = (d, mm) => {
        if (!d || typeof d !== 'object' || my !== session) return;
        if (d.full === 1) { if (!creator && performance.now() - joinedAt < 30000) emit('full'); return; }
        adoptMeta(d, pid(mm));
      };
      room.onPeerJoin = (id) => {
        if (my !== session) return;
        members.add(id);
        if (meta && members.size + 1 > meta.max && performance.now() - settledAt > 3000) {
          // over capacity: the newest arrival gets turned away (it leaves on {full:1})
          try { actions.lobby.send({ full: 1 }, { target: id }); } catch {}
        }
        if (meta) { try { actions.lobby.send({ ...meta }, { target: id }); } catch {} }
        try { actions.state.send(stateMsg(), { target: id }); } catch {}
        const ds = []; for (const [did, d] of doorById) ds.push([did, d.target]);
        try { actions.doors.send(ds, { target: id }); } catch {}
        try { rcHooks.onPeerJoin?.(id); } catch (e) { console.warn('[recreate]', e); }
        callAll(joinFns, id);
        ui.setStatus(''); refreshUI(); updateAnnounce(); emit('peers');
      };
      room.onPeerLeave = (id) => {
        if (my !== session) return;
        members.delete(id); knowers.delete(id);
        removeRemote(id); try { rcHooks.onPeerLeave?.(id); } catch {}
        callAll(leaveFns, id);
        refreshUI(); updateAnnounce(); emit('peers');
      };
      ui.setStatus(meta?.pub ? 'Public lobby — listed for everyone' : 'Online — share the invite link');
      if (meta) emit('admitted', meta);
      updateAnnounce();
    } catch (e) {
      console.warn('[multiplayer] offline:', e.message); room = null; actions = null;
      ui.setStatus('Offline — single-player', true);
    }
    return code;
  }
  function leave({ quiet } = {}) {
    session++;
    const wasLast = members.size === 0;
    directory.setAnnouncer(null, { gone: wasLast && !!meta?.pub });
    for (const id of [...peers.keys()]) { if (id.startsWith('bot')) continue; removeRemote(id, true); try { rcHooks.onPeerLeave?.(id); } catch {} }
    for (const id of members) { try { rcHooks.onPeerLeave?.(id); } catch {} callAll(leaveFns, id); }
    members.clear(); knowers.clear();
    try { player.setSeat(null); } catch {}
    try { if (api.videos && api.videos.phase !== 'idle') api.videos.exit(); } catch {}
    try { room?.leave(); } catch {}
    room = null; actions = null; code = null; meta = null;
    for (const ch of channels.values()) ch._act = null;
    setUrlRoom(null); refreshUI(); ui.setStatus('');
    if (!quiet) emit('left');
  }
  addEventListener('pagehide', () => { try { room?.leave(); } catch {} });

  // ---------------------------------------------------------------- per frame
  let pingAcc = 4;
  ctx.onUpdate((dt) => {
    const now = performance.now();
    pingAcc += dt; if (pingAcc > 5 && room?.ping) { pingAcc = 0; for (const r of peers.values()) if (r.buf) room.ping(r.id).then(ms => { if (ms > 0 && ms < 5000) r.rtt = r.rtt ? r.rtt * 0.7 + ms * 0.3 : ms; }).catch(() => {}); }
    sendAcc += dt; if (sendAcc >= 1 / SEND_HZ) { sendAcc = 0; sendState(); }
    for (const r of peers.values()) {
      if (now - r.last > 15000) { removeRemote(r.id); continue; }
      if (r.buf) sampleRemote(r, now);
      r.body.setNextKinematicTranslation({ x: r.pos.x, y: r.pos.y + 0.83, z: r.pos.z });
      r.creature.update(dt, { pos: r.pos, vel: r.vel, yaw: r.yaw, grounded: r.grounded, swimming: r.swimming, pose: r.pose, emote: r.emote | 0 });
    }
  });

  // ---------------------------------------------------------------- api (stable across connections)
  const api = {
    get room() { return code; }, peers, members,
    get online() { return !!room; }, get connected() { return !!room; },
    get lobby() { return meta ? { code, ...meta, n: members.size + 1 } : (code ? { code, n: members.size + 1 } : null); },
    get selfId() { return selfId; }, get announcing() { return directory.isAnnouncing(); },
    selfName: () => me.name, applyDoor, connect, leave, directory, ui,
    setName(n) { const v = saveName(n); try { player.creature.setName(v); } catch {} sendState(true); refreshUI(); return v; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    channel, onPeerJoin(fn) { joinFns.add(fn); return () => joinFns.delete(fn); }, onPeerLeave(fn) { leaveFns.add(fn); return () => leaveFns.delete(fn); },
    inviteUrl() { const u = new URL(location.origin + location.pathname); if (code) u.searchParams.set('room', code); return u.toString(); },
  };
  window.__mp = api; window.__player = player; api.ctx = ctx;
  // ?bots=N : local wandering creatures (perf testing with several characters)
  const nb = Math.min(6, parseInt(params.get('bots') || '0', 10) || 0);
  for (let i = 0; i < nb; i++) {
    const id = 'bot' + i; const c = [9.8, 0.0, 7.2]; const ph = (i / nb) * Math.PI * 2;
    const bot = addRemote(id, { p: [c[0], c[1], c[2]], n: 'Bot ' + (i + 1), h: (me.hue + (i + 1) / (nb + 1)) % 1, y: 0 });
    bot.buf = null; bot.off = 0;
    ctx.onUpdate((dt, t) => {
      const a = ph + t * 0.6; const rad = 1.1 + 0.3 * i;
      bot.pos.set(c[0] + Math.cos(a) * rad, c[1], c[2] + Math.sin(a) * rad * 0.7);
      bot.vel.set(-Math.sin(a) * rad * 0.6, 0, Math.cos(a) * rad * 0.7 * 0.6); bot.yaw = Math.atan2(-bot.vel.x, -bot.vel.z); bot.last = performance.now();
    });
  }
  // ---------------------------------------------------------------- Re-create scenes
  const net = {
    get selfId() { return selfId; }, peers, hooks: rcHooks, sendState: () => sendState(true),
    send(msg, target) { if (!actions) return; try { actions.rc.send(msg, target ? { target } : undefined); } catch (e) { console.warn('[recreate] send', e); } },
    clock(id) { const r = peers.get(id); if (!r || r.off === null || r.off === undefined) return null; return r.off - (r.rtt || 0) / 2; },
  };
  api.net = net;
  try { api.recreate = startRecreate(ctx, api); } catch (e) { console.warn('[recreate] not started:', e); }
  try { api.videos = startVideos(ctx, api); } catch (e) { console.warn('[videos] not started:', e); }
  try { api.speaker = startSpeaker(ctx, api); } catch (e) { console.warn('[speaker] not started:', e); }
  try { const { startParty } = await import('./party/index.js'); api.party = startParty(ctx, api); } catch (e) { console.warn('[party] not started:', e); }
  try { api.games = (await import('./games/index.js')).startGames(ctx, api); } catch (e) { console.warn('[games] not started:', e); }
  try { api.avatars = startAvatarSync(ctx, api); } catch (e) { console.warn('[avatars] not started:', e); }
  return api;
}
