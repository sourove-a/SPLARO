'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { smoothScrollByX } from '@/lib/motion/smooth-scroll-x'
import { cn } from '@/lib/utils/cn'
import { HomeCategoryTile } from './HomeCategoryTile'

interface HomeDepartmentRowProps {
  row: HomepageDepartmentRow
  priorityFirst?: boolean
}

const MOBILE_MQ = '(max-width: 767px)'

export function HomeDepartmentRow({ row, priorityFirst = false }: HomeDepartmentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  const syncScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)

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
    let dragged = false

    const onPointerDown = (event: PointerEvent) => {
      startX = event.clientX
      dragged = false
    }
    const onPointerMove = (event: PointerEvent) => {
      if (Math.abs(event.clientX - startX) > 10) dragged = true
    }
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return
      event.preventDefault()
      event.stopPropagation()
      dragged = false
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [row.tiles])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    if (isMobile) {
      // Snap one card at a time toward center
      const tiles = el.querySelectorAll<HTMLElement>('.home-dept-tile')
      const nextIndex = Math.max(
        0,
        Math.min(tiles.length - 1, activeIndex + (dir === 'left' ? -1 : 1)),
      )
      const target = tiles[nextIndex]
      if (!target) return
      const left =
        target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2
      smoothScrollByX(el, left - el.scrollLeft, 0.4)
      return
    }
    const step = Math.max(280, Math.round(el.clientWidth * 0.85))
    smoothScrollByX(el, dir === 'left' ? -step : step, 0.42)
  }

  return (
    <section className="home-dept-row" aria-labelledby={`home-dept-${row.slug}`}>
      <div className="home-dept-row__header">
        <h2 id={`home-dept-${row.slug}`} className="home-dept-row__title">
          {row.title}
        </h2>
        <Link href={row.exploreHref} className="home-dept-row__explore" scroll={false}>
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
            !canLeft && 'is-disabled',
          )}
          onClick={() => scroll('left')}
          disabled={!canLeft}
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
            !canRight && 'is-disabled',
          )}
          onClick={() => scroll('right')}
          disabled={!canRight}
          aria-label={`Next ${row.title} categories`}
        >
          <ChevronRight strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </section>
  )
}
