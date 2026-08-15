# SPLARO — Luxury Fashion & Lifestyle Platform

<div align="center">
  <img src="docs/assets/splaro-logo.png" alt="SPLARO Logo" width="200" />
  
  **The definitive luxury fashion eCommerce platform with SaaS-ready monorepo architecture for Bangladesh and international markets.**
  
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
  [![NestJS](https://img.shields.io/badge/NestJS-10-red?style=flat-square&logo=nestjs)](https://nestjs.com)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)](https://postgresql.org)
  [![Redis](https://img.shields.io/badge/Redis-7-red?style=flat-square&logo=redis)](https://redis.io)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
  [![License](https://img.shields.io/badge/License-Proprietary-gold?style=flat-square)](LICENSE)

</div>

---

## 📌 Capability Truth Registry

> **Platform Honesty Standard:** Local test passes and clean builds are not automatically claimed as "100% perfect production". All platform capabilities are classified below by their verified production readiness state:

| Status Tier | Definition |
|---|---|
| `[LIVE]` | **Production Verified** — Active UI, BFF proxy, NestJS API, PostgreSQL database, and automated tests passing. |
| `[CODED]` | **Implemented & Tested** — Fully implemented in code with unit/E2E test coverage; requires merchant API keys or active third-party provider accounts in production. |
| `[PARTIAL]` | **Partially Wired** — Core UI and backend handlers exist; background queues, crons, or dispatch triggers are undergoing staging rollout. |
| `[STUB]` | **UI Prototype / Shell** — Frontend interface or logger stub exists without live transactional execution. |
| `[PLANNED]` | **Future Roadmap** — Feature-flagged off (`FEATURE_*=false`) or planned for future multi-tenant release. |

---

## Table of Contents

- [Overview](#overview)
- [Capability Registry Summary](#capability-registry-summary)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [Features & Implementation Truth](#features--implementation-truth)
- [Bangladesh eCommerce & Fulfilment](#bangladesh-ecommerce--fulfilment)
- [In-App AI (SPLARO Command)](#in-app-ai-splaro-command)
- [Admin Operating System](#admin-operating-system)
- [Future Roadmap: SaaS & Multi-Vendor (Feature Flagged)](#future-roadmap-saas--multi-vendor-feature-flagged)
- [Design System & Tokens](#design-system--tokens)
- [Database Schema (Prisma)](#database-schema-prisma)
- [API Modules](#api-modules)
- [Installation & Quick Start](#installation--quick-start)
- [Environment Variables](#environment-variables)
- [Deployment (Production VPS)](#deployment-production-vps)
- [Target Performance SLAs](#target-performance-slas)
- [Contributing & License](#contributing--license)

---

## Overview

SPLARO is a quiet-luxury lifestyle brand for the Bangladesh market with international reach — Men, Women, Kids, Footwear, and Accessories. The platform is engineered to the standard of an enterprise agency build, combining the editorial elegance of luxury fashion houses, fluid usability, and conversion-focused checkout infrastructure.

- **Brand Positioning:** Quiet luxury fashion house.
- **Current Operational Mode:** Single-tenant luxury brand storefront (`splaro.co`) + centralized Admin OS (`admin.splaro.co`).
- **Monorepo Architecture:** Turborepo with Next.js 15 App Router storefront/admin, NestJS 10 backend API, PostgreSQL 16 via Prisma, Redis 7, and BullMQ async queues.

---

## Capability Registry Summary

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SPLARO CAPABILITY TRUTH MATRIX                       │
├────────────────────────────────────────┬───────────┬───────────────────┤
│ Domain / Feature                       │ Status    │ Verification Note │
├────────────────────────────────────────┼───────────┼───────────────────┤
│ Storefront Catalog & Liquid Glass UI   │ [LIVE]    │ Next.js 15 App Router │
│ Cash on Delivery (COD) Checkout Flow   │ [LIVE]    │ Zone recalculation │
│ Admin Operating System (45+ Screens)  │ [LIVE]    │ Bespoke React Query │
│ Direct Invoicing & PDF/Print (SPL-###) │ [LIVE]    │ Puppeteer/A4 + URL │
│ 1-Click Filtered CSV Data Exports     │ [LIVE]    │ All admin data tables │
│ Partner Capital Ledger & Daily Closing │ [LIVE]    │ Financial hisab   │
│ In-App AI Assistant (SPLARO Command)   │ [LIVE]    │ OpenAI GPT-4o-mini│
│ Steadfast Courier API Integration      │ [CODED]   │ Key/webhook ready │
│ Online Payments (bKash/Nagad/SSL)      │ [CODED]   │ Signature & IPN ready │
│ SMS Notifications (BDBulkSMS/SSL)      │ [CODED]   │ Templates & client│
│ Automation Rules Engine (Core Events)  │ [PARTIAL] │ 4 live, crons staged │
│ Thermal ESC/POS Print Daemon (USB)     │ [CODED]   │ Node service ready│
│ Multi-Tenant Vendor Marketplace        │ [PLANNED] │ Flagged off (v2)  │
│ Custom Store Domains per Tenant        │ [PLANNED] │ Flagged off (v2)  │
│ Customer Loyalty Points Engine         │ [PLANNED] │ Flagged off (v2)  │
└────────────────────────────────────────┴───────────┴───────────────────┘
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                            SPLARO PLATFORM                             │
├───────────────────┬───────────────────┬───────────────┬────────────────┤
│   WEB (Next.js 15)│  ADMIN (Next.js 15)│  API (NestJS) │ WORKER (BullMQ)│
│   Port 3000       │   Port 3001       │   Port 4000   │ Background Jobs│
├───────────────────┴───────────────────┴───────────────┴────────────────┤
│                           SHARED PACKAGES                              │
│       @splaro/database  │  @splaro/ui  │  @splaro/types  │  @splaro/config  │
├────────────────────────────────────────────────────────────────────────┤
│                          INFRASTRUCTURE                                │
│   PostgreSQL 16  │  Redis 7  │  Cloudflare R2  │  BullMQ  │  PM2  │ Nginx│
├────────────────────────────────────────────────────────────────────────┤
│                          INTEGRATIONS                                  │
│   bKash │ Nagad │ SSLCommerz │ Steadfast │ Pathao │ RedX               │
│   Google Sheets │ Telegram Bot │ SMS │ SMTP │ OpenAI GPT-4o-mini       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
SPLARO-BRAND/
├── apps/
│   ├── web/                           # [LIVE] Storefront Next.js 15 App Router
│   │   ├── src/app/                   # Routes (shop, PDP, cart, checkout, account)
│   │   ├── src/components/            # Luxury UI, HeroSlider, Header, Navigation
│   │   └── src/lib/                   # BFF proxies, cart store, catalog SSR
│   ├── admin/                         # [LIVE] Admin Dashboard Next.js 15
│   │   ├── src/app/dashboard/         # 45+ bespoke admin screens
│   │   ├── src/components/dc/         # Orders, Catalog, Finance, WMS, Security
│   │   └── src/lib/api/               # React Query client & proxy adapters
│   └── api/                           # [LIVE] NestJS 10 REST API
│       ├── src/modules/               # Auth, Orders, Catalog, Courier, Payments, AI
│       └── src/common/                # Guards, interceptors, Redis locks, filters
├── packages/
│   ├── database/                      # [LIVE] Prisma schema, migrations, seed
│   ├── types/                         # [LIVE] Shared TypeScript interfaces
│   ├── config/                        # [LIVE] Delivery zones, feature flags, constants
│   └── ui/                            # [LIVE] Shared styling tokens & design primitives
├── infrastructure/                    # Nginx configs, PM2 ecosystem, Docker, VPS scripts
├── tools/                             # Local thermal print bridge & MCP server
└── docs/                              # Audit reports, deployment guides, release logs
```

---

## Tech Stack

| Layer | Technology | Status | Role |
|-------|-----------|--------|------|
| **Storefront** | Next.js 15 (App Router) | `[LIVE]` | Customer storefront with SSR, ISR, and React Server Components |
| **Admin OS** | Next.js 15 | `[LIVE]` | High-density admin console with dark mode design tokens |
| **Backend API** | NestJS 10 | `[LIVE]` | Enterprise REST API server at `/api/v1` |
| **Database** | PostgreSQL 16 | `[LIVE]` | Relational store with ACID transactions |
| **ORM** | Prisma 5 | `[LIVE]` | Type-safe migrations and client generation |
| **In-Memory Store** | Redis 7 | `[LIVE]` | Session caching, distributed locks, rate limiting, and presence |
| **Background Queues** | BullMQ | `[LIVE]` | Asynchronous job dispatch and retry processor |
| **State Management** | Zustand + TanStack Query | `[LIVE]` | Client store hydration and server state caching |
| **Authentication** | JWT + Refresh Cookie + GIS | `[LIVE]` | Secure BFF auth, Google Identity Services, and Telegram 2FA |
| **Media Storage** | Cloudflare R2 / Local CDN | `[LIVE]` | WebP media storage and optimized CDN delivery |
| **AI Engine** | OpenAI GPT-4o-mini | `[LIVE]` | SPLARO Command agent, SEO auto-generation, copywriting |
| **Process Manager** | PM2 | `[LIVE]` | Zero-downtime cluster process orchestration on Linux VPS |
| **Reverse Proxy** | Nginx + Let's Encrypt SSL | `[LIVE]` | SSL termination, security headers, and reverse proxy routing |

---

## Features & Implementation Truth

### Customer-Facing Storefront
- `[LIVE]` **Hero Cinematic Slider**: Responsive WebP source delivery with mobile/desktop renditions and native scroll performance.
- `[LIVE]` **Catalog & PDP**: Size swatches, color selectors, liquid-glass visual chips, and image zoom modal.
- `[LIVE]` **Cart & Checkout**: Persistent Zustand cart with server hydrator, guest checkout, and same-tap mobile visual viewport bar.
- `[LIVE]` **Public Order Tracking**: Instant order status verification via order ID (`SPL-####`) and phone number.
- `[LIVE]` **Customer Accounts**: Order history, saved addresses, wishlist, and profile settings.
- `[LIVE]` **Google 1-Click Sign-In**: Official Google Identity Services (GIS) integration without cross-origin redirects.

---

### Bangladesh eCommerce & Fulfilment
- `[LIVE]` **Cash on Delivery (COD)**: Fully automated checkout calculation with server-enforced delivery charge (Inside Dhaka: ৳60 / Outside Dhaka: ৳120).
- `[CODED]` **Online Payment Gateways**: bKash, Nagad, and SSLCommerz API clients with callback signature validation (ready for production merchant keys).
- `[CODED]` **Steadfast Courier Integration**: Automatic consignment booking, tracking code attachment, and webhook synchronizer (dev stubs reject fake bookings).
- `[CODED]` **Pathao & RedX Adapters**: Courier abstraction interface implemented for multi-provider routing.
- `[LIVE]` **Invoice Generation & Printing**: Standard A4 invoice and URL printable slips (`/invoices/SPL-####`).
- `[CODED]` **Thermal 80mm Receipt Printing**: ESC/POS thermal receipt formatting via print queue service.

---

### In-App AI (SPLARO Command)
- `[LIVE]` **AI Command Brain**: In-app AI operations chat with GPT-4o-mini, platform knowledge prompt injection, and read/write tool tiers.
- `[LIVE]` **AI Cost Control**: Daily budget limit enforcement (`AGENT_DAILY_COST_LIMIT_USD`) and token tracking.
- `[LIVE]` **AI Copywriting & SEO**: 1-click dual English/Bangla product description and meta tag generator.
- `[PARTIAL]` **AI Abandoned Cart Recovery**: Copywriting templates ready; scheduled cron queue in staging verification.

---

### Admin Operating System (45+ Screens)
- `[LIVE]` **Honest Feedback UI**: Full removal of fake saves; `toastOk` and `toastApiSaved` fire **only** on verified `res.ok` server persistence.
- `[LIVE]` **WMS & Stock Movement**: Track sellable, reserved, and damaged inventory across 9 movement transaction types.
- `[LIVE]` **Procurement & Goods Received (GRN)**: Purchase order creation, supplier accounts, and 1-click stock increment upon GRN filing.
- `[LIVE]` **Partner Capital Ledger**: Partner hub recording investments, withdrawals, and profit hisab.
- `[LIVE]` **Security Center**: Threat monitoring, active device session killswitch, and audit logs.
- `[LIVE]` **1-Click CSV Exports**: Comprehensive CSV downloads across Orders, Products, Customers, Inventory, WMS Movements, POs, Wholesale Leads, Admin Users, and Security Logs.

---

## Future Roadmap: SaaS & Multi-Vendor (Feature Flagged)

> **Notice:** SPLARO is deployed as a single-brand luxury eCommerce platform. Multi-tenancy and third-party vendor features are architecturally scaffolded in schema models but **feature-flagged off** for the v1 retail release.

```env
# Feature Flags (packages/config/src/feature-flags.ts)
FEATURE_SAAS_ENABLED=false       # [PLANNED] Multi-tenant subscription management
FEATURE_VENDOR_ENABLED=false     # [PLANNED] Vendor marketplace & multi-seller portal
FEATURE_LOYALTY_ENABLED=false    # [PLANNED] Customer loyalty tier point system
```

**Planned for Future Release:**
- Vendor sub-dashboards and product submission workflow.
- Automated multi-vendor commission calculation and payout statements.
- Custom domain routing per tenant (`*.splaro.co`).

---

## Design System & Tokens

SPLARO uses bespoke design tokens for editorial luxury presentation:

```css
/* Core Color Tokens */
--color-bg-primary:     #FAF8F5;  /* Luxury Ivory */
--color-text-primary:   #111111;  /* Rich Black */
--color-accent-gold:    #C8A97E;  /* Signature Gold */
--color-glass:          rgba(255,255,255,0.72);
--color-surface:        #FFFFFF;
--color-dark-bg:        #111111;  /* Editorial Dark */

/* Typography Scale */
--font-serif:           'Cormorant Garamond', Georgia, serif;
--font-sans:            'Inter', -apple-system, sans-serif;
```

---

## Database Schema (Prisma)

The PostgreSQL database schema contains 25+ relational models:

| Category | Models |
|---|---|
| **Identity & Access** | `User`, `Role`, `StaffRole`, `AuditLog`, `SecuritySession` |
| **Catalog** | `Product`, `ProductVariant`, `ProductImage`, `Category`, `Collection`, `Review` |
| **Commerce & Fulfilment** | `Order`, `OrderItem`, `Payment`, `CourierShipment`, `Invoice`, `Coupon` |
| **Customer CRM** | `Customer`, `Address`, `Wishlist`, `CartSession`, `WholesaleInquiry` |
| **WMS & Procurement** | `Warehouse`, `StockMovement`, `PurchaseOrder`, `GoodsReceivedNote`, `Supplier` |
| **Finance** | `PartnerAccount`, `PartnerTransaction`, `DailyClosing`, `Expense` |
| **System & Media** | `MediaAsset`, `MediaFolder`, `SiteSettings`, `Banner`, `Notification` |

---

## API Modules

All API endpoints are prefixed with `/api/v1` and protected by JWT guards, RBAC, and rate limiters:

```
/api/v1/auth          → Customer and Admin authentication
/api/v1/storefront    → Public storefront catalog, cart, and checkout BFF
/api/v1/products      → Product catalog and variant management
/api/v1/categories    → Hierarchical category tree
/api/v1/orders        → Order fulfillment pipeline and status transitions
/api/v1/courier       → Steadfast API booking and webhook sync
/api/v1/payments      → bKash, Nagad, SSLCommerz IPN handlers
/api/v1/wms           → Warehouse stock tracking and transfers
/api/v1/procurement   → Purchase orders and Goods Received Notes
/api/v1/finance       → P&L, partner capital accounts, and daily closing
/api/v1/agent         → SPLARO Command AI brain and audit logs
/api/v1/security      → Device session revocation and audit events
```

---

## Installation & Quick Start

### Prerequisites
- Node.js `18.18+` or `20.x`
- PNPM `9.x`
- PostgreSQL `16`
- Redis `7`

### Local Setup

```bash
# 1. Clone repository
git clone https://github.com/sourove-a/SPLARO.git
cd SPLARO

# 2. Install monorepo dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env

# 4. Generate Prisma Client & Run Migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed Catalog & Admin Data
pnpm db:seed

# 6. Start Full Local Stack (Web :3000, Admin :3001, API :4000)
pnpm dev:stack
```

---

## Environment Variables

Key configuration variables in root `.env`:

```env
# Database & Redis
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/splaro_db?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
REDIS_ENABLED="true"

# Security & Sessions
ADMIN_SESSION_SECRET="your-super-secret-admin-session-key-min-32-chars"
ENCRYPTION_KEY="your-hex-encoded-32-byte-encryption-key"
CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://splaro.co,https://admin.splaro.co"

# Third-Party Integrations
STEADFAST_API_KEY=""
STEADFAST_SECRET_KEY=""
BKASH_APP_KEY=""
BKASH_APP_SECRET=""
BKASH_USERNAME=""
BKASH_PASSWORD=""
OPENAI_API_KEY="sk-..."
TELEGRAM_BOT_TOKEN=""
```

---

## Deployment (Production VPS)

- **Target Host:** Ubuntu 22.04 LTS VPS (Hostinger / Custom Cloud).
- **Process Orchestration:** PM2 cluster with Nginx reverse proxy.
- **CI/CD:** Automated via `.github/workflows/deploy-vps.yml` triggering `/opt/splaro/deploy.sh` on push to `main`.

```bash
# Verify all quality gates before deployment
pnpm ci:verify
```

---

## Target Performance SLAs

*Engineering benchmarks and targets for production monitoring:*

| Metric | Target SLA | Strategy |
|---|---|---|
| **Lighthouse Score** | 90+ | SSR/ISR caching, WebP hero optimization |
| **Largest Contentful Paint (LCP)** | < 2.5s | Preloaded self-hosted fonts, responsive picture tags |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Explicit image aspect ratios and skeleton fallbacks |
| **API Response Time (p95)** | < 150ms | Redis cache, Prisma indexed lookups |
| **Checkout Flow Error Rate** | < 0.1% | Transactional isolation and client-side retry locks |

---

## Contributing & License

Copyright © 2026 SPLARO. All rights reserved.  
This codebase is proprietary and confidential. Unauthorized copying, distribution, or public deployment is strictly prohibited.
