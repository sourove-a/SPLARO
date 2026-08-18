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

  /** The permanent primary owner address (ADMIN_EMAIL) — always Telegram OTP, never demotable. */
  isPrimaryOwnerEmail(email: string): boolean {
    return email.trim().toLowerCase() === CEO_EMAIL
  }

  /** Only the permanent owner email uses Telegram login tokens. */
  isTelegramOnlyAdmin(role: string, email: string): boolean {
    void role
    return this.isPrimaryOwnerEmail(email)
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
  ): Promise<{ method: 'telegram' | 'password'; email: string; exists: boolean }> {
    const normalized = email.trim().toLowerCase()
    const admin = await this.resolveAdminStaff(email, storeIdRaw)
    if (!admin) {
      return { method: 'password', email: normalized, exists: false }
    }
    return {
      method: this.isTelegramOnlyAdmin(admin.role, admin.email) ? 'telegram' : 'password',
      email: admin.email,
      exists: true,
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
        failReason: 'telegram_policy_password_blocked',
      })
      await this.recordIpFailedAttempt(ipAddress)
      throw new ForbiddenException('This admin account must sign in with a Telegram code')
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

  /** Admin Google sign-in is disabled — owner uses Telegram, invited staff use password. */
  async loginWithGoogle(
    profile: { email: string; emailVerified: boolean; firstName: string; lastName: string },
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
    void profile
    void storeIdRaw
    void meta
    throw new ForbiddenException('Admin Google sign-in is disabled. Use your assigned sign-in method.')
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

    // Consume first — a valid one-time code is the source of truth.
    // Looking up the admin row before consume produced a false
    // "No admin account found" when the real problem was an expired/used code.
    const record = await this.loginTokens.consume(normalized, token)
    if (!record) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException(
        'Invalid or expired token. Tap Resend token for a new code.',
      )
    }

    if (!this.isTelegramOnlyAdmin(record.role, record.email)) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new ForbiddenException('Use email and password to sign in')
    }

    await this.assertNotLockedOut(record.userId)

    const liveUser = await this.prisma.user.findFirst({
      where: { id: record.userId, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    if (!liveUser?.email) {
      await this.recordIpFailedAttempt(ipAddress)
      throw new UnauthorizedException(
        'Invalid or expired token. Tap Resend token for a new code.',
      )
    }

    const storeId = await resolveStoreId(this.prisma, storeIdRaw || record.storeId)
    const staffRole =
      record.role === 'SUPER_ADMIN' ||
      record.role === 'ADMIN' ||
      record.role === 'MANAGER' ||
      record.role === 'STAFF'
        ? record.role
        : 'ADMIN'

    await this.prisma.staffRole.upsert({
      where: { userId_storeId: { userId: liveUser.id, storeId } },
      create: {
        userId: liveUser.id,
        storeId,
        role: staffRole,
        permissions: staffRole === 'SUPER_ADMIN' ? ['*'] : [],
      },
      update: {
        role: staffRole,
        ...(staffRole === 'SUPER_ADMIN' ? { permissions: ['*'] } : {}),
      },
    })

    await Promise.all([
      this.prisma.user.update({
        where: { id: liveUser.id },
        data: { lastLoginAt: new Date() },
      }),
      this.recordLoginAttempt({
        userId: liveUser.id,
        ipAddress,
        userAgent,
        success: true,
      }),
    ])

    const permissions = await resolveStaffPermissionTokens(
      this.prisma,
      liveUser.id,
      storeId,
      staffRole,
    )

    return {
      userId: liveUser.id,
      email: liveUser.email.toLowerCase(),
      name: `${liveUser.firstName} ${liveUser.lastName}`.trim() || liveUser.email,
      role: staffRole,
      storeId,
      permissions,
    }
  }

  /** One-time token for the signed-in staff member to link their personal Telegram chat. */
  async issueStaffTelegramLinkToken(
    actor: Pick<AdminSessionPayload, 'userId' | 'email' | 'name' | 'role' | 'storeId'>,
    storeIdRaw?: string,
  ): Promise<{ code: string; email: string }> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw?.trim() || actor.storeId || '')
    const staff = await this.prisma.staffRole.findUnique({
      where: { userId_storeId: { userId: actor.userId, storeId } },
      include: { user: { select: { email: true, isActive: true } } },
    })
    if (!staff?.user.isActive || !staff.user.email) {
      throw new UnauthorizedException('No active admin account for this store')
    }

    const code = await this.loginTokens.issue({
      email: staff.user.email,
      userId: actor.userId,
      name: actor.name || staff.user.email,
      role: staff.role,
      storeId,
    })

    return { code, email: staff.user.email }
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
      throw new ForbiddenException('Use email and password to sign in')
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
      throw new ForbiddenException('This account uses Telegram code sign-in')
    }

    const consumed = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        resetToken: tokenHash,
        resetTokenExp: { gt: new Date() },
      },
      data: {
        passwordHash: hashPassword(password.trim()),
        resetToken: null,
        resetTokenExp: null,
        emailVerified: true,
      },
    })
    if (consumed.count !== 1) {
      throw new BadRequestException('Invalid or expired reset link')
    }

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

    const user = invite.userId
      ? await this.prisma.user.findUnique({ where: { id: invite.userId } })
      : await this.prisma.user.findFirst({ where: { email: invite.email } })

    if (!user) throw new BadRequestException('Invite user missing — ask Super Admin to re-invite')

    const resolvedFirst = firstName?.trim() || invite.firstName || user.firstName
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.adminInvite.updateMany({
        where: { id: invite.id, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: user.id },
      })
      if (claimed.count !== 1) {
        throw new BadRequestException('Invalid or expired invite link')
      }
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
      // The primary owner email is permanently SUPER_ADMIN: a storefront signup with the
      // same address must never be able to demote it out of the admin panel.
      const isPrimaryOwner = user.email.toLowerCase() === CEO_EMAIL
      const staffRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])
      if (!isPrimaryOwner && !staffRoles.has(user.role)) return null
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
          role: isPrimaryOwner
            ? 'SUPER_ADMIN'
            : user.role === 'CUSTOMER' || user.role === 'VENDOR'
              ? 'ADMIN'
              : user.role,
          permissions: isPrimaryOwner || user.role === 'SUPER_ADMIN' ? ['*'] : [],
        },
        update: isPrimaryOwner ? { role: 'SUPER_ADMIN', permissions: ['*'] } : {},
        select: { role: true, storeId: true },
      })

      if (isPrimaryOwner && user.role !== 'SUPER_ADMIN') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN', isActive: true, emailVerified: true },
        })
      }
    }

    if (!staff) return null

    // Existing staff row that drifted (e.g. demoted by hand) is restored for the owner email.
    if (staff.role !== 'SUPER_ADMIN' && user.email.toLowerCase() === CEO_EMAIL) {
      staff = await this.prisma.staffRole.update({
        where: { userId_storeId: { userId: user.id, storeId: staff.storeId } },
        data: { role: 'SUPER_ADMIN', permissions: ['*'] },
        select: { role: true, storeId: true },
      })
    }

    return {
      userId: user.id,
      email: user.email.toLowerCase(),
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      role: staff.role,
      storeId: staff.storeId,
    }
  }

  /** Sub-admins (password login) can change their own password while signed in. */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    if (newPassword.trim().length < 8) {
      throw new BadRequestException('New password must be at least 8 characters')
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        staffRoles: { select: { role: true }, take: 1 },
      },
    })
    if (!user?.email) throw new UnauthorizedException('Account not found')

    const role = user.staffRoles[0]?.role ?? user.role
    if (this.isTelegramOnlyAdmin(role, user.email)) {
      throw new ForbiddenException('This account uses Telegram code sign-in — password change is for staff accounts')
    }
    if (!user.passwordHash) {
      throw new BadRequestException('No password set — use the invite or reset link first')
    }

    const ok = verifyPasswordWithTimingPad(currentPassword, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Current password is incorrect')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword.trim()) },
    })

    return { ok: true }
  }

  async getProfileExtras(userId: string): Promise<{
    canChangePassword: boolean
    lastLoginIp: string | null
    lastLoginAt: string | null
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        role: true,
        passwordHash: true,
        lastLoginAt: true,
        staffRoles: { select: { role: true }, take: 1 },
        loginHistory: {
          where: { success: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { ipAddress: true, createdAt: true },
        },
      },
    })
    if (!user?.email) {
      return { canChangePassword: false, lastLoginIp: null, lastLoginAt: null }
    }
    const role = user.staffRoles[0]?.role ?? user.role
    const telegramOnly = this.isTelegramOnlyAdmin(role, user.email)
    const last = user.loginHistory[0]
    return {
      canChangePassword: !telegramOnly && Boolean(user.passwordHash),
      lastLoginIp: last?.ipAddress ?? null,
      lastLoginAt: (last?.createdAt ?? user.lastLoginAt)?.toISOString() ?? null,
    }
  }
}
