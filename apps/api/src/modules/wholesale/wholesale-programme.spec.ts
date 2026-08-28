import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WholesaleService, slugifyTier } from './wholesale.service'
import { formatWholesaleReference, isWholesaleReference } from './wholesale-reference'

jest.mock('../../common/revalidate-web', () => ({
  revalidateStorefrontWeb: jest.fn().mockResolvedValue(undefined),
}))

function buildService(opts: {
  tier?: { id: string; name: string } | null
  recent?: { id: string; referenceCode: string | null } | null
  existingTier?: { id: string } | null
} = {}) {
  const created: Record<string, unknown>[] = []
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([{ nextValue: 42n }]),
    wholesaleInquiry: {
      create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data)
        return { id: 'inq-1', referenceCode: args.data.referenceCode }
      }),
    },
  }
  const prisma = {
    wholesaleInquiry: {
      findFirst: jest.fn().mockResolvedValue(opts.recent ?? null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    wholesaleTier: {
      findFirst: jest.fn().mockResolvedValue(
        opts.existingTier !== undefined ? opts.existingTier : (opts.tier ?? null),
      ),
      create: jest.fn().mockImplementation(async (a: { data: unknown }) => a.data),
      update: jest.fn().mockImplementation(async (a: { data: unknown }) => a.data),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  }
  return { service: new WholesaleService(prisma as never), prisma, tx, created }
}

describe('wholesale reference codes', () => {
  it('formats to a padded, quotable handle', () => {
    expect(formatWholesaleReference(1)).toBe('WS-000001')
    expect(formatWholesaleReference(41n)).toBe('WS-000041')
  })

  it('recognises its own codes and nothing else', () => {
    expect(isWholesaleReference('WS-000041')).toBe(true)
    expect(isWholesaleReference('ws-000041')).toBe(true)
    expect(isWholesaleReference('SPL-C-000041')).toBe(false)
    expect(isWholesaleReference('WS-41')).toBe(false)
    expect(isWholesaleReference(null)).toBe(false)
  })

  it('takes the number one back from the counter, so two submits never collide', async () => {
    const { service, tx } = buildService()
    await service.submit('store-1', {
      fullName: 'Buyer', industry: 'Retail', country: 'Bangladesh', phone: '01711111111',
    })
    // The counter returned 42 (the value *after* this reservation), so ours is 41.
    expect(tx.$queryRaw).toHaveBeenCalled()
    expect(tx.wholesaleInquiry.create.mock.calls[0][0].data.referenceCode).toBe('WS-000041')
  })

  it('hands a repeat submit the same reference rather than a new one', async () => {
    const { service, tx } = buildService({ recent: { id: 'inq-old', referenceCode: 'WS-000007' } })
    const result = await service.submit('store-1', {
      fullName: 'Buyer', industry: 'Retail', country: 'Bangladesh', phone: '01711111111',
    })
    expect(result).toMatchObject({ duplicate: true, referenceCode: 'WS-000007' })
    expect(tx.wholesaleInquiry.create).not.toHaveBeenCalled()
  })
})

describe('wholesale intake — structured fields', () => {
  it('stores a numeric volume alongside the text the buyer typed', async () => {
    const { service, tx } = buildService()
    await service.submit('store-1', {
      fullName: 'Buyer', industry: 'Retail', country: 'Bangladesh', phone: '01711111111',
      monthlyQuantity: 'about 5k', monthlyUnits: 5000,
    })
    const data = tx.wholesaleInquiry.create.mock.calls[0][0].data
    expect(data.monthlyUnits).toBe(5000)
    expect(data.monthlyQuantity).toBe('about 5k')
  })

  it('drops a volume that is zero, negative, or absurd', async () => {
    for (const units of [0, -5, 99_000_000, Number.NaN]) {
      const { service, tx } = buildService()
      await service.submit('store-1', {
        fullName: 'B', industry: 'R', country: 'BD', phone: '01711111111', monthlyUnits: units,
      })
      expect(tx.wholesaleInquiry.create.mock.calls[0][0].data.monthlyUnits).toBeUndefined()
    }
  })

  it('ignores a launch date in the past — that is a mis-keyed year, not a plan', async () => {
    const { service, tx } = buildService()
    await service.submit('store-1', {
      fullName: 'B', industry: 'R', country: 'BD', phone: '01711111111',
      targetLaunch: '2019-01-01',
    })
    expect(tx.wholesaleInquiry.create.mock.calls[0][0].data.targetLaunch).toBeUndefined()
  })

  it('resolves the tier from its slug scoped to this store, never from a submitted id', async () => {
    const { service, prisma, tx } = buildService({ tier: { id: 'tier-1', name: 'Stockist' } })
    await service.submit('store-1', {
      fullName: 'B', industry: 'R', country: 'BD', phone: '01711111111',
      tierSlug: 'stockist',
    })
    expect(prisma.wholesaleTier.findFirst).toHaveBeenCalledWith({
      where: { storeId: 'store-1', slug: 'stockist', isActive: true },
      select: { id: true, name: true },
    })
    expect(tx.wholesaleInquiry.create.mock.calls[0][0].data.tierId).toBe('tier-1')
  })

  it('files the lead with no tier when the slug matches nothing in this store', async () => {
    const { service, tx } = buildService({ tier: null })
    await service.submit('store-1', {
      fullName: 'B', industry: 'R', country: 'BD', phone: '01711111111',
      tierSlug: 'someone-elses-tier',
    })
    expect(tx.wholesaleInquiry.create.mock.calls[0][0].data.tierId).toBeUndefined()
  })
})

describe('tier slugs', () => {
  it('turns a display name into a stable key', () => {
    expect(slugifyTier('Export Partner')).toBe('export-partner')
    expect(slugifyTier('  Stockist / Retail  ')).toBe('stockist-retail')
    expect(slugifyTier('Tier — 2')).toBe('tier-2')
  })

  it('refuses to invent a key from punctuation alone', () => {
    expect(slugifyTier('———')).toBe('')
  })
})

describe('tier management', () => {
  it('rejects a duplicate key rather than silently shadowing a tier', async () => {
    const { service } = buildService({ existingTier: { id: 'tier-existing' } })
    await expect(
      service.createTier('store-1', { name: 'Stockist' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects a name that yields no usable key', async () => {
    const { service } = buildService({ existingTier: null })
    await expect(service.createTier('store-1', { name: '///' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('caps perks so the storefront card cannot be stuffed', async () => {
    const { service, prisma } = buildService({ existingTier: null })
    await service.createTier('store-1', {
      name: 'Distributor',
      perks: Array.from({ length: 20 }, (_, i) => `perk ${i}`),
    })
    expect(prisma.wholesaleTier.create.mock.calls[0][0].data.perks).toHaveLength(8)
  })

  it('404s on a tier belonging to another store', async () => {
    const { service } = buildService({ existingTier: null })
    await expect(service.updateTier('store-1', 'tier-x', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('never rewrites the slug on update — filed leads point at it', async () => {
    const { service, prisma } = buildService({ existingTier: { id: 'tier-1' } })
    await service.updateTier('store-1', 'tier-1', { name: 'Renamed', slug: 'brand-new' })
    const data = prisma.wholesaleTier.update.mock.calls[0][0].data
    expect(data.name).toBe('Renamed')
    expect(data.slug).toBeUndefined()
  })
})

describe('lead follow-up', () => {
  function updateService(status: string) {
    const prisma = {
      wholesaleInquiry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inq-1', status: 'NEW' }),
        update: jest.fn().mockImplementation(async (a: { data: unknown }) => a.data),
      },
    }
    return {
      service: new WholesaleService(prisma as never),
      prisma,
      status,
    }
  }

  it('clears the reminder when a lead is decided — nothing left to chase', async () => {
    for (const status of ['WON', 'LOST']) {
      const { service, prisma } = updateService(status)
      await service.update('store-1', 'inq-1', {
        status,
        nextFollowUpAt: '2030-01-01',
      })
      expect(prisma.wholesaleInquiry.update.mock.calls[0][0].data.nextFollowUpAt).toBeNull()
    }
  })

  it('sets a reminder on a live lead', async () => {
    const { service, prisma } = updateService('CONTACTED')
    await service.update('store-1', 'inq-1', {
      status: 'CONTACTED',
      nextFollowUpAt: '2030-06-01',
    })
    const set = prisma.wholesaleInquiry.update.mock.calls[0][0].data.nextFollowUpAt
    expect(set).toBeInstanceOf(Date)
  })

  it('clears the reminder on an explicit null', async () => {
    const { service, prisma } = updateService('CONTACTED')
    await service.update('store-1', 'inq-1', { nextFollowUpAt: null })
    expect(prisma.wholesaleInquiry.update.mock.calls[0][0].data.nextFollowUpAt).toBeNull()
  })

  it('leaves the reminder alone when the field is not sent', async () => {
    const { service, prisma } = updateService('CONTACTED')
    await service.update('store-1', 'inq-1', { adminNotes: 'called' })
    expect(prisma.wholesaleInquiry.update.mock.calls[0][0].data).not.toHaveProperty(
      'nextFollowUpAt',
    )
  })
})
