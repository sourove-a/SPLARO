'use client'

import type { ModuleContextProps } from '@/lib/modules/module-data'
import { getModuleComponent } from '@/lib/modules/registry'
import { ModuleStatusBanner } from '@/components/modules/ModuleStatusBanner'
import { useFeatureFlags } from '@/lib/feature-flags'
import { isAdminHrefFeatureDisabled } from '@splaro/config'
import { getModuleMaturity } from '@/lib/modules/module-maturity'

export function ModuleWorkspace(props: ModuleContextProps) {
  const flags = useFeatureFlags()
  const featureOff = isAdminHrefFeatureDisabled(props.moduleHref, flags)
  const maturity = getModuleMaturity(props.moduleHref)
  // Launch-safe: hide incomplete panels (beta/prototype shells + feature-flagged).
  // Live modules stay usable via bookmark even if sidebar-hidden.
  const blockPanel = featureOff || maturity === 'prototype' || maturity === 'beta'
  const ModuleComponent = getModuleComponent(props.moduleHref)

  return (
    <div className="space-y-4">
      <ModuleStatusBanner moduleHref={props.moduleHref} moduleLabel={props.navItem.label} />
      {blockPanel ? null : <ModuleComponent {...props} />}
    </div>
  )
}
