# Look-development guide (realism rules for every piece)

Distilled from five research passes (fabrics, interior lighting, outdoor world, furniture/objects,
glass/metal/fixtures) for three.js r187 WebGL. Global lighting is already handled by the lead:
per-room light probes with one bounce + **box-projected reflections** (reflections line up with the
room's walls), sun shadows, N8AO, white balance, highlight bloom (threshold 1.6), NeutralToneMapping.
Your job is geometry + materials + fixtures that respond to that lighting.

## Upholstery & soft goods — use `kit.fabric.*` (sheen-based, CC0 scans, neutral maps tinted by colour)
- `velvet('#4a5226')` olive/curved sofas · `boucle('#efe9df')` chairs/ottomans · `linen()` upholstery,
  drapes, bedding · `knit()` chunky throws · `cotton()` duvets/towels · `leather('#3a2a20')` recliners ·
  `sheer()` sheer curtains (alpha, double-sided, never transmission). Option `{scale}` = repeats per UV unit.
- Geometry beats texture for silhouettes:
  - Bevels: hard furniture 8–25 mm, cabinet doors 2–3 mm, tabletops 3–6 mm, upholstered frames 30–80 mm,
    cushions 20–35 % of their shortest side. Rounded boxes with 4–6 segments (low segments look plastic).
    Vary radii ±20 % between pieces.
  - Cushions: subdivide (~24×24 per face), puff the top `y += puff*(1-(u²+v²)/2)`, add a low-frequency sag
    and an `abs(sin)` crease where seat meets back, pull corners in; `computeVertexNormals()`.
  - Channel tufting: displace across the width `y -= depth*pow(abs(sin(PI*x/pitch)),0.5)`; diamond tufting:
    pinch button points `exp(-d²/σ²)` + small button spheres.
  - Piping/welts: `TubeGeometry` (r 6–10 mm) along cushion top/bottom edge loops, same fabric, rougher.
  - Duvets/throws: never a box. Subdivided plane draped over the bed/sofa heightfield
    (`y = min(y, surface+offset)`), rounded overhang with corner sag, fold noise perpendicular to the drape;
    pintuck = periodic ridges + pinched stitch points.
- Rugs: one unique pattern texture as `map` + a tiling wool normal/AO (ambientCG `Carpet016`), roughness ~1,
  sheen 0.2–0.4. Thin rounded edge geometry so it reads as a rug, not a decal.

## Hard surfaces
- Cabinetry: every door/drawer its own rounded box with a 2–3 mm gap and a dark reveal box behind;
  shaker = inset centre panel; toe kick inset 60–80 mm, 100–120 mm tall, darker; real pulls/knobs.
- Stone/wood/tile CC0 (download with `node tools/acg.mjs get <Id>` or `node tools/ph.mjs get <id>`):
  white marble ambientCG `Marble012` `Marble016` `Marble021` · travertine `Travertine009` `Travertine005` ·
  white tile `Tiles107` `Tiles040` + per-tile colour jitter/bumpy normal for zellige · wide-plank oak
  `WoodFloor051` `WoodFloor043` · oak veneer Poly Haven `white_oak_veneer` · Nero Marquina: no CC0 scan —
  paint it (dark grey #262625–#3a3b3a base, sparse thin white veins), never pure black.
  Large stone slabs: avoid visible repeats (offset/rotate UVs per slab, add low-frequency variation).
- Variation kills the CG look: roughness ±0.1 low-frequency noise, slightly glossier wear on handled edges,
  baked vertex-colour AO in seams/under cushions.

## Metals (MeshPhysicalMaterial)
- Brushed stainless: `color 0xc8cacc, metalness 1, roughness 0.32, anisotropy 0.7` (+ fine horizontal streak
  roughnessMap). Polished nickel `0xd9dadb, rough 0.12–0.18`. Brushed nickel `rough 0.35, anisotropy 0.4`.
  Unlacquered/brushed brass `0xd4a84b, rough 0.28–0.35, anisotropy 0.4` (polished 0.15).
  Matte black hardware `0x151515, metalness 0.8, rough 0.45`.

## Glass & mirrors
- Window/shower panes: thin fake glass — `MeshPhysicalMaterial({transparent:true, opacity:0.08, roughness:0.02,
  ior:1.5, specularIntensity:1, depthWrite:false})`; shower glass slightly green `0xeaf6f0` + a thin edge strip
  (transmission 1, thickness 0.02, attenuationColor (0.55,0.85,0.7), attenuationDistance 0.05). Explicit
  `renderOrder`; don't stack transmissive meshes.
- Glass pendants/globes: low-opacity glossy shell + inner emissive bulb (cheap), or transmission (thickness
  0.02–0.05, ior 1.45) for at most a few. Frosted globes: opaque, warm emissive, rough 0.4.
- Bathroom/vanity mirrors: `Reflector` from `three/addons/objects/Reflector.js` (textureWidth/Height ≈ 0.6 ×
  canvas, `clipBias 0.003`, `color 0xd8e0e0`, multisample 0–2), placed 2 mm in front of the wall inside a frame;
  set `mirror.visible` only when the camera is in that room (ctx.onUpdate + kit.roomInfo). One per room max.

## Light fixtures
- Lit parts are emissive with `emissiveIntensity` high enough to pass the bloom threshold (linear value > 1.6,
  e.g. 4–12 for bulbs/neon, 1.5–3 for diffusers). Keep everything else below it.
- Cans: emissive disc + (only for the 1–2 that matter in a photo) a non-shadow SpotLight pool.
  Sconces/picture lights: emissive diffuser + additive radial-gradient wall-wash quad.
  Neon: emissive tube + colour-matched PointLight. TV screens: emissive map (+ RectAreaLight only if needed;
  call `RectAreaLightUniformsLib.init()`).
- Max 2 extra real-time lights per piece (no shadows). IESSpotLight is WebGPU-only — don't use it.

## Models & plants (Poly Haven CC0 glTF, 1k): `node tools/ph.mjs get <id> --res=1k`
- Plants: `potted_plant_04`, `anthurium_botany_01`, `calathea_orbifolia_01`, `fern_02`, `pachira_aquatica_01`
  (closest to fig/palm), `potted_plant_01/02` (heavy: one each max). No CC0 fiddle-leaf/kentia/olive/orchid:
  build those as alpha-card leaves (curved 3×3 quads, `alphaTest 0.5`, DoubleSide, per-leaf colour variation).
- Decor: `ceramic_vase_01..04`, `wicker_basket_01/02`, `book_encyclopedia_set_01`, `throw_pillows_01`.
- Furniture accents if the style fits: `Ottoman_01`, `side_table_01`, `modern_coffee_table_01`,
  `mid_century_lounge_chair`, `bar_chair_round_01`, `Chandelier_01..03`, `lantern_chandelier_01`.
  Hero pieces (tufted sofas, wingback beds, recliners, islands, ranges) stay procedural.

## Outdoor
- Exterior materials call `kit.outdoor(mat)`. Ground: blend 3–4 CC0 layers by slope/height + macro noise
  (Poly Haven `aerial_grass_rock`, `brown_mud_dry`, `aerial_ground_rock`). Far hills: 3–4 layered ridge meshes,
  each hazier/bluer; `THREE.Fog`-style haze toward the horizon colour.
- Vegetation: Poly Haven `shrub_01..04`, `island_tree_01..03`, `jacaranda_tree`, `tree_small_02`,
  `searsia_lucida`, `grass_medium_01/02`, `pine_tree_01` (tint toward California chaparral greens).
  Use InstancedMesh per species; keep near-field detail tight; no palms/oaks/sycamores exist in CC0 —
  approximate (alpha-card palm fronds on a trunk; tinted island trees for oaks).
- Tennis court: canvas-drawn acrylic (playing area muted blue-grey green ≈ #5d6b6a, surround darker green),
  crisp white lines, windscreen = tall alpha-mapped strip with `alphaTest`.

## Performance
1k textures by default, 2k only for hero surfaces; share textures; `kit.mergeStatic(ctx.root)` at the end;
InstancedMesh for repeats (chairs, pulls, beads, plants); no extra shadow-casting lights.
