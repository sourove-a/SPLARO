'use client'

import { AnimatePresence, motion } from '@/lib/motion/react'
import type { ReactNode } from 'react'
import { useMotionReady } from '@/hooks/useMotionReady'
import { exitPop } from '@/lib/motion/variants'
import { cn } from '@/lib/utils/cn'

interface MotionSwapLabelProps {
  /** Stable key per visible label state — drives enter/exit. */
  id: string
  children: ReactNode
  className?: string
}

/** Swaps inline label text with AnimatePresence exit pop — keeps CTA width stable. */
export function MotionSwapLabel({ id, children, className }: MotionSwapLabelProps) {
  const { showMotion } = useMotionReady()

  if (!showMotion) {
    return <span className={className}>{children}</span>
  }

  return (
    <span className={cn('relative inline-grid place-items-center', className)} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={id}
          className="col-start-1 row-start-1 whitespace-nowrap"
          variants={exitPop}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
