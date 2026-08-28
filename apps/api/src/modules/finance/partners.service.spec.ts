import { BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { PartnersService } from './partners.service'

function makeDependencies() {
  const tx = {
    partner: {
      create: jest.fn(),
      update: jest.fn(),
    },
    partnerShareSetting: {
      create: jest.fn(),
    },
  }
  const prisma = {
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
    },
    partner: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: PrismaService) => Promise<unknown>) =>
      callback(tx as unknown as PrismaService),
    ),
  } as unknown as PrismaService
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as FinanceAuditService

  return { prisma, audit, tx }
}

describe('PartnersService', () => {
  it('creates the partner and initial share setting in one transaction without returning the invite token', async () => {
    const { prisma, audit, tx } = makeDependencies()
    const created = {
      id: 'partner-1',
      storeId: 'store-1',
      name: 'A Partner',
      slug: 'a-partner',
      email: 'partner@example.com',
      sharePercent: 100,
      inviteStatus: 'INVITED',
      inviteToken: 'hashed-token',
    }
    jest.mocked(tx.partner.create).mockResolvedValue(created as never)
    jest.mocked(tx.partnerShareSetting.create).mockResolvedValue({ id: 'share-1' } as never)

    const result = await new PartnersService(prisma, audit).create('store-1', {
      name: ' A Partner ',
      email: 'PARTNER@example.com',
      sharePercent: 100,
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.partnerShareSetting.create).toHaveBeenCalledWith({
      data: {
        storeId: 'store-1',
        partnerId: 'partner-1',
        sharePercent: 100,
        createdBy: undefined,
      },
    })
    expect(result.partner).not.toHaveProperty('inviteToken')
  })

  it('rejects share updates for partners outside the resolved store before opening a transaction', async () => {
    const { prisma, audit } = makeDependencies()
    jest.mocked(prisma.partner.findMany).mockResolvedValue([])

    await expect(
      new PartnersService(prisma, audit).updateSharePercentages('store-1', [
        { partnerId: 'foreign-partner', sharePercent: 100 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates all shares atomically and strips invite secrets from profile responses', async () => {
    const { prisma, audit, tx } = makeDependencies()
    const partner = {
      id: 'partner-1',
      storeId: 'store-1',
      name: 'A Partner',
      slug: 'a-partner',
      email: 'partner@example.com',
      inviteToken: 'hashed-token',
    }
    jest.mocked(prisma.partner.findMany)
      .mockResolvedValueOnce([{ id: 'partner-1' }, { id: 'partner-2' }] as never)
      .mockResolvedValueOnce([] as never)
    jest.mocked(prisma.partner.findFirst).mockResolvedValue(partner as never)
    jest.mocked(prisma.partner.update).mockResolvedValue({
      ...partner,
      name: 'Updated Partner',
    } as never)
    jest.mocked(tx.partner.update).mockResolvedValue({} as never)
    jest.mocked(tx.partnerShareSetting.create).mockResolvedValue({} as never)

    const service = new PartnersService(prisma, audit)
    await service.updateSharePercentages('store-1', [
      { partnerId: 'partner-1', sharePercent: 60 },
      { partnerId: 'partner-2', sharePercent: 40 },
    ])
    const updated = await service.updateProfile('store-1', 'a-partner', {
      name: ' Updated Partner ',
      email: 'PARTNER@example.com',
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.partner.update).toHaveBeenCalledTimes(2)
    expect(updated).toEqual(expect.objectContaining({ name: 'Updated Partner' }))
    expect(updated).not.toHaveProperty('inviteToken')
  })
})
