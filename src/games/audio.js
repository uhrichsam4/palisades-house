// Built-in party beat for Musical Chairs: a WebAudio synth at 120 BPM (kick, clap, hats, bass, chord stabs).
// Generated live, no audio files. start() / stop(); the AudioContext is created on the first user gesture.
export function createBeat() {
  let ac = null, out = null, timer = 0, next = 0, step = 0, playing = false, noise = null;
  const ensure = () => {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    return ac;
  };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (playing || ac) ensure(); }, true);
  const vol = () => { try { const v = Number(JSON.parse(localStorage.getItem('ph.settings') || '{}').vol); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; } };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(g, t, 0.003, 0.9, 0.3); o.connect(g).connect(out); o.start(t); o.stop(t + 0.35); }
  function nz(t, f, type, peak, d) { const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ac.createGain(); env(g, t, 0.002, peak, d); s.connect(fl).connect(g).connect(out); s.start(t); s.stop(t + d + 0.05); }
  function tone(t, f, type, peak, d, cut) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; const g = ac.createGain(); env(g, t, 0.005, peak, d); o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); }
  const ROOT = [57, 53, 48, 55]; // A F C G (midi)
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function schedule() {
    const SP = 60 / 120 / 4; // 16th at 120 BPM
    while (next < ac.currentTime + 0.12) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, r = ROOT[bar];
      if (s % 4 === 0) kick(next);
      if (s === 4 || s === 12) nz(next, 1800, 'bandpass', 0.5, 0.16);
      if (s % 2 === 1) nz(next, 7000, 'highpass', 0.18, 0.05);
      if (s % 2 === 0) tone(next, hz(r - 24 + (s % 8 === 6 ? 12 : 0)), 'sawtooth', 0.32, 0.18, 700);
      if (s === 2 || s === 10) for (const iv of [0, r === 57 ? 3 : 4, 7]) tone(next, hz(r + iv), 'triangle', 0.09, 0.22, 3000);
      next += SP; step++;
    }
  }
  return {
    start() { if (playing) return; playing = true; if (!ensure()) return; out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0.55 * vol(), ac.currentTime, 0.02); next = ac.currentTime + 0.05; step = 0; clearInterval(timer); timer = setInterval(() => { if (ac.state === 'running') schedule(); }, 25); },
    stop() { if (!playing) return; playing = false; clearInterval(timer); if (ac) { out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0, ac.currentTime, 0.015); } },
    get playing() { return playing; }, get state() { return ac ? ac.state : 'none'; },
  };
}
