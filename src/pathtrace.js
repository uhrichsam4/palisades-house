// Photo mode: progressive GPU path tracing (three-gpu-pathtracer) of the current view with real global
// illumination from the canyon HDRI + sun. Raster walk-through uses a neutral room environment to fake
// bounce light; here we switch back to the true sky because the path tracer computes the bounces.
import * as THREE from 'three';
import { WebGLPathTracer } from 'pathtracer';

export function createPhotoMode(ctx) {
  const { renderer, scene, camera, ENV } = ctx;
  let pt = null, active = false, building = null, saved = null, hidden = [];
  const supported = (m) => m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshBasicMaterial);

  async function enter({ bounces = 6, onProgress, exposure = 2.6 } = {}) {
    if (active) return; active = true;
    saved = { env: scene.environment, envRot: scene.environmentRotation.clone(), envInt: scene.environmentIntensity, exposure: renderer.toneMappingExposure };
    renderer.toneMappingExposure = exposure; // real-estate photographers expose interiors ~+1.5 stops
    // Hide things the path tracer can't shade (custom shaders: water surface, fluid creatures, sprites).
    hidden = [];
    scene.traverse(o => {
      if (!o.visible) return;
      if (o.isSprite || o.isPoints || o.isLine) { o.visible = false; hidden.push(o); return; }
      if (o.isMesh) { const mats = Array.isArray(o.material) ? o.material : [o.material]; if (!mats.every(supported) || o.userData.noPathTrace) { o.visible = false; hidden.push(o); } }
    });
    scene.environment = ENV.hdr; scene.environmentRotation.set(0, ENV.rotY, 0); scene.environmentIntensity = 1.0;
    if (!pt) {
      pt = new WebGLPathTracer(renderer);
      pt.tiles.set(2, 2); pt.filterGlossyFactor = 0.5; pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0;
      pt.dynamicLowRes = false; pt.renderScale = 1;
    }
    pt.bounces = bounces; pt.transmissiveBounces = 6;
    onProgress?.(0); await new Promise(r => setTimeout(r, 30)); // let the status text paint
    pt.setScene(scene, camera); // synchronous BVH build (no worker needed on a static host)
    pt.updateEnvironment(); pt.updateMaterials(); pt.updateLights(); pt.reset();
  }
  function exit() {
    if (!active) return; active = false;
    for (const o of hidden) o.visible = true; hidden = [];
    scene.environment = saved.env; scene.environmentRotation.copy(saved.envRot); scene.environmentIntensity = saved.envInt; renderer.toneMappingExposure = saved.exposure;
  }
  return {
    get active() { return active; }, get samples() { return pt ? pt.samples : 0 }, get ready() { return active && !building; },
    enter, exit,
    cameraMoved() { if (pt && active && !building) pt.updateCamera(); },
    render() { if (pt && active && !building) pt.renderSample(); },
  };
}
