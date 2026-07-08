import type { Transition, Variants } from 'framer-motion'
import { EASE_EXPO_OUT, REVEAL_ENTER, fadeUpSoft, pageEnter } from './config'

export { pageEnter, fadeUpSoft }

export const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 }

export const EXPO_OUT: Transition = { ease: EASE_EXPO_OUT, duration: 0.6 }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
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
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
}

export const fadeUpPage = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: EXPO_OUT },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: EASE_EXPO_OUT } },
}

/** Hover/tap — transform only, no layout */
export const cardHover = {
  whileHover: { y: -4, scale: 1.008, transition: { duration: 0.28, ease: EASE_EXPO_OUT } },
  whileTap: { scale: 0.98, transition: { duration: 0.08 } },
}

export const revealVariants = {
  fadeUp,
  fadeUpSoft,
  fadeIn,
  scaleUp,
  slideLeft,
  staggerContainer,
} as const

export type RevealVariant = keyof typeof revealVariants
