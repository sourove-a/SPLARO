import type { Metadata } from 'next'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { fetchHeroBanners } from '@/lib/api/banners'
import { resolveHeroBanners } from '@/lib/api/hero-banners'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'SPLARO — Premium Everyday Storefront',
  description:
    'A polished SPLARO storefront for Summer Edition, Men, Women, Kids, and Footwear with a soft liquid-glass shopping experience.',
}

export const revalidate = 60

export default async function HomePage() {
  const [catalog, apiBanners] = await Promise.all([getStorefrontCatalog(), fetchHeroBanners()])
  const heroBanners = resolveHeroBanners(apiBanners, catalog.products)
  return <GlassStorefront initialCatalog={catalog} heroBanners={heroBanners} />
}
