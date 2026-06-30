export type DashboardPeriod = '1d' | '7d' | '30d' | '90d'

export type ActivityType = 'order' | 'customer' | 'payment' | 'shipping'

export interface PeriodWindow {
  period: DashboardPeriod
  days: number
  since: Date
  previousSince: Date
}

export interface MetricWithChange {
  value: number
  change: number
}

export interface DashboardStatsResponse {
  revenue: MetricWithChange
  orders: MetricWithChange
  customers: MetricWithChange
  avgOrderValue: MetricWithChange
  alerts: {
    codRiskOrders: number
    failedPayments: number
  }
}

export interface TopCategoryRow {
  id: string
  name: string
  image: string | null
  revenue: number
  orders: number
  share: number
}

export interface TopProductRow {
  rank: number
  id: string
  name: string
  sku: string
  sold: number
  revenue: number
  trend: number
}

export interface PaymentMixRow {
  name: string
  value: number
  revenue: number
  count: number
}

export interface ActivityRow {
  id: string
  type: ActivityType
  message: string
  at: string
}

export interface DashboardInsightsResponse {
  topCategories: TopCategoryRow[]
  topProducts: TopProductRow[]
  paymentMix: PaymentMixRow[]
  paymentMixTotal: number
  recentActivities: ActivityRow[]
}
