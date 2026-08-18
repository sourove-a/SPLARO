import { type CatalogChannel, JHINGEPHOOL_COLLECTION_NAME, isJhingephoolCollectionSlug } from '@splaro/types'
import { categoryFromSlug, slugFromCategory, type Category } from '@/data/storefront'
import { shopCategoryFromSlug } from '@/lib/catalog/shop-category'

export function titleFromCollectionSlug(slug: string) {
  if (isJhingephoolCollectionSlug(slug)) return JHINGEPHOOL_COLLECTION_NAME
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export interface CollectionShopContext {
  slug: string
  title: string
  initialCategory: Category
  collectionSlug: string
  /** Empty for curated collections so PLP does not tree-filter as a department. */
  parentCategorySlug: string
  curated: boolean
  categorySlug?: string
}

/** Map `/c/:slug` or `/collections/:slug` to shop filters + page copy. */
export function resolveCollectionContext(
  slug: string,
  channels: CatalogChannel[],
): CollectionShopContext {
  const channel = channels.find((entry) => entry.slug === slug)
  const fromSlug = categoryFromSlug(slug)
  const leafShop = shopCategoryFromSlug(slug)
  const isDepartment = Boolean(channel || fromSlug)
  // ঝিঙেফুল is a brand collection, not a category. Every other /c/:slug is
  // a category tree (e.g. /c/sarees = all sarees).
  const isCurated = isJhingephoolCollectionSlug(slug)
  const shopCategory = (
    channel?.shopCategory ??
    fromSlug ??
    (isCurated ? null : leafShop) ??
    null
  ) as Category | null
  const initialCategory: Category = shopCategory && shopCategory !== 'All' ? shopCategory : 'All'

  return {
    slug,
    title: channel?.label ?? (fromSlug ?? titleFromCollectionSlug(slug)),
    initialCategory,
    collectionSlug: slug,
    parentCategorySlug: isCurated ? '' : slug,
    curated: isCurated,
    ...(isDepartment && fromSlug ? { categorySlug: slugFromCategory(fromSlug) } : {}),
  }
}
