import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../../common/prisma.service'
import { MarketingService } from './marketing.service'

describe('MarketingService campaign contract', () => {
  const campaign = {
    id: 'campaign-1',
    storeId: 'store-1',
    name: 'Launch',
    subject: 'New collection',
    body: 'Shop now',
    type: 'EMAIL',
    recipientType: 'ALL',
    recipientTags: [],
    status: 'DRAFT',
    scheduledAt: null,
    sentAt: null,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
  }

  function buildService(
    overrides: Record<string, unknown> = {},
    recipients: unknown[] = [],
    email: Record<string, unknown> = {},
  ) {
    const prisma = {
      campaign: {
        create: jest.fn().mockResolvedValue(campaign),
        findFirst: jest.fn().mockResolvedValue(campaign),
        update: jest.fn().mockResolvedValue(campaign),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue(campaign),
        ...overrides,
      },
      customer: { findMany: jest.fn().mockResolvedValue(recipients) },
    } as unknown as PrismaService
    const service = new MarketingService(
      prisma,
      {} as never,
      { add: jest.fn().mockResolvedValue({ id: 'job-1' }) } as never,
      email as never,
      {} as never,
    )
    return { prisma, service }
  }

  it('rejects unsupported campaign channels before persistence', async () => {
    const { prisma, service } = buildService()

    await expect(
      service.createCampaign({
        storeId: 'store-1',
        name: 'Push',
        subject: 'Push',
        body: 'Push',
        type: 'PUSH' as never,
        targetAudience: 'ALL',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.campaign.create).not.toHaveBeenCalled()
  })

  it('does not expose another store campaign', async () => {
    const { prisma, service } = buildService({ findFirst: jest.fn().mockResolvedValue(null) })

    await expect(service.getCampaign('campaign-1', 'store-2')).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: 'campaign-1', storeId: 'store-2' },
    })
  })

  it('keeps duplicate data in the requesting store and resets delivery state', async () => {
    const { prisma, service } = buildService()

    await service.duplicateCampaign('campaign-1', 'store-1')
    expect(prisma.campaign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 'store-1',
        status: 'DRAFT',
        scheduledAt: null,
      }),
    })
  })

  it('rejects a second send after the campaign is sent', async () => {
    const { service } = buildService({
      findFirst: jest.fn().mockResolvedValue({ ...campaign, status: 'SENT' }),
    })

    await expect(service.sendCampaignNow('campaign-1', 'store-1')).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('rejects an empty update before Prisma receives invalid data', async () => {
    const { service, prisma } = buildService()

    await expect(service.updateCampaign('campaign-1', {}, 'store-1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prisma.campaign.update).not.toHaveBeenCalled()
  })

  it('marks a provider exception as failed for an honest retry state', async () => {
    const sendForStore = jest.fn().mockRejectedValue(new Error('SMTP unavailable'))
    const { service, prisma } = buildService(
      {},
      [{ email: 'buyer@example.com', firstName: 'Buyer', lastName: '' }],
      { sendForStore },
    )

    await expect(service.sendCampaignNow('campaign-1', 'store-1')).rejects.toThrow(
      'SMTP unavailable',
    )
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'FAILED', totalSent: 0, totalDelivered: 0 },
    })
  })
})
