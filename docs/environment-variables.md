# SPLARO Environment Variables

## Core
- `NODE_ENV`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL` (optional for Prisma migrations)

## Auth
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `AUTH_URL`
- `GOOGLE_CLIENT_ID` (optional social login)
- `GOOGLE_CLIENT_SECRET` (optional social login)

## OTP and Communication
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- `SMS_SENDER_ID`

## Payments
- `SSLCOMMERZ_STORE_ID`
- `SSLCOMMERZ_STORE_PASSWORD`
- `SSLCOMMERZ_API_BASE`
- `SSLCOMMERZ_VALIDATION_BASE`
- `SSLCOMMERZ_WEBHOOK_SECRET`
- `BKASH_APP_KEY` (if enabled)
- `BKASH_APP_SECRET` (if enabled)
- `NAGAD_MERCHANT_ID` (if enabled)
- `NAGAD_MERCHANT_PRIVATE_KEY` (if enabled)
- `STRIPE_SECRET_KEY` (optional)
- `STRIPE_WEBHOOK_SECRET` (optional)

## Cache and Queue
- `REDIS_URL`
- `UPSTASH_REDIS_REST_URL` (if upstash)
- `UPSTASH_REDIS_REST_TOKEN` (if upstash)
- `QUEUE_PREFIX`

## Storage and CDN
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `CDN_BASE_URL`

## Observability
- `SENTRY_DSN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `LOG_LEVEL`

## Seed Bootstrapping
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PHONE`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_PASSWORD_HASH`

