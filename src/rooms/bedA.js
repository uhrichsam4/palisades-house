// Piece: bedA — Bedroom A (front, over garage) + hall bath A
// Owned rooms: bedA, bathA | Reference photos: p24, p25, p26
//
// Bedroom A (p24): front-gable vault (ridge runs front-to-back, along z, at the room centre line),
// charcoal woven wallpaper on the NE wall (x = 15.60) behind a tall channel-tufted cream bed,
// fluted white-oak nightstands with black glossy lamps, 3-lite black window on the street wall
// (z = 0.65) under a linen roman shade, walnut lounge chair with a faux-fur throw, framed horse print,
// cream/taupe dash rug, white 3-blade fan.
// Bath A (p25, p26): rift-oak vanity with thick white quartz top along the SW wall, big oak-framed
// mirror (real planar reflection) with a nickel picture light, dark slate porcelain floor,
// vein-cut travertine shower with frameless glass at the hall end.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const piece = { rooms: ["bedA", "bathA"], photos: ["p24", "p25", "p26"] };
export const ownCeiling = ['bedA'];
export const views = {
  p24: { pos: [12.55, 4.62, 5.90], look: [15.4, 4.22, 1.60], fov: 72 },
  p25: { pos: [16.70, 4.70, 2.70], look: [15.55, 4.55, 0.85], fov: 68 },
  p26: { pos: [16.30, 4.72, 2.15], look: [15.95, 4.62, 4.45], fov: 60 },
};

const std = (o) => new THREE.MeshStandardMaterial(o);
const physMat = (o) => new THREE.MeshPhysicalMaterial(o);

// ------------------------------------------------------------------ procedural textures
function wallpaperTex(kit) { // charcoal woven / chevron grasscloth-like paper, 0.6 m repeat
  const r = kit.rng(24);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a756f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 100 + (r() - 0.5) * 22; g.fillStyle = `rgba(${v},${v - 1},${v - 3},0.5)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    const cell = 64; // chevron rows of short diagonal strokes
    for (let y = 0; y < h; y += cell / 2) for (let x = 0; x < w; x += cell) {
      const dir = ((y / (cell / 2)) % 2) ? 1 : -1; const v = 140 + r() * 26;
      g.strokeStyle = `rgba(${v},${v - 2},${v - 5},0.55)`; g.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) { const o = k * 4; g.beginPath(); g.moveTo(x + o, y + (dir > 0 ? 0 : cell / 2)); g.lineTo(x + o + cell / 2, y + (dir > 0 ? cell / 2 : 0)); g.stroke(); }
      const v2 = 84 + r() * 10; g.strokeStyle = `rgba(${v2},${v2},${v2},0.6)`;
      for (let k = 0; k < 8; k++) { const o = k * 4; g.beginPath(); g.moveTo(x + cell / 2 + o, y + (dir > 0 ? cell / 2 : 0)); g.lineTo(x + cell + o, y + (dir > 0 ? 0 : cell / 2)); g.stroke(); }
    }
  }, { repeat: [1 / 0.6, 1 / 0.6] });
}
function travertineTex(kit, seed = 5) { // vein-cut travertine, 1.2 x 2.8 m slab: soft vertical bands + elongated pits
  const r = kit.rng(seed);
  return kit.canvasTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#cdb196'; g.fillRect(0, 0, w, h);
    g.filter = 'blur(6px)';
    for (let i = 0; i < 70; i++) { const x = r() * w, bw = 15 + r() * 140; const t = r(); g.fillStyle = t < 0.4 ? 'rgba(232,218,200,0.35)' : t < 0.8 ? 'rgba(178,150,120,0.28)' : 'rgba(196,160,128,0.3)'; g.fillRect(x, 0, bw, h); }
    g.filter = 'blur(1.2px)';
    for (let i = 0; i < 520; i++) {
      const x0 = r() * w, y0 = r() * h - 200, len = 200 + r() * 1600, lw = 1 + r() * 5; const t = r();
      g.strokeStyle = t < 0.6 ? `rgba(150,118,86,${0.10 + r() * 0.22})` : t < 0.85 ? `rgba(230,214,196,${0.10 + r() * 0.2})` : `rgba(170,120,84,${0.10 + r() * 0.18})`;
      g.lineWidth = lw; g.beginPath(); let x = x0; g.moveTo(x, y0);
      for (let y = y0; y < y0 + len; y += 50) { x += (r() - 0.5) * 6; g.lineTo(x, y); } g.stroke();
    }
    g.filter = 'none';
    for (let i = 0; i < 1100; i++) { const x = r() * w, y = r() * h; g.fillStyle = `rgba(118,92,66,${0.2 + r() * 0.4})`; g.beginPath(); g.ellipse(x, y, 0.8 + r() * 2, 2 + r() * 12, 0, 0, Math.PI * 2); g.fill(); }
  }, { repeat: [1 / 1.2, 1 / 2.8] });
}
function slateTileTex(kit) { // dark porcelain slate, 0.6 x 1.2 m tiles, texture = 1.2 m square
  const r = kit.rng(9);
  return kit.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#545656'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = 76 + (r() - 0.5) * 18; g.fillStyle = `rgba(${v},${v + 1},${v + 2},0.18)`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 7000; i++) { const v = 84 + (r() - 0.5) * 40; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.fillStyle = '#3a3b3b'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2 - 1, 0, 2, h);
  }, { repeat: [1 / 1.2, 1 / 1.2] });
}
function rugTex(kit) { // cream flat-weave with blocky taupe / grey dash bands (p24)
  const r = kit.rng(31);
  return kit.canvasTex(1024, 1360, (g, w, h) => {
    g.fillStyle = '#bfb6a6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40000; i++) { const v = 214 + (r() - 0.5) * 30; g.fillStyle = `rgba(${v},${v - 5},${v - 14},0.5)`; g.fillRect(r() * w, r() * h, 3, 1); }
    const cols = ['rgba(170,160,145,0.8)', 'rgba(150,145,138,0.75)', 'rgba(196,188,174,0.9)', 'rgba(140,126,106,0.6)', 'rgba(188,178,162,0.85)', 'rgba(232,227,218,0.9)'];
    // dashes run along the rug's long axis (canvas y) in loose bands
    for (let x = 20; x < w - 20; x += 16 + r() * 14) {
      let y = 20 + r() * 60; const dense = r() < 0.5 ? 0.7 : 0.35;
      while (y < h - 40) { const len = 40 + r() * 220; if (r() < dense) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, y, 9 + r() * 10, Math.min(len, h - 20 - y)); } y += len + 10 + r() * 90; }
    }
    for (let i = 0; i < 24000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.1})`; g.fillRect(r() * w, r() * h, 1, 2); }
  });
}
function waffleTex(kit, base = [214, 204, 186]) { // waffle-knit (shams, towels): bump + colour
  return kit.canvasTex(256, 256, (g, w, h) => {
    const [R, G, B] = base; g.fillStyle = `rgb(${R - 30},${G - 30},${B - 30})`; g.fillRect(0, 0, w, h);
    const n = 12, c = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const gr = g.createRadialGradient(i * c + c / 2, j * c + c / 2, 1, i * c + c / 2, j * c + c / 2, c * 0.55);
      gr.addColorStop(0, `rgb(${R + 12},${G + 12},${B + 12})`); gr.addColorStop(1, `rgb(${R - 22},${G - 22},${B - 22})`);
      g.fillStyle = gr; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
    }
  });
}
function horsePrintTex(kit) { // dark umber print with an ochre galloping horse (recreated, not photo pixels)
  const r = kit.rng(77);
  return kit.canvasTex(768, 576, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a241f'); gr.addColorStop(1, '#3b3129'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${150 + r() * 60},${120 + r() * 50},${80 + r() * 40},${r() * 0.12})`; g.lineWidth = r() * 2; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 20); g.stroke(); }
    g.strokeStyle = 'rgba(190,160,110,0.35)'; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52);
    g.fillStyle = 'rgba(190,160,110,0.25)'; for (let i = 0; i < 6; i++) g.fillRect(60 + i * 40, h - 70, 26, 4);
    // horse
    g.save(); g.translate(w * 0.5, h * 0.47); g.fillStyle = '#c4a468'; g.strokeStyle = '#c4a468'; g.lineCap = 'round';
    g.beginPath(); g.ellipse(0, 0, 120, 46, -0.08, 0, Math.PI * 2); g.fill(); // body
    g.beginPath(); g.moveTo(80, -30); g.quadraticCurveTo(130, -90, 150, -120); g.lineTo(178, -112); g.quadraticCurveTo(150, -60, 120, 10); g.fill(); // neck
    g.beginPath(); g.ellipse(176, -112, 40, 16, 0.55, 0, Math.PI * 2); g.fill(); // head
    g.lineWidth = 15;
    const leg = (x, y, a1, l1, a2, l2) => { g.beginPath(); g.moveTo(x, y); const kx = x + Math.cos(a1) * l1, ky = y + Math.sin(a1) * l1; g.lineTo(kx, ky); g.lineTo(kx + Math.cos(a2) * l2, ky + Math.sin(a2) * l2); g.stroke(); };
    leg(90, 20, 0.5, 60, -0.3, 60); leg(70, 25, 1.2, 55, 0.2, 55); leg(-90, 20, 2.3, 60, 3.0, 60); leg(-70, 25, 1.9, 60, 2.7, 50);
    g.lineWidth = 10; g.beginPath(); g.moveTo(-115, -15); g.quadraticCurveTo(-180, -40, -215, 10); g.stroke(); // tail
    g.lineWidth = 4; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(100 + i * 8, -45 - i * 9); g.lineTo(80 + i * 8, -70 - i * 10); g.stroke(); }
    g.restore();
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(30,25,20,${r() * 0.35})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  });
}

// ------------------------------------------------------------------ geometry helpers
// Fabric draped over a box top (bed throw / duvet), in local bed coords: top spans x∈[-W/2,W/2],
// z∈[z0,z1] at height `top`; hangs `side` over both long edges and `foot` over the z1 edge.
function drape(W, z0, z1, top, side, foot, r = 0.035, wr = 0.006, seed = 1, seg = [48, 64]) {
  const geo = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]); const p = geo.attributes.position, uv = geo.attributes.uv;
  const fold = (d) => { if (d <= 0) return [d, 0]; const arc = r * Math.PI / 2; if (d < arc) { const t = d / r; return [r * Math.sin(t), r - r * Math.cos(t)]; } return [r, r + (d - arc)]; };
  const Wt = W + 2 * side, Lt = (z1 - z0) + foot;
  for (let i = 0; i < p.count; i++) {
    const s = uv.getX(i), t = 1 - uv.getY(i);
    const u = (s - 0.5) * Wt, v = z0 + t * Lt;
    const [ox, dx] = fold(Math.abs(u) - W / 2); const [oz, dz] = fold(v - z1);
    let x = Math.abs(u) > W / 2 ? Math.sign(u) * (W / 2 + ox) : u; let z = v > z1 ? z1 + oz : v; let y = top - dx - dz;
    const n = Math.sin(u * 9 + seed) * Math.sin(v * 5.3 + seed * 2) + 0.5 * Math.sin(u * 23 + v * 3 + seed);
    if (dx === 0 && dz === 0) y += wr * n; else { const k = wr * 1.8 * n * Math.min(1, (dx + dz) / 0.1); if (dx > 0) x += Math.sign(u) * k; if (dz > 0) z += k; }
    p.setXYZ(i, x, y, z); uv.setXY(i, u, v);
  }
  geo.computeVertexNormals(); return geo;
}
// reeded (fluted) panel: vertical half-round reeds across width w, height h, facing +z, origin bottom-left
function reeds(w, h, pitch = 0.016) {
  const n = Math.floor(w / pitch); const geos = []; const rr = pitch * 0.5;
  for (let i = 0; i < n; i++) { const c = new THREE.CylinderGeometry(rr, rr, h, 8, 1, true, -Math.PI / 2, Math.PI); c.scale(1, 1, 0.55); c.translate((i + 0.5) * (w / n), h / 2, 0); geos.push(c); }
  return geos;
}

export async function build(ctx) {
  const { kit, phys, root } = ctx; const M = kit.M;
  const BED = kit.roomInfo('bedA'), BATH = kit.roomInfo('bathA');
  const Y = BED.y; // 3.35
  const PLATE = ctx.plan.LEVELS[1].plate; // 6.10
  const RIDGE_Y = 7.06; // stays under the garage-wing roof plane (≈7.21 at the room centre line)

  // ---------------------------------------------------------------- materials
  const boucleMaps = kit.pbrMaps('wool_boucle', '1k', { repeat: [3, 3] }); delete boucleMaps.map;
  const boucle = std({ ...boucleMaps, color: 0xe2d8c6, roughness: 0.97, normalScale: new THREE.Vector2(0.7, 0.7) });
  const wpMap = wallpaperTex(kit);
  const wallpaper = std({ map: wpMap, bumpMap: wpMap, bumpScale: 1.2, roughness: 0.9 });
  const travMap = travertineTex(kit); travMap.offset.set(0, -Y / 2.8);
  const travertine = std({ map: travMap, bumpMap: travMap, bumpScale: 0.08, roughness: 0.55, color: 0xf6e6d6 });
  const slate = std({ map: slateTileTex(kit), normalMap: kit.noiseNormal(256, 1.2, 24, 4), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.55 });
  const slateBase = std({ color: 0x4d4f4f, roughness: 0.55 });
  const rugMat = std({ map: rugTex(kit), normalMap: kit.noiseNormal(256, 3, 64, 12), normalScale: new THREE.Vector2(0.2, 0.2), roughness: 1 });
  const duvet = std({ color: 0xf6f4f0, roughness: 0.95, side: THREE.DoubleSide, normalMap: kit.noiseNormal(256, 1.4, 12, 21), normalScale: new THREE.Vector2(0.4, 0.4) });
  const gauze = std({ color: 0xb9ab98, roughness: 1, side: THREE.DoubleSide, normalMap: kit.noiseNormal(256, 2, 96, 33), normalScale: new THREE.Vector2(0.35, 0.35) });
  const waffle = waffleTex(kit); waffle.repeat.set(2.5, 2.5);
  const shamMat = std({ map: waffle, bumpMap: waffle, bumpScale: 2, color: 0xfff6ea, roughness: 0.95 });
  const pillowWhite = std({ color: 0xf8f7f4, roughness: 0.9, normalMap: kit.noiseNormal(128, 1, 8, 2), normalScale: new THREE.Vector2(0.3, 0.3) });
  const towelTex = waffleTex(kit, [150, 146, 136]); towelTex.repeat.set(3, 4);
  const towelGrey = std({ map: towelTex, bumpMap: towelTex, bumpScale: 2, roughness: 1 });
  const towelTaupeTex = waffleTex(kit, [196, 184, 168]); towelTaupeTex.repeat.set(3, 3);
  const towelTaupe = std({ map: towelTaupeTex, bumpMap: towelTaupeTex, bumpScale: 2, roughness: 1 });
  const oakNight = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [1.2, 1.2] }), color: 0xffe2b8, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) });
  const walnut = std({ ...kit.pbrMaps('white_oak_veneer', '1k', { repeat: [2, 2] }), color: 0x8a5f3e, roughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) });
  const chairCushion = std({ color: 0x7d7b77, roughness: 0.95, normalMap: kit.noiseNormal(128, 2, 32, 8), normalScale: new THREE.Vector2(0.4, 0.4) });
  const furMaps = kit.pbrMaps('curly_teddy_natural', '1k', { repeat: [2, 2] }); delete furMaps.map;
  const fur = std({ ...furMaps, color: 0xf7f5f1, roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) });
  const blackGloss = physMat({ color: 0x0b0c10, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const shadeMat = std({ color: 0xf8f6f1, emissive: 0xffeedb, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide });
  const linenShade = std({ color: 0xc8bba6, roughness: 0.95, normalMap: kit.noiseNormal(256, 3, 64, 41), normalScale: new THREE.Vector2(0.5, 0.5) });
  const fanWhite = std({ color: 0xf4f3f0, roughness: 0.5 });
  const ceramic = std({ color: 0xfbfbfa, roughness: 0.08 });
  const quartz = std({ color: 0xf3f2ef, roughness: 0.16, normalMap: kit.noiseNormal(256, 0.4, 16, 51), normalScale: new THREE.Vector2(0.05, 0.05) });
  const nickel = M.brushedNickel;
  const opal = std({ color: 0xffffff, emissive: 0xfff6ea, emissiveIntensity: 1.6, roughness: 0.4 });
  const frameGold = std({ color: 0x8c7445, roughness: 0.4, metalness: 0.7 });

  // ================================================================ BEDROOM A
  const bed = kit.group(root, [0, 0, 0], 0, 'bedA');
  // ---- floor stays the shell's oak; vaulted ceiling (front-gable vault, ridge along z at the room centre)
  const vaultMat = M.ceilingWhite.clone(); vaultMat.emissive = new THREE.Color(0xffffff); vaultMat.emissiveIntensity = 0.16;
  const vault = kit.vault(bed, BED.rect, 'z', PLATE, RIDGE_Y, vaultMat, M.paintWhite, 0, true);
  const ceilAt = vault.userData.heightAt;
  const xc = BED.cx; const slope = (RIDGE_Y - PLATE) / (BED.w / 2);
  // can lights on the slopes, oriented to the ceiling plane
  {
    const disc = new THREE.CircleGeometry(0.045, 24); disc.rotateX(Math.PI / 2);
    const ring = new THREE.RingGeometry(0.045, 0.062, 24); ring.rotateX(Math.PI / 2);
    const lit = std({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.4 });
    const trim = std({ color: 0xeceae5, roughness: 0.6 });
    for (const x of [12.45, 14.57]) for (const z of [1.55, 3.3, 5.05]) {
      const n = new THREE.Vector3(x < xc ? slope : -slope, -1, 0).normalize();
      const g = new THREE.Group(); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n);
      g.position.set(x, ceilAt(x, z), z).addScaledVector(n, 0.004); bed.add(g);
      g.add(new THREE.Mesh(disc, lit), new THREE.Mesh(ring, trim));
    }
  }
  // ---- ceiling fan (white, 3 blades) hung from the ridge
  {
    const fz = 3.15, top = RIDGE_Y; const fan = kit.group(bed, [xc, top, fz], 0, 'fan');
    kit.add(fan, kit.cyl(0.055, 0.07, 0.06), fanWhite, [0, -0.03, 0]); // canopy
    kit.add(fan, kit.cyl(0.012, 0.012, 0.32), fanWhite, [0, -0.2, 0]); // downrod
    const rotor = kit.group(fan, [0, -0.40, 0], 0, 'fanRotor'); rotor.userData.keep = true;
    kit.add(rotor, kit.lathe([[0, 0.06], [0.09, 0.055], [0.115, 0.02], [0.11, -0.02], [0.07, -0.05], [0, -0.055]], 40), fanWhite, [0, 0, 0]);
    kit.add(rotor, kit.cyl(0.075, 0.075, 0.012, 40), std({ color: 0xffffff, emissive: 0xfff8ee, emissiveIntensity: 0.5 }), [0, -0.058, 0]);
    const blade = kit.extrude([[0.10, -0.035], [0.70, -0.06], [0.74, -0.045], [0.75, 0.0], [0.72, 0.05], [0.10, 0.03]], 0.008, 0.002);
    blade.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) { const b = kit.add(rotor, blade, fanWhite, [0, -0.005, 0], [0.18, (i * Math.PI * 2) / 3 + 0.4, 0]); b.rotation.order = 'YXZ'; }
    ctx.onUpdate((dt) => { rotor.rotation.y += dt * 1.8; });
  }
  // ---- accent wallpaper on the NE wall (x = 15.60)
  kit.wallPanel(bed, [BED.x1, BED.z0], [BED.x1, BED.z1], Y, PLATE, [-1, 0], wallpaper, 0.004);
  // ---- baseboards (skip the hall door on the SW wall)
  kit.baseboards(bed, BED.rect, Y, 0.10, 0.014, M.paintWhite, [{ side: 'x0', from: 4.76, to: 5.64 }]);

  // ---- bed: local frame faces +z (foot), headboard at z=0 against the wallpaper wall
  const bedZ = 3.22;
  const bedG = kit.group(bed, [BED.x1, Y, bedZ], -Math.PI / 2, 'bed');
  {
    const W = 2.08, Lb = 2.24;
    kit.add(bedG, kit.box(W - 0.16, 0.07, Lb - 0.2), M.matteBlack, [0, 0.035, 0.12 + Lb / 2]); // recessed plinth
    kit.add(bedG, kit.cushion(W, 0.40, Lb, 0.05, 0.004), boucle, [0, 0.07 + 0.20, 0.10 + Lb / 2]); // upholstered base
    kit.add(bedG, kit.rbox(1.90, 0.20, 2.03, 0.06), duvet, [0, 0.55, 0.16 + 1.015]); // mattress
    // headboard: backing + 9 vertical channels
    const HB_W = 2.16, HB_H = 1.58, nCh = 10, chW = HB_W / nCh;
    kit.add(bedG, kit.rbox(HB_W, HB_H, 0.08, 0.03), boucle, [0, HB_H / 2, 0.05]);
    const ch = kit.cushion(chW - 0.006, 0.07, HB_H - 0.32, 0.045, 0.04, 6); ch.rotateX(Math.PI / 2);
    for (let i = 0; i < nCh; i++) kit.add(bedG, ch, boucle, [-HB_W / 2 + chW * (i + 0.5), 0.30 + (HB_H - 0.30) / 2, 0.10]);
    kit.add(bedG, kit.cushion(HB_W, 0.08, 0.10, 0.04, 0.02), boucle, [0, HB_H - 0.01, 0.07]); // rolled top cap
    // duvet + gauze throw
    kit.add(bedG, drape(1.92, 0.30, 2.22, 0.665, 0.20, 0.18, 0.04, 0.008, 3), duvet, [0, 0, 0]);
    kit.add(bedG, drape(2.04, 1.10, 2.33, 0.69, 0.40, 0.30, 0.07, 0.008, 7), gauze, [0, 0, 0]);
    // throw folded back edge (a soft roll across the bed)
    kit.add(bedG, kit.cushion(2.08, 0.05, 0.16, 0.025, 0.02), gauze, [0, 0.705, 1.11]);
    kit.add(bedG, kit.rbox(1.86, 0.05, 0.22, 0.025), duvet, [0, 0.69, 0.42]); // folded duvet top edge
    phys.boxLocal(bedG, 0, 0.36, 0.1 + Lb / 2, W / 2, 0.36, Lb / 2);
    phys.boxLocal(bedG, 0, HB_H / 2, 0.06, HB_W / 2, HB_H / 2, 0.08);
  }
  // pillows (dynamic): two white sleepers leaning on the headboard, two waffle euro shams in front
  const dynamicBits = [];
  {
    const pillow = (w, h, t, mat, x, y, z, lean, yaw) => {
      const geo = kit.cushion(w, t, h, 0.05, t * 0.45, 5);
      const m = kit.add(bedG, geo, mat, [x, y, z], [Math.PI / 2 - lean, yaw, 0]); m.rotation.order = 'YXZ'; dynamicBits.push(m); return m;
    };
    pillow(0.90, 0.52, 0.16, pillowWhite, -0.48, 0.93, 0.24, 0.32, 0.05);
    pillow(0.90, 0.52, 0.16, pillowWhite, 0.50, 0.93, 0.24, 0.30, -0.06);
    pillow(0.64, 0.60, 0.17, shamMat, -0.36, 0.99, 0.42, 0.20, 0.12);
    pillow(0.64, 0.60, 0.17, shamMat, 0.33, 0.99, 0.44, 0.18, -0.1);
  }

  // ---- fluted oak nightstand + black stacked lamp (local: faces +z, back at z=0)
  function nightstand(parent, pos, ry, W = 0.80, D = 0.46, H = 0.62) {
    const g = kit.group(parent, pos, ry, 'nightstand');
    kit.add(g, kit.rbox(W, 0.035, D, 0.012), oakNight, [0, H - 0.0175, D / 2]); // top
    kit.add(g, kit.rbox(0.03, H - 0.07, D - 0.01, 0.008), oakNight, [-W / 2 + 0.015, 0.035 + (H - 0.07) / 2, D / 2]);
    kit.add(g, kit.rbox(0.03, H - 0.07, D - 0.01, 0.008), oakNight, [W / 2 - 0.015, 0.035 + (H - 0.07) / 2, D / 2]);
    kit.add(g, kit.box(W - 0.06, H - 0.1, 0.02), oakNight, [0, 0.06 + (H - 0.1) / 2, 0.02]); // back
    kit.add(g, kit.box(W - 0.08, 0.05, D - 0.06), oakNight, [0, 0.025, D / 2]); // plinth
    const rowH = (H - 0.10) / 2, colW = (W - 0.06) / 2; const fronts = [];
    for (let rI = 0; rI < 2; rI++) for (let cI = 0; cI < 2; cI++) {
      const x0 = -W / 2 + 0.03 + cI * colW + 0.003, y0 = 0.055 + rI * rowH + 0.003, w = colW - 0.006, h = rowH - 0.006;
      const back = new THREE.BoxGeometry(w, h, 0.016); back.translate(x0 + w / 2, y0 + h / 2, D - 0.012); fronts.push(back);
      for (const r of reeds(w, h)) { r.translate(x0, y0, D - 0.004); fronts.push(r); }
    }
    const merged = kit.mergeGeometries(fronts.map(f => f.index ? f.toNonIndexed() : f));
    kit.add(g, merged, oakNight, [0, 0, 0]);
    // lamp
    const lamp = kit.group(g, [0.06, H, D * 0.48], 0, 'lamp'); lamp.scale.setScalar(1.12);
    kit.add(lamp, kit.lathe([[0, 0], [0.075, 0], [0.08, 0.02], [0.062, 0.035], [0.05, 0.06], [0.072, 0.11], [0.078, 0.145], [0.052, 0.18], [0.04, 0.215], [0.066, 0.26], [0.072, 0.29], [0.05, 0.33], [0.032, 0.36], [0.03, 0.40], [0, 0.405]], 48), blackGloss, [0, 0, 0]);
    kit.add(lamp, kit.cyl(0.008, 0.008, 0.12), M.brass, [0, 0.46, 0]);
    kit.add(lamp, new THREE.CylinderGeometry(0.205, 0.205, 0.27, 48, 1, true), shadeMat, [0, 0.54, 0], [0, 0, 0], { shadow: false });
    kit.add(lamp, new THREE.CircleGeometry(0.2, 32).rotateX(Math.PI / 2), shadeMat, [0, 0.42, 0], [0, 0, 0], { shadow: false });
    phys.solidGroup(g);
    return g;
  }
  nightstand(bed, [BED.x1, Y, bedZ + 1.60], -Math.PI / 2, 0.92, 0.48, 0.62);
  nightstand(bed, [BED.x1, Y, bedZ - 1.47], -Math.PI / 2, 0.62, 0.42, 0.60);

  // ---- rug (9' x 12') under the lower two-thirds of the bed
  {
    const rug = kit.add(bed, kit.rbox(2.75, 0.012, 3.66, 0.005), rugMat, [13.55, Y + 0.006, 3.05], [0, Math.PI / 2, 0]);
    rug.castShadow = false;
  }
  // ---- window: roman shade (outside mount) on the 3-lite street window
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bA-front'); const wx = o.at[0], ww = o.w + 0.12;
    const top = Y + o.head + 0.22, bottom = Y + o.head - 0.42; const zf = BED.z0 + 0.045;
    const shade = kit.group(bed, [wx, 0, zf], 0, 'romanShade');
    kit.add(shade, kit.rbox(ww, 0.05, 0.06, 0.01), linenShade, [0, top - 0.025, 0]);
    const folds = 4, fh = (top - 0.05 - bottom) / folds;
    for (let i = 0; i < folds; i++) {
      const geo = kit.cushion(ww, 0.035 + i * 0.006, fh + 0.02, 0.012, 0.012 + i * 0.004); geo.rotateX(Math.PI / 2);
      kit.add(shade, geo, linenShade, [0, bottom + fh * (i + 0.5), 0.005 + i * 0.002], [-0.06, 0, 0]);
    }
    kit.add(shade, kit.rbox(ww, 0.03, 0.05, 0.012), linenShade, [0, bottom + 0.01, 0.02]); // bottom hem bar
  }
  // ---- framed horse print on the street wall, left of the window
  {
    const art = kit.group(bed, [11.98, Y + 1.62, BED.z0], 0, 'art');
    const W = 0.80, H = 0.60;
    for (const [w, h, x, y] of [[W, 0.025, 0, H / 2], [W, 0.025, 0, -H / 2], [0.025, H + 0.025, -W / 2, 0], [0.025, H + 0.025, W / 2, 0]]) kit.add(art, kit.box(w, h, 0.03), M.matteBlack, [x, y, 0.015]);
    for (const [w, h, x, y] of [[W - 0.03, 0.008, 0, H / 2 - 0.016], [W - 0.03, 0.008, 0, -H / 2 + 0.016], [0.008, H - 0.03, -W / 2 + 0.016, 0], [0.008, H - 0.03, W / 2 - 0.016, 0]]) kit.add(art, kit.box(w, h, 0.012), frameGold, [x, y, 0.024]);
    kit.add(art, new THREE.PlaneGeometry(W - 0.03, H - 0.03), std({ map: horsePrintTex(kit), roughness: 0.85 }), [0, 0, 0.012]);
  }
  // ---- lounge chair (walnut frame, grey cushions, faux-fur throw) facing the bed
  {
    const ch = kit.group(bed, [12.12, Y, 1.32], 0.35, 'loungeChair');
    const W = 0.70, D = 0.74;
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.03);
      kit.add(ch, kit.tube([[x, 0, 0.30], [x, 0.30, 0.34], [x, 0.58, 0.36]], 0.018, 12), walnut); // front leg -> arm post
      kit.add(ch, kit.tube([[x, 0, -0.33], [x, 0.30, -0.30], [x, 0.80, -0.42]], 0.018, 12), walnut); // back leg -> back post
      kit.add(ch, kit.rbox(0.055, 0.03, D - 0.05, 0.012), walnut, [x, 0.585, 0.02], [-0.04, 0, 0]); // flat arm
      kit.add(ch, kit.rbox(0.03, 0.035, D - 0.1, 0.01), walnut, [x, 0.16, 0.0]); // side stretcher
    }
    kit.add(ch, kit.rbox(W - 0.04, 0.035, 0.035, 0.01), walnut, [0, 0.30, 0.31]);
    kit.add(ch, kit.rbox(W - 0.04, 0.035, 0.035, 0.01), walnut, [0, 0.30, -0.28]);
    kit.add(ch, kit.cushion(W - 0.10, 0.10, D - 0.14, 0.04, 0.02), chairCushion, [0, 0.33, 0.02], [-0.10, 0, 0]);
    kit.add(ch, kit.cushion(W - 0.10, 0.08, 0.48, 0.04, 0.02), chairCushion, [0, 0.58, -0.33], [-1.05, 0, 0]);
    // faux-fur throw: lumpy blobs over the back and spilling over the right arm
    const furBlob = (w, h, d, seed) => { const g = kit.cushion(w, h, d, Math.min(w, h, d) * 0.45, h * 0.4, 6); const p = g.attributes.position; const r = kit.rng(seed);
      for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 31 + seed) * Math.sin(p.getZ(i) * 27) + Math.sin(p.getY(i) * 40)) * 0.06; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      g.computeVertexNormals(); return g; };
    kit.add(ch, furBlob(0.66, 0.16, 0.42, 3), fur, [0.0, 0.76, -0.36], [-0.95, 0, 0.1]);
    kit.add(ch, furBlob(0.50, 0.12, 0.44, 5), fur, [0.10, 0.44, 0.05], [0, 0.4, 0]);
    kit.add(ch, furBlob(0.30, 0.10, 0.35, 8), fur, [0.36, 0.55, 0.15], [0, 0, -0.9]);
    phys.solidGroup(ch);
  }

  // ================================================================ BATH A
  const bath = kit.group(root, [0, 0, 0], 0, 'bathA');
  const BY = BATH.y;
  kit.floorFinish(bath, 'bathA', slate);
  { // slate tile base on the painted walls (not inside the shower)
    const t = 0.012, h = 0.10, [x0, z0, x1, z1] = BATH.rect;
    kit.boxAt(bath, slateBase, x0 + 0.56, BY, z0, x1 - x0 - 0.56, h, t); // street wall (right of vanity)
    kit.boxAt(bath, slateBase, x1 - t, BY, z0, t, h, 4.45 - z0 - 0.0); // hall-side wall... interrupted by door below
    kit.boxAt(bath, slateBase, x0, BY, 2.15, t, h, 0.80); // SW wall between vanity and shower stub
  }
  // ---- vanity (local: faces +z = world +x, local +x = world -z), centred at z = 1.40
  const van = kit.group(bath, [BATH.x0, BY, 1.40], Math.PI / 2, 'vanity');
  {
    const L = 1.50, D = 0.55, H = 0.86, kick = 0.09;
    kit.add(van, kit.box(L - 0.04, kick, D - 0.08), slateBase, [0, kick / 2, (D - 0.08) / 2]);
    // carcass: full height at both ends, lowered under the sink so the basin reads white
    kit.add(van, kit.box(0.50, H - kick, D - 0.02), oakNight, [-0.50, kick + (H - kick) / 2, (D - 0.02) / 2]);
    kit.add(van, kit.box(0.45, H - kick, D - 0.02), oakNight, [0.525, kick + (H - kick) / 2, (D - 0.02) / 2]);
    kit.add(van, kit.box(0.55, H - kick - 0.20, D - 0.02), oakNight, [0.025, kick + (H - kick - 0.20) / 2, (D - 0.02) / 2]);
    // fronts: near section (local x -0.75..-0.25) 3 drawers; centre doors; far section 3 drawers
    const front = (x0, w, y0, h, pull) => {
      const f = kit.add(van, kit.shakerFront(w - 0.006, h - 0.006, 0.055, 0.02, 0.007), oakNight, [x0 + 0.003, y0 + 0.003, D - 0.02]);
      if (pull === 'h') { kit.add(van, kit.cyl(0.006, 0.006, 0.16, 12), nickel, [x0 + w / 2, y0 + h / 2 + (h > 0.2 ? h * 0.25 : 0), D + 0.025], [0, 0, Math.PI / 2]); for (const s of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.03, 8), nickel, [x0 + w / 2 + s * 0.07, y0 + h / 2 + (h > 0.2 ? h * 0.25 : 0), D + 0.01], [Math.PI / 2, 0, 0]); }
      if (pull === 'vL' || pull === 'vR') { const px = pull === 'vL' ? x0 + w - 0.05 : x0 + 0.05; kit.add(van, kit.cyl(0.006, 0.006, 0.16, 12), nickel, [px, y0 + h - 0.16, D + 0.025]); for (const s of [-1, 1]) kit.add(van, kit.cyl(0.005, 0.005, 0.03, 8), nickel, [px, y0 + h - 0.16 + s * 0.07, D + 0.01], [Math.PI / 2, 0, 0]); }
      return f;
    };
    const top = H, dh = (top - kick) / 3;
    for (const xs of [-0.75, 0.30]) { const w = xs < 0 ? 0.50 : 0.45; for (let i = 0; i < 3; i++) front(xs, w, kick + i * dh, dh, 'h'); }
    front(-0.25, 0.275, kick, top - kick - 0.17, 'vL'); front(0.025, 0.275, kick, top - kick - 0.17, 'vR');
    front(-0.25, 0.55, top - 0.17, 0.17, 'h'); // false front under the sink
    // quartz top (thick mitred edge) with a hole for the undermount sink
    const T = 0.05, ty = H, sx = 0.025, sw = 0.50, sd = 0.36, sz = 0.30, OD = D + 0.02;
    const slab = (x0, x1, z0, z1) => kit.add(van, kit.rbox(x1 - x0, T, z1 - z0, 0.004), quartz, [(x0 + x1) / 2, ty + T / 2, (z0 + z1) / 2]);
    slab(-L / 2 - 0.01, sx - sw / 2, 0, OD); slab(sx + sw / 2, L / 2 + 0.01, 0, OD);
    slab(sx - sw / 2, sx + sw / 2, 0, sz - sd / 2); slab(sx - sw / 2, sx + sw / 2, sz + sd / 2, OD);
    kit.add(van, kit.box(sw - 0.01, 0.16, sd - 0.01), std({ color: 0xfafaf8, roughness: 0.1, side: THREE.BackSide }), [sx, ty + T - 0.08, sz]); // basin interior
    kit.add(van, kit.cyl(0.018, 0.018, 0.004, 20), nickel, [sx, ty + T - 0.158, sz]); // drain
    // backsplash (to the mirror) + short return on the street wall
    kit.add(van, kit.box(L + 0.02, 0.30, 0.015), quartz, [0, ty + T + 0.15, 0.0075]);
    kit.add(van, kit.box(0.015, 0.30, OD), quartz, [L / 2 + 0.0175, ty + T + 0.15, OD / 2]);
    // light switch plate on the splash (near end)
    kit.add(van, kit.rbox(0.13, 0.12, 0.008, 0.003), std({ color: 0xf6f6f4, roughness: 0.4 }), [-0.62, ty + T + 0.15, 0.019]);
    // widespread faucet: gooseneck + two levers
    const fz = 0.09, fy = ty + T;
    kit.add(van, kit.cyl(0.022, 0.026, 0.05, 24), nickel, [sx, fy + 0.025, fz]);
    kit.add(van, kit.tube([[sx, fy + 0.04, fz], [sx, fy + 0.20, fz], [sx, fy + 0.27, fz + 0.06], [sx, fy + 0.22, fz + 0.15], [sx, fy + 0.15, fz + 0.16]], 0.011, 32), nickel);
    for (const s of [-1, 1]) {
      kit.add(van, kit.cyl(0.02, 0.024, 0.05, 20), nickel, [sx + s * 0.18, fy + 0.025, fz]);
      kit.add(van, kit.cyl(0.006, 0.006, 0.08, 10), nickel, [sx + s * 0.18, fy + 0.07, fz + 0.03], [Math.PI / 2.6, 0, 0]);
    }
    // mirror: oak frame + real planar reflection
    const MW = 1.44, MH = 1.30, my = ty + T + 0.30 + MH / 2, mz = 0.02, fw = 0.075;
    for (const [w, h, x, y] of [[MW, fw, 0, MH / 2 - fw / 2], [MW, fw, 0, -MH / 2 + fw / 2], [fw, MH - 2 * fw, -MW / 2 + fw / 2, 0], [fw, MH - 2 * fw, MW / 2 - fw / 2, 0]])
      kit.add(van, kit.rbox(w, h, 0.045, 0.006), oakNight, [x, my + y, mz + 0.0225]);
    const mirror = new Reflector(new THREE.PlaneGeometry(MW - 2 * fw + 0.01, MH - 2 * fw + 0.01), { textureWidth: 1024, textureHeight: 900, color: 0xd6d8d8, clipBias: 0.003 });
    mirror.position.set(0, my, mz + 0.012); mirror.userData.keep = true; mirror.name = 'mirror'; van.add(mirror);
    // picture light (nickel bar + opal tubes) on the mirror head
    const ly = my + MH / 2 - 0.16;
    kit.add(van, kit.box(0.05, 0.03, 0.02), nickel, [0, ly - 0.03, mz + 0.05]);
    kit.add(van, kit.cyl(0.008, 0.008, 0.12, 10), nickel, [0, ly, mz + 0.10], [Math.PI / 2, 0, 0]);
    kit.add(van, kit.cyl(0.012, 0.012, 0.66, 16), nickel, [0, ly + 0.01, mz + 0.16], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) kit.add(van, kit.cyl(0.028, 0.028, 0.26, 24), opal, [s * 0.17, ly - 0.025, mz + 0.16], [0, 0, Math.PI / 2], { shadow: false });
    phys.solidGroup(van);
  }
  // frosted privacy film on the bath window (p25 shows it milky white)
  {
    const o = ctx.plan.OPENINGS.find(q => q.id === 'bathA-front');
    const film = kit.add(bath, new THREE.PlaneGeometry(o.w - 0.08, o.head - o.sill - 0.08), std({ color: 0xffffff, emissive: 0xf4f6f8, emissiveIntensity: 0.9, roughness: 0.6, transparent: true, opacity: 0.92 }), [o.at[0], BY + (o.sill + o.head) / 2, BATH.z0 - 0.19], [0, 0, 0], { shadow: false });
    film.renderOrder = 3;
  }
  // towel hook + grey waffle hand towel on the street wall right of the mirror
  {
    const tx = 16.10, ty = BY + 1.74, tz = BATH.z0;
    kit.add(bath, kit.cyl(0.006, 0.006, 0.05, 10), nickel, [tx, ty, tz + 0.025], [Math.PI / 2, 0, 0]);
    kit.add(bath, kit.rbox(0.30, 0.50, 0.03, 0.012), towelGrey, [tx, ty - 0.24, tz + 0.03]);
    kit.add(bath, kit.rbox(0.30, 0.42, 0.03, 0.012), towelGrey, [tx, ty - 0.20, tz + 0.06], [0.05, 0, 0]);
    kit.add(bath, kit.cushion(0.30, 0.06, 0.06, 0.02, 0.01), towelGrey, [tx, ty + 0.01, tz + 0.045]);
  }
  // ---- shower: x 15.75..16.55, z 3.05..4.45 (hall end); partition to the door passage; stub + glass front
  {
    const sx0 = BATH.x0, sx1 = 16.55, sz0 = 3.05, sz1 = BATH.z1, top = PLATE;
    const part = kit.boxAt(bath, M.paintWhite, sx1, BY, sz0 - 0.10, 0.10, top - BY, sz1 - sz0 + 0.10); // partition (passage side painted)
    const stub = kit.boxAt(bath, M.paintWhite, sx0, BY, sz0 - 0.10, 0.20, top - BY, 0.10); // short return at the vanity side
    phys.boxAABB([sx1, BY, sz0 - 0.1], [sx1 + 0.1, top, sz1]); phys.boxAABB([sx0, BY, sz0 - 0.1], [sx0 + 0.2, top, sz0]);
    const trv = (a, b, n, y0 = BY, y1 = top) => kit.wallPanel(bath, a, b, y0, y1, n, travertine, 0.004);
    trv([sx0, sz0], [sx0, sz1], [1, 0]);             // fixture wall (SW)
    trv([sx0, sz1], [sx1, sz1], [0, -1]);            // back wall (hall)
    trv([sx1, sz1], [sx1, sz0], [-1, 0]);            // partition, shower side
    trv([sx0 + 0.20, sz0 - 0.10], [sx0 + 0.20, sz0], [1, 0]); // stub end, wrapped in stone
    trv([sx0, sz0], [sx0 + 0.20, sz0], [0, 1]);      // stub inside face
    kit.floorFinish(bath, [sx0, sz0, sx1, sz1], travertine, BY, 0.012);
    kit.add(bath, kit.box(sx1 - sx0 - 0.20, 0.08, 0.10), travertine, [(sx0 + 0.20 + sx1) / 2, BY + 0.04, sz0 - 0.05]); // curb
    // corner bench + niche ledge
    kit.add(bath, kit.box(sx1 - sx0, 0.46, 0.38), travertine, [(sx0 + sx1) / 2, BY + 0.23, sz1 - 0.19]);
    kit.add(bath, kit.box(sx1 - sx0, 0.03, 0.10), travertine, [(sx0 + sx1) / 2, BY + 1.12, sz1 - 0.05]);
    // frameless glass: fixed panel + hinged door on the stub
    const glass = physMat({ color: 0xf2f7f5, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.12, metalness: 0, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
    const gy0 = BY + 0.08, gy1 = BY + 2.05, gz = sz0 - 0.05;
    const gp = kit.add(bath, kit.box(sx1 - sx0 - 0.21, gy1 - gy0, 0.01), glass, [(sx0 + 0.205 + sx1) / 2, (gy0 + gy1) / 2, gz]); gp.renderOrder = 3; gp.castShadow = false;
    const edge = std({ color: 0xcfe3dc, roughness: 0.1, transparent: true, opacity: 0.55 });
    kit.add(bath, kit.box(0.012, gy1 - gy0, 0.012), edge, [sx1 - 0.005, (gy0 + gy1) / 2, gz], [0, 0, 0], { shadow: false });
    for (const y of [gy0 + 0.25, gy1 - 0.3]) kit.add(bath, kit.rbox(0.05, 0.08, 0.03, 0.005), nickel, [sx0 + 0.215, y, gz]); // hinges
    phys.boxAABB([sx0 + 0.2, BY, gz - 0.01], [sx1, gy1, gz + 0.01]);
    // fixtures on the SW wall: arm + head, slide bar, hand shower, hose, valve trims
    const wx = sx0 + 0.004, fzc = 3.80;
    kit.add(bath, kit.tube([[wx, BY + 2.05, fzc], [wx + 0.12, BY + 2.07, fzc], [wx + 0.22, BY + 2.00, fzc]], 0.011, 16), nickel);
    kit.add(bath, kit.lathe([[0, 0], [0.045, 0.005], [0.05, 0.02], [0.02, 0.06], [0.012, 0.07]], 32), nickel, [wx + 0.24, BY + 1.97, fzc], [0, 0, -0.9]);
    kit.add(bath, kit.cyl(0.03, 0.03, 0.03, 24), nickel, [wx + 0.015, BY + 2.05, fzc], [0, 0, Math.PI / 2]);
    kit.add(bath, kit.cyl(0.009, 0.009, 0.75, 12), nickel, [wx + 0.04, BY + 1.30, fzc + 0.18]);
    for (const y of [0.93, 1.67]) kit.add(bath, kit.box(0.04, 0.02, 0.02), nickel, [wx + 0.02, BY + y, fzc + 0.18]);
    kit.add(bath, kit.tube([[wx + 0.05, BY + 1.52, fzc + 0.18], [wx + 0.10, BY + 1.62, fzc + 0.10], [wx + 0.11, BY + 1.70, fzc + 0.04]], 0.014, 12), nickel); // hand shower
    kit.add(bath, kit.tube([[wx + 0.05, BY + 1.50, fzc + 0.18], [wx + 0.07, BY + 1.0, fzc + 0.20], [wx + 0.06, BY + 0.62, fzc + 0.14], [wx + 0.05, BY + 0.80, fzc + 0.08], [wx + 0.03, BY + 1.05, fzc + 0.12]], 0.005, 40), nickel);
    for (const [y, r] of [[1.12, 0.035], [1.32, 0.025]]) { kit.add(bath, kit.cyl(r, r, 0.03, 24), nickel, [wx + 0.015, BY + y, fzc + 0.18], [0, 0, Math.PI / 2]); kit.add(bath, kit.cyl(0.008, 0.008, 0.07, 10), nickel, [wx + 0.05, BY + y, fzc + 0.18], [0, 0, Math.PI / 2]); }
    // towel hook outside the shower (p26 right edge) with a taupe waffle bath towel
    const hz = 2.78; // SW wall between vanity and shower stub
    kit.add(bath, kit.cyl(0.006, 0.006, 0.05, 10), nickel, [sx0 + 0.025, BY + 1.80, hz], [0, 0, Math.PI / 2]);
    kit.add(bath, kit.cushion(0.035, 0.80, 0.36, 0.015, 0.0), towelTaupe, [sx0 + 0.05, BY + 1.40, hz]);
    kit.add(bath, kit.cushion(0.06, 0.06, 0.36, 0.025, 0.0), towelTaupe, [sx0 + 0.045, BY + 1.80, hz]);
  }
  // ceiling: one can + exhaust grille (flat shell ceiling)
  kit.canLights(bath, [[16.55, 1.40], [16.15, 3.75]], PLATE - 0.001);
  kit.add(bath, kit.box(0.25, 0.01, 0.25), std({ color: 0xe8e8e6, roughness: 0.6 }), [16.95, PLATE - 0.006, 2.4]);

  // ---- small dynamic props in the bath: folded towel, soap pump, tray candle
  {
    const t = kit.add(bath, kit.rbox(0.28, 0.07, 0.22, 0.025), towelTaupe, [BATH.x0 + 0.30, BY + 0.91 + 0.035, 0.80]); dynamicBits.push(t);
    const pump = kit.group(bath, [BATH.x0 + 0.14, BY + 0.91, 1.85], 0, 'soap');
    kit.add(pump, kit.cyl(0.032, 0.035, 0.15, 24), std({ color: 0xece4d8, roughness: 0.3 }), [0, 0.075, 0]);
    kit.add(pump, kit.cyl(0.008, 0.008, 0.04, 10), nickel, [0, 0.17, 0]);
    kit.add(pump, kit.box(0.04, 0.01, 0.012), nickel, [0.012, 0.19, 0]); dynamicBits.push(pump);
  }

  // ---------------------------------------------------------------- finish
  root.updateMatrixWorld(true);
  for (const m of dynamicBits) phys.dynamic(m, { mass: 0.4, shape: 'box', friction: 0.8 });
  kit.mergeStatic(root);
}
