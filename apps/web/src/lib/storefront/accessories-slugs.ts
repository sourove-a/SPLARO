/** Slugs that should route to /accessories instead of /collections/* */
export const ACCESSORY_COLLECTION_SLUGS = new Set([
  'glasses',
  'glasses-sunglasses',
  'glasses-optical',
  'glasses-aviator',
  'glasses-cat-eye',
  'bags',
  'bags-premium',
  'bags-luxury',
  'bags-ws',
  'handbags',
  'handbags-tote',
  'handbags-shoulder',
  'clutch',
  'watches',
  'wallets',
  'cardholder',
  'jewelry',
  'scarves',
  'belts',
  'hats',
  'prayer-caps',
  'prayer-mats',
  'home-decor',
  'accessories',
  'accessories-new',
  'accessories-bestsellers',
])

export function resolveAccessoryRedirect(slug: string): string | null {
  if (!ACCESSORY_COLLECTION_SLUGS.has(slug)) return null

  if (slug === 'accessories-new') return '/accessories?filter=new'
  if (slug === 'accessories-bestsellers') return '/accessories?filter=bestsellers'
  if (slug === 'accessories') return '/accessories'

  const root = slug.split('-')[0] ?? slug
  const knownRoots = [
    'glasses',
    'bags',
    'handbags',
    'watches',
    'wallets',
    'jewelry',
    'scarves',
    'belts',
    'hats',
    'prayer',
    'home',
    'cardholder',
    'clutch',
  ] as const

  if (slug === 'cardholder' || slug === 'clutch' || slug === 'prayer-mats') {
    return `/accessories?cat=${encodeURIComponent(slug)}`
  }

  if (knownRoots.includes(root as (typeof knownRoots)[number])) {
    if (slug.includes('-')) return `/accessories?cat=${encodeURIComponent(slug)}`
    return `/accessories?cat=${encodeURIComponent(slug)}`
  }

  return `/accessories?cat=${encodeURIComponent(slug)}`
}
