// Weather ambience, all procedural WebAudio (no files): rain hiss, wind roar with gusts, thunder claps/rumbles.
// Indoors everything goes through a low-pass and drops in level. Created on the first user gesture (autoplay
// rules); levels are set a few times a second, never per frame.
export function createWeatherAudio() {
  let ac = null, nodes = null, noiseBuf = null;
  function init() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const len = ac.sampleRate * 3; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } // pinkish
    const src = (rate = 1) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s; };
    const master = ac.createGain(); master.gain.value = 0.7;
    const room = ac.createBiquadFilter(); room.type = 'lowpass'; room.frequency.value = 18000; room.Q.value = 0.4;
    room.connect(master); master.connect(ac.destination);
    // rain: bright hiss + a lower patter layer
    const rHi = ac.createBiquadFilter(); rHi.type = 'highpass'; rHi.frequency.value = 900;
    const rG = ac.createGain(); rG.gain.value = 0; src(1.0).connect(rHi); rHi.connect(rG); rG.connect(room);
    const rLo = ac.createBiquadFilter(); rLo.type = 'bandpass'; rLo.frequency.value = 350; rLo.Q.value = 0.6;
    const rG2 = ac.createGain(); rG2.gain.value = 0; src(0.7).connect(rLo); rLo.connect(rG2); rG2.connect(room);
    // wind
    const wLp = ac.createBiquadFilter(); wLp.type = 'lowpass'; wLp.frequency.value = 380; wLp.Q.value = 2.5;
    const wG = ac.createGain(); wG.gain.value = 0; src(0.45).connect(wLp); wLp.connect(wG); wG.connect(room);
    nodes = { master, room, rG, rG2, wG, wLp };
    window.__skyAudio = ac;
  }
  const gesture = () => { init(); if (ac?.state === 'suspended') ac.resume().catch(() => {}); };
  addEventListener('pointerdown', gesture, { capture: true }); addEventListener('keydown', gesture, { capture: true });
  let gustT = 0;
  return {
    // rain 0..1, wind 0..1, indoor 0..1 (smoothed by the caller)
    set(rain, wind, indoor, dt) {
      if (!nodes || ac.state !== 'running') return;
      const t = ac.currentTime; gustT += dt;
      const gust = 0.65 + 0.35 * Math.sin(gustT * 0.7) * Math.sin(gustT * 0.23 + 1.3);
      const out = 1 - indoor * 0.65;
      nodes.rG.gain.setTargetAtTime(rain * 0.32 * out, t, 0.6);
      nodes.rG2.gain.setTargetAtTime(rain * 0.22 * out, t, 0.6);
      nodes.wG.gain.setTargetAtTime(Math.max(0, wind - 0.1) * 0.5 * gust * out, t, 0.8);
      nodes.wLp.frequency.setTargetAtTime(220 + 500 * wind * gust, t, 0.8);
      nodes.room.frequency.setTargetAtTime(indoor > 0.5 ? 900 : 18000, t, 0.3);
    },
    // distance 0..1 (0 = right overhead: sharp crack; 1 = far rumble)
    thunder(dist, indoor) {
      if (!ac || ac.state !== 'running') return;
      const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.35 + 0.25 * (1 - dist);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(dist < 0.3 ? 2500 : 600, t); lp.frequency.exponentialRampToValueAtTime(90, t + 3.5);
      const g = ac.createGain(); const peak = (1.6 - dist) * 0.9 * (1 - indoor * 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.04 + dist * 0.4);
      g.gain.setTargetAtTime(peak * 0.5, t + 0.5, 0.4); g.gain.setTargetAtTime(0.0001, t + 1.5, 1.2);
      s.connect(lp); lp.connect(g); g.connect(nodes.room); s.start(t, Math.random() * 2); s.stop(t + 7);
    },
  };
}
