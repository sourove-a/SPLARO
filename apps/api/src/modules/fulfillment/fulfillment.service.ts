import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Order, OrderItem, ProductVariant, CourierShipment } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { OrderStatusService } from '../orders/order-status.service'
import {
  generateBulkShippingLabelsHtml,
  generateProductStickersHtml,
  generateShippingLabelHtml,
  type ProductStickerModel,
  type ShippingLabelModel,
} from './label.template'

type LabelOrder = Order & {
  items: (OrderItem & { variant?: ProductVariant | null })[]
  courier: CourierShipment | null
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
        items: { include: { variant: true } },
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

  private formatAddress(order: Order): string {
    const parts: string[] = []
    const seen = new Set<string>()
    const push = (raw?: string | null) => {
      if (!raw?.trim()) return
      for (const bit of raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean)) {
        const key = bit.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        parts.push(bit)
      }
    }
    push(order.shippingAddress)
    push(order.shippingCity)
    push(order.shippingDistrict)
    push(order.shippingDivision)
    push(order.shippingPostal)
    return parts.join(', ')
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
      return {
        invoiceNumber: order.invoiceNumber,
        productName: item.productName,
        sku: item.sku?.trim() || '—',
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

    const byInvoice = await this.prisma.order.findFirst({
      where: {
        invoiceNumber: { in: invoiceList, mode: 'insensitive' },
        ...(storeId ? { storeId } : {}),
      },
      include: { items: { include: { variant: true } }, courier: true },
    })
    if (byInvoice) return byInvoice

    const byId = await this.prisma.order.findFirst({
      where: {
        id: raw,
        ...(storeId ? { storeId } : {}),
      },
      include: { items: { include: { variant: true } }, courier: true },
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
        order: { include: { items: { include: { variant: true } }, courier: true } },
      },
    })
    if (shipment?.order) return shipment.order as LabelOrder

    throw new NotFoundException(`No order found for scan code: ${raw}`)
  }

  async scan(
    code: string,
    action: 'pack' | 'dispatch',
    storeId?: string,
  ): Promise<{
    ok: boolean
    action: 'pack' | 'dispatch'
    orderId: string
    invoiceNumber: string
    customerName: string
    previousStatus: string
    status: string
    itemCount: number
    message: string
  }> {
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
        ok: true,
        action,
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        customerName: order.shippingName,
        previousStatus: order.status,
        status: order.status,
        itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
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
      ok: true,
      action,
      orderId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      customerName: updated.shippingName,
      previousStatus: order.status,
      status: updated.status,
      itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
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
