'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { revealVariants, type RevealVariant } from '@/lib/motion/variants'
import { cn } from '@/lib/utils/cn'

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
  const { ref, isInView, reducedMotion, coarsePointer } = useScrollReveal(revealOptions)
  const variants = stagger ? revealVariants.staggerContainer : revealVariants[variant]

  if (reducedMotion || coarsePointer) {
    return (
      <div ref={ref} className={cn('scroll-reveal-static', className)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={cn('scroll-reveal-gpu', className)}
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
    <motion.div className={cn('scroll-reveal-gpu', className)} variants={revealVariants[variant]} {...props}>
      {children}
    </motion.div>
  )
}
