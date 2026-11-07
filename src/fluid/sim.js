// Water-creature fluid simulation (pure JS, no imports: runs inside a module Web Worker or inline).
//
// Model: position-based fluids (Macklin & Müller 2013) on ~640 particles. Each "attached" particle is
// pulled by a soft damped spring towards its rest slot in a droplet-creature shape that rides on the
// player's controller capsule (anchor = feet position, facing = yaw). Gravity is only partly cancelled,
// so the body sags, sloshes and lags behind accelerations; the PBF density constraint keeps it
// incompressible, which turns a hard landing into a squash and a jump into a stretch. Surface particles
// shed as droplets when running / jumping / landing; droplets fall ballistically, splat on the floor
// as little puddles, then either flow back into the body (if it is close) or evaporate and re-condense
// inside it. Particles collide with a ground heightfield + wall planes sampled by the main thread with
// Rapier ray casts.
//
// Output each step: an iso-surface mesh of the attached particles (surface nets over a scalar field,
// vertices relative to the anchor, smooth gradient normals), droplet instances, head centre for eyes.

// ----------------------------------------------------------------------------------- creature shape
// local frame: feet at origin, +y up, forward = -z (three.js camera convention; yaw rotates about y)
const BODY = { cx: 0, cy: 0.50, cz: 0.03, rx: 0.37, ry: 0.50, rz: 0.34 };
const HEAD = { cx: 0, cy: 1.18, cz: -0.02, r: 0.265 };
function sdEllipsoid(x, y, z, e) {
  const qx = (x - e.cx) / e.rx, qy = (y - e.cy) / e.ry, qz = (z - e.cz) / e.rz;
  const k0 = Math.hypot(qx, qy, qz), k1 = Math.hypot(qx / e.rx, qy / e.ry, qz / e.rz);
  return k1 < 1e-6 ? -Math.min(e.rx, e.ry, e.rz) : (k0 * (k0 - 1)) / k1;
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function shapeSDF(x, y, z) {
  return smin(sdEllipsoid(x, y, z, BODY), Math.hypot(x - HEAD.cx, y - HEAD.cy, z - HEAD.cz) - HEAD.r, 0.18);
}
export const HEAD_CENTER = [HEAD.cx, HEAD.cy, HEAD.cz];
export const HEAD_RADIUS = HEAD.r;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ----------------------------------------------------------------------------------- render grid
const CS = 0.045;                                  // field cell size (m)
const GX0 = -0.86, GY0 = -0.42, GZ0 = -0.86;       // grid origin relative to anchor
const NX = 39, NY = 53, NZ = 39;                   // nodes  (1.71 x 2.34 x 1.71 m)

const ST_BODY = 0, ST_FLY = 1, ST_PUDDLE = 2, ST_MERGE = 3;

export class CreatureSim {
  constructor({ count = 640, seed = 1 } = {}) {
    const rand = this.rand = rng(seed * 9781 + 7);
    // --- rest slots: jittered lattice inside the shape, spacing chosen to give ~count particles
    const inset = 0.05;
    const sample = (d) => {
      const pts = [];
      for (let y = -0.1; y < 1.6; y += d * 0.866) for (let x = -0.6; x < 0.6; x += d) for (let z = -0.6; z < 0.6; z += d) {
        const row = Math.round(y / (d * 0.866));
        const px = x + (row & 1 ? d * 0.5 : 0), pz = z + (row & 1 ? d * 0.5 : 0);
        if (shapeSDF(px, y, pz) < -inset) pts.push(px, y, pz);
      }
      return pts;
    };
    let lo = 0.03, hi = 0.2, pts = null;
    for (let it = 0; it < 30; it++) { const d = (lo + hi) / 2; pts = sample(d); if (pts.length / 3 > count) lo = d; else hi = d; }
    pts = sample(lo);
    // drop random extras to hit `count` exactly
    const idx = [...Array(pts.length / 3).keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const N = this.N = Math.min(count, idx.length);
    this.spacing = lo;
    const A = (n = N) => new Float32Array(n);
    this.rx = A(); this.ry = A(); this.rz = A(); this.surf = new Uint8Array(N); this.headP = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const k = idx[i] * 3; const j = lo * 0.15;
      this.rx[i] = pts[k] + (rand() - 0.5) * j; this.ry[i] = pts[k + 1] + (rand() - 0.5) * j; this.rz[i] = pts[k + 2] + (rand() - 0.5) * j;
      this.surf[i] = shapeSDF(this.rx[i], this.ry[i], this.rz[i]) > -inset - lo * 1.2 ? 1 : 0;
      this.headP[i] = this.ry[i] > HEAD.cy - 0.12 ? 1 : 0;
    }
    this.x = A(); this.y = A(); this.z = A(); this.vx = A(); this.vy = A(); this.vz = A();
    this.px = A(); this.py = A(); this.pz = A(); this.dx = A(); this.dy = A(); this.dz = A();
    this.lam = A(); this.rho = A(); this.life = A(); this.size = A(); this.contact = new Uint8Array(N);
    this.state = new Uint8Array(N);
    for (let i = 0; i < N; i++) this.size[i] = 0.02 + rand() * 0.022;
    // --- kernels
    const H = this.H = lo * 2.1; this.H2 = H * H;
    this.poly6 = 315 / (64 * Math.PI * H ** 9); this.spikyG = -45 / (Math.PI * H ** 6);
    this.R = lo * 2.3; // render splat radius (wider = smoother surface)
    // --- spatial hash
    this.TB = 4096; this.head = new Int32Array(this.TB); this.next = new Int32Array(N);
    this.MAXN = 48; this.nbr = new Int32Array(N * this.MAXN); this.ncnt = new Int32Array(N);
    // --- anchor / control state
    this.a = [0, 0, 0]; this.av = [0, 0, 0]; this.yaw = 0; this.grounded = true; this.swim = false; this.waterY = -1e9;
    this.dis = 0; this.sq = 0; this.sqV = 0; this.lastAvy = 0; this.inited = false; this.t = 0;
    this.ground = new Float32Array(25).fill(-1e9); this.gStep = 0.35; this.gx = 0; this.gz = 0; this.walls = new Float32Array(0);
    this.events = [];
    // rest density from the rest configuration (interior particles)
    this._resetToRest();
    this._neighbours(this.x, this.y, this.z);
    let s = 0, n = 0, mx = 0;
    for (let i = 0; i < N; i++) { const r = this._density(i, this.x, this.y, this.z); mx = Math.max(mx, r); if (!this.surf[i]) { s += r; n++; } }
    this.rho0 = n ? s / n : mx;
    // typical constraint-gradient magnitude -> relaxation epsilon
    let gs = 0;
    for (let i = 0; i < N; i++) if (!this.surf[i]) { gs = this._gradSum(i, this.x, this.y, this.z); break; }
    this.eps = Math.max(1e-6, gs * 0.08);
    // iso level from rest field
    this.field = new Float32Array(NX * NY * NZ); this.vidx = new Int32Array(NX * NY * NZ);
    this._splat(0, 0, 0);
    let fs = 0, fn = 0;
    for (let i = 0; i < N; i++) if (!this.surf[i]) { fs += this._sampleField(this.rx[i], this.ry[i], this.rz[i]); fn++; }
    this.iso = (fn ? fs / fn : 1) * 0.42;
    this.inited = false;
    // output buffers (grow on demand)
    this.oPos = new Float32Array(30000); this.oNrm = new Float32Array(30000); this.oIdx = new Uint32Array(60000);
    this.oDrop = new Float32Array(N * 5);
    this.info = { N, spacing: lo, H, rho0: this.rho0, iso: this.iso };
  }

  // ------------------------------------------------------------------------------- helpers
  _target(i, out) {
    const sqY = 1 + this.sq, sqXZ = 1 / Math.sqrt(Math.max(0.55, sqY));
    let lx = this.rx[i] * sqXZ, ly = this.ry[i] * sqY, lz = this.rz[i] * sqXZ;
    if (this.dis > 0 && this.a[1] + ly < this.waterY + 0.05) {
      // dissolving into a pool: the submerged part of the body loosens and spreads out
      const f = 1 + 1.6 * this.dis; lx *= f; lz *= f; ly -= 0.25 * this.dis * (this.waterY - this.a[1] - ly > 0 ? 1 : 0);
    }
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    out[0] = this.a[0] + lx * c + lz * s; out[1] = this.a[1] + ly; out[2] = this.a[2] - lx * s + lz * c;
  }
  _resetToRest() {
    const t = [0, 0, 0];
    for (let i = 0; i < this.N; i++) {
      this._target(i, t); this.x[i] = t[0]; this.y[i] = t[1]; this.z[i] = t[2];
      this.vx[i] = this.av[0]; this.vy[i] = this.av[1]; this.vz[i] = this.av[2]; this.state[i] = ST_BODY; this.life[i] = 0;
    }
  }
  _respawn(i) {
    const t = [0, 0, 0]; this._target(i, t);
    this.x[i] = t[0]; this.y[i] = t[1]; this.z[i] = t[2]; this.vx[i] = this.av[0]; this.vy[i] = this.av[1]; this.vz[i] = this.av[2];
    this.state[i] = ST_BODY; this.life[i] = 0;
  }
  _hash(ix, iy, iz) { return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & (this.TB - 1); }
  _neighbours(X, Y, Z) {
    const { N, H, H2, head, next, nbr, ncnt, MAXN, state } = this; head.fill(-1);
    for (let i = 0; i < N; i++) {
      if (state[i] === ST_PUDDLE) continue;
      const h = this._hash(Math.floor(X[i] / H), Math.floor(Y[i] / H), Math.floor(Z[i] / H)); next[i] = head[h]; head[h] = i;
    }
    for (let i = 0; i < N; i++) {
      ncnt[i] = 0; if (state[i] === ST_PUDDLE) continue;
      const cx = Math.floor(X[i] / H), cy = Math.floor(Y[i] / H), cz = Math.floor(Z[i] / H); let n = 0; const base = i * MAXN;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        for (let j = head[this._hash(cx + a, cy + b, cz + c)]; j !== -1; j = next[j]) {
          if (j === i || n >= MAXN) continue;
          const dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j];
          if (dx * dx + dy * dy + dz * dz < H2) nbr[base + n++] = j;
        }
      }
      ncnt[i] = n;
    }
  }
  _density(i, X, Y, Z) {
    const { H2, poly6, nbr, ncnt, MAXN } = this; let r = poly6 * H2 * H2 * H2; const base = i * MAXN;
    for (let k = 0; k < ncnt[i]; k++) { const j = nbr[base + k]; const dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j]; const q = H2 - (dx * dx + dy * dy + dz * dz); if (q > 0) r += poly6 * q * q * q; }
    return r;
  }
  _gradSum(i, X, Y, Z) {
    const { H, spikyG, nbr, ncnt, MAXN, rho0 } = this; let gx = 0, gy = 0, gz = 0, s2 = 0; const base = i * MAXN; const inv = 1 / (rho0 || 1);
    for (let k = 0; k < ncnt[i]; k++) {
      const j = nbr[base + k]; const dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j]; const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < 1e-6 || r >= H) continue; const g = (spikyG * (H - r) * (H - r)) / r * inv;
      gx += g * dx; gy += g * dy; gz += g * dz; s2 += g * g * r * r;
    }
    return gx * gx + gy * gy + gz * gz + s2;
  }
  groundAt(x, z) {
    // bilinear over the 5x5 ray-cast samples centred at (gx, gz)
    const s = this.gStep; let u = (x - this.gx) / s + 2, v = (z - this.gz) / s + 2;
    u = Math.min(3.999, Math.max(0, u)); v = Math.min(3.999, Math.max(0, v));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, G = this.ground;
    const a = G[j * 5 + i], b = G[j * 5 + i + 1], c = G[(j + 1) * 5 + i], d = G[(j + 1) * 5 + i + 1];
    const lo = Math.min(a, b, c, d); if (lo < -1e8) return Math.max(a, b, c, d) < -1e8 ? -1e9 : (fu < 0.5 ? (fv < 0.5 ? a : c) : (fv < 0.5 ? b : d));
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  }

  // ------------------------------------------------------------------------------- step
  step(inp) {
    const dtIn = Math.min(Math.max(inp.dt || 0, 0), 0.05);
    const na = inp.anchor, prevA = this.a;
    const jump = Math.hypot(na[0] - prevA[0], na[1] - prevA[1], na[2] - prevA[2]);
    const wasGrounded = this.grounded;
    this.a = [na[0], na[1], na[2]]; this.av = [inp.vel[0], inp.vel[1], inp.vel[2]];
    this.yaw = inp.yaw; this.grounded = !!inp.grounded; this.swim = !!inp.swimming; this.waterY = inp.waterY ?? -1e9;
    if (inp.ground) { this.ground.set(inp.ground); this.gStep = inp.gStep; this.gx = inp.gCenter[0]; this.gz = inp.gCenter[1]; }
    this.walls = inp.walls || new Float32Array(0);
    this.events.length = 0;
    if (!this.inited || jump > 2.5) { this.inited = true; this.sq = 0; this.sqV = 0; this._resetToRest(); }
    // landing / take-off events
    if (!wasGrounded && this.grounded && this.lastAvy < -2.4 && !this.swim) this._land(-this.lastAvy);
    if (wasGrounded && !this.grounded && this.av[1] > 2.0 && !this.swim) this._takeoff(this.av[1]);
    this.lastAvy = this.av[1];
    if (dtIn > 0) {
      const n = Math.max(1, Math.ceil(dtIn / (1 / 60) - 0.01)); const h = dtIn / n;
      for (let s = 0; s < n; s++) this._substep(h);
      this.t += dtIn;
    }
    return this._output();
  }
  _land(speed) {
    this.sqV -= Math.min(2.6, speed * 0.42);
    const count = Math.min(26, Math.round((speed - 2.2) * 6));
    const ax = this.a[0], az = this.a[2]; let made = 0;
    for (let tries = 0; tries < count * 6 && made < count; tries++) {
      const i = Math.floor(this.rand() * this.N); if (this.state[i] !== ST_BODY || !this.surf[i] || this.ry[i] > 0.4) continue;
      let ox = this.x[i] - ax, oz = this.z[i] - az; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
      const sp = 1.0 + speed * 0.32 + this.rand() * 0.8;
      this.state[i] = ST_FLY; this.vx[i] = ox * sp + this.av[0] * 0.5; this.vz[i] = oz * sp + this.av[2] * 0.5; this.vy[i] = 0.9 + this.rand() * (0.8 + speed * 0.15);
      made++;
    }
  }
  _takeoff(vy) {
    this.sqV += 1.6;
    let made = 0;
    for (let tries = 0; tries < 60 && made < 7; tries++) {
      const i = Math.floor(this.rand() * this.N); if (this.state[i] !== ST_BODY || !this.surf[i] || this.ry[i] > 0.3) continue;
      this.state[i] = ST_FLY; this.vy[i] = this.av[1] * (0.25 + this.rand() * 0.3); this.vx[i] += (this.rand() - 0.5) * 0.8; this.vz[i] += (this.rand() - 0.5) * 0.8; made++;
    }
  }
  _detached() { let n = 0; for (let i = 0; i < this.N; i++) if (this.state[i] !== ST_BODY) n++; return n; }

  _substep(h) {
    const { N, x, y, z, vx, vy, vz, px, py, pz, state } = this;
    const G = -9.81; const ax = this.a[0], ay = this.a[1], az = this.a[2]; const avx = this.av[0], avy = this.av[1], avz = this.av[2];
    // dissolve factor (swimming)
    this.dis += ((this.swim ? 1 : 0) - this.dis) * Math.min(1, h * (this.swim ? 2.2 : 1.3));
    // squash/stretch spring (volume-preserving deformation of the rest shape)
    const sqT = this.grounded || this.swim ? 0 : Math.max(-0.08, Math.min(0.13, avy * 0.03));
    this.sqV += (-70 * (this.sq - sqT) - 7.5 * this.sqV) * h; this.sq += this.sqV * h; this.sq = Math.max(-0.4, Math.min(0.3, this.sq));
    const K = 50 * (1 - 0.55 * this.dis), Cd = 4.8; const support = 0.8; // fraction of gravity the creature holds up
    const t = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const st = state[i];
      if (st === ST_BODY || st === ST_MERGE) {
        this._target(i, t);
        const k = st === ST_BODY ? K : 22, c = st === ST_BODY ? Cd : 2.2;
        let fx = k * (t[0] - x[i]) - c * (vx[i] - avx), fy = k * (t[1] - y[i]) - c * (vy[i] - avy) + G * (1 - (st === ST_BODY ? support : 0.2)), fz = k * (t[2] - z[i]) - c * (vz[i] - avz);
        if (st === ST_BODY && this.dis > 0.01 && y[i] < this.waterY) { // gentle swirl in the pool
          const ph = this.t * 1.7 + i * 0.37; fx += Math.sin(ph) * 1.2 * this.dis; fz += Math.cos(ph * 1.3) * 1.2 * this.dis;
        }
        vx[i] += fx * h; vy[i] += fy * h; vz[i] += fz * h;
      } else if (st === ST_FLY) {
        vy[i] += G * h; const d = 1 - 0.35 * h; vx[i] *= d; vy[i] *= d; vz[i] *= d;
      } else { vx[i] = vy[i] = vz[i] = 0; }
      px[i] = x[i] + vx[i] * h; py[i] = y[i] + vy[i] * h; pz[i] = z[i] + vz[i] * h; this.contact[i] = 0;
    }
    // --- PBF incompressibility (repulsive only; cohesion comes from the attractor)
    this._neighbours(px, py, pz);
    const { H, spikyG, nbr, ncnt, MAXN, lam, dx, dy, dz } = this; const inv = 1 / this.rho0;
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < N; i++) {
        if (state[i] === ST_PUDDLE) { lam[i] = 0; continue; }
        const C = this._density(i, px, py, pz) * inv - 1;
        lam[i] = C > 0 ? -C / (this._gradSum(i, px, py, pz) + this.eps) : 0;
      }
      for (let i = 0; i < N; i++) {
        let sx = 0, sy = 0, sz = 0; const base = i * MAXN;
        if (state[i] !== ST_PUDDLE) for (let k = 0; k < ncnt[i]; k++) {
          const j = nbr[base + k]; const ex = px[i] - px[j], ey = py[i] - py[j], ez = pz[i] - pz[j]; const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
          if (r < 1e-6 || r >= H) continue; const g = ((lam[i] + lam[j]) * spikyG * (H - r) * (H - r)) / r;
          sx += g * ex; sy += g * ey; sz += g * ez;
        }
        dx[i] = sx * inv; dy[i] = sy * inv; dz[i] = sz * inv;
      }
      for (let i = 0; i < N; i++) {
        // limit per-iteration correction (stability with clumped flying droplets)
        const l = Math.hypot(dx[i], dy[i], dz[i]), m = 0.04; const f = l > m ? m / l : 1;
        px[i] += dx[i] * f; py[i] += dy[i] * f; pz[i] += dz[i] * f;
        this._collide(i);
      }
    }
    // --- velocities, XSPH viscosity, state machine
    const ih = 1 / h;
    for (let i = 0; i < N; i++) { vx[i] = (px[i] - x[i]) * ih; vy[i] = (py[i] - y[i]) * ih; vz[i] = (pz[i] - z[i]) * ih; }
    const visc = 0.04;
    for (let i = 0; i < N; i++) {
      if (state[i] !== ST_BODY) continue; let sx = 0, sy = 0, sz = 0, w = 0; const base = i * MAXN;
      for (let k = 0; k < ncnt[i]; k++) { const j = nbr[base + k]; if (state[j] !== ST_BODY) continue; sx += vx[j]; sy += vy[j]; sz += vz[j]; w++; }
      if (w) { dx[i] = (sx / w - vx[i]) * visc; dy[i] = (sy / w - vy[i]) * visc; dz[i] = (sz / w - vz[i]) * visc; } else dx[i] = dy[i] = dz[i] = 0;
    }
    for (let i = 0; i < N; i++) { if (state[i] === ST_BODY) { vx[i] += dx[i]; vy[i] += dy[i]; vz[i] += dz[i]; } x[i] = px[i]; y[i] = py[i]; z[i] = pz[i]; }
    // state transitions
    const wy = this.waterY;
    for (let i = 0; i < N; i++) {
      const st = state[i];
      if (st === ST_FLY) {
        if (wy > -1e8 && y[i] < wy) { if (this.events.length < 8) this.events.push(x[i], z[i]); this._respawn(i); continue; }
        if (this.contact[i]) { state[i] = ST_PUDDLE; this.life[i] = 1.6 + this.rand() * 1.6; vx[i] = vy[i] = vz[i] = 0; continue; }
        if (Math.hypot(x[i] - ax, y[i] - ay, z[i] - az) > 9) this._respawn(i);
      } else if (st === ST_PUDDLE) {
        const dh = Math.hypot(x[i] - ax, z[i] - az);
        if (dh < 0.75 && Math.abs(y[i] - ay) < 0.5 && this.grounded) { state[i] = ST_MERGE; continue; }
        this.life[i] -= h; if (this.life[i] <= 0) this._respawn(i);
      } else if (st === ST_MERGE) {
        this._target(i, t); const d = Math.hypot(x[i] - t[0], y[i] - t[1], z[i] - t[2]);
        if (d < 0.14) state[i] = ST_BODY; else if (d > 3) this._respawn(i);
      }
    }
    // shedding: running flicks droplets off the surface, jumping drips
    const sp = Math.hypot(avx, avz); let rate = 0;
    if (sp > 3.4 && !this.swim) rate += (sp - 3.4) * 7;
    if (!this.grounded && !this.swim) rate += 4 + Math.max(0, avy) * 2;
    if (rate > 0 && this._detached() < this.N * 0.12) {
      let want = rate * h; let tries = 0;
      while (want > 0 && tries++ < 40) {
        if (this.rand() > want) break; want -= 1;
        const i = Math.floor(this.rand() * N); if (state[i] !== ST_BODY || !this.surf[i] || this.ry[i] < 0.18 || this.headP[i]) continue; // keep the head round
        this._target(i, t); const ox = x[i] - (ax), oz = z[i] - (az); const ol = Math.hypot(ox, oz) || 1;
        state[i] = ST_FLY;
        vx[i] += ox / ol * 0.7 - avx * 0.3 + (this.rand() - 0.5) * 0.6; vz[i] += oz / ol * 0.7 - avz * 0.3 + (this.rand() - 0.5) * 0.6;
        vy[i] += 0.5 + this.rand() * 1.1;
      }
    }
  }
  _collide(i) {
    const PR = this.state[i] === ST_BODY ? 0.035 : 0.012;
    const g = this.groundAt(this.px[i], this.pz[i]);
    if (this.py[i] < g + PR) {
      this.py[i] = g + PR; this.contact[i] = 1;
      // floor friction: keep most of the slide for liquid, a bit of drag
      this.px[i] = this.x[i] + (this.px[i] - this.x[i]) * 0.85; this.pz[i] = this.z[i] + (this.pz[i] - this.z[i]) * 0.85;
    }
    const W = this.walls;
    for (let k = 0; k < W.length; k += 4) {
      const d = W[k] * this.px[i] + W[k + 1] * this.py[i] + W[k + 2] * this.pz[i] - W[k + 3] - PR;
      if (d < 0) { this.px[i] -= W[k] * d; this.py[i] -= W[k + 1] * d; this.pz[i] -= W[k + 2] * d; if (this.state[i] === ST_FLY && W[k + 1] > 0.5) this.contact[i] = 1; }
    }
  }

  // ------------------------------------------------------------------------------- meshing
  _splat(ax, ay, az) {
    const F = this.field; F.fill(0); const R = this.R, R2 = R * R, iR2 = 1 / R2; const rc = Math.ceil(R / CS);
    const ox = ax + GX0, oy = ay + GY0, oz = az + GZ0; const SX = NY * NZ, SY = NZ;
    const usePos = this.inited;
    for (let i = 0; i < this.N; i++) {
      if (usePos && this.state[i] !== ST_BODY) continue;
      const X = usePos ? this.x[i] : this.rx[i], Y = usePos ? this.y[i] : this.ry[i], Z = usePos ? this.z[i] : this.rz[i];
      const fx = (X - ox) / CS, fy = (Y - oy) / CS, fz = (Z - oz) / CS;
      const i0 = Math.max(1, Math.ceil(fx - rc)), i1 = Math.min(NX - 2, Math.floor(fx + rc));
      const j0 = Math.max(1, Math.ceil(fy - rc)), j1 = Math.min(NY - 2, Math.floor(fy + rc));
      const k0 = Math.max(1, Math.ceil(fz - rc)), k1 = Math.min(NZ - 2, Math.floor(fz + rc));
      for (let a = i0; a <= i1; a++) {
        const ddx = (a - fx) * CS, dx2 = ddx * ddx; if (dx2 >= R2) continue;
        for (let b = j0; b <= j1; b++) {
          const ddy = (b - fy) * CS, dxy = dx2 + ddy * ddy; if (dxy >= R2) continue; const row = a * SX + b * SY;
          for (let c = k0; c <= k1; c++) { const ddz = (c - fz) * CS; const q = (dxy + ddz * ddz) * iR2; if (q < 1) { const w = 1 - q; F[row + c] += w * w * w; } }
        }
      }
    }
  }
  _sampleField(lx, ly, lz) { // rest-frame helper (anchor at origin)
    const i = Math.round((lx - GX0) / CS), j = Math.round((ly - GY0) / CS), k = Math.round((lz - GZ0) / CS);
    if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) return 0; return this.field[i * NY * NZ + j * NZ + k];
  }
  _output() {
    const ax = this.a[0], ay = this.a[1], az = this.a[2];
    this._splat(ax, ay, az);
    const F = this.field, iso = this.iso, SX = NY * NZ, SY = NZ;
    // clip at the pool surface: the submerged part merges with the pool water
    if (this.waterY > -1e8) {
      const jc = Math.floor((this.waterY - (ay + GY0)) / CS);
      for (let j = 0; j <= Math.min(NY - 1, jc); j++) for (let i = 0; i < NX; i++) for (let k = 0; k < NZ; k++) F[i * SX + j * SY + k] = 0;
    }
    // --- surface nets
    const V = this.vidx; let nv = 0; let pos = this.oPos, nrm = this.oNrm;
    const g = [0, 0, 0];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NY - 1; j++) for (let k = 0; k < NZ - 1; k++) {
      const o = i * SX + j * SY + k;
      const c0 = F[o], c1 = F[o + SX], c2 = F[o + SY], c3 = F[o + SX + SY], c4 = F[o + 1], c5 = F[o + SX + 1], c6 = F[o + SY + 1], c7 = F[o + SX + SY + 1];
      let m = 0; if (c0 > iso) m |= 1; if (c1 > iso) m |= 2; if (c2 > iso) m |= 4; if (c3 > iso) m |= 8; if (c4 > iso) m |= 16; if (c5 > iso) m |= 32; if (c6 > iso) m |= 64; if (c7 > iso) m |= 128;
      if (m === 0 || m === 255) { V[o] = -1; continue; }
      // average of edge crossings (cell-local coords 0..1)
      let sx = 0, sy = 0, sz = 0, n = 0;
      const e = (fa, fb, ax_, ay_, az_, bx, by, bz) => { if ((fa > iso) !== (fb > iso)) { const t = (iso - fa) / (fb - fa); sx += ax_ + (bx - ax_) * t; sy += ay_ + (by - ay_) * t; sz += az_ + (bz - az_) * t; n++; } };
      e(c0, c1, 0, 0, 0, 1, 0, 0); e(c2, c3, 0, 1, 0, 1, 1, 0); e(c4, c5, 0, 0, 1, 1, 0, 1); e(c6, c7, 0, 1, 1, 1, 1, 1);
      e(c0, c2, 0, 0, 0, 0, 1, 0); e(c1, c3, 1, 0, 0, 1, 1, 0); e(c4, c6, 0, 0, 1, 0, 1, 1); e(c5, c7, 1, 0, 1, 1, 1, 1);
      e(c0, c4, 0, 0, 0, 0, 0, 1); e(c1, c5, 1, 0, 0, 1, 0, 1); e(c2, c6, 0, 1, 0, 0, 1, 1); e(c3, c7, 1, 1, 0, 1, 1, 1);
      const u = sx / n, v = sy / n, w = sz / n;
      if ((nv + 1) * 3 > pos.length) { const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = this.oPos = p2; const n2 = new Float32Array(nrm.length * 2); n2.set(nrm); nrm = this.oNrm = n2; }
      pos[nv * 3] = GX0 + (i + u) * CS; pos[nv * 3 + 1] = GY0 + (j + v) * CS; pos[nv * 3 + 2] = GZ0 + (k + w) * CS;
      // smooth normal: trilinear blend of central-difference gradients at the 8 corners
      let gx = 0, gy = 0, gz = 0;
      for (let c = 0; c < 8; c++) {
        const ci = i + (c & 1), cj = j + ((c >> 1) & 1), ck = k + ((c >> 2) & 1);
        const wt = ((c & 1) ? u : 1 - u) * (((c >> 1) & 1) ? v : 1 - v) * (((c >> 2) & 1) ? w : 1 - w);
        this._grad(ci, cj, ck, g); gx += g[0] * wt; gy += g[1] * wt; gz += g[2] * wt;
      }
      const gl = Math.hypot(gx, gy, gz) || 1; nrm[nv * 3] = -gx / gl; nrm[nv * 3 + 1] = -gy / gl; nrm[nv * 3 + 2] = -gz / gl;
      V[o] = nv++;
    }
    let ni = 0; let idx = this.oIdx;
    const quad = (a, b, c, d) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (ni + 6 > idx.length) { const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = this.oIdx = i2; }
      // orient by the gradient normal
      const P = pos; const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const N = nrm; const dot = cx * (N[a * 3] + N[c * 3]) + cy * (N[a * 3 + 1] + N[c * 3 + 1]) + cz * (N[a * 3 + 2] + N[c * 3 + 2]);
      if (dot >= 0) { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
      else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
    };
    for (let i = 1; i < NX - 1; i++) for (let j = 1; j < NY - 1; j++) for (let k = 1; k < NZ - 1; k++) {
      const o = i * SX + j * SY + k; const inside = F[o] > iso;
      if ((F[o + SX] > iso) !== inside && i < NX - 1) quad(V[o - SY - 1], V[o - 1], V[o], V[o - SY]);           // x edge: cells around in y,z
      if ((F[o + SY] > iso) !== inside && j < NY - 1) quad(V[o - SX - 1], V[o - SX], V[o], V[o - 1]);           // y edge: cells around in x,z
      if ((F[o + 1] > iso) !== inside && k < NZ - 1) quad(V[o - SX - SY], V[o - SY], V[o], V[o - SX]);          // z edge: cells around in x,y
    }
    // --- droplets
    const D = this.oDrop; let nd = 0;
    let hx = 0, hy = 0, hz = 0, hn = 0;
    for (let i = 0; i < this.N; i++) {
      const st = this.state[i];
      if (st === ST_BODY) { if (this.headP[i]) { hx += this.x[i]; hy += this.y[i]; hz += this.z[i]; hn++; } continue; }
      if (this.waterY > -1e8 && this.y[i] < this.waterY) continue;
      let r = this.size[i], flat = 1;
      if (st === ST_PUDDLE) { r *= 1.7 * Math.min(1, this.life[i] / 0.8); flat = 0.28; }
      else if (st === ST_MERGE) { r *= 1.5; flat = 0.4; }
      else { const sp = Math.hypot(this.vx[i], this.vy[i], this.vz[i]); flat = 1 + Math.min(0.8, sp * 0.08); }
      D[nd * 5] = this.x[i]; D[nd * 5 + 1] = this.y[i] - (st === ST_PUDDLE ? 0.006 : 0); D[nd * 5 + 2] = this.z[i]; D[nd * 5 + 3] = r; D[nd * 5 + 4] = flat; nd++;
    }
    const head = hn ? [hx / hn - ax, hy / hn - ay, hz / hn - az] : [HEAD.cx, HEAD.cy, HEAD.cz];
    // head above water? (eyes hide when fully submerged)
    return {
      pos: pos.slice(0, nv * 3), nrm: nrm.slice(0, nv * 3), idx: idx.slice(0, ni), drops: D.slice(0, nd * 5),
      nv, ni, nd, head, anchor: [ax, ay, az], yaw: this.yaw, events: this.events.slice(), dis: this.dis,
    };
  }
  _grad(i, j, k, out) {
    const F = this.field, SX = NY * NZ, SY = NZ; const o = i * SX + j * SY + k;
    out[0] = (i > 0 && i < NX - 1) ? F[o + SX] - F[o - SX] : 0;
    out[1] = (j > 0 && j < NY - 1) ? F[o + SY] - F[o - SY] : 0;
    out[2] = (k > 0 && k < NZ - 1) ? F[o + 1] - F[o - 1] : 0;
  }
}
