import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Order, OrderItem, ProductVariant, CourierShipment } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { OrderStatusService } from '../orders/order-status.service'
import { formatCleanAddress } from '@splaro/config'
import {
  generateBulkShippingLabelsHtml,
  generateProductStickersHtml,
  generateShippingLabelHtml,
  type ProductStickerModel,
  type ShippingLabelModel,
} from './label.template'

type LabelOrder = Order & {
  items: (OrderItem & {
    variant?: ProductVariant | null
    product?: {
      name: string
      sku?: string | null
      productCode?: string | null
      barcode?: string | null
      images?: { url: string }[]
    } | null
  })[]
  courier: CourierShipment | null
}

const productStationSelect = {
  name: true,
  sku: true,
  productCode: true,
  barcode: true,
  images: { where: { isDefault: true }, take: 1, select: { url: true } },
} as const

export interface FulfillmentStationItem {
  id: string
  name: string
  sku: string
  /** Parent Product Code — what a customer quotes when they call about an order. */
  productCode: string | null
  barcode: string | null
  size: string
  color: string
  quantity: number
  image: string | null
}

export interface FulfillmentStationOrder {
  orderId: string
  invoiceNumber: string
  status: string
  customerName: string
  customerPhone: string
  city: string
  district: string
  address: string
  paymentMethod: string
  paymentStatus: string
  total: number
  itemCount: number
  isCodRisk: boolean
  items: FulfillmentStationItem[]
  courier: {
    provider: string | null
    consignmentId: string | null
    trackingCode: string | null
    status: string | null
  } | null
}

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStatus: OrderStatusService,
  ) {}

  async loadOrder(idOrInvoice: string, storeId?: string): Promise<LabelOrder> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrInvoice }, { invoiceNumber: idOrInvoice }],
        ...(storeId ? { storeId } : {}),
      },
      include: {
        items: {
          include: {
            variant: true,
            product: { select: productStationSelect },
          },
        },
        courier: true,
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  private parseVariant(item: OrderItem & { variant?: ProductVariant | null }): {
    size: string
    color: string
  } {
    const size = item.variant?.size?.trim() || ''
    const color =
      item.variant?.colorName?.trim() || item.variant?.color?.trim() || ''
    if (size || color) return { size: size || '—', color: color || '—' }
    const parts = item.variantName?.split('/').map((p) => p.trim()) ?? []
    return { size: parts[0] || '—', color: parts[1] || '—' }
  }

  private formatAddress(order: {
    shippingAddress?: string | null
    shippingCity?: string | null
    shippingDistrict?: string | null
    shippingDivision?: string | null
    shippingPostal?: string | null
  }): string {
    return formatCleanAddress(
      order.shippingAddress,
      order.shippingCity,
      order.shippingDistrict,
      order.shippingDivision,
      order.shippingPostal,
    )
  }

  private toLabelModel(order: LabelOrder, autoPrint: boolean): ShippingLabelModel {
    const isCod = order.paymentMethod === 'CASH_ON_DELIVERY'
    const total = Number(order.total)
    const advance = Number(order.advanceAmount ?? 0)
    const codAmount = isCod ? Math.max(0, total - advance) : 0
    const provider = order.courier?.provider
      ? order.courier.provider.replace(/_/g, ' ')
      : ''

    return {
      brandName: 'SPLARO',
      invoiceNumber: order.invoiceNumber,
      trackingCode: order.courier?.trackingCode?.trim() || '',
      consignmentId: order.courier?.consignmentId?.trim() || '',
      courierProvider: provider,
      customerName: order.shippingName,
      customerPhone: order.shippingPhone,
      fullAddress: this.formatAddress(order),
      codAmount,
      isCod,
      paymentMethod: order.paymentMethod.replace(/_/g, ' '),
      items: order.items.map((item) => {
        const { size, color } = this.parseVariant(item)
        return {
          productName: item.productName,
          sku: item.sku?.trim() || '—',
          size,
          color,
          quantity: item.quantity,
        }
      }),
      autoPrint,
    }
  }

  async buildShippingLabelHtml(
    idOrInvoice: string,
    opts: { autoPrint?: boolean; storeId?: string } = {},
  ): Promise<string> {
    const order = await this.loadOrder(idOrInvoice, opts.storeId)
    return generateShippingLabelHtml(this.toLabelModel(order, opts.autoPrint ?? true))
  }

  async buildProductStickersHtml(
    idOrInvoice: string,
    opts: { autoPrint?: boolean; storeId?: string } = {},
  ): Promise<string> {
    const order = await this.loadOrder(idOrInvoice, opts.storeId)
    const stickers: ProductStickerModel[] = order.items.map((item) => {
      const { size, color } = this.parseVariant(item)
      const sku = item.sku?.trim() || item.variant?.sku?.trim() || item.product?.sku?.trim() || '—'
      const barcode = item.variant?.barcode?.trim() || item.product?.barcode?.trim() || ''
      const scanCode = barcode || (sku !== '—' ? sku : order.invoiceNumber)
      return {
        invoiceNumber: order.invoiceNumber,
        productName: item.productName,
        sku,
        barcode: barcode || undefined,
        scanCode,
        size,
        color,
        quantity: item.quantity,
        autoPrint: false,
      }
    })
    return generateProductStickersHtml(stickers, opts.autoPrint ?? true)
  }

  async buildBulkShippingLabelsHtml(
    ids: string[],
    opts: { autoPrint?: boolean; storeId?: string } = {},
  ): Promise<string> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 50)
    if (unique.length === 0) throw new BadRequestException('No order ids provided')

    const models: ShippingLabelModel[] = []
    for (const id of unique) {
      const order = await this.loadOrder(id, opts.storeId)
      models.push(this.toLabelModel(order, false))
    }
    return generateBulkShippingLabelsHtml(models, opts.autoPrint ?? true)
  }

  /**
   * Resolve scan code → order.
   * Accepts SPL-10482, 10482, or courier trackingCode / consignmentId.
   */
  async findOrderByScanCode(code: string, storeId?: string): Promise<LabelOrder> {
    const raw = code.trim()
    if (!raw) throw new BadRequestException('Scan code is required')

    const candidates = new Set<string>([raw])
    const upper = raw.toUpperCase()
    if (/^\d+$/.test(raw)) {
      candidates.add(`SPL-${raw}`)
    }
    if (upper.startsWith('SPL-')) {
      candidates.add(upper)
      const num = upper.replace(/^SPL-/, '')
      if (num) candidates.add(num)
    } else if (/^spl[-_]?\d+/i.test(raw)) {
      candidates.add(upper.replace(/_/g, '-'))
    }

    const invoiceList = [...candidates]

    const stationInclude = {
      items: {
        include: {
          variant: true,
          product: { select: productStationSelect },
        },
      },
      courier: true,
    } as const

    const byInvoice = await this.prisma.order.findFirst({
      where: {
        invoiceNumber: { in: invoiceList, mode: 'insensitive' },
        ...(storeId ? { storeId } : {}),
      },
      include: stationInclude,
    })
    if (byInvoice) return byInvoice

    const byId = await this.prisma.order.findFirst({
      where: {
        id: raw,
        ...(storeId ? { storeId } : {}),
      },
      include: stationInclude,
    })
    if (byId) return byId

    const shipment = await this.prisma.courierShipment.findFirst({
      where: {
        OR: [
          { trackingCode: { equals: raw, mode: 'insensitive' } },
          { consignmentId: { equals: raw, mode: 'insensitive' } },
        ],
        ...(storeId ? { order: { storeId } } : {}),
      },
      include: {
        order: { include: stationInclude },
      },
    })
    if (shipment?.order) return shipment.order as LabelOrder

    throw new NotFoundException(`No order found for scan code: ${raw}`)
  }

  toStationOrder(order: LabelOrder): FulfillmentStationOrder {
    const items: FulfillmentStationItem[] = order.items.map((item) => {
      const { size, color } = this.parseVariant(item)
      const image =
        item.image?.trim() ||
        item.variant?.image?.trim() ||
        item.product?.images?.[0]?.url?.trim() ||
        null
      return {
        id: item.id || `line-${items.length}`,
        name: item.productName || item.product?.name || 'Item',
        sku: item.sku?.trim() || item.variant?.sku?.trim() || item.product?.sku?.trim() || '—',
        // Order snapshot first: a product edited after the sale must not change
        // what the packer reads against the customer's invoice.
        productCode: item.productCode?.trim() || item.product?.productCode?.trim() || null,
        barcode: item.variant?.barcode?.trim() || item.product?.barcode?.trim() || null,
        size,
        color,
        quantity: item.quantity,
        image,
      }
    })
    return {
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      customerName: order.shippingName,
      customerPhone: order.shippingPhone ?? '',
      city: order.shippingCity ?? '',
      district: order.shippingDistrict ?? '',
      address: this.formatAddress(order),
      paymentMethod: String(order.paymentMethod ?? ''),
      paymentStatus: String(order.paymentStatus ?? ''),
      total: Number(order.total ?? 0),
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      isCodRisk: Boolean(order.isCodRisk),
      items,
      courier: order.courier
        ? {
            provider: order.courier.provider ?? null,
            consignmentId: order.courier.consignmentId ?? null,
            trackingCode: order.courier.trackingCode ?? null,
            status: order.courier.status ?? null,
          }
        : null,
    }
  }

  async lookup(code: string, storeId?: string): Promise<FulfillmentStationOrder> {
    const order = await this.findOrderByScanCode(code, storeId)
    return this.toStationOrder(order)
  }

  async scan(
    code: string,
    action: 'pack' | 'dispatch',
    storeId?: string,
  ): Promise<
    FulfillmentStationOrder & {
      ok: boolean
      action: 'pack' | 'dispatch'
      previousStatus: string
      message: string
    }
  > {
    if (action !== 'pack' && action !== 'dispatch') {
      throw new BadRequestException('action must be pack or dispatch')
    }

    const order = await this.findOrderByScanCode(code, storeId)
    const target = action === 'pack' ? 'PACKED' : 'SHIPPED'
    const note =
      action === 'pack'
        ? 'Scanned at packing station → PACKED'
        : 'Scanned at packing station → SHIPPED (dispatch)'

    if (order.status === target) {
      return {
        ...this.toStationOrder(order),
        ok: true,
        action,
        previousStatus: order.status,
        message: `Already ${target}`,
      }
    }

    const updated = await this.orderStatus.applyStatusChange(
      order.id,
      target,
      note,
      storeId,
    )

    return {
      ...this.toStationOrder({ ...order, status: updated.status }),
      ok: true,
      action,
      previousStatus: order.status,
      status: updated.status,
      message: `${order.invoiceNumber}: ${order.status} → ${updated.status}`,
    }
  }

  async todayCounts(storeId?: string): Promise<{ packed: number; shipped: number }> {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const [packed, shipped] = await Promise.all([
      this.prisma.orderStatusHistory.count({
        where: {
          status: 'PACKED',
          createdAt: { gte: start },
          ...(storeId ? { order: { storeId } } : {}),
        },
      }),
      this.prisma.orderStatusHistory.count({
        where: {
          status: 'SHIPPED',
          createdAt: { gte: start },
          ...(storeId ? { order: { storeId } } : {}),
        },
      }),
    ])

    return { packed, shipped }
  }
}
