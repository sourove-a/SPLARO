import { GoogleWorkspaceController } from './google-workspace.controller'
import { GoogleSheetsController } from '../google-sheets/google-sheets.controller'

const request = {
  adminUser: {
    userId: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    storeId: 'session-store',
    exp: Date.now() + 60_000,
  },
}

describe('Google workspace store scope', () => {
  it('uses the admin session store for workspace status and sync', async () => {
    const getStatus = jest.fn().mockResolvedValue({ connected: true })
    const manualFullSync = jest.fn().mockResolvedValue({ queued: true })
    const google = { getStatus }
    const controller = new GoogleWorkspaceController(google as never, { manualFullSync } as never)

    await controller.status('browser-store', request as never)
    await controller.syncNow('browser-store', {}, request as never)

    expect(getStatus).toHaveBeenCalledWith('session-store')
    expect(manualFullSync).toHaveBeenCalledWith('session-store', 'admin-1')
  })

  it('uses the admin session store for direct Sheets routes', async () => {
    const dashboard = jest.fn().mockResolvedValue({ connected: true })
    const sync = jest.fn().mockResolvedValue({ ok: true })
    const sheets = new GoogleSheetsController({ dashboard, sync } as never)

    await sheets.dashboard('browser-store', request as never)
    await sheets.sync(
      'browser-store',
      { sheetType: 'ORDERS', resourceId: 'order-1' },
      request as never,
    )

    expect(dashboard).toHaveBeenCalledWith('session-store')
    expect(sync).toHaveBeenCalledWith('session-store', 'ORDERS', 'order-1', undefined, undefined)
  })
})
