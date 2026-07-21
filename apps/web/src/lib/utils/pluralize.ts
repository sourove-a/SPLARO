/** English count + noun — never “color s” / “Item s”. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return `${n} ${n === 1 ? singular : plural}`
}

/** Shop range line: `1–24 of 24 items` */
export function formatItemRange(visibleCount: number, totalCount: number): string {
  const total = Number.isFinite(totalCount) ? Math.max(0, Math.trunc(totalCount)) : 0
  const visible = Number.isFinite(visibleCount)
    ? Math.min(Math.max(0, Math.trunc(visibleCount)), total)
    : 0
  if (total === 0) return '0 items'
  const from = visible === 0 ? 0 : 1
  const to = visible
  return `${from}–${to} of ${pluralize(total, 'item')}`
}
