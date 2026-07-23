'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type SplaroNavSize = 'sm' | 'md' | 'lg'
type SplaroNavVariant = 'default' | 'glass-dark'

interface LiquidGlassNavButtonProps {
  direction: 'left' | 'right'
  onClick?: () => void
  disabled?: boolean
  className?: string
  size?: SplaroNavSize
  variant?: SplaroNavVariant
  overlay?: boolean
  'aria-label'?: string
}

const ICON_SIZE: Record<SplaroNavSize, number> = {
  sm: 16,
  md: 18,
  lg: 18,
}

/** Pearl glass circle nav chevron — layered ambient + soft reflection via CSS. */
export function LiquidGlassNavButton({
  direction,
  onClick,
  disabled = false,
  className,
  size = 'sm',
  variant = 'default',
  overlay = false,
  'aria-label': ariaLabel,
}: LiquidGlassNavButtonProps) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  const label = ariaLabel ?? (direction === 'left' ? 'Previous' : 'Next')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'splaro-nav-btn',
        'premium-nav-btn',
        size === 'sm' && 'splaro-nav-btn--sm',
        size === 'lg' && 'splaro-nav-btn--lg',
        variant === 'glass-dark' && 'splaro-nav-btn--glass-dark',
        overlay && 'splaro-nav-btn--overlay',
        direction === 'left' ? 'splaro-nav-btn--prev' : 'splaro-nav-btn--next',
        className,
      )}
    >
      <span className="premium-nav-btn__sheen" aria-hidden />
      <Icon size={ICON_SIZE[size]} strokeWidth={2} absoluteStrokeWidth />
    </button>
  )
}
