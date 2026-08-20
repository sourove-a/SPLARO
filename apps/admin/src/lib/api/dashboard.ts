import { apiFetch } from './client'

export interface DashboardStatsResponse {
  revenue: { value: number; change: number }
  orders: { value: number; change: number }
  customers: { value: number; change: number }
  avgOrderValue: { value: number; change: number }
  alerts: { codRiskOrders: number; failedPayments: number }
}

export function fetchDashboardStats(period: '1d' | '7d' | '30d' | '90d' = '7d') {
  return apiFetch<DashboardStatsResponse>(`/admin/dashboard/stats?period=${period}`)
}

export function periodFromLabel(label: string): '1d' | '7d' | '30d' | '90d' {
  if (label === 'Today') return '1d'
  if (label === '7 Days') return '7d'
  if (label === '30 Days') return '30d'
  if (label === 'Quarter' || label === 'Year') return '90d'
  return '30d'
}

export interface DashboardInsightsResponse {
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

export function fetchDashboardInsights(period: '1d' | '7d' | '30d' | '90d' = '7d') {
  return apiFetch<DashboardInsightsResponse>(`/admin/dashboard/insights?period=${period}`)
}

export interface RevenueSeriesResponse {
  data: Array<{ date: string; revenue: number; orders: number }>
  period: string
  group: string
}

/**
 * Day-by-day revenue straight off the orders table, zero-filled by the API so
 * every day in the window has a bucket. Preferred over the profit-loss timeline
 * for anything chart-shaped: that one is built from ProfitCalculation rows,
 * which only exist once the costing job has run, so it is empty on most stores.
 */
export function fetchRevenueSeries(period: '7d' | '30d' | '90d' = '30d') {
  return apiFetch<RevenueSeriesResponse>(
    `/admin/analytics/revenue?period=${period}&group=day`,
  )
}

export interface ConversionFunnelResponse {
  period: string
  steps: Array<{ label: string; count: number }>
}

export function fetchConversionFunnel(period: '1d' | '7d' | '30d' | '90d' = '30d') {
  return apiFetch<ConversionFunnelResponse>(`/admin/analytics/funnel?period=${period}`)
}

export interface TrafficSourceRow {
  source: string
  orders: number
  revenue: number
}

/** Orders grouped by the attribution source recorded at checkout. */
export function fetchTrafficSources(period: '7d' | '30d' | '90d' = '30d') {
  return apiFetch<TrafficSourceRow[]>(`/admin/analytics/traffic?period=${period}`)
}

export interface InventoryAlertsResponse {
  outOfStock: number
  lowStock: number
}

export function fetchInventoryAlerts() {
  return apiFetch<InventoryAlertsResponse>('/admin/dashboard/inventory-alerts')
}

export interface DailyGoalResponse {
  /** null when nobody has set a target — prompt for one, do not assume. */
  goal: number | null
  achieved: number
  orders: number
  percent: number | null
  remaining: number | null
}

export function fetchDailyGoal() {
  return apiFetch<DailyGoalResponse>('/admin/dashboard/daily-goal')
}

export function saveDailyGoal(goal: number | null) {
  return apiFetch<{ goal: number | null }>('/admin/dashboard/daily-goal', {
    method: 'POST',
    body: JSON.stringify({ goal }),
  })
}

export interface ActionRequiredResponse {
  pendingOrders: number
  pendingRMAs: number
  pendingReviews: number
  failedShipments: number
  total: number
}

export function fetchActionRequired() {
  return apiFetch<ActionRequiredResponse>('/admin/dashboard/action-required')
}
