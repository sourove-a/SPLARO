import { apiFetch } from './client'

export function updateStaffRole(
  userId: string,
  data: { role?: string; permissions?: string[]; isActive?: boolean },
) {
  return apiFetch<{ updated: boolean }>(`/admin/security/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
