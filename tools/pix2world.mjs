#!/usr/bin/env node
// Pixel -> world point on a horizontal plane, for a matched camera (same conventions as shot.mjs --cam).
//   node tools/pix2world.mjs --cam=x,y,z,lx,ly,lz,fov[,rollDeg] --size=576x1024 --px=u,v [--px=u,v ...] [--y=0]
// u,v = pixel in the frame (0,0 top-left). Prints [x, y, z] per pixel where the view ray hits plane y (default 0 = floor).
const args = process.argv.slice(2); const get = (k) => args.filter(a => a.startsWith('--' + k + '=')).map(a => a.slice(k.length + 3));
const [x, y, z, lx, ly, lz, fov, roll = 0] = get('cam')[0].split(',').map(Number);
const [W, H] = (get('size')[0] || '576x1024').split('x').map(Number); const Y = Number(get('y')[0] ?? 0);
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const f = norm(sub([lx, ly, lz], [x, y, z])); let r = norm(cross(f, [0, 1, 0])); let u = cross(r, f);
const rr = roll * Math.PI / 180; const r2 = add(mul(r, Math.cos(rr)), mul(u, -Math.sin(rr))), u2 = add(mul(u, Math.cos(rr)), mul(r, Math.sin(rr))); r = r2; u = u2;
const th = Math.tan(fov * Math.PI / 360), tw = th * W / H;
for (const p of get('px')) {
  const [pu, pv] = p.split(',').map(Number); const nx = (pu / W) * 2 - 1, ny = 1 - (pv / H) * 2;
  const d = norm(add(add(f, mul(r, nx * tw)), mul(u, ny * th)));
  if (Math.abs(d[1]) < 1e-6) { console.log(p, 'parallel to plane'); continue; }
  const t = (Y - y) / d[1]; if (t <= 0) { console.log(p, 'plane is behind the ray'); continue; }
  const w = add([x, y, z], mul(d, t)); console.log(p, JSON.stringify(w.map(v => +v.toFixed(2))));
}
