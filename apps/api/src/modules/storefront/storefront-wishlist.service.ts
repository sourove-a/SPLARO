import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class StorefrontWishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureWishlist(customerId: string) {
    const existing = await this.prisma.wishlist.findUnique({ where: { customerId } })
    if (existing) return existing
    return this.prisma.wishlist.create({ data: { customerId } })
  }

  async listProductIds(customerId: string): Promise<string[]> {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      include: { items: { orderBy: { addedAt: 'desc' } } },
    })
    return wishlist?.items.map((item) => item.productId) ?? []
  }

  async merge(customerId: string, productIds: string[]): Promise<string[]> {
    const unique = [...new Set(productIds.filter(Boolean))]
    if (!unique.length) return this.listProductIds(customerId)

    const wishlist = await this.ensureWishlist(customerId)
    const published = await this.prisma.product.findMany({
      where: { id: { in: unique }, isPublished: true },
      select: { id: true },
    })
    const validIds = published.map((p) => p.id)

    if (validIds.length) {
      await this.prisma.wishlistItem.createMany({
        data: validIds.map((productId) => ({ wishlistId: wishlist.id, productId })),
        skipDuplicates: true,
      })
    }

    return this.listProductIds(customerId)
  }

  async toggle(storeId: string, customerId: string, productId: string): Promise<{
    added: boolean
    productIds: string[]
  }> {
    if (!productId?.trim()) throw new BadRequestException('Product id is required')

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId, isPublished: true },
      select: { id: true },
    })
    if (!product) throw new NotFoundException('Product not found')

    const wishlist = await this.ensureWishlist(customerId)
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    })

    if (existing) {
      await this.prisma.wishlistItem.delete({ where: { id: existing.id } })
      return { added: false, productIds: await this.listProductIds(customerId) }
    }

    await this.prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
    })
    return { added: true, productIds: await this.listProductIds(customerId) }
  }
}
