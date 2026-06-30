'use client'

import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { getModuleFeatures } from '@/lib/navigation/admin-nav'

/** Fallback when a route has no dedicated panel in the registry. */
export function GenericModulePanel({ navItem, moduleHref }: ModuleContextProps) {
  const features = getModuleFeatures(navItem)

  return (
    <div className="admin-module-card space-y-4 text-center">
      <p className="admin-kpi__label">{navItem.group}</p>
      <h2 className="text-lg font-black text-[#111111]">{navItem.label}</h2>
      <p className="text-sm font-semibold text-[#6B6B6B]">
        This route does not have a dedicated panel yet. No sample data is shown — connect a module component in the
        registry when you are ready to ship it.
      </p>
      <ul className="mx-auto max-w-md space-y-1 text-left text-xs font-semibold text-[#6B6B6B]">
        {features.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <AdminNavLink href="/dashboard" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
          Back to dashboard
        </AdminNavLink>
        <AdminButton className="!text-xs" onClick={() => window.history.back()}>
          Go back
        </AdminButton>
      </div>
      <p className="font-mono text-[10px] text-[#6B6B6B]">{moduleHref}</p>
    </div>
  )
}
