'use client'

import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  AiAgentPanelLive,
  AiContentPanelLive,
  AiSeoPanelLive,
  AiAnalyticsPanelLive,
  AiCustomerInsightsPanelLive,
  AiSalesPanelLive,
} from '@/components/modules/AiLivePanels'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/ai-agent': AiAgentPanelLive,
  '/dashboard/ai-content': AiContentPanelLive,
  '/dashboard/ai-seo': AiSeoPanelLive,
  '/dashboard/ai-analytics': AiAnalyticsPanelLive,
  '/dashboard/ai-sales': AiSalesPanelLive,
  '/dashboard/ai-customer-insights': AiCustomerInsightsPanelLive,
  '/dashboard/ai-product-generator': AiContentPanelLive,
}

export function AiCenterModulePanel(props: ModuleContextProps) {
  const Panel = PANELS[props.moduleHref]
  return renderModuleSubPanel(Panel, props)
}
