'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowUpRight, Sparkles, Gem } from 'lucide-react'
import type { CuratedCollectionItem } from './CollectionsPage'

interface Collections3DStageProps {
  collections: CuratedCollectionItem[]
  onInspect: (item: CuratedCollectionItem) => void
  /** Off while a modal owns the keyboard. */
  keyboardEnabled?: boolean
}

/** Arrow keys must not steal input from a field the visitor is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function Collections3DStage({
  collections,
  onInspect,
  keyboardEnabled = true,
}: Collections3DStageProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)

  const count = collections.length

  // Reset the runway when the filtered list changes, before paint — otherwise a
  // stale index points past the end and the stage renders nothing.
  const signature = useMemo(() => collections.map((item) => item.id).join('|'), [collections])
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setActiveIndex(0)
  }

  const nextSlide = useCallback(() => {
    if (count <= 0) return
    setActiveIndex((prev) => (prev + 1) % count)
  }, [count])

  const prevSlide = useCallback(() => {
    if (count <= 0) return
    setActiveIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  // Auto-cruise timer
  useEffect(() => {
    if (!autoRotate || count <= 1) return
    const timer = setInterval(() => {
      nextSlide()
    }, 4500)
    return () => clearInterval(timer)
  }, [autoRotate, count, nextSlide])

  // Keyboard navigation
  useEffect(() => {
    if (!keyboardEnabled || count <= 1) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return
      if (e.key === 'ArrowRight') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keyboardEnabled, count, nextSlide, prevSlide])

  // Touch gesture handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) setTouchStartX(touch.clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touch = e.changedTouches[0]
    if (touch) {
      const diff = touch.clientX - touchStartX
      if (Math.abs(diff) > 40) {
        if (diff > 0) prevSlide()
        else nextSlide()
      }
    }
    setTouchStartX(null)
  }

  if (count === 0) return null

  return (
    <section
      aria-label="Atelier Runway Showcase"
      className="relative w-full overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-b from-[#111215] via-[#08090b] to-[#020203] pt-8 pb-14 px-4 sm:px-8 text-white shadow-2xl"
    >
      {/* ── Architectural Grid Background ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />

      {/* ── Ambient Overhead Specular Glow (Monochrome Icy White) ── */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-10 h-[380px] opacity-35"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 0%, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.04) 45%, transparent 75%)',
        }}
        aria-hidden
      />

      {/* ── Studio Stage Top Control Bar ── */}
      <div className="relative z-20 mx-auto flex max-w-5xl items-center justify-between pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white border border-white/20">
            <Gem className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
              Atelier Runway
            </div>
            <div className="text-xs text-zinc-400" aria-live="polite">
              Collection {Math.min(activeIndex + 1, count)} of {count}
            </div>
          </div>
        </div>

        {/* Auto-Cruise Mode Toggle */}
        {count > 1 ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              aria-pressed={autoRotate}
              className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all duration-300 backdrop-blur-xl ${
                autoRotate
                  ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] ring-1 ring-white'
                  : 'bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 hover:text-white border border-white/[0.15] hover:border-white/40'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {autoRotate && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${autoRotate ? 'bg-black' : 'bg-white'}`} />
              </span>
              <span>{autoRotate ? 'Auto Cruise Active' : 'Auto Cruise'}</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Runway Stage Viewport ──
          Geometry lives in CSS custom properties so the server renders the same
          mobile-first layout the browser paints — no post-hydration snap. */}
      <div
        className="relative mx-auto mt-8 flex h-[480px] sm:h-[540px] md:h-[580px] w-full max-w-5xl items-center justify-center select-none [--runway-step:180px] [--runway-depth:140px] [--runway-card:280px] md:[--runway-step:310px] md:[--runway-depth:200px] md:[--runway-card:360px]"
        style={{
          perspective: '1200px',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {collections.map((item, index) => {
          // Calculate shortest circular offset distance (-2, -1, 0, 1, 2)
          let offset = index - activeIndex
          if (offset > count / 2) offset -= count
          if (offset < -count / 2) offset += count

          const isCurrent = offset === 0
          const isVisible = Math.abs(offset) <= 2

          if (!isVisible) return null

          const depth = Math.abs(offset)
          const rotateY = -offset * 32
          const scale = isCurrent ? 1 : Math.max(0.72, 1 - depth * 0.15)
          const opacity = isCurrent ? 1 : Math.max(0.35, 1 - depth * 0.32)
          const zIndex = 30 - depth * 10

          return (
            <div
              key={item.id}
              {...(isCurrent
                ? {}
                : {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Show ${item.title} on the runway`,
                    onClick: () => setActiveIndex(index),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveIndex(index)
                      }
                    },
                  })}
              className={`absolute top-0 flex flex-col items-center justify-center transition-all duration-700 ease-out ${
                isCurrent
                  ? 'cursor-default'
                  : 'cursor-pointer rounded-[26px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
              }`}
              style={{
                transform: `translateX(calc(var(--runway-step) * ${offset})) translateZ(calc(var(--runway-depth) * ${-depth})) rotateY(${rotateY}deg) scale(${scale})`,
                transformStyle: 'preserve-3d',
                zIndex,
                opacity,
                width: 'var(--runway-card)',
              }}
            >
              {/* Studio Stage Card Shell */}
              <div
                className={`relative aspect-[3/4] w-full overflow-hidden rounded-[26px] border bg-[#101114] shadow-2xl transition-all duration-500 ${
                  isCurrent
                    ? 'border-white/60 shadow-[0_25px_60px_rgba(255,255,255,0.14)] ring-1 ring-white/30'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  priority={isCurrent}
                  sizes="(max-width: 768px) 280px, 360px"
                  className={`object-cover object-center transition-transform duration-700 ${
                    isCurrent ? 'scale-100 hover:scale-105' : 'brightness-75'
                  }`}
                />

                {/* Dark Vignette Overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/10 pointer-events-none"
                  aria-hidden
                />

                {/* Tag Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <span className="rounded-full bg-black/70 backdrop-blur-xl px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white border border-white/20">
                    {item.tag}
                  </span>
                </div>

                {/* Card Content Footer */}
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-10">
                  <h3
                    className="text-2xl sm:text-3xl font-normal tracking-tight text-white drop-shadow-md"
                    style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-zinc-300 line-clamp-2 leading-relaxed font-light">
                    {item.subtitle}
                  </p>

                  {/* Active Card Interactive Buttons */}
                  {isCurrent ? (
                    <div className="mt-5 flex items-center gap-2.5">
                      <Link
                        href={item.href}
                        className="group/btn flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-white hover:bg-zinc-200 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-black shadow-lg transition-colors duration-200"
                      >
                        <span>Explore</span>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-black transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onInspect(item)
                        }}
                        className="group/peek inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white text-white hover:text-black px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-2xl shadow-lg transition-colors duration-200"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-white group-hover/peek:text-black transition-colors" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ── Runway Floor Mirror Reflection (Active Card) ── */}
              {isCurrent ? (
                <div
                  className="pointer-events-none relative mt-2 h-14 w-[90%] rounded-b-[26px] opacity-25 blur-[1px] overflow-hidden"
                  style={{
                    transform: 'scaleY(-1)',
                    maskImage: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                  }}
                  aria-hidden
                >
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 252px, 324px"
                    className="object-cover object-bottom"
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* ── Runway Stage Navigation Controls ── */}
      {count > 1 ? (
        <div className="relative z-20 mx-auto mt-4 flex max-w-md items-center justify-between px-4">
          {/* Previous Button */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous Collection in Runway"
            className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.15] bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950 backdrop-blur-xl transition-colors duration-200"
          >
            <ChevronLeft className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
          </button>

          {/* Dot Indicators */}
          <div className="flex items-center gap-2">
            {collections.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Jump to ${item.title}`}
                aria-current={idx === activeIndex}
                className={`h-1.5 rounded-full transition-all duration-400 ${
                  idx === activeIndex
                    ? 'w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]'
                    : 'w-2 bg-white/20 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next Collection in Runway"
            className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.15] bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950 backdrop-blur-xl transition-colors duration-200"
          >
            <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : null}
    </section>
  )
}
