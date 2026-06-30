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

| # | Module | Status |
|---|---|---|
| 1 | Frontend Home Page | ✅ Complete |
| 2 | Product Listing Page | ⬜ Next |
| 3 | Product Details Page | ⬜ |
| 4 | Cart | ⬜ |
| 5 | Checkout | ⬜ |
| 6 | Customer Auth | ⬜ |
| 7 | Customer Account | ⬜ |
| 8 | Admin Dashboard | ⬜ |
| 9 | Products Admin | ⬜ |
| 10 | Orders Admin | ⬜ |
| 11 | Customers Admin | ⬜ |
| 12 | Courier Automation | ⬜ |
| 13 | Telegram Integration | ✅ Complete |
| 14 | SEO Engine | ⬜ |
| 15 | AI Agent | ⬜ |
| 16 | Settings | ⬜ |
| 17 | Final Build & Deployment | ⬜ |

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
