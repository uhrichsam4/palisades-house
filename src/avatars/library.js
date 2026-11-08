// Built-in character library. Every file is a pre-optimised, animation-free .glb in assets/avatars/ (no Draco /
// Meshopt; textures are webp), with a 256x320 webp thumbnail in assets/avatars/thumbs/. Sources and licences:
// assets/CREDITS.md. Descriptor for a library pick: {k:'b', id, ht, fl} (see sync.js); peers load the same file
// from the site, so nothing is sent peer to peer.
//
//   LIBRARY = [{id, name, file, thumb, height, tris, credit}]   height = default in-game height (m)
//   libraryEntry(id) -> entry | null
//   loadLibraryAsset(id) -> Promise<asset> (parseAvatar result; cached per id, failed loads are retried)
import { parseAvatar } from './index.js';

const QUAT = 'Quaternius, Universal Base Characters (CC0 1.0)';
const ROCKET = 'Microsoft Rocketbox (MIT, attribution: Microsoft Rocketbox)';
const INNER = 'Innerscene 3D Parts Library, from MakeHuman/MPFB assets (CC0 1.0)';
const MESHY = "Owner's own Meshy generation";
const e = (id, name, height, tris, credit) => ({ id, name, file: `assets/avatars/${id}.glb`, thumb: `assets/avatars/thumbs/${id}.webp`, height, tris, credit });

export const LIBRARY = [
  e('ped1', 'Miami 1', 1.84, 24122, QUAT),
  e('ped2', 'Miami 2', 1.70, 24800, QUAT),
  e('ped3', 'Miami 3', 1.79, 24800, QUAT),
  e('ped4', 'Miami 4', 1.72, 24800, QUAT),
  e('ped5', 'Miami 5', 1.75, 24800, QUAT),
  e('ped6', 'Miami 6', 1.64, 24800, QUAT),
  e('ped7', 'Miami 7', 1.82, 24122, QUAT),
  e('ped8', 'Miami 8', 1.69, 24800, QUAT),
  e('player', 'Miami Hero', 1.80, 24800, QUAT),
  e('fox', 'Fox', 0.55, 576, 'Fox by PixelMannen, tomkranis; glTF by AsoboStudio & scurest, Khronos glTF Sample Assets (CC BY 4.0)'),
  e('sam', 'Sam', 1.78, 58847, INNER),
  e('maya', 'Maya', 1.68, 65479, INNER),
  e('hostile', 'Street', 1.80, 8712, 'Source unknown (testtt project, MakeHuman-style rig)'),
  e('suit', 'Blue Suit', 1.85, 80000, 'Source unknown (testtt project, Mixamo rig)'),
  e('rb1', 'Jacket', 1.80, 8684, ROCKET),
  e('rb2', 'Denim', 1.80, 6722, ROCKET),
  e('rb3', 'Hoodie', 1.80, 6434, ROCKET),
  e('rb4', 'Track Top', 1.80, 7084, ROCKET),
  e('rb5', 'Party', 1.72, 9874, ROCKET),
  e('rb6', 'Business', 1.70, 8966, ROCKET),
  e('soldier', 'Soldier', 1.85, 20217, ROCKET),
  e('clavicular', 'Clavicular', 1.85, 89990, MESHY),
  e('hexum', 'Hexum', 1.85, 89982, MESHY),
  e('mog11', 'Mogger 1', 1.82, 9999, MESHY),
  e('mog12', 'Mogger 2', 1.82, 10000, MESHY),
  e('mog21', 'Mogger 3', 1.82, 10000, MESHY),
  e('mog31', 'Mogger 4', 1.82, 10000, MESHY),
  e('mog3', 'Mogger 5', 1.82, 9999, MESHY),
  e('mog4', 'Mogger 6', 1.82, 10000, MESHY),
  e('mog5', 'Mogger 7', 1.82, 9999, MESHY),
  e('mog6', 'Mogger 8', 1.82, 10000, MESHY),
  e('ws12', 'Backpack', 1.85, 89998, MESHY),
  e('meshy1', 'Red Shirt', 1.82, 89990, MESHY),
  e('meshy2', 'Big Guy', 1.78, 89988, MESHY),
  e('woman', 'Athlete', 1.68, 19994, 'Grab3D, woman-base (CC0 1.0)'),
];
const BY_ID = new Map(LIBRARY.map(x => [x.id, x]));
export const libraryEntry = (id) => BY_ID.get(id) || null;
export const libraryUrl = (path) => new URL('../../' + path, import.meta.url).href;

const cache = new Map(); // id -> Promise<asset>
export function loadLibraryAsset(id) {
  const ent = libraryEntry(id);
  if (!ent) return Promise.reject(new Error(`Unknown character "${id}".`));
  if (!cache.has(id)) {
    const p = (async () => {
      const r = await fetch(libraryUrl(ent.file));
      if (!r.ok) throw new Error(`Could not load ${ent.name} (HTTP ${r.status}).`);
      return parseAvatar(await r.arrayBuffer(), 'glb');
    })();
    p.catch(() => cache.delete(id)); cache.set(id, p);
  }
  return cache.get(id);
}
