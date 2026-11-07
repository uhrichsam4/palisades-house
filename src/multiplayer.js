// Multiplayer (walk mode only; main.js never imports this in photo-shot mode).
// Trystero (Nostr signalling -> WebRTC data channels). Room from ?room=, otherwise a short random
// code written into the URL so the link can be shared. Local state goes out at ~18 Hz; remote players
// are interpolated ~100 ms in the past and each runs its own local fluid simulation for visuals.
// Doors (wrapped `target`) and big splashes are synced; chat + join/leave toasts in #mp.
// Any networking failure leaves single-player untouched.
import * as THREE from 'three';
import { createAvatar } from './avatar.js';
import { waterBodies } from './water/index.js';
import { identity, setName as saveName } from './net/identity.js';
import { createUI } from './net/ui.js';

const APP_ID = 'palisades-house-17609';
const SEND_HZ = 18, INTERP_MS = 100;

function roomCode(params) {
  let code = (params.get('room') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  if (!code) {
    const A = 'abcdefghjkmnpqrstuvwxyz23456789'; code = '';
    const r = crypto.getRandomValues(new Uint8Array(6)); for (const b of r) code += A[b % A.length];
  }
  try { const u = new URL(location.href); if (u.searchParams.get('room') !== code) { u.searchParams.set('room', code); history.replaceState(history.state, '', u); } } catch {}
  return code;
}

export async function start(ctx) {
  if (ctx.shot) return null;
  const { player, phys, params } = ctx; const R = phys.RAPIER;
  const me = identity();
  const code = roomCode(params);
  const peers = new Map(); // peerId -> remote
  let room = null, actions = null;
  const ui = createUI({
    room: code, name: me.name,
    onName: (n) => { const v = saveName(n); player.creature.setName(v); sendState(true); return v; },
    onChat: (text) => { ui.addChat(me.name, text, me.hue, true); actions?.chat.send({ t: text.slice(0, 200), n: me.name, h: me.hue }); },
  });
  ui.setStatus('Connecting…');

  // ---------------------------------------------------------------- remote players
  function addRemote(id, msg) {
    const body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(msg.p[0], msg.p[1] + 0.83, msg.p[2]));
    const collider = phys.world.createCollider(R.ColliderDesc.capsule(0.55, 0.28).setFriction(0), body);
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const creature = createAvatar(ctx, { hue: msg.h ?? 0.5, name: msg.n || 'Guest', local: false, seed: (seed % 9973) + 3 });
    const r = { id, body, collider, creature, buf: [], off: null, name: msg.n || 'Guest', hue: msg.h ?? 0.5, pos: new THREE.Vector3(...msg.p), vel: new THREE.Vector3(), yaw: msg.y || 0, grounded: true, swimming: false, last: performance.now() };
    peers.set(id, r); ui.toast(`${r.name} joined`); ui.setPeers(peers.size);
    return r;
  }
  function removeRemote(id) {
    const r = peers.get(id); if (!r) return;
    r.creature.dispose(); try { phys.world.removeRigidBody(r.body); } catch {}
    peers.delete(id); ui.toast(`${r.name} left`); ui.setPeers(peers.size);
  }
  function onState(msg, id) {
    if (!msg || !Array.isArray(msg.p)) return;
    let r = peers.get(id) || addRemote(id, msg);
    const now = performance.now();
    if (msg.n && msg.n !== r.name) { r.name = msg.n; r.creature.setName(msg.n); }
    if (typeof msg.h === 'number' && Math.abs(msg.h - r.hue) > 1e-3) { r.hue = msg.h; r.creature.setHue(msg.h); }
    // sender clock -> local clock offset (track the fastest delivery, drift slowly upward)
    const off = now - msg.t; r.off = r.off === null || off < r.off ? off : r.off + (off - r.off) * 0.02;
    r.buf.push({ t: msg.t, p: msg.p, v: msg.v, y: msg.y, g: msg.g, s: msg.s }); if (r.buf.length > 40) r.buf.shift();
    r.last = now;
  }
  const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  function sampleRemote(r, now) {
    const b = r.buf; if (!b.length) return;
    const rt = now - r.off - INTERP_MS; // render time in the sender's clock
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const s1 = b[i], s0 = b[Math.max(0, i - 1)];
    if (rt >= b[b.length - 1].t) { // extrapolate briefly
      const s = b[b.length - 1]; const e = Math.min(0.25, (rt - s.t) / 1000);
      r.pos.set(s.p[0] + s.v[0] * e, s.p[1] + (s.g ? 0 : s.v[1] * e), s.p[2] + s.v[2] * e); r.vel.set(...s.v); r.yaw = lerpAng(r.yaw, s.y, 0.3); r.grounded = s.g; r.swimming = s.s; return;
    }
    const span = Math.max(1, s1.t - s0.t); const f = THREE.MathUtils.clamp((rt - s0.t) / span, 0, 1);
    r.pos.set(s0.p[0] + (s1.p[0] - s0.p[0]) * f, s0.p[1] + (s1.p[1] - s0.p[1]) * f, s0.p[2] + (s1.p[2] - s0.p[2]) * f);
    r.vel.set(s0.v[0] + (s1.v[0] - s0.v[0]) * f, s0.v[1] + (s1.v[1] - s0.v[1]) * f, s0.v[2] + (s1.v[2] - s0.v[2]) * f);
    r.yaw = lerpAng(s0.y, s1.y, f); r.grounded = f < 0.5 ? s0.g : s1.g; r.swimming = f < 0.5 ? s0.s : s1.s;
  }

  // ---------------------------------------------------------------- doors
  let applyingRemote = false;
  const doorById = new Map();
  for (const d of ctx.doors || []) {
    const id = d.o?.id; if (!id || doorById.has(id)) continue; doorById.set(id, d);
    let v = d.target;
    Object.defineProperty(d, 'target', {
      configurable: true, enumerable: true, get: () => v,
      set: (nv) => { const ch = nv !== v; v = nv; if (ch && !applyingRemote) actions?.door.send({ id, t: nv }); },
    });
  }
  function applyDoor(id, t) {
    const d = doorById.get(id); if (!d || typeof t !== 'number' || d.target === t) return;
    applyingRemote = true;
    try {
      d.target = t; // same collider bookkeeping main.js does for E
      if (t > 0.5 && d.collider) { phys.remove(d.collider); d.collider = null; }
      if (t < 0.5) d.pendingClose = true;
    } finally { applyingRemote = false; }
  }

  // ---------------------------------------------------------------- splashes
  player.onSplash((x, y, z, s) => { if (s >= 1.2) actions?.splash.send({ x, y, z, s }); });
  function onSplash(m) {
    if (!m || typeof m.x !== 'number') return;
    for (const w of waterBodies) { try { if (w.isInside(m.x, m.z)) { w.splash(m.x, m.y, m.z, Math.min(3, m.s)); w.disturb(m.x, m.z, 0.8, Math.min(3, m.s)); break; } } catch {} }
  }

  // ---------------------------------------------------------------- local state
  let sendAcc = 0;
  function stateMsg() {
    const s = player.state, p = s.pos, v = player.velocity;
    const r3 = (x) => Math.round(x * 1000) / 1000;
    return { t: performance.now(), p: [r3(p.x), r3(p.y), r3(p.z)], v: [r3(v.x), r3(v.y), r3(v.z)], y: r3(s.facing), g: !!s.grounded, s: !!s.swimming, n: me.name, h: me.hue };
  }
  function sendState(force) { if (actions && (force || peers.size || room)) { try { actions.state.send(stateMsg()); } catch {} } }

  // ---------------------------------------------------------------- connect (never throws into main)
  try {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC unavailable');
    const { joinRoom } = await import('trystero');
    room = joinRoom({ appId: APP_ID }, code);
    actions = {
      state: room.makeAction('st'), chat: room.makeAction('chat'), door: room.makeAction('door'),
      doors: room.makeAction('doors'), splash: room.makeAction('splash'),
    };
    actions.state.onMessage = (d, meta) => onState(d, meta?.peerId ?? meta);
    actions.chat.onMessage = (d, meta) => { const r = peers.get(meta?.peerId ?? meta); if (d && d.t) ui.addChat(d.n || r?.name || 'Guest', String(d.t).slice(0, 200), d.h ?? r?.hue); };
    actions.door.onMessage = (d) => { if (d) applyDoor(d.id, d.t); };
    actions.doors.onMessage = (d) => { if (Array.isArray(d)) for (const [id, t] of d) applyDoor(id, t); };
    actions.splash.onMessage = (d) => onSplash(d);
    room.onPeerJoin = (id) => {
      // greet the newcomer with our state + current door positions
      try { actions.state.send(stateMsg(), { target: id }); } catch {}
      const ds = []; for (const [did, d] of doorById) ds.push([did, d.target]);
      try { actions.doors.send(ds, { target: id }); } catch {}
      ui.setStatus('');
    };
    room.onPeerLeave = (id) => removeRemote(id);
    ui.setStatus('Online — share the invite link');
  } catch (e) {
    console.warn('[multiplayer] offline:', e.message); room = null; actions = null;
    ui.setStatus('Offline — single-player', true);
  }
  addEventListener('pagehide', () => { try { room?.leave(); } catch {} });

  // ---------------------------------------------------------------- per frame
  ctx.onUpdate((dt) => {
    const now = performance.now();
    sendAcc += dt; if (sendAcc >= 1 / SEND_HZ) { sendAcc = 0; sendState(); }
    for (const r of peers.values()) {
      if (now - r.last > 15000) { removeRemote(r.id); continue; } // silent peer
      if (r.buf) sampleRemote(r, now);
      r.body.setNextKinematicTranslation({ x: r.pos.x, y: r.pos.y + 0.83, z: r.pos.z });
      r.creature.update(dt, { pos: r.pos, vel: r.vel, yaw: r.yaw, grounded: r.grounded, swimming: r.swimming });
    }
  });

  // test / debug hooks
  const api = { room: code, peers, get online() { return !!room; }, selfName: () => me.name, applyDoor };
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
  return api;
}
