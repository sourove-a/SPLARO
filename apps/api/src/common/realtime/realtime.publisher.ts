import { Injectable, Logger } from '@nestjs/common'
import { RealtimeBusService } from './realtime-bus.service'
import {
  adminNotificationsRealtimeChannel,
  adminOrdersRealtimeChannel,
  isSafeRealtimeId,
  orderRealtimeChannel,
} from './realtime-channels'
import type { PublishOrderRealtimeInput, RealtimeOrderEvent } from './realtime.types'

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name)

  constructor(private readonly bus: RealtimeBusService) {}

  /** Call only after the DB mutation has committed. Never throw to callers. */
  async publishOrderEvent(input: PublishOrderRealtimeInput): Promise<void> {
    const orderId = input.orderId?.trim()
    const storeId = input.storeId?.trim()
    if (!orderId || !storeId || !isSafeRealtimeId(orderId) || !isSafeRealtimeId(storeId)) {
      return
    }

    try {
      const seq = await this.bus.nextSeq(orderId)
      const updatedAt =
        input.updatedAt instanceof Date
          ? input.updatedAt.toISOString()
          : typeof input.updatedAt === 'string' && input.updatedAt.trim()
            ? new Date(input.updatedAt).toISOString()
            : new Date().toISOString()

      const event: RealtimeOrderEvent = {
        type: input.type,
        orderId,
        updatedAt,
        seq,
      }
      const invoice = input.invoiceNumber?.trim()
      if (invoice) event.invoiceNumber = invoice
      const status = input.status?.trim()
      if (status) event.status = status
      const paymentStatus = input.paymentStatus?.trim()
      if (paymentStatus) event.paymentStatus = paymentStatus

      const payload = JSON.stringify(event)
      await this.bus.publish(orderRealtimeChannel(orderId), payload)
      await this.bus.publish(adminOrdersRealtimeChannel(storeId), payload)
    } catch (err) {
      this.logger.warn(
        `Realtime order publish skipped: ${err instanceof Error ? err.message : 'error'}`,
      )
    }
  }

  /** Ping the admin bell after an IN_APP row is committed. Never throw. */
  async publishNotificationCreated(storeId: string): Promise<void> {
    const id = storeId?.trim()
    if (!id || !isSafeRealtimeId(id)) return
    try {
      await this.bus.publish(
        adminNotificationsRealtimeChannel(id),
        JSON.stringify({ type: 'notification.created', updatedAt: new Date().toISOString() }),
      )
    } catch (err) {
      this.logger.warn(
        `Realtime notification publish skipped: ${err instanceof Error ? err.message : 'error'}`,
      )
    }
  }
}
