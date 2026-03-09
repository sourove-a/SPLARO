import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'splaro_salt_2025').digest('hex');
}

async function main() {
  console.log('🌱 Seeding Splaro database...');

  // ── Admin / Staff Users ──────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@splaro.co' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@splaro.co',
      phone: '+8801905010205',
      passwordHash: hashPassword('splaro@admin2025'),
      provider: 'LOCAL',
      role: 'ADMIN',
    },
  });
  console.log('✅ Super admin created:', superAdmin.email);

  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@splaro.co' },
    update: {},
    create: {
      name: 'Staff User',
      email: 'staff@splaro.co',
      phone: '+8801800000001',
      passwordHash: hashPassword('staff@splaro2025'),
      provider: 'LOCAL',
      role: 'USER',
    },
  });
  console.log('✅ Staff user created:', staffUser.email);

  // ── Categories ───────────────────────────────────────────────
  const categories = [
    { name: 'Footwear', slug: 'footwear', description: 'Premium shoes and sandals', displayOrder: 1 },
    { name: 'Bags', slug: 'bags', description: 'Luxury handbags and purses', displayOrder: 2 },
    { name: 'Accessories', slug: 'accessories', description: 'Belts, scarves, and more', displayOrder: 3 },
    { name: 'New Arrivals', slug: 'new-arrivals', description: 'Latest additions', displayOrder: 4 },
  ];

  const createdCats: Record<string, any> = {};
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, isActive: true },
    });
    createdCats[cat.slug] = c;
    console.log(`✅ Category: ${c.name}`);
  }

  // Sub-categories
  const subCats = [
    { name: 'Heels', slug: 'heels', parentSlug: 'footwear', displayOrder: 1 },
    { name: 'Flats', slug: 'flats', parentSlug: 'footwear', displayOrder: 2 },
    { name: 'Sandals', slug: 'sandals', parentSlug: 'footwear', displayOrder: 3 },
    { name: 'Handbags', slug: 'handbags', parentSlug: 'bags', displayOrder: 1 },
    { name: 'Clutches', slug: 'clutches', parentSlug: 'bags', displayOrder: 2 },
    { name: 'Tote Bags', slug: 'tote-bags', parentSlug: 'bags', displayOrder: 3 },
  ];

  for (const sub of subCats) {
    const parent = createdCats[sub.parentSlug];
    if (!parent) continue;
    await prisma.category.upsert({
      where: { slug: sub.slug },
      update: {},
      create: { name: sub.name, slug: sub.slug, parentId: parent.id, isActive: true, displayOrder: sub.displayOrder },
    });
    console.log(`  ↳ Sub: ${sub.name}`);
  }

  // ── Products ─────────────────────────────────────────────────
  const products = [
    {
      name: 'Scarlet Elegance Heel',
      slug: 'scarlet-elegance-heel',
      shortDescription: 'Handcrafted red leather heel with gold accents',
      description: 'A timeless piece for the modern woman. Crafted from premium full-grain leather with an adjustable ankle strap and cushioned insole for all-day comfort.',
      sku: 'SPL-HEL-001',
      brand: 'Splaro Signature',
      color: 'Scarlet Red',
      sizeInfo: '36–41 EU',
      regularPrice: 4500,
      salePrice: 3800,
      costPrice: 1800,
      stockQty: 24,
      lowStockThreshold: 5,
      isFeatured: true,
      isNewArrival: true,
      isPublished: true,
      tags: 'heel,leather,formal,red',
      categorySlug: 'heels',
    },
    {
      name: 'Midnight Classic Bag',
      slug: 'midnight-classic-bag',
      shortDescription: 'Structured black leather handbag with silver hardware',
      description: 'A sophisticated everyday companion. Features three interior compartments, magnetic closure, and detachable shoulder strap. Made from Italian-tanned leather.',
      sku: 'SPL-BAG-001',
      brand: 'Splaro Signature',
      color: 'Midnight Black',
      sizeInfo: '30cm × 22cm × 10cm',
      regularPrice: 8900,
      salePrice: null,
      costPrice: 3500,
      stockQty: 12,
      lowStockThreshold: 3,
      isFeatured: true,
      isBestseller: true,
      isPublished: true,
      tags: 'handbag,leather,black,classic',
      categorySlug: 'handbags',
    },
    {
      name: 'Pearl Luxe Flat',
      slug: 'pearl-luxe-flat',
      shortDescription: 'Embellished pearl detail ballet flat',
      description: 'Delicate pearl embellishments on a soft lambskin flat. Perfect for occasions where comfort meets elegance. Available in ivory and blush.',
      sku: 'SPL-FLT-001',
      brand: 'Splaro',
      color: 'Ivory',
      sizeInfo: '36–41 EU',
      regularPrice: 2800,
      salePrice: 2200,
      costPrice: 1100,
      stockQty: 4,
      lowStockThreshold: 5,
      isNewArrival: true,
      isPublished: true,
      tags: 'flat,pearl,wedding,soft',
      categorySlug: 'flats',
    },
    {
      name: 'Golden Hour Clutch',
      slug: 'golden-hour-clutch',
      shortDescription: 'Metallic gold evening clutch with chain strap',
      description: 'A statement piece for evening occasions. Shimmering metallic leather with a fold-over clasp and detachable gold chain. Fits phone, cards, and essentials.',
      sku: 'SPL-CLT-001',
      brand: 'Splaro',
      color: 'Gold',
      regularPrice: 3200,
      costPrice: 1200,
      stockQty: 8,
      lowStockThreshold: 3,
      isFeatured: true,
      isPublished: true,
      tags: 'clutch,gold,evening,chain',
      categorySlug: 'clutches',
    },
    {
      name: 'Urban Tote Pro',
      slug: 'urban-tote-pro',
      shortDescription: 'Spacious canvas and leather tote for everyday use',
      description: 'Premium canvas body with full-grain leather handles and base. Interior laptop sleeve fits up to 15". Perfect for work and weekend adventures.',
      sku: 'SPL-TOT-001',
      brand: 'Splaro',
      color: 'Camel Brown',
      sizeInfo: '40cm × 35cm × 15cm',
      regularPrice: 5500,
      salePrice: 4800,
      costPrice: 2200,
      stockQty: 0,
      lowStockThreshold: 3,
      isBestseller: true,
      isPublished: true,
      tags: 'tote,canvas,leather,work,laptop',
      categorySlug: 'tote-bags',
    },
  ];

  for (const p of products) {
    const catSlug = p.categorySlug;
    const cat = await prisma.category.findUnique({ where: { slug: catSlug } });
    const { categorySlug: _, ...productData } = p;
    await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: {
        ...productData,
        regularPrice: productData.regularPrice,
        salePrice: productData.salePrice ?? null,
        costPrice: productData.costPrice,
        categoryId: cat?.id ?? null,
        blousePiece: false,
        isDraft: false,
        isArchived: false,
      },
    });
    console.log(`✅ Product: ${productData.name}`);
  }

  // ── Coupons ──────────────────────────────────────────────────
  const coupons = [
    { code: 'WELCOME10', name: 'Welcome Discount', discountType: 'PERCENTAGE', discountValue: 10, minOrderValue: 2000, maxUses: 500, description: '10% off for new customers' },
    { code: 'FLAT500', name: '500 Taka Off', discountType: 'FIXED', discountValue: 500, minOrderValue: 5000, maxUses: 200, description: 'Flat ৳500 off on orders above ৳5000' },
    { code: 'SPLARO20', name: 'Splaro Special', discountType: 'PERCENTAGE', discountValue: 20, minOrderValue: 8000, maxUses: 100, description: '20% off premium collections' },
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: { ...coupon, isActive: true, discountType: coupon.discountType as any },
    });
    console.log(`✅ Coupon: ${coupon.code}`);
  }

  // ── Shipping Zones ───────────────────────────────────────────
  const zones = [
    { name: 'Dhaka Metro', description: 'Dhaka city areas', shippingFee: 60, estimatedDays: '1–2 days', freeShippingAbove: 5000, isCodAvailable: true },
    { name: 'Outside Dhaka', description: 'All other districts', shippingFee: 120, estimatedDays: '3–5 days', freeShippingAbove: 8000, isCodAvailable: true },
    { name: 'International', description: 'Outside Bangladesh', shippingFee: 1500, estimatedDays: '7–14 days', freeShippingAbove: null, isCodAvailable: false },
  ];

  for (const zone of zones) {
    await prisma.shippingZone.create({ data: { ...zone, isActive: true } }).catch(() => {});
    console.log(`✅ Zone: ${zone.name}`);
  }

  // ── Content Blocks ───────────────────────────────────────────
  const blocks = [
    { key: 'hero_banner_1', type: 'HERO_BANNER', title: 'New Season Collection', subtitle: 'Discover luxury footwear and bags crafted for the modern woman', linkText: 'Shop Now', linkUrl: '/shop', isPublished: true, displayOrder: 1 },
    { key: 'hero_banner_2', type: 'HERO_BANNER', title: 'Exclusive Bags', subtitle: 'Handcrafted from premium leather. Limited edition.', linkText: 'Explore Bags', linkUrl: '/bags', isPublished: true, displayOrder: 2 },
    { key: 'announcement_bar', type: 'ANNOUNCEMENT', title: '🚚 Free shipping on orders above ৳5000 in Dhaka', isPublished: true, displayOrder: 1 },
    { key: 'about_us', type: 'ABOUT', title: 'About Splaro', body: 'Splaro is a premium luxury footwear and bags boutique based in Bangladesh. We believe every step deserves elegance.', isPublished: true, displayOrder: 1 },
    { key: 'privacy_policy', type: 'POLICY', title: 'Privacy Policy', body: 'Your privacy is important to us. We collect only necessary information to process your orders and improve your experience.', isPublished: true, displayOrder: 1 },
    { key: 'return_policy', type: 'POLICY', title: 'Return Policy', body: 'We accept returns within 7 days of delivery for unworn items in original packaging. Contact us at support@splaro.co', isPublished: true, displayOrder: 2 },
    { key: 'shipping_policy', type: 'POLICY', title: 'Shipping Policy', body: 'We deliver within Bangladesh via trusted couriers. Dhaka: 1–2 days. Outside Dhaka: 3–5 days.', isPublished: true, displayOrder: 3 },
  ];

  for (const block of blocks) {
    await prisma.contentBlock.upsert({
      where: { key: block.key },
      update: {},
      create: { ...block, type: block.type as any },
    });
    console.log(`✅ Content: ${block.key}`);
  }

  // ── Admin Notifications ──────────────────────────────────────
  await prisma.adminNotification.createMany({
    data: [
      { type: 'SYSTEM', title: 'Welcome to Splaro Admin', message: 'Your admin panel is ready. Start by adding products and configuring settings.', isRead: false },
      { type: 'LOW_STOCK', title: 'Pearl Luxe Flat — Low Stock', message: 'Pearl Luxe Flat has only 4 units remaining. Consider restocking.', link: '/admin/inventory', isRead: false },
      { type: 'OUT_OF_STOCK', title: 'Urban Tote Pro — Out of Stock', message: 'Urban Tote Pro is out of stock. Update inventory when available.', link: '/admin/inventory', isRead: false },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Notifications seeded');

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Admin Credentials:');
  console.log('   Email:    admin@splaro.co');
  console.log('   Password: splaro@admin2025');
  console.log('\n📋 Admin Routes:');
  console.log('   /admin/dashboard');
  console.log('   /admin/products');
  console.log('   /admin/categories');
  console.log('   /admin/orders');
  console.log('   /admin/customers');
  console.log('   /admin/inventory');
  console.log('   /admin/reviews');
  console.log('   /admin/returns');
  console.log('   /admin/coupons-discounts');
  console.log('   /admin/content');
  console.log('   /admin/settings');
  console.log('   /admin/security');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
