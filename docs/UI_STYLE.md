# UI style (all menus, HUD, panels)
Reference the user picked: carterogunsola.com. Take its look, not its content: no logo, no copied text, no copied artwork.
It is a dark, minimal "creative developer" UI with a mono HUD and soft grain.

## Colours
- Background: #1e1e1e, with a faint film-grain noise overlay. The noise is a tiny generated canvas or SVG, opacity ~0.06.
- Surfaces: #262626 for cards and nav pills, and #2f2f2f for chips.
- Text: #f7f7f7. Secondary text is rgba(247,247,247,.66) and muted text rgba(247,247,247,.32).
- Hairline border: 1px solid rgba(247,247,247,.06).
- Card shadow: 0 2px 6px -2px rgba(0,0,0,.2).
- Accent, used sparingly: a warm yellow #f2c84b. Use it for small presence/name labels, the way the reference shows a yellow mono name tag next to a cursor, and for the one key highlight.
- Live dot: white or #3ddc84.

## Type
- Sans: "Geist" (OFL; vendor woff2 in assets/fonts if you can, otherwise fall back to -apple-system/Inter). Weight 400–500. Tight tracking: -0.02em on body, -0.04em to -0.06em on big titles.
- Mono HUD: "Geist Mono" with fallback ui-monospace/SF Mono, 10–11px, weight 600, letter-spacing -0.4px.
- HUD chips use KEY::VALUE. The key is at 32% opacity and the value at 66%. Examples: `PLAYERS::3/8`, `FPS::120`, `LOBBY::K7Q2PX`, `PING::42ms`, `NOW::<song title>`.
- The big title on the main menu is large and tight, white on dark, with a small mono line under it like "No01 / PALISADES · 2026".

## Shapes
- Cards and pills: radius 6px.
- Segmented controls: the inner active pill is rgba(247,247,247,.08), radius 4px, with a ring shadow of 0 0 0 1px rgba(247,247,247,.04).
- Chips: radius 2px.
- Square icon buttons are about 46px: #262626, 1px hairline, radius 6px, thin-stroke icons in inline SVG.
- Button text is 16px with padding 4px 10px. Hover lightens the surface by ~4%. No big glowing gradients.
- Toast or presence card at the bottom: a full-width dark card with a dot, then "3 people joined" in bold and a mono subline such as "12 online".

## Motion
- Quick and calm: 150–250 ms ease-out, small 4–6px slides and fades.
- Text can do the subtle letter-scramble reveal on hover or title load (optional).
- Respect prefers-reduced-motion.

## Motion, measured from the reference (use this everywhere: menu, HUD, panels, toasts)
- **Easings.** Define them as CSS variables:
  - `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` is the main one, for moves, translate, scale and size.
  - `--ease-soft: cubic-bezier(0.5, 1, 0.89, 1)` is for colour, opacity and small scale.
  - `--ease-io: cubic-bezier(0.45, 0, 0.55, 1)` is for quick in/out swaps of about 0.18 s.
- **Durations.**
  - Hover colour: 0.25 s.
  - Opacity fades: 0.15–0.3 s.
  - Moves and translate: 0.3–0.5 s.
  - Large panel or stage transforms: 0.45–0.55 s.
  - Page veil fade: 0.6 s, opacity plus a blur filter.
- **Sliding active pill.** The nav and segmented controls have one highlight pill that slides between items. It animates transform, width and height over 0.4 s with ease-out-expo, and opacity over 0.25 s. Use this for the main menu item list, tabs (Lobbies/Create/Join), the Settings segmented controls and the quality picker.
- **Stage rise and sink.** Screens or panels enter with `opacity 0, translateY(6%) scale(.96)` easing to rest, and leave with `opacity 0, translateY(4%) scale(.97)`. Switching between menu screens = old sinks, new rises.
- **Text roll.** Titles and numbers roll in per character with a vertical slot-machine roll: each letter slides up through a clipped line with a small stagger (~25 ms per char) and ease-out-expo. The reference does this for project titles and the "No01/17" counter. Use it for the main title, screen titles, the player count and lobby codes. Number changes, such as players 2→3, roll the digit.
- **Film grain.** A fixed full-screen noise layer with a `grain-jump` stepped keyframe that translates it to random offsets on a fast loop (about 8 steps). Opacity is about 0.05–0.08 and pointer-events are off.
- **Live dot.** `hud-pulse`: opacity 1 → .35 → 1, in a 2 s loop.
- **Badges.** Pop in from `translate(-8px, 12px)`.
- **Buttons.**
  - Press: scale .97 over 0.2 s with ease-soft.
  - Hover: the surface lightens.
  - Icons can nudge 1–2px.
- **Spinner.** `spin-turn`, a 360° rotate, for "connecting…" states.
- **Presence.** The reference shows a small yellow mono name tag following other people's cursors. On the main menu, show "online now" presence chips that slide in. In-game toasts use the bottom presence card ("● 3 people joined / 12 online"), which slides up with ease-out-expo.
- **Hero media.** The reference's hero image is a slightly curved, warped card, with tilted media cards drifting at the screen edges. For the main menu, the live 3D house is the hero. Optionally frame it with a subtle vignette, and show lobby cards as small tilted cards that settle flat on hover.
- **Reduced motion.** Respect `prefers-reduced-motion`: no grain jump, no rolls, fades only.
