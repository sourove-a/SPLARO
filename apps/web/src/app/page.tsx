import type { Metadata } from 'next'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { fetchHeroBanners } from '@/lib/api/banners'
import { resolveHeroBanners } from '@/lib/api/hero-banners'
import { resolveLocalHeroVariants } from '@/lib/assets/hero-cdn'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Discover SPLARO — quiet luxury fashion for women, men, and kids. Premium essentials, footwear, and accessories.',
}

export const revalidate = 60

export default async function HomePage() {
  const [catalog, apiBanners] = await Promise.all([getStorefrontCatalog(), fetchHeroBanners()])
  const heroBanners = resolveHeroBanners(apiBanners, catalog.products)
  const lcp = resolveLocalHeroVariants(heroBanners[0]?.image)

  return (
    <>
      {lcp ? (
        <>
          <link
            rel="preload"
            as="image"
            href={lcp.mobile}
            type="image/webp"
            media="(max-width: 768px)"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href={lcp.desktop}
            type="image/webp"
            media="(min-width: 769px)"
            fetchPriority="high"
          />
        </>
      ) : null}
      <GlassStorefront initialCatalog={catalog} heroBanners={heroBanners} />
    </>
  )
}
