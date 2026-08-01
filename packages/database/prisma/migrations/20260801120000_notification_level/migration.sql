-- Operator severity for admin notifications (info | warn | critical).
-- Kept separate from `status`, which describes delivery, not urgency.
ALTER TABLE "NotificationDeliveryLog"
  ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'info';

-- The tray reads the newest rows per store on every poll.
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_storeId_createdAt_idx"
  ON "NotificationDeliveryLog" ("storeId", "createdAt");
