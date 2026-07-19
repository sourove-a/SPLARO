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
| Production | Contabo VPS `147.93.171.45` → https://splaro.co |
| Monorepo | Turborepo + pnpm |
| Dev command | `pnpm dev:stack` (web :3000, admin :3001, api :4000) |
| DB | PostgreSQL + Prisma → `packages/database/prisma/schema.prisma` |
| Owner language | Bangla / Banglish / English — match user's style |

## Production VPS (never ask owner for root password)

**Do not ask the owner for the VPS password.** Mac→VPS uses SSH key. Never write root passwords into this skill, git, or chat replies.

| Item | Value |
|------|-------|
| Host / IP | `147.93.171.45` (also `splaro.co` A record) |
| SSH user | `root` |
| Mac private key | `~/.ssh/splaro_vps` |
| SSH alias | Prefer `ssh -i ~/.ssh/splaro_vps -o BatchMode=yes root@147.93.171.45` |
| App dir | `/var/www/splaro` |
| Deploy entry | `/opt/splaro/deploy.sh` (thin wrapper → repo `infrastructure/vps/deploy.sh`) |
| PM2 apps | `splaro-web`, `splaro-admin`, `splaro-api`, `splaro-worker`, `splaro-print` |
| GitHub Actions | **Deploy VPS** after CI green on `main` |
| Actions secrets | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (+ aliases `VPS_SSH_*`) |
| Repo deploy key | GitHub → Deploy keys → `splaro-vps-read` (read-only; VPS git pull) |
| Re-sync secrets | `pnpm setup:github-deploy:sync` (uses Mac key; uploads Actions secrets + deploy key) |
| Hostinger | Legacy only — not primary. Do not treat Hostinger workflows as production. |

```bash
# Connect (no password prompt if key works)
ssh -i ~/.ssh/splaro_vps -o BatchMode=yes root@147.93.171.45

# Live health
curl -sf https://splaro.co/api/v1/health
curl -sf https://admin.splaro.co/api/ping

# Manual deploy on VPS (GitHub Actions normally does this)
bash /opt/splaro/deploy.sh
```

If Mac key SSH fails: run `infrastructure/vps/hpanel-bootstrap-github.sh` once on VPS console, then `pnpm setup:github-deploy:sync` — still never store passwords in repo docs.

### Reliable deploy checklist (do this every time — verified 2026-07-15)

The 8GB VPS build is flaky under load. Skipping any step here has caused a live 500 more than once.

1. **Commit only your own files.** `git status` first — never `git add -A`. Other agents (Claude, Cursor) may have unrelated uncommitted WIP in the same working tree; only stage files you actually changed.
2. **Push, then watch both workflows to completion — don't fire-and-forget:**
   ```bash
   git push origin main
   gh run list --limit 3                       # find the new "CI" run id
   gh run watch <ci-run-id> --exit-status       # wait for CI green
   gh run list --limit 3                       # find the "Deploy VPS" run id it triggered
   gh run watch <deploy-run-id> --exit-status   # wait for deploy to finish
   ```
3. **If "Deploy VPS" fails, do not just re-push and hope.** Read the actual log first:
   ```bash
   gh run view <deploy-run-id> --log-failed | tail -80
   ```
   Known recurring failure: `ENOENT .../.next/server/pages-manifest.json` or `Cannot find module .../middleware-manifest.json` — a partially-written `.next` from an earlier interrupted/OOM-killed build corrupts the next build's cache. `deploy.sh` only clears `.next/cache`, not the full `.next` dir, so this doesn't self-heal.
   **Fix:** SSH in and force a clean rebuild:
   ```bash
   ssh -i ~/.ssh/splaro_vps root@147.93.171.45 \
     "cd /var/www/splaro && rm -rf apps/web/.next apps/admin/.next && bash infrastructure/vps/deploy.sh"
   ```
4. **Verify live after every deploy — GitHub Actions "success" is not enough**, PM2 can be online while serving a stale/broken build:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://splaro.co
   curl -s -o /dev/null -w "%{http_code}\n" https://splaro.co/shop
   curl -s https://splaro.co/api/build-id          # confirm it changed vs before deploy
   ssh -i ~/.ssh/splaro_vps root@147.93.171.45 "pm2 list | grep splaro-web"   # "online" + fresh uptime
   ```
   If homepage returns 500 or `build-id` didn't change, treat it as **not deployed** — go back to step 3, don't tell the owner it shipped.
5. **One agent deploys at a time.** If Claude and Cursor both push/deploy against this repo close together, the VPS build queue and PM2 restarts race and produce exactly the corrupted-`.next` failure in step 3. Check `git log --oneline -3` on the VPS before you deploy — if HEAD was touched in the last few minutes by a run you didn't trigger, wait.
6. **Never re-enable Lenis smooth scroll on Windows.** `shouldUseNativeScroll()` in `apps/web/src/lib/earth/globe-performance.ts` force-returns `true` for any Windows UA — this is intentional, not a TODO. Lenis's JS-driven wheel handling hangs/dead-locks over RDP (input batching breaks its RAF timing). Tried removing this bypass on 2026-07-16, shipped, owner reported scroll broken within minutes, reverted immediately. Don't retry without owner sign-off and real Windows/RDP testing before shipping.

### Auto-deploy reliability contract

- `main` push runs `CI`; only successful CI triggers `Deploy VPS` via `workflow_run`.
- Deploy workflow passes exact `workflow_run.head_sha` as `SPLARO_DEPLOY_SHA`; VPS must deploy that CI-approved commit, never an unverified newer `origin/main` tip.
- Deploy concurrency queues runs with `cancel-in-progress: false`; never kill active VPS build midway.
- VPS creates/verifies 4GB swap before `pnpm install`, not only before Next build. Install uses child concurrency `1` and bounded network concurrency.
- Required Actions secrets: `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY` (aliases supported). VPS requires `/opt/splaro/deploy.sh` and read-only `/root/.ssh/github_deploy`.
- One-time/recovery sync: `pnpm setup:github-deploy:sync`. This uploads Actions SSH secrets and registers `splaro-vps-read` deploy key.
- Never push/deploy without owner permission. After push, watch CI → Deploy VPS → live smoke; success status alone is not enough.

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

### Ship order (owner lock — 2026-07-15)

**Fix all code first → ask owner → only then ONE push/deploy. Never mid-fix deploy.**

1. Diagnose + edit locally until the request is complete
2. `tsc` / lint on touched apps
3. **STOP and ask owner** (“push/deploy korbo?”) — wait for explicit yes (`push koro` / `deploy koro` / `ship koro`)
4. Only after yes: `git push` (CI → Deploy VPS) or one careful VPS rebuild
5. Do **not** push/deploy after each small tweak; do **not** stop PM2 / redeploy while still fixing
6. If owner says “age deploy korbe na / permission nibi” — **never ship without asking**, even when the batch looks complete
7. Local verify (`pnpm check:web`, curl localhost) is fine without asking; **production push/VPS = permission required**

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

**Default 2026-07-16: native OS scroll everywhere** (`shouldUseNativeScroll()` always `true`). Lenis chunk stays lazy (`LenisSmoothScrollInner`) but is not mounted. Instagram/Windows wheel must work without virtual scroll.

#### Dual-scrollport wheel bug (fixed — never reintroduce)

| Bad | Why | Good |
|-----|-----|------|
| `body { overflow-x: hidden }` | CSS computes `overflow-y` → `auto` when the other axis is not `visible` | `overflow-x: clip` + `overflow-y: visible` on `body` |
| `html` **and** `body` both `overflow-y: auto` | Dual scrollports — Chromium/Windows mouse wheel + trackpad **stop scrolling** (events fire, `scrollY` stays 0) | **Only `<html>`** is the vertical scrollport |
| `html:not(.lenis) body { overflow-y: auto !important }` | Same dual-port bug under native engine | `body { overflow-y: visible !important }` when native |

Files: `apps/web/src/app/globals.css` (body + `data-scroll-engine=native` rules). Diagnose: `getComputedStyle(body).overflow` must be `clip visible` / `visible`, not `hidden auto`.

#### Overlay lock (Search / Cart / SizeGuide)

| Rule | Detail |
|------|--------|
| Attribute | `OverlayScrollLockAttr` sets `html[data-scroll-lock=overlay]` when menu/search/cart/`scrollLockCount` |
| Native CSS | `html[data-scroll-engine=native][data-scroll-lock=overlay] { overflow: hidden }` — **Lenis-only** lock selectors are not enough now |
| Unlock | `unlockLenisPointer()` must **not** clear overflow while overlay locked (`GlobalPointerSafety` runs on every `pointerdown`) |
| Horizontal rails | `GlobalHorizontalWheelScroll` only for `[data-h-scroll=true]`; skip when overlay locked; never `preventDefault` on page vertical wheel |

#### Other scroll/click rules

| Rule | Detail |
|------|--------|
| Lenis (legacy) | If Lenis remounted: `LenisScrollLock` + `LenisPointerGuard` (freeze inertia only on interactive targets) |
| Mobile dock | `MobileBottomNav` hides when `scrollLockCount > 0` |
| Boot script | `windows-native-scroll-script.ts` — clear stale Lenis classes; never set `overflow:hidden` on html/body at boot |
| PDP press | Opacity-only (`--press-scale: 1`) |
| ScrollTo | Prefer native `window`/`scrollingElement` while engine=`native`; Lenis `scrollTo` only if Lenis context exists |

If owner says **“wheel scroll kore na / trackpad kaj kore na”** → check dual scrollport CSS first (`body` overflow-x:hidden), then overlay lock, then Lenis remount.

If owner says **“scroll click jump / miss click”** → keep **native scroll** + opacity-only press (`--press-scale: 1`); never `scrollIntoView({ behavior:'smooth' })` on PDP while clicking; never Lenis + native `scrollIntoView` mix.

If owner says “click lagge na” → pointer unlock + scrollLockCount.

### Speed / perf (owner lock — 2026-07-16)

| Rule | Detail |
|------|--------|
| Footer earth video | **Removed from live `Footer.tsx`** — no `<EarthBackdrop />` / no `/videos/footer-globe.mp4` on critical path. Footer markup/CSS chrome still owner-locked; do not re-add video without explicit ask |
| Auth earth | `AuthEarthBackground` no-op; login/signup light glow only — Google glass **untouched** |
| Home story | WhySplaro / WebGL earth off by default (`homepage.ourStory: false`) |
| Homepage catalog | `getStorefrontCatalogPreview()` — SSR **8 products**, not full catalog |
| Scroll engine | Native everywhere — do not re-enable Lenis on Mac “for luxury” without measuring Windows wheel |
| First paint | Prefer local WebP heroes; skip blocking banner API on home first byte when defaults exist |
| Session/cart | Defer hydrators past first paint (`requestIdleCallback`) |

### Key paths

| Concern | Path |
|---------|------|
| Pages | `apps/web/src/app/` |
| BFF API routes | `apps/web/src/app/api/` |
| Checkout + districts | `apps/web/src/lib/checkout/` |
| Catalog SSR | `apps/web/src/lib/catalog/` (`getStorefrontCatalogPreview` for home) |
| Cart store | `apps/web/src/store/cartStore.ts` |
| Layout chrome | `components/layout/StorefrontChrome.tsx`, `Header/`, `Footer/` |
| Scroll engine | `SmoothScroll.tsx`, `globe-performance.ts` `shouldUseNativeScroll`, `globals.css` native rules |
| Footer earth (unused) | `components/footer/EarthBackdrop.tsx` + `styles/earth-backdrop.css` — keep frozen; **not mounted** |
| Currency | `lib/utils/currency.ts` → `formatBDT()` |
| Delivery zones | `packages/config/src/delivery-zones.ts` |

### Footer — frozen (owner lock)

**Do not modify the storefront footer** unless the owner explicitly asks in that turn.

Locked scope (no drive-by edits, no “improvements”, no swaps):
- `apps/web/src/components/layout/Footer/`
- `apps/web/src/components/footer/EarthBackdrop.tsx`
- `apps/web/src/styles/earth-backdrop.css`
- Footer-related rules in `globals.css` (`.site-footer*`, `.footer-lux*`)

**Current (2026-07-16):** glass footer panel **without** earth video (`EarthBackdrop` unmounted for speed). Do **not** re-mount video / WebGL globe / swap `LazyFooterEarthGlobe` without explicit owner request.

Auth: do not re-add earth video to login without owner ask. Google sign-in stays locked separately.

### Performance / CDN heroes (2026-07-15)

- Defaults: `/images/hero/{key}-1600.webp` + `-828.webp` — premium same-origin static (not Unsplash 1920).
- Resolver: `apps/web/src/lib/assets/hero-cdn.ts`; `HeroSlider` `<picture>`.
- Logos: `splaro-logo-*-premium.webp` (~10KB).
- Dead: never route to `cdn.splaro.co` until DNS exists (`resolve-asset-url.ts`).

### Auth / Google sign-in — locked (owner verified)

**Do not change auth login/signup UI or Google sign-in wiring** unless the owner explicitly asks.

Working setup (do not break):
- Button UI: `apps/web/src/components/auth/AuthGoogleGlassFooter.tsx` — used on login + signup via `AuthExperience.tsx`
- Provider: `AuthGoogleProvider.tsx` (`GoogleOAuthProvider`), bridge: `auth-google-bridge.tsx`
- Feature flags: `apps/web/src/app/api/auth/config/route.ts` returns public `googleClientId` + `googleSignInEnabled`. Prefer `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; fall back to `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_CLIENT_ID` from the web process env so VPS doesn’t flash-then-hide Google.
- Env: root `.env` on VPS must set `GOOGLE_OAUTH_CLIENT_ID` **and** `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (same public client id). Nest verifies ID tokens; web bakes NEXT_PUBLIC at build — rebuild web after changing NEXT_PUBLIC.
- Credential verify: Nest `GoogleIdTokenService` via BFF `POST /api/auth/google`.
- Rule: Google button must **never unmount** while a client id is available (baked or via `/api/auth/config`).

**One Google mark only (owner lock — 2026-07-15):** Visible mark = SVG in `AuthGoogleGlassFooter` (`GoogleMarkIcon`). Hidden GIS trigger = `.auth-google-glass__hidden` → **off-screen**, `opacity: 0`, `pointer-events: none` (still ≥44×44 so GIS mounts; `click()` works). Never stack GIS icon under the glass at low opacity — that was the **double-G** bug on `/login`. No `drop-shadow` / pseudo / background logo on `.auth-google-glass__mark`.

### Optional customer email verification

Password signup stays instant and optional: account creates with `User.emailVerified = false`; verification never blocks signup, login, checkout, COD, or account access. Google sign-in keeps Google token verified status.

| Concern | Contract |
|---------|----------|
| Account UI | Profile shows amber `Unverified` or green `Verified`; verified email stays read-only/locked |
| Send route | Web BFF `POST /api/auth/email-verification/send` → API `POST /storefront/auth/email-verification/send` |
| Verify route | Web BFF `POST /api/auth/email-verification/verify` → API `POST /storefront/auth/email-verification/verify` |
| Code security | 6 digits, SHA-256 digest only, 10-minute TTL, 60-second resend cooldown, max 5 wrong attempts |
| Delivery honesty | `EmailService.sendForStore(... transactional: true)`; success only after SMTP accepts recipient |
| Email design | `apps/api/src/modules/email/email-verification.template.ts` — SPLARO ivory/black/gold responsive template |
| Telegram | `notifyCustomers` sends signup, code-sent, and verified events; SMTP infrastructure failure sends red admin error |
| Secret rule | Verification code/OTP never logged or sent to Telegram/admin; only customer email receives it |
| Redis | Production requires Redis; memory fallback development-only |

Key implementation: `StorefrontAuthService.sendEmailVerification()` and `verifyEmail()`. Session payload must include real `emailVerified`; never show universal/fake verified badge. Verified email changes require separate secure re-verification flow—do not unlock current field or accept direct email mutation.

### Customer avatar / Google photo

- Google signup uses verified ID-token `picture` and persists it to `User.avatar`.
- `apps/web/next.config.mjs` must keep `**.googleusercontent.com` in image remote patterns and CSP `img-src`.
- Account avatar upload remains available for every customer; upload saves through BFF `/api/account/profile` → API `/storefront/auth/profile`.
- Custom avatar wins: later Google login must not overwrite uploaded data/custom URL. Google-hosted avatar may refresh from newest Google picture.
- Avatar upload control styles belong in `account.css`, not route-specific `shop.css`.

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
| vps / deploy / slow site | Production VPS section above — SSH via `~/.ssh/splaro_vps`, never ask for root password |

## Windows dev (parity — do not regress)

- `pnpm dev:stack` / `dev:reset` / `doctor` — cross-platform `.mjs` (no bash required)
- `pnpm db:*` — `scripts/db-run.mjs` loads `.env` on Windows (`db:studio` / `db:reset` too — no `cd &&`)
- `pnpm infra:redis` — Docker on Windows only (`docker compose`, then `docker-compose` fallback; not Homebrew). Prefer `redis://127.0.0.1:6379`
- Ports: `scripts/port-utils.mjs` — Windows **always** `taskkill /PID … /T /F` (soft kill without `/F` leaves Next zombies). Never drop `/T` or `/F`
- Process lookup: bulk CIM table + **per-PID** `getCommandLineForPid` fallback (folder name need not be `SPLARO-BRAND`)
- `stop-next-dev-for-build.mjs` — uses per-PID command; if still unknown on :3000/:3001, reclaim (avoids corrupt `.next` on Windows)
- Shutdown: `killProcessTree` in `spawn-utils.mjs` for `dev-stack` / `dev-reset` / `api-dev` — `child.kill` alone leaves zombie Next/API on Windows
- Orphan API match: normalize `\` → `/` before path checks (`api-port.mjs`)
- Loopback: Redis + API defaults `127.0.0.1` not `localhost` (IPv6 stall)
- `.githooks/pre-push` — POSIX `sh` + `pwd` root resolve (Git for Windows `sh.exe`)
- Linux/VPS bash deploy scripts stay on the server — Windows local uses `pnpm` / turbo only (do not run server `bash` build scripts on Windows)
- Scroll hang: `apps/web/src/lib/hydration/windows-native-scroll-script.ts`
- Hard refresh: `Ctrl+Shift+R`
- **Never `npm install` at repo root** — use `pnpm install`. Guard: `scripts/only-pnpm.mjs` (`preinstall`). Swiper lives in `apps/web` (`pnpm --dir apps/web add swiper` if needed).
- **Scroll (2026-07-17):** Mac / Linux desktop → Lenis again (lerp ~0.075) with freeze fixes: no `data-lenis-prevent` on product rails, `autoResize: true`, aggressive height sync. **Windows / mobile / lite** → always native. Never Lenis on Windows.


## Department mega menus (Men / Women) — locked (2026-07-17)

**Rule:** Men mega = Men categories only; Women mega = Women only; Shop = all products (`/shop`, no dept mega).
**Live source:** `GET /storefront/nav` → `NavBuilderService` (Category tree children with products). Never skip merging this in web settings.
**Bugs fixed:** (1) Accessories FALLBACK mega short-circuited Men/Women restore; (2) FALLBACK used `/c/men-*` slugs that dumped full catalog; (3) PLP no longer falls through to All products for unknown slugs.
**Key files:** `apps/web/src/lib/storefront/settings.ts`, `apps/web/src/lib/catalog/server.ts`, `apps/api/.../nav-builder.service.ts`, `packages/config/src/category-tree-defaults.ts`.

## Header search — inline expand (2026-07-17)

**Mobile:** Search fills the header row (logo/menu hide). Premium glass pill + close.
**Desktop:** Logo + nav stay; field expands only in the gap after Accessories → search icon (account/cart remain). Over-hero uses luminous glass field (no full white takeover).
**No:** full-screen modal, trending chips, quick links, category grid.
**Suggest:** ≥2 chars → slim dropdown (Search for… + products). Escape / X / tap outside closes.
**Key files:** `Header.tsx`, `SearchModal.tsx`, `globals.css` (`.site-header-search*`).

### White brick bug — locked (2026-07-17)

**Symptom:** Over-hero search pill shows a solid white rectangle inside the glass field (icon ok, X ok).
**Cause:** Global OS-dark form lock in `globals.css` forced `background-color: #ffffff !important` + autofill `box-shadow: 0 0 0 1000px #ffffff inset` on every input except auth/newsletter — including `.site-header-search__input`.
**Fix (do not regress):**
1. Always exclude `.site-header-search__input` from the dark-mode form lock + global autofill white-inset selectors (same list as `.auth-field__input` / `.ed-newsletter__input`).
2. Search input must keep `background: transparent !important` — the **pill** (`.site-header-search__field`) owns the fill/glass, never the `<input>`.
3. Search autofill uses transparent inset + matching `-webkit-text-fill-color` (dark on solid header, white on over-hero).
4. Prefer `type="text"` + `inputMode="search"` + `role="searchbox"` (avoid WebKit `type=search` chrome).
**Never:** re-apply global `#ffffff` form lock to header search; never put opaque white bg on `.site-header-search__input`.

## Homepage dept rails + header nav (2026-07-17)

**Order:** Men → Women → Kids → Footwear → Accessories (homepage rails + department links in header).
**Hide sync:** Admin header nav `hidden: true` also removes matching homepage department rail (SSR + live client filter). Catalog channel unpublish still hides both.
**Smooth:** Next/prev on dept rails uses `smoothScrollByX` (`motion` animate on `scrollLeft`) — avoids Windows native smooth-scroll jump. Header nav items use `AnimatePresence` + layout when shown/hidden.
**Mobile peek:** ≤767px — no arrow buttons; hand swipe + `scroll-snap` center; side tiles half-peek (~14vw); active tile `scale(1)` / sides `0.9` via scroll-driven `is-active`. Desktop keeps arrows + multi-tile fill.
**Key files:** `homepage-department-rows.ts`, `HomeDepartmentRow.tsx`, `HomeCategoryTile.tsx`, `home.css`, `smooth-scroll-x.ts`, `Navigation.tsx`, `settings.ts` (`orderDepartmentNavLinks`), `GlassStorefront.tsx`.

## PDP micro-motion (2026-07-17)

**What:** Jump-free premium transitions on product page — CTAs, gallery progress, lightbox zoom, related rail.

**Why:** Reference-style soft easing. Zoom stays on existing `react-zoom-pan-pinch` in `ProductLightbox`. No scale-on-press (historical jump regressions).

**Tokens**
- Global aliases in `apps/web/src/app/globals.css`: `--ease-premium` → `--ease-smooth` (`cubic-bezier(0.4,0,0.2,1)`), `--dur-fast` / `--dur-base` → existing durations (values unchanged sitewide).
- PDP-scoped in `.pp-view` (`pdp.css`): `--pp-ease`, `--pp-dur-fast: 200ms`, `--pp-dur-base: 300ms`, `--pp-dur-slow: 340ms`.

**Related rail — Swiper coverflow (2026-07-17)**
- Wire: `product-related-section.tsx` → `PremiumSwiperCarousel` (`effect="coverflow"`, `speed={300}`, `spaceBetween={24}`).
- Breakpoints for related: 2 / 2 / 3 / 4 (never 1 full-width card on mobile). Default component breakpoints are 1 / 2 / 3 / 4.
- Switch to flat: pass `effect="slide"`.
- Jump-free: expo-out on `.swiper-wrapper`, no coverflow shadows, glass circular arrows (opacity press only), soft edge fades.
- **Do not** put Swiper on homepage dept rails / hero / brand deck / footer.
- Key files: `components/ui/PremiumSwiperCarousel/*`, `product-related-section.tsx`, `pdp.css` (`.pp-related*`).

**Do not**
- Enable Swiper Zoom on PDP gallery (not wired; would replace custom gallery).
**Files**
- `apps/web/src/styles/pages/pdp.css` — CTA hover/active (no transform), gallery progress fill width transition, nav `translateY(-50%)` preserved on press, desktop-only gallery image peek `scale(1.02)`, related `.pc-shell` media peek.
- `apps/web/src/app/products/[slug]/product-page-client.tsx` — gallery progress bar markup.
- `apps/web/src/components/product/ProductLightbox/ProductLightbox.tsx` — maxScale 3, soft zoom/reset (220ms), counter fill; pinch velocity disabled.
- `apps/web/src/app/products/[slug]/product-related-section.tsx` — Swiper coverflow via `PremiumSwiperCarousel`.

**Do not**
- Enable Swiper Zoom on PDP gallery (not wired; would replace custom gallery).
- Global duration overrides that change shop/header feel.
- Scale transforms on CTA `:active` / size pills.
- Put Swiper on homepage dept rails / hero / brand deck / footer.

**Verified:** `pnpm check:web` clean (pre-existing lint warnings only). Playwright desktop 1440 + mobile 390 on `/products/premium-cotton-polo` — progress fill grows on next, `--pp-ease` resolved, `/shop` loads. No new runtime pageerrors from these changes (pre-existing hydration tabindex / view-transition noise remains).

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
