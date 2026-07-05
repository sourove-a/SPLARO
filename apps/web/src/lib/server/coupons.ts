import { getServerApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export interface CouponResult {
  valid: boolean
  code?: string
  type?: 'percent' | 'fixed' | 'free_shipping'
  discount: number
  freeShipping: boolean
  message: string
}

/**
 * Validate a coupon against the live NestJS API (same endpoint the checkout
 * "Apply" button uses). Never fabricates a discount: on any failure it returns
 * valid=false with an honest message so the order is rejected, not silently
 * charged full price.
 */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  try {
    const base = getServerApiBaseUrl()
    const res = await fetch(
      `${base}/storefront/coupons/validate?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      return {
        valid: false,
        discount: 0,
        freeShipping: false,
        message: `Coupon validation failed (${res.status}). Try again.`,
      }
    }
    const data = (await res.json()) as Partial<CouponResult>
    return {
      valid: Boolean(data.valid),
      ...(data.code ? { code: data.code } : {}),
      ...(data.type ? { type: data.type } : {}),
      discount: Number(data.discount ?? 0),
      freeShipping: Boolean(data.freeShipping),
      message: String(data.message ?? (data.valid ? 'Coupon applied' : 'Invalid coupon code')),
    }
  } catch {
    return {
      valid: false,
      discount: 0,
      freeShipping: false,
      message: 'Coupon service offline — try again later or remove the coupon.',
    }
  }
}
