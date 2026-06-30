/**
 * Format a number as Bangladesh Taka (BDT)
 */
/** @deprecated Use storefront settings `shipping.freeDeliveryThreshold` instead */
export const FREE_DELIVERY_THRESHOLD_BDT = 0
export const DELIVERY_FEE_BDT = 120
export const DIGITAL_PAYMENT_DISCOUNT_RATE = 0.05

export function formatBDT(amount: number | string | undefined | null): string {
  if (amount === null || amount === undefined) return 'BDT 0'
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.]/g, '')) : amount
  if (isNaN(num)) return 'BDT 0'

  return `BDT ${num.toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

/**
 * Format price range for products with variants
 */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatBDT(min)
  return `${formatBDT(min)} – ${formatBDT(max)}`
}

/**
 * Calculate discount percentage
 */
export function calcDiscountPercent(original: number, discounted: number): number {
  if (!original || original <= discounted) return 0
  return Math.round(((original - discounted) / original) * 100)
}

/**
 * Parse BDT string back to number
 */
export function parseBDT(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, '')) || 0
}
