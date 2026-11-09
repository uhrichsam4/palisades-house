// Rapier physics wrapper. Static colliders for the building + furniture, dynamic rigid bodies for
// props (synced to meshes every step), fixed 60 Hz timestep.
import * as THREE from 'three';
import RAPIER from 'rapier';

export async function createPhysics() {
  await RAPIER.init();
  // Safety net: a JS handle to a body/collider that something already removed (breaks, debris, collapses, games)
  // makes Rapier panic inside wasm ("unreachable") and then every later physics call fails ("recursive use of an
  // object"). Many modules keep their own lists, so guard the methods they use: on a removed object they become
  // no-ops returning a harmless default instead of killing the whole physics world for the session.
  for (const [C, list] of [[RAPIER.RigidBody, { isSleeping: true, translation: () => ({ x: 0, y: -1000, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }), linvel: () => ({ x: 0, y: 0, z: 0 }), angvel: () => ({ x: 0, y: 0, z: 0 }),
      mass: 0, isDynamic: false, isKinematic: false, isFixed: true, isEnabled: false, isMoving: false,
      applyImpulse: undefined, applyTorqueImpulse: undefined, applyImpulseAtPoint: undefined, addForce: undefined, setTranslation: undefined, setRotation: undefined, setNextKinematicTranslation: undefined, setNextKinematicRotation: undefined,
      setLinvel: undefined, setAngvel: undefined, wakeUp: undefined, sleep: undefined, setEnabled: undefined, setGravityScale: undefined, setCcdEnabled: undefined, setLinearDamping: undefined, setAngularDamping: undefined, lockRotations: undefined, setBodyType: undefined }],
    [RAPIER.Collider, { translation: () => ({ x: 0, y: -1000, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }), parent: null, isEnabled: false, activeEvents: 0,
      setEnabled: undefined, setCollisionGroups: undefined, setSolverGroups: undefined, setActiveEvents: undefined, setContactForceEventThreshold: undefined, setActiveCollisionTypes: undefined, setTranslation: undefined, setTranslationWrtParent: undefined, setSensor: undefined, setFriction: undefined, setRestitution: undefined }]]) {
    const P = C?.prototype; if (!P || typeof P.isValid !== 'function') continue;
    for (const [name, dflt] of Object.entries(list)) {
      const f = P[name]; if (typeof f !== 'function') continue;
      P[name] = function (...a) { if (!this.isValid()) return typeof dflt === 'function' ? dflt() : dflt; return f.apply(this, a); };
    }
  }
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const dynamics = []; // { body, mesh, offset }
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
  let acc = 0;
  const stepHooks = [];
  // Impacts (2026-11-08): colliders that opt in with phys.watchImpacts(collider, threshold) report contact forces
  // to every phys.onImpact(fn) listener as { a, b (collider handles), force (N), dir {x,y,z}, ownerA, ownerB }.
  // phys.claim(collider, info) labels a collider (window glass, prop, rock, car…) so listeners know what was hit.
  const impactHooks = []; const owners = new Map(); let eventQueue = null;

  const tags = new Map(); // collider handle -> who made it (for the walkability audit)
  let curTag = 'core';
  const fixed = (desc) => { const c = world.createCollider(desc); tags.set(c.handle, curTag); return c; };
  // Removing a rigid body (breaks, debris, collapses) must also drop it from every per-frame list, or the next
  // isSleeping()/translation() on the freed body panics inside Rapier ("unreachable", then "recursive use of an
  // object" on every later call). Records get d.dead = true; anything that keeps its own list checks it.
  { const rrb = world.removeRigidBody.bind(world);
    world.removeRigidBody = (b) => {
      if (!b) return;
      for (let i = dynamics.length - 1; i >= 0; i--) if (dynamics[i].body === b) { dynamics[i].dead = true; dynamics.splice(i, 1); }
      if (b.isValid && !b.isValid()) return;
      try { rrb(b); } catch (e) { console.warn('[phys] removeRigidBody', e); }
    };
  }
  const phys = {
    RAPIER, world, dynamics,
    alive: (d) => !!d && !d.dead && (!d.body?.isValid || d.body.isValid()),
    // wall piece from a segment (see shell.js): p0,p1 Vector2 on face line, N Vector2 normal, depth, y range
    boxFromSeg(p0, p1, N, depth, y0, y1) {
      const L = p0.distanceTo(p1); if (L < 0.01 || y1 - y0 < 0.01) return null;
      const cx = (p0.x + p1.x) / 2 + N.x * depth / 2, cz = (p0.y + p1.y) / 2 + N.y * depth / 2;
      const ang = Math.atan2(-(p1.y - p0.y), p1.x - p0.x);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      return fixed(RAPIER.ColliderDesc.cuboid(L / 2, (y1 - y0) / 2, depth / 2).setTranslation(cx, (y0 + y1) / 2, cz).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }));
    },
    // cuboid in an object's local frame (centre cx,cy,cz; half extents hx,hy,hz)
    boxLocal(obj, cx, cy, cz, hx, hy, hz) {
      obj.updateWorldMatrix(true, false);
      _v.set(cx, cy, cz).applyMatrix4(obj.matrixWorld); obj.matrixWorld.decompose(new THREE.Vector3(), _q, _s);
      return fixed(RAPIER.ColliderDesc.cuboid(Math.max(0.005, hx * _s.x), Math.max(0.005, hy * _s.y), Math.max(0.005, hz * _s.z)).setTranslation(_v.x, _v.y, _v.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }));
    },
    // world-space axis-aligned box from min/max
    boxAABB(min, max) {
      return fixed(RAPIER.ColliderDesc.cuboid((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2).setTranslation((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2));
    },
    // world-space geometry -> static triangle mesh
    trimesh(geo) {
      const g = geo.index ? geo : geo.clone();
      const pos = g.attributes.position.array; const verts = new Float32Array(pos);
      let idx; if (g.index) idx = new Uint32Array(g.index.array); else { idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i; }
      return fixed(RAPIER.ColliderDesc.trimesh(verts, idx));
    },
    // Make furniture solid: one oriented box per mesh (skips meshes smaller than minSize).
    // For a whole sofa group, prefer phys.solidGroup(group) which uses one box for the group's local bounds.
    solid(root, minSize = 0.06) {
      root.updateWorldMatrix(true, true); const out = [];
      root.traverse(o => {
        if (!o.isMesh || o.userData.noCollide) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox; const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
        o.matrixWorld.decompose(_v, _q, _s);
        if (size.x * _s.x < minSize && size.y * _s.y < minSize && size.z * _s.z < minSize) return;
        out.push(phys.boxLocal(o, c.x, c.y, c.z, size.x / 2, size.y / 2, size.z / 2));
      });
      return out;
    },
    solidGroup(group) {
      group.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(); const bb = new THREE.Box3();
      group.traverse(o => { if (o.isMesh) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); bb.union(b); } });
      if (bb.isEmpty()) return null; const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
      // A group spread over a big area (e.g. a whole kitchen run + far wall panels) must not become one giant
      // invisible box: fall back to one box per mesh. Real furniture is < 3.5 m in plan.
      if (Math.max(s.x, s.z) > 3.5) return phys.solid(group);
      return phys.boxLocal(group, c.x, c.y, c.z, s.x / 2, s.y / 2, s.z / 2);
    },
    // Dynamic prop: mesh (or group) becomes a rigid body. shape: 'box' | 'ball' | 'hull'.
    dynamic(obj, { mass = 1, shape = 'box', friction = 0.6, restitution = 0.2, linearDamping = 0.05, angularDamping = 0.1, ccd = false } = {}) {
      obj.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(obj); const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
      obj.matrixWorld.decompose(_v, _q, _s);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setLinearDamping(linearDamping).setAngularDamping(angularDamping).setCcdEnabled(ccd));
      let desc;
      if (shape === 'ball') desc = RAPIER.ColliderDesc.ball(Math.max(size.x, size.y, size.z) / 2);
      else if (shape === 'hull') {
        const pts = []; const inv = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
        obj.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; const mw = o.matrixWorld; for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 300))) { _v.fromBufferAttribute(p, i).applyMatrix4(mw).applyMatrix4(inv); pts.push(_v.x, _v.y, _v.z); } } });
        desc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts)) || RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
      } else desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
      desc.setMass(mass).setFriction(friction).setRestitution(restitution);
      const col = world.createCollider(desc, body);
      // keep the mesh's pose relative to the body centre
      const parent = obj.parent; const offset = new THREE.Matrix4();
      const bodyM = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z);
      offset.copy(bodyM).invert().multiply(obj.matrixWorld);
      obj.userData.dynamic = true;
      const d = { body, collider: col, obj, offset, parent }; dynamics.push(d); return d;
    },
    remove(collider) { if (collider) world.removeCollider(collider, true); },
    tags,
    // phys.tagged('piece:kitchen') -> same API, but every collider it creates is labelled with that tag
    tagged(tag) {
      const wrap = (fn) => (...a) => { const prev = curTag; curTag = tag; try { return fn(...a); } finally { curTag = prev; } };
      const t = Object.create(phys);
      for (const k of ['boxFromSeg', 'boxLocal', 'boxAABB', 'trimesh', 'solid', 'solidGroup']) t[k] = wrap(phys[k]);
      t.dynamic = (obj, o) => { const d = phys.dynamic(obj, o); tags.set(d.collider.handle, tag + ' (dynamic)'); return d; };
      return t;
    },
    onStep(fn) { stepHooks.push(fn); },
    // Collision groups (src/smash, 2026-11-08). Rapier packs membership (high 16 bits) + filter (low 16 bits).
    // Everything defaults to 0xFFFF/0xFFFF. PLAYER = the local player's capsule; RAMP = invisible player-only
    // ramps over steps (every dynamic prop's filter drops it, so props land on the real treads); PROPONLY = colliders
    // only props see (stair treads under a ramp; the player's character controller skips them).
    GROUPS: { PLAYER: 0x2000, PROPONLY: 0x4000, RAMP: 0x8000, ALL: 0xFFFF },
    groups(membership, filter = 0xFFFF) { return ((membership & 0xFFFF) << 16 | (filter & 0xFFFF)) >>> 0; },
    setGroups(collider, membership, filter = 0xFFFF) { if (collider) collider.setCollisionGroups(phys.groups(membership, filter)); return collider; },
    claim(collider, info) { if (collider) owners.set(collider.handle ?? collider, info); return collider; },
    ownerOf(handle) { return owners.get(handle); },
    unclaim(collider) { if (collider) owners.delete(collider.handle ?? collider); },
    watchImpacts(collider, threshold = 50) { if (!collider) return; collider.setActiveEvents(collider.activeEvents() | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS); collider.setContactForceEventThreshold(threshold); },
    onImpact(fn) { impactHooks.push(fn); if (!eventQueue) eventQueue = new RAPIER.EventQueue(true); return () => { const i = impactHooks.indexOf(fn); if (i >= 0) impactHooks.splice(i, 1); }; },
    step(dt) {
      acc += Math.min(dt, 0.1); let n = 0;
      while (acc >= world.timestep && n < 4) {
        for (const h of stepHooks) h(world.timestep);
        if (eventQueue && impactHooks.length) {
          world.step(eventQueue);
          eventQueue.drainContactForceEvents((ev) => {
            const a = ev.collider1(), b = ev.collider2(); const d = ev.maxForceDirection();
            const e = { a, b, force: ev.totalForceMagnitude(), dir: { x: d.x, y: d.y, z: d.z }, ownerA: owners.get(a), ownerB: owners.get(b) };
            for (const f of impactHooks) { try { f(e); } catch (err) { console.warn('[impact]', err); } }
          });
        } else world.step();
        acc -= world.timestep; n++;
      }
      const bm = new THREE.Matrix4(), pinv = new THREE.Matrix4();
      for (const d of dynamics) {
        if (d.sleepSkip && d.body.isSleeping()) continue; // src/smash: resting props cost nothing (pose already written)
        const t = d.body.translation(), r = d.body.rotation();
        bm.compose(_v.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s.set(1, 1, 1)).multiply(d.offset);
        // use the object's CURRENT parent (pieces may register props before adding them, or re-parent them)
        const parent = d.obj.parent;
        if (parent) { parent.updateWorldMatrix(true, false); pinv.copy(parent.matrixWorld).invert(); bm.premultiply(pinv); }
        bm.decompose(d.obj.position, d.obj.quaternion, d.obj.scale);
      }
    },
  };
  return phys;
}
