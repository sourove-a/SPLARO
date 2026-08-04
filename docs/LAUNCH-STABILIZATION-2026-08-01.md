# SPLARO Launch Stabilization — 2026-08-01

## Status

Local stabilization gates passed. This is **not** a “100% perfect” or production-ready claim.
Production secret rotation, real Windows acceptance, real provider journeys, Firefox/WebKit
matrix, CI/deploy, and optional Git-history purge remain external or owner-controlled gates.

Existing dirty worktree was preserved. No reset, commit, push, deploy, or history rewrite was
performed. Footer and locked Google-auth components were not changed.

## Fixes completed

### Storefront and Windows

- Windows/mobile/reduced-motion keep native vertical scrolling; Lenis stays limited to eligible
  Mac/Linux fine-pointer desktops.
- Hardware-accelerated Windows can use lightweight hero video renditions. Software rendering,
  RDP, reduced-motion, or video failure uses poster fallback.
- Hero mounts only active video, uses lightweight-first source order on Windows, and avoids
  reduced-motion autoplay/video warm-up.
- Reduced-motion stops hero autoplay, progress animation, slide/media transitions.
  Brand ribbon under the hero (`.home-flow-strip`) keeps flowing on Windows when
  Animation effects are OFF (`prefers-reduced-motion: reduce`). Mac/Linux reduce
  stays still so Lenis scroll isn’t fighting a GPU marquee.
  `scripts/check-web-interactions.mjs` verifies this contract.
- Storefront presence no longer collapses under normal BFF concurrency: BFF forwards resolved
  client address, API heartbeat limit allows concurrent storefront traffic, and BFF preserves
  upstream status/`Retry-After` instead of converting every failure to false `502`.
- Windows glass styling no longer loses PDP size-chip blur/shadow merely because OS is Windows;
  measured lite/software fallback still removes expensive effects.
- Mobile checkout action tracks the visual viewport while software keyboard is open. One tap on
  `Place order` dismisses focused field and submits same form; customer no longer needs Back then
  a second tap.

Key files:

- `apps/web/src/components/home/HeroSlider/HeroSlider.tsx`
- `apps/web/src/styles/pages/home.css`
- `apps/web/src/styles/performance.css`
- `apps/web/src/app/api/presence/route.ts`
- `apps/api/src/modules/storefront/storefront.controller.ts`
- `scripts/check-web-interactions.mjs`
- `apps/web/src/components/checkout/CheckoutMobileBar.tsx`
- `apps/web/src/styles/pages/checkout.css`

### Local Google OAuth origin safety

- Google GIS is not initialized on localhost/loopback unless
  `NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true`.
- This removes unauthorized-origin console errors without changing production Google login.
- Enable local GIS only after adding both `http://localhost:3000` and
  `http://127.0.0.1:3000` to OAuth client Authorized JavaScript origins.
- Google Cloud Console change remains external; code cannot authorize an OAuth origin.

Key files:

- `apps/web/src/hooks/useGoogleOAuthOriginEligibility.ts`
- `apps/web/src/components/auth/AuthGoogleProvider.tsx`
- `apps/web/src/components/auth/AuthGoogleGlassFooter.tsx`
- `.env.example`

### PDP size selector — ILYN parity

Reference checked against ILYN product page and local PDP at desktop/mobile.

- Unselected: transparent white liquid-glass surface, 40px height, 64px minimum width, 100px
  radius, 4px blur, matching inset/outset soft shadow, General Sans 16px/500.
- Selected: `#121212` fill, white text, no shadow.
- Hover/active do not translate or scale, preventing click-jump.
- Unavailable sizes remain honest and visibly struck through.
- Size Guide remains modal; closing restores original scroll position and releases overlay lock.

Key file: `apps/web/src/styles/pages/pdp.css`.

### Admin and operational honesty

- `DcHeader.tsx` raw white value replaced with `var(--on-violet)` design token; admin raw-hex,
  contrast, CSS, and table gates pass.
- Automation KPIs no longer invent `100%` success or zero actions/failures when stats are unavailable;
  missing metrics render `—` with an explicit unavailable label.
- Home, menu, and legal settings compare returned server fields before green success; mismatched
  responses show an error and refetch.
- Hero create, edit, publish/hide, reorder, and delete perform a fresh server read and verify the
  resulting banner state before any green success message.
- Home/legal/product preview actions use the configured storefront origin; they no longer open the
  admin root or a hardcoded production domain.
- Product edit status now reports query failure instead of remaining stuck on `LOADING`.
- Review approval says server-approved + storefront refresh requested; it no longer claims cache
  revalidation has already made content live.
- Coupon create/toggle/delete validates returned code/state/delete confirmation. Campaign create,
  duplicate, send count, and delete confirmation are validated; zero-recipient sends are amber.
- Direct WMS and Procurement URLs label themselves `BETA`, not `LIVE`.
- Admin command navigation no longer duplicates Google Sheets or Export Center.
- WMS/Procurement beta routes remain URL-reachable but are hidden from launch navigation.
- Dedicated operational screens (`mobile-screens`, `bulk`, `sms`, `telegram-bot`, `api-health`)
  are registered consistently as live screens; maturity labels no longer fall back to Preview.
- Admin mutations keep green success feedback behind verified API success.
- Beta/prototype navigation remains hidden/feature-gated; no incomplete module is presented as
  launch-complete.
- Courier protections remain: no simulated `DEV-*` booking persisted as real `BOOKED`, no Redis
  lock fallthrough, and order status mutations use canonical service flow.

### SEO daily brief

- Daily read-only SEO brief runs at 06:15 Asia/Dhaka.
- Brief targets lowest-scoring live product plus 30-day onsite search demand.
- Creates admin in-app recommendation; it does not make uncontrolled production edits.
- Google position/difficulty are never invented. Until Search Console OAuth exists, UI/API return
  explicit disconnected state and identify onsite search as signal source.
- Sitemap readiness no longer claims Google submission without evidence.

Key files:

- `apps/api/src/modules/admin-hub/seo-daily-brief.util.ts`
- `apps/api/src/modules/admin-hub/seo-daily-brief.cron.ts`
- `apps/api/src/modules/admin-hub/admin-hub.service.ts`
- `apps/admin/src/components/dc/DcSeoHealth.tsx`

### Secret handling and encryption rotation

- `infrastructure/hostinger/.env.splaro.co.production` removed from Git tracking while local copy
  stays ignored.
- Redacted `infrastructure/hostinger/.env.splaro.co.production.example` documents required keys.
- CI blocks tracked production env files and runs Gitleaks secret scanning.
- Encryption service supports rolling rotation: new `ENCRYPTION_KEY` encrypts; optional
  `ENCRYPTION_KEY_PREVIOUS` decrypts old integration values during migration.
- Encryption rotation tests cover current-key decrypt, previous-key fallback, and invalid key.

Safe rotation order:

1. Audit/export encrypted integration configuration without exposing secret values.
2. Put new value in `ENCRYPTION_KEY`; put old value in `ENCRYPTION_KEY_PREVIOUS`.
3. Rotate JWT, refresh JWT, admin session, revalidation, internal health, database/MySQL, and any
   exposed provider credentials.
4. Restart API; require customer/admin login again.
5. Test and re-save encrypted integrations so ciphertext uses new key.
6. Remove `ENCRYPTION_KEY_PREVIOUS`; restart and retest.

Production credential rotation must not wait for Git-history cleanup. History purge requires
mirror backup, explicit force-push approval, `git filter-repo`, verification, and fresh clones.

## Verification evidence

| Gate | Result |
|---|---|
| `git diff --check` | Pass |
| Web/admin/API checks | Pass |
| Monorepo type-check | 7 tasks pass |
| API unit | 29 suites, 156 tests pass |
| API isolated-DB e2e | 2 suites, 15 tests pass |
| Prisma | 13 migrations; current schema valid/no drift |
| Production builds | Web, admin, API pass; web generated 77 routes |
| Reduced-motion smoke | Pass; autoplay/progress/marquee stopped; no console errors |
| Presence concurrency | 60/60 concurrent BFF heartbeats returned 200 |
| Runtime | Web `:3000`, admin `:3001/login`, API `:4000/health` returned 200 |
| CSS health/project doctor | Pass |
| Admin login responsive smoke | 1280×720 and 390×844 pass; zero horizontal overflow |
| Storefront route audit | 17/17 clean; zero detected UI problems/console errors |

## Remaining gates and known limitations

- Local Google sign-in stays hidden until loopback origins are registered in Google Cloud and
  `NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true`; production Google flow remains enabled.
- Local homepage currently has one hero slide and no configured video. Multi-slide video advance
  cannot be proven from that dataset.
- Owner must run real Windows Chrome acceptance: hero play, slide advance, native wheel, overlay
  unlock, and hard-refresh CSS/chunk check. Include RDP/software-rendering poster test.
- Firefox and WebKit matrix still required.
- Real bKash/Nagad/SSLCommerz callback, Google sign-in, OTP delivery, and Steadfast booking require
  valid staging/production credentials and must not be simulated as success.
- Authenticated admin page/mutation visual matrix requires an owner login session; local login page,
  routing/build, CSS, contrast, table, token, and runtime health gates passed.
- Gitleaks is configured in CI but local binary/Docker was unavailable during this pass.
- This local verification report alone does not assert production status. Production is verified
  only when pushed commit SHA, CI, Deploy VPS workflow, live HTTP checks, build ID, and PM2 state all
  match.
