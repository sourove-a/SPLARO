import { isGenericProductCopy } from '@/lib/catalog/product-copy'

/** Internal demo-catalog markers — must not appear on the public storefront. */
const DEMO_SKU_PREFIX = /^DEMO-/i
/** Seed/QA SKUs like "SPL-QA-30-WEEKENDCROS" — internal test codes, never customer-facing. */
const QA_SEED_SKU_PATTERN = /(?:^|[-_])QA(?:[-_]|\d)/i
const SEED_DESCRIPTION_PATTERN =
  /seeded demo product|seeded for storefront QA|SPLARO QA catalog|checkout QA coverage|replace with real inventory via admin when ready|demo catalog for (?:checkout testing|local development)|crafted with quality materials(?:\s+and\s+a\s+refined finish)?|premium SPLARO piece for everyday wear/i

/**
 * Ambiguous leather claims that imply genuine leather without stating it.
 * Hide from public PDP/feeds until admin enters an exact material label.
 */
const AMBIGUOUS_MATERIAL_PATTERN =
  /\bgenuine\s+leather\s+finish\b|\bleather[- ]?finish\b|\bleather[- ]?look\b|\bleather[- ]?like\b|\bfaux[- ]?leather\s+finish\b/i

export function isDemoCatalogSku(sku?: string | null): boolean {
  const trimmed = sku?.trim() ?? ''
  return DEMO_SKU_PREFIX.test(trimmed) || QA_SEED_SKU_PATTERN.test(trimmed)
}

/** True when copy/SKU scream seed/demo — never ship to OG tags or storefront cards. */
export function isDemoCatalogCopy(...parts: Array<string | null | undefined>): boolean {
  return parts.some((part) => SEED_DESCRIPTION_PATTERN.test(part?.trim() ?? ''))
}

/**
 * Public fabric/material line. Ambiguous “leather finish” claims are omitted —
 * never invent Full-grain vs PU; admin must set an exact `fabricContent`.
 */
export function sanitizeStorefrontMaterial(
  material?: string | null,
): string | undefined {
  const trimmed = material?.trim() ?? ''
  if (!trimmed) return undefined
  if (AMBIGUOUS_MATERIAL_PATTERN.test(trimmed)) return undefined
  return trimmed
}

/**
 * Public product code for cards/PDP.
 * Only real SKUs — never invent from truncated slug (was showing "HERITAGE BLO").
 */
export function sanitizeStorefrontProductCode(
  sku?: string | null,
  _slug?: string,
): string | undefined {
  if (isDemoCatalogSku(sku)) return undefined
  const trimmed = sku?.trim()
  if (!trimmed) return undefined
  return trimmed
}

export function sanitizeStorefrontDescription(
  description: string | null | undefined,
  fallback: string,
): string {
  const trimmed = description?.trim() ?? ''
  if (!trimmed || SEED_DESCRIPTION_PATTERN.test(trimmed) || isGenericProductCopy(trimmed)) {
    return fallback
  }
  return trimmed
}

export function sanitizeStorefrontShortDescription(
  shortDescription: string | null | undefined,
  fallback?: string,
): string | undefined {
  const trimmed = shortDescription?.trim() ?? ''
  if (!trimmed || SEED_DESCRIPTION_PATTERN.test(trimmed) || isGenericProductCopy(trimmed)) {
    return fallback?.trim() || undefined
  }
  return trimmed
}
