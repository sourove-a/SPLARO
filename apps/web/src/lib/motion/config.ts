import type { Transition, Variants } from '@/lib/motion/react'

/** SPLARO expo-out — matches --ease-out-expo / Lenis feel */
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const

/** Page route enter — noticeable but quick, no layout thrash */
export const PAGE_ENTER: Transition = {
  duration: 0.42,
  ease: EASE_EXPO_OUT,
}

/** In-view section reveals — premium settle without sluggish feel */
export const REVEAL_ENTER: Transition = {
  duration: 0.48,
  ease: EASE_EXPO_OUT,
}

/** Micro interactions (buttons, chips) */
export const MICRO: Transition = {
  duration: 0.22,
  ease: EASE_EXPO_OUT,
}

/** Default for MotionConfig — transform + opacity only */
export const MOTION_DEFAULT: Transition = {
  duration: 0.4,
  ease: EASE_EXPO_OUT,
}

/** Route enter — soft fade + rise, the "premium settle" on every navigation.
    Only applied on client-side navigations (see useMotionReady), so a blocked
    first paint can never be hidden behind opacity 0. */
export const pageEnter: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.994 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: PAGE_ENTER,
  },
}

/** Lighter reveal for dense grids */
export const fadeUpSoft: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: REVEAL_ENTER },
}
