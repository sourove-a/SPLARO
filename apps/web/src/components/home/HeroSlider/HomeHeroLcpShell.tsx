'use client'

import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { resolveLocalHeroVariants } from '@/lib/assets/hero-cdn'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import { classifyHeroMedia } from '@splaro/config'

/** Static first-slide shell — paints LCP before HeroSlider JS hydrates. */
export function HomeHeroLcpShell({ banners = [] }: { banners?: HeroBanner[] }) {
  const slide = banners[0]
  if (!slide) return null

  const classified = classifyHeroMedia(slide.image)
  const poster =
    classified.kind === 'image'
      ? slide.image
      : (classified.poster ?? slide.mobileImage?.trim() ?? '')
  const variants = resolveLocalHeroVariants(poster)
  const mobileImage = slide.mobileImage?.trim()
    ? optimizeImageSrc(slide.mobileImage.trim(), 'hero', slide.mobileImage.trim(), {
        allowStockMedia: true,
      })
    : variants?.mobile
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
          <Link
            href={href}
            className="hero-slide__link"
            aria-label={`${title} — explore collection`}
          >
            <div className="hero-slide__media">
              <div className="hero-slide__media-shell">
                {variants || mobileImage || poster ? (
                  <picture>
                    {mobileImage ? (
                      <source media="(max-width: 768px)" srcSet={mobileImage} />
                    ) : null}
                    <img
                      className="hero-bg-image"
                      src={variants?.desktop ?? poster}
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
            </div>
          </Link>
        </article>
      </div>
    </section>
  )
}
