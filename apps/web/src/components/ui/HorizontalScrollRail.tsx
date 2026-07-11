'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { cn } from '@/lib/utils/cn'

interface HorizontalScrollRailProps {
  children: ReactNode
  className?: string
  trackClassName?: string
  /** External ref for scroll position observers (e.g. reels active card). */
  trackRef?: RefObject<HTMLDivElement | null>
  ariaLabel?: string
  scrollStep?: number
  variant?: 'default' | 'pill'
  trackRole?: string
  /** Keep header/external nav — rail still handles wheel + scrollbar cues. */
  hideArrows?: boolean
}

export function HorizontalScrollRail({
  children,
  className,
  trackClassName,
  trackRef: externalTrackRef,
  ariaLabel,
  scrollStep,
  variant = 'default',
  trackRole,
  hideArrows = false,
}: HorizontalScrollRailProps) {
  const internalTrackRef = useRef<HTMLDivElement>(null)
  const trackRef = externalTrackRef ?? internalTrackRef
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)

  const syncScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return

    const overflow = el.scrollWidth > el.clientWidth + 2
    setHasOverflow(overflow)
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [trackRef])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    syncScrollState()
    el.addEventListener('scroll', syncScrollState, { passive: true })

    const observer = new ResizeObserver(syncScrollState)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)

    return () => {
      el.removeEventListener('scroll', syncScrollState)
      observer.disconnect()
    }
  }, [syncScrollState, trackRef, children])

  useHorizontalWheelScroll(trackRef)

  const scrollBy = (direction: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const step = scrollStep ?? Math.max(220, Math.round(el.clientWidth * 0.72))
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const showControls = hasOverflow && !hideArrows
  const showEdgeFade = hasOverflow

  return (
    <div
      className={cn(
        'h-scroll-rail',
        variant === 'pill' && 'h-scroll-rail--pill',
        showEdgeFade && 'h-scroll-rail--controls',
        showEdgeFade && canScrollLeft && 'h-scroll-rail--can-left',
        showEdgeFade && canScrollRight && 'h-scroll-rail--can-right',
        hideArrows && hasOverflow && 'h-scroll-rail--fade-only',
        className,
      )}
    >
      {showControls ? (
        <button
          type="button"
          className="h-scroll-rail__btn h-scroll-rail__btn--prev"
          aria-label={ariaLabel ? `Scroll ${ariaLabel} left` : 'Scroll left'}
          disabled={!canScrollLeft}
          onClick={() => scrollBy(-1)}
        >
          <ChevronLeft strokeWidth={2} aria-hidden />
        </button>
      ) : null}

      <div
        ref={trackRef}
        className={cn('h-scroll-rail__track', trackClassName)}
        data-lenis-prevent
        data-h-scroll="true"
        {...(hasOverflow ? { tabIndex: 0 } : {})}
        {...(trackRole ? { role: trackRole } : ariaLabel ? { role: 'region' } : {})}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      >
        {children}
      </div>

      {showControls ? (
        <button
          type="button"
          className="h-scroll-rail__btn h-scroll-rail__btn--next"
          aria-label={ariaLabel ? `Scroll ${ariaLabel} right` : 'Scroll right'}
          disabled={!canScrollRight}
          onClick={() => scrollBy(1)}
        >
          <ChevronRight strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
