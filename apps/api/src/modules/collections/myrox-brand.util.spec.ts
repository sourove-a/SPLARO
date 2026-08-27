import { ensureJhingephoolBrand, ensureMyroxBrand, ensureSplaroBrand } from './jhingephool.util'
import type { PrismaService } from '../../common/prisma.service'

function fakePrisma() {
  const upserts: Array<Record<string, any>> = []
  const updateManys: Array<Record<string, any>> = []
  const prisma = {
    brand: {
      upsert: (args: Record<string, any>) => {
        upserts.push(args)
        return Promise.resolve({})
      },
      updateMany: (args: Record<string, any>) => {
        updateManys.push(args)
        return Promise.resolve({ count: 0 })
      },
    },
  } as unknown as PrismaService
  return { prisma, upserts, updateManys }
}

describe('house brands', () => {
  it('creates MYROX as an active brand on the store', async () => {
    const { prisma, upserts } = fakePrisma()
    await ensureMyroxBrand(prisma, 'store_1')

    expect(upserts).toHaveLength(1)
    expect(upserts[0].where.storeId_slug).toEqual({ storeId: 'store_1', slug: 'myrox' })
    expect(upserts[0].create).toMatchObject({
      storeId: 'store_1',
      name: 'MYROX',
      slug: 'myrox',
      isActive: true,
    })
  })

  // Pinning the logo on update is what reverted marks uploaded from the
  // product form. None of the house brands may do it.
  it.each([
    ['MYROX', ensureMyroxBrand],
    ['SPLARO', ensureSplaroBrand],
    ['ঝিঙেফুল', ensureJhingephoolBrand],
  ])('%s never writes logo on update', async (_name, ensure) => {
    const { prisma, upserts } = fakePrisma()
    await ensure(prisma, 'store_1')
    expect(upserts[0].update).not.toHaveProperty('logo')
  })

  it('seeds a shipped logo only onto a brand that has none', async () => {
    const { prisma, updateManys } = fakePrisma()
    await ensureSplaroBrand(prisma, 'store_1')

    expect(updateManys).toHaveLength(1)
    expect(updateManys[0].where).toMatchObject({ storeId: 'store_1', slug: 'splaro' })
    expect(updateManys[0].where.OR).toEqual([{ logo: null }, { logo: '' }])
    expect(updateManys[0].data.logo).toBe('/images/logo/splaro-logo-black-premium.webp')
  })

  it('MYROX backfills its shipped mark only when the brand has no logo', async () => {
    const { prisma, updateManys } = fakePrisma()
    await ensureMyroxBrand(prisma, 'store_1')

    expect(updateManys).toHaveLength(1)
    expect(updateManys[0].where).toMatchObject({ storeId: 'store_1', slug: 'myrox' })
    expect(updateManys[0].where.OR).toEqual([{ logo: null }, { logo: '' }])
    expect(updateManys[0].data.logo).toBe('/images/logo/myrox-logo-horizontal.webp')
  })
})
