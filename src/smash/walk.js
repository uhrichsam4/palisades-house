// Walkability (src/smash): smooth stairs up AND down.
//   - Every staircase / outdoor step run gets an invisible player-only RAMP (physics GROUPS.RAMP: every dynamic prop's
//     filter drops it) along the nosing line, so the character controller glides instead of auto-stepping each riser,
//     and snap-to-ground keeps you on it going down (no hops).
//   - The foyer stair's own smooth trimesh (foyer.js) becomes that RAMP, and the real treads get PROPONLY boxes so
//     props, rocks and debris land on the steps you see.
// Constants mirror src/rooms/foyer.js (stair) and src/rooms/exterior.js (entry walk).
import * as THREE from 'three';
import { STREET_Y } from '../rooms/site/terrain.js';

export function buildWalk(ctx) {
  const { phys } = ctx; const R = phys.RAPIER, world = phys.world, G = phys.GROUPS;
  const made = [];
  const _q = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0);
  // ramp along z between (za, ya) and (zb, yb), x0..x1; top face exactly on that line, 0.2 m thick
  function rampZ(x0, x1, za, ya, zb, yb, tag) {
    const dz = zb - za, dy = yb - ya, L = Math.hypot(dz, dy), T = 0.2;
    const ang = Math.atan2(dy, dz); _q.setFromAxisAngle(_x, -ang);
    const nx = 0, ny = dz / L, nz = -dy / L; // up-facing normal of the slope
    const cx = (x0 + x1) / 2, cy = (ya + yb) / 2 - ny * T / 2, cz = (za + zb) / 2 - nz * T / 2;
    const c = world.createCollider(R.ColliderDesc.cuboid((x1 - x0) / 2, T / 2, L / 2).setTranslation(cx + nx, cy, cz).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }).setFriction(0.0));
    phys.setGroups(c, G.RAMP, G.ALL); phys.tags.set(c.handle, 'smash:ramp ' + tag); made.push(c); return c;
  }
  function propOnlyBox(min, max, tag) { const c = phys.boxAABB(min, max); phys.setGroups(c, G.PROPONLY, G.ALL); phys.tags.set(c.handle, 'smash:tread ' + tag); made.push(c); return c; }

  // ---- foyer stair (x 10.0–11.12, z 5.70 -> 10.20, 17 risers, landing after 7)
  {
    const ST = { x0: 10.0, x1: 11.12, z0: 5.70, z1: 10.20, n: 17 }; const UP = 3.35; const H = UP / ST.n;
    const NL = 7, LAND = 0.90, Rr = (ST.z1 - ST.z0 - LAND) / (ST.n - 2);
    const zL0 = ST.z0 + (NL - 1) * Rr, zL1 = zL0 + LAND;
    const zr = (k) => k <= NL ? ST.z0 + (k - 1) * Rr : zL1 + (k - NL - 1) * Rr;
    // the foyer's trimesh ramp -> player-only
    let found = 0;
    world.forEachCollider?.((c) => {
      if (found > 2 || (phys.tags.get(c.handle) || '') !== 'piece:foyer' || c.shape?.type !== R.ShapeType.TriMesh) return;
      const t = c.translation(); const aabb = c.shape.vertices; if (!aabb || aabb.length > 200) return;
      let inside = true; for (let i = 0; i < aabb.length; i += 3) { const x = aabb[i] + t.x, z = aabb[i + 2] + t.z; if (x < ST.x0 - 0.01 || x > ST.x1 + 0.01 || z < ST.z0 - 0.2 || z > ST.z1 + 0.01) { inside = false; break; } }
      // the foyer trimesh's triangles face DOWN (normals y < 0): the controller treated it as a ceiling and could not
      // walk UP onto it from the bottom (walking down worked). Keep it for props only and give the player our own ramps.
      if (inside) { phys.setGroups(c, G.PROPONLY, G.ALL); phys.tags.set(c.handle, 'smash:propstair foyer'); found++; }
    });
    { // player ramps along the nosing line (both flights + the mid landing between them)
      rampZ(ST.x0, ST.x1, ST.z0 - 0.15, 0, zL0, NL * H, 'foyer-1'); rampZ(ST.x0, ST.x1, zL0, NL * H, zL1, NL * H, 'foyer-landing'); rampZ(ST.x0, ST.x1, zL1, NL * H, ST.z1, UP, 'foyer-2');
    }
    for (let k = 1; k < ST.n; k++) propOnlyBox([ST.x0, (k - 1) * H, zr(k)], [ST.x1, k * H, zr(k + 1)], 'foyer-' + k);
  }
  // ---- front entry walk (exterior.js): landing 0 -> 2 treads -> mid landing -> 2 treads -> apron at sidewalk level
  {
    const WALK_Y = STREET_Y + 0.15, RISE = -WALK_Y / 6, TRD = 0.36;
    const LZ = 0.35, LX = 9.45, RX = 10.95, WX = 7.2; const MZ1 = LZ - 2 * TRD, MZ0 = -2.2, PZ = MZ0 - 2 * TRD;
    rampZ(LX, RX, MZ1 - TRD, -3 * RISE, LZ, 0, 'entry-upper');
    rampZ(WX, RX, PZ - TRD, WALK_Y, MZ0, -3 * RISE, 'entry-lower');
  }
  return { colliders: made };
}
