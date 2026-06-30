import type { Metadata } from 'next'
import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'New Arrivals — SPLARO',
  description: 'Discover the latest SPLARO arrivals — new season drops across apparel and footwear.',
}

export const revalidate = 60

export default async function NewArrivalsPage() {
  const catalog = await getStorefrontCatalog()
  return (
    <ShopExperience
      initialCatalog={catalog}
      showCollections={false}
      catalogPreset="new-arrivals"
      initialSort="Newest"
      pageEyebrow="Just Arrived"
      pageTitle="New Arrivals"
      pageDescription="Fresh drops marked as new in the SPLARO catalogue."
    />
  )
}
