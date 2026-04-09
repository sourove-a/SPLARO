import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async findAllProducts(query: any) {
    const { category, collection, status = 'PUBLISHED', limit = 10, offset = 0 } = query;
    return this.prisma.product.findMany({
      where: {
        status,
        ...(category && { category: { slug: category } }),
        ...(collection && { collections: { some: { slug: collection } } }),
      },
      include: { variants: true, images: true, category: true },
      take: Number(limit),
      skip: Number(offset),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { variants: true, images: true, collections: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getLimitedDrops() {
    return this.prisma.product.findMany({
      where: { isLimitedDrop: true, status: 'PUBLISHED' },
      include: { variants: true },
      orderBy: { releaseDate: 'asc' },
    });
  }
}
