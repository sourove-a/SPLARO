'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface DeferUntilVisibleProps {
  children: ReactNode
  /** Reserved min-height while children settle (ssr:false dynamics). */
  minHeight?: number
  className?: string
  /** Kept for API compatibility. */
  deferOnMobile?: boolean
}

/**
 * Stable section shell — no mount/unmount, no content-visibility scroll jumps.
 * Always paints children so hard refresh never tears layout down.
 */
export function DeferUntilVisible({
  children,
  minHeight,
  className,
}: DeferUntilVisibleProps) {
  return (
    <div className={cn(className)} style={minHeight ? { minHeight } : undefined}>
      {children}
    </div>
  )
}
