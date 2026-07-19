import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import {
  OrderSideEffectsQueueService,
  type OrderPlacedSideEffectPayload,
} from './order-side-effects-queue.service'

const EVENT_TYPE = 'ORDER_PLACED'
const PROCESSING_TIMEOUT_MS = 5 * 60_000
const MAX_RETRY_DELAY_MS = 60 * 60_000
const RETRY_BASE_DELAY_MS = 5_000

function orderPlacedDedupeKey(orderId: string): string {
  return `order-placed:${orderId}`
}

@Injectable()
export class CommerceEventOutboxService {
  private readonly logger = new Logger(CommerceEventOutboxService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sideEffects: OrderSideEffectsQueueService,
  ) {}

  async enqueueOrderPlaced(
    tx: Prisma.TransactionClient,
    payload: OrderPlacedSideEffectPayload,
  ): Promise<void> {
    const dedupeKey = orderPlacedDedupeKey(payload.orderId)
    await tx.commerceEventOutbox.upsert({
      where: { dedupeKey },
      create: {
        storeId: payload.storeId,
        orderId: payload.orderId,
        eventType: EVENT_TYPE,
        dedupeKey,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {},
    })
  }

  async dispatchForOrder(orderId: string): Promise<void> {
    const event = await this.prisma.commerceEventOutbox.findFirst({
      where: {
        orderId,
        eventType: EVENT_TYPE,
        status: { in: ['PENDING', 'FAILED'] },
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (event) await this.dispatch(event.id)
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending(): Promise<void> {
    const staleProcessing = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
    const events = await this.prisma.commerceEventOutbox.findMany({
      where: {
        OR: [
          {
            status: { in: ['PENDING', 'FAILED'] },
            availableAt: { lte: new Date() },
          },
          { status: 'PROCESSING', updatedAt: { lte: staleProcessing } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    for (const event of events) {
      await this.dispatch(event.id)
    }
  }

  private async dispatch(id: string): Promise<void> {
    const staleProcessing = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
    const claimed = await this.prisma.commerceEventOutbox.updateMany({
      where: {
        id,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] }, availableAt: { lte: new Date() } },
          {
            status: 'PROCESSING',
            updatedAt: { lte: staleProcessing },
          },
        ],
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    })
    if (claimed.count !== 1) return

    const event = await this.prisma.commerceEventOutbox.findUnique({ where: { id } })
    if (!event) return

    try {
      if (event.eventType !== EVENT_TYPE) {
        throw new Error(`Unsupported commerce event type: ${event.eventType}`)
      }
      await this.sideEffects.enqueueOrderPlaced(
        event.payload as unknown as OrderPlacedSideEffectPayload,
      )
      await this.prisma.commerceEventOutbox.update({
        where: { id },
        data: { status: 'SENT', processedAt: new Date(), lastError: null },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown outbox dispatch error'
      const retryDelayMs = Math.min(
        MAX_RETRY_DELAY_MS,
        2 ** Math.min(event.attempts, 10) * RETRY_BASE_DELAY_MS,
      )
      await this.prisma.commerceEventOutbox.update({
        where: { id },
        data: {
          status: 'FAILED',
          availableAt: new Date(Date.now() + retryDelayMs),
          lastError: message.slice(0, 1000),
        },
      })
      this.logger.error(`Commerce event ${id} failed: ${message}`)
    }
  }
}
