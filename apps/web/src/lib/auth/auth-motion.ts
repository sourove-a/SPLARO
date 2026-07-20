import { useMotionReady } from '@/hooks/useMotionReady'
import { DURATION, EASE_EXPO_OUT, MICRO } from '@/lib/motion/config'
import type { Transition } from '@/lib/motion/react'

/** @deprecated Prefer EASE_EXPO_OUT from @/lib/motion/config */
export const authMotionEase = EASE_EXPO_OUT

/** Gate Framer Motion until after hydration — prevents SSR/client attribute mismatches. */
export function useAuthShowMotion(): boolean {
  return useMotionReady().showMotion
}

export function authFadeSlide(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 1, y: 0 },
      }
}

export function authFormMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 1, y: 0 },
      }
}

export function authMotionTransition(
  reduced: boolean | null,
  ms: number = DURATION.base,
): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: EASE_EXPO_OUT }
}

export const authTapSpring = { opacity: 0.96, transition: MICRO }
export const authHoverLift = { opacity: 0.97, transition: MICRO }
