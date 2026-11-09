// Player settings (localStorage 'ph.settings'): graphics quality, FPS readout, mouse sensitivity, volume.
// Volume reaches WebAudio (any AudioContext made after this module loads routes its destination through a
// gain node) and every <video>/<audio> element when it starts playing.
const KEY = 'ph.settings';
const DEF = { quality: 'auto', fps: false, fpsCap: 'uncapped', sens: 1, vol: 1, theme: 'dark', // fpsCap: '60' | '120' | 'uncapped' (frame rate; 'fps' is the FPS-chip toggle)
  // VIDEO (Settings > VIDEO; meanings in src/perf.js PRESETS). quality = preset: auto|low|medium|high|ultra|max|custom;
  // the individual controls below always hold the effective values (a preset writes them all). base = the tier a
  // 'custom' set was derived from. weatherDetail is read by the sky module straight from ph.settings.
  base: 'high', res: 'auto', shadows: 'high', ao: 'half', bloom: 'on', aa: 'smaa', weatherDetail: 'high', treeDetail: 'medium', viewDist: 'far', fov: 70,
  shafts: 'off', grass: 'high', film: 'neutral' }; // src/look: light shafts + dust, lawn grass, AgX + LUT film look
const ONE = { quality: ['auto', 'low', 'medium', 'high', 'ultra', 'max', 'custom'], base: ['low', 'medium', 'high', 'ultra'], shadows: ['off', 'low', 'high', 'ultra'], ao: ['off', 'half', 'full'], bloom: ['on', 'off'], aa: ['off', 'fxaa', 'smaa'],
  weatherDetail: ['low', 'high'], treeDetail: ['low', 'medium', 'high'], viewDist: ['near', 'far'], shafts: ['off', 'on'], grass: ['off', 'low', 'high'], film: ['neutral', 'agx'] };
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
    for (const [k, ok] of Object.entries(ONE)) if (!ok.includes(String(S[k]))) S[k] = DEF[k]; else S[k] = String(S[k]);
    if (S.res !== 'auto') { const r = Math.round(Number(S.res)); S.res = Number.isFinite(r) ? Math.min(200, Math.max(50, r)) : 'auto'; }
    S.fov = Math.min(100, Math.max(60, Math.round(Number(S.fov) || 70)));
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    for (const g of gains) { try { g.gain.value = S.vol; } catch {} }
    for (const m of document.querySelectorAll('video,audio')) { try { m.volume = S.vol; } catch {} }
    for (const f of fns) { try { f(S); } catch (e) { console.warn('[settings]', e); } }
  },
  onChange(fn) { fns.add(fn); },
};
