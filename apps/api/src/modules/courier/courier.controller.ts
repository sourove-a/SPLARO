import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import type { CourierProvider, CourierStatus, OrderStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { CourierService } from './courier.service'
import { OrderStatusService } from '../orders/order-status.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

const COURIER_TO_ORDER_STATUS: Partial<Record<CourierStatus, OrderStatus>> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
}

@Controller('admin/courier')
export class CourierController {
  constructor(
    @Inject(CourierService) private readonly courier: CourierService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderStatusService) private readonly orderStatus: OrderStatusService,
  ) {}

  private async ownedOrderId(idOrInvoice: string, req: AdminRequest): Promise<string> {
    const storeId = req.adminUser?.storeId
      ? await resolveStoreId(this.prisma, req.adminUser.storeId)
      : await resolveStoreId(this.prisma, undefined)
    const order = await this.prisma.order.findFirst({
      where: {
        storeId,
        OR: [{ id: idOrInvoice }, { invoiceNumber: idOrInvoice }],
      },
      select: { id: true },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order.id
  }

  /** All shipments for a store with filters */
  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('status') status?: CourierStatus,
    @Query('provider') provider?: CourierProvider,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      order: { storeId: sid },
      ...(status ? { status } : {}),
      ...(provider ? { provider } : {}),
      ...(search
        ? {
            OR: [
              { consignmentId: { contains: search, mode: 'insensitive' as const } },
              { trackingCode: { contains: search, mode: 'insensitive' as const } },
              { order: { invoiceNumber: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.courierShipment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              invoiceNumber: true,
              shippingName: true,
              shippingPhone: true,
              shippingAddress: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.courierShipment.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Courier performance stats — must be registered before :orderId routes */
  @Get('stats/overview')
  async overview(@Query('storeId') storeId?: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const [byStatus, byProvider, recentFailed] = await Promise.all([
      this.prisma.courierShipment.groupBy({
        by: ['status'],
        where: { order: { storeId: sid }, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.courierShipment.groupBy({
        by: ['provider'],
        where: { order: { storeId: sid }, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.courierShipment.findMany({
        where: {
          order: { storeId: sid },
          status: 'FAILED',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          order: { select: { invoiceNumber: true, shippingName: true } },
        },
      }),
    ])

    return { byStatus, byProvider, recentFailed }
  }

  /** Which courier APIs have real credentials — Hub booking dropdown. */
  @Get('providers')
  async providers(@Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return { providers: await this.courier.listProviders(sid) }
  }

  /** Bulk status update — also drives order status when mapped */
  @Post('bulk/status')
  async bulkStatus(
    @Body() body: { orderIds: string[]; status: CourierStatus; note?: string },
    @Req() req: AdminRequest,
  ) {
    let updated = 0
    for (const rawId of body.orderIds ?? []) {
      try {
        await this.updateStatus(rawId, { status: body.status, note: body.note }, req)
        updated += 1
      } catch {
        /* skip unauthorized / missing */
      }
    }
    return { updated }
  }

  /** Single shipment detail with webhook events */
  @Get(':orderId')
  async detail(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    const ownedId = await this.ownedOrderId(orderId, req)
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { orderId: ownedId },
      include: {
        order: {
          select: {
            invoiceNumber: true,
            shippingName: true,
            shippingPhone: true,
            shippingAddress: true,
            total: true,
            paymentMethod: true,
            status: true,
          },
        },
        webhookEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!shipment) return { error: 'Shipment not found' }
    return shipment
  }

  /** Book courier for an order */
  @Post(':orderId/book')
  async book(
    @Param('orderId') orderId: string,
    @Body('provider') provider: CourierProvider | undefined,
    @Req() req: AdminRequest,
  ) {
    const ownedId = await this.ownedOrderId(orderId, req)
    return this.courier.bookCourier(ownedId, provider, {
      storeId: req.adminUser?.storeId,
    })
  }

  /** Retry failed booking */
  @Post(':orderId/retry')
  async retry(
    @Param('orderId') orderId: string,
    @Body('provider') provider: CourierProvider | undefined,
    @Req() req: AdminRequest,
  ) {
    const ownedId = await this.ownedOrderId(orderId, req)
    return this.courier.manualRetry(ownedId, provider)
  }

  /** Live tracking status from courier API */
  @Get(':orderId/track')
  async track(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    const ownedId = await this.ownedOrderId(orderId, req)
    const status = await this.courier.getTrackingStatus(ownedId)
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { orderId: ownedId },
      select: {
        provider: true,
        status: true,
        consignmentId: true,
        trackingCode: true,
        trackingUrl: true,
      },
    })
    return {
      status: status ?? shipment?.status ?? null,
      provider: shipment?.provider ?? null,
      consignmentId: shipment?.consignmentId ?? null,
      trackingCode: shipment?.trackingCode ?? null,
      trackingUrl: shipment?.trackingUrl ?? null,
    }
  }

  /**
   * Local-only cancel — Steadfast has no cancel API.
   * Never reports courier-side cancellation as success.
   */
  @Post(':orderId/cancel-booking')
  async cancelBooking(
    @Param('orderId') orderId: string,
    @Body() body: { note?: string },
    @Req() req: AdminRequest,
  ) {
    const ownedId = await this.ownedOrderId(orderId, req)
    return this.courier.cancelBookingLocal(ownedId, {
      note: body?.note,
      storeId: req.adminUser?.storeId,
    })
  }

  /** Manually update shipment status (admin override) — syncs order when mapped */
  @Patch(':orderId/status')
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: CourierStatus; note?: string },
    @Req() req: AdminRequest,
  ) {
    const ownedId = await this.ownedOrderId(orderId, req)
    const shipment = await this.prisma.courierShipment.update({
      where: { orderId: ownedId },
      data: {
        status: body.status,
        ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(body.status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}),
        ...(body.status === 'RETURNED' ? { returnedAt: new Date() } : {}),
        ...(body.note ? { failureReason: body.note } : {}),
      },
    })

    const mapped = COURIER_TO_ORDER_STATUS[body.status]
    if (mapped) {
      try {
        await this.orderStatus.applyStatusChange(
          ownedId,
          mapped,
          body.note ?? `Courier status → ${body.status}`,
          req.adminUser?.storeId,
          { notePrefix: '[Courier] ' },
        )
      } catch {
        // Shipment row updated; order transition may be illegal (e.g. already delivered).
      }
    }

    return shipment
  }

  /** Webhook events for a shipment */
  @Get(':orderId/events')
  async events(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    const ownedId = await this.ownedOrderId(orderId, req)
    const shipment = await this.prisma.courierShipment.findUnique({ where: { orderId: ownedId } })
    if (!shipment) return []
    return this.prisma.courierWebhookEvent.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { createdAt: 'desc' },
    })
  }
}
