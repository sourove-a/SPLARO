---
name: splaro-platform
description: >-
  Full SPLARO-BRAND monorepo context — luxury fashion eCommerce for Bangladesh.
  Covers apps/web storefront, apps/admin dashboard, apps/api NestJS backend,
  orders, courier Steadfast, payments bKash, Telegram bot, AI agent, Prisma DB.
  Use for ANY task on this project: SPLARO, splaro, admin panel, orders, courier,
  Banglish requests, agent setup, integrations, dev:stack, or when user speaks
  Bangla/Banglish about their web application.
---

# SPLARO Platform Skill

Read this skill **before** answering or editing anything in SPLARO-BRAND.

## Quick identity

| Item | Value |
|------|-------|
| Brand | SPLARO — luxury women's fashion, Bangladesh |
| Domain | splaro.co |
| Monorepo | Turborepo + pnpm |
| Dev command | `pnpm dev:stack` (web :3000, admin :3001, api :4000) |
| DB | PostgreSQL + Prisma → `packages/database/prisma/schema.prisma` |
| Owner language | Bangla / Banglish / English — match user's style |

## Apps

| App | Path | Role |
|-----|------|------|
| web | `apps/web/` | Customer storefront (Next.js 15) |
| admin | `apps/admin/` | Admin dashboard (Next.js 15) |
| api | `apps/api/` | NestJS REST API, prefix `/api/v1` |
| worker | `apps/worker/` | Background jobs (sheets, closing) |

## Before coding

1. Read existing files in the module — match conventions
2. API must run for admin/web data — never assume fake success UI
3. Run `pnpm check:web` / `pnpm check:admin` / `pnpm check:api` after changes
4. Minimal diff — don't refactor unrelated code

## Admin routing

- Catch-all: `apps/admin/src/app/dashboard/[...slug]/page.tsx`
- Nav map: `apps/admin/src/lib/navigation/admin-nav.ts`
- **Hidden menus:** `NAV_HIDDEN_HREFS` in `admin-nav.ts` — routes exist but sidebar hides non-daily items (WMS, CEO dashboard, duplicate finance tabs, etc.). Do not delete modules; add to hide set if needed.
- Module registry: `apps/admin/src/lib/modules/registry.ts`

Key routes: `/dashboard/orders`, `/dashboard/products`, `/dashboard/partner-hub`, `/dashboard/ai-agent`, `/dashboard/telegram-bot`, `/dashboard/all-integrations`

### Feature flags (enforced — not docs-only)

`FEATURE_*` in root `.env` → `packages/config/src/feature-flags.ts` → `GET /api/v1/features`.
- API: `@RequireFeature('saas'|'vendor'|'loyalty'|'ai'|'googleSheets'|…)` + `FeatureFlagGuard`
- Admin: nav hide + `ModuleWorkspace` blocks panel when flag off; AI FAB gated by `FEATURE_AI_ENABLED`
- Defaults for single-store launch: **saas/vendor/loyalty = false**. Do not re-enable in UI without shipping the product.

## Admin feedback (toasts)

Use `apps/admin/src/lib/admin/feedback.ts` (wraps `react-hot-toast`):
- `toastApiSaved` — green, only after `verifySettingsApplied` in `settings-save.ts`
- `toastOk` — green: verified API success **or** honest non-save action (export/copy/draft) — never word as “saved” without server
- `toastFail` — red: API offline, `!res.ok`, network error
- `toastWarn` — amber: partial/dev/backend missing
- `toastInfo` — neutral local feedback
- `notifyBackendMissing` — amber: action unavailable, nothing persisted
- `toastCourierResult` — green only for real Steadfast consignment (not `DEV-*`)

`notifySaved` — **removed entirely**. Do not reintroduce.

`apiFetch` (`apps/admin/src/lib/api/client.ts`) throws on `!res.ok` — place success toasts only after resolve or mutation `onSuccess`.

Never show green “saved” when API didn't really persist (settings, courier, finance, integrations).

## Web storefront (`apps/web/`)

Luxury customer site — Next.js 15, Framer Motion, Zustand, BDT.

### Rules (mandatory)

1. **BFF only from browser** — client components fetch `/api/*` (same-origin), not `:4000`.
2. **Server-side order math** — delivery fee, coupon, digital discount recomputed in `app/api/orders/route.ts` + API; never trust checkout POST body totals alone.
3. **Auth via BFF** — `app/api/auth/*` (login, signup, OTP, Google, me, logout).
4. **Payments** — `app/api/payments/{bkash,nagad,sslcommerz}/*`; mobile flow at `/checkout/mobile-payment`.
5. **Design tokens** — ivory `#FAF8F5`, luxury black `#111111`, gold `#C8A97E`; utilities in `globals.css` (`.btn-luxury`, `.glass`, `.container-luxury`). See `AI_GUIDE.md` for full design system.
6. **Chunk/CSS recovery** — `ChunkReloadGuard` + `pnpm dev:reset` if vendor-chunks break; owner only hard-refreshes browser.

### PDP — no double UI (owner lock)

Verified on `/products/[slug]` (`product-page-client.tsx` + `ProductPurchaseSticky.tsx`). **Do not reintroduce stacked controls.**

| Rule | Detail |
|------|--------|
| Gallery nav | **No gallery thumbnail strip** when colour swatches already show images — use arrows + stage click only. Never stack progress (“1 / N”) + thumbs either. Keep `aria-live` / `sr-only` for index. |
| No click jump | PDP `.pp-pressable:active` must **not** scale. MotionPressable + GlobalPressFeedback = opacity only (`--press-scale: 1`). Never re-stack CSS scale + Motion whileTap + GlobalPress. |
| Purchase CTAs | Inline Add to bag / Buy Now **or** floating sticky bar — **never both visible**. Sticky only when `.pp-info__ctas` is off-screen. **Hide sticky as soon as `footer.site-footer` enters the viewport** — never cover the footer. |
| Colour vs gallery | Colour thumbs swap the **main gallery lead image**; each colour needs its own `variant.image` from admin. |
| Desktop sticky panel | `.pp-info__purchase-panel` may be CSS-sticky in-column; floating `.pp-desktop-sticky-bar` only when inline CTAs leave the viewport **and** footer is not in view. |
| Size Guide modal | PDP open as **modal** (`SizeGuideModal`) — never navigate away. Category-aware chart (women / men / kids / footwear). Must call `acquireScrollLock` / `releaseScrollLock` so Lenis stops + mobile dock hides. |
| PDP chrome | No trust strip (“Easy returns / COD / Usually 2–4 days”). No wishlist/favorite heart on PDP when Add to bag exists. |
| Size pills | Liquid white glass + **black text always** (selected = ring, never black fill). No hover `translateY` (miss-click). |

### Scroll + click (owner lock — do not regress)

Verified 2026-07-14 on PDP. Dead clicks / scroll ghosts come from Lenis inertia + overlays.

| Rule | Detail |
|------|--------|
| Overlay scroll lock | Shared `uiStore.scrollLockCount` via `acquireScrollLock` / `releaseScrollLock`. `SmoothScroll` `LenisScrollLock` stops Lenis when count > 0 **or** cart/search/menu. Do not only set `body.overflow=hidden` — Lenis keeps moving. |
| Click freezes inertia | `LenisPointerGuard` on `pointerdown` **only for interactive targets** (button/link/size/CTA) → `lenis.scrollTo(animatedScroll, { immediate: true })` while `lenis.isScrolling`. Never freeze bare page touch-pan. |
| Mobile dock | `MobileBottomNav` hides when `scrollLockCount > 0` (same as cart/search/menu). |
| Pointer recovery | Keep `unlockLenisPointer()` + `windows-native-scroll-script` — never reintroduce `pointer-events: none` on body during scroll. |
| PDP press | Opacity-only press (`--press-scale: 1`). Size buttons: no scale / no hover lift. |
| No native scrollIntoView with Lenis | PDP validation scroll must use `lenis.scrollTo(el, …)` — native `scrollIntoView` desyncs Lenis and causes miss-clicks. |

If owner says “click lagge na / scroll click bug” → check LenisPointerGuard + scrollLockCount first.

If owner says “double” / “footer er niche buy” on PDP → check these rules before redesigning.

### Key paths

| Concern | Path |
|---------|------|
| Pages | `apps/web/src/app/` |
| BFF API routes | `apps/web/src/app/api/` |
| Checkout + districts | `apps/web/src/lib/checkout/` |
| Catalog SSR | `apps/web/src/lib/catalog/` |
| Cart store | `apps/web/src/store/cartStore.ts` |
| Layout chrome | `components/layout/StorefrontChrome.tsx`, `Header/`, `Footer/` |
| Footer earth | `components/footer/EarthBackdrop.tsx` + `styles/earth-backdrop.css` — **frozen, do not edit** |

### Footer — frozen (owner lock)

**Do not modify the storefront footer** unless the owner explicitly asks in that turn.

Locked scope (no drive-by edits, no “improvements”, no swaps):
- `apps/web/src/components/layout/Footer/`
- `apps/web/src/components/footer/EarthBackdrop.tsx`
- `apps/web/src/styles/earth-backdrop.css`
- Footer-related rules in `globals.css` (`.site-footer*`, `.footer-lux*`)

Current implementation: video `EarthBackdrop` in `Footer.tsx`. Do **not** swap to `LazyFooterEarthGlobe`, change earth overlays, glass blur, `ScrollReveal`, or sticky-bar fixes “for footer” without explicit owner request.

Auth pages may use `EarthBackdrop` via `AuthEarthBackground.tsx` — only touch if owner asks about auth, not footer.

### Auth / Google sign-in — locked (owner verified)

**Do not change auth login/signup UI or Google sign-in wiring** unless the owner explicitly asks.

Working setup (do not break):
- Button UI: `apps/web/src/components/auth/AuthGoogleGlassFooter.tsx` — used on login + signup via `AuthExperience.tsx`
- Provider: `AuthGoogleProvider.tsx` (`GoogleOAuthProvider`), bridge: `auth-google-bridge.tsx`
- Feature flags: `apps/web/src/app/api/auth/config/route.ts` — `googleSignInEnabled` depends **only** on `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (web env). Never re-add a server-side `GOOGLE_OAUTH_CLIENT_ID` requirement here — the web Next process does not read root `.env`, so that check made the button flash then vanish after config load.
- Env: `apps/web/.env.local` → `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; root `.env` → `GOOGLE_OAUTH_CLIENT_ID` (+ secret) for the Nest API credential verify.
- Credential verify happens in Nest API via BFF `POST /api/auth/google`.
- Rule: the Google button must **never unmount after initial render** when a client id is baked into the bundle.
| Currency | `lib/utils/currency.ts` → `formatBDT()` |
| Delivery zones | `packages/config/src/delivery-zones.ts` |

### Main customer routes

`/shop` · `/collections/[slug]` · `/products/[slug]` · `/cart` · `/checkout` · `/account` · `/track-order` · `/order-confirmation/[id]`

After web changes: `pnpm check:web`. Cross-app or CSS issues: `pnpm dev:reset`.

## Courier + order status honesty (do not regress)

Verified 2026-07-15. Fake BOOKED / double book / status race are launch blockers.

| Rule | Detail |
|------|--------|
| No fake BOOKED | Simulated / `DEV-*` / `COURIER_DEV_STUB` must **not** persist courier row as live BOOKED (`courier.service.ts`) |
| Missing Steadfast keys | Honest fail — never invent consignment (`steadfast.service.ts` `hasRealCredentials`) |
| Redis lock | Contended NX → return `null`; **never** fall through to local lock when Redis is ready (`redis-lock.util.ts`) — dual Steadfast bookings |
| Status mutations | Admin UI **and** AI agent use `OrderStatusService.applyStatusChange` only — transitions + stock restore + history + events; race-safe `updateMany` |
| Retry messaging | Say “retry queued” only when `redisQueuesEnabled()`; else tell ops to re-book manually |
| Bulk courier count | Count `success && !simulated` only |
| Production | `COURIER_DEV_STUB=false`, `REDIS_ENABLED=true` — `scripts/validate-production-env.mjs` blocks otherwise |

Code: `apps/api/src/modules/courier/`, `orders/order-status.service.ts`, `common/order-status.util.ts`, UI toasts via `toastCourierResult`.

## Admin invoice Print / PDF (do not regress)

| Rule | Detail |
|------|--------|
| Popup gesture | `window.open` **before any await** in the click path — async fetch first → popup blocker |
| Never `noopener` in features | `window.open(url, '_blank', 'noopener')` returns `null` in Chrome even when tab opens — breaks Print/View |
| URL uses invoice # | Prefer `SPL-1002` in `/api/orders/:ref/invoice*` — not Prisma cuid `cmrkz…`. API accepts both (`ownedOrderId`) |
| Brand footer | Never `www.localhost` / `support@localhost` — `packages/config/src/splaro-invoice-brand.ts` sanitizes local SITE_URL → `splaro.co` |
| Proxy HTML errors | Invoice HTML routes return HTML error pages, not raw JSON (`proxy-invoice.ts`) |
| Actions | `apps/admin/src/lib/admin/admin-actions.ts` + `OrderPreviewCard` / `InvoiceActionsBar` |

## Half-built admin modules

- `NAV_HIDDEN_HREFS` + feature flags hide non-daily routes.
- `ModuleWorkspace` **blocks panel body** when maturity is `beta` or `prototype` (banner only) — do not re-enable incomplete WMS/SaaS/loyalty shells for launch.
- Live modules stay usable via bookmark even if sidebar-hidden.

## AI agent (in-app)

- SPLARO Command: `apps/api/src/modules/agent/`
- System prompt: `prompts/system.prompt.ts` + `platform-knowledge.prompt.ts` (always appended)
- Admin UI: floating chat FAB (`AgentShell`) + `/dashboard/ai-agent` (setup only — model, keys, Telegram)
- Tools: `get_partner_finance`, `get_order_detail`, `update_order_status`, `book_order_courier`, `fix_missing_seo_meta`, etc.
- Tools must be called for live data — never invent order counts
- After prompt edits: `pnpm dev:api` or `pnpm dev:reset`

## User intent (Banglish)

| User says | Meaning / action |
|-----------|------------------|
| ordar / order | Order module or API |
| courier book | POST courier endpoint |
| connection nai | Integration not configured — check env + get_integration_status |
| problem ki | Full health diagnostic |
| thik koro | Fix with real diagnosis, not guess |
| agent bujhe na | Improve prompt/tools — check platform-knowledge.prompt.ts |

## Windows dev (parity — do not regress)

- `pnpm dev:stack` / `dev:reset` / `doctor` — cross-platform `.mjs` (no bash required)
- `pnpm db:*` — `scripts/db-run.mjs` loads `.env` on Windows
- `pnpm infra:redis` — Docker on Windows (not Homebrew)
- Ports: `scripts/port-utils.mjs` — Windows `taskkill /PID … /T /F` (process **tree**); never drop `/T`
- Shutdown: `killProcessTree` in `spawn-utils.mjs` for `dev-stack` / `dev-reset` / `api-dev` — `child.kill` alone leaves zombie Next/API on Windows
- Orphan API match: normalize `\` → `/` before path checks (`api-port.mjs`)
- Loopback: Redis + API defaults `127.0.0.1` not `localhost` (IPv6 stall)
- Linux/VPS bash deploy scripts stay on the server — Windows local uses `pnpm` / turbo only (do not run server `bash` build scripts on Windows)
- Scroll hang: `apps/web/src/lib/hydration/windows-native-scroll-script.ts`
- Hard refresh: `Ctrl+Shift+R`

## Additional reference

- Full platform map: [reference.md](reference.md)
- Existing guide: `AI_GUIDE.md` at repo root
- In-app agent knowledge: `apps/api/src/modules/agent/prompts/platform-knowledge.prompt.ts`

## Answer rules for this project

1. Match Bangla/Banglish/English style of the user
2. Investigate with tools/code — don't guess
3. Give exact env vars, file paths, commands
4. Honest UI: red for errors, green only for verified success
5. Telegram = primary mobile ops channel for the owner
