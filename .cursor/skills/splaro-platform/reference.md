# SPLARO Platform Reference

Detailed map for agents working on SPLARO-BRAND. Keep in sync with `platform-knowledge.prompt.ts`.

## Ports & URLs

| Service | Dev | Production |
|---------|-----|------------|
| Web | localhost:3000 | splaro.co |
| Admin | localhost:3001 | admin.splaro.co |
| API | localhost:4000/api/v1 | api.splaro.co/api/v1 |

Env: `.env.example` — never commit real secrets.

## Package scripts (root)

```bash
pnpm dev:stack      # Recommended full dev
pnpm dev:web        # Storefront only
pnpm dev:admin      # Admin only
pnpm dev:api        # API only
pnpm db:migrate     # Prisma migrate
pnpm db:seed        # Seed data
pnpm telegram:configure
pnpm doctor         # Health check
pnpm css:fix        # Clear Next cache if CSS breaks
```

## API modules (`apps/api/src/modules/`)

| Module | Purpose |
|--------|---------|
| storefront | Public catalog, cart, checkout orders |
| orders, products, customers | Admin CRUD |
| courier | Steadfast, Pathao, RedX, Paperfly + BullMQ retry |
| payments | bKash, Nagad, SSLCommerz, COD |
| agent | AI chat SSE, config, Telegram webhook |
| telegram | Order bot, notifications |
| integrations | Encrypted credential storage |
| notifications | Admin Telegram hub, email |
| google-sheets, google-workspace | Sheets sync |
| seo, marketing, finance, automation | Growth & ops |

## Order statuses

`PENDING` → `CONFIRMED` → `PROCESSING` → `PACKED` → `COURIER_BOOKED` → `SHIPPED` → `DELIVERED`

Also: `CANCELLED`, `RETURNED`, `REFUNDED`

**Mutations:** always `OrderStatusService.applyStatusChange` (admin + AI). Transitions in `common/order-status.util.ts`. Race-safe via `updateMany` matching previous status.

## Invoice Print / PDF

| Item | Path / rule |
|------|-------------|
| Admin actions | `apps/admin/src/lib/admin/admin-actions.ts` |
| BFF proxy | `apps/admin/src/lib/api/proxy-invoice.ts` → `/api/orders/:ref/invoice(/print\|/pdf)` |
| API | `GET admin/orders/:id/invoice*` — `:id` = cuid **or** `SPL-####` |
| Brand constants | `packages/config/src/splaro-invoice-brand.ts` — never localhost in footer |
| Puppeteer PDF | `invoice.service.ts` — Mac/Linux/Windows Chrome|Edge paths; missing Chrome → 503 + Print fallback |

Do not: `window.open(..., 'noopener')` for blank docs; await-then-open; put cuid in invoice URLs when `SPL-` number exists.

## Agent tools

| Tool | Use when |
|------|----------|
| get_store_analytics | Revenue, orders today/week/month |
| get_order_list | List/filter orders |
| get_low_stock_products | Stock alerts |
| get_seo_gaps | Missing meta fields |
| get_top_customers | VIP buyers |
| get_admin_health_report | "problem ki", full diagnostic |
| get_integration_status | Courier/payment/Telegram/OpenAI connectivity |
| get_api_route_health | Which endpoints fail |
| get_store_health | Quick KPI snapshot |
| create_product_draft / update_product | Catalog changes |
| send_telegram_message | Notify admin on Telegram |

## Admin auth

- Cookie: `splaro_admin_session`
- Login: `apps/admin/src/app/login/page.tsx`
- Env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
- API guard: `apps/api/src/common/auth/admin-auth.guard.ts`

## Web customer auth (separate)

- File-based dev auth: `apps/web/.data/splaro/`
- Lib: `apps/web/src/lib/server/auth.ts`
- Storefront API customer: Prisma-backed via `/storefront/customer/*`

## Design tokens (web)

- Background: `#FAF8F5` | Text: `#111111` | Gold: `#C8A97E`
- Logo: `apps/web/src/components/brand/SplaroBrandLogo.tsx`
- Utilities: `.btn-luxury`, `.glass`, `.container-luxury` in `globals.css`

## Key file index

| Concern | Path |
|---------|------|
| Prisma schema | `packages/database/prisma/schema.prisma` |
| Admin nav | `apps/admin/src/lib/navigation/admin-nav.ts` |
| Module components | `apps/admin/src/lib/modules/registry.ts` |
| Admin API client | `apps/admin/src/lib/api/` |
| Agent controller | `apps/api/src/modules/agent/agent.controller.ts` |
| Agent system prompt | `apps/api/src/modules/agent/prompts/` |
| Admin toasts | `apps/admin/src/lib/admin/feedback.ts` |
| Dev stack script | `scripts/dev-stack.mjs` |
| Process kill / ports | `scripts/port-utils.mjs`, `spawn-utils.mjs` (`killProcessTree`) |
| Order status shared | `apps/api/src/modules/orders/order-status.service.ts` |
| Invoice brand | `packages/config/src/splaro-invoice-brand.ts` |
| Prod env gate | `scripts/validate-production-env.mjs` |

## Integration env vars (names only)

**Courier:** `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`, `PATHAO_*`, `REDX_*`, `COURIER_DEV_STUB`

**Payment:** `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, `PAYMENT_DEV_STUB`

**AI:** `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `GEMINI_*`

**Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_USER_ID`, `TELEGRAM_WEBHOOK_SECRET`

**Core:** `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORE_ID`

## Common fixes

| Symptom | Fix |
|---------|-----|
| Admin empty / actions fail | Run `pnpm dev:stack`, check `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` |
| Courier green but no real booking | Add real Steadfast keys; restart API |
| OpenAI 403 model | Use `gpt-4o-mini`; check project model access |
| Agent doesn't understand Banglish | Platform knowledge is in `platform-knowledge.prompt.ts` — restart API |
| CSS broken in admin | `pnpm css:fix` + restart |
| Windows `db:*` / `doctor` fails | Use cross-platform scripts (`db-run.mjs`, `spawn-utils.mjs`) — no bash needed |
| Windows port stuck / Ctrl+C zombies | `pnpm dev:reset` + `taskkill /T` via `killProcessTree` — do not remove `/T` |
| Windows scroll hang | `windows-native-scroll-script.ts` clears Lenis lock at boot |
| Print/PDF “does nothing” | Popup blocked or `noopener` null — sync `window.open` first; see SKILL invoice rules |
| Invoice footer `www.localhost` | Brand host sanitizer in `splaro-invoice-brand.ts` — restart API after fix |
| Simulated courier shows BOOKED | Must not persist — check `courier.service.ts` simulated gate |
| Double Steadfast booking | Redis lock fallthrough — never local-lock when Redis ready |
| PDP sticky covers footer | Hide floating buy bar when `footer.site-footer` enters viewport — do **not** edit footer files |
| Click miss while scrolling | `LenisPointerGuard` freezes inertia only on interactive targets — do not remove |
| Overlay still scrolls / dead click after modal | Use `uiStore.acquireScrollLock` / `releaseScrollLock` (not only `body.overflow=hidden`); Size Guide must not depend on unstable `onClose` identity |
| Size Guide leaves wrong chart | Modal is category-aware via `resolveSizeGuideKey` — footwear vs apparel |
| Native scrollIntoView + Lenis | Use `lenis.scrollTo(element)` on PDP — `scrollIntoView` desyncs virtual scroll |
