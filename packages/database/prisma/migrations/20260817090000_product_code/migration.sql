-- Permanent six-digit customer-facing Product Code.
--
-- Idempotent on purpose: local, staging and production have drifted through
-- `db push` before, so every statement has to survive a replay (hostinger-build
-- fails the deploy if a migration errors).
--
-- No data is written here. Existing products keep a NULL productCode until the
-- backfill script runs; nothing is overwritten, and no existing identifier
-- (sku, rmCode, barcode) is touched.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productCode" TEXT;

-- Unique, but NULL-tolerant: legacy rows stay NULL until backfilled and
-- Postgres does not treat NULLs as equal, so many can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "Product_productCode_key"
  ON "Product" ("productCode");

-- The ledger, not the Product row, is the authority on what has been issued.
-- A hard-deleted product releases its row but never its number.
CREATE TABLE IF NOT EXISTS "IssuedProductCode" (
  "code"      TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "productId" TEXT,
  "issuedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssuedProductCode_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "IssuedProductCode_storeId_idx"
  ON "IssuedProductCode" ("storeId");

-- Adopt any code that already exists on a product (re-running the backfill, or
-- a restore from a dump taken mid-rollout) so the ledger can never hand it out
-- to somebody else.
INSERT INTO "IssuedProductCode" ("code", "storeId", "productId", "issuedAt")
SELECT p."productCode", p."storeId", p."id", NOW()
FROM "Product" p
WHERE p."productCode" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;
