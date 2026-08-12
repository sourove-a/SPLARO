-- Optional reference images on wholesale enquiries (storefront product photos).
ALTER TABLE "WholesaleInquiry" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
