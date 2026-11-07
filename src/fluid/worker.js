// Module worker: runs one CreatureSim per worker (see sim.js). Ping-pong protocol with creature.js:
//   main -> {type:'init', opts}            worker -> {type:'ready', info}
//   main -> {type:'step', ...input}        worker -> {type:'out', ...output}  (typed arrays transferred)
import { CreatureSim } from './sim.js';
let sim = null;
self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') { sim = new CreatureSim(m.opts); self.postMessage({ type: 'ready', info: sim.info }); }
    else if (m.type === 'step' && sim) {
      const t0 = performance.now(); const out = sim.step(m); out.type = 'out'; out.ms = performance.now() - t0;
      self.postMessage(out, [out.pos.buffer, out.nrm.buffer, out.idx.buffer, out.drops.buffer]);
    }
  } catch (err) { self.postMessage({ type: 'error', message: String(err && err.stack || err) }); }
};
