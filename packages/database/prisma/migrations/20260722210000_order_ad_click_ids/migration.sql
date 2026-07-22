-- Ads attribution for Meta CAPI + Google Ads match quality
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fbp" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fbc" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gclid" TEXT;
