import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { PrismaService } from '../../common/prisma.service'
import { StockReservationService } from './stock-reservation.service'

describe('StockReservationService', () => {
  const prisma = {} as PrismaService
  const service = new StockReservationService(prisma)

  it('rejects COD when available stock cannot be decremented atomically', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
    } as unknown as Prisma.TransactionClient

    await expect(
      service.decrementCodStock(tx, [{ variantId: 'v1', quantity: 2, name: 'Dress' }]),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('reserves stock and creates an expiring reservation in one transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'reservation-1' })
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      stockReservation: { create },
    } as unknown as Prisma.TransactionClient

    await service.createReservation(tx, 'order-1', [
      { variantId: 'v1', quantity: 2, name: 'Dress' },
    ])

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          expiresAt: expect.any(Date),
        }),
      }),
    )
  })

  it('does not consume an expired reservation', async () => {
    const tx = {
      stockReservation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reservation-1',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() - 1000),
          items: [],
        }),
      },
    } as unknown as Prisma.TransactionClient

    await expect(service.consume(tx, 'order-1')).rejects.toBeInstanceOf(BadRequestException)
  })
})
