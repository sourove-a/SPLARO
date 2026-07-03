-- Minimal SPLARO seed for production when Prisma seed panics on shared hosting.
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

INSERT INTO "Category" (
  "id", "storeId", "name", "slug", "sortOrder", "updatedAt"
) VALUES (
  'seed-cat-sarees',
  'seed-store-splaro',
  'Sarees',
  'sarees',
  1,
  NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Product" (
  "id", "storeId", "categoryId", "slug", "name", "description", "basePrice", "compareAtPrice",
  "isPublished", "isFeatured", "isBestSeller", "fabricContent", "fitType", "occasion", "season", "origin", "updatedAt"
) VALUES (
  'seed-product-001',
  'seed-store-splaro',
  'seed-cat-sarees',
  'heritage-jamdani-saree',
  'Heritage Jamdani Saree',
  'Handwoven jamdani saree with traditional motifs.',
  12500.00,
  14900.00,
  true,
  true,
  true,
  'Cotton silk blend',
  'Regular',
  'Festive',
  'All Season',
  'Bangladesh',
  NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ProductImage" (
  "id", "productId", "url", "isDefault", "position"
) VALUES (
  'seed-img-001',
  'seed-product-001',
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&h=1200&q=88&fit=crop',
  true,
  0
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ProductVariant" (
  "id", "productId", "size", "color", "colorName", "colorHex", "price", "stock", "image", "updatedAt"
) VALUES (
  'seed-variant-001',
  'seed-product-001',
  'Free',
  'Ivory',
  'Ivory',
  '#FFFFF0',
  12500.00,
  25,
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&h=1200&q=88&fit=crop',
  NOW()
) ON CONFLICT ("id") DO NOTHING;
