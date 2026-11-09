// src/smash pre-merge pass. main.js calls installPrep(ctx) right after the physics world exists (before any piece
// builds), afterPieces(scene) before the global merge and afterMerge(scene, propBatch) after perf.js batched the
// dynamic props.
//   - phys.solid / phys.solidGroup are wrapped so we know which colliders belong to which furniture group;
//   - kit.mergeStatic is wrapped: right before a room piece merges its root, its furniture is classified
//     (src/smash/classify.js). Light things become rigid bodies (convex hull, realistic mass, asleep until touched)
//     so the merge skips them and perf.js batches them; heavy built-ins stay merged but are remembered (local box,
//     world matrix, a hull point cloud, colour) so a big enough hit can hide their triangles and burst them;
//   - afterPieces does the same for src/furnish props and names the dynamic props the pieces made themselves.
// Every item gets a stable id from piece + name + initial position (identical on every client).
import * as THREE from 'three';
import { classifyPiece, classifyFurnish, classifyDynamic, PICKUP_MAX_KG } from './classify.js';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _b = new THREE.Box3();

export function installPrep(ctx) {
  const phys = ctx.phys; const R = phys.RAPIER; const world = phys.world; const G = phys.GROUPS;
  const recs = []; let depth = 0;
  for (const k of ['solidGroup', 'solid']) {
    const f = phys[k].bind(phys);
    phys[k] = (g, ...a) => { depth++; try { const r = f(g, ...a); if (depth === 1 && g) recs.push({ g, cols: [].concat(r || []).filter(Boolean), done: false }); return r; } finally { depth--; } };
  }
  const kit = ctx.kit; const ms = kit.mergeStatic;
  kit.mergeStatic = (root, o) => { try { processRoot(root); } catch (e) { console.warn('[smash prep]', e); } return ms(root, o); };

  const items = []; const ids = new Set(); const byObj = new Map();
  const PROP_GROUPS = phys.groups(G.ALL, G.ALL & ~G.RAMP);
  const pieceOf = (o) => { for (let p = o; p; p = p.parent) if ((p.name || '').startsWith('piece:')) return p.name.slice(6); return '?'; };
  const inside = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
  const slug = (s) => String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x';
  function makeId(prefix, piece, name, c) {
    let id = `${prefix}:${piece}:${slug(name)}@${Math.round(c.x * 10)},${Math.round(c.y * 10)},${Math.round(c.z * 10)}`;
    if (ids.has(id)) { let i = 2; while (ids.has(id + '#' + i)) i++; id += '#' + i; }
    ids.add(id); return id;
  }
  function meshesOf(g, skipDynamic = true) {
    const out = []; g.traverse(o => { if (!o.isMesh || !o.visible) return; if (skipDynamic) for (let p = o; p && p !== g; p = p.parent) if (p.userData.dynamic) return; out.push(o); }); return out;
  }
  function worldBox(meshes) { const bb = new THREE.Box3(); for (const o of meshes) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.union(_b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } return bb; }
  function matsOf(meshes) {
    const out = []; for (const o of meshes) for (const m of [].concat(o.material)) if (m) out.push({ name: m.name || '', color: m.color ? m.color.getHexString() : '', transparent: !!(m.transparent || m.transmission > 0), metal: (m.metalness || 0) > 0.5, sheen: (m.sheen || 0) > 0 });
    return out;
  }
  // point cloud (world space) for hulls / fragments: up to `max` points spread over the meshes
  function cloud(meshes, max = 360) {
    let total = 0; for (const o of meshes) total += o.geometry.attributes.position.count;
    const step = Math.max(1, Math.floor(total / max)); const pts = [];
    for (const o of meshes) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += step) { _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push(_v.x, _v.y, _v.z); } }
    return new Float32Array(pts);
  }
  // representative colour: the biggest mesh's material colour x its vertex colours
  function colorOf(meshes) {
    let best = null, bv = -1;
    for (const o of meshes) { const m = [].concat(o.material)[0]; if (!m?.color) continue; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.getSize(_v); const v = (s.x + 0.01) * (s.y + 0.01) * (s.z + 0.01) * o.matrixWorld.getMaxScaleOnAxis() ** 3; if (v > bv) { bv = v; best = o; } }
    const c = new THREE.Color(0xbbb5aa); if (!best) return c;
    const m = [].concat(best.material)[0]; c.copy(m.color);
    const col = best.geometry.attributes.color; if (m.vertexColors && col) { let r = 0, g = 0, b = 0; const n = Math.min(col.count, 400); for (let i = 0; i < n; i++) { const k = Math.floor(i * col.count / n); r += col.getX(k); g += col.getY(k); b += col.getZ(k); } c.r *= r / n; c.g *= g / n; c.b *= b / n; }
    return c;
  }
  function removeColliders(cols) { for (const c of cols) { try { phys.tags.delete(c.handle); phys.remove(c); } catch {} } }
  function colliderDescs(cols) { // so a broken static thing can be rebuilt on repair
    const out = []; for (const c of cols) { try { const he = c.halfExtents?.(); if (!he) continue; const t = c.translation(), r = c.rotation(); out.push({ he: [he.x, he.y, he.z], t: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w], g: c.collisionGroups() }); } catch {} }
    return out;
  }

  // ---- light thing -> rigid body (asleep, convex hull, props' collision groups)
  function makeDynamic(g, rule, root) {
    // nested dynamic props (a lamp on a side table) keep their own bodies: lift them out of the group first
    for (const d of phys.dynamics) if (d.obj !== g && inside(d.obj, g)) (root || g.parent).attach(d.obj);
    g.updateWorldMatrix(true, true);
    const meshes = meshesOf(g); if (!meshes.length) return null;
    const bb = worldBox(meshes); const c = bb.getCenter(new THREE.Vector3()); const size = bb.getSize(new THREE.Vector3());
    const pts = cloud(meshes, 300); for (let i = 0; i < pts.length; i += 3) { pts[i] -= c.x; pts[i + 1] -= c.y; pts[i + 2] -= c.z; }
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setLinearDamping(0.12).setAngularDamping(0.35).setCanSleep(true));
    let desc = null; if (Math.min(size.x, size.y, size.z) >= 0.04 && meshes.length <= 80) { try { desc = R.ColliderDesc.convexHull(pts); } catch { desc = null; } }
    if (!desc) desc = R.ColliderDesc.cuboid(Math.max(0.01, size.x / 2), Math.max(0.01, size.y / 2), Math.max(0.01, size.z / 2));
    desc.setMass(rule.mass).setFriction(rule.material === 'fabric' ? 0.9 : 0.65).setRestitution(rule.material === 'rubber' ? 0.6 : 0.08).setCollisionGroups(PROP_GROUPS);
    const col = world.createCollider(desc, body); phys.tags.set(col.handle, 'piece:' + pieceOf(g) + ' (smash)');
    const offset = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).invert().multiply(g.matrixWorld);
    g.userData.dynamic = true;
    const d = { body, collider: col, obj: g, offset, parent: g.parent, sleepSkip: true };
    phys.dynamics.push(d); body.sleep();
    return d;
  }
  function addItem(it) { items.push(it); byObj.set(it.obj, it); if (it.d) it.d.smash = it; return it; }
  function dynItem(prefix, piece, name, rule, d) {
    d.obj.updateWorldMatrix(true, true); const t = d.body.translation(); const r = d.body.rotation();
    const bb = worldBox(meshesOf(d.obj, false)); const size = bb.getSize(new THREE.Vector3());
    return addItem({ id: makeId(prefix, piece, name, _v.set(t.x, t.y, t.z)), mode: 'dynamic', label: rule.label || name, material: rule.material, mass: d.collider.mass(), hpScale: rule.hpScale || 1,
      piece, obj: d.obj, d, size: [size.x, size.y, size.z], p0: [t.x, t.y, t.z], q0: [r.x, r.y, r.z, r.w], pickable: d.collider.mass() <= PICKUP_MAX_KG });
  }
  function staticItem(prefix, piece, name, rule, g, cols) {
    g.updateWorldMatrix(true, true); const meshes = meshesOf(g); if (!meshes.length) return null;
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); const box = new THREE.Box3();
    for (const o of meshes) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(_b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld))); }
    const wb = worldBox(meshes); const c = wb.getCenter(new THREE.Vector3()); const size = wb.getSize(new THREE.Vector3());
    // tables: one box over the whole table would swallow the (now dynamic) chairs tucked under it -> a box per part
    if (rule.refine && cols.length) { removeColliders(cols); cols = [].concat(phys.solid(g, 0.04) || []); }
    if (!cols.length) { // no collider (decor on a shelf): a box only props, rocks and punches see
      const sc = box.getCenter(new THREE.Vector3()), ss = box.getSize(new THREE.Vector3());
      const col = phys.boxLocal(g, sc.x, sc.y, sc.z, Math.max(0.01, ss.x / 2), Math.max(0.01, ss.y / 2), Math.max(0.01, ss.z / 2));
      phys.setGroups(col, G.PROPONLY, G.ALL); cols = [col]; phys.tags.set(col.handle, 'piece:' + piece + ' (smash proponly)');
    }
    return addItem({ id: makeId(prefix, piece, name, c), mode: 'static', label: rule.label || name, material: rule.material, mass: 0, hpScale: rule.hpScale || 1, piece, obj: g,
      cols, colDescs: colliderDescs(cols), meshes, box: box.expandByScalar(0.015), mw: g.matrixWorld.clone(), hull: cloud(meshes, 360), color: colorOf(meshes), size: [size.x, size.y, size.z], center: [c.x, c.y, c.z] });
  }

  // ---- a room piece is about to merge: its furniture first
  function processRoot(root) {
    const piece = (root.name || '').startsWith('piece:') ? root.name.slice(6) : null; if (!piece || piece === 'furnish') return;
    for (const r of recs) {
      if (r.done || !inside(r.g, root)) continue; r.done = true;
      const g = r.g; if (g.userData.dynamic || byObj.has(g)) continue;
      g.updateWorldMatrix(true, true); const meshes = meshesOf(g); if (!meshes.length) continue;
      const bb = worldBox(meshes); const s = bb.getSize(new THREE.Vector3());
      const rule = classifyPiece({ name: g.name, size: [s.x, s.y, s.z], nm: meshes.length, mats: matsOf(meshes), piece }); if (!rule) continue;
      if (rule.mode === 'dynamic') { const d = makeDynamic(g, rule, root); if (!d) continue; removeColliders(r.cols); dynItem('p', piece, g.name || rule.label, rule, d); }
      else staticItem('p', piece, g.name || rule.label, rule, g, r.cols);
    }
  }

  // furnish props: is there a real surface right under the prop's base (so a new body won't pop out of a seat box)?
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  function restsOnSurface(bb) {
    ray.origin.x = (bb.min.x + bb.max.x) / 2; ray.origin.z = (bb.min.z + bb.max.z) / 2; ray.origin.y = bb.min.y + 0.03;
    const h = world.castRay(ray, 0.2, true, R.QueryFilterFlags.EXCLUDE_SENSORS); if (!h) return false;
    const toi = h.timeOfImpact ?? h.toi; return toi > 0.004 && toi < 0.075;
  }

  const api = {
    items, byObj,
    afterPieces(scene) {
      const t0 = performance.now();
      for (const root of scene.children) if ((root.name || '').startsWith('piece:') && root.name !== 'piece:furnish') processRoot(root); // pieces that never merged
      world.updateSceneQueries?.();
      const froot = scene.children.find(c => c.name === 'piece:furnish');
      if (froot) {
        const props = []; froot.traverse(o => { if (o.userData.furnish && o !== froot) props.push(o); });
        for (const g of props) {
          if (byObj.has(g)) continue; const f = g.userData.furnish; g.updateWorldMatrix(true, true);
          const meshes = meshesOf(g); if (!meshes.length) continue;
          const bb = worldBox(meshes); const s = bb.getSize(new THREE.Vector3());
          const rule = classifyFurnish({ ...f, size: [s.x, s.y, s.z] }); if (!rule) continue;
          const name = f.room + '-' + f.name;
          if (f.dynamic) { const d = phys.dynamics.find(x => x.obj === g); if (d) { d.sleepSkip = true; dynItem('f', 'furnish', name, rule, d); } continue; }
          const rec = recs.find(r => r.g === g); const cols = rec ? rec.cols : [];
          if (rule.mode === 'dynamic' && (cols.length || restsOnSurface(bb))) {
            const d = makeDynamic(g, { ...rule, mass: Math.min(rule.mass, 60) }, froot); if (!d) continue; removeColliders(cols); if (rec) rec.done = true;
            dynItem('f', 'furnish', name, rule, d);
          } else { if (rec) rec.done = true; staticItem('f', 'furnish', name, { ...rule, mode: 'static' }, g, cols); }
        }
      }
      // dynamic props the pieces made themselves (vases, books, pillows…)
      for (const d of phys.dynamics) {
        if (d.smash) continue; d.sleepSkip = true;
        const meshes = meshesOf(d.obj, false);
        const rule = classifyDynamic({ name: d.obj.name, mats: matsOf(meshes), mass: d.collider.mass() });
        dynItem('d', pieceOf(d.obj), d.obj.name || rule.label, rule, d);
      }
      for (const d of phys.dynamics) d.collider.setCollisionGroups(PROP_GROUPS);
      window.__smashPrep = { items: items.length, dynamic: items.filter(i => i.mode === 'dynamic').length, static: items.filter(i => i.mode === 'static').length, ms: Math.round(performance.now() - t0) };
    },
    afterMerge(scene, propBatch) {
      api.propBatch = propBatch;
      for (const t of propBatch?.tracked || []) { const it = t.d?.smash; if (it) (it.tracked = it.tracked || []).push(t); }
      const merged = []; scene.traverse(o => { if (o.isMesh && o.name === 'merged') merged.push(o); });
      api.merged = merged;
      for (const d of phys.dynamics) { d.sleepSkip = true; d.collider.setCollisionGroups(PROP_GROUPS); }
    },
    PROP_GROUPS,
  };
  return api;
}
