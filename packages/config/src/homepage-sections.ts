export const HOMEPAGE_SECTION_IDS = [
  'hero',
  'marquee',
  'collections',
  'trustBar',
  'catalog',
  'specialOffer',
  'ourStory',
  'instagram',
  'newsletter',
] as const

export type HomepageSectionId = (typeof HOMEPAGE_SECTION_IDS)[number]

export function resolveHomepageSectionOrder(
  saved?: readonly string[] | null,
): HomepageSectionId[] {
  const known = new Set<string>(HOMEPAGE_SECTION_IDS)
  const picked = (saved ?? []).filter((id): id is HomepageSectionId => known.has(id))
  const rest = HOMEPAGE_SECTION_IDS.filter((id) => !picked.includes(id))
  return [...picked, ...rest]
}
