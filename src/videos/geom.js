// Pure helpers for video spots (no three.js): view axis, subject distance, Re-create scene from a spot.
// Used by src/videos.js (panel placement) and src/recreate/scenes.js (spots become Re-create scenes).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);

// unit view direction of the spot camera (pos -> look)
export function viewDir(spot) { const d = sub(spot.cam.look, spot.cam.pos); const l = len(d) || 1; return [d[0] / l, d[1] / l, d[2] / l]; }

// D = depth (along the view axis) of the main subject: mean of the people (chest height), default 3 m
export function subjectDistance(spot) {
  const ppl = spot.people || []; if (!ppl.length) return 3;
  const f = viewDir(spot); let s = 0;
  for (const p of ppl) { const d = sub([p.pos[0], p.pos[1] + (p.pose === 'sit' ? 0.6 : p.pose === 'lie' ? 0.2 : 1.1), p.pos[2]], spot.cam.pos); s += d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; }
  return Math.max(0.8, s / ppl.length);
}

// Re-create scene for a spot (format: see src/recreate/scenes.js).
// seats = spot.people; if none: up to 4 standing seats 0.7 m apart in a line 2.5 m in front of the camera,
// facing it (y = estimated floor; src/recreate.js snaps them onto the ground with a physics ray: `snap`).
// area  = 4 m square around the people's centroid (or the camera if no people), grown to include the seats.
export function spotScene(spot) {
  const c = spot.cam; let seats, snap = false;
  if (spot.people && spot.people.length) seats = spot.people.slice(0, 4).map(p => ({ pos: [...p.pos], yaw: p.yaw ?? 0, pose: p.pose || 'stand' }));
  else {
    let fx = c.look[0] - c.pos[0], fz = c.look[2] - c.pos[2]; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const rx = -fz, rz = fx; const yaw = Math.atan2(fx, fz); // faces back toward the camera (-f)
    const floor = spot.level === 1 ? 3.35 : Math.max(0, c.pos[1] - 1.45);
    seats = [0, 1, 2, 3].map(i => { const o = (i - 1.5) * 0.7; return { pos: [c.pos[0] + fx * 2.5 + rx * o, floor, c.pos[2] + fz * 2.5 + rz * o], yaw, pose: 'stand' }; });
    snap = true;
  }
  const n = spot.people && spot.people.length ? seats.length : 0;
  const cx = n ? seats.reduce((a, s) => a + s.pos[0], 0) / n : c.pos[0], cz = n ? seats.reduce((a, s) => a + s.pos[2], 0) / n : c.pos[2];
  const area = [cx - 2, cz - 2, cx + 2, cz + 2];
  for (const s of seats) { area[0] = Math.min(area[0], s.pos[0] - 1); area[1] = Math.min(area[1], s.pos[2] - 1); area[2] = Math.max(area[2], s.pos[0] + 1); area[3] = Math.max(area[3], s.pos[2] + 1); }
  return { id: spot.id, title: spot.title, level: spot.level, area, seats, audio: spot.src, video: spot.src, duration: spot.duration, spot, snap };
}
