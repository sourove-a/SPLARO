-- Partner Hub invite lifecycle (email confirm — not staff login)
ALTER TABLE "Partner" ADD COLUMN "inviteStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Partner" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "Partner" ADD COLUMN "inviteSentAt" TIMESTAMP(3);
ALTER TABLE "Partner" ADD COLUMN "inviteConfirmedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Partner_inviteToken_key" ON "Partner"("inviteToken");
CREATE INDEX "Partner_storeId_email_idx" ON "Partner"("storeId", "email");
