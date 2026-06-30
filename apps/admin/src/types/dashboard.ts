export interface DashboardStats {
  revenue: { value: number; change: number }
  orders: { value: number; change: number }
  customers: { value: number; change: number }
  avgOrderValue: { value: number; change: number }
  alerts: { codRiskOrders: number; failedPayments: number }
}

export interface DashboardInsights {
  topCategories: Array<{
    id: string
    name: string
    image: string | null
    revenue: number
    orders: number
    share: number
  }>
  topProducts: Array<{
    rank: number
    id: string
    name: string
    sku: string
    sold: number
    revenue: number
    trend: number
  }>
  paymentMix: Array<{ name: string; value: number; revenue: number; count: number }>
  paymentMixTotal: number
  recentActivities: Array<{
    id: string
    type: 'order' | 'customer' | 'payment' | 'shipping'
    message: string
    at: string
  }>
}

export type DashboardPeriod = '1d' | '7d' | '30d' | '90d'
