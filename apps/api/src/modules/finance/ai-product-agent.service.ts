import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { ModelRouter } from '../agent/providers/model-router'
import type { AIJobType } from '@prisma/client'

export interface AIProductInput {
  productName: string
  fabric?: string
  color?: string
  category?: string
  price?: number
  occasion?: string
  size?: string
  stock?: number
  imageUrl?: string
}

@Injectable()
export class AIProductAgentService {
  private readonly logger = new Logger(AIProductAgentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly modelRouter: ModelRouter,
  ) {}

  private async resolveStore(storeIdOrSlug: string) {
    return resolveStoreId(this.prisma, storeIdOrSlug)
  }

  /** Match jobs stored with resolved id or legacy slug (e.g. "splaro"). */
  private storeJobFilter(storeIdOrSlug: string, resolvedId: string) {
    const raw = storeIdOrSlug?.trim()
    const ids = raw && raw !== resolvedId ? [resolvedId, raw] : [resolvedId]
    return { storeId: { in: ids } }
  }

  async createJob(storeIdOrSlug: string, input: AIProductInput, createdBy?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)

    const job = await this.prisma.aIJob.create({
      data: {
        storeId,
        type: 'PRODUCT_AUTOMATION' as AIJobType,
        status: 'PROCESSING',
        createdBy,
        inputData: input as object,
        startedAt: new Date(),
      },
    })

    try {
      const { providerOptions } = await this.modelRouter.getProvider(storeId)
      const output = await this.generateContent(input, storeId)
      const completed = await this.prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          outputData: output as object,
          completedAt: new Date(),
          model: providerOptions?.model ?? this.config.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        },
      })

      await this.prisma.aIContentApproval.create({
        data: {
          storeId,
          jobId: job.id,
          status: 'PENDING',
        },
      })

      return completed
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI generation failed'
      await this.prisma.aIJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMsg, completedAt: new Date() },
      })
      throw new BadRequestException(errorMsg)
    }
  }

  async listJobs(storeIdOrSlug: string, page = 1, limit = 20) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const skip = (page - 1) * limit
    const storeFilter = this.storeJobFilter(storeIdOrSlug, storeId)
    const [items, total] = await Promise.all([
      this.prisma.aIJob.findMany({
        where: { ...storeFilter, type: 'PRODUCT_AUTOMATION' },
        include: { approval: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aIJob.count({ where: { ...storeFilter, type: 'PRODUCT_AUTOMATION' } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async approveJob(jobId: string, storeIdOrSlug: string, reviewedBy?: string, notes?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const job = await this.prisma.aIJob.findFirst({
      where: { id: jobId, ...this.storeJobFilter(storeIdOrSlug, storeId) },
      include: { approval: true },
    })
    if (!job) throw new NotFoundException('AI job not found')

    return this.prisma.aIContentApproval.upsert({
      where: { jobId },
      create: {
        storeId,
        jobId,
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
      update: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
    })
  }

  async rejectJob(jobId: string, storeIdOrSlug: string, reviewedBy?: string, notes?: string) {
    const storeId = await this.resolveStore(storeIdOrSlug)
    const job = await this.prisma.aIJob.findFirst({
      where: { id: jobId, ...this.storeJobFilter(storeIdOrSlug, storeId) },
    })
    if (!job) throw new NotFoundException('AI job not found')

    return this.prisma.aIContentApproval.upsert({
      where: { jobId },
      create: {
        storeId,
        jobId,
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
      update: {
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      },
    })
  }

  private normalizeOutput(raw: Record<string, unknown>) {
    const description =
      (typeof raw['description'] === 'string' && raw['description']) ||
      (typeof raw['longDescription'] === 'string' && raw['longDescription']) ||
      (typeof raw['shortDescription'] === 'string' && raw['shortDescription']) ||
      (typeof raw['descriptionEn'] === 'string' && raw['descriptionEn']) ||
      ''
    const metaTitle =
      (typeof raw['metaTitle'] === 'string' && raw['metaTitle']) ||
      (typeof raw['seoTitle'] === 'string' && raw['seoTitle']) ||
      (typeof raw['title'] === 'string' && raw['title']) ||
      ''
    const metaDescription =
      (typeof raw['metaDescription'] === 'string' && raw['metaDescription']) ||
      (typeof raw['seoMetaDescription'] === 'string' && raw['seoMetaDescription']) ||
      ''

    return {
      ...raw,
      description,
      metaTitle,
      metaDescription,
      longDescription: raw['longDescription'] ?? description,
      seoTitle: raw['seoTitle'] ?? metaTitle,
      seoMetaDescription: raw['seoMetaDescription'] ?? metaDescription,
    }
  }

  private async generateContent(input: AIProductInput, storeId: string) {
    const { provider, apiKey, model, providerOptions } = await this.modelRouter.getProvider(storeId)
    const skuBase = input.productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
    const sku = `SPL-${skuBase}-${Date.now().toString().slice(-4)}`
    const rmCode = `RM-${skuBase}-${input.color?.slice(0, 3).toUpperCase() ?? 'STD'}`
    const siteUrl = this.config.get('WEB_URL') ?? 'https://splaro.co'
    const slug = input.productName.toLowerCase().replace(/\s+/g, '-').slice(0, 60)

    const base = {
      title: `${input.productName} — ${input.fabric ?? 'Premium'} ${input.color ?? ''}`.trim(),
      shortDescription: `Luxury ${input.category ?? 'fashion'} piece by SPLARO. ${input.fabric ?? 'Premium fabric'}, ${input.color ?? 'elegant'} tone.`,
      longDescription: `Discover ${input.productName} from SPLARO — crafted for ${input.occasion ?? 'every occasion'}. Fabric: ${input.fabric ?? 'premium'}. Available sizes: ${input.size ?? 'S–XL'}.`,
      seoTitle: `${input.productName} | SPLARO Bangladesh`,
      seoMetaDescription: `Shop ${input.productName} at SPLARO. ${input.fabric ?? 'Premium'} ${input.category ?? 'fashion'} with nationwide delivery.`,
      tags: [input.category, input.fabric, input.color, input.occasion, 'SPLARO', 'luxury'].filter(Boolean),
      keywords: [input.productName, input.category, input.fabric, 'women fashion bd', 'splaro'].filter(Boolean) as string[],
      descriptionBn: `${input.productName} — SPLARO থেকে প্রিমিয়াম ${input.category ?? 'ফ্যাশন'}।`,
      descriptionEn: `${input.productName} — premium ${input.category ?? 'fashion'} from SPLARO.`,
      careInstructions: 'Dry clean only. Store in cool dry place. Iron on low heat.',
      sizeGuideSuggestion: 'True to size. Model wears size M.',
      instagramCaption: `✨ ${input.productName}\n${input.fabric ?? 'Premium'} · ${input.color ?? ''}\nShop: ${siteUrl}/products/${slug}`,
      facebookCaption: `New arrival: ${input.productName}. Order now at SPLARO.`,
      whatsappMessage: `🛍 ${input.productName}\nPrice: ৳${input.price ?? 0}\nOrder: ${siteUrl}/products/${slug}`,
      googleMerchantTitle: `${input.productName} — SPLARO Women's Fashion`,
      altText: `${input.productName} ${input.color ?? ''} ${input.category ?? 'product'} photo`,
      skuSuggestion: sku,
      rmCodeSuggestion: rmCode,
      qrCodeData: `${siteUrl}/products/${slug}?sku=${sku}`,
      barcodeData: sku.replace(/-/g, ''),
      shareLink: `${siteUrl}/products/${slug}`,
    }

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are SPLARO luxury fashion copywriter. Return a single JSON object with product content fields including description, longDescription, metaTitle, seoTitle, metaDescription, seoMetaDescription, tags, keywords, descriptionBn, descriptionEn, careInstructions, sizeGuideSuggestion, instagramCaption, facebookCaption, whatsappMessage. Bangla and English descriptions required.',
      },
      {
        role: 'user' as const,
        content: `Generate product content for: ${JSON.stringify(input)}. Base template: ${JSON.stringify(base)}`,
      },
    ]

    const result = await provider.chat(messages, [], apiKey, providerOptions)
    const content = result.content?.trim()
    if (!content) {
      throw new BadRequestException(`AI model (${model}) returned empty content`)
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new BadRequestException(`AI model (${model}) returned non-JSON content`)
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return this.normalizeOutput({ ...base, ...parsed })
    } catch {
      throw new BadRequestException(`AI model (${model}) returned invalid JSON`)
    }
  }
}
