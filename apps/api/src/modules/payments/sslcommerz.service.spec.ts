import { createHash } from 'crypto'
import type { PrismaService } from '../../common/prisma.service'
import type { PaymentIntegrationService } from '../integrations/payment-integration.service'
import { SslCommerzService, type SslCommerzIpnPayload } from './sslcommerz.service'

/**
 * Regression cover for the unauthenticated ledger-tamper path:
 * `POST /api/v1/payments/ssl/fail` with only a { tran_id } body used to reach
 * updateOrderPayment unchecked, where an unscoped findFirst picked up whichever
 * Payment row the order had — including a PAID bKash one — and overwrote its
 * status, transactionId and gatewayResponse.
 */
describe('SslCommerzService.handleCallback', () => {
  const LIVE_CREDS = { storeId: 'splarolive', storePassword: 'secret-pw', sandbox: false }

  function buildService(overrides: {
    payment?: { status: string } | null
    orderPaymentStatus?: string
  }) {
    const paymentFindFirst = jest.fn().mockResolvedValue(overrides.payment ?? null)
    const paymentUpdate = jest.fn()
    const paymentCreate = jest.fn()
    const transaction = jest.fn().mockResolvedValue([])

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord-1',
          storeId: 'splaro',
          total: 1499,
          status: 'PENDING',
          paymentStatus: overrides.orderPaymentStatus ?? 'PENDING',
        }),
      },
      payment: {
        findFirst: paymentFindFirst,
        update: paymentUpdate,
        create: paymentCreate,
        // generatePaymentCode scans existing PAY-* numbers to pick the next one.
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderStatusHistory: { create: jest.fn() },
      $transaction: transaction,
    } as unknown as PrismaService

    const paymentIntegration = {
      resolveRuntimeCredentials: jest.fn().mockResolvedValue(LIVE_CREDS),
    } as unknown as PaymentIntegrationService

    return {
      service: new SslCommerzService(prisma, paymentIntegration),
      paymentFindFirst,
      paymentUpdate,
      paymentCreate,
      transaction,
    }
  }

  /** Mirrors the gateway's documented verify_sign scheme. */
  function sign(body: Omit<SslCommerzIpnPayload, 'verify_sign'>): SslCommerzIpnPayload {
    const keys = (body.verify_key ?? '').split(',')
    const parts = keys.map((key) =>
      key === 'store_passwd'
        ? `${key}=${createHash('md5').update(LIVE_CREDS.storePassword).digest('hex')}`
        : `${key}=${(body as unknown as Record<string, string>)[key] ?? ''}`,
    )
    return {
      ...body,
      verify_sign: createHash('md5').update(parts.join('&')).digest('hex'),
    }
  }

  it('rejects an unsigned fail callback without touching the ledger', async () => {
    const { service, paymentFindFirst, paymentUpdate, paymentCreate } = buildService({
      payment: { status: 'PAID' },
    })

    const result = await service.handleCallback(
      { tran_id: 'SPL-1001', amount: '1499', status: 'FAILED' },
      'fail',
    )

    expect(result).toEqual({ ok: false, invoiceNumber: 'SPL-1001', status: 'INVALID' })
    expect(paymentFindFirst).not.toHaveBeenCalled()
    expect(paymentUpdate).not.toHaveBeenCalled()
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('rejects an unsigned cancel callback', async () => {
    const { service, paymentFindFirst } = buildService({ payment: { status: 'PAID' } })

    const result = await service.handleCallback(
      { tran_id: 'SPL-1001', amount: '1499', status: 'CANCELLED' },
      'cancel',
    )

    expect(result.ok).toBe(false)
    expect(paymentFindFirst).not.toHaveBeenCalled()
  })

  it('rejects a callback with no tran_id', async () => {
    const { service } = buildService({})

    const result = await service.handleCallback(
      { tran_id: '', amount: '1499', status: 'FAILED' },
      'fail',
    )

    expect(result.ok).toBe(false)
  })

  it('scopes the ledger lookup to SSLCOMMERZ so other gateways are never overwritten', async () => {
    const { service, paymentFindFirst } = buildService({ payment: null })

    await service.handleCallback(
      sign({
        tran_id: 'SPL-1001',
        amount: '1499',
        status: 'FAILED',
        verify_key: 'tran_id,amount,store_passwd',
      }),
      'fail',
    )

    expect(paymentFindFirst).toHaveBeenCalledWith({
      where: { orderId: 'ord-1', method: 'SSLCOMMERZ' },
    })
  })

  it('never downgrades a settled payment on a signed fail callback', async () => {
    const { service, paymentUpdate, paymentCreate, transaction } = buildService({
      payment: { status: 'PAID' },
    })

    await service.handleCallback(
      sign({
        tran_id: 'SPL-1001',
        amount: '1499',
        status: 'FAILED',
        verify_key: 'tran_id,amount,store_passwd',
      }),
      'fail',
    )

    expect(paymentUpdate).not.toHaveBeenCalled()
    expect(paymentCreate).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('still records a first-attempt failure when no SSLCommerz row exists yet', async () => {
    const { service, paymentCreate, transaction } = buildService({ payment: null })

    await service.handleCallback(
      sign({
        tran_id: 'SPL-1001',
        amount: '1499',
        status: 'FAILED',
        verify_key: 'tran_id,amount,store_passwd',
      }),
      'fail',
    )

    expect(paymentCreate).toHaveBeenCalled()
    expect(transaction).toHaveBeenCalled()
  })

  it('rejects a self-signed body that omits store_passwd', async () => {
    const { service, paymentFindFirst } = buildService({ payment: null })

    const result = await service.handleCallback(
      sign({
        tran_id: 'SPL-1001',
        amount: '1499',
        status: 'FAILED',
        verify_key: 'tran_id,amount',
      }),
      'fail',
    )

    expect(result).toEqual({ ok: false, invoiceNumber: 'SPL-1001', status: 'INVALID' })
    expect(paymentFindFirst).not.toHaveBeenCalled()
  })
})
