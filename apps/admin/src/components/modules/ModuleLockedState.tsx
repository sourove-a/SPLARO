'use client'

import Link from 'next/link'
import { ArrowRight, FlaskConical, Lock, Sparkles, Warehouse } from 'lucide-react'
import { getNavHiddenReason, isNavHiddenFromPrimary } from '@/lib/navigation/admin-nav'
import {
  getModuleMaturity,
  getModuleMaturityMeta,
} from '@/lib/modules/module-maturity'
import { cn } from '@/lib/utils/cn'

interface ModuleLockedStateProps {
  moduleHref: string
  moduleLabel: string
  description?: string
}

function fallbackHref(moduleHref: string): { href: string; label: string } {
  if (moduleHref.startsWith('/dashboard/wms')) {
    return { href: '/dashboard/inventory', label: 'Open Inventory' }
  }
  if (moduleHref.startsWith('/dashboard/procurement') || moduleHref.startsWith('/dashboard/production')) {
    return { href: '/dashboard/operations', label: 'Open Operations Hub' }
  }
  if (moduleHref.startsWith('/dashboard/company')) {
    return { href: '/dashboard', label: 'Back to Dashboard' }
  }
  if (moduleHref.startsWith('/dashboard/support') || moduleHref.startsWith('/dashboard/delivery')) {
    return { href: '/dashboard/courier-hub', label: 'Open Courier Hub' }
  }
  return { href: '/dashboard', label: 'Back to Dashboard' }
}

export function ModuleLockedState({ moduleHref, moduleLabel, description }: ModuleLockedStateProps) {
  const maturity = getModuleMaturity(moduleHref)
  const meta = getModuleMaturityMeta(moduleHref)
  const hidden = isNavHiddenFromPrimary(moduleHref)
  const reason = getNavHiddenReason(moduleHref)
  const fallback = fallbackHref(moduleHref)
  const Icon = maturity === 'prototype' ? Sparkles : FlaskConical

  return (
    <section
      className={cn(
        'admin-module-locked',
        maturity === 'prototype' ? 'admin-module-locked--prototype' : 'admin-module-locked--beta',
      )}
      aria-labelledby="admin-module-locked-title"
    >
      <div className="admin-module-locked__glow" aria-hidden="true" />
      <div className="admin-module-locked__icon" aria-hidden="true">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
        <span className="admin-module-locked__lock">
          <Lock className="h-3 w-3" strokeWidth={2.25} />
        </span>
      </div>

      <p className="admin-module-locked__eyebrow">
        {maturity === 'prototype' ? 'Preview shell' : 'Launch-safe beta'}
      </p>
      <h2 id="admin-module-locked-title" className="admin-module-locked__title">
        {moduleLabel} is not ready for daily ops
      </h2>
      <p className="admin-module-locked__copy">
        {hidden ? reason : meta.hint}
        {description ? ` ${description}` : ''}
        {' '}Incomplete controls stay hidden so nothing fake can be saved by mistake.
      </p>

      <div className="admin-module-locked__meta">
        <span className="admin-module-locked__chip">{meta.label}</span>
        {hidden ? (
          <span className="admin-module-locked__chip admin-module-locked__chip--muted">Sidebar hidden</span>
        ) : null}
        {moduleHref.startsWith('/dashboard/wms') ? (
          <span className="admin-module-locked__chip admin-module-locked__chip--muted">
            <Warehouse className="h-3 w-3" aria-hidden />
            Use Inventory instead
          </span>
        ) : null}
      </div>

      <div className="admin-module-locked__actions">
        <Link href={fallback.href} className="admin-btn admin-btn--primary">
          {fallback.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/dashboard" className="admin-btn admin-btn--ghost">
          Dashboard
        </Link>
      </div>
    </section>
  )
}
