import { Controller, Get, Header, Inject, Param, Post, Query } from '@nestjs/common'
import { Public } from '../../common/auth/public.decorator'
import { SeoService } from './seo.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('seo')
export class SeoController {
  constructor(
    private readonly seoService: SeoService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Dynamic XML sitemap */
  @Public()
  @Get('sitemap/:storeId')
  @Header('Content-Type', 'application/xml')
  async sitemap(
    @Param('storeId') storeId: string,
    @Query('siteUrl') siteUrl: string,
  ) {
    return this.seoService.generateDynamicSitemap(storeId, siteUrl)
  }

  /** Audit a single product's SEO */
  @Post('audit/product/:productId')
  async auditProduct(
    @Param('productId') productId: string,
    @Query('siteUrl') siteUrl: string,
  ) {
    return this.seoService.auditProduct(productId, siteUrl)
  }

  /** Bulk audit: all products with missing meta for a store */
  @Get('audit/products')
  async auditAllProducts(@Query('storeId') storeId: string, @Query('siteUrl') siteUrl: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const products = await this.prisma.product.findMany({
      where: { storeId: sid, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, slug: true, metaTitle: true, metaDescription: true },
    })

    const issues: { productId: string; name: string; problems: string[] }[] = []

    for (const p of products) {
      const problems: string[] = []
      if (!p.metaTitle) problems.push('Missing meta title')
      else if (p.metaTitle.length < 30) problems.push('Meta title too short')
      else if (p.metaTitle.length > 60) problems.push('Meta title too long')
      if (!p.metaDescription) problems.push('Missing meta description')
      else if (p.metaDescription.length < 100) problems.push('Meta description too short')
      else if (p.metaDescription.length > 160) problems.push('Meta description too long')
      if (!p.slug) problems.push('Missing URL slug')
      if (problems.length) issues.push({ productId: p.id, name: p.name, problems })
    }

    return {
      total: products.length,
      withIssues: issues.length,
      healthy: products.length - issues.length,
      healthScore: Math.round(((products.length - issues.length) / Math.max(products.length, 1)) * 100),
      issues,
    }
  }

  /** Organization / website JSON-LD schema */
  @Public()
  @Get('schema/organization')
  getOrganizationSchema(@Query('siteUrl') siteUrl?: string) {
    return this.seoService.generateOrganizationSchema(siteUrl ?? process.env['SITE_URL'] ?? 'https://splaro.com.bd')
  }

  /** Product JSON-LD schema */
  @Public()
  @Get('schema/product/:productId')
  async getProductSchema(
    @Param('productId') productId: string,
    @Query('siteUrl') siteUrl?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { take: 1 }, images: { take: 1 } },
    })
    if (!product) return { error: 'Product not found' }

    const site = siteUrl ?? process.env['SITE_URL'] ?? 'https://splaro.com.bd'
    const variant = product.variants[0]

    return this.seoService.generateProductSchema({
      name: product.name,
      description: product.description ?? '',
      url: `${site}/products/${product.slug ?? product.id}`,
      images: product.images.map((img) => (img as { url?: string }).url ?? '').filter(Boolean),
      price: Number(variant?.price ?? 0),
      currency: 'BDT',
      sku: variant?.sku ?? product.id,
      brand: 'SPLARO',
      inStock: (variant?.stock ?? 0) > 0,
    })
  }

  /** Breadcrumb JSON-LD schema */
  @Public()
  @Get('schema/breadcrumb')
  getBreadcrumbSchema(@Query('siteUrl') siteUrl: string, @Query('path') path: string) {
    const site = siteUrl ?? process.env['SITE_URL'] ?? 'https://splaro.com.bd'
    const parts = path.split('/').filter(Boolean)
    const items = [{ name: 'Home', url: site }]
    let current = site
    for (const part of parts) {
      current += `/${part}`
      items.push({ name: part.replace(/-/g, ' '), url: current })
    }
    return this.seoService.generateBreadcrumbSchema(items)
  }

  /** SEO overview: meta coverage stats */
  @Get('overview')
  async overview(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const [products, collections, blogPosts] = await Promise.all([
      this.prisma.product.aggregate({
        where: { storeId: sid, status: { not: 'ARCHIVED' } },
        _count: { id: true },
      }),
      this.prisma.collection.aggregate({
        where: { storeId: sid },
        _count: { id: true },
      }),
      this.prisma.blogPost.aggregate({
        where: { storeId: sid },
        _count: { id: true },
      }),
    ])

    const [missingProductMeta, missingCollectionMeta] = await Promise.all([
      this.prisma.product.count({
        where: {
          storeId: sid,
          status: { not: 'ARCHIVED' },
          OR: [{ metaTitle: null }, { metaDescription: null }],
        },
      }),
      this.prisma.collection.count({
        where: {
          storeId: sid,
          OR: [{ metaTitle: null }, { metaDesc: null }],
        },
      }),
    ])

    const totalPages = products._count.id + collections._count.id + blogPosts._count.id
    const totalMissing = missingProductMeta + missingCollectionMeta

    return {
      totalIndexablePages: totalPages,
      products: { total: products._count.id, missingMeta: missingProductMeta },
      collections: { total: collections._count.id, missingMeta: missingCollectionMeta },
      blogPosts: { total: blogPosts._count.id },
      coverage: Math.round(((totalPages - totalMissing) / Math.max(totalPages, 1)) * 100),
    }
  }
}
