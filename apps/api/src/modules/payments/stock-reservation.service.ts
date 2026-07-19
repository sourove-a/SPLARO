import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'

export interface ReservableLine {
  variantId: string
  quantity: number
  name: string
}

const DEFAULT_RESERVATION_MINUTES = 15

@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name)

  constructor(private readonly prisma: PrismaService) {}

  private expiryDate(): Date {
    const configured = Number(process.env['PAYMENT_STOCK_RESERVATION_MINUTES'])
    const minutes =
      Number.isFinite(configured) && configured >= 5 && configured <= 120
        ? configured
        : DEFAULT_RESERVATION_MINUTES
    return new Date(Date.now() + minutes * 60_000)
  }

  async decrementCodStock(
    tx: Prisma.TransactionClient,
    lines: ReservableLine[],
  ): Promise<void> {
    for (const line of lines) {
      const changed = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${line.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${line.variantId}
          AND ("stock" - "reservedStock") >= ${line.quantity}
      `
      if (changed !== 1) {
        throw new BadRequestException(`${line.name}: just sold out — please refresh your cart`)
      }
    }
  }

  async createReservation(
    tx: Prisma.TransactionClient,
    orderId: string,
    lines: ReservableLine[],
  ): Promise<void> {
    for (const line of lines) {
      const changed = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${line.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${line.variantId}
          AND ("stock" - "reservedStock") >= ${line.quantity}
      `
      if (changed !== 1) {
        throw new BadRequestException(`${line.name}: just sold out — please refresh your cart`)
      }
    }

    await tx.stockReservation.create({
      data: {
        orderId,
        expiresAt: this.expiryDate(),
        items: {
          create: lines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        },
      },
    })
  }

  async consume(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const reservation = await tx.stockReservation.findUnique({
      where: { orderId },
      include: { items: true },
    })
    if (!reservation || reservation.status !== 'ACTIVE' || reservation.expiresAt <= new Date()) {
      throw new BadRequestException('Payment session expired — please place the order again')
    }

    const claimed = await tx.stockReservation.updateMany({
      where: { id: reservation.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    })
    if (claimed.count !== 1) {
      throw new BadRequestException('Payment session is no longer active')
    }

    for (const item of reservation.items) {
      const changed = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${item.quantity},
            "reservedStock" = "reservedStock" - ${item.quantity},
            "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND "stock" >= ${item.quantity}
          AND "reservedStock" >= ${item.quantity}
      `
      if (changed !== 1) {
        throw new BadRequestException('Reserved stock is unavailable — payment requires reconciliation')
      }
    }
  }

  async releaseForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: 'RELEASED' | 'EXPIRED' = 'RELEASED',
  ): Promise<boolean> {
    const reservation = await tx.stockReservation.findUnique({
      where: { orderId },
      include: { items: true },
    })
    if (!reservation || reservation.status !== 'ACTIVE') return false

    const claimed = await tx.stockReservation.updateMany({
      where: { id: reservation.id, status: 'ACTIVE' },
      data: { status, releasedAt: new Date() },
    })
    if (claimed.count !== 1) return false

    for (const item of reservation.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { reservedStock: { decrement: item.quantity } },
      })
    }
    return true
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireReservations(): Promise<void> {
    const expired = await this.prisma.stockReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      select: { orderId: true },
      take: 100,
    })
    for (const row of expired) {
      await this.prisma.$transaction(async (tx) => {
        const released = await this.releaseForOrder(tx, row.orderId, 'EXPIRED')
        if (!released) return
        const cancelled = await tx.order.updateMany({
          where: {
            id: row.orderId,
            status: 'PENDING',
            paymentStatus: { in: ['UNPAID', 'PENDING'] },
          },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            cancelledAt: new Date(),
          },
        })
        if (cancelled.count === 1) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: row.orderId,
              status: 'CANCELLED',
              note: 'Digital payment window expired; reserved stock released',
            },
          })
        }
      })
    }
    if (expired.length) this.logger.log(`Expired ${expired.length} stock reservation(s)`)
  }
}
