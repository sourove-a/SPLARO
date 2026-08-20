/** Inclusive createdAt window for YYYY-MM-DD query params, Asia/Dhaka (UTC+6). */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDhakaDayStart(ymd?: string | null): Date | null {
  const v = ymd?.trim()
  if (!v || !YMD.test(v)) return null
  const d = new Date(`${v}T00:00:00+06:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseDhakaDayEnd(ymd?: string | null): Date | null {
  const v = ymd?.trim()
  if (!v || !YMD.test(v)) return null
  const d = new Date(`${v}T23:59:59.999+06:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function createdAtRange(
  from?: string | null,
  to?: string | null,
): { gte?: Date; lte?: Date } | undefined {
  let start = parseDhakaDayStart(from)
  let end = parseDhakaDayEnd(to)
  if (start && end && start > end) {
    const swappedFrom = to
    const swappedTo = from
    start = parseDhakaDayStart(swappedFrom)
    end = parseDhakaDayEnd(swappedTo)
  }
  if (!start && !end) return undefined
  return {
    ...(start ? { gte: start } : {}),
    ...(end ? { lte: end } : {}),
  }
}
