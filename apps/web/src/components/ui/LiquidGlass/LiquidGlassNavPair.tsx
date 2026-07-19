'use client'

import { cn } from '@/lib/utils/cn'
import { LiquidGlassNavButton } from './LiquidGlassNavButton'

interface LiquidGlassNavPairProps {
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/** Paired white-glass prev/next controls — premium square buttons. */
export function LiquidGlassNavPair({
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  className,
  size = 'sm',
}: LiquidGlassNavPairProps) {
  return (
    <div className={cn('glass-nav-pair', className)} role="group" aria-label="Gallery navigation">
      <LiquidGlassNavButton
        direction="left"
        size={size}
        onClick={onPrev}
        disabled={prevDisabled}
      />
      <LiquidGlassNavButton
        direction="right"
        size={size}
        onClick={onNext}
        disabled={nextDisabled}
      />
    </div>
  )
}
