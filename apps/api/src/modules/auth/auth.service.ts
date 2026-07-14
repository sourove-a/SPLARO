import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { verifyAdminSessionToken, type AdminSessionPayload } from '../../common/auth/admin-session.util'
import { AdminSessionResolver } from '../../common/auth/admin-session.resolver'
import { verifyPasswordWithTimingPad } from '../../common/password.util'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { resolveStoreId } from '../../common/store.util'
import { resolveStaffPermissionTokens } from '../security/staff-permissions.resolver'
import { AdminLoginTokenService } from './admin-login-token.service'

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_TTL_SEC = Math.ceil(LOCKOUT_WINDOW_MS / 1000)
const MAX_FAILED_ATTEMPTS = 5
const IP_FAIL_KEY_PREFIX = 'splaro:admin:login:fail:ip:'

@Injectable()
export class AuthService {
  private readonly ipFailMemory = new Map<string, { count: number; expiresAt: number }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly loginTokens: AdminLoginTokenService,
    private readonly redis: RedisService,
    private readonly sessionResolver: AdminSessionResolver,
  ) {}

  verifyToken(token: string): AdminSessionPayload | null {
    return verifyAdminSessionToken(token)
  }

  async verifyLiveToken(token: string): Promise<AdminSessionPayload | null> {
    const session = verifyAdminSessionToken(token)
    if (!session) return null
    return this.sessionResolver.resolveLiveSession(session)
  }

  private normalizeIp(ip: string): string {
    const trimmed = ip.trim().toLowerCase()
    return trimmed.length > 0 ? trimmed : 'unknown'
  }

  private ipFailRedisKey(ip: string): string {
    return `${IP_FAIL_KEY_PREFIX}${this.normalizeIp(ip)}`
  }

  private async getIpFailCount(ip: string): Promise<number> {
    const normalized = this.normalizeIp(ip)
    const redisCount = await this.redis.getCounter(this.ipFailRedisKey(normalized))
    if (redisCount > 0) return redisCount

    const entry = this.ipFailMemory.get(normalized)
    if (!entry) return 0
    if (entry.expiresAt <= Date.now()) {
      this.ipFailMemory.delete(normalized)
      return 0
    }
    return entry.count
  }

  private async assertIpNotLockedOut(ip: string) {
    const failed = await this.getIpFailCount(ip)
    if (failed >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException('Too many failed login attempts. Try again in 15 minutes.')
    }
  }

  private async recordIpFailedAttempt(ip: string) {
    const normalized = this.normalizeIp(ip)
    const redisCount = await this.redis.incrWithExpiry(this.ipFailRedisKey(normalized), LOCKOUT_TTL_SEC)
    if (redisCount > 0) return

    const now = Date.now()
    const entry = this.ipFailMemory.get(normalized)
    if (!entry || entry.expiresAt <= now) {
      this.ipFailMemory.set(normalized, { count: 1, expiresAt: now + LOCKOUT_WINDOW_MS })
      return
    }
    entry.count += 1
  }

  private async recordLoginAttempt(opts: {
    userId?: string
    ipAddress: string
    userAgent?: string
    success: boolean
    failReason?: string
  }) {
    if (!opts.userId) return
    await this.prisma.loginHistory.create({
      data: {
        userId: opts.userId,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
        device: opts.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
        success: opts.success,
        failReason: opts.failReason,
      },
    })
  }

  private async assertNotLockedOut(userId: string) {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS)
    const failed = await this.prisma.loginHistory.count({
      where: { userId, success: false, createdAt: { gte: since } },
    })
    if (failed >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException('Too many failed login attempts. Try again in 15 minutes.')
    }
  }

  async loginWithPassword(
    email: string,
    password: string,
    storeIdRaw?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{
    userId: string
    email: string
    name: string
    role: string
    storeId: string
    permissions: string[]
  }> {
    const normalized = email.trim().toLowerCase()
    const ipAddress = meta?.ipAddress ?? 'unknown'
    const userAgent = meta?.userAgent

    await this.assertIpNotLockedOut(ipAddress)

    const user = await this.prisma.user.findFirst({
      where: { email: normalized },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        isActive: true,
        role: true,
        staffRoles: {
          select: { role: true, storeId: true, store: { select: { slug: true } } },
        },
      },
    })

    if (user) {
      await this.assertNotLockedOut(user.id)
    }

    const hashMatches = verifyPasswordWithTimingPad(password, user?.passwordHash)
    const passwordOk = Boolean(user?.isActive) && hashMatches

    if (!user || !passwordOk) {
      if (user) {
        await this.recordLoginAttempt({
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
          failReason: !user.isActive ? 'inactive' : 'invalid_password',
        })
      }
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException('Invalid email or password')
    }

    const storeId = storeIdRaw
      ? await resolveStoreId(this.prisma, storeIdRaw)
      : user.staffRoles[0]?.storeId

    const staff = storeId
      ? user.staffRoles.find((s) => s.storeId === storeId)
      : user.staffRoles[0]

    if (!staff) {
      await this.recordLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        success: false,
        failReason: 'no_staff_access',
      })
      throw new UnauthorizedException('No admin access for this store')
    }

    await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.recordLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        success: true,
      }),
    ])

    const permissions = await resolveStaffPermissionTokens(
      this.prisma,
      user.id,
      staff.storeId,
      staff.role,
    )

    return {
      userId: user.id,
      email: user.email ?? normalized,
      name: `${user.firstName} ${user.lastName}`.trim() || user.email || normalized,
      role: staff.role,
      storeId: staff.storeId,
      permissions,
    }
  }

  async validateAdminEmail(email: string, storeIdRaw?: string): Promise<{ ok: true; email: string }> {
    const admin = await this.resolveAdminStaff(email, storeIdRaw)
    if (!admin) {
      throw new UnauthorizedException('No admin account found for this email')
    }
    return { ok: true, email: admin.email }
  }

  async loginWithToken(
    email: string,
    token: string,
    storeIdRaw?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{
    userId: string
    email: string
    name: string
    role: string
    storeId: string
    permissions: string[]
  }> {
    const normalized = email.trim().toLowerCase()
    const ipAddress = meta?.ipAddress ?? 'unknown'
    const userAgent = meta?.userAgent

    await this.assertIpNotLockedOut(ipAddress)

    const record = await this.loginTokens.consume(normalized, token)
    if (!record) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException('Invalid or expired token. Send /login in Telegram bot for a new one.')
    }

    await this.assertNotLockedOut(record.userId)

    await Promise.all([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { lastLoginAt: new Date() },
      }),
      this.recordLoginAttempt({
        userId: record.userId,
        ipAddress,
        userAgent,
        success: true,
      }),
    ])

    const permissions = await resolveStaffPermissionTokens(
      this.prisma,
      record.userId,
      record.storeId,
      record.role,
    )

    return {
      userId: record.userId,
      email: record.email,
      name: record.name,
      role: record.role,
      storeId: record.storeId,
      permissions,
    }
  }

  async issueLoginTokenForEmail(
    email: string,
    storeIdRaw?: string,
  ): Promise<{ code: string; email: string }> {
    const admin = await this.resolveAdminStaff(email, storeIdRaw)
    if (!admin) {
      throw new UnauthorizedException('No admin account found for this email')
    }

    const code = await this.loginTokens.issue({
      email: admin.email,
      userId: admin.userId,
      name: admin.name,
      role: admin.role,
      storeId: admin.storeId,
    })

    return { code, email: admin.email }
  }

  async issueTelegramLoginToken(storeId: string): Promise<{ code: string; email: string }> {
    const admin = await this.resolvePrimaryAdminForStore(storeId)
    if (!admin) {
      throw new UnauthorizedException('No admin account configured for this store')
    }

    const code = await this.loginTokens.issue({
      email: admin.email,
      userId: admin.userId,
      name: admin.name,
      role: admin.role,
      storeId: admin.storeId,
    })

    return { code, email: admin.email }
  }

  private async resolvePrimaryAdminForStore(storeId: string) {
    const envEmail = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase()
    if (envEmail) {
      const fromEnv = await this.resolveAdminStaff(envEmail, storeId)
      if (fromEnv) return fromEnv
    }

    const staff = await this.prisma.staffRole.findFirst({
      where: { storeId, role: 'SUPER_ADMIN', user: { isActive: true } },
      select: {
        role: true,
        storeId: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!staff?.user.email) return null

    return {
      userId: staff.user.id,
      email: staff.user.email.toLowerCase(),
      name: `${staff.user.firstName} ${staff.user.lastName}`.trim() || staff.user.email,
      role: staff.role,
      storeId: staff.storeId,
    }
  }

  private async resolveAdminStaff(email: string, storeIdRaw?: string) {
    const normalized = email.trim().toLowerCase()
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, isActive: true },
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

    const storeId = storeIdRaw ? await resolveStoreId(this.prisma, storeIdRaw) : undefined
    let staff = storeId
      ? user.staffRoles.find((s) => s.storeId === storeId)
      : user.staffRoles[0]

    if (!staff) {
      const staffRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])
      if (!staffRoles.has(user.role)) return null
      const targetStoreId =
        storeId ??
        user.ownedStores[0]?.id ??
        (await this.prisma.store.findFirst({ where: { slug: 'splaro' }, select: { id: true } }))?.id
      if (!targetStoreId) return null

      staff = await this.prisma.staffRole.upsert({
        where: { userId_storeId: { userId: user.id, storeId: targetStoreId } },
        create: {
          userId: user.id,
          storeId: targetStoreId,
          role: user.role === 'CUSTOMER' || user.role === 'VENDOR' ? 'ADMIN' : user.role,
          permissions: user.role === 'SUPER_ADMIN' ? ['*'] : [],
        },
        update: {},
        select: { role: true, storeId: true },
      })
    }

    if (!staff) return null

    return {
      userId: user.id,
      email: user.email.toLowerCase(),
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      role: staff.role,
      storeId: staff.storeId,
    }
  }
}
