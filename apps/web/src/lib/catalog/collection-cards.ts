import { filterCollectionCards, type CatalogChannel } from '@splaro/types'
import { collectionCards, type CollectionCard } from '@/data/storefront'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { fetchLiveCollections } from '@/lib/catalog/live'
import type { CachedCatalog } from '@/lib/catalog/server'

function countForSlug(
  slug: string,
  shopCategory: string | undefined,
  products: Array<{ category: string }>,
) {
  if (shopCategory) {
    return products.filter((product) => product.category === shopCategory).length
  }
  return products.filter(
    (product) => product.category.toLowerCase().replace(/\s+/g, '-') === slug,
  ).length
}

/** Collection tiles for shop/collections — live image + count only, no stock Unsplash heroes. */
export async function getVisibleCollectionCards(
  channels: CatalogChannel[],
  catalog?: CachedCatalog,
): Promise<CollectionCard[]> {
  const liveCollections = await fetchLiveCollections().catch(() => [])
  const liveBySlug = new Map(liveCollections.map((row) => [row.slug, row]))

  return filterCollectionCards(collectionCards, channels).map((card) => {
    const channel = channels.find((entry) => entry.slug === card.slug)
    const live = liveBySlug.get(card.slug)
    const apiCount =
      catalog?.source === 'api'
        ? countForSlug(card.slug, channel?.shopCategory, catalog.products)
        : null

    return {
      slug: card.slug,
      label: live?.name ?? card.label,
      image: live?.imageUrl?.trim() || PRODUCT_IMAGE_PLACEHOLDER,
      count: apiCount ?? live?.productCount ?? 0,
    }
  })
}
