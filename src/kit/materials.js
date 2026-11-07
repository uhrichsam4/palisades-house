// Shared materials used by the shell and available to every room piece as `ctx.kit.M`.
// Pieces may create their own materials; prefer reusing these for consistency (one white paint!).
import * as THREE from 'three';
import { tex, pbrMaps, canvasTex, rng, noiseNormal } from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

// Photos: walls are a warm bright white (≈ sRGB 240,238,233 in daylight).
const paintNormal = noiseNormal(256, 0.6, 16, 3); paintNormal.repeat.set(1.5, 1.5);

// Light wide-plank white oak floor (graded from Poly Haven oak_wood_planks to the photo floor colour).
// 1 texture tile = 2.4 m so planks read ~0.22 m wide like the photos.
function oakFloorMat() {
  const rep = 1 / 2.4;
  return std({
    map: tex('assets/tex/oak_floor_light_diff.jpg', { srgb: true, repeat: [rep, rep] }),
    normalMap: tex('assets/ph/oak_wood_planks/oak_wood_planks_nor_gl_1k.jpg', { repeat: [rep, rep] }),
    roughnessMap: tex('assets/ph/oak_wood_planks/oak_wood_planks_rough_1k.jpg', { repeat: [rep, rep] }),
    normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.78, envMapIntensity: 0.8,
  });
}

// Procedural charcoal asphalt-shingle texture (no CC0 shingle scan exists on Poly Haven).
function shingleMat() {
  const r = rng(11);
  const map = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2c2e'; g.fillRect(0, 0, w, h);
    const rows = 8, rowH = h / rows;
    for (let row = 0; row < rows; row++) {
      const off = (row % 2) * 0.5; const tabs = 3;
      for (let t = -1; t <= tabs; t++) {
        const x = ((t + off) / tabs) * w; const v = 36 + r() * 22;
        g.fillStyle = `rgb(${v},${v + 1},${v + 3})`; g.fillRect(x + 1, row * rowH + 1, w / tabs - 2, rowH - 2);
        for (let k = 0; k < 220; k++) { const gv = v + (r() - 0.5) * 40; g.fillStyle = `rgba(${gv},${gv},${gv + 2},0.55)`; g.fillRect(x + r() * w / tabs, row * rowH + r() * rowH, 2, 2); }
      }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, row * rowH + rowH - 3, w, 3);
    }
  }, { repeat: [1 / 2.0, 1 / 1.6] });
  return std({ map, roughness: 0.92, metalness: 0, normalMap: noiseNormal(256, 2.5, 32, 5), normalScale: new THREE.Vector2(0.6, 0.6) });
}

export const M = {
  paintWhite: std({ color: 0xf3f1ec, roughness: 0.92, normalMap: paintNormal, normalScale: new THREE.Vector2(0.08, 0.08) }),
  paintWhiteBack: std({ color: 0xf3f1ec, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
  ceilingWhite: std({ color: 0xf6f5f1, roughness: 0.95, side: THREE.FrontSide }),
  extWhite: std({ color: 0xf2f1ec, roughness: 0.88, normalMap: paintNormal, normalScale: new THREE.Vector2(0.15, 0.15) }),
  extWhiteDouble: std({ color: 0xf2f1ec, roughness: 0.88, side: THREE.DoubleSide }),
  soffit: std({ color: 0x1d1c1b, roughness: 0.8, side: THREE.BackSide }),
  shingles: shingleMat(),
  oakFloor: oakFloorMat(),
  // white-oak flat-panel interior doors (p15) and rift-sawn oak cabinetry (p08, p12)
  oakDoor: std({ ...pbrMaps('white_oak_veneer', '1k', { repeat: [0.8, 0.5] }), color: 0xffe2c2, roughness: 0.6, normalScale: new THREE.Vector2(0.3, 0.3) }),
  oakCabinet: std({ ...pbrMaps('white_oak_veneer', '1k', { repeat: [1, 1] }), color: 0xffe0bd, roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) }),
  blackMetal: std({ color: 0x141414, roughness: 0.45, metalness: 0.6 }),
  matteBlack: std({ color: 0x111111, roughness: 0.8 }),
  brass: std({ color: 0xc9a25a, roughness: 0.28, metalness: 1.0 }),
  brushedNickel: std({ color: 0xc8c6c2, roughness: 0.32, metalness: 1.0 }),
  chrome: std({ color: 0xffffff, roughness: 0.05, metalness: 1.0 }),
  // Window glass: thin, mostly transparent, reflective at grazing angles (cheap; no transmission pass).
  glass: phys({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.14, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1, ior: 1.5 }),
  garageDoor: std({ color: 0x2a2522, roughness: 0.55, metalness: 0.3 }),
  whiteQuartz: std({ color: 0xf4f2ee, roughness: 0.18 }),
  linenWhite: std({ color: 0xece6dc, roughness: 0.95 }),
  emissiveWarm: std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 3.0, roughness: 1 }),
};
export const MAT_NOTES = 'Reuse M.paintWhite for every painted wall so whites match house-wide.';
