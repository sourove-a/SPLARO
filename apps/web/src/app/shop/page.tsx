import { ShopExperience } from '@/components/shop/ShopExperience'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import { getStorefrontCatalogPage } from '@/lib/catalog/server'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { buildBreadcrumbJsonLd } from '@/lib/seo/geo-json-ld'

export const metadata = createRouteMetadata({
  title: 'Shop Premium Fashion for Men, Women & Kids',
  description:
    'Shop SPLARO clothing, footwear and accessories for men, women and kids. Premium everyday fashion crafted for modern Bangladesh.',
  path: '/shop',
})

export const dynamic = 'force-dynamic'

export default async function ShopPage() {
  const catalog = await getStorefrontCatalogPage(1, LISTING_PAGE_SIZE)
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      <ShopExperience
        key="shop:all"
        initialCatalog={catalog}
        listingMode="paged"
        showCollections={false}
        pageTitle="Shop"
      />
    </>
  )
}
