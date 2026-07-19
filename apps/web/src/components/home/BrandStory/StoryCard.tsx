'use client'

import { useSyncExternalStore } from 'react'
import {
  Crown,
  Feather,
  Gem,
  Leaf,
  Scissors,
  Shirt,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { motion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'
import type { StoryDeckCard, StoryDeckIconName } from './types'

const ICONS: Record<StoryDeckIconName, LucideIcon> = {
  leaf: Leaf,
  gem: Gem,
  people: UsersRound,
  sparkles: Sparkles,
  scissors: Scissors,
  shirt: Shirt,
  crown: Crown,
  feather: Feather,
}

const COVERFLOW_STEP = 118
/** Cards beyond this stay mounted at opacity 0 so they can slide in (no mount pop). */
const VISIBLE_RADIUS = 2

function subscribePerf(onChange: () => void) {
  if (typeof document === 'undefined') return () => {}
  const html = document.documentElement
  const obs = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.type === 'attributes' &&
          (r.attributeName === 'data-perf' || r.attributeName === 'data-os'),
      )
    ) {
      onChange()
    }
  })
  obs.observe(html, { attributes: true, attributeFilter: ['data-perf', 'data-os'] })
  return () => obs.disconnect()
}

/** Stable primitive snapshot — object snapshots re-render forever. */
function getPerfSnapshot(): string {
  if (typeof document === 'undefined') return '0:0'
  const html = document.documentElement
  const lite = html.getAttribute('data-perf') === 'lite' ? '1' : '0'
  const windows = html.getAttribute('data-os') === 'windows' ? '1' : '0'
  return `${lite}:${windows}`
}

interface StoryCardProps {
  card: StoryDeckCard
  active: boolean
  offset: number
  onActivate: () => void
  onRead: () => void
}

function coverflowStyle(
  offset: number,
  flatMotion: boolean,
) {
  const abs = Math.abs(offset)
  const inView = abs <= VISIBLE_RADIUS
  const scale = abs === 0 ? 1 : abs === 1 ? 0.86 : abs === 2 ? 0.74 : 0.64
  const opacity = !inView ? 0 : abs === 0 ? 1 : abs === 1 ? 0.78 : 0.45
  // Windows / lite: 2D slide only — no rotateY/z (GPU + scroll-safe)
  const rotateY = flatMotion ? 0 : Math.max(-5.5, Math.min(5.5, offset * -3.2))
  const x = offset * COVERFLOW_STEP
  const z = flatMotion ? 0 : -abs * 90
  const y = abs === 0 ? 0 : flatMotion ? abs * 2 : 6 + abs * 2.5

  return { x, y, z, scale, opacity, rotateY, abs, inView }
}

function EngravedCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <span className={cn('home-story-deck__corner', `home-story-deck__corner--${position}`)} aria-hidden>
      <span className="home-story-deck__corner-outer" />
      <span className="home-story-deck__corner-inner" />
      <span className="home-story-deck__corner-dot" />
    </span>
  )
}

export function StoryCard({
  card,
  active,
  offset,
  onActivate,
  onRead,
}: StoryCardProps) {
  const perfSnapshot = useSyncExternalStore(subscribePerf, getPerfSnapshot, () => '0:0')
  const lite = perfSnapshot.startsWith('1:')
  const windows = perfSnapshot.endsWith(':1')
  // Flat 2D path on Windows / lite — still animated (never hard-cut)
  const flatMotion = lite || windows
  const Icon = ICONS[card.icon]
  const style = coverflowStyle(offset, flatMotion)
  const richDecor = active && !lite && !windows

  // Parent MotionConfig forces reducedMotion="never" so Windows OS setting can't hard-cut.
  const slideSpring = flatMotion
    ? { type: 'spring' as const, stiffness: 340, damping: 36, mass: 0.8 }
    : { type: 'spring' as const, stiffness: 280, damping: 32, mass: 0.85 }

  const opacityTween = {
    duration: flatMotion ? 0.28 : 0.36,
    ease: [0.22, 1, 0.36, 1] as const,
  }

  return (
    <motion.article
      className={cn('home-story-deck__card', active && 'is-active')}
      style={{
        zIndex: style.inView ? 30 - style.abs : 0,
        transformOrigin: 'center center',
        pointerEvents: style.inView ? 'auto' : 'none',
      }}
      initial={false}
      animate={{
        x: style.x,
        y: style.y,
        z: style.z,
        scale: style.scale,
        opacity: style.opacity,
        rotateY: style.rotateY,
      }}
      transition={{
        x: slideSpring,
        y: slideSpring,
        z: slideSpring,
        scale: slideSpring,
        rotateY: slideSpring,
        opacity: opacityTween,
      }}
      // Always keep a transform matrix — avoids none↔matrix snap on Windows
      transformTemplate={({ x, y, z, scale, rotateY }) =>
        `translate3d(${x ?? 0}, ${y ?? 0}, ${z ?? 0}) scale(${scale ?? 1}) rotateY(${rotateY ?? 0})`
      }
      aria-hidden={!active}
    >
      <span className="home-story-deck__card-metal" aria-hidden />
      {richDecor ? <span className="home-story-deck__card-brush" aria-hidden /> : null}
      {richDecor ? <span className="home-story-deck__card-guilloche" aria-hidden /> : null}
      {richDecor ? <span className="home-story-deck__card-foil" aria-hidden /> : null}
      <span className="home-story-deck__card-engraved" aria-hidden />
      {richDecor ? <span className="home-story-deck__card-bevel" aria-hidden /> : null}
      <span className="home-story-deck__card-rim" aria-hidden />
      <span className="home-story-deck__card-shine" aria-hidden />

      <EngravedCorner position="tl" />
      <EngravedCorner position="tr" />
      <EngravedCorner position="bl" />
      <EngravedCorner position="br" />

      <button
        type="button"
        className="home-story-deck__card-hit"
        tabIndex={active ? 0 : -1}
        aria-label={`${card.title}. ${card.statement}`}
        onClick={() => {
          if (!active) {
            onActivate()
            return
          }
          onRead()
        }}
      >
        <span className="home-story-deck__card-index" aria-hidden>
          <span>{card.indexLabel}</span>
        </span>

        <span className="home-story-deck__card-top">
          <span className="home-story-deck__seal" aria-hidden>
            <span className="home-story-deck__seal-ring home-story-deck__seal-ring--outer" />
            {richDecor ? (
              <span className="home-story-deck__seal-ring home-story-deck__seal-ring--inner" />
            ) : null}
            <span className="home-story-deck__medallion">
              <Icon strokeWidth={1.05} />
            </span>
          </span>
          <span className="home-story-deck__mark">SPLARO</span>
          <span className="home-story-deck__card-eyebrow">{card.eyebrow}</span>
        </span>

        <span className="home-story-deck__ornament" aria-hidden>
          <span className="home-story-deck__ornament-line" />
          <span className="home-story-deck__ornament-diamond" />
          <span className="home-story-deck__ornament-line" />
        </span>

        <div className="home-story-deck__card-mid">
          <p className="home-story-deck__card-statement">{card.statement}</p>
          <p className="home-story-deck__card-body">{card.body}</p>
        </div>

        <span className="home-story-deck__ornament home-story-deck__ornament--foot" aria-hidden>
          <span className="home-story-deck__ornament-line" />
          <span className="home-story-deck__ornament-diamond" />
          <span className="home-story-deck__ornament-line" />
        </span>

        <div className="home-story-deck__card-foot">
          <h3 className="home-story-deck__card-title">{card.title}</h3>
          <motion.span
            className="home-story-deck__card-cta"
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              y: active ? 0 : 4,
            }}
            transition={opacityTween}
            aria-hidden={!active}
          >
            <span className="home-story-deck__card-cta-line" aria-hidden />
            {card.cta}
            <span aria-hidden> →</span>
            <span className="home-story-deck__card-cta-line" aria-hidden />
          </motion.span>
        </div>
      </button>
    </motion.article>
  )
}
