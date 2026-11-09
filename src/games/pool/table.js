// 8-ball table for the garage: walnut rails + apron on six turned legs, tournament-green felt (procedural nap),
// felt-covered K-66 style cushions with angled jaws, leather pocket baskets under chrome-trimmed pocket irons,
// mother-of-pearl diamonds, a three-shade billiard lamp (emissive; a warm light pool on the felt fades in only
// while someone plays), and a wall rack with four cues, chalk and the triangle. Everything static is merged;
// the 16 balls are ONE InstancedMesh (canvas atlas, per-instance uv offset) + one instanced contact-shadow mesh.
// Table frame -> world: wx = X0 + x, wz = Z0 + y (x along the length, sim coordinates from sim.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { L, W, R, POCKETS, FOOT } from './sim.js';

export const TABLE = { cx: 17.1, cz: 3.62, y: 0.79 };           // felt height 0.79 m
export const X0 = TABLE.cx - L / 2, Z0 = TABLE.cz - W / 2;
export const RAIL = 0.16, CUSH = 0.05;                         // rail width outside the cushion nose
export const RACK = { x: 11.42, z: 5.45 };                    // cue rack on the west (foyer) wall
export const BALL_COLORS = ['#f4f1e6', '#f2b51b', '#1f4fb5', '#d42a22', '#5a2b8f', '#ef6d1f', '#1d7a3c', '#7a1f22', '#141414',
  '#f2b51b', '#1f4fb5', '#d42a22', '#5a2b8f', '#ef6d1f', '#1d7a3c', '#7a1f22'];
export const toWorld = (x, y, out) => out.set(X0 + x, TABLE.y + R, Z0 + y);

function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); return c; }
const std = (o) => new THREE.MeshStandardMaterial(o);
const prism = (pts, y0, y1) => { // plan polygon [[x, z]...] (table frame) extruded from y0 to y1
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
};

export function feltMaterial() {
  const t = new THREE.CanvasTexture(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#1b6b48'; g.fillRect(0, 0, w, h);
    const im = g.getImageData(0, 0, w, h); let s = 9;
    for (let i = 0; i < im.data.length; i += 4) { s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * 16; im.data[i] += n * 0.5; im.data[i + 1] += n; im.data[i + 2] += n * 0.7; }
    g.putImageData(im, 0, 0);
  }));
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3);
  return std({ map: t, color: 0xffffff, roughness: 0.96, metalness: 0, emissive: 0x2c5a3e, emissiveIntensity: 0 });
}
function woodMaterial() {
  const t = new THREE.CanvasTexture(canvas(512, 128, (g, w, h) => {
    g.fillStyle = '#4a2716'; g.fillRect(0, 0, w, h); let s = 3;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 90; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '28,12,6' : '110,62,34'},${0.15 + r() * 0.3})`; g.lineWidth = 0.5 + r() * 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (r() - 0.5) * 2); g.stroke(); }
  }));
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return std({ map: t, roughness: 0.32, metalness: 0, color: 0xffffff });
}

// ball atlas: 4x4 cells of 256x128 equirect images
function ballAtlas() {
  const c = canvas(1024, 512, (g) => {
    for (let n = 0; n < 16; n++) {
      const cx = (n % 4) * 256, cy = (3 - Math.floor(n / 4)) * 128; // row 0 (n 0-3) at the bottom (flipY)
      const col = BALL_COLORS[n]; const stripe = n >= 9;
      g.fillStyle = stripe || n === 0 ? '#f4f1e6' : col; g.fillRect(cx, cy, 256, 128);
      if (stripe) { g.fillStyle = col; g.fillRect(cx, cy + 34, 256, 60); }
      if (n === 0) { g.fillStyle = '#c0282a'; for (const u of [64, 192]) { g.beginPath(); g.arc(cx + u, cy + 64, 5, 0, Math.PI * 2); g.fill(); } continue; }
      for (const u of [64, 192]) {
        g.fillStyle = '#f7f4ea'; g.beginPath(); g.ellipse(cx + u, cy + 64, 19, 19, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.font = 'bold 22px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), cx + u, cy + 65);
        if (n === 6 || n === 9) g.fillRect(cx + u - 6, cy + 77, 12, 2);
      }
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildTable(ctx) {
  const { scene, phys } = ctx;
  const root = new THREE.Group(); root.name = 'poolTable'; root.position.set(X0, 0, Z0); scene.add(root);
  const felt = feltMaterial(), wood = woodMaterial();
  const leather = std({ color: 0x2a1610, roughness: 0.55 }), chrome = std({ color: 0xd9d6cf, roughness: 0.18, metalness: 1 });
  const pearl = std({ color: 0xf3efe6, roughness: 0.25, emissive: 0x111111 }), black = std({ color: 0x050505, roughness: 0.9 });
  const parts = new Map(); const lampParts = new Map(); let into = parts;
  const put = (mat, g) => { if (!into.has(mat)) into.set(mat, []); into.get(mat).push(g.index ? g.toNonIndexed() : g); };
  const Y = TABLE.y, TOP = Y + 0.045;
  // slate bed + felt
  { const g = new THREE.BoxGeometry(L + 0.02, 0.05, W + 0.02); g.translate(L / 2, Y - 0.025, W / 2); put(felt, g); }
  // cushions: felt prisms between the jaws (nose at the playing edge, back at -CUSH)
  const cush = [];
  for (const [y, s] of [[0, 1], [W, -1]]) {
    cush.push([[0.088, y], [L / 2 - 0.066, y], [L / 2 - 0.066 + 0.013, y - s * CUSH], [0.088 - CUSH, y - s * CUSH]]);
    cush.push([[L / 2 + 0.066, y], [L - 0.088, y], [L - 0.088 + CUSH, y - s * CUSH], [L / 2 + 0.066 - 0.013, y - s * CUSH]]);
  }
  for (const [x, s] of [[0, 1], [L, -1]]) cush.push([[x, 0.088], [x, W - 0.088], [x - s * CUSH, W - 0.088 + CUSH], [x - s * CUSH, 0.088 - CUSH]]);
  for (const p of cush) put(felt, prism(p, Y - 0.005, Y + 0.040));
  // rails (wood) from the cushion back out to RAIL, between pocket irons
  const o = CUSH, e = RAIL;
  const rails = [
    [[0.14, -o], [L / 2 - 0.09, -o], [L / 2 - 0.09, -e], [0.14, -e]], [[L / 2 + 0.09, -o], [L - 0.14, -o], [L - 0.14, -e], [L / 2 + 0.09, -e]],
    [[0.14, W + o], [L / 2 - 0.09, W + o], [L / 2 - 0.09, W + e], [0.14, W + e]], [[L / 2 + 0.09, W + o], [L - 0.14, W + o], [L - 0.14, W + e], [L / 2 + 0.09, W + e]],
    [[-o, 0.14], [-o, W - 0.14], [-e, W - 0.14], [-e, 0.14]], [[L + o, 0.14], [L + o, W - 0.14], [L + e, W - 0.14], [L + e, 0.14]],
  ];
  for (const p of rails) { const g = prism(p, Y - 0.06, TOP); put(wood, g); }
  // pocket irons (chrome caps) + leather baskets + black throats
  POCKETS.forEach((P, i) => {
    const corner = i < 4; const px = corner ? (P[0] < L / 2 ? -0.07 : L + 0.07) : L / 2, pz = corner ? (P[1] < W / 2 ? -0.07 : W + 0.07) : (P[1] < W / 2 ? -0.1 : W + 0.1);
    const cr = corner ? 0.088 : 0.078;
    const cap = new THREE.CylinderGeometry(cr, cr * 0.96, TOP - Y + 0.06, 28); cap.translate(px * 0.6 + P[0] * 0.4, (TOP + Y - 0.06) / 2 - 0.002, pz * 0.6 + P[1] * 0.4); put(leather, cap);
    const rim = new THREE.TorusGeometry(cr - 0.004, 0.004, 6, 28); rim.rotateX(Math.PI / 2); rim.translate(px * 0.6 + P[0] * 0.4, TOP - 0.002, pz * 0.6 + P[1] * 0.4); put(chrome, rim);
    const hole = new THREE.CircleGeometry(0.062, 24); hole.rotateX(-Math.PI / 2); hole.translate(P[0], TOP + 0.0015, P[1]); put(black, hole);
    const bowl = new THREE.LatheGeometry([[0.065, 0], [0.07, -0.06], [0.055, -0.13], [0.001, -0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 18); bowl.translate(P[0], Y - 0.06, P[1]); put(leather, bowl);
  });
  // drop the felt inside the pocket mouths: black discs at felt level read as the holes
  POCKETS.forEach((P) => { const h = new THREE.CircleGeometry(P[2] + 0.004, 24); h.rotateX(-Math.PI / 2); h.translate(P[0], Y + 0.0012, P[1]); put(black, h); });
  // diamonds
  for (const f of [1, 2, 3, 5, 6, 7]) for (const z of [-0.105, W + 0.105]) { const d = new THREE.CylinderGeometry(0.009, 0.009, 0.003, 4); d.rotateY(Math.PI / 4); d.scale(1, 1, 0.6); d.translate(L * f / 8, TOP + 0.001, z); put(pearl, d); }
  for (const f of [1, 2, 3]) for (const x of [-0.105, L + 0.105]) { const d = new THREE.CylinderGeometry(0.009, 0.009, 0.003, 4); d.rotateY(Math.PI / 4); d.scale(0.6, 1, 1); d.translate(x, TOP + 0.001, W * f / 4); put(pearl, d); }
  { const d = new THREE.CircleGeometry(0.008, 16); d.rotateX(-Math.PI / 2); d.translate(FOOT[0], Y + 0.001, FOOT[1]); put(pearl, d); }
  // apron (body) + legs + feet
  { const g = new RoundedBoxGeometry(L + 2 * e - 0.04, 0.2, W + 2 * e - 0.04, 3, 0.02); g.translate(L / 2, Y - 0.17, W / 2); put(wood, g); }
  { const g = new RoundedBoxGeometry(L + 2 * e - 0.1, 0.025, W + 2 * e - 0.1, 2, 0.01); g.translate(L / 2, Y - 0.285, W / 2); put(wood, g); }
  const leg = [[0.0, 0], [0.085, 0], [0.085, 0.05], [0.06, 0.07], [0.055, 0.14], [0.075, 0.2], [0.06, 0.26], [0.05, 0.38], [0.065, 0.45], [0.075, 0.5], [0.0, 0.5]];
  for (const lx of [0.02, L / 2, L - 0.02]) for (const lz of [0.02, W - 0.02]) { const g = new THREE.LatheGeometry(leg.map(([r, y]) => new THREE.Vector2(r, y)), 20); g.translate(lx, 0, lz); put(wood, g); }
  // lamp: walnut bar + three green glass domes (emissive warm inside) on two chrome rods
  into = lampParts; const lampY = 1.78; const shadeM = std({ color: 0x1c4a33, roughness: 0.25, metalness: 0.3 }); const glowM = std({ color: 0xfff2d6, emissive: 0xffdca0, emissiveIntensity: 1.3, roughness: 1 });
  { const g = new RoundedBoxGeometry(1.5, 0.06, 0.09, 2, 0.015); g.translate(L / 2, lampY + 0.2, W / 2); put(wood, g); }
  for (const dx of [-0.55, 0.55]) { const g = new THREE.CylinderGeometry(0.006, 0.006, 3.05 - lampY - 0.23, 8); g.translate(L / 2 + dx, (3.05 + lampY + 0.23) / 2, W / 2); put(chrome, g); }
  for (const dx of [-0.5, 0, 0.5]) {
    const sh = new THREE.LatheGeometry([[0.0, 0.17], [0.03, 0.17], [0.07, 0.13], [0.15, 0.03], [0.165, 0.0], [0.16, -0.005]].map(([r, y]) => new THREE.Vector2(r, y)), 32); sh.translate(L / 2 + dx, lampY, W / 2); put(shadeM, sh);
    const st = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8); st.translate(L / 2 + dx, lampY + 0.2, W / 2); put(chrome, st);
    const gl = new THREE.CircleGeometry(0.155, 28); gl.rotateX(Math.PI / 2); gl.translate(L / 2 + dx, lampY + 0.002, W / 2); put(glowM, gl);
  }
  for (const [mat, list] of parts) { const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = mat !== black; m.receiveShadow = true; root.add(m); }
  const lamp = new THREE.Group(); lamp.name = 'poolLamp'; root.add(lamp);
  for (const [mat, list] of lampParts) { const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = mat !== glowM; m.receiveShadow = true; lamp.add(m); }
  // warm light pool on the felt (additive quad; only while playing)
  const glowTex = new THREE.CanvasTexture(canvas(256, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.6, 'rgba(255,200,130,0.35)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.98, W * 0.96), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(L / 2, Y + 0.0025, W / 2); pool.visible = false; pool.renderOrder = 2; root.add(pool);

  // ---- balls: one InstancedMesh with an atlas offset per instance
  const atlas = ballAtlas();
  const ballM = new THREE.MeshPhysicalMaterial({ map: atlas, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
  ballM.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aOff;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = aOff + 0.004 + vMapUv * 0.242;\n#endif');
  };
  ballM.customProgramCacheKey = () => 'poolBallAtlas';
  const bg = new THREE.SphereGeometry(R, 28, 18);
  const balls = new THREE.InstancedMesh(bg, ballM, 16); balls.name = 'poolBalls';
  const off = new Float32Array(32); for (let n = 0; n < 16; n++) { off[n * 2] = (n % 4) * 0.25; off[n * 2 + 1] = Math.floor(n / 4) * 0.25; }
  bg.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  balls.castShadow = false; balls.receiveShadow = false; balls.userData.keep = true; balls.frustumCulled = false; scene.add(balls);
  const shTex = new THREE.CanvasTexture(canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
  const sm = new THREE.InstancedMesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), 16);
  sm.frustumCulled = false; sm.renderOrder = 1; sm.userData.keep = true; scene.add(sm);
  const quats = Array.from({ length: 16 }, () => new THREE.Quaternion());
  const last = new Float64Array(32).fill(NaN);
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 0), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
  // pos: flat [x0, y0, x1, y1, ...] (table frame, -9 = pocketed); roll: integrate rotation from the movement
  function setBalls(pos, roll = true) {
    for (let i = 0; i < 16; i++) {
      const x = pos[i * 2], y = pos[i * 2 + 1]; const gone = x < -1;
      if (!gone && roll && Number.isFinite(last[i * 2]) && last[i * 2] > -1) {
        const dx = x - last[i * 2], dz = y - last[i * 2 + 1]; const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 1e-7 && d < 0.5) { _ax.set(dz / d, 0, -dx / d); _q.setFromAxisAngle(_ax, d / R); quats[i].premultiply(_q); }
      }
      last[i * 2] = x; last[i * 2 + 1] = y;
      if (gone) { _m.compose(_p.set(0, -50, 0), quats[i], _z); balls.setMatrixAt(i, _m); sm.setMatrixAt(i, _m); continue; }
      _m.compose(_p.set(X0 + x, Y + R, Z0 + y), quats[i], _s); balls.setMatrixAt(i, _m);
      _m.compose(_p.set(X0 + x + 0.004, Y + 0.0015, Z0 + y + 0.004), _q.identity(), _s); sm.setMatrixAt(i, _m);
    }
    balls.instanceMatrix.needsUpdate = true; sm.instanceMatrix.needsUpdate = true;
  }
  // ---- cue (world-space, posed each frame while someone aims) + aim guide
  const cueM = makeCue(); cueM.visible = false; scene.add(cueM);
  const guideM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: true });
  const guideG = new THREE.BufferGeometry(); guideG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  const guide = new THREE.LineSegments(guideG, guideM); guide.visible = false; guide.frustumCulled = false; scene.add(guide);
  const ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.92, R, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
  ghost.visible = false; scene.add(ghost);
  // ---- wall rack: board, four cues, chalk on a ledge, the triangle
  const rack = new THREE.Group(); rack.position.set(RACK.x + 0.02, 0, RACK.z); rack.rotation.y = Math.PI / 2; scene.add(rack);
  { const rp = new Map(); const add = (m, g) => { if (!rp.has(m)) rp.set(m, []); rp.get(m).push(g.index ? g.toNonIndexed() : g); };
    const b = new RoundedBoxGeometry(0.62, 1.15, 0.03, 2, 0.01); b.translate(0, 1.0, 0.015); add(wood, b);
    const ledge = new RoundedBoxGeometry(0.62, 0.03, 0.09, 2, 0.01); ledge.translate(0, 0.62, 0.06); add(wood, ledge);
    const clip = new RoundedBoxGeometry(0.62, 0.05, 0.07, 2, 0.01); clip.translate(0, 1.42, 0.05); add(wood, clip);
    const chalk = std({ color: 0x2f6fb6, roughness: 0.9 });
    for (const x of [0.2, 0.25]) { const c = new THREE.BoxGeometry(0.022, 0.022, 0.022); c.translate(x, 0.646, 0.07); add(chalk, c); }
    const tri = new THREE.TorusGeometry(0.17, 0.012, 6, 3); tri.rotateZ(Math.PI / 2); tri.translate(0, 1.15, 0.05); add(std({ color: 0x1a1a1a, roughness: 0.5 }), tri);
    for (const [mat, list] of rp) { const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = true; m.receiveShadow = true; rack.add(m); }
    { const list = []; for (const x of [-0.24, -0.16, -0.08, 0.08]) { const c = cueGeometry().clone(); c.rotateX(Math.PI / 2); c.translate(x, 1.62, 0.06); list.push(c); } const m = new THREE.Mesh(mergeGeometries(list, false), cueMat); m.castShadow = true; rack.add(m); }
  }
  // physics: table + rack
  try { phys.boxAABB([X0 - e, 0, Z0 - e], [X0 + L + e, TOP, Z0 + W + e]); } catch (err) { console.warn('[pool] collider', err); }
  return { root, felt, balls, setBalls, cue: cueM, guide, guideG, ghost, pool, glowM, lamp };
}

// cue stick along local +z (tip at z = 0, butt at z = 1.47), maple shaft, ebony butt with a pearl ring
let cueGeo = null, cueMat = null;
function cueGeometry() {
  if (cueGeo) return cueGeo;
  const prof = [[0.0055, 0], [0.0062, 0.012], [0.0065, 0.03], [0.0072, 0.4], [0.0095, 0.8], [0.0105, 0.86], [0.0128, 1.2], [0.0145, 1.45], [0.012, 1.47], [0, 1.47]];
  const geo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...prof.map(([r, y]) => new THREE.Vector2(r, y))], 12); geo.rotateX(Math.PI / 2);
  // vertex colours: tip blue, ferrule white, maple shaft, ebony butt
  const p = geo.attributes.position; const col = new Float32Array(p.count * 3); const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); c.set(z < 0.012 ? 0x2a5aa8 : z < 0.03 ? 0xf2efe6 : z < 0.82 ? 0xe2c48e : z < 0.86 ? 0xf3efe6 : z < 1.05 ? 0x3a1e12 : 0x111111); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cueGeo = geo; cueMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }); return geo;
}
// cue stick along local +z (tip at z = 0, butt at z = 1.47), maple shaft, ebony butt with a pearl ring
export function makeCue() {
  const g = new THREE.Group(); g.name = 'cue';
  const m = new THREE.Mesh(cueGeometry(), cueMat); m.castShadow = true; g.add(m);
  return g;
}
