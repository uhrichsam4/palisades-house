// Portable Bluetooth speaker (JBL-Charge-like): a rounded cylinder lying on its side, woven fabric grille,
// rubber end caps with passive radiators, a glowing ring at each end, a rubber foot and top buttons.
// ~0.30 m long, 0.18 m tall. No lights: the ring is emissive. Returns { group, ring, cone }.
import * as THREE from 'three';

function grilleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#23262b'; g.fillRect(0, 0, 256, 128);
  // woven mesh: alternating light/dark threads
  for (let y = 0; y < 128; y += 2) for (let x = 0; x < 256; x += 2) {
    const k = ((x >> 1) + (y >> 1)) & 1; g.fillStyle = k ? '#3a3f47' : '#1b1d21'; g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 0.08; for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * 256, Math.random() * 128, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); t.anisotropy = 4;
  return t;
}

export function buildSpeakerModel() {
  const group = new THREE.Group(); group.name = 'speaker';
  const L = 0.30, Rr = 0.085;
  const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grilleTexture(), roughness: 0.95, metalness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0 });
  const radiator = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.35, metalness: 0.2 });
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 });
  const ringM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(0x29b6ff), emissiveIntensity: 0.6, roughness: 0.4 });
  const logoM = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.5 });

  // body: lathe of a slightly barrel-shaped cylinder, axis along x
  const inner = new THREE.Group(); group.add(inner); // pulse-scaled child (the root's transform is physics-owned)
  const prof = [];
  for (let i = 0; i <= 16; i++) { const v = i / 16; const y = (v - 0.5) * (L - 0.04); const r = Rr * (1 + 0.035 * Math.cos((v - 0.5) * Math.PI)); prof.push(new THREE.Vector2(r, y)); }
  const bodyGeo = new THREE.LatheGeometry(prof, 48); bodyGeo.rotateZ(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, fabric); body.castShadow = true; body.receiveShadow = true; inner.add(body);

  // end caps: rounded rubber bumpers (lathe), passive radiator disc with chrome trim, glowing ring
  const capProf = [[0, 0], [Rr * 0.92, 0], [Rr * 1.04, 0.004], [Rr * 1.07, 0.012], [Rr * 1.05, 0.02], [Rr * 0.98, 0.026], [Rr * 0.9, 0.028], [0, 0.028]].map(([r, y]) => new THREE.Vector2(r, y));
  const capGeo = new THREE.LatheGeometry(capProf, 48);
  const ringGeo = new THREE.TorusGeometry(Rr * 0.86, 0.0045, 8, 48);
  const radGeo = new THREE.CylinderGeometry(Rr * 0.7, Rr * 0.72, 0.006, 40);
  const trimGeo = new THREE.TorusGeometry(Rr * 0.72, 0.003, 6, 40);
  const rings = [];
  for (const s of [1, -1]) {
    const cap = new THREE.Mesh(capGeo, rubber); cap.rotation.z = -s * Math.PI / 2; cap.position.x = s * (L / 2 - 0.022); cap.castShadow = true; inner.add(cap);
    const ring = new THREE.Mesh(ringGeo, ringM); ring.rotation.y = Math.PI / 2; ring.position.x = s * (L / 2 + 0.007); inner.add(ring); rings.push(ring);
    const rad = new THREE.Mesh(radGeo, radiator); rad.rotation.z = Math.PI / 2; rad.position.x = s * (L / 2 + 0.006); inner.add(rad);
    const trim = new THREE.Mesh(trimGeo, chromeM); trim.rotation.y = Math.PI / 2; trim.position.x = s * (L / 2 + 0.009); inner.add(trim);
    rad.userData.cone = true;
  }
  // rubber foot along the bottom
  const foot = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 0.02, 0.05), rubber); foot.position.y = -Rr - 0.004; inner.add(foot);
  // top buttons + logo badge on the front
  const btnGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16);
  for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(btnGeo, rubber); b.position.set(i * 0.026, Rr * 1.02, 0); inner.add(b); }
  const logo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.004), logoM); logo.position.set(0, -0.01, Rr * 1.03); inner.add(logo);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.003), ringM); led.position.set(0, -Rr * 0.72, Rr * 0.72); led.rotation.x = -Math.PI / 4; inner.add(led);

  group.traverse(o => { if (o.isMesh) { o.userData.keep = true; o.userData.noProbe = true; } });
  return { group, inner, ringM, rings, size: [L + 0.04, Rr * 2 + 0.03, Rr * 2] };
}
