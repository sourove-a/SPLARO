import type { PrismaClient } from '@prisma/client'

const DEMO_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format'

const DEMO_COLOR_IMAGES = {
  // Clearly indigo/navy garment — matches “Indigo” colour name on PDP
  indigo: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&q=80&auto=format',
  // Warm orange ethnic wear — matches “Terracotta” colour name on PDP
  terracotta: 'https://images.unsplash.com/photo-1594709287485-447f40e8d7a8?w=900&q=80&auto=format',
  navy: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80&auto=format',
  ivory: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=80&auto=format',
} as const

type DemoProductSeed = {
  name: string
  slug: string
  categorySlug: string
  basePrice: number
  compareAtPrice?: number
  isFeatured?: boolean
  isNewArrival?: boolean
  gallery?: string[]
  colors: { name: string; hex: string; sizes: string[]; image?: string }[]
}

const DEMO_PRODUCTS: DemoProductSeed[] = [
  {
    name: 'Heritage Block Print Kurti',
    slug: 'heritage-block-print-kurti',
    categorySlug: 'kurti-tunics',
    basePrice: 2790,
    compareAtPrice: 3190,
    gallery: [DEMO_COLOR_IMAGES.indigo, DEMO_COLOR_IMAGES.terracotta],
    colors: [
      {
        name: 'Indigo',
        hex: '#2C3E6B',
        sizes: ['S', 'M', 'L'],
        image: DEMO_COLOR_IMAGES.indigo,
      },
      {
        name: 'Terracotta',
        hex: '#C06040',
        sizes: ['S', 'M', 'L'],
        image: DEMO_COLOR_IMAGES.terracotta,
      },
    ],
  },
  {
    name: 'Premium Cotton Polo',
    slug: 'premium-cotton-polo',
    categorySlug: 'polo-shirts',
    basePrice: 1890,
    gallery: [DEMO_COLOR_IMAGES.navy],
    colors: [
      {
        name: 'Navy',
        hex: '#1E2A44',
        sizes: ['S', 'M', 'L', 'XL'],
        image: DEMO_COLOR_IMAGES.navy,
      },
    ],
  },
  {
    name: 'Minimalist Tote Bag',
    slug: 'minimalist-tote-bag',
    categorySlug: 'accessories',
    basePrice: 2490,
    isNewArrival: true,
    gallery: [DEMO_COLOR_IMAGES.ivory],
    colors: [
      {
        name: 'Ivory',
        hex: '#F0EDE5',
        sizes: ['One Size'],
        image: DEMO_COLOR_IMAGES.ivory,
      },
    ],
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
        shortDescription: 'Premium SPLARO piece — available now.',
        description:
          'Crafted for everyday elegance with refined finishing and breathable comfort. Update photos and copy in admin when your final inventory is ready.',
        basePrice: demo.basePrice,
        compareAtPrice: demo.compareAtPrice ?? null,
        isPublished: true,
        isFeatured: demo.isFeatured ?? false,
        isNewArrival: demo.isNewArrival ?? false,
        status: 'PUBLISHED',
        sku: `DEMO-${demo.slug.slice(0, 12).toUpperCase().replace(/-/g, '')}`,
        images: {
          create: (demo.gallery?.length ? demo.gallery : [DEMO_PRODUCT_IMAGE]).map(
            (url, position) => ({
              url,
              altText: demo.name,
              position,
              isDefault: position === 0,
            }),
          ),
        },
        variants: {
          create: demo.colors.flatMap((color) =>
            color.sizes.map((size) => ({
              size,
              color: color.name,
              colorName: color.name,
              colorHex: color.hex,
              image: color.image ?? demo.gallery?.[0] ?? DEMO_PRODUCT_IMAGE,
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
