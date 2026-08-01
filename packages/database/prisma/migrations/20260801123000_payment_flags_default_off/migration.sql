-- New stores must not expose payment methods before credentials are configured.
-- Existing store values remain unchanged; only defaults for future rows change.
ALTER TABLE "SiteSettings"
  ALTER COLUMN "bkashEnabled" SET DEFAULT false,
  ALTER COLUMN "nagadEnabled" SET DEFAULT false,
  ALTER COLUMN "sslcommerzEnabled" SET DEFAULT false;
