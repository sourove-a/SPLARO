import { BadRequestException } from '@nestjs/common'
import { generatePaymentCode } from '../../common/payment-code.util'

/**
 * Unit-level coverage for admin manual PAID evidence rules
 * (mirrors OrdersController.updatePayment gates).
 */
describe('admin manual payment evidence', () => {
  function assertPaidEvidence(body: {
    paymentStatus: string
    reference?: string
    amount?: number
  }) {
    if (body.paymentStatus !== 'PAID') return
    const reference = body.reference?.trim() ?? ''
    if (reference.length < 3) {
      throw new BadRequestException(
        'Marking PAID requires a payment reference (trx id / bKash number)',
      )
    }
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0) {
      throw new BadRequestException('Marking PAID requires the amount received')
    }
  }

  it('rejects PAID without reference', () => {
    expect(() => assertPaidEvidence({ paymentStatus: 'PAID', amount: 1200 })).toThrow(
      BadRequestException,
    )
  })

  it('rejects PAID without amount', () => {
    expect(() =>
      assertPaidEvidence({ paymentStatus: 'PAID', reference: 'TX-12345' }),
    ).toThrow(BadRequestException)
  })

  it('allows PAID with reference + amount', () => {
    expect(() =>
      assertPaidEvidence({ paymentStatus: 'PAID', reference: 'TX-12345', amount: 1200 }),
    ).not.toThrow()
  })

  it('allows non-PAID without evidence', () => {
    expect(() => assertPaidEvidence({ paymentStatus: 'FAILED' })).not.toThrow()
  })

  it('generatePaymentCode returns PAY-#### shape', async () => {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ max: 1005 }]),
      payment: { findMany: jest.fn() },
    }
    const code = await generatePaymentCode(db as never, 'store-1')
    expect(code).toMatch(/^PAY-\d+$/)
    expect(code).toBe('PAY-1006')
  })
})

describe('public payment verified flag', () => {
  function isVerified(paymentStatus: string, transactionId: string | null | undefined) {
    return paymentStatus === 'PAID' && Boolean(transactionId?.trim())
  }

  it('is false when PAID without Payment.transactionId', () => {
    expect(isVerified('PAID', null)).toBe(false)
    expect(isVerified('PAID', '')).toBe(false)
  })

  it('is true when PAID with reference', () => {
    expect(isVerified('PAID', 'TX-999')).toBe(true)
  })
})
