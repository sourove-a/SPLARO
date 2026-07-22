'use client'

import { motion, type MotionProps } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

interface BagIconProps {
  size?: number
  className?: string
  /** Outline weight — ILYN product card uses ~1.37 */
  strokeWidth?: number
  /** Filled body (mobile dock active state) */
  filled?: boolean
  /**
   * Handle / plus cut color when filled.
   * Pass dock background (e.g. `#f7f7f8`) so details read as notches.
   */
  cutColor?: string
  /**
   * Center “+” — ILYN product-card add-to-bag style.
   * Off for header / cart chrome (bag only).
   */
  plus?: boolean
}

/**
 * ILYN-style shopping bag — arched handle, rounded body, optional center plus.
 * Path adapted from https://ilyn.global product-card “Show Details” / bag control.
 */
export function BagIcon({
  size = 18,
  className,
  strokeWidth = 1.37,
  filled = false,
  cutColor = '#fff',
  plus = false,
}: BagIconProps) {
  const detailStroke = filled ? cutColor : 'currentColor'
  const sw = filled ? strokeWidth + 0.15 : strokeWidth

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('splaro-bag-icon', filled && 'splaro-bag-icon--filled', className)}
      aria-hidden
    >
      {filled ? (
        <path
          d="M4.18 7.83H19.31C19.49 7.83 19.66 7.90 19.79 8.03C19.92 8.16 20 8.33 20 8.51V17.85C20 19.15 18.89 20.20 17.59 20.20H5.90C4.60 20.20 3.5 19.09 3.5 17.80V8.51C3.5 8.33 3.57 8.16 3.70 8.03C3.83 7.90 4.00 7.83 4.18 7.83Z"
          fill="currentColor"
        />
      ) : null}
      {/* Body + arched handle (ILYN geometry) */}
      <path
        d="M7.62 7.83V6.45C7.62 5.36 8.05 4.31 8.83 3.53C9.60 2.76 10.65 2.33 11.75 2.33C12.84 2.33 13.89 2.76 14.66 3.53C15.44 4.31 15.87 5.36 15.87 6.45V7.83M4.18 7.83C4.00 7.83 3.83 7.90 3.70 8.03C3.57 8.16 3.5 8.33 3.5 8.51V17.80C3.5 19.09 4.60 20.20 5.90 20.20H17.59C18.89 20.20 20 19.15 20 17.85V8.51C20 8.33 19.92 8.16 19.79 8.03C19.66 7.90 19.49 7.83 19.31 7.83H4.18Z"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {plus ? (
        <>
          <path
            d="M11.75 11.26V16.76"
            stroke={detailStroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <path
            d="M14.5 14.01H9"
            stroke={detailStroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  )
}

/** Add-to-bag glyph — always includes the ILYN center plus. */
export function AddToBagIcon({
  size = 18,
  className,
  strokeWidth = 1.37,
}: Pick<BagIconProps, 'size' | 'className' | 'strokeWidth'>) {
  return (
    <BagIcon
      size={size}
      strokeWidth={strokeWidth}
      plus
      {...(className ? { className } : {})}
    />
  )
}

type AddToBagIconBadgeProps = {
  size?: number
  className?: string
  strokeWidth?: number
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
  strokeWidth,
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
      <BagIcon size={size} strokeWidth={strokeWidth ?? 1.37} plus />
    </motion.span>
  )
}
