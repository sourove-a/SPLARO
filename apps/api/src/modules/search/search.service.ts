import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import MeiliSearch, { type Index } from 'meilisearch'

export interface SearchResult {
  hits: SearchHit[]
  totalHits: number
  processingTimeMs: number
  query: string
}

export interface SearchHit {
  id: string
  name: string
  slug: string
  price: number
  salePrice?: number
  image?: string
  category?: string
  collection?: string
  tags: string[]
  inStock: boolean
  _rankingScore?: number
}

interface SearchParams {
  query: string
  storeId: string
  page?: number
  limit?: number
  filters?: {
    category?: string
    collection?: string
    minPrice?: number
    maxPrice?: number
    inStockOnly?: boolean
    tags?: string[]
  }
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'relevance'
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name)
  private client: MeiliSearch | null = null
  private productIndex: Index | null = null

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const host = this.config.get<string>('MEILISEARCH_HOST')
    const key = this.config.get<string>('MEILISEARCH_MASTER_KEY')

    if (!host) {
      this.logger.warn('MEILISEARCH_HOST not configured — search disabled')
      return
    }

    try {
      this.client = new MeiliSearch({ host, apiKey: key })
      this.productIndex = this.client.index('products')

      await this.productIndex.updateSettings({
        searchableAttributes: ['name', 'description', 'tags', 'category', 'collection', 'sku'],
        filterableAttributes: ['storeId', 'category', 'collection', 'inStock', 'price', 'salePrice', 'tags'],
        sortableAttributes: ['price', 'salePrice', 'createdAt'],
        rankingRules: [
          'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
        ],
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
        },
        pagination: { maxTotalHits: 1000 },
      })

      this.logger.log('Meilisearch initialized')
    } catch (err) {
      this.logger.error(`Meilisearch init failed: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, storeId, page = 1, limit = 20, filters, sort } = params
    const offset = (page - 1) * limit

    // Track analytics
    await this.trackSearch(storeId, query).catch(() => null)

    // Fallback to DB search if Meilisearch unavailable
    if (!this.productIndex) {
      return this.dbSearch(params)
    }

    const filterParts: string[] = [`storeId = "${storeId}"`]
    if (filters?.category) filterParts.push(`category = "${filters.category}"`)
    if (filters?.collection) filterParts.push(`collection = "${filters.collection}"`)
    if (filters?.inStockOnly) filterParts.push('inStock = true')
    if (filters?.minPrice) filterParts.push(`price >= ${filters.minPrice}`)
    if (filters?.maxPrice) filterParts.push(`price <= ${filters.maxPrice}`)
    if (filters?.tags?.length) {
      filterParts.push(`tags IN [${filters.tags.map(t => `"${t}"`).join(', ')}]`)
    }

    const sortExpr = sort === 'price_asc' ? ['price:asc']
      : sort === 'price_desc' ? ['price:desc']
      : sort === 'newest' ? ['createdAt:desc']
      : undefined

    const result = await this.productIndex.search<SearchHit>(query, {
      filter: filterParts.join(' AND '),
      sort: sortExpr,
      limit,
      offset,
      attributesToHighlight: ['name'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    })

    return {
      hits: result.hits,
      totalHits: result.estimatedTotalHits ?? result.hits.length,
      processingTimeMs: result.processingTimeMs,
      query,
    }
  }

  async indexProducts(storeId: string): Promise<{ indexed: number }> {
    if (!this.productIndex) throw new Error('Meilisearch not configured')

    const products = await this.prisma.product.findMany({
      where: storefrontVisibleProductWhere({ storeId }),
      include: {
        images: { take: 1, orderBy: { position: 'asc' } },
        category: { select: { name: true } },
        collections: { take: 1, include: { collection: { select: { name: true } } } },
        variants: { where: { isActive: true }, select: { stock: true, isActive: true } },
      },
    })

    const docs = products.map(p => ({
      id: p.id,
      storeId: p.storeId,
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      price: Number(p.basePrice),
      salePrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      image: p.images[0]?.url,
      category: p.category?.name,
      collection: p.collections[0]?.collection.name,
      tags: p.tags,
      sku: p.sku ?? '',
      inStock: p.variants.some((v) => v.isActive && v.stock > 0),
      createdAt: p.createdAt.toISOString(),
    }))

    await this.productIndex.addDocuments(docs, { primaryKey: 'id' })
    this.logger.log(`Indexed ${docs.length} products for store ${storeId}`)

    return { indexed: docs.length }
  }

  async deleteFromIndex(productId: string): Promise<void> {
    if (!this.productIndex) return
    await this.productIndex.deleteDocument(productId)
  }

  async getSearchAnalytics(storeId: string, days = 7) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const analytics = await this.prisma.searchAnalytics.findMany({
      where: { storeId, createdAt: { gte: since } },
      orderBy: { resultsCount: 'desc' },
      take: 50,
    })

    return analytics
  }

  private async trackSearch(storeId: string, query: string): Promise<void> {
    if (!query.trim() || query.length < 2) return

    await this.prisma.searchAnalytics.create({
      data: {
        storeId,
        query: query.toLowerCase(),
        resultsCount: 0,
      },
    })
  }

  // DB fallback when Meilisearch is down
  private async dbSearch(params: SearchParams): Promise<SearchResult> {
    const { query, storeId, page = 1, limit = 20, filters } = params
    const offset = (page - 1) * limit

    const products = await this.prisma.product.findMany({
      where: {
        ...storefrontVisibleProductWhere({ storeId }),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
        ...(filters?.category ? { category: { slug: filters.category } } : {}),
        ...(filters?.inStockOnly ? { variants: { some: { isActive: true, stock: { gt: 0 } } } } : {}),
        ...(filters?.minPrice ? { basePrice: { gte: filters.minPrice } } : {}),
        ...(filters?.maxPrice ? { basePrice: { lte: filters.maxPrice } } : {}),
      },
      include: {
        images: { take: 1, orderBy: { position: 'asc' } },
        category: { select: { name: true } },
        variants: { where: { isActive: true }, select: { stock: true, isActive: true } },
      },
      skip: offset,
      take: limit,
    })

    const hits: SearchHit[] = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.basePrice),
      salePrice: p.compareAtPrice ? Number(p.compareAtPrice) : undefined,
      image: p.images[0]?.url,
      category: p.category?.name,
      tags: p.tags,
      inStock: p.variants.some((v) => v.isActive && v.stock > 0),
    }))

    return { hits, totalHits: hits.length, processingTimeMs: 0, query }
  }
}
