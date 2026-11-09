// Ping-pong ball physics on the east-deck table (src/rooms/pool.js pingPong at (19.6, -0.10, 24.9), long axis x).
// World metres. Gravity, quadratic drag, simple Magnus from a scalar top/back spin (dips / floats the ball) and
// side spin (curves it), table bounces (topspin kicks forward, backspin checks up), net, deck floor.
// Pure functions; the game (index.js) keeps one ball object and steps it with substeps.
export const TX = 19.6, TZ = 24.9, TY = 0.66, HL = 1.37, HW = 0.7625, NET_H = 0.1525, BR = 0.02, FLOOR = -0.10;
export const PLANE = 0.3;                                   // paddle plane distance behind each end line
export const planeX = (side) => (side === 0 ? TX - HL - PLANE : TX + HL + PLANE);
export const sgn = (side) => (side === 0 ? 1 : -1);         // direction side hits toward (+x for the west side)
export const sideOfX = (x) => (x < TX ? 0 : 1);
const G = 9.81, KD = 0.11, KT = 0.9, KS = 0.6;

export function makeBall() { return { p: [0, 0, 0], v: [0, 0, 0], top: 0, side: 0 }; }
export function copyBall(b) { return { p: b.p.slice(), v: b.v.slice(), top: b.top, side: b.side }; }
// one substep; returns an event string or null: 'table0' | 'table1' | 'net' | 'floor'
export function step(b, dt) {
  const [vx, vy, vz] = b.v; const sp = Math.hypot(vx, vy, vz); const hx = Math.abs(vx);
  b.v[0] -= KD * sp * vx * dt;
  b.v[1] += (-G - KD * sp * vy - KT * b.top * hx) * dt;
  b.v[2] += (-KD * sp * vz + KS * b.side * hx * Math.sign(vx || 1)) * dt;
  b.top *= 1 - 0.25 * dt; b.side *= 1 - 0.25 * dt;
  const px = b.p[0];
  b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
  // net
  if ((px - TX) * (b.p[0] - TX) <= 0 && px !== b.p[0] && b.p[1] < TY + NET_H + BR * 0.6 && b.p[1] > TY - 0.02 && Math.abs(b.p[2] - TZ) < HW + 0.15) {
    b.p[0] = TX - Math.sign(b.v[0]) * (BR + 0.002); b.v[0] *= -0.12; b.v[2] *= 0.5; b.v[1] *= 0.3; return 'net';
  }
  // table
  if (b.v[1] < 0 && b.p[1] - BR < TY && b.p[1] > TY - 0.06 && Math.abs(b.p[0] - TX) <= HL && Math.abs(b.p[2] - TZ) <= HW) {
    b.p[1] = TY + BR; b.v[1] = -b.v[1] * 0.88;
    const k = b.top > 0 ? 1 + 0.08 * b.top : 1 + 0.2 * b.top; b.v[0] *= k; b.v[2] *= 0.95; b.top *= 0.5;
    return b.p[0] < TX ? 'table0' : 'table1';
  }
  // deck
  if (b.v[1] < 0 && b.p[1] - BR < FLOOR) { b.p[1] = FLOOR + BR; b.v[1] = -b.v[1] * 0.55; b.v[0] *= 0.6; b.v[2] *= 0.6; return 'floor'; }
  return null;
}
// a shot from side h at paddle point p: aims at a landing point on the other half; returns { v, top, side }
//   depth 0..1.4 (fraction past the net, >1 = long), wide in metres from the centre line (|wide| > HW = out),
//   speed m/s horizontal, top -1..1. Solves the vertical launch speed so the ball lands there (net cleared).
export function aimShot(p, h, { depth = 0.6, wide = 0, speed = 5, top = 0, side = 0 } = {}) {
  const s = sgn(h); const tx = TX + s * (0.12 + depth * (HL - 0.12)), tz = TZ + wide;
  const dx = tx - p[0], dz = tz - p[2]; const dh = Math.hypot(dx, dz); const vh = Math.max(2.5, Math.min(9, speed));
  const ux = dx / dh, uz = dz / dh;
  const landY = (vy) => { // y when the ball reaches the target's distance (ignoring table/net), and min clearance at the net
    const b = { p: p.slice(), v: [ux * vh, vy, uz * vh], top, side }; let netY = Infinity; const d0 = 0;
    for (let i = 0; i < 1200; i++) {
      const ox = b.p[0]; free(b, 1 / 240);
      if ((ox - TX) * (b.p[0] - TX) <= 0 && ox !== b.p[0]) netY = b.p[1];
      const along = (b.p[0] - p[0]) * ux + (b.p[2] - p[2]) * uz; if (along >= dh - d0) return [b.p[1], netY];
      if (b.p[1] < FLOOR) return [b.p[1], netY];
    }
    return [b.p[1], netY];
  };
  let lo = -4, hi = 7; const want = TY + BR;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; const [y] = landY(mid); if (y > want) hi = mid; else lo = mid; }
  let vy = (lo + hi) / 2; let [, ny] = landY(vy);
  for (let i = 0; i < 20 && ny < TY + NET_H + BR + 0.025; i++) { vy += 0.12; ny = landY(vy)[1]; }
  return { v: [ux * vh, vy, uz * vh], top, side };
}
function free(b, dt) { // flight only (no table / net), for the solver and predictions
  const [vx, vy, vz] = b.v; const sp = Math.hypot(vx, vy, vz); const hx = Math.abs(vx);
  b.v[0] -= KD * sp * vx * dt; b.v[1] += (-G - KD * sp * vy - KT * b.top * hx) * dt; b.v[2] += (-KD * sp * vz + KS * b.side * hx * Math.sign(vx || 1)) * dt;
  b.top *= 1 - 0.25 * dt; b.side *= 1 - 0.25 * dt; b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
}
// where (y, z) the ball crosses side r's paddle plane after the bounce (null if it does not get there)
export function predictCross(ball, r) {
  const b = copyBall(ball); const X = planeX(r);
  for (let i = 0; i < 240 * 3; i++) {
    const ox = b.p[0]; const ev = step(b, 1 / 240);
    if (ev === 'floor' || ev === 'net') return null;
    if ((ox - X) * (b.p[0] - X) <= 0 && ox !== b.p[0]) return { y: b.p[1], z: b.p[2], t: i / 240 };
  }
  return null;
}
