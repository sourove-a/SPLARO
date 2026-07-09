import { filterCollectionCards, type CatalogChannel } from '@splaro/types'
import { collectionCards, type CollectionCard } from '@/data/storefront'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { fetchLiveCollections } from '@/lib/catalog/live'
import type { CachedCatalog } from '@/lib/catalog/server'

function productsForSlug(
  slug: string,
  shopCategory: string | undefined,
  products: Array<{ category: string; image?: string }>,
) {
  if (shopCategory) {
    return products.filter((product) => product.category === shopCategory)
  }
  return products.filter(
    (product) => product.category.toLowerCase().replace(/\s+/g, '-') === slug,
  )
}

/** Collection tiles for shop/collections — live image + count only, no stock Unsplash heroes. */
export async function getVisibleCollectionCards(
  channels: CatalogChannel[],
  catalog?: CachedCatalog,
): Promise<CollectionCard[]> {
  const liveCollections = await fetchLiveCollections().catch(() => [])
  const liveBySlug = new Map(liveCollections.map((row) => [row.slug, row]))

  return filterCollectionCards(collectionCards, channels)
    .map((card) => {
      const channel = channels.find((entry) => entry.slug === card.slug)
      const live = liveBySlug.get(card.slug)
      const matched =
        catalog?.source === 'api'
          ? productsForSlug(card.slug, channel?.shopCategory, catalog.products)
          : null

      return {
        slug: card.slug,
        label: live?.name ?? card.label,
        // No admin-set collection image → fall back to the first product's
        // photo so the tile never shows the grey placeholder bag.
        image:
          live?.imageUrl?.trim() ||
          matched?.find((p) => p.image?.trim())?.image?.trim() ||
          PRODUCT_IMAGE_PLACEHOLDER,
        count: matched?.length ?? live?.productCount ?? 0,
      }
    })
    // An empty collection is a dead end (placeholder tile → zero-product page);
    // hide it until the admin stocks it.
    .filter((card) => card.count > 0)
}
