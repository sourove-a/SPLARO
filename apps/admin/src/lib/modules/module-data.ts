import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import {
  getRouteHighlights,
  getRouteKpis,
  getRouteRecords,
  getRouteTabs,
} from '@/lib/modules/route-overrides'

export interface ModuleContextProps {
  navItem: FlatAdminRoute
  moduleHref: string
  variant?: string | undefined
  subPath?: string[]
  action?: 'create' | 'edit' | 'detail' | null
}

export interface ModuleRecord {
  id: string
  name: string
  status: 'active' | 'pending' | 'draft' | 'archived'
  updated: string
  metric: string
}

export interface ModuleKpi {
  label: string
  value: string | number
  tone?: 'default' | 'gold' | 'success' | 'warning'
}

export function getModuleKpis(navItem: FlatAdminRoute): ModuleKpi[] {
  return getRouteKpis(navItem)
}

export function getModuleRecords(navItem: FlatAdminRoute, count = 8): ModuleRecord[] {
  return getRouteRecords(navItem, count)
}

export function getModuleTabs(navItem: FlatAdminRoute) {
  return getRouteTabs(navItem)
}

export function getModuleHighlights(navItem: FlatAdminRoute): string[] {
  return getRouteHighlights(navItem)
}

export function getModulePipelineStages(navItem: FlatAdminRoute): string[] | null {
  if (navItem.group !== 'Production') return null
  return ['Pending', 'Cutting', 'Sewing', 'Finishing', 'QC', 'Ready']
}
