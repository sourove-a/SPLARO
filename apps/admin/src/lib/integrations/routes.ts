/** Canonical admin routes for each integration setup screen. */
export const INTEGRATION_SETUP_PATHS: Record<string, string> = {
  telegram: '/dashboard/settings?section=notifications#telegram',
  openai: '/dashboard/ai-agent',
  google_sheets: '/dashboard/google-workspace/sheets-sync',
  gmail: '/dashboard/google-workspace/gmail',
  google_drive: '/dashboard/google-workspace/drive',
  bkash: '/dashboard/settings?section=payments',
  nagad: '/dashboard/settings?section=payments',
  sslcommerz: '/dashboard/settings?section=payments',
  steadfast: '/dashboard/settings?section=infrastructure',
  pathao: '/dashboard/settings?section=infrastructure',
  redx: '/dashboard/settings?section=infrastructure',
  cloudflare_r2: '/dashboard/settings?section=infrastructure',
  smtp: '/dashboard/settings?section=notifications',
  sms: '/dashboard/email-sms',
  meta_pixel: '/dashboard/settings?section=marketing',
  google_analytics: '/dashboard/settings?section=marketing',
  search_console: '/dashboard/seo-health',
}

const GOOGLE_OAUTH_PROVIDERS = new Set(['gmail', 'google_sheets', 'google_drive'])

export function integrationSetupPath(provider: string, connected = false): string {
  if (!connected && GOOGLE_OAUTH_PROVIDERS.has(provider)) {
    return '/dashboard/google-workspace/connect'
  }
  return INTEGRATION_SETUP_PATHS[provider] ?? '/dashboard/all-integrations'
}

export function integrationActionLabel(connected: boolean): string {
  return connected ? 'Manage' : 'Connect'
}
