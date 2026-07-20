import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { EmailService } from '../email/email.service'
import {
  generateEmailVerificationHTML,
  generateEmailVerificationText,
} from '../email/email-verification.template'
import {
  generatePasswordResetEmailHTML,
  generatePasswordResetEmailText,
} from '../email/password-reset-email.template'
import { CustomersService } from '../customers/customers.service'
import { GoogleIdTokenService } from './google-id-token.service'
import { StorefrontOtpService, isStorefrontPhoneOtpEnabled } from './storefront-otp.service'

const SCRYPT_KEYLEN = 64
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const EMAIL_VERIFY_TTL_SEC = 10 * 60
const EMAIL_VERIFY_COOLDOWN_SEC = 60
const EMAIL_VERIFY_MAX_ATTEMPTS = 5

interface EmailVerificationPayload {
  digest: string
  attempts: number
  email: string
  expiresAt: number
}

const memoryEmailVerification = new Map<string, EmailVerificationPayload>()

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  const stored = Buffer.from(storedHash, 'hex')
  const computed = Buffer.from(hash, 'hex')
  if (stored.length !== computed.length) return false
  return timingSafeEqual(stored, computed)
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function shouldUseGoogleAvatar(currentAvatar?: string | null): boolean {
  if (!currentAvatar?.trim()) return true
  try {
    return new URL(currentAvatar).hostname.endsWith('.googleusercontent.com')
  } catch {
    return false
  }
}

export interface StorefrontAuthUser {
  id: string
  name: string
  email: string
  phone: string
  customerId?: string
  avatar?: string | null
  phoneVerified?: boolean
  emailVerified: boolean
  loyaltyTier?: string
  needsPhone?: boolean
}

@Injectable()
export class StorefrontAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly email: EmailService,
    private readonly googleIdToken: GoogleIdTokenService,
    private readonly otp: StorefrontOtpService,
    private readonly redis: RedisService,
  ) {}

  async signup(
    storeId: string,
    input: { name: string; email: string; phone: string; password: string },
  ) {
    const name = input.name?.trim()
    const email = normalizeEmail(input.email ?? '')
    const phone = normalizePhone(input.phone ?? '')
    const password = input.password

    if (!name || !email || !phone || !password) {
      throw new BadRequestException('Name, email, phone, and password are required')
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters')
    }

    const passwordHash = hashPassword(password)
    const customer = await this.customers.registerFromSignup(storeId, {
      name,
      email,
      phone,
      passwordHash,
      source: 'Website signup',
    })

    const user = await this.prisma.user.findUnique({
      where: { id: customer.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phoneVerified: true,
        emailVerified: true,
      },
    })
    if (!user) throw new BadRequestException('Signup failed')

    const session = await this.createSession(user.id)
    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
      user: this.toAuthUser(user, customer.id, customer.loyaltyTier),
    }
  }

  async login(storeId: string, input: { identifier: string; password: string }) {
    const identifier = input.identifier?.trim()
    const password = input.password
    if (!identifier || !password) {
      throw new BadRequestException('Email or phone and password are required')
    }

    const isEmail = identifier.includes('@')
    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: normalizeEmail(identifier) }
        : { phone: normalizePhone(identifier) },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        isActive: true,
        avatar: true,
        phoneVerified: true,
        emailVerified: true,
        customer: { select: { id: true, storeId: true, loyaltyTier: true } },
      },
    })

    if (!user || !user.isActive || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const session = await this.createSession(user.id)
    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
      user: this.toAuthUser(user, user.customer?.storeId === storeId ? user.customer.id : undefined, user.customer?.loyaltyTier),
    }
  }

  async validateSession(sessionToken: string): Promise<StorefrontAuthUser | null> {
    if (!sessionToken?.trim()) return null

    const session = await this.prisma.deviceSession.findFirst({
      where: {
        sessionToken,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            isActive: true,
            avatar: true,
            phoneVerified: true,
            emailVerified: true,
            customer: { select: { id: true, loyaltyTier: true } },
          },
        },
      },
    })

    if (!session?.user?.isActive) return null

    void this.prisma.deviceSession.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    })

    return this.toAuthUser(session.user, session.user.customer?.id, session.user.customer?.loyaltyTier)
  }

  async googleSignIn(storeId: string, credential: string) {
    if (!this.googleIdToken.isConfigured()) {
      throw new ServiceUnavailableException('Google sign-in is not configured')
    }

    const googleUser = await this.googleIdToken.verify(credential)

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phoneVerified: true,
        googleId: true,
        authProvider: true,
        isActive: true,
        customer: { select: { id: true, storeId: true, loyaltyTier: true } },
      },
    })

    if (user && !user.isActive) {
      throw new UnauthorizedException('Account is disabled')
    }

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            googleId: googleUser.googleId,
            authProvider: 'google',
            email: googleUser.email,
            emailVerified: googleUser.emailVerified,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            ...(googleUser.picture ? { avatar: googleUser.picture } : {}),
            role: 'CUSTOMER',
            isActive: true,
            lastLoginAt: new Date(),
          },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            phone: true,
            firstName: true,
            lastName: true,
            avatar: true,
            phoneVerified: true,
            googleId: true,
            authProvider: true,
            isActive: true,
            customer: { select: { id: true, storeId: true, loyaltyTier: true } },
          },
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          user = await this.prisma.user.findFirst({
            where: {
              OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
            },
            select: {
              id: true,
              email: true,
              emailVerified: true,
              phone: true,
              firstName: true,
              lastName: true,
              avatar: true,
              phoneVerified: true,
              googleId: true,
              authProvider: true,
              isActive: true,
              customer: { select: { id: true, storeId: true, loyaltyTier: true } },
            },
          })
        }
        if (!user) throw err
      }
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? googleUser.googleId,
          authProvider: user.authProvider === 'password' && !user.googleId ? 'google' : user.authProvider ?? 'google',
          email: user.email ?? googleUser.email,
          emailVerified: user.emailVerified || googleUser.emailVerified,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          lastLoginAt: new Date(),
          ...(googleUser.picture && shouldUseGoogleAvatar(user.avatar)
            ? { avatar: googleUser.picture }
            : {}),
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatar: true,
          phoneVerified: true,
          googleId: true,
          authProvider: true,
          isActive: true,
          customer: { select: { id: true, storeId: true, loyaltyTier: true } },
        },
      })
    }

    const customerId =
      user.customer?.storeId === storeId ? user.customer.id : user.customer?.id
    const needsPhone = this.userNeedsPhone(user.phone, user.customer?.id)
    const session = await this.createSession(user.id)

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
      needsPhone,
      user: this.toAuthUser(
        user,
        customerId,
        user.customer?.loyaltyTier,
        needsPhone,
      ),
    }
  }

  async completePhone(
    storeId: string,
    sessionToken: string,
    input: { phone: string; code?: string },
  ) {
    const current = await this.validateSession(sessionToken)
    if (!current) throw new UnauthorizedException('Session expired')

    if (!current.needsPhone) {
      throw new BadRequestException('Phone number is already on your account')
    }

    if (isStorefrontPhoneOtpEnabled()) {
      if (!input.code?.trim()) {
        throw new BadRequestException('Enter the verification code sent to your phone')
      }
      await this.otp.assertValidOtp(storeId, input.phone, input.code)
    }

    const customer = await this.customers.completeGoogleSignup(storeId, current.id, {
      phone: input.phone,
      phoneVerified: isStorefrontPhoneOtpEnabled(),
    })

    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phoneVerified: true,
        emailVerified: true,
      },
    })
    if (!user) throw new UnauthorizedException('Session expired')

    return {
      user: this.toAuthUser(user, customer.id, customer.loyaltyTier, false),
    }
  }

  /**
   * Resolve the customer id for a signed-in user, creating the Customer record
   * on demand (legacy/seeded users can have a User row without a Customer row).
   */
  async ensureCustomerId(user: StorefrontAuthUser, storeId: string): Promise<string> {
    if (user.customerId) return user.customerId

    const existing = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (existing) return existing.id

    // Incomplete Google signup — never invent a Customer with empty phone.
    if (user.needsPhone || normalizePhone(user.phone ?? '').length < 11) {
      throw new BadRequestException('Complete your phone number before continuing')
    }

    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? 'Customer'
    const lastName = parts.slice(1).join(' ') || firstName

    try {
      const customer = await this.prisma.customer.create({
        data: {
          userId: user.id,
          storeId,
          firstName,
          lastName,
          email: user.email,
          phone: user.phone,
        },
        select: { id: true },
      })
      return customer.id
    } catch (err) {
      // Two parallel requests (e.g. wishlist toggle + review) can both pass
      // the findUnique check and race the create. On the unique-constraint
      // loss, return the winner's row instead of failing the request.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.customer.findUnique({
          where: { userId: user.id },
          select: { id: true },
        })
        if (winner) return winner.id
      }
      throw err
    }
  }

  async updateProfile(
    sessionToken: string,
    input: { name?: string; avatar?: string | null },
  ): Promise<StorefrontAuthUser> {
    const current = await this.validateSession(sessionToken)
    if (!current) throw new UnauthorizedException('Session expired')

    const name = input.name?.trim()
    const parts = name ? name.split(/\s+/).filter(Boolean) : []
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')

    await this.prisma.user.update({
      where: { id: current.id },
      data: {
        ...(firstName ? { firstName, lastName: lastName || '' } : {}),
        ...(input.avatar !== undefined ? { avatar: input.avatar || null } : {}),
      },
    })

    const refreshed = await this.validateSession(sessionToken)
    if (!refreshed) throw new UnauthorizedException('Session expired')
    return refreshed
  }

  async sendEmailVerification(
    storeId: string,
    sessionToken: string,
  ): Promise<{ success: true; message: string; expiresIn: number }> {
    const current = await this.validateSession(sessionToken)
    if (!current) throw new UnauthorizedException('Session expired')
    if (current.emailVerified) {
      return { success: true, message: 'Email is already verified', expiresIn: 0 }
    }
    if (!current.email) throw new BadRequestException('Add an email address first')

    const key = this.emailVerificationKey(storeId, current.id)
    const existing = await this.getEmailVerification(key)
    if (existing && existing.expiresAt - Date.now() > (EMAIL_VERIFY_TTL_SEC - EMAIL_VERIFY_COOLDOWN_SEC) * 1000) {
      throw new BadRequestException('Please wait before requesting another code')
    }

    const code = String(randomInt(100000, 1000000))
    const payload: EmailVerificationPayload = {
      digest: this.emailVerificationDigest(current.id, current.email, code),
      attempts: 0,
      email: current.email,
      expiresAt: Date.now() + EMAIL_VERIFY_TTL_SEC * 1000,
    }
    await this.storeEmailVerification(key, payload)

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://splaro.co').replace(/\/$/, '')
    const sent = await this.email.sendForStore({
      storeId,
      to: current.email,
      subject: `${code} is your SPLARO verification code`,
      html: generateEmailVerificationHTML({
        firstName: current.name.split(/\s+/)[0] ?? 'there',
        code,
        siteUrl,
        expiresInMinutes: EMAIL_VERIFY_TTL_SEC / 60,
      }),
      text: generateEmailVerificationText({
        firstName: current.name.split(/\s+/)[0] ?? 'there',
        code,
        expiresInMinutes: EMAIL_VERIFY_TTL_SEC / 60,
      }),
      transactional: true,
    })

    if (!sent) {
      await this.deleteEmailVerification(key)
      throw new ServiceUnavailableException('Could not send verification email. Please try again shortly.')
    }

    return {
      success: true,
      message: `Verification code sent to ${current.email}`,
      expiresIn: EMAIL_VERIFY_TTL_SEC,
    }
  }

  async verifyEmail(
    storeId: string,
    sessionToken: string,
    codeRaw: string,
  ): Promise<{ success: true; user: StorefrontAuthUser }> {
    const current = await this.validateSession(sessionToken)
    if (!current) throw new UnauthorizedException('Session expired')
    if (current.emailVerified) return { success: true, user: current }

    const code = codeRaw?.replace(/\D/g, '')
    if (code.length !== 6) throw new BadRequestException('Enter the 6-digit verification code')

    const key = this.emailVerificationKey(storeId, current.id)
    const payload = await this.getEmailVerification(key)
    if (!payload || payload.expiresAt <= Date.now() || payload.email !== current.email) {
      await this.deleteEmailVerification(key)
      throw new BadRequestException('Verification code expired. Request a new code.')
    }

    const expected = Buffer.from(payload.digest, 'hex')
    const actual = Buffer.from(this.emailVerificationDigest(current.id, current.email, code), 'hex')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = payload.attempts + 1
      if (attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) {
        await this.deleteEmailVerification(key)
        throw new BadRequestException('Too many incorrect attempts. Request a new code.')
      }
      await this.storeEmailVerification(key, { ...payload, attempts })
      throw new BadRequestException('Incorrect verification code')
    }

    await this.prisma.user.update({
      where: { id: current.id },
      data: { emailVerified: true, verifyToken: null },
    })
    await this.deleteEmailVerification(key)
    const user = await this.validateSession(sessionToken)
    if (!user) throw new UnauthorizedException('Session expired')
    return { success: true, user }
  }

  async getDefaultAddress(customerId: string) {
    return this.prisma.address.findFirst({
      where: { customerId, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async saveDefaultAddress(
    customerId: string,
    user: StorefrontAuthUser,
    input: { address: string; district: string; thana: string },
  ) {
    const street = input.address.trim()
    const district = input.district.trim()
    const thana = input.thana.trim()
    if (!street || !district || !thana) {
      throw new BadRequestException('Complete delivery address, district, and thana are required')
    }

    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? 'Customer'
    const lastName = parts.slice(1).join(' ') || firstName
    const isInsideDhaka = district.toLowerCase() === 'dhaka'

    const data = {
      label: 'Default',
      firstName,
      lastName,
      phone: user.phone,
      addressLine1: street,
      city: thana,
      district,
      division: district,
      isDefault: true,
      isInsideDhaka,
    }

    const existing = await this.getDefaultAddress(customerId)

    await this.prisma.address.updateMany({
      where: { customerId, ...(existing ? { id: { not: existing.id } } : {}) },
      data: { isDefault: false },
    })

    if (existing) {
      return this.prisma.address.update({
        where: { id: existing.id },
        data,
      })
    }

    return this.prisma.address.create({
      data: { ...data, customerId },
    })
  }

  async logout(sessionToken: string): Promise<void> {
    if (!sessionToken?.trim()) return
    await this.prisma.deviceSession.updateMany({
      where: { sessionToken, isRevoked: false },
      data: { isRevoked: true },
    })
  }

  async forgotPassword(
    storeId: string,
    emailRaw: string,
  ): Promise<{ success: true; message: string; devToken?: string }> {
    const email = normalizeEmail(emailRaw)
    if (!email) throw new BadRequestException('Email is required')

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true, email: true, firstName: true },
    })

    const message = 'If that email exists, a reset link has been sent'

    if (!user?.email) {
      return { success: true, message }
    }

    const token = randomBytes(32).toString('hex')
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp },
    })

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '')
    const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`

    const sent = await this.email.sendForStore({
      storeId,
      to: user.email,
      subject: 'Reset your SPLARO password',
      html: generatePasswordResetEmailHTML({
        firstName: user.firstName,
        resetUrl,
        storeName: 'SPLARO',
        siteUrl,
      }),
      text: generatePasswordResetEmailText({ firstName: user.firstName, resetUrl }),
      transactional: true,
    })

    if (!sent) {
      throw new ServiceUnavailableException(
        'Could not send reset email right now. Please try again shortly.',
      )
    }

    return {
      success: true,
      message,
      ...(process.env.NODE_ENV !== 'production' ? { devToken: token } : {}),
    }
  }

  async resetPassword(tokenRaw: string, password: string): Promise<{ success: true; message: string }> {
    const token = tokenRaw?.trim()
    if (!token) throw new BadRequestException('Token is required')
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters')
    }

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
        isActive: true,
      },
      select: { id: true },
    })

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(password),
          resetToken: null,
          resetTokenExp: null,
        },
      }),
      this.prisma.deviceSession.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ])

    return { success: true, message: 'Password updated' }
  }

  async sessionPhone(sessionToken: string): Promise<string | null> {
    const user = await this.validateSession(sessionToken)
    if (!user?.phone) return null
    return normalizePhone(user.phone)
  }

  private async createSession(userId: string) {
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    return this.prisma.deviceSession.create({
      data: {
        userId,
        sessionToken,
        expiresAt,
        deviceType: 'web',
        browser: 'storefront',
      },
    })
  }

  private emailVerificationKey(storeId: string, userId: string) {
    return `splaro:email-verify:${storeId}:${userId}`
  }

  private emailVerificationDigest(userId: string, email: string, code: string) {
    const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ENCRYPTION_KEY ?? 'splaro-local-email-verification'
    return createHash('sha256').update(`${userId}:${email}:${code}:${secret}`).digest('hex')
  }

  private async storeEmailVerification(key: string, payload: EmailVerificationPayload) {
    await this.redis.setJson(key, payload, Math.max(1, Math.ceil((payload.expiresAt - Date.now()) / 1000)))
    if (!this.redis.isReady) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Email verification is temporarily unavailable')
      }
      memoryEmailVerification.set(key, payload)
    }
  }

  private async getEmailVerification(key: string): Promise<EmailVerificationPayload | null> {
    const cached = await this.redis.getJson<EmailVerificationPayload>(key)
    if (cached) return cached
    const memory = memoryEmailVerification.get(key)
    if (!memory || memory.expiresAt <= Date.now()) {
      memoryEmailVerification.delete(key)
      return null
    }
    return memory
  }

  private async deleteEmailVerification(key: string) {
    await this.redis.del(key)
    memoryEmailVerification.delete(key)
  }

  private userNeedsPhone(phone: string | null | undefined, customerId?: string | null) {
    const digits = normalizePhone(phone ?? '')
    if (digits.length < 11) return true
    return !customerId
  }

  private toAuthUser(
    user: {
      id: string
      email: string | null
      phone: string | null
      firstName: string
      lastName: string
      avatar?: string | null
      phoneVerified?: boolean
      emailVerified?: boolean
    },
    customerId?: string,
    loyaltyTier?: string,
    needsPhone?: boolean,
  ): StorefrontAuthUser {
    const phonePending = needsPhone ?? this.userNeedsPhone(user.phone, customerId)
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email ?? '',
      phone: user.phone ?? '',
      ...(customerId ? { customerId } : {}),
      ...(user.avatar ? { avatar: user.avatar } : {}),
      ...(user.phoneVerified ? { phoneVerified: true } : {}),
      emailVerified: Boolean(user.emailVerified),
      ...(loyaltyTier ? { loyaltyTier } : {}),
      ...(phonePending ? { needsPhone: true } : {}),
    }
  }
}
