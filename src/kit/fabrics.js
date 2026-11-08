// Fabric & soft-material library (kit.fabric.*). Physically based: MeshPhysicalMaterial with sheen
// (Khronos KHR_materials_sheen semantics) over CC0 Poly Haven weave scans. The colour maps are
// neutral grey (assets/tex/fabric/*_grey.jpg), so `color` sets the true hue without shifting it.
//
//   kit.fabric.velvet('#4a5226')            olive velvet sofa
//   kit.fabric.boucle('#efe9df')            cream bouclé chair
//   kit.fabric.linen('#e8e1d6')             linen upholstery / drapes / bedding
//   kit.fabric.knit('#d9d2c7')              chunky knit throw
//   kit.fabric.cotton('#f4f1ec')            waffle/pintuck bedding, towels
//   kit.fabric.leather('#3a2a20')           leather recliner / chair
//   kit.fabric.sheer('#f3efe8')             sheer curtain (alpha, double-sided, no transmission pass)
// Every factory takes ({ scale, ... }) overrides: scale = texture repeats per UV unit (kit geometry
// UVs run 0..1 per face, so use ~2–4 for a sofa cushion, 6–10 for a big bed throw).
import * as THREE from 'three';
import { tex } from './textures.js';

const set = (id) => ({
  map: `assets/tex/fabric/${id}_grey.jpg`, normal: `assets/ph/${id}/${id}_nor_gl_1k.jpg`,
  rough: `assets/ph/${id}/${id}_rough_1k.jpg`, ao: `assets/ph/${id}/${id}_ao_1k.jpg`,
});
const SETS = {
  velvet: set('velour_velvet'), boucle: set('wool_boucle'), linen: set('rough_linen'),
  knit: set('knitted_fleece'), cotton: set('waffle_pique_cotton'), leather: set('brown_leather'),
};
// sheen colour: lighter, slightly desaturated version of the base, capped so it can't clip to white
function sheenOf(color, lift = 0.35, cap = 0.6) {
  const c = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), lift);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; if (l > cap) c.multiplyScalar(cap / l); return c;
}
function make(kind, color, base, o = {}) {
  const s = SETS[kind]; const rep = [o.scale ?? 3, o.scale ?? 3];
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    map: tex(s.map, { srgb: true, repeat: rep }), normalMap: tex(s.normal, { repeat: rep }),
    roughnessMap: tex(s.rough, { repeat: rep }), aoMap: tex(s.ao, { repeat: rep }), aoMapIntensity: o.ao ?? 0.8,
    ...base,
  });
  if (o.normalScale !== undefined) m.normalScale.set(o.normalScale, o.normalScale);
  for (const k of ['roughness', 'sheen', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness', 'side']) if (o[k] !== undefined) m[k] = o[k];
  if (o.sheenColor) m.sheenColor = new THREE.Color(o.sheenColor);
  m.name = 'fabric:' + kind; return m;
}

export const fabric = {
  velvet: (color = '#4a5226', o) => make('velvet', color, { roughness: 0.82, sheen: 1, sheenColor: sheenOf(color, 0.45), sheenRoughness: 0.42, normalScale: new THREE.Vector2(0.8, 0.8) }, o),
  boucle: (color = '#efe9df', o) => make('boucle', color, { roughness: 0.97, sheen: 0.65, sheenColor: sheenOf(color, 0.2), sheenRoughness: 0.9, normalScale: new THREE.Vector2(1.5, 1.5) }, { scale: 4, ...o }),
  linen: (color = '#e8e1d6', o) => make('linen', color, { roughness: 0.88, sheen: 0.3, sheenColor: sheenOf(color, 0.3), sheenRoughness: 0.8, normalScale: new THREE.Vector2(0.7, 0.7) }, o),
  knit: (color = '#d9d2c7', o) => make('knit', color, { roughness: 0.95, sheen: 0.45, sheenColor: sheenOf(color, 0.25), sheenRoughness: 0.85, normalScale: new THREE.Vector2(1.3, 1.3) }, { scale: 2, ...o }),
  cotton: (color = '#f4f1ec', o) => make('cotton', color, { roughness: 0.9, sheen: 0.25, sheenColor: sheenOf(color, 0.2), sheenRoughness: 0.8, normalScale: new THREE.Vector2(0.8, 0.8) }, o),
  leather: (color = '#3a2a20', o) => make('leather', color, { roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.35, normalScale: new THREE.Vector2(0.6, 0.6) }, { ao: 1, ...o }),
  sheer: (color = '#f3efe8', o = {}) => {
    const m = make('linen', color, { roughness: 0.9, sheen: 0.5, sheenColor: sheenOf(color, 0.4), sheenRoughness: 0.7, transparent: true, opacity: o.opacity ?? 0.38, side: THREE.DoubleSide, depthWrite: false }, { scale: 6, ...o });
    m.name = 'fabric:sheer'; return m;
  },
};
