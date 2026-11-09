#!/usr/bin/env node
// Offline tree bake (run once; the site never loads ez-tree itself).
//   node assets/trees/bake.mjs <path to an unpacked @dgreenheck/ez-tree@1.1.0 package>
// Generates seeded ez-tree variants (MIT, Daniel Greenheck) for a Southern-California canyon — coast live oak,
// sycamore, pine, olive, two chaparral bushes — each at two detail levels, normalised to height 1 (base at the
// origin), and writes:
//   assets/trees/trees.glb     meshes "<variant>_<lod>_<bark|leaves>" (POSITION, NORMAL, TEXCOORD_0, _WIND)
//   assets/trees/trees.json    per-variant crown radius / crown base / triangle counts
//   assets/trees/leaves.png    2x2 leaf-sprig atlas (oak, ash, pine, olive) from ez-tree's leaf textures
//   assets/trees/bark_*.jpg    512 px oak bark (Poly Haven bark_brown_02, CC0, as shipped with ez-tree)
// _WIND = sway weight 0..1 (0 at the trunk base, 1 at the crown tips), read by src/rooms/site/trees.js.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PKG = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(PKG, 'src/lib/tree.js'))) { console.error('usage: node assets/trees/bake.mjs <ez-tree package dir>'); process.exit(1); }
const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild');
const THREE_PATH = path.join(ROOT, 'node_modules/three/build/three.module.js');

// ---- bundle ez-tree's generator with the texture module stubbed (no DOM in Node)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eztree-'));
const out = path.join(tmp, 'eztree.mjs');
await esbuild.build({
  entryPoints: [path.join(PKG, 'src/lib/index.js')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_PATH }));
    b.onResolve({ filter: /\/textures$/ }, () => ({ path: 'stub-textures', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const getBarkTexture = () => null; export const getLeafTexture = () => null;', loader: 'js' }));
  } }],
});
const THREE = await import(THREE_PATH);
const { Tree, TreePreset } = await import(out);

// ---- variants: preset + overrides. cell = leaf atlas cell (0 oak, 1 ash, 2 pine, 3 olive)
const V = {
  oak: { preset: 'Oak Medium', seed: 1207, cell: 0, o: { leaves: { count: 4, size: 5.6 }, branch: { length: { 0: 26 }, children: { 0: 7 }, angle: { 1: 62 } } } },
  sycamore: { preset: 'Ash Medium', seed: 511, cell: 1, o: { leaves: { count: 4, size: 5.6 }, branch: { children: { 0: 6, 1: 3, 2: 3 } } } },
  pine: { preset: 'Pine Medium', seed: 77, cell: 2, o: { branch: { children: { 0: 46 } }, leaves: { count: 10, size: 2.6 } } },
  olive: { preset: 'Oak Small', seed: 3301, cell: 3, o: { leaves: { count: 6, size: 3.4 }, branch: { length: { 0: 16 }, children: { 0: 5 } } } },
  bushA: { preset: 'Bush 1', seed: 41, cell: 0, o: { leaves: { count: 3, size: 5.6 }, branch: { children: { 0: 5, 1: 3, 2: 2 }, sections: { 0: 1 } } } },
  bushB: { preset: 'Bush 2', seed: 97, cell: 1, o: { leaves: { count: 5, size: 4.0 }, branch: { children: { 0: 8 }, sections: { 0: 1 } } } },
};
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object' && !Array.isArray(v)) { a[k] = a[k] || {}; merge(a[k], v); } else a[k] = v; } return a; };

function gen(name, lod) {
  const v = V[name]; const t = new Tree(); const o = structuredClone(TreePreset[v.preset]); merge(o, v.o); o.seed = v.seed;
  // LOD0 caps: thin twigs never need more than a triangle cross-section; leaves carry the silhouette
  for (const k of Object.keys(o.branch.segments)) o.branch.segments[k] = Math.max(3, Math.min(o.branch.segments[k], [6, 4, 3, 3][k] ?? 3));
  for (const k of Object.keys(o.branch.sections)) if (k !== '0') o.branch.sections[k] = Math.max(1, Math.min(o.branch.sections[k], [8, 3, 2, 1][k] ?? 1));
  if (lod === 1) { // fewer levels, fewer sides, bigger leaf clusters: same silhouette at a fraction of the triangles
    const L = o.branch.levels;
    for (const k of Object.keys(o.branch.segments)) o.branch.segments[k] = Math.max(3, Math.min(o.branch.segments[k], k === '0' ? 5 : 3));
    for (const k of Object.keys(o.branch.sections)) o.branch.sections[k] = Math.max(1, Math.ceil(o.branch.sections[k] * 0.5));
    if (o.type === 'deciduous' && L >= 2) { o.branch.levels = L - 1; o.leaves.count = Math.max(4, Math.round(o.leaves.count * (o.branch.children[L - 1] || 3) * 0.35)); o.leaves.size *= 1.9; }
    else { o.leaves.count = Math.max(4, Math.round(o.leaves.count * 0.45)); o.leaves.size *= 1.45; o.branch.children[0] = Math.round(o.branch.children[0] * 0.7); }
    o.leaves.billboard = 'double';
  }
  t.options.copy(o); t.generate();
  return { bark: t.branchesMesh.geometry, leaves: t.leavesMesh.geometry, opts: o };
}

// ---- GLB writer (geometry only)
function glb(meshes) {
  const bufs = []; let off = 0; const json = { asset: { version: '2.0', generator: 'palisades-house assets/trees/bake.mjs (ez-tree 1.1.0)' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] };
  const view = (arr, target) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4; json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); bufs.push(b, Buffer.alloc(pad)); off += b.length + pad; return json.bufferViews.length - 1; };
  const acc = (arr, type, ct, target, minmax) => { const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type]; json.accessors.push({ bufferView: view(arr, target), componentType: ct, count: arr.length / n, type, ...(minmax || {}) }); return json.accessors.length - 1; };
  for (const [name, g] of meshes) {
    const p = g.attributes.position.array; g.computeBoundingBox(); const bb = g.boundingBox;
    const attrs = { POSITION: acc(new Float32Array(p), 'VEC3', 5126, 34962, { min: bb.min.toArray(), max: bb.max.toArray() }), NORMAL: acc(new Float32Array(g.attributes.normal.array), 'VEC3', 5126, 34962), TEXCOORD_0: acc(new Float32Array(g.attributes.uv.array), 'VEC2', 5126, 34962), _WIND: acc(new Float32Array(g.attributes.wind.array), 'SCALAR', 5126, 34962) };
    const idx = g.index.array; const big = p.length / 3 > 65535;
    const indices = acc(big ? new Uint32Array(idx) : new Uint16Array(idx), 'SCALAR', big ? 5125 : 5123, 34963);
    json.meshes.push({ name, primitives: [{ attributes: attrs, indices, mode: 4 }] }); json.nodes.push({ name, mesh: json.meshes.length - 1 }); json.scenes[0].nodes.push(json.nodes.length - 1);
  }
  const bin = Buffer.concat(bufs); json.buffers.push({ byteLength: bin.length });
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}

const meshes = []; const meta = {};
for (const name of Object.keys(V)) {
  const L0 = gen(name, 0), L1 = gen(name, 1);
  // normalise on LOD0: height 1, base at the origin
  const box = new THREE.Box3(); for (const g of [L0.bark, L0.leaves]) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const H = box.max.y - Math.min(0, box.min.y), s = 1 / H;
  let crownR = 0, crownBase = 1;
  { const p = L0.leaves.attributes.position; for (let i = 0; i < p.count; i++) { crownR = Math.max(crownR, Math.hypot(p.getX(i), p.getZ(i)) * s); crownBase = Math.min(crownBase, p.getY(i) * s); } }
  const cell = V[name].cell, cu = (cell % 2) * 0.5, cv = cell < 2 ? 0.5 : 0; // atlas: oak TL, ash TR, pine BL, olive BR (uv origin bottom-left)
  meta[name] = { crownR: +crownR.toFixed(3), crownBase: +Math.max(0, crownBase).toFixed(3), heightUnits: +H.toFixed(2), tris: {} };
  for (const [lod, G] of [[0, L0], [1, L1]]) {
    for (const part of ['bark', 'leaves']) {
      let g = G[part]; if (!g.index) continue;
      g.scale(s, s, s);
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position, w = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) { const y = Math.max(0, p.getY(i)), r = Math.hypot(p.getX(i), p.getZ(i)); w[i] = Math.min(1, Math.pow(y, 1.4) * (0.35 + 0.65 * Math.min(1, r / Math.max(0.05, crownR))) * 1.25); }
      g.setAttribute('wind', new THREE.BufferAttribute(w, 1));
      if (part === 'leaves') { // card normals bent outwards from the crown centre: the crown shades like a volume, not like flat cards
        const n = g.attributes.normal, cy = (crownBase + 1) * 0.5; const t = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < n.count; i++) { c.set(p.getX(i), (p.getY(i) - cy) * 1.3, p.getZ(i)).normalize(); t.fromBufferAttribute(n, i); if (t.dot(c) < 0) t.negate(); t.lerp(c, 0.75).normalize(); n.setXYZ(i, t.x, t.y, t.z); } }
      if (part === 'leaves') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, cu + 0.5 * (0.004 + 0.992 * uv.getX(i)), cv + 0.5 * (0.004 + 0.992 * uv.getY(i))); }
      meshes.push([`${name}_${lod}_${part}`, g]);
      meta[name].tris[`${lod}_${part}`] = g.index.count / 3;
    }
  }
}
fs.writeFileSync(path.join(HERE, 'trees.glb'), glb(meshes));
fs.writeFileSync(path.join(HERE, 'trees.json'), JSON.stringify(meta, null, 1));

// ---- textures: leaf atlas (olive = ash sprig, desaturated silver-green) + 512 px bark
const LV = path.join(PKG, 'src/lib/assets/leaves'), BK = path.join(PKG, 'src/lib/assets/bark');
const py = `
from PIL import Image, ImageEnhance
import sys
lv, out = sys.argv[1], sys.argv[2]
def ld(n): return Image.open(f'{lv}/{n}_color.png').convert('RGBA').resize((512, 512), Image.LANCZOS)
oak, ash, pine = ld('oak'), ld('ash'), ld('pine')
r, g, b, a = ash.split(); rgb = Image.merge('RGB', (r, g, b)); rgb = ImageEnhance.Color(rgb).enhance(0.45); rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
olive = Image.merge('RGBA', (*rgb.split(), a))
at = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
for im, xy in ((oak, (0, 0)), (ash, (512, 0)), (pine, (0, 512)), (olive, (512, 512))):
    # bleed leaf colour into the transparent texels (no dark fringes under mipmapping / alpha test)
    px = im.load(); w, h = im.size; base = im.copy(); bp = base.load()
    acc = [0, 0, 0, 0]
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            c = bp[x, y]
            if c[3] > 200: acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 1
    avg = tuple(int(acc[i] / max(1, acc[3])) for i in range(3))
    bg = Image.new('RGBA', im.size, avg + (0,)); bg.alpha_composite(im); bg.putalpha(a if im is olive else im.split()[3])
    at.paste(bg, xy)
at.save(out, optimize=True)
`;
const r = spawnSync('python3', ['-I', '-c', py, LV, path.join(HERE, 'leaves.png')], { stdio: 'inherit' }); if (r.status) process.exit(1);
for (const [src, dst] of [['oak_color_1k.jpg', 'bark_color.jpg'], ['oak_normal_1k.jpg', 'bark_normal.jpg']]) spawnSync('sips', ['-Z', '512', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', path.join(BK, src), '--out', path.join(HERE, dst)], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify(meta));
for (const f of fs.readdirSync(HERE)) console.log(f, fs.statSync(path.join(HERE, f)).size);
