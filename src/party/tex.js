// Party textures, all canvas-generated (no downloads): the stylised "100" note (NOT a copy of real US
// currency: fictional "Palisades Reserve" note, no seal/treasury text, made-up portrait silhouette), the
// banded cash-stack atlas, a soft radial dot (disco sparkles, wall washes, bulb glow) and confetti.
import * as THREE from 'three';

let maxAniso = 8;
export function setAniso(a) { maxAniso = a || 8; }
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- bill art (drawn into any 2D context box)
function drawBill(g, x, y, w, h, seed = 7) {
  const r = rng(seed);
  g.save(); g.translate(x, y);
  // paper: pale green-grey with a soft centre
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#d5e2c6'); bg.addColorStop(0.5, '#e4ead6'); bg.addColorStop(1, '#cbdcbc');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // fine fibre noise
  for (let i = 0; i < w * h / 60; i++) { g.fillStyle = `rgba(${60 + r() * 40},${110 + r() * 40},${70 + r() * 30},${0.05 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  const ink = '#2f5a3a', ink2 = '#4c7a52', inkL = 'rgba(47,90,58,.35)';
  // outer frame + guilloche border band
  const m = h * 0.07;
  g.strokeStyle = ink; g.lineWidth = h * 0.012; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
  g.strokeRect(m * 1.9, m * 1.9, w - 3.8 * m, h - 3.8 * m);
  g.lineWidth = 1; g.strokeStyle = inkL;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    const yy = (t) => m * 1.45 + Math.sin(t * 0.09 + k * 2.1) * m * 0.38;
    for (let t = 0; t <= w - 2 * m; t += 2) { const px = m + t; if (t === 0) g.moveTo(px, yy(t)); else g.lineTo(px, yy(t)); }
    g.stroke(); g.beginPath();
    for (let t = 0; t <= w - 2 * m; t += 2) { const px = m + t; const py = h - yy(t); if (t === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  }
  // rosettes (guilloche) left + right
  const ros = (cx, cy, R) => {
    g.strokeStyle = 'rgba(47,90,58,.45)'; g.lineWidth = 1;
    for (let k = 0; k < 10; k++) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.03) { const rr = R * (0.62 + 0.38 * Math.cos(7 * a + k * 0.63)); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    }
  };
  ros(w * 0.2, h * 0.52, h * 0.27); ros(w * 0.8, h * 0.52, h * 0.27);
  // central oval with a portrait silhouette (fictional: a top-hatted figure)
  const cx = w * 0.5, cy = h * 0.52, ow = h * 0.3, oh = h * 0.36;
  g.save(); g.beginPath(); g.ellipse(cx, cy, ow, oh, 0, 0, Math.PI * 2); g.clip();
  const og = g.createRadialGradient(cx, cy, 2, cx, cy, oh); og.addColorStop(0, '#e9eedd'); og.addColorStop(1, '#a9c39c'); g.fillStyle = og; g.fillRect(cx - ow, cy - oh, ow * 2, oh * 2);
  for (let i = -oh; i < oh; i += 3) { g.strokeStyle = 'rgba(47,90,58,.18)'; g.beginPath(); g.moveTo(cx - ow, cy + i); g.lineTo(cx + ow, cy + i); g.stroke(); }
  g.fillStyle = ink;
  g.beginPath(); g.ellipse(cx, cy - oh * 0.12, ow * 0.34, oh * 0.32, 0, 0, Math.PI * 2); g.fill();          // head
  g.fillRect(cx - ow * 0.36, cy - oh * 0.72, ow * 0.72, oh * 0.32); g.fillRect(cx - ow * 0.55, cy - oh * 0.44, ow * 1.1, oh * 0.07); // top hat
  g.beginPath(); g.ellipse(cx, cy + oh * 0.95, ow * 0.95, oh * 0.62, 0, Math.PI, Math.PI * 2); g.fill();     // shoulders
  g.restore();
  g.strokeStyle = ink; g.lineWidth = h * 0.014; g.beginPath(); g.ellipse(cx, cy, ow, oh, 0, 0, Math.PI * 2); g.stroke();
  // denominations
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(h * 0.2)}px Georgia, "Times New Roman", serif`;
  g.fillText('100', w * 0.13, h * 0.24); g.fillText('100', w * 0.87, h * 0.8);
  g.font = `900 ${Math.round(h * 0.15)}px Georgia, serif`; g.fillText('100', w * 0.87, h * 0.24); g.fillText('100', w * 0.13, h * 0.8);
  g.fillStyle = ink2; g.font = `700 ${Math.round(h * 0.34)}px Georgia, serif`; g.fillText('$', w * 0.2, h * 0.54); g.fillText('$', w * 0.8, h * 0.54);
  g.fillStyle = ink; g.font = `700 ${Math.round(h * 0.085)}px Georgia, serif`;
  g.fillText('THE PALISADES RESERVE', w * 0.5, h * 0.12);
  g.font = `600 ${Math.round(h * 0.06)}px Georgia, serif`; g.fillText('ONE HUNDRED PARTY DOLLARS', w * 0.5, h * 0.92);
  // serial numbers (fictional format)
  const ser = 'PH ' + String(Math.floor(r() * 9e7 + 1e7)) + ' $';
  g.fillStyle = '#6b8f3a'; g.font = `600 ${Math.round(h * 0.06)}px "Courier New", monospace`;
  g.fillText(ser, w * 0.3, h * 0.33); g.fillText(ser, w * 0.7, h * 0.72);
  g.restore();
}

// Single note texture (front and back look the same: the material is double-sided)
let billTex = null;
export function billTexture() {
  if (billTex) return billTex;
  billTex = canvasTex(512, 216, (g, w, h) => drawBill(g, 0, 0, w, h, 11));
  return billTex;
}

// Cash-stack atlas (512x512): [0..1]x[.5..1] top face (note + band), [0..1]x[.25..5] long side (paper edges +
// band), [0..1]x[0..25] short end (paper edges). Box: x = length, y = height, z = width.
export const STACK_UV = { top: [0, 0.5, 1, 1], side: [0, 0.25, 1, 0.5], end: [0, 0, 1, 0.25] };
let stackTex = null;
export function stackAtlas() {
  if (stackTex) return stackTex;
  stackTex = canvasTex(1024, 1024, (g, w, h) => {
    const r = rng(5);
    // top: note
    drawBill(g, 0, 0, w, h / 2, 3);
    const band = (x0, y0, bw, bh, label) => {
      const bgc = g.createLinearGradient(0, y0, 0, y0 + bh); bgc.addColorStop(0, '#b98a2c'); bgc.addColorStop(0.5, '#e2b85a'); bgc.addColorStop(1, '#b0832a');
      g.fillStyle = bgc; g.fillRect(x0, y0, bw, bh);
      if (label) { g.save(); g.translate(x0 + bw / 2, y0 + bh / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#5a3d0c'; g.font = `800 ${Math.round(bw * 0.42)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$10,000', 0, 0); g.restore(); }
    };
    band(w * 0.44, 0, w * 0.12, h / 2, true);
    // side + end: paper edges (tight stripes, slightly uneven)
    const edges = (y0, y1) => {
      g.fillStyle = '#dfe6d2'; g.fillRect(0, y0, w, y1 - y0);
      for (let y = y0; y < y1; y += 2.2 + r() * 1.6) { g.fillStyle = `rgba(${90 + r() * 40},${120 + r() * 40},${90 + r() * 30},${0.25 + r() * 0.35})`; g.fillRect(0, y, w, 1); }
      g.fillStyle = 'rgba(70,100,70,.35)'; g.fillRect(0, y0, w, 3); g.fillRect(0, y1 - 3, w, 3);
    };
    edges(h * 0.5, h * 0.75); edges(h * 0.75, h);
    band(w * 0.44, h * 0.5, w * 0.12, h * 0.25, false);
  });
  stackTex.flipY = true;
  return stackTex;
}

// soft radial dot (white): sparkles, glows, wall washes (use with AdditiveBlending, colour per material/vertex)
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  dotTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return dotTex;
}
// vertical wall-wash gradient for LED uplights (bright at the bottom, fading up and to the sides)
let washTex = null;
export function washTexture() {
  if (washTex) return washTex;
  washTex = canvasTex(128, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w - 0.5, v = 1 - (y + 0.5) / h; // v=0 bottom
      const spread = 0.12 + v * 0.38; const a = Math.exp(-(u * u) / (2 * spread * spread * 0.25)) * Math.pow(1 - v, 1.3) * Math.min(1, v * 12);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * Math.min(1, a));
    }
    g.putImageData(img, 0, 0);
  });
  return washTex;
}
