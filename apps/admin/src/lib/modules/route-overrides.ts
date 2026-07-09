import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import type { ModuleKpi, ModuleRecord } from '@/lib/modules/module-data'

export interface RouteTemplate {
  kpis?: ModuleKpi[]
  records?: Omit<ModuleRecord, 'id'>[]
  highlights?: string[]
}

export function getRouteTemplate(navItem: FlatAdminRoute): RouteTemplate {
  return {
    kpis: [],
    records: [],
    highlights: [
      navItem.description ?? `Manage ${navItem.label.toLowerCase()} in SPLARO Commerce OS.`,
      'Live data only — connect API on port 4000 or use the dedicated panel for this route.',
    ],
  }
}

export function getRouteKpis(navItem: FlatAdminRoute): ModuleKpi[] {
  return getRouteTemplate(navItem).kpis ?? []
}

export function getRouteRecords(navItem: FlatAdminRoute, count = 8): ModuleRecord[] {
  const rows = getRouteTemplate(navItem).records ?? []
  return rows.slice(0, count).map((row, index) => ({
    id: `${navItem.label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'MOD'}-${1000 + index + 1}`,
    ...row,
  }))
}

export function getRouteHighlights(navItem: FlatAdminRoute): string[] {
  return getRouteTemplate(navItem).highlights ?? []
}

export function getRouteTabs(navItem: FlatAdminRoute): string[] {
  const base = ['Overview', 'Records', 'Activity']
  const group = navItem.group
  if (group === 'Integrations' || group === 'System' || group === 'Security') return [...base, 'Settings']
  if (group === 'Finance' || group === 'Commerce' || group === 'Production' || group === 'Marketing') {
    return [...base, 'Reports']
  }
  if (group === 'Content') return [...base, 'Preview']
  return base
}
