// Room-like loudness for the speaker (the YouTube iframe can't go through WebAudio, so this drives setVolume).
//   distance: full within 1.5 m, ~0.5 at 6 m, fading to 0 by 30 m
//   occlusion: each wall/floor (shell collider) between head and speaker x0.4, furniture x0.85
//   a different storey costs another x0.5
// HOUSE range ("everyone hears it"): same falloff without the far fade, walls x0.8, storey x0.8, never below
//   HOUSE_FLOOR within HOUSE_MAX m (full volume near the speaker still).

export const NEAR = 1.5, HALF_AT = 6, FAR0 = 18, FAR1 = 30, HOUSE_FLOOR = 0.35, HOUSE_MAX = 60;
const K = (HALF_AT - NEAR); // 1/(1 + (d-NEAR)/K) = 0.5 at HALF_AT

export function distanceGain(d) {
  if (d <= NEAR) return 1;
  const inv = 1 / (1 + (d - NEAR) / K);
  const x = Math.min(1, Math.max(0, (d - FAR0) / (FAR1 - FAR0)));
  return inv * (1 - x * x * (3 - 2 * x));
}

export function speakerGain({ dist, walls = 0, furniture = 0, storeyDiff = 0, range = 'room' }) {
  if (range === 'house') {
    if (dist > HOUSE_MAX) return 0;
    const g = (dist <= NEAR ? 1 : 1 / (1 + (dist - NEAR) / K)) * Math.pow(0.8, walls) * (storeyDiff ? 0.8 : 1);
    return Math.max(HOUSE_FLOOR, g);
  }
  return distanceGain(dist) * Math.pow(0.4, walls) * Math.pow(0.85, Math.min(furniture, 4)) * (storeyDiff ? 0.5 : 1);
}

const levelOf = (y) => (y > 2.5 ? 1 : 0);

// Ray-based occlusion with Rapier. Three rays (centre + two side offsets of 0.35 m) averaged, so a speaker
// just round a doorway is partly heard. Only fixed colliders count: shell (walls/floors) vs furniture.
export function createOcclusion(phys) {
  const R = phys.RAPIER, world = phys.world;
  const FLAGS = R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS;
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  function count(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.hypot(dx, dy, dz);
    if (L < 0.2) return { walls: 0, furniture: 0 };
    ray.origin = { x: ax, y: ay, z: az }; ray.dir = { x: dx / L, y: dy / L, z: dz / L };
    let walls = 0, furniture = 0;
    world.intersectionsWithRay(ray, L - 0.2, true, (hit) => {
      const tag = phys.tags?.get(hit.collider.handle) || '';
      if (tag === 'shell' || tag === 'core') walls++; else furniture++;
      return walls < 6;
    }, FLAGS);
    return { walls, furniture };
  }
  // listener head [x,y,z], speaker centre [x,y,z] -> gain 0..1
  return function gainAt(head, spk, range = 'room') {
    const dist = Math.hypot(head[0] - spk[0], head[1] - spk[1], head[2] - spk[2]);
    const storeyDiff = levelOf(head[1] - 1.2) !== levelOf(spk[1]) ? 1 : 0;
    if (dist > (range === 'house' ? HOUSE_MAX : FAR1)) return { gain: 0, dist, walls: 0, furniture: 0, storeyDiff, range };
    // side offsets perpendicular to the line in plan
    const hx = spk[0] - head[0], hz = spk[2] - head[2]; const hl = Math.hypot(hx, hz) || 1;
    const px = -hz / hl * 0.35, pz = hx / hl * 0.35;
    let g = 0, w0 = 0, f0 = 0;
    for (const s of [0, 1, -1]) {
      const c = count(head[0] + px * s, head[1], head[2] + pz * s, spk[0] + px * s, spk[1], spk[2] + pz * s);
      if (s === 0) { w0 = c.walls; f0 = c.furniture; }
      g += speakerGain({ dist, walls: c.walls, furniture: c.furniture, storeyDiff, range }) * (s === 0 ? 0.5 : 0.25);
    }
    return { gain: g, dist, walls: w0, furniture: f0, storeyDiff, range };
  };
}
