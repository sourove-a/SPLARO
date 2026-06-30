'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { HeroBanner } from '@/lib/api/banners'
import { cn } from '@/lib/utils/cn'
import { HERO_DEFAULT_SLIDES, HERO_DEFAULT_VIDEO } from '@splaro/config'

const SLIDE_DURATION_MS = 5500

/** Override via NEXT_PUBLIC_HERO_VIDEO */
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO?.trim() || HERO_DEFAULT_VIDEO

export interface HeroSlide {
  id: string
  image: string
  video?: string
  eyebrow: string
  title: string
  subtitle: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
  stats: { strong: string; span: string }[]
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url.trim())
}

function heroImageSrc(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || isVideoUrl(trimmed)) return trimmed
  if (!trimmed.includes('images.unsplash.com')) return trimmed
  const base = trimmed.split('?')[0]!
  return `${base}?w=2400&h=1350&fit=crop&crop=center&q=85&auto=format`
}

function videoMimeType(url: string): string {
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm'
  if (/\.ogg(\?|$)/i.test(url)) return 'video/ogg'
  return 'video/mp4'
}

const HERO_VIDEO_POSTER = heroImageSrc(
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
)

const DEFAULT_STATS: HeroSlide['stats'] = [
  { strong: 'Since', span: '2026' },
  { strong: 'Premium', span: 'Quality' },
  { strong: 'Fast', span: 'Delivery' },
]

const FALLBACK_SLIDES: HeroSlide[] = HERO_DEFAULT_SLIDES.map((slide, index) => ({
  id: slide.key,
  image: heroImageSrc(slide.image),
  ...(slide.video || index === 0 ? { video: slide.video ?? HERO_VIDEO } : {}),
  eyebrow: slide.eyebrow,
  title: slide.title,
  subtitle: slide.subtitle,
  primaryHref: slide.linkUrl,
  primaryLabel: 'Shop Now',
  secondaryHref: slide.secondaryLinkUrl,
  secondaryLabel: 'View Collection',
  stats: DEFAULT_STATS,
}))

const fadeEase = [0.22, 1, 0.36, 1] as const

function mapBannerToSlide(banner: HeroBanner, index: number): HeroSlide {
  const media = banner.image?.trim() || ''
  const isVideo = isVideoUrl(media)
  const title = banner.title?.trim() || 'Elegance That Moves With You.'
  const subtitle =
    banner.subtitle?.trim() || 'Premium fashion crafted for timeless everyday luxury.'
  const href = banner.linkUrl?.trim() || '/shop'
  const videoSrc = isVideo ? media : index === 0 ? HERO_VIDEO : ''

  return {
    id: banner.id,
    image: isVideo ? HERO_VIDEO_POSTER : heroImageSrc(media),
    ...(videoSrc ? { video: videoSrc } : {}),
    eyebrow: index === 0 ? 'SPLARO WOMEN COLLECTION' : subtitle || title,
    title,
    subtitle,
    primaryHref: href,
    primaryLabel: 'Shop Now',
    secondaryHref: '/collections',
    secondaryLabel: 'View Collection',
    stats: DEFAULT_STATS,
  }
}

interface HeroSliderProps {
  initialBanners?: HeroBanner[]
}

const HERO_MEDIA_STYLE = {
  objectFit: 'cover' as const,
  objectPosition: 'center center',
}

function HeroBackground({
  slide,
  isActive,
  priority,
}: {
  slide: HeroSlide
  isActive: boolean
  priority: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    setVideoFailed(false)
  }, [slide.video])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !slide.video || videoFailed) return

    if (isActive) {
      video.currentTime = 0
      void video.play().catch(() => setVideoFailed(true))
      return
    }

    video.pause()
  }, [isActive, slide.video, videoFailed])

  if (slide.video && !videoFailed) {
    return (
      <video
        ref={videoRef}
        className="hero-bg-video"
        style={HERO_MEDIA_STYLE}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        poster={slide.image}
        aria-hidden={!isActive}
        onCanPlay={(event) => {
          if (!isActive) return
          void event.currentTarget.play().catch(() => setVideoFailed(true))
        }}
        onError={() => setVideoFailed(true)}
      >
        <source src={slide.video} type={videoMimeType(slide.video)} />
      </video>
    )
  }

  return (
    <StorefrontImage
      src={slide.image}
      alt=""
      profile="hero"
      fill
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      className="hero-bg-image"
      style={HERO_MEDIA_STYLE}
      draggable={false}
    />
  )
}

export function HeroSlider({ initialBanners = [] }: HeroSliderProps) {
  const slides = useMemo(() => {
    const mapped = initialBanners.map(mapBannerToSlide)
    return mapped.length ? mapped : FALLBACK_SLIDES
  }, [initialBanners])

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const slide = slides[Math.min(index, slides.length - 1)]!

  const goTo = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length)
  }, [slides.length])

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, SLIDE_DURATION_MS)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  return (
    <section
      className="home-hero-slider"
      data-section="hero"
      aria-label="Hero carousel"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
    >
      <div className="home-hero-slider__stage">
        {slides.map((item, slideIndex) => {
          const isActive = slideIndex === index

          return (
            <motion.article
              key={item.id}
              className="hero-slide"
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: 0.85, ease: fadeEase }}
              aria-hidden={!isActive}
              style={{ pointerEvents: isActive ? 'auto' : 'none' }}
            >
              <div className="hero-slide__media">
                {(isActive || slideIndex === (index + 1) % slides.length) && (
                  <HeroBackground slide={item} isActive={isActive} priority={slideIndex === 0} />
                )}
              </div>
              <div className="hero-overlay" aria-hidden />

              <div className="hero-content">
                <p className="hero-eyebrow">{item.eyebrow}</p>
                <h1>{item.title}</h1>
                <p className="hero-subtitle">{item.subtitle}</p>

                <div className="hero-actions">
                  <Link href={item.primaryHref} className="hero-btn hero-btn-primary">
                    {item.primaryLabel}
                  </Link>
                  <Link href={item.secondaryHref} className="hero-btn hero-btn-secondary">
                    {item.secondaryLabel}
                  </Link>
                </div>

                <div className="hero-stats">
                  {item.stats.map((stat) => (
                    <div key={`${stat.strong}-${stat.span}`}>
                      <strong>{stat.strong}</strong>
                      <span>{stat.span}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>

      <div className="hero-slider-controls" aria-hidden={slides.length <= 1}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={i === index ? 'hero-dot active' : 'hero-dot'}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
        <div className="hero-progress" aria-hidden>
          <div
            key={`progress-${index}`}
            className={cn('hero-progress-fill', paused && 'hero-progress-fill--paused')}
          />
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {slide.title}
      </span>
    </section>
  )
}
