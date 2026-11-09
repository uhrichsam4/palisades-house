// One shared print atlas (2048 x 1024 canvas) for every printed surface the furnish module adds:
// book spines, food packaging, magazines, board games, screens, posters, photos, labels.
// All art is drawn procedurally here (no photos, no brands). cell(name) -> [u0, v0, u1, v1].
import * as THREE from 'three';

const W = 2048, H = 1024, C = 128;
const cells = {};
let tex = null;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export const SPINES = 64;
const SPINE_COLS = ['#1f2a44', '#e9e2d0', '#7a1f1f', '#2f4a36', '#151515', '#f4f1ea', '#c99a3c', '#6f7378', '#2d5c63', '#a8553a', '#d8c6a5', '#3b3550', '#b9b2a6', '#0f3d5e', '#8e8a3f', '#cfd6d8'];

function reg(name, x, y, w, h) { const pad = 2; cells[name] = [(x + pad) / W, 1 - (y + h - pad) / H, (x + w - pad) / W, 1 - (y + pad) / H]; }

function textLines(g, x, y, w, n, col, h = 3, gap = 6) { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(x, y + i * gap, w * (0.55 + ((i * 37) % 40) / 100), h); }

function draw(g) {
  const r = rng(77);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // ---- book spines (row 0-1): 64 x (32 x 256)
  for (let i = 0; i < SPINES; i++) {
    const x = i * 32; const base = SPINE_COLS[(i * 7 + (i >> 3)) % SPINE_COLS.length];
    g.fillStyle = base; g.fillRect(x, 0, 32, 256);
    const light = parseInt(base.slice(1, 3), 16) > 150;
    const ink = light ? '#1d1d1d' : (r() < 0.4 ? '#d9b45a' : '#f2efe6');
    // bands
    if (r() < 0.6) { g.fillStyle = ink; g.globalAlpha = 0.85; g.fillRect(x + 2, 18, 28, 3); g.fillRect(x + 2, 230, 28, 3); g.globalAlpha = 1; }
    if (r() < 0.35) { g.fillStyle = SPINE_COLS[(i * 3 + 5) % SPINE_COLS.length]; g.fillRect(x, 150, 32, 40); }
    // title (rotated text)
    g.save(); g.translate(x + 16, 128); g.rotate(-Math.PI / 2); g.fillStyle = ink; g.font = `${r() < 0.5 ? 'bold ' : ''}${13 + (r() * 5 | 0)}px Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = ['THE', 'SEA', 'HOUSE', 'LIGHT', 'CALIFORNIA', 'NORTH', 'GARDEN', 'STORIES', 'ATLAS', 'ART', 'MODERN', 'COAST', 'TIDE', 'FORM', 'NOTES', 'SUMMER'];
    g.fillText(words[i % 16] + (r() < 0.5 ? ' ' + words[(i * 5 + 3) % 16] : ''), -10, 0); g.font = '9px Arial'; g.fillText('— —', 85, 0); g.restore();
    // shading at the edges (rounded spine)
    const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = gr; g.fillRect(x, 0, 32, 256);
    reg('spine' + i, x, 0, 32, 256);
  }
  const at = (cx, cy, cw = 1, ch = 1) => [cx * C, 256 + cy * C, cw * C, ch * C];
  const box = (name, cx, cy, cw, ch, fn) => { const [x, y, w, h] = at(cx, cy, cw, ch); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); fn(w, h); g.restore(); reg(name, x, y, w, h); };
  const bg = (c) => (w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
  const title = (t, x, y, size, col, font = 'bold', align = 'center') => { g.fillStyle = col; g.font = `${font} ${size}px Helvetica, Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  // ---- row 0: packaging
  box('white', 0, 0, 1, 1, bg('#ffffff'));
  box('cereal1', 1, 0, 1, 1, (w, h) => { bg('#e7b52c')(w, h); g.fillStyle = '#b8322a'; g.fillRect(0, 0, w, 34); title('OAT O\'S', w / 2, 18, 20, '#fff'); g.fillStyle = '#f6f1e2'; g.beginPath(); g.ellipse(64, 86, 40, 26, 0, 0, 7); g.fill(); g.fillStyle = '#c98a3a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(40 + (i % 3) * 22, 72 + (i / 3 | 0) * 12, 6, 0, 7); g.fill(); } });
  box('cereal2', 2, 0, 1, 1, (w, h) => { bg('#2a5ea8')(w, h); title('CRUNCH', w / 2, 24, 22, '#fff'); title('honey', w / 2, 46, 14, '#ffd34d', 'italic'); g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(64, 92, 44, 22, 0, 0, 7); g.fill(); g.fillStyle = '#d9a44a'; for (let i = 0; i < 12; i++) g.fillRect(36 + (i % 4) * 14, 82 + (i / 4 | 0) * 7, 10, 5); });
  box('granola', 3, 0, 1, 1, (w, h) => { bg('#efe6d2')(w, h); g.fillStyle = '#6b8f4e'; g.fillRect(0, h - 40, w, 40); title('GRANOLA', w / 2, 30, 18, '#3c2a1a'); title('maple almond', w / 2, 52, 12, '#3c2a1a', 'normal'); });
  box('pasta', 4, 0, 1, 1, (w, h) => { bg('#1d3f8a')(w, h); g.fillStyle = '#fff'; g.fillRect(20, 30, 88, 60); title('PENNE', 64, 46, 16, '#1d3f8a'); g.fillStyle = '#e8c56d'; for (let i = 0; i < 8; i++) g.fillRect(28 + i * 9, 60, 6, 22); });
  box('crackers', 5, 0, 1, 1, (w, h) => { bg('#c4302b')(w, h); title('CRISPS', w / 2, 26, 18, '#fff'); g.fillStyle = '#e8c27a'; for (let i = 0; i < 3; i++) g.fillRect(18 + i * 34, 60, 28, 28); });
  box('cook1', 6, 0, 1, 1, (w, h) => { bg('#f3efe6')(w, h); g.fillStyle = '#5f7f5a'; g.beginPath(); g.arc(64, 70, 34, 0, 7); g.fill(); g.fillStyle = '#e46b3d'; g.beginPath(); g.arc(54, 62, 10, 0, 7); g.fill(); title('SALT & FIRE', 64, 18, 13, '#222'); });
  box('cook2', 7, 0, 1, 1, (w, h) => { bg('#20201f')(w, h); title('PLENTY', 64, 28, 20, '#f2efe6'); g.fillStyle = '#c9a25a'; g.fillRect(24, 50, 80, 2); g.fillStyle = '#7da35b'; g.beginPath(); g.ellipse(64, 88, 30, 18, 0, 0, 7); g.fill(); });
  for (let i = 0; i < 4; i++) box('mag' + i, 8 + i, 0, 1, 1, (w, h) => {
    const cols = ['#d9d4c7', '#9fb7c4', '#e8c9b5', '#1b1b1b'];
    bg(cols[i])(w, h); g.fillStyle = ['#7a6a55', '#2f4f5f', '#a35a3a', '#888'][i]; g.fillRect(16, 34, 96, 84);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(64, 72, 26, 0, 7); g.fill();
    title(['DWELL', 'COAST', 'VOGUE-ISH', 'ARCH'][i], 64, 16, 20, i === 3 ? '#fff' : '#111', 'bold');
  });
  for (let i = 0; i < 4; i++) box('game' + i, 12 + i, 0, 1, 1, (w, h) => {
    const cols = ['#c7352c', '#1d6e3a', '#2b4c9a', '#f0c23a'];
    bg(cols[i])(w, h); g.fillStyle = '#fff'; g.fillRect(10, 10, 108, 108); g.fillStyle = cols[i]; g.fillRect(16, 16, 96, 96);
    title(['CASTLES', 'TICKET', 'CATAN-ISH', 'UNO-ISH'][i], 64, 40, 15, '#fff'); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(30, 62, 68, 30);
  });
  // ---- row 1: labels
  box('pizza', 0, 1, 1, 1, (w, h) => { bg('#cdb38c')(w, h); g.strokeStyle = '#7a1d1a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.stroke(); title('HOT', 64, 56, 18, '#7a1d1a'); title('PIZZA', 64, 76, 16, '#7a1d1a'); });
  box('can1', 1, 1, 1, 1, (w, h) => { bg('#b62a24')(w, h); g.fillStyle = '#f1e9d4'; g.fillRect(0, 40, w, 50); title('TOMATO', 64, 65, 16, '#b62a24'); });
  box('can2', 2, 1, 1, 1, (w, h) => { bg('#3d6b34')(w, h); g.fillStyle = '#efe7cf'; g.fillRect(0, 44, w, 40); title('BEANS', 64, 64, 16, '#3d6b34'); });
  box('soda1', 3, 1, 1, 1, (w, h) => { bg('#c8102e')(w, h); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 80); g.bezierCurveTo(40, 50, 80, 110, 128, 70); g.stroke(); title('COLA', 64, 40, 22, '#fff', 'bold italic'); });
  box('soda2', 4, 1, 1, 1, (w, h) => { bg('#d7dde2')(w, h); g.fillStyle = '#2aa04a'; g.fillRect(0, 70, w, 20); title('LIME', 64, 40, 22, '#2aa04a'); });
  box('beer', 5, 1, 1, 1, (w, h) => { bg('#e9e4d8')(w, h); g.fillStyle = '#1b3f73'; g.fillRect(0, 0, w, 30); g.fillRect(0, h - 30, w, 30); title('PACIFIC', 64, 64, 18, '#1b3f73'); title('LAGER', 64, 84, 12, '#b8892c'); });
  box('energy', 6, 1, 1, 1, (w, h) => { bg('#111')(w, h); g.strokeStyle = '#6cf13a'; g.lineWidth = 6; g.beginPath(); g.moveTo(30, 20); g.lineTo(70, 60); g.lineTo(50, 66); g.lineTo(96, 110); g.stroke(); });
  box('detergent', 7, 1, 1, 1, (w, h) => { bg('#f47b20')(w, h); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill(); title('FRESH', 64, 64, 18, '#f47b20'); });
  box('chips', 8, 1, 1, 1, (w, h) => { bg('#f2c230')(w, h); g.fillStyle = '#c4302b'; g.fillRect(0, 20, w, 26); title('KETTLE', 64, 33, 16, '#fff'); g.fillStyle = '#e0a640'; g.beginPath(); g.ellipse(64, 88, 30, 18, 0.3, 0, 7); g.fill(); });
  box('popcorn', 9, 1, 1, 1, (w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#d42a2a'; g.fillRect(i * 16, 0, 16, h); } g.fillStyle = '#fff'; g.fillRect(24, 40, 80, 40); title('POPCORN', 64, 60, 14, '#d42a2a'); });
  box('carton', 10, 1, 1, 1, (w, h) => { bg('#b48a5a')(w, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(14, 20, 50, 4); g.fillRect(14, 30, 34, 4); title('THIS SIDE UP', 64, 100, 10, 'rgba(0,0,0,0.6)'); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeRect(84, 14, 28, 28); });
  box('tp', 11, 1, 1, 1, (w, h) => { bg('#f6f6f4')(w, h); g.fillStyle = '#4a8fd6'; g.fillRect(0, 0, w, 36); title('SOFT', 64, 18, 18, '#fff'); g.fillStyle = '#dfe9f4'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(30 + (i % 2) * 64, 64 + (i >> 1) * 38, 16, 0, 7); g.fill(); } });
  box('wine', 12, 1, 1, 1, (w, h) => { bg('#f1ebdc')(w, h); g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(10, 10, 108, 108); title('CHÂTEAU', 64, 50, 14, '#222', 'normal'); title('2019', 64, 76, 12, '#7a1d1a', 'normal'); });
  box('liquor', 13, 1, 1, 1, (w, h) => { bg('#111')(w, h); g.strokeStyle = '#c9a25a'; g.lineWidth = 3; g.strokeRect(14, 14, 100, 100); title('RESERVE', 64, 56, 16, '#c9a25a', 'normal'); title('No. 7', 64, 80, 12, '#c9a25a', 'normal'); });
  box('tequila', 14, 1, 1, 1, (w, h) => { bg('#e8e3d6')(w, h); g.fillStyle = '#2e6b5f'; g.beginPath(); g.moveTo(64, 20); g.lineTo(100, 64); g.lineTo(64, 108); g.lineTo(28, 64); g.fill(); title('AGAVE', 64, 64, 14, '#fff'); });
  box('sauce', 15, 1, 1, 1, (w, h) => { bg('#7a2b16')(w, h); g.fillStyle = '#f2e6c9'; g.beginPath(); g.ellipse(64, 64, 44, 30, 0, 0, 7); g.fill(); title('HOT', 64, 64, 18, '#7a2b16'); });
  // ---- rows 2: photos + small screens
  const photo = (seed, kind) => (w, h) => {
    const rr = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, kind ? '#8fb6d6' : '#f2c79a'); sky.addColorStop(0.55, kind ? '#d9e6ee' : '#f6e2c8'); sky.addColorStop(0.56, kind ? '#2f7da6' : '#4f86a6'); sky.addColorStop(1, kind ? '#e8dcc4' : '#2d5a7a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // people silhouettes (family photo)
    for (let i = 0; i < 2 + (rr() * 3 | 0); i++) { const x = 20 + i * 26 + rr() * 8, y = h * 0.62; g.fillStyle = ['#2b2b2b', '#efe8dc', '#5a3d2b', '#c45a3a'][(i + seed) % 4]; g.fillRect(x - 8, y, 16, h * 0.4); g.fillStyle = '#c99872'; g.beginPath(); g.arc(x, y - 7, 7, 0, 7); g.fill(); }
  };
  box('photo0', 0, 2, 1, 1, photo(3, 0)); box('photo1', 1, 2, 1, 1, photo(9, 1)); box('photo2', 2, 2, 1, 1, photo(14, 0));
  box('phone', 3, 2, 1, 1, (w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3a1c71'); gr.addColorStop(0.5, '#d76d77'); gr.addColorStop(1, '#ffaf7b'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 16; i++) g.fillRect(14 + (i % 4) * 26, 30 + (i >> 2) * 22, 14, 14); });
  box('laptop', 4, 2, 2, 1, (w, h) => { bg('#f7f7f7')(w, h); g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, 14); g.fillStyle = '#3b82f6'; g.fillRect(0, 14, 50, h); for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? '#cfd6dd' : '#8a96a3'; g.fillRect(64, 26 + i * 10, 100 + (i * 23) % 80, 5); } g.fillStyle = '#ffcf5c'; g.fillRect(180, 30, 60, 40); });
  box('monitor1', 6, 2, 2, 1, (w, h) => { bg('#1e1e1e')(w, h); const cols = ['#c586c0', '#9cdcfe', '#dcdcaa', '#4ec9b0', '#ce9178', '#6a9955']; for (let i = 0; i < 14; i++) { let x = 12 + ((i * 3) % 5) * 8; for (let k = 0; k < 3; k++) { const l = 14 + ((i * 7 + k * 13) % 40); g.fillStyle = cols[(i + k) % 6]; g.fillRect(x, 8 + i * 8, l, 4); x += l + 5; } } g.fillStyle = '#252526'; g.fillRect(0, 0, 10, h); });
  box('monitor2', 8, 2, 2, 1, (w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5aa7e8'); gr.addColorStop(0.6, '#bfe1f7'); gr.addColorStop(0.61, '#5b8f3a'); gr.addColorStop(1, '#3d6a26'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#7a6a5a'; g.beginPath(); g.moveTo(120, 78); g.lineTo(170, 30); g.lineTo(220, 78); g.fill(); g.fillStyle = '#fff'; g.fillRect(8, 8, 40, 6); g.fillStyle = '#e33'; g.fillRect(8, 18, 30, 4); g.fillStyle = '#222'; g.fillRect(118, 90, 20, 30); g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 64, 3, 0, 7); g.fill(); });
  box('keyboard', 10, 2, 2, 1, (w, h) => { bg('#121212')(w, h); for (let r2 = 0; r2 < 5; r2++) for (let k = 0; k < 15; k++) { const hue = (k * 24 + r2 * 30) % 360; g.fillStyle = `hsl(${hue},90%,60%)`; g.fillRect(6 + k * 16.5, 18 + r2 * 20, 14, 16); g.fillStyle = '#1b1b1b'; g.fillRect(8 + k * 16.5, 20 + r2 * 20, 10, 11); } });
  box('tablet', 12, 2, 1, 1, (w, h) => { bg('#fdfaf3')(w, h); textLines(g, 12, 16, 100, 13, '#55524c', 3, 8); });
  box('paper', 13, 2, 1, 1, (w, h) => { bg('#fbfaf6')(w, h); textLines(g, 14, 20, 96, 11, '#8a8a8a', 2, 9); g.fillStyle = '#c33'; g.fillRect(14, 8, 40, 5); });
  box('mail', 14, 2, 1, 1, (w, h) => { bg('#f3eee2')(w, h); g.fillStyle = '#9a9a9a'; g.fillRect(60, 60, 50, 4); g.fillRect(60, 70, 40, 4); g.fillRect(60, 80, 46, 4); g.fillStyle = '#b6403a'; g.fillRect(100, 10, 18, 22); });
  box('cash', 15, 2, 1, 1, (w, h) => { bg('#cfd8c4')(w, h); g.strokeStyle = '#4b6b47'; g.lineWidth = 3; g.strokeRect(6, 30, 116, 68); g.fillStyle = '#4b6b47'; g.beginPath(); g.ellipse(64, 64, 18, 24, 0, 0, 7); g.fill(); });
  // ---- rows 3-5 (y 640..1024): TV, posters, arcade
  box('tv', 0, 3, 4, 2.25, (w, h) => { // live sports frame: pitch + crowd + score bug
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2f3a'); gr.addColorStop(0.32, '#3a4150'); gr.addColorStop(0.33, '#3f8f3a'); gr.addColorStop(1, '#2f7a2c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const rr = rng(4); for (let i = 0; i < 900; i++) { g.fillStyle = ['#c33', '#eee', '#335', '#dd4', '#999'][i % 5]; g.fillRect(rr() * w, rr() * h * 0.3, 3, 3); }
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h * 0.33); g.lineTo(w / 2, h); g.stroke(); g.beginPath(); g.ellipse(w / 2, h * 0.7, 80, 40, 0, 0, 7); g.stroke();
    for (let i = 0; i < 10; i++) { g.fillStyle = i < 5 ? '#e8e8e8' : '#c22'; const x = 80 + rr() * (w - 160), y = h * 0.42 + rr() * h * 0.5; g.fillRect(x, y, 8, 22); }
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(24, 20, 180, 32); title('LAL  2  -  1  NYC', 114, 36, 16, '#fff', 'bold');
  });
  box('poster1', 4, 3, 2, 3, (w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff6b35'); gr.addColorStop(0.6, '#f7c59f'); gr.addColorStop(1, '#2b2d42'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffdd57'; g.beginPath(); g.arc(w / 2, h * 0.45, 60, 0, 7); g.fill(); g.fillStyle = '#2b2d42'; for (let i = 0; i < 6; i++) g.fillRect(i * 46, h * 0.62 - (i % 2) * 20, 40, h); title('SURF CLUB', w / 2, 40, 30, '#2b2d42'); });
  box('poster2', 6, 3, 2, 3, (w, h) => { bg('#111')(w, h); for (let i = 0; i < 9; i++) { g.strokeStyle = `hsl(${180 + i * 18},90%,60%)`; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h * 0.55, 20 + i * 12, Math.PI, 0); g.stroke(); } title('NEON', w / 2, 50, 36, '#f0f'); title('NIGHTS', w / 2, 90, 26, '#0ff'); });
  box('poster3', 8, 3, 2, 3, (w, h) => { bg('#e9e4d6')(w, h); g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(w / 2, h * 0.42, 70, 0, 7); g.fill(); g.fillStyle = '#c94f2d'; g.fillRect(40, h * 0.68, w - 80, 14); title('MOON', w / 2, h * 0.84, 30, '#1c1c1c'); });
  box('arcade', 10, 3, 2, 1.5, (w, h) => { bg('#05051a')(w, h); const rr = rng(8); for (let i = 0; i < 40; i++) { g.fillStyle = '#fff'; g.fillRect(rr() * w, rr() * h, 2, 2); } g.fillStyle = '#ff2e88'; for (let i = 0; i < 5; i++) for (let k = 0; k < 8; k++) g.fillRect(30 + k * 26, 20 + i * 16, 14, 8); g.fillStyle = '#3cf'; g.fillRect(w / 2 - 12, h - 30, 24, 12); title('HI 98420', w / 2, 10, 10, '#ff0'); });
  box('marquee', 10, 4.5, 2, 0.75, (w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff2e88'); gr.addColorStop(1, '#3a0ca3'); g.fillStyle = gr; g.fillRect(0, 0, w, h); title('GALAXY RAID', w / 2, h / 2, 26, '#ffe14d', 'bold italic'); });
  box('menu', 12, 3, 1, 1, (w, h) => { bg('#111')(w, h); title('SNACKS', 64, 20, 16, '#f5c84b'); textLines(g, 16, 40, 96, 8, '#ddd', 3, 10); });
  box('calendar', 13, 3, 1, 1, (w, h) => { bg('#fff')(w, h); g.fillStyle = '#d33'; g.fillRect(0, 0, w, 24); for (let i = 0; i < 35; i++) { g.strokeStyle = '#ccc'; g.strokeRect(6 + (i % 7) * 16.5, 30 + (i / 7 | 0) * 18, 16, 18); } g.fillStyle = '#36c'; g.fillRect(40, 50, 14, 8); g.fillRect(90, 86, 14, 8); });
  box('kids', 14, 3, 1, 1, (w, h) => { bg('#fffdf5')(w, h); g.strokeStyle = '#e44'; g.lineWidth = 5; g.beginPath(); g.arc(40, 40, 18, 0, 7); g.stroke(); g.strokeStyle = '#2a2'; g.beginPath(); g.moveTo(10, 110); g.lineTo(118, 110); g.stroke(); g.strokeStyle = '#36c'; g.strokeRect(60, 60, 40, 46); g.beginPath(); g.moveTo(56, 62); g.lineTo(80, 38); g.lineTo(104, 62); g.stroke(); });
  box('rugkids', 15, 3, 1, 1, (w, h) => { bg('#e9e3d8')(w, h); for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) if ((i + k) % 2) { g.fillStyle = '#cfc6b6'; g.fillRect(i * 16, k * 16, 16, 16); } });
  box('golf', 12, 4, 1, 1, (w, h) => { bg('#1f3d2b')(w, h); g.fillStyle = '#e8e2d0'; g.fillRect(0, 50, w, 26); title('PALISADES CC', 64, 63, 11, '#1f3d2b'); });
  box('sign', 13, 4, 1, 1, (w, h) => { bg('#f4f1ea')(w, h); title('GOOD', 64, 44, 26, '#222', 'bold'); title('VIBES', 64, 80, 26, '#222', 'bold'); });
  box('water', 14, 4, 1, 1, (w, h) => { bg('#dff1fb')(w, h); g.fillStyle = '#1e7fc2'; g.fillRect(0, 44, w, 40); title('SPRING', 64, 64, 16, '#fff'); });
  box('leds', 12, 5, 1, 1, (w, h) => { for (let x = 0; x < 100; x++) { g.fillStyle = `hsl(${x * 3.6},100%,58%)`; g.fillRect(x, 0, 1, h); } g.fillStyle = '#fff6e8'; g.fillRect(100, 0, 28, h); });
  box('dogfood', 15, 4, 1, 1, (w, h) => { bg('#2d5f3f')(w, h); g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(64, 70, 30, 0, 7); g.fill(); title('GOOD DOG', 64, 20, 14, '#fff'); });
}

export function atlasTexture() {
  if (tex) return tex;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  draw(cv.getContext('2d'));
  tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true; tex.name = 'furnish:atlas';
  return tex;
}
export function cell(name) { if (!cells[name]) { if (!tex) atlasTexture(); } return cells[name] || cells.white; }
