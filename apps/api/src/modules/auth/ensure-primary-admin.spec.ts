import { ensurePrimaryOwnerAdmin } from './ensure-primary-admin'
import { PRIMARY_OWNER_EMAIL } from '../../common/primary-owner.util'

function buildPrisma(opts: { existing?: boolean; ownerId?: string } = {}) {
  const admin = {
    id: 'u-owner',
    email: PRIMARY_OWNER_EMAIL,
    firstName: 'SPLARO',
    lastName: 'CEO',
    telegramId: null as string | null,
    telegramUsername: null as string | null,
    passwordHash: null as string | null,
  }
  const prisma = {
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: 'store-1', ownerId: opts.ownerId ?? 'someone-else' }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(opts.existing ? admin : null),
      create: jest.fn().mockResolvedValue(admin),
      update: jest.fn().mockResolvedValue({ ...admin, telegramId: '99' }),
    },
    staffRole: { upsert: jest.fn().mockResolvedValue({}) },
    telegramUser: { findFirst: jest.fn().mockResolvedValue({ telegramId: '99', username: 'sourove' }) },
    telegramConfig: { findFirst: jest.fn().mockResolvedValue({ chatId: '99' }) },
  }
  return { prisma, admin }
}

describe('ensurePrimaryOwnerAdmin', () => {
  it('creates the owner when the User row is missing', async () => {
    const { prisma } = buildPrisma({ existing: false })
    const result = await ensurePrimaryOwnerAdmin(prisma as never)
    expect(result.created).toBe(true)
    expect(prisma.user.create).toHaveBeenCalled()
    expect(prisma.staffRole.upsert).toHaveBeenCalled()
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store-1' },
      data: { ownerId: 'u-owner' },
    })
  })

  it('reactivates an existing owner and restores store ownership', async () => {
    const { prisma } = buildPrisma({ existing: true })
    const result = await ensurePrimaryOwnerAdmin(prisma as never)
    expect(result.created).toBe(false)
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalled()
    expect(prisma.staffRole.upsert).toHaveBeenCalled()
  })

  it('throws when the store is not seeded', async () => {
    const { prisma } = buildPrisma()
    prisma.store.findFirst.mockResolvedValue(null)
    await expect(ensurePrimaryOwnerAdmin(prisma as never)).rejects.toThrow(/slug=splaro/)
  })
})
