// Shared toolkit for the furnish module: a small palette of vertex-coloured materials (so hundreds of props
// collapse into a handful of draws after main.js' merge pass), geometry builders that bake a colour into
// every vertex, the print atlas, placement helpers (Rapier ray casts onto whatever surface is there),
// prop tagging (userData.furnish) and a per-room inventory.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atlasTexture, cell } from './atlas.js';

const _c = new THREE.Color();

// ---------------------------------------------------------------- geometry: bake colour, normalise attributes
// Every furnish geometry carries position/normal/uv/color and an index, so all of them can share buckets.
export function tint(geo, hex, faceCols = null) {
  if (!geo.index) { const n = geo.attributes.position.count; const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; geo.setIndex(new THREE.BufferAttribute(idx, 1)); }
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.color || hex !== undefined) {
    const n = geo.attributes.position.count; const col = new Float32Array(n * 3); _c.set(hex ?? 0xffffff);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  geo.clearGroups();
  return geo;
}
// per-vertex colour from a function of the (local) vertex position: fn(x,y,z) -> hex
export function tintBy(geo, fn) { tint(geo, 0xffffff); const p = geo.attributes.position, c = geo.attributes.color; for (let i = 0; i < p.count; i++) { _c.set(fn(p.getX(i), p.getY(i), p.getZ(i))); c.setXYZ(i, _c.r, _c.g, _c.b); } return geo; }

const rb = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
export const G = {
  box: (w, h, d, hex) => tint(new THREE.BoxGeometry(w, h, d), hex),
  rbox: (w, h, d, r, hex, seg = 2) => tint(rb(w, h, d, r, seg), hex),
  cyl: (rt, rb2, h, hex, seg = 10) => tint(new THREE.CylinderGeometry(rt, rb2, h, seg), hex),
  sph: (r, hex, ws = 10, hs = 7) => tint(new THREE.SphereGeometry(r, ws, hs), hex),
  torus: (r, t, hex, rs = 6, ts = 16, arc = Math.PI * 2) => tint(new THREE.TorusGeometry(r, t, rs, ts, arc), hex),
  lathe: (pts, hex, seg = 12) => tint(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), hex),
  tube: (pts, r, hex, seg = 24, rs = 6) => tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rs, false), hex),
  plane: (w, h, hex) => tint(new THREE.PlaneGeometry(w, h), hex),
  // soft upholstery / folded textiles: rounded box with a puffed top
  cushion(w, h, d, r, puff, hex, seg = 2) {
    const g = rb(w, h, d, r, seg); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const f = Math.max(0, 1 - (x / (w / 2)) ** 2) * Math.max(0, 1 - (z / (d / 2)) ** 2); p.setY(i, y > 0 ? y + puff * f : y - puff * 0.3 * f); }
    g.computeVertexNormals(); return tint(g, hex);
  },
  // cloth ribbon: width w along local x, swept along a polyline in the y-z plane; wrinkles = amplitude
  cloth(w, path, hex, { segW = 10, wrinkle = 0.012, seed = 1, thick = 0 } = {}) {
    const n = path.length; const pos = [], uv = [], idx = [];
    const len = [0]; for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    for (let i = 0; i < n; i++) {
      const [y, z] = path[i]; const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)]; let ny = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(ny, nz) || 1; ny /= l; nz /= l;
      for (let j = 0; j <= segW; j++) {
        const u = j / segW, x = (u - 0.5) * w; const wr = wrinkle * Math.sin(u * 17 + seed * 3 + len[i] * 9) * Math.sin(len[i] * 6 + seed) ;
        pos.push(x + Math.sin(len[i] * 5 + seed) * wrinkle * 0.5, y + ny * wr, z + nz * wr); uv.push(u, len[i]);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < segW; j++) { const a = i * (segW + 1) + j, b = a + segW + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return tint(g, hex);
  },
  // box whose chosen faces show atlas cells (faces: px nx py ny pz nz -> cell name), others plain `hex`
  label(w, h, d, faces, hex = 0xffffff, { faceHex = 0xffffff, r = 0 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d); tint(g, hex);
    const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz']; const uv = g.attributes.uv, col = g.attributes.color; const wc = cell('white'); const wu = (wc[0] + wc[2]) / 2, wv = (wc[1] + wc[3]) / 2;
    _c.set(faceHex);
    for (let f = 0; f < 6; f++) {
      const name = faces[order[f]]; for (let k = 0; k < 4; k++) { const i = f * 4 + k;
        if (name) { const [u0, v0, u1, v1] = Array.isArray(name) ? name : cell(name); uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); col.setXYZ(i, _c.r, _c.g, _c.b); }
        else uv.setXY(i, wu, wv); }
    }
    return g;
  },
  // cylinder with an atlas label wrapped round its side, plain caps
  can(r, h, name, capHex = 0xc9ccd0, seg = 10) {
    const g = new THREE.CylinderGeometry(r, r, h, seg, 1); tint(g, 0xffffff);
    const [u0, v0, u1, v1] = cell(name); const wc = cell('white'); const uv = g.attributes.uv, col = g.attributes.color, nrm = g.attributes.normal; _c.set(capHex);
    for (let i = 0; i < uv.count; i++) { if (Math.abs(nrm.getY(i)) > 0.5) { uv.setXY(i, (wc[0] + wc[2]) / 2, (wc[1] + wc[3]) / 2); col.setXYZ(i, _c.r, _c.g, _c.b); } else uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
    return g;
  },
  // flat quad in the XY plane (facing +z) showing an atlas cell
  sheet(w, h, name, hex = 0xffffff) { const g = new THREE.PlaneGeometry(w, h); tint(g, hex); const [u0, v0, u1, v1] = cell(name); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return g; },
  // leaf card: slightly cupped, pointed quad strip (len along +y, width w); bent forward by `bend`
  leaf(len, w, hex, bend = 0.3, segs = 4) {
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs, y = t * len, hw = w / 2 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.0005, z = bend * len * t * t;
      pos.push(-hw, y, z + hw * 0.25, 0, y, z, hw, y, z + hw * 0.25); }
    for (let i = 0; i < segs; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return tint(g, hex);
  },
};
// transform helper: returns geo after applying a TRS (in place)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function xf(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, typeof s === 'number' ? _s.set(s, s, s) : _s.set(...s)); return geo.applyMatrix4(_m); }
export const mergeAll = (geos) => mergeGeometries(geos, false);

// ---------------------------------------------------------------- the toolkit bound to a build ctx
export function makeLib(ctx) {
  const { kit, phys, root } = ctx; const RAP = phys.RAPIER;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const atlas = atlasTexture();
  // fabric: the kit's linen scan maps on a plain standard material (no sheen lobe: cheaper per pixel)
  const fab = (f) => std({ map: f.map, normalMap: f.normalMap, normalScale: f.normalScale.clone().multiplyScalar(0.7), roughnessMap: f.roughnessMap, roughness: 0.92, vertexColors: true, side: THREE.DoubleSide });
  const M = {
    matte: std({ vertexColors: true, roughness: 0.85 }),
    satin: std({ vertexColors: true, roughness: 0.32 }),
    metal: std({ vertexColors: true, roughness: 0.3, metalness: 1 }),
    print: std({ vertexColors: true, map: atlas, roughness: 0.6 }),
    screen: std({ color: 0x050505, vertexColors: true, map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.25 }),
    fabric: fab(kit.fabric.linen('#ffffff', { scale: 3 })),
    leaf: std({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false, ior: 1.5, specularIntensity: 1, side: THREE.DoubleSide }),
    led: std({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 3, vertexColors: true, roughness: 0.4 }),
  };
  for (const [k, m] of Object.entries(M)) if (!m.name) m.name = 'furnish:' + k;
  // aliases: fewer materials = fewer draws after the merge (colour lives in the vertices)
  M.knit = M.fabric; M.towel = M.fabric; M.brass = M.metal; M.chrome = M.metal;
  // matte / satin / gloss / glass props all draw with the print material (uv -> the atlas' white cell, colour in
  // the vertices): one draw per room instead of four. Glass reads as pale frosted glass.
  const flat = (target) => ({ isFlatProxy: true, target });
  M.matte = M.satin = M.gloss = M.glass = flat(M.print); M.print.roughness = 0.5;
  M.leaf.userData.noDedupe = false;
  // outdoor variants (kit.outdoor: real sky reflections)
  const OUT = {};
  const out = (k) => { const base = M[k]; const key = base.uuid; return OUT[key] || (OUT[key] = kit.outdoor(base.clone())); };

  // ---- surfaces: Rapier ray straight down onto fixed colliders (furniture boxes, floors, decks)
  const ray = new RAP.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FL = RAP.QueryFilterFlags.EXCLUDE_KINEMATIC | RAP.QueryFilterFlags.EXCLUDE_DYNAMIC | RAP.QueryFilterFlags.EXCLUDE_SENSORS;
  phys.world.updateSceneQueries?.();
  const surf = (x, z, from, dflt = null) => { ray.origin.x = x; ray.origin.y = from; ray.origin.z = z; const h = phys.world.castRay(ray, 8, true, FL); return h ? from - (h.timeOfImpact ?? h.toi) : dflt; };

  // ---- visual surfaces: THREE ray straight down onto the rendered meshes of the room pieces (seat cushions,
  // shelves and counter tops are exact, unlike the furniture's collider boxes). Faint glass is ignored.
  let cands = null; const rc = new THREE.Raycaster(); const _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
  const skipMesh = (o) => { const m = [].concat(o.material)[0]; return !m || (m.transparent && m.opacity < 0.6) || m.depthWrite === false || m.blending === THREE.AdditiveBlending || /sprite|glow|wash|shadow|ao/i.test(o.name || ''); };
  function buildCands() {
    cands = []; ctx.scene.updateMatrixWorld(true);
    ctx.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh) return; let p = o; while (p) { if (p === root || !p.visible) return; p = p.parent; } if (skipMesh(o)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); if (bb.max.x - bb.min.x > 60 || bb.max.z - bb.min.z > 60) return; cands.push([o, bb]); });
  }
  // vs(x, z, from, down = 1.6) -> y of the first visible surface below `from` (falls back to colliders, then dflt)
  const vs = (x, z, from, dflt = null, down = 1.6) => {
    if (!cands) buildCands();
    const list = []; for (const [o, bb] of cands) if (x >= bb.min.x && x <= bb.max.x && z >= bb.min.z && z <= bb.max.z && bb.min.y < from && bb.max.y > from - down) list.push(o);
    rc.set(_o.set(x, from, z), _d); rc.far = down; const hit = list.length ? rc.intersectObjects(list, false).find(h => h.face && h.face.normal && Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y) > 0.5) : null;
    if (hit) return hit.point.y;
    const s = surf(x, z, from); return s !== null && s > from - down ? s : dflt;
  };
  // shelf tops below `from` at (x,z) (top-down), down to yMin
  const levels = (x, z, from, yMin) => { const out = []; let y = from; for (let i = 0; i < 12; i++) { const h = vs(x, z, y, null, y - yMin); if (h === null || h < yMin) break; out.push(h); y = h - 0.035; } return out; };

  // ---- props + inventory
  const inv = {}; let nProps = 0, nDyn = 0, nSolid = 0;
  // LEDs share the screen material: uv -> the hue strip of the 'leds' atlas cell (emissive map carries the colour)
  const ledCell = cell('leds'); const _hsl = {};
  const toLed = (geo) => { const c = geo.attributes.color, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) { _c.setRGB(c.getX(i), c.getY(i), c.getZ(i)); _c.getHSL(_hsl); const f = _hsl.s < 0.25 ? 0.9 : _hsl.h * 0.76; uv.setXY(i, ledCell[0] + (ledCell[2] - ledCell[0]) * f, (ledCell[1] + ledCell[3]) / 2); c.setXYZ(i, 1, 1, 1); } return geo; };
  const wc = cell('white'), wu = (wc[0] + wc[2]) / 2, wv = (wc[1] + wc[3]) / 2;
  const put = (parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], shadow = false) => {
    if (mat === M.led) { toLed(geo); mat = M.screen; }
    else if (mat && mat.isFlatProxy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, wu, wv); if (mat === M.glass || mat.glass) { const c = geo.attributes.color; for (let i = 0; i < c.count; i++) if (c.getX(i) > 0.9 && c.getY(i) > 0.9) c.setXYZ(i, 0.62, 0.68, 0.7); } mat = mat.target; }
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  // prop(room, name, kind, [x,y,z], ry, {fragile, mass}) -> Group (local frame; +z = front)
  function prop(room, name, kind, pos, ry = 0, { fragile = false, mass = 1, parent = root } = {}) {
    const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = ry; g.name = 'furnish:' + name;
    g.userData.furnish = { kind, fragile, mass, room, name }; parent.add(g); (inv[room] = inv[room] || []).push(name); nProps++; return g;
  }
  const solid = (g) => { nSolid++; g.userData.furnish.solid = true; return phys.solidGroup(g); };
  const dyn = (g, mass, shape = 'box', o = {}) => { nDyn++; g.userData.furnish.dynamic = true; g.updateMatrixWorld(true); return phys.dynamic(g, { mass, shape, ...o }); };
  // dynamic only where the collider under the prop matches the visible surface (else it would pop out of a seat box)
  const dynFit = (g, mass, shape = 'box', o) => { const p = g.position; const s = surf(p.x, p.z, p.y + 0.3); if (s !== null && Math.abs(s - p.y) < 0.03) return dyn(g, mass, shape, o); return null; };
  // big items cast shadows; flag all meshes of a group
  const shadows = (g, on = true) => { g.traverse(o => { if (o.isMesh) o.castShadow = on; }); return g; };
  const rng = kit.rng;
  return { M, out, G, xf, tint, tintBy, put, prop, solid, dyn, dynFit, shadows, surf, vs, levels, inv, rng, stats: () => ({ props: nProps, dynamic: nDyn, solid: nSolid }), THREE, kit, phys, root, ctx };
}
