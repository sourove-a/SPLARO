import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { verifyAdminSessionToken, type AdminSessionPayload } from '../../common/auth/admin-session.util'
import { verifyPassword } from '../../common/password.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { AdminLoginTokenService } from './admin-login-token.service'

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly loginTokens: AdminLoginTokenService,
  ) {}

  verifyToken(token: string): AdminSessionPayload | null {
    return verifyAdminSessionToken(token)
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
  }> {
    const normalized = email.trim().toLowerCase()
    const ipAddress = meta?.ipAddress ?? 'unknown'
    const userAgent = meta?.userAgent

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

    const passwordOk =
      Boolean(user?.passwordHash) && Boolean(user?.isActive) && verifyPassword(password, user!.passwordHash)

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

    return {
      userId: user.id,
      email: user.email ?? normalized,
      name: `${user.firstName} ${user.lastName}`.trim() || user.email || normalized,
      role: staff.role,
      storeId: staff.storeId,
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
  }> {
    const normalized = email.trim().toLowerCase()
    const ipAddress = meta?.ipAddress ?? 'unknown'
    const userAgent = meta?.userAgent

    const record = await this.loginTokens.consume(normalized, token)
    if (!record) {
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

    return {
      userId: record.userId,
      email: record.email,
      name: record.name,
      role: record.role,
      storeId: record.storeId,
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
        staffRoles: {
          select: { role: true, storeId: true },
        },
      },
    })

    if (!user?.email || user.staffRoles.length === 0) return null

    const storeId = storeIdRaw ? await resolveStoreId(this.prisma, storeIdRaw) : undefined
    const staff = storeId
      ? user.staffRoles.find((s) => s.storeId === storeId)
      : user.staffRoles[0]

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
