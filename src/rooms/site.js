// Piece: site — Terrain, tennis court, canyon/hills backdrop, neighbouring context
// Owned rooms: (exterior) | Reference photos: p41, p42, p43, p45
export const piece = { rooms: [], photos: ["p41", "p42", "p43", "p45"] };
export const ownCeiling = [];
export const views = {};
export async function build(ctx) {
  // placeholder ground until the site piece replaces it
  const { THREE } = ctx;
  const g = new THREE.Mesh(new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7f8a5a, roughness: 1 }));
  g.position.set(11.7, -0.31, 11); g.receiveShadow = true; ctx.root.add(g);
  ctx.phys.boxAABB([-200, -1.31, -200], [220, -0.31, 220]);
}
