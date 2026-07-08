import type { Metadata } from 'next'
import { mergeCatalogChannels } from '@splaro/types'
import { ShopExperience } from '@/components/shop/ShopExperience'
import { getVisibleCollectionCards } from '@/lib/catalog/collection-cards'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'

export const metadata: Metadata = {
  title: 'Shop — SPLARO',
  description:
    'Browse SPLARO Summer Edition, Men, Women, Kids, and Footwear. Filter by size and colour, pay with bKash or Nagad, and enjoy fast delivery.',
}

export const revalidate = 60

export default async function ShopPage() {
  const [catalog, settings] = await Promise.all([
    getStorefrontCatalog(),
    getStorefrontSettings(),
  ])
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const collectionCards = await getVisibleCollectionCards(channels, catalog)

  return (
    <ShopExperience
      initialCatalog={catalog}
      collectionCards={collectionCards}
      listingMode="full"
    />
  )
}
