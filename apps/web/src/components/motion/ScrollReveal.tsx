'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
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
  const revealOptions = useMemo(
    () => ({
      ...(once !== undefined ? { once } : {}),
      ...(margin !== undefined ? { margin } : {}),
    }),
    [once, margin],
  )
  const { ref, isInView, reducedMotion } = useScrollReveal(revealOptions)
  // Under prefers-reduced-motion, drop translate/scale (the kind of movement
  // the setting exists to prevent) but keep a soft opacity fade — WCAG only
  // requires killing large/parallax-style motion, and a fully static swap
  // reads as "nothing is happening" on a page that's meant to feel alive.
  const variants = stagger
    ? revealVariants.staggerContainer
    : reducedMotion
      ? revealVariants.fadeIn
      : revealVariants[variant]

  return (
    <motion.div
      ref={ref}
      className={cn('scroll-reveal-gpu', className)}
      initial="hidden"
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
