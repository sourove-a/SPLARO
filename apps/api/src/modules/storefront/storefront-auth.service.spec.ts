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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    isReady: false,
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

  return { service, prisma, googleIdToken, customers, email }
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

describe('StorefrontAuthService forgotPassword', () => {
  it('finds the account by phone number and mails the link to its email', async () => {
    const { service, prisma, email } = buildService({})
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-phone',
      email: 'phone-user@example.com',
      firstName: 'Shopper',
    })

    const result = await service.forgotPassword('store-1', '01712345678')

    expect(result.success).toBe(true)
    expect(result.message).toMatch(/email linked to this phone/i)
    // Looked up by phone, in both the 01… and 880… stored forms.
    const where = prisma.user.findFirst.mock.calls[0]?.[0]?.where as {
      phone?: { in?: string[] }
      email?: string
    }
    expect(where.email).toBeUndefined()
    expect(where.phone?.in).toEqual(expect.arrayContaining(['01712345678']))
    // The link is emailed — no SMS is ever sent.
    expect(email.sendForStore).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'phone-user@example.com' }),
    )
  })

  it('still accepts an email address', async () => {
    const { service, prisma } = buildService({})
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-email',
      email: 'email-user@example.com',
      firstName: 'Shopper',
    })

    await service.forgotPassword('store-1', 'Email-User@Example.com ')

    const where = prisma.user.findFirst.mock.calls[0]?.[0]?.where as { email?: string }
    expect(where.email).toBe('email-user@example.com')
  })

  it('answers clearly when the phone number is not registered', async () => {
    const { service, prisma, email } = buildService({})
    prisma.user.findFirst.mockResolvedValue(null)

    await expect(service.forgotPassword('store-1', '01900000000')).rejects.toThrow(
      /No account found with this phone number/,
    )
    expect(email.sendForStore).not.toHaveBeenCalled()
  })

  it('rejects an empty identifier', async () => {
    const { service } = buildService({})
    await expect(service.forgotPassword('store-1', '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('stores only a SHA-256 of the reset token (never the raw email token)', async () => {
    const { createHash } = await import('crypto')
    const { service, prisma } = buildService({})
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-hash',
      email: 'hash-user@example.com',
      firstName: 'Shopper',
    })

    const result = await service.forgotPassword('store-1', 'hash-user@example.com')
    const updateData = prisma.user.update.mock.calls[0]?.[0]?.data as {
      resetToken?: string
    }
    expect(updateData.resetToken).toMatch(/^[a-f0-9]{64}$/)
    expect(result.devToken).toBeTruthy()
    expect(updateData.resetToken).toBe(
      createHash('sha256').update(String(result.devToken)).digest('hex'),
    )
    expect(updateData.resetToken).not.toBe(result.devToken)
  })

  it('clears the minted token when the reset email fails to send', async () => {
    const { service, prisma, email } = buildService({})
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-fail',
      email: 'fail-send@example.com',
      firstName: 'Shopper',
    })
    email.sendForStore.mockResolvedValue(false)

    await expect(service.forgotPassword('store-1', 'fail-send@example.com')).rejects.toThrow(
      /Could not send reset email/,
    )
    const clearCall = prisma.user.update.mock.calls.find((call) => {
      const data = (call[0] as { data?: { resetToken?: string | null } })?.data
      return data?.resetToken === null
    })
    expect(clearCall).toBeTruthy()
  })

  it('blocks a second reset request within the cooldown window', async () => {
    const { service, prisma } = buildService({})
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-cool',
      email: 'cooldown@example.com',
      firstName: 'Shopper',
    })

    await service.forgotPassword('store-1', 'cooldown@example.com')
    await expect(service.forgotPassword('store-1', 'cooldown@example.com')).rejects.toThrow(
      /wait a minute/i,
    )
  })
})

describe('StorefrontAuthService resetPassword', () => {
  it('consumes a hashed token, revokes old sessions, and returns a fresh session', async () => {
    const { createHash } = await import('crypto')
    const { service, prisma } = buildService({})
    const rawToken = 'a'.repeat(64)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
      phone: '01712345678',
      firstName: 'Shopper',
      lastName: 'Example',
      avatar: null,
      phoneVerified: true,
      emailVerified: true,
      resetToken: tokenHash,
      customer: { id: 'cust-1', loyaltyTier: 'BRONZE' },
    })
    prisma.user.updateMany.mockResolvedValue({ count: 1 })
    prisma.deviceSession.create.mockResolvedValue({
      sessionToken: 'new-session-token',
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await service.resetPassword(rawToken, 'NewPass12')

    expect(prisma.user.findFirst.mock.calls[0]?.[0]?.where).toEqual(
      expect.objectContaining({
        OR: [{ resetToken: tokenHash }, { resetToken: rawToken }],
      }),
    )
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'user-1', resetToken: tokenHash }),
      }),
    )
    expect(prisma.deviceSession.updateMany).toHaveBeenCalled()
    expect(result.sessionToken).toBe('new-session-token')
    expect(result.user.email).toBe('shopper@example.com')
    expect(result.user.customerId).toBe('cust-1')
  })

  it('still accepts a legacy plaintext reset token', async () => {
    const { service, prisma } = buildService({})
    const rawToken = 'b'.repeat(64)

    prisma.user.findFirst.mockResolvedValue({
      id: 'user-legacy',
      email: 'legacy@example.com',
      phone: null,
      firstName: 'Legacy',
      lastName: 'User',
      avatar: null,
      phoneVerified: false,
      emailVerified: true,
      resetToken: rawToken,
      customer: null,
    })
    prisma.user.updateMany.mockResolvedValue({ count: 1 })
    prisma.deviceSession.create.mockResolvedValue({
      sessionToken: 'legacy-session',
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await service.resetPassword(rawToken, 'NewPass12')
    expect(result.sessionToken).toBe('legacy-session')
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resetToken: rawToken }),
      }),
    )
  })

  it('rejects a weak password', async () => {
    const { service } = buildService({})
    await expect(service.resetPassword('a'.repeat(64), 'short')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('rejects an unknown or already-used token', async () => {
    const { service, prisma } = buildService({})
    prisma.user.findFirst.mockResolvedValue(null)
    await expect(service.resetPassword('a'.repeat(64), 'NewPass12')).rejects.toThrow(
      /invalid or was replaced/i,
    )
  })
})
