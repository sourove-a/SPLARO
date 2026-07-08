import type { PrismaService } from '../../common/prisma.service'
import {
  DEFAULT_ROLE_PERMISSIONS,
  encodePermissionTokens,
  normalizeRoleKey,
  type PermissionRow,
} from './security-permissions.util'

function readRoleMatrix(storefrontConfig: unknown): Record<string, PermissionRow[]> {
  if (!storefrontConfig || typeof storefrontConfig !== 'object') return {}
  const matrix = (storefrontConfig as { adminRolePermissions?: unknown }).adminRolePermissions
  if (!matrix || typeof matrix !== 'object') return {}
  return matrix as Record<string, PermissionRow[]>
}

/** Resolve permission tokens for an admin session (staff row → site matrix → role defaults). */
export async function resolveStaffPermissionTokens(
  prisma: PrismaService,
  userId: string,
  storeId: string,
  role: string,
): Promise<string[]> {
  const roleKey = normalizeRoleKey(role)
  if (roleKey === 'SUPER_ADMIN') return ['*']

  const staff = await prisma.staffRole.findUnique({
    where: { userId_storeId: { userId, storeId } },
    select: { permissions: true, role: true },
  })

  if (staff?.permissions?.length) {
    if (staff.permissions.includes('*')) return ['*']
    return staff.permissions
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { storeId },
    select: { storefrontConfig: true },
  })
  const matrix = readRoleMatrix(settings?.storefrontConfig)
  const fromMatrix = matrix[roleKey] ?? matrix[staff?.role ?? roleKey]
  if (fromMatrix?.length) {
    return encodePermissionTokens(fromMatrix)
  }

  const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] ?? DEFAULT_ROLE_PERMISSIONS.STAFF ?? []
  return encodePermissionTokens(defaults)
}
