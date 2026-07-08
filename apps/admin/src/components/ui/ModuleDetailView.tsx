'use client'

import { BackendNotConnectedView } from '@/components/ui/BackendNotConnectedView'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'

interface ModuleDetailViewProps {
  navItem: FlatAdminRoute
  moduleHref: string
  recordId: string
  mode: 'detail' | 'edit'
}

/** Shown when /:id or /:id/edit is opened without a wired record API. */
export function ModuleDetailView({ navItem, moduleHref, recordId, mode }: ModuleDetailViewProps) {
  const title = mode === 'edit' ? `Edit ${recordId}` : recordId

  return (
    <BackendNotConnectedView
      moduleLabel={navItem.label}
      moduleHref={moduleHref}
      title={title}
      mode={mode}
      recordId={recordId}
    />
  )
}
