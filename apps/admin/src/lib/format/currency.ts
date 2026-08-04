import { formatTaka } from '@/components/dc/tokens'

/**
 * Taka with the South Asian lakh/crore grouping the design calls for —
 * `৳48,60,000`, not `BDT 4,860,000`. Kept as a wrapper so the existing
 * `formatBDT` call sites can't drift back to en-BD thousands grouping.
 */
export function formatBDT(amount: number): string {
  return formatTaka(amount)
}
