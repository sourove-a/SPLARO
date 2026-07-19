import { ShopExperience } from '@/components/shop/ShopExperience'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import { getStorefrontCatalogPage } from '@/lib/catalog/server'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export const metadata = createRouteMetadata({
  title: 'Shop',
  description:
    'Browse SPLARO Summer Edition, Men, Women, Kids, and Footwear. Filter by size and colour.',
  path: '/shop',
})

export const dynamic = 'force-dynamic'

export default async function ShopPage() {
  const catalog = await getStorefrontCatalogPage(1, LISTING_PAGE_SIZE)

  return (
    <ShopExperience
      initialCatalog={catalog}
      listingMode="paged"
      showCollections={false}
      pageTitle="Shop"
    />
  )
}
