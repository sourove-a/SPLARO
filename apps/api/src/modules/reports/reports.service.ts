import { Injectable } from '@nestjs/common'
import { FinanceReportsService } from '../finance/finance-support.service'

@Injectable()
export class ReportsService {
  constructor(private readonly reports: FinanceReportsService) {}

  dashboard(storeId: string) {
    return this.reports.dashboard(storeId)
  }

  partnerHub(storeId: string) {
    return this.reports.partnerHub(storeId)
  }

  exportPartner(storeId: string, partnerId: string) {
    return this.reports.exportPartnerReport(storeId, partnerId)
  }

  auditLogs(storeId: string, page = 1, limit = 30) {
    return this.reports.auditLogs(storeId, page, limit)
  }
}
