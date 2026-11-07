// Piece: pool — Pool + spa + sunken lounge, deck, fire pit, outdoor furniture, rear lawn/fence; interactive water
// Owned rooms: (exterior) | Reference photos: p38, p39, p40
// NOTES FROM THE WATER-SIMULATION BUILDER (read before building; src/water/index.js has the full API):
//  - Call createWater(ctx, {...}) once per body (pool, spa). Outline = ONE polygon per body; the sunken
//    lounge platform can be a notch in it. Pass color: 0x2fb7c9. Optional: tintPath (lower = deeper colour),
//    reflect (0.85), causticGain (0.9), captureScale (0.75).
//  - Pass floorY as a FUNCTION (x, z) => y that matches your real floor exactly (steps, sun shelf, deep end):
//    depth colour, refraction and caustics depend on it; the caustic overlay sits 6 mm above it.
//  - Pool interior: pale white/grey plaster ≈ #e4e9e8 with receiveShadow; walls + coping castShadow.
//  - Coping overhangs the water edge by 2–3 cm.
//  - Floating props: water.addFloater(ctx.phys.dynamic(mesh, {...}), {}) (add the mesh to ctx.root first).
export const piece = { rooms: [], photos: ["p38", "p39", "p40"] };
export const ownCeiling = [];
export const views = {};
export async function build(ctx) {}
