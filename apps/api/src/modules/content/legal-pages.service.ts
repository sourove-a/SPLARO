import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  DEFAULT_LEGAL_PAGES,
  LEGAL_PAGE_CATALOG,
  LEGAL_PAGE_SLUGS,
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

function parseStoredContent(row: SitePage, slug: LegalPageSlug): LegalPageContent {
  const fallback = DEFAULT_LEGAL_PAGES[slug]
  if (!row.content) return fallback

  try {
    const parsed = JSON.parse(row.content) as Partial<LegalPageContent>
    if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      return {
        title: parsed.title?.trim() || row.title || fallback.title,
        description: parsed.description?.trim() || row.metaDesc || fallback.description,
        sections: parsed.sections.map((section) => ({
          heading: section.heading?.trim() || 'Section',
          body: section.body?.trim() || '',
        })),
        metaTitle: row.metaTitle ?? parsed.metaTitle ?? parsed.title ?? fallback.title,
        metaDescription: row.metaDesc ?? parsed.metaDescription ?? parsed.description ?? fallback.description,
      }
    }
  } catch {
    /* fall through */
  }

  return {
    ...fallback,
    metaTitle: row.metaTitle ?? fallback.title,
    metaDescription: row.metaDesc ?? fallback.description,
  }
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
