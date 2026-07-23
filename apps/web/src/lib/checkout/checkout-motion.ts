import { DURATION, EASE_EXPO_OUT, EASE_IN, MICRO } from '@/lib/motion/config'
import type { Transition, Variants } from '@/lib/motion/react'

/** @deprecated Prefer EASE_EXPO_OUT from @/lib/motion/config */
export const checkoutEase = EASE_EXPO_OUT

/**
 * Checkout page rhythm — unhurried quiet luxury.
 * Settle ~0.78s so sections float in without feeling rushed.
 */
const SETTLE: Transition = {
  duration: 0.78,
  ease: EASE_EXPO_OUT,
}

export function checkoutSectionMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 16, scale: 0.988 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.99 },
      }
}

export function checkoutMotionTransition(
  reduced: boolean | null,
  ms: number = DURATION.slow,
): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: EASE_EXPO_OUT }
}

export function checkoutEnterTransition(
  reduced: boolean | null,
  delay = 0,
): Transition {
  if (reduced) return { duration: 0 }
  return {
    ...SETTLE,
    delay,
  }
}

export function checkoutChromeMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
      }
}

export const checkoutStaggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.12,
    },
  },
}

export const checkoutStaggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: SETTLE,
  },
}

export const checkoutTapSpring = { opacity: 0.9, transition: MICRO }
export const checkoutHoverLift = { opacity: 0.92, transition: MICRO }

export function checkoutExitTransition(reduced: boolean | null): Transition {
  return reduced
    ? { duration: 0 }
    : { duration: DURATION.base, ease: EASE_IN }
}
