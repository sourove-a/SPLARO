-- CreateTable
CREATE TABLE "AdminLoginToken" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminLoginToken_code_key" ON "AdminLoginToken"("code");

-- CreateIndex
CREATE INDEX "AdminLoginToken_email_idx" ON "AdminLoginToken"("email");

-- CreateIndex
CREATE INDEX "AdminLoginToken_expiresAt_idx" ON "AdminLoginToken"("expiresAt");
