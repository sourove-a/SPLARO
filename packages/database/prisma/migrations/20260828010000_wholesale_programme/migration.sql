-- Wholesale programme: publishable tiers, a buyer-facing reference code, and
-- structured intake so the pipeline can be totalled and chased.
--
-- Written idempotently, matching the rest of this directory: envs here drifted
-- through `db push`, so a migration that assumes a clean prior state exits 1
-- inside hostinger-build.sh and takes the whole deploy down with it.

-- ── Tier table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WholesaleTier" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minUnits" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER,
    "summary" TEXT,
    "perks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WholesaleTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleTier_storeId_slug_key" ON "WholesaleTier"("storeId", "slug");
CREATE INDEX IF NOT EXISTS "WholesaleTier_storeId_isActive_sortOrder_idx" ON "WholesaleTier"("storeId", "isActive", "sortOrder");

-- ── Inquiry: structured intake ────────────────────────────────────────────
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "referenceCode" TEXT;
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "monthlyUnits" INTEGER;
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "targetLaunch" TIMESTAMP(3);
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "tierId" TEXT;
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "WholesaleInquiry_referenceCode_key" ON "WholesaleInquiry"("referenceCode");
CREATE INDEX IF NOT EXISTS "WholesaleInquiry_storeId_nextFollowUpAt_idx" ON "WholesaleInquiry"("storeId", "nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "WholesaleInquiry_storeId_monthlyUnits_idx" ON "WholesaleInquiry"("storeId", "monthlyUnits");
CREATE INDEX IF NOT EXISTS "WholesaleInquiry_tierId_idx" ON "WholesaleInquiry"("tierId");

-- ── Foreign keys (pg has no ADD CONSTRAINT IF NOT EXISTS) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WholesaleTier_storeId_fkey') THEN
    ALTER TABLE "WholesaleTier" ADD CONSTRAINT "WholesaleTier_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WholesaleInquiry_tierId_fkey') THEN
    ALTER TABLE "WholesaleInquiry" ADD CONSTRAINT "WholesaleInquiry_tierId_fkey"
      FOREIGN KEY ("tierId") REFERENCES "WholesaleTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Reference-code counter ────────────────────────────────────────────────
-- Same CodeSequence mechanism the barcode allocator uses: one row, advanced by
-- UPDATE ... RETURNING, so two buyers submitting at once serialise on the row
-- lock instead of both being handed MAX + 1.
INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
VALUES ('wholesale-reference', 1, NOW())
ON CONFLICT ("key") DO NOTHING;

-- Existing leads predate the code. Number them oldest-first so the sequence
-- continues from a sensible place rather than starting over beside them.
DO $$
DECLARE
  assigned BIGINT;
BEGIN
  WITH numbered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
    FROM "WholesaleInquiry"
    WHERE "referenceCode" IS NULL
  )
  UPDATE "WholesaleInquiry" w
  SET "referenceCode" = 'WS-' || LPAD(n.rn::TEXT, 6, '0')
  FROM numbered n
  WHERE w."id" = n."id";

  GET DIAGNOSTICS assigned = ROW_COUNT;

  IF assigned > 0 THEN
    UPDATE "CodeSequence"
    SET "nextValue" = GREATEST("nextValue", assigned + 1), "updatedAt" = NOW()
    WHERE "key" = 'wholesale-reference';
  END IF;
END $$;
