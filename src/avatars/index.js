// Custom player avatars: import a rigged .glb / .vrm / .fbx, map its skeleton to humanoid slots and drive
// it procedurally with the same poses as the mannequin (src/avatar.js). Also: IndexedDB store for the
// files, and the "Avatar" modal (import, preview turntable, height, turn around, shirt colour, default).
//
//   parseAvatar(arrayBuffer, 'glb'|'vrm'|'fbx') -> Promise<asset {fmt, template, rig, height, stats, warnings}>
//   createCustomAvatar(ctx, asset, {name, local, hue, height, flip}) -> same interface as createAvatar()
//   store: putFile(bytes, meta) -> id, get(id) -> {bytes, meta} | null, has(id), mine(), setMine(desc|null)
//   openAvatarPanel({onChange(desc, asset|null)}) -> {close()}
//   descriptors: {k:'m', h:hue} | {k:'c', id, f:fmt, sz:bytes, ht:height, fl:flip}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createAvatar, POSES } from '../avatar.js';
import { bindRig, createAnimator, avatarLod, placeRoot } from './anim.js';
import { makeNameTag } from './nametag.js';
export { makeNameTag };

export const LIMITS = { maxBytes: 120e6, maxTris: 2500000, warnTris: 300000 };
const MAX_TEX = 2048;
const SLOTS = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'lowerArmL', 'handL', 'upperArmR', 'lowerArmR', 'handR',
  'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'];
const REQUIRED = ['hips', 'upperArmL', 'lowerArmL', 'upperArmR', 'lowerArmR', 'upperLegL', 'lowerLegL', 'upperLegR', 'lowerLegR'];

// ------------------------------------------------------------------ rig mapping by bone names
// Tokenise a bone name (camelCase, digits, separators), pull out the side, drop rig prefixes, look up the rest.
const PREFIX = new Set(['mixamorig', 'mixamo', 'def', 'org', 'mch', 'bip', 'biped', 'valvebiped', 'j', 'b', 'c', 'jnt', 'joint', 'bone', 'bn', 'cc', 'base', 'armature', 'rig', 'character', 'ik', 'fk', 'skel', 'sk', 'ue', 'pl']);
const ALIAS = {
  hips: ['hips', 'hip', 'pelvis'], // UE/UAL: pelvis, thigh, calf, upperarm, lowerarm; Bip01: Pelvis, Thigh, Calf, UpperArm, Forearm

  neck: ['neck', 'neck1'], head: ['head'],
  upperArm: ['arm', 'upperarm', 'uparm', 'shoulderarm'], lowerArm: ['forearm', 'lowerarm', 'elbow', 'lowarm'], hand: ['hand', 'wrist'],
  upperLeg: ['upleg', 'upperleg', 'thigh', 'femur'], lowerLeg: ['leg', 'lowerleg', 'calf', 'shin', 'knee', 'lowleg'], foot: ['foot', 'ankle'],
};
function classify(name) {
  const toks = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/).filter(Boolean).map(t => t.toLowerCase());
  if (toks.includes('ik') || toks.includes('ctrl') || toks.includes('target') || toks.includes('pole')) return null; // UE ik_foot_l, IK/control helpers
  let side = '';
  const rest = [];
  toks.forEach((t, i) => {
    if (t === 'left' || t === 'l') side = 'L';
    else if (t === 'right' || t === 'r') side = 'R';
    else if (PREFIX.has(t) && rest.length === 0) { /* rig prefix */ }
    else if (/^\d+$/.test(t) && rest.length === 0) { /* Bip01 */ }
    else rest.push(/^\d+$/.test(t) ? String(+t) : t);
  });
  const key = rest.join('');
  for (const [slot, names] of Object.entries(ALIAS)) {
    if (!names.includes(key)) continue;
    if (slot === 'hips' || slot === 'neck' || slot === 'head') return side ? null : slot;
    return side ? slot + side : null;
  }
  return null;
}
const isAncestor = (a, b) => { for (let o = b.parent; o; o = o.parent) if (o === a) return true; return false; };
const depth = (o) => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
const lca = (a, b) => { const s = new Set(); for (let o = a; o; o = o.parent) s.add(o); for (let o = b; o; o = o.parent) if (s.has(o)) return o; return null; };

// Returns {bones: {slot: name}, humanoid: bool, missing[]} using names in `scene` (unique-named lookups).
function mapRigByNames(scene, exact = null) {
  const bones = []; const inSkel = new Set();
  scene.traverse(o => { if (o.isSkinnedMesh) o.skeleton.bones.forEach(b => inSkel.add(b)); });
  scene.traverse(o => { if (o.isBone || inSkel.has(o)) bones.push(o); });
  const found = {};
  if (exact) { for (const [slot, n] of Object.entries(exact)) { const o = n && scene.getObjectByName(n); if (o) found[slot] = o; } }
  else {
    for (const b of bones) {
      const slot = classify(b.name); if (!slot) continue;
      if (!found[slot] || depth(b) < depth(found[slot])) found[slot] = b; // shallowest wins (skip twist/end copies)
    }
    // structural fallbacks
    if (!found.hips && found.upperLegL && found.upperLegR) found.hips = lca(found.upperLegL, found.upperLegR);
    if (!found.neck && found.head && found.head.parent && found.head.parent !== found.hips) found.neck = found.head.parent;
    const top = found.neck || found.head;
    if (found.hips && top && isAncestor(found.hips, top)) {
      const path = []; for (let o = top.parent; o && o !== found.hips; o = o.parent) path.unshift(o);
      if (path.length) { found.spine = path[0]; found.chest = path[path.length - 1]; }
    }
  }
  const missing = REQUIRED.filter(s => !found[s]);
  // chain checks
  const chain = [['hips', 'upperLegL'], ['hips', 'upperLegR'], ['upperLegL', 'lowerLegL'], ['upperLegR', 'lowerLegR'], ['lowerArmL', 'handL'], ['lowerArmR', 'handR'],
    ['upperArmL', 'lowerArmL'], ['upperArmR', 'lowerArmR'], ['lowerLegL', 'footL'], ['lowerLegR', 'footR'], ['hips', 'upperArmL'], ['hips', 'upperArmR']];
  const broken = [];
  for (const [a, b] of chain) if (found[a] && found[b] && !isAncestor(found[a], found[b])) {
    if (/^(hand|foot)/.test(b)) { delete found[b]; continue; } // optional ends: just drop
    broken.push(a + '→' + b);
  }
  const names = {}; for (const s of SLOTS) if (found[s]) names[s] = found[s].name;
  return { bones: names, humanoid: !missing.length && !broken.length && bones.length > 0, missing, broken, boneCount: bones.length };
}

// ------------------------------------------------------------------ parsing
function downscaleTextures(root, warnings) {
  const seen = new Set(); let n = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const k in m) {
      const t = m[k]; if (!t || !t.isTexture || seen.has(t)) continue; seen.add(t);
      const img = t.image; const w = img?.width, h = img?.height; if (!w || !h || Math.max(w, h) <= MAX_TEX) continue;
      const s = MAX_TEX / Math.max(w, h); const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
      try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); t.image = c; t.needsUpdate = true; n++; } catch { /* keep original */ }
    }
  });
  if (n) warnings.push(`${n} texture(s) larger than ${MAX_TEX} px were downscaled.`);
}
function countTris(root) {
  let tris = 0;
  root.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position?.count || 0) / 3; } });
  return Math.round(tris);
}
let vrmModP = null;
const loadVRMLib = () => (vrmModP ??= import('../../vendor/three-vrm.module.min.js'));

export async function parseAvatar(arrayBuffer, fmt) {
  fmt = String(fmt || '').toLowerCase().replace(/^\./, '');
  if (!['glb', 'vrm', 'fbx'].includes(fmt)) throw new Error(`Unsupported file type ".${fmt}". Use .glb, .vrm or .fbx.`);
  const bytes = arrayBuffer.byteLength;
  if (bytes > LIMITS.maxBytes) throw new Error(`File is ${(bytes / 1e6).toFixed(1)} MB; the limit is ${LIMITS.maxBytes / 1e6} MB.`);
  const warnings = []; let scene, exact = null, vrmMeta = null;
  try {
    if (fmt === 'fbx') {
      scene = new FBXLoader().parse(arrayBuffer, '');
    } else {
      const loader = new GLTFLoader(); let lib = null;
      if (fmt === 'vrm') {
        try { lib = await loadVRMLib(); loader.register(p => new lib.VRMLoaderPlugin(p)); }
        catch (e) { lib = null; warnings.push('VRM library failed to load; using plain glTF with bone-name mapping. (' + e.message + ')'); }
      }
      const gltf = await new Promise((res, rej) => loader.parse(arrayBuffer, '', res, rej));
      scene = gltf.scene;
      const vrm = gltf.userData?.vrm;
      if (vrm && lib) {
        if (vrm.meta?.metaVersion === '0') lib.VRMUtils.rotateVRM0(vrm);
        // Instances are SkeletonUtils clones (one parse, many players), so map the RAW humanoid bones by name.
        exact = {};
        const map = { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
          upperArmL: 'leftUpperArm', lowerArmL: 'leftLowerArm', handL: 'leftHand', upperArmR: 'rightUpperArm', lowerArmR: 'rightLowerArm', handR: 'rightHand',
          upperLegL: 'leftUpperLeg', lowerLegL: 'leftLowerLeg', footL: 'leftFoot', upperLegR: 'rightUpperLeg', lowerLegR: 'rightLowerLeg', footR: 'rightFoot' };
        for (const [slot, vb] of Object.entries(map)) { const n = vrm.humanoid.getRawBoneNode(vb); if (n?.name) exact[slot] = n.name; }
        // the normalized rig proxy nodes are only for vrm.update(); drop them from the template
        vrm.humanoid.normalizedHumanBonesRoot?.removeFromParent();
        // spring-bone collider nodes can't be cloned (their constructor needs a shape) and aren't simulated here
        const drop = []; scene.traverse(o => { if (o.colliderMatrix || o.springBone) drop.push(o); }); drop.forEach(o => o.removeFromParent());
        // node constraints (twist/roll bones) are re-created per clone by name
        const cons = [...(vrm.nodeConstraintManager?.constraints || [])].map(c => ({ ctor: c.constructor, dst: c.destination.name, src: c.source.name, weight: c.weight, rollAxis: c.rollAxis, aimAxis: c.aimAxis }));
        vrmMeta = { version: vrm.meta?.metaVersion, name: vrm.meta?.name || vrm.meta?.title || '', constraints: cons, Manager: lib.VRMNodeConstraintManager };
      } else if (fmt === 'vrm' && lib) warnings.push('No VRM metadata found; mapped bones by name.');
    }
  } catch (e) {
    const msg = String(e?.message || e);
    if (/draco|meshopt|KHR_|EXT_/i.test(msg)) throw new Error('This file uses a compressed glTF extension that is not supported here. Re-export without Draco/Meshopt compression.');
    throw new Error(`Could not read this ${fmt.toUpperCase()} file: ${msg}`);
  }
  if (!scene) throw new Error('The file contains no scene.');
  let meshes = 0; scene.traverse(o => { if (o.isMesh) meshes++; });
  if (!meshes) throw new Error('The file has no meshes (is it an animation-only file?).');
  const tris = countTris(scene);
  if (tris > LIMITS.maxTris) throw new Error(`Model has ${tris.toLocaleString()} triangles; the limit is ${LIMITS.maxTris.toLocaleString()}. Decimate it first.`);
  if (tris > LIMITS.warnTris) warnings.push(`Heavy model (${Math.round(tris / 1000)}K triangles): it works, but may lower FPS for everyone when several players use big models.`);
  downscaleTextures(scene, warnings);
  scene.updateMatrixWorld(true);
  const rig = mapRigByNames(scene, exact);
  if (exact && !rig.humanoid) { // VRM metadata incomplete: try by names
    const r2 = mapRigByNames(scene); if (r2.humanoid) Object.assign(rig, r2);
  }
  if (!rig.humanoid) warnings.push(`No humanoid rig found (${rig.boneCount ? 'missing ' + [...rig.missing, ...rig.broken].join(', ') : 'no skeleton'}); the model will move as a whole ("static mode").`);
  rig.source = exact ? 'vrm' : 'names';
  const box = new THREE.Box3().setFromObject(scene, true);
  return { fmt, template: scene, rig, height: box.max.y - box.min.y, stats: { tris, bones: rig.boneCount, bytes }, warnings, vrm: vrmMeta };
}

// ------------------------------------------------------------------ the avatar instance
const _v = new THREE.Vector3();

export function createCustomAvatar(ctx, asset, { name = '', local = false, hue = 0.55, height = 1.75, flip = false } = {}) {
  const { scene } = ctx;
  const root = new THREE.Group(); root.name = 'avatar'; root.userData.keep = true;
  const holder = new THREE.Group(); root.add(holder);
  const model = SkeletonUtils.clone(asset.template); holder.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; } });

  // ---- normalise: facing −z, requested height, feet at y=0, centred
  const bones = {}; const rigOK = asset.rig.humanoid;
  for (const [slot, n] of Object.entries(asset.rig.bones)) { const o = model.getObjectByName(n); if (o) bones[slot] = o; }
  const fit = () => {
    holder.position.set(0, 0, 0); holder.scale.setScalar(1);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true); const h = Math.max(1e-6, box.max.y - box.min.y);
    const s = height / h; holder.scale.setScalar(s);
    // feet at y=0; centred horizontally on the hips (or the box). World == root space here (root is identity).
    const c = bones.hips ? bones.hips.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
    holder.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    root.updateMatrixWorld(true);
  };
  let yawFix = Math.PI; // glTF / FBX / VRM(after rotateVRM0) face +z
  holder.rotation.y = yawFix; root.updateMatrixWorld(true);
  if (rigOK) { // left arm must end up at −x when facing −z; otherwise the file faces the other way
    const l = bones.upperArmL.getWorldPosition(new THREE.Vector3()), r = bones.upperArmR.getWorldPosition(new THREE.Vector3());
    if (l.x > r.x) yawFix = 0;
  }
  if (flip) yawFix += Math.PI;
  holder.rotation.y = yawFix;
  fit();

  // ---- retargeted clips + locomotion state machine (src/avatars/anim.js); bound while root is at identity
  const anim = rigOK ? createAnimator(bindRig(root, bones)) : null;
  const restHipsY = anim ? anim.rig.hipsY : height * 0.53;

  // VRM node constraints (e.g. twist bones that carry the arm skin): rebuild on this clone, run every frame
  let cons = null;
  if (asset.vrm?.constraints?.length) {
    cons = new asset.vrm.Manager();
    for (const c of asset.vrm.constraints) {
      const d = model.getObjectByName(c.dst), s = model.getObjectByName(c.src); if (!d || !s) continue;
      const k = new c.ctor(d, s); if (c.weight != null) k.weight = c.weight; if (c.rollAxis) k.rollAxis = c.rollAxis; if (c.aimAxis) k.aimAxis = c.aimAxis;
      cons.addConstraint(k);
    }
    cons.setInitState();
  }
  scene.add(root);

  const baseY = holder.position.y; let visible = true, phase = 0, staticPose = 'stand'; // set below: local starts hidden
  function setPose(p) { if (anim) anim.setPose(p); else staticPose = POSES[p] && p !== 'stand' ? p : 'stand'; }
  const curPose = () => (anim ? anim.pose : staticPose);

  function update(dt, inp = {}) {
    if (inp.pose !== undefined) setPose(inp.pose);
    root.visible = visible; if (!visible) return;
    const pos = inp.pos, yaw = inp.yaw || 0;
    if (anim) {
      const lod = local ? 0 : avatarLod(ctx.camera, pos);
      const r = anim.update(dt, inp, lod);
      if (pos) placeRoot(root, pos, yaw, r);
      if (cons && lod !== 2) { root.updateMatrixWorld(true); cons.update(); }
    } else { // static mode (no humanoid rig): bob + tilt the whole model
      const v = inp.vel, speed = v ? Math.hypot(v.x, v.z) : 0; phase += dt * (2.2 + speed * 2.1);
      holder.position.y = baseY + (staticPose === 'stand' && !inp.swimming ? Math.abs(Math.cos(phase)) * Math.min(0.75, speed * 0.22) * 0.08 : 0);
      holder.rotation.x = staticPose === 'stand' ? -Math.min(0.15, speed * 0.04) : 0;
      if (pos) root.position.copy(pos); root.rotation.set(0, yaw, 0);
    }
    if (tag) {
      const hy = anim ? anim.hipsY : restHipsY;
      tag.position.y = hy + (height - restHipsY) + 0.25 - (curPose() === 'lie' ? 0.8 : 0);
    }
  }

  let tag = null;
  function setName(n) { name = n || ''; if (local) return; if (!tag) { tag = makeNameTag(name); tag.position.y = height + 0.3; root.add(tag); } else tag.setText(name); }
  setName(name);
  function setVisible(v) { visible = v; root.visible = v; }
  function setHue() { /* custom models keep their own colours */ }
  function dispose() { scene.remove(root); tag?.disposeTag(); /* geometry/materials are shared with the template */ }
  update(0, { pos: new THREE.Vector3() }); // apply the rest pose once
  if (local) setVisible(false); // player.js decides (third-person only); never shown at the origin during the title menu
  return { root, setVisible, update, setName, setHue, setPose, get pose() { return curPose(); }, emote: (n) => anim?.emote(n), get animator() { return anim; }, dispose, rigged: rigOK };
}

// ------------------------------------------------------------------ storage
const DB = 'ph-avatars', OS = 'files', MINE = 'ph-avatar-mine';
let dbP = null;
const db = () => (dbP ??= new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(OS); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(OS, mode); const r = fn(t.objectStore(OS)); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
async function sha256hex(bytes) { const h = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export const store = {
  async putFile(bytes, meta = {}) { const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); const id = await sha256hex(buf); if (!(await this.has(id))) await tx('readwrite', s => s.put({ bytes: buf, meta, t: Date.now() }, id)); return id; },
  async get(id) { return (await tx('readonly', s => s.get(id))) || null; },
  async has(id) { return (await tx('readonly', s => s.count(id))) > 0; },
  mine() { try { return JSON.parse(localStorage.getItem(MINE)) || null; } catch { return null; } },
  setMine(desc) { if (desc) localStorage.setItem(MINE, JSON.stringify(desc)); else localStorage.removeItem(MINE); },
};

// ------------------------------------------------------------------ panel
// Style: docs/UI_STYLE.md (dark minimal, hairlines, 6px radius, mono KEY::VALUE chips, sparse yellow accent)
const GRAIN = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); const d = g.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c.toDataURL(); } catch { return ''; } })();
const CSS = `
.av-back{--ease-out-expo:cubic-bezier(.16,1,.3,1);--ease-soft:cubic-bezier(.5,1,.89,1);position:fixed;inset:0;z-index:1000;background:rgba(10,10,10,.55);display:flex;align-items:center;justify-content:center;
  font:400 14px/1.4 Geist,-apple-system,Inter,"Segoe UI",sans-serif;letter-spacing:-.02em;color:#f7f7f7;animation:av-fade .3s var(--ease-soft) both}
.av-back.av-closing{animation:av-fade .25s var(--ease-soft) reverse forwards;pointer-events:none}
.av-card{position:relative;background:#1e1e1e;border:1px solid rgba(247,247,247,.06);border-radius:6px;padding:14px;display:flex;flex-direction:column;gap:10px;
  box-shadow:0 2px 6px -2px rgba(0,0,0,.2),0 24px 60px -12px rgba(0,0,0,.5);width:340px;max-height:calc(100vh - 24px);overflow:hidden auto;scrollbar-width:none;box-sizing:border-box;animation:av-rise .5s var(--ease-out-expo) both}
.av-closing .av-card{animation:av-sink .25s var(--ease-soft) forwards}
.av-card::after{content:"";position:absolute;inset:0;pointer-events:none;background:url(${GRAIN});opacity:.06;mix-blend-mode:overlay}
.av-head{display:flex;justify-content:space-between;align-items:flex-start}
.av-title{font-size:22px;font-weight:500;letter-spacing:-.05em;line-height:1.05}
.av-sub,.av-chip,.av-row label,.av-row span{font:600 10.5px/1 "Geist Mono",ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:-.4px;text-transform:uppercase}
.av-sub{color:rgba(247,247,247,.32);margin-top:5px}.av-sub b{color:#f2c84b;font-weight:600}
.av-card canvas{flex:none;width:312px;height:312px;border-radius:6px;background:#191919;border:1px solid rgba(247,247,247,.06)}
.av-drop{box-shadow:0 0 0 1px #f2c84b}
.av-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.av-row label{min-width:56px;color:rgba(247,247,247,.32)}.av-row span{color:rgba(247,247,247,.66);min-width:44px;text-align:right}
.av-row input[type=range]{flex:1;accent-color:#f2c84b;height:2px}
.av-card button{background:#262626;color:#f7f7f7;border:1px solid rgba(247,247,247,.06);border-radius:6px;padding:4px 10px;font:inherit;font-size:14px;letter-spacing:-.02em;cursor:pointer;transition:background .25s var(--ease-soft),transform .2s var(--ease-soft)}
.av-card button:active{transform:scale(.97)}
.av-seg{position:relative;display:inline-grid;grid-template-columns:1fr 1fr;background:#262626;border:1px solid rgba(247,247,247,.06);border-radius:6px;padding:2px}
.av-seg::before{content:"";position:absolute;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:4px;background:rgba(247,247,247,.08);box-shadow:0 0 0 1px rgba(247,247,247,.04);transition:transform .4s var(--ease-out-expo),opacity .25s var(--ease-soft)}
.av-seg[data-on=c]::before{transform:translateX(100%)}
.av-card .av-seg button{position:relative;background:none;border:0;border-radius:4px;color:rgba(247,247,247,.66);transition:color .25s var(--ease-soft),transform .2s var(--ease-soft)}
.av-card .av-seg button:hover{background:none;color:#f7f7f7}
.av-seg[data-on=m] [data-a=def],.av-seg[data-on=c] [data-a=cus]{color:#f7f7f7}
.av-card button:hover{background:#303030}
.av-card button.pri{box-shadow:inset 0 -1px 0 #f2c84b}
.av-card button.x{width:30px;height:30px;padding:0;display:grid;place-items:center}
.av-chips{display:flex;gap:4px;flex-wrap:wrap;min-height:18px}
.av-chip{background:#2f2f2f;border-radius:2px;padding:4px 6px;color:rgba(247,247,247,.66);display:inline-flex}
.av-roll .ch{display:inline-block;overflow:hidden;line-height:1;vertical-align:top}
.av-roll .ch>b{display:inline-block;font-weight:inherit;white-space:pre;animation:av-slot .5s var(--ease-out-expo) both;animation-delay:calc(var(--i) * 25ms)}.av-chip i{font-style:normal;color:rgba(247,247,247,.32)}
.av-help{font-size:12px;color:rgba(247,247,247,.32);letter-spacing:-.01em}
.av-msg{font-size:12px;white-space:pre-wrap;display:flex;flex-direction:column;gap:3px}.av-msg:empty{display:none}
.av-err{color:#ff8a7a}.av-warn{color:rgba(242,200,75,.85)}.av-info{color:rgba(247,247,247,.66)}
.av-body{display:flex;flex-direction:column;gap:10px;min-height:0}
.av-left,.av-right{display:flex;flex-direction:column;gap:10px;min-height:0;min-width:0}
.av-card>*,.av-left>*,.av-right>*{flex-shrink:0}
.av-libh{position:sticky;top:-14px;z-index:2;display:flex;flex-direction:column;gap:8px;margin:0 -3px;padding:2px 3px 4px;background:#1e1e1e}
.av-libh .av-row{justify-content:space-between}
.av-row .av-chip,.av-row .av-chip span{min-width:0;text-align:left}
.av-lib{flex:none;display:grid;grid-template-columns:repeat(5,1fr);grid-auto-rows:74px;gap:5px;max-height:172px;overflow-y:auto;padding:3px;margin:-3px;scrollbar-width:thin;scrollbar-color:#3a3a3a transparent}
@media (min-width:900px){
  .av-card{width:min(800px,calc(100vw - 24px));overflow:hidden}
  .av-body{flex-direction:row;gap:16px;flex:1 1 auto}
  .av-left{flex:none;width:312px;overflow:hidden auto;scrollbar-width:none}
  .av-right{flex:1 1 0}
  .av-libh{position:static}
  .av-lib{flex:1 1 0;min-height:400px;max-height:none;grid-auto-rows:96px;align-content:start}}
.av-card .av-tile{position:relative;padding:0;overflow:hidden;background:#262626;border-radius:6px;
  transition:transform .3s var(--ease-out-expo),background .25s var(--ease-soft),box-shadow .25s var(--ease-soft)}
.av-card .av-tile:hover{transform:translateY(-2px);background:#2c2c2c}
.av-card .av-tile:active{transform:scale(.97);transition:transform .2s var(--ease-soft)}
.av-tile img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s var(--ease-soft)}.av-tile img.ok{opacity:1}
.av-tile i{position:absolute;left:0;right:0;bottom:0;padding:12px 4px 3px;background:linear-gradient(transparent,rgba(20,20,20,.9));font:600 8.5px/1 "Geist Mono",ui-monospace,"SF Mono",Menlo,monospace;
  letter-spacing:-.4px;text-transform:uppercase;font-style:normal;color:rgba(247,247,247,.66);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.av-tile[data-on]{box-shadow:0 0 0 1px #f2c84b}.av-tile[data-on] i{color:#f2c84b}
.av-tile[data-pv]{box-shadow:0 0 0 1px rgba(247,247,247,.55)}.av-tile[data-pv] i{color:#f7f7f7}
.av-pend{display:none}.av-pend.on{display:flex;animation:av-rise .3s var(--ease-out-expo) both}
@keyframes av-fade{from{opacity:0}}
@keyframes av-rise{from{opacity:0;transform:translateY(6%) scale(.96)}}
@keyframes av-sink{to{opacity:0;transform:translateY(4%) scale(.97)}}
@keyframes av-slot{from{transform:translateY(110%)}}
@media (prefers-reduced-motion:reduce){.av-card,.av-closing .av-card{animation:av-fade .2s linear both}.av-closing .av-card{animation-direction:reverse}
  .av-roll .ch>b{animation:none}.av-card button,.av-seg::before{transition:none}.av-card button:active{transform:none}
  .av-card .av-tile,.av-card .av-tile:active{transition:none}.av-card .av-tile:hover,.av-card .av-tile:active{transform:none}.av-pend.on{animation:none}}`;
let cssDone = false;
const FMT = (n) => { const m = /\.(glb|vrm|fbx)$/i.exec(n || ''); return m ? m[1].toLowerCase() : null; };

export function openAvatarPanel({ onChange } = {}) {
  const libP = import('./library.js'); // built-in characters (dynamic: no static import cycle with library.js)
  if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
  const back = document.createElement('div'); back.className = 'av-back';
  back.innerHTML = `<div class="av-card"><div class="av-head"><div><div class="av-title">Your avatar</div><div class="av-sub">No01 / <b>AVATAR</b> · PREVIEW</div></div>
    <button class="x" data-a="x" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></div>
    <div class="av-body"><div class="av-left">
    <canvas width="624" height="624"></canvas><div class="av-chips"></div>
    <div class="av-row"><button data-a="turn">Turn around</button></div>
    <div class="av-row" data-r="ht"><label>Height</label><input type="range" min="1.4" max="2.2" step="0.01"><span></span></div>
    <div class="av-row" data-r="hue"><label>Shirt</label><input type="range" min="0" max="1" step="0.01"></div>
    <div class="av-msg"></div></div>
    <div class="av-right"><div class="av-libh"><div class="av-row"><span class="av-chip"><i>CHARACTERS::</i><span class="av-libn"></span></span></div>
    <div class="av-row"><div class="av-seg" data-on="m" role="tablist"><button data-a="def" role="tab">Default</button><button data-a="cus" role="tab">Custom</button></div>
    <button class="pri" data-a="imp">Import model…</button></div></div>
    <div class="av-lib" role="listbox" aria-label="Characters"></div>
    <div class="av-row av-pend"><button class="pri" data-a="use">Use character</button><button data-a="cancel">Cancel</button></div>
    <div class="av-help">Or import your own: works best with a humanoid rig, e.g. VRoid Studio (.vrm) or Mixamo (.fbx with skin). Drop a .glb, .vrm or .fbx here.</div>
    </div></div><input type="file" accept=".glb,.vrm,.fbx" hidden></div>`;
  document.body.appendChild(back);
  const $ = (s) => back.querySelector(s); const card = $('.av-card'); const canvas = $('canvas'); const msg = $('.av-msg'); const chipsEl = $('.av-chips'); const file = $('input[type=file]');
  const htIn = $('[data-r=ht] input'), htOut = $('[data-r=ht] span'), hueIn = $('[data-r=hue] input');
  // roll=true: each character slides up through a clipped line, 25 ms stagger (CSS animation; JS only splits the text)
  const chips = (list, roll = false) => {
    chipsEl.innerHTML = ''; chipsEl.classList.toggle('av-roll', roll); let n = 0;
    const put = (parent, text) => { if (!roll) return parent.append(text); for (const ch of text) { const w = document.createElement('span'); w.className = 'ch'; const b = document.createElement('b'); b.textContent = ch; b.style.setProperty('--i', n++); w.appendChild(b); parent.appendChild(w); } };
    for (const [k, v] of list) { const c = document.createElement('span'); c.className = 'av-chip'; const i = document.createElement('i'); put(i, k + '::'); c.appendChild(i); put(c, String(v)); chipsEl.appendChild(c); }
  };
  const say = (lines) => { msg.innerHTML = ''; for (const [cls, t] of lines) { const d = document.createElement('div'); d.className = 'av-' + cls; d.textContent = t; msg.appendChild(d); } };

  // preview
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setClearColor(0x191919, 1); renderer.setPixelRatio(1); renderer.setSize(624, 624, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50); cam.position.set(0, 1.25, -4.4); cam.lookAt(0, 0.9, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(-2, 4, -3); sc.add(dl);
  // soft contact shadow: radial-gradient canvas on a floor disc (no shadow maps in the preview)
  const sh = document.createElement('canvas'); sh.width = sh.height = 128; { const g = sh.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.45, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const shTex = new THREE.CanvasTexture(sh);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; sc.add(floor);
  const turn = new THREE.Group(); sc.add(turn);
  const pctx = { scene: turn };
  let lastC = null, av = null, asset = null, desc = store.mine() || { k: 'm', h: 0.55 }, t0 = performance.now(), last = t0, raf = 0, closed = false;
  const isModel = (d) => d.k === 'c' || d.k === 'b';
  // library preview: a click previews in the turntable; "Use" commits. pending = {desc, asset} to return to on Cancel.
  let pending = null, lib = null, pick = 0;
  const libEl = $('.av-lib'), pendEl = $('.av-pend');
  const markTiles = () => { for (const t of libEl.children) {
    const id = t.dataset.id, cur = pending ? pending.desc : desc, on = cur.k === 'b' && cur.id === id;
    t.toggleAttribute('data-on', on); t.toggleAttribute('data-pv', !!pending && desc.k === 'b' && desc.id === id); t.setAttribute('aria-selected', String(on)); } };
  const setPending = (p) => { pending = p; pendEl.classList.toggle('on', !!p); if (p && lib) $('[data-a=use]').textContent = 'Use ' + (lib.libraryEntry(desc.id)?.name || 'character'); };
  libP.then((m) => { if (closed) return; lib = m; $('.av-libn').textContent = String(m.LIBRARY.length);
    for (const ent of m.LIBRARY) { const b = document.createElement('button'); b.className = 'av-tile'; b.dataset.a = 'lib'; b.dataset.id = ent.id; b.title = ent.name; b.setAttribute('role', 'option');
      const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.onload = () => img.classList.add('ok'); img.src = m.libraryUrl(ent.thumb);
      const i = document.createElement('i'); i.textContent = ent.name; b.append(img, i); libEl.appendChild(b); }
    markTiles(); }).catch(e => say([['err', 'Character library failed to load: ' + e.message]]));
  async function previewLib(id) {
    if (!lib) return; const ent = lib.libraryEntry(id); if (!ent) return; const my = ++pick;
    say([['info', `Loading ${ent.name}…`]]);
    try {
      const a = await lib.loadLibraryAsset(id); if (closed || my !== pick) return;
      const prev = pending || { desc: { ...desc }, asset };
      asset = a; desc = { k: 'b', id, ht: ent.height, fl: false }; setPending(prev); build();
      say([...describe(a, true).map(w => /^No humanoid rig/.test(w[1]) ? ['info', 'No humanoid rig: moves as a whole.'] : w), ['info', ent.credit]]);
    } catch (e) { if (my === pick) say([['err', e.message || String(e)]]); }
  }
  const build = () => {
    av?.dispose(); av = null;
    if (isModel(desc) && asset) av = createCustomAvatar(pctx, asset, { height: desc.ht || 1.75, flip: !!desc.fl, local: true });
    else av = createAvatar(pctx, { hue: desc.h ?? 0.55, local: true });
    av.setVisible(true); // local avatars start hidden; the preview shows its own
    const ht = isModel(desc) ? desc.ht || 1.75 : 1.87, span = asset && isModel(desc) && !asset.rig.humanoid ? ht * 2 : ht; // static models (fox) are long, not tall
    cam.position.set(0, ht * 0.62 + (span - ht) * 0.25, -span * 2.4); cam.lookAt(0, ht * 0.5, 0);
    htIn.value = desc.ht || 1.75; htOut.textContent = (+htIn.value).toFixed(2) + ' m'; hueIn.value = desc.h ?? 0.55;
    if (!isModel(desc)) chips([['RIG', 'MANNEQUIN'], ['SHIRT', Math.round((desc.h ?? 0.55) * 360) + '°']]); else if (asset) describe(asset);
    $('.av-seg').dataset.on = isModel(desc) ? 'c' : 'm';
    $('[data-r=ht]').style.display = isModel(desc) && (desc.ht || 1.75) >= 1.4 ? '' : 'none'; $('[data-r=hue]').style.display = isModel(desc) ? 'none' : ''; $('[data-a=turn]').style.display = isModel(desc) ? '' : 'none';
    markTiles();
  };
  const commit = () => { store.setMine(desc); onChange?.(desc, isModel(desc) ? asset : null); };
  const commitIf = () => { if (!pending) commit(); }; // tweaks to a previewed character wait for Use
  const kfmt = (n) => n >= 1000 ? Math.round(n / 1000) + 'K' : String(n);
  const describe = (a, roll = false) => { const m = Object.keys(a.rig.bones).length;
    const ent = desc.k === 'b' && lib ? lib.libraryEntry(desc.id) : null;
    chips([...(ent ? [['CHAR', ent.name]] : []), ['RIG', a.rig.humanoid ? `HUMANOID ${m}/17` : 'STATIC'], ['TRIS', kfmt(a.stats.tris)], ...(ent ? [] : [['FILE', a.fmt.toUpperCase()]]), ['SIZE', (a.stats.bytes / 1e6).toFixed(1) + 'MB']], roll);
    return a.warnings.map(w => ['warn', w]); };
  const loop = () => {
    if (closed) return; raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
    const ph = Math.floor(t / 2.5) % 3; // idle -> walk -> sit
    turn.rotation.y = t * 0.5;
    av?.update(dt, { pos: _v.set(0, 0, 0), vel: { x: 0, z: ph === 1 ? 1.5 : 0 }, yaw: 0, grounded: true, swimming: false, pose: ph === 2 ? 'sit' : 'stand' });
    renderer.render(sc, cam);
  };
  async function loadBytes(buf, fmt, isNew, metaName) {
    say([['info', 'Loading…']]);
    try {
      const a = await parseAvatar(buf, fmt);
      let id = desc.id;
      if (isNew) id = await store.putFile(buf, { name: metaName, fmt });
      if (isNew) { pick++; setPending(null); }
      asset = a; desc = { k: 'c', id, f: fmt, sz: buf.byteLength, ht: isNew ? 1.75 : desc.ht || 1.75, fl: isNew ? false : !!desc.fl };
      lastC = { desc: { ...desc }, asset: a }; build(); say(describe(a, true)); if (isNew) commit();
    } catch (e) { say([['err', e.message || String(e)]]); if (!isNew) { desc = { k: 'm', h: 0.55 }; build(); } }
  }
  async function importFile(f) {
    const fmt = FMT(f?.name); if (!fmt) return say([['err', 'Please choose a .glb, .vrm or .fbx file.']]);
    if (f.size > LIMITS.maxBytes) return say([['err', `File is ${(f.size / 1e6).toFixed(1)} MB; the limit is ${LIMITS.maxBytes / 1e6} MB.`]]);
    await loadBytes(await f.arrayBuffer(), fmt, true, f.name);
  }
  back.addEventListener('click', (e) => {
    if (e.target === back) return close();
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'x') close();
    else if (a === 'imp') file.click();
    else if (a === 'lib') previewLib(e.target.closest('[data-id]').dataset.id);
    else if (a === 'use' && pending) { setPending(null); lastC = { desc: { ...desc }, asset }; commit(); build(); say(describe(asset)); }
    else if (a === 'cancel' && pending) { pick++; desc = pending.desc; asset = pending.asset; setPending(null); build(); say([]); }
    else if (a === 'turn' && isModel(desc)) { desc.fl = !desc.fl; build(); commitIf(); }
    else if (a === 'def') { pick++; if (pending) { desc = pending.desc; asset = pending.asset; setPending(null); } if (isModel(desc)) lastC = { desc: { ...desc }, asset }; desc = { k: 'm', h: desc.h ?? 0.55 }; asset = null; build(); say([]); commit(); }
    else if (a === 'cus' && !isModel(desc)) { if (lastC?.asset) { desc = { ...lastC.desc, h: desc.h }; asset = lastC.asset; build(); describe(asset, true); commit(); } else file.click(); }
  });
  file.onchange = () => { if (file.files[0]) importFile(file.files[0]); file.value = ''; };
  htIn.oninput = () => { htOut.textContent = (+htIn.value).toFixed(2) + ' m'; };
  htIn.onchange = () => { desc.ht = +htIn.value; build(); commitIf(); };
  hueIn.oninput = () => { desc.h = +hueIn.value; av?.setHue(desc.h); chips([['RIG', 'MANNEQUIN'], ['SHIRT', Math.round(desc.h * 360) + '°']]); };
  hueIn.onchange = () => commit();
  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('av-drop'); });
  card.addEventListener('dragleave', () => card.classList.remove('av-drop'));
  card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('av-drop'); importFile(e.dataTransfer.files[0]); });
  const onKey = (e) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', onKey);
  function close() {
    if (closed) return; closed = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey);
    av?.dispose(); floor.geometry.dispose(); floor.material.dispose(); shTex.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
    // sink out (CSS), then remove; fallback timer in case animationend never fires (reduced motion / hidden tab)
    back.classList.add('av-closing'); const rm = () => back.remove(); card.addEventListener('animationend', (e) => { if (e.target === card && e.animationName === 'av-sink') rm(); }); setTimeout(rm, 400);
  }
  build(); loop();
  if (desc.k === 'c' && desc.id) store.get(desc.id).then(r => r ? loadBytes(r.bytes, desc.f, false) : say([['warn', 'Saved model not found; using the default.']]));
  else if (desc.k === 'b') libP.then(m => m.loadLibraryAsset(desc.id)).then(a => { if (closed || desc.k !== 'b') return; asset = a; lastC = { desc: { ...desc }, asset: a }; build(); say(describe(a, true)); })
    .catch(e => { if (closed) return; say([['warn', 'Saved character failed to load; using the default. ' + (e.message || '')]]); desc = { k: 'm', h: 0.55 }; build(); });
  return { close };
}
