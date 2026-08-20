import { Suspense } from 'react'
import '@/styles/pages/home.css'
import '@/styles/pages/shop.css'
import { BrandStorySection } from '@/components/home/BrandStory'
import { GlassStorefront } from '@/components/home/GlassStorefront'
import { HeroSlider } from '@/components/home/HeroSlider'
import { fetchHeroBanners } from '@/lib/api/banners'
import { resolveHeroBanners } from '@/lib/api/hero-banners'
import { resolveLocalHeroVariants } from '@/lib/assets/hero-cdn'
import { classifyHeroMedia } from '@splaro/config'
import { getHomepageDepartmentRows } from '@/lib/catalog/homepage-department-rows'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { resolveDefaultStorefrontMeta } from '@/lib/seo/default-meta'
import {
  EMPTY_HOMEPAGE_REVIEWS,
  getHomepageReviews,
} from '@/lib/server/storefront-reviews'
import { resolveHomepageSections, resolveHomepageSectionOrder, resolveOurStory } from '@/lib/storefront/homepage-defaults'
import { getStorefrontSettings } from '@/lib/storefront/settings'

export async function generateMetadata() {
  const { title, description } = await resolveDefaultStorefrontMeta()
  return createRouteMetadata({
    title,
    description,
    path: '/',
  })
}

export const revalidate = 60

async function HomeCatalog({
  heroBanners,
  includeHero,
}: {
  heroBanners: Awaited<ReturnType<typeof resolveHeroBanners>>
  includeHero: boolean
}) {
  const settings = await getStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const story = resolveOurStory(settings.config.ourStory)
  const showStory = homepage.ourStory && story.enabled

  const [departmentRows, reviews] = await Promise.all([
    homepage.catalog
      ? getHomepageDepartmentRows(
          settings.config.catalogChannels,
          settings.config.headerNav,
          settings.config.homepageCatalog,
        )
      : Promise.resolve([]),
    showStory && story.customerStories.enabled
      ? getHomepageReviews(3)
      : Promise.resolve(EMPTY_HOMEPAGE_REVIEWS),
  ])

  return (
    <GlassStorefront
      departmentRows={departmentRows}
      heroBanners={heroBanners}
      showHero={includeHero}
      storySlot={
        showStory ? (
          <BrandStorySection key="home-brand-story" story={story} reviews={reviews} />
        ) : null
      }
    />
  )
}

export default async function HomePage() {
  const settings = await getStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const heroBanners = homepage.hero ? resolveHeroBanners(await fetchHeroBanners()) : []
  const heroFirst = homepage.hero && resolveHomepageSectionOrder(homepage.order)[0] === 'hero'
  const firstMedia = heroBanners[0]?.image ?? ''
  const firstClassified = classifyHeroMedia(firstMedia)
  const lcpSource =
    firstClassified.kind === 'image'
      ? firstMedia
      : (firstClassified.poster ?? heroBanners[0]?.mobileImage ?? '')
  const lcp = heroBanners.length ? resolveLocalHeroVariants(lcpSource) : null

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
      {heroFirst && heroBanners.length ? (
        <HeroSlider
          key={heroBanners
            .map((banner) => `${banner.id}:${banner.image}:${banner.title ?? ''}:${banner.subtitle ?? ''}`)
            .join('|')}
          initialBanners={heroBanners}
        />
      ) : null}
      <Suspense fallback={null}>
        <HomeCatalog heroBanners={heroBanners} includeHero={!heroFirst} />
      </Suspense>
    </>
  )
}
