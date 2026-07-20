# SPLARO Smoke Checklist

Run before push/deploy.

## Tooling

- `corepack pnpm run check:web`
- `corepack pnpm run check:admin`
- `corepack pnpm run check:api`
- `corepack pnpm dev:reset`

## Health

- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001/login`
- API: `http://127.0.0.1:4000/api/v1/health`

## Storefront

- Home loads first hero without visible layout jump.
- Hero auto-advances after one slide interval.
- Header stays readable over hero and after scroll.
- Shop grid keeps stable 4:5 product media.
- `/shop` bottom to product click opens PDP at top, not footer.
- PDP size, color, quantity, add-to-bag controls do not move on press.
- Mobile `390x844`: nav, chat, sticky CTA, cart drawer do not overlap.

## Checkout

- Cart item add/remove updates totals.
- Delivery charge recalculates from district/zone.
- COD path reaches order confirmation.
- Online payment sandbox shows honest pending/failed/paid state.

## Scroll Pass (owner final — 2026-07-21)

### Mac / Linux fine desktop
- `html` has Lenis / `data-scroll-engine=lenis` (or Lenis class).
- Home page: scroll past product rails to footer — no mid-page freeze.
- Vertical wheel over horizontal rails still scrolls the page.
- Open cart/search overlay: page stays pinned; close restores scroll Y.

### Windows Pass
- Windows Chrome uses **native** scroll only.
- No Lenis class remains on `html`.
- No hero video on Windows.
- Product grid hover/click uses opacity only.
- Slider advances automatically after touch/pointer interaction.
