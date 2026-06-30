import { Injectable } from '@nestjs/common'
import { GoogleSheetsFinanceService } from '../finance/finance-support.service'
import type { GoogleSheetType } from '@prisma/client'

@Injectable()
export class GoogleSheetsService {
  constructor(private readonly sheets: GoogleSheetsFinanceService) {}

  dashboard(storeId: string) {
    return this.sheets.getDashboard(storeId)
  }

  logs(storeId: string, page = 1, limit = 30) {
    return this.sheets.getLogs(storeId, page, limit)
  }

  sync(
    storeId: string,
    sheetType: GoogleSheetType,
    resourceId?: string,
    resourceType?: string,
    triggeredBy?: string,
  ) {
    return this.sheets.queueSync(storeId, sheetType, resourceId, resourceType, undefined, triggeredBy)
  }

  syncAll(storeId: string, triggeredBy?: string) {
    return this.sheets.syncAll(storeId, triggeredBy)
  }

  retryFailed(storeId: string) {
    return this.sheets.retryFailed(storeId)
  }
}
