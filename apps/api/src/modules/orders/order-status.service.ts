import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { assertOrderStatusTransition, STOCK_RESTORING_STATUSES } from '../../common/order-status.util'
import { restoreOrderStock } from '../../common/order-stock.util'
import { OrderEventsService } from './order-events.service'

/**
 * Shared order status mutations — admin UI + AI agent must use the same path
 * (transitions, stock restore, history, events). Race-safe via updateMany.
 */
@Injectable()
export class OrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderEvents: OrderEventsService,
  ) {}

  async applyStatusChange(
    id: string,
    statusRaw: string,
    note: string | undefined,
    callerStoreId?: string,
    opts?: { notePrefix?: string },
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, storeId: true, status: true },
    })
    if (!existing) throw new NotFoundException('Order not found')
    if (callerStoreId && existing.storeId !== callerStoreId) {
      throw new NotFoundException('Order not found')
    }

    const status = assertOrderStatusTransition(existing.status, statusRaw)
    const shouldRestoreStock =
      STOCK_RESTORING_STATUSES.includes(status) &&
      !STOCK_RESTORING_STATUSES.includes(existing.status)

    const order = await this.prisma.$transaction(async (tx) => {
      const bumped = await tx.order.updateMany({
        where: { id, status: existing.status },
        data: {
          status,
          ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
          ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        },
      })
      if (bumped.count === 0) {
        throw new NotFoundException('Order status changed concurrently — refresh and retry')
      }

      const updated = await tx.order.findUniqueOrThrow({ where: { id } })

      if (shouldRestoreStock) {
        await restoreOrderStock(tx, id, `Stock restored — order ${status.toLowerCase()}`)
      }

      await tx.orderStatusHistory.create({
        data: { orderId: id, status, note: note ?? `Status changed to ${status}` },
      })

      return updated
    })

    if (note) {
      const prefix = opts?.notePrefix ?? ''
      await this.prisma.orderNote.create({
        data: { orderId: id, body: `${prefix}${note}`, isPrivate: true },
      })
    }

    void this.orderEvents
      .onStatusChanged(order.storeId, id, order.status, note)
      .catch(() => undefined)

    return order
  }
}
