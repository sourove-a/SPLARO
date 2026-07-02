import { apiFetch, buildAdminApiUrl, getStoreId } from './client'
import { getAdminApiToken } from '@/lib/auth/api-token'

export interface FinanceDashboardData {
  totals: {
    revenue: number
    expense: number
    netProfit: number
    dailyNetProfit: number
  }
  partners: {
    id: string
    name: string
    slug: string
    currentBalance: number
    sharePercent: number
  }[]
  pendingApprovals: number
  recentActivity: unknown[]
  expensesByCategory: { category: string; amount: number }[]
}

export interface PartnerAccount {
  id: string
  name: string
  slug: string
  email?: string | null
  phone?: string | null
  avatarUrl?: string | null
  sharePercent: number
  totalInvestment: number
  totalWithdrawal: number
  totalSalesContribution: number
  totalExpenseShare: number
  totalProfitShare: number
  currentBalance: number
  lastTransaction?: unknown
}

export interface ExpenseRow {
  id: string
  category: string
  amount: number | string
  expenseDate: string
  note?: string | null
  status: string
  partner?: { name: string; slug: string } | null
}

export interface PartnerTransactionRow {
  id: string
  type: string
  amount: number | string
  transactionDate: string
  note?: string | null
  status: string
  partner?: { name: string; slug: string }
}

export interface PartnerHubData {
  partners: PartnerAccount[]
  totals: {
    combinedBalance: number
    totalInvested: number
    totalWithdrawn: number
    totalProfitShare: number
    monthlyRevenue: number
    monthlyNetProfit: number
    weeklyNetProfit: number
    pendingApprovals: number
  }
  profitLoss: {
    monthly: ProfitLossSummary
    weekly: ProfitLossSummary
  }
  inventory: {
    totals: {
      totalUnits: number
      totalCostValue: number
      totalRetailValue: number
      productCount: number
      lowStockCount: number
      outOfStockCount: number
    }
    items: InventoryItem[]
  }
  topProducts: InventoryItem[]
  recentInvestments: {
    id: string
    amount: number
    note?: string | null
    date: string
    partner?: { id: string; name: string; slug: string } | null
  }[]
  recentExpenses: {
    id: string
    category: string
    amount: number
    note?: string | null
    status: string
    date: string
    partner?: { name: string; slug: string } | null
  }[]
  expensesByCategory: { category: string; amount: number }[]
}

export interface ProfitLossSummary {
  period: { from: string; to: string }
  totals: {
    grossRevenue: number
    productCost: number
    courierCost: number
    packagingCost: number
    paymentGatewayFee: number
    discount: number
    returnLoss: number
    netProfit: number
  }
  orderCount: number
}

export interface InventoryItem {
  id: string
  name: string
  stock: number
  soldCount: number
  viewCount: number
  retailUnit: number
  costUnit: number
  retailValue: number
  costValue: number
  imageUrl?: string | null
  demandScore: number
}

export function fetchPartnerHub() {
  return apiFetch<PartnerHubData>('/finance-reports/partner-hub')
}

export function fetchFinanceDashboard() {
  return apiFetch<FinanceDashboardData>('/finance-reports/dashboard')
}

export function fetchPartners() {
  return apiFetch<PartnerAccount[]>('/partners')
}

export function seedPartners(createdBy?: string) {
  return apiFetch<PartnerAccount[]>('/partners/seed', {
    method: 'POST',
    body: JSON.stringify({ createdBy }),
  })
}

export function fetchPartnerBySlug(slug: string) {
  return apiFetch<PartnerAccount & { transactions: unknown[] }>(`/partners/${slug}`)
}

export function fetchPartnerTransactions(params?: Record<string, string>) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  return apiFetch<{ items: PartnerTransactionRow[]; total: number }>(`/partner-transactions${qs}`)
}

export function fetchExpenses(page = 1, params?: Record<string, string>) {
  const qs = new URLSearchParams({ page: String(page), ...params })
  return apiFetch<{ items: ExpenseRow[]; total: number }>(`/expenses?${qs.toString()}`)
}

export function approveExpense(id: string, approvedBy?: string) {
  return apiFetch<ExpenseRow>(`/expenses/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approvedBy }),
  })
}

export function updatePartnerProfile(
  slug: string,
  body: { name?: string; email?: string; phone?: string; avatarUrl?: string; notes?: string },
) {
  return apiFetch<PartnerAccount>(`/partners/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function uploadAdminImage(file: File, folder = 'partners') {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  form.append('optimize', '1')
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data.url as string
}

export function fetchProfitLoss(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  return apiFetch<unknown>(`/profit-loss/${period}`)
}

export function fetchDailyClosings(page = 1, limit = 20) {
  return apiFetch<{ items: unknown[]; total: number }>(
    `/daily-closing?page=${page}&limit=${limit}`,
  )
}

export function runDailyClosing(closedBy?: string) {
  return apiFetch<unknown>('/daily-closing/run', {
    method: 'POST',
    body: JSON.stringify({ closedBy }),
  })
}

async function downloadAuthenticatedFile(path: string, filename: string, init?: RequestInit) {
  const url = buildAdminApiUrl(path)
  const token = getAdminApiToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export async function downloadFinanceCsv(type: 'orders', days = 30) {
  const date = new Date().toISOString().slice(0, 10)
  await downloadAuthenticatedFile(
    `/finance-reports/orders/export-csv?days=${days}`,
    `splaro-orders-${date}.csv`,
  )
}

export async function downloadPartnerExport(partnerId: string, partnerName: string) {
  const safeName = partnerName.toLowerCase().replace(/\s+/g, '-')
  const date = new Date().toISOString().slice(0, 10)
  await downloadAuthenticatedFile(
    `/finance-reports/partner/${partnerId}/export`,
    `splaro-partner-${safeName}-${date}.json`,
  )
}

export interface SheetsDashboardConnection {
  workspaceConnected: boolean
  spreadsheetLinked: boolean
  spreadsheetUrl: string | null
  googleEmail: string | null
  autoSyncEnabled: boolean
  tokenHealth: string | null
  setupHref: string
}

export interface SheetsDashboardSheet {
  sheetType: string
  configured: boolean
  configuredVia: 'env' | 'workspace' | null
  lastSync: string | null
  lastStatus: string | null
  lastError: string | null
}

export interface SheetsDashboardData {
  sheets: SheetsDashboardSheet[]
  stats: {
    total: number
    configured: number
    completed: number
    failed: number
    pending: number
  }
  connection?: SheetsDashboardConnection
}

export function fetchSheetsDashboard() {
  return apiFetch<SheetsDashboardData>('/google-sheets/dashboard')
}

export function syncSheet(sheetType: string, triggeredBy?: string) {
  return apiFetch<unknown>('/google-sheets/sync', {
    method: 'POST',
    body: JSON.stringify({ sheetType, triggeredBy }),
  })
}

export function syncAllSheets(triggeredBy?: string) {
  return apiFetch<unknown>('/google-sheets/sync-all', {
    method: 'POST',
    body: JSON.stringify({ triggeredBy }),
  })
}

export function retryFailedSheets() {
  return apiFetch<unknown>('/google-sheets/retry-failed', { method: 'POST' })
}

export function fetchFinanceAuditLogs(page = 1) {
  return apiFetch<{ items: unknown[]; total: number }>(`/finance-reports/audit-logs?page=${page}`)
}

export function generateAIProduct(input: Record<string, unknown>, createdBy?: string) {
  return apiFetch<unknown>('/ai-product-agent/generate', {
    method: 'POST',
    body: JSON.stringify({ input, createdBy }),
  })
}

export function fetchAIJobs(page = 1) {
  return apiFetch<{ items: unknown[]; total: number }>(`/ai-product-agent/jobs?page=${page}`)
}

export function approveTransaction(id: string, approvedBy?: string) {
  return apiFetch<unknown>(`/partner-transactions/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approvedBy }),
  })
}

export function createPartnerTransaction(body: Record<string, unknown>) {
  return apiFetch<unknown>('/partner-transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createExpense(body: Record<string, unknown>) {
  return apiFetch<unknown>('/expenses', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
