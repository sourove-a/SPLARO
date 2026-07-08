'use client'

import { BackendNotConnectedView } from '@/components/ui/BackendNotConnectedView'

interface ModuleCreateViewProps {
  moduleLabel: string
  moduleHref: string
  pageTitle: string
}

/** Shown when /new is opened on a module without a wired create API. */
export function ModuleCreateView({ moduleLabel, moduleHref, pageTitle }: ModuleCreateViewProps) {
  return (
    <BackendNotConnectedView
      moduleLabel={moduleLabel}
      moduleHref={moduleHref}
      title={pageTitle}
      mode="create"
    />
  )
}
