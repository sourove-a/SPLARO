import type { Transition, Variants } from '@/lib/motion/react'
import {
  DURATION,
  EASE_EXPO_OUT,
  EXIT,
  MICRO,
  MEDIA,
  PAGE_ENTER,
  PANEL_ENTER,
  PRESS_DOWN,
  REVEAL_ENTER,
  SETTLE,
  fadeUpSoft,
  pageEnter,
} from './config'

export {
  pageEnter,
  fadeUpSoft,
  DURATION,
  EASE_EXPO_OUT,
  EXIT,
  MICRO,
  MEDIA,
  PAGE_ENTER,
  PANEL_ENTER,
  PRESS_DOWN,
  REVEAL_ENTER,
  SETTLE,
}

/** @deprecated Prefer MICRO — kept for call sites expecting SPRING shape */
export const SPRING = { type: 'tween' as const, duration: DURATION.base, ease: EASE_EXPO_OUT }

export const EXPO_OUT: Transition = PANEL_ENTER

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: REVEAL_ENTER },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: REVEAL_ENTER },
}

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: REVEAL_ENTER },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: REVEAL_ENTER },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

export const fadeUpPage = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: PAGE_ENTER },
  exit: { opacity: 0, y: -10, transition: EXIT },
}

/** Enter/exit pop — AnimatePresence swaps (add-to-bag, cart lines, status chips) */
export const exitPop: Variants = {
  initial: { opacity: 0, scale: 0.88 },
  animate: { opacity: 1, scale: 1, transition: MICRO },
  exit: { opacity: 0, scale: 0.88, transition: EXIT },
}

/** Hover/tap — barely-there opacity (image crossfade carries the luxury cue). */
export const cardHover = {
  whileHover: { opacity: 0.99, transition: SETTLE },
  whileTap: { opacity: 0.96, transition: PRESS_DOWN },
}

/** Shared press — use instead of `whileTap: { scale: 0.992 }`. */
export const pressTap = { opacity: 0.9, transition: PRESS_DOWN }

export const revealVariants = {
  fadeUp,
  fadeUpSoft,
  fadeIn,
  scaleUp,
  slideLeft,
  staggerContainer,
} as const

export type RevealVariant = keyof typeof revealVariants
