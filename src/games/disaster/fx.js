// Natural Disasters — pooled visuals. Nothing here exists until the first round starts (createDisasterFx is called
// lazily by index.js) and everything is hidden / skipped while no round runs.
//   particles: two THREE.Points pools (fire = additive, smoke = normal blend), CPU sim, compacted each frame
//   flood: one 160 m water plane, waves + foam in the shader (onBeforeCompile on a MeshStandardMaterial)
//   meteors: 8 pooled rocks (emissive cracks), craters: 16 pooled decals, lightning: one rebuilt tube
import * as THREE from 'three';

const FIRE_MAX = 1000, SMOKE_MAX = 900; /* polish5: 700 -> 1000 (whole-house fires split the pool across ~30 rooms) */

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// polish5: flame sprite (narrow licking tongue, hot core low) instead of the soft round blob for the additive pool
function flameTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = y / 63, u = (x - 31.5) / 31.5; const w = 0.12 + 0.5 * Math.pow(v, 0.8) * (1 - Math.pow(Math.max(0, v - 0.75) / 0.25, 2));
    const lick = Math.max(0, 1 - Math.abs(u + 0.12 * Math.sin(v * 7.5)) / Math.max(0.05, w)); const a = Math.pow(lick, 1.6) * Math.min(1, v * 1.6) * Math.min(1, (1 - v) * 6);
    const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makePool(scene, max, additive, name) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: additive ? flameTex() : softTex() }, scale: { value: 600 } },
    /* polish5: particles right at the camera fade out (a 512 px blob per flame / smoke puff stacked into a full-screen
       cream white-out when you stood in the burning room) and flames are capped at 160 px */
    vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float scale; varying vec4 vC;
      void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); float d = -mv.z; vC.a *= smoothstep(${additive ? '0.6, 2.2' : '0.3, 1.6'}, d);
        gl_PointSize = min(${additive ? '160.0' : '384.0'}, aSize * scale / max(0.3, d)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vC;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vC.a; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = name; pts.renderOrder = additive ? 7 : 6;
  pts.userData.keep = true; pts.userData.noProbe = true; pts.userData.noCull = true; pts.visible = false; scene.add(pts);
  // sim state
  // b (contain pass): optional box [x0, y0, z0, x1, y1, z1] the particle stays in (a burning room: smoke pools under its
  // ceiling and against its walls instead of drifting through them)
  const S = { p: new Float32Array(max * 3), v: new Float32Array(max * 3), life: new Float32Array(max), max: new Float32Array(max), s0: new Float32Array(max), s1: new Float32Array(max), k: new Uint8Array(max), b: new Array(max).fill(null), n: 0 };
  function emit(x, y, z, vx, vy, vz, life, s0, s1, kind, b = null) {
    if (S.n >= max) return; const i = S.n++; const j = i * 3; S.b[i] = b;
    S.p[j] = x; S.p[j + 1] = y; S.p[j + 2] = z; S.v[j] = vx; S.v[j + 1] = vy; S.v[j + 2] = vz;
    S.life[i] = 0; S.max[i] = life; S.s0[i] = s0; S.s1[i] = s1; S.k[i] = kind;
  }
  function update(dt, wind) {
    let w = 0; const n = S.n;
    for (let i = 0; i < n; i++) {
      const L = S.life[i] + dt; if (L >= S.max[i]) continue;
      const j = i * 3, o = w * 3; const k = S.k[i];
      let vx = S.v[j], vy = S.v[j + 1], vz = S.v[j + 2];
      if (additive) { vy += dt * (k === 2 ? 0.6 : 2.2); vx *= 1 - dt * 1.5; vz *= 1 - dt * 1.5; if (k === 2) { vx += (Math.random() - 0.5) * dt * 6; vz += (Math.random() - 0.5) * dt * 6; } } // flames: buoyant, damped; embers (k 2) drift
      else if (k === 2) { vy -= dt * 6; } // dust/debris puffs fall a bit
      else { vy += dt * 0.25; vx += wind[0] * dt * 0.6; vz += wind[1] * dt * 0.6; vx *= 1 - dt * 0.4; vz *= 1 - dt * 0.4; vy *= 1 - dt * 0.3; }
      let x = S.p[j] + vx * dt, y = S.p[j + 1] + vy * dt, z = S.p[j + 2] + vz * dt;
      const b = S.b[i]; if (b) {
        if (x < b[0]) { x = b[0]; vx = 0; } else if (x > b[3]) { x = b[3]; vx = 0; }
        if (y < b[1]) { y = b[1]; vy = 0; } else if (y > b[4]) { y = b[4]; vy = 0; vx *= 1 + dt; vz *= 1 + dt; } // spreads along the ceiling
        if (z < b[2]) { z = b[2]; vz = 0; } else if (z > b[5]) { z = b[5]; vz = 0; }
      }
      // compact into slot w
      S.p[o] = x; S.p[o + 1] = y; S.p[o + 2] = z; S.v[o] = vx; S.v[o + 1] = vy; S.v[o + 2] = vz;
      S.life[w] = L; S.max[w] = S.max[i]; S.s0[w] = S.s0[i]; S.s1[w] = S.s1[i]; S.k[w] = k; S.b[w] = b;
      const f = L / S.max[i];
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      size[w] = S.s0[i] + (S.s1[i] - S.s0[i]) * f;
      const c = w * 4;
      if (k === 2 && additive) { // polish5: embers: small hot orange sparks that flicker as they rise
        col[c] = 1.0; col[c + 1] = 0.42 - f * 0.25; col[c + 2] = 0.06; col[c + 3] = 0.9 * (1 - f) * (0.6 + 0.4 * Math.random());
      } else if (additive) { // polish5: saturated yellow core -> orange -> deep red (was a near-white core that stacked to cream)
        col[c] = 1.0 - f * 0.35; col[c + 1] = Math.max(0.08, 0.62 - f * 0.75); col[c + 2] = Math.max(0, 0.16 - f * 0.5); col[c + 3] = (k === 1 ? 0.85 : 0.55) * Math.min(1, L * 12) * (1 - f) ** 1.3;
      } else if (k === 1) { // thick black fire smoke (polish5: sootier brown-black, per-puff alpha .38 so stacks stay translucent)
        const g = 0.045 + f * 0.07; col[c] = g * 1.08; col[c + 1] = g; col[c + 2] = g * 0.9; col[c + 3] = 0.38 * Math.min(1, L * 3) * (1 - f);
      } else if (k === 3) { // snow / blizzard spindrift (white)
        col[c] = 0.92; col[c + 1] = 0.95; col[c + 2] = 1.0; col[c + 3] = 0.35 * Math.min(1, L * 4) * (1 - f);
      } else { // grey smoke / dust
        const g = 0.32 + f * 0.18; col[c] = g * 1.02; col[c + 1] = g; col[c + 2] = g * 0.95; col[c + 3] = 0.42 * Math.min(1, L * 4) * (1 - f) ** 1.2;
      }
      w++;
    }
    S.n = w; geo.setDrawRange(0, w); pts.visible = w > 0;
    if (w) { geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; }
  }
  return { emit, update, clear() { S.n = 0; geo.setDrawRange(0, 0); pts.visible = false; }, get n() { return S.n; }, get free() { return max - S.n; }, pts };
}

function floodPlane(scene) {
  const geo = new THREE.PlaneGeometry(160, 160, 160, 160); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a48, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.86, envMapIntensity: 1.2 });
  const U = { uTime: { value: 0 }, uAmp: { value: 0.18 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; varying float vCrest; varying vec2 vWp;
        float wv(vec2 p, vec2 d, float k, float s){ return sin(dot(p, d) * k + uTime * s); }
        float H(vec2 p){ return uAmp * (0.55 * wv(p, vec2(0.8,0.6), 0.55, 1.3) + 0.3 * wv(p, vec2(-0.4,0.9), 1.1, 1.9) + 0.15 * wv(p, vec2(0.95,-0.3), 2.3, 2.7)); }`)
      .replace('#include <beginnormal_vertex>', `vec2 wp0 = (modelMatrix * vec4(position,1.0)).xz; float e = 0.25;
        float hx = H(wp0 + vec2(e,0.0)) - H(wp0 - vec2(e,0.0)); float hz = H(wp0 + vec2(0.0,e)) - H(wp0 - vec2(0.0,e));
        vec3 objectNormal = normalize(vec3(-hx / (2.0*e), 1.0, -hz / (2.0*e)));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); float hh = H(wp0); transformed.y += hh; vCrest = hh / max(0.001, uAmp); vWp = wp0;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying float vCrest; varying vec2 vWp;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = vn(vWp * 1.7 + vec2(uTime * 0.35, uTime * 0.2)) * 0.6 + vn(vWp * 5.0 - uTime * 0.5) * 0.4;
        float foam = smoothstep(0.55, 0.95, vCrest * 0.6 + n * 0.7) * 0.75;
        float streak = smoothstep(0.78, 0.92, vn(vec2(vWp.x * 0.35 + uTime * 0.25, vWp.y * 3.0))) * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.80), clamp(foam + streak, 0.0, 0.85));
        diffuseColor.a = mix(diffuseColor.a, 0.97, foam);`);
  };
  const m = new THREE.Mesh(geo, mat); m.name = 'disaster:flood'; m.position.set(11, -2, 11); m.visible = false; m.renderOrder = 4;
  m.userData.keep = true; m.userData.noProbe = true; m.userData.noCull = true; m.receiveShadow = true; m.frustumCulled = false;
  scene.add(m);
  return { mesh: m, U };
}

function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 4.1 + seed) * Math.cos(v.y * 3.7 - seed) * Math.sin(v.z * 5.3 + seed * 2); v.multiplyScalar(0.82 + 0.22 * n + 0.08 * Math.sin(seed + i)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function craterTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(8,6,5,.98)'); r.addColorStop(0.35, 'rgba(22,16,12,.92)'); r.addColorStop(0.55, 'rgba(40,30,22,.75)'); r.addColorStop(0.75, 'rgba(55,45,35,.35)'); r.addColorStop(1, 'rgba(60,50,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const a = Math.random() * 6.283, d = 60 + Math.random() * 60, s = 2 + Math.random() * 6; g.fillStyle = `rgba(20,15,10,${0.3 + Math.random() * 0.5})`; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, s, 0, 6.283); g.fill(); }
  // glowing embers in the middle
  for (let i = 0; i < 30; i++) { const a = Math.random() * 6.283, d = Math.random() * 40; g.fillStyle = `rgba(255,${80 + Math.random() * 90 | 0},20,${0.3 + Math.random() * 0.5})`; g.fillRect(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createDisasterFx(scene) {
  const fire = makePool(scene, FIRE_MAX, true, 'disaster:fire');
  const smoke = makePool(scene, SMOKE_MAX, false, 'disaster:smoke');
  const flood = floodPlane(scene);
  // meteors
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.95, emissive: 0xff5a14, emissiveIntensity: 1.6 });
  const rocks = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(rockGeo(i * 1.7 + 0.3), rockMat); m.visible = false; m.castShadow = false; m.userData.keep = true; m.userData.noProbe = true; m.name = 'disaster:meteor'; scene.add(m); rocks.push(m); }
  const glowMat = new THREE.SpriteMaterial({ map: softTex(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = rocks.map(() => { const s = new THREE.Sprite(glowMat); s.visible = false; s.scale.setScalar(5); s.userData.keep = true; s.renderOrder = 8; scene.add(s); return s; });
  // craters
  const cTex = craterTex(); const cMat = new THREE.MeshBasicMaterial({ map: cTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const cGeo = new THREE.CircleGeometry(1, 32); cGeo.rotateX(-Math.PI / 2);
  const craters = []; let cNext = 0;
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(cGeo, cMat); m.visible = false; m.userData.keep = true; m.userData.noProbe = true; m.renderOrder = 3; m.name = 'disaster:crater'; scene.add(m); craters.push(m); }
  // lightning
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 4.0), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltMat); bolt.visible = false; bolt.frustumCulled = false; bolt.userData.keep = true; bolt.renderOrder = 9; scene.add(bolt);
  let boltT = 0;

  const all = [fire.pts, smoke.pts, flood.mesh, bolt, ...rocks, ...glows, ...craters];
  return {
    fire, smoke, flood, rocks, glows,
    crater(x, y, z, r) { const m = craters[cNext++ % craters.length]; m.position.set(x, y + 0.04, z); m.scale.setScalar(r); m.rotation.y = Math.random() * 6.28; m.visible = true; },
    lightning(x, y, z, rng = Math.random) {
      const pts = []; let px = x + (rng() - 0.5) * 14, pz = z + (rng() - 0.5) * 14; const top = 90;
      for (let i = 0; i <= 22; i++) { const f = i / 22; const yy = top + (y - top) * f; pts.push(new THREE.Vector3(px + (x - px) * f + (rng() - 0.5) * 3.2 * (1 - f * 0.8), yy, pz + (z - pz) * f + (rng() - 0.5) * 3.2 * (1 - f * 0.8))); }
      pts[pts.length - 1].set(x, y, z);
      bolt.geometry.dispose(); bolt.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 66, 0.09, 4, false);
      bolt.visible = true; boltT = 0.22; boltMat.opacity = 1;
    },
    update(dt, wind) {
      fire.update(dt, wind); smoke.update(dt, wind);
      if (boltT > 0) { boltT -= dt; boltMat.opacity = Math.max(0, boltT / 0.22) * (0.6 + 0.4 * Math.random()); if (boltT <= 0) bolt.visible = false; }
    },
    reset() { fire.clear(); smoke.clear(); flood.mesh.visible = false; bolt.visible = false; for (const r of rocks) r.visible = false; for (const g of glows) g.visible = false; for (const c of craters) c.visible = false; },
    get live() { return fire.n + smoke.n; },
    objects: all,
  };
}
