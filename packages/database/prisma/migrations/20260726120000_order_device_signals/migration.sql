-- Admin fraud signals: first-party device id + user agent on orders
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "Order_storeId_clientIp_idx" ON "Order"("storeId", "clientIp");
CREATE INDEX IF NOT EXISTS "Order_storeId_deviceId_idx" ON "Order"("storeId", "deviceId");
