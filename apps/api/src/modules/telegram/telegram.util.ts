import type { TelegramRole } from '@prisma/client'

/** Mask numeric IDs for admin UI — never expose full chat/user IDs in logs. */
export function maskTelegramId(id: string): string {
  const s = id.trim()
  if (s.length <= 4) return '****'
  if (s.length <= 8) return `${s.slice(0, 2)}***${s.slice(-1)}`
  return `${s.slice(0, 3)}***${s.slice(-3)}`
}

export function mapStaffRoleToTelegram(role: string): TelegramRole {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'SUPER_ADMIN'
    case 'MANAGER':
      return 'MANAGER'
    case 'FINANCE_STAFF':
      return 'FINANCE_STAFF'
    default:
      return 'ORDER_STAFF'
  }
}
