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
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  sarees: [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  'kurti-tunics': [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  panjabi: [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  'polo-shirts': [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  accessories: [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  glasses: [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  'kids-party-wear': [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  'ethnic-wear': [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
  ],
  default: [
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
    '/images/placeholder-product.jpg',
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
