import { useMotionReady } from '@/hooks/useMotionReady'
import type { Transition } from 'framer-motion'

export const authMotionEase = [0.16, 1, 0.3, 1] as const

/** Gate Framer Motion until after hydration — prevents SSR/client attribute mismatches. */
export function useAuthShowMotion(): boolean {
  return useMotionReady().showMotion
}

export function authFadeSlide(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }
}

export function authFormMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      }
}

export function authMotionTransition(reduced: boolean | null, ms = 0.22): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: authMotionEase }
}

export const authTapSpring = { scale: 0.97 }
export const authHoverLift = { y: -1, scale: 1.01 }
