'use client'

import Link from 'next/link'
import { motion, useReducedMotion, type HTMLMotionProps } from '@/lib/motion/react'
import { forwardRef, type ComponentProps } from 'react'
import { PRESS_DOWN, SETTLE } from '@/lib/motion/config'

export type MotionPressableVariant = 'cta' | 'icon' | 'chip' | 'nav' | 'subtle'

/**
 * Soft press only — quiet opacity, no scale jump.
 *
 * Hover and press are not the same gesture and must not share a duration.
 * A press is an answer and has to be instantaneous (`PRESS_DOWN`, 0.08s); a
 * hover is the surface noticing you and should arrive softly — which is what
 * `SETTLE` ("soft UI settle (nav, soft hover)") is for. Both transitions were
 * already defined in `motion/config`; this component ran hover at press speed,
 * so a cursor crossing a row of icons set off a rattle of 80ms flickers
 * instead of one calm shift.
 */
const VARIANT_MOTION: Record<
  MotionPressableVariant,
  Pick<HTMLMotionProps<'button'>, 'whileHover' | 'whileTap'>
> = {
  cta: {
    whileHover: { opacity: 0.94, transition: SETTLE },
    whileTap: { opacity: 0.9, transition: PRESS_DOWN },
  },
  icon: {
    whileHover: { opacity: 0.88, transition: SETTLE },
    whileTap: { opacity: 0.82, transition: PRESS_DOWN },
  },
  chip: {
    whileHover: { opacity: 0.94, transition: SETTLE },
    whileTap: { opacity: 0.9, transition: PRESS_DOWN },
  },
  nav: {
    whileHover: { opacity: 0.88, transition: SETTLE },
    whileTap: { opacity: 0.82, transition: PRESS_DOWN },
  },
  subtle: {
    whileHover: { opacity: 0.92, transition: SETTLE },
    whileTap: { opacity: 0.88, transition: PRESS_DOWN },
  },
}

type MotionPressableProps = HTMLMotionProps<'button'> & {
  variant?: MotionPressableVariant
}

export const MotionPressable = forwardRef<HTMLButtonElement, MotionPressableProps>(
  function MotionPressable(
    { variant = 'chip', disabled, children, transition, tabIndex, ...props },
    ref,
  ) {
    const reducedMotion = useReducedMotion()
    const preset = disabled || reducedMotion ? {} : VARIANT_MOTION[variant]

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        tabIndex={tabIndex ?? 0}
        data-no-press=""
        transition={transition ?? PRESS_DOWN}
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
        tabIndex={-1}
        transition={PRESS_DOWN}
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
  { variant = 'icon', children, transition, tabIndex, ...props },
  ref,
) {
  const reducedMotion = useReducedMotion()
  const preset = reducedMotion ? {} : VARIANT_MOTION[variant]

  return (
    <motion.a
      ref={ref}
      tabIndex={tabIndex ?? 0}
      transition={transition ?? PRESS_DOWN}
      {...preset}
      {...props}
    >
      {children}
    </motion.a>
  )
})
