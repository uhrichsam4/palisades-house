// Emotes beyond the B wave. H = "slick back": the right hand runs from the forehead back over the crown to the
// back of the head, elbow high, chin up, hold, drop (~4 s). Solved per rig in src/avatars/anim.js (slickBack), so
// it plays on the mannequin, every library character and custom rigs. H again, moving, jumping or sitting cancels.
// Sync: same path as the wave. player.state.emote is a counter seq*4 + kind (1 wave, 2 slick back, 3 stop; src/smash adds
// 4 punch and 5 throw as 1000 + seq*16 + kind, see anim.js nextEmote / emoteKind) that
// goes out as the state field `e` (src/multiplayer.js); every animator (local + remote) plays the kind when the
// counter changes. No per-frame work: only a keydown listener.
import { nextEmote } from './avatars/anim.js';

export function startEmotes(ctx, mp) {
  const player = ctx.player; if (!player || ctx.shot) return null;
  const blocked = (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return true;
    const b = document.body.classList; return b.contains('menu-open') || b.contains('paused') || b.contains('ui-open');
  };
  const slicking = () => !!player.creature?.animator?.slick;
  function slick(on = !slicking()) {
    const s = player.state; if (s.frozen || s.seat || s.swimming) return false;
    s.emote = nextEmote(s.emote, on ? 2 : 3);
    return true;
  }
  addEventListener('keydown', (e) => { if (e.code !== 'KeyH' || e.repeat || blocked(e)) return; slick(); });
  const api = { slick, get playing() { return slicking(); } };
  window.__emotes = api;
  return api;
}
