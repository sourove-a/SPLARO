-- CreateTable
CREATE TABLE "UrlRedirect" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '301',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrlRedirect_storeId_fromPath_key" ON "UrlRedirect"("storeId", "fromPath");

-- CreateIndex
CREATE INDEX "UrlRedirect_storeId_isActive_idx" ON "UrlRedirect"("storeId", "isActive");

-- AddForeignKey
ALTER TABLE "UrlRedirect" ADD CONSTRAINT "UrlRedirect_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
