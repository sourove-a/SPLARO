import { BadRequestException, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { OrderEventsService } from '../orders/order-events.service'
import { ProfitLossService } from '../finance/profit-loss.service'
import type { PaymentMethod, Prisma } from '@prisma/client'

export type PosPaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card'

export interface PosSaleItemInput {
  productId: string
  variantId: string
  quantity: number
}

export interface CreatePosSaleInput {
  storeId?: string
  items: PosSaleItemInput[]
  paymentMethod: PosPaymentMethod
  customerName?: string
  customerPhone?: string
  discount?: number
  notes?: string
  staffName?: string
}

function mapPosPayment(method: PosPaymentMethod): PaymentMethod {
  if (method === 'bkash') return 'BKASH'
  if (method === 'nagad') return 'NAGAD'
  if (method === 'card') return 'CARD'
  return 'CASH_ON_DELIVERY'
}

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly orderEvents: OrderEventsService,
    @Optional() private readonly profitLoss: ProfitLossService,
  ) {}

  async searchCatalog(storeId: string | undefined, query?: string, sku?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const q = query?.trim()
    const skuQ = sku?.trim()

    if (skuQ) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          OR: [
            { sku: { equals: skuQ, mode: 'insensitive' } },
            { barcode: { equals: skuQ, mode: 'insensitive' } },
          ],
          product: { storeId: sid, isPublished: true },
          isActive: true,
        },
        include: {
          product: {
            include: {
              images: { orderBy: { position: 'asc' }, take: 1 },
              variants: {
                where: { isActive: true },
                orderBy: [{ colorName: 'asc' }, { size: 'asc' }],
              },
            },
          },
        },
      })
      if (!variant) return { products: [], matchedVariantId: null as string | null }

      return {
        products: [this.mapProductForPos(variant.product)],
        matchedVariantId: variant.id,
      }
    }

    const where: Prisma.ProductWhereInput = {
      storeId: sid,
      isPublished: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { position: 'asc' }, take: 1 },
        variants: {
          where: { isActive: true },
          orderBy: [{ colorName: 'asc' }, { size: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
      take: q ? 40 : 24,
    })

    return { products: products.map((p) => this.mapProductForPos(p)), matchedVariantId: null as string | null }
  }

  async getTodayStats(storeId: string | undefined) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: sid,
        trafficSource: 'POS',
        createdAt: { gte: start },
        status: { not: 'CANCELLED' },
      },
      select: { total: true, paymentMethod: true },
    })

    const total = orders.reduce((sum, o) => sum + Number(o.total), 0)
    const byMethod = orders.reduce<Record<string, number>>((acc, o) => {
      const key = o.paymentMethod
      acc[key] = (acc[key] ?? 0) + Number(o.total)
      return acc
    }, {})

    return {
      count: orders.length,
      total,
      byMethod,
      date: start.toISOString(),
    }
  }

  async createSale(input: CreatePosSaleInput) {
    if (!input.items.length) {
      throw new BadRequestException('Cart is empty')
    }

    const sid = await resolveStoreId(this.prisma, input.storeId)
    const errors: string[] = []
    const lineItems: Array<{
      productId: string
      variantId: string
      name: string
      variantLabel: string
      sku: string | null
      image: string | null
      price: number
      quantity: number
    }> = []

    for (const item of input.items) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          productId: item.productId,
          product: { storeId: sid },
          isActive: true,
        },
        include: {
          product: {
            include: { images: { orderBy: { position: 'asc' }, take: 1 } },
          },
        },
      })

      if (!variant) {
        errors.push(`Variant not found`)
        continue
      }
      if (variant.stock < item.quantity) {
        errors.push(`${variant.product.name}: only ${variant.stock} in stock`)
        continue
      }

      const price = Number(variant.price ?? variant.product.basePrice)
      lineItems.push({
        productId: variant.productId,
        variantId: variant.id,
        name: variant.product.name,
        variantLabel: [variant.colorName ?? variant.color, variant.size].filter(Boolean).join(' · '),
        sku: variant.sku,
        image: variant.image ?? variant.product.images[0]?.url ?? null,
        price,
        quantity: item.quantity,
      })
    }

    if (errors.length) {
      throw new BadRequestException(errors.join('; '))
    }

    const subtotal = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const discount = Math.min(Math.max(input.discount ?? 0, 0), subtotal)
    const total = subtotal - discount
    const paymentMethod = mapPosPayment(input.paymentMethod)
    const invoiceNumber = await this.nextInvoiceNumber(sid)
    const customerName = input.customerName?.trim() || 'Walk-in Customer'
    const customerPhone = input.customerPhone?.trim() || '0000000000'
    const staffNote = input.staffName?.trim() ? `Staff: ${input.staffName.trim()}` : null
    const adminNotes = ['POS in-store sale', staffNote, input.notes?.trim()].filter(Boolean).join(' · ')

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          storeId: sid,
          invoiceNumber,
          status: 'DELIVERED',
          paymentStatus: 'PAID',
          paymentMethod,
          subtotal,
          deliveryCharge: 0,
          discount,
          total,
          shippingName: customerName,
          shippingPhone: customerPhone,
          shippingAddress: 'Store Pickup — SPLARO Showroom',
          shippingCity: 'Dhaka',
          shippingDistrict: 'Dhaka',
          shippingDivision: 'Dhaka',
          isInsideDhaka: true,
          trafficSource: 'POS',
          landingPage: '/admin/pos',
          adminNotes,
          confirmedAt: new Date(),
          deliveredAt: new Date(),
          fraudScore: 0,
          fraudFlags: [],
          isCodRisk: false,
          items: {
            create: await Promise.all(
              lineItems.map(async (item) => {
                await tx.productVariant.update({
                  where: { id: item.variantId },
                  data: { stock: { decrement: item.quantity } },
                })
                return {
                  product: { connect: { id: item.productId } },
                  variant: { connect: { id: item.variantId } },
                  productName: item.name,
                  variantName: item.variantLabel || null,
                  sku: item.sku,
                  image: item.image,
                  price: item.price,
                  quantity: item.quantity,
                  subtotal: item.price * item.quantity,
                }
              }),
            ),
          },
          statusHistory: {
            create: [
              { status: 'CONFIRMED', note: 'POS sale confirmed' },
              { status: 'DELIVERED', note: 'Picked up at showroom' },
            ],
          },
          payments: {
            create: {
              method: paymentMethod,
              status: 'PAID',
              amount: total,
              currency: 'BDT',
              paidAt: new Date(),
            },
          },
        },
        include: {
          items: { include: { product: true, variant: true } },
        },
      })

      return created
    })

    void this.orderEvents?.onOrderPlaced(sid, order.id)
    void this.orderEvents?.onStatusChanged(sid, order.id, 'DELIVERED', 'POS pickup')
    void this.profitLoss?.calculateOrderProfit(sid, order.id).catch(() => undefined)

    return {
      order: {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        items: order.items.map((i) => ({
          id: i.id,
          name: i.productName,
          variant: i.variantName,
          quantity: i.quantity,
          price: Number(i.price),
        })),
      },
    }
  }

  private mapProductForPos(
    product: {
      id: string
      name: string
      basePrice: Prisma.Decimal
      sku: string | null
      images: { url: string }[]
      variants: {
        id: string
        sku: string | null
        barcode: string | null
        size: string | null
        color: string | null
        colorName: string | null
        colorHex: string | null
        price: Prisma.Decimal
        stock: number
        image: string | null
      }[]
    },
  ) {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      image: product.images[0]?.url ?? null,
      basePrice: Number(product.basePrice),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        size: v.size,
        color: v.colorName ?? v.color,
        colorHex: v.colorHex,
        price: Number(v.price ?? product.basePrice),
        stock: v.stock,
        image: v.image ?? product.images[0]?.url ?? null,
      })),
    }
  }

  private async nextInvoiceNumber(storeId: string): Promise<string> {
    const prefix = process.env['INVOICE_PREFIX'] ?? 'SPL'
    const count = await this.prisma.order.count({ where: { storeId } })
    const next = 1000 + count + 1
    const candidate = `${prefix}-${next}`
    const clash = await this.prisma.order.findUnique({ where: { invoiceNumber: candidate } })
    if (clash) return `${prefix}-POS-${Date.now()}`
    return candidate
  }
}
