'use client'

import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { heroBannersFromDefaults } from '@/lib/api/hero-banners'
import { resolveLocalHeroVariants } from '@/lib/assets/hero-cdn'

/** Static first-slide shell — paints LCP before HeroSlider JS hydrates. */
export function HomeHeroLcpShell({ banners = [] }: { banners?: HeroBanner[] }) {
  const slide = banners[0] ?? heroBannersFromDefaults()[0]
  if (!slide) return null

  const variants = resolveLocalHeroVariants(slide.image)
  const title = slide.title?.trim() || 'Premium Everyday Luxury.'
  const subtitle =
    slide.subtitle?.trim() || 'Discover curated fashion for Bangladesh.'
  const href = slide.linkUrl?.trim() || '/shop'

  return (
    <section
      className="home-hero-slider"
      data-section="hero"
      data-hero-shell="true"
      aria-label="Hero carousel"
    >
      <div className="home-hero-slider__stage">
        <article className="hero-slide" data-active="true">
          <div className="hero-slide__media">
            <div className="hero-slide__media-shell">
              {variants ? (
                <picture>
                  <source
                    media="(max-width: 768px)"
                    srcSet={variants.mobile}
                    type="image/webp"
                  />
                  <img
                    className="hero-bg-image"
                    src={variants.desktop}
                    alt=""
                    width={1600}
                    height={900}
                    sizes="100vw"
                    decoding="async"
                    fetchPriority="high"
                  />
                </picture>
              ) : null}
            </div>
          </div>
          <div className="hero-overlay" aria-hidden />
          <div className="hero-content">
            <p className="hero-eyebrow">SPLARO</p>
            <h1>{title}</h1>
            <p className="hero-subtitle">{subtitle}</p>
            <div className="hero-actions">
              <Link href={href} className="hero-btn hero-btn-primary">
                Shop Now
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
