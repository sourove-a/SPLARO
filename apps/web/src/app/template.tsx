'use client'

import { motion } from '@/lib/motion/react'
import type { ReactNode } from 'react'
import { useMotionReady } from '@/hooks/useMotionReady'
import { pageEnter } from '@/lib/motion/config'

/**
 * Premium cross-route enter — ONLY on client navigations.
 * Hard refresh keeps a static tree (no opacity:0 flash).
 */
export default function RootTemplate({ children }: { children: ReactNode }) {
  const { allowEnterAnimation } = useMotionReady()

  if (!allowEnterAnimation) {
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
