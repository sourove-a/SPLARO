import { REGISTERED_MODULE_HREFS } from '@/lib/modules/registry'

export type ModuleMaturity = 'live' | 'beta' | 'prototype'

/** Routes with dedicated live panels in the module registry. */
const LIVE_ROUTES = new Set<string>(['/dashboard', ...REGISTERED_MODULE_HREFS])

/** Custom UI with partial API or planned rollout. */
const BETA_ROUTES = new Set<string>([])

const MATURITY_META: Record<
  ModuleMaturity,
  { label: string; hint: string; className: string }
> = {
  live: {
    label: 'Live',
    hint: 'Connected to SPLARO API — real store data.',
    className: 'admin-module-status--live',
  },
  beta: {
    label: 'Beta',
    hint: 'Partial API — some actions are preview or local-only.',
    className: 'admin-module-status--beta',
  },
  prototype: {
    label: 'Preview',
    hint: 'UI shell with sample data — full API integration coming.',
    className: 'admin-module-status--prototype',
  },
}

export function getModuleMaturity(href: string): ModuleMaturity {
  const normalized = href.replace(/\/+$/, '') || '/dashboard'
  if (LIVE_ROUTES.has(normalized)) return 'live'
  if (BETA_ROUTES.has(normalized)) return 'beta'
  return 'prototype'
}

export function getModuleMaturityMeta(href: string) {
  return MATURITY_META[getModuleMaturity(href)]
}

export function shouldShowModuleStatusBanner(href: string) {
  return getModuleMaturity(href) !== 'live'
}
