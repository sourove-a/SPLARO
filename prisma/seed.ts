import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['product.manage', 'Product Management', 'catalog'],
  ['inventory.manage', 'Inventory Management', 'catalog'],
  ['order.manage', 'Order Management', 'orders'],
  ['refund.manage', 'Refund and Return Management', 'orders'],
  ['coupon.manage', 'Coupon Management', 'marketing'],
  ['campaign.manage', 'Campaign Management', 'marketing'],
  ['user.manage', 'User Management', 'users'],
  ['review.moderate', 'Review Moderation', 'catalog'],
  ['analytics.view', 'Analytics Access', 'analytics'],
  ['settings.manage', 'Settings Management', 'system'],
  ['audit.view', 'Audit Log Access', 'system'],
];

const rolePermissionMap: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map((p) => p[0]),
  ADMIN: [
    'product.manage',
    'inventory.manage',
    'order.manage',
    'refund.manage',
    'coupon.manage',
    'campaign.manage',
    'user.manage',
    'review.moderate',
    'analytics.view',
    'settings.manage',
    'audit.view',
  ],
  SUPPORT: ['order.manage', 'refund.manage', 'user.manage', 'analytics.view'],
  INVENTORY_MANAGER: ['product.manage', 'inventory.manage', 'order.manage'],
  MARKETING: ['coupon.manage', 'campaign.manage', 'analytics.view', 'review.moderate'],
};

async function seedRolesAndPermissions() {
  for (const [key, name, category] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { name, category },
      create: { key, name, category },
    });
  }

  const roles = [
    ['SUPER_ADMIN', 'Super Admin'],
    ['ADMIN', 'Admin'],
    ['SUPPORT', 'Support'],
    ['INVENTORY_MANAGER', 'Inventory Manager'],
    ['MARKETING', 'Marketing'],
  ];

  for (const [key, name] of roles) {
    await prisma.role.upsert({
      where: { key },
      update: { name },
      create: { key, name },
    });
  }

  for (const [roleKey, permissionKeys] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedAdminUser() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@splaro.co';
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '01700000000';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'SPLARO Super Admin';
  const adminPasswordHash =
    process.env.SEED_ADMIN_PASSWORD_HASH ?? '$2b$12$FUl9qww8lbCCvFyRKCMtbeHh2oQ2i.hI8bVg2mbrPjqXPgUs3AAUS';

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminName,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      twoFactorEnabled: false,
    },
    create: {
      email: adminEmail,
      fullName: adminName,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });
}

async function seedCatalog() {
  const shoes = await prisma.category.upsert({
    where: { slug: 'shoes' },
    update: { name: 'Shoes', isActive: true },
    create: { name: 'Shoes', slug: 'shoes', isActive: true },
  });

  const bags = await prisma.category.upsert({
    where: { slug: 'bags' },
    update: { name: 'Bags', isActive: true },
    create: { name: 'Bags', slug: 'bags', isActive: true },
  });

  const brand = await prisma.brand.upsert({
    where: { slug: 'splaro' },
    update: { name: 'SPLARO', isActive: true },
    create: { name: 'SPLARO', slug: 'splaro', isActive: true },
  });

  const productOne = await prisma.product.upsert({
    where: { slug: 'splaro-aurora-runner' },
    update: {
      name: 'SPLARO Aurora Runner',
      categoryId: shoes.id,
      brandId: brand.id,
      basePrice: new Prisma.Decimal(7490),
      isPublished: true,
      isFeatured: true,
    },
    create: {
      name: 'SPLARO Aurora Runner',
      slug: 'splaro-aurora-runner',
      categoryId: shoes.id,
      brandId: brand.id,
      basePrice: new Prisma.Decimal(7490),
      isPublished: true,
      isFeatured: true,
      description: {
        en: 'Luxury lightweight runner with premium cushioning.',
        bn: 'প্রিমিয়াম কুশনিং সহ লাক্সারি হালকা রানার জুতা।',
      },
    },
  });

  const productTwo = await prisma.product.upsert({
    where: { slug: 'splaro-noir-handbag' },
    update: {
      name: 'SPLARO Noir Handbag',
      categoryId: bags.id,
      brandId: brand.id,
      basePrice: new Prisma.Decimal(10490),
      isPublished: true,
      isFeatured: true,
    },
    create: {
      name: 'SPLARO Noir Handbag',
      slug: 'splaro-noir-handbag',
      categoryId: bags.id,
      brandId: brand.id,
      basePrice: new Prisma.Decimal(10490),
      isPublished: true,
      isFeatured: true,
      description: {
        en: 'Structured premium handbag for daily and formal styling.',
        bn: 'ডেইলি এবং ফরমাল স্টাইলিংয়ের জন্য স্ট্রাকচার্ড প্রিমিয়াম হ্যান্ডব্যাগ।',
      },
    },
  });

  const v1 = await prisma.productVariant.upsert({
    where: { sku: 'SPL-AUR-BLK-42' },
    update: {
      productId: productOne.id,
      size: '42',
      color: 'Black',
      price: new Prisma.Decimal(7490),
      isActive: true,
    },
    create: {
      productId: productOne.id,
      sku: 'SPL-AUR-BLK-42',
      title: 'Aurora Runner / Black / 42',
      size: '42',
      color: 'Black',
      price: new Prisma.Decimal(7490),
      isActive: true,
    },
  });

  const v2 = await prisma.productVariant.upsert({
    where: { sku: 'SPL-NOI-BLK-STD' },
    update: {
      productId: productTwo.id,
      size: 'Standard',
      color: 'Black',
      price: new Prisma.Decimal(10490),
      isActive: true,
    },
    create: {
      productId: productTwo.id,
      sku: 'SPL-NOI-BLK-STD',
      title: 'Noir Handbag / Black / Standard',
      size: 'Standard',
      color: 'Black',
      price: new Prisma.Decimal(10490),
      isActive: true,
    },
  });

  await prisma.inventory.upsert({
    where: { productVariantId: v1.id },
    update: { stockOnHand: 120, reservedStock: 0, lowStockThreshold: 8 },
    create: { productVariantId: v1.id, stockOnHand: 120, reservedStock: 0, lowStockThreshold: 8 },
  });

  await prisma.inventory.upsert({
    where: { productVariantId: v2.id },
    update: { stockOnHand: 70, reservedStock: 0, lowStockThreshold: 6 },
    create: { productVariantId: v2.id, stockOnHand: 70, reservedStock: 0, lowStockThreshold: 6 },
  });

  await prisma.productImage.createMany({
    data: [
      {
        productId: productOne.id,
        variantId: v1.id,
        url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1600',
        alt: 'SPLARO Aurora Runner Black',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productTwo.id,
        variantId: v2.id,
        url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1600',
        alt: 'SPLARO Noir Handbag Black',
        sortOrder: 0,
        isPrimary: true,
      },
    ],
    skipDuplicates: true,
  });
}

async function main() {
  await seedRolesAndPermissions();
  await seedAdminUser();
  await seedCatalog();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
