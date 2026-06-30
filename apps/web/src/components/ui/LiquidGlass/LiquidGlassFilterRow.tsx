'use client'

import { cn } from '@/lib/utils/cn'
import { LiquidGlassPill } from './LiquidGlassPill'

export interface LiquidGlassFilterItem {
  id: string
  label: string
  emoji?: string
  href?: string
  unavailable?: boolean
}

interface LiquidGlassFilterRowProps {
  items: readonly LiquidGlassFilterItem[]
  activeId: string
  onChange?: (id: string) => void
  goldActive?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LiquidGlassFilterRow({
  items,
  activeId,
  onChange,
  goldActive = false,
  size = 'md',
  className,
}: LiquidGlassFilterRowProps) {
  return (
    <div className={cn('lg-filter-row', className)} role="tablist" aria-label="Filter categories">
      {items.map((item) => {
        const active = activeId === item.id
        const shared = {
          active,
          size,
          children: item.label,
          ...(item.emoji ? { emoji: item.emoji } : {}),
          ...(item.unavailable ? { unavailable: true } : {}),
          ...(goldActive && active ? { gold: true } : {}),
        }

        if (item.href) {
          return (
            <LiquidGlassPill
              key={item.id}
              href={item.href}
              {...shared}
              {...(onChange ? { onClick: () => onChange(item.id) } : {})}
            />
          )
        }

        return (
          <LiquidGlassPill
            key={item.id}
            {...shared}
            onClick={() => onChange?.(item.id)}
          />
        )
      })}
    </div>
  )
}
