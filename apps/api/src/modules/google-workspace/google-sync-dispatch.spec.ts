import { GOOGLE_SYNC_JOB_TYPES } from './google.constants'
import { GoogleSyncProcessor } from './google-sync.processor'
import type { PrismaService } from '../../common/prisma.service'

/**
 * "Push this tab now" sends a job type but no record id. Every branch used to
 * demand one, and the finance / daily-summary types had no branch at all, so
 * the button failed on every tab it was offered on. These pin the dispatch.
 */
function buildProcessor() {
  const sheets = {
    fullBackup: jest.fn().mockResolvedValue({ ok: 'full' }),
    syncOrder: jest.fn().mockResolvedValue({ ok: 'order' }),
    syncCustomer: jest.fn().mockResolvedValue({ ok: 'customer' }),
    syncProduct: jest.fn().mockResolvedValue({ ok: 'product' }),
    syncSubscriber: jest.fn().mockResolvedValue({ ok: 'subscriber' }),
  }
  const prisma = {
    googleSyncJob: { update: jest.fn().mockResolvedValue({}) },
    googleSyncLog: { create: jest.fn().mockResolvedValue({}) },
    googleWorkspaceConnection: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService
  const telegram = { test: jest.fn().mockResolvedValue(undefined) }
  const notifications = {
    notifySyncFailed: jest.fn().mockResolvedValue(undefined),
    notifyInApp: jest.fn().mockResolvedValue(true),
  }
  const financeSheets = {
    markWorkspaceSyncComplete: jest.fn().mockResolvedValue([]),
  }

  const processor = new GoogleSyncProcessor(
    prisma,
    sheets as never,
    telegram as never,
    notifications as never,
    financeSheets as never,
  )
  return { processor, sheets, prisma, financeSheets }
}

const job = (jobType: string, resourceId?: string) =>
  ({
    data: { storeId: 'store-1', jobType, resourceId, triggeredBy: 'admin' },
    attemptsMade: 0,
    opts: { attempts: 3 },
  }) as never

describe('GoogleSyncProcessor dispatch', () => {
  const WHOLE_TAB_TYPES = [
    ['orders', GOOGLE_SYNC_JOB_TYPES.ORDER],
    ['customers', GOOGLE_SYNC_JOB_TYPES.CUSTOMER],
    ['products', GOOGLE_SYNC_JOB_TYPES.PRODUCT],
    ['inventory', GOOGLE_SYNC_JOB_TYPES.INVENTORY],
    ['finance', GOOGLE_SYNC_JOB_TYPES.FINANCE],
    ['daily summary', GOOGLE_SYNC_JOB_TYPES.DAILY_SUMMARY],
    ['full backup', GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP],
  ] as const

  it.each(WHOLE_TAB_TYPES)(
    'rebuilds the sheet for a %s push that carries no record id',
    async (_label, jobType) => {
      const { processor, sheets } = buildProcessor()

      await expect(processor.process(job(jobType))).resolves.toEqual({ ok: 'full' })
      expect(sheets.fullBackup).toHaveBeenCalledWith('store-1', 'admin')
    },
  )

  it('still syncs a single record when an id is supplied', async () => {
    const { processor, sheets } = buildProcessor()

    await processor.process(job(GOOGLE_SYNC_JOB_TYPES.ORDER, 'order-9'))
    expect(sheets.syncOrder).toHaveBeenCalledWith('store-1', 'order-9', 'admin')
    expect(sheets.fullBackup).not.toHaveBeenCalled()
  })

  it.each([
    [GOOGLE_SYNC_JOB_TYPES.CUSTOMER, 'syncCustomer'],
    [GOOGLE_SYNC_JOB_TYPES.PRODUCT, 'syncProduct'],
    [GOOGLE_SYNC_JOB_TYPES.INVENTORY, 'syncProduct'],
    [GOOGLE_SYNC_JOB_TYPES.SUBSCRIBER, 'syncSubscriber'],
  ] as const)('routes %s with an id to %s', async (jobType, method) => {
    const { processor, sheets } = buildProcessor()

    await processor.process(job(jobType, 'rec-1'))
    expect(sheets[method as keyof typeof sheets]).toHaveBeenCalledWith(
      'store-1',
      'rec-1',
      'admin',
    )
  })

  it('still rejects a job type it does not know', async () => {
    const { processor } = buildProcessor()
    await expect(processor.process(job('google.sync.nonsense', 'rec-1'))).rejects.toThrow(
      /Unknown job type/,
    )
  })

  it('records the failure and alerts once retries are exhausted', async () => {
    const { processor, sheets, prisma } = buildProcessor()
    sheets.syncOrder.mockRejectedValueOnce(new Error('insufficient scopes'))

    const failing = {
      data: { storeId: 'store-1', jobType: GOOGLE_SYNC_JOB_TYPES.ORDER, resourceId: 'o1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as never

    await expect(processor.process(failing)).rejects.toThrow('insufficient scopes')
    expect(
      (prisma as unknown as { googleSyncLog: { create: jest.Mock } }).googleSyncLog.create,
    ).toHaveBeenCalled()
  })

  it('marks tokenHealth on auth failure even when auto-sync is already off', async () => {
    const { processor, sheets, prisma } = buildProcessor()
    sheets.syncOrder.mockRejectedValueOnce(
      new Error('Google refresh token missing. Reconnect your Google account.'),
    )

    const failing = {
      data: { storeId: 'store-1', jobType: GOOGLE_SYNC_JOB_TYPES.ORDER, resourceId: 'o1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as never

    await expect(processor.process(failing)).rejects.toThrow(/refresh token missing/)
    expect(
      (prisma as unknown as { googleWorkspaceConnection: { updateMany: jest.Mock } })
        .googleWorkspaceConnection.updateMany,
    ).toHaveBeenCalledWith({
      where: { storeId: 'store-1' },
      data: {
        autoSyncEnabled: false,
        tokenHealth: 'needs_reconnect',
        lastError: 'Google refresh token missing. Reconnect your Google account.',
      },
    })
  })
})
