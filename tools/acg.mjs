#!/usr/bin/env node
// ambientCG (CC0) texture helper — complements tools/ph.mjs (Poly Haven).
//   node tools/acg.mjs search <words...>            -> list matching asset ids
//   node tools/acg.mjs get <Id> [--res=1K|2K]       -> assets/acg/<Id>/<Id>_<map>.jpg (Color, NormalGL, Roughness, AmbientOcclusion, Displacement)
// Prints the relative paths to use from the site.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'palisades-house-builder' };
const args = process.argv.slice(2); const opt = {}; const pos = [];
for (const a of args) { const m = a.match(/^--(\w+)=(.*)$/); if (m) opt[m[1]] = m[2]; else pos.push(a); }
const cmd = pos.shift();
if (cmd === 'search') {
  const q = encodeURIComponent(pos.join(' '));
  const r = await (await fetch(`https://ambientcg.com/api/v2/full_json?q=${q}&type=Material&limit=40&sort=Popular`, { headers: UA })).json();
  for (const a of r.foundAssets || []) console.log(a.assetId.padEnd(18), '|', (a.tags || []).slice(0, 8).join(','));
} else if (cmd === 'get') {
  const id = pos[0]; const res = (opt.res || '1K').toUpperCase(); const dir = path.join(ROOT, 'assets/acg', id);
  const want = ['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion', 'Displacement'];
  const have = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  if (!have.some(f => f.includes('_Color'))) {
    const r = await (await fetch(`https://ambientcg.com/api/v2/full_json?id=${id}&include=downloadData`, { headers: UA })).json();
    const a = r.foundAssets?.[0]; if (!a) { console.error('not found', id); process.exit(1); }
    const dl = a.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find(d => d.attribute === `${res}-JPG`);
    if (!dl) { console.error('no', res, 'JPG for', id); process.exit(1); }
    fs.mkdirSync(dir, { recursive: true });
    const zip = path.join(dir, '_tmp.zip'); fs.writeFileSync(zip, Buffer.from(await (await fetch(dl.downloadLink, { headers: UA })).arrayBuffer()));
    execFileSync('unzip', ['-o', '-q', zip, '-d', dir]); fs.rmSync(zip);
    for (const f of fs.readdirSync(dir)) { // normalise names: <Id>_1K-JPG_Color.jpg -> <Id>_Color.jpg ; drop previews/GL-irrelevant files
      const m = f.match(/_(Color|NormalGL|Roughness|AmbientOcclusion|Displacement|Opacity|Metalness)\.jpg$/);
      if (m) fs.renameSync(path.join(dir, f), path.join(dir, `${id}_${m[1]}.jpg`)); else fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    }
  }
  for (const f of fs.readdirSync(dir).sort()) console.log(path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/'));
} else console.log('usage: search <words> | get <Id> [--res=1K|2K]');
