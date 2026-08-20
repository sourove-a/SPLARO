/**
 * Pure shaping for the dashboard charts.
 *
 * Kept out of the components so the parts that can be wrong — bucketing,
 * percentages, empty detection — are unit tested rather than eyeballed in a
 * chart, where a subtle error just looks like a slightly different bar.
 */

export interface HourBucket {
  hour: number
  orders: number
  /** 0–1 against the busiest hour, for bar height / heat intensity. */
  intensity: number
}

export interface FunnelStep {
  label: string
  count: number
  /** Share of the first step. The first step is always 1. */
  ofTop: number
  /** Share kept from the step immediately above. */
  fromPrev: number
}

export interface SourceSlice {
  source: string
  orders: number
  revenue: number
  share: number
}

/** Orders per hour in Asia/Dhaka, 24 buckets, zero-filled. */
export function bucketOrdersByHour(
  createdAtList: Array<string | Date>,
  timeZone = 'Asia/Dhaka',
): HourBucket[] {
  const counts = new Array<number>(24).fill(0)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  })

  for (const raw of createdAtList) {
    const at = raw instanceof Date ? raw : new Date(raw)
    if (Number.isNaN(at.getTime())) continue
    // The store reads its day in Dhaka time; bucketing in UTC would move the
    // evening rush by six hours and quietly point staffing at the wrong shift.
    const hour = Number.parseInt(formatter.format(at), 10)
    if (Number.isNaN(hour) || hour < 0 || hour > 23) continue
    counts[hour] = (counts[hour] ?? 0) + 1
  }

  const peak = Math.max(...counts, 0)
  return counts.map((orders, hour) => ({
    hour,
    orders,
    intensity: peak > 0 ? orders / peak : 0,
  }))
}

/** Busiest hour, or null when there is nothing to report. */
export function peakHour(buckets: HourBucket[]): HourBucket | null {
  let best: HourBucket | null = null
  for (const bucket of buckets) {
    if (bucket.orders === 0) continue
    if (!best || bucket.orders > best.orders) best = bucket
  }
  return best
}

/** "14:00–15:00" for an hour bucket. */
export function hourLabel(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`
}

/**
 * Funnel percentages.
 *
 * A step can be larger than the one above it — sessions are counted by a
 * different source than orders — so ratios are clamped to 1 instead of drawing
 * a step wider than its parent, which would read as a data error.
 */
export function buildFunnel(steps: Array<{ label: string; count: number }>): FunnelStep[] {
  const top = steps[0]?.count ?? 0
  return steps.map((step, index) => {
    const prev = index === 0 ? step.count : (steps[index - 1]?.count ?? 0)
    return {
      label: step.label,
      count: step.count,
      ofTop: top > 0 ? Math.min(1, step.count / top) : 0,
      fromPrev: prev > 0 ? Math.min(1, step.count / prev) : 0,
    }
  })
}

/** Traffic sources sorted by orders, with share of total. Unnamed → "direct". */
export function buildSourceSlices(
  rows: Array<{ source?: string | null; orders?: number | null; revenue?: number | null }>,
): SourceSlice[] {
  const cleaned = rows.map((row) => ({
    source: (row.source ?? '').trim() || 'direct',
    orders: Math.max(0, Number(row.orders ?? 0)),
    revenue: Math.max(0, Number(row.revenue ?? 0)),
  }))
  const total = cleaned.reduce((sum, row) => sum + row.orders, 0)
  return cleaned
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.orders - a.orders)
    .map((row) => ({ ...row, share: total > 0 ? row.orders / total : 0 }))
}

/** True when a series carries no signal — drives the empty state, not a flat chart. */
export function seriesIsEmpty(points: Array<{ orders?: number; revenue?: number }>): boolean {
  return points.every((p) => (p.orders ?? 0) === 0 && (p.revenue ?? 0) === 0)
}

/** Bar heights in a viewBox of `height`, with a visible stub for zero days. */
export function barHeights(values: number[], height: number, minBar = 2): number[] {
  const peak = Math.max(...values, 0)
  if (peak <= 0) return values.map(() => minBar)
  return values.map((v) => (v <= 0 ? minBar : Math.max(minBar, (v / peak) * height)))
}
