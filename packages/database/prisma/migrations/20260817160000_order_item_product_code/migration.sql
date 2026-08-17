-- Snapshot the Product Code onto the order line.
--
-- Order lines already snapshot productName, variantName, sku and price so a
-- past invoice keeps reading correctly after the product changes. The Product
-- Code is what a customer reads out to support, so it belongs in the same
-- snapshot. Idempotent; NULL on historical rows, which stay untouched.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productCode" TEXT;
CREATE INDEX IF NOT EXISTS "OrderItem_productCode_idx" ON "OrderItem" ("productCode");
