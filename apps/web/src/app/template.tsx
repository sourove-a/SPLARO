'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useMotionReady } from '@/hooks/useMotionReady'
import { pageEnter } from '@/lib/motion/config'

/** Premium cross-route enter — gated after hydration to avoid SSR/client mismatch. */
export default function RootTemplate({ children }: { children: ReactNode }) {
  const { showMotion } = useMotionReady()

  if (!showMotion) {
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
