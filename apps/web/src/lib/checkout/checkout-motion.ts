import { DURATION, EASE_EXPO_OUT, EASE_IN, MICRO } from '@/lib/motion/config'
import type { Transition, Variants } from '@/lib/motion/react'

/** @deprecated Prefer EASE_EXPO_OUT from @/lib/motion/config */
export const checkoutEase = EASE_EXPO_OUT

/** Instant paint on reload — no fade-from-white. Tap/hover still use MICRO. */
const SETTLE: Transition = {
  duration: 0,
  ease: EASE_EXPO_OUT,
}

export function checkoutSectionMotion(_reduced: boolean | null) {
  return { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
}

export function checkoutMotionTransition(
  reduced: boolean | null,
  ms: number = DURATION.slow,
): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: EASE_EXPO_OUT }
}

export function checkoutEnterTransition(
  _reduced: boolean | null,
  _delay = 0,
): Transition {
  return { duration: 0 }
}

export function checkoutChromeMotion(_reduced: boolean | null) {
  return { initial: false as const, animate: { opacity: 1 } }
}

export const checkoutStaggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0,
      delayChildren: 0,
    },
  },
}

export const checkoutStaggerItem: Variants = {
  hidden: { opacity: 1, y: 0 },
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
