// What every prop is made of and how it behaves (src/smash). Pure rules, no three.js state.
//   classifyPiece({name, size:[x,y,z], nm (meshes), mats:[{name, transparent, metal}], piece}) -> rule | null
//   classifyFurnish({name, kind, fragile, mass, room, size}) -> rule | null
//   classifyDynamic({name, mats, mass, size, piece}) -> rule
// rule = { mode: 'dynamic' | 'static', material, mass, label, hpScale? }
//   dynamic: becomes a rigid body (pick up when <= 25 kg); static: stays merged, still registered with the damage model
//   (a big enough hit breaks it: its triangles are hidden and it bursts into debris).
const has = (s, ...w) => w.some(x => s.includes(x));
const vol = (s) => s[0] * s[1] * s[2];

// ---- room-piece furniture (groups the pieces made solid with phys.solidGroup / phys.solid)
const PIECE_RULES = [
  // [name test, rule]
  [/^(chair)$/, { mode: 'dynamic', material: 'wood', mass: 8, label: 'dining chair' }],
  [/^stool$/, { mode: 'dynamic', material: 'wood', mass: 6, label: 'stool' }],
  [/^deskchair$/, { mode: 'dynamic', material: 'plastic', mass: 9, label: 'desk chair' }],
  [/^fam-chair$/, { mode: 'dynamic', material: 'fabric', mass: 22, label: 'armchair' }],
  [/^loungechair$/, { mode: 'dynamic', material: 'fabric', mass: 24, label: 'lounge chair' }],
  [/^fam-sidetable$/, { mode: 'dynamic', material: 'wood', mass: 7, label: 'side table' }],
  [/^fam-coffee$/, { mode: 'dynamic', material: 'wood', mass: 24, label: 'coffee table' }],
  [/^coffeetable$/, { mode: 'dynamic', material: 'wood', mass: 32, label: 'coffee table' }],
  [/^stump$/, { mode: 'dynamic', material: 'wood', mass: 16, label: 'stump table' }],
  [/^bench$/, { mode: 'dynamic', material: 'wood', mass: 14, label: 'bench' }],
  [/^beanbag$/, { mode: 'dynamic', material: 'fabric', mass: 6, label: 'bean bag' }],
  [/^plant$/, { mode: 'dynamic', material: 'ceramic', mass: 16, label: 'potted plant' }],
  [/^fam-plantstand$/, { mode: 'dynamic', material: 'ceramic', mass: 9, label: 'plant stand' }],
  [/^fam-trough$/, { mode: 'dynamic', material: 'ceramic', mass: 6, label: 'planter trough' }],
  [/^popcorncart$/, { mode: 'dynamic', material: 'metal', mass: 30, label: 'popcorn cart' }],
  [/^table$/, { mode: 'dynamic', material: 'wood', mass: 30, label: 'kitchen table' }],
  [/^dining-table$/, { mode: 'static', material: 'wood', label: 'dining table', refine: true }],
  [/^(toilet|toiletc)$/, { mode: 'static', material: 'porcelain', label: 'toilet' }],
  [/island$/, { mode: 'static', material: 'stone', label: 'kitchen island' }],
  [/^fridgewall$/, { mode: 'static', material: 'metal', label: 'fridge wall' }],
  [/^(reclinerrow|fam-sofa)$/, { mode: 'static', material: 'fabric', label: 'sofa' }],
  [/^numberpillar$/, { mode: 'static', material: 'concrete', label: 'number pillar' }],
  [/^(gbdoor)$/, null],
  [/^(dining-table|console|sideboard|fam-console|wardrobe|desk|vanity|dresser|linen|nightstand|nightstandc|shelving|coffeeleft|coffeeright|wetbar-back|wetbar-right)$/, { mode: 'static', material: 'wood', label: 'cabinet' }],
];
export function classifyPiece(r) {
  const n = (r.name || '').toLowerCase(); const s = r.size; const mx = Math.max(s[0], s[2]);
  if (r.piece === 'site' || mx > 4.8 || s[1] > 3.2) return null;           // neighbour houses, wall runs
  for (const [re, rule] of PIECE_RULES) if (re.test(n)) {
    if (!rule) return null;
    const out = { ...rule };
    if (n === 'desk' && r.mats.some(m => m.transparent)) { out.material = 'glass'; out.hpScale = 4; out.label = 'glass desk'; }
    if (/vanity|linen|coffeeleft|coffeeright/.test(n) && r.piece === 'primarybath') out.material = 'stone';
    return out;
  }
  if (n) return null; // a named thing we don't know: leave it alone
  // ---- unnamed groups: judge by size and materials
  if (r.nm < 2) { // single meshes: only a self-contained small object counts (pieces use these for walls/shelves/glass)
    if (s[1] > 0.25 && s[1] < 1.2 && mx < 0.8 && Math.min(s[0], s[2]) > 0.2) return { mode: 'static', material: 'wood', label: 'side table' };
    return null;
  }
  const fab = r.mats.filter(m => /^fabric:/.test(m.name)).length / Math.max(1, r.mats.length);
  const glass = r.mats.some(m => m.transparent);
  const leafy = r.mats.some(m => /7d9a4a|55703a/.test(m.color));
  if (r.piece === 'pool' || r.piece === 'decor') {
    if (leafy) return { mode: 'static', material: 'concrete', label: 'concrete planter' };
    if (glass) return { mode: 'static', material: 'glass', label: 'glass table', hpScale: 1.4 };
    if (r.piece === 'decor') return { mode: 'static', material: 'metal', label: 'patio heater' };
    return { mode: 'static', material: 'fabric', label: 'outdoor sofa' };
  }
  if (fab > 0.5 && mx < 1.25 && s[1] < 1.05) return { mode: 'dynamic', material: 'fabric', mass: mx > 1 ? 22 : 15, label: s[1] < 0.7 ? 'ottoman' : 'armchair' };
  if (mx < 0.8 && s[1] < 0.9) return { mode: 'static', material: 'wood', label: 'nightstand' };
  return { mode: 'static', material: 'wood', label: 'furniture' };
}

// ---- furnish props (src/furnish: userData.furnish)
export function classifyFurnish(f) {
  const n = f.name.toLowerCase(); const s = f.size; const mx = Math.max(s[0], s[1], s[2]);
  let material = 'plastic';
  if (f.kind === 'throwable') material = has(n, 'stone', 'rock') ? 'stone' : 'rubber';
  else if (has(n, 'basketball', 'football')) material = 'rubber';
  else if (has(n, 'wine', 'decanter', 'liquor', 'glass', 'bottle', 'perfume', 'terrarium')) material = 'glass';
  else if (has(n, 'mug', 'place setting', 'table settings', 'fruit bowl', 'crock', 'dog bowls', 'plate', 'vase')) material = 'ceramic';
  else if (has(n, 'potted', 'planter')) material = mx > 1.1 || f.mass >= 30 ? 'concrete' : 'ceramic';
  else if (has(n, 'mailbox')) material = 'metal';
  else if (has(n, 'book', 'magazine', 'paper', 'mail', 'board game', 'pizza', 'tp ', 'towel', 'throw', 'blanket', 'robe', 'clothes', 'bath mat', 'cushion',
    'bag', 'backpack', 'teddy', 'hamper', 'laundry', 'bean bag', 'dog bed', 'slipper', 'sneaker', 'hose', 'flamingo', 'noodle', 'popcorn', 'candy', 'golf', 'shopping', 'suitcase', 'umbrella')) material = 'fabric';
  else if (has(n, 'kettle', 'toaster', 'mixer', 'fridge', 'grill', 'shelving', 'bike', 'mailbox', 'workbench', 'outdoor chair', 'bar cart', 'cans', 'scale')) material = 'metal';
  else if (f.kind === 'electronics') material = f.fragile ? 'glass' : 'plastic';
  else if (has(n, 'dresser', 'piano', 'arcade', 'table', 'chair', 'cutting board', 'knife block', 'rod', 'bench', 'shelf')) material = 'wood';
  else if (has(n, 'bin', 'tubs', 'lounger', 'vacuum', 'detergent', 'toiletries', 'sink things', 'soap', 'speaker', 'duck', 'cup')) material = 'plastic';
  else if (f.fragile) material = 'glass';
  const label = f.name;
  // whole shelf rows of things (pantry, garage, storage) stay put; they still break into a heap of debris
  if (/shelf \d|island top|patio umbrella|surfboards|dish towel/.test(n)) return { mode: 'static', material: /liquor/.test(n) ? 'glass' : material, label, hpScale: 2 };
  if (/liquor shelf/.test(n)) return { mode: 'static', material: 'glass', label, hpScale: 1.5 };
  const mass = f.mass || 1;
  if (mass > 45 || mx > 2.2 || has(n, 'piano', 'arcade', 'workbench', 'grill', 'shelving', 'clothes rod', 'dresser', 'outdoor dining table', 'beer fridge', 'potted olive', 'potted plant', 'mailbox', 'bar cart', 'tv on dresser'))
    return { mode: 'static', material, label, refine: /table/.test(n) };
  if (s[1] < 0.012) return null; // bath mats, rugs: flat, nothing to move
  return { mode: 'dynamic', material, mass, label };
}

// ---- dynamic props the room pieces already made (vases, books, orchids, pillows…): material only
export function classifyDynamic(d) {
  const n = (d.name || '').toLowerCase(); const mats = d.mats || [];
  if (has(n, 'stone', 'rock')) return { material: 'stone', label: n };
  if (has(n, 'ball')) return { material: 'rubber', label: n };
  if (has(n, 'decanter', 'glass', 'terrarium', 'bottle', 'apothecary', 'jar', 'ice-bucket')) return { material: 'glass', label: n };
  if (has(n, 'vase', 'orchid', 'succulent', 'coral', 'lamp', 'bowl', 'mug', 'plate', 'pot')) return { material: 'ceramic', label: n };
  if (has(n, 'book', 'popbox', 'basket', 'pillow', 'cushion', 'throw', 'towel', 'blanket')) return { material: 'fabric', label: n };
  if (has(n, 'stool', 'tray', 'chair')) return { material: 'wood', label: n };
  if (mats.some(m => /^fabric:/.test(m.name) || m.sheen)) return { material: 'fabric', label: n || 'pillow' };
  if (mats.some(m => m.transparent)) return { material: 'glass', label: n || 'glass' };
  if (mats.some(m => m.metal)) return { material: 'metal', label: n || 'metal thing' };
  if (d.mass < 3) return { material: 'ceramic', label: n || 'decor' };
  return { material: 'wood', label: n || 'thing' };
}

// a realistic "face" area for the damage model's hp (m²): small things are fragile, big panels take more
export function faceArea(size, hpScale = 1) { const d = [...size].sort((a, b) => b - a); return Math.max(0.02, d[0] * d[1] * 0.5) * hpScale; }
export const PICKUP_MAX_KG = 25;
export { vol };
