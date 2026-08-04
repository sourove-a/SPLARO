import { formatTaka } from '@/components/dc/tokens'

/** Lakh/crore grouping — `৳48,60,000`. See `@/lib/format/currency`. */
export function formatBDT(amount: number): string {
  return formatTaka(amount)
}

export function calcDiscountPercent(original: number, sale: number): number {
  return Math.round(((original - sale) / original) * 100)
}
