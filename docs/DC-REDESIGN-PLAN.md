# SPLARO Admin — design port status & plan

Source of truth: `design_handoff_splaro_admin/SPLARO Admin.dc.html`
(Claude Design project `2c9582a2-d19f-4150-92f8-c1df573f836c`).

Rule for every screen on this list: **the layout comes from the design, every number
comes from an endpoint.** If an endpoint does not exist, the screen says so — it
does not draw a plausible number.

---

## Where each section stands

`DC` = rebuilt to the design, wired to real endpoints.

All 40 sections carry the DC body. The twelve rebuilt most recently have also
been rendered and measured in a browser; the rest are gate-verified only. See
"What is left" at the end of this file.

| # | Section | State |
|---|---|---|
| 1 | Dashboard | **DC** |
| 2 | Orders | **DC** |
| 3 | Products | **DC** |
| 4 | Packing Station | **DC** |
| 5 | Partner Hub | **DC** |
| 6 | Customers | **DC** |
| 7 | Courier Hub | **DC** |
| 8 | Daily Closing | **DC** |
| 9 | Settings | **DC** (chrome + rail; the 11 section forms are the existing wired ones) |
| 10 | Mobile screens | **DC** |
| 11 | Export Center | **DC** |
| 12 | Product Reviews | **DC** |
| 13 | Collections | **DC** |
| 14 | Categories | **DC** |
| 15 | Inventory | **DC** |
| 16 | Bulk & CSV | **DC** (dry-run preview then apply, stock/price/publish) |
| 17 | Returns / RMA | **DC** |
| 18 | Operations Hub | **DC** (aggregates 5 ops feeds, degrades per-feed) |
| 19 | Warehouse & Stock | **DC** |
| 20 | Purchase Orders | **DC** (also serves Procurement Hub / Suppliers / Goods Received) |
| 21 | Finance Overview | **DC** |
| 22 | Profit & Loss | **DC** |
| 23 | Analytics | **DC** |
| 24 | Campaigns | **DC** |
| 25 | Coupons | **DC** |
| 26 | Home Page | **DC** |
| 27 | Hero Slider | **DC** |
| 28 | Media Library | **DC** |
| 29 | Menu Control | **DC** |
| 30 | Legal Pages | **DC** |
| 31 | All Integrations | **DC** |
| 32 | Telegram Bot | **DC** |
| 33 | API Health | **DC** |
| 34 | SMS Center | **DC** (GSM-7 vs UCS-2 segment costing) |
| 35 | Google Sheets | **DC** (also serves Google Sheets Finance) |
| 36 | AI Command Brain | **DC** |
| 37 | SEO Health | **DC** |
| 38 | Automation Rules | **DC** |
| 39 | Security Center | **DC** |
| 40 | Admin Users | **DC** |

**40 done · 0 to go.**

---

## Batches

Each batch: build the designed body, wire it to the real endpoints, then walk the
screen in the browser and fix what is off.

- **B1 — Catalog:** ~~Collections~~, ~~Categories~~, ~~Inventory~~, ~~Bulk & CSV~~
- **B2 — Commerce & Operations:** ~~Returns / RMA~~, ~~Operations Hub~~, ~~Warehouse & Stock~~, ~~Purchase Orders~~
- **B3 — Finance & Analytics:** ~~Finance Overview~~, ~~Profit & Loss~~, ~~Analytics~~
- **B4 — Content:** ~~Home Page~~, ~~Hero Slider~~, ~~Media Library~~, ~~Menu Control~~, ~~Legal Pages~~
- **B5 — Integrations:** ~~All Integrations~~, ~~Telegram Bot~~, ~~API Health~~, ~~SMS Center~~, ~~Google Sheets~~
- **B6 — Intelligence & Security:** ~~AI Command Brain~~, ~~SEO Health~~, ~~Automation Rules~~, ~~Security Center~~, ~~Admin Users~~
- **B7 — Marketing:** ~~Campaigns~~, ~~Coupons~~
- **B8 — Write flows, end to end:** add product, create order, customer record,
  Settings → SMTP send-test, packing scan, daily-close lock, partner transaction

---

## Known gaps with no endpoint behind them

These are the only places the design asks for something the API cannot answer.
None of them are faked; each screen states the gap where the number would go.

| Design element | Missing endpoint |
|---|---|
| Dashboard daily revenue goal + progress bar | no target is stored anywhere |
| Dashboard conversion rate and visitor count | needs GA4 sessions |
| Revenue chart / KPI sparklines | render only when `GET /profit-loss/monthly` returns `timeline` |
| ~~Bulk price update~~ | `POST /admin/products/bulk/price` does exist — wired in Bulk & CSV |

---

## Verification

Six gates, all wired to scripts:

```bash
pnpm typecheck && pnpm verify:css && pnpm css:health \
  && pnpm check:admin-auth-contrast && pnpm check:admin-tables
```

plus `eslint src` and a production `next build`.

Rendering is checked through the dev-only harness at `/dev-preview/screens` —
see "What is left" below for what that does and does not cover.

---

## Endpoints with no UI behind them

Scanned `src/lib/api/*` for exported functions never called from any component
or hook. These are working endpoints the admin cannot reach.

**Wired this pass**

| Function | Now reachable from |
|---|---|
| `createCollection` | Collections → New collection |
| `updateCollection` (name/desc/image) | Collections → Edit |
| `createCategory` | Categories → New category |
| `deleteCategory` | Categories → row delete, with a confirm |
| `reorderCategories` | Categories → row up/down arrows |
| `bookCourierShipment` | Courier Hub → per-row **Book**, confirmed first |
| `retryCourierShipment` | Courier Hub → per-row **Retry** and the failed-booking card |

**Still unreachable — 20**

| Area | Functions | Lands on |
|---|---|---|
| Integrations | `fetchPaymentIntegrations`, `updatePaymentIntegration`, `testPaymentIntegration`, `fetchInfrastructureConfig`, `updateInfrastructureConfig`, `testInfrastructureIntegration`, `fetchAiIntegration`, `testAiIntegration` | B5 — All Integrations |
| Telegram | `updateTelegramIntegration`, `testTelegramIntegration`, `fetchTelegramHealth`, `generateTelegramLinkToken`, `unlinkTelegramAdmin` | B5 — Telegram Bot |
| Google Workspace | `fetchGoogleOAuthUrl`, `fetchGoogleAuditLogs` | outside the 40-section nav |
| Finance | `fetchPartners`, `seedPartners`, `fetchPartnerBySlug`, `fetchAIJobs` | B3 — Partner/Finance detail |
| Products | `generateProductSkus` | B8 — product add flow |

B5 shipped and cleared the Integrations and Telegram rows above. The scan that
produced "20" only treated `hooks.ts` as a caller and missed `integration-hooks.ts`;
the real remaining count after B5 was 7, and those were wired in the same pass.

---

## What is left

Construction is done — every section on the table above has the DC body and reads
a real endpoint. What has **not** happened:

1. **Screens have now been rendered and looked at.** `/dev-preview/screens` is a
   dev-only harness (404 in production — verified against a real production
   server) that mounts one DC screen at a time against a seeded, network-less
   QueryClient. It is not an auth bypass: it lives outside `/dashboard`, reads
   no session and calls no API. `?sweep=1` walks all twelve screens measuring
   layout after paint; `?state=live|empty|error` exercises the module states.

   Result: 12/12 render with no crash and no page-level horizontal overflow at
   375px and at 1275px, and 12/12 render their error state without crashing.
   The sweep found one real crash — `DcWarehouseStock` dereferenced
   `transfer.fromWarehouse.name` unguarded; the API does include that relation,
   so it was a fixture gap, but the screen is now hardened so a dropped
   `include` degrades to "unknown warehouse" instead of white-screening.

   Still not covered: the 28 older DC screens are not in the harness, and no
   pixel comparison against the prototype has been done — this checks that the
   screens render correctly, not that they are pixel-identical to the design.

2. ~~**Mobile.**~~ Fixed. Every DC table now sits in an `overflowX: 'auto'`
   container with a `minWidth`, and grid tracks wider than 240px are clamped
   with `minmax(min(Npx, 100%), 1fr)`. Measured in a browser at 375px: an
   unwrapped table pushed its card to 902px scrollWidth, wrapped it is 357px and
   the inner container scrolls. At 320px the unclamped grid overflowed
   (330 > 304); clamped it does not. `pnpm check:admin-tables` holds the line.
3. **One open design conflict.** The prototype has exactly one `box-shadow` —
   `rgba(113,46,255,.28) 0 8px 24px` on the Ask SPLARO button — which is
   precisely what the "no box-shadows anywhere" rule says to remove. It is
   currently removed. The prototype and the rule disagree; the rule won.
