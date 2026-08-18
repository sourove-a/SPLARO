export const JHINGEPHOOL_COLLECTION_SLUG = 'jhingephool'
export const JHINGEPHOOL_COLLECTION_NAME = 'ঝিঙেফুল'
export const JHINGEPHOOL_COLLECTION_DESCRIPTION =
  'Premium handloom sarees — ঝিঙেফুল by SPLARO.'

export function isJhingephoolCollectionSlug(slug: string | null | undefined): boolean {
  return (slug ?? '').trim().toLowerCase() === JHINGEPHOOL_COLLECTION_SLUG
}

export function isSareeCategorySlug(value: string | null | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase()
  return text.includes('saree') || text.includes('sari') || text.includes('শাড়ি')
}
