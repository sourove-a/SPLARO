import type { Metadata } from 'next'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { fetchHeroBanners } from '@/lib/api/banners'
import { resolveHeroBanners } from '@/lib/api/hero-banners'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  description:
    'Discover SPLARO — quiet luxury fashion for women, men, and kids. Premium essentials, footwear, and accessories.',
}

export const revalidate = 60

export default async function HomePage() {
  const [catalog, apiBanners] = await Promise.all([getStorefrontCatalog(), fetchHeroBanners()])
  const heroBanners = resolveHeroBanners(apiBanners, catalog.products)
  return <GlassStorefront initialCatalog={catalog} heroBanners={heroBanners} />
}
