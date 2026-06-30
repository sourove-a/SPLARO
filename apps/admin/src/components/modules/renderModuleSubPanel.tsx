import type { ReactNode } from 'react'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { GenericModulePanel } from '@/components/modules/GenericModulePanel'

export function renderModuleSubPanel(
  Panel: (() => ReactNode) | undefined,
  props: ModuleContextProps,
) {
  if (!Panel) return <GenericModulePanel {...props} />
  return <>{Panel()}</>
}
