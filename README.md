# SPLARO

SPLARO is a luxury footwear and bags ecommerce platform running on **Next.js 15 App Router + TypeScript + MySQL**.

- Live: [https://splaro.co](https://splaro.co)
- Runtime: Next.js route handlers (Node), no Vite runtime, no PHP runtime dependency
- Storage: MySQL (Hostinger), Prisma-ready schema and utilities

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **UI:** React, Tailwind-style utility classes, Framer Motion
- **Data:** MySQL (`mysql2`), Prisma schema/migrations
- **Integrations:** SMTP (Nodemailer), Telegram, Google Sheets webhook
- **Auth/Session:** Cookie + DB backed flows for admin/user panels

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env.local
```

3. Prisma setup

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Start development

```bash
npm run dev
```

5. Build and run production

```bash
npm run build
npm run start
```

## Production Migration Notes (Vite/PHP -> Next)

The project is now organized for **pure Next.js runtime**:

- `app/layout.tsx` provides global shell and runtime bootstrapping.
- `app/[[...slug]]/page.tsx` mounts the client storefront/admin shell.
- `app/api/**/route.ts` provides all API handlers (including legacy compatibility endpoint `/api/index.php?action=...`).
- Existing PHP files are retained only as legacy reference artifacts and are not required for Next runtime.

## Folder Structure

```text
.
├── app/
│   ├── [[...slug]]/page.tsx         # Catch-all storefront/admin entry
│   ├── api/
│   │   ├── index.php/route.ts       # Legacy action compatibility on Next
│   │   ├── health/route.ts
│   │   ├── status/route.ts
│   │   ├── auth/login/route.ts
│   │   ├── auth/signup/route.ts
│   │   ├── orders/route.ts
│   │   ├── orders/[order_no]/route.ts
│   │   ├── products/route.ts
│   │   ├── products/[slug]/route.ts
│   │   ├── subscribe/route.ts
│   │   └── admin/**/route.ts        # Admin APIs (metrics, users, orders, products, settings, etc.)
│   ├── globals.css
│   └── layout.tsx
├── components/                      # UI components (storefront + admin)
├── lib/                             # DB, auth, cache, validators, mailer, telegram, helpers
├── prisma/                          # Prisma schema, migrations, seed
├── public/                          # Static assets (icons, logos, images)
├── docs/                            # Ops and architecture docs
├── middleware.ts                    # Admin API protection middleware
├── next.config.ts
├── tsconfig.json
└── package.json
```

## API Compatibility

For zero-breaking migration of existing frontend logic:

- Legacy-style actions are supported through:
  - `GET/POST /api/index.php?action=<action_name>`
- New route-handler endpoints are also available:
  - `/api/auth/signup`
  - `/api/auth/login`
  - `/api/orders`
  - `/api/order` (alias)
  - `/api/subscribe`
  - `/api/admin/...`
  - `/api/health`, `/api/status`

## Environment

Use `.env.example` as canonical reference.

Key groups:
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or `DB_PASSWORD_URLENC`)
- Security/Admin: `ADMIN_KEY`, `APP_AUTH_SECRET`
- Mail: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Sheets: `GOOGLE_SHEETS_WEBHOOK_URL` (+ optional OAuth vars)
- Frontend runtime: `NEXT_PUBLIC_*`

## Contributing

1. Create a branch from `main`
2. Keep changes scoped and additive
3. Run `npm run build` before PR
4. Include verification steps and API/UI impact notes

## License

No open-source license is declared in this repository yet.
All rights reserved unless a `LICENSE` file is added by the owner.
