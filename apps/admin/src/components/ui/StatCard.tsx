'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AdminStatSkeleton } from '@/components/ui/AdminUiPrimitives'

export type StatIconTone = 'default' | 'gold' | 'green' | 'red' | 'sky' | 'teal' | 'amber' | 'rose' | 'slate'

interface StatCardProps {
  title: string
  value: string | number
  change?: number | undefined
  icon: React.ElementType
  loading?: boolean
  color?: StatIconTone
  size?: 'sm' | 'md'
  alertIf?: (value: string | number) => boolean
  sparkline?: boolean
  /** Real series for sparkline — decorative fake paths are never drawn without this. */
  sparklineValues?: number[]
  emptyHint?: string
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 40
  const h = 20
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const positive = values[values.length - 1]! >= values[0]!
  const stroke = positive ? 'var(--admin-success, #15803d)' : 'var(--admin-danger, #dc2626)'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full opacity-60" aria-hidden>
      <path d={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICON_TONE_CLASS: Record<StatIconTone, string> = {
  default: 'admin-stat-icon--slate',
  gold: 'admin-stat-icon--gold',
  green: 'admin-stat-icon--green',
  red: 'admin-stat-icon--rose',
  sky: 'admin-stat-icon--sky',
  teal: 'admin-stat-icon--teal',
  amber: 'admin-stat-icon--amber',
  rose: 'admin-stat-icon--rose',
  slate: 'admin-stat-icon--slate',
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  loading,
  color = 'default',
  size = 'md',
  alertIf,
  sparkline = false,
  sparklineValues,
  emptyHint,
}: StatCardProps) {
  const isEmpty = value === '—' || value === '…'
  const isAlert = alertIf ? alertIf(value) : false
  const positive = (change ?? 0) > 0
  const neutral = change === 0 || change === undefined

  if (loading) {
    return <AdminStatSkeleton />
  }

  return (
    <div
      className={cn(
        'admin-kpi',
        color === 'gold' && 'admin-kpi--gold',
        color === 'green' && 'admin-kpi--green',
        color === 'red' && 'border-red-200/60',
        isAlert && 'admin-kpi--alert',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="admin-kpi__label">{title}</p>
        <div
          className={cn(
            'admin-stat-icon',
            ICON_TONE_CLASS[color],
            isAlert && 'admin-stat-icon--amber',
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>

      <p
        className={cn(
          'admin-kpi__value',
          size === 'sm' && '!text-xl',
          isEmpty && 'admin-kpi__value--empty',
          color === 'gold' && !isEmpty && 'admin-kpi__value--warning',
          color === 'green' && !isEmpty && 'admin-kpi__value--success',
          (color === 'red' || color === 'rose') && !isEmpty && 'admin-kpi__value--danger',
          isAlert && !isEmpty && 'admin-kpi__value--warning',
        )}
      >
        {value}
      </p>

      {isEmpty && emptyHint ? (
        <p className="admin-kpi__empty-hint">{emptyHint}</p>
      ) : null}

      {change !== undefined ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
              neutral
                ? 'bg-black/[0.05] text-[var(--admin-text-muted)] dark:bg-white/[0.08] dark:text-white/55'
                : positive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                  : 'bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300',
            )}
          >
            {neutral ? (
              <Minus className="h-2.5 w-2.5" />
            ) : positive ? (
              <ArrowUp className="h-2.5 w-2.5" />
            ) : (
              <ArrowDown className="h-2.5 w-2.5" />
            )}
            {Math.abs(change)}%
          </span>
          <span className="text-[10px] font-semibold text-[var(--admin-text-muted)]">vs last period</span>
        </div>
      ) : null}

      {sparkline && sparklineValues && sparklineValues.length >= 2 ? (
        <div className="mt-2">
          <MiniSparkline values={sparklineValues} />
        </div>
      ) : null}
    </div>
  )
}
