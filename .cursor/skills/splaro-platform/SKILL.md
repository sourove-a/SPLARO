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
| Domain | splaro.com.bd |
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
- Module registry: `apps/admin/src/lib/modules/registry.ts`

Key routes: `/dashboard/orders`, `/dashboard/products`, `/dashboard/ai-agent`, `/dashboard/telegram-bot`, `/dashboard/all-integrations`

## Admin feedback (toasts)

Use `apps/admin/src/lib/admin/feedback.ts`:
- `toastApiSaved` — green, only after API PATCH verified (`settings-save.ts`)
- `toastOk` — green, verified success
- `toastFail` — red, real error (use when API offline or save fails)
- `toastWarn` — amber, partial/dev/local-only
- `notifySaved` in admin-actions — **deprecated**, shows amber "local only"

Never show green success when API didn't really succeed (especially settings, courier with placeholder keys).

## Courier honesty

- Steadfast keys in `.env`: `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`
- Placeholder keys → booking fails (not fake success)
- `COURIER_DEV_STUB=true` → simulated only
- Code: `apps/api/src/modules/courier/`, UI: `OrdersPanel.tsx`

## AI agent (in-app)

- SPLARO Command: `apps/api/src/modules/agent/`
- System prompt: `prompts/system.prompt.ts` + immutable `platform-knowledge.prompt.ts`
- Admin UI: `AgentShell` (global FAB) + `/dashboard/ai-agent`
- Tools must be called for live data — never invent order counts

## User intent (Banglish)

| User says | Meaning / action |
|-----------|------------------|
| ordar / order | Order module or API |
| courier book | POST courier endpoint |
| connection nai | Integration not configured — check env + get_integration_status |
| problem ki | Full health diagnostic |
| thik koro | Fix with real diagnosis, not guess |
| agent bujhe na | Improve prompt/tools — check platform-knowledge.prompt.ts |

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
