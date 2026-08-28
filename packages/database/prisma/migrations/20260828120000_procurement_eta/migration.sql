-- Procurement ETA: an expected delivery date on the purchase order, and the
-- supplier lead time it is derived from.
--
-- Idempotent like the rest of the procurement migrations — envs here drifted
-- through `db push`, so a statement that assumes a clean prior state fails the
-- deploy script rather than the migration.

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "expectedAt" TIMESTAMP(3);
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;

-- Deliberately not backfilled. An ETA invented for a historical PO would read
-- as a promise the supplier never made; null means "never captured".
CREATE INDEX IF NOT EXISTS "PurchaseOrder_storeId_expectedAt_idx"
  ON "PurchaseOrder"("storeId", "expectedAt");
