import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import type { Prisma } from '@prisma/client'

export interface SEOAuditResult {
  score: number
  issues: SEOIssue[]
  suggestions: string[]
}

export interface SEOIssue {
  type: 'ERROR' | 'WARNING' | 'INFO'
  field: string
  message: string
}

interface ProductSchemaData {
  name: string
  description: string
  price: number
  currency: string
  images: string[]
  sku?: string
  rating?: number
  reviewCount?: number
  inStock: boolean
  url: string
  brand: string
}

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ── SCHEMA GENERATORS ─────────────────────────────────────

  generateProductSchema(data: ProductSchemaData): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: data.name,
      description: data.description,
      image: data.images,
      sku: data.sku,
      brand: { '@type': 'Brand', name: data.brand },
      offers: {
        '@type': 'Offer',
        priceCurrency: data.currency,
        price: data.price,
        availability: data.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: data.url,
      },
      ...(data.rating && data.reviewCount
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: data.rating,
              reviewCount: data.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    }
  }

  generateBreadcrumbSchema(items: { name: string; url: string }[]): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: item.url,
      })),
    }
  }

  generateOrganizationSchema(siteUrl: string): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SPLARO',
      url: siteUrl,
      logo: `${siteUrl}/images/logo/splaro-logo.svg`,
      description: "Luxury women's fashion brand from Bangladesh",
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['English', 'Bengali'],
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'BD',
        addressLocality: 'Dhaka',
      },
    }
  }

  generateFAQSchema(faqs: { question: string; answer: string }[]): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    }
  }

  generateBlogArticleSchema(data: {
    title: string
    excerpt: string
    authorName: string
    publishedAt: Date
    updatedAt: Date
    image: string
    url: string
    siteUrl: string
  }): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      description: data.excerpt,
      image: data.image,
      author: { '@type': 'Person', name: data.authorName },
      publisher: {
        '@type': 'Organization',
        name: 'SPLARO',
        logo: { '@type': 'ImageObject', url: `${data.siteUrl}/images/logo/splaro-logo.svg` },
      },
      datePublished: data.publishedAt.toISOString(),
      dateModified: data.updatedAt.toISOString(),
      url: data.url,
    }
  }

  // ── SEO AUDIT ─────────────────────────────────────────────

  async auditProduct(productId: string, siteUrl: string): Promise<SEOAuditResult> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, reviews: { where: { status: 'APPROVED' } } },
    })

    if (!product) throw new Error(`Product ${productId} not found`)

    const issues: SEOIssue[] = []
    const suggestions: string[] = []
    let score = 100

    // Meta title
    if (!product.metaTitle) {
      issues.push({ type: 'ERROR', field: 'metaTitle', message: 'Missing meta title' })
      score -= 15
    } else if (product.metaTitle.length > 60) {
      issues.push({ type: 'WARNING', field: 'metaTitle', message: `Meta title too long (${product.metaTitle.length}/60 chars)` })
      score -= 5
    } else if (product.metaTitle.length < 30) {
      issues.push({ type: 'WARNING', field: 'metaTitle', message: 'Meta title too short (should be 30–60 chars)' })
      score -= 3
    }

    // Meta description
    if (!product.metaDescription) {
      issues.push({ type: 'ERROR', field: 'metaDescription', message: 'Missing meta description' })
      score -= 15
    } else if (product.metaDescription.length > 160) {
      issues.push({ type: 'WARNING', field: 'metaDescription', message: `Meta description too long (${product.metaDescription.length}/160 chars)` })
      score -= 5
    }

    // Images
    if (product.images.length === 0) {
      issues.push({ type: 'ERROR', field: 'images', message: 'No product images found' })
      score -= 20
    } else {
      const missingAlt = product.images.filter(img => !img.altText)
      if (missingAlt.length > 0) {
        issues.push({ type: 'WARNING', field: 'images', message: `${missingAlt.length} images missing alt text` })
        score -= missingAlt.length * 3
      }
    }

    // Description length
    if (!product.description || product.description.length < 100) {
      issues.push({ type: 'WARNING', field: 'description', message: 'Product description too short (< 100 chars)' })
      score -= 10
      suggestions.push('Use AI Writer to generate a rich product description with keywords')
    }

    // Reviews for rich snippets
    if (product.reviews.length === 0) {
      issues.push({ type: 'INFO', field: 'reviews', message: 'No approved reviews — rich snippet star rating unavailable' })
      suggestions.push('Request reviews via post-purchase email automation')
      score -= 5
    }

    // Save audit result
    await this.prisma.seoConfig.upsert({
      where: { storeId_resourceType_resourceId: { storeId: product.storeId, resourceType: 'product', resourceId: productId } },
      create: {
        storeId: product.storeId,
        resourceType: 'product',
        resourceId: productId,
        seoScore: Math.max(0, score),
        lastAuditAt: new Date(),
        issues: issues as unknown as Prisma.InputJsonValue,
        metaTitle: product.metaTitle,
        metaDesc: product.metaDescription,
      },
      update: {
        seoScore: Math.max(0, score),
        lastAuditAt: new Date(),
        issues: issues as unknown as Prisma.InputJsonValue,
      },
    })

    return {
      score: Math.max(0, score),
      issues,
      suggestions,
    }
  }

  async generateDynamicSitemap(storeId: string, siteUrl: string): Promise<string> {
    const [products, collections, categories, blogPosts] = await Promise.all([
      this.prisma.product.findMany({
        where: { storeId, isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.collection.findMany({
        where: { storeId, isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.category.findMany({
        where: { storeId, isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.blogPost.findMany({
        where: { storeId, status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
    ])

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/collections', priority: '0.9', changefreq: 'weekly' },
      { loc: '/new-arrivals', priority: '0.9', changefreq: 'daily' },
      { loc: '/best-sellers', priority: '0.8', changefreq: 'weekly' },
      { loc: '/about', priority: '0.6', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly' },
      { loc: '/size-guide', priority: '0.5', changefreq: 'monthly' },
      { loc: '/faq', priority: '0.5', changefreq: 'monthly' },
    ]

    const toUrl = (loc: string, lastmod: Date, priority = '0.7', changefreq = 'weekly') =>
      `  <url>\n    <loc>${siteUrl}${loc}</loc>\n    <lastmod>${lastmod.toISOString().split('T')[0]}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`

    const now = new Date()
    const urls = [
      ...staticPages.map(p => toUrl(p.loc, now, p.priority, p.changefreq)),
      ...products.map(p => toUrl(`/products/${p.slug}`, p.updatedAt, '0.8', 'weekly')),
      ...collections.map(c => toUrl(`/collections/${c.slug}`, c.updatedAt, '0.8', 'weekly')),
      ...categories.map(c => toUrl(`/category/${c.slug}`, c.updatedAt, '0.7', 'weekly')),
      ...blogPosts.map(b => toUrl(`/blog/${b.slug}`, b.updatedAt, '0.6', 'monthly')),
    ]

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
  }
}
