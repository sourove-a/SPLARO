'use client'

import { SeoHealthPanel } from '@/components/modules/SeoHealthPanel'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  KeywordsPanelLive,
  IndexMonitorPanelLive,
  SchemaManagerPanelLive,
  SitemapManagerPanelLive,
  RedirectManagerPanelLive,
} from '@/components/modules/SeoLivePanels'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/seo-health': () => <SeoHealthPanel />,
  '/dashboard/keywords': KeywordsPanelLive,
  '/dashboard/index-monitor': IndexMonitorPanelLive,
  '/dashboard/schema-manager': SchemaManagerPanelLive,
  '/dashboard/sitemap-manager': SitemapManagerPanelLive,
  '/dashboard/redirect-manager': RedirectManagerPanelLive,
}

export function SeoModulePanel(props: ModuleContextProps) {
  const Panel = PANELS[props.moduleHref]
  return renderModuleSubPanel(Panel, props)
}
