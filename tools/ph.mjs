#!/usr/bin/env node
// Poly Haven (CC0) asset helper.
//   node tools/ph.mjs search <words...> [--type=textures|models|hdris]   -> list matching ids
//   node tools/ph.mjs get <id> [--res=1k|2k|4k] [--maps=diff,nor_gl,rough,ao,arm,disp]
// Files land in assets/ph/<id>/. Prints the relative paths to use from the site.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'palisades-house-builder' };
const args = process.argv.slice(2); const opt = {}; const pos = [];
for (const a of args) { const m = a.match(/^--(\w+)=(.*)$/); if (m) opt[m[1]] = m[2]; else pos.push(a); }
const cmd = pos.shift();
async function j(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
async function dl(url, out) {
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(url + ' ' + r.status);
  const tmp = out + '.part' + process.pid; fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer())); fs.renameSync(tmp, out); return out;
}
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
if (cmd === 'search') {
  const types = opt.type ? [opt.type] : ['textures', 'models', 'hdris'];
  const words = pos.map(w => w.toLowerCase());
  for (const t of types) {
    const all = await j('https://api.polyhaven.com/assets?t=' + t);
    const hits = Object.entries(all).filter(([id, v]) => {
      const hay = (id + ' ' + v.name + ' ' + (v.tags || []).join(' ') + ' ' + (v.categories || []).join(' ')).toLowerCase();
      return words.every(w => hay.includes(w));
    });
    console.log(`# ${t}: ${hits.length}`);
    for (const [id, v] of hits.slice(0, 60)) console.log(id.padEnd(36), '|', (v.categories || []).join(','), '|', (v.tags || []).slice(0, 8).join(','), v.dimensions ? '| dims(mm)=' + v.dimensions.join('x') : '');
  }
} else if (cmd === 'get') {
  const id = pos[0]; const res = opt.res || '1k';
  const files = await j('https://api.polyhaven.com/files/' + id);
  const info = await j('https://api.polyhaven.com/info/' + id); // type 0=hdri 1=texture 2=model
  const dir = path.join(ROOT, 'assets/ph', id); const out = [];
  if (files.hdri) {
    const f = files.hdri[res]?.hdr || files.hdri['1k'].hdr; out.push(await dl(f.url, path.join(dir, `${id}_${res}.hdr`)));
  } else if (info.type === 2 && files.gltf) {
    const g = files.gltf[res]?.gltf || files.gltf['1k'].gltf;
    out.push(await dl(g.url, path.join(dir, path.basename(new URL(g.url).pathname))));
    for (const [p, inc] of Object.entries(g.include || {})) await dl(inc.url, path.join(dir, p));
  } else {
    const want = (opt.maps || 'diff,nor_gl,rough,ao').split(',');
    const key = { diff: 'Diffuse', nor_gl: 'nor_gl', rough: 'Rough', ao: 'AO', arm: 'arm', disp: 'Displacement', metal: 'Metal' };
    for (const m of want) {
      const e = files[key[m]] || files[m]; if (!e) { console.error('no map', m); continue; }
      const r = e[res] || e['1k']; const f = r.jpg || r.png; if (!f) continue;
      out.push(await dl(f.url, path.join(dir, `${id}_${m}_${res}.${r.jpg ? 'jpg' : 'png'}`)));
    }
  }
  for (const o of out) console.log(rel(o));
} else {
  console.log('usage: search <words> [--type=..] | get <id> [--res=1k] [--maps=diff,nor_gl,rough,ao]');
}
