import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
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
