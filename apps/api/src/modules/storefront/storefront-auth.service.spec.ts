import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { StorefrontAuthService } from './storefront-auth.service'

type SessionUser = {
  id: string
  email: string | null
  phone: string | null
  customerId: string | null
}

function buildService(opts: {
  googleEmailVerified?: boolean
  sessionUser?: SessionUser | null
}) {
  const sessionUser = opts.sessionUser ?? null

  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation(async () =>
        sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email,
              phone: sessionUser.phone,
              firstName: 'Test',
              lastName: 'User',
              avatar: null,
              phoneVerified: false,
              emailVerified: true,
            }
          : null,
      ),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    deviceSession: {
      findFirst: jest.fn().mockImplementation(async () =>
        sessionUser
          ? {
              id: 'session-1',
              user: {
                id: sessionUser.id,
                email: sessionUser.email,
                phone: sessionUser.phone,
                firstName: 'Test',
                lastName: 'User',
                isActive: true,
                avatar: null,
                phoneVerified: false,
                emailVerified: true,
                customer: sessionUser.customerId
                  ? { id: sessionUser.customerId, loyaltyTier: 'BRONZE' }
                  : null,
              },
            }
          : null,
      ),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        sessionToken: 'session-token',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  }

  const customers = { completeGoogleSignup: jest.fn() }
  const googleIdToken = {
    isConfigured: jest.fn().mockReturnValue(true),
    verify: jest.fn().mockResolvedValue({
      googleId: 'google-1',
      email: 'shopper@example.com',
      emailVerified: opts.googleEmailVerified ?? true,
      firstName: 'Shopper',
      lastName: 'Example',
    }),
  }
  const otp = { assertValidOtp: jest.fn() }
  const redis = {
    getCounter: jest.fn().mockResolvedValue(0),
    incrWithExpiry: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(undefined),
  }
  const email = { sendForStore: jest.fn().mockResolvedValue(true) }

  const service = new StorefrontAuthService(
    prisma as never,
    customers as never,
    email as never,
    googleIdToken as never,
    otp as never,
    redis as never,
  )

  return { service, prisma, googleIdToken, customers }
}

describe('StorefrontAuthService googleSignIn', () => {
  it('refuses an unverified Google email instead of matching an existing account', async () => {
    const { service, prisma } = buildService({ googleEmailVerified: false })

    await expect(service.googleSignIn('store-1', 'credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    // Never looked for an account to attach the unverified address to.
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('accepts a verified Google email', async () => {
    const { service, prisma } = buildService({ googleEmailVerified: true })
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
      emailVerified: true,
      phone: null,
      firstName: 'Shopper',
      lastName: 'Example',
      avatar: null,
      phoneVerified: false,
      googleId: 'google-1',
      authProvider: 'google',
      isActive: true,
      customer: null,
    })

    const result = await service.googleSignIn('store-1', 'credential')

    expect(result.needsPhone).toBe(true)
    expect(result.isNewUser).toBe(true)
  })
})

describe('StorefrontAuthService completePhone', () => {
  const completeUser: SessionUser = {
    id: 'user-1',
    email: 'shopper@example.com',
    phone: '01712345678',
    customerId: 'customer-1',
  }

  it('is idempotent when the same phone is submitted twice', async () => {
    const { service } = buildService({ sessionUser: completeUser })

    const result = await service.completePhone('store-1', 'token', { phone: '01712345678' })

    expect(result.isNewCustomer).toBe(false)
    expect(result.user.phone).toBe('01712345678')
  })

  it('accepts the 880 form of the same number as a duplicate submit', async () => {
    const { service } = buildService({ sessionUser: completeUser })

    const result = await service.completePhone('store-1', 'token', { phone: '8801712345678' })

    expect(result.isNewCustomer).toBe(false)
  })

  it('rejects a different phone on an already complete account', async () => {
    const { service } = buildService({ sessionUser: completeUser })

    await expect(
      service.completePhone('store-1', 'token', { phone: '01911112222' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('completes the phone step for an incomplete Google account', async () => {
    const { service, customers } = buildService({
      sessionUser: { id: 'user-1', email: 'shopper@example.com', phone: null, customerId: null },
    })
    customers.completeGoogleSignup.mockResolvedValue({
      customer: { id: 'customer-9', loyaltyTier: 'BRONZE' },
      created: true,
    })

    const result = await service.completePhone('store-1', 'token', { phone: '01712345678' })

    expect(customers.completeGoogleSignup).toHaveBeenCalledWith('store-1', 'user-1', {
      phone: '01712345678',
      phoneVerified: false,
    })
    expect(result.isNewCustomer).toBe(true)
  })
})
