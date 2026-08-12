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
  message?: string | null
  status: WholesaleStatus
  adminNotes?: string | null
  handledAt?: string | null
  sourcePath?: string | null
  createdAt: string
  updatedAt: string
}

export interface WholesaleListResponse {
  inquiries: ApiWholesaleInquiry[]
  total: number
  page: number
  limit: number
  pages: number
  counts: Record<WholesaleStatus, number>
}

export function fetchWholesaleInquiries(params?: {
  status?: WholesaleStatus
  search?: string
  page?: number
  limit?: number
}) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<WholesaleListResponse>(
    `/admin/wholesale-inquiries${query ? `?${query}` : ''}`,
  )
}

export function updateWholesaleInquiry(
  id: string,
  input: { status?: WholesaleStatus; adminNotes?: string },
) {
  return apiFetch<ApiWholesaleInquiry>(`/admin/wholesale-inquiries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteWholesaleInquiry(id: string) {
  return apiFetch<{ ok: true }>(`/admin/wholesale-inquiries/${id}`, { method: 'DELETE' })
}
