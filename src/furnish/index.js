// Lived-in extras for every room: everyday things on counters, shelves, nightstands, floors and walls,
// party leftovers, outdoor living. Built by main.js after the room pieces, walk mode only (?furnish=1 adds
// it to photo shots too). Everything static under ctx.root is merged by main.js' global merge pass, so props
// share a tiny palette of vertex-coloured materials + one print atlas (src/furnish/atlas.js).
// Every prop group carries userData.furnish = { kind, fragile, mass, room, name } for the physics builder.
import { makeLib } from './lib.js';
import { buildGround } from './ground.js';
import { buildUpper } from './upper.js';
import { buildOutdoor } from './outdoor.js';

export async function build(ctx) {
  if (ctx.params?.get?.('nofurnish') === '1') return; // A/B perf checks: ?nofurnish=1
  const t0 = performance.now();
  const L = makeLib(ctx); L.later = [];
  // outdoor flavour of the toolkit: same builders, materials lit by the real sky (kit.outdoor)
  const OM = { ...L.M }; for (const k of ['metal', 'fabric', 'leaf', 'print', 'screen']) OM[k] = L.out(k);
  OM.knit = OM.towel = OM.fabric; OM.brass = OM.chrome = OM.metal; OM.matte = OM.satin = OM.gloss = { isFlatProxy: true, target: OM.print }; OM.glass = { isFlatProxy: true, target: OM.print, glass: true };
  L.outdoor = { ...L, M: OM };
  const parts = [['ground', buildGround], ['upper', buildUpper], ['outdoor', buildOutdoor]];
  for (const [name, fn] of parts) { try { fn(L); } catch (e) { console.error('[furnish] ' + name, e); window.__errors?.push('furnish ' + name + ': ' + (e.stack || e.message)); } }
  for (const job of L.later) { try { await job(); } catch (e) { console.error('[furnish] model', e); window.__errors?.push('furnish model: ' + (e.stack || e.message)); } }
  // indoors nothing casts sun shadows (rooms are lit by probes; casters would also split every merge bucket in
  // two = extra draws). Outdoors the big pieces flagged by L.shadows keep casting.
  const OUTSIDE = new Set(['deck', 'yard', 'street', 'pool', 'balcony']);
  const CAST = new Set(['patio umbrella', 'chaise lounger', 'gas grill', 'outdoor dining table', 'baby grand piano']);
  for (const g of ctx.root.children) { const f = g.userData.furnish; if (f && !(OUTSIDE.has(f.room) && CAST.has(f.name))) g.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
  const tris = {}; let triTotal = 0; for (const g of ctx.root.children) { let t = 0; g.traverse(o => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); const k = g.userData.furnish?.name || g.name; tris[k] = (tris[k] || 0) + t; triTotal += t; }
  window.__furnish = { ...L.stats(), tris: Math.round(triTotal), topTris: Object.entries(tris).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, Math.round(v)]), ms: Math.round(performance.now() - t0), inventory: L.inv };
}
