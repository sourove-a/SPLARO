'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { EASE_EXPO_OUT } from '@/lib/motion/config'
import { fadeUpSoft, staggerContainer } from '@/lib/motion/variants'

export const PRODUCT_GALLERY_MS = 0.38

export const productGalleryEase = EASE_EXPO_OUT

export const productGalleryMotion = {
  initial: { opacity: 0, scale: 1.018 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.986 },
}

export const productShake: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -7, 7, -5, 5, -2, 0],
    transition: { duration: 0.45, ease: EASE_EXPO_OUT },
  },
}

export function ProductStagger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  )
}

export function ProductReveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div className={className} variants={fadeUpSoft}>
      {children}
    </motion.div>
  )
}

export function ProductFadeSwap({
  children,
  motionKey,
  className,
}: {
  children: ReactNode
  motionKey: string
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <span className={className}>{children}</span>

  return (
    <motion.span
      key={motionKey}
      className={className}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: EASE_EXPO_OUT }}
    >
      {children}
    </motion.span>
  )
}
