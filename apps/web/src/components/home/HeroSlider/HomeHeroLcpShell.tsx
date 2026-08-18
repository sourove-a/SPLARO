'use client'

import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { heroSlideCopy } from '@/lib/api/hero-banners'
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
  const copy = heroSlideCopy(slide)
  const hasCopy = Boolean(copy.title || copy.subtitle)

  const media = (
    <>
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
      {hasCopy ? (
        <div className="hero-content">
          {copy.title ? <h1>{copy.title}</h1> : null}
          {copy.subtitle ? <p className="hero-subtitle">{copy.subtitle}</p> : null}
        </div>
      ) : null}
    </>
  )

  return (
    <section
      className="home-hero-slider"
      data-section="hero"
      data-hero-shell="true"
      aria-label="Hero carousel"
    >
      <div className="home-hero-slider__stage">
        <article className="hero-slide" data-active="true" data-hero-copy={hasCopy ? 'on' : 'none'}>
          {copy.href ? (
            <Link
              href={copy.href}
              className="hero-slide__link"
              aria-label={copy.title ? `${copy.title} — explore collection` : 'Hero slide'}
            >
              {media}
            </Link>
          ) : (
            <div className="hero-slide__link">{media}</div>
          )}
        </article>
      </div>
    </section>
  )
}
