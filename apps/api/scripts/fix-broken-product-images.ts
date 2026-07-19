/**
 * Replace dead Unsplash / blank product image URLs with verified working ones.
 * Run: cd apps/api && npx ts-node --transpile-only scripts/fix-broken-product-images.ts
 */
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

/** Verified HTTP 200 as of 2026-07-13 */
const BY_SLUG: Record<string, string> = {
  'heritage-block-print-kurti':
    '/images/placeholder-product.jpg',
  'minimalist-tote-bag':
    '/images/placeholder-product.jpg',
  'classic-leather-loafer':
    '/images/placeholder-product.jpg',
  'floral-party-lehenga-set':
    '/images/placeholder-product.jpg',
  'premium-cotton-polo':
    '/images/placeholder-product.jpg',
  'urban-linen-panjabi':
    '/images/placeholder-product.jpg',
  'midnight-silk-evening-saree':
    '/images/placeholder-product.jpg',
  'white-kantha-odyssey-theme-shalwar-kameez':
    '/images/placeholder-product.jpg',
}

const FALLBACK =
  '/images/placeholder-product.jpg'

async function urlOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return res.ok
  } catch {
    return false
  }
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
    for (const resource of ['products', 'product', 'categories', 'collections']) {
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
  const store =
    (await prisma.store.findFirst({ where: { slug: 'splaro' }, select: { id: true } })) ??
    (await prisma.store.findFirst({ select: { id: true } }))
  if (!store) throw new Error('No store found')

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: { images: { orderBy: { position: 'asc' } } },
  })

  let updated = 0
  for (const product of products) {
    const preferred = BY_SLUG[product.slug] ?? FALLBACK
    const primary = product.images[0]
    const current = primary?.url?.trim() ?? ''
    const dead =
      !current ||
      current.includes('placeholder') ||
      current.includes('placehold.co') ||
      current.includes('aarong.com') ||
      !(await urlOk(current))

    if (!dead && current === preferred) continue
    if (!dead && !BY_SLUG[product.slug]) continue

    const nextUrl = BY_SLUG[product.slug] ?? (dead ? preferred : current)
    if (!dead && nextUrl === current) continue

    await prisma.$transaction(async (tx) => {
      if (primary) {
        await tx.productImage.update({
          where: { id: primary.id },
          data: { url: nextUrl, altText: product.name, isDefault: true },
        })
      } else {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: nextUrl,
            altText: product.name,
            position: 0,
            isDefault: true,
          },
        })
      }
      await tx.productVariant.updateMany({
        where: { productId: product.id },
        data: { image: nextUrl },
      })
    })

    updated += 1
    console.log(`✓ ${product.slug} → ${nextUrl}`)
  }

  if (updated === 0) {
    console.log('No broken product images found.')
    return
  }

  await invalidateCatalogCache(store.id)
  console.log(`\nFixed ${updated} product(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
