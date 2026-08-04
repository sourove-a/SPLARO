import { Injectable, Logger } from '@nestjs/common'
import type { CourierStatus, OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { OrderStatusService } from '../orders/order-status.service'

/**
 * Steadfast portal webhook payloads (Webhook Integration panel).
 * Docs: delivery_status notification with consignment_id / invoice / tracking_code.
 */
export type SteadfastWebhookBody = {
  notification_type?: string
  consignment_id?: number | string
  invoice?: string
  tracking_code?: string
  delivery_status?: string
  status?: string
  [key: string]: unknown
}

const COURIER_TO_ORDER: Partial<Record<CourierStatus, OrderStatus>> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
}

/** Map Steadfast delivery_status strings → our CourierStatus (null = log only). */
export function mapSteadfastDeliveryStatus(raw: string | undefined): CourierStatus | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return null

  switch (s) {
    case 'in_review':
    case 'pending':
      return 'BOOKED'
    case 'hold':
      return 'IN_TRANSIT'
    case 'delivered':
    case 'delivered_approval_pending':
    case 'partial_delivered':
    case 'partial_delivered_approval_pending':
      return 'DELIVERED'
    case 'cancelled':
    case 'cancelled_approval_pending':
      return 'RETURNED'
    case 'unknown':
    case 'unknown_approval_pending':
      return null
    default:
      // Future / undocumented Steadfast statuses — try soft match
      if (s.includes('deliver')) return 'DELIVERED'
      if (s.includes('cancel') || s.includes('return')) return 'RETURNED'
      if (s.includes('transit') || s.includes('pick')) return 'IN_TRANSIT'
      return null
  }
}

@Injectable()
export class SteadfastWebhookService {
  private readonly logger = new Logger(SteadfastWebhookService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStatus: OrderStatusService,
  ) {}

  async handle(body: SteadfastWebhookBody): Promise<{
    ok: boolean
    processed: boolean
    reason?: string
    shipmentId?: string
    courierStatus?: CourierStatus
  }> {
    const notificationType = String(body.notification_type ?? 'delivery_status').trim()
    const deliveryStatus = String(body.delivery_status ?? body.status ?? '').trim()
    const consignmentId =
      body.consignment_id != null && String(body.consignment_id).trim()
        ? String(body.consignment_id).trim()
        : null
    const invoice = body.invoice?.trim() || null
    const trackingCode = body.tracking_code?.trim() || null

    const shipment = await this.findShipment({ consignmentId, invoice, trackingCode })
    if (!shipment) {
      this.logger.warn(
        `Steadfast webhook: no shipment for consignment=${consignmentId ?? '-'} invoice=${invoice ?? '-'} tracking=${trackingCode ?? '-'}`,
      )
      return { ok: true, processed: false, reason: 'shipment_not_found' }
    }

    const event = await this.prisma.courierWebhookEvent.create({
      data: {
        shipmentId: shipment.id,
        provider: 'STEADFAST',
        eventType: notificationType || 'delivery_status',
        payload: body as Prisma.InputJsonValue,
      },
    })

    const mapped = mapSteadfastDeliveryStatus(deliveryStatus)
    if (!mapped) {
      await this.prisma.courierWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      })
      return {
        ok: true,
        processed: true,
        reason: 'status_unmapped',
        shipmentId: shipment.id,
      }
    }

    // Idempotent: skip if already at mapped status
    if (shipment.status === mapped) {
      await this.prisma.courierWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      })
      return {
        ok: true,
        processed: true,
        reason: 'already_current',
        shipmentId: shipment.id,
        courierStatus: mapped,
      }
    }

    await this.prisma.courierShipment.update({
      where: { id: shipment.id },
      data: {
        status: mapped,
        ...(mapped === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(mapped === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}),
        ...(mapped === 'RETURNED' || mapped === 'CANCELLED' ? { returnedAt: new Date() } : {}),
        ...(consignmentId && !shipment.consignmentId ? { consignmentId } : {}),
        ...(trackingCode && !shipment.trackingCode ? { trackingCode } : {}),
      },
    })

    const orderMapped = COURIER_TO_ORDER[mapped]
    if (orderMapped) {
      try {
        await this.orderStatus.applyStatusChange(
          shipment.orderId,
          orderMapped,
          `Steadfast webhook · ${deliveryStatus || mapped}`,
          shipment.order.storeId,
          { notePrefix: '[Courier webhook] ' },
        )
      } catch (err) {
        // Shipment updated; order transition may be illegal (already delivered, etc.)
        this.logger.warn(
          `Steadfast webhook: order status skip for ${shipment.orderId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    await this.prisma.courierWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    })

    return {
      ok: true,
      processed: true,
      shipmentId: shipment.id,
      courierStatus: mapped,
    }
  }

  private async findShipment(keys: {
    consignmentId: string | null
    invoice: string | null
    trackingCode: string | null
  }) {
    if (keys.consignmentId) {
      const byCid = await this.prisma.courierShipment.findFirst({
        where: { consignmentId: keys.consignmentId, provider: 'STEADFAST' },
        include: { order: { select: { storeId: true, invoiceNumber: true } } },
      })
      if (byCid) return byCid
    }

    if (keys.trackingCode) {
      const byTrack = await this.prisma.courierShipment.findFirst({
        where: { trackingCode: keys.trackingCode, provider: 'STEADFAST' },
        include: { order: { select: { storeId: true, invoiceNumber: true } } },
      })
      if (byTrack) return byTrack
    }

    if (keys.invoice) {
      const order = await this.prisma.order.findFirst({
        where: {
          OR: [{ invoiceNumber: keys.invoice }, { id: keys.invoice }],
        },
        select: {
          id: true,
          storeId: true,
          invoiceNumber: true,
          courier: true,
        },
      })
      if (order?.courier?.provider === 'STEADFAST') {
        return {
          ...order.courier,
          order: { storeId: order.storeId, invoiceNumber: order.invoiceNumber },
        }
      }
    }

    return null
  }
}
