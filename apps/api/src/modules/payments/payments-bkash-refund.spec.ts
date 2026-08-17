import { BadRequestException } from '@nestjs/common'
import { PaymentsController } from './payments.controller'

describe('PaymentsController.refundBkash', () => {
  function build(alreadyRefunded: number) {
    const paymentUpdate = jest.fn().mockResolvedValue({})
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          amount: 1000,
          refundAmount: alreadyRefunded,
          status: 'PAID',
          method: 'BKASH',
        }),
        update: paymentUpdate,
      },
    }
    const bkash = {
      refund: jest.fn().mockResolvedValue({ transactionStatus: 'Completed', refundTrxID: 'r1' }),
    }
    const controller = new PaymentsController(
      bkash as never,
      {} as never,
      {} as never,
      prisma as never,
      {} as never,
    )
    return { controller, bkash, paymentUpdate, prisma }
  }

  const body = {
    paymentId: 'p1',
    trxId: 'trx-1',
    amount: 1000,
    reason: 'test',
  }

  it('writes refundAmount so a second full refund is rejected', async () => {
    const first = build(0)
    await first.controller.refundBkash(body)
    expect(first.bkash.refund).toHaveBeenCalledTimes(1)
    expect(first.paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: 'trx-1' },
        data: expect.objectContaining({ refundAmount: 1000, status: 'REFUNDED' }),
      }),
    )

    const second = build(1000)
    await expect(second.controller.refundBkash(body)).rejects.toBeInstanceOf(BadRequestException)
    expect(second.bkash.refund).not.toHaveBeenCalled()
  })
})
