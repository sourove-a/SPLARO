/**
 * Storefront product copy helpers — reject QA/template fluff and surface real specs.
 */

export interface ProductSpecFact {
  label: string
  value: string
}

const GENERIC_COPY_PATTERN =
  /crafted with quality materials(?:\s+and\s+a\s+refined finish)?|premium SPLARO piece(?:\s+for everyday wear)?|a premium SPLARO piece|designed for everyday comfort,\s*easy styling|quiet luxury finishing for everyday wear|available now\.|demo catalog for (?:checkout testing|local development)/i

/** Ordered storefront labels for schemaMarkup.specs keys. */
const SPEC_LABELS: Array<{ key: string; label: string }> = [
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'strapLength', label: 'Strap' },
  { key: 'compartments', label: 'Compartments' },
  { key: 'closure', label: 'Closure' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'heelHeight', label: 'Heel' },
  { key: 'caseSize', label: 'Case' },
  { key: 'waterResistance', label: 'Water resistance' },
  { key: 'weight', label: 'Weight' },
]

export function isGenericProductCopy(text?: string | null): boolean {
  const trimmed = text?.trim() ?? ''
  if (!trimmed) return true
  return GENERIC_COPY_PATTERN.test(trimmed)
}

/**
 * Honest fallback when DB copy is missing or is a seed/QA template.
 * Uses real material / carry / occasion fields — never “quality materials”.
 */
export function buildProductDescriptionFallback(input: {
  name: string
  fabricContent?: string | null | undefined
  fitType?: string | null | undefined
  occasion?: string | null | undefined
  category?: string | null | undefined
  categorySlug?: string | null | undefined
}): string {
  const name = input.name.trim() || 'SPLARO piece'
  const material = input.fabricContent?.trim()
  const silhouette = input.fitType?.trim()
  const occasion = input.occasion?.trim()
  const isAccessory = /accessor|bag|wallet|watch|scarf|belt|tote|crossbody/i.test(
    `${input.category ?? ''} ${input.categorySlug ?? ''} ${name}`,
  )

  const materialBit = material
    ? material.toLowerCase()
    : isAccessory
      ? 'considered materials'
      : 'premium fabric'
  const shapeBit = silhouette
    ? silhouette.toLowerCase()
    : isAccessory
      ? 'everyday carry profile'
      : 'considered fit'
  const occasionBit = occasion ? ` Made for ${occasion.toLowerCase()}.` : ''

  if (isAccessory) {
    return `${name} in ${materialBit} with a ${shapeBit}.${occasionBit} Quiet details, practical structure — ready for daily wear in Bangladesh.`
  }

  return `${name} in ${materialBit} with a ${shapeBit}.${occasionBit} Refined finishing for everyday wear in Bangladesh.`
}

export function parseProductSpecs(
  schemaMarkup: Record<string, unknown> | null | undefined,
): ProductSpecFact[] {
  if (!schemaMarkup || typeof schemaMarkup !== 'object') return []
  const raw = schemaMarkup['specs']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []

  const specs = raw as Record<string, unknown>
  const facts: ProductSpecFact[] = []
  const used = new Set<string>()

  for (const { key, label } of SPEC_LABELS) {
    const value = specs[key]
    if (typeof value !== 'string' || !value.trim()) continue
    facts.push({ label, value: value.trim() })
    used.add(key)
  }

  for (const [key, value] of Object.entries(specs)) {
    if (used.has(key)) continue
    if (typeof value !== 'string' || !value.trim()) continue
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim()
    facts.push({ label, value: value.trim() })
  }

  return facts
}

export function formatProductWeightGrams(weight: number | string | null | undefined): string | null {
  if (weight == null || weight === '') return null
  const n = typeof weight === 'number' ? weight : Number(weight)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n >= 1000) {
    const kg = n / 1000
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/\.?0+$/, '')} kg`
  }
  return `${Math.round(n)} g`
}
