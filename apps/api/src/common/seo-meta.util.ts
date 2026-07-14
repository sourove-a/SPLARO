export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildProductMetaTitle(name: string): string {
  const clean = name.trim()
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
  const raw = stripHtml((shortDescription || description || '').trim())
  if (raw.length >= 100 && raw.length <= 160) return raw
  if (raw.length > 160) return `${raw.slice(0, 157).trimEnd()}...`

  const fallback =
    `Shop ${name} at SPLARO — luxury women's fashion from Bangladesh. Premium quality, secure checkout & nationwide delivery.`
  if (fallback.length <= 160) return fallback
  return `${fallback.slice(0, 157).trimEnd()}...`
}

export function hasMetaValue(value?: string | null): boolean {
  return Boolean(value?.trim())
}
