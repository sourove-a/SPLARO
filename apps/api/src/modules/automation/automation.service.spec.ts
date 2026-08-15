import { BadRequestException } from '@nestjs/common'
import { AutomationService } from './automation.service'
import type { OrderStatusService } from '../orders/order-status.service'
import type { EmailService } from '../email/email.service'
import type { CourierService } from '../courier/courier.service'
import type { SmsService } from '../notifications/sms.service'
import type { PrismaService } from '../../common/prisma.service'

describe('AutomationService (Phase 2)', () => {
  const applyStatusChange = jest.fn()
  const sendForStore = jest.fn()
  const bookCourier = jest.fn()
  const smsSend = jest.fn()

  const orderStatus = { applyStatusChange } as unknown as OrderStatusService
  const emailService = { sendForStore } as unknown as EmailService
  const courierService = { bookCourier } as unknown as CourierService
  const smsService = { send: smsSend } as unknown as SmsService

  const prisma = {
    automationRule: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    automationLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    courierShipment: {
      findUnique: jest.fn(),
    },
    cartSession: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService

  beforeEach(() => {
    jest.clearAllMocks()
    applyStatusChange.mockResolvedValue({ id: 'ord-1', status: 'CONFIRMED' })
    sendForStore.mockResolvedValue(true)
    bookCourier.mockResolvedValue({ success: true, consignmentId: 'ST-12345', status: 'IN_REVIEW' })
    smsSend.mockResolvedValue({ sent: true })
    ;(prisma.automationRule.update as jest.Mock).mockResolvedValue({})
    ;(prisma.courierShipment.findUnique as jest.Mock).mockResolvedValue(null)
  })

  describe('SEND_EMAIL Action', () => {
    it('sends email with interpolated template when context provides email', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-email-1',
          name: 'Send delivery email',
          conditions: [],
          actions: [
            {
              id: 'act-email-1',
              action: 'SEND_EMAIL',
              params: {
                subject: 'Your order {{invoiceNumber}} has shipped',
                body: 'Hello {{customerName}}, your order of BDT {{total}} is on the way.',
              },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      await service.runTrigger('store-1', 'ORDER_DELIVERED' as never, {
        storeId: 'store-1',
        email: 'customer@splaro.co',
        customerName: 'Aarav Khan',
        invoiceNumber: 'SPL-1001',
        total: 7500,
      })

      expect(sendForStore).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'store-1',
          to: 'customer@splaro.co',
          subject: 'Your order SPL-1001 has shipped',
          text: 'Hello Aarav Khan, your order of BDT 7500 is on the way.',
          transactional: true,
        }),
      )

      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true }),
        }),
      )
    })

    it('rejects invalid recipient email and records failure in AutomationLog without crashing', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-email-2',
          name: 'Send invalid email',
          conditions: [],
          actions: [
            {
              id: 'act-email-2',
              action: 'SEND_EMAIL',
              params: { subject: 'Test', body: 'Test' },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
        storeId: 'store-1',
        email: 'invalid-email-address',
      })

      expect(sendForStore).not.toHaveBeenCalled()
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            errorMsg: expect.stringContaining('Invalid or missing email address'),
          }),
        }),
      )
    })
  })

  describe('BOOK_COURIER Action', () => {
    it('dispatches booking to CourierService with idempotency check', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-courier-1',
          name: 'Auto book courier',
          conditions: [],
          actions: [
            {
              id: 'act-courier-1',
              action: 'BOOK_COURIER',
              params: { provider: 'STEADFAST' },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      await service.runTrigger('store-1', 'ORDER_CONFIRMED' as never, {
        orderId: 'ord-101',
        storeId: 'store-1',
      })

      expect(courierService.bookCourier).toHaveBeenCalledWith(
        'ord-101',
        'STEADFAST',
        { storeId: 'store-1' },
      )
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true }),
        }),
      )
    })

    it('skips booking when shipment already exists with active consignment (idempotency)', async () => {
      ;(prisma.courierShipment.findUnique as jest.Mock).mockResolvedValue({
        consignmentId: 'ST-EXISTING-99',
        status: 'IN_REVIEW',
      })
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-courier-2',
          name: 'Auto book courier idempotency',
          conditions: [],
          actions: [
            {
              id: 'act-courier-2',
              action: 'BOOK_COURIER',
              params: { provider: 'STEADFAST' },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      await service.runTrigger('store-1', 'ORDER_CONFIRMED' as never, {
        orderId: 'ord-101',
        storeId: 'store-1',
      })

      expect(courierService.bookCourier).not.toHaveBeenCalled()
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true }),
        }),
      )
    })
  })

  describe('Multi-Condition and Multi-Action Execution', () => {
    it('evaluates multiple conditions (GREATER_THAN & IN) and executes actions in sorted order', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-multi-1',
          name: 'VIP Dhaka High Value Order Flow',
          conditions: [
            { field: 'total', operator: 'GREATER_THAN', value: '5000' },
            { field: 'city', operator: 'IN', value: 'Dhaka, Chattogram' },
          ],
          actions: [
            {
              id: 'act-1',
              action: 'BOOK_COURIER',
              params: { provider: 'STEADFAST' },
              sortOrder: 0,
            },
            {
              id: 'act-2',
              action: 'SEND_SMS',
              params: { message: 'Order {{invoiceNumber}} booked with courier.' },
              sortOrder: 1,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      // Matching order
      await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
        orderId: 'ord-vip-1',
        invoiceNumber: 'SPL-VIP',
        storeId: 'store-1',
        total: 8500,
        city: 'Dhaka',
        phone: '01711000000',
      })

      expect(courierService.bookCourier).toHaveBeenCalledWith('ord-vip-1', 'STEADFAST', { storeId: 'store-1' })
      expect(smsService.send).toHaveBeenCalledWith('01711000000', 'Order SPL-VIP booked with courier.', 'store-1')
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true }),
        }),
      )
    })

    it('skips rule execution if any condition fails', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-multi-2',
          name: 'VIP Dhaka Only',
          conditions: [
            { field: 'total', operator: 'GREATER_THAN', value: '5000' },
            { field: 'city', operator: 'EQUALS', value: 'Dhaka' },
          ],
          actions: [
            { id: 'act-1', action: 'BOOK_COURIER', params: {}, sortOrder: 0 },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      // Non-matching order (Sylhet instead of Dhaka)
      await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
        orderId: 'ord-sylhet',
        storeId: 'store-1',
        total: 10000,
        city: 'Sylhet',
      })

      expect(courierService.bookCourier).not.toHaveBeenCalled()
      expect(prisma.automationLog.create).not.toHaveBeenCalled()
    })
  })

  describe('ABANDONED_CART Sweep', () => {
    it('sweeps unpurchased inactive carts and triggers ABANDONED_CART automation', async () => {
      ;(prisma.cartSession.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cart-1',
          sessionId: 'sess-abc',
          storeId: 'store-1',
          customerId: 'cust-1',
          customer: {
            id: 'cust-1',
            firstName: 'Tanvir',
            lastName: 'Ahmed',
            email: 'tanvir@example.com',
            phone: '01811000000',
          },
          items: [
            {
              quantity: 2,
              product: { id: 'p-1', name: 'Silk Shirt', basePrice: 2500 },
              variant: { id: 'v-1', price: 2500, size: 'L', color: 'Black' },
            },
          ],
        },
      ])
      ;(prisma.cartSession.update as jest.Mock).mockResolvedValue({})
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-cart-1',
          name: 'Send Abandoned Cart Email',
          conditions: [],
          actions: [
            {
              id: 'act-cart-1',
              action: 'SEND_EMAIL',
              params: {
                subject: 'Complete your purchase, {{customerName}}',
                body: 'Your cart has {{itemCount}} items worth BDT {{total}} waiting.',
              },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(
        prisma,
        orderStatus,
        undefined,
        smsService,
        undefined,
        emailService,
        courierService,
      )

      const result = await service.sweepAbandonedCarts('store-1')
      expect(result.swept).toBe(1)
      expect(prisma.cartSession.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { isAbandoned: true },
      })
      expect(sendForStore).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'store-1',
          to: 'tanvir@example.com',
          subject: 'Complete your purchase, Tanvir Ahmed',
          text: 'Your cart has 2 items worth BDT 5000 waiting.',
        }),
      )
    })
  })

  describe('UPDATE_ORDER_STATUS', () => {
    it('routes valid status through OrderStatusService.applyStatusChange', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-status-1',
          name: 'Confirm on pay',
          conditions: [],
          actions: [
            {
              id: 'act-1',
              action: 'UPDATE_ORDER_STATUS',
              params: { status: 'CONFIRMED' },
              sortOrder: 0,
            },
          ],
        },
      ])

      const service = new AutomationService(prisma, orderStatus)
      await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
        orderId: 'ord-1',
        storeId: 'store-1',
      })
      expect(applyStatusChange).toHaveBeenCalledWith(
        'ord-1',
        'CONFIRMED',
        'Automation rule rule-status-1',
        'store-1',
        { notePrefix: 'Automation: ' },
      )
    })

    it('rejects unknown status and does not call applyStatusChange', async () => {
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-status-2',
          name: 'Bad status',
          conditions: [],
          actions: [
            {
              id: 'act-2',
              action: 'UPDATE_ORDER_STATUS',
              params: { status: 'NOT_A_REAL_STATUS' },
              sortOrder: 0,
            },
          ],
        },
      ])
      const service = new AutomationService(prisma, orderStatus)
      await service.runTrigger('store-1', 'ORDER_PLACED' as never, { orderId: 'ord-1' })
      expect(applyStatusChange).not.toHaveBeenCalled()
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        }),
      )
    })

    it('surfaces transition failures from OrderStatusService', async () => {
      applyStatusChange.mockRejectedValue(
        new BadRequestException('Cannot change order from DELIVERED to PENDING'),
      )
      ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-status-3',
          name: 'Invalid transition',
          conditions: [],
          actions: [
            {
              id: 'act-3',
              action: 'UPDATE_ORDER_STATUS',
              params: { status: 'PENDING' },
              sortOrder: 0,
            },
          ],
        },
      ])
      const service = new AutomationService(prisma, orderStatus)
      await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
        orderId: 'ord-1',
        storeId: 'store-1',
      })
      expect(prisma.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            errorMsg: expect.stringContaining('Cannot change order'),
          }),
        }),
      )
    })
  })
})
