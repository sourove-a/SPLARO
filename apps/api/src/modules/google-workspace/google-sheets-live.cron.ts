import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { isFeatureEnabled } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { NotificationsService } from '../notifications/notifications.service'
import { GoogleClientService } from './google-client.service'
import { isSheetsAuthFailure } from './google-sheets-auth.util'
import { GoogleSheetsSyncService } from './google-sheets-sync.service'

@Injectable()
export class GoogleSheetsLiveCron {
  private readonly logger = new Logger(GoogleSheetsLiveCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheets: GoogleSheetsSyncService,
    private readonly client: GoogleClientService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Live refresh — keeps the business hub spreadsheet in sync with SPLARO.
   *
   * Every 3 minutes rebuilt all 13 tabs, which pushed the API process past its
   * 768M PM2 limit and restarted it on that same cadence, dropping in-flight
   * requests. A spreadsheet mirror does not need sub-15-minute freshness.
   */
  @Cron('*/15 * * * *')
  async liveRefresh() {
    if (!isSchedulerInstance()) return
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

        const ready = await this.client.canUseSheets(conn.storeId)
        if (!ready.ok) {
          await this.pauseAndNotifyOnce(conn.storeId, ready.reason)
          continue
        }

        await this.sheets.refreshBusinessSpreadsheet(conn.storeId, 'live_cron').catch(async (e) => {
          const msg = e instanceof Error ? e.message : String(e)
          this.logger.warn(`Live sheet refresh failed for ${conn.storeId}: ${msg}`)
          if (isSheetsAuthFailure(msg)) {
            await this.pauseAndNotifyOnce(conn.storeId, msg)
            return
          }
          // Transient API errors only — tray, not Telegram. 12h dedupe.
          await this.notifications
            .notifyInApp({
              storeId: conn.storeId,
              subject: 'Google Sheets live refresh failed',
              body: msg,
              href: '/dashboard/automation/google-sheets-sync',
              level: 'warn',
              dedupeWindowMinutes: 720,
            })
            .catch(() => undefined)
        })
      }
    } finally {
      this.running = false
    }
  }

  private async pauseAndNotifyOnce(storeId: string, reason: string) {
    const paused = await this.client.pauseLiveSync(storeId, reason)
    if (!paused) return
    await this.notifications
      .notifyInApp({
        storeId,
        subject: 'Google Sheets auto-sync paused',
        body: `${reason} Auto-sync is off until you reconnect Google (or restore the service-account key).`,
        href: '/dashboard/google-workspace/connect',
        level: 'warn',
      })
      .catch(() => undefined)
  }
}
