// In-game lobby HUD inside #mp: lobby name + code, players list, copy-invite, Avatar, Leave (a popover: hidden until the
// People button in the top bar adds .open, src/net/hud.js); chat (T) and toasts.
import { rollText } from './motion.js';
// The name field lives in the main menu now (src/net/menu.js). All peer-supplied text goes in via textContent.
export function createUI({ onChat, onLeave }) {
  const root = document.getElementById('mp');
  const noop = () => {};
  if (!root) return { setPeers: noop, addChat: noop, toast: noop, setStatus: noop, openChat: noop, setRoom: noop, setPlayers: noop, closeChat: noop, get chatOpen() { return false; } };
  root.innerHTML = `
    <div class="mp-card" id="mp-card">
      <div class="mp-row">
        <span class="mp-dot" id="mp-dot"></span>
        <span class="mp-room" id="mp-lname"></span>
      </div>
      <div class="mp-row mp-chips">
        <span class="chip"><i>LOBBY::</i><b id="mp-code"></b></span>
        <span class="chip"><i>PLAYERS::</i><b id="mp-peers">1</b></span>
      </div>
      <div class="mp-players" id="mp-players"></div>
      <div class="mp-row">
        <button id="mp-copy" type="button">Copy invite link</button>
        <button id="mp-avatar" type="button" class="ghost">Avatar…</button>
        <button id="mp-leave" type="button" class="ghost">Leave</button>
      </div>
      <div class="mp-status" id="mp-status"></div>
    </div>
    <div id="mp-chat"><div id="mp-log"></div><input id="mp-input" maxlength="200" placeholder="Say something… (Enter to send, Esc to cancel)" autocomplete="off"></div>
    <div id="mp-toasts"></div>`;
  const $ = (id) => document.getElementById(id);
  const input = $('mp-input'), log = $('mp-log');
  let roomInfo = null;
  const setOpen = (on) => document.body.classList.toggle('ui-open', on);
  input.addEventListener('focus', () => { setOpen(true); if (document.pointerLockElement) document.exitPointerLock(); });
  input.addEventListener('blur', () => { setOpen(false); });
  $('mp-copy').addEventListener('click', async () => {
    const url = inviteUrl(); let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {
      try { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch {}
    }
    const b = $('mp-copy'); b.textContent = ok ? 'Link copied!' : 'Copy failed — use the URL bar'; setTimeout(() => (b.textContent = 'Copy invite link'), 1800);
  });
  $('mp-leave').addEventListener('click', (e) => { e.stopPropagation(); $('mp-card').classList.remove('open'); onLeave?.(); });
  $('mp-avatar').addEventListener('click', (e) => { e.stopPropagation(); $('mp-card').classList.remove('open'); window.__menu?.hooks?.openAvatarPanel?.(); });
  for (const el of [$('mp-card')]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  function inviteUrl() { const u = new URL(location.origin + location.pathname); if (roomInfo) u.searchParams.set('room', roomInfo.code); return u.toString(); }
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
    if (document.body.classList.contains('menu-open')) return;
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    e.preventDefault(); openChat();
  });
  function addChat(who, text, hue, mine) {
    const line = document.createElement('div'); line.className = 'mp-line' + (mine ? ' mine' : '');
    const n = document.createElement('b'); n.textContent = who + ': '; if (typeof hue === 'number') n.style.color = `hsl(${Math.round(hue * 360)} 80% 72%)`;
    line.append(n, document.createTextNode(text)); log.appendChild(line);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 12000);
  }
  // presence card (bottom centre): "● Name joined" / "● 3 people joined" + mono ONLINE::n, slides up
  let pres = null, presN = 0, presT = 0, presVerb = '', online = 1;
  function presence(name, verb) {
    if (!pres) { pres = document.createElement('div'); pres.id = 'presence'; pres.className = 'mp-toast presence'; pres.innerHTML = '<span class="pr-dot"></span><div><b class="pr-main"></b><div class="pr-sub"></div></div>'; document.body.appendChild(pres); }
    const now = performance.now(); presN = now < presT && presVerb === verb ? presN + 1 : 1; presVerb = verb; presT = now + 3500;
    pres.querySelector('.pr-main').textContent = presN > 1 ? `${presN} people ${verb}` : `${name} ${verb}`;
    const sub = pres.querySelector('.pr-sub'); sub.textContent = ''; const i = document.createElement('i'); i.textContent = 'ONLINE::'; const b = document.createElement('b'); b.textContent = String(online); sub.className = 'pr-sub chip'; sub.append(i, b);
    pres.classList.remove('out'); pres.classList.add('show'); pres.classList.toggle('left', verb === 'left');
    clearTimeout(presence.t); presence.t = setTimeout(() => pres.classList.remove('show'), 3500);
  }
  function toast(text) {
    const m = /^(.*) (joined|left)$/.exec(text); if (m) { queueMicrotask(() => presence(m[1], m[2])); return; }
    const t = document.createElement('div'); t.className = 'mp-toast'; t.textContent = text; $('mp-toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  }
  function setPeers(n) { $('mp-dot').classList.toggle('live', n > 0); }
  function setStatus(s, bad) { const el = $('mp-status'); el.textContent = s || ''; el.classList.toggle('bad', !!bad); }
  function setRoom(info) {
    roomInfo = info;
    $('mp-lname').textContent = info ? info.name : 'Playing solo';
    rollText($('mp-code'), info ? info.code : '');
    $('mp-copy').hidden = !info; $('mp-players').hidden = !info; root.querySelector('.mp-chips').hidden = !info;
  }
  function setPlayers(list) {
    const el = $('mp-players'); el.textContent = '';
    for (const p of list) {
      const d = document.createElement('div'); d.className = 'mp-player' + (p.me ? ' me' : '');
      const dot = document.createElement('i'); if (typeof p.hue === 'number') dot.style.background = `hsl(${Math.round(p.hue * 360)} 75% 62%)`;
      d.append(dot, document.createTextNode(p.name + (p.me ? ' (you)' : ''))); el.appendChild(d);
    }
    const n = list.length; online = n; rollText($('mp-peers'), roomInfo ? `${n}/${roomInfo.max || 8}` : '1'); $('mp-dot').classList.toggle('live', n > 1);
  }
  return { setPeers, addChat, toast, setStatus, openChat, closeChat, setRoom, setPlayers, inviteUrl, players: () => [...$('mp-players').children].map(c => c.textContent), get chatOpen() { return chatBox.classList.contains('open'); } };
}
