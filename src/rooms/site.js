// Piece: site — Terrain, tennis court, canyon/hills backdrop, neighbouring context
// Owned rooms: (exterior) | Reference photos: p41, p42, p43, p45
// Terrain is a procedural height field (src/rooms/site/terrain.js): flat pad at y=-0.31 around the house,
// court and turf strip; chaparral bank dropping to the canyon on +z; the mountain spur behind the street
// (-z); the far canyon wall with its hilltop neighbourhoods. The pool deck rect is cut out of the ground
// mesh AND its collider (pool.js owns the deck, its hole and the basin colliders) so people can swim.
import * as THREE from 'three';
import { G, CENTER, STREET_Y, buildTerrain, padDist, fbm, vnoise, ridged, gully, ss } from './site/terrain.js';
import { blobGeo, foliageMaterial, instances, palm, updateFloraLOD } from './site/flora.js';
import { createTrees } from './site/trees.js';
import { COURT, courtMaterials, buildCourt, fenceLine } from './site/court.js';
import { buildSportsCourt } from '../games/court.js';   // bigger court: tennis + basketball + boxing ring + gate
import { addHaze, skyDome, farRidges } from './site/sky.js';

export const piece = { rooms: [], photos: ["p41", "p42", "p43", "p45"] };
export const ownCeiling = [];
export const views = {
  p41: { pos: [34.1, 1.52, -3.1], look: [34.1, 0.77, 20], fov: 77 },
  p42: { pos: [21.2, 1.55, 33.4], look: [22.6, 0.5, 52], fov: 70 },
  p43: { pos: [4.0, 1.55, 31.25], look: [-8, 12.0, 300], fov: 60 },
  p45: { pos: [19, 31, 82], look: [15, 13, 0], fov: 44 },
};

// turf (artificial grass) beyond the court's canyon end + the side strip from the pool lawn (p42)
// (3.8 m strip between the picket fence and the court; at the far end it opens left along the court end)
// (the old court-end lawn z 36..40.5 is now inside the bigger court enclosure, src/games/court.js)
const TURF = [[19.8, 31.25], [23.6, 31.25], [23.6, 41.6], [23.75, 41.6], [23.75, 50.6], [19.8, 50.6]];

export async function build(ctx) {
  const { root, kit, phys } = ctx;
  const O = (m) => kit.outdoor(m);
  const rnd = kit.rng(4507);

  // ---------------------------------------------------------------- neighbour footprints (keep plants off them)
  const NEIGH = [
    // x, z, w, d, ry, floors, roof, wall
    [33, -24, 15, 11, 0.06, 2, 0x6a4a3c, 0xddd2bf, 'turret'],
    [59, -21, 17, 9, 0.04, 1, 0x5a5d62, 0xe2e0da, 'garage'],
    [13.5, -24.6, 10, 9, 0.0, 1, 0x55575b, 0xeeece6, 'garageN'],   // v01/v09: across the street from the porch
    [-27, 31, 14, 10, 0.32, 1, 0x7a4a38, 0xd6ccbb],
    [-33, 8, 12, 12, 0.28, 2, 0x744836, 0xd2c7b4],
    [-30, -27, 12, 10, 0.1, 2, 0x4c4e52, 0xcfc8ba],
    [6, -58, 14, 11, 0.15, 2, 0x5a4f46, 0xcbc2b2],
    [78, 18, 13, 10, -0.2, 1, 0x6b5a4c, 0xd0c6b4],
    [-17, 64, 13, 10, 0.35, 1, 0x5b544c, 0xc9bfae],   // p43: shingle roof down the slope, half hidden in the oaks
    [50, 96, 13, 10, 0.4, 2, 0x5f5248, 0xe2d8c6],
    [2, 138, 15, 11, -0.3, 1, 0x6b5e52, 0xebe3d4],
    [-48, 92, 12, 10, 0.2, 2, 0x5a5550, 0xefebe3],
    [92, 150, 16, 12, 0.5, 2, 0x8f5039, 0xe6ddcc],
    [-20, 190, 14, 10, -0.1, 1, 0x60564c, 0xeae2d2],
    [30, 230, 15, 12, 0.3, 2, 0x904d37, 0xe9e1d0],
  ];
  const onHouse = (x, z, m = 3) => NEIGH.some(([hx, hz, w, d]) => Math.abs(x - hx) < w / 2 + m && Math.abs(z - hz) < d / 2 + m);
  const inTurf = (x, z) => (x > 19.3 && x < 24.2 && z > 30.9 && z < 51.1) || (x > 23.1 && x < 44.1 && z > -3.9 && z < 41.0);
  const onStreet = (x, z) => z > -17.5 && z < -7.5;
  const inHouseLot = (x, z) => x > -4 && x < 23.6 && z > -1 && z < 31.3;

  // ---------------------------------------------------------------- terrain colours
  const C = (h) => new THREE.Color().setHex(h);
  const COL = { lawn: C(0x4d5233), lawn2: C(0x5a4f3e), sage: C(0x7a7e62), brown: C(0x6a5a48), olive2: C(0x4b5236), beige: C(0xb9a68a), spring: C(0x6c8e3c), scrub: C(0x3d5128), olive: C(0x6c6f45),
    dirt: C(0xa39174), rock: C(0x9b9384), haze: C(0x9fb2b4), farGreen: C(0x6c9a40) };
  const tmp = new THREE.Color(), t2 = new THREE.Color();
  const colorAt = (x, y, z, ny, out, nx = 0, nz = 0) => {
    const d = padDist(x, z), r = Math.hypot(x - CENTER[0], z - CENTER[1]);
    const m1 = 0.5 + 0.5 * fbm(x / 35, z / 35, 4, 5), m2 = 0.5 + 0.5 * fbm(x / 9, z / 9, 3, 8);
    out.copy(r > 600 ? COL.farGreen : COL.spring).lerp(COL.scrub, ss(0.35, 0.75, m1) * (r > 600 ? 0.6 : 0.85));
    out.lerp(COL.olive, ss(0.55, 0.9, m2) * 0.5);
    out.lerp(COL.scrub, ss(0.5, 0.8, 0.5 + 0.5 * fbm(x / 4, z / 4, 2, 12)) * 0.55);
    if (r > 120) out.lerp(COL.scrub, ss(0.45, 0.7, 0.5 + 0.5 * fbm(x / 55, z / 55, 3, 31)) * 0.75).lerp(COL.spring, ss(0.6, 0.85, 0.5 + 0.5 * fbm(x / 140, z / 140, 2, 33)) * 0.5);
    const steep = ss(0.86, 0.6, ny); out.lerp(tmp.copy(COL.dirt).lerp(COL.rock, m2), steep * (0.35 + 0.6 * ss(0.4, 0.7, m1)));
    // fire roads on the mountain behind the street (p45): contour-ish bands
    // the mountain behind the street (p45): dark-olive chaparral mottled with sage, brown/grey dieback and
    // bare beige rock on the steep lower faces
    if (z < -55) {
      const k = ss(-55, -110, z);
      t2.copy(COL.olive2).lerp(COL.scrub, ss(0.3, 0.8, 0.5 + 0.5 * fbm(x / 20, z / 20, 3, 61)) * 0.6)
        .lerp(COL.sage, ss(0.55, 0.85, 0.5 + 0.5 * fbm(x / 45, z / 45, 3, 63)) * 0.7)
        .lerp(COL.brown, ss(0.6, 0.9, 0.5 + 0.5 * fbm(x / 28, z / 28, 3, 65)) * 0.65)
        .lerp(COL.rock, ss(0.68, 0.95, 0.5 + 0.5 * fbm(x / 35, z / 35, 2, 67)) * 0.4)
        .lerp(COL.beige, ss(0.9, 0.55, ny) * ss(0.45, 0.75, 0.5 + 0.5 * fbm(x / 60, z / 60, 3, 69)) * 0.85)
        .lerp(COL.scrub, 0.45 * gully(x, z)).multiplyScalar(0.5);
      out.lerp(t2, k);
    }
    // baked relief shading (light from the west, like the listing's afternoon aerial) so ridges and gullies read
    if (r > 70) { const dl = Math.max(0, -0.68 * nx + 0.6 * ny + 0.28 * nz); out.multiplyScalar(1 + ss(70, 200, r) * ((0.2 + 1.3 * dl) / (0.2 + 1.3 * 0.6) - 1)); }
    out.lerp(COL.lawn, ss(4, 0, d) * 0.6);
    if (d < 0.5) { out.copy(COL.lawn).lerp(COL.lawn2, m2 * 0.7); }
  };
  const terr = buildTerrain(kit, colorAt);
  const rT = kit.rng(9);
  const detail = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(222,222,222)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 26000; k++) { // grass blades / soil specks, unfiltered
      const l = 150 + rT() * 105; g.fillStyle = `rgb(${l * (0.96 + rT() * 0.08)},${l},${l * (0.9 + rT() * 0.08)})`;
      g.fillRect(rT() * w, rT() * h, 1 + rT() * 1.5, 2 + rT() * 4);
    }
    for (let k = 0; k < 90; k++) { const l = 120 + rT() * 60; g.fillStyle = `rgba(${l},${l},${l},0.35)`; g.beginPath(); g.arc(rT() * w, rT() * h, 6 + rT() * 30, 0, 7); g.fill(); }
    g.filter = 'blur(1px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
  });
  const groundMat = O(new THREE.MeshPhysicalMaterial({ map: detail, vertexColors: true, roughness: 0.97, specularIntensity: 0.12, normalMap: kit.noiseNormal(256, 2.0, 32, 13), normalScale: new THREE.Vector2(0.6, 0.6) }));
  // tree-clump / scrub mottling at canyon scale (≈250 m tile): dark blotches off the lawns only
  const rM = kit.rng(31);
  const mottle = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 1700; k++) { const l = 60 + rM() * 90, x = rM() * w, y = rM() * h, rr = 4 + rM() * 16;
      g.fillStyle = `rgb(${l},${l},${l})`; g.beginPath(); g.ellipse(x, y, rr, rr * (0.6 + rM() * 0.6), rM() * 3, 0, 7); g.fill();
      for (const ox of [-w, w]) for (const oy of [-h, h, 0]) { g.beginPath(); g.ellipse(x + ox, y + oy, rr, rr, 0, 0, 7); g.fill(); }
      g.beginPath(); g.ellipse(x, y + h, rr, rr, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y - h, rr, rr, 0, 0, 7); g.fill(); }
    g.filter = 'blur(2px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
  }, { srgb: false });
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.mottle = { value: mottle };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float wild;\nvarying float vWild;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWild = wild;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D mottle;\nvarying float vWild;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv ) * ( 0.5 + 0.62 * texture2D( map, vMapUv * 0.047 + vec2( 0.31, 0.77 ) ).g );
  float mt = texture2D( mottle, vMapUv * 0.012 ).g * texture2D( mottle, vMapUv * 0.0047 + vec2( 0.5, 0.21 ) ).g;
  sampledDiffuseColor.rgb *= mix( 1.0, 0.3 + 0.95 * mt, vWild );
  diffuseColor *= sampledDiffuseColor;
#endif`);
  };
  groundMat.customProgramCacheKey = () => 'site-ground-3scale';
  addHaze(groundMat);
  const ground = new THREE.Mesh(terr.geo, groundMat); ground.name = 'site-terrain'; ground.receiveShadow = true; ground.userData.keep = true; root.add(ground);
  phys.trimesh(terr.cgeo);
  const H = terr.heightAt;

  // ---------------------------------------------------------------- fire road + firebreak on the mountain (p45)
  // light dirt switchbacks traversing the lower face, and a straight firebreak cut running up the slope
  const ROADS = [
    { w: 1.5, pts: [[-190, -78], [-60, -84], [40, -92], [120, -100], [70, -128], [-40, -140], [-150, -150], [-90, -182], [30, -196], [150, -210]] },
    { w: 1.3, pts: [[-22, -66], [-26, -120], [-31, -190], [-36, -270], [-40, -330]] },
  ];
  const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const nearRoad = (x, z) => ROADS.some(r => r.pts.some((p, i) => i > 0 && segDist(x, z, r.pts[i - 1], p) < r.w + 2.5));
  { const dirt = addHaze(O(new THREE.MeshStandardMaterial({ color: 0x7d7566, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
    const pos = [], idx = [];
    for (const r of ROADS) for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 3), nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      const b0 = pos.length / 3;
      for (let j = 0; j <= n; j++) { const t = j / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        for (const sd of [-1, 1]) { const px = x + nx * sd * r.w / 2, pz = z + nz * sd * r.w / 2; pos.push(px, H(px, pz) + 0.35, pz); }
        if (j < n) { const k = b0 + j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, dirt); m.receiveShadow = true; m.userData.keep = true; m.material.side = THREE.DoubleSide; root.add(m); }

  // ---------------------------------------------------------------- tennis court
  const CM = courtMaterials(kit);
  buildSportsCourt(kit, root, phys, CM, ctx);

  // ---------------------------------------------------------------- turf strip + court-end lawn (p42)
  const rTu = kit.rng(12);
  const turfMap = kit.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(210,214,200)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 16000; k++) { const l = 175 + rTu() * 80; g.fillStyle = `rgb(${l},${l},${l * 0.92})`; g.fillRect(rTu() * w, rTu() * h, 1, 2 + rTu() * 2); }
  }, { repeat: [1, 1] });
  const turfMat = O(new THREE.MeshStandardMaterial({ map: turfMap, color: 0x687c26, roughness: 0.9, normalMap: kit.noiseNormal(128, 2.0, 32, 4), normalScale: new THREE.Vector2(0.15, 0.15) }));
  const tg = kit.extrude(TURF.map(([x, z]) => [x, -z]), 0.02); tg.rotateX(-Math.PI / 2);
  { const uv = tg.attributes.uv, p = tg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 1.5, p.getZ(i) / 1.5); }
  const turf = kit.add(root, tg, turfMat, [0, G + 0.005, 0], [0, 0, 0], { shadow: false }); turf.receiveShadow = true;

  // ---------------------------------------------------------------- the street (Camino De Yatasto) behind the lots
  { const asph = O(new THREE.MeshStandardMaterial({ ...kit.pbrMaps('asphalt_floor', '1k', { repeat: [1, 1] }), color: 0x9a9a98, roughness: 0.9 }));
    const g = new THREE.PlaneGeometry(170, 8).rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 170 / 4, uv.getY(i) * 2);
    const st = kit.add(root, g, asph, [5, STREET_Y - 0.012, -12.5], [0, 0, 0], { shadow: false }); st.receiveShadow = true;
    const curb = O(new THREE.MeshStandardMaterial({ color: 0xc9c5bc, roughness: 0.85 }));
    for (const zz of [-16.6, -8.4]) kit.add(root, kit.box(170, 0.2, 0.2), curb, [5, STREET_Y + 0.05, zz], [0, 0, 0], { shadow: false }); }

  // ---------------------------------------------------------------- iron picket fence + hedge on the canyon edge (p42)
  const iron = O(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, metalness: 0.5 }));
  const pickets = (a, b, hgt = 1.15) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(L / 0.115); const geos = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const gg = new THREE.BoxGeometry(0.018, hgt, 0.018); gg.translate(a[0] + (b[0] - a[0]) * t, G + hgt / 2, a[1] + (b[1] - a[1]) * t); geos.push(gg); }
    for (let i = 0; i <= Math.ceil(L / 2.4); i++) { const t = i / Math.ceil(L / 2.4); const gg = new THREE.BoxGeometry(0.05, hgt + 0.05, 0.05); gg.translate(a[0] + (b[0] - a[0]) * t, G + (hgt + 0.05) / 2, a[1] + (b[1] - a[1]) * t); geos.push(gg); }
    for (const yy of [0.1, hgt - 0.08, hgt - 0.02]) { const gg = new THREE.BoxGeometry(L, 0.025, 0.03); gg.rotateY(Math.atan2(-(b[1] - a[1]), b[0] - a[0])); gg.translate((a[0] + b[0]) / 2, G + yy, (a[1] + b[1]) / 2); geos.push(gg); }
    kit.add(root, kit.mergeGeometries(geos), iron);
    phys.boxAABB([Math.min(a[0], b[0]) - 0.05, G, Math.min(a[1], b[1]) - 0.05], [Math.max(a[0], b[0]) + 0.05, G + hgt, Math.max(a[1], b[1]) + 0.05]);
  };
  pickets([19.75, 31.0], [19.75, 50.65]);
  // low black chain-link: along the strip past the court corner, a short run across its far end, and the court-end lawn edge
  fenceLine(kit, root, phys, CM, [23.8, 40.6], [23.8, 50.65], 1.2, 'low', { spacing: 2.6 });
  fenceLine(kit, root, phys, CM, [19.75, 50.65], [23.8, 50.65], 1.2, 'low', { spacing: 2.0 });
  // clipped hedge on the turf side of the picket fence (p42): continuous, ~1.2 m, small glossy leaves
  { const hm = addHaze(foliageMaterial(kit)); hm.color.setHex(0x3f5a2a); hm.roughness = 0.6; hm.specularIntensity = 0.5;
    const hg = kit.rbox(0.8, 1.22, 19.3, 0.3, 4); hg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(hg.attributes.position.count * 3).fill(1), 3));
    const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setX(i, p.getX(i) * (1 + 0.06 * Math.sin(z * 2.1) + 0.04 * Math.sin(z * 5.3 + y * 3))); p.setY(i, y + (y > 0.4 ? 0.04 * Math.sin(z * 1.7) : 0)); }
    hg.computeVertexNormals();
    const h = kit.add(root, hg, hm, [20.25, G + 0.6, 31.3 + 19.3 / 2]); h.userData.keep = true;
    phys.boxAABB([19.85, G, 31.3], [20.65, G + 1.22, 50.6]);
    // dark mulch edge at its foot
    const mulch = O(new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 1 }));
    kit.add(root, new THREE.PlaneGeometry(0.2, 19.3).rotateX(-Math.PI / 2), mulch, [20.75, G + 0.026, 31.3 + 19.3 / 2], [0, 0, 0], { shadow: false }).receiveShadow = true; }

  // ---------------------------------------------------------------- vegetation
  const fol = addHaze(foliageMaterial(kit));
  const shrubG = [blobGeo(kit, 3, 6, 1), blobGeo(kit, 8, 7, 1, 0.8), blobGeo(kit, 15, 5, 1, 1.1)];
  const crownG = blobGeo(kit, 21, 8, 1, 0.8);
  const lowG = blobGeo(kit, 30, 4, 0, 0.9);
  const SHRUB = [0x4a5a32, 0x41532d, 0x5c6240, 0x37492a, 0x6a6c4a, 0x52693a, 0x586341, 0x3e5429];
  const TREE = [0x34502a, 0x3e562b, 0x4b5d34, 0x5f6b45, 0x324625, 0x46633a];
  const near = [[], [], []], far = [], trees = [], trunks = [];
  const real = [], rk = kit.rng(9917); // real branching trees + bushes (site/trees.js); `trees`/`trunks`/`near` stay as the blob fallback (?blobtrees=1)
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // leaf tint for the textured bushes from the blob palette: keep its hue/lightness differences, centred on white
  const bushTint = (hex) => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); return new THREE.Color().setHSL(hsl.h + 0.015, Math.min(0.3, hsl.s * 0.5), 0.5 + (hsl.l - 0.3) * 0.9).getHex(); };
  const yardOk = (x, z) => x < -6 || x > 52 || (z < -20 && z > -60);
  const acrossView = (x, z) => x > -6 && x < 24 && z < -16 && z > -55;   // porch view across the street: no forest
  const okSpot = (x, z) => (padDist(x, z) > 0.4 || yardOk(x, z)) && !onHouse(x, z) && !inTurf(x, z) && !onStreet(x, z);
  // chaparral: dense on the canyon bank, thinner further out
  for (let k = 0; k < 14000; k++) {
    const x = -120 + rnd() * 270, z = -110 + rnd() * 420;
    if (!okSpot(x, z) || z < -62) continue;
    const r = Math.hypot(x - CENTER[0], z - CENTER[1]), d = padDist(x, z);
    const dens = (r < 90 ? 0.85 : 0.85 * Math.pow(90 / r, 1.3)) * (0.55 + 0.45 * ss(-0.3, 0.3, vnoise(x / 25, z / 25, 2)));
    if (rnd() > dens) continue;
    const s = (0.45 + rnd() * 0.75) * (r > 120 ? 1.6 : 1);
    const it = { x, y: H(x, z) - 0.15 * s, z, s: [s * (0.9 + rnd() * 0.3), s * (0.6 + rnd() * 0.45), s * (0.9 + rnd() * 0.3)], ry: rnd() * 6.3, color: pick(SHRUB) };
    if (r < 75 && d < 40) near[Math.floor(rnd() * 3)].push(it); else far.push(it);
  }
  // extra-dense bank right below the lot edges (p43 foreground, p42 right side)
  for (let k = 0; k < 1800; k++) {
    const x = -15 + rnd() * 75, z = 28 + rnd() * 45;
    if (!okSpot(x, z) || padDist(x, z) > 22) continue;
    const s = z > 52.4 ? 1.0 + rnd() * 1.3 : (0.6 + rnd() * 0.9) * (0.35 + 0.65 * ss(0, 7, padDist(x, z)));
    near[k % 3].push({ x, y: H(x, z) - 0.2 * s, z, s: [s, s * (0.75 + rnd() * 0.5), s], ry: rnd() * 6.3, color: pick(SHRUB) });
  }
  // tall chaparral + a few trees on the bank right past the end of the turf strip (p43 foreground)
  for (let k = 0; k < 140; k++) {
    const x = 8 + rnd() * 30, z = 54 + rnd() * 10; if (!okSpot(x, z)) continue;
    const s = 1.0 + rnd() * 0.6;
    near[k % 3].push({ x, y: H(x, z) - 0.2 * s, z, s: [s, s * (1.15 + rnd() * 0.3), s], ry: rnd() * 6.3, color: pick(SHRUB) });
  }
  // oaks / sycamores: clustered by noise; the canyon and the street side are wooded (p45)
  for (let k = 0; k < 2600; k++) {
    const x = -160 + rnd() * 360, z = -150 + rnd() * 520;
    if (!okSpot(x, z) || (padDist(x, z) < 7 && !yardOk(x, z))) continue;
    const r = Math.hypot(x - CENTER[0], z - CENTER[1]);
    if (acrossView(x, z)) continue;
    const cl = vnoise(x / 40, z / 40, 17); if (cl < 0.05 || rnd() > (r < 120 ? 0.55 : 0.3) || z < -75) continue;
    const s = 1.8 + rnd() * 2.2, ht = 4 + rnd() * 5;
    const y = H(x, z);
    trees.push({ x, y: y + ht * 0.3, z, s: [s, s * (0.8 + rnd() * 0.35), s], ry: rnd() * 6.3, color: pick(TREE) });
    trunks.push({ x, y, z, s: [s * 0.08, ht * 0.45, s * 0.08], ry: 0, color: 0x5a4c3e });
    real.push({ x, y, z, h: ht * 0.3 + 1.9 * s, w: 2 * s, kind: rk() < 0.62 ? 'oak' : 'sycamore', color: TREE[trees.length % TREE.length], ry: trees[trees.length - 1].ry });
  }
  // yard trees around the court and side yards (p41 leafy tree behind the windscreen, p45)
  const tree = (x, z, s, ht, color = pick(TREE), kind = null) => { const y = H(x, z);
    trees.push({ x, y: y + ht - 1.6 * s, z, s: [s, s * (1.0 + rnd() * 0.25), s], ry: rnd() * 6, color });
    real.push({ x, y, z, h: Math.max(2.5, ht), w: 2.1 * s, color, ry: trees[trees.length - 1].ry,
      kind: kind || (color === 0x2c3f2a || color === 0x26382a ? 'pine' : (color === 0x8a3a2c || color === 0x7a3428) ? 'oak' : rk() < 0.6 ? 'oak' : 'sycamore') });
    trunks.push({ x, y, z, s: [Math.max(0.15, s * 0.07), ht - 1.2 * s, Math.max(0.15, s * 0.07)], ry: 0, color: 0x5a4c3e }); };
  for (const [x, z, s, ht] of [[48.8, 27, 2.4, 5.5], [49.0, 34.5, 2.8, 6], [-8, -10, 3.4, 7], [-8.5, 4, 3, 6], [-9, 22, 3.2, 6.5], [-6, 36, 3.6, 6.5]]) tree(x, z, s, ht);
  // silvery olives behind the tennis fence and at the end of the turf strip (p42 left)
  for (const [x, z, s, ht] of [[25.6, 43.0, 1.0, 4.2], [27.4, 46.6, 1.2, 4.6], [25.3, 49.2, 0.9, 3.8], [29.2, 42.0, 1.1, 4.4], [31.5, 45.0, 1.3, 4.8], [27.8, 52.8, 1.2, 4.0]]) {
    const c = pick([0x76865c, 0x82906a, 0x6e7e56]); tree(x, z, s * 1.6, ht, c, 'olive'); }   // loose, multi-stemmed olive crowns down to the ground
  // crown top about level with the pad (the slope falls away under it): the canopy you look out over
  const bankHt = (x, z, lo, hi) => Math.max(lo, Math.min(hi, G - H(x, z) - 1.0 - rnd() * 3.5));
  // mature trees packed around the lot and down the slopes (p45): oaks, conifers, a red-leaf tree
  tree(51, -9, 3.2, 9, 0x8a3a2c); tree(49.5, -3, 2.6, 8, 0x7a3428);
  for (let k = 0; k < 900; k++) {
    const x = -40 + rnd() * 110, z = -45 + rnd() * 120;
    if (!okSpot(x, z) || (padDist(x, z) < 1.2 && !yardOk(x, z))) continue;
    if (!(x < -3 || z < -18 || (z > 41.5 && x > 24.5))) continue;   // keep the court surroundings open (p41)
    if (acrossView(x, z)) continue;
    if (rnd() > 0.35 + 0.4 * ss(-0.2, 0.4, vnoise(x / 18, z / 18, 5))) continue;
    const ht = z > 31 ? bankHt(x, z, 4, 14) : 5 + rnd() * 7; tree(x, z, Math.min(4.5, ht * (0.32 + rnd() * 0.13)), ht, pick(rnd() < 0.15 ? [0x2c3f2a, 0x26382a] : TREE));
  }
  // p43 foreground: the bank right below the pool lawn fence is dense chaparral + oak canopy, so the
  // camera at the fence looks out over foliage (tops near eye height close by, tall oaks further down)
  for (let k = 0; k < 3200; k++) {
    const x = -22 + rnd() * 44, z = 32.4 + rnd() * 30;
    if (!okSpot(x, z) || (x > 19.3 && z < 51.5)) continue;
    const dz = z - 31.4;
    if (dz < 9 && x > 14) continue;   // keep the near band out of p42's view along the hedge
    if (dz < 9) { const s = 0.5 + rnd() * 0.5; if (z - s < 31.7) continue;
      // tops fall away from ~eye height at the fence (photo foreground) to below the horizon
      const y0 = H(x, z) - 0.15 * s, top = G + 1.0 - 0.38 * dz + (rnd() - 0.5) * 0.8;
      const sy = Math.max(0.5, (top - y0) / 1.45);
      near[k % 3].push({ x, y: y0, z, s: [s, sy, s], ry: rnd() * 6.3, color: pick(SHRUB.concat([0x56703a, 0x667a3c, 0x7a7a52])) }); }
    else if (rnd() < 0.16 && G - H(x, z) > 4) { const ht = bankHt(x, z, 2.5, 15); tree(x, z, Math.min(3.0, 1.4 + ht * 0.12 + rnd()), ht, pick(TREE.concat([0x5a7d34, 0x67853f, 0x6f7d4a]))); }
  }
  // hedges: dense rows behind the iron fence (p42) and along the court-end lawn
  const hedge = [];
  const hedgeRow = (a, b, off, s = 0.42) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.ceil(L / (s * 0.9));
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t + off[0] + (rnd() - 0.5) * 0.2, z = a[1] + (b[1] - a[1]) * t + off[1] + (rnd() - 0.5) * 0.2;
      hedge.push({ x, y: Math.min(G, H(x, z)) - 0.1, z, s: [s * (0.9 + rnd() * 0.3), s * (1.5 + rnd() * 0.4), s * (0.9 + rnd() * 0.3)], ry: rnd() * 6, color: pick([0x34502a, 0x3d5a2c, 0x2f4a26, 0x4a6532]) }); }
  };
  hedgeRow([19.75, 51.3], [24.5, 51.3], [0, 0], 0.6); hedgeRow([24.4, 41.2], [24.4, 51], [0.1, 0], 0.55); hedgeRow([24.5, 41.2], [43.6, 41.2], [0, 0], 0.55);

  // distant canopy / scrub clumps (canyon floor + walls + mountain): low-poly, no shadows
  const farC = [];
  for (let k = 0; k < 16000 && farC.length < 5000; k++) {
    const x = -900 + rnd() * 1800, z = -900 + rnd() * 2000; const r = Math.hypot(x - CENTER[0], z - CENTER[1]);
    if (r < 150 || onHouse(x, z, 8) || z < -60) continue;
    if (vnoise(x / 90, z / 90, 51) < -0.1) continue;
    const s = 3 + rnd() * 5 * (r > 500 ? 1.6 : 1);
    farC.push({ x, y: H(x, z) - 0.3 * s, z, s: [s, s * (0.55 + rnd() * 0.3), s], ry: rnd() * 6.3, color: pick(z < -60 ? SHRUB : TREE) });
  }
  // chaparral clumps on the mountain face behind the street (p45 texture)
  for (let k = 0; k < 60000 && farC.length < 24000; k++) {
    const x = -220 + rnd() * 480, z = -58 - rnd() * 330; if (onHouse(x, z, 6) || nearRoad(x, z)) continue;
    if (vnoise(x / 30, z / 30, 53) < -0.55) continue;
    const s = 2.0 + rnd() * 3.2;
    farC.push({ x, y: H(x, z) - 0.35 * s, z, s: [s, s * (0.5 + rnd() * 0.3), s], ry: rnd() * 6.3, color: pick([0x46522f, 0x55623a, 0x6a7250, 0x7a7a5c, 0x6a5c48, 0x3a4630, 0x5e6a40, 0x8a8468]) });
  }
  // low-poly stand-ins (same shapes at icosphere detail 0) for tiles away from the camera
  const shrubLo = [blobGeo(kit, 3, 6, 0), blobGeo(kit, 8, 7, 0, 0.8), blobGeo(kit, 15, 5, 0, 1.1)], crownLo = blobGeo(kit, 21, 8, 0, 0.8), lowLo = blobGeo(kit, 30, 1, 0, 0.9);
  const meshes = [instances(lowG, fol, farC, { lod: lowLo, lodDist: 220 })];
  meshes.push(instances(lowG, fol, far, { lod: lowLo, lodDist: 120 }));
  meshes.push(instances(shrubG[1], fol, hedge, { shadow: true, lod: shrubLo[1], lodDist: 30 }));
  // near chaparral -> branching bushes (crown ~ the blob's footprint, a little taller: the blobs sat half buried)
  near.forEach((list) => { for (const it of list) real.push({ x: it.x, y: it.y + 0.12 * it.s[1], z: it.z, h: Math.max(0.5, it.s[1] * 1.55), w: (it.s[0] + it.s[2]) * 0.95, ry: it.ry,
    kind: rk() < 0.55 ? 'bushB' : 'bushA', color: bushTint(it.color) }); });
  for (const it of real) if (!it.kind.startsWith('bush')) it.color = bushTint(it.color);
  // cars drive the street band and the driveway (src/cars): no tree, bush or trunk collider there
  const roadway = (x, z) => (z > -17.1 && z < -7.95 && x > -42 && x < 52) || (x > 11.0 && x < 28.6 && z > -8.6 && z < 1.0);
  for (const L of [real, trunks, trees]) for (let i = L.length - 1; i >= 0; i--) if (roadway(L[i].x, L[i].z)) L.splice(i, 1);
  let treesApi = null;
  if (ctx.params?.get('blobtrees') !== '1') { try { treesApi = await createTrees(ctx, real, { haze: addHaze }); } catch (e) { console.error('[trees]', e); window.__errors?.push('trees: ' + (e.stack || e.message)); } }
  if (!treesApi) { // fallback: the old blobs
    near.forEach((list, i) => meshes.push(instances(shrubG[i], fol, list, { shadow: true, lod: shrubLo[i], lodDist: 30 })));
    meshes.push(instances(crownG, fol, trees, { shadow: true, lod: crownLo, lodDist: 45 }));
    const bark = O(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    const trunkG = kit.cyl(0.7, 1, 1, 7); trunkG.translate(0, 0.5, 0);
    meshes.push(instances(trunkG, bark, trunks, { shadow: true }));
  } else {
    window.__trees = treesApi; ctx.trees = treesApi;
    try { const st = JSON.parse(localStorage.getItem('ph.settings') || '{}'); treesApi.setDetail(st.treeDetail || 'medium', st.viewDist !== 'near'); } catch {}
    ctx.onUpdate((dt, t) => treesApi.update(dt, t));
  }
  for (const m of meshes) { m.userData.keep = true; root.add(m); }
  ctx.onUpdate(() => updateFloraLOD(ctx.camera.position));
  // tree trunks are solid near the lot
  for (const t of trunks) if (Math.hypot(t.x - CENTER[0], t.z - CENTER[1]) < 90) phys.boxAABB([t.x - 0.2, t.y, t.z - 0.2], [t.x + 0.2, t.y + 3, t.z + 0.2]);

  // palms (p41 left behind the windscreen; p45 street + SW side)
  const pm = { palmTrunk: O(new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.95, normalMap: kit.noiseNormal(128, 4, 32, 3), normalScale: new THREE.Vector2(1, 1) })),
    palmFrond: O(new THREE.MeshStandardMaterial({ color: 0x4f6b30, roughness: 0.8, side: THREE.DoubleSide })) };
  for (const [x, z, h, s] of [[50.5, 3.0, 11.5, 3], [-12, 30, 8.5, 5], [-14, 12, 7, 6], [62, 30, 9, 7]]) {
    palm(kit, root, pm, [x, H(x, z), z], h, s);
    phys.boxAABB([x - 0.2, H(x, z), z - 0.2], [x + 0.2, H(x, z) + 4, z + 0.2]);
  }

  // ---------------------------------------------------------------- neighbouring houses (simple massing)
  const roofMats = new Map(), wallMats = new Map();
  const mat = (map, hex, rough) => { if (!map.has(hex)) map.set(hex, addHaze(O(new THREE.MeshStandardMaterial({ color: hex, roughness: rough })))); return map.get(hex); };
  /* polish4: neighbour windows read as black squares — reflective glass (sky env) in a white frame with a sill,
     deeper eaves, a front door with a step and two shrubs per house (all static: merged with the rest) */
  const glassDark = O(new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.06, metalness: 0.75, envMapIntensity: 1.3 }));
  const frameWhite = O(new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.55 }));
  const doorMat = O(new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.5 }));
  const shrubMat = O(new THREE.MeshStandardMaterial({ color: 0x3f5a2c, roughness: 0.9 }));
  const trimDark = O(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }));
  const garageWhite = O(new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.5 }));
  const grooveMat = O(new THREE.MeshStandardMaterial({ color: 0xb8b8b4, roughness: 0.6 }));
  const hipRoof = (w, d, h, o) => { // hip roof over w (x) by d (z), eave overhang o
    const W = w / 2 + o, D = d / 2 + o, rx = Math.max(0, (w - d) / 2), rz = Math.max(0, (d - w) / 2);
    const A = [-W, 0, -D], B = [W, 0, -D], Cc = [W, 0, D], Dd = [-W, 0, D], R1 = [-rx, h, -rz], R2 = [rx, h, rz];
    const tris = [A, R1, B, B, R1, R2, B, R2, Cc, Cc, R2, Dd, Dd, R2, R1, Dd, R1, A, A, B, Cc, A, Cc, Dd];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3)); g.computeVertexNormals(); return g;
  };
  for (const [hx, hz, w, d, ry, floors, roof, wall, kind] of NEIGH) {
    const rr = kit.rng(Math.round(hx * 13 + hz * 7));
    let base = Infinity; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = Math.cos(ry), s = Math.sin(ry); const x = hx + (sx * w / 2) * c + (sz * d / 2) * s, z = hz - (sx * w / 2) * s + (sz * d / 2) * c; base = Math.min(base, H(x, z)); }
    const g = kit.group(root, [hx, base, hz], ry);
    const wm = mat(wallMats, wall, 0.9); const HH = floors * 3.0;
    kit.add(g, kit.box(w, HH + 6, d), wm, [0, (HH - 6) / 2, 0]);
    kit.add(g, hipRoof(w, d, Math.min(w, d) * 0.32, 0.85), mat(roofMats, roof, 0.85), [0, HH, 0]);
    kit.add(g, kit.box(w + 1.7, 0.22, d + 1.7), trimDark, [0, HH - 0.06, 0]);
    // windows on both long faces
    for (let f = 0; f < floors; f++) for (const side of [-1, 1]) {
      const n = Math.max(2, Math.floor(w / 3.2));
      for (let i = 0; i < n; i++) { if (rr() < 0.25) continue; if (kind === 'garageN' && side > 0 && f === 0) continue; /* polish4: last slot is the front door now */ const wx = -w / 2 + (i + 0.5) * w / n, ww = 0.8 + rr() * 0.8, hh = f === 0 && rr() < 0.3 ? 2.3 : 1.4;
        const wy = f * 3 + (hh > 2 ? 1.2 : 1.6);
        kit.add(g, kit.box(ww + 0.16, hh + 0.16, 0.05), frameWhite, [wx, wy, side * (d / 2 + 0.02)]);
        kit.add(g, kit.box(ww, hh, 0.04), glassDark, [wx, wy, side * (d / 2 + 0.035)]);
        kit.add(g, kit.box(ww + 0.08, 0.025, 0.04), frameWhite, [wx, wy, side * (d / 2 + 0.06)]);
        kit.add(g, kit.box(ww + 0.3, 0.06, 0.14), frameWhite, [wx, wy - hh / 2 - 0.1, side * (d / 2 + 0.07)]); }
    }
    if (kind === 'garageN') { kit.add(g, kit.box(5.2, 2.3, 0.08), garageWhite, [-w / 2 + 3.4, 1.15, d / 2 + 0.03]);
      for (let i = 0; i < 7; i++) kit.add(g, kit.box(5.0, 0.014, 0.02), grooveMat, [-w / 2 + 3.4, 0.3 + i * 0.3, d / 2 + 0.075]); }
    if (kind === 'garage') for (let i = 0; i < 2; i++) kit.add(g, kit.box(4.6, 2.3, 0.08), garageWhite, [-w / 4 + i * w / 2, 1.15, -d / 2 - 0.03]);
    if (kind === 'turret') {
      kit.add(g, kit.cyl(1.9, 1.9, HH + 1.5, 20), wm, [w / 2 - 2, (HH + 1.5) / 2, -d / 2 + 0.5]);
      kit.add(g, kit.cyl(0.01, 2.3, 2.6, 20), mat(roofMats, roof, 0.85), [w / 2 - 2, HH + 1.5 + 1.3, -d / 2 + 0.5]);
    }
    { const fs = kind === 'garageN' ? 1 : -1, dx = kind === 'garageN' ? w / 2 - 2.0 : kind === 'garage' ? 0 : w * 0.18;
      kit.add(g, kit.box(1.25, 2.35, 0.06), frameWhite, [dx, 1.17, fs * (d / 2 + 0.02)]);
      kit.add(g, kit.box(1.0, 2.2, 0.05), doorMat, [dx, 1.1, fs * (d / 2 + 0.045)]);
      kit.add(g, kit.box(1.8, 0.16, 0.7), grooveMat, [dx, 0.08, fs * (d / 2 + 0.35)]);
      for (const k of [-1, 1]) kit.add(g, new THREE.SphereGeometry(0.55 + rr() * 0.2, 10, 7), shrubMat, [dx + k * 1.4, 0.4, fs * (d / 2 + 0.5)]); }
    if (Math.hypot(hx - CENTER[0], hz - CENTER[1]) < 120) phys.solidGroup(g);
  }
  // across the street from the porch (v01/v09): two tall Italian cypresses left of the neighbour's garage,
  // a black screened fence along the far curb and a street lamp
  { const cyp = addHaze(O(new THREE.MeshStandardMaterial({ color: 0x24331f, roughness: 0.95, normalMap: kit.noiseNormal(128, 3, 32, 8), normalScale: new THREE.Vector2(1.2, 1.2) })));
    const prof = [[0, 0], [0.32, 0.03], [0.5, 0.12], [0.62, 0.3], [0.6, 0.55], [0.48, 0.78], [0.28, 0.93], [0.06, 1.0], [0, 1.0]];
    for (const [x, z, h, r] of [[6.4, -21.3, 9.5, 0.75], [8.6, -23.4, 10.5, 0.8]]) {
      const geo = kit.lathe(prof.map(([pr, py]) => [pr * r * 1.1, py * h]), 10); const y = H(x, z) - 0.2;
      kit.add(root, geo, cyp, [x, y, z]);
      phys.boxAABB([x - 0.3, y, z - 0.3], [x + 0.3, y + 3, z + 0.3]);
    }
    fenceLine(kit, root, phys, CM, [-3.5, -17.4], [9.0, -17.4], 1.8, 'screen', { spacing: 2.5, base: H(3, -17.4) });
    const pole = O(new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.6, metalness: 0.4 }));
    const ly = H(4.6, -17.1);
    kit.add(root, kit.cyl(0.06, 0.09, 4.2, 10), pole, [4.6, ly + 2.1, -17.1]);
    kit.add(root, kit.cyl(0.16, 0.09, 0.45, 10), pole, [4.6, ly + 4.4, -17.1]);
    kit.add(root, kit.cyl(0.02, 0.2, 0.18, 10), pole, [4.6, ly + 4.72, -17.1]);
    phys.boxAABB([4.5, ly, -17.2], [4.7, ly + 4.2, -17.0]); }

  // street-side parked car by the neighbour's garage (p45) — simple massing
  { const car = kit.group(root, [52, G, -14], 1.45); const paint = O(new THREE.MeshStandardMaterial({ color: 0xe8e9ea, roughness: 0.3, metalness: 0.4 }));
    kit.add(car, kit.rbox(4.8, 0.9, 1.9, 0.25), paint, [0, 0.75, 0]); kit.add(car, kit.rbox(2.8, 0.7, 1.7, 0.25), glassDark, [-0.2, 1.45, 0]);
    for (const [wx, wz] of [[-1.5, -0.85], [1.5, -0.85], [-1.5, 0.85], [1.5, 0.85]]) kit.add(car, kit.cyl(0.36, 0.36, 0.25, 16).rotateX(Math.PI / 2), trimDark, [wx, 0.36, wz]);
    phys.solidGroup(car); }

  // far neighbourhoods (p42/p43): dense bands of small houses along the far ridge flanks, not the valley floor
  const far0 = [], farR = [];
  for (let k = 0; k < 90000 && far0.length < 6500; k++) {
    const x = -2200 + rnd() * 4400, z = 800 + rnd() * 2300;
    const y = H(x, z); if (y < -40 || y > 140) continue;          // on the flanks / crest, not the canyon bottom
    const mask = vnoise(x / 220, z / 220, 41) + 0.5 * vnoise(x / 60, z / 60, 43);
    if (mask < 0.15) continue;
    const y2 = H(x + 14, z), y3 = H(x, z + 14);
    if (Math.abs(y2 - y) > 7 || Math.abs(y3 - y) > 7) continue;   // flattish lots only
    const w = 7 + rnd() * 6, d = 6 + rnd() * 5, ry = Math.floor(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.4 + Math.atan2(x, z);
    far0.push({ x, y: y - 2, z, s: [w, 6 + rnd() * 2, d], ry, color: pick([0xe6e1d6, 0xd9cfbc, 0xcfc4ae, 0xeeeae2, 0xc8b89c]) });
    farR.push({ x, y: y + 4.0 + rnd() * 0.8, z, s: [w * 0.78, 2.2, d * 0.78], ry: ry + Math.PI / 4, color: pick([0x9a5a40, 0xa86a4c, 0x6a625a, 0x8a7d6c, 0xb07a58, 0x5e5a56]) });
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
  const pyr = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); pyr.translate(0, 0.5, 0);
  const farWall = addHaze(O(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }))), farRoof = addHaze(O(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })));
  for (const m of [instances(unitBox, farWall, far0), instances(pyr, farRoof, farR)]) { m.userData.keep = true; root.add(m); }

  // ---------------------------------------------------------------- atmosphere: far ridgelines + hazy sky
  farRidges(root);
  const view = ctx.params && ctx.params.get('view');
  // The HDRI background is the Golden Gate hills (green cliffs + cumulus). Inside the walk-through and for the
  // site photos we draw the Palisades sky instead; other pieces' photo shots keep the lead's background.
  if (!ctx.shot || piece.photos.includes(view)) skyDome(root);
  // court views: aim the (global) sun's shadow frustum at the court so fences, poles and the house shade it
  if (ctx.sun && ['p41', 'p42', 'p45'].includes(view)) {
    const sun = ctx.sun, tgt = view === 'p45' ? new THREE.Vector3(18, 0, 12) : new THREE.Vector3(30, 0, 24), ext = view === 'p45' ? 44 : 30;
    const dir = ctx.LIGHT && ctx.LIGHT.sunDir ? ctx.LIGHT.sunDir : sun.position.clone().sub(sun.target.position).normalize();
    sun.target.position.copy(tgt); sun.position.copy(tgt).addScaledVector(dir, 80); sun.target.updateMatrixWorld();
    const c = sun.shadow.camera; c.left = c.bottom = -ext; c.right = c.top = ext; c.near = 1; c.far = 180; c.updateProjectionMatrix();
  }

  kit.mergeStatic(root);
}
