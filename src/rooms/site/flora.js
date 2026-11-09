// Procedural vegetation for the site: chaparral shrubs, oaks, palms, hedges (instanced lumpy blobs).
import * as THREE from 'three';

// Lumpy foliage blob: a few displaced icosahedra merged, smooth normals, base at y=0, radius ~1.
// Vertex colour darkens towards the bottom (cheap self-shadowing).
export function blobGeo(kit, seed, lobes = 4, detail = 1, flat = 1) {
  const r = kit.rng(seed); const geos = [];
  for (let k = 0; k < lobes; k++) {
    let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = kit.mergeVertices(g);
    const s = k === 0 ? 1 : 0.5 + 0.35 * r(); const off = k === 0 ? [0, 0, 0] : [(r() - 0.5) * 1.2, (r() - 0.35) * 0.6, (r() - 0.5) * 1.2];
    const p = g.attributes.position, v = new THREE.Vector3(), ph = r() * 10;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.17 * Math.sin(v.x * 4.1 + ph) * Math.sin(v.y * 3.7 + 1.3 * ph) * Math.sin(v.z * 4.4 - ph) + 0.08 * Math.sin(v.x * 9.3 + v.z * 7.1 + ph);
      v.multiplyScalar(s * n); v.x += off[0]; v.y = v.y * flat + off[1]; v.z += off[2]; p.setXYZ(i, v.x, v.y, v.z);
    }
    geos.push(g);
  }
  const g = kit.mergeGeometries(geos); g.computeBoundingBox();
  const bb = g.boundingBox; const sc = 2 / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y - 0.12 * (bb.max.y - bb.min.y), -(bb.min.z + bb.max.z) / 2); g.scale(sc, sc, sc);
  g.computeVertexNormals(); g.computeBoundingBox();
  const p = g.attributes.position, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, (p.getY(i) - y0) / (y1 - y0)); const a = 0.45 + 0.55 * Math.pow(t, 0.7);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a;
    const nx = Math.abs(g.attributes.normal.getX(i)), ny = Math.abs(g.attributes.normal.getY(i)), nz = Math.abs(g.attributes.normal.getZ(i));
    const [u, w] = ny > nx && ny > nz ? [p.getX(i), p.getZ(i)] : nx > nz ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * 1.4; uv[i * 2 + 1] = w * 1.4;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function foliageMaterial(kit) {
  // No UV texture (it stretched on the blobs): leaf clumps come from world-space 3D noise (constant leaf
  // size whatever the bush scale), darkening gaps and jittering the normal so each bush reads as foliage.
  const mat = kit.outdoor(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, specularIntensity: 0.08 }));
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLeafP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vec4 lp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  #endif
  vLeafP = ( modelMatrix * lp ).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLeafP;
float lh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float ln(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lh(i), lh(i + vec3(1, 0, 0)), f.x), mix(lh(i + vec3(0, 1, 0)), lh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(lh(i + vec3(0, 0, 1)), lh(i + vec3(1, 0, 1)), f.x), mix(lh(i + vec3(0, 1, 1)), lh(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `float lf = ln(vLeafP * 3.5) * 0.45 + ln(vLeafP * 8.0) * 0.35 + ln(vLeafP * 17.0) * 0.2; float clump = ln(vLeafP * 1.1);
  diffuseColor.rgb *= (0.45 + 0.85 * lf * lf) * (0.8 + 0.35 * clump);
  { float big = ln(vLeafP * 0.0061 + 3.7) * 0.65 + ln(vLeafP * 0.019) * 0.35; float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.18, 1.0, 0.68) * lum, smoothstep(0.58, 0.78, big) * 0.55);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 1.02, 0.86) * lum, smoothstep(0.42, 0.22, big) * 0.4); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec3 q = vLeafP * 6.0; normal = normalize(normal + 1.7 * vec3(ln(q) - 0.5, ln(q + 17.3) - 0.5, ln(q + 31.7) - 0.5)); }`);
  };
  mat.customProgramCacheKey = () => 'site-foliage-v2';
  return mat;
}

// Instanced vegetation from a list of {x,y,z,s:[sx,sy,sz],ry,color}. Big lists are split into spatial tiles so
// frustum culling works (one giant InstancedMesh spanning the canyon was drawn whole every frame), and tiles
// can carry a low-poly `lod` geometry used beyond `lodDist` metres from the camera (updateFloraLOD).
const LOD_TILES = [];
function oneMesh(geo, mat, list, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length;
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.set(...it.s); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.setHex(it.color));
  });
  m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere(); m.frustumCulled = list.length > 0;
  return m;
}
export function instances(geo, mat, list, { shadow = false, lod = null, lodDist = 45, tile = 0 } = {}) {
  if (list.length < 150 && !lod) return oneMesh(geo, mat, list, shadow);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const it of list) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); }
  const cell = tile || Math.max(12, Math.max(x1 - x0, z1 - z0) / 6);
  const cells = new Map();
  for (const it of list) { const k = Math.floor((it.x - x0) / cell) + ',' + Math.floor((it.z - z0) / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
  const g = new THREE.Group(); g.name = 'flora';
  for (const items of cells.values()) {
    const hi = oneMesh(geo, mat, items, shadow); g.add(hi);
    if (lod) { const lo = oneMesh(lod, mat, items, shadow); lo.visible = false; g.add(lo); const c = hi.boundingSphere.center.clone();
      LOD_TILES.push({ hi, lo, c, r: hi.boundingSphere.radius, d: lodDist }); }
  }
  return g;
}
// swap tiles between full and low-poly by distance from the camera (call every frame; cheap)
export function updateFloraLOD(cam) {
  for (const t of LOD_TILES) { const far = cam.distanceTo(t.c) - t.r > t.d; if (t.hi.visible === far) { t.hi.visible = !far; t.lo.visible = far; } }
}

// Canary/queen palm: curved ringed trunk + drooping fronds.
export function palm(kit, parent, mats, pos, h = 8, seed = 1) {
  const r = kit.rng(seed); const g = kit.group(parent, pos, r() * 6);
  const lean = 0.35 + r() * 0.3;
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lean * t * t, h * t, 0]); }
  kit.add(g, kit.tube(pts, 0.17, 24), mats.palmTrunk);
  const top = [lean, h, 0];
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2 * 1.618 * 3 + r() * 0.3, len = 2.6 + r() * 1.0, droop = 0.3 + r() * 1.3;
    const geo = new THREE.BufferGeometry(); const pos3 = [], idx = []; const N = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N; const along = len * t; const y = top[1] + 0.6 * t - droop * t * t * 1.6;
      const cx = top[0] + Math.cos(a) * along, cz = top[2] + Math.sin(a) * along;
      const wdt = (0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.04) * (i % 2 ? 0.55 : 1); // ragged leaflet edge
      const px = -Math.sin(a) * wdt, pz = Math.cos(a) * wdt;
      pos3.push(cx - px, y - 0.12 * wdt, cz - pz, cx, y + 0.05, cz, cx + px, y - 0.12 * wdt, cz + pz);
      if (i < N) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    kit.add(g, geo, mats.palmFrond);
  }
  return g;
}

// CC0 garden plants (Poly Haven shrub_02 = 4 sapling-bush variants, grass_medium_02 = 5 grass clumps): geometries
// normalised to 1 m tall, base at y=0, centred; one alpha-tested material per model, desaturated toward the silvery
// sage of the listing's olives / westringia (tint = instance colour). Loaded once, shared by the site + pool pieces.
let PLANTS = null;
export function cc0Plants(kit) {
  if (PLANTS) return PLANTS;
  const one = async (id, sat) => {
    const obj = await kit.loadModel(`assets/ph/${id}/${id}_1k.gltf`);
    const geos = []; let src = null; const m4 = new THREE.Matrix4();
    obj.traverse((o) => { if (!o.isMesh) return;
      const g = o.geometry.clone(); m4.compose(new THREE.Vector3(), o.quaternion, o.scale); g.applyMatrix4(m4);
      g.computeBoundingBox(); const b = g.boundingBox, h = b.max.y - b.min.y;
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(1 / h, 1 / h, 1 / h); g.computeBoundingSphere();
      geos.push(g); src = src || o.material; });
    const mat = src.clone(); mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true; mat.side = THREE.DoubleSide; mat.color.set(0xffffff);
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `{ vec3 tcol = vec3( 1.0 );
#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  tcol = vColor.rgb;
#endif
  float l = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ); diffuseColor.rgb = mix( vec3( l ), diffuseColor.rgb, ${sat.toFixed(2)} ) * tcol * 2.7; }`);
    };
    mat.customProgramCacheKey = () => 'cc0plant-' + id;
    return { geos, mat: kit.outdoor(mat) };
  };
  PLANTS = Promise.all([one('shrub_02', 0.35), one('grass_medium_02', 0.5)]).then(([shrub, grass]) => ({ shrub, grass }));
  return PLANTS;
}
// list of {x,y,z,h,w,ry,color,v (variant)} -> one InstancedMesh per variant under `parent`
export function plantInstances(parent, model, list, { shadow = true } = {}) {
  const by = model.geos.map(() => []); for (const it of list) by[it.v % model.geos.length].push(it);
  const o = new THREE.Object3D(), c = new THREE.Color(), out = [];
  by.forEach((items, v) => { if (!items.length) return;
    const m = new THREE.InstancedMesh(model.geos[v], model.mat, items.length);
    items.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.ry, 0); o.scale.set(it.w, it.h, it.w); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.setHex(it.color)); });
    m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere(); m.userData.keep = true; m.name = 'cc0plants'; parent.add(m); out.push(m); });
  return out;
}
