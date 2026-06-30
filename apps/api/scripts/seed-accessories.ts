/**
 * One-shot seed for accessories catalog: subcategories, collection, sample products.
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

const ACCESSORY_PRODUCTS = [
  {
    name: 'Aviator Polarized Sunglasses',
    slug: 'aviator-polarized-sunglasses',
    sku: '268010K',
    basePrice: 3950,
    categorySlug: 'glasses',
    isNewArrival: true,
    image: 'https://images.unsplash.com/photo-1572635196233-14bffa7a35d5?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1511499767150-48fbd19b608a?w=900&h=1125&q=88&fit=crop',
    description: 'UV400 polarized lenses with lightweight metal frame.',
    variants: [{ size: 'OS', color: 'Gold', colorName: 'Gold', colorHex: '#c8a97e', stock: 40 }],
  },
  {
    name: 'Classic Steel Dress Watch',
    slug: 'classic-steel-dress-watch',
    sku: '269220W',
    basePrice: 8900,
    categorySlug: 'watches',
    isBestSeller: true,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=900&h=1125&q=88&fit=crop',
    description: 'Minimalist dial with sapphire-coated glass and steel bracelet.',
    variants: [{ size: 'OS', color: 'Silver', colorName: 'Silver', colorHex: '#c0c0c0', stock: 22 }],
  },
  {
    name: 'Leather Crossbody Bag',
    slug: 'leather-crossbody-bag',
    sku: '267410B',
    basePrice: 6200,
    categorySlug: 'bags',
    isBestSeller: true,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&h=1125&q=88&fit=crop',
    description: 'Full-grain leather with adjustable strap and gold hardware.',
    variants: [
      { size: 'OS', color: 'Tan', colorName: 'Tan', colorHex: '#c4a574', stock: 18 },
      { size: 'OS', color: 'Black', colorName: 'Black', colorHex: '#111111', stock: 24 },
    ],
  },
  {
    name: 'Premium Leather Wallet',
    slug: 'premium-leather-wallet',
    sku: '266880L',
    basePrice: 2800,
    categorySlug: 'wallets',
    image: 'https://images.unsplash.com/photo-1627123424574-10b995f34d28?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1606107557195-0f29cb4c3ada?w=900&h=1125&q=88&fit=crop',
    description: 'Slim bifold wallet with RFID lining.',
    variants: [{ size: 'OS', color: 'Black', colorName: 'Black', colorHex: '#111111', stock: 55 }],
  },
  {
    name: 'Gold Hoop Earrings',
    slug: 'gold-hoop-earrings',
    sku: '265120J',
    basePrice: 4500,
    categorySlug: 'jewelry',
    isNewArrival: true,
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=900&h=1125&q=88&fit=crop',
    description: '18K gold-plated hoops with hypoallergenic posts.',
    variants: [{ size: 'OS', color: 'Gold', colorName: 'Gold', colorHex: '#c8a97e', stock: 30 }],
  },
  {
    name: 'Embroidered Prayer Cap',
    slug: 'embroidered-prayer-cap',
    sku: '264050P',
    basePrice: 1200,
    categorySlug: 'prayer-caps',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&h=1125&q=88&fit=crop',
    description: 'Hand-finished embroidery on breathable cotton.',
    variants: [
      { size: 'M', color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 60 },
      { size: 'L', color: 'White', colorName: 'White', colorHex: '#ffffff', stock: 45 },
    ],
  },
  {
    name: 'Silk Blend Scarf',
    slug: 'silk-blend-scarf',
    sku: '263330S',
    basePrice: 3400,
    categorySlug: 'scarves',
    image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&h=1125&q=88&fit=crop',
    description: 'Lightweight silk blend with hand-rolled edges.',
    variants: [{ size: 'OS', color: 'Ivory', colorName: 'Ivory', colorHex: '#f2f0e8', stock: 35 }],
  },
  {
    name: 'Italian Leather Belt',
    slug: 'italian-leather-belt',
    sku: '262770T',
    basePrice: 3100,
    categorySlug: 'belts',
    image: 'https://images.unsplash.com/photo-1624222247344-550fb60583fd?w=900&h=1125&q=88&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&h=1125&q=88&fit=crop',
    description: 'Brushed buckle with vegetable-tanned leather strap.',
    variants: [
      { size: '32', color: 'Brown', colorName: 'Brown', colorHex: '#6b4423', stock: 20 },
      { size: '34', color: 'Brown', colorName: 'Brown', colorHex: '#6b4423', stock: 25 },
    ],
  },
]

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) throw new Error('Store splaro not found — run main seed first')

  const accessoriesRoot = await prisma.category.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'accessories' } },
    create: { storeId: store.id, name: 'Accessories', slug: 'accessories', sortOrder: 5 },
    update: { isActive: true },
  })

  const categoryIds: Record<string, string> = { accessories: accessoriesRoot.id }

  for (const [index, cat] of ACCESSORY_SUBCATEGORIES.entries()) {
    const row = await prisma.category.upsert({
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
    categoryIds[cat.slug] = row.id
  }

  const collection = await prisma.collection.upsert({
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

  let created = 0
  for (const p of ACCESSORY_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, slug: p.slug },
    })
    if (existing) {
      await prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: { collectionId: collection.id, productId: existing.id },
        },
        create: { collectionId: collection.id, productId: existing.id, sortOrder: created },
        update: {},
      })
      continue
    }

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        basePrice: p.basePrice,
        categoryId: categoryIds[p.categorySlug] ?? accessoriesRoot.id,
        isPublished: true,
        isNewArrival: p.isNewArrival ?? false,
        isBestSeller: p.isBestSeller ?? false,
        description: p.description,
        origin: 'Bangladesh',
        images: {
          create: [
            { url: p.image, position: 0, altText: p.name },
            { url: p.hoverImage, position: 1, altText: `${p.name} alternate` },
          ],
        },
        variants: {
          create: p.variants.map((v) => ({
            size: v.size,
            color: v.color,
            colorName: v.colorName,
            colorHex: v.colorHex,
            price: p.basePrice,
            stock: v.stock,
            image: p.image,
          })),
        },
      },
    })

    await prisma.collectionProduct.create({
      data: { collectionId: collection.id, productId: product.id, sortOrder: created },
    })
    created += 1
    console.log(`Seeded accessory: ${p.name}`)
  }

  console.log(`Done — ${created} new accessory products, collection "${collection.slug}" ready`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
