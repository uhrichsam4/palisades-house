// Procedural game sounds (WebAudio, no files): pool clacks / cushion thuds / pocket rattles / cue tip ticks and
// ping-pong paddle + table tocks. One shared AudioContext, created on the first user gesture; play() before that
// is silently dropped. Volume follows Settings (ph.settings.vol).
let ac = null, out = null, noise = null;
function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state !== 'running') ac.resume().catch(() => {});
  return ac;
}
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (!ac) try { ensure(); } catch {} }, { capture: true, once: true });
const vol = () => { try { const v = Number(JSON.parse(localStorage.getItem('ph.settings') || '{}').vol); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; } };
function blip(t, f, q, peak, dec, type = 'bandpass', tone = 0) {
  const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.2); s.stop(t + dec + 0.02);
  if (tone) { const o = ac.createOscillator(); o.frequency.value = tone; const g2 = ac.createGain(); g2.gain.setValueAtTime(peak * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + dec * 0.8); o.connect(g2).connect(out); o.start(t); o.stop(t + dec); }
}
// kind: 'ball' | 'cushion' | 'pocket' | 'cue' | 'paddle' | 'table' | 'net'; k = intensity 0..1; pan ignored (mono)
export function sfx(kind, k = 1) {
  if (!ac || ac.state !== 'running') { try { ensure(); } catch {} if (!ac || ac.state !== 'running') return; }
  const v = vol() * Math.max(0.05, Math.min(1, k)); if (v <= 0.01) return; const t = ac.currentTime + 0.005;
  if (kind === 'ball') blip(t, 3200 + Math.random() * 600, 4, 0.9 * v, 0.05, 'bandpass', 2600);
  else if (kind === 'cushion') blip(t, 260, 1.2, 0.7 * v, 0.09, 'lowpass');
  else if (kind === 'pocket') { blip(t, 900, 2, 0.6 * v, 0.08); blip(t + 0.07, 700, 2, 0.45 * v, 0.1); blip(t + 0.16, 500, 2, 0.35 * v, 0.14, 'lowpass'); }
  else if (kind === 'cue') blip(t, 2000, 3, 0.7 * v, 0.04, 'bandpass', 1500);
  else if (kind === 'paddle') blip(t, 1300, 5, 1.0 * v, 0.06, 'bandpass', 900);
  else if (kind === 'table') blip(t, 2400, 6, 0.8 * v, 0.045, 'bandpass', 1900);
  else if (kind === 'net') blip(t, 500, 1, 0.4 * v, 0.08, 'lowpass');
}
