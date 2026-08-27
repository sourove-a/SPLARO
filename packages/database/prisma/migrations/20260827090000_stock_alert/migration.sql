-- Back-in-stock alerts: one row per person per out-of-stock item, plus the
-- opaque token behind its unsubscribe link.
--
-- Written idempotently, matching the rest of this directory: envs here drifted
-- through `db push`, so a migration that assumes a clean prior state exits 1
-- inside hostinger-build.sh and takes the whole deploy down with it. Every
-- statement below can run twice.

-- ── Enum ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockAlertChannel') THEN
    CREATE TYPE "StockAlertChannel" AS ENUM ('EMAIL', 'SMS');
  END IF;
END $$;

-- ── Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StockAlert" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "channel" "StockAlertChannel" NOT NULL,
    "contact" TEXT NOT NULL,
    "customerId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "StockAlert_unsubscribeToken_key" ON "StockAlert"("unsubscribeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "StockAlert_storeId_dedupeKey_key" ON "StockAlert"("storeId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "StockAlert_storeId_notifiedAt_idx" ON "StockAlert"("storeId", "notifiedAt");
CREATE INDEX IF NOT EXISTS "StockAlert_productId_notifiedAt_idx" ON "StockAlert"("productId", "notifiedAt");
CREATE INDEX IF NOT EXISTS "StockAlert_variantId_idx" ON "StockAlert"("variantId");
CREATE INDEX IF NOT EXISTS "StockAlert_customerId_idx" ON "StockAlert"("customerId");

-- ── Foreign keys (pg has no ADD CONSTRAINT IF NOT EXISTS) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAlert_storeId_fkey') THEN
    ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAlert_productId_fkey') THEN
    ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAlert_variantId_fkey') THEN
    ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAlert_customerId_fkey') THEN
    ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
