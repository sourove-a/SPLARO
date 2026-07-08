'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { LiquidGlassNavButton } from '@/components/ui/LiquidGlass/LiquidGlassNavButton'
import { cn } from '@/lib/utils/cn'
import { HERO_DEFAULT_SLIDES, HERO_DEFAULT_VIDEO, HERO_DEFAULT_VIDEO_MOBILE } from '@splaro/config'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'

const SLIDE_DURATION_MS = 7500
// Must match --hero-swipe in globals.css — this is the lock window that blocks
// re-triggering a transition mid-animation. Kept snappy (was 2000ms, felt janky).
const SWIPE_MS = 850

type SlideDirection = 'forward' | 'backward'

function slideDirection(from: number, to: number, total: number): SlideDirection {
  if (from === to || total <= 1) return 'forward'
  const forward = (to - from + total) % total
  const backward = (from - to + total) % total
  return forward <= backward ? 'forward' : 'backward'
}

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
  return `${base}?w=1920&h=1080&fit=crop&crop=center&q=90&auto=format`
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

function isBrandLogoPoster(url: string) {
  return /splaro-logo-(white|dark)\.svg/i.test(url.trim())
}

/** Prefer HD/1080p renditions — admin may store the 31MB UHD Pexels URL. */
function normalizeHeroVideoUrl(url: string): { video: string; videoMobile?: string } {
  const mobile = mobileVideoFallback(url)
  const video = url.includes('uhd_2560_1440')
    ? url.replace('uhd_2560_1440', 'hd_1920_1080')
    : url
  return mobile ? { video, videoMobile: mobile } : { video }
}

function resolveSlideVideo(media: string, index: number) {
  // Only autoplay a background video when THIS slide's own media is a video URL,
  // or when an explicit NEXT_PUBLIC_HERO_VIDEO override is set. Previously the
  // heavy default Pexels clip was force-played on slide 0 regardless of the
  // slide's real image — an ocean video behind a sneaker, plus ~12MB of lag.
  if (isVideoUrl(media)) return normalizeHeroVideoUrl(media)
  if (index === 0 && process.env.NEXT_PUBLIC_HERO_VIDEO?.trim()) {
    return { video: HERO_VIDEO, videoMobile: HERO_VIDEO_MOBILE }
  }
  return {}
}

function resolveSlidePoster(media: string, index: number, banner: HeroBanner) {
  if (!isVideoUrl(media)) return heroImageSrc(media)

  const mobilePoster = banner.mobileImage?.trim()
  if (mobilePoster && !isVideoUrl(mobilePoster)) return heroImageSrc(mobilePoster)

  const defaultPoster = HERO_DEFAULT_SLIDES[index]?.image ?? HERO_DEFAULT_SLIDES[0]?.image
  return defaultPoster ? heroImageSrc(defaultPoster) : ''
}

function resolveSlideEyebrow(banner: HeroBanner, index: number, subtitle: string): string {
  const fromDefaults = HERO_DEFAULT_SLIDES[index]?.eyebrow
  if (fromDefaults) return fromDefaults

  const collectionMatch = subtitle.match(/^(.+?)\s+collection$/i)
  if (collectionMatch?.[1]) {
    return `${collectionMatch[1].trim().toUpperCase()} COLLECTION`
  }

  const href = banner.linkUrl?.trim() || ''
  const segments = href.split('/').filter(Boolean)
  const segment = segments[0] === 'c' && segments[1] ? segments[1] : segments[segments.length - 1]
  if (segment && !['shop', 'products', 'collections'].includes(segment)) {
    const label = segment.replace(/[-_]+/g, ' ').trim()
    if (label.length > 0 && label.length <= 40) return label.toUpperCase()
  }

  const ROTATING = ['SPLARO COLLECTION', 'FEATURED EDIT', 'NEW SEASON', 'CURATED PICKS'] as const
  return ROTATING[index % ROTATING.length]!
}

function mapBannerToSlide(banner: HeroBanner, index: number): HeroSlide {
  const media = banner.image?.trim() || ''
  const title = banner.title?.trim() || 'SPLARO'
  const subtitle = banner.subtitle?.trim() || 'Premium fashion crafted for timeless everyday luxury.'
  const href = banner.linkUrl?.trim() || '/shop'
  const poster = resolveSlidePoster(media, index, banner)
  const videoConfig = resolveSlideVideo(media, index)

  return {
    id: banner.id,
    image: poster,
    ...videoConfig,
    eyebrow: resolveSlideEyebrow(banner, index, subtitle),
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function warmHeroSlideMedia(slides: HeroSlide[]) {
  if (typeof window === 'undefined') return

  for (const slide of slides) {
    if (slide.image.trim() && !isBrandLogoPoster(slide.image)) {
      const img = new window.Image()
      img.decoding = 'async'
      img.src = optimizeImageSrc(slide.image, 'hero')
    }
  }
}

function warmHeroVideo(url: string) {
  if (typeof window === 'undefined' || !url) return
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = url
  video.load()
}

function HeroStaticBackdrop({
  src,
  priority,
  eager,
}: {
  src: string
  priority: boolean
  eager?: boolean
}) {
  if (!src.trim() || isBrandLogoPoster(src)) {
    return <div className="hero-bg-fallback" aria-hidden />
  }

  return (
    <StorefrontImage
      src={src}
      alt=""
      profile="hero"
      fill
      priority={priority}
      loading={priority || eager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className="hero-bg-image"
      withBlur={false}
      style={HERO_MEDIA_STYLE}
      draggable={false}
    />
  )
}

function HeroBackground({
  slide,
  isActive,
  priority,
  allowVideo,
  preloadVideo,
}: {
  slide: HeroSlide
  isActive: boolean
  priority: boolean
  allowVideo: boolean
  preloadVideo: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const isMobile = useIsMobileViewport()
  const videoSrc = isMobile && slide.videoMobile ? slide.videoMobile : slide.video
  const poster =
    slide.image.trim() && !isBrandLogoPoster(slide.image) ? slide.image : undefined
  const mountVideo = Boolean(videoSrc && !videoFailed && allowVideo && (isActive || preloadVideo))

  useEffect(() => {
    setVideoFailed(false)
    setVideoReady(false)
  }, [videoSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc || videoFailed || !mountVideo) return

    if (isActive) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        video.load()
      }
      void video.play().catch(() => setVideoFailed(true))
      return
    }

    video.pause()
  }, [isActive, videoSrc, videoFailed, mountVideo])

  return (
    <>
      <HeroStaticBackdrop src={slide.image} priority={priority} eager />
      {mountVideo ? (
        <video
          ref={videoRef}
          className={cn('hero-bg-video', videoReady && isActive && 'hero-bg-video--ready')}
          style={HERO_MEDIA_STYLE}
          muted
          loop
          playsInline
          preload={isActive || priority ? 'auto' : 'metadata'}
          disablePictureInPicture
          controls={false}
          {...(poster ? { poster } : {})}
          aria-hidden={!isActive}
          onPlaying={() => setVideoReady(true)}
          onCanPlay={(event) => {
            if (!isActive) return
            setVideoReady(true)
            void event.currentTarget.play().catch(() => setVideoFailed(true))
          }}
          onError={() => setVideoFailed(true)}
        >
          <source src={videoSrc} type={videoMimeType(videoSrc!)} />
        </video>
      ) : null}
    </>
  )
}

export function HeroSlider({ initialBanners = [] }: HeroSliderProps) {
  const slides = useMemo(() => initialBanners.map(mapBannerToSlide), [initialBanners])
  const slidesSignature = useMemo(() => slides.map((s) => s.id).join('|'), [slides])

  const [index, setIndex] = useState(0)
  const [exitIndex, setExitIndex] = useState<number | null>(null)
  const [direction, setDirection] = useState<SlideDirection>('forward')
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const allowVideo = useAllowHeroVideo()
  const indexRef = useRef(index)
  const exitTimerRef = useRef<number | undefined>(undefined)
  const autoplayIntervalRef = useRef<number | undefined>(undefined)
  const transitioningRef = useRef(false)
  const pendingIndexRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const prefersHoverPauseRef = useRef(true)
  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))]
  const isTransitioning = exitIndex !== null

  indexRef.current = index

  const clearAutoplayTimer = useCallback(() => {
    window.clearInterval(autoplayIntervalRef.current)
    autoplayIntervalRef.current = undefined
  }, [])

  const transitionToRef = useRef<(next: number) => void>(() => {})

  const resetAutoplayTimer = useCallback(() => {
    clearAutoplayTimer()
    if (paused || slides.length <= 1) return
    autoplayIntervalRef.current = window.setInterval(() => {
      transitionToRef.current((indexRef.current + 1) % slides.length)
    }, SLIDE_DURATION_MS)
  }, [clearAutoplayTimer, paused, slides.length])

  const transitionTo = useCallback(
    (next: number) => {
      if (!slides.length) return
      const normalized = ((next % slides.length) + slides.length) % slides.length
      const current = indexRef.current

      if (transitioningRef.current) {
        pendingIndexRef.current = normalized
        return
      }
      if (normalized === current) return

      transitioningRef.current = true
      pendingIndexRef.current = null
      setInteracted(true)
      setDirection(slideDirection(current, normalized, slides.length))
      setExitIndex(current)
      setIndex(normalized)
      resetAutoplayTimer()

      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = window.setTimeout(() => {
        setExitIndex(null)
        transitioningRef.current = false

        const pending = pendingIndexRef.current
        pendingIndexRef.current = null
        if (pending !== null && pending !== indexRef.current) {
          window.requestAnimationFrame(() => transitionToRef.current(pending))
        }
      }, SWIPE_MS)
    },
    [resetAutoplayTimer, slides.length],
  )

  transitionToRef.current = transitionTo

  const goTo = useCallback(
    (next: number) => {
      transitionTo(next)
    },
    [transitionTo],
  )

  const goPrev = useCallback(() => {
    transitionTo(indexRef.current - 1)
  }, [transitionTo])

  const goNext = useCallback(() => {
    transitionTo(indexRef.current + 1)
  }, [transitionTo])

  useEffect(() => {
    setReady(true)
    prefersHoverPauseRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }, [])

  useEffect(() => {
    warmHeroSlideMedia(slides)
    const first = slides[0]
    if (!first) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const firstVideo =
      (isMobile && first.videoMobile ? first.videoMobile : first.video) ?? ''
    if (firstVideo) warmHeroVideo(firstVideo)
  }, [slidesSignature, slides])

  useEffect(() => {
    if (!slides.length) return
    const nextIndex = (index + 1) % slides.length
    const nextSlide = slides[nextIndex]
    if (!nextSlide) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const nextVideo =
      (isMobile && nextSlide.videoMobile ? nextSlide.videoMobile : nextSlide.video) ?? ''
    if (nextVideo) warmHeroVideo(nextVideo)
  }, [index, slides])

  useEffect(() => {
    setIndex(0)
    setExitIndex(null)
    setDirection('forward')
    transitioningRef.current = false
    pendingIndexRef.current = null
  }, [slidesSignature])

  useEffect(() => {
    return () => {
      window.clearTimeout(exitTimerRef.current)
      clearAutoplayTimer()
    }
  }, [clearAutoplayTimer])

  useEffect(() => {
    resetAutoplayTimer()
    return clearAutoplayTimer
  }, [resetAutoplayTimer, clearAutoplayTimer])

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const start = touchStartRef.current
      const touch = event.changedTouches[0]
      touchStartRef.current = null
      if (!start || !touch || slides.length <= 1) return

      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y
      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return

      setInteracted(true)
      if (deltaX < 0) goNext()
      else goPrev()
    },
    [goNext, goPrev, slides.length],
  )

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
      {...(interacted ? { 'data-slider-interacted': 'true' } : {})}
      data-direction={direction}
      {...(isTransitioning ? { 'data-transitioning': 'true' } : {})}
      aria-label="Hero carousel"
      aria-roledescription="carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => {
        if (prefersHoverPauseRef.current) setPaused(true)
      }}
      onMouseLeave={() => {
        if (prefersHoverPauseRef.current) setPaused(false)
      }}
    >
      <div className="home-hero-slider__stage">
        {slides.map((item, slideIndex) => {
          const isActive = slideIndex === index
          const isExiting = slideIndex === exitIndex
          const slideCount = slides.length
          const preloadVideo =
            isActive ||
            slideIndex === (index + 1) % slideCount ||
            slideIndex === (index - 1 + slideCount) % slideCount

          return (
            <article
              key={item.id}
              className="hero-slide"
              data-active={isActive ? 'true' : 'false'}
              {...(isExiting ? { 'data-exiting': 'true' } : {})}
              aria-hidden={!isActive}
              style={{ pointerEvents: isActive && !isTransitioning ? 'auto' : 'none' }}
            >
              <div className="hero-slide__media">
                <div className="hero-slide__media-shell">
                  <HeroBackground
                    slide={item}
                    isActive={isActive}
                    priority={slideIndex === 0}
                    allowVideo={allowVideo}
                    preloadVideo={preloadVideo}
                  />
                </div>
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
              </div>
            </article>
          )
        })}
      </div>

      {slides.length > 1 ? (
        <div className="hero-slide-arrows home-hero-slider__arrows">
          <LiquidGlassNavButton
            direction="left"
            size="lg"
            variant="glass-dark"
            overlay
            aria-label="Previous slide"
            onClick={goPrev}
          />
          <LiquidGlassNavButton
            direction="right"
            size="lg"
            variant="glass-dark"
            overlay
            aria-label="Next slide"
            onClick={goNext}
          />
        </div>
      ) : null}

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
