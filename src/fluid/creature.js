// Water creature (main thread side): owns the sim backend (Web Worker, inline fallback), the Rapier
// collision probes the sim needs, and the rendering:
//   body     surface-nets iso-surface of the attached particles, MeshPhysicalMaterial with real
//            transmission (refracts the scene behind it), ior 1.33, Beer-Lambert tint per player hue,
//            sky env reflections (Fresnel) + sharp specular
//   droplets InstancedMesh of tiny transmissive spheres (flying), flattened beads (puddles)
//   eyes     two glossy dark eyes that ride on the sloshing head (facing reads)
//   shadow   soft contact shadow on the floor
//   tag      canvas name sprite (remote players)
import * as THREE from 'three';
import { CreatureSim } from './sim.js';
import { waterBodies } from '../water/index.js';

const MAXV = 24000, MAXI = 96000, MAXD = 96;
let _shadowTex = null;
function shadowTex() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); _shadowTex = new THREE.CanvasTexture(c); _shadowTex.colorSpace = THREE.SRGBColorSpace; return _shadowTex;
}

export function waterMaterial(ctx, hue) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(hue, 0.2, 0.98),
    metalness: 0, roughness: 0.015, transmission: 1, thickness: 0.95, ior: 1.33, dispersion: 0.12,
    attenuationColor: new THREE.Color().setHSL(hue, 0.45, 0.84), attenuationDistance: 2.0,
    specularIntensity: 1, specularColor: new THREE.Color(1, 1, 1), envMapIntensity: 1.6,
    clearcoat: 0.0,
  });
  m.userData.hue = hue;
  return m;
}

export function createCreature(ctx, { hue = 0.55, name = '', local = false, exclude = null, count = 640, seed = 1 } = {}) {
  const { scene, phys } = ctx; const R = phys.RAPIER; const world = phys.world;
  const group = new THREE.Group(); group.name = 'creature' + (name ? ':' + name : ''); group.userData.keep = true; scene.add(group);

  // ---------------------------------------------------------------- body mesh
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const nrmA = new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const idxA = new THREE.BufferAttribute(new Uint32Array(MAXI), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA); geo.setAttribute('normal', nrmA); geo.setIndex(idxA); geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 1.5); geo.boundingBox = new THREE.Box3(new THREE.Vector3(-0.9, -0.4, -0.9), new THREE.Vector3(0.9, 1.9, 0.9));
  const mat = waterMaterial(ctx, hue); ctx.kit?.outdoor?.(mat); mat.envMapIntensity = 1.6;
  const body = new THREE.Mesh(geo, mat); body.name = 'creature-body'; body.userData.keep = true; body.renderOrder = 4;
  group.add(body);

  // ---------------------------------------------------------------- eyes
  // transparent (opacity 1) keeps the eyes out of three's opaque transmission pre-pass, so the water
  // body does not refract a smeared copy of them
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, transparent: true, opacity: 1 });
  ctx.kit?.outdoor?.(eyeMat);
  const eyeGeo = new THREE.SphereGeometry(0.046, 24, 16);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat); e.scale.set(0.95, 1.18, 0.62); e.userData.side = s; e.renderOrder = 5;
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), glintMat); gl.position.set(0.016 * s + 0.01, 0.022, -0.04); e.add(gl);
    group.add(e); return e;
  });

  // ---------------------------------------------------------------- droplets
  const dropGeo = new THREE.IcosahedronGeometry(1, 2);
  const drops = new THREE.InstancedMesh(dropGeo, mat, MAXD); drops.count = 0; drops.frustumCulled = false; drops.userData.keep = true; drops.renderOrder = 4;
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(drops);

  // ---------------------------------------------------------------- contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.6, toneMapped: false }));
  shadow.renderOrder = 1; shadow.userData.keep = true; scene.add(shadow);

  // ---------------------------------------------------------------- name tag
  let tag = null;
  function setName(n) {
    name = n || '';
    if (local) return;
    if (!tag) { tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); tag.renderOrder = 20; tag.userData.keep = true; scene.add(tag); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 112; const g = c.getContext('2d');
    g.font = '600 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const tw = Math.min(470, g.measureText(name).width + 56); const x0 = (512 - tw) / 2;
    g.fillStyle = 'rgba(12,18,26,0.62)'; g.beginPath(); g.roundRect(x0, 16, tw, 80, 40); g.fill();
    const col = new THREE.Color().setHSL(mat.userData.hue, 0.8, 0.62);
    g.fillStyle = '#' + col.getHexString(); g.beginPath(); g.arc(x0 + 34, 56, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(name, x0 + 54, 58, tw - 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    tag.material.map?.dispose(); tag.material.map = t; tag.material.needsUpdate = true; tag.scale.set(0.9, 0.9 * 112 / 512, 1);
  }
  function setHue(h) {
    mat.userData.hue = h; mat.color.setHSL(h, 0.2, 0.98); mat.attenuationColor.setHSL(h, 0.45, 0.84);
    if (tag) setName(name);
  }
  setName(name);

  // ---------------------------------------------------------------- sim backend
  let worker = null, inline = null, pending = false, pendingSince = 0, accDt = 0, last = null, simMs = 0;
  const opts = { count, seed };
  function startInline() { if (!inline) inline = new CreatureSim(opts); if (worker) { try { worker.terminate(); } catch {} worker = null; } }
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const m = e.data; if (m.type === 'out') { pending = false; apply(m); simMs = m.ms; } else if (m.type === 'error') { console.warn('[fluid] worker error, falling back inline:', m.message); pending = false; startInline(); } };
    worker.onerror = (e) => { console.warn('[fluid] worker failed, inline fallback', e.message || ''); e.preventDefault?.(); pending = false; startInline(); };
    worker.postMessage({ type: 'init', opts });
  } catch (e) { startInline(); }

  // ---------------------------------------------------------------- collision probes (Rapier)
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FLAGS = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const G_STEP = 0.35; const ground = new Float32Array(25);
  const dirs = []; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; dirs.push([Math.cos(a), Math.sin(a)]); }
  let groundY = 0;
  function probe(a) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const x = a.x + (i - 2) * G_STEP, z = a.z + (j - 2) * G_STEP;
      ray.origin.x = x; ray.origin.y = a.y + 0.9; ray.origin.z = z; ray.dir.x = 0; ray.dir.y = -1; ray.dir.z = 0;
      const hit = world.castRay(ray, 6, true, FLAGS, undefined, exclude || undefined);
      let h = -1e9;
      if (hit) { h = ray.origin.y - hit.timeOfImpact; if (hit.timeOfImpact < 1e-4 || h > a.y + 0.45) h = a.y; }
      ground[j * 5 + i] = h;
    }
    groundY = ground[12] > -1e8 ? ground[12] : a.y;
    const walls = [];
    for (const hgt of [0.35, 1.0]) for (const [dx, dz] of dirs) {
      ray.origin.x = a.x; ray.origin.y = a.y + hgt; ray.origin.z = a.z; ray.dir.x = dx; ray.dir.y = 0; ray.dir.z = dz;
      const hit = world.castRayAndGetNormal(ray, 1.1, true, FLAGS, undefined, exclude || undefined);
      if (!hit || hit.timeOfImpact < 1e-4) continue;
      const px = a.x + dx * hit.timeOfImpact, py = ray.origin.y, pz = a.z + dz * hit.timeOfImpact; const n = hit.normal;
      if (Math.abs(n.y) > 0.6) continue; // floors/steps are handled by the heightfield
      walls.push(n.x, n.y, n.z, n.x * px + n.y * py + n.z * pz);
    }
    return new Float32Array(walls);
  }
  function waterAt(a) {
    for (const w of waterBodies) { try { if (w.isInside(a.x, a.z)) { const y = w.heightAt(a.x, a.z); if (a.y < y + 0.2) return { w, y }; } } catch {} }
    return null;
  }

  // ---------------------------------------------------------------- apply sim output
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const headLocal = new THREE.Vector3(0, 1.18, 0); let outYaw = 0, dis = 0;
  let curWater = null;
  function apply(o) {
    const nv = Math.min(o.nv, MAXV), ni = Math.min(o.ni, MAXI);
    if (o.nv <= MAXV && o.ni <= MAXI) {
      posA.array.set(o.pos.subarray(0, nv * 3)); nrmA.array.set(o.nrm.subarray(0, nv * 3)); idxA.array.set(o.idx.subarray(0, ni));
      posA.clearUpdateRanges(); posA.addUpdateRange(0, nv * 3); posA.needsUpdate = true;
      nrmA.clearUpdateRanges(); nrmA.addUpdateRange(0, nv * 3); nrmA.needsUpdate = true;
      idxA.clearUpdateRanges(); idxA.addUpdateRange(0, ni); idxA.needsUpdate = true;
      geo.setDrawRange(0, ni);
    }
    const nd = Math.min(o.nd, MAXD); const D = o.drops;
    for (let i = 0; i < nd; i++) {
      const r = D[i * 5 + 3], f = D[i * 5 + 4];
      _m.compose(_p.set(D[i * 5], D[i * 5 + 1], D[i * 5 + 2]), _q.identity(), _s.set(r, r * f, r)); drops.setMatrixAt(i, _m);
    }
    drops.count = nd; drops.instanceMatrix.needsUpdate = true;
    headLocal.set(o.head[0], o.head[1], o.head[2]); outYaw = o.yaw; dis = o.dis;
    if (curWater && o.events) for (let i = 0; i < o.events.length; i += 2) { try { curWater.w.disturb(o.events[i], o.events[i + 1], 0.12, 0.15); } catch {} }
  }

  // ---------------------------------------------------------------- per-frame update
  const anchor = new THREE.Vector3(); let visibleBody = true;
  function update(dt, s) {
    anchor.copy(s.pos); accDt += dt;
    if (worker && pending && performance.now() - pendingSince > 1500) { console.warn('[fluid] worker stalled, inline fallback'); pending = false; startInline(); }
    if (!pending) {
      const walls = probe(anchor); const wt = waterAt(anchor); curWater = wt;
      const msg = { type: 'step', dt: accDt, anchor: [anchor.x, anchor.y, anchor.z], vel: [s.vel.x, s.vel.y, s.vel.z], yaw: s.yaw, grounded: !!s.grounded, swimming: !!s.swimming,
        waterY: wt ? wt.y : -1e9, ground, gStep: G_STEP, gCenter: [anchor.x, anchor.z], walls };
      accDt = 0;
      if (worker) { pending = true; pendingSince = performance.now(); worker.postMessage(msg); }
      else if (inline) { const t0 = performance.now(); apply(inline.step(msg)); simMs = performance.now() - t0; }
    }
    // the mesh is anchor-relative: place it at the newest anchor so it never trails the controller
    body.position.copy(anchor);
    body.visible = visibleBody;
    // eyes on the head (orientation of the sim frame that produced the mesh)
    const c = Math.cos(outYaw), sn = Math.sin(outYaw);
    const eyeVis = visibleBody && !(curWater && anchor.y + headLocal.y + 0.06 < curWater.y);
    for (const e of eyes) {
      const lx = e.userData.side * 0.095, ly = 0.035, lz = -0.245;
      e.position.set(anchor.x + headLocal.x + lx * c + lz * sn, anchor.y + headLocal.y + ly, anchor.z + headLocal.z - lx * sn + lz * c);
      e.rotation.set(0, outYaw, 0); e.visible = eyeVis;
    }
    shadow.position.set(anchor.x, groundY + 0.006, anchor.z); const hgt = Math.max(0, anchor.y - groundY);
    const sc = 1.05 + hgt * 0.4; shadow.scale.set(sc, 1, sc); shadow.material.opacity = Math.max(0, 0.55 - hgt * 0.35) * (1 - dis); shadow.visible = visibleBody || true;
    if (tag) { tag.position.set(anchor.x, anchor.y + headLocal.y + 0.52, anchor.z); }
  }
  function setVisible(v) { visibleBody = v; }
  function dispose() {
    try { worker?.terminate(); } catch {}
    for (const o of [group, drops, shadow, tag]) if (o) scene.remove(o);
    geo.dispose(); mat.dispose(); eyeMat.dispose(); dropGeo.dispose(); tag?.material.map?.dispose();
  }
  return { group, body, drops, eyes, update, setVisible, setName, setHue, dispose, get simMs() { return simMs; }, get usingWorker() { return !!worker; }, get name() { return name; } };
}
