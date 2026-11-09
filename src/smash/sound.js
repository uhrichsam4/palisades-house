// Procedural impact sounds (src/smash): WebAudio buffers synthesised once at first use (no assets): glass shatter,
// ceramic crack, wood crunch, metal clang, plastic clack, fabric/heavy thud, punch, throw whoosh. Spatial (panner at the
// event, listener = camera), loudness from the impulse, a little pitch jitter, at most ~12 voices.
// The AudioContext starts on the first key / mouse press (browser autoplay rules).
const SR = 44100;
function mk(ctx, dur, fn) { const n = Math.floor(dur * SR); const b = ctx.createBuffer(1, n, SR); const d = b.getChannelData(0); fn(d, n); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); if (mx > 0) for (let i = 0; i < n; i++) d[i] /= mx; return b; }
const rnd = (a, b) => a + Math.random() * (b - a);
// simple one-pole filters
function hp(d, f) { const a = Math.exp(-2 * Math.PI * f / SR); let y = 0, x0 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x0); x0 = x; d[i] = y; } }
function lp(d, f) { const a = Math.exp(-2 * Math.PI * f / SR); let y = 0; for (let i = 0; i < d.length; i++) { y = (1 - a) * d[i] + a * y; d[i] = y; } }
function pings(d, n, count, f0, f1, dec0, dec1, t0 = 0.0, t1 = 0.25, amp = 1) {
  for (let k = 0; k < count; k++) {
    const f = rnd(f0, f1), st = Math.floor(rnd(t0, t1) * SR), dec = rnd(dec0, dec1), a = amp * rnd(0.3, 1);
    for (let i = st; i < n; i++) { const t = (i - st) / SR; const e = Math.exp(-t / dec); if (e < 0.002) break; d[i] += a * e * Math.sin(2 * Math.PI * f * t); }
  }
}
const SYN = {
  glass: (c) => mk(c, 1.1, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.9; } hp(d, 2500); pings(d, n, 44, 2600, 9000, 0.02, 0.12, 0, 0.55, 0.5); }),
  ceramic: (c) => mk(c, 0.7, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * (Math.exp(-t * 30) + 0.3 * Math.exp(-t * 6) * (Math.random() < 0.02 ? 3 : 0.3)); } hp(d, 900); pings(d, n, 14, 1300, 4200, 0.015, 0.06, 0, 0.3, 0.6); }),
  wood: (c) => mk(c, 0.75, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const crack = Math.random() < 0.004 * Math.exp(-t * 4) ? rnd(2, 5) : 1; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 7) * crack; } lp(d, 1800); hp(d, 120); pings(d, n, 4, 140, 320, 0.05, 0.12, 0, 0.05, 0.8); }),
  metal: (c) => mk(c, 1.4, (d, n) => { const fs = [rnd(380, 460), 0, 0, 0]; fs[1] = fs[0] * 2.76; fs[2] = fs[0] * 5.4; fs[3] = fs[0] * 8.93; for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; fs.forEach((f, k) => { s += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (2.5 + k * 1.6)) / (k + 1); }); d[i] = s + (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.5; } }),
  plastic: (c) => mk(c, 0.25, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 45); } lp(d, 3500); pings(d, n, 3, 600, 1400, 0.01, 0.03, 0, 0.01, 0.8); }),
  thud: (c) => mk(c, 0.4, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const f = 55 + 70 * Math.exp(-t * 25); d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11) + (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.35; } lp(d, 900); }),
  punch: (c) => mk(c, 0.3, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * (90 + 120 * Math.exp(-t * 40)) * t) * Math.exp(-t * 18) + (Math.random() * 2 - 1) * Math.exp(-t * 55) * 0.8; } lp(d, 2400); }),
  whoosh: (c) => mk(c, 0.45, (d, n) => { let y = 0; for (let i = 0; i < n; i++) { const t = i / SR; const env = Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 2; const f = 300 + 1600 * (t / 0.45); const a = Math.exp(-2 * Math.PI * f / SR); y = (1 - a) * (Math.random() * 2 - 1) + a * y; d[i] = y * env; } hp(d, 200); }),
  stone: (c) => mk(c, 0.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 22); } lp(d, 2600); pings(d, n, 6, 500, 1900, 0.01, 0.04, 0, 0.04, 0.7); }),
};
SYN.porcelain = SYN.ceramic; SYN.rubber = SYN.thud; SYN.fabric = SYN.thud; SYN.concrete = SYN.stone; SYN.drywall = SYN.stone; SYN.brick = SYN.stone; SYN.siding = SYN.wood;

export function createSound(camera) {
  let ac = null, out = null; const bufs = {}; let voices = 0; const VARIANTS = 3;
  const start = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = 0.9; out.connect(ac.destination); } catch { ac = null; }
  };
  addEventListener('pointerdown', start, { capture: true }); addEventListener('keydown', start, { capture: true });
  const buf = (k) => { const f = SYN[k] || SYN.thud; const key = SYN[k] ? k : 'thud'; const list = bufs[key] || (bufs[key] = []); if (list.length < VARIANTS) list.push(f(ac)); return list[(Math.random() * list.length) | 0]; };
  let lastL = 0;
  function listener() {
    const now = performance.now(); if (now - lastL < 60) return; lastL = now;
    const L = ac.listener; const p = camera.position; const f = { x: 0, y: 0, z: -1 }, u = { x: 0, y: 1, z: 0 };
    const e = camera.matrixWorld.elements; f.x = -e[8]; f.y = -e[9]; f.z = -e[10]; u.x = e[4]; u.y = e[5]; u.z = e[6];
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  }
  // play(kind, pos {x,y,z} | null, volume 0..1.5, rate)
  function play(kind, pos, vol = 1, rate = 1) {
    if (!ac || ac.state !== 'running' || voices > 12 || vol < 0.02) return;
    listener();
    const src = ac.createBufferSource(); src.buffer = buf(kind); src.playbackRate.value = rate * rnd(0.9, 1.1);
    const g = ac.createGain(); g.gain.value = Math.min(1.5, vol);
    src.connect(g);
    if (pos) { const pn = ac.createPanner(); pn.panningModel = 'equalpower'; pn.distanceModel = 'inverse'; pn.refDistance = 1.5; pn.maxDistance = 60; pn.rolloffFactor = 1.2;
      if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
      g.connect(pn); pn.connect(out); } else g.connect(out);
    voices++; src.onended = () => { voices--; try { src.disconnect(); g.disconnect(); } catch {} };
    src.start();
  }
  return { play, start, get running() { return !!ac && ac.state === 'running'; } };
}
