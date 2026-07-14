/**
 * Add demo Unsplash images to products with no image or placeholder only.
 * Run: cd apps/api && npx ts-node --transpile-only scripts/fill-blank-product-images.ts
 */
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

const PLACEHOLDER_MARKERS = ['placeholder-product', 'placehold.co']

const DEMO_IMAGES: Record<string, string[]> = {
  footwear: [
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=900&q=80&auto=format',
  ],
  sarees: [
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=900&q=80&auto=format',
  ],
  'kurti-tunics': [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80&auto=format',
  ],
  panjabi: [
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80&auto=format',
  ],
  'polo-shirts': [
    'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format',
  ],
  accessories: [
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&q=80&auto=format',
  ],
  glasses: [
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80&auto=format',
  ],
  'kids-party-wear': [
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80&auto=format',
  ],
  'ethnic-wear': [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80&auto=format',
  ],
  default: [
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80&auto=format',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80&auto=format',
  ],
}

function isBlankImageUrl(url: string | null | undefined): boolean {
  const value = url?.trim() ?? ''
  if (!value) return true
  return PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))
}

function pickDemoImage(categorySlug: string | null | undefined, productSlug: string): string {
  const pool = DEMO_IMAGES[categorySlug ?? ''] ?? DEMO_IMAGES.default!
  const idx =
    [...productSlug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % pool.length
  return pool[idx]!
}

async function resolveStoreId(): Promise<string> {
  const candidates = [
    process.env['NEXT_PUBLIC_STORE_ID'],
    process.env['DEFAULT_STORE_SLUG'],
    'splaro',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i) as string[]

  for (const candidate of candidates) {
    const store = await prisma.store.findFirst({
      where: { OR: [{ id: candidate }, { slug: candidate }] },
      select: { id: true },
    })
    if (store) return store.id
  }

  throw new Error(`Store not found (${candidates.join(' → ')})`)
}

async function invalidateCatalogCache(storeId: string): Promise<void> {
  if (process.env['REDIS_ENABLED'] === 'false') return

  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: Number(process.env['REDIS_DB'] ?? '0'),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })

  try {
    await redis.connect()
    const resources = ['products', 'product', 'categories', 'collections']
    for (const resource of resources) {
      const pattern = `splaro:${storeId}:${resource}*`
      let cursor = '0'
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        if (keys.length) await redis.del(...keys)
      } while (cursor !== '0')
    }
    console.log('Redis catalog cache cleared')
  } catch (error) {
    console.warn('Redis cache clear skipped:', (error as Error).message)
  } finally {
    redis.disconnect()
  }
}

async function main() {
  const storeId = await resolveStoreId()

  const products = await prisma.product.findMany({
    where: { storeId },
    include: {
      images: { orderBy: { position: 'asc' } },
      category: { select: { slug: true } },
    },
    orderBy: { name: 'asc' },
  })

  let updated = 0

  for (const product of products) {
    const hasRealImage = product.images.some((img) => !isBlankImageUrl(img.url))
    if (hasRealImage) continue

    const demoUrl = pickDemoImage(product.category?.slug, product.slug)

    await prisma.$transaction(async (tx) => {
      if (product.images.length > 0) {
        await tx.productImage.deleteMany({
          where: {
            productId: product.id,
            OR: PLACEHOLDER_MARKERS.map((marker) => ({
              url: { contains: marker },
            })),
          },
        })
      }

      const remaining = await tx.productImage.count({ where: { productId: product.id } })
      if (remaining === 0) {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: demoUrl,
            altText: product.name,
            position: 0,
            isDefault: true,
          },
        })
      }

      await tx.productVariant.updateMany({
        where: {
          productId: product.id,
          OR: [{ image: null }, { image: '' }, ...PLACEHOLDER_MARKERS.map((marker) => ({
            image: { contains: marker },
          }))],
        },
        data: { image: demoUrl },
      })
    })

    updated += 1
    console.log(`✓ ${product.name} → ${demoUrl}`)
  }

  if (updated === 0) {
    console.log('No blank products found — nothing to update.')
    return
  }

  await invalidateCatalogCache(storeId)
  console.log(`\nUpdated ${updated} product(s) with demo images.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
