// Car visuals. Every car is reduced to a handful of material buckets so it costs few draw calls:
//   paint (per car, clearcoat) · head lights (per car) · tail lights (per car) · glass · metal · dark · plate (shared)
// metal / dark / lights carry per-vertex colours (chrome vs rim vs disc, rubber vs interior, amber vs white lamps).
// Three representations per car:
//   parked.hi  = body + wheels merged by bucket (≤7 draws)          parked.lo = same from the _lod1 model (far)
//   live       = body merged by bucket + 4 wheel pivots (steer → spin → 2 meshes) for a car that moves
// Model frame after loading: forward −z, left −x, ground at y=0, origin at the wheelbase centre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VC = new Set(['metal', 'dark', 'head', 'tail']);
const BUCKET = {
  paint_body: 'paint', glass: 'glass', chrome: 'metal', rim_alloy: 'metal', brake_disc: 'metal',
  plastic_black: 'dark', interior: 'dark', rubber: 'dark', caliper: 'dark',
  light_head: 'head', light_reverse: 'head', light_indicator: 'head', light_tail: 'tail', light_brake: 'tail', plate: 'plate',
};
const LAMP = { light_head: 0xf4f2ea, light_reverse: 0xdedede, light_indicator: 0xff8a1a, light_tail: 0xc4140e, light_brake: 0xb0100c };

// ---------------------------------------------------------------- shared materials
let SHARED = null;
const PLATES = ['PALI 1', 'CANYON', 'YATASTO', 'SUNSET8'];
function plateAtlas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const y0 = i * 128; g.fillStyle = '#f3f2ee'; g.fillRect(0, y0, 512, 128);
    g.strokeStyle = '#1b2a55'; g.lineWidth = 6; g.strokeRect(6, y0 + 6, 500, 116);
    g.fillStyle = '#b3261e'; g.font = 'italic 600 22px Georgia, serif'; g.textAlign = 'center'; g.fillText('Pacific Palisades', 256, y0 + 32);
    g.fillStyle = '#1b2a55'; g.font = 'bold 64px "Arial Narrow", Arial, sans-serif'; g.fillText(PLATES[i], 256, y0 + 104);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false; return t;
}
function lampMat(name) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.12, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'); };
  m.customProgramCacheKey = () => 'carlamp'; m.name = 'car-' + name; return m;
}
/* polish4: glass .04 -> .1, chrome .22 -> .3, clearcoat .04 -> .12 — the near-mirror lobes turned the midday sun into
   a bloom flare on the SUV roof / rear glass */
export function sharedMaterials(ctx) {
  if (SHARED) return SHARED;
  const out = (m) => (ctx.kit.outdoor ? ctx.kit.outdoor(m) : m);
  SHARED = {
    glass: out(new THREE.MeshPhysicalMaterial({ color: 0x0b0e12, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 1.4, name: 'car-glass' })),
    metal: out(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 0.3, name: 'car-metal' })),
    dark: out(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0, roughness: 0.72, name: 'car-dark' })),
    plate: new THREE.MeshStandardMaterial({ map: plateAtlas(), roughness: 0.45, name: 'car-plate' }),
  };
  return SHARED;
}
export function carMaterials(ctx, paint) {
  const S = sharedMaterials(ctx);
  const out = (m) => (ctx.kit.outdoor ? ctx.kit.outdoor(m) : m);
  const p = paint.metal
    ? new THREE.MeshStandardMaterial({ color: paint.color, metalness: 1, roughness: paint.rough ?? 0.36, name: 'car-paint' })
    : new THREE.MeshPhysicalMaterial({ color: paint.color, metalness: paint.metalness ?? 0.5, roughness: paint.rough ?? 0.3, clearcoat: 1, clearcoatRoughness: 0.12, name: 'car-paint' });
  return { ...S, paint: out(p), head: lampMat('head'), tail: lampMat('tail') };
}

// ---------------------------------------------------------------- geometry helpers
function prep(g, bucket, colorHex) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'uv' && bucket === 'plate')) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (bucket === 'plate' && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (VC.has(bucket)) {
    const c = new THREE.Color(colorHex ?? 0xffffff); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  if (!g.index) { const n = g.attributes.position.count; const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  g.clearGroups(); g.morphAttributes = {};
  return g;
}
const push = (map, k, g) => { (map[k] ||= []).push(g); };
function mergeMap(map) { const o = {}; for (const [k, list] of Object.entries(map)) { const m = mergeGeometries(list, false); if (m) { m.computeBoundingSphere(); o[k] = m; } } return o; }

// glTF (MiamiGame land vehicles): body + wheel_FL/FR/RL/RR nodes
async function fromGLB(ctx, url) {
  const root = await ctx.kit.loadModel(url, { shadows: false });
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1); root.updateMatrixWorld(true);
  const body = {}, wheels = {};
  root.traverse(o => {
    if (!o.isMesh) return;
    let n = o, key = null, node = null; while (n) { const m = /wheel_(FL|FR|RL|RR)/.exec(n.name || ''); if (m) { key = m[1]; node = n; break; } n = n.parent; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nm = (mats[0]?.name || '').replace(/\.\d+$/, ''); const bucket = BUCKET[nm] || 'dark';
    const col = LAMP[nm] ?? (bucket === 'metal' || bucket === 'dark' ? mats[0].color.getHex() : undefined);
    const g = prep(o.geometry.clone().applyMatrix4(o.matrixWorld), bucket, col);
    if (key) { const w = (wheels[key] ||= { key, hub: new THREE.Vector3().setFromMatrixPosition(node.matrixWorld), map: {} }); push(w.map, bucket, g); }
    else push(body, bucket, g);
  });
  return { body, wheels: Object.values(wheels) };
}

// procedural angular electric pickup (stainless wedge, glass greenhouse, light bar)
function shapeGeo(pts, width, bevel = 0.012) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  g.rotateY(Math.PI / 2); g.translate(-(width - 2 * bevel) / 2, 0, 0); return g;
}
const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function truckParts() {
  const body = {}, R = 0.43, WB = 1.86;
  const lower = [[-2.85, 0.5], [-2.85, 1.0], [-2.12, 1.2], [2.85, 1.2], [2.85, 0.5],
    [2.38, 0.5], [2.22, 0.98], [1.5, 0.98], [1.34, 0.5], [-1.34, 0.5], [-1.5, 0.98], [-2.22, 0.98], [-2.38, 0.5]];
  push(body, 'paint', prep(shapeGeo(lower, 2.02), 'paint'));
  push(body, 'paint', prep(shapeGeo([[0.9, 1.19], [0.9, 1.70], [2.85, 1.25], [2.85, 1.19]], 1.86), 'paint')); // sail / tonneau
  push(body, 'glass', prep(shapeGeo([[-2.12, 1.19], [0.25, 1.85], [0.9, 1.70], [0.9, 1.19]], 1.86, 0.006), 'glass'));
  // roof spine + pillars (stainless), door seams + rocker cladding (dark)
  push(body, 'paint', prep(boxG(1.88, 0.03, 0.10, 0, 1.845, 0.25), 'paint'));
  for (const s of [-1, 1]) {
    push(body, 'paint', prep(boxG(0.03, 0.62, 0.09, s * 0.925, 1.47, -0.34).rotateX(0), 'paint'));
    for (const z of [-1.3, -0.34, 0.9]) push(body, 'dark', prep(boxG(0.012, 0.56, 0.012, s * 1.012, 0.92, z), 'dark', 0x15171a));
    push(body, 'dark', prep(boxG(0.04, 0.16, 2.6, s * 1.0, 0.56, 0), 'dark', 0x1c1d1f));
    for (const z0 of [-WB, WB]) { // arch flares
      push(body, 'dark', prep(boxG(0.06, 0.06, 1.0, s * 1.0, 1.0, z0), 'dark', 0x1c1d1f));
      for (const dz of [-0.47, 0.47]) push(body, 'dark', prep(boxG(0.06, 0.5, 0.07, s * 1.0, 0.74, z0 + dz).rotateX(dz < 0 ? -0.3 : 0.3), 'dark', 0x1c1d1f));
    }
  }
  push(body, 'dark', prep(boxG(2.0, 0.16, 0.06, 0, 0.56, -2.86), 'dark', 0x1c1d1f));
  push(body, 'dark', prep(boxG(2.0, 0.16, 0.06, 0, 0.56, 2.86), 'dark', 0x1c1d1f));
  push(body, 'dark', prep(boxG(1.7, 0.9, 1.9, 0, 0.75, -0.2), 'dark', 0x101010)); // cabin tub (seen through the glass)
  push(body, 'head', prep(boxG(1.94, 0.035, 0.02, 0, 0.985, -2.862), 'head', 0xf4f2ea));
  push(body, 'tail', prep(boxG(1.94, 0.05, 0.02, 0, 1.17, 2.862), 'tail', 0xc4140e));
  const pl = new THREE.PlaneGeometry(0.52, 0.13).translate(0, 0.78, 2.875); pl.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  push(body, 'plate', prep(pl, 'plate'));
  // wheels: chunky all-terrain tyre + flat aero cover
  const prof = [[0.29, -0.16], [0.40, -0.165], [0.43, -0.12], [R, 0.12], [0.40, 0.165], [0.29, 0.16]].map(([r, y]) => new THREE.Vector2(r, y));
  const wheels = [];
  for (const [key, x, z] of [['FL', -0.88, -WB], ['FR', 0.88, -WB], ['RL', -0.88, WB], ['RR', 0.88, WB]]) {
    const map = {};
    push(map, 'dark', prep(new THREE.LatheGeometry(prof, 24).rotateZ(Math.PI / 2).translate(x, R, z), 'dark', 0x131313));
    for (const sx of [-1, 1]) {
      push(map, 'dark', prep(new THREE.CylinderGeometry(0.30, 0.30, 0.02, 24).rotateZ(Math.PI / 2).translate(x + sx * 0.15, R, z), 'dark', 0x34373a));
      push(map, 'metal', prep(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 12).rotateZ(Math.PI / 2).translate(x + sx * 0.16, R, z), 'metal', 0x9a9da0));
    }
    wheels.push({ key, hub: new THREE.Vector3(x, R, z), map });
  }
  return { body, wheels };
}

// normalise: forward −z (headlights at −z), wheels on y=0, origin centred between the axles
function normalise(parts) {
  const all = [...Object.values(parts.body).flat(), ...parts.wheels.flatMap(w => Object.values(w.map).flat())];
  const head = parts.body.head?.[0];
  let flip = false; if (head) { head.computeBoundingBox(); const c = head.boundingBox.getCenter(new THREE.Vector3()); flip = c.z > 0; }
  if (flip) { for (const g of all) g.rotateY(Math.PI); for (const w of parts.wheels) w.hub.set(-w.hub.x, w.hub.y, -w.hub.z); }
  let minY = Infinity; for (const w of parts.wheels) for (const g of Object.values(w.map).flat()) { g.computeBoundingBox(); minY = Math.min(minY, g.boundingBox.min.y); }
  const cz = parts.wheels.reduce((a, w) => a + w.hub.z, 0) / parts.wheels.length, cx = parts.wheels.reduce((a, w) => a + w.hub.x, 0) / parts.wheels.length;
  for (const g of all) g.translate(-cx, -minY, -cz);
  for (const w of parts.wheels) w.hub.add(new THREE.Vector3(-cx, -minY, -cz));
  for (const w of parts.wheels) { w.radius = w.hub.y; w.key = w.key.replace('BL', 'RL').replace('BR', 'RR'); }
  return parts;
}

function plateRow(g, row) { const uv = g.attributes.uv; if (!uv) return g; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + row) / 4); uv.needsUpdate = true; return g; }

function meshes(geos, mats, parent, { shadow = true } = {}) {
  const out = [];
  for (const [k, g] of Object.entries(geos)) {
    const m = new THREE.Mesh(g, mats[k] || mats.dark); m.castShadow = shadow && k !== 'glass'; m.receiveShadow = k !== 'glass';
    m.userData.keep = true; m.userData.noCull = true; m.name = 'car-' + k; if (k === 'glass') m.renderOrder = 2;
    parent.add(m); out.push(m);
  }
  return out;
}

// ---------------------------------------------------------------- public
// def: { kind: 'glb' | 'truck', url, lod, paint, plate }
export async function buildCarVisual(ctx, def) {
  const parts = normalise(def.kind === 'truck' ? truckParts() : await fromGLB(ctx, def.url));
  let lo = null; if (def.lod) { try { lo = normalise(await fromGLB(ctx, def.lod)); } catch (e) { console.warn('[cars] lod', e); } }
  const mats = carMaterials(ctx, def.paint);
  if (parts.body.plate) parts.body.plate.forEach(g => plateRow(g, def.plate || 0));
  if (lo?.body.plate) lo.body.plate.forEach(g => plateRow(g, def.plate || 0));
  // body only (live) and body + wheels (parked)
  const bodyGeo = mergeMap(parts.body);
  const parkedMap = (p) => { const m = {}; for (const [k, l] of Object.entries(p.body)) for (const g of l) push(m, k, g); for (const w of p.wheels) for (const [k, l] of Object.entries(w.map)) for (const g of l) push(m, k, g); return mergeMap(m); };
  const hiGeo = parkedMap(parts), loGeo = lo ? parkedMap(lo) : null;
  const group = new THREE.Group(); group.name = 'car'; group.userData.keep = true; group.userData.noCull = true;
  const parkedHi = new THREE.Group(), parkedLo = new THREE.Group(), live = new THREE.Group();
  group.add(parkedHi, parkedLo, live);
  meshes(hiGeo, mats, parkedHi); if (loGeo) meshes(loGeo, mats, parkedLo); else parkedLo.visible = false;
  meshes(bodyGeo, mats, live, { shadow: false });
  const wheels = [];
  for (const w of parts.wheels) {
    const pivot = new THREE.Group(); pivot.position.copy(w.hub); const spin = new THREE.Group(); pivot.add(spin); live.add(pivot);
    const local = {}; for (const [k, l] of Object.entries(w.map)) local[k] = l.map(g => g.clone().translate(-w.hub.x, -w.hub.y, -w.hub.z));
    meshes(mergeMap(local), mats, spin, { shadow: false });
    wheels.push({ key: w.key, hub: w.hub.clone(), radius: w.radius, front: w.hub.z < 0, left: w.hub.x < 0, pivot, spin });
  }
  live.visible = false; parkedLo.visible = false;
  // body extents (for colliders / seats / shove)
  const bb = new THREE.Box3(); for (const g of Object.values(bodyGeo)) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  let tris = 0; for (const g of Object.values(hiGeo)) tris += g.index.count / 3;
  return { group, parkedHi, parkedLo, live, wheels, mats, bbox: bb, tris: Math.round(tris), hasLod: !!loGeo };
}
