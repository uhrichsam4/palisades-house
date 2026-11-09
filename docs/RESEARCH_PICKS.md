# Research picks (2026-11-08) — what to borrow, for which builder

All licences checked on the repo (MIT unless noted). "Study only" = no licence: read the idea, don't copy code.
Everything must stay WebGLRenderer r187 + our EffectComposer, no bundler (copy shader snippets / small ES files into vendor/ or src/).

## Look (RTX-look builder)
- AgX tone mapping + 3D LUT grade in OutputPass (core three). ~0.1 ms.
- TAA: custom jittered projection + depth reprojection accumulator (no good WebGL lib; realism-effects needs pmndrs/postprocessing).
- FSR 1 (EASU+RCAS) single-pass GLSL port, MIT: https://gist.github.com/atyuwen/78d6e810e6d0f7fd4aa6207d416f2eeb (reference: https://github.com/GPUOpen-Effects/FidelityFX-FSR).
- Light shafts: TrentSterling/threejs-volumetric-beam (MIT, raw GLSL, one additive quad per beam) — windows/skylights + dust.
- Weather shaders: Ashwyn28/weather-effects (MIT, importmap, r160+) — rain/snow/hail/fog/lens droplets/splashes.
- Pool caustics: ScottieFox/caustic-volume (MIT, r186 WebGL2, no build) — bake/downsample onto pool + spa floor.
- Sky: Rostislav-Kr/skystudio-360 (MIT, importmap + vendored three) — 12 cloud types baked to a 2048×1024 RT on weather/time change.
- Ocean modules to mine: oh-ashen-one/threejs-photoreal-ocean (MIT) — Voronoi foam, caustic god-rays, Worley cloud dome.
- Lamp glow: siyuhuh/threelight (MIT, Vite; extract LTC area-light glow shaders).
- God rays (MAX/photo only, licence unverified): Ameobea/three-good-godrays (pmndrs-based).
- Fabric: core MeshPhysicalMaterial sheen / sheenRoughness / sheenColor.
- Materials: smithmw7/rock-lab (MIT, Vite) — noise normal relief, wood grain, translucency, snow + wet asphalt recipes.
- Grass: muratkamci/snakey-locomotion (MIT) — toroidal tile grid, wind, translucency, trample map; paulrobello/grass-blade (MIT) — chunk culling + LOD; Steve245270533/three-stylized (MIT) — blades sampled over a surface mesh.
- Forest scatter idea: AskAlice/threejs-worldgen (Apache-2.0, WebGPU) — blue-noise tiles + pooled instancing + impostors (copy the algorithm only).

## Physics / destruction (smash, building, disasters, boxing builders)
- Fracture: @dgreenheck/three-pinata 2.0.1 (MIT, three >=0.158, build/three-pinata.es.js 63 KB) — Voronoi fracture with Rapier.
- Glass: StarKnightt/glass-break (MIT, Vite/TS) — worker Voronoi via d3-delaunay, shards + glitter + crack lines.
- Building destruction: jorgesousa/faultline (MIT, Rapier, importmap) — voxel destruction, collapsing floors, toppling, chain explosions.
- Ragdolls: winchxyz/wumpus-torture-simulator (MIT, importmap + Rapier 0.14, built with Claude Code) — 9-body Rapier joint ragdoll, balance controller, limp-on-hit blending.
- Ragdoll reactions: lbcrv/boneyard (MIT, cannon-es — port ideas) — flail, brace, curl, get-up; instanced debris.
- IK feet: majidmanzarpour/threejs-procedural-animals (MIT) — IK gaits/foot placement.
- Study only: des35swim/hood-warfare (destructible block), aphix/crush-stream (soft-body car crumple), 8vdpxdrv4c-dot/threejs-effects-demos (tiled grass), ironadd/threejs-pond (GPGPU water).

## Skip
WebGPU/TSL-only (Grassworks, minamo, Eanpa-Sky, worldgen grass), takram clouds (beta, heavy), Ultra-Water as a pool, three-environment-shadows (no licence), three-dlss-nr (WebGPU, no weights), openvdb (deprecated WebGL path), three.wasm (joke).

## From X (searched in the user's Chrome, posts since 2026-09-08)
- sbobyn/three-voxel-destruction + sbobyn/three-avbd (MIT, but WebGPU): Teardown-style city block — storeys give way when what carries them is cut, glass shatters, rubble settles and FREEZES (sleeps) to stay cheap; GPU auto-tunes how many loose pieces. Can't drop into WebGL — copy the design: support graph per wall/floor panel, collapse when supports break, rubble → sleep → merge.
- @itsfazley rainy forest camp (2026-11-07): rain = 24k GPU-instanced streaks in a camera-following box, animated in the vertex shader, culled under the awning, fade with fog — same design as our rain; confirms it.
- @zackontopx browser storm (2026-09-11): volumetric clouds + FFT waves + rain + lightning, inspired by Dan Greenheck's ocean/sky work (repo not found).
- @chirovisuals Elemental Sandbox (MIT, 2026-09-14) + 9 open-source cinematic spells (abilitycastingthreejs.chirostudio.xyz) — fire/water/lightning VFX references for Natural Disasters.
- @mlperego water with Claude (2026-10-01, 1.4K likes) — "since everyone is doing something with water"; @Ian_cadle = Humpalumps/Ultra-Water.
- Skip: Grassworks (@Bk23544, commercial/WebGPU), Eanpa-Sky (WebGPU), CastellanoWorks meshlet path tracer (WebGPU).
