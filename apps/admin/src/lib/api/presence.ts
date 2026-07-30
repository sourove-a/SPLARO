import { apiFetch } from './client'

export interface PresenceSnapshot {
  storefront: number
  admin: number
  total: number
  source: 'live' | 'sessions'
  updatedAt: string
}

export function fetchOnlinePresence() {
  return apiFetch<PresenceSnapshot>('/admin/dashboard/presence')
}

export function sendAdminPresenceHeartbeat(visitorId: string) {
  return apiFetch<{ ok: boolean; presence: PresenceSnapshot }>('/admin/dashboard/presence/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ visitorId }),
  })
}
