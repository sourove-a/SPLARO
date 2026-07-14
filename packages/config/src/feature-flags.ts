/**
 * SPLARO feature flags — single source of truth for env → runtime gates.
 * Defaults match `.env.example` (safe for single-store launch).
 *
 * Server (Nest / Next BFF): read `FEATURE_*`.
 * Client (admin nav): also accepts `NEXT_PUBLIC_FEATURE_*` or fetch `/api/v1/features`.
 */

export const FEATURE_FLAG_KEYS = [
  'FEATURE_AI_ENABLED',
  'FEATURE_SAAS_ENABLED',
  'FEATURE_VENDOR_ENABLED',
  'FEATURE_LOYALTY_ENABLED',
  'FEATURE_CHATBOT_ENABLED',
  'FEATURE_GOOGLE_SHEETS',
  'FEATURE_PRINT_AUTO',
] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

/** Canonical camelCase names used in API JSON + admin hooks. */
export type FeatureFlags = {
  ai: boolean
  saas: boolean
  vendor: boolean
  loyalty: boolean
  chatbot: boolean
  googleSheets: boolean
  printAuto: boolean
}

/** Safe launch defaults — half-built multi-tenant / loyalty stay OFF. */
export const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
  ai: true,
  saas: false,
  vendor: false,
  loyalty: false,
  chatbot: true,
  googleSheets: true,
  printAuto: true,
}

const ENV_TO_FLAG: Record<FeatureFlagKey, keyof FeatureFlags> = {
  FEATURE_AI_ENABLED: 'ai',
  FEATURE_SAAS_ENABLED: 'saas',
  FEATURE_VENDOR_ENABLED: 'vendor',
  FEATURE_LOYALTY_ENABLED: 'loyalty',
  FEATURE_CHATBOT_ENABLED: 'chatbot',
  FEATURE_GOOGLE_SHEETS: 'googleSheets',
  FEATURE_PRINT_AUTO: 'printAuto',
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback
  const v = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function readEnvFlag(
  env: Record<string, string | undefined>,
  key: FeatureFlagKey,
  fallback: boolean,
): boolean {
  const publicKey = `NEXT_PUBLIC_${key}`
  return parseBool(env[key] ?? env[publicKey], fallback)
}

/** Parse FEATURE_* / NEXT_PUBLIC_FEATURE_* from any env map. */
export function parseFeatureFlags(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): FeatureFlags {
  const flags = { ...FEATURE_FLAG_DEFAULTS }
  for (const key of FEATURE_FLAG_KEYS) {
    const field = ENV_TO_FLAG[key]
    flags[field] = readEnvFlag(env, key, FEATURE_FLAG_DEFAULTS[field])
  }
  return flags
}

export function isFeatureEnabled(
  flag: keyof FeatureFlags,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return parseFeatureFlags(env)[flag]
}

/**
 * Admin dashboard hrefs gated by each flag.
 * When flag is false → hide from nav + show disabled banner on direct URL.
 */
export const FEATURE_GATED_ADMIN_HREFS: Record<keyof FeatureFlags, readonly string[]> = {
  ai: [
    '/dashboard/ai-agent',
    '/dashboard/ai-content',
    '/dashboard/ai-seo',
    '/dashboard/ai-analytics',
    '/dashboard/ai-sales',
    '/dashboard/ai-customer-insights',
    '/dashboard/ai-product-generator',
    '/dashboard/automation/ai-product-agent',
    '/dashboard/automation/ai-seo-agent',
    '/dashboard/automation/ai-sales-insights',
  ],
  saas: [
    '/dashboard/saas-subscriptions',
    '/dashboard/stores',
    '/dashboard/domains',
    '/dashboard/tenants',
    '/dashboard/billing',
  ],
  vendor: [
    '/dashboard/marketplace/overview',
  ],
  loyalty: [
    '/dashboard/loyalty-program',
    '/dashboard/vip-members',
    '/dashboard/referrals',
    '/dashboard/affiliate',
  ],
  chatbot: [
    '/dashboard/support/live-chat',
  ],
  googleSheets: [
    '/dashboard/google-workspace/sheets-sync',
    '/dashboard/automation/google-sheets-sync',
    '/dashboard/finance/google-sheets-finance',
    '/dashboard/google-workspace/sync-logs',
    '/dashboard/system/sync-logs',
  ],
  printAuto: [],
}

export function featureDisabledReason(flag: keyof FeatureFlags): string {
  const labels: Record<keyof FeatureFlags, string> = {
    ai: 'FEATURE_AI_ENABLED=false — AI Command / agents are off.',
    saas: 'FEATURE_SAAS_ENABLED=false — multi-tenant SaaS UI is off for single-store launch.',
    vendor: 'FEATURE_VENDOR_ENABLED=false — marketplace / multi-vendor is off.',
    loyalty: 'FEATURE_LOYALTY_ENABLED=false — loyalty / VIP / referrals are off.',
    chatbot: 'FEATURE_CHATBOT_ENABLED=false — live chat / chatbot is off.',
    googleSheets: 'FEATURE_GOOGLE_SHEETS=false — Google Sheets sync is off.',
    printAuto: 'FEATURE_PRINT_AUTO=false — auto-print is off.',
  }
  return labels[flag]
}

/** Which flag (if any) disables this admin href. */
export function getFeatureFlagForAdminHref(href: string): keyof FeatureFlags | null {
  const normalized = href.replace(/\/+$/, '') || '/dashboard'
  for (const [flag, hrefs] of Object.entries(FEATURE_GATED_ADMIN_HREFS) as [
    keyof FeatureFlags,
    readonly string[],
  ][]) {
    if (hrefs.some((h) => normalized === h || normalized.startsWith(`${h}/`))) {
      return flag
    }
  }
  return null
}

export function isAdminHrefFeatureDisabled(
  href: string,
  flags: FeatureFlags = parseFeatureFlags(),
): boolean {
  const flag = getFeatureFlagForAdminHref(href)
  if (!flag) return false
  return !flags[flag]
}
