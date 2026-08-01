import { apiFetch } from './client'

export function changeAdminPassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: boolean; message?: string }>('/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
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
