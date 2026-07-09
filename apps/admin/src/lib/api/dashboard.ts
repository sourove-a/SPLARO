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

export interface InventoryAlertsResponse {
  outOfStock: number
  lowStock: number
}

export function fetchInventoryAlerts() {
  return apiFetch<InventoryAlertsResponse>('/admin/dashboard/inventory-alerts')
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
