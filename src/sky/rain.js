// Rain: GPU streaks in a box that travels with the camera (positions wrap in the vertex shader, so the drops
// stay put in the world while you walk), slanted by the wind. A top-down height map of everything solid
// (roofs, ceilings, eaves, trees, ground), rendered ONCE at load, hides every drop below the surface above
// it: no rain indoors or under the porch. The same map tells the sky module whether the camera is indoors.
import * as THREE from 'three';
import { waterBodies } from '../water/index.js';

const HM = { x: 11.5, z: 11, size: 120, res: 512 }; // covers x -48.5..71.5, z -49..71

export function buildHeightMap(renderer, scene) {
  const rt = new THREE.WebGLRenderTarget(HM.res, HM.res, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const cam = new THREE.OrthographicCamera(-HM.size / 2, HM.size / 2, HM.size / 2, -HM.size / 2, 1, 200);
  cam.position.set(HM.x, 120, HM.z); cam.up.set(0, 0, -1); cam.lookAt(HM.x, 0, HM.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  cam.layers.enable(0); cam.layers.enable(30);
  const mat = new THREE.ShaderMaterial({
    vertexShader: `varying float vY; void main() { vec4 p = vec4( position, 1.0 );
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      vec4 w = modelMatrix * p; vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vY; void main() { gl_FragColor = vec4( vY + 100.0, 0.0, 0.0, 1.0 ); }`,
    side: THREE.DoubleSide,
  });
  // skip what can't take the override (skinned / batched / points) and anything see-through-for-rain
  const hidden = [];
  scene.traverse(o => {
    if (!o.visible) return;
    const skip = o.isSkinnedMesh || o.isBatchedMesh || o.isPoints || o.isLine || o.isSprite || (o.name || '').startsWith('sky:') || o.userData.dynamic
      || (o.isMesh && [].concat(o.material).every(m => m && m.transparent && (m.opacity ?? 1) < 0.2));
    if (skip) { o.visible = false; hidden.push(o); }
  });
  const prev = { t: renderer.getRenderTarget(), ov: scene.overrideMaterial, bg: scene.background, fog: scene.fog, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), sm: renderer.shadowMap.autoUpdate, smn: renderer.shadowMap.needsUpdate };
  scene.overrideMaterial = mat; scene.background = null; scene.fog = null; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  const buf = new Uint16Array(HM.res * HM.res * 4); renderer.readRenderTargetPixels(rt, 0, 0, HM.res, HM.res, buf);
  renderer.setRenderTarget(prev.t); scene.overrideMaterial = prev.ov; scene.background = prev.bg; scene.fog = prev.fog; renderer.setClearColor(prev.cc, prev.ca);
  renderer.shadowMap.autoUpdate = prev.sm; renderer.shadowMap.needsUpdate = prev.smn;
  for (const o of hidden) o.visible = true;
  mat.dispose();
  const heights = new Float32Array(HM.res * HM.res);
  for (let i = 0; i < heights.length; i++) { const v = THREE.DataUtils.fromHalfFloat(buf[i * 4]); heights[i] = v > 0 ? v - 100 : -100; }
  // texture rows: v = 0 at the bottom of the image = +z side (camera up is −z)
  const heightAt = (x, z) => {
    const u = (x - HM.x) / HM.size + 0.5, v = (HM.z - z) / HM.size + 0.5;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return -100;
    return heights[Math.floor(v * HM.res) * HM.res + Math.floor(u * HM.res)];
  };
  // Gaps (contain pass): openings in the static map. Each texel holds a [lo, hi] height band (+100, 0 = none) where
  // precipitation IS allowed even below the roof: a strip just inside an open/broken window or a broken exterior wall
  // panel, from that storey's floor up to the top of the hole. Re-stamped on the CPU only when the set of holes changes
  // (sky/index.js polls window.__building at 2 Hz), uploaded as one small RG half-float texture.
  const N = HM.res * HM.res, gapData = new Uint16Array(N * 2), touched = [];
  const gapTex = new THREE.DataTexture(gapData, HM.res, HM.res, THREE.RGFormat, THREE.HalfFloatType);
  gapTex.minFilter = gapTex.magFilter = THREE.NearestFilter; gapTex.generateMipmaps = false; gapTex.needsUpdate = true;
  const H = THREE.DataUtils.toHalfFloat, F = THREE.DataUtils.fromHalfFloat, texel = HM.size / HM.res;
  // gaps: [{ cx, cz, ux, uz, half, nx, nz, n0, n1, lo, hi }] oriented rects (u = along the wall, n = into the room)
  function setGaps(gaps) {
    for (const i of touched) { gapData[i * 2] = 0; gapData[i * 2 + 1] = 0; } touched.length = 0;
    for (const g of gaps) {
      const ex = Math.abs(g.ux) * g.half + Math.max(Math.abs(g.nx * g.n0), Math.abs(g.nx * g.n1)), ez = Math.abs(g.uz) * g.half + Math.max(Math.abs(g.nz * g.n0), Math.abs(g.nz * g.n1));
      const c0 = Math.max(0, Math.floor(((g.cx - ex - HM.x) / HM.size + 0.5) * HM.res)), c1 = Math.min(HM.res - 1, Math.ceil(((g.cx + ex - HM.x) / HM.size + 0.5) * HM.res));
      const r0 = Math.max(0, Math.floor(((HM.z - g.cz - ez) / HM.size + 0.5) * HM.res)), r1 = Math.min(HM.res - 1, Math.ceil(((HM.z - g.cz + ez) / HM.size + 0.5) * HM.res));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = HM.x + ((c + 0.5) / HM.res - 0.5) * HM.size, z = HM.z - ((r + 0.5) / HM.res - 0.5) * HM.size;
        const dx = x - g.cx, dz = z - g.cz; const u = dx * g.ux + dz * g.uz, n = dx * g.nx + dz * g.nz;
        if (Math.abs(u) > g.half + texel * 0.5 || n < g.n0 - texel * 0.5 || n > g.n1 + texel * 0.5) continue;
        const i = r * HM.res + c; let lo = g.lo, hi = g.hi;
        if (gapData[i * 2]) { lo = Math.min(lo, F(gapData[i * 2]) - 100); hi = Math.max(hi, F(gapData[i * 2 + 1]) - 100); } else touched.push(i);
        gapData[i * 2] = H(lo + 100); gapData[i * 2 + 1] = H(hi + 100);
      }
    }
    gapTex.needsUpdate = true; return touched.length;
  }
  const gapAt = (x, z) => { const u = (x - HM.x) / HM.size + 0.5, v = (HM.z - z) / HM.size + 0.5; if (u < 0 || u >= 1 || v < 0 || v >= 1) return null; const i = Math.floor(v * HM.res) * HM.res + Math.floor(u * HM.res); return gapData[i * 2] ? [F(gapData[i * 2]) - 100, F(gapData[i * 2 + 1]) - 100] : null; };
  return { texture: rt.texture, heightAt, rect: new THREE.Vector4(HM.x, HM.z, HM.size, HM.size), rt, gapTexture: gapTex, setGaps, gapAt };
}

const RVERT = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uSide; uniform float uTime, uFall, uLen, uWidth;
uniform vec2 uWind; uniform sampler2D tHeight, tGap; uniform vec4 uHM; uniform float uSnow, uSwirl;
varying float vA; varying vec2 vUv;
void main() {
  // rain: fast straight streaks; snow (uSnow = 1): slow flakes that drift and swirl (more in a blizzard)
  float spd = mix( uFall * ( 0.8 + 0.4 * aSeed.w ), 0.8 + 0.7 * aSeed.w + uSwirl * 1.2, uSnow );
  vec3 vel = vec3( uWind.x, -spd, uWind.y );
  vec3 p = aSeed.xyz * uBox + vel * uTime;
  vec3 lo = uCam - uBox * vec3( 0.5, 0.45, 0.5 );
  p = lo + mod( p - lo, uBox );
  float ph = uTime * ( 0.6 + 0.9 * aSeed.w ) + aSeed.x * 40.0;
  p.xz += uSnow * vec2( sin( ph ), cos( ph * 1.3 + aSeed.z * 20.0 ) ) * ( 0.25 + 1.4 * uSwirl );
  vec2 hu = vec2( ( p.x - uHM.x ) / uHM.z + 0.5, ( uHM.y - p.z ) / uHM.w + 0.5 );
  float occ = -100.0;
  bool gap = false; // inside an opening's strip, between that storey's floor and the top of the hole (rain.js setGaps)
  if ( hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0 ) { float t = texture2D( tHeight, hu ).r; occ = t > 0.0 ? t - 100.0 : -100.0;
    vec2 gp = texture2D( tGap, hu ).rg; gap = gp.x > 0.0 && p.y > gp.x - 100.0 && p.y < gp.y - 100.0; }
  vec3 axis = normalize( vel );
  float dist = length( p - uCam );
  // streak across the view: uSide = normalize( cross( fall direction, camera forward ) ), set per frame on the CPU
  // (deriving it per vertex with normalize() came out degenerate on ANGLE/Metal)
  // streak = motion blur of one drop: length = its speed x a ~1/40 s shutter (uLen is that factor for rain), thin
  // (≈ 1 px wide at any distance, never a ribbon up close); snow keeps its fixed flake size. Fades out near the lens.
  // (shape after Ashwyn28/weather-effects, MIT: bright leading end, soft tail)
  float len = mix( uLen * spd, uLen, uSnow );
  float wid = mix( max( uWidth, dist * 0.0016 ), uWidth * max( 1.0, dist * 0.12 ), uSnow );
  vec3 wp = p - axis * len * position.y + uSide * ( wid * position.x );
  vA = ( 1.0 - smoothstep( uBox.x * 0.5 - 4.0, uBox.x * 0.5, dist ) ) * mix( smoothstep( 0.9, 3.2, dist ), smoothstep( 0.4, 1.2, dist ), uSnow );
  vUv = vec2( position.x, position.y );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  if ( p.y < occ + 0.02 && !gap ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); // under a roof / below the ground (unless in an opening)
}`;
const RFRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha; uniform float uSnow;
varying float vA; varying vec2 vUv;
void main() {
  float a = ( 1.0 - smoothstep( 0.1, 1.0, abs( vUv.x ) * 2.0 ) ) * smoothstep( 0.0, 0.06, vUv.y ) * mix( 1.0, 0.08, smoothstep( 0.05, 1.0, vUv.y ) );
  float flake = 1.0 - smoothstep( 0.25, 1.0, length( vec2( vUv.x * 2.0, vUv.y * 2.0 - 1.0 ) ) );
  a = mix( a, flake, uSnow );
  gl_FragColor = vec4( uColor, a * vA * uAlpha );
}`;


// Ground splashes: little rings that pop on whatever is on top (ground, deck, roof, pool) around the camera.
// Each instance re-rolls its spot every cycle from a hash (no CPU work), height from the same height map.
// (ring shape after Ashwyn28/weather-effects, MIT)
const SVERT = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uCam; uniform float uTime, uR; uniform sampler2D tHeight, tGap; uniform vec4 uHM;
varying vec2 vUv; varying float vA;
float h1( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
void main() {
  float T = 0.32 + 0.2 * aSeed.w; float c = uTime / T + aSeed.z * 7.0; float k = floor( c ), ph = c - k;
  vec2 r = vec2( h1( aSeed.xy + k ), h1( aSeed.yx * 1.7 + k * 1.3 ) );
  vec2 xz = uCam.xz + ( r - 0.5 ) * 2.0 * uR;
  vec2 hu = vec2( ( xz.x - uHM.x ) / uHM.z + 0.5, ( uHM.y - xz.y ) / uHM.w + 0.5 );
  float y = -100.0; if ( hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0 ) { float t = texture2D( tHeight, hu ).r; y = t > 0.0 ? t - 100.0 : -100.0;
    float g = texture2D( tGap, hu ).r; if ( g > 0.0 ) y = g - 100.0; } // inside an opening: rings on that storey's floor
  float s = 0.03 + 0.09 * ph;
  vec3 wp = vec3( xz.x + position.x * s, y + 0.012, xz.y + position.y * s );
  float d = length( wp - uCam );
  vA = ( 1.0 - ph ) * ( 1.0 - smoothstep( uR * 0.6, uR, d ) ) * step( -50.0, y ) * step( y, uCam.y + 0.3 );
  vUv = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  if ( vA < 0.01 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
}`;
const SFRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying float vA;
void main() { float r = length( vUv ) * 2.0; float a = ( 1.0 - smoothstep( 0.06, 0.22, abs( r - 0.75 ) ) ) * ( 1.0 - smoothstep( 0.85, 1.0, r ) );
  gl_FragColor = vec4( uColor, a * vA * uAlpha ); }`;
function createSplashes(hm, max, uniforms) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
  const seeds = new Float32Array(max * 4); let s = 777; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); g.instanceCount = 0;
  const U = { uCam: uniforms.uCam, uTime: uniforms.uTime, uR: { value: 9 }, tHeight: uniforms.tHeight, tGap: uniforms.tGap, uHM: uniforms.uHM, uColor: uniforms.uColor, uAlpha: { value: 0.5 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SVERT, fragmentShader: SFRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5; m.name = 'sky:rain:splash'; m.matrixAutoUpdate = false;
  m.userData.noProbe = true; m.userData.noCull = true; m.userData.keep = true; m.castShadow = false;
  return { mesh: m, g, U, max };
}

const _ax = new THREE.Vector3(), _fw = new THREE.Vector3(), _sd = new THREE.Vector3();
export function createRain(hm, { max = 11000 } = {}) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seeds = new Float32Array(max * 4); let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  g.instanceCount = 0;
  const uniforms = { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 16, 26) }, uTime: { value: 0 }, uFall: { value: 9 }, uLen: { value: 0.7 }, uWidth: { value: 0.012 }, uSide: { value: new THREE.Vector3(1, 0, 0) }, uSnow: { value: 0 }, uSwirl: { value: 0 },
    uWind: { value: new THREE.Vector2() }, tHeight: { value: hm.texture }, tGap: { value: hm.gapTexture }, uHM: { value: hm.rect }, uColor: { value: new THREE.Color(0.6, 0.64, 0.7) }, uAlpha: { value: 0.32 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: RVERT, fragmentShader: RFRAG, transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'sky:rain'; mesh.visible = false;
  mesh.userData.noProbe = true; mesh.userData.noCull = true; mesh.userData.keep = true; mesh.matrixAutoUpdate = false; mesh.castShadow = false;
  const SPL = createSplashes(hm, 900, uniforms); mesh.add(SPL.mesh); // child: shown/hidden with the rain
  // pool / spa: rain rings (at most ~25 Hz, a handful of drops per body)
  const bounds = new Map(); let acc = 0;
  function ripples(dt, amount) {
    if (amount < 0.02) return; acc += dt; if (acc < 0.04) return; const step = acc; acc = 0;
    for (const b of waterBodies) {
      let bb = bounds.get(b); if (!bb) { const o = b.outline || []; bb = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }; for (const [x, z] of o) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.z0 = Math.min(bb.z0, z); bb.z1 = Math.max(bb.z1, z); } bounds.set(b, bb); }
      if (!isFinite(bb.x0)) continue;
      const area = (bb.x1 - bb.x0) * (bb.z1 - bb.z0); let n = amount * area * 0.9 * step; // drops this step
      while (n > 0) { if (n < 1 && Math.random() > n) break; n -= 1;
        const x = bb.x0 + Math.random() * (bb.x1 - bb.x0), z = bb.z0 + Math.random() * (bb.z1 - bb.z0);
        try { b.disturb(x, z, 0.05, 0.12 + 0.2 * Math.random()); } catch {} }
    }
  }
  return {
    mesh, uniforms, splash: SPL.mesh,
    // snowK 0..1: how much of the precipitation is snow (rain → flakes)
    update(dt, t, camera, amount, wind, windDir, light, splashes = true, snowK = 0) {
      const cam = camera.position; uniforms.uSnow.value = snowK; uniforms.uSwirl.value = snowK * wind;
      const n = Math.round(amount * max); g.instanceCount = n; mesh.visible = n > 0;
      if (!n) return;
      uniforms.uTime.value = t % 1000; uniforms.uCam.value.copy(cam);
      const ws = snowK > 0.5 ? 1 + wind * 7 : 1 + wind * 3 + wind * wind * 9; uniforms.uWind // polish: storm gusts drive the streaks to ~50° (rain ~20°).value.set(Math.cos(windDir) * ws, Math.sin(windDir) * ws);
      _ax.set(uniforms.uWind.value.x, -uniforms.uFall.value, uniforms.uWind.value.y).normalize(); camera.getWorldDirection(_fw);
      _sd.crossVectors(_ax, _fw); if (_sd.lengthSq() < 1e-6) _sd.set(1, 0, 0); uniforms.uSide.value.copy(_sd.normalize());
      uniforms.uFall.value = 8.5 + amount * 2; uniforms.uLen.value = snowK > 0.5 ? 0.05 : 0.026 + 0.014 * amount; // polish: longer, heavier storm streaks // rain: seconds of shutter (x speed)
      uniforms.uWidth.value = snowK > 0.5 ? 0.012 + 0.03 * snowK : 0.0038 + 0.0022 * amount;
      uniforms.uColor.value.setRGB(0.25 + 0.95 * light, 0.27 + 1.0 * light, 0.32 + 1.05 * light);
      uniforms.uAlpha.value = (0.5 + 0.25 * amount) * (1 - snowK) + 0.85 * snowK;
      if (snowK > 0.5) uniforms.uColor.value.multiplyScalar(1.25);
      SPL.g.instanceCount = splashes && snowK < 0.5 ? Math.round(SPL.max * Math.min(1, amount * 1.3)) : 0; SPL.U.uAlpha.value = 0.35 + 0.25 * amount; // ground splashes (High weather detail)
      if (splashes && snowK < 0.5) ripples(dt, amount); // the pool doesn't freeze; flakes just melt in // Low/Medium quality: no pool rings
    },
  };
}
