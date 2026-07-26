-- CreateTable (idempotent: may already exist from emergency db push)
CREATE TABLE IF NOT EXISTS "AdminInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "storeId" TEXT NOT NULL,
    "invitedById" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_email_idx" ON "AdminInvite"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_expiresAt_idx" ON "AdminInvite"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_storeId_idx" ON "AdminInvite"("storeId");
