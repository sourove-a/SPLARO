'use client'

import { CheckCircle2, FlaskConical, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
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
  if (!shouldShowModuleStatusBanner(moduleHref)) return null

  const maturity = getModuleMaturity(moduleHref)
  const meta = getModuleMaturityMeta(moduleHref)
  const Icon = ICONS[maturity]

  return (
    <div className={cn('admin-module-status', meta.className)} role="status">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#111111]">
          {meta.label}
          {moduleLabel ? ` · ${moduleLabel}` : ''}
        </p>
        <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#52525b]">{meta.hint}</p>
      </div>
    </div>
  )
}
