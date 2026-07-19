'use client'

import { RefreshCw } from 'lucide-react'
import { ConnectionChip, type ConnectionChipState } from '@/components/ui/connection/ConnectionChip'
import { cn } from '@/lib/utils/cn'

export interface ModuleLiveItem {
  label: string
  value: string
  ok: boolean
  hint?: string
  href?: string
}

function itemState(ok: boolean): ConnectionChipState {
  return ok ? 'ok' : 'warn'
}

export function ModuleLiveStrip({
  items,
  onRefresh,
  refreshing = false,
  title,
  className,
}: {
  items: ModuleLiveItem[]
  onRefresh?: () => void
  refreshing?: boolean
  title?: string
  className?: string
}) {
  if (!items.length && !onRefresh) return null

  const okCount = items.filter((item) => item.ok).length
  const allOk = okCount === items.length

  return (
    <div className={cn('admin-conn-strip', allOk && 'admin-conn-strip--live', className)} role="status" aria-live="polite">
      {title ? <p className="admin-conn-strip__title">{title}</p> : null}
      <div className="admin-conn-strip__row">
        <div className="admin-conn-strip__chips">
          <span className={cn('admin-conn-strip__pulse', !allOk && 'admin-conn-strip__pulse--warn')} aria-hidden>
            <span className="admin-conn-strip__pulse-dot" />
            {allOk ? 'Live' : `${okCount}/${items.length}`}
          </span>
          {items.map((item) => (
            <ConnectionChip
              key={item.label}
              label={item.label}
              value={item.value}
              {...(item.hint ? { hint: item.hint } : {})}
              {...(item.href ? { href: item.href } : {})}
              state={itemState(item.ok)}
              compact
            />
          ))}
        </div>
        {onRefresh ? (
          <button
            type="button"
            className="admin-conn-strip__refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh module data"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Sync
          </button>
        ) : null}
      </div>
    </div>
  )
}
