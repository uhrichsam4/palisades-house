// Water API (contract). The pool piece CALLS createWater; the water module (src/water/*) IMPLEMENTS it;
// characters (src/fluid, src/player) QUERY waterBodies to swim/splash. Keep this signature stable.
//
//   const water = createWater(ctx, {
//     outline: [[x,z], ...],   // water surface polygon in world XZ (pool + spa can be separate bodies)
//     surfaceY: -0.08,         // still-water height (world y)
//     floorY: (x, z) => y,     // pool floor height at a point (for depth tint / caustics); or a number
//     color: 0x2fb7c9,         // shallow tint (photos: clear turquoise over white/grey plaster)
//     name: 'pool',
//   });
//   water.group            // THREE.Group already added under ctx.root
//   water.disturb(x, z, radius, strength)   // push the surface (ripples)
//   water.splash(x, y, z, strength)         // droplets + ripple ring
//   water.heightAt(x, z)                    // current surface y
//   water.isInside(x, z)                    // inside outline?
//   water.addFloater(dynamicBodyRecord, { volume, density }) // buoyancy for phys.dynamic(...) results
//
// This file is the STUB (flat glossy surface) so the pool piece can be built before the simulation lands.
import * as THREE from 'three';

export const waterBodies = [];

export function createWater(ctx, opt) {
  const { THREE: T = THREE, root, kit } = ctx;
  const outline = opt.outline; const surfaceY = opt.surfaceY ?? 0;
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ShapeGeometry(shape, 8); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: opt.color ?? 0x2fb7c9, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.55, ior: 1.33, depthWrite: false });
  kit?.outdoor?.(mat);
  const mesh = new THREE.Mesh(geo, mat); mesh.position.y = surfaceY; mesh.name = 'water:' + (opt.name || 'pool'); mesh.renderOrder = 3; mesh.userData.keep = true;
  const group = new THREE.Group(); group.name = 'water'; group.userData.keep = true; group.add(mesh); root.add(group);
  const inside = ([x, z]) => { let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const [xi, zi] = outline[i], [xj, zj] = outline[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
  const api = {
    name: opt.name || 'pool', group, mesh, surfaceY, outline,
    disturb() {}, splash() {}, heightAt: () => surfaceY, isInside: (x, z) => inside([x, z]), addFloater() {},
  };
  waterBodies.push(api); return api;
}
