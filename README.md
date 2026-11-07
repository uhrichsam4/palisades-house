# 17609 Camino De Yatasto — walk-through

A to-scale, multiplayer three.js walk-through of a Pacific Palisades house, rebuilt room by room from
its listing photos. Static site: no build step, works on GitHub Pages.

## Play
Open the site, click to walk. WASD move · Shift run · Space jump · E open/close doors · V camera ·
P path-traced photo mode · T chat. Share the URL (it carries `?room=<code>`) to walk around together.

## Host on GitHub Pages
1. Create a repo and push this folder (the `.gitignore` already leaves out `node_modules/` and `shots/`).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/` after a minute.
Multiplayer uses WebRTC with public Nostr relays for signalling (Trystero), so no server is needed.
Players behind strict corporate NATs may fail to connect peer-to-peer (no TURN server is configured).

## Develop
- `python3 -m http.server 8765` → http://localhost:8765/
- `node tools/shot.mjs p04` renders the camera that matches listing photo p04 and writes `shots/p04_vs.jpg`
  (needs the reference photos in `../house_reference_photos/`, which are never committed).
- `node tools/shot.mjs p04 --pt=256` renders a path-traced still of the same view.
- How pieces are built and judged: see `CLAUDE.md`.

## Scale and sources
- Footprint: LA County LARIAC 2020 building outline (BLD_ID 388092851226); no floor plan was published, so
  the interior layout is inferred from the listing photos.
- Textures/HDRI/models: Poly Haven (CC0). Libraries: three.js, Rapier, Trystero, N8AO, three-gpu-pathtracer (MIT/Apache).
- Listing photos belong to their photographers/brokerage and are not part of this site.
