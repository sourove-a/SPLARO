import { GoogleSheetsFinanceService } from './finance-support.service'

function buildService(opts: { log?: Record<string, unknown> | null; spreadsheetId?: string | null }) {
  const prisma = {
    googleSheetSyncLog: {
      findUnique: jest.fn().mockResolvedValue(opts.log ?? null),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: unknown }) => ({
        id: where.id,
        ...(data as Record<string, unknown>),
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      create: jest.fn().mockResolvedValue({ id: 'log-new' }),
    },
    googleWorkspaceConnection: {
      findUnique: jest.fn().mockResolvedValue(
        opts.spreadsheetId === undefined
          ? null
          : { spreadsheetId: opts.spreadsheetId, isConnected: true, autoSyncEnabled: true },
      ),
    },
    googleSheetConfig: { findMany: jest.fn().mockResolvedValue([]) },
  }
  const audit = { log: jest.fn().mockResolvedValue(undefined) }

  return {
    service: new GoogleSheetsFinanceService(prisma as never, audit as never),
    prisma,
    audit,
  }
}

describe('GoogleSheetsFinanceService.processSync', () => {
  it('never reports a sync it did not perform', async () => {
    const { service, prisma, audit } = buildService({
      log: { id: 'log-1', storeId: 'store-1', sheetType: 'EXPENSES', status: 'PENDING' },
    })

    const result = (await service.processSync('log-1')) as { status?: string; errorMsg?: string }

    expect(result.status).toBe('PENDING')
    expect(result.errorMsg).toMatch(/Google Workspace/i)
    expect(prisma.googleSheetSyncLog.update).toHaveBeenCalledTimes(1)
    // No audit entry claiming the sheet was synced.
    expect(audit.log).not.toHaveBeenCalled()
  })

  it('leaves an already completed row alone', async () => {
    const { service, prisma } = buildService({
      log: { id: 'log-1', storeId: 'store-1', sheetType: 'EXPENSES', status: 'COMPLETED' },
    })

    await service.processSync('log-1')

    expect(prisma.googleSheetSyncLog.update).not.toHaveBeenCalled()
  })

  it('returns null for a missing row', async () => {
    const { service } = buildService({ log: null })
    await expect(service.processSync('missing')).resolves.toBeNull()
  })
})

describe('GoogleSheetsFinanceService.markWorkspaceSyncComplete', () => {
  it('settles waiting rows once a real hub push has written every tab', async () => {
    const { service, prisma } = buildService({ spreadsheetId: 'sheet-123' })

    await service.markWorkspaceSyncComplete('store-1', 'live_cron')

    expect(prisma.googleSheetSyncLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 'store-1', status: { in: ['PENDING', 'SYNCING'] } },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    )
  })

  it('settles nothing when no spreadsheet is connected', async () => {
    const { service, prisma } = buildService({ spreadsheetId: null })

    const result = await service.markWorkspaceSyncComplete('store-1')

    expect(result).toEqual([])
    expect(prisma.googleSheetSyncLog.updateMany).not.toHaveBeenCalled()
  })
})
