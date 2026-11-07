// Piece: primary — Primary bedroom + rear balcony
// Owned rooms: primaryBed, balcony | Reference photos: p17, p18, p22
//
// Layout (from p17/p18 + plan openings): the vault ridge runs along z (gable on the rear wall z=16.70,
// which holds the bay window, the black dresser and the balcony door in the corner by the fireplace).
// Bed wall = x 15.39 (dark grasscloth), fireplace + framed TV = x 8.57 (grasscloth, black marble box).
export const piece = { rooms: ["primaryBed", "balcony"], photos: ["p17", "p18", "p22"] };
export const ownCeiling = ['primaryBed'];
export const views = {
  p17: { pos: [10.45, 4.52, 11.85], look: [14.35, 4.52, 16.7], fov: 76 },
  p18: { pos: [15.08, 4.60, 12.70], look: [9.0, 4.35, 15.4], fov: 70 },
  p22: { pos: [8.55, 4.95, 17.55], look: [13.82, 4.60, 20.42], fov: 65 },
};

// ---- room constants (metres)
const F = 3.35, PL = 6.10, RID = 8.05;            // floor, wall plate (vault spring), ridge
const X0 = 8.57, X1 = 15.39, Z0 = 11.75, Z1 = 16.70; // interior faces
const XC = (X0 + X1) / 2;
// bay window (opening pr-rear in plan.js: x 11.80–14.90 on the rear wall)
const BAY = { a: [11.80, 16.70], b: [12.55, 17.45], c: [14.15, 17.45], d: [14.90, 16.70], sill: 0.50, head: 2.30, soffit: 2.35, top: 2.45, t: 0.12 };
const DOOR = { x0: 8.955, x1: 9.905 }; // pr-bal-door

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M } = kit;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const physm = (o) => new THREE.MeshPhysicalMaterial(o);
  const add = (p, geo, mat, pos, rot, opt) => kit.add(p, geo, mat, pos, rot, opt);

  // ------------------------------------------------------------------ textures / materials
  const heightNormal = (size, draw, strength = 2, repeat) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size, size);
    const d = g.getImageData(0, 0, size, size).data; const H = (x, y) => d[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    return kit.canvasTex(size, size, (g2) => {
      const img = g2.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const nz = 1 / Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
        img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
      }
      g2.putImageData(img, 0, 0);
    }, { srgb: false, repeat });
  };

  // Grasscloth: horizontal sea-grass fibres, dark chocolate with tan slubs, 0.91 m panels (seam each tile).
  const grassDraw = (seed, colour) => (g, w, h) => {
    const r = kit.rng(seed);
    g.fillStyle = colour ? '#3a2c22' : '#404040'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 1 + Math.floor(r() * 2.2)) {
      let x = -r() * 200;
      while (x < w) {
        const len = 25 + r() * 260, v = r(); let c;
        if (colour) c = v < 0.45 ? [52 + r() * 20, 40 + r() * 14, 31 + r() * 10] : v < 0.85 ? [84 + r() * 54, 66 + r() * 40, 49 + r() * 30] : [24 + r() * 10, 19 + r() * 8, 15 + r() * 6];
        else { const k = v < 0.45 ? 60 + r() * 40 : v < 0.85 ? 140 + r() * 100 : 10 + r() * 30; c = [k, k, k]; }
        g.fillStyle = `rgba(${c.map(Math.round).join(',')},${0.55 + r() * 0.45})`;
        const th = 1 + (r() < 0.35 ? 1 : 0) + (r() < 0.08 ? 1 : 0);
        g.fillRect(x, y, len, th); g.fillRect(x - w, y, len, th);
        x += len + r() * 14;
      }
    }
    g.fillStyle = colour ? 'rgba(18,13,10,0.75)' : 'rgba(0,0,0,1)'; g.fillRect(0, 0, 2, h);
  };
  const PW = 0.91;
  const grassMat = std({
    map: kit.canvasTex(1024, 1024, grassDraw(21, true), { repeat: [1 / PW, 1 / PW] }),
    normalMap: heightNormal(512, grassDraw(21, false), 3, [1 / PW, 1 / PW]), normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.88, color: 0xffffff,
  });

  // Nero Marquina: near-black stone, white lightning veins.
  const marbleMap = kit.canvasTex(1024, 1024, (g, w, h) => {
    const r = kit.rng(77);
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 60 + r() * 220; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const k = 24 + r() * 16; gr.addColorStop(0, `rgba(${k},${k},${k},0.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const vein = (x, y, ang, len, width, alpha, depth) => {
      g.strokeStyle = `rgba(232,232,228,${alpha})`; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < len; s += 6) {
        ang += (r() - 0.5) * 0.5; x += Math.cos(ang) * 6; y += Math.sin(ang) * 6; g.lineTo(x, y);
        if (depth < 2 && r() < 0.025) { g.stroke(); vein(x, y, ang + (r() - 0.5) * 1.6, len * 0.35, width * 0.55, alpha * 0.8, depth + 1); g.strokeStyle = `rgba(232,232,228,${alpha})`; g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let i = 0; i < 7; i++) vein(r() * w * 0.3, r() * h, -0.45 + (r() - 0.5) * 0.4, 600 + r() * 600, 1.5 + r() * 2.5, 0.75, 0);
    for (let i = 0; i < 14; i++) vein(r() * w, r() * h, r() * 6.28, 120 + r() * 260, 0.6 + r() * 0.8, 0.45, 1);
  }, { repeat: [0.55, 0.55] });
  const marbleMat = physm({ map: marbleMap, roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });

  // black-stained oak (nightstands, dresser, bed base, bench frame)
  const ebony = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.6, 1.6] }), color: 0x2c2826, roughness: 0.5, normalScale: new THREE.Vector2(0.5, 0.5) });
  ebony.map.rotation = Math.PI / 2;
  const ebonyMatte = std({ color: 0x151413, roughness: 0.75 });
  const oakBeam = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [3, 0.6] }), color: 0xf0bf86, roughness: 0.62, normalScale: new THREE.Vector2(0.6, 0.6) });
  const fineNoise = kit.noiseNormal(256, 1.2, 32, 9); fineNoise.repeat.set(6, 6);
  const sheetMat = std({ color: 0xf3f1ec, roughness: 0.92, normalMap: fineNoise, normalScale: new THREE.Vector2(0.25, 0.25) });
  const hess = (rep) => kit.tex('assets/ph/hessian_380/hessian_380_nor_gl_1k.jpg', { repeat: rep });
  const coverMat = std({ color: 0xcdbfaa, roughness: 0.95, normalMap: hess([8, 8]), normalScale: new THREE.Vector2(0.4, 0.4) });
  const linenCream = std({ color: 0xe9e0cf, roughness: 0.95, normalMap: hess([6, 6]), normalScale: new THREE.Vector2(0.5, 0.5) });
  const taupeVel = std({ color: 0x8c7862, roughness: 0.85, normalMap: kit.tex('assets/ph/velour_velvet/velour_velvet_nor_gl_1k.jpg', { repeat: [3, 3] }), normalScale: new THREE.Vector2(0.6, 0.6) });
  const stripeMat = std({
    map: kit.canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6b5644'; g.fillRect(0, 0, w, h); const r = kit.rng(5); for (let y = 0; y < h; y += 12) { g.fillStyle = r() < 0.5 ? '#a89480' : '#3e3027'; g.fillRect(0, y, w, 4 + r() * 4); } }, { repeat: [1, 2] }),
    roughness: 0.9, normalMap: hess([4, 4]), normalScale: new THREE.Vector2(0.5, 0.5),
  });
  const throwMat = std({ color: 0x6c6250, roughness: 0.97, side: THREE.DoubleSide, normalMap: hess([10, 10]), normalScale: new THREE.Vector2(1, 1) });
  const boucleMaps = kit.pbrMaps('curly_teddy_natural', '1k', { repeat: [3, 3] });
  const boucle = std({ normalMap: boucleMaps.normalMap, roughnessMap: boucleMaps.roughnessMap, color: 0xe9e4da, roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) });
  const drapeMat = std({ color: 0xbcae98, roughness: 0.95, side: THREE.DoubleSide, normalMap: hess([5, 9]), normalScale: new THREE.Vector2(0.5, 0.5) });
  const shadeMat = std({ color: 0xf4f0e8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a2620, emissiveIntensity: 0.4 });
  const white = std({ color: 0xf2f2f0, roughness: 0.55 });
  const sageThrow = std({ color: 0x8f9a86, roughness: 0.97, side: THREE.DoubleSide, normalMap: hess([10, 10]) });

  // ------------------------------------------------------------------ ceiling: z-ridge vault, oak beam, fan, cans
  const vault = kit.vault(root, [X0, Z0, X1, Z1], 'z', PL, RID, M.ceilingWhite, M.paintWhite, 0, false);
  const ceilY = vault.userData.heightAt;
  const tri = (pts, normalHint, mat) => { // single-sided triangle facing normalHint
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); bg.computeVertexNormals();
    const n = new THREE.Vector3().fromBufferAttribute(bg.attributes.normal, 0);
    if (n.dot(new THREE.Vector3(...normalHint)) < 0) { bg.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], ...pts[2], ...pts[1]], 3)); bg.computeVertexNormals(); }
    const m = new THREE.Mesh(bg, mat); m.receiveShadow = true; m.castShadow = true; root.add(m); return m;
  };
  tri([[X0 - 0.02, PL - 0.01, Z1], [X1 + 0.02, PL - 0.01, Z1], [XC, RID + 0.02, Z1]], [0, 0, -1], M.paintWhite);
  tri([[X0 - 0.02, PL - 0.01, Z0], [X1 + 0.02, PL - 0.01, Z0], [XC, RID + 0.02, Z0]], [0, 0, 1], M.paintWhite);
  // the shell's interim roofs (hip over this block, garage wing, SW block) dip into the vault: hide their
  // soffit faces inside this room only (fragment discard), so the vault reads clean from inside.
  {
    const box = [X0 - 0.01, Z0 - 0.01, X1 + 0.01, BAY.c[1] + 0.2];
    const cache = new Map();
    ctx.shell?.root?.traverse(o => {
      const isSoffit = o.name.startsWith('soffit:'), isRoof = o.name.startsWith('roof:');
      if (!o.isMesh || !(isSoffit || isRoof)) return;
      const cond = isSoffit ? `vPrW.y > ${(F + 2.3).toFixed(3)}` : `vPrW.y < ${(PL + 0.03).toFixed(3)}`;
      let m = cache.get(o.material); if (!m) {
        m = o.material.clone();
        m.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrW;').replace('void main() {', `void main() {\n if (vPrW.x > ${box[0].toFixed(3)} && vPrW.x < ${box[2].toFixed(3)} && vPrW.z > ${box[1].toFixed(3)} && vPrW.z < ${box[3].toFixed(3)} && ${cond}) discard;`);
        };
        m.customProgramCacheKey = () => 'primary-roof-cut-' + (isSoffit ? 's' : 'r'); cache.set(o.material, m);
      }
      o.material = m;
    });
  }
  // ridge beam (single rough-sawn oak beam on the ridge)
  const BW = 0.20, BH = 0.30;
  add(root, kit.rbox(BW, BH, Z1 - Z0 + 0.02, 0.012), oakBeam, [XC, RID - BH / 2 + 0.06, (Z0 + Z1) / 2]);
  // recessed cans + speakers on the slopes
  {
    const s = (RID - PL) / (XC - X0);
    const can = new THREE.CircleGeometry(0.045, 24); can.rotateX(Math.PI / 2);
    const trim = new THREE.RingGeometry(0.045, 0.062, 24); trim.rotateX(Math.PI / 2);
    const spk = new THREE.CircleGeometry(0.105, 32); spk.rotateX(Math.PI / 2);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 0.35, roughness: 0.4 });
    const trimM = std({ color: 0xe8e6e1, roughness: 0.5 });
    const spkM = std({ color: 0xe9e8e4, roughness: 0.85, normalMap: kit.noiseNormal(128, 4, 48, 3), normalScale: new THREE.Vector2(0.4, 0.4) });
    const put = (geo, mat, x, z, lift = 0.004) => { const m = add(root, geo, mat, [x, ceilY(x, z) - lift, z], [0, 0, x < XC ? Math.atan(s) : -Math.atan(s)], { shadow: false }); return m; };
    for (const u of [0.85, 2.05]) for (const z of [12.45, 13.75, 15.05, 16.15]) for (const x of [X0 + u, X1 - u]) { put(can, lit, x, z, 0.005); put(trim, trimM, x, z, 0.006); }
    for (const z of [13.1, 15.6]) for (const x of [X0 + 1.45, X1 - 1.45]) put(spk, spkM, x, z, 0.005);
  }
  // ceiling fan on the beam (white, three long tapered blades)
  {
    const fanY = F + 3.45, beamBot = RID + 0.06 - BH;
    const fan = kit.group(root, [XC, fanY, 14.35]); fan.userData.keep = true;
    const fanWhite = std({ color: 0xf4f4f2, roughness: 0.45 });
    add(fan, kit.cyl(0.016, 0.016, beamBot - fanY), fanWhite, [0, (beamBot - fanY) / 2, 0]);
    add(fan, kit.lathe([[0.0, 0.05], [0.04, 0.05], [0.05, 0.06]]), fanWhite, [0, beamBot - fanY - 0.06, 0]);
    add(fan, kit.lathe([[0, -0.02], [0.07, -0.02], [0.105, 0.0], [0.115, 0.035], [0.09, 0.07], [0.03, 0.09], [0, 0.09]]), fanWhite, [0, -0.06, 0]);
    add(fan, kit.lathe([[0, -0.11], [0.04, -0.105], [0.065, -0.085], [0.075, -0.06], [0.075, -0.04], [0, -0.04]]), std({ color: 0xffffff, roughness: 0.3, emissive: 0xfff4e4, emissiveIntensity: 0.15 }), [0, -0.02, 0]);
    const rotor = kit.group(fan, [0, -0.03, 0]); rotor.userData.keep = true;
    const blade = kit.extrude([[0.09, -0.035], [0.30, -0.06], [0.70, -0.055], [0.80, -0.03], [0.82, 0.0], [0.80, 0.025], [0.70, 0.045], [0.30, 0.055], [0.09, 0.035]], 0.008, 0.002);
    blade.rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) { const b = add(rotor, blade, fanWhite, [0, 0, 0], [0, (i * Math.PI * 2) / 3 + 0.4, 0]); b.rotation.order = 'YXZ'; b.rotation.x = 0.12; }
    ctx.onUpdate((dt) => { if (!ctx.shot) rotor.rotation.y += dt * 2.2; });
  }

  // ------------------------------------------------------------------ walls: grasscloth, baseboards
  kit.wallPanel(root, [X1, Z0], [X1, Z1], F, PL, [-1, 0], grassMat, 0.003);   // bed wall
  kit.wallPanel(root, [X0, Z0], [X0, Z1], F, PL, [1, 0], grassMat, 0.003);    // fireplace wall
  kit.baseboards(root, [X0, Z0, X1, Z1], F, 0.11, 0.014, M.paintWhite, [
    { side: 'z1', from: DOOR.x0, to: DOOR.x1 }, { side: 'z1', from: BAY.a[0], to: BAY.d[0] },
    { side: 'z0', from: 12.125, to: 13.075 }, { side: 'x1', from: 12.475, to: 13.325 }, { side: 'x0', from: 12.50, to: Z1 },
  ]);

  // ------------------------------------------------------------------ bay window (projects 0.75 m onto the balcony)
  {
    const P = [BAY.a, BAY.b, BAY.c, BAY.d];
    const ext = M.extWhite;
    const fr = 0.05;
    for (let i = 0; i < 3; i++) {
      const p0 = P[i], p1 = P[i + 1]; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const ux = (p1[0] - p0[0]) / L, uz = (p1[1] - p0[1]) / L; const nx = -uz, nz = ux;
      const g = new THREE.Group(); g.position.set(p0[0], F, p0[1]);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)));
      root.add(g);
      const mats = [M.paintWhite, M.paintWhite, M.paintWhite, M.paintWhite, ext, M.paintWhite];
      const ext0 = i === 0 ? 0 : -0.06, ext1 = i === 2 ? 0 : 0.06; // overlap at the bay corners
      const wall = (y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(L - ext0 + ext1, y1 - y0, BAY.t), mats); m.position.set((L + ext0 + ext1) / 2, (y0 + y1) / 2, BAY.t / 2); m.castShadow = m.receiveShadow = true; g.add(m); };
      wall(0, BAY.sill); wall(BAY.head, BAY.top);
      // interior stool (window sill ledge)
      add(g, kit.rbox(L + 0.02, 0.035, BAY.t + 0.05, 0.008), M.paintWhite, [L / 2, BAY.sill + 0.017, BAY.t / 2 - 0.025]);
      // window: black frame + glass
      const h = BAY.head - BAY.sill, zc = BAY.t * 0.55, fd = 0.06;
      const bar = (w, hh, x, y) => add(g, new THREE.BoxGeometry(w, hh, fd), M.blackMetal, [x, y, zc]);
      bar(L, fr, L / 2, BAY.sill + fr / 2); bar(L, fr, L / 2, BAY.head - fr / 2); bar(fr, h, fr / 2, BAY.sill + h / 2); bar(fr, h, L - fr / 2, BAY.sill + h / 2);
      if (i === 1) bar(fr * 0.8, h, L / 2, BAY.sill + h / 2);
      const gl = add(g, new THREE.PlaneGeometry(L - fr, h - fr), M.glass, [L / 2, BAY.sill + h / 2, zc], [0, 0, 0], { shadow: false }); gl.renderOrder = 2;
      phys.boxLocal(g, L / 2, BAY.top / 2, BAY.t / 2, L / 2, BAY.top / 2, BAY.t / 2);
    }
    // bay floor (oak), soffit, roof cap
    const poly = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const inner = [BAY.a, BAY.b, BAY.c, BAY.d];
    const fl = new THREE.ShapeGeometry(poly(inner)); fl.rotateX(Math.PI / 2); // (x,z)->(x,0,z) facing -y; flip below
    { const p = fl.attributes.position; const uv = fl.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i)); }
    const flUp = fl.clone(); flUp.scale(1, -1, 1); flUp.computeVertexNormals(); // mirror -> faces up
    { const idx = flUp.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } flUp.computeVertexNormals(); }
    const flm = add(root, flUp, M.oakFloor, [0, F + 0.008, 0], [0, 0, 0], { shadow: false });
    const so = add(root, fl, M.ceilingWhite, [0, F + BAY.soffit, 0], [0, 0, 0], { shadow: false });
    // fix winding of soffit (must face down)
    { const n = new THREE.Vector3().fromBufferAttribute(fl.attributes.normal, 0); if (n.y > 0) { const idx = fl.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } fl.computeVertexNormals(); } }
    { const n = new THREE.Vector3().fromBufferAttribute(flUp.attributes.normal, 0); if (n.y < 0) { const idx = flUp.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } flUp.computeVertexNormals(); } }
    const outer = [[BAY.a[0] - 0.12, 17.0], [BAY.b[0] - 0.05, BAY.b[1] + BAY.t + 0.06], [BAY.c[0] + 0.05, BAY.c[1] + BAY.t + 0.06], [BAY.d[0] + 0.12, 17.0]];
    const capG = kit.extrude([...outer.map(([x, z]) => [x, -z]), [BAY.d[0] + 0.12, -16.95], [BAY.a[0] - 0.12, -16.95]], 0.07, 0.006);
    capG.rotateX(-Math.PI / 2);
    add(root, capG, M.blackMetal, [0, F + BAY.top, 0]);
    // drapery rod around the bay + four linen panels (p17: two at the ends, two at the angled corners)
    const rodY = F + BAY.soffit - 0.06, off = 0.11;
    const rodPts = [[BAY.a[0] - 0.35, rodY, Z1 - off], [BAY.a[0] + off * 0.4, rodY, Z1 - off], [BAY.b[0] + off * 0.4, rodY, BAY.b[1] - off], [BAY.c[0] - off * 0.4, rodY, BAY.c[1] - off], [BAY.d[0] - off * 0.4, rodY, Z1 - off], [BAY.d[0] + 0.35, rodY, Z1 - off]];
    for (let i = 0; i < rodPts.length - 1; i++) { const a = new THREE.Vector3(...rodPts[i]), b = new THREE.Vector3(...rodPts[i + 1]); const L = a.distanceTo(b); const m = add(root, kit.cyl(0.013, 0.013, L, 12), M.blackMetal, [(a.x + b.x) / 2, rodY, (a.z + b.z) / 2]); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); }
    for (const p of [rodPts[0], rodPts[5]]) add(root, kit.sphere(0.028, 16, 10), M.blackMetal, p);
    drape([BAY.a[0] - 0.22, Z1 - off], 0, 0.42, rodY);
    drape([BAY.b[0] + 0.05, BAY.b[1] - off - 0.02], Math.PI / 4, 0.40, rodY);
    drape([BAY.c[0] - 0.05, BAY.c[1] - off - 0.02], -Math.PI / 4, 0.40, rodY);
    drape([BAY.d[0] + 0.20, Z1 - off], 0, 0.40, rodY);
  }

  // Drapery panel: pleated linen hanging from rod height y to the floor, centred at c=[x,z], facing along ry.
  function drape(c, ry, w, yTop, mat = drapeMat) {
    const h = yTop - F - 0.01; const nf = Math.max(3, Math.round(w / 0.085));
    const g = new THREE.PlaneGeometry(w, h, nf * 8, 12); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const t = (h / 2 - y) / h; const k = (x / w + 0.5) * nf * Math.PI * 2; p.setZ(i, Math.sin(k) * (0.028 + 0.012 * t)); p.setX(i, x * (1 + 0.08 * t)); }
    g.computeVertexNormals();
    const m = add(root, g, mat, [c[0], F + 0.01 + h / 2, c[1]], [0, ry, 0]);
    // rings / header
    add(root, kit.rbox(w * 0.98, 0.07, 0.07, 0.02), mat, [c[0], yTop - 0.05, c[1]], [0, ry, 0]);
    return m;
  }

  // ------------------------------------------------------------------ faux windows on the bed wall (see notes: wall is interior in plan)
  const skyTex = kit.canvasTex(512, 512, (g, w, h) => {
    const r = kit.rng(3);
    const sk = g.createLinearGradient(0, 0, 0, h * 0.5); sk.addColorStop(0, '#8fb8dc'); sk.addColorStop(1, '#dbe6ec'); g.fillStyle = sk; g.fillRect(0, 0, w, h);
    const ridge = (y0, amp, col, seed) => { const rr = kit.rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, h); let y = y0; for (let x = 0; x <= w; x += 8) { y += (rr() - 0.5) * amp; y = Math.max(y0 - 40, Math.min(y0 + 40, y)); g.lineTo(x, y); } g.lineTo(w, h); g.fill(); };
    ridge(h * 0.42, 10, '#a9b9b4', 4); ridge(h * 0.52, 14, '#7f9672', 8); ridge(h * 0.64, 18, '#5d7748', 12);
    for (let i = 0; i < 140; i++) { const x = r() * w, y = h * 0.7 + r() * h * 0.3, rad = 10 + r() * 26; g.fillStyle = `rgb(${40 + r() * 40},${62 + r() * 40},${30 + r() * 20})`; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill(); }
  });
  function fauxWindow(z0, z1, sill, head, drapeSides) {
    const w = z1 - z0, h = head - sill, zc = (z0 + z1) / 2, x = X1;
    const bd = add(root, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTex, color: 0xf2f2f2 }), [x - 0.004, F + sill + h / 2, zc], [0, -Math.PI / 2, 0], { shadow: false });
    const fr = 0.05, fd = 0.07, xf = x - fd / 2;
    const bar = (dz, dy, cz, cy) => add(root, new THREE.BoxGeometry(fd, dy, dz), M.blackMetal, [xf, cy, cz]);
    bar(w, fr, zc, F + sill + fr / 2); bar(w, fr, zc, F + head - fr / 2); bar(fr, h, z0 + fr / 2, F + sill + h / 2); bar(fr, h, z1 - fr / 2, F + sill + h / 2);
    if (w > 0.7) bar(fr * 0.7, h, zc, F + sill + h / 2);
    const gl = add(root, new THREE.PlaneGeometry(w - fr, h - fr), M.glass, [x - 0.035, F + sill + h / 2, zc], [0, -Math.PI / 2, 0], { shadow: false }); gl.renderOrder = 2;
    // sill + rod + drapes
    add(root, kit.rbox(0.10, 0.03, w + 0.06, 0.006), M.paintWhite, [x - 0.05, F + sill - 0.015, zc]);
    const rodY = F + 2.62;
    if (drapeSides.length) {
      const za = z0 - 0.35, zb = z1 + 0.35; const m = add(root, kit.cyl(0.012, 0.012, zb - za, 12), M.blackMetal, [x - 0.13, rodY, (za + zb) / 2], [Math.PI / 2, 0, 0]);
      for (const zz of [za, zb]) { add(root, kit.sphere(0.026, 14, 10), M.blackMetal, [x - 0.13, rodY, zz]); add(root, kit.cyl(0.006, 0.006, 0.13, 8), M.blackMetal, [x - 0.065, rodY, zz], [0, 0, Math.PI / 2]); }
      for (const s of drapeSides) drape([x - 0.12, s < 0 ? z0 - 0.18 : z1 + 0.18], -Math.PI / 2, 0.36, rodY);
    }
  }
  fauxWindow(11.88, 12.62, 0.80, 2.45, [1]);
  fauxWindow(16.40, 16.66, 0.95, 2.45, []);
  drape([X1 - 0.12, 16.30], -Math.PI / 2, 0.18, F + 2.62);

  // ------------------------------------------------------------------ bed (headboard on the bed wall, foot towards the fireplace)
  const BZ = 14.72;
  const bed = kit.group(root, [X1, F, BZ], -Math.PI / 2, 'bed'); // local: x across (world +z), z from wall to foot (world -x)
  {
    add(bed, kit.rbox(2.06, 1.40, 0.07, 0.012), ebonyMatte, [0, 0.70, 0.045]);                       // black headboard frame
    add(bed, kit.cushion(1.96, 1.06, 0.08, 0.03, 0.012), linenCream, [0, 0.86, 0.10]);             // padded cream panel
    add(bed, kit.rbox(2.04, 0.27, 2.20, 0.03), ebonyMatte, [0, 0.215, 1.20]);                      // platform base
    add(bed, kit.box(1.86, 0.06, 2.0), ebonyMatte, [0, 0.03, 1.20]);                               // recessed plinth
    add(bed, kit.rbox(1.93, 0.27, 2.06, 0.07), sheetMat, [0, 0.475, 1.17]);                        // mattress
    add(bed, kit.cushion(2.06, 0.30, 2.06, 0.06, 0.03), sheetMat, [0, 0.505, 1.20]);               // white duvet
    add(bed, kit.cushion(2.14, 0.38, 1.02, 0.07, 0.025), coverMat, [0, 0.48, 1.76]);               // beige coverlet over foot
    add(bed, kit.cyl(0.025, 0.025, 1.98, 16), coverMat, [0, 0.67, 1.25], [0, 0, Math.PI / 2]);   // coverlet fold
    // pillows: euros, sleepers (static); accent pillows (dynamic)
    for (const s of [-0.48, 0.48]) add(bed, kit.cushion(0.66, 0.62, 0.17, 0.07, 0.06), sheetMat, [s, 0.98, 0.26], [-0.22, 0, 0]);
    for (const s of [-0.46, 0.46]) add(bed, kit.cushion(0.74, 0.46, 0.15, 0.07, 0.05), sheetMat, [s, 0.86, 0.42], [-0.45, 0, 0]);
    add(bed, kit.cushion(0.60, 0.34, 0.14, 0.05, 0.04), stripeMat, [0.06, 0.84, 0.60], [-0.35, 0, 0.02]);
  }
  phys.boxLocal(bed, 0, 0.35, 1.18, 1.05, 0.35, 1.12);
  phys.boxLocal(bed, 0, 0.70, 0.05, 1.03, 0.70, 0.06);
  const accents = [];
  for (const [s, rz] of [[-0.40, 0.08], [0.48, -0.06]]) {
    const pil = add(root, kit.cushion(0.46, 0.44, 0.10, 0.08, 0.07), taupeVel, [0, 0, 0]);
    pil.position.copy(bed.localToWorld(new THREE.Vector3(s, 0.94, 0.62))); pil.rotation.set(0, -Math.PI / 2, 0); pil.rotateX(-0.32); pil.rotateZ(rz);
    accents.push(pil);
  }
  // bench at the foot (cream upholstered top, black frame + slim legs) with a fringed knit throw
  const bench = kit.group(bed, [0, 0, 2.62], 0, 'bench');
  {
    add(bench, kit.cushion(1.42, 0.13, 0.44, 0.04, 0.02), linenCream, [0, 0.425, 0]);
    add(bench, kit.rbox(1.42, 0.05, 0.44, 0.01), ebonyMatte, [0, 0.345, 0]);
    for (const sx of [-0.68, 0.68]) for (const sz of [-0.19, 0.19]) add(bench, kit.box(0.035, 0.33, 0.035), ebonyMatte, [sx, 0.165, sz]);
    for (const sz of [-0.19, 0.19]) add(bench, kit.box(1.36, 0.025, 0.025), ebonyMatte, [0, 0.10, sz]);
    // throw: lies across the top from the back edge, hangs over the front with soft folds
    const tw = 0.62, tl = 1.0; const g = new THREE.PlaneGeometry(tw, tl, 30, 50); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), v = (tl / 2 - p.getY(i)); // v: 0..tl along the throw
      let y, z; const top = 0.50;
      if (v < 0.42) { y = top + 0.01 + 0.012 * Math.sin(x * 25 + v * 9); z = -0.20 + v; }
      else { const a = Math.min(1, (v - 0.42) / 0.12); const ang = a * Math.PI / 2; const rr = 0.05; const hang = Math.max(0, v - 0.54);
        y = top + 0.01 - rr * Math.sin(ang) - hang; z = 0.22 + rr * (1 - Math.cos(ang)) * 0 + rr * Math.sin(ang) * 0.6 + 0.035 * Math.sin(x * 14 + 0.6) * Math.min(1, hang * 4); }
      p.setXYZ(i, x * (1 + Math.max(0, v - 0.6) * 0.15), y, z);
    }
    g.computeVertexNormals(); add(bench, g, throwMat, [-0.12, 0, 0]);
    const fringe = kit.canvasTex(256, 32, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#5c5444'; c.lineWidth = 2; for (let x = 2; x < w; x += 5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 2, h); c.stroke(); } });
    const fr = add(bench, new THREE.PlaneGeometry(tw * 1.06, 0.06), std({ map: fringe, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 1, color: 0xffffff }), [-0.12, 0.51 - 0.05 - (1.0 - 0.54) - 0.03, 0.25], [0, 0, 0], { shadow: false });
  }
  phys.solidGroup(bench);

  // nightstands (black oak, three drawers, brushed-nickel bar pulls) + lamps
  function nightstand(zc, w) {
    const g = kit.group(root, [X1 - 0.24, F, zc], -Math.PI / 2); // local x across (world +z), z out from wall
    const H = 0.66, D = 0.46;
    add(g, kit.rbox(w, H - 0.06, D, 0.012), ebony, [0, 0.06 + (H - 0.06) / 2, 0]);
    add(g, kit.box(w - 0.08, 0.06, D - 0.08), ebonyMatte, [0, 0.03, -0.02]);
    for (let i = 0; i < 3; i++) {
      const y = 0.06 + 0.012 + (i + 0.5) * ((H - 0.084) / 3);
      add(g, kit.box(w - 0.04, 0.004, 0.004), ebonyMatte, [0, y - (H - 0.084) / 6, D / 2 + 0.001]);
      add(g, kit.rbox(0.20, 0.014, 0.02, 0.006), M.brushedNickel, [0, y + 0.02, D / 2 + 0.012]);
    }
    phys.solidGroup(g);
    return g;
  }
  nightstand(13.33, 0.66);
  nightstand(16.08, 0.54);
  function lamp(x, z, tall) {
    const g = kit.group(root, [x, F + 0.66, z]);
    const bh = tall ? 0.36 : 0.30;
    add(g, kit.lathe([[0, 0], [0.07, 0], [0.072, 0.012], [0.055, 0.02], [0.05, bh], [0.012, bh + 0.01], [0.008, bh + 0.08], [0, bh + 0.08]]), M.brass, [0, 0, 0]);
    const sh = new THREE.CylinderGeometry(0.19, 0.20, 0.26, 40, 1, true); add(g, sh, shadeMat, [0, bh + 0.17, 0]);
    add(g, kit.sphere(0.03, 12, 8), M.emissiveWarm, [0, bh + 0.12, 0], [0, 0, 0], { shadow: false });
    return g;
  }
  lamp(X1 - 0.26, 13.33, false);
  lamp(X1 - 0.26, 16.08, true);

  // ------------------------------------------------------------------ rug (faded vintage, grey-mauve with border)
  {
    const rugTex = kit.canvasTex(1024, 768, (g, w, h) => {
      const r = kit.rng(31);
      g.fillStyle = '#675b55'; g.fillRect(0, 0, w, h);
      const b = 40; g.strokeStyle = '#4f4642'; g.lineWidth = 34; g.strokeRect(b, b, w - 2 * b, h - 2 * b);
      g.strokeStyle = 'rgba(150,138,128,0.18)'; g.lineWidth = 4; g.strokeRect(b + 24, b + 24, w - 2 * b - 48, h - 2 * b - 48); g.strokeRect(b - 20, b - 20, w - 2 * b + 40, h - 2 * b + 40);
      for (let i = 0; i < 260; i++) { const x = b + 30 + r() * (w - 2 * b - 60), y = b + 30 + r() * (h - 2 * b - 60); g.fillStyle = `rgba(${r() < 0.5 ? '120,98,104' : '150,140,128'},${0.15 + r() * 0.2})`; g.save(); g.translate(x, y); g.rotate(r() * 6.3); g.fillRect(-14, -3, 28 + r() * 30, 6); g.restore(); }
      g.save(); g.translate(w / 2, h / 2); for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(${k % 2 ? '140,128,122' : '90,78,80'},0.18)`; g.lineWidth = 10; g.beginPath(); for (let a = 0; a <= 6.3; a += 0.1) { const rr = (160 - k * 40) * (1 + 0.18 * Math.sin(a * 8)); g.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); } g.closePath(); g.stroke(); } g.restore();
      const img = g.getImageData(0, 0, w, h); for (let i = 0; i < img.data.length; i += 4) { const y = (i / 4 / w) | 0; const n = (r() - 0.5) * 46 + (r() < 0.03 ? 40 : 0) + ((y * 7 + (r() * 3 | 0)) % 9 < 1 ? -18 : 0); img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } g.putImageData(img, 0, 0);
    });
    const rugMat = std({ map: rugTex, roughness: 0.98, normalMap: kit.tex('assets/ph/hessian_380/hessian_380_nor_gl_1k.jpg', { repeat: [14, 10] }), normalScale: new THREE.Vector2(0.35, 0.35) });
    const RW = 4.0, RD = 3.0; const g = new THREE.PlaneGeometry(RW, RD); g.rotateX(-Math.PI / 2);
    add(root, g, rugMat, [12.25, F + 0.012, BZ], [0, 0, 0], { shadow: false });
    add(root, kit.box(RW, 0.01, RD), std({ color: 0x5e544c, roughness: 1 }), [12.25, F + 0.006, BZ], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ boucle chairs + side table in front of the bay
  function barrelChair(x, z, ry, withThrow) {
    const g = kit.group(root, [x, F, z], ry);
    add(g, kit.lathe([[0, 0.02], [0.30, 0.02], [0.36, 0.06], [0.375, 0.16], [0.37, 0.30], [0.34, 0.34], [0, 0.34]], 40), boucle, [0, 0, 0]);
    add(g, kit.cushion(0.50, 0.12, 0.46, 0.06, 0.03), boucle, [0, 0.39, 0.06]);
    const back = new THREE.TorusGeometry(0.30, 0.10, 18, 40, Math.PI * 1.2); back.rotateX(Math.PI / 2); back.rotateY(Math.PI * 0.4 + Math.PI); back.scale(1, 1.9, 1);
    add(g, back, boucle, [0, 0.47, -0.02]);
    for (const a of [0, 1.2 * Math.PI]) { const ang = Math.PI * 0.4 + Math.PI + a; } // (arms are the torus ends)
    for (const s of [-1, 1]) add(g, kit.sphere(0.10, 20, 14), boucle, [s * 0.24, 0.47, 0.17], [0, 0, 0]);
    if (withThrow) { const t = new THREE.PlaneGeometry(0.42, 0.55, 12, 14); const p = t.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, 0.03 * Math.sin(p.getX(i) * 18) + (yy < 0 ? -yy * 0.9 : 0)); } t.computeVertexNormals(); add(g, t, sageThrow, [-0.10, 0.60, -0.24], [-0.6, 0.3, 0.1]); }
    phys.solidGroup(g); return g;
  }
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  barrelChair(14.15, 16.12, face(14.15, 16.12, 12.6, 15.0), true);
  barrelChair(12.45, 16.05, face(12.45, 16.05, 13.6, 14.8), false);
  {
    const t = kit.group(root, [13.30, F, 16.36]);
    add(t, kit.lathe([[0, 0], [0.16, 0], [0.16, 0.025], [0.05, 0.04], [0.045, 0.47], [0.20, 0.475], [0.20, 0.50], [0, 0.50]], 40), M.matteBlack, [0, 0, 0]);
    phys.solidGroup(t);
    const book = add(root, kit.rbox(0.20, 0.035, 0.26, 0.004), std({ color: 0x8aa39a, roughness: 0.8 }), [13.31, F + 0.52, 16.36], [0, 0.3, 0]);
    phys.dynamic(book, { mass: 0.5 });
  }

  // ------------------------------------------------------------------ fireplace wall: black marble box, firebox, niche, frame TV
  {
    const D = 0.40, H = 1.12, s0 = 12.50, s1 = Z1;
    const fb = [15.30, 16.30], ni = [13.55, 14.85], oy0 = 0.42, oy1 = 0.86;
    // extrude in (u=-z, v=y), depth along +x after rotation
    const outline = [[-s1, 0], [-s0, 0], [-s0, H], [-s1, H]];
    const holes = [[[-fb[1], oy0], [-fb[1], oy1], [-fb[0], oy1], [-fb[0], oy0]], [[-ni[1], oy0], [-ni[1], oy1], [-ni[0], oy1], [-ni[0], oy0]]];
    const g = kit.extrude(outline, D, 0, holes); g.rotateY(Math.PI / 2);
    add(root, g, marbleMat, [X0, F, 0]);
    phys.boxAABB([X0, F, s0], [X0 + D, F + H, s1]);
    // firebox: herringbone refractory back, black sides, logs, glass
    const herring = kit.canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#1a1817'; c.fillRect(0, 0, w, h); const r = kit.rng(2); for (let y = -64; y < h + 64; y += 22) for (let x = 0; x < w; x += 44) { for (const s of [1, -1]) { const v = 52 + r() * 30; c.fillStyle = `rgb(${v},${v - 4},${v - 8})`; c.save(); c.translate(x + (s > 0 ? 0 : 22), y); c.rotate(s * Math.PI / 4); c.fillRect(0, 0, 30, 10); c.restore(); } } }, { repeat: [3, 1.5] });
    add(root, new THREE.PlaneGeometry(fb[1] - fb[0], oy1 - oy0), std({ map: herring, roughness: 0.9 }), [X0 + 0.04, F + (oy0 + oy1) / 2, (fb[0] + fb[1]) / 2], [0, Math.PI / 2, 0]);
    add(root, kit.box(0.30, 0.02, fb[1] - fb[0]), M.matteBlack, [X0 + 0.18, F + oy0 + 0.01, (fb[0] + fb[1]) / 2]);
    const logM = std({ color: 0x4a4038, roughness: 0.95, normalMap: fineNoise, normalScale: new THREE.Vector2(1, 1) });
    add(root, kit.cyl(0.045, 0.05, 0.75, 14), logM, [X0 + 0.16, F + oy0 + 0.07, (fb[0] + fb[1]) / 2], [Math.PI / 2, 0, 0.05]);
    add(root, kit.cyl(0.04, 0.045, 0.6, 14), logM, [X0 + 0.24, F + oy0 + 0.12, (fb[0] + fb[1]) / 2 + 0.05], [Math.PI / 2, 0.4, 0]);
    add(root, kit.cyl(0.035, 0.04, 0.5, 14), logM, [X0 + 0.12, F + oy0 + 0.13, (fb[0] + fb[1]) / 2 - 0.08], [Math.PI / 2, -0.5, 0]);
    const fg = add(root, new THREE.PlaneGeometry(fb[1] - fb[0], oy1 - oy0), M.glass, [X0 + D - 0.02, F + (oy0 + oy1) / 2, (fb[0] + fb[1]) / 2], [0, Math.PI / 2, 0], { shadow: false }); fg.renderOrder = 2;
    add(root, new THREE.PlaneGeometry(ni[1] - ni[0], oy1 - oy0), M.matteBlack, [X0 + 0.02, F + (oy0 + oy1) / 2, (ni[0] + ni[1]) / 2], [0, Math.PI / 2, 0]);
    // frame TV (oak frame, noir film still recreated as a simple painting)
    const tvW = 1.86, tvH = 1.06, tz = 14.90, ty = F + H + 0.20 + tvH / 2;
    const noir = kit.canvasTex(1024, 584, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a5a58'); gr.addColorStop(0.55, '#2c2c2b'); gr.addColorStop(1, '#121212'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const r = kit.rng(9); for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(200,200,190,${0.05 + r() * 0.1})`; c.fillRect(600 + r() * 380, 300 + r() * 160, 3, 3); }
      c.fillStyle = '#1c1c1c'; c.fillRect(560, 280, 440, 200); // hangar
      c.fillStyle = '#0d0d0d'; c.beginPath(); c.moveTo(640, 120); c.lineTo(820, 100); c.lineTo(760, 112); c.lineTo(900, 130); c.lineTo(760, 124); c.closePath(); c.fill(); // plane
      const fig = (x, y, s) => { c.fillStyle = '#0a0a0a'; c.beginPath(); c.ellipse(x, y, 38 * s, 10 * s, 0, 0, 6.3); c.fill(); c.fillRect(x - 22 * s, y - 32 * s, 44 * s, 30 * s); c.beginPath(); c.ellipse(x, y + 22 * s, 20 * s, 26 * s, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(x - 62 * s, h); c.lineTo(x - 50 * s, y + 60 * s); c.quadraticCurveTo(x, y + 36 * s, x + 50 * s, y + 60 * s); c.lineTo(x + 66 * s, h); c.fill(); c.fillStyle = 'rgba(140,140,130,0.5)'; c.fillRect(x - 3 * s, y + 70 * s, 6 * s, 140 * s); };
      fig(470, 200, 1.6); fig(200, 300, 1.0);
    });
    const tv = kit.group(root, [X0 + 0.04, ty, tz], Math.PI / 2);
    add(tv, kit.rbox(tvW + 0.08, tvH + 0.08, 0.05, 0.006), std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xe7c597, roughness: 0.55 }), [0, 0, 0]);
    add(tv, new THREE.PlaneGeometry(tvW, tvH), std({ map: noir, roughness: 0.6, emissiveMap: noir, emissive: 0xffffff, emissiveIntensity: 0.25 }), [0, 0, 0.0255], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ rear wall: black dresser, orchid, green abstract, door shade
  {
    const g = kit.group(root, [10.62, F, Z1 - 0.25], Math.PI); // local +z faces the room (-z world)
    const W = 1.18, H = 0.84, D = 0.50;
    add(g, kit.rbox(W, H - 0.07, D, 0.01), ebony, [0, 0.07 + (H - 0.07) / 2, 0]);
    add(g, kit.box(W - 0.06, 0.07, D - 0.06), ebonyMatte, [0, 0.035, -0.02]);
    for (let r = 0; r < 3; r++) { const y = 0.07 + ((H - 0.07) * (r + 1)) / 3; if (r < 2) add(g, kit.box(W - 0.02, 0.005, 0.006), ebonyMatte, [0, y, D / 2 + 0.001]); }
    add(g, kit.box(0.005, H - 0.09, 0.006), ebonyMatte, [0, 0.07 + (H - 0.07) / 2, D / 2 + 0.001]);
    phys.solidGroup(g);
    // orchid (white phalaenopsis in a white cachepot)
    const o = kit.group(root, [10.22, F + H, Z1 - 0.24]);
    add(o, kit.lathe([[0, 0], [0.06, 0], [0.07, 0.11], [0.065, 0.12], [0, 0.12]]), white, [0, 0, 0]);
    const leafM = std({ color: 0x3f5a2e, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) { const lf = add(o, kit.sphere(0.06, 12, 6), leafM, [0, 0.13, 0], [0, i * 1.6, 0]); lf.scale.set(1.6, 0.18, 0.6); lf.position.x = Math.cos(i * 1.6) * 0.07; lf.position.z = -Math.sin(i * 1.6) * 0.07; }
    const stem = kit.tube([[0, 0.12, 0], [0.01, 0.35, 0.02], [0.05, 0.48, 0.04], [0.12, 0.50, 0.06]], 0.004, 24); add(o, stem, std({ color: 0x4d5a36, roughness: 0.6 }), [0, 0, 0]);
    const petal = std({ color: 0xfbfaf6, roughness: 0.6, side: THREE.DoubleSide });
    for (const [px, py, pz] of [[0.02, 0.40, 0.03], [0.05, 0.46, 0.05], [0.09, 0.49, 0.06], [0.13, 0.48, 0.07], [0.0, 0.33, 0.02]]) { const fl = add(o, kit.sphere(0.03, 10, 6), petal, [px, py, pz]); fl.scale.set(1, 1, 0.35); }
    const bowl = add(root, kit.lathe([[0, 0], [0.05, 0], [0.075, 0.03], [0.08, 0.05], [0.072, 0.05], [0.045, 0.012], [0, 0.012]]), std({ color: 0x8a7a5a, roughness: 0.4, metalness: 0.6 }), [11.0, F + H, Z1 - 0.24]);
    phys.dynamic(bowl, { mass: 0.4 });
    // green abstract painting
    const art = kit.canvasTex(512, 400, (c, w, h) => { const r = kit.rng(44); c.fillStyle = '#16564c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${10 + r() * 50},${70 + r() * 70},${60 + r() * 50},${0.2 + r() * 0.3})`; c.save(); c.translate(r() * w, r() * h); c.rotate((r() - 0.5) * 0.8); c.fillRect(-40, -6, 60 + r() * 90, 8 + r() * 14); c.restore(); } });
    const pg = kit.group(root, [10.62, F + 1.62, Z1 - 0.02], Math.PI);
    add(pg, kit.box(0.90, 0.70, 0.035), std({ color: 0xc9b48a, roughness: 0.5, metalness: 0.3 }), [0, 0, 0]);
    add(pg, new THREE.PlaneGeometry(0.87, 0.67), std({ map: art, roughness: 0.85 }), [0, 0, 0.018]);
    // black roller-shade cassette over the balcony door
    add(root, kit.box(DOOR.x1 - DOOR.x0 + 0.08, 0.11, 0.12), M.matteBlack, [(DOOR.x0 + DOOR.x1) / 2, F + 2.40 + 0.055, Z1 - 0.06]);
  }

  // dynamic accent pillows
  for (const p of accents) phys.dynamic(p, { mass: 0.6 });

  // ================================================================== balcony
  {
    const [bx0, bz0, bx1, bz1] = ctx.plan.ROOMS.balcony.rect; const B = F;
    // black porcelain tile, light grout (0.6 x 0.3 m)
    const tileTex = kit.canvasTex(512, 512, (c, w, h) => { const r = kit.rng(17); c.fillStyle = '#7a7a76'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 22 + r() * 6; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(i * 128 + 1.5, j * 128 + 1.5, 125, 125); } }, { repeat: [1 / 1.2, 1 / 1.2] });
    const tileMat = kit.outdoor(std({ map: tileTex, roughness: 0.45, envMapIntensity: 0.35 }));
    kit.floorFinish(root, [bx0, bz0, bx1, bz1], tileMat, B, 0.006);
    // dark fascia band round the slab edge
    const fasc = kit.outdoor(std({ color: 0x1e1e1e, roughness: 0.6 }));
    add(root, kit.box(bx1 - bx0 + 0.04, 0.32, 0.04), fasc, [(bx0 + bx1) / 2, B - 0.15, bz1 + 0.02]);
    add(root, kit.box(0.04, 0.32, bz1 - bz0), fasc, [bx0 - 0.02, B - 0.15, (bz0 + bz1) / 2]);
    // black metal railing: top rail, bottom rail, posts, square pickets (instanced)
    const railM = kit.outdoor(std({ color: 0x151515, roughness: 0.5, metalness: 0.5 }));
    const RH = 1.07, inset = 0.06;
    const runs = [[[bx0 + inset, bz1 - inset], [bx1, bz1 - inset]], [[bx0 + inset, bz0 + 0.30], [bx0 + inset, bz1 - inset]]];
    const pick = new THREE.BoxGeometry(0.015, RH - 0.12, 0.015); const picks = [];
    for (const [a, b] of runs) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const ry = Math.atan2(ux, uz);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      add(root, kit.box(0.05, 0.035, L + 0.05), railM, [mid[0], B + RH, mid[1]], [0, ry, 0]);
      add(root, kit.box(0.035, 0.03, L), railM, [mid[0], B + 0.08, mid[1]], [0, ry, 0]);
      for (let s = 0; s <= L + 0.01; s += L / Math.ceil(L / 1.8)) add(root, kit.box(0.05, RH, 0.05), railM, [a[0] + ux * s, B + RH / 2, a[1] + uz * s]);
      for (let s = 0.10; s < L - 0.05; s += 0.10) picks.push([a[0] + ux * s, B + 0.06 + (RH - 0.12) / 2 + 0.02, a[1] + uz * s]);
      phys.boxAABB([Math.min(a[0], b[0]) - 0.03, B, Math.min(a[1], b[1]) - 0.03], [Math.max(a[0], b[0]) + 0.03, B + RH + 0.02, Math.max(a[1], b[1]) + 0.03]);
    }
    const im = new THREE.InstancedMesh(pick, railM, picks.length); const mm = new THREE.Matrix4();
    picks.forEach((p, i) => im.setMatrixAt(i, mm.makeTranslation(p[0], p[1], p[2]))); im.castShadow = true; im.receiveShadow = true; root.add(im);
    // wall lanterns (black box lantern, seeded glass, warm bulb) on the rear wall
    const lglass = std({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    for (const lx of [8.62, 10.25, 15.05]) {
      const g = kit.group(root, [lx, B + 1.95, 17.0]);
      add(g, kit.box(0.14, 0.24, 0.02), railM, [0, 0, 0.01]);
      add(g, kit.box(0.03, 0.03, 0.10), railM, [0, 0.05, 0.06]);
      const body = kit.group(g, [0, 0, 0.17]);
      add(body, kit.box(0.20, 0.025, 0.20), railM, [0, 0.165, 0]); add(body, kit.box(0.17, 0.02, 0.17), railM, [0, -0.165, 0]);
      add(body, kit.lathe([[0, 0], [0.11, 0], [0.04, 0.05], [0, 0.06]], 4), railM, [0, 0.175, 0], [0, Math.PI / 4, 0]);
      for (const sx of [-0.08, 0.08]) for (const sz of [-0.08, 0.08]) add(body, kit.box(0.015, 0.31, 0.015), railM, [sx, 0, sz]);
      add(body, kit.box(0.16, 0.30, 0.16), lglass, [0, 0, 0], [0, 0, 0], { shadow: false });
      add(body, kit.sphere(0.025, 12, 8), M.emissiveWarm, [0, -0.02, 0], [0, 0, 0], { shadow: false });
    }
  }

  kit.mergeStatic(root);
}
