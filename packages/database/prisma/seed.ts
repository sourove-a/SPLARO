import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const prisma = new PrismaClient()

const PARTNERS = [
  { name: 'SOUROVE', slug: 'sourove', sharePercent: 33.33 },
  { name: 'RAJU', slug: 'raju', sharePercent: 33.33 },
  { name: 'HRIDOY', slug: 'hridoy', sharePercent: 33.34 },
]

const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? process.env['CEO_EMAIL'] ?? 'splaro.bd@gmail.com'
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD']
const isProd = process.env.NODE_ENV === 'production'

if (!ADMIN_PASSWORD) {
  if (isProd) {
    throw new Error('ADMIN_PASSWORD is required when seeding in production')
  }
  console.warn('[seed] ADMIN_PASSWORD not set — using dev-only default (change before production)')
}

const resolvedAdminPassword = ADMIN_PASSWORD ?? 'Splaro@2026!'
/** Public storefront contact — never use personal admin Gmail on the live site. */
const STORE_CONTACT_EMAIL =
  process.env['STORE_CONTACT_EMAIL'] ??
  process.env['NEXT_PUBLIC_SUPPORT_EMAIL'] ??
  'info@splaro.co'
const STORE_CONTACT_PHONE =
  process.env['NEXT_PUBLIC_SUPPORT_PHONE'] ??
  process.env['COMPANY_PHONE'] ??
  '+8801905010205'
const STORE_WHATSAPP =
  process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'] ??
  process.env['NEXT_PUBLIC_SUPPORT_PHONE'] ??
  STORE_CONTACT_PHONE

const DEMO_PRODUCT_IMAGE = '/images/placeholder-product.jpg'

type DemoProductSeed = {
  name: string
  slug: string
  categorySlug: string
  basePrice: number
  compareAtPrice?: number
  isFeatured?: boolean
  isNewArrival?: boolean
  colors: { name: string; hex: string; sizes: string[] }[]
}

const DEMO_PRODUCTS: DemoProductSeed[] = [
  {
    name: 'White Kantha Odyssey Theme Shalwar Kameez',
    slug: 'white-kantha-odyssey-theme-shalwar-kameez',
    categorySlug: 'ethnic-wear',
    basePrice: 4460,
    compareAtPrice: 4877,
    isFeatured: true,
    isNewArrival: true,
    colors: [{ name: 'White', hex: '#F5F5F0', sizes: ['S', 'M', 'L', 'XL'] }],
  },
  {
    name: 'Midnight Silk Evening Saree',
    slug: 'midnight-silk-evening-saree',
    categorySlug: 'sarees',
    basePrice: 6890,
    compareAtPrice: 7490,
    isFeatured: true,
    colors: [{ name: 'Midnight', hex: '#1A1A2E', sizes: ['Free Size'] }],
  },
  {
    name: 'Urban Linen Panjabi',
    slug: 'urban-linen-panjabi',
    categorySlug: 'panjabi',
    basePrice: 3290,
    isNewArrival: true,
    colors: [{ name: 'Sand', hex: '#C4B59A', sizes: ['M', 'L', 'XL', 'XXL'] }],
  },
  {
    name: 'Premium Cotton Polo',
    slug: 'premium-cotton-polo',
    categorySlug: 'polo-shirts',
    basePrice: 1890,
    colors: [{ name: 'Navy', hex: '#1E2A44', sizes: ['S', 'M', 'L', 'XL'] }],
  },
  {
    name: 'Floral Party Lehenga Set',
    slug: 'floral-party-lehenga-set',
    categorySlug: 'kids-party-wear',
    basePrice: 5490,
    compareAtPrice: 5990,
    colors: [{ name: 'Rose', hex: '#E8A0A0', sizes: ['4-5Y', '6-7Y', '8-9Y'] }],
  },
  {
    name: 'Classic Leather Loafer',
    slug: 'classic-leather-loafer',
    categorySlug: 'footwear',
    basePrice: 4590,
    colors: [{ name: 'Brown', hex: '#6B4423', sizes: ['40', '41', '42', '43', '44'] }],
  },
  {
    name: 'Minimalist Tote Bag',
    slug: 'minimalist-tote-bag',
    categorySlug: 'accessories',
    basePrice: 2490,
    isNewArrival: true,
    colors: [{ name: 'Ivory', hex: '#F0EDE5', sizes: ['One Size'] }],
  },
  {
    name: 'Heritage Block Print Kurti',
    slug: 'heritage-block-print-kurti',
    categorySlug: 'kurti-tunics',
    basePrice: 2790,
    compareAtPrice: 3190,
    colors: [
      { name: 'Indigo', hex: '#2C3E6B', sizes: ['S', 'M', 'L'] },
      { name: 'Terracotta', hex: '#C06040', sizes: ['S', 'M', 'L'] },
    ],
  },
]

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
        passwordHash: hashPassword(resolvedAdminPassword),
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
        email: STORE_CONTACT_EMAIL,
        logo: '/images/logo/splaro-brand-mark-400.webp',
        ownerId: admin.id,
      },
    })
    console.log('Created SPLARO store')
  } else if (store.domain !== 'splaro.co') {
    store = await prisma.store.update({
      where: { id: store.id },
      data: { domain: 'splaro.co', email: STORE_CONTACT_EMAIL },
    })
    console.log('Updated store domain → splaro.co')
  }

  if (!store.phone?.trim()) {
    store = await prisma.store.update({
      where: { id: store.id },
      data: { phone: STORE_CONTACT_PHONE },
    })
    console.log(`Store phone seeded: ${STORE_CONTACT_PHONE}`)
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
    const row = await prisma.category.upsert({
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
    categories[sub.slug] = row.id
  }

  await prisma.category.updateMany({
    where: { storeId: store.id, slug: { in: ['sarees', 'ethnic-wear', 'bridal'] } },
    data: { isActive: true },
  })

  const existingSettings = await prisma.siteSettings.findUnique({ where: { storeId: store.id } })
  await prisma.siteSettings.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      whatsappNumber: STORE_WHATSAPP,
      facebookPixelId: process.env['FB_PIXEL_ID'] ?? process.env['NEXT_PUBLIC_FB_PIXEL_ID'] ?? null,
      googleAnalyticsId: process.env['GA4_MEASUREMENT_ID'] ?? process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] ?? null,
    },
    update: {
      facebookPixelId: process.env['FB_PIXEL_ID'] ?? process.env['NEXT_PUBLIC_FB_PIXEL_ID'] ?? undefined,
      googleAnalyticsId: process.env['GA4_MEASUREMENT_ID'] ?? process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] ?? undefined,
      ...(!existingSettings?.whatsappNumber?.trim() ? { whatsappNumber: STORE_WHATSAPP } : {}),
    },
  })

  let demoProductsSeeded = 0
  for (const demo of DEMO_PRODUCTS) {
    const categoryId = categories[demo.categorySlug]
    const existing = await prisma.product.findUnique({
      where: { storeId_slug: { storeId: store.id, slug: demo.slug } },
      select: { id: true },
    })
    if (existing) continue

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: categoryId ?? categories['women'],
        slug: demo.slug,
        name: demo.name,
        shortDescription: 'Premium SPLARO piece — demo catalog for local development.',
        description: 'Seeded demo product for local storefront development. Replace with real inventory via admin.',
        basePrice: demo.basePrice,
        compareAtPrice: demo.compareAtPrice ?? null,
        isPublished: true,
        isFeatured: demo.isFeatured ?? false,
        isNewArrival: demo.isNewArrival ?? false,
        status: 'PUBLISHED',
        sku: `DEMO-${demo.slug.slice(0, 12).toUpperCase().replace(/-/g, '')}`,
        images: {
          create: [
            {
              url: DEMO_PRODUCT_IMAGE,
              altText: demo.name,
              position: 0,
              isDefault: true,
            },
          ],
        },
        variants: {
          create: demo.colors.flatMap((color) =>
            color.sizes.map((size) => ({
              size,
              color: color.name,
              colorName: color.name,
              colorHex: color.hex,
              price: demo.basePrice,
              compareAtPrice: demo.compareAtPrice ?? null,
              stock: 24,
              isActive: true,
            })),
          ),
        },
      },
    })
    demoProductsSeeded += 1
    console.log(`Seeded demo product: ${product.name}`)
  }

  if (demoProductsSeeded === 0) {
    const productCount = await prisma.product.count({ where: { storeId: store.id, isPublished: true } })
    console.log(`Demo products: skipped (${productCount} published product(s) already in DB)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
