'use client'

import { motion, type MotionProps } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface AddToBagIconProps {
  size?: number
  className?: string
}

/** Crisp outline tote — no fill, stays sharp inside glass panels (no backdrop-filter on icon). */
export function AddToBagIcon({ size = 18, className }: AddToBagIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('splaro-bag-icon', className)}
      aria-hidden
    >
      <path
        d="M7.35 9.75h9.3l-.95 10.35H8.3L7.35 9.75Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 9.75V7.35c0-1.63 1.32-2.95 2.95-2.95h.6c1.63 0 2.95 1.32 2.95 2.95v2.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M8.1 12.25h7.8"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.42"
      />
    </svg>
  )
}

type AddToBagIconBadgeProps = AddToBagIconProps & {
  tone?: 'dark' | 'light'
  pulse?: boolean
  motionProps?: MotionProps
}

export function AddToBagIconBadge({
  size = 18,
  className,
  tone = 'dark',
  pulse = false,
  motionProps,
}: AddToBagIconBadgeProps) {
  return (
    <motion.span
      className={cn(
        'splaro-bag-icon-wrap',
        tone === 'dark' ? 'splaro-bag-icon-wrap--dark' : 'splaro-bag-icon-wrap--light',
        className,
      )}
      animate={
        pulse
          ? { scale: [1, 1.14, 1], rotate: [0, -6, 0] }
          : { scale: 1, rotate: 0 }
      }
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      {...motionProps}
    >
      <AddToBagIcon size={size} />
    </motion.span>
  )
}
