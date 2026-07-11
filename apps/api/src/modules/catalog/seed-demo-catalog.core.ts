import type { PrismaClient } from '@prisma/client'

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
  {
    name: 'Premium Cotton Polo',
    slug: 'premium-cotton-polo',
    categorySlug: 'polo-shirts',
    basePrice: 1890,
    colors: [{ name: 'Navy', hex: '#1E2A44', sizes: ['S', 'M', 'L', 'XL'] }],
  },
  {
    name: 'Minimalist Tote Bag',
    slug: 'minimalist-tote-bag',
    categorySlug: 'accessories',
    basePrice: 2490,
    isNewArrival: true,
    colors: [{ name: 'Ivory', hex: '#F0EDE5', sizes: ['One Size'] }],
  },
]

export interface SeedDemoCatalogResult {
  skipped: boolean
  existingProductCount: number
  productsCreated: number
  slugs: string[]
}

export async function seedDemoCatalogCore(
  prisma: PrismaClient,
  storeId: string,
): Promise<SeedDemoCatalogResult> {
  const existingProductCount = await prisma.product.count({
    where: { storeId },
  })

  if (existingProductCount > 0) {
    return {
      skipped: true,
      existingProductCount,
      productsCreated: 0,
      slugs: [],
    }
  }

  const categories = await prisma.category.findMany({
    where: { storeId, isActive: true },
    select: { id: true, slug: true },
  })
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]))
  const fallbackCategoryId = categories[0]?.id

  const slugs: string[] = []
  let productsCreated = 0

  for (const demo of DEMO_PRODUCTS) {
    const categoryId = categoryBySlug[demo.categorySlug] ?? fallbackCategoryId
    if (!categoryId) continue

    const existing = await prisma.product.findUnique({
      where: { storeId_slug: { storeId, slug: demo.slug } },
      select: { id: true },
    })
    if (existing) continue

    await prisma.product.create({
      data: {
        storeId,
        categoryId,
        slug: demo.slug,
        name: demo.name,
        shortDescription: 'Premium SPLARO piece — demo catalog for checkout testing.',
        description:
          'Seeded demo product. Replace with real inventory via admin when ready.',
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

    productsCreated += 1
    slugs.push(demo.slug)
  }

  return {
    skipped: false,
    existingProductCount: 0,
    productsCreated,
    slugs,
  }
}
