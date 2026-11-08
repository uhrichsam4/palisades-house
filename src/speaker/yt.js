// YouTube helpers for the speaker: URL -> video id, and a lazy IFrame Player API loader.

const ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/, music.youtube.com, m.youtube.com,
// youtube-nocookie.com, bare 11-char ids. Returns the 11-char id or null.
export function parseYouTube(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (ID.test(s)) return s;
  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID.test(id) ? id : null;
}

// Optional start time from the link (t=90, t=1m30s, start=90) in seconds.
export function parseStart(input) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(input) ? input : 'https://' + input);
    const t = u.searchParams.get('t') || u.searchParams.get('start'); if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  } catch { return 0; }
}

let apiP = null;
export function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiP) return apiP;
  apiP = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch {} resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { apiP = null; reject(new Error('Could not load YouTube (offline or blocked)')); };
    document.head.appendChild(s);
  });
  return apiP;
}

export const YT_ERRORS = {
  2: 'That link has an invalid video id.',
  5: 'This video can\'t play in the browser player.',
  100: 'Video not found (removed or private).',
  101: 'The owner doesn\'t allow this video to play outside YouTube. Try another link.',
  150: 'The owner doesn\'t allow this video to play outside YouTube. Try another link.',
};
