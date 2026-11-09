// Carving shell parts out of the MERGED shell meshes (src/building).
// shell.js tags every wall panel / opening fill with an integer code in uv1.x (see buildShell). The global merge keeps
// uv1, so here we can find exactly those triangles again and degenerate them (all three indices -> the first one).
// hide(code) / show(code) are cheap index-buffer edits on the few merged meshes involved; no draw calls are added.
export function createCarver(root) {
  let map = null; // code -> [{ mesh, tris: number[] (index offsets), saved: Uint32Array|null }]
  function build() {
    map = new Map();
    root.traverse((m) => {
      if (!m.isMesh) return; const g = m.geometry; const uv1 = g?.attributes?.uv1; if (!uv1 || !g.index) return;
      const idx = g.index.array; const lists = new Map();
      for (let t = 0; t < idx.length; t += 3) { const c = Math.round(uv1.getX(idx[t])); if (!c) continue; let l = lists.get(c); if (!l) lists.set(c, l = []); l.push(t); }
      for (const [c, l] of lists) { let arr = map.get(c); if (!arr) map.set(c, arr = []); arr.push({ mesh: m, tris: l, saved: null }); }
    });
  }
  function hide(code) {
    if (!map) build(); const L = map.get(code); if (!L) return 0; let n = 0;
    for (const e of L) {
      if (e.saved) continue; const ix = e.mesh.geometry.index; const a = ix.array;
      e.saved = new Uint32Array(e.tris.length * 3);
      e.tris.forEach((t, i) => { e.saved[i * 3] = a[t]; e.saved[i * 3 + 1] = a[t + 1]; e.saved[i * 3 + 2] = a[t + 2]; a[t + 1] = a[t]; a[t + 2] = a[t]; });
      ix.needsUpdate = true; n += e.tris.length;
    }
    return n;
  }
  function show(code) {
    if (!map) build(); const L = map.get(code); if (!L) return 0; let n = 0;
    for (const e of L) {
      if (!e.saved) continue; const ix = e.mesh.geometry.index; const a = ix.array;
      e.tris.forEach((t, i) => { a[t] = e.saved[i * 3]; a[t + 1] = e.saved[i * 3 + 1]; a[t + 2] = e.saved[i * 3 + 2]; });
      e.saved = null; ix.needsUpdate = true; n += e.tris.length;
    }
    return n;
  }
  return { hide, show, has: (code) => { if (!map) build(); return map.has(code); }, rebuild: () => { map = null; } };
}
