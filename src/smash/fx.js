// Break visuals (src/smash): real Voronoi fracture of the item's own hull into convex pieces, physics debris,
// shard particles. Everything is pooled and capped and costs nothing while idle:
//   - fragments: <= 150 live rigid bodies drawn by TWO BatchedMeshes (opaque + glass), fixed slots reused with
//     setGeometryAt; each lives 8–20 s, then shrinks away; the oldest is recycled when the pool is full;
//   - shards: one InstancedMesh of 320 tiny tetrahedra with a CPU ballistic sim (no physics), hidden when idle.
// fracture(points, opts): Voronoi cells of a convex hull — seeds cluster around the impact point (small shards
// there, big pieces far away); wood uses a stretched metric so cells become long splinters.
import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const MAX_FRAG = 150, SLOT_V = 240, MAX_SHARD = 320;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();

// ---------------------------------------------------------------- convex clipping + Voronoi
function hullPoints(pts) {
  if (pts.length < 4) return null;
  let h; try { h = new ConvexHull().setFromPoints(pts); } catch { return null; }
  if (!h.faces.length) return null;
  return h;
}
// keep the part of a convex point set with n·p <= d
function clip(pts, n, d) {
  const h = hullPoints(pts); if (!h) return null;
  const out = []; const seen = new Set();
  for (const v of h.vertices) if (n.dot(v.point) <= d + 1e-6) out.push(v.point.clone());
  for (const f of h.faces) {
    let e = f.edge; do {
      const a = e.tail().point, b = e.head().point; const da = n.dot(a) - d, db = n.dot(b) - d;
      if ((da < 0) !== (db < 0) && Math.abs(da - db) > 1e-9) {
        const t = da / (da - db); const p = a.clone().lerp(b, t); const key = Math.round(p.x * 2000) + ',' + Math.round(p.y * 2000) + ',' + Math.round(p.z * 2000);
        if (!seen.has(key)) { seen.add(key); out.push(p); }
      }
      e = e.next;
    } while (e !== f.edge);
  }
  return out.length >= 4 ? out : null;
}
// pts: Float32Array world points; returns [{points: Vector3[] (world), center}]
export function fracture(cloud, { count = 8, impact = null, stretchAxis = null, stretch = 1, rng = Math.random } = {}) {
  const pts = []; for (let i = 0; i < cloud.length; i += 3) pts.push(new THREE.Vector3(cloud[i], cloud[i + 1], cloud[i + 2]));
  const h0 = hullPoints(pts); if (!h0) return [];
  const base = h0.vertices.map(v => v.point.clone());
  const bb = new THREE.Box3().setFromPoints(base); const ctr = bb.getCenter(new THREE.Vector3());
  // metric: compress the long axis for splinters
  const S = new THREE.Vector3(1, 1, 1); if (stretchAxis !== null) S.setComponent(stretchAxis, 1 / stretch);
  const toM = (p) => p.clone().sub(ctr).multiply(S), fromM = (p) => p.clone().divide(S).add(ctr);
  const mBase = base.map(toM);
  const imp = impact ? toM(impact.clone().clamp(bb.min, bb.max)) : null;
  // seeds: random points inside the hull (averages of hull vertices), pulled towards the impact for half of them
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const a = mBase[(rng() * mBase.length) | 0], b = mBase[(rng() * mBase.length) | 0], c = mBase[(rng() * mBase.length) | 0];
    const s = new THREE.Vector3().addScaledVector(a, 0.33).addScaledVector(b, 0.33).addScaledVector(c, 0.34).multiplyScalar(0.55 + rng() * 0.4);
    if (imp && i < count * 0.55) s.lerp(imp, 0.35 + rng() * 0.5);
    seeds.push(s);
  }
  const cells = []; const n = new THREE.Vector3();
  for (let i = 0; i < seeds.length; i++) {
    let cell = mBase;
    for (let j = 0; j < seeds.length && cell; j++) {
      if (i === j) continue; n.subVectors(seeds[j], seeds[i]); const L = n.length(); if (L < 1e-5) continue; n.divideScalar(L);
      const mid = _v.addVectors(seeds[i], seeds[j]).multiplyScalar(0.5); cell = clip(cell, n, n.dot(mid));
    }
    if (!cell) continue;
    const w = cell.map(fromM); const c = new THREE.Vector3(); for (const p of w) c.add(p); c.divideScalar(w.length);
    cells.push({ points: w, center: c });
  }
  return cells;
}

// ---------------------------------------------------------------- pools
export function createFx(ctx) {
  const { scene, phys } = ctx; const R = phys.RAPIER, world = phys.world, G = phys.GROUPS;
  const FRAG_GROUPS = phys.groups(G.ALL, G.ALL & ~(G.RAMP | G.PLAYER));
  const tetra = new THREE.TetrahedronGeometry(0.02); tetra.deleteAttribute('uv');
  const mkBatch = (mat, name) => {
    const b = new THREE.BatchedMesh(MAX_FRAG, MAX_FRAG * SLOT_V, MAX_FRAG * SLOT_V, mat); b.name = name; b.frustumCulled = false; b.perObjectFrustumCulled = true;
    b.castShadow = false; b.receiveShadow = true; b.userData.keep = true; b.userData.noProbe = true; b.visible = false; scene.add(b); return b;
  };
  const opaque = mkBatch(new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.0 }), 'smash:debris');
  const glassy = mkBatch(new THREE.MeshStandardMaterial({ roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.5, envMapIntensity: 1.6 }), 'smash:shards');
  const slots = [];
  for (const b of [opaque, glassy]) for (let i = 0; i < MAX_FRAG; i++) {
    const gid = b.addGeometry(tetra, SLOT_V); const iid = b.addInstance(gid); b.setVisibleAt(iid, false);
    slots.push({ b, gid, iid, live: false, body: null, t: 0, life: 0, scale: 1 });
  }
  const live = []; let liveN = 0; // FIFO of live fragment slots

  // shard particles
  const shardMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1 });
  const shards = new THREE.InstancedMesh(tetra, shardMat, MAX_SHARD); shards.name = 'smash:sparks'; shards.frustumCulled = false; shards.userData.keep = true; shards.userData.noProbe = true;
  shards.count = 0; shards.visible = false; scene.add(shards);
  for (let i = 0; i < MAX_SHARD; i++) { shards.setColorAt(i, _c.set(0xffffff)); shards.setMatrixAt(i, _m.makeScale(0, 0, 0)); }
  const _e = new THREE.Euler();
  const P = { pos: new Float32Array(MAX_SHARD * 3), vel: new Float32Array(MAX_SHARD * 3), rot: new Float32Array(MAX_SHARD * 3), life: new Float32Array(MAX_SHARD), floor: new Float32Array(MAX_SHARD), size: new Float32Array(MAX_SHARD) };
  let shardHead = 0, shardsAlive = 0;

  // glass glitter (bright specks that twinkle while they fall/settle) and crack webs (StarKnightt/glass-break's look,
  // re-implemented): one InstancedMesh + one LineSegments, hidden when idle
  const MAX_GL = 160; const glit = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.006), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_GL);
  glit.name = 'smash:glitter'; glit.frustumCulled = false; glit.userData.keep = true; glit.userData.noProbe = true; glit.visible = false; scene.add(glit);
  for (let i = 0; i < MAX_GL; i++) glit.setMatrixAt(i, _m.makeScale(0, 0, 0));
  const GL = { pos: new Float32Array(MAX_GL * 3), vel: new Float32Array(MAX_GL * 3), life: new Float32Array(MAX_GL), floor: new Float32Array(MAX_GL), ph: new Float32Array(MAX_GL) }; let glHead = 0, glAlive = 0, glT = 0;
  function glitter(at, n, { speed = 2, floorY = at.y - 1 } = {}) {
    for (let k = 0; k < n; k++) { const i = glHead; glHead = (glHead + 1) % MAX_GL; const a = Math.random() * 6.283, sp = speed * (0.3 + Math.random());
      GL.pos.set([at.x, at.y, at.z], i * 3); GL.vel.set([Math.cos(a) * sp, (0.3 + Math.random()) * sp * 0.7, Math.sin(a) * sp], i * 3); GL.life[i] = 2 + Math.random() * 4; GL.floor[i] = floorY + 0.004; GL.ph[i] = Math.random() * 6.283; }
    glAlive = MAX_GL; glit.visible = true;
  }
  const MAX_CRACK_V = 40 * 64; const crackGeo = new THREE.BufferGeometry(); crackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CRACK_V * 3), 3)); crackGeo.setDrawRange(0, 0);
  const cracksMesh = new THREE.LineSegments(crackGeo, new THREE.LineBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  cracksMesh.name = 'smash:cracks'; cracksMesh.frustumCulled = false; cracksMesh.userData.keep = true; cracksMesh.renderOrder = 3; cracksMesh.visible = false; scene.add(cracksMesh);
  let webs = []; // { key, segs: Float32Array, t }
  function rebuildCracks() { const a = crackGeo.attributes.position.array; let n = 0; for (const w of webs) { if (n + w.segs.length > a.length) break; a.set(w.segs, n); n += w.segs.length; } crackGeo.setDrawRange(0, n / 3); crackGeo.attributes.position.needsUpdate = true; crackGeo.computeBoundingSphere(); cracksMesh.visible = n > 0; }
  // a crack web at p on the plane facing `normal`, size r (m), severity 0..1
  function crack(key, p, normal, r = 0.15, severity = 0.5) {
    const N = new THREE.Vector3(normal.x, normal.y, normal.z).normalize(); const U = new THREE.Vector3().crossVectors(N, Math.abs(N.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(); const Vv = new THREE.Vector3().crossVectors(N, U);
    const P = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(N, 0.003); const out = []; const pt = (u, v) => P.clone().addScaledVector(U, u).addScaledVector(Vv, v);
    const rays = 6 + Math.round(severity * 6); const ends = [];
    for (let k = 0; k < rays; k++) { let a = (k / rays) * 6.283 + Math.random() * 0.4, rr = 0; let prev = pt(0, 0); const L = r * (0.5 + Math.random() * 0.7) * (0.6 + severity);
      for (let j = 0; j < 4; j++) { rr += L / 4; a += (Math.random() - 0.5) * 0.35; const q = pt(Math.cos(a) * rr, Math.sin(a) * rr); out.push(prev.x, prev.y, prev.z, q.x, q.y, q.z); prev = q; if (j === 1) ends.push([a, rr]); } }
    for (let k = 0; k < ends.length; k++) { const [a0, r0] = ends[k], [a1, r1] = ends[(k + 1) % ends.length]; if (Math.random() < 0.7) { const p0 = pt(Math.cos(a0) * r0, Math.sin(a0) * r0), p1 = pt(Math.cos(a1) * r1, Math.sin(a1) * r1); out.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); } }
    webs.push({ key, segs: new Float32Array(out), t: 0 }); if (webs.length > 40) webs.shift(); rebuildCracks();
  }
  function clearCracks(key) { const n = webs.length; webs = webs.filter(w => w.key !== key); if (webs.length !== n) rebuildCracks(); }

  function freeSlot(s) {
    if (s.body) { try { world.removeRigidBody(s.body); } catch {} s.body = null; }
    s.b.setVisibleAt(s.iid, false); s.live = false;
  }
  function takeSlot(glass) {
    const b = glass ? glassy : opaque;
    let s = slots.find(x => !x.live && x.b === b);
    if (!s) { const i = live.findIndex(x => x.b === b); if (i < 0) return null; s = live[i]; live.splice(i, 1); freeSlot(s); }
    return s;
  }

  // spawn the cells as debris. opts: { color, glass, mass, vel (inherited), impact, dir, power, life:[a,b] }
  function spawn(cells, o) {
    const n = cells.length; let made = 0;
    for (const cell of cells) {
      if (cell.points.length < 4) continue;
      // degenerate cells (slivers, near-flat) would make Rapier's hull builder panic: dedupe + size check first
      { const seen = new Set(), pts = []; for (const p of cell.points) { const k = Math.round(p.x * 400) + ',' + Math.round(p.y * 400) + ',' + Math.round(p.z * 400); if (!seen.has(k)) { seen.add(k); pts.push(p); } } cell.points = pts; }
      if (cell.points.length < 4) continue;
      { const bb = new THREE.Box3().setFromPoints(cell.points); const sz = bb.getSize(_v); if (Math.min(sz.x, sz.y, sz.z) < 0.012) continue; }
      let geo; try { geo = new ConvexGeometry(cell.points.map(p => p.clone().sub(cell.center))); } catch { continue; }
      if (geo.attributes.position.count > SLOT_V) { geo.dispose(); continue; }
      geo.deleteAttribute('uv');
      const s = takeSlot(o.glass); if (!s) { geo.dispose(); continue; }
      s.b.setGeometryAt(s.gid, geo); geo.dispose();
      const c = cell.center; const loc = []; for (const p of cell.points) loc.push(p.x - c.x, p.y - c.y, p.z - c.z);
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setLinearDamping(0.2).setAngularDamping(0.4).setCcdEnabled(false));
      let desc = null; try { desc = R.ColliderDesc.convexHull(new Float32Array(loc)); } catch { desc = null; }
      if (!desc) { const bb = new THREE.Box3().setFromPoints(cell.points).getSize(_v); desc = R.ColliderDesc.cuboid(bb.x / 2, bb.y / 2, bb.z / 2); }
      desc.setMass(Math.max(0.03, (o.mass || 1) / n)).setFriction(0.8).setRestitution(o.glass ? 0.15 : 0.05).setCollisionGroups(FRAG_GROUPS);
      world.createCollider(desc, body);
      // velocity: inherited + burst away from the impact + along the hit direction
      const out = _v.copy(c).sub(o.impact || c); const L = out.length(); if (L > 1e-4) out.divideScalar(L); else out.set(Math.random() - 0.5, 0.6, Math.random() - 0.5).normalize();
      const pw = o.power ?? 1.5; const vv = { x: (o.vel?.x || 0) + out.x * pw * (0.6 + Math.random() * 0.8) + (o.dir?.x || 0) * pw * 0.6, y: (o.vel?.y || 0) + out.y * pw * 0.7 + pw * 0.35 * Math.random(), z: (o.vel?.z || 0) + out.z * pw * (0.6 + Math.random() * 0.8) + (o.dir?.z || 0) * pw * 0.6 };
      body.setLinvel(vv, true); body.setAngvel({ x: (Math.random() - 0.5) * pw * 4, y: (Math.random() - 0.5) * pw * 4, z: (Math.random() - 0.5) * pw * 4 }, true);
      _c.copy(o.color || _c.set(0xcccccc)); const j = 0.9 + Math.random() * 0.18; _c.multiplyScalar(j); s.b.setColorAt(s.iid, _c);
      s.body = body; s.live = true; s.t = 0; s.life = (o.life?.[0] ?? 8) + Math.random() * ((o.life?.[1] ?? 20) - (o.life?.[0] ?? 8)); s.scale = 1;
      _m.compose(_w.set(c.x, c.y, c.z), _q.identity(), _s.set(1, 1, 1)); s.b.setMatrixAt(s.iid, _m); s.b.setVisibleAt(s.iid, true); s.b.visible = true;
      live.push(s); made++;
    }
    liveN = live.length; return made;
  }

  // shard particles: n tiny pieces from `at`, colour, speed
  function sparks(at, n, { color = 0xffffff, speed = 2.5, floorY = at.y - 1, size = 1, up = 1 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = shardHead; shardHead = (shardHead + 1) % MAX_SHARD;
      P.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.1; P.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * 0.1; P.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.1;
      const a = Math.random() * Math.PI * 2, e = Math.random() * up; const sp = speed * (0.35 + Math.random());
      P.vel[i * 3] = Math.cos(a) * sp; P.vel[i * 3 + 1] = (0.4 + e) * sp * 0.8; P.vel[i * 3 + 2] = Math.sin(a) * sp;
      P.rot[i * 3] = Math.random() * 6; P.rot[i * 3 + 1] = Math.random() * 6; P.rot[i * 3 + 2] = Math.random() * 6;
      P.life[i] = 1.2 + Math.random() * 2.2; P.floor[i] = floorY; P.size[i] = size * (0.4 + Math.random() * 0.9);
      _c.set(color).multiplyScalar(0.85 + Math.random() * 0.3); shards.setColorAt(i, _c);
    }
    shards.instanceColor.needsUpdate = true; shardsAlive = MAX_SHARD; shards.count = MAX_SHARD; shards.visible = true;
  }

  function update(dt) {
    if (webs.length) { let ch = false; for (const w of webs) w.t += dt; const n = webs.length; webs = webs.filter(w => w.t < 30); if (webs.length !== n) rebuildCracks(); }
    if (glAlive) { glT += dt; let alive = 0;
      for (let i = 0; i < MAX_GL; i++) { if (GL.life[i] <= 0) continue; alive++; GL.life[i] -= dt; const o = i * 3;
        if (GL.pos[o + 1] > GL.floor[i]) { GL.vel[o + 1] -= 6 * dt; GL.pos[o] += GL.vel[o] * dt; GL.pos[o + 1] += GL.vel[o + 1] * dt; GL.pos[o + 2] += GL.vel[o + 2] * dt; if (GL.pos[o + 1] <= GL.floor[i]) { GL.pos[o + 1] = GL.floor[i]; GL.vel[o] = GL.vel[o + 2] = 0; } }
        const tw = Math.abs(Math.sin(glT * 9 + GL.ph[i])) ** 6; const sc = GL.life[i] > 0 ? (0.25 + 1.6 * tw) * Math.min(1, GL.life[i] / 0.5) : 0;
        _m.compose(_w.set(GL.pos[o], GL.pos[o + 1], GL.pos[o + 2]), _q.identity(), _s.setScalar(sc)); glit.setMatrixAt(i, _m); }
      glit.instanceMatrix.needsUpdate = true; glAlive = alive; if (!alive) glit.visible = false; }
    // fragments: follow bodies while awake, age, shrink, free
    if (liveN) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i]; s.t += dt;
        const left = s.life - s.t; const k = left < 1.2 ? Math.max(0, left / 1.2) : 1;
        if (k <= 0 || !s.body) { live.splice(i, 1); freeSlot(s); continue; }
        if (s.body.isSleeping() && k === 1 && s.scale === 1) continue;
        const t = s.body.translation(), r = s.body.rotation(); if (t.y < -40) { live.splice(i, 1); freeSlot(s); continue; }
        s.scale = k; _m.compose(_w.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s.setScalar(Math.max(0.001, k))); s.b.setMatrixAt(s.iid, _m);
      }
      liveN = live.length; if (!liveN) { opaque.visible = false; glassy.visible = false; }
    }
    // sparks
    if (shardsAlive) {
      let alive = 0;
      for (let i = 0; i < MAX_SHARD; i++) {
        if (P.life[i] <= 0) { if (P.size[i] > 0) { P.size[i] = 0; _m.makeScale(0, 0, 0); shards.setMatrixAt(i, _m); } continue; }
        alive++; P.life[i] -= dt; const o = i * 3;
        P.vel[o + 1] -= 9.81 * dt; P.pos[o] += P.vel[o] * dt; P.pos[o + 1] += P.vel[o + 1] * dt; P.pos[o + 2] += P.vel[o + 2] * dt;
        if (P.pos[o + 1] < P.floor[i]) { P.pos[o + 1] = P.floor[i]; P.vel[o + 1] *= -0.25; P.vel[o] *= 0.55; P.vel[o + 2] *= 0.55; }
        else { P.rot[o] += dt * 9; P.rot[o + 2] += dt * 7; }
        const sc = P.size[i] * Math.min(1, P.life[i] / 0.4);
        _m.compose(_w.set(P.pos[o], P.pos[o + 1], P.pos[o + 2]), _q.setFromEuler(_e.set(P.rot[o], P.rot[o + 1], P.rot[o + 2])), _s.setScalar(sc)); shards.setMatrixAt(i, _m);
      }
      shards.instanceMatrix.needsUpdate = true;
      shardsAlive = alive; if (!alive) { shards.visible = false; shards.count = 0; }
    }
  }
  return { fracture, spawn, sparks, glitter, crack, clearCracks, update, get live() { return liveN; }, get sparksAlive() { return shardsAlive; }, batches: [opaque, glassy, shards, glit, cracksMesh] };
}
