export interface CouponResult {
  valid: boolean
  code?: string
  type?: 'percent' | 'fixed' | 'free_shipping'
  discount: number
  freeShipping: boolean
  message: string
}

/** No hardcoded demo coupons — validation must come from the live API. */
export function validateCoupon(_code: string, _subtotal: number): CouponResult {
  return {
    valid: false,
    discount: 0,
    freeShipping: false,
    message: 'Coupon service unavailable. Start the API and create coupons in admin.',
  }
}
