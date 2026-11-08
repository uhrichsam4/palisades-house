// Party-game visuals: cash pickups (banded bill stacks, gold briefcase), money bursts / confetti, the "It" ring.
// Uses window.__party.money (src/party/money.js: {burst, spray, rain, stackMesh, update}) when it exists,
// otherwise its own: everything here is generated geometry + small canvas textures (no asset files).
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let shared = null;
function mats() {
  if (shared) return shared;
  const bill = canvasTex(256, 112, (g, w, h) => {
    g.fillStyle = '#c9d8bf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4f6e4a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 1.5; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#9fb894'; g.beginPath(); g.ellipse(w / 2, h / 2, 30, 36, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4f6e4a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#3f5a3b'; g.font = '700 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('100', 40, 32); g.fillText('100', w - 40, h - 30); g.fillText('100', w - 40, 32); g.fillText('100', 40, h - 30);
  });
  const edge = canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = '#b8c9ad'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = y % 4 ? '#d7e2cf' : '#9fb294'; g.fillRect(0, y, w, 1); }
  });
  const band = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#e9d9a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8943f'; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
    g.fillStyle = '#6b5420'; g.font = '700 18px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText('$', w / 2, h / 2 + 6);
  });
  const glow = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const paperTop = new THREE.MeshStandardMaterial({ map: bill, roughness: 0.85 });
  const paperSide = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.9 });
  shared = {
    brick: [paperSide, paperSide, paperTop, paperTop, paperSide, paperSide],
    band: new THREE.MeshStandardMaterial({ map: band, roughness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.26, emissive: 0x3a2a08, emissiveIntensity: 0.4 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.55 }),
    glowG: new THREE.MeshBasicMaterial({ map: glow, color: 0x7dffa0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    glowY: new THREE.MeshBasicMaterial({ map: glow, color: 0xf2c84b, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    billFly: new THREE.MeshStandardMaterial({ map: bill, roughness: 0.8, side: THREE.DoubleSide }),
    brickG: new THREE.BoxGeometry(0.156, 0.045, 0.066), bandG: new THREE.BoxGeometry(0.03, 0.047, 0.068),
    disc: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  return shared;
}

function brick(parent, x, y, z, ry) {
  const m = mats(); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const b = new THREE.Mesh(m.brickG, m.brick); b.castShadow = true; g.add(b);
  g.add(new THREE.Mesh(m.bandG, m.band)); parent.add(g); return g;
}
// value -> pickup object (group, origin at the floor; spins + bobs in update())
export function cashPickup(value) {
  const m = mats(); const root = new THREE.Group(); root.userData.keep = true;
  const body = new THREE.Group(); root.add(body);
  const party = window.__party?.money;
  if (value >= 50000) {
    // gold briefcase
    const cs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.33, 0.12), m.gold); cs.castShadow = true; body.add(cs);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.012, 0.125), m.leather); body.add(seam);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), m.leather); handle.position.y = 0.165; body.add(handle);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.13), m.leather); l.position.set(s * 0.14, 0.12, 0); body.add(l); }
    body.position.y = 0.55; body.scale.setScalar(1.3);
  } else {
    let made = false;
    if (party?.stackMesh) {
      try { const n = value >= 10000 ? 3 : value >= 5000 ? 2 : 1; for (let i = 0; i < n; i++) { const s = party.stackMesh(); s.position.set((i - (n - 1) / 2) * 0.17, 0, 0); body.add(s); } made = true; } catch { made = false; }
    }
    if (!made) {
      const layout = value >= 10000 ? [[-0.08, 0, -0.035], [0.08, 0, -0.035], [-0.08, 0, 0.035], [0.08, 0, 0.035], [0, 0.046, -0.035], [0, 0.046, 0.035], [0, 0.092, 0]]
        : value >= 5000 ? [[-0.08, 0, 0], [0.08, 0, 0], [0, 0.046, 0]] : [[0, 0, 0]];
      for (const [x, y, z] of layout) brick(body, x, y, z, (Math.random() - 0.5) * 0.25);
    }
    body.position.y = 0.45; body.scale.setScalar(2.2);
  }
  const glow = new THREE.Mesh(m.disc, value >= 50000 ? m.glowY : m.glowG); glow.scale.setScalar(value >= 50000 ? 1.5 : 1.0); glow.position.y = 0.03; glow.renderOrder = 2; root.add(glow);
  root.userData.body = body; root.userData.ph = Math.random() * 6;
  return root;
}
export function animatePickup(o, t) { const b = o.userData.body; b.rotation.y = t * 1.6 + o.userData.ph; b.position.y = (o.userData.base ??= b.position.y) + Math.sin(t * 2.4 + o.userData.ph) * 0.06; }

// own money / confetti bursts (fallback for window.__party.money.burst)
export function createBursts(scene) {
  const m = mats(); const live = [];
  const billG = new THREE.PlaneGeometry(0.16, 0.07);
  const confG = new THREE.PlaneGeometry(0.05, 0.03);
  const confM = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  function burst(pos, n = 60, kind = 'money') {
    const party = window.__party?.money;
    if (kind === 'money' && party?.burst) { try { party.burst(pos, n); return; } catch {} }
    n = Math.min(220, n | 0);
    const mesh = new THREE.InstancedMesh(kind === 'money' ? billG : confG, kind === 'money' ? m.billFly : confM, n);
    mesh.frustumCulled = false; mesh.userData.keep = true; scene.add(mesh);
    const P = []; const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.2;
      P.push({ p: new THREE.Vector3(pos.x, pos.y + 0.6, pos.z), v: new THREE.Vector3(Math.cos(a) * s * 0.55, 3 + Math.random() * 4, Math.sin(a) * s * 0.55), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12) });
      if (kind !== 'money') mesh.setColorAt(i, col.setHSL([0.13, 0.33, 0.0, 0.58, 0.85][i % 5], 0.85, 0.6));
    }
    live.push({ mesh, P, t: 0, life: 2.6 });
  }
  const q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), S1 = new THREE.Vector3(1, 1, 1), S0 = new THREE.Vector3();
  function update(dt) {
    for (let k = live.length - 1; k >= 0; k--) {
      const b = live[k]; b.t += dt;
      if (b.t > b.life) { b.mesh.parent?.remove(b.mesh); b.mesh.dispose(); live.splice(k, 1); continue; }
      const fade = b.t > b.life - 0.5 ? (b.life - b.t) / 0.5 : 1;
      for (let i = 0; i < b.P.length; i++) {
        const p = b.P[i]; p.v.y -= 9.81 * dt * 0.55; p.v.multiplyScalar(1 - dt * 1.4); // paper flutters: heavy drag
        p.p.addScaledVector(p.v, dt); if (p.p.y < -0.3) { p.p.y = -0.3; p.v.set(0, 0, 0); }
        p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt; q.setFromEuler(p.r);
        M4.compose(p.p, q, fade < 1 ? S0.setScalar(fade) : S1); b.mesh.setMatrixAt(i, M4);
      }
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return { burst, update };
}

// glowing yellow ring at a player's feet (Tag "It")
export function createRing(scene) {
  const m = mats(); const g = new THREE.Group(); g.userData.keep = true; g.visible = false;
  const ringM = new THREE.MeshBasicMaterial({ color: 0xf2c84b, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 10, 64).rotateX(Math.PI / 2), ringM); ring.position.y = 0.05; g.add(ring);
  const glow = new THREE.Mesh(m.disc, m.glowY); glow.scale.setScalar(1.9); glow.position.y = 0.04; glow.renderOrder = 2; g.add(glow);
  scene.add(g);
  return { group: g, set(pos, t) { if (!pos) { g.visible = false; return; } g.visible = true; g.position.set(pos.x, pos.y, pos.z); const s = 1 + Math.sin(t * 6) * 0.06; ring.scale.set(s, 1, s); }, dispose() { scene.remove(g); } };
}
