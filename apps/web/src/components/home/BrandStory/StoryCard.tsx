'use client'

import { useSyncExternalStore } from 'react'
import {
  Crown,
  Feather,
  Flower2,
  Gem,
  Scissors,
  Shirt,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { motion } from '@/lib/motion/react'
import { DURATION, EASE_EXPO_OUT } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'
import type { StoryDeckCard, StoryDeckIconName } from './types'

/**
 * Story-matched crest icons — natural / floral / atelier (not brand wordmark).
 * leaf → Flower2 so Origin reads premium botanical, not a random glyph.
 */
const STORY_ICONS: Record<StoryDeckIconName, LucideIcon> = {
  leaf: Flower2,
  gem: Gem,
  people: UsersRound,
  sparkles: Sparkles,
  scissors: Scissors,
  shirt: Shirt,
  crown: Crown,
  feather: Feather,
}

/**
 * Desktop ILLIYEEN-style: wider horizontal step so ±1 cards read as solid peeks
 * (not a tight 3D pile). Mobile keeps a larger step so text does not bleed.
 */
const DESKTOP_STEP = 200
/** Cards beyond this stay mounted at opacity 0 so they can slide in (no mount pop). */
const VISIBLE_RADIUS = 2

const MOBILE_MQ = '(max-width: 767px)'

function subscribeLayout(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(MOBILE_MQ)
  mq.addEventListener('change', onChange)
  window.addEventListener('resize', onChange)
  return () => {
    mq.removeEventListener('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

/** `step:mobile` — stable primitive for useSyncExternalStore. */
function getLayoutSnapshot(): string {
  if (typeof window === 'undefined') return `${DESKTOP_STEP}:0`
  const mobile = window.matchMedia(MOBILE_MQ).matches
  if (mobile) {
    return `${Math.round(Math.min(260, window.innerWidth * 0.66))}:1`
  }
  // ~52% of desktop card width — ILLIYEEN side peeks
  const cardW = Math.min(320, window.innerWidth * 0.22)
  const step = Math.round(Math.min(230, Math.max(180, cardW * 0.55)))
  return `${step}:0`
}

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
  dragX: number
  dragging: boolean
  /** Off-section or reduced-motion — snap transforms, skip heavy decor. */
  paused?: boolean
  onActivate: () => void
  onRead: () => void
}

function coverflowStyle(
  offset: number,
  flatMotion: boolean,
  step: number,
  dragX: number,
  mobile: boolean,
) {
  const visual = offset + dragX / step
  const abs = Math.abs(visual)
  const inView = abs <= VISIBLE_RADIUS + 0.35

  let scale: number
  let opacity: number
  if (abs < 0.02) {
    scale = 1
    opacity = 1
  } else if (abs <= 1) {
    const t = abs
    // Desktop ILLIYEEN: neighbours stay large + readable
    scale = mobile ? 1 - t * 0.18 : 1 - t * 0.1
    opacity = mobile ? 1 - t * 0.45 : 1 - t * 0.12
  } else if (abs <= 2) {
    const t = abs - 1
    scale = mobile ? 0.82 - t * 0.08 : 0.9 - t * 0.08
    opacity = mobile ? 0.55 - t * 0.35 : 0.88 - t * 0.28
  } else {
    scale = 0.72
    opacity = 0
  }

  const x = visual * step
  // Desktop ILLIYEEN = flat fan + light depth. Mobile/lite = 2D slide only.
  const desktop = !mobile
  const rotateY =
    flatMotion || desktop ? 0 : Math.max(-5.5, Math.min(5.5, visual * -3.2))
  const z = flatMotion ? 0 : desktop ? -Math.min(abs, 2) * 28 : -Math.min(abs, 2) * 90
  const y = abs < 0.02 ? 0 : desktop ? abs * 1.2 : flatMotion ? abs * 2 : 6 + abs * 2.5
  const contentOpacity = mobile
    ? abs < 0.35
      ? 1
      : abs < 0.85
        ? 1 - (abs - 0.35) / 0.5
        : 0
    : 1

  return {
    x,
    y,
    z,
    scale,
    opacity: Math.max(0, Math.min(1, opacity)),
    rotateY,
    abs,
    inView,
    contentOpacity: Math.max(0, Math.min(1, contentOpacity)),
  }
}

export function StoryCard({
  card,
  active,
  offset,
  dragX,
  dragging,
  paused = false,
  onActivate,
  onRead,
}: StoryCardProps) {
  const perfSnapshot = useSyncExternalStore(subscribePerf, getPerfSnapshot, () => '0:0')
  const layoutSnapshot = useSyncExternalStore(
    subscribeLayout,
    getLayoutSnapshot,
    () => `${DESKTOP_STEP}:0`,
  )
  const [stepRaw, mobileRaw] = layoutSnapshot.split(':')
  const step = Number(stepRaw) || DESKTOP_STEP
  const mobile = mobileRaw === '1'
  const lite = perfSnapshot.startsWith('1:')
  const windows = perfSnapshot.endsWith(':1')
  const flatMotion = lite || windows
  const Icon = STORY_ICONS[card.icon]
  const style = coverflowStyle(offset, flatMotion, step, dragX, mobile)
  const offstage = !style.inView
  const instant = { type: 'tween' as const, duration: 0 }
  // Next/prev + release: long expo slide (not snappy spring cut)
  const slideTween = {
    type: 'tween' as const,
    duration: DURATION.media,
    ease: EASE_EXPO_OUT,
  }

  const moveTransition = paused || offstage || dragging ? instant : slideTween
  const opacityTween = paused || offstage || dragging
    ? instant
    : {
        type: 'tween' as const,
        duration: DURATION.enter,
        ease: EASE_EXPO_OUT,
      }

  return (
    <motion.article
      className={cn('home-story-deck__card', active && 'is-active')}
      data-story={card.id}
      data-icon={card.icon}
      style={{
        zIndex: style.inView ? 30 - Math.min(Math.round(style.abs), 4) : 0,
        transformOrigin: 'center center',
        pointerEvents: style.inView ? 'auto' : 'none',
        contentVisibility: offstage ? 'hidden' : undefined,
        contain: offstage ? 'layout paint style' : undefined,
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
        x: moveTransition,
        y: moveTransition,
        z: moveTransition,
        scale: moveTransition,
        rotateY: moveTransition,
        opacity: opacityTween,
      }}
      transformTemplate={({ x, y, z, scale, rotateY }) =>
        `translate3d(${x ?? 0}, ${y ?? 0}, ${z ?? 0}) scale(${scale ?? 1}) rotateY(${rotateY ?? 0})`
      }
      aria-hidden={!active}
    >
      {!offstage ? (
        <>
          <span className="home-story-deck__card-depth" aria-hidden />
          <span className="home-story-deck__card-glass" aria-hidden />
          <span className="home-story-deck__card-brush" aria-hidden />
          <span className="home-story-deck__card-guilloche" aria-hidden />
          <span className="home-story-deck__card-shine" aria-hidden />
          <span className="home-story-deck__card-foil" aria-hidden />
          <span className="home-story-deck__card-specular" aria-hidden />
          <span className="home-story-deck__card-engraved" aria-hidden />
          <span className="home-story-deck__card-bevel" aria-hidden />
          <span className="home-story-deck__card-rim" aria-hidden />
          <span className="home-story-deck__card-edge" aria-hidden />
          <span className="home-story-deck__card-beam" aria-hidden>
            <span className="home-story-deck__card-beam-spin" />
          </span>
          <span className="home-story-deck__corner home-story-deck__corner--tl" aria-hidden>
            <span className="home-story-deck__corner-outer" />
            <span className="home-story-deck__corner-inner" />
            <span className="home-story-deck__corner-dot" />
          </span>
          <span className="home-story-deck__corner home-story-deck__corner--tr" aria-hidden>
            <span className="home-story-deck__corner-outer" />
            <span className="home-story-deck__corner-inner" />
            <span className="home-story-deck__corner-dot" />
          </span>
          <span className="home-story-deck__corner home-story-deck__corner--bl" aria-hidden>
            <span className="home-story-deck__corner-outer" />
            <span className="home-story-deck__corner-inner" />
            <span className="home-story-deck__corner-dot" />
          </span>
          <span className="home-story-deck__corner home-story-deck__corner--br" aria-hidden>
            <span className="home-story-deck__corner-outer" />
            <span className="home-story-deck__corner-inner" />
            <span className="home-story-deck__corner-dot" />
          </span>
        </>
      ) : null}

      <button
        type="button"
        className="home-story-deck__card-hit"
        style={{ opacity: style.contentOpacity }}
        tabIndex={active ? 0 : -1}
        aria-label={`${card.title}. ${card.statement}. ${card.body}`}
        onClick={() => {
          if (!active) {
            onActivate()
            return
          }
          onRead()
        }}
      >
        <span className="home-story-deck__card-top">
          <span className="home-story-deck__seal" aria-hidden>
            <span className="home-story-deck__seal-glow" />
            <span className="home-story-deck__seal-ring home-story-deck__seal-ring--outer" />
            <span className="home-story-deck__seal-ring home-story-deck__seal-ring--mid" />
            <span className="home-story-deck__seal-ring home-story-deck__seal-ring--inner" />
            <span className="home-story-deck__medallion">
              <Icon strokeWidth={1} />
            </span>
          </span>
          <span className="home-story-deck__card-eyebrow">{card.eyebrow}</span>
        </span>

        <div className="home-story-deck__card-mid">
          <p className="home-story-deck__card-statement font-serif">{card.statement}</p>
          <p className="home-story-deck__card-body">{card.body}</p>
        </div>

        <div className="home-story-deck__card-foot">
          <span className="home-story-deck__rule" aria-hidden>
            <span className="home-story-deck__rule-line" />
            <span className="home-story-deck__rule-dot" />
          </span>
          <h3 className="home-story-deck__card-title">{card.title}</h3>
        </div>
      </button>
    </motion.article>
  )
}
