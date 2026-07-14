/**
 * SPLARO Motion for React — single import surface for the storefront.
 * @see https://motion.dev/docs/react
 *
 * Use this instead of importing `framer-motion` or `motion/react` directly
 * so version upgrades stay in one place.
 */
export {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
  domAnimation,
  domMax,
  m,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'

export type {
  HTMLMotionProps,
  MotionProps,
  Transition,
  Variants,
} from 'motion/react'
