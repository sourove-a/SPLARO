import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata = createRouteMetadata({
  title: 'New Arrivals',
  description: 'Discover the latest SPLARO arrivals — new season drops across apparel and footwear.',
  path: '/new-arrivals',
})

export const revalidate = 60

export default async function NewArrivalsPage() {
  const catalog = await getStorefrontCatalog()
  return (
    <ShopExperience
      initialCatalog={catalog}
      showCollections={false}
      catalogPreset="new-arrivals"
      initialSort="Newest"
      pageTitle="New Arrivals"
    />
  )
}
