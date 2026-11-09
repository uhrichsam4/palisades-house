// Natural Disasters — procedural WebAudio (no assets): warning siren, quake rumble, fire crackle, thunder, meteor
// whoosh / boom, wind howl. One AudioContext created on first use; everything stops at round end.
let AC = null, master = null, noiseBuf = null;
function ac() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination); } catch { AC = null; }
  if (AC) { const n = AC.sampleRate * 2; noiseBuf = AC.createBuffer(1, n, AC.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 * 0.6 + w * 0.4; } }
  return AC;
}
function noiseSrc() { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

// one-shot filtered noise burst (boom, thunder, crash)
export function burst({ dur = 1.2, freq = 300, gain = 0.5, q = 0.7, attack = 0.01, delay = 0 } = {}) {
  if (!ac()) return; try { AC.resume?.(); } catch {}
  const t = AC.currentTime + delay; const s = noiseSrc(); const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
export function siren(sec = 4) {
  if (!ac()) return; try { AC.resume?.(); } catch {}
  const t = AC.currentTime; const o = AC.createOscillator(); o.type = 'sawtooth'; const lfo = AC.createOscillator(); lfo.frequency.value = 0.45; const lg = AC.createGain(); lg.gain.value = 260;
  o.frequency.value = 820; lfo.connect(lg); lg.connect(o.frequency);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.3); g.gain.setValueAtTime(0.16, t + sec - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + sec + 0.05); lfo.stop(t + sec + 0.05);
}
// continuous beds: rumble (quake), crackle (fire), wind (blizzard/storm), water (flood)
const beds = {};
const BED = { rumble: ['lowpass', 90, 1.2], crackle: ['bandpass', 2400, 0.6], wind: ['bandpass', 520, 0.5], water: ['lowpass', 700, 0.4] };
export function bed(name, level) {
  if (level <= 0.001 && !beds[name]) return; if (!ac()) return;
  let b = beds[name];
  if (!b) { const [type, fr, q] = BED[name]; const s = noiseSrc(); const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q; const g = AC.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); b = beds[name] = { s, f, g, fr }; }
  const t = AC.currentTime; b.g.gain.setTargetAtTime(Math.max(0, level), t, 0.15);
  if (name === 'crackle' && level > 0.01 && Math.random() < 0.25) burst({ dur: 0.05 + Math.random() * 0.08, freq: 3000 + Math.random() * 3000, gain: level * 0.6, attack: 0.002 });
  if (name === 'wind') b.f.frequency.setTargetAtTime(380 + 300 * Math.sin(t * 0.7) + 120 * Math.sin(t * 2.3), t, 0.3);
}
export function stopAll() { for (const k of Object.keys(beds)) { try { beds[k].g.gain.setTargetAtTime(0, AC.currentTime, 0.2); const s = beds[k].s; setTimeout(() => { try { s.stop(); } catch {} }, 900); } catch {} delete beds[k]; } }
