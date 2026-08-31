import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { formatCleanAddress, toStoredMediaUrl } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import {
  computeExpectedDeliveryChargeBdt,
  isDhakaDistrict,
} from '../../common/delivery-charge.util'
import { OrderNotificationsService } from '../notifications/order-notifications.service'

/**
 * Stages where a correction is still only a database change. Once a parcel is
 * shipped the box in the courier's van is the order, and editing the record
 * would only make the paperwork disagree with what the customer receives.
 */
export const EDITABLE_ORDER_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED'])

export interface OrderEditLineInput {
  variantId: string
  quantity: number
}

export interface OrderEditShippingInput {
  name?: string
  phone?: string
  email?: string | null
  address?: string
  city?: string
  district?: string
  division?: string
  postal?: string | null
}

export interface OrderEditInput {
  items?: OrderEditLineInput[]
  shipping?: OrderEditShippingInput
  note?: string
}

interface ResolvedLine {
  variantId: string
  productId: string
  quantity: number
  unitPrice: number
  productName: string
  variantName: string | null
  sku: string | null
  productCode: string | null
  image: string | null
  allowOversell: boolean
}

export interface OrderEditResult {
  order: { id: string; invoiceNumber: string; subtotal: number; deliveryCharge: number; discount: number; total: number }
  emailSent: boolean
  changes: string[]
}

const MAX_LINE_QTY = 500
const MAX_LINES = 100

@Injectable()
export class OrderEditService {
  private readonly logger = new Logger(OrderEditService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAudit: FinanceAuditService,
    @Optional() private readonly orderNotifications?: OrderNotificationsService,
  ) {}

  async edit(orderId: string, input: OrderEditInput, adminUserId?: string): Promise<OrderEditResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { id: true, variantId: true, productId: true, quantity: true, productName: true } },
        courier: { select: { consignmentId: true } },
        stockReservation: { select: { id: true, status: true } },
        couponRedemption: { select: { freeShipping: true } },
      },
    })
    if (!order) throw new NotFoundException('Order not found')

    this.assertEditable(order)

    const wantsItemChange = Array.isArray(input.items)
    if (wantsItemChange && order.paymentStatus === 'PAID') {
      throw new BadRequestException(
        'This order is already paid. Refund it or place a corrected order — changing the items would leave the payment for something else.',
      )
    }

    const shipping = this.resolveShipping(order, input.shipping)
    const lines = wantsItemChange
      ? await this.resolveLines(order.storeId, input.items ?? [])
      : null

    const money = await this.recomputeMoney(
      order,
      lines,
      shipping.district,
      order.couponRedemption?.freeShipping === true,
    )
    if (order.paymentStatus === 'PAID' && money.total !== Math.round(Number(order.total))) {
      throw new BadRequestException(
        'This order is already paid and the correction would change its total. Refund it or edit details without changing delivery cost.',
      )
    }
    const changes = this.describeChanges(order, lines, shipping, money)
    if (!changes.length) {
      throw new BadRequestException('Nothing changed — edit an item or a delivery detail first.')
    }

    const reservationActive = order.stockReservation?.status === 'ACTIVE'
    const deltas = lines ? this.stockDeltas(order.items, lines) : []
    const noteBody = [input.note?.trim(), ...changes].filter(Boolean).join(' · ')
    const beforeAudit = {
      subtotal: Number(order.subtotal),
      deliveryCharge: Number(order.deliveryCharge),
      total: Number(order.total),
      items: order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingEmail: order.shippingEmail,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingDistrict: order.shippingDistrict,
      shippingDivision: order.shippingDivision,
      shippingPostal: order.shippingPostal,
    }
    const afterAudit = {
      subtotal: money.subtotal,
      deliveryCharge: money.delivery,
      total: money.total,
      ...(lines ? { items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) } : {}),
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      shippingEmail: shipping.email,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingDistrict: shipping.district,
      shippingDivision: shipping.division,
      shippingPostal: shipping.postal,
    }

    await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.order.updateMany({
        where: { id: order.id, status: order.status, updatedAt: order.updatedAt },
        data: { updatedAt: order.updatedAt },
      })
      if (guarded.count !== 1) {
        throw new BadRequestException('This order changed while you were editing it. Refresh and try again.')
      }

      if (lines) {
        await this.applyStockDeltas(tx, order.id, deltas, reservationActive)
        if (reservationActive && order.stockReservation) {
          // The reservation must end up describing the order it belongs to, or
          // consuming it later would decrement the wrong sizes.
          await tx.stockReservationItem.deleteMany({
            where: { reservationId: order.stockReservation.id },
          })
          await tx.stockReservationItem.createMany({
            data: lines.map((line) => ({
              reservationId: order.stockReservation!.id,
              variantId: line.variantId,
              quantity: line.quantity,
            })),
          })
        }
        await tx.orderItem.deleteMany({ where: { orderId: order.id } })
        for (const line of lines) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              productCode: line.productCode,
              image: line.image,
              price: line.unitPrice,
              quantity: line.quantity,
              subtotal: line.unitPrice * line.quantity,
            },
          })
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: money.subtotal,
          deliveryCharge: money.delivery,
          total: money.total,
          shippingName: shipping.name,
          shippingPhone: shipping.phone,
          shippingEmail: shipping.email,
          shippingAddress: shipping.address,
          shippingCity: shipping.city,
          shippingDistrict: shipping.district,
          shippingDivision: shipping.division,
          shippingPostal: shipping.postal,
          isInsideDhaka: isDhakaDistrict(shipping.district),
        },
      })

      await tx.orderNote.create({
        data: {
          orderId: order.id,
          body: `Order edited by staff: ${noteBody}`,
          isPrivate: true,
          ...(adminUserId ? { authorId: adminUserId } : {}),
        },
      })

      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: order.status, note: `Order edited: ${noteBody}` },
      })
      await this.financeAudit.log({
        storeId: order.storeId,
        action: 'UPDATE',
        resource: 'order',
        resourceId: order.id,
        before: beforeAudit,
        after: afterAudit,
        note: noteBody,
        ...(adminUserId ? { userId: adminUserId } : {}),
      }, tx)
    }, { isolationLevel: 'Serializable' })

    const emailSent = await this.notifyCustomer(order.storeId, order.id, changes, input.note)

    return {
      order: {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        subtotal: money.subtotal,
        deliveryCharge: money.delivery,
        discount: money.discount,
        total: money.total,
      },
      emailSent,
      changes,
    }
  }

  private assertEditable(order: {
    status: string
    courier: { consignmentId: string | null } | null
  }): void {
    if (!EDITABLE_ORDER_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `An order at ${order.status.replace(/_/g, ' ').toLowerCase()} can no longer be edited. Cancel it and place a corrected order instead.`,
      )
    }
    if (order.courier?.consignmentId) {
      throw new BadRequestException(
        'A courier consignment already exists for this order. Cancel the booking before editing it.',
      )
    }
  }

  private resolveShipping(
    order: {
      shippingName: string
      shippingPhone: string
      shippingEmail: string | null
      shippingAddress: string
      shippingCity: string
      shippingDistrict: string
      shippingDivision: string
      shippingPostal: string | null
    },
    input?: OrderEditShippingInput,
  ) {
    const name = input?.name?.trim() || order.shippingName
    const rawPhone = input?.phone?.trim()
    if (rawPhone && !isValidBdMobile(rawPhone)) {
      throw new BadRequestException('Valid Bangladeshi mobile number required (01XXXXXXXXX)')
    }
    const phone = rawPhone ? normalizeBdPhone(rawPhone) : order.shippingPhone
    const email =
      input?.email === undefined
        ? order.shippingEmail
        : input.email?.trim().toLowerCase() || null
    const address = input?.address?.trim()
      ? formatCleanAddress(input.address)
      : order.shippingAddress
    const city = input?.city?.trim() || order.shippingCity
    const district = input?.district?.trim() || input?.city?.trim() || order.shippingDistrict
    const division = input?.division?.trim() || order.shippingDivision
    const postal =
      input?.postal === undefined ? order.shippingPostal : input.postal?.trim() || null

    if (!address) throw new BadRequestException('Delivery address is required')
    if (!district) throw new BadRequestException('Delivery district is required')

    return { name, phone, email, address, city, district, division, postal }
  }

  private async resolveLines(storeId: string, items: OrderEditLineInput[]): Promise<ResolvedLine[]> {
    if (!items.length) throw new BadRequestException('An order must keep at least one item')
    if (items.length > MAX_LINES) throw new BadRequestException('Too many lines on one order')

    // Two rows for the same size are one line — otherwise the quantity written
    // to stock and the quantity written to the invoice disagree.
    const merged = new Map<string, number>()
    for (const item of items) {
      const variantId = item.variantId?.trim()
      if (!variantId) throw new BadRequestException('Every line needs a size (variant)')
      const qty = Math.round(Number(item.quantity))
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QTY) {
        throw new BadRequestException('Every line needs a quantity between 1 and 500')
      }
      merged.set(variantId, (merged.get(variantId) ?? 0) + qty)
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...merged.keys()] }, product: { storeId } },
      select: {
        id: true,
        productId: true,
        sku: true,
        size: true,
        color: true,
        colorName: true,
        image: true,
        price: true,
        stock: true,
        reservedStock: true,
        isActive: true,
        product: {
          select: { name: true, basePrice: true, productCode: true, inventoryPolicy: true, images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 } },
        },
      },
    })
    const byId = new Map(variants.map((row) => [row.id, row]))

    const lines: ResolvedLine[] = []
    for (const [variantId, quantity] of merged) {
      const variant = byId.get(variantId)
      if (!variant) throw new BadRequestException('One of the selected sizes no longer exists')
      if (!variant.isActive) {
        throw new BadRequestException(`${variant.product.name}: that size is archived`)
      }
      // Price is read here, never taken from the browser — an edited order must
      // charge what the catalogue charges today.
      const variantPrice = Number(variant.price)
      const unitPrice = variantPrice > 0 ? variantPrice : Number(variant.product.basePrice)
      lines.push({
        variantId: variant.id,
        productId: variant.productId,
        quantity,
        unitPrice,
        productName: variant.product.name,
        variantName: [variant.size, variant.colorName ?? variant.color].filter(Boolean).join(' / ') || null,
        sku: variant.sku,
        productCode: variant.product.productCode,
        image:
          toStoredMediaUrl(variant.image) ||
          toStoredMediaUrl(variant.product.images[0]?.url ?? '') ||
          null,
        allowOversell: variant.product.inventoryPolicy !== 'DENY',
      })
    }
    return lines
  }

  private async recomputeMoney(
    order: {
      storeId: string
      subtotal: Prisma.Decimal
      deliveryCharge: Prisma.Decimal
      discount: Prisma.Decimal
      couponRedemption?: { freeShipping: boolean } | null
    },
    lines: ResolvedLine[] | null,
    district: string,
    couponFreeShipping: boolean,
  ) {
    const subtotal = lines
      ? Math.round(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0))
      : Math.round(Number(order.subtotal))

    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId: order.storeId },
      select: {
        dhakaDeliveryCharge: true,
        outsideDhakaCharge: true,
        freeDeliveryThreshold: true,
      },
    })

    // A coupon's free-shipping flag lives on the redemption, so an order that
    // already ships free keeps shipping free rather than being re-charged.
    const delivery = couponFreeShipping
      ? 0
      : computeExpectedDeliveryChargeBdt(
          district,
          {
            dhakaDeliveryCharge: Number(settings?.dhakaDeliveryCharge ?? 60),
            outsideDhakaCharge: Number(settings?.outsideDhakaCharge ?? 120),
            freeDeliveryThreshold: Number(settings?.freeDeliveryThreshold ?? 0),
          },
          { subtotal },
        )

    const discount = Math.min(Math.round(Number(order.discount)), subtotal)
    const total = Math.max(0, subtotal + delivery - discount)
    return { subtotal, delivery, discount, total }
  }

  private stockDeltas(
    previous: Array<{ variantId: string | null; productId: string; quantity: number; productName: string }>,
    lines: ResolvedLine[],
  ) {
    const before = new Map<string, { productId: string; quantity: number; name: string }>()
    for (const item of previous) {
      if (!item.variantId) continue
      const row = before.get(item.variantId)
      before.set(item.variantId, {
        productId: item.productId,
        name: item.productName,
        quantity: (row?.quantity ?? 0) + item.quantity,
      })
    }

    const deltas: Array<{ variantId: string; productId: string; name: string; delta: number; allowOversell: boolean }> = []
    for (const line of lines) {
      const previousQty = before.get(line.variantId)?.quantity ?? 0
      const delta = line.quantity - previousQty
      before.delete(line.variantId)
      if (delta !== 0) {
        deltas.push({
          variantId: line.variantId,
          productId: line.productId,
          name: line.productName,
          delta,
          allowOversell: line.allowOversell,
        })
      }
    }
    // Lines the edit removed entirely go back to stock.
    for (const [variantId, row] of before) {
      deltas.push({
        variantId,
        productId: row.productId,
        name: row.name,
        delta: -row.quantity,
        allowOversell: true,
      })
    }
    return deltas
  }

  /**
   * A COD order took its stock at placement, so an edit moves real stock. An
   * order still holding a reservation has taken nothing yet, so the edit moves
   * the reservation instead and leaves `stock` alone.
   */
  private async applyStockDeltas(
    tx: Prisma.TransactionClient,
    orderId: string,
    deltas: Array<{ variantId: string; productId: string; name: string; delta: number; allowOversell: boolean }>,
    reservationActive: boolean,
  ): Promise<void> {
    for (const row of deltas) {
      const column = reservationActive ? 'reservedStock' : 'stock'
      if (row.delta > 0 && !row.allowOversell) {
        const claimed = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant"
             SET "${column}" = "${column}" ${reservationActive ? '+' : '-'} $1, "updatedAt" = NOW()
           WHERE "id" = $2 AND ("stock" - "reservedStock") >= $1`,
          row.delta,
          row.variantId,
        )
        if (claimed !== 1) {
          throw new BadRequestException(`${row.name}: not enough stock for the new quantity`)
        }
      } else {
        const change = reservationActive ? row.delta : -row.delta
        await tx.productVariant.update({
          where: { id: row.variantId },
          data: { [column]: { increment: change } },
        })
      }

      if (!reservationActive) {
        const variant = await tx.productVariant.findUnique({
          where: { id: row.variantId },
          select: { stock: true },
        })
        if (variant) {
          await tx.inventoryLog.create({
            data: {
              productId: row.productId,
              variantId: row.variantId,
              action: 'ADJUSTMENT',
              // InventoryLog.quantity is signed: positive means stock came in,
              // negative means the corrected order consumed more stock.
              quantity: -row.delta,
              stockBefore: variant.stock + row.delta,
              stockAfter: variant.stock,
              orderId,
              note: `Order edited by staff (${row.delta > 0 ? 'added' : 'removed'} ${Math.abs(row.delta)})`,
            },
          })
        }
      }
    }
  }

  private describeChanges(
    order: {
      items: Array<{ variantId: string | null; quantity: number; productName: string }>
      subtotal: Prisma.Decimal
      deliveryCharge: Prisma.Decimal
      total: Prisma.Decimal
      shippingPhone: string
      shippingEmail: string | null
      shippingAddress: string
      shippingCity: string
      shippingDistrict: string
      shippingDivision: string
      shippingPostal: string | null
      shippingName: string
    },
    lines: ResolvedLine[] | null,
    shipping: {
      name: string
      phone: string
      email: string | null
      address: string
      city: string
      district: string
      division: string
      postal: string | null
    },
    money: { subtotal: number; delivery: number; total: number },
  ): string[] {
    const changes: string[] = []
    if (lines) {
      const before = new Map<string, number>()
      for (const item of order.items) {
        if (item.variantId) before.set(item.variantId, (before.get(item.variantId) ?? 0) + item.quantity)
      }
      const after = new Map(lines.map((line) => [line.variantId, line.quantity]))
      const sameItems =
        before.size === after.size && [...before].every(([id, qty]) => after.get(id) === qty)
      if (!sameItems) changes.push('items updated')
    }
    if (shipping.name !== order.shippingName) changes.push('name updated')
    if (shipping.phone !== order.shippingPhone) changes.push('phone updated')
    if (shipping.email !== order.shippingEmail) changes.push('email updated')
    if (shipping.address !== order.shippingAddress) changes.push('address updated')
    if (shipping.city !== order.shippingCity) changes.push('city updated')
    if (shipping.district !== order.shippingDistrict) changes.push('district updated')
    if (shipping.division !== order.shippingDivision) changes.push('division updated')
    if (shipping.postal !== order.shippingPostal) changes.push('postal code updated')
    if (money.delivery !== Math.round(Number(order.deliveryCharge))) changes.push('delivery charge recalculated')
    if (money.total !== Math.round(Number(order.total))) changes.push('total recalculated')
    return changes
  }

  private async notifyCustomer(
    storeId: string,
    orderId: string,
    changes: string[],
    note?: string,
  ): Promise<boolean> {
    if (!this.orderNotifications) return false
    try {
      return await this.orderNotifications.onOrderEdited(storeId, orderId, {
        changes,
        ...(note?.trim() ? { note: note.trim() } : {}),
      })
    } catch (err) {
      this.logger.warn(
        `Order edit email failed for ${orderId}: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return false
    }
  }
}
