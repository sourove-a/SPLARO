import type { PrismaClient } from '@prisma/client'
import { CATEGORY_DEPARTMENTS, CATEGORY_SUBCATEGORIES } from '@splaro/config'

const REPARENT: Record<string, string> = {
  sarees: 'women',
  'ethnic-wear': 'women',
  bridal: 'women',
  kameez: 'women',
  'single-kameez': 'women',
  'single-kurti': 'women',
  'western-tops': 'women',
  'burqa-abaya': 'women',
  'shalwar-kameez': 'women',
  glasses: 'accessories',
  jewellery: 'accessories',
  jewelry: 'accessories',
  clutches: 'accessories',
  bags: 'accessories',
  handbags: 'accessories',
  'girls-wear': 'kids',
  'boys-wear': 'kids',
  'casual-shirts': 'men',
  blazers: 'men',
  'full-sleeve': 'men',
  'half-sleeve': 'men',
  'formal-pants': 'men',
  'denim-pants': 'men',
  'chino-pants': 'men',
  joggers: 'men',
  'relax-wear': 'men',
  lungi: 'men',
  heels: 'footwear',
  flats: 'footwear',
  loafers: 'footwear',
  'women-footwear': 'footwear',
  'men-footwear': 'footwear',
}

export async function seedDefaultCategoryTree(
  prisma: PrismaClient,
  storeId: string,
): Promise<{ departments: number; subcategories: number; reparented: number }> {
  const deptIds: Record<string, string> = {}

  for (const dept of CATEGORY_DEPARTMENTS) {
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId, slug: dept.slug } },
      create: {
        storeId,
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
  for (const [parentSlug, items] of Object.entries(CATEGORY_SUBCATEGORIES)) {
    const parentId = deptIds[parentSlug]
    if (!parentId) continue
    for (const [index, item] of items.entries()) {
      await prisma.category.upsert({
        where: { storeId_slug: { storeId, slug: item.slug } },
        create: {
          storeId,
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
      where: { storeId, slug, parentId: null },
      data: { parentId },
    })
    reparented += updated.count
  }

  return { departments: CATEGORY_DEPARTMENTS.length, subcategories: subs, reparented }
}
