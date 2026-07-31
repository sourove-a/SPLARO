import type { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from './notifications.service'

describe('NotificationsService in-app alerts', () => {
  function buildService(existing: { id: string } | null = null) {
    const findFirst = jest.fn().mockResolvedValue(existing)
    const create = jest.fn().mockResolvedValue({ id: 'notice-1' })
    const prisma = {
      notificationDeliveryLog: { findFirst, create },
    } as unknown as PrismaService
    return {
      service: new NotificationsService(prisma, undefined as never),
      findFirst,
      create,
    }
  }

  const input = {
    storeId: 'store-1',
    subject: 'New order · SPL-1007',
    body: 'Customer · ৳1,200 · Cash on delivery',
    href: '/dashboard/orders/SPL-1007' as const,
  }

  it('persists a delivered IN_APP alert', async () => {
    const { service, create } = buildService()

    await expect(service.notifyInApp(input)).resolves.toBe(true)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 'store-1',
        channel: 'IN_APP',
        recipient: '/dashboard/orders/SPL-1007',
        status: 'DELIVERED',
      }),
    })
  })

  it('does not duplicate the same event', async () => {
    const { service, create } = buildService({ id: 'existing-1' })

    await expect(service.notifyInApp(input)).resolves.toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it('reports persistence failure without claiming success', async () => {
    const { service, create } = buildService()
    create.mockRejectedValueOnce(new Error('database offline'))

    await expect(service.notifyInApp(input)).resolves.toBe(false)
  })
})
