'use client'

import Link from 'next/link'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ComponentProps } from 'react'
import { SPRING } from '@/lib/motion/variants'

export type MotionPressableVariant = 'cta' | 'icon' | 'chip' | 'nav' | 'subtle'

const VARIANT_MOTION: Record<
  MotionPressableVariant,
  Pick<HTMLMotionProps<'button'>, 'whileHover' | 'whileTap'>
> = {
  cta: { whileHover: { y: -1 }, whileTap: { scale: 0.985 } },
  icon: { whileHover: { scale: 1.05, y: -1 }, whileTap: { scale: 0.93 } },
  chip: { whileHover: { scale: 1.03 }, whileTap: { scale: 0.96 } },
  nav: { whileHover: { scale: 1.06 }, whileTap: { scale: 0.9 } },
  subtle: { whileHover: { y: -1 }, whileTap: { scale: 0.98 } },
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
        transition={transition ?? SPRING}
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
        transition={SPRING}
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
    <motion.a ref={ref} transition={transition ?? SPRING} {...preset} {...props}>
      {children}
    </motion.a>
  )
})
