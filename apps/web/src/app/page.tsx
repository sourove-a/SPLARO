import type { Metadata } from 'next'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { fetchHeroBanners } from '@/lib/api/banners'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'SPLARO — Premium Everyday Storefront',
  description:
    'A polished SPLARO storefront for Summer Edition, Men, Women, Kids, and Footwear with a soft liquid-glass shopping experience.',
}

export const revalidate = 60

export default async function HomePage() {
  const [catalog, heroBanners] = await Promise.all([getStorefrontCatalog(), fetchHeroBanners()])
  return <GlassStorefront initialCatalog={catalog} heroBanners={heroBanners} />
}
