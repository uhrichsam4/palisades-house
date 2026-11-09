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
  p19: { pos: [19.70, Y0 + 1.45, 19.95], look: [19.0, Y0 + 1.30, 14.5], fov: 66 }, // from the rear wall, down the room
  p20: { pos: [20.55, Y0 + 1.02, 17.15], look: [15.69, Y0 + 1.02, 17.15], fov: 56 },
  p21: { pos: [18.28, Y0 + 1.28, 15.80], look: [17.22, Y0 + 1.28, 17.00], fov: 58 }, // inside the shower by the -z door
  p23: { pos: [16.66, Y0 + 1.42, 14.82], look: [15.92, Y0 + 1.26, 11.75], fov: 66 }, // shot from the bath, through the cased opening
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
  const grassLight = std({ map: grassTex([202, 195, 184], 22, 16, 3), roughness: 0.95, normalMap: kit.noiseNormal(256, 2.0, 64, 9), normalScale: new THREE.Vector2(0.25, 0.25) });
  grassLight.normalMap.repeat.set(2, 2);
  const grassDark = std({ map: grassTex([58, 52, 46], 34, 40, 5), roughness: 0.92, normalMap: kit.noiseNormal(256, 2.0, 64, 11), normalScale: new THREE.Vector2(0.35, 0.35) });
  grassDark.normalMap.repeat.set(2, 2);

  // marble: large-format slabs (1.2 x 2.4 m). Light = warm cream with soft, broad, low-contrast diagonal
  // grey veins (p20/p21); dark = Nero Marquina (near-black, bold white veins, p23).
  function marbleCanvas(seed, dark) {
    return kit.canvasTex(1024, 2048, (g, w, h) => {
      const r = kit.rng(seed);
      g.fillStyle = dark ? '#262321' : '#e2ddd6'; g.fillRect(0, 0, w, h);
      // low-frequency tonal clouds (kills the flat CG look)
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * h, rad = 120 + r() * 420;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const c = dark ? `rgba(${52 + r() * 16 | 0},${46 + r() * 14 | 0},${40 + r() * 12 | 0},0.20)`
          : (r() < 0.5 ? `rgba(${232 + r() * 8 | 0},${226 + r() * 8 | 0},${216 + r() * 8 | 0},0.05)` : `rgba(${228 + r() * 10 | 0},${228 + r() * 10 | 0},${226 + r() * 10 | 0},0.04)`);
        gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      // gently wandering vein (low wiggle = long soft diagonal drifts, not cracks)
      const vein = (x, y, a, len, wid, col, blur, wig = 0.07) => {
        g.save(); g.filter = blur ? `blur(${blur}px)` : 'none'; g.beginPath(); g.moveTo(x, y);
        let da = 0;
        for (let i = 0; i < len; i += 10) { da = da * 0.9 + (r() - 0.5) * wig; a += da * 0.3; x += Math.cos(a) * 10; y += Math.sin(a) * 10; g.lineTo(x, y); }
        g.strokeStyle = col; g.lineWidth = wid; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore();
      };
      if (dark) {
        for (let i = 0; i < 6; i++) {
          const x = r() * w * 1.4 - w * 0.2, y = h * (0.1 + r() * 1.0), a = -0.6 - r() * 0.7, len = 900 + r() * 1500;
          vein(x, y, a, len, 14 + r() * 10, 'rgba(210,210,206,0.10)', 6, 0.18);
          vein(x, y, a, len, 2.5 + r() * 3.5, 'rgba(236,230,220,0.85)', 0.6, 0.18);
          for (let k = 0; k < 3; k++) vein(x + (r() - 0.5) * 400, y - r() * 500, a + (r() - 0.5) * 1.4, 100 + r() * 350, 0.8 + r() * 1.4, 'rgba(232,231,226,0.6)', 0, 0.3);
        }
      } else {
        // Calacatta/Volakas-type: bright white field, crisp fine grey veins on long diagonals + faint ghosts
        /* p20/p21: soft, long, nearly straight grey-beige drifts on a shared diagonal, low contrast (no curly hairlines) */
        for (let i = 0; i < 11; i++) {
          const x = r() * w * 1.8 - w * 0.4, y = h * (0.2 + r() * 1.0), a = -1.02 - r() * 0.16, len = 1800 + r() * 1400;
          vein(x, y, a, len, 40 + r() * 40, 'rgba(170,164,154,0.07)', 22, 0.012);
          vein(x, y, a, len, 5 + r() * 5, 'rgba(150,142,130,0.13)', 3, 0.012);
          vein(x, y, a, len, 1.2 + r() * 1.4, 'rgba(138,130,118,0.30)', 1.4, 0.012);
          if (r() < 0.6) vein(x + (r() - 0.5) * 200, y - r() * 300, a + (r() - 0.5) * 0.12, 500 + r() * 700, 0.8 + r() * 0.8, 'rgba(150,142,132,0.22)', 0.9, 0.01);
        }
      }
      // slab joints (visible hairline seams between 1.2 x 2.4 m panels)
      g.fillStyle = dark ? 'rgba(0,0,0,0.7)' : 'rgba(150,143,134,0.85)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    }, { repeat: [1 / 1.2, 1 / 2.4] });
  }
  // polished slab: glossy clearcoat over a slightly satin base so it reads wet-bright with crisp highlights
  const marble = physM({ map: marbleCanvas(77, false), roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.8 });
  const marbleBox = physM({ map: marbleCanvas(78, false), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.8 }); marbleBox.map.repeat.set(1, 1);
  const marbleBlack = std({ map: marbleCanvas(91, true), color: 0xfff4e8, roughness: 0.24, envMapIntensity: 0.3 }); /* p23: warm charcoal, low env so the sky reflection doesn't tint it navy */ marbleBlack.map.repeat.set(1, 1);

  // waterjet "chain ring" mosaic floor (p19): white marble field, taupe striated rings with brown outlines
  // Rings ~0.27 m across on a 0.26 m grid, each overlapping its neighbours (woven: horizontal crossings
  // over, vertical crossings under). Band = short strip-cut arcs in warm taupe/greige with brown outlines.
  const MP = 0.24; // ring pitch (m)
  const mosaicMap = kit.canvasTex(1024, 1024, (g, w) => {
    const P = w / 2; const r = kit.rng(21);
    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 26; i++) { // faint grey marble drift in the white field
      g.strokeStyle = `rgba(178,174,168,${0.10 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); let x = r() * w, y = r() * w; g.moveTo(x, y);
      let a = r() * 6; for (let k = 0; k < 40; k++) { a += (r() - 0.5) * 0.25; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); } g.stroke();
    }
    const Ro = P * 0.535, Ri = P * 0.37;
    const tones = ['#bfae99', '#ab9883', '#c9b9a5', '#a08c77', '#b5a28c', '#cfc0ad'];
    const ring = (cx, cy, a0 = 0, a1 = Math.PI * 2, clipFn) => {
      g.save();
      if (clipFn) clipFn();
      const nSeg = 30; const da = Math.PI * 2 / nSeg;
      for (let s = 0; s < nSeg; s++) { // strip-cut arc pieces
        const s0 = s * da + 0.004, s1 = (s + 1) * da - 0.004;
        g.beginPath(); g.arc(cx, cy, Ro, s0, s1); g.arc(cx, cy, Ri, s1, s0, true); g.closePath();
        g.fillStyle = tones[(r() * tones.length) | 0]; g.fill();
        g.strokeStyle = 'rgba(110,94,78,0.35)'; g.lineWidth = 0.8; // fine grain across the strip
        for (let k = 0; k < 4; k++) { const rr = Ri + (Ro - Ri) * (0.15 + r() * 0.7); g.beginPath(); g.arc(cx, cy, rr, s0 + r() * 0.05, s1 - r() * 0.05); g.stroke(); }
      }
      g.strokeStyle = '#9b8b7a'; g.lineWidth = 2; // grout between pieces
      for (let s = 0; s < nSeg; s++) { const a = s * da; g.beginPath(); g.moveTo(cx + Math.cos(a) * Ri, cy + Math.sin(a) * Ri); g.lineTo(cx + Math.cos(a) * Ro, cy + Math.sin(a) * Ro); g.stroke(); }
      g.strokeStyle = '#5a4434'; g.lineWidth = 9; // brown waterjet outlines
      g.beginPath(); g.arc(cx, cy, Ro - 3, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, Ri + 3, 0, Math.PI * 2); g.stroke();
      g.restore();
    };
    const cells = []; for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) cells.push([i, j]);
    for (const [i, j] of cells) if ((i + j) % 2 === 0) ring(i * P, j * P);
    for (const [i, j] of cells) if ((i + j) % 2 !== 0) ring(i * P, j * P);
    // weave: even rings go back over at their left/right crossings
    for (const [i, j] of cells) if ((i + j) % 2 === 0) ring(i * P, j * P, 0, 0, () => {
      const cx = i * P, cy = j * P; g.beginPath();
      g.moveTo(cx, cy); g.lineTo(cx + Ro * 1.2, cy - Ro * 0.75); g.lineTo(cx + Ro * 1.2, cy + Ro * 0.75); g.closePath();
      g.moveTo(cx, cy); g.lineTo(cx - Ro * 1.2, cy + Ro * 0.75); g.lineTo(cx - Ro * 1.2, cy - Ro * 0.75); g.closePath();
      g.clip();
    });
  }, { repeat: [1 / (2 * MP), 1 / (2 * MP)] });
  const mosaic = std({ map: mosaicMap, roughness: 0.3 });

  const tubWhite = physM({ color: 0xf7f6f3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
  const ceramic = physM({ color: 0xf7f7f5, roughness: 0.12, clearcoat: 0.6, side: THREE.BackSide });
  // polished nickel (LOOKDEV recipe, a touch warm like the photos' fixtures) + warm nickel for trims
  // polished nickel (LOOKDEV): cool, silvery, mirror-like (the photos' fixtures are not brass)
  const nickel = physM({ color: 0xc9c2b6, roughness: 0.15, metalness: 1.0, envMapIntensity: 0.9 }); /* p20/p21: warm polished nickel, reads mid-grey-champagne, not white chrome */
  const warmNickel = nickel;
  const clipMat = physM({ color: 0xd4d6d8, roughness: 0.16, metalness: 1.0 });
  const steel = physM({ color: 0xc8cacc, roughness: 0.32, metalness: 1.0, anisotropy: 0.7 });
  const blackGlass = std({ color: 0x050505, roughness: 0.05, metalness: 0.2 });
  const showerGlass = physM({ color: 0xf6faf8, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.09, envMapIntensity: 0.5, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1, ior: 1.5 });
  const glassEdge = std({ color: 0xdfe9e5, roughness: 0.1, transparent: true, opacity: 0.32 }); // low-iron: barely tinted edges
  const clearGlass = physM({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2, specularIntensity: 1, ior: 1.5 });
  const fridgeGlass = physM({ color: 0x2a2d2d, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 0.8, specularIntensity: 1 });
  const skyGlow = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 1,
    emissiveMap: kit.canvasTex(128, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(0.6, '#e6eefa'); gr.addColorStop(1, '#d4e2f4'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });
  const bulbGlow = std({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 9, roughness: 1 });
  const ceil = std({ color: 0xf2efe9, roughness: 0.95, side: THREE.DoubleSide });
  const towelMat = kit.fabric?.cotton ? kit.fabric.cotton('#cfcac2') : std({ color: 0xb3afa8, roughness: 1 });
  // warm honey white oak (#c9955e in p19, #d1a46c in p23): the veneer scan is grey-brown, so tint away the blue
  const honeyTex = (seed, rot) => kit.canvasTex(512, 1024, (g, w, h) => {
    const r = kit.rng(seed);
    g.fillStyle = '#cf9f66'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1 + r() * 3) { // straight rift/quarter-sawn grain lines with slow wander
      const t = r(); g.strokeStyle = t < 0.5 ? `rgba(168,116,62,${0.10 + r() * 0.22})` : `rgba(226,186,132,${0.10 + r() * 0.22})`;
      g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); let xx = x; g.moveTo(xx, 0);
      for (let y = 0; y <= h; y += 64) { xx += (r() - 0.5) * 1.6; g.lineTo(xx, y); } g.stroke();
    }
    for (let i = 0; i < 26; i++) { // ray-fleck flakes typical of white oak
      g.fillStyle = `rgba(232,196,146,${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 2 + r() * 5, 10 + r() * 40);
    }
    for (let i = 0; i < 10; i++) { const x = r() * w; const gr = g.createLinearGradient(x - 40, 0, x + 40, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(150,100,50,${0.05 + r() * 0.07})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 40, 0, 80, h); }
  }, { repeat: [1 / 0.45, 1 / 0.9] });
  const oak = M.oakCabinet.clone(); oak.map = honeyTex(5); oak.color.set(0xffffff);
  const oakV = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1], rotation: Math.PI / 2 }), color: 0xffffff, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) });
  oakV.map = honeyTex(6); oakV.map.repeat.set(1, 1);
  const oakDark = std({ color: 0x3a2a1c, roughness: 0.8 }); // reveals / toe kick shadow
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
    const base = new THREE.CylinderGeometry(r, r, h, 8, 1, true, 0, Math.PI); base.rotateY(Math.PI);
    const geos = []; for (let i = 0; i < n; i++) { const g = base.clone(); g.translate(0, h / 2, r + i * 2 * r); geos.push(g); }
    return kit.mergeGeometries(geos);
  }
  const dyn = []; // dynamic props, made physical after placement

  // ================================================================== PRIMARY BATH
  const bath = kit.group(root, [0, 0, 0], 0, 'primaryBath');
  kit.floorFinish(bath, 'primaryBath', mosaic);

  // ---- ceiling: asymmetric gable with skylight wells
  const skylights = [
    { x0: 19.05, x1: 20.15, z0: 16.10, z1: 17.00 },   // over the tub / vanity aisle (p19 centre)
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
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; bath.add(m); return m;
    };
    for (const s of skylights) {
      const top = Math.max(ceilY(s.x0), ceilY(s.x1)) + 0.42;
      const f0 = ceilY(s.x0), f1 = ceilY(s.x1);
      quad([[s.x0, f0, s.z0], [s.x1, f1, s.z0], [s.x1, top, s.z0], [s.x0, top, s.z0]], ceil);
      quad([[s.x0, f0, s.z1], [s.x1, f1, s.z1], [s.x1, top, s.z1], [s.x0, top, s.z1]], ceil);
      quad([[s.x0, f0, s.z0], [s.x0, f0, s.z1], [s.x0, top, s.z1], [s.x0, top, s.z0]], ceil);
      quad([[s.x1, f1, s.z0], [s.x1, f1, s.z1], [s.x1, top, s.z1], [s.x1, top, s.z0]], ceil);
      quad([[s.x0, top, s.z0], [s.x1, top, s.z0], [s.x1, top, s.z1], [s.x0, top, s.z1]], skyGlow); // glazing blocks the sun: soft, even skylight, no leaf dapple
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
    for (const [x, z] of [[20.35, 15.6], [20.35, 17.4], [20.35, 19.2], [19.4, 20.4], [17.6, 19.8], [17.3, 15.2]]) can(x, z);
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
    // shower ceiling (p20/p21): its own white plaster slope, low over the fixture wall (2.42 m) rising toward the
    // glass, with two narrow skylight wells (0.5 x 1.1 m, 0.6 m apart) punched up through it; a plaster bulkhead
    // above the glass line closes it to the room's higher cathedral slope.
    {
      const sh = (x) => Y0 + 2.42 + (x - SX0) * 0.28;
      const wells = [{ x0: 16.84, x1: 17.94, z0: 16.26, z1: 16.86 }, { x0: 16.84, x1: 17.94, z0: 17.44, z1: 18.04 }];
      const shape = new THREE.Shape([new THREE.Vector2(SX0 - 0.01, SZ0 - 0.01), new THREE.Vector2(SX1, SZ0 - 0.01), new THREE.Vector2(SX1, SZ1 + 0.01), new THREE.Vector2(SX0 - 0.01, SZ1 + 0.01)]);
      for (const s of wells) shape.holes.push(new THREE.Path([new THREE.Vector2(s.x0, s.z0), new THREE.Vector2(s.x0, s.z1), new THREE.Vector2(s.x1, s.z1), new THREE.Vector2(s.x1, s.z0)]));
      const geo = new THREE.ShapeGeometry(shape); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, sh(x), z); }
      geo.computeVertexNormals();
      const cm = new THREE.Mesh(geo, ceil); cm.name = 'ceiling:shower'; cm.castShadow = true; cm.receiveShadow = true; bath.add(cm);
      const q = (pts, mat) => {
        const g = new THREE.BufferGeometry(); const [a, b, c, d] = pts;
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; bath.add(m); return m;
      };
      // bulkhead face above the glass, facing the room (+x)
      const bh0 = sh(SX1), bh1 = ceilY(SX1) + 0.02;
      q([[SX1, bh0, SZ0 - 0.01], [SX1, bh0, SZ1 + 0.01], [SX1, bh1, SZ1 + 0.01], [SX1, bh1, SZ0 - 0.01]], ceil);
      q([[SX1, bh0, SZ1 + 0.01], [SX1, bh0, SZ0 - 0.01], [SX1, bh1, SZ0 - 0.01], [SX1, bh1, SZ1 + 0.01]], ceil);
      for (const s of wells) {
        const top = sh(s.x1) + 0.17, f0 = sh(s.x0), f1 = sh(s.x1), lean = -0.24; // top shifted toward -x, kept under the room slope
        const t0 = s.x0 + lean, t1 = s.x1 + lean;
        q([[s.x0, f0, s.z0], [s.x1, f1, s.z0], [t1, top, s.z0], [t0, top, s.z0]], ceil);
        q([[s.x0, f0, s.z1], [s.x1, f1, s.z1], [t1, top, s.z1], [t0, top, s.z1]], ceil);
        q([[s.x0, f0, s.z0], [s.x0, f0, s.z1], [t0, top, s.z1], [t0, top, s.z0]], ceil);
        q([[s.x1, f1, s.z0], [s.x1, f1, s.z1], [t1, top, s.z1], [t1, top, s.z0]], ceil);
        q([[t0, top, s.z0], [t1, top, s.z0], [t1, top, s.z1], [t0, top, s.z1]], skyGlow);
      }
    }
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
    // thin marble threshold under the glass (the mosaic runs on into the shower)
    bx(bath, marbleBox, GX - 0.04, 0, SZ0, GX + 0.04, 0.012, SZ1);
    // glass: fixed panel over the half wall + two hinged doors (closed; the -z one stands open for p21)
    const glass = (parent, z0, z1, y0, y1) => {
      const m = bx(parent, showerGlass, GX - 0.005, y0, z0, GX + 0.005, y1, z1); m.castShadow = false; m.renderOrder = 2;
      const eg = (a0, a1, b0, b1, c0, c1) => { const k = bx(parent, glassEdge, a0, b0, c0, a1, b1, c1); k.castShadow = false; k.renderOrder = 3; };
      eg(GX - 0.005, GX + 0.005, y0, y1, z0, z0 + 0.003); eg(GX - 0.005, GX + 0.005, y0, y1, z1 - 0.003, z1);
      eg(GX - 0.005, GX + 0.005, y1 - 0.003, y1, z0, z1); eg(GX - 0.005, GX + 0.005, y0, y0 + 0.003, z0, z1);
      return m;
    };
    const fixed = glass(bath, HW0 + 0.02, HW1 - 0.02, HWH + 0.02, 2.25); phys.solid(fixed, 0.0);
    // small polished clips: a pair of plates straddling the glass
    const clip = (parent, y, z, w = 0.03, h = 0.035) => {
      for (const s of [-1, 1]) bx(parent, clipMat, GX + s * 0.0055 - (s < 0 ? 0.009 : 0), y, z - w / 2, GX + s * 0.0055 + (s > 0 ? 0.009 : 0), y + h, z + w / 2, 0.002);
    };
    for (const z of [HW0 + 0.10, (HW0 + HW1) / 2, HW1 - 0.10]) clip(bath, HWH + 0.02, z);
    const doorP21 = ctx.params?.get?.('view') === 'p21';
    for (const [hz, z0, z1, sgn] of [[SZ0, SZ0 + 0.012, HW0 - 0.008, 1], [SZ1, HW1 + 0.008, SZ1 - 0.012, -1]]) {
      if (doorP21 && sgn > 0) continue; // photo p21 is shot through the open -z door
      const dg = kit.group(bath, [GX, 0, hz], 0); // pivot on the hinge line
      const inner = kit.group(dg, [-GX, 0, -hz]);
      glass(inner, z0, z1, 0.045, 2.25);
      // hinges: 6 cm plates on the glass + a leaf on the marble partition face
      for (const y of [0.30, 1.88]) {
        clip(inner, y, hz + sgn * 0.045, 0.06, 0.07);
        bx(inner, clipMat, GX - 0.02, y, sgn > 0 ? hz : hz - 0.008, GX + 0.02, y + 0.07, sgn > 0 ? hz + 0.008 : hz, 0.002);
        kit.add(inner, kit.cyl(0.009, 0.009, 0.07, 14), nickel, [GX, Y0 + y + 0.035, hz + sgn * 0.012]);
      }
      // D-pull on both sides
      const pz = sgn > 0 ? z1 - 0.09 : z0 + 0.09;
      for (const side of [1, -1]) {
        kit.add(inner, kit.cyl(0.009, 0.009, 0.30, 16), nickel, [GX + side * 0.045, Y0 + 1.12, pz]);
        kit.add(inner, kit.cyl(0.006, 0.006, 0.045, 10), nickel, [GX + side * 0.024, Y0 + 0.99, pz], [0, 0, Math.PI / 2]);
        kit.add(inner, kit.cyl(0.006, 0.006, 0.045, 10), nickel, [GX + side * 0.024, Y0 + 1.25, pz], [0, 0, Math.PI / 2]);
      }
    }
    // shower fixtures on the back wall (p20/p21): two heads on square flanges, slide bar + hand shower,
    // two square thermostatic trims (~14 x 22 cm) in polished warm nickel
    const wx = SX0 + 0.006;
    const headGeo = kit.lathe([[0, 0], [0.016, 0], [0.026, 0.008], [0.046, 0.013], [0.05, 0.019], [0.048, 0.024], [0, 0.026]], 32);
    for (const z of [16.77, 17.57]) {
      bx(bath, warmNickel, wx, 2.03, z - 0.035, wx + 0.012, 2.10, z + 0.035, 0.003);
      kit.add(bath, kit.tube([[wx + 0.01, Y0 + 2.065, z], [wx + 0.12, Y0 + 2.065, z], [wx + 0.25, Y0 + 2.05, z]], 0.01, 16), warmNickel);
      kit.add(bath, kit.cyl(0.014, 0.016, 0.03, 16), warmNickel, [wx + 0.26, Y0 + 2.035, z]);
      kit.add(bath, headGeo, warmNickel, [wx + 0.265, Y0 + 2.02, z], [0, 0, -Math.PI + 0.3]);
    }
    // thermostatic trim (big square ~0.16 m, two levers) by the near head; small volume-valve trim by the far one
    {
      const z = 16.77;
      bx(bath, warmNickel, wx, 1.06, z - 0.08, wx + 0.014, 1.22, z + 0.08, 0.004);
      for (const [y, l] of [[1.175, 0.07], [1.10, 0.06]]) {
        kit.add(bath, kit.cyl(0.015, 0.017, 0.035, 20), warmNickel, [wx + 0.03, Y0 + y, z], [0, 0, Math.PI / 2]);
        bx(bath, warmNickel, wx + 0.042, y - 0.007, z - 0.008, wx + 0.054, y + 0.007, z + l, 0.003);
      }
      const z2 = 17.57;
      bx(bath, warmNickel, wx, 1.08, z2 - 0.04, wx + 0.013, 1.21, z2 + 0.04, 0.004);
      for (const y of [1.17, 1.11]) {
        kit.add(bath, kit.cyl(0.011, 0.013, 0.03, 16), warmNickel, [wx + 0.026, Y0 + y, z2], [0, 0, Math.PI / 2]);
        bx(bath, warmNickel, wx + 0.036, y - 0.005, z2 - 0.006, wx + 0.046, y + 0.005, z2 + 0.045, 0.003);
      }
    }
    kit.add(bath, kit.cyl(0.011, 0.011, 0.90, 16), warmNickel, [wx + 0.04, Y0 + 1.40, 17.17]);
    bx(bath, warmNickel, wx, 0.94, 17.15, wx + 0.04, 0.97, 17.19); bx(bath, warmNickel, wx, 1.83, 17.15, wx + 0.04, 1.86, 17.19);
    kit.add(bath, kit.cyl(0.016, 0.012, 0.24, 14), warmNickel, [wx + 0.075, Y0 + 1.66, 17.17], [0, 0, 0.12]);
    kit.add(bath, kit.lathe([[0, 0], [0.032, 0], [0.035, 0.02], [0, 0.024]], 20), warmNickel, [wx + 0.09, Y0 + 1.79, 17.17], [0, 0, -0.9]);
    // hose hangs from the handset in a long loop back up to the wall outlet under the bar
    kit.add(bath, kit.tube([[wx + 0.07, Y0 + 1.54, 17.17], [wx + 0.10, Y0 + 1.05, 17.19], [wx + 0.09, Y0 + 0.62, 17.21], [wx + 0.06, Y0 + 0.50, 17.22], [wx + 0.035, Y0 + 0.62, 17.21], [wx + 0.025, Y0 + 0.86, 17.19], [wx + 0.02, Y0 + 0.93, 17.17]], 0.007, 48), nickel);
    bx(bath, warmNickel, wx, 0.90, 17.15, wx + 0.035, 0.94, 17.19, 0.004); // wall outlet
    // linear drain
    bx(bath, steel, 16.86, 0.006, SZ0 + 0.2, 16.92, 0.009, SZ1 - 0.2);
    // tub filler on the half wall's tub side (p20): 20 x 10 cm trim plate + cross handles, spout, hand shower
    const fx = 18.43 + 0.004;
    bx(bath, warmNickel, fx, 0.735, 17.30, fx + 0.012, 0.835, 17.50, 0.004);
    for (const z of [17.345, 17.455]) {
      kit.add(bath, kit.cyl(0.013, 0.015, 0.035, 14), warmNickel, [fx + 0.03, Y0 + 0.785, z], [0, 0, Math.PI / 2]);
      bx(bath, warmNickel, fx + 0.042, 0.779, z - 0.028, fx + 0.054, 0.791, z + 0.028, 0.004);
      bx(bath, warmNickel, fx + 0.042, 0.757, z - 0.006, fx + 0.054, 0.813, z + 0.006, 0.004);
    }
    bx(bath, warmNickel, fx, 0.735, 17.12, fx + 0.11, 0.765, 17.20, 0.006);
    bx(bath, warmNickel, fx, 0.66, 16.91, fx + 0.03, 0.70, 16.95, 0.004);
    kit.add(bath, kit.cyl(0.015, 0.011, 0.22, 14), warmNickel, [fx + 0.03, Y0 + 0.82, 16.93]);
    kit.add(bath, kit.lathe([[0, 0], [0.03, 0], [0.033, 0.018], [0, 0.022]], 20), warmNickel, [fx + 0.03, Y0 + 0.93, 16.93], [0, 0, -0.5]);
    kit.add(bath, kit.tube([[fx + 0.03, Y0 + 0.71, 16.93], [fx + 0.04, Y0 + 0.40, 16.92], [fx + 0.02, Y0 + 0.05, 16.91]], 0.006, 24), steel);
  }

  // ---- freestanding oval tub (p19/p20): lathe shell stretched along z
  // Level oval (superellipse plan, so the 4.5 cm rolled rim keeps an even width), 1.70 x 0.80 x 0.60 m,
  // long axis along z parallel to the half wall.
  {
    const L = 1.70, W = 0.80, dL = (L - W) / 2, NS = 112, n = 2.1; // near-elliptic boat plan
    // slipper/boat profile: curved outer belly, thin (~2 cm) rolled rim
    /* p19: modern freestanding oval soaker: oval footprint inset ~7 cm, straight walls flaring out to the rim,
       thin (~2 cm) flat rim, deep basin with a soft floor fillet (was egg-shaped: round base, belly bulge) */
    /* p20: double slipper: narrow pedestal base flaring out to a thin (~1.5 cm) rolled rim; rim ~0.52 m mid, ~0.63 m at both ends */
    const prof = [[0, 0.0], [0.24, 0.0], [0.262, 0.005], [0.276, 0.022], [0.284, 0.055], [0.304, 0.20], [0.333, 0.33], [0.366, 0.43], [0.392, 0.49], [0.405, 0.512], [0.404, 0.522], [0.398, 0.527], [0.390, 0.526], [0.386, 0.518], [0.381, 0.50], [0.366, 0.43], [0.338, 0.31], [0.304, 0.19], [0.27, 0.11], [0.245, 0.08], [0.20, 0.068], [0, 0.066]];
    const pos = [], idx = [];
    for (const [rr, y] of prof) {
      const k = Math.min(1, rr / 0.2), a = rr, b = rr + dL * k;
      for (let i = 0; i < NS; i++) {
        const t = i / NS * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        const yy = y + 0.105 * Math.pow(Math.abs(s), 2.2) * Math.pow(Math.min(1, y / 0.52), 4); /* double slipper: rim rises at both ends */
        pos.push(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), yy, b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n));
      }
    }
    for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < NS; i++) {
      const a = j * NS + i, b = j * NS + (i + 1) % NS, c = (j + 1) * NS + (i + 1) % NS, d = (j + 1) * NS + i;
      idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    geo.computeVertexNormals();
    const tub = kit.add(bath, geo, tubWhite, [18.90, Y0, 17.15]); tub.name = 'tub';
    tub.updateMatrixWorld(true);
    const wgeo = geo.clone().applyMatrix4(tub.matrixWorld); phys.trimesh(wgeo); // you can climb in
    kit.add(bath, kit.cyl(0.022, 0.022, 0.006, 16), nickel, [18.90, Y0 + 0.072, 16.72]);
    // soft contact shadow on the mosaic
    const shTex = kit.canvasTex(256, 512, (g, w, h) => {
      g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
      const gr = g.createRadialGradient(0, 0, w * 0.18, 0, 0, w * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w * 0.5, 0, Math.PI * 2); g.fill(); g.restore();
    });
    const sh = kit.add(bath, new THREE.PlaneGeometry(0.98, 1.92), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.6 }), [18.90, Y0 + 0.003, 17.15], [-Math.PI / 2, 0, 0], { shadow: false });
    sh.renderOrder = 1; sh.receiveShadow = false;
  }

  // ---- vanity: long fluted white-oak double vanity, white quartz top, two undermount sinks (p19)
  const VZ0 = 15.10, VZ1 = 19.60, VF = 20.82; // front face x
  {
    // one continuous 4.5 m run (+0.6 m linen tower = ~5.1 m), 8 bays x 3 drawers, every front reeded
    // (2 cm half-round reeds inside a 12 mm flat border), 3 mm gaps over a dark reveal, inset toe kick
    const van = kit.group(bath, [0, 0, 0], 0, 'vanity');
    bx(van, oak, VF + 0.02, 0.10, VZ0, BX1, 0.86, VZ1);              // carcass
    bx(van, oakDark, VF + 0.012, 0.10, VZ0 + 0.003, VF + 0.021, 0.86, VZ1 - 0.003); // reveal backer behind the gaps
    bx(van, oakDark, VF + 0.07, 0, VZ0 + 0.02, BX1, 0.10, VZ1 - 0.02); // toe kick (inset 70 mm, dark)
    const nBay = 8, sw = (VZ1 - VZ0) / nBay, gap = 0.0015, brd = 0.012;
    const hs = [0.19, 0.27, 0.30];
    const reedAO = kit.canvasTex(64, 4, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(0.25, '#d8d8d8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.75, '#d8d8d8'); gr.addColorStop(1, '#5a5a5a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { srgb: false });
    const reedMat = oakV.clone(); reedMat.aoMap = reedAO; reedMat.aoMapIntensity = 1;
    const reedMesh = [];
    for (let s = 0; s < nBay; s++) {
      const z0 = VZ0 + s * sw; let y = 0.10;
      for (const hh of hs) {
        const fz0 = z0 + gap, fz1 = z0 + sw - gap, fy0 = y + gap, fy1 = y + hh - gap;
        // flat border (rounded slab) + reed field set into it
        bx(van, oak, VF + 0.004, fy0, fz0, VF + 0.02, fy1, fz1, 0.003);
        bx(van, oak, VF, fy0, fz0, VF + 0.006, fy0 + brd, fz1, 0.002); bx(van, oak, VF, fy1 - brd, fz0, VF + 0.006, fy1, fz1, 0.002);
        bx(van, oak, VF, fy0, fz0, VF + 0.006, fy1, fz0 + brd, 0.002); bx(van, oak, VF, fy0, fz1 - brd, VF + 0.006, fy1, fz1, 0.002);
        reedMesh.push(kit.add(van, fluteGeo(fz1 - fz0 - 2 * brd, fy1 - fy0 - 2 * brd, 0.02), reedMat, [VF + 0.0105, Y0 + fy0 + brd, fz0 + brd]));
        knob(van, nickel, [VF - 0.004, Y0 + (hh < 0.2 ? (fy0 + fy1) / 2 : fy1 - 0.075), (fz0 + fz1) / 2], 'x-', 0.015);
        y += hh;
      }
    }
    // quartz top with sink cut-outs
    const sinksZ = [VZ0 + sw * 2, VZ0 + sw * 6];
    const shape = new THREE.Shape([new THREE.Vector2(VF - 0.02, VZ0 - 0.01), new THREE.Vector2(BX1, VZ0 - 0.01), new THREE.Vector2(BX1, VZ1 + 0.01), new THREE.Vector2(VF - 0.02, VZ1 + 0.01)]);
    for (const z of sinksZ) shape.holes.push(new THREE.Path([new THREE.Vector2(20.93, z - 0.24), new THREE.Vector2(20.93, z + 0.24), new THREE.Vector2(21.25, z + 0.24), new THREE.Vector2(21.25, z - 0.24)].map(v => v)));
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }); top.rotateX(Math.PI / 2); top.translate(0, Y0 + 0.895, 0);
    kit.add(van, top, marble, [0, 0, 0]);
    bx(van, marbleBox, BX1 - 0.02, 0.895, VZ0 - 0.01, BX1, 1.0, VZ1 + 0.01); // backsplash
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
    bx(tc, oak, VF + 0.02, 0.10, BZ0, BX1, 2.42, VZ0 - 0.005);
    bx(tc, oakDark, VF + 0.07, 0, BZ0 + 0.02, BX1, 0.10, VZ0 - 0.02);
    bx(tc, oakDark, VF + 0.012, 0.10, BZ0 + 0.003, VF + 0.021, 2.40, VZ0 - 0.008);
    const fronts = [[0.10, 0.62], [0.62, 0.80], [0.80, 0.98], [0.98, 2.40]];
    for (const [a, b] of fronts) { bx(tc, oakV, VF, a + 0.0015, BZ0 + 0.004, VF + 0.02, b - 0.0015, VZ0 - 0.009, 0.003); knob(tc, nickel, [VF - 0.002, Y0 + (b - a > 0.3 ? (a < 0.5 ? b - 0.08 : a + 0.08) : (a + b) / 2), VZ0 - 0.06], 'x-', 0.012); }
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

    // sconces mounted on the mirror (p19): round nickel backplate, short arm, a bar carrying two clear
    // hand-blown teardrops hung at different heights, each with a glowing filament bulb inside
    const dropGeo = kit.lathe([[0.007, 0], [0.012, -0.015], [0.022, -0.05], [0.034, -0.095], [0.041, -0.135], [0.042, -0.16], [0.036, -0.185], [0.022, -0.2], [0, -0.205]], 32);
    for (const z of [15.42, 17.35, 19.28]) {
      const sx = BX1 - 0.012; const y = 2.02;
      kit.add(bath, kit.cyl(0.04, 0.04, 0.014, 32), nickel, [sx - 0.007, Y0 + y, z], [0, 0, Math.PI / 2]);
      kit.add(bath, kit.cyl(0.007, 0.007, 0.10, 12), nickel, [sx - 0.06, Y0 + y, z], [0, 0, Math.PI / 2]);
      kit.add(bath, kit.cyl(0.006, 0.006, 0.17, 12), nickel, [sx - 0.11, Y0 + y, z], [Math.PI / 2, 0, 0]);
      for (const [dz, drop] of [[-0.08, 0.05], [0.08, 0.10]]) {
        kit.add(bath, kit.cyl(0.003, 0.003, drop, 8), nickel, [sx - 0.11, Y0 + y - drop / 2, z + dz]);
        kit.add(bath, kit.cyl(0.011, 0.014, 0.03, 16), nickel, [sx - 0.11, Y0 + y - drop - 0.012, z + dz]);
        const shade = kit.add(bath, dropGeo, clearGlass, [sx - 0.11, Y0 + y - drop - 0.026, z + dz], [0, 0, 0], { shadow: false });
        shade.renderOrder = 2;
        kit.add(bath, kit.cyl(0.004, 0.004, 0.05, 8), bulbGlow, [sx - 0.11, Y0 + y - drop - 0.085, z + dz], [0, 0, 0], { shadow: false });
        kit.add(bath, kit.sphere(0.014, 12, 8), std({ color: 0xffffff, emissive: 0xffe0b0, emissiveIntensity: 1.2, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false }), [sx - 0.11, Y0 + y - drop - 0.09, z + dz], [0, 0, 0], { shadow: false });
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
  const fill = new THREE.PointLight(0xffe8cc, 0.5, 7.5, 1.5); fill.position.set(19.3, Y0 + 2.45, 17.4); fill.castShadow = false; bath.add(fill);

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
    bx(L, oak, X0, 0.10, LZ0, LF, 0.70, Z1); bx(L, oak, LF - 0.03, 0.70, LZ0, LF, 0.88, Z1); // carcass (open under the bar sink)
    bx(L, oak, X0, 0.10, Z1 - 0.02, LF, 0.88, Z1); bx(L, oak, X0, 0.10, LZ0, LF, 0.88, LZ0 + 0.02); // end panels
    bx(L, oak, X0, 0, LZ0 + 0.02, LF - 0.06, 0.10, Z1);
    const door = kit.add(L, kit.shakerFront(0.42, 0.76, 0.065, 0.02, 0.007), oak, [LF, Y0 + 0.11, Z1 - 0.005], [0, Math.PI / 2, 0]);
    knob(L, M.matteBlack, [LF + 0.022, Y0 + 0.80, 13.97], 'x+', 0.013);
    // wine fridge: oak frame + glass, dark interior with bottles
    const fz0 = LZ0 + 0.01, fz1 = 13.90;
    // open oak frame (stiles + rails, 2 mm rounded) around a smoked-glass light
    { const fw = 0.06, y0f = 0.105, y1f = 0.875;
      bx(L, oakV, LF, y0f, fz0, LF + 0.022, y0f + fw, fz1, 0.002); bx(L, oakV, LF, y1f - fw, fz0, LF + 0.022, y1f, fz1, 0.002);
      bx(L, oakV, LF, y0f + fw, fz0, LF + 0.022, y1f - fw, fz0 + fw, 0.002); bx(L, oakV, LF, y0f + fw, fz1 - fw, LF + 0.022, y1f - fw, fz1, 0.002); }
    bx(L, fridgeDark, LF - 0.5, 0.17, fz0 + 0.05, LF - 0.005, 0.81, fz1 - 0.05);
    const gl = bx(L, fridgeGlass, LF + 0.006, 0.16, fz0 + 0.06, LF + 0.01, 0.82, fz1 - 0.06); gl.castShadow = false; gl.renderOrder = 2;
    bx(L, std({ color: 0xffffff, emissive: 0xfff0dc, emissiveIntensity: 1.6 }), LF - 0.06, 0.79, fz0 + 0.07, LF - 0.04, 0.80, fz1 - 0.07); // interior LED strip
    for (let k = 0; k < 4; k++) {
      bx(L, steel, LF - 0.45, 0.24 + k * 0.15, fz0 + 0.05, LF - 0.03, 0.25 + k * 0.15, fz1 - 0.05);
      for (let b = 0; b < 4; b++) { const bt = kit.add(L, kit.cyl(0.035, 0.035, 0.36, 12), std({ color: [0x1b2a1c, 0x3a1416, 0x151515][(k + b) % 3], roughness: 0.2 }), [LF - 0.22, Y0 + 0.29 + k * 0.15, fz0 + 0.1 + b * 0.085], [0, 0, Math.PI / 2]); }
    }
    bx(L, M.matteBlack, LF + 0.02, 0.32, fz1 - 0.05, LF + 0.04, 0.72, fz1 - 0.03);
    bx(L, M.matteBlack, LF + 0.005, 0.34, fz1 - 0.05, LF + 0.02, 0.36, fz1 - 0.03); bx(L, M.matteBlack, LF + 0.005, 0.68, fz1 - 0.05, LF + 0.02, 0.70, fz1 - 0.03);
    // black marble top with a bar sink + backsplash
    const shp = new THREE.Shape([new THREE.Vector2(X0, LZ0 - 0.02), new THREE.Vector2(LF + 0.025, LZ0 - 0.02), new THREE.Vector2(LF + 0.025, Z1), new THREE.Vector2(X0, Z1)]);
    shp.holes.push(new THREE.Path([new THREE.Vector2(15.70, 13.92), new THREE.Vector2(15.70, 14.26), new THREE.Vector2(16.0, 14.26), new THREE.Vector2(16.0, 13.92)]));
    const ctop = new THREE.ExtrudeGeometry(shp, { depth: 0.04, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }); ctop.rotateX(Math.PI / 2); ctop.translate(0, Y0 + 0.915, 0);
    kit.add(L, ctop, marbleBlack, [0, 0, 0]);
    kit.add(L, new THREE.BoxGeometry(0.30, 0.18, 0.34), std({ color: 0x1a1a1a, roughness: 0.4, side: THREE.BackSide }), [15.85, Y0 + 0.79, 14.09]);
    bx(L, std({ color: 0x161616, roughness: 0.35 }), 15.70, 0.84, 13.92, 16.0, 0.842, 14.26); // basin floor
    kit.add(L, kit.cyl(0.02, 0.02, 0.004, 16), steel, [15.85, Y0 + 0.844, 14.09]);
    bx(L, marbleBlack, X0, 0.915, LZ0 - 0.02, X0 + 0.02, 1.13, Z1);
    kit.add(L, kit.cyl(0.02, 0.024, 0.05, 14), M.matteBlack, [15.62, Y0 + 0.94, 14.10]);
    kit.add(L, kit.tube([[15.62, Y0 + 0.94, 14.10], [15.62, Y0 + 1.22, 14.10], [15.70, Y0 + 1.30, 14.10], [15.78, Y0 + 1.22, 14.10], [15.78, Y0 + 1.12, 14.10]], 0.012, 32), M.matteBlack);
    bx(L, M.matteBlack, X0 + 0.02, 1.0, 13.52, X0 + 0.03, 1.10, 13.58); bx(L, M.matteBlack, X0 + 0.02, 1.0, 13.62, X0 + 0.03, 1.10, 13.68);
    // upper tower: Wolf-style built-in coffee machine under an oak door, open shelves at the far side
    const UF = 15.90, UY0 = 1.42, UY1 = H - 0.01;
    bx(L, oak, X0, UY0, LZ0, UF - 0.02, UY1, Z1);
    bx(L, oak, X0, UY0 - 0.02, LZ0, UF, UY0, Z1);
    // built-in stainless coffee machine (~0.56 W x 0.45 H): brushed bezel, black control strip with a lit
    // display, dark recessed brew bay with spout block, drip grate and a cup
    { const cx = UF - 0.02, y0 = UY0 + 0.02, y1 = y0 + 0.45, z0 = 13.79, z1 = 14.33;
      const ss = physM({ color: 0xb4b5b4, roughness: 0.34, metalness: 1.0, anisotropy: 0.7, envMapIntensity: 0.75 }); /* p23 Wolf: brushed stainless, mid grey (was a white frame) */
      bx(L, ss, cx, y0, z0, cx + 0.025, y1, z1, 0.004);
      bx(L, ss, cx + 0.02, y0 + 0.012, z0 + 0.012, cx + 0.027, y1 - 0.095, z0 + 0.10, 0.002); bx(L, ss, cx + 0.02, y0 + 0.012, z1 - 0.10, cx + 0.027, y1 - 0.095, z1 - 0.012, 0.002); // raised side panels
      bx(L, blackGlass, cx + 0.024, y1 - 0.085, z0 + 0.035, cx + 0.028, y1 - 0.03, z1 - 0.035);
      bx(L, std({ color: 0x0c1014, emissive: 0xbfd8ff, emissiveIntensity: 0.9 }), cx + 0.0285, y1 - 0.07, z0 + 0.20, cx + 0.029, y1 - 0.045, z0 + 0.33);
      bx(L, std({ color: 0x3a3b3d, roughness: 0.45, metalness: 0.5 }), cx + 0.010, y0 + 0.05, z0 + 0.12, cx + 0.0255, y1 - 0.11, z1 - 0.12); // brew bay
      bx(L, steel, cx + 0.015, y1 - 0.15, z0 + 0.21, cx + 0.06, y1 - 0.11, z1 - 0.21, 0.006);              // spout block
      for (const dz of [-0.02, 0.02]) kit.add(L, kit.cyl(0.006, 0.006, 0.025, 10), steel, [cx + 0.04, Y0 + y1 - 0.165, (z0 + z1) / 2 + dz]);
      bx(L, steel, cx + 0.015, y0 + 0.05, z0 + 0.12, cx + 0.07, y0 + 0.065, z1 - 0.12, 0.003);             // drip grate
      kit.add(L, kit.lathe([[0, 0], [0.022, 0], [0.028, 0.012], [0.03, 0.06], [0.027, 0.062], [0.024, 0.014], [0, 0.012]], 24), potWhite, [cx + 0.04, Y0 + y0 + 0.065, (z0 + z1) / 2]);
      bx(L, std({ color: 0x9a9da0, roughness: 0.3, metalness: 1 }), cx + 0.025, y1 - 0.02, z0 + 0.03, cx + 0.03, y1 - 0.01, z1 - 0.03); // trim line
    }
    kit.add(L, kit.shakerFront(0.55, UY1 - UY0 - 0.52, 0.065, 0.02, 0.007), oak, [UF - 0.02, Y0 + UY0 + 0.51, Z1 - 0.01], [0, Math.PI / 2, 0]);
    knob(L, M.matteBlack, [UF + 0.002, Y0 + UY0 + 0.57, 13.86], 'x+', 0.012);
    // open shelves (far side)
    bx(L, oak, X0, UY0, LZ0, UF, UY1, LZ0 + 0.02);
    for (const y of [UY0, 1.84, 2.26]) bx(L, oak, X0, y, LZ0, UF, y + 0.02, 13.78);
    bx(L, oak, X0, UY0, 13.76, UF, UY1, 13.78);
    phys.solidGroup(L);

    // ---- right run (x 17.35, facing -x): drawer bank, black marble top, uppers with open shelves
    const Rg = kit.group(vest, [0, 0, 0], 0, 'coffeeRight');
    const RF = 16.90, RZ1 = 13.45; // the right run stops short so the counter's end cuts in at the frame edge (p23)
    bx(Rg, oak, RF + 0.02, 0.10, Z0, X1, 0.88, RZ1);
    bx(Rg, oakDark, RF + 0.08, 0, Z0, X1, 0.10, RZ1 - 0.06);
    bx(Rg, oak, RF + 0.02, 0.10, RZ1 - 0.02, X1, 0.88, RZ1); // finished end panel
    const cols = 3, cw = (RZ1 - Z0) / cols;
    for (let c = 0; c < cols; c++) for (let d = 0; d < 4; d++) {
      const z0 = Z0 + c * cw + 0.003, y0 = 0.105 + d * 0.193;
      kit.add(Rg, kit.shakerFront(cw - 0.006, 0.188, 0.045, 0.02, 0.006), oak, [RF + 0.02, Y0 + y0, z0], [0, -Math.PI / 2, 0]);
      knob(Rg, M.matteBlack, [RF - 0.002, Y0 + y0 + 0.13, z0 + cw / 2], 'x-', 0.012);
    }
    const rtop = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(RF - 0.025, Z0), new THREE.Vector2(X1, Z0), new THREE.Vector2(X1, RZ1 + 0.025), new THREE.Vector2(RF - 0.025, RZ1 + 0.025)]), { depth: 0.04, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
    rtop.rotateX(Math.PI / 2); rtop.translate(0, Y0 + 0.915, 0); kit.add(Rg, rtop, marbleBlack);
    bx(Rg, marbleBlack, X1 - 0.02, 0.915, Z0, X1, 1.07, RZ1 + 0.025);
    // uppers: shaker door at the far end, open shelves (cups) on the near end
    const RU = 17.0;
    bx(Rg, oak, RU + 0.02, 1.45, Z0, X1, UY1, RZ1);
    bx(Rg, oak, RU, 1.43, Z0, X1, 1.45, RZ1);
    kit.add(Rg, kit.shakerFront(0.78, UY1 - 1.46, 0.065, 0.02, 0.007), oak, [RU + 0.02, Y0 + 1.455, Z0 + 0.01], [0, -Math.PI / 2, 0]);
    knob(Rg, M.matteBlack, [RU - 0.002, Y0 + 1.55, 12.70], 'x-', 0.013);
    for (const z of [12.80, RZ1 - 0.02]) bx(Rg, oak, RU, 1.45, z, X1, UY1, z + 0.02);
    for (const y of [1.45, 1.92, 2.36]) bx(Rg, oak, RU, y, 12.80, X1, y + 0.022, RZ1);
    bx(Rg, oakDark, X1 - 0.012, 1.45, 12.80, X1, UY1, RZ1);
    const mug = kit.lathe([[0, 0], [0.03, 0], [0.036, 0.006], [0.04, 0.085], [0.037, 0.087], [0.034, 0.012], [0, 0.01]], 24);
    for (const [y, n] of [[1.472, 6], [1.942, 4]]) for (let k = 0; k < n; k++) {
      const m = kit.add(Rg, mug, potWhite, [17.18 + (k % 2) * 0.09, Y0 + y, 12.88 + Math.floor(k / 2) * 0.16]);
    }
    for (let k = 0; k < 3; k++) kit.add(Rg, kit.rbox(0.16, 0.012, 0.16, 0.004), potWhite, [17.18, Y0 + 2.382 + k * 0.013, 13.25]); // saucer stack
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
    const gr = kit.group(vest, [16.12, PLATE - 0.006, 12.35]);
    kit.add(gr, new THREE.BoxGeometry(0.62, 0.012, 0.34), M.paintWhite, [0, 0, 0]);
    for (let i = 0; i < 18; i++) kit.add(gr, new THREE.BoxGeometry(0.003, 0.012, 0.30), std({ color: 0x8e8c88, roughness: 0.8 }), [-0.28 + i * 0.033, -0.003, 0]);
    kit.canLights(vest, [[16.45, 12.02], [16.68, 12.95]], PLATE);
    const vl = new THREE.PointLight(0xffe4c4, 0.8, 4.5, 1.6); vl.position.set(16.70, PLATE - 0.3, 12.5); vl.castShadow = false; vest.add(vl);
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
