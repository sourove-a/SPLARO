import type { CatalogChannel } from '@splaro/types'
import { isJhingephoolCollectionSlug } from '@splaro/types'
import type { CollectionCard } from '@/data/storefront'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { fetchLiveCollections } from '@/lib/catalog/live'
import type { CachedCatalog } from '@/lib/catalog/server'

/** Curated Prisma collections — not department channels like Women/Men. */
export async function getVisibleCollectionCards(
  _channels: CatalogChannel[],
  _catalog?: CachedCatalog,
): Promise<CollectionCard[]> {
  const liveCollections = await fetchLiveCollections().catch(() => [])
  return liveCollections
    .filter((row) => row.productCount > 0 && !isJhingephoolCollectionSlug(row.slug))
    .map((row) => ({
      slug: row.slug,
      label: row.name,
      image: row.imageUrl?.trim() || PRODUCT_IMAGE_PLACEHOLDER,
      count: row.productCount,
    }))
}
