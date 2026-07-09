import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

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

export interface PurgeDemoCatalogResult {
  demoOrdersRemoved: number
  demoProductsRemoved: number
  demoProductsSkipped: number
  ordersTiedToDemoRemoved: number
  purchaseOrdersRemoved: number
  fabricRowsRemoved: number
  productionBatchesRemoved: number
  suppliersRemoved: number
}

@Injectable()
export class PurgeDemoCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async purge(storeIdOrSlug: string): Promise<PurgeDemoCatalogResult> {
    const sid = await resolveStoreId(this.prisma, storeIdOrSlug)

    const result: PurgeDemoCatalogResult = {
      demoOrdersRemoved: 0,
      demoProductsRemoved: 0,
      demoProductsSkipped: 0,
      ordersTiedToDemoRemoved: 0,
      purchaseOrdersRemoved: 0,
      fabricRowsRemoved: 0,
      productionBatchesRemoved: 0,
      suppliersRemoved: 0,
    }

    const demoOrders = await this.prisma.order.deleteMany({
      where: {
        storeId: sid,
        OR: [{ invoiceNumber: DEMO_INVOICE }, { shippingName: 'Ayesha Rahman', shippingPhone: '01711223344' }],
      },
    })
    result.demoOrdersRemoved = demoOrders.count

    const products = await this.prisma.product.findMany({
      where: { storeId: sid },
      include: { images: true, variants: true },
    })

    const demoProductIds = products
      .filter((product) => productUsesStockMedia(product) || product.slug === 'heritage-jamdani-saree')
      .map((product) => product.id)

    if (demoProductIds.length > 0) {
      await this.prisma.cartItem.deleteMany({ where: { productId: { in: demoProductIds } } })
      await this.prisma.wishlistItem.deleteMany({ where: { productId: { in: demoProductIds } } })
      await this.prisma.collectionProduct.deleteMany({ where: { productId: { in: demoProductIds } } })
      await this.prisma.inventoryLog.deleteMany({ where: { productId: { in: demoProductIds } } })
      await this.prisma.review.deleteMany({ where: { productId: { in: demoProductIds } } })
      await this.prisma.aIJob.deleteMany({ where: { productId: { in: demoProductIds } } })

      const blockingItems = await this.prisma.orderItem.findMany({
        where: { productId: { in: demoProductIds } },
        select: { orderId: true },
      })
      const blockingOrderIds = [...new Set(blockingItems.map((item) => item.orderId))]
      if (blockingOrderIds.length > 0) {
        const removedOrders = await this.prisma.order.deleteMany({ where: { id: { in: blockingOrderIds } } })
        result.ordersTiedToDemoRemoved = removedOrders.count
      }

      const deletedProducts = await this.prisma.product.deleteMany({
        where: {
          id: { in: demoProductIds },
          orderItems: { none: {} },
        },
      })
      result.demoProductsRemoved = deletedProducts.count
      result.demoProductsSkipped = demoProductIds.length - deletedProducts.count
    }

    const po = await this.prisma.purchaseOrder.deleteMany({
      where: { storeId: sid, poNumber: DEMO_PO_NUMBER },
    })
    result.purchaseOrdersRemoved = po.count

    const fabric = await this.prisma.fabricInventory.deleteMany({
      where: { storeId: sid, name: DEMO_FABRIC_NAME },
    })
    result.fabricRowsRemoved = fabric.count

    const production = await this.prisma.productionOrder.deleteMany({
      where: { storeId: sid, productName: DEMO_PRODUCTION_NAME },
    })
    result.productionBatchesRemoved = production.count

    const demoSuppliers = await this.prisma.supplier.findMany({
      where: { storeId: sid, name: { in: DEMO_SUPPLIER_NAMES } },
      select: { id: true },
    })
    if (demoSuppliers.length > 0) {
      const supplierIds = demoSuppliers.map((supplier) => supplier.id)
      const purchaseOrders = await this.prisma.purchaseOrder.deleteMany({
        where: { supplierId: { in: supplierIds } },
      })
      result.purchaseOrdersRemoved += purchaseOrders.count

      const suppliers = await this.prisma.supplier.deleteMany({
        where: { id: { in: supplierIds } },
      })
      result.suppliersRemoved = suppliers.count
    }

    return result
  }
}
