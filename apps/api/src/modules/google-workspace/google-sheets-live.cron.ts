import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { GoogleSheetsSyncService } from './google-sheets-sync.service'

@Injectable()
export class GoogleSheetsLiveCron {
  private readonly logger = new Logger(GoogleSheetsLiveCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheets: GoogleSheetsSyncService,
  ) {}

  /** Live refresh every 3 minutes — keeps dashboard + orders in sync with SPLARO */
  @Cron('*/3 * * * *')
  async liveRefresh() {
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

        await this.sheets.refreshBusinessSpreadsheet(conn.storeId, 'live_cron').catch((e) => {
          this.logger.warn(`Live sheet refresh failed for ${conn.storeId}: ${e}`)
        })
      }
    } finally {
      this.running = false
    }
  }
}
