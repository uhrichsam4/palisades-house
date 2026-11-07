// Every piece of the house is one module in this folder. Each module exports:
//   export const piece = { rooms: [...room ids from plan.js], photos: ['p04', ...] }
//   export const views = { p04: { pos:[x,y,z], look:[x,y,z], fov: <vertical deg> } }   // photo cameras
//   export const ownCeiling = ['family']   // rooms whose ceiling this piece builds (shell skips them)
//   export async function build(ctx) { ... }  // add everything under ctx.root
// A failing piece is caught and reported; it never breaks the rest of the house.
export const PIECES = [
  'foyer', 'living', 'family', 'dining', 'kitchen', 'service', 'game',
  'primary', 'primarybath', 'bedA', 'bedB', 'bedC', 'theater',
  'exterior', 'pool', 'site',
];
