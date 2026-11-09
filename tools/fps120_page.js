// page side of tools/fps120.mjs: walk a route (foyer -> family -> kitchen -> pool deck) on Ultra and record frames
(async () => {
  const raf = () => new Promise(r => requestAnimationFrame(r)), sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const q = window.__quality; await sleep(12000);
  const pl = window.__player, st = pl.state; st.thirdPerson = true;
  const route = [[9.8, 6.6], [9.8, 12.6], [7.0, 15.5], [5.0, 17.5], [11.0, 15.5], [17.5, 14.5], [17.5, 19.5], [16.0, 20.85], [14.5, 21.5], [18.0, 24.0], [12.0, 23.5], [9.8, 12.6]];
  const FL = window.__frameLog || { buf: new Float32Array(8192), n: 0 }, n0 = FL.n; const fr = []; const t0 = performance.now(); let wi = 1, segT = t0, last = performance.now(); const trace = [];
  pl.teleport(route[0][0], 0.05, route[0][1], Math.PI);
  while (performance.now() - t0 < 60000) {
    if (wi >= route.length) wi = 1;
    const [tx, tz] = route[wi], p = st.pos, dx = tx - p.x, dz = tz - p.z;
    if (Math.hypot(dx, dz) < 0.6) { wi++; segT = performance.now(); continue; }
    if (performance.now() - segT > 5000) { pl.teleport(tx, p.y, tz, st.yaw); wi++; segT = performance.now(); continue; }
    st.yaw = Math.atan2(-dx, -dz); st.pitch = -0.1; st.keys.add('KeyW');
    await raf(); const n = performance.now(); fr.push(n - last); last = n;
    if (fr.length % 60 === 0) trace.push([Math.round(n - t0), +q.scale.toFixed(2), q.stage, +(q.costMs || 0).toFixed(1)]);
  }
  st.keys.delete('KeyW');
  const loop = []; for (let i = Math.max(n0, FL.n - 8192); i < FL.n; i++) loop.push(FL.buf[i & 8191]);
  if (!loop.length) loop.push(...fr); const ls = loop.slice(Math.floor(loop.length * 0.4)).sort((a, b) => a - b), lavg = ls.reduce((a, b) => a + b, 0) / ls.length;
  const settled = fr.slice(Math.floor(fr.length * 0.4)).sort((a, b) => a - b);
  const avg = settled.reduce((a, b) => a + b, 0) / settled.length;
  return { loop: window.__loop?.mode, loopFrames: loop.length, loopAvgMs: +lavg.toFixed(2), loopP95Ms: +ls[Math.floor(ls.length * 0.95)].toFixed(2), loopFps: Math.round(1000 / lavg), tier: q.tier.name, hz: q.hz, targetMs: +(q.targetMs || 0).toFixed(2), frames: fr.length, settledAvgMs: +avg.toFixed(2), settledP95Ms: +settled[Math.floor(settled.length * 0.95)].toFixed(2), scale: +q.scale.toFixed(2), pixelRatio: +q.pixelRatio.toFixed(2), stage: q.stage, gpuMs: +(window.__gpuTimer?.ms || 0).toFixed(2), gpuTimer: !!window.__gpuTimer?.ok, peers: window.__mp?.peers?.size, trace: trace.filter((_, i) => i % 3 === 0) };
})()
