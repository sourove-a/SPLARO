# SPLARO Storefront UI Rules — Pearl Glass™

Short law for chrome and commerce surfaces. Prefer reuse over new glass.

**System name:** Pearl Glass™ — frost white, pearl reflection, thin white edge, silver ambient, depth blur, soft inner shadow. One look everyone should recognize as SPLARO.

## Shells (use these)

| Shell | Class | When |
|-------|--------|------|
| Panel | `.account-glass` / `AccountGlass` | Content heroes, account, FAQ, contact, about |
| Utility | `.pearl-glass` | One-off elevated panels (inherits Pearl tokens) |
| Bar | `.spl-glass-bar` / `.site-header-glass` | Sticky header strips |
| Card | `.spl-glass-card` | Filter rows, elevated panels, story rows |
| Sheet | `.spl-glass-sheet` | Drawers, modals, bottom sheets |
| Pill | `.lg-pill` / `LiquidGlassPill` | Compact chips & filter controls |

Do **not** invent a new glass recipe per page. Token-align first (`--pearl-*` + legacy `--glass-*` in `styles/glass-tokens.css` + `globals.css`).

## Contrast

- Light glass first: ink `#101114` (`--pearl-ink` / `--glass-ink`) on frost white.
- Over-hero header stays **transparent** so white logo/nav stay visible. Never force solid white glass on `.site-header-glass--over-hero`.
- Badges and counts must stay readable on glass (near-black fills, not translucent grey).

## Touch

- Tap targets ≥ **44px** (icon buttons, nav items, filter triggers).
- No hover-only affordances on touch — active/pressed states required.
- Content always visible: no `opacity: 0` whileInView gates on critical chrome.

## Scroll Experience

Scroll + click must feel **premium and free** — no jyam, no boredom.

| Do | Don't |
|----|--------|
| Always-visible content on home | `opacity: 0` whileInView gates on cards/sections |
| Pause continuous sheens while scrolling (`html[data-scrolling]`) | Blur / parallax / light stacks on home |
| Snappy tap (`PRESS_DOWN` 110ms) | Long press locks / MICRO 320ms on click |
| Idle Pearl reflection resumes | Fighting Lenis with card transitions mid-scroll |

`ScrollActivityGate` + `styles/scroll-idle.css`. Lenis desktop: lerp `0.1`, wheelMultiplier `0.95`.  
`StorySection` / `ScrollReveal` optional elsewhere — **not** on home catalog. Off on reduced-motion / lite / Windows reveal gate.

## Navigation Language

Navbar · Mobile Nav · Filter · Drawer — **all Glass, floating, identical Pearl feel.**

| Surface | Class |
|---------|--------|
| Navbar | `.site-header-glass` |
| Mobile dock | `.mobile-bottom-nav__inner` |
| Filter panel / sheet / drawer | `.shop-filter-*` · `.mobile-filter-drawer__surface` |
| Menu / bag drawer | `.mm-drawer` · `.cart-drawer__panel` |

Tokens: `--nav-glass-*` in `styles/nav-language.css` (aliases Pearl). Over-hero header stays transparent. Lite/Windows → solid frost, same family.

## Button System

Never random. One geometry for all CTAs.

| Variant | Look | Class |
|---------|------|--------|
| **Primary** | Black Pearl | `.btn--primary` (alias `.btn-luxury`) |
| **Secondary** | White Glass | `.btn--secondary` (alias `.btn-glass`) |
| **Ghost** | Transparent Glass | `.btn--ghost` (alias `.btn-luxury-outline`) |
| **Danger** | Graphite | `.btn--danger` |

Shared: radius (`999px`), height (`2.85rem`), shadow tokens, Inter uppercase label.

Component: `components/ui/Button` · CSS: `styles/button-system.css`.

Account / checkout CTAs inherit the same height · radius · shadow. Do not invent one-off button recipes.

## Typography Rules

| Role | Face |
|------|------|
| Heading | **Editorial Serif** — Cormorant Garamond (`--font-heading`) |
| Body | **Inter** (`--font-body`) |

Tracking, spacing, and hierarchy are **shared tokens** (`styles/typography.css`) — same on every page.

| Token | Use |
|-------|-----|
| `.type-display` / `--type-display-size` | Page H1 |
| `.type-heading` | Section H2 |
| `.type-title` | Card / clause titles |
| `.type-body` | Supporting copy |
| `.type-label` | Eyebrow / badge |

Do **not** invent Inter-bold page titles or one-off tracking per route. Commerce micro-labels may keep tighter label tracking; product card names stay serif where already set.

## Premium Icons

Lucide alone is **not** premium. Chrome icons use `PremiumIcon`:

| Layer | Role |
|-------|------|
| Ambient | Soft silver bloom under disk |
| Disk / surface | Pearl frost circle + thin white edge |
| Sheen | Soft reflection (+ continuous sweep when motion-safe) |
| Glyph | Lucide stroke only — never bare |

Sizes: `xs` · `sm` · `md` · `lg`. Header icon buttons + `premium-nav-btn` share the same language.

Tokens/CSS: `styles/premium-icons.css` · component: `components/ui/PremiumIcon`.

## Motion Language

Elegant · Heavy · Luxury — **no bounce, no overshoot.**

| Rule | Value |
|------|--------|
| Hover lift | **2px** |
| Card scale | **1.02** |
| Duration | **320ms** |
| Spring | **Gentle** (tween only — never underdamped physics) |
| Mouse follow | **2°** (`AccountGlass tilt` on heroes) |
| Reflection | **Continuous** Pearl sheen + light sweep |

Tokens: `lib/motion/config.ts` + `styles/motion-language.css` + `--ease-luxury` / `--duration-luxury` in `globals.css`.

- Pearl reflection is soft and opt-out: disabled on `prefers-reduced-motion`, `data-perf='lite'`, and coarse/mobile.
- Prefer opacity / soft transform; avoid animating every section.
- No Magic UI / Aceternity / HeroUI / GSAP glass kits.

## Lite / Windows / mobile

- `html[data-perf='lite']`, `html[data-os='windows']`, and coarse/mobile paths disable `backdrop-filter` via `performance.css`.
- Solid opaque frost (`rgba(255,255,255,0.97)`) still reads as Pearl — blur is not required.
- When adding glass, always ensure a solid fallback path (token overrides already cover `.spl-glass-*` / `.pearl-glass`).

## Locked — do not touch without owner ask

- Footer / EarthBackdrop
- Google auth GIS button stack (custom glass + hidden GIS)
- Brand type (Cormorant / Inter)
- Full dark-mode Apple redesign

## Checkout / forms

- Glass panels OK where cards already exist.
- Labels, errors, and focus rings stay **solid** and high-contrast — never frosted away.
