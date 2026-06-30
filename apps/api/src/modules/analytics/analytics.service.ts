import { Injectable } from '@nestjs/common'
import { DashboardService } from '../dashboard/dashboard.service'
import type { DashboardInsightsResponse, DashboardStatsResponse } from '../dashboard/dashboard.types'

@Injectable()
export class AnalyticsService {
  constructor(private readonly dashboard: DashboardService) {}

  getStats(storeId?: string, period?: string): Promise<DashboardStatsResponse> {
    return this.dashboard.getStats(storeId, period)
  }

  getInsights(storeId?: string, period?: string): Promise<DashboardInsightsResponse> {
    return this.dashboard.getInsights(storeId, period)
  }
}
