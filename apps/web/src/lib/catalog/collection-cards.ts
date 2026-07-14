import type { CatalogChannel } from '@splaro/types'
import type { CollectionCard } from '@/data/storefront'
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

/** Collection tiles — published catalog channels + live DB collection metadata. */
export async function getVisibleCollectionCards(
  channels: CatalogChannel[],
  catalog?: CachedCatalog,
): Promise<CollectionCard[]> {
  const published = channels.filter((channel) => channel.published)
  if (!published.length) return []

  const liveCollections = await fetchLiveCollections().catch(() => [])
  const liveBySlug = new Map(liveCollections.map((row) => [row.slug, row]))

  return published
    .map((channel) => {
      const live = liveBySlug.get(channel.slug)
      const matched =
        catalog?.source === 'api'
          ? productsForSlug(channel.slug, channel.shopCategory, catalog.products)
          : null

      return {
        slug: channel.slug,
        label: live?.name ?? channel.label,
        image:
          live?.imageUrl?.trim() ||
          matched?.find((p) => p.image?.trim())?.image?.trim() ||
          PRODUCT_IMAGE_PLACEHOLDER,
        count: matched?.length ?? live?.productCount ?? 0,
      }
    })
    .filter((card) => card.count > 0)
}
