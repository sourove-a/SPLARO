export type OrderProfitLine = {
  unitPrice: number
  quantity: number
  productCostPrice: number | null
}

export type OrderProfitInputs = {
  grossRevenue: number
  discount: number
  courierCost: number
  packagingCostPerOrder: number
  paymentFeePercent: number
  isCod: boolean
  returnLoss: number
  allocatedAdCost: number
  lines: OrderProfitLine[]
}

export type OrderProfitResult = {
  grossRevenue: number
  productCost: number
  courierCost: number
  packagingCost: number
  paymentGatewayFee: number
  discount: number
  returnLoss: number
  allocatedAdCost: number
  netProfit: number
  incompleteReasons: string[]
}

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Honest COGS: missing costPrice is 0 + incomplete, never selling price. */
export function computeOrderProfit(input: OrderProfitInputs): OrderProfitResult {
  const incompleteReasons: string[] = []
  let productCost = 0

  for (const line of input.lines) {
    const qty = Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0
    if (line.productCostPrice == null || !Number.isFinite(line.productCostPrice)) {
      incompleteReasons.push('missing_cost')
      continue
    }
    productCost += money(line.productCostPrice) * qty
  }

  const packagingCost = money(input.packagingCostPerOrder)
  if (packagingCost === 0) incompleteReasons.push('packaging_unset')

  const paymentGatewayFee = input.isCod
    ? 0
    : money((money(input.grossRevenue) * money(input.paymentFeePercent)) / 100)

  const grossRevenue = money(input.grossRevenue)
  const discount = money(input.discount)
  const courierCost = money(input.courierCost)
  const returnLoss = money(input.returnLoss)
  const allocatedAdCost = money(input.allocatedAdCost)

  const netProfit = money(
    grossRevenue -
      productCost -
      packagingCost -
      courierCost -
      paymentGatewayFee -
      discount -
      allocatedAdCost -
      returnLoss,
  )

  return {
    grossRevenue,
    productCost: money(productCost),
    courierCost,
    packagingCost,
    paymentGatewayFee,
    discount,
    returnLoss,
    allocatedAdCost,
    netProfit,
    incompleteReasons: [...new Set(incompleteReasons)],
  }
}

export function allocateAdsRevenueWeighted(
  adSpend: number,
  revenues: number[],
): number[] {
  const spend = money(adSpend)
  const weights = revenues.map((r) => Math.max(0, r))
  const total = weights.reduce((s, n) => s + n, 0)
  if (spend === 0 || total === 0) return revenues.map(() => 0)
  const raw = weights.map((w) => (spend * w) / total)
  const rounded = raw.map((n) => money(n))
  const drift = money(spend - rounded.reduce((s, n) => s + n, 0))
  if (rounded.length && drift !== 0) {
    rounded[rounded.length - 1] = money(rounded[rounded.length - 1] + drift)
  }
  return rounded
}

export function profitMarginPercent(netProfit: number, grossRevenue: number): number | null {
  if (!grossRevenue) return null
  return Math.round((netProfit / grossRevenue) * 1000) / 10
}
