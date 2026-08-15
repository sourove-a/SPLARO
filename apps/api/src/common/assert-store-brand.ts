import { BadRequestException } from '@nestjs/common'
import type { PrismaService } from './prisma.service'

/**
 * Require a real brand on this store, or nothing at all.
 *
 * Brand is optional on a product — most stores sell their own goods and never
 * set one. What is not optional is the store scope: a product must never point
 * at another tenant's brand, so an id that resolves outside this store is
 * rejected rather than silently dropped.
 */
export async function assertStoreBrandId(
  prisma: PrismaService,
  storeId: string,
  brandId: string | null | undefined,
): Promise<string | null> {
  const trimmed = brandId?.trim() || ''
  if (!trimmed) return null

  const brand = await prisma.brand.findFirst({
    where: { id: trimmed, storeId },
    select: { id: true, name: true, isActive: true },
  })
  if (!brand) {
    throw new BadRequestException(
      'Invalid brand — choose an existing brand for this store. No fallback is applied.',
    )
  }
  if (!brand.isActive) {
    throw new BadRequestException(
      `Brand "${brand.name}" is inactive — pick an active brand or leave the product without one.`,
    )
  }
  return brand.id
}
