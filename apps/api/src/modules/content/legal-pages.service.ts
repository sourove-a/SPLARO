import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  DEFAULT_LEGAL_PAGES,
  LEGAL_PAGE_CATALOG,
  LEGAL_PAGE_SLUGS,
  legalPageLooksStale,
  type LegalPageContent,
  type LegalPageSlug,
} from '@splaro/types'
import type { SitePage } from '@prisma/client'
import { CacheService } from '../../common/cache.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

export interface LegalPageRecord extends LegalPageContent {
  slug: LegalPageSlug
  path: string
  label: string
  isCustomized: boolean
  updatedAt: string | null
  id: string | null
}

function isLegalSlug(slug: string): slug is LegalPageSlug {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(slug)
}

function catalogMeta(slug: LegalPageSlug) {
  const meta = LEGAL_PAGE_CATALOG.find((item) => item.slug === slug)
  if (!meta) throw new NotFoundException('Legal page not found')
  return meta
}

export function rewriteStaleOrderFormat(body: string) {
  return body.replace(/SPL-YYYY-X+/gi, 'SPL-####').replace(/SPL-YYYY-#+/g, 'SPL-####')
}

/** Drop VAT claims until a real tax rate is configured and calculated. */
export function rewriteUnconfiguredVatCopy(body: string) {
  return body
    .replace(
      /All prices are listed in Bangladeshi Taka \(BDT\) inclusive of applicable VAT where stated\./gi,
      'All prices are listed in Bangladeshi Taka (BDT).',
    )
    .replace(/A VAT invoice is included/gi, 'An invoice is included')
    .replace(/\binclusive of applicable VAT( where stated)?\b/gi, '')
    .replace(/\bVAT invoice\b/gi, 'invoice')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ \./g, '.')
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value?.trim()) return value.trim()
  }
  return ''
}

function withFallbackMeta(
  content: LegalPageContent,
  fallback: LegalPageContent,
  row?: Pick<SitePage, 'metaTitle' | 'metaDesc'>,
): LegalPageContent {
  return {
    ...content,
    metaTitle:
      firstText(row?.metaTitle, content.metaTitle, fallback.metaTitle, fallback.title) || fallback.title,
    metaDescription:
      firstText(row?.metaDesc, content.metaDescription, fallback.metaDescription, fallback.description) ||
      fallback.description,
  }
}

function parseStoredContent(row: SitePage, slug: LegalPageSlug): LegalPageContent {
  const fallback = DEFAULT_LEGAL_PAGES[slug]
  if (!row.content) return withFallbackMeta(fallback, fallback, row)

  try {
    const parsed = JSON.parse(row.content) as Partial<LegalPageContent>
    if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      const content: LegalPageContent = {
        title: parsed.title?.trim() || row.title || fallback.title,
        description: parsed.description?.trim() || row.metaDesc || fallback.description,
        sections: parsed.sections.map((section) => ({
          heading: section.heading?.trim() || 'Section',
          body: rewriteUnconfiguredVatCopy(rewriteStaleOrderFormat(section.body?.trim() || '')),
        })),
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
      }
      if (legalPageLooksStale(content)) return withFallbackMeta(fallback, fallback, row)
      return withFallbackMeta(content, fallback, row)
    }
  } catch {
    /* fall through */
  }

  return withFallbackMeta(fallback, fallback, row)
}

@Injectable()
export class LegalPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(storeIdOrSlug: string): Promise<LegalPageRecord[]> {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const rows = await this.prisma.sitePage.findMany({
      where: { storeId, slug: { in: [...LEGAL_PAGE_SLUGS] } },
    })
    const bySlug = new Map(rows.map((row) => [row.slug, row]))

    return LEGAL_PAGE_CATALOG.map((meta) => {
      const row = bySlug.get(meta.slug)
      const content = row ? parseStoredContent(row, meta.slug) : DEFAULT_LEGAL_PAGES[meta.slug]
      return {
        slug: meta.slug,
        path: meta.path,
        label: meta.label,
        ...content,
        isCustomized: Boolean(row),
        updatedAt: row?.updatedAt.toISOString() ?? null,
        id: row?.id ?? null,
      }
    })
  }

  async get(storeIdOrSlug: string, slug: string): Promise<LegalPageRecord> {
    if (!isLegalSlug(slug)) throw new NotFoundException('Legal page not found')

    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const meta = catalogMeta(slug)
    const row = await this.prisma.sitePage.findUnique({
      where: { storeId_slug: { storeId, slug } },
    })
    const content = row ? parseStoredContent(row, slug) : DEFAULT_LEGAL_PAGES[slug]

    return {
      slug,
      path: meta.path,
      label: meta.label,
      ...content,
      isCustomized: Boolean(row),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      id: row?.id ?? null,
    }
  }

  async getPublished(storeIdOrSlug: string, slug: string): Promise<LegalPageContent> {
    const page = await this.get(storeIdOrSlug, slug)
    return {
      title: page.title,
      description: page.description,
      sections: page.sections,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
    }
  }

  async upsert(
    storeIdOrSlug: string,
    slug: string,
    body: LegalPageContent,
  ): Promise<LegalPageRecord> {
    if (!isLegalSlug(slug)) throw new BadRequestException('Invalid legal page slug')

    const title = body.title?.trim()
    const description = body.description?.trim()
    if (!title) throw new BadRequestException('Title is required')
    if (!description) throw new BadRequestException('Description is required')
    if (!Array.isArray(body.sections) || body.sections.length === 0) {
      throw new BadRequestException('At least one section is required')
    }

    const sections = body.sections.map((section, index) => {
      const heading = section.heading?.trim()
      const sectionBody = section.body?.trim()
      if (!heading) throw new BadRequestException(`Section ${index + 1} heading is required`)
      if (!sectionBody) throw new BadRequestException(`Section ${index + 1} body is required`)
      return { heading, body: sectionBody }
    })

    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const payload: LegalPageContent = {
      title,
      description,
      sections,
      metaTitle: body.metaTitle?.trim() || title,
      metaDescription: body.metaDescription?.trim() || description,
    }

    await this.prisma.sitePage.upsert({
      where: { storeId_slug: { storeId, slug } },
      create: {
        storeId,
        slug,
        title,
        content: JSON.stringify(payload),
        metaTitle: payload.metaTitle,
        metaDesc: payload.metaDescription,
        isPublished: true,
      },
      update: {
        title,
        content: JSON.stringify(payload),
        metaTitle: payload.metaTitle,
        metaDesc: payload.metaDescription,
        isPublished: true,
      },
    })

    await this.cache.invalidateStoreResource(storeId, 'legal-pages')
    return this.get(storeId, slug)
  }
}
