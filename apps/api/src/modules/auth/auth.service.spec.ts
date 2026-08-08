import { createHash } from 'crypto'
import { ForbiddenException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { hashPassword } from '../../common/password.util'

describe('AuthService role-split login', () => {
  function buildService(opts: {
    staff?: {
      userId: string
      email: string
      role: string
      storeId: string
      passwordHash?: string | null
      emailVerified?: boolean
      isActive?: boolean
    } | null
  }) {
    const staff = opts.staff
    const prisma: Record<string, unknown> = {
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { email?: string; id?: string } }) => {
          if (!staff) return null
          if (where.email && where.email !== staff.email) return null
          if (where.id && where.id !== staff.userId) return null
          return {
            id: staff.userId,
            email: staff.email,
            firstName: 'Test',
            lastName: 'User',
            passwordHash: staff.passwordHash ?? null,
            isActive: staff.isActive ?? true,
            emailVerified: staff.emailVerified ?? true,
            role: staff.role,
            staffRoles: [{ role: staff.role, storeId: staff.storeId, store: { slug: 'splaro' } }],
            ownedStores: [],
          }
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (!staff || where.id !== staff.userId) return null
          return {
            id: staff.userId,
            email: staff.email,
            firstName: 'Test',
            lastName: 'User',
            passwordHash: staff.passwordHash ?? null,
            isActive: staff.isActive ?? true,
            emailVerified: staff.emailVerified ?? true,
            role: staff.role,
          }
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      staffRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(
          staff
            ? { permissions: ['orders:view'], role: staff.role }
            : null,
        ),
        upsert: jest.fn(),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: staff?.storeId ?? 'store-1', slug: 'splaro' }),
        findUnique: jest.fn().mockResolvedValue({ id: staff?.storeId ?? 'store-1', name: 'SPLARO' }),
      },
      siteSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      loginHistory: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      adminInvite: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    }

    const email = { sendForStore: jest.fn().mockResolvedValue(true) }
    const loginTokens = {
      consume: jest.fn(),
      issue: jest.fn(),
    }
    const redis = {
      getCounter: jest.fn().mockResolvedValue(0),
      incrWithExpiry: jest.fn().mockResolvedValue(1),
      del: jest.fn(),
    }
    const config = { get: jest.fn().mockReturnValue(undefined) }
    const sessionResolver = { resolveLiveSession: jest.fn() }

    const service = new AuthService(
      prisma as never,
      config as never,
      loginTokens as never,
      redis as never,
      sessionResolver as never,
      email as never,
    )

    return { service, prisma, email, loginTokens }
  }

  it('resolves telegram method for SUPER_ADMIN', async () => {
    const { service } = buildService({
      staff: {
        userId: 'u1',
        email: 'ceo@example.com',
        role: 'SUPER_ADMIN',
        storeId: 'store-1',
      },
    })
    await expect(service.resolveLoginMethod('ceo@example.com')).resolves.toEqual({
      method: 'telegram',
      email: 'ceo@example.com',
      exists: true,
    })
  })

  it('resolves password method for STAFF', async () => {
    const { service } = buildService({
      staff: {
        userId: 'u2',
        email: 'staff@example.com',
        role: 'STAFF',
        storeId: 'store-1',
        passwordHash: hashPassword('password12'),
        emailVerified: true,
      },
    })
    await expect(service.resolveLoginMethod('staff@example.com')).resolves.toEqual({
      method: 'password',
      email: 'staff@example.com',
      exists: true,
    })
  })

  it('resolves telegram method for ADMIN', async () => {
    const { service } = buildService({
      staff: {
        userId: 'u-admin',
        email: 'admin@example.com',
        role: 'ADMIN',
        storeId: 'store-1',
      },
    })
    await expect(service.resolveLoginMethod('admin@example.com')).resolves.toEqual({
      method: 'telegram',
      email: 'admin@example.com',
      exists: true,
    })
  })

  it('rejects Super Admin password login', async () => {
    const { service } = buildService({
      staff: {
        userId: 'u1',
        email: 'ceo@example.com',
        role: 'SUPER_ADMIN',
        storeId: 'store-1',
        passwordHash: hashPassword('password12'),
        emailVerified: true,
      },
    })
    await expect(
      service.loginWithPassword('ceo@example.com', 'password12', 'splaro', { ipAddress: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects staff token login', async () => {
    const { service, loginTokens } = buildService({
      staff: {
        userId: 'u2',
        email: 'staff@example.com',
        role: 'MANAGER',
        storeId: 'store-1',
        passwordHash: hashPassword('password12'),
        emailVerified: true,
      },
    })
    loginTokens.consume.mockResolvedValue(true)
    await expect(
      service.loginWithToken('staff@example.com', 'ABCD1234', 'splaro', { ipAddress: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('accepts invite: sets verified + password then logs in', async () => {
    const password = 'password12'
    const { service, prisma } = buildService({
      staff: {
        userId: 'u3',
        email: 'invitee@example.com',
        role: 'STAFF',
        storeId: 'store-1',
        passwordHash: null,
        emailVerified: false,
      },
    })

    const rawToken = 'a'.repeat(32)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    ;(prisma.adminInvite as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: 'inv-1',
      tokenHash,
      email: 'invitee@example.com',
      role: 'STAFF',
      storeId: 'store-1',
      firstName: 'Invite',
      lastName: 'ee',
      userId: 'u3',
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
    })

    let updated = false
    ;(prisma.user as { update: jest.Mock }).update.mockImplementation(async () => {
      updated = true
      return {}
    })
    ;(prisma.user as { findFirst: jest.Mock }).findFirst.mockImplementation(async () => ({
      id: 'u3',
      email: 'invitee@example.com',
      firstName: 'Invite',
      lastName: 'ee',
      passwordHash: updated ? hashPassword(password) : null,
      isActive: true,
      emailVerified: updated,
      role: 'STAFF',
      staffRoles: [{ role: 'STAFF', storeId: 'store-1', store: { slug: 'splaro' } }],
      ownedStores: [],
    }))

    const result = await service.acceptInvite(rawToken, password, undefined, { ipAddress: '127.0.0.1' })
    expect(result.email).toBe('invitee@example.com')
    expect(result.role).toBe('STAFF')
    expect((prisma.adminInvite as { updateMany: jest.Mock }).updateMany).toHaveBeenCalled()
  })

  it('createInviteTokenPair returns hashable token', () => {
    const { service } = buildService({ staff: null })
    const pair = service.createInviteTokenPair()
    expect(pair.rawToken.length).toBeGreaterThanOrEqual(32)
    expect(pair.tokenHash).toHaveLength(64)
    expect(pair.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('AuthService resolveAdminStaff missing', () => {
  it('returns generic telegram method without leaking existence', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      staffRole: { findFirst: jest.fn().mockResolvedValue(null) },
      store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1', slug: 'splaro' }) },
    }
    const service = new AuthService(
      prisma as never,
      { get: jest.fn() } as never,
      {} as never,
      { getCounter: jest.fn().mockResolvedValue(0) } as never,
      {} as never,
      { sendForStore: jest.fn() } as never,
    )
    await expect(service.resolveLoginMethod('nobody@example.com')).resolves.toEqual({
      method: 'telegram',
      email: 'nobody@example.com',
      exists: false,
    })
  })
})
