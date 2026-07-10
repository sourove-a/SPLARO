-- Per-admin Telegram binding for private login OTP delivery (not shared group chat).
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
