import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../../common/auth/public.decorator'
import { SearchService } from './search.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* ─── Storefront search ───────────────────────────────────── */

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async search(
    @Query('q') query: string,
    @Query('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('category') category?: string,
    @Query('sort') sort?: 'price_asc' | 'price_desc' | 'newest' | 'relevance',
    @Query('inStock') inStock?: string,
  ) {
    return this.searchService.search({
      query: query ?? '',
      storeId,
      page: Number(page),
      limit: Number(limit),
      sort,
      filters: {
        category,
        inStockOnly: inStock === 'true',
      },
    })
  }

  /** Autocomplete suggestions */
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get('suggest')
  async suggest(
    @Query('q') query: string,
    @Query('storeId') storeId: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const q = (query ?? '').trim()
    if (!q) return { suggestions: [] }

    const take = Math.min(Number(limit) || 8, 20)

    const [products, recentSearches] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          storeId: sid,
          isPublished: true,
          status: { not: 'ARCHIVED' },
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true },
        take,
      }),
      this.prisma.searchAnalytics.findMany({
        where: {
          storeId: sid,
          query: { contains: q, mode: 'insensitive' },
          resultsCount: { gt: 0 },
        },
        select: { query: true },
        distinct: ['query'],
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const popularTerms = [...new Set(recentSearches.map((s) => s.query))].slice(0, 5)

    return {
      products: products.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
      popularTerms,
    }
  }

  /* ─── Admin: indexing ─────────────────────────────────────── */

  @Post('index/:storeId')
  async indexProducts(@Param('storeId') storeId: string) {
    return this.searchService.indexProducts(storeId)
  }

  /** Re-index a single product */
  @Post('index/product/:productId')
  async indexProduct(@Param('productId') productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { storeId: true, name: true },
    })
    if (!product) return { error: 'Product not found' }
    await this.searchService.indexProducts(product.storeId)
    return { ok: true, productId }
  }

  /* ─── Admin: config ───────────────────────────────────────── */

  /** Get search config for a store */
  @Get('config/:storeId')
  async getConfig(@Param('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.searchConfig.findFirst({
      where: { storeId: sid },
    })
  }

  /** Upsert search config */
  @Patch('config/:storeId')
  async updateConfig(
    @Param('storeId') storeId: string,
    @Body() body: { provider?: string; indexName?: string; settings?: Record<string, unknown> },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const existing = await this.prisma.searchConfig.findFirst({ where: { storeId: sid } })

    if (existing) {
      return this.prisma.searchConfig.update({
        where: { id: existing.id },
        data: {
          ...(body.provider ? { provider: body.provider } : {}),
          ...(body.indexName ? { indexName: body.indexName } : {}),
          ...(body.settings ? { settings: body.settings as object } : {}),
        },
      })
    }

    return this.prisma.searchConfig.create({
      data: {
        storeId: sid,
        provider: body.provider ?? 'meilisearch',
        indexName: body.indexName ?? `products-${sid}`,
        settings: (body.settings ?? {}) as object,
      },
    })
  }

  /* ─── Admin: analytics ────────────────────────────────────── */

  @Get('analytics/:storeId')
  async analytics(@Param('storeId') storeId: string, @Query('days') days = 7) {
    return this.searchService.getSearchAnalytics(storeId, Number(days))
  }

  /** Popular search terms */
  @Get('analytics/:storeId/popular')
  async popularTerms(
    @Param('storeId') storeId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 14))
    const take = Math.min(Number(limit) || 20, 100)

    const grouped = await this.prisma.searchAnalytics.groupBy({
      by: ['query'],
      where: { storeId: sid, createdAt: { gte: since }, resultsCount: { gt: 0 } },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take,
    })

    return grouped.map((g) => ({ query: g.query, count: g._count.query }))
  }

  /** Zero-results searches (search gaps) */
  @Get('analytics/:storeId/zero-results')
  async zeroResults(
    @Param('storeId') storeId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 14))
    const take = Math.min(Number(limit) || 20, 100)

    const grouped = await this.prisma.searchAnalytics.groupBy({
      by: ['query'],
      where: { storeId: sid, createdAt: { gte: since }, resultsCount: 0 },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take,
    })

    return grouped.map((g) => ({ query: g.query, count: g._count.query }))
  }

  /** CTR — queries that led to a click */
  @Get('analytics/:storeId/ctr')
  async clickThroughRate(
    @Param('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 14))

    const [total, clicked] = await Promise.all([
      this.prisma.searchAnalytics.count({ where: { storeId: sid, createdAt: { gte: since } } }),
      this.prisma.searchAnalytics.count({ where: { storeId: sid, createdAt: { gte: since }, clicked: true } }),
    ])

    return {
      period: `${Number(days) || 14}d`,
      totalSearches: total,
      clickedSearches: clicked,
      ctr: total > 0 ? Math.round((clicked / total) * 100) : 0,
    }
  }

  /** Log a search event (called by storefront) */
  @Public()
  @Post('analytics/track')
  async trackSearch(
    @Body()
    body: {
      storeId: string
      query: string
      resultsCount: number
      clicked?: boolean
      clickedProductId?: string
      sessionId?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    await this.prisma.searchAnalytics.create({
      data: {
        storeId: sid,
        query: body.query,
        resultsCount: body.resultsCount,
        clicked: body.clicked ?? false,
        clickedProductId: body.clickedProductId,
        sessionId: body.sessionId,
      },
    })
    return { ok: true }
  }

  /** Mark a search result as clicked */
  @Public()
  @Patch('analytics/:id/click')
  async recordClick(
    @Param('id') id: string,
    @Body('productId') productId?: string,
  ) {
    return this.prisma.searchAnalytics.update({
      where: { id },
      data: { clicked: true, clickedProductId: productId },
    })
  }

  /** Clear old analytics data */
  @Delete('analytics/:storeId/purge')
  async purgeAnalytics(
    @Param('storeId') storeId: string,
    @Query('olderThanDays') olderThanDays?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const before = new Date()
    before.setDate(before.getDate() - (Number(olderThanDays) || 90))

    const { count } = await this.prisma.searchAnalytics.deleteMany({
      where: { storeId: sid, createdAt: { lt: before } },
    })

    return { deleted: count }
  }
}
