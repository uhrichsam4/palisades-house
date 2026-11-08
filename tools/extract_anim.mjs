#!/usr/bin/env node
// Builds assets/anim/ual.glb: skeleton-only (no meshes/skins/textures) subset of the Quaternius Universal
// Animation Library (CC0) with just the clips + bones the avatars use (src/avatars/anim.js).
//   node tools/extract_anim.mjs [~/Desktop/MiamiGame/assets/models/characters/player.glb]
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || path.join(os.homedir(), 'Desktop/MiamiGame/assets/models/characters/player.glb');
const OUT = path.join(ROOT, 'assets/anim/ual.glb');
const CLIPS = ['idle', 'idle_look', 'walk', 'run', 'sprint', 'jump_start', 'jump_loop', 'land', 'fall', 'crouch_idle', 'crouch_walk', 'swim_idle', 'swim', 'sit_drive', 'wave'];
const BONES = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];
const TRANSLATE = new Set(['root', 'pelvis']);

const b = fs.readFileSync(SRC);
const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
const binStart = 20 + jl + 8; const bin = b.subarray(binStart);
const keep = new Map(); // old node index -> new
const nodes = [{ name: 'Armature', children: [] }];
j.nodes.forEach((n, i) => { if (BONES.includes(n.name)) { keep.set(i, nodes.length); const c = { name: n.name }; for (const k of ['translation', 'rotation', 'scale']) if (n[k]) c[k] = n[k]; nodes.push(c); } });
j.nodes.forEach((n, i) => { if (!keep.has(i)) return; const kids = (n.children || []).filter(c => keep.has(c)).map(c => keep.get(c)); if (kids.length) nodes[keep.get(i)].children = kids; });
nodes[0].children = [keep.get(j.nodes.findIndex(n => n.name === 'root'))];

const chunks = []; let off = 0; const accessors = [], bufferViews = []; const accMap = new Map();
function copyAcc(i) {
  if (accMap.has(i)) return accMap.get(i);
  const a = j.accessors[i], bv = j.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]; const len = a.count * comps * 4;
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const data = Buffer.from(bin.subarray(start, start + len));
  bufferViews.push({ buffer: 0, byteOffset: off, byteLength: len }); chunks.push(data); off += len; const pad = (4 - (len % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  const na = { bufferView: bufferViews.length - 1, componentType: 5126, count: a.count, type: a.type }; if (a.min) na.min = a.min; if (a.max) na.max = a.max;
  accessors.push(na); accMap.set(i, accessors.length - 1); return accessors.length - 1;
}
const animations = [];
for (const name of CLIPS) {
  const an = j.animations.find(a => a.name === name); if (!an) { console.warn('missing clip', name); continue; }
  const samplers = [], channels = [];
  for (const ch of an.channels) {
    const node = j.nodes[ch.target.node]; if (!keep.has(ch.target.node)) continue;
    if (ch.target.path === 'scale') continue;
    if (ch.target.path === 'translation' && !TRANSLATE.has(node.name)) continue;
    const s = an.samplers[ch.sampler];
    samplers.push({ input: copyAcc(s.input), output: copyAcc(s.output), interpolation: s.interpolation });
    channels.push({ sampler: samplers.length - 1, target: { node: keep.get(ch.target.node), path: ch.target.path } });
  }
  animations.push({ name, samplers, channels });
}
const binBuf = Buffer.concat(chunks);
const gltf = { asset: { version: '2.0', generator: 'palisades extract_anim.mjs', copyright: 'Quaternius Universal Animation Library, CC0 1.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes, animations, accessors, bufferViews, buffers: [{ byteLength: binBuf.length }] };
let js = Buffer.from(JSON.stringify(gltf), 'utf8'); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const total = 12 + 8 + js.length + 8 + binBuf.length;
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, binBuf]));
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), bytes: total, clips: animations.map(a => a.name), nodes: nodes.length }));
