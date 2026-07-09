/**
 * Seed accessories category tree only — no sample products.
 * Run: cd apps/api && npx ts-node --transpile-only scripts/seed-accessories.ts
 */
import 'reflect-metadata'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ACCESSORY_SUBCATEGORIES = [
  { name: 'Glasses', slug: 'glasses' },
  { name: 'Watches', slug: 'watches' },
  { name: 'Bags', slug: 'bags' },
  { name: 'Handbags', slug: 'handbags' },
  { name: 'Jewelry', slug: 'jewelry' },
  { name: 'Wallets', slug: 'wallets' },
  { name: 'Scarves', slug: 'scarves' },
  { name: 'Belts', slug: 'belts' },
  { name: 'Prayer Caps', slug: 'prayer-caps' },
  { name: 'Home Decor', slug: 'home-decor' },
]

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) throw new Error('Store splaro not found — run main seed first')

  const accessoriesRoot = await prisma.category.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'accessories' } },
    create: { storeId: store.id, name: 'Accessories', slug: 'accessories', sortOrder: 5 },
    update: { isActive: true },
  })

  for (const [index, cat] of ACCESSORY_SUBCATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      create: {
        storeId: store.id,
        parentId: accessoriesRoot.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: index + 1,
      },
      update: { parentId: accessoriesRoot.id, name: cat.name, isActive: true },
    })
  }

  await prisma.collection.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'accessories' } },
    create: {
      storeId: store.id,
      name: 'Accessories',
      slug: 'accessories',
      description: 'Premium eyewear, bags, watches, jewelry and more.',
      sortOrder: 5,
      isActive: true,
    },
    update: { isActive: true },
  })

  console.log('Accessories categories ready — add products from admin catalog')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
