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

/** Lucide renames / design-prototype aliases that are not 1:1 with current package exports. */
const ICON_ALIASES: Record<string, string> = {
  ChartColumn: 'BarChart3',
  ChartNoAxesCombined: 'LineChart',
  FileBarChart: 'FileBarChart2',
  House: 'Home',
}

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
  const table = Icons as unknown as Record<string, LucideComponent | undefined>
  const aliased = ICON_ALIASES[pascal] ?? pascal
  return table[aliased] ?? table[pascal] ?? table[`${pascal}Icon`] ?? null
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
    // Unknown icon: visible fallback mark so missing names are obvious (not empty space).
    return (
      <span
        aria-hidden
        className={className}
        title={name ? `Missing icon: ${name}` : undefined}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: size,
          height: size,
          flex: 'none',
          borderRadius: 3,
          border: '1.5px solid currentColor',
          opacity: 0.55,
          ...style,
        }}
      />
    )
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
