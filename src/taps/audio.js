// Running-water sound for src/taps: procedural (one shared 3 s noise buffer with baked droplet ticks), per tap
// BufferSource -> bandpass (character) -> lowpass (muffling through walls) -> gain -> equal-power panner.
// Nodes exist only while a tap runs and the listener is within ~32 m. Loudness + muffling come from the speaker's
// ray occlusion (src/speaker/acoustics.js: distance falloff, x0.4 per wall, other storey x0.5), refreshed at 4 Hz.
const PRESET = {
  sink: { f: 2300, q: 0.8, hp: 350, gain: 0.32 },
  filler: { f: 1100, q: 0.7, hp: 160, gain: 0.55 },
  shower: { f: 3200, q: 0.45, hp: 250, gain: 0.62 },
  hand: { f: 3600, q: 0.5, hp: 300, gain: 0.45 },
};
let ac = null, buf = null, gestureHooked = false;

export function audioContext() { return ac; }
function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ac = new AC(); } catch { return null; }
    const n = Math.floor(ac.sampleRate * 3), d = new Float32Array(n);
    // pink-ish noise (Kellet) + sparse droplet ticks; the loop seam is cross-faded
    let b0 = 0, b1 = 0, b2 = 0, s = 987654321; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < n; i++) { const w = rnd(); b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    let env = 0; for (let i = 0; i < n; i++) { if (Math.random() < 0.0009) env = 0.5 + Math.random(); env *= 0.993; d[i] += rnd() * env * 0.12; }
    const xf = Math.floor(ac.sampleRate * 0.05); for (let i = 0; i < xf; i++) { const a = i / xf; d[i] = d[i] * a + d[n - xf + i] * (1 - a); }
    buf = ac.createBuffer(1, n, ac.sampleRate); buf.copyToChannel(d, 0);
  }
  if (!gestureHooked) {
    gestureHooked = true;
    const resume = () => { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); };
    addEventListener('pointerdown', resume, { capture: true, passive: true }); addEventListener('keydown', resume, { capture: true, passive: true });
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

// one voice per running tap; pos = [x,y,z] world
export function createVoice(kind, pos) {
  const P = PRESET[kind] || PRESET.sink;
  let nodes = null, target = 0, cut = 12000;
  const v = {
    get active() { return !!nodes && ac?.state === 'running'; },
    get nodes() { return !!nodes; },
    get gain() { return nodes ? nodes.g.gain.value : 0; },
    target: 0, walls: 0,
    start() {
      if (nodes || !ensure()) return;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.92 + Math.random() * 0.16;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.hp;
      const bp = ac.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = P.f; bp.Q.value = P.q; bp.gain.value = 9;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
      const g = ac.createGain(); g.gain.value = 0;
      const pan = ac.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0; pan.refDistance = 1;
      pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
      src.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(g); g.connect(pan); pan.connect(ac.destination);
      src.start(0, Math.random() * 2.5);
      nodes = { src, hp, bp, lp, g, pan };
      v.set(target, cut);
    },
    // gain 0..1 (already distance/occlusion-weighted), lowpass cutoff Hz
    set(gain, cutoff) {
      target = gain; cut = cutoff; v.target = gain;
      if (!nodes) return; const t = ac.currentTime;
      nodes.g.gain.setTargetAtTime(gain * P.gain, t, 0.12);
      nodes.lp.frequency.setTargetAtTime(cutoff, t, 0.15);
    },
    stop(fade = 0.3) {
      if (!nodes) return; const n = nodes; nodes = null;
      const t = ac.currentTime; n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0, t + fade);
      try { n.src.stop(t + fade + 0.05); } catch {}
      n.src.onended = () => { for (const k in n) { try { n[k].disconnect(); } catch {} } };
    },
  };
  return v;
}

// listener follows the camera (only called while some tap is audible)
export function setListener(cam) {
  if (!ac) return; const L = ac.listener; const e = cam.matrixWorld.elements;
  if (L.positionX) {
    L.positionX.value = e[12]; L.positionY.value = e[13]; L.positionZ.value = e[14];
    L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10];
    L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
  } else { L.setPosition(e[12], e[13], e[14]); L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
}
