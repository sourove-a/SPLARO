import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import type { CourierProvider, CourierStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { CourierService } from './courier.service'

@Controller('admin/courier')
export class CourierController {
  constructor(
    @Inject(CourierService) private readonly courier: CourierService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

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

  /** Single shipment detail with webhook events */
  @Get(':orderId')
  async detail(@Param('orderId') orderId: string) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { orderId },
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
  book(
    @Param('orderId') orderId: string,
    @Body('provider') provider?: CourierProvider,
  ) {
    return this.courier.bookCourier(orderId, provider)
  }

  /** Retry failed booking */
  @Post(':orderId/retry')
  retry(
    @Param('orderId') orderId: string,
    @Body('provider') provider?: CourierProvider,
  ) {
    return this.courier.manualRetry(orderId, provider)
  }

  /** Live tracking status from courier API */
  @Get(':orderId/track')
  track(@Param('orderId') orderId: string) {
    return this.courier.getTrackingStatus(orderId)
  }

  /** Manually update shipment status (admin override) */
  @Patch(':orderId/status')
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: CourierStatus; note?: string },
  ) {
    const shipment = await this.prisma.courierShipment.update({
      where: { orderId },
      data: {
        status: body.status,
        ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(body.status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}),
        ...(body.status === 'RETURNED' ? { returnedAt: new Date() } : {}),
        ...(body.note ? { failureReason: body.note } : {}),
      },
    })
    return shipment
  }

  /** Bulk status update */
  @Post('bulk/status')
  async bulkStatus(@Body() body: { orderIds: string[]; status: CourierStatus }) {
    const result = await this.prisma.courierShipment.updateMany({
      where: { orderId: { in: body.orderIds } },
      data: {
        status: body.status,
        ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    })
    return { updated: result.count }
  }

  /** Courier performance stats */
  @Get('stats/overview')
  async stats(@Query('storeId') storeId: string, @Query('days') days?: string) {
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

  /** Webhook events for a shipment */
  @Get(':orderId/events')
  async events(@Param('orderId') orderId: string) {
    const shipment = await this.prisma.courierShipment.findUnique({ where: { orderId } })
    if (!shipment) return []
    return this.prisma.courierWebhookEvent.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { createdAt: 'desc' },
    })
  }
}
