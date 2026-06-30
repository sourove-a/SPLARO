import type { Transition, Variants } from 'framer-motion'

export const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 }

export const EXPO_OUT: Transition = { ease: [0.16, 1, 0.3, 1], duration: 0.6 }

const REVEAL_TRANSITION: Transition = { duration: 0.65, ease: [0.16, 1, 0.3, 1] }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: REVEAL_TRANSITION },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: REVEAL_TRANSITION },
}

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: REVEAL_TRANSITION },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: REVEAL_TRANSITION },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

export const fadeUpPage = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: EXPO_OUT },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
}

export const cardHover = {
  whileHover: { y: -6, scale: 1.012, transition: EXPO_OUT },
  whileTap: { scale: 0.97, transition: { duration: 0.08 } },
}

export const revealVariants = {
  fadeUp,
  fadeIn,
  scaleUp,
  slideLeft,
  staggerContainer,
} as const

export type RevealVariant = keyof typeof revealVariants
