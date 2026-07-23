/**
 * Audience label for catalog cards / PDP.
 * Unisex is explicit via tag or category — never inferred from product name alone.
 */
export function isUnisexProduct(input: {
  tags?: string[] | null
  categorySlug?: string | null
  categoryName?: string | null
}): boolean {
  const tags = (input.tags ?? []).map((t) => t.trim().toLowerCase())
  if (tags.some((t) => t === 'unisex' || t === 'gender-neutral' || t === 'gender_neutral')) {
    return true
  }
  const slug = (input.categorySlug ?? '').trim().toLowerCase()
  const name = (input.categoryName ?? '').trim().toLowerCase()
  return slug === 'unisex' || name === 'unisex'
}

export function productAudienceLabel(input: {
  tags?: string[] | null
  categorySlug?: string | null
  categoryName?: string | null
}): 'Unisex' | null {
  return isUnisexProduct(input) ? 'Unisex' : null
}
