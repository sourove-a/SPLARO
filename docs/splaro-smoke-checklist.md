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
- ILYN size pills: idle glass/black text; selected black/white; no hover/press jump.
- `prefers-reduced-motion: reduce`: hero autoplay/progress/video warm-up and marquee stay stopped.
- Presence concurrency does not return false `502`; BFF preserves upstream status.

## Checkout

- Cart item add/remove updates totals.
- Delivery charge recalculates from district/zone.
- COD path reaches order confirmation.
- Online payment sandbox shows honest pending/failed/paid state.
- Mobile keyboard open on final address field: Place order stays visible and submits on one tap.
- Closing keyboard does not leave sticky action floating above viewport.

## Scroll Pass (owner final — 2026-07-21)

### Mac / Linux fine desktop
- `html` has Lenis / `data-scroll-engine=lenis` (or Lenis class).
- Home page: scroll past product rails to footer — no mid-page freeze.
- Vertical wheel over horizontal rails still scrolls the page.
- Open cart/search overlay: page stays pinned; close restores scroll Y.

### Windows Pass
- Windows Chrome uses **native** scroll only.
- No Lenis class remains on `html`.
- Hardware-accelerated Windows uses lightweight hero video when configured.
- RDP/software rendering/reduced-motion/video failure shows poster without freezing slider.
- Product grid hover/click uses opacity only.
- Slider advances automatically after touch/pointer interaction.
- Menu/modal close releases scroll lock and restores native wheel.

## External launch gates

- Real Windows Chrome pass completed on owner PC.
- Firefox and WebKit core journeys pass.
- Real Google/OTP/payment callback/courier staging journeys pass without simulated success.
- Local Google test: register both loopback origins, set
  `NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true`, rebuild, then verify GIS popup.
- Production secrets rotated; sessions reissued; encrypted integrations re-saved.
- CI secret scan passes; deploy and production smoke complete only after explicit owner permission.
