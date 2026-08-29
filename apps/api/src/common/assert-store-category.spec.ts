import { BadRequestException } from '@nestjs/common'
import { assertStoreCategoryId } from './assert-store-category'
import type { PrismaService } from './prisma.service'

function prismaWith(category: { id: string; slug: string; isActive: boolean } | null) {
  return {
    category: { findFirst: jest.fn().mockResolvedValue(category) },
  } as unknown as PrismaService
}

const HIDDEN = { id: 'kameez', slug: 'kameez', isActive: false }
const LIVE = { id: 'kameez', slug: 'kameez', isActive: true }

describe('assertStoreCategoryId', () => {
  it('accepts a live category', async () => {
    await expect(assertStoreCategoryId(prismaWith(LIVE), 'store-1', 'kameez')).resolves.toBe('kameez')
  })

  it('never falls back when the category is not on the store', async () => {
    await expect(assertStoreCategoryId(prismaWith(null), 'store-1', 'ghost')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('refuses a move into a hidden category', async () => {
    await expect(assertStoreCategoryId(prismaWith(HIDDEN), 'store-1', 'kameez')).rejects.toThrow(
      /inactive/,
    )
  })

  it('lets a product keep the hidden category it is already filed under', async () => {
    // Hiding a category must not brick every edit of the products inside it —
    // the operator may only be changing the price.
    await expect(
      assertStoreCategoryId(prismaWith(HIDDEN), 'store-1', 'kameez', { keepId: 'kameez' }),
    ).resolves.toBe('kameez')
  })

  it('still refuses a hidden category that is not the one already set', async () => {
    await expect(
      assertStoreCategoryId(prismaWith(HIDDEN), 'store-1', 'kameez', { keepId: 'saree' }),
    ).rejects.toThrow(/inactive/)
  })

  it('requires a category only when asked to', async () => {
    await expect(assertStoreCategoryId(prismaWith(null), 'store-1', '')).resolves.toBeNull()
    await expect(
      assertStoreCategoryId(prismaWith(null), 'store-1', '', { required: true }),
    ).rejects.toThrow(BadRequestException)
  })
})
