import type { Transition, Variants } from 'framer-motion'

/** SPLARO expo-out — matches --ease-out-expo / Lenis feel */
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const

/** Page route enter — short, no layout thrash */
export const PAGE_ENTER: Transition = {
  duration: 0.28,
  ease: EASE_EXPO_OUT,
}

/** In-view section reveals */
export const REVEAL_ENTER: Transition = {
  duration: 0.42,
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

/** GPU-safe page template — keep opacity 1 so slow/blocked JS never hides the page. */
export const pageEnter: Variants = {
  initial: { opacity: 1, y: 8, scale: 0.999 },
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
