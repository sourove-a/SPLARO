import type { Transition, Variants } from '@/lib/motion/react'
import { EASE_EXPO_OUT, REVEAL_ENTER, fadeUpSoft, pageEnter } from './config'

export { pageEnter, fadeUpSoft }

export const SPRING = { type: 'tween' as const, duration: 0.22, ease: EASE_EXPO_OUT }

export const EXPO_OUT: Transition = { ease: EASE_EXPO_OUT, duration: 0.6 }

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
  animate: { opacity: 1, y: 0, transition: EXPO_OUT },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: EASE_EXPO_OUT } },
}

/** Enter/exit pop — AnimatePresence swaps (add-to-bag, cart lines, status chips) */
export const exitPop: Variants = {
  initial: { opacity: 0, scale: 0.88 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.24, ease: EASE_EXPO_OUT } },
  exit: { opacity: 0, scale: 0.88, transition: { duration: 0.2, ease: EASE_EXPO_OUT } },
}

/** Hover/tap — opacity only (sharp: no scale/translate jump). */
export const cardHover = {
  whileHover: { opacity: 0.94, transition: { duration: 0.2, ease: EASE_EXPO_OUT } },
  whileTap: { opacity: 0.88, transition: { duration: 0.1, ease: EASE_EXPO_OUT } },
}

/** Shared press — use instead of `whileTap: { scale: 0.992 }`. */
export const pressTap = { opacity: 0.9, transition: { duration: 0.1, ease: EASE_EXPO_OUT } }

export const revealVariants = {
  fadeUp,
  fadeUpSoft,
  fadeIn,
  scaleUp,
  slideLeft,
  staggerContainer,
} as const

export type RevealVariant = keyof typeof revealVariants
