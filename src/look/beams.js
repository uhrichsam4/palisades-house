// Light shafts with dust: sunlight through the exterior windows / sliders, drawn as one additive volume per window.
// Look (soft edges, fade down the shaft, two scrolling noise layers multiplied for drifting dust, world-offset so
// every beam differs) after TrentSterling/threejs-volumetric-beam (MIT, (c) 2026 Trent Sterling) — that page
// billboards a quad; here each beam is the real sun-swept prism of its window (an affine unit cube: window width x
// window height x sun direction), and the shader measures how far the view ray travels inside it (slab test), so
// it reads as a solid shaft from any angle, incl. standing inside it. Dust: tiny instanced points that live only
// inside the beam volumes (local coords wrap), lit by the same masks.
// One draw for every beam + one for the dust. Beams = the ≤ MAXB sun-facing windows nearest the camera.
import * as THREE from 'three';
import * as P from '../plan.js';

const MAXB = 12, DUST_PER = 140;
const TYPES = new Set(['window', 'slider', 'french']);

// exterior openings with their inward normal / tangent (the outline segment they sit on)
function windows() {
  const out = [];
  for (const o of P.OPENINGS) {
    if (!TYPES.has(o.type)) continue;
    const poly = P.EXT[o.level]; if (!poly) continue;
    let best = null, bd = 0.05;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1e-3) continue;
      const t = ((o.at[0] - a[0]) * dx + (o.at[1] - a[1]) * dz) / (L * L); if (t < -0.01 || t > 1.01) continue;
      const d = Math.abs((o.at[0] - a[0]) * dz - (o.at[1] - a[1]) * dx) / L; if (d < bd) { bd = d; best = [dx / L, dz / L]; }
    }
    if (!best) continue; // interior wall
    const tan = new THREE.Vector3(best[0], 0, best[1]);
    let n = new THREE.Vector3(-best[1], 0, best[0]); // one of the two normals: pick the one pointing inside
    if (!inPoly(poly, o.at[0] + n.x * 0.6, o.at[1] + n.z * 0.6)) n.negate();
    const fy = P.LEVELS[o.level].floor;
    const c = new THREE.Vector3(o.at[0], fy, o.at[1]).addScaledVector(n, P.EXT_T + 0.02);
    out.push({ id: o.id, level: o.level, c, n, tan, w: o.w * 0.92, y0: fy + Math.max(o.sill, 0.05), y1: fy + o.head - 0.06, floor: fy });
  }
  return out;
}
function inPoly(poly, x, z) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }

const VERT = /* glsl */`
attribute float aBeam;
uniform mat4 uM[${MAXB}]; uniform vec3 uCamL[${MAXB}]; uniform float uK[${MAXB}];
varying vec3 vL; varying vec3 vC; varying vec3 vWP; varying float vK;
varying vec3 vAx; varying vec3 vAy; varying vec3 vAz;
void main() {
  int i = int(aBeam + 0.5); mat4 M = uM[i];
  vL = position; vC = uCamL[i]; vK = uK[i];
  vAx = M[0].xyz; vAy = M[1].xyz; vAz = M[2].xyz;
  vec4 w = M * vec4(position, 1.0); vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  if (vK <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FRAG = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform sampler2D tNoise;
varying vec3 vL; varying vec3 vC; varying vec3 vWP; varying float vK;
varying vec3 vAx; varying vec3 vAy; varying vec3 vAz;
float mask(vec3 p) { // beam profile at a local point: soft window edges, fade in from the glass, fade out down the shaft
  float h = 1.0 - smoothstep(0.30, 0.5, abs(p.x - 0.5));
  float v = 1.0 - smoothstep(0.30, 0.5, abs(p.y - 0.5));
  float a = smoothstep(0.0, 0.06, p.z) * pow(max(1.0 - p.z, 0.0), 1.6);
  return h * v * a;
}
void main() {
  vec3 ro = vC, rd = vL - vC;
  vec3 inv = 1.0 / (rd + vec3(1e-6));
  vec3 t0 = (vec3(0.0) - ro) * inv, t1 = (vec3(1.0) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  bool inside = all(greaterThan(vC, vec3(0.0))) && all(lessThan(vC, vec3(1.0)));
  // front faces when the camera is outside, back faces when it is inside: each pixel counts the shaft once
  if (inside == gl_FrontFacing) discard;
  float ts = max(tn, 0.0); if (tf <= ts) discard;
  // 4 samples along the path, physical length from the beam axes
  vec3 dL = rd * (tf - ts); float len = length(vAx * dL.x + vAy * dL.y + vAz * dL.z);
  float m = 0.0; for (int k = 0; k < 4; k++) m += mask(ro + rd * (ts + (tf - ts) * (float(k) + 0.5) / 4.0)); m *= 0.25;
  // dust: two scrolling noise layers (multiplied) in world space, slow drift
  vec2 off = vWP.xz * 0.35 + vWP.y * 0.21;
  float n1 = texture2D(tNoise, off * 0.9 + vec2(0.011, 0.004) * uTime).r;
  float n2 = texture2D(tNoise, off * 1.7 + vec2(-0.007, 0.013) * uTime).r;
  float dust = mix(1.0, n1 * n2 * 3.2, 0.55);
  float a = m * dust * min(len, 3.0) * vK;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const DVERT = /* glsl */`
attribute vec4 aSeed; attribute float aBeam;
uniform mat4 uM[${MAXB}]; uniform float uK[${MAXB}]; uniform float uTime, uSize;
varying float vA;
void main() {
  int i = int(aBeam + 0.5); float k = uK[i];
  vec3 p = fract(aSeed.xyz + vec3(sin(uTime * 0.11 + aSeed.w * 30.0) * 0.03, uTime * (0.004 + 0.006 * aSeed.w), cos(uTime * 0.09 + aSeed.x * 20.0) * 0.03));
  vec4 w = uM[i] * vec4(p, 1.0); vec4 mv = viewMatrix * w;
  float h = 1.0 - smoothstep(0.32, 0.5, abs(p.x - 0.5)); float v = 1.0 - smoothstep(0.32, 0.5, abs(p.y - 0.5));
  float along = smoothstep(0.0, 0.05, p.z) * pow(max(1.0 - p.z, 0.0), 1.3);
  float tw = 0.55 + 0.45 * sin(uTime * (1.0 + 2.0 * aSeed.w) + aSeed.y * 40.0); // glints as motes tumble
  vA = h * v * along * tw * k;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize / -mv.z, 1.0, 5.0);
  if (k <= 0.0 || vA < 0.01 || -mv.z < 0.25) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const DFRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = 1.0 - smoothstep(0.2, 1.0, dot(q, q)); gl_FragColor = vec4(uColor * vA * d, 1.0); }`;

function noiseTex(size = 128) { // tiling value noise, 3 octaves (the beam repo bakes a canvas noise the same way)
  const d = new Uint8Array(size * size * 4); let s = 7; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const oct = [8, 16, 32].map(g => { const a = new Float32Array(g * g); for (let i = 0; i < a.length; i++) a[i] = r(); return [g, a]; });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.55;
    for (const [g, a] of oct) { const fx = x / size * g, fy = y / size * g, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (X, Y) => a[((Y % g) * g) + (X % g)];
      v += amp * ((at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy); amp *= 0.5; }
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.min(255, v / 0.96 * 255); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

export function createBeams({ scene, sun }) {
  const W = windows();
  // geometry: MAXB unit cubes (positions 0..1), aBeam = slot
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5).toNonIndexed();
  const pos = [], ab = [];
  for (let i = 0; i < MAXB; i++) { const p = box.attributes.position.array; for (let j = 0; j < p.length; j++) pos.push(p[j]); for (let j = 0; j < p.length / 3; j++) ab.push(i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBeam', new THREE.Float32BufferAttribute(ab, 1));
  const uM = Array.from({ length: MAXB }, () => new THREE.Matrix4()), uCamL = Array.from({ length: MAXB }, () => new THREE.Vector3()), uK = new Array(MAXB).fill(0);
  const color = new THREE.Color(), time = { value: 0 };
  const U = { uM: { value: uM }, uCamL: { value: uCamL }, uK: { value: uK }, uColor: { value: color }, uTime: time, tNoise: { value: noiseTex() } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.Mesh(g, mat);
  // dust motes
  const dg = new THREE.BufferGeometry(); const N = MAXB * DUST_PER; const seed = new Float32Array(N * 4), db = new Float32Array(N); let s = 99; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) { seed.set([r(), r(), r(), r()], i * 4); db[i] = Math.floor(i / DUST_PER); }
  dg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3)); dg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4)); dg.setAttribute('aBeam', new THREE.Float32BufferAttribute(db, 1));
  const dcol = new THREE.Color();
  const DU = { uM: U.uM, uK: U.uK, uTime: time, uSize: { value: 9 }, uColor: { value: dcol } };
  const dmat = new THREE.ShaderMaterial({ uniforms: DU, vertexShader: DVERT, fragmentShader: DFRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const dust = new THREE.Points(dg, dmat);
  for (const o of [mesh, dust]) { o.frustumCulled = false; o.renderOrder = 6; o.matrixAutoUpdate = false; o.castShadow = o.receiveShadow = false; Object.assign(o.userData, { noProbe: true, noCull: true, keep: true, noPathTrace: true, waterSkip: true }); scene.add(o); }
  mesh.name = 'look:beams'; dust.name = 'look:dust';

  const _d = new THREE.Vector3(), _inv = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
  let on = true, dustOn = true, strength = 1, active = 0;
  const cand = [];
  function update(dt, t, camera, sky) {
    time.value = t % 1000;
    const vis = on && sun.visible !== false && sun.intensity > 0.05;
    mesh.visible = vis; dust.visible = vis && dustOn;
    if (!vis) { active = 0; return; }
    /* camera outdoors: the shafts behind the glass read as glowing blobs in the windows from the street -> off */
    const cp0 = camera.position; if (!inPoly(P.EXT[0], cp0.x, cp0.z) || cp0.y > 9.2) { mesh.visible = dust.visible = false; active = 0; return; }
    _d.subVectors(sun.target.position, sun.position).normalize(); // light travel direction
    if (_d.y > -0.05) { mesh.visible = dust.visible = false; active = 0; return; } // sun at/below horizon
    // brightness: sun light, stronger when low (long shafts read best), weaker in haze/indoors-lit night
    const low = 1 - Math.min(1, -_d.y); const sev = sky?.severity ?? 0;
    const k0 = Math.min(1.5, sun.intensity / 4.2) * (0.55 + 0.6 * low) * (1 - 0.8 * Math.min(1, sev * 1.4)) * strength;
    color.copy(sun.color).multiplyScalar(0.28); dcol.copy(sun.color).multiplyScalar(0.9);
    const cp = camera.position; cand.length = 0;
    for (const w of W) {
      const facing = -(_d.x * w.n.x + _d.z * w.n.z); // >0: light travels into the room
      if (facing < 0.08) continue;
      const dist = Math.hypot(cp.x - w.c.x, cp.z - w.c.z) + Math.abs(cp.y - (w.floor + 1.5)) * 3;
      if (dist > 22) continue;
      cand.push([dist, w, facing]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    active = Math.min(MAXB, cand.length);
    for (let i = 0; i < MAXB; i++) {
      if (i >= active) { uK[i] = 0; continue; }
      const [dist, w, facing] = cand[i];
      // shaft length: until the middle of the window reaches the floor (capped)
      const L = Math.min(9, ((w.y0 + w.y1) / 2 - w.floor) / Math.max(0.08, -_d.y));
      _x.copy(w.tan).multiplyScalar(w.w); _y.set(0, w.y1 - w.y0, 0); _z.copy(_d).multiplyScalar(L);
      const o = _x.clone().multiplyScalar(-0.5).add(w.c); o.y = w.y0;
      uM[i].makeBasis(_x, _y, _z);
      if (uM[i].determinant() < 0) { o.add(_x); _x.negate(); uM[i].makeBasis(_x, _y, _z); } // keep cube faces' winding = gl_FrontFacing
      uM[i].setPosition(o);
      _inv.copy(uM[i]).invert(); uCamL[i].copy(cp).applyMatrix4(_inv);
      uK[i] = k0 * Math.min(1, facing * 2.2) * (1 - Math.max(0, (dist - 16) / 6));
    }
  }
  return { mesh, dust, update, windows: W,
    set enabled(v) { on = !!v; }, get enabled() { return on; }, set dust(v) { dustOn = !!v; }, set strength(v) { strength = v; },
    get active() { return active; } };
}
