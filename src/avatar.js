// Default person avatar (the mannequin): rounded capsule body with a tinted shirt, built as ONE skinned mesh
// (rigid skinning, vertex colours, 1 draw call) on a 17-bone humanoid skeleton, animated by the shared clip
// library + locomotion state machine in src/avatars/anim.js (same as imported models). Name tag for remote players.
// Interface (shared with src/avatars/index.js createCustomAvatar):
//   { root, setVisible, update(dt, {pos, vel, yaw, grounded, swimming, pose, crouch, emote}), setName, setHue,
//     setPose('stand'|'sit'|'lie'|'lean'), pose, dispose }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNameTag } from './avatars/nametag.js';
import { POSES, bindRig, createAnimator, avatarLod, placeRoot } from './avatars/anim.js';
export { POSES };

const skinTones = [0xe8c1a0, 0xd9a47e, 0xb67a52, 0x8d5a3b, 0xf1d2b6];
// joint positions (root space, rest pose: standing, arms hanging, facing −z, left at −x)
const J = {
  hips: [0, 0.92, 0], spine: [0, 1.03, 0], chest: [0, 1.24, 0], neck: [0, 1.57, 0], head: [0, 1.66, 0],
  upperArmL: [-0.22, 1.5, 0], lowerArmL: [-0.22, 1.2, 0], handL: [-0.22, 0.94, 0],
  upperArmR: [0.22, 1.5, 0], lowerArmR: [0.22, 1.2, 0], handR: [0.22, 0.94, 0],
  upperLegL: [-0.095, 0.92, 0], lowerLegL: [-0.095, 0.49, 0], footL: [-0.095, 0.08, 0],
  upperLegR: [0.095, 0.92, 0], lowerLegR: [0.095, 0.49, 0], footR: [0.095, 0.08, 0],
};
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', upperArmL: 'chest', lowerArmL: 'upperArmL', handL: 'lowerArmL',
  upperArmR: 'chest', lowerArmR: 'upperArmR', handR: 'lowerArmR', upperLegL: 'hips', lowerLegL: 'upperLegL', footL: 'lowerLegL', upperLegR: 'hips', lowerLegR: 'upperLegR', footR: 'lowerLegR' };
const BONES = Object.keys(J);

export function createAvatar(ctx, { hue = 0.55, name = '', local = false, seed = 1 } = {}) {
  const { scene } = ctx;
  const root = new THREE.Group(); root.name = 'avatar'; root.userData.keep = true; scene.add(root);
  // local avatars start hidden: player.js shows them each frame (third-person only); until then (title menu) they'd stand at the origin
  root.visible = !local;
  const shirtC = new THREE.Color().setHSL(hue, 0.45, 0.5);
  const COL = { shirt: shirtC, pants: new THREE.Color(0x2b2f36), skin: new THREE.Color(skinTones[seed % skinTones.length]), shoe: new THREE.Color(0xf2f2f0), hair: new THREE.Color(0x2a1d14), sole: new THREE.Color(0x3a3a3a) };

  // ---- parts: geometry placed in root space, rigidly skinned to one bone
  const parts = []; let shirtRanges = [];
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 5, 12);
  const add = (geo, col, bone, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => {
    geo.deleteAttribute('uv');
    geo.scale(sx, sy, sz); if (rx) geo.rotateX(rx); geo.translate(x, y, z);
    const n = geo.attributes.position.count; const bi = BONES.indexOf(bone);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), cl = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; cl[i * 3] = COL[col].r; cl[i * 3 + 1] = COL[col].g; cl[i * 3 + 2] = COL[col].b; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    parts.push({ geo, col });
  };
  // torso: pelvis (pants), belly + chest (shirt), shoulders
  add(cap(0.155, 0.08), 'pants', 'hips', 0, 0.95, 0, 1.06, 1, 0.72);
  add(cap(0.15, 0.12), 'shirt', 'spine', 0, 1.1, 0, 1.04, 1, 0.68);
  add(cap(0.17, 0.2), 'shirt', 'chest', 0, 1.37, 0, 1.08, 1, 0.66);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.068, 14, 10), 'shirt', s < 0 ? 'upperArmL' : 'upperArmR', s * 0.215, 1.49, 0);
  add(new THREE.CylinderGeometry(0.05, 0.056, 0.13, 12), 'skin', 'neck', 0, 1.6, 0);
  // head: skull, hair cap, nose (facing cue), ears
  add(new THREE.SphereGeometry(0.115, 24, 16), 'skin', 'head', 0, 1.755, 0.005, 0.92, 1.08, 1);
  add(new THREE.SphereGeometry(0.122, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 'hair', 'head', 0, 1.775, 0.012, 0.93, 1.05, 1.0);
  add(new THREE.SphereGeometry(0.022, 10, 8), 'skin', 'head', 0, 1.745, -0.112, 0.8, 1.1, 1);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.025, 10, 8), 'skin', 'head', s * 0.104, 1.75, 0.01, 0.5, 1, 0.8);
  for (const [s, L] of [[-1, 'L'], [1, 'R']]) {
    const ax = s * 0.22, lx = s * 0.095;
    add(cap(0.056, 0.19), 'shirt', 'upperArm' + L, ax, 1.355, 0);
    add(cap(0.045, 0.19), 'skin', 'lowerArm' + L, ax, 1.075, 0);
    add(new THREE.SphereGeometry(0.05, 12, 10), 'skin', 'hand' + L, ax, 0.885, 0, 0.62, 1.35, 1.0);
    add(cap(0.079, 0.29), 'pants', 'upperLeg' + L, lx, 0.71, 0);
    add(cap(0.064, 0.3), 'pants', 'lowerLeg' + L, lx, 0.29, 0);
    add(new THREE.BoxGeometry(0.105, 0.065, 0.25, 1, 1, 1), 'shoe', 'foot' + L, lx, 0.045, -0.045);
    add(new THREE.BoxGeometry(0.11, 0.018, 0.255, 1, 1, 1), 'sole', 'foot' + L, lx, 0.009, -0.045);
  }
  // all parts as non-indexed so they merge regardless of index; then one geometry
  const geos = parts.map(p => p.geo.index ? p.geo.toNonIndexed() : p.geo);
  let off = 0; geos.forEach((g, i) => { const n = g.attributes.position.count; if (parts[i].col === 'shirt') shirtRanges.push([off, n]); off += n; });
  const geo = mergeGeometries(geos, false); parts.forEach(p => p.geo.dispose()); geos.forEach(g => g.dispose());
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'mannequin';
  const bones = {};
  for (const b of BONES) { const o = new THREE.Bone(); o.name = b; bones[b] = o; }
  for (const b of BONES) { const p = PARENT[b]; const o = bones[b]; if (p) { bones[p].add(o); o.position.set(J[b][0] - J[p][0], J[b][1] - J[p][1], J[b][2] - J[p][2]); } else { mesh.add(o); o.position.fromArray(J[b]); } }
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(BONES.map(b => bones[b])), mesh.matrixWorld);
  const rig = bindRig(root, bones);
  const anim = createAnimator(rig);

  let tag = null, visible = !local;
  function setName(n) {
    name = n || ''; if (local) return;
    if (!tag) { tag = makeNameTag(name); root.add(tag); } else tag.setText(name);
  }
  function setHue(h) {
    shirtC.setHSL(h, 0.45, 0.5); const c = geo.attributes.color;
    for (const [s, n] of shirtRanges) for (let i = s; i < s + n; i++) c.setXYZ(i, shirtC.r, shirtC.g, shirtC.b);
    c.needsUpdate = true;
  }
  setName(name);
  function setPose(p) { anim.setPose(p); }

  function update(dt, inp = {}) {
    if (inp.pose !== undefined) anim.setPose(inp.pose);
    root.visible = visible; if (!visible) return;
    const lod = local ? 0 : avatarLod(ctx.camera, inp.pos);
    const r = anim.update(dt, inp, lod);
    if (inp.pos) placeRoot(root, inp.pos, inp.yaw || 0, r);
    if (tag) tag.position.y = anim.hipsY + 1.13 - (anim.pose === 'lie' ? 0.75 : 0);
  }
  function setVisible(v) { visible = v; root.visible = v; }
  function dispose() { scene.remove(root); geo.dispose(); mat.dispose(); tag?.disposeTag(); }
  update(0, { pos: new THREE.Vector3() });
  return { root, setVisible, update, setName, setHue, setPose, get pose() { return anim.pose; }, emote: (n) => anim.emote(n), get animator() { return anim; }, dispose };
}
