import type { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from './notifications.service'

describe('NotificationsService in-app alerts', () => {
  function buildService(existing: { id: string } | null = null) {
    const findFirst = jest.fn().mockResolvedValue(existing)
    const create = jest.fn().mockResolvedValue({ id: 'notice-1' })
    const publish = jest.fn().mockResolvedValue(undefined)
    const prisma = {
      notificationDeliveryLog: { findFirst, create },
    } as unknown as PrismaService
    const realtime = { publishNotificationCreated: publish } as never
    return {
      service: new NotificationsService(prisma, undefined as never, realtime),
      findFirst,
      create,
      publish,
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

  it('pings admin realtime after a new IN_APP row', async () => {
    const { service, publish } = buildService()
    await service.notifyInApp(input)
    expect(publish).toHaveBeenCalledWith('store-1')
  })

  it('does not ping realtime for a duplicate', async () => {
    const { service, publish } = buildService({ id: 'existing-1' })
    await service.notifyInApp(input)
    expect(publish).not.toHaveBeenCalled()
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

  it('stores info as the level when the caller does not set one', async () => {
    const { service, create } = buildService()
    await service.notifyInApp(input)
    expect(create.mock.calls[0]![0].data.level).toBe('info')
  })

  it('carries the level through so the tray can paint the row red', async () => {
    const { service, create } = buildService()
    await service.notifyInApp({ ...input, level: 'critical' })
    expect(create.mock.calls[0]![0].data.level).toBe('critical')
  })

  it('dedupes over all time when no window is given', async () => {
    const { service, findFirst } = buildService()
    await service.notifyInApp(input)
    expect(findFirst.mock.calls[0]![0].where.createdAt).toBeUndefined()
  })

  it('limits dedupe to the given window so a recurring alert can nag again', async () => {
    const { service, findFirst } = buildService()
    await service.notifyInApp({ ...input, dedupeWindowMinutes: 60 })

    const gte = findFirst.mock.calls[0]![0].where.createdAt.gte as Date
    const minutesAgo = (Date.now() - gte.getTime()) / 60_000
    expect(minutesAgo).toBeGreaterThan(59)
    expect(minutesAgo).toBeLessThan(61)
  })

  it('lets a recycled invoice notify again after the window (deleted then re-placed SPL-####)', async () => {
    const { service, findFirst } = buildService({ id: 'old-spl-1001' })
    await service.notifyInApp({ ...input, subject: 'New order · SPL-1001', dedupeWindowMinutes: 30 })
    expect(findFirst.mock.calls[0]![0].where.createdAt).toBeDefined()
  })
})

describe('NotificationsService admin alerts', () => {
  function buildService(existing: { id: string } | null = null) {
    const findFirst = jest.fn().mockResolvedValue(existing)
    const create = jest.fn().mockResolvedValue({ id: 'notice-1' })
    const sendToStore = jest.fn().mockResolvedValue(undefined)
    const prisma = {
      notificationDeliveryLog: { findFirst, create },
      store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    } as unknown as PrismaService
    return {
      service: new NotificationsService(prisma, { sendToStore } as never),
      create,
      sendToStore,
    }
  }

  it('sends to Telegram and the tray when the alert is new', async () => {
    const { service, create, sendToStore } = buildService()
    await service.notifyLowStock('store-1', 'Kaftan', 'SPL-KFT-1', 2)

    expect(create).toHaveBeenCalled()
    expect(sendToStore).toHaveBeenCalledTimes(1)
  })

  it('stays silent on a repeat inside the dedupe window', async () => {
    // The four-hourly sweep re-raises the same SKU; without this the operator
    // would get a Telegram message about it six times a day.
    const { service, create, sendToStore } = buildService({ id: 'already-there' })
    await service.notifyLowStock('store-1', 'Kaftan', 'SPL-KFT-1', 2)

    expect(create).not.toHaveBeenCalled()
    expect(sendToStore).not.toHaveBeenCalled()
  })

  it('names the SKU in the subject so each variant nags on its own row', async () => {
    const { service, create } = buildService()
    await service.notifyLowStock('store-1', 'Kaftan', 'SPL-KFT-1', 2)
    expect(create.mock.calls[0]![0].data.subject).toBe('Low stock: SPL-KFT-1')
  })

  it('escalates a variant at zero from warn to critical', async () => {
    const { service, create } = buildService()
    await service.notifyLowStock('store-1', 'Kaftan', 'SPL-KFT-1', 0)

    expect(create.mock.calls[0]![0].data.subject).toBe('Out of stock: SPL-KFT-1')
    expect(create.mock.calls[0]![0].data.level).toBe('critical')
  })

  it('points a failed sheet sync at the sync screen', async () => {
    const { service, create } = buildService()
    await service.notifySyncFailed('store-1', 'order', 'insufficient scopes')

    const data = create.mock.calls[0]![0].data
    expect(data.recipient).toBe('/dashboard/automation/google-sheets-sync')
    expect(data.level).toBe('critical')
  })

  it('leaves alerts with no dashboard route out of the tray', async () => {
    const { service, create, sendToStore } = buildService()
    await service.notifyPaymentReceived('store-1', 'SPL-1007', 1200, 'bKash')

    expect(create).not.toHaveBeenCalled()
    expect(sendToStore).toHaveBeenCalledTimes(1)
  })
})
