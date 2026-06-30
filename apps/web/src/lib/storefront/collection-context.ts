import { type CatalogChannel } from '@splaro/types'
import { categoryFromSlug, slugFromCategory, type Category } from '@/data/storefront'

export function titleFromCollectionSlug(slug: string) {
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
  categorySlug?: string
}

/** Map `/c/:slug` or `/collections/:slug` to shop filters + page copy. */
export function resolveCollectionContext(
  slug: string,
  channels: CatalogChannel[],
): CollectionShopContext {
  const channel = channels.find((entry) => entry.slug === slug)
  const fromSlug = categoryFromSlug(slug)
  const shopCategory = (channel?.shopCategory ?? fromSlug ?? null) as Category | null
  const initialCategory: Category = shopCategory && shopCategory !== 'All' ? shopCategory : 'All'

  return {
    slug,
    title: channel?.label ?? (fromSlug ?? titleFromCollectionSlug(slug)),
    initialCategory,
    collectionSlug: slug,
    ...(fromSlug ? { categorySlug: slugFromCategory(fromSlug) } : {}),
  }
}
