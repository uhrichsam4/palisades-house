// Texture loading + caching + procedural canvas textures. All paths are relative to the site root.
import * as THREE from 'three';

export const manager = THREE.DefaultLoadingManager;
const loader = new THREE.TextureLoader(manager);
const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

// tex('assets/ph/x/x_diff_1k.jpg', { srgb: true, repeat: [u, v], rotation, offset })
// Textures are shared by path; repeat is applied on a CLONE so different materials can tile differently.
export function tex(path, opt = {}) {
  let base = cache.get(path);
  if (!base) {
    base = loader.load(path);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = maxAniso;
    cache.set(path, base);
  }
  const t = base.clone(); // clones share the image (one upload per source in r16x+ via source)
  t.colorSpace = opt.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  if (opt.offset) t.offset.set(opt.offset[0], opt.offset[1]);
  if (opt.rotation) { t.rotation = opt.rotation; t.center.set(0.5, 0.5); }
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

// Poly Haven PBR set: pbr('oak_veneer_01', '1k', { repeat:[2,2] }) -> { map, normalMap, roughnessMap, aoMap }
// Expects files from tools/ph.mjs: assets/ph/<id>/<id>_<map>_<res>.jpg
export function pbrMaps(id, res = '1k', opt = {}) {
  const p = m => `assets/ph/${id}/${id}_${m}_${res}.jpg`;
  const o = { map: tex(p('diff'), { ...opt, srgb: true }) };
  if (opt.normal !== false) o.normalMap = tex(p('nor_gl'), opt);
  if (opt.rough !== false) o.roughnessMap = tex(p('rough'), opt);
  if (opt.ao) o.aoMap = tex(p('ao'), opt);
  return o;
}

// Canvas 2D applies a filter to EVERY draw call. Pieces paint thousands of small shapes under
// g.filter = 'blur(..)', which on a CPU canvas took ~25 s for one rug. This wrapper collects everything drawn
// under a blur filter on a scratch layer and blurs that layer once when the filter changes (same look: blur
// is linear, shapes composite source-over inside the layer; a non-default composite op gets its own layer).
const STATE = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign', 'textBaseline', 'direction', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'lineDashOffset'];
function copyState(from, to) { for (const k of STATE) { try { to[k] = from[k]; } catch {} } to.setTransform(from.getTransform()); to.setLineDash(from.getLineDash()); }
export function deferredBlur(real, w, h) {
  let cur = real, layer = null, lf = 'none', lop = 'source-over', depth = 0;
  const flush = () => {
    if (!layer) return;
    const lc = cur; const op = lop; copyState(lc, real); // state set while drawing in the layer carries on
    real.save(); real.setTransform(1, 0, 0, 1, 0, 0); real.globalAlpha = 1; real.globalCompositeOperation = op; real.shadowColor = 'rgba(0,0,0,0)'; real.filter = lf;
    real.drawImage(layer, 0, 0); real.restore();
    layer = null; cur = real; depth = 0;
  };
  const start = (f) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const lc = c.getContext('2d', { willReadFrequently: true });
    copyState(real, lc); lop = real.globalCompositeOperation; lc.globalCompositeOperation = 'source-over';
    layer = c; lf = f; cur = lc; depth = 0;
  };
  const isBlur = (v) => typeof v === 'string' && /blur\(/.test(v) && !/blur\(\s*0(px)?\s*\)/.test(v);
  return new Proxy(real, {
    get(t, k) {
      if (k === '__flush') return flush;
      if (k === 'filter') return layer ? lf : real.filter;
      if (k === 'canvas') return real.canvas;
      if (k === 'globalCompositeOperation' && layer) return lop;
      const v = cur[k];
      if (typeof v !== 'function') return v;
      if (k === 'save') return () => { depth++; cur.save(); };
      if (k === 'restore') return () => { if (layer && depth === 0) { flush(); real.restore(); } else { depth = Math.max(0, depth - 1); cur.restore(); } };
      if (k === 'getImageData' || k === 'putImageData') return (...a) => { const f = layer ? lf : null; flush(); const r = real[k](...a); if (f) start(f); return r; };
      if (k === 'drawImage') return (img, ...a) => { if (layer && img === real.canvas) { const f = lf; flush(); start(f); } return cur.drawImage(img, ...a); };
      return v.bind(cur);
    },
    set(t, k, v) {
      if (k === 'filter') { if (layer) flush(); if (isBlur(v)) start(v); else real.filter = v; return true; }
      if (k === 'globalCompositeOperation' && layer) { if (v !== lop) { const f = lf; flush(); real.globalCompositeOperation = v; start(f); } return true; }
      cur[k] = v; return true;
    },
  });
}

// Canvas texture: canvasTex(512, 512, (g, w, h) => { ...draw... }, { srgb:true, repeat })
export function canvasTex(w, h, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  // CPU-backed 2D canvas: blur filters/heavy painting run on the CPU and can't hang Chrome's GPU process
  // (a GPU-canvas blur per stroke used to drop the WebGL context for the whole house).
  const real = c.getContext('2d', { willReadFrequently: true });
  const g = deferredBlur(real, w, h); draw(g, w, h); g.__flush(); real.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opt.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  return t;
}

// Small deterministic RNG so procedural textures look the same on every machine / screenshot.
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Tileable value-noise normal map (subtle surface texture for paint, plaster, leather...).
export function noiseNormal(size = 256, strength = 1.0, scale = 8, seed = 7) {
  const r = rng(seed); const n = scale; const grid = Array.from({ length: n * n }, () => r());
  const val = (x, y) => { const xi = Math.floor(x) % n, yi = Math.floor(y) % n, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const g = (i, j) => grid[((yi + j) % n) * n + ((xi + i) % n)]; const s = t => t * t * (3 - 2 * t);
    const a = g(0, 0) + (g(1, 0) - g(0, 0)) * s(xf), b = g(0, 1) + (g(1, 1) - g(0, 1)) * s(xf); return a + (b - a) * s(yf); };
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 1, f = 1; for (let o = 0; o < 4; o++) { v += amp * val((x / size) * n * f, (y / size) * n * f); amp *= 0.5; f *= 2; }
    hgt[y * size + x] = v;
  }
  return canvasTex(size, size, (g) => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = i => hgt[((y + size) % size) * size + ((i + size) % size)];
      const dx = (hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)]) * strength;
      const dy = (hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x]) * strength;
      const nz = 1 / Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
      img.data[i] = (-dx * nz * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy * nz * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}
