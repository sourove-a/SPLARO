import { DURATION, EASE_EXPO_OUT, MICRO } from '@/lib/motion/config'
import type { Transition } from '@/lib/motion/react'

/** @deprecated Prefer EASE_EXPO_OUT from @/lib/motion/config */
export const checkoutEase = EASE_EXPO_OUT

export function checkoutSectionMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }
}

export function checkoutMotionTransition(
  reduced: boolean | null,
  ms: number = DURATION.base,
): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: EASE_EXPO_OUT }
}

export const checkoutTapSpring = { opacity: 0.9, transition: MICRO }
export const checkoutHoverLift = { opacity: 0.92, transition: MICRO }
