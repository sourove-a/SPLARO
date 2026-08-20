export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function hasMetaValue(value?: string | null): boolean {
  return Boolean(value?.trim())
}

/** Collapse “Premium premium” / repeated adjacent words in generated meta. */
export function collapseDuplicateAdjacentWords(text: string): string {
  return text.replace(/\b([\p{L}]+)\s+\1\b/giu, '$1')
}

const STALE_META_PATTERN =
  /\bpremium\s+premium\b|luxury women's fashion|premium women's fashion|premium piece from SPLARO/i

export function isStaleProductMeta(value?: string | null): boolean {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return true
  if (STALE_META_PATTERN.test(trimmed)) return true
  return collapseDuplicateAdjacentWords(trimmed) !== trimmed
}

export function buildProductMetaTitle(name: string): string {
  const clean = collapseDuplicateAdjacentWords(name.trim())
  const suffix = ' | SPLARO'
  const withSuffix = `${clean}${suffix}`
  if (withSuffix.length <= 60) return withSuffix
  const maxName = 60 - suffix.length
  return `${clean.slice(0, Math.max(1, maxName)).trimEnd()}${suffix}`
}

export function buildProductMetaDescription(
  name: string,
  description?: string | null,
  shortDescription?: string | null,
): string {
  const raw = collapseDuplicateAdjacentWords(stripHtml((shortDescription || description || '').trim()))
  if (raw.length >= 100 && raw.length <= 160 && !isStaleProductMeta(raw)) return raw
  if (raw.length > 160 && !isStaleProductMeta(raw)) return `${raw.slice(0, 157).trimEnd()}...`

  const fallback = collapseDuplicateAdjacentWords(
    `Shop ${name.trim()} at SPLARO — fashion for men, women and kids in Bangladesh. Secure checkout and nationwide delivery.`,
  )
  if (fallback.length <= 160) return fallback
  return `${fallback.slice(0, 157).trimEnd()}...`
}
