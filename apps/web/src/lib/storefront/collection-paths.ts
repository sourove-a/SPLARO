/** Short storefront path for a collection slug, e.g. `/c/men`. */
export function collectionHref(slug: string): string {
  return `/c/${slug}`
}

export function collectionSlugFromHref(href: string): string | null {
  const normalized = href.split('?')[0]?.replace(/\/$/, '') ?? ''
  const match = normalized.match(/^\/(?:c|collections)\/(.+)$/)
  return match?.[1] ?? null
}
