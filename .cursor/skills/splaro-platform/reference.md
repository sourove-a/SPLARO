# SPLARO Platform Reference

Detailed map for agents working on SPLARO-BRAND. Keep in sync with `platform-knowledge.prompt.ts`.

## Ports & URLs

| Service | Dev | Production |
|---------|-----|------------|
| Web | localhost:3000 | splaro.com.bd |
| Admin | localhost:3001 | admin.splaro.com.bd |
| API | localhost:4000/api/v1 | api.splaro.com.bd/api/v1 |

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
