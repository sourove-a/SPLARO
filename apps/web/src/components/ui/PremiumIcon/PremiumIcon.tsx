import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type PremiumIconSize = 'xs' | 'sm' | 'md' | 'lg'

type PremiumIconProps = {
  icon: LucideIcon
  size?: PremiumIconSize
  /** Active / selected state — deeper ink, brighter edge */
  active?: boolean
  className?: string
  strokeWidth?: number
}

/**
 * SPLARO Premium Icon — custom glass circle shell.
 * Lucide is only the glyph; the look is Pearl: layered disk,
 * ambient shadow, soft reflection. Never bare Lucide for chrome.
 */
export function PremiumIcon({
  icon: Icon,
  size = 'md',
  active = false,
  className,
  strokeWidth = 1.7,
}: PremiumIconProps) {
  return (
    <span
      className={cn(
        'premium-icon',
        `premium-icon--${size}`,
        active && 'premium-icon--active',
        className,
      )}
      aria-hidden
    >
      <span className="premium-icon__ambient" />
      <span className="premium-icon__disk">
        <span className="premium-icon__surface" />
        <span className="premium-icon__sheen" />
        <span className="premium-icon__glyph">
          <Icon strokeWidth={strokeWidth} absoluteStrokeWidth />
        </span>
      </span>
    </span>
  )
}
