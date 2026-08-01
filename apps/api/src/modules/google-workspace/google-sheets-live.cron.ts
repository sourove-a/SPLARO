import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { isFeatureEnabled } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { GoogleSheetsSyncService } from './google-sheets-sync.service'

@Injectable()
export class GoogleSheetsLiveCron {
  private readonly logger = new Logger(GoogleSheetsLiveCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheets: GoogleSheetsSyncService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Live refresh every 3 minutes — keeps dashboard + orders in sync with SPLARO */
  @Cron('*/3 * * * *')
  async liveRefresh() {
    if (!isFeatureEnabled('googleSheets')) return
    if (this.running) return
    this.running = true
    try {
      const connections = await this.prisma.googleWorkspaceConnection.findMany({
        where: {
          isConnected: true,
          autoSyncEnabled: true,
          spreadsheetId: { not: null },
        },
        select: { storeId: true },
      })

      for (const conn of connections) {
        const hasHub = await this.prisma.googleSheetConfig.findFirst({
          where: { storeId: conn.storeId, sheetTab: 'Products & Stock' },
        })
        if (!hasHub) continue

        await this.sheets.refreshBusinessSpreadsheet(conn.storeId, 'live_cron').catch(async (e) => {
          const msg = e instanceof Error ? e.message : String(e)
          this.logger.warn(`Live sheet refresh failed for ${conn.storeId}: ${msg}`)
          // Tray only — this runs every 3 minutes, so Telegram would spam.
          await this.notifications
            .notifyInApp({
              storeId: conn.storeId,
              subject: 'Google Sheets live refresh failed',
              body: msg,
              href: '/dashboard/automation/google-sheets-sync',
              level: 'critical',
              dedupeWindowMinutes: 60,
            })
            .catch(() => undefined)
        })
      }
    } finally {
      this.running = false
    }
  }
}
