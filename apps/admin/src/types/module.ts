import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'

export type ModuleMaturity = 'live' | 'beta' | 'prototype'

export interface ModuleContext {
  navItem: FlatAdminRoute
  moduleHref: string
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
