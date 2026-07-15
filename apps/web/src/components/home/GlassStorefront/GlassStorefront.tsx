'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { HeroSlider } from '@/components/home/HeroSlider'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { TrustBar } from '@/components/home/TrustBar'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { type Category } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { HeroBanner } from '@/lib/api/banners'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

const ShopCatalog = dynamic(
  () => import('@/components/shop/ShopCatalog').then((m) => m.ShopCatalog),
  {
    loading: () => (
      <div className="ed-catalog__loading" aria-hidden style={{ minHeight: 320 }} />
    ),
  },
)

const SpecialOffer = dynamic(
  () => import('@/components/home/SpecialOffer').then((m) => m.SpecialOffer),
)

const NewsletterSection = dynamic(
  () =>
    import('@/components/home/NewsletterSection/NewsletterSection').then(
      (m) => m.NewsletterSection,
    ),
)

interface GlassStorefrontProps {
  initialCatalog?: CachedCatalog
  heroBanners?: HeroBanner[]
}

export function GlassStorefront({
  initialCatalog,
  heroBanners = [],
}: GlassStorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const settings = useStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const offer = settings.config.specialOffer
  const showSpecialOffer =
    Boolean(homepage.specialOffer) &&
    Boolean(offer?.enabled) &&
    Boolean(offer?.title?.trim())
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
        {showSpecialOffer ? (
          <ScrollReveal variant="fadeUp" margin="-40px 0px -40px 0px">
            <SpecialOffer />
          </ScrollReveal>
        ) : null}

        {homepage.catalog ? (
          <section className="ed-catalog-intro ed-defer-section" aria-label="Shop catalog">
            <div className="ed-catalog-intro__ambient" aria-hidden />
            <div className="ed-catalog">
              <ScrollReveal variant="fadeUp" margin="-50px 0px -50px 0px">
                <div className="ed-catalog__header">
                  <div className="ed-catalog__header-inner">
                    <div>
                      <p className="ed-tiles__eyebrow">SPLARO PICKS</p>
                      <h2 className="ed-catalog__title">Our favourite styles</h2>
                      <p className="ed-catalog__lede">Soft, elegant pieces for everyday wear.</p>
                    </div>
                    <Link href="/shop" className="ed-catalog__view-all">
                      View all
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
              <ShopCatalog
                category={activeCategory}
                onCategoryChange={setActiveCategory}
                showStickyBar={false}
                layout="homepage"
                {...(initialCatalog ? { initialCatalog } : {})}
              />
            </div>
          </section>
        ) : null}

        {showNewsletter ? <NewsletterSection /> : null}
      </div>
    </>
  )
}
