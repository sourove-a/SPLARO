import type { PrismaService } from '../../common/prisma.service'
import { MarketingController } from './marketing.controller'

describe('MarketingController campaign scope', () => {
  const service = {
    getCampaign: jest.fn().mockResolvedValue({ id: 'campaign-1' }),
    createCampaign: jest.fn().mockResolvedValue({ id: 'campaign-1' }),
    updateCampaign: jest.fn(),
    deleteCampaign: jest.fn(),
    duplicateCampaign: jest.fn(),
    sendCampaignNow: jest.fn(),
  }
  const prisma = {
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: 'store-session' }),
    },
  } as unknown as PrismaService

  beforeEach(() => jest.clearAllMocks())

  it('uses the authenticated store for detail reads', async () => {
    const controller = new MarketingController(service as never, prisma)

    await controller.getCampaign('campaign-1', {
      adminUser: { storeId: 'store-session' },
    } as never)

    expect(service.getCampaign).toHaveBeenCalledWith('campaign-1', 'store-session')
  })

  it('does not trust body or query store IDs when creating', async () => {
    const controller = new MarketingController(service as never, prisma)

    await controller.createCampaign(
      'store-requested',
      {
        storeId: 'store-body',
        name: 'Launch',
        subject: 'New collection',
        body: 'Shop now',
        type: 'EMAIL',
      },
      { adminUser: { storeId: 'store-session' } } as never,
    )

    expect(service.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-session' }),
    )
  })
})
