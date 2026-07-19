'use client'

/**
 * PremiumSwiperCarousel — React + Swiper 11 (apps/web already has `swiper`).
 *
 * Imports (this file):
 * - `swiper/css` — core
 * - `swiper/css/effect-coverflow` — 3D coverflow
 * - Local `./premium-swiper.css` — glass arrows, edge fade, expo easing
 *
 * Nav: custom circular glass buttons (not Swiper Navigation module) — avoids
 * selector race + jump; Framer-like expo-out on `.swiper-wrapper`.
 */

import {
  Children,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, EffectCoverflow } from 'swiper/modules'
import { useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

import 'swiper/css'
import 'swiper/css/effect-coverflow'
import './premium-swiper.css'

export type PremiumSwiperEffect = 'coverflow' | 'slide'

export type PremiumSwiperBreakpoints = {
  /** <640px */
  mobile: number
  /** 640–991px */
  tablet: number
  /** 992–1279px */
  desktop: number
  /** 1280px+ */
  wide: number
}

const DEFAULT_BREAKPOINTS: PremiumSwiperBreakpoints = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
  wide: 4,
}

/** Related products keep 2-up on mobile (never one full-width card). */
export const RELATED_SWIPER_BREAKPOINTS: PremiumSwiperBreakpoints = {
  mobile: 2,
  tablet: 2,
  desktop: 3,
  wide: 4,
}

interface PremiumSwiperCarouselProps {
  children: ReactNode
  /** Default coverflow; pass `slide` for a flat rail. */
  effect?: PremiumSwiperEffect
  /** Transition duration in ms — Framer-like settle at 300. */
  speed?: number
  spaceBetween?: number
  breakpoints?: PremiumSwiperBreakpoints
  className?: string
  ariaLabel?: string
}

export function PremiumSwiperCarousel({
  children,
  effect = 'coverflow',
  speed = 300,
  spaceBetween = 24,
  breakpoints = DEFAULT_BREAKPOINTS,
  className,
  ariaLabel = 'Carousel',
}: PremiumSwiperCarouselProps) {
  const uid = useId().replace(/:/g, '')
  const prevId = `premium-swiper-prev-${uid}`
  const nextId = `premium-swiper-next-${uid}`
  const swiperRef = useRef<SwiperInstance | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const reducedMotion = useReducedMotion()
  // Reduced motion → flat slide only (no 3D coverflow jump).
  const resolvedEffect: PremiumSwiperEffect = reducedMotion ? 'slide' : effect

  const slides = useMemo(
    () => Children.toArray(children).filter(Boolean),
    [children],
  )

  if (slides.length === 0) return null

  const syncEdges = (instance: SwiperInstance) => {
    setAtStart(instance.isBeginning)
    setAtEnd(instance.isEnd)
  }

  return (
    <div
      className={cn(
        'premium-swiper',
        resolvedEffect === 'coverflow' && 'premium-swiper--coverflow',
        className,
      )}
      data-effect={resolvedEffect}
    >
      {/* Soft edge fades — arrows sit in glass, not harsh on product art */}
      <div className="premium-swiper__edge premium-swiper__edge--start" aria-hidden />
      <div className="premium-swiper__edge premium-swiper__edge--end" aria-hidden />

      <button
        type="button"
        id={prevId}
        className={cn(
          'premium-swiper__nav premium-swiper__nav--prev',
          atStart && 'is-disabled',
        )}
        aria-label="Previous"
        disabled={atStart}
        onClick={() => swiperRef.current?.slidePrev()}
      >
        <ChevronLeft strokeWidth={1.6} aria-hidden />
      </button>

      <button
        type="button"
        id={nextId}
        className={cn(
          'premium-swiper__nav premium-swiper__nav--next',
          atEnd && 'is-disabled',
        )}
        aria-label="Next"
        disabled={atEnd}
        onClick={() => swiperRef.current?.slideNext()}
      >
        <ChevronRight strokeWidth={1.6} aria-hidden />
      </button>

      <Swiper
        className="premium-swiper__track"
        modules={[EffectCoverflow, A11y]}
        // effect — coverflow = mild 3D; slide = flat (also forced when reduced motion)
        effect={resolvedEffect}
        // speed — 300ms settle (matches --pp-dur-base / Framer MICRO feel)
        speed={reducedMotion ? 0 : speed}
        // spaceBetween — gap between slides (px)
        spaceBetween={spaceBetween}
        slidesPerView={breakpoints.mobile}
        breakpoints={{
          640: { slidesPerView: breakpoints.tablet, spaceBetween },
          992: { slidesPerView: breakpoints.desktop, spaceBetween },
          1280: { slidesPerView: breakpoints.wide, spaceBetween },
        }}
        // Mild coverflow — no shadows (shadows read as jump/flicker on product cards)
        coverflowEffect={{
          rotate: 12,
          stretch: 0,
          depth: 100,
          modifier: 1,
          slideShadows: false,
        }}
        // centeredSlides only for coverflow so side cards peek without layout thrash
        centeredSlides={resolvedEffect === 'coverflow' && slides.length > 2}
        grabCursor
        watchOverflow
        // rewind — soft wrap without loop clone jump
        rewind={slides.length > breakpoints.wide}
        threshold={10}
        preventClicks
        preventClicksPropagation
        a11y={{
          enabled: true,
          prevSlideMessage: 'Previous slide',
          nextSlideMessage: 'Next slide',
        }}
        onSwiper={(instance) => {
          swiperRef.current = instance
          syncEdges(instance)
        }}
        onSlideChange={syncEdges}
        onResize={syncEdges}
        aria-label={ariaLabel}
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={`slide-${index}`} className="premium-swiper__slide">
            <div className="premium-swiper__slide-inner">{slide}</div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
