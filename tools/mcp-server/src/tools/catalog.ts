import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { money, num, reply, stamp } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const

export function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'search_products',
    {
      title: 'Search products',
      description:
        'Search the catalog by name, slug, SKU or RM code. Returns a compact row per product with price, publish state and total stock. Use this first when the question names a product.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Free text matched against name, slug, SKU and RM code (case-insensitive).'),
        status: z.enum(PRODUCT_STATUSES).optional().describe('Filter by product status.'),
        publishedOnly: z.boolean().optional().describe('Only products visible on the storefront.'),
        categorySlug: z.string().optional().describe('Restrict to one category by slug.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ query, status, publishedOnly, categorySlug, limit, offset }) => {
      const where: Prisma.ProductWhereInput = { storeId: await storeId() }

      if (query?.trim()) {
        const q = query.trim()
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { rmCode: { contains: q, mode: 'insensitive' } },
        ]
      }
      if (status) where.status = status
      if (publishedOnly) where.isPublished = true
      if (categorySlug) where.category = { slug: categorySlug }

      const products = await prisma().product.findMany({
        where,
        take: limit ?? 20,
        skip: offset ?? 0,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          basePrice: true,
          compareAtPrice: true,
          status: true,
          isPublished: true,
          soldCount: true,
          updatedAt: true,
          category: { select: { name: true, slug: true } },
          variants: { select: { stock: true, reservedStock: true, isActive: true } },
        },
      })

      const total = await prisma().product.count({ where })

      return reply({
        count: products.length,
        total,
        offset: offset ?? 0,
        products: products.map((p) => {
          const active = p.variants.filter((v) => v.isActive)
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            price: money(p.basePrice),
            compareAtPrice: num(p.compareAtPrice),
            status: p.status,
            isPublished: p.isPublished,
            category: p.category?.name ?? null,
            variantCount: active.length,
            totalStock: active.reduce((sum, v) => sum + v.stock, 0),
            reservedStock: active.reduce((sum, v) => sum + v.reservedStock, 0),
            soldCount: p.soldCount,
            updatedAt: stamp(p.updatedAt),
          }
        }),
      })
    },
  )

  server.registerTool(
    'get_product',
    {
      title: 'Get product detail',
      description:
        'Full detail for one product — every variant with its stock, pricing, SEO meta and merchandising flags. Accepts a product id, slug or SKU.',
      inputSchema: {
        ref: z.string().describe('Product id, slug, or SKU.'),
      },
    },
    async ({ ref }) => {
      const store = await storeId()
      const value = ref.trim()

      const product = await prisma().product.findFirst({
        where: {
          storeId: store,
          OR: [{ id: value }, { slug: value }, { sku: value }, { rmCode: value }],
        },
        include: {
          category: { select: { name: true, slug: true } },
          images: { select: { url: true, altText: true, isDefault: true }, orderBy: { position: 'asc' } },
          variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
          collections: { select: { collection: { select: { name: true, slug: true } } } },
        },
      })

      if (!product) return reply({ found: false, ref: value })

      return reply({
        found: true,
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        rmCode: product.rmCode,
        status: product.status,
        isPublished: product.isPublished,
        flags: {
          featured: product.isFeatured,
          newArrival: product.isNewArrival,
          bestSeller: product.isBestSeller,
          onSale: product.isOnSale,
          hidden: product.isHidden,
        },
        pricing: {
          basePrice: money(product.basePrice),
          compareAtPrice: num(product.compareAtPrice),
          costPrice: num(product.costPrice),
          currency: 'BDT',
        },
        category: product.category?.name ?? null,
        collections: product.collections.map((c) => c.collection.name),
        description: product.description,
        shortDescription: product.shortDescription,
        attributes: {
          fabricContent: product.fabricContent,
          careInstructions: product.careInstructions,
          fitType: product.fitType,
          occasion: product.occasion,
          season: product.season,
          origin: product.origin,
        },
        seo: {
          metaTitle: product.metaTitle,
          metaDescription: product.metaDescription,
          metaKeywords: product.metaKeywords,
          seoScore: product.seoScore,
        },
        stats: {
          viewCount: product.viewCount,
          soldCount: product.soldCount,
          rating: num(product.rating),
          reviewCount: product.reviewCount,
        },
        lowStockThreshold: product.lowStockThreshold,
        inventoryPolicy: product.inventoryPolicy,
        imageCount: product.images.length,
        images: product.images.map((i) => ({ url: i.url, altText: i.altText, isDefault: i.isDefault })),
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: money(v.price),
          stock: v.stock,
          reservedStock: v.reservedStock,
          availableStock: v.stock - v.reservedStock,
          isActive: v.isActive,
        })),
        totalStock: product.variants
          .filter((v) => v.isActive)
          .reduce((sum, v) => sum + v.stock, 0),
        updatedAt: stamp(product.updatedAt),
      })
    },
  )

  server.registerTool(
    'low_stock',
    {
      title: 'Low stock variants',
      description:
        "Variants at or below their restock threshold, lowest first. Without an explicit threshold each product's own lowStockThreshold is used. Answers 'what do I need to reorder'.",
      inputSchema: {
        threshold: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .optional()
          .describe("Fixed stock cutoff. Omit to use each product's own lowStockThreshold."),
        includeUnpublished: z
          .boolean()
          .optional()
          .describe('Include products that are not live on the storefront. Default false.'),
        limit: z.number().int().min(1).max(200).optional().describe('Max rows, default 50.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ threshold, includeUnpublished, limit, offset }) => {
      const store = await storeId()
      // Prisma cannot compare stock against a per-row column, so pull the
      // candidates and apply each product's own threshold in memory.
      const ceiling = threshold ?? 100
      const CANDIDATE_CAP = 2000

      const variants = await prisma().productVariant.findMany({
        where: {
          isActive: true,
          stock: { lte: ceiling },
          product: {
            storeId: store,
            status: { not: 'ARCHIVED' },
            ...(includeUnpublished ? {} : { isPublished: true }),
          },
        },
        orderBy: { stock: 'asc' },
        take: CANDIDATE_CAP,
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          stock: true,
          reservedStock: true,
          product: {
            select: { id: true, name: true, slug: true, lowStockThreshold: true, isPublished: true },
          },
        },
      })

      const allMatched = variants.filter(
        (v) => v.stock <= (threshold ?? v.product.lowStockThreshold),
      )
      const start = offset ?? 0
      const matched = allMatched.slice(start, start + (limit ?? 50))

      return reply({
        thresholdMode: threshold === undefined ? 'per-product lowStockThreshold' : `fixed <= ${threshold}`,
        count: matched.length,
        total: allMatched.length,
        offset: start,
        ...(variants.length === CANDIDATE_CAP
          ? { truncated: `Only the ${CANDIDATE_CAP} lowest-stock variants were scanned.` }
          : {}),
        variants: matched.map((v) => ({
          productId: v.product.id,
          product: v.product.name,
          slug: v.product.slug,
          isPublished: v.product.isPublished,
          variantId: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
          reserved: v.reservedStock,
          available: v.stock - v.reservedStock,
          threshold: threshold ?? v.product.lowStockThreshold,
        })),
      })
    },
  )

  server.registerTool(
    'seo_gaps',
    {
      title: 'Products with SEO or content gaps',
      description:
        'Live products missing meta title, meta description, body copy or images — the things that block search and AI-shopping visibility.',
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional().describe('Max rows, default 25.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ limit, offset }) => {
      const store = await storeId()
      const where: Prisma.ProductWhereInput = {
        storeId: store,
        isPublished: true,
        OR: [
          { metaTitle: null },
          { metaTitle: '' },
          { metaDescription: null },
          { metaDescription: '' },
          { description: null },
          { description: '' },
          { images: { none: {} } },
        ],
      }

      const [products, total] = await Promise.all([
        prisma().product.findMany({
          where,
          take: limit ?? 25,
          skip: offset ?? 0,
          orderBy: { soldCount: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            metaTitle: true,
            metaDescription: true,
            description: true,
            soldCount: true,
            _count: { select: { images: true } },
          },
        }),
        prisma().product.count({ where }),
      ])

      return reply({
        count: products.length,
        total,
        offset: offset ?? 0,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          soldCount: p.soldCount,
          missing: [
            p.metaTitle ? null : 'metaTitle',
            p.metaDescription ? null : 'metaDescription',
            p.description ? null : 'description',
            p._count.images === 0 ? 'images' : null,
          ].filter((x): x is string => x !== null),
        })),
      })
    },
  )
}
