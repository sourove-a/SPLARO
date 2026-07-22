'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { checkoutEnterTransition, checkoutSectionMotion } from '@/lib/checkout/checkout-motion'

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
      transition={checkoutEnterTransition(reduced, delay)}
    >
      {children}
    </motion.section>
  )
}
