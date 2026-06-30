import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { GoogleSheetsFinanceService } from '../finance/finance-support.service'
import { GOOGLE_SYNC_JOB_TYPES } from '../google-workspace/google.constants'
import { GoogleSyncQueueService } from '../google-workspace/google-sync-queue.service'
import type { GoogleSheetType } from '@prisma/client'

const SHEET_TYPE_TO_JOB: Partial<Record<GoogleSheetType, string>> = {
  ORDERS: GOOGLE_SYNC_JOB_TYPES.ORDER,
  CUSTOMERS: GOOGLE_SYNC_JOB_TYPES.CUSTOMER,
  PRODUCTS: GOOGLE_SYNC_JOB_TYPES.PRODUCT,
  INVENTORY: GOOGLE_SYNC_JOB_TYPES.INVENTORY,
  DAILY_SUMMARY: GOOGLE_SYNC_JOB_TYPES.DAILY_SUMMARY,
  PARTNER_ACCOUNTS: GOOGLE_SYNC_JOB_TYPES.FINANCE,
  EXPENSES: GOOGLE_SYNC_JOB_TYPES.FINANCE,
  PROFIT_LOSS: GOOGLE_SYNC_JOB_TYPES.FINANCE,
  PAYMENT: GOOGLE_SYNC_JOB_TYPES.FINANCE,
}

@Injectable()
export class GoogleSheetsService {
  constructor(
    private readonly sheets: GoogleSheetsFinanceService,
    private readonly prisma: PrismaService,
    private readonly syncQueue: GoogleSyncQueueService,
  ) {}

  dashboard(storeId: string) {
    return this.sheets.getDashboard(storeId)
  }

  logs(storeId: string, page = 1, limit = 30) {
    return this.sheets.getLogs(storeId, page, limit)
  }

  private async canUseWorkspaceSync(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const workspace = await this.sheets.getWorkspaceContext(storeId)
    return Boolean(workspace.workspaceConnected && workspace.spreadsheetId)
  }

  async sync(
    storeId: string,
    sheetType: GoogleSheetType,
    resourceId?: string,
    resourceType?: string,
    triggeredBy?: string,
  ) {
    if (await this.canUseWorkspaceSync(storeId)) {
      const jobType = SHEET_TYPE_TO_JOB[sheetType] ?? GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP
      return this.syncQueue.enqueue({
        storeId,
        jobType,
        resourceId,
        triggeredBy: triggeredBy ?? 'manual',
      })
    }

    return this.sheets.queueSync(storeId, sheetType, resourceId, resourceType, undefined, triggeredBy)
  }

  async syncAll(storeId: string, triggeredBy?: string) {
    if (await this.canUseWorkspaceSync(storeId)) {
      return this.syncQueue.manualFullSync(storeId, triggeredBy ?? 'admin')
    }

    return this.sheets.syncAll(storeId, triggeredBy)
  }

  retryFailed(storeId: string) {
    return this.sheets.retryFailed(storeId)
  }
}
