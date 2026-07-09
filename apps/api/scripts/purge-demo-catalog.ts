/**
 * Remove demo/seed catalog from the live database (Unsplash products, SPL-1001, seed POs, etc.).
 * Run: pnpm db:purge-demo
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_INVOICE = 'SPL-1001'
const DEMO_PO_NUMBER = 'PO-SEED-001'
const DEMO_FABRIC_NAME = 'Premium Cotton'
const DEMO_PRODUCTION_NAME = 'Embroidered Saree'
const DEMO_SUPPLIER_NAMES = ['Bangla Fabrics Ltd', 'Dhaka Packaging Co']
const STOCK_MEDIA = /unsplash\.com|pexels\.com/i

function productUsesStockMedia(product: {
  images: { url: string }[]
  variants: { image: string | null }[]
}): boolean {
  const urls = [
    ...product.images.map((image) => image.url),
    ...product.variants.map((variant) => variant.image).filter((url): url is string => Boolean(url)),
  ]
  return urls.some((url) => STOCK_MEDIA.test(url))
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) {
    console.log('No splaro store found — nothing to purge.')
    return
  }

  const demoOrders = await prisma.order.deleteMany({
    where: {
      storeId: store.id,
      OR: [{ invoiceNumber: DEMO_INVOICE }, { shippingName: 'Ayesha Rahman', shippingPhone: '01711223344' }],
    },
  })
  console.log(`Removed ${demoOrders.count} demo order(s)`)

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: { images: true, variants: true },
  })

  const demoProductIds = products
    .filter((product) => productUsesStockMedia(product) || product.slug === 'heritage-jamdani-saree')
    .map((product) => product.id)

  if (demoProductIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.wishlistItem.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.collectionProduct.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.inventoryLog.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.review.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.aIJob.deleteMany({ where: { productId: { in: demoProductIds } } })

    const blockingItems = await prisma.orderItem.findMany({
      where: { productId: { in: demoProductIds } },
      select: { orderId: true },
    })
    const blockingOrderIds = [...new Set(blockingItems.map((item) => item.orderId))]
    if (blockingOrderIds.length > 0) {
      const removedOrders = await prisma.order.deleteMany({ where: { id: { in: blockingOrderIds } } })
      console.log(`Removed ${removedOrders.count} order(s) tied to demo products`)
    }

    const deletedProducts = await prisma.product.deleteMany({
      where: {
        id: { in: demoProductIds },
        orderItems: { none: {} },
      },
    })
    console.log(`Removed ${deletedProducts.count} demo product(s)`)

    const skipped = demoProductIds.length - deletedProducts.count
    if (skipped > 0) {
      console.warn(`${skipped} demo product(s) still referenced by orders — review manually in admin`)
    }
  } else {
    console.log('No demo products found in catalog')
  }

  const po = await prisma.purchaseOrder.deleteMany({
    where: { storeId: store.id, poNumber: DEMO_PO_NUMBER },
  })
  if (po.count) console.log(`Removed ${po.count} seed purchase order(s)`)

  const fabric = await prisma.fabricInventory.deleteMany({
    where: { storeId: store.id, name: DEMO_FABRIC_NAME },
  })
  if (fabric.count) console.log(`Removed ${fabric.count} seed fabric row(s)`)

  const production = await prisma.productionOrder.deleteMany({
    where: { storeId: store.id, productName: DEMO_PRODUCTION_NAME },
  })
  if (production.count) console.log(`Removed ${production.count} seed production batch(es)`)

  const demoSuppliers = await prisma.supplier.findMany({
    where: { storeId: store.id, name: { in: DEMO_SUPPLIER_NAMES } },
    select: { id: true },
  })
  if (demoSuppliers.length > 0) {
    const supplierIds = demoSuppliers.map((supplier) => supplier.id)
    const purchaseOrders = await prisma.purchaseOrder.deleteMany({
      where: { supplierId: { in: supplierIds } },
    })
    if (purchaseOrders.count) console.log(`Removed ${purchaseOrders.count} purchase order(s) for seed suppliers`)

    const suppliers = await prisma.supplier.deleteMany({
      where: { id: { in: supplierIds } },
    })
    if (suppliers.count) console.log(`Removed ${suppliers.count} seed supplier(s)`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
