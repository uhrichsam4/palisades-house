// Party mode: "a party where someone got a lot of money". startParty(ctx, mp) (ctx = the multiplayer ctx,
// mp = window.__mp) sets up:
//  - money (src/party/money.js): one instanced pool of fluttering $100 notes, exposed early as window.__party.money
//  - decor (src/party/decor.js): cash stacks / briefcases / gold bars / cash pallets, balloons, string lights,
//    LED uplights, disco ball, DJ booth, champagne tower, red carpet + VIP neon, gold pool floats, confetti
//  - a never-ending gentle money rain over the pool deck
//  - "make it rain" (src/party/rain.js): hold L to spray notes from your hand, synced over mp.channel('party')
// Off when localStorage['ph.settings'].party === false or ?party=0 (money + L still work for games, no decor/rain).
import { createMoney } from './money.js';
import { setAniso } from './tex.js';

export function partyEnabled(params) {
  try { if ((params || new URLSearchParams(location.search)).get('party') === '0') return false; } catch {}
  try { const s = JSON.parse(localStorage.getItem('ph.settings') || '{}'); if (s && s.party === false) return false; } catch {}
  return true;
}

export function startParty(ctx, mp) {
  if (!ctx || ctx.shot) return null;
  if (window.__party?.ctx === ctx) return window.__party;
  try { setAniso(ctx.renderer.capabilities.getMaxAnisotropy()); } catch {}
  const money = createMoney(ctx);
  const party = { money, ctx, enabled: partyEnabled(ctx.params), decor: null, rain: null, ready: null };
  window.__party = party;
  ctx.onUpdate((dt) => money.update(dt));
  party.ready = (async () => {
    try { const { startMakeItRain } = await import('./rain.js'); party.rain = startMakeItRain(ctx, mp, money); }
    catch (e) { console.warn('[party] make-it-rain not started:', e); }
    if (!party.enabled) return party;
    try { const { buildDecor } = await import('./decor.js'); party.decor = await buildDecor(ctx, money); }
    catch (e) { console.warn('[party] decor not built:', e); }
    return party;
  })();
  return party;
}
