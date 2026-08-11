-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "customerCode" TEXT;

-- CreateIndex
CREATE INDEX "Customer_customerCode_idx" ON "Customer"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_storeId_customerCode_key" ON "Customer"("storeId", "customerCode");
