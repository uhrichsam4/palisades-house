// Canyon atmosphere for the site: a pale, hazy Palisades sky dome (covers the HDRI background, whose
// own green hills and cumulus don't belong to this canyon), aerial-perspective haze for far terrain /
// trees / houses, and layered far ridgelines beyond the terrain mesh.
import * as THREE from 'three';
import { fbm, ss, CENTER } from './terrain.js';

// linear-light colours (the composer tone-maps afterwards)
export const HAZE = new THREE.Color(0.66, 0.74, 0.82);
const ZENITH = new THREE.Color(0.15, 0.30, 0.58);

// Distance haze: mixes the lit colour towards the horizon sky with view distance.
export function addHaze(mat, L = 4200, max = 0.8) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.hazeCol = { value: HAZE };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 hazeCol;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
  { float hd = length( vViewPosition ); float hf = min( ${max.toFixed(3)}, 1.0 - exp( -hd / ${L.toFixed(1)} ) ); gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeCol, hf ); }`);
  };
  mat.customProgramCacheKey = () => prevKey() + '-haze' + L + '-' + max;
  return mat;
}

export function skyDome(root) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { zen: { value: ZENITH }, hor: { value: HAZE } },
    vertexShader: `varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 ); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 zen; uniform vec3 hor; varying vec3 vDir;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize( vDir ); float e = max( d.y, 0.0 );
  vec3 c = mix( hor, zen, pow( smoothstep( 0.0, 1.0, e ), 0.55 ) );
  // faint high cirrus streaks (thin, stretched along one direction)
  vec2 q = d.xz / ( 0.25 + e ) * 3.0; q = vec2( q.x * 0.35 + q.y * 0.9, q.y * 0.35 - q.x * 0.9 );
  float ci = n2( q * vec2( 1.0, 9.0 ) ) * 0.6 + n2( q * vec2( 2.0, 18.0 ) ) * 0.4; ci = smoothstep( 0.62, 0.95, ci ) * n2( q * 0.4 ) * smoothstep( 0.03, 0.25, e );
  c = mix( c, hor * 1.1, ci * 0.14 );
  if ( d.y < 0.0 ) c = hor * 0.92;
  gl_FragColor = vec4( c, 1.0 );
}`,
    depthWrite: false, side: THREE.BackSide,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat);
  m.name = 'site-sky'; m.frustumCulled = false; m.renderOrder = -10; m.userData.keep = true; m.castShadow = m.receiveShadow = false;
  root.add(m);
  return m;
}

// Layered far ridgelines (beyond the 3.2 km terrain mesh): flat hazy silhouettes, sage fading to blue-grey.
export function farRidges(root) {
  const layers = [
    { R: 3350, base: 70, amp: 85, f: 1.9, seed: 3, col: [0.30, 0.36, 0.33], haze: 0.62 },
    { R: 3600, base: 120, amp: 110, f: 1.3, seed: 7, col: [0.33, 0.39, 0.42], haze: 0.72 },
    { R: 3850, base: 175, amp: 140, f: 0.9, seed: 11, col: [0.40, 0.46, 0.52], haze: 0.8 },
  ];
  const pos = [], col = [], idx = []; const c = new THREE.Color();
  for (const Ly of layers) {
    const N = 720, b0 = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, x = CENTER[0] + Math.cos(a) * Ly.R, z = CENTER[1] + Math.sin(a) * Ly.R;
      // +z (canyon side) gets the ridges; the -z side already has the mountain
      const side = ss(-0.3, 0.4, Math.sin(a));
      const h = (Ly.base + Ly.amp * (0.55 + 0.6 * fbm(a * Ly.f * 6, Ly.seed, 4, Ly.seed))) * (0.35 + 0.65 * side);
      c.setRGB(...Ly.col).lerp(HAZE, Ly.haze);
      pos.push(x, -260, z, x, h, z);
      const top = c.clone().multiplyScalar(1.0), bot = c.clone().lerp(HAZE, 0.25);
      col.push(bot.r, bot.g, bot.b, top.r, top.g, top.b);
      if (i < N) { const k = b0 + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  m.name = 'site-far-ridges'; m.frustumCulled = false; m.userData.keep = true; root.add(m);
  return m;
}
