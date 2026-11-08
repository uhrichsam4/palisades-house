// Walkable spots for party games: ground-floor rooms (plan.js ROOMS level 0) + the back yard (pool deck,
// east deck, lawn strip, west deck). Each candidate is tested against the live physics world: a ground ray
// must land on a floor between y -0.45 and 0.25 (not a table top, not the pool bottom), a player capsule must
// fit there (fixed colliders only), and it must not be inside a water body.
import { ROOMS } from '../plan.js';
import { waterBodies } from '../water/index.js';

const SKIP_ROOMS = new Set(['garage', 'store', 'pantry', 'kpantry']);
// yard rects [x0, z0, x1, z1] (src/rooms/pool.js: deck y -0.10, pool hole x 3.3-16.3 / z 22.7-27.9, lawn z 28.6-30.9)
export const YARD = [
  [-3.0, 16.6, 2.0, 22.4], [2.7, 20.7, 8.0, 22.4], [8.6, 18.8, 15.1, 22.4], [16.6, 22.0, 22.8, 28.3],
  [7.3, 28.9, 22.8, 30.5], [-3.0, 22.8, 3.0, 30.4],
];

export function createSpots(ctx) {
  const phys = ctx.phys, R = phys.RAPIER, world = phys.world;
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const FL = R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const cap = new R.Capsule(0.55, 0.32), ROT = { x: 0, y: 0, z: 0, w: 1 };
  const pc = () => ctx.player?.collider;
  function ground(x, z) {
    ray.origin = { x, y: 1.4, z }; const hit = world.castRay(ray, 3, true, FL, undefined, pc());
    return hit ? 1.4 - (hit.timeOfImpact ?? hit.toi) : null;
  }
  function clear(x, y, z) {
    let hit = false;
    world.intersectionsWithShape({ x, y: y + 0.08 + 0.87, z }, ROT, cap, (c) => {
      if (pc() && c.handle === pc().handle) return true; const b = c.parent(); if (b && !b.isFixed()) return true;
      hit = true; return false;
    });
    return !hit;
  }
  const wet = (x, z) => { for (const w of waterBodies) { try { if (w.isInside(x, z)) return true; } catch {} } return false; };
  // floor y if (x, z) is a free standing spot, else null
  function ok(x, z) {
    if (wet(x, z)) return null;
    const y = ground(x, z); if (y === null || y < -0.45 || y > 0.25) return null;
    return clear(x, y, z) ? y : null;
  }
  let cache = null;
  function pool() {
    if (cache) return cache;
    try { world.updateSceneQueries?.(); } catch {}
    const out = []; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rects = [...Object.values(ROOMS).filter((r, i) => r.level === 0 && !SKIP_ROOMS.has(Object.keys(ROOMS)[i])).map(r => r.rect), ...YARD];
    for (const [x0, z0, x1, z1] of rects) {
      for (let x = x0 + 0.45; x <= x1 - 0.45; x += 0.9) for (let z = z0 + 0.45; z <= z1 - 0.45; z += 0.9) {
        const jx = x + (rnd() - 0.5) * 0.4, jz = z + (rnd() - 0.5) * 0.4;
        const y = ok(jx, jz); if (y !== null) out.push([+jx.toFixed(2), +y.toFixed(3), +jz.toFixed(2)]);
      }
    }
    cache = out; return out;
  }
  // n free spots around (cx, cz): rings outward, >= gap apart
  function near(cx, cz, n, r0 = 0.9, gap = 0.95) {
    try { world.updateSceneQueries?.(); } catch {}
    const out = [];
    for (let r = r0; r < 9 && out.length < n; r += 0.6) {
      const k = Math.max(6, Math.floor((2 * Math.PI * r) / gap));
      for (let i = 0; i < k && out.length < n; i++) {
        const a = (i / k) * Math.PI * 2 + r; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (out.some(p => Math.hypot(p[0] - x, p[2] - z) < gap)) continue;
        const y = ok(x, z); if (y !== null) out.push([+x.toFixed(2), +y.toFixed(3), +z.toFixed(2)]);
      }
    }
    while (out.length < n) out.push([cx, 0, cz]);
    return out;
  }
  return { ok, ground, pool, near };
}
