// Pose helpers for avatars holding game gear (pool cue, ping-pong paddle). Run AFTER the avatar's animator
// (games onUpdate runs after player.update and the multiplayer avatar loop), every frame while the pose is wanted:
// the animator rewrites the bones next frame, so nothing needs restoring.
//   lean(creature, angle)                 tilt the chest forward around the character's right axis
//   aimArm(creature, 'R'|'L', target)     swing the upper arm so the (straight) arm points at a world point
//   handPos(creature, 'R'|'L', out)       world position of the hand bone (or null)
// Works on every rig bound by src/avatars/anim.js (mannequin, library characters, custom uploads).
import * as THREE from 'three';
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ax = new THREE.Vector3();
const bonesOf = (cr) => cr?.animator?.rig?.bones || null;
function setWorldQuat(b, qWorld) { b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(qWorld)); b.updateMatrixWorld(true); }
export function lean(cr, angle) {
  const B = bonesOf(cr); const ch = B?.chest || B?.spine; if (!ch || !angle) return;
  cr.root.updateMatrixWorld(true);
  _ax.set(1, 0, 0).applyQuaternion(cr.root.getWorldQuaternion(_q)); // character right (root faces -z)
  // the animator skips hidden / off-screen avatars: never lean twice on top of the same (stale) pose
  if (ch.userData.leanQ && ch.quaternion.equals(ch.userData.leanQ)) return;
  _qw.setFromAxisAngle(_ax, -angle); ch.getWorldQuaternion(_q); setWorldQuat(ch, _qw.multiply(_q)); (ch.userData.leanQ ||= new THREE.Quaternion()).copy(ch.quaternion);
}
export function aimArm(cr, side, target, w = 1) {
  const B = bonesOf(cr); if (!B) return; const up = B['upperArm' + side], lo = B['lowerArm' + side], ha = B['hand' + side]; if (!up || !(ha || lo)) return;
  cr.root.updateMatrixWorld(true);
  up.getWorldPosition(_a); (ha || lo).getWorldPosition(_b); _c.copy(target).sub(_a);
  const cur = _b.sub(_a); if (cur.lengthSq() < 1e-8 || _c.lengthSq() < 1e-8) return;
  _qw.setFromUnitVectors(cur.normalize(), _c.normalize()); if (w < 1) _qw.slerp(_q.identity(), 1 - w);
  up.getWorldQuaternion(_q); setWorldQuat(up, _qw.multiply(_q));
}
export function handPos(cr, side, out) { const B = bonesOf(cr); const h = B?.['hand' + side]; if (!h) return null; return h.getWorldPosition(out); }
