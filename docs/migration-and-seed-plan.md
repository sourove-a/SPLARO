# Prisma Migration and Seed Plan

## 1. Initial Setup
1. Install runtime:
   - `npm i @prisma/client`
   - `npm i -D prisma tsx`
2. Configure env:
   - `DATABASE_URL=postgresql://...`
3. Generate client:
   - `npx prisma generate`

## 2. Baseline Migration
1. Create first migration from `prisma/schema.prisma`:
   - `npx prisma migrate dev --name init_enterprise_schema`
2. Inspect SQL diff and verify indexes on:
   - `Order(status, createdAt)`
   - `Payment(orderId, status)`
   - `Product(categoryId, isPublished)`
   - `Inventory(productVariantId)` unique
3. For production deploy:
   - `npx prisma migrate deploy`

## 3. Seed Data
- Seed command:
  - `npx tsx prisma/seed.ts`
- Seeds created:
  - Core permissions
  - Roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `INVENTORY_MANAGER`, `MARKETING`
  - Admin user from env (`SEED_ADMIN_*`)
  - Base categories/brand
  - Sample published products + variants + inventory + images

## 4. Safe Rollout Strategy
1. Deploy schema first
2. Deploy application code with feature flags
3. Enable checkout write paths after webhook verification endpoints are live
4. Enable refund/return features only after payment refund API tests pass

## 5. Migration Policy
- Never edit past applied migration files
- Add forward-only migrations
- For destructive changes:
  - create staged migration (nullable/new field)
  - backfill script
  - switch reads/writes
  - remove legacy field in later migration

