import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import type { PaymentMethod, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { CommerceEventOutboxService } from '../orders/commerce-event-outbox.service'
import { OrderEventsService } from '../orders/order-events.service'
import { CourierService } from '../courier/courier.service'
import { StockReservationService } from './stock-reservation.service'

type DigitalPaymentMethod = Extract<PaymentMethod, 'BKASH' | 'NAGAD' | 'SSLCOMMERZ'>

export interface ConfirmPaymentInput {
  invoiceNumber: string
  method: DigitalPaymentMethod
  transactionId: string
  amount: number
  gatewayResponse?: Prisma.InputJsonValue
}

@Injectable()
export class PaymentConfirmationService {
  private readonly logger = new Logger(PaymentConfirmationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
    private readonly commerceEvents: CommerceEventOutboxService,
    private readonly orderEvents: OrderEventsService,
    private readonly courier: CourierService,
  ) {}

  async confirm(input: ConfirmPaymentInput): Promise<{ confirmed: boolean; orderId: string }> {
    if (!input.transactionId?.trim()) throw new BadRequestException('Gateway transaction ID missing')
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new BadRequestException('Invalid paid amount')
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { invoiceNumber: input.invoiceNumber },
          select: {
            id: true,
            storeId: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            shippingEmail: true,
            shippingPhone: true,
            fbclid: true,
            fbp: true,
            fbc: true,
            clientIp: true,
            landingPage: true,
          },
        })
        if (!order) throw new BadRequestException('Order not found')
        if (order.paymentStatus === 'PAID') {
          return { confirmed: false, order, rejection: null }
        }

        if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: order.status,
              note: `${input.method} payment received after ${order.status} (TxID: ${input.transactionId}) — manual refund required`,
            },
          })
          return {
            confirmed: false,
            order,
            rejection: 'Order is no longer payable — payment requires refund',
          }
        }
        if (order.paymentMethod !== input.method) {
          throw new BadRequestException('Payment gateway does not match the order')
        }
        if (input.amount + 1 < Number(order.total)) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: order.status,
              note: `${input.method} paid ${input.amount} of ${Number(order.total)} (TxID: ${input.transactionId}) — not confirmed`,
            },
          })
          return {
            confirmed: false,
            order,
            rejection: 'Paid amount does not cover the order total',
          }
        }

        await this.reservations.consume(tx, order.id)

        const payment = await tx.payment.findFirst({
          where: { orderId: order.id },
          select: { id: true },
        })
        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              method: input.method,
              status: 'PAID',
              amount: input.amount,
              transactionId: input.transactionId,
              paidAt: new Date(),
              ...(input.gatewayResponse ? { gatewayResponse: input.gatewayResponse } : {}),
            },
          })
        } else {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: input.method,
              status: 'PAID',
              amount: input.amount,
              transactionId: input.transactionId,
              paidAt: new Date(),
              ...(input.gatewayResponse ? { gatewayResponse: input.gatewayResponse } : {}),
            },
          })
        }

        const updated = await tx.order.updateMany({
          where: { id: order.id, paymentStatus: { not: 'PAID' } },
          data: { status: 'CONFIRMED', paymentStatus: 'PAID', confirmedAt: new Date() },
        })
        if (updated.count !== 1) {
          throw new BadRequestException('Payment was already processed')
        }
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: 'CONFIRMED',
            note: `${input.method} payment confirmed. TxID: ${input.transactionId}`,
          },
        })
        await this.commerceEvents.enqueueOrderPlaced(tx, {
          storeId: order.storeId,
          orderId: order.id,
          customerEmail: order.shippingEmail ?? undefined,
          meta: {
            total: Number(order.total),
            email: order.shippingEmail ?? undefined,
            phone: order.shippingPhone,
            fbclid: order.fbclid,
            fbp: order.fbp,
            fbc: order.fbc,
            clientIp: order.clientIp,
            eventSourceUrl: order.landingPage,
          },
        })
        return { confirmed: true, order, rejection: null }
      },
      { isolationLevel: 'Serializable' },
    )

    if (result.rejection) throw new BadRequestException(result.rejection)

    if (result.confirmed) {
      await this.commerceEvents
        .dispatchForOrder(result.order.id)
        .catch((error: unknown) =>
          this.logger.error(
            `Post-payment side effects failed for ${input.invoiceNumber}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          ),
        )
      await this.orderEvents
        .onPaymentReceived(
          result.order.storeId,
          result.order.id,
          input.amount,
          input.method.toLowerCase(),
        )
        .catch(() => undefined)
      await this.orderEvents
        .onStatusChanged(result.order.storeId, result.order.id, 'CONFIRMED')
        .catch(() => undefined)
      if (process.env.AUTO_COURIER_BOOK !== 'false') {
        void this.courier.bookCourier(result.order.id).catch((error: unknown) => {
          this.logger.error(
            `Auto courier booking failed for ${input.invoiceNumber}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          )
        })
      }
      this.logger.log(`${input.method} payment confirmed for ${input.invoiceNumber}`)
    }

    return { confirmed: result.confirmed, orderId: result.order.id }
  }
}
