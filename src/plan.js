// 17609 Camino De Yatasto — to-scale plan.
//
// SCALE SOURCE: LA County LARIAC 2020 building footprint BLD_ID 388092851226 (roof outline,
// 4,462 sq ft, 29.16 ft tall). There is NO published floor plan; the interior layout below is
// inferred from the 46 MLS listing photos (see ROOMS[].photos). Units are metres.
//
// WORLD AXES (right-handed, y up):
//   +x = north-east (towards the tennis court).  x=0 is the south-west end of the roof outline.
//   +z = south-east (towards the pool / canyon). z=0 is the street-side face of the garage roof.
//   The real house is rotated 34.6° from east; NORTH (unit vector in this frame) is below.
// LEVELS: ground finished floor y=0, ground ceiling 3.05, upper finished floor y=3.35,
//   upper wall plate 6.10, main ridge 8.89 (LARIAC height).
//
// Rect convention everywhere: [x0, z0, x1, z1] with x0<x1, z0<z1 (interior faces of walls).

export const NORTH = [Math.sin(34.6 * Math.PI / 180), 0, -Math.cos(34.6 * Math.PI / 180)]; // ≈ (0.568, 0, -0.823)

export const LEVELS = {
  0: { floor: 0.0, ceil: 3.05 },
  1: { floor: 3.35, plate: 6.10 },
};
export const RIDGE = 8.89;
export const EXT_T = 0.30;   // exterior wall thickness (outer face -> inner face)
export const INT_T = 0.15;   // default interior wall thickness

// LARIAC roof outline (eaves), in this frame. Walls sit 0.35 m inside it.
export const ROOF_OUTLINE = [
  [10.77, 4.08], [10.77, 0.0], [23.43, 0.0], [23.45, 14.71], [22.04, 14.71], [22.06, 22.0],
  [15.05, 22.0], [15.04, 19.41], [8.61, 19.41], [8.62, 20.67], [2.01, 20.67], [2.0, 16.49],
  [0.02, 16.5], [0.0, 6.72], [4.67, 6.72], [4.66, 4.08],
];

// Exterior wall OUTER faces, clockwise seen from above (+y). Interior is to the right of each edge
// when walking a->b ... (shell.js works out the inward side itself).
// The front turret is a 3-sided bay between x 5.6 and 7.9 projecting 0.9 m towards the street.
export const EXT = {
  0: [
    [11.12, 0.35], [23.10, 0.35], [23.10, 14.36], [21.70, 14.36], [21.70, 21.65], [15.39, 21.65],
    [15.39, 18.40], [8.27, 18.40], [8.27, 20.32], [2.35, 20.32], [2.35, 16.15], [0.35, 16.15],
    [0.35, 7.07], [5.01, 7.07], [5.01, 4.43], [5.60, 4.43], [6.10, 3.53], [7.40, 3.53], [7.90, 4.43],
    [11.12, 4.43],
  ],
  1: [
    [11.12, 0.35], [23.10, 0.35], [23.10, 14.36], [21.70, 14.36], [21.70, 21.65], [15.39, 21.65],
    [15.39, 17.00], [8.27, 17.00], [8.27, 13.60], [2.35, 13.60], [0.35, 13.60],
    [0.35, 7.07], [5.01, 7.07], [5.01, 4.43], [5.60, 4.43], [6.10, 3.53], [7.40, 3.53], [7.90, 4.43],
    [11.12, 4.43],
  ],
};
// Upper-level exterior wall faces that actually face INTO the vaulted family room (painted, not sided).
// Given as the outer-face edge endpoints.
export const EXT_INNER_EXPOSED = [
  { level: 1, a: [8.27, 17.00], b: [8.27, 13.60] },   // primary-suite SW wall seen from family-room vault
  { level: 1, a: [8.27, 13.60], b: [2.35, 13.60] },   // SW block rear wall seen from family-room vault
];

// Interior walls: centreline a->b, thickness t (default INT_T). Openings are cut by OPENINGS below.
export const INT_WALLS = {
  0: [
    { id: 'g-fire', a: [11.27, 4.43], b: [11.27, 7.20], t: 0.30 },          // foyer | garage
    { id: 'g-back', a: [11.27, 7.125], b: [22.80, 7.125] },                 // garage | mudroom+office
    { id: 'foy-e', a: [11.195, 7.20], b: [11.195, 13.60] },                 // foyer | mudroom, pantry, wet bar
    { id: 'mud-off', a: [16.925, 7.20], b: [16.925, 10.60] },               // mudroom | office
    { id: 'svc-k', a: [11.27, 10.675], b: [22.80, 10.675] },                // mudroom+office | pantry+kitchen
    { id: 'pan-k', a: [15.315, 10.75], b: [15.315, 13.60] },                // pantry/store | kitchen
    { id: 'pan-wb', a: [11.27, 12.275], b: [15.24, 12.275] },               // pantry | wet bar + store
    { id: 'wb-st', a: [13.575, 12.35], b: [13.575, 13.60] },                // wet bar | store
    { id: 'st-din', a: [13.50, 13.525], b: [15.39, 13.525] },               // store | dining
    { id: 'k-kp', a: [21.475, 10.75], b: [21.475, 14.06] },                 // kitchen | kitchen pantry
    { id: 'foy-w', a: [8.225, 4.43], b: [8.225, 13.30] },                   // game + living | foyer
    { id: 'game-liv', a: [5.31, 7.295], b: [8.15, 7.295] },                 // game | living
    { id: 'liv-fam', a: [0.35, 13.45], b: [8.30, 13.45], t: 0.30 },          // living | powder+family (bearing)
    { id: 'pow-fam', a: [2.575, 13.60], b: [2.575, 15.85] },                // powder | family
  ],
  1: [
    { id: 'u-sw-ga', a: [11.27, 4.43], b: [11.27, 10.30], t: 0.30 },         // gallery/void | bed A + theater
    { id: 'bA-th', a: [11.42, 6.075], b: [15.60, 6.075] },                  // bed A | theater
    { id: 'bA-e', a: [15.675, 0.65], b: [15.675, 10.30] },                  // bed A + theater | bath A + hall NS
    { id: 'bathA-h', a: [15.75, 4.525], b: [17.35, 4.525] },                // bath A | hall NS
    { id: 'hNS-e', a: [17.425, 0.65], b: [17.425, 14.35] },                 // hall NS + vestibule | bed B, closets
    { id: 'bB-s', a: [17.50, 6.075], b: [22.80, 6.075] },                   // bed B | closet B + bath B
    { id: 'clB-bB', a: [19.925, 6.15], b: [19.925, 8.90] },                 // closet B | bath B
    { id: 'bB-pc', a: [17.50, 8.975], b: [22.80, 8.975] },                  // closet B + bath B | primary closet
    { id: 'th-hEW', a: [11.42, 10.225], b: [15.60, 10.225] },               // theater | hall EW
    { id: 'hEW-pr', a: [8.30, 11.675], b: [17.425, 11.675] },               // hall EW + hall NS | primary bed + vestibule
    { id: 'pr-vest', a: [15.465, 11.75], b: [15.465, 14.35] },              // primary bed | vestibule
    { id: 'pr-bath', a: [15.54, 14.35], b: [15.54, 17.00], t: 0.30 },        // primary bed | primary bath
    { id: 'vest-bath', a: [15.54, 14.425], b: [17.50, 14.425] },            // vestibule | primary bath
    { id: 'pc-bath', a: [17.35, 14.28], b: [21.70, 14.28], t: 0.44 },        // primary closet | primary bath
    { id: 'gal-w', a: [8.225, 4.43], b: [8.225, 13.30] },                   // guest bath, hall C, bath C | gallery
    { id: 'gb-hC', a: [5.31, 7.295], b: [8.15, 7.295] },                    // guest bath (turret) | hall C
    { id: 'hC-bC', a: [5.31, 10.325], b: [8.15, 10.325] },                  // hall C | bath C
    { id: 'bC-e', a: [5.235, 7.37], b: [5.235, 13.30] },                    // bed C | hall C + bath C
    { id: 'bC-pr', a: [8.36, 11.60], b: [8.36, 13.60], t: 0.42 },            // bath C | primary bed (plumbing wall)
  ],
};

// Holes in the upper floor slab (open to below). Stair: x 10.0–11.12, bottom z 5.70 (y 0) rising +z
// to top z 10.20 (y 3.35); 17 risers × 0.197 m, 16 treads × 0.28 m.
export const VOIDS = {
  1: [[9.25, 5.70, 11.12, 10.20]],
};
export const STAIR = { x0: 10.0, x1: 11.12, zBottom: 5.70, zTop: 10.20, risers: 17 };

// Rooms. rect = interior faces. ceil: flat height above that level's floor unless the room builds its own.
export const ROOMS = {
  // ---- ground (level 0)
  garage:     { level: 0, rect: [11.42, 0.65, 22.80, 7.05], name: 'Garage (3-car)' },
  game:       { level: 0, rect: [5.31, 4.73, 8.15, 7.22], name: 'Game room (turret)', photos: ['p33'] },
  foyer:      { level: 0, rect: [8.30, 4.73, 11.12, 13.60], name: 'Entry & stair hall', photos: ['p02', 'p14'] },
  living:     { level: 0, rect: [0.65, 7.37, 8.15, 13.30], name: 'Living room', photos: ['p03'] },
  powder:     { level: 0, rect: [0.65, 13.60, 2.50, 15.85], name: 'Powder room', photos: ['p34'] },
  family:     { level: 0, rect: [2.65, 13.60, 8.30, 20.02], name: 'Family room (vaulted)', photos: ['p04', 'p05'] },
  dining:     { level: 0, rect: [8.30, 13.60, 15.39, 18.10], name: 'Dining', photos: ['p06', 'p07'] },
  wetbar:     { level: 0, rect: [11.27, 12.35, 13.50, 13.60], name: 'Wet bar', photos: ['p12'] },
  store:      { level: 0, rect: [13.65, 12.35, 15.24, 13.45], name: 'Storage' },
  pantry:     { level: 0, rect: [11.27, 10.75, 15.24, 12.20], name: 'Pantry' },
  kitchen:    { level: 0, rect: [15.39, 10.75, 21.40, 21.35], name: 'Kitchen & breakfast nook', photos: ['p08', 'p09', 'p10', 'p11'] },
  kpantry:    { level: 0, rect: [21.55, 10.75, 22.80, 14.06], name: 'Kitchen pantry' },
  mudroom:    { level: 0, rect: [11.27, 7.20, 16.85, 10.60], name: 'Mudroom & laundry', photos: ['p13'] },
  office:     { level: 0, rect: [17.00, 7.20, 22.80, 10.60], name: 'Office', photos: ['p35'] },
  // ---- upper (level 1)
  gallery:    { level: 1, rect: [8.30, 4.73, 11.12, 10.30], name: 'Upper landing & bridge', photos: ['p15', 'p16'] },
  hallEW:     { level: 1, rect: [8.30, 10.30, 15.60, 11.60], name: 'Upper hall' },
  hallNS:     { level: 1, rect: [15.75, 4.60, 17.35, 11.60], name: 'Upper hall (north)' },
  hallC:      { level: 1, rect: [5.31, 7.37, 8.15, 10.25], name: 'Bedroom C hall' },
  guestBath:  { level: 1, rect: [5.31, 4.73, 8.15, 7.22], name: 'Guest bath (turret)', photos: ['p36', 'p37'] },
  bedA:       { level: 1, rect: [11.42, 0.65, 15.60, 6.00], name: 'Bedroom A', photos: ['p24'] },
  bathA:      { level: 1, rect: [15.75, 0.65, 17.35, 4.45], name: 'Bath A', photos: ['p25', 'p26'] },
  bedB:       { level: 1, rect: [17.50, 0.65, 22.80, 6.00], name: 'Bedroom B', photos: ['p27', 'p28'] },
  closetB:    { level: 1, rect: [17.50, 6.15, 19.85, 8.90], name: 'Closet B' },
  bathB:      { level: 1, rect: [20.00, 6.15, 22.80, 8.90], name: 'Bath B', photos: ['p29'] },
  theater:    { level: 1, rect: [11.42, 6.15, 15.60, 10.15], name: 'Theater', photos: ['p32'] },
  primaryBed: { level: 1, rect: [8.57, 11.75, 15.39, 16.70], name: 'Primary bedroom', photos: ['p17', 'p18'] },
  balcony:    { level: 1, rect: [8.27, 17.00, 15.39, 19.06], name: 'Primary balcony', photos: ['p22'], outdoor: true },
  vestibule:  { level: 1, rect: [15.54, 11.75, 17.35, 14.35], name: 'Primary coffee bar', photos: ['p23'] },
  primaryCloset: { level: 1, rect: [17.50, 9.05, 22.80, 14.06], name: 'Primary closet' },
  primaryBath:{ level: 1, rect: [15.69, 14.50, 21.40, 21.35], name: 'Primary bath', photos: ['p19', 'p20', 'p21'] },
  bedC:       { level: 1, rect: [0.65, 7.37, 5.16, 13.30], name: 'Bedroom C', photos: ['p30'] },
  bathC:      { level: 1, rect: [5.31, 10.40, 8.15, 13.30], name: 'Bath C', photos: ['p31'] },
};

// Openings. Each sits on a wall line (exterior outer face or interior centreline) at `at` = [x, z]
// (centre of the opening along the wall), width w. sill/head are heights ABOVE THAT LEVEL'S FLOOR.
// type: window | door | doorway (cased opening, no leaf) | slider | french | garage | skylight(not cut)
// owner = the piece that may edit the line. panes = [cols, rows] of glazing bars.
export const OPENINGS = [
  // ---------------- ground, exterior
  { id: 'g-door-1', owner: 'exterior', level: 0, type: 'garage', at: [20.40, 0.35], w: 3.00, sill: 0, head: 2.45 },
  { id: 'g-door-2', owner: 'exterior', level: 0, type: 'garage', at: [15.30, 0.35], w: 6.00, sill: 0, head: 2.45 },
  { id: 'entry', owner: 'foyer', level: 0, type: 'french', at: [9.80, 4.43], w: 1.60, sill: 0, head: 2.95, panes: [2, 4], open: 0 },
  { id: 'game-b1', owner: 'game', level: 0, type: 'window', at: [5.85, 3.98], w: 0.85, sill: 1.00, head: 2.55, panes: [1, 2] },
  { id: 'game-b2', owner: 'game', level: 0, type: 'window', at: [6.75, 3.53], w: 0.88, sill: 1.00, head: 2.55, panes: [1, 2] },
  { id: 'game-b3', owner: 'game', level: 0, type: 'window', at: [7.65, 3.98], w: 0.85, sill: 1.00, head: 2.55, panes: [1, 2] },
  { id: 'liv-front', owner: 'living', level: 0, type: 'window', at: [1.50, 7.07], w: 0.85, sill: 0.95, head: 2.65, panes: [1, 2] },
  { id: 'liv-sw1', owner: 'living', level: 0, type: 'window', at: [0.35, 9.05], w: 0.75, sill: 0.95, head: 2.65, panes: [1, 2] },
  { id: 'liv-sw2', owner: 'living', level: 0, type: 'window', at: [0.35, 12.10], w: 0.75, sill: 0.95, head: 2.65, panes: [1, 2] },
  { id: 'pow-win', owner: 'service', level: 0, type: 'window', at: [0.35, 14.47], w: 0.80, sill: 1.00, head: 2.60, panes: [1, 2] },
  { id: 'fam-r1', owner: 'family', level: 0, type: 'window', at: [3.48, 20.32], w: 1.40, sill: 1.05, head: 2.70, panes: [2, 1] },
  { id: 'fam-door', owner: 'family', level: 0, type: 'french', at: [5.07, 20.32], w: 1.55, sill: 0, head: 2.50, panes: [2, 1] },
  { id: 'fam-r2', owner: 'family', level: 0, type: 'window', at: [6.86, 20.32], w: 1.20, sill: 1.05, head: 2.50, panes: [2, 1] },
  { id: 'fam-sw', owner: 'family', level: 0, type: 'window', at: [2.35, 19.63], w: 0.55, sill: 1.05, head: 2.50, panes: [1, 1] },
  { id: 'fam-ne', owner: 'family', level: 0, type: 'window', at: [8.27, 19.30], w: 0.60, sill: 1.05, head: 2.50, panes: [1, 1] },
  { id: 'din-slider', owner: 'dining', level: 0, type: 'slider', at: [11.83, 18.40], w: 7.00, sill: 0, head: 2.90, panes: [4, 1], open: 1 },
  { id: 'k-rear', owner: 'kitchen', level: 0, type: 'window', at: [19.05, 21.65], w: 1.67, sill: 0.95, head: 2.55, panes: [2, 2] },
  { id: 'k-rear2', owner: 'kitchen', level: 0, type: 'window', at: [20.40, 21.65], w: 0.55, sill: 0.95, head: 2.55, panes: [1, 3] },
  { id: 'k-sw', owner: 'kitchen', level: 0, type: 'french', at: [15.39, 20.85], w: 0.70, sill: 0, head: 2.55, panes: [1, 1], open: 0 }, // v10: black-framed glass door to the pool terrace
  { id: 'k-nook1', owner: 'kitchen', level: 0, type: 'window', at: [23.10, 13.15], w: 0.60, sill: 1.30, head: 2.20, panes: [1, 1] },
  { id: 'k-nook2', owner: 'kitchen', level: 0, type: 'window', at: [23.10, 11.55], w: 0.60, sill: 1.30, head: 2.20, panes: [1, 1] },
  { id: 'off-door', owner: 'service', level: 0, type: 'french', at: [23.10, 8.70], w: 1.70, sill: 0, head: 2.60, panes: [2, 1], open: 0 },
  // ---------------- ground, interior
  { id: 'game-d', owner: 'game', level: 0, type: 'door', at: [8.225, 5.90], w: 0.90, sill: 0, head: 2.40, open: 0 },
  { id: 'liv-d', owner: 'living', level: 0, type: 'doorway', at: [8.225, 11.70], w: 1.80, sill: 0, head: 2.55 },
  { id: 'gar-mud', owner: 'service', level: 0, type: 'door', at: [12.40, 7.125], w: 0.90, sill: 0, head: 2.40 },
  { id: 'mud-k', owner: 'service', level: 0, type: 'door', at: [16.00, 10.675], w: 0.90, sill: 0, head: 2.40, open: 0 },
  { id: 'off-d', owner: 'service', level: 0, type: 'door', at: [16.925, 9.95], w: 0.85, sill: 0, head: 2.40 },
  { id: 'pan-d', owner: 'kitchen', level: 0, type: 'door', at: [15.315, 12.90], w: 0.90, sill: 0, head: 2.40 },
  { id: 'kp-d', owner: 'kitchen', level: 0, type: 'door', at: [21.475, 12.00], w: 0.80, sill: 0, head: 2.40 },
  { id: 'pow-d', owner: 'service', level: 0, type: 'door', at: [1.60, 13.45], w: 0.75, sill: 0, head: 2.40, open: 0 }, // lead: on the living-room wall — the family-room shelving wall covered the old spot (p03 shows a door here)
  { id: 'st-d', owner: 'kitchen', level: 0, type: 'door', at: [14.45, 13.525], w: 0.80, sill: 0, head: 2.40 },
  // ---------------- upper, exterior
  { id: 'bA-front', owner: 'bedA', level: 1, type: 'window', at: [13.50, 0.35], w: 2.00, sill: 0.95, head: 2.30, panes: [3, 1] },
  { id: 'bA-side', owner: 'bedA', level: 1, type: 'window', at: [11.12, 2.40], w: 1.20, sill: 0.95, head: 2.30, panes: [2, 1] },
  { id: 'bathA-front', owner: 'bedA', level: 1, type: 'window', at: [16.80, 0.35], w: 0.90, sill: 1.10, head: 2.30, panes: [1, 2] },
  { id: 'bB-front', owner: 'bedB', level: 1, type: 'skylight', at: [20.40, 0.35], w: 1.80, sill: 0.95, head: 2.30, panes: [2, 1] }, // p27: wardrobe wall has no window (not cut)
  { id: 'bB-side', owner: 'bedB', level: 1, type: 'window', at: [23.10, 3.12], w: 1.60, sill: 1.32, head: 2.16, panes: [2, 1] },
  { id: 'bathB-win', owner: 'bedB', level: 1, type: 'window', at: [23.10, 7.12], w: 0.60, sill: 1.00, head: 1.85, panes: [1, 1] }, // p29: left of the toilet, shower beyond
  { id: 'pc-win', owner: 'primarybath', level: 1, type: 'window', at: [23.10, 12.30], w: 0.90, sill: 1.10, head: 2.30, panes: [1, 1] },
  { id: 'pb-rear', owner: 'primarybath', level: 1, type: 'window', at: [18.10, 21.65], w: 1.85, sill: 1.00, head: 2.35, panes: [2, 1] },
  { id: 'pb-rear2', owner: 'primarybath', level: 1, type: 'window', at: [19.95, 21.65], w: 0.55, sill: 1.00, head: 2.35, panes: [1, 1] },
  { id: 'pb-ne', owner: 'primarybath', level: 1, type: 'window', at: [21.70, 20.55], w: 0.70, sill: 1.20, head: 2.35, panes: [1, 1] },
  { id: 'pb-sw', owner: 'primarybath', level: 1, type: 'window', at: [15.39, 19.95], w: 0.55, sill: 1.20, head: 2.35, panes: [1, 1] },
  { id: 'pr-bal-door', owner: 'primary', level: 1, type: 'french', at: [9.43, 17.00], w: 0.95, sill: 0, head: 2.40, panes: [1, 1], open: 0 },
  { id: 'pr-rear', owner: 'primary', level: 1, type: 'doorway', at: [13.35, 17.00], w: 3.10, sill: 0, head: 2.35 }, // bay window opening (bay built by primary.js)
  { id: 'pr-sw', owner: 'primary', level: 1, type: 'skylight', at: [8.27, 15.30], w: 1.40, sill: 0.80, head: 2.40, panes: [2, 1] }, // fireplace wall has no window (p18): not cut
  { id: 'gb-b1', owner: 'theater', level: 1, type: 'window', at: [5.85, 3.98], w: 0.75, sill: 0.80, head: 2.30, panes: [1, 2] },
  { id: 'gb-b2', owner: 'theater', level: 1, type: 'window', at: [6.75, 3.53], w: 1.05, sill: 0.80, head: 2.30, panes: [1, 2] },
  { id: 'gb-b3', owner: 'theater', level: 1, type: 'window', at: [7.65, 3.98], w: 0.75, sill: 0.80, head: 2.30, panes: [1, 2] },
  { id: 'bC-front', owner: 'bedC', level: 1, type: 'window', at: [2.55, 7.07], w: 2.40, sill: 1.15, head: 2.60, panes: [3, 1] }, // p30: head hidden behind the roman shade
  { id: 'bC-sw', owner: 'bedC', level: 1, type: 'window', at: [0.35, 12.70], w: 0.90, sill: 0.95, head: 2.30, panes: [2, 1] },
  { id: 'bathC-rear', owner: 'bedC', level: 1, type: 'window', at: [6.85, 13.60], w: 0.70, sill: 1.00, head: 2.45, panes: [1, 1] }, // p31: left wall, between vanity and door
  { id: 'gal-front', owner: 'foyer', level: 1, type: 'skylight', at: [9.80, 4.43], w: 1.60, sill: 0.60, head: 2.30, panes: [2, 1] }, // p01: no window above the entry (roof); p15 reads as a wall: not cut
  // ---------------- upper, interior
  { id: 'bA-d', owner: 'bedA', level: 1, type: 'door', at: [11.27, 5.20], w: 0.85, sill: 0, head: 2.30 },
  { id: 'bathA-d', owner: 'bedA', level: 1, type: 'door', at: [17.00, 4.525], w: 0.70, sill: 0, head: 2.30 },
  { id: 'bB-d', owner: 'bedB', level: 1, type: 'door', at: [17.425, 5.30], w: 0.85, sill: 0, head: 2.30, open: 0 },
  { id: 'clB-d', owner: 'bedB', level: 1, type: 'door', at: [19.925, 6.60], w: 0.70, sill: 0, head: 2.30, open: 0 }, // closet opens off bath B (p28 wall is blank)
  { id: 'bathB-d', owner: 'bedB', level: 1, type: 'door', at: [20.45, 6.075], w: 0.75, sill: 0, head: 2.30, open: 0 }, // p29: vanity on this wall east of the door
  { id: 'th-d', owner: 'theater', level: 1, type: 'door', at: [12.40, 10.225], w: 0.90, sill: 0, head: 2.30 },
  { id: 'pr-d', owner: 'primary', level: 1, type: 'door', at: [12.60, 11.675], w: 0.95, sill: 0, head: 2.30, open: 0 },
  { id: 'vest-d', owner: 'primarybath', level: 1, type: 'door', at: [16.45, 11.675], w: 0.85, sill: 0, head: 2.30, open: 0 },
  { id: 'pr-vest-d', owner: 'primarybath', level: 1, type: 'door', at: [15.465, 12.90], w: 0.85, sill: 0, head: 2.30, open: 0 },
  { id: 'vest-bath-d', owner: 'primarybath', level: 1, type: 'doorway', at: [16.45, 14.425], w: 0.95, sill: 0, head: 2.30 },
  { id: 'vest-pc-d', owner: 'primarybath', level: 1, type: 'door', at: [19.85, 14.28], w: 0.85, sill: 0, head: 2.35, open: 0 },
  { id: 'gb-d', owner: 'theater', level: 1, type: 'door', at: [8.225, 5.25], w: 0.80, sill: 0, head: 2.30 },
  { id: 'hC-gal', owner: 'bedC', level: 1, type: 'doorway', at: [8.225, 8.80], w: 1.40, sill: 0, head: 2.30 },
  { id: 'bC-d', owner: 'bedC', level: 1, type: 'door', at: [5.235, 7.95], w: 0.85, sill: 0, head: 2.30 },
  { id: 'bathC-d', owner: 'bedC', level: 1, type: 'door', at: [8.225, 11.15], w: 0.80, sill: 0, head: 2.30 }, // p31: entered from the upper hall, vanity faces the door
];

// Roof massing (simplified; the exterior piece refines). Heights are absolute y.
export const ROOFS = [
  { id: 'garage-wing', kind: 'gable', rect: [11.12, 0.35, 23.10, 14.36], axis: 'z', plate: 6.10, ridge: 8.89, gableEnds: ['z0'] },
  { id: 'rear-ne', kind: 'gable', rect: [15.39, 14.36, 21.70, 21.65], axis: 'z', plate: 6.10, ridge: 8.40, gableEnds: ['z1'] },
  { id: 'sw-block', kind: 'hip', rect: [0.35, 4.43, 11.12, 13.60], axis: 'x', plate: 6.10, ridge: 8.60 },
  { id: 'primary', kind: 'hip', rect: [8.27, 11.60, 15.39, 17.00], axis: 'x', plate: 6.10, ridge: 8.20 },
  { id: 'family', kind: 'gable', rect: [2.35, 13.60, 8.27, 20.32], axis: 'z', plate: 3.30, ridge: 6.05, gableEnds: ['z1'] },
  { id: 'powder', kind: 'shed', rect: [0.35, 13.60, 2.35, 16.15], plate: 3.30, high: 4.20, lowSide: 'z1' },
  { id: 'turret', kind: 'pyramid', rect: [5.60, 3.53, 7.90, 4.43], plate: 6.10, ridge: 7.90 },
];
export const EAVE = 0.35;

// Photo views live in each piece's module (export const views). Photos are 1080x720 (3:2).
export const PHOTO_DIR_HINT = '../house_reference_photos/1_Palisades_mansion_listing_photos';
