'use client'

import { RefreshCw } from 'lucide-react'
import { ConnectionChip, type ConnectionChipState } from '@/components/ui/connection/ConnectionChip'
import { cn } from '@/lib/utils/cn'

export interface ModuleLiveItem {
  label: string
  value: string
  ok: boolean
  /** When false and ok is false, chip is hard offline (not soft warn). */
  critical?: boolean
  /** Informational chip — never counts toward strip “Live” label. */
  informational?: boolean
  hint?: string
  href?: string
}

function itemState(item: ModuleLiveItem): ConnectionChipState {
  if (item.ok) return 'ok'
  return item.critical ? 'off' : 'warn'
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

  const healthItems = items.filter((item) => !item.informational)
  const okCount = healthItems.filter((item) => item.ok).length
  const allHealthOk = healthItems.length > 0 && okCount === healthItems.length
  const anyCriticalOff = healthItems.some((item) => !item.ok && item.critical)

  const pulseLabel =
    healthItems.length === 0
      ? 'Status'
      : allHealthOk
        ? 'Live'
        : anyCriticalOff
          ? 'Offline'
          : `${okCount}/${healthItems.length}`

  return (
    <div
      className={cn(
        'admin-conn-strip',
        allHealthOk && 'admin-conn-strip--live',
        anyCriticalOff && 'admin-conn-strip--off',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {title ? <p className="admin-conn-strip__title">{title}</p> : null}
      <div className="admin-conn-strip__row">
        <div className="admin-conn-strip__chips">
          <span
            className={cn(
              'admin-conn-strip__pulse',
              !allHealthOk && !anyCriticalOff && 'admin-conn-strip__pulse--warn',
              anyCriticalOff && 'admin-conn-strip__pulse--off',
            )}
            aria-hidden
          >
            <span className="admin-conn-strip__pulse-dot" />
            {pulseLabel}
          </span>
          {items.map((item) => (
            <ConnectionChip
              key={item.label}
              label={item.label}
              value={item.value}
              {...(item.hint ? { hint: item.hint } : {})}
              {...(item.href ? { href: item.href } : {})}
              state={itemState(item)}
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
