'use client'

import type { ModuleContextProps } from '@/lib/modules/module-data'
import { getModuleComponent } from '@/lib/modules/registry'
import { ModuleStatusBanner } from '@/components/modules/ModuleStatusBanner'

export function ModuleWorkspace(props: ModuleContextProps) {
  const ModuleComponent = getModuleComponent(props.moduleHref)
  return (
    <div className="space-y-4">
      <ModuleStatusBanner moduleHref={props.moduleHref} moduleLabel={props.navItem.label} />
      <ModuleComponent {...props} />
    </div>
  )
}
