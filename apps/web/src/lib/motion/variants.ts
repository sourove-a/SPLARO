import type { Transition, Variants } from '@/lib/motion/react'
import {
  DURATION,
  EASE_EXPO_OUT,
  EASE_LUXURY,
  EXIT,
  GENTLE,
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
  EASE_LUXURY,
  EXIT,
  GENTLE,
  MICRO,
  MEDIA,
  PAGE_ENTER,
  PANEL_ENTER,
  PRESS_DOWN,
  REVEAL_ENTER,
  SETTLE,
}

/** Gentle tween — never physics bounce / overshoot */
export const SPRING = GENTLE

export const EXPO_OUT: Transition = PANEL_ENTER

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
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

/** Story scroll — fade + soft lift (no filter:blur — that freezes Lenis) */
export const blurReveal: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: REVEAL_ENTER,
  },
}

/** Card layering — rises into depth (no scale fight with Lenis) */
export const cardLayer: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: REVEAL_ENTER,
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
}

export const fadeUpPage = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: PAGE_ENTER },
  exit: { opacity: 0, y: -10, transition: EXIT },
}

/** Enter/exit pop — AnimatePresence swaps (add-to-bag, cart lines, status chips) */
export const exitPop: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: MICRO },
  exit: { opacity: 0, scale: 0.96, transition: EXIT },
}

/** Hover/tap — CSS Motion Language owns 2px lift + 1.02 scale; Framer stays opacity-only. */
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
  blurReveal,
  cardLayer,
  staggerContainer,
} as const

export type RevealVariant = keyof typeof revealVariants
