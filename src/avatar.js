// Simple person avatar for players (replaces the water creature): rounded mannequin with a tinted
// shirt, walk cycle (legs/arms swing with speed), treading-water pose in the pool, name tag for
// remote players. Same interface the creature had: { setVisible, update, setName, setHue, dispose }.
import * as THREE from 'three';

const skinTones = [0xe8c1a0, 0xd9a47e, 0xb67a52, 0x8d5a3b, 0xf1d2b6];
export function createAvatar(ctx, { hue = 0.55, name = '', local = false, seed = 1 } = {}) {
  const { scene } = ctx;
  const root = new THREE.Group(); root.name = 'avatar'; root.userData.keep = true; scene.add(root);
  const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.45, 0.5), roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skinTones[seed % skinTones.length], roughness: 0.7 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.8 });
  const part = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12);

  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  part(cap(0.17, 0.42), shirt, hips, 0, 0.36, 0).scale.set(1.05, 1, 0.68);           // torso
  part(cap(0.16, 0.06), pants, hips, 0, 0.02, 0).scale.set(1.05, 1, 0.7);             // pelvis
  const neck = part(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), skin, hips, 0, 0.68, 0);
  const head = part(new THREE.SphereGeometry(0.115, 24, 16), skin, hips, 0, 0.83, 0.005); head.scale.set(0.92, 1.08, 1);
  part(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, 0, 0.02, -0.01);
  const limb = (side, isArm) => {
    const pivot = new THREE.Group(); pivot.position.set(side * (isArm ? 0.23 : 0.095), isArm ? 0.58 : 0.0, 0); hips.add(pivot);
    const upper = part(cap(isArm ? 0.055 : 0.075, isArm ? 0.24 : 0.34), isArm ? shirt : pants, pivot, 0, isArm ? -0.15 : -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = isArm ? -0.3 : -0.44; pivot.add(knee);
    part(cap(isArm ? 0.045 : 0.065, isArm ? 0.22 : 0.34), isArm ? skin : pants, knee, 0, isArm ? -0.14 : -0.22, 0);
    if (!isArm) part(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoe, knee, 0, -0.45, -0.04);
    return { pivot, knee };
  };
  const L = { armL: limb(-1, true), armR: limb(1, true), legL: limb(-1, false), legR: limb(1, false) };

  let tag = null, visible = true, phase = 0;
  function setName(n) {
    name = n || ''; if (local) return;
    if (!tag) { tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); tag.renderOrder = 20; root.add(tag); tag.position.y = 2.05; }
    const c = document.createElement('canvas'); c.width = 512; c.height = 112; const g = c.getContext('2d');
    g.font = '600 52px -apple-system, Segoe UI, sans-serif'; const w = Math.min(500, g.measureText(name).width + 48);
    g.fillStyle = 'rgba(20,22,26,0.62)'; g.beginPath(); g.roundRect((512 - w) / 2, 16, w, 80, 40); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 57);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    tag.material.map?.dispose(); tag.material.map = t; tag.material.needsUpdate = true; tag.scale.set(0.9, 0.9 * 112 / 512, 1);
  }
  function setHue(h) { shirt.color.setHSL(h, 0.45, 0.5); }
  setName(name);

  function update(dt, { pos, vel, yaw = 0, grounded = true, swimming = false }) {
    root.visible = visible; if (!visible) return;
    root.position.copy(pos); root.rotation.y = yaw; // model faces -z, same as yaw 0
    const speed = vel ? Math.hypot(vel.x, vel.z) : 0;
    const amp = swimming ? 0.5 : Math.min(0.75, speed * 0.22);
    phase += dt * (swimming ? 3.2 : 2.2 + speed * 2.1);
    const s = Math.sin(phase);
    if (swimming) { // treading water: arms sweep, legs kick, body upright and lower
      L.armL.pivot.rotation.set(0, 0, -0.9 + s * 0.4); L.armR.pivot.rotation.set(0, 0, 0.9 - s * 0.4);
      L.legL.pivot.rotation.x = s * 0.5; L.legR.pivot.rotation.x = -s * 0.5; L.legL.knee.rotation.x = 0.4; L.legR.knee.rotation.x = 0.4;
    } else {
      L.legL.pivot.rotation.x = s * amp; L.legR.pivot.rotation.x = -s * amp;
      L.legL.knee.rotation.x = Math.max(0, -s) * amp * 1.2; L.legR.knee.rotation.x = Math.max(0, s) * amp * 1.2;
      L.armL.pivot.rotation.set(-s * amp * 0.8, 0, -0.08); L.armR.pivot.rotation.set(s * amp * 0.8, 0, 0.08);
      L.armL.knee.rotation.x = -0.25 - amp * 0.3; L.armR.knee.rotation.x = -0.25 - amp * 0.3;
      if (!grounded) { L.legL.pivot.rotation.x = -0.5; L.legR.pivot.rotation.x = 0.2; L.legL.knee.rotation.x = 0.6; }
    }
    hips.position.y = 0.92 + (swimming ? 0 : Math.abs(Math.cos(phase)) * amp * 0.04);
  }
  function setVisible(v) { visible = v; root.visible = v; }
  function dispose() { scene.remove(root); root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); [shirt, pants, skin, shoe, hair].forEach(m => m.dispose()); tag?.material.map?.dispose(); }
  return { root, setVisible, update, setName, setHue, dispose };
}
