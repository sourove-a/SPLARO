import type { PrismaClient } from '@prisma/client'

const DEMO_INVOICE = 'SPL-1001'
const DEMO_PO_NUMBER = 'PO-SEED-001'
const DEMO_FABRIC_NAME = 'Premium Cotton'
const DEMO_PRODUCTION_NAME = 'Embroidered Saree'
const DEMO_SUPPLIER_NAMES = ['Bangla Fabrics Ltd', 'Dhaka Packaging Co']
const STOCK_MEDIA = /unsplash\.com|pexels\.com/i

function productUsesStockMedia(product: {
  sku: string | null
  slug: string
  description: string | null
  shortDescription: string | null
  images: { url: string }[]
  variants: { image: string | null }[]
}): boolean {
  if (/^DEMO-/i.test(product.sku?.trim() ?? '')) return true
  if (product.slug === 'heritage-jamdani-saree') return true
  if (
    /seeded demo product|demo catalog for (?:checkout testing|local development)/i.test(
      `${product.description ?? ''} ${product.shortDescription ?? ''}`,
    )
  ) {
    return true
  }
  const urls = [
    ...product.images.map((image) => image.url),
    ...product.variants.map((variant) => variant.image).filter((url): url is string => Boolean(url)),
  ]
  return urls.some((url) => STOCK_MEDIA.test(url))
}

export interface PurgeDemoCatalogResult {
  demoProductsFound: number
  demoOrdersRemoved: number
  demoProductsRemoved: number
  demoProductsSkipped: number
  ordersTiedToDemoRemoved: number
  purchaseOrdersRemoved: number
  fabricRowsRemoved: number
  productionBatchesRemoved: number
  suppliersRemoved: number
}

async function removeOrders(prisma: PrismaClient, orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0

  const invoices = await prisma.invoice.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  })
  const invoiceIds = invoices.map((invoice) => invoice.id)
  if (invoiceIds.length > 0) {
    await prisma.printJob.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } })
  }

  await prisma.printJob.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.profitCalculation.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.partnerTransaction.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.googleSheetSync.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.notification.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.aIJob.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.deliveryAssignment.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.courierShipment.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } })

  const orderItemIds = (
    await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    })
  ).map((item) => item.id)

  if (orderItemIds.length > 0) {
    await prisma.rMAItem.deleteMany({ where: { orderItemId: { in: orderItemIds } } })
  }

  const rmaIds = (
    await prisma.rMA.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    })
  ).map((rma) => rma.id)

  if (rmaIds.length > 0) {
    await prisma.rMAStatusHistory.deleteMany({ where: { rmaId: { in: rmaIds } } })
    await prisma.rMA.deleteMany({ where: { id: { in: rmaIds } } })
  }

  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderNote.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.splitShipment.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })

  const removed = await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
  return removed.count
}

export async function purgeDemoCatalogCore(
  prisma: PrismaClient,
  storeId: string,
): Promise<PurgeDemoCatalogResult> {
  const result: PurgeDemoCatalogResult = {
    demoProductsFound: 0,
    demoOrdersRemoved: 0,
    demoProductsRemoved: 0,
    demoProductsSkipped: 0,
    ordersTiedToDemoRemoved: 0,
    purchaseOrdersRemoved: 0,
    fabricRowsRemoved: 0,
    productionBatchesRemoved: 0,
    suppliersRemoved: 0,
  }

  const demoOrderIds = (
    await prisma.order.findMany({
      where: {
        storeId,
        OR: [{ invoiceNumber: DEMO_INVOICE }, { shippingName: 'Ayesha Rahman', shippingPhone: '01711223344' }],
      },
      select: { id: true },
    })
  ).map((order) => order.id)
  result.demoOrdersRemoved = await removeOrders(prisma, demoOrderIds)

  const products = await prisma.product.findMany({
    where: { storeId },
    include: { images: true, variants: true },
  })

  const demoProductIds = products
    .filter((product) => productUsesStockMedia(product))
    .map((product) => product.id)

  result.demoProductsFound = demoProductIds.length

  if (demoProductIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.wishlistItem.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.collectionProduct.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.inventoryLog.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.review.deleteMany({ where: { productId: { in: demoProductIds } } })
    await prisma.aIJob.deleteMany({ where: { productId: { in: demoProductIds } } })

    const blockingItems = await prisma.orderItem.findMany({
      where: { productId: { in: demoProductIds } },
      select: { id: true, orderId: true },
    })
    if (blockingItems.length > 0) {
      await prisma.rMAItem.deleteMany({
        where: { orderItemId: { in: blockingItems.map((item) => item.id) } },
      })
      await prisma.orderItem.deleteMany({ where: { productId: { in: demoProductIds } } })

      const blockingOrderIds = [...new Set(blockingItems.map((item) => item.orderId))]
      result.ordersTiedToDemoRemoved = await removeOrders(prisma, blockingOrderIds)
    }

    await prisma.productVersion.deleteMany({ where: { productId: { in: demoProductIds } } })

    const deletedProducts = await prisma.product.deleteMany({
      where: { id: { in: demoProductIds } },
    })
    result.demoProductsRemoved = deletedProducts.count
    result.demoProductsSkipped = demoProductIds.length - deletedProducts.count
  }

  const po = await prisma.purchaseOrder.deleteMany({
    where: { storeId, poNumber: DEMO_PO_NUMBER },
  })
  result.purchaseOrdersRemoved = po.count

  const fabric = await prisma.fabricInventory.deleteMany({
    where: { storeId, name: DEMO_FABRIC_NAME },
  })
  result.fabricRowsRemoved = fabric.count

  const production = await prisma.productionOrder.deleteMany({
    where: { storeId, productName: DEMO_PRODUCTION_NAME },
  })
  result.productionBatchesRemoved = production.count

  const demoSuppliers = await prisma.supplier.findMany({
    where: { storeId, name: { in: DEMO_SUPPLIER_NAMES } },
    select: { id: true },
  })
  if (demoSuppliers.length > 0) {
    const supplierIds = demoSuppliers.map((supplier) => supplier.id)
    const purchaseOrders = await prisma.purchaseOrder.deleteMany({
      where: { supplierId: { in: supplierIds } },
    })
    result.purchaseOrdersRemoved += purchaseOrders.count

    const suppliers = await prisma.supplier.deleteMany({
      where: { id: { in: supplierIds } },
    })
    result.suppliersRemoved = suppliers.count
  }

  return result
}
