'use client'

import Link from 'next/link'
import { motion, useReducedMotion, type HTMLMotionProps } from '@/lib/motion/react'
import { forwardRef, type ComponentProps } from 'react'
import { MICRO } from '@/lib/motion/config'

export type MotionPressableVariant = 'cta' | 'icon' | 'chip' | 'nav' | 'subtle'

/** Soft press only — opacity flash, no scale jump on click */
const VARIANT_MOTION: Record<
  MotionPressableVariant,
  Pick<HTMLMotionProps<'button'>, 'whileHover' | 'whileTap'>
> = {
  cta: {
    whileHover: { opacity: 0.92 },
    whileTap: { opacity: 0.88 },
  },
  icon: {
    whileHover: { opacity: 0.88 },
    whileTap: { opacity: 0.82 },
  },
  chip: {
    whileHover: { opacity: 0.92 },
    whileTap: { opacity: 0.88 },
  },
  nav: {
    whileHover: { opacity: 0.88 },
    whileTap: { opacity: 0.82 },
  },
  subtle: {
    whileHover: { opacity: 0.9 },
    whileTap: { opacity: 0.85 },
  },
}

type MotionPressableProps = HTMLMotionProps<'button'> & {
  variant?: MotionPressableVariant
}

export const MotionPressable = forwardRef<HTMLButtonElement, MotionPressableProps>(
  function MotionPressable(
    { variant = 'chip', disabled, children, transition, ...props },
    ref,
  ) {
    const reducedMotion = useReducedMotion()
    const preset = disabled || reducedMotion ? {} : VARIANT_MOTION[variant]

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        data-no-press=""
        transition={transition ?? MICRO}
        {...preset}
        {...props}
      >
        {children}
      </motion.button>
    )
  },
)

type MotionLinkProps = ComponentProps<typeof Link> & {
  variant?: MotionPressableVariant
}

export const MotionLink = forwardRef<HTMLAnchorElement, MotionLinkProps>(function MotionLink(
  { variant = 'subtle', className, children, ...props },
  ref,
) {
  const reducedMotion = useReducedMotion()
  const preset = reducedMotion ? {} : VARIANT_MOTION[variant]

  return (
    <Link ref={ref} className={className} {...props}>
      <motion.span
        className="inline-flex items-center gap-[inherit]"
        transition={MICRO}
        {...preset}
      >
        {children}
      </motion.span>
    </Link>
  )
})

type MotionAnchorProps = HTMLMotionProps<'a'> & {
  variant?: MotionPressableVariant
}

export const MotionAnchor = forwardRef<HTMLAnchorElement, MotionAnchorProps>(function MotionAnchor(
  { variant = 'icon', children, transition, ...props },
  ref,
) {
  const reducedMotion = useReducedMotion()
  const preset = reducedMotion ? {} : VARIANT_MOTION[variant]

  return (
    <motion.a ref={ref} transition={transition ?? MICRO} {...preset} {...props}>
      {children}
    </motion.a>
  )
})
