'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import type { HeroBanner } from '@/lib/api/banners'
import { LiquidGlassNavButton } from '@/components/ui/LiquidGlass/LiquidGlassNavButton'
import { cn } from '@/lib/utils/cn'
import { HERO_DEFAULT_SLIDES, HERO_DEFAULT_VIDEO } from '@splaro/config'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import { useMobileViewport, isMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'

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

/** Override via NEXT_PUBLIC_HERO_VIDEO — cinematic background on first slide.
 *  Always routed through normalizeHeroVideoUrl() so it gets the same UHD→HD +
 *  mobile-SD-rendition treatment as a real banner video (see resolveSlideVideo). */
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO?.trim() || HERO_DEFAULT_VIDEO

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

/** For Pexels-hosted videos, derive a lightweight ~360p rendition for mobile. */
function mobileVideoFallback(url: string): string | undefined {
  if (!url.includes('videos.pexels.com')) return undefined

  const legacy = url.replace(/(uhd|hd)_\d+_\d+_(\d+fps)/, 'sd_960_540_$2')
  if (legacy !== url) return legacy

  const numeric = url.match(/video-files\/(\d+)\/(\d+)_1920_1080_(\d+fps\.mp4)/)
  if (numeric) {
    const [, folderId, assetId, rest] = numeric
    const mobileId = String(Number(assetId) - 3)
    return `https://videos.pexels.com/video-files/${folderId}/${mobileId}_640_360_${rest}`
  }

  return undefined
}

function isBrandLogoPoster(url: string) {
  const trimmed = url.trim()
  // The generic product placeholder (grey bag icon) reads as broken imagery in
  // a full-bleed hero — treat it like "no poster" so the premium gradient shows.
  return (
    /splaro-logo-(white|dark)\.svg/i.test(trimmed) ||
    /placeholder-product\.(jpg|jpeg|png|svg|webp)/i.test(trimmed)
  )
}

/** Pexels hosts a cinematic still for every video — use preview-0 (free-video-* 404s on newer IDs). */
function pexelsVideoPoster(url: string): string | undefined {
  const m = url.match(/videos\.pexels\.com\/video-files\/(\d+)\//)
  if (!m) return undefined
  return `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg?auto=compress&cs=tinysrgb&w=1600`
}

/** Prefer HD/1080p renditions — admin may store the 31MB UHD Pexels URL. */
function normalizeHeroVideoUrl(url: string): { video: string; videoMobile?: string } {
  const mobile = mobileVideoFallback(url)
  const video = url.includes('uhd_2560_1440')
    ? url.replace('uhd_2560_1440', 'hd_1920_1080')
    : url
  return mobile ? { video, videoMobile: mobile } : { video }
}

/** Ordered renditions to try on mobile before falling back to poster. */
function heroVideoSources(slide: HeroSlide, mobile: boolean): string[] {
  const urls: string[] = []
  if (mobile && slide.videoMobile?.trim()) urls.push(slide.videoMobile.trim())
  if (slide.video?.trim()) {
    const normalized = normalizeHeroVideoUrl(slide.video.trim())
    if (mobile && normalized.videoMobile) urls.push(normalized.videoMobile)
    urls.push(normalized.video)
  }
  return [...new Set(urls.filter(Boolean))]
}

function resolveSlideVideo(media: string, index: number) {
  // Only autoplay a background video when THIS slide's own media is a video URL,
  // or when an explicit NEXT_PUBLIC_HERO_VIDEO override is set. Previously the
  // heavy default Pexels clip was force-played on slide 0 regardless of the
  // slide's real image — an ocean video behind a sneaker, plus ~12MB of lag.
  if (isVideoUrl(media)) return normalizeHeroVideoUrl(media)
  if (index === 0 && process.env.NEXT_PUBLIC_HERO_VIDEO?.trim()) {
    // Route the env override through the same UHD→HD + mobile-SD-rendition
    // logic as a real banner video — this path was returning the raw
    // NEXT_PUBLIC_HERO_VIDEO_MOBILE (or, absent that, the same multi-MB
    // desktop clip) straight to mobile with zero downgrade whenever no
    // Banner rows existed in the DB (e.g. an empty/fresh catalog).
    return normalizeHeroVideoUrl(HERO_VIDEO)
  }
  return {}
}

function resolveSlidePoster(media: string, index: number, banner: HeroBanner) {
  if (!isVideoUrl(media)) return heroImageSrc(media)

  const mobilePoster = banner.mobileImage?.trim()
  if (mobilePoster && !isVideoUrl(mobilePoster)) return heroImageSrc(mobilePoster)

  const pexelsPoster = pexelsVideoPoster(media)
  if (pexelsPoster) return pexelsPoster

  const defaultPoster = HERO_DEFAULT_SLIDES[index]?.image ?? HERO_DEFAULT_SLIDES[0]?.image
  return defaultPoster ? heroImageSrc(defaultPoster) : ''
}

function resolveSlideEyebrow(banner: HeroBanner, index: number, subtitle: string): string {
  const fromDefaults = HERO_DEFAULT_SLIDES[index]?.eyebrow
  if (fromDefaults?.trim()) return fromDefaults.trim()

  const collectionMatch = subtitle.match(/^(.+?)\s+collection$/i)
  if (collectionMatch?.[1]) {
    return 'SPLARO'
  }

  // Brand is the hero signal — never rotate generic “FEATURED EDIT” as eyebrow.
  return 'SPLARO'
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
  // Default false — phones must not flash a <video> before the touch gate resolves.
  const [allow, setAllow] = useState(false)

  useEffect(() => {
    const sync = () => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection
      const saveData = conn?.saveData === true
      const slowLink = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g'
      /** Low-power / save-data lite profile — images only. Re-check when data-perf flips. */
      const lite = document.documentElement.getAttribute('data-perf') === 'lite'
      // Any Windows UA: images only — never decode Pexels next to slider RAF (incl. touch / narrow).
      const isWin = /Windows/i.test(navigator.userAgent || '')
      // Phones/tablets/landscape: poster only — 1080p hero video tanks TTI.
      const isTouchUi =
        window.matchMedia('(max-width: 1023px)').matches ||
        window.matchMedia('(pointer: coarse)').matches
      setAllow(!saveData && !slowLink && !lite && !isWin && !isTouchUi)
    }

    sync()
    const html = document.documentElement
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.type === 'attributes' && r.attributeName === 'data-perf')) sync()
    })
    observer.observe(html, { attributes: true, attributeFilter: ['data-perf'] })
    window.addEventListener('orientationchange', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return allow
}

function warmHeroSlideMedia(slides: HeroSlide[], eagerOnly?: Set<number>) {
  if (typeof window === 'undefined') return

  const warmImage = (slide: HeroSlide) => {
    if (slide.image.trim() && !isBrandLogoPoster(slide.image)) {
      const img = new window.Image()
      img.decoding = 'async'
      img.src = optimizeImageSrc(slide.image, 'hero')
    }
  }

  const warmDeferred = () => {
    slides.forEach((slide, i) => {
      if (eagerOnly?.has(i)) return
      warmImage(slide)
    })
  }

  if (eagerOnly && eagerOnly.size > 0) {
    for (const i of eagerOnly) {
      const slide = slides[i]
      if (slide) warmImage(slide)
    }
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 2000)
    schedule(warmDeferred)
    return
  }

  slides.forEach(warmImage)
}

const warmedHeroVideos = new Set<string>()

function warmHeroVideo(url: string) {
  if (typeof window === 'undefined' || !url) return
  if (isMobileViewport()) return
  if (warmedHeroVideos.has(url)) return
  warmedHeroVideos.add(url)
  // metadata only — warms the connection + headers without downloading the whole
  // 1080p file up front (full preload made refresh feel heavy on slow networks).
  const video = document.createElement('video')
  video.preload = 'metadata'
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
      allowStockMedia
    />
  )
}

function HeroBackground({
  slide,
  isActive,
  playbackActive = isActive,
  priority,
  allowVideo,
}: {
  slide: HeroSlide
  isActive: boolean
  playbackActive?: boolean
  priority: boolean
  allowVideo: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  const mobileActive = mounted && isMobile
  const sourceChain = useMemo(
    () => heroVideoSources(slide, mobileActive),
    [slide, mobileActive],
  )
  const videoSrc = sourceChain[sourceIndex]
  const poster =
    slide.image.trim() && !isBrandLogoPoster(slide.image) ? slide.image : undefined
  const mountVideo = Boolean(
    mounted &&
      videoSrc &&
      !videoFailed &&
      allowVideo &&
      // Only the active slide mounts <video> — never decode current+next HD clips together.
      isActive,
  )

  useEffect(() => {
    setVideoFailed(false)
    setVideoReady(false)
    setSourceIndex(0)
  }, [slide.id, mobileActive])

  const failUnlessAborted = (err: unknown) => {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotAllowedError'))
      return
    setVideoFailed(true)
  }

  const tryPlay = useCallback(() => {
    const video = videoRef.current
    if (!video || !playbackActive || !mountVideo) return
    void video.play().catch(failUnlessAborted)
  }, [playbackActive, mountVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc || videoFailed || !mountVideo) return

    if (playbackActive) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        video.load()
      }
      tryPlay()
      return
    }

    video.pause()
  }, [playbackActive, videoSrc, videoFailed, mountVideo, tryPlay])

  useEffect(() => {
    if (!mountVideo || !playbackActive) return

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && playbackActive) tryPlay()
    }

    const onUserGesture = () => tryPlay()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('touchstart', onUserGesture, { capture: true, passive: true })
    window.addEventListener('scroll', onUserGesture, { capture: true, passive: true })
    window.addEventListener('pointerdown', onUserGesture, { capture: true, passive: true })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('touchstart', onUserGesture, { capture: true })
      window.removeEventListener('scroll', onUserGesture, { capture: true })
      window.removeEventListener('pointerdown', onUserGesture, { capture: true })
    }
  }, [mountVideo, playbackActive, tryPlay])

  const onVideoError = () => {
    const next = sourceIndex + 1
    if (next < sourceChain.length) {
      setSourceIndex(next)
      setVideoReady(false)
      return
    }
    setVideoFailed(true)
  }

  return (
    <>
      <HeroStaticBackdrop src={slide.image} priority={priority} eager />
      {mountVideo ? (
        <video
          key={videoSrc}
          ref={videoRef}
          className={cn('hero-bg-video', videoReady && isActive && 'hero-bg-video--ready')}
          style={HERO_MEDIA_STYLE}
          muted
          loop
          playsInline
          preload={isActive || priority ? 'auto' : mobileActive ? 'none' : 'metadata'}
          disablePictureInPicture
          controls={false}
          {...(poster ? { poster } : {})}
          aria-hidden={!isActive}
          onPlaying={() => setVideoReady(true)}
          onCanPlay={(event) => {
            if (!playbackActive) return
            setVideoReady(true)
            void event.currentTarget.play().catch(failUnlessAborted)
          }}
          onError={onVideoError}
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
  const [inViewport, setInViewport] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const allowVideo = useAllowHeroVideo()
  const heroRef = useRef<HTMLElement>(null)
  const sliderActive = inViewport && tabVisible
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
    if (paused || !sliderActive || slides.length <= 1) return
    autoplayIntervalRef.current = window.setInterval(() => {
      transitionToRef.current((indexRef.current + 1) % slides.length)
    }, SLIDE_DURATION_MS)
  }, [clearAutoplayTimer, paused, sliderActive, slides.length])

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
    // Windows desktop often parks the cursor on the hero without meaning to pause —
    // hover-pause made autoplay look “stuck” vs Mac. Keep hover-pause on Mac/others.
    const isWin = /Windows/i.test(navigator.userAgent || '')
    prefersHoverPauseRef.current =
      !isWin && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }, [])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry?.isIntersecting ?? false),
      { threshold: 0.05, rootMargin: '0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [slides.length])

  useEffect(() => {
    const onTabVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onTabVisibility)
    return () => document.removeEventListener('visibilitychange', onTabVisibility)
  }, [])

  useEffect(() => {
    if (!slides.length) return
    const isMobile = isMobileViewport()
    const eager = isMobile
      ? new Set([0])
      : new Set([0, slides.length > 1 ? 1 : 0])
    warmHeroSlideMedia(slides, eager)
    if (isMobileViewport()) return
    const first = slides[0]
    if (!first) return
    const firstVideo = first.video ?? ''
    if (firstVideo && allowVideo) warmHeroVideo(firstVideo)
  }, [slidesSignature, slides, allowVideo])

  useEffect(() => {
    if (!slides.length) return
    if (isMobileViewport()) return
    const nextIndex = (index + 1) % slides.length
    const nextSlide = slides[nextIndex]
    if (!nextSlide) return
    const nextVideo = nextSlide.video ?? ''
    if (nextVideo && allowVideo) warmHeroVideo(nextVideo)
  }, [index, slides, allowVideo])

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
    setPaused(true)
    setInteracted(true)
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

  const progressPaused = paused || !sliderActive

  return (
    <section
      ref={heroRef}
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
                    playbackActive={isActive && sliderActive}
                    priority={slideIndex === 0}
                    allowVideo={allowVideo}
                  />
                </div>
              </div>
              <div className="hero-overlay" aria-hidden />

              <div className="hero-content">
                <p className="hero-eyebrow">{item.eyebrow}</p>
                {isActive ? (
                  <h1>{item.title}</h1>
                ) : (
                  <p className="hero-title" aria-hidden="true">
                    {item.title}
                  </p>
                )}
                <p className="hero-subtitle">{item.subtitle}</p>

                <div className="hero-actions">
                  <Link href={item.primaryHref} className="hero-btn hero-btn-primary">
                    {item.primaryLabel}
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
            className={cn('hero-progress-fill', progressPaused && 'hero-progress-fill--paused')}
          />
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {slide.title}
      </span>
    </section>
  )
}
