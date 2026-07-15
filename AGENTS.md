# SPLARO Agent Instructions

Cursor agents: read this first, then apply skill `.cursor/skills/splaro-platform/SKILL.md` and `AI_GUIDE.md` for design/module depth.

---

## Agent workflow (every task)

### Before editing
1. Read existing files in the target module — match naming, imports, patterns.
2. Apply `splaro-platform` skill for routes, env vars, and honesty rules.
3. Confirm scope: one module per turn when possible; minimal diff only.

### While editing
- **Never fake success** — green toast / “saved” only after verified API `res.ok`.
- **Never guess** — use grep/read/terminal; cite real file paths and env vars.
- **No drive-by refactors** — don’t touch unrelated files or “clean up” without ask.
- **No commits/PRs** unless owner explicitly asks.

### After editing (agent does this — not the owner)
| Changed area | Agent must run |
|--------------|----------------|
| `apps/web/` | `pnpm check:web` + verify `:3000` |
| `apps/admin/` | `pnpm check:admin` + verify `:3001/login` |
| `apps/api/` | `pnpm check:api` or `pnpm --filter @splaro/api test:e2e` + verify `:4000/health` |
| CSS / Next config / `.next` issues | `pnpm dev:reset` (background) — **do not ask owner to restart** |
| Any cross-app change | `pnpm dev:reset` then curl all three ports |

End every implementation turn with stack live or clearly report what failed.

---

## Dev stack

| Port | App | URL |
|------|-----|-----|
| 3000 | Web storefront | http://localhost:3000 |
| 3001 | Admin dashboard | http://localhost:3001 |
| 4000 | Nest API | http://localhost:4000/api/v1/health |

```bash
pnpm dev:stack    # start web + admin + api (one terminal)
pnpm dev:reset    # kill stale ports, clear .next, restart stack — agent default after fixes
pnpm dev:web      # web only
pnpm dev:admin    # admin only
pnpm dev:api      # api only
```

**Broken CSS / vendor-chunks / motion-dom / “missing required error components”:**
1. Agent runs `pnpm dev:reset` (not owner).
2. Owner only hard-refreshes browser: `Cmd+Shift+R` (Windows: `Ctrl+Shift+R`).
3. Never start a second `dev:stack` while one is already running.

**Health probes (agent):**
```bash
pnpm css:health          # layout.css 200 on :3000 / :3001
pnpm doctor              # full project health
curl http://127.0.0.1:4000/api/v1/health
```

---

## Owner preferences

- Language: **Bangla / Banglish / English** — match owner’s style.
- **Honest feedback** — red for real errors; green only for verified success.
- **Telegram** = primary mobile ops channel.
- **Agent owns dev restarts** — after web/admin/api/CSS/config changes, run `pnpm dev:reset` or verify ports; never tell owner “terminal এ restart করুন”.
- **Ship order (mandatory):** finish **all** code fixes first → local verify → **then** one push/deploy. Never deploy mid-fix; never stop the live VPS for each small tweak.
- Banglish intent:

| Owner says | Do |
|------------|-----|
| thik koro / fix koro | Diagnose with code + logs, then fix |
| connection nai | Check env, API health, proxy `/api/proxy/*` |
| problem ki | Full diagnostic: API, DB, Redis, CORS |
| ordar / courier book | Orders module + real API, no fake booking |
| admin panel | `apps/admin/` + honesty toasts |

---

## Admin UI honesty (mandatory)

Use `apps/admin/src/lib/admin/feedback.ts` — **not** raw `react-hot-toast` for new admin code.

| Helper | When |
|--------|------|
| `toastOk` | Verified API success, or honest **non-save** client action (CSV export, clipboard copy, local draft ready) — message must **not** say “saved” unless server confirmed |
| `toastFail` | API offline, `!res.ok`, network error |
| `toastWarn` | Partial success, dev stub, queued — never green |
| `toastInfo` | Neutral local UI feedback (not success, not error) |
| `toastApiSaved` | Settings PATCH verified via `verifySettingsApplied` in `settings-save.ts` |
| `notifyBackendMissing` | Amber — backend not connected; **nothing was saved** |
| `toastCourierResult` | Courier booking — green only for real Steadfast `consignmentId` (not `DEV-*`) |

- `notifySaved` → **fully removed** from codebase. Do **not** reintroduce amber fake-save toasts.
- Offline: show `ApiOfflineBanner` / empty state — never fake live data.
- Admin API calls go through `apiFetch` (`lib/api/client.ts`) or server proxy routes (`/api/proxy/*`).
- `apiFetch` throws `ApiError` on `!res.ok` — success toasts belong only **after** that resolves or in mutation `onSuccess`.

---

## Code rules

- TypeScript: avoid `any`; match existing types in `packages/types`.
- Imports: verify file exists before adding.
- API prefix: `/api/v1` (Nest). Admin browser → `/api/proxy/...` → API.
- Storefront browser → prefer same-origin BFF (`apps/web/src/app/api/*`) over direct `:4000` fetch.
- Prisma schema: `packages/database/prisma/schema.prisma` — migrate after schema edits.
- Windows + Mac parity: use `127.0.0.1` for local SSR (`packages/config`); no Windows-only scroll/CSS hacks unless measured.

---

## Web storefront (`apps/web/`)

Customer site — luxury UI, mobile-first, BDT (`formatBDT` in `lib/utils/currency.ts`).

### Architecture rules

- **BFF pattern:** browser/client calls same-origin `apps/web/src/app/api/*` — **not** `localhost:4000` directly (avoids CORS, hides secrets).
- **Server proxies:** `apps/web/src/lib/server/*` (`api-orders`, `api-cart`, `api-auth`, `payment-api-proxy`) talk to Nest API.
- **Delivery charge:** never trust client-submitted fee — recompute in BFF (`app/api/orders/route.ts`) + API (`delivery-charge.util.ts`) from district/zone (`packages/config`, `lib/checkout/shipping.ts`).
- **Checkout:** `lib/checkout/checkout-schema.ts` + `checkout-validation.ts`; payments via `lib/checkout/payments.ts` (COD, bKash, Nagad, SSLCommerz).
- **Cart:** Zustand `store/cartStore.ts` + server sync `CartSyncHydrator` + `/api/cart/[sessionId]/*`.
- **Auth:** OTP + email/password + Google (`app/api/auth/*`, `components/auth/AuthGoogleProvider.tsx`); session cookie via BFF.
- **Catalog:** SSR/ISR in `lib/catalog/`; product pages `app/products/[slug]/`.
- **Performance:** lazy earth globe (`components/footer/earth-live/`), `ChunkReloadGuard`, `CssHealthGuard` — broken chunks → agent runs `pnpm dev:reset`.

### Footer — do not touch (owner lock)

Unless the owner **explicitly** asks to change the footer in that message, agents must **not** edit:
- `apps/web/src/components/layout/Footer/`
- `apps/web/src/components/footer/EarthBackdrop.tsx`
- `apps/web/src/styles/earth-backdrop.css`
- Footer CSS in `globals.css` (`.site-footer*`, `.footer-lux*`)

No swaps (e.g. `LazyFooterEarthGlobe` ↔ `EarthBackdrop`), no overlay/blur/reload tweaks, no drive-by “fixes”. Current: `EarthBackdrop` video in `Footer.tsx`.

### Auth / Google sign-in — locked (owner verified)

Login/signup Google button works and must stay. Do not edit without explicit owner request:
- `apps/web/src/components/auth/AuthGoogleGlassFooter.tsx`, `AuthGoogleProvider.tsx`, `auth-google-bridge.tsx`, `AuthExperience.tsx`
- `apps/web/src/app/api/auth/config/route.ts` — `googleSignInEnabled` must depend **only** on `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; the web process can't see root `.env` server vars, so requiring them hides the button after config loads (flash-then-vanish bug).
- Env: `apps/web/.env.local` holds `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; Nest API verifies credentials with `GOOGLE_OAUTH_CLIENT_ID` from root `.env`.

### Key web routes

| Route | Purpose |
|-------|---------|
| `/shop`, `/collections/[slug]`, `/new-arrivals`, `/best-sellers` | Catalog |
| `/products/[slug]` | PDP + reviews + sticky purchase (only when inline CTAs off-screen; no gallery thumb strip when colour thumbs exist; never double Add to bag) |
| `/cart`, `/checkout`, `/checkout/mobile-payment` | Cart + payment |
| `/order-confirmation/[id]`, `/track-order` | Post-purchase |
| `/account`, `/(auth)/login`, `/signup` | Customer account |
| `/about`, `/faq`, `/contact`, legal pages | Content (`lib/content/`) |

### After web edits

`pnpm check:web` → if CSS/chunk errors → `pnpm dev:reset` → verify `:3000`.

---

## Key paths

| Area | Path |
|------|------|
| Storefront | `apps/web/` |
| Web BFF routes | `apps/web/src/app/api/` |
| Web checkout | `apps/web/src/lib/checkout/` |
| Delivery zones | `packages/config/src/delivery-zones.ts` |
| Admin dashboard | `apps/admin/` |
| Admin nav | `apps/admin/src/lib/navigation/admin-nav.ts` |
| Admin modules | `apps/admin/src/lib/modules/registry.ts` |
| Admin proxy | `apps/admin/src/app/api/proxy/[...path]/route.ts` |
| API | `apps/api/` |
| Auth / sessions | `apps/api/src/modules/auth/`, `apps/api/src/common/auth/` |
| Database | `packages/database/` |
| Shared config | `packages/config/` |
| Agent (in-app AI) | `apps/api/src/modules/agent/` |
| Courier | `apps/api/src/modules/courier/` |
| Env template | `.env.example` |

---

## In-app AI (SPLARO Command)

**v2:** cost budget (`AGENT_DAILY_COST_LIMIT_USD`), tool tiers (READ/WRITE/DANGEROUS), confirm gate for dangerous actions, audit log (`GET /agent/activity`), read-cache, difficulty-based model routing. Floating FAB chat unchanged; Activity table on `/dashboard/ai-agent`.

Knowledge injected via:
- `apps/api/src/modules/agent/prompts/system.prompt.ts`
- `apps/api/src/modules/agent/prompts/platform-knowledge.prompt.ts` (always appended)

After prompt edits: restart API (`pnpm dev:api` or `pnpm dev:reset`). Tools must fetch live data — never invent counts.

---

## Common failures → agent fix

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Admin unstyled / chunk 404 | Stale `.next` or duplicate dev servers | `pnpm dev:reset` |
| “missing required error components” | Stale cache + missing error boundary | `pnpm dev:reset`; ensure `apps/admin/src/app/error.tsx` exists |
| Admin data empty | API down / DB disconnected | Check `:4000/health`, `DATABASE_URL`, `pnpm db:push` |
| Save green but data unchanged | Client toast without `res.ok` | Use `toastFail` + verify response |
| CORS in dev | Browser → `:4000` direct | Use web BFF route or ensure `CORS_ORIGINS` includes `:3000` |
| OTP / rate-limit flaky | Redis down | `REDIS_URL`, `pnpm infra:redis` (Docker on Windows) |
| Windows port stuck | Old listener / duplicate dev | `pnpm dev:reset` (`taskkill /T` tree kill via `killProcessTree`) |
| `db:*` fails on Windows | Was bash-only | Now `node scripts/db-run.mjs` — cross-platform |
| Windows scroll hang / dead click | Stale Lenis lock | `windows-native-scroll-script.ts` + `data-os=windows` profile |
| Windows SSR slow to API | `localhost` → IPv6 | `getServerApiBaseUrl()` uses `127.0.0.1` in dev |
| Print/PDF does nothing | `noopener` / await-then-open popup block | Sync `window.open` first; invoice URL use `SPL-####` |
| Invoice footer `www.localhost` | Brand derived from local SITE_URL | `splaro-invoice-brand.ts` sanitizer — restart API |
| Fake courier BOOKED | Simulated persist | Never persist `DEV-*` / stub as live BOOKED |
| Double Steadfast book | Redis lock fallthrough | Contended lock → null; no local fallback when Redis ready |

---

## Security reminders

- Never commit `.env`, secrets, or real API keys.
- Production requires: `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGINS` (no trailing slash).
- Production also: `REDIS_ENABLED=true`, `COURIER_DEV_STUB=false` — `scripts/validate-production-env.mjs`.
- Admin sessions: JWT verified **and** live DB `isActive` + staff role (`AdminSessionResolver`).
- Password login: opt-in via `ALLOW_ADMIN_PASSWORD_LOGIN=true`; Telegram OTP is default admin path.
- **Feature flags** (`FEATURE_*` in `.env`, defaults in `packages/config/src/feature-flags.ts`): enforced via API `@RequireFeature` + admin nav/UI (`GET /api/v1/features`). SaaS / vendor / loyalty default **off** — do not expose half-built panels.
- Half-built admin panels: `ModuleWorkspace` hides `beta`/`prototype` body (banner only).

---

## Orders / courier / invoices (do not regress)

- Status changes: `OrderStatusService.applyStatusChange` only (admin + AI agent).
- Courier: no fake BOOKED; Steadfast honesty via `hasRealCredentials`; redis lock no fallthrough.
- Invoice Print/PDF: `admin-actions.ts` — sync open, no `noopener` in features, prefer `SPL-####` in URL.
- Invoice brand: never localhost in footer (`packages/config/src/splaro-invoice-brand.ts`).

---

## Windows + Mac parity

- **Dev scripts:** all core `.mjs` runners (`dev-stack`, `dev-reset`, `db-run`, `doctor`, `port-utils`) work on Windows without Git Bash.
- **Ports:** `scripts/port-utils.mjs` — `netstat` + `taskkill /T` on Windows, `lsof` on Mac/Linux.
- **Shutdown:** use `killProcessTree` — plain `child.kill` leaves zombies on Windows when `shell: true`.
- **DB commands:** `pnpm db:generate`, `db:migrate`, `db:push`, `db:seed` → `node scripts/db-run.mjs` (loads `.env` cross-platform).
- **Redis on Windows:** `pnpm infra:redis` → Docker Compose (install Docker Desktop). No Homebrew. Prefer `redis://127.0.0.1:6379`.
- **SSR/API loopback:** `packages/config` `getServerApiBaseUrl()` prefers `127.0.0.1` over `localhost` (fixes Windows IPv6 stalls).
- **Scroll/perf:** `windows-native-scroll-script.ts` prevents Lenis dead-click hang; `data-perf=lite` only on low memory / save-data — Windows desktop gets full glass/motion like Mac.
- **Hard refresh:** Windows `Ctrl+Shift+R`, Mac `Cmd+Shift+R` after `pnpm dev:reset`.
- Deploy/bash scripts (`infrastructure/`) remain Mac/Linux VPS tools — daily dev on Windows uses `pnpm dev:stack` only.

---

## Git

- Commit or push **only when owner asks**.
- Follow existing commit message style; use Conventional Commits when drafting.
- **CI gate (GitHub + pre-push):** web lint, admin lint, **API lint (tsc)**, **API unit**, **API e2e**. Local full mirror: `pnpm ci:verify`.
