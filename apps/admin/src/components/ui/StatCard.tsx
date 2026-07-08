'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AdminStatSkeleton } from '@/components/ui/AdminUiPrimitives'

interface StatCardProps {
  title: string
  value: string | number
  change?: number | undefined
  icon: React.ElementType
  loading?: boolean
  color?: 'default' | 'gold' | 'green' | 'red'
  size?: 'sm' | 'md'
  alertIf?: (value: string | number) => boolean
  sparkline?: boolean
  emptyHint?: string
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const stroke = positive ? 'var(--admin-success, #15803d)' : 'var(--admin-danger, #dc2626)'
  const path = positive
    ? 'M2 18 L8 14 L14 16 L22 8 L30 10 L38 4'
    : 'M2 6 L8 10 L14 8 L22 16 L30 14 L38 18'
  return (
    <svg viewBox="0 0 40 20" className="h-7 w-full opacity-60" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
            color === 'gold' && 'admin-stat-icon--gold',
            color === 'green' && 'admin-stat-icon--green',
            color === 'red' && 'text-red-600',
            color === 'default' && !isAlert && 'text-[var(--admin-text-muted)]',
            isAlert && 'text-amber-600',
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>

      <p
        className={cn(
          'admin-kpi__value',
          size === 'sm' && '!text-xl',
          isEmpty && 'admin-kpi__value--empty',
          color === 'gold' && !isEmpty && 'text-[var(--admin-brand-gold-strong,#b8956a)]',
          color === 'green' && !isEmpty && 'text-emerald-700',
          color === 'red' && !isEmpty && 'text-red-700',
          isAlert && !isEmpty && 'text-amber-700',
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
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold',
              neutral
                ? 'bg-black/[0.04] text-[var(--admin-text-muted)]'
                : positive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700',
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

      {sparkline && change !== undefined ? (
        <div className="mt-2">
          <MiniSparkline positive={positive || neutral} />
        </div>
      ) : null}
    </div>
  )
}
