import { apiFetch } from './client'
import { setAdminApiToken } from '@/lib/auth/api-token'

export function changeAdminPassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: boolean; message?: string }>('/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function updateAdminProfile(name: string) {
  const res = await fetch('/api/auth/profile', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    apiToken?: string
    user?: { id: string; email: string; name: string; role: string }
  }
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? 'Could not update name')
  }
  if (data.apiToken) setAdminApiToken(data.apiToken)
  return data
}

export function fetchAdminAuthProfile() {
  return apiFetch<{
    user: {
      id: string
      email: string
      name: string
      role: string
      storeId?: string
      permissions?: string[]
    }
    canChangePassword?: boolean
    lastLoginIp?: string | null
    lastLoginAt?: string | null
    requestIp?: string | null
  }>('/admin/auth/me')
}
