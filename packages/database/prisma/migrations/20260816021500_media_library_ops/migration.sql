ALTER TABLE "MediaAsset"
  ADD COLUMN IF NOT EXISTS "contentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" TEXT,
  ADD COLUMN IF NOT EXISTS "focalX" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "focalY" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "watermarked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MediaAsset_storeId_deletedAt_idx" ON "MediaAsset"("storeId", "deletedAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_storeId_contentHash_idx" ON "MediaAsset"("storeId", "contentHash");

ALTER TABLE "MediaFolder"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE INDEX IF NOT EXISTS "MediaFolder_parentId_idx" ON "MediaFolder"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaFolder_parentId_fkey'
  ) THEN
    ALTER TABLE "MediaFolder"
      ADD CONSTRAINT "MediaFolder_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
