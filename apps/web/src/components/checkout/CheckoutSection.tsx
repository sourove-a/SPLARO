'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { checkoutMotionTransition, checkoutSectionMotion } from '@/lib/checkout/checkout-motion'

interface CheckoutSectionProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function CheckoutSection({ children, className = '', delay = 0 }: CheckoutSectionProps) {
  const reduced = useReducedMotion()

  return (
    <motion.section
      className={className}
      {...checkoutSectionMotion(reduced)}
      transition={{
        ...checkoutMotionTransition(reduced, 0.28),
        delay: reduced ? 0 : delay,
      }}
    >
      {children}
    </motion.section>
  )
}
