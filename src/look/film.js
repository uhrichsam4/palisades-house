// Film look for the OutputPass: AgX tone mapping (three core) with an exposure match, plus a subtle procedural
// 3D-LUT grade (stored as a 2D strip) in display space (gentle S-curve, a little saturation back after AgX's desaturation, cool shadows /
// warm highlights). Patches the OutputPass shader text main.js already patched for the white balance; ~0.1 ms.
import * as THREE from 'three';

const N = 32;
function makeLut() {
  const d = new Uint8Array(N * N * N * 4);
  const sm = (x) => x * x * (3 - 2 * x);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    let c = [r / (N - 1), g / (N - 1), b / (N - 1)];
    c = c.map(v => v + (sm(v) - v) * 0.38);                                   // S-curve (display space)
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    c = c.map(v => l + (v - l) * 1.25);                                        // saturation back
    const sh = Math.max(0, 1 - l * 2.2), hi = Math.max(0, l * 1.6 - 0.6);     // split tone
    c[0] += -0.010 * sh + 0.016 * hi; c[1] += 0.002 * sh + 0.006 * hi; c[2] += 0.016 * sh - 0.014 * hi;
    const i = ((b * N + g) * N + r) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(Math.min(1, Math.max(0, c[k])) * 255);
    d[i + 3] = 255;
  }
  // laid out as a 2D strip (N*N wide x N high: slice b at x offset b*N): the OutputPass is a GLSL ES 1.0
  // RawShaderMaterial, which has no sampler3D, so the blue axis is interpolated by hand (two taps)
  const s2 = new Uint8Array(N * N * N * 4);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) { const src = ((b * N + g) * N + r) * 4, dst = (g * N * N + b * N + r) * 4; for (let k = 0; k < 4; k++) s2[dst + k] = d[src + k]; }
  const t = new THREE.DataTexture(s2, N * N, N); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

// AgX renders mid-tones darker than Neutral: matched by eye against the Neutral look (tools/look_test.mjs film A/B)
export const AGX_EXPOSURE = 1.3;

export function patchOutputPass(pass) {
  const U = pass.uniforms;
  U.uExpK = { value: 1 }; U.tLut = { value: makeLut() }; U.uLutAmt = { value: 0 };
  let fs = pass.material.fragmentShader;
  fs = fs.replace('uniform sampler2D tDiffuse;', `uniform sampler2D tDiffuse; uniform float uExpK; uniform float uLutAmt; uniform sampler2D tLut;
vec3 lut3( vec3 c ) { float n = 32.0; float b = c.b * ( n - 1.0 ); float b0 = floor( b ); float b1 = min( b0 + 1.0, n - 1.0 ); vec2 uv = vec2( ( c.r * ( n - 1.0 ) + 0.5 ) / ( n * n ), ( c.g * ( n - 1.0 ) + 0.5 ) / n );
  return mix( texture2D( tLut, uv + vec2( b0 / n, 0.0 ) ).rgb, texture2D( tLut, uv + vec2( b1 / n, 0.0 ) ).rgb, b - b0 ); }`);
  fs = fs.replace('// tone mapping', 'gl_FragColor.rgb *= uExpK;\n// tone mapping');
  fs = fs.replace(/(#ifdef SRGB_TRANSFER\s*gl_FragColor = sRGBTransferOETF\( gl_FragColor \);\s*#endif)/,
    `$1\n if ( uLutAmt > 0.0 ) { gl_FragColor.rgb = mix( gl_FragColor.rgb, lut3( clamp( gl_FragColor.rgb, 0.0, 1.0 ) ), uLutAmt ); }`);
  pass.material.fragmentShader = fs; pass.material.needsUpdate = true;
  const ok = /uExpK;\n\/\/ tone/.test(fs) && /lut3\( clamp/.test(fs);
  return {
    ok,
    // mode: 'agx' (AgX + grade) | 'neutral' (the old look)
    set(renderer, mode) {
      if (mode === 'agx') { renderer.toneMapping = THREE.AgXToneMapping; U.uExpK.value = AGX_EXPOSURE; U.uLutAmt.value = 1; }
      else { renderer.toneMapping = THREE.NeutralToneMapping; U.uExpK.value = 1; U.uLutAmt.value = 0; }
    },
  };
}
