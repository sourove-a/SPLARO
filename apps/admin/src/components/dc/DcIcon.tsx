'use client'

import * as Icons from 'lucide-react'
import type { CSSProperties, ComponentType } from 'react'

type LucideComponent = ComponentType<{
  size?: number | undefined
  color?: string | undefined
  strokeWidth?: number | undefined
  style?: CSSProperties | undefined
  className?: string | undefined
  'aria-hidden'?: boolean | undefined
}>

/**
 * Resolves an icon name to a `lucide-react` component.
 *
 * The design prototype uses the lucide-static icon font, so names arrive as
 * `icon-panel-left`. Nav data in `@/lib/navigation/admin-nav` already stores
 * PascalCase (`PanelLeft`). Both forms are accepted.
 */
export function resolveIcon(name?: string): LucideComponent | null {
  if (!name) return null
  const pascal = name.startsWith('icon-')
    ? name
        .slice(5)
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    : name
  const found = (Icons as unknown as Record<string, LucideComponent | undefined>)[pascal]
  return found ?? null
}

export interface DcIconProps {
  name?: string | undefined
  size?: number | undefined
  color?: string | undefined
  style?: CSSProperties | undefined
  className?: string | undefined
}

export function DcIcon({ name, size = 14, color, style, className }: DcIconProps) {
  const Cmp = resolveIcon(name)
  if (!Cmp) {
    // Unknown icon: reserve the same box so rows do not shift.
    return <span aria-hidden style={{ display: 'inline-block', width: size, height: size }} />
  }
  return (
    <Cmp
      size={size}
      color={color ?? 'currentColor'}
      strokeWidth={2}
      aria-hidden
      className={className}
      style={{ flex: 'none', ...style }}
    />
  )
}
