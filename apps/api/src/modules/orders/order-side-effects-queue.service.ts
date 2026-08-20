import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { MetaCapiService } from '../marketing/meta-capi.service'
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
    fbp?: string | null
    fbc?: string | null
    clientIp?: string | null
    userAgent?: string | null
    eventSourceUrl?: string | null
  }
}

@Injectable()
export class OrderSideEffectsQueueService {
  private readonly logger = new Logger(OrderSideEffectsQueueService.name)

  constructor(
    private readonly metaCapi: MetaCapiService,
    @Optional()
    @Inject(forwardRef(() => OrderEventsService))
    private readonly orderEvents: OrderEventsService | null,
  ) {}

  async enqueueOrderPlaced(payload: OrderPlacedSideEffectPayload): Promise<void> {
    // Run in-process. Marking the outbox SENT after `queue.add` lost new-order
    // Telegram + Notification Center rows whenever the Redis worker lagged.
    await this.processOrderPlaced(payload)
  }

  async processOrderPlaced(payload: OrderPlacedSideEffectPayload): Promise<void> {
    const { storeId, orderId, customerEmail, meta } = payload

    // Meta + email/Telegram + automations are independent — run in parallel.
    await Promise.all([
      this.metaCapi
        .trackPurchase({
          storeId,
          orderId,
          total: meta.total,
          email: meta.email,
          phone: meta.phone,
          fbclid: meta.fbclid,
          fbp: meta.fbp,
          fbc: meta.fbc,
          clientIp: meta.clientIp,
          userAgent: meta.userAgent,
          eventSourceUrl: meta.eventSourceUrl,
        })
        .catch((err: unknown) =>
          this.logger.error(
            `trackPurchase failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
          ),
        ),
      this.orderEvents
        ?.onOrderPlaced(storeId, orderId, customerEmail)
        .catch((err: unknown) =>
          this.logger.error(
            `onOrderPlaced automation hook failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
          ),
        ) ?? Promise.resolve(),
    ])
  }
}

