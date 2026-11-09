// Player settings (localStorage 'ph.settings'): graphics quality, FPS readout, mouse sensitivity, volume.
// Volume reaches WebAudio (any AudioContext made after this module loads routes its destination through a
// gain node) and every <video>/<audio> element when it starts playing.
const KEY = 'ph.settings';
const DEF = { quality: 'auto', fps: false, fpsCap: 'uncapped', sens: 1, vol: 1, theme: 'dark' }; // fpsCap: '60' | '120' | 'uncapped' (frame rate; 'fps' is the FPS-chip toggle)
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const fns = new Set();
const gains = new Set();

// ---- volume plumbing
{
  const Base = window.AudioContext || window.webkitAudioContext;
  const desc = Base && Object.getOwnPropertyDescriptor(window.BaseAudioContext?.prototype || Base.prototype, 'destination');
  if (Base && desc?.get) {
    class VolAudioContext extends Base {
      get destination() {
        if (!this.__vol) { const g = this.createGain(); g.gain.value = S.vol; g.connect(desc.get.call(this)); this.__vol = g; gains.add(g); }
        return this.__vol;
      }
    }
    window.AudioContext = VolAudioContext; if (window.webkitAudioContext) window.webkitAudioContext = VolAudioContext;
  }
  document.addEventListener('play', (e) => { const m = e.target; if (m && 'volume' in m) { try { m.volume = Math.max(0, Math.min(1, S.vol)); } catch {} } }, true);
}

export const settings = {
  get: () => ({ ...S }),
  set(patch) {
    Object.assign(S, patch);
    S.sens = Math.min(3, Math.max(0.2, Number(S.sens) || 1)); S.vol = Math.min(1, Math.max(0, Number(S.vol)));
    if (!Number.isFinite(S.vol)) S.vol = 1;
    if (S.theme !== 'light') S.theme = 'dark';
    if (!['60', '120', 'uncapped'].includes(String(S.fpsCap))) S.fpsCap = 'uncapped'; S.fpsCap = String(S.fpsCap);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    for (const g of gains) { try { g.gain.value = S.vol; } catch {} }
    for (const m of document.querySelectorAll('video,audio')) { try { m.volume = S.vol; } catch {} }
    for (const f of fns) { try { f(S); } catch (e) { console.warn('[settings]', e); } }
  },
  onChange(fn) { fns.add(fn); },
};
