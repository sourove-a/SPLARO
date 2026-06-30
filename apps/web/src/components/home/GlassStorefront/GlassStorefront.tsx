'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { HeroSlider } from '@/components/home/HeroSlider'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { SpecialOffer } from '@/components/home/SpecialOffer'
import { ShopCatalog } from '@/components/shop/ShopCatalog'
import { TrustBar } from '@/components/home/TrustBar'
import { ScrollReveal, ScrollRevealItem } from '@/components/motion/ScrollReveal'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { type Category } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { HeroBanner } from '@/lib/api/banners'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'
import { usePublishedCollectionTiles } from '@/lib/storefront/catalog-channels'

const WhySplaro = dynamic(
  () => import('@/components/home/WhySplaro').then((m) => m.WhySplaro),
  { ssr: false },
)
const InstagramSection = dynamic(
  () =>
    import('@/components/home/InstagramSection/InstagramSection').then((m) => m.InstagramSection),
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

const COLLECTION_TILES = [
  {
    label: 'Women',
    sub: 'New season styles',
    href: '/c/women',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80&auto=format&fit=crop',
  },
  {
    label: 'Men',
    sub: 'Sharp & refined',
    href: '/c/men',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80&auto=format&fit=crop',
  },
  {
    label: 'Kids',
    sub: 'Festival to everyday',
    href: '/c/kids',
    image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=800&q=80&auto=format&fit=crop',
  },
  {
    label: 'Summer Edit',
    sub: 'SS26 capsule',
    href: '/c/summer-edition',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80&auto=format&fit=crop',
  },
]

export function GlassStorefront({ initialCatalog, heroBanners = [] }: GlassStorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const settings = useStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const showNewsletter = homepage.newsletter && (settings.config.newsletter?.enabled ?? true)
  const collectionTiles = usePublishedCollectionTiles(COLLECTION_TILES)

  return (
    <div className="ed-root">
      {homepage.hero ? <HeroSlider initialBanners={heroBanners} /> : null}

      {homepage.marquee ? (
        <ScrollReveal variant="fadeIn">
          <MarqueeStrip />
        </ScrollReveal>
      ) : null}

      {homepage.specialOffer ? (
        <ScrollReveal variant="fadeUp">
          <SpecialOffer />
        </ScrollReveal>
      ) : null}

      {homepage.collections && collectionTiles.length > 0 ? (
        <ScrollReveal variant="fadeUp">
          <section className="ed-tiles ed-defer-section" aria-label="Collections">
            <div className="ed-tiles__header">
              <div>
                <p className="ed-tiles__eyebrow">Explore</p>
                <h2 className="ed-tiles__title">Shop by collection</h2>
              </div>
            </div>

            <ScrollReveal stagger className="ed-tiles__grid">
              {collectionTiles.map((tile, i) => (
                <ScrollRevealItem key={tile.label} variant="scaleUp">
                  <Link href={tile.href} className="ed-tile group">
                    <div className="ed-tile__img">
                      <Image
                        src={tile.image}
                        alt={tile.label}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        loading={i === 0 ? 'eager' : 'lazy'}
                        className="object-cover object-[center_10%] transition-transform duration-700 group-hover:scale-[1.06]"
                      />
                      <div className="ed-tile__grad" />
                    </div>
                    <div className="ed-tile__info">
                      <p className="ed-tile__sub">{tile.sub}</p>
                      <h3 className="ed-tile__label">{tile.label}</h3>
                      <span className="ed-tile__arrow">
                        <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
                      </span>
                    </div>
                  </Link>
                </ScrollRevealItem>
              ))}
            </ScrollReveal>
          </section>
        </ScrollReveal>
      ) : null}

      {homepage.catalog || homepage.trustBar ? (
        <ScrollReveal variant="fadeUp">
          <section className="ed-catalog-intro ed-defer-section" aria-label="Shop catalog">
            <div className="ed-catalog-intro__ambient" aria-hidden />
            {homepage.trustBar ? <TrustBar /> : null}
            {homepage.catalog ? (
              <div className="ed-catalog">
                <div className="ed-catalog__header">
                  <p className="ed-tiles__eyebrow">SPLARO EDIT</p>
                  <h2 className="ed-catalog__title">Curated for You</h2>
                  <p className="ed-catalog__lede">A refined selection of timeless essentials.</p>
                </div>
                <ShopCatalog
                  category={activeCategory}
                  onCategoryChange={setActiveCategory}
                  showStickyBar={false}
                  {...(initialCatalog ? { initialCatalog } : {})}
                />
              </div>
            ) : null}
          </section>
        </ScrollReveal>
      ) : null}

      {homepage.ourStory ? (
        <ScrollReveal variant="fadeUp">
          <WhySplaro />
        </ScrollReveal>
      ) : null}

      {homepage.instagram ? (
        <ScrollReveal variant="fadeUp">
          <InstagramSection />
        </ScrollReveal>
      ) : null}

      {showNewsletter ? (
        <ScrollReveal variant="fadeIn">
          <NewsletterSection />
        </ScrollReveal>
      ) : null}
    </div>
  )
}
