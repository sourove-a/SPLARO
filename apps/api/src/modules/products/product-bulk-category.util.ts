export type CategoryLite = { id: string; name: string; slug: string }

export function normalizeCategoryToken(raw: string): { slug: string; name: string } {
  const last =
    raw
      .split(/[>/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? raw.trim()
  const slug = last
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return { slug, name: last }
}

export function pickCategoryMatch(
  categories: CategoryLite[],
  input: { slug?: string; label?: string },
): { id: string } | { error: string } | null {
  const slugRaw = input.slug?.trim()
  const labelRaw = input.label?.trim()
  if (!slugRaw && !labelRaw) return null

  const bySlug = (slug: string) =>
    categories.filter((row) => row.slug.toLowerCase() === slug.toLowerCase())

  if (slugRaw) {
    const token = normalizeCategoryToken(slugRaw)
    const hits = token.slug ? bySlug(token.slug) : []
    if (hits.length === 1) return { id: hits[0]!.id }
    if (hits.length > 1) {
      return { error: `Category slug "${token.slug}" is ambiguous` }
    }
  }

  if (labelRaw) {
    const token = normalizeCategoryToken(labelRaw)
    const slugHits = token.slug ? bySlug(token.slug) : []
    if (slugHits.length === 1) return { id: slugHits[0]!.id }

    const nameHits = categories.filter(
      (row) => row.name.toLowerCase() === token.name.toLowerCase(),
    )
    if (nameHits.length === 1) return { id: nameHits[0]!.id }
    if (nameHits.length > 1) {
      const slugs = nameHits.map((row) => row.slug).join(', ')
      return {
        error: `Category "${token.name}" is ambiguous — set category_slug (${slugs})`,
      }
    }
  }

  return { error: `Category not found: ${(slugRaw || labelRaw || '').trim()}` }
}
