import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { redisQueuesEnabled } from '../../common/noop-queue.providers'
import { MetaCapiService } from '../marketing/meta-capi.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { OrderEventsService } from './order-events.service'

export interface OrderPlacedSideEffectPayload {
  storeId: string
  orderId: string
  customerEmail?: string
  meta: {
    total: number
    email?: string
    phone?: string
    fbclid?: string | null
    clientIp?: string | null
    userAgent?: string | null
    eventSourceUrl?: string | null
  }
}

@Injectable()
export class OrderSideEffectsQueueService {
  private readonly logger = new Logger(OrderSideEffectsQueueService.name)

  constructor(
    @InjectQueue('order-side-effects') private readonly queue: Queue,
    private readonly metaCapi: MetaCapiService,
    private readonly orderNotifications: OrderNotificationsService,
    @Optional()
    @Inject(forwardRef(() => OrderEventsService))
    private readonly orderEvents: OrderEventsService | null,
  ) {}

  async enqueueOrderPlaced(payload: OrderPlacedSideEffectPayload): Promise<void> {
    if (!redisQueuesEnabled()) {
      await this.processOrderPlaced(payload)
      return
    }

    await this.queue.add('order-placed', payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    })
  }

  async processOrderPlaced(payload: OrderPlacedSideEffectPayload): Promise<void> {
    const { storeId, orderId, customerEmail, meta } = payload

    await this.metaCapi
      .trackPurchase({
        storeId,
        orderId,
        total: meta.total,
        email: meta.email,
        phone: meta.phone,
        fbclid: meta.fbclid,
        clientIp: meta.clientIp,
        userAgent: meta.userAgent,
        eventSourceUrl: meta.eventSourceUrl,
      })
      .catch((err: unknown) =>
        this.logger.error(
          `trackPurchase failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
        ),
      )

    await this.orderNotifications
      .onOrderPlaced(storeId, orderId, customerEmail)
      .catch((err: unknown) =>
        this.logger.error(
          `Order confirmation notification failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
        ),
      )

    await this.orderEvents
      ?.onOrderPlaced(storeId, orderId)
      .catch((err: unknown) =>
        this.logger.error(
          `onOrderPlaced automation hook failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
        ),
      )
  }
}

