import { apiFetch } from './client'

export type WholesaleStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST'

export const WHOLESALE_STATUSES: WholesaleStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'WON',
  'LOST',
]

export interface ApiWholesaleInquiry {
  id: string
  fullName: string
  companyName?: string | null
  industry: string
  country: string
  phone: string
  email?: string | null
  productInterest?: string | null
  monthlyQuantity?: string | null
  /** Volume as a number — what the pipeline totals and sorts on. */
  monthlyUnits?: number | null
  message?: string | null
  imageUrls?: string[]
  status: WholesaleStatus
  adminNotes?: string | null
  handledAt?: string | null
  sourcePath?: string | null
  /** Buyer-facing handle, e.g. WS-000041. */
  referenceCode?: string | null
  targetLaunch?: string | null
  nextFollowUpAt?: string | null
  tier?: { id: string; name: string; slug: string } | null
  createdAt: string
  updatedAt: string
}

export interface WholesaleFunnel {
  unitsByStatus: Record<WholesaleStatus, number>
  /** Units still winnable — excludes WON and LOST. */
  pipelineUnits: number
  wonUnits: number
  /** Share of *decided* leads won; null while nothing is decided. */
  winRate: number | null
  overdueFollowUps: number
}

export interface WholesaleListResponse {
  inquiries: ApiWholesaleInquiry[]
  total: number
  page: number
  limit: number
  pages: number
  counts: Record<WholesaleStatus, number>
  funnel: WholesaleFunnel
}

export function fetchWholesaleInquiries(params?: {
  status?: WholesaleStatus
  search?: string
  page?: number
  limit?: number
  sort?: 'recent' | 'volume' | 'followup'
}) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.sort && params.sort !== 'recent') qs.set('sort', params.sort)
  const query = qs.toString()
  return apiFetch<WholesaleListResponse>(
    `/admin/wholesale-inquiries${query ? `?${query}` : ''}`,
  )
}

export function updateWholesaleInquiry(
  id: string,
  input: {
    status?: WholesaleStatus
    adminNotes?: string
    /** ISO date, or null to clear the reminder. */
    nextFollowUpAt?: string | null
    monthlyUnits?: number | null
  },
) {
  return apiFetch<ApiWholesaleInquiry>(`/admin/wholesale-inquiries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteWholesaleInquiry(id: string) {
  return apiFetch<{ ok: true }>(`/admin/wholesale-inquiries/${id}`, { method: 'DELETE' })
}

export interface ApiWholesaleStockImage {
  id: string
  url: string
  title?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function fetchWholesaleStock() {
  return apiFetch<{ images: ApiWholesaleStockImage[] }>('/admin/wholesale-stock')
}

export function createWholesaleStockImage(input: { url: string; title?: string }) {
  return apiFetch<ApiWholesaleStockImage>('/admin/wholesale-stock', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateWholesaleStockImage(
  id: string,
  input: { title?: string | null; sortOrder?: number; isActive?: boolean },
) {
  return apiFetch<ApiWholesaleStockImage>(`/admin/wholesale-stock/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteWholesaleStockImage(id: string) {
  return apiFetch<{ ok: true }>(`/admin/wholesale-stock/${id}`, { method: 'DELETE' })
}

// ── Programme tiers ────────────────────────────────────────────────

export interface ApiWholesaleTier {
  id: string
  name: string
  slug: string
  minUnits: number
  leadTimeDays?: number | null
  summary?: string | null
  perks: string[]
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { inquiries: number }
}

export interface WholesaleTierInput {
  name?: string
  minUnits?: number
  leadTimeDays?: number | null
  summary?: string
  perks?: string[]
  sortOrder?: number
  isActive?: boolean
}

export function fetchWholesaleTiers() {
  return apiFetch<{ tiers: ApiWholesaleTier[] }>('/admin/wholesale-tiers')
}

export function createWholesaleTier(input: WholesaleTierInput & { name: string }) {
  return apiFetch<ApiWholesaleTier>('/admin/wholesale-tiers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateWholesaleTier(id: string, input: WholesaleTierInput) {
  return apiFetch<ApiWholesaleTier>(`/admin/wholesale-tiers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteWholesaleTier(id: string) {
  return apiFetch<{ ok: true; detachedInquiries: number }>(`/admin/wholesale-tiers/${id}`, {
    method: 'DELETE',
  })
}
