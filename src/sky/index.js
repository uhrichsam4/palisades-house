// Day/night cycle + weather (walk mode only; photo shots and ?sky=0 keep the fixed morning look).
//
// Time: one in-game day per 20 real minutes, from the wall clock (time.js) corrected to the lobby host's clock,
// so everyone sees the same sun. Weather: 'auto' draws a new weather every 6 min from the same clock; K (panel)
// or __sky.set({weather}) overrides it for the whole lobby over api.channel('sky'): requests go to the host
// (lowest peer id), the host stamps a sequence number and broadcasts; the highest sequence wins everywhere and
// every member hands it to newcomers (late joiners). Parameters ease toward the target (~20 s).
//
// What it drives: the sky dome (dome.js) and, from it, ENV.outdoor (re-captured every ~2.5 s at most); the
// sun/moon DirectionalLight (direction only steps when the static shadow map is refreshed — every 1.5° of sun
// travel, so a refresh every ~5 s at most); hemi light; FogExp2; exposure; interior probes (day set baked once
// at a reference daylight, night set baked once with the lights on, mixed by two shared uniforms in
// lighting.js); emissive fixtures + the walk-mode light pool + lantern wall glows at night; wet outdoor
// materials; rain (rain.js) with pool ripples; snow (same particles as flakes) + snow cover on up-facing outdoor
// surfaces; lightning; procedural ambience (audio.js).
//
// window.__sky — read by other modules (all getters, cheap, updated every frame):
//   tod (0..1), clock ('HH:MM'), weather (target name), mode ('auto' or the lobby override)
//   wind 0..1, windDir THREE.Vector2 (unit, world x/z, the way the wind blows TO)
//   tempC   outdoor air temperature °C: time of day (≈12 at night … 22 mid-afternoon) + weather (cloudy −2,
//           overcast −3, fog/rain −4, storm −6); snow ≈ −3, blizzard ≈ −12 (eases with the weather)
//   feelsC  wind-chill / breeze adjusted temperature °C (what exposed skin feels outdoors)
//   severity 0..1 storminess (clear 0, cloudy .05, rain .4, snow .35, storm .8, blizzard 1)
//   precip  'none' | 'rain' | 'snow' (what is falling right now), precipAmount 0..1
//   indoor (camera under a roof), wet 0..1 (outdoor surfaces), snowCover 0..1 (outdoor ground/roofs)
//   set({ tod: 'HH:MM'|0..1, frozen, weather, instant, flash }) — weather goes to the whole lobby
import * as THREE from 'three';
import * as P from '../plan.js';
import { todAt, clockOf, parseClock, sunDirAt, moonDirAt, palette, smooth, PARAMS, KEYS_W, WEATHERS, autoWeather, windDirAt, hash } from './time.js';
import { createDome } from './dome.js';
import { HAZE as SITE_HAZE } from '../rooms/site/sky.js';
import { exposureK } from '../lighting.js'; // the site piece's distance haze colour (shared uniform value)

let SKY = null; // singleton: createSky (main.js) + startSkySync (multiplayer.js)
const D = 180 / Math.PI;

export function skyWanted(params, shot) { return !shot && params.get('sky') !== '0'; }

export function createSky(ctx) {
  if (SKY) return SKY;
  const { scene, renderer, sun, hemi, LIGHT, params } = ctx;
  const dome = createDome(renderer); scene.add(dome.mesh);
  const U = dome.uniforms;
  scene.fog = new THREE.FogExp2(0xb8c4cf, PARAMS.clear.fog);
  const dual = { envDayK: { value: 1 }, envNightK: { value: 0 }, envFlash: { value: 0 } }; // envFlash x per-room sky exposure (lighting.js)
  const WET = { value: 0 }, SNOWC = { value: 0 }, OUTFLASH = { value: 0 }, NIGHTAMB = { value: 0 }; // NIGHTAMB (polish): outdoor-only blue night ambient // OUTFLASH: lightning ambient on outdoor materials while the camera is indoors

  // ---------------------------------------------------------------- clock / weather state
  const tp = parseClock(params.get('tod'));
  const clk = { skew: 0, frozen: tp !== null, frozenTod: tp ?? 0, offset: 0 };
  const forced = WEATHERS.includes(params.get('weather')) ? params.get('weather') : null;
  const net = { mode: forced || 'auto', seq: 0 };
  const wall = () => Date.now() + clk.skew;
  const todNow = () => (clk.frozen ? clk.frozenTod : (((todAt(wall()) + clk.offset) % 1) + 1) % 1);
  const targetName = () => (net.mode === 'auto' ? autoWeather(wall()) : net.mode);
  const W = { ...PARAMS[targetName()] }; let wet = W.rain > 0.05 ? 1 : 0, snowCover = W.snow > 0.05 ? 1 : 0;
  let tempC = 18, feelsC = 18;
  const windDir = new THREE.Vector2(1, 0); let wind = W.wind;

  // ---------------------------------------------------------------- state compute / apply
  const sunD = new THREE.Vector3(), moonD = new THREE.Vector3(), lightD = new THREE.Vector3().copy(LIGHT.sunDir);
  const mkS = () => ({ zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), land: new THREE.Color(), lit: new THREE.Color(), shade: new THREE.Color(), sunCol: new THREE.Color(), fogC: new THREE.Color(), hemiSky: new THREE.Color(), lightCol: new THREE.Color(),
    skyDay: 1, star: 0, sunVis: 1, moonVis: 0, cover: 0, dark: 0, haze: 0, fogAmt: 0, fog: 0, lightI: 0, moonLight: false, hemiI: 0, envI: 1, dayK: 1, nightK: 0, lightsK: 0, exposure: 1, wet: 0, rain: 0, flash: 0 });
  const live = mkS(), refDay = mkS(), refNight = mkS();
  const COLD = new THREE.Color(0.62, 0.76, 1.0), SNOWFOG = new THREE.Color(0.55, 0.6, 0.68);
  const _c = new THREE.Color(), MOONCOL = new THREE.Color(0.55, 0.66, 1.0), HEMI_DAY = new THREE.Color(0xeef3fa), HEMI_NIGHT = new THREE.Color(0.45, 0.55, 0.9);
  let nightReady = false, indoorK = 0;
  function compute(S, E, moonEl, w, flash, wetV) {
    palette(E, 'zenith', S.zen); palette(E, 'horizon', S.hor); palette(E, 'glow', S.glow); palette(E, 'land', S.land);
    palette(E, 'cloudLit', S.lit); palette(E, 'cloudShade', S.shade); palette(E, 'sunCol', S.sunCol);
    S.cover = w.cover; S.dark = w.dark; S.haze = w.haze; S.rain = w.rain; S.flash = flash; S.wet = wetV; S.snowC = S === live ? snowCover : 0;
    S.lit.multiplyScalar(1 - 0.65 * w.dark); S.shade.multiplyScalar(1 - 0.72 * w.dark);
    S.land.multiplyScalar(1 - 0.45 * w.cover * (0.4 + 0.6 * w.dark));
    { const gl = smooth(0.72, 0.92, w.dark); S.lit.multiplyScalar(1 - 0.4 * gl); S.shade.multiplyScalar(1 - 0.45 * gl); S.hor.multiplyScalar(1 - 0.35 * gl); S.zen.multiplyScalar(1 - 0.35 * gl); } // polish: storm sky ~40% darker than rain
    S.skyDay = smooth(6, 20, E); S.sunVis = smooth(-1.2, 0.4, E); S.moonVis = smooth(-2, -8, E) * smooth(-2, 4, moonEl);
    S.star = smooth(-6, -14, E);
    S.fogAmt = Math.min(0.92, Math.max(0, (w.fog - 0.004) * 22));
    // fog colour = what the horizon looks like through the cloud deck
    S.fogC.copy(S.hor).lerp(_c.copy(S.shade).lerp(S.lit, 0.35), Math.min(1, w.cover * 0.9)); S.fogC.lerp(S.zen, 0.15);
    S.fog = w.fog;
    S.dayK = smooth(-6, 12, E); S.lightsK = 1 - smooth(-3, 9, E);
    const sunK = Math.pow(Math.min(1, Math.max(0, (E + 1.5) / 8)), 0.7);
    if (E > -3) { S.moonLight = false; S.lightI = LIGHT.sunIntensity * sunK * w.light; S.lightCol.copy(S.sunCol); }
    // polish: moon 0.3 -> 0.1 — at 0.3 it threw sharp, sun-like window patches onto night interiors (kitchen 22:00);
    // the outdoors get their night readability from the outdoor-only ambient (NIGHTAMB, patchOutdoor) instead
    else { S.moonLight = true; S.lightI = 0.1 * smooth(-3, -9, E) * smooth(-2, 6, moonEl) * Math.sqrt(w.light); S.lightCol.copy(MOONCOL); }
    // lightning (contain pass): the hemi light is unshadowed and reaches every interior, so its flash only applies while
    // the camera is outdoors; indoors the outdoor materials get it through OUTFLASH, rooms through their probe exposure
    // (dual.envFlash), and the directional flash only where the sun/moon shadow map lets it in (none when shadows are off)
    // polish: storm gloom — rain (dark .7) keeps its ambient, a storm (dark .92) loses ~40% of hemi + sky env light
    S.gloom = smooth(0.72, 0.92, w.dark);
    S.hemiI = LIGHT.hemi * (0.07 + 0.93 * S.dayK) * (1 - 0.15 * w.cover) * (1 - 0.42 * S.gloom) + flash * 3.5 * (1 - indoorK); S.lightI += sun.castShadow ? flash * 2.5 : 0;
    S.hemiSky.copy(HEMI_NIGHT).lerp(HEMI_DAY, S.dayK).lerp(_c.copy(S.hor).multiplyScalar(1.6), 0.12 * smooth(-4, 2, E) * (1 - smooth(4, 14, E)));
    S.envI = LIGHT.envIntensity * (0.1 + 0.9 * S.dayK) * (1 - 0.3 * w.cover * w.dark) * (1 - 0.4 * S.gloom) + flash * 1.5 * (1 - indoorK);
    // scene.environment (neutral room light) is what interior surfaces without a baked probe use (?noprobes, avatars,
    // anything unbound, every room before the night set is baked): with the lights on it must stay a lit home
    if (S.lightsK > 0) S.envI = Math.max(S.envI, S.lightsK * (0.12 + (nightReady ? 0.25 : 0.45) * indoorK));
    // snow weather: cold blue light, whiter fog
    if (w.cold > 0.01) { const k = w.cold * (0.35 + 0.5 * w.snow); S.lightCol.lerp(COLD, k); S.hemiSky.lerp(COLD, k * 0.8); S.fogC.lerp(_c.copy(SNOWFOG).multiplyScalar(0.05 + 0.95 * S.dayK), w.snow * 0.6); }
    S.exposure = LIGHT.exposure * (1 + 0.2 * (1 - S.dayK));
    return S;
  }
  // emissives / probe materials / lantern glows (filled by setup)
  const emis = []; let emisK = -1, glowCap = Infinity; // glowCap (polish): api.setGlowCap — the flood clamps exterior glow
  const plainProbe = []; let plainK = -1; let glow = null, pool = null, shadows = null, rain = null, hm = null;
  function applyLights(lightsK, dayK, nightK, force) {
    if (force || Math.abs(lightsK - emisK) > 0.004) { emisK = lightsK; for (const e of emis) e.m.emissiveIntensity = e.out ? Math.min(e.base * (0.04 + 6.96 * lightsK), Math.max(e.base, 12) * lightsK + 0.04 * e.base, glowCap) /* polish: exterior lanterns / string lights / landscape lamps ≈ off at noon, full at night (capped at 12 so string-light bloom doesn't wash the deck) */ : e.base < 0.3 ? e.base * (1 - 0.75 * lightsK) : e.base * (1 + 0.35 * lightsK); /* < 0.3: fake daylight bounce, dims at night */ if (glow) { glow.material.uniforms.uAmt.value = lightsK; glow.visible = lightsK > 0.01; } }
    const pk = dayK + 0.55 * nightK; if (force || Math.abs(pk - plainK) > 0.01) { plainK = pk; for (const m of plainProbe) m.envMapIntensity = m.userData.baseEnvI * LIGHT.probeIntensity * pk; }
  }
  function apply(S, { capture = false } = {}) {
    U.zenithC.value.copy(S.zen); U.horizonC.value.copy(S.hor); U.glowC.value.copy(S.glow); U.landC.value.copy(S.land);
    U.cloudLit.value.copy(S.lit); U.cloudShade.value.copy(S.shade); U.sunC.value.copy(S.sunCol); U.fogC.value.copy(S.fogC);
    U.skyDay.value = S.skyDay; U.starAmt.value = S.star; U.sunVis.value = S.sunVis; U.moonVis.value = S.moonVis;
    U.cover.value = S.cover; U.cdark.value = S.dark; U.haze.value = S.haze; U.fogAmt.value = S.fogAmt; U.flash.value = S.flash;
    sun.intensity = S.lightI; sun.color.copy(S.lightCol);
    hemi.intensity = S.hemiI; hemi.color.copy(S.hemiSky);
    scene.environmentIntensity = S.envI;
    scene.fog.color.copy(S.fogC); scene.fog.density = S.fog * (capture ? 1 : fogIndoorK);
    WET.value = S.wet; SNOWC.value = S.snowC || 0;
    NIGHTAMB.value = capture ? 0 : (1 - S.dayK) * (1 - 0.6 * S.cover * S.dark); // polish: moonlit-sky fill on outdoor materials only (night readability)
    const dk = S.dayK * (1 - 0.35 * S.cover * S.dark); dual.envFlash.value = capture ? 0 : S.flash * 0.7; OUTFLASH.value = capture ? 0 : S.flash * 3.5 * indoorK;
    dual.envDayK.value = nightReady ? dk : Math.max(dk, 0.35 * S.lightsK); dual.envNightK.value = nightReady ? S.lightsK : 0;
    applyLights(S.lightsK, dual.envDayK.value, dual.envNightK.value, capture);
    // the site piece's atmosphere: far-terrain haze follows our fog colour (unchanged at reference daylight),
    // far ridgelines (unlit vertex colours) are lit like the HDRI land and vanish in fog
    SITE_HAZE.r = HAZE0.r * S.fogC.r / FOG0.r; SITE_HAZE.g = HAZE0.g * S.fogC.g / FOG0.g; SITE_HAZE.b = HAZE0.b * S.fogC.b / FOG0.b;
    if (ridges) { ridges.material.color.copy(S.land).lerp(S.fogC, S.haze * 0.5); ridges.visible = S.fogAmt < 0.5; }
  }
  const HAZE0 = SITE_HAZE.clone(); let FOG0 = null, ridges = null;
  // reference states for the probe bakes (clear sky, sun high / deep night)
  compute(refDay, 40, -40, PARAMS.clear, 0, 0); compute(refNight, -25, 40, PARAMS.clear, 0, 0); FOG0 = refDay.fogC.clone();
  refDay.lightI = LIGHT.sunIntensity; refDay.lightCol.set(LIGHT.sunColor); refDay.hemiI = LIGHT.hemi; refDay.hemiSky.copy(HEMI_DAY); refDay.envI = LIGHT.envIntensity;
  refNight.lightI = 0;

  // ---------------------------------------------------------------- environment (main.js loadEnvironment)
  function attachEnv(hdr, rotY) {
    U.tHdr.value = hdr; U.rotY.value = rotY; U.refSun.value.copy(LIGHT.sunDir);
    step(0, true); return dome.captureEnv();
  }
  // wet look for outdoor materials (kit.outdoor): darker + glossier, mostly on up-facing surfaces
  // Patching is deferred until setup() (after the global merge): kit/geo.js mergeStatic skips meshes whose material
  // has a custom shader hook, so patching at kit.outdoor() time would cost ~340 extra draw calls.
  const outdoorMats = []; let outdoorLive = false;
  function outdoorPatch(mat) { if (outdoorLive) patchOutdoor(mat); else if (mat) outdoorMats.push(mat); }
  function patchOutdoor(mat) {
    // skip glass + water (roughness < 0.08): the pool never freezes or whitens
    if (!mat || mat.isShaderMaterial || mat.transparent || mat.userData.skyWet || !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) || (mat.roughness ?? 1) < 0.08) return;
    mat.userData.skyWet = true;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = function (sh, r) {
      prev?.call(this, sh, r);
      if (!sh.fragmentShader.includes('#include <lights_physical_fragment>')) return;
      sh.uniforms.uWet = WET; sh.uniforms.uSnowC = SNOWC; sh.uniforms.uOutFlash = OUTFLASH; sh.uniforms.uNightAmb = NIGHTAMB;
      // polish: + uNightAmb — a soft blue sky fill (up-facing brighter) so facades, road and garden read at night
      // without the moon having to shine sharp patches into the rooms
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#if defined( RE_IndirectDiffuse )\n' +
        '  { float ny = 0.5 + 0.5 * inverseTransformDirection( geometryNormal, viewMatrix ).y;\n' +
        '  irradiance += uOutFlash * mix( vec3( 0.45, 0.43, 0.42 ), vec3( 0.8, 0.87, 1.0 ), ny ) + uNightAmb * mix( vec3( 0.07, 0.09, 0.14 ), vec3( 0.17, 0.22, 0.36 ), ny ); }\n#endif');
      // polish wet look: stronger darkening + near-mirror roughness on flat ground, plus procedural puddles (world-space
      // value noise; world position = cameraPosition + view offset rotated back, no extra varying)
      sh.fragmentShader = 'uniform float uWet; uniform float uSnowC; uniform float uOutFlash; uniform float uNightAmb;\n' +
        'float skyH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\n' +
        'float skyN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( skyH( i ), skyH( i + vec2( 1, 0 ) ), f.x ), mix( skyH( i + vec2( 0, 1 ) ), skyH( i + vec2( 1, 1 ) ), f.x ), f.y ); }\n' +
        sh.fragmentShader.replace('#include <lights_physical_fragment>',
        '{ vec3 wn = inverseTransformDirection( normal, viewMatrix ); float flat_ = smoothstep( 0.25, 0.85, wn.y ); float wk = uWet * ( 0.3 + 0.7 * flat_ );\n' +
        '  float pd = 0.0; if ( uWet > 0.01 && wn.y > 0.9 ) { vec2 wp = ( cameraPosition + ( vec4( -vViewPosition, 0.0 ) * viewMatrix ).xyz ).xz;\n' +
        '    pd = smoothstep( 0.58, 0.68, skyN( wp * 0.45 ) * 0.7 + skyN( wp * 1.7 ) * 0.3 ) * uWet * smoothstep( 0.9, 0.98, wn.y ); }\n' +
        '  diffuseColor.rgb *= ( 1.0 - 0.5 * wk ) * ( 1.0 - 0.5 * pd ); roughnessFactor = mix( mix( roughnessFactor, 0.12, wk * 0.9 ), 0.03, pd );\n' +
        '  float sk = uSnowC * smoothstep( 0.45, 0.9, wn.y ); diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.93, 0.97 ), sk ); roughnessFactor = mix( roughnessFactor, 0.8, sk ); }\n#include <lights_physical_fragment>');
    };
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|wet2'; };
    mat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- scene scan (main.js, after pieces build, before merging)
  const lanterns = [];
  function preMerge() {
    scene.updateMatrixWorld(true);
    scene.traverse(o => { if (o.name === 'lantern' && o.isGroup) lanterns.push(o.matrixWorld.clone()); });
  }
  function makeGlows() {
    if (!lanterns.length) return null;
    const g = new THREE.PlaneGeometry(2.0, 2.6);
    const mat = new THREE.ShaderMaterial({ uniforms: { uAmt: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); }',
      fragmentShader: `uniform float uAmt; varying vec2 vUv;
        void main(){ vec2 q = ( vUv - vec2( 0.5, 0.66 ) ) * vec2( 2.0, 2.6 ); float r = length( q * vec2( 1.0, 0.8 ) );
          float cone = 1.0 - smoothstep( 0.0, 1.4, abs( q.x ) - max( -q.y, 0.0 ) * 0.35 - max( q.y, 0.0 ) * 0.2 );
          float a = ( exp( -r * r * 2.2 ) * 0.9 + exp( -r * 3.0 ) * 0.25 * cone ) * smoothstep( 1.0, 0.55, r ); // polish: radial fade to 0 well inside the quad (was a visible rectangle)
          gl_FragColor = vec4( vec3( 1.0, 0.62, 0.32 ) * a * uAmt * 0.38, 1.0 ); }` });
    const im = new THREE.InstancedMesh(g, mat, lanterns.length); const off = new THREE.Matrix4().makeTranslation(0, -0.3, 0.035);
    lanterns.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(off)));
    im.name = 'sky:lantern-glow'; im.frustumCulled = false; im.renderOrder = 4; im.castShadow = false; im.visible = false;
    im.userData.noProbe = true; im.userData.noCull = true; im.userData.keep = true; im.matrixAutoUpdate = false;
    scene.add(im); return im;
  }
  const insideHouse = (p) => {
    const lv = p.y > P.LEVELS[1].floor - 0.3 ? 1 : 0;
    for (const r of Object.values(P.ROOMS)) { if (r.outdoor || r.level !== lv) continue; const [x0, z0, x1, z1] = r.rect; if (p.x > x0 - 0.2 && p.x < x1 + 0.2 && p.z > z0 - 0.2 && p.z < z1 + 0.2) return true; }
    return false;
  };
  // ---------------------------------------------------------------- setup (main.js, after the probes are bound, before shader compile)
  async function setup({ bound, lightPool, shadowSched, quality }) {
    pool = lightPool; shadows = shadowSched; SKY.quality = quality;
    // emissive fixtures (no maps: screens/videos manage themselves), interior vs exterior by position
    const seen = new Set(), wp = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!o.isMesh || (o.name || '').startsWith('sky:')) return;
      for (const m of [].concat(o.material)) {
        if (!m || seen.has(m) || !m.emissive || m.emissiveMap || m.map?.isVideoTexture) continue;
        if (m.emissiveIntensity <= 0 || m.emissive.r + m.emissive.g + m.emissive.b < 0.05) continue;
        seen.add(m); o.getWorldPosition(wp); emis.push({ m, base: m.emissiveIntensity, out: !insideHouse(wp) });
      }
    });
    if (bound?.list) for (const m of bound.list) if (!m.userData.dualEnv) plainProbe.push(m);
    roomExpo = bound?.expo || null;
    outdoorLive = true; for (const m of outdoorMats) patchOutdoor(m); outdoorMats.length = 0;
    glow = makeGlows();
    // the site piece's own static sky dome is replaced by ours (it would otherwise shade every pixel first)
    const siteSky = scene.getObjectByName('site-sky'); if (siteSky) siteSky.visible = false;
    ridges = scene.getObjectByName('site-far-ridges') || null;
    try {
      const R = await import('./rain.js');
      hm = R.buildHeightMap(renderer, scene);
      rain = R.createRain(hm); scene.add(rain.mesh);
    } catch (e) { console.warn('[sky] rain off:', e); }
    try { const { createWeatherAudio } = await import('./audio.js'); SKY.audio = createWeatherAudio(); } catch (e) { console.warn('[sky] audio off:', e); }
    try { const { createPanel } = await import('./panel.js'); SKY.panel = createPanel(api); } catch (e) { console.warn('[sky] panel off:', e); }
    step(0, true);
    window.__skyInfo = { emissives: emis.length, outdoorEmissives: emis.filter(e => e.out).length, plainProbeMats: plainProbe.length, lanterns: lanterns.length };
  }

  // ---------------------------------------------------------------- probe bakes (main.js probesJob)
  let bakingDay = false;
  // day set: reference daylight (sun held at LIGHT.sunDir until it finishes), night set: lights on, no sun
  function captureWrap(kind, base) {
    return (pos, draw) => {
      const S = kind === 'day' ? refDay : refNight;
      const vis = rain?.mesh.visible; if (rain) rain.mesh.visible = false;
      const dk = dual.envDayK.value, nk = dual.envNightK.value;
      apply(S, { capture: true });
      dual.envDayK.value = kind === 'day' ? 1 : 0; dual.envNightK.value = kind === 'day' ? 0 : nightPassK;
      const go = () => { if (kind === 'night' && pool) boostPool(1); draw(); };
      try { if (base) base(pos, go); else go(); }
      finally { if (rain) rain.mesh.visible = vis; apply(live, { capture: true }); dual.envDayK.value = dk; dual.envNightK.value = nk; }
    };
  }
  let nightPassK = 0;
  async function bakeProbes(bound, base, intensity) {
    bakingDay = true; lightD.copy(LIGHT.sunDir); placeLight(); shadows?.poke();
    try { await bound.bake({ intensity, background: true, beforeCapture: captureWrap('day', base) }); }
    finally { bakingDay = false; }
    shadowAt = -1e9; // let the sun move to where it really is now
    // window.__probes (= "lighting done", tools/perf.mjs waits for it) only once the night set is baked too
    const dayInfo = window.__probes; delete window.__probes;
    try { await bound.bake({ intensity, background: true, target: 'night', beforeCapture: captureWrap('night', base), beforePass: (p) => { nightPassK = p > 0 ? 1 : 0; } });
    } finally { window.__probes = dayInfo; }
    nightReady = true; plainK = -1;
  }

  // ---------------------------------------------------------------- per-frame
  let fogIndoorK = 1, indoorS = 0, lastWeather = '', t = 0, envAge = 0;
  let shadowAt = -1e9; const shadowDir = new THREE.Vector3().copy(LIGHT.sunDir); let shadowMoon = false;
  const HOUSE_C = new THREE.Vector3(11.7, 0, 11.0);
  function placeLight() { sun.position.copy(HOUSE_C).addScaledVector(lightD, 40); sun.target.position.copy(HOUSE_C); sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); }
  let flashT = -10, flashHold = false, lastBoltSec = 0; const thunders = [];
  // ---------------------------------------------------------------- holes in the house (contain pass, 2 Hz poll)
  // Open / broken exterior windows + broken exterior wall panels (window.__building) become gaps in the rain height map
  // (rain.js setGaps: precipitation reaches that storey's floor in a strip just inside the hole) and add sky exposure to
  // that room for the lightning flash. Interior holes change nothing (there is a roof above both sides).
  let roomExpo = null, gapAcc = 0, gapSig = '', gapCount = 0;
  const indoorRoom = (x, z, lv) => { for (const [id, r] of Object.entries(P.ROOMS)) { if (r.outdoor || r.level !== lv) continue; const q = r.rect; if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) return id; } return null; };
  const OPS = new Map(P.OPENINGS.map(o => [o.id, o]));
  function syncGaps() {
    const B = window.__building; if (!B || !hm?.setGaps) return;
    let sig = ''; for (const h of B.holes) sig += 'h' + h.id + '|';
    for (const rec of B.openings.values()) if (rec.type !== 'doorway' && rec.normal && (rec.broken || rec.open > 0.05)) sig += 'o' + rec.id + '|';
    if (sig === gapSig) return; gapSig = sig;
    const gaps = [], extra = new Map();
    for (const h of B.holes) {
      const p = B.byId?.get(h.id); if (!p?.center || !p.N || !p.U) continue; const off = p.depth / 2 + 0.4;
      const a = indoorRoom(p.center.x + p.N.x * off, p.center.z + p.N.y * off, p.level), b = indoorRoom(p.center.x - p.N.x * off, p.center.z - p.N.y * off, p.level);
      if (!a === !b) continue; const s = a ? 1 : -1; const room = a || b; const fl = P.LEVELS[p.level].floor;
      if (hm.heightAt(p.center.x - p.N.x * s * (p.depth / 2 + 0.7), p.center.z - p.N.y * s * (p.depth / 2 + 0.7)) > p.y1) continue; // covered outside (porch, balcony above): no rain gets in
      gaps.push({ cx: p.center.x, cz: p.center.z, ux: p.U.x, uz: p.U.y, half: p.L / 2 + 0.02, nx: p.N.x * s, nz: p.N.y * s, n0: -p.depth / 2 - 0.02, n1: p.depth / 2 + 0.9, lo: fl, hi: p.y1 + 0.05 });
      extra.set(room, (extra.get(room) || 0) + p.L * (p.y1 - p.y0));
    }
    for (const rec of B.openings.values()) {
      if (rec.type === 'doorway' || !rec.normal || !(rec.broken || rec.open > 0.05)) continue; const o = OPS.get(rec.id); if (!o) continue;
      const [px, , pz] = rec.pos, nx = -rec.normal[0], nz = -rec.normal[2]; // into the room
      if (!indoorRoom(px + nx * 0.6, pz + nz * 0.6, o.level) || indoorRoom(px - nx * 0.7, pz - nz * 0.7, o.level)) continue; // exterior only
      const fl = P.LEVELS[o.level].floor;
      if (hm.heightAt(px - nx * 0.9, pz - nz * 0.9) > fl + o.head) continue; // under a porch roof / balcony: covered
      gaps.push({ cx: px, cz: pz, ux: -nz, uz: nx, half: o.w / 2, nx, nz, n0: -0.25, n1: 0.9, lo: fl, hi: fl + o.head + 0.05 });
    }
    gapCount = hm.setGaps(gaps);
    if (roomExpo) for (const [id, u] of roomExpo) u.value = exposureK(u.glass + (extra.get(id) || 0), u.floor);
  }
  function lightning(now, w) {
    const sec = Math.floor(now / 1000);
    if (lastBoltSec === 0) lastBoltSec = sec;
    for (let s = lastBoltSec + 1; s <= sec; s++) {
      if (w.bolt > 0.05 && hash(s * 3 + 1) < 0.075 * w.bolt) {
        flashT = performance.now() / 1000 - (now - s * 1000) / 1000 + hash(s * 5 + 2) * 0.6;
        const delay = 0.3 + hash(s * 7 + 3) * 4.5; thunders.push([flashT + delay, Math.min(1, delay / 4.8)]);
      }
    }
    lastBoltSec = sec;
    const ft = flashHold ? 0 : performance.now() / 1000 - flashT;
    let f = 0; if (ft >= 0 && ft < 0.7) f = Math.exp(-ft * 18) + 0.7 * Math.exp(-Math.max(0, ft - 0.13) * 14) * (ft > 0.13 ? 1 : 0) + 0.45 * Math.exp(-Math.max(0, ft - 0.3) * 10) * (ft > 0.3 ? 1 : 0);
    const nowS = performance.now() / 1000;
    for (let i = thunders.length - 1; i >= 0; i--) if (nowS >= thunders[i][0]) { SKY.audio?.thunder(thunders[i][1], indoorS); thunders.splice(i, 1); }
    return Math.min(1.4, f);
  }
  function boostPool(k) { if (!pool?.slots) return; for (const list of Object.values(pool.slots)) for (const sl of list) sl.light.intensity *= 1 + 0.6 * k; }
  const _v = new THREE.Vector3();
  function step(dt, snap = false) {
    t += dt;
    const now = wall(), tod = todNow();
    sunDirAt(tod, sunD); moonDirAt(tod, moonD);
    const E = Math.asin(sunD.y) * D, ME = Math.asin(moonD.y) * D;
    // weather params ease toward the target
    const name = targetName(); if (name !== lastWeather) { lastWeather = name; }
    const T = PARAMS[name]; const k = snap ? 1 : 1 - Math.exp(-dt / 6);
    for (const key of KEYS_W) W[key] += (T[key] - W[key]) * k;
    wet = snap ? (W.rain > 0.05 ? 1 : wet) : Math.min(1, Math.max(0, wet + (W.rain > 0.1 ? dt / 45 : -dt / 160)));
    // temperature: time of day (warmest ~15:00) + weather; snow weathers pull toward their own absolute value
    const base = 17 + 5 * Math.cos((tod - 15 / 24) * 2 * Math.PI);
    tempC = (base + W.dT) * (1 - W.cold) + W.coldT * W.cold;
    const vk = wind * 60; // km/h-ish
    feelsC = tempC <= 10 && vk > 4.8 ? 13.12 + 0.6215 * tempC - 11.37 * Math.pow(vk, 0.16) + 0.3965 * tempC * Math.pow(vk, 0.16) : tempC - wind * 3;
    // snow cover builds while it snows (faster in a blizzard), melts above freezing
    snowCover = snap ? (W.snow > 0.05 ? Math.min(1, W.snow * 1.4) : tempC > 1 ? 0 : snowCover) : Math.min(1, Math.max(0, snowCover + (W.snow > 0.15 ? dt * W.snow / 70 : tempC > 0 ? -dt * (W.rain > 0.05 ? 1 / 35 : 1 / 200) : 0))); // rain above freezing washes snow away in ~35 s; an instant switch to warm weather clears it
    const flash = W.bolt > 0.05 ? lightning(now, W) : 0;
    // wind: weather strength + gusts, direction from the clock
    // polish: storms gust harder (bolt weathers swing 0.45..1.0 of their wind) and their low cloud deck scuds ~3x faster
    const gv = 0.2 + 0.35 * W.bolt; const gust = 1 - gv + gv * (0.5 + 0.5 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 2) + 0.3 * Math.max(0, Math.sin(t * 2.3 + Math.sin(t * 0.7))));
    wind = Math.min(1, W.wind * gust); const wa = windDirAt(now); windDir.set(Math.cos(wa), Math.sin(wa));
    const cs = 0.004 + 0.02 * W.wind + 0.05 * W.bolt * wind; U.cloudOff.value.x += windDir.x * cs * dt; U.cloudOff.value.y += windDir.y * cs * dt;
    U.uTime.value = t % 1000;
    compute(live, E, ME, W, flash, wet);
    // indoor? (height map: something solid above the camera)
    const cam = ctx.camera.position;
    const indoor = hm ? (hm.heightAt(cam.x, cam.z) > cam.y + 0.5 ? 1 : 0) : 0;
    indoorS += (indoor - indoorS) * (snap ? 1 : 1 - Math.exp(-dt / 0.5));
    fogIndoorK = 1 - 0.85 * indoorS; indoorK = indoorS;
    apply(live);
    renderer.toneMappingExposure += (live.exposure - renderer.toneMappingExposure) * (snap ? 1 : 1 - Math.exp(-dt / 1.5));
    // light direction steps with the static shadow map (no per-frame shadow renders)
    if (!bakingDay) {
      _v.copy(live.moonLight ? moonD : sunD); if (_v.y < 0.07) { _v.y = 0.07; _v.normalize(); }
      const tier = SKY.quality?.tier?.name || 'High'; const stepDeg = tier === 'Low' || tier === 'Medium' ? 3 : 1.5;
      const ang = Math.acos(Math.min(1, _v.dot(shadowDir))) * D, nowS = performance.now() / 1000;
      if (snap || live.moonLight !== shadowMoon || (ang > stepDeg && nowS - shadowAt > 2.5)) {
        shadowDir.copy(_v); shadowMoon = live.moonLight; shadowAt = nowS; lightD.copy(_v); placeLight();
        if (shadows) shadows.poke(); else renderer.shadowMap.needsUpdate = true;
      }
    }
    // outdoor environment re-capture (sky colours drift slowly; weather/lightning don't need it per frame)
    envAge += dt;
    if (ENVREADY) { if (snap) { dome.captureEnv(); envAge = 0; } else { if (envAge > 2.5 && !dome.envBusy) { envAge = 0; dome.startEnv(); } dome.envStep(); } }
    // rain + ripples
    if (rain) {
      const tier = SKY.quality?.tier?.name || 'High'; const qk = tier === 'Low' ? 0.4 : tier === 'Medium' ? 0.65 : 1;
      const pr = Math.max(W.rain, W.snow), snowK = pr > 0.001 ? W.snow / (W.rain + W.snow) : 0;
      rain.update(dt, t, ctx.camera, pr * qk, wind, Math.atan2(windDir.y, windDir.x), Math.max(0.06, live.dayK * (1 - 0.5 * W.dark)) + flash * 0.6, qk === 1, snowK);
    }
    SKY.audio?.set(W.rain, wind, indoorS, dt);
    gapAcc += dt; if (gapAcc > 0.5) { gapAcc = 0; syncGaps(); }
  }
  let ENVREADY = false;
  // ---------------------------------------------------------------- public
  const windOut = new THREE.Vector2();
  function requestWeather(mode) { if (mode !== 'auto' && !WEATHERS.includes(mode)) return false; if (SKY.sync) SKY.sync.request(mode); else { net.mode = mode; net.seq++; } return true; }
  const api = {
    get tod() { return todNow(); }, get clock() { return clockOf(todNow()); },
    get weather() { return targetName(); }, get mode() { return net.mode; },
    get wind() { return wind; }, get windDir() { return windOut.copy(windDir); },
    get indoor() { return indoorS > 0.5; }, get wet() { return wet; }, get params() { return { ...W }; },
    get daylight() { return live.dayK * (1 - 0.35 * live.cover * live.dark) * (1 - 0.4 * (live.gloom || 0)); }, // polish: 0 night .. 1 clear day (pool water, decor)
    get tempC() { return tempC; }, get feelsC() { return feelsC; }, get severity() { return Math.min(1, Math.max(0, W.sev)); },
    get precip() { return W.snow > 0.12 && W.snow >= W.rain ? 'snow' : W.rain > 0.08 ? 'rain' : 'none'; }, get precipAmount() { return Math.max(W.rain, W.snow); },
    get snowCover() { return snowCover; },
    get sun() { return { el: +(Math.asin(sunD.y) * D).toFixed(2), dir: sunD.toArray().map(v => +v.toFixed(3)) }; },
    get nightReady() { return nightReady; }, get skew() { return clk.skew; },
    roofAt: (x, z) => (hm ? hm.heightAt(x, z) : -100), gapAt: (x, z) => hm?.gapAt?.(x, z) ?? null, get gaps() { return gapCount; }, // contain pass: static roof height map + live opening gaps
    set(o = {}) {
      if (o.tod !== undefined) { const v = typeof o.tod === 'string' ? parseClock(o.tod) : o.tod; if (v !== null && isFinite(v)) { if (o.frozen === false) { clk.frozen = false; clk.offset = v - todAt(wall()); } else { clk.frozen = true; clk.frozenTod = ((v % 1) + 1) % 1; } } }
      else if (o.frozen !== undefined) { if (o.frozen) { clk.frozenTod = todNow(); clk.frozen = true; } else clk.frozen = false; }
      if (o.weather) requestWeather(o.weather);
      if (o.flash !== undefined) { flashHold = o.flash === 'hold'; flashT = o.flash ? performance.now() / 1000 : -10; } // tests: a lightning flash now (storm only); 'hold' freezes it at full
      if (o.instant) { step(0, true); }
      return { tod: api.clock, weather: api.weather };
    },
    requestWeather,
    setGlowCap(v) { const n = v > 0 ? v : Infinity; if (n !== glowCap) { glowCap = n; emisK = -1; } }, // polish: cap on exterior emissives (re-applied next frame)
  };
  SKY = { api, net, clk, dual, attachEnv, outdoorPatch, preMerge, setup, bakeProbes, captureWrap, requestWeather, step: (dt) => step(dt), afterPool: () => boostPool(live.lightsK),
    envReady() { ENVREADY = true; }, get rain() { return rain; }, get hm() { return hm; }, quality: null, audio: null, panel: null, sync: null, wall };
  window.__sky = api;
  return SKY;
}

// ---------------------------------------------------------------- lobby sync (multiplayer.js calls this)
export function startSkySync(ctx, mp) {
  const S = SKY; if (!S || !mp?.channel) return null;
  const ch = mp.channel('sky'); const net = S.net;
  const self = () => mp.selfId || mp.net?.selfId;
  const ids = () => [self(), ...(mp.members ? [...mp.members] : [...(mp.peers?.keys?.() || [])])].filter(Boolean).filter(id => !String(id).startsWith('bot'));
  const host = () => ids().sort()[0];
  const isHost = () => !mp.connected || host() === self();
  const msg = () => ({ k: 'st', mode: net.mode, seq: net.seq, wall: Date.now() + S.clk.skew, perf: performance.now() });
  const offsetTo = (id) => { try { const c = mp.clock?.(id) ?? mp.net?.clock?.(id); return typeof c === 'number' && isFinite(c) ? c : null; } catch { return null; } };
  function stamp(mode) { net.mode = mode; net.seq += 1; if (mp.connected) ch.send(msg()); }
  S.sync = {
    request(mode) {
      if (isHost()) stamp(mode);
      else { net.mode = mode; ch.send({ k: 'req', mode, seq: net.seq }, host()); } // optimistic; the host's stamp confirms it
    },
  };
  ch.onMessage = (d, from) => {
    if (!d || typeof d !== 'object') return;
    if (d.k === 'req' && isHost() && (d.mode === 'auto' || WEATHERS.includes(d.mode))) { net.seq = Math.max(net.seq, d.seq | 0); stamp(d.mode); return; }
    if (d.k !== 'st' || !(d.mode === 'auto' || WEATHERS.includes(d.mode)) || !Number.isFinite(d.seq)) return;
    if (d.seq > net.seq || (d.seq === net.seq && from === host() && d.mode !== net.mode)) { net.seq = d.seq; net.mode = d.mode; }
    // clock: follow the host's wall clock (its performance clock + our measured offset to it)
    if (from === host() && from !== self() && Number.isFinite(d.wall) && Number.isFinite(d.perf)) {
      const off = offsetTo(from); const hostWall = off !== null ? performance.now() - off + (d.wall - d.perf) : d.wall;
      const skew = hostWall - Date.now(); if (Math.abs(skew) < 7 * 24 * 3600e3) S.clk.skew = skew;
    }
  };
  mp.onPeerJoin?.((id) => { setTimeout(() => ch.send(msg(), id), 400); }); // everyone hands the newcomer the current state
  mp.onPeerLeave?.(() => { if (isHost() && mp.connected) S.clk.skew = 0; });
  setInterval(() => { if (mp.connected && isHost()) { S.clk.skew = 0; ch.send(msg()); } }, 8000);
  return { get mode() { return net.mode; }, get seq() { return net.seq; }, get host() { return host(); } };
}
