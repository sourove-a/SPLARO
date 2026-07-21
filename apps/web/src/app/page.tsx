import { Suspense } from 'react'
import '@/styles/pages/home.css'
import '@/styles/pages/shop.css'
import { BrandStorySection } from '@/components/home/BrandStory'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { HeroSlider } from '@/components/home/HeroSlider'
import { resolveHeroBanners } from '@/lib/api/hero-banners'
import { resolveLocalHeroVariants } from '@/lib/assets/hero-cdn'
import { getHomepageDepartmentRows } from '@/lib/catalog/homepage-department-rows'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import {
  EMPTY_HOMEPAGE_REVIEWS,
  getHomepageReviews,
} from '@/lib/server/storefront-reviews'
import { resolveHomepageSections, resolveOurStory } from '@/lib/storefront/homepage-defaults'
import { getStorefrontSettings } from '@/lib/storefront/settings'

const HOME_DESCRIPTION =
  'Discover SPLARO — quiet luxury fashion for men, women, and kids in Bangladesh. Apparel, footwear, and accessories for everyday elegance.'

export const metadata = createRouteMetadata({
  title: 'SPLARO | Quiet Luxury Fashion',
  description: HOME_DESCRIPTION,
  path: '/',
})

export const revalidate = 60

async function HomeCatalog() {
  const settings = await getStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const story = resolveOurStory(settings.config.ourStory)
  const showStory = homepage.ourStory && story.enabled

  const [departmentRows, reviews] = await Promise.all([
    homepage.catalog
      ? getHomepageDepartmentRows(
          settings.config.catalogChannels,
          settings.config.headerNav,
        )
      : Promise.resolve([]),
    showStory && story.customerStories.enabled
      ? getHomepageReviews(3)
      : Promise.resolve(EMPTY_HOMEPAGE_REVIEWS),
  ])

  return (
    <GlassStorefront
      departmentRows={departmentRows}
      showHero={false}
      storySlot={showStory ? <BrandStorySection story={story} reviews={reviews} /> : null}
    />
  )
}

export default function HomePage() {
  // Curated local WebP defaults do not depend on catalog I/O, so the LCP hero
  // can stream while the below-fold preview resolves.
  const heroBanners = resolveHeroBanners([], [])
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
      <HeroSlider initialBanners={heroBanners} />
      <Suspense fallback={<div className="ed-catalog__loading" aria-hidden style={{ minHeight: 320 }} />}>
        <HomeCatalog />
      </Suspense>
    </>
  )
}
