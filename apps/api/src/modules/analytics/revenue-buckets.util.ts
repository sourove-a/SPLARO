export interface RevenueBucket {
  date: string
  revenue: number
  orders: number
}

export type RevenueGroup = 'day' | 'month'

/**
 * Buckets orders into a continuous series between `since` and `until`.
 *
 * Every period in the window is present, at zero when nothing sold. Without
 * that, a chart drawn from the result silently compresses its own timeline —
 * three orders spread across a fortnight would read as three consecutive busy
 * days, which is the opposite of what happened.
 */
export function buildRevenueBuckets(
  orders: Array<{ total: unknown; createdAt: Date }>,
  since: Date,
  until: Date,
  group: RevenueGroup = 'day',
): RevenueBucket[] {
  const keyOf = (d: Date) => (group === 'month' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10))

  const buckets = new Map<string, RevenueBucket>()
  const cursor = new Date(since)
  if (group === 'month') cursor.setUTCDate(1)
  else cursor.setUTCHours(0, 0, 0, 0)

  while (cursor <= until) {
    const key = keyOf(cursor)
    buckets.set(key, { date: key, revenue: 0, orders: 0 })
    if (group === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    else cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  for (const order of orders) {
    const key = keyOf(order.createdAt)
    // An order can fall outside the pre-seeded window when the caller passes a
    // wider order set than window; keep it rather than dropping revenue.
    const bucket = buckets.get(key) ?? { date: key, revenue: 0, orders: 0 }
    bucket.revenue += Number(order.total)
    bucket.orders += 1
    buckets.set(key, bucket)
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}
