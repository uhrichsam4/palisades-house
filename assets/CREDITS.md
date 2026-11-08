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
