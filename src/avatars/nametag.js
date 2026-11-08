// Shared player name tag: a camera-facing sprite (pill with white text), drawn on a canvas.
// makeNameTag() -> Sprite with .setText(name) and .disposeTag(). Parent it and set position.y yourself.
import * as THREE from 'three';

export function makeNameTag(name = '') {
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  tag.renderOrder = 20; tag.position.y = 2.05;
  // docs/UI_STYLE.md: mono, uppercase, yellow #f2c84b on a #262626 pill with a hairline. Drawn at 2x for crispness;
  // the sprite keeps the old world size (0.9 m wide).
  tag.setText = (n) => {
    const S = 2, W = 512, H = 112; n = String(n || '').toUpperCase();
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S; const g = c.getContext('2d'); g.scale(S, S);
    g.font = '600 44px "Geist Mono", ui-monospace, Menlo, monospace'; g.letterSpacing = '-0.5px';
    const w = Math.min(W - 8, g.measureText(n).width + 44);
    g.beginPath(); g.roundRect((W - w) / 2, 20, w, 72, 12);
    g.fillStyle = 'rgba(38,38,38,0.92)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(247,247,247,0.06)'; g.stroke();
    g.fillStyle = '#f2c84b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, W / 2, 57, W - 40);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    tag.material.map?.dispose(); tag.material.map = t; tag.material.needsUpdate = true; tag.scale.set(0.9, 0.9 * 112 / 512, 1);
  };
  tag.disposeTag = () => { tag.material.map?.dispose(); tag.material.dispose(); tag.parent?.remove(tag); };
  tag.setText(name);
  return tag;
}
