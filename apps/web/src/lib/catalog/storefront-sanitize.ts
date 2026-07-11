/** Internal demo-catalog markers — must not appear on the public storefront. */
const DEMO_SKU_PREFIX = /^DEMO-/i
const SEED_DESCRIPTION_PATTERN =
  /seeded demo product|replace with real inventory via admin when ready/i

export function isDemoCatalogSku(sku?: string | null): boolean {
  return DEMO_SKU_PREFIX.test(sku?.trim() ?? '')
}

export function sanitizeStorefrontProductCode(
  sku?: string | null,
  slug?: string,
): string | undefined {
  if (isDemoCatalogSku(sku)) return undefined
  const trimmed = sku?.trim()
  if (trimmed) return trimmed
  if (slug) return slug.replace(/-/g, ' ').slice(0, 12).toUpperCase()
  return undefined
}

export function sanitizeStorefrontDescription(
  description: string | null | undefined,
  fallback: string,
): string {
  const trimmed = description?.trim() ?? ''
  if (!trimmed || SEED_DESCRIPTION_PATTERN.test(trimmed)) return fallback
  return trimmed
}
