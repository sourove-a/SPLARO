/** Zero delivered orders and zero revenue — not a 0% margin period. */
export function isProfitLossEmpty(orderCount: number, grossRevenue: number) {
  return orderCount <= 0 && (!Number.isFinite(grossRevenue) || grossRevenue <= 0)
}
