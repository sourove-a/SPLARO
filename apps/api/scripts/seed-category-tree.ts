/**
 * Ensures SPLARO category tree: menu departments + subcategories (Kids, Women, Men…).
 * Run: cd apps/api && npx ts-node --transpile-only scripts/seed-category-tree.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEPARTMENTS = [
  { name: 'Women', slug: 'women', sortOrder: 1 },
  { name: 'Men', slug: 'men', sortOrder: 2 },
  { name: 'Kids', slug: 'kids', sortOrder: 3 },
  { name: 'Footwear', slug: 'footwear', sortOrder: 4 },
  { name: 'Accessories', slug: 'accessories', sortOrder: 5 },
  { name: 'New Arrivals', slug: 'new-arrivals', sortOrder: 6 },
] as const

const SUBCATEGORIES: Record<string, { name: string; slug: string }[]> = {
  kids: [
    { name: 'Girls Wear', slug: 'girls-wear' },
    { name: 'Boys Wear', slug: 'boys-wear' },
    { name: 'Baby & Toddler', slug: 'baby-toddler' },
    { name: 'Ethnic Kids', slug: 'ethnic-kids' },
    { name: 'Ghagra & Lehenga', slug: 'kids-ghagra-lehenga' },
    { name: 'Party Wear', slug: 'kids-party-wear' },
    { name: 'School Wear', slug: 'school-wear' },
  ],
  women: [
    { name: 'Sarees', slug: 'sarees' },
    { name: 'Ethnic Wear', slug: 'ethnic-wear' },
    { name: 'Kurti & Tunics', slug: 'kurti-tunics' },
    { name: 'Dresses', slug: 'dresses' },
    { name: 'Western Wear', slug: 'western-wear' },
    { name: 'Bridal', slug: 'bridal' },
    { name: 'Tops & Tees', slug: 'tops-tees' },
    { name: 'Denim & Jeans', slug: 'denim-jeans' },
    { name: 'Leggings', slug: 'leggings' },
  ],
  men: [
    { name: 'Panjabi', slug: 'panjabi' },
    { name: 'T-Shirts', slug: 't-shirts' },
    { name: 'Polo Shirts', slug: 'polo-shirts' },
    { name: 'Formal Shirts', slug: 'formal-shirts' },
    { name: 'Casual Wear', slug: 'men-casual' },
    { name: 'Trousers', slug: 'trousers' },
  ],
  footwear: [
    { name: 'Women Footwear', slug: 'women-footwear' },
    { name: 'Men Footwear', slug: 'men-footwear' },
    { name: 'Kids Footwear', slug: 'kids-footwear' },
    { name: 'Sandals', slug: 'sandals' },
    { name: 'Sneakers', slug: 'sneakers' },
  ],
}

/** Flat legacy slugs → parent department */
const REPARENT: Record<string, string> = {
  sarees: 'women',
  'ethnic-wear': 'women',
  bridal: 'women',
  glasses: 'accessories',
  jewellery: 'accessories',
  jewelry: 'accessories',
  clutches: 'accessories',
  'girls-wear': 'kids',
  'boys-wear': 'kids',
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) throw new Error('Store splaro not found — run pnpm db:seed first')

  const deptIds: Record<string, string> = {}

  for (const dept of DEPARTMENTS) {
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: dept.slug } },
      create: {
        storeId: store.id,
        name: dept.name,
        slug: dept.slug,
        sortOrder: dept.sortOrder,
        parentId: null,
      },
      update: { name: dept.name, sortOrder: dept.sortOrder, isActive: true, parentId: null },
    })
    deptIds[dept.slug] = row.id
  }

  let subs = 0
  for (const [parentSlug, items] of Object.entries(SUBCATEGORIES)) {
    const parentId = deptIds[parentSlug]
    if (!parentId) continue
    for (const [index, item] of items.entries()) {
      await prisma.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: item.slug } },
        create: {
          storeId: store.id,
          parentId,
          name: item.name,
          slug: item.slug,
          sortOrder: index + 1,
        },
        update: { parentId, name: item.name, isActive: true, sortOrder: index + 1 },
      })
      subs++
    }
  }

  let reparented = 0
  for (const [slug, parentSlug] of Object.entries(REPARENT)) {
    const parentId = deptIds[parentSlug]
    if (!parentId) continue
    const updated = await prisma.category.updateMany({
      where: { storeId: store.id, slug, parentId: null },
      data: { parentId },
    })
    reparented += updated.count
  }

  console.log(`Category tree OK — ${DEPARTMENTS.length} menus, ${subs} subcategories, ${reparented} reparented.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
