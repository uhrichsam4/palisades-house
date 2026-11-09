# Credits

## Built-in characters (`assets/avatars/`, listed in `src/avatars/library.js`)

All files were modified for this site: animations removed, textures resized and re-encoded as WebP, and the
heavy meshes simplified to about 90K triangles (meshoptimizer). `hostile.glb` had its main bones renamed to
Mixamo-style names, and `suit.glb` was stood upright.

| id | Name | Source | Licence |
|---|---|---|---|
| ped1–ped8, player | Miami 1–8, Miami Hero | Quaternius, Universal Base Characters, https://quaternius.itch.io/universal-base-characters (via the MiamiGame project) | CC0 1.0 |
| fox | Fox | "Fox" from the Khronos glTF Sample Assets. Model by PixelMannen (https://opengameart.org/content/fox-and-shiba) and @tomkranis (https://sketchfab.com/3d-models/low-poly-fox-by-pixelmannen-animated-371dea88d7e04a76af5763f2a36866bc); conversion and rigging by @AsoboStudio and @scurest | **CC BY 4.0**, attribution required: https://creativecommons.org/licenses/by/4.0/ |
| sam, maya | Sam, Maya | Innerscene 3D Parts Library ("Brisk Walk Sam", "Relaxed Walk Maya"), adapted from MakeHuman/MPFB CC0 assets; the lighter game versions from the real-life battle-royale project | CC0 1.0 |
| rb1–rb6, soldier | Jacket, Denim, Hoodie, Track Top, Party, Business, Soldier | Microsoft Rocketbox (Male_Adult_04, Male_Adult_12, Male_Adult_18, Male_Adult_17, Female_Party_02, Business_Female_01, Military_Male_03), https://github.com/microsoft/Microsoft-Rocketbox. Attribution: Microsoft Rocketbox | MIT, see `avatars/LICENSE-Rocketbox.txt` |
| woman | Athlete | Grab3D, woman-base, https://grab3d.com/license/ (via the white-wilds project) | CC0 1.0 |
| clavicular, hexum, mog11–mog6, ws12, meshy1, meshy2 | Clavicular, Hexum, Mogger 1–8, Backpack, Red Shirt, Big Guy | The site owner's own Meshy generations | Owner's own work |
| hostile | Street | Unknown (testtt project; MakeHuman-style rig) | **Unknown** |
| suit | Blue Suit | Unknown (testtt project; Mixamo rig) | **Unknown** |

## Character animation (`assets/anim/ual.glb`, used by `src/avatars/anim.js`)

Skeleton-only subset (15 clips, 23 bones, no meshes) built by `tools/extract_anim.mjs`.

| What | Source | Licence |
|---|---|---|
| Universal Animation Library (standard): idle, idle_look, walk, run, sprint, jump_start, jump_loop, land, fall, crouch_idle, crouch_walk, swim_idle, swim, sit_drive, wave | Quaternius, https://opengameart.org/content/universal-animation-library (via the MiamiGame project) | CC0 1.0 |

## Lived-in props (`src/furnish/`)

Everything else in the furnish module is procedural (geometry + canvas-drawn print atlas in `src/furnish/atlas.js`).

| Asset | Used for | Source | Licence |
|---|---|---|---|
| `assets/ph/steel_frame_shelves_01/` (1k) | garage shelving units | Poly Haven, "Steel Frame Shelves 01", https://polyhaven.com/a/steel_frame_shelves_01 | CC0 1.0 |

## Cars (`assets/cars/`, used by `src/cars/`)

The angular electric pickup is procedural (`src/cars/models.js`). Materials are re-made at load time; the plate texture is canvas-drawn.

| Asset | Used for | Source | Licence |
|---|---|---|---|
| `sports_car.glb` + `_lod1` | low supercar | original model made for the MiamiGame project (tools/models/land/build.py), listed CC0 in that project's assets/CREDITS.md | CC0 1.0 |
| `suv.glb` + `_lod1` | luxury SUV | same source (MiamiGame, original, CC0) | CC0 1.0 |
| `sedan.glb` + `_lod1` | grand-touring sedan | same source (MiamiGame, original, CC0) | CC0 1.0 |

## Trees (`assets/trees/`)
Branching trees and bushes for the site (`src/rooms/site/trees.js`), baked offline by `assets/trees/bake.mjs` from
**ez-tree** 1.1.0 by Daniel Greenheck (https://github.com/dgreenheck/ez-tree, npm `@dgreenheck/ez-tree`), MIT licence
(Copyright (c) 2024 Daniel Greenheck). The library is not shipped; only its generated geometry and textures are.

| Asset | Used for | Source | Licence |
|---|---|---|---|
| `trees.glb`, `trees.json` | oak / sycamore / pine / olive / 2 chaparral bushes, 2 detail levels each | generated with ez-tree presets (seeded, tweaked) | MIT (ez-tree) |
| `leaves.png` | leaf-sprig atlas (oak, ash, pine, olive = recoloured ash) | ez-tree `src/lib/assets/leaves/*` | MIT (ez-tree package) |
| `bark_color.jpg`, `bark_normal.jpg` | bark (512 px) | Poly Haven `bark_brown_02` (as shipped in ez-tree) | CC0 1.0 |

## RTX-look (src/look, src/sky/rain.js) — code techniques, MIT
- Light shafts + dust look (soft edges, shaft fade, two multiplied scrolling noise layers): TrentSterling/threejs-volumetric-beam, MIT, (c) 2026 Trent Sterling — re-implemented as window-shaped sun prisms in src/look/beams.js.
- Rain streak + splash ring shapes: Ashwyn28/weather-effects, MIT, (c) 2026 Ashwyn Annauth — src/sky/rain.js.
- Lawn grass (wind bend, back-lit translucency, trample): muratkamci/snakey-locomotion, MIT, (c) 2026 Murat Kamci; distance LOD idea: paulrobello/grass-blade, MIT — src/look/grass.js.
- Film look: three.js AgXToneMapping (MIT) + procedural 3D LUT grade — src/look/film.js.
