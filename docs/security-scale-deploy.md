# SPLARO Security, Performance, and Deployment Baseline

## 1. Security Hardening Baseline
- Zod validation on every API input
- Auth middleware on all dashboard/admin routes
- RBAC middleware per endpoint permission
- CSRF protection for state-changing non-webhook routes
- Rate limits:
  - login/register/OTP/reset endpoints
  - coupon apply endpoint
  - search endpoint
- Security headers:
  - CSP (nonce/hash based)
  - HSTS
  - X-Frame-Options DENY
  - X-Content-Type-Options nosniff
  - Referrer-Policy strict-origin-when-cross-origin
- Secrets only from environment manager
- Non-leaky error responses
- File upload controls:
  - MIME allowlist
  - max size
  - randomized filename
  - malware scan hook

## 2. Observability
- Structured logs with request ID and user ID
- Error tracking (Sentry/OpenTelemetry)
- Payment webhook logs retained for forensics
- AuditLog for all admin writes
- Alerting on:
  - webhook failure rate
  - payment verify mismatch
  - low stock threshold breaches

## 3. Performance and Scale
- Server-side pagination everywhere
- Redis cache:
  - product list
  - product detail
  - category pages
- Cache invalidation on product/inventory update
- Database indexes on all hot query dimensions
- Queue workers for:
  - email/SMS
  - invoice generation
  - retrying failed webhooks
  - stale reservation cleanup
- CDN for images/static assets
- Next image optimization with remote patterns

## 4. Deployment Plan (Hostinger Only, No VPS/AWS)
- Environments: local, staging, production
- Migration workflow:
  1. Build app with `npm run build`
  2. Start with `npm run start` on Hostinger Node.js app
  3. Configure environment variables in hPanel only
  4. If using Google Sheets mode, skip DB migrations and use service account credentials
  5. If using Prisma mode, run `prisma migrate deploy` from CI before production switch
- Rollback:
  - redeploy previous Git commit from Hostinger Git integration
  - guarded DB rollback (manual SQL plan per migration, only when DB mode is enabled)
- Backups:
  - daily Hostinger backup policy + Google Sheet version history
  - restore drill schedule

## 5. CI Gates
- lint
- typecheck
- unit/integration tests
- Prisma migrate diff safety check
- forbidden env secret scan
