# SPLARO Storefront UI Rules — Liquid Glass

Short law for chrome and commerce surfaces. Prefer reuse over new glass.

## Shells (use these)

| Shell | Class | When |
|-------|--------|------|
| Bar | `.spl-glass-bar` / `.site-header-glass` | Sticky header strips |
| Card | `.spl-glass-card` | Filter rows, elevated panels, story rows |
| Sheet | `.spl-glass-sheet` | Drawers, modals, bottom sheets |
| Pill | `.lg-pill` / `LiquidGlassPill` | Compact chips & filter controls |

Do **not** invent a fourth glass recipe per page. Token-align first (`--glass-*` in `styles/glass-tokens.css` + `globals.css`).

## Contrast

- Light glass first: ink `#101114` (`--glass-ink`) on frosted white.
- Over-hero header stays **transparent** so white logo/nav stay visible. Never force solid white glass on `.site-header-glass--over-hero`.
- Badges and counts must stay readable on glass (gold / near-black fills, not translucent grey).

## Touch

- Tap targets ≥ **44px** (icon buttons, nav items, filter triggers).
- No hover-only affordances on touch — active/pressed states required.
- Content always visible: no `opacity: 0` whileInView gates on critical chrome.

## Motion

- Prefer opacity / soft shadow transitions; avoid animating every section.
- No Magic UI / Aceternity / HeroUI / GSAP glass kits.
- Respect `prefers-reduced-motion` and existing motion tokens.

## Lite / Windows / mobile

- `html[data-perf='lite']`, `html[data-os='windows']`, and coarse/mobile paths disable `backdrop-filter` via `performance.css`.
- Solid opaque fallbacks (`rgba(255,255,255,0.97)`) still look premium — blur is not required.
- When adding glass, always ensure a solid fallback path (token overrides already cover `.spl-glass-*`).

## Locked — do not touch without owner ask

- Footer / EarthBackdrop
- Google auth GIS button stack (custom glass + hidden GIS)
- Brand type (Cormorant / Inter)
- Full dark-mode Apple redesign

## Checkout / forms

- Glass panels OK where cards already exist.
- Labels, errors, and focus rings stay **solid** and high-contrast — never frosted away.
