'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { cn } from '@/lib/utils/cn'
import { HERO_DEFAULT_VIDEO, HERO_DEFAULT_VIDEO_MOBILE } from '@splaro/config'

const SLIDE_DURATION_MS = 5500

/** Override via NEXT_PUBLIC_HERO_VIDEO — cinematic background on first slide */
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO?.trim() || HERO_DEFAULT_VIDEO
const HERO_VIDEO_MOBILE =
  process.env.NEXT_PUBLIC_HERO_VIDEO_MOBILE?.trim() || HERO_DEFAULT_VIDEO_MOBILE || HERO_VIDEO

export interface HeroSlide {
  id: string
  image: string
  video?: string
  /** Lighter rendition served to viewports ≤ 768px. */
  videoMobile?: string
  eyebrow: string
  title: string
  subtitle: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url.trim())
}

function heroImageSrc(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || isVideoUrl(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (!trimmed.includes('images.unsplash.com')) return trimmed
  const base = trimmed.split('?')[0]!
  return `${base}?w=1200&h=675&fit=crop&crop=center&q=85&auto=format`
}

function videoMimeType(url: string): string {
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm'
  if (/\.ogg(\?|$)/i.test(url)) return 'video/ogg'
  return 'video/mp4'
}

/** For Pexels-hosted videos, derive the lightweight 540p rendition for mobile. */
function mobileVideoFallback(url: string): string | undefined {
  if (!url.includes('videos.pexels.com')) return undefined
  const swapped = url.replace(/(uhd|hd)_\d+_\d+_(\d+fps)/, 'sd_960_540_$2')
  return swapped !== url ? swapped : undefined
}

/** Mobile rendition for a DB video banner: explicit mobileImage video, else Pexels swap. */
function bannerVideoMobile(banner: HeroBanner, media: string): { videoMobile?: string } {
  const explicit = banner.mobileImage?.trim()
  const mobile = explicit && isVideoUrl(explicit) ? explicit : mobileVideoFallback(media)
  return mobile ? { videoMobile: mobile } : {}
}

function mapBannerToSlide(banner: HeroBanner, index: number): HeroSlide {
  const media = banner.image?.trim() || ''
  const isVideo = isVideoUrl(media)
  const title = banner.title?.trim() || 'SPLARO'
  const subtitle = banner.subtitle?.trim() || 'Premium fashion crafted for timeless everyday luxury.'
  const href = banner.linkUrl?.trim() || '/shop'

  return {
    id: banner.id,
    image: isVideo ? '/images/logo/splaro-logo-white.svg' : heroImageSrc(media),
    ...(isVideo
      ? { video: media, ...bannerVideoMobile(banner, media) }
      : index === 0 && HERO_VIDEO
        ? { video: HERO_VIDEO, videoMobile: HERO_VIDEO_MOBILE }
        : {}),
    eyebrow: index === 0 ? 'SPLARO COLLECTION' : subtitle || title,
    title,
    subtitle,
    primaryHref: href,
    primaryLabel: 'Shop Now',
    secondaryHref: '/collections',
    secondaryLabel: 'View Collection',
  }
}

interface HeroSliderProps {
  initialBanners?: HeroBanner[]
}

const HERO_MEDIA_STYLE = {
  objectFit: 'cover' as const,
  objectPosition: 'center center',
}

function useAllowHeroVideo(): boolean {
  const [allow, setAllow] = useState(true)

  useEffect(() => {
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = () => {
      setAllow(!saveData && !reducedMotion.matches)
    }
    update()
    reducedMotion.addEventListener('change', update)
    return () => reducedMotion.removeEventListener('change', update)
  }, [])

  return allow
}

/** ≤768px → serve the lighter mobile rendition. */
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function HeroBackground({
  slide,
  isActive,
  priority,
  allowVideo,
}: {
  slide: HeroSlide
  isActive: boolean
  priority: boolean
  allowVideo: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const isMobile = useIsMobileViewport()
  const videoSrc = isMobile && slide.videoMobile ? slide.videoMobile : slide.video

  useEffect(() => {
    setVideoFailed(false)
  }, [videoSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc || videoFailed) return

    if (isActive) {
      video.currentTime = 0
      void video.play().catch(() => setVideoFailed(true))
      return
    }

    video.pause()
  }, [isActive, videoSrc, videoFailed])

  if (videoSrc && !videoFailed && allowVideo && isActive) {
    return (
      <video
        key={videoSrc}
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
        <source src={videoSrc} type={videoMimeType(videoSrc)} />
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
  const slides = useMemo(() => initialBanners.map(mapBannerToSlide), [initialBanners])
  const slidesSignature = useMemo(() => slides.map((s) => s.id).join('|'), [slides])

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const allowVideo = useAllowHeroVideo()
  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))]

  const goTo = useCallback(
    (next: number) => {
      if (!slides.length) return
      setIndex(((next % slides.length) + slides.length) % slides.length)
    },
    [slides.length],
  )

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    setIndex(0)
  }, [slidesSignature])

  useEffect(() => {
    if (paused || slides.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, SLIDE_DURATION_MS)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  if (!slides.length || !slide) {
    return (
      <section className="home-hero-slider home-hero-slider--empty" data-section="hero" aria-label="Hero">
        <div className="home-hero-slider__stage">
          <div className="hero-content">
            <p className="hero-eyebrow">SPLARO</p>
            <h1>Premium Everyday Luxury.</h1>
            <p className="hero-subtitle">Discover curated fashion for Bangladesh.</p>
            <div className="hero-actions">
              <Link href="/shop" className="hero-btn hero-btn-primary">
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="home-hero-slider"
      data-section="hero"
      data-slider-ready={ready ? 'true' : undefined}
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
            <article
              key={item.id}
              className="hero-slide"
              data-active={isActive ? 'true' : 'false'}
              aria-hidden={!isActive}
              style={{ pointerEvents: isActive ? 'auto' : 'none' }}
            >
              <div className="hero-slide__media">
                {(isActive || slideIndex === (index + 1) % slides.length) && (
                  <HeroBackground
                    slide={item}
                    isActive={isActive}
                    priority={slideIndex === 0}
                    allowVideo={allowVideo}
                  />
                )}
              </div>
              <div className="hero-overlay" aria-hidden />

              {isActive ? (
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
                </div>
              ) : null}
            </article>
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
