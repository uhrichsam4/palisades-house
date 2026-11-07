// glTF loading with caching. loadModel(url) resolves to a fresh clone (shared geometry/materials).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { manager } from './textures.js';

const loader = new GLTFLoader(manager);
const cache = new Map();
export function loadModel(url, { shadows = true } = {}) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url).then(gltf => {
    const o = gltf.scene.clone(true);
    o.traverse(m => { if (m.isMesh) { m.castShadow = shadows; m.receiveShadow = true; } });
    return o;
  });
}
// Scale an object uniformly so its bounding box fits `size` along the given axis ('x'|'y'|'z' or 'max'),
// then sit it on y=0 centred on x/z. Returns the object.
export function fitTo(obj, size, axis = 'max') {
  const bb = new THREE.Box3().setFromObject(obj); const s = bb.getSize(new THREE.Vector3());
  const cur = axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis]; const k = size / cur; obj.scale.multiplyScalar(k);
  const bb2 = new THREE.Box3().setFromObject(obj); const c = bb2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= bb2.min.y;
  const wrap = new THREE.Group(); wrap.add(obj); return wrap;
}
