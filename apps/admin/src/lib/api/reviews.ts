import { apiFetch } from './client'

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'

export interface ApiReview {
  id: string
  productId: string
  customerId?: string | null
  status: ReviewStatus
  rating: number
  title?: string | null
  body?: string | null
  verifiedPurchase: boolean
  helpfulCount: number
  adminReply?: string | null
  adminReplyAt?: string | null
  createdAt: string
  product?: { id: string; name: string; slug: string }
  customer?: { firstName: string; lastName: string; phone?: string | null } | null
}

export interface ReviewsListResponse {
  reviews: ApiReview[]
  total: number
  page: number
  totalPages: number
}

export function fetchReviews(params?: { status?: ReviewStatus; page?: number; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<ReviewsListResponse>(`/admin/products/reviews${query ? `?${query}` : ''}`)
}

export function updateReviewStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
  return apiFetch<ApiReview>(`/admin/products/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function updateReviewReply(id: string, adminReply: string | null) {
  return apiFetch<ApiReview>(`/admin/products/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ adminReply }),
  })
}

export function deleteReview(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/products/reviews/${id}`, {
    method: 'DELETE',
  })
}
