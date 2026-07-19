import type { Transition } from '@/lib/motion/react'

export const checkoutEase = [0.16, 1, 0.3, 1] as const

export function checkoutSectionMotion(reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }
}

export function checkoutMotionTransition(reduced: boolean | null, ms = 0.24): Transition {
  return reduced ? { duration: 0 } : { duration: ms, ease: checkoutEase }
}

export const checkoutTapSpring = { opacity: 0.9 }
export const checkoutHoverLift = { opacity: 0.92 }
