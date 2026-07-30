/**
 * Tone / width lookup tables ported from the design prototype
 * (`SPLARO Admin.dc.html` — const V, STATUS, FLEX).
 *
 * Values are CSS custom properties declared in `src/styles/dc.css`, so a single
 * set of tones serves both the light and dark themes.
 */

export type DcTone = 'ok' | 'warn' | 'bad' | 'info' | 'vio' | 'mute'

export interface DcToneStyle {
  bg: string
  fg: string
  bd: string
}

export const TONE: Record<DcTone, DcToneStyle> = {
  ok: { bg: 'var(--ok-soft)', fg: 'var(--ok)', bd: 'var(--ok-bd)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', bd: 'var(--warn-bd)' },
  bad: { bg: 'var(--bad-soft)', fg: 'var(--bad)', bd: 'var(--bad-bd)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-bd)' },
  vio: { bg: 'var(--violet-soft)', fg: 'var(--violet)', bd: 'var(--violet-bd)' },
  mute: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', bd: 'var(--line)' },
}

/** Status label → tone, so a chip cell can omit an explicit tone. */
export const STATUS_TONE: Record<string, DcTone> = {
  Pending: 'warn',
  Confirmed: 'info',
  Processing: 'info',
  Packed: 'vio',
  Shipped: 'info',
  Delivered: 'ok',
  Cancelled: 'bad',
  Returned: 'bad',
  Active: 'ok',
  Draft: 'mute',
  'Out of stock': 'bad',
  Archived: 'mute',
}

export function toneStyle(tone?: DcTone, fallback: DcTone = 'mute'): DcToneStyle {
  return TONE[tone ?? fallback] ?? TONE[fallback]
}

export function statusToneStyle(label: string, tone?: DcTone): DcToneStyle {
  if (tone) return toneStyle(tone)
  return toneStyle(STATUS_TONE[label], 'mute')
}

/** Block width keyword → [flex, min-width]. Blocks flow in a wrapping flex row. */
export type DcWidth = 'full' | 'main' | 'side' | 'half'

export const FLEX: Record<DcWidth, [string, string]> = {
  full: ['1 1 100%', '100%'],
  main: ['1 1 56%', '340px'],
  side: ['1 1 28%', '290px'],
  half: ['1 1 44%', '320px'],
}

export const FONT =
  "var(--font-inter), var(--font-noto-bengali), Inter, 'Noto Sans Bengali', sans-serif"
export const MONO = 'var(--mono)'

/** Numeric-looking values get the mono face so columns line up. */
export function autoFont(value: unknown): string {
  return /[0-9৳%]/.test(String(value)) ? MONO : FONT
}

/**
 * Taka with lakh/crore grouping — `৳48,60,000`, not `৳4,860,000`.
 * `formatBDT` in `@/lib/utils/currency` uses en-BD, which groups in thousands;
 * the design calls for the South Asian grouping everywhere money is shown.
 */
export function formatTaka(amount: number): string {
  if (!Number.isFinite(amount)) return '৳0'
  return `৳${Math.round(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** Signed percentage for delta chips: `+12.6%` / `−4.2%`. */
export function formatDelta(change: number): string {
  const rounded = Math.round(change * 10) / 10
  if (rounded < 0) return `−${Math.abs(rounded)}%`
  return `+${rounded}%`
}

export function deltaTone(change: number): DcTone {
  if (change > 0.5) return 'ok'
  if (change < -0.5) return 'bad'
  return 'mute'
}
