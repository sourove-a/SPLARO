/**
 * Ensures SPLARO category tree: menu departments + subcategories.
 * Run: pnpm db:seed:categories
 */
import { PrismaClient } from '@prisma/client'
import { seedDefaultCategoryTree } from '../src/common/category-seed.util'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) throw new Error('Store splaro not found — run pnpm db:seed first')

  const result = await seedDefaultCategoryTree(prisma, store.id)
  console.log('Category tree seeded:', result)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
