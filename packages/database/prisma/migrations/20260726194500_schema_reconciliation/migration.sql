-- Idempotent reconciliation for schema fields previously healed only via db push.
-- Safe on production (already has these) and on migrate-only fresh DBs.

-- Order.shippingEmail
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingEmail" TEXT;

-- Payment.paymentNumber + uniqueness
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_paymentNumber_key'
  ) THEN
    -- Deduplicate nulls/empties are fine; only enforce uniqueness when set.
    CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_paymentNumber_idx" ON "Payment"("paymentNumber");

-- OrderStatus enum values used by fulfillment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'PACKED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'SHIPPED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
  END IF;
END $$;

-- Agent audit tables (AI Command v2)
CREATE TABLE IF NOT EXISTS "AgentRun" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'admin',
    "model" TEXT NOT NULL,
    "difficulty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "tokenInEst" INTEGER NOT NULL DEFAULT 0,
    "tokenOutEst" INTEGER NOT NULL DEFAULT 0,
    "costEstUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "userMessage" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "resultSummary" TEXT NOT NULL,
    "previousValues" JSONB,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "costEstUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentPendingAction" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "preview" TEXT NOT NULL,
    "previousValues" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPendingAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentRun_storeId_startedAt_idx" ON "AgentRun"("storeId", "startedAt");
CREATE INDEX IF NOT EXISTS "AgentRun_sessionId_idx" ON "AgentRun"("sessionId");
CREATE INDEX IF NOT EXISTS "AgentToolCall_runId_idx" ON "AgentToolCall"("runId");
CREATE INDEX IF NOT EXISTS "AgentPendingAction_storeId_sessionId_status_idx" ON "AgentPendingAction"("storeId", "sessionId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentRun_storeId_fkey'
  ) THEN
    ALTER TABLE "AgentRun"
      ADD CONSTRAINT "AgentRun_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentToolCall_runId_fkey'
  ) THEN
    ALTER TABLE "AgentToolCall"
      ADD CONSTRAINT "AgentToolCall_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentPendingAction_storeId_fkey'
  ) THEN
    ALTER TABLE "AgentPendingAction"
      ADD CONSTRAINT "AgentPendingAction_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure AdminInvite shape matches schema (emergency db push may have partial table)
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "id" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "role" "UserRole";
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "lastName" TEXT DEFAULT '';
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "AdminInvite" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
