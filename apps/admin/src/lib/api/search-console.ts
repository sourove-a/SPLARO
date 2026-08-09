import { apiFetch } from '@/lib/api/client'

export type GscRange = '7d' | '28d' | '90d'
export type GscSort = 'clicks' | 'impressions' | 'ctr' | 'position'
export type GscStatusCode =
  | 'connected'
  | 'not_connected'
  | 'needs_reconnect'
  | 'missing_property'
  | 'quota'
  | 'error'

export type GscStatus = {
  connected: boolean
  status: GscStatusCode
  message: string
  property: string | null
  permission: string | null
  googleEmail: string | null
  lastSuccessAt: string | null
  lastError: string | null
  errorCategory: string | null
  needsReconnect: boolean
}

export type GscTotals = {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscPerformance = {
  range: GscRange
  startDate: string
  endDate: string
  previousStart: string
  previousEnd: string
  days: number
  currencyNote: string
  totals: GscTotals
  previous: GscTotals
  delta: GscTotals
  trend: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>
  property: string
  lastSuccessAt: string
}

export type GscQueryRow = {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscPageRow = GscQueryRow & {
  page: string
  slug: string | null
  name: string | null
}

export type GscDimensionPayload<T> = {
  range: GscRange
  startDate: string
  endDate: string
  sort: GscSort
  property: string
  rows: T[]
}

export type GscInsight = {
  kind: 'high_impressions_low_ctr' | 'position_8_15' | 'clicks_down'
  label: string
  detail: string
  page?: string
  query?: string
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
  previousClicks?: number
}

export type GscInsights = {
  range: GscRange
  property: string
  insights: GscInsight[]
}

export type GscSitemaps = {
  property: string
  known: string[]
  submitSupported: boolean
  submitMessage: string
  google: Array<{
    path: string | null
    lastSubmitted: string | null
    lastDownloaded: string | null
    isPending: boolean
    isSitemapsIndex: boolean
    warnings: number
    errors: number
  }>
  lastSuccessAt: string
}

export type GscInspectResult = {
  url: string
  property: string
  coverageState: string | null
  indexingState: string | null
  lastCrawlTime: string | null
  crawledAs: string | null
  googleCanonical: string | null
  userCanonical: string | null
  robotsTxtState: string | null
  pageFetchState: string | null
  verdict: string | null
  inspectionResultLink: string | null
}

export function fetchGscStatus() {
  return apiFetch<GscStatus>('/admin/google/search-console/status')
}

export function fetchGscPerformance(range: GscRange = '28d') {
  return apiFetch<GscPerformance>(`/admin/google/search-console/performance?range=${range}`)
}

export function fetchGscQueries(range: GscRange = '28d', limit = 25, sort: GscSort = 'clicks') {
  return apiFetch<GscDimensionPayload<GscQueryRow>>(
    `/admin/google/search-console/queries?range=${range}&limit=${limit}&sort=${sort}`,
  )
}

export function fetchGscPages(range: GscRange = '28d', limit = 25, sort: GscSort = 'clicks') {
  return apiFetch<GscDimensionPayload<GscPageRow>>(
    `/admin/google/search-console/pages?range=${range}&limit=${limit}&sort=${sort}`,
  )
}

export function fetchGscSitemaps() {
  return apiFetch<GscSitemaps>('/admin/google/search-console/sitemaps')
}

export function fetchGscInsights(range: GscRange = '28d') {
  return apiFetch<GscInsights>(`/admin/google/search-console/insights?range=${range}`)
}

export function inspectGscUrl(url: string) {
  return apiFetch<GscInspectResult>('/admin/google/search-console/inspect', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export function refreshGscCache() {
  return apiFetch<GscStatus>('/admin/google/search-console/refresh', { method: 'POST' })
}
