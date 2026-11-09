// RTX-look extras (walk mode): light shafts + dust (beams.js), lawn grass (grass.js); the film look (film.js) is
// patched into the OutputPass by main.js setupPost. Each feature follows its Settings > VIDEO control
// (src/net/settings.js: shafts on|off, grass off|low|high, film agx|neutral) and the live quality tier: Low tier
// turns shafts and grass off, Medium keeps shafts without dust and grass at low density.
// window.__look = { beams, grass, film, state() } for tools/look_test.mjs.
import { createBeams } from './beams.js';
import { createGrass } from './grass.js';
import { settings } from '../net/settings.js';

export function createLook(ctx, { film } = {}) {
  const { scene, sun, hemi, renderer, camera } = ctx;
  let beams = null, grass = null;
  try { beams = createBeams({ scene, sun }); } catch (e) { console.warn('[look] beams off:', e); window.__errors?.push('look beams: ' + e.message); }
  try { grass = createGrass({ scene, sun, hemi }); } catch (e) { console.warn('[look] grass off:', e); window.__errors?.push('look grass: ' + e.message); }
  let walkers = [], scanAcc = 9;
  const apply = () => {
    const st = settings.get(); const tier = ctx.quality?.max ? 'MAX' : ctx.quality?.tier?.name || 'High';
    const low = tier === 'Low', med = tier === 'Medium';
    if (beams) { beams.enabled = st.shafts !== 'off' && !low; beams.dust = !med; }
    if (grass) grass.mode = low ? 'off' : med && st.grass === 'high' ? 'low' : st.grass;
    film?.set(renderer, st.film);
  };
  apply(); settings.onChange(apply);
  let lastTier = '';
  const f = (dt, t) => {
    const tn = ctx.quality?.name || ''; if (tn !== lastTier) { lastTier = tn; apply(); }
    const sky = window.__sky;
    beams?.update(dt, t, camera, sky);
    if (grass) {
      scanAcc += dt; if (scanAcc > 1) { scanAcc = 0; walkers = scene.children.filter(o => o.name === 'avatar').slice(0, 3); }
      const ws = [(ctx.player || window.__player)?.position, ...walkers.map(a => a.position)].filter(Boolean);
      grass.update(dt, t, camera, sky, ws);
    }
  };
  ctx.onUpdate(f);
  const api = { beams, grass, film, apply, state: () => ({ shafts: beams ? { on: beams.enabled, active: beams.active, windows: beams.windows.length } : null, grass: grass ? { mode: grass.mode, visible: grass.mesh.visible, blades: grass.blades } : null, toneMapping: renderer.toneMapping }) };
  window.__look = api;
  return api;
}
