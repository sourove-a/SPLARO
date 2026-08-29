import { BadRequestException } from '@nestjs/common'
import type { PrismaService } from './prisma.service'

/**
 * Require a real category on this store. Never invent / fall back to another department
 * (e.g. missing "polos" must not become Women).
 */
export async function assertStoreCategoryId(
  prisma: PrismaService,
  storeId: string,
  categoryId: string | null | undefined,
  options?: {
    required?: boolean
    /**
     * The category the record already carries. Hiding a category must not brick
     * every product already filed under it — an edit that leaves the category
     * untouched is allowed through, only a *move* into a hidden category is not.
     */
    keepId?: string | null
  },
): Promise<string | null> {
  const trimmed = categoryId?.trim() || ''
  if (!trimmed) {
    if (options?.required) {
      throw new BadRequestException('Category is required — pick a valid category from the tree.')
    }
    return null
  }

  const category = await prisma.category.findFirst({
    where: { id: trimmed, storeId },
    select: { id: true, slug: true, isActive: true },
  })
  if (!category) {
    throw new BadRequestException(
      'Invalid category — choose an existing category for this store. No fallback is applied.',
    )
  }
  if (!category.isActive && category.id !== (options?.keepId?.trim() || '')) {
    throw new BadRequestException(
      `Category "${category.slug}" is inactive — pick an active category. No fallback is applied.`,
    )
  }
  return category.id
}
