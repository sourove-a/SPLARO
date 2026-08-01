# SPLARO — Remediation Plan

Audit date: 2026-07-28 · Codebase: 185k LOC · Branch: `main`

Baseline at time of audit: `turbo run type-check` ✅ · `next lint` (web) ✅ · API unit tests 76/76 ✅.
Everything below is a defect the toolchain does **not** currently catch.

---

## How to use this plan

Phases are ordered by **blast radius**, not by effort. Phase 0 and 1 are live-risk and should ship
before any cosmetic work. Phases 3–6 can run in parallel across separate branches once Phase 2 lands.

Each task lists: **what**, **where**, **done when**. Estimates assume one engineer.

| Phase | Theme | Effort | Blocks release? |
|---|---|---|---|
| 0 | Secret rotation | 2–3 h | **Yes** |
| 1 | Payment endpoint hardening | 1 day | **Yes** |
| 2 | Error handling & robustness | 1 day | Yes |
| 3 | Guardrails (lint / CI / worker) | 1 day | No |
| 4 | Test foundation | 3–5 days | No |
| 5 | Design system consolidation | 2–3 weeks | No |
| 6 | Performance & dependency cleanup | 2–3 days | No |

Total: ~5–6 weeks of focused work, of which the first ~3 days are the urgent part.

---

## Phase 0 — Secret rotation (do first, do today)

`infrastructure/hostinger/.env.splaro.co.production` is tracked in git across four commits
(`824be93e`, `0d351871`, `aa230a20`, `9a9f55c3`). It carries real values for `JWT_SECRET`,
`JWT_REFRESH_SECRET`, `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`, `REVALIDATE_SECRET`,
`INTERNAL_HEALTH_SECRET`, and a `DATABASE_URL` with embedded credentials. The `.gitignore` entry at
line 11 does not help — gitignore never untracks a file that was already committed.

Given the VPS compromise on 2026-07-10, assume these are already in someone else's hands.

**Order matters. Rotate before untracking, untrack before purging history.**

### 0.1 Rotate on the live VPS — *you run this, not the agent*

Generate fresh values and write them into the server's real env file (not the repo):

- `JWT_SECRET` — 48+ chars
- `JWT_REFRESH_SECRET` — 48+ chars
- `ADMIN_SESSION_SECRET` — 32+ chars
- `ENCRYPTION_KEY` — exactly 32 chars (AES-256 key length; check `env.validation.ts` before changing)
- `REVALIDATE_SECRET`, `INTERNAL_HEALTH_SECRET`

Then rotate the database password and update `DATABASE_URL`.

**Expected fallout, plan for it:** rotating `JWT_SECRET` and `ADMIN_SESSION_SECRET` invalidates every
active admin session and customer login. Rotating `ENCRYPTION_KEY` breaks decryption of anything
already encrypted with the old key — **audit what is encrypted at rest before you touch it**
(`grep -rn "ENCRYPTION_KEY" apps/api/src`). If integration credentials are stored encrypted, they
must be re-entered after rotation, or migrated with a dual-key read path.

Restart all PM2 processes after the env file is updated.

**Done when:** admin login works with new secrets, storefront checkout completes end-to-end, and no
service logs a decryption failure.

### 0.2 Untrack the file

```bash
git rm --cached infrastructure/hostinger/.env.splaro.co.production
```

Commit. Confirm `.gitignore:11` already covers it (it does). Add a redacted
`infrastructure/hostinger/.env.splaro.co.production.example` with keys and empty values so the deploy
scripts still document what they need.

**Done when:** `git ls-files | grep '\.env'` returns only `.env.example` and the new `.example` file.

### 0.3 Purge from history

Only after 0.1 is verified. Use `git filter-repo` (not `filter-branch`):

```bash
git filter-repo --path infrastructure/hostinger/.env.splaro.co.production --invert-paths
```

This rewrites every commit hash. Coordinate with anyone holding a clone — they must re-clone, not
pull. If the repo has a remote, this is a force-push.

**If history purge is too disruptive right now, 0.1 alone neutralizes the risk.** Rotation is the
part that matters; purging is hygiene. Do not let purge complexity delay rotation.

### 0.4 Add a secret-scanning guard

Add `gitleaks` (or `trufflehog`) as a CI step in `.github/workflows/ci.yml`, before the type-check
step, so this cannot recur.

**Done when:** CI fails on a branch that adds a file matching `*.env.production`.

---

## Phase 1 — Payment endpoint hardening

All in `apps/api/src/modules/payments/`.

### 1.1 Authenticate `ssl/fail` and `ssl/cancel` — **highest-value fix in this phase**

**Problem.** [`payments.controller.ts:348-366`](../apps/api/src/modules/payments/payments.controller.ts#L348)
exposes both as `@Public()` with no throttle and no signature verification.
[`sslcommerz.service.ts:211`](../apps/api/src/modules/payments/sslcommerz.service.ts#L211) only runs
`validateIpn` for `success` and `ipn`, so fail/cancel go straight to `updateOrderPayment`. That
method then does `payment.findFirst({ where: { orderId } })` and updates whatever row it finds —
**regardless of payment method** ([`sslcommerz.service.ts:276-289`](../apps/api/src/modules/payments/sslcommerz.service.ts#L276)).

A single unauthenticated `POST /api/v1/payments/ssl/fail` with `{"tran_id": "<victim invoice>"}`
flips a PAID bKash payment row to FAILED, blanks its `transactionId`, and overwrites
`gatewayResponse` with attacker-supplied JSON. Payment evidence destroyed, order support broken.

**Fix.**
1. In `handleCallback`, run `verifyHash(body, invoiceNumber)` for **all** callback types, not just
   PAID ones. Return `{ ok: false, status: 'INVALID' }` when it fails.
2. Scope the `findFirst` to the gateway: `where: { orderId, method: 'SSLCOMMERZ' }`.
3. Never downgrade a row that is already `PAID` — if `existing.status === 'PAID'` and the incoming
   status is FAILED/CANCELLED, log and return without writing.
4. Add `@Throttle({ default: { limit: 20, ttl: 60_000 } })` to both endpoints.

**Done when:** a new spec in `sslcommerz.service.spec.ts` proves an unsigned fail-callback leaves a
PAID payment row untouched.

### 1.2 Give `bkash/refund` a DTO and bounds

**Problem.** [`payments.controller.ts:167-185`](../apps/api/src/modules/payments/payments.controller.ts#L167)
uses an inline body type. `ValidationPipe` needs a class to read decorator metadata from — an inline
TypeScript type produces no metadata, so **nothing is validated**. No order lookup, no positive-amount
check, no `amount ≤ order.total` check, no already-refunded check.

**Fix.** Add `BkashRefundDto` to `apps/api/src/common/dtos/payments.dto.ts` alongside the existing
three DTOs, following their pattern (`@IsString()`, `@IsNumber() @Min(0.01)`, `@MinLength`). Then in
the handler: look up the order by `trxId`, assert `amount > 0`, assert
`amount ≤ order.total − alreadyRefunded`, and assert the order is not already fully refunded.

**Done when:** a refund for more than the order total returns 400, covered by a spec.

### 1.3 Throttle the remaining public payment endpoints

`bkash/execute` ([:146](../apps/api/src/modules/payments/payments.controller.ts#L146)) and
`bkash/query` ([:162](../apps/api/src/modules/payments/payments.controller.ts#L162)) are `@Public()`
with no `@Throttle` — the only two payment endpoints without one. `bkash/query` additionally returns
gateway detail for any `paymentId` supplied, so it is an enumeration surface.

**Fix.** Add `@Throttle({ default: { limit: 10, ttl: 60_000 } })` to both. For `bkash/execute`, also
add a `@IsString() @MinLength(1)` DTO instead of `@Body('paymentId') paymentId: string`.

### 1.4 Tighten the payment-amount tolerance

Three places accept a 1-unit shortfall, which on BDT means every order can be underpaid by 1 taka:

- [`payments.controller.ts:47`](../apps/api/src/modules/payments/payments.controller.ts#L47) — `Math.abs(requested - total) > 1`
- [`payments.controller.ts:281`](../apps/api/src/modules/payments/payments.controller.ts#L281) — Nagad verify, same tolerance
- [`sslcommerz.service.ts:261`](../apps/api/src/modules/payments/sslcommerz.service.ts#L261) — `paidAmount + 1 < total`

Note that `validateIpn` already uses the correct `0.01` tolerance at
[`sslcommerz.service.ts:165`](../apps/api/src/modules/payments/sslcommerz.service.ts#L165) — the outer
guard loosens what the inner one tightened.

**Fix.** Standardize on `0.01` everywhere. Extract a shared
`assertAmountMatches(paid, expected)` helper in `apps/api/src/common/` so the tolerance is defined
once. **Check with the payment provider first** whether any gateway rounds to whole taka; if one
does, special-case that gateway explicitly with a comment, rather than loosening all three.

**Done when:** the tolerance constant appears exactly once in the codebase.

---

## Phase 2 — Error handling & robustness

### 2.1 Stop leaking internal errors on 500

[`all-exceptions.filter.ts:47-49`](../apps/api/src/common/filters/all-exceptions.filter.ts#L47):

```ts
} else if (exception instanceof Error) {
  message = exception.message || message
}
```

Non-`HttpException` errors put their raw message into the 500 JSON body. Prisma errors carry model
names, column names, and argument values; these reach unauthenticated storefront callers.

**Fix.** Keep the detailed message on the log line (already correct at :55) but send a generic
`'Internal server error'` in the body whenever `statusCode >= 500` **and** `isProduction()`. Keep the
real message in development. The `requestId` already in the payload is what support should correlate
on.

**Done when:** an e2e test forcing a Prisma error asserts the response body contains no model name.

### 2.2 Audit the 48 fire-and-forget calls

`grep -rn "void this\." apps/api/src` returns 48 sites. Some correctly chain `.catch()`
(e.g. [`redis.service.ts:32`](../apps/api/src/common/redis.service.ts#L32),
[`payment-confirmation.service.ts:202`](../apps/api/src/modules/payments/payment-confirmation.service.ts#L202)).
Others do not — including the two SSL callbacks at
[`payments.controller.ts:352,362`](../apps/api/src/modules/payments/payments.controller.ts#L352) and the
Telegram notification calls in `storefront.controller.ts`. An unhandled rejection terminates the Node
process under default Node 20 behavior.

**Fix.** Add a small `fireAndForget(promise, logger, context)` helper in `apps/api/src/common/` that
always attaches a `.catch()` with a structured log line. Replace every bare `void this.x()` with it.
Then add an ESLint rule to prevent regression (see 3.1): `@typescript-eslint/no-floating-promises`.

**Done when:** `no-floating-promises` passes clean on `apps/api/src`.

### 2.3 Bound the middleware cache

[`product-exists.ts:10`](../apps/web/src/lib/server/product-exists.ts#L10) is a plain `Map` with
TTL-on-read and no eviction sweep. Requesting `/products/<random>` in a loop grows it without bound —
each miss caches a `false` entry with a key up to 160 chars.

**Fix.** Cap it (~1000 entries) with simple FIFO eviction: when `cache.size` exceeds the cap, delete
the oldest key before inserting. `Map` preserves insertion order, so
`cache.delete(cache.keys().next().value)` is enough. No new dependency needed.

**Done when:** a unit test inserting 5000 distinct slugs asserts `cache.size <= 1000`.

### 2.4 Review swallowed errors

14 instances of `.catch(() => {})` / `.catch(() => null)` in `apps/api/src`. Each needs a judgement
call: genuinely optional side effects can stay (add a comment saying so), but anything on a payment,
order, or auth path must at minimum log. Do this as a review pass, not a blanket rewrite.

---

## Phase 3 — Guardrails

The reason the Phase 1 and 2 defects survived is that nothing was watching for them.

### 3.1 Real ESLint on the API

Today `apps/api` `"lint"` is `tsc -p tsconfig.build.json --noEmit` — byte-identical to its
`"type-check"`. CI's "Lint API" step is therefore a duplicate typecheck, and **49,833 lines of backend
have never been linted**.

The root `.eslintrc.json` cannot be reused as-is: it extends `next/core-web-vitals`, which only
resolves inside `apps/web` (its plugins come from `eslint-config-next`). Root `devDependencies` also
has `eslint` but no `@typescript-eslint/*` packages.

**Fix.**
1. Add `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` to
   `apps/api/devDependencies`.
2. Create `apps/api/.eslintrc.json` extending `eslint:recommended` +
   `plugin:@typescript-eslint/recommended-type-checked` (type-aware, so `no-floating-promises` works).
   Mirror the root rule set: `no-explicit-any: error`, `no-unused-vars` with `^_`, `no-console` warn.
3. Change `"lint"` to `eslint "src/**/*.ts"`, and keep `"type-check"` as the tsc call.
4. Expect a large first-run error count. Land the config with `--max-warnings` set to the current
   count, then ratchet it down — do not try to fix everything in one PR.

**Done when:** `pnpm --filter @splaro/api lint` runs ESLint and CI enforces the ratchet.

### 3.2 Bring `apps/worker` into the build

`apps/worker/package.json` has only `build`, `start`, `dev` — no `lint`, `type-check`, or `test`. It
is therefore invisible to every `turbo run` task and to CI entirely.

**Fix.** Add `type-check` (`tsc --noEmit`) and `lint`, matching the API's new config. Add it to the CI
type-check and lint steps.

### 3.3 Make `turbo run lint` mean something

It currently reports "1 packages in scope" — only web, because admin's and API's lint tasks are
either missing or misdefined. After 3.1 and 3.2 it should report 4. Verify explicitly; a lint command
that silently covers one quarter of the repo is worse than none.

### 3.4 Add the CI steps that are missing

- Secret scan (from 0.4)
- `pnpm --filter @splaro/worker type-check`
- Frontend tests once Phase 4 lands

---

## Phase 4 — Test foundation

Current state: **0 test files** across `apps/web` and `apps/admin` — 76,670 lines of TSX including
checkout and payment flows. API is at 18 spec files against 259 source files (~7%).

Do not chase a coverage percentage. Target the paths where a silent regression costs money.

### 4.1 Set up Vitest for web and admin

Vitest + React Testing Library + `@vitejs/plugin-react`. Add `test` scripts to both apps and a
`test` task to `turbo.json` (already defined — just needs the apps to implement it).

### 4.2 Cover the money paths first, in this order

1. **Checkout** — [`checkout/page-client.tsx`](../apps/web/src/app/checkout/page-client.tsx) (1,101 lines):
   total calculation, coupon application, delivery charge, COD vs online branch.
2. **Cart** — line add/remove/quantity, and `cart-line.util.ts` on the API side.
3. **Payment status polling** — `api/payments/status/route.ts`, including the `verified` flag logic.
4. **Order ownership** — [`api/orders/[id]/route.ts`](../apps/web/src/app/api/orders/[id]/route.ts):
   the four-way `ownsOrder` condition is security-critical and untested. Cover each branch plus the
   denial case.
5. **PDP variant selection** — [`product-page-client.tsx`](../apps/web/src/app/products/[slug]/product-page-client.tsx)
   (1,648 lines): variant → price → stock → add-to-cart.

### 4.3 Backfill API specs for the Phase 1 and 2 fixes

Every fix in Phases 1–2 ships with its regression test. That alone roughly doubles payment-module
coverage.

### 4.4 Add e2e smoke for the critical journey

Extend the existing `apps/api/test/` e2e setup, or add Playwright at the repo root, for one journey:
browse → PDP → add to cart → checkout → COD order placed → order visible in admin.

---

## Phase 5 — Design system consolidation

The largest item, and the one that keeps generating recurring bugs (nav/hero overlaps, inconsistent
spacing). Treat it as a project, not a cleanup.

**Current state:**

| Metric | Web | Admin |
|---|---|---|
| CSS lines | 40,581 | 28,482 |
| `!important` | 623 | **2,515** |
| Distinct hex colors | 245 | 296 |
| Hardcoded hex in TSX | 59 | 393 |
| Distinct breakpoints | 36 | 28 |
| Distinct `z-index` values | 30 (`-1` → `100001`) | 19 |
| Distinct `font-size` values | 71 | — |

Admin's 14 stylesheets stack in load order — 6 `@import`ed in
[`globals.css:1-6`](../apps/admin/src/app/globals.css#L1), 8 more imported in
[`layout.tsx:5-19`](../apps/admin/src/app/layout.tsx#L5) — each layer overriding the last with
`!important`. `admin-luxury-2027.css` alone holds 1,262 of them. `admin-tokens.css` (645 lines,
0 `!important`) sits at the bottom and loses every conflict.

### 5.1 Define the scales first (1–2 days, no code changes)

Write them into `admin-tokens.css` and a new `web-tokens.css` as CSS custom properties:

- **Breakpoints** — pick 5 (e.g. 640 / 768 / 1024 / 1280 / 1536) and delete the rest. Note the
  existing `768px` / `767px` / `760px` / `720px` cluster leaves 1px dead zones where no rule applies.
- **z-index** — a named 6-step scale (`--z-base`, `--z-dropdown`, `--z-sticky`, `--z-overlay`,
  `--z-modal`, `--z-toast`). Nothing above 1000. The current `100000` / `100001` pair is why overlap
  bugs keep recurring.
- **Type scale** — 8–10 sizes, not 71.
- **Color** — resolve 296 admin hex values against the documented monochrome rule. The palette
  currently contains blues and purples that contradict it: `#5b1fd9`, `#712eff`, `#8b5cff`,
  `#a078ff`, `#0ea5e9`, `#38bdf8`, `#0284c7`, plus the full slate ramp `#0f172a` / `#1e293b` /
  `#334155` / `#64748b` / `#94a3b8`. Decide per value: map to a graphite token, or keep as a
  documented exception (Telegram login and Google SERP preview are the known legitimate ones).

**Done when:** the token files are complete and reviewed. No CSS deleted yet.

### 5.2 Adopt CSS cascade layers (1 day)

Wrap the stylesheets in `@layer tokens, base, components, overrides;`. Layer order beats specificity,
which means most `!important` becomes unnecessary mechanically rather than by hand-editing 2,515
declarations.

### 5.3 Collapse the admin override stack (1–2 weeks)

Merge in reverse load order, one file per PR, screenshotting before/after:

`admin-ui-strength.css` → `admin-theme-unify.css` → `admin-designmonks-accent.css` →
`admin-interactions-premium.css` → `admin-shell-premium.css` → `admin-catalog-premium.css` →
`admin-luxury-2027.css`

Target end state: `admin-tokens.css` + `admin-design-system.css` + at most 2 feature sheets.

### 5.4 Remove the dead dark-mode path (half a day)

`ThemeProvider` is mounted in [`Providers.tsx:4`](../apps/admin/src/components/layout/Providers.tsx#L4),
`useTheme` is called in [`AdminHeader.tsx:5`](../apps/admin/src/components/layout/AdminHeader.tsx#L5)
and `SpecularButton.tsx`, and there are **82 `dark:` Tailwind variants** in admin TSX — against
**0** `prefers-color-scheme` rules in admin CSS. The feature does not exist but still ships and still
branches at runtime.

**Fix.** Remove `next-themes`, the provider, both `useTheme` calls, and all 82 `dark:` variants.
(If dark mode is actually wanted later, it should be built against the token layer, not retrofitted
onto this.)

### 5.5 Replace native dialogs (1 day)

27 `alert()` / `confirm()` calls in admin TSX, in a UI otherwise built on Radix. Replace with a Radix
`AlertDialog` wrapper — one shared `useConfirm()` hook, then a mechanical sweep.

### 5.6 Add a stylelint guard

Prevent regression: fail CI on new `!important` outside the `overrides` layer, and on hex colors
outside the token files.

---

## Phase 6 — Performance & dependency cleanup

### 6.1 Fix the heavy assets (highest ratio of win to effort)

`.webp` versions already exist next to the heavy originals, but four components still point at the
PNG:

- [`ContentPremiumLegal.tsx:137,166`](../apps/web/src/components/content/ContentPremiumLegal.tsx#L137) — 591 KB logo
- [`ContentPremiumSizeGuide.tsx:99`](../apps/web/src/components/content/ContentPremiumSizeGuide.tsx#L99) — 658 KB logo
- [`MaintenanceScreen.tsx:28`](../apps/web/src/components/maintenance/MaintenanceScreen.tsx#L28) — 658 KB logo

Because `next.config.mjs` sets `images.unoptimized: true` on the VPS (deliberately — sharp would peg
the CPU), these are served raw at full size. Swap all four to the existing `.webp` paths.

Also: `earth.png` is 3.8 MB with a 513 KB `.webp` beside it (`constants.ts` references both — confirm
the PNG is only a fallback and gate it behind a real capability check). And the logo/earth assets are
**duplicated** between `apps/web/public` and `apps/admin/public` — ~2.8 MB of tracked duplicates that
should move to a shared package or CDN.

### 6.2 Delete dead dependencies

| App | Package | Uses |
|---|---|---|
| admin | `react-beautiful-dnd` | 0 — also unmaintained and incompatible with React 19 |
| admin | `axios` | 0 |
| admin | `@tanstack/react-table` | 0 |
| web | `axios` | 0 |
| web | `date-fns` | 0 — yet still listed in `optimizePackageImports` |

### 6.3 Consolidate duplicate libraries

- Admin uses `framer-motion`, web uses `motion` — the same library under two package names, shipped
  twice. Standardize on `motion`.
- Admin pulls in `ogl`, a full WebGL renderer, for exactly one component:
  [`SpecularButton.tsx:12`](../apps/admin/src/components/ui/SpecularButton.tsx#L12). Replace the
  effect with CSS, or drop it.
- Admin also pulls in `three` for a 3D globe on the login screen. It is correctly lazy-loaded, so
  this is a product call rather than a bug — but weigh it against admin load time.

### 6.4 Reduce client-component surface

Web is 148/251 `'use client'` (59%); admin is 163/193 (84%). For a storefront this gives up most of
the RSC benefit. Do not attempt a sweep — pick the top 5 largest client components and push data
fetching up into server components, measuring bundle size before and after.

### 6.5 Add streaming skeletons

No `loading.tsx` exists for web's `/shop`, `/products`, `/collections`, `/checkout`, or `/account`.
Users see a blank wait where they could see a skeleton. Cheap, visible win.

---

## What is already good (do not regress it)

- Order placement is transactional with an idempotency key, backed by a
  `@@unique([storeId, idempotencyKey])` constraint.
- Schema is well-indexed: 182 indexes across 140 models.
- SSL `validateIpn` does real server-side `val_id` verification against the gateway plus a `0.01`
  amount check.
- All money columns are `Decimal(n,2)`.
- Global `ValidationPipe` with `whitelist`, and `forbidNonWhitelisted` in production.
- CSP, HSTS, `X-Frame-Options`, and `Permissions-Policy` are all set.
- `three.js` is correctly lazy-loaded on the storefront.
- **Zero `as any` in the entire codebase** — rare at this size, worth protecting with the new
  ESLint config.

---

## Suggested first PR

Small, reviewable, and it removes the two live risks:

1. `git rm --cached` the env file + add the `.example` (Phase 0.2)
2. SSL fail/cancel signature check + method-scoped `findFirst` + PAID-downgrade guard (Phase 1.1)
3. `BkashRefundDto` + amount bounds (Phase 1.2)
4. Production error-message redaction (Phase 2.1)
5. Specs for all of the above

Secret rotation (Phase 0.1) runs in parallel on the server and is not part of the PR.
