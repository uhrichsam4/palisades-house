// Money: one InstancedMesh pool of $100 notes (cap 2000). Flutter/curl happens in the vertex shader
// (onBeforeCompile + uTime); gravity, quadratic drag that ramps in after launch (bills fly, then flutter),
// a falling-leaf side sway and tumbling run on the CPU for live (flying) bills only. Bills land flat on
// floors / furniture (Rapier ray down, fixed colliders only, rate-limited) or float on pool water
// (water.heightAt, bobbing), lie ~20 s, then dissolve (dithered fade). Allocation is a ring: when the pool is
// full the oldest bill is recycled.
//
// API (src/party/games.js codes against this):
//   createMoney(ctx) -> {
//     burst(pos, count = 80, { speed = 4, up = 3 } = {}),   one-shot explosion of bills
//     spray(origin, dir, seconds = 0.2),                     stream from a hand ("make it rain")
//     rain(rect [x0,z0,x1,z1], y, perSecond) -> stop(),      continuous gentle rain over an area
//     stackMesh(),                                           banded stack of $100 notes (~0.156 x 0.04 x 0.066 m)
//     update(dt),                                            call from ctx.onUpdate
//     mesh, live(), stackGeometry(), stackMaterial(), billGeometry(), billMaterial()
//   }
import * as THREE from 'three';
import { waterBodies } from '../water/index.js';
import * as PLAN from '../plan.js';
import { billTexture, stackAtlas, STACK_UV } from './tex.js';

export const BILL = { w: 0.156, d: 0.066 };     // note size (m)
export const STACK = { l: 0.156, h: 0.04, w: 0.066 };
const CAP = 2000, LIE = 20, FADE = 1.6, MAX_RAYS = 70;
const SOFT = 500, LIE_BUSY = 6; // polish: soft cap on landed notes; above it notes lie 6 s instead of 20 s, then fade

// note geometry: a plane in XZ (normal +y), subdivided along its length so it can bend
export function makeBillGeometry() {
  const g = new THREE.PlaneGeometry(BILL.w, BILL.d, 6, 2); g.rotateX(-Math.PI / 2); return g;
}
let stackGeo = null, stackMat = null;
export function makeStackGeometry() {
  if (stackGeo) return stackGeo;
  const g = new THREE.BoxGeometry(STACK.l, STACK.h, STACK.w);
  const uv = g.attributes.uv; // 6 faces x 4 verts: +x, -x, +y, -y, +z, -z
  const reg = [STACK_UV.end, STACK_UV.end, STACK_UV.top, STACK_UV.top, STACK_UV.side, STACK_UV.side];
  for (let f = 0; f < 6; f++) { const [u0, v0, u1, v1] = reg[f]; for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
  // top/bottom faces: BoxGeometry maps u along x for +y: good (band across the middle of the length)
  g.clearGroups(); stackGeo = g; return g;
}
export function makeStackMaterial() {
  if (stackMat) return stackMat;
  stackMat = new THREE.MeshStandardMaterial({ map: stackAtlas(), roughness: 0.78, metalness: 0 }); stackMat.name = 'party:cash';
  return stackMat;
}
let looseMat = null;
export function looseBillMaterial() { // plain (no flutter) material for static scattered notes
  if (looseMat) return looseMat;
  looseMat = new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.82, side: THREE.DoubleSide }); looseMat.name = 'party:loose';
  return looseMat;
}

export function createMoney(ctx) {
  const { scene, phys } = ctx; const R = phys.RAPIER;
  const tex = billTexture();
  const geo = makeBillGeometry();
  const aBill = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4); aBill.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aBill', aBill);
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }); mat.name = 'party:bills';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute vec4 aBill;\nuniform float uTime;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float ph = aBill.x, fl = aBill.y; float u = position.x / ${(BILL.w / 2).toFixed(4)}, w = position.z / ${(BILL.d / 2).toFixed(4)};
        float wave = sin(u * 2.6 + uTime * 13.0 + ph) * 0.010 + sin(w * 2.0 + uTime * 8.0 + ph * 1.7) * 0.006;
        float curl = (u * u) * (0.012 * sin(uTime * 5.0 + ph * 2.3));
        transformed.y += fl * (wave + curl) + (1.0 - fl) * (u * u * 0.0035 + w * w * 0.0015);
        vFade = aBill.z; }`).replace('#include <project_vertex>', `#include <project_vertex>
      vFade *= smoothstep(0.45, 1.1, -mvPosition.z); /* polish5: a note tumbling right past the lens filled a quarter of the frame (read as a giant upright bill): dither it out under ~1 m */`);
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;`);
  };
  mat.customProgramCacheKey = () => 'party-bills-v2';
  const mesh = new THREE.InstancedMesh(geo, mat, CAP); mesh.name = 'party:money'; mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.keep = true; mesh.userData.noProbe = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0;
  const M = mesh.instanceMatrix.array; for (let i = 0; i < CAP; i++) M[i * 16 + 15] = 1; // zero scale = hidden
  scene.add(mesh);

  // ---- state (struct of arrays)
  const px = new Float32Array(CAP), py = new Float32Array(CAP), pz = new Float32Array(CAP);
  // contain pass: notes don't fly through walls. A 0.2 m grid per storey of which indoor room each spot is in (built
  // once); a note thrown inside a room stays in that room, one thrown outdoors can't enter the house footprint below
  // its roof (sky height map). Blocked notes lose their sideways speed and flutter down along the wall.
  const GX0 = -1, GZ0 = -1, GS = 0.2, GW = 130, GH = 125; const grid = [new Uint8Array(GW * GH), new Uint8Array(GW * GH)];
  Object.values(PLAN.ROOMS).forEach((r, k) => { if (r.outdoor) return; const [x0, z0, x1, z1] = r.rect;
    for (let gz = Math.max(0, Math.ceil((z0 - GZ0) / GS)); gz < GH && GZ0 + gz * GS < z1; gz++) for (let gx = Math.max(0, Math.ceil((x0 - GX0) / GS)); gx < GW && GX0 + gx * GS < x1; gx++) grid[r.level][gz * GW + gx] = k + 1; });
  const cell = (x, z, lv) => { const gx = Math.round((x - GX0) / GS), gz = Math.round((z - GZ0) / GS); return gx < 0 || gz < 0 || gx >= GW || gz >= GH ? 0 : grid[lv][gz * GW + gx]; };
  const lvOf = (y) => (y > PLAN.LEVELS[1].floor - 0.1 ? 1 : 0);
  const home = new Uint8Array(CAP), homeLv = new Uint8Array(CAP); let roofAt = null;
  function blocked(i, x, z) {
    if (home[i]) return cell(x, z, homeLv[i]) !== home[i];
    if (!cell(x, z, 0) && !cell(x, z, 1)) return false;
    return roofAt ? roofAt(x, z) > py[i] : true;
  }
  const vx = new Float32Array(CAP), vy = new Float32Array(CAP), vz = new Float32Array(CAP);
  const yaw = new Float32Array(CAP), pit = new Float32Array(CAP), rol = new Float32Array(CAP), wp = new Float32Array(CAP), wr = new Float32Array(CAP), wy = new Float32Array(CAP);
  const age = new Float32Array(CAP), st = new Uint8Array(CAP);   // st: 0 free, 1 flying, 2 landed
  const gy = new Float32Array(CAP), gx = new Float32Array(CAP), gz = new Float32Array(CAP), gw = new Int8Array(CAP), gAge = new Float32Array(CAP);
  const phase = new Float32Array(CAP), drag0 = new Float32Array(CAP), sway = new Float32Array(CAP);
  let next = 0, hi = 0, flying = 0, landed = 0, raysThisFrame = 0, matDirty = false, attrDirty = false;

  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FL = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const waterAt = (x, z) => { for (let k = 0; k < waterBodies.length; k++) { const w = waterBodies[k]; try { if (w.isInside(x, z)) return k; } catch {} } return -1; };
  function groundAt(i, force) {
    const x = px[i], z = pz[i];
    if (!force && (Math.abs(x - gx[i]) < 0.18 && Math.abs(z - gz[i]) < 0.18) && gAge[i] < 0.6) return;
    if (!force && raysThisFrame >= MAX_RAYS) return;
    gx[i] = x; gz[i] = z; gAge[i] = 0;
    const wk = waterAt(x, z);
    if (wk >= 0) { const w = waterBodies[wk]; const s = w.surfaceY ?? 0; if (py[i] > s - 0.05) { gw[i] = wk; gy[i] = s; return; } }
    gw[i] = -1; raysThisFrame++;
    ray.origin.x = x; ray.origin.y = py[i] + 0.02; ray.origin.z = z;
    let hit = null; try { hit = phys.world.castRay(ray, 30, true, FL); } catch {}
    gy[i] = hit ? ray.origin.y - (hit.timeOfImpact ?? hit.toi ?? 0) : -50;
  }

  function alloc() {
    const i = next; next = (next + 1) % CAP; if (i >= hi) { hi = i + 1; mesh.count = hi; }
    if (st[i] === 1) flying--; else if (st[i] === 2) landed--;
    return i;
  }
  function spawn(x, y, z, ivx, ivy, ivz) {
    const i = alloc();
    px[i] = x; py[i] = y; pz[i] = z; vx[i] = ivx; vy[i] = ivy; vz[i] = ivz;
    yaw[i] = Math.random() * Math.PI * 2; pit[i] = (Math.random() - 0.5) * 2; rol[i] = (Math.random() - 0.5) * 2;
    wp[i] = (Math.random() - 0.5) * 14; wr[i] = (Math.random() - 0.5) * 10; wy[i] = (Math.random() - 0.5) * 4;
    age[i] = 0; st[i] = 1; flying++; phase[i] = Math.random() * 6.283; drag0[i] = 0.15 + Math.random() * 0.3; sway[i] = 0.8 + Math.random() * 1.4;
    gAge[i] = 99; gx[i] = 1e9; groundAt(i, true); homeLv[i] = lvOf(y); { const rf = window.__sky?.roofAt; home[i] = !rf || rf(x, z) > y ? cell(x, z, homeLv[i]) : 0; } // above the roof = outdoors
    aBill.array[i * 4] = phase[i]; aBill.array[i * 4 + 1] = 1; aBill.array[i * 4 + 2] = 1; attrDirty = true;
    return i;
  }
  const _v = new THREE.Vector3(), _d = new THREE.Vector3();
  const toV = (p) => (Array.isArray(p) ? _v.set(p[0], p[1], p[2]) : _v.copy(p));

  function burst(pos, count = 80, { speed = 4, up = 3 } = {}) {
    const p = toV(pos).clone(); count = Math.min(600, Math.max(0, count | 0));
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2, el = Math.random();
      const s = speed * (0.35 + Math.random() * 0.65);
      spawn(p.x + (Math.random() - 0.5) * 0.2, p.y + Math.random() * 0.2, p.z + (Math.random() - 0.5) * 0.2,
        Math.cos(a) * s * (1 - el * 0.5), up * (0.5 + Math.random() * 0.8) + el * speed * 0.5, Math.sin(a) * s * (1 - el * 0.5));
    }
  }
  // spray: a cone of bills from a hand; seconds of stream at ~45 bills/s (spread over the next frames)
  const streams = [];
  function spray(origin, dir, seconds = 0.2) {
    const o = toV(origin).clone(); const d = (Array.isArray(dir) ? _d.set(dir[0], dir[1], dir[2]) : _d.copy(dir)).normalize().clone();
    streams.push({ o, d, left: Math.max(0, Math.min(3, seconds)), acc: 0, rate: 45 });
  }
  const rains = new Set();
  function rain(rect, y, perSecond = 10, { prewarm = 0 } = {}) {
    const r = { rect: rect.slice(), y, rate: perSecond, acc: 0 }; rains.add(r);
    // prewarm: start in steady state (bills already mid-air and lying around)
    for (let n = Math.min(500, Math.round(perSecond * prewarm)); n > 0; n--) {
      const [x0, z0, x1, z1] = rect; const i = spawn(x0 + Math.random() * (x1 - x0), 0.6 + (y - 0.6) * Math.random(), z0 + Math.random() * (z1 - z0), 0, -0.8, 0);
      age[i] = 0.8; // already fluttering (drag fully on)
    }
    return () => rains.delete(r);
  }
  function stackMesh() {
    const m = new THREE.Mesh(makeStackGeometry(), makeStackMaterial()); m.castShadow = true; m.receiveShadow = true; m.name = 'cash-stack'; return m;
  }

  // ---- per-frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  function writeMatrix(i) {
    _e.set(pit[i], yaw[i], rol[i]); _q.setFromEuler(_e); _p.set(px[i], py[i], pz[i]); _m.compose(_p, _q, _s);
    _m.toArray(M, i * 16); matDirty = true;
  }
  const flatten = (a) => { const k = Math.round(a / Math.PI) * Math.PI; return k; };
  function update(dt) {
    dt = Math.min(dt, 0.05); uTime.value += dt; raysThisFrame = 0; roofAt = window.__sky?.roofAt || null;
    // emitters
    for (let k = streams.length - 1; k >= 0; k--) {
      const s = streams[k]; s.acc += s.rate * Math.min(dt, s.left); s.left -= dt;
      while (s.acc >= 1) {
        s.acc -= 1; const sp = 3.2 + Math.random() * 2.2;
        const jx = (Math.random() - 0.5) * 0.5, jy = (Math.random() - 0.3) * 0.4, jz = (Math.random() - 0.5) * 0.5;
        spawn(s.o.x + (Math.random() - 0.5) * 0.06, s.o.y + (Math.random() - 0.5) * 0.06, s.o.z + (Math.random() - 0.5) * 0.06, (s.d.x + jx) * sp, (s.d.y + jy) * sp + 1.2, (s.d.z + jz) * sp);
      }
      if (s.left <= 0) streams.splice(k, 1);
    }
    // polish: ambient rain pauses while a game round runs (hub game in count/play, or the local player at a venue)
    const gp = rains.size ? window.__games?.phase : null; const quiet = rains.size && (gp === 'play' || gp === 'count' || document.body.classList.contains('pg-venue'));
    if (!quiet) for (const r of rains) {
      r.acc += r.rate * dt;
      while (r.acc >= 1) { r.acc -= 1; const [x0, z0, x1, z1] = r.rect; spawn(x0 + Math.random() * (x1 - x0), r.y + Math.random() * 0.8, z0 + Math.random() * (z1 - z0), (Math.random() - 0.5) * 0.4, -0.6, (Math.random() - 0.5) * 0.4); }
    }
    const t = uTime.value; const A = aBill.array;
    for (let i = 0; i < hi; i++) {
      const s = st[i]; if (!s) continue;
      if (s === 1) {
        const a = (age[i] += dt);
        const ramp = Math.min(1, a / 0.7); const c = drag0[i] + (7.5 - drag0[i]) * ramp * ramp;
        vy[i] -= 9.81 * dt;
        const sp = Math.hypot(vx[i], vy[i], vz[i]); const f = 1 / (1 + c * sp * dt);
        vx[i] *= f; vy[i] *= f; vz[i] *= f;
        // falling-leaf sway once it flutters
        const sw = sway[i] * ramp; vx[i] += Math.sin(a * 3.1 + phase[i]) * sw * dt * 2.2; vz[i] += Math.cos(a * 2.3 + phase[i] * 1.3) * sw * dt * 2.2;
        const nx = px[i] + vx[i] * dt, nz = pz[i] + vz[i] * dt; py[i] += vy[i] * dt;
        if (blocked(i, nx, nz)) { vx[i] *= -0.15; vz[i] *= -0.15; } else { px[i] = nx; pz[i] = nz; }
        yaw[i] += wy[i] * dt;
        gAge[i] += dt; groundAt(i, false);
        let ground = gy[i]; if (gw[i] >= 0) { try { ground = waterBodies[gw[i]].heightAt(px[i], pz[i]); } catch {} }
        const h = py[i] - ground;
        if (h < 0.35) { const k = Math.max(0, h / 0.35); pit[i] = flatten(pit[i]) + (pit[i] - flatten(pit[i])) * (0.85 + 0.15 * k); rol[i] = flatten(rol[i]) + (rol[i] - flatten(rol[i])) * (0.85 + 0.15 * k); }
        else { pit[i] += wp[i] * dt; rol[i] += wr[i] * dt; }
        if (h <= 0.004 && vy[i] <= 0) {
          st[i] = 2; flying--; landed++; age[i] = 0; py[i] = ground + (gw[i] >= 0 ? 0.012 : 0.004); pit[i] = 0; rol[i] = 0; vx[i] = vy[i] = vz[i] = 0;
          A[i * 4 + 1] = 0; attrDirty = true;
          if (gy[i] < -40) { st[i] = 0; landed--; A[i * 4 + 2] = 0; } // fell out of the world
        }
        writeMatrix(i);
      } else {
        const a = (age[i] += dt);
        if (gw[i] >= 0) { // floating: bob with the water + slow drift spin
          let hY = py[i]; try { hY = waterBodies[gw[i]].heightAt(px[i], pz[i]); } catch {}
          py[i] = hY + 0.012; yaw[i] += Math.sin(t * 0.4 + phase[i]) * 0.05 * dt; pit[i] = Math.sin(t * 1.3 + phase[i]) * 0.05; writeMatrix(i);
        }
        const lie = landed > SOFT ? LIE_BUSY : LIE; // polish: crowded floor -> old notes clear sooner
        if (a > lie) {
          const f = 1 - (a - lie) / FADE;
          if (f <= 0) { st[i] = 0; landed--; A[i * 4 + 2] = 0; _m.makeScale(0, 0, 0); _m.toArray(M, i * 16); matDirty = true; }
          else A[i * 4 + 2] = f;
          attrDirty = true;
        }
      }
    }
    while (hi > next && st[hi - 1] === 0) hi--; // trim unused instances above the ring head
    mesh.count = hi;
    if (matDirty) { mesh.instanceMatrix.needsUpdate = true; matDirty = false; }
    if (attrDirty) { aBill.needsUpdate = true; attrDirty = false; }
  }

  return {
    burst, spray, rain, stackMesh, update, mesh,
    live: () => ({ flying, landed, hi, streams: streams.length, rains: rains.size }),
    stackGeometry: makeStackGeometry, stackMaterial: makeStackMaterial, billGeometry: makeBillGeometry, billMaterial: looseBillMaterial,
  };
}
