import { apiFetch } from './client'

export interface ApiCoupon {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y'
  value: string | number
  minOrderAmount: string | number | null
  maxDiscountAmount: string | number | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  startsAt: string | null
  expiresAt: string | null
}

export function fetchCoupons() {
  return apiFetch<{ coupons: ApiCoupon[]; total: number }>('/admin/coupons')
}

export function createCoupon(data: {
  code: string
  type: ApiCoupon['type']
  value: number
  minOrderAmount?: number
  maxDiscountAmount?: number
  usageLimit?: number
  isActive?: boolean
  expiresAt?: string
}) {
  return apiFetch<{ coupon: ApiCoupon }>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteCoupon(id: string) {
  return apiFetch<{ success: boolean }>(`/admin/coupons/${id}`, { method: 'DELETE' })
}

export function toggleCoupon(id: string, isActive: boolean) {
  return apiFetch<{ coupon: ApiCoupon }>(`/admin/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}
