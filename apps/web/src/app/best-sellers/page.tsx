import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata = createRouteMetadata({
  title: 'Best Sellers',
  description: 'Shop SPLARO best sellers — customer favourites across Summer Edition, Men, Women, Kids, and Footwear.',
  path: '/best-sellers',
})

export const revalidate = 60

export default async function BestSellersPage() {
  const catalog = await getStorefrontCatalog()
  return (
    <ShopExperience
      initialCatalog={catalog}
      showCollections={false}
      catalogPreset="best-sellers"
      pageTitle="Best Sellers"
    />
  )
}
