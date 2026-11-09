// "Nothing pokes into a room it doesn't belong to": every vertex of every mesh (instanced meshes per instance) is tested
// against the interior volume of every room NOT owned by that mesh's piece (rect inset by MARGIN, floor..ceiling).
// Usage: SHOT_SLOTS=1 node tools/eval_page.mjs tools/intrude_probe.js --solo
(async () => {
  const THREE = await import('three');
  const P = await import('/src/plan.js');
  const PIECES = ['bedA', 'bedB', 'bedC', 'dining', 'exterior', 'family', 'foyer', 'game', 'kitchen', 'living', 'pool', 'primary', 'primarybath', 'service', 'site', 'theater'];
  const owns = {};
  for (const n of PIECES) { try { const m = await import(`/src/rooms/${n}.js`); owns[n] = new Set(m.piece?.rooms || []); } catch (e) { owns[n] = new Set(); } }
  await new Promise(r => setTimeout(r, 3000));
  const { scene } = window.__dbg; scene.updateMatrixWorld(true);
  const MARGIN = 0.18;
  const rooms = Object.entries(P.ROOMS).filter(([, r]) => !r.outdoor).map(([id, r]) => { const y0 = r.level === 1 ? 3.35 : 0; return { id, x0: r.rect[0] + MARGIN, z0: r.rect[1] + MARGIN, x1: r.rect[2] - MARGIN, z1: r.rect[3] - MARGIN, y0: y0 + 0.08, y1: y0 + (r.level === 1 ? 5.4 : 2.9) }; });
  const pieceOf = (o) => { for (let p = o; p; p = p.parent) { const m = /^piece:(.+)$/.exec(p.name || ''); if (m) return m[1]; if (p.name === 'shell') return 'shell'; } return null; };
  const hits = new Map(); const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), mi = new THREE.Matrix4();
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    let pc = pieceOf(o); if (!pc) return; if (pc === 'shell') { if (!/soffit|fascia|eave|roof|rafter/i.test(o.name || '')) return; pc = 'shell-roof'; }
    if (o.userData?.pool || /water|rain|snow|fx|particle/i.test(o.name || '')) return;
    const own = owns[pc] || new Set(); const pos = o.geometry.attributes.position; const n = pos.count;
    const step = Math.max(1, Math.floor(n / 6000));
    const count = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < count; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m4.multiplyMatrices(o.matrixWorld, mi); } else m4.copy(o.matrixWorld);
      for (let i = 0; i < n; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4);
        for (const r of rooms) {
          if (own.has(r.id)) continue;
          if (v.x > r.x0 && v.x < r.x1 && v.z > r.z0 && v.z < r.z1 && v.y > r.y0 && v.y < r.y1) {
            const key = pc + ' -> ' + r.id + ' | ' + (o.name || o.parent?.name || o.type) + (o.isInstancedMesh ? '#' + k : '');
            let h = hits.get(key); if (!h) { h = { n: 0, sx: 0, sy: 0, sz: 0, mat: (Array.isArray(o.material) ? o.material[0] : o.material)?.name || o.material?.type }; hits.set(key, h); }
            h.n++; h.sx += v.x; h.sy += v.y; h.sz += v.z; break;
          }
        }
      }
    }
  });
  return [...hits.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40).map(([k, h]) => `${k} : ${h.n} verts @ ${(h.sx / h.n).toFixed(2)},${(h.sy / h.n).toFixed(2)},${(h.sz / h.n).toFixed(2)} [${h.mat}]`);
})()
