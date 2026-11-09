// Pool / spa ice (src/cold). Thickness (cm) integrates from the outdoor air temperature: grows below 0 °C up to a
// cap (thin ≈ 6 cm while it is −1…−10 °C, thick up to 30 cm in a deep freeze below −10 °C), melts above 0 °C.
// Each water body gets a grid of ice cells (InstancedMesh, world-XZ frost/crack texture, one static Rapier box per
// cell). Thin ice: a player or heavy prop standing on it starts a crack (sound + spreading crack decal); after 0.6 s
// the cells under it break (hole, pooled shards, splash) and the player drops into the freezing water. Holes
// refreeze after a few minutes below 0 °C. Thick ice (>= THICK cm) holds and is slippery (index.js adds glide).
// The water sim is untouched: the ice is a separate mesh + colliders above its surface.
import * as THREE from 'three';
import { waterBodies } from '../water/index.js';

export const THICK = 8;            // cm: thick, safe ice from here
const VIS = 0.3, CELL = 0.4, CRACK_S = 0.6, REFREEZE_S = 150, BREAK_R = 0.85, NSHARD = 64;

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function crackLines(g, cx, cy, n, len, rnd, lw = 1.4) {
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + rnd() * 0.6, x = cx, y = cy; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
    const L = len * (0.5 + rnd() * 0.6);
    for (let s = 0; s < 9; s++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * L / 9; y += Math.sin(a) * L / 9; g.lineTo(x, y);
      if (rnd() < 0.25) { const b = a + (rnd() - 0.5) * 2; g.moveTo(x, y); g.lineTo(x + Math.cos(b) * L * 0.15, y + Math.sin(b) * L * 0.15); g.moveTo(x, y); } }
    g.stroke();
  }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createIce(ctx, { send, sound, onFall }) {
  const { scene, phys, player } = ctx; const st = player.state;
  const root = new THREE.Group(); root.name = 'cold:ice'; root.userData.keep = true; scene.add(root);
  const frost = canvasTex(512, 512, (g, w, h) => {
    const r = rng(7); g.fillStyle = '#c9dde8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = 1 + r() * 7; g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.16})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 7; i++) crackLines(g, r() * w, r() * h, 3 + (r() * 3 | 0), 120 + r() * 160, r, 1);
    g.strokeStyle = 'rgba(70,100,120,0.25)'; for (let i = 0; i < 4; i++) crackLines(g, r() * w, r() * h, 3, 90, r, 1);
  });
  const crackTex = canvasTex(512, 512, (g, w, h) => { const r = rng(3); g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(245,252,255,0.95)'; crackLines(g, w / 2, h / 2, 9, 250, r, 2.4); g.strokeStyle = 'rgba(40,70,90,0.7)'; crackLines(g, w / 2, h / 2, 6, 200, r, 1.3); }, false);
  const mat = new THREE.MeshStandardMaterial({ color: 0xeaf6fc, map: frost, transparent: true, opacity: 0.8, roughness: 0.22, metalness: 0.0, depthWrite: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec2 vIceXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vIceXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = 'varying vec2 vIceXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 texelColor = texture2D(map, vIceXZ * 0.33); diffuseColor *= texelColor;');
  };
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, opacity: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xe4f4fb, transparent: true, opacity: 0.85, roughness: 0.15 });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  const sheets = [];
  for (const w of waterBodies) {
    if (!w.outline || !w.isInside) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of w.outline) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    const nx = Math.max(1, Math.round((x1 - x0) / CELL)), nz = Math.max(1, Math.round((z1 - z0) / CELL)), cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
    const cells = []; const grid = new Int32Array(nx * nz).fill(-1);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const cx = x0 + (i + 0.5) * cw, cz = z0 + (k + 0.5) * cd; if (!w.isInside(cx, cz)) continue; grid[i * nz + k] = cells.length; cells.push({ i, k, x: cx, z: cz, col: null, hole: 0 }); }
    if (!cells.length) continue;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, cells.length); mesh.name = 'cold:ice:' + w.name; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3; mesh.userData.noCull = true; root.add(mesh);
    for (let j = 0; j < cells.length; j++) mesh.setMatrixAt(j, ZERO);
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), crackMat); crack.visible = false; crack.renderOrder = 4; root.add(crack);
    sheets.push({ name: w.name, w, x0, z0, nx, nz, cw, cd, cells, grid, mesh, crack, crackS: null, h: 0, cap: 0, shown: false, top: w.surfaceY + 0.03 });
  }
  const byName = new Map(sheets.map(s => [s.name, s]));
  const thickOf = (s) => THREE.MathUtils.clamp(s.h / 100 * 0.6, 0.015, 0.09);
  function cellMatrix(s, c) { const t = thickOf(s); _p.set(c.x, s.w.surfaceY + 0.03 - t / 2, c.z); _s.set(s.cw * 0.999, t, s.cd * 0.999); _q.identity(); return _m.compose(_p, _q, _s); }
  function placeCell(s, j) {
    const c = s.cells[j]; const visible = s.shown && !c.hole;
    s.mesh.setMatrixAt(j, visible ? cellMatrix(s, c) : ZERO); s.mesh.instanceMatrix.needsUpdate = true;
    if (visible && !c.col) { const y = s.w.surfaceY + 0.03; s.top = y; c.col = phys.boxAABB([c.x - s.cw / 2, y - 0.1, c.z - s.cd / 2], [c.x + s.cw / 2, y, c.z + s.cd / 2]); }
    else if (!visible && c.col) { phys.remove(c.col); c.col = null; }
  }
  const playerCell = (s) => { const p = st.pos; const i = Math.floor((p.x - s.x0) / s.cw), k = Math.floor((p.z - s.z0) / s.cd); return i >= 0 && k >= 0 && i < s.nx && k < s.nz ? s.grid[i * s.nz + k] : -1; };
  function refreshSheet(s) { // thickness changed visibly / shown toggled
    const want = s.h > VIS;
    if (want !== s.shown) { s.shown = want; s.mesh.visible = want; if (!want) { for (const c of s.cells) c.hole = 0; s.crackS = null; s.crack.visible = false; } }
    const pc = st.swimming || st.inWater ? playerCell(s) : -1; // never close ice over a swimmer's head
    for (let j = 0; j < s.cells.length; j++) { if (j === pc && !s.cells[j].col && s.shown) continue; placeCell(s, j); }
    s.lastT = thickOf(s);
  }

  // ---------------------------------------------------------------- shards (pooled)
  const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), shardMat, NSHARD); shards.frustumCulled = false; shards.count = 0; shards.visible = false; root.add(shards);
  const sh = Array.from({ length: NSHARD }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 0, life: 0, y: 0 })); let shNext = 0, shLive = 0;
  function spawnShards(x, y, z, n) { for (let i = 0; i < n; i++) { const o = sh[shNext]; shNext = (shNext + 1) % NSHARD; const a = Math.random() * 7; o.p.set(x + Math.cos(a) * Math.random() * 0.6, y + 0.05, z + Math.sin(a) * Math.random() * 0.6); o.v.set(Math.cos(a) * (0.6 + Math.random() * 1.4), 1 + Math.random() * 2.2, Math.sin(a) * (0.6 + Math.random() * 1.4)); o.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); o.w.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4); o.s = 0.05 + Math.random() * 0.13; o.life = 5 + Math.random() * 4; o.y = y; } shLive = NSHARD; shards.visible = true; }
  function stepShards(dt) {
    if (!shards.visible) return; let alive = 0;
    for (let i = 0; i < NSHARD; i++) { const o = sh[i]; if (o.life <= 0) { shards.setMatrixAt(i, ZERO); continue; } o.life -= dt; alive++;
      if (o.p.y > o.y - 0.02) { o.v.y -= 9.81 * dt; o.r.addScaledVector(o.w, dt); } else { o.v.multiplyScalar(Math.exp(-dt * 3)); o.v.y += (o.y - 0.015 - o.p.y) * 8 * dt; o.r.addScaledVector(o.w, dt * 0.1); }
      o.p.addScaledVector(o.v, dt); _e.set(o.r.x, o.r.y, o.r.z); _q.setFromEuler(_e); const k = Math.min(1, o.life); _s.set(o.s * k, o.s * 0.35 * k, o.s * 0.8 * k); shards.setMatrixAt(i, _m.compose(o.p, _q, _s)); }
    shards.count = NSHARD; shards.instanceMatrix.needsUpdate = true; if (!alive) shards.visible = false; shLive = alive;
  }

  // ---------------------------------------------------------------- crack + break
  function startCrack(s, x, z) { if (s.crackS) return; s.crackS = { x, z, t: 0 }; s.crack.position.set(x, s.top + 0.003, z); s.crack.rotation.y = Math.random() * 7; s.crack.scale.setScalar(0.2); s.crack.visible = true; sound?.('crack', { x, y: s.top, z }); }
  function breakAt(s, x, z, fromNet, idxs) {
    const list = idxs || []; if (!idxs) for (let j = 0; j < s.cells.length; j++) { const c = s.cells[j]; if (!c.hole && Math.hypot(c.x - x, c.z - z) < BREAK_R) list.push(j); }
    const now = performance.now() / 1000; let made = 0;
    for (const j of list) { const c = s.cells[j]; if (!c || c.hole) continue; c.hole = now; made++; placeCell(s, j); }
    if (!made) return [];
    if (s.shown) { spawnShards(x, s.w.surfaceY, z, 22); try { s.w.splash(x, s.w.surfaceY, z, 1.6); s.w.disturb(x, z, 1.0, 1.4); } catch {} sound?.('break', { x, y: s.top, z }); }
    if (!fromNet) send?.({ k: 'h', b: s.name, c: list, x: +x.toFixed(2), z: +z.toFixed(2) });
    return list;
  }

  // ---------------------------------------------------------------- per frame / slow step
  let onIce = null; const heavyBall = { t: 0 };
  function step(tempC, dt) { // slow (3 Hz)
    for (const s of sheets) {
      const cap = tempC < -10 ? 30 : tempC < 0 ? 6 : 0;
      if (tempC < 0 && s.h < cap) s.h = Math.min(cap, s.h + -tempC * 0.02 * dt);
      else if (tempC > 0 && s.h > 0) s.h = Math.max(0, s.h - tempC * 0.03 * dt);
      if ((s.h > VIS) !== s.shown || (s.shown && Math.abs(thickOf(s) - (s.lastT ?? 0)) > 0.008)) refreshSheet(s);
      // refreeze holes
      if (s.shown && tempC < 0) { const now = performance.now() / 1000, pc = playerCell(s); for (let j = 0; j < s.cells.length; j++) { const c = s.cells[j]; if (c.hole && now - c.hole > REFREEZE_S * Math.min(3, 4 / -tempC + 0.5) && j !== pc) { c.hole = 0; placeCell(s, j); } } }
      // a skipped cell over a swimmer closes once they leave it
      if (s.shown) { const pc = playerCell(s); for (let j = 0; j < s.cells.length; j++) { const c = s.cells[j]; if (!c.hole && !c.col && j !== pc) placeCell(s, j); } }
    }
  }
  function update(dt) {
    onIce = null; stepShards(dt);
    for (const s of sheets) {
      if (!s.shown) continue;
      const pc = playerCell(s);
      if (pc >= 0 && !s.cells[pc].hole && !st.swimming && Math.abs(st.pos.y - s.top) < 0.25) { onIce = s; if (s.h < THICK && !s.crackS) startCrack(s, st.pos.x, st.pos.z); }
      if (s.crackS) { const c = s.crackS; c.t += dt; s.crack.scale.setScalar(0.4 + 2.2 * Math.min(1, c.t / CRACK_S)); if (Math.random() < dt * 6) sound?.('creak', { x: c.x, y: s.top, z: c.z });
        if (c.t >= CRACK_S) { s.crackS = null; s.crack.visible = false; if (s.h < THICK) { const brokeUnder = pc >= 0 && Math.abs(st.pos.y - s.top) < 0.4; breakAt(s, c.x, c.z, false); if (brokeUnder) onFall?.(s); } } }
    }
    // heavy dynamic props on thin ice (2 Hz)
    heavyBall.t += dt; if (heavyBall.t > 0.5) { heavyBall.t = 0; for (const s of sheets) { if (!s.shown || s.h >= THICK || s.crackS) continue;
      const R = phys.RAPIER; const cx = s.x0 + s.nx * s.cw / 2, cz = s.z0 + s.nz * s.cd / 2; const shape = new R.Cuboid(s.nx * s.cw / 2, 0.3, s.nz * s.cd / 2);
      phys.world.intersectionsWithShape({ x: cx, y: s.top + 0.25, z: cz }, { x: 0, y: 0, z: 0, w: 1 }, shape, (col) => { const b = col.parent(); if (b && b.isDynamic() && b.mass() > 60) { /* person-weight or heavier: floaties resting on forming ice must not crack it */ const t = b.translation(); const i = Math.floor((t.x - s.x0) / s.cw), k = Math.floor((t.z - s.z0) / s.cd); const j = i >= 0 && k >= 0 && i < s.nx && k < s.nz ? s.grid[i * s.nz + k] : -1; if (j >= 0 && !s.cells[j].hole && s.cells[j].col && t.y > s.top - 0.05) { startCrack(s, t.x, t.z); return false; } } return true; }); } }
  }
  function applyNet(m) { const s = byName.get(m.b); if (!s || !Array.isArray(m.c)) return; breakAt(s, +m.x || 0, +m.z || 0, true, m.c.filter(Number.isInteger)); }
  function snapshot() { const now = performance.now() / 1000; const o = {}; for (const s of sheets) { const l = []; s.cells.forEach((c, j) => { if (c.hole) l.push([j, +(now - c.hole).toFixed(1)]); }); if (l.length) o[s.name] = l; } return o; }
  function applySnapshot(o) { const now = performance.now() / 1000; for (const [name, l] of Object.entries(o || {})) { const s = byName.get(name); if (!s || !Array.isArray(l)) continue; for (const [j, age] of l) { const c = s.cells[j]; if (!c || c.hole) continue; c.hole = now - (+age || 0); placeCell(s, j); } } }
  function set(v) { for (const s of sheets) { const h = typeof v === 'number' ? v : v?.[s.name]; if (typeof h === 'number') { s.h = Math.max(0, h); refreshSheet(s); } } }
  const info = () => Object.fromEntries(sheets.map(s => [s.name, { cm: +s.h.toFixed(2), shown: s.shown, thick: s.h >= THICK, cells: s.cells.length, holes: s.cells.reduce((a, c) => a + (c.hole ? 1 : 0), 0), colliders: s.cells.reduce((a, c) => a + (c.col ? 1 : 0), 0), cracking: !!s.crackS, top: +s.top.toFixed(3) }]));
  const holeIds = () => Object.fromEntries(sheets.map(s => [s.name, s.cells.map((c, j) => (c.hole ? j : -1)).filter(j => j >= 0)]));
  return { sheets, step, update, applyNet, snapshot, applySnapshot, set, info, holeIds, get onIce() { return onIce; }, breakAt: (name, x, z) => { const s = byName.get(name); return s ? breakAt(s, x, z, false) : []; }, get active() { return sheets.some(s => s.shown) || shLive > 0; } };
}
