import { formatTaka } from '@/components/dc/tokens'

/** Lakh/crore grouping — `৳48,60,000`. See `@/lib/format/currency`. */
export function formatBDT(amount: number): string {
  return formatTaka(amount)
}

export function calcDiscountPercent(original: number, sale: number): number {
  // A zero/absent compare-at price would divide to Infinity and render as
  // "Infinity%", so anything that is not a real markdown reports 0.
  if (!original || original <= sale) return 0
  return Math.round(((original - sale) / original) * 100)
}
