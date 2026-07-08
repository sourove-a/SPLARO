'use client'

import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import type { ReactNode } from 'react'
import { MOTION_DEFAULT } from '@/lib/motion/config'

/**
 * Lazy-loaded Framer Motion (~60% smaller than full bundle).
 * Global defaults: expo easing, user reduced-motion, transform-friendly transitions.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user" transition={MOTION_DEFAULT}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
