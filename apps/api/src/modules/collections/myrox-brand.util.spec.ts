import { ensureMyroxBrand } from './jhingephool.util'
import type { PrismaService } from '../../common/prisma.service'

function fakePrisma() {
  const calls: Array<Record<string, unknown>> = []
  const prisma = {
    brand: {
      upsert: (args: Record<string, unknown>) => {
        calls.push(args)
        return Promise.resolve({})
      },
    },
  } as unknown as PrismaService
  return { prisma, calls }
}

describe('ensureMyroxBrand', () => {
  it('creates MYROX as an active house brand on the store', async () => {
    const { prisma, calls } = fakePrisma()
    await ensureMyroxBrand(prisma, 'store_1')

    expect(calls).toHaveLength(1)
    const args = calls[0] as {
      where: { storeId_slug: { storeId: string; slug: string } }
      create: Record<string, unknown>
    }
    expect(args.where.storeId_slug).toEqual({ storeId: 'store_1', slug: 'myrox' })
    expect(args.create).toMatchObject({
      storeId: 'store_1',
      name: 'MYROX',
      slug: 'myrox',
      isActive: true,
    })
  })

  it('never writes logo on update, so an uploaded mark survives the next brand list', async () => {
    const { prisma, calls } = fakePrisma()
    await ensureMyroxBrand(prisma, 'store_1')

    const args = calls[0] as { update: Record<string, unknown> }
    expect(args.update).not.toHaveProperty('logo')
    expect(args.update).toEqual({ name: 'MYROX' })
  })
})
