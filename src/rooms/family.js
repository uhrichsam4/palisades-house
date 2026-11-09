// Piece: family — Vaulted family room (one-storey wing), fireplace/TV wall on the SW wall (x=2.65)
// Owned rooms: family | Reference photos: p04, p05
//
// Reading of the photos (p04 looks SW at the fireplace wall, p05 looks NE-ish across the room to the
// dining opening + rear windows):
//  - cathedral ceiling with its ridge running along x (gable ends = fireplace wall and the dining side),
//    a flat strip at the top, two exposed warm-oak beams along the flat-strip edges, cans + a speaker.
//  - SW wall: black Nero-Marquina marble chimney (linear gas fire, framed TV) flanked by rift white-oak
//    open shelving over reeded base cabinets; dark grasscloth return at the living-wall end.
//  - beige linen L-sectional (channel-tufted seats, chaise) facing the TV, two taupe boucle barrel-back swivel chairs,
//    black wire-brushed coffee table, black open-frame side table, flat-weave cream rug with dark flecks,
//    rustic console under the rear window, fiddle-leaf fig, small plants, shelf decor.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const piece = { rooms: ["family"], photos: ["p04", "p05"] };
export const ownCeiling = ['family'];
export const views = {
  // least-squares solved from photo correspondences (TV/firebox corners, shelving ends, door + window jambs,
  // skull); p05 is held just inside the living wall (the free solve lands 0.9 m behind it).
  p04: { pos: [8.72, 1.42, 14.68], look: [4.98, 1.10, 17.05], fov: 62.5 },   // r2: pulled back ~0.45 m + up (critic: too close/low)
  p05: { pos: [3.26, 1.66, 13.72], look: [5.96, 1.42, 16.70], fov: 74.2 },   // r2: yaw right ~3 deg, pitch up (more ceiling/beam)   // just proud of the chimney face: TV/firebox read as a sliver
};

// ---- room constants
const X0 = 2.65, Z0 = 13.60, X1 = 8.30, Z1 = 20.02;
const WALL_Y = 2.80, RIDGE_Y = 3.80, FLAT = 2.2;
const ZC = (Z0 + Z1) / 2;                      // 16.81
const RUN = (Z1 - Z0) / 2 - FLAT / 2;          // horizontal run of each slope
const SLOPE = (RIDGE_Y - WALL_Y) / RUN;
const ceilY = (z) => RIDGE_Y - SLOPE * Math.max(0, Math.abs(z - ZC) - FLAT / 2);
const NE_JOG_X = 7.97;                         // inner face of the exterior jog wall (z 18.10..20.02)
const DIN_Z = 18.10;                           // dining rear wall inner face

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M } = kit;
  const R = kit.rng(4242);

  // ------------------------------------------------------------------ helpers
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // world/local-metre box-projected UVs (tile = metres per texture repeat). grain: 'v' keeps grain vertical on sides.
  function uvBox(geo, tile = 1, opt = {}) {
    const p = geo.attributes.position, n = geo.attributes.normal; const uv = new Float32Array(p.count * 2);
    const tu = opt.tu || tile, tv = opt.tv || tile;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v;
      if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); if (opt.topAlongZ) { u = p.getZ(i); v = p.getX(i); } }
      else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
      else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u / tu + (opt.ou || 0); uv[i * 2 + 1] = v / tv + (opt.ov || 0);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
  }
  const rb = (w, h, d, r = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.0005, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
  const mesh = (parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], opt = {}) => kit.add(parent, geo, mat, pos, rot, opt);
  // box with min corner at local (x0,y0,z0)
  const boxMin = (parent, mat, x0, y0, z0, w, h, d, tile, uvo) => {
    const g = new THREE.BoxGeometry(w, h, d); if (tile) { g.translate(x0 + w / 2, y0 + h / 2, z0 + d / 2); uvBox(g, tile, uvo); g.translate(-(x0 + w / 2), -(y0 + h / 2), -(z0 + d / 2)); }
    return mesh(parent, g, mat, [x0 + w / 2, y0 + h / 2, z0 + d / 2]);
  };
  const paintDS = M.paintWhite.clone(); paintDS.side = THREE.DoubleSide;
  // Sun boost for this room's own materials: scales only the (shadowed) directional sun term, so the light that
  // already passes the rear glazing lands as hard, bright patches on floor/rug/sofa (photos p04/p05) without
  // touching the ambient/probe fill or any shared material.
  const SUN_K = 3.2;
  const sunBoost = (mat, k = SUN_K) => {
    const prev = mat.onBeforeCompile;
    if (prev === THREE.Material.prototype.onBeforeCompile && mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey) mat.userData.mergeSafe = true; /* sun-term scale only: mergeStatic may merge its meshes */
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);
      sh.uniforms.uFamSun = { value: k };
      const chunk = THREE.ShaderChunk.lights_fragment_begin
        .replace(/getDirectionalLightInfo\( directionalLight, directLight \);/g, '$& directLight.color *= uFamSun;')
        .replace(/getSunLightInfo\( sunLight, directLight \);/g, '$& directLight.color *= uFamSun;');
      sh.fragmentShader = 'uniform float uFamSun;\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>', chunk);
    };
    const key = 'famSun' + k; const pk = mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey = () => pk() + key; mat.needsUpdate = true; return mat;
  };

  // ------------------------------------------------------------------ materials
  const oakMaps = kit.pbrMaps('white_oak_veneer', '1k');
  const oak = new THREE.MeshStandardMaterial({ ...oakMaps, roughness: 0.62, normalScale: new THREE.Vector2(0.35, 0.35) });
  oak.color.setRGB(1.42, 1.22, 1.0);            // rift white oak, natural matte (photo ≈ #cfa57a)
  const oakBeam = new THREE.MeshStandardMaterial({ ...kit.pbrMaps('white_oak_veneer', '1k'), roughness: 0.66, normalScale: new THREE.Vector2(0.6, 0.6) });
  oakBeam.color.setRGB(1.38, 0.98, 0.62);       // warmer, stained beams
  const blackWood = new THREE.MeshStandardMaterial({ ...kit.pbrMaps('white_oak_veneer', '1k'), roughness: 0.58, normalScale: new THREE.Vector2(1.5, 1.5) });
  blackWood.color.setRGB(0.16, 0.22, 0.38);    // r2: deep navy-black wire-brushed oak, grain + sheen reads (photo p05)
  const rusticWood = new THREE.MeshStandardMaterial({ ...kit.pbrMaps('white_oak_veneer', '1k'), roughness: 0.85, normalScale: new THREE.Vector2(1.2, 1.2) });
  rusticWood.color.setRGB(1.2, 0.98, 0.78);
  const tvWood = new THREE.MeshStandardMaterial({ ...kit.pbrMaps('white_oak_veneer', '1k'), roughness: 0.5 });
  tvWood.color.setRGB(1.25, 0.88, 0.55);

  // black marble with white veins (tileable canvas, 2.4 m per tile)
  const marbleMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#1f1f20'; g.fillRect(0, 0, w, h);   // Nero Marquina: deep charcoal, never pure black
    for (let i = 0; i < 70; i++) { // soft clouding
      const x = R() * w, y = R() * h, r = 40 + R() * 160; const v = 18 + R() * 16;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${v},${v},${v + 2},0.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      }
    }
    // Nero Marquina: sparse, thin, jagged white veins, mostly diagonal (top-left -> bottom-right as seen on the
    // chimney face: canvas angle ~ -0.65), a few short branches. Angle jitters but is pulled back to its heading.
    const vein = (x, y, ang, len, width, alpha, depth = 0) => {
      const pts = [[x, y]]; let a = ang;
      for (let s = 0; s < len; s += 4) {
        a += (R() - 0.5) * 0.55 + (ang - a) * 0.3; const st = 3 + R() * 3; x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]);
        if (depth < 1 && R() < 0.004) vein(x, y, a + (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.7), len * (0.15 + R() * 0.25), width * 0.6, alpha * 0.8, depth + 1);
      }
      // r4: width and brightness vary along the vein (pinch-and-swell), drawn in short runs; a very faint grey
      // halo only; most of each vein is a hairline, it swells to ~2-3 px (5-7 mm) in a few places (photo p04)
      const ph1 = R() * 6.28, ph2 = R() * 6.28, f1 = 0.01 + R() * 0.02, f2 = 0.035 + R() * 0.04;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h], [w, h], [-w, -h], [w, -h], [-w, h]]) {
        g.lineCap = 'round';
        for (let k = 1; k < pts.length; k += 3) {
          const k1 = Math.min(pts.length - 1, k + 3), sw = 0.5 + 0.5 * Math.sin(k * f1 + ph1) * Math.sin(k * f2 + ph2);
          const lw = width * (0.25 + 1.1 * sw * sw), al = alpha * (0.45 + 0.55 * sw);
          g.beginPath(); g.moveTo(pts[k - 1][0] + ox, pts[k - 1][1] + oy); for (let q = k; q <= k1; q++) g.lineTo(pts[q][0] + ox, pts[q][1] + oy);
          g.strokeStyle = `rgba(200,200,196,${al * 0.12})`; g.lineWidth = lw * 2.6; g.stroke();
          g.strokeStyle = `rgba(232,232,228,${al})`; g.lineWidth = lw; g.stroke();
        }
      }
    };
    // r4: finer, varied network (photo: 4-5 long thin crossing veins per face + hairline branches), never bold
    for (let i = 0; i < 5; i++) vein((i + R() * 0.7) * w / 5, R() * h, -0.65 + (R() - 0.5) * 0.5, 900 + R() * 900, 1.3 + R() * 1.1, 0.85);
    vein(R() * w, R() * h, 0.55 + (R() - 0.5) * 0.6, 500 + R() * 400, 1.1 + R() * 0.6, 0.7);   /* one crossing vein */
    for (let i = 0; i < 9; i++) vein(R() * w, R() * h, -0.65 + (R() - 0.5) * 1.6, 120 + R() * 300, 0.6 + R() * 0.5, 0.3 + R() * 0.3, 1);
  });
  const marble = new THREE.MeshPhysicalMaterial({ map: marbleMap, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.35, normalMap: kit.noiseNormal(256, 0.4, 32, 9), normalScale: new THREE.Vector2(0.05, 0.05) });

  // dark grasscloth (vertical fibres)
  const grassMap = kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a221d'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1) { const v = 28 + R() * 26; g.fillStyle = `rgba(${v + 14},${v + 6},${v},${0.35 + R() * 0.4})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 900; i++) { const v = 50 + R() * 40; g.fillStyle = `rgba(${v},${v - 8},${v - 16},0.3)`; g.fillRect(R() * w, R() * h, 1, 4 + R() * 30); }
  }, { repeat: [1, 1] });
  const grass = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95, normalMap: kit.noiseNormal(256, 2, 64, 5), normalScale: new THREE.Vector2(0.3, 0.3) });

  // upholstery: warm beige woven linen (hessian weave normal, matte; metre-based UVs via uvBox)
  const linen = kit.fabric.linen('#e6dccd', { scale: 4.2, roughness: 1.0, sheen: 0.75, sheenRoughness: 0.55, normalScale: 1.1 });   // cream/greige performance linen (metre UVs -> ~0.24 m per tile)
  linen.color.multiplyScalar(1.5);                              // the neutral weave map averages ~0.57: lift back to cream
  // r4: woven upholstery has almost no dielectric spec lobe; the soft fuzz comes from sheen. Cutting the
  // specular removes the plastic hot-spot along cushion crowns (critic: 'plastic')
  linen.specularIntensity = 0.3;
  const ceramicWhite = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.55 });
  const ceramicCream = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.7 });
  const ceramicBlack = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const stoneBlack = new THREE.MeshStandardMaterial({ color: 0x1e1f20, roughness: 0.85, normalMap: kit.noiseNormal(256, 3, 24, 3), normalScale: new THREE.Vector2(0.5, 0.5) });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xb4825a, roughness: 0.85 });
  const leafGreen = new THREE.MeshStandardMaterial({ color: 0x3d5a2c, roughness: 0.5, side: THREE.DoubleSide });
  const brassMat = M.brass;
  const glassClear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  for (const m of [oak, blackWood, linen, rusticWood]) sunBoost(m);

  // ------------------------------------------------------------------ ceiling: vault + beams
  {
    const g = new THREE.Group(); g.name = 'family-vault'; root.add(g);
    const quad = (A, B, C, D) => {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3));
      bg.computeVertexNormals();
      if (bg.attributes.normal.getY(0) > 0) { // make it face down into the room
        bg.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...C, ...B, ...A, ...D, ...C], 3)); bg.computeVertexNormals();
      }
      const m = new THREE.Mesh(bg, M.ceilingWhite); m.receiveShadow = true; m.castShadow = true; m.name = 'ceil:family'; g.add(m); return m;
    };
    const e = 0.06, xa = X0 - 0.04, xb = X1;
    const za = ZC - FLAT / 2, zb = ZC + FLAT / 2;
    quad([xa, WALL_Y - e * SLOPE, Z0 - e], [xb, WALL_Y - e * SLOPE, Z0 - e], [xb, RIDGE_Y, za], [xa, RIDGE_Y, za]);
    quad([xa, RIDGE_Y, za], [xb, RIDGE_Y, za], [xb, RIDGE_Y, zb], [xa, RIDGE_Y, zb]);
    quad([xa, RIDGE_Y, zb], [xb, RIDGE_Y, zb], [xb, WALL_Y - e * SLOPE, Z1 + e], [xa, WALL_Y - e * SLOPE, Z1 + e]);
    // gable infill walls (pentagons) — at the fireplace wall and over the dining opening / NE jog wall
    const gable = (x, zA, zB, yBot, face = 1) => { // face: +1 = room is at +x of this plane, -1 = at -x
      const pts = [[zA, yBot], [zB, yBot], [zB, ceilY(zB)]];
      for (const zb2 of [ZC + FLAT / 2, ZC - FLAT / 2]) if (zb2 < zB - 1e-3 && zb2 > zA + 1e-3) pts.push([zb2, RIDGE_Y]);
      pts.push([zA, ceilY(zA)]);
      // convex polygon: explicit fan (earcut dropped this face when two vertices nearly coincided)
      const P2 = pts.filter((q, i) => { const r = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-3; });
      const pos = []; for (let i = 1; i < P2.length - 1; i++) for (const q of (face > 0 ? [P2[0], P2[i + 1], P2[i]] : [P2[0], P2[i], P2[i + 1]])) pos.push(x, q[1], q[0]);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      sg.computeVertexNormals(); const m = new THREE.Mesh(sg, paintDS); m.receiveShadow = true; m.castShadow = true; g.add(m); return m;
    };
    gable(X0 + 0.004, Z0, Z1, WALL_Y - 0.02);
    gable(NE_JOG_X - 0.004, DIN_Z, Z1, WALL_Y - 0.02, -1);
    // header over the dining opening + jamb return where the NE jog wall starts
    // deep header/soffit over the dining opening; its room face (x=SOFFIT_X) is the NE gable. Kept clear of the
    // shell roof (plan ROOFS.family slopes toward x=8.27 and dips below the 3.80 ridge for x > ~7.73).
    const SOFFIT_X = 7.72;
    boxMin(g, M.paintWhite, SOFFIT_X, WALL_Y, Z0, X1 + 0.15 - SOFFIT_X, RIDGE_Y + 0.05 - WALL_Y, DIN_Z - Z0);
    boxMin(g, M.paintWhite, NE_JOG_X, 0, DIN_Z, X1 - NE_JOG_X + 0.002, ceilY(DIN_Z) + 0.02, 0.30);
    // exposed oak beams along the flat-top edges
    for (const zb2 of [za, zb]) {
      const bw = 0.24, bh = 0.30; const geo = new THREE.BoxGeometry(X1 - X0 - 0.01, bh, bw);
      const m = mesh(g, geo, oakBeam, [(X0 + X1) / 2, RIDGE_Y - bh / 2 + 0.06, zb2]);
      geo.translate(m.position.x, m.position.y, m.position.z); uvBox(geo, 0.9, { tu: 2.6, tv: 0.9 }); geo.translate(-m.position.x, -m.position.y, -m.position.z);
      // grain along the beam: rotate uv (u along x is fine on sides; bottom uses x too)
    }
    // recessed cans on the slopes + flat top, a ceiling speaker
    const disc = new THREE.CircleGeometry(0.045, 24), ring = new THREE.RingGeometry(0.045, 0.062, 24);
    const lit = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 5 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.6 });
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0xe9e8e4, roughness: 0.8, normalMap: kit.noiseNormal(128, 6, 64, 2), normalScale: new THREE.Vector2(0.6, 0.6) });
    const onCeil = (x, z, geo, mat, off = 0.004) => {
      const y = ceilY(z); let n = V3(0, -1, 0);
      const u = Math.abs(z - ZC) - FLAT / 2; if (u > 0) n = V3(0, -1, Math.sign(z - ZC) * -SLOPE * -1).normalize();
      if (u > 0) n = (z < ZC) ? V3(0, -1, SLOPE).normalize() : V3(0, -1, -SLOPE).normalize();
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z).addScaledVector(n, off); m.lookAt(m.position.clone().add(n)); g.add(m); return m;
    };
    for (const x of [3.55, 5.48, 7.40]) for (const z of [14.55, 19.07]) { onCeil(x, z, disc, lit, 0.004); onCeil(x, z, ring, ringMat, 0.003); }
    onCeil(6.7, ZC, disc, lit, 0.004); onCeil(6.7, ZC, ring, ringMat, 0.003);
    onCeil(4.35, ZC, new THREE.CircleGeometry(0.11, 32), speakerMat, 0.004); onCeil(4.35, ZC, new THREE.RingGeometry(0.11, 0.122, 32), ringMat, 0.003);
    // linear slot diffusers (black) on the gable walls
    const slot = (x, z, len, y, nx) => { const m = mesh(g, new THREE.BoxGeometry(0.012, 0.035, len), M.matteBlack, [x + nx * 0.006, y, z]); return m; };
    slot(X0, 14.95, 0.95, 3.10, 1); slot(X0, 18.55, 0.75, 3.16, 1);
    { const m = mesh(g, new THREE.BoxGeometry(0.012, 0.035, 0.9), M.matteBlack, [7.72 - 0.006, 3.30, 15.25]); }
  }

  // ------------------------------------------------------------------ SW wall: marble chimney, fire, TV, shelving
  const MZ0 = 15.66, MZ1 = 17.96, MD = 0.50;         // marble chimney extent (z) and depth (x)
  const FZ0 = 15.82, FZ1 = 17.80, FY0 = 0.60, FY1 = 0.86; // firebox opening
  const wallGrp = new THREE.Group(); wallGrp.name = 'fam-fireplace'; root.add(wallGrp);
  {
    const top = RIDGE_Y + 0.02, xf = X0 + MD;
    const mb = (z0, z1, y0, y1) => boxMin(wallGrp, marble, X0, y0, z0, MD, y1 - y0, z1 - z0, 2.4, { ou: 0.13, ov: 0.31 });
    mb(MZ0, MZ1, 0, FY0); mb(MZ0, MZ1, FY1, top); mb(MZ0, FZ0, FY0, FY1); mb(FZ1, MZ1, FY0, FY1);
    // firebox: black interior, ember-glass media, black trim, glass front
    const fb = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.55, metalness: 0.2 });
    const depth = 0.30, xin = xf - depth;
    boxMin(wallGrp, fb, xin - 0.02, FY0 - 0.02, FZ0, 0.02, FY1 - FY0 + 0.04, FZ1 - FZ0);             // back
    boxMin(wallGrp, fb, xin, FY1 - 0.005, FZ0, depth, 0.02, FZ1 - FZ0);                                   // top
    boxMin(wallGrp, fb, xin, FY0 - 0.015, FZ0, depth, 0.02, FZ1 - FZ0);                                   // floor
    // dark ember bed + a row of charred logs + a low ribbon of flame glow (emissive card, no light)
    mesh(wallGrp, new THREE.BoxGeometry(depth - 0.04, 0.03, FZ1 - FZ0 - 0.04), new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9, emissive: 0x2a0e03, emissiveIntensity: 0.25 }), [xin + depth / 2, FY0 + 0.0, (FZ0 + FZ1) / 2]);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5a5753, roughness: 0.95 });   // dim grey ceramic logs, no glow
    const logGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.42, 10); logGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) mesh(wallGrp, logGeo, logMat, [xin + 0.10 + (i % 2) * 0.07, FY0 + 0.05 + (i % 2) * 0.03, FZ0 + 0.30 + i * 0.46], [0.08 * (R() - 0.5), 0.25 * (R() - 0.5), 0]);
    const flameTex = kit.canvasTex(512, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = R() * w, fh = h * (0.35 + R() * 0.6), fw = 6 + R() * 12;
        const gr = c.createLinearGradient(0, h, 0, h - fh); gr.addColorStop(0, 'rgba(255,170,60,0.9)'); gr.addColorStop(0.5, 'rgba(255,110,25,0.55)'); gr.addColorStop(1, 'rgba(255,80,10,0)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(x - fw, h); c.quadraticCurveTo(x - fw * 0.3, h - fh * 0.6, x + (R() - 0.5) * 8, h - fh); c.quadraticCurveTo(x + fw * 0.3, h - fh * 0.6, x + fw, h); c.fill();
      }
    });
    // r2: a real lit flame row (photo p04 shows orange flame through the glass), two layers for depth
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x8a5232 });
    for (const [dx, hh, k] of [[0.15, 0.13, 1], [0.21, 0.09, 0.55]]) {
      const fm = k === 1 ? flameMat : flameMat.clone(); if (k !== 1) fm.color.multiplyScalar(k);
      const fl = mesh(wallGrp, new THREE.PlaneGeometry(FZ1 - FZ0 - 0.12, hh), fm, [xin + dx, FY0 + 0.03 + hh / 2, (FZ0 + FZ1) / 2], [0, Math.PI / 2, 0], { shadow: false });
      fl.userData.noCollide = true; fl.userData.keep = true;
    }
    // warm ember glow on the firebox floor (emissive, no light)
    mesh(wallGrp, new THREE.PlaneGeometry(depth - 0.06, FZ1 - FZ0 - 0.1), new THREE.MeshBasicMaterial({ color: 0x8a3a10, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), [xin + depth / 2, FY0 + 0.017, (FZ0 + FZ1) / 2], [-Math.PI / 2, 0, 0], { shadow: false }).userData.noCollide = true;
    const trim = M.blackMetal;
    boxMin(wallGrp, trim, xf - 0.004, FY0 - 0.02, FZ0 - 0.02, 0.012, 0.02, FZ1 - FZ0 + 0.04);
    boxMin(wallGrp, trim, xf - 0.004, FY1, FZ0 - 0.02, 0.012, 0.02, FZ1 - FZ0 + 0.04);
    boxMin(wallGrp, trim, xf - 0.004, FY0, FZ0 - 0.02, 0.012, FY1 - FY0, 0.02);
    boxMin(wallGrp, trim, xf - 0.004, FY0, FZ1, 0.012, FY1 - FY0, 0.02);
    const darkGlass = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.22, specularIntensity: 1, ior: 1.5, depthWrite: false });
    const gl = mesh(wallGrp, new THREE.PlaneGeometry(FZ1 - FZ0, FY1 - FY0), darkGlass,[xf - 0.01, (FY0 + FY1) / 2, (FZ0 + FZ1) / 2], [0, Math.PI / 2, 0], { shadow: false });
    gl.userData.noCollide = true;

    // TV (framed, wood bezel) with a dim recreated "bar interior" frame on screen
    // v03: the TV in the videos is bigger (≈2.0 m wide, 0.13 m marble margins) and hangs lower (bottom ≈1.30 m)
    const tvW = 2.04, tvH = 1.15, tvY = 1.87, tvZ = (MZ0 + MZ1) / 2;
    const scr = kit.canvasTex(1024, 584, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d1a17'); gr.addColorStop(1, '#0a0908'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      // back bar shelves with warm bottles
      for (let s = 0; s < 4; s++) { const y = 70 + s * 70; c.fillStyle = '#2e2620'; c.fillRect(560, y + 46, 420, 6);
        for (let b = 0; b < 16; b++) { const x = 570 + b * 25 + R() * 6, bh = 26 + R() * 18, v = 50 + R() * 50; c.fillStyle = `rgba(${v + 20},${v + 8},${v - 6},0.7)`; c.fillRect(x, y + 46 - bh, 10, bh); } }
      const gl2 = c.createRadialGradient(760, 140, 10, 760, 140, 300); gl2.addColorStop(0, 'rgba(255,190,110,0.35)'); gl2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl2; c.fillRect(400, 0, 624, 400);
      c.fillStyle = '#3a2a1e'; c.fillRect(380, 360, 644, 40); c.fillStyle = '#17110d'; c.fillRect(380, 400, 644, 184); // counter
      for (const x of [470, 600, 730, 860]) { c.fillStyle = '#0d0b0a'; c.beginPath(); c.ellipse(x, 470, 34, 10, 0, 0, Math.PI * 2); c.fill(); c.fillRect(x - 4, 470, 8, 110); }
      c.fillStyle = '#0e0c0b'; c.beginPath(); c.ellipse(230, 270, 75, 95, 0, 0, Math.PI * 2); c.fill(); c.fillRect(150, 300, 170, 290); // figure
      c.beginPath(); c.ellipse(235, 150, 40, 48, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(210,180,150,0.25)'; c.beginPath(); c.ellipse(700, 300, 24, 28, 0, 0, Math.PI * 2); c.fill();
      // soften (film grain + lens blur) so nothing reads as a dot grid
      c.filter = 'blur(3px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none';
      for (let i = 0; i < 6000; i++) { const v = R() * 40; c.fillStyle = `rgba(${v},${v},${v},0.25)`; c.fillRect(R() * w, R() * h, 2, 2); }
      // the photo's frame is a dim black-and-white film still: desaturate + slight warm tone
      const id = c.getImageData(0, 0, w, h), D = id.data; for (let i = 0; i < D.length; i += 4) { const l = 0.3 * D[i] + 0.59 * D[i + 1] + 0.11 * D[i + 2]; D[i] = l * 1.02; D[i + 1] = l; D[i + 2] = l * 0.95; } c.putImageData(id, 0, 0);
    });
    const screen = new THREE.MeshStandardMaterial({ map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.0, color: 0x777777 });
    const tvg = kit.group(wallGrp, [xf, tvY, tvZ], Math.PI / 2, 'tv'); // local x -> world -z, local z -> +x
    boxMin(tvg, M.matteBlack, -tvW / 2, -tvH / 2, 0, tvW, tvH, 0.035);
    const bz = 0.028; const f = (w, h, x, y) => mesh(tvg, rb(w, h, 0.05, 0.004), tvWood, [x, y, 0.025]);
    f(tvW + bz * 2, bz, 0, tvH / 2 + bz / 2); f(tvW + bz * 2, bz, 0, -tvH / 2 - bz / 2); f(bz, tvH, -tvW / 2 - bz / 2, 0); f(bz, tvH, tvW / 2 + bz / 2, 0);
    mesh(tvg, new THREE.PlaneGeometry(tvW, tvH), screen, [0, 0, 0.037]);
  }
  // shelving units (local: x along width (world -z), z = depth (world +x), y up)
  const flutedTex = (() => {
    const t = kit.canvasTex(256, 32, (c, w, h) => { const img = c.createImageData(w, h); for (let x = 0; x < w; x++) { const ph = (x % 16) / 16; const nx = Math.sin(ph * Math.PI * 2 - Math.PI / 2) * -0.0 + Math.cos(ph * Math.PI) * 0.9; for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = 128; img.data[i + 2] = Math.sqrt(Math.max(0, 1 - nx * nx)) * 127 + 128; img.data[i + 3] = 255; } } c.putImageData(img, 0, 0); }, { srgb: false });
    return t;
  })();
  /* r4 (p04): reeded door fronts as filtered maps (normal + AO), not geometry: ~18 mm half-round reeds with a
     narrow shadowed groove. Mipmapped maps keep the fine fluting from aliasing into moire at room distance and
     cost nothing per frame. One reed per texture tile; the door face UVs run in metres/0.9 (boxMin tile 0.9). */
  const REED = 0.018;
  const reedNor = kit.canvasTex(64, 8, (c, w, h) => { const img = c.createImageData(w, h);
    for (let x = 0; x < w; x++) { const t = (x + 0.5) / w, gw = 0.14; let nx = 0, nz = 1;
      if (t > gw / 2 && t < 1 - gw / 2) { const u = (t - 0.5) / (0.5 - gw / 2); nx = u * 0.92; nz = Math.sqrt(Math.max(0, 1 - nx * nx)); }
      for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = 128; img.data[i + 2] = nz * 127 + 128; img.data[i + 3] = 255; } }
    c.putImageData(img, 0, 0); }, { srgb: false, repeat: [0.9 / REED, 1] });
  const reedAO = kit.canvasTex(64, 8, (c, w, h) => { for (let x = 0; x < w; x++) { const t = (x + 0.5) / w, e = Math.min(t, 1 - t);
      const v = e < 0.07 ? 0.38 : 0.62 + 0.38 * Math.min(1, (e - 0.07) / 0.2); c.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`; c.fillRect(x, 0, 1, h); } },
    { srgb: false, repeat: [0.9 / REED, 1] });
  const reedOak = oak.clone(); reedOak.normalMap = reedNor; reedOak.normalScale = new THREE.Vector2(1, 1); reedOak.aoMap = reedAO; reedOak.aoMapIntensity = 1; reedOak.userData = {}; sunBoost(reedOak);
  const decorGrp = new THREE.Group(); decorGrp.name = 'fam-decor'; root.add(decorGrp);
  function shelving(zEnd, w, H = 3.15, D = 0.42, doors = 2) {
    const g = kit.group(root, [X0, 0, zEnd], Math.PI / 2, 'fam-shelving');
    const T = 0.038, ob = { tu: 0.9, tv: 0.9 };
    boxMin(g, oak, 0, 0, 0, T, H, D, 0.9, ob); boxMin(g, oak, w - T, 0, 0, T, H, D, 0.9, ob);   // sides
    boxMin(g, oak, T, H - T, 0, w - 2 * T, T, D, 0.9, ob);                                      // top
    boxMin(g, oak, T, 0, 0, w - 2 * T, H - T, 0.016, 0.9, ob);                                  // back
    boxMin(g, M.matteBlack, T, 0, 0.02, w - 2 * T, 0.08, D - 0.07);                             // recessed toe kick
    boxMin(g, oak, T, 0.98, 0, w - 2 * T, 0.045, D, 0.9, ob);                                   // counter / cabinet top
    for (const y of [1.50, 2.05, 2.58]) boxMin(g, oak, T, y, 0.016, w - 2 * T, 0.036, D - 0.03, 0.9, ob);
    // reeded doors
    const dw = (w - 2 * T - 0.006 * (doors + 1)) / doors, dh = 0.98 - 0.085 - 0.006;
    for (let d = 0; d < doors; d++) {
      const x0 = T + 0.006 + d * (dw + 0.006);
      boxMin(g, reedOak, x0, 0.085, D - 0.03, dw, dh, 0.02, 0.9, ob);
      // tiny black finger-pull notch
      boxMin(g, M.matteBlack, x0 + (d % 2 === 0 ? dw - 0.05 : 0.01), 0.085 + dh - 0.004, D - 0.012, 0.04, 0.006, 0.006);
    }
    // collide: structure (not flutes)
    for (const c of g.children) if (c.isMesh) phys.solid(c);
    phys.boxLocal(g, w / 2, 0.49, D / 2, w / 2, 0.49, D / 2);
    return g;
  }
  const RS0 = 14.15, RS1 = MZ0, LS0 = MZ1, LS1 = 19.30; // v03: left bay ≈0.3 m wider than 1.04 m (fam-sw moved to clear it)
  const SHELF_H = 2.96;   // ceilY(14.15) = 3.06: keep the top board level and clear of the slope
  shelving(RS1, RS1 - RS0, SHELF_H, 0.42, 2);
  shelving(LS1, LS1 - LS0, SHELF_H, 0.42, 2);
  // dark grasscloth return between the right shelving and the living wall
  kit.wallPanel(root, [X0, Z0], [X0, RS0], 0.09, SHELF_H, [1, 0], grass, 0.004);
  // a thin oak edge strip where the grasscloth meets the shelving
  boxMin(root, oak, X0, 0, RS0 - 0.03, 0.42, SHELF_H, 0.03, 0.9);

  // ------------------------------------------------------------------ shelf decor
  const lathe = (pts, seg = 40) => kit.lathe(pts, seg);
  const shelfX = (d = 0.21) => X0 + d;  // depth position
  const place = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; decorGrp.add(obj); return obj; };
  const vaseGeo = {
    bulb: lathe([[0, 0], [0.05, 0], [0.075, 0.05], [0.085, 0.11], [0.07, 0.17], [0.035, 0.21], [0.03, 0.25], [0.036, 0.26], [0.03, 0.262]]),
    jar: lathe([[0, 0], [0.06, 0], [0.075, 0.04], [0.078, 0.13], [0.065, 0.16], [0.04, 0.17], [0.042, 0.19], [0.012, 0.205], [0, 0.21]]),
    small: lathe([[0, 0], [0.035, 0], [0.05, 0.04], [0.045, 0.09], [0.022, 0.12], [0.025, 0.14], [0.02, 0.141]]),
    bowl: lathe([[0, 0], [0.06, 0], [0.13, 0.04], [0.15, 0.085], [0.145, 0.087], [0.12, 0.05], [0.05, 0.012], [0, 0.012]]),
    cloche: lathe([[0, 0], [0.09, 0], [0.095, 0.02], [0.08, 0.04], [0.085, 0.14], [0.05, 0.17], [0.012, 0.18], [0.015, 0.2], [0, 0.205]]),
  };
  const bookMats = new Map();
  const bookMat = (c) => { if (!bookMats.has(c)) bookMats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); return bookMats.get(c); };
  const bookStack = (n, w = 0.24, d = 0.17, cols = ['#d9d2c4', '#1f2a2c', '#8b8475', '#e8e2d6', '#4b5a52']) => {
    const g = new THREE.Group(); let y = 0;
    for (let i = 0; i < n; i++) { const t = 0.025 + R() * 0.02; mesh(g, rb(w - R() * 0.03, t, d - R() * 0.02, 0.003), bookMat(cols[i % cols.length]), [R() * 0.01, y + t / 2, R() * 0.01], [0, (R() - 0.5) * 0.15, 0]); y += t; }
    g.userData.h = y; return g;
  };
  const sculptureHead = () => { const g = new THREE.Group(); mesh(g, new THREE.SphereGeometry(0.06, 24, 16), stoneBlack, [0, 0.13, 0]).scale.set(0.85, 1.15, 0.95); mesh(g, kit.cyl(0.03, 0.04, 0.06), stoneBlack, [0, 0.04, 0]); mesh(g, rb(0.08, 0.02, 0.08, 0.005), stoneBlack, [0, 0.01, 0]); return g; };
  // long planter box (length along local x) with a row of small leafy plants
  const tinyPlants = (len) => { const g = new THREE.Group(); mesh(g, rb(len, 0.07, 0.1, 0.008), stoneBlack, [0, 0.035, 0]); for (let i = 0; i < len / 0.045; i++) { const s = 0.03 + R() * 0.03; mesh(g, new THREE.IcosahedronGeometry(s, 1), leafGreen, [-len / 2 + 0.03 + i * 0.045, 0.09 + R() * 0.03, (R() - 0.5) * 0.05]).scale.set(1, 0.9 + R() * 0.7, 1); } return g; };
  const flowersInVase = () => { const g = new THREE.Group(); mesh(g, vaseGeo.small, glassClear, [0, 0, 0]).scale.set(1.3, 1.1, 1.3); for (let i = 0; i < 9; i++) { const a = R() * 6.28, r = 0.03 + R() * 0.06; const tip = [Math.cos(a) * r, 0.2 + R() * 0.08, Math.sin(a) * r]; mesh(g, kit.tube([[0, 0.12, 0], [tip[0] * 0.5, 0.18, tip[2] * 0.5], tip], 0.003, 8), leafGreen); mesh(g, new THREE.IcosahedronGeometry(0.022, 1), ceramicWhite, tip).scale.set(1, 0.6, 1); } return g; };
  // white coral (bumpy sphere) and wire basket
  const coralGeo = (r, detail) => {
    const cg = new THREE.IcosahedronGeometry(r, detail); const cp = cg.attributes.position; const dirs = []; for (let i = 0; i < 50; i++) dirs.push(V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize());
    const v = V3(0, 0, 0), n = V3(0, 0, 0);
    for (let i = 0; i < cp.count; i++) { v.set(cp.getX(i), cp.getY(i), cp.getZ(i)); n.copy(v).normalize(); let b = 0; for (const d of dirs) b = Math.max(b, Math.pow(Math.max(0, n.dot(d)), 60)); v.multiplyScalar(1 + 0.22 * b - 0.05); cp.setXYZ(i, v.x, v.y, v.z); }
    cg.computeVertexNormals(); return cg;
  };
  const coralMat = new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.9 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, metalness: 0.6, wireframe: true });
  const basket = () => { const g = new THREE.Group(); mesh(g, new THREE.CylinderGeometry(0.085, 0.07, 0.12, 14, 4, true), wireMat, [0, 0.06, 0], [0, 0, 0], { shadow: false }); mesh(g, new THREE.CircleGeometry(0.07, 14), M.matteBlack, [0, 0.003, 0], [-Math.PI / 2, 0, 0]); return g; };
  const coral = (r = 0.06) => { const m = new THREE.Mesh(coralGeo(r, 3), coralMat); m.castShadow = true; m.position.y = r * 0.9; const g = new THREE.Group(); g.add(m); return g; };
  const vase = (geo, mat, s = 1) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.scale.setScalar(s); return m; };
  const HZ = Math.PI / 2; // rotate local-x-long objects to run along the shelf (world z)
  // r2 warm decor: tan glazed urn, wooden bead ring, brass vase with dried pampas, brass bud vase
  const tanGlaze = new THREE.MeshPhysicalMaterial({ color: 0xb8875a, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const woodBead = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: 0.6 });
  const pampas = new THREE.MeshStandardMaterial({ color: 0xe9dfcc, roughness: 0.95 });
  const urnGeo = lathe([[0, 0], [0.04, 0], [0.065, 0.03], [0.075, 0.08], [0.06, 0.13], [0.03, 0.155], [0.033, 0.175], [0.028, 0.177]]);
  const brassVaseGeo = lathe([[0, 0], [0.045, 0], [0.06, 0.05], [0.058, 0.11], [0.035, 0.16], [0.03, 0.19], [0.038, 0.2], [0.033, 0.202]]);
  const urn = (s = 1) => vase(urnGeo, tanGlaze, s);
  const beadRing = () => { const g = new THREE.Group(); const sg = new THREE.SphereGeometry(0.013, 10, 8); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mesh(g, sg, woodBead, [Math.cos(a) * 0.055, 0.013, Math.sin(a) * 0.055]); } return g; };
  const driedVase = () => { const g = new THREE.Group(); mesh(g, brassVaseGeo, brassMat);
    for (let i = 0; i < 7; i++) { const a = R() * 6.28, r = 0.04 + R() * 0.07, h = 0.3 + R() * 0.12; const tip = [Math.cos(a) * r, h, Math.sin(a) * r];
      mesh(g, kit.tube([[0, 0.15, 0], [tip[0] * 0.5, h * 0.75, tip[2] * 0.5], tip], 0.0025, 8), woodBead);
      mesh(g, new THREE.IcosahedronGeometry(0.03, 1), pampas, tip).scale.set(0.7, 1.8, 0.7); }
    return g; };
  // world helpers for each shelf level (bottom surfaces of compartments)
  const SH = { c: 1.025, s1: 1.536, s2: 2.086, s3: 2.616 };
  // right unit (z 14.15..15.66): from photo p04 — 3-4 objects per shelf
  place(tinyPlants(0.42), shelfX(), SH.s3, 15.30, HZ);
  place(vase(vaseGeo.jar, ceramicCream), shelfX(), SH.s3, 14.40);
  { const b = bookStack(3, 0.22, 0.16, ['#e8e2d6', '#8b8475', '#2d2a26']); place(b, shelfX(), SH.s3, 14.80); place(vase(vaseGeo.small, ceramicBlack, 0.8), shelfX(), SH.s3 + b.userData.h, 14.80); }
  place(vase(vaseGeo.bulb, tanGlaze), shelfX(), SH.s2, 15.40);
  place(urn(0.85), shelfX(), SH.s3, 14.60);
  place(beadRing(), shelfX(), SH.s2, 15.25);
  place(vase(vaseGeo.small, ceramicBlack), shelfX(), SH.s2, 15.12).scale.set(1.2, 0.8, 1.2);
  place(coral(0.055), shelfX(), SH.s2, 14.86);
  { const b = bookStack(3, 0.22, 0.16); place(b, shelfX(), SH.s2, 14.45); const cam = new THREE.Group(); mesh(cam, rb(0.13, 0.08, 0.06, 0.01), M.matteBlack, [0, 0.04, 0]); mesh(cam, rb(0.12, 0.012, 0.055, 0.003), M.brushedNickel, [0, 0.085, 0]); mesh(cam, kit.cyl(0.026, 0.026, 0.05), M.matteBlack, [0, 0.04, 0.05], [Math.PI / 2, 0, 0]); place(cam, shelfX(), SH.s2 + b.userData.h, 14.45, Math.PI / 2); }
  place(vase(vaseGeo.small, terracotta), shelfX(), SH.s1, 15.45).scale.set(1, 1.1, 1);
  place(basket(), shelfX(), SH.s1, 15.20);
  place(driedVase(), shelfX(), SH.s1, 14.95);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), brassMat); place(m, shelfX(0.24), SH.s1 + 0.025, 14.66 - i * 0.07); }
  place(sculptureHead(), shelfX(), SH.s1, 14.32);
  { const b = bookStack(4, 0.24, 0.17); place(b, shelfX(), SH.c, 15.42); const gm = new THREE.MeshStandardMaterial({ color: 0x3f7b5a, roughness: 0.4 }); for (let i = 0; i < 3; i++) place(new THREE.Mesh(rb(0.035, 0.07, 0.035, 0.006), gm), shelfX(0.2), SH.c + b.userData.h + 0.035, 15.34 + i * 0.06); }
  const shelfBowl = new THREE.Mesh(vaseGeo.bowl, ceramicWhite); shelfBowl.castShadow = true; place(shelfBowl, shelfX(), SH.c + 0.002, 14.98);
  for (const [dx, dz, dy] of [[0, 0, 0], [0.05, 0.04, 0.005], [-0.04, 0.05, 0.004], [0.03, -0.05, 0.006], [-0.05, -0.03, 0.003]]) place(new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), coralMat), shelfX() + dx, SH.c + 0.045 + dy, 14.98 + dz);
  place(coral(0.045), shelfX(), SH.c, 14.72);
  { const m = new THREE.Mesh(vaseGeo.cloche, glassClear); place(m, shelfX(), SH.c, 14.40); mesh(m, new THREE.SphereGeometry(0.012, 12, 8), brassMat, [0, 0.21, 0]); }
  // left unit (z 17.96..19.30): top shelf = planter row (photo p04 top-left)
  place(tinyPlants(0.86), shelfX(), SH.s3, 18.48, HZ);
  place(vase(vaseGeo.jar, ceramicCream, 0.9), shelfX(), SH.s2, 18.82);
  { const b = bookStack(3, 0.2, 0.15, ['#2d2a26', '#d9d2c4', '#8b8475']); place(b, shelfX(), SH.s2, 18.48); place(coral(0.04), shelfX(), SH.s2 + b.userData.h, 18.48); }
  place(vase(brassVaseGeo, brassMat, 0.9), shelfX(), SH.s2, 18.15);
  place(urn(0.7), shelfX(), SH.s1, 18.86);
  { const b = bookStack(2, 0.2, 0.15); place(b, shelfX(), SH.s1, 18.70); }
  place(sculptureHead(), shelfX(), SH.s1, 18.40);
  place(vase(vaseGeo.small, terracotta, 0.9), shelfX(), SH.s1, 18.12);
  { const m = new THREE.Mesh(kit.torus(0.05, 0.012, 12, 32), stoneBlack); place(m, shelfX(), SH.c + 0.062, 18.78, Math.PI / 2); }
  place(basket(), shelfX(), SH.c, 18.52);
  place(vase(vaseGeo.jar, terracotta), shelfX(), SH.c, 18.20).scale.set(0.7, 0.6, 0.7);

  // ------------------------------------------------------------------ rug: warm cream hand-loomed wool, ~3.7 x 4.6 m,
  // running under the sofa front, both swivel chairs and the side table (photos p04/p05); short fringe on the z ends.
  const RUG = [3.25, 14.70, 6.95, 19.30];
  {
    const rugMap = kit.canvasTex(1024, 1024, (c, w, h) => {
      c.fillStyle = '#d3c9b8'; c.fillRect(0, 0, w, h);
      // hand-loomed: uneven weft rows (slubs), heathered fibres, a few darker oatmeal flecks, low-frequency mottling
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 60 + R() * 200, v = R() < 0.5 ? 'rgba(255,250,240,0.08)' : 'rgba(150,135,115,0.07)'; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, v); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let y = 0; y < h; y += 2) { const v = 196 + R() * 30; c.fillStyle = `rgba(${v},${v - 8},${v - 22},${0.25 + R() * 0.35})`; c.fillRect(0, y, w, 1); }
      for (let i = 0; i < 14000; i++) { const v = 215 + R() * 35; c.fillStyle = `rgba(${v},${v - 6},${v - 16},0.45)`; c.fillRect(R() * w, R() * h, 2 + R() * 7, 1 + R()); }
      for (let i = 0; i < 5000; i++) { const v = 105 + R() * 45; c.fillStyle = `rgba(${v},${v - 8},${v - 20},0.4)`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
      for (let i = 0; i < 260; i++) { const y = R() * h, x = R() * w, l = 30 + R() * 120; c.fillStyle = 'rgba(245,238,225,0.35)'; c.fillRect(x, y, l, 2); }   // slubs
    });
    const rr = [(RUG[2] - RUG[0]) / 0.45, (RUG[3] - RUG[1]) / 0.45];
    const rugMat = new THREE.MeshPhysicalMaterial({ map: rugMap, roughness: 1,
      normalMap: kit.tex('assets/acg/Carpet016/Carpet016_NormalGL.jpg', { repeat: rr }), normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: kit.tex('assets/acg/Carpet016/Carpet016_Roughness.jpg', { repeat: rr }),
      sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xe6dccb) });
    rugMat.color.setScalar(0.9); sunBoost(rugMat);
    const g = rb(RUG[2] - RUG[0], 0.014, RUG[3] - RUG[1], 0.006, 3);
    const m = mesh(root, g, rugMat, [(RUG[0] + RUG[2]) / 2, 0.006, (RUG[1] + RUG[3]) / 2], [0, 0, 0], { shadow: false }); m.name = 'rug';
    m.receiveShadow = true; m.userData.noCollide = true;
    // fringe: alpha-tested strands on both short ends
    const frTex = kit.canvasTex(512, 32, (c, w, h) => { c.clearRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { const v = 200 + R() * 40; c.fillStyle = `rgb(${v},${v - 8},${v - 20})`; c.fillRect(x + R(), 0, 2, h * (0.7 + R() * 0.3)); } });
    frTex.wrapS = THREE.RepeatWrapping; frTex.repeat.set((RUG[2] - RUG[0]) / 0.5, 1);
    const frMat = sunBoost(new THREE.MeshStandardMaterial({ map: frTex, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }));
    for (const [zz, sgn] of [[RUG[1], -1], [RUG[3], 1]]) {
      const fg = new THREE.PlaneGeometry(RUG[2] - RUG[0] - 0.02, 0.06); fg.rotateX(-Math.PI / 2); if (sgn < 0) fg.rotateY(Math.PI);
      const fm = mesh(root, fg, frMat, [(RUG[0] + RUG[2]) / 2, 0.0065, zz + sgn * 0.03], [0, 0, 0], { shadow: false }); fm.userData.noCollide = true;
    }
  }

  // ------------------------------------------------------------------ sofa: straight cream modular sofa facing the TV (-x)
  // (fitted to both photos: back plane x~6.8, 3.0 m long, z 15.80..18.80). Three seat modules, each with its own
  // tall puffy back block that runs to the floor (seams read from behind in p04), front-to-back channel-tufted
  // seat cushions, and thick rounded arms at both ends; the -z arm's outer face is the big side seen in p04.
  // Cushions are subdivided rounded boxes (SDF rounding on a dense grid) so puff, sag and creases actually bend.
  function softBox(w, h, d, r, puff = 0, o = {}) {
    const step = o.step || 0.035, n = (v, cap = 28) => Math.max(2, Math.min(cap, Math.ceil(v / step)));
    let g = new THREE.BoxGeometry(w, h, d, o.channels ? n(w, 72) : n(w), n(h), n(d)); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-5);
    const p = g.attributes.position, hx = w / 2, hy = h / 2, hz = d / 2;
    const rr = Math.max(0.002, Math.min(r, hx - 1e-3, hy - 1e-3, hz - 1e-3));
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const qx = Math.max(-hx + rr, Math.min(hx - rr, x)), qy = Math.max(-hy + rr, Math.min(hy - rr, y)), qz = Math.max(-hz + rr, Math.min(hz - rr, z));
      let dx = x - qx, dy = y - qy, dz = z - qz; const L = Math.hypot(dx, dy, dz) || 1;
      x = qx + dx / L * rr; y = qy + dy / L * rr; z = qz + dz / L * rr;
      const u = x / hx, v = z / hz, f = Math.max(0, 1 - (u * u + v * v) / 2);
      if (y > 0) {
        y += puff * f * (y / hy);                                                     // domed top
        // channel tufting: rounded rolls with sharp stitched creases at the seams (1 - |sin|^0.5 is 1 on the seam,
        // 0 on the roll crown); the crease keeps a little depth right to the cushion edge so it reads in side light
        if (o.channels) y -= o.channels * (1 - Math.pow(Math.abs(Math.sin(Math.PI * (x + hx) / o.pitch)), 0.5)) * (0.35 + 0.65 * f) * (y / hy);
        if (o.sag) y -= o.sag * Math.exp(-((u - o.sagU) ** 2) * 3) * (y / hy);        // sat-in sag
      } else y -= puff * 0.25 * f * (-y / hy);
      const pinch = 1 - (o.pinch ?? 0.03) * Math.abs(u * v) * Math.max(0, y / hy);    // corners pulled in
      p.setXYZ(i, x * pinch, y, z * pinch);
    }
    g.computeVertexNormals(); return g;
  }
  const SOFA_Z0 = 15.64, SOFA_L = 3.30, SOFA_D = 1.02, SOFA_XB = 6.80;   // r2: longer + lower, crisper (critic: 'foam blocks')
  {
    const s = kit.group(root, [SOFA_XB, 0, SOFA_Z0], -Math.PI / 2, 'fam-sofa'); // local x -> +z, local z (front) -> -x
    const L = SOFA_L, D = SOFA_D, BT = 0.22, armW = 0.24, SY = 0.43, BH = 0.74, GAP = 0.004, BASE = 0.04;
    const up = (geo, pos, rot) => mesh(s, uvBox(geo, 1), linen, pos, rot);
    // recessed dark kick base (in shadow, no visible plinth)
    mesh(s, new THREE.BoxGeometry(L - 0.18, BASE, D - 0.18), M.matteBlack, [L / 2, BASE / 2, D / 2]);
    const nMod = 3, mw = (L - 2 * armW) / nMod;
    for (let k = 0; k < nMod; k++) {
      const x0 = armW + k * mw, w = mw - GAP, cx = x0 + mw / 2;
      // upholstered seat deck
      up(softBox(w, 0.23, D - 0.01, 0.03, 0.003), [cx, BASE + 0.115, D / 2]);
      // channel-tufted seat cushion (channels run front-to-back), slight sat-in sag
      const sd = D - BT - 0.02;
      up(softBox(w - 0.004, 0.15, sd, 0.04, 0.026, { channels: 0.045, pitch: (w - 0.004) / 4, sag: 0.01, sagU: (R() - 0.5) * 0.6, pinch: 0.015, step: 0.014 }), [cx, BASE + 0.23 + 0.07, BT + sd / 2 + 0.005]);
      // tall back block to the floor, puffy front, soft rounded top
      // vertical channel tufting across the back's front face (photo p05), crisp tight top edge
      const bg = softBox(w, BT, BH - BASE, 0.03, 0.022, { pinch: 0.008, channels: 0.040, pitch: w / 4, step: 0.016 }); bg.rotateX(Math.PI / 2);   // puff -> +z (front)
      up(bg, [cx, BASE + (BH - BASE) / 2, BT / 2], [-0.02, 0, 0]);
    }
    // thick track arms (full depth, nearly back height: the near end reads as one broad side face in p04)
    const AH = 0.64;
    for (const ax of [armW / 2, L - armW / 2]) up(softBox(armW - GAP, AH - BASE, D, 0.05, 0.01, { pinch: 0.006 }), [ax, BASE + (AH - BASE) / 2, D / 2]);
    // welt/piping along the seat-cushion front top edge
    const pipe = sunBoost(kit.fabric.linen('#cfc4b4', { scale: 2.6, roughness: 0.95 }));
    for (let k = 0; k < nMod; k++) { const x0 = armW + k * mw + 0.04, x1 = armW + (k + 1) * mw - 0.04; mesh(s, kit.tube([[x0, BASE + 0.23, D - 0.012], [x1, BASE + 0.23, D - 0.012]], 0.007, 12), pipe); }
    phys.solidGroup(s);
  }
  // side table (black open frame) beside the chaise's outer side
  const sideT = kit.group(root, [6.58, 0, 15.39], 0.06, 'fam-sidetable');
  // photo: dark green-black shagreen-wrapped open cube table
  const shagreen = new THREE.MeshStandardMaterial({ color: 0x232b29, roughness: 0.55, normalMap: kit.noiseNormal(256, 4, 96, 21), normalScale: new THREE.Vector2(0.35, 0.35) }); sunBoost(shagreen);
  {
    const W = 0.46, H = 0.60, t = 0.042;
    mesh(sideT, rb(W, 0.028, W, 0.004), shagreen, [0, H - 0.014, 0]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mesh(sideT, rb(t, H - 0.028, t, 0.003), shagreen, [x * (W / 2 - t / 2), (H - 0.028) / 2, z * (W / 2 - t / 2)]);
    for (const z of [-1, 1]) mesh(sideT, rb(W - 2 * t, t, t, 0.003), shagreen, [0, 0.06, z * (W / 2 - t / 2)]);
    for (const x of [-1, 1]) mesh(sideT, rb(t, t, W - 2 * t, 0.003), shagreen, [x * (W / 2 - t / 2), 0.06, 0]);
    phys.solidGroup(sideT);
  }
  // coffee table: solid black rustic wood, thick block legs, arched aprons, lower shelf (long axis along z)
  const CT = [4.80, 17.15], CT_H = 0.45;
  const coffee = kit.group(root, [CT[0], 0, CT[1]], Math.PI / 2, 'fam-coffee');
  {
    // photo: chunky wire-brushed black wood; each face is a thick frame with a big rounded-corner opening between
    // the slab top and a low slab shelf (legs ~0.14 square), edges softly eased.
    const L = 1.52, W = 0.90, H = CT_H, LEG = 0.16, TT = 0.085, SH0 = 0.035, SHT = 0.07;   // r2: chunkier, bigger
    const bx = (w, h, d, pos, r = 0.012) => { const gg = rb(w, h, d, r, 3); uvBox(gg, 0.8, { tu: 0.9, tv: 0.25 }); return mesh(coffee, gg, blackWood, pos); };
    bx(L, TT, W, [0, H - TT / 2, 0], 0.014);                                                            // thick top slab
    bx(L - 0.02, SHT, W - 0.02, [0, SH0 + SHT / 2, 0], 0.01);                                           // low slab shelf
    // side frames: rectangle with a rounded-rect hole, extruded LEG deep, eased edges
    const frame = (span, t) => {
      const y0 = SH0 + SHT, y1 = H - TT, r = 0.075, a = -span / 2 + LEG, b = span / 2 - LEG;
      const sh = new THREE.Shape(); sh.moveTo(-span / 2, SH0); sh.lineTo(span / 2, SH0); sh.lineTo(span / 2, H - TT + 0.005); sh.lineTo(-span / 2, H - TT + 0.005); sh.closePath();
      const hole = new THREE.Path(); hole.moveTo(a + r, y0); hole.lineTo(b - r, y0); hole.quadraticCurveTo(b, y0, b, y0 + r); hole.lineTo(b, y1 - r); hole.quadraticCurveTo(b, y1, b - r, y1);
      hole.lineTo(a + r, y1); hole.quadraticCurveTo(a, y1, a, y1 - r); hole.lineTo(a, y0 + r); hole.quadraticCurveTo(a, y0, a + r, y0); sh.holes.push(hole);
      const gg = new THREE.ExtrudeGeometry(sh, { depth: t - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
      gg.translate(0, 0, -(t - 0.012) / 2); gg.computeVertexNormals(); uvBox(gg, 0.8, { tu: 0.9, tv: 0.25 }); return gg;
    };
    for (const sz of [-1, 1]) mesh(coffee, frame(L - 0.012, LEG), blackWood, [0, 0, sz * (W / 2 - LEG / 2 - 0.006)]);
    for (const sx of [-1, 1]) mesh(coffee, frame(W - 0.012, LEG), blackWood, [sx * (L / 2 - LEG / 2 - 0.006), 0, 0], [0, Math.PI / 2, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(LEG - 0.01, SH0, LEG - 0.01, [sx * (L / 2 - LEG / 2 - 0.006), SH0 / 2, sz * (W / 2 - LEG / 2 - 0.006)], 0.004); // feet
    phys.solidGroup(coffee);
  }
  // swivel barrel chairs: low continuous taupe boucle tub, ~0.85 W x 0.75 H, back wraps ~270 deg, seat at ~0.45
  // warm camel/taupe boucle (photo: plush, nubby, light catching the loops) — fabric library, metre UVs below
  // r4: chenille/boucle pile: strong, fairly tight sheen (light rakes across the nubs and rims glow), almost no
  // dielectric spec, rough base. Low-frequency pile shading map (canvas, metre UVs) breaks the flat plastic tone.
  const boucleTub = sunBoost(kit.fabric.boucle('#b5a38e', { scale: 1, side: THREE.DoubleSide, normalScale: 2.2, roughness: 1.0, sheen: 1.0, sheenRoughness: 0.5, sheenColor: '#e2cdb2' }));
  boucleTub.aoMap = null; boucleTub.specularIntensity = 0.25;
  { const rp = kit.rng(314);
    boucleTub.map = kit.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { const x = rp() * w, y = rp() * h, r = 20 + rp() * 70, v = 170 + rp() * 70;
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          gr.addColorStop(0, `rgba(${v | 0},${v | 0},${v | 0},0.18)`); gr.addColorStop(1, `rgba(${v | 0},${v | 0},${v | 0},0)`); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } }
      for (let i = 0; i < 9000; i++) { const v = 150 + rp() * 100; g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.35)`; g.beginPath(); g.arc(rp() * w, rp() * h, 1 + rp() * 2.2, 0, 6.28); g.fill(); }
    }, { repeat: [0.25, 0.25] });
    boucleTub.color.multiplyScalar(1.7); }
  const metreUV = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
  const BT_TILE = 0.11; // metres per boucle texture tile
  function barrelChair(x, z, faceTo) {
    const ry = Math.atan2(faceTo[0] - x, faceTo[1] - z);
    const g = kit.group(root, [x, 0, z], ry, 'fam-chair');   // local +z = front
    g.scale.setScalar(1.07);                                    // photo chairs ~0.92 m across
    const RO = 0.425, RI = 0.275, Y0 = 0.36;
    // tub body (slightly tapered, rounded bottom edge) — one with the back's outer face
    const bodyPts = [[0, 0.02], [0.33, 0.02], [0.37, 0.035], [0.395, 0.08], [0.41, 0.2], [RO, 0.40], [RO - 0.01, 0.43], [0, 0.43]];
    mesh(g, metreUV(kit.lathe(bodyPts, 56), 2 * Math.PI * RO / BT_TILE, 0.5 / BT_TILE), boucleTub);
    mesh(g, kit.cyl(0.25, 0.25, 0.02, 32), M.matteBlack, [0, 0.01, 0]);                                // recessed swivel plate
    // seat cushion: soft rounded disc, set slightly forward
    const seatPts = [[0, 0.41], [0.27, 0.41], [0.31, 0.43], [0.325, 0.46], [0.315, 0.49], [0.28, 0.505], [0, 0.51]];
    mesh(g, metreUV(kit.lathe(seatPts, 48), 2 * Math.PI * 0.3 / BT_TILE, 0.3 / BT_TILE), boucleTub, [0, 0, 0.035]);
    // back: closed rounded-rectangle profile swept around 270 deg; height 0.75 at the back falling to ~0.60 at the arm ends;
    // the profile shrinks to a rounded dome over the last few steps so the arm ends are closed and soft
    const ARC = 1.5 * Math.PI, NA = 56, CAP = 7;
    const prof = (H) => { const pts = [], rc = (RO - RI) / 2, cx = (RO + RI) / 2, cy = H - rc;
      for (let i = 0; i <= 4; i++) pts.push([RO, Y0 + (cy - Y0) * i / 4]);
      for (let i = 1; i < 12; i++) { const a = (i / 12) * Math.PI; pts.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc]); }
      for (let i = 0; i <= 4; i++) pts.push([RI, cy - (cy - Y0) * i / 4]);
      pts.push([cx, Y0 - 0.02]); return pts; };
    const NP = prof(0.7).length; const pos = [], uvs = [], idx = [];
    for (let i = 0; i <= NA; i++) {
      const t = i / NA, phi = -ARC / 2 + t * ARC;                                    // 0 = straight back (-z)
      const H = 0.60 + 0.15 * Math.pow(Math.cos((phi / (ARC / 2)) * Math.PI / 2), 1.3);
      const e = Math.min(i, NA - i); const sc = e >= CAP ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(1 - e / CAP, 2)));
      const P = prof(H), ccx = (RO + RI) / 2, ccy = (Y0 + H) / 2;
      let acc = 0;
      for (let j = 0; j < NP; j++) {
        const r = ccx + (P[j][0] - ccx) * sc, y = ccy + (P[j][1] - ccy) * sc;
        pos.push(Math.sin(phi) * r, y, -Math.cos(phi) * r);
        if (j > 0) acc += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
        uvs.push(phi * 0.35 / BT_TILE, acc / BT_TILE);
      }
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NP; j++) { const a = i * NP + j, b = i * NP + (j + 1) % NP, c = (i + 1) * NP + j, d = (i + 1) * NP + (j + 1) % NP; idx.push(a, c, b, b, c, d); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); bg.setIndex(idx); bg.computeVertexNormals();
    mesh(g, bg, boucleTub);
    phys.solidGroup(g); return g;
  }
  barrelChair(4.86, 15.12, [4.70, 17.2]);
  barrelChair(4.62, 18.68, [4.85, 17.0]);

  // console (rustic) under the rear window r2, with planters
  const consoleG = kit.group(root, [6.86, 0, Z1 - 0.22], 0, 'fam-console');
  {
    // dark, distressed reclaimed wood (heavy grain relief, brown-black)
    const rusticWood = new THREE.MeshStandardMaterial({ ...kit.pbrMaps('white_oak_veneer', '1k'), roughness: 0.9, normalScale: new THREE.Vector2(1.6, 1.6) });
    rusticWood.color.setRGB(0.42, 0.30, 0.21);
    const L = 1.25, D = 0.36, H = 0.80, lg = 0.065;
    mesh(consoleG, rb(L, 0.05, D, 0.006), rusticWood, [0, H - 0.025, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(consoleG, rb(lg, H - 0.05, lg, 0.006), rusticWood, [sx * (L / 2 - 0.08), (H - 0.05) / 2, sz * (D / 2 - lg / 2)]);
    for (const sz of [-1, 1]) mesh(consoleG, rb(L - 0.16, 0.07, 0.03, 0.005), rusticWood, [0, H - 0.09, sz * (D / 2 - 0.03)]);
    for (const sx of [-1, 1]) mesh(consoleG, rb(0.04, 0.05, D - 0.04, 0.005), rusticWood, [sx * (L / 2 - 0.08), 0.16, 0]);
    mesh(consoleG, rb(L - 0.16, 0.04, 0.05, 0.005), rusticWood, [0, 0.16, 0]);
    phys.solidGroup(consoleG);
    // black trough planter on the floor below
    const tr = kit.group(root, [6.86, 0, Z1 - 0.22], 0, 'fam-trough'); mesh(tr, rb(0.66, 0.15, 0.26, 0.012), stoneBlack, [0, 0.105, 0]); for (const sx of [-1, 1]) mesh(tr, rb(0.07, 0.03, 0.22, 0.006), stoneBlack, [sx * 0.26, 0.015, 0]); mesh(tr, rb(0.60, 0.02, 0.20, 0.005), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), [0, 0.172, 0]);
    phys.solidGroup(tr);
  }

  // ------------------------------------------------------------------ plants
  const bowlPlanter = lathe([[0, 0], [0.07, 0], [0.16, 0.05], [0.19, 0.13], [0.185, 0.135], [0.15, 0.06], [0.06, 0.012], [0, 0.012]]);
  async function phPlant(id, height, hidePot) {
    const o = await kit.loadModel(`assets/ph/${id}/${id}_1k.gltf`);
    if (hidePot) o.traverse(m => { if (m.isMesh && /pot|dirt|pebbles/.test(m.name)) m.visible = false; });
    return kit.fitTo(o, height, 'y');
  }
  // fiddle-leaf fig (procedural; big violin-shaped leaves) in a white planter
  function fiddleFig(x, z, H = 2.05) {
    const g = kit.group(root, [x, 0, z], 0, 'fam-fig');
    mesh(g, kit.lathe([[0, 0], [0.17, 0], [0.19, 0.03], [0.2, 0.4], [0.19, 0.42], [0, 0.42]], 40), ceramicWhite);
    mesh(g, kit.cyl(0.18, 0.18, 0.01), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), [0, 0.405, 0]);
    const bark = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 });
    const trunk = [[0, 0.4, 0], [0.02, 0.9, 0.01], [-0.02, 1.3, 0.03], [0.03, 1.7, 0], [0.0, H, 0.02]];
    mesh(g, kit.tube(trunk, 0.018, 24), bark);
    const branches = [[[0.02, 1.15, 0.02], [0.2, 1.45, 0.1], [0.28, 1.75, 0.12]], [[-0.01, 1.35, 0.03], [-0.22, 1.6, -0.05], [-0.3, 1.85, -0.08]]];
    for (const b of branches) mesh(g, kit.tube(b, 0.012, 16), bark);
    // leaf geometry: fiddle outline, slightly cupped
    const sh = new THREE.Shape(); sh.moveTo(0, 0);
    sh.bezierCurveTo(0.07, 0.02, 0.06, 0.12, 0.08, 0.2); sh.bezierCurveTo(0.1, 0.29, 0.06, 0.34, 0, 0.36);
    sh.bezierCurveTo(-0.06, 0.34, -0.1, 0.29, -0.08, 0.2); sh.bezierCurveTo(-0.06, 0.12, -0.07, 0.02, 0, 0);
    const lg = new THREE.ShapeGeometry(sh, 10); const p = lg.attributes.position;
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i), ly = p.getY(i); p.setZ(i, -Math.abs(lx) * 0.35 + Math.sin(ly / 0.36 * Math.PI) * 0.02 - ly * ly * 0.4); }
    lg.computeVertexNormals();
    const leafTex = kit.canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#3b5a2a'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(170,190,120,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 0); c.stroke(); c.lineWidth = 1.5; for (let i = 1; i < 9; i++) { const y = h - i * h / 10; c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w * 0.25, y - 18, 4, y - 30); c.moveTo(w / 2, y); c.quadraticCurveTo(w * 0.75, y - 18, w - 4, y - 30); c.stroke(); } });
    const uv = lg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.2 + 0.5, p.getY(i) / 0.36);
    const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.42, side: THREE.DoubleSide });
    const nL = 46; const inst = new THREE.InstancedMesh(lg, leafMat, nL); const mm = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    for (let i = 0; i < nL; i++) {
      const t = i / nL; const y = 0.95 + t * (H - 0.95) + (R() - 0.5) * 0.08; const a = i * 2.4 + R() * 0.5;
      const spread = 0.05 + 0.1 * Math.sin(t * Math.PI) + (y > 1.4 ? 0.12 : 0);
      e.set(-0.4 - R() * 0.7, a, (R() - 0.5) * 0.4, 'YXZ'); q.setFromEuler(e); const sc = 0.85 + R() * 0.45 - t * 0.2;
      mm.compose(V3(Math.sin(a) * spread, y, Math.cos(a) * spread), q, V3(sc, sc, sc)); inst.setMatrixAt(i, mm);
    }
    inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
    phys.boxAABB([x - 0.2, 0, z - 0.2], [x + 0.2, 0.42, z + 0.2]);
    /* camera-only soft volume over the leafy crown */
    phys.camSoftAdd?.([x, 1.5, z], [0.45, 0.65, 0.45]);
    return g;
  }
  fiddleFig(3.25, 19.60);
  // plant stand (mid-century, 4 legs) with white pot + leafy plant, next to the fig
  {
    const st = kit.group(root, [3.95, 0, 19.72], 0, 'fam-plantstand');
    mesh(st, kit.cyl(0.15, 0.15, 0.025, 32), rusticWood, [0, 0.26, 0]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; mesh(st, kit.cyl(0.012, 0.015, 0.28, 10), rusticWood, [Math.cos(a) * 0.12, 0.14, Math.sin(a) * 0.12], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]); }
    mesh(st, kit.lathe([[0, 0], [0.12, 0], [0.13, 0.02], [0.13, 0.22], [0, 0.22]], 32), ceramicWhite, [0, 0.27, 0]);
    phys.solidGroup(st);
    try { const pl = await phPlant('potted_plant_02', 0.55, true); pl.position.set(0, 0.42, 0); st.add(pl); } catch (e) { console.warn('[family] plant', e.message); }
  }
  // black bowl planter with greenery on the console
  {
    const bp = mesh(root, bowlPlanter, ceramicBlack, [6.86, 0.80, Z1 - 0.22]); bp.scale.set(1.35, 1.2, 1.35);
    try { const pl = await phPlant('potted_plant_02', 0.42, true); pl.position.set(6.86, 0.83, Z1 - 0.22); root.add(pl); } catch (e) { console.warn('[family] plant', e.message); }
  }

  // ------------------------------------------------------------------ coffee-table + side-table decor (dynamic props)
  const TOP = CT_H;
  {
    // wooden tray with a potted fern
    const tray = kit.group(root, [CT[0] - 0.12, TOP + 0.001, CT[1] + 0.12], 0.25, 'fam-tray');
    mesh(tray, rb(0.42, 0.03, 0.28, 0.006), rusticWood, [0, 0.015, 0]);
    mesh(tray, kit.lathe([[0, 0], [0.07, 0], [0.08, 0.1], [0, 0.1]], 24), ceramicWhite, [0, 0.03, 0]);
    try { const fern = await kit.loadModel('assets/ph/fern_02/fern_02_1k.gltf'); const f2 = kit.fitTo(fern, 0.38, 'max'); f2.position.set(0, 0.11, 0); tray.add(f2); } catch (e) { console.warn('[family] fern', e.message); }
    phys.dynamic(tray, { mass: 1.5 });
    // book stack + knot sculpture
    const bs = bookStack(2, 0.28, 0.2, ['#2d2a26', '#d6cfc2']); bs.position.set(CT[0] + 0.15, TOP + 0.001, CT[1] - 0.35); bs.rotation.y = 0.4; root.add(bs);
    phys.dynamic(bs, { mass: 1.2 });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.045, 0.016, 120, 14, 2, 3), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.45, metalness: 0.2 }));
    knot.castShadow = true; knot.position.set(CT[0] + 0.15, TOP + bs.userData.h + 0.07, CT[1] - 0.35); knot.rotation.set(0.2, 0.6, 0); root.add(knot);
    phys.dynamic(knot, { mass: 0.6, shape: 'hull' });
    // white coral sphere on the side table
    const coral = new THREE.Mesh(coralGeo(0.085, 4), coralMat); coral.castShadow = true;
    coral.position.set(6.58, 0.60 + 0.085, 15.39); root.add(coral);
    phys.dynamic(coral, { mass: 0.8, shape: 'ball' });
    // shelf bowl + a vase on the shelves react to bumps too
    phys.dynamic(shelfBowl, { mass: 0.6, shape: 'hull' });
  }

  // ------------------------------------------------------------------ wall decor: bull skull on the NE jog wall (p05)
  {
    const sk = kit.group(root, [NE_JOG_X - 0.03, 1.75, 18.75], -Math.PI / 2, 'fam-skull');
    const bone = new THREE.MeshStandardMaterial({ color: 0xd8cbb3, roughness: 0.8 });
    mesh(sk, new THREE.SphereGeometry(0.07, 20, 14), bone, [0, 0, 0]).scale.set(1, 1.4, 0.6);
    mesh(sk, new THREE.ConeGeometry(0.045, 0.16, 16), bone, [0, -0.15, 0.01], [Math.PI, 0, 0]);
    mesh(sk, kit.tube([[0.05, 0.06, 0], [0.18, 0.1, 0.03], [0.24, 0.2, 0.02]], 0.016, 20), M.matteBlack);
    mesh(sk, kit.tube([[-0.05, 0.06, 0], [-0.18, 0.1, 0.03], [-0.24, 0.2, 0.02]], 0.016, 20), M.matteBlack);
  }

  // ------------------------------------------------------------------ baseboards (custom: room has open sides)
  {
    const bb = (x0, z0, w, d) => boxMin(root, M.paintWhite, x0, 0, z0, w, 0.09, d);
    bb(X0, Z1 - 0.012, 5.07 - 0.80 - X0, 0.012);              // rear wall, SW of door
    bb(5.07 + 0.80, Z1 - 0.012, NE_JOG_X - 5.87, 0.012);       // rear wall, NE of door
    bb(X0, Z0, X1 - X0 - 0.15, 0.012);                          // living wall
    bb(NE_JOG_X - 0.012, DIN_Z + 0.30, 0.012, Z1 - DIN_Z - 0.30); // NE jog
    bb(X0, LS1, 0.012, Z1 - LS1);                               // fireplace wall near the window
  }

  // ------------------------------------------------------------------ sun-boosted floor + contact shadows
  // Own copy of the oak floor over the family slab (same metre UVs as the shell slab) so the sun patches through
  // the rear glazing read as hard bright trapezoids like the photos; shared M.oakFloor is untouched.
  { const fm = sunBoost(M.oakFloor.clone()); const fl = kit.floorFinish(root, 'family', fm, null, 0.0025); fl.userData.noCollide = true; }
  // soft contact shadows (multiply-darkening radial blobs) under the furniture: grounds the pieces in the fill light
  {
    const blobTex = kit.canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { srgb: false });
    const blobMat = (o) => new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const blob = (x, z, sx, sz, o = 0.45, ry = 0, y = 0.015) => { const g = new THREE.PlaneGeometry(sx, sz); g.rotateX(-Math.PI / 2); const m = mesh(root, g, blobMat(o), [x, y, z], [0, ry, 0], { shadow: false }); m.userData.noCollide = true; m.renderOrder = 2; return m; };
    blob(SOFA_XB - SOFA_D / 2, SOFA_Z0 + SOFA_L / 2, SOFA_D + 0.35, SOFA_L + 0.35, 0.55);
    blob(CT[0], CT[1], 1.05, 1.75, 0.5);
    blob(6.58, 15.39, 0.62, 0.62, 0.4);
    blob(4.86, 15.12, 1.05, 1.05, 0.5); blob(4.62, 18.68, 1.05, 1.05, 0.5);
    blob(6.86, Z1 - 0.22, 1.35, 0.5, 0.35, 0, 0.004);
    blob(3.25, 19.60, 0.55, 0.55, 0.4, 0, 0.004); blob(3.95, 19.72, 0.4, 0.4, 0.35, 0, 0.004);
  }

  kit.mergeStatic(root);
}
