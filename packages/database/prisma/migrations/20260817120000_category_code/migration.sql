-- Permanent numeric Category Code — the first segment of every variant SKU.
--
-- Three digits, not two. The store already has 86 categories across 6
-- departments, so a 10–99 namespace would have been full on day one; 100–999
-- allocated in per-department blocks leaves room for years without a second
-- migration (and without renumbering SKUs, which is impossible once printed).
--
-- Idempotent: every statement survives a replay. No codes are assigned here —
-- the backfill script does that, so this migration cannot renumber anything.

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Unique per store, NULL-tolerant so categories stay usable until backfilled.
CREATE UNIQUE INDEX IF NOT EXISTS "Category_storeId_code_key"
  ON "Category" ("storeId", "code");

CREATE TABLE IF NOT EXISTS "IssuedCategoryCode" (
  "code"       TEXT NOT NULL,
  "storeId"    TEXT NOT NULL,
  "categoryId" TEXT,
  "label"      TEXT,
  "issuedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssuedCategoryCode_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "IssuedCategoryCode_storeId_idx"
  ON "IssuedCategoryCode" ("storeId");

-- Adopt anything already carrying a code (a replay, or a restore taken
-- mid-rollout) so the ledger can never hand that number to another category.
INSERT INTO "IssuedCategoryCode" ("code", "storeId", "categoryId", "label", "issuedAt")
SELECT c."code", c."storeId", c."id", c."name", NOW()
FROM "Category" c
WHERE c."code" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;
