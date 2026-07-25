import { BadRequestException } from '@nestjs/common'
import { SecurityService } from './security.service'

describe('SecurityService inviteStaff', () => {
  function buildService() {
    const prisma = {
      staffRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          userId: 'user-new',
          role: data.role,
          user: {
            id: 'user-new',
            email: 'new@example.com',
            firstName: 'New',
            lastName: 'Staff',
            isActive: true,
            lastLoginAt: null,
            twoFAEnabled: false,
          },
        })),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'user-new',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'Staff',
          isActive: true,
        }),
        update: jest.fn(),
      },
      adminInvite: {
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-1', slug: 'splaro' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'store-1', name: 'SPLARO' }),
      },
      siteSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    }

    const email = { sendForStore: jest.fn().mockResolvedValue(true) }
    const auth = {
      createInviteTokenPair: jest.fn().mockReturnValue({
        rawToken: 'b'.repeat(32),
        tokenHash: 'c'.repeat(64),
        expiresAt: new Date(Date.now() + 48 * 3600_000),
      }),
    }

    const service = new SecurityService(
      {} as never,
      prisma as never,
      email as never,
      auth as never,
    )

    return { service, prisma, email, auth }
  }

  it('creates pending user + AdminInvite and sends email (no temp password)', async () => {
    const { service, prisma, email, auth } = buildService()

    const result = await service.inviteStaff(
      'splaro',
      { email: 'new@example.com', firstName: 'New', role: 'STAFF' },
      {
        userId: 'super-1',
        email: 'ceo@example.com',
        name: 'CEO',
        role: 'SUPER_ADMIN',
        storeId: 'store-1',
        permissions: ['*'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    )

    expect(auth.createInviteTokenPair).toHaveBeenCalled()
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          emailVerified: false,
          passwordHash: null,
          role: 'STAFF',
        }),
      }),
    )
    expect(prisma.adminInvite.create).toHaveBeenCalled()
    expect(email.sendForStore).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        transactional: true,
      }),
    )
    expect(result.emailSent).toBe(true)
    expect(result.status).toBe('pending')
  })

  it('rejects Super Admin invite role', async () => {
    const { service } = buildService()
    await expect(
      service.inviteStaff(
        'splaro',
        { email: 'x@example.com', firstName: 'X', role: 'SUPER_ADMIN' },
        {
          userId: 'super-1',
          email: 'ceo@example.com',
          name: 'CEO',
          role: 'SUPER_ADMIN',
          storeId: 'store-1',
          permissions: ['*'],
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
