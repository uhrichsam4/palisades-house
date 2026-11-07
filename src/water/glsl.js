// GLSL for the water simulation + rendering. Conventions:
//   uBox = (originX, originZ, sizeX, sizeZ) of the body's simulation grid in world XZ; uv = (xz - o) / size.
//   tSurf  (HalfFloat, linear): r = sim height (m, relative to surfaceY), g = dh/dx, b = dh/dz, a = mask.
//   uStatic(HalfFloat, linear): r = mask (1 inside outline), g = still-water depth (m, dilated outside), b = floorY.
//   Ambient wind ripples are ANALYTIC (sum of NW directional capillary-gravity waves), evaluated where needed and
//   mirrored on the CPU for heightAt(). Micro ripples (NM) are shading-only.
export const NW = 16, NM = 8, MAX_DROPS = 16;

export const wavesGLSL = /* glsl */`
#define NW ${NW}
#define NM ${NM}
uniform vec4 uWA[NW];   // dir.x, dir.z, k, amplitude
uniform vec2 uWB[NW];   // omega, phase
uniform float uTime;
uniform float uAmb;     // ambient amplitude scale
// (h, dh/dx, dh/dz)
vec3 ambientWaves(vec2 p) {
  vec3 r = vec3(0.0);
  for (int i = 0; i < NW; i++) {
    vec4 a = uWA[i];
    float th = a.z * dot(a.xy, p) - uWB[i].x * uTime + uWB[i].y;
    float s = sin(th), c = cos(th);
    r.x += a.w * s; r.yz += a.w * a.z * c * a.xy;
  }
  return r * uAmb;
}
`;

export const microGLSL = /* glsl */`
uniform vec4 uMA[NM]; uniform vec2 uMB[NM];
// shading-only fine ripples; faded out where a wavelength is under a few pixels (no sparkle aliasing)
vec2 microWaves(vec2 p, float fw) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < NM; i++) {
    vec4 a = uMA[i];
    float lamPx = 6.2831853 / (a.z * max(fw, 1e-5));
    float w = smoothstep(2.5, 7.0, lamPx);
    float th = a.z * dot(a.xy, p) - uMB[i].x * uTime + uMB[i].y;
    g += w * a.w * a.z * cos(th) * a.xy;
  }
  return g * uAmb;
}
`;

// ---------------------------------------------------------------- simulation (GPUComputationRenderer variable tH)
// r = height, g = vertical velocity. Linear wave equation, symplectic Euler, reflective (Neumann) walls at the mask.
export const simFrag = /* glsl */`
uniform sampler2D uStatic;
uniform float uC2;      // (c dt / dx)^2
uniform float uDamp;    // velocity damping per step
uniform float uRelax;   // height relaxation per step (kills volume drift)
uniform vec4 uBox;
uniform vec4 uDrops[${MAX_DROPS}]; // x, z, radius, dh
uniform int uNDrops;
float nb(vec2 q, float h) { return texture2D(uStatic, q).r > 0.5 ? texture2D(tH, q).r : h; }
void main() {
  vec2 cell = 1.0 / resolution.xy;
  vec2 uv = gl_FragCoord.xy * cell;
  if (texture2D(uStatic, uv).r < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec4 s = texture2D(tH, uv);
  float h = s.r;
  float lap = nb(uv - vec2(cell.x, 0.0), h) + nb(uv + vec2(cell.x, 0.0), h) + nb(uv - vec2(0.0, cell.y), h) + nb(uv + vec2(0.0, cell.y), h) - 4.0 * h;
  float v = (s.g + uC2 * lap) * uDamp;
  h = (h + v) * uRelax;
  vec2 wp = uBox.xy + uv * uBox.zw;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uNDrops) break;
    vec4 d = uDrops[i];
    float r = length(wp - d.xy) / d.z;
    if (r < 1.0) h += d.w * 0.5 * (1.0 + cos(3.14159265 * r));
  }
  gl_FragColor = vec4(clamp(h, -0.25, 0.25), clamp(v, -0.05, 0.05), 0.0, 1.0);
}
`;

// derived surface texture: height + central-difference gradient (Neumann at the mask)
export const surfFrag = /* glsl */`
uniform sampler2D tSim;
uniform sampler2D uStatic;
uniform float uCell;
float hs(vec2 q, float h) { return texture2D(uStatic, q).r > 0.5 ? texture2D(tSim, q).r : h; }
void main() {
  vec2 cell = 1.0 / resolution.xy;
  vec2 uv = gl_FragCoord.xy * cell;
  float m = texture2D(uStatic, uv).r;
  float h = texture2D(tSim, uv).r;
  float gx = (hs(uv + vec2(cell.x, 0.0), h) - hs(uv - vec2(cell.x, 0.0), h)) / (2.0 * uCell);
  float gz = (hs(uv + vec2(0.0, cell.y), h) - hs(uv - vec2(0.0, cell.y), h)) / (2.0 * uCell);
  gl_FragColor = vec4(h * m, gx * m, gz * m, m);
}
`;

// ---------------------------------------------------------------- caustics (Evan Wallace style, projected onto the floor)
// A dense grid of surface points is refracted along the sun direction and splatted onto the floor (in floor XZ, the
// same domain as uBox). Each triangle's brightness = flat-water area / refracted area; additive blending sums folds.
export const causticVert = /* glsl */`
${wavesGLSL}
uniform sampler2D tSurf;
uniform sampler2D uStatic;
uniform vec4 uBox;
uniform vec3 uSun; // direction TO the sun
varying vec2 vOld;
varying vec2 vNew;
vec2 toUV(vec2 p) { return (p - uBox.xy) / uBox.zw; }
void main() {
  vec2 uv = position.xy;
  vec2 p = uBox.xy + uv * uBox.zw;
  vec4 s = texture2D(tSurf, uv);
  vec3 a = ambientWaves(p);
  vec3 n = normalize(vec3(-(s.y + a.y), 1.0, -(s.z + a.z)));
  vec3 L = -uSun;
  vec3 r = refract(L, n, 0.7502);
  vec3 r0 = refract(L, vec3(0.0, 1.0, 0.0), 0.7502);
  float d = max(texture2D(uStatic, uv).g, 0.0);
  // flat-water hit (two iterations so steps/slopes land on the right floor height)
  vec2 o = p + r0.xz * (d / -r0.y);
  float d1 = max(texture2D(uStatic, toUV(o)).g, 0.0);
  o = p + r0.xz * (d1 / -r0.y);
  vec2 q = p + r.xz * ((d + s.x + a.x) / -r.y);
  float d2 = max(texture2D(uStatic, toUV(q)).g, 0.0);
  q = p + r.xz * ((d2 + s.x + a.x) / -r.y);
  vOld = o; vNew = q;
  gl_Position = vec4(toUV(q) * 2.0 - 1.0, 0.0, 1.0);
}
`;
export const causticFrag = /* glsl */`
varying vec2 vOld;
varying vec2 vNew;
void main() {
  vec2 ox = dFdx(vOld), oy = dFdy(vOld), nx = dFdx(vNew), ny = dFdy(vNew);
  float oldA = abs(ox.x * oy.y - ox.y * oy.x);
  float newA = abs(nx.x * ny.y - nx.y * ny.x);
  float I = oldA / max(newA, 1e-12);
  gl_FragColor = vec4(min(I, 12.0), 0.0, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------- underside of the surface (seen when diving)
export const undersideVert = /* glsl */`
uniform sampler2D tSurf;
uniform vec4 uBox;
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += texture2D(tSurf, (wp.xz - uBox.xy) / uBox.zw).r;
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const undersideFrag = /* glsl */`
${wavesGLSL}
${microGLSL}
uniform sampler2D tSurf;
uniform vec4 uBox;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uDeep;
uniform vec4 uFog;
uniform vec3 uSun;
varying vec3 vWP;
void main() {
  vec2 uv = (vWP.xz - uBox.xy) / uBox.zw;
  vec4 S = texture2D(tSurf, uv);
  vec3 A = ambientWaves(vWP.xz);
  float fw = length(fwidth(vWP.xz));
  vec2 g = S.yz + A.yz + microWaves(vWP.xz, fw);
  vec3 n = normalize(vec3(g.x, -1.0, g.y));   // facing down, into the water
  vec3 V = normalize(cameraPosition - vWP);   // towards the eye (downwards)
  vec3 T = refract(-V, -n, 1.333);            // water -> air
  vec3 col;
  if (dot(T, T) < 1e-4) {
    col = uDeep * (0.75 + 2.5 * abs(g.x + g.y));  // total internal reflection: mirror of the pool interior
  } else {
    float c = clamp(dot(V, -n), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
    vec3 sky = mix(uSkyHorizon, uSkyZenith, clamp(T.y, 0.0, 1.0));
    sky += vec3(1.0, 0.95, 0.85) * 12.0 * pow(max(dot(T, uSun), 0.0), 600.0);
    col = mix(sky, uDeep, F);
  }
  float dist = length(cameraPosition - vWP);
  float f = 1.0 - exp(-dist * uFog.w);
  col = mix(col, uFog.rgb, f);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// full-screen underwater tint (camera below the surface)
export const tintVert = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const tintFrag = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float vig = smoothstep(0.35, 1.0, length(vUv - 0.5) * 1.6);
  gl_FragColor = vec4(uColor * (1.0 - 0.5 * vig), uAlpha + 0.25 * vig);
  #include <colorspace_fragment>
}
`;
