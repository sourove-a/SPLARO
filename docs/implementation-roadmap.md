# SPLARO Implementation Roadmap (App Router)

## Phase 1: Foundation
- Create Next.js App Router project with TypeScript and Tailwind
- Integrate Prisma client and Postgres connection
- Implement Auth.js credentials flow + OTP tables/workflows
- Add middleware guards for `/admin/*` and `/user/*`
- Implement RBAC permission helper and policy checks

## Phase 2: Catalog + Storefront
- Product/category/brand listing API and pages
- Product detail page with variant stock state
- Search/filter/sort with indexed queries
- Wishlist + recently viewed
- JSON-LD for product pages

## Phase 3: Cart + Checkout + Payment
- Guest and user cart with merge logic
- Checkout summary API (server-authoritative totals)
- Order creation with reservation lock
- SSLCommerz payment initiation and callback flow
- Webhook verification + idempotency + transaction logs

## Phase 4: Order Ops + Inventory + Notifications
- Admin order board with status transitions
- Shipment and tracking updates
- Notification fan-out (in-app/email/sms queue)
- Inventory adjustment, low-stock alerts, oversell prevention

## Phase 5: Returns, Refunds, Coupons, Reviews
- Return request pipeline with SLA and evidence
- Refund orchestration (partial/full)
- Coupon engine with scope/limits/anti-abuse
- Verified-buyer review system + moderation

## Phase 6: Security + Scale + Launch
- Rate limiting and CSRF hardening
- CSP/HSTS/security headers and secret hygiene
- Redis caching and queue workers
- Observability + alerting + audit dashboard
- Staging load tests + production deployment runbook

