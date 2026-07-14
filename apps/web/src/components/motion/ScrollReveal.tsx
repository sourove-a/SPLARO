'use client'

import { motion, type HTMLMotionProps } from '@/lib/motion/react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useMotionReady } from '@/hooks/useMotionReady'
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
  const { allowRevealAnimation } = useMotionReady()
  const revealOptions = useMemo(
    () => ({
      ...(once !== undefined ? { once } : {}),
      ...(margin !== undefined ? { margin } : {}),
    }),
    [once, margin],
  )
  const { ref, isInView, reducedMotion } = useScrollReveal(revealOptions)

  const variants = stagger
    ? revealVariants.staggerContainer
    : reducedMotion
      ? revealVariants.fadeIn
      : revealVariants[variant]

  // Hard refresh: static visible until motion gate opens — no opacity:0 flash
  if (!allowRevealAnimation) {
    return (
      <div ref={ref} className={cn('scroll-reveal-gpu', className)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={cn('scroll-reveal-gpu', isInView && 'scroll-reveal-gpu--revealed', className)}
      initial={isInView ? false : 'hidden'}
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      onAnimationComplete={() => {
        ref.current?.classList.add('scroll-reveal-gpu--revealed')
      }}
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
  const { allowRevealAnimation } = useMotionReady()

  if (!allowRevealAnimation) {
    return (
      <div className={cn('scroll-reveal-gpu', className)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div className={cn('scroll-reveal-gpu', className)} variants={revealVariants[variant]} {...props}>
      {children}
    </motion.div>
  )
}
