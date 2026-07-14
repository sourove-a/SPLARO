import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { resolveStaffPermissionTokens } from '../../modules/security/staff-permissions.resolver'
import { type AdminSessionPayload } from './admin-session.util'

const STAFF_USER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])

@Injectable()
export class AdminSessionResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Re-validates token claims against live DB state (active user + staff role). */
  async resolveLiveSession(session: AdminSessionPayload): Promise<AdminSessionPayload | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffRoles: {
          select: { role: true, storeId: true },
        },
        ownedStores: {
          select: { id: true },
          take: 5,
        },
      },
    })

    if (!user?.email) return null

    let staff = session.storeId
      ? user.staffRoles.find((row) => row.storeId === session.storeId)
      : user.staffRoles[0]

    // Heal legacy / mis-seeded accounts: active platform admins who own a store
    // but have no StaffRole row (login can succeed via token; APIs would 401).
    if (!staff && STAFF_USER_ROLES.has(user.role)) {
      const storeId =
        session.storeId ??
        user.ownedStores[0]?.id ??
        (
          await this.prisma.store.findFirst({
            where: { slug: 'splaro' },
            select: { id: true },
          })
        )?.id

      if (storeId) {
        const healed = await this.prisma.staffRole.upsert({
          where: { userId_storeId: { userId: user.id, storeId } },
          create: {
            userId: user.id,
            storeId,
            role: user.role === 'CUSTOMER' || user.role === 'VENDOR' ? 'ADMIN' : user.role,
            permissions: user.role === 'SUPER_ADMIN' ? ['*'] : [],
          },
          update: {},
          select: { role: true, storeId: true },
        })
        staff = healed
      }
    }

    if (!staff) return null

    const permissions = await resolveStaffPermissionTokens(
      this.prisma,
      user.id,
      staff.storeId,
      staff.role,
    )

    return {
      userId: user.id,
      email: user.email.toLowerCase(),
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      role: staff.role,
      storeId: staff.storeId,
      permissions,
      exp: session.exp,
    }
  }
}
