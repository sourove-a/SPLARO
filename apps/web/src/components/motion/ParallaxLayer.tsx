'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from '@/lib/motion/react'
import { useMotionReady } from '@/hooks/useMotionReady'
import { cn } from '@/lib/utils/cn'

type ParallaxLayerProps = {
  children: ReactNode
  /** 0.06–0.2 typical. Positive = drifts opposite to scroll (story depth). */
  speed?: number
  className?: string
}

/**
 * Soft parallax depth — story moves, page doesn't jump.
 * Off on lite / Windows / reduced-motion (via useMotionReady reveal gate).
 */
export function ParallaxLayer({ children, speed = 0.12, className }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { allowRevealAnimation } = useMotionReady()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const travel = Math.round(48 * speed)
  const y = useTransform(scrollYProgress, [0, 1], [travel, -travel])

  if (!allowRevealAnimation) {
    return (
      <div ref={ref} className={cn('story-parallax', className)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div ref={ref} style={{ y }} className={cn('story-parallax', className)}>
      {children}
    </motion.div>
  )
}
