'use client'

import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { getModuleFeatures } from '@/lib/navigation/admin-nav'

/** Fallback when a route has no dedicated panel in the registry. */
export function GenericModulePanel({ navItem, moduleHref }: ModuleContextProps) {
  const features = getModuleFeatures(navItem)

  return (
    <div className="admin-module-card admin-panel-glass-subtle mx-auto max-w-2xl space-y-4 p-8 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
        {navItem.group}
      </p>
      <h2 className="text-lg font-black text-[var(--admin-text-primary)]">{navItem.label}</h2>
      <p className="text-sm font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
        {navItem.description ??
          'This module does not have a dedicated panel yet. No sample data is shown — connect a live panel in the registry when you are ready.'}
      </p>
      <ul className="mx-auto max-w-md space-y-1.5 text-left text-xs font-semibold text-[var(--admin-text-secondary)]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--admin-accent)]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <AdminNavLink href="/dashboard" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
          Back to dashboard
        </AdminNavLink>
        <AdminButton size="sm" onClick={() => window.history.back()}>
          Go back
        </AdminButton>
      </div>
      <p className="font-mono text-[10px] text-[var(--admin-text-muted)]">{moduleHref}</p>
    </div>
  )
}
