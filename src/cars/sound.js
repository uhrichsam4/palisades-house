// Procedural car audio (WebAudio, no files). One voice per audible car:
//   engine = two detuned saws + a sub square through a waveshaper and a low-pass, pitch/volume from rpm + throttle;
//   skid   = looped noise through a band-pass, volume from tyre slip;  horn = two square tones (~410/520 Hz).
// Spatial: distance roll-off + stereo pan from the camera's right vector (cheap, no PannerNode HRTF).
// The context is created lazily on the first use (a key press = user gesture).
let AC = null, master = null, noiseBuf = null;
function ac() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return AC; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return AC;
}
function curve() { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 2.2); } return c; }

export function createVoice(kind = 'super') {
  const a = ac(); if (!a) return null;
  const T = { super: { base: 70, span: 300, cut: 2600, vol: 0.32 }, suv: { base: 48, span: 170, cut: 1500, vol: 0.30 }, sedan: { base: 55, span: 210, cut: 1900, vol: 0.28 }, truck: { base: 120, span: 420, cut: 900, vol: 0.16 } }[kind] || { base: 60, span: 220, cut: 1800, vol: 0.3 };
  const out = a.createGain(); out.gain.value = 0; const pan = a.createStereoPanner(); out.connect(pan); pan.connect(master);
  const eng = a.createGain(); eng.gain.value = 0; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = T.cut; lp.Q.value = 0.8;
  const ws = a.createWaveShaper(); ws.curve = curve(); eng.connect(ws); ws.connect(lp); lp.connect(out);
  const oscs = [];
  const mk = (type, mul, g) => { const o = a.createOscillator(); o.type = type; const gg = a.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(eng); o.start(); oscs.push([o, mul]); };
  if (kind === 'truck') { mk('sine', 1, 0.5); mk('triangle', 2.01, 0.25); } // electric: motor whine
  else { mk('sawtooth', 1, 0.35); mk('sawtooth', 1.007, 0.3); mk('square', 0.5, 0.35); }
  const sk = a.createBufferSource(); sk.buffer = noiseBuf; sk.loop = true; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2.5;
  const skg = a.createGain(); skg.gain.value = 0; sk.connect(bp); bp.connect(skg); skg.connect(out); sk.start();
  let horn = null;
  const v = {
    // rpm 0..1, thr 0..1, slip 0..1, dist m, panX -1..1
    set(rpm, thr, slip, dist, panX, on = true) {
      const t = a.currentTime, k = on ? 1 / (1 + Math.max(0, dist - 3) / 7) : 0;
      out.gain.setTargetAtTime(k, t, 0.08); pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, panX)) * 0.8, t, 0.05);
      const f = T.base + T.span * rpm;
      for (const [o, mul] of oscs) o.frequency.setTargetAtTime(f * mul, t, 0.04);
      eng.gain.setTargetAtTime(T.vol * (0.35 + 0.65 * thr) * (0.6 + 0.4 * rpm), t, 0.06);
      lp.frequency.setTargetAtTime(T.cut * (0.6 + 0.8 * thr), t, 0.08);
      skg.gain.setTargetAtTime(Math.min(0.5, slip * 0.5), t, 0.05);
    },
    horn(on) {
      if (on && !horn) { const g = a.createGain(); g.gain.value = 0; const l = a.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = 2200; g.connect(l); l.connect(out);
        const os = [410, 518].map(f => { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(); return o; });
        g.gain.setTargetAtTime(0.16, a.currentTime, 0.01); horn = { g, os }; out.gain.setTargetAtTime(Math.max(out.gain.value, 0.3), a.currentTime, 0.02); }
      else if (!on && horn) { const h = horn; horn = null; h.g.gain.setTargetAtTime(0, a.currentTime, 0.03); setTimeout(() => h.os.forEach(o => { try { o.stop(); } catch {} }), 300); }
    },
    get horning() { return !!horn; },
    stop() { v.horn(false); out.gain.setTargetAtTime(0, a.currentTime, 0.1); setTimeout(() => { for (const [o] of oscs) { try { o.stop(); } catch {} } try { sk.stop(); } catch {} out.disconnect(); }, 400); },
  };
  return v;
}
export const audioReady = () => !!AC;
