-- Supplier sourcing: reusable markets, supplier categories, purchase money
-- breakdown, catalog-linked purchase lines, and store-scoped payments.
--
-- Written idempotently on purpose: envs here drifted through `db push`, so a
-- migration that assumes a clean prior state exits 1 inside hostinger-build.sh
-- and takes the whole deploy down with it. Every statement below can run twice.

-- ── New tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SupplierMarket" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "city" TEXT,
    "country" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierMarket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierCategory" (
    "supplierId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("supplierId","categoryId")
);

-- ── Supplier ──────────────────────────────────────────────────────────────
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "altPhone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "shopName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "marketId" TEXT;

-- ── PurchaseOrder ─────────────────────────────────────────────────────────
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "marketId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "transportCost" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "otherCost" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "stockApplied" BOOLEAN NOT NULL DEFAULT false;

-- purchasedAt defaults to now(), which would date every historical PO to the
-- deploy. Seed it from createdAt, but only on the run that adds the column —
-- re-running must not overwrite a date an operator has since corrected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PurchaseOrder' AND column_name = 'purchasedAt'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    UPDATE "PurchaseOrder" SET "purchasedAt" = "createdAt";
  END IF;
END $$;

-- Existing rows carry a total but no paid/due split, so the whole total is due.
-- Seeded only on the run that adds the column, for the same reason as above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PurchaseOrder' AND column_name = 'dueAmount'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "dueAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
    UPDATE "PurchaseOrder" SET "dueAmount" = "total";
  END IF;
END $$;

-- ── PurchaseOrderItem ─────────────────────────────────────────────────────
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PurchaseOrderItem' AND column_name = 'lineTotal'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD COLUMN "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
    UPDATE "PurchaseOrderItem" SET "lineTotal" = "quantity" * "unitCost";
  END IF;
END $$;

-- ── SupplierPayment ───────────────────────────────────────────────────────
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- Every existing payment belongs to a supplier that already knows its store.
-- Safe to re-run: it only fills rows still NULL.
UPDATE "SupplierPayment" sp
SET "storeId" = s."storeId"
FROM "Supplier" s
WHERE sp."supplierId" = s."id" AND sp."storeId" IS NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierMarket_storeId_name_key" ON "SupplierMarket"("storeId", "name");
CREATE INDEX IF NOT EXISTS "SupplierMarket_storeId_isActive_idx" ON "SupplierMarket"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "SupplierCategory_categoryId_idx" ON "SupplierCategory"("categoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_storeId_code_key" ON "Supplier"("storeId", "code");
CREATE INDEX IF NOT EXISTS "Supplier_storeId_marketId_idx" ON "Supplier"("storeId", "marketId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_storeId_supplierId_idx" ON "PurchaseOrder"("storeId", "supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_storeId_purchasedAt_idx" ON "PurchaseOrder"("storeId", "purchasedAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_variantId_idx" ON "PurchaseOrderItem"("variantId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_storeId_paidAt_idx" ON "SupplierPayment"("storeId", "paidAt");
CREATE INDEX IF NOT EXISTS "SupplierPayment_purchaseOrderId_idx" ON "SupplierPayment"("purchaseOrderId");

-- ── Foreign keys (pg has no ADD CONSTRAINT IF NOT EXISTS) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierMarket_storeId_fkey') THEN
    ALTER TABLE "SupplierMarket" ADD CONSTRAINT "SupplierMarket_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_marketId_fkey') THEN
    ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_marketId_fkey"
      FOREIGN KEY ("marketId") REFERENCES "SupplierMarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierCategory_supplierId_fkey') THEN
    ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierCategory_categoryId_fkey') THEN
    ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_marketId_fkey') THEN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_marketId_fkey"
      FOREIGN KEY ("marketId") REFERENCES "SupplierMarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_productId_fkey') THEN
    ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_variantId_fkey') THEN
    ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayment_purchaseOrderId_fkey') THEN
    ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseOrderId_fkey"
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
