import type { Transition, Variants } from '@/lib/motion/react'

/**
 * SPLARO Motion Language — Elegant · Heavy · Luxury
 *
 * Rules (lockstep with `globals.css` + `styles/motion-language.css`):
 * - No bounce. No overshoot.
 * - Hover lift: 2px
 * - Card scale: 1.02
 * - Duration: 320ms
 * - Spring: gentle (tween — never physics bounce)
 * - Mouse follow: 2°
 * - Reflection: continuous (Pearl sheen + light sweep)
 *
 * | Token  | CSS                    | Seconds | Use |
 * |--------|------------------------|---------|-----|
 * | press  | --duration-press       | 0.11    | tap down |
 * | fast   | --duration-fast        | 0.18    | micro opacity / icon |
 * | base   | --duration-base        | 0.32    | default UI / chips |
 * | slow   | --duration-slow        | 0.32    | settle / soft hover |
 * | hover  | --duration-hover       | 0.32    | luxury hover |
 * | enter  | --duration-enter       | 0.48    | page / panel enter |
 * | media  | --duration-media       | 0.70    | image ken-burns / crossfade |
 */

/** Heavy luxury settle — Y in [0,1], no overshoot */
export const EASE_LUXURY = [0.22, 0.61, 0.36, 1] as const

/** @deprecated Alias of EASE_LUXURY — keep name for call sites */
export const EASE_EXPO_OUT = EASE_LUXURY

/** Matches --ease-smooth — color / background / border only */
export const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const

/** Matches --ease-in — exits */
export const EASE_IN = [0.4, 0, 1, 1] as const

/** Seconds — mirror --duration-* in globals.css */
export const DURATION = {
  press: 0.11,
  fast: 0.18,
  base: 0.32,
  slow: 0.32,
  hover: 0.32,
  enter: 0.48,
  media: 0.7,
  /** Canonical Motion Language beat */
  luxury: 0.32,
} as const

export type MotionDuration = keyof typeof DURATION

/** Motion Language geometry */
export const MOTION = {
  liftPx: 2,
  cardScale: 1.02,
  tiltDeg: 2,
} as const

/** Tap down */
export const PRESS_DOWN: Transition = {
  type: 'tween',
  duration: DURATION.press,
  ease: EASE_LUXURY,
}

/**
 * Gentle “spring” — tween only.
 * Never `type: 'spring'` with bounce / underdamped physics.
 */
export const GENTLE: Transition = {
  type: 'tween',
  duration: DURATION.luxury,
  ease: EASE_LUXURY,
}

/** Buttons, chips, MotionPressable */
export const MICRO: Transition = {
  type: 'tween',
  duration: DURATION.base,
  ease: EASE_LUXURY,
}

/** Soft UI settle (nav, soft hover) */
export const SETTLE: Transition = {
  type: 'tween',
  duration: DURATION.slow,
  ease: EASE_LUXURY,
}

/** In-view section reveals + luxury hover */
export const REVEAL_ENTER: Transition = {
  type: 'tween',
  duration: DURATION.hover,
  ease: EASE_LUXURY,
}

/** Page route enter */
export const PAGE_ENTER: Transition = {
  type: 'tween',
  duration: DURATION.enter,
  ease: EASE_LUXURY,
}

/** Default MotionConfig — transform + opacity */
export const MOTION_DEFAULT: Transition = {
  type: 'tween',
  duration: DURATION.slow,
  ease: EASE_LUXURY,
}

/** Image crossfade / ken-burns */
export const MEDIA: Transition = {
  type: 'tween',
  duration: DURATION.media,
  ease: EASE_LUXURY,
}

/** Panel / drawer enter */
export const PANEL_ENTER: Transition = {
  type: 'tween',
  duration: DURATION.enter,
  ease: EASE_LUXURY,
}

/** Exit — slightly quicker, ease-in */
export const EXIT: Transition = {
  type: 'tween',
  duration: DURATION.fast,
  ease: EASE_IN,
}

/** Route enter — soft fade only (no y/scale — avoids product-nav “jump”). */
export const pageEnter: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: PAGE_ENTER,
  },
}

/** Lighter reveal for dense grids */
export const fadeUpSoft: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: REVEAL_ENTER },
}
