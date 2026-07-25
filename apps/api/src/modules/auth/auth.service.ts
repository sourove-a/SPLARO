import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'crypto'
import { resolvePublicAdminUrl } from '@splaro/config'
import { verifyAdminSessionToken, type AdminSessionPayload } from '../../common/auth/admin-session.util'
import { AdminSessionResolver } from '../../common/auth/admin-session.resolver'
import { hashPassword, verifyPasswordWithTimingPad } from '../../common/password.util'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { resolveStoreId } from '../../common/store.util'
import { resolveStaffPermissionTokens } from '../security/staff-permissions.resolver'
import { EmailService } from '../email/email.service'
import {
  generateAdminPasswordResetEmailHTML,
  generateAdminPasswordResetEmailText,
} from '../email/admin-password-reset-email.template'
import { AdminLoginTokenService } from './admin-login-token.service'

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_TTL_SEC = Math.ceil(LOCKOUT_WINDOW_MS / 1000)
const MAX_FAILED_ATTEMPTS = 5
const IP_FAIL_KEY_PREFIX = 'splaro:admin:login:fail:ip:'
const RESET_TTL_MS = 60 * 60 * 1000
const INVITE_TTL_MS = 48 * 60 * 60 * 1000

const CEO_EMAIL = (process.env['ADMIN_EMAIL'] ?? process.env['CEO_EMAIL'] ?? 'splaro.bd@gmail.com')
  .trim()
  .toLowerCase()

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

@Injectable()
export class AuthService {
  private readonly ipFailMemory = new Map<string, { count: number; expiresAt: number }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly loginTokens: AdminLoginTokenService,
    private readonly redis: RedisService,
    private readonly sessionResolver: AdminSessionResolver,
    private readonly email: EmailService,
  ) {}

  /** Super Admin / CEO: Telegram OTP only. Everyone else: password only. */
  isTelegramOnlyAdmin(role: string, email: string): boolean {
    const normalizedRole = role.toUpperCase()
    const normalizedEmail = email.trim().toLowerCase()
    return normalizedRole === 'SUPER_ADMIN' || normalizedEmail === CEO_EMAIL
  }

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

  async resolveLoginMethod(
    email: string,
    storeIdRaw?: string,
  ): Promise<{ method: 'telegram' | 'password'; email: string }> {
    const admin = await this.resolveAdminStaff(email, storeIdRaw)
    if (!admin) {
      throw new UnauthorizedException('No admin account found for this email')
    }
    return {
      method: this.isTelegramOnlyAdmin(admin.role, admin.email) ? 'telegram' : 'password',
      email: admin.email,
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
        emailVerified: true,
        role: true,
        staffRoles: {
          select: { role: true, storeId: true, store: { select: { slug: true } } },
        },
      },
    })

    if (user) {
      await this.assertNotLockedOut(user.id)
    }

    const storeId = storeIdRaw
      ? await resolveStoreId(this.prisma, storeIdRaw)
      : user?.staffRoles[0]?.storeId

    const staff = storeId
      ? user?.staffRoles.find((s) => s.storeId === storeId)
      : user?.staffRoles[0]

    if (user && staff && this.isTelegramOnlyAdmin(staff.role, user.email ?? normalized)) {
      await this.recordLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        success: false,
        failReason: 'super_admin_password_blocked',
      })
      await this.recordIpFailedAttempt(ipAddress)
      throw new ForbiddenException('Super Admin must sign in with Telegram login token')
    }

    const hashMatches = verifyPasswordWithTimingPad(password, user?.passwordHash)
    const passwordOk =
      Boolean(user?.isActive) && Boolean(user?.emailVerified) && Boolean(user?.passwordHash) && hashMatches

    if (!user || !passwordOk) {
      if (user) {
        await this.recordLoginAttempt({
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
          failReason: !user.isActive
            ? 'inactive'
            : !user.emailVerified
              ? 'email_unverified'
              : !user.passwordHash
                ? 'password_not_set'
                : 'invalid_password',
        })
      }
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException(
        !user?.emailVerified && user?.passwordHash == null
          ? 'Accept your invite email and set a password first'
          : 'Invalid email or password',
      )
    }

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

    const admin = await this.resolveAdminStaff(normalized, storeIdRaw)
    if (!admin) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException('No admin account found for this email')
    }

    if (!this.isTelegramOnlyAdmin(admin.role, admin.email)) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new ForbiddenException('Use email and password to sign in')
    }

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
    if (!this.isTelegramOnlyAdmin(admin.role, admin.email)) {
      throw new ForbiddenException('Use email and password to sign in — Telegram login is for Super Admin only')
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

  async requestPasswordReset(email: string, storeIdRaw?: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase()
    let admin: Awaited<ReturnType<AuthService['resolveAdminStaff']>> = null
    try {
      admin = await this.resolveAdminStaff(normalized, storeIdRaw)
    } catch {
      admin = null
    }
    if (!admin || this.isTelegramOnlyAdmin(admin.role, admin.email)) {
      return { ok: true }
    }

    const user = await this.prisma.user.findFirst({
      where: { id: admin.userId, isActive: true },
      select: { id: true, email: true, firstName: true, emailVerified: true, passwordHash: true },
    })
    if (!user?.email || !user.emailVerified || !user.passwordHash) {
      return { ok: true }
    }

    const rawToken = randomBytes(32).toString('hex')
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: sha256(rawToken),
        resetTokenExp: new Date(Date.now() + RESET_TTL_MS),
      },
    })

    const adminUrl = resolvePublicAdminUrl()
    const resetUrl = `${adminUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    const store = await this.prisma.store.findUnique({
      where: { id: admin.storeId },
      select: { name: true },
    })

    await this.email.sendForStore({
      storeId: admin.storeId,
      to: user.email,
      subject: `${store?.name ?? 'SPLARO'} admin — reset your password`,
      html: generateAdminPasswordResetEmailHTML({
        firstName: user.firstName,
        resetUrl,
        storeName: store?.name ?? 'SPLARO',
        adminUrl,
      }),
      text: generateAdminPasswordResetEmailText({
        firstName: user.firstName,
        resetUrl,
      }),
      transactional: true,
    })

    return { ok: true }
  }

  async resetPasswordWithToken(token: string, password: string): Promise<{ ok: true }> {
    const trimmed = token.trim()
    if (trimmed.length < 16) throw new BadRequestException('Invalid or expired reset link')
    if (password.trim().length < 8) throw new BadRequestException('Password must be at least 8 characters')

    const tokenHash = sha256(trimmed)
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExp: { gt: new Date() },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        staffRoles: { select: { role: true }, take: 1 },
      },
    })
    if (!user) throw new BadRequestException('Invalid or expired reset link')

    const role = user.staffRoles[0]?.role ?? user.role
    if (this.isTelegramOnlyAdmin(role, user.email ?? '')) {
      throw new ForbiddenException('Super Admin cannot reset password — use Telegram login')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password.trim()),
        resetToken: null,
        resetTokenExp: null,
        emailVerified: true,
      },
    })

    return { ok: true }
  }

  async getInvitePreview(token: string): Promise<{
    emailMasked: string
    role: string
    firstName: string
    expiresAt: string
  }> {
    const invite = await this.findValidInvite(token)
    return {
      emailMasked: maskEmail(invite.email),
      role: invite.role,
      firstName: invite.firstName,
      expiresAt: invite.expiresAt.toISOString(),
    }
  }

  async acceptInvite(
    token: string,
    password: string,
    firstName?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{
    userId: string
    email: string
    name: string
    role: string
    storeId: string
    permissions: string[]
  }> {
    if (password.trim().length < 8) {
      throw new BadRequestException('Password must be at least 8 characters')
    }

    const invite = await this.findValidInvite(token)
    if (this.isTelegramOnlyAdmin(invite.role, invite.email)) {
      throw new ForbiddenException('Super Admin accounts cannot use password invite')
    }

    const user = invite.userId
      ? await this.prisma.user.findUnique({ where: { id: invite.userId } })
      : await this.prisma.user.findFirst({ where: { email: invite.email } })

    if (!user) throw new BadRequestException('Invite user missing — ask Super Admin to re-invite')

    const resolvedFirst = firstName?.trim() || invite.firstName || user.firstName
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          firstName: resolvedFirst,
          passwordHash: hashPassword(password.trim()),
          emailVerified: true,
          isActive: true,
          role: invite.role,
          resetToken: null,
          resetTokenExp: null,
          verifyToken: null,
        },
      })
      await tx.adminInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), userId: user.id },
      })
    })

    return this.loginWithPassword(invite.email, password.trim(), invite.storeId, meta)
  }

  private async findValidInvite(token: string) {
    const trimmed = token.trim()
    if (trimmed.length < 16) throw new BadRequestException('Invalid or expired invite link')
    const tokenHash = sha256(trimmed)
    const invite = await this.prisma.adminInvite.findUnique({ where: { tokenHash } })
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired invite link')
    }
    return invite
  }

  createInviteTokenPair(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = randomBytes(32).toString('hex')
    return {
      rawToken,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    }
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
