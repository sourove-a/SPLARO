import { apiFetch } from '@/lib/api/client'

export interface LoyaltySummary {
  totalCustomers: number
  totalPointsIssued: number
  tierBreakdown: { tier: string; count: number }[]
}

export interface ReferralStats {
  total: number
  converted: number
  conversionRate: number
  totalRewardPoints: number
}

export interface ReferralRow {
  id: string
  referredEmail?: string | null
  referredPhone?: string | null
  isConverted: boolean
  rewardPoints?: number | null
  createdAt: string
  referrer?: { firstName?: string | null; lastName?: string | null; phone?: string | null }
}

export function fetchLoyaltySummary() {
  return apiFetch<LoyaltySummary>('/admin/loyalty/summary')
}

export function fetchReferralStats() {
  return apiFetch<ReferralStats>('/admin/loyalty/referrals/stats')
}

export function fetchReferrals(params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  const qs = q.toString()
  return apiFetch<{ items: ReferralRow[]; total: number; page: number; limit: number }>(
    `/admin/loyalty/referrals${qs ? `?${qs}` : ''}`,
  )
}
