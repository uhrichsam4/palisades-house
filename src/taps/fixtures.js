// Every tap in the house: where the water leaves the fixture, which way, and where it lands.
// World metres (see src/plan.js). Positions were read from the room pieces (file:line given) and checked with
// close-up screenshots + a downward raycast from each tip (tools/taps_test.mjs --probe).
//
//   id     unique, also the network key            room   ROOMS id (used to pick the room's light probe)
//   kind   'sink' (single stream) | 'filler' (thick stream) | 'shower' (head) | 'hand' (hand shower)
//   tip    outlet centre [x,y,z]                    dir    outflow direction (normalised at load)
//   v      outflow speed m/s                         land   y of the surface the water hits (basin / tub / floor)
//   r      stream radius at the outlet (sinks) or spray-face radius (showers)
//   ui     extra look-at points for the prompt (shower valves), besides the tip itself
//   name   for logs/tests
export const FIXTURES = [
  // ---------------- kitchen (src/rooms/kitchen.js:441-458), sink island, user faces -x
  { id: 'kitchen', room: 'kitchen', kind: 'sink', name: 'Kitchen sink (gooseneck)', tip: [18.895, 1.064, 16.60], dir: [0, -1, 0], v: 1.1, r: 0.0095, land: 0.68 },
  { id: 'kitchen-filter', room: 'kitchen', kind: 'sink', name: 'Kitchen filter tap', tip: [18.806, 1.090, 16.86], dir: [0.6, -0.8, 0], v: 0.55, r: 0.0045, land: 0.68 },
  { id: 'kitchen-prep', room: 'kitchen', kind: 'sink', name: 'Kitchen prep sink', tip: [18.851, 1.146, 15.40], dir: [0.6, -0.8, 0], v: 0.8, r: 0.0072, land: 0.931 },
  // ---------------- wet bar niche off the dining room (src/rooms/dining.js:510-516)
  { id: 'wetbar', room: 'wetbar', kind: 'sink', name: 'Wet bar sink', tip: [12.96, 1.178, 12.57], dir: [0, -1, 0], v: 0.9, r: 0.0072, land: 0.913 },
  // ---------------- powder room (src/rooms/service.js:458-463), vanity on the 45-degree chamfer
  { id: 'powder', room: 'powder', kind: 'sink', name: 'Powder room basin', tip: [1.252, 1.027, 15.248], dir: [0.19, -0.96, -0.19], v: 0.8, r: 0.0072, land: 0.745 },
  // ---------------- primary bath (src/rooms/primarybath.js:416-462, 536-545), upper floor y = 3.35
  { id: 'primary-sink-1', room: 'primaryBath', kind: 'sink', name: 'Primary bath sink 1', tip: [21.172, 4.370, 16.225], dir: [-0.64, -0.77, 0], v: 0.75, r: 0.0072, land: 4.215 },
  { id: 'primary-sink-2', room: 'primaryBath', kind: 'sink', name: 'Primary bath sink 2', tip: [21.172, 4.370, 18.475], dir: [-0.64, -0.77, 0], v: 0.75, r: 0.0072, land: 4.215 },
  { id: 'primary-tub', room: 'primaryBath', kind: 'filler', name: 'Primary tub filler', tip: [18.535, 4.083, 17.16], dir: [1, -0.25, 0], v: 0.55, r: 0.014, land: 3.44,
    // polish: basin the filler fills (water.js rising level). oval: centre + inner lathe profile [r, y] of primarybath.js:470, plan b = r + dL*sqrt(r/0.4)
    basin: { shape: 'oval', c: [18.90, 3.35, 17.15], dL: 0.45, prof: [[0.21, 0.092], [0.282, 0.13], [0.328, 0.25], [0.356, 0.40], [0.371, 0.53]], y0: 0.095, y1: 0.44 } },
  { id: 'primary-shower', room: 'primaryBath', kind: 'shower', name: 'Primary shower (2 heads)', heads: [[17.079, 5.345, 16.77], [17.079, 5.345, 17.57]], tip: [17.079, 5.345, 17.17], dir: [0.296, -0.955, 0], v: 2.6, r: 0.045, land: 3.356, ui: [[16.83, 4.49, 16.77]] },
  { id: 'primary-hand', room: 'primaryBath', kind: 'hand', name: 'Primary hand shower', tip: [16.915, 5.155, 17.17], dir: [0.88, 0.3, 0], v: 2.3, r: 0.030, land: 3.356 },
  // ---------------- coffee bar in the primary vestibule (src/rooms/primarybath.js:672-682)
  { id: 'coffee-bar', room: 'vestibule', kind: 'sink', name: 'Coffee bar sink', tip: [15.78, 4.457, 14.10], dir: [0, -1, 0], v: 0.8, r: 0.0072, land: 4.193 },
  // ---------------- Bath A (src/rooms/bedA.js:596-600, 664-683); vanity group rotated +90 deg about y
  { id: 'bathA-sink', room: 'bathA', kind: 'sink', name: 'Bath A sink', tip: [16.0, 4.368, 1.44], dir: [0.14, -0.99, 0], v: 0.8, r: 0.0072, land: 4.072 },
  { id: 'bathA-shower', room: 'bathA', kind: 'shower', name: 'Bath A shower head', tip: [15.993, 5.337, 3.20], dir: [0.42, -0.91, 0], v: 2.2, r: 0.036, land: 3.356, ui: [[15.80, 4.45, 3.20]] },
  { id: 'bathA-hand', room: 'bathA', kind: 'hand', name: 'Bath A hand shower', tip: [15.902, 5.212, 3.20], dir: [0.86, 0.3, 0], v: 1.7, r: 0.026, land: 3.356 },
  // ---------------- Bath B (src/rooms/bedB.js:624-662): black marble walk-in shower, rain head + hand shower
  { id: 'bathB-sink', room: 'bathB', kind: 'sink', name: 'Bath B sink (wall spout)', tip: [21.70, 4.432, 6.318], dir: [0, -1, 0], v: 0.8, r: 0.0072, land: 4.092 },
  { id: 'bathB-rain', room: 'bathB', kind: 'shower', name: 'Bath B rain head', tip: [20.404, 5.444, 8.50], dir: [0, -1, 0], v: 2.2, r: 0.098, land: 3.357, ui: [[20.02, 4.45, 7.86], [20.02, 4.71, 7.86]] },
  { id: 'bathB-hand', room: 'bathB', kind: 'hand', name: 'Bath B hand shower', tip: [20.140, 5.161, 8.12], dir: [0.85, 0.32, 0], v: 2.3, r: 0.028, land: 3.357 },
  // ---------------- Bath C (src/rooms/bedC.js:608-680): alcove tub with spout + shower arm, brass vanity faucet
  { id: 'bathC-sink', room: 'bathC', kind: 'sink', name: 'Bath C sink', tip: [5.51, 4.328, 12.39], dir: [0.55, -0.83, 0], v: 0.75, r: 0.0072, land: 4.17 },
  { id: 'bathC-tub', room: 'bathC', kind: 'filler', name: 'Bath C tub spout', tip: [5.476, 3.984, 10.86], dir: [0.8, -0.6, 0], v: 0.6, r: 0.014, land: 3.472,
    // polish: inset box basin of bedC.js:611 (ix0..ix1 x iz0..iz1), floor at Y + TH - 0.40
    basin: { shape: 'box', c: [6.065, 3.35, 10.835], hx: 0.645, hz: 0.345, y0: 0.122, y1: 0.40 } },
  { id: 'bathC-shower', room: 'bathC', kind: 'shower', name: 'Bath C shower arm', tip: [5.538, 5.333, 10.86], dir: [0.3, -0.954, 0], v: 2.4, r: 0.030, land: 3.472, ui: [[5.33, 4.37, 10.86]] },
  { id: 'bathC-hand', room: 'bathC', kind: 'hand', name: 'Bath C hand shower', tip: [5.375, 5.186, 11.04], dir: [0.85, 0.3, 0], v: 2.2, r: 0.030, land: 3.472 },
  // ---------------- guest bath in the turret (src/rooms/theater.js:509-531, 590-597); vanity group rotated 180 deg
  { id: 'guest-sink', room: 'guestBath', kind: 'sink', name: 'Guest bath sink', tip: [7.425, 4.316, 7.045], dir: [0, -1, 0], v: 0.8, r: 0.0072, land: 4.063 },
  { id: 'guest-rain', room: 'guestBath', kind: 'shower', name: 'Guest bath rain head', tip: [5.93, 5.492, 6.78], dir: [0, -1, 0], v: 2.2, r: 0.12, land: 3.362, ui: [[5.34, 4.47, 6.80]] },
  { id: 'guest-hand', room: 'guestBath', kind: 'hand', name: 'Guest bath hand shower', tip: [5.440, 5.257, 7.00], dir: [0.85, 0.3, 0], v: 2.2, r: 0.030, land: 3.362 },
];
