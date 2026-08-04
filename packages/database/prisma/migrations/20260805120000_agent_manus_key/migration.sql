-- Manus API key on AgentConfig (AI Command Brain + Telegram active model)
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "manusKey" TEXT;
