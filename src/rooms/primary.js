// Piece: primary — Primary bedroom + rear balcony
// Owned rooms: primaryBed, balcony | Reference photos: p17, p18, p22
//
// Layout (from p17/p18 + plan openings): the vault ridge runs along z (gable on the rear wall z=16.70,
// which holds the bay window, the black dresser and the balcony door in the corner by the fireplace).
// Bed wall = x 15.39 (dark grasscloth), fireplace + framed TV = x 8.57 (grasscloth, black marble box).
import { vintageRug } from './living/vintageRug.js';
export const piece = { rooms: ["primaryBed", "balcony"], photos: ["p17", "p18", "p22"] };
export const ownCeiling = ['primaryBed'];
export const views = {
  // p17/p18 fitted to photo landmarks (bed-wall corner, nightstands, bay jambs, marble end, door, dresser)
  p17: { pos: [9.30, 4.42, 11.90], look: [13.21, 4.66, 15.01], fov: 58 },
  p18: { pos: [14.30, 4.43, 11.95], look: [11.65, 4.60, 16.19], fov: 68 },
  // p22: from the open (family-room) end of the balcony, looking along it to the bath door, turned toward the canyon
  p22: { pos: [8.50, 4.90, 18.70], look: [13.26, 4.62, 20.25], fov: 50 },
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
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 60 + r() * 220; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const k = 24 + r() * 16; gr.addColorStop(0, `rgba(${k},${k},${k},0.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const vein = (x, y, ang, len, width, alpha, depth) => {
      g.strokeStyle = `rgba(232,232,228,${alpha})`; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < len; s += 6) {
        ang += (r() - 0.5) * 0.5; x += Math.cos(ang) * 6; y += Math.sin(ang) * 6; g.lineTo(x, y);
        if (depth < 2 && r() < 0.025) { g.stroke(); vein(x, y, ang + (r() - 0.5) * 1.6, len * 0.35, width * 0.55, alpha * 0.8, depth + 1); g.strokeStyle = `rgba(232,232,228,${alpha})`; g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let i = 0; i < 7; i++) vein(r() * w * 0.3, r() * h, -0.45 + (r() - 0.5) * 0.4, 600 + r() * 600, 2.2 + r() * 3, 0.85, 0);
    for (let i = 0; i < 14; i++) vein(r() * w, r() * h, r() * 6.28, 120 + r() * 260, 0.6 + r() * 0.8, 0.45, 1);
  }, { repeat: [0.55, 0.55] });
  const marbleMat = physm({ map: marbleMap, roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });

  // black-stained oak (nightstands, dresser, bed base, bench frame)
  const ebony = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.6, 1.6] }), color: 0x2c2826, roughness: 0.5, normalScale: new THREE.Vector2(0.5, 0.5) });
  ebony.map.rotation = Math.PI / 2;
  const ebonyMatte = std({ color: 0x151413, roughness: 0.75 });
  const oakBeam = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [3, 0.6] }), color: 0xffd9a8, roughness: 0.62, normalScale: new THREE.Vector2(0.6, 0.6) }); /* p17: light honey oak, not dark walnut */
  const fineNoise = kit.noiseNormal(256, 1.2, 32, 9); fineNoise.repeat.set(6, 6);
  const hess = (rep) => kit.tex('assets/ph/hessian_380/hessian_380_nor_gl_1k.jpg', { repeat: rep });
  const fab = kit.fabric;
  const sheetMat = fab.cotton('#f2f0ea', { scale: 5, normalScale: 0.35 });               // white duvet / sheets
  const pillowWhite = fab.cotton('#f4f2ed', { scale: 3, normalScale: 0.3 });
  const coverMat = fab.linen('#cdbca2', { scale: 6 });                                      // tan throw at the foot
  const linenCream = fab.linen('#e6dccb', { scale: 3 });                                    // headboard + bench
  const taupeVel = fab.velvet('#8a7560', { scale: 2 });
  const brownBoucle = fab.boucle('#6e5846', { scale: 8 });
  const stripeMat = std({
    map: kit.canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6b5644'; g.fillRect(0, 0, w, h); const r = kit.rng(5); for (let y = 0; y < h; y += 12) { g.fillStyle = r() < 0.5 ? '#a89480' : '#3e3027'; g.fillRect(0, y, w, 4 + r() * 4); } }, { repeat: [1, 2] }),
    roughness: 0.9, normalMap: hess([4, 4]), normalScale: new THREE.Vector2(0.5, 0.5),
  });
  const throwMat = fab.knit('#77695a', { scale: 4, side: THREE.DoubleSide });              // grey-brown knit throw (bench)
  const boucle = fab.boucle('#ece6dc', { scale: 10 });
  const drapeMat = fab.linen('#c9bba5', { scale: 5, side: THREE.DoubleSide });
  const shadeMat = std({ color: 0xf4f0e8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a2620, emissiveIntensity: 0.4 });
  const white = std({ color: 0xf2f2f0, roughness: 0.55 });

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
  // Roof parts from the shell / exterior piece (hip ends, soffits, ridge caps, fascia) dip below this vault.
  // A shader discard isn't enough (the AO depth pass still sees them and draws dark lines), so their
  // triangles are clipped against this room's volume under the vault (a convex region: 4 walls, a floor
  // plane at F+2.6 and the two vault slopes) and the parts inside are dropped. Runs over the first frames
  // because the exterior piece swaps roof geometry after this build; each geometry is clipped once.
  {
    const e = 0.004, run = XC - X0, k = (RID - PL) / run, lift = 0.03;
    // half-spaces n·p <= d describe the region to remove
    const H = [[[-1, 0, 0], -(X0 + e)], [[1, 0, 0], X1 - e], [[0, 0, -1], -(Z0 + e)], [[0, 0, 1], Z1 - e], [[0, -1, 0], -(F + 2.6)],
      // y <= RID + lift - k*|x - XC|  ->  y + k*(x-XC) <= RID+lift  and  y - k*(x-XC) <= RID+lift
      [[k, 1, 0], RID + lift + k * XC], [[-k, 1, 0], RID + lift - k * XC]];
    const box = new THREE.Box3(new THREE.Vector3(X0, F + 2.6, Z0), new THREE.Vector3(X1, RID + 0.05, Z1));
    const done = new WeakSet(), swap = new WeakMap(); let frames = 0;
    const clipGeo = (geo, mw) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      const names = Object.keys(g.attributes).filter(n => g.attributes[n].itemSize <= 4 && !g.attributes[n].isInterleavedBufferAttribute);
      const A = names.map(n => g.attributes[n]); const P = g.attributes.position;
      const wp = new THREE.Vector3(); const out = names.map(() => []); let changed = false;
      const vert = (i) => { wp.fromBufferAttribute(P, i).applyMatrix4(mw); return { w: [wp.x, wp.y, wp.z], a: A.map(at => { const r = []; for (let c = 0; c < at.itemSize; c++) r.push(at.array[i * at.itemSize + c]); return r; }) }; };
      const lerp = (p, q, t) => ({ w: p.w.map((v, i) => v + (q.w[i] - v) * t), a: p.a.map((arr, j) => arr.map((v, i) => v + (q.a[j][i] - v) * t)) });
      const side = (v, [n, d]) => n[0] * v.w[0] + n[1] * v.w[1] + n[2] * v.w[2] - d; // <=0 inside
      const emit = (poly) => { for (let i = 1; i < poly.length - 1; i++) for (const v of [poly[0], poly[i], poly[i + 1]]) v.a.forEach((arr, j) => out[j].push(...arr)); };
      const W = new Float32Array(9);
      const copyTri = (t) => { for (let j = 0; j < A.length; j++) { const at = A[j], sz = at.itemSize; for (let i = t * sz; i < (t + 3) * sz; i++) out[j].push(at.array[i]); } };
      for (let t = 0; t < P.count; t += 3) {
        for (let k = 0; k < 3; k++) { wp.fromBufferAttribute(P, t + k).applyMatrix4(mw); W[k * 3] = wp.x; W[k * 3 + 1] = wp.y; W[k * 3 + 2] = wp.z; }
        let outside = false; // fast path: all three vertices beyond one bounding plane -> keep as is
        for (const [nn, d] of H) { if (nn[0] * W[0] + nn[1] * W[1] + nn[2] * W[2] > d && nn[0] * W[3] + nn[1] * W[4] + nn[2] * W[5] > d && nn[0] * W[6] + nn[1] * W[7] + nn[2] * W[8] > d) { outside = true; break; } }
        if (outside) { copyTri(t); continue; }
        let cur = [vert(t), vert(t + 1), vert(t + 2)]; const kept = [];
        for (const h of H) {
          const sd = cur.map(v => side(v, h));
          if (sd.every(x => x <= 0)) continue;                       // fully inside this half-space
          if (sd.every(x => x >= 0)) { kept.push(cur); cur = null; break; } // fully outside the region -> keep
          const inP = [], outP = [];
          for (let i = 0; i < cur.length; i++) {
            const p = cur[i], q = cur[(i + 1) % cur.length], sp = sd[i], sq = sd[(i + 1) % cur.length];
            if (sp <= 0) inP.push(p); if (sp >= 0) outP.push(p);
            if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const x = lerp(p, q, sp / (sp - sq)); inP.push(x); outP.push(x); }
          }
          if (outP.length >= 3) kept.push(outP);
          cur = inP.length >= 3 ? inP : null; if (!cur) break;
        }
        if (cur) changed = true; // the part left in `cur` lies inside the region: dropped
        for (const poly of kept) emit(poly);
      }
      if (!changed) return null;
      const ng = new THREE.BufferGeometry();
      names.forEach((n, j) => {
        const at = g.attributes[n]; const arr = new Float32Array(out[j]); // attribute values stay in local space
        ng.setAttribute(n, new THREE.BufferAttribute(arr, at.itemSize, at.normalized));
      });
      ng.computeBoundingBox(); ng.computeBoundingSphere(); return ng;
    };
    const apply = () => {
      if (frames++ > 60) return;
      ctx.scene.updateMatrixWorld();
      ctx.scene.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.dynamic) return;
        if (swap.has(o.geometry)) { const sw = swap.get(o.geometry); if (sw.mw.equals(o.matrixWorld)) o.geometry = sw.ng; return; } // shared geometry (roof + soffit)
        if (done.has(o.geometry) || o.geometry.attributes.position?.isInterleavedBufferAttribute) return;
        if (Array.isArray(o.material) || o.morphTargetInfluences || !o.geometry.attributes.position || o.name === 'water' || o.name === 'avatar') return; // anything else (roofs, soffits, fascia, ridge caps, trim) may be clipped
        let p = o; while (p) { if (p === root) return; p = p.parent; }
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (!new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(box)) { done.add(o.geometry); return; }
        const old = o.geometry; let ng = null; try { ng = clipGeo(old, o.matrixWorld); } catch (e) { ng = null; } done.add(old);
        if (ng) { done.add(ng); swap.set(old, { ng, mw: o.matrixWorld.clone() }); o.geometry = ng; }
      });
    };
    apply(); ctx.onUpdate(apply);
  }
  // ridge beam (single rough-sawn oak beam on the ridge)
  const BW = 0.25, BH = 0.30;
  add(root, kit.rbox(BW, BH, Z1 - Z0 + 0.02, 0.012), oakBeam, [XC, RID - BH / 2 + 0.06, (Z0 + Z1) / 2]);
  // recessed cans + speakers on the slopes
  {
    const s = (RID - PL) / (XC - X0);
    const can = new THREE.CircleGeometry(0.045, 24); can.rotateX(Math.PI / 2);
    const trim = new THREE.RingGeometry(0.045, 0.062, 24); trim.rotateX(Math.PI / 2);
    const spk = new THREE.CircleGeometry(0.105, 32); spk.rotateX(Math.PI / 2);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 0.6, roughness: 0.4 });
    const trimM = std({ color: 0xe8e6e1, roughness: 0.5 });
    const spkM = std({ color: 0xe9e8e4, roughness: 0.85, normalMap: kit.noiseNormal(128, 4, 48, 3), normalScale: new THREE.Vector2(0.4, 0.4) });
    const put = (geo, mat, x, z, lift = 0.004) => { const m = add(root, geo, mat, [x, ceilY(x, z) - lift, z], [0, 0, x < XC ? Math.atan(s) : -Math.atan(s)], { shadow: false }); return m; };
    for (const u of [1.35]) for (const z of [12.45, 13.75, 15.05, 16.15]) for (const x of [X0 + u, X1 - u]) { put(can, lit, x, z, 0.005); put(trim, trimM, x, z, 0.006); }
    for (const [x, z] of [[X0 + 2.3, 13.1], [X1 - 2.3, 15.6]]) put(spk, spkM, x, z, 0.005);
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
    { side: 'z0', from: 12.125, to: 13.075 }, { side: 'x1', from: 12.475, to: 13.325 }, { side: 'x0', from: 12.10, to: Z1 },
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
    const h = yTop - F - 0.005; const nf = Math.max(3, Math.round(w / 0.10));
    const g = new THREE.PlaneGeometry(w, h, nf * 8, 12); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const t = (h / 2 - y) / h; const k = (x / w + 0.5) * nf * Math.PI * 2; const kk = k + 0.6 * Math.sin(y * 1.3 + x * 9); p.setZ(i, Math.sin(kk) * (0.045 + 0.02 * t) + 0.012 * Math.sin(kk * 2.1)); p.setX(i, x * (1 + 0.12 * t)); }
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

  // ------------------------------------------------------------------ soft-goods helper: cloth draped over a box
  // Plane spanning u∈[u0,u1] (across), v∈[v0,v1] (along), laid on a support rect [-hx,hx]×[zA,zB] at height `top`.
  // Cloth beyond the rect rolls over a rounded edge (radius R) and hangs (≤ maxDrop), with folds and corner sag.
  function drapeGeo(u0, u1, v0, v1, hx, zA, zB, top, { R = 0.06, maxDrop = 0.4, fold = 0.022, wrinkle = 0.006, puff = 0.0, seed = 1, nu = 72, nv = 72, sides = true } = {}) {
    const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0, nu, nv); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const rr = kit.rng(seed); const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + (u0 + u1) / 2, v = p.getZ(i) + (v0 + v1) / 2;
      const ex = sides ? Math.max(0, Math.abs(u) - hx) : 0, ezF = Math.max(0, v - zB), ezH = Math.max(0, zA - v);
      const ez = ezF || ezH, d = Math.hypot(ex, ez);
      const cu = Math.max(-hx, Math.min(hx, u)), cv = Math.max(zA, Math.min(zB, v));
      let x = u, y = top, z = v;
      // top: soft puff + low-frequency wrinkles
      const fx = Math.max(0, 1 - Math.pow(cu / hx, 2)), fz = Math.max(0, 1 - Math.pow((cv - (zA + zB) / 2) / ((zB - zA) / 2), 2));
      y += puff * fx * fz + wrinkle * (Math.sin(u * 7.1 + ph[0]) * Math.sin(v * 5.3 + ph[1]) + 0.6 * Math.sin(u * 13 + v * 4 + ph[2]));
      if (d > 0) {
        const nx = (Math.sign(u) * ex) / d, nz = (ezF ? 1 : -1) * ez / d;
        let out, drop; const arc = (R * Math.PI) / 2;
        if (d < arc) { const t = d / R; out = R * Math.sin(t); drop = R * (1 - Math.cos(t)); } else { out = R; drop = R + (d - arc); }
        const hang = Math.min(1, drop * 5);
        drop = Math.min(drop, maxDrop + (ex > 0 && ez > 0 ? 0.06 : 0));
        const along = ex > 0 && ez === 0 ? v : u; // coordinate along the edge
        out += hang * (fold * Math.sin(along * 17 + ph[3]) + fold * 0.6 * Math.sin(along * 7.3 + ph[0]) + 0.012 * (ex > 0 && ez > 0 ? 1 : 0));
        x = cu + nx * out; z = cv + nz * out; y = top - drop + wrinkle * 0.5 * Math.sin(along * 9);
      }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }

  // ------------------------------------------------------------------ bed (headboard on the bed wall, foot towards the fireplace)
  const BZ = 14.72;
  const bed = kit.group(root, [X1, F, BZ], -Math.PI / 2, 'bed'); // local: x across (world +z), z from wall to foot (world -x)
  const duvetMat = sheetMat.clone(); duvetMat.side = THREE.DoubleSide;
  const coverD = coverMat.clone(); coverD.side = THREE.DoubleSide;
  {
    // tall upholstered headboard: thin black wood frame round a cream linen panel (~1.5 m)
    add(bed, kit.rbox(2.18, 1.52, 0.09, 0.018), ebony, [0, 0.76, 0.05]);
    add(bed, kit.cushion(2.04, 0.07, 1.36, 0.03, 0.025, 8), linenCream, [0, 0.79, 0.11], [Math.PI / 2, 0, 0]);
    // black wood-grain base (0.35 m) on a recessed plinth
    add(bed, kit.rbox(2.08, 0.29, 2.18, 0.02), ebony, [0, 0.205, 1.22]);
    add(bed, kit.box(1.90, 0.07, 2.0), ebonyMatte, [0, 0.035, 1.20]);
    add(bed, kit.rbox(1.96, 0.26, 2.06, 0.08), sheetMat, [0, 0.48, 1.20]);                           // mattress
    // white duvet draped over the mattress (top at 0.62), folded back below the pillows
    add(bed, drapeGeo(-1.22, 1.22, 0.62, 2.62, 0.98, 0.62, 2.23, 0.635, { R: 0.07, maxDrop: 0.36, fold: 0.02, wrinkle: 0.007, puff: 0.03, seed: 4 }), duvetMat, [0, 0, 0]);
    add(bed, kit.cushion(1.98, 0.07, 0.30, 0.03, 0.015), sheetMat, [0, 0.66, 0.66]);                // turned-down fold
    // tan linen throw across the foot, hanging over the end and both sides
    add(bed, drapeGeo(-1.14, 1.14, 1.50, 2.78, 1.02, 1.50, 2.26, 0.69, { R: 0.09, maxDrop: 0.44, fold: 0.03, wrinkle: 0.004, puff: 0.02, seed: 9 }), coverD, [0, 0, 0]);
    // pillows: euro shams + sleepers (white), taupe velvet + stripe (accents below are dynamic)
    for (const s of [-0.62, 0, 0.62]) add(bed, kit.cushion(0.64, 0.62, 0.18, 0.08, 0.07), pillowWhite, [s, 0.96, 0.24], [-0.18, 0, 0]);
    for (const s of [-0.47, 0.47]) add(bed, kit.cushion(0.78, 0.48, 0.16, 0.08, 0.06), pillowWhite, [s, 0.86, 0.43], [-0.42, 0, s * 0.04]);
    add(bed, kit.cushion(0.58, 0.30, 0.13, 0.06, 0.05), stripeMat, [0.0, 0.80, 0.66], [-0.40, 0, 0.02]);
  }
  phys.boxLocal(bed, 0, 0.35, 1.18, 1.05, 0.35, 1.12);
  phys.boxLocal(bed, 0, 0.76, 0.05, 1.09, 0.76, 0.06);
  const accents = [];
  for (const [s, rz, m, w] of [[-0.42, 0.08, taupeVel, 0.48], [0.44, -0.06, brownBoucle, 0.46], [0.16, 0.03, taupeVel, 0.42]]) {
    const pil = add(root, kit.cushion(w, w * 0.95, 0.12, 0.09, 0.08), m, [0, 0, 0]);
    pil.position.copy(bed.localToWorld(new THREE.Vector3(s, 0.90, 0.58 + (s === 0.16 ? 0.04 : 0)))); pil.rotation.set(0, -Math.PI / 2, 0); pil.rotateX(-0.36); pil.rotateZ(rz);
    accents.push(pil);
  }
  // daybed-style bench at the foot: cream linen body + puffed seat + low rolled ends on black legs, knit throw over one end
  const bench = kit.group(bed, [0, 0, 2.66], 0, 'bench');
  {
    const BL = 1.60, BD = 0.48;
    for (const sx of [-BL / 2 + 0.06, BL / 2 - 0.06]) for (const sz of [-BD / 2 + 0.05, BD / 2 - 0.05]) add(bench, kit.lathe([[0, 0], [0.016, 0], [0.022, 0.15], [0, 0.15]], 16), ebonyMatte, [sx, 0, sz]);
    add(bench, kit.rbox(BL, 0.22, BD, 0.05), linenCream, [0, 0.26, 0]);
    add(bench, kit.cushion(BL - 0.30, 0.10, BD - 0.02, 0.04, 0.03), linenCream, [0, 0.41, 0]);
    for (const s of [-1, 1]) {
      const roll = kit.cushion(0.17, 0.24, BD, 0.08, 0.02); add(bench, roll, linenCream, [s * (BL / 2 - 0.085), 0.47, 0]);
      add(bench, kit.tube([[s * (BL / 2 - 0.004), 0.37, -BD / 2], [s * (BL / 2 - 0.004), 0.37, BD / 2]], 0.007, 8), linenCream, [0, 0, 0]); // welt
    }
    // throw: over the left end of the seat, hanging down the front and back
    add(bench, drapeGeo(-0.62, 0.0, -0.62, 0.62, 0.62, -BD / 2, BD / 2, 0.47, { R: 0.05, maxDrop: 0.32, fold: 0.03, wrinkle: 0.01, seed: 13, sides: false, nu: 40, nv: 60 }), throwMat, [-0.06, 0, 0]);
  }
  phys.solidGroup(bench);

  // nightstands (black oak, three drawers with reveals, brushed-nickel bar pulls) + lamps
  function nightstand(zc, w) {
    const g = kit.group(root, [X1 - 0.25, F, zc], -Math.PI / 2); // local x across (world +z), z out from wall
    const H = 0.66, D = 0.46, K = 0.07;
    add(g, kit.rbox(w, H - K, D - 0.02, 0.012), ebony, [0, K + (H - K) / 2, -0.01]);
    add(g, kit.box(w - 0.08, K, D - 0.10), ebonyMatte, [0, K / 2, -0.03]);
    add(g, kit.box(w - 0.04, H - K - 0.04, 0.01), ebonyMatte, [0, K + (H - K) / 2, D / 2 - 0.02]); // dark reveal behind fronts
    const dh = (H - K - 0.04) / 3;
    for (let i = 0; i < 3; i++) {
      const y = K + 0.02 + (i + 0.5) * dh;
      add(g, kit.rbox(w - 0.04, dh - 0.006, 0.022, 0.003), ebony, [0, y, D / 2 - 0.004]);
      add(g, kit.rbox(0.22, 0.013, 0.016, 0.006), M.brushedNickel, [0, y + 0.01, D / 2 + 0.018]);
      for (const sx of [-0.1, 0.1]) add(g, kit.box(0.01, 0.01, 0.016), M.brushedNickel, [sx, y + 0.01, D / 2 + 0.009]);
    }
    phys.solidGroup(g);
    return g;
  }
  nightstand(13.30, 0.68);
  nightstand(16.10, 0.60);
  function lamp(x, z, tall) {
    const g = kit.group(root, [x, F + 0.66, z]);
    const bh = tall ? 0.40 : 0.36;
    add(g, kit.lathe([[0, 0], [0.065, 0], [0.067, 0.012], [0.05, 0.02], [0.05, bh], [0.012, bh + 0.01], [0.008, bh + 0.08], [0, bh + 0.08]], 40), M.brass, [0, 0, 0]);
    for (let k = 1; k < 6; k++) add(g, kit.cyl(0.0505, 0.0505, 0.004, 32), M.brass, [0, 0.02 + k * (bh - 0.02) / 6, 0]); // fluted rings
    const sh = new THREE.CylinderGeometry(0.20, 0.20, 0.28, 48, 1, true); add(g, sh, shadeMat, [0, bh + 0.17, 0]);
    add(g, kit.sphere(0.03, 12, 8), M.emissiveWarm, [0, bh + 0.12, 0], [0, 0, 0], { shadow: false });
    return g;
  }
  lamp(X1 - 0.26, 13.30, false);
  lamp(X1 - 0.26, 16.10, true);

  // ------------------------------------------------------------------ rug (distressed vintage Persian, grey-taupe, set at an angle)
  {
    /* p17: grey-brown distressed vintage rug, darker border band, fine all-over pattern worn to the warp */
    vintageRug(ctx, root, { L: 4.0, W: 3.0, pos: [12.35, F, BZ - 0.05], ry: 0.10, seed: 31, lifts: [[-1, -1, 0.010], [1, 1, 0.006]], pal: {
      field: [124, 110, 100], fieldDark: [76, 64, 60], border: [90, 78, 72], borderDark: [58, 50, 46],
      motifA: [124, 94, 84], motifB: [92, 90, 92], motifC: [154, 142, 130], warp: [160, 148, 136], fringe: [206, 198, 186] } });
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
    if (withThrow) { const t = new THREE.PlaneGeometry(0.42, 0.55, 12, 14); const p = t.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, 0.03 * Math.sin(p.getX(i) * 18) + (yy < 0 ? -yy * 0.9 : 0)); } t.computeVertexNormals(); add(g, t, fab.knit('#8f9a86', { scale: 3, side: THREE.DoubleSide }), [-0.10, 0.60, -0.24], [-0.6, 0.3, 0.1]); }
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
    const D = 0.40, H = 1.1, s0 = 12.10, s1 = Z1 - 0.05; // ~4.55 m long slab (p18)
    const fb = [15.36, 16.36], ni = [13.90, 15.16], oy0 = 0.32, oy1 = 0.74;
    // extrude in (u=-z, v=y), depth along +x after rotation
    const outline = [[-s1, 0], [-s0, 0], [-s0, H], [-s1, H]];
    const holes = [[[-fb[1], oy0], [-fb[1], oy1], [-fb[0], oy1], [-fb[0], oy0]], [[-ni[1], oy0], [-ni[1], oy1], [-ni[0], oy1], [-ni[0], oy0]]];
    const g = kit.extrude(outline, D, 0, holes); g.rotateY(Math.PI / 2);
    add(root, g, marbleMat, [X0, F, 0]);
    phys.boxAABB([X0, F, s0], [X0 + D, F + H, s1]);
    const oh = oy1 - oy0, oyc = F + (oy0 + oy1) / 2;
    // recessed openings: black liners (top, bottom, ends) + a thin blackened-steel frame round each opening
    const liner = std({ color: 0x0d0d0d, roughness: 0.6, metalness: 0.2 });
    for (const [a0, a1] of [fb, ni]) {
      const zc = (a0 + a1) / 2, L = a1 - a0;
      add(root, kit.box(D - 0.02, 0.01, L), liner, [X0 + D / 2, F + oy0 + 0.005, zc]);
      add(root, kit.box(D - 0.02, 0.01, L), liner, [X0 + D / 2, F + oy1 - 0.005, zc]);
      for (const zz of [a0 + 0.005, a1 - 0.005]) add(root, kit.box(D - 0.02, oh, 0.01), liner, [X0 + D / 2, oyc, zz]);
      const t = 0.018, fx = X0 + D + 0.004;
      add(root, kit.box(0.012, t, L + 2 * t), M.matteBlack, [fx, F + oy1 + t / 2, zc]); add(root, kit.box(0.012, t, L + 2 * t), M.matteBlack, [fx, F + oy0 - t / 2, zc]);
      for (const zz of [a0 - t / 2, a1 + t / 2]) add(root, kit.box(0.012, oh, t), M.matteBlack, [fx, oyc, zz]);
    }
    // firebox: dark herringbone refractory back, ember bed, gas logs, glass
    const herring = kit.canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#121110'; c.fillRect(0, 0, w, h); const r = kit.rng(2); for (let y = -64; y < h + 64; y += 22) for (let x = 0; x < w; x += 44) { for (const s of [1, -1]) { const v = 34 + r() * 22; c.fillStyle = `rgb(${v},${v - 3},${v - 6})`; c.save(); c.translate(x + (s > 0 ? 0 : 22), y); c.rotate(s * Math.PI / 4); c.fillRect(0, 0, 30, 10); c.restore(); } } }, { repeat: [3, 1.2] });
    add(root, new THREE.PlaneGeometry(fb[1] - fb[0], oh), std({ map: herring, roughness: 0.9 }), [X0 + 0.04, oyc, (fb[0] + fb[1]) / 2], [0, Math.PI / 2, 0]);
    add(root, kit.box(0.30, 0.03, fb[1] - fb[0] - 0.04), std({ color: 0x3a3634, roughness: 1, normalMap: fineNoise }), [X0 + 0.20, F + oy0 + 0.02, (fb[0] + fb[1]) / 2]);
    const logM = std({ color: 0x51463d, roughness: 0.95, normalMap: fineNoise, normalScale: new THREE.Vector2(1.2, 1.2) });
    const fz = (fb[0] + fb[1]) / 2;
    add(root, kit.cyl(0.045, 0.05, 0.70, 14), logM, [X0 + 0.16, F + oy0 + 0.08, fz], [Math.PI / 2, 0, 0.05]);
    add(root, kit.cyl(0.04, 0.045, 0.55, 14), logM, [X0 + 0.26, F + oy0 + 0.11, fz + 0.06], [Math.PI / 2, 0.35, 0]);
    add(root, kit.cyl(0.035, 0.04, 0.45, 14), logM, [X0 + 0.12, F + oy0 + 0.14, fz - 0.10], [Math.PI / 2, -0.5, 0]);
    for (let i = 0; i < 9; i++) add(root, kit.sphere(0.022, 8, 6), std({ color: 0xd8d4cc, roughness: 0.9 }), [X0 + 0.27 + (i % 3) * 0.03, F + oy0 + 0.045, fb[0] + 0.08 + i * 0.09]); // glass/stone media
    const fg = add(root, new THREE.PlaneGeometry(fb[1] - fb[0], oh), M.glass, [X0 + D - 0.02, oyc, fz], [0, Math.PI / 2, 0], { shadow: false }); fg.renderOrder = 2;
    add(root, new THREE.PlaneGeometry(ni[1] - ni[0], oh), liner, [X0 + 0.02, oyc, (ni[0] + ni[1]) / 2], [0, Math.PI / 2, 0]);
    // frame TV (oak frame, noir film still recreated as a simple painting)
    const tvW = 2.30, tvH = 1.30, tz = 15.13, ty = F + H + 0.36 + tvH / 2;
    const noir = kit.canvasTex(1024, 584, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a5a58'); gr.addColorStop(0.55, '#2c2c2b'); gr.addColorStop(1, '#121212'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const r = kit.rng(9); for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(200,200,190,${0.05 + r() * 0.1})`; c.fillRect(600 + r() * 380, 300 + r() * 160, 3, 3); }
      c.fillStyle = '#1c1c1c'; c.fillRect(560, 280, 440, 200); // hangar
      c.fillStyle = '#0d0d0d'; c.beginPath(); c.moveTo(640, 120); c.lineTo(820, 100); c.lineTo(760, 112); c.lineTo(900, 130); c.lineTo(760, 124); c.closePath(); c.fill(); // plane
      const fig = (x, y, s) => { c.fillStyle = '#0a0a0a'; c.beginPath(); c.ellipse(x, y, 38 * s, 10 * s, 0, 0, 6.3); c.fill(); c.fillRect(x - 22 * s, y - 32 * s, 44 * s, 30 * s); c.beginPath(); c.ellipse(x, y + 22 * s, 20 * s, 26 * s, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(x - 62 * s, h); c.lineTo(x - 50 * s, y + 60 * s); c.quadraticCurveTo(x, y + 36 * s, x + 50 * s, y + 60 * s); c.lineTo(x + 66 * s, h); c.fill(); c.fillStyle = 'rgba(140,140,130,0.5)'; c.fillRect(x - 3 * s, y + 70 * s, 6 * s, 140 * s); };
      fig(470, 200, 1.6); fig(200, 300, 1.0);
    });
    const tv = kit.group(root, [X0 + 0.04, ty, tz], Math.PI / 2);
    add(tv, kit.rbox(tvW + 0.05, tvH + 0.05, 0.05, 0.004), std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xe7c597, roughness: 0.55 }), [0, 0, 0]);
    add(tv, new THREE.PlaneGeometry(tvW, tvH), std({ map: noir, roughness: 0.6, emissiveMap: noir, emissive: 0xffffff, emissiveIntensity: 0.25 }), [0, 0, 0.0255], [0, 0, 0], { shadow: false });
  }

  // ------------------------------------------------------------------ rear wall: black dresser, orchid, green abstract, door shade
  {
    const g = kit.group(root, [10.62, F, Z1 - 0.25], Math.PI); // local +z faces the room (-z world)
    const W = 1.18, H = 0.84, D = 0.50;
    add(g, kit.rbox(W, H - 0.07, D - 0.02, 0.012), ebony, [0, 0.07 + (H - 0.07) / 2, -0.01]);
    add(g, kit.box(W - 0.06, 0.07, D - 0.10), ebonyMatte, [0, 0.035, -0.03]);                     // toe kick
    add(g, kit.box(W - 0.03, H - 0.11, 0.01), ebonyMatte, [0, 0.07 + (H - 0.07) / 2, D / 2 - 0.02]); // reveal
    { const dh = (H - 0.07 - 0.04) / 3, dw = (W - 0.04) / 2; // 2 x 3 drawer fronts with 3 mm gaps, finger-pull tops
      for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) add(g, kit.rbox(dw - 0.003, dh - 0.003, 0.022, 0.003), ebony, [(c - 0.5) * dw, 0.09 + (r + 0.5) * dh, D / 2 - 0.004]); }
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
    // near-black glossy porcelain, 0.6 m squares, thin light-grey grout (texture tile = 2.4 m = 4x4)
    const tileDraw = (hgt) => (c, w, h) => { const r = kit.rng(17); c.fillStyle = hgt ? '#000' : '#8c8c88'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = hgt ? 255 : 44 + r() * 8; c.fillStyle = `rgb(${v},${v},${v + (hgt ? 0 : 2)})`; c.fillRect(i * 256 + 2, j * 256 + 2, 252, 252); if (!hgt) for (let k = 0; k < 60; k++) { const q = 38 + r() * 14; c.fillStyle = `rgba(${q},${q},${q},0.5)`; c.fillRect(i * 256 + 2 + r() * 240, j * 256 + 2 + r() * 240, 3 + r() * 10, 2 + r() * 6); } } };
    const tileMat = kit.outdoor(std({ map: kit.canvasTex(1024, 1024, tileDraw(false), { repeat: [1 / 2.4, 1 / 2.4] }), normalMap: heightNormal(512, tileDraw(true), 4, [1 / 2.4, 1 / 2.4]), normalScale: new THREE.Vector2(0.6, 0.6), color: 0xffffff, roughness: 0.62, envMapIntensity: 0.3 })); // matte charcoal (p22)
    kit.floorFinish(root, [bx0, bz0, bx1, bz1], tileMat, B, 0.006);
    // dark fascia band round the slab edge
    const fasc = kit.outdoor(std({ color: 0x1e1e1e, roughness: 0.6 }));
    add(root, kit.box(bx1 - bx0 + 0.04, 0.32, 0.04), fasc, [(bx0 + bx1) / 2, B - 0.15, bz1 + 0.02]);
    add(root, kit.box(0.04, 0.32, bz1 - bz0), fasc, [bx0 - 0.02, B - 0.15, (bz0 + bz1) / 2]);
    // slim matte-black railing: flat top rail, bottom rail, posts, 12 mm square pickets at ~95 mm (instanced)
    const railM = kit.outdoor(std({ color: 0x141414, roughness: 0.55, metalness: 0.4 }));
    const RH = 1.07, inset = 0.05;
    const runs = [[[bx0 + inset, bz1 - inset], [bx1, bz1 - inset]], [[bx0 + inset, bz0 + 0.30], [bx0 + inset, bz1 - inset]]];
    const pick = new THREE.BoxGeometry(0.013, RH - 0.10, 0.013); const picks = [];
    for (const [a, b] of runs) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const ry = Math.atan2(ux, uz);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      add(root, kit.rbox(0.042, 0.012, L + 0.05, 0.003), railM, [mid[0], B + RH, mid[1]], [0, ry, 0]); // thin flat cap
      add(root, kit.box(0.016, 0.022, L), railM, [mid[0], B + RH - 0.017, mid[1]], [0, ry, 0]);
      add(root, kit.box(0.025, 0.025, L), railM, [mid[0], B + 0.07, mid[1]], [0, ry, 0]);
      for (let s = 0; s <= L + 0.01; s += L / Math.ceil(L / 1.8)) add(root, kit.box(0.04, RH, 0.04), railM, [a[0] + ux * s, B + RH / 2, a[1] + uz * s]);
      for (let s = 0.095; s < L - 0.04; s += 0.095) picks.push([a[0] + ux * s, B + 0.06 + (RH - 0.10) / 2 - 0.01, a[1] + uz * s]);
      phys.boxAABB([Math.min(a[0], b[0]) - 0.03, B, Math.min(a[1], b[1]) - 0.03], [Math.max(a[0], b[0]) + 0.03, B + RH + 0.02, Math.max(a[1], b[1]) + 0.03]);
    }
    const im = new THREE.InstancedMesh(pick, railM, picks.length); const mm = new THREE.Matrix4();
    picks.forEach((p, i) => im.setMatrixAt(i, mm.makeTranslation(p[0], p[1], p[2]))); im.castShadow = true; im.receiveShadow = true; root.add(im);

    // white horizontal lap siding (0.15 m reveal) on the balcony faces of the rear wall and the bath's end wall
    const lapDraw = (hgt) => (c, w, h) => { const r = kit.rng(29); const bh = h / 8; for (let k = 0; k < 8; k++) { const gr = c.createLinearGradient(0, k * bh, 0, (k + 1) * bh); if (hgt) { gr.addColorStop(0, '#202020'); gr.addColorStop(0.9, '#f0f0f0'); gr.addColorStop(1, '#000'); } else { const v = 240 + r() * 6; gr.addColorStop(0, `rgb(${v - 12},${v - 13},${v - 16})`); gr.addColorStop(0.85, `rgb(${v},${v - 1},${v - 5})`); gr.addColorStop(1, `rgb(${v - 70},${v - 70},${v - 72})`); } c.fillStyle = gr; c.fillRect(0, k * bh, w, bh); } };
    const lap = kit.outdoor(std({ map: kit.canvasTex(256, 512, lapDraw(false), { repeat: [1, 1 / 1.2] }), normalMap: heightNormal(256, lapDraw(true), 3, [1, 1 / 1.2]), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.75 }));
    const yTop = PL - 0.02, RZ = Z1 + 0.30, EX = bx1;
    const segs = [[bx0, DOOR.x0 - 0.06, B, yTop], [DOOR.x0 - 0.06, DOOR.x1 + 0.06, B + 2.47, yTop], [DOOR.x1 + 0.06, BAY.a[0] - 0.12, B, yTop], [BAY.a[0] - 0.12, BAY.d[0] + 0.12, B + BAY.top + 0.07, yTop], [BAY.d[0] + 0.12, EX, B, yTop]];
    for (const [xa, xb, y0, y1] of segs) if (xb - xa > 0.02) kit.wallPanel(root, [xa, RZ], [xb, RZ], y0, y1, [0, 1], lap, 0.006);
    // end wall (x = 15.39, bath beyond): glass door (0.9 x 2.4) between two box lanterns
    const DZ0 = 17.42, DZ1 = 18.32, DH = 2.40;
    kit.wallPanel(root, [EX, bz0], [EX, DZ0 - 0.05], B, yTop, [-1, 0], lap, 0.006);
    kit.wallPanel(root, [EX, DZ1 + 0.05], [EX, bz1 + 0.05], B, yTop, [-1, 0], lap, 0.006);
    kit.wallPanel(root, [EX, DZ0 - 0.05], [EX, DZ1 + 0.05], B + DH + 0.05, yTop, [-1, 0], lap, 0.006);
    {
      const dz = (DZ0 + DZ1) / 2, fw = 0.055;
      // dark interior seen through the glass (bath: charcoal tile, a lit vanity glow)
      const inside = kit.canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#2b2d2f'; c.fillRect(0, 0, w, h); const r = kit.rng(3); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) { const v = 36 + r() * 14; c.fillStyle = `rgb(${v},${v + 1},${v + 3})`; c.fillRect(x + 1, y + 1, 62, 30); } const gr = c.createRadialGradient(w * 0.7, h * 0.35, 4, w * 0.7, h * 0.35, 140); gr.addColorStop(0, 'rgba(230,220,200,0.55)'); gr.addColorStop(1, 'rgba(230,220,200,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(220,220,215,0.5)'; c.fillRect(w * 0.15, h * 0.62, w * 0.6, h * 0.05); });
      add(root, new THREE.PlaneGeometry(DZ1 - DZ0, DH), std({ map: inside, roughness: 0.9 }), [EX + 0.12, B + DH / 2, dz], [0, -Math.PI / 2, 0], { shadow: false });
      for (const [zz, ww] of [[DZ0 + fw / 2, fw], [DZ1 - fw / 2, fw]]) add(root, kit.box(0.10, DH, ww), railM, [EX + 0.02, B + DH / 2, zz]);
      add(root, kit.box(0.10, fw, DZ1 - DZ0), railM, [EX + 0.02, B + DH - fw / 2, dz]);
      add(root, kit.box(0.10, 0.10, DZ1 - DZ0), railM, [EX + 0.02, B + 0.05, dz]);
      // reveal returns (white) so the door sits in the wall thickness
      for (const zz of [DZ0 - 0.005, DZ1 + 0.005]) add(root, kit.box(0.14, DH, 0.01), M.extWhite, [EX + 0.07, B + DH / 2, zz]);
      const dg = add(root, new THREE.PlaneGeometry(DZ1 - DZ0 - 2 * fw, DH - 0.10 - fw), M.glass, [EX + 0.02, B + 0.10 + (DH - 0.10 - fw) / 2, dz], [0, -Math.PI / 2, 0], { shadow: false }); dg.renderOrder = 2;
      add(root, kit.box(0.03, 0.30, 0.02), M.matteBlack, [EX - 0.04, B + 1.05, DZ1 - 0.12]); // pull
    }
    // wall lanterns: black box lantern (~0.32 x 0.52), seeded glass, warm bulb. [x, z, facing]
    const lglass = kit.outdoor(new THREE.MeshPhysicalMaterial({ color: 0xfff6e8, roughness: 0.12, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    const lanternAt = (x, z, ry, s = 1) => {
      const g = kit.group(root, [x, B + 2.0, z], ry); g.scale.setScalar(s);
      add(g, kit.box(0.12, 0.30, 0.02), railM, [0, 0.02, 0.01]);
      add(g, kit.box(0.03, 0.03, 0.08), railM, [0, 0.10, 0.06]);
      const body = kit.group(g, [0, 0, 0.19]);
      add(body, kit.box(0.32, 0.03, 0.32), railM, [0, 0.245, 0]); add(body, kit.box(0.28, 0.03, 0.28), railM, [0, -0.245, 0]);
      add(body, kit.lathe([[0, 0], [0.19, 0], [0.06, 0.08], [0, 0.09]], 4), railM, [0, 0.26, 0], [0, Math.PI / 4, 0]);
      add(body, kit.box(0.04, 0.03, 0.04), railM, [0, 0.36, 0]);
      for (const sx of [-0.135, 0.135]) for (const sz of [-0.135, 0.135]) add(body, kit.box(0.018, 0.47, 0.018), railM, [sx, 0, sz]);
      add(body, kit.box(0.26, 0.46, 0.26), lglass, [0, 0, 0], [0, 0, 0], { shadow: false });
      add(body, kit.cyl(0.012, 0.012, 0.10, 10), std({ color: 0xf4f0e6, roughness: 0.6 }), [0, -0.12, 0]);
      add(body, kit.sphere(0.022, 12, 8), M.emissiveWarm, [0, -0.05, 0], [0, 0, 0], { shadow: false });
    };
    lanternAt(DOOR.x0 - 0.36, RZ, 0, 0.95); lanternAt(DOOR.x1 + 0.36, RZ, 0, 0.95); // primary balcony door
    lanternAt(EX, DZ0 - 0.32, -Math.PI / 2, 1.1); lanternAt(EX, DZ1 + 0.32, -Math.PI / 2, 1.1); // flanking the end door
  }

  kit.mergeStatic(root);
}
