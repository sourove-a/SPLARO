'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const stroke = positive ? '#22C55E' : '#EF4444'
  const path = positive
    ? 'M2 18 L8 14 L14 16 L22 8 L30 10 L38 4'
    : 'M2 6 L8 10 L14 8 L22 16 L30 14 L38 18'
  return (
    <svg viewBox="0 0 40 20" className="h-8 w-full opacity-70" aria-hidden>
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
}: StatCardProps) {
  const isAlert = alertIf ? alertIf(value) : false
  const positive = (change ?? 0) > 0
  const neutral = change === 0 || change === undefined
  const negative = !neutral && !positive

  return (
    <div
      className={cn(
        'admin-kpi relative overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5',
        color === 'gold' && 'admin-kpi--gold',
        color === 'green' && 'admin-kpi--green',
        color === 'red' && 'border-red-200/60',
        isAlert && 'admin-kpi--alert',
      )}
    >
      {loading ? (
        <div className="space-y-3">
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-[#111111]/6" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-[#111111]/6" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-[#111111]/5" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6B6B6B]">
              {title}
            </p>
            <div
              className={cn(
                'admin-stat-icon',
                color === 'gold' && 'admin-stat-icon--gold',
                color === 'green' && 'admin-stat-icon--green',
                color === 'red' && 'text-red-600',
                color === 'default' && !isAlert && 'text-[#6B6B6B]',
                isAlert && 'text-amber-600',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>

          <p
            className={cn(
              'font-black leading-none tracking-tight',
              size === 'md' ? 'text-[1.65rem]' : 'text-xl',
              color === 'default' && !isAlert && 'text-[#111111]',
              color === 'gold' && 'text-[#9a7b52]',
              color === 'green' && 'text-emerald-700',
              color === 'red' && 'text-red-700',
              isAlert && 'text-amber-700',
            )}
          >
            {value}
          </p>

          {change !== undefined ? (
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={cn(
                  'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black',
                  neutral
                    ? 'bg-[#111111]/[0.05] text-[#6B6B6B]'
                    : positive
                      ? 'bg-emerald-100/70 text-emerald-700'
                      : 'bg-red-100/70 text-red-700',
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
              <span className="text-[10px] font-semibold text-[#6B6B6B]/70">vs last period</span>
            </div>
          ) : null}

          {sparkline ? (
            <div className="mt-3 pt-1">
              <MiniSparkline positive={(change ?? 0) >= 0} />
            </div>
          ) : null}
        </>
      )}

      {color === 'gold' && (
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#5E7CFF]/60 to-transparent" />
      )}

      {positive && change !== undefined && !neutral && (
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      )}

      {negative && (
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-400/25 to-transparent" />
      )}
    </div>
  )
}
