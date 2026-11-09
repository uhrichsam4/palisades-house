// Real branching trees + bushes for the site (replaces the old lumpy crown blobs).
// Geometry: seeded ez-tree variants baked offline (assets/trees/bake.mjs -> trees.glb, two detail levels each,
// height-normalised, per-vertex _WIND sway weight); far away they become camera-facing impostor cards whose
// texture is rendered here at load from the low-detail tree (so day/night/weather light them like the rest).
// Draws: per variant one InstancedMesh per detail level and part (bark, leaves) + one impostor = 5 x 6 variants,
// whatever the tree count. Which instance goes to which level is re-binned on the CPU (16 m spatial cells,
// widened-frustum test) only when the camera moved/turned enough — not per frame.
// Shadows: the static sun shadow map gets a fixed set of low-detail proxies for the trees around the house
// (layer 30 = drawn in the shadow pass only, see main.js), so the shadow never depends on where you stand.
// Wind: vertex shader sway from window.__sky.wind / windDir (gentle default breeze), leaves flutter on top.
// Snow cover / wetness come from the sky module's outdoor patch (kit.outdoor) like every outdoor material.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const KINDS = ['oak', 'sycamore', 'pine', 'olive', 'bushA', 'bushB'];
const BUSH = new Set(['bushA', 'bushB']);
// [LOD0 end, LOD1 end] metres; impostors beyond. View distance 'near' stops impostors at 260 m.
const DIST = { low: { tree: [10, 35], bush: [4, 12] }, medium: { tree: [16, 60], bush: [6, 18] }, high: { tree: [30, 110], bush: [12, 35] } };
export const windU = { uSnow: { value: 0 }, uTime: { value: 0 }, uWind: { value: 0.18 }, uWindDir: { value: new THREE.Vector2(0.8, 0.6) } };
const CELL = 16;

function windPatch(mat, leaves) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, windU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float wind; uniform float uTime; uniform float uWind; uniform vec2 uWindDir;')
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  { vec3 ip = instanceMatrix[3].xyz; float ih = length( instanceMatrix[1].xyz );
    float ph = dot( ip.xz, vec2( 0.11, 0.07 ) );
    float a = uWind * ( 0.6 + 0.4 * sin( uTime * 0.37 + ph * 0.5 ) );
    float sway = wind * ( a * 0.7 + ( 0.2 + a ) * ( 0.32 * sin( uTime * ( 1.0 + uWind ) + ph ) + 0.1 * sin( uTime * 2.3 + ph * 1.7 ) ) );
    vec2 pd = vec2( -uWindDir.y, uWindDir.x );
    mvPosition.xz += ( uWindDir * sway + pd * wind * ( 0.2 + a ) * 0.09 * sin( uTime * 1.7 + ph * 2.1 ) ) * ih * 0.05;
    mvPosition.y -= wind * a * a * ih * 0.015;
    ${leaves ? 'float fl = sin( uTime * ( 5.0 + 7.0 * a ) + dot( transformed, vec3( 37.0, 19.0, 29.0 ) ) + ph ); mvPosition.xyz += vec3( 0.6, 1.0, 0.5 ) * fl * wind * ( 0.12 + a ) * ih * 0.005;' : ''}
  }
#endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
    // leaf cards carry bent "crown" normals: never flip them on the back face
    if (leaves) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif');
    // snow settles on crowns more readily than the sky module's generic outdoor patch (leaf cards face every way)
    sh.fragmentShader = 'uniform float uSnow;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', `{ vec3 tn = inverseTransformDirection( normal, viewMatrix ); float ts = uSnow * smoothstep( ${leaves ? '-0.15, 0.55' : '0.2, 0.75'}, tn.y ) * ${leaves ? '0.8' : '0.9'};
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.93, 0.97 ), ts ); roughnessFactor = mix( roughnessFactor, 0.85, ts ); }
#include <lights_physical_fragment>`);
  };
  const pk = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (pk ? pk() : '') + (leaves ? '|treeLeaf' : '|treeBark');
  return mat;
}
function impostorPatch(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
  { vec3 tc = cameraPosition - instanceMatrix[3].xyz; transformedNormal = normalize( mat3( viewMatrix ) * normalize( vec3( tc.x, length( tc.xz ) * 0.7, tc.z ) ) ); }
#endif`)
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  { vec3 ic = instanceMatrix[3].xyz; vec3 tc = ic - cameraPosition; vec3 rt = normalize( vec3( -tc.z, 0.0, tc.x ) + 1e-5 );
    mvPosition = vec4( ic + rt * transformed.x * length( instanceMatrix[0].xyz ) + vec3( 0.0, transformed.y * length( instanceMatrix[1].xyz ), 0.0 ), 1.0 ); }
#endif
  mvPosition = viewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
    sh.uniforms.uSnow = windU.uSnow;
    sh.fragmentShader = 'uniform float uSnow;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', '{ float ts = uSnow * 0.55; diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.93, 0.97 ), ts ); }\n#include <lights_physical_fragment>');
  };
  const pk = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (pk ? pk() : '') + '|treeImp';
  return mat;
}

// items: [{x, y (ground), z, h (height m), w (crown width m), kind, color (hex leaf tint)}]
export async function createTrees(ctx, items, { haze = (m) => m, house = [11.7, 11.0], shadowR = 34 } = {}) {
  const { kit, renderer, scene, camera } = ctx;
  const O = (m) => kit.outdoor(m);
  const base = 'assets/trees/';
  const [gltf, barkMap, barkN, leafMap, meta] = await Promise.all([
    new GLTFLoader().loadAsync(base + 'trees.glb'),
    new THREE.TextureLoader().loadAsync(base + 'bark_color.jpg'), new THREE.TextureLoader().loadAsync(base + 'bark_normal.jpg'),
    new THREE.TextureLoader().loadAsync(base + 'leaves.png'), fetch(base + 'trees.json').then(r => r.json())]);
  barkMap.colorSpace = THREE.SRGBColorSpace; leafMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [barkMap, barkN]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  leafMap.anisotropy = 4;
  const geo = {}; gltf.scene.traverse(o => { if (o.isMesh) { const g = o.geometry; if (g.attributes._wind) { g.setAttribute('wind', g.attributes._wind); g.deleteAttribute('_wind'); } geo[o.name] = g; } });
  const barkMat = O(haze(windPatch(new THREE.MeshStandardMaterial({ map: barkMap, normalMap: barkN, normalScale: new THREE.Vector2(0.8, 0.8), color: 0xb8ad9e, roughness: 0.95 }), false)));
  const leafMat = O(haze(windPatch(new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.78, color: 0xffffff }), true)));
  barkMat.name = 'tree-bark'; leafMat.name = 'tree-leaves';

  // ---- impostor textures: the LOD1 tree, unlit albedo, rendered side-on into a small render target per variant
  const imp = {};
  {
    const sc = new THREE.Scene(); const bm = new THREE.MeshBasicMaterial({ map: barkMap, color: 0x8a8070 });
    const lm = new THREE.MeshBasicMaterial({ map: leafMap, alphaTest: 0.42, side: THREE.DoubleSide, color: 0xc8c8c8 });
    const prevRT = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    for (const k of KINDS) {
      const cr = meta[k].crownR * 1.04;
      const rt = new THREE.WebGLRenderTarget(192, Math.round(192 / (2 * cr)), { samples: 4 });
      rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      const cam = new THREE.OrthographicCamera(-cr, cr, 1.01, 0, -5, 5);
      const a = new THREE.Mesh(geo[k + '_0_bark'], bm), b = new THREE.Mesh(geo[k + '_0_leaves'], lm); sc.add(a, b);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x4a5a34, 0); renderer.clear(); renderer.render(sc, cam);
      sc.remove(a, b);
      const pg = new THREE.PlaneGeometry(2 * cr, 1.01); pg.translate(0, 0.505, 0);
      imp[k] = { rt, geo: pg };
    }
    renderer.setRenderTarget(prevRT); renderer.setClearColor(cc, ca);
  }

  // ---- instances, grouped by spatial cell
  const proxies = !ctx.shot && ctx.params?.get?.('nocull') !== '1'; // proxies need main.js's layer-30 shadow pass (culling on)
  const kinds = {}; for (const k of KINDS) kinds[k] = { list: [], bush: BUSH.has(k) };
  for (const it of items) if (kinds[it.kind]) kinds[it.kind].list.push(it);
  const o3 = new THREE.Object3D(), col = new THREE.Color();
  const cells = new Map();
  const sets = [];
  for (const k of KINDS) {
    const K = kinds[k], n = K.list.length; if (!n) continue;
    K.mats = new Float32Array(n * 16); K.cols = new Float32Array(n * 3); K.pos = new Float32Array(n * 3);
    const cr = meta[k].crownR;
    K.list.forEach((it, i) => {
      const sxz = Math.min(it.h * 1.7, Math.max(it.h * 0.55, (it.w / 2) / cr));
      o3.position.set(it.x, it.y, it.z); o3.rotation.set(0, it.ry ?? ((i * 2.399) % 6.283), 0); o3.scale.set(sxz, it.h, sxz); o3.updateMatrix();
      o3.matrix.toArray(K.mats, i * 16); col.setHex(it.color ?? 0xffffff).toArray(K.cols, i * 3); K.pos.set([it.x, it.y + it.h * 0.5, it.z], i * 3);
      const ck = Math.floor(it.x / CELL) + ',' + Math.floor(it.z / CELL);
      let c = cells.get(ck); if (!c) { c = { c: new THREE.Vector3(), n: 0, r: 0, by: {}, items: [] }; cells.set(ck, c); }
      (c.by[k] ||= []).push(i); c.items.push([it.x, it.y, it.z, it.h, sxz * cr]);
    });
    const mk = (g, m, cap, colorOn) => { const im = new THREE.InstancedMesh(g, m, cap); im.count = 0; im.frustumCulled = false; im.castShadow = !proxies; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (colorOn) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      im.userData.keep = true; im.userData.noCull = true; im.userData.noProbe = true; im.name = 'trees:' + k; return im; };
    const L = [];
    for (const lod of [0, 1]) { const leaves = mk(geo[`${k}_${lod}_leaves`], leafMat, n, true), bark = mk(geo[`${k}_${lod}_bark`], barkMat, n, false);
      bark.instanceMatrix = leaves.instanceMatrix; L.push([leaves, bark]); }
    const impMat = O(haze(impostorPatch(new THREE.MeshStandardMaterial({ map: imp[k].rt.texture, alphaTest: 0.38, roughness: 0.85 }))));
    const im = mk(imp[k].geo, impMat, n, true); im.receiveShadow = false; im.castShadow = false;
    K.lod = [L[0], L[1], [im]];
    sets.push(K);
    // fixed low-detail shadow casters around the house (walk mode: shadow pass only, via layer 30)
    if (proxies) {
      const near = []; K.list.forEach((it, i) => { if (Math.hypot(it.x - house[0], it.z - house[1]) < shadowR + it.h) near.push(i); });
      if (near.length) for (const part of ['leaves', 'bark']) {
        const sm = new THREE.InstancedMesh(geo[`${k}_1_${part}`], part === 'leaves' ? leafMat : barkMat, near.length);
        near.forEach((i, j) => sm.instanceMatrix.array.set(K.mats.subarray(i * 16, i * 16 + 16), j * 16));
        sm.computeBoundingSphere(); sm.castShadow = true; sm.receiveShadow = false; sm.layers.set(30); sm.userData.keep = true; sm.name = 'trees:shadow:' + k; ctx.root.add(sm);
      }
    }
    for (const [lv, arr] of K.lod.entries()) for (const m of arr) { m.userData.lod = lv; ctx.root.add(m); }
  }
  for (const c of cells.values()) { for (const [x, y, z] of c.items) c.c.add(new THREE.Vector3(x, y, z)); c.c.multiplyScalar(1 / c.items.length);
    for (const [x, y, z, h, w] of c.items) c.r = Math.max(c.r, Math.hypot(x - c.c.x, z - c.c.z) + w, Math.abs(y + h - c.c.y), Math.abs(y - c.c.y)); c.sphere = new THREE.Sphere(c.c, c.r); }
  const cellList = [...cells.values()];

  // ---- LOD re-binning
  let detail = 'medium', far = true, forced = true;
  const lastPos = new THREE.Vector3(1e9, 0, 0), lastDir = new THREE.Vector3(), dir = new THREE.Vector3(); let lastFov = 0, lastAspect = 0;
  const wide = new THREE.PerspectiveCamera(); const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  const stats = { rebins: 0, lastMs: 0, counts: {} };
  function rebin(cam) {
    const t0 = performance.now();
    wide.fov = Math.min(170, cam.fov + 34); wide.aspect = cam.aspect; wide.near = 0.1; wide.far = 5000; wide.updateProjectionMatrix();
    pm.multiplyMatrices(wide.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const maxD = far ? 1e9 : 260;
    for (const K of sets) { K.n = [0, 0, 0]; const D = DIST[detail][K.bush ? 'bush' : 'tree']; K.d0 = D[0] * D[0]; K.d1 = D[1] * D[1]; }
    for (const c of cellList) {
      const dc = c.c.distanceTo(cam.position);
      if (dc > c.r + 12 && !frustum.intersectsSphere(c.sphere)) continue;
      if (dc - c.r > maxD) continue;
      for (const k in c.by) {
        const K = kinds[k], idx = c.by[k], P = K.pos;
        for (let j = 0; j < idx.length; j++) {
          const i = idx[j], dx = P[i * 3] - cx, dy = P[i * 3 + 1] - cy, dz = P[i * 3 + 2] - cz, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > maxD * maxD) continue;
          const lv = d2 < K.d0 ? 0 : d2 < K.d1 ? 1 : 2; const m = K.lod[lv][0], at = K.n[lv]++;
          m.instanceMatrix.array.set(K.mats.subarray(i * 16, i * 16 + 16), at * 16);
          m.instanceColor.array.set(K.cols.subarray(i * 3, i * 3 + 3), at * 3);
        }
      }
    }
    for (const K of sets) for (let lv = 0; lv < 3; lv++) { const n = K.n[lv];
      for (const m of K.lod[lv]) { m.count = n; }
      const m = K.lod[lv][0]; m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, Math.max(16, n * 16)); m.instanceMatrix.needsUpdate = true;
      m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, Math.max(3, n * 3)); m.instanceColor.needsUpdate = true;
      stats.counts[K.list[0].kind] = K.n.slice(); }
    stats.rebins++; stats.lastMs = +(performance.now() - t0).toFixed(3);
  }
  function maybeRebin(cam) {
    cam.getWorldDirection(dir);
    if (!forced && cam.position.distanceToSquared(lastPos) < 0.6 && dir.dot(lastDir) > 0.985 && cam.fov === lastFov && cam.aspect === lastAspect) return;
    forced = false; lastPos.copy(cam.position); lastDir.copy(dir); lastFov = cam.fov; lastAspect = cam.aspect;
    cam.updateMatrixWorld(); rebin(cam);
  }
  // before every main-camera render (not cube/probe/mirror cameras): projection lists are built after this hook
  const prevSBR = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, ...rest) { prevSBR?.call(this, r, s, cam, ...rest); if (cam === camera || cam.userData.treeLOD) maybeRebin(cam); };

  const api = {
    stats, get count() { return items.length; }, kinds: Object.fromEntries(sets.map(K => [K.list[0].kind, K.list.length])),
    setDetail(d, viewFar = far) { if (DIST[d]) detail = d; far = viewFar !== false && viewFar !== 'near'; forced = true; },
    get detail() { return detail; }, get far() { return far; }, refresh() { forced = true; },
    update(dt, t) { const sk = window.__sky; windU.uTime.value = t; windU.uSnow.value = sk && Number.isFinite(sk.snowCover) ? sk.snowCover : 0; const w = sk && Number.isFinite(sk.wind) ? sk.wind : 0.18; windU.uWind.value += (w - windU.uWind.value) * Math.min(1, dt * 1.5);
      if (sk?.windDir) windU.uWindDir.value.lerp(sk.windDir, Math.min(1, dt * 0.5)).normalize(); },
  };
  return api;
}
