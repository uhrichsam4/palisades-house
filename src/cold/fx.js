// Cold visuals + sounds (src/cold): HUD chips, frost vignette / white-out overlay, breath puffs (pooled sprites),
// weather blowing in through openings (one pooled Points (snow) + one LineSegments (rain streaks) for all
// emitters), wet / snow floor patches, procedural WebAudio (wind whistle, teeth chatter, ice crack/creak/break).
import * as THREE from 'three';

// ------------------------------------------------------------------ HUD + overlay
export function createOverlay() {
  const frost = document.createElement('canvas'); frost.width = frost.height = 512; const g = frost.getContext('2d');
  for (let i = 0; i < 900; i++) { const x = Math.random() * 512, y = Math.random() * 512, l = 6 + Math.random() * 40, a = Math.random() * 7; g.strokeStyle = `rgba(235,246,255,${0.1 + Math.random() * 0.35})`; g.lineWidth = 0.6 + Math.random(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { const b = a + (k % 2 ? 1.05 : -1.05) * 0.5; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.moveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5); g.lineTo(x + Math.cos(a) * l * 0.5 + Math.cos(b) * l * 0.3, y + Math.sin(a) * l * 0.5 + Math.sin(b) * l * 0.3); } g.stroke(); }
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(240,248,255,${Math.random() * 0.25})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }
  const st = document.createElement('style'); st.textContent = `
#cold-frost{position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;--k:0;background:radial-gradient(ellipse at center,rgba(220,238,255,0) 40%,rgba(205,228,250,.55) 100%),url(${frost.toDataURL()}) center/512px repeat;
 -webkit-mask-image:radial-gradient(ellipse at center,transparent calc(78% - var(--k)*48%),#000 calc(108% - var(--k)*40%));mask-image:radial-gradient(ellipse at center,transparent calc(78% - var(--k)*48%),#000 calc(108% - var(--k)*40%));transition:opacity .4s var(--ease-soft,ease-out)}
#cold-white{position:fixed;inset:0;pointer-events:none;z-index:4;background:#eef6fc;opacity:0;transition:opacity .6s ease-out}
#cold-chips{position:fixed;right:16px;bottom:64px;display:flex;gap:6px;z-index:5;pointer-events:none}
#cold-chips .chip{background:var(--ui-surface,#262626);border:1px solid rgba(247,247,247,.06)}
#cold-chips .chip[hidden]{display:none}
#cold-chips .chip.cold b{color:#9fd3ff}#cold-chips .chip.freezing b,#cold-chips .chip.frozen b{color:var(--ui-accent,#f2c84b)}
body.shot #cold-frost,body.shot #cold-white,body.shot #cold-chips{display:none}`;
  document.head.appendChild(st);
  const mk = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
  const fr = mk('cold-frost'), wh = mk('cold-white'), chips = mk('cold-chips');
  chips.innerHTML = '<span class="chip" id="cold-temp" hidden><i>TEMP::</i><b></b></span><span class="chip" id="cold-body" hidden><i>BODY::</i><b></b></span>';
  const tChip = chips.querySelector('#cold-temp'), bChip = chips.querySelector('#cold-body');
  let last = '';
  return {
    set({ frost: k, white, temp, body, level }) {
      const key = [k.toFixed(2), white.toFixed(2), temp, body, level].join('|'); if (key === last) return; last = key;
      fr.style.opacity = Math.min(1, k * 1.4).toFixed(3); fr.style.setProperty('--k', k.toFixed(3)); wh.style.opacity = white.toFixed(3);
      tChip.hidden = temp === null; if (temp !== null) tChip.lastChild.textContent = temp + '°C';
      bChip.hidden = !body; if (body) { bChip.lastChild.textContent = body; bChip.className = 'chip ' + level; }
    },
  };
}

// ------------------------------------------------------------------ textures
function softDot(n = 64, a = 1) { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.45, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); return new THREE.CanvasTexture(c); }
function blob(seed) { const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) { const x = n / 2 + (r() - 0.5) * n * 0.5, y = n / 2 + (r() - 0.5) * n * 0.5, rad = n * (0.12 + r() * 0.2); const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }
  return new THREE.CanvasTexture(c); }

// ------------------------------------------------------------------ breath (pooled sprites)
export function createBreath(scene) {
  const tex = softDot(64, 0.55); const N = 48; const pool = [];
  for (let i = 0; i < N; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf2f6fa, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.userData.keep = true; s.renderOrder = 5; scene.add(s); pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1 }); }
  let next = 0, live = 0;
  return {
    puff(x, y, z, fx, fz, k = 1) { for (let i = 0; i < 6; i++) { const o = pool[next]; next = (next + 1) % N; o.s.position.set(x + fx * 0.02, y, z + fz * 0.02); o.v.set(fx * (0.25 + Math.random() * 0.25) + (Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.08, fz * (0.25 + Math.random() * 0.25) + (Math.random() - 0.5) * 0.08); o.life = o.max = 1.1 + Math.random() * 0.8; o.k = k * (0.5 + i * 0.1); o.s.visible = true; } live = N; },
    update(dt) { if (!live) return; let a = 0; for (const o of pool) { if (o.life <= 0) continue; o.life -= dt; if (o.life <= 0) { o.s.visible = false; continue; } a++; const f = 1 - o.life / o.max; o.s.position.addScaledVector(o.v, dt); o.v.multiplyScalar(Math.exp(-dt * 1.4)); o.s.scale.setScalar(0.05 + f * 0.32); o.s.material.opacity = Math.sin(Math.PI * Math.min(1, f * 1.3)) * 0.38 * o.k; } live = a; },
  };
}

// ------------------------------------------------------------------ weather blowing in
const MAXP = 1400;
export function createBlowIn(scene) {
  const P = new Float32Array(MAXP * 3), V = new Float32Array(MAXP * 3), L = new Float32Array(MAXP), D = new Float32Array(MAXP * 2), KIND = new Uint8Array(MAXP); // D: emitter centre-plane depth limit, floor y
  const sPos = new Float32Array(MAXP * 3), rPos = new Float32Array(MAXP * 6);
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3).setUsage(THREE.DynamicDrawUsage));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.065, map: softDot(32, 1), color: 0xffffff, transparent: true, depthWrite: false, sizeAttenuation: true, opacity: 0.95 }));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: 0xb8c8d6, transparent: true, opacity: 0.55, depthWrite: false }));
  for (const o of [snow, rain]) { o.frustumCulled = false; o.visible = false; o.userData.keep = true; o.renderOrder = 6; scene.add(o); }
  let free = []; for (let i = MAXP - 1; i >= 0; i--) free.push(i); const used = new Set();
  const acc = new Map(); const hits = new Map(); // emitter id -> spawn accumulator / particles landed (decal growth)
  let t = 0;
  function spawn(e, kind, n) {
    const { pos, nx, nz, w, h, wx, wz, floorY, id } = e; const tx = -nz, tz = nx;
    for (let i = 0; i < n && free.length; i++) {
      const j = free.pop(); used.add(j); KIND[j] = kind; L[j] = id;
      const u = (Math.random() - 0.5) * w, v = (Math.random() - 0.5) * h;
      P[j * 3] = pos[0] + tx * u + nx * 0.35; P[j * 3 + 1] = pos[1] + v; P[j * 3 + 2] = pos[2] + tz * u + nz * 0.35;
      const sp = e.speed * (0.7 + Math.random() * 0.6);
      V[j * 3] = -nx * sp + wx * 0.5 + (Math.random() - 0.5) * 0.5; V[j * 3 + 2] = -nz * sp + wz * 0.5 + (Math.random() - 0.5) * 0.5;
      V[j * 3 + 1] = kind ? -0.4 - Math.random() * 0.6 : -4.5 - Math.random() * 2;
      D[j * 2] = e.reach * (0.4 + Math.random() * 0.8); D[j * 2 + 1] = floorY;
      ids[j] = e;
    }
  }
  const ids = new Array(MAXP);
  return {
    get live() { return used.size; },
    hits,
    update(dt, emitters) {
      t += dt;
      for (const e of emitters) { const kind = e.snow ? 1 : 0; const rate = e.rate * (kind ? 1 : 1.4); let a = (acc.get(e.id) || 0) + rate * dt; const n = a | 0; acc.set(e.id, a - n); if (n) spawn(e, kind, n); }
      if (!used.size) { snow.visible = rain.visible = false; return; }
      let ns = 0, nr = 0;
      for (const j of used) {
        const e = ids[j]; const k = KIND[j];
        if (k) { V[j * 3] += Math.sin(t * 3 + j) * 1.6 * dt; V[j * 3 + 2] += Math.cos(t * 2.3 + j * 1.7) * 1.6 * dt; V[j * 3 + 1] += (Math.sin(t * 4 + j * 0.7) * 0.8 - 0.1) * dt; }
        P[j * 3] += V[j * 3] * dt; P[j * 3 + 1] += V[j * 3 + 1] * dt; P[j * 3 + 2] += V[j * 3 + 2] * dt;
        const depth = -((P[j * 3] - e.pos[0]) * e.nx + (P[j * 3 + 2] - e.pos[2]) * e.nz); // metres inside
        if (P[j * 3 + 1] < D[j * 2 + 1] || depth > D[j * 2]) { if (P[j * 3 + 1] < D[j * 2 + 1] + 0.3) hits.set(e.id, (hits.get(e.id) || 0) + 1); used.delete(j); free.push(j); continue; }
        if (k) { sPos[ns * 3] = P[j * 3]; sPos[ns * 3 + 1] = P[j * 3 + 1]; sPos[ns * 3 + 2] = P[j * 3 + 2]; ns++; }
        else { const o = nr * 6; rPos[o] = P[j * 3]; rPos[o + 1] = P[j * 3 + 1]; rPos[o + 2] = P[j * 3 + 2]; rPos[o + 3] = P[j * 3] - V[j * 3] * 0.035; rPos[o + 4] = P[j * 3 + 1] - V[j * 3 + 1] * 0.035; rPos[o + 5] = P[j * 3 + 2] - V[j * 3 + 2] * 0.035; nr++; }
      }
      snow.visible = ns > 0; rain.visible = nr > 0;
      sGeo.setDrawRange(0, ns); sGeo.attributes.position.needsUpdate = true; rGeo.setDrawRange(0, nr * 2); rGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ floor patches (wet / snow drift)
export function createPatches(scene) {
  const map = new Map(); const geo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2); const alpha = [blob(11), blob(23), blob(37)];
  return {
    map,
    touch(e, kind, grow) {
      let p = map.get(e.id);
      if (!p) { const m = new THREE.MeshStandardMaterial({ color: 0x1b232b, roughness: 0.06, metalness: 0, transparent: true, opacity: 0, depthWrite: false, alphaMap: alpha[map.size % 3], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 2; mesh.userData.keep = true; mesh.receiveShadow = true; scene.add(mesh);
        mesh.position.set(e.pos[0] - e.nx * 1.1, e.floorY + 0.012, e.pos[2] - e.nz * 1.1); mesh.rotation.y = Math.atan2(e.nx, e.nz); p = { mesh, amt: 0, kind }; map.set(e.id, p); }
      if (p.kind !== kind && (p.amt < 0.05 || kind === 'wet')) p.kind = kind; // rain turns a drift into slush/wet
      p.amt = Math.min(1, p.amt + grow); p.fresh = true;
    },
    update(dt) {
      for (const [id, p] of map) {
        p.amt -= dt / (p.kind === 'snow' ? 240 : 150) * (p.fresh ? 0 : 1); p.fresh = false;
        if (p.amt <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); map.delete(id); continue; }
        const m = p.mesh.material, k = Math.min(1, p.amt * 1.6), s = 0.35 + p.amt * 1.25;
        if (p.kind === 'snow') { m.color.setHex(0xf3f7fa); m.roughness = 0.9; m.opacity = Math.min(1, k * 1.2); } else { m.color.setHex(0x1b232b); m.roughness = 0.05; m.opacity = 0.55 * k; }
        p.mesh.scale.set(s * 0.9, 1, s * 1.3);
      }
    },
  };
}

// ------------------------------------------------------------------ audio (procedural, lazy)
export function createAudio(camera) {
  let ac = null, out = null, noise = null, wind = null, lastChat = 0;
  function ctx() {
    if (ac) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
      const n = ac.sampleRate * 2; noise = ac.createBuffer(1, n, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      addEventListener('pointerdown', () => ac.state === 'suspended' && ac.resume().catch(() => {}), { passive: true });
    } catch { ac = null; }
    return ac;
  }
  function burst(t0, dur, freq, q, vol, type = 'bandpass') { const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random() * 1.5, dur + 0.05); }
  const distVol = (p) => p ? 1 / (1 + camera.position.distanceToSquared(new THREE.Vector3(p.x, p.y, p.z)) * 0.08) : 1;
  return {
    chatter(k) { if (!ctx() || ac.state !== 'running') return; const now = ac.currentTime; if (now - lastChat < 0.9) return; lastChat = now; const n = 6 + (k * 8 | 0); for (let i = 0; i < n; i++) burst(now + i * (0.045 + Math.random() * 0.02), 0.02, 2600 + Math.random() * 900, 3, 0.12 * k); },
    play(kind, p) {
      if (!ctx() || ac.state !== 'running') return; const now = ac.currentTime, v = distVol(p);
      if (kind === 'crack') { for (let i = 0; i < 7; i++) burst(now + i * 0.03 + Math.random() * 0.03, 0.04, 1800 + Math.random() * 2400, 2, 0.5 * v); burst(now, 0.35, 260, 1.2, 0.35 * v, 'lowpass'); }
      else if (kind === 'creak') burst(now, 0.05, 1200 + Math.random() * 2000, 4, 0.25 * v);
      else if (kind === 'break') { burst(now, 0.12, 900, 0.8, 0.9 * v); for (let i = 0; i < 10; i++) burst(now + 0.02 + i * 0.025, 0.06, 3000 + Math.random() * 3000, 2, 0.35 * v); burst(now + 0.08, 0.9, 500, 0.7, 0.8 * v, 'lowpass'); }
    },
    whistle(level, freqK) { // continuous wind whistle near open windows: level 0..1
      if (level < 0.01 && !wind) return; if (!ctx()) return;
      if (!wind) { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; f.frequency.value = 900; const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(); wind = { s, f, g }; }
      const now = ac.currentTime; wind.g.gain.setTargetAtTime(Math.min(0.35, level * 0.35), now, 0.3); wind.f.frequency.setTargetAtTime(700 + 700 * freqK + Math.sin(now * 1.7) * 160 + Math.sin(now * 0.6) * 220, now, 0.2);
      if (level < 0.01 && wind.g.gain.value < 0.002) { try { wind.s.stop(); } catch {} wind = null; }
    },
  };
}
