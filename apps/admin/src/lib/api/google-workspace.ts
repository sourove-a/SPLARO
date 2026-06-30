import { apiFetch } from '@/lib/api/client'

export interface GoogleWorkspaceStatus {
  connected: boolean
  oauthConnected?: boolean
  oauthConfigReady?: boolean
  oauthLoginHint?: string | null
  oauthEmail?: string | null
  authMode?: 'service_account' | 'oauth'
  serviceAccountEmail?: string | null
  serviceAccountConfigured?: boolean
  googleEmail: string | null
  tokenHealth: string | null
  tokenExpiry: string | null
  lastSyncAt: string | null
  lastError: string | null
  autoSyncEnabled: boolean
  contactsSyncEnabled: boolean
  spreadsheetId: string | null
  spreadsheetUrl: string | null
  driveRootFolderId: string | null
  oauth: {
    clientId: string | null
    clientSecret: string | null
    redirectUri: string | null
    scopesConfigured: boolean
    secretSource?: 'database' | 'env' | null
  }
  services: Record<string, { connected: boolean; lastSyncAt?: string | null; senderEmail?: string | null; folderId?: string | null }>
  recentFailures24h: number
  recentLogs: Array<{ id: string; jobType: string; status: string; sheetTab?: string | null; errorMsg?: string | null; createdAt: string }>
}

export function fetchGoogleStatus() {
  return apiFetch<GoogleWorkspaceStatus>('/admin/google/status')
}

export function fetchGoogleOAuthUrl() {
  return apiFetch<{
    url: string
    redirectUri: string
    scopes: string[]
    loginHint?: string | null
    configured?: boolean
  }>('/admin/google/oauth-url')
}

export function revokeGoogleAccess() {
  return apiFetch<{ ok: boolean; revoked: boolean }>('/admin/google/revoke', { method: 'POST' })
}

export function testGoogleConnection(mode?: 'gmail' | 'sheets' | 'auto') {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : ''
  return apiFetch<{ ok: boolean; message: string; email: string }>(`/admin/google/test${qs}`, { method: 'POST' })
}

export function updateGoogleOAuthSettings(body: { clientId?: string; clientSecret?: string; redirectUri?: string }) {
  return apiFetch<{
    clientId: string | null
    clientSecret: string | null
    redirectUri: string | null
  }>('/admin/google/oauth-settings', { method: 'PUT', body: JSON.stringify(body) })
}

export function fetchGoogleSheetsConfig() {
  return apiFetch<{
    spreadsheetId: string | null
    spreadsheetUrl: string | null
    autoSyncEnabled: boolean
    tabs: Array<{ sheetTab: string; enabled: boolean; lastSyncAt: string | null }>
    allTabs: string[]
  }>('/admin/google/sheets/config')
}

export function linkGoogleSpreadsheet(body: { spreadsheetId?: string; spreadsheetUrl?: string }) {
  return apiFetch<{
    spreadsheetId: string
    spreadsheetUrl: string
    linked: boolean
    orders?: number
    customers?: number
  }>('/admin/google/sheets/link', { method: 'POST', body: JSON.stringify(body) })
}

export function activateGoogleServiceAccount() {
  return apiFetch<{
    ok: boolean
    authMode: 'service_account'
    email: string
    spreadsheetId: string | null
    message: string
  }>('/admin/google/service-account/activate', { method: 'POST' })
}

export function createDefaultSpreadsheet() {
  return apiFetch<{
    spreadsheetId: string
    spreadsheetUrl: string
    tabs: number
    orders?: number
    customers?: number
    subscribers?: number
    products?: number
    productRows?: number
  }>(
    '/admin/google/sheets/create-default',
    { method: 'POST' },
  )
}

export function toggleGoogleAutoSync(enabled: boolean) {
  return apiFetch('/admin/google/sheets/auto-sync', { method: 'PUT', body: JSON.stringify({ enabled }) })
}

export function syncGoogleNow(body?: { jobType?: string; resourceId?: string }) {
  return apiFetch('/admin/google/sheets/sync-now', { method: 'POST', body: JSON.stringify(body ?? {}) })
}

export function fetchGoogleSyncLogs(page = 1) {
  return apiFetch<{ items: unknown[]; total: number; page: number }>(`/admin/google/sync-logs?page=${page}`)
}

export function fetchGoogleAuditLogs(page = 1) {
  return apiFetch<{ items: unknown[]; total: number; page: number }>(`/admin/google/audit-logs?page=${page}`)
}

export function fetchGmailConfig() {
  return apiFetch<{ senderName: string; senderEmail: string | null; connected: boolean }>('/admin/google/gmail/config')
}

export function updateGmailConfig(body: { senderName?: string }) {
  return apiFetch('/admin/google/gmail/config', { method: 'PUT', body: JSON.stringify(body) })
}

export function testGmail(to: string) {
  return apiFetch<{ ok: boolean; messageId: string }>('/admin/google/gmail/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  })
}

export function createDriveFolders() {
  return apiFetch('/admin/google/drive/folders', { method: 'POST' })
}
