// Piece: site — Terrain, tennis court, canyon/hills backdrop, neighbouring context
// Owned rooms: (exterior) | Reference photos: p41, p42, p43, p45
export const piece = { rooms: [], photos: ["p41", "p42", "p43", "p45"] };
export const ownCeiling = [];
export const views = {};
export async function build(ctx) {
  // placeholder ground until the site piece replaces it
  const { THREE } = ctx;
  // hole over the pool + spa basin (pool piece: deck hole x 3.3..16.3, z 22.7..27.9)
  const H = [3.3, 22.7, 16.3, 27.9], cx = 11.7, cz = 11;
  const shape = new THREE.Shape(); shape.absarc(0, 0, 400, 0, Math.PI * 2, false);
  shape.holes.push(new THREE.Path([[H[0], H[1]], [H[2], H[1]], [H[2], H[3]], [H[0], H[3]]].map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz)))));
  const g = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7f8a5a, roughness: 1 }));
  g.position.set(cx, -0.31, cz); g.receiveShadow = true; ctx.root.add(g);
  const box = (x0, z0, x1, z1) => ctx.phys.boxAABB([x0, -1.31, z0], [x1, -0.31, z1]);
  box(-200, -200, 220, H[1]); box(-200, H[3], 220, 220); box(-200, H[1], H[0], H[3]); box(H[2], H[1], 220, H[3]);
}
