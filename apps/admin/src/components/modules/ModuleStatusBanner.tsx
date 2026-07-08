'use client'

import { AlertTriangle, CheckCircle2, FlaskConical, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { getNavHiddenReason, isNavHiddenFromPrimary } from '@/lib/navigation/admin-nav'
import {
  getModuleMaturity,
  getModuleMaturityMeta,
  shouldShowModuleStatusBanner,
} from '@/lib/modules/module-maturity'

interface ModuleStatusBannerProps {
  moduleHref: string
  moduleLabel?: string
}

const ICONS = {
  live: CheckCircle2,
  beta: FlaskConical,
  prototype: Sparkles,
} as const

export function ModuleStatusBanner({ moduleHref, moduleLabel }: ModuleStatusBannerProps) {
  const hidden = isNavHiddenFromPrimary(moduleHref)
  const showMaturity = shouldShowModuleStatusBanner(moduleHref)

  if (!hidden && !showMaturity) return null

  const maturity = getModuleMaturity(moduleHref)
  const meta = getModuleMaturityMeta(moduleHref)
  const Icon = ICONS[maturity]

  return (
    <div className="space-y-2">
      {hidden ? (
        <div className="admin-module-status admin-module-status--beta" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--admin-text)]">Not in sidebar</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
              {getNavHiddenReason(moduleHref)}
            </p>
          </div>
        </div>
      ) : null}
      {showMaturity ? (
        <div className={cn('admin-module-status', meta.className)} role="status">
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--admin-text)]">
              {meta.label}
              {moduleLabel ? ` · ${moduleLabel}` : ''}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">{meta.hint}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
