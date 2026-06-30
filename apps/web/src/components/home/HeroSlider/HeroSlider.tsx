'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HeroBanner } from '@/lib/api/banners'

export interface HeroSlide {
  id: string
  image: string
  mobileImage: string
  badge: string
  title: string
  sub: string
  href: string
  label: string
}

const HERO_IMAGE_SIZES = '(max-width: 639px) 100vw, 1920px'
const HERO_MOBILE_CROP = 'w=900&h=1200&fit=crop&crop=center&q=85&auto=format'
const HERO_DESKTOP_CROP = 'w=1920&h=760&fit=crop&crop=center&q=85&auto=format'

type HeroImageVariant = 'desktop' | 'mobile'

function heroImageSrc(url: string, variant: HeroImageVariant = 'desktop'): string {
  if (!url.includes('images.unsplash.com')) return url
  const base = url.split('?')[0]!
  const crop = variant === 'mobile' ? HERO_MOBILE_CROP : HERO_DESKTOP_CROP
  return `${base}?${crop}`
}

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: 'summer',
    image: heroImageSrc('https://images.unsplash.com/photo-1490481651871-ab68de25d43d'),
    mobileImage: heroImageSrc('https://images.unsplash.com/photo-1490481651871-ab68de25d43d', 'mobile'),
    badge: 'Summer Edition — 2026',
    title: 'Dress the warmth.',
    sub: 'Light fabrics, golden hours, effortless grace.',
    href: '/c/summer-edition',
    label: 'Summer drop',
  },
  {
    id: 'women',
    image: heroImageSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f'),
    mobileImage: heroImageSrc('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f', 'mobile'),
    badge: 'Women',
    title: 'New season styles.',
    sub: 'Editorial silhouettes for every occasion.',
    href: '/c/women',
    label: 'Shop women',
  },
  {
    id: 'men',
    image: heroImageSrc('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d'),
    mobileImage: heroImageSrc('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d', 'mobile'),
    badge: 'Men',
    title: 'Sharp & refined.',
    sub: 'Premium tailoring meets everyday comfort.',
    href: '/c/men',
    label: 'Shop men',
  },
]

const slideEase = [0.22, 1, 0.36, 1] as const

function mapBannerToSlide(banner: HeroBanner): HeroSlide {
  const title = banner.title?.trim() || 'New collection'
  const sub = banner.subtitle?.trim() || ''
  const href = banner.linkUrl?.trim() || '/shop'

  return {
    id: banner.id,
    image: heroImageSrc(banner.image, 'desktop'),
    mobileImage: heroImageSrc(banner.image, 'mobile'),
    badge: sub || title,
    title,
    sub,
    href,
    label: `Shop ${title.toLowerCase()}`,
  }
}

interface HeroSliderProps {
  initialBanners?: HeroBanner[]
}

export function HeroSlider({ initialBanners = [] }: HeroSliderProps) {
  const slides = useMemo(() => {
    const mapped = initialBanners.map(mapBannerToSlide)
    return mapped.length ? mapped : FALLBACK_SLIDES
  }, [initialBanners])

  const [index, setIndex] = useState(0)
  const slide = slides[Math.min(index, slides.length - 1)]!

  const next = useCallback(
    () => setIndex((i) => (i + 1) % slides.length),
    [slides.length],
  )
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + slides.length) % slides.length),
    [slides.length],
  )

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    const timer = window.setInterval(next, 6000)
    return () => window.clearInterval(timer)
  }, [next])

  return (
    <section className="hero-slider-frame" data-section="hero" aria-label="Hero carousel" aria-roledescription="carousel">
      <div className="hero-slider-viewport">
        <motion.div
          className="hero-slider-track"
          animate={{ x: `-${index * 100}%` }}
          transition={{ duration: 0.72, ease: slideEase }}
        >
          {slides.map((item, slideIndex) => {
            const isActive = slideIndex === index
            const isNext = slideIndex === (index + 1) % slides.length
            const shouldLoadImage = isActive || isNext

            return (
            <article key={item.id} className="hero-slider-slide" aria-hidden={!isActive}>
              {shouldLoadImage ? (
                // One landscape image for every breakpoint — mobile mirrors desktop.
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  priority={isActive && slideIndex === 0}
                  loading={isActive ? 'eager' : 'lazy'}
                  sizes={HERO_IMAGE_SIZES}
                  className="hero-slide-image"
                  draggable={false}
                />
              ) : (
                <div className="hero-slide-image absolute inset-0 bg-[#e8e4de]" aria-hidden />
              )}
              <div className="hero-slide-gradient" />

              <div className="hero-slide-content">
                <span className="hero-slide-badge">{item.badge}</span>
                <h1 className="hero-slide-title">{item.title}</h1>
                <p className="hero-slide-sub">{item.sub}</p>
                <Link href={item.href} className="hero-slide-cta">
                  {item.label}
                </Link>
              </div>
            </article>
            )
          })}
        </motion.div>
      </div>

      <div className="hero-slide-arrows">
        <button
          type="button"
          className="splaro-nav-btn splaro-nav-btn--glass-dark splaro-nav-btn--prev"
          onClick={prev}
          aria-label="Previous slide"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="splaro-nav-btn splaro-nav-btn--glass-dark splaro-nav-btn--next"
          onClick={next}
          aria-label="Next slide"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="hero-slide-dots">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={i === index ? 'hero-slide-dot hero-slide-dot--active' : 'hero-slide-dot'}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        {slide.title}
      </span>
    </section>
  )
}
