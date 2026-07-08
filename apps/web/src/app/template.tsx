'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { pageEnter } from '@/lib/motion/config'

/** Premium cross-route enter — opacity + slide + micro scale (GPU compositor only). */
export default function RootTemplate({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <>{children}</>
  }

  return (
    <motion.div
      className="scroll-reveal-gpu"
      variants={pageEnter}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  )
}
