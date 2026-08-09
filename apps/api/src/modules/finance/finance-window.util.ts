export type FinanceRangePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'custom'

export type FinanceWindow = { from: Date; to: Date; previousFrom: Date; previousTo: Date }

function startOfDay(d: Date): Date {
  const next = new Date(d)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(d: Date): Date {
  const next = new Date(d)
  next.setHours(23, 59, 59, 999)
  return next
}

export function resolveFinanceWindow(opts: {
  preset?: string | null
  from?: string | null
  to?: string | null
  now?: Date
}): FinanceWindow {
  const now = opts.now ?? new Date()
  const preset = (opts.preset ?? 'today').toLowerCase().replace(/-/g, '_')

  let from: Date
  let to: Date

  if (preset === 'custom' || opts.from || opts.to) {
    from = opts.from ? startOfDay(new Date(opts.from)) : startOfDay(now)
    to = opts.to ? endOfDay(new Date(opts.to)) : endOfDay(now)
    if (from > to) {
      const swap = from
      from = startOfDay(to)
      to = endOfDay(swap)
    }
  } else if (preset === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    from = startOfDay(y)
    to = endOfDay(y)
  } else if (preset === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    from = startOfDay(start)
    to = endOfDay(now)
  } else if (preset === '30d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    from = startOfDay(start)
    to = endOfDay(now)
  } else if (preset === 'this_month') {
    from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    to = endOfDay(now)
  } else {
    from = startOfDay(now)
    to = endOfDay(now)
  }

  const spanMs = to.getTime() - from.getTime()
  const previousTo = new Date(from.getTime() - 1)
  const previousFrom = new Date(previousTo.getTime() - spanMs)

  return { from, to, previousFrom, previousTo }
}
