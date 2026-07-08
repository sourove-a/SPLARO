# SPLARO AI Guide

Quick-start context for any AI tool. Read this before touching any file.

> **Full platform skill:** `.cursor/skills/splaro-platform/SKILL.md`  
> **In-app agent knowledge:** `apps/api/src/modules/agent/prompts/platform-knowledge.prompt.ts`  
> **Agent instructions:** `AGENTS.md`

---

## Project Overview

SPLARO is a luxury women's fashion eCommerce + SaaS platform for Bangladesh.  
Monorepo: Turborepo + PNPM workspaces.

**Live URLs (production target):**
- Web storefront: `splaro.com.bd`
- Admin dashboard: `admin.splaro.com.bd`
- API: `api.splaro.com.bd`

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend (web) | Next.js 15, TypeScript, Tailwind CSS, Framer Motion 11, Zustand |
| Admin | Next.js 15, TypeScript, Tailwind CSS, Recharts, @tanstack/react-query |
| API | NestJS 10, TypeScript, REST |
| Database | PostgreSQL 16, Prisma 5 |
| Cache/Queue | Redis 7, BullMQ |
| Auth | JWT + refresh tokens, 2FA (TOTP) |
| Storage | Cloudflare R2 (S3-compatible) |
| Search | Meilisearch (Bangla+English, typo-tolerant) |
| Payments | bKash, Nagad, SSLCommerz, COD |
| Couriers | Steadfast, Pathao, RedX, Paperfly |
| AI | OpenAI GPT-4o / GPT-4o-mini |
| Telegram | node-telegram-bot-api |
| Invoices | Puppeteer PDF + node-thermal-printer (ESC/POS) |
| Sheets | googleapis sync |
| Deploy | Hostinger VPS, PM2, Nginx, Let's Encrypt |

---

## Folder Structure

```
SPLARO-BRAND/
├── apps/
│   ├── web/          # Customer storefront (Next.js 15)
│   ├── admin/        # Admin dashboard (Next.js 15)
│   └── api/          # Backend API (NestJS 10)
├── packages/
│   ├── database/     # Prisma schema + migrations
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared config (delivery zones etc.)
├── tools/
│   ├── google-sheets-sync/
│   └── print-service/
├── infrastructure/
│   ├── nginx/
│   ├── pm2/
│   └── scripts/
├── scripts/
│   └── doctor.mjs    # Health check script
├── AI_GUIDE.md       # This file
└── README.md
```

---

## Design System (Web Storefront)

```
Background:   #FAF8F5  (ivory)
Text:         #111111  (luxury black)
Secondary:    #6B6B6B  (luxury gray)
Gold accent:  #C8A97E
Glass:        rgba(255,255,255,0.72) + backdrop-filter: blur(20px)
```

**Tailwind custom tokens (tailwind.config.ts):**
- `luxury-black`, `luxury-gray`, `luxury-border`, `luxury-glass`
- `gold`, `gold-light`, `gold-dark`
- `ivory-100`, `ivory-200`, `ivory-300`
- `shadow-luxury`, `shadow-luxury-lg`, `shadow-glass`

**CSS utility classes (globals.css):**
- `.btn-luxury` — black filled CTA button
- `.btn-luxury-outline` — bordered CTA button  
- `.btn-gold` — gold filled button
- `.glass` — glass morphism card
- `.container-luxury` — max-width 1440px with padding
- `.section-padding` — standard section vertical padding
- `.heading-editorial` — large hero heading (Cormorant Garamond)
- `.heading-xl`, `.heading-lg` — section headings
- `.label-luxury` — uppercase tracking label (11px Inter)
- `.divider-gold` — decorative gold line divider

---

## Important Commands

```bash
# Development
pnpm dev              # Run all apps
pnpm dev:web          # Web only (port 3000)
pnpm dev:admin        # Admin only (port 3001)
pnpm dev:api          # API only (port 4000)

# Type checking & linting
pnpm typecheck        # TypeScript check all
pnpm check:web        # TS + lint for web app
pnpm check:admin      # TS + lint for admin app
pnpm check:api        # TS + lint for API

# Health check
pnpm doctor           # Full project health validation

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database

# Build
pnpm build            # Build all apps
pnpm build:web        # Build web only
```

---

## Development Workflow

1. Work **one module at a time** — do not jump between modules
2. Read existing files before editing
3. Run `pnpm check:web` after changes to web
4. Never rebuild completed modules
5. Never create duplicate components
6. Keep consistent design tokens

---

## Module Completion Order

> Admin modules are wired **one at a time**. Status below reflects live API connection, not UI line count.

| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Frontend Home Page | ✅ Complete | |
| 2 | Products Admin | ✅ Live | CRUD, publish, live count |
| 3 | Orders Admin | ✅ Live | List, status, courier, permanent delete |
| 4 | Customers Admin | ✅ Live | Profile, block, force delete |
| 5 | Product Reviews | ✅ Live | Moderation + approve → storefront |
| 6 | Hero Slider / Media | ✅ Live | Upload, delete, publish |
| 7 | Returns / RMA | ✅ Live | Approve → receive → refund via API |
| 8 | Invoices | ✅ Live | List, detail, mark paid, PDF/email via API |
| 9 | Transactions | ✅ Live | List, stats, detail expand, COD confirm |
| 10 | Inventory | ✅ Live | Stock list, alerts API, variant adjust |
| 11 | Campaigns | ✅ Live | Create, send, schedule, duplicate, delete |
| 12 | Dashboard / Analytics | ✅ Live | `/admin/dashboard/stats` |
| 13 | Coupons | ✅ Live | Create, toggle, delete |
| 14 | Settings | ✅ Live | Verified save + catalog SKU policy (manual default) |
| 15 | Security (roles) | 🟡 Partial | Staff CRUD + permission matrix save to API (`siteSettings.adminRolePermissions` + `StaffRole.permissions`); API routes still enforce coarse role only (not per-module matrix) |
| 16 | Telegram Integration | ✅ Complete | |
| 17 | SEO / WMS / SaaS shells | ⬜ Preview | UI only — not daily-use ready |

**Module wiring queue complete.** SKU policy: manual by default (`catalog.autoGenerateSku: false`).

---

## Rules for Editing Files

- **TypeScript:** no `any` unless absolutely required
- **No broken imports:** verify file exists before importing
- **No duplicate components:** reuse existing ones
- **No unused variables:** will cause TS errors
- **Responsive:** every UI must work on mobile
- **Loading states:** every API call needs loading/error UI
- **Forms:** every form needs validation (react-hook-form + zod)
- **Images:** always use `next/image` with `alt`, `sizes`, and `fill`/`width`+`height`
- **SEO:** pages need `export const metadata`
- **Accessibility:** use semantic HTML, `aria-*` where needed

---

## Key Files to Know

```
apps/web/src/
  app/
    layout.tsx           # Root layout (Header + Footer + Providers)
    page.tsx             # Home page (imports all sections)
    globals.css          # CSS variables + utility classes
  components/
    layout/
      Header/            # Header.tsx + TopBar + Navigation + MobileMenu + SearchModal + CartDrawer
      Footer/            # Footer.tsx
      Providers.tsx      # Client providers wrapper
      WhatsAppButton.tsx # Fixed WhatsApp button
    home/                # All homepage sections
    product/
      ProductCard/       # Reusable product card
    ui/
      Toast/Toaster.tsx  # react-hot-toast wrapper
  store/
    cartStore.ts         # Zustand cart (persisted)
    uiStore.ts           # Zustand UI state
    wishlistStore.ts     # Zustand wishlist (persisted)
  lib/utils/
    cn.ts                # clsx + tailwind-merge
    currency.ts          # formatBDT()
  types/
    product.ts           # Re-exports from @splaro/types
```

---

## What NOT to Touch

- `packages/database/prisma/schema.prisma` — do not modify unless adding to DB module
- `infrastructure/` — do not modify unless on deployment module
- `apps/admin/` — do not modify unless on Admin module (modules 8–11)
- `apps/api/` — do not modify unless on API modules (12–16)

---

## Continuing from "next"

When the user says **"next"**, continue to the next ⬜ module in the table above.

1. Do NOT ask what to do — check this table
2. Do NOT restart from module 1
3. Do NOT rebuild completed (✅) modules
4. Read existing files first, then fix/complete
5. Reply with a short completion message only

---

## Error Checking Workflow

For each module:

```bash
pnpm check:web    # TypeScript + lint
# Fix any errors reported
pnpm build:web    # Ensure build passes
```

For API changes:
```bash
pnpm check:api
```

For full project:
```bash
pnpm doctor
```
