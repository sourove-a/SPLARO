import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { UserRole } from '@prisma/client'
import type { Request } from 'express'
import { hashPassword } from '../../common/password.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PlatformService } from '../platform/platform.service'
import {
  DEFAULT_ROLE_PERMISSIONS,
  encodePermissionTokens,
  decodePermissionTokens,
  normalizeRoleKey,
  ROLE_API_TO_UI,
  type PermissionRow,
} from './security-permissions.util'

const CEO_EMAIL = (process.env['ADMIN_EMAIL'] ?? process.env['CEO_EMAIL'] ?? 'splaro.bd@gmail.com')
  .trim()
  .toLowerCase()

const INVITABLE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

export interface InviteStaffInput {
  email: string
  firstName: string
  lastName?: string
  role: string
  password: string
}

@Injectable()
export class SecurityService {
  constructor(
    private readonly platform: PlatformService,
    private readonly prisma: PrismaService,
  ) {}

  overview(storeId: string, actor?: AdminSessionPayload) {
    this.assertCanViewSecurity(actor)
    return this.platform.getSecurity(storeId)
  }

  private assertCanViewSecurity(actor?: AdminSessionPayload) {
    const role = this.actorRole(actor)
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
      throw new ForbiddenException('Insufficient permissions to view security data')
    }
  }

  private assertSuperAdmin(actor?: AdminSessionPayload) {
    if (this.actorRole(actor) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can perform this action')
    }
  }

  private actorRole(actor?: AdminSessionPayload): string {
    return actor?.role?.toUpperCase() ?? ''
  }

  private assertCanInvite(actor?: AdminSessionPayload) {
    if (this.actorRole(actor) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can invite admin users')
    }
  }

  private assertCanManageStaff(actor?: AdminSessionPayload) {
    const role = this.actorRole(actor)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      throw new ForbiddenException('Insufficient permissions to manage staff')
    }
  }

  private assertCanRemoveStaff(actor?: AdminSessionPayload) {
    if (this.actorRole(actor) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can remove admin users')
    }
  }

  private assertRoleAssignment(actor: AdminSessionPayload | undefined, role: string) {
    const normalized = role.toUpperCase() as UserRole
    if (!INVITABLE_ROLES.has(normalized)) {
      throw new BadRequestException(`Invalid role: ${role}`)
    }
    if (normalized === 'SUPER_ADMIN' && this.actorRole(actor) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can assign Super Admin role')
    }
  }

  private async assertTargetEditable(storeId: string, userId: string, email?: string | null) {
    if (email?.trim().toLowerCase() === CEO_EMAIL) {
      throw new ForbiddenException('CEO account cannot be modified')
    }
    const staff = await this.prisma.staffRole.findUnique({
      where: { userId_storeId: { userId, storeId } },
    })
    if (!staff) throw new NotFoundException('Staff member not found for this store')
  }

  private async writeAudit(
    storeId: string | undefined,
    actor: AdminSessionPayload | undefined,
    action: string,
    resourceId: string,
    newData?: Record<string, unknown>,
    oldData?: Record<string, unknown>,
    req?: AdminRequest,
    resource = 'staff',
  ) {
    await this.prisma.auditLog.create({
      data: {
        storeId,
        userId: actor?.userId !== 'admin_env_user' ? actor?.userId : undefined,
        action,
        module: 'security',
        resource,
        resourceId,
        newData: newData as never,
        oldData: oldData as never,
        ipAddress: req?.ip ?? req?.socket?.remoteAddress ?? undefined,
        userAgent: req?.headers['user-agent']?.toString(),
        source: 'WEB',
      },
    })
  }

  async inviteStaff(storeIdRaw: string, body: InviteStaffInput, actor?: AdminSessionPayload, req?: AdminRequest) {
    this.assertCanInvite(actor)

    const email = body.email?.trim().toLowerCase()
    const firstName = body.firstName?.trim()
    const lastName = body.lastName?.trim() ?? ''
    const password = body.password ?? ''

    if (!email || !email.includes('@')) throw new BadRequestException('Valid email is required')
    if (!firstName) throw new BadRequestException('First name is required')
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters')
    if (email === CEO_EMAIL) throw new ForbiddenException('CEO email is reserved')

    const role = body.role?.toUpperCase() as UserRole
    this.assertRoleAssignment(actor, role)

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    const storedPerms = await this.readRolePermissionStore(storeId)
    const permRows = storedPerms[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? []
    const permissionTokens = role === 'SUPER_ADMIN' ? ['*'] : encodePermissionTokens(permRows)

    const existingStaff = await this.prisma.staffRole.findFirst({
      where: { storeId, user: { email } },
      include: { user: { select: { id: true, email: true } } },
    })
    if (existingStaff) {
      throw new ConflictException('This email already has admin access for this store')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({ where: { email } })

      if (user) {
        if (!user.isActive) {
          throw new BadRequestException('User account is inactive — reactivate before granting admin access')
        }
      } else {
        user = await tx.user.create({
          data: {
            email,
            emailVerified: true,
            passwordHash: hashPassword(password),
            firstName,
            lastName: lastName || 'Staff',
            role,
            isActive: true,
          },
        })
      }

      const staffRole = await tx.staffRole.create({
        data: {
          userId: user.id,
          storeId,
          role,
          permissions: permissionTokens,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
              lastLoginAt: true,
              twoFAEnabled: true,
            },
          },
        },
      })

      return staffRole
    })

    await this.writeAudit(
      storeId,
      actor,
      'staff.invited',
      result.userId,
      { email, role },
      undefined,
      req,
    )

    return {
      id: result.user.id,
      email: result.user.email,
      name: `${result.user.firstName} ${result.user.lastName}`.trim(),
      role: result.role,
      status: result.user.isActive ? 'active' : 'inactive',
    }
  }

  async assignStaff(
    storeIdRaw: string,
    body: { userId: string; role: string; permissions?: string[] },
    actor?: AdminSessionPayload,
    req?: AdminRequest,
  ) {
    this.assertCanInvite(actor)

    const role = body.role?.toUpperCase() as UserRole
    this.assertRoleAssignment(actor, role)

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true, isActive: true },
    })
    if (!user) throw new NotFoundException('User not found')
    if (!user.isActive) throw new BadRequestException('User account is inactive')

    const staffRole = await this.prisma.staffRole.upsert({
      where: { userId_storeId: { userId: body.userId, storeId } },
      create: {
        userId: body.userId,
        storeId,
        role,
        permissions: body.permissions ?? (role === 'SUPER_ADMIN' ? ['*'] : []),
      },
      update: { role, permissions: body.permissions ?? undefined },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })

    await this.writeAudit(storeId, actor, 'staff.assigned', body.userId, { role }, undefined, req)

    return staffRole
  }

  async updateStaff(
    storeIdRaw: string,
    userId: string,
    body: { role?: string; permissions?: string[]; isActive?: boolean },
    actor?: AdminSessionPayload,
    req?: AdminRequest,
  ) {
    this.assertCanManageStaff(actor)

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const target = await this.prisma.staffRole.findUnique({
      where: { userId_storeId: { userId, storeId } },
      include: { user: { select: { email: true } } },
    })
    if (!target) throw new NotFoundException('Staff member not found')

    await this.assertTargetEditable(storeId, userId, target.user.email)

    if (body.role !== undefined) {
      if (this.actorRole(actor) !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only Super Admin can change roles')
      }
      this.assertRoleAssignment(actor, body.role)
    }

    const updates: Promise<unknown>[] = []

    if (body.role !== undefined || body.permissions !== undefined) {
      updates.push(
        this.prisma.staffRole.update({
          where: { userId_storeId: { userId, storeId } },
          data: {
            ...(body.role !== undefined ? { role: body.role.toUpperCase() as UserRole } : {}),
            ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
          },
        }),
      )
    }

    if (body.isActive !== undefined) {
      updates.push(this.prisma.user.update({ where: { id: userId }, data: { isActive: body.isActive } }))
    }

    await Promise.all(updates)

    await this.writeAudit(storeId, actor, 'staff.updated', userId, body as Record<string, unknown>, undefined, req)

    return { updated: true }
  }

  private assertCanManageSecurity(actor?: AdminSessionPayload) {
    const role = this.actorRole(actor)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      throw new ForbiddenException('Insufficient permissions for security settings')
    }
  }

  private async readRolePermissionStore(storeId: string): Promise<Record<string, PermissionRow[]>> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { storefrontConfig: true },
    })
    const cfg = (settings?.storefrontConfig as Record<string, unknown> | null) ?? {}
    const stored = cfg.adminRolePermissions
    if (!stored || typeof stored !== 'object') return {}
    return stored as Record<string, PermissionRow[]>
  }

  private async writeRolePermissionStore(storeId: string, matrix: Record<string, PermissionRow[]>) {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { storefrontConfig: true },
    })
    const cfg = (settings?.storefrontConfig as Record<string, unknown> | null) ?? {}
    const next = { ...cfg, adminRolePermissions: matrix }

    await this.prisma.siteSettings.upsert({
      where: { storeId },
      create: { storeId, storefrontConfig: next as object },
      update: { storefrontConfig: next as object },
    })
  }

  async getPermissions(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.assertCanManageSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const stored = await this.readRolePermissionStore(storeId)

    const roles = Object.keys(DEFAULT_ROLE_PERMISSIONS).map((roleKey) => ({
      role: roleKey,
      label: ROLE_API_TO_UI[roleKey] ?? roleKey,
      permissions: stored[roleKey] ?? DEFAULT_ROLE_PERMISSIONS[roleKey] ?? [],
    }))

    return { roles }
  }

  async saveRolePermissions(
    storeIdRaw: string,
    roleRaw: string,
    permissions: PermissionRow[],
    actor?: AdminSessionPayload,
    req?: AdminRequest,
  ) {
    this.assertSuperAdmin(actor)
    if (this.actorRole(actor) !== 'SUPER_ADMIN' && normalizeRoleKey(roleRaw) === 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can edit Super Admin permissions')
    }

    const roleKey = normalizeRoleKey(roleRaw)
    if (!DEFAULT_ROLE_PERMISSIONS[roleKey]) {
      throw new BadRequestException(`Unknown role: ${roleRaw}`)
    }

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const stored = await this.readRolePermissionStore(storeId)
    stored[roleKey] = permissions
    await this.writeRolePermissionStore(storeId, stored)

    const tokens = roleKey === 'SUPER_ADMIN' ? ['*'] : encodePermissionTokens(permissions)
    await this.prisma.staffRole.updateMany({
      where: { storeId, role: roleKey as UserRole },
      data: { permissions: tokens },
    })

    await this.writeAudit(
      storeId,
      actor,
      'permissions.updated',
      roleKey,
      { permissions },
      undefined,
      req,
      'permissions',
    )

    return { saved: true, role: roleKey, permissions }
  }

  async listSessions(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.assertSuperAdmin(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.prisma.deviceSession.findMany({
      where: {
        isRevoked: false,
        expiresAt: { gt: new Date() },
        user: { staffRoles: { some: { storeId } } },
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { lastActive: 'desc' },
    })
  }

  async revokeSession(sessionId: string, actor?: AdminSessionPayload, req?: AdminRequest) {
    this.assertSuperAdmin(actor)
    const session = await this.prisma.deviceSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, user: { select: { staffRoles: { select: { storeId: true } } } } },
    })
    if (!session) throw new NotFoundException('Session not found')

    await this.prisma.deviceSession.update({ where: { id: sessionId }, data: { isRevoked: true } })

    const storeId = session.user.staffRoles[0]?.storeId
    if (storeId) {
      await this.writeAudit(storeId, actor, 'session.revoked', sessionId, undefined, undefined, req)
    }

    return { revoked: true }
  }

  async revokeAllSessions(storeIdRaw: string, userId: string | undefined, actor?: AdminSessionPayload, req?: AdminRequest) {
    this.assertSuperAdmin(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const where = userId
      ? { userId }
      : { user: { staffRoles: { some: { storeId } } } }
    const { count } = await this.prisma.deviceSession.updateMany({ where, data: { isRevoked: true } })
    await this.writeAudit(storeId, actor, 'sessions.revoked_all', storeId, { count, userId }, undefined, req)
    return { revoked: count }
  }

  permissionsFromStaffRole(role: string, tokens: string[]): PermissionRow[] {
    if (tokens.includes('*')) return DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN ?? []
    if (tokens.length) return decodePermissionTokens(tokens)
    return DEFAULT_ROLE_PERMISSIONS[normalizeRoleKey(role)] ?? DEFAULT_ROLE_PERMISSIONS.STAFF ?? []
  }

  async listStaff(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.assertCanViewSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.prisma.staffRole.findMany({
      where: { storeId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            twoFAEnabled: true,
          },
        },
      },
    })
  }

  async listAuditLogs(
    storeIdRaw: string,
    actor: AdminSessionPayload | undefined,
    opts: { page?: number; limit?: number; action?: string; userId?: string },
  ) {
    this.assertCanViewSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const page = Number(opts.page) || 1
    const limit = Math.min(Number(opts.limit) || 50, 200)
    const where = {
      storeId,
      ...(opts.action ? { action: { contains: opts.action, mode: 'insensitive' as const } } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    }
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { logs, total, page, totalPages: Math.ceil(total / limit) }
  }

  async loginHistory(
    storeIdRaw: string,
    actor: AdminSessionPayload | undefined,
    opts: { userId?: string; success?: string; page?: string; limit?: string },
  ) {
    this.assertCanManageSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const take = Math.min(Number(opts.limit) || 50, 200)
    const skip = (Math.max(Number(opts.page) || 1, 1) - 1) * take
    const where = {
      user: { staffRoles: { some: { storeId } } },
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.success !== undefined ? { success: opts.success === 'true' } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.loginHistory.count({ where }),
    ])
    return { items, total, page: Number(opts.page) || 1, limit: take }
  }

  async loginStats(storeIdRaw: string, actor: AdminSessionPayload | undefined, days?: string) {
    this.assertCanManageSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 14))
    const staffFilter = { user: { staffRoles: { some: { storeId } } } }
    const [total, failed, byDevice] = await Promise.all([
      this.prisma.loginHistory.count({ where: { ...staffFilter, createdAt: { gte: since } } }),
      this.prisma.loginHistory.count({
        where: { ...staffFilter, createdAt: { gte: since }, success: false },
      }),
      this.prisma.loginHistory.groupBy({
        by: ['device'],
        where: { ...staffFilter, createdAt: { gte: since } },
        _count: true,
      }),
    ])
    return {
      period: `${Number(days) || 14}d`,
      totalLogins: total,
      failedLogins: failed,
      successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
      byDevice,
    }
  }

  async fraudAlerts(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.assertCanManageSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const [highRiskOrders, highRiskCustomers, recentFlaggedOrders] = await Promise.all([
      this.prisma.order.count({ where: { storeId, isCodRisk: true, status: 'PENDING' } }),
      this.prisma.customer.count({ where: { storeId, codRiskScore: { gte: 70 } } }),
      this.prisma.order.findMany({
        where: { storeId, fraudScore: { gte: 60 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          shippingName: true,
          shippingPhone: true,
          total: true,
          fraudScore: true,
          fraudFlags: true,
          isCodRisk: true,
          status: true,
          createdAt: true,
        },
      }),
    ])
    return { summary: { highRiskOrders, highRiskCustomers }, recentFlaggedOrders }
  }

  async updateFraudFlags(
    storeIdRaw: string,
    orderId: string,
    body: {
      fraudScore?: number
      fraudFlags?: string[]
      isCodRisk?: boolean
      requireAdvancePayment?: boolean
    },
    actor?: AdminSessionPayload,
    req?: AdminRequest,
  ) {
    this.assertCanManageSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: { id: true, invoiceNumber: true },
    })
    if (!order) throw new NotFoundException('Order not found for this store')

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...(body.fraudScore !== undefined ? { fraudScore: body.fraudScore } : {}),
        ...(body.fraudFlags !== undefined ? { fraudFlags: body.fraudFlags } : {}),
        ...(body.isCodRisk !== undefined ? { isCodRisk: body.isCodRisk } : {}),
        ...(body.requireAdvancePayment !== undefined ? { requireAdvancePayment: body.requireAdvancePayment } : {}),
      },
      select: { id: true, invoiceNumber: true, fraudScore: true, fraudFlags: true, isCodRisk: true },
    })

    await this.writeAudit(storeId, actor, 'fraud.updated', orderId, body as Record<string, unknown>, undefined, req, 'order')

    return updated
  }

  async twoFaStatus(storeIdRaw: string, actor?: AdminSessionPayload) {
    this.assertCanViewSecurity(actor)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const staff = await this.prisma.staffRole.findMany({
      where: { storeId },
      include: { user: { select: { id: true, firstName: true, twoFAEnabled: true } } },
    })
    const enabled = staff.filter((s) => s.user.twoFAEnabled).length
    return {
      total: staff.length,
      enabled,
      disabled: staff.length - enabled,
      coverage: staff.length > 0 ? Math.round((enabled / staff.length) * 100) : 0,
      staff: staff.map((s) => ({
        userId: s.userId,
        name: s.user.firstName,
        twoFAEnabled: s.user.twoFAEnabled,
      })),
    }
  }

  async listIpRules(actor?: AdminSessionPayload) {
    this.assertCanManageSecurity(actor)
    return this.prisma.ipRule.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async createIpRule(
    body: { ip: string; type: 'ALLOW' | 'BLOCK'; note?: string; expiresAt?: string },
    actor?: AdminSessionPayload,
    req?: AdminRequest,
  ) {
    this.assertSuperAdmin(actor)
    if (!body.ip?.trim()) throw new BadRequestException('IP address is required')
    const rule = await this.prisma.ipRule.create({
      data: {
        ip: body.ip.trim(),
        type: body.type,
        note: body.note,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })
    await this.writeAudit(undefined, actor, 'ip_rule.created', rule.id, body as Record<string, unknown>, undefined, req, 'ip_rule')
    return rule
  }

  async deleteIpRule(id: string, actor?: AdminSessionPayload, req?: AdminRequest) {
    this.assertSuperAdmin(actor)
    await this.prisma.ipRule.delete({ where: { id } })
    await this.writeAudit(undefined, actor, 'ip_rule.deleted', id, undefined, undefined, req, 'ip_rule')
    return { deleted: true }
  }

  async removeStaff(storeIdRaw: string, userId: string, actor?: AdminSessionPayload, req?: AdminRequest) {
    this.assertCanRemoveStaff(actor)

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const target = await this.prisma.staffRole.findUnique({
      where: { userId_storeId: { userId, storeId } },
      include: { user: { select: { email: true } } },
    })
    if (!target) throw new NotFoundException('Staff member not found')

    await this.assertTargetEditable(storeId, userId, target.user.email)

    await this.prisma.staffRole.delete({ where: { userId_storeId: { userId, storeId } } })

    await this.writeAudit(storeId, actor, 'staff.removed', userId, undefined, { email: target.user.email }, req)

    return { removed: true }
  }
}
