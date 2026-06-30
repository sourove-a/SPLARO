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
import {
  WebhooksService,
  type WebhookEndpoint,
  type WebhookEventType,
} from './webhooks.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

const ALL_EVENTS: WebhookEventType[] = [
  'order.created',
  'order.confirmed',
  'order.cancelled',
  'order.delivered',
  'payment.received',
  'payment.failed',
  'courier.booked',
  'courier.failed',
  'product.created',
  'product.updated',
  'product.low_stock',
  'customer.created',
  'rma.requested',
]

@Controller('admin/webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* ─── Endpoints ───────────────────────────────────────────── */

  @Get()
  list(@Query('storeId') storeId: string) {
    return this.webhooks.list(storeId)
  }

  @Post()
  add(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      url: string
      secret?: string
      events: WebhookEventType[]
      isActive?: boolean
    },
  ) {
    const endpoint: WebhookEndpoint = {
      url: body.url,
      secret: body.secret,
      events: body.events,
      isActive: body.isActive ?? true,
    }
    return this.webhooks.addEndpoint(storeId, endpoint)
  }

  /** Update endpoint url/secret/events/isActive */
  @Patch()
  async update(
    @Query('storeId') storeId: string,
    @Query('url') url: string,
    @Body()
    body: {
      newUrl?: string
      secret?: string
      events?: WebhookEventType[]
      isActive?: boolean
    },
  ) {
    const endpoints: WebhookEndpoint[] = await this.webhooks.list(storeId)
    const idx = endpoints.findIndex((e) => e.url === url)
    if (idx === -1) return { error: 'Endpoint not found' }

    endpoints[idx] = {
      ...endpoints[idx],
      ...(body.newUrl ? { url: body.newUrl } : {}),
      ...(body.secret !== undefined ? { secret: body.secret } : {}),
      ...(body.events ? { events: body.events } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    }

    await this.webhooks.saveEndpoints(storeId, endpoints)

    return { ok: true, endpoint: endpoints[idx] }
  }

  @Delete()
  remove(@Query('storeId') storeId: string, @Query('url') url: string) {
    return this.webhooks.removeEndpoint(storeId, url)
  }

  /* ─── Test & dispatch ─────────────────────────────────────── */

  @Post('test')
  async test(
    @Query('storeId') storeId: string,
    @Body() body: { event?: WebhookEventType },
  ) {
    await this.webhooks.dispatch(storeId, body.event ?? 'order.created', {
      test: true,
      message: 'SPLARO webhook test',
    })
    return { ok: true }
  }

  /** Manually dispatch any event with custom payload */
  @Post('dispatch')
  async dispatch(
    @Query('storeId') storeId: string,
    @Body() body: { event: WebhookEventType; data?: Record<string, unknown> },
  ) {
    await this.webhooks.dispatch(storeId, body.event, body.data ?? {})
    return { ok: true, event: body.event }
  }

  /* ─── Delivery log (stored in AuditLog) ───────────────────── */

  @Get('logs')
  async deliveryLogs(
    @Query('storeId') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('event') event?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      storeId: sid,
      action: 'WEBHOOK_SENT',
      ...(event ? { resource: event } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          newData: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Stats: deliveries by event, success/fail rates */
  @Get('stats')
  async stats(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const [total, byEvent] = await Promise.all([
      this.prisma.auditLog.count({
        where: { storeId: sid, action: 'WEBHOOK_SENT', createdAt: { gte: since } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        where: { storeId: sid, action: 'WEBHOOK_SENT', createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { resource: 'desc' } },
      }),
    ])

    return {
      period: `${Number(days) || 30}d`,
      totalDispatched: total,
      byEvent: byEvent.map((e) => ({ event: e.resource, count: e._count })),
    }
  }

  /* ─── Meta ────────────────────────────────────────────────── */

  /** List all available event types */
  @Get('events')
  listEventTypes() {
    return { events: ALL_EVENTS }
  }
}
