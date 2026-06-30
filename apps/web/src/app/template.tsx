'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const PAGE_EASE = [0.22, 1, 0.36, 1] as const

/** Soft cross-fade on client navigations — no vertical jump. */
export default function RootTemplate({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42, ease: PAGE_EASE }}
    >
      {children}
    </motion.div>
  )
}
