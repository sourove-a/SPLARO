-- Minimal SPLARO seed for production when Prisma seed panics on shared hosting.
-- Admin, store, and staff only — no demo products.
INSERT INTO "User" (
  "id", "email", "emailVerified", "passwordHash", "firstName", "lastName", "role", "isActive", "twoFAEnabled", "updatedAt"
) VALUES (
  'seed-admin-001',
  'splaro.bd@gmail.com',
  true,
  'edb9b3109469137b46d9821695a9a013:3306696fb7c4835341e1ee0ea1dbfc4691bbe066d7fc964f07aa6bf31538091cae24ad57114ef71b3d41a2199ed0f35a76bba8f4fc507843bc2c8107dd6d52e3',
  'SPLARO',
  'CEO',
  'SUPER_ADMIN',
  true,
  false,
  NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Store" (
  "id", "name", "slug", "domain", "email", "ownerId", "updatedAt"
) VALUES (
  'seed-store-splaro',
  'SPLARO',
  'splaro',
  'splaro.co',
  'info@splaro.co',
  'seed-admin-001',
  NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StaffRole" (
  "id", "userId", "storeId", "role", "permissions"
) VALUES (
  'seed-staff-001',
  'seed-admin-001',
  'seed-store-splaro',
  'SUPER_ADMIN',
  ARRAY['*']::TEXT[]
) ON CONFLICT ("id") DO NOTHING;
