# SPLARO Enterprise Architecture (Next.js App Router)

## 1. Target Stack
- Frontend + BFF: Next.js 15+ (App Router), TypeScript
- UI: Tailwind CSS + shadcn/ui style primitives
- Validation: Zod
- Auth: Auth.js (NextAuth v5) with credentials + OTP workflows
- ORM: Prisma
- DB: PostgreSQL
- Cache/Queue: Redis (Upstash/ElastiCache) + BullMQ or serverless queue
- File storage: S3/Cloudflare R2
- Payments: SSLCommerz (primary), bKash/Nagad (gateway), Stripe (optional)

## 2. Monorepo-Style Folder Structure
```txt
src/
  app/
    (store)/
      page.tsx
      shop/page.tsx
      products/[slug]/page.tsx
      cart/page.tsx
      checkout/page.tsx
      order-success/[orderId]/page.tsx
      wishlist/page.tsx
      support/page.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
      verify-otp/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      setup-2fa/page.tsx
    (dashboard)/
      user/
        page.tsx
        orders/page.tsx
        orders/[orderId]/page.tsx
        addresses/page.tsx
        wishlist/page.tsx
        returns/page.tsx
        notifications/page.tsx
        security/page.tsx
      admin/
        page.tsx
        products/page.tsx
        products/new/page.tsx
        products/[id]/edit/page.tsx
        inventory/page.tsx
        orders/page.tsx
        orders/[orderId]/page.tsx
        returns/page.tsx
        refunds/page.tsx
        users/page.tsx
        coupons/page.tsx
        campaigns/page.tsx
        reviews/page.tsx
        cms/page.tsx
        analytics/page.tsx
        settings/page.tsx
    api/
      auth/[...nextauth]/route.ts
      webhooks/payments/sslcommerz/route.ts
      webhooks/payments/stripe/route.ts
      checkout/route.ts
      payments/initiate/route.ts
      payments/verify/route.ts
      orders/route.ts
      inventory/reserve/route.ts
      returns/route.ts
      refunds/route.ts
      coupons/apply/route.ts
      reviews/route.ts
      notifications/route.ts
    sitemap.ts
    robots.ts
    layout.tsx
    globals.css
  components/
    ui/
    storefront/
    checkout/
    dashboard/
    admin/
  modules/
    auth/
    product/
    cart/
    checkout/
    payment/
    order/
    inventory/
    coupon/
    returns/
    reviews/
    notifications/
    analytics/
  lib/
    prisma.ts
    redis.ts
    env.ts
    auth.ts
    rbac.ts
    rate-limit.ts
    csrf.ts
    csp.ts
    logger.ts
    zod-schemas/
  server/
    services/
    repositories/
    jobs/
    events/
  prisma/
    schema.prisma
    seed.ts
  tests/
    unit/
    integration/
    e2e/
```

## 3. Architecture Boundaries
- `app/*`: routes + server components
- `modules/*`: domain-level business features
- `server/services/*`: pure use-cases (checkout, payment verification, refund)
- `lib/*`: cross-cutting concerns (auth, cache, security)
- `app/api/*`: thin HTTP layer only (parse, validate, call service, return response)

## 4. Core Data/Flow Principles
- Order write path is server-only (no client direct mutation)
- Inventory reservation is transactional + idempotent
- Payment marks `PAID` only from verified callback/webhook
- Admin actions always produce `AuditLog`
- Coupon/discount calculation is server-authoritative
- Review allowed only for verified buyers (delivered/completed orders)

## 5. Environments
- `development`: local Postgres + optional Redis
- `staging`: full mirror of production contracts
- `production`: managed Postgres, Redis, object storage, alerting

