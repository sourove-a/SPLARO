import type { PrismaClient } from '@prisma/client'
import { CATEGORY_DEPARTMENTS, CATEGORY_SUBCATEGORIES } from '@splaro/config'

const LOCKED_ROOT_SLUGS = new Set<string>(CATEGORY_DEPARTMENTS.map((dept) => dept.slug))

/** Explicit leftovers from a flat admin tree (screenshot aliases). */
const SLUG_ALIASES: Record<string, string> = {
  tote: 'handbags',
  clutches: 'handbags',
  premium: 'bags',
  luxury: 'bags',
  sunglasses: 'glasses',
  optical: 'glasses',
  aviator: 'glasses',
  'cat-eye': 'glasses',
  'polo-shirt': 'men',
  'polo-shirts': 'men',
  'salwar-kameez': 'women',
  'shalwar-kameez': 'women',
  kameez: 'women',
  'womens-bags': 'bags',
  'women-bags': 'bags',
  'womens-shoes': 'footwear',
  'women-shoes': 'footwear',
  'mens-shoes': 'footwear',
  'men-shoes': 'footwear',
  jewellery: 'accessories',
}

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
  hats: 'accessories',
  clutch: 'handbags',
  clutches: 'handbags',
  cardholder: 'accessories',
  'prayer-mats': 'accessories',
  'glasses-sunglasses': 'glasses',
  'glasses-optical': 'glasses',
  'glasses-aviator': 'glasses',
  'glasses-cat-eye': 'glasses',
  'bags-premium': 'bags',
  'bags-luxury': 'bags',
  'bags-ws': 'bags',
  'handbags-tote': 'handbags',
  'handbags-shoulder': 'handbags',
}

const KIDS_KEYWORDS = [
  'kid',
  'baby',
  'child',
  'girl',
  'boy',
  'toddler',
  'infant',
  'ghagra',
  'choli',
  'frock',
  'school',
  'newborn',
]
const FOOTWEAR_KEYWORDS = ['foot', 'shoe', 'sandal', 'sneaker', 'boot', 'loafer', 'heel']
const ACCESSORY_KEYWORDS = [
  'accessor',
  'glass',
  'watch',
  'bag',
  'handbag',
  'jewel',
  'wallet',
  'scarf',
  'belt',
  'clutch',
  'cap',
  'hat',
  'cardholder',
  'decor',
  'tote',
]
const WOMEN_KEYWORDS = [
  'saree',
  'ethnic',
  'bridal',
  'kurti',
  'kurta',
  'dress',
  'legging',
  'western',
  'blouse',
  'tops',
  'women',
  'woman',
  'lehenga',
  'shalwar',
  'salwar',
  'hijab',
  'abaya',
  'kameez',
]
const MEN_KEYWORDS = ['panjabi', 'polo', 'formal', 'men', 'man', 'shirt', 'pant', 'trouser', 'fatua']

function liteSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((key) => text.includes(key))
}

function keywordParentSlug(slug: string, name: string): string | null {
  const text = `${slug} ${name}`.toLowerCase()
  if (hasKeyword(text, KIDS_KEYWORDS)) return 'kids'
  if (hasKeyword(text, FOOTWEAR_KEYWORDS)) return 'footwear'
  if (hasKeyword(text, ACCESSORY_KEYWORDS)) return 'accessories'
  if (hasKeyword(text, WOMEN_KEYWORDS)) return 'women'
  if (hasKeyword(text, MEN_KEYWORDS)) return 'men'
  return null
}

function subcategoryParentBySlug(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [parentSlug, items] of Object.entries(CATEGORY_SUBCATEGORIES)) {
    for (const item of items) {
      map[item.slug] = parentSlug
      map[liteSlug(item.name)] = parentSlug
    }
  }
  return map
}

const SUBCATEGORY_PARENT = subcategoryParentBySlug()

/** Parent slug for a leftover root category. Never returns a locked department as the child. */
export function resolveReparentParentSlug(slug: string, name = ''): string | null {
  const key = liteSlug(slug)
  if (!key || LOCKED_ROOT_SLUGS.has(key)) return null
  if (SLUG_ALIASES[key]) return SLUG_ALIASES[key]
  if (SUBCATEGORY_PARENT[key]) return SUBCATEGORY_PARENT[key]
  if (REPARENT[key]) return REPARENT[key]
  if (REPARENT[slug]) return REPARENT[slug]
  return keywordParentSlug(key, name)
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
  const parentIdBySlug: Record<string, string> = { ...deptIds }
  for (const [parentSlug, items] of Object.entries(CATEGORY_SUBCATEGORIES)) {
    const parentId = parentIdBySlug[parentSlug]
    if (!parentId) continue
    for (const [index, item] of items.entries()) {
      const row = await prisma.category.upsert({
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
      parentIdBySlug[item.slug] = row.id
      subs++
    }
  }

  let reparented = 0
  const seen = new Set<string>()
  for (const [slug, parentSlug] of Object.entries(REPARENT)) {
    const parentId = parentIdBySlug[parentSlug]
    if (!parentId) continue
    const updated = await prisma.category.updateMany({
      where: { storeId, slug, parentId: null },
      data: { parentId },
    })
    reparented += updated.count
    seen.add(slug)
  }

  const leftovers = await prisma.category.findMany({
    where: {
      storeId,
      parentId: null,
      slug: { notIn: [...LOCKED_ROOT_SLUGS] },
    },
    select: { id: true, slug: true, name: true },
  })

  for (const row of leftovers) {
    if (seen.has(row.slug)) continue
    const parentSlug = resolveReparentParentSlug(row.slug, row.name)
    const parentId = parentSlug ? parentIdBySlug[parentSlug] : undefined
    if (!parentId || parentId === row.id) continue
    await prisma.category.update({ where: { id: row.id }, data: { parentId } })
    reparented += 1
  }

  return { departments: CATEGORY_DEPARTMENTS.length, subcategories: subs, reparented }
}
