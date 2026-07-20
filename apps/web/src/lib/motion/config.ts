import type { Transition, Variants } from '@/lib/motion/react'

/**
 * SPLARO motion language — keep CSS (`globals.css`) and Framer in lockstep.
 *
 * | Token  | CSS                    | Seconds | Use |
 * |--------|------------------------|---------|-----|
 * | press  | --duration-press       | 0.11    | tap down |
 * | fast   | --duration-fast        | 0.16    | micro opacity / icon |
 * | base   | --duration-base        | 0.22    | default UI / chips |
 * | slow   | --duration-slow        | 0.34    | settle / soft hover |
 * | hover  | --duration-hover       | 0.48    | luxury hover / reveal |
 * | enter  | --duration-enter       | 0.60    | page / panel enter |
 * | media  | --duration-media       | 0.70    | image ken-burns / crossfade |
 *
 * Eases: expo-out for transform/opacity; smooth for color/bg only; in for exits.
 */

/** Matches --ease-out-expo */
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const

/** Matches --ease-smooth — color / background / border only */
export const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const

/** Matches --ease-in — exits */
export const EASE_IN = [0.4, 0, 1, 1] as const

/** Seconds — mirror --duration-* in globals.css */
export const DURATION = {
  press: 0.11,
  fast: 0.16,
  base: 0.22,
  slow: 0.34,
  hover: 0.48,
  enter: 0.6,
  media: 0.7,
} as const

export type MotionDuration = keyof typeof DURATION

/** Tap down */
export const PRESS_DOWN: Transition = {
  duration: DURATION.press,
  ease: EASE_EXPO_OUT,
}

/** Buttons, chips, MotionPressable */
export const MICRO: Transition = {
  duration: DURATION.base,
  ease: EASE_EXPO_OUT,
}

/** Soft UI settle (nav, soft hover) */
export const SETTLE: Transition = {
  duration: DURATION.slow,
  ease: EASE_EXPO_OUT,
}

/** In-view section reveals + luxury hover */
export const REVEAL_ENTER: Transition = {
  duration: DURATION.hover,
  ease: EASE_EXPO_OUT,
}

/** Page route enter */
export const PAGE_ENTER: Transition = {
  duration: DURATION.hover,
  ease: EASE_EXPO_OUT,
}

/** Default MotionConfig — transform + opacity */
export const MOTION_DEFAULT: Transition = {
  duration: DURATION.slow,
  ease: EASE_EXPO_OUT,
}

/** Image crossfade / ken-burns */
export const MEDIA: Transition = {
  duration: DURATION.media,
  ease: EASE_EXPO_OUT,
}

/** Panel / drawer enter */
export const PANEL_ENTER: Transition = {
  duration: DURATION.enter,
  ease: EASE_EXPO_OUT,
}

/** Exit — slightly quicker, ease-in */
export const EXIT: Transition = {
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
