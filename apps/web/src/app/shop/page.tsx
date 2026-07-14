import type { Metadata } from 'next'
import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Browse SPLARO Summer Edition, Men, Women, Kids, and Footwear. Filter by size and colour.',
}

export const revalidate = 60

export default async function ShopPage() {
  const catalog = await getStorefrontCatalog()

  return (
    <ShopExperience
      initialCatalog={catalog}
      listingMode="full"
      showCollections={false}
    />
  )
}
