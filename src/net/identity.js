// Local player identity (name + hue), persisted in localStorage. Safe if storage is unavailable.
const ADJ = ['Misty', 'Glassy', 'Bubbly', 'Drizzly', 'Splashy', 'Rippled', 'Tidal', 'Dewy', 'Briny', 'Foamy'];
const NOUN = ['Drop', 'Puddle', 'Wave', 'Splash', 'Ripple', 'Brook', 'Pool', 'Spray', 'Tide', 'Bead'];
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let id = null;
export function identity() {
  if (id) return id;
  let name = get('ph.name'); let hue = parseFloat(get('ph.hue'));
  if (!name) { name = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)]; set('ph.name', name); }
  if (!Number.isFinite(hue)) { hue = Math.random(); set('ph.hue', String(hue)); }
  id = { name, hue };
  return id;
}
export function setName(n) { const i = identity(); i.name = String(n || '').slice(0, 24).trim() || i.name; set('ph.name', i.name); return i.name; }
export function setHue(h) { const i = identity(); i.hue = ((h % 1) + 1) % 1; set('ph.hue', String(i.hue)); return i.hue; }
