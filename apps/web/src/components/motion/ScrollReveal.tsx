'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { revealVariants, type RevealVariant } from '@/lib/motion/variants'

interface ScrollRevealProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'variants'> {
  children: ReactNode
  variant?: RevealVariant
  stagger?: boolean
  once?: boolean
  margin?: string
}

export function ScrollReveal({
  children,
  variant = 'fadeUp',
  stagger = false,
  once,
  margin,
  className,
  ...props
}: ScrollRevealProps) {
  const revealOptions = {
    ...(once !== undefined ? { once } : {}),
    ...(margin !== undefined ? { margin } : {}),
  }
  const { ref, isInView, reducedMotion } = useScrollReveal(revealOptions)
  const variants = stagger ? revealVariants.staggerContainer : revealVariants[variant]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reducedMotion ? false : 'hidden'}
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface ScrollRevealItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode
  variant?: Exclude<RevealVariant, 'staggerContainer'>
}

export function ScrollRevealItem({
  children,
  variant = 'fadeUp',
  className,
  ...props
}: ScrollRevealItemProps) {
  return (
    <motion.div className={className} variants={revealVariants[variant]} {...props}>
      {children}
    </motion.div>
  )
}
