export function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
}

export function calcDiscountPercent(original: number, sale: number): number {
  return Math.round(((original - sale) / original) * 100)
}
