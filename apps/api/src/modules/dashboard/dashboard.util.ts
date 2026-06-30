import type {
  ActivityRow,
  ActivityType,
  DashboardPeriod,
  PaymentMixRow,
  PeriodWindow,
  TopCategoryRow,
  TopProductRow,
} from './dashboard.types'

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  SSLCOMMERZ: 'SSLCommerz',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
}

const SHIPPING_STATUSES = new Set(['DELIVERED', 'COURIER_BOOKED', 'IN_TRANSIT', 'PICKED_UP', 'OUT_FOR_DELIVERY'])

export function normalizePeriod(raw: string | undefined): DashboardPeriod {
  if (raw === '1d' || raw === '7d' || raw === '30d' || raw === '90d') return raw
  return '7d'
}

export function buildPeriodWindow(period: DashboardPeriod): PeriodWindow {
  const days = PERIOD_DAYS[period]
  const since = new Date()
  since.setDate(since.getDate() - days)

  const previousSince = new Date(since)
  previousSince.setDate(previousSince.getDate() - days)

  return { period, days, since, previousSince }
}

export function percentChange(current: number, previous: number): number {
  if (previous <= 0) return 0
  return Math.round(((current - previous) / previous) * 100)
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method.replace(/_/g, ' ')
}

export function formatBdt(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-BD')}`
}

interface OrderItemRow {
  orderId: string
  productId: string
  productName: string
  sku: string | null
  quantity: number
  subtotal: unknown
  product: {
    categoryId: string | null
    category: { id: string; name: string; image: string | null } | null
  }
}

export function aggregateTopCategories(items: OrderItemRow[], limit = 5): TopCategoryRow[] {
  const byCategory = new Map<
    string,
    { id: string; name: string; image: string | null; revenue: number; orders: Set<string> }
  >()

  for (const item of items) {
    const category = item.product.category
    const key = category?.id ?? 'uncategorized'
    const row =
      byCategory.get(key) ??
      ({
        id: key,
        name: category?.name ?? 'Uncategorized',
        image: category?.image ?? null,
        revenue: 0,
        orders: new Set<string>(),
      } as const)

    const next = {
      ...row,
      revenue: row.revenue + Number(item.subtotal),
      orders: new Set(row.orders).add(item.orderId),
    }
    byCategory.set(key, next)
  }

  const totalRevenue = [...byCategory.values()].reduce((sum, row) => sum + row.revenue, 0)

  return [...byCategory.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name,
      image: row.image,
      revenue: Math.round(row.revenue),
      orders: row.orders.size,
      share: totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 100) : 0,
    }))
}

export function aggregateTopProducts(
  items: OrderItemRow[],
  previousQtyByProduct: Map<string, number>,
  limit = 5,
): TopProductRow[] {
  const byProduct = new Map<
    string,
    { id: string; name: string; sku: string | null; sold: number; revenue: number }
  >()

  for (const item of items) {
    const row = byProduct.get(item.productId) ?? {
      id: item.productId,
      name: item.productName,
      sku: item.sku,
      sold: 0,
      revenue: 0,
    }
    row.sold += item.quantity
    row.revenue += Number(item.subtotal)
    byProduct.set(item.productId, row)
  }

  return [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((row, index) => {
      const prevSold = previousQtyByProduct.get(row.id) ?? 0
      const trend =
        prevSold > 0
          ? percentChange(row.sold, prevSold)
          : row.sold > 0
            ? 100
            : 0

      return {
        rank: index + 1,
        id: row.id,
        name: row.name,
        sku: row.sku ?? '—',
        sold: row.sold,
        revenue: Math.round(row.revenue),
        trend,
      }
    })
}

export function buildPaymentMix(
  groups: Array<{ paymentMethod: string; _count: number; _sum: { total: unknown } }>,
): { rows: PaymentMixRow[]; total: number } {
  const total = groups.reduce((sum, row) => sum + Number(row._sum.total ?? 0), 0)

  const rows = groups
    .map((row) => {
      const revenue = Math.round(Number(row._sum.total ?? 0))
      return {
        name: paymentMethodLabel(row.paymentMethod),
        value: total > 0 ? Math.round((revenue / total) * 100) : 0,
        revenue,
        count: row._count,
      }
    })
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  return { rows, total: Math.round(total) }
}

interface RecentOrderRow {
  id: string
  invoiceNumber: string
  shippingName: string
  total: unknown
  paymentMethod: string
  paymentStatus: string
  createdAt: Date
  deliveredAt: Date | null
}

interface RecentCustomerRow {
  id: string
  firstName: string
  lastName: string
  createdAt: Date
}

interface StatusHistoryRow {
  id: string
  status: string
  createdAt: Date
  order: { invoiceNumber: string }
}

export function buildRecentActivities(
  orders: RecentOrderRow[],
  customers: RecentCustomerRow[],
  statusHistory: StatusHistoryRow[],
  limit = 10,
): ActivityRow[] {
  const activities = new Map<string, ActivityRow>()

  const push = (row: ActivityRow) => {
    if (!activities.has(row.id)) activities.set(row.id, row)
  }

  for (const order of orders) {
    push({
      id: `order-${order.id}`,
      type: 'order',
      message: `New order ${order.invoiceNumber} from ${order.shippingName}`,
      at: order.createdAt.toISOString(),
    })

    if (order.paymentStatus === 'PAID') {
      push({
        id: `payment-${order.id}`,
        type: 'payment',
        message: `${paymentMethodLabel(order.paymentMethod)} payment confirmed for ${formatBdt(Number(order.total))}`,
        at: order.createdAt.toISOString(),
      })
    }

    if (order.deliveredAt) {
      push({
        id: `delivered-${order.id}`,
        type: 'shipping',
        message: `Order ${order.invoiceNumber} marked as delivered`,
        at: order.deliveredAt.toISOString(),
      })
    }
  }

  for (const customer of customers) {
    push({
      id: `customer-${customer.id}`,
      type: 'customer',
      message: `New customer registered — ${`${customer.firstName} ${customer.lastName}`.trim()}`,
      at: customer.createdAt.toISOString(),
    })
  }

  for (const entry of statusHistory) {
    if (!SHIPPING_STATUSES.has(entry.status)) continue
    push({
      id: `status-${entry.id}`,
      type: 'shipping',
      message: `Order ${entry.order.invoiceNumber} updated to ${entry.status.replace(/_/g, ' ').toLowerCase()}`,
      at: entry.createdAt.toISOString(),
    })
  }

  return [...activities.values()]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
}

export function qtyByProduct(
  items: Array<{ productId: string; quantity: number }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
  }
  return map
}
