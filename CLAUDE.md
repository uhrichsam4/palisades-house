# Palisades house — builder contract

A to-scale three.js walk-through of 17609 Camino De Yatasto (Pacific Palisades), hosted as a static
site on GitHub Pages (no build step: `index.html` + ES modules + `vendor/` via importmap). Multiplayer
(WebRTC via Trystero), Rapier physics, water/fluid characters.

**The bar is the listing photos.** `../house_reference_photos/1_Palisades_mansion_listing_photos/pNN.jpg`
(1080×720). Every room, finish and piece of furniture should match them. Do NOT use the Minecraft
renders in that folder's siblings — they are not reference.

## Run / check
- Local preview: `python3 -m http.server 8765` in this folder, open http://localhost:8765/
- Photo shots (headless Chrome, real GPU): `node tools/shot.mjs p04 p05 [--only=family,kitchen,dining]`
  → `shots/p04.png` (ours) and `shots/p04_vs.jpg` (PHOTO | OURS). Open the `_vs.jpg` with Read and compare.
  Exit code 1 + `errors` in the JSON line = your piece threw or a file 404'd. Fix before reporting.
- Free camera: `node tools/shot.mjs --cam=x,y,z,lookX,lookY,lookZ,fovDeg --name=mytest`
- Plan cutaways: `node tools/shot.mjs --top=0` / `--top=1`.
- URL flags: `?view=p04`, `?only=a,b`, `?noroof=1`, `?nopost=1`.

## Coordinates (metres, y up) — see `src/plan.js` (read it first)
- +x = north-east (garage / tennis-court end), +z = south-east (pool / canyon side). Street is at −z.
- Ground floor y=0, ground ceiling 3.05. Upper floor y=3.35, upper wall plate 6.10, ridge 8.89.
- `ROOMS[id].rect = [x0, z0, x1, z1]` are INTERIOR wall faces. Exterior walls are 0.30 thick, interior 0.15.
- Scale comes from the LA County building footprint. There is no published floor plan: the room layout
  is the lead's inference from the photos. Work within it.

## Your piece = one file: `src/rooms/<piece>.js`
```js
export const piece = { rooms: [...], photos: [...] };            // leave as given
export const ownCeiling = ['bedA'];   // rooms whose ceiling YOU build (vaults, beams, coffers); shell skips them
export const views = { p24: { pos: [x, y, z], look: [x, y, z], fov: 58 } }; // one per photo, vertical fov deg, 3:2
export async function build(ctx) { /* add everything under ctx.root */ }
```
`ctx`: `THREE`, `root` (your Group), `plan` (all of plan.js), `kit`, `phys`, `scene`, `renderer`, `camera`,
`shot` (true when rendering a photo view), `onUpdate(fn(dt, t))`, `sun`, `LIGHT`, `ENV`.
- `kit.M` shared materials (paintWhite, ceilingWhite, oakFloor, oakDoor, oakCabinet, blackMetal, matteBlack,
  brass, brushedNickel, chrome, glass, whiteQuartz, linenWhite, emissiveWarm…). Use `M.paintWhite` for painted walls.
- `kit.tex(path, {srgb, repeat})`, `kit.pbrMaps(polyHavenId, '1k'|'2k', {repeat})`, `kit.canvasTex(w,h,draw)`, `kit.rng(seed)`, `kit.noiseNormal()`.
- `kit.add(parent, geo, mat, pos, rot)`, `kit.group(parent, pos, ry)`, `kit.boxAt(parent, mat, x0,y0,z0, w,h,d)`,
  `kit.rbox(w,h,d,r)` (rounded box), `kit.cushion(w,h,d,r,puff)` (upholstery), `kit.lathe([[r,y]…])`, `kit.tube(pts,r)`,
  `kit.extrude(outline, depth, bevel)`, `kit.shakerFront(w,h)`, `kit.mergeStatic(root)`, `kit.mergeGeometries`.
- `kit.roomInfo(id)`, `kit.floorFinish(parent, roomIdOrRect, mat)`, `kit.ceilingFlat(parent, rect, y)`,
  `kit.vault(parent, rect, axis, wallY, ridgeY, mat, wallMat, flatTop)`, `kit.baseboards(parent, rect, y)`,
  `kit.canLights(parent, pts, y)`, `kit.grid(rect, nx, nz)`, `kit.wallPanel(parent, a, b, y0, y1, normal, mat)`.
- `kit.loadModel(url)` (glTF, cached clone), `kit.fitTo(obj, size, axis)`, `kit.outdoor(mat)` (exterior materials: use the real sky for reflections).
- `phys.solidGroup(group)` one static box per furniture group; `phys.solid(obj)` box per mesh;
  `phys.boxAABB(min,max)`, `phys.trimesh(worldGeo)`; `phys.dynamic(mesh, {mass, shape:'box'|'ball'|'hull'})`
  makes a pushable rigid body (players are water creatures and shove things).

## Water
Water surfaces go through `src/water/index.js` (`createWater(ctx, {outline, surfaceY, floorY, color, name})` →
`{group, disturb, splash, heightAt, isInside, addFloater}`). The pool piece calls it; the water simulation
module implements it; the characters query `waterBodies`. Don't change its signature.

## Ownership — you may edit ONLY
1. `src/rooms/<your piece>.js`
2. New files under `src/rooms/<your piece>/` and `assets/<your piece>/` (generated textures, models).
3. In `src/plan.js`: only lines of `OPENINGS` whose `owner` is your piece (move/resize your windows & doors),
   and (foyer only) `VOIDS`/`STAIR`. One minimal Edit per line; never rewrite the file.
Everything else (main.js, shell.js, kit/, physics.js, other pieces, global lighting) is the lead's. If you
need a change there, say exactly what in your report's `notes_for_lead`. Helpers you need: write them inside your file.

## Assets
- CC0 only. Poly Haven: `node tools/ph.mjs search <words> [--type=textures|models|hdris]`,
  `node tools/ph.mjs get <id> --res=1k|2k`. Files land in `assets/ph/<id>/`. Prefer 1k; 2k for big hero surfaces.
- Never put listing-photo pixels into the site (the photos are copyrighted and the site is public). Art on walls:
  recreate the feel (canvas-drawn abstract/seascape/prints) — don't crop the photo.
- Budget: ≤ 30 MB of new assets per piece. Keep the whole site loadable on a laptop.

## Quality bar (what the critic checks)
Camera framing matches the photo first (same position, height, lens). Then: room proportions, every visible
piece of furniture with the right silhouette, size, colour and material (rounded edges, cushions, legs, seams —
no plain boxes), finishes (floor species/colour, wall paint vs wallpaper/grasscloth/tile, stone veining, hardware
colour), lighting fixtures (chandeliers, pendants, sconces, cans), decor (plants, vases, books, art, rugs,
throws, pillows), window treatments, and the view through the windows.
Real-estate photos: camera height ~1.2–1.5 m, wide lens (vertical fov ~55–68° at 3:2).

## Performance + physics
- Call `ctx.kit.mergeStatic(ctx.root)` at the end of build (skips dynamic/animated objects: set
  `obj.userData.keep = true` on anything you animate). Use InstancedMesh for many repeats.
- No extra shadow-casting lights. At most 2 small non-shadow lights per piece; prefer emissive materials.
- Make furniture solid (`phys.solidGroup`) so players can't walk through it; make 2–6 small light objects per
  room dynamic (throw pillows, books, vases, balls, decor) so they react to players.
- Lighting/exposure/environment are global (lead). Report if your room looks too dark/bright in `notes_for_lead`.
