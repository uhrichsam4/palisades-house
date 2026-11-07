// Multiplayer HUD inside #mp: room code, copy-invite button, peer count, editable name, chat, toasts.
export function createUI({ room, name, onName, onChat, getStatus }) {
  const root = document.getElementById('mp');
  if (!root) return { setPeers() {}, addChat() {}, toast() {}, setStatus() {}, openChat() {} };
  root.innerHTML = `
    <div class="mp-card">
      <div class="mp-row">
        <span class="mp-dot" id="mp-dot"></span>
        <span class="mp-room">Room <b id="mp-code"></b></span>
        <span class="mp-peers" id="mp-peers">just you</span>
      </div>
      <div class="mp-row">
        <button id="mp-copy" type="button">Copy invite link</button>
        <input id="mp-name" maxlength="24" spellcheck="false" aria-label="Your name">
      </div>
      <div class="mp-status" id="mp-status"></div>
    </div>
    <div id="mp-chat"><div id="mp-log"></div><input id="mp-input" maxlength="200" placeholder="Say something… (Enter to send, Esc to cancel)" autocomplete="off"></div>
    <div id="mp-toasts"></div>`;
  const $ = (id) => document.getElementById(id);
  $('mp-code').textContent = room;
  const nameEl = $('mp-name'); nameEl.value = name;
  const input = $('mp-input'), log = $('mp-log');
  const setOpen = (on) => document.body.classList.toggle('ui-open', on);
  // inputs block pointer-lock clicks and movement keys while focused
  for (const el of [nameEl, input]) {
    el.addEventListener('focus', () => { setOpen(true); if (document.pointerLockElement) document.exitPointerLock(); });
    el.addEventListener('blur', () => { setOpen(false); });
  }
  nameEl.addEventListener('change', () => { nameEl.value = onName(nameEl.value); });
  nameEl.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') nameEl.blur(); });
  $('mp-copy').addEventListener('click', async () => {
    const url = location.href; let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {
      try { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch {}
    }
    const b = $('mp-copy'); b.textContent = ok ? 'Link copied!' : 'Copy failed — use the URL bar'; setTimeout(() => (b.textContent = 'Copy invite link'), 1800);
  });
  const chatBox = $('mp-chat');
  function openChat() { chatBox.classList.add('open'); input.value = ''; input.focus(); }
  function closeChat() { chatBox.classList.remove('open'); input.blur(); }
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { const t = input.value.trim(); if (t) onChat(t); closeChat(); }
    else if (e.key === 'Escape') closeChat();
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat) return;
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    e.preventDefault(); openChat();
  });
  function addChat(who, text, hue, mine) {
    const line = document.createElement('div'); line.className = 'mp-line' + (mine ? ' mine' : '');
    const n = document.createElement('b'); n.textContent = who + ': '; if (hue !== undefined) n.style.color = `hsl(${Math.round(hue * 360)} 80% 72%)`;
    line.append(n, document.createTextNode(text)); log.appendChild(line);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 12000);
  }
  function toast(text) {
    const t = document.createElement('div'); t.className = 'mp-toast'; t.textContent = text; $('mp-toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  }
  function setPeers(n) { $('mp-peers').textContent = n === 0 ? 'just you' : `${n + 1} here`; $('mp-dot').classList.toggle('live', n > 0); }
  function setStatus(s, bad) { const el = $('mp-status'); el.textContent = s || ''; el.classList.toggle('bad', !!bad); }
  return { setPeers, addChat, toast, setStatus, openChat };
}
