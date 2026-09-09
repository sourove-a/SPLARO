'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { smoothScrollByX } from '@/lib/motion/smooth-scroll-x'
import { useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'
import { HomeCategoryTile } from './HomeCategoryTile'

interface HomeDepartmentRowProps {
  row: HomepageDepartmentRow
  priorityFirst?: boolean
}

const MOBILE_MQ = '(max-width: 767px)'
const AUTOPLAY_INTERVAL_MS = 4000

export function HomeDepartmentRow({ row, priorityFirst = false }: HomeDepartmentRowProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [hasOverflow, setHasOverflow] = useState(row.tiles.length > 1)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)

  const autoplayTimeoutRef = useRef<number | undefined>(undefined)
  const prefersHoverPauseRef = useRef(true)
  const autoScrollNextRef = useRef<() => void>(() => {})

  const syncScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    setHasOverflow(el.scrollWidth > el.clientWidth + 4)

    // Visible viewport center (not track.clientWidth — flex can inflate that)
    const tiles = el.querySelectorAll<HTMLElement>('.home-dept-tile')
    if (!tiles.length) return
    const trackRect = el.getBoundingClientRect()
    const viewLeft = Math.max(trackRect.left, 0)
    const viewRight = Math.min(trackRect.right, window.innerWidth)
    const viewCenter = (viewLeft + viewRight) / 2
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    tiles.forEach((tile, index) => {
      const rect = tile.getBoundingClientRect()
      const mid = rect.left + rect.width / 2
      const dist = Math.abs(mid - viewCenter)
      if (dist < bestDist) {
        bestDist = dist
        best = index
      }
    })
    setActiveIndex((prev) => (prev === best ? prev : best))
  }, [])

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimeoutRef.current !== undefined) {
      window.clearTimeout(autoplayTimeoutRef.current)
      autoplayTimeoutRef.current = undefined
    }
  }, [])

  const autoScrollNext = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 4) return

    if (isMobile) {
      const tiles = el.querySelectorAll<HTMLElement>('.home-dept-tile')
      if (tiles.length <= 1) return
      const nextIndex = (activeIndex + 1) % tiles.length
      const target = tiles[nextIndex]
      if (!target) return
      const left =
        target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2
      smoothScrollByX(el, left - el.scrollLeft, 0.45)
      return
    }

    // Desktop: loop to start if at the end, else scroll right by 2 cards
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 16
    if (atEnd) {
      smoothScrollByX(el, -el.scrollLeft, 0.7)
    } else {
      const firstTile = el.querySelector<HTMLElement>('.home-dept-tile')
      const tileWidth = firstTile ? firstTile.offsetWidth : 280
      const gap = 12
      const step = Math.min((tileWidth + gap) * 2, Math.max(280, Math.round(el.clientWidth * 0.75)))
      smoothScrollByX(el, step, 0.55)
    }
  }, [activeIndex, isMobile])

  autoScrollNextRef.current = autoScrollNext

  const resetAutoplayTimer = useCallback(() => {
    clearAutoplayTimer()
    if (
      reducedMotion ||
      !tabVisible ||
      !inViewport ||
      isHovered ||
      isInteracting ||
      row.tiles.length <= 1
    ) {
      return
    }
    autoplayTimeoutRef.current = window.setTimeout(() => {
      autoScrollNextRef.current()
      resetAutoplayTimer()
    }, AUTOPLAY_INTERVAL_MS)
  }, [
    clearAutoplayTimer,
    inViewport,
    isHovered,
    isInteracting,
    reducedMotion,
    row.tiles.length,
    tabVisible,
  ])

  useEffect(() => {
    prefersHoverPauseRef.current =
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry?.isIntersecting ?? false),
      { threshold: 0.05, rootMargin: '100px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    resetAutoplayTimer()
    return () => clearAutoplayTimer()
  }, [resetAutoplayTimer, clearAutoplayTimer])

  const onMouseEnter = () => {
    if (prefersHoverPauseRef.current) {
      setIsHovered(true)
    }
  }

  const onMouseLeave = () => {
    if (prefersHoverPauseRef.current) {
      setIsHovered(false)
    }
  }

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const refresh = () => syncScroll()
    refresh()
    const raf = window.requestAnimationFrame(() => {
      refresh()
      window.requestAnimationFrame(refresh)
    })

    el.addEventListener('scroll', refresh, { passive: true })
    window.addEventListener('resize', refresh)
    const observer = new ResizeObserver(refresh)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)

    return () => {
      window.cancelAnimationFrame(raf)
      el.removeEventListener('scroll', refresh)
      window.removeEventListener('resize', refresh)
      observer.disconnect()
    }
  }, [syncScroll, row.tiles])

  // Mobile: open on the 2nd tile so cards half-peek on BOTH sides —
  // customers instantly see they can slide left and right.
  const didCenterRef = useRef(false)
  useEffect(() => {
    if (!isMobile || didCenterRef.current) return
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft > 2) return // user already scrolled — don't fight them
    const tiles = el.querySelectorAll<HTMLElement>('.home-dept-tile')
    if (tiles.length < 2) return
    const target = tiles[1]
    if (!target) return
    didCenterRef.current = true
    el.scrollLeft = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2
  }, [isMobile, row.tiles])

  // Swipe then release must not navigate the tile link
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let startX = 0
    let pointerDown = false
    let dragged = false

    const onPointerDown = (event: PointerEvent) => {
      startX = event.clientX
      pointerDown = true
      dragged = false
      setIsInteracting(true)
      clearAutoplayTimer()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return
      if (Math.abs(event.clientX - startX) > 16) dragged = true
    }
    const onPointerUp = () => {
      pointerDown = false
      setIsInteracting(false)
      resetAutoplayTimer()
    }
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return
      event.preventDefault()
      event.stopPropagation()
      dragged = false
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointercancel', onPointerUp, { passive: true })
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [row.tiles, clearAutoplayTimer, resetAutoplayTimer])

  function scroll(dir: 'left' | 'right') {
    resetAutoplayTimer()
    const el = scrollRef.current
    if (!el) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    if (maxScroll <= 4) return

    if (isMobile) {
      // Snap one card at a time toward center with seamless repeat
      const tiles = el.querySelectorAll<HTMLElement>('.home-dept-tile')
      if (!tiles.length) return
      const nextIndex =
        dir === 'right'
          ? (activeIndex + 1) % tiles.length
          : (activeIndex - 1 + tiles.length) % tiles.length
      const target = tiles[nextIndex]
      if (!target) return
      const left =
        target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2
      smoothScrollByX(el, left - el.scrollLeft, 0.4)
      return
    }

    const firstTile = el.querySelector<HTMLElement>('.home-dept-tile')
    const tileWidth = firstTile ? firstTile.offsetWidth : 280
    const gap = 12
    const step = Math.min((tileWidth + gap) * 2, Math.max(280, Math.round(el.clientWidth * 0.75)))

    if (dir === 'right') {
      // Seamless repeat: if at or near the end (within 48px or half tile), wrap smoothly back to start
      const atEnd = el.scrollLeft >= maxScroll - Math.min(tileWidth * 0.35, 48)
      if (atEnd) {
        smoothScrollByX(el, -el.scrollLeft, 0.65)
        return
      }
      smoothScrollByX(el, Math.min(step, maxScroll - el.scrollLeft), 0.45)
      return
    }

    if (dir === 'left') {
      // Seamless repeat: if at or near the start, wrap smoothly to the end
      const atStart = el.scrollLeft <= Math.min(tileWidth * 0.35, 48)
      if (atStart) {
        smoothScrollByX(el, maxScroll - el.scrollLeft, 0.65)
        return
      }
      smoothScrollByX(el, -Math.min(step, el.scrollLeft), 0.45)
      return
    }
  }

  return (
    <section
      ref={sectionRef}
      className="home-dept-row"
      aria-labelledby={`home-dept-${row.slug}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="home-dept-row__header">
        <h2 id={`home-dept-${row.slug}`} className="home-dept-row__title">
          {row.title}
        </h2>
        <Link href={row.exploreHref} className="home-dept-row__explore">
          Explore All
        </Link>
      </div>

      <div className="home-dept-row__stage">
        {/* Desktop / tablet arrows only — mobile is swipe + half-peek */}
        <button
          type="button"
          className={cn(
            'home-dept-row__arrow',
            'home-dept-row__arrow--prev',
            !hasOverflow && 'is-disabled',
          )}
          onClick={() => scroll('left')}
          disabled={!hasOverflow}
          aria-label={`Previous ${row.title} categories`}
        >
          <ChevronLeft strokeWidth={1.75} aria-hidden />
        </button>

        <HorizontalScrollRail
          className="home-dept-row__rail"
          trackClassName="home-dept-row__track"
          trackRef={scrollRef}
          hideArrows
          ariaLabel={`${row.title} categories`}
        >
          {row.tiles.map((tile, index) => (
            <HomeCategoryTile
              key={tile.slug}
              tile={tile}
              priority={priorityFirst && index < 2}
              active={index === activeIndex}
            />
          ))}
        </HorizontalScrollRail>

        <button
          type="button"
          className={cn(
            'home-dept-row__arrow',
            'home-dept-row__arrow--next',
            !hasOverflow && 'is-disabled',
          )}
          onClick={() => scroll('right')}
          disabled={!hasOverflow}
          aria-label={`Next ${row.title} categories`}
        >
          <ChevronRight strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </section>
  )
}
