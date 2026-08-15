CREATE TABLE IF NOT EXISTS "MediaFolder" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaFolder_storeId_slug_key"
  ON "MediaFolder"("storeId", "slug");

CREATE INDEX IF NOT EXISTS "MediaFolder_storeId_createdAt_idx"
  ON "MediaFolder"("storeId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaFolder_storeId_fkey'
  ) THEN
    ALTER TABLE "MediaFolder"
      ADD CONSTRAINT "MediaFolder_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
