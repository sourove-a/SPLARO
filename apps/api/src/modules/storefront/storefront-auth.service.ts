import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import {
  generatePasswordResetEmailHTML,
  generatePasswordResetEmailText,
} from '../email/password-reset-email.template'
import { CustomersService } from '../customers/customers.service'

const SCRYPT_KEYLEN = 64
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

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

export interface StorefrontAuthUser {
  id: string
  name: string
  email: string
  phone: string
  customerId?: string
  avatar?: string | null
  phoneVerified?: boolean
  loyaltyTier?: string
}

@Injectable()
export class StorefrontAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly email: EmailService,
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
        customer: { select: { id: true, storeId: true, loyaltyTier: true } },
      },
    })

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
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

  private toAuthUser(
    user: {
      id: string
      email: string | null
      phone: string | null
      firstName: string
      lastName: string
      avatar?: string | null
      phoneVerified?: boolean
    },
    customerId?: string,
    loyaltyTier?: string,
  ): StorefrontAuthUser {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email ?? '',
      phone: user.phone ?? '',
      ...(customerId ? { customerId } : {}),
      ...(user.avatar ? { avatar: user.avatar } : {}),
      ...(user.phoneVerified ? { phoneVerified: true } : {}),
      ...(loyaltyTier ? { loyaltyTier } : {}),
    }
  }
}
