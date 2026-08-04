# Handoff: SPLARO Commerce Admin — UI/UX redesign

## Overview

A ground-up redesign of the SPLARO admin panel: shell, navigation, dashboard, and ~30 module screens. The goal was density and decisiveness — every screen answers "what do I do next", not just "here are some numbers".

Target codebase: **`sourove-a/SPLARO`**, `apps/admin` (Next.js App Router + TypeScript + Tailwind).

---

## About the design files

`SPLARO Admin.dc.html` in this bundle is a **design reference**, not production code. It is a single HTML prototype that renders every screen with a working light/dark toggle and clickable navigation.

**Do not copy this HTML into the repo.** The task is to recreate these designs inside `apps/admin` using its existing patterns: React Server/Client Components, Tailwind classes, the `AdminPageShell` layout, and the `ModuleWorkspace` registry. The prototype exists so you can see exact spacing, colour, copy, and behaviour.

To open it: serve the folder (`npx serve .`) and open `SPLARO Admin.dc.html`. `support.js` and `image-slot.js` must sit next to it.

## Fidelity

**High-fidelity.** Final colours, type scale, spacing, copy, and interaction states. Recreate pixel-for-pixel using Tailwind, mapping the CSS custom properties below onto `tailwind.config.ts` theme tokens.

---

## Design tokens

Defined as CSS custom properties on `:root` and `:root[data-t="dark"]`. Port these into `tailwind.config.ts` as CSS-variable-backed colours so one set of class names serves both themes.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f7f7fa` | app background |
| `--surface` | `#ffffff` | cards, sidebar, header |
| `--surface-2` | `#f4f4f8` | inputs, inset rows, segmented controls |
| `--surface-3` | `#e9e9ef` | track fills, skeleton base |
| `--ink` | `#0b0b12` | primary text |
| `--ink-2` | `#4f4f5c` | secondary text |
| `--ink-3` | `#6b6b74` | muted text (AA-checked — do not lighten) |
| `--line` | `rgba(16,16,38,.085)` | hairline borders |
| `--line-2` | `rgba(16,16,38,.155)` | emphasised borders |
| `--violet` | `#712eff` | **active nav + primary buttons only** |
| `--violet-2` | `#5b1fd9` | primary hover |
| `--violet-soft` | `rgba(113,46,255,.09)` | active nav background |
| `--violet-bd` | `rgba(113,46,255,.28)` | violet chip border |
| `--ok` | `#15803d` | success text/chip |
| `--warn` | `#b45309` | warning |
| `--bad` | `#b91c1c` | error/critical |
| `--info` | `#0369a1` | informational |
| `--sidebar` | `#ffffff` | |
| `--headerbg` | `rgba(255,255,255,.86)` | sticky header, `backdrop-filter: blur` |

Each status colour also has `-soft` (tinted background, ~9–11% alpha) and `-bd` (border, ~24–28% alpha) variants — see the `:root` block in the prototype for exact values.

### Dark

| Token | Value |
| --- | --- |
| `--bg` | `#08080b` |
| `--surface` | `#101015` |
| `--surface-2` | `#17171d` |
| `--surface-3` | `#20202a` |
| `--ink` | `#f5f5f8` |
| `--ink-2` | `#a5a5b2` |
| `--ink-3` | `#8d8d98` (AA-checked) |
| `--line` | `rgba(255,255,255,.075)` |
| `--line-2` | `rgba(255,255,255,.15)` |
| `--violet` | `#8b5cff` (lifted for contrast) |
| `--violet-solid` | `#712eff` (button fill stays brand violet) |
| `--ok` | `#4ade80` · `--warn` `#fbbf24` · `--bad` `#f87171` · `--info` `#38bdf8` |
| `--sidebar` | `#0b0b0e` · `--headerbg` `rgba(11,11,14,.88)` |

Theme is switched by setting `data-t="dark"` on `<html>`. Persist to `localStorage`.

### Type

- Family: **Inter** 400/500/600/700/800, with **Noto Sans Bengali** 400/600 as the fallback for `৳` and Bangla words.
  ```css
  font-family: Inter, 'Noto Sans Bengali', sans-serif;
  ```
- `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;` applied globally so taka columns align.
- Hero metric: `46px / 800 / -0.038em`
- Section title: `13px / 700`
- Body: `12.5px / 1.55 / 400`
- Label (uppercase): `10–11px / 700 / letter-spacing .14em`
- Table cell: `12.5px / 500`
- Mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — SKUs, phone numbers, endpoints, IDs

### Spacing / shape

- Spacing scale is locked to **4px** multiples. Common values: 7, 9, 12, 14, 16, 20.
- Radius: `6px` (tiny buttons) · `8px` (chips, small buttons) · `9px` (buttons, inputs) · `10–12px` (cards) · `99px` (pills)
- **No box-shadows anywhere.** Depth comes from `--line` borders and `--card-sheen`, a `linear-gradient(180deg, rgba(…,.016), transparent 44%)` overlay on cards.
- Focus: `outline: 2px solid #8b5cff; outline-offset: 2px`

### Icons

[Lucide](https://lucide.dev) — the prototype uses the `lucide-static@0.454.0` icon font (`icon-*` classes). In `apps/admin`, use `lucide-react` components with the same names (`icon-warehouse` → `<Warehouse />`).

---

## Shell

### Sidebar — 248px expanded, 62px collapsed

- **Filter box** at top ("Filter menu…"). Typing narrows all 35+ items across every group; empty result shows a "Show all 35" reset.
- **Pinned block** — 5 items (Dashboard, Orders, Products, Packing Station, Partner Hub), separated by a hairline rule. Hidden while filtering so results aren't duplicated.
- **Flat groups, always open.** No collapsing, no chevrons. Each group has a small sticky header: uppercase name + item count, with a violet dot on the group containing the active item.
- Row height **33px**. Active row: `--violet-soft` background, `--violet` text and icon.
- Badges (order count, review count) right-aligned on the row.
- **Collapsed rail shows all items**, grouped with hairline dividers, tooltip on hover, badges on the icons.
- Footer: avatar + name + role + sign-out.

### Header — single sticky bar, 56px

One bar only. Left: breadcrumb (`Group › Screen`), then title, LIVE chip, sync text with a spin-on-click refresh button. Right: state switcher (Live / Loading / Empty / Error, module screens only), then action buttons.

> **Layout note (a real bug that was fixed):** the action group must be `flex: 0 1 auto; flex-wrap: wrap; min-width: 0`. With `flex: none` long labels overflow `<main>` and paint on top of the right rail, because every ancestor is `overflow: visible`.

Header background is `--headerbg` with `backdrop-filter: blur(…)`.

### Right rail — 272px, sticky

Quick actions (2-col grid of icon+label buttons), then Recent activity as a **timeline**: time gutter, connected dots, event title + subtitle. `position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto`.

Below ~1200px the rail drops below the main column; grid tracks must **reflow, not overflow**.

### Global

- **Command palette** on `⌘K` — products, orders, customers, and actions.
- **Toasts** bottom-right, `toastin` keyframe, auto-dismiss.
- **Ask SPLARO** floating button, bottom-right.

---

## Screen system

Every module screen is composed from a small set of block types. Implement these as React components once, then each screen is data. The prototype's block factory (`const B = {…}`, around line 3140) is the spec.

| Block | Renders |
| --- | --- |
| `hero` | one 46px metric + delta chip + supporting sentence + 3 sub-figures |
| `kpis` | 2×2 (or 4-across) metric grid — 22px value, 11px uppercase label, sub-line |
| `decide` | **decision card**: severity stripe, title + SKU + badge, big decision line + deadline, 3 evidence stats, a "why" note, action buttons |
| `table` | header + rows; cell kinds: `{m}` mono · `{s:[title,sub]}` two-line · `{n}` right-aligned number · `{c,tone}` status chip · `{b:[pct,color,label]}` bar · `{v}` plain · `{mute}` dim |
| `cards` | responsive card grid (`grid-template-columns: repeat(auto-fill, minmax(<cardMin>, 1fr))`) with icon/thumb, chip, key-value rows, actions |
| `list` | icon + title + sub + right-aligned value rows |
| `toggles` | labelled switch rows with sub-copy |
| `vis` / `pub` | visibility rows — eye icon **+** VISIBLE/HIDDEN badge **+** labelled "Hide from site" / "Show on site" button (never icon-only) |
| `form` | label + input rows; supports `mono`, `area`, `secret`, `hint` |
| `chart` | bar chart with labels |
| `seg` | segmented counter strip |
| `banner` | tone-coloured inline notice |
| `save` | amber "Unsaved text changes" bar |
| `beta` | `BETA · NOT IN PRIMARY NAV` banner with the real route |
| `media` | image drop slots |
| `timeline` | time gutter + connected dots |

Widths: `'main'` (full content column), `'half'`, `'side'`. Blocks flow in a CSS grid that reflows at narrow widths.

### Module state switcher

Every module supports four states, toggled from the header:

- **Live** — real data.
- **Loading** — shimmer skeletons shaped like that screen's actual blocks (not generic grey bars).
- **Empty** — module-specific copy and a real CTA. There is no generic fallback; all 25+ modules have their own.
- **Error** — the real API error verbatim (e.g. `GET /finance/settlements → 500 · steadfast_remittance last synced 4h ago`), last-known data greyed behind it, and a working Retry that reloads and toasts.

---

## Screens

The prototype's `SCREENS` object holds every screen's block list with final copy. Rather than restate all of it here, work screen-by-screen from the prototype. The five screens added most recently are documented below because they map directly onto existing NestJS endpoints.

### Warehouse & Stock — `/dashboard/wms`

**Purpose:** warehouse inventory truth and the stock audit trail.

Blocks: KPIs (Available / Reserved / Damaged / Bins in use) → `decide` "Transfers waiting on you" → `table` Warehouses → `table` Stock movement ledger → `form` Record a movement → `list` API guards.

Backed by `apps/api/src/modules/commerce-os/`:
- `GET /commerce-os/wms/overview` — warehouses with `zones → racks → bins`, summing `availableQty` / `reservedQty` / `damagedQty`
- `GET /commerce-os/wms/warehouses`, `GET /commerce-os/wms/movements`
- `POST /commerce-os/wms/movements` — `{ sku | variantId, delta, reason, note }`
- `POST /commerce-os/wms/transfers`, `POST /commerce-os/wms/transfers/:id/ship`, `POST /commerce-os/wms/transfers/:id/receive`

Transfer state machine is **PENDING → (ship) → IN_TRANSIT → (receive) → COMPLETED**; each step writes a `StockMovementLog` row. Movement reasons are the nine `StockMovementReason` enum values: `PURCHASE`, `SALE`, `TRANSFER`, `ADJUSTMENT`, `DAMAGE`, `RETURN`, `PRODUCTION`, `AUDIT`, `RESERVATION` — render each as a toned chip.

Surface these API guards as inline errors, not silent failures:
- `delta must be a non-zero integer`
- `Insufficient stock (N available)`
- `Transfer is pending, not in transit`
- `Source and destination warehouse must differ`

### Purchase Orders — `/dashboard/procurement`

Blocks: KPIs → `decide` "POs that need you" (chase overdue, file GRN) → `table` Purchase orders → `table` Suppliers → `list` Goods received → `list` Where this connects.

Backed by `commerce-os.service.ts`: `procurementOverview`, `procurementSuppliers`, `procurementOrders`, `procurementGrns`; `POST /admin/hub/procurement/purchase-orders`.

Supplier **lead time drives every reorder suggestion in Inventory** — surface it prominently and let it be edited from the decision card.

### SMS Center — `/dashboard/sms`

Blocks: banner (Bangla segment warning) → hero → `list` Provider chain → `table` Templates → `toggles` Which events send → `table` Recent sends → `list` Notes.

Backed by `apps/api/src/modules/notifications/sms.service.ts`. Provider chain is tried in order and the first configured one wins:

1. **BDBulkSMS** — `bulksmsbd.net/api/smsapi`, env `BDBULKSMS_API_KEY` / `BDBULKSMS_SENDER_ID` (default `SPLARO`), success when the response contains `1001`
2. **ElitBuzz** — `msg.elitbuzz-bd.com/smsapi`, env `ELITBUZZ_API_TOKEN` / `ELITBUZZ_SENDER_ID`, success on `response_code === 202`
3. **GreenWeb** — `api.greenweb.com.bd/api.php`, env `GREENWEB_SMS_USER` / `GREENWEB_SMS_PASS`, success on `OK`

Master switch is `siteSettings.smsEnabled` — when off, **nothing sends and nothing warns**. Say so in the UI.

**The single most valuable detail on this screen:** Bangla is Unicode, so a segment is **70 characters**, not 160. Show characters, segment count, and cost per send for every template — a 164-character Bangla COD reminder is 3 segments (৳1.05) where the English equivalent is 1 (৳0.35).

Phone normalisation (`normalizePhone`) turns `01711-204556`, `+880 1711 204 556`, and `1711204556` all into `8801711204556`. Sends also fire from the Automation `SEND_SMS` rule action; logs live in `MessageLog` where `channel = 'SMS'`.

### Bulk & CSV — `/dashboard/bulk`

Blocks: honest banner → KPIs → `cards` Bulk operations → `table` Dry-run preview → `list` CSV exports → `list` Importer rules.

Backed today:
- `POST /products/bulk/stock`
- `POST /products/bulk/publish`
- `GET /reports/orders/export-csv`
- `GET /customers/export-csv?tier=`

**Not backed:** there is no `GET /customers/export-csv`. The design shows that operation as an explicit `NOT BUILT` card with the CSV workaround rather than faking it. Keep it that way until the endpoint exists. (Bulk price *is* backed now — `POST /admin/products/bulk/price` landed in `products.controller.ts`.)

The import flow is **map columns → dry run → review per-row status → apply**. The dry run must show rejects with reasons (`negative stock`, `SKU not found`) and skips, and write nothing until approved.

### Google Sheets — `/dashboard/sheets`

Blocks: KPIs → banner (one-way sync) → `table` Sync jobs → `form` Connection → `list` Tab contents → `list` Recovery actions.

Backed by `apps/api/src/modules/integrations/integrations.controller.ts` and `apps/api/src/modules/google-workspace/`:
- `GET /admin/integrations/google-sheets/status`
- `GET /admin/integrations/google-sheets/syncs`
- `POST /admin/integrations/google-sheets/retry-failed`
- `GET /admin/google/sheets/config`, `GET /google-sheets/dashboard`, `GET /google-sheets/logs`
- `GoogleSheetsLiveCron` runs on a 15-minute cadence

Four tabs: **Orders**, **Hisab**, **Partners**, **Stock**. Sync is one-way (SPLARO writes, Sheets reads) — state this in the UI, because editing a cell in Google Sheets silently loses the edit on the next run.

---

## Wiring it into `apps/admin`

Routes resolve through the catch-all at `apps/admin/src/app/dashboard/[...slug]/page.tsx`, which calls `resolveNavRoute(slug)` from `@/lib/navigation/admin-nav` and renders `<AdminPageShell>` around `<ModuleWorkspace>`. To add a screen:

1. **Register the nav item** in `apps/admin/src/lib/navigation/admin-nav` — `{ id, label, icon, group, description, href }`. The catch-all resolves the route and builds breadcrumbs from `navItem.group` / `navItem.label`, so no new route file is needed.
2. **Add the module body** in `@/components/modules/ModuleWorkspace`, keyed on `moduleHref`. Build it from the block components above.
3. **Page-level chrome** — `AdminPageShell` already takes `title`, `description`, `breadcrumbs`, `quickActions`. Header actions and the state switcher belong here.
4. **Create / detail views** — `hasBackendCreateApi(moduleHref)` in `@/lib/modules/module-maturity` gates whether `action === 'create'` renders a real panel or `ModuleCreateView`. Add new module hrefs there when their POST endpoint lands. Detail/edit for `/dashboard/orders`, `/dashboard/products`, `/dashboard/invoices`, `/dashboard/customers` and the three finance modules is handled inside the module; everything else falls back to `ModuleDetailView`.
5. **Permissions** — owner-only sections carry a lock glyph in the nav and a role chip in the header. `apps/api/src/common/auth/admin-route-permissions.util.ts` already scopes `commerce-os/wms`.

Suggested order of work: shell (sidebar + header + rail) → block component library → dashboard → the five API-backed screens above → the rest.

---

## Content rules (please keep these)

These were deliberate decisions, not accidents:

- **Violet is for active nav and primary buttons only.** Not charts, not chips, not tier badges.
- **No shadows.** Borders and the card sheen carry all depth.
- **Never show a bare number where a decision belongs.** "SCAN ERRORS 2" became a card naming the specific parcel, the actual mismatch, and two buttons. Apply this everywhere.
- **Every error shows the real API error string**, endpoint included.
- **Never fake a backend.** If an endpoint doesn't exist, the UI says so (see Bulk price).
- **Visibility controls are always labelled** — icon *and* badge *and* worded button.
- **Save honesty** — instant toggles apply immediately; text edits raise an amber unsaved bar; the green toast only appears after a verified save.
- **Bangla only where the product already uses it** — `hisab`, `khoroch`, `biboron`, প্যাকিং স্টেশন, দৈনিক হিসাব. Don't translate the rest.
- **BD phone format is `01711-204556`** — 11 digits, hyphen after the operator prefix. The public support number is the only one shown internationally (`+880 1711-000111`). Numbers are `tel:` links and search is digit-aware.
- **Taka grouping is lakh/crore** — `৳48,60,000`, not `৳4,860,000`.

## Assets

- **Fonts:** Inter and Noto Sans Bengali via Google Fonts. Move to `next/font` in the real app.
- **Icons:** Lucide 0.454.0 → use `lucide-react`.
- **Images:** all product photography in the prototype is a drop-slot placeholder (`image-slot.js`). No real assets are bundled — wire these to the existing R2 media library.
- **Logo:** `/images/logo/splaro-logo-black-premium.webp` as referenced in Settings → Brand.

## Files in this bundle

| File | What it is |
| --- | --- |
| `SPLARO Admin.dc.html` | the full design prototype — every screen, both themes |
| `support.js`, `image-slot.js` | runtime files the prototype needs to open; **not** for the repo |
| `github.md` | screen → repo-file map, and a list of APIs that exist with no UI yet |

## Known gaps — APIs with working endpoints but no screen

From `commerce-os`: Production (fabric inventory, cutting → sewing → QC batches), Delivery agents and assignments, Company/HR (employees, payroll runs, tasks), and Helpdesk tickets. All have controllers and services in `apps/api`; none have a designed screen yet.
