import type { PrismaService } from '../../common/prisma.service'
import type { CommerceEventOutboxService } from '../orders/commerce-event-outbox.service'
import type { StockReservationService } from './stock-reservation.service'
import type { OrderEventsService } from '../orders/order-events.service'
import type { CourierService } from '../courier/courier.service'
import { PaymentConfirmationService } from './payment-confirmation.service'

const order = {
  id: 'order-1',
  storeId: 'store-1',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'NAGAD',
  total: 1200,
  shippingEmail: 'buyer@example.com',
  shippingPhone: '01700000000',
  fbclid: null,
  fbp: null,
  fbc: null,
  clientIp: null,
  landingPage: null,
}

describe('PaymentConfirmationService', () => {
  const orderEvents = {
    onPaymentReceived: jest.fn().mockResolvedValue(undefined),
    onStatusChanged: jest.fn().mockResolvedValue(undefined),
  } as unknown as OrderEventsService
  const courier = {
    bookCourier: jest.fn().mockResolvedValue({ success: true }),
  } as unknown as CourierService

  it('is idempotent for an already-paid order', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ ...order, paymentStatus: 'PAID' }),
      },
    }
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService
    const reservations = { consume: jest.fn() } as unknown as StockReservationService
    const commerceEvents = {
      enqueueOrderPlaced: jest.fn(),
      dispatchForOrder: jest.fn(),
    } as unknown as CommerceEventOutboxService
    const service = new PaymentConfirmationService(
      prisma,
      reservations,
      commerceEvents,
      orderEvents,
      courier,
    )

    await expect(
      service.confirm({
        invoiceNumber: 'SPL-1001',
        method: 'NAGAD',
        transactionId: 'tx-1',
        amount: 1200,
      }),
    ).resolves.toEqual({ confirmed: false, orderId: 'order-1' })
    expect(reservations.consume).not.toHaveBeenCalled()
    expect(commerceEvents.enqueueOrderPlaced).not.toHaveBeenCalled()
  })

  it('consumes stock before marking payment paid and emits Purchase once', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    }
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService
    const reservations = {
      consume: jest.fn().mockResolvedValue(undefined),
    } as unknown as StockReservationService
    const commerceEvents = {
      enqueueOrderPlaced: jest.fn().mockResolvedValue(undefined),
      dispatchForOrder: jest.fn().mockResolvedValue(undefined),
    } as unknown as CommerceEventOutboxService
    const service = new PaymentConfirmationService(
      prisma,
      reservations,
      commerceEvents,
      orderEvents,
      courier,
    )

    await expect(
      service.confirm({
        invoiceNumber: 'SPL-1001',
        method: 'NAGAD',
        transactionId: 'tx-1',
        amount: 1200,
      }),
    ).resolves.toEqual({ confirmed: true, orderId: 'order-1' })
    expect(reservations.consume).toHaveBeenCalledWith(tx, 'order-1')
    expect(tx.order.updateMany).toHaveBeenCalled()
    expect(commerceEvents.enqueueOrderPlaced).toHaveBeenCalledTimes(1)
    expect(commerceEvents.dispatchForOrder).toHaveBeenCalledWith('order-1')
  })
})
