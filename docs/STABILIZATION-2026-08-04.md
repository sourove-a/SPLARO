# Stabilization log — 2026-08-04

Everything below was measured, not assumed. Where a claim could not be
reproduced, it says so. Where something is still broken, it says that too.

Deployed commits from this round, oldest first:

| Commit | Subject |
| --- | --- |
| `462c42c4` | `fix(sheets)` — finish the business spreadsheet and unbreak tab pushes |
| `77de78e4` | `docs` — correct four claims that contradicted the codebase |
| `c465dab4` | `fix(web)` — show fullscreen controls, stop gating motion on Windows |
| `1dffc809` | `fix(nginx)` — stop overriding the app's Cache-Control on every page |
| `8eeac58f` | `fix(hero)` — stop offering slider controls before they work |

All five: CI green, Deploy VPS green, production verified after each.

---

## 1. Google Sheets — three faults, all fixed

The integrations screen read "0 succeeded, 5 failed" with most tabs "Not set up".

### Manual pushes could never work

"Push this tab now" sends a job type and no record id. Every branch in the sync
processor demanded one:

| Tab | Old result |
| --- | --- |
| Orders | `orderId required` |
| Customers | `customerId required` |
| Products / Inventory | `productId required` |
| Partner / Expenses / P&L / Payment | `Unknown job type` — no branch existed |
| Daily Summary | `Unknown job type` — no branch existed |

A job with no record id is a whole-tab rebuild, so it now runs a full backup.
The per-record path (order placed → `syncOrder(id)`) is unchanged and pinned by
tests.

### One failure painted every tab red

Per-tab status fell back to `googleWorkspaceConnection.lastError`, which is
written by whichever job failed last, connection-wide. A single bad job made
healthy tabs report its error as their own. Tabs now show only their own error.

### Eight tabs were never written

Partner Accounts, Expenses, Profit & Loss, Courier, Payments, Daily Summary,
Telegram Logs and AI Jobs were mapped in the admin and counted in "n of 12 tabs
set up" while no code populated them. Each now has headers, a query and a row
builder. `CORE_WORKSPACE_TABS` lists them so they report as configured.

Telegram messages are trimmed to 500 characters — Sheets rejects the whole
batch over its cell limit, so one long broadcast would have failed every tab.

**Still needs a human:** press **Sync everything** once in the admin. That
creates the eight new tabs and replaces the stale `Missing env
GOOGLE_SHEETS_ORDERS_ID` rows with fresh successful ones. That button was the
broken one, which is why the old errors had no way to clear.

---

## 2. Storefront fixes

### Fullscreen gallery controls were invisible

In lite mode the close and prev/next buttons swap their 13%-white fill for
near-solid white so the backdrop blur can be skipped — but they kept
`color: #fff`. White glyph on a white pill. Fullscreen showed three blank
circles: no X, no arrows. Now inked dark.

The two inline gallery buttons already declared their own dark colour, so only
the lightbox pair needed it.

### Windows no longer forces lite paint

The pre-paint script set `data-perf=lite` whenever the UA said Windows, which
drops glass, reveals, and card and hover motion site-wide.
`DesktopPerfParity` already removes the flag after confirming the device is not
low-power — but it runs in a layout effect, and on a cold first visit hydration
lands many seconds after the page is legible. For that whole window a capable
Windows desktop rendered flat and inert.

The pre-paint guess now uses the signals `DesktopPerfParity` itself trusts:
save-data, reduced-motion, touch or small viewport, memory ≤2 GB, cores ≤2.
Pre-paint and post-hydration agree, so there is no flip.

**Scroll handling is untouched.** Windows stays on native scroll with no Lenis,
per the stability rule. Motion policy and scroll policy are separate questions
and only the former changed.

Verified: 1440 px desktop (16 GB / 10 cores) → `data-perf` absent, previously
`lite`. 390 px → still `lite` with native scroll, so the low-power path is
intact.

### Hero controls no longer lie about being ready

The hero is server-rendered, so its arrows and dots are painted and look
pressable for the seconds it takes the bundle to hydrate. Pressing one did
nothing. The slider's `ready` state existed and was exposed as
`data-slider-ready`, but no control consulted it.

Arrows and dots are now `disabled` until ready, labelled "Slideshow still
loading", and dimmed rather than hidden so the layout does not shift.

Two things found while doing it:

- A `transition: opacity` on the dots restarted every time autoplay moved the
  active slide, so a dot never settled and sat permanently at the disabled
  opacity even after hydration. Transition is now on arrows only.
- Two hero instances render (mobile and desktop, one hidden by CSS), so the
  hidden one legitimately reports `ready=false`. Pre-existing, not addressed.

This does **not** make the page interactive sooner. See §5.

---

## 3. nginx was overriding the app's cache policy

Every response carried two `Cache-Control` headers:

```
public, s-maxage=30, stale-while-revalidate=60      ← Next.js, correct
no-store, no-cache, must-revalidate, max-age=0      ← nginx, blanket
```

`infrastructure/vps/deploy.sh` copies `infrastructure/hostinger/splaro-co-web.conf`
to the VPS — which is why the deployed nginx carried a header that
`infrastructure/vps/nginx-splaro.co.conf` does not define. The `add_header` in
`location /` is removed; Next.js already sets the right policy per route.

After: homepage returns one header. `/cart` keeps `private, no-store`.
`/_next/static/` keeps `public, max-age=31536000, immutable`.

**Correction worth recording:** this was first called the main cause of slow
first loads. It is not. JS chunks were never affected — they always carried
`immutable`, which is why a warm reload is fast. The cost of `no-store` was one
HTML round-trip per navigation, not the 16 s first paint.

---

## 4. Documentation corrections

Four statements contradicted the codebase and were pointing agents at things
that are not true:

| Doc | Said | Actually |
| --- | --- | --- |
| `AGENTS.md` | Footer renders an `EarthBackdrop` video | Component and stylesheet exist but are imported nowhere; `Footer.tsx` has no Earth, globe or `<video>` |
| `AGENTS.md` | `googleSignInEnabled` depends only on `NEXT_PUBLIC_…` | True, but the id handed to GIS deliberately falls back to server-side `GOOGLE_OAUTH_CLIENT_ID`; both are now documented so nobody "tidies" the fallback away and breaks VPS login |
| `AI_GUIDE.md`, `README.md` | Women's-only fashion + SaaS platform | Live nav is Men, Women, Kids, Footwear, Accessories; the same file's module table marks SaaS out of scope |
| `AI_GUIDE.md`, `README.md` | API is `api.splaro.co` | Production default is the same-origin `splaro.co/api/v1`; both resolve, same-origin is canonical |

Two flagged risks were checked and are **not** problems. Both are now recorded
in `AGENTS.md` so they stop being re-reported:

- **Two deploy paths.** `deploy-hostinger.yml` is `workflow_dispatch`-only,
  never fires on push, never SSHes, writes to no host. `deploy-vps.yml` is the
  only auto-deploy and is gated on CI green. Fake root `*.yml` Playwright dumps
  (formerly mistaken for a second deploy path) were deleted 2026-08-04.
- **Secrets in git.** Only `.env.example` and
  `infrastructure/hostinger/.env.splaro.co.production.example` are tracked.
  `.env` and `apps/web/.env.local` are ignored and absent from history. A scan
  of tracked files for private keys, `sk-…` and `AIza…` returns nothing.

---

## 5. The real remaining performance problem

**First visit costs ~1435 KB of JavaScript across 28 chunks.**

| Measurement | Cold | Warm reload |
| --- | --- | --- |
| DOMContentLoaded | 4810 ms | 282 ms |
| `load` | 16036 ms | 296 ms |

Warm is 54× faster because the chunks are cached. Nothing about the code is
slow — the cost is downloading the bundle the first time. That ~16 s window is
where the page looks finished and ignores clicks, and it is the strongest
explanation for "nothing works".

The hero fix in §2 makes that window **honest**, not shorter.

### Concrete lead: one chunk is 325 KB

The largest chunk contains `redMul`, `redSqr`, `redIAdd`, `redISub`, `iushrn`,
`isZero`, `Buffer` — that is **bn.js / elliptic**, elliptic-curve big-number
maths. It loads on every page: homepage, shop, about, contact.

**Not yet known: which dependency pulls it in.** Two suspects were checked and
cleared:

- `ioredis` — imported only in `apps/web/src/lib/server/redis-rate-limit.ts`,
  server-only
- `three` + `@react-three/drei` + `@react-three/fiber` — every component using
  them (`EarthGlobe`, `FooterEarthCanvas`, `EarthDisc`, `LazyFooterEarthGlobe`)
  is orphaned, imported nowhere, same as `EarthBackdrop`

**Do not remove a dependency on a guess.** If that 325 KB turns out to be
payment or auth signing, checkout breaks. The correct next step is
`@next/bundle-analyzer`, which reports the import graph without changing
anything.

### TTFB claim not reproduced

An audit reported an average TTFB of 2.879 s. Measured across nine requests it
is **0.22 – 1.00 s**, averaging roughly 0.5 s. It may have been true under a
cold PM2 process; it is not true now.

---

## 6. Still open

### Needs the owner — code cannot fix these

| Item | Detail |
| --- | --- |
| **Product image ↔ title mismatch** | "Weekend Crossbody Wallet" shows a handbag; "Classic Prayer Cap Set" shows a green suit. Catalog data plus photography. This is the single largest reason the storefront reads as cheap — no amount of CSS compensates for a wallet illustrated by a handbag. |
| **`careInstructions` 5/37 (14%)** | The PDP renders the field; it is empty on 32 products. Must come from the real garment care label — inventing it would be a false product claim. |
| **`season` 0/37** | Not set on any product. |
| **Hero media** | The homepage hero is ocean footage with no connection to apparel, Dhaka or the collection. Needs a real SPLARO campaign asset. |

For reference, field completeness across 37 published products:

```
fabricContent      31/37   84%
fitType            31/37   84%
occasion           30/37   81%
shortDescription   36/37   97%
description        37/37  100%
metaDescription    37/37  100%
careInstructions    5/37   14%   ← gap
season              0/37    0%   ← gap
products with 0 images: 0
products with ≤1 variant: 2
```

### Engineering, not yet started

| Item | Notes |
| --- | --- |
| **JS payload** | §5. Start with bundle-analyzer, not with deletions. |
| **Homepage information architecture** | Five identical category rows (Men, Women, Kids, Footwear, Accessories) read as a directory, not curation. Needs a content decision before code. |
| **PDP redesign** | A full brief exists: flat editorial layout, smaller size chips, no large rounded CTA card, no grey tile inside the black CTA, inline share instead of a floating pill. Verified as accurate against the live page. Touches ~8600 lines across 5 files in an owner-locked area — should be done in reviewable steps, not one pass. |
| **Size chips** | Reduced once, then reverted by a concurrent session. Currently 64×40 px at 16 px type. |
| **Admin depth** | 144 routes in the nav registry, ~55 with a bespoke screen. The rest fall through to a generic block renderer, which is why the admin reads as broad but shallow. |

---

## 7. Working notes for whoever picks this up

**A concurrent session was editing this repo during this work.** It reverted
size-chip sizing and at one point flipped a selected-size label to near-black on
a near-black chip, making the chosen size invisible. If a change appears to
undo itself, that is why — check `git diff` before re-applying.

**Test coverage added this round:** API tests went 97 → 176. New suites cover
the sheets dispatch for every tab, product hard-delete FK coverage, customer
bulk-delete skip/force behaviour, revenue zero-fill, daily-goal validation and
the low-stock threshold util.

**One pre-existing bug was found by writing those tests:** `notifyAdmin` called
`this.logger[level]` where level could be `'info'`, and Nest's Logger has no
`info` method. Every order-confirmed and payment-received notification threw
before sending. Fixed by mapping level → `log` / `warn` / `error`.

**A recurring pattern is worth naming.** Three separate bugs this round had the
same shape: an override changed a *background* without adjusting the
*foreground* on top of it — lightbox icons, size-chip labels, and the lite-mode
control pills. When touching `performance.css`, check contrast after the swap.
