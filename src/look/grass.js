// Lawn grass: instanced blades on the pool lawn strip (src/rooms/pool.js: x 7.0..23.4, z 28.6..31.2, y -0.12),
// one draw. Technique after muratkamci/snakey-locomotion (MIT, (c) 2026 Murat Kamci) grass.ts — tapered blades
// bent in the vertex shader by layered wind, a back-lit translucency term, blades pushed away / flattened where
// players walk — and paulrobello/grass-blade (MIT) LOD idea: blade density thins and blades shrink into the ground
// texture with distance from the camera, so far away only the existing lawn texture is left (and nothing is drawn
// at all from > 40 m). Snow: blades go white and short with __sky.snowCover.
import * as THREE from 'three';

const LAWNS = [{ x0: 7.05, x1: 23.35, z0: 28.66, z1: 30.84, y: -0.12 }]; // fence at z 30.9: stay inside it
const DENS = { low: 260, high: 620 }; // blades / m²

const VERT = /* glsl */`
attribute vec4 aB; // x, z, rand, rand2
uniform vec3 uCam; uniform float uTime, uWind, uY, uSnow, uFar, uKeep; uniform vec2 uWindDir; uniform vec4 uTrample[4];
varying float vH; varying float vRand; varying vec3 vN; varying vec3 vWP; varying float vFade;
void main() {
  vec3 base = vec3(aB.x, uY, aB.y);
  float d = distance(base.xz, uCam.xz);
  // LOD: thin out with distance (aB.z keeps a stable subset) and sink the rest into the lawn texture
  float keep = step(aB.z, mix(1.0, 0.25, smoothstep(6.0, uFar, d)) * uKeep);
  float fade = (1.0 - smoothstep(uFar * 0.75, uFar, d)) * keep; vFade = fade;
  float h = (0.07 + 0.07 * aB.w) * mix(1.0, 0.35, uSnow) * fade;
  float ang = aB.z * 47.0; vec2 dirB = vec2(cos(ang), sin(ang));
  float t = position.y; // 0 root .. 1 tip
  float w = 0.008 * (1.0 - t) * (0.8 + 0.4 * aB.w);
  vec3 p = base + vec3(-dirB.y, 0.0, dirB.x) * position.x * w * 2.0;
  // wind: big slow gusts + per-blade flutter
  float g = sin(dot(base.xz, uWindDir) * 0.35 - uTime * (1.2 + 2.0 * uWind)) * 0.5 + 0.5;
  float fl = sin(uTime * 5.0 + aB.z * 60.0) * 0.25;
  vec2 bend = uWindDir * (0.15 + 0.85 * uWind) * (0.35 + 0.65 * g) + dirB * (0.25 + fl * uWind);
  // trample: blades near a walker lean away and flatten
  float flatK = 0.0;
  for (int i = 0; i < 4; i++) { vec2 dv = base.xz - uTrample[i].xy; float r = length(dv); float k = (1.0 - smoothstep(0.15, 0.55, r)) * uTrample[i].w; flatK = max(flatK, k); bend += normalize(dv + 1e-4) * k * 2.5; }
  float bl = min(length(bend), 2.2); vec2 bd = bend / max(length(bend), 1e-4);
  float lean = bl * 0.45 * t * t; // radians-ish, more at the tip
  p.xz += bd * h * sin(lean); p.y += h * t * cos(lean) * (1.0 - 0.75 * flatK);
  vH = t; vRand = aB.w; vN = normalize(vec3(bd.x * 0.6, 1.0, bd.y * 0.6)); vWP = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (fade < 0.02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FRAG = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSky, uGround, uRoot, uTip; uniform float uSnow;
varying float vH; varying float vRand; varying vec3 vN; varying vec3 vWP; varying float vFade;
void main() {
  vec3 alb = mix(uRoot, uTip, vH) * (0.8 + 0.4 * vRand);
  alb = mix(alb, vec3(0.86, 0.88, 0.92), uSnow * smoothstep(0.2, 0.9, vH + 0.3));
  vec3 V = normalize(cameraPosition - vWP);
  float ndl = max(dot(vN, uSunDir), 0.0) * 0.8 + 0.2;
  float trans = pow(max(dot(-V, uSunDir), 0.0), 3.0) * vH * 0.9; // back-lit blades glow
  vec3 amb = mix(uGround, uSky, 0.5 + 0.5 * vN.y) * (0.45 + 0.55 * vH);
  vec3 c = alb * (amb + uSunCol * (ndl + trans * vec3(1.0, 1.1, 0.6)));
  gl_FragColor = vec4(c, 1.0);
}`;

export function createGrass({ scene, sun, hemi }) {
  // blade: 2-sided ribbon, 4 segments (root..tip), x in -0.5..0.5
  const bp = [], bi = []; const S = 4;
  for (let i = 0; i <= S; i++) { const t = i / S; bp.push(-0.5, t, 0, 0.5, t, 0); }
  for (let i = 0; i < S; i++) { const a = i * 2; bi.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  let s = 4242; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const all = [];
  for (const L of LAWNS) { const n = Math.round((L.x1 - L.x0) * (L.z1 - L.z0) * DENS.high); for (let i = 0; i < n; i++) all.push(L.x0 + r() * (L.x1 - L.x0), L.z0 + r() * (L.z1 - L.z0), r(), r()); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setIndex(bi);
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(all), 4));
  const N = all.length / 4; g.instanceCount = N;
  const U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: { value: 0.2 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uY: { value: LAWNS[0].y }, uSnow: { value: 0 }, uFar: { value: 22 }, uKeep: { value: 1 },
    uTrample: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uRoot: { value: new THREE.Color(0x26301a) }, uTip: { value: new THREE.Color(0x74843f) } }; /* tip ~ the lawn texture's muted #6d8a3e (pool/props.js) */
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.name = 'look:grass';
  Object.assign(mesh.userData, { noProbe: true, noCull: true, keep: true, noPathTrace: true, waterSkip: true });
  scene.add(mesh);
  const box = new THREE.Box3(new THREE.Vector3(LAWNS[0].x0, -0.3, LAWNS[0].z0), new THREE.Vector3(LAWNS[0].x1, 0.3, LAWNS[0].z1));
  let mode = 'high';
  return { mesh, blades: N,
    set mode(v) { mode = v; }, get mode() { return mode; },
    update(dt, t, camera, sky, walkers = []) {
      const cp = camera.position; const d = box.distanceToPoint(cp);
      mesh.visible = mode !== 'off' && d < U.uFar.value + 4;
      if (!mesh.visible) return;
      U.uKeep.value = mode === 'low' ? DENS.low / DENS.high : 1; U.uFar.value = mode === 'low' ? 15 : 22;
      U.uCam.value.copy(cp); U.uTime.value = t % 1000;
      if (sky) { U.uWind.value = sky.wind; const wd = sky.windDir; U.uWindDir.value.set(wd.x, wd.y); U.uSnow.value = Math.min(1, sky.snowCover * 1.2); }
      U.uSunDir.value.subVectors(sun.position, sun.target.position).normalize();
      U.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.22);
      U.uSky.value.copy(hemi.color).multiplyScalar(hemi.intensity * 1.6 + 0.08); U.uGround.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 0.8 + 0.03);
      for (let i = 0; i < 4; i++) { const w = walkers[i]; if (w) U.uTrample.value[i].set(w.x, w.z, 0, Math.abs(w.y - LAWNS[0].y) < 0.6 ? 1 : 0); else U.uTrample.value[i].w = 0; }
    } };
}
