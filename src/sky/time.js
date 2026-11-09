// Time of day + weather, all pure functions of the (lobby-corrected) wall clock, so every player agrees.
// One in-game day = 20 real minutes. Sun path: Pacific Palisades (34.05°N) with a late-March/September sun
// (declination +6°) and DST clock time (solar noon ≈ 13:00): sunrise ≈ 06:45 in the east (+x+z side), sunset
// ≈ 19:16 in the west (−x−z), noon sun in the south over the canyon (+z).
// World axes (CLAUDE.md): +x = north-east, +z = south-east  =>  x = (N + E)/√2, z = (E − N)/√2.
export const DAY_MS = 20 * 60 * 1000;
const K = 0.37;                        // phase: which in-game time 1970-01-01 00:00 UTC was (any constant works)
const D2R = Math.PI / 180, LAT = 34.05 * D2R, DEC = 6 * D2R, NOON = 13 / 24, S2 = Math.SQRT1_2;
const MOON_DEC = -4 * D2R;

export const todAt = (wallMs) => (((wallMs / DAY_MS + K) % 1) + 1) % 1;
export const clockOf = (tod) => { const m = Math.floor(tod * 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
export function parseClock(s) { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(s || '').trim()); if (!m) return null; const h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return null; return (h * 60 + mi) / 1440; }

// direction to a body at hour angle H (radians, + = afternoon) and declination dec, written into out (Vector3)
function dirAt(H, dec, out) {
  const east = -Math.cos(dec) * Math.sin(H);
  const north = Math.sin(dec) * Math.cos(LAT) - Math.cos(dec) * Math.sin(LAT) * Math.cos(H);
  const up = Math.sin(dec) * Math.sin(LAT) + Math.cos(dec) * Math.cos(LAT) * Math.cos(H);
  return out.set(S2 * (north + east), up, S2 * (east - north)).normalize();
}
export const sunDirAt = (tod, out) => dirAt((tod - NOON) * 2 * Math.PI, DEC, out);
// moon: nearly opposite the sun (a waxing gibbous), high around midnight
export const moonDirAt = (tod, out) => dirAt((tod - NOON) * 2 * Math.PI - Math.PI + 0.35, MOON_DEC, out);

// ---------------------------------------------------------------- palette keyed by sun elevation (degrees)
// linear radiance, same units as the HDRI (its clear sky is ~0.1–0.45)
const KEYS = [-18, -10, -5, -1, 3, 8, 20, 50];
const PAL = {
  zenith:  [[.0007, .0011, .0028], [.0025, .0045, .012], [.012, .022, .06], [.04, .07, .17], [.07, .12, .26], [.08, .15, .29], [.09, .18, .31], [.09, .18, .30]],
  horizon: [[.0014, .0019, .004], [.006, .007, .016], [.10, .06, .09], [.55, .24, .10], [.75, .42, .19], [.42, .38, .34], [.17, .30, .43], [.16, .30, .44]],
  glow:    [[0, 0, 0], [.01, .004, .002], [.30, .09, .03], [1.0, .32, .08], [.8, .38, .12], [.28, .2, .1], [.05, .05, .05], [0, 0, 0]],
  land:    [[.004, .005, .010], [.008, .009, .016], [.05, .045, .06], [.30, .17, .10], [.62, .42, .28], [.82, .70, .58], [1, 1, 1], [1, 1, 1]],
  sunCol:  [[1, .38, .12], [1, .38, .12], [1, .38, .12], [1, .40, .14], [1, .56, .30], [1, .74, .52], [1, .86, .70], [1, .88, .74]],
  cloudLit:  [[.010, .011, .016], [.016, .017, .028], [.12, .07, .09], [1.1, .48, .22], [1.25, .80, .50], [1.05, .95, .85], [1.0, .98, .96], [1.0, .99, .98]],
  cloudShade:[[.004, .0045, .007], [.007, .008, .013], [.05, .035, .05], [.22, .12, .12], [.30, .24, .24], [.36, .36, .38], [.42, .44, .48], [.44, .46, .50]],
};
export function palette(elDeg, key, out) {
  const P = PAL[key]; let i = 0; while (i < KEYS.length - 2 && elDeg > KEYS[i + 1]) i++;
  const f = Math.min(1, Math.max(0, (elDeg - KEYS[i]) / (KEYS[i + 1] - KEYS[i]))); const s = f * f * (3 - 2 * f);
  const a = P[i], b = P[i + 1]; out.r = a[0] + (b[0] - a[0]) * s; out.g = a[1] + (b[1] - a[1]) * s; out.b = a[2] + (b[2] - a[2]) * s; return out;
}
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- weather
// cover/dark: cloud layer; fog: FogExp2 density outdoors; haze: dome horizon fog; rain/snow 0..1 (precipitation);
// wind 0..1; light: direct sun/moon factor; bolt: lightning rate; dT: °C added to the time-of-day temperature;
// cold/coldT: weight + absolute °C for snow weather (blended so transitions stay smooth); sev: storminess 0..1.
export const WEATHERS = ['clear', 'cloudy', 'overcast', 'fog', 'rain', 'storm', 'snow', 'blizzard'];
export const PARAMS = {
  clear:    { cover: 0.06, dark: 0.0,  fog: 0.00025, haze: 0.15, rain: 0,   wind: 0.15, light: 1.0,  bolt: 0, snow: 0, dT: 0,  cold: 0, coldT: 0,   sev: 0 },
  cloudy:   { cover: 0.50, dark: 0.25, fog: 0.0005, haze: 0.25, rain: 0,   wind: 0.30, light: 0.75, bolt: 0, snow: 0, dT: -2, cold: 0, coldT: 0,   sev: 0.05 },
  overcast: { cover: 0.97, dark: 0.50, fog: 0.002,  haze: 0.45, rain: 0,   wind: 0.35, light: 0.22, bolt: 0, snow: 0, dT: -3, cold: 0, coldT: 0,   sev: 0.1 },
  fog:      { cover: 0.80, dark: 0.30, fog: 0.045,  haze: 1.0,  rain: 0,   wind: 0.05, light: 0.28, bolt: 0, snow: 0, dT: -4, cold: 0, coldT: 0,   sev: 0.15 },
  rain:     { cover: 1.0,  dark: 0.70, fog: 0.010,  haze: 0.6,  rain: 0.55, wind: 0.45, light: 0.14, bolt: 0, snow: 0, dT: -4, cold: 0, coldT: 0,   sev: 0.4 },
  storm:    { cover: 1.0,  dark: 0.92, fog: 0.028,  haze: 0.7,  rain: 1.0, wind: 0.95, light: 0.08, bolt: 1, snow: 0, dT: -6, cold: 0, coldT: 0,   sev: 0.8 },
  snow:     { cover: 0.96, dark: 0.35, fog: 0.007,  haze: 0.65, rain: 0,   wind: 0.25, light: 0.25, bolt: 0, snow: 0.6, dT: 0, cold: 1, coldT: -3,  sev: 0.35 },
  blizzard: { cover: 1.0,  dark: 0.55, fog: 0.035,  haze: 0.95, rain: 0,   wind: 1.0,  light: 0.12, bolt: 0, snow: 1.0, dT: 0, cold: 1, coldT: -12, sev: 1.0 },
};
export const KEYS_W = Object.keys(PARAMS.clear);
const SLOT_MS = 6 * 60 * 1000;
const hash = (n) => { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export { hash };
const ODDS = [['clear', 0.32], ['cloudy', 0.255], ['overcast', 0.12], ['fog', 0.08], ['rain', 0.12], ['storm', 0.07], ['snow', 0.025], ['blizzard', 0.01]]; // snow is rare (it's LA)
// automatic weather: a new draw every 6 minutes (never the same storm twice in a row)
export function autoWeather(wallMs) {
  const slot = Math.floor(wallMs / SLOT_MS);
  const pick = (s) => { let r = hash(s * 7919 + 13), acc = 0; for (const [w, p] of ODDS) { acc += p; if (r < acc) return w; } return 'clear'; };
  let w = pick(slot); if (w === 'storm' && pick(slot - 1) === 'storm') w = 'rain'; if (w === 'blizzard' && pick(slot - 1) === 'blizzard') w = 'snow';
  return w;
}
export function windDirAt(wallMs) { const slot = Math.floor(wallMs / SLOT_MS); return hash(slot * 31 + 5) * Math.PI * 2; }
