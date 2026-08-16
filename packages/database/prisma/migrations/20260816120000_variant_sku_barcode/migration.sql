-- Auto SKU + internal barcode for product variants.
--
-- Idempotent throughout: hostinger-build.sh / `migrate deploy` re-run this on
-- environments that drifted via `db push`, so every statement must tolerate the
-- object already existing.

-- 1. Stable SPL-{CAT}-{MODEL} identity on the parent product.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "skuCategoryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "skuModelNumber" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_storeId_skuCategoryCode_skuModelNumber_key"
  ON "Product"("storeId", "skuCategoryCode", "skuModelNumber");

-- 2. Atomic counters for barcodes and per-category model numbers.
-- `updatedAt` is driven by Prisma's @updatedAt, so it must carry no DB default
-- or `migrate diff` reports permanent drift.
CREATE TABLE IF NOT EXISTS "CodeSequence" (
  "key" TEXT NOT NULL,
  "nextValue" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeSequence_pkey" PRIMARY KEY ("key")
);

-- Converge environments that ran an earlier revision of this migration.
ALTER TABLE "CodeSequence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Internal barcodes start at 1000000001. Seeded only once.
INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
VALUES ('barcode', 1000000001, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 3. Uniqueness on variant sku/barcode.
--
-- Refuse to touch existing rows: duplicates are real merchant data and the
-- operator must resolve them in admin. Fail with the offending values listed
-- rather than silently renaming a SKU that may already be on a printed label.
DO $$
DECLARE
  dupes TEXT;
BEGIN
  SELECT string_agg(sku, ', ') INTO dupes
  FROM (
    SELECT "sku" AS sku
    FROM "ProductVariant"
    WHERE "sku" IS NOT NULL AND btrim("sku") <> ''
    GROUP BY "sku"
    HAVING count(*) > 1
    LIMIT 25
  ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add unique index: duplicate ProductVariant.sku values exist (%). Fix them in Admin -> Products, then redeploy.',
      dupes;
  END IF;
END
$$;

DO $$
DECLARE
  dupes TEXT;
BEGIN
  SELECT string_agg(barcode, ', ') INTO dupes
  FROM (
    SELECT "barcode" AS barcode
    FROM "ProductVariant"
    WHERE "barcode" IS NOT NULL AND btrim("barcode") <> ''
    GROUP BY "barcode"
    HAVING count(*) > 1
    LIMIT 25
  ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add unique index: duplicate ProductVariant.barcode values exist (%). Fix them in Admin -> Products, then redeploy.',
      dupes;
  END IF;
END
$$;

-- Postgres unique indexes ignore NULLs, so variants without a code stay valid.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_barcode_key" ON "ProductVariant"("barcode");
