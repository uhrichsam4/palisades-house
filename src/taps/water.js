// Running-water visuals for src/taps. Everything moves on the GPU: the CPU only writes a handful of uniforms
// when a tap is switched (plus one shared time uniform per frame), so a running tap costs ~nothing on the main thread.
//
//  - stream (sinks, tub fillers): a tapered tube bent along the real ballistic arc of the outflow. Each ring is a
//    "parcel" of water emitted at time (now - t(s)); its wobble, streaks and radius (continuity: r ~ 1/sqrt(speed))
//    follow that parcel, so streaks slide down and stretch as the water accelerates. Turning on/off is physical:
//    the water front falls from the spout, and on turn-off the tail detaches and falls. Lit by the room's probe
//    (MeshStandardMaterial patched with onBeforeCompile): reflections + a bright refracted core.
//  - particles (one shader, 3 modes): 0 = shower spray streaks (camera-facing quads stretched along velocity),
//    1 = splash droplets bouncing off the landing point, 2 = soft mist puffs. Each instance is a seed; position is
//    a closed-form function of time, re-randomised every cycle.
//  - ripple: rings + foam disc where a stream lands.
import * as THREE from 'three';

const G = 9.81;
const NOISE = /* glsl */`
float tp_hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tp_noiseP(vec2 p, float P){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  float x0 = mod(i.x, P), x1 = mod(i.x + 1., P);
  return mix(mix(tp_hash(vec2(x0, i.y)), tp_hash(vec2(x1, i.y)), u.x), mix(tp_hash(vec2(x0, i.y + 1.)), tp_hash(vec2(x1, i.y + 1.)), u.x), u.y); }
`;

// ------------------------------------------------------------------ stream (patched standard material)
const STREAM_VH = /* glsl */`
attribute vec2 aSt;
uniform float uTime, uOn, uOff, uH, uR0, uWob;
uniform vec3 uV0;
varying float vEmit, vTT, vU;
`;
const STREAM_VN = /* glsl */`
float s = 1.0 - aSt.y; float th = aSt.x * 6.2831853;
float vy = uV0.y;
float tt = (vy + sqrt(vy * vy + 2.0 * ${G.toFixed(2)} * s * uH)) / ${G.toFixed(2)};
float emit = uTime - tt;
vec3 vel = vec3(uV0.x, vy - ${G.toFixed(2)} * tt, uV0.z);
vec3 wob = vec3(sin(emit * 37.0 + 1.3) + 0.6 * sin(emit * 83.0 + 0.4), 0.0, cos(emit * 29.0 + 0.2) + 0.6 * cos(emit * 71.0 + 2.1)) * uWob * tt;
vec3 sC = vec3(uV0.x * tt, -s * uH, uV0.z * tt) + wob;
float sp = max(length(vel), 0.05);
float rad = uR0 * pow(max(length(uV0), 0.05) / sp, 0.4) // polish: softer taper than sqrt continuity (no hairline neck)
 * (1.0 + 0.10 * sin(emit * 53.0 + th * 2.0) * smoothstep(0.0, 0.3, s));
vec3 T = vel / sp; vec3 A = abs(T.y) < 0.95 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
vec3 B1 = normalize(cross(A, T)); vec3 B2 = cross(T, B1);
vec3 objectNormal = B1 * cos(th) + B2 * sin(th);
vec3 sPos = sC + objectNormal * rad;
vEmit = emit; vTT = tt; vU = aSt.x;
`;
const STREAM_FH = /* glsl */`
uniform float uTime, uOn, uOff, uFall;
varying float vEmit, vTT, vU;
${NOISE}
`;
const STREAM_FB = /* glsl */`
{
  float fl = tp_noiseP(vec2(vU * 5.0, vEmit * 16.0), 5.0);
  float fl2 = tp_noiseP(vec2(vU * 9.0 + 0.5, vEmit * 41.0), 9.0);
  float streak = 0.45 + 1.1 * fl * fl2 + 0.25 * fl;
  float ndv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float core = pow(ndv, 4.0);
  // aerated tap water: milky body that carries the room's light, darker refracted rims, bright reflections
  // polish: brighter refracted core + glints and a fresnel rim so the stream reads at a glance
  vec3 body = totalDiffuse * (0.32 + 0.95 * core) * streak;
  float rim = pow(1. - ndv, 3.0);
  float glint = smoothstep(0.62, 0.95, fl2) * smoothstep(0.2, 0.8, ndv);
  vec3 col = body * mix(0.55, 1.1, smoothstep(0.05, 0.6, ndv)) + totalSpecular * (1.9 + 1.1 * streak) + vec3(0.85, 0.92, 1.0) * (0.22 * rim + 0.45 * glint);
  // polish4: against the white sink the milky stream vanished: blue-grey body tint, darker refracted (fresnel) edges,
  // brighter specular streaks — it now reads as a darker-edged glassy rope with bright glints
  col = col * vec3(0.74, 0.82, 0.9);
  col = mix(col, vec3(0.16, 0.21, 0.27) * (0.6 + 0.4 * streak), 0.55 * smoothstep(0.15, 0.75, 1. - ndv));
  col += totalSpecular * (1.2 * streak) + vec3(0.9, 0.95, 1.0) * 0.35 * glint;
  float lum = max(col.r, max(col.g, col.b));
  float fade = clamp((uTime - uOn) / 0.3, 0., 1.) * clamp(1. - (uTime - uOff) / (0.3 + uFall), 0., 1.);
  gl_FragColor = vec4(col, clamp(0.62 * streak + 0.5 * (1. - ndv) + lum * 0.3, 0., 0.97) * fade);
}
`;

let streamGeo = null;
function getStreamGeo() {
  if (streamGeo) return streamGeo;
  const g = new THREE.CylinderGeometry(1, 1, 1, 12, 28, true);
  g.setAttribute('aSt', g.attributes.uv.clone());
  g.deleteAttribute('normal');
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.6, 0), 1.0); // local to the tip; covers every sink drop
  return (streamGeo = g);
}

// ------------------------------------------------------------------ particles
const PART_V = /* glsl */`
#define G ${G.toFixed(2)}
attribute vec4 aSeed;
uniform float uTime, uOn, uOff, uMode, uSpeed, uSpread, uDisc, uNHeads, uFloor, uPeriod, uWidth, uStretch, uLandR, uFall, uSplashV, uShowerSrc;
uniform vec3 uDir, uHead0, uHead1, uLand, uBoxMin, uBoxMax; // uBox*: shower enclosure (local), spray stops at its glass/walls
varying vec2 vUv; varying float vA;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void spray(float k, out vec3 p0, out vec3 v, out float th){
  vec3 A = abs(uDir.y) < 0.95 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
  vec3 b1 = normalize(cross(A, uDir)), b2 = cross(uDir, b1);
  vec3 head = (uNHeads > 1.5 && h1(k * 1.7 + 0.3) > 0.5) ? uHead1 : uHead0;
  float rr = sqrt(h1(k * 3.1 + 1.1)), an = h1(k * 5.3 + 2.7) * 6.2832;
  vec3 off = (b1 * cos(an) + b2 * sin(an)) * rr;
  p0 = head + off * uDisc;
  v = (uDir * (0.88 + 0.24 * h1(k * 7.7 + 0.9)) + off * uSpread + (vec3(h1(k * 9.1), h1(k * 11.3), h1(k * 13.7)) - 0.5) * 0.06) * uSpeed;
  float dy = p0.y - uFloor;
  th = (v.y + sqrt(max(0., v.y * v.y + 2. * G * dy))) / G;
}
void main(){
  float tt = uTime + aSeed.y * uPeriod;
  float cyc = floor(tt / uPeriod);
  float age = tt - cyc * uPeriod;
  float k = aSeed.x * 100.0 + cyc * 1.618;
  vec3 pos, vel = vec3(0., -1., 0.); float a = 1.0, emit, x = 0.;
  bool vis = true;
  if (uMode < 0.5) {
    vec3 p0, v; float th; spray(k, p0, v, th);
    vis = age < th; emit = uTime - age;
    pos = p0 + v * age; pos.y -= 0.5 * G * age * age; vel = v; vel.y -= G * age;
    vis = vis && all( greaterThan( pos, uBoxMin ) ) && all( lessThan( pos, uBoxMax ) );
    a = 0.75 + 0.5 * aSeed.z;
  } else {
    vec3 land; float fall;
    if (uShowerSrc > 0.5) { vec3 p0, v; float th; spray(k * 0.731 + 5.0, p0, v, th); land = p0 + v * th; land.y = uFloor; fall = th;
      land.xz = clamp( land.xz, uBoxMin.xz + 0.02, uBoxMax.xz - 0.02 ); } // drops that hit the glass splash at its foot
    else { float an = h1(k * 2.3) * 6.2832, rr = sqrt(h1(k * 4.1)) * uLandR; land = uLand + vec3(cos(an) * rr, 0., sin(an) * rr); fall = uFall; }
    emit = uTime - age - fall;
    if (uMode < 1.5) {
      float an = h1(k * 6.1) * 6.2832; float up = (0.35 + 0.65 * h1(k * 8.3)) * uSplashV; float ou = (0.25 + 0.75 * h1(k * 10.7)) * uSplashV * 0.7;
      vec3 v = vec3(cos(an) * ou, up, sin(an) * ou);
      vis = age < 2. * up / G;
      pos = land + v * age; pos.y -= 0.5 * G * age * age; vel = v; vel.y -= G * age;
    } else {
      x = age / uPeriod;
      pos = land + vec3((h1(k * 3.3) - 0.5) * 0.35, 0.04 + x * 0.7 * (0.4 + h1(k * 5.9)), (h1(k * 7.1) - 0.5) * 0.35);
      a = sin(3.1416 * x);
    }
  }
  vis = vis && emit > uOn && emit < uOff;
  if (!vis) { gl_Position = vec4(0., 0., 2., 1.); vA = 0.; vUv = vec2(0.); return; }
  vec3 wp = (modelMatrix * vec4(pos, 1.)).xyz;
  if (uMode > 1.5) {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float sz = uWidth * (0.6 + 0.9 * x);
    wp += (right * position.x + up * (position.y - 0.5)) * sz;
  } else {
    float sp = max(length(vel), 1e-3); vec3 ax = vel / sp; float L = clamp(sp * uStretch, uWidth, 0.3);
    vec3 side = normalize(cross(normalize(cameraPosition - wp), ax)); // this order keeps the quad front-facing
    wp += side * position.x * uWidth - ax * L * position.y;
  }
  vUv = vec2(position.x + 0.5, position.y); vA = a;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}
`;
const PART_F = /* glsl */`
uniform vec3 uColor; uniform float uAlpha, uMode, uTime, uOn, uOff;
varying vec2 vUv; varying float vA;
void main(){
  float x = vUv.x * 2. - 1.;
  float al = uMode > 1.5 ? pow(max(0., 1. - length(vec2(x, vUv.y * 2. - 1.))), 2.) : (1. - x * x) * pow(max(0., 1. - vUv.y), 0.6);
  float fade = clamp((uTime - uOn) / 0.3, 0., 1.);
  gl_FragColor = vec4(uColor, al * vA * uAlpha * fade);
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const partGeos = new Map();
function getPartGeo(n, sphere) {
  const key = n + ':' + sphere.join(',');
  if (partGeos.has(key)) return partGeos.get(key);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(n * 4); let s = 1234567 + n * 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n * 4; i++) seed[i] = rnd();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = n;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(sphere[0], sphere[1], sphere[2]), sphere[3]);
  partGeos.set(key, g); return g;
}

// ------------------------------------------------------------------ ripple
const RIP_F = /* glsl */`
uniform float uTime, uOn, uOff, uFall, uStrength;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = vUv * 2. - 1.; float r = length(p);
  float on = smoothstep(0., 0.15, uTime - uOn - uFall) * (1. - smoothstep(0., 0.35, uTime - uOff - uFall));
  float ring = 0.;
  for (int i = 0; i < 3; i++) { float ph = fract(uTime * 1.7 + float(i) / 3.); ring += exp(-pow((r - ph) * 14., 2.)) * (1. - ph); }
  float ang = atan(p.y, p.x);
  float foam = smoothstep(0.42, 0.0, r) * (0.45 + 0.55 * tp_noiseP(vec2(ang * 1.2732 + 4.0, r * 9. - uTime * 6.), 8.));
  float a = clamp(ring * 0.6 + foam * 0.9, 0., 1.) * smoothstep(1., 0.85, r) * on * uStrength;
  /* polish4: blue-grey rings (white foam on a white sink was invisible); the rings darker than the foam */
  gl_FragColor = vec4(mix(vec3(0.42, 0.52, 0.6), vec3(0.93, 0.96, 0.98), clamp(foam * 1.4, 0., 1.)) * (0.6 + 0.4 * foam), clamp(a * 1.2, 0., 1.));
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const RIP_V = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
let ripGeo = null;

// ------------------------------------------------------------------ polish: rising bath water (fillers with f.basin)
// A disc (oval) / quad (box) whose height AND plan size are computed in the vertex shader from the fill level, so a
// filling tub costs no CPU per frame. level = clamp(uL0 + (uTime - uT0) * uRate): uRate > 0 while on (~60 s to full),
// < 0 while draining. uProf[i] = (y, halfX, halfZ) of the basin's inner wall at 8 heights (local to the tap group).
const LVL_V = /* glsl */`
uniform float uTime, uL0, uT0, uRate; uniform vec3 uProf[8];
varying vec2 vP; varying float vLvl;
void main(){
  float lvl = clamp(uL0 + (uTime - uT0) * uRate, 0., 1.); vLvl = lvl;
  if (lvl < 0.004) { gl_Position = vec4(0., 0., 2., 1.); vP = vec2(0.); return; }
  float f = lvl * 7.; int i = int(min(floor(f), 6.)); float k = f - float(i);
  vec3 pr = mix(uProf[i], uProf[i + 1], k);
  vec3 p = vec3(position.x * pr.y, pr.x, position.z * pr.z); vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const LVL_F = /* glsl */`
uniform float uTime; uniform vec2 uLandUV;
varying vec2 vP; varying float vLvl;
${NOISE}
void main(){
  float n = tp_noiseP(vP * 9. + vec2(uTime * 0.6, -uTime * 0.4), 64.) * 0.6 + tp_noiseP(vP * 23. - uTime * 1.1, 64.) * 0.4;
  float d = length(vP - uLandUV);
  float ring = 0.; for (int j = 0; j < 3; j++) { float ph = fract(uTime * 1.3 + float(j) / 3.); ring += exp(-pow((d - ph * 0.55) * 22., 2.)) * (1. - ph); }
  float foam = smoothstep(0.16, 0.0, d) * (0.5 + 0.5 * n);
  float edge = smoothstep(0.80, 1.0, length(vP)); // meniscus brightening at the wall
  vec3 deep = vec3(0.55, 0.78, 0.80), lite = vec3(0.93, 0.98, 1.0);
  vec3 col = mix(deep, lite, 0.35 + 0.35 * n + 0.5 * ring + foam + 0.3 * edge);
  float a = clamp(0.28 + 0.35 * smoothstep(0., 0.6, vLvl) + 0.25 * ring + 0.6 * foam + 0.15 * edge, 0., 0.92);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function basinProfile(b, tipY) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const y = b.y0 + (b.y1 - b.y0) * i / 7; let hx, hz;
    if (b.shape === 'box') { hx = b.hx; hz = b.hz; }
    else { const P = b.prof; let r = P[P.length - 1][0];
      for (let j = 0; j < P.length - 1; j++) if (y <= P[j + 1][1]) { const t = Math.max(0, (y - P[j][1]) / (P[j + 1][1] - P[j][1])); r = P[j][0] + (P[j + 1][0] - P[j][0]) * t; break; }
      r *= 0.985; hx = r; hz = r + b.dL * Math.sqrt(Math.min(1, r / 0.4)); }
    out.push(new THREE.Vector3(b.c[1] + y - tipY, hx, hz));
  }
  return out;
}

// ------------------------------------------------------------------ per tap
// fx = createTapFx(f, { uTime, donor }) ; f from fixtures.js (dir normalised). setOn(on, t). alive(t). group.
export function createTapFx(f, shared) {
  const { uTime } = shared;
  const group = new THREE.Group(); group.name = 'tap:' + f.id; group.userData.keep = true; group.userData.noProbe = true; group.userData.noCull = true; group.userData.noPathTrace = true; // src/cull.js would size-cull the tiny quad geometry
  group.position.fromArray(f.tip);
  const tip = group.position;
  const on = { value: -1e6 }, off = { value: -1e5 };
  const dir = new THREE.Vector3().fromArray(f.dir).normalize();
  const mats = [];
  let maxLife = 1.5;
  let level = null; // polish: rising bath water (fillers with a basin)

  if (f.kind === 'sink' || f.kind === 'filler') {
    // ---- stream
    const H = f.tip[1] - f.land;
    const v0 = dir.clone().multiplyScalar(f.v);
    const tFall = (v0.y + Math.sqrt(v0.y * v0.y + 2 * G * H)) / G;
    const land = new THREE.Vector3(v0.x * tFall, -H, v0.z * tFall);
    const u = { uTime, uOn: on, uOff: off, uH: { value: H }, uR0: { value: f.r * (f.kind === 'filler' ? 2.3 : 3.0) } /* polish: 3x thicker at the spout (was a hairline) */, uWob: { value: f.kind === 'filler' ? 0.006 : 0.004 }, uV0: { value: v0 }, uFall: { value: tFall } };
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.4, side: THREE.FrontSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + STREAM_VH)
        .replace('#include <beginnormal_vertex>', STREAM_VN).replace('#include <begin_vertex>', 'vec3 transformed = sPos;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + STREAM_FH)
        .replace('#include <clipping_planes_fragment>', 'if (vTT > uTime - uOn || vTT < uTime - uOff) discard;\n#include <clipping_planes_fragment>')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + STREAM_FB);
    };
    m.customProgramCacheKey = () => 'tap-stream-2';
    mats.push(m); shared.stream = m;
    const mesh = new THREE.Mesh(getStreamGeo(), m); mesh.name = 'tap-stream'; mesh.renderOrder = 3; group.add(mesh);
    // ---- splash droplets + ripple at the landing point
    const big = f.kind === 'filler';
    const sp = particles(big ? 80 : 44, [land.x, land.y + 0.1, land.z, 0.35], {
      uMode: 1, uShowerSrc: 0, uLand: land, uLandR: f.r * 4.0, uFall: tFall, uSplashV: big ? 1.1 : 0.85, uPeriod: big ? 0.32 : 0.26,
      uWidth: big ? 0.006 : 0.005, /* polish: wider splash crown */ uStretch: 0.016, uAlpha: 0.95, uColor: new THREE.Color(0.95, 0.97, 1.0),
    });
    group.add(sp);
    ripGeo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const ru = { uTime, uOn: on, uOff: off, uFall: { value: tFall }, uStrength: { value: big ? 1.25 : 1.15 } };
    const rm = new THREE.ShaderMaterial({ uniforms: ru, vertexShader: RIP_V, fragmentShader: RIP_F, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.push(rm);
    const rip = new THREE.Mesh(ripGeo, rm); rip.name = 'tap-ripple'; const R = big ? 0.24 : 0.14; rip.scale.set(R * 2, 1, R * 2); /* polish: larger foam ring (polish4: the scale call had been commented out by a trailing // since polish, so the ring drew 1 m wide) */
    rip.position.set(land.x, land.y + 0.002, land.z); rip.renderOrder = 2; group.add(rip);
    maxLife = tFall + 0.8;
    shared.info = { tFall, land: land.clone().add(tip) };
    if (f.basin) { // polish: the tub fills while the filler runs (~60 s) and drains when it's off (~40 s)
      const b = f.basin;
      const lu = { uTime, uL0: { value: 0 }, uT0: { value: 0 }, uRate: { value: 0 }, uProf: { value: basinProfile(b, f.tip[1]) },
        uLandUV: { value: new THREE.Vector2(0, 0) } };
      const pr = lu.uProf.value[3]; lu.uLandUV.value.set((land.x + f.tip[0] - b.c[0]) / pr.y, (land.z + f.tip[2] - b.c[2]) / pr.z);
      const lg = b.shape === 'box' ? new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
      lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.2);
      const lm = new THREE.ShaderMaterial({ uniforms: lu, vertexShader: LVL_V, fragmentShader: LVL_F, transparent: true, depthWrite: false });
      mats.push(lm);
      const lvl = new THREE.Mesh(lg, lm); lvl.name = 'tap-level'; lvl.renderOrder = 1; lvl.frustumCulled = false;
      lvl.position.set(b.c[0] - f.tip[0], 0, b.c[2] - f.tip[2]); group.add(lvl);
      const FILL = 1 / 60, DRAIN = -1 / 40;
      level = { u: lu, at: (t) => Math.min(1, Math.max(0, lu.uL0.value + (t - lu.uT0.value) * lu.uRate.value)),
        set(onNow, t) { const l = this.at(t); lu.uL0.value = l; lu.uT0.value = t; lu.uRate.value = onNow ? FILL : DRAIN; } };
    }
  } else {
    // ---- shower head / hand shower
    const hand = f.kind === 'hand';
    const heads = (f.heads || [f.tip]).map(h => new THREE.Vector3(h[0] - f.tip[0], h[1] - f.tip[1], h[2] - f.tip[2]));
    const floorL = f.land - f.tip[1];
    const vy = dir.y * f.v; const tHit = (vy + Math.sqrt(vy * vy + 2 * G * -floorL)) / G;
    const reach = Math.max(1.4, Math.abs(floorL)) + (hand ? 0.8 : 0.4);
    const sph = [0, floorL / 2, 0, reach];
    const box = f.box ? [new THREE.Vector3().fromArray(f.box[0]).sub(tip), new THREE.Vector3().fromArray(f.box[1]).sub(tip)] : [new THREE.Vector3(-99, -99, -99), new THREE.Vector3(99, 99, 99)];
    const common = { uDir: dir, uHead0: heads[0], uHead1: heads[1] || heads[0], uNHeads: heads.length, uSpeed: f.v, uSpread: hand ? 0.16 : 0.10, uDisc: f.r, uFloor: floorL, uBoxMin: box[0], uBoxMax: box[1] };
    const nSpray = Math.round((hand ? 380 : 650) * Math.min(1.6, heads.length * (f.r > 0.07 ? 1.25 : 1)));
    group.add(particles(nSpray, sph, { ...common, uMode: 0, uPeriod: tHit * 1.08 + 0.02, uWidth: hand ? 0.0024 : 0.0028, uStretch: 0.022, uAlpha: 0.5, uColor: new THREE.Color(0.86, 0.9, 0.95) }));
    group.add(particles(hand ? 110 : 220, sph, { ...common, uMode: 1, uShowerSrc: 1, uSplashV: 1.1, uPeriod: 0.34, uWidth: 0.0028, uStretch: 0.014, uAlpha: 0.55, uColor: new THREE.Color(0.85, 0.9, 0.95) }));
    group.add(particles(hand ? 6 : 10, sph, { ...common, uMode: 2, uShowerSrc: 1, uSplashV: 0, uPeriod: 2.6, uWidth: 0.55, uStretch: 0, uAlpha: 0.07, uColor: new THREE.Color(0.9, 0.92, 0.94) }));
    maxLife = tHit + 2.8;
    shared.info = { tFall: tHit };
  }

  function particles(n, sphere, uu) {
    const u = { uTime, uOn: on, uOff: off, uMode: { value: 0 }, uSpeed: { value: 0 }, uSpread: { value: 0 }, uDisc: { value: 0 }, uNHeads: { value: 1 }, uFloor: { value: 0 }, uPeriod: { value: 1 },
      uWidth: { value: 0.003 }, uStretch: { value: 0.02 }, uLandR: { value: 0 }, uFall: { value: 0 }, uSplashV: { value: 1 }, uShowerSrc: { value: 0 },
      uDir: { value: new THREE.Vector3(0, -1, 0) }, uHead0: { value: new THREE.Vector3() }, uHead1: { value: new THREE.Vector3() }, uLand: { value: new THREE.Vector3() }, uBoxMin: { value: new THREE.Vector3(-99, -99, -99) }, uBoxMax: { value: new THREE.Vector3(99, 99, 99) },
      uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0.4 } };
    for (const [k, v] of Object.entries(uu)) u[k] = { value: v };
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: PART_V, fragmentShader: PART_F, transparent: true, depthWrite: false });
    mats.push(m);
    const mesh = new THREE.Mesh(getPartGeo(n, sphere), m); mesh.name = 'tap-particles'; mesh.renderOrder = 4; return mesh;
  }

  return {
    group, mats, tip,
    get running() { return off.value > 1e5; },
    setOn(v, t) { level?.set(v, t); if (v) { on.value = t; off.value = 1e6; } else if (off.value > t) off.value = t; },
    get level() { return level ? level.at(uTime.value) : null; },
    // still something to draw at time t
    alive(t) { return off.value > t || t - off.value < maxLife || (!!level && level.at(t) > 0); },
    setEnv(env, intensity) { const m = shared.stream; if (m && m.envMap !== env) m.envMap = env; if (m && intensity) m.envMapIntensity = intensity; },
    dispose() { for (const m of mats) m.dispose(); },
  };
}
