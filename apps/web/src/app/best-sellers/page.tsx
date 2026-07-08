import type { Metadata } from 'next'
import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'Best Sellers',
  description: 'Shop SPLARO best sellers — customer favourites across Summer Edition, Men, Women, Kids, and Footwear.',
}

export const revalidate = 60

export default async function BestSellersPage() {
  const catalog = await getStorefrontCatalog()
  return (
    <ShopExperience
      initialCatalog={catalog}
      showCollections={false}
      catalogPreset="best-sellers"
      pageEyebrow="Customer Favourites"
      pageTitle="Best Sellers"
      pageDescription="Our most-loved pieces, curated from live SPLARO catalogues."
    />
  )
}
