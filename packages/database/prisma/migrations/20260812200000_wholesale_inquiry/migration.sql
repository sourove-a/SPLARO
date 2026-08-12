-- Wholesale / export lead capture: storefront form → admin pipeline.
-- Written idempotently so a database that already ran `db push` still applies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WholesaleInquiryStatus') THEN
    CREATE TYPE "WholesaleInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "WholesaleInquiry" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "companyName" TEXT,
  "industry" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "productInterest" TEXT,
  "monthlyQuantity" TEXT,
  "message" TEXT,
  "status" "WholesaleInquiryStatus" NOT NULL DEFAULT 'NEW',
  "adminNotes" TEXT,
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "sourcePath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WholesaleInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WholesaleInquiry_storeId_status_idx" ON "WholesaleInquiry"("storeId", "status");
CREATE INDEX IF NOT EXISTS "WholesaleInquiry_storeId_createdAt_idx" ON "WholesaleInquiry"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "WholesaleInquiry_phone_idx" ON "WholesaleInquiry"("phone");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WholesaleInquiry_storeId_fkey'
  ) THEN
    ALTER TABLE "WholesaleInquiry"
      ADD CONSTRAINT "WholesaleInquiry_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
