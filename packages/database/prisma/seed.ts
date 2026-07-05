import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const prisma = new PrismaClient()

const PARTNERS = [
  { name: 'SOUROVE', slug: 'sourove', sharePercent: 33.33 },
  { name: 'RAJU', slug: 'raju', sharePercent: 33.33 },
  { name: 'HRIDOY', slug: 'hridoy', sharePercent: 33.34 },
]

const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? process.env['CEO_EMAIL'] ?? 'splaro.bd@gmail.com'
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'Splaro@2026!'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  let admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL.toLowerCase() },
  })

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL.toLowerCase(),
        emailVerified: true,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        firstName: 'SPLARO',
        lastName: ADMIN_EMAIL.toLowerCase() === 'splaro.bd@gmail.com' ? 'CEO' : 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        twoFAEnabled: false,
      },
    })
    console.log(`Created admin user: ${ADMIN_EMAIL}`)
  }

  let store = await prisma.store.findFirst({ where: { slug: 'splaro' } })

  if (!store) {
    store = await prisma.store.create({
      data: {
        name: 'SPLARO',
        slug: 'splaro',
        domain: 'splaro.co',
        email: 'splaro.bd@gmail.com',
        logo: '/images/logo/splaro-brand-mark-transparent.png',
        ownerId: admin.id,
      },
    })
    console.log('Created SPLARO store')
  } else if (store.domain !== 'splaro.co') {
    store = await prisma.store.update({
      where: { id: store.id },
      data: { domain: 'splaro.co', email: 'splaro.bd@gmail.com' },
    })
    console.log('Updated store domain → splaro.co')
  }

  await prisma.staffRole.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: store.id } },
    create: {
      userId: admin.id,
      storeId: store.id,
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    },
    update: { role: 'SUPER_ADMIN' },
  })
  console.log(`Staff role assigned: ${ADMIN_EMAIL} → SUPER_ADMIN (CEO)`)

  for (const p of PARTNERS) {
    const existing = await prisma.partner.findUnique({
      where: { storeId_slug: { storeId: store.id, slug: p.slug } },
    })
    if (existing) continue

    const partner = await prisma.partner.create({
      data: {
        storeId: store.id,
        name: p.name,
        slug: p.slug,
        sharePercent: p.sharePercent,
        createdBy: 'seed',
      },
    })

    await prisma.partnerShareSetting.create({
      data: {
        storeId: store.id,
        partnerId: partner.id,
        sharePercent: p.sharePercent,
        createdBy: 'seed',
      },
    })

    console.log(`Seeded partner: ${p.name}`)
  }

  const wh = await prisma.warehouse.findFirst({ where: { storeId: store.id, code: 'DHK-01' } })
  if (!wh) {
    await prisma.warehouse.create({
      data: {
        storeId: store.id,
        name: 'Dhaka Main Warehouse',
        code: 'DHK-01',
        city: 'Dhaka',
        address: 'Dhanmondi, Dhaka',
      },
    })
    console.log('Seeded default warehouse')
  }

  const supplierSeed = [
    { name: 'Bangla Fabrics Ltd', phone: '01711000001', email: 'orders@banglafabrics.bd' },
    { name: 'Dhaka Packaging Co', phone: '01711000002', email: 'pack@dhakapack.bd' },
  ]
  const seededSuppliers: { id: string; name: string }[] = []
  for (const s of supplierSeed) {
    const existing = await prisma.supplier.findFirst({ where: { storeId: store.id, name: s.name } })
    const row =
      existing ??
      (await prisma.supplier.create({
        data: { storeId: store.id, ...s },
      }))
    seededSuppliers.push(row)
  }
  if (seededSuppliers.length) console.log(`Seeded ${seededSuppliers.length} suppliers`)

  const poExists = await prisma.purchaseOrder.findFirst({ where: { storeId: store.id, poNumber: 'PO-SEED-001' } })
  if (!poExists && seededSuppliers[0]) {
    await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: seededSuppliers[0].id,
        poNumber: 'PO-SEED-001',
        status: 'APPROVED',
        subtotal: 25000,
        total: 25000,
        notes: 'Seed purchase order',
        items: {
          create: [{ productName: 'Cotton Fabric Roll', sku: 'FAB-COT-01', quantity: 50, unitCost: 500 }],
        },
      },
    })
    console.log('Seeded sample purchase order')
  }

  const fabricExists = await prisma.fabricInventory.findFirst({ where: { storeId: store.id, name: 'Premium Cotton' } })
  if (!fabricExists) {
    await prisma.fabricInventory.create({
      data: {
        storeId: store.id,
        name: 'Premium Cotton',
        color: 'Ivory',
        quantity: 120,
        unit: 'meter',
        costPerUnit: 450,
      },
    })
    console.log('Seeded fabric inventory')
  }

  const batchExists = await prisma.productionOrder.findFirst({ where: { storeId: store.id, productName: 'Embroidered Saree' } })
  if (!batchExists) {
    await prisma.productionOrder.create({
      data: {
        storeId: store.id,
        productName: 'Embroidered Saree',
        quantity: 25,
        status: 'SEWING',
        fabricUsage: 40,
        tailorName: 'Karim Tailors',
      },
    })
    console.log('Seeded production batch')
  }

  await prisma.siteSettings.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      facebookPixelId: process.env['FB_PIXEL_ID'] ?? process.env['NEXT_PUBLIC_FB_PIXEL_ID'] ?? null,
      googleAnalyticsId: process.env['GA4_MEASUREMENT_ID'] ?? process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] ?? null,
    },
    update: {
      // Only overwrite when env provides a value — never clobber admin-set IDs on reseed.
      facebookPixelId: process.env['FB_PIXEL_ID'] ?? process.env['NEXT_PUBLIC_FB_PIXEL_ID'] ?? undefined,
      googleAnalyticsId: process.env['GA4_MEASUREMENT_ID'] ?? process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] ?? undefined,
    },
  })

  const categoryDefs = [
    { name: 'Women', slug: 'women', sortOrder: 1 },
    { name: 'Men', slug: 'men', sortOrder: 2 },
    { name: 'Kids', slug: 'kids', sortOrder: 3 },
    { name: 'Footwear', slug: 'footwear', sortOrder: 4 },
    { name: 'Accessories', slug: 'accessories', sortOrder: 5 },
    { name: 'New Arrivals', slug: 'new-arrivals', sortOrder: 6 },
  ]

  const categories: Record<string, string> = {}
  for (const cat of categoryDefs) {
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      create: { storeId: store.id, name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder },
      update: { name: cat.name, sortOrder: cat.sortOrder, isActive: true },
    })
    categories[cat.slug] = row.id
  }

  const subcategoryDefs: { parent: string; name: string; slug: string; sortOrder: number }[] = [
    { parent: 'kids', name: 'Girls Wear', slug: 'girls-wear', sortOrder: 1 },
    { parent: 'kids', name: 'Boys Wear', slug: 'boys-wear', sortOrder: 2 },
    { parent: 'kids', name: 'Baby & Toddler', slug: 'baby-toddler', sortOrder: 3 },
    { parent: 'kids', name: 'Ethnic Kids', slug: 'ethnic-kids', sortOrder: 4 },
    { parent: 'kids', name: 'Ghagra & Lehenga', slug: 'kids-ghagra-lehenga', sortOrder: 5 },
    { parent: 'kids', name: 'Party Wear', slug: 'kids-party-wear', sortOrder: 6 },
    { parent: 'kids', name: 'School Wear', slug: 'school-wear', sortOrder: 7 },
    { parent: 'women', name: 'Sarees', slug: 'sarees', sortOrder: 1 },
    { parent: 'women', name: 'Ethnic Wear', slug: 'ethnic-wear', sortOrder: 2 },
    { parent: 'women', name: 'Kurti & Tunics', slug: 'kurti-tunics', sortOrder: 3 },
    { parent: 'women', name: 'Dresses', slug: 'dresses', sortOrder: 4 },
    { parent: 'women', name: 'Western Wear', slug: 'western-wear', sortOrder: 5 },
    { parent: 'women', name: 'Bridal', slug: 'bridal', sortOrder: 6 },
    { parent: 'men', name: 'Panjabi', slug: 'panjabi', sortOrder: 1 },
    { parent: 'men', name: 'T-Shirts', slug: 't-shirts', sortOrder: 2 },
    { parent: 'men', name: 'Polo Shirts', slug: 'polo-shirts', sortOrder: 3 },
  ]

  for (const sub of subcategoryDefs) {
    const parentId = categories[sub.parent]
    if (!parentId) continue
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: sub.slug } },
      create: {
        storeId: store.id,
        parentId,
        name: sub.name,
        slug: sub.slug,
        sortOrder: sub.sortOrder,
      },
      update: { parentId, name: sub.name, sortOrder: sub.sortOrder, isActive: true },
    })
  }

  await prisma.category.updateMany({
    where: { storeId: store.id, slug: { in: ['sarees', 'ethnic-wear', 'bridal'] } },
    data: { isActive: true },
  })

  const sampleProducts = [
    // ── WOMEN ──────────────────────────────────────────────────────────────
    {
      name: 'Embroidered Luxury Kurta',
      slug: 'embroidered-luxury-kurta',
      basePrice: 8500,
      compareAtPrice: null,
      categoryId: categories['women'],
      isFeatured: true,
      isNewArrival: true,
      occasion: 'Casual',
      season: 'All Season',
      fabricContent: '100% Cotton',
      fitType: 'Regular',
      description: 'Handcrafted embroidery on premium cotton. Perfect for daily wear and light occasions.',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'S',  color: 'Ivory', colorName: 'Ivory', colorHex: '#f2f0e8', stock: 15 },
        { size: 'M',  color: 'Ivory', colorName: 'Ivory', colorHex: '#f2f0e8', stock: 25 },
        { size: 'L',  color: 'Ivory', colorName: 'Ivory', colorHex: '#f2f0e8', stock: 18 },
        { size: 'XL', color: 'Ivory', colorName: 'Ivory', colorHex: '#f2f0e8', stock: 10 },
      ],
    },
    {
      name: 'Silk Blend Anarkali Dress',
      slug: 'silk-blend-anarkali-dress',
      basePrice: 14500,
      compareAtPrice: 18000,
      categoryId: categories['women'],
      isFeatured: true,
      isBestSeller: true,
      isOnSale: true,
      occasion: 'Formal',
      season: 'All Season',
      fabricContent: 'Silk Blend',
      fitType: 'Flared',
      description: 'Elegant floor-length Anarkali in luxurious silk blend. Features intricate zari work at hem and cuffs.',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'XS', color: 'Burgundy', colorName: 'Burgundy', colorHex: '#800020', stock: 8 },
        { size: 'S',  color: 'Burgundy', colorName: 'Burgundy', colorHex: '#800020', stock: 12 },
        { size: 'M',  color: 'Burgundy', colorName: 'Burgundy', colorHex: '#800020', stock: 14 },
        { size: 'L',  color: 'Burgundy', colorName: 'Burgundy', colorHex: '#800020', stock: 9 },
      ],
    },
    {
      name: 'Linen Co-ord Set',
      slug: 'linen-co-ord-set',
      basePrice: 6800,
      compareAtPrice: null,
      categoryId: categories['women'],
      isNewArrival: true,
      occasion: 'Casual',
      season: 'Summer',
      fabricContent: '100% Linen',
      fitType: 'Relaxed',
      description: 'Breathable linen two-piece set. Cropped top with wide-leg pants, ideal for summer.',
      image: 'https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'S',  color: 'Sage Green', colorName: 'Sage Green', colorHex: '#8fae88', stock: 20 },
        { size: 'M',  color: 'Sage Green', colorName: 'Sage Green', colorHex: '#8fae88', stock: 22 },
        { size: 'L',  color: 'Sage Green', colorName: 'Sage Green', colorHex: '#8fae88', stock: 15 },
        { size: 'S',  color: 'Dusty Rose', colorName: 'Dusty Rose', colorHex: '#d4a5a5', stock: 12 },
        { size: 'M',  color: 'Dusty Rose', colorName: 'Dusty Rose', colorHex: '#d4a5a5', stock: 18 },
      ],
    },
    {
      name: 'Chiffon Wrap Dress',
      slug: 'chiffon-wrap-dress',
      basePrice: 5200,
      compareAtPrice: 6500,
      categoryId: categories['women'],
      isBestSeller: true,
      isOnSale: true,
      occasion: 'Party',
      season: 'All Season',
      fabricContent: '100% Chiffon',
      fitType: 'Wrap',
      description: 'Flowy chiffon wrap dress with adjustable tie waist. Feminine silhouette for evening occasions.',
      image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'S',  color: 'Navy Blue',  colorName: 'Navy Blue',  colorHex: '#1b2a6b', stock: 10 },
        { size: 'M',  color: 'Navy Blue',  colorName: 'Navy Blue',  colorHex: '#1b2a6b', stock: 16 },
        { size: 'L',  color: 'Navy Blue',  colorName: 'Navy Blue',  colorHex: '#1b2a6b', stock: 12 },
        { size: 'XL', color: 'Navy Blue',  colorName: 'Navy Blue',  colorHex: '#1b2a6b', stock: 7 },
        { size: 'S',  color: 'Blush',      colorName: 'Blush',      colorHex: '#f4c5c0', stock: 14 },
        { size: 'M',  color: 'Blush',      colorName: 'Blush',      colorHex: '#f4c5c0', stock: 20 },
      ],
    },
    {
      name: 'Handloom Cotton Kurti',
      slug: 'handloom-cotton-kurti',
      basePrice: 3800,
      compareAtPrice: null,
      categoryId: categories['women'],
      isNewArrival: true,
      occasion: 'Casual',
      season: 'All Season',
      fabricContent: 'Handloom Cotton',
      fitType: 'Straight',
      description: 'Authentic handloom cotton kurti with block print. Locally crafted, ethically made.',
      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'S',  color: 'Mustard', colorName: 'Mustard', colorHex: '#e3a857', stock: 18 },
        { size: 'M',  color: 'Mustard', colorName: 'Mustard', colorHex: '#e3a857', stock: 24 },
        { size: 'L',  color: 'Mustard', colorName: 'Mustard', colorHex: '#e3a857', stock: 16 },
        { size: 'XL', color: 'Mustard', colorName: 'Mustard', colorHex: '#e3a857', stock: 10 },
        { size: 'M',  color: 'Teal',    colorName: 'Teal',    colorHex: '#2d8c8c', stock: 20 },
        { size: 'L',  color: 'Teal',    colorName: 'Teal',    colorHex: '#2d8c8c', stock: 14 },
      ],
    },
    {
      name: 'Premium Georgette Saree',
      slug: 'premium-georgette-saree',
      basePrice: 19500,
      compareAtPrice: null,
      categoryId: categories['women'],
      isFeatured: true,
      isBestSeller: true,
      occasion: 'Formal',
      season: 'All Season',
      fabricContent: 'Pure Georgette',
      fitType: 'Drape',
      description: 'Six-yard pure georgette saree with zari border. Comes with matching blouse piece.',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: 'Free Size', color: 'Emerald', colorName: 'Emerald', colorHex: '#1a7a4a', stock: 8 },
        { size: 'Free Size', color: 'Gold',    colorName: 'Gold',    colorHex: '#c8a97e', stock: 6 },
        { size: 'Free Size', color: 'Red',     colorName: 'Red',     colorHex: '#dc2626', stock: 10 },
      ],
    },

    // ── KIDS ───────────────────────────────────────────────────────────────
    {
      name: 'Kids Cotton Panjabi',
      slug: 'kids-cotton-panjabi',
      basePrice: 1800,
      compareAtPrice: null,
      categoryId: categories['kids'],
      isNewArrival: true,
      occasion: 'Eid',
      season: 'All Season',
      fabricContent: '100% Cotton',
      fitType: 'Regular',
      description: 'Soft cotton panjabi for boys. Easy care, perfect for Eid and festive occasions.',
      image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '2Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 20 },
        { size: '4Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 25 },
        { size: '6Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 20 },
        { size: '8Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 15 },
        { size: '10Y', color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 12 },
        { size: '2Y',  color: 'Sky Blue', colorName: 'Sky Blue', colorHex: '#7ec8e3', stock: 18 },
        { size: '4Y',  color: 'Sky Blue', colorName: 'Sky Blue', colorHex: '#7ec8e3', stock: 22 },
        { size: '6Y',  color: 'Sky Blue', colorName: 'Sky Blue', colorHex: '#7ec8e3', stock: 18 },
      ],
    },
    {
      name: 'Girls Printed Frock',
      slug: 'girls-printed-frock',
      basePrice: 1600,
      compareAtPrice: 2000,
      categoryId: categories['kids'],
      isBestSeller: true,
      isOnSale: true,
      occasion: 'Casual',
      season: 'Summer',
      fabricContent: 'Cotton Poplin',
      fitType: 'A-Line',
      description: 'Cute floral printed cotton frock for girls. Breathable and comfortable for daily wear.',
      image: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '2Y',  color: 'Pink Floral', colorName: 'Pink Floral', colorHex: '#f9a8d4', stock: 16 },
        { size: '4Y',  color: 'Pink Floral', colorName: 'Pink Floral', colorHex: '#f9a8d4', stock: 20 },
        { size: '6Y',  color: 'Pink Floral', colorName: 'Pink Floral', colorHex: '#f9a8d4', stock: 18 },
        { size: '8Y',  color: 'Pink Floral', colorName: 'Pink Floral', colorHex: '#f9a8d4', stock: 12 },
        { size: '2Y',  color: 'Yellow',      colorName: 'Yellow',      colorHex: '#fde047', stock: 14 },
        { size: '4Y',  color: 'Yellow',      colorName: 'Yellow',      colorHex: '#fde047', stock: 18 },
      ],
    },
    {
      name: 'Kids Denim Jeans',
      slug: 'kids-denim-jeans',
      basePrice: 1400,
      compareAtPrice: null,
      categoryId: categories['kids'],
      isNewArrival: true,
      occasion: 'Casual',
      season: 'All Season',
      fabricContent: 'Denim',
      fitType: 'Slim',
      description: 'Classic slim-fit denim jeans for kids. Durable stretch fabric for active play.',
      image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '4Y',  color: 'Indigo', colorName: 'Indigo', colorHex: '#3730a3', stock: 22 },
        { size: '6Y',  color: 'Indigo', colorName: 'Indigo', colorHex: '#3730a3', stock: 25 },
        { size: '8Y',  color: 'Indigo', colorName: 'Indigo', colorHex: '#3730a3', stock: 20 },
        { size: '10Y', color: 'Indigo', colorName: 'Indigo', colorHex: '#3730a3', stock: 15 },
        { size: '12Y', color: 'Indigo', colorName: 'Indigo', colorHex: '#3730a3', stock: 10 },
      ],
    },
    {
      name: 'Boys Graphic T-Shirt',
      slug: 'boys-graphic-tshirt',
      basePrice: 950,
      compareAtPrice: 1200,
      categoryId: categories['kids'],
      isBestSeller: true,
      isOnSale: true,
      occasion: 'Casual',
      season: 'Summer',
      fabricContent: '100% Cotton Jersey',
      fitType: 'Regular',
      description: 'Fun graphic print cotton t-shirt. Soft and comfortable, easy wash.',
      image: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '4Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 30 },
        { size: '6Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 35 },
        { size: '8Y',  color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 28 },
        { size: '10Y', color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 20 },
        { size: '6Y',  color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 25 },
        { size: '8Y',  color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 22 },
        { size: '10Y', color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 18 },
      ],
    },
    {
      name: 'Kids Festive Sherwani Set',
      slug: 'kids-festive-sherwani-set',
      basePrice: 3200,
      compareAtPrice: null,
      categoryId: categories['kids'],
      isFeatured: true,
      isNewArrival: true,
      occasion: 'Eid',
      season: 'All Season',
      fabricContent: 'Brocade',
      fitType: 'Regular',
      description: 'Complete 3-piece sherwani set — sherwani, pajama, and dupatta. Perfect for Eid and weddings.',
      image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '4Y',  color: 'Royal Blue', colorName: 'Royal Blue', colorHex: '#2563eb', stock: 10 },
        { size: '6Y',  color: 'Royal Blue', colorName: 'Royal Blue', colorHex: '#2563eb', stock: 12 },
        { size: '8Y',  color: 'Royal Blue', colorName: 'Royal Blue', colorHex: '#2563eb', stock: 10 },
        { size: '10Y', color: 'Royal Blue', colorName: 'Royal Blue', colorHex: '#2563eb', stock: 8 },
        { size: '4Y',  color: 'Maroon',     colorName: 'Maroon',     colorHex: '#7f1d1d', stock: 8 },
        { size: '6Y',  color: 'Maroon',     colorName: 'Maroon',     colorHex: '#7f1d1d', stock: 10 },
        { size: '8Y',  color: 'Maroon',     colorName: 'Maroon',     colorHex: '#7f1d1d', stock: 8 },
      ],
    },
    {
      name: 'Girls Abaya Set',
      slug: 'girls-abaya-set',
      basePrice: 2200,
      compareAtPrice: 2800,
      categoryId: categories['kids'],
      isBestSeller: true,
      isOnSale: true,
      occasion: 'Eid',
      season: 'All Season',
      fabricContent: 'Nida Fabric',
      fitType: 'Loose',
      description: 'Modest and elegant girls abaya with matching hijab. Lightweight nida fabric.',
      image: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '6Y',  color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 15 },
        { size: '8Y',  color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 18 },
        { size: '10Y', color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 14 },
        { size: '12Y', color: 'Black', colorName: 'Black', colorHex: '#121212', stock: 10 },
        { size: '6Y',  color: 'Navy',  colorName: 'Navy',  colorHex: '#1e3a5f', stock: 12 },
        { size: '8Y',  color: 'Navy',  colorName: 'Navy',  colorHex: '#1e3a5f', stock: 14 },
      ],
    },

    // ── FOOTWEAR (existing) ────────────────────────────────────────────────
    {
      name: 'City Runner Sneaker',
      slug: 'city-runner-sneaker',
      basePrice: 6200,
      compareAtPrice: null,
      categoryId: categories['footwear'],
      isBestSeller: true,
      occasion: 'Casual',
      season: 'All Season',
      fabricContent: 'Mesh upper',
      fitType: 'True to size',
      description: 'Lightweight mesh sneaker with cushioned sole. Perfect for everyday city wear.',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&h=1200&q=88&fit=crop',
      hoverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&h=1200&q=88&fit=crop',
      variants: [
        { size: '39', color: 'Red', colorName: 'Red', colorHex: '#DC2626', stock: 20 },
        { size: '40', color: 'Red', colorName: 'Red', colorHex: '#DC2626', stock: 20 },
        { size: '41', color: 'Red', colorName: 'Red', colorHex: '#DC2626', stock: 20 },
        { size: '42', color: 'Red', colorName: 'Red', colorHex: '#DC2626', stock: 20 },
      ],
    },
  ]

  for (const p of sampleProducts) {
    const exists = await prisma.product.findFirst({ where: { storeId: store.id, slug: p.slug } })
    if (exists) continue

    const imageRecords = [
      { url: p.image, isDefault: true, position: 0 },
      ...(p.hoverImage && p.hoverImage !== p.image
        ? [{ url: p.hoverImage, isDefault: false, position: 1 }]
        : []),
    ]

    await prisma.product.create({
      data: {
        storeId: store.id,
        name: p.name,
        slug: p.slug,
        basePrice: p.basePrice,
        compareAtPrice: p.compareAtPrice ?? undefined,
        categoryId: p.categoryId,
        isPublished: true,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        isBestSeller: p.isBestSeller ?? false,
        isOnSale: p.isOnSale ?? false,
        fabricContent: p.fabricContent,
        fitType: p.fitType,
        occasion: p.occasion ?? undefined,
        season: p.season ?? undefined,
        description: p.description ?? undefined,
        origin: 'Bangladesh',
        images: { create: imageRecords },
        variants: {
          create: p.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            price: p.basePrice,
            stock: variant.stock,
            image: p.image,
          })),
        },
      },
    })
    console.log(`Seeded product: ${p.name}`)
  }

  const sampleInvoice = 'INV-SEED-0001'
  const orderExists = await prisma.order.findFirst({ where: { storeId: store.id, invoiceNumber: sampleInvoice } })
  if (!orderExists) {
    const product = await prisma.product.findFirst({
      where: { storeId: store.id },
      include: { variants: { take: 1 } },
    })
    const variant = product?.variants[0]
    if (product && variant) {
      const subtotal = Number(product.basePrice)
      const deliveryCharge = 120
      await prisma.order.create({
        data: {
          storeId: store.id,
          invoiceNumber: sampleInvoice,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentMethod: 'CASH_ON_DELIVERY',
          subtotal,
          deliveryCharge,
          discount: 0,
          total: subtotal + deliveryCharge,
          shippingName: 'Ayesha Rahman',
          shippingPhone: '01711223344',
          shippingAddress: 'House 12, Road 5, Gulshan-2',
          shippingCity: 'Dhaka',
          shippingDistrict: 'Dhaka',
          shippingDivision: 'Dhaka',
          items: {
            create: [
              {
                productId: product.id,
                variantId: variant.id,
                productName: product.name,
                variantName: variant.size ? `${variant.size} / ${variant.colorName ?? variant.color}` : undefined,
                sku: variant.sku ?? undefined,
                price: product.basePrice,
                quantity: 1,
                subtotal: product.basePrice,
              },
            ],
          },
        },
      })
      console.log(`Seeded sample invoice order ${sampleInvoice}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
