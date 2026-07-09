'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { HeroSlider } from '@/components/home/HeroSlider'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { TrustBar } from '@/components/home/TrustBar'
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useMobileViewport } from '@/lib/hooks/use-mobile-viewport'
import { type Category } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { HeroBanner } from '@/lib/api/banners'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'

const SpecialOffer = dynamic(
  () => import('@/components/home/SpecialOffer').then((m) => m.SpecialOffer),
  { ssr: false },
)
const ShopCatalog = dynamic(
  () => import('@/components/shop/ShopCatalog').then((m) => m.ShopCatalog),
  { ssr: false },
)

const WhySplaro = dynamic(
  () => import('@/components/home/WhySplaro').then((m) => m.WhySplaro),
  { ssr: false },
)
const NewsletterSection = dynamic(
  () =>
    import('@/components/home/NewsletterSection/NewsletterSection').then(
      (m) => m.NewsletterSection,
    ),
  { ssr: false },
)

interface GlassStorefrontProps {
  initialCatalog?: CachedCatalog
  heroBanners?: HeroBanner[]
}

export function GlassStorefront({ initialCatalog, heroBanners = [] }: GlassStorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const isMobile = useMobileViewport()
  const settings = useStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const showNewsletter = homepage.newsletter && (settings.config.newsletter?.enabled ?? true)

  return (
    <>
      {homepage.hero ? <HeroSlider initialBanners={heroBanners} /> : null}

      {homepage.marquee || homepage.trustBar ? (
        <div className="home-post-hero">
          {homepage.marquee ? <MarqueeStrip /> : null}
          {homepage.trustBar ? <TrustBar /> : null}
        </div>
      ) : null}

      <div className="ed-root">
      {homepage.specialOffer ? (
        <DeferUntilVisible minHeight={320} eager={!isMobile}>
          <SpecialOffer />
        </DeferUntilVisible>
      ) : null}

      {homepage.catalog ? (
        <DeferUntilVisible minHeight={560} eager={!isMobile}>
          <section className="ed-catalog-intro ed-defer-section" aria-label="Shop catalog">
            <div className="ed-catalog-intro__ambient" aria-hidden />
            <div className="ed-catalog">
                <div className="ed-catalog__header">
                  <div className="ed-catalog__header-inner">
                    <div>
                      <p className="ed-tiles__eyebrow">SPLARO EDIT</p>
                      <h2 className="ed-catalog__title">Curated for You</h2>
                      <p className="ed-catalog__lede">A refined selection of timeless essentials.</p>
                    </div>
                    <Link href="/shop" className="ed-catalog__view-all">
                      View all
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
                <ShopCatalog
                  category={activeCategory}
                  onCategoryChange={setActiveCategory}
                  showStickyBar={false}
                  layout="homepage"
                  {...(initialCatalog ? { initialCatalog } : {})}
                />
            </div>
          </section>
        </DeferUntilVisible>
      ) : null}

      {homepage.ourStory ? (
        <DeferUntilVisible minHeight={420} eager={!isMobile}>
          <WhySplaro />
        </DeferUntilVisible>
      ) : null}

      {showNewsletter ? (
        <DeferUntilVisible minHeight={280} eager={!isMobile}>
          <NewsletterSection />
        </DeferUntilVisible>
      ) : null}
      </div>
    </>
  )
}
