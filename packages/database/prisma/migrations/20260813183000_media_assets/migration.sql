CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "altText" TEXT,
  "folder" TEXT NOT NULL DEFAULT 'media',
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_storeId_path_key"
  ON "MediaAsset"("storeId", "path");

CREATE INDEX IF NOT EXISTS "MediaAsset_storeId_folder_createdAt_idx"
  ON "MediaAsset"("storeId", "folder", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_storeId_fkey'
  ) THEN
    ALTER TABLE "MediaAsset"
      ADD CONSTRAINT "MediaAsset_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Expand-only compatibility step: preserve legacy banners for rollback while
-- copying each library row exactly once into its dedicated media record.
INSERT INTO "MediaAsset" (
  "id", "storeId", "name", "path", "altText", "folder",
  "createdAt", "updatedAt"
)
SELECT
  b."id",
  b."storeId",
  COALESCE(NULLIF(BTRIM(b."title"), ''), 'Library asset'),
  b."image",
  NULLIF(BTRIM(b."title"), ''),
  CASE
    WHEN b."image" LIKE '%/products-men/%' THEN 'men'
    WHEN b."image" LIKE '%/products-women/%' THEN 'women'
    WHEN b."image" LIKE '%/products-kids/%' THEN 'kids'
    WHEN b."image" LIKE '%/products-footwear/%' THEN 'footwear'
    WHEN b."image" LIKE '%/products-accessories/%' THEN 'accessories'
    ELSE 'media'
  END,
  b."createdAt",
  b."updatedAt"
FROM "Banner" b
WHERE b."position" = 'library'
ON CONFLICT ("storeId", "path") DO NOTHING;
