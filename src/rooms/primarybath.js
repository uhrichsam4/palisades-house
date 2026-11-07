// Piece: primarybath — Primary bath, coffee-bar vestibule, walk-in closet
// Owned rooms: primaryBath, vestibule, primaryCloset | Reference photos: p19, p20, p21, p23
//
// Layout (inferred from p19–p21, p23; plan.js rects unchanged):
//  - Bath entered from the coffee-bar vestibule through a cased opening (x 16.45, z 14.43). A short entry
//    strip (z 14.50–15.70) runs in front of a full-height marble partition; behind the shower is a
//    water-closet (x 15.69–16.68) reached from that strip.
//  - Glass wet-room shower along the SW side (x 16.80–18.34, z 15.95–19.05): marble back + end walls,
//    a 1.06 m marble half wall with glass above, two glass doors either side (p20).
//  - Freestanding oval tub in front of the half wall, long fluted white-oak double vanity on the NE
//    wall with a full-width mirror (real Reflector), tall oak linen cabinet at its far end (p19).
//  - Asymmetric cathedral ceiling (ridge x 18.35, 3.35 m) with three skylight wells.
//  - Closet door moved to the bath's far wall (p19's oak door); vestibule is a galley coffee bar (p23).
import { Reflector } from 'three/addons/objects/Reflector.js';

export const piece = { rooms: ["primaryBath", "vestibule", "primaryCloset"], photos: ["p19", "p20", "p21", "p23"] };
export const ownCeiling = ['primaryBath'];

const Y0 = 3.35;              // upper finished floor
const PLATE = 6.10;           // wall plate (2.75 above floor)
const XR = 18.35, YR = Y0 + 3.35; // bath ceiling ridge (asymmetric gable along z)
const BX0 = 15.69, BZ0 = 14.50, BX1 = 21.40, BZ1 = 21.35; // primaryBath rect

export const views = {
  p19: { pos: [19.30, Y0 + 1.36, 19.75], look: [19.30, Y0 + 1.36, 14.5], fov: 60 },
  p20: { pos: [20.55, Y0 + 1.02, 17.15], look: [15.69, Y0 + 1.02, 17.15], fov: 56 },
  p21: { pos: [18.20, Y0 + 1.45, 15.80], look: [16.80, Y0 + 1.35, 17.30], fov: 66 },
  p23: { pos: [16.45, Y0 + 1.15, 14.45], look: [16.45, Y0 + 1.15, 11.75], fov: 78 },
};

// bath ceiling height (absolute y) at x
function ceilY(x) {
  if (x < XR) return PLATE + (YR - PLATE) * Math.max(0, (x - BX0) / (XR - BX0));
  return PLATE + (YR - PLATE) * Math.max(0, (BX1 - x) / (BX1 - XR));
}

export async function build(ctx) {
  const { THREE, root, kit, phys } = ctx;
  const { M } = kit;
  const R = kit.rng(1919);

  // ------------------------------------------------------------------ materials
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const physM = (o) => new THREE.MeshPhysicalMaterial(o);

  // light grasscloth (bath walls, p19): warm off-white with horizontal fibres, 0.9 m panels
  const grassTex = (base, spread, lightBias, seed) => kit.canvasTex(512, 512, (g, w, h) => {
    const r = kit.rng(seed);
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 1) {
      let x = -r() * 60;
      while (x < w) {
        const len = 20 + r() * 140; const d = (r() - 0.5) * spread + (r() < 0.06 ? lightBias : 0);
        g.fillStyle = `rgba(${base[0] + d | 0},${base[1] + d | 0},${base[2] + d * 0.9 | 0},${0.35 + r() * 0.5})`;
        g.fillRect(x, y, len, 1 + (r() < 0.2 ? 1 : 0)); x += len + r() * 8;
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1, h); // warp threads
  }, { repeat: [1 / 0.5, 1 / 0.5] });
  const grassLight = std({ map: grassTex([204, 201, 194], 26, 18, 3), roughness: 0.95, normalMap: kit.noiseNormal(256, 2.0, 64, 9), normalScale: new THREE.Vector2(0.25, 0.25) });
  grassLight.normalMap.repeat.set(2, 2);
  const grassDark = std({ map: grassTex([58, 52, 46], 34, 40, 5), roughness: 0.92, normalMap: kit.noiseNormal(256, 2.0, 64, 11), normalScale: new THREE.Vector2(0.35, 0.35) });
  grassDark.normalMap.repeat.set(2, 2);

  // marble: large-format porcelain/marble slabs (1.2 x 2.4 m), procedural veining
  function marbleCanvas(seed, dark) {
    return kit.canvasTex(1024, 2048, (g, w, h) => {
      const r = kit.rng(seed);
      g.fillStyle = dark ? '#121212' : '#f2f1ee'; g.fillRect(0, 0, w, h);
      // soft clouds
      for (let i = 0; i < 60; i++) {
        const x = r() * w, y = r() * h, rad = 80 + r() * 380; if (!dark && r() < 0.6) continue;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const c = dark ? `rgba(${40 + r() * 20 | 0},${40 + r() * 20 | 0},${42 + r() * 20 | 0},0.18)` : `rgba(${205 + r() * 25 | 0},${205 + r() * 25 | 0},${210 + r() * 20 | 0},0.10)`;
        gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      const vein = (x, y, a, len, wid, col, blur) => {
        g.save(); g.filter = blur ? `blur(${blur}px)` : 'none'; g.beginPath(); g.moveTo(x, y);
        for (let i = 0; i < len; i += 8) { a += (r() - 0.5) * 0.22; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); }
        g.strokeStyle = col; g.lineWidth = wid; g.lineCap = 'round'; g.stroke(); g.restore();
        return [x, y, a];
      };
      const nMain = dark ? 7 : 11;
      for (let i = 0; i < nMain; i++) {
        const x = r() * w * 1.4 - w * 0.2, y = h * (0.1 + r() * 1.0); const a = -0.75 - r() * 0.5; const len = 900 + r() * 1600;
        if (dark) {
          vein(x, y, a, len, 6 + r() * 6, 'rgba(200,200,200,0.10)', 8);
          vein(x, y, a, len, 1 + r() * 2.2, 'rgba(240,240,236,0.9)', 0);
        } else {
          if (r() < 0.4) vein(x, y, a, len, 8 + r() * 8, 'rgba(160,156,150,0.07)', 8);
          vein(x, y, a, len, 0.8 + r() * 1.8, 'rgba(128,124,118,0.6)', 0.5);
        }
        for (let k = 0; k < (dark ? 4 : 2); k++) { // branches
          const bx = x + (r() - 0.5) * 500, by = y - r() * 600;
          vein(bx, by, a + (r() - 0.5) * 1.2, 120 + r() * 400, 0.7 + r() * 1.2, dark ? 'rgba(230,230,226,0.55)' : 'rgba(150,146,140,0.22)', dark ? 0 : 0.5);
        }
      }
      g.fillStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(170,168,164,0.7)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); // slab joints
    }, { repeat: [1 / 1.2, 1 / 2.4] });
  }
  const marble = std({ map: marbleCanvas(77, false), roughness: 0.12, metalness: 0, envMapIntensity: 1.0 });
  const marbleBox = std({ map: marbleCanvas(78, false), roughness: 0.12 }); marbleBox.map.repeat.set(1, 1);
  const marbleBlack = std({ map: marbleCanvas(91, true), roughness: 0.14, envMapIntensity: 1.1 }); marbleBlack.map.repeat.set(1, 1);

  // waterjet "chain ring" mosaic floor (p19): white marble field, taupe striated rings with brown outlines
  const mosaicMap = kit.canvasTex(1024, 1024, (g, w) => {
    const P = w / 2; const r = kit.rng(21);
    g.fillStyle = '#f1efea'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(190,188,184,${0.15 + r() * 0.2})`; g.lineWidth = 0.8; g.beginPath(); let x = r() * w, y = r() * w; g.moveTo(x, y); for (let k = 0; k < 30; k++) { x += (r() - 0.3) * 18; y += (r() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
    const Ro = P * 0.57, Ri = P * 0.44;
    for (let pass = 0; pass < 2; pass++) for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) {
      const cx = i * P, cy = j * P;
      if (pass === 0) {
        g.beginPath(); g.arc(cx, cy, Ro, 0, Math.PI * 2); g.arc(cx, cy, Ri, 0, Math.PI * 2, true);
        const gr = g.createRadialGradient(cx, cy, Ri, cx, cy, Ro); gr.addColorStop(0, '#9f958a'); gr.addColorStop(0.5, '#bdb3a8'); gr.addColorStop(1, '#998e82');
        g.fillStyle = gr; g.fill('evenodd');
        g.strokeStyle = 'rgba(120,104,90,0.45)'; g.lineWidth = 1.2; // striations (strip-cut stone)
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 22) { g.beginPath(); g.moveTo(cx + Math.cos(a) * Ri, cy + Math.sin(a) * Ri); g.lineTo(cx + Math.cos(a) * Ro, cy + Math.sin(a) * Ro); g.stroke(); }
      } else {
        g.strokeStyle = '#5c4d40'; g.lineWidth = 6;
        g.beginPath(); g.arc(cx, cy, Ro, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(cx, cy, Ri, 0, Math.PI * 2); g.stroke();
      }
    }
  }, { repeat: [1 / 0.50, 1 / 0.50] });
  const mosaic = std({ map: mosaicMap, roughness: 0.32 });

  const tubWhite = physM({ color: 0xf8f8f6, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
  const ceramic = physM({ color: 0xf7f7f5, roughness: 0.12, clearcoat: 0.6, side: THREE.BackSide });
  const nickel = std({ color: 0xe2d9cb, roughness: 0.14, metalness: 1.0 });
  const steel = std({ color: 0xc9cacc, roughness: 0.28, metalness: 1.0 });
  const blackGlass = std({ color: 0x050505, roughness: 0.05, metalness: 0.2 });
  const showerGlass = physM({ color: 0xf2f8f6, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.11, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1, ior: 1.5 });
  const glassEdge = std({ color: 0xb9d6cc, roughness: 0.1, transparent: true, opacity: 0.55 });
  const clearGlass = physM({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 });
  const skyGlow = std({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.2, roughness: 1 });
  const bulbGlow = std({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 4, roughness: 1 });
  const ceil = std({ color: 0xf6f5f1, roughness: 0.95, side: THREE.DoubleSide });
  const towelMat = std({ color: 0xb3afa8, roughness: 1, normalMap: kit.noiseNormal(128, 4, 32, 4), normalScale: new THREE.Vector2(0.8, 0.8) });
  const oak = M.oakCabinet.clone(); oak.color.set(0xfff0dc);
  const oakV = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1], rotation: Math.PI / 2 }), color: 0xfff0dc, roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) });
  const leafGreen = std({ color: 0x2f5a26, roughness: 0.55, side: THREE.DoubleSide });
  const petal = std({ color: 0xfbf8f4, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x201c18, emissiveIntensity: 0.15 });
  const stem = std({ color: 0x55603a, roughness: 0.7 });
  const potWhite = physM({ color: 0xf4f2ee, roughness: 0.2, clearcoat: 0.5 });
  const fridgeDark = std({ color: 0x0a0a0b, roughness: 0.6 });

  // ------------------------------------------------------------------ helpers
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // box by min/max; y relative to the upper floor
  function bx(parent, mat, x0, y0, z0, x1, y1, z1, r = 0) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = r > 0 ? kit.rbox(w, h, d, r, 2) : new THREE.BoxGeometry(w, h, d);
    return kit.add(parent, geo, mat, [(x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2]);
  }
  // Flat finish panel on a wall plane. plane: {axis:'x'|'z', c, n:+1|-1} (faces n along axis).
  // outline/holes in [s, v]: s = world z (x-planes) or world x (z-planes), v = height above floor.
  // UVs are metres, so tiled materials (grasscloth, marble) keep real scale.
  function panel(parent, mat, plane, outline, holes = [], off = 0.004, uvOff = [0, 0]) {
    const sgn = plane.axis === 'z' ? plane.n : -plane.n;
    const toV2 = ([s, v]) => new THREE.Vector2(s * sgn, v);
    // openings that reach the floor become notches in the bottom edge (outline[0]→outline[1])
    const notches = holes.filter(h => Math.min(...h.map(p => p[1])) <= 0.001).map(h => [Math.min(...h.map(p => p[0])), Math.max(...h.map(p => p[0])), Math.max(...h.map(p => p[1]))]).sort((a, b) => a[0] - b[0]);
    const pts = [outline[0]]; for (const [a, b, hh] of notches) pts.push([a, 0], [a, hh], [b, hh], [b, 0]); pts.push(...outline.slice(1));
    const shape = new THREE.Shape(pts.map(toV2));
    for (const hl of holes) if (Math.min(...hl.map(p => p[1])) > 0.001) shape.holes.push(new THREE.Path(hl.map(toV2)));
    const geo = new THREE.ShapeGeometry(shape);
    if (uvOff[0] || uvOff[1]) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + uvOff[0], uv.getY(i) + uvOff[1]); }
    const N = plane.axis === 'z' ? V(0, 0, plane.n) : V(plane.n, 0, 0);
    const U = V(N.z, 0, -N.x);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = false;
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, V(0, 1, 0), N));
    if (plane.axis === 'z') m.position.set(0, Y0, plane.c + plane.n * off); else m.position.set(plane.c + plane.n * off, Y0, 0);
    parent.add(m); return m;
  }
  const rect = (s0, s1, v0, v1) => [[s0, v0], [s1, v0], [s1, v1], [s0, v1]];
  // white painted door/opening casing on a wall face
  const casingMat = M.paintWhite;
  function casing(parent, plane, s0, s1, head, wd = 0.075, t = 0.018) {
    const g = new THREE.Group(); parent.add(g);
    const c = plane.c + plane.n * t / 2;
    const put = (a0, a1, v0, v1) => {
      if (plane.axis === 'z') bx(g, casingMat, Math.min(a0, a1), v0, c - t / 2, Math.max(a0, a1), v1, c + t / 2);
      else bx(g, casingMat, c - t / 2, v0, Math.min(a0, a1), c + t / 2, v1, Math.max(a0, a1));
    };
    put(s0 - wd, s0, 0, head + wd); put(s1, s1 + wd, 0, head + wd); put(s0 - wd, s1 + wd, head, head + wd);
    return g;
  }
  function knob(parent, mat, pos, dir = 'x-', r = 0.014) {
    const geo = kit.lathe([[0, 0], [r * 0.5, 0], [r * 0.5, r * 0.9], [r * 0.3, r * 1.1], [r * 0.9, r * 1.5], [r, r * 2.0], [r * 0.8, r * 2.5], [0, r * 2.6]], 16);
    const m = kit.add(parent, geo, mat, pos);
    if (dir === 'x-') m.rotation.z = Math.PI / 2; else if (dir === 'x+') m.rotation.z = -Math.PI / 2; else if (dir === 'z+') m.rotation.x = Math.PI / 2; else if (dir === 'z-') m.rotation.x = -Math.PI / 2;
    return m;
  }
  // vertical reeds (half-round flutes) filling local z∈[0,w], y∈[0,h], bulging toward -x
  function fluteGeo(w, h, pitch = 0.017) {
    const n = Math.max(1, Math.round(w / pitch)); const r = w / n / 2;
    const base = new THREE.CylinderGeometry(r, r, h, 6, 1, true, 0, Math.PI); base.rotateY(Math.PI);
    const geos = []; for (let i = 0; i < n; i++) { const g = base.clone(); g.translate(0, h / 2, r + i * 2 * r); geos.push(g); }
    return kit.mergeGeometries(geos);
  }
  const dyn = []; // dynamic props, made physical after placement

  // ================================================================== PRIMARY BATH
  const bath = kit.group(root, [0, 0, 0], 0, 'primaryBath');
  kit.floorFinish(bath, 'primaryBath', mosaic);

  // ---- ceiling: asymmetric gable with skylight wells
  const skylights = [
    { x0: 16.98, x1: 17.88, z0: 16.27, z1: 16.87 },   // over shower (p20 right one)
    { x0: 16.98, x1: 17.88, z0: 17.43, z1: 18.03 },   // over shower (p20 left one)
    { x0: 18.70, x1: 19.90, z0: 15.05, z1: 16.30 },   // over the entry / tall cabinet end (p19 centre)
  ];
  {
    const e = 0.06;
    const slope = (xa, xb) => {
      const shape = new THREE.Shape([new THREE.Vector2(xa, BZ0 - e), new THREE.Vector2(xb, BZ0 - e), new THREE.Vector2(xb, BZ1 + e), new THREE.Vector2(xa, BZ1 + e)]);
      for (const s of skylights) if (s.x0 >= xa && s.x1 <= xb) shape.holes.push(new THREE.Path([new THREE.Vector2(s.x0, s.z0), new THREE.Vector2(s.x0, s.z1), new THREE.Vector2(s.x1, s.z1), new THREE.Vector2(s.x1, s.z0)]));
      const geo = new THREE.ShapeGeometry(shape); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, ceilY(Math.min(BX1, Math.max(BX0, x))), z); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, ceil); m.name = 'ceiling:primaryBath'; m.castShadow = true; m.receiveShadow = true; bath.add(m);
    };
    slope(BX0 - e, XR); slope(XR, BX1 + e);
    // wells: vertical white shafts up to a glowing glazed top
    const quad = (pts, mat) => {
      const g = new THREE.BufferGeometry(); const [a, b, c, d] = pts;
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; bath.add(m); return m;
    };
    for (const s of skylights) {
      const top = Math.max(ceilY(s.x0), ceilY(s.x1)) + 0.32;
      const f0 = ceilY(s.x0), f1 = ceilY(s.x1);
      quad([[s.x0, f0, s.z0], [s.x1, f1, s.z0], [s.x1, top, s.z0], [s.x0, top, s.z0]], ceil);
      quad([[s.x0, f0, s.z1], [s.x1, f1, s.z1], [s.x1, top, s.z1], [s.x0, top, s.z1]], ceil);
      quad([[s.x0, f0, s.z0], [s.x0, f0, s.z1], [s.x0, top, s.z1], [s.x0, top, s.z0]], ceil);
      quad([[s.x1, f1, s.z0], [s.x1, f1, s.z1], [s.x1, top, s.z1], [s.x1, top, s.z0]], ceil);
      const sky = quad([[s.x0, top, s.z0], [s.x1, top, s.z0], [s.x1, top, s.z1], [s.x0, top, s.z1]], skyGlow); sky.castShadow = false;
    }
    // recessed cans + speaker grilles tilted to the slope
    const can = (x, z, r = 0.05, mat = M.emissiveWarm) => {
      const a = x < XR ? Math.atan((YR - PLATE) / (XR - BX0)) : -Math.atan((YR - PLATE) / (BX1 - XR));
      const g1 = new THREE.CircleGeometry(r * 1.35, 24); g1.rotateX(Math.PI / 2); g1.rotateZ(a);
      const g2 = new THREE.CircleGeometry(r, 24); g2.rotateX(Math.PI / 2); g2.rotateZ(a);
      const y = ceilY(x);
      kit.add(bath, g1, std({ color: 0xe8e6e1, roughness: 0.6 }), [x, y - 0.004, z], [0, 0, 0], { shadow: false });
      kit.add(bath, g2, mat, [x, y - 0.007, z], [0, 0, 0], { shadow: false });
    };
    for (const [x, z] of [[20.35, 15.6], [20.35, 17.4], [20.35, 19.2], [19.4, 20.4], [17.6, 19.8], [17.3, 15.2], [17.4, 17.5]]) can(x, z);
    const spk = std({ color: 0xdedcd7, roughness: 0.8 });
    can(19.2, 17.9, 0.09, spk); can(17.7, 20.6, 0.09, spk);
  }

  // ---- walls: grasscloth on all bath faces, gable ends up to the ceiling
  {
    const op = (s0, s1, v0, v1) => rect(s0, s1, v0, v1);
    const gable = (x0, x1) => [[x0, 0], [x1, 0], [x1, PLATE - Y0], [XR, YR - Y0], [x0, PLATE - Y0]];
    // far wall z=14.50 (vestibule opening + closet door)
    panel(bath, grassLight, { axis: 'z', c: BZ0, n: 1 }, gable(BX0, BX1), [op(15.975, 16.925, 0, 2.30), op(19.425, 20.275, 0, 2.35)]);
    // rear wall z=21.35 (two windows)
    panel(bath, grassLight, { axis: 'z', c: BZ1, n: -1 }, gable(BX0, BX1), [op(17.175, 19.025, 1.0, 2.35), op(19.675, 20.225, 1.0, 2.35)]);
    // NE wall x=21.40 (vanity wall; small window near the rear corner)
    panel(bath, grassLight, { axis: 'x', c: BX1, n: -1 }, rect(BZ0, BZ1, 0, PLATE - Y0), [op(20.20, 20.90, 1.2, 2.35)]);
    // SW wall x=15.69 (WC + entry strip + window by the rear)
    panel(bath, grassLight, { axis: 'x', c: BX0, n: 1 }, rect(BZ0, BZ1, 0, PLATE - Y0), [op(19.675, 20.225, 1.2, 2.35)]);
    casing(bath, { axis: 'z', c: BZ0, n: 1 }, 15.975, 16.925, 2.30);
    casing(bath, { axis: 'z', c: BZ0, n: 1 }, 19.425, 20.275, 2.35);
  }

  // ---- shower enclosure + WC partitions
  const SX0 = 16.80, SX1 = 18.40, SZ0 = 15.60, SZ1 = 18.70, GX = 18.335; // GX: glass plane
  const HW0 = 16.33, HW1 = 17.97, HWH = 1.06;
  {
    const part = kit.group(bath, [0, 0, 0], 0, 'showerWalls');
    const top = YR - Y0 + 0.05;
    // -z end partition (with WC door) z 15.70–15.95
    bx(part, M.paintWhite, BX0, 0, 15.35, 15.84, top, SZ0);
    bx(part, M.paintWhite, 16.54, 0, 15.35, SX1, top, SZ0);
    bx(part, M.paintWhite, 15.84, 2.10, 15.35, 16.54, top, SZ0);
    // +z end: WC wall behind the shower + a narrow marble pier for the door hinges; glass return between
    bx(part, M.paintWhite, BX0, 0, SZ1, SX1, top, SZ1 + 0.25);
    // shower back wall (WC behind)
    bx(part, M.paintWhite, 16.68, 0, SZ0, SX0, top, SZ1);
    for (const m of part.children) phys.solid(m);
    // marble faces inside the shower (slab layout per wall)
    panel(bath, marble, { axis: 'x', c: SX0, n: 1 }, rect(SZ0, SZ1, 0, ceilY(SX0) - Y0 + 0.02), [], 0.004, [0.35, 0.1]);
    panel(bath, marble, { axis: 'z', c: SZ0, n: 1 }, rect(SX0, SX1, 0, ceilY(SX1) - Y0 + 0.02), [], 0.004, [0.8, 0.5]);
    panel(bath, marble, { axis: 'z', c: SZ1, n: -1 }, rect(SX0, SX1, 0, ceilY(SX1) - Y0 + 0.02), [], 0.004, [0.1, 0.9]);
    panel(bath, marble, { axis: 'x', c: SX1, n: 1 }, rect(15.35, SZ0, 0, ceilY(SX1) - Y0), [], 0.004, [0.2, 0]);   // partition end faces
    panel(bath, marble, { axis: 'x', c: SX1, n: 1 }, rect(SZ1, SZ1 + 0.25, 0, ceilY(SX1) - Y0), [], 0.004, [0.6, 0]);
    // passage / WC faces: light grasscloth
    panel(bath, grassLight, { axis: 'z', c: 15.35, n: -1 }, rect(BX0, SX1, 0, ceilY(SX1) - Y0), [rect(15.84, 16.54, 0, 2.10)]);
    panel(bath, grassLight, { axis: 'z', c: SZ1 + 0.25, n: 1 }, rect(BX0, SX1, 0, ceilY(SX1) - Y0));
    casing(bath, { axis: 'z', c: 15.35, n: -1 }, 15.84, 16.54, 2.10, 0.05);
    // WC door (closed oak slab) + lever
    const wcd = bx(bath, M.oakDoor, 15.845, 0.01, 15.45, 16.535, 2.095, 15.495); phys.solid(wcd);
    bx(bath, M.blackMetal, 16.36, 1.0, 15.415, 16.49, 1.018, 15.45);
    // half wall with marble on every face
    const hw = bx(bath, marbleBox, 18.25, 0, HW0, 18.43, HWH, HW1); phys.solid(hw);
    bx(bath, marbleBox, 18.235, HWH, HW0 - 0.01, 18.445, HWH + 0.02, HW1 + 0.01);
    // curb
    bx(bath, marbleBox, 18.22, 0, SZ0, 18.45, 0.035, SZ1);
    // glass: fixed panel over the half wall + two hinged doors (closed)
    const glass = (z0, z1, y0, y1) => {
      const m = bx(bath, showerGlass, GX - 0.005, y0, z0, GX + 0.005, y1, z1); m.castShadow = false; m.renderOrder = 2;
      const eg = (a0, a1, b0, b1, c0, c1) => { const k = bx(bath, glassEdge, a0, b0, c0, a1, b1, c1); k.castShadow = false; k.renderOrder = 3; };
      eg(GX - 0.005, GX + 0.005, y0, y1, z0, z0 + 0.004); eg(GX - 0.005, GX + 0.005, y0, y1, z1 - 0.004, z1);
      eg(GX - 0.005, GX + 0.005, y1 - 0.004, y1, z0, z1);
      return m;
    };
    const fixed = glass(HW0 + 0.02, HW1 - 0.02, HWH + 0.02, 2.25); phys.solid(fixed, 0.0);
    glass(SZ0 + 0.012, HW0 - 0.008, 0.045, 2.25); glass(HW1 + 0.008, SZ1 - 0.012, 0.045, 2.25); // doors (walk-through for players)
    // hinges on the partition faces, clamps on the half wall, D-pulls on both doors
    for (const [z, sgn] of [[SZ0, 1], [SZ1, -1]]) for (const y of [0.35, 1.95]) bx(bath, nickel, GX - 0.03, y, z + (sgn > 0 ? 0 : -0.06), GX + 0.03, y + 0.09, z + (sgn > 0 ? 0.06 : 0));
    for (const z of [HW0 + 0.12, 16.90, 17.40, HW1 - 0.12]) bx(bath, nickel, GX - 0.022, HWH + 0.02, z - 0.025, GX + 0.022, HWH + 0.07, z + 0.025);
    for (const z of [HW0 - 0.09, HW1 + 0.09]) for (const side of [1, -1]) {
      const xs = GX + side * 0.045;
      kit.add(bath, kit.cyl(0.009, 0.009, 0.30, 12), nickel, [xs, Y0 + 1.12, z]);
      kit.add(bath, kit.cyl(0.006, 0.006, 0.045, 8), nickel, [GX + side * 0.024, Y0 + 0.99, z], [0, 0, Math.PI / 2]);
      kit.add(bath, kit.cyl(0.006, 0.006, 0.045, 8), nickel, [GX + side * 0.024, Y0 + 1.25, z], [0, 0, Math.PI / 2]);
    }
    // shower fixtures on the back wall (p20/p21): two heads, slide bar + hand shower, two thermostatic trims
    const wx = SX0 + 0.006;
    for (const z of [16.77, 17.57]) {
      bx(bath, nickel, wx, 2.02, z - 0.035, wx + 0.012, 2.09, z + 0.035);
      kit.add(bath, kit.tube([[wx + 0.01, Y0 + 2.055, z], [wx + 0.14, Y0 + 2.07, z], [wx + 0.22, Y0 + 2.03, z]], 0.011, 16), nickel);
      const head = kit.add(bath, kit.lathe([[0, 0], [0.03, 0], [0.045, 0.04], [0.048, 0.055], [0, 0.058]], 24), nickel, [wx + 0.235, Y0 + 2.03, z], [0, 0, -Math.PI / 2 - 0.35]);
      bx(bath, nickel, wx, 1.08, z - 0.05, wx + 0.014, 1.30, z + 0.05);
      kit.add(bath, kit.cyl(0.012, 0.012, 0.05, 12), nickel, [wx + 0.035, Y0 + 1.22, z], [0, 0, Math.PI / 2]);
      bx(bath, nickel, wx + 0.05, 1.215, z - 0.005, wx + 0.06, 1.225, z + 0.07);
      kit.add(bath, kit.cyl(0.012, 0.012, 0.05, 12), nickel, [wx + 0.035, Y0 + 1.14, z], [0, 0, Math.PI / 2]);
    }
    kit.add(bath, kit.cyl(0.011, 0.011, 0.95, 12), nickel, [wx + 0.04, Y0 + 1.40, 17.17]);
    bx(bath, nickel, wx, 0.92, 17.15, wx + 0.04, 0.95, 17.19); bx(bath, nickel, wx, 1.86, 17.15, wx + 0.04, 1.89, 17.19);
    kit.add(bath, kit.cyl(0.016, 0.012, 0.24, 14), nickel, [wx + 0.075, Y0 + 1.66, 17.17], [0, 0, 0.12]);
    kit.add(bath, kit.lathe([[0, 0], [0.032, 0], [0.035, 0.02], [0, 0.024]], 20), nickel, [wx + 0.09, Y0 + 1.79, 17.17], [0, 0, -0.9]);
    kit.add(bath, kit.tube([[wx + 0.07, Y0 + 1.54, 17.17], [wx + 0.10, Y0 + 1.05, 17.20], [wx + 0.06, Y0 + 0.86, 17.23], [wx + 0.02, Y0 + 0.95, 17.23]], 0.007, 32), steel);
    // linear drain
    bx(bath, steel, 16.86, 0.006, SZ0 + 0.2, 16.92, 0.009, SZ1 - 0.2);
    // tub filler on the half wall's tub side (p20): wide valve plate + cross handles, spout, hand shower
    const fx = 18.43 + 0.004;
    bx(bath, nickel, fx, 0.74, 17.28, fx + 0.012, 0.83, 17.52);
    for (const z of [17.33, 17.47]) { kit.add(bath, kit.cyl(0.012, 0.012, 0.04, 12), nickel, [fx + 0.03, Y0 + 0.785, z], [0, 0, Math.PI / 2]); bx(bath, nickel, fx + 0.045, 0.78, z - 0.03, fx + 0.055, 0.79, z + 0.03); bx(bath, nickel, fx + 0.045, 0.755, z - 0.005, fx + 0.055, 0.815, z + 0.005); }
    bx(bath, nickel, fx, 0.73, 17.13, fx + 0.10, 0.765, 17.21);
    bx(bath, nickel, fx, 0.66, 16.91, fx + 0.03, 0.70, 16.95);
    kit.add(bath, kit.cyl(0.015, 0.011, 0.22, 14), nickel, [fx + 0.03, Y0 + 0.82, 16.93]);
    kit.add(bath, kit.lathe([[0, 0], [0.03, 0], [0.033, 0.018], [0, 0.022]], 20), nickel, [fx + 0.03, Y0 + 0.93, 16.93], [0, 0, -0.5]);
    kit.add(bath, kit.tube([[fx + 0.03, Y0 + 0.71, 16.93], [fx + 0.04, Y0 + 0.40, 16.92], [fx + 0.02, Y0 + 0.05, 16.91]], 0.006, 24), steel);
  }

  // ---- freestanding oval tub (p19/p20): lathe shell stretched along z
  {
    const L = 1.72, W = 0.80;
    const prof = [[0, 0.0], [0.27, 0.0], [0.30, 0.02], [0.33, 0.10], [0.365, 0.28], [0.39, 0.45], [0.40, 0.53], [0.398, 0.555], [0.383, 0.56], [0.372, 0.55], [0.36, 0.46], [0.33, 0.28], [0.29, 0.14], [0.24, 0.085], [0, 0.075]];
    const geo = kit.lathe(prof, 72); geo.scale(1, 1, L / W);
    { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.25) { const t = Math.pow(p.getZ(i) / (L / 2), 2); p.setY(i, y + (y - 0.25) / 0.35 * (0.07 * t * t - 0.02)); } } }
    geo.computeVertexNormals();
    const tub = kit.add(bath, geo, tubWhite, [18.88, Y0, 17.15]); tub.name = 'tub';
    tub.updateMatrixWorld(true);
    const wgeo = geo.clone().applyMatrix4(tub.matrixWorld); phys.trimesh(wgeo); // you can climb in
    kit.add(bath, kit.cyl(0.022, 0.022, 0.006, 16), nickel, [18.88, Y0 + 0.079, 16.75]);
  }

  // ---- vanity: long fluted white-oak double vanity, white quartz top, two undermount sinks (p19)
  const VZ0 = 15.10, VZ1 = 19.60, VF = 20.82; // front face x
  {
    const van = kit.group(bath, [0, 0, 0], 0, 'vanity');
    bx(van, oak, VF + 0.02, 0.09, VZ0, BX1, 0.86, VZ1);           // carcass
    bx(van, oak, VF + 0.08, 0, VZ0 + 0.02, BX1, 0.09, VZ1 - 0.02); // toe kick
    const segs = [4, 3, 2, 3, 3, 2, 3, 4]; const sw = (VZ1 - VZ0) / segs.length;
    const frame = 0.03, gap = 0.004;
    for (let s = 0; s < segs.length; s++) {
      const z0 = VZ0 + s * sw, n = segs[s];
      const hs = n === 2 ? [0.53, 0.235] : Array(n).fill(0.77 / n);
      let y = 0.09;
      for (const hh of hs) {
        const fz0 = z0 + gap, fz1 = z0 + sw - gap, fy0 = y + gap, fy1 = y + hh - gap;
        bx(van, oak, VF, fy0, fz0, VF + 0.02, fy0 + frame, fz1); bx(van, oak, VF, fy1 - frame, fz0, VF + 0.02, fy1, fz1);
        bx(van, oak, VF, fy0 + frame, fz0, VF + 0.02, fy1 - frame, fz0 + frame); bx(van, oak, VF, fy0 + frame, fz1 - frame, VF + 0.02, fy1 - frame, fz1);
        const fl = kit.add(van, fluteGeo(fz1 - fz0 - 2 * frame, fy1 - fy0 - 2 * frame), oakV, [VF + 0.018, Y0 + fy0 + frame, fz0 + frame]);
        knob(van, nickel, [VF - 0.002, Y0 + fy1 - Math.min(0.07, (fy1 - fy0) / 2), (fz0 + fz1) / 2], 'x-', 0.013);
        y += hh;
      }
    }
    // quartz top with sink cut-outs
    const sinksZ = [VZ0 + sw * 2.5, VZ0 + sw * 5.5];
    const shape = new THREE.Shape([new THREE.Vector2(VF - 0.02, VZ0 - 0.01), new THREE.Vector2(BX1, VZ0 - 0.01), new THREE.Vector2(BX1, VZ1 + 0.01), new THREE.Vector2(VF - 0.02, VZ1 + 0.01)]);
    for (const z of sinksZ) shape.holes.push(new THREE.Path([new THREE.Vector2(20.93, z - 0.24), new THREE.Vector2(20.93, z + 0.24), new THREE.Vector2(21.25, z + 0.24), new THREE.Vector2(21.25, z - 0.24)].map(v => v)));
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }); top.rotateX(Math.PI / 2); top.translate(0, Y0 + 0.895, 0);
    kit.add(van, top, M.whiteQuartz, [0, 0, 0]);
    bx(van, M.whiteQuartz, BX1 - 0.02, 0.895, VZ0 - 0.01, BX1, 1.0, VZ1 + 0.01); // backsplash
    for (const z of sinksZ) {
      kit.add(van, new THREE.BoxGeometry(0.31, 0.17, 0.47), ceramic, [21.09, Y0 + 0.78, z]);
      kit.add(van, kit.cyl(0.02, 0.02, 0.004, 16), nickel, [21.09, Y0 + 0.697, z]);
      // widespread faucet: arched spout + two lever handles
      kit.add(van, kit.cyl(0.022, 0.026, 0.05, 16), nickel, [21.30, Y0 + 0.885, z]);
      kit.add(van, kit.tube([[21.30, Y0 + 0.90, z], [21.30, Y0 + 1.07, z], [21.22, Y0 + 1.09, z], [21.17, Y0 + 1.03, z]], 0.011, 24), nickel);
      for (const dz of [-0.16, 0.16]) {
        kit.add(van, kit.cyl(0.018, 0.022, 0.06, 14), nickel, [21.30, Y0 + 0.92, z + dz]);
        bx(van, nickel, 21.25, 0.945, z + dz - 0.005, 21.31, 0.955, z + dz + 0.005);
      }
    }
    phys.solidGroup(van);

    // tall linen cabinet at the far end (p19)
    const tc = kit.group(bath, [0, 0, 0], 0, 'linen');
    bx(tc, oak, VF + 0.02, 0, BZ0, BX1, 2.42, VZ0 - 0.005);
    const fronts = [[0.09, 0.62], [0.63, 0.80], [0.81, 0.98], [0.99, 2.40]];
    for (const [a, b] of fronts) { bx(tc, oakV, VF, a, BZ0 + 0.004, VF + 0.02, b - 0.004, VZ0 - 0.009); knob(tc, nickel, [VF - 0.002, Y0 + (b - a > 0.3 ? (a < 0.5 ? b - 0.08 : a + 0.08) : (a + b) / 2), VZ0 - 0.06], 'x-', 0.012); }
    phys.solidGroup(tc);

    // big frameless mirror: real planar reflection (only rendered when the viewer is in the bath)
    const mw = VZ1 - VZ0 - 0.04, mh = 1.55;
    const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: 1536, textureHeight: 640, color: 0xd8d8d4 });
    mirror.position.set(BX1 - 0.012, Y0 + 1.02 + mh / 2, (VZ0 + VZ1) / 2); mirror.rotation.y = -Math.PI / 2; mirror.userData.keep = true; mirror.name = 'mirror';
    const orb = mirror.onBeforeRender;
    mirror.onBeforeRender = function (r, s, cam, ...rest) {
      const p = cam.position;
      if (p.x < BX0 - 0.2 || p.x > BX1 || p.z < BZ0 - 0.2 || p.z > BZ1 + 0.2 || p.y < Y0 || p.y > Y0 + 4) return;
      orb.call(this, r, s, cam, ...rest);
    };
    bath.add(mirror);
    bx(bath, std({ color: 0x9a9c98, roughness: 0.3 }), BX1 - 0.011, 1.015, VZ0 + 0.015, BX1 - 0.004, 1.025 + mh, VZ1 - 0.015);

    // double-drop glass sconces mounted on the mirror (p19)
    for (const z of [15.42, 17.35, 19.28]) {
      const sx = BX1 - 0.012; const y = 1.98;
      bx(bath, nickel, sx - 0.03, y - 0.09, z - 0.02, sx, y + 0.06, z + 0.02);
      bx(bath, nickel, sx - 0.11, y + 0.02, z - 0.012, sx - 0.03, y + 0.04, z + 0.012);
      bx(bath, nickel, sx - 0.125, y + 0.02, z - 0.13, sx - 0.105, y + 0.04, z + 0.13);
      for (const dz of [-0.12, 0.12]) {
        bx(bath, nickel, sx - 0.12, y - 0.04, z + dz - 0.008, sx - 0.11, y + 0.02, z + dz + 0.008);
        kit.add(bath, kit.cyl(0.016, 0.016, 0.02, 14), nickel, [sx - 0.115, Y0 + y - 0.05, z + dz]);
        const shade = kit.add(bath, kit.lathe([[0.012, 0], [0.02, -0.03], [0.036, -0.09], [0.05, -0.15], [0.052, -0.18], [0.04, -0.205], [0, -0.212]], 24), clearGlass, [sx - 0.115, Y0 + y - 0.06, z + dz]);
        shade.castShadow = false; shade.renderOrder = 2;
        kit.add(bath, kit.sphere(0.018, 12, 8), bulbGlow, [sx - 0.115, Y0 + y - 0.19, z + dz], [0, 0, 0], { shadow: false });
      }
    }

    // vanity styling: orchid between the sinks, soap pump + tray at the far end, hand towel
    const orchid = kit.group(bath, [21.13, Y0 + 0.93, 17.32], 0, 'orchid');
    kit.add(orchid, kit.lathe([[0, 0], [0.06, 0], [0.072, 0.02], [0.078, 0.13], [0.07, 0.135], [0, 0.125]], 32), potWhite, [0, 0, 0]);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; const lf = kit.add(orchid, kit.sphere(1, 16, 8), leafGreen, [Math.cos(a) * 0.07, 0.15, Math.sin(a) * 0.07], [0.2, -a, 0.5]); lf.scale.set(0.11, 0.012, 0.035); }
    const spike = (dx, dz, h, n) => {
      const pts = [[0, 0.13, 0], [dx * 0.2, 0.13 + h * 0.6, dz * 0.2], [dx * 0.7, 0.13 + h, dz * 0.7], [dx, 0.13 + h * 0.92, dz]];
      kit.add(orchid, kit.tube(pts, 0.003, 24), stem);
      for (let k = 0; k < n; k++) {
        const t = 0.45 + k * (0.5 / n); const px = dx * t, py = 0.13 + h * (0.75 + 0.2 * Math.sin(t * 3)), pz = dz * t;
        const fl = kit.group(orchid, [px, py, pz], R() * 6);
        for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5; const pe = kit.add(fl, kit.sphere(1, 10, 6), petal, [Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.0]); pe.scale.set(0.024, 0.024, 0.004); pe.rotation.z = a; }
        kit.add(fl, kit.sphere(0.008, 8, 6), std({ color: 0xf2d77a, roughness: 0.6 }), [0, 0, 0.006]);
        fl.rotation.y = Math.atan2(-1, 0) + (R() - 0.5) * 0.6; // face the room (-x)
      }
    };
    spike(-0.05, 0.10, 0.36, 5); spike(-0.08, -0.06, 0.30, 4);
    dyn.push([orchid, { mass: 1.6, shape: 'box' }]);
    const tray = bx(bath, M.whiteQuartz, 21.05, 0.93, 15.32, 21.30, 0.945, 15.62, 0.005); phys.solid(tray);
    for (const [z, c] of [[15.40, 0xe8e2d6], [15.53, 0x8c8a86]]) {
      const b = kit.group(bath, [21.18, Y0 + 0.945, z]);
      kit.add(b, kit.lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.15], [0.026, 0.165], [0.012, 0.175], [0, 0.175]], 20), std({ color: c, roughness: 0.35 }), [0, 0, 0]);
      kit.add(b, kit.cyl(0.006, 0.006, 0.04, 8), nickel, [0, 0.19, 0]); bx(b, nickel, -0.04, 0.2 - Y0, -0.005, 0, 0.21 - Y0, 0.005);
      dyn.push([b, { mass: 0.35, shape: 'box' }]);
    }
    const ht = kit.add(bath, kit.cushion(0.26, 0.05, 0.20, 0.02, 0.01), towelMat, [21.15, Y0 + 0.96, 19.30]); dyn.push([ht, { mass: 0.3 }]);
  }

  // ---- towels on hooks beside the closet door (p19 far wall)
  for (const x of [18.68, 19.08]) {
    kit.add(bath, kit.cyl(0.01, 0.012, 0.06, 10), nickel, [x, Y0 + 1.66, BZ0 + 0.03], [Math.PI / 2, 0, 0]);
    const t = kit.add(bath, kit.cushion(0.28, 0.50, 0.035, 0.015, 0.012), towelMat, [x, Y0 + 1.40, BZ0 + 0.045]);
    const t2 = kit.add(bath, kit.rbox(0.20, 0.06, 0.05, 0.02), towelMat, [x, Y0 + 1.63, BZ0 + 0.05]);
  }

  // ---- WC (behind the shower, not in any photo): toilet + paper holder
  {
    const wc = kit.group(bath, [16.18, Y0, 18.20], 0, 'toilet');
    kit.add(wc, kit.rbox(0.42, 0.36, 0.18, 0.03), tubWhite, [0, 0.62, 0.38]);
    kit.add(wc, kit.lathe([[0, 0], [0.12, 0], [0.14, 0.2], [0.19, 0.38], [0.2, 0.40], [0, 0.40]], 32), tubWhite, [0, 0, 0.12]).scale.set(1, 1, 1.35);
    phys.solidGroup(wc);
  }

  // ---- bath fill light (sconces + skylights read brighter in the photos than our shell lighting)
  const fill = new THREE.PointLight(0xfff4e6, 1.0, 7, 1.6); fill.position.set(19.3, Y0 + 2.5, 17.5); fill.castShadow = false; bath.add(fill);

  // ================================================================== VESTIBULE (coffee bar, p23)
  const vest = kit.group(root, [0, 0, 0], 0, 'vestibule');
  {
    const X0 = 15.54, X1 = 17.35, Z0 = 11.75, Z1 = 14.35, H = PLATE - Y0;
    // dark grasscloth walls
    panel(vest, grassDark, { axis: 'x', c: X0, n: 1 }, rect(Z0, Z1, 0, H), [rect(12.475, 13.325, 0, 2.30)]);
    panel(vest, grassDark, { axis: 'x', c: X1, n: -1 }, rect(Z0, Z1, 0, H));
    panel(vest, grassDark, { axis: 'z', c: Z0, n: 1 }, rect(X0, X1, 0, H), [rect(16.025, 16.875, 0, 2.30)]);
    panel(vest, grassDark, { axis: 'z', c: Z1, n: -1 }, rect(X0, X1, 0, H), [rect(15.975, 16.925, 0, 2.30)]);
    casing(vest, { axis: 'x', c: X0, n: 1 }, 12.475, 13.325, 2.30);
    casing(vest, { axis: 'z', c: Z0, n: 1 }, 16.025, 16.875, 2.30);
    casing(vest, { axis: 'z', c: Z1, n: -1 }, 15.975, 16.925, 2.30);
    kit.baseboards(vest, [X0, Z0, X1, Z1], Y0, 0.10, 0.014, M.paintWhite, [{ side: 'x0', from: 12.40, to: 13.40 }, { side: 'z0', from: 15.95, to: 16.95 }, { side: 'z1', from: 15.90, to: 17.0 }]);

    // ---- left run (x 15.54, facing +x): sink base + wine fridge, coffee-machine tower above
    const L = kit.group(vest, [0, 0, 0], 0, 'coffeeLeft');
    const LF = 16.12, LZ0 = 13.38;
    bx(L, oak, X0, 0.10, LZ0, LF, 0.88, Z1);
    bx(L, oak, X0, 0, LZ0 + 0.02, LF - 0.06, 0.10, Z1);
    const door = kit.add(L, kit.shakerFront(0.42, 0.76, 0.065, 0.02, 0.007), oak, [LF, Y0 + 0.11, Z1 - 0.005], [0, Math.PI / 2, 0]);
    knob(L, M.matteBlack, [LF + 0.022, Y0 + 0.80, 13.97], 'x+', 0.013);
    // wine fridge: oak frame + glass, dark interior with bottles
    const fz0 = LZ0 + 0.01, fz1 = 13.90;
    kit.add(L, kit.shakerFront(fz1 - fz0, 0.77, 0.06, 0.02, 0.02), oak, [LF, Y0 + 0.10, fz1], [0, Math.PI / 2, 0]);
    bx(L, fridgeDark, LF - 0.5, 0.17, fz0 + 0.05, LF - 0.005, 0.81, fz1 - 0.05);
    const gl = bx(L, clearGlass, LF + 0.006, 0.16, fz0 + 0.06, LF + 0.01, 0.82, fz1 - 0.06); gl.castShadow = false;
    for (let k = 0; k < 4; k++) {
      bx(L, steel, LF - 0.45, 0.24 + k * 0.15, fz0 + 0.05, LF - 0.03, 0.25 + k * 0.15, fz1 - 0.05);
      for (let b = 0; b < 4; b++) { const bt = kit.add(L, kit.cyl(0.035, 0.035, 0.36, 12), std({ color: [0x1b2a1c, 0x3a1416, 0x151515][(k + b) % 3], roughness: 0.2 }), [LF - 0.22, Y0 + 0.29 + k * 0.15, fz0 + 0.1 + b * 0.085], [0, 0, Math.PI / 2]); }
    }
    bx(L, M.matteBlack, LF + 0.02, 0.32, fz1 - 0.05, LF + 0.04, 0.72, fz1 - 0.03);
    bx(L, M.matteBlack, LF + 0.005, 0.34, fz1 - 0.05, LF + 0.02, 0.36, fz1 - 0.03); bx(L, M.matteBlack, LF + 0.005, 0.68, fz1 - 0.05, LF + 0.02, 0.70, fz1 - 0.03);
    // black marble top with a bar sink + backsplash
    const shp = new THREE.Shape([new THREE.Vector2(X0, LZ0 - 0.02), new THREE.Vector2(LF + 0.025, LZ0 - 0.02), new THREE.Vector2(LF + 0.025, Z1), new THREE.Vector2(X0, Z1)]);
    shp.holes.push(new THREE.Path([new THREE.Vector2(15.70, 13.92), new THREE.Vector2(15.70, 14.26), new THREE.Vector2(16.0, 14.26), new THREE.Vector2(16.0, 13.92)]));
    const ctop = new THREE.ExtrudeGeometry(shp, { depth: 0.035, bevelEnabled: false }); ctop.rotateX(Math.PI / 2); ctop.translate(0, Y0 + 0.915, 0);
    kit.add(L, ctop, marbleBlack, [0, 0, 0]);
    kit.add(L, new THREE.BoxGeometry(0.30, 0.18, 0.34), std({ color: 0x1a1a1a, roughness: 0.4, side: THREE.BackSide }), [15.85, Y0 + 0.79, 14.09]);
    bx(L, marbleBlack, X0, 0.915, LZ0 - 0.02, X0 + 0.02, 1.13, Z1);
    kit.add(L, kit.cyl(0.02, 0.024, 0.05, 14), M.matteBlack, [15.62, Y0 + 0.94, 14.10]);
    kit.add(L, kit.tube([[15.62, Y0 + 0.94, 14.10], [15.62, Y0 + 1.22, 14.10], [15.70, Y0 + 1.30, 14.10], [15.78, Y0 + 1.22, 14.10], [15.78, Y0 + 1.12, 14.10]], 0.012, 32), M.matteBlack);
    bx(L, M.matteBlack, X0 + 0.02, 1.0, 13.52, X0 + 0.03, 1.10, 13.58); bx(L, M.matteBlack, X0 + 0.02, 1.0, 13.62, X0 + 0.03, 1.10, 13.68);
    // upper tower: Wolf-style built-in coffee machine under an oak door, open shelves at the far side
    const UF = 15.90, UY0 = 1.42, UY1 = H - 0.01;
    bx(L, oak, X0, UY0, LZ0, UF - 0.02, UY1, Z1);
    bx(L, oak, X0, UY0 - 0.02, LZ0, UF, UY0, Z1);
    const cm = kit.group(L, [UF - 0.02, Y0 + UY0 + 0.03, 13.80]);
    bx(cm, steel, 0, 0 - Y0, 0, 0.025, 0.46 - Y0, 0.53);
    bx(cm, blackGlass, 0.024, 0.08 - Y0, 0.04, 0.03, 0.40 - Y0, 0.49);
    bx(cm, steel, 0.024, 0.41 - Y0, 0.10, 0.03, 0.44 - Y0, 0.43);
    bx(cm, std({ color: 0x1a1d22, roughness: 0.3, emissive: 0x223344, emissiveIntensity: 0.3 }), 0.025, 0.415 - Y0, 0.16, 0.032, 0.435 - Y0, 0.30);
    kit.add(cm, kit.cyl(0.012, 0.012, 0.06, 10), steel, [0.03, 0.30, 0.22]); kit.add(cm, kit.cyl(0.012, 0.012, 0.06, 10), steel, [0.03, 0.30, 0.30]);
    bx(cm, steel, 0.02, 0.10 - Y0, 0.16, 0.10, 0.12 - Y0, 0.36);
    kit.add(L, kit.shakerFront(0.55, UY1 - UY0 - 0.52, 0.065, 0.02, 0.007), oak, [UF - 0.02, Y0 + UY0 + 0.51, Z1 - 0.01], [0, Math.PI / 2, 0]);
    knob(L, M.matteBlack, [UF + 0.002, Y0 + UY0 + 0.57, 13.86], 'x+', 0.012);
    // open shelves (far side)
    bx(L, oak, X0, UY0, LZ0, UF, UY1, LZ0 + 0.02);
    for (const y of [UY0, 1.84, 2.26]) bx(L, oak, X0, y, LZ0, UF, y + 0.02, 13.78);
    bx(L, oak, X0, UY0, 13.76, UF, UY1, 13.78);
    phys.solidGroup(L);

    // ---- right run (x 17.35, facing -x): drawer bank, black marble top, uppers with open shelves
    const Rg = kit.group(vest, [0, 0, 0], 0, 'coffeeRight');
    const RF = 16.90;
    bx(Rg, oak, RF + 0.02, 0.10, Z0, X1, 0.88, Z1);
    bx(Rg, oak, RF + 0.08, 0, Z0, X1, 0.10, Z1);
    const cols = 4, cw = (Z1 - Z0) / cols;
    for (let c = 0; c < cols; c++) for (let d = 0; d < 4; d++) {
      const z0 = Z0 + c * cw + 0.003, y0 = 0.105 + d * 0.193;
      kit.add(Rg, kit.shakerFront(cw - 0.006, 0.188, 0.045, 0.02, 0.006), oak, [RF + 0.02, Y0 + y0, z0], [0, -Math.PI / 2, 0]);
      knob(Rg, M.matteBlack, [RF - 0.002, Y0 + y0 + 0.13, z0 + cw / 2], 'x-', 0.011);
    }
    bx(Rg, marbleBlack, RF - 0.025, 0.88, Z0, X1, 0.915, Z1);
    bx(Rg, marbleBlack, X1 - 0.02, 0.915, Z0, X1, 1.07, Z1);
    // uppers
    const RU = 17.0;
    bx(Rg, oak, RU + 0.02, 1.45, Z0, X1, UY1, Z1);
    bx(Rg, oak, RU, 1.43, Z0, X1, 1.45, Z1);
    kit.add(Rg, kit.shakerFront(0.78, UY1 - 1.46, 0.065, 0.02, 0.007), oak, [RU + 0.02, Y0 + 1.455, Z0 + 0.01], [0, -Math.PI / 2, 0]);
    knob(Rg, M.matteBlack, [RU - 0.002, Y0 + 1.55, 12.70], 'x-', 0.012);
    for (const z of [12.80, 13.58, Z1 - 0.02]) bx(Rg, oak, RU, 1.45, z, X1, UY1, z + 0.02);
    for (const y of [1.45, 1.92, 2.36]) bx(Rg, oak, RU, y, 12.80, X1, y + 0.022, Z1);
    phys.solidGroup(Rg);
    // decor on the right counter: white coral, coffee-table books, brass wire sphere
    const coral = kit.group(vest, [17.15, Y0 + 0.915 + 0.095, 12.12]);
    for (let i = 0; i < 14; i++) { const b = kit.add(coral, new THREE.IcosahedronGeometry(0.018 + R() * 0.014, 1), std({ color: 0xf2efe8, roughness: 0.85, flatShading: true }), [(R() - 0.5) * 0.10, 0.02 + R() * 0.05, (R() - 0.5) * 0.12]); }
    dyn.push([coral, { mass: 0.8, shape: 'box' }]);
    const books = kit.group(vest, [17.15, Y0 + 0.915, 12.12], Math.PI / 2);
    kit.add(books, kit.rbox(0.20, 0.035, 0.28, 0.004), std({ color: 0xd9d2c3, roughness: 0.8 }), [0, 0.018, 0]);
    kit.add(books, kit.rbox(0.19, 0.03, 0.26, 0.004), std({ color: 0x2b2622, roughness: 0.7 }), [0, 0.051, 0.01]);
    kit.add(books, kit.rbox(0.18, 0.028, 0.25, 0.004), std({ color: 0xb08d55, roughness: 0.7 }), [0.005, 0.08, -0.01]);
    dyn.push([books, { mass: 1.2 }]);
    const ball = kit.group(vest, [17.02, Y0 + 0.915 + 0.072, 12.40]);
    for (let i = 0; i < 6; i++) { const t = kit.add(ball, kit.torus(0.07, 0.004, 6, 32), M.brass, [0, 0, 0]); t.rotation.set(R() * 3, R() * 3, R() * 3); }
    dyn.push([ball, { mass: 0.4, shape: 'ball' }]);
    // ceiling: return-air grille + cans
    const gr = kit.group(vest, [16.12, PLATE - 0.006, 13.75]);
    kit.add(gr, new THREE.BoxGeometry(0.62, 0.012, 0.34), M.paintWhite, [0, 0, 0]);
    for (let i = 0; i < 18; i++) kit.add(gr, new THREE.BoxGeometry(0.003, 0.012, 0.30), std({ color: 0x8e8c88, roughness: 0.8 }), [-0.28 + i * 0.033, -0.003, 0]);
    kit.canLights(vest, [[16.45, 12.55], [16.90, 13.80]], PLATE);
    const vl = new THREE.PointLight(0xffe9cf, 2.2, 4.5, 1.6); vl.position.set(16.45, PLATE - 0.4, 13.1); vl.castShadow = false; vest.add(vl);
  }

  // ================================================================== PRIMARY CLOSET (plain walk-in)
  {
    const cl = kit.group(root, [0, 0, 0], 0, 'primaryCloset');
    const X0 = 17.50, Z0 = 9.05, X1 = 22.80, Z1 = 14.06;
    const white = M.paintWhite;
    kit.baseboards(cl, [X0, Z0, X1, Z1], Y0, 0.10, 0.014, M.paintWhite, [{ side: 'z1', from: 19.40, to: 20.30 }]);
    casing(cl, { axis: 'z', c: Z1, n: -1 }, 19.425, 20.275, 2.35);
    const garmentCols = [0x2b2b2e, 0xe8e3da, 0x8a8f99, 0x4a5a6e, 0xc9bca6, 0x1f2a3a, 0xf3f1ec, 0x6b5a4c];
    // a run of hanging sections along a wall. axis 'x': wall at x=c, runs along z; 'z': wall at z=c, runs along x
    function run(axis, c, n, a0, a1) {
      const g = kit.group(cl, [0, 0, 0]); const D = 0.60;
      const B = (s0, y0, d0, s1, y1, d1, m) => axis === 'x' ? bx(g, m, Math.min(c + n * d0, c + n * d1), y0, s0, Math.max(c + n * d0, c + n * d1), y1, s1) : bx(g, m, s0, y0, Math.min(c + n * d0, c + n * d1), s1, y1, Math.max(c + n * d0, c + n * d1));
      const nb = Math.max(1, Math.round((a1 - a0) / 0.9)); const bw = (a1 - a0) / nb;
      for (let i = 0; i <= nb; i++) B(a0 + i * bw - 0.01, 0, 0, a0 + i * bw + 0.01, 2.40, D, white);
      B(a0, 2.38, 0, a1, 2.40, D, white); B(a0, 1.98, 0, a1, 2.0, D, white); B(a0, 0, 0.02, a1, 0.10, D - 0.04, white);
      for (let i = 0; i < nb; i++) {
        const s0 = a0 + i * bw + 0.01, s1 = s0 + bw - 0.02;
        if (i % 3 === 1) { // drawer stack + shelf
          for (let d = 0; d < 4; d++) B(s0 + 0.004, 0.10 + d * 0.2 + 0.004, D - 0.02, s1 - 0.004, 0.10 + (d + 1) * 0.2 - 0.004, D, oak);
          B(s0, 0.9, 0, s1, 0.92, D, white); B(s0, 1.45, 0, s1, 1.47, D, white);
          for (let k = 0; k < 5; k++) B(s0 + 0.05 + k * 0.15, 0.92, 0.1, s0 + 0.17 + k * 0.15, 0.95 + R() * 0.25, 0.5, std({ color: garmentCols[(k + i) % 8], roughness: 0.9 }));
        } else { // hanging
          const rodD = D / 2; const rod = axis === 'x' ? kit.add(g, kit.cyl(0.014, 0.014, s1 - s0, 12), nickel, [c + n * rodD, Y0 + 1.90, (s0 + s1) / 2], [Math.PI / 2, 0, 0]) : kit.add(g, kit.cyl(0.014, 0.014, s1 - s0, 12), nickel, [(s0 + s1) / 2, Y0 + 1.90, c + n * rodD], [0, 0, Math.PI / 2]);
          for (let k = 0; k < Math.floor((s1 - s0) / 0.07); k++) {
            const s = s0 + 0.05 + k * 0.07, len = 0.7 + R() * 0.6; const col = garmentCols[Math.floor(R() * 8)];
            B(s - 0.012, 1.88 - len, 0.08, s + 0.012, 1.88, D - 0.08, std({ color: col, roughness: 0.95 }));
          }
        }
      }
      phys.solidGroup(g); return g;
    }
    run('x', X0, 1, Z0, 13.90);          // SW wall
    run('z', Z0, 1, X0 + 0.62, X1 - 0.62); // NW wall
    run('x', X1, -1, Z0, 11.70);         // NE wall, stops short of the window
    // island: oak drawers, white top
    const isl = kit.group(cl, [0, 0, 0], 0, 'island');
    bx(isl, oak, 19.35, 0.08, 10.95, 20.95, 0.88, 12.05); bx(isl, oak, 19.42, 0, 11.02, 20.88, 0.08, 11.98);
    bx(isl, M.whiteQuartz, 19.30, 0.88, 10.90, 21.00, 0.92, 12.10);
    for (let c = 0; c < 3; c++) for (let d = 0; d < 3; d++) for (const side of [-1, 1]) {
      const z = side < 0 ? 10.945 : 12.055; knob(isl, M.brushedNickel, [19.35 + 0.27 + c * 0.53, Y0 + 0.2 + d * 0.26 + 0.12, z + side * 0.003], side < 0 ? 'z-' : 'z+', 0.012);
    }
    phys.solidGroup(isl);
    const hb = kit.add(cl, kit.cyl(0.14, 0.14, 0.16, 24), std({ color: 0xe9e1d2, roughness: 0.8 }), [20.4, Y0 + 1.0, 11.5]); dyn.push([hb, { mass: 0.5 }]);
    const sb = kit.add(cl, kit.rbox(0.34, 0.12, 0.22, 0.004), std({ color: 0x2b2522, roughness: 0.7 }), [19.8, Y0 + 0.98, 11.4]); dyn.push([sb, { mass: 0.6 }]);
  }

  // ------------------------------------------------------------------ physics props + merge
  for (const [o, opt] of dyn) { o.userData.dynamic = true; phys.dynamic(o, opt); }
  kit.mergeStatic(root);
}
