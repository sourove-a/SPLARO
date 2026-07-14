/**
 * One-shot: fill missing product metaTitle/metaDescription for published catalog.
 * Run: pnpm --filter @splaro/api exec tsx scripts/fill-missing-product-seo.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  buildProductMetaDescription,
  buildProductMetaTitle,
  hasMetaValue,
} from '../src/common/seo-meta.util'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) {
    console.error('Store splaro not found')
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    where: {
      storeId: store.id,
      isPublished: true,
      OR: [
        { metaTitle: null },
        { metaTitle: '' },
        { metaDescription: null },
        { metaDescription: '' },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      shortDescription: true,
      metaTitle: true,
      metaDescription: true,
    },
  })

  if (products.length === 0) {
    console.log('All published products already have meta title and description.')
    return
  }

  let updated = 0
  for (const product of products) {
    const needsTitle = !hasMetaValue(product.metaTitle)
    const needsDescription = !hasMetaValue(product.metaDescription)
    if (!needsTitle && !needsDescription) continue

    await prisma.product.update({
      where: { id: product.id },
      data: {
        ...(needsTitle ? { metaTitle: buildProductMetaTitle(product.name) } : {}),
        ...(needsDescription
          ? { metaDescription: buildProductMetaDescription(product.name, product.description, product.shortDescription) }
          : {}),
      },
    })
    updated += 1
    console.log(`✓ ${product.name}`)
  }

  console.log(`\nUpdated ${updated} product(s). Re-open SEO Health in admin and click Refresh.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
