CREATE TABLE IF NOT EXISTS "WholesaleStockImage" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WholesaleStockImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WholesaleStockImage_storeId_isActive_sortOrder_idx"
  ON "WholesaleStockImage"("storeId", "isActive", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WholesaleStockImage_storeId_fkey'
  ) THEN
    ALTER TABLE "WholesaleStockImage"
      ADD CONSTRAINT "WholesaleStockImage_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
