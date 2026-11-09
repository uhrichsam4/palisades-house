// Sky dome: one big inverted sphere drawn after the opaque pass (depth-tested, so only sky pixels shade).
// Daytime keeps the real HDRI (assets/ph/golden_gate_hills: its land below the ridge line, its sky with the
// sun glare painted out); dusk/night/clouds replace the sky part with a procedural one: gradient + sun glow,
// a 2-layer noise cloud deck, stars, moon, lightning. The same mesh is captured into a small cube map every
// couple of seconds and prefiltered (PMREM) into ENV.outdoor, so facades, pool and terrain are lit and
// reflect the sky you actually see.
import * as THREE from 'three';
import { HORIZON_DECIDEG } from './horizon.js';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4( cameraPosition + position * 1000.0, 1.0 );
  gl_Position = p; gl_Position.z = p.w * 0.99999; // on the far plane whatever the camera's far is
}`;

const FRAG = /* glsl */`
uniform sampler2D tHdr; uniform sampler2D tHz; uniform sampler2D tNoise;
uniform float rotY, uTime, skyDay, starAmt, cover, cdark, flash, haze, fogAmt, sunVis, moonVis;
uniform vec3 sunDir, moonDir, refSun, zenithC, horizonC, glowC, landC, fogC, cloudLit, cloudShade, sunC;
uniform vec2 cloudOff;
varying vec3 vDir;
float hash3( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
void main() {
  vec3 d = normalize( vDir );
  float el = asin( clamp( d.y, -1.0, 1.0 ) );
  float az = atan( d.z, d.x ) - rotY;
  vec2 uv = vec2( fract( az * 0.15915494 + 0.5 ), el * 0.31830989 + 0.5 );
  float hz = texture2D( tHz, vec2( uv.x, 0.5 ) ).r;
  float land = 1.0 - smoothstep( hz - 0.003, hz + 0.003, el );
  vec3 hdr = texture2D( tHdr, uv ).rgb;
  // ---- sky
  float h = max( d.y, 0.0 );
  float sd = dot( d, sunDir );
  vec2 dh = normalize( d.xz + vec2( 1e-5 ) ), sh = normalize( sunDir.xz + vec2( 1e-5 ) );
  float toward = 0.5 + 0.5 * dot( dh, sh );
  // twilight: the warm band sits on the sun's side; the far side goes blue-violet
  float gl = clamp( dot( glowC, vec3( 1.0 ) ) * 1.5, 0.0, 1.0 );
  vec3 hor = mix( horizonC, zenithC * 1.7 + vec3( 0.02, 0.012, 0.03 ) * gl, ( 1.0 - toward ) * 0.65 * gl );
  vec3 sky = mix( hor, zenithC, pow( h, 0.5 ) * ( 1.0 - 0.45 * toward * gl ) );
  sky += glowC * ( pow( toward, 3.0 ) * exp( -h * 3.5 ) + 0.6 * pow( max( sd, 0.0 ), 10.0 ) + 0.25 * pow( toward, 2.0 ) * ( 1.0 - h ) );
  // daytime: the photographed sky, its own sun glare painted out (our sun is drawn below)
  float ref = smoothstep( 0.9925, 0.9995, dot( d, refSun ) );
  vec3 hsky = mix( min( hdr, vec3( 2.5 ) ), mix( horizonC, zenithC, 0.55 ) * 1.25, ref );
  sky = mix( sky, hsky, skyDay * ( 1.0 - land ) );
  // ---- clouds (two noise octaves sets projected on a flat deck)
  float cl = 0.0;
  if ( cover > 0.01 ) {
    vec2 p = d.xz / ( max( d.y, 0.0 ) + 0.09 ) + cloudOff;
    vec4 a = texture2D( tNoise, p * 0.035 ); vec4 b = texture2D( tNoise, p * 0.11 + 0.37 );
    float n = a.r * 0.5 + a.g * 0.25 + b.b * 0.15 + b.a * 0.1;
    float th = 1.0 - cover;
    cl = smoothstep( th - 0.08, th + 0.3, n );
    cl = mix( cl, 1.0, smoothstep( 0.8, 1.0, cover ) );
    cl *= smoothstep( -0.02, 0.1, d.y );
    float thick = clamp( smoothstep( th - 0.05, th + 0.55, n ) * 0.85 + cdark * 0.75, 0.0, 1.0 );
    float sil = pow( max( sd, 0.0 ), 5.0 ) * ( 1.0 - thick );
    vec3 cc = mix( cloudLit * ( 0.8 + 0.7 * sil ), cloudShade, thick );
    cc += flash * vec3( 0.9, 0.92, 1.0 ) * ( 0.6 + 0.6 * n );
    sky = mix( sky, cc, cl * ( 1.0 - land ) );
  }
  // ---- night: stars + moon
  if ( starAmt > 0.001 && land < 1.0 ) {
    vec3 q = d * 260.0; vec3 id = floor( q ); float r = hash3( id );
    vec3 c = id + 0.5 + ( vec3( hash3( id + 1.7 ), hash3( id + 3.1 ), hash3( id + 5.3 ) ) - 0.5 ) * 0.6;
    float s = step( 0.985, r ) * ( 1.0 - smoothstep( 0.0, 0.42, length( q - c ) ) ) * ( 0.4 + 2.5 * fract( r * 97.0 ) );
    s *= 0.75 + 0.25 * sin( uTime * ( 2.0 + 3.0 * fract( r * 31.0 ) ) + r * 50.0 );
    sky += vec3( 0.9, 0.93, 1.0 ) * s * 0.06 * starAmt * ( 1.0 - cl ) * smoothstep( 0.0, 0.15, d.y );
  }
  float md = dot( d, moonDir );
  if ( moonVis > 0.001 && md > 0.99 ) {
    float disk = smoothstep( 0.99993, 0.99996, md );
    vec3 mt = normalize( d - moonDir * md ); float shade = 0.75 + 0.25 * dot( mt, normalize( sunDir - moonDir * dot( sunDir, moonDir ) ) );
    float glow = pow( ( md - 0.99 ) / 0.01, 8.0 ) * 0.05;
    sky += vec3( 0.85, 0.88, 0.95 ) * ( disk * 1.1 * shade + glow ) * moonVis * ( 1.0 - cl * 0.92 );
  }
  // ---- sun disk + tight halo
  if ( sunVis > 0.001 ) {
    float disk = smoothstep( 0.99996, 0.99998, sd );
    sky += sunC * ( disk * 60.0 + pow( max( sd, 0.0 ), 900.0 ) * 3.0 ) * sunVis * ( 1.0 - cl * 0.97 );
  }
  // ---- land (the HDRI's ground and hills, lit by our sun/sky)
  vec3 col = mix( sky, hdr * landC, land );
  col = mix( col, fogC, clamp( haze * exp( -abs( d.y ) * 9.0 ) + fogAmt * ( 1.0 - 0.25 * h ), 0.0, 1.0 ) );
  col += flash * vec3( 0.5, 0.55, 0.7 ) * ( 1.0 - land ) * 0.25;
  gl_FragColor = vec4( max( col, vec3( 0.0 ) ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// tileable value-noise octaves in RGBA (R coarse … A fine), 256² — generated once
function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const grid = (cells, seed) => { const g = new Float32Array(cells * cells); let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; } return g; };
  const octs = [[8, 11], [16, 23], [32, 37], [64, 53]].map(([c, s]) => ({ c, g: grid(c, s) }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (let k = 0; k < 4; k++) {
      const { c, g } = octs[k]; const fx = x / size * c, fy = y / size * c; const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => g[((j % c + c) % c) * c + ((i % c + c) % c)];
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      data[(y * size + x) * 4 + k] = Math.round(v * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
function horizonTexture() {
  const n = HORIZON_DECIDEG.length, data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = HORIZON_DECIDEG[i] / 10 * Math.PI / 180;
  const t = new THREE.DataTexture(data, n, 1, THREE.RedFormat, THREE.FloatType); t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

export function createDome(renderer) {
  const V = () => ({ value: new THREE.Vector3() }), C = () => ({ value: new THREE.Color() }), F = (v = 0) => ({ value: v });
  const uniforms = {
    tHdr: { value: null }, tHz: { value: horizonTexture() }, tNoise: { value: noiseTexture() },
    rotY: F(), uTime: F(), skyDay: F(1), starAmt: F(), cover: F(), cdark: F(), flash: F(), haze: F(), fogAmt: F(), sunVis: F(1), moonVis: F(),
    sunDir: V(), moonDir: V(), refSun: V(), zenithC: C(), horizonC: C(), glowC: C(), landC: C(), fogC: C(), cloudLit: C(), cloudShade: C(), sunC: C(),
    cloudOff: { value: new THREE.Vector2() },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, toneMapped: true });
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mk = () => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 1000; m.castShadow = m.receiveShadow = false; m.name = 'sky:dome'; m.userData.noProbe = true; m.userData.noCull = true; m.userData.keep = true; m.matrixAutoUpdate = false; return m; };
  const mesh = mk();
  // environment capture: the dome alone, 6 faces, prefiltered into a fixed PMREM target (same texture object
  // forever, so outdoor materials never recompile)
  const capScene = new THREE.Scene(); capScene.add(mk());
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false, depthBuffer: false });
  const cubeCam = new THREE.CubeCamera(0.1, 10, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function captureEnv() {
    const prevT = renderer.getRenderTarget(), xr = renderer.xr.enabled, tm = renderer.toneMapping; renderer.xr.enabled = false;
    if (cubeCam.coordinateSystem !== renderer.coordinateSystem) { cubeCam.coordinateSystem = renderer.coordinateSystem; cubeCam.updateCoordinateSystem(); }
    const sv = uniforms.sunVis.value; uniforms.sunVis.value = sv * 0.04; // a prefiltered env smears the sun disk into a big blob on glass
    cubeCam.update(renderer, capScene);
    uniforms.sunVis.value = sv;
    envRT = pmrem.fromCubemap(cubeRT.texture, envRT);
    renderer.setRenderTarget(prevT); renderer.xr.enabled = xr; renderer.toneMapping = tm;
    return envRT.texture;
  }
  // time-sliced version for walk mode: one cube face per call, the prefilter on the 7th (no frame spikes)
  let face = -1;
  function envStep() {
    if (face < 0) return false;
    const prevT = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
    if (face < 6) {
      if (cubeCam.coordinateSystem !== renderer.coordinateSystem) { cubeCam.coordinateSystem = renderer.coordinateSystem; cubeCam.updateCoordinateSystem(); }
      if (face === 0) cubeCam.updateMatrixWorld(true);
      const sv = uniforms.sunVis.value; uniforms.sunVis.value = sv * 0.04;
      renderer.setRenderTarget(cubeRT, face, 0); renderer.render(capScene, cubeCam.children[face]);
      uniforms.sunVis.value = sv; face++;
    } else { envRT = pmrem.fromCubemap(cubeRT.texture, envRT); face = -1; }
    renderer.setRenderTarget(prevT); renderer.xr.enabled = xr;
    return true;
  }
  return { mesh, uniforms, captureEnv, envStep, startEnv() { if (face < 0) face = 0; }, get envBusy() { return face >= 0; }, get envTexture() { return envRT?.texture || null; } };
}
