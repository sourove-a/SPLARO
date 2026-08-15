-- Link a product to a brand so the storefront can show "Brand: <logo>".
--
-- Written idempotently on purpose: this repo's environments have drifted via
-- `db push`, so a migration that assumes a clean slate makes hostinger-build.sh
-- exit 1 and takes the deploy down with it. Every statement here is safe to run
-- against a database that already has some or all of these objects.
--
-- brandId is NULLABLE and the FK is ON DELETE SET NULL: existing products keep
-- working with no brand, and deleting a brand never deletes products.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_storeId_brandId_idx"
  ON "Product"("storeId", "brandId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_brandId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
