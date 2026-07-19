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
