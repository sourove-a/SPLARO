-- Premium product editor fields. Existing products keep strict stock behaviour.
--
-- Written idempotently: several environments already received these columns via
-- `prisma db push` before this migration existed, and a bare CREATE TYPE /
-- ADD COLUMN aborts `migrate deploy` there ("type InventoryPolicy already
-- exists"), which in turn fails the whole deploy in scripts/hostinger-build.sh.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryPolicy') THEN
    CREATE TYPE "InventoryPolicy" AS ENUM ('DENY', 'CONTINUE', 'PREORDER');
  END IF;
END $$;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "lengthCm" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "widthCm" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "heightCm" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "productType" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryPolicy" "InventoryPolicy" NOT NULL DEFAULT 'DENY',
  ADD COLUMN IF NOT EXISTS "preorderReleaseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "additionalDetails" JSONB;

-- Older admin versions packed product type and fit as "type · fit".
-- Re-running is harmless: after the first pass no "fitType" still holds ' · '.
UPDATE "Product"
SET
  "productType" = NULLIF(BTRIM(SPLIT_PART("fitType", ' · ', 1)), ''),
  "fitType" = NULLIF(BTRIM(SUBSTRING("fitType" FROM POSITION(' · ' IN "fitType") + 3)), '')
WHERE "fitType" LIKE '% · %';
