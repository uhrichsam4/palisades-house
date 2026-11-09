// Deterministic 2D billiards (8-ball) simulation + rules. Pure module: no three.js, no DOM, no Math.random /
// Math.sin / Math.cos inside the simulation: only + − × ÷ and Math.sqrt on doubles, fixed timestep, fixed
// iteration order, so every browser computes bit-identical results from the same inputs.
//
// Table frame (metres): x along the length 0..L (head rail x=0, foot rail x=L), y across 0..W. Balls 0 = cue,
// 1-7 solids, 8 = eight, 9-15 stripes. Ball state: position, velocity, angular velocity (wx, wy rolling axes,
// wz side spin). Physics: sliding friction until the contact point stops slipping (follow / draw emerge from the
// cue's spin), rolling resistance, side-spin decay, ball-ball (restitution 0.95, equal masses), cushions as line
// segments with rounded jaw tips (restitution 0.78, side spin bends the rebound), six pockets with jaws.
//
//   simulate(balls, shot) -> { final, frames, nFrames, events, firstHit, pocketed, rails }
//     balls: Array(16) of [x, y, on]   shot: { cue:[x,y], dir:[dx,dy] (unit), v (m/s), spin:[side, top] in -1..1 }
//     frames: Float32Array(nFrames * 32) ball positions every 1/60 s (for playback); events: [{f, k, a, b, s}]
//   rules: newRack(order) / applyShot(state, result) / legalPlacement(state, x, y)
export const L = 2.236, W = 1.118, R = 0.028575;
const G = 9.81, MU_S = 0.2, MU_R = 0.011, MU_SP = 0.045, E_BALL = 0.95, E_CUSH = 0.78;
export const DT = 1 / 480, STEPS_PER_FRAME = 8, MAX_STEPS = 480 * 40;
const CM = 0.088, SM = 0.066; // corner jaw offset from the corner along each rail, side pocket half-mouth
export const HEAD_X = L / 4, FOOT = [L * 0.75, W / 2];

// cushion segments [ax, ay, bx, by] and pocket capture circles [x, y, r]
export const SEGS = [];
export const POCKETS = [];
{
  const s = (ax, ay, bx, by) => SEGS.push([ax, ay, bx, by]);
  // long rails (y = 0 and y = W), split by the side pockets
  for (const y of [0, W]) { s(CM, y, L / 2 - SM, y); s(L / 2 + SM, y, L - CM, y); }
  // short rails
  for (const x of [0, L]) s(x, CM, x, W - CM);
  // corner jaws: parallel to the pocket axis
  const J = 0.042;
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [L, 0, -1, 1], [0, W, 1, -1], [L, W, -1, -1]]) {
    s(cx + sx * CM, cy, cx + sx * (CM - J), cy - sy * J);
    s(cx, cy + sy * CM, cx - sx * J, cy + sy * (CM - J));
    POCKETS.push([cx - sx * 0.02, cy - sy * 0.02, 0.062]);
  }
  // side jaws: slightly narrowing throat
  for (const [y, sy] of [[0, 1], [W, -1]]) {
    s(L / 2 - SM, y, L / 2 - SM + 0.012, y - sy * 0.045);
    s(L / 2 + SM, y, L / 2 + SM - 0.012, y - sy * 0.045);
    POCKETS.push([L / 2, y - sy * 0.045, 0.058]);
  }
}

export function simulate(balls, shot) {
  const N = 16;
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
  const wx = new Float64Array(N), wy = new Float64Array(N), wz = new Float64Array(N); const on = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const b = balls[i]; x[i] = b[0]; y[i] = b[1]; on[i] = b[2] ? 1 : 0; }
  // cue strike
  x[0] = shot.cue[0]; y[0] = shot.cue[1]; on[0] = 1;
  const dx = shot.dir[0], dy = shot.dir[1], v = shot.v;
  const side = shot.spin ? clamp(shot.spin[0], -1, 1) : 0, top = shot.spin ? clamp(shot.spin[1], -1, 1) : 0;
  vx[0] = dx * v; vy[0] = dy * v;
  // natural roll for velocity v along d is w = (-dy, dx) * v / R; top/back spin scales it (1.25 = strong follow, -1.25 = draw)
  const k = 1.25 * top * v / R;
  wx[0] = -dy * k; wy[0] = dx * k;
  wz[0] = 2.5 * 0.5 * side * v / R;

  const frames = []; const events = []; const pocketed = []; let firstHit = -1; let rails = 0; let railAfter = false;
  const frame = new Float32Array(N * 2);
  const snap = () => { const f = new Float32Array(N * 2); for (let i = 0; i < N; i++) { f[i * 2] = on[i] ? x[i] : -9; f[i * 2 + 1] = on[i] ? y[i] : -9; } frames.push(f); };
  snap(); void frame;
  const SLIDE_A = MU_S * G * DT, ROLL_A = MU_R * G * DT, SPIN_A = 2.5 * MU_SP * G / R * DT;
  let step = 0;
  for (; step < MAX_STEPS; step++) {
    let moving = 0;
    // ---- integrate
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      if (vx[i] === 0 && vy[i] === 0 && wx[i] === 0 && wy[i] === 0) { if (wz[i] !== 0) wz[i] = decay(wz[i], SPIN_A); continue; }
      moving++;
      const ux = vx[i] - R * wy[i], uy = vy[i] + R * wx[i];
      const us = Math.sqrt(ux * ux + uy * uy);
      if (us > 1e-6) {
        const du = 3.5 * SLIDE_A; const f = us <= du ? us / du : 1;
        const ax = SLIDE_A * f * ux / us, ay = SLIDE_A * f * uy / us;
        vx[i] -= ax; vy[i] -= ay; wx[i] -= 2.5 / R * ay; wy[i] += 2.5 / R * ax;
        if (f < 1) { wx[i] = -vy[i] / R; wy[i] = vx[i] / R; }
      } else {
        const s = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        if (s <= ROLL_A) { vx[i] = 0; vy[i] = 0; wx[i] = 0; wy[i] = 0; }
        else { const q = (s - ROLL_A) / s; vx[i] *= q; vy[i] *= q; wx[i] = -vy[i] / R; wy[i] = vx[i] / R; }
      }
      if (wz[i] !== 0) wz[i] = decay(wz[i], SPIN_A);
      x[i] += vx[i] * DT; y[i] += vy[i] * DT;
    }
    if (!moving) break;
    // ---- ball-ball
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      for (let j = i + 1; j < N; j++) {
        if (!on[j]) continue;
        const ex = x[j] - x[i], ey = y[j] - y[i]; const d2 = ex * ex + ey * ey;
        if (d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2); if (d === 0) continue;
        const nx = ex / d, ny = ey / d;
        const rel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
        const o = (2 * R - d) / 2; x[i] -= nx * o; y[i] -= ny * o; x[j] += nx * o; y[j] += ny * o;
        if (rel <= 0) continue;
        const jn = (1 + E_BALL) / 2 * rel;
        vx[i] -= jn * nx; vy[i] -= jn * ny; vx[j] += jn * nx; vy[j] += jn * ny;
        if (firstHit < 0 && (i === 0 || j === 0)) firstHit = i === 0 ? j : i;
        events.push({ f: frames.length, k: 'hit', a: i, b: j, s: rel });
      }
    }
    // ---- cushions
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      if (x[i] > 0.1 && x[i] < L - 0.1 && y[i] > 0.1 && y[i] < W - 0.1) continue; // far from every rail
      for (let s = 0; s < SEGS.length; s++) {
        const g = SEGS[s]; const sx = g[2] - g[0], sy = g[3] - g[1];
        let t = ((x[i] - g[0]) * sx + (y[i] - g[1]) * sy) / (sx * sx + sy * sy); if (t < 0) t = 0; else if (t > 1) t = 1;
        const qx = g[0] + sx * t, qy = g[1] + sy * t; const ex = x[i] - qx, ey = y[i] - qy; const d2 = ex * ex + ey * ey;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2); if (d === 0) continue;
        const nx = ex / d, ny = ey / d; x[i] = qx + nx * R; y[i] = qy + ny * R;
        const vn = vx[i] * nx + vy[i] * ny; if (vn >= 0) continue;
        vx[i] -= (1 + E_CUSH) * vn * nx; vy[i] -= (1 + E_CUSH) * vn * ny;
        // english: side spin pushes the rebound along the rail (tangent t = (-ny, nx)); friction trims the slide
        const tx = -ny, ty = nx; const kick = 0.18 * R * wz[i];
        vx[i] = vx[i] * 0.97 + tx * kick; vy[i] = vy[i] * 0.97 + ty * kick; wz[i] *= 0.55;
        // the cushion nose sits above the centre: it scrubs some top/back spin
        wx[i] *= 0.7; wy[i] *= 0.7;
        if (i === 0 || firstHit >= 0) { rails++; if (firstHit >= 0) railAfter = true; }
        events.push({ f: frames.length, k: 'rail', a: i, b: s, s: -vn });
      }
    }
    // ---- pockets
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      for (let p = 0; p < POCKETS.length; p++) {
        const P = POCKETS[p]; const ex = x[i] - P[0], ey = y[i] - P[1];
        if (ex * ex + ey * ey < P[2] * P[2]) { pocket(i, p); break; }
      }
      if (on[i] && (x[i] < -0.12 || x[i] > L + 0.12 || y[i] < -0.12 || y[i] > W + 0.12)) { // escaped through a jaw: nearest pocket
        let best = 0, bd = Infinity; for (let p = 0; p < POCKETS.length; p++) { const ex = x[i] - POCKETS[p][0], ey = y[i] - POCKETS[p][1]; const dd = ex * ex + ey * ey; if (dd < bd) { bd = dd; best = p; } }
        pocket(i, best);
      }
    }
    if ((step + 1) % STEPS_PER_FRAME === 0) snap();
  }
  function pocket(i, p) {
    on[i] = 0; vx[i] = vy[i] = wx[i] = wy[i] = wz[i] = 0; x[i] = POCKETS[p][0]; y[i] = POCKETS[p][1];
    pocketed.push(i); events.push({ f: frames.length, k: 'pocket', a: i, b: p, s: 0 });
  }
  snap();
  const final = []; for (let i = 0; i < N; i++) final.push([x[i], y[i], on[i]]);
  const flat = new Float32Array(frames.length * N * 2); frames.forEach((f, i) => flat.set(f, i * N * 2));
  return { final, frames: flat, nFrames: frames.length, events, firstHit, pocketed, rails, railAfter, steps: step };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const decay = (w, a) => (w > a ? w - a : w < -a ? w + a : 0);

// ------------------------------------------------------------------ rules (8-ball)
export const groupOf = (b) => (b >= 1 && b <= 7 ? 'solid' : b >= 9 && b <= 15 ? 'stripe' : b === 8 ? 'eight' : 'cue');
export const remaining = (S, g) => S.balls.reduce((n, b, i) => n + (b[2] && groupOf(i) === g ? 1 : 0), 0);

// order: 15 object-ball numbers for the rack slots (apex first, row by row); slot 4 (middle of row 3) must be 8
export function rackOrder(rand) {
  const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  shuffle(solids); shuffle(stripes);
  const slots = new Array(15).fill(0); slots[4] = 8;
  const flip = rand() < 0.5; slots[10] = flip ? solids.pop() : stripes.pop(); slots[14] = flip ? stripes.pop() : solids.pop(); // back corners differ
  const rest = shuffle([...solids, ...stripes]); for (let i = 0; i < 15; i++) if (!slots[i]) slots[i] = rest.pop();
  return slots;
}
export function newRack(order) {
  const balls = Array.from({ length: 16 }, () => [0, 0, 0]);
  balls[0] = [L * 0.25, W / 2, 1];
  const gap = 2 * R + 0.0002, rowDx = gap * Math.sqrt(3) / 2; let k = 0;
  for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
    const n = order[k++]; balls[n] = [FOOT[0] + row * rowDx, W / 2 + (j - row / 2) * gap, 1];
  }
  return balls;
}
export function freshState(order) {
  return { balls: newRack(order), turn: 0, groups: [null, null], inHand: 'kitchen', broken: false, phase: 'aim', winner: -1, foul: null, shotNo: 0, last: null };
}
function spotEight(balls) {
  let fx = FOOT[0];
  const free = (px) => balls.every((b, i) => i === 8 || !b[2] || (b[0] - px) * (b[0] - px) + (b[1] - FOOT[1]) * (b[1] - FOOT[1]) >= 4 * R * R);
  while (!free(fx) && fx < L - R) fx += R * 0.5;
  balls[8] = [fx, FOOT[1], 1];
}
export function legalPlacement(S, px, py) {
  if (px < R || px > L - R || py < R || py > W - R) return false;
  if (S.inHand === 'kitchen' && px > HEAD_X) return false;
  for (let i = 1; i < 16; i++) { const b = S.balls[i]; if (b[2] && (b[0] - px) * (b[0] - px) + (b[1] - py) * (b[1] - py) < 4 * R * R) return false; }
  return true;
}
// state S (plain JSON) + simulate() result -> new state (does not mutate S)
export function applyShot(S0, res) {
  const S = JSON.parse(JSON.stringify(S0)); S.balls = res.final.map(b => [b[0], b[1], b[2]]);
  const me = S.turn, opp = 1 - me; const breakShot = !S.broken; const mine = S.groups[me];
  const scratch = res.pocketed.includes(0); const eight = res.pocketed.includes(8);
  const objs = res.pocketed.filter(b => b !== 0 && b !== 8);
  const clearedBefore = mine ? S0.balls.every((b, i) => groupOf(i) !== mine || !b[2]) : false;
  let foul = null;
  if (scratch) foul = 'SCRATCH';
  else if (res.firstHit < 0) foul = 'NO CONTACT';
  else if (!breakShot) {
    const fh = groupOf(res.firstHit);
    if (mine) { if (clearedBefore ? res.firstHit !== 8 : fh !== mine) foul = 'WRONG BALL FIRST'; }
    else if (res.firstHit === 8) foul = 'WRONG BALL FIRST';
  }
  S.foul = foul; S.last = { pocketed: res.pocketed, firstHit: res.firstHit, by: me }; S.shotNo++; S.inHand = null;
  if (eight) {
    if (breakShot) { spotEight(S.balls); }
    else { S.phase = 'over'; S.winner = !foul && clearedBefore ? me : opp; S.reason = S.winner === me ? 'EIGHT' : foul ? 'EIGHT ON A FOUL' : 'EIGHT TOO EARLY'; S.broken = true; return S; }
  }
  // group assignment: first legal pocket after the break
  let cont = false;
  if (!foul) {
    if (breakShot) cont = objs.length > 0;
    else if (!S.groups[me] && objs.length) { const g = groupOf(objs[0]); S.groups[me] = g; S.groups[opp] = g === 'solid' ? 'stripe' : 'solid'; cont = true; }
    else if (S.groups[me]) cont = objs.some(b => groupOf(b) === S.groups[me]);
  }
  S.broken = true;
  if (foul) { S.turn = opp; S.inHand = 'any'; S.balls[0] = [L * 0.25, W / 2, 0]; }
  else if (!cont) S.turn = opp;
  if (scratch && !foul) S.balls[0][2] = 0;
  return S;
}
// timeout foul: turn passes with ball in hand
export function timeoutFoul(S0) { const S = JSON.parse(JSON.stringify(S0)); S.foul = 'TIME'; S.turn = 1 - S.turn; S.inHand = 'any'; S.shotNo++; S.last = null; return S; }

// aim helper (UI + bot, not part of the shared simulation): first contact along a ray from the cue ball
export function firstContact(balls, cx, cy, dx, dy) {
  let best = Infinity, hit = -1;
  for (let i = 1; i < 16; i++) {
    const b = balls[i]; if (!b[2]) continue;
    const ox = b[0] - cx, oy = b[1] - cy; const t = ox * dx + oy * dy; if (t <= 0) continue;
    const pd2 = ox * ox + oy * oy - t * t; const rr = 4 * R * R; if (pd2 > rr) continue;
    const tt = t - Math.sqrt(rr - pd2); if (tt < best) { best = tt; hit = i; }
  }
  // cushion (inner rectangle offset by R)
  let tc = Infinity;
  if (dx > 0) tc = Math.min(tc, (L - R - cx) / dx); if (dx < 0) tc = Math.min(tc, (R - cx) / dx);
  if (dy > 0) tc = Math.min(tc, (W - R - cy) / dy); if (dy < 0) tc = Math.min(tc, (R - cy) / dy);
  if (best < tc) return { t: best, ball: hit, gx: cx + dx * best, gy: cy + dy * best };
  return { t: tc, ball: -1, gx: cx + dx * tc, gy: cy + dy * tc };
}

// simple bot: ghost-ball aiming at the best pocket for its group (+ angular error), else a safety at its nearest ball
export function botShot(S, rand, skill = 1) {
  const me = S.turn; const g = S.groups[me]; const balls = S.balls;
  let cue = balls[0][2] ? [balls[0][0], balls[0][1]] : null;
  if (!cue || S.inHand) cue = placeFor(S);
  if (!S.broken) { const a = [FOOT[0] - cue[0], FOOT[1] - cue[1] + (rand() - 0.5) * 0.01]; const n = Math.hypot(a[0], a[1]); return { cue, dir: [a[0] / n, a[1] / n], v: 7.2, spin: [0, 0.1] }; }
  const cleared = g && balls.every((b, i) => groupOf(i) !== g || !b[2]);
  const targets = []; for (let i = 1; i < 16; i++) { if (!balls[i][2]) continue; const gi = groupOf(i); if (cleared ? i === 8 : g ? gi === g : i !== 8) targets.push(i); }
  const clearPath = (ax, ay, bx, by, skip) => { const sx = bx - ax, sy = by - ay, l2 = sx * sx + sy * sy; for (let i = 1; i < 16; i++) { if (skip.includes(i) || !balls[i][2]) continue; let t = ((balls[i][0] - ax) * sx + (balls[i][1] - ay) * sy) / l2; if (t < 0 || t > 1) continue; const qx = ax + sx * t - balls[i][0], qy = ay + sy * t - balls[i][1]; if (qx * qx + qy * qy < 4 * R * R * 1.05) return false; } return true; };
  let best = null;
  for (const ti of targets) for (const P of POCKETS) {
    const T = balls[ti]; let px = P[0] - T[0], py = P[1] - T[1]; const pl = Math.hypot(px, py); px /= pl; py /= pl;
    const gx = T[0] - px * 2 * R, gy = T[1] - py * 2 * R; let ax = gx - cue[0], ay = gy - cue[1]; const al = Math.hypot(ax, ay); if (al < 1e-4) continue; ax /= al; ay /= al;
    const cut = ax * px + ay * py; if (cut < 0.3) continue;
    if (!clearPath(cue[0], cue[1], gx, gy, [ti]) || !clearPath(T[0], T[1], P[0], P[1], [ti])) continue;
    const score = cut * 2 - al * 0.35 - pl * 0.5;
    if (!best || score > best.score) best = { score, dir: [ax, ay], dist: al + pl / Math.max(0.3, cut) };
  }
  let shot;
  if (best) { const v = Math.min(6.5, Math.sqrt(2 * 0.12 * 9.81 * best.dist) + 0.9); shot = { cue, dir: best.dir, v, spin: [0, (rand() - 0.5) * 0.4] }; }
  else { // safety: hit the nearest legal ball firmly
    let tb = targets[0], bd = Infinity; for (const ti of targets) { const d = Math.hypot(balls[ti][0] - cue[0], balls[ti][1] - cue[1]); if (d < bd) { bd = d; tb = ti; } }
    const a = tb ? [balls[tb][0] - cue[0], balls[tb][1] - cue[1]] : [1, 0]; const n = Math.hypot(a[0], a[1]); shot = { cue, dir: [a[0] / n, a[1] / n], v: 3.2, spin: [0, 0] };
  }
  const err = (rand() + rand() + rand() - 1.5) * 0.035 / skill; // ~±2° worst case
  const c = Math.cos(err), s = Math.sin(err); shot.dir = [shot.dir[0] * c - shot.dir[1] * s, shot.dir[0] * s + shot.dir[1] * c];
  return shot;
}
export function placeFor(S) {
  const tries = S.inHand === 'kitchen' || !S.broken ? [[L * 0.25, W / 2], [L * 0.2, W * 0.4], [L * 0.2, W * 0.6]] : [[L * 0.25, W / 2], [L * 0.5, W / 2], [L * 0.3, W * 0.3], [L * 0.3, W * 0.7], [L * 0.6, W * 0.3]];
  for (const p of tries) if (legalPlacement({ ...S, inHand: S.inHand || 'any' }, p[0], p[1])) return p;
  for (let i = 0; i < 400; i++) { const p = [R + (i % 20) / 20 * (L / 4 - 2 * R), R + Math.floor(i / 20) / 20 * (W - 2 * R)]; if (legalPlacement({ ...S, inHand: 'kitchen' }, p[0], p[1])) return p; }
  return [L * 0.25, W / 2];
}
